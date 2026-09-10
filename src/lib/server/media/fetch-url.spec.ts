import { describe, expect, it } from 'vitest';
import { fetchImageFromUrl } from './fetch-url';
import { UploadError } from './process';

/**
 * A server that fetches URLs on demand is an SSRF primitive. These are the
 * addresses that must never be reachable, whatever the editor pastes.
 */
describe('refuses addresses that are not on the public internet', () => {
	const blocked = [
		['loopback by name', 'http://localhost/image.png'],
		['loopback by address', 'http://127.0.0.1/image.png'],
		['loopback, obfuscated', 'http://127.1/image.png'],
		['IPv6 loopback', 'http://[::1]/image.png'],
		['private 10/8', 'http://10.0.0.5/image.png'],
		['private 192.168/16', 'http://192.168.1.1/image.png'],
		['private 172.16/12', 'http://172.20.0.1/image.png'],
		// The one that hands out credentials on almost every cloud provider.
		['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
		['CGNAT', 'http://100.64.0.1/image.png'],
		['this network', 'http://0.0.0.0/image.png']
	];

	for (const [label, url] of blocked) {
		it(label, async () => {
			await expect(fetchImageFromUrl(url)).rejects.toBeInstanceOf(UploadError);
		});
	}
});

describe('refuses anything that is not an http(s) URL', () => {
	const rejected = [
		['file scheme', 'file:///etc/passwd'],
		['gopher scheme', 'gopher://example.com/'],
		['data URI', 'data:image/png;base64,iVBORw0KGgo='],
		['not a URL at all', 'just some text'],
		['empty', '']
	];

	for (const [label, url] of rejected) {
		it(label, async () => {
			await expect(fetchImageFromUrl(url)).rejects.toBeInstanceOf(UploadError);
		});
	}
});

describe('error messages', () => {
	it('says what is wrong without echoing the internals', async () => {
		await expect(fetchImageFromUrl('http://127.0.0.1/x.png')).rejects.toThrow(
			/not reachable from here/i
		);
		await expect(fetchImageFromUrl('file:///etc/passwd')).rejects.toThrow(/http and https/i);
	});

	it('reports an unresolvable host rather than hanging', async () => {
		await expect(
			fetchImageFromUrl('https://this-host-does-not-exist.verum-test.invalid/x.png')
		).rejects.toThrow(/could not resolve/i);
	});
});
