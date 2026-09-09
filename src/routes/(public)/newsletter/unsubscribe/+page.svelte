<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';

	let { data, form } = $props();
	const locale = getLocale();
</script>

<svelte:head>
	<title>{m.newsletter_unsubscribed()} — VERUM</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="wrap">
	{#if form?.done}
		<h1 data-result="unsubscribed">{m.newsletter_unsubscribed()}</h1>
		<p>{m.newsletter_unsubscribed_body()}</p>
	{:else if data.valid}
		<h1>{m.newsletter_unsubscribed()}?</h1>
		<p>{data.email}</p>
		<form method="POST">
			<input type="hidden" name="email" value={data.email} />
			<input type="hidden" name="signature" value={data.signature} />
			<button type="submit">{m.newsletter_unsubscribe_confirm()}</button>
		</form>
	{:else}
		<h1>{m.newsletter_invalid()}</h1>
		<p>{m.newsletter_invalid_body()}</p>
	{/if}

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
	button {
		padding: 0.5rem 0.875rem;
		border: 0;
		border-radius: 6px;
		background: var(--text);
		color: var(--bg);
		font: inherit;
		cursor: pointer;
	}
</style>
