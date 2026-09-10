import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Declares who may sell this site's ad inventory (PRD §13.2).
 *
 * The line comes from the AdSense dashboard and contains the publisher id, so
 * it is configuration rather than code. Until it is set this returns 404 —
 * an empty or placeholder ads.txt is treated by verifiers as a broken
 * declaration, which is worse than not having the file.
 */
export const GET: RequestHandler = ({ setHeaders }) => {
	const line = env.ADS_TXT?.trim();
	if (!line) return new Response('Not found', { status: 404 });

	setHeaders({
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=86400'
	});

	return new Response(line.endsWith('\n') ? line : `${line}\n`);
};
