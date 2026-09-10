/**
 * Admin interface preferences that the server has to know about before it
 * renders, so the first paint is already correct.
 *
 * Lives here rather than beside the endpoint that writes it: SvelteKit allows
 * only the HTTP verb handlers to be exported from a +server.ts, and the build
 * rejects anything else — a rule svelte-check does not enforce.
 */
export const SIDEBAR_COOKIE = 'verum_sidebar';
