import {
	ProviderError,
	describeStatus,
	redact,
	type ChatRequest,
	type ChatResult,
	type ModelClient,
	type ModelConfig
} from './types';

/** Google's Gemini API, natively — its request shape is not Chat Completions. */

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GenerateResponse = {
	candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
	usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
	error?: { message?: string };
};

export function createGeminiClient(config: ModelConfig): ModelClient {
	const doFetch = config.fetch ?? fetch;
	const base = (config.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
	// The API lists models as "models/gemini-…"; accept either form when typed in.
	const model = config.model.replace(/^models\//, '');

	async function request(path: string, init: RequestInit): Promise<unknown> {
		let response: Response;
		try {
			response = await doFetch(`${base}${path}`, {
				...init,
				headers: {
					'content-type': 'application/json',
					// A header, not ?key=: query strings end up in proxy and access logs.
					...(config.apiKey ? { 'x-goog-api-key': config.apiKey } : {})
				}
			});
		} catch (error) {
			if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
				throw error;
			}
			throw new ProviderError(`Could not reach ${new URL(base).host}.`);
		}

		const body = (await response.json().catch(() => ({}))) as GenerateResponse;
		if (!response.ok) {
			const detail =
				response.status === 401 || response.status === 403
					? ''
					: redact(body.error?.message ?? '', config.apiKey);
			throw new ProviderError(describeStatus(response.status, detail, model), response.status);
		}
		return body;
	}

	return {
		async chat(req: ChatRequest): Promise<ChatResult> {
			const body = (await request(`/models/${encodeURIComponent(model)}:generateContent`, {
				method: 'POST',
				signal: req.signal,
				body: JSON.stringify({
					systemInstruction: { parts: [{ text: req.system }] },
					contents: req.messages.map((m) => ({
						role: m.role === 'assistant' ? 'model' : 'user',
						parts: [{ text: m.content }]
					})),
					...(req.json ? { generationConfig: { responseMimeType: 'application/json' } } : {})
				})
			})) as GenerateResponse;

			if (body.promptFeedback?.blockReason) {
				throw new ProviderError(`Gemini blocked the request (${body.promptFeedback.blockReason}).`);
			}

			const candidate = body.candidates?.[0];
			const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
			if (!text) {
				throw new ProviderError(
					`The model returned an empty reply${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}.`
				);
			}

			return {
				text,
				truncated: candidate?.finishReason === 'MAX_TOKENS',
				usage: {
					inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
					outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0
				}
			};
		},

		async listModels(signal) {
			const body = (await request('/models?pageSize=1000', { method: 'GET', signal })) as {
				models?: { name?: string; supportedGenerationMethods?: string[] }[];
			};
			return (body.models ?? [])
				.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
				.map((m) => (m.name ?? '').replace(/^models\//, ''))
				.filter(Boolean)
				.sort();
		}
	};
}
