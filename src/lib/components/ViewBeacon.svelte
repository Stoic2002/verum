<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * Reports one view, once, after the page is interactive.
	 *
	 * sendBeacon when available: it survives the page being closed and never
	 * competes with rendering. fetch with keepalive is the fallback. Either way
	 * a failure is ignored — a missed count is not worth a console error in a
	 * reader's browser.
	 */
	let { articleId }: { articleId: number } = $props();

	const locale = getLocale();

	$effect(() => {
		const body = JSON.stringify({ articleId, locale });

		try {
			if (navigator.sendBeacon) {
				navigator.sendBeacon('/api/view', new Blob([body], { type: 'application/json' }));
				return;
			}
			void fetch('/api/view', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
				keepalive: true
			}).catch(() => {});
		} catch {
			// Blocked by an extension or a strict privacy setting. Fine.
		}
	});
</script>
