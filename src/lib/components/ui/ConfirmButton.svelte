<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A submit button that asks first, in a real dialog.
	 *
	 * Built on the native <dialog> with showModal(): the browser traps focus
	 * inside it, makes the page behind inert, closes it on Escape, and returns
	 * focus to the button afterwards. A hand-rolled modal has to reimplement
	 * all four, and usually misses one.
	 *
	 * The trigger is a genuine submit button. With JavaScript, its click opens
	 * the dialog instead; without it, the form submits directly — the same
	 * behaviour the old window.confirm() had, since that needed script too.
	 */
	let {
		title,
		message,
		confirmLabel = 'Confirm',
		tone = 'danger',
		formaction,
		class: className = 'btn btn--danger',
		ariaLabel,
		hint,
		children
	}: {
		title: string;
		message: string;
		confirmLabel?: string;
		tone?: 'danger' | 'neutral';
		formaction?: string;
		class?: string;
		ariaLabel?: string;
		/** Tooltip on the trigger. Not the dialog's `title`. */
		hint?: string;
		children: Snippet;
	} = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();

	function open(event: MouseEvent) {
		event.preventDefault();
		dialog?.showModal();
	}

	function confirm() {
		dialog?.close();
		// Submitting through the original button keeps its formaction, so one
		// form can carry several confirmed actions.
		trigger?.form?.requestSubmit(trigger);
	}

	function closeOnBackdrop(event: MouseEvent) {
		// A click on the dialog element itself, rather than on its content, is a
		// click on the backdrop.
		if (event.target === dialog) dialog?.close();
	}
</script>

<button
	bind:this={trigger}
	type="submit"
	class={className}
	{formaction}
	aria-label={ariaLabel}
	title={hint}
	aria-haspopup="dialog"
	onclick={open}
>
	{@render children()}
</button>

<!-- Escape and focus are handled by the browser; the click handler only catches the backdrop. -->
<dialog
	bind:this={dialog}
	class="confirm"
	aria-labelledby="{id}-title"
	aria-describedby="{id}-message"
	onclick={closeOnBackdrop}
>
	<div class="confirm__body">
		<h2 id="{id}-title" class="confirm__title">{title}</h2>
		<p id="{id}-message" class="confirm__message">{message}</p>

		<div class="confirm__actions">
			<button type="button" class="btn btn--secondary" onclick={() => dialog?.close()}>
				Cancel
			</button>
			<button
				type="button"
				class="btn confirm__ok"
				class:confirm__ok--danger={tone === 'danger'}
				onclick={confirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>

<style>
	.confirm {
		width: min(26rem, calc(100vw - 2rem));
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-md);
	}
	.confirm::backdrop {
		background: hsl(220 30% 8% / 0.5);
	}
	.confirm[open] {
		animation: confirm-in 160ms var(--ease);
	}
	.confirm__body {
		padding: 1.25rem 1.375rem 1.125rem;
	}
	.confirm__title {
		margin: 0 0 0.5rem;
		font-size: 1.0625rem;
		letter-spacing: -0.01em;
	}
	.confirm__message {
		margin: 0 0 1.25rem;
		color: var(--text-2);
		font-size: 0.875rem;
		line-height: 1.55;
	}
	.confirm__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.confirm__ok--danger {
		background: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}
	.confirm__ok--danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--danger) 85%, #000);
		color: #fff;
	}
	@keyframes confirm-in {
		from {
			opacity: 0;
			transform: translateY(0.375rem) scale(0.98);
		}
	}
</style>
