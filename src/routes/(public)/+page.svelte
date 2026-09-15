<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
	const locale = getLocale();
</script>

<Seo seo={data.seo} />

{#if !data.featured}
	<p class="empty">{m.home_empty()}</p>
{:else}
	<section class="lede">
		<ArticleCard card={data.featured} headingLevel={2} featured />
	</section>

	<!-- Only once there is something to rank: three is the smallest list that reads as a ranking. -->
	{#if data.trending.length >= 3}
		<section class="section trending" aria-labelledby="trending-title">
			<h2 id="trending-title" class="eyebrow section__title">{m.home_trending()}</h2>
			<ol class="trending__list">
				{#each data.trending as card, index (card.id)}
					<li class="trending__item">
						<span class="trending__rank" aria-hidden="true">{index + 1}</span>
						<div>
							<a class="trending__category" href={urls.category(locale, card.categorySlug)}>
								{card.categoryName ?? card.categorySlug}
							</a>
							<a class="trending__title" href={urls.article(locale, card.categorySlug, card.slug)}>
								{card.title}
							</a>
						</div>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if data.latest.length}
		<section class="section">
			<h2 class="eyebrow section__title">{m.home_latest()}</h2>
			<div class="grid">
				{#each data.latest as card (card.id)}
					<ArticleCard {card} />
				{/each}
			</div>
		</section>
	{/if}

	{#each data.blocks as block (block.slug)}
		<section class="section">
			<h2 class="eyebrow section__title">
				<a href={urls.category(locale, block.slug)}>{block.name}</a>
			</h2>
			{#if block.description}
				<p class="section__description">{block.description}</p>
			{/if}
			<div class="grid">
				{#each block.articles as card (card.id)}
					<ArticleCard {card} />
				{/each}
			</div>
		</section>
	{/each}
{/if}

<style>
	.lede {
		padding-bottom: 3rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}
	.section {
		margin: 3.5rem 0;
	}
	.section__title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0 0 0.375rem;
	}
	/* A hairline that runs to the edge, so the label reads as a divider. */
	.section__title::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}
	.section__title a {
		color: inherit;
		text-decoration: none;
	}
	.section__title a:hover {
		color: var(--accent);
	}
	.section__description {
		margin: 0 0 1.5rem;
		max-width: var(--measure);
		color: var(--text-2);
		font-size: 0.9375rem;
	}
	.grid {
		display: grid;
		gap: 2.5rem 1.75rem;
		margin-top: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
	.trending__list {
		display: grid;
		gap: 1.25rem 2rem;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}
	.trending__item {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.875rem;
		align-items: start;
	}
	.trending__rank {
		min-width: 1.5ch;
		color: var(--accent);
		font-size: 2rem;
		font-weight: var(--weight-display);
		line-height: 1;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}
	.trending__category {
		display: block;
		margin-bottom: 0.25rem;
		color: var(--text-3);
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		text-decoration: none;
	}
	.trending__title {
		color: var(--text);
		font-weight: var(--weight-strong);
		line-height: 1.35;
		text-decoration: none;
	}
	.trending__title:hover {
		color: var(--accent);
	}
	.empty {
		color: var(--text-3);
	}
</style>
