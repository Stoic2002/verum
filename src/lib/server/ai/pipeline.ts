import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { createArticle, deleteArticle, slugify } from '../content/articles';
import { aiJobs, type AiClaim, type AiOutline } from '../db/schema';
import type { Database } from '../db/types';
import { finishDraft } from './citations';
import { matchesDomain, registrableDomain } from './domain';
import type { ExtractedPage } from './extract';
import {
	chatJson,
	isRetryableReply,
	ProviderError,
	type ChatUsage,
	type ModelClient,
	type ModelConfig
} from './llm';
import { claimsPrompt, draftPrompt, outlinePrompt, queriesPrompt } from './prompts';
import type { SearchClient } from './search';
import {
	addUsage,
	appendLog,
	costSince,
	getAiSettings,
	getCredentialWithKey,
	getJob,
	insertSource,
	draftsCountedSince,
	readableSources,
	transitionJob,
	type JobRow
} from './store';
import { verifyClaims } from './verify';
import type { SearchProviderKind } from '../db/schema';
import { SEARCH_PROVIDERS } from '../../ai-providers';
import { isUniqueViolation } from '../db/errors';

/**
 * The writer, stage by stage.
 *
 *   research: plan queries → search → download pages → extract claims with
 *             quotes → verify the quotes in code → outline → stop for review
 *   draft:    write from the claims the editor kept → link citations to the
 *             pages that were read → save as a draft article
 *
 * Nothing is published, and nothing is written into an article, before a
 * person has approved the outline (PRD §6.1). Dependencies are injected so the
 * whole path can be tested without a network or a provider account.
 */

export type PipelineDeps = {
	db: Database;
	createModel: (config: ModelConfig) => ModelClient;
	createSearch: (config: {
		kind: SearchProviderKind;
		apiKey: string | null;
		baseUrl: string | null;
	}) => SearchClient;
	fetchSource: (
		url: string,
		signal: AbortSignal
	) => Promise<{ page: ExtractedPage; finalUrl: string }>;
	now: () => Date;
};

/** A failure worth showing the editor as-is. */
export class PipelineError extends Error {}
export class JobCancelled extends Error {}

export const LIMITS = {
	seedUrls: 10,
	sources: 10,
	resultsPerQuery: 6,
	fetchConcurrency: 3,
	/** Below this, a page is a paywall stub or needs JavaScript to render. */
	minSourceChars: 300,
	/** Total source text sent for claim extraction, shared across sources. */
	promptSourceChars: 60_000,
	maxClaims: 25
} as const;

const QueriesSchema = v.object({
	queries: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(200))),
		v.minLength(1)
	)
});

const ClaimsSchema = v.object({
	claims: v.array(
		v.object({
			statement: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(800)),
			evidence: v.pipe(
				v.array(
					v.object({
						source: v.pipe(v.string(), v.trim(), v.maxLength(10)),
						quote: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1500))
					})
				),
				v.minLength(1)
			)
		})
	)
});

const OutlineSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(160)),
	excerpt: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(400)),
	sections: v.pipe(
		v.array(
			v.object({
				heading: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(160)),
				points: v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)))
			})
		),
		v.minLength(1)
	)
});

// ── Guard rails ─────────────────────────────────────────────────────────────

/** PRD §17: a weekly ceiling and a monthly cost alarm, enforced before any spend. */
export async function assertJobAllowed(db: Database, now: Date): Promise<void> {
	const settings = await getAiSettings(db);

	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const recent = await draftsCountedSince(db, weekAgo);
	if (recent >= settings.weeklyLimit) {
		throw new PipelineError(
			`Weekly limit reached: ${recent} drafts in the last 7 days (limit ${settings.weeklyLimit}; failed and cancelled ones do not count). ` +
				'PRD §17 caps output to protect against scaled-content penalties; the limit is in AI settings.'
		);
	}

	if (settings.monthlyBudgetUsd !== null) {
		const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const spent = await costSince(db, monthStart);
		if (spent >= settings.monthlyBudgetUsd) {
			throw new PipelineError(
				`Monthly budget reached: $${spent.toFixed(2)} of $${settings.monthlyBudgetUsd.toFixed(2)}.`
			);
		}
	}
}

// ── Shared plumbing ─────────────────────────────────────────────────────────

type Context = {
	deps: PipelineDeps;
	job: JobRow;
	model: ModelClient;
	signal: AbortSignal;
	price: { input: number; output: number };
};

function checkCancelled(signal: AbortSignal) {
	if (signal.aborted) throw new JobCancelled();
}

async function log(
	ctx: Pick<Context, 'deps' | 'job'>,
	level: 'info' | 'warn' | 'error',
	message: string
) {
	await appendLog(ctx.deps.db, ctx.job.id, level, message);
}

async function charge(ctx: Context, usage: ChatUsage) {
	const cost = (usage.inputTokens * ctx.price.input + usage.outputTokens * ctx.price.output) / 1e6;
	await addUsage(ctx.deps.db, ctx.job.id, usage, cost);
}

async function openContext(
	deps: PipelineDeps,
	jobId: number,
	signal: AbortSignal
): Promise<Context> {
	const job = await getJob(deps.db, jobId);
	if (!job) throw new PipelineError('The job no longer exists.');
	if (!job.modelCredentialId)
		throw new PipelineError('The model provider for this job was deleted.');

	const credential = await getCredentialWithKey(deps.db, job.modelCredentialId);
	if (!credential?.model) throw new PipelineError('The model provider for this job was deleted.');

	return {
		deps,
		job,
		signal,
		model: deps.createModel({
			kind: credential.kind as ModelConfig['kind'],
			apiKey: credential.apiKey,
			baseUrl: credential.baseUrl,
			model: credential.model
		}),
		price: { input: credential.inputUsdPerMtok ?? 0, output: credential.outputUsdPerMtok ?? 0 }
	};
}

function normaliseUrl(raw: string): string | null {
	try {
		const url = new URL(raw.trim());
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		url.hash = '';
		return url.href.replace(/\/$/, '');
	} catch {
		return null;
	}
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(size, items.length) }, async () => {
			while (next < items.length) await work(items[next++]);
		})
	);
}

// ── Stage 1: research ───────────────────────────────────────────────────────

export async function research(deps: PipelineDeps, jobId: number, signal: AbortSignal) {
	if (!(await transitionJob(deps.db, jobId, ['queued'], 'researching'))) return;
	const ctx = await openContext(deps, jobId, signal);
	const { db } = deps;
	const settings = await getAiSettings(db);

	await log(ctx, 'info', `Researching with ${ctx.job.modelLabel}.`);

	// Candidate URLs: the editor's first, then search.
	const candidates: { url: string; origin: 'seed' | 'search' }[] = [];
	const seen = new Set<string>();
	const add = (raw: string, origin: 'seed' | 'search') => {
		const url = normaliseUrl(raw);
		if (url && !seen.has(url)) {
			seen.add(url);
			candidates.push({ url, origin });
		}
	};
	ctx.job.seedUrls.slice(0, LIMITS.seedUrls).forEach((u) => add(u, 'seed'));

	if (ctx.job.searchCredentialId) {
		const credential = await getCredentialWithKey(db, ctx.job.searchCredentialId);
		const keyless = credential ? SEARCH_PROVIDERS[credential.kind]?.keyRequired === false : false;
		if (!credential || (!keyless && !credential.apiKey)) {
			await log(
				ctx,
				'warn',
				'The search provider was deleted or has no key; using your URLs only.'
			);
		} else {
			const search = deps.createSearch({
				kind: credential.kind as SearchProviderKind,
				apiKey: credential.apiKey,
				baseUrl: credential.baseUrl
			});
			const prompt = queriesPrompt({
				idea: ctx.job.idea,
				angle: ctx.job.angle,
				notes: ctx.job.notes,
				locale: ctx.job.locale,
				today: deps.now().toISOString().slice(0, 10)
			});
			const { data, usage } = await chatJson(
				ctx.model,
				{
					system: prompt.system,
					messages: [{ role: 'user', content: prompt.user }],
					maxTokens: 2000,
					signal
				},
				QueriesSchema
			);
			await charge(ctx, usage);

			const queries = data.queries.slice(0, 4);
			await log(ctx, 'info', `Searching: ${queries.join(' · ')}`);
			for (const query of queries) {
				checkCancelled(signal);
				try {
					const results = await search.search(query, { count: LIMITS.resultsPerQuery, signal });
					results.forEach((r) => add(r.url, 'search'));
				} catch (error) {
					if (signal.aborted) throw new JobCancelled();
					await log(ctx, 'warn', `Search failed for "${query}": ${(error as Error).message}`);
				}
			}
		}
	}

	if (candidates.length === 0) {
		throw new PipelineError('No sources to read. Add URLs, or choose a search provider.');
	}

	// Keep every seed; fill the rest of the budget with search results.
	const seeds = candidates.filter((c) => c.origin === 'seed');
	const found = candidates.filter((c) => c.origin === 'search');
	const chosen = [...seeds, ...found.slice(0, Math.max(0, LIMITS.sources - seeds.length))];

	await log(ctx, 'info', `Reading ${chosen.length} pages.`);
	const keyed = chosen.map((c, i) => ({ ...c, key: `S${i + 1}` }));

	await pool(keyed, LIMITS.fetchConcurrency, async (candidate) => {
		checkCancelled(signal);
		const host = new URL(candidate.url).hostname;
		const base = {
			jobId,
			key: candidate.key,
			origin: candidate.origin,
			url: candidate.url,
			domain: registrableDomain(host)
		};

		if (matchesDomain(host, settings.blockedDomains)) {
			await insertSource(db, {
				...base,
				status: 'blocked',
				included: false,
				error: 'Blocked in AI settings.'
			});
			return;
		}

		try {
			const { page, finalUrl } = await deps.fetchSource(candidate.url, signal);
			const finalHost = new URL(finalUrl).hostname;

			if (matchesDomain(finalHost, settings.blockedDomains)) {
				await insertSource(db, {
					...base,
					status: 'blocked',
					included: false,
					error: `Redirected to blocked ${finalHost}.`
				});
				return;
			}
			if (page.text.length < LIMITS.minSourceChars) {
				await insertSource(db, {
					...base,
					finalUrl,
					title: page.title,
					status: 'failed',
					included: false,
					error: 'Too little readable text (paywall, or a page that needs JavaScript).'
				});
				return;
			}

			await insertSource(db, {
				...base,
				finalUrl,
				domain: registrableDomain(finalHost),
				title: page.title.slice(0, 300),
				siteName: page.siteName.slice(0, 120),
				publishedAt: page.publishedAt,
				status: 'ok',
				trusted: matchesDomain(finalHost, settings.trustedDomains),
				text: page.text
			});
		} catch (error) {
			if (signal.aborted) throw new JobCancelled();
			await insertSource(db, {
				...base,
				status: 'failed',
				included: false,
				error: (error as Error).message.slice(0, 300)
			});
		}
	});

	const readable = await readableSources(db, jobId);
	await log(
		ctx,
		readable.length ? 'info' : 'error',
		`Read ${readable.length} of ${keyed.length} pages.`
	);
	if (readable.length === 0) throw new PipelineError('None of the pages could be read.');

	// Claims, each backed by a quote the model says it copied.
	checkCancelled(signal);
	const extractClaims = async (maxCharsPerSource: number) => {
		const prompt = claimsPrompt({
			idea: ctx.job.idea,
			angle: ctx.job.angle,
			notes: ctx.job.notes,
			locale: ctx.job.locale,
			sources: readable,
			maxCharsPerSource
		});
		const result = await chatJson(
			ctx.model,
			{
				system: prompt.system,
				messages: [{ role: 'user', content: prompt.user }],
				maxTokens: 16_000,
				signal
			},
			ClaimsSchema
		);
		await charge(ctx, result.usage);
		return result.data;
	};

	const perSource = Math.min(12_000, Math.floor(LIMITS.promptSourceChars / readable.length));
	await log(
		ctx,
		'info',
		`Extracting claims from ${plural(readable.length, 'page')}. The longest step: a few minutes is normal.`
	);

	let data: v.InferOutput<typeof ClaimsSchema>;
	try {
		data = await extractClaims(perSource);
	} catch (error) {
		// An empty, cut-off or dropped answer is most often the model running out
		// of room or time on a large input. Half the text usually fits.
		if (signal.aborted || !isRetryableReply(error)) throw error;
		const shorter = Math.floor(perSource / 2);
		await log(
			ctx,
			'warn',
			`${(error as Error).message} Trying once more with shorter excerpts (${shorter.toLocaleString('en')} characters per page).`
		);
		data = await extractClaims(shorter);
	}

	// Checked against the full page text, not the excerpt the model saw: a quote
	// found anywhere on the page is genuinely on the page.
	const claims = verifyClaims(
		data.claims.slice(0, LIMITS.maxClaims),
		readable.map((s) => ({ key: s.key, domain: s.domain, text: s.text }))
	);
	const count = (status: AiClaim['status']) => claims.filter((c) => c.status === status).length;
	await log(
		ctx,
		'info',
		`Checked ${claims.length} claims against the pages: ${count('confirmed')} confirmed by 2+ publishers, ` +
			`${count('single')} single-source, ${count('mismatch')} with numbers not in the quotes, ${count('unverified')} not found.`
	);

	await setClaims(db, jobId, claims);
	const outline = await makeOutline(ctx, claims);

	if (!(await transitionJob(db, jobId, ['researching'], 'review', { claims, outline }))) {
		throw new JobCancelled();
	}
	await log(ctx, 'info', 'Ready for your review.');
}

async function setClaims(db: Database, jobId: number, claims: AiClaim[]) {
	await db.update(aiJobs).set({ claims }).where(eq(aiJobs.id, jobId));
}

async function makeOutline(ctx: Context, claims: AiClaim[]): Promise<AiOutline | null> {
	const kept = claims.filter((c) => c.included);
	if (kept.length === 0) {
		await log(
			ctx,
			'warn',
			'No claim could be verified, so there is no outline. Check the sources below.'
		);
		return null;
	}

	checkCancelled(ctx.signal);
	await log(ctx, 'info', 'Writing the outline from the usable claims.');
	const prompt = outlinePrompt({
		idea: ctx.job.idea,
		angle: ctx.job.angle,
		notes: ctx.job.notes,
		locale: ctx.job.locale,
		claims: kept
	});
	const { data, usage } = await chatJson(
		ctx.model,
		{
			system: prompt.system,
			messages: [{ role: 'user', content: prompt.user }],
			maxTokens: 8_000,
			signal: ctx.signal
		},
		OutlineSchema
	);
	await charge(ctx, usage);
	return data;
}

/** Re-outline from the claims the editor kept, without re-reading anything. */
export async function rebuildOutline(deps: PipelineDeps, jobId: number, signal: AbortSignal) {
	const ctx = await openContext(deps, jobId, signal);
	if (ctx.job.status !== 'review')
		throw new PipelineError('Only a job under review can be re-outlined.');
	const outline = await makeOutline(ctx, ctx.job.claims);
	await deps.db.update(aiJobs).set({ outline }).where(eq(aiJobs.id, jobId));
	await log(ctx, 'info', 'Outline rebuilt from the claims you kept.');
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// ── Stage 2: draft ──────────────────────────────────────────────────────────

export async function draft(deps: PipelineDeps, jobId: number, signal: AbortSignal) {
	const ctx = await openContext(deps, jobId, signal);
	const { db } = deps;
	const { job } = ctx;
	if (job.status !== 'drafting') return;

	const claims = job.claims.filter((c) => c.included);
	if (!job.outline) throw new PipelineError('There is no outline to draft from.');
	if (claims.length === 0) throw new PipelineError('No claims are selected.');
	if (!job.categoryId) throw new PipelineError('The category for this job was deleted.');

	const cited = new Set(
		claims.flatMap((c) => c.evidence.filter((e) => e.found).map((e) => e.source))
	);
	const sources = (await readableSources(db, jobId)).filter((s) => s.included && cited.has(s.key));

	await log(ctx, 'info', `Drafting from ${claims.length} claims and ${sources.length} sources.`);
	const prompt = draftPrompt({
		idea: job.idea,
		angle: job.angle,
		notes: job.notes,
		locale: job.locale,
		outline: job.outline,
		claims,
		sources
	});
	const result = await ctx.model.chat({
		system: prompt.system,
		messages: [{ role: 'user', content: prompt.user }],
		maxTokens: 32_000,
		signal
	});
	await charge(ctx, result.usage);
	if (result.truncated) {
		await log(ctx, 'warn', 'The draft hit the model’s output limit and may end abruptly.');
	}

	const finished = finishDraft(
		result.text,
		sources.map((s) => ({ ...s, url: s.finalUrl ?? s.url })),
		job.locale,
		job.outline.title
	);
	if (finished.dropped.length) {
		await log(
			ctx,
			'warn',
			`Removed citations to sources that were never read: ${finished.dropped.join(', ')}.`
		);
	}

	checkCancelled(signal);
	const articleId = await createDraftArticle(db, {
		categoryId: job.categoryId,
		locale: job.locale,
		title: job.outline.title,
		excerpt: job.outline.excerpt,
		bodyMd: finished.markdown
	});

	// Cancelled while the article was being written: do not leave it behind.
	if (
		!(await transitionJob(db, jobId, ['drafting'], 'done', { articleId, finishedAt: deps.now() }))
	) {
		await deleteArticle(db, articleId);
		throw new JobCancelled();
	}
	await log(
		ctx,
		'info',
		`Saved as draft article #${articleId} with ${plural(finished.cited.length, 'cited source')} and ${plural(finished.editorNotes, 'editor note')} to resolve before publishing.`
	);
}

async function createDraftArticle(
	db: Database,
	input: { categoryId: number; locale: 'en' | 'id'; title: string; excerpt: string; bodyMd: string }
): Promise<number> {
	const base = slugify(input.title) || 'draft';
	for (let attempt = 1; attempt <= 20; attempt++) {
		const slug = attempt === 1 ? base : `${base.slice(0, 75)}-${attempt}`;
		try {
			return await createArticle(db, {
				categoryId: input.categoryId,
				locale: input.locale,
				content: { slug, title: input.title, excerpt: input.excerpt, bodyMd: input.bodyMd }
			});
		} catch (error) {
			if (!isUniqueViolation(error, 'article_locales_slug_idx')) throw error;
		}
	}
	throw new PipelineError('Could not find a free slug for the draft.');
}

// ── Task execution ──────────────────────────────────────────────────────────

export type Task = { jobId: number; kind: 'run' | 'outline' };

/** One task, start to finish, with every failure recorded on the job. */
export async function runTask(deps: PipelineDeps, task: Task, signal: AbortSignal) {
	try {
		if (task.kind === 'outline') {
			await rebuildOutline(deps, task.jobId, signal);
			return;
		}
		const job = await getJob(deps.db, task.jobId);
		if (job?.status === 'queued') await research(deps, task.jobId, signal);
		else if (job?.status === 'drafting') await draft(deps, task.jobId, signal);
	} catch (error) {
		if (signal.aborted || error instanceof JobCancelled) {
			await appendLog(deps.db, task.jobId, 'warn', 'Stopped: the job was cancelled.');
			return;
		}

		const known = error instanceof PipelineError || error instanceof ProviderError;
		if (!known) console.error(`[ai] job ${task.jobId} failed`, error);
		const message = known
			? (error as Error).message
			: `Unexpected error: ${(error as Error).message}`.slice(0, 500);

		await appendLog(deps.db, task.jobId, 'error', message);
		// A failed outline rebuild leaves the job reviewable; anything else ends it.
		if (task.kind === 'run') {
			await transitionJob(deps.db, task.jobId, ['queued', 'researching', 'drafting'], 'failed', {
				error: message,
				finishedAt: deps.now()
			});
		}
	}
}
