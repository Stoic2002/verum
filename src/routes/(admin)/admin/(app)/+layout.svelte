<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	// Admin copy is not translated: it has exactly one reader (PRD §8.2).
	// Entries are added as each phase ships a real route — a nav that links to
	// pages that do not exist yet is just a list of 404s.
	const nav = [{ href: resolve('/admin'), label: 'Dashboard' }];

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
