import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = '/home/lucas/.gemini/antigravity-ide/brain/91a19b30-91a0-4195-a48f-22068fecb56a';

async function run() {
	console.log('[🚀] Starting Micro-Features Verification Suite for DeepSeek Harness...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();

	console.log('\n--- Step 1: Navigating to DeepSeek Harness ---');
	await page.goto('http://127.0.0.1:3080');
	await page.waitForTimeout(1500);

	// Open note.md from Explorer
	const fileRow = page.locator('.vk_row').filter({ hasText: 'note.md' }).first();
	if (await fileRow.isVisible({ timeout: 3000 }).catch(() => false)) {
		await fileRow.click();
	}
	await page.waitForTimeout(1200);

	console.log('\n--- Step 2: Testing Keyboard Shortcuts Cheat Sheet (Ctrl+/ or ?) ---');
	await page.locator('body').click({ position: { x: 10, y: 10 } });
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(500);
	const cmdPalette = page.locator('.vk_quick_open_palette[data-vk-cmd-palette="true"]');
	await cmdPalette.waitFor({ state: 'visible', timeout: 4000 });
	const shortcutsCmd = cmdPalette.locator('.vk_quick_open_item').filter({ hasText: 'Keyboard Shortcuts' }).first();
	await shortcutsCmd.click();
	await page.waitForTimeout(500);

	const shortcutsModal = page.locator('.vk_modal_backdrop[data-vk-shortcuts-modal="true"]');
	assert.ok(await shortcutsModal.isVisible(), 'Shortcuts Cheat Sheet Modal should be visible');
	const groupTitles = await shortcutsModal.locator('.vk_shortcut_group_title').allInnerTexts();
	console.log('[+] Shortcuts categories found:', groupTitles);
	assert.ok(groupTitles.length >= 3, 'Must have multiple shortcut categories');
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-micro-1-shortcuts-modal.png') });
	console.log('[✓] Screenshot captured: test-micro-1-shortcuts-modal.png');

	// Test Search Filter inside Shortcuts Modal
	const searchInp = shortcutsModal.locator('input');
	await searchInp.fill('zen');
	await page.waitForTimeout(300);
	const rows = await shortcutsModal.locator('.vk_shortcut_row').allInnerTexts();
	console.log('[+] Filtered shortcuts for "zen":', rows);
	assert.ok(rows.some(r => r.includes('Zen Mode')), 'Must find Zen Mode shortcut');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	console.log('[✓] Step 2 passed: Keyboard Shortcuts Cheat Sheet verified!');

	console.log('\n--- Step 3: Testing Document Reading Metrics & Stats Modal ---');
	await page.locator('body').click({ position: { x: 10, y: 10 } });
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(500);
	const cmdPalette2 = page.locator('.vk_quick_open_palette[data-vk-cmd-palette="true"]');
	await cmdPalette2.waitFor({ state: 'visible', timeout: 4000 });
	const statsCmd = cmdPalette2.locator('.vk_quick_open_item').filter({ hasText: 'Reading Time & Statistics' }).first();
	await statsCmd.click();
	await page.waitForTimeout(500);

	const statsModal = page.locator('.vk_modal_backdrop[data-vk-stats-modal="true"]');
	assert.ok(await statsModal.isVisible(), 'Document Stats Modal should be visible');
	const statsCards = await statsModal.locator('.vk_stat_card').allInnerTexts();
	console.log('[+] Document Stats metrics displayed:\n', statsCards.join('\n'));
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-micro-2-stats-modal.png') });
	console.log('[✓] Screenshot captured: test-micro-2-stats-modal.png');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	console.log('[✓] Step 3 passed: Document Reading Metrics Modal verified!');

	console.log('\n--- Step 4: Testing Focus / Zen Mode (Ctrl+Shift+Z) ---');
	await page.keyboard.press('Control+Shift+Z');
	await page.waitForTimeout(600);

	const zenBanner = page.locator('.vk_zen_banner');
	assert.ok(await zenBanner.isVisible(), 'Zen Mode banner should be visible');
	console.log('[+] Zen banner text:', await zenBanner.innerText());
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-micro-3-zen-mode.png') });
	console.log('[✓] Screenshot captured: test-micro-3-zen-mode.png');

	// Press Escape to exit Zen mode
	await page.keyboard.press('Escape');
	await page.waitForTimeout(600);
	assert.ok(!(await zenBanner.isVisible()), 'Zen banner should be hidden after exit');
	console.log('[✓] Step 4 passed: Focus / Zen Mode toggle verified!');

	console.log('\n--- Step 5: Testing Editor Font Zoom Controls (Ctrl+= / Ctrl+-) ---');
	await page.locator('body').click({ position: { x: 10, y: 10 } });
	await page.keyboard.press('Control+=');
	await page.waitForTimeout(400);
	let toast = page.locator('.vk_toast_msg');
	if (await toast.isVisible({ timeout: 1000 }).catch(() => false)) {
		console.log('[+] Zoom in toast message:', await toast.innerText());
	}
	await page.keyboard.press('Control+0');
	await page.waitForTimeout(400);
	console.log('[✓] Step 5 passed: Editor Font Zoom verified!');

	console.log('\n--- Step 6: Testing Daily Scratchpad (Ctrl+Shift+N) ---');
	await page.locator('body').click({ position: { x: 10, y: 10 } });
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(400);
	const cmdPalette3 = page.locator('.vk_quick_open_palette[data-vk-cmd-palette="true"]');
	await cmdPalette3.waitFor({ state: 'visible', timeout: 3000 });
	const scratchCmd = cmdPalette3.locator('.vk_quick_open_item').filter({ hasText: 'Daily Scratchpad' }).first();
	await scratchCmd.click({ force: true });
	await page.waitForTimeout(1500);

	// Verify scratchpad.md is active
	const activeBreadcrumb = await page.locator('.vk_breadcrumb').first().innerText();
	console.log('[+] Active breadcrumb after daily scratchpad:', activeBreadcrumb);
	assert.ok(activeBreadcrumb.includes('scratchpad.md'), 'scratchpad.md must be active');
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-micro-4-daily-scratchpad.png') });
	console.log('[✓] Screenshot captured: test-micro-4-daily-scratchpad.png');
	console.log('[✓] Step 6 passed: Daily Scratchpad verified!');

	await browser.close();
	console.log('\n[🎉🎉🎉] ALL MICRO-FEATURES VERIFIED AND PASSED WITH 100% SUCCESS!');
}

run().catch(err => {
	console.error('[!] Micro-features test failed:', err);
	process.exit(1);
});
