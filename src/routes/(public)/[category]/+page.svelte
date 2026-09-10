<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
	const locale = getLocale();
	const basePath = $derived(urls.category(locale, data.category.slug));
</script>

<Seo seo={data.seo} />

<header class="head">
	<h1>{data.category.name}</h1>
	{#if data.category.description}
		<p class="description">{data.category.description}</p>
	{/if}
	<p class="count">{m.category_articles({ count: data.total })}</p>
</header>

{#if data.articles.length === 0}
	<p class="empty">{m.home_empty()}</p>
{:else}
	<div class="grid">
		{#each data.articles as card (card.id)}
			<ArticleCard {card} />
		{/each}
	</div>

	<Pagination {basePath} page={data.page} pages={data.pages} />
{/if}

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
	.description {
		margin: 0 0 0.75rem;
		color: var(--text-2);
		font-size: 1.0625rem;
		line-height: 1.6;
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
	.empty {
		color: var(--text-3);
	}
</style>
