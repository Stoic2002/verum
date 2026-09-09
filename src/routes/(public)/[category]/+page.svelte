<script lang="ts">
	import { page as pageState } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data } = $props();
	const locale = getLocale();
	const basePath = $derived(urls.category(locale, data.category.slug));
</script>

<svelte:head>
	<title>{data.category.name} — VERUM</title>
	{#if data.category.description}
		<meta name="description" content={data.category.description} />
	{/if}
	<link rel="canonical" href={pageState.url.href.split('?')[0]} />
</svelte:head>

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
		margin-bottom: 2rem;
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2rem);
		letter-spacing: -0.02em;
	}
	.description {
		margin: 0 0 0.5rem;
		color: var(--text-2);
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
	.empty {
		color: var(--text-3);
	}
</style>
