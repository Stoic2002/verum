<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, ConfirmButton, Field } from '$lib/components/ui';
	import { enhanceWithToast } from '$lib/toast.svelte';
	import JobStatus from '../JobStatus.svelte';

	let { data } = $props();
	const job = $derived(data.job);

	const ACTIVE = ['queued', 'researching', 'drafting'];
	const active = $derived(ACTIVE.includes(job.status));
	const reviewing = $derived(job.status === 'review');

	// Follow the job while it runs. Polling rather than a stream: it survives
	// proxies and reconnects for free, and a job changes every few seconds at most.
	$effect(() => {
		if (!active) return;
		const timer = setInterval(() => invalidate('ai:job'), 2500);
		return () => clearInterval(timer);
	});

	let busy = $state(false);

	const CLAIM: Record<string, [string, string]> = {
		confirmed: ['Confirmed by 2+ publishers', 'good'],
		single: ['Single source', 'neutral'],
		mismatch: ['Numbers not in the quotes', 'bad'],
		unverified: ['Quote not found on the page', 'bad']
	};

	const counts = $derived(
		job.claims.reduce<Record<string, number>>(
			(acc, c) => ((acc[c.status] = (acc[c.status] ?? 0) + 1), acc),
			{}
		)
	);
	const usd = (value: number) => (value < 0.01 && value > 0 ? '<$0.01' : `$${value.toFixed(2)}`);
	const time = (iso: string) => iso.slice(11, 19);
	const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
</script>

<svelte:head><title>AI draft #{job.id} · VERUM</title></svelte:head>

<header class="head">
	<div>
		<p class="meta"><a href={resolve('/(admin)/admin/(app)/ai')}>← AI writer</a></p>
		<h1>{job.idea}</h1>
		<p class="meta">
			#{job.id} · {job.locale === 'en' ? 'English' : 'Bahasa Indonesia'}
			{#if data.category}· {data.category}{/if} · {job.modelLabel} ·
			{(job.inputTokens + job.outputTokens).toLocaleString('en')} tokens · {usd(job.costUsd)}
		</p>
		{#if job.angle}<p class="angle">{job.angle}</p>{/if}
	</div>
	<div class="head__status">
		<JobStatus status={job.status} />
		{#if active || reviewing}
			<form method="POST" action="?/cancel" use:enhance={enhanceWithToast()}>
				<ConfirmButton
					class="btn btn--secondary btn--sm"
					title="Cancel this draft?"
					message="Work in progress stops. Sources and claims read so far stay visible; tokens already used are still billed by the provider."
					confirmLabel="Cancel draft"
				>
					Cancel
				</ConfirmButton>
			</form>
		{/if}
		{#if !active}
			<form method="POST" action="?/delete" use:enhance={enhanceWithToast()}>
				<ConfirmButton
					class="btn btn--ghost btn--sm"
					title="Delete this draft?"
					message={job.articleId
						? `Its research, sources and log are deleted. The draft article #${job.articleId} stays in Articles.`
						: 'Its research, sources and log are deleted.'}
					confirmLabel="Delete draft"
				>
					Delete
				</ConfirmButton>
			</form>
		{/if}
	</div>
</header>

{#if job.status === 'done' && data.article}
	<div class="banner banner--done">
		<p>
			<strong>Draft saved as an article.</strong> It is not published. Resolve every
			<code>[[EDITOR: …]]</code> note, check each cited fact, and add what only you can — then publish
			from the article settings.
		</p>
		<Button
			href={resolve('/(admin)/admin/(app)/articles/[id]/[locale]', {
				id: String(data.article.id),
				locale: data.article.locale
			})}
			size="sm">Open the draft</Button
		>
	</div>
{/if}

{#if job.status === 'failed' || job.status === 'cancelled'}
	{@const canReopen = job.claims.length > 0}
	<div class="banner banner--failed banner--stack">
		<p>
			{#if job.status === 'failed'}
				<strong>This draft failed.</strong> {job.error}
			{:else}
				<strong>This draft was cancelled.</strong>
			{/if}
			{#if canReopen}
				Its research is kept: go back to review with another model, or research it again.
			{:else}
				Try again, with another model if this one was the problem.
			{/if}
		</p>
		<form
			method="POST"
			action={canReopen ? '?/reopen' : '?/retry'}
			class="restart"
			use:enhance={enhanceWithToast()}
		>
			<Field id="restart-model" label="Model">
				{#snippet children({ id })}
					<select {id} name="modelCredentialId">
						{#each data.models as model (model.id)}
							<option value={model.id} selected={model.id === job.modelCredentialId}>
								{model.label} · {model.model}
							</option>
						{/each}
					</select>
				{/snippet}
			</Field>
			<Field
				id="restart-search"
				label="Web search"
				hint="Used only when the research starts again."
			>
				{#snippet children({ id, describedBy })}
					<select {id} name="searchCredentialId" aria-describedby={describedBy}>
						{#each data.searches as search (search.id)}
							<option value={search.id} selected={search.id === job.searchCredentialId}>
								{search.label}
							</option>
						{/each}
						<option value="" selected={job.searchCredentialId === null}>
							No search: only this draft's URLs
						</option>
					</select>
				{/snippet}
			</Field>
			<div class="restart__actions">
				{#if canReopen}
					<Button type="submit" size="sm">Back to review</Button>
					<Button type="submit" size="sm" variant="secondary" formaction="?/retry"
						>Start again</Button
					>
				{:else}
					<Button type="submit" size="sm">Start again</Button>
				{/if}
			</div>
		</form>
	</div>
{/if}

<section>
	<h2>Progress</h2>
	<ol class="log" aria-live="polite">
		{#each job.log as entry, index (index)}
			<li class="log__entry log__entry--{entry.level}">
				<time datetime={entry.at}>{time(entry.at)}</time>
				<span>{entry.message}</span>
			</li>
		{:else}
			<li class="log__entry"><span class="meta">Waiting to start…</span></li>
		{/each}
	</ol>
</section>

{#if data.sources.length || job.claims.length}
	<form
		method="POST"
		action="?/review"
		use:enhance={enhanceWithToast({ onStart: () => (busy = true), onDone: () => (busy = false) })}
	>
		<section>
			<h2>
				Sources <span class="count"
					>{data.sources.filter((s) => s.status === 'ok').length} read</span
				>
			</h2>
			<div class="scroll">
				<table>
					<thead>
						<tr><th>Use</th><th>Source</th><th>Publisher</th><th>Published</th><th>Result</th></tr>
					</thead>
					<tbody>
						{#each data.sources as source (source.id)}
							<tr class:dim={source.status !== 'ok'}>
								<td>
									<input
										type="checkbox"
										name="sources"
										value={source.key}
										checked={source.included && source.status === 'ok'}
										disabled={!reviewing || source.status !== 'ok'}
										aria-label="Use {source.key}"
									/>
								</td>
								<td>
									<code>{source.key}</code>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a
										href={source.finalUrl ?? source.url}
										target="_blank"
										rel="noopener noreferrer nofollow">{source.title || source.url}</a
									>
									<span class="meta">{source.origin === 'seed' ? 'your URL' : 'search result'}</span
									>
								</td>
								<td>
									{source.siteName || source.domain}
									{#if source.trusted}<span class="tag tag--good">trusted</span>{/if}
								</td>
								<td class="num meta">{day(source.publishedAt)}</td>
								<td>
									{#if source.status === 'ok'}
										<span class="meta">{source.chars.toLocaleString('en')} chars</span>
									{:else}
										<span class="tag tag--bad">{source.status}</span>
										<span class="meta">{source.error}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		{#if job.claims.length}
			<section>
				<h2>
					Claims
					<span class="count">
						{counts.confirmed ?? 0} confirmed · {counts.single ?? 0} single source ·
						{(counts.mismatch ?? 0) + (counts.unverified ?? 0)} flagged
					</span>
				</h2>
				<p class="meta explain">
					Each quote was searched for, word for word, in the page it claims to come from. That
					proves the words are on the page — not that the page is right. Primary sources and your
					own judgment still decide (PRD §5.5).
				</p>
				<ul class="claims">
					{#each job.claims as claim (claim.id)}
						{@const [label, tone] = CLAIM[claim.status]}
						<li class="claim">
							<label class="claim__head">
								<input
									type="checkbox"
									name="claims"
									value={claim.id}
									checked={claim.included}
									disabled={!reviewing}
								/>
								<span class="claim__text">{claim.statement}</span>
								<span class="tag tag--{tone}">{label}</span>
							</label>
							{#if claim.unmatchedNumbers.length}
								<p class="claim__warn">
									Not in any verified quote: {claim.unmatchedNumbers.join(', ')}
								</p>
							{/if}
							<ul class="evidence">
								{#each claim.evidence as evidence, index (index)}
									<li class:missing={!evidence.found}>
										<code>{evidence.source}</code>
										<q>{evidence.quote}</q>
										<span class="meta"
											>{evidence.found ? 'found on the page' : 'not found on the page'}</span
										>
									</li>
								{/each}
							</ul>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if reviewing}
			<section class="outline">
				<h2>Outline</h2>
				{#if !job.outline}
					<p class="meta">
						No outline yet: no claim could be verified. Tick the claims you have checked yourself
						and rebuild it, or cancel.
					</p>
				{/if}
				<div class="form-grid">
					<Field id="title" label="Title" hint="Honest: the article must fully answer it.">
						{#snippet children({ id, describedBy })}
							<input
								{id}
								name="title"
								type="text"
								maxlength="160"
								value={job.outline?.title ?? ''}
								aria-describedby={describedBy}
							/>
						{/snippet}
					</Field>
					<Field id="excerpt" label="Excerpt">
						{#snippet children({ id })}
							<textarea {id} name="excerpt" rows="2" maxlength="400"
								>{job.outline?.excerpt ?? ''}</textarea
							>
						{/snippet}
					</Field>
					<Field
						id="outline"
						label="Sections"
						hint="## Heading, then - points. Edit freely; the draft follows this."
					>
						{#snippet children({ id, describedBy })}
							<textarea
								{id}
								name="outline"
								rows="14"
								spellcheck="false"
								aria-describedby={describedBy}>{data.outlineText}</textarea
							>
						{/snippet}
					</Field>
				</div>
			</section>

			<div class="review-actions">
				<label class="review-model">
					<span class="meta">Model</span>
					<select name="modelCredentialId" aria-label="Model for the outline and the draft">
						{#each data.models as model (model.id)}
							<option value={model.id} selected={model.id === job.modelCredentialId}>
								{model.label} · {model.model}
							</option>
						{/each}
					</select>
				</label>
				<Button type="submit" name="intent" value="draft" loading={busy} loadingLabel="Saving…"
					>Write draft</Button
				>
				<Button type="submit" name="intent" value="outline" variant="secondary" disabled={busy}>
					Rebuild outline
				</Button>
				<Button type="submit" name="intent" value="save" variant="ghost" disabled={busy}
					>Save review</Button
				>
			</div>
		{/if}
	</form>
{/if}

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
	}
	.head h1 {
		max-width: 48rem;
	}
	.head__status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 1.5rem;
	}
	.angle {
		max-width: 48rem;
		margin: 0.5rem 0 0;
		color: var(--text-2);
	}
	h2 {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.count {
		font-size: 0.75rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: var(--weight-body);
	}
	section {
		margin-top: 2rem;
	}
	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.5rem;
		padding: 0.875rem 1.125rem;
		border-radius: var(--r-lg);
		border: 1px solid var(--border);
	}
	.banner p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.55;
	}
	.banner--done {
		background: var(--success-tint);
	}
	.banner--failed {
		background: var(--danger-tint);
	}
	.log {
		display: grid;
		gap: 0.25rem;
		max-width: 52rem;
		margin: 0;
		padding: 0.75rem 1rem;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		font-size: 0.8125rem;
	}
	.log__entry {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.5rem;
	}
	.log__entry time {
		color: var(--text-3);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.log__entry--warn span {
		color: var(--text);
	}
	.log__entry--error span {
		color: var(--danger);
	}
	.scroll {
		overflow-x: auto;
	}
	td a {
		margin-left: 0.25rem;
	}
	td .meta {
		display: block;
	}
	tr.dim td {
		color: var(--text-3);
	}
	.tag {
		display: inline-block;
		margin-left: 0.25rem;
		padding: 0.0625rem 0.4375rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: var(--weight-strong);
		white-space: nowrap;
	}
	.tag--good {
		background: var(--success-tint);
		color: var(--success);
	}
	.tag--neutral {
		background: var(--surface-3);
		color: var(--text-2);
	}
	.tag--bad {
		background: var(--danger-tint);
		color: var(--danger);
	}
	.explain {
		max-width: 52rem;
		margin: 0 0 0.75rem;
	}
	.claims {
		display: grid;
		gap: 0.625rem;
		max-width: 52rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.claim {
		padding: 0.75rem 0.875rem;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
	}
	.claim__head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 0.625rem;
		cursor: pointer;
	}
	.claim__text {
		font-size: 0.9375rem;
		line-height: 1.5;
	}
	.claim__warn {
		margin: 0.375rem 0 0 1.625rem;
		color: var(--danger);
		font-size: 0.8125rem;
	}
	.evidence {
		display: grid;
		gap: 0.25rem;
		margin: 0.5rem 0 0 1.625rem;
		padding: 0;
		list-style: none;
		font-size: 0.8125rem;
		color: var(--text-2);
	}
	.evidence q {
		font-style: italic;
	}
	.evidence .missing q {
		text-decoration: line-through;
		text-decoration-color: var(--danger);
	}
	.outline {
		max-width: 52rem;
	}
	.review-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		gap: 0.5rem;
		margin-top: 1.5rem;
		padding: 0.75rem 0;
		background: var(--bg);
		border-top: 1px solid var(--border);
	}
	.banner--stack {
		flex-direction: column;
		align-items: stretch;
	}
	.restart {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		align-items: end;
		gap: 0.75rem 1rem;
	}
	.restart__actions {
		display: flex;
		gap: 0.5rem;
	}
	.review-model {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-right: 0.5rem;
	}
	.review-model select {
		width: auto;
		max-width: 20rem;
	}
</style>
