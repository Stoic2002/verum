<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/forms.css';
	import {
		ArrowRightLeft,
		FileText,
		Image,
		Inbox,
		Layers,
		LayoutDashboard,
		LogOut,
		PanelLeftClose,
		PanelLeftOpen,
		Sparkles,
		Tags
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ConfirmButton, Toaster } from '$lib/components/ui';
	import { toast } from '$lib/toast.svelte';

	let { data, children } = $props();

	/**
	 * Seeded from the cookie the server read, so the first paint is already the
	 * right width. The POST only records the change for next time.
	 */
	// svelte-ignore state_referenced_locally
	let collapsed = $state(data.sidebarCollapsed);

	function toggle() {
		collapsed = !collapsed;
		void fetch('/admin/sidebar', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ collapsed })
		}).catch(() => {
			// Cookie not saved; the sidebar still works, it just forgets.
		});
	}

	// A flash is shown once per id: layout data is re-delivered on every
	// invalidation, and the same message must not pop up again each time.
	let shownFlash = '';
	$effect(() => {
		if (data.flash && data.flash.id !== shownFlash) {
			shownFlash = data.flash.id;
			toast(data.flash.type, data.flash.message);
		}
	});

	// Admin copy is not translated: it has exactly one reader (PRD §8.2).
	// Entries are added as each phase ships a real route — a nav that links to
	// pages that do not exist yet is just a list of 404s.
	const nav = [
		{ href: resolve('/admin'), label: 'Dashboard', icon: LayoutDashboard },
		{ href: resolve('/(admin)/admin/(app)/articles'), label: 'Articles', icon: FileText },
		{ href: resolve('/(admin)/admin/(app)/ai'), label: 'AI writer', icon: Sparkles },
		{ href: resolve('/(admin)/admin/(app)/media'), label: 'Media', icon: Image },
		{ href: resolve('/(admin)/admin/(app)/topics'), label: 'Topics', icon: Layers },
		{ href: resolve('/(admin)/admin/(app)/taxonomy'), label: 'Categories & tags', icon: Tags },
		{ href: resolve('/(admin)/admin/(app)/redirects'), label: 'Redirects', icon: ArrowRightLeft },
		{ href: resolve('/(admin)/admin/(app)/mail'), label: 'Dev inbox', icon: Inbox }
	];

	const isCurrent = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<div class="shell" class:shell--collapsed={collapsed}>
	<aside>
		<div class="top">
			<a class="brand" href={resolve('/admin')} title={collapsed ? 'VERUM' : undefined}>
				<span class="mark" aria-hidden="true">V</span>
				<span class="label">VERUM</span>
			</a>

			<button
				type="button"
				class="unstyled item item--icon collapse"
				onclick={toggle}
				aria-expanded={!collapsed}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{#if collapsed}
					<PanelLeftOpen size={18} aria-hidden="true" />
				{:else}
					<PanelLeftClose size={18} aria-hidden="true" />
				{/if}
			</button>
		</div>

		<nav>
			{#each nav as item (item.href)}
				<a
					class="item"
					href={item.href}
					title={collapsed ? item.label : undefined}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
				>
					<item.icon size={18} aria-hidden="true" />
					<span class="label">{item.label}</span>
				</a>
			{/each}
		</nav>

		<div class="account">
			<span class="label email" title={data.user.email}>{data.user.email}</span>
			<form method="POST" action="/admin/logout">
				<ConfirmButton
					class="unstyled item"
					hint={collapsed ? 'Sign out' : undefined}
					title="Sign out?"
					message="You will need your password to get back in. Anything unsaved on this page is lost."
					confirmLabel="Sign out"
					tone="neutral"
				>
					<LogOut size={18} aria-hidden="true" />
					<span class="label">Sign out</span>
				</ConfirmButton>
			</form>
		</div>
	</aside>

	<main>
		{@render children()}
	</main>
</div>

<Toaster />

<style>
	.shell {
		display: grid;
		grid-template-columns: 15rem 1fr;
		transition: grid-template-columns var(--dur) var(--ease);
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
	}
	/*
	 * The geometry that keeps the rail symmetrical.
	 *
	 * The folded rail is 3.75rem; 0.75rem of padding on each side leaves exactly
	 * one 2.25rem square. Every row — brand, toggle, nav links, sign-out — is
	 * built on that square and uses the same inner inset, so all the icons share
	 * one vertical axis in both states and do not move when the rail folds.
	 */
	aside {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1rem 0.75rem;
		border-right: 1px solid var(--border);
		background: var(--surface);
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-x: hidden;
		overflow-y: auto;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.25rem;
		padding: 0 0.3125rem;
		border-radius: var(--r-md);
		color: var(--text);
		font-weight: var(--weight-strong);
		letter-spacing: 0.16em;
		text-decoration: none;
		white-space: nowrap;
	}
	.mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.625rem;
		height: 1.625rem;
		border-radius: var(--r-sm);
		background: var(--accent);
		color: var(--accent-contrast);
		font-size: 0.8125rem;
		letter-spacing: 0;
	}

	nav {
		display: grid;
		gap: 0.125rem;
	}

	/* Shared by links and buttons, and by the button inside ConfirmButton. */
	aside :global(.item) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 2.25rem;
		/* (2.25rem − 18px icon) / 2: the icon is centred in the square. */
		padding: 0 0.5625rem;
		border: 0;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	aside :global(.item svg) {
		flex: none;
	}
	aside :global(.item:hover) {
		background: var(--surface-2);
		color: var(--text);
	}
	aside :global(.item:focus-visible) {
		outline: none;
		box-shadow: var(--ring);
	}
	aside :global(.item[aria-current='page']) {
		background: var(--accent-tint);
		color: var(--accent);
		font-weight: var(--weight-strong);
	}
	/* Beats `aside :global(.item)`, whose width: 100% would push it off the rail. */
	aside .item.item--icon {
		flex: none;
		width: 2.25rem;
		justify-content: center;
		padding: 0;
		color: var(--text-3);
	}

	.account {
		margin-top: auto;
		display: grid;
		gap: 0.375rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}
	.email {
		padding: 0 0.5625rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	/* Folding only exists for the desktop rail. */
	@media (width > 60rem) {
		.shell--collapsed {
			grid-template-columns: 3.75rem 1fr;
		}
		/*
		 * Visually hidden rather than display:none: a folded link still needs
		 * its name for screen readers, and for the e2e suite's role queries.
		 */
		.shell--collapsed .label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.shell--collapsed .top {
			flex-direction: column;
			align-items: flex-start;
		}
		.shell--collapsed .brand,
		.shell--collapsed aside :global(.item) {
			width: 2.25rem;
			gap: 0;
		}
		.shell--collapsed .brand {
			padding: 0 0.3125rem;
		}
	}

	main {
		padding: 2rem 2.25rem 4rem;
		min-width: 0;
	}

	/* ── Shared admin chrome ──────────────────────────────────────────── */

	main :global(h1) {
		margin: 0 0 0.375rem;
		font-size: 1.5rem;
		letter-spacing: var(--track-display);
	}
	main :global(.meta) {
		color: var(--text-3);
		font-size: 0.8125rem;
		font-weight: var(--weight-body);
		line-height: 1.55;
	}
	main :global(.stack) {
		display: grid;
		gap: 0.375rem;
		max-width: 46rem;
	}
	main :global(.stack > label) {
		margin-top: 0.625rem;
		font-size: 0.8125rem;
		font-weight: var(--weight-strong);
	}
	main :global(.error) {
		margin: 0;
		color: var(--danger);
		font-size: 0.8125rem;
	}
	main :global(.empty) {
		color: var(--text-3);
	}
	main :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}
	main :global(th) {
		text-align: left;
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
		color: var(--text-3);
	}
	main :global(th),
	main :global(td) {
		padding: 0.625rem 0.625rem 0.625rem 0;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	main :global(tbody tr:hover) {
		background: var(--surface-2);
	}
	main :global(code) {
		padding: 0.0625rem 0.3125rem;
		border-radius: var(--r-sm);
		background: var(--surface-3);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
	}
	main :global(details summary) {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: var(--weight-strong);
		margin-top: 0.75rem;
		padding: 0.4375rem 0;
	}
	main :global(.num) {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Phones and tablets: a header with brand, wrapping nav chips, then the account row. */
	@media (max-width: 60rem) {
		.shell,
		.shell--collapsed {
			grid-template-columns: 1fr;
		}
		aside {
			position: static;
			height: auto;
			overflow: visible;
			gap: 0.625rem;
			padding: 0.75rem 1rem;
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}
		/* Folding is a desktop rail feature. Specific enough to beat .item's display. */
		aside .item.collapse {
			display: none;
		}
		nav {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}
		aside :global(.item) {
			width: auto;
			gap: 0.5rem;
		}
		.account {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			margin-top: 0;
			padding-top: 0.5rem;
		}
		main {
			padding: 1.5rem 1.125rem 3rem;
		}
	}
</style>
