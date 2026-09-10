<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';

	const locale = getLocale();
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? m.error_404_title() : m.error_generic_title()} — VERUM</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="error">
	<p class="eyebrow status">{page.status}</p>
	<h1>{notFound ? m.error_404_title() : m.error_generic_title()}</h1>
	<p>{notFound ? m.error_404_body() : m.error_generic_body()}</p>
	<p><a href={urls.home(locale)}>{m.nav_home()}</a></p>
</div>

<style>
	.error {
		max-width: var(--measure);
		padding: 5rem 0;
		text-align: center;
		margin: 0 auto;
	}
	.status {
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	h1 {
		margin: 0.75rem 0 0.75rem;
		font-size: clamp(1.875rem, 1.4rem + 2.4vw, 2.75rem);
		letter-spacing: -0.03em;
	}
	.error p:not(.status) {
		color: var(--text-2);
	}
</style>
