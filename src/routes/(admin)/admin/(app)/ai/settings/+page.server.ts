import { fail, type Actions } from '@sveltejs/kit';
import { COMPATIBLE_KINDS, SEARCH_PROVIDERS, modelPreset } from '$lib/ai-providers';
import { parseDomainList } from '$lib/server/ai/domain';
import { checkConnection, createModelClient, ProviderError } from '$lib/server/ai/llm';
import { createSearchClient } from '$lib/server/ai/search';
import { SecretsUnavailableError, secretsAvailable } from '$lib/server/ai/secrets';
import {
	createCredential,
	deleteCredential,
	getAiSettings,
	getCredentialWithKey,
	listCredentials,
	updateAiSettings,
	updateCredential
} from '$lib/server/ai/store';
import { db } from '$lib/server/db';
import type { ModelProviderKind, SearchProviderKind } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const PROBE_TIMEOUT_MS = 20_000;

export const load: PageServerLoad = async () => {
	const [credentials, settings] = await Promise.all([listCredentials(db), getAiSettings(db)]);
	return {
		models: credentials.filter((c) => c.purpose === 'model'),
		searches: credentials.filter((c) => c.purpose === 'search'),
		settings: {
			trustedDomains: settings.trustedDomains.join('\n'),
			blockedDomains: settings.blockedDomains.join('\n'),
			weeklyLimit: settings.weeklyLimit,
			monthlyBudgetUsd: settings.monthlyBudgetUsd
		},
		secretsReady: secretsAvailable()
	};
};

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

function optionalNumber(raw: string): number | null | 'invalid' {
	if (!raw) return null;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : 'invalid';
}

function validBaseUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/** Maps any provider failure to a message fit for a toast, never a key or a stack. */
function failure(error: unknown) {
	if (error instanceof ProviderError || error instanceof SecretsUnavailableError) {
		return fail(400, { error: error.message });
	}
	if ((error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError') {
		return fail(400, { error: 'The provider did not answer within 20 seconds.' });
	}
	console.error('[ai] provider check failed', error);
	return fail(400, {
		error: 'The connection failed for an unexpected reason. See the server log.'
	});
}

/**
 * Where a model provider's kind, base URL and key rule come from: the preset
 * chosen in the form. The kind is never taken from the browser directly, so a
 * hand-edited form cannot store a combination the adapters do not handle.
 */
function resolveModelProvider(form: FormData) {
	const preset = modelPreset(text(form, 'preset'));
	if (!preset) return { error: 'Choose a provider.' } as const;

	const compatible = COMPATIBLE_KINDS.has(preset.kind);
	const baseUrl = compatible ? text(form, 'baseUrl') || preset.baseUrl || '' : '';
	if (compatible && !baseUrl) return { error: 'This provider needs a base URL.' } as const;
	if (baseUrl && !validBaseUrl(baseUrl)) {
		return { error: 'The base URL must start with http:// or https://.' } as const;
	}
	return { preset, kind: preset.kind as ModelProviderKind, baseUrl: baseUrl || null } as const;
}

export const actions: Actions = {
	saveCredential: async ({ request }) => {
		const form = await request.formData();
		const id = Number(text(form, 'id')) || null;
		const purpose = text(form, 'purpose') === 'search' ? 'search' : 'model';
		const apiKey = text(form, 'apiKey');
		const inputUsdPerMtok = optionalNumber(text(form, 'inputUsdPerMtok'));
		const outputUsdPerMtok = optionalNumber(text(form, 'outputUsdPerMtok'));

		let kind: string;
		let baseUrl: string | null = null;
		let defaultLabel: string;
		let keyRequired: boolean;

		if (purpose === 'model') {
			const resolved = resolveModelProvider(form);
			if ('error' in resolved) return fail(400, { error: resolved.error });
			({ kind, baseUrl } = resolved);
			defaultLabel = resolved.preset.display;
			keyRequired = resolved.preset.keyRequired;
		} else {
			kind = text(form, 'kind');
			const info = SEARCH_PROVIDERS[kind];
			if (!info) return fail(400, { error: 'Choose a provider.' });
			defaultLabel = info.label;
			keyRequired = info.keyRequired;
		}

		const label = (text(form, 'label') || defaultLabel).slice(0, 60);
		const model = purpose === 'model' ? text(form, 'model') : '';

		if (purpose === 'model' && !model) {
			return fail(400, { error: 'Enter a model id, or load the list.' });
		}
		if (model.length > 200) return fail(400, { error: 'That model id is too long.' });
		if (inputUsdPerMtok === 'invalid' || outputUsdPerMtok === 'invalid') {
			return fail(400, { error: 'Prices must be positive numbers, or empty.' });
		}
		if (apiKey && !secretsAvailable()) {
			return fail(400, { error: new SecretsUnavailableError().message });
		}
		if (apiKey.length > 500) return fail(400, { error: 'That API key is too long.' });

		const fields = {
			label,
			baseUrl,
			model: model || null,
			apiKey,
			inputUsdPerMtok,
			outputUsdPerMtok
		};

		if (id) {
			const existing = await getCredentialWithKey(db, id).catch(() => null);
			if (!existing) return fail(404, { error: 'That provider no longer exists.' });
			if (existing.kind !== kind) {
				return fail(400, {
					error: 'The provider type cannot be changed. Add a new provider instead.'
				});
			}
			if (keyRequired && !apiKey && !existing.keyHint) {
				return fail(400, { error: 'This provider needs an API key.' });
			}
			await updateCredential(db, id, fields);
			return { toast: `${label} saved.` };
		}

		if (keyRequired && !apiKey) return fail(400, { error: 'This provider needs an API key.' });
		await createCredential(db, { purpose, kind, ...fields });
		return { toast: `${label} added. Use “Test” to check it.` };
	},

	deleteCredential: async ({ request }) => {
		const id = Number(text(await request.formData(), 'id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });
		await deleteCredential(db, id);
		return { toast: 'Provider removed. Its key is gone from the database.' };
	},

	testCredential: async ({ request }) => {
		const id = Number(text(await request.formData(), 'id'));
		try {
			const credential = await getCredentialWithKey(db, id);
			if (!credential) return fail(404, { error: 'That provider no longer exists.' });
			const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);

			if (credential.purpose === 'search') {
				if (!credential.apiKey) return fail(400, { error: 'No API key stored.' });
				const results = await createSearchClient({
					kind: credential.kind as SearchProviderKind,
					apiKey: credential.apiKey
				}).search('technology news', { count: 3, signal });
				return { toast: `${credential.label} works: ${results.length} results for a test query.` };
			}

			const model = credential.model ?? '';
			const result = await checkConnection(
				createModelClient({
					kind: credential.kind as ModelProviderKind,
					apiKey: credential.apiKey,
					baseUrl: credential.baseUrl,
					model
				}),
				model,
				signal
			);

			if (result.via === 'models') {
				return {
					toast: `${credential.label} works: the key is accepted and ${result.models} models are available.`
				};
			}
			return {
				toast:
					result.listed === false
						? `${credential.label} works: ${model} is not in the endpoint’s model list, but it answered a one-word request.`
						: `${credential.label} works: the endpoint has no model list, so ${model} was sent a one-word request and answered.`
			};
		} catch (error) {
			return failure(error);
		}
	},

	/** Lists models for the form, from typed-in values or a stored key. */
	probeModels: async ({ request }) => {
		const form = await request.formData();
		const resolved = resolveModelProvider(form);
		if ('error' in resolved) return fail(400, { error: resolved.error });

		let apiKey: string | null = text(form, 'apiKey') || null;
		const id = Number(text(form, 'id')) || null;
		try {
			if (!apiKey && id) apiKey = (await getCredentialWithKey(db, id))?.apiKey ?? null;
			if (resolved.preset.keyRequired && !apiKey) {
				return fail(400, { error: 'Enter the API key first.' });
			}

			const models = await createModelClient({
				kind: resolved.kind,
				apiKey,
				baseUrl: resolved.baseUrl,
				model: ''
			}).listModels(AbortSignal.timeout(PROBE_TIMEOUT_MS));

			if (models.length === 0) {
				return fail(400, {
					error:
						'The endpoint answered with an empty model list. Type the model id; “Test” will check it.'
				});
			}
			return { models, toast: `Loaded ${models.length} models. Pick one in the Model field.` };
		} catch (error) {
			if (error instanceof ProviderError && [404, 405, 501].includes(error.status ?? 0)) {
				return fail(400, {
					error:
						'This endpoint does not publish a model list. Type the model id; “Test” will check it with a one-word request.'
				});
			}
			return failure(error);
		}
	},

	saveSettings: async ({ request }) => {
		const form = await request.formData();
		const weeklyLimit = Number(text(form, 'weeklyLimit'));
		const budget = optionalNumber(text(form, 'monthlyBudgetUsd'));

		if (!Number.isInteger(weeklyLimit) || weeklyLimit < 0 || weeklyLimit > 100) {
			return fail(400, { error: 'The weekly limit must be a whole number from 0 to 100.' });
		}
		if (budget === 'invalid') {
			return fail(400, { error: 'The budget must be a positive number, or empty.' });
		}

		const trustedDomains = parseDomainList(text(form, 'trustedDomains'));
		const blockedDomains = parseDomainList(text(form, 'blockedDomains'));
		await updateAiSettings(db, {
			trustedDomains,
			blockedDomains,
			weeklyLimit,
			monthlyBudgetUsd: budget
		});
		return {
			toast: `Settings saved: ${trustedDomains.length} trusted and ${blockedDomains.length} blocked domains.`
		};
	}
};
