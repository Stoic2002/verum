<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { MODEL_PROVIDERS, SEARCH_PROVIDERS, type ProviderInfo } from '$lib/ai-providers';
	import { Button, Field } from '$lib/components/ui';
	import { announce } from '$lib/toast.svelte';

	type Credential = {
		id: number;
		kind: string;
		label: string;
		baseUrl: string | null;
		model: string | null;
		keyHint: string | null;
		inputUsdPerMtok: number | null;
		outputUsdPerMtok: number | null;
	};

	let {
		purpose,
		credential,
		disabled = false,
		onsaved
	}: {
		purpose: 'model' | 'search';
		credential?: Credential;
		disabled?: boolean;
		onsaved?: () => void;
	} = $props();

	const providers: Record<string, ProviderInfo> = $derived(
		purpose === 'model' ? MODEL_PROVIDERS : SEARCH_PROVIDERS
	);
	const prefix = $derived(`${purpose}-${credential?.id ?? 'new'}`);

	// svelte-ignore state_referenced_locally
	let kind = $state(credential?.kind ?? Object.keys(providers)[0]);
	// svelte-ignore state_referenced_locally
	let model = $state(
		credential?.model ?? providers[Object.keys(providers)[0]].suggestedModel ?? ''
	);
	let models = $state<string[]>([]);
	let busy = $state<'save' | 'probe' | null>(null);

	const info = $derived(providers[kind]);

	function changeKind() {
		models = [];
		if (!credential) model = providers[kind].suggestedModel ?? '';
	}

	const submit: SubmitFunction = ({ submitter }) => {
		const probing = submitter?.getAttribute('formaction')?.includes('probeModels') ?? false;
		busy = probing ? 'probe' : 'save';

		return async ({ result, update }) => {
			announce(result);
			if (result.type === 'success' && Array.isArray(result.data?.models)) {
				models = result.data.models as string[];
			}
			if (!probing) {
				await update({ reset: !credential && result.type === 'success' });
				if (result.type === 'success') {
					if (!credential) model = providers[kind].suggestedModel ?? '';
					onsaved?.();
				}
			}
			busy = null;
		};
	};
</script>

<form method="POST" action="?/saveCredential" class="form-grid credential" use:enhance={submit}>
	<input type="hidden" name="purpose" value={purpose} />
	{#if credential}<input type="hidden" name="id" value={credential.id} />{/if}

	<div class="row">
		<Field id="{prefix}-kind" label="Provider">
			{#snippet children({ id })}
				<select
					{id}
					name="kind"
					bind:value={kind}
					onchange={changeKind}
					disabled={Boolean(credential)}
				>
					{#each Object.entries(providers) as [value, provider] (value)}
						<option {value}>{provider.label}</option>
					{/each}
				</select>
				{#if credential}<input type="hidden" name="kind" value={kind} />{/if}
			{/snippet}
		</Field>

		<Field id="{prefix}-label" label="Name" optional hint="How it appears when starting a draft.">
			{#snippet children({ id, describedBy })}
				<input
					{id}
					name="label"
					type="text"
					maxlength="60"
					value={credential?.label ?? ''}
					placeholder={info.label}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>

	<p class="meta note">{info.note}</p>

	{#if info.baseUrl !== 'hidden'}
		<Field
			id="{prefix}-baseUrl"
			label="Base URL"
			hint="For example https://api.deepseek.com/v1 or http://localhost:11434/v1"
		>
			{#snippet children({ id, describedBy })}
				<input
					{id}
					name="baseUrl"
					type="url"
					value={credential?.baseUrl ?? ''}
					placeholder="https://…/v1"
					spellcheck="false"
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	{/if}

	<Field
		id="{prefix}-apiKey"
		label="API key"
		optional={!info.keyRequired || Boolean(credential?.keyHint)}
		hint={disabled
			? 'Keys cannot be stored until AI_KEY_SECRET is set. Keyless local endpoints still work.'
			: credential?.keyHint
				? `Stored encrypted (${credential.keyHint}). Leave empty to keep it.`
				: 'Stored encrypted. Never shown again after saving.'}
	>
		{#snippet children({ id, describedBy })}
			<input
				{id}
				name="apiKey"
				{disabled}
				type="password"
				autocomplete="off"
				spellcheck="false"
				aria-describedby={describedBy}
			/>
		{/snippet}
	</Field>

	{#if purpose === 'model'}
		<Field
			id="{prefix}-model"
			label="Model"
			hint={models.length
				? `${models.length} models loaded; start typing to filter.`
				: 'Type a model id, or load the list with the key above.'}
		>
			{#snippet children({ id, describedBy })}
				<div class="model">
					<input
						{id}
						name="model"
						type="text"
						bind:value={model}
						list="{prefix}-models"
						spellcheck="false"
						autocomplete="off"
						aria-describedby={describedBy}
					/>
					<Button
						type="submit"
						variant="secondary"
						formaction="?/probeModels"
						loading={busy === 'probe'}
						loadingLabel="Loading…"
					>
						Load models
					</Button>
				</div>
				<datalist id="{prefix}-models">
					{#each models as option (option)}<option value={option}></option>{/each}
				</datalist>
			{/snippet}
		</Field>

		<div class="row">
			<Field
				id="{prefix}-in"
				label="Input price"
				optional
				hint="USD per million tokens, for the cost estimate and budget."
			>
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="inputUsdPerMtok"
						type="number"
						min="0"
						step="any"
						value={credential?.inputUsdPerMtok ?? ''}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>
			<Field id="{prefix}-out" label="Output price" optional hint="USD per million tokens.">
				{#snippet children({ id, describedBy })}
					<input
						{id}
						name="outputUsdPerMtok"
						type="number"
						min="0"
						step="any"
						value={credential?.outputUsdPerMtok ?? ''}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</Field>
		</div>
	{/if}

	<div>
		<Button type="submit" loading={busy === 'save'} loadingLabel="Saving…">
			{credential ? 'Save changes' : 'Add provider'}
		</Button>
	</div>
</form>

<style>
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 1rem;
	}
	.note {
		margin: -0.25rem 0 0;
	}
	.model {
		display: flex;
		gap: 0.5rem;
	}
	.model input {
		flex: 1;
		min-width: 0;
	}
</style>
