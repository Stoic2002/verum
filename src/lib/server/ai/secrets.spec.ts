import { describe, expect, it } from 'vitest';
import {
	DecryptError,
	SecretsUnavailableError,
	decryptSecret,
	encryptSecret,
	keyHint,
	secretsAvailable
} from './secrets';

const SECRET = 'a-test-secret-that-is-comfortably-longer-than-32-chars';
const KEY = 'sk-ant-api03-EXAMPLEEXAMPLEEXAMPLE-a1b2';

describe('API key encryption', () => {
	it('round-trips a key', () => {
		expect(decryptSecret(encryptSecret(KEY, SECRET), SECRET)).toBe(KEY);
	});

	it('never stores the key, or any recognisable part of it', () => {
		const stored = encryptSecret(KEY, SECRET);
		expect(stored).not.toContain(KEY);
		expect(stored).not.toContain('sk-ant');
		expect(stored).not.toContain('a1b2');
	});

	it('produces a different ciphertext each time for the same key', () => {
		expect(encryptSecret(KEY, SECRET)).not.toBe(encryptSecret(KEY, SECRET));
	});

	it('refuses a ciphertext that was edited', () => {
		const stored = encryptSecret(KEY, SECRET);
		const parts = stored.split('.');
		const body = Buffer.from(parts[3], 'base64url');
		body[0] ^= 0xff;
		parts[3] = body.toString('base64url');

		expect(() => decryptSecret(parts.join('.'), SECRET)).toThrow(DecryptError);
	});

	it('refuses the wrong secret instead of returning garbage', () => {
		const stored = encryptSecret(KEY, SECRET);
		expect(() => decryptSecret(stored, `${SECRET}-rotated`)).toThrow(DecryptError);
	});

	it('refuses malformed values', () => {
		expect(() => decryptSecret('plain-text-key', SECRET)).toThrow(DecryptError);
		expect(() => decryptSecret('v2.a.b.c', SECRET)).toThrow(DecryptError);
	});

	it('will not run without a real secret', () => {
		expect(() => encryptSecret(KEY, '')).toThrow(SecretsUnavailableError);
		expect(() => encryptSecret(KEY, 'short')).toThrow(SecretsUnavailableError);
		expect(secretsAvailable('short')).toBe(false);
		expect(secretsAvailable(SECRET)).toBe(true);
	});
});

describe('key hint', () => {
	it('shows only the last four characters', () => {
		expect(keyHint(KEY)).toBe('…a1b2');
	});

	it('shows nothing of a short key', () => {
		expect(keyHint('abcd1234')).toBe('••••');
	});
});
