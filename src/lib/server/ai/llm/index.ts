import { createAnthropicClient } from './anthropic';
import { createGeminiClient } from './gemini';
import { createOpenAiClient } from './openai';
import type { ModelClient, ModelConfig } from './types';

export { chatJson, extractJson } from './json';
export { ProviderError } from './types';
export type {
	ChatMessage,
	ChatRequest,
	ChatResult,
	ChatUsage,
	ModelClient,
	ModelConfig
} from './types';

export function createModelClient(config: ModelConfig): ModelClient {
	switch (config.kind) {
		case 'anthropic':
			return createAnthropicClient(config);
		case 'gemini':
			return createGeminiClient(config);
		case 'openai':
		case 'openrouter':
		case 'openai_compatible':
			return createOpenAiClient(config);
	}
}
