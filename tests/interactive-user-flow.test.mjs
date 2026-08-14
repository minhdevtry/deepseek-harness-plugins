import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = '/home/lucas/.gemini/antigravity-ide/brain/91a19b30-91a0-4195-a48f-22068fecb56a';

async function run() {
	console.log('[🚀] Starting Comprehensive User Behaviors & Markdown Ergonomics Verification Suite...');
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

	console.log('\n--- Step 2: Verifying Clean Markdown & Notion Styling (No Ugly Dark Frames) ---');
	const editorProse = page.locator('.tiptap.ProseMirror');
	await editorProse.waitFor({ state: 'visible', timeout: 5000 });
	const text = await editorProse.innerText();
	console.log('[+] Active Editor Text Snippet:', text.slice(0, 150));

	// Check that pre code block background is NOT pitch black (#0f172a / black) but clean #f8fafc / light
	const preEl = editorProse.locator('pre').first();
	if (await preEl.isVisible()) {
		const bg = await preEl.evaluate(el => window.getComputedStyle(el).backgroundColor);
		const border = await preEl.evaluate(el => window.getComputedStyle(el).borderColor);
		console.log('[+] Pre block background color:', bg);
		console.log('[+] Pre block border color:', border);
		assert.ok(bg !== 'rgb(15, 23, 42)' && bg !== 'rgb(0, 0, 0)', 'Code block background should be a clean Notion style, not pitch black');
	}
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ux-1-clean-markdown.png') });
	console.log('[✓] Screenshot captured: test-ux-1-clean-markdown.png');

	console.log('\n--- Step 3: Testing Formatting Toolbar Buttons ---');
	const boldBtn = page.locator('.vk_tb_tool.vk_bold');
	const italicBtn = page.locator('.vk_tb_tool.vk_italic');
	const h1Btn = page.locator('.vk_tb_tool[title*="Heading 1"]');
	const calloutBtn = page.locator('.vk_tb_tool[title*="Callout"]');
	const tableBtn = page.locator('.vk_tb_tool[title*="Table"]');

	assert.ok(await boldBtn.isVisible(), 'Bold button should be visible in toolbar');
	assert.ok(await italicBtn.isVisible(), 'Italic button should be visible in toolbar');
	assert.ok(await h1Btn.isVisible(), 'H1 button should be visible in toolbar');
	assert.ok(await calloutBtn.isVisible(), 'Callout button should be visible in toolbar');
	assert.ok(await tableBtn.isVisible(), 'Table button should be visible in toolbar');

	// Insert Heading 1
	await editorProse.click();
	await h1Btn.click();
	await page.keyboard.type('DeepSeek Harness Suite');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(400);

	// Insert Callout Box
	await calloutBtn.click();
	await page.waitForTimeout(500);
	const calloutBox = page.locator('.tiptap.ProseMirror blockquote').first();
	assert.ok(await calloutBox.isVisible(), 'Callout blockquote should be inserted into editor');
	console.log('[✓] Callout blockquote inserted and styled!');

	console.log('\n--- Step 4: Testing Table Tools & Contextual Toolbar ---');
	const table = page.locator('.tiptap table').first();
	if (await table.isVisible()) {
		const cell = table.locator('td').first();
		await cell.click();
		await page.waitForTimeout(400);

		// Contextual table bar should appear
		const tblToolbar = page.locator('.vk_table_toolbar');
		assert.ok(await tblToolbar.isVisible(), 'Table contextual toolbar should appear when table is active');
		const tblBtns = await tblToolbar.locator('.vk_tb_table_btn').allInnerTexts();
		console.log('[+] Table contextual actions:', tblBtns);
		assert.ok(tblBtns.some(b => b.includes('Row Below')), 'Must have Add Row Below');
		assert.ok(tblBtns.some(b => b.includes('Col Right')), 'Must have Add Col Right');
	}
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ux-2-table-callout.png') });
	console.log('[✓] Screenshot captured: test-ux-2-table-callout.png');

	console.log('\n--- Step 5: Testing Document Outline TOC (📑 Outline) ---');
	const outlineBtn = page.locator('.vk_editBtn[title*="Outline"]');
	await outlineBtn.click();
	await page.waitForTimeout(400);

	const tocCard = page.locator('.vk_toc_card[data-vk-toc="true"]');
	assert.ok(await tocCard.isVisible(), 'Document Outline dialog should be visible');
	const headings = await tocCard.locator('.vk_toc_item').allInnerTexts();
	console.log('[+] Document headings in TOC:', headings);
	assert.ok(headings.length > 0, 'Should list document headings');

	// Click first heading item
	await tocCard.locator('.vk_toc_item').first().click();
	await page.waitForTimeout(400);
	assert.ok(!(await tocCard.isVisible()), 'TOC dialog should close after selecting heading');
	console.log('[✓] Step 5 passed: Document Outline navigation verified!');

	console.log('\n--- Step 6: Testing Export Dropdown Menu & 1-Click Actions ---');
	const exportBtn = page.locator('.vk_editBtn[title*="Export Document"]');
	await exportBtn.click();
	await page.waitForTimeout(300);

	const exportDropdown = page.locator('.vk_ai_dropdown');
	assert.ok(await exportDropdown.isVisible(), 'Export dropdown should open');
	const exportItems = await exportDropdown.locator('.vk_ai_dropdown_item').allInnerTexts();
	console.log('[+] Export actions available:', exportItems);
	assert.ok(exportItems.some(i => i.includes('Download .md')), 'Must have Download .md');
	assert.ok(exportItems.some(i => i.includes('Copy Markdown')), 'Must have Copy Markdown');
	assert.ok(exportItems.some(i => i.includes('Copy HTML')), 'Must have Copy HTML');
	assert.ok(exportItems.some(i => i.includes('Print')), 'Must have Print / PDF Preview');

	// Click Copy Markdown
	const copyMdBtn = exportDropdown.locator('.vk_ai_dropdown_item').filter({ hasText: 'Copy Markdown' }).first();
	await copyMdBtn.click();
	await page.waitForTimeout(400);
	console.log('[✓] Step 6 passed: Export Dropdown actions verified!');

	console.log('\n--- Step 7: Testing Document Reading Metrics Dialog ---');
	const statPill = page.locator('.vk_stat_pill').first();
	await statPill.click();
	await page.waitForTimeout(400);

	const statsModal = page.locator('.vk_modal_backdrop[data-vk-stats-modal="true"]');
	assert.ok(await statsModal.isVisible(), 'Document Stats Modal should open on pill click');
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ux-3-stats-modal.png') });
	console.log('[✓] Screenshot captured: test-ux-3-stats-modal.png');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	console.log('[✓] Step 7 passed: Document Reading Metrics Modal verified!');

	console.log('\n--- Step 8: Testing Inline AI Assist (Ctrl+K) ---');
	const inlineAiBtn = page.locator('.vk_ai_assist_btn[title*="Inline AI"]');
	await inlineAiBtn.click();
	await page.waitForTimeout(400);

	const inlineAiCard = page.locator('.vk_inline_ai_card');
	assert.ok(await inlineAiCard.isVisible(), 'Inline AI Assist dialog should appear');
	const chips = await inlineAiCard.locator('.vk_inline_ai_chip').allInnerTexts();
	console.log('[+] Inline AI Quick Action Chips:', chips);
	assert.ok(chips.length >= 3, 'Must have AI quick action chips');
	await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test-ux-4-inline-ai.png') });
	console.log('[✓] Screenshot captured: test-ux-4-inline-ai.png');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	console.log('[✓] Step 8 passed: Inline AI Assist verified!');

	await browser.close();
	console.log('\n[🎉🎉🎉] ALL USER BEHAVIORS & ERGONOMICS VERIFIED WITH 100% SUCCESS!');
}

run().catch(err => {
	console.error('[!] Interactive user flow test failed:', err);
	process.exit(1);
});
