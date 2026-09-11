<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		COMPATIBLE_KINDS,
		MODEL_GROUPS,
		MODEL_PRESETS,
		SEARCH_PROVIDERS,
		modelPreset,
		presetFor
	} from '$lib/ai-providers';
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
		/** True when keys cannot be stored (no AI_KEY_SECRET). Only the key field is affected. */
		disabled?: boolean;
		onsaved?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	const initial =
		purpose === 'model'
			? credential
				? presetFor(credential.kind, credential.baseUrl).id
				: 'anthropic'
			: (credential?.kind ?? 'brave');

	let choice = $state(initial);
	// svelte-ignore state_referenced_locally
	let baseUrl = $state(credential?.baseUrl ?? modelPreset(initial)?.baseUrl ?? '');
	// svelte-ignore state_referenced_locally
	let model = $state(credential?.model ?? modelPreset(initial)?.suggestedModel ?? '');
	let models = $state<string[]>([]);
	let busy = $state<'save' | 'probe' | null>(null);

	const prefix = $derived(`${purpose}-${credential?.id ?? 'new'}`);
	const preset = $derived(purpose === 'model' ? modelPreset(choice) : undefined);
	const search = $derived(purpose === 'search' ? SEARCH_PROVIDERS[choice] : undefined);
	const compatible = $derived(Boolean(preset && COMPATIBLE_KINDS.has(preset.kind)));
	const keyRequired = $derived(preset?.keyRequired ?? search?.keyRequired ?? true);
	const note = $derived(preset?.note ?? search?.note ?? '');

	function changeChoice() {
		models = [];
		const next = modelPreset(choice);
		if (!next) return;
		baseUrl = next.baseUrl ?? '';
		if (!credential) model = next.suggestedModel ?? '';
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
					if (!credential) {
						choice = initial;
						changeChoice();
					}
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
		<Field id="{prefix}-provider" label="Provider">
			{#snippet children({ id })}
				{#if purpose === 'model'}
					<select
						{id}
						name="preset"
						bind:value={choice}
						onchange={changeChoice}
						disabled={Boolean(credential)}
					>
						{#each MODEL_GROUPS as group (group)}
							<optgroup label={group}>
								{#each MODEL_PRESETS.filter((p) => p.group === group) as option (option.id)}
									<option value={option.id}>{option.label}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
					{#if credential}<input type="hidden" name="preset" value={choice} />{/if}
				{:else}
					<select {id} name="kind" bind:value={choice} disabled={Boolean(credential)}>
						{#each Object.entries(SEARCH_PROVIDERS) as [value, info] (value)}
							<option {value}>{info.label}</option>
						{/each}
					</select>
					{#if credential}<input type="hidden" name="kind" value={choice} />{/if}
				{/if}
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
					placeholder={preset?.display ?? search?.label}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>

	<p class="meta note">{note}</p>

	{#if compatible}
		<Field
			id="{prefix}-baseUrl"
			label="Base URL"
			hint={preset?.baseUrl
				? 'Filled in from the provider’s documentation. Change it for another region or plan.'
				: preset?.kind === 'anthropic_compatible'
					? 'Without /v1 — the Anthropic SDK adds /v1/messages.'
					: 'Usually ends in /v1.'}
		>
			{#snippet children({ id, describedBy })}
				<input
					{id}
					name="baseUrl"
					type="url"
					required
					bind:value={baseUrl}
					placeholder="https://…"
					spellcheck="false"
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	{/if}

	<Field
		id="{prefix}-apiKey"
		label="API key"
		optional={!keyRequired || Boolean(credential?.keyHint)}
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
				type="password"
				autocomplete="off"
				spellcheck="false"
				aria-describedby={describedBy}
				{disabled}
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
