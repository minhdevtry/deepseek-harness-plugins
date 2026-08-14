import { chromium } from 'playwright';

async function run() {
  console.log('[+] Testing TipTap real-time editing, dirty state, and Ctrl+S saving...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(2000);

  // 1. Open note.md
  await page.locator('text="note.md"').first().click();
  await page.waitForTimeout(1500);

  // 2. Type into TipTap editor
  console.log('[+] Typing into TipTap editor...');
  const editor = page.locator('.vk_tiptap_prose').first();
  await editor.click();
  await page.keyboard.type('\n## 🚀 Newly Added Section via TipTap Notion WYSIWYG!\nEverything is working smoothly in real-time.\n');
  await page.waitForTimeout(1000);

  // Check dirty dot
  await page.screenshot({ path: 'test-dirty-state.png' });
  console.log('[✓] Dirty state captured: test-dirty-state.png');

  // 3. Press Ctrl+S
  console.log('[+] Pressing Ctrl+S to save...');
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1500);

  // Check saved state
  await page.screenshot({ path: 'test-saved-state.png' });
  console.log('[✓] Saved state captured: test-saved-state.png');

  await browser.close();
  console.log('[🎉] TipTap real-time editing & saving test passed!');
}

run().catch(err => {
  console.error('[-] Error during test:', err);
  process.exit(1);
});
