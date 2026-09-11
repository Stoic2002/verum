/**
 * What the admin needs to know about each provider to render its form.
 *
 * Lives outside $lib/server because the settings page reads it in the
 * browser; it holds no secrets. Adapters live in $lib/server/ai.
 *
 * A preset is a named shortcut, not a new kind of provider: "DeepSeek" is the
 * `openai_compatible` adapter with DeepSeek's base URL filled in. Only the
 * kind and the base URL are stored, and the preset is recognised again from
 * those. Base URLs were taken from each provider's own documentation on
 * 11 September 2026; the field stays editable for regions and plans.
 */

export type ModelKind =
	'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'openai_compatible' | 'anthropic_compatible';

export const COMPATIBLE_KINDS: ReadonlySet<string> = new Set([
	'openai_compatible',
	'anthropic_compatible'
]);

export const MODEL_GROUPS = [
	'Direct',
	'OpenAI-compatible',
	'Anthropic-compatible',
	'Local'
] as const;
export type ModelGroup = (typeof MODEL_GROUPS)[number];

export type ModelPreset = {
	id: string;
	group: ModelGroup;
	label: string;
	/** Shown in lists, where the group is not visible. */
	display: string;
	kind: ModelKind;
	baseUrl?: string;
	keyRequired: boolean;
	note: string;
	/** Only where the default is certain; elsewhere the model list is loaded from the provider. */
	suggestedModel?: string;
};

const LOCAL_NOTE =
	'Only reachable when the model server runs on the same machine as VERUM. On a VPS, localhost is the VPS. No key needed.';

function preset(p: Omit<ModelPreset, 'display'> & { display?: string }): ModelPreset {
	return { ...p, display: p.display ?? p.label };
}

export const MODEL_PRESETS: ModelPreset[] = [
	// ── Direct ──────────────────────────────────────────────────────────────
	preset({
		id: 'anthropic',
		group: 'Direct',
		label: 'Claude (Anthropic)',
		kind: 'anthropic',
		keyRequired: true,
		suggestedModel: 'claude-opus-5',
		note: 'Uses the official Anthropic SDK. Key from the Claude Console.'
	}),
	preset({
		id: 'openai',
		group: 'Direct',
		label: 'ChatGPT (OpenAI)',
		kind: 'openai',
		keyRequired: true,
		note: 'Key from the OpenAI platform dashboard.'
	}),
	preset({
		id: 'gemini',
		group: 'Direct',
		label: 'Gemini (Google)',
		kind: 'gemini',
		keyRequired: true,
		note: 'Key from Google AI Studio.'
	}),
	preset({
		id: 'openrouter',
		group: 'Direct',
		label: 'OpenRouter',
		kind: 'openrouter',
		keyRequired: true,
		note: 'One key for models from many providers. Model ids look like provider/model.'
	}),

	// ── OpenAI-compatible ───────────────────────────────────────────────────
	...(
		[
			['deepseek', 'DeepSeek', 'https://api.deepseek.com', 'Key from the DeepSeek platform.'],
			['groq', 'Groq', 'https://api.groq.com/openai/v1', 'Key from the Groq console.'],
			['mistral', 'Mistral', 'https://api.mistral.ai/v1', 'Key from Mistral La Plateforme.'],
			['xai', 'xAI (Grok)', 'https://api.x.ai/v1', 'Key from the xAI console.'],
			['kimi', 'Kimi (Moonshot)', 'https://api.moonshot.ai/v1', 'Key from the Kimi API platform.'],
			[
				'zai',
				'Z.ai (GLM)',
				'https://api.z.ai/api/paas/v4',
				'General API. On the GLM Coding Plan, use https://api.z.ai/api/coding/paas/v4 instead.'
			],
			['minimax', 'MiniMax', 'https://api.minimax.io/v1', 'Key from the MiniMax platform.'],
			[
				'qwen',
				'Qwen (Alibaba Model Studio)',
				'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
				'Singapore region. Other regions: dashscope-us.aliyuncs.com (Virginia), dashscope.aliyuncs.com (Beijing).'
			],
			['together', 'Together AI', 'https://api.together.ai/v1', 'Key from the Together dashboard.'],
			[
				'fireworks',
				'Fireworks AI',
				'https://api.fireworks.ai/inference/v1',
				'Key from the Fireworks dashboard.'
			],
			[
				'perplexity',
				'Perplexity (Sonar)',
				'https://api.perplexity.ai',
				'Answers are grounded in Perplexity’s own web search. Type the model id (for example sonar-pro).'
			]
		] as const
	).map(([id, label, baseUrl, note]) =>
		preset({
			id,
			group: 'OpenAI-compatible',
			label,
			kind: 'openai_compatible',
			baseUrl,
			keyRequired: true,
			note
		})
	),
	preset({
		id: 'custom-openai',
		group: 'OpenAI-compatible',
		label: 'Other OpenAI-compatible endpoint',
		display: 'OpenAI-compatible endpoint',
		kind: 'openai_compatible',
		keyRequired: false,
		note: 'Anything that speaks the Chat Completions API. Base URL usually ends in /v1.'
	}),

	// ── Anthropic-compatible ────────────────────────────────────────────────
	...(
		[
			['deepseek-anthropic', 'DeepSeek', 'https://api.deepseek.com/anthropic'],
			['kimi-anthropic', 'Kimi (Moonshot)', 'https://api.moonshot.ai/anthropic'],
			['zai-anthropic', 'Z.ai (GLM)', 'https://api.z.ai/api/anthropic'],
			['minimax-anthropic', 'MiniMax', 'https://api.minimax.io/anthropic']
		] as const
	).map(([id, label, baseUrl]) =>
		preset({
			id,
			group: 'Anthropic-compatible',
			label,
			display: `${label} · Anthropic API`,
			kind: 'anthropic_compatible',
			baseUrl,
			keyRequired: true,
			note: 'The provider’s Anthropic Messages endpoint, used through the Anthropic SDK.'
		})
	),
	preset({
		id: 'custom-anthropic',
		group: 'Anthropic-compatible',
		label: 'Other Anthropic-compatible endpoint',
		display: 'Anthropic-compatible endpoint',
		kind: 'anthropic_compatible',
		keyRequired: false,
		note: 'Anything that speaks the Anthropic Messages API. Base URL without /v1: the SDK adds /v1/messages.'
	}),

	// ── Local ───────────────────────────────────────────────────────────────
	preset({
		id: 'ollama',
		group: 'Local',
		label: 'Ollama',
		kind: 'openai_compatible',
		baseUrl: 'http://localhost:11434/v1',
		keyRequired: false,
		note: LOCAL_NOTE
	}),
	preset({
		id: 'lmstudio',
		group: 'Local',
		label: 'LM Studio',
		kind: 'openai_compatible',
		baseUrl: 'http://localhost:1234/v1',
		keyRequired: false,
		note: LOCAL_NOTE
	}),
	preset({
		id: 'ollama-anthropic',
		group: 'Local',
		label: 'Ollama (Anthropic API)',
		kind: 'anthropic_compatible',
		baseUrl: 'http://localhost:11434',
		keyRequired: false,
		note: LOCAL_NOTE
	}),
	preset({
		id: 'lmstudio-anthropic',
		group: 'Local',
		label: 'LM Studio (Anthropic API)',
		kind: 'anthropic_compatible',
		baseUrl: 'http://localhost:1234',
		keyRequired: false,
		note: LOCAL_NOTE
	})
];

export function modelPreset(id: string): ModelPreset | undefined {
	return MODEL_PRESETS.find((p) => p.id === id);
}

const normalise = (url: string | null | undefined) =>
	(url ?? '').trim().replace(/\/+$/, '').toLowerCase();

/** Recognises the preset a stored provider was created from. */
export function presetFor(kind: string, baseUrl: string | null): ModelPreset {
	const base = normalise(baseUrl);
	return (
		MODEL_PRESETS.find((p) => p.kind === kind && p.baseUrl && normalise(p.baseUrl) === base) ??
		MODEL_PRESETS.find((p) => p.kind === kind && !COMPATIBLE_KINDS.has(kind)) ??
		MODEL_PRESETS.find((p) => p.kind === kind && !p.baseUrl) ??
		MODEL_PRESETS[0]
	);
}

export type SearchInfo = {
	label: string;
	note: string;
	keyRequired: boolean;
	/** Self-hosted engines have no fixed address. */
	baseUrlRequired?: boolean;
};

export const SEARCH_PROVIDERS: Record<string, SearchInfo> = {
	brave: {
		label: 'Brave Search API',
		note: 'Independent index. Key from the Brave Search API dashboard.',
		keyRequired: true
	},
	tavily: {
		label: 'Tavily',
		note: 'Search API built for research agents. Key from the Tavily dashboard.',
		keyRequired: true
	},
	serper: {
		label: 'Serper (Google results)',
		note: 'Google search results as JSON. Key from the Serper dashboard.',
		keyRequired: true
	},
	serpapi: {
		label: 'SerpApi (Google results)',
		note: 'Google search results as JSON. SerpApi only accepts the key as a query parameter, so it can appear in proxy logs between here and SerpApi.',
		keyRequired: true
	},
	exa: {
		label: 'Exa',
		note: 'Search built for AI: finds pages by meaning, not only keywords. Key from the Exa dashboard.',
		keyRequired: true
	},
	searxng: {
		label: 'SearXNG (self-hosted)',
		note: 'Your own metasearch instance, no key. JSON output must be enabled under search.formats in its settings.yml, or it answers 403. Public instances usually disable it.',
		keyRequired: false,
		baseUrlRequired: true
	}
};
