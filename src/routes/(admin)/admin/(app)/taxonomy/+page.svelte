<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { enhance as kitEnhance } from '$app/forms';
	import { ConfirmButton } from '$lib/components/ui';
	import { enhanceWithToast, toastOnUpdate } from '$lib/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const category = superForm(data.categoryForm, {
		onUpdate: toastOnUpdate,
		id: 'category',
		dataType: 'json'
	});
	// svelte-ignore state_referenced_locally
	const tag = superForm(data.tagForm, {
		onUpdate: toastOnUpdate,
		id: 'tag',
		dataType: 'json'
	});

	const { form: cForm, errors: cErrors, enhance: cEnhance } = category;
	const { form: tForm, errors: tErrors, enhance: tEnhance } = tag;

	function edit(row: (typeof data.categories)[number]) {
		$cForm.slug = row.slug;
		$cForm.isActive = row.is_active;
		$cForm.sortOrder = row.sort_order;
		$cForm.nameEn = row.names.en ?? '';
		$cForm.nameId = row.names.id ?? '';
		$cForm.descriptionEn = row.descriptions.en ?? '';
		$cForm.descriptionId = row.descriptions.id ?? '';
	}
</script>

<svelte:head><title>Categories & tags · VERUM</title></svelte:head>

<h1>Categories &amp; tags</h1>

<section>
	<h2>Categories</h2>
	<p class="meta">
		Only <code>ai</code> and <code>tech</code> are active at launch. The rest open one at a time, once
		traffic is proven (PRD §5.3).
	</p>

	<table>
		<thead>
			<tr
				><th>Slug</th><th>English</th><th>Indonesian</th><th>Articles</th><th>Active</th><th
				></th></tr
			>
		</thead>
		<tbody>
			{#each data.categories as row (row.id)}
				<tr>
					<td><code>{row.slug}</code></td>
					<td>{row.names.en ?? '—'}</td>
					<td>{row.names.id ?? '—'}</td>
					<td class="num">{row.article_count}</td>
					<td>{row.is_active ? 'yes' : 'no'}</td>
					<td><button type="button" onclick={() => edit(row)}>Edit</button></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<form method="POST" action="?/saveCategory" use:cEnhance class="form-grid">
		<label for="cslug">Slug</label>
		<input id="cslug" bind:value={$cForm.slug} />
		{#if $cErrors.slug}<p class="error">{$cErrors.slug[0]}</p>{/if}

		<div class="row">
			<div class="form-grid">
				<label for="nameEn">Name (en)</label>
				<input id="nameEn" bind:value={$cForm.nameEn} />
				{#if $cErrors.nameEn}<p class="error">{$cErrors.nameEn[0]}</p>{/if}
			</div>
			<div class="form-grid">
				<label for="nameId">Name (id)</label>
				<input id="nameId" bind:value={$cForm.nameId} placeholder="defaults to English" />
			</div>
		</div>

		<label for="descriptionEn">
			Description (en)
			<span class="meta">Original prose. This page has to rank on its own.</span>
		</label>
		<textarea id="descriptionEn" rows="2" bind:value={$cForm.descriptionEn}></textarea>

		<label for="descriptionId">Description (id)</label>
		<textarea id="descriptionId" rows="2" bind:value={$cForm.descriptionId}></textarea>

		<div class="row">
			<label class="check"><input type="checkbox" bind:checked={$cForm.isActive} /> Active</label>
			<div class="form-grid">
				<label for="sortOrder">Sort order</label>
				<input id="sortOrder" type="number" bind:value={$cForm.sortOrder} />
			</div>
		</div>

		<div><button type="submit">Save category</button></div>
	</form>
</section>

<section>
	<h2>Tags</h2>
	<p class="meta">A tag page with fewer than 3 articles is noindexed (PRD §8.1).</p>

	<table>
		<thead><tr><th>Name</th><th>Slug</th><th>Articles</th><th></th></tr></thead>
		<tbody>
			{#each data.tags as row (row.id)}
				<tr>
					<td>{row.name}</td>
					<td><code>{row.slug}</code></td>
					<td class="num">{row.article_count}</td>
					<td>
						<form method="POST" action="?/deleteTag" use:kitEnhance={enhanceWithToast()}>
							<input type="hidden" name="id" value={row.id} />
							<ConfirmButton
								class="btn btn--danger btn--sm"
								title="Delete this tag?"
								message={`“${row.name}” is removed from every article that carries it. The articles themselves stay.`}
								confirmLabel="Delete tag"
							>
								Delete
							</ConfirmButton>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<form method="POST" action="?/saveTag" use:tEnhance class="form-grid">
		<div class="row">
			<div class="form-grid">
				<label for="tname">Name</label>
				<input id="tname" bind:value={$tForm.name} />
				{#if $tErrors.name}<p class="error">{$tErrors.name[0]}</p>{/if}
			</div>
			<div class="form-grid">
				<label for="tslug">Slug</label>
				<input id="tslug" bind:value={$tForm.slug} />
				{#if $tErrors.slug}<p class="error">{$tErrors.slug[0]}</p>{/if}
			</div>
		</div>

		<div><button type="submit">Save tag</button></div>
	</form>
</section>

<style>
	section {
		margin: 2rem 0;
		max-width: 46rem;
	}
	h2 {
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		align-items: end;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
