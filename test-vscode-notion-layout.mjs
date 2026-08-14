import { chromium } from 'playwright';

async function run() {
  console.log('[+] Launching local headless chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('[+] Navigating to DeepSeek Harness (http://127.0.0.1:3080)...');
  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(3000);

  // Capture screenshot of the 3-column VS Code Layout
  await page.screenshot({ path: 'test-vscode-3col-live.png' });
  console.log('[✓] Screenshot saved: test-vscode-3col-live.png');

  // Let us inspect the DOM elements to see what is on screen
  const domInfo = await page.evaluate(() => {
    return {
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
      classes: Array.from(document.querySelectorAll('[class*="vk_"]')).map(el => el.className),
      hasFileTree: !!document.querySelector('.vk_fileTree, .vk_leftPanel, .vk_editor')
    };
  });
  console.log('[+] Layout Inspection:', domInfo);

  // If there are files in tree, let us click note.md
  const noteEntry = page.locator('text="note.md"').first();
  if (await noteEntry.count() > 0) {
    console.log('[+] Clicking note.md in the file tree...');
    await noteEntry.click();
    await page.waitForTimeout(2500);

    await page.screenshot({ path: 'test-vscode-tiptap-notion-open.png' });
    console.log('[✓] TipTap Notion WYSIWYG screenshot saved: test-vscode-tiptap-notion-open.png');
  }

  // Switch to Sessions tab in left sidebar
  const sessionsTab = page.locator('button', { hasText: '会话' }).or(page.locator('button', { hasText: 'Sessions' })).first();
  if (await sessionsTab.count() > 0) {
    console.log('[+] Switching to Sessions tab...');
    await sessionsTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-vscode-sessions-tab.png' });
    console.log('[✓] Sessions Tab screenshot saved: test-vscode-sessions-tab.png');
  }

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
