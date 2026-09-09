import type { Locale } from '$lib/paraglide/runtime';
import type { SessionUser } from '$lib/server/auth/session';

declare global {
	namespace App {
		interface Locals {
			/** Resolved from the URL in hooks.server.ts. The only source of truth. */
			locale: Locale;
			/** The signed-in admin, or null. Populated for every request. */
			user: SessionUser | null;
			session: { id: string; expiresAt: Date } | null;
		}
	}
}

export {};
