<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	/**
	 * The shape of the page being loaded, shimmering, while its data is on the
	 * way. Shapes follow the real layouts closely enough that the content lands
	 * where the eye already is.
	 */
	let { routeId }: { routeId: string | null } = $props();

	const kind = $derived(
		routeId === '/(public)'
			? 'home'
			: routeId === '/(public)/[category]/[slug]'
				? 'article'
				: routeId === '/(public)/[category]' ||
					  routeId === '/(public)/topic/[slug]' ||
					  routeId === '/(public)/tag/[slug]' ||
					  routeId === '/(public)/search'
					? 'listing'
					: 'page'
	);
</script>

<div class="skeleton skeleton--{kind}" aria-busy="true" role="status">
	<span class="visually-hidden">{m.loading()}</span>

	{#if kind === 'home'}
		<div class="split">
			<div>
				<div class="sk sk--image sk--wide"></div>
				<div class="sk sk--line" style="width: 30%"></div>
				<div class="sk sk--title" style="width: 85%"></div>
				<div class="sk sk--line" style="width: 70%"></div>
				<div class="cards">
					{#each [0, 1, 2] as index (index)}
						<div>
							<div class="sk sk--image"></div>
							<div class="sk sk--line" style="width: 90%"></div>
							<div class="sk sk--line" style="width: 60%"></div>
						</div>
					{/each}
				</div>
			</div>
			<div class="sk sk--panel"></div>
		</div>
	{:else if kind === 'article'}
		<div class="split">
			<div class="measure">
				<div class="sk sk--line" style="width: 20%"></div>
				<div class="sk sk--title" style="width: 95%"></div>
				<div class="sk sk--title" style="width: 60%"></div>
				<div class="sk sk--line" style="width: 80%"></div>
				<div class="sk sk--image sk--wide"></div>
				{#each [96, 100, 88, 92, 70] as width, index (index)}
					<div class="sk sk--line" style="width: {width}%"></div>
				{/each}
			</div>
			<div class="sk sk--panel"></div>
		</div>
	{:else if kind === 'listing'}
		<div class="sk sk--title" style="width: 30%"></div>
		<div class="sk sk--line" style="width: 55%"></div>
		<div class="chips">
			{#each [0, 1, 2, 3] as index (index)}<div class="sk sk--chip"></div>{/each}
		</div>
		<div class="split">
			<div>
				{#each [0, 1, 2, 3] as index (index)}
					<div class="row">
						<div class="sk sk--thumb"></div>
						<div>
							<div class="sk sk--line" style="width: 25%"></div>
							<div class="sk sk--line sk--strong" style="width: 85%"></div>
							<div class="sk sk--line" style="width: 65%"></div>
						</div>
					</div>
				{/each}
			</div>
			<div class="sk sk--panel"></div>
		</div>
	{:else}
		<div class="measure">
			<div class="sk sk--title" style="width: 45%"></div>
			{#each [100, 94, 98, 80, 96, 60] as width, index (index)}
				<div class="sk sk--line" style="width: {width}%"></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.skeleton {
		min-height: 60vh;
	}
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
	/* Still shows the shape, without the motion. */
	@media (prefers-reduced-motion: reduce) {
		.sk {
			animation: none;
		}
	}
	.sk--line {
		height: 0.875rem;
		margin: 0.75rem 0;
	}
	.sk--strong {
		height: 1.125rem;
	}
	.sk--title {
		height: 2.25rem;
		margin: 0.875rem 0;
	}
	.sk--image {
		aspect-ratio: 16 / 10;
		margin-bottom: 0.75rem;
		border-radius: var(--r-lg);
	}
	.sk--wide {
		aspect-ratio: 16 / 9;
		margin: 1.25rem 0;
	}
	.sk--panel {
		height: 22rem;
		border-radius: var(--r-lg);
	}
	.sk--chip {
		width: 5rem;
		height: 1.75rem;
		border-radius: var(--r-pill);
	}
	.sk--thumb {
		aspect-ratio: 16 / 10;
		border-radius: var(--r-md);
	}
	.split {
		display: grid;
		gap: 2.5rem;
	}
	@media (min-width: 64rem) {
		.split {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}
		.skeleton--article .split {
			grid-template-columns: minmax(0, var(--measure)) 19rem;
			justify-content: center;
		}
	}
	.measure {
		max-width: var(--measure);
	}
	.skeleton--page .measure {
		margin: 0 auto;
	}
	.cards {
		display: grid;
		gap: 1.5rem;
		margin-top: 2rem;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
	}
	.chips {
		display: flex;
		gap: 0.5rem;
		margin: 1.25rem 0 2rem;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
		gap: 1.25rem;
		padding: 1.25rem 0;
		border-bottom: 1px solid var(--border);
	}
	@media (max-width: 40rem) {
		.row {
			grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr);
		}
	}
</style>
