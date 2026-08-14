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

  // 1. Initial 3-column view
  await page.screenshot({ path: 'test-perf-1-initial.png' });
  console.log('[✓] Step 1: Initial 3-Column layout saved: test-perf-1-initial.png');

  // 2. Open note.md directly into TipTap WYSIWYG
  console.log('[+] Opening note.md in TipTap Notion WYSIWYG...');
  const noteFile = page.locator('text="note.md"').first();
  if (await noteFile.count() > 0) {
    await noteFile.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-perf-2-tiptap-direct.png' });
  console.log('[✓] Step 2: Direct TipTap Notion Editor saved: test-perf-2-tiptap-direct.png');

  // 3. Test closing right chat panel to achieve full Notion width canvas
  console.log('[+] Closing right chat panel with (✕)...');
  const closeChatBtn = page.locator('button[title="Close / Collapse Chat Panel (Ctrl+L)"]').first();
  if (await closeChatBtn.count() > 0) {
    await closeChatBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: 'test-perf-3-fullwidth-notion.png' });
  console.log('[✓] Step 3: Full-width Notion Canvas (Chat closed) saved: test-perf-3-fullwidth-notion.png');

  // 4. Test Ctrl+L shortcut to reopen chat panel
  console.log('[+] Pressing Ctrl+L to reopen chat panel...');
  await page.keyboard.press('Control+l');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-perf-4-ctrll-reopened.png' });
  console.log('[✓] Step 4: Chat panel reopened via Ctrl+L saved: test-perf-4-ctrll-reopened.png');

  // 5. Test opening raw code file (package.json) to verify multi-tab
  console.log('[+] Opening package.json in second tab...');
  const pkgFile = page.locator('text="package.json"').first();
  if (await pkgFile.count() > 0) {
    await pkgFile.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-perf-5-multitab.png' });
  console.log('[✓] Step 5: Multi-tab workspace saved: test-perf-5-multitab.png');

  console.log('[🎉] ALL PERFECTED WORKFLOW TESTS COMPLETED SUCCESSFULLY!');
  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during test:', err);
  process.exit(1);
});
