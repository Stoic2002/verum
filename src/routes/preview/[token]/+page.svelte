<script lang="ts">
	import '$lib/styles/tokens.css';

	let { data } = $props();
</script>

<svelte:head>
	<title>Preview · {data.article.title}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="banner">
	Preview of an unpublished draft — status <strong>{data.article.status}</strong>. This link expires {new Date(
		data.expiresAt
	).toLocaleString()}.
</div>

<article>
	<h1>{data.article.title}</h1>
	<p class="excerpt">{data.article.excerpt}</p>
	<p class="meta">{data.article.readingMinutes} min read</p>

	<!--
		body_html is written by src/lib/server/content/render.ts, which sanitises
		before storing. It is never author-supplied HTML. See render.spec.ts.
	-->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.article.bodyHtml}

	{#if data.article.correction}
		<aside class="correction">
			<strong>Correction</strong>
			<p>{data.article.correction}</p>
		</aside>
	{/if}
</article>

<style>
	.banner {
		padding: 0.625rem 1rem;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
		font:
			0.8125rem/1.5 system-ui,
			sans-serif;
	}
	article {
		max-width: 42rem;
		margin: 2rem auto;
		padding: 0 1.25rem;
		font:
			1rem/1.7 system-ui,
			sans-serif;
		color: var(--text);
	}
	h1 {
		font-size: 1.75rem;
		line-height: 1.25;
	}
	.excerpt {
		color: var(--text-2);
	}
	.meta {
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.correction {
		margin-top: 2rem;
		padding: 0.75rem 1rem;
		border-left: 3px solid var(--danger);
		background: var(--danger-tint);
	}
	article :global(img) {
		max-width: 100%;
		height: auto;
	}
	article :global(pre) {
		overflow-x: auto;
		padding: 0.875rem;
		border-radius: 6px;
		font-size: 0.8125rem;
	}
	article :global(table) {
		border-collapse: collapse;
		width: 100%;
	}
	article :global(th),
	article :global(td) {
		border: 1px solid var(--border);
		padding: 0.375rem 0.625rem;
	}
	article :global(.embed__frame) {
		position: relative;
		aspect-ratio: 16 / 9;
	}
	article :global(.embed__frame iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	article :global(.callout__title) {
		margin-bottom: 0.375rem;
		font-weight: 600;
	}
	article :global(.callout) {
		border-left: 3px solid var(--text-3);
		padding: 0.625rem 0.875rem;
		background: var(--surface-2);
	}
	article :global(.embed-error) {
		color: var(--danger);
	}
</style>
