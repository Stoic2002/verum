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
	<p class="status">{page.status}</p>
	<h1>{notFound ? m.error_404_title() : m.error_generic_title()}</h1>
	<p>{notFound ? m.error_404_body() : m.error_generic_body()}</p>
	<p><a href={urls.home(locale)}>{m.nav_home()}</a></p>
</div>

<style>
	.error {
		max-width: var(--measure);
		padding: 3rem 0;
	}
	.status {
		margin: 0;
		color: var(--text-3);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	h1 {
		margin: 0.25rem 0 0.75rem;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}
</style>
