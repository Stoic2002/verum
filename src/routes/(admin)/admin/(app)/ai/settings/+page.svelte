<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { MODEL_PROVIDERS, SEARCH_PROVIDERS } from '$lib/ai-providers';
	import { Button, ConfirmButton, Field } from '$lib/components/ui';
	import { enhanceWithToast } from '$lib/toast.svelte';
	import CredentialForm from './CredentialForm.svelte';

	let { data } = $props();
	let editing = $state<number | null>(null);

	const providerLabel = (kind: string) =>
		(MODEL_PROVIDERS as Record<string, { label: string }>)[kind]?.label ??
		(SEARCH_PROVIDERS as Record<string, { label: string }>)[kind]?.label ??
		kind;
	const price = (value: number | null) => (value === null ? '—' : `$${value}`);
</script>

<svelte:head><title>AI settings · VERUM</title></svelte:head>

<p class="meta"><a href={resolve('/(admin)/admin/(app)/ai')}>← AI writer</a></p>
<h1>AI providers &amp; settings</h1>
<p class="meta intro">
	Keys are encrypted with <code>AI_KEY_SECRET</code> before they reach the database, and never sent to
	the browser again. Remove a provider and its key is deleted.
</p>

{#if !data.secretsReady}
	<div class="warning" role="alert">
		<strong>Keys cannot be stored yet.</strong> Set <code>AI_KEY_SECRET</code> in <code>.env</code>
		(generate one with <code>openssl rand -base64 48</code>) and restart the server.
	</div>
{/if}

{#snippet list(items: typeof data.models, purpose: 'model' | 'search')}
	{#if items.length === 0}
		<p class="empty">None yet.</p>
	{:else}
		<ul class="credentials">
			{#each items as item (item.id)}
				<li class="credential">
					<div class="credential__row">
						<div>
							<strong>{item.label}</strong>
							<span class="meta">
								{providerLabel(item.kind)}{#if item.model}
									· <code>{item.model}</code>{/if}
								· key {item.keyHint ?? 'none'}
								{#if purpose === 'model'}· in {price(item.inputUsdPerMtok)} / out {price(
										item.outputUsdPerMtok
									)} per 1M{/if}
							</span>
						</div>
						<div class="credential__actions">
							<form method="POST" action="?/testCredential" use:enhance={enhanceWithToast()}>
								<input type="hidden" name="id" value={item.id} />
								<Button type="submit" size="sm" variant="secondary">Test</Button>
							</form>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => (editing = editing === item.id ? null : item.id)}
							>
								{editing === item.id ? 'Close' : 'Edit'}
							</Button>
							<form method="POST" action="?/deleteCredential" use:enhance={enhanceWithToast()}>
								<input type="hidden" name="id" value={item.id} />
								<ConfirmButton
									class="btn btn--danger btn--sm"
									title="Remove {item.label}?"
									message="The stored key is deleted. Past drafts keep their record, but ones still running or under review with this provider cannot continue."
									confirmLabel="Remove provider"
								>
									Remove
								</ConfirmButton>
							</form>
						</div>
					</div>
					{#if editing === item.id}
						<CredentialForm
							{purpose}
							credential={item}
							disabled={!data.secretsReady}
							onsaved={() => (editing = null)}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<section>
	<h2>Model providers</h2>
	{@render list(data.models, 'model')}
	<details class="add" open={data.models.length === 0}>
		<summary>Add a model provider</summary>
		<CredentialForm purpose="model" disabled={!data.secretsReady} />
	</details>
</section>

<section>
	<h2>Search providers</h2>
	<p class="meta">
		Optional. Without one, the writer reads only the URLs you give it — often the better choice for
		a story with a known primary source.
	</p>
	{@render list(data.searches, 'search')}
	<details class="add" open={false}>
		<summary>Add a search provider</summary>
		<CredentialForm purpose="search" disabled={!data.secretsReady} />
	</details>
</section>

<section>
	<h2>Editorial guard rails</h2>
	<form
		method="POST"
		action="?/saveSettings"
		class="form-grid guard"
		use:enhance={enhanceWithToast()}
	>
		<div class="row">
			<Field
				id="trustedDomains"
				label="Trusted publishers"
				optional
				hint="One domain per line. Marked as trusted in the source list; nothing is skipped."
			>
				{#snippet children({ id, describedBy })}
					<textarea
						{id}
						name="trustedDomains"
						rows="5"
						spellcheck="false"
						placeholder="reuters.com"
						aria-describedby={describedBy}>{data.settings.trustedDomains}</textarea
					>
				{/snippet}
			</Field>
			<Field
				id="blockedDomains"
				label="Blocked domains"
				optional
				hint="Never read, including their subdomains: content farms, sites you do not cite."
			>
				{#snippet children({ id, describedBy })}
					<textarea
						{id}
						name="blockedDomains"
						rows="5"
						spellcheck="false"
						aria-describedby={describedBy}>{data.settings.blockedDomains}</textarea
					>
				{/snippet}
			</Field>
		</div>
		<div class="row">
			<Field
				id="weeklyLimit"
				label="Drafts per 7 days"
				hint="PRD §17 caps output at five articles a week."
			>
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="weeklyLimit"
						type="number"
						min="0"
						max="100"
						step="1"
						value={data.settings.weeklyLimit}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>
			<Field
				id="monthlyBudgetUsd"
				label="Monthly budget (USD)"
				optional
				hint="New drafts stop once reached. Needs prices on the providers."
			>
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="monthlyBudgetUsd"
						type="number"
						min="0"
						step="0.01"
						value={data.settings.monthlyBudgetUsd ?? ''}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>
		</div>
		<div><Button type="submit">Save settings</Button></div>
	</form>
</section>

<style>
	.intro {
		max-width: 46rem;
	}
	.warning {
		max-width: 46rem;
		margin: 1rem 0;
		padding: 0.875rem 1.125rem;
		border-radius: var(--r-lg);
		background: var(--danger-tint);
		font-size: 0.875rem;
	}
	section {
		max-width: 46rem;
		margin-top: 2.25rem;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.credentials {
		display: grid;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding: 0;
		list-style: none;
	}
	.credential {
		padding: 0.75rem 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
	}
	.credential__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.credential__row .meta {
		display: block;
	}
	.credential__actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.credential :global(.credential) {
		margin-top: 1rem;
	}
	.add {
		padding: 0.25rem 0.875rem 0.875rem;
		border: 1px dashed var(--border-strong);
		border-radius: var(--r-md);
	}
	.add[open] summary {
		margin-bottom: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
	}
</style>
