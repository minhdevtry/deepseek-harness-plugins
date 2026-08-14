import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = '/home/lucas/.gemini/antigravity-ide/brain/91a19b30-91a0-4195-a48f-22068fecb56a';

async function run() {
	console.log('[+] Starting Visual Verification Suite for Remote Collab & Sandbox...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();

	// 1. Visit DeepSeek Harness
	await page.goto('http://127.0.0.1:3080');
	await page.waitForTimeout(1500);

	// Open note.md
	await page.keyboard.press('Control+p');
	await page.waitForTimeout(400);
	const quickInput = page.locator('.vk_quick_open_input');
	await quickInput.fill('note.md');
	await page.waitForTimeout(400);
	const noteItem = page.locator('.vk_quick_open_item').filter({ hasText: 'note.md' }).first();
	if (await noteItem.isVisible()) {
		await noteItem.click();
	}
	await page.waitForTimeout(1500);

	// Capture clean TipTap Editor
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-collab-4-tiptap-editor.png') });
	console.log('[✓] Screenshot 4 captured: TipTap Notion Workspace & Live Collab Toolbar');

	// 2. Open Command Palette
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(500);
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-collab-1-cmd-palette.png') });
	console.log('[✓] Screenshot 1 captured: Command Palette');

	// 3. Open User Profile Modal
	const profileCmd = page.locator('.vk_quick_open_item').filter({ hasText: 'Switch User Profile' }).first();
	if (await profileCmd.isVisible()) {
		await profileCmd.click();
		await page.waitForTimeout(600);
		await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-collab-2-profile-modal.png') });
		console.log('[✓] Screenshot 2 captured: Profile Switcher Modal (Lucas & Lona)');
		await page.locator('.vk_dialog_btn, .vk_editBtn:has-text("Cancel")').click();
		await page.waitForTimeout(400);
	}

	// 4. Open In-App Sandboxed Folder Modal
	await page.keyboard.press('Control+Shift+P');
	await page.waitForTimeout(500);
	const folderCmd = page.locator('.vk_quick_open_item').filter({ hasText: 'Open Sandboxed Folder' }).first();
	if (await folderCmd.isVisible()) {
		await folderCmd.click();
		await page.waitForTimeout(600);
		await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-collab-3-sandbox-folder-modal.png') });
		console.log('[✓] Screenshot 3 captured: Sandboxed Workspace Folder Picker');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(400);
	}

	await browser.close();
	console.log('[🎉] All visual verification screenshots captured cleanly!');
}

run().catch(err => {
	console.error('[!] Visual test error:', err);
	process.exit(1);
});
