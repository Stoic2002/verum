<script lang="ts">
	let { data } = $props();

	const cards = [
		{ key: 'published', label: 'Published' },
		{ key: 'scheduled', label: 'Scheduled' },
		{ key: 'draft', label: 'Drafts' },
		{ key: 'archived', label: 'Archived' }
	] as const;
</script>

<svelte:head><title>Dashboard · VERUM</title></svelte:head>

<h1>Dashboard</h1>
<p class="who">Signed in as <strong data-testid="admin-email">{data.user.email}</strong></p>

<ul class="cards">
	{#each cards as card (card.key)}
		<li>
			<span class="n">{data.counts[card.key]}</span>
			<span class="l">{card.label}</span>
		</li>
	{/each}
</ul>

<style>
	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.375rem;
	}
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
		max-width: 44rem;
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
</style>
