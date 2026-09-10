import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Database } from '../db/types';
import type { Cookies } from '@sveltejs/kit';
import { adminUsers, sessions } from '../db/schema';
import { or } from 'drizzle-orm';

export const SESSION_COOKIE = 'verum_session';

const DAY = 24 * 60 * 60 * 1000;
/** How long a session lives without being used. */
export const SESSION_TTL = 30 * DAY;
/** Sessions inside this much of expiry get extended on use. */
const RENEW_WITHIN = 15 * DAY;

export type SessionUser = { id: number; email: string };

/**
 * The cookie carries the token; the database stores only its SHA-256.
 *
 * A stolen database dump then contains no usable session — the same reason
 * passwords are hashed. SHA-256 without a salt is right here and wrong for
 * passwords: the input is 192 bits of randomness, so there is nothing to guess.
 */
export function generateSessionToken(): string {
	return randomBytes(24).toString('base64url');
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function createSession(db: Database, userId: number, userAgent?: string | null) {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL);

	await db.insert(sessions).values({
		id: hashSessionToken(token),
		userId,
		expiresAt,
		userAgent: userAgent?.slice(0, 512) ?? null
	});

	return { token, expiresAt };
}

/**
 * Resolves a cookie token to its user, or null.
 *
 * Expiry is enforced in the WHERE clause rather than compared in JS: a row that
 * has expired is never returned in the first place, so there is no window where
 * a caller forgets to check.
 */
export async function validateSession(db: Database, token: string) {
	if (!token) return null;

	const id = hashSessionToken(token);
	const [row] = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			userId: adminUsers.id,
			email: adminUsers.email
		})
		.from(sessions)
		.innerJoin(adminUsers, eq(adminUsers.id, sessions.userId))
		.where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
		.limit(1);

	if (!row) return null;

	// Sliding expiry: an actively used session does not log itself out mid-edit.
	let expiresAt = row.expiresAt;
	if (expiresAt.getTime() - Date.now() < RENEW_WITHIN) {
		expiresAt = new Date(Date.now() + SESSION_TTL);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}

	return {
		user: { id: row.userId, email: row.email } satisfies SessionUser,
		session: { id: row.sessionId, expiresAt }
	};
}

export async function invalidateSession(db: Database, token: string) {
	await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}

/** Used after a password change, and by the logout-everywhere action. */
export async function invalidateUserSessions(db: Database, userId: number) {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping; safe to run from a cron. */
export async function deleteExpiredSessions(db: Database) {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export function setSessionCookie(
	cookies: Cookies,
	token: string,
	expiresAt: Date,
	secure: boolean
) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies, secure: boolean) {
	cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure });
}

/** Constant-time compare for anything token-shaped that is not a session. */
/**
 * Finds the account for a sign-in attempt, by username or by email.
 *
 * One query over both columns rather than two lookups: a second round trip
 * would take measurably longer for a username than for an email, and response
 * time is exactly the channel the decoy hash exists to close.
 */
export async function findAdminByIdentifier(db: Database, identifier: string) {
	const [row] = await db
		.select({ id: adminUsers.id, passwordHash: adminUsers.passwordHash })
		.from(adminUsers)
		.where(or(eq(adminUsers.email, identifier), eq(adminUsers.username, identifier)))
		.limit(1);

	return row ?? null;
}

export function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}
