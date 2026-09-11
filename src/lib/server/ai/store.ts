import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/types';
import {
	aiCredentials,
	aiJobSources,
	aiJobs,
	aiSettings,
	type AiJobStatus,
	type AiLogEntry,
	type CredentialPurpose
} from '../db/schema';
import { decryptSecret, encryptSecret, keyHint } from './secrets';

/**
 * Persistence for the writer. Every read that feeds a page goes through a
 * function here that leaves the encrypted key and the source text behind.
 */

// ── Credentials ─────────────────────────────────────────────────────────────

const publicCredential = {
	id: aiCredentials.id,
	purpose: aiCredentials.purpose,
	kind: aiCredentials.kind,
	label: aiCredentials.label,
	baseUrl: aiCredentials.baseUrl,
	model: aiCredentials.model,
	keyHint: aiCredentials.keyHint,
	inputUsdPerMtok: aiCredentials.inputUsdPerMtok,
	outputUsdPerMtok: aiCredentials.outputUsdPerMtok,
	createdAt: aiCredentials.createdAt
};

export type CredentialView = Awaited<ReturnType<typeof listCredentials>>[number];

export async function listCredentials(db: Database, purpose?: CredentialPurpose) {
	return db
		.select(publicCredential)
		.from(aiCredentials)
		.where(purpose ? eq(aiCredentials.purpose, purpose) : undefined)
		.orderBy(aiCredentials.purpose, aiCredentials.label, aiCredentials.id);
}

export type CredentialInput = {
	purpose: CredentialPurpose;
	kind: string;
	label: string;
	baseUrl: string | null;
	model: string | null;
	/** Empty on update means "keep the stored key". */
	apiKey: string;
	inputUsdPerMtok: number | null;
	outputUsdPerMtok: number | null;
};

export async function createCredential(db: Database, input: CredentialInput): Promise<number> {
	const key = input.apiKey.trim();
	const [row] = await db
		.insert(aiCredentials)
		.values({
			purpose: input.purpose,
			kind: input.kind,
			label: input.label,
			baseUrl: input.baseUrl,
			model: input.model,
			apiKeyEnc: key ? encryptSecret(key) : null,
			keyHint: key ? keyHint(key) : null,
			inputUsdPerMtok: input.inputUsdPerMtok,
			outputUsdPerMtok: input.outputUsdPerMtok
		})
		.returning({ id: aiCredentials.id });
	return row.id;
}

export async function updateCredential(
	db: Database,
	id: number,
	input: Omit<CredentialInput, 'purpose' | 'kind'> & { clearKey?: boolean }
) {
	const key = input.apiKey.trim();
	await db
		.update(aiCredentials)
		.set({
			label: input.label,
			baseUrl: input.baseUrl,
			model: input.model,
			inputUsdPerMtok: input.inputUsdPerMtok,
			outputUsdPerMtok: input.outputUsdPerMtok,
			...(key
				? { apiKeyEnc: encryptSecret(key), keyHint: keyHint(key) }
				: input.clearKey
					? { apiKeyEnc: null, keyHint: null }
					: {})
		})
		.where(eq(aiCredentials.id, id));
}

export async function deleteCredential(db: Database, id: number) {
	await db.delete(aiCredentials).where(eq(aiCredentials.id, id));
}

/** The only function that decrypts. Its result must never be returned from a load. */
export async function getCredentialWithKey(db: Database, id: number) {
	const [row] = await db.select().from(aiCredentials).where(eq(aiCredentials.id, id)).limit(1);
	if (!row) return null;
	const { apiKeyEnc, ...rest } = row;
	return { ...rest, apiKey: apiKeyEnc ? decryptSecret(apiKeyEnc) : null };
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getAiSettings(db: Database) {
	await db.insert(aiSettings).values({ id: 1 }).onConflictDoNothing();
	const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
	return row;
}

export async function updateAiSettings(
	db: Database,
	patch: {
		trustedDomains: string[];
		blockedDomains: string[];
		weeklyLimit: number;
		monthlyBudgetUsd: number | null;
	}
) {
	await getAiSettings(db);
	await db.update(aiSettings).set(patch).where(eq(aiSettings.id, 1));
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export type NewJob = {
	locale: 'en' | 'id';
	categoryId: number;
	idea: string;
	angle: string;
	seedUrls: string[];
	modelCredentialId: number;
	searchCredentialId: number | null;
	modelLabel: string;
};

export async function createJob(db: Database, input: NewJob): Promise<number> {
	const [row] = await db.insert(aiJobs).values(input).returning({ id: aiJobs.id });
	return row.id;
}

export async function getJob(db: Database, id: number) {
	const [row] = await db.select().from(aiJobs).where(eq(aiJobs.id, id)).limit(1);
	return row ?? null;
}

export type JobRow = NonNullable<Awaited<ReturnType<typeof getJob>>>;

export async function listJobs(db: Database, { limit, offset }: { limit: number; offset: number }) {
	const rows = await db
		.select({
			id: aiJobs.id,
			status: aiJobs.status,
			idea: aiJobs.idea,
			locale: aiJobs.locale,
			modelLabel: aiJobs.modelLabel,
			articleId: aiJobs.articleId,
			costUsd: aiJobs.costUsd,
			error: aiJobs.error,
			createdAt: aiJobs.createdAt,
			total: sql<number>`count(*) OVER ()`.mapWith(Number)
		})
		.from(aiJobs)
		.orderBy(desc(aiJobs.createdAt), desc(aiJobs.id))
		.limit(limit)
		.offset(offset);

	return { items: rows, total: rows[0]?.total ?? 0 };
}

/** The job's article, if any: shown as a banner in the article editor. */
export async function jobForArticle(db: Database, articleId: number) {
	const [row] = await db
		.select({ id: aiJobs.id, claims: aiJobs.claims })
		.from(aiJobs)
		.where(eq(aiJobs.articleId, articleId))
		.orderBy(desc(aiJobs.id))
		.limit(1);
	return row ?? null;
}

export async function setJob(db: Database, id: number, patch: Partial<typeof aiJobs.$inferInsert>) {
	await db.update(aiJobs).set(patch).where(eq(aiJobs.id, id));
}

/** Moves a job only if it is still where the caller thinks it is. */
export async function transitionJob(
	db: Database,
	id: number,
	from: AiJobStatus[],
	to: AiJobStatus,
	patch: Partial<typeof aiJobs.$inferInsert> = {}
): Promise<boolean> {
	const rows = await db
		.update(aiJobs)
		.set({ ...patch, status: to })
		.where(and(eq(aiJobs.id, id), sql`${aiJobs.status} IN ${from}`))
		.returning({ id: aiJobs.id });
	return rows.length > 0;
}

/**
 * Puts a failed or cancelled job back under review — only when its research
 * got as far as claims. A job that failed while drafting has lost nothing but
 * the draft; starting it again would pay to read every source a second time.
 */
export async function reopenJob(
	db: Database,
	id: number,
	patch: Partial<typeof aiJobs.$inferInsert> = {}
): Promise<boolean> {
	const rows = await db
		.update(aiJobs)
		.set({ ...patch, status: 'review', error: null, finishedAt: null })
		.where(
			and(
				eq(aiJobs.id, id),
				inArray(aiJobs.status, ['failed', 'cancelled']),
				sql`jsonb_array_length(${aiJobs.claims}) > 0`
			)
		)
		.returning({ id: aiJobs.id });
	return rows.length > 0;
}

export async function appendLog(
	db: Database,
	id: number,
	level: AiLogEntry['level'],
	message: string
) {
	const entry: AiLogEntry = { at: new Date().toISOString(), level, message };
	await db
		.update(aiJobs)
		.set({ log: sql`${aiJobs.log} || ${JSON.stringify([entry])}::jsonb` })
		.where(eq(aiJobs.id, id));
}

export async function addUsage(
	db: Database,
	id: number,
	usage: { inputTokens: number; outputTokens: number },
	costUsd: number
) {
	await db
		.update(aiJobs)
		.set({
			inputTokens: sql`${aiJobs.inputTokens} + ${usage.inputTokens}`,
			outputTokens: sql`${aiJobs.outputTokens} + ${usage.outputTokens}`,
			costUsd: sql`${aiJobs.costUsd} + ${costUsd}`
		})
		.where(eq(aiJobs.id, id));
}

export async function jobsCreatedSince(db: Database, since: Date): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)`.mapWith(Number) })
		.from(aiJobs)
		.where(gte(aiJobs.createdAt, since));
	return row?.n ?? 0;
}

export async function costSince(db: Database, since: Date): Promise<number> {
	const [row] = await db
		.select({ usd: sql<number>`coalesce(sum(${aiJobs.costUsd}), 0)`.mapWith(Number) })
		.from(aiJobs)
		.where(gte(aiJobs.createdAt, since));
	return row?.usd ?? 0;
}

// ── Sources ─────────────────────────────────────────────────────────────────

export async function listSources(db: Database, jobId: number) {
	return db
		.select({
			id: aiJobSources.id,
			key: aiJobSources.key,
			origin: aiJobSources.origin,
			url: aiJobSources.url,
			finalUrl: aiJobSources.finalUrl,
			title: aiJobSources.title,
			siteName: aiJobSources.siteName,
			domain: aiJobSources.domain,
			publishedAt: aiJobSources.publishedAt,
			status: aiJobSources.status,
			error: aiJobSources.error,
			trusted: aiJobSources.trusted,
			included: aiJobSources.included,
			chars: sql<number>`length(${aiJobSources.text})`.mapWith(Number)
		})
		.from(aiJobSources)
		.where(eq(aiJobSources.jobId, jobId))
		.orderBy(aiJobSources.id);
}

export type SourceView = Awaited<ReturnType<typeof listSources>>[number];

/** With text, for the pipeline only. */
export async function readableSources(db: Database, jobId: number) {
	return db
		.select({
			key: aiJobSources.key,
			url: aiJobSources.url,
			finalUrl: aiJobSources.finalUrl,
			title: aiJobSources.title,
			siteName: aiJobSources.siteName,
			domain: aiJobSources.domain,
			publishedAt: aiJobSources.publishedAt,
			included: aiJobSources.included,
			text: aiJobSources.text
		})
		.from(aiJobSources)
		.where(and(eq(aiJobSources.jobId, jobId), eq(aiJobSources.status, 'ok')))
		.orderBy(aiJobSources.id);
}

export async function insertSource(db: Database, values: typeof aiJobSources.$inferInsert) {
	await db.insert(aiJobSources).values(values);
}

export async function setSourcesIncluded(db: Database, jobId: number, includedKeys: string[]) {
	await db
		.update(aiJobSources)
		.set({
			included: includedKeys.length ? sql`${aiJobSources.key} IN ${includedKeys}` : sql`false`
		})
		.where(eq(aiJobSources.jobId, jobId));
}
