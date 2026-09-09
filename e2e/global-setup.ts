import { execFileSync } from 'node:child_process';

/**
 * Brings the database the preview server will read into a known state.
 *
 * Runs the same two commands a developer runs, as child processes, so the e2e
 * suite cannot drift from the real migrate/seed path. Needed in CI because the
 * integration tests truncate the database before this point.
 */
export default function globalSetup() {
	const env = { ...process.env };
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const run = (cmd: string, args: string[]) =>
		execFileSync(cmd, args, { stdio: 'inherit', env, cwd: process.cwd() });

	run('bunx', ['drizzle-kit', 'migrate']);
	run('bun', ['run', 'src/lib/server/db/seed.ts']);
}
