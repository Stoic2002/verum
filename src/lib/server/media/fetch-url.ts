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
async function assertPublicUrl(raw: string, allowOrigin?: string | null): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new UploadError('That is not a valid URL.');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new UploadError('Only http and https URLs can be imported.');
	}

	// Test fixtures only: one exact origin, set explicitly (see fetchPublic).
	if (allowOrigin && url.origin === allowOrigin) return url;

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
async function readCapped(response: Response, maxBytes: number, noun: string): Promise<Buffer> {
	const tooLarge = () =>
		new UploadError(`That ${noun} is larger than ${maxBytes / 1024 / 1024} MB.`);

	const declared = Number(response.headers.get('content-length') ?? 0);
	if (declared > maxBytes) throw tooLarge();

	const reader = response.body?.getReader();
	if (!reader) throw new UploadError('That URL returned no content.');

	const chunks: Uint8Array[] = [];
	let total = 0;

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;

		total += value.length;
		if (total > maxBytes) {
			await reader.cancel();
			throw tooLarge();
		}
		chunks.push(value);
	}

	return Buffer.concat(chunks);
}

export type PublicFetchOptions = {
	accept: string;
	maxBytes: number;
	/** What the thing is called in error messages: "image", "page". */
	noun: string;
	userAgent: string;
	signal?: AbortSignal;
	/**
	 * One exact origin exempt from the address checks. Exists for the e2e
	 * suite, whose fixture pages are necessarily on 127.0.0.1; production
	 * never sets it. Exact-origin only, so it cannot widen into a range.
	 */
	allowOrigin?: string | null;
};

export type PublicFetchResult = { buffer: Buffer; contentType: string; url: URL };

/**
 * Fetches a URL that came from outside — an editor's paste, a search result —
 * with every hop checked against the blocked ranges above.
 */
export async function fetchPublic(
	raw: string,
	options: PublicFetchOptions
): Promise<PublicFetchResult> {
	let current = await assertPublicUrl(raw.trim(), options.allowOrigin);
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(current, {
			// Redirects are followed by hand so each hop is validated too —
			// otherwise a public URL can bounce straight to 169.254.169.254.
			redirect: 'manual',
			signal,
			headers: { accept: options.accept, 'user-agent': options.userAgent }
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new UploadError('That URL redirected to nowhere.');

			current = await assertPublicUrl(new URL(location, current).href, options.allowOrigin);
			continue;
		}

		if (!response.ok) {
			throw new UploadError(`That URL returned ${response.status}.`);
		}

		const buffer = await readCapped(response, options.maxBytes, options.noun);
		return { buffer, contentType: response.headers.get('content-type') ?? '', url: current };
	}

	throw new UploadError('Too many redirects.');
}

export type FetchedImage = { buffer: Buffer; name: string; source: string };

export async function fetchImageFromUrl(raw: string): Promise<FetchedImage> {
	const { buffer, contentType, url } = await fetchPublic(raw, {
		accept: 'image/*',
		maxBytes: MAX_UPLOAD_BYTES,
		noun: 'image',
		userAgent: 'VERUM/1.0 (+media import)'
	});

	// Content-type is not trusted as proof — processImage re-decodes the
	// bytes with sharp, and that is what actually settles whether this is an
	// image. This only catches the obvious wrong answer early.
	if (contentType && !contentType.startsWith('image/')) {
		throw new UploadError(`That URL returned ${contentType.split(';')[0]}, not an image.`);
	}

	const name = decodeURIComponent(url.pathname.split('/').pop() || 'image');
	return { buffer, name, source: url.href };
}
