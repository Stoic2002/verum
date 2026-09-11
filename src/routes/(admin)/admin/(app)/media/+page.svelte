<script lang="ts">
	import { enhance } from '$app/forms';
	import { AdminPager, Button, ConfirmButton, Field, FileInput } from '$lib/components/ui';
	import { enhanceWithToast } from '$lib/toast.svelte';

	let { data } = $props();

	let uploading = $state(false);
	let importing = $state(false);
	/** Which way of adding an image is showing. */
	let source = $state<'file' | 'url'>('file');

	const kb = (bytes: number) =>
		bytes > 1024 * 1024
			? `${(bytes / 1024 / 1024).toFixed(1)} MB`
			: `${Math.round(bytes / 1024)} KB`;
</script>

<svelte:head><title>Media · VERUM</title></svelte:head>

<h1>Media</h1>
<p class="meta">
	Each upload is resized to three widths and encoded as AVIF and WebP, plus the original kept for
	re-encoding later. Storage driver: <code>{data.driver}</code>.
	{#if data.driver === 'fs'}
		Local files — set the R2 variables in <code>.env</code> to switch.
	{/if}
</p>

<div class="add">
	<div class="add__tabs" role="tablist" aria-label="How to add an image">
		<button
			type="button"
			role="tab"
			aria-selected={source === 'file'}
			class:selected={source === 'file'}
			onclick={() => (source = 'file')}
		>
			Upload a file
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={source === 'url'}
			class:selected={source === 'url'}
			onclick={() => (source = 'url')}
		>
			Import from URL
		</button>
	</div>

	{#if source === 'file'}
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			class="form-grid"
			use:enhance={enhanceWithToast({
				reset: true,
				onStart: () => (uploading = true),
				onDone: () => (uploading = false)
			})}
		>
			<Field
				id="file"
				label="Image"
				hint="Drag one in, or choose a file. Max {kb(data.maxBytes)}. SVG is refused."
			>
				{#snippet children({ id, describedBy })}
					<FileInput
						{id}
						name="file"
						required
						{describedBy}
						accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
					/>
				{/snippet}
			</Field>

			<Field id="alt" label="Alt text" hint="What the image shows, for a reader who cannot see it.">
				{#snippet children({ id, describedBy })}
					<input {id} name="alt" required aria-describedby={describedBy} />
				{/snippet}
			</Field>

			<Field id="credit" label="Credit" optional hint="Source and licence (PRD §14).">
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="credit"
						placeholder="Unsplash / Jane Doe"
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>

			<div class="form-actions">
				<Button type="submit" loading={uploading} loadingLabel="Processing…">Upload</Button>
			</div>
		</form>
	{:else}
		<form
			method="POST"
			action="?/importUrl"
			class="form-grid"
			use:enhance={enhanceWithToast({
				reset: true,
				onStart: () => (importing = true),
				onDone: () => (importing = false)
			})}
		>
			<Field
				id="url"
				label="Image URL"
				hint="Fetched by the server and re-encoded like any upload. Only http and https."
			>
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="url"
						type="url"
						required
						placeholder="https://images.example.com/photo.jpg"
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>

			<Field
				id="url-alt"
				label="Alt text"
				hint="What the image shows, for a reader who cannot see it."
			>
				{#snippet children({ id, describedBy })}
					<input {id} name="alt" required aria-describedby={describedBy} />
				{/snippet}
			</Field>

			<Field
				id="url-credit"
				label="Credit"
				hint="Required here: record where it came from. PRD §14 allows only clearly licensed stock or your own images."
			>
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="credit"
						required
						placeholder="Unsplash / Jane Doe"
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>

			<div class="form-actions">
				<Button type="submit" loading={importing} loadingLabel="Fetching…">Import image</Button>
			</div>
		</form>
	{/if}
</div>

<form class="form-inline filters" method="GET" role="search">
	<label class="visually-hidden" for="q">Search by filename or alt text</label>
	<input
		id="q"
		type="search"
		name="q"
		placeholder="Search filename or alt text"
		value={data.search}
	/>
	<Button type="submit" variant="secondary">Search</Button>
	{#if data.search}
		<Button href="/admin/media" variant="ghost">Clear</Button>
	{/if}
</form>

{#if data.media.length === 0}
	<p class="empty">
		{data.search ? `Nothing matches “${data.search}”.` : 'Nothing uploaded yet.'}
	</p>
{:else}
	<ul class="grid">
		{#each data.media as item (item.id)}
			<li>
				<picture>
					{#each item.picture.sources as source (source.type)}
						<source type={source.type} srcset={source.srcset} sizes="200px" />
					{/each}
					<img
						src={item.picture.src}
						alt={item.alt}
						width={item.picture.width}
						height={item.picture.height}
						loading="lazy"
						decoding="async"
					/>
				</picture>

				<div class="body">
					<p class="filename" title={item.originalName}>{item.originalName}</p>
					<p class="meta">
						#{item.id} · {item.width}×{item.height} · {item.variants.length} renditions ·
						{kb(item.totalBytes)}
					</p>
					<p class="meta">
						Insert: <code>::image&#123;id={item.id}&#125;</code>
					</p>

					<form method="POST" action="?/updateMeta" use:enhance={enhanceWithToast()} class="tight">
						<input type="hidden" name="id" value={item.id} />
						<input name="alt" value={item.alt} aria-label="Alt text" required />
						<input
							name="credit"
							value={item.credit ?? ''}
							aria-label="Credit"
							placeholder="Credit"
						/>
						<div class="row">
							<Button type="submit" size="sm" variant="secondary">Save</Button>
							<ConfirmButton
								class="btn btn--danger btn--sm"
								formaction="?/delete"
								title="Delete this image?"
								message="The original and every rendition are removed from storage. Articles that use it will show a missing-image notice instead."
								confirmLabel="Delete image"
							>
								Delete
							</ConfirmButton>
						</div>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<AdminPager
	page={data.page}
	pages={data.pages}
	total={data.total}
	label="images"
	params={{ q: data.search }}
/>

<style>
	.add {
		margin: 1.5rem 0 2rem;
		padding: 1.125rem 1.25rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		max-width: 46rem;
	}
	.add__tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.125rem;
		padding-bottom: 0.875rem;
		border-bottom: 1px solid var(--border);
	}
	/* Tabs are navigation, not actions — they must not look like submit buttons. */
	.add__tabs :global(button) {
		min-height: 1.875rem;
		padding: 0.3125rem 0.75rem;
		border: 0;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--text-3);
		font-size: 0.8125rem;
		font-weight: var(--weight-body);
	}
	.add__tabs :global(button:hover) {
		background: var(--surface-2);
		color: var(--text);
	}
	.add__tabs :global(button[aria-selected='true']) {
		background: var(--accent-tint);
		color: var(--accent);
		font-weight: var(--weight-strong);
	}

	.filters {
		margin: 0 0 1.25rem;
		max-width: 34rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.grid li {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.grid img {
		display: block;
		width: 100%;
		height: 9rem;
		object-fit: cover;
		background: var(--surface-2);
	}
	.body {
		padding: 0.625rem;
	}
	.filename {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.body p {
		margin: 0.125rem 0;
	}
	.tight {
		display: grid;
		gap: 0.375rem;
		margin-top: 0.625rem;
	}
	.row {
		display: flex;
		gap: 0.375rem;
	}
	.empty {
		color: var(--text-3);
	}
</style>
