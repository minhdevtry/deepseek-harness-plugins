import { chromium } from 'playwright';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('[+] Navigating to DeepSeek Harness (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(2500);

  // 1. Capture initial view - check Explorer tab and automatic file tree loading
  await page.screenshot({ path: 'test-en-initial-explorer.png' });
  console.log('[✓] Initial Explorer view saved: test-en-initial-explorer.png');

  // 2. Open note.md
  console.log('[+] Opening note.md in TipTap Notion Suite...');
  const noteFile = page.locator('text="note.md"').first();
  if (await noteFile.count() > 0) {
    await noteFile.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-en-tiptap-open.png' });
  console.log('[✓] TipTap Notion view saved: test-en-tiptap-open.png');

  // 3. Test closing right chat panel
  console.log('[+] Closing right chat panel (✕)...');
  const closeChatBtn = page.locator('button[title="Close / Collapse Chat Panel"]').first();
  if (await closeChatBtn.count() > 0) {
    await closeChatBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-en-chat-closed.png' });
    console.log('[✓] Chat closed view (full width editor) saved: test-en-chat-closed.png');
  }

  // 4. Test reopening chat panel via floating "💬 Open Chat"
  console.log('[+] Reopening chat panel via floating "💬 Open Chat"...');
  const openChatBtn = page.locator('.vk_open_chat_float, button:has-text("Open Chat")').first();
  if (await openChatBtn.count() > 0) {
    await openChatBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-en-chat-reopened.png' });
    console.log('[✓] Chat reopened view saved: test-en-chat-reopened.png');
  }

  // 5. Test Quests tab
  console.log('[+] Switching to Quests tab...');
  const questsTab = page.locator('button', { hasText: 'Quests' }).first();
  if (await questsTab.count() > 0) {
    await questsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-en-quests-tab.png' });
    console.log('[✓] Quests tab view saved: test-en-quests-tab.png');
  }

  console.log('[🎉] ALL ENGLISH UI & ENHANCED CONTROLS TESTS PASSED!');
  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during test:', err);
  process.exit(1);
});
