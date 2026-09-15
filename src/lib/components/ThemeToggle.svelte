<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	/**
	 * One switch: light or dark.
	 *
	 * Until the reader touches it the site follows the system setting, and the
	 * switch shows whichever that currently is — including when the system flips
	 * at sunset. Touching it saves an explicit choice, which app.html applies
	 * before first paint on the next visit.
	 */
	let dark = $state(false);

	$effect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const sync = () => {
			const explicit = document.documentElement.dataset.theme;
			dark = explicit ? explicit === 'dark' : media.matches;
		};
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});

	function toggle() {
		const next = dark ? 'light' : 'dark';
		dark = next === 'dark';
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('verum-theme', next);
		} catch {
			// Storage unavailable: the choice applies to this page view only.
		}
	}
</script>

<!--
	A real switch for assistive technology (role="switch" + aria-checked), and
	hidden until JavaScript runs, because without it the control could do nothing.
-->
<button
	type="button"
	class="theme"
	class:theme--dark={dark}
	role="switch"
	aria-checked={dark}
	aria-label={m.theme_dark_mode()}
	title={m.theme_dark_mode()}
	onclick={toggle}
>
	<span class="track" aria-hidden="true">
		<svg class="glyph glyph--sun" viewBox="0 0 24 24" width="12" height="12">
			<circle cx="12" cy="12" r="4" fill="currentColor" />
			<path
				d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
		<svg class="glyph glyph--moon" viewBox="0 0 24 24" width="12" height="12">
			<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" fill="currentColor" />
		</svg>
		<span class="thumb"></span>
	</span>
</button>

<style>
	/*
	 * Hidden with visibility, not display, so the switch holds its box before
	 * the script that reveals it runs — no layout shift in the masthead.
	 */
	.theme {
		visibility: hidden;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		border-radius: var(--r-pill);
	}
	:global(html.js) .theme {
		visibility: visible;
	}
	.track {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 3.25rem;
		height: 1.75rem;
		padding: 0 0.4375rem;
		border-radius: var(--r-pill);
		background: var(--surface-3);
		box-shadow: inset 0 0 0 1px var(--border);
		transition: background var(--dur) var(--ease);
	}
	.glyph {
		position: relative;
		z-index: 0;
		color: var(--text-3);
		transition: color var(--dur) var(--ease);
	}
	.thumb {
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: var(--r-pill);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		transition: transform 220ms var(--ease);
	}
	/* The icon under the thumb is the current mode; it sits above the thumb. */
	.glyph--sun {
		z-index: 1;
		color: hsl(38 92% 50%);
	}
	.theme--dark .track {
		background: var(--accent-tint-strong);
	}
	.theme--dark .thumb {
		transform: translateX(1.5rem);
	}
	.theme--dark .glyph--sun {
		z-index: 0;
		color: var(--text-3);
	}
	.theme--dark .glyph--moon {
		z-index: 1;
		color: var(--accent);
	}
	.theme:hover .track {
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
