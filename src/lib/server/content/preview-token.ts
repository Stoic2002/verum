import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { LOCALES, type Locale } from '../db/schema';

/**
 * Signed, self-contained preview links.
 *
 * No table, no rows to expire, nothing to clean up: the article, locale and
 * expiry travel inside the token and the signature is what makes them
 * trustworthy (PLAN-DEV §A.2 #6). Rotating PREVIEW_TOKEN_SECRET invalidates
 * every outstanding link at once, which is the whole revocation story.
 */

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
	const value = env.PREVIEW_TOKEN_SECRET;
	if (!value) throw new Error('PREVIEW_TOKEN_SECRET is not set');
	return value;
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createPreviewToken(
	articleId: number,
	locale: Locale,
	ttlMs = DEFAULT_TTL_MS
): string {
	const payload = `${articleId}.${locale}.${Date.now() + ttlMs}`;
	return `${payload}.${sign(payload)}`;
}

export type PreviewClaim = { articleId: number; locale: Locale; expiresAt: Date };

/**
 * Returns the claim, or null for anything that is not a currently valid token.
 *
 * The signature is checked before the expiry is trusted, because the expiry is
 * part of what the signature protects — reading it first would let anyone
 * extend their own link.
 */
export function verifyPreviewToken(token: string): PreviewClaim | null {
	const parts = token?.split('.');
	if (!parts || parts.length !== 4) return null;

	const [rawId, rawLocale, rawExp, signature] = parts;
	const payload = `${rawId}.${rawLocale}.${rawExp}`;

	const expected = Buffer.from(sign(payload));
	const provided = Buffer.from(signature);
	if (expected.length !== provided.length) return null;
	if (!timingSafeEqual(expected, provided)) return null;

	const articleId = Number(rawId);
	const expiresAt = Number(rawExp);
	if (!Number.isInteger(articleId) || articleId <= 0) return null;
	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
	if (!LOCALES.includes(rawLocale as Locale)) return null;

	return { articleId, locale: rawLocale as Locale, expiresAt: new Date(expiresAt) };
}
