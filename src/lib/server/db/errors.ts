/**
 * Recognises a unique-constraint violation by constraint name.
 *
 * Drizzle wraps the driver's error: the outer `message` is "Failed query: …"
 * with the SQL, and the constraint only appears on the PostgresError in
 * `cause`. Checking `error.message` alone therefore never matches, and a
 * duplicate slug surfaces as a 500 instead of a form error.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth++) {
		const candidate = current as {
			code?: string;
			constraint_name?: string;
			message?: string;
			cause?: unknown;
		};
		if (candidate.code === '23505' && candidate.constraint_name === constraint) return true;
		if (typeof candidate.message === 'string' && candidate.message.includes(constraint))
			return true;
		current = candidate.cause;
	}
	return false;
}
