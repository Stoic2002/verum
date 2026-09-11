import Anthropic from '@anthropic-ai/sdk';
import {
	ProviderError,
	describeStatus,
	redact,
	type ChatRequest,
	type ChatResult,
	type ModelClient,
	type ModelConfig
} from './types';

/**
 * Claude, through the official SDK.
 *
 * Streaming even though nothing here renders tokens as they arrive: a full
 * article draft is a long response, and a non-streaming request that long can
 * hit HTTP timeouts along the way. `finalMessage()` hands back the complete
 * message either way.
 */

/**
 * Models that accept the server-side `fallbacks: "default"` parameter. If one
 * of them declines a request, Anthropic re-runs it on its recommended
 * fallback model in the same call instead of returning a refusal.
 */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-fable-5-1']);

export function createAnthropicClient(config: ModelConfig): ModelClient {
	if (!config.apiKey) throw new ProviderError('Anthropic needs an API key.');

	const client = new Anthropic({
		apiKey: config.apiKey,
		baseURL: config.baseUrl?.trim() || undefined,
		maxRetries: 2,
		...(config.fetch ? { fetch: config.fetch } : {})
	});

	function translate(error: unknown): never {
		// An abort is the job being cancelled, not a provider failure.
		if (error instanceof Anthropic.APIUserAbortError) throw error;
		if (error instanceof Anthropic.APIConnectionTimeoutError) {
			throw new ProviderError('The request to Anthropic timed out.');
		}
		if (error instanceof Anthropic.APIConnectionError) {
			throw new ProviderError('Could not reach Anthropic.');
		}
		if (
			error instanceof Anthropic.AuthenticationError ||
			error instanceof Anthropic.PermissionDeniedError
		) {
			throw new ProviderError(describeStatus(error.status, '', config.model), error.status);
		}
		if (error instanceof Anthropic.APIError) {
			const status = error.status ?? 0;
			throw new ProviderError(
				describeStatus(status, redact(error.message, config.apiKey), config.model),
				status
			);
		}
		throw error;
	}

	return {
		async chat(req: ChatRequest): Promise<ChatResult> {
			const params = {
				model: config.model,
				max_tokens: req.maxTokens,
				system: req.system,
				messages: req.messages
			};

			let message;
			try {
				message = SERVER_FALLBACK_MODELS.has(config.model)
					? await client.beta.messages
							.stream(
								{ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' },
								{ signal: req.signal }
							)
							.finalMessage()
					: await client.messages.stream(params, { signal: req.signal }).finalMessage();
			} catch (error) {
				translate(error);
			}

			// A refusal is an HTTP 200 with no usable content, so it has to be
			// checked before reading the text rather than caught as an error.
			if (message.stop_reason === 'refusal') {
				const why = message.stop_details?.explanation;
				throw new ProviderError(`The model declined this request${why ? `: ${why}` : '.'}`);
			}

			// The beta and stable responses are different array types; a loop reads
			// both, where .map on the union has no callable signature.
			let text = '';
			for (const block of message.content) {
				if (block.type === 'text') text += block.text;
			}
			if (!text) throw new ProviderError('The model returned an empty reply.');

			const usage = message.usage;
			return {
				text,
				truncated:
					message.stop_reason === 'max_tokens' ||
					message.stop_reason === 'model_context_window_exceeded',
				usage: {
					inputTokens:
						usage.input_tokens +
						(usage.cache_creation_input_tokens ?? 0) +
						(usage.cache_read_input_tokens ?? 0),
					outputTokens: usage.output_tokens
				}
			};
		},

		async listModels(signal) {
			const ids: string[] = [];
			try {
				for await (const model of client.models.list({ limit: 100 }, { signal })) {
					ids.push(model.id);
				}
			} catch (error) {
				translate(error);
			}
			return ids;
		}
	};
}
