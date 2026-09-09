<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const cards = [
		{ key: 'published', label: 'Published' },
		{ key: 'scheduled', label: 'Scheduled' },
		{ key: 'draft', label: 'Drafts' },
		{ key: 'archived', label: 'Archived' }
	] as const;

	const when = (value: Date | string) =>
		new Date(value).toISOString().slice(0, 16).replace('T', ' ');

	// PRD §5.1 sets the rhythm at 5 a week. Consistency beats volume, so this
	// is shown against the target rather than as a bare number.
	const paceLabel = $derived(
		data.pace.last7 >= 5 ? 'on target' : `${5 - data.pace.last7} behind this week`
	);
</script>

<svelte:head><title>Dashboard · VERUM</title></svelte:head>

<h1>Dashboard</h1>
<p class="who">
	Signed in as <strong data-testid="admin-email">{data.user.email}</strong>
	· mail: <code>{data.drivers.mail}</code>
	· storage: <code>{data.drivers.storage}</code>
</p>

<ul class="cards">
	{#each cards as card (card.key)}
		<li>
			<span class="n">{data.counts[card.key]}</span>
			<span class="l">{card.label}</span>
		</li>
	{/each}
	<li>
		<span class="n">{data.pace.last7}</span>
		<span class="l">Published this week · {paceLabel}</span>
	</li>
	<li>
		<span class="n">{data.pace.last28}</span>
		<span class="l">Last 28 days</span>
	</li>
	<li>
		<span class="n">{data.views30.toLocaleString()}</span>
		<span class="l">Views, 30 days</span>
	</li>
	<li>
		<span class="n">{data.subscribers.toLocaleString()}</span>
		<span class="l">Confirmed subscribers</span>
	</li>
</ul>

{#if data.upcoming.length}
	<section>
		<h2>Scheduled</h2>
		<table>
			<thead><tr><th>Title</th><th>Locale</th><th>Goes live</th></tr></thead>
			<tbody>
				{#each data.upcoming as row (`${row.id}-${row.locale}`)}
					<tr>
						<td>
							<a href={resolve('/(admin)/admin/(app)/articles/[id]', { id: String(row.id) })}>
								{row.title}
							</a>
						</td>
						<td><span class="pill">{row.locale}</span></td>
						<td class="num">{when(row.published_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<section>
	<h2>Most read, 30 days</h2>
	{#if data.top.length === 0}
		<p class="meta">
			No views recorded yet. Counts come from a beacon in the reader's browser, because article
			pages are served from the CDN and never reach this server.
		</p>
	{:else}
		<table>
			<thead><tr><th>Title</th><th>Locale</th><th>Views</th></tr></thead>
			<tbody>
				{#each data.top as row (`${row.article_id}-${row.locale}`)}
					<tr>
						<td>
							<a
								href={resolve('/(admin)/admin/(app)/articles/[id]', { id: String(row.article_id) })}
							>
								{row.title}
							</a>
						</td>
						<td><span class="pill">{row.locale}</span></td>
						<td class="num">{row.views.toLocaleString()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.who {
		margin: 0 0 2rem;
		color: #666;
		font-size: 0.875rem;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cards li {
		display: grid;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
	}
	.n {
		font-size: 1.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.l {
		font-size: 0.8125rem;
		color: #666;
	}
	section {
		margin-top: 2.5rem;
		max-width: 46rem;
	}
	h2 {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #666;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
