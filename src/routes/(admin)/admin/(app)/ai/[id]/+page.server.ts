import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { outlineToText, parseOutlineText } from '$lib/server/ai/outline-text';
import { PipelineError, assertJobAllowed } from '$lib/server/ai/pipeline';
import { cancelJob, enqueue, isRunning, resumeJobs } from '$lib/server/ai/runner';
import {
	createJob,
	getJob,
	listSources,
	setJob,
	setSourcesIncluded,
	transitionJob
} from '$lib/server/ai/store';
import { db } from '$lib/server/db';
import { articleLocales, categories } from '$lib/server/db/schema';
import { setFlash } from '$lib/server/flash';
import type { PageServerLoad } from './$types';

function jobId(raw: string | undefined): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id < 1) error(404, 'Not found');
	return id;
}

export const load: PageServerLoad = async ({ params, depends }) => {
	depends('ai:job');
	await resumeJobs();

	const id = jobId(params.id);
	const job = await getJob(db, id);
	if (!job) error(404, 'Not found');

	const [sources, article, category] = await Promise.all([
		listSources(db, id),
		job.articleId
			? db
					.select({ title: articleLocales.title, locale: articleLocales.locale })
					.from(articleLocales)
					.where(eq(articleLocales.articleId, job.articleId))
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: null,
		job.categoryId
			? db
					.select({ slug: categories.slug })
					.from(categories)
					.where(eq(categories.id, job.categoryId))
					.then((rows) => rows[0] ?? null)
			: null
	]);

	return {
		job,
		sources,
		article: article && job.articleId ? { id: job.articleId, ...article } : null,
		category: category?.slug ?? null,
		outlineText: outlineToText(job.outline),
		running: isRunning(id)
	};
};

export const actions: Actions = {
	cancel: async ({ params }) => {
		const moved = await cancelJob(db, jobId(params.id));
		if (!moved) return fail(400, { error: 'This job has already finished.' });
		return { toast: 'Job cancelled.' };
	},

	review: async ({ params, request }) => {
		const id = jobId(params.id);
		const job = await getJob(db, id);
		if (!job) error(404, 'Not found');
		if (job.status !== 'review') return fail(400, { error: 'This job is no longer under review.' });

		const form = await request.formData();
		const intent = String(form.get('intent') ?? 'save');
		const keptClaims = new Set(form.getAll('claims').map(String));
		const keptSources = new Set(form.getAll('sources').map(String));

		// A claim can only go forward on evidence from a source that is still in.
		let dropped = 0;
		const claims = job.claims.map((claim) => {
			const wanted = keptClaims.has(claim.id);
			const supported = claim.evidence.some((e) => e.found && keptSources.has(e.source));
			if (wanted && !supported) dropped++;
			return { ...claim, included: wanted && supported };
		});

		const title = String(form.get('title') ?? '').trim();
		const excerpt = String(form.get('excerpt') ?? '').trim();
		const sections = parseOutlineText(String(form.get('outline') ?? ''));
		const hasOutline = Boolean(title || excerpt || sections.length);

		if (hasOutline && (title.length < 3 || title.length > 160)) {
			return fail(400, { error: 'The title needs 3 to 160 characters.' });
		}
		if (excerpt.length > 400) return fail(400, { error: 'Keep the excerpt under 400 characters.' });

		const outline = hasOutline ? { title, excerpt, sections } : job.outline;

		await setSourcesIncluded(db, id, [...keptSources]);
		const note = dropped ? ` ${dropped} claim(s) left out: their sources are unticked.` : '';

		if (intent === 'outline') {
			await setJob(db, id, { claims });
			enqueue(id, 'outline');
			return { toast: `Rebuilding the outline from the claims you kept.${note}` };
		}

		if (intent === 'draft') {
			if (!claims.some((c) => c.included)) {
				return fail(400, { error: `Keep at least one claim to draft from.${note}` });
			}
			if (!outline || outline.sections.length === 0) {
				return fail(400, { error: 'The outline needs at least one ## section.' });
			}
			await setJob(db, id, { claims, outline });
			if (!(await transitionJob(db, id, ['review'], 'drafting'))) {
				return fail(400, { error: 'This job is no longer under review.' });
			}
			enqueue(id);
			return { toast: `Writing the draft.${note}` };
		}

		await setJob(db, id, { claims, outline });
		return { toast: `Review saved.${note}` };
	},

	retry: async ({ params, cookies }) => {
		const job = await getJob(db, jobId(params.id));
		if (!job) error(404, 'Not found');
		if (!job.modelCredentialId || !job.categoryId) {
			return fail(400, {
				error: 'The provider or category for this job was deleted. Start a new draft.'
			});
		}

		try {
			await assertJobAllowed(db, new Date());
		} catch (err) {
			if (err instanceof PipelineError) return fail(400, { error: err.message });
			throw err;
		}

		const id = await createJob(db, {
			locale: job.locale,
			categoryId: job.categoryId,
			idea: job.idea,
			angle: job.angle,
			seedUrls: job.seedUrls,
			modelCredentialId: job.modelCredentialId,
			searchCredentialId: job.searchCredentialId,
			modelLabel: job.modelLabel
		});
		enqueue(id);
		setFlash(cookies, 'info', `Started again as #${id}.`);
		redirect(303, `/admin/ai/${id}`);
	}
};
