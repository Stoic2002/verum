import { browser } from '$app/environment';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

/**
 * Admin notifications.
 *
 * Module-level state is exactly what PRD §10.4 warns against on the server: a
 * module is evaluated once per process, so a store there is shared by every
 * request. This one is safe only because every write is guarded by `browser`
 * — the server's copy is never written, so it renders an empty list for
 * everyone. Keep the guard if this file is ever touched.
 */

export type ToastType = 'success' | 'error' | 'info';
export type ToastItem = { id: number; type: ToastType; message: string };

export const toasts = $state<ToastItem[]>([]);

/** Errors stay up longer: they are the ones a person has to read and act on. */
const LIFETIME: Record<ToastType, number> = { success: 4000, info: 4000, error: 8000 };
const MAX_VISIBLE = 4;

let nextId = 1;

export function toast(type: ToastType, message: string): void {
	if (!browser || !message) return;

	const id = nextId++;
	toasts.push({ id, type, message });
	if (toasts.length > MAX_VISIBLE) toasts.splice(0, toasts.length - MAX_VISIBLE);

	setTimeout(() => dismiss(id), LIFETIME[type]);
}

export function dismiss(id: number): void {
	const index = toasts.findIndex((item) => item.id === id);
	if (index !== -1) toasts.splice(index, 1);
}

function stringField(data: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = data?.[key];
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * Turns an action result into a toast.
 *
 * The convention every admin action follows: `fail(status, { error })` for a
 * failure, `{ toast }` for a success worth announcing. A redirect announces
 * nothing here — its message travels in the flash cookie instead, because the
 * result is gone by the time the next page renders.
 */
function announce(result: ActionResult): void {
	if (result.type === 'failure') {
		toast('error', stringField(result.data, 'error') ?? 'That did not work. Try again.');
	} else if (result.type === 'success') {
		const message = stringField(result.data, 'toast');
		if (message) toast('success', message);
	} else if (result.type === 'error') {
		const message = (result.error as { message?: string } | undefined)?.message;
		toast('error', message || 'Something went wrong on the server.');
	}
}

/**
 * For forms using SvelteKit's plain `use:enhance`.
 *
 * `reset` defaults to false. Resetting after a successful save puts textareas
 * back to the values they were rendered with — the pre-save text — for a
 * moment before the reload replaces them, and on a slow connection that looks
 * exactly like the edit was lost.
 */
export function enhanceWithToast(
	options: { reset?: boolean; onStart?: () => void; onDone?: () => void } = {}
): SubmitFunction {
	return () => {
		options.onStart?.();
		return async ({ result, update }) => {
			try {
				announce(result);
				await update({ reset: options.reset ?? false });
			} finally {
				options.onDone?.();
			}
		};
	};
}

/** For superforms: pass as `onUpdate`. Uses the form's own `message`. */
export function toastOnUpdate(event: {
	form: { message?: unknown };
	result: { type: string };
}): void {
	const failed = event.result.type === 'failure';
	const message = event.form.message;
	if (typeof message === 'string' && message) {
		toast(failed ? 'error' : 'success', message);
	} else if (failed) {
		toast('error', 'Some fields need attention.');
	}
}
