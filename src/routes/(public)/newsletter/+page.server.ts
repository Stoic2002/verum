import { fail, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { isValidEmail, normaliseEmail, subscribe } from '$lib/server/newsletter';
import { createRateLimiter } from '$lib/server/rate-limit';
import type { PageServerLoad } from './$types';

/**
 * Signups are rate limited per IP because the endpoint sends mail. Without a
 * limit it is a way to have this server deliver unsolicited email to an
 * arbitrary address, over and over.
 */
const signupByIp = createRateLimiter({ capacity: 5, refillMs: 60 * 60 * 1000 });

export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return {};
};

export const actions: Actions = {
	default: async ({ request, url, locals, getClientAddress }) => {
		const form = await request.formData();
		const email = normaliseEmail(String(form.get('email') ?? ''));

		// A hidden field real people never fill in. Cheaper than a CAPTCHA and it
		// costs no reader anything (PLAN-DEV §E.2).
		if (String(form.get('website') ?? '')) return { state: 'pending', email };

		if (!isValidEmail(email)) return fail(400, { state: 'invalid-email', email });

		if (!signupByIp.check(getClientAddress()).allowed) {
			return fail(429, { state: 'rate-limited', email });
		}

		const result = await subscribe(
			db,
			email,
			locals.locale,
			(token) =>
				`${url.origin}/${locals.locale}/newsletter/confirm?token=${encodeURIComponent(token)}`
		);

		// The same response either way: whether an address is already on the list
		// is not something a public form should reveal.
		return { state: 'pending', email: result.email };
	}
};
