import { chromium } from 'playwright';
import path from 'path';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('[+] Navigating to DeepSeek Harness web dashboard (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  
  // Wait for the app to settle
  await page.waitForTimeout(3000);

  // Click on the existing session "Hiển thị cây thư mục hiện tại" to make sure the workspace is active
  const sessionLocator = page.locator('text="Hiển thị cây thư mục hiện tại"').first();
  if (await sessionLocator.count() > 0) {
    console.log('[+] Clicking on session "Hiển thị cây thư mục hiện tại"...');
    await sessionLocator.click();
    await page.waitForTimeout(1500);
  }

  // Click the "File Explorer" tab at the bottom left to ensure the file tree is open
  const explorerTab = page.locator('text="File Explorer"').first();
  if (await explorerTab.count() > 0) {
    console.log('[+] Opening File Explorer tab...');
    await explorerTab.click();
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: 'test-after-explorer-opened.png' });
  console.log('[✓] File Explorer state screenshot captured: test-after-explorer-opened.png');

  // Check if file note.md exists in the explorer tree and click it
  const fileNode = page.locator('.ft-name', { hasText: 'note.md' }).first();
  if (await fileNode.count() > 0) {
    console.log('[+] Found note.md. Clicking to open...');
    await fileNode.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-editor-opened.png' });
    console.log('[✓] Editor opened screenshot captured: test-editor-opened.png');
    
    // Focus Editor and trigger slash command
    console.log('[+] Focusing editor canvas...');
    const editor = page.locator('.dsh-tiptap-prose').first();
    await editor.click();
    
    // Send Enter and type "/"
    console.log('[+] Typing slash command "/"...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-slash-menu.png' });
    console.log('[✓] Slash command menu screenshot captured: test-slash-menu.png');
    
    // Filter with "you" query
    console.log('[+] Filtering slash commands list with "you"...');
    await page.keyboard.type('you');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-slash-filtered.png' });
    console.log('[✓] Filtered list screenshot captured: test-slash-filtered.png');
    
    // Open embed YouTube modal
    console.log('[+] Pressing Enter to select YouTube video embed...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-youtube-modal.png' });
    console.log('[✓] YouTube modal screenshot captured: test-youtube-modal.png');
  } else {
    console.log('[-] Could not locate "note.md" file in the sidebar. Check the test-after-explorer-opened.png screenshot.');
  }

  await browser.close();
  console.log('[+] Local UI verification completed successfully!');
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
