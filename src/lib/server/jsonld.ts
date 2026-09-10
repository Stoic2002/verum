import type { JsonLd } from '$lib/seo';

/**
 * Structured data builders (PRD §12.3).
 *
 * Every field here has to be true of the rendered page. Marking up something
 * the reader cannot see is what Google's structured data policy calls
 * spammy — and the penalty is losing rich results across the whole site, not
 * just the page that lied.
 */

export type Publisher = { name: string; url: string; logo?: string };

export function organization(publisher: Publisher): JsonLd {
	return {
		'@type': 'Organization',
		'@id': `${publisher.url}/#organization`,
		name: publisher.name,
		url: publisher.url,
		...(publisher.logo ? { logo: { '@type': 'ImageObject', url: publisher.logo } } : {})
	};
}

/**
 * WebSite with SearchAction, so the site's own search can appear as a
 * sitelinks searchbox. The target must be a real, working URL template.
 */
export function website(publisher: Publisher, locale: string): JsonLd {
	return {
		'@type': 'WebSite',
		'@id': `${publisher.url}/#website`,
		url: publisher.url,
		name: publisher.name,
		inLanguage: locale,
		publisher: { '@id': `${publisher.url}/#organization` },
		potentialAction: {
			'@type': 'SearchAction',
			target: {
				'@type': 'EntryPoint',
				urlTemplate: `${publisher.url}/${locale}/search?q={search_term_string}`
			},
			'query-input': 'required name=search_term_string'
		}
	};
}

export function breadcrumbs(items: { name: string; url: string }[]): JsonLd {
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: item.url
		}))
	};
}

export type ArticleJsonLd = {
	headline: string;
	description: string;
	url: string;
	locale: string;
	publishedAt: string;
	modifiedAt: string | null;
	authorName: string;
	image?: string | null;
	wordCount?: number;
	section?: string;
	keywords?: string[];
};

export function article(data: ArticleJsonLd, publisher: Publisher): JsonLd {
	return {
		'@type': 'Article',
		headline: data.headline,
		description: data.description,
		inLanguage: data.locale,
		mainEntityOfPage: { '@type': 'WebPage', '@id': data.url },
		datePublished: data.publishedAt,
		// dateModified drives the "updated" signal that living articles depend on
		// (PRD §12.4); falling back to datePublished keeps it from being absent.
		dateModified: data.modifiedAt ?? data.publishedAt,
		author: { '@type': 'Person', name: data.authorName },
		publisher: { '@id': `${publisher.url}/#organization` },
		...(data.image ? { image: [data.image] } : {}),
		...(data.wordCount ? { wordCount: data.wordCount } : {}),
		...(data.section ? { articleSection: data.section } : {}),
		...(data.keywords?.length ? { keywords: data.keywords.join(', ') } : {})
	};
}

/** Wraps a set of nodes into one graph, which is one script tag instead of five. */
export function graph(nodes: JsonLd[]): string {
	return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
