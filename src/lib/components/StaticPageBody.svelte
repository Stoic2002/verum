<script lang="ts">
	import Seo from './Seo.svelte';
	import type { SeoData } from '$lib/seo';

	/**
	 * Shared body for the About, Contact, Privacy, Terms and Editorial Policy
	 * pages. They differ only in copy, so they share everything else.
	 */
	let {
		seo,
		title,
		html,
		updated
	}: { seo: SeoData; title: string; html: string; updated?: string | null } = $props();
</script>

<Seo {seo} />

<article class="page">
	<h1>{title}</h1>
	{#if updated}<p class="updated">{updated}</p>{/if}

	<!--
		Rendered and sanitised by src/lib/server/content/render.ts, from markdown
		that lives in this repository rather than in the database.
	-->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="prose">{@html html}</div>
</article>

<style>
	.page {
		max-width: var(--measure);
		margin: 0 auto;
	}
	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(1.875rem, 1.3rem + 2.4vw, 2.75rem);
		line-height: 1.1;
		letter-spacing: -0.03em;
	}
	.updated {
		margin: 0 0 2.5rem;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.prose {
		font-size: 1.0625rem;
		line-height: 1.75;
	}
	.prose :global(h2) {
		margin: 2.5rem 0 0.75rem;
		font-size: 1.375rem;
		line-height: 1.25;
		letter-spacing: -0.02em;
	}
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 1.1875rem;
	}
	.prose :global(li) {
		margin-bottom: 0.4375rem;
	}
	.prose :global(strong) {
		font-weight: var(--weight-strong);
	}
	.prose :global(code) {
		padding: 0.125rem 0.375rem;
		border-radius: var(--r-sm);
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: 0.8125em;
	}
</style>
