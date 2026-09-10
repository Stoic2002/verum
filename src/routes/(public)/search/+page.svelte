<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';

	let { data } = $props();

	const locale = getLocale();

	const dateFormat = new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	/** Preserves the query and filter when paging. Page 1 carries no page param. */
	function pageHref(page: number) {
		const parts = [`q=${encodeURIComponent(data.query)}`];
		if (data.category) parts.push(`category=${encodeURIComponent(data.category)}`);
		if (page > 1) parts.push(`page=${page}`);
		return `${urls.search(locale)}?${parts.join('&')}`;
	}
</script>

<svelte:head>
	<title>{data.query ? `${data.query} — ${m.nav_search()}` : m.nav_search()} — VERUM</title>
	<!-- Search result pages are not content; they must never be indexed. -->
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<h1>{m.nav_search()}</h1>

<form class="form-inline search" method="GET" role="search">
	<label class="visually-hidden" for="q">{m.nav_search()}</label>
	<input id="q" name="q" type="search" value={data.query} autocomplete="off" />

	<label class="visually-hidden" for="category">Category</label>
	<select id="category" name="category">
		<option value="">{m.search_all_categories()}</option>
		{#each data.categories as category (category.slug)}
			<option value={category.slug} selected={category.slug === data.category}>
				{category.name ?? category.slug}
			</option>
		{/each}
	</select>

	<button type="submit">{m.nav_search()}</button>
</form>

{#if data.query.trim()}
	<p class="count">{m.search_results({ count: data.total, query: data.query })}</p>

	{#if data.results.length === 0}
		<p class="empty">{m.search_none()}</p>
	{:else}
		<ol class="results">
			{#each data.results as hit (hit.article_id + hit.slug)}
				<li>
					<h2>
						<a href={urls.article(locale, hit.category_slug, hit.slug)}>{hit.title}</a>
					</h2>
					<p class="meta">
						<a href={urls.category(locale, hit.category_slug)}>{hit.category_slug}</a>
						<time datetime={new Date(hit.published_at).toISOString()}>
							{dateFormat.format(new Date(hit.published_at))}
						</time>
					</p>
					<!--
						ts_headline output. The only markup it can emit is the <mark>
						delimiters this codebase passes it, around text that Postgres
						escaped; the article body itself was sanitised at save time.
					-->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<p class="snippet">{@html hit.headline}</p>
				</li>
			{/each}
		</ol>

		{#if data.pages > 1}
			<nav class="pagination" aria-label="Pagination">
				{#if data.page > 1}
					<a rel="prev" href={pageHref(data.page - 1)}>← {m.pagination_prev()}</a>
				{:else}
					<span></span>
				{/if}
				<span class="meta">{m.pagination_page({ page: data.page, total: data.pages })}</span>
				{#if data.page < data.pages}
					<a rel="next" href={pageHref(data.page + 1)}>{m.pagination_next()} →</a>
				{:else}
					<span></span>
				{/if}
			</nav>
		{/if}
	{/if}
{/if}

<style>
	h1 {
		margin: 0 0 1.25rem;
		font-size: clamp(1.75rem, 1.3rem + 2vw, 2.5rem);
		letter-spacing: -0.03em;
	}
	/* Controls come from forms.css; only the width of the row is local. */
	.search {
		max-width: var(--measure);
	}
	.count {
		margin: 2rem 0 0;
		color: var(--text-3);
		font-size: 0.8125rem;
	}
	.results {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		max-width: var(--measure);
	}
	.results li {
		padding: 1.5rem 0;
		border-bottom: 1px solid var(--border);
	}
	.results h2 {
		margin: 0 0 0.375rem;
		font-size: 1.1875rem;
		line-height: 1.3;
	}
	.results h2 a {
		color: var(--text);
		text-decoration: none;
	}
	.results h2 a:hover {
		color: var(--accent);
	}
	.meta {
		display: flex;
		gap: 0.75rem;
		margin: 0 0 0.5rem;
		color: var(--text-3);
		font-size: 0.75rem;
	}
	.snippet {
		margin: 0;
		color: var(--text-2);
		font-size: 0.9375rem;
	}
	.snippet :global(mark) {
		background: var(--accent-tint-strong);
		color: inherit;
		padding: 0.0625rem 0.1875rem;
		border-radius: var(--r-sm);
	}
	.pagination {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
		max-width: var(--measure);
		font-size: 0.875rem;
	}
	.pagination > :last-child {
		justify-self: end;
	}
	.empty {
		margin-top: 1rem;
		color: var(--text-3);
	}
</style>
