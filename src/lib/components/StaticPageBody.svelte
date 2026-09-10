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
		margin: 0 0 0.5rem;
		font-size: clamp(1.625rem, 1.2rem + 1.6vw, 2.125rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
	}
	.updated {
		margin: 0 0 2rem;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.prose {
		font-size: 1rem;
		line-height: 1.75;
	}
	.prose :global(h2) {
		margin: 2rem 0 0.5rem;
		font-size: 1.1875rem;
		line-height: 1.3;
		letter-spacing: -0.01em;
	}
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 1.0625rem;
	}
	.prose :global(li) {
		margin-bottom: 0.375rem;
	}
	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
		padding: 0.0625rem 0.25rem;
		border-radius: 3px;
		background: var(--surface-2);
	}
	.prose :global(a) {
		text-underline-offset: 0.15em;
	}
</style>
