<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { toastOnUpdate } from '$lib/toast.svelte';
	import { Button, Field } from '$lib/components/ui';
	import { slugify } from '$lib/slug';
	import { countEditorNotes } from '$lib/quality-gate';
	import type { TocEntry } from '$lib/server/db/schema';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting } = superForm(data.form, {
		onUpdate: toastOnUpdate,
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

	/*
	 * The picker searches the whole library through /admin/api/media and loads
	 * more on request. Seeded with what the page already has so opening it
	 * costs no round trip.
	 */
	// svelte-ignore state_referenced_locally
	let libraryItems = $state(data.media);
	let libraryCursor = $state<string | null>(null);
	let libraryLeft = $state(0);
	let librarySearch = $state('');
	let libraryLoading = $state(false);

	/**
	 * Loads the first page, or the next one after the cursor.
	 *
	 * Merged by id as a second line of defence. The server's cursor already
	 * prevents a repeat, but the grid below is a keyed #each, and a duplicate id
	 * reaching it would throw rather than merely show an image twice.
	 */
	async function loadLibrary(reset: boolean) {
		libraryLoading = true;
		try {
			let endpoint = `/admin/api/media?q=${encodeURIComponent(librarySearch)}`;
			if (!reset && libraryCursor) endpoint += `&cursor=${encodeURIComponent(libraryCursor)}`;

			const response = await fetch(endpoint);
			if (!response.ok) return;

			const result = (await response.json()) as {
				items: typeof data.media;
				left: number;
				nextCursor: string | null;
			};

			libraryItems = reset
				? result.items
				: [
						...libraryItems,
						...result.items.filter((item) => !libraryItems.some((seen) => seen.id === item.id))
					];
			libraryCursor = result.nextCursor;
			libraryLeft = result.left;
		} finally {
			libraryLoading = false;
		}
	}

	$effect(() => {
		if (!showLibrary) return;
		const query = librarySearch;
		const timer = setTimeout(() => void loadLibrary(true), query ? 250 : 0);
		return () => clearTimeout(timer);
	});

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

	const editorNotes = $derived(countEditorNotes($form.bodyMd ?? ''));
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

{#if data.aiJob || editorNotes > 0}
	<div class="ai-note" class:ai-note--warn={editorNotes > 0} role="status">
		{#if data.aiJob}
			<span>
				Drafted with the AI writer from {data.aiJob.used} of {data.aiJob.claims} extracted claims.
				<a href={resolve('/(admin)/admin/(app)/ai/[id]', { id: String(data.aiJob.id) })}
					>Research report →</a
				>
			</span>
		{/if}
		{#if editorNotes > 0}
			<strong
				>{editorNotes} editor {editorNotes === 1 ? 'note' : 'notes'} to resolve before publishing.</strong
			>
		{/if}
	</div>
{/if}

<form method="POST" use:enhance>
	<div class="grid">
		<div class="form-grid">
			<Field id="title" label="Title" error={$errors.title}>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						bind:value={$form.title}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						oninput={() => {
							if (!slugTouched) $form.slug = slugify($form.title);
						}}
					/>
				{/snippet}
			</Field>

			<Field
				id="slug"
				label="Slug"
				hint="Changing this records a 301 from the old URL automatically."
				error={$errors.slug}
			>
				{#snippet children({ id, describedBy, invalid })}
					<input
						{id}
						bind:value={$form.slug}
						oninput={() => (slugTouched = true)}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
					/>
				{/snippet}
			</Field>

			<Field id="excerpt" label="Excerpt" error={$errors.excerpt}>
				{#snippet children({ id, describedBy, invalid })}
					<textarea
						{id}
						rows="2"
						bind:value={$form.excerpt}
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}></textarea>
				{/snippet}
			</Field>

			<label for="bodyMd">Body</label>
			<p class="meta">
				Markdown · <code>::youtube&#123;id=…&#125;</code>
				· <code>::x&#123;url=…&#125;</code>
				· <code>:::callout&#123;type=warning&#125;</code>
			</p>
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
				<div class="library-search form-inline">
					<label class="visually-hidden" for="library-q">Search images</label>
					<input
						id="library-q"
						type="search"
						placeholder="Search filename or alt text"
						bind:value={librarySearch}
					/>
				</div>
				<div class="library">
					{#if libraryItems.length === 0 && !libraryLoading}
						<p class="meta">
							Nothing in the library yet. Upload on the
							<a href={resolve('/(admin)/admin/(app)/media')}>Media</a> page.
						</p>
					{:else}
						{#each libraryItems as item (item.id)}
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
				{#if libraryCursor !== null}
					<button
						type="button"
						class="btn btn--ghost btn--sm"
						disabled={libraryLoading}
						onclick={() => loadLibrary(false)}
					>
						{libraryLoading ? 'Loading…' : `Load more (${libraryLeft} left)`}
					</button>
				{/if}
			{/if}

			<textarea
				id="bodyMd"
				class="editor"
				bind:this={bodyEl}
				bind:value={$form.bodyMd}
				spellcheck="false"></textarea>

			<details>
				<summary>SEO and corrections</summary>
				<div class="form-grid seo">
					<Field
						id="metaTitle"
						label="Meta title"
						optional
						count={$form.metaTitle.length}
						max={60}
						hint="Falls back to the article title."
						error={$errors.metaTitle}
					>
						{#snippet children({ id, describedBy, invalid })}
							<input
								{id}
								bind:value={$form.metaTitle}
								placeholder={$form.title}
								aria-describedby={describedBy}
								aria-invalid={invalid || undefined}
							/>
						{/snippet}
					</Field>

					<Field
						id="metaDesc"
						label="Meta description"
						optional
						count={$form.metaDesc.length}
						max={155}
						hint="Falls back to the excerpt."
						error={$errors.metaDesc}
					>
						{#snippet children({ id, describedBy, invalid })}
							<textarea
								{id}
								rows="2"
								bind:value={$form.metaDesc}
								aria-describedby={describedBy}
								aria-invalid={invalid || undefined}></textarea>
						{/snippet}
					</Field>

					<Field
						id="correction"
						label="Correction note"
						optional
						hint="Shown at the foot of the article, dated (PRD §6.4)."
					>
						{#snippet children({ id, describedBy })}
							<textarea {id} rows="3" bind:value={$form.correction} aria-describedby={describedBy}
							></textarea>
						{/snippet}
					</Field>
				</div>
			</details>

			<div class="form-actions">
				<Button type="submit" loading={$submitting} loadingLabel="Saving…">Save</Button>
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
		min-height: 1.75rem;
		padding: 0.1875rem 0.5rem;
		border-color: var(--border);
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text-2);
		font-size: 0.75rem;
		font-weight: var(--weight-body);
	}
	.toolbar :global(button:hover) {
		background: var(--surface-2);
		color: var(--text);
	}
	.library-search input {
		font-size: 0.8125rem;
	}
	.library {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		max-height: 12rem;
		overflow-y: auto;
	}
	.library :global(button) {
		padding: 0;
		border: 1px solid var(--border);
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
	.seo {
		margin-top: 0.75rem;
	}
	.preview-pane {
		position: sticky;
		top: 1rem;
		border: 1px solid var(--border);
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
		border-bottom: 1px solid var(--border);
		font-size: 0.8125rem;
	}
	.toc ol {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
	}
	.toc :global(.toc--3) {
		margin-left: 0.75rem;
		color: var(--text-3);
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
		border: 1px solid var(--border);
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
		background: var(--surface-2);
	}
	.rendered :global(.embed-error) {
		color: var(--danger);
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
	.ai-note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem 1rem;
		margin: 0 0 1rem;
		padding: 0.625rem 0.875rem;
		border-radius: var(--r-md);
		background: var(--accent-tint);
		font-size: 0.8125rem;
	}
	.ai-note--warn {
		background: var(--danger-tint);
	}
</style>
