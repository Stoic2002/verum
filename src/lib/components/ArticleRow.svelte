<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import Picture from './Picture.svelte';
	import type { CardData } from '$lib/cards';

	/** A horizontal card: thumbnail beside the text. Denser than ArticleCard, for listings. */
	let { card, showCategory = true }: { card: CardData; showCategory?: boolean } = $props();

	const locale = getLocale();
	const href = $derived(urls.article(locale, card.categorySlug, card.slug));
</script>

<article class="row" class:row--no-image={!card.image}>
	{#if card.image}
		<a class="row__image" {href} tabindex="-1" aria-hidden="true">
			<Picture {...card.image} sizes="(min-width: 40rem) 13rem, 34vw" />
		</a>
	{/if}
	<div class="row__body">
		<p class="row__meta">
			{#if showCategory}
				<a class="row__category" href={urls.category(locale, card.categorySlug)}>
					{card.categoryName ?? card.categorySlug}
				</a>
			{/if}
			<span>{m.article_read_time({ minutes: card.readingMinutes })}</span>
		</p>
		<h2 class="row__title"><a {href}>{card.title}</a></h2>
		<p class="row__excerpt">{card.excerpt}</p>
	</div>
</article>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--border);
	}
	.row--no-image {
		grid-template-columns: minmax(0, 1fr);
	}
	.row__image {
		display: block;
		overflow: hidden;
		aspect-ratio: 16 / 10;
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.row__image :global(img) {
		height: 100%;
		object-fit: cover;
		transition: transform 400ms var(--ease);
	}
	.row:hover .row__image :global(img) {
		transform: scale(1.03);
	}
	.row__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		margin: 0 0 0.375rem;
		color: var(--text-3);
		font-size: 0.75rem;
	}
	.row__category {
		color: var(--accent);
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		text-decoration: none;
	}
	.row__title {
		margin: 0 0 0.375rem;
		font-size: 1.1875rem;
		line-height: 1.3;
		letter-spacing: -0.01em;
	}
	.row__title a {
		color: var(--text);
		text-decoration: none;
	}
	.row__title a:hover {
		color: var(--accent);
	}
	.row__excerpt {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		color: var(--text-2);
		font-size: 0.9375rem;
		line-height: 1.55;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	@media (max-width: 40rem) {
		.row {
			grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr);
			gap: 0.875rem;
		}
		.row__title {
			font-size: 1rem;
		}
		.row__excerpt {
			display: none;
		}
	}
</style>
