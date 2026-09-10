import { afterEach, describe, expect, it } from 'vitest';
import { serverEnv, setEnvSource } from './env';

/**
 * The reason this indirection exists is measured, not assumed: `vite dev`
 * loads .env for `$env/dynamic/private` but does not copy it into
 * `process.env`. A module reading `process.env` directly would therefore
 * ignore R2 or SMTP credentials during development and only appear to work
 * once deployed.
 */
afterEach(() => setEnvSource(process.env));

describe('server environment', () => {
	it('reads through to the injected source', () => {
		setEnvSource({ EXAMPLE: 'from-sveltekit' });
		expect(serverEnv.EXAMPLE).toBe('from-sveltekit');
	});

	it('reflects a later change of source, not the one captured at import', () => {
		// hooks.server.ts injects at module scope, after this module is first
		// evaluated. Capturing by value would leave every reader on process.env.
		setEnvSource({ EXAMPLE: 'first' });
		expect(serverEnv.EXAMPLE).toBe('first');

		setEnvSource({ EXAMPLE: 'second' });
		expect(serverEnv.EXAMPLE).toBe('second');
	});

	it('reports a missing variable as undefined rather than throwing', () => {
		setEnvSource({});
		expect(serverEnv.NOT_SET).toBeUndefined();
	});

	it('supports `in` and enumeration, which config checks rely on', () => {
		setEnvSource({ A: '1', B: undefined });
		expect('A' in serverEnv).toBe(true);
		expect(Object.keys(serverEnv).sort()).toEqual(['A', 'B']);
	});

	it('defaults to process.env for scripts run outside SvelteKit', () => {
		process.env.VERUM_ENV_PROBE = 'script';
		setEnvSource(process.env);

		expect(serverEnv.VERUM_ENV_PROBE).toBe('script');
		delete process.env.VERUM_ENV_PROBE;
	});
});
