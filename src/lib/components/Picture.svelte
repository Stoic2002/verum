<script lang="ts">
	/**
	 * A responsive image that cannot shift the layout.
	 *
	 * `width` and `height` are required props, not optional ones: without the
	 * intrinsic ratio the browser has nothing to reserve, and every image on the
	 * page becomes a layout shift (PRD §12.5).
	 */
	type Source = { type: string; srcset: string };

	let {
		sources = [],
		src,
		alt,
		width,
		height,
		sizes = '100vw',
		loading = 'lazy',
		fetchpriority = 'auto',
		class: className = ''
	}: {
		sources?: Source[];
		src: string;
		alt: string;
		width: number;
		height: number;
		sizes?: string;
		loading?: 'lazy' | 'eager';
		fetchpriority?: 'high' | 'low' | 'auto';
		class?: string;
	} = $props();
</script>

<picture>
	{#each sources as source (source.type)}
		<source type={source.type} srcset={source.srcset} {sizes} />
	{/each}
	<img
		{src}
		{alt}
		{width}
		{height}
		{sizes}
		{loading}
		{fetchpriority}
		decoding="async"
		class={className}
	/>
</picture>

<style>
	img {
		display: block;
		width: 100%;
		height: auto;
		background: var(--surface-2);
	}
</style>
