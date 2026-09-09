import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { adminUsers, sessions } from '../db/schema';
import { hashPassword, verifyDecoy, verifyPassword } from './password';
import {
	createSession,
	hashSessionToken,
	generateSessionToken,
	invalidateSession,
	invalidateUserSessions,
	deleteExpiredSessions,
	validateSession
} from './session';

let db: Database;
let client: Sql;
let userId: number;

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
});

beforeEach(async () => {
	await truncateAll(db);
	const [user] = await db
		.insert(adminUsers)
		.values({ email: 'editor@verum.test', passwordHash: await hashPassword('correct horse') })
		.returning({ id: adminUsers.id });
	userId = user.id;
});

afterAll(async () => {
	await client?.end();
});

describe('password hashing', () => {
	it('verifies the right password and rejects the wrong one', async () => {
		const stored = await hashPassword('correct horse');

		expect(stored.startsWith('$argon2id$')).toBe(true);
		await expect(verifyPassword(stored, 'correct horse')).resolves.toBe(true);
		await expect(verifyPassword(stored, 'Correct horse')).resolves.toBe(false);
	});

	it('salts: the same password hashes differently every time', async () => {
		const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
		expect(a).not.toBe(b);
	});

	it('treats a corrupt stored hash as a failed login, not an error', async () => {
		await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
	});

	it('verifyDecoy always fails but does the work', async () => {
		await expect(verifyDecoy('anything')).resolves.toBe(false);
	});
});

describe('sessions', () => {
	it('stores only the hash of the token', async () => {
		const { token } = await createSession(db, userId);

		const [row] = await db.select({ id: sessions.id }).from(sessions);
		expect(row.id).toBe(hashSessionToken(token));
		expect(row.id).not.toBe(token);

		// A database dump must not contain anything a browser could present.
		const [leak] = await db.select().from(sessions).where(eq(sessions.id, token));
		expect(leak).toBeUndefined();
	});

	it('issues unpredictable tokens', () => {
		const tokens = new Set(Array.from({ length: 200 }, generateSessionToken));
		expect(tokens.size).toBe(200);
		expect([...tokens][0]).toMatch(/^[\w-]{32}$/);
	});

	it('resolves a valid token to its user', async () => {
		const { token } = await createSession(db, userId, 'vitest');
		const result = await validateSession(db, token);

		expect(result?.user).toEqual({ id: userId, email: 'editor@verum.test' });
	});

	it('rejects an unknown or empty token', async () => {
		await expect(validateSession(db, generateSessionToken())).resolves.toBeNull();
		await expect(validateSession(db, '')).resolves.toBeNull();
	});

	it('rejects an expired session', async () => {
		const { token } = await createSession(db, userId);
		await db
			.update(sessions)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(sessions.id, hashSessionToken(token)));

		await expect(validateSession(db, token)).resolves.toBeNull();
	});

	it('extends expiry when a session is used near the end of its life', async () => {
		const { token } = await createSession(db, userId);
		const soon = new Date(Date.now() + 60_000);
		await db
			.update(sessions)
			.set({ expiresAt: soon })
			.where(eq(sessions.id, hashSessionToken(token)));

		const result = await validateSession(db, token);

		expect(result).not.toBeNull();
		expect(result!.session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
	});

	it('invalidates a single session without touching the others', async () => {
		const a = await createSession(db, userId);
		const b = await createSession(db, userId);

		await invalidateSession(db, a.token);

		await expect(validateSession(db, a.token)).resolves.toBeNull();
		await expect(validateSession(db, b.token)).resolves.not.toBeNull();
	});

	it('invalidates every session for a user', async () => {
		const a = await createSession(db, userId);
		const b = await createSession(db, userId);

		await invalidateUserSessions(db, userId);

		await expect(validateSession(db, a.token)).resolves.toBeNull();
		await expect(validateSession(db, b.token)).resolves.toBeNull();
	});

	it('deleting the user deletes their sessions', async () => {
		const { token } = await createSession(db, userId);
		await db.delete(adminUsers).where(eq(adminUsers.id, userId));

		await expect(validateSession(db, token)).resolves.toBeNull();
	});

	it('sweeps expired rows and keeps live ones', async () => {
		const dead = await createSession(db, userId);
		const live = await createSession(db, userId);
		await db
			.update(sessions)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(sessions.id, hashSessionToken(dead.token)));

		await deleteExpiredSessions(db);

		const [{ count }] = await db.execute<{ count: number }>(
			sql`SELECT count(*)::int AS count FROM sessions`
		);
		expect(Number(count)).toBe(1);
		await expect(validateSession(db, live.token)).resolves.not.toBeNull();
	});

	it('truncates an oversized user agent instead of failing the login', async () => {
		const { token } = await createSession(db, userId, 'x'.repeat(5000));
		await expect(validateSession(db, token)).resolves.not.toBeNull();
	});
});
