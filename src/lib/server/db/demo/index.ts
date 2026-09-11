/**
 * Builds a full demo dataset: images, long articles, tags, a topic.
 *
 * Run with `bun run db:demo`. It exists so the site can be judged as a whole —
 * a real article with a cover image, embeds, an ad slot in the middle of the
 * prose, related articles underneath — rather than as a set of features.
 *
 * Destructive by design: it wipes content first, so repeated runs give the same
 * result. It refuses any database that is not local.
 */
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import {
	articleLocales,
	articleTags,
	articles,
	categories,
	categoryLocales,
	tags,
	topicArticles,
	topicLocales,
	topics,
	type Locale
} from '../schema';
import { truncateAll } from '../testing';
import { uploadImage } from '../../media';
import { renderMarkdown, referencedMediaIds } from '../../content/render';
import { getMediaByIds, getStorage } from '../../media';
import { hashPassword } from '../../auth/password';
import { adminUsers } from '../schema';
import { demoImage } from './images';
import { DRAKOR_ID, LONG_EN, LONG_ID, MEDIUM_EN } from './articles';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
	throw new Error('db:demo refuses to run against a non-local database — it deletes all content.');
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

/** Renders through the real pipeline, so demo articles are indistinguishable. */
async function render(markdown: string) {
	return renderMarkdown(markdown, {
		media: await getMediaByIds(db, referencedMediaIds(markdown)),
		mediaUrl: (key) => getStorage().url(key)
	});
}

type Draft = {
	category: string;
	status: 'published' | 'scheduled' | 'draft';
	isLiving: boolean;
	publishedAt: Date;
	coverIndex: number | null;
	tags: string[];
	locales: Partial<
		Record<
			Locale,
			{ slug: string; title: string; excerpt: string; body: (imageId: number) => string }
		>
	>;
};

const SHORT_EN = (
	topic: string
) => `${topic} keeps coming up in the same three conversations, and the answers are usually wrong in the same three ways. This is the short version of what actually holds up.

## The claim

The pitch is that it removes a whole class of work. It removes some of it, and adds a review step that nobody budgets for.

## What held up

Two of the four benchmarks reproduced. The other two depended on a cache that was warm in the original run and cold in mine, which is most of the difference.

## What to do with that

Use it where being wrong is cheap and obvious. Do not use it where being wrong is silent.`;

const DRAFTS: Draft[] = [
	{
		category: 'ai',
		status: 'published',
		isLiving: true,
		publishedAt: ago(2),
		coverIndex: 0,
		tags: ['llm', 'coding-tools', 'benchmarks'],
		locales: {
			en: {
				slug: 'six-ai-assistants-one-legacy-refactor',
				title: 'Six AI assistants, one legacy refactor',
				excerpt:
					'The same twenty-year-old Java service, the same brief, six tools. Timings, corrections, and the one failure that mattered.',
				body: LONG_EN
			},
			id: {
				slug: 'enam-asisten-ai-satu-refactor-warisan',
				title: 'Enam asisten AI, satu refactor kode warisan',
				excerpt:
					'Service Java berumur dua puluh tahun yang sama, tugas yang sama, enam tool. Waktu, koreksi, dan satu kegagalan yang penting.',
				body: LONG_ID
			}
		}
	},
	{
		category: 'tech',
		status: 'published',
		isLiving: false,
		publishedAt: ago(6),
		coverIndex: 1,
		tags: ['postgres', 'search'],
		locales: {
			en: {
				slug: 'postgres-full-text-search-for-small-sites',
				title: 'Postgres full-text search for small sites',
				excerpt: 'Ranking, highlighting and stemming without running a second service.',
				body: MEDIUM_EN
			}
		}
	},
	{
		category: 'ai',
		status: 'published',
		isLiving: false,
		publishedAt: ago(11),
		coverIndex: 2,
		tags: ['llm', 'prompting'],
		locales: {
			en: {
				slug: 'prompt-caching-what-it-costs',
				title: 'Prompt caching, and what it actually costs',
				excerpt: 'Latency, price, and the invalidation nobody mentions.',
				body: () => SHORT_EN('Prompt caching')
			}
		}
	},
	{
		category: 'tech',
		status: 'published',
		isLiving: false,
		publishedAt: ago(18),
		coverIndex: 3,
		tags: ['postgres', 'benchmarks'],
		locales: {
			en: {
				slug: 'sqlite-or-postgres-for-a-side-project',
				title: 'SQLite or Postgres for a side project',
				excerpt: 'The tradeoffs, with the numbers that decided it here.',
				body: () => SHORT_EN('Choosing SQLite over Postgres')
			}
		}
	},
	{
		category: 'ai',
		status: 'published',
		isLiving: false,
		publishedAt: ago(25),
		coverIndex: 4,
		tags: ['llm', 'agents'],
		locales: {
			en: {
				slug: 'agents-that-know-when-to-stop',
				title: 'Agents that know when to stop',
				excerpt: 'The difference between a useful tool and an expensive one.',
				body: () => SHORT_EN('Autonomous agents')
			}
		}
	},
	{
		category: 'tech',
		status: 'published',
		isLiving: false,
		publishedAt: ago(33),
		coverIndex: 5,
		tags: ['tooling'],
		locales: {
			en: {
				slug: 'the-build-step-you-can-delete',
				title: 'The build step you can probably delete',
				excerpt: 'Four common ones, and how long each actually saves.',
				body: () => SHORT_EN('Build tooling')
			}
		}
	},
	{
		category: 'arts',
		status: 'published',
		isLiving: true,
		publishedAt: ago(4),
		coverIndex: 4,
		tags: ['drama', 'listicle'],
		locales: {
			id: {
				slug: 'lima-drama-korea-yang-bertahan-sampai-akhir',
				title: 'Lima drama Korea yang bertahan sampai episode terakhir',
				excerpt:
					'Disusun dengan kriteria yang ditulis lebih dulu — konsistensi paruh kedua, penulisan, akhir yang tuntas, dan bisa ditonton tanpa konteks.',
				body: DRAKOR_ID
			}
		}
	},
	{
		category: 'games',
		status: 'published',
		isLiving: false,
		publishedAt: ago(9),
		coverIndex: 5,
		tags: ['listicle'],
		locales: {
			en: {
				slug: 'the-settings-menu-tells-you-everything',
				title: 'The settings menu tells you everything',
				excerpt: "What a game's options screen reveals about how it was built.",
				body: () => SHORT_EN('Game settings menus')
			}
		}
	},
	{
		category: 'ai',
		status: 'scheduled',
		isLiving: false,
		publishedAt: ahead(3),
		coverIndex: 0,
		tags: ['llm'],
		locales: {
			en: {
				slug: 'scheduled-not-yet-visible',
				title: 'Scheduled: this must not appear on the site yet',
				excerpt: 'Proof that publication is query-driven.',
				body: () => SHORT_EN('Scheduling')
			}
		}
	},
	{
		category: 'tech',
		status: 'draft',
		isLiving: false,
		publishedAt: ago(1),
		coverIndex: null,
		tags: [],
		locales: {
			en: {
				slug: 'draft-in-progress',
				title: 'Draft: still being written',
				excerpt: 'Visible in the admin, nowhere else.',
				body: () => SHORT_EN('Drafting')
			}
		}
	}
];

/**
 * `active` is what decides whether a category appears in the navigation and
 * the sitemap. PRD §5.3 closes politics permanently in v1 — YMYL categories
 * are held to a much stricter standard by Google, carry low CPC, and are the
 * worst place for an AI-assisted draft to be wrong — and §9 opens games and
 * reviews one at a time once traffic is proven.
 *
 * They are seeded here because they were asked for, and left switchable so
 * turning one back off is a checkbox rather than a migration.
 */
const CATEGORIES = [
	{
		slug: 'ai',
		sortOrder: 1,
		en: {
			name: 'AI',
			description:
				'Models, tools, agents and the workflows built on them — tested on real work rather than summarised from a launch post.'
		},
		id: {
			name: 'AI',
			description:
				'Model, tool, agent, dan alur kerja di sekitarnya — diuji pada pekerjaan nyata, bukan dirangkum dari siaran pers.'
		}
	},
	{
		slug: 'tech',
		sortOrder: 2,
		en: {
			name: 'Tech',
			description:
				'Developer tooling, databases and infrastructure, with the numbers that decided each call.'
		},
		id: {
			name: 'Teknologi',
			description:
				'Perkakas developer, basis data, dan infrastruktur, lengkap dengan angka yang menentukan tiap keputusan.'
		}
	},
	{
		slug: 'games',
		sortOrder: 3,
		active: true,
		en: {
			name: 'Games',
			description: 'Games and the technology behind them, played through rather than previewed.'
		},
		id: {
			name: 'Games',
			description:
				'Game dan teknologi di baliknya, dimainkan sampai selesai, bukan sekadar dilihat trailernya.'
		}
	},
	{
		slug: 'arts',
		sortOrder: 4,
		active: true,
		en: {
			name: 'Arts',
			description: 'Music, film and drama, with the criteria for every judgement stated up front.'
		},
		id: {
			name: 'Seni',
			description: 'Musik, film, dan drama, dengan kriteria penilaian yang dinyatakan lebih dulu.'
		}
	},
	{
		slug: 'politics',
		sortOrder: 5,
		// Seeded but switched off. PRD §5.3 closes this permanently in v1; the
		// row exists so the decision can be revisited without a migration.
		active: false,
		en: {
			name: 'Politics',
			description: 'Closed in v1. See the editorial policy for why.'
		},
		id: {
			name: 'Politik',
			description: 'Ditutup di v1. Alasannya ada di kebijakan editorial.'
		}
	}
];

const TAGS = [
	{ slug: 'llm', name: 'LLM' },
	{ slug: 'coding-tools', name: 'Coding tools' },
	{ slug: 'benchmarks', name: 'Benchmarks' },
	{ slug: 'postgres', name: 'PostgreSQL' },
	{ slug: 'search', name: 'Search' },
	{ slug: 'prompting', name: 'Prompting' },
	{ slug: 'agents', name: 'Agents' },
	{ slug: 'tooling', name: 'Tooling' },
	{ slug: 'drama', name: 'Drama' },
	{ slug: 'listicle', name: 'Listicle' }
];

async function main() {
	console.log('Clearing content…');
	// Provider keys survive a demo reload; see truncateAll.
	await truncateAll(db, { keepAiProviders: true });

	await db.insert(adminUsers).values([
		{
			email: process.env.SEED_ADMIN_EMAIL ?? 'admin@verum.local',
			username: 'admin',
			passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? 'verum-dev-password')
		},
		{
			// A second local account, for checking that sign-in accepts either
			// identifier. `password123` is fine for a laptop and nowhere else.
			email: 'test@gmail.com',
			username: 'test',
			passwordHash: await hashPassword('password123')
		}
	]);

	const categoryRows = await db
		.insert(categories)
		.values(
			CATEGORIES.map((c) => ({
				slug: c.slug,
				sortOrder: c.sortOrder,
				isActive: c.active ?? true
			}))
		)
		.returning({ id: categories.id, slug: categories.slug });
	const categoryId = new Map(categoryRows.map((r) => [r.slug, r.id]));

	await db.insert(categoryLocales).values(
		CATEGORIES.flatMap((c) => [
			{ categoryId: categoryId.get(c.slug)!, locale: 'en' as const, ...c.en },
			{ categoryId: categoryId.get(c.slug)!, locale: 'id' as const, ...c.id }
		])
	);

	const tagRows = await db.insert(tags).values(TAGS).returning({ id: tags.id, slug: tags.slug });
	const tagId = new Map(tagRows.map((r) => [r.slug, r.id]));

	console.log('Generating images (this is the slow part — AVIF encoding)…');
	const mediaIds: number[] = [];
	for (let i = 0; i < 6; i++) {
		const record = await uploadImage(
			db,
			{ buffer: await demoImage(i), name: `demo-${i}.png` },
			{
				alt: `An abstract gradient standing in for a photograph, variant ${i + 1}`,
				credit: 'Generated for the demo dataset'
			}
		);
		mediaIds.push(record.id);
		process.stdout.write(`  ${i + 1}/6\r`);
	}
	console.log('  6/6 images ready');

	console.log('Writing articles…');
	for (const draft of DRAFTS) {
		const [article] = await db
			.insert(articles)
			.values({
				categoryId: categoryId.get(draft.category)!,
				status: draft.status,
				isLiving: draft.isLiving,
				coverMediaId: draft.coverIndex === null ? null : mediaIds[draft.coverIndex]
			})
			.returning({ id: articles.id });

		for (const [locale, content] of Object.entries(draft.locales)) {
			// The inline image is a different one from the cover, so an article
			// shows both a lede image and a figure inside the prose.
			const inline = mediaIds[((draft.coverIndex ?? 0) + 2) % mediaIds.length];
			const markdown = content.body(inline);
			const rendered = await render(markdown);

			await db.insert(articleLocales).values({
				articleId: article.id,
				locale: locale as Locale,
				slug: content.slug,
				title: content.title,
				excerpt: content.excerpt,
				bodyMd: markdown,
				bodyHtml: rendered.html,
				bodyText: rendered.text,
				toc: rendered.toc,
				wordCount: rendered.wordCount,
				readingMinutes: rendered.readingMinutes,
				publishedAt: draft.status === 'draft' ? null : draft.publishedAt,
				modifiedAt: draft.status === 'draft' ? null : draft.publishedAt,
				correction:
					content.slug === 'six-ai-assistants-one-legacy-refactor'
						? 'An earlier version reported Tool C at 52 minutes. That was the second run; the figure above is the first, which is what the method describes. Corrected 8 September 2026.'
						: null
			});
		}

		if (draft.tags.length) {
			await db
				.insert(articleTags)
				.values(draft.tags.map((slug) => ({ articleId: article.id, tagId: tagId.get(slug)! })));
		}
	}

	console.log('Building the topic page…');
	const [topic] = await db
		.insert(topics)
		.values({ slug: 'ai-tooling' })
		.returning({ id: topics.id });

	const intros = {
		en: {
			title: 'AI coding tools',
			md: 'Everything published here about the assistants developers actually reach for, in the order it makes sense to read it.\n\nThe short version: they are faster than a person at narrow, well-fenced work, and slower once the review has to be careful. What follows is the evidence for that.'
		},
		id: {
			title: 'Tool coding AI',
			md: 'Semua tulisan di sini tentang asisten yang benar-benar dipakai developer, dalam urutan yang masuk akal untuk dibaca.\n\nRingkasnya: mereka lebih cepat daripada manusia untuk pekerjaan sempit dan berpagar jelas, dan lebih lambat begitu reviewnya harus cermat. Berikut buktinya.'
		}
	};

	for (const [locale, intro] of Object.entries(intros)) {
		const rendered = await render(intro.md);
		await db.insert(topicLocales).values({
			topicId: topic.id,
			locale: locale as Locale,
			title: intro.title,
			introMd: intro.md,
			introHtml: rendered.html
		});
	}

	const aiArticles = await db
		.select({ id: articles.id })
		.from(articles)
		.where(eq(articles.categoryId, categoryId.get('ai')!));

	await db
		.insert(topicArticles)
		.values(
			aiArticles.map((row, index) => ({ topicId: topic.id, articleId: row.id, sortOrder: index }))
		);

	const [counts] = await db.execute<{ articles: number; images: number }>(sql`
		SELECT
			(SELECT count(*)::int FROM article_locales) AS articles,
			(SELECT count(*)::int FROM media) AS images
	`);

	console.log(
		`\nDemo content ready: ${counts.articles} article versions, ${counts.images} images.`
	);
	console.log('  Public:  http://localhost:5173/en');
	console.log('  Admin:   http://localhost:5173/admin');
	console.log('    admin  ·  admin@verum.local  ·  verum-dev-password');
	console.log('    test   ·  test@gmail.com     ·  password123');
}

await main();
await client.end();
