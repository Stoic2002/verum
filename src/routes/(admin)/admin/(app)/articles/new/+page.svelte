<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { Button, Field } from '$lib/components/ui';
	import { slugify } from '$lib/slug';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message } = superForm(data.form, {
		dataType: 'json'
	});

	// The slug follows the title until it is edited by hand, then it stops.
	let slugTouched = $state(false);

	function onTitleInput() {
		if (!slugTouched) $form.slug = slugify($form.title);
	}
</script>

<svelte:head><title>New article · VERUM</title></svelte:head>

<h1>New article</h1>

<form method="POST" use:enhance class="form-grid">
	{#if $message}<p class="notice" role="alert">{$message}</p>{/if}

	<Field id="title" label="Title" error={$errors.title}>
		{#snippet children({ id, describedBy, invalid })}
			<input
				{id}
				bind:value={$form.title}
				oninput={onTitleInput}
				required
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
			/>
		{/snippet}
	</Field>

	<Field
		id="slug"
		label="Slug"
		hint="Follows the title until you edit it. Changing it later records a 301."
		error={$errors.slug}
	>
		{#snippet children({ id, describedBy, invalid })}
			<input
				{id}
				bind:value={$form.slug}
				oninput={() => (slugTouched = true)}
				required
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
			/>
		{/snippet}
	</Field>

	<div class="form-row">
		<Field id="categoryId" label="Category" error={$errors.categoryId}>
			{#snippet children({ id, describedBy, invalid })}
				<select
					{id}
					bind:value={$form.categoryId}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
				>
					<option value={0} disabled>Choose a category</option>
					{#each data.categories as category (category.id)}
						<option value={category.id}>{category.name ?? category.slug}</option>
					{/each}
				</select>
			{/snippet}
		</Field>

		<Field id="locale" label="First locale">
			{#snippet children({ id })}
				<select {id} bind:value={$form.locale}>
					<option value="en">English</option>
					<option value="id">Bahasa Indonesia</option>
				</select>
			{/snippet}
		</Field>
	</div>

	<div class="form-actions">
		<Button type="submit" loading={$submitting} loadingLabel="Creating…">Create and edit</Button>
	</div>
</form>
