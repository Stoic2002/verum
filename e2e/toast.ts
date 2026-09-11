import type { Page } from '@playwright/test';

/**
 * The toast carrying `text`. Several can be on screen at once — a flash from
 * the redirect that led here, then the save — so match on content, not position.
 */
export function toast(page: Page, text: string | RegExp) {
	return page.locator('.toast').filter({ hasText: text });
}
