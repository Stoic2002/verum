import type { ModelProviderKind } from '../../db/schema';

/**
 * The one shape every model provider is reduced to.
 *
 * Deliberately small: a system prompt, a conversation, text back. The writer
 * never asks a provider to call tools, browse, or act — research is done by
 * this server, where it can be checked (PLAN-DEV §R). That is also what keeps
 * the list of supported providers long: every chat API can do this much.
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatRequest = {
	system: string;
	messages: ChatMessage[];
	/** Output ceiling. Only providers that require one (Anthropic) send it. */
	maxTokens: number;
	/** Ask for a JSON reply where the provider has a switch for it. */
	json?: boolean;
	signal?: AbortSignal;
};

export type ChatUsage = { inputTokens: number; outputTokens: number };

export type ChatResult = {
	text: string;
	usage: ChatUsage;
	/** The provider stopped at its output limit; the text is incomplete. */
	truncated: boolean;
};

export interface ModelClient {
	chat(request: ChatRequest): Promise<ChatResult>;
	/** Model ids the key can use. Doubles as the connection test: it costs no tokens. */
	listModels(signal?: AbortSignal): Promise<string[]>;
}

export type ModelConfig = {
	kind: ModelProviderKind;
	apiKey: string | null;
	baseUrl: string | null;
	model: string;
	/** Injected in tests; the global fetch otherwise. */
	fetch?: typeof fetch;
};

export class ProviderError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

/**
 * Removes the key from anything a provider sent back before it is shown or
 * stored. Some providers echo a masked-but-partial key in 401 bodies; the
 * message goes into the job log, which is rendered in the admin.
 */
export function redact(text: string, apiKey: string | null): string {
	let value = text;
	if (apiKey && apiKey.length >= 8) value = value.split(apiKey).join('[key]');
	return value.replace(/\b(sk|rk|pk|tvly|BSA)[-_][A-Za-z0-9_*-]{6,}/g, '[key]').slice(0, 300);
}

/** One message per status class, so the log reads the same whichever provider failed. */
export function describeStatus(status: number, detail: string, model: string): string {
	if (status === 401 || status === 403) return 'The provider rejected the API key.';
	if (status === 404) return `Model or endpoint not found (${model}). ${detail}`.trim();
	if (status === 429) return 'Rate limited or out of credit at the provider. Try again later.';
	if (status >= 500) return `The provider returned an error (${status}). Try again later.`;
	return `The provider refused the request (${status}). ${detail}`.trim();
}
