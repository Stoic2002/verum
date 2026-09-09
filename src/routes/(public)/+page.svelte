<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { locales, localizeHref } from '$lib/paraglide/runtime';

	let { data } = $props();
</script>

<h1>VERUM</h1>

<p>{m.phase0_smoke()}</p>
<p><code data-testid="locale">{data.locale}</code></p>

<nav>
	{#each locales as locale (locale)}
		<!-- localizeHref returns a locale-prefixed path, which is not in the route
		     tree (hooks.ts delocalises before matching), hence the cast. Fase 5
		     replaces this with a shared link helper. -->
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)} hreflang={locale}>
			{locale}
		</a>
	{/each}
</nav>
