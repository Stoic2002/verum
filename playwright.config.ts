import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

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
		reuseExistingServer: !process.env.CI
	},
	use: { baseURL: 'http://localhost:4173' }
});
