<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * Suggests another language version. Never redirects to it.
	 *
	 * PRD §10.4: Googlebot crawls from the US, so bouncing visitors by language
	 * or IP means the other locale is never indexed. The requested URL is
	 * always honoured; this is a suggestion the reader can ignore.
	 *
	 * It is also rendered on the client, from navigator.language, on purpose.
	 * Article pages sit behind a CDN with a long TTL (PRD §10.3) — deciding
	 * server-side from Accept-Language would bake the first visitor's language
	 * into the cached copy everyone else receives.
	 */
	let { alternates }: { alternates: { locale: string; href: string }[] } = $props();

	const current = getLocale();
	const DISMISSED = 'verum-locale-banner';

	let suggestion = $state<{ locale: string; href: string } | null>(null);

	const languageName = (locale: string) =>
		locale === 'id' ? m.language_id() : locale === 'en' ? m.language_en() : locale;

	$effect(() => {
		try {
			if (localStorage.getItem(DISMISSED) === '1') return;
		} catch {
			// Storage unavailable; show it, dismissal just will not persist.
		}

		const preferred = navigator.languages ?? [navigator.language];
		for (const tag of preferred) {
			const base = tag.toLowerCase().split('-')[0];
			if (base === current) return; // Already reading their language.

			const match = alternates.find((alternate) => alternate.locale === base);
			if (match) {
				suggestion = match;
				return;
			}
		}
	});

	function dismiss() {
		suggestion = null;
		try {
			localStorage.setItem(DISMISSED, '1');
		} catch {
			// Nothing to do; it will reappear next visit.
		}
	}
</script>

{#if suggestion}
	<aside class="banner">
		<p>{m.locale_banner({ language: languageName(suggestion.locale) })}</p>
		<a href={suggestion.href} hreflang={suggestion.locale}>{m.locale_banner_switch()}</a>
		<button type="button" onclick={dismiss}>{m.locale_banner_dismiss()}</button>
	</aside>
{/if}

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 1.5rem 0;
		padding: 0.875rem 1.125rem;
		border-radius: var(--r-lg);
		background: var(--accent-tint);
		font-size: 0.875rem;
	}
	p {
		margin: 0;
		flex: 1;
		min-width: 12rem;
	}
	.banner a {
		font-weight: var(--weight-strong);
	}
	button {
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}
	button:hover {
		color: var(--text);
	}
</style>
