<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/forms.css';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import * as urls from '$lib/urls';
	import LanguageSwitch from '$lib/components/LanguageSwitch.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	const locale = getLocale();
	const year = new Date().getFullYear();

	/**
	 * Written in the browser, not on the server: pages sit in the CDN for up to
	 * a day, and a server-rendered date would show yesterday. The span keeps its
	 * width either way, so filling it causes no shift.
	 */
	let today = $state('');
	onMount(() => {
		today = new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date());
	});

	let topicsOpen = $state(false);
	afterNavigate(() => {
		topicsOpen = false;
	});

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

<svelte:window
	onclick={(event) => {
		if (topicsOpen && !(event.target as Element).closest('.topics')) topicsOpen = false;
	}}
/>

<div class="topbar">
	<div class="topbar__inner">
		<p class="topbar__news">
			<span class="topbar__date">{today}</span>
			{#if data.trending.length}
				<span class="topbar__label">{m.header_trending()}</span>
				{#each data.trending.slice(0, 3) as item (item.id)}
					<a href={item.href}>{item.title}</a>
				{/each}
			{/if}
		</p>
		<div class="topbar__controls">
			<LanguageSwitch />
			<ThemeToggle />
		</div>
	</div>
</div>

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
			{#if data.topics.length}
				<details class="topics" bind:open={topicsOpen}>
					<summary>{m.nav_topics()}</summary>
					<ul>
						{#each data.topics as topic (topic.slug)}
							<li><a href={urls.topic(locale, topic.slug)}>{topic.title}</a></li>
						{/each}
					</ul>
				</details>
			{/if}
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
		</div>
	</div>
</header>

<main id="content">
	{@render children()}
</main>

<footer class="footer">
	<div class="footer__inner">
		<div class="footer__grid">
			<div class="footer__brand">
				<p class="footer__wordmark">
					<span class="wordmark__mark" aria-hidden="true"></span>
					VERUM
				</p>
				<p class="footer__tagline">{m.site_tagline()}</p>
				<p class="footer__blurb">{m.footer_blurb()}</p>
			</div>

			<nav class="footer__col" aria-label={m.footer_categories()}>
				<h2>{m.footer_categories()}</h2>
				<ul>
					{#each data.categories as category (category.slug)}
						<li>
							<a href={urls.category(locale, category.slug)}>{category.name ?? category.slug}</a>
						</li>
					{/each}
				</ul>
			</nav>

			{#if data.topics.length}
				<nav class="footer__col" aria-label={m.footer_topics()}>
					<h2>{m.footer_topics()}</h2>
					<ul>
						{#each data.topics.slice(0, 6) as topic (topic.slug)}
							<li><a href={urls.topic(locale, topic.slug)}>{topic.title}</a></li>
						{/each}
					</ul>
				</nav>
			{/if}

			<nav class="footer__col" aria-label="Footer">
				<h2>{m.footer_site()}</h2>
				<ul>
					<li><a href={urls.page(locale, 'about')}>{m.footer_about()}</a></li>
					<li><a href={urls.page(locale, 'editorial-policy')}>{m.footer_editorial()}</a></li>
					<li><a href={urls.page(locale, 'contact')}>{m.footer_contact()}</a></li>
					<li><a href={urls.page(locale, 'privacy')}>{m.footer_privacy()}</a></li>
					<li><a href={urls.page(locale, 'terms')}>{m.footer_terms()}</a></li>
				</ul>
			</nav>
		</div>
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
	.topbar {
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		font-size: 0.75rem;
	}
	.topbar__inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: var(--wide);
		margin: 0 auto;
		padding: 0.375rem 1.5rem;
	}
	.topbar__news {
		display: flex;
		align-items: center;
		gap: 0.375rem 1rem;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		color: var(--text-3);
		white-space: nowrap;
	}
	.topbar__date {
		display: inline-block;
		min-width: 12rem;
	}
	.topbar__label {
		color: var(--accent);
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.topbar__news a {
		max-width: 24ch;
		overflow: hidden;
		color: var(--text-2);
		text-decoration: none;
		text-overflow: ellipsis;
	}
	.topbar__news a:hover {
		color: var(--accent);
	}
	.topbar__controls {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.625rem;
	}

	.topics {
		position: relative;
	}
	.topics summary {
		padding: 0.375rem 0.75rem;
		border-radius: var(--r-md);
		color: var(--text-2);
		font-size: 0.875rem;
		list-style: none;
		cursor: pointer;
	}
	.topics summary::-webkit-details-marker {
		display: none;
	}
	.topics summary::after {
		content: '';
		display: inline-block;
		width: 0.375rem;
		height: 0.375rem;
		margin-left: 0.4375rem;
		border-right: 1.5px solid currentColor;
		border-bottom: 1.5px solid currentColor;
		transform: translateY(-0.1875rem) rotate(45deg);
	}
	.topics summary:hover,
	.topics[open] summary {
		background: var(--surface-3);
		color: var(--text);
	}
	.topics ul {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 0;
		z-index: 20;
		display: grid;
		min-width: 13rem;
		margin: 0;
		padding: 0.375rem;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow-md);
		list-style: none;
	}
	.topics ul a {
		display: block;
		padding: 0.4375rem 0.625rem;
		border-radius: var(--r-md);
		color: var(--text-2);
		font-size: 0.875rem;
		text-decoration: none;
	}
	.topics ul a:hover {
		background: var(--surface-3);
		color: var(--text);
	}

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
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		flex: 1;
	}
	.masthead nav a {
		padding: 0.375rem 0.75rem;
		border-radius: var(--r-md);
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
		border-radius: var(--r-md);
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
		padding-top: 3rem;
		padding-bottom: 2.5rem;
	}
	.footer__grid {
		display: grid;
		gap: 2rem 2.5rem;
		grid-template-columns: minmax(0, 1.6fr) repeat(auto-fit, minmax(10rem, 1fr));
	}
	.footer__wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.875rem;
		color: var(--text);
		font-weight: var(--weight-strong);
		letter-spacing: 0.18em;
	}
	.footer__tagline {
		max-width: 26rem;
		margin: 0 0 0.5rem;
		color: var(--text);
		font-size: 1.0625rem;
		font-weight: var(--weight-strong);
		letter-spacing: -0.01em;
	}
	.footer__blurb {
		max-width: 26rem;
		margin: 0;
		color: var(--text-2);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.footer__col h2 {
		margin: 0 0 0.875rem;
		color: var(--text-3);
		font-size: 0.75rem;
		font-weight: var(--weight-strong);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.footer__col ul {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}
	.footer__col a {
		color: var(--text-2);
		text-decoration: none;
	}
	.footer__col a:hover {
		color: var(--accent);
	}
	.footer__rights {
		margin: 2.5rem 0 0;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
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
		.topbar__inner {
			padding: 0.375rem 1.125rem;
		}
		/* A phone keeps the controls; the date and headlines are for wider screens. */
		.topbar__news {
			display: none;
		}
		.topbar__controls {
			margin-left: auto;
		}
		.topics ul {
			right: 0;
			left: auto;
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
