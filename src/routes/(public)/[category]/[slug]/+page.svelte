<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import AdSlot from '$lib/components/AdSlot.svelte';
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import LocaleBanner from '$lib/components/LocaleBanner.svelte';
	import NewsletterCta from '$lib/components/NewsletterCta.svelte';
	import Picture from '$lib/components/Picture.svelte';
	import ShareButtons from '$lib/components/ShareButtons.svelte';

	let { data } = $props();

	const locale = getLocale();
	const article = $derived(data.article);
	const canonical = $derived(page.url.href.split('?')[0]);

	const dateFormat = new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const formatted = (iso: string) => dateFormat.format(new Date(iso));
</script>

<svelte:head>
	<title>{article.metaTitle || article.title} — VERUM</title>
	<meta name="description" content={article.metaDesc || article.excerpt} />
	<link rel="canonical" href={canonical} />
</svelte:head>

<div class="layout">
	<article class="article">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href={urls.home(locale)}>{m.nav_home()}</a>
			<span aria-hidden="true">/</span>
			<a href={urls.category(locale, article.categorySlug)}>
				{article.categoryName ?? article.categorySlug}
			</a>
		</nav>

		<h1>{article.title}</h1>
		<p class="standfirst">{article.excerpt}</p>

		<p class="byline">
			<time datetime={article.publishedAt}>
				{m.article_published({ date: formatted(article.publishedAt) })}
			</time>
			{#if article.modifiedAt && article.modifiedAt !== article.publishedAt}
				<time datetime={article.modifiedAt}>
					{m.article_updated({ date: formatted(article.modifiedAt) })}
				</time>
			{/if}
			<span>{m.article_read_time({ minutes: article.readingMinutes })}</span>
			{#if article.isLiving}
				<span class="pill" title={m.article_living_note()}>{m.article_living()}</span>
			{/if}
		</p>

		{#if data.alternates.length}
			<LocaleBanner alternates={data.alternates} />
		{/if}

		{#if article.image}
			<figure class="lede-image">
				<Picture
					{...article.image}
					sizes="(min-width: 52rem) 42rem, 100vw"
					loading="eager"
					fetchpriority="high"
				/>
			</figure>
		{/if}

		<!-- The first slot sits after the opening of the article (PRD §13.1). -->
		<AdSlot slot="article-top" minHeight={280} />

		{#if article.toc.length}
			<nav class="toc" aria-label={m.article_contents()}>
				<h2>{m.article_contents()}</h2>
				<ol>
					{#each article.toc as entry (entry.id)}
						<li class="toc--{entry.level}"><a href="#{entry.id}">{entry.text}</a></li>
					{/each}
				</ol>
			</nav>
		{/if}

		<!--
			body_html is produced and sanitised by src/lib/server/content/render.ts
			at save time. It is never author-supplied HTML; render.spec.ts is what
			keeps that true.
		-->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="prose">{@html article.bodyHtml}</div>

		{#if article.correction}
			<aside class="correction">
				<h2>{m.article_correction()}</h2>
				<p>{article.correction}</p>
			</aside>
		{/if}

		{#if article.tags.length}
			<p class="tags">
				<span class="tags__label">{m.article_tags()}</span>
				{#each article.tags as tag (tag.slug)}
					<a href={urls.tag(locale, tag.slug)}>{tag.name}</a>
				{/each}
			</p>
		{/if}

		<ShareButtons url={canonical} title={article.title} />

		<AdSlot slot="article-end" minHeight={280} />

		<div class="cta"><NewsletterCta /></div>

		{#if data.related.length}
			<section class="related">
				<h2>{m.article_related()}</h2>
				<div class="related__grid">
					{#each data.related as card (card.id)}
						<ArticleCard {card} />
					{/each}
				</div>
			</section>
		{/if}
	</article>
</div>

<style>
	.layout {
		display: grid;
		justify-content: center;
	}
	.article {
		width: 100%;
		max-width: var(--measure);
	}
	.crumbs {
		display: flex;
		gap: 0.5rem;
		color: var(--text-3);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.crumbs a {
		text-decoration: none;
	}
	h1 {
		margin: 0.75rem 0 0.5rem;
		font-size: clamp(1.75rem, 1.2rem + 2vw, 2.5rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
	}
	.standfirst {
		margin: 0 0 1rem;
		color: var(--text-2);
		font-size: 1.0625rem;
		line-height: 1.55;
	}
	.byline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0 0 1.5rem;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.lede-image {
		margin: 1.5rem 0;
	}
	.lede-image :global(img) {
		border-radius: 8px;
	}

	.toc {
		margin: 2rem 0;
		padding: 1rem 1.25rem;
		border-left: 2px solid var(--border);
	}
	.toc h2 {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-3);
	}
	.toc ol {
		margin: 0;
		padding-left: 1.125rem;
		font-size: 0.875rem;
	}
	.toc li {
		margin: 0.1875rem 0;
	}
	.toc :global(.toc--3) {
		margin-left: 0.875rem;
	}

	.prose {
		font-family: var(--font-serif);
		font-size: 1.0625rem;
		line-height: 1.75;
	}
	.prose :global(h2) {
		margin: 2.25rem 0 0.5rem;
		font-family: var(--font-body);
		font-size: 1.375rem;
		line-height: 1.25;
		letter-spacing: -0.01em;
		scroll-margin-top: 1.5rem;
	}
	.prose :global(h3) {
		margin: 1.75rem 0 0.375rem;
		font-family: var(--font-body);
		font-size: 1.125rem;
		scroll-margin-top: 1.5rem;
	}
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 1.125rem;
	}
	.prose :global(a) {
		text-underline-offset: 0.15em;
	}
	.prose :global(blockquote) {
		margin: 1.5rem 0;
		padding-left: 1rem;
		border-left: 2px solid var(--border);
		color: var(--text-2);
	}
	.prose :global(pre) {
		margin: 1.5rem 0;
		padding: 1rem;
		border-radius: 8px;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.6;
	}
	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
	}
	/*
	 * Shiki renders both themes at once as CSS variables, so dark mode is a
	 * variable swap rather than a second highlight pass.
	 */
	:global(html[data-theme='dark']) .prose :global(.shiki),
	:global(html[data-theme='dark']) .prose :global(.shiki span) {
		color: var(--shiki-dark) !important;
		background-color: var(--shiki-dark-bg) !important;
	}
	@media (prefers-color-scheme: dark) {
		:global(html:not([data-theme='light'])) .prose :global(.shiki),
		:global(html:not([data-theme='light'])) .prose :global(.shiki span) {
			color: var(--shiki-dark) !important;
			background-color: var(--shiki-dark-bg) !important;
		}
	}
	/* Wide tables scroll inside their own box; the page never scrolls sideways. */
	.prose :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		font-family: var(--font-body);
		font-size: 0.875rem;
	}
	.prose :global(th),
	.prose :global(td) {
		padding: 0.4375rem 0.75rem;
		border: 1px solid var(--border);
		text-align: left;
	}
	.prose :global(figure) {
		margin: 1.75rem 0;
	}
	.prose :global(figcaption) {
		margin-top: 0.5rem;
		color: var(--text-3);
		font-family: var(--font-body);
		font-size: 0.8125rem;
	}
	.prose :global(.embed__frame) {
		position: relative;
		aspect-ratio: 16 / 9;
	}
	.prose :global(.embed__frame iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 8px;
	}
	.prose :global(.embed--x .embed__card) {
		margin: 0;
		padding: 1rem;
		border: 1px solid var(--border);
		border-left-width: 1px;
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 0.9375rem;
	}
	.prose :global(.callout) {
		margin: 1.5rem 0;
		padding: 0.875rem 1.125rem;
		border-left: 3px solid var(--accent);
		border-radius: 0 6px 6px 0;
		background: var(--surface-2);
		font-family: var(--font-body);
		font-size: 0.9375rem;
	}
	.prose :global(.callout p:last-child) {
		margin-bottom: 0;
	}
	.prose :global(.embed-error) {
		color: #b91c1c;
		font-family: var(--font-body);
		font-size: 0.875rem;
	}

	.correction {
		margin: 2rem 0;
		padding: 1rem 1.25rem;
		border-left: 3px solid #b91c1c;
		background: var(--surface-2);
	}
	.correction h2 {
		margin: 0 0 0.375rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.correction p {
		margin: 0;
		font-size: 0.9375rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		margin: 2rem 0 1rem;
		font-size: 0.8125rem;
	}
	.tags__label {
		color: var(--text-3);
	}
	.cta {
		margin: 2rem 0;
	}
	.related h2 {
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-3);
	}
	.related__grid {
		display: grid;
		gap: 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	}
</style>
