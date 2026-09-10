<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Label, hint, error and counter around one control.
	 *
	 * Wiring the ids here is the point: `for`/`id`, `aria-describedby` and
	 * `aria-invalid` are easy to forget per form and impossible to notice
	 * missing without a screen reader.
	 */
	let {
		id,
		label,
		hint,
		error,
		optional = false,
		count,
		max,
		children
	}: {
		id: string;
		label: string;
		hint?: string;
		error?: string | string[] | null;
		optional?: boolean;
		/** Current length, shown against `max`. */
		count?: number;
		max?: number;
		children: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
	} = $props();

	const message = $derived(Array.isArray(error) ? error[0] : error);
	const invalid = $derived(Boolean(message));

	const hintId = $derived(hint ? `${id}-hint` : undefined);
	const errorId = $derived(message ? `${id}-error` : undefined);
	const describedBy = $derived([errorId, hintId].filter(Boolean).join(' ') || undefined);
</script>

<div class="field">
	<label class="field__label" for={id}>
		{label}
		{#if optional}<span class="field__optional">optional</span>{/if}
		{#if max !== undefined}
			<span class="field__counter" data-over={(count ?? 0) > max}>{count ?? 0}/{max}</span>
		{/if}
	</label>

	{@render children({ id, describedBy, invalid })}

	{#if message}
		<p class="field__error" id={errorId} role="alert">
			<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
				<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
				<path d="M8 4.5v4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
				<circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
			</svg>
			{message}
		</p>
	{:else if hint}
		<p class="field__hint" id={hintId}>{hint}</p>
	{/if}
</div>
