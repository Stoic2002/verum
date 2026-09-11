<script lang="ts">
	let { status }: { status: string } = $props();

	const LABELS: Record<string, [string, string]> = {
		queued: ['Queued', 'active'],
		researching: ['Researching', 'active'],
		review: ['Needs your review', 'review'],
		drafting: ['Writing draft', 'active'],
		done: ['Draft ready', 'done'],
		failed: ['Failed', 'failed'],
		cancelled: ['Cancelled', 'muted']
	};

	const [label, tone] = $derived(LABELS[status] ?? [status, 'muted']);
</script>

<span class="status status--{tone}">{label}</span>

<style>
	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		white-space: nowrap;
	}
	.status--active {
		background: var(--accent-tint);
		color: var(--accent);
	}
	.status--active::before {
		content: '';
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		background: currentColor;
		animation: pulse 1.2s ease-in-out infinite;
	}
	.status--review {
		background: var(--accent-tint-strong);
		color: var(--accent);
	}
	.status--done {
		background: var(--success-tint);
		color: var(--success);
	}
	.status--failed {
		background: var(--danger-tint);
		color: var(--danger);
	}
	.status--muted {
		background: var(--surface-3);
		color: var(--text-3);
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}
</style>
