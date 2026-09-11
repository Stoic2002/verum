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
 * OpenAI's Chat Completions shape — spoken by OpenAI itself, by OpenRouter,
 * and by most self-hosted and third-party endpoints (DeepSeek, Groq, Mistral,
 * Together, Ollama, LM Studio …). One adapter, many providers.
 *
 * Answers are streamed. A single JSON response only arrives when the whole
 * answer is written, and Node's HTTP client gives up on a response that sends
 * nothing for 300 seconds — so a long claim extraction on a slow model was cut
 * off and surfaced as an "empty reply" after exactly five minutes. A stream
 * keeps data flowing while the model writes.
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

type Message = {
	content?: string | null;
	reasoning_content?: string | null;
	reasoning?: string | null;
};

type Chunk = {
	choices?: { message?: Message; delta?: Message; finish_reason?: string | null }[];
	usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
	error?: { message?: string };
	data?: { id?: string }[];
};

const isAbort = (error: unknown) =>
	(error as Error)?.name === 'AbortError' || (error as Error)?.name === 'TimeoutError';

export function createOpenAiClient(config: ModelConfig): ModelClient {
	const doFetch = config.fetch ?? fetch;
	const base = openAiBaseUrl(config);
	const host = new URL(base).host;

	const headers = (): Record<string, string> => ({
		'content-type': 'application/json',
		...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
		// OpenRouter uses this to attribute traffic; only sent there.
		...(config.kind === 'openrouter' ? { 'x-title': 'VERUM' } : {})
	});

	async function call(path: string, init: RequestInit): Promise<Response> {
		try {
			return await doFetch(`${base}${path}`, { ...init, headers: headers() });
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
		const detail = response.status === 401 ? '' : redact(message, config.apiKey);
		return new ProviderError(
			describeStatus(response.status, detail, config.model),
			response.status
		);
	}

	const seconds = (started: number) => Math.round((Date.now() - started) / 1000);

	async function readStream(
		body: ReadableStream<Uint8Array>,
		started: number
	): Promise<ChatResult> {
		let text = '';
		let reasoned = false;
		let finish: string | null = null;
		const usage = { inputTokens: 0, outputTokens: 0 };

		try {
			for await (const data of sseData(body)) {
				if (data === '[DONE]') break;
				let chunk: Chunk;
				try {
					chunk = JSON.parse(data) as Chunk;
				} catch {
					continue;
				}
				if (chunk.error) {
					throw new ProviderError(
						`The provider stopped with an error: ${redact(chunk.error.message ?? 'unknown', config.apiKey)}`
					);
				}
				for (const choice of chunk.choices ?? []) {
					const delta = choice.delta ?? choice.message ?? {};
					if (typeof delta.content === 'string') text += delta.content;
					if (delta.reasoning_content || delta.reasoning) reasoned = true;
					if (choice.finish_reason) finish = choice.finish_reason;
				}
				if (chunk.usage) {
					usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
					usage.outputTokens = chunk.usage.completion_tokens ?? 0;
				}
			}
		} catch (error) {
			if (isAbort(error) || error instanceof ProviderError) throw error;
			throw new StreamBrokenError(host, seconds(started));
		}

		if (!text) throw new EmptyReplyError(describeEmpty(finish === 'length', reasoned, finish));
		return { text, truncated: finish === 'length', usage };
	}

	/** For servers that ignore `stream: true` and answer with one JSON body. */
	async function readJson(response: Response, started: number): Promise<ChatResult> {
		let body: Chunk;
		try {
			body = (await response.json()) as Chunk;
		} catch (error) {
			if (isAbort(error)) throw error;
			throw new StreamBrokenError(host, seconds(started));
		}
		const choice = body.choices?.[0];
		const message = choice?.message ?? {};
		const text = message.content ?? '';
		const finish = choice?.finish_reason ?? null;
		if (!text) {
			const reasoned = Boolean(message.reasoning_content || message.reasoning);
			throw new EmptyReplyError(describeEmpty(finish === 'length', reasoned, finish));
		}
		return {
			text,
			truncated: finish === 'length',
			usage: {
				inputTokens: body.usage?.prompt_tokens ?? 0,
				outputTokens: body.usage?.completion_tokens ?? 0
			}
		};
	}

	return {
		async chat(req: ChatRequest): Promise<ChatResult> {
			const payload = {
				model: config.model,
				messages: [{ role: 'system', content: req.system }, ...req.messages],
				stream: true,
				// No max_tokens and no temperature: OpenAI's reasoning models reject both
				// in their classic form, and every endpoint here defaults to the model's
				// own ceiling. JSON mode only where it is known to exist.
				...(req.json && config.kind === 'openai'
					? { response_format: { type: 'json_object' } }
					: {})
			};
			const send = (body: object) =>
				call('/chat/completions', {
					method: 'POST',
					signal: req.signal,
					body: JSON.stringify(body)
				});

			const started = Date.now();
			// Token usage in the last streamed chunk is an OpenAI extension that most
			// compatible servers copy. One that rejects the field is asked again without it.
			let response = await send({ ...payload, stream_options: { include_usage: true } });
			if (response.status === 400 || response.status === 422) {
				const mentionsIt = await response
					.clone()
					.text()
					.then((t) => /stream_options|include_usage/i.test(t))
					.catch(() => false);
				if (mentionsIt) response = await send(payload);
			}
			if (!response.ok) throw await failure(response);

			const type = response.headers.get('content-type') ?? '';
			if (type.includes('text/event-stream') && response.body) {
				return readStream(response.body, started);
			}
			return readJson(response, started);
		},

		async listModels(signal) {
			const response = await call('/models', { method: 'GET', signal });
			if (!response.ok) throw await failure(response);
			let body: Chunk;
			try {
				body = (await response.json()) as Chunk;
			} catch {
				throw new ProviderError(`${host} answered the model list with something other than JSON.`);
			}
			return (body.data ?? [])
				.map((m) => m.id)
				.filter((id): id is string => Boolean(id))
				.sort();
		}
	};
}
