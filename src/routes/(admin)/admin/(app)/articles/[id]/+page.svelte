<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { Button, Switch } from '$lib/components/ui';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message } = superForm(data.form, {
		dataType: 'json'
	});

	const when = (value: Date | string | null) =>
		value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : '—';

	function toggleTag(id: number, checked: boolean) {
		$form.tagIds = checked ? [...$form.tagIds, id] : $form.tagIds.filter((t) => t !== id);
	}
</script>

<svelte:head><title>Edit article · VERUM</title></svelte:head>

<header class="head">
	<h1>Article #{data.article.id}</h1>
	<a href={resolve('/(admin)/admin/(app)/articles')}>← All articles</a>
</header>

<section>
	<h2>Language versions</h2>

	<ul class="locales">
		{#each data.article.locales as locale (locale.locale)}
			<li>
				<div>
					<a
						href={resolve('/(admin)/admin/(app)/articles/[id]/[locale]', {
							id: String(data.article.id),
							locale: locale.locale
						})}
					>
						<strong>{locale.locale}</strong> — {locale.title || '(untitled)'}
					</a>
					<p class="meta">
						/{locale.locale}/{data.article.categorySlug}/{locale.slug}
						· {locale.wordCount} words · {locale.readingMinutes} min · published {when(
							locale.publishedAt
						)}
					</p>
				</div>
				<a
					class="preview"
					href={resolve('/preview/[token]', { token: data.previewTokens[locale.locale] })}
					target="_blank"
				>
					Preview ↗
				</a>
			</li>
		{/each}
	</ul>

	{#if data.missingLocales.length}
		<form method="POST" action="?/addLocale" class="inline">
			<select name="locale" aria-label="Locale to add">
				{#each data.missingLocales as locale (locale)}
					<option value={locale}>{locale}</option>
				{/each}
			</select>
			<Button type="submit" variant="secondary">Add language version</Button>
		</form>
		<p class="meta">
			Starts empty on purpose. The other locale is a rewrite, not a translation (PRD §7).
		</p>
	{/if}
</section>

<section>
	<h2>Settings</h2>

	<form method="POST" action="?/settings" use:enhance class="stack">
		{#if $message}<p class="notice">{$message}</p>{/if}

		<label for="categoryId">Category</label>
		<select id="categoryId" bind:value={$form.categoryId}>
			{#each data.categories as category (category.id)}
				<option value={category.id}>{category.name ?? category.slug}</option>
			{/each}
		</select>

		<label for="status">Status</label>
		<select id="status" bind:value={$form.status}>
			<option value="draft">Draft</option>
			<option value="scheduled">Scheduled</option>
			<option value="published">Published</option>
			<option value="archived">Archived</option>
		</select>

		{#if $form.status === 'scheduled' || $form.status === 'published'}
			<label for="publishAt">Publish at</label>
			<input id="publishAt" type="datetime-local" bind:value={$form.publishAt} />
			<p class="meta">
				{#if $form.status === 'scheduled'}
					Goes live by itself when this time passes — no job runs.
				{:else}
					Leave blank to keep the existing date.
				{/if}
			</p>
			{#if $errors.publishAt}<p class="error">{$errors.publishAt}</p>{/if}
		{/if}

		<fieldset>
			<legend>Cover image</legend>
			<div class="covers">
				<button
					type="button"
					class="cover"
					class:selected={$form.coverMediaId === 0}
					onclick={() => ($form.coverMediaId = 0)}
				>
					None
				</button>
				{#each data.media as item (item.id)}
					<button
						type="button"
						class="cover"
						class:selected={$form.coverMediaId === item.id}
						title={item.alt}
						onclick={() => ($form.coverMediaId = item.id)}
					>
						<img src={item.thumb} alt={item.alt} loading="lazy" />
					</button>
				{/each}
			</div>
		</fieldset>

		<div class="switch-row">
			<Switch
				id="isLiving"
				bind:checked={$form.isLiving}
				label="Living article"
				hint="Updated in place rather than replaced by a new post (PRD §12.4)."
			/>
		</div>

		<fieldset>
			<legend>Tags</legend>
			<div class="checks">
				{#each data.tags as tag (tag.id)}
					<label class="check">
						<input
							type="checkbox"
							checked={$form.tagIds.includes(tag.id)}
							onchange={(e) => toggleTag(tag.id, e.currentTarget.checked)}
						/>
						{tag.name}
					</label>
				{/each}
			</div>
		</fieldset>

		<div>
			<button type="submit" disabled={$submitting}
				>{$submitting ? 'Saving…' : 'Save settings'}</button
			>
		</div>
	</form>
</section>

<section class="danger">
	<h2>Delete</h2>
	<form
		method="POST"
		action="?/delete"
		onsubmit={(e) => {
			if (!confirm('Delete this article and every language version? This cannot be undone.')) {
				e.preventDefault();
			}
		}}
	>
		<Button type="submit" variant="danger">Delete article</Button>
	</form>
</section>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	section {
		margin: 2rem 0;
		max-width: 42rem;
	}
	h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
	}
	.locales {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.locales li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.preview {
		white-space: nowrap;
		font-size: 0.8125rem;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.inline select {
		width: auto;
		min-width: 7rem;
	}
	.switch-row {
		margin: 0.625rem 0 0.25rem;
	}
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 1.25rem;
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem;
	}
	legend {
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0 0.25rem;
	}
	.covers {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		max-height: 11rem;
		overflow-y: auto;
	}
	.covers :global(button.cover) {
		padding: 0;
		border: 2px solid transparent;
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 0.75rem;
		min-width: 5rem;
		min-height: 3.5rem;
		line-height: 0;
		overflow: hidden;
	}
	.covers :global(button.cover.selected) {
		border-color: var(--text);
	}
	.covers img {
		width: 5rem;
		height: 3.5rem;
		object-fit: cover;
	}
	.danger h2 {
		color: var(--danger);
	}
</style>
