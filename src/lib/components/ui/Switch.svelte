<script lang="ts">
	/**
	 * A boolean that takes effect on save, drawn as a switch rather than a
	 * checkbox because the label reads as a state ("Living article") rather
	 * than an item being selected.
	 */
	let {
		id,
		checked = $bindable(false),
		label,
		hint,
		disabled = false
	}: {
		id: string;
		checked?: boolean;
		label: string;
		hint?: string;
		disabled?: boolean;
	} = $props();
</script>

<div class="switch-field">
	<label class="switch" for={id}>
		<input {id} type="checkbox" role="switch" bind:checked {disabled} />
		<span>{label}</span>
	</label>
	{#if hint}<p class="field__hint">{hint}</p>{/if}
</div>

<style>
	.switch-field {
		display: grid;
		gap: 0.25rem;
	}
	.switch-field :global(.field__hint) {
		margin-left: 2.875rem;
	}
</style>
