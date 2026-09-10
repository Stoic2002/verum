/**
 * Environment variables, readable from the app and from plain scripts.
 *
 * `$env/dynamic/private` is a virtual module that only exists inside a
 * SvelteKit build, so any module importing it cannot be loaded by a script —
 * which is what stopped the seed and demo builders from touching storage.
 *
 * `process.env` alone is not a substitute: `vite dev` loads .env for
 * `$env/dynamic/private` but does **not** copy it into `process.env`, so R2
 * credentials in .env would be silently ignored during development. That was
 * measured, not assumed.
 *
 * So the source is injected. The app sets it from `$env/dynamic/private` in
 * hooks.server.ts; a script keeps the default, and `bun --env-file=.env` fills
 * `process.env` for it.
 */
let source: Record<string, string | undefined> = process.env;

export function setEnvSource(next: Record<string, string | undefined>): void {
	source = next;
}

/** Reads through to whichever source is current, at the moment of access. */
export const serverEnv = new Proxy({} as Record<string, string | undefined>, {
	get: (_target, key: string) => source[key],
	has: (_target, key: string) => key in source,
	ownKeys: () => Reflect.ownKeys(source),
	getOwnPropertyDescriptor: (_target, key: string) => ({
		value: source[key],
		enumerable: true,
		configurable: true
	})
});
