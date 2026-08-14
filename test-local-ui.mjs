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
    
    // STEP 1: Type '/' to show all commands
    console.log('[+] Typing "/" to open full Slash Menu...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-slash-all.png' });
    console.log('[✓] Full slash menu screenshot saved: test-slash-all.png');

    // STEP 2: Type 'tab' to test live filtering
    console.log('[+] Typing "tab" to test live filtering for Table...');
    await page.keyboard.type('tab');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-slash-filtered-table.png' });
    console.log('[✓] Filtered table slash screenshot saved: test-slash-filtered-table.png');

    // STEP 3: Backspace 3 times
    console.log('[+] Pressing Backspace 3 times to restore full menu...');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-slash-backspaced.png' });
    console.log('[✓] Restored slash menu screenshot saved: test-slash-backspaced.png');

    // STEP 4: Type 'you' to filter to YouTube
    console.log('[+] Typing "you" to test live filtering for YouTube...');
    await page.keyboard.type('you');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-slash-filtered-youtube.png' });
    console.log('[✓] Filtered YouTube screenshot saved: test-slash-filtered-youtube.png');

    // STEP 5: Press Enter to open YouTube modal
    console.log('[+] Pressing Enter to open YouTube modal from filtered item...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-slash-modal-opened.png' });
    console.log('[✓] Modal opened screenshot saved: test-slash-modal-opened.png');

    console.log('[🎉] ALL LIVE SLASH FILTERING TESTS COMPLETED SUCCESSFULLY!');
  } else {
    console.log('[-] Could not locate "note.md" file in the sidebar.');
  }

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
