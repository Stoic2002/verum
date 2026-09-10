<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { paged } from '$lib/urls';

	/**
	 * Plain links, so pagination works with JavaScript off and crawlers can
	 * follow it. Page 1 never carries ?page=1, so the first page has one URL
	 * rather than two competing for the same content.
	 */
	let { basePath, page, pages }: { basePath: string; page: number; pages: number } = $props();
</script>

{#if pages > 1}
	<nav class="pagination" aria-label="Pagination">
		{#if page > 1}
			<a rel="prev" href={paged(basePath, page - 1)}>← {m.pagination_prev()}</a>
		{:else}
			<span></span>
		{/if}

		<span class="pagination__status">{m.pagination_page({ page, total: pages })}</span>

		{#if page < pages}
			<a rel="next" href={paged(basePath, page + 1)}>{m.pagination_next()} →</a>
		{:else}
			<span></span>
		{/if}
	</nav>
{/if}

<style>
	.pagination {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		margin: 3rem 0 0;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}
	.pagination a {
		display: inline-block;
		padding: 0.4375rem 0.875rem;
		border-radius: var(--r-md);
		background: var(--surface-2);
		text-decoration: none;
		transition: background var(--dur) var(--ease);
	}
	.pagination a:hover {
		background: var(--accent-tint);
	}
	.pagination > :last-child {
		justify-self: end;
	}
	.pagination__status {
		color: var(--text-3);
		font-size: 0.8125rem;
	}
</style>
