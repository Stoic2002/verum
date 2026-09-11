import { describe, expect, it } from 'vitest';
import { createGeminiClient } from './gemini';
import { createOpenAiClient } from './openai';
import { EmptyReplyError, ProviderError, StreamBrokenError } from './types';

/** A response body delivered in the given pieces, optionally failing afterwards. */
function body(pieces: string[], failAfter = false) {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const piece of pieces) controller.enqueue(encoder.encode(piece));
			if (failAfter) controller.error(new TypeError('terminated'));
			else controller.close();
		}
	});
}

const sse = (events: unknown[]) =>
	events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');

type Call = { url: string; body: Record<string, unknown>; headers: Headers };

/** Answers each call with the next response in the list. */
function fetchSequence(...responses: (() => Response)[]) {
	const calls: Call[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({
			url: String(input),
			body: init?.body ? JSON.parse(String(init.body)) : {},
			headers: new Headers(init?.headers)
		});
		const next = responses[Math.min(calls.length - 1, responses.length - 1)];
		return next();
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

const eventStream =
	(pieces: string[], failAfter = false) =>
	() =>
		new Response(body(pieces, failAfter), { headers: { 'content-type': 'text/event-stream' } });

const request = {
	system: 'S',
	messages: [{ role: 'user' as const, content: 'Hi' }],
	maxTokens: 64
};

const openai = (fetch: typeof globalThis.fetch) =>
	createOpenAiClient({
		kind: 'openai_compatible',
		apiKey: 'router-key-123456',
		baseUrl: 'https://router.example.com/v1',
		model: 'flash-model',
		fetch
	});

describe('OpenAI-compatible streaming', () => {
	it('streams the answer and reads usage from the final chunk', async () => {
		const events = sse([
			{ choices: [{ delta: { content: 'Hel' } }] },
			{ choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }] },
			{ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } },
			'[DONE]'
		]);
		// Cut mid-event, as networks do.
		const f = fetchSequence(eventStream([events.slice(0, 25), events.slice(25)]));

		const result = await openai(f.fetch).chat(request);

		expect(result).toEqual({
			text: 'Hello',
			truncated: false,
			usage: { inputTokens: 12, outputTokens: 3 }
		});
		expect(f.calls[0].body).toMatchObject({
			stream: true,
			stream_options: { include_usage: true }
		});
		expect(f.calls[0].url).toBe('https://router.example.com/v1/chat/completions');
	});

	it('explains an answer that was all reasoning and hit the limit', async () => {
		const f = fetchSequence(
			eventStream([
				sse([
					{ choices: [{ delta: { reasoning_content: 'Let me think about the claims…' } }] },
					{ choices: [{ delta: { content: '' }, finish_reason: 'length' }] },
					'[DONE]'
				])
			])
		);

		const failure = await openai(f.fetch)
			.chat(request)
			.catch((e: unknown) => e);

		expect(failure).toBeInstanceOf(EmptyReplyError);
		expect((failure as Error).message).toContain('(length)');
		expect((failure as Error).message).toContain('output budget reasoning');
	});

	it('reports a connection that broke mid-answer as that, not as an empty reply', async () => {
		const f = fetchSequence(
			eventStream([sse([{ choices: [{ delta: { content: 'Partial' } }] }])], true)
		);

		const failure = await openai(f.fetch)
			.chat(request)
			.catch((e: unknown) => e);

		expect(failure).toBeInstanceOf(StreamBrokenError);
		expect((failure as Error).message).toMatch(
			/connection to router\.example\.com broke after \d+s/
		);
	});

	it('asks again without stream_options when the server rejects the field', async () => {
		const f = fetchSequence(
			() =>
				new Response(JSON.stringify({ error: { message: 'Unrecognized field: stream_options' } }), {
					status: 400
				}),
			eventStream([
				sse([{ choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] }, '[DONE]'])
			])
		);

		expect((await openai(f.fetch).chat(request)).text).toBe('OK');
		expect(f.calls).toHaveLength(2);
		expect(f.calls[1].body).not.toHaveProperty('stream_options');
		expect(f.calls[1].body.stream).toBe(true);
	});

	it('still reads a server that ignores streaming and answers with JSON', async () => {
		const f = fetchSequence(
			() =>
				new Response(
					JSON.stringify({
						choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
						usage: { prompt_tokens: 5, completion_tokens: 2 }
					}),
					{ headers: { 'content-type': 'application/json' } }
				)
		);

		expect(await openai(f.fetch).chat(request)).toEqual({
			text: '{"ok":true}',
			truncated: false,
			usage: { inputTokens: 5, outputTokens: 2 }
		});
	});

	it('marks a cut-off answer as truncated, and a rejected key without echoing the body', async () => {
		const cut = fetchSequence(
			eventStream([
				sse([
					{ choices: [{ delta: { content: '{"claims": [' }, finish_reason: 'length' }] },
					'[DONE]'
				])
			])
		);
		expect((await openai(cut.fetch).chat(request)).truncated).toBe(true);

		const denied = fetchSequence(
			() =>
				new Response(JSON.stringify({ error: { message: 'bad key router-key-123456' } }), {
					status: 401
				})
		);
		const failure = await openai(denied.fetch)
			.chat(request)
			.catch((e: unknown) => e);
		expect(failure).toBeInstanceOf(ProviderError);
		expect((failure as Error).message).toBe('The provider rejected the API key.');
	});
});

describe('Gemini streaming', () => {
	const gemini = (fetch: typeof globalThis.fetch) =>
		createGeminiClient({
			kind: 'gemini',
			apiKey: 'AIza-test',
			baseUrl: null,
			model: 'models/gemini-x',
			fetch
		});

	it('streams text, skips thought parts, and counts thinking as output', async () => {
		const f = fetchSequence(
			eventStream([
				sse([
					{ candidates: [{ content: { parts: [{ text: 'planning', thought: true }] } }] },
					{ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] },
					{
						candidates: [{ content: { parts: [{ text: ' world' }] }, finishReason: 'STOP' }],
						usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 2, thoughtsTokenCount: 30 }
					}
				])
			])
		);

		const result = await gemini(f.fetch).chat(request);

		expect(result).toEqual({
			text: 'Hello world',
			truncated: false,
			usage: { inputTokens: 9, outputTokens: 32 }
		});
		expect(f.calls[0].url).toBe(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-x:streamGenerateContent?alt=sse'
		);
		expect(f.calls[0].headers.get('x-goog-api-key')).toBe('AIza-test');
	});

	it('explains thinking that used up the output limit, and a blocked prompt', async () => {
		const thinking = fetchSequence(
			eventStream([
				sse([
					{
						candidates: [
							{ content: { parts: [{ text: '…', thought: true }] }, finishReason: 'MAX_TOKENS' }
						],
						usageMetadata: {
							promptTokenCount: 9,
							candidatesTokenCount: 0,
							thoughtsTokenCount: 8000
						}
					}
				])
			])
		);
		await expect(gemini(thinking.fetch).chat(request)).rejects.toThrow('output budget reasoning');

		const blocked = fetchSequence(
			eventStream([sse([{ promptFeedback: { blockReason: 'SAFETY' } }])])
		);
		await expect(gemini(blocked.fetch).chat(request)).rejects.toThrow(
			'blocked the request (SAFETY)'
		);
	});
});
