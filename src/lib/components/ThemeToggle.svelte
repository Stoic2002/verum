<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	/**
	 * Three states, not two: light, dark, and following the system.
	 *
	 * "System" has to be a real option — a reader who switches their OS to dark
	 * at night expects the site to follow, and a two-state toggle silently opts
	 * them out of that forever the first time they touch it.
	 *
	 * The saved value is applied before first paint by the inline script in
	 * app.html; this component only writes it.
	 */
	type Theme = 'light' | 'dark' | 'system';

	let theme = $state<Theme>('system');

	$effect(() => {
		try {
			const saved = localStorage.getItem('verum-theme');
			if (saved === 'light' || saved === 'dark') theme = saved;
		} catch {
			// Storage unavailable; system it is.
		}
	});

	function apply(next: Theme) {
		theme = next;
		try {
			if (next === 'system') {
				localStorage.removeItem('verum-theme');
				delete document.documentElement.dataset.theme;
			} else {
				localStorage.setItem('verum-theme', next);
				document.documentElement.dataset.theme = next;
			}
		} catch {
			// Storage unavailable: the choice applies to this page view only.
			if (next === 'system') delete document.documentElement.dataset.theme;
			else document.documentElement.dataset.theme = next;
		}
	}
</script>

<!--
	Rendered as a group of buttons rather than a select, so it works with the
	keyboard and screen readers without any custom behaviour. The whole control
	is hidden when JavaScript is off, because it could not do anything then and
	a dead control is worse than none.
-->
<div class="theme" role="group" aria-label={m.theme_toggle()}>
	<button type="button" aria-pressed={theme === 'light'} onclick={() => apply('light')}>
		{m.theme_light()}
	</button>
	<button type="button" aria-pressed={theme === 'system'} onclick={() => apply('system')}>
		{m.theme_system()}
	</button>
	<button type="button" aria-pressed={theme === 'dark'} onclick={() => apply('dark')}>
		{m.theme_dark()}
	</button>
</div>

<style>
	/*
	 * Hidden with visibility, not display, so the control still occupies its
	 * box before the script that reveals it runs. Switching from display:none
	 * would resize the masthead at that moment — a small layout shift, but a
	 * real one, and the CLS budget is spent on things readers can see.
	 */
	.theme {
		display: inline-flex;
		visibility: hidden;
		gap: 0.125rem;
		padding: 0.1875rem;
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	:global(html.js) .theme {
		visibility: visible;
	}
	button {
		padding: 0.25rem 0.625rem;
		border: 0;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		letter-spacing: 0.02em;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	button:hover {
		color: var(--text);
	}
	button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
