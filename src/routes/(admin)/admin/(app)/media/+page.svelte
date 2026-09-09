<script lang="ts">
	import { enhance } from '$app/forms';

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
	class="stack upload"
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

	<label for="file">Image <span class="meta">max {kb(data.maxBytes)}, no SVG</span></label>
	<input
		id="file"
		name="file"
		type="file"
		accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
		required
	/>

	<label for="alt">
		Alt text <span class="meta"
			>Required. What the image shows, for a reader who cannot see it.</span
		>
	</label>
	<input id="alt" name="alt" required />

	<label for="credit"
		>Credit <span class="meta">Optional. Source and licence (PRD §14).</span></label
	>
	<input id="credit" name="credit" placeholder="Unsplash / Jane Doe" />

	<div>
		<button type="submit" disabled={uploading}>{uploading ? 'Processing…' : 'Upload'}</button>
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

					<form method="POST" action="?/updateMeta" use:enhance class="stack tight">
						<input type="hidden" name="id" value={item.id} />
						<input name="alt" value={item.alt} aria-label="Alt text" required />
						<input
							name="credit"
							value={item.credit ?? ''}
							aria-label="Credit"
							placeholder="Credit"
						/>
						<div class="row">
							<button type="submit">Save</button>
							<button
								type="submit"
								class="destructive"
								formaction="?/delete"
								onclick={(e) => {
									if (!confirm('Delete this image and every rendition?')) e.preventDefault();
								}}
							>
								Delete
							</button>
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
		border: 1px solid #e5e5e5;
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
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		overflow: hidden;
	}
	.grid img {
		display: block;
		width: 100%;
		height: 9rem;
		object-fit: cover;
		background: #f3f3f3;
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
		gap: 0.25rem;
		margin-top: 0.5rem;
	}
	.row {
		display: flex;
		gap: 0.375rem;
	}
	.empty {
		color: #666;
	}
</style>
