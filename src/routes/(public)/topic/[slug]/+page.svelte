<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
</script>

<Seo seo={data.seo} />

<header class="head">
	<p class="eyebrow kicker">{m.topic_heading({ title: data.topic.title })}</p>
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
		margin-bottom: 3rem;
	}
	.kicker {
		margin: 0;
	}
	h1 {
		margin: 0.5rem 0 1.25rem;
		font-size: clamp(2rem, 1.4rem + 2.8vw, 3rem);
		line-height: 1.08;
		letter-spacing: -0.03em;
	}
	.intro {
		color: var(--text-2);
		font-size: 1.0625rem;
		line-height: 1.7;
	}
	.intro :global(p) {
		margin: 0 0 1.125rem;
	}
	.grid {
		display: grid;
		gap: 2.5rem 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
</style>
