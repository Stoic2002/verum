import { execFileSync } from 'node:child_process';
import { startMockAi } from './mock-ai';

/**
 * Brings the database the preview server will read into a known state.
 *
 * Runs the same two commands a developer runs, as child processes, so the e2e
 * suite cannot drift from the real migrate/seed path. Needed in CI because the
 * integration tests truncate the database before this point.
 */
export default async function globalSetup() {
	const env = { ...process.env };
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const run = (cmd: string, args: string[]) =>
		execFileSync(cmd, args, { stdio: 'inherit', env, cwd: process.cwd() });

	run('bunx', ['drizzle-kit', 'migrate']);
	run('bun', ['run', 'src/lib/server/db/seed.ts']);

	// The AI writer's model API and source pages (e2e/mock-ai.ts). Returned
	// function is Playwright's global teardown.
	const mock = await startMockAi();
	return async () => {
		await new Promise<void>((resolve) => mock.close(() => resolve()));
	};
}
