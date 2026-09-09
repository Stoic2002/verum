/**
 * In-memory token-bucket rate limiter (PRD §15: login and search).
 *
 * In-memory is the right size for this deployment: one Node process on one VPS
 * (PRD §10.1). It costs no database round-trip on the hot path and no Redis to
 * operate. The trade-off is explicit — buckets reset on restart, and a second
 * app instance would double every limit. If VERUM ever runs more than one
 * process, this moves to Postgres or Redis; nothing else has to change.
 */

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitResult = {
	allowed: boolean;
	/** Seconds until the next token is available. 0 when allowed. */
	retryAfter: number;
	remaining: number;
};

export type RateLimiterOptions = {
	/** Burst size: how many requests are allowed back-to-back. */
	capacity: number;
	/** How long a fully drained bucket takes to refill, in milliseconds. */
	refillMs: number;
	/** Bound on tracked keys, so a flood of unique IPs cannot exhaust memory. */
	maxKeys?: number;
};

export function createRateLimiter({ capacity, refillMs, maxKeys = 10_000 }: RateLimiterOptions) {
	const buckets = new Map<string, Bucket>();
	const ratePerMs = capacity / refillMs;

	function sweep(now: number) {
		// A bucket that has had time to refill completely carries no information.
		for (const [key, bucket] of buckets) {
			if (now - bucket.updatedAt > refillMs) buckets.delete(key);
			if (buckets.size <= maxKeys) break;
		}
		// Still over budget after sweeping: drop oldest-first.
		if (buckets.size > maxKeys) {
			const excess = buckets.size - maxKeys;
			let dropped = 0;
			for (const key of buckets.keys()) {
				buckets.delete(key);
				if (++dropped >= excess) break;
			}
		}
	}

	return {
		/** Consumes one token. Call once per attempt. */
		check(key: string, now = Date.now()): RateLimitResult {
			const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };

			const refilled = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * ratePerMs);

			if (refilled < 1) {
				buckets.set(key, { tokens: refilled, updatedAt: now });
				return {
					allowed: false,
					retryAfter: Math.ceil((1 - refilled) / ratePerMs / 1000),
					remaining: 0
				};
			}

			const tokens = refilled - 1;
			buckets.set(key, { tokens, updatedAt: now });
			if (buckets.size > maxKeys) sweep(now);

			return { allowed: true, retryAfter: 0, remaining: Math.floor(tokens) };
		},

		/** Give a key its budget back — called after a login actually succeeds. */
		reset(key: string) {
			buckets.delete(key);
		},

		get size() {
			return buckets.size;
		}
	};
}

const MINUTE = 60 * 1000;

/**
 * Two limiters on the login endpoint, because they stop different attacks.
 *
 * Per-IP stops one host working through many passwords. Per-email stops a
 * distributed attempt on a single account, which per-IP alone would never see.
 */
export const loginByIp = createRateLimiter({ capacity: 10, refillMs: 15 * MINUTE });
export const loginByEmail = createRateLimiter({ capacity: 5, refillMs: 15 * MINUTE });

/** Search is public and cheap to abuse; the limit is loose enough to be invisible. */
export const searchByIp = createRateLimiter({ capacity: 30, refillMs: MINUTE });
