import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { serverEnv } from '../env';

/**
 * Encryption for provider API keys at rest.
 *
 * A key for Claude or OpenAI is a blank cheque on someone's card. Keeping it
 * in plain text means a database dump — a backup in R2, a restore test, a
 * support copy — carries it too. AES-256-GCM with a secret that lives only in
 * the environment means the dump alone is not enough.
 *
 * GCM is authenticated: a ciphertext that was edited, or decrypted with the
 * wrong secret, fails loudly instead of yielding a wrong key that would then
 * be sent to a provider.
 */

const VERSION = 'v1';
const MIN_SECRET_LENGTH = 32;
/** Binds a ciphertext to this use, so it cannot be replayed as another kind of secret. */
const AAD = Buffer.from('verum:ai-credential');

export class SecretsUnavailableError extends Error {
	constructor() {
		super(
			`AI_KEY_SECRET is not set (or shorter than ${MIN_SECRET_LENGTH} characters). ` +
				'Generate one with `openssl rand -base64 48` and add it to .env.'
		);
	}
}

export class DecryptError extends Error {
	constructor() {
		super('A stored API key could not be decrypted. AI_KEY_SECRET may have changed.');
	}
}

function deriveKey(secret: string | undefined): Buffer {
	if (!secret || secret.length < MIN_SECRET_LENGTH) throw new SecretsUnavailableError();
	// HKDF rather than hashing the secret directly: the input is a human-managed
	// string of unknown shape, and the salt separates this key from any other
	// key a future feature derives from the same variable.
	return Buffer.from(hkdfSync('sha256', secret, 'verum-ai-credentials', '', 32));
}

const b64 = (value: Buffer) => value.toString('base64url');

export function encryptSecret(plain: string, secret = serverEnv.AI_KEY_SECRET): string {
	const key = deriveKey(secret);
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(AAD);
	const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(body)].join('.');
}

export function decryptSecret(stored: string, secret = serverEnv.AI_KEY_SECRET): string {
	const key = deriveKey(secret);
	const [version, iv, tag, body] = stored.split('.');
	if (version !== VERSION || !iv || !tag || body === undefined) throw new DecryptError();

	try {
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
		decipher.setAAD(AAD);
		decipher.setAuthTag(Buffer.from(tag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(body, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		throw new DecryptError();
	}
}

export function secretsAvailable(secret = serverEnv.AI_KEY_SECRET): boolean {
	return Boolean(secret && secret.length >= MIN_SECRET_LENGTH);
}

/**
 * What the admin shows instead of the key: enough to tell two keys apart,
 * never enough to use one. Short keys show nothing at all, because four
 * characters of a twelve-character key is a third of it.
 */
export function keyHint(key: string): string {
	const value = key.trim();
	return value.length >= 16 ? `…${value.slice(-4)}` : '••••';
}
