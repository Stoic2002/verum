<script lang="ts">
	/**
	 * Page links for an admin list.
	 *
	 * Links, not buttons, and not an infinite scroll. A management list is
	 * navigated: the back button has to return you to where you were, a page
	 * has to be linkable, and the end has to be reachable — all three break
	 * under infinite scroll, and bulk selection breaks with them.
	 *
	 * Preserves whatever else is in the query string, so a filter survives
	 * paging.
	 */
	let {
		page,
		pages,
		total,
		label = 'items',
		params = {}
	}: {
		page: number;
		pages: number;
		total: number;
		label?: string;
		params?: Record<string, string>;
	} = $props();

	function href(target: number) {
		const parts = Object.entries(params)
			.filter(([, value]) => value)
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
		// Page one carries no page param, so it has one URL rather than two.
		if (target > 1) parts.push(`page=${target}`);
		return parts.length ? `?${parts.join('&')}` : '?';
	}
</script>

<nav class="pager" aria-label="Pagination">
	<span class="pager__count">
		{total.toLocaleString()}
		{label}
		{#if pages > 1}· page {page} of {pages}{/if}
	</span>

	{#if pages > 1}
		<span class="pager__links">
			{#if page > 1}
				<a href={href(page - 1)} rel="prev">← Newer</a>
			{:else}
				<span class="pager__disabled">← Newer</span>
			{/if}

			{#if page < pages}
				<a href={href(page + 1)} rel="next">Older →</a>
			{:else}
				<span class="pager__disabled">Older →</span>
			{/if}
		</span>
	{/if}
</nav>

<style>
	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.8125rem;
	}
	.pager__count {
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}
	.pager__links {
		display: flex;
		gap: 0.375rem;
	}
	.pager__links a {
		padding: 0.3125rem 0.6875rem;
		border-radius: var(--r-md);
		background: var(--surface-2);
		text-decoration: none;
	}
	.pager__links a:hover {
		background: var(--accent-tint);
	}
	.pager__disabled {
		padding: 0.3125rem 0.6875rem;
		color: var(--text-3);
		opacity: 0.5;
	}
</style>
