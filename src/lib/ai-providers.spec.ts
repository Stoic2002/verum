import { describe, expect, it } from 'vitest';
import {
	COMPATIBLE_KINDS,
	MODEL_GROUPS,
	MODEL_PRESETS,
	modelPreset,
	presetFor
} from './ai-providers';

describe('model provider presets', () => {
	it('have unique ids and known groups', () => {
		const ids = MODEL_PRESETS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const p of MODEL_PRESETS) expect(MODEL_GROUPS).toContain(p.group);
	});

	it('give every compatible preset a base URL, except the "other" ones', () => {
		for (const p of MODEL_PRESETS.filter((p) => COMPATIBLE_KINDS.has(p.kind))) {
			if (p.id.startsWith('custom-')) expect(p.baseUrl).toBeUndefined();
			else
				expect(p.baseUrl, p.id).toMatch(
					p.group === 'Local' ? /^http:\/\/localhost:\d+/ : /^https:\/\//
				);
		}
	});

	it('are recognised again from what is stored: kind and base URL', () => {
		for (const p of MODEL_PRESETS) {
			expect(presetFor(p.kind, p.baseUrl ?? null).id, p.id).toBe(p.id);
		}
	});

	it('tolerate a trailing slash, and fall back to "other" for an unknown URL', () => {
		expect(presetFor('openai_compatible', 'https://api.groq.com/openai/v1/').id).toBe('groq');
		expect(presetFor('openai_compatible', 'https://llm.example.com/v1').id).toBe('custom-openai');
		expect(presetFor('anthropic_compatible', 'https://proxy.example.com').id).toBe(
			'custom-anthropic'
		);
	});

	it('keep the same provider under both APIs apart', () => {
		expect(presetFor('openai_compatible', 'https://api.deepseek.com').display).toBe('DeepSeek');
		expect(presetFor('anthropic_compatible', 'https://api.deepseek.com/anthropic').display).toBe(
			'DeepSeek · Anthropic API'
		);
		expect(modelPreset('nope')).toBeUndefined();
	});
});
