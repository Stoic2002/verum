<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Renders a <button> or an <a> from the same props.
	 *
	 * A link that looks like a button must still be a link — right-click,
	 * middle-click and "open in new tab" all break when a navigation is
	 * implemented as a button with an onclick.
	 */
	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		loadingLabel,
		formaction,
		onclick,
		title,
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		loadingLabel?: string;
		formaction?: string;
		onclick?: (event: MouseEvent) => void;
		title?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	const classes = $derived(
		['btn', variant !== 'primary' && `btn--${variant}`, size === 'sm' && 'btn--sm']
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href}
	<a class={classes} {href} {title} aria-disabled={disabled || undefined} {...rest}>
		{@render children()}
	</a>
{:else}
	<button
		class={classes}
		{type}
		{title}
		{formaction}
		{onclick}
		disabled={disabled || loading}
		aria-busy={loading || undefined}
		{...rest}
	>
		{#if loading}
			<!-- The label changes too: a spinner alone tells a screen reader nothing. -->
			<svg class="spin" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
				<circle
					cx="8"
					cy="8"
					r="6.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					opacity="0.25"
				/>
				<path
					d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
			{loadingLabel ?? ''}
		{/if}
		{#if !loading || !loadingLabel}
			{@render children()}
		{/if}
	</button>
{/if}

<style>
	.spin {
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	a[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.55;
	}
</style>
