<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import Picture from './Picture.svelte';
	import type { CardData } from '$lib/cards';

	let {
		card,
		headingLevel = 3,
		featured = false
	}: { card: CardData; headingLevel?: 2 | 3; featured?: boolean } = $props();

	const locale = getLocale();
	const href = $derived(urls.article(locale, card.categorySlug, card.slug));
</script>

<article class="card" class:card--featured={featured}>
	{#if card.image}
		<a class="card__image" {href} tabindex="-1" aria-hidden="true">
			<Picture
				{...card.image}
				sizes={featured ? '(min-width: 52rem) 40rem, 100vw' : '(min-width: 52rem) 20rem, 100vw'}
				loading={featured ? 'eager' : 'lazy'}
				fetchpriority={featured ? 'high' : 'auto'}
			/>
		</a>
	{/if}

	<div class="card__body">
		<p class="card__meta">
			<a class="card__category" href={urls.category(locale, card.categorySlug)}>
				{card.categoryName ?? card.categorySlug}
			</a>
			<span>{m.article_read_time({ minutes: card.readingMinutes })}</span>
			{#if card.isLiving}<span class="pill">{m.article_living()}</span>{/if}
		</p>

		<svelte:element this={`h${headingLevel}`} class="card__title">
			<a {href}>{card.title}</a>
		</svelte:element>

		<p class="card__excerpt">{card.excerpt}</p>
	</div>
</article>

<style>
	.card {
		display: grid;
		gap: 0.75rem;
	}
	.card__image {
		display: block;
		overflow: hidden;
		border-radius: 8px;
	}
	.card__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		color: var(--text-3);
		font-size: 0.75rem;
	}
	.card__category {
		color: var(--accent);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		text-decoration: none;
	}
	.card__title {
		margin: 0.25rem 0;
		font-size: 1.0625rem;
		line-height: 1.3;
		letter-spacing: -0.01em;
	}
	.card--featured .card__title {
		font-size: 1.5rem;
	}
	.card__title a {
		color: inherit;
		text-decoration: none;
	}
	.card__title a:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}
	.card__excerpt {
		margin: 0;
		color: var(--text-2);
		font-size: 0.875rem;
		line-height: 1.55;
	}
	.card--featured .card__excerpt {
		font-size: 1rem;
	}
	@media (min-width: 52rem) {
		.card--featured {
			grid-template-columns: 3fr 2fr;
			gap: 1.75rem;
			align-items: center;
		}
	}
</style>
