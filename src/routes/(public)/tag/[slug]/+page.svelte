<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
</script>

<Seo seo={data.seo} />

<header class="head">
	<h1>{m.tag_heading({ name: data.tag.name })}</h1>
	<p class="count">{m.category_articles({ count: data.articles.length })}</p>
</header>

<div class="grid">
	{#each data.articles as card (card.id)}
		<ArticleCard {card} />
	{/each}
</div>

<style>
	.head {
		max-width: var(--measure);
		margin-bottom: 2rem;
	}
	h1 {
		margin: 0 0 0.375rem;
		font-size: clamp(1.375rem, 1.1rem + 1.2vw, 1.75rem);
		letter-spacing: -0.015em;
	}
	.count {
		margin: 0;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.grid {
		display: grid;
		gap: 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}
</style>
