import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articlesInTopic, topicBySlug } from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import { simpleSeo } from '$lib/server/seo';
import * as urls from '$lib/urls';
import type { PageServerLoad } from './$types';

/**
 * A dossier, not an archive.
 *
 * PRD §8.1: this page carries an original introduction and is meant to rank on
 * its own, which is why it renders intro_html rather than a bare list.
 */
export const load: PageServerLoad = async ({ params, url, locals, setHeaders }) => {
	const locale = locals.locale;

	const topic = await topicBySlug(db, locale, params.slug);
	if (!topic) error(404, 'Not found');

	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=300' });

	const rows = await articlesInTopic(db, locale, topic.slug);
	// The introduction is the description: it is original prose written for
	// this page, which is the whole reason a dossier can rank (PRD §8.1).
	const plain = topic.intro_html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	const seo = simpleSeo(
		{ requestUrl: url, locale },
		{
			title: topic.title,
			description: plain,
			path: urls.topic(locale, topic.slug),
			altPath: (l) => urls.topic(l, topic.slug)
		}
	);

	return { seo, topic, articles: rows.map(toCard) };
};
