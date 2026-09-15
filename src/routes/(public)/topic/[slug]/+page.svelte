<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import ArticleRow from '$lib/components/ArticleRow.svelte';
	import RankedList from '$lib/components/RankedList.svelte';
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

<div class="listing">
	<div class="listing__main">
		{#each data.articles as card (card.id)}
			<ArticleRow {card} />
		{/each}
	</div>

	<aside class="listing__side">
		<RankedList title={m.home_trending()} items={data.trending.slice(0, 5)} />
	</aside>
</div>

<style>
	.head {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 2px solid var(--text);
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
		max-width: var(--measure);
		color: var(--text-2);
		font-size: 1.0625rem;
		line-height: 1.7;
	}
	.intro :global(p) {
		margin: 0 0 1.125rem;
	}
	.listing {
		display: grid;
		gap: 2.5rem;
	}
	.listing__side {
		align-self: start;
	}
	@media (min-width: 64rem) {
		.listing {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}
		.listing__side {
			position: sticky;
			top: 5rem;
			padding-top: 1.25rem;
		}
	}
</style>
