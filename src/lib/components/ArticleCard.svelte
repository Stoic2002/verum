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
		gap: 0.875rem;
		align-content: start;
	}

	.card__image {
		display: block;
		overflow: hidden;
		border-radius: var(--r-lg);
		background: var(--surface-2);
		/*
		 * The ratio is reserved by the wrapper as well as by the image's own
		 * width/height, so a card holds its shape even before the bytes land
		 * (PRD §12.5).
		 */
		aspect-ratio: 16 / 10;
	}
	.card--featured .card__image {
		aspect-ratio: 16 / 9;
		border-radius: var(--r-2xl);
	}
	.card__image :global(img) {
		height: 100%;
		object-fit: cover;
		transition: transform 400ms var(--ease);
	}
	.card:hover .card__image :global(img) {
		transform: scale(1.02);
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
		padding: 0.1875rem 0.5rem;
		border-radius: var(--r-pill);
		background: var(--accent-tint);
		color: var(--accent);
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		text-decoration: none;
		transition: background var(--dur) var(--ease);
	}
	.card__category:hover {
		background: var(--accent-tint-strong);
	}

	.card__title {
		margin: 0.125rem 0;
		font-size: 1.1875rem;
		line-height: 1.3;
	}
	.card--featured .card__title {
		font-size: clamp(1.75rem, 1.3rem + 2vw, 2.5rem);
		line-height: 1.1;
	}
	.card__title a {
		color: var(--text);
		text-decoration: none;
		background-image: linear-gradient(var(--accent), var(--accent));
		background-size: 0% 1px;
		background-position: 0 100%;
		background-repeat: no-repeat;
		transition: background-size 260ms var(--ease);
	}
	.card__title a:hover {
		color: var(--accent);
		background-size: 100% 1px;
	}

	.card__excerpt {
		margin: 0;
		color: var(--text-2);
		font-size: 0.9375rem;
		line-height: 1.6;
	}
	.card--featured .card__excerpt {
		font-size: 1.0625rem;
		max-width: 34rem;
	}

	@media (min-width: 56rem) {
		.card--featured {
			grid-template-columns: 1.15fr 1fr;
			gap: 2.5rem;
			align-items: center;
		}
		.card--featured .card__image {
			order: 2;
		}
	}
</style>
