<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/forms.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

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

	// Admin copy is not translated: it has exactly one reader (PRD §8.2).
	// Entries are added as each phase ships a real route — a nav that links to
	// pages that do not exist yet is just a list of 404s.
	const nav = [
		{ href: resolve('/admin'), label: 'Dashboard' },
		{ href: resolve('/(admin)/admin/(app)/articles'), label: 'Articles' },
		{ href: resolve('/(admin)/admin/(app)/media'), label: 'Media' },
		{ href: resolve('/(admin)/admin/(app)/topics'), label: 'Topics' },
		{ href: resolve('/(admin)/admin/(app)/taxonomy'), label: 'Categories & tags' },
		{ href: resolve('/(admin)/admin/(app)/redirects'), label: 'Redirects' },
		{ href: resolve('/(admin)/admin/(app)/mail'), label: 'Dev inbox' }
	];

	const isCurrent = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<div class="shell" class:shell--collapsed={collapsed}>
	<aside>
		<div class="top">
			<a class="brand" href={resolve('/admin')}>VERUM</a>

			<button
				type="button"
				class="collapse"
				onclick={toggle}
				aria-expanded={!collapsed}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
					<rect
						x="1.75"
						y="2.75"
						width="12.5"
						height="10.5"
						rx="2"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
					/>
					<line x1="6.25" y1="2.75" x2="6.25" y2="13.25" stroke="currentColor" stroke-width="1.4" />
				</svg>
			</button>
		</div>

		<nav>
			{#each nav as item (item.href)}
				<a
					href={item.href}
					title={collapsed ? item.label : undefined}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
				>
					<span class="dot" aria-hidden="true">{item.label.charAt(0)}</span>
					<span class="label">{item.label}</span>
				</a>
			{/each}
		</nav>

		<form method="POST" action="/admin/logout" class="account">
			<span class="label" title={data.user.email}>{data.user.email}</span>
			<button type="submit" class="btn btn--secondary btn--sm" title="Sign out">
				<span class="label">Sign out</span>
				<span class="dot" aria-hidden="true">→</span>
			</button>
		</form>
	</aside>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 15rem 1fr;
		transition: grid-template-columns var(--dur) var(--ease);
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
	}
	aside {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding: 1.25rem 1rem;
		border-right: 1px solid var(--border);
		background: var(--surface);
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.shell--collapsed {
		grid-template-columns: 3.75rem 1fr;
	}
	/* Everything that only makes sense with room for it. */
	.shell--collapsed .label {
		display: none;
	}
	.shell--collapsed .brand {
		font-size: 0;
		gap: 0;
	}
	.shell--collapsed .top {
		flex-direction: column;
		gap: 0.75rem;
	}
	.shell--collapsed nav a {
		justify-content: center;
	}
	.shell--collapsed .dot {
		display: inline-flex;
	}
	.shell--collapsed .account {
		justify-items: center;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.collapse {
		min-height: 1.875rem;
		padding: 0.3125rem;
		border: 0;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}
	.collapse:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	/* The bar flips to show which side folds away. */
	.shell--collapsed .collapse svg {
		transform: scaleX(-1);
	}

	.dot {
		display: none;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		font-weight: var(--weight-strong);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.5rem;
		color: var(--text);
		font-weight: var(--weight-strong);
		letter-spacing: 0.16em;
		text-decoration: none;
	}
	.brand::before {
		content: '';
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		background: var(--accent);
	}
	nav {
		display: grid;
		gap: 0.125rem;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4375rem 0.5rem;
		border-radius: var(--r-md);
		color: var(--text-2);
		text-decoration: none;
		font-size: 0.875rem;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	nav a:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	nav a[aria-current='page'] {
		background: var(--accent-tint);
		color: var(--accent);
		font-weight: var(--weight-strong);
	}
	.account {
		margin-top: auto;
		display: grid;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}
	.account span {
		padding: 0 0.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	main :global(.notice) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.75rem;
		padding: 0.5625rem 0.875rem;
		border-radius: var(--r-md);
		background: var(--success-tint);
		color: var(--success);
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

	@media (max-width: 60rem) {
		.shell {
			grid-template-columns: 1fr;
		}
		/* The collapse control is for the desktop rail; the bar is horizontal here. */
		.collapse {
			display: none;
		}
		.shell--collapsed {
			grid-template-columns: 1fr;
		}
		.shell--collapsed .label {
			display: inline;
		}
		.shell--collapsed .dot {
			display: none;
		}
		aside {
			position: static;
			height: auto;
			border-right: 0;
			border-bottom: 1px solid var(--border);
			flex-direction: row;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.75rem 1rem;
		}
		nav {
			display: flex;
			flex-wrap: wrap;
			flex: 1;
		}
		.account {
			margin-top: 0;
			grid-auto-flow: column;
			align-items: center;
		}
		main {
			padding: 1.5rem 1.125rem 3rem;
		}
	}
</style>
