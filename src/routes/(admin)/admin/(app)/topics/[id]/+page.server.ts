import { error, fail, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getTopicForAdmin, saveTopicLocale, setTopicArticles } from '$lib/server/content/topics';
import { listArticlesForAdmin } from '$lib/server/db/queries/admin';
import { LOCALES, type Locale } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Not found');

	const topic = await getTopicForAdmin(db, id);
	if (!topic) error(404, 'Not found');

	return {
		topic,
		locales: LOCALES,
		articles: await listArticlesForAdmin(db, { status: 'published' })
	};
};

export const actions: Actions = {
	saveLocale: async ({ request, params }) => {
		const data = await request.formData();
		const locale = String(data.get('locale') ?? '') as Locale;
		const title = String(data.get('title') ?? '').trim();
		const introMd = String(data.get('introMd') ?? '');

		if (!LOCALES.includes(locale)) return fail(400, { error: 'Unknown locale' });
		if (!title) return fail(400, { error: 'A title is required.' });
		if (!introMd.trim()) {
			// PRD §8.1: the introduction is the reason this page can rank. An empty
			// one makes it an archive listing, which is what the page is not for.
			return fail(400, { error: 'An original introduction is required.' });
		}

		await saveTopicLocale(db, Number(params.id), locale, { title, introMd });
		return { saved: locale };
	},

	setArticles: async ({ request, params }) => {
		const data = await request.formData();
		const ids = data
			.getAll('articleIds')
			.map((value) => Number(value))
			.filter((value) => Number.isInteger(value));

		await setTopicArticles(db, Number(params.id), ids);
		return { saved: 'articles' };
	}
};
