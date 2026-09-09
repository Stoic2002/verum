<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	/**
	 * Plain links, no vendor scripts.
	 *
	 * Every social share SDK is third-party JavaScript that sets cookies, which
	 * makes it a consent problem (PRD §14) and a performance cost, in exchange
	 * for a link that a URL already expresses.
	 */
	let { url, title }: { url: string; title: string } = $props();

	const encoded = $derived(encodeURIComponent(url));
	const text = $derived(encodeURIComponent(title));

	const targets = $derived([
		{ label: 'X', href: `https://x.com/intent/post?url=${encoded}&text=${text}` },
		{ label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` },
		{ label: 'WhatsApp', href: `https://api.whatsapp.com/send?text=${text}%20${encoded}` },
		{ label: 'Reddit', href: `https://www.reddit.com/submit?url=${encoded}&title=${text}` }
	]);

	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked; the address bar still has the URL.
		}
	}
</script>

<div class="share">
	<span class="share__label">{m.article_share()}</span>

	{#each targets as target (target.label)}
		<a href={target.href} rel="noopener nofollow" target="_blank">{target.label}</a>
	{/each}

	<button type="button" onclick={copy} class="copy">
		{copied ? m.article_share_copied() : m.article_share_copy()}
	</button>
</div>

<style>
	.share {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8125rem;
	}
	.share__label {
		color: var(--text-3);
	}
	.copy {
		display: none;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		text-decoration: underline;
	}
	:global(html.js) .copy {
		display: inline;
	}
</style>
