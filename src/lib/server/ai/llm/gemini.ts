import { sseData } from './sse';
import {
	EmptyReplyError,
	ProviderError,
	StreamBrokenError,
	describeEmpty,
	describeStatus,
	redact,
	type ChatRequest,
	type ChatResult,
	type ModelClient,
	type ModelConfig
} from './types';

/**
 * Google's Gemini API, natively — its request shape is not Chat Completions.
 * Streamed for the same reason as the OpenAI adapter: a long answer must not
 * sit behind a connection that sends nothing for five minutes.
 */

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type Chunk = {
	candidates?: {
		content?: { parts?: { text?: string; thought?: boolean }[] };
		finishReason?: string;
	}[];
	promptFeedback?: { blockReason?: string };
	usageMetadata?: {
		promptTokenCount?: number;
		candidatesTokenCount?: number;
		thoughtsTokenCount?: number;
	};
	error?: { message?: string };
	models?: { name?: string; supportedGenerationMethods?: string[] }[];
};

const isAbort = (error: unknown) =>
	(error as Error)?.name === 'AbortError' || (error as Error)?.name === 'TimeoutError';

export function createGeminiClient(config: ModelConfig): ModelClient {
	const doFetch = config.fetch ?? fetch;
	const base = (config.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
	const host = new URL(base).host;
	// The API lists models as "models/gemini-…"; accept either form when typed in.
	const model = config.model.replace(/^models\//, '');

	async function call(path: string, init: RequestInit): Promise<Response> {
		try {
			return await doFetch(`${base}${path}`, {
				...init,
				headers: {
					'content-type': 'application/json',
					// A header, not ?key=: query strings end up in proxy and access logs.
					...(config.apiKey ? { 'x-goog-api-key': config.apiKey } : {})
				}
			});
		} catch (error) {
			if (isAbort(error)) throw error;
			throw new ProviderError(`Could not reach ${host}.`);
		}
	}

	async function failure(response: Response): Promise<ProviderError> {
		const text = await response.text().catch(() => '');
		let message: string;
		try {
			message = (JSON.parse(text) as Chunk).error?.message ?? '';
		} catch {
			message = text.slice(0, 200);
		}
		const detail =
			response.status === 401 || response.status === 403 ? '' : redact(message, config.apiKey);
		return new ProviderError(describeStatus(response.status, detail, model), response.status);
	}

	return {
		async chat(req: ChatRequest): Promise<ChatResult> {
			const started = Date.now();
			const response = await call(
				`/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
				{
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
				}
			);
			if (!response.ok) throw await failure(response);

			let text = '';
			let reasoned = false;
			let finish: string | null = null;
			const usage = { inputTokens: 0, outputTokens: 0 };

			const take = (chunk: Chunk) => {
				if (chunk.promptFeedback?.blockReason) {
					throw new ProviderError(
						`Gemini blocked the request (${chunk.promptFeedback.blockReason}).`
					);
				}
				const candidate = chunk.candidates?.[0];
				for (const part of candidate?.content?.parts ?? []) {
					if (part.thought) reasoned = true;
					else if (part.text) text += part.text;
				}
				if (candidate?.finishReason) finish = candidate.finishReason;
				const meta = chunk.usageMetadata;
				if (meta) {
					if (meta.thoughtsTokenCount) reasoned = true;
					usage.inputTokens = meta.promptTokenCount ?? 0;
					// Thinking tokens are billed as output.
					usage.outputTokens = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
				}
			};

			try {
				if (
					(response.headers.get('content-type') ?? '').includes('text/event-stream') &&
					response.body
				) {
					for await (const data of sseData(response.body)) {
						try {
							take(JSON.parse(data) as Chunk);
						} catch (error) {
							if (error instanceof ProviderError) throw error;
						}
					}
				} else {
					take((await response.json()) as Chunk);
				}
			} catch (error) {
				if (isAbort(error) || error instanceof ProviderError) throw error;
				throw new StreamBrokenError(host, Math.round((Date.now() - started) / 1000));
			}

			if (!text)
				throw new EmptyReplyError(describeEmpty(finish === 'MAX_TOKENS', reasoned, finish));
			return { text, truncated: finish === 'MAX_TOKENS', usage };
		},

		async listModels(signal) {
			const response = await call('/models?pageSize=1000', { method: 'GET', signal });
			if (!response.ok) throw await failure(response);
			let body: Chunk;
			try {
				body = (await response.json()) as Chunk;
			} catch {
				throw new ProviderError(`${host} answered the model list with something other than JSON.`);
			}
			return (body.models ?? [])
				.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
				.map((m) => (m.name ?? '').replace(/^models\//, ''))
				.filter(Boolean)
				.sort();
		}
	};
}
