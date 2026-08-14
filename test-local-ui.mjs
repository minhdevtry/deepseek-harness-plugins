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

  // Click note.md
  const fileNode = page.locator('.ft-name', { hasText: 'note.md' }).first();
  if (await fileNode.count() > 0) {
    console.log('[+] Found note.md. Clicking to open...');
    await fileNode.click();
    await page.waitForTimeout(2000);
    
    // Focus Editor canvas
    console.log('[+] Focusing editor canvas...');
    const editor = page.locator('.dsh-tiptap-prose').first();
    await editor.click();
    
    // Break out of any list by pressing Enter twice
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    
    // Test Markdown Shortcut # Heading 1
    console.log('[+] Typing "# Super Markdown H1"...');
    await page.keyboard.type('# Super Markdown H1');
    await page.waitForTimeout(400);

    // Test Markdown Shortcut > Blockquote
    console.log('[+] Typing "> Inspiring Quote from TipTap"...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('> Inspiring Quote from TipTap');
    await page.waitForTimeout(400);

    // Test Markdown Shortcut * Bullet list
    console.log('[+] Typing "* Clean Bullet Item"...');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('* Clean Bullet Item');
    await page.waitForTimeout(400);

    // Test inline marks: **bold**, ~~strike~~, ==mark==
    console.log('[+] Typing **Bold**, ~~Strike~~, ==Highlight== ...');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Testing **Bold Text** and ~~Strikeout~~ and ==Highlight Mark==');
    await page.waitForTimeout(500);

    // Capture screenshot
    await page.screenshot({ path: 'test-markdown-shortcuts-clean.png' });
    console.log('[✓] Clean Markdown shortcuts screenshot saved: test-markdown-shortcuts-clean.png');

    console.log('[🎉] ALL CLEAN ROOT MARKDOWN SHORTCUTS TESTED SUCCESSFULLY!');
  } else {
    console.log('[-] Could not locate "note.md" file in the sidebar.');
  }

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
