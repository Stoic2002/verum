import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in for the outside world the AI writer talks to: an
 * OpenAI-compatible model API and two news pages, on one local port.
 *
 * The preview server is told this exact origin is readable
 * (AI_UNSAFE_TEST_SOURCE_ORIGIN in playwright.config.ts); every other private
 * address stays blocked, which is what keeps the SSRF guard honest in tests.
 */

export const MOCK_PORT = 4599;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;
export const LAUNCH_URL = `${MOCK_ORIGIN}/pages/launch`;
export const REVIEW_URL = `${MOCK_ORIGIN}/pages/review`;

const LAUNCH =
	'The Orbit 2 laptop ships on 14 October with a larger battery and a starting price of $999.';
const HINGE =
	'Chief executive Mara Ellis said the company had spent three years redesigning the hinge.';
const REVIEW =
	'In our testing the Orbit 2 lasted 11 hours on a single charge, two hours longer than its predecessor.';
const FILLER =
	'Availability varies by region, and the company did not say when the device would reach other markets. '.repeat(
		4
	);

function page(title: string, site: string, paragraphs: string[]) {
	return `<!doctype html><html><head><title>${title}</title>
<meta property="og:site_name" content="${site}">
<meta property="article:published_time" content="2026-09-01T09:00:00Z">
</head><body><nav>Home Deals Newsletter Sign in</nav>
<article><h1>${title}</h1>${paragraphs.map((p) => `<p>${p}</p>`).join('')}<p>${FILLER}</p></article>
<footer>Copyright ${site}</footer></body></html>`;
}

const PAGES: Record<string, string> = {
	'/pages/launch': page('Orbit 2 launch details', 'Gadget Wire', [LAUNCH, HINGE]),
	'/pages/review': page('Orbit 2 review: battery', 'Bench Lab', [REVIEW])
};

export const OUTLINE_TITLE = 'Orbit 2: what the new laptop changes';

function reply(system: string): string {
	if (system.includes('plan web searches')) return JSON.stringify({ queries: ['orbit 2 laptop'] });

	if (system.includes('extract verifiable facts')) {
		return JSON.stringify({
			claims: [
				{
					statement: 'The Orbit 2 ships on 14 October at $999.',
					evidence: [{ source: 'S1', quote: LAUNCH }]
				},
				{
					statement: 'The Orbit 2 lasted 11 hours on a charge in testing.',
					evidence: [{ source: 'S2', quote: REVIEW }]
				},
				{
					statement: 'The Orbit 2 is made from recycled aluminium.',
					// Not on either page: the check must catch it.
					evidence: [
						{ source: 'S1', quote: 'The chassis is made from 100 percent recycled aluminium.' }
					]
				}
			]
		});
	}

	if (system.includes('outline an article')) {
		return JSON.stringify({
			title: OUTLINE_TITLE,
			excerpt: 'A larger battery, a new hinge, and a $999 price.',
			sections: [
				{ heading: 'What is new', points: ['C1 launch and price', 'C2 battery life'] },
				{ heading: 'Our assessment', points: ['Editor adds their own battery test'] }
			]
		});
	}

	return [
		'## What is new',
		'',
		'The Orbit 2 ships on 14 October at $999 [S1]. In testing it lasted 11 hours on a charge [S2].',
		'',
		'## Our assessment',
		'',
		'[[EDITOR: Add your own battery test and whether the upgrade is worth it.]]'
	].join('\n');
}

async function body(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

function send(response: ServerResponse, status: number, type: string, payload: string) {
	response.writeHead(status, { 'content-type': type });
	response.end(payload);
}

async function handle(request: IncomingMessage, response: ServerResponse) {
	const path = (request.url ?? '/').split('?')[0];

	if (request.method === 'GET' && PAGES[path]) {
		return send(response, 200, 'text/html; charset=utf-8', PAGES[path]);
	}
	// Like Perplexity: chat works, but there is no model list to ask.
	if (path.startsWith('/nolist/') && path.endsWith('/models')) {
		return send(
			response,
			404,
			'application/json',
			JSON.stringify({ error: { message: 'Not found' } })
		);
	}
	// The Anthropic Models API shape, for an Anthropic-compatible endpoint.
	if (request.method === 'GET' && path === '/anthropic/v1/models') {
		return send(
			response,
			200,
			'application/json',
			JSON.stringify({
				data: [
					{
						type: 'model',
						id: 'mock-writer',
						display_name: 'Mock writer',
						created_at: '2026-09-01T00:00:00Z'
					}
				],
				has_more: false,
				first_id: 'mock-writer',
				last_id: 'mock-writer'
			})
		);
	}
	if (request.method === 'GET' && path === '/v1/models') {
		return send(
			response,
			200,
			'application/json',
			JSON.stringify({ data: [{ id: 'mock-writer' }] })
		);
	}
	if (
		request.method === 'POST' &&
		(path === '/v1/chat/completions' || path === '/nolist/v1/chat/completions')
	) {
		const payload = JSON.parse(await body(request)) as {
			messages: { role: string; content: string }[];
		};
		const system = payload.messages.find((m) => m.role === 'system')?.content ?? '';
		return send(
			response,
			200,
			'application/json',
			JSON.stringify({
				choices: [
					{ message: { role: 'assistant', content: reply(system) }, finish_reason: 'stop' }
				],
				usage: { prompt_tokens: 1200, completion_tokens: 300 }
			})
		);
	}
	send(response, 404, 'text/plain', 'not found');
}

export async function startMockAi(): Promise<Server> {
	const server = createServer((request, response) => {
		handle(request, response).catch(() => send(response, 500, 'text/plain', 'mock error'));
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(MOCK_PORT, '127.0.0.1', resolve);
	});
	return server;
}
