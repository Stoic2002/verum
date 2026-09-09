<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import NewsletterCta from '$lib/components/NewsletterCta.svelte';

	let { data } = $props();
	const locale = getLocale();
</script>

<svelte:head>
	<title>VERUM — {m.site_tagline()}</title>
	<meta name="description" content={m.site_tagline()} />
</svelte:head>

{#if !data.featured}
	<p class="empty">{m.home_empty()}</p>
{:else}
	<section class="lede">
		<ArticleCard card={data.featured} headingLevel={2} featured />
	</section>

	{#if data.latest.length}
		<section class="section">
			<h2 class="section__title">{m.home_latest()}</h2>
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
			<h2 class="section__title">
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
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}
	.section {
		margin: 2.5rem 0;
	}
	.section__title {
		margin: 0 0 0.25rem;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-3);
	}
	.section__title a {
		color: inherit;
		text-decoration: none;
	}
	.section__description {
		margin: 0 0 1.25rem;
		max-width: var(--measure);
		color: var(--text-2);
		font-size: 0.875rem;
	}
	.grid {
		display: grid;
		gap: 1.75rem;
		margin-top: 1.25rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}
	.cta-slot {
		margin: 2.5rem 0;
	}
	.empty {
		color: var(--text-3);
	}
</style>
