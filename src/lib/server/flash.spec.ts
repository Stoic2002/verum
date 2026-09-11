import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { FLASH_COOKIE, consumeFlash, setFlash } from './flash';

/** Just enough of Cookies to observe what the helpers write and delete. */
function jar(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const options = new Map<string, unknown>();
	const cookies = {
		get: (name: string) => values.get(name),
		set: (name: string, value: string, opts: unknown) => {
			values.set(name, value);
			options.set(name, opts);
		},
		delete: (name: string) => {
			values.delete(name);
		}
	} as unknown as Cookies;
	return { cookies, values, options };
}

describe('flash', () => {
	it('round-trips one message, then is gone', () => {
		const { cookies } = jar();
		setFlash(cookies, 'success', 'Article deleted.');

		const flash = consumeFlash(cookies);
		expect(flash).toMatchObject({ type: 'success', message: 'Article deleted.' });
		expect(flash?.id).toMatch(/[\w-]{36}/);

		// Read once: a reload must not announce the same deletion again.
		expect(consumeFlash(cookies)).toBeNull();
	});

	it('gives every message its own id, so the same text twice still shows twice', () => {
		const { cookies } = jar();
		setFlash(cookies, 'success', 'Saved.');
		const first = consumeFlash(cookies);
		setFlash(cookies, 'success', 'Saved.');
		const second = consumeFlash(cookies);

		expect(first?.id).not.toBe(second?.id);
	});

	it('is scoped to /admin, short-lived and unreadable from script', () => {
		const { cookies, options } = jar();
		setFlash(cookies, 'info', 'Signed out.');

		expect(options.get(FLASH_COOKIE)).toMatchObject({ path: '/admin', httpOnly: true });
		expect((options.get(FLASH_COOKIE) as { maxAge: number }).maxAge).toBeLessThanOrEqual(60);
	});

	it.each([
		['not json', '{oops'],
		['an unknown type', JSON.stringify({ id: 'x', type: 'danger', message: 'hi' })],
		['a missing message', JSON.stringify({ id: 'x', type: 'error' })],
		['a non-string message', JSON.stringify({ id: 'x', type: 'error', message: 42 })]
	])('ignores a cookie with %s, and still clears it', (_label, raw) => {
		const { cookies, values } = jar({ [FLASH_COOKIE]: raw });

		expect(consumeFlash(cookies)).toBeNull();
		expect(values.has(FLASH_COOKIE)).toBe(false);
	});
});
