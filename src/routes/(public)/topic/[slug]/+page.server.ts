import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articlesInTopic, topicBySlug } from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import type { PageServerLoad } from './$types';

/**
 * A dossier, not an archive.
 *
 * PRD §8.1: this page carries an original introduction and is meant to rank on
 * its own, which is why it renders intro_html rather than a bare list.
 */
export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const locale = locals.locale;

	const topic = await topicBySlug(db, locale, params.slug);
	if (!topic) error(404, 'Not found');

	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=300' });

	const rows = await articlesInTopic(db, locale, topic.slug);
	return { topic, articles: rows.map(toCard) };
};
