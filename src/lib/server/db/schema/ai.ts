import { sql } from 'drizzle-orm';
import {
	bigint,
	bigserial,
	boolean,
	check,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { articles } from './content';
import { LOCALES } from './shared';
import { categories } from './taxonomy';

/**
 * AI writer (PLAN-DEV §R).
 *
 * Added after the schema freeze (PLAN-DEV §D.4), by migration, for a feature
 * the owner asked for after Fase 7: drafting help that stays inside PRD §6.1 —
 * AI researches and drafts, a person picks the topic, verifies and publishes.
 */

export const MODEL_PROVIDER_KINDS = [
	'anthropic',
	'openai',
	'gemini',
	'openrouter',
	'openai_compatible',
	// DeepSeek, Kimi, GLM, MiniMax, Ollama, LM Studio … through the Anthropic SDK with another base URL.
	'anthropic_compatible'
] as const;
export type ModelProviderKind = (typeof MODEL_PROVIDER_KINDS)[number];

export const SEARCH_PROVIDER_KINDS = [
	'brave',
	'tavily',
	'serper',
	'serpapi',
	'exa',
	'searxng'
] as const;
export type SearchProviderKind = (typeof SEARCH_PROVIDER_KINDS)[number];

export const CREDENTIAL_PURPOSES = ['model', 'search'] as const;
export type CredentialPurpose = (typeof CREDENTIAL_PURPOSES)[number];

/**
 * queued → researching → review → drafting → done
 *
 * `review` is a stop, not a step: nothing is written until the editor has
 * looked at the sources and claims and approved an outline.
 */
export const AI_JOB_STATUSES = [
	'queued',
	'researching',
	'review',
	'drafting',
	'done',
	'failed',
	'cancelled'
] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

/** Statuses during which a worker is (or should be) running. */
export const AI_ACTIVE_STATUSES: AiJobStatus[] = ['queued', 'researching', 'drafting'];

export type ClaimStatus = 'confirmed' | 'single' | 'unverified' | 'mismatch';

export type ClaimEvidence = { source: string; quote: string; found: boolean };

export type AiClaim = {
	id: string;
	statement: string;
	evidence: ClaimEvidence[];
	status: ClaimStatus;
	/** Registrable domains whose text contains a supporting quote. */
	domains: string[];
	/** Numbers in the statement that no verified quote contains. */
	unmatchedNumbers: string[];
	included: boolean;
};

export type AiOutline = {
	title: string;
	excerpt: string;
	sections: { heading: string; points: string[] }[];
};

export type AiLogEntry = { at: string; level: 'info' | 'warn' | 'error'; message: string };

/**
 * A provider account: a model API or a search API.
 *
 * The key is stored encrypted (src/lib/server/ai/secrets.ts) and never leaves
 * the server — pages receive `keyHint`, not the key.
 */
export const aiCredentials = pgTable(
	'ai_credentials',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		purpose: text('purpose', { enum: CREDENTIAL_PURPOSES }).notNull(),
		kind: text('kind').notNull(),
		label: text('label').notNull(),
		/** For the *_compatible kinds; null means the provider's own default endpoint. */
		baseUrl: text('base_url'),
		/** Model id for purpose=model; null for search. */
		model: text('model'),
		/** Null only for a local endpoint that needs no key (Ollama, LM Studio). */
		apiKeyEnc: text('api_key_enc'),
		keyHint: text('key_hint'),
		/** Optional USD prices per million tokens, for the cost estimate and budget. */
		inputUsdPerMtok: doublePrecision('input_usd_per_mtok'),
		outputUsdPerMtok: doublePrecision('output_usd_per_mtok'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	() => [
		check('ai_credentials_purpose_ck', sql`purpose IN ('model', 'search')`),
		check(
			'ai_credentials_kind_ck',
			sql`(purpose = 'model' AND kind IN ('anthropic', 'openai', 'gemini', 'openrouter', 'openai_compatible', 'anthropic_compatible'))
				OR (purpose = 'search' AND kind IN ('brave', 'tavily', 'serper', 'serpapi', 'exa', 'searxng'))`
		)
	]
);

/** One row, id = 1. Editorial guard rails for the writer. */
export const aiSettings = pgTable(
	'ai_settings',
	{
		id: integer('id').primaryKey().default(1),
		trustedDomains: text('trusted_domains')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		blockedDomains: text('blocked_domains')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** PRD §17: at most five articles a week. Counted over AI drafts. */
		weeklyLimit: integer('weekly_limit').notNull().default(5),
		/** PRD §17 cost alarm. Null means no cap. */
		monthlyBudgetUsd: doublePrecision('monthly_budget_usd'),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	() => [check('ai_settings_single_row_ck', sql`id = 1`)]
);

export const aiJobs = pgTable(
	'ai_jobs',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		status: text('status', { enum: AI_JOB_STATUSES }).notNull().default('queued'),
		locale: text('locale', { enum: LOCALES }).notNull(),
		categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
			onDelete: 'set null'
		}),
		/** The editor's idea. PRD §6.1: choosing the topic is not delegated. */
		idea: text('idea').notNull(),
		/** The editor's angle — also theirs to choose. */
		angle: text('angle').notNull().default(''),
		/** The editor's standing instructions for this piece: what to do and what to avoid. */
		notes: text('notes').notNull().default(''),
		seedUrls: text('seed_urls')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		modelCredentialId: bigint('model_credential_id', { mode: 'number' }).references(
			() => aiCredentials.id,
			{ onDelete: 'set null' }
		),
		searchCredentialId: bigint('search_credential_id', { mode: 'number' }).references(
			() => aiCredentials.id,
			{ onDelete: 'set null' }
		),
		/** Snapshot of `provider / model` at creation, kept if the credential is deleted. */
		modelLabel: text('model_label').notNull(),
		claims: jsonb('claims').$type<AiClaim[]>().notNull().default([]),
		outline: jsonb('outline').$type<AiOutline | null>(),
		log: jsonb('log').$type<AiLogEntry[]>().notNull().default([]),
		articleId: bigint('article_id', { mode: 'number' }).references(() => articles.id, {
			onDelete: 'set null'
		}),
		error: text('error'),
		inputTokens: integer('input_tokens').notNull().default(0),
		outputTokens: integer('output_tokens').notNull().default(0),
		costUsd: doublePrecision('cost_usd').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		finishedAt: timestamp('finished_at', { withTimezone: true })
	},
	(t) => [
		check(
			'ai_jobs_status_ck',
			sql`status IN ('queued', 'researching', 'review', 'drafting', 'done', 'failed', 'cancelled')`
		),
		index('ai_jobs_status_idx').on(t.status),
		index('ai_jobs_created_idx').on(t.createdAt)
	]
);

/**
 * Sources read for a job.
 *
 * Its own table rather than a JSON column on the job, because of `text`: the
 * extracted page can run to tens of kilobytes, and the job page polls every
 * few seconds. A column the list query simply does not select is the only
 * reliable way to keep that off the wire.
 */
export const aiJobSources = pgTable(
	'ai_job_sources',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		jobId: bigint('job_id', { mode: 'number' })
			.notNull()
			.references(() => aiJobs.id, { onDelete: 'cascade' }),
		/** S1, S2 … — what the model cites and what claims point at. */
		key: text('key').notNull(),
		origin: text('origin', { enum: ['seed', 'search'] }).notNull(),
		url: text('url').notNull(),
		finalUrl: text('final_url'),
		title: text('title').notNull().default(''),
		siteName: text('site_name').notNull().default(''),
		domain: text('domain').notNull().default(''),
		publishedAt: text('published_at'),
		status: text('status', { enum: ['ok', 'failed', 'blocked'] }).notNull(),
		error: text('error'),
		trusted: boolean('trusted').notNull().default(false),
		included: boolean('included').notNull().default(true),
		text: text('text').notNull().default(''),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('ai_job_sources_key_idx').on(t.jobId, t.key),
		check('ai_job_sources_status_ck', sql`status IN ('ok', 'failed', 'blocked')`),
		check('ai_job_sources_origin_ck', sql`origin IN ('seed', 'search')`)
	]
);
