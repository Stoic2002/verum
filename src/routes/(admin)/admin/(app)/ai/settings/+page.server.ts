import { fail, type Actions } from '@sveltejs/kit';
import { MODEL_PROVIDERS, SEARCH_PROVIDERS } from '$lib/ai-providers';
import { parseDomainList } from '$lib/server/ai/domain';
import { createModelClient, ProviderError } from '$lib/server/ai/llm';
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
import {
	MODEL_PROVIDER_KINDS,
	SEARCH_PROVIDER_KINDS,
	type ModelProviderKind,
	type SearchProviderKind
} from '$lib/server/db/schema';
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

export const actions: Actions = {
	saveCredential: async ({ request }) => {
		const form = await request.formData();
		const id = Number(text(form, 'id')) || null;
		const purpose = text(form, 'purpose') === 'search' ? 'search' : 'model';
		const kind = text(form, 'kind');
		const apiKey = text(form, 'apiKey');
		const inputUsdPerMtok = optionalNumber(text(form, 'inputUsdPerMtok'));
		const outputUsdPerMtok = optionalNumber(text(form, 'outputUsdPerMtok'));

		const kinds: readonly string[] =
			purpose === 'model' ? MODEL_PROVIDER_KINDS : SEARCH_PROVIDER_KINDS;
		if (!kinds.includes(kind)) return fail(400, { error: 'Choose a provider.' });

		const info =
			purpose === 'model'
				? MODEL_PROVIDERS[kind as ModelProviderKind]
				: SEARCH_PROVIDERS[kind as SearchProviderKind];

		const label = (text(form, 'label') || info.label).slice(0, 60);
		const model = purpose === 'model' ? text(form, 'model') : '';
		const baseUrl = info.baseUrl === 'hidden' ? '' : text(form, 'baseUrl');

		if (purpose === 'model' && !model)
			return fail(400, { error: 'Enter a model id, or load the list.' });
		if (model.length > 200) return fail(400, { error: 'That model id is too long.' });
		if (info.baseUrl === 'required' && !baseUrl)
			return fail(400, { error: 'This provider needs a base URL.' });
		if (baseUrl && !validBaseUrl(baseUrl))
			return fail(400, { error: 'The base URL must start with http:// or https://.' });
		if (inputUsdPerMtok === 'invalid' || outputUsdPerMtok === 'invalid') {
			return fail(400, { error: 'Prices must be positive numbers, or empty.' });
		}
		if (apiKey && !secretsAvailable()) {
			return fail(400, { error: new SecretsUnavailableError().message });
		}
		if (apiKey.length > 500) return fail(400, { error: 'That API key is too long.' });

		const fields = {
			label,
			baseUrl: baseUrl || null,
			model: model || null,
			apiKey,
			inputUsdPerMtok,
			outputUsdPerMtok
		};

		if (id) {
			const existing = await getCredentialWithKey(db, id).catch(() => null);
			if (!existing) return fail(404, { error: 'That provider no longer exists.' });
			if (info.keyRequired && !apiKey && !existing.keyHint) {
				return fail(400, { error: 'This provider needs an API key.' });
			}
			await updateCredential(db, id, fields);
			return { toast: `${label} saved.` };
		}

		if (info.keyRequired && !apiKey) return fail(400, { error: 'This provider needs an API key.' });
		await createCredential(db, { purpose, kind, ...fields });
		return { toast: `${label} added. Use “Test” to check the key.` };
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

			const models = await createModelClient({
				kind: credential.kind as ModelProviderKind,
				apiKey: credential.apiKey,
				baseUrl: credential.baseUrl,
				model: credential.model ?? ''
			}).listModels(signal);

			if (models.length && credential.model && !models.includes(credential.model)) {
				return fail(400, {
					error: `The key works, but “${credential.model}” is not among its ${models.length} models. Check the model id.`
				});
			}
			return {
				toast: `${credential.label} works: the key is accepted and ${models.length} models are available.`
			};
		} catch (error) {
			return failure(error);
		}
	},

	/** Lists models for the form, from typed-in values or a stored key. */
	probeModels: async ({ request }) => {
		const form = await request.formData();
		const kind = text(form, 'kind') as ModelProviderKind;
		if (!MODEL_PROVIDER_KINDS.includes(kind)) return fail(400, { error: 'Choose a provider.' });

		let apiKey: string | null = text(form, 'apiKey') || null;
		const id = Number(text(form, 'id')) || null;
		try {
			if (!apiKey && id) apiKey = (await getCredentialWithKey(db, id))?.apiKey ?? null;
			const info = MODEL_PROVIDERS[kind];
			const baseUrl = info.baseUrl === 'hidden' ? null : text(form, 'baseUrl') || null;
			if (info.baseUrl === 'required' && !baseUrl)
				return fail(400, { error: 'Enter the base URL first.' });
			if (info.keyRequired && !apiKey) return fail(400, { error: 'Enter the API key first.' });

			const models = await createModelClient({ kind, apiKey, baseUrl, model: '' }).listModels(
				AbortSignal.timeout(PROBE_TIMEOUT_MS)
			);
			return { models, toast: `Loaded ${models.length} models. Pick one in the Model field.` };
		} catch (error) {
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
		if (budget === 'invalid')
			return fail(400, { error: 'The budget must be a positive number, or empty.' });

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
