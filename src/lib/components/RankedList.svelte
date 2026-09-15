<script lang="ts">
	import type { ArticleLink } from '$lib/links';

	/**
	 * A short numbered list of articles — trending, most read, related.
	 * `numbered` off gives the same rhythm without implying a ranking.
	 */
	let {
		title,
		items,
		numbered = true
	}: { title: string; items: ArticleLink[]; numbered?: boolean } = $props();
</script>

{#if items.length}
	<section class="ranked">
		<h2 class="eyebrow ranked__title">{title}</h2>
		<ol class="ranked__list" class:ranked__list--plain={!numbered}>
			{#each items as item, index (item.id)}
				<li>
					{#if numbered}<span class="ranked__rank" aria-hidden="true">{index + 1}</span>{/if}
					<div>
						{#if item.label}<span class="ranked__label">{item.label}</span>{/if}
						<a href={item.href}>{item.title}</a>
					</div>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.ranked {
		padding: 1.125rem 1.25rem;
		border-radius: var(--r-lg);
		background: var(--surface-2);
	}
	.ranked__title {
		margin: 0 0 0.875rem;
	}
	.ranked__list {
		display: grid;
		gap: 0.875rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: start;
	}
	.ranked__list--plain li {
		grid-template-columns: 1fr;
	}
	li + li {
		padding-top: 0.875rem;
		border-top: 1px solid var(--border);
	}
	.ranked__rank {
		min-width: 1.25ch;
		color: var(--accent);
		font-size: 1.5rem;
		font-weight: var(--weight-display);
		line-height: 1;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}
	.ranked__label {
		display: block;
		margin-bottom: 0.125rem;
		color: var(--text-3);
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	a {
		color: var(--text);
		font-size: 0.9375rem;
		font-weight: var(--weight-strong);
		line-height: 1.35;
		text-decoration: none;
	}
	a:hover {
		color: var(--accent);
	}
</style>
