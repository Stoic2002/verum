import {
	EmptyReplyError,
	ProviderError,
	describeStatus,
	redact,
	type ChatRequest,
	type ChatResult,
	type ModelClient,
	type ModelConfig
} from './types';

/**
 * OpenAI's Chat Completions shape — spoken by OpenAI itself, by OpenRouter,
 * and by most self-hosted and third-party endpoints (DeepSeek, Groq, Mistral,
 * Together, Ollama, LM Studio …). One adapter, many providers.
 */

const DEFAULT_BASE: Record<string, string> = {
	openai: 'https://api.openai.com/v1',
	openrouter: 'https://openrouter.ai/api/v1'
};

export function openAiBaseUrl(config: Pick<ModelConfig, 'kind' | 'baseUrl'>): string {
	const base = config.baseUrl?.trim() || DEFAULT_BASE[config.kind];
	if (!base) throw new ProviderError('This provider needs a base URL.');
	return base.replace(/\/+$/, '');
}

type CompletionResponse = {
	choices?: { message?: { content?: string | null }; finish_reason?: string }[];
	usage?: { prompt_tokens?: number; completion_tokens?: number };
	error?: { message?: string };
};

export function createOpenAiClient(config: ModelConfig): ModelClient {
	const doFetch = config.fetch ?? fetch;
	const base = openAiBaseUrl(config);

	const headers = (): Record<string, string> => ({
		'content-type': 'application/json',
		...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
		// OpenRouter uses these to attribute traffic; harmless elsewhere, so only sent there.
		...(config.kind === 'openrouter' ? { 'x-title': 'VERUM' } : {})
	});

	async function request(path: string, init: RequestInit): Promise<unknown> {
		let response: Response;
		try {
			response = await doFetch(`${base}${path}`, { ...init, headers: headers() });
		} catch (error) {
			if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
				throw error;
			}
			throw new ProviderError(`Could not reach ${new URL(base).host}.`);
		}

		const body = (await response.json().catch(() => ({}))) as CompletionResponse;
		if (!response.ok) {
			const detail =
				response.status === 401 ? '' : redact(body.error?.message ?? '', config.apiKey);
			throw new ProviderError(
				describeStatus(response.status, detail, config.model),
				response.status
			);
		}
		return body;
	}

	return {
		async chat(req: ChatRequest): Promise<ChatResult> {
			const body = (await request('/chat/completions', {
				method: 'POST',
				signal: req.signal,
				body: JSON.stringify({
					model: config.model,
					messages: [{ role: 'system', content: req.system }, ...req.messages],
					// No max_tokens and no temperature: OpenAI's reasoning models reject
					// both in their classic form, and every endpoint here defaults to the
					// model's own ceiling, which is what a long draft needs anyway.
					// JSON mode only where it is known to exist; an unknown parameter is a
					// 400 on stricter self-hosted servers, and the prompt asks for JSON too.
					...(req.json && config.kind === 'openai'
						? { response_format: { type: 'json_object' } }
						: {})
				})
			})) as CompletionResponse;

			const choice = body.choices?.[0];
			const text = choice?.message?.content ?? '';
			if (!text) throw new EmptyReplyError();

			return {
				text,
				truncated: choice?.finish_reason === 'length',
				usage: {
					inputTokens: body.usage?.prompt_tokens ?? 0,
					outputTokens: body.usage?.completion_tokens ?? 0
				}
			};
		},

		async listModels(signal) {
			const body = (await request('/models', { method: 'GET', signal })) as {
				data?: { id?: string }[];
			};
			return (body.data ?? [])
				.map((m) => m.id)
				.filter((id): id is string => Boolean(id))
				.sort();
		}
	};
}
