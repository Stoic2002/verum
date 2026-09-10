<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<svelte:head><title>Topics · VERUM</title></svelte:head>

<h1>Topics</h1>
<p class="meta">
	A dossier is a curated set of articles with an original introduction — a page meant to rank on its
	own, not an archive listing (PRD §8.1).
</p>

{#if data.topics.length}
	<table>
		<thead><tr><th>Slug</th><th>English</th><th>Indonesian</th><th>Articles</th></tr></thead>
		<tbody>
			{#each data.topics as topic (topic.id)}
				<tr>
					<td>
						<a href={resolve('/(admin)/admin/(app)/topics/[id]', { id: String(topic.id) })}>
							<code>{topic.slug}</code>
						</a>
					</td>
					<td>{topic.titles.en ?? '—'}</td>
					<td>{topic.titles.id ?? '—'}</td>
					<td class="num">{topic.article_count}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="empty">No topics yet.</p>
{/if}

<form method="POST" action="?/create" class="form-grid">
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<label for="slug">New topic slug</label>
	<input id="slug" name="slug" placeholder="openai" required />
	<div><button type="submit">Create topic</button></div>
</form>

<style>
	form {
		margin-top: 2rem;
		max-width: 24rem;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.empty {
		color: var(--text-3);
	}
</style>
