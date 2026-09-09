<script lang="ts">
	import { superForm } from 'sveltekit-superforms';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, message } = superForm(data.form, { dataType: 'json' });
</script>

<svelte:head><title>Redirects · VERUM</title></svelte:head>

<h1>Redirects</h1>
<p class="meta">
	Renaming an article slug writes its 301 here automatically. Add rules by hand for URLs that came
	from somewhere else.
</p>

{#if data.redirects.length === 0}
	<p class="empty">No redirects yet.</p>
{:else}
	<table>
		<thead><tr><th>From</th><th>To</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each data.redirects as row (row.id)}
				<tr>
					<td><code>{row.from_path}</code></td>
					<td><code>{row.to_path}</code></td>
					<td class="num">{row.status}</td>
					<td>
						<form
							method="POST"
							action="?/delete"
							onsubmit={(e) => {
								if (!confirm(`Delete redirect for ${row.from_path}?`)) e.preventDefault();
							}}
						>
							<input type="hidden" name="id" value={row.id} />
							<button type="submit" class="destructive">Delete</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<form method="POST" action="?/save" use:enhance class="stack">
	{#if $message}<p class="notice">{$message}</p>{/if}

	<label for="fromPath">From path</label>
	<input id="fromPath" bind:value={$form.fromPath} placeholder="/en/ai/old-slug" />
	{#if $errors.fromPath}<p class="error">{$errors.fromPath}</p>{/if}

	<label for="toPath">To path</label>
	<input id="toPath" bind:value={$form.toPath} placeholder="/en/ai/new-slug" />
	{#if $errors.toPath}<p class="error">{$errors.toPath}</p>{/if}

	<label for="status">Status</label>
	<select id="status" bind:value={$form.status}>
		<option value={301}>301 — permanent</option>
		<option value={302}>302 — temporary</option>
		<option value={308}>308 — permanent, method preserved</option>
	</select>

	<div><button type="submit">Save redirect</button></div>
</form>

<style>
	form {
		max-width: 32rem;
		margin-top: 2rem;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.empty {
		color: #666;
	}
</style>
