import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * Paths that never carry a locale prefix: admin (single-user, PRD §8.2),
 * internal API, and the machine-readable files at the domain root (PRD §8.1).
 * Keep this in sync with UNLOCALIZED in src/hooks.server.ts.
 */
const unlocalized = (pattern: string) => ({
	pattern,
	localized: [
		['en', pattern],
		['id', pattern]
	] as [string, string][]
});

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,

			// URL only. No cookie, no Accept-Language, no IP: the requested URL is
			// the single source of truth for locale (PRD §10.4 — auto-redirecting
			// visitors keeps Googlebot from ever indexing the non-default locale).
			strategy: ['url'],

			// Every public URL carries its prefix, including the base locale:
			// /en/ai/slug and /id/ai/slug (PRD §12.1). Subdirectory, not subdomain.
			urlPatterns: [
				unlocalized('/admin/:path(.*)?'),
				unlocalized('/api/:path(.*)?'),
				unlocalized('/robots.txt'),
				unlocalized('/ads.txt'),
				unlocalized('/rss.xml'),
				unlocalized('/sitemap:path(.*)?.xml'),
				{
					pattern: '/:path(.*)?',
					localized: [
						['en', '/en/:path(.*)?'],
						['id', '/id/:path(.*)?']
					] as [string, string][]
				}
			]
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					// Integration tests talk to DATABASE_URL_TEST, which lives in .env.
					env: loadEnv('test', process.cwd(), ''),
					// Migrating and seeding a real database is slower than a unit test.
					testTimeout: 30_000,
					hookTimeout: 60_000,
					// One test database, and the integration specs truncate it. Running
					// files in parallel means one spec wipes another's fixtures mid-run.
					fileParallelism: false,
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
