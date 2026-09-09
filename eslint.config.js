import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		/*
		 * Public pages and shared components build their hrefs with $lib/urls.
		 *
		 * Those paths carry a locale prefix that the route tree does not contain,
		 * because src/hooks.ts delocalises the URL before SvelteKit matches it —
		 * so `/en/ai/slug` is a real page while `resolve()` has no route id for
		 * it. The shapes are covered by src/lib/urls.spec.ts and by the e2e suite
		 * instead.
		 *
		 * Admin routes keep the rule: their paths are in the route tree, so a
		 * typo there should still be a build error.
		 */
		files: ['src/routes/(public)/**/*.svelte', 'src/lib/components/**/*.svelte'],
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	}
);
