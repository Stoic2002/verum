<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Field, FileInput } from '$lib/components/ui';

	let { data, form } = $props();

	let uploading = $state(false);

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

<form
	method="POST"
	action="?/upload"
	enctype="multipart/form-data"
	class="form-grid upload"
	use:enhance={() => {
		uploading = true;
		return async ({ update }) => {
			await update();
			uploading = false;
		};
	}}
>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.uploaded}
		<p class="notice">Uploaded #{form.uploaded} — {form.variants} renditions written.</p>
	{/if}

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
			<input {id} name="credit" placeholder="Unsplash / Jane Doe" aria-describedby={describedBy} />
		{/snippet}
	</Field>

	<div class="form-actions">
		<Button type="submit" loading={uploading} loadingLabel="Processing…">Upload</Button>
	</div>
</form>

{#if data.media.length === 0}
	<p class="empty">Nothing uploaded yet.</p>
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

					<form method="POST" action="?/updateMeta" use:enhance class="tight">
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
							<Button
								type="submit"
								size="sm"
								variant="danger"
								formaction="?/delete"
								onclick={(e) => {
									if (!confirm('Delete this image and every rendition?')) e.preventDefault();
								}}
							>
								Delete
							</Button>
						</div>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.upload {
		margin: 1.5rem 0 2rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 6px;
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
