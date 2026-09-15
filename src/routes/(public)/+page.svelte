<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import RankedList from '$lib/components/RankedList.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import type { CardData } from '$lib/cards';

	let { data } = $props();
	const locale = getLocale();

	const toLink = (card: CardData) => ({
		id: card.id,
		title: card.title,
		href: urls.article(locale, card.categorySlug, card.slug),
		label: card.categoryName ?? card.categorySlug
	});
</script>

<Seo seo={data.seo} />

{#if !data.featured}
	<p class="empty">{m.home_empty()}</p>
{:else}
	<section class="top">
		<div class="top__main">
			<ArticleCard card={data.featured} headingLevel={2} featured />

			{#if data.secondary.length}
				<div class="top__secondary">
					{#each data.secondary as card (card.id)}
						<ArticleCard {card} />
					{/each}
				</div>
			{/if}
		</div>

		<aside class="top__side">
			<!--
				Trending needs readers before it means anything. Until there are
				three, the column shows the newest stories instead of standing empty.
			-->
			{#if data.trending.length >= 3}
				<RankedList title={m.home_trending()} items={data.trending.slice(0, 5)} />
			{:else if data.more.length}
				<RankedList
					title={m.home_latest()}
					items={data.more.slice(0, 5).map(toLink)}
					numbered={false}
				/>
			{/if}

			{#if data.topics.length}
				<section class="topics">
					<h2 class="eyebrow">{m.home_topics()}</h2>
					<div class="topics__chips">
						{#each data.topics as topic (topic.slug)}
							<a href={urls.topic(locale, topic.slug)}>{topic.title}</a>
						{/each}
					</div>
				</section>
			{/if}
		</aside>
	</section>

	{#if data.blocks.length}
		<div class="blocks">
			{#each data.blocks as block (block.slug)}
				<section class="block">
					<h2 class="eyebrow block__title">
						<a href={urls.category(locale, block.slug)}>{block.name}</a>
					</h2>
					{#if block.articles[0]}
						<ArticleCard card={block.articles[0]} />
					{/if}
					{#if block.articles.length > 1}
						<ul class="block__list">
							{#each block.articles.slice(1) as card (card.id)}
								<li>
									<a href={urls.article(locale, card.categorySlug, card.slug)}>{card.title}</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}

	{#if data.more.length}
		<section class="section">
			<h2 class="eyebrow section__title">{m.home_more()}</h2>
			<div class="grid">
				{#each data.more as card (card.id)}
					<ArticleCard {card} />
				{/each}
			</div>
		</section>
	{/if}
{/if}

<style>
	.top {
		display: grid;
		gap: 2.5rem;
		padding-bottom: 3rem;
		border-bottom: 1px solid var(--border);
	}
	.top__secondary {
		display: grid;
		gap: 2rem 1.5rem;
		margin-top: 2.25rem;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
	}
	.top__side {
		display: grid;
		gap: 1.5rem;
		align-content: start;
	}
	@media (min-width: 64rem) {
		.top {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}
	}

	.topics__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.topics__chips a {
		padding: 0.3125rem 0.75rem;
		border-radius: var(--r-pill);
		background: var(--accent-tint);
		color: var(--accent);
		font-size: 0.8125rem;
		font-weight: var(--weight-strong);
		text-decoration: none;
		transition: background var(--dur) var(--ease);
	}
	.topics__chips a:hover {
		background: var(--accent-tint-strong);
	}

	.blocks {
		display: grid;
		gap: 2.5rem 2rem;
		margin: 3rem 0;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
	}
	.block {
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.block__title {
		padding-bottom: 0.625rem;
		border-bottom: 2px solid var(--text);
	}
	.block__title a {
		color: inherit;
		text-decoration: none;
	}
	.block__title a:hover {
		color: var(--accent);
	}
	.block__list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.block__list li {
		padding: 0.75rem 0;
		border-top: 1px solid var(--border);
	}
	.block__list a {
		color: var(--text);
		font-size: 0.9375rem;
		font-weight: var(--weight-strong);
		line-height: 1.35;
		text-decoration: none;
	}
	.block__list a:hover {
		color: var(--accent);
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
	.grid {
		display: grid;
		gap: 2.5rem 1.75rem;
		margin-top: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
	.empty {
		color: var(--text-3);
	}
</style>
