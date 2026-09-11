import { describe, expect, it } from 'vitest';
import { checkConnection } from './check';
import { EmptyReplyError, ProviderError, type ModelClient } from './types';

function client(list: () => Promise<string[]>, chat: () => Promise<void> = async () => {}) {
	const calls = { chat: 0 };
	const fake: ModelClient = {
		listModels: list,
		async chat() {
			calls.chat++;
			await chat();
			return { text: 'OK', truncated: false, usage: { inputTokens: 1, outputTokens: 1 } };
		}
	};
	return { fake, calls };
}

describe('connection check', () => {
	it('trusts the model list when it names the model, and spends no tokens', async () => {
		const { fake, calls } = client(async () => ['a', 'deepseek-flash']);
		expect(await checkConnection(fake, 'deepseek-flash')).toEqual({ via: 'models', models: 2 });
		expect(calls.chat).toBe(0);
	});

	it('asks the model directly when the endpoint has no list', async () => {
		const { fake, calls } = client(async () => {
			throw new ProviderError('Model or endpoint not found (sonar).', 404);
		});
		expect(await checkConnection(fake, 'sonar')).toEqual({ via: 'chat', listed: null });
		expect(calls.chat).toBe(1);
	});

	it('asks the model directly when the list is empty or omits it', async () => {
		const empty = client(async () => []);
		expect(await checkConnection(empty.fake, 'glm-5.3')).toEqual({ via: 'chat', listed: null });

		const partial = client(async () => ['other-model']);
		expect(await checkConnection(partial.fake, 'glm-5.3')).toEqual({ via: 'chat', listed: false });
	});

	it('reports a rejected key as a rejected key, without a chat request', async () => {
		const { fake, calls } = client(async () => {
			throw new ProviderError('The provider rejected the API key.', 401);
		});
		await expect(checkConnection(fake, 'm')).rejects.toThrow('rejected the API key');
		expect(calls.chat).toBe(0);
	});

	it('fails when the model itself is refused', async () => {
		const { fake } = client(
			async () => {
				throw new ProviderError('not found', 404);
			},
			async () => {
				throw new ProviderError('Model or endpoint not found (nope).', 404);
			}
		);
		await expect(checkConnection(fake, 'nope')).rejects.toThrow('not found (nope)');
	});

	it('counts an empty reply as working: the request was accepted', async () => {
		const { fake } = client(
			async () => [],
			async () => {
				throw new EmptyReplyError();
			}
		);
		expect(await checkConnection(fake, 'thinking-model')).toEqual({ via: 'chat', listed: null });
	});
});
