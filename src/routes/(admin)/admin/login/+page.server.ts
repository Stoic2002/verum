import { dev } from '$app/environment';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { normaliseIdentifier, verifyDecoy, verifyPassword } from '$lib/server/auth/password';
import { findAdminByIdentifier } from '$lib/server/auth/session';
import { createSession, deleteExpiredSessions, setSessionCookie } from '$lib/server/auth/session';
import { loginByEmail, loginByIp } from '$lib/server/rate-limit';
import type { PageServerLoad } from './$types';

/** Only same-site absolute paths, so ?next= cannot be turned into an open redirect. */
function safeNext(raw: string | null): string {
	if (!raw) return '/admin';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/admin';
	return raw.startsWith('/admin') ? raw : '/admin';
}

export const load: PageServerLoad = ({ url }) => ({ next: safeNext(url.searchParams.get('next')) });

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		// The field is still named `email` so existing password managers keep
		// filling it; what it accepts is a username or an address.
		const identifier = normaliseIdentifier(String(form.get('email') ?? ''));
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? ''));

		if (!identifier || !password) {
			return fail(400, {
				email: identifier,
				error: 'Username or email and password are required.'
			});
		}

		// Both limits are consumed before any lookup, so a blocked attacker cannot
		// use response timing to learn whether the address exists.
		const ip = loginByIp.check(getClientAddress());
		// Keyed on whatever was typed. Someone attacking one account through both
		// its username and its address gets two budgets rather than one — a real
		// but small loosening, and the per-IP limit still binds them together.
		const perIdentifier = loginByEmail.check(identifier);
		if (!ip.allowed || !perIdentifier.allowed) {
			const retryAfter = Math.max(ip.retryAfter, perIdentifier.retryAfter);
			return fail(429, {
				email: identifier,
				error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
			});
		}

		const user = await findAdminByIdentifier(db, identifier);

		const ok = user
			? await verifyPassword(user.passwordHash, password)
			: await verifyDecoy(password);

		if (!ok || !user) {
			// One message for every cause: naming which half was wrong hands over
			// a list of valid usernames and addresses.
			return fail(400, { email: identifier, error: 'Incorrect username, email or password.' });
		}

		loginByIp.reset(getClientAddress());
		loginByEmail.reset(identifier);

		// Cheap housekeeping at the only moment sessions are created, so expired
		// rows never accumulate and no scheduler has to exist for it.
		await deleteExpiredSessions(db);

		const { token, expiresAt } = await createSession(
			db,
			user.id,
			request.headers.get('user-agent')
		);
		setSessionCookie(cookies, token, expiresAt, !dev);

		redirect(303, next);
	}
};
