/**
 * What the admin needs to know about each provider to render its form.
 *
 * Lives outside $lib/server because the settings page reads it in the
 * browser; it holds no secrets. Adapters live in $lib/server/ai.
 */

export type ProviderInfo = {
	label: string;
	/** Shown under the form when this provider is selected. */
	note: string;
	baseUrl: 'hidden' | 'optional' | 'required';
	keyRequired: boolean;
	/** Only where the default is certain. Elsewhere the editor loads the list from the provider. */
	suggestedModel?: string;
};

export const MODEL_PROVIDERS = {
	anthropic: {
		label: 'Claude (Anthropic)',
		note: 'Uses the official Anthropic SDK. Key from the Claude Console.',
		baseUrl: 'hidden',
		keyRequired: true,
		suggestedModel: 'claude-opus-5'
	},
	openai: {
		label: 'ChatGPT (OpenAI)',
		note: 'Key from the OpenAI platform dashboard.',
		baseUrl: 'hidden',
		keyRequired: true
	},
	gemini: {
		label: 'Gemini (Google)',
		note: 'Key from Google AI Studio.',
		baseUrl: 'hidden',
		keyRequired: true
	},
	openrouter: {
		label: 'OpenRouter',
		note: 'One key for models from many providers. Model ids look like provider/model.',
		baseUrl: 'hidden',
		keyRequired: true
	},
	openai_compatible: {
		label: 'OpenAI-compatible endpoint',
		note: 'Anything that speaks the Chat Completions API: DeepSeek, Groq, Mistral, Together, a local Ollama or LM Studio … Enter its base URL, usually ending in /v1. The key may be empty for a local server.',
		baseUrl: 'required',
		keyRequired: false
	}
} satisfies Record<string, ProviderInfo>;

export const SEARCH_PROVIDERS = {
	brave: {
		label: 'Brave Search API',
		note: 'Independent index. Key from the Brave Search API dashboard.',
		baseUrl: 'hidden',
		keyRequired: true
	},
	tavily: {
		label: 'Tavily',
		note: 'Search API built for research agents. Key from the Tavily dashboard.',
		baseUrl: 'hidden',
		keyRequired: true
	}
} satisfies Record<string, ProviderInfo>;
