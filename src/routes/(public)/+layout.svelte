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
		<a class="wordmark" href={urls.home(locale)}>
			<span class="wordmark__mark" aria-hidden="true"></span>
			VERUM
		</a>

		<nav aria-label={m.nav_menu()}>
			{#each data.categories as category (category.slug)}
				<a href={urls.category(locale, category.slug)}>{category.name ?? category.slug}</a>
			{/each}
		</nav>

		<div class="masthead__end">
			<a class="search-link" href={urls.search(locale)} aria-label={m.nav_search()}>
				<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
					<circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2" />
					<path
						d="M13.5 13.5 17 17"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
				<span>{m.nav_search()}</span>
			</a>
			<ThemeToggle />
		</div>
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
		padding: 0.625rem 1rem;
		border-radius: var(--r-md);
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
		z-index: 20;
	}
	.skip:focus {
		left: 0.75rem;
		top: 0.75rem;
	}

	/*
	 * Sticky, and opaque rather than blurred. A backdrop-filter repaints the
	 * strip behind it on every scroll frame, which is exactly the cost PRD
	 * §12.5's INP budget cannot spare.
	 */
	.masthead {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}
	.masthead__inner,
	.footer__inner {
		max-width: var(--wide);
		margin: 0 auto;
		padding: 0.75rem 1.5rem;
	}
	.masthead__inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.25rem;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		font-size: 1rem;
		font-weight: var(--weight-strong);
		letter-spacing: 0.18em;
		text-decoration: none;
	}
	.wordmark__mark {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--r-pill);
		background: var(--accent);
		box-shadow: var(--shadow-accent);
	}

	.masthead nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		flex: 1;
	}
	.masthead nav a {
		padding: 0.375rem 0.75rem;
		border-radius: var(--r-pill);
		color: var(--text-2);
		font-size: 0.875rem;
		text-decoration: none;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.masthead nav a:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.masthead__end {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.search-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: var(--r-pill);
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 0.8125rem;
		text-decoration: none;
		transition:
			background var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.search-link:hover {
		background: var(--accent-tint);
		color: var(--accent);
	}

	main {
		max-width: var(--wide);
		margin: 0 auto;
		padding: 2.5rem 1.5rem 4rem;
	}

	.footer {
		margin-top: 2rem;
		border-top: 1px solid var(--border);
		background: var(--surface-2);
	}
	.footer__inner {
		padding-top: 2.5rem;
		padding-bottom: 3rem;
	}
	.footer__tagline {
		max-width: 28rem;
		margin: 0 0 1.25rem;
		color: var(--text-2);
		font-size: 1rem;
	}
	.footer nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 1.5rem;
		font-size: 0.875rem;
	}
	.footer nav a {
		color: var(--text-2);
		text-decoration: none;
	}
	.footer nav a:hover {
		color: var(--accent);
	}
	.footer__rights {
		margin: 1.75rem 0 0;
		color: var(--text-3);
		font-size: 0.8125rem;
	}

	@media (max-width: 40rem) {
		/*
		 * Not sticky on a phone. The bar wraps to two rows there, and pinning
		 * 140px of chrome costs about a fifth of the viewport for the whole
		 * session — a worse trade than losing the shortcut back to the top.
		 */
		.masthead {
			position: static;
		}
		.masthead__inner {
			gap: 0.625rem 0.75rem;
			padding: 0.75rem 1.125rem;
		}
		.search-link span {
			display: none;
		}
		.masthead nav {
			order: 3;
			flex-basis: 100%;
			margin-left: -0.25rem;
		}
		.masthead__end {
			margin-left: auto;
		}
		main {
			padding: 1.75rem 1.125rem 3rem;
		}
	}
</style>
