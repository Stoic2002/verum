<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
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

<form method="POST" use:enhance class="stack">
	{#if $message}<p class="notice" role="alert">{$message}</p>{/if}

	<label for="title">Title</label>
	<input id="title" bind:value={$form.title} oninput={onTitleInput} required />
	{#if $errors.title}<p class="error">{$errors.title}</p>{/if}

	<label for="slug">Slug</label>
	<input id="slug" bind:value={$form.slug} oninput={() => (slugTouched = true)} required />
	{#if $errors.slug}<p class="error">{$errors.slug}</p>{/if}

	<label for="categoryId">Category</label>
	<select id="categoryId" bind:value={$form.categoryId}>
		<option value={0} disabled>Choose a category</option>
		{#each data.categories as category (category.id)}
			<option value={category.id}>{category.name ?? category.slug}</option>
		{/each}
	</select>
	{#if $errors.categoryId}<p class="error">{$errors.categoryId}</p>{/if}

	<label for="locale">First locale</label>
	<select id="locale" bind:value={$form.locale}>
		<option value="en">English</option>
		<option value="id">Bahasa Indonesia</option>
	</select>

	<div>
		<button type="submit" disabled={$submitting}>
			{$submitting ? 'Creating…' : 'Create and edit'}
		</button>
	</div>
</form>
