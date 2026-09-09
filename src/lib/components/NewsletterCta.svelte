<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * Signup form. Posts to /{locale}/newsletter, which starts the double opt-in
	 * flow: nothing is on the list until the emailed link is clicked.
	 */
	let { compact = false }: { compact?: boolean } = $props();

	const locale = getLocale();
</script>

<section class="cta" class:cta--compact={compact}>
	<h2>{m.newsletter_heading()}</h2>
	<p>{m.newsletter_body()}</p>

	<form method="POST" action="/{locale}/newsletter" aria-describedby="newsletter-note">
		<!--
			Honeypot. A hidden field real people never fill in, and cheaper than a
			CAPTCHA for a form this size. aria-hidden and tabindex keep it away from
			assistive technology, which would otherwise announce a field nobody
			should complete.
		-->
		<input
			class="visually-hidden"
			type="text"
			name="website"
			tabindex="-1"
			autocomplete="off"
			aria-hidden="true"
		/>

		<label class="visually-hidden" for="newsletter-email">{m.newsletter_email()}</label>
		<input
			id="newsletter-email"
			name="email"
			type="email"
			autocomplete="email"
			placeholder={m.newsletter_email()}
			required
		/>
		<button type="submit">{m.newsletter_submit()}</button>
	</form>
</section>

<style>
	.cta {
		padding: 1.5rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
	}
	.cta--compact {
		padding: 1.125rem;
	}
	h2 {
		margin: 0 0 0.375rem;
		font-size: 1.0625rem;
		line-height: 1.3;
	}
	p {
		margin: 0 0 1rem;
		color: var(--text-2);
		font-size: 0.875rem;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		min-width: 12rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 0.875rem;
	}
	button {
		padding: 0.5rem 0.875rem;
		border: 0;
		border-radius: 6px;
		background: var(--text);
		color: var(--bg);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
