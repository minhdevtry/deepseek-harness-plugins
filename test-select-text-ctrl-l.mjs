import { chromium } from 'playwright';

async function run() {
  console.log('[+] Testing Text Selection + Ctrl+L to send snippet to Chat panel...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  await page.goto('http://127.0.0.1:3080');
  await page.waitForTimeout(2000);

  // 1. Open package.json to test code selection
  console.log('[+] Opening package.json...');
  const pkgFile = page.locator('text="package.json"').first();
  await pkgFile.click();
  await page.waitForTimeout(1500);

  // 2. Select text in viewer
  console.log('[+] Selecting code snippet...');
  await page.evaluate(() => {
    const el = document.querySelector('.vk_editorBody pre, .vk_editorBody');
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  await page.waitForTimeout(500);

  // 3. Press Ctrl+L
  console.log('[+] Pressing Ctrl+L with selected text...');
  await page.keyboard.press('Control+l');
  await page.waitForTimeout(1500);

  // 4. Capture screenshot of chat input populated with selected snippet
  await page.screenshot({ path: 'test-ctrl-l-selection-sent.png' });
  console.log('[✓] Screenshot saved: test-ctrl-l-selection-sent.png');

  // Verify chat input value
  const chatVal = await page.evaluate(() => {
    const input = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
    return input ? (input.value || input.innerText || '') : '';
  });
  console.log('[+] Chat Input Content preview:', chatVal.slice(0, 120) + '...');

  if (chatVal.includes('Please analyze and explain the following snippet')) {
    console.log('[🎉] SUCCESS! Text selection was correctly injected into Chat input via Ctrl+L!');
  } else {
    console.warn('[!] Chat input was not filled, value was:', chatVal);
  }

  await browser.close();
}

run().catch(err => {
  console.error('[-] Error during test:', err);
  process.exit(1);
});
