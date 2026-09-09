<script lang="ts">
	import '$lib/styles/tokens.css';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { data, children } = $props();

	const locale = getLocale();
	const year = new Date().getFullYear();

	/**
	 * Marks the document as scripted.
	 *
	 * Controls that cannot work without JavaScript — the theme toggle, copy
	 * link — stay hidden until this runs, so nothing dead is ever offered.
	 * Everything else on the page works with JavaScript switched off.
	 */
	$effect(() => {
		document.documentElement.classList.add('js');
	});
</script>

<a class="skip" href="#content">{m.nav_skip()}</a>

<header class="masthead">
	<div class="masthead__inner">
		<a class="wordmark" href={urls.home(locale)}>VERUM</a>

		<nav aria-label={m.nav_menu()}>
			{#each data.categories as category (category.slug)}
				<a href={urls.category(locale, category.slug)}>{category.name ?? category.slug}</a>
			{/each}
			<a href={urls.search(locale)}>{m.nav_search()}</a>
		</nav>

		<ThemeToggle />
	</div>
</header>

<main id="content">
	{@render children()}
</main>

<footer class="footer">
	<div class="footer__inner">
		<p class="footer__tagline">{m.site_tagline()}</p>
		<nav aria-label="Footer">
			<a href={urls.page(locale, 'about')}>{m.footer_about()}</a>
			<a href={urls.page(locale, 'editorial-policy')}>{m.footer_editorial()}</a>
			<a href={urls.page(locale, 'contact')}>{m.footer_contact()}</a>
			<a href={urls.page(locale, 'privacy')}>{m.footer_privacy()}</a>
			<a href={urls.page(locale, 'terms')}>{m.footer_terms()}</a>
			<a href="/rss.xml">RSS</a>
		</nav>
		<p class="footer__rights">{m.footer_rights({ year })}</p>
	</div>
</footer>

<style>
	.skip {
		position: absolute;
		left: -9999px;
		top: 0;
		padding: 0.5rem 0.875rem;
		background: var(--surface);
		border: 1px solid var(--border);
		z-index: 10;
	}
	.skip:focus {
		left: 0.5rem;
		top: 0.5rem;
	}

	.masthead {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.masthead__inner,
	.footer__inner {
		max-width: var(--wide);
		margin: 0 auto;
		padding: 0.875rem 1.25rem;
	}
	.masthead__inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}
	.wordmark {
		color: var(--text);
		font-weight: 700;
		font-size: 1.0625rem;
		letter-spacing: 0.14em;
		text-decoration: none;
	}
	.masthead nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		flex: 1;
		font-size: 0.875rem;
	}
	.masthead nav a {
		color: var(--text-2);
		text-decoration: none;
	}
	.masthead nav a:hover {
		color: var(--accent);
	}

	main {
		max-width: var(--wide);
		margin: 0 auto;
		padding: 2rem 1.25rem 3rem;
	}

	.footer {
		border-top: 1px solid var(--border);
		background: var(--surface);
	}
	.footer__inner {
		padding-top: 1.75rem;
		padding-bottom: 2rem;
	}
	.footer__tagline {
		margin: 0 0 0.75rem;
		color: var(--text-2);
		font-size: 0.875rem;
	}
	.footer nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.8125rem;
	}
	.footer nav a {
		color: var(--text-2);
		text-decoration: none;
	}
	.footer__rights {
		margin: 1rem 0 0;
		color: var(--text-3);
		font-size: 0.75rem;
	}
</style>
