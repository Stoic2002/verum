import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { MAX_UPLOAD_BYTES, UploadError } from './process';

/**
 * Downloads an image the editor pasted a URL for.
 *
 * A server that fetches arbitrary URLs on request is an SSRF primitive: the
 * request comes from inside the network, so it can reach the database, the
 * admin origin, and — on almost every cloud — the metadata endpoint that hands
 * out credentials. Every guard below is there for that, not for the image.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

/**
 * Ranges that must never be reachable. Anything not routable on the public
 * internet is either infrastructure or a way back into this machine.
 */
function isBlockedAddress(address: string): boolean {
	const version = isIP(address);

	if (version === 4) {
		const [a, b] = address.split('.').map(Number);
		return (
			a === 0 || // this network
			a === 10 || // private
			a === 127 || // loopback
			(a === 100 && b >= 64 && b <= 127) || // CGNAT
			(a === 169 && b === 254) || // link-local, and the cloud metadata endpoint
			(a === 172 && b >= 16 && b <= 31) || // private
			(a === 192 && b === 168) || // private
			(a === 192 && b === 0) || // IETF protocol assignments
			(a === 198 && (b === 18 || b === 19)) || // benchmarking
			a >= 224 // multicast and reserved
		);
	}

	if (version === 6) {
		const value = address.toLowerCase();
		if (value === '::' || value === '::1') return true;
		if (value.startsWith('fe80') || value.startsWith('fc') || value.startsWith('fd')) return true;
		// ::ffff:10.0.0.1 and friends map straight back to the v4 ranges above.
		const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
		if (mapped) return isBlockedAddress(mapped[1]);
		return false;
	}

	return true;
}

/**
 * Checks a URL is public before it is opened.
 *
 * Resolves the hostname and requires *every* address behind it to be routable,
 * because a name with one public and one private record would otherwise be a
 * coin flip.
 *
 * This does not close DNS rebinding — the name could resolve differently
 * between this check and the connection. Doing that properly means connecting
 * to a pinned IP and sending the Host header by hand. For an endpoint only an
 * authenticated editor can reach, the guard below is proportionate; it would
 * not be if this were public.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new UploadError('That is not a valid URL.');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new UploadError('Only http and https URLs can be imported.');
	}

	// URL keeps the brackets on an IPv6 literal — `[::1]` — and they break both
	// isIP and the resolver. Strip them before either sees the host.
	const host = url.hostname.replace(/^\[|\]$/g, '');

	// A literal address needs no resolver, and passing one to lookup() is how
	// [::1] slipped through as an unresolvable name rather than as loopback.
	if (isIP(host)) {
		if (isBlockedAddress(host)) {
			throw new UploadError('That address is not reachable from here.');
		}
		return url;
	}

	let addresses: { address: string }[];
	try {
		addresses = await lookup(host, { all: true });
	} catch {
		throw new UploadError(`Could not resolve ${host}.`);
	}

	if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
		throw new UploadError('That address is not reachable from here.');
	}

	return url;
}

/** Reads the body with a hard byte ceiling, so Content-Length cannot lie. */
async function readCapped(response: Response): Promise<Buffer> {
	const declared = Number(response.headers.get('content-length') ?? 0);
	if (declared > MAX_UPLOAD_BYTES) {
		throw new UploadError(`That image is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new UploadError('That URL returned no content.');

	const chunks: Uint8Array[] = [];
	let total = 0;

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;

		total += value.length;
		if (total > MAX_UPLOAD_BYTES) {
			await reader.cancel();
			throw new UploadError(`That image is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
		}
		chunks.push(value);
	}

	return Buffer.concat(chunks);
}

export type FetchedImage = { buffer: Buffer; name: string; source: string };

export async function fetchImageFromUrl(raw: string): Promise<FetchedImage> {
	let current = await assertPublicUrl(raw.trim());

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(current, {
			// Redirects are followed by hand so each hop is validated too —
			// otherwise a public URL can bounce straight to 169.254.169.254.
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { accept: 'image/*', 'user-agent': 'VERUM/1.0 (+media import)' }
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new UploadError('That URL redirected to nowhere.');

			current = await assertPublicUrl(new URL(location, current).href);
			continue;
		}

		if (!response.ok) {
			throw new UploadError(`That URL returned ${response.status}.`);
		}

		const buffer = await readCapped(response);

		// Content-type is not trusted as proof — processImage re-decodes the
		// bytes with sharp, and that is what actually settles whether this is an
		// image. This only catches the obvious wrong answer early.
		const type = response.headers.get('content-type') ?? '';
		if (type && !type.startsWith('image/')) {
			throw new UploadError(`That URL returned ${type.split(';')[0]}, not an image.`);
		}

		const name = decodeURIComponent(current.pathname.split('/').pop() || 'image');
		return { buffer, name, source: current.href };
	}

	throw new UploadError('Too many redirects.');
}
