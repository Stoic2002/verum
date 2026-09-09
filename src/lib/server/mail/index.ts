import { createTransport } from 'nodemailer';
import { env } from '$env/dynamic/private';

/**
 * Transactional email behind one interface.
 *
 * SMTP in production, an in-memory log otherwise. Same reasoning as the storage
 * driver in Fase 4: the double opt-in flow can be built and tested end to end
 * before an SMTP account exists, and CI has no credentials.
 *
 * Partial SMTP configuration throws rather than falling back — a production
 * deploy missing one variable would otherwise accept subscriptions and silently
 * never send the confirmation, which looks like a working form and is not one.
 */

export type Mail = { to: string; subject: string; text: string; html: string };

export interface Mailer {
	readonly driver: 'smtp' | 'log';
	send(mail: Mail): Promise<void>;
}

/** What the log driver captured. Read by the dev inbox route and by e2e. */
const sent: (Mail & { at: Date })[] = [];

function createLogMailer(): Mailer {
	return {
		driver: 'log',
		async send(mail) {
			sent.push({ ...mail, at: new Date() });
			// Keep the buffer small; it exists to be inspected, not to be an archive.
			if (sent.length > 50) sent.splice(0, sent.length - 50);
			console.info(`[mail:log] to=${mail.to} subject=${mail.subject}`);
		}
	};
}

function createSmtpMailer(): Mailer {
	const transport = createTransport({
		host: env.SMTP_HOST!,
		port: Number(env.SMTP_PORT ?? 587),
		secure: Number(env.SMTP_PORT ?? 587) === 465,
		auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! }
	});

	const from = env.MAIL_FROM || env.SMTP_USER!;

	return {
		driver: 'smtp',
		async send(mail) {
			await transport.sendMail({ from, ...mail });
		}
	};
}

let cached: Mailer | undefined;

export function getMailer(): Mailer {
	if (cached) return cached;

	const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const;
	const present = required.filter((name) => env[name]);

	if (present.length === required.length) {
		if (!env.MAIL_FROM) throw new Error('MAIL_FROM is required when SMTP is configured');
		cached = createSmtpMailer();
	} else if (present.length > 0) {
		const missing = required.filter((name) => !env[name]);
		throw new Error(`SMTP is partially configured; missing: ${missing.join(', ')}`);
	} else {
		cached = createLogMailer();
	}

	return cached;
}

/** Tests swap the driver without touching the environment. */
export function setMailer(mailer: Mailer | undefined) {
	cached = mailer;
}

/** Only meaningful for the log driver. */
export function sentMail() {
	return sent.slice().reverse();
}
