import { isIP } from 'node:net';

/**
 * "Who published this" -- the unit that makes two sources independent.
 *
 * news.detik.com and finance.detik.com are one publisher; counting them as two
 * would let a single outlet confirm its own claim. The correct tool is the
 * Public Suffix List. This is a deliberately small approximation of it: the
 * last two labels, or three under the second-level suffixes that are common in
 * the sources this site reads. It errs towards merging, which only ever makes
 * a claim look *less* confirmed.
 */
const SECOND_LEVEL = new Set([
	// Indonesia
	'ac.id',
	'biz.id',
	'co.id',
	'desa.id',
	'go.id',
	'mil.id',
	'my.id',
	'net.id',
	'or.id',
	'ponpes.id',
	'sch.id',
	'web.id',
	// Elsewhere, where major outlets and institutions publish
	'co.uk',
	'org.uk',
	'ac.uk',
	'gov.uk',
	'ltd.uk',
	'me.uk',
	'com.au',
	'net.au',
	'org.au',
	'gov.au',
	'edu.au',
	'co.jp',
	'ne.jp',
	'or.jp',
	'ac.jp',
	'go.jp',
	'co.kr',
	'go.kr',
	'or.kr',
	'com.sg',
	'edu.sg',
	'gov.sg',
	'com.my',
	'gov.my',
	'com.ph',
	'gov.ph',
	'co.th',
	'ac.th',
	'go.th',
	'com.vn',
	'com.hk',
	'com.tw',
	'com.cn',
	'co.in',
	'gov.in',
	'ac.in',
	'co.nz',
	'govt.nz',
	'co.za',
	'com.br',
	'com.mx',
	'com.ar',
	'com.tr',
	'com.pk',
	'com.ng',
	'co.ke'
]);

export function registrableDomain(hostname: string): string {
	const host = hostname
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '');
	if (!host || isIP(host)) return host;

	const labels = host.split('.');
	if (labels.length <= 2) return host;

	const lastTwo = labels.slice(-2).join('.');
	return SECOND_LEVEL.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/** True when `hostname` is `domain` or any subdomain of it. */
export function matchesDomain(hostname: string, domains: string[]): boolean {
	const host = hostname.toLowerCase().replace(/^www\./, '');
	return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Turns what an editor pastes -- URLs, bare hosts, one per line or comma
 * separated -- into clean hostnames. Anything that is not a plausible host is
 * dropped rather than stored as a rule that silently never matches.
 */
export function parseDomainList(input: string): string[] {
	const out = new Set<string>();
	for (const raw of input.split(/[\s,]+/)) {
		const value = raw.trim().toLowerCase();
		if (!value) continue;

		let host: string;
		try {
			host = new URL(value.includes('://') ? value : `https://${value}`).hostname;
		} catch {
			continue;
		}
		host = host.replace(/^www\./, '');
		if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) out.add(host);
	}
	return [...out].sort();
}
