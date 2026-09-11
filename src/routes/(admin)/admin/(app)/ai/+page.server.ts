import { fail, redirect, type Actions } from '@sveltejs/kit';
import { MODEL_PROVIDERS } from '$lib/ai-providers';
import { LIMITS, PipelineError, assertJobAllowed } from '$lib/server/ai/pipeline';
import { enqueue, resumeJobs } from '$lib/server/ai/runner';
import { secretsAvailable } from '$lib/server/ai/secrets';
import {
	costSince,
	createJob,
	getAiSettings,
	jobsCreatedSince,
	listCredentials,
	listJobs
} from '$lib/server/ai/store';
import { db } from '$lib/server/db';
import { categoryOptions } from '$lib/server/db/queries/admin';
import { LOCALES, type Locale } from '$lib/server/db/schema';
import { setFlash } from '$lib/server/flash';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
	await resumeJobs();

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
	const now = Date.now();
	const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
	const monthStart = new Date(
		Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)
	);

	const [jobs, credentials, settings, categories, thisWeek, monthCost] = await Promise.all([
		listJobs(db, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
		listCredentials(db),
		getAiSettings(db),
		categoryOptions(db, 'en'),
		jobsCreatedSince(db, weekAgo),
		costSince(db, monthStart)
	]);

	return {
		jobs: jobs.items,
		total: jobs.total,
		page,
		pages: Math.max(1, Math.ceil(jobs.total / PAGE_SIZE)),
		models: credentials.filter((c) => c.purpose === 'model'),
		searches: credentials.filter((c) => c.purpose === 'search'),
		categories,
		locales: LOCALES,
		seedLimit: LIMITS.seedUrls,
		secretsReady: secretsAvailable(),
		usage: {
			thisWeek,
			weeklyLimit: settings.weeklyLimit,
			monthCost,
			monthlyBudgetUsd: settings.monthlyBudgetUsd
		}
	};
};

function parseUrls(raw: string): { urls: string[]; invalid: string[] } {
	const urls: string[] = [];
	const invalid: string[] = [];
	for (const line of raw.split(/\s+/)) {
		const value = line.trim();
		if (!value) continue;
		try {
			const url = new URL(value);
			if (url.protocol === 'http:' || url.protocol === 'https:') urls.push(url.href);
			else invalid.push(value);
		} catch {
			invalid.push(value);
		}
	}
	return { urls: [...new Set(urls)], invalid };
}

export const actions: Actions = {
	create: async ({ request, cookies }) => {
		const form = await request.formData();
		const text = (name: string) => String(form.get(name) ?? '').trim();

		const idea = text('idea');
		const angle = text('angle');
		const locale = text('locale') as Locale;
		const categoryId = Number(text('categoryId'));
		const modelCredentialId = Number(text('modelCredentialId'));
		const searchCredentialId = text('searchCredentialId')
			? Number(text('searchCredentialId'))
			: null;
		const { urls, invalid } = parseUrls(text('seedUrls'));

		if (idea.length < 3) return fail(400, { error: 'Describe the idea in a few words.' });
		if (idea.length > 500 || angle.length > 500) {
			return fail(400, { error: 'Keep the idea and the angle under 500 characters each.' });
		}
		if (!LOCALES.includes(locale)) return fail(400, { error: 'Choose a language.' });
		if (!Number.isInteger(categoryId) || categoryId < 1) {
			return fail(400, { error: 'Choose a category.' });
		}
		if (invalid.length) {
			return fail(400, { error: `Not a web address: ${invalid.slice(0, 3).join(', ')}` });
		}
		if (urls.length > LIMITS.seedUrls) {
			return fail(400, { error: `At most ${LIMITS.seedUrls} URLs per draft.` });
		}

		const credentials = await listCredentials(db);
		const model = credentials.find((c) => c.id === modelCredentialId && c.purpose === 'model');
		if (!model?.model) return fail(400, { error: 'Choose a model provider.' });

		const search =
			searchCredentialId === null
				? null
				: credentials.find((c) => c.id === searchCredentialId && c.purpose === 'search');
		if (searchCredentialId !== null && !search) {
			return fail(400, { error: 'That search provider no longer exists.' });
		}
		if (!search && urls.length === 0) {
			return fail(400, { error: 'Add at least one URL, or choose a search provider.' });
		}

		try {
			await assertJobAllowed(db, new Date());
		} catch (error) {
			if (error instanceof PipelineError) return fail(400, { error: error.message });
			throw error;
		}

		const provider = MODEL_PROVIDERS[model.kind as keyof typeof MODEL_PROVIDERS];
		const id = await createJob(db, {
			locale,
			categoryId,
			idea,
			angle,
			seedUrls: urls,
			modelCredentialId: model.id,
			searchCredentialId: search?.id ?? null,
			modelLabel: `${provider?.label ?? model.kind} · ${model.model}`
		});
		enqueue(id);

		setFlash(cookies, 'info', 'Research started. This page follows it as it runs.');
		redirect(303, `/admin/ai/${id}`);
	}
};
