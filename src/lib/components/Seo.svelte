<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import { hreflangLinks, type SeoData } from '$lib/seo';

	/**
	 * Every head tag a page needs, in one place.
	 *
	 * Routes pass already-clamped strings; this component only renders. Keeping
	 * the rules in $lib/seo.ts rather than here means they can be unit tested
	 * without mounting anything.
	 */
	let { seo }: { seo: SeoData } = $props();

	const locale = getLocale();
	const links = $derived(hreflangLinks(seo.canonical, seo.alternates, locale));

	const CLOSE = `</${'script'}>`;

	const jsonLdTag = (node: Record<string, unknown>) =>
		`<script type="application/ld+json">${JSON.stringify(node).replace(/</g, '\\u003c')}${CLOSE}`;
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />

	{#if seo.noindex}
		<meta name="robots" content="noindex, follow" />
	{:else}
		<!-- Canonical points at this locale's own URL, never at the English one. -->
		<link rel="canonical" href={seo.canonical} />

		{#each links as link (link.hreflang)}
			<link rel="alternate" hreflang={link.hreflang} href={link.href} />
		{/each}
	{/if}

	<meta property="og:type" content={seo.type ?? 'website'} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:url" content={seo.canonical} />
	<meta property="og:locale" content={locale} />
	{#each seo.alternates.filter((a) => a.locale !== locale) as alternate (alternate.locale)}
		<meta property="og:locale:alternate" content={alternate.locale} />
	{/each}

	{#if seo.image}
		<meta property="og:image" content={seo.image.url} />
		<meta property="og:image:width" content={String(seo.image.width)} />
		<meta property="og:image:height" content={String(seo.image.height)} />
		<meta property="og:image:alt" content={seo.image.alt} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}

	{#if seo.type === 'article'}
		{#if seo.publishedAt}
			<meta property="article:published_time" content={seo.publishedAt} />
		{/if}
		{#if seo.modifiedAt}
			<meta property="article:modified_time" content={seo.modifiedAt} />
		{/if}
	{/if}

	{#each seo.jsonLd ?? [] as node, index (index)}
		<!--
			Built by src/lib/server/jsonld.ts from the same values the page renders.

			Every `<` in the payload becomes \u003c — still valid JSON, and the only
			sequence that could otherwise close this block early and turn structured
			data into an injection point.

			The closing tag is assembled from two halves so neither the Svelte
			compiler nor the linter sees a stray `</script`+`>` inside a string.
		-->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLdTag(node)}
	{/each}
</svelte:head>
