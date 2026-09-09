import { dev } from '$app/environment';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adminUsers } from '$lib/server/db/schema';
import { verifyDecoy, verifyPassword } from '$lib/server/auth/password';
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
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? ''));

		if (!email || !password) {
			return fail(400, { email, error: 'Email and password are required.' });
		}

		// Both limits are consumed before any lookup, so a blocked attacker cannot
		// use response timing to learn whether the address exists.
		const ip = loginByIp.check(getClientAddress());
		const perEmail = loginByEmail.check(email);
		if (!ip.allowed || !perEmail.allowed) {
			const retryAfter = Math.max(ip.retryAfter, perEmail.retryAfter);
			return fail(429, {
				email,
				error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
			});
		}

		const [user] = await db
			.select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash })
			.from(adminUsers)
			.where(eq(adminUsers.email, email))
			.limit(1);

		const ok = user
			? await verifyPassword(user.passwordHash, password)
			: await verifyDecoy(password);

		if (!ok || !user) {
			// One message for both causes: naming which half was wrong hands over
			// a list of valid addresses.
			return fail(400, { email, error: 'Incorrect email or password.' });
		}

		loginByIp.reset(getClientAddress());
		loginByEmail.reset(email);

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
