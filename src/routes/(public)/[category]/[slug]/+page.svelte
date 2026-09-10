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
	import Seo from '$lib/components/Seo.svelte';
	import ShareButtons from '$lib/components/ShareButtons.svelte';
	import ViewBeacon from '$lib/components/ViewBeacon.svelte';

	let { data } = $props();

	const locale = getLocale();
	const article = $derived(data.article);
	const canonical = $derived(page.url.href.split('?')[0]);

	/**
	 * The table of contents is stored flat, with a level per heading. Rendering
	 * it flat inside one <ol> numbers an h3 as a sibling of the h2 above it —
	 * "3." appearing under "2." as though it were the next section. Grouping
	 * restores the relationship the numbering is supposed to express.
	 */
	const outline = $derived(
		article.toc.reduce<{ id: string; text: string; children: { id: string; text: string }[] }[]>(
			(sections, entry) => {
				if (entry.level === 2 || sections.length === 0) {
					sections.push({ id: entry.id, text: entry.text, children: [] });
				} else {
					sections[sections.length - 1].children.push({ id: entry.id, text: entry.text });
				}
				return sections;
			},
			[]
		)
	);

	const dateFormat = new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const formatted = (iso: string) => dateFormat.format(new Date(iso));
</script>

<Seo seo={data.seo} />

<ViewBeacon articleId={article.id} />

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

		{#if article.toc.length}
			<nav class="toc" aria-label={m.article_contents()}>
				<h2>{m.article_contents()}</h2>
				<ol>
					{#each outline as section (section.id)}
						<li>
							<a href="#{section.id}">{section.text}</a>
							{#if section.children.length}
								<ul>
									{#each section.children as child (child.id)}
										<li><a href="#{child.id}">{child.text}</a></li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ol>
			</nav>
		{/if}

		<!--
			body_html is produced and sanitised by src/lib/server/content/render.ts
			at save time. It is never author-supplied HTML; render.spec.ts is what
			keeps that true.

			Split in two so the first ad slot falls after the opening paragraph
			rather than above the article (PRD §13.1).
		-->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="prose">{@html article.body.lead}</div>

		{#if article.body.rest}
			<AdSlot slot="article-top" minHeight={280} />
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="prose">{@html article.body.rest}</div>
		{/if}

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
		align-items: center;
		gap: 0.5rem;
		color: var(--text-3);
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.crumbs a {
		color: var(--text-3);
		text-decoration: none;
	}
	.crumbs a:last-of-type {
		color: var(--accent);
	}

	/*
	 * The reference's signature applied to editorial: large, and light. Weight
	 * 500 rather than 700, so size alone carries the hierarchy.
	 */
	h1 {
		margin: 1rem 0 0.75rem;
		font-size: clamp(2rem, 1.3rem + 3vw, 3.25rem);
		line-height: 1.08;
		letter-spacing: -0.03em;
	}
	.standfirst {
		margin: 0 0 1.5rem;
		color: var(--text-2);
		font-size: 1.1875rem;
		line-height: 1.55;
	}
	.byline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem 1rem;
		margin: 0 0 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
		color: var(--text-3);
		font-size: 0.8125rem;
	}

	.lede-image {
		margin: 0 0 2rem;
	}
	.lede-image :global(img) {
		border-radius: var(--r-xl);
	}

	.toc {
		margin: 2rem 0;
		padding: 1.125rem 1.375rem;
		border-radius: var(--r-lg);
		background: var(--surface-2);
	}
	.toc h2 {
		margin: 0 0 0.625rem;
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		color: var(--text-3);
	}
	.toc ol {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.9375rem;
	}
	.toc li {
		margin: 0.3125rem 0;
	}
	/* Sub-headings are marked by indentation, not by continuing the numbering. */
	.toc ul {
		margin: 0.25rem 0 0.5rem;
		padding-left: 0.875rem;
		list-style: none;
		font-size: 0.875rem;
	}
	.toc ul li::before {
		content: '';
		display: inline-block;
		width: 0.5rem;
		height: 1px;
		margin-right: 0.4375rem;
		vertical-align: middle;
		background: var(--border-strong);
	}
	.toc a {
		color: var(--text-2);
		text-decoration: none;
	}
	.toc a:hover {
		color: var(--accent);
	}

	/*
	 * Body stays sans, matching the reference and the way this audience reads
	 * documentation all day. Switching to a serif is one token: set
	 * --font-body on .prose.
	 */
	.prose {
		font-size: 1.0625rem;
		line-height: 1.75;
		color: var(--text);
	}
	.prose :global(h2) {
		margin: 2.75rem 0 0.75rem;
		font-size: 1.625rem;
		line-height: 1.2;
		letter-spacing: -0.02em;
		scroll-margin-top: 5rem;
	}
	.prose :global(h3) {
		margin: 2rem 0 0.5rem;
		font-size: 1.25rem;
		letter-spacing: -0.01em;
		scroll-margin-top: 5rem;
	}
	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 1.25rem;
	}
	.prose :global(li) {
		margin-bottom: 0.5rem;
	}
	.prose :global(strong) {
		font-weight: var(--weight-strong);
	}
	.prose :global(blockquote) {
		margin: 2rem 0;
		padding: 0.25rem 0 0.25rem 1.25rem;
		border-left: 3px solid var(--accent);
		color: var(--text-2);
		font-size: 1.125rem;
	}
	.prose :global(pre) {
		margin: 1.75rem 0;
		padding: 1.125rem 1.25rem;
		border-radius: var(--r-lg);
		border: 1px solid var(--border);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.65;
	}
	.prose :global(:not(pre) > code) {
		padding: 0.125rem 0.375rem;
		border-radius: var(--r-sm);
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: 0.8125em;
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
		margin: 1.75rem 0;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}
	.prose :global(th),
	.prose :global(td) {
		padding: 0.5rem 0.875rem;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}
	.prose :global(th) {
		font-weight: var(--weight-strong);
		white-space: nowrap;
	}
	.prose :global(figure) {
		margin: 2rem 0;
	}
	.prose :global(figure img) {
		border-radius: var(--r-lg);
	}
	.prose :global(figcaption) {
		margin-top: 0.625rem;
		color: var(--text-3);
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
		border-radius: var(--r-lg);
	}
	.prose :global(.embed--x .embed__card) {
		margin: 0;
		padding: 1.125rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		font-size: 0.9375rem;
	}
	.prose :global(.callout) {
		margin: 1.75rem 0;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--r-lg);
		background: var(--surface-2);
		font-size: 0.9375rem;
	}
	.prose :global(.callout p:last-child) {
		margin-bottom: 0;
	}
	.prose :global(.callout__title) {
		margin-bottom: 0.375rem;
		font-weight: var(--weight-strong);
		color: var(--text);
	}
	.prose :global(.callout--warning),
	.prose :global(.callout--caution) {
		border-left-color: var(--danger);
	}
	.prose :global(.embed-error) {
		color: var(--danger);
		font-size: 0.875rem;
	}

	.correction {
		margin: 2.5rem 0;
		padding: 1.125rem 1.375rem;
		border-radius: var(--r-lg);
		border-left: 3px solid var(--danger);
		background: var(--surface-2);
	}
	.correction h2 {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
		color: var(--danger);
	}
	.correction p {
		margin: 0;
		font-size: 0.9375rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 2.5rem 0 1.5rem;
		font-size: 0.8125rem;
	}
	.tags__label {
		margin-right: 0.25rem;
		color: var(--text-3);
	}
	.tags a {
		padding: 0.25rem 0.625rem;
		border-radius: var(--r-sm);
		background: var(--surface-2);
		color: var(--text-2);
		text-decoration: none;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.tags a:hover {
		background: var(--accent-tint);
		color: var(--accent);
	}

	.cta {
		margin: 3rem 0;
	}
	.related {
		margin-top: 3.5rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border);
	}
	.related h2 {
		margin: 0 0 1.5rem;
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
		color: var(--text-3);
	}
	.related__grid {
		display: grid;
		gap: 2rem 1.75rem;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	}

	@media (max-width: 40rem) {
		/* The masthead is not sticky here, so headings need no clearance. */
		.prose :global(h2),
		.prose :global(h3) {
			scroll-margin-top: 1rem;
		}
	}
</style>
