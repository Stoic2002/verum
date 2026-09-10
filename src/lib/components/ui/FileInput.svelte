<script lang="ts">
	/**
	 * A file input with a drop zone and a preview of what was chosen.
	 *
	 * The native <input type="file"> stays in the DOM and stays the thing that
	 * receives the file — dropping is added on top of it rather than replacing
	 * it, so the keyboard path and the form submission are unchanged.
	 */
	let {
		id,
		name,
		accept,
		hint,
		disabled = false,
		required = false,
		describedBy
	}: {
		id: string;
		name: string;
		accept?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		describedBy?: string;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let chosen = $state<{ name: string; size: number } | null>(null);
	let previewUrl = $state<string | null>(null);

	const kb = (bytes: number) =>
		bytes > 1024 * 1024
			? `${(bytes / 1024 / 1024).toFixed(1)} MB`
			: `${Math.round(bytes / 1024)} KB`;

	function adopt(files: FileList | null) {
		const file = files?.[0] ?? null;

		// Object URLs are not garbage collected on their own.
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;

		if (!file) {
			chosen = null;
			return;
		}

		chosen = { name: file.name, size: file.size };
		if (file.type.startsWith('image/')) previewUrl = URL.createObjectURL(file);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		if (disabled || !input) return;

		const files = event.dataTransfer?.files;
		if (!files?.length) return;

		// Assigning to the real input is what keeps the form submission normal.
		input.files = files;
		adopt(files);
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function clear() {
		if (!input) return;
		input.value = '';
		adopt(null);
	}

	$effect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});
</script>

<!--
	The wrapper is decoration; every interaction it offers is also available on
	the input inside it, so no keyboard handler is needed here.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="drop"
	class:drop--active={dragging}
	class:drop--disabled={disabled}
	ondragover={(e) => {
		e.preventDefault();
		if (!disabled) dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	<input
		bind:this={input}
		{id}
		{name}
		{accept}
		{disabled}
		{required}
		type="file"
		aria-describedby={describedBy}
		onchange={(e) => adopt(e.currentTarget.files)}
	/>

	{#if hint}<p class="field__hint drop__hint">{hint}</p>{/if}

	{#if chosen}
		<div class="chosen">
			{#if previewUrl}
				<img src={previewUrl} alt="" width="56" height="42" />
			{/if}
			<div class="chosen__meta">
				<span class="chosen__name">{chosen.name}</span>
				<span class="field__hint">{kb(chosen.size)}</span>
			</div>
			<button type="button" class="btn btn--ghost btn--sm" onclick={clear}>Remove</button>
		</div>
	{/if}
</div>

<style>
	.drop {
		display: grid;
		gap: 0.5rem;
	}
	.drop--active :global(input[type='file']) {
		border-color: var(--accent);
		background: var(--accent-tint);
	}
	.drop--disabled {
		opacity: 0.6;
	}
	.drop__hint {
		margin: 0;
	}
	.chosen {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
	}
	.chosen img {
		width: 3.5rem;
		height: 2.625rem;
		object-fit: cover;
		border-radius: var(--r-sm);
		background: var(--surface-2);
	}
	.chosen__meta {
		display: grid;
		min-width: 0;
	}
	.chosen__name {
		font-size: 0.8125rem;
		font-weight: var(--weight-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chosen :global(.field__hint) {
		font-size: 0.75rem;
	}
	.chosen button {
		margin-left: auto;
	}
</style>
