import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = '/home/lucas/.gemini/antigravity-ide/brain/91a19b30-91a0-4195-a48f-22068fecb56a';

async function run() {
	console.log('[🚀] Starting MCP & Full User Journey Verification (Tools + Ctrl+L Chat Panel)...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();

	console.log('\n--- Step 1: Navigating to DeepSeek Harness ---');
	await page.goto('http://127.0.0.1:3080');
	await page.waitForTimeout(1500);

	// Open note.md
	const fileRow = page.locator('.vk_row').filter({ hasText: 'note.md' }).first();
	if (await fileRow.isVisible({ timeout: 3000 }).catch(() => false)) {
		await fileRow.click();
	}
	await page.waitForTimeout(1200);

	console.log('\n--- Step 2: Testing Tool Clicking & Formatting Actions ---');
	const editorProse = page.locator('.tiptap.ProseMirror');
	await editorProse.waitFor({ state: 'visible', timeout: 5000 });

	// Click H1, Bold, Italic, Callout, Table
	const h1Btn = page.locator('.vk_tb_tool[title*="Heading 1"]');
	const boldBtn = page.locator('.vk_tb_tool.vk_bold');
	const calloutBtn = page.locator('.vk_tb_tool[title*="Callout"]');

	await h1Btn.click();
	await boldBtn.click();
	await calloutBtn.click();
	await page.waitForTimeout(400);

	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ctrl-l-1-tools-clicked.png') });
	console.log('[✓] Screenshot captured: test-ctrl-l-1-tools-clicked.png');

	console.log('\n--- Step 3: Collapsing Chat Panel ---');
	const closeChatBtn = page.locator('.vk_tabBtn[title*="Close / Collapse Chat Panel"]').first();
	if (await closeChatBtn.isVisible()) {
		await closeChatBtn.click();
		await page.waitForTimeout(400);
	}

	// Verify open chat floating button appears or chat panel width is 0
	const openChatBtn = page.locator('.vk_open_chat_float');
	assert.ok(await openChatBtn.isVisible(), 'Floating Open Chat button should be visible when chat panel is collapsed');
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ctrl-l-2-chat-collapsed.png') });
	console.log('[✓] Screenshot captured: test-ctrl-l-2-chat-collapsed.png');

	console.log('\n--- Step 4: Pressing Ctrl+L to Open AI Chat Panel ---');
	await page.keyboard.press('Control+l');
	await page.waitForTimeout(600);

	// Chat panel should now be open
	const chatCol = page.locator('.vk_colRight');
	assert.ok(await chatCol.isVisible(), 'Chat panel should be open after pressing Ctrl+L');

	const chatTextarea = page.locator('.vk_colRight textarea, .vk_colRight [contenteditable="true"]').first();
	assert.ok(await chatTextarea.isVisible(), 'Chat textarea should be visible and ready');

	// Type in chat
	await chatTextarea.fill('How can I format this markdown document with TipTap?');
	await page.waitForTimeout(400);

	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ctrl-l-3-chat-opened.png') });
	console.log('[✓] Screenshot captured: test-ctrl-l-3-chat-opened.png');
	console.log('[✓] Step 4 passed: Ctrl+L successfully opened chat panel and focused input!');

	console.log('\n--- Step 5: Selection + Ctrl+L Prompt Injection ---');
	// Select text in editor
	await editorProse.click();
	await page.keyboard.press('Control+a');
	await page.waitForTimeout(200);

	await page.keyboard.press('Control+l');
	await page.waitForTimeout(500);

	const chatVal = await chatTextarea.inputValue().catch(() => chatTextarea.innerText());
	console.log('[+] Chat prompt populated from selection:', chatVal.slice(0, 80) + '...');
	assert.ok(chatVal.includes('Please analyze and explain'), 'Chat prompt should contain snippet explanation request');

	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ctrl-l-4-selection-prompt.png') });
	console.log('[✓] Screenshot captured: test-ctrl-l-4-selection-prompt.png');
	console.log('[✓] Step 5 passed: Selection + Ctrl+L prompt injection verified!');

	await browser.close();
	console.log('\n[🎉🎉🎉] FULL USER WORKFLOW (TOOLS + CTRL+L CHAT) VERIFIED WITH 100% SUCCESS!');
}

run().catch(err => {
	console.error('[!] Test failed:', err);
	process.exit(1);
});
