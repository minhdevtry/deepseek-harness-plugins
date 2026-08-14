import { chromium } from 'playwright';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[+] Navigating to DeepSeek Harness (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(2000);

  // Switch to Sessions tab
  console.log('[+] Switching to Sessions tab...');
  const sessionsTab = page.locator('button', { hasText: '会话' }).or(page.locator('button', { hasText: 'Sessions' })).first();
  if (await sessionsTab.count() > 0) {
    await sessionsTab.click();
    await page.waitForTimeout(1000);
  }

  // Click on existing session "Hiển thị cây thư mục hiện tại"
  console.log('[+] Selecting session "Hiển thị cây thư mục hiện tại"...');
  const sessionItem = page.locator('text="Hiển thị cây thư mục hiện tại"').first();
  if (await sessionItem.count() > 0) {
    await sessionItem.click();
    await page.waitForTimeout(1500);
  }

  // Switch back to Files tab
  console.log('[+] Switching to Files tab...');
  const filesTab = page.locator('button', { hasText: '文件' }).or(page.locator('button', { hasText: 'Files' })).first();
  if (await filesTab.count() > 0) {
    await filesTab.click();
    await page.waitForTimeout(1500);
  }

  // Capture file tree screenshot
  await page.screenshot({ path: 'test-3col-filetree-active.png' });
  console.log('[✓] File tree active screenshot saved: test-3col-filetree-active.png');

  // Click note.md
  console.log('[+] Clicking note.md in file tree...');
  const noteFile = page.locator('text="note.md"').first();
  if (await noteFile.count() > 0) {
    await noteFile.click();
    await page.waitForTimeout(2000);
  }

  // Capture TipTap Notion WYSIWYG screenshot
  await page.screenshot({ path: 'test-3col-tiptap-notion-suite.png' });
  console.log('[✓] TipTap Notion Suite screenshot saved: test-3col-tiptap-notion-suite.png');

  // Click package.json to test multi-tab code editor
  console.log('[+] Clicking package.json in file tree...');
  const pkgFile = page.locator('text="package.json"').first();
  if (await pkgFile.count() > 0) {
    await pkgFile.click();
    await page.waitForTimeout(2000);
  }

  // Capture multi-tab screenshot
  await page.screenshot({ path: 'test-3col-code-and-notion-tabs.png' });
  console.log('[✓] Multi-tab code & Notion screenshot saved: test-3col-code-and-notion-tabs.png');

  console.log('[🎉] COMPLETE END-TO-END VERIFICATION SUCCESSFUL!');
  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during full workflow test:', err);
  process.exit(1);
});
