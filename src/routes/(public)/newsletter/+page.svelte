<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import NewsletterCta from '$lib/components/NewsletterCta.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>{m.newsletter_heading()} — VERUM</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="wrap">
	{#if form?.state === 'pending'}
		<h1>{m.newsletter_check_inbox()}</h1>
		<p>{m.newsletter_check_body({ email: form.email })}</p>
	{:else}
		{#if form?.state === 'invalid-email'}
			<p class="error" role="alert">{m.newsletter_error_email()}</p>
		{:else if form?.state === 'rate-limited'}
			<p class="error" role="alert">{m.newsletter_error_rate()}</p>
		{/if}
		<NewsletterCta />
	{/if}
</div>

<style>
	.wrap {
		max-width: var(--measure);
		margin: 0 auto;
		padding: 2rem 0;
	}
	h1 {
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.error {
		margin-bottom: 1rem;
		color: #b91c1c;
		font-size: 0.9375rem;
	}
</style>
