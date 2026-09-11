<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { AdminPager, Button, Field } from '$lib/components/ui';
	import { enhanceWithToast } from '$lib/toast.svelte';
	import JobStatus from './JobStatus.svelte';

	let { data } = $props();
	let submitting = $state(false);

	const stamp = (value: Date | string) =>
		new Date(value).toISOString().slice(0, 16).replace('T', ' ');
	const usd = (value: number) => (value < 0.01 && value > 0 ? '<$0.01' : `$${value.toFixed(2)}`);
	const atLimit = $derived(data.usage.thisWeek >= data.usage.weeklyLimit);
</script>

<svelte:head><title>AI writer · VERUM</title></svelte:head>

<header class="head">
	<div>
		<h1>AI writer</h1>
		<p class="meta">
			You choose the topic and the angle. The writer reads the sources, checks every quoted fact
			against the page it came from, and stops for your review before it drafts. Nothing is
			published without you.
		</p>
	</div>
	<Button href={resolve('/(admin)/admin/(app)/ai/settings')} variant="secondary" size="sm">
		Providers &amp; settings
	</Button>
</header>

<p class="usage meta">
	This week: <strong>{data.usage.thisWeek} of {data.usage.weeklyLimit}</strong> drafts · This month:
	<strong>{usd(data.usage.monthCost)}</strong>
	{#if data.usage.monthlyBudgetUsd !== null}of {usd(data.usage.monthlyBudgetUsd)}{/if}
</p>

{#if data.models.length === 0}
	<div class="callout">
		<p>
			<strong>No model provider yet.</strong> Add a key for Claude, ChatGPT, Gemini, OpenRouter or any
			OpenAI-compatible endpoint first.
		</p>
		<Button href={resolve('/(admin)/admin/(app)/ai/settings')} size="sm">Add a provider</Button>
	</div>
{:else}
	<section class="card">
		<h2>New draft</h2>
		<form
			method="POST"
			action="?/create"
			class="form-grid"
			use:enhance={enhanceWithToast({
				onStart: () => (submitting = true),
				onDone: () => (submitting = false)
			})}
		>
			<Field
				id="idea"
				label="Idea"
				hint="What happened, or what the article is about. Your call, not the model's."
			>
				{#snippet children({ id, describedBy })}
					<textarea
						{id}
						name="idea"
						rows="2"
						required
						maxlength="500"
						aria-describedby={describedBy}></textarea>
				{/snippet}
			</Field>

			<Field
				id="angle"
				label="Angle"
				optional
				hint="The question the article answers, or who it is for."
			>
				{#snippet children({ id, describedBy })}
					<textarea {id} name="angle" rows="2" maxlength="500" aria-describedby={describedBy}
					></textarea>
				{/snippet}
			</Field>

			<div class="row">
				<Field id="locale" label="Language">
					{#snippet children({ id })}
						<select {id} name="locale">
							{#each data.locales as locale (locale)}
								<option value={locale}>{locale === 'en' ? 'English' : 'Bahasa Indonesia'}</option>
							{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="categoryId" label="Category">
					{#snippet children({ id })}
						<select {id} name="categoryId" required>
							{#each data.categories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
			</div>

			<div class="row">
				<Field id="modelCredentialId" label="Model">
					{#snippet children({ id })}
						<select {id} name="modelCredentialId" required>
							{#each data.models as model (model.id)}
								<option value={model.id}>{model.label} · {model.model}</option>
							{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="searchCredentialId" label="Web search">
					{#snippet children({ id })}
						<select {id} name="searchCredentialId">
							{#each data.searches as search (search.id)}
								<option value={search.id}>{search.label}</option>
							{/each}
							<option value="">No search: only the URLs below</option>
						</select>
					{/snippet}
				</Field>
			</div>

			<Field
				id="seedUrls"
				label="Sources you already have"
				optional
				hint="One URL per line, up to {data.seedLimit}. Read first, before any search results. Primary sources beat coverage of them."
			>
				{#snippet children({ id, describedBy })}
					<textarea
						{id}
						name="seedUrls"
						rows="3"
						placeholder="https://"
						spellcheck="false"
						aria-describedby={describedBy}></textarea>
				{/snippet}
			</Field>

			<div class="actions">
				<Button type="submit" loading={submitting} loadingLabel="Starting…" disabled={atLimit}>
					Start research
				</Button>
				{#if atLimit}
					<span class="meta">Weekly limit reached. It can be changed in settings.</span>
				{/if}
			</div>
		</form>
	</section>
{/if}

<section>
	<h2>Drafts</h2>
	{#if data.jobs.length === 0}
		<p class="empty">No drafts yet.</p>
	{:else}
		<table>
			<thead>
				<tr><th>Idea</th><th>Status</th><th>Model</th><th>Started</th><th class="num">Cost</th></tr>
			</thead>
			<tbody>
				{#each data.jobs as job (job.id)}
					<tr>
						<td>
							<a href={resolve('/(admin)/admin/(app)/ai/[id]', { id: String(job.id) })}
								>{job.idea}</a
							>
							<span class="meta">#{job.id} · {job.locale}</span>
						</td>
						<td><JobStatus status={job.status} /></td>
						<td class="meta">{job.modelLabel}</td>
						<td class="meta num">{stamp(job.createdAt)}</td>
						<td class="num">{usd(job.costUsd)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<AdminPager page={data.page} pages={data.pages} total={data.total} label="drafts" />
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
	}
	.head .meta {
		max-width: 44rem;
	}
	.usage {
		margin: 0.25rem 0 1.5rem;
	}
	.card {
		max-width: 46rem;
		padding: 1.25rem 1.375rem;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		background: var(--surface);
	}
	.callout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		max-width: 46rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		background: var(--accent-tint);
	}
	.callout p {
		margin: 0;
		font-size: 0.875rem;
	}
	h2 {
		margin: 0 0 1rem;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	section {
		margin-top: 2rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	td .meta {
		display: block;
	}
</style>
