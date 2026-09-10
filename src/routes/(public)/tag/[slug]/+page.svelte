<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';

	let { data } = $props();
	const locale = getLocale();
</script>

<Seo seo={data.seo} />

<header class="head">
	<h1>{m.tag_heading({ name: data.tag.name })}</h1>
	<p class="count">{m.category_articles({ count: data.total })}</p>
</header>

<div class="grid">
	{#each data.articles as card (card.id)}
		<ArticleCard {card} />
	{/each}
</div>

<Pagination basePath={urls.tag(locale, data.tag.slug)} page={data.page} pages={data.pages} />

<style>
	.head {
		max-width: var(--measure);
		margin-bottom: 2.5rem;
	}
	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(1.875rem, 1.3rem + 2.4vw, 2.75rem);
		line-height: 1.1;
		letter-spacing: -0.03em;
	}
	.count {
		margin: 0;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.grid {
		display: grid;
		gap: 2.5rem 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
</style>
