<script lang="ts">
	/**
	 * A reserved box for an ad, with no ad script in it yet.
	 *
	 * Two things are deliberate.
	 *
	 * First, the height is reserved in CSS before anything loads. Ad slots are
	 * the single biggest cause of layout shift on publisher sites (PRD §13.1),
	 * and reserving after the fact does not work — the shift has already
	 * happened.
	 *
	 * Second, nothing here loads a script. AdSense may only run after the CMP
	 * has a consent signal (PRD §14), so the tag is injected by the consent
	 * callback in Fase 8, into these boxes, by slot id. Hardcoding it in
	 * app.html would fire it before consent, which is the violation the whole
	 * CMP requirement exists to prevent.
	 */
	let {
		slot,
		minHeight = 280,
		label = 'Advertisement'
	}: { slot: string; minHeight?: number; label?: string } = $props();
</script>

<aside class="ad" data-ad-slot={slot} style="--ad-min-height: {minHeight}px" aria-label={label}>
	<span class="ad__label">{label}</span>
</aside>

<style>
	.ad {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--ad-min-height);
		margin: 2rem 0;
		border: 1px dashed var(--border);
		border-radius: 6px;
		background: var(--surface-2);
	}
	.ad__label {
		color: var(--text-3);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
