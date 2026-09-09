import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

const MINUTE = 60_000;

describe('rate limiter', () => {
	it('allows a burst up to capacity, then blocks', () => {
		const limiter = createRateLimiter({ capacity: 3, refillMs: 15 * MINUTE });
		const now = 1_000_000;

		expect(limiter.check('ip', now).allowed).toBe(true);
		expect(limiter.check('ip', now).allowed).toBe(true);
		expect(limiter.check('ip', now).allowed).toBe(true);

		const blocked = limiter.check('ip', now);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfter).toBeGreaterThan(0);
	});

	it('refills over time', () => {
		const limiter = createRateLimiter({ capacity: 3, refillMs: 15 * MINUTE });
		const now = 1_000_000;

		for (let i = 0; i < 3; i++) limiter.check('ip', now);
		expect(limiter.check('ip', now).allowed).toBe(false);

		// One third of the window returns exactly one of three tokens.
		expect(limiter.check('ip', now + 5 * MINUTE).allowed).toBe(true);
		expect(limiter.check('ip', now + 5 * MINUTE).allowed).toBe(false);
	});

	it('never refills past capacity', () => {
		const limiter = createRateLimiter({ capacity: 2, refillMs: MINUTE });
		const now = 1_000_000;

		limiter.check('ip', now);
		// A day later the bucket is full, not overflowing.
		expect(limiter.check('ip', now + 86_400_000).allowed).toBe(true);
		expect(limiter.check('ip', now + 86_400_000).allowed).toBe(true);
		expect(limiter.check('ip', now + 86_400_000).allowed).toBe(false);
	});

	it('keeps keys independent', () => {
		const limiter = createRateLimiter({ capacity: 1, refillMs: MINUTE });
		const now = 1_000_000;

		expect(limiter.check('a', now).allowed).toBe(true);
		expect(limiter.check('a', now).allowed).toBe(false);
		expect(limiter.check('b', now).allowed).toBe(true);
	});

	it('reset gives a key its budget back', () => {
		const limiter = createRateLimiter({ capacity: 1, refillMs: MINUTE });
		const now = 1_000_000;

		limiter.check('ip', now);
		expect(limiter.check('ip', now).allowed).toBe(false);

		limiter.reset('ip');
		expect(limiter.check('ip', now).allowed).toBe(true);
	});

	it('bounds how many keys it tracks', () => {
		const limiter = createRateLimiter({ capacity: 1, refillMs: MINUTE, maxKeys: 50 });
		const now = 1_000_000;

		for (let i = 0; i < 500; i++) limiter.check(`ip-${i}`, now);

		expect(limiter.size).toBeLessThanOrEqual(50);
	});
});
