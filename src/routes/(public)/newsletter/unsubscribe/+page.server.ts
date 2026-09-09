import { db } from '$lib/server/db';
import { unsubscribe, verifyUnsubscribe } from '$lib/server/newsletter';
import type { Actions, PageServerLoad } from './$types';

/**
 * Unsubscribe is a POST, reached from a signed GET link.
 *
 * A one-click GET would be triggered by any mail client that prefetches links,
 * silently unsubscribing people who never clicked. The page confirms; the
 * signature is what proves the address belongs to whoever opened the email.
 */
export const load: PageServerLoad = ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });

	const email = url.searchParams.get('e') ?? '';
	const signature = url.searchParams.get('s') ?? '';

	return { email, signature, valid: Boolean(email) && verifyUnsubscribe(email, signature) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const signature = String(form.get('signature') ?? '');

		if (!verifyUnsubscribe(email, signature)) return { done: false };

		await unsubscribe(db, email);
		return { done: true };
	}
};
