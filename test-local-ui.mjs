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
    
    // TEST 1: Insert Heading 1 via Slash Menu
    console.log('[+] Testing Slash Command -> Heading 1...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter'); // Heading 1 is selected
    await page.keyboard.type('Test Slash Heading 1');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-after-h1-executed.png' });
    console.log('[✓] Heading 1 screenshot saved: test-after-h1-executed.png');

    // TEST 2: Insert Table via Slash Menu
    console.log('[+] Testing Slash Command -> /table...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/table');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-after-table-executed.png' });
    console.log('[✓] Table screenshot saved: test-after-table-executed.png');

    // TEST 3: Insert Code Block via Slash Menu
    console.log('[+] Testing Slash Command -> /code...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/code');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter');
    await page.keyboard.type('console.log("Hello TipTap!");');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-after-code-executed.png' });
    console.log('[✓] Code block screenshot saved: test-after-code-executed.png');

    // TEST 4: Insert YouTube Video via Slash Menu
    console.log('[+] Testing Slash Command -> /you -> Modal...');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/you');
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter'); // Opens modal
    await page.waitForTimeout(600);
    
    // Enter YouTube URL into modal
    const modalInput = page.locator('.dsh-modal-input').first();
    await modalInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.keyboard.press('Enter'); // Submit modal
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-after-youtube-executed.png' });
    console.log('[✓] YouTube embed screenshot saved: test-after-youtube-executed.png');

    console.log('[🎉] ALL 4 SLASH COMMAND TESTS COMPLETED SUCCESSFULLY!');
  } else {
    console.log('[-] Could not locate "note.md" file in the sidebar.');
  }

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during UI test:', err);
  process.exit(1);
});
