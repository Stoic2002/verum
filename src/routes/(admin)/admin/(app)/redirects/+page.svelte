<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { enhance as kitEnhance } from '$app/forms';
	import { AdminPager, ConfirmButton } from '$lib/components/ui';
	import { enhanceWithToast, toastOnUpdate } from '$lib/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance } = superForm(data.form, {
		onUpdate: toastOnUpdate,
		dataType: 'json'
	});
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
						<form method="POST" action="?/delete" use:kitEnhance={enhanceWithToast()}>
							<input type="hidden" name="id" value={row.id} />
							<ConfirmButton
								class="btn btn--danger btn--sm"
								title="Delete this redirect?"
								message={`${row.from_path} will return 404 again once this rule is gone.`}
								confirmLabel="Delete redirect"
							>
								Delete
							</ConfirmButton>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<AdminPager page={data.page} pages={data.pages} total={data.total} label="redirects" />
{/if}

<form method="POST" action="?/save" use:enhance class="form-grid">
	<label for="fromPath">From path</label>
	<input id="fromPath" type="text" bind:value={$form.fromPath} placeholder="/en/ai/old-slug" />
	{#if $errors.fromPath}<p class="error">{$errors.fromPath[0]}</p>{/if}

	<label for="toPath">To path</label>
	<input id="toPath" type="text" bind:value={$form.toPath} placeholder="/en/ai/new-slug" />
	{#if $errors.toPath}<p class="error">{$errors.toPath[0]}</p>{/if}

	<label for="status">Status</label>
	<select id="status" bind:value={$form.status}>
		<option value={301}>301 — permanent</option>
		<option value={302}>302 — temporary</option>
		<option value={308}>308 — permanent, method preserved</option>
	</select>

	<div><button type="submit">Save redirect</button></div>
</form>

<style>
	.form-grid {
		max-width: 32rem;
		margin-top: 2rem;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	.empty {
		color: var(--text-3);
	}
</style>
