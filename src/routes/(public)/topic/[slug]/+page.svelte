<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import ArticleCard from '$lib/components/ArticleCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.topic.title} — VERUM</title>
	<link rel="canonical" href={page.url.href.split('?')[0]} />
</svelte:head>

<header class="head">
	<p class="kicker">{m.topic_heading({ title: data.topic.title })}</p>
	<h1>{data.topic.title}</h1>

	<!--
		intro_html comes from the same sanitising render pipeline as article
		bodies (src/lib/server/content/render.ts), written at save time.
	-->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="intro">{@html data.topic.intro_html}</div>
</header>

<div class="grid">
	{#each data.articles as card (card.id)}
		<ArticleCard {card} />
	{/each}
</div>

<style>
	.head {
		max-width: var(--measure);
		margin-bottom: 2.5rem;
	}
	.kicker {
		margin: 0;
		color: var(--text-3);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	h1 {
		margin: 0.375rem 0 1rem;
		font-size: clamp(1.625rem, 1.2rem + 1.8vw, 2.25rem);
		letter-spacing: -0.02em;
	}
	.intro {
		color: var(--text-2);
	}
	.intro :global(p) {
		margin: 0 0 1rem;
	}
	.grid {
		display: grid;
		gap: 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}
</style>
