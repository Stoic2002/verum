import { navigating, page } from '$app/state';

/**
 * Whether a navigation has been waiting long enough to deserve a skeleton.
 *
 * SvelteKit keeps the old page until the next one's data arrives. Swapping in
 * a skeleton at once would flash on every fast navigation — most of them, with
 * data preloaded on hover — so it appears only after `delay` ms.
 *
 * A change of hash alone is not a navigation to wait for: the table of
 * contents must not blank the article it is scrolling through.
 *
 * Call during component initialisation.
 */
export function delayedNavigation(delay = 150) {
	let show = $state(false);

	$effect(() => {
		const to = navigating.to;
		const samePage =
			to && to.url.pathname === page.url.pathname && to.url.search === page.url.search;

		if (!to || samePage) {
			show = false;
			return;
		}

		const timer = setTimeout(() => {
			show = true;
		}, delay);
		return () => {
			clearTimeout(timer);
			show = false;
		};
	});

	return {
		get show() {
			return show;
		},
		/** Route id of the destination, to pick a skeleton that looks like it. */
		get routeId() {
			return navigating.to?.route.id ?? null;
		}
	};
}
