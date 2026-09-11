<script lang="ts">
	import { CircleAlert, CircleCheck, Info, X } from '@lucide/svelte';
	import { dismiss, toasts } from '$lib/toast.svelte';

	/**
	 * Renders the toast stack.
	 *
	 * The container is a polite live region and exists from first render, so a
	 * screen reader is already listening when a message arrives — a live region
	 * inserted at the same moment as its content is often not announced at all.
	 * Errors additionally carry role="alert" so they interrupt.
	 */
	const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };
</script>

<div class="toaster" aria-live="polite">
	{#each toasts as item (item.id)}
		{@const Icon = ICONS[item.type]}
		<div class="toast toast--{item.type}" role={item.type === 'error' ? 'alert' : 'status'}>
			<Icon size={17} aria-hidden="true" class="toast__icon" />
			<p class="toast__message">{item.message}</p>
			<button
				type="button"
				class="unstyled toast__close"
				aria-label="Dismiss notification"
				onclick={() => dismiss(item.id)}
			>
				<X size={14} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(22rem, calc(100vw - 2.5rem));
		pointer-events: none;
	}
	.toast {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 0.625rem;
		padding: 0.75rem 0.75rem 0.75rem 0.875rem;
		border: 1px solid var(--border);
		border-left-width: 3px;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-md);
		pointer-events: auto;
		animation: toast-in 180ms var(--ease);
	}
	.toast--success {
		border-left-color: var(--success);
	}
	.toast--error {
		border-left-color: var(--danger);
	}
	.toast--info {
		border-left-color: var(--accent);
	}
	.toast--success :global(.toast__icon) {
		color: var(--success);
	}
	.toast--error :global(.toast__icon) {
		color: var(--danger);
	}
	.toast--info :global(.toast__icon) {
		color: var(--accent);
	}
	.toast :global(.toast__icon) {
		margin-top: 0.0625rem;
	}
	.toast__message {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.toast__close {
		display: inline-flex;
		padding: 0.1875rem;
		border: 0;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text-3);
		cursor: pointer;
	}
	.toast__close:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
	}
	@media (max-width: 40rem) {
		.toaster {
			right: 0.75rem;
			left: 0.75rem;
			bottom: 0.75rem;
			width: auto;
		}
	}
</style>
