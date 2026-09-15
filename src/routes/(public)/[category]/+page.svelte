<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleRow from '$lib/components/ArticleRow.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import RankedList from '$lib/components/RankedList.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
	const locale = getLocale();
	const categoryPath = $derived(urls.category(locale, data.category.slug));
	const basePath = $derived(
		data.activeTag ? `${categoryPath}?tag=${encodeURIComponent(data.activeTag)}` : categoryPath
	);
</script>

<Seo seo={data.seo} />

<header class="head">
	<h1>{data.category.name}</h1>
	{#if data.category.description}
		<p class="description">{data.category.description}</p>
	{/if}
	<p class="count">{m.category_articles({ count: data.total })}</p>

	{#if data.tags.length}
		<nav class="filters" aria-label={m.article_tags()}>
			<a href={categoryPath} aria-current={data.activeTag ? undefined : 'true'}>
				{m.category_all()}
			</a>
			{#each data.tags as tag (tag.slug)}
				<a
					href="{categoryPath}?tag={encodeURIComponent(tag.slug)}"
					rel="nofollow"
					aria-current={data.activeTag === tag.slug ? 'true' : undefined}>{tag.name}</a
				>
			{/each}
		</nav>
	{/if}
</header>

<div class="listing">
	<div class="listing__main">
		{#if data.articles.length === 0}
			<p class="empty">{m.home_empty()}</p>
		{:else}
			{#each data.articles as card (card.id)}
				<ArticleRow {card} showCategory={false} />
			{/each}
			<Pagination {basePath} page={data.page} pages={data.pages} />
		{/if}
	</div>

	<aside class="listing__side">
		{#if data.popular.length}
			<RankedList
				title={m.category_popular({ category: data.category.name })}
				items={data.popular}
			/>
		{:else if data.trending.length}
			<RankedList title={m.home_trending()} items={data.trending.slice(0, 5)} />
		{/if}
	</aside>
</div>

<style>
	.head {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 2px solid var(--text);
	}
	h1 {
		margin: 0 0 0.75rem;
		font-size: clamp(1.875rem, 1.3rem + 2.4vw, 2.75rem);
		line-height: 1.1;
		letter-spacing: -0.03em;
	}
	.description {
		max-width: var(--measure);
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
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
	.filters a {
		padding: 0.3125rem 0.75rem;
		border-radius: var(--r-pill);
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 0.8125rem;
		text-decoration: none;
		box-shadow: inset 0 0 0 1px var(--border);
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.filters a:hover {
		color: var(--text);
	}
	.filters a[aria-current='true'] {
		background: var(--accent);
		color: var(--accent-contrast);
		box-shadow: none;
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
	.empty {
		color: var(--text-3);
	}
</style>
