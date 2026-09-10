import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { adminUsers } from '../db/schema';
import { hashPassword, looksLikeEmail, normaliseIdentifier } from './password';
import { findAdminByIdentifier } from './session';

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
		.values({
			email: 'editor@verum.test',
			username: 'editor',
			passwordHash: await hashPassword('correct horse')
		})
		.returning({ id: adminUsers.id });
	userId = user.id;
});

afterAll(async () => {
	await client?.end();
});

describe('identifier handling', () => {
	it('lowercases and trims whatever was typed', () => {
		expect(normaliseIdentifier('  Editor ')).toBe('editor');
		expect(normaliseIdentifier('Editor@Verum.TEST')).toBe('editor@verum.test');
	});

	it('recognises an address', () => {
		expect(looksLikeEmail('editor@verum.test')).toBe(true);
		expect(looksLikeEmail('editor')).toBe(false);
	});
});

describe('finding an account', () => {
	it('matches on the username', async () => {
		expect((await findAdminByIdentifier(db, 'editor'))?.id).toBe(userId);
	});

	it('matches on the email address', async () => {
		expect((await findAdminByIdentifier(db, 'editor@verum.test'))?.id).toBe(userId);
	});

	it('returns null for anything else', async () => {
		expect(await findAdminByIdentifier(db, 'someone-else')).toBeNull();
		expect(await findAdminByIdentifier(db, '')).toBeNull();
	});

	it("never lets one account be reached by another account's username", async () => {
		await db.insert(adminUsers).values({
			email: 'second@verum.test',
			username: 'second',
			passwordHash: await hashPassword('x')
		});

		expect((await findAdminByIdentifier(db, 'second'))?.id).not.toBe(userId);
	});

	it('rejects a duplicate username at the database level', async () => {
		// The unique constraint is what stops an address being shadowed.
		await expect(
			db.insert(adminUsers).values({
				email: 'other@verum.test',
				username: 'editor',
				passwordHash: await hashPassword('x')
			})
		).rejects.toThrow();
	});

	it('allows an account with no username at all', async () => {
		await db.insert(adminUsers).values({
			email: 'legacy@verum.test',
			passwordHash: await hashPassword('x')
		});

		expect(await findAdminByIdentifier(db, 'legacy@verum.test')).not.toBeNull();
	});
});
