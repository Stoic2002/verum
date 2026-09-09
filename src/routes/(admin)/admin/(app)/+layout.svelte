<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	// Admin copy is not translated: it has exactly one reader (PRD §8.2).
	// Entries are added as each phase ships a real route — a nav that links to
	// pages that do not exist yet is just a list of 404s.
	const nav = [
		{ href: resolve('/admin'), label: 'Dashboard' },
		{ href: resolve('/(admin)/admin/(app)/articles'), label: 'Articles' },
		{ href: resolve('/(admin)/admin/(app)/media'), label: 'Media' },
		{ href: resolve('/(admin)/admin/(app)/taxonomy'), label: 'Categories & tags' },
		{ href: resolve('/(admin)/admin/(app)/redirects'), label: 'Redirects' }
	];

	const isCurrent = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<div class="shell">
	<aside>
		<a class="brand" href={resolve('/admin')}>VERUM</a>

		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
		</nav>

		<form method="POST" action="/admin/logout" class="account">
			<span title={data.user.email}>{data.user.email}</span>
			<button type="submit">Sign out</button>
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
		min-height: 100vh;
		font-family: system-ui, sans-serif;
		color: #111;
	}
	aside {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.25rem;
		border-right: 1px solid #e5e5e5;
		background: #fafafa;
	}
	.brand {
		font-weight: 700;
		letter-spacing: 0.08em;
		text-decoration: none;
		color: inherit;
	}
	nav {
		display: grid;
		gap: 0.125rem;
	}
	nav a {
		padding: 0.375rem 0.5rem;
		border-radius: 4px;
		color: #444;
		text-decoration: none;
		font-size: 0.875rem;
	}
	nav a[aria-current='page'] {
		background: #111;
		color: #fff;
	}
	.account {
		margin-top: auto;
		display: grid;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: #666;
	}
	.account span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.account button {
		padding: 0.375rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #fff;
		font: inherit;
		cursor: pointer;
	}
	main {
		padding: 1.75rem 2rem;
	}
	/* Shared admin chrome. Defined once here rather than repeated per page. */
	main :global(h1) {
		margin: 0 0 0.25rem;
		font-size: 1.375rem;
	}
	main :global(.meta) {
		color: #666;
		font-size: 0.8125rem;
		font-weight: 400;
	}
	main :global(.stack) {
		display: grid;
		gap: 0.375rem;
		max-width: 46rem;
	}
	main :global(.stack > label) {
		margin-top: 0.625rem;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	main :global(input),
	main :global(select),
	main :global(textarea) {
		padding: 0.4375rem 0.5625rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font: inherit;
		background: #fff;
		color: inherit;
	}
	main :global(textarea) {
		font-family: inherit;
		line-height: 1.6;
	}
	main :global(button),
	main :global(.button) {
		padding: 0.4375rem 0.75rem;
		border: 1px solid #111;
		border-radius: 4px;
		background: #111;
		color: #fff;
		font: inherit;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
	}
	main :global(button:disabled) {
		opacity: 0.6;
		cursor: default;
	}
	main :global(button.destructive) {
		border-color: #d0d0d0;
		background: #fff;
		color: #b00020;
	}
	main :global(.check) {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.875rem;
		font-weight: 400;
	}
	main :global(.check input) {
		width: auto;
	}
	main :global(.error) {
		margin: 0;
		color: #b00020;
		font-size: 0.8125rem;
	}
	main :global(.notice) {
		margin: 0 0 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		background: #eef6ee;
		font-size: 0.8125rem;
	}
	main :global(.pill) {
		display: inline-block;
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		background: #eee;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	main :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}
	main :global(th) {
		text-align: left;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #666;
	}
	main :global(th),
	main :global(td) {
		padding: 0.5rem 0.5rem 0.5rem 0;
		border-bottom: 1px solid #eee;
		vertical-align: top;
	}
	main :global(code) {
		font-size: 0.8125rem;
		background: #f3f3f3;
		padding: 0.0625rem 0.25rem;
		border-radius: 3px;
	}
	main :global(details summary) {
		cursor: pointer;
		font-size: 0.875rem;
		margin-top: 0.75rem;
	}

	@media (max-width: 48rem) {
		.shell {
			grid-template-columns: 1fr;
		}
		aside {
			border-right: 0;
			border-bottom: 1px solid #e5e5e5;
		}
	}
</style>
