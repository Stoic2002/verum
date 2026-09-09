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
	.theme {
		display: none;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 999px;
	}
	:global(html.js) .theme {
		display: inline-flex;
	}
	button {
		padding: 0.1875rem 0.5rem;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		background: var(--surface-2);
		color: var(--text);
	}
</style>
