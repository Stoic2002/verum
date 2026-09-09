import { error } from '@sveltejs/kit';
import { getMailer, sentMail } from '$lib/server/mail';
import type { PageServerLoad } from './$types';

/**
 * The development inbox.
 *
 * Only exists while the log mail driver is active. With SMTP configured this
 * refuses outright — a page that lists the content of outgoing mail must not
 * be reachable in production, even behind the admin session.
 */
export const load: PageServerLoad = async () => {
	const mailer = getMailer();
	if (mailer.driver !== 'log') error(404, 'Not found');

	return { messages: sentMail() };
};
