import { describe, expect, it } from 'vitest';
import { matchesDomain, parseDomainList, registrableDomain } from './domain';
import { normaliseForMatch, numbersIn, quoteInText, verifyClaims } from './verify';

const REUTERS = {
	key: 'S1',
	domain: 'reuters.com',
	text: `The company said on Tuesday it had raised $2.5 billion in new funding,
	       valuing it at \u201Croughly $60 billion\u201D. Chief executive Jane Doe said the money
	       would be spent on data centres in Southeast Asia over the next three years.`
};
const DETIK = {
	key: 'S2',
	domain: 'detik.com',
	text: 'Perusahaan itu mengumpulkan pendanaan baru senilai $2.5 billion, menurut pernyataan resmi hari Selasa.'
};
const DETIK_FINANCE = { key: 'S3', domain: 'detik.com', text: DETIK.text };
const VERGE = {
	key: 'S4',
	domain: 'theverge.com',
	text: 'In a statement, the firm confirmed it had raised $2.5 billion in new funding this week.'
};

describe('quote matching', () => {
	it('finds a quote despite curly quotes, case and line breaks', () => {
		const source = normaliseForMatch(REUTERS.text);
		expect(quoteInText('valuing it at "roughly $60 billion"', source)).toBe(true);
		expect(quoteInText('THE MONEY\n WOULD BE SPENT ON DATA CENTRES', source)).toBe(true);
	});

	it('ignores zero-width characters hidden in the page', () => {
		const source = normaliseForMatch('data\u200B centres in Southeast Asia over the next');
		expect(quoteInText('data centres in Southeast Asia', source)).toBe(true);
	});

	it('rejects a paraphrase', () => {
		const source = normaliseForMatch(REUTERS.text);
		expect(quoteInText('the company raised 2.5 billion dollars in funding', source)).toBe(false);
	});

	it('rejects a quote too short to prove anything', () => {
		const source = normaliseForMatch(REUTERS.text);
		expect(quoteInText('said on Tuesday', source)).toBe(false);
	});

	it('accepts an ellipsis only when the pieces occur in order', () => {
		const source = normaliseForMatch(REUTERS.text);
		expect(
			quoteInText('it had raised $2.5 billion \u2026 on data centres in Southeast Asia', source)
		).toBe(true);
		expect(
			quoteInText('on data centres in Southeast Asia ... it had raised $2.5 billion', source)
		).toBe(false);
	});

	it('does not let tiny fragments be stitched into a sentence', () => {
		const source = normaliseForMatch(REUTERS.text);
		expect(quoteInText('The company ... on ... data centres in Southeast Asia', source)).toBe(
			false
		);
	});
});

describe('numbers', () => {
	it('treats id and en separators as the same number', () => {
		expect(numbersIn('1.000 pengguna')).toEqual(['1000']);
		expect(numbersIn('1,000 users')).toEqual(['1000']);
	});

	it('ignores single digits, which prose spells out as often as not', () => {
		expect(numbersIn('3 companies in 2026')).toEqual(['2026']);
	});
});

describe('claim verification', () => {
	it('confirms a claim quoted from two independent publishers', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'The company raised $2.5 billion in new funding.',
					evidence: [
						{ source: 'S1', quote: 'it had raised $2.5 billion in new funding' },
						{ source: 's4', quote: 'confirmed it had raised $2.5 billion in new funding' }
					]
				}
			],
			[REUTERS, VERGE]
		);

		expect(claim.status).toBe('confirmed');
		expect(claim.domains).toEqual(['reuters.com', 'theverge.com']);
		expect(claim.included).toBe(true);
	});

	it('counts two sections of one publisher as one source', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'The company raised $2.5 billion.',
					evidence: [
						{ source: 'S2', quote: 'mengumpulkan pendanaan baru senilai $2.5 billion' },
						{ source: 'S3', quote: 'mengumpulkan pendanaan baru senilai $2.5 billion' }
					]
				}
			],
			[DETIK, DETIK_FINANCE]
		);

		expect(claim.status).toBe('single');
		expect(claim.domains).toEqual(['detik.com']);
	});

	it('marks an invented quote unverified and leaves it out by default', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'The company plans an IPO next year.',
					evidence: [{ source: 'S1', quote: 'the company is preparing to go public next year' }]
				}
			],
			[REUTERS]
		);

		expect(claim.status).toBe('unverified');
		expect(claim.evidence[0].found).toBe(false);
		expect(claim.included).toBe(false);
	});

	it('flags a number the quotes do not contain, even when the quote is real', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'The company raised $3 billion, valuing it at $60 billion.',
					evidence: [
						{
							source: 'S1',
							quote: 'valuing it at "roughly $60 billion"'
						}
					]
				}
			],
			[REUTERS]
		);

		expect(claim.evidence[0].found).toBe(true);
		expect(claim.status).toBe('single');

		const [wrong] = verifyClaims(
			[
				{
					statement: 'The company raised $25 billion.',
					evidence: [{ source: 'S1', quote: 'Chief executive Jane Doe said the money' }]
				}
			],
			[REUTERS]
		);
		expect(wrong.evidence[0].found).toBe(true);
		expect(wrong.status).toBe('mismatch');
		expect(wrong.unmatchedNumbers).toEqual(['25']);
		expect(wrong.included).toBe(false);
	});

	it('does not trust a source key the model made up', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'Jane Doe leads the company.',
					evidence: [{ source: 'S9', quote: 'Chief executive Jane Doe said the money' }]
				}
			],
			[REUTERS]
		);

		expect(claim.status).toBe('unverified');
	});

	it('does not count the same quote twice', () => {
		const [claim] = verifyClaims(
			[
				{
					statement: 'Money goes to data centres.',
					evidence: [
						{ source: 'S1', quote: 'would be spent on data centres in Southeast Asia' },
						{ source: 'S1', quote: 'Would be spent on data centres in Southeast Asia' }
					]
				}
			],
			[REUTERS]
		);

		expect(claim.evidence).toHaveLength(1);
	});
});

describe('domains', () => {
	it('reduces hosts to the publisher', () => {
		expect(registrableDomain('finance.detik.com')).toBe('detik.com');
		expect(registrableDomain('www.bbc.co.uk')).toBe('bbc.co.uk');
		expect(registrableDomain('news.kompas.co.id')).toBe('kompas.co.id');
		expect(registrableDomain('reuters.com')).toBe('reuters.com');
	});

	it('matches a listed domain and its subdomains, not lookalikes', () => {
		expect(matchesDomain('www.reuters.com', ['reuters.com'])).toBe(true);
		expect(matchesDomain('graphics.reuters.com', ['reuters.com'])).toBe(true);
		expect(matchesDomain('notreuters.com', ['reuters.com'])).toBe(false);
	});

	it('parses what an editor pastes into clean hosts', () => {
		expect(parseDomainList('https://www.Reuters.com/world\n bbc.co.uk, not_a domain ,,')).toEqual([
			'bbc.co.uk',
			'reuters.com'
		]);
	});
});
