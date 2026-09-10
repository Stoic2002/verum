import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id at OWASP's recommended second-choice profile: 19 MiB, 2 iterations,
 * 1 lane. These match @node-rs/argon2's current defaults but are pinned
 * explicitly — a library changing its defaults must not silently weaken hashes
 * written afterwards.
 */
const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/**
 * A hash of a throwaway password, used to spend the same time verifying a
 * login for an address that does not exist as one that does. Without it, the
 * response time itself tells an attacker which addresses are real.
 */
let decoyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
	return hash(password, PARAMS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
	try {
		return await verify(storedHash, password);
	} catch {
		// A malformed hash in the database is a failed login, not a 500.
		return false;
	}
}

/** Burn a comparable amount of time when there is no user to verify against. */
export async function verifyDecoy(password: string): Promise<false> {
	decoyHash ??= hash('decoy-password-not-in-use', PARAMS);
	await verifyPassword(await decoyHash, password);
	return false;
}

/**
 * Normalises whatever was typed into the sign-in box.
 *
 * Both usernames and email addresses are stored lowercase, so the comparison
 * is case-insensitive without a functional index on either column.
 */
export function normaliseIdentifier(value: string): string {
	return value.trim().toLowerCase();
}

/** True when the identifier looks like an address rather than a username. */
export function looksLikeEmail(value: string): boolean {
	return value.includes('@');
}
