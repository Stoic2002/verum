<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const localeOf = (locale: string) => data.topic.locales.find((row) => row.locale === locale);
</script>

<svelte:head><title>Topic: {data.topic.slug} · VERUM</title></svelte:head>

<header class="head">
	<h1>Topic <code>{data.topic.slug}</code></h1>
	<a href={resolve('/(admin)/admin/(app)/topics')}>← All topics</a>
</header>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.saved}<p class="notice">Saved {form.saved}.</p>{/if}

{#each data.locales as locale (locale)}
	{@const row = localeOf(locale)}
	<section>
		<h2>{locale}</h2>
		<form method="POST" action="?/saveLocale" class="form-grid">
			<input type="hidden" name="locale" value={locale} />

			<label for="title-{locale}">Title</label>
			<input id="title-{locale}" name="title" value={row?.title ?? ''} />

			<label for="intro-{locale}">
				Introduction
				<span class="meta">Markdown. Original prose — this is what makes the page rank.</span>
			</label>
			<textarea id="intro-{locale}" name="introMd" rows="6">{row?.introMd ?? ''}</textarea>

			<div><button type="submit">Save {locale}</button></div>
		</form>
	</section>
{/each}

<section>
	<h2>Articles</h2>
	<form method="POST" action="?/setArticles" class="form-grid">
		<div class="picker">
			{#each data.articles as article (article.id)}
				<label class="check">
					<input
						type="checkbox"
						name="articleIds"
						value={article.id}
						checked={data.topic.articleIds.includes(Number(article.id))}
					/>
					{article.locales[0]?.title ?? `#${article.id}`}
					<span class="meta">({article.category_slug})</span>
				</label>
			{/each}
		</div>
		<div><button type="submit">Save selection</button></div>
	</form>
</section>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	section {
		margin: 2rem 0;
		max-width: 42rem;
	}
	h2 {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.picker {
		display: grid;
		gap: 0.25rem;
		max-height: 18rem;
		overflow-y: auto;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
</style>
