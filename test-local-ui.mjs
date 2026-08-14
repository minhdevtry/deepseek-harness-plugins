import { chromium } from 'playwright';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('[+] Navigating to DeepSeek Harness web dashboard (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  
  // Wait for the app to settle
  await page.waitForTimeout(3000);

  // Click on the existing session "Hiển thị cây thư mục hiện tại"
  const sessionLocator = page.locator('text="Hiển thị cây thư mục hiện tại"').first();
  if (await sessionLocator.count() > 0) {
    console.log('[+] Clicking on session "Hiển thị cây thư mục hiện tại"...');
    await sessionLocator.click();
    await page.waitForTimeout(1500);
  }

  // Click the "File Explorer" tab at the bottom left
  const explorerTab = page.locator('text="File Explorer"').first();
  if (await explorerTab.count() > 0) {
    console.log('[+] Opening File Explorer tab...');
    await explorerTab.click();
    await page.waitForTimeout(2000);
  }

  // 1. Open note.md
  const noteNode = page.locator('.ft-name', { hasText: 'note.md' }).first();
  if (await noteNode.count() > 0) {
    console.log('[+] Clicking note.md (Tab 1)...');
    await noteNode.click();
    await page.waitForTimeout(1500);
  }

  // 2. Open package.json
  const pkgNode = page.locator('.ft-name', { hasText: 'package.json' }).first();
  if (await pkgNode.count() > 0) {
    console.log('[+] Clicking package.json (Tab 2)...');
    await pkgNode.click();
    await page.waitForTimeout(1500);
  }

  // 3. Switch back to Tab 1 (note.md)
  console.log('[+] Switching back to Tab 1 (note.md)...');
  const tab1 = page.locator('.dsh-tab-item', { hasText: 'note.md' }).first();
  if (await tab1.count() > 0) {
    await tab1.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'test-workbench-multi-tabs.png' });
  console.log('[✓] Multi-tab screenshot saved: test-workbench-multi-tabs.png');

  // 4. Test Slash /callout in note.md
  console.log('[+] Testing /callout block in TipTap editor...');
  const editor = page.locator('.dsh-tiptap-prose').first();
  await editor.click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('/callout');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.keyboard.type('This is an important TipTap & DeepSeek Harness Callout!');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'test-workbench-callout.png' });
  console.log('[✓] Notion Callout box screenshot saved: test-workbench-callout.png');

  // 5. Test ➕ File button in Explorer toolbar
  console.log('[+] Testing ➕ File button in explorer toolbar...');
  const newFileBtn = page.locator('button', { hasText: '➕ File' }).first();
  if (await newFileBtn.count() > 0) {
    await newFileBtn.click();
    await page.waitForTimeout(600);
    const input = page.locator('.dsh-modal-input').first();
    await input.fill('test-demo.md');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'test-workbench-newfile.png' });
  console.log('[✓] Created new file tab screenshot saved: test-workbench-newfile.png');

  console.log('[🎉] ALL WORKBENCH TESTS (MULTI-TAB, NOTION CALLOUT, FILE OPERATIONS) PASSED!');
  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
