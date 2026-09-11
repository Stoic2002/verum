import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { modelLabel } from '$lib/ai-providers';
import { outlineToText, parseOutlineText } from '$lib/server/ai/outline-text';
import { PipelineError, assertJobAllowed } from '$lib/server/ai/pipeline';
import { cancelJob, enqueue, isRunning, resumeJobs } from '$lib/server/ai/runner';
import {
	appendLog,
	createJob,
	deleteJob,
	getJob,
	listCredentials,
	listSources,
	reopenJob,
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

/**
 * The model provider picked in a form, or the job's own when none was sent.
 * Only a provider that still exists and names a model can be chosen.
 */
async function chosenModel(form: FormData, fallback: number | null) {
	const raw = String(form.get('modelCredentialId') ?? '');
	const id = raw ? Number(raw) : fallback;
	if (!id) return null;
	const credentials = await listCredentials(db, 'model');
	return credentials.find((c) => c.id === id && c.model) ?? null;
}

export const load: PageServerLoad = async ({ params, depends }) => {
	depends('ai:job');
	await resumeJobs();

	const id = jobId(params.id);
	const job = await getJob(db, id);
	if (!job) error(404, 'Not found');

	const [sources, article, category, credentials] = await Promise.all([
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
			: null,
		listCredentials(db)
	]);

	return {
		job,
		sources,
		article: article && job.articleId ? { id: job.articleId, ...article } : null,
		category: category?.slug ?? null,
		outlineText: outlineToText(job.outline),
		running: isRunning(id),
		models: credentials
			.filter((c) => c.purpose === 'model' && c.model)
			.map((c) => ({ id: c.id, label: c.label, model: c.model })),
		searches: credentials
			.filter((c) => c.purpose === 'search')
			.map((c) => ({ id: c.id, label: c.label }))
	};
};

export const actions: Actions = {
	delete: async ({ params, cookies }) => {
		const id = jobId(params.id);
		if (!(await deleteJob(db, id))) {
			return fail(400, {
				error: 'A draft that is still running cannot be deleted. Cancel it first.'
			});
		}
		setFlash(cookies, 'success', `Draft #${id} deleted.`);
		redirect(303, '/admin/ai');
	},

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

		// Notes can be sharpened after reading the research: the outline rebuild
		// and the draft read the job afresh, so they follow the latest version.
		if (form.has('notes')) {
			const notes = String(form.get('notes') ?? '').trim();
			if (notes.length > 2000)
				return fail(400, { error: 'Keep the notes under 2,000 characters.' });
			if (notes !== job.notes) await setJob(db, id, { notes });
		}

		// The model can change at review: the outline and the draft run on it.
		let modelNote = '';
		const picked = String(form.get('modelCredentialId') ?? '');
		if (picked && Number(picked) !== job.modelCredentialId) {
			const model = await chosenModel(form, null);
			if (!model) return fail(400, { error: 'That model provider no longer exists.' });
			const label = modelLabel(model);
			await setJob(db, id, { modelCredentialId: model.id, modelLabel: label });
			await appendLog(db, id, 'info', `Model changed to ${label}.`);
			modelNote = ` Using ${label}.`;
		}

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
		const note =
			(dropped ? ` ${dropped} claim(s) left out: their sources are unticked.` : '') + modelNote;

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

	/** Back to review on the same job, with the research kept and, optionally, another model. */
	reopen: async ({ params, request }) => {
		const id = jobId(params.id);
		const job = await getJob(db, id);
		if (!job) error(404, 'Not found');
		if (isRunning(id)) {
			return fail(400, { error: 'This job is still stopping. Try again in a moment.' });
		}

		const model = await chosenModel(await request.formData(), job.modelCredentialId);
		if (!model) return fail(400, { error: 'Choose a model provider.' });

		const label = modelLabel(model);
		const reopened = await reopenJob(db, id, { modelCredentialId: model.id, modelLabel: label });
		if (!reopened) {
			return fail(400, {
				error: 'Only a draft whose research finished can go back to review. Start again instead.'
			});
		}

		await appendLog(db, id, 'info', `Reopened for review with ${label}.`);
		return { toast: `Back to review with ${label}. Check the outline, then write the draft.` };
	},

	/** A new job with the same brief — new research — on the model and search chosen now. */
	retry: async ({ params, request, cookies }) => {
		const job = await getJob(db, jobId(params.id));
		if (!job) error(404, 'Not found');
		if (!job.categoryId) {
			return fail(400, { error: 'The category for this job was deleted. Start a new draft.' });
		}

		const form = await request.formData();
		const model = await chosenModel(form, job.modelCredentialId);
		if (!model) return fail(400, { error: 'Choose a model provider.' });

		let searchCredentialId = job.searchCredentialId;
		if (form.has('searchCredentialId')) {
			const raw = String(form.get('searchCredentialId') ?? '');
			searchCredentialId = raw ? Number(raw) : null;
			if (searchCredentialId !== null) {
				const searches = await listCredentials(db, 'search');
				if (!searches.some((c) => c.id === searchCredentialId)) {
					return fail(400, { error: 'That search provider no longer exists.' });
				}
			}
		}
		if (searchCredentialId === null && job.seedUrls.length === 0) {
			return fail(400, {
				error: 'This draft had no URLs of its own, so it needs a search provider.'
			});
		}

		try {
			await assertJobAllowed(db, new Date());
		} catch (err) {
			if (err instanceof PipelineError) return fail(400, { error: err.message });
			throw err;
		}

		const label = modelLabel(model);
		const id = await createJob(db, {
			locale: job.locale,
			categoryId: job.categoryId,
			idea: job.idea,
			angle: job.angle,
			notes: job.notes,
			seedUrls: job.seedUrls,
			modelCredentialId: model.id,
			searchCredentialId,
			modelLabel: label
		});
		enqueue(id);
		setFlash(cookies, 'info', `Started again as #${id} with ${label}.`);
		redirect(303, `/admin/ai/${id}`);
	}
};
