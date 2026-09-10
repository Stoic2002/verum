import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * The site's own origin.
 *
 * Prefers PUBLIC_SITE_URL over the request's origin because behind Caddy and
 * Cloudflare the request origin is whatever the proxy forwarded — and a
 * canonical tag, a sitemap entry or an Open Graph URL that names the wrong
 * host is worse than none at all.
 */
export function siteOrigin(requestUrl: URL): string {
	const configured = publicEnv.PUBLIC_SITE_URL || env.PUBLIC_SITE_URL;
	return (configured || requestUrl.origin).replace(/\/+$/, '');
}

export function siteName(): string {
	return publicEnv.PUBLIC_SITE_NAME || 'VERUM';
}
