import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import { MOCK_ORIGIN } from './e2e/mock-ai';

// Playwright does not read .env; globalSetup and the preview server both need it.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global-setup.ts',
	testMatch: '**/*.e2e.ts',
	// One worker: the login rate limiter is per-process state in the server under
	// test, so parallel specs would consume each other's attempt budget.
	workers: 1,
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		env: {
			...(process.env as Record<string, string>),
			// The one private origin the AI writer may read: the mock's fixture pages.
			AI_UNSAFE_TEST_SOURCE_ORIGIN: MOCK_ORIGIN,
			// CI has no .env; keys stored during the suite need some secret.
			AI_KEY_SECRET:
				process.env.AI_KEY_SECRET ?? 'e2e-only-secret-that-is-longer-than-thirty-two-characters'
		}
	},
	use: { baseURL: 'http://localhost:4173' }
});
