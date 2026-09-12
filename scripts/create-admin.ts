/**
 * Creates or updates the single admin account (PRD §8.2: no registration, no
 * password reset — that surface deliberately does not exist).
 *
 * The password is typed here rather than passed as an argument or an
 * environment variable, so it never lands in shell history or a process list.
 *
 *   cd /srv/verum/app && sudo -u verum -H bun run admin:create
 */
import { eq, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createInterface } from 'node:readline/promises';
import postgres from 'postgres';
import { hashPassword } from '../src/lib/server/auth/password';
import * as schema from '../src/lib/server/db/schema';
import { adminUsers } from '../src/lib/server/db/schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

/**
 * Interactive when there is a terminal, and line-by-line from stdin when there
 * is not — so the same script works over `ssh host ... <<EOF` without the
 * password ever appearing in an argument list or in shell history.
 */
const piped = process.stdin.isTTY ? null : (await Bun.stdin.text()).split('\n');
let next = 0;
const rl = piped
	? null
	: createInterface({ input: process.stdin, output: process.stdout, terminal: true });

async function ask(question: string): Promise<string> {
	if (piped) return (piped[next++] ?? '').trim();
	return (await rl!.question(question)).trim();
}

async function secret(question: string): Promise<string> {
	if (piped) return piped[next++] ?? '';

	const answer = rl!.question(question);
	// Muting after the prompt is written keeps the question visible and the
	// typing invisible.
	(rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
	const value = await answer;
	delete (rl as unknown as { _writeToOutput?: unknown })._writeToOutput;
	process.stdout.write('\n');
	return value;
}

const email = (await ask('Email: ')).toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not an email address.');

const username = (await ask('Username (for signing in, may be empty): ')).toLowerCase();
if (username && !/^[a-z0-9_-]{3,32}$/.test(username)) {
	throw new Error('Username: 3 to 32 characters, letters, digits, - or _ only.');
}

const password = await secret('Password (12 characters or more): ');
if (password.length < 12) throw new Error('Too short: use 12 characters or more.');
if ((await secret('Repeat password: ')) !== password) throw new Error('The passwords differ.');
rl?.close();

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });
const passwordHash = await hashPassword(password);

const [existing] = await db
	.select({ id: adminUsers.id, email: adminUsers.email })
	.from(adminUsers)
	.where(or(eq(adminUsers.email, email), username ? eq(adminUsers.username, username) : undefined))
	.limit(1);

if (existing) {
	await db
		.update(adminUsers)
		.set({ email, username: username || null, passwordHash })
		.where(eq(adminUsers.id, existing.id));
	console.log(`\nUpdated the admin account: ${email}${username ? ` (${username})` : ''}`);
} else {
	await db.insert(adminUsers).values({ email, username: username || null, passwordHash });
	console.log(`\nCreated the admin account: ${email}${username ? ` (${username})` : ''}`);
}

await client.end();
