import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from './db/testing';
import type { Database } from './db/types';
import { newsletterSubscribers } from './db/schema';
import { setMailer, type Mail, type Mailer } from './mail';
import {
	confirm,
	confirmedCount,
	isValidEmail,
	normaliseEmail,
	purgeStalePending,
	signUnsubscribe,
	subscribe,
	unsubscribe,
	verifyUnsubscribe
} from './newsletter';

let db: Database;
let client: Sql;
let outbox: Mail[];

const capturingMailer = (): Mailer => ({
	driver: 'log',
	async send(mail) {
		outbox.push(mail);
	}
});

/** Pulls the token out of the link the confirmation email carries. */
const tokenFrom = (mail: Mail) => mail.text.match(/token=([\w-]+)/)?.[1] ?? '';

const confirmUrl = (token: string) => `https://verum.test/en/newsletter/confirm?token=${token}`;

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
});

beforeEach(async () => {
	await truncateAll(db);
	outbox = [];
	setMailer(capturingMailer());
});

afterAll(async () => {
	setMailer(undefined);
	await client?.end();
});

describe('address handling', () => {
	it('accepts the shapes real addresses take', () => {
		for (const address of [
			'a@b.co',
			'first.last+tag@example.com',
			'someone@sub.domain.example',
			'x@example.technology'
		]) {
			expect(isValidEmail(address), address).toBe(true);
		}
	});

	it('rejects what is obviously not an address', () => {
		for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@example.com', 'a@@b.com']) {
			expect(isValidEmail(bad), bad).toBe(false);
		}
	});

	it('normalises case and whitespace', () => {
		expect(normaliseEmail('  Reader@Example.COM ')).toBe('reader@example.com');
	});
});

describe('double opt-in', () => {
	it('does not add anyone to the list until the link is clicked', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);

		const [row] = await db.select().from(newsletterSubscribers);
		expect(row.status).toBe('pending');
		expect(await confirmedCount(db)).toBe(0);
		expect(outbox).toHaveLength(1);
		expect(outbox[0].to).toBe('reader@example.com');
	});

	it('stores the token hashed, never the token itself', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		const token = tokenFrom(outbox[0]);

		const [row] = await db.select().from(newsletterSubscribers);
		expect(row.confirmTokenHash).not.toBe(token);
		expect(row.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('confirms with the emailed token', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);

		expect(await confirm(db, tokenFrom(outbox[0]))).toBe('confirmed');
		expect(await confirmedCount(db)).toBe(1);
	});

	it('burns the token, so a forwarded email cannot be replayed', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		const token = tokenFrom(outbox[0]);

		expect(await confirm(db, token)).toBe('confirmed');
		// Second use finds no row: the hash was cleared on success.
		expect(await confirm(db, token)).toBe('invalid');
	});

	it('rejects an unknown or empty token', async () => {
		expect(await confirm(db, '')).toBe('invalid');
		expect(await confirm(db, 'not-a-real-token')).toBe('invalid');
	});

	it('rejects a token older than the window', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		const token = tokenFrom(outbox[0]);

		await db
			.update(newsletterSubscribers)
			.set({ confirmSentAt: new Date(Date.now() - 72 * 60 * 60 * 1000) })
			.where(eq(newsletterSubscribers.email, 'reader@example.com'));

		expect(await confirm(db, token)).toBe('invalid');
	});

	it('reissues a token when a pending address signs up again', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		const first = tokenFrom(outbox[0]);

		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		const second = tokenFrom(outbox[1]);

		expect(second).not.toBe(first);
		// A lost email is recoverable, and the old link stops working.
		expect(await confirm(db, first)).toBe('invalid');
		expect(await confirm(db, second)).toBe('confirmed');
	});

	it('does not send mail to an address already on the list', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		await confirm(db, tokenFrom(outbox[0]));
		outbox = [];

		const result = await subscribe(db, 'reader@example.com', 'en', confirmUrl);

		// Otherwise the form is a way to have this server mail a stranger on demand.
		expect(result.status).toBe('already-confirmed');
		expect(outbox).toHaveLength(0);
	});

	it('keeps the locale the reader signed up in', async () => {
		await subscribe(db, 'pembaca@example.com', 'id', confirmUrl);

		const [row] = await db.select().from(newsletterSubscribers);
		expect(row.locale).toBe('id');
		expect(outbox[0].subject).toContain('Konfirmasi');
	});
});

describe('unsubscribe', () => {
	it('signs a link that cannot be forged for someone else', () => {
		const signature = signUnsubscribe('reader@example.com');

		expect(verifyUnsubscribe('reader@example.com', signature)).toBe(true);
		// Without this, anyone could unsubscribe anyone by typing an address.
		expect(verifyUnsubscribe('victim@example.com', signature)).toBe(false);
		expect(verifyUnsubscribe('reader@example.com', 'forged')).toBe(false);
	});

	it('takes a confirmed subscriber off the list', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		await confirm(db, tokenFrom(outbox[0]));

		await unsubscribe(db, 'READER@example.com');

		expect(await confirmedCount(db)).toBe(0);
		const [row] = await db.select().from(newsletterSubscribers);
		expect(row.status).toBe('unsubscribed');
		expect(row.unsubscribedAt).not.toBeNull();
	});

	it('is silent about an address that was never subscribed', async () => {
		await expect(unsubscribe(db, 'stranger@example.com')).resolves.toBeUndefined();
	});
});

describe('housekeeping', () => {
	it('purges signups that were never confirmed', async () => {
		await subscribe(db, 'stale@example.com', 'en', confirmUrl);
		await subscribe(db, 'fresh@example.com', 'en', confirmUrl);
		await db
			.update(newsletterSubscribers)
			.set({ confirmSentAt: new Date(Date.now() - 72 * 60 * 60 * 1000) })
			.where(eq(newsletterSubscribers.email, 'stale@example.com'));

		expect(await purgeStalePending(db)).toBe(1);

		const rows = await db.select().from(newsletterSubscribers);
		expect(rows.map((r) => r.email)).toEqual(['fresh@example.com']);
	});

	it('never purges a confirmed subscriber', async () => {
		await subscribe(db, 'reader@example.com', 'en', confirmUrl);
		await confirm(db, tokenFrom(outbox[0]));
		await db
			.update(newsletterSubscribers)
			.set({ confirmSentAt: new Date(Date.now() - 72 * 60 * 60 * 1000) })
			.where(eq(newsletterSubscribers.email, 'reader@example.com'));

		expect(await purgeStalePending(db)).toBe(0);
		expect(await confirmedCount(db)).toBe(1);
	});
});
