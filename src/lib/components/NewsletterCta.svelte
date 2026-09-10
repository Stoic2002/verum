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
		position: relative;
		padding: 2rem;
		border-radius: var(--r-xl);
		background: var(--surface-2);
		border: 1px solid var(--border);
		overflow: hidden;
	}
	/* A soft accent wash in one corner, instead of a flat panel. */
	.cta::before {
		content: '';
		position: absolute;
		top: -40%;
		right: -10%;
		width: 22rem;
		height: 22rem;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--accent) 14%, transparent),
			transparent 70%
		);
		pointer-events: none;
	}
	.cta > * {
		position: relative;
	}
	.cta--compact {
		padding: 1.375rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.375rem;
		line-height: 1.25;
	}
	p {
		margin: 0 0 1.25rem;
		max-width: 30rem;
		color: var(--text-2);
		font-size: 0.9375rem;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	input:not(.visually-hidden) {
		flex: 1;
		min-width: 13rem;
		padding: 0.6875rem 0.9375rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 0.9375rem;
		transition:
			border-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	input:not(.visually-hidden):focus {
		border-color: var(--accent);
		outline: none;
		box-shadow: 0 0 0 3px var(--accent-tint);
	}
	button {
		padding: 0.6875rem 1.375rem;
		border: 0;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-contrast);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: var(--weight-strong);
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	button:hover {
		background: var(--accent-hover);
		box-shadow: var(--shadow-accent);
	}
	button:active {
		transform: translateY(1px);
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
