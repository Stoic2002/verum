<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import NewsletterCta from '$lib/components/NewsletterCta.svelte';
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

	<div class="cta-slot"><NewsletterCta /></div>

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
	.cta-slot {
		margin: 3.5rem 0;
	}
	.empty {
		color: var(--text-3);
	}
</style>
