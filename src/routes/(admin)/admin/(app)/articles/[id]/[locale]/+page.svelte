<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { slugify } from '$lib/slug';
	import type { TocEntry } from '$lib/server/db/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message } = superForm(data.form, {
		dataType: 'json',
		resetForm: false,
		invalidateAll: false
	});

	let preview = $state({ html: '', toc: [] as TocEntry[], wordCount: 0, readingMinutes: 0 });
	let previewError = $state('');
	let rendering = $state(false);
	let showPreview = $state(true);

	/**
	 * Preview is rendered by the server, through the same pipeline that writes
	 * body_html on save. A client-side renderer would be a second sanitiser and
	 * a second highlighter — and the moment they disagree, this stops being a
	 * preview of anything.
	 */
	async function render(markdown: string, signal: AbortSignal) {
		rendering = true;
		try {
			const response = await fetch('/admin/api/render', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ markdown }),
				signal
			});
			if (!response.ok) throw new Error(`Render failed (${response.status})`);
			preview = await response.json();
			previewError = '';
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				previewError = (error as Error).message;
			}
		} finally {
			rendering = false;
		}
	}

	$effect(() => {
		const markdown = $form.bodyMd;
		if (!showPreview) return;

		const controller = new AbortController();
		// Debounced: a request per keystroke would queue renders faster than the
		// server retires them.
		const timer = setTimeout(() => render(markdown, controller.signal), 400);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	let bodyEl: HTMLTextAreaElement | undefined = $state();
	let showLibrary = $state(false);

	/** Inserts at the cursor rather than appending, so it lands where you are. */
	function insertAtCursor(snippet: string) {
		const el = bodyEl;
		if (!el) {
			$form.bodyMd += `\n\n${snippet}\n`;
			return;
		}

		const { selectionStart: start, selectionEnd: end } = el;
		const before = $form.bodyMd.slice(0, start);
		const after = $form.bodyMd.slice(end);
		const padded = `${before.endsWith('\n') || !before ? '' : '\n\n'}${snippet}\n`;

		$form.bodyMd = before + padded + after;

		const caret = before.length + padded.length;
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(caret, caret);
		});
	}

	let slugTouched = $state(false);
	const publicPath = $derived(`/${data.locale}/${data.categorySlug}/${$form.slug}`);
</script>

<svelte:head><title>{$form.title || 'Editing'} · VERUM</title></svelte:head>

<header class="head">
	<div>
		<h1>{$form.title || 'Untitled'}</h1>
		<p class="meta">
			<span class="pill">{data.locale}</span>
			<span class="pill">{data.status}</span>
			<code>{publicPath}</code>
		</p>
	</div>
	<div class="head-actions">
		<a href={resolve('/preview/[token]', { token: data.previewToken })} target="_blank">Preview ↗</a
		>
		<a href={resolve('/(admin)/admin/(app)/articles/[id]', { id: String(data.articleId) })}>
			Settings
		</a>
	</div>
</header>

<form method="POST" use:enhance>
	{#if $message}<p class="notice">{$message}</p>{/if}

	<div class="grid">
		<div class="stack">
			<label for="title">Title</label>
			<input
				id="title"
				bind:value={$form.title}
				oninput={() => {
					if (!slugTouched) $form.slug = slugify($form.title);
				}}
			/>
			{#if $errors.title}<p class="error">{$errors.title}</p>{/if}

			<label for="slug">
				Slug
				<span class="meta">Changing this records a 301 from the old URL automatically.</span>
			</label>
			<input id="slug" bind:value={$form.slug} oninput={() => (slugTouched = true)} />
			{#if $errors.slug}<p class="error">{$errors.slug}</p>{/if}

			<label for="excerpt">Excerpt</label>
			<textarea id="excerpt" rows="2" bind:value={$form.excerpt}></textarea>
			{#if $errors.excerpt}<p class="error">{$errors.excerpt}</p>{/if}

			<label for="bodyMd">
				Body
				<span class="meta">
					Markdown · <code>::youtube&#123;id=…&#125;</code>
					· <code>::x&#123;url=…&#125;</code>
					· <code>:::callout&#123;type=warning&#125;</code>
				</span>
			</label>
			<div class="toolbar">
				<button type="button" onclick={() => (showLibrary = !showLibrary)}>
					{showLibrary ? 'Hide images' : 'Insert image'}
				</button>
				<button type="button" onclick={() => insertAtCursor(':::callout{type="note"}\n\n:::')}>
					Callout
				</button>
				<button type="button" onclick={() => insertAtCursor('::youtube{id=""}')}>YouTube</button>
				<button type="button" onclick={() => insertAtCursor('::x{url=""}')}>X post</button>
			</div>

			{#if showLibrary}
				<div class="library">
					{#if data.media.length === 0}
						<p class="meta">
							Nothing in the library yet. Upload on the
							<a href={resolve('/(admin)/admin/(app)/media')}>Media</a> page.
						</p>
					{:else}
						{#each data.media as item (item.id)}
							<button
								type="button"
								title={item.alt}
								onclick={() => {
									insertAtCursor(`::image{id=${item.id}}`);
									showLibrary = false;
								}}
							>
								<img src={item.thumb} alt={item.alt} loading="lazy" />
							</button>
						{/each}
					{/if}
				</div>
			{/if}

			<textarea
				id="bodyMd"
				class="editor"
				bind:this={bodyEl}
				bind:value={$form.bodyMd}
				spellcheck="false"></textarea>

			<details>
				<summary>SEO and corrections</summary>
				<div class="stack">
					<label for="metaTitle">
						Meta title <span class="meta">{$form.metaTitle.length}/60</span>
					</label>
					<input id="metaTitle" bind:value={$form.metaTitle} placeholder={$form.title} />
					{#if $errors.metaTitle}<p class="error">{$errors.metaTitle}</p>{/if}

					<label for="metaDesc">
						Meta description <span class="meta">{$form.metaDesc.length}/155</span>
					</label>
					<textarea id="metaDesc" rows="2" bind:value={$form.metaDesc}></textarea>
					{#if $errors.metaDesc}<p class="error">{$errors.metaDesc}</p>{/if}

					<label for="correction">
						Correction note
						<span class="meta">Shown at the foot of the article, dated (PRD §6.4).</span>
					</label>
					<textarea id="correction" rows="3" bind:value={$form.correction}></textarea>
				</div>
			</details>

			<div class="actions">
				<button type="submit" disabled={$submitting}>{$submitting ? 'Saving…' : 'Save'}</button>
				<span class="meta">
					{preview.wordCount || data.stats.wordCount} words ·
					{preview.readingMinutes || data.stats.readingMinutes} min read
				</span>
			</div>
		</div>

		<aside class="preview-pane">
			<div class="preview-head">
				<strong>Preview</strong>
				<label class="check">
					<input type="checkbox" bind:checked={showPreview} />
					live
				</label>
				{#if rendering}<span class="meta">rendering…</span>{/if}
			</div>

			{#if previewError}
				<p class="error">{previewError}</p>
			{/if}

			{#if preview.toc.length}
				<nav class="toc">
					<strong>Contents</strong>
					<ol>
						{#each preview.toc as entry (entry.id)}
							<li class="toc--{entry.level}">{entry.text}</li>
						{/each}
					</ol>
				</nav>
			{/if}

			<!--
				Rendered and sanitised server-side by src/lib/server/content/render.ts,
				the same pipeline that writes body_html on save. The string reaching
				here has already been through rehype-sanitize; author HTML cannot
				survive it. render.spec.ts is what keeps that true.
			-->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<article class="rendered">{@html preview.html}</article>
		</aside>
	</div>
</form>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.head h1 {
		margin: 0;
		font-size: 1.25rem;
	}
	.head-actions {
		display: flex;
		gap: 1rem;
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
		margin-top: 1rem;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.toolbar :global(button) {
		border-color: #d0d0d0;
		background: #fff;
		color: #333;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}
	.library {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		max-height: 12rem;
		overflow-y: auto;
	}
	.library :global(button) {
		padding: 0;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: none;
		overflow: hidden;
		line-height: 0;
	}
	.library img {
		width: 5rem;
		height: 3.5rem;
		object-fit: cover;
	}
	.editor {
		min-height: 26rem;
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		resize: vertical;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.preview-pane {
		position: sticky;
		top: 1rem;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		padding: 1rem;
		max-height: calc(100vh - 3rem);
		overflow: auto;
	}
	.preview-head {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.8125rem;
	}
	.toc {
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #eee;
		font-size: 0.8125rem;
	}
	.toc ol {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
	}
	.toc :global(.toc--3) {
		margin-left: 0.75rem;
		color: #666;
	}
	.rendered :global(img) {
		max-width: 100%;
	}
	.rendered :global(pre) {
		overflow-x: auto;
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}
	.rendered :global(table) {
		border-collapse: collapse;
	}
	.rendered :global(th),
	.rendered :global(td) {
		border: 1px solid #ddd;
		padding: 0.25rem 0.5rem;
	}
	.rendered :global(.embed__frame) {
		position: relative;
		aspect-ratio: 16 / 9;
	}
	.rendered :global(.embed__frame iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.rendered :global(.callout) {
		border-left: 3px solid #999;
		padding: 0.5rem 0.75rem;
		background: #f6f6f6;
	}
	.rendered :global(.embed-error) {
		color: #b00020;
		font-size: 0.8125rem;
	}
	@media (max-width: 60rem) {
		.grid {
			grid-template-columns: 1fr;
		}
		.preview-pane {
			position: static;
			max-height: none;
		}
	}
</style>
