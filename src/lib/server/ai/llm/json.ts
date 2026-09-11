import * as v from 'valibot';
import { ProviderError, type ChatRequest, type ChatUsage, type ModelClient } from './types';

/**
 * Structured replies from any model.
 *
 * Not every provider on the list can be forced into JSON, so the contract is
 * enforced here instead: the reply is parsed leniently (models wrap JSON in
 * fences and prose), validated strictly, and a model that misses gets exactly
 * one chance to fix it with the validation errors in hand.
 */

/** Pulls the first complete JSON object or array out of a reply. */
export function extractJson(text: string): unknown {
	const trimmed = text
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');

	try {
		return JSON.parse(trimmed);
	} catch {
		// Fall through to scanning.
	}

	const start = trimmed.search(/[{[]/);
	if (start === -1) throw new ProviderError('The model did not return JSON.');

	const open = trimmed[start];
	const close = open === '{' ? '}' : ']';
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = start; i < trimmed.length; i++) {
		const char = trimmed[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === open) depth++;
		else if (char === close && --depth === 0) {
			try {
				return JSON.parse(trimmed.slice(start, i + 1));
			} catch {
				break;
			}
		}
	}

	throw new ProviderError('The model did not return valid JSON.');
}

function describeIssues(issues: v.BaseIssue<unknown>[]): string {
	return issues
		.slice(0, 8)
		.map((issue) => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`)
		.join('; ');
}

export async function chatJson<TSchema extends v.GenericSchema>(
	client: ModelClient,
	request: ChatRequest,
	schema: TSchema
): Promise<{ data: v.InferOutput<TSchema>; usage: ChatUsage }> {
	const usage: ChatUsage = { inputTokens: 0, outputTokens: 0 };
	let messages = request.messages;
	let lastProblem = '';

	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await client.chat({ ...request, messages, json: true });
		usage.inputTokens += result.usage.inputTokens;
		usage.outputTokens += result.usage.outputTokens;

		try {
			if (result.truncated) throw new ProviderError('The reply was cut off at the output limit.');
			const parsed = v.safeParse(schema, extractJson(result.text));
			if (parsed.success) return { data: parsed.output, usage };
			lastProblem = describeIssues(parsed.issues);
		} catch (error) {
			lastProblem = (error as Error).message;
		}

		messages = [
			...request.messages,
			{ role: 'assistant', content: result.text.slice(0, 20_000) },
			{
				role: 'user',
				content: `That reply could not be used: ${lastProblem}\nReply again with only the JSON object, matching the requested shape exactly.`
			}
		];
	}

	throw new ProviderError(`The model's reply did not match the expected format: ${lastProblem}`);
}
