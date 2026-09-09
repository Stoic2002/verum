import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, lt, or, sql } from 'drizzle-orm';
import type { Database } from './db/types';
import { newsletterSubscribers, type Locale } from './db/schema';
import { env } from '$env/dynamic/private';
import { getMailer } from './mail';
import { confirmationEmail } from './mail/templates';

/**
 * Double opt-in, owned here rather than by the delivery provider.
 *
 * PRD §13.3 calls the email list the one channel Google cannot take away. That
 * is only true if the addresses live somewhere we control, so the provider
 * handles delivery and this table is the list.
 *
 * The emailed token is stored as a SHA-256, for the same reason session tokens
 * are: a database dump then contains nothing anyone can act on.
 */

const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Deliberately loose. Anything stricter rejects real addresses — plus signs,
 * new TLDs, unicode locals — and the confirmation email is the real check:
 * an address that cannot receive it never becomes a subscriber.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
	return value.length <= 254 && EMAIL.test(value);
}

export function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export type SubscribeResult =
	{ status: 'pending'; email: string } | { status: 'already-confirmed'; email: string };

/**
 * Records a signup and sends the confirmation link.
 *
 * Re-subscribing an address that is already pending issues a fresh token and
 * resends, so a lost email is recoverable without any support burden.
 */
export async function subscribe(
	db: Database,
	email: string,
	locale: Locale,
	confirmUrlFor: (token: string) => string
): Promise<SubscribeResult> {
	const address = normaliseEmail(email);

	const [existing] = await db
		.select()
		.from(newsletterSubscribers)
		.where(eq(newsletterSubscribers.email, address))
		.limit(1);

	if (existing?.status === 'confirmed') {
		// Not an error, and not a resend: telling the visitor their address is
		// already on the list is fine, but sending mail on demand to an arbitrary
		// address would make this form a way to pester someone.
		return { status: 'already-confirmed', email: address };
	}

	const token = randomBytes(24).toString('base64url');
	const values = {
		email: address,
		locale,
		status: 'pending' as const,
		confirmTokenHash: hashToken(token),
		confirmSentAt: new Date(),
		confirmedAt: null,
		unsubscribedAt: null
	};

	await db
		.insert(newsletterSubscribers)
		.values(values)
		.onConflictDoUpdate({ target: newsletterSubscribers.email, set: values });

	const mail = confirmationEmail(locale, confirmUrlFor(token));
	await getMailer().send({ to: address, ...mail });

	return { status: 'pending', email: address };
}

export type ConfirmResult = 'confirmed' | 'already-confirmed' | 'invalid';

/**
 * Confirms a subscription from an emailed token.
 *
 * The lookup is by token hash, and the token is single use: it is cleared on
 * success, so a forwarded email cannot be replayed later.
 */
export async function confirm(db: Database, token: string): Promise<ConfirmResult> {
	if (!token) return 'invalid';

	const hash = hashToken(token);
	const [row] = await db
		.select()
		.from(newsletterSubscribers)
		.where(eq(newsletterSubscribers.confirmTokenHash, hash))
		.limit(1);

	if (!row) return 'invalid';
	if (row.status === 'confirmed') return 'already-confirmed';

	const sentAt = row.confirmSentAt?.getTime() ?? 0;
	if (Date.now() - sentAt > CONFIRM_TTL_MS) return 'invalid';

	// Constant-time, even though the lookup already matched: the stored value is
	// what proves the token, and comparing it byte-by-byte costs nothing.
	const expected = Buffer.from(row.confirmTokenHash ?? '');
	const provided = Buffer.from(hash);
	if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return 'invalid';

	await db
		.update(newsletterSubscribers)
		.set({ status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null })
		.where(eq(newsletterSubscribers.id, row.id));

	return 'confirmed';
}

/**
 * Unsubscribes by email, from a signed link in every message.
 *
 * Always reports success. Whether a given address was on the list is not
 * something an unsubscribe endpoint should disclose, and the end state the
 * person wants is the same either way.
 */
export async function unsubscribe(db: Database, email: string): Promise<void> {
	await db
		.update(newsletterSubscribers)
		.set({ status: 'unsubscribed', unsubscribedAt: new Date(), confirmTokenHash: null })
		.where(eq(newsletterSubscribers.email, normaliseEmail(email)));
}

/** Housekeeping: signups that were never confirmed are not a list. */
export async function purgeStalePending(db: Database): Promise<number> {
	const cutoff = new Date(Date.now() - CONFIRM_TTL_MS);

	const deleted = await db
		.delete(newsletterSubscribers)
		.where(
			and(
				eq(newsletterSubscribers.status, 'pending'),
				or(
					sql`${newsletterSubscribers.confirmSentAt} IS NULL`,
					lt(newsletterSubscribers.confirmSentAt, cutoff)
				)
			)
		)
		.returning({ id: newsletterSubscribers.id });

	return deleted.length;
}

export async function confirmedCount(db: Database): Promise<number> {
	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int AS count FROM newsletter_subscribers WHERE status = 'confirmed'
	`);
	return Number(row?.count ?? 0);
}

/**
 * Signed unsubscribe links.
 *
 * The address travels in the URL, so without a signature anyone could
 * unsubscribe anyone else by typing an address into the query string. HMAC
 * over the address makes the link unforgeable and needs no table.
 */
function unsubscribeSecret(): string {
	const value = env.SESSION_SECRET;
	if (!value) throw new Error('SESSION_SECRET is not set');
	return value;
}

export function signUnsubscribe(email: string): string {
	return createHmac('sha256', unsubscribeSecret())
		.update(`unsubscribe:${normaliseEmail(email)}`)
		.digest('base64url');
}

export function verifyUnsubscribe(email: string, signature: string): boolean {
	const expected = Buffer.from(signUnsubscribe(email));
	const provided = Buffer.from(signature ?? '');
	if (expected.length !== provided.length) return false;
	return timingSafeEqual(expected, provided);
}

export { and, eq, lt, or };
