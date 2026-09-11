import type { Cookies } from '@sveltejs/kit';
import type { ToastType } from '$lib/toast.svelte';

/**
 * A message that survives one redirect.
 *
 * An action that redirects — create an article, delete one, sign out — loses
 * its result on the way: the next page renders from a fresh load, not from the
 * action's return value. So the message is written to a short-lived cookie,
 * read once by the page that loads next, and deleted in the same breath.
 *
 * The id lets the client tell a new flash from the same one rendered twice.
 */
export const FLASH_COOKIE = 'verum_flash';

export type Flash = { id: string; type: ToastType; message: string };

const TYPES: ToastType[] = ['success', 'error', 'info'];

export function setFlash(cookies: Cookies, type: ToastType, message: string): void {
	cookies.set(FLASH_COOKIE, JSON.stringify({ id: crypto.randomUUID(), type, message }), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'lax',
		// Long enough to survive the redirect, short enough that an abandoned one
		// does not surface on some unrelated page tomorrow.
		maxAge: 60
	});
}

export function consumeFlash(cookies: Cookies): Flash | null {
	const raw = cookies.get(FLASH_COOKIE);
	if (!raw) return null;

	cookies.delete(FLASH_COOKIE, { path: '/admin' });

	try {
		const value = JSON.parse(raw) as Partial<Flash>;
		if (
			typeof value.id === 'string' &&
			typeof value.message === 'string' &&
			TYPES.includes(value.type as ToastType)
		) {
			return value as Flash;
		}
	} catch {
		// A cookie that is not ours, or was tampered with: show nothing.
	}
	return null;
}
