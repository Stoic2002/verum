<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * EN / ID. Remembers the choice in a cookie, which is what the bare domain
	 * reads next time (hooks.server.ts, rootLocale).
	 *
	 * An article is not guaranteed to exist in both languages (PRD §7), so on an
	 * article page the link goes to the published alternate, or to that
	 * language's homepage when there is none — never to a 404. Every other page
	 * exists in both, so the prefix is simply swapped.
	 */
	const LOCALES = ['en', 'id'] as const;
	const current = getLocale();

	function hrefFor(locale: string): string {
		if (locale === current) return page.url.pathname;

		const alternates = page.data.alternates as { locale: string; href: string }[] | undefined;
		if (page.route.id === '/(public)/[category]/[slug]') {
			return alternates?.find((alternate) => alternate.locale === locale)?.href ?? `/${locale}`;
		}
		return page.url.pathname.replace(/^\/(en|id)(?=\/|$)/, `/${locale}`) + page.url.search;
	}

	function remember(locale: string) {
		document.cookie = `verum-locale=${locale}; path=/; max-age=31536000; samesite=lax; secure`;
	}
</script>

<nav class="language" aria-label={m.language_switch()}>
	{#each LOCALES as locale (locale)}
		<a
			href={hrefFor(locale)}
			hreflang={locale}
			lang={locale}
			aria-current={locale === current ? 'true' : undefined}
			title={locale === 'id' ? m.language_id() : m.language_en()}
			data-sveltekit-reload
			onclick={() => remember(locale)}>{locale.toUpperCase()}</a
		>
	{/each}
</nav>

<style>
	.language {
		display: inline-flex;
		gap: 0.125rem;
		padding: 0.1875rem;
		border-radius: var(--r-pill);
		background: var(--surface-2);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	a {
		padding: 0.1875rem 0.5rem;
		border-radius: var(--r-pill);
		color: var(--text-3);
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		letter-spacing: 0.06em;
		text-decoration: none;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	a:hover {
		color: var(--text);
	}
	a[aria-current='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
