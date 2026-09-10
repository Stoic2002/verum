<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const STATUSES = ['', 'draft', 'scheduled', 'published', 'archived'];

	const when = (value: string | Date | null) =>
		value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : '—';
</script>

<svelte:head><title>Articles · VERUM</title></svelte:head>

<header class="head">
	<h1>Articles</h1>
	<a class="button" href={resolve('/(admin)/admin/(app)/articles/new')}>New article</a>
</header>

<form class="filters" method="GET">
	<input type="search" name="q" placeholder="Search titles" value={data.search} />
	<select name="status">
		{#each STATUSES as status (status)}
			<option value={status} selected={status === data.status}>{status || 'All statuses'}</option>
		{/each}
	</select>
	<button type="submit">Filter</button>
</form>

{#if data.articles.length === 0}
	<p class="empty">No articles yet.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Title</th>
				<th>Category</th>
				<th>Locales</th>
				<th>Status</th>
				<th>Updated</th>
			</tr>
		</thead>
		<tbody>
			{#each data.articles as article (article.id)}
				<tr>
					<td>
						<a href={resolve('/(admin)/admin/(app)/articles/[id]', { id: String(article.id) })}>
							{article.locales[0]?.title ?? `Untitled #${article.id}`}
						</a>
						{#if article.is_living}<span class="pill">living</span>{/if}
					</td>
					<td>{article.category_slug}</td>
					<td class="locales">
						{#each article.locales as locale (locale.locale)}
							<span class="pill">{locale.locale}</span>
						{/each}
					</td>
					<td><span class="status status--{article.status}">{article.status}</span></td>
					<td class="num">{when(article.updated_at)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0 1.5rem;
	}
	.filters input {
		flex: 1;
		max-width: 20rem;
	}
	.empty {
		color: var(--text-3);
	}
	.locales {
		display: flex;
		gap: 0.25rem;
	}
	.num {
		font-variant-numeric: tabular-nums;
		color: var(--text-3);
		white-space: nowrap;
	}
	.status {
		text-transform: capitalize;
	}
	.status--published {
		color: var(--success);
	}
	.status--scheduled {
		color: var(--accent);
	}
	.status--archived {
		color: var(--text-3);
	}
</style>
