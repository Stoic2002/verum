<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';

	let { data } = $props();
	const locale = getLocale();
	const ok = $derived(data.result === 'confirmed' || data.result === 'already-confirmed');
</script>

<svelte:head>
	<title>{ok ? m.newsletter_confirmed() : m.newsletter_invalid()} — VERUM</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="wrap" data-result={data.result}>
	<h1>{ok ? m.newsletter_confirmed() : m.newsletter_invalid()}</h1>
	<p>{ok ? m.newsletter_confirmed_body() : m.newsletter_invalid_body()}</p>
	<p><a href={urls.home(locale)}>{m.nav_home()}</a></p>
</div>

<style>
	.wrap {
		max-width: var(--measure);
		margin: 0 auto;
		padding: 3rem 0;
	}
	h1 {
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
</style>
