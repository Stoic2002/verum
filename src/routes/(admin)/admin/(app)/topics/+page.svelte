<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/toast.svelte';
	import { ConfirmButton } from '$lib/components/ui';

	let { data } = $props();
</script>

<svelte:head><title>Topics · VERUM</title></svelte:head>

<h1>Topics</h1>
<p class="meta">
	A dossier is a curated set of articles with an original introduction — a page meant to rank on its
	own, not an archive listing (PRD §8.1).
</p>

{#if data.topics.length}
	<table>
		<thead
			><tr><th>Slug</th><th>English</th><th>Indonesian</th><th>Articles</th><th></th></tr></thead
		>
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
					<td>
						<form method="POST" action="?/delete" use:enhance={enhanceWithToast()}>
							<input type="hidden" name="id" value={topic.id} />
							<ConfirmButton
								class="btn btn--danger btn--sm"
								title="Delete this topic?"
								message={`“${topic.titles.en ?? topic.slug}” is removed with its introductions and its list of articles. The articles themselves stay published.`}
								confirmLabel="Delete topic"
							>
								Delete
							</ConfirmButton>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="empty">No topics yet.</p>
{/if}

<form method="POST" action="?/create" class="form-grid" use:enhance={enhanceWithToast()}>
	<label for="slug">New topic slug</label>
	<input id="slug" name="slug" placeholder="openai" required />
	<div><button type="submit">Create topic</button></div>
</form>

<style>
	.form-grid {
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
