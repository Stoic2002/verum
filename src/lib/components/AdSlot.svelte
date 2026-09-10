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
		label = 'Advertisement',
		variant = 'inline'
	}: {
		slot: string;
		minHeight?: number;
		label?: string;
		/** 'rail' is the tall unit beside the article on wide screens. */
		variant?: 'inline' | 'rail';
	} = $props();
</script>

<!--
	The Fase 8 consent callback fills these by data-ad-slot. It must skip any
	slot with no layout box: the rails are display:none below their breakpoint
	and the inline slot is hidden above it, and filling a hidden container is
	both wasted inventory and against AdSense policy.
-->
<aside
	class="ad ad--{variant}"
	data-ad-slot={slot}
	style="--ad-min-height: {minHeight}px"
	aria-label={label}
>
	<span class="ad__label">{label}</span>
</aside>

<style>
	.ad {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--ad-min-height);
		border: 1px dashed var(--border-strong);
		border-radius: var(--r-lg);
		background: var(--surface-2);
	}
	.ad--inline {
		margin: 2.5rem 0;
	}
	.ad--rail {
		/*
		 * Sticks below the masthead as the article scrolls past. `top` clears the
		 * sticky header; without it the unit slides under it.
		 */
		position: sticky;
		top: 5rem;
		width: 100%;
	}
	.ad__label {
		color: var(--text-3);
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		text-transform: uppercase;
		letter-spacing: var(--track-label);
	}
</style>
