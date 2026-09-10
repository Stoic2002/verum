<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Dev inbox · VERUM</title></svelte:head>

<h1>Dev inbox</h1>
<p class="meta">
	Mail captured by the log driver, newest first. Configure SMTP in <code>.env</code> and this page stops
	existing.
</p>

{#if data.messages.length === 0}
	<p class="meta">Nothing sent yet.</p>
{:else}
	{#each data.messages as message (message.at + message.to)}
		<article>
			<p class="head">
				<strong>{message.subject}</strong>
				<span class="meta">to {message.to} · {new Date(message.at).toLocaleString()}</span>
			</p>
			<pre>{message.text}</pre>
		</article>
	{/each}
{/if}

<style>
	article {
		margin: 1rem 0;
		padding: 0.875rem 1rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		max-width: 46rem;
	}
	.head {
		display: grid;
		gap: 0.125rem;
		margin: 0 0 0.5rem;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.8125rem;
		color: var(--text-2);
	}
</style>
