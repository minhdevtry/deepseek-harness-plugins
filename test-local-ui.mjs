import { chromium } from 'playwright';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('[+] Navigating to DeepSeek Harness web dashboard (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(3000);

  // Click on the session
  const sessionLocator = page.locator('text="Hiển thị cây thư mục hiện tại"').first();
  if (await sessionLocator.count() > 0) {
    console.log('[+] Clicking on session...');
    await sessionLocator.click();
    await page.waitForTimeout(1500);
  }

  // Click the File Explorer toggle button
  const explorerToggle = page.locator('button', { hasText: 'File Explorer' }).first();
  if (await explorerToggle.count() > 0) {
    console.log('[+] Clicking File Explorer toggle button...');
    await explorerToggle.click();
    await page.waitForTimeout(2000);
  }

  // Click note.md
  console.log('[+] Looking for note.md in tree...');
  const noteNode = page.locator('.ft-name', { hasText: 'note.md' }).first();
  if (await noteNode.count() > 0) {
    console.log('[+] Clicking note.md...');
    await noteNode.click();
    await page.waitForTimeout(2000);
  }

  // Check if .dsh-editor-panel-view is visible
  const editorPanel = page.locator('.dsh-editor-panel-view');
  const count = await editorPanel.count();
  console.log('[+] Editor panel count in DOM:', count);

  await page.screenshot({ path: 'test-direct-tab-open.png' });
  console.log('[✓] Screenshot saved: test-direct-tab-open.png');

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
