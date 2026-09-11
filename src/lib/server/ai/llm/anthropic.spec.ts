import { describe, expect, it } from 'vitest';
import { createAnthropicClient } from './anthropic';

/**
 * The SDK's requests, captured with a fake fetch that answers in the Messages
 * streaming format — what reaches the wire is what matters here, and it
 * differs between Anthropic itself and a compatible endpoint.
 */

function stream(text: string) {
	const events: [string, unknown][] = [
		[
			'message_start',
			{
				type: 'message_start',
				message: {
					id: 'msg_1',
					type: 'message',
					role: 'assistant',
					model: 'm',
					content: [],
					stop_reason: null,
					stop_sequence: null,
					usage: { input_tokens: 10, output_tokens: 0 }
				}
			}
		],
		[
			'content_block_start',
			{ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }
		],
		[
			'content_block_delta',
			{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }
		],
		['content_block_stop', { type: 'content_block_stop', index: 0 }],
		[
			'message_delta',
			{
				type: 'message_delta',
				delta: { stop_reason: 'end_turn', stop_sequence: null },
				usage: { output_tokens: 5 }
			}
		],
		['message_stop', { type: 'message_stop' }]
	];
	return events
		.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
		.join('');
}

type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

function capture() {
	const calls: Captured[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({
			url: String(input),
			headers: new Headers(init?.headers),
			body: JSON.parse(String(init?.body ?? '{}'))
		});
		return new Response(stream('Hello'), {
			status: 200,
			headers: { 'content-type': 'text/event-stream' }
		});
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

const request = {
	system: 'S',
	messages: [{ role: 'user' as const, content: 'Hi' }],
	maxTokens: 64
};

describe('Anthropic adapter', () => {
	it('asks Anthropic for server-side fallbacks on the models that support them', async () => {
		const { calls, fetch } = capture();
		const model = createAnthropicClient({
			kind: 'anthropic',
			apiKey: 'sk-ant-test',
			baseUrl: null,
			model: 'claude-opus-5',
			fetch
		});

		const result = await model.chat(request);

		expect(result).toEqual({
			text: 'Hello',
			truncated: false,
			usage: { inputTokens: 10, outputTokens: 5 }
		});
		expect(calls[0].url).toContain('/v1/messages');
		expect(calls[0].headers.get('x-api-key')).toBe('sk-ant-test');
		expect(calls[0].headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
		expect(calls[0].body.fallbacks).toBe('default');
	});

	it('sends a compatible endpoint both key headers and no Anthropic-only fields', async () => {
		const { calls, fetch } = capture();
		const model = createAnthropicClient({
			kind: 'anthropic_compatible',
			apiKey: 'ds-key-123',
			baseUrl: 'https://api.deepseek.com/anthropic',
			// Even a Claude model name must not trigger the fallback beta elsewhere.
			model: 'claude-opus-5',
			fetch
		});

		await model.chat(request);

		expect(calls[0].url.startsWith('https://api.deepseek.com/anthropic/v1/messages')).toBe(true);
		expect(calls[0].headers.get('x-api-key')).toBe('ds-key-123');
		expect(calls[0].headers.get('authorization')).toBe('Bearer ds-key-123');
		expect(calls[0].headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
		expect(calls[0].body).not.toHaveProperty('fallbacks');
		expect(calls[0].body).toMatchObject({ model: 'claude-opus-5', max_tokens: 64, system: 'S' });
	});

	it('works with a local endpoint that needs no key', async () => {
		const { calls, fetch } = capture();
		const model = createAnthropicClient({
			kind: 'anthropic_compatible',
			apiKey: null,
			baseUrl: 'http://localhost:11434',
			model: 'qwen3',
			fetch
		});

		await model.chat(request);
		expect(calls[0].url.startsWith('http://localhost:11434/v1/messages')).toBe(true);
	});

	it('refuses a compatible provider without a base URL, and Anthropic without a key', () => {
		expect(() =>
			createAnthropicClient({
				kind: 'anthropic_compatible',
				apiKey: 'k',
				baseUrl: null,
				model: 'm'
			})
		).toThrow('base URL');
		expect(() =>
			createAnthropicClient({ kind: 'anthropic', apiKey: null, baseUrl: null, model: 'm' })
		).toThrow('API key');
	});
});
