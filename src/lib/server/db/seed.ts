/**
 * Development seed. Idempotent: safe to run repeatedly.
 *
 * Run with `bun run db:seed`. Refuses to touch a database whose URL does not
 * look local unless SEED_FORCE=1 is set.
 */
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import {
	adminUsers,
	articleLocales,
	articleTags,
	articles,
	categories,
	categoryLocales,
	tags,
	type Locale
} from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
if (!isLocal && process.env.SEED_FORCE !== '1') {
	throw new Error(`Refusing to seed a non-local database. Set SEED_FORCE=1 to override.\n  ${url}`);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

type LocaleContent = {
	slug: string;
	title: string;
	excerpt: string;
	bodyMd: string;
	bodyText: string;
};

/**
 * Three articles covering the three shapes the schema has to survive:
 * bilingual, English-only (the asymmetric case from PRD §7), and scheduled.
 */
const FIXTURES: Array<{
	category: 'ai' | 'tech';
	status: 'published' | 'scheduled';
	isLiving: boolean;
	publishedAt: Date;
	tags: string[];
	locales: Partial<Record<Locale, LocaleContent>>;
}> = [
	{
		category: 'ai',
		status: 'published',
		isLiving: true,
		publishedAt: ago(20),
		tags: ['llm', 'coding-tools'],
		locales: {
			en: {
				slug: 'best-ai-coding-tools',
				title: 'Best AI coding tools, compared on real work',
				excerpt: 'Six assistants run against the same refactor, with timings.',
				bodyMd:
					'## How this was tested\n\nEach tool was given the same refactor in the same repository.\n\n## Results\n\nMeasured wall-clock time and the number of corrections needed.',
				bodyText:
					'How this was tested. Each tool was given the same refactor in the same repository. Results. Measured wall-clock time and the number of corrections needed.'
			},
			id: {
				slug: 'tool-coding-ai-terbaik',
				title: 'Membandingkan tool coding AI untuk pekerjaan nyata',
				excerpt: 'Enam asisten diuji pada refactor yang sama, lengkap dengan waktunya.',
				bodyMd:
					'## Cara pengujian\n\nSetiap tool diberi tugas refactor yang sama di repositori yang sama.\n\n## Hasil\n\nYang diukur adalah waktu pengerjaan dan jumlah koreksi yang dibutuhkan.',
				bodyText:
					'Cara pengujian. Setiap tool diberi tugas refactor yang sama di repositori yang sama. Hasil. Yang diukur adalah waktu pengerjaan dan jumlah koreksi yang dibutuhkan.'
			}
		}
	},
	{
		category: 'tech',
		status: 'published',
		isLiving: false,
		publishedAt: ago(5),
		tags: ['postgres'],
		locales: {
			// English only, on purpose: parity between locales is not required.
			en: {
				slug: 'postgres-full-text-search-for-small-sites',
				title: 'Postgres full-text search is enough for a small site',
				excerpt: 'Ranking, highlighting and stemming without adding a search service.',
				bodyMd:
					'## Why not Elasticsearch\n\nA second service to operate, for a corpus of a few hundred documents.\n\n## Ranking\n\nts_rank_cd weighs term proximity, which matters once bodies are indexed.',
				bodyText:
					'Why not Elasticsearch. A second service to operate, for a corpus of a few hundred documents. Ranking. ts_rank_cd weighs term proximity, which matters once bodies are indexed.'
			}
		}
	},
	{
		category: 'ai',
		status: 'scheduled',
		isLiving: false,
		publishedAt: ahead(3),
		tags: ['llm'],
		locales: {
			en: {
				slug: 'scheduled-article-not-yet-live',
				title: 'This article is scheduled and must not appear yet',
				excerpt: 'Publication is query-driven; this row proves the gate holds.',
				bodyMd: 'Scheduled for a future date.',
				bodyText: 'Scheduled for a future date.'
			}
		}
	}
];

async function seed() {
	// Categories active at launch (PRD §5.3). games/esports/reviews stay closed.
	const categoryRows = await db
		.insert(categories)
		.values([
			{ slug: 'ai', sortOrder: 1 },
			{ slug: 'tech', sortOrder: 2 }
		])
		.onConflictDoNothing()
		.returning({ id: categories.id, slug: categories.slug });

	const allCategories = categoryRows.length
		? categoryRows
		: await db.select({ id: categories.id, slug: categories.slug }).from(categories);
	const categoryId = new Map(allCategories.map((c) => [c.slug, c.id]));

	await db
		.insert(categoryLocales)
		.values([
			{
				categoryId: categoryId.get('ai')!,
				locale: 'en',
				name: 'AI',
				description: 'Models, tools, agents and the workflows built on them, tested in real use.'
			},
			{
				categoryId: categoryId.get('ai')!,
				locale: 'id',
				name: 'AI',
				description:
					'Model, tool, agent, dan alur kerja di sekitarnya — diuji dalam pemakaian nyata.'
			},
			{
				categoryId: categoryId.get('tech')!,
				locale: 'en',
				name: 'Tech',
				description: 'Developer tooling, infrastructure and the software worth your attention.'
			},
			{
				categoryId: categoryId.get('tech')!,
				locale: 'id',
				name: 'Teknologi',
				description: 'Perkakas developer, infrastruktur, dan software yang layak diperhatikan.'
			}
		])
		.onConflictDoNothing();

	const tagRows = await db
		.insert(tags)
		.values([
			{ slug: 'llm', name: 'LLM' },
			{ slug: 'coding-tools', name: 'Coding tools' },
			{ slug: 'postgres', name: 'PostgreSQL' }
		])
		.onConflictDoNothing()
		.returning({ id: tags.id, slug: tags.slug });

	const allTags = tagRows.length
		? tagRows
		: await db.select({ id: tags.id, slug: tags.slug }).from(tags);
	const tagId = new Map(allTags.map((t) => [t.slug, t.id]));

	const password = process.env.SEED_ADMIN_PASSWORD ?? 'verum-dev-password';
	await db
		.insert(adminUsers)
		.values({
			email: process.env.SEED_ADMIN_EMAIL ?? 'admin@verum.local',
			passwordHash: await hash(password)
		})
		.onConflictDoNothing();

	for (const fixture of FIXTURES) {
		// Idempotency is keyed on the English slug: without this, a second run
		// inserts fresh `articles` rows whose locale rows are then skipped by the
		// unique index, leaving articles with no content attached.
		const anchor = fixture.locales.en!.slug;
		const [existing] = await db
			.select({ articleId: articleLocales.articleId })
			.from(articleLocales)
			.where(eq(articleLocales.slug, anchor))
			.limit(1);
		if (existing) continue;

		const [article] = await db
			.insert(articles)
			.values({
				categoryId: categoryId.get(fixture.category)!,
				status: fixture.status,
				isLiving: fixture.isLiving
			})
			.returning({ id: articles.id });

		for (const [locale, content] of Object.entries(fixture.locales)) {
			await db
				.insert(articleLocales)
				.values({
					articleId: article.id,
					locale: locale as Locale,
					...content,
					publishedAt: fixture.publishedAt,
					modifiedAt: fixture.publishedAt
				})
				.onConflictDoNothing();
		}

		await db
			.insert(articleTags)
			.values(fixture.tags.map((slug) => ({ articleId: article.id, tagId: tagId.get(slug)! })))
			.onConflictDoNothing();
	}

	const [{ count }] = await db
		.select({ count: articles.id })
		.from(articles)
		.then((rows) => [{ count: rows.length }]);

	console.log(`Seeded: 2 categories, 3 tags, 1 admin user, ${count} articles`);
	console.log(`Admin login: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@verum.local'} / ${password}`);
}

await seed();
await client.end();
