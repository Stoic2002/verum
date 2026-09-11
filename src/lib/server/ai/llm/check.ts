import { EmptyReplyError, ProviderError, type ModelClient } from './types';

/**
 * "Does this provider work?" — answered without assuming every endpoint has a
 * model list.
 *
 * The list is the cheap answer: no tokens, and it proves the key. But plenty
 * of compatible endpoints have no `/models` (or list only some of what they
 * serve), and reporting those as broken sends the editor off to debug a key
 * that is fine. So when the list is missing, empty, or does not mention the
 * model, the model itself is asked for one word.
 */

export type ConnectionResult =
	| { via: 'models'; models: number }
	/** listed: null when the endpoint has no list, false when the list omits the model. */
	| { via: 'chat'; listed: boolean | null };

/** Statuses that mean "no such endpoint", as opposed to "not allowed". */
const NO_LIST = new Set([404, 405, 501]);

export async function checkConnection(
	client: ModelClient,
	model: string,
	signal?: AbortSignal
): Promise<ConnectionResult> {
	let listed: boolean | null = null;

	try {
		const models = await client.listModels(signal);
		if (models.length > 0) {
			if (models.includes(model)) return { via: 'models', models: models.length };
			listed = false;
		}
	} catch (error) {
		// A rejected key must surface as such, not be retried as a chat request.
		const missingEndpoint =
			error instanceof ProviderError && error.status !== undefined && NO_LIST.has(error.status);
		if (!missingEndpoint) throw error;
	}

	try {
		await client.chat({
			system: 'Reply with the single word OK.',
			messages: [{ role: 'user', content: 'Say OK.' }],
			maxTokens: 32,
			signal
		});
	} catch (error) {
		// Accepted with nothing inside a 32-token budget: key and model id are proven.
		if (!(error instanceof EmptyReplyError)) throw error;
	}
	return { via: 'chat', listed };
}
