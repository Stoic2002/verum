<script lang="ts">
	/** A generic admin page shape: heading, a row of figures, a table. */
</script>

<div class="skeleton" aria-busy="true" role="status">
	<span class="visually-hidden">Loading…</span>
	<div class="sk sk--title"></div>
	<div class="sk sk--line" style="width: 40%"></div>
	<div class="stats">
		{#each [0, 1, 2, 3] as index (index)}<div class="sk sk--stat"></div>{/each}
	</div>
	{#each [0, 1, 2, 3, 4, 5] as index (index)}
		<div class="sk sk--row"></div>
	{/each}
</div>

<style>
	.sk {
		border-radius: var(--r-md);
		background: linear-gradient(
			90deg,
			var(--surface-2) 0%,
			var(--surface-3) 50%,
			var(--surface-2) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	@keyframes shimmer {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk {
			animation: none;
		}
	}
	.sk--title {
		width: 14rem;
		height: 2rem;
		margin-bottom: 0.75rem;
	}
	.sk--line {
		height: 0.875rem;
		margin-bottom: 1.5rem;
	}
	.stats {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	}
	.sk--stat {
		height: 5rem;
	}
	.sk--row {
		height: 2.75rem;
		margin-bottom: 0.5rem;
	}
</style>
