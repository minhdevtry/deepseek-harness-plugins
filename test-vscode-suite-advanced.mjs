import { chromium } from 'playwright';

async function run() {
	console.log('[+] Launching local headless chromium for Advanced VS Code Suite verification...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
	const page = await context.newPage();

	const errors = [];
	page.on('console', msg => {
		if (msg.type() === 'error') errors.push(msg.text());
		console.log('PAGE LOG:', msg.type(), msg.text());
	});

	try {
		console.log('[+] Navigating to DeepSeek Harness (http://127.0.0.1:3080)...');
		await page.goto('http://127.0.0.1:3080', { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		// 1. Verify Right-Click Context Menu on FileTree row
		console.log('[+] Step 1: Testing Right-Click Context Menu in File Explorer...');
		const fileRow = page.locator('.vk_row').filter({ hasText: 'package.json' }).first();
		await fileRow.waitFor({ state: 'visible', timeout: 5000 });
		await fileRow.click({ button: 'right' });
		await page.waitForTimeout(400);

		const menu = page.locator('.vk_menu[data-vk-menu="true"]');
		await menu.waitFor({ state: 'visible', timeout: 3000 });
		const menuItems = await menu.locator('.vk_menuItem').allInnerTexts();
		console.log('[+] Context Menu items on package.json:', menuItems);

		if (!menuItems.some(i => i.includes('Open File')) || !menuItems.some(i => i.includes('Rename')) || !menuItems.some(i => i.includes('Copy Path'))) {
			throw new Error('Context Menu missing expected items: ' + JSON.stringify(menuItems));
		}
		await page.screenshot({ path: 'test-step-1-context-menu.png' });
		console.log('[✓] Step 1 passed! Screenshot saved: test-step-1-context-menu.png');

		// Click "Open File" from Context Menu
		const openBtn = menu.locator('.vk_menuItem').filter({ hasText: 'Open File' }).first();
		await openBtn.click();
		await page.waitForTimeout(1000);

		// 2. Verify In-Editor Find & Replace (Ctrl+F and Ctrl+H)
		console.log('[+] Step 2: Testing Find & Replace Widget (Ctrl+F / Ctrl+H)...');
		// Press Ctrl+F
		await page.keyboard.press('Control+f');
		await page.waitForTimeout(400);

		const findWidget = page.locator('.vk_find_widget[data-vk-find="true"]');
		await findWidget.waitFor({ state: 'visible', timeout: 3000 });
		console.log('[✓] Find widget opened via Ctrl+F!');

		const findInput = findWidget.locator('.vk_find_input').first();
		await findInput.fill('devDependencies');
		await page.waitForTimeout(400);

		const matchCountText = await findWidget.locator('.vk_find_count').innerText();
		console.log('[+] Find match count text:', matchCountText);

		// Press Ctrl+H to expand Replace row
		await page.keyboard.press('Control+h');
		await page.waitForTimeout(400);
		const replaceInput = findWidget.locator('.vk_replace_input');
		await replaceInput.waitFor({ state: 'visible', timeout: 3000 });
		console.log('[✓] Replace row expanded via Ctrl+H!');

		await page.screenshot({ path: 'test-step-2-find-replace-widget.png' });
		console.log('[✓] Step 2 passed! Screenshot saved: test-step-2-find-replace-widget.png');

		// Close find widget with Escape
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);

		// 3. Verify Global Workspace Search (Ctrl+Shift+F)
		console.log('[+] Step 3: Testing Global Workspace Search (Ctrl+Shift+F)...');
		await page.keyboard.press('Control+Shift+F');
		await page.waitForTimeout(500);

		const globalSearchInput = page.locator('#global-search-input');
		await globalSearchInput.waitFor({ state: 'visible', timeout: 3000 });
		console.log('[✓] Global Search tab activated via Ctrl+Shift+F!');

		await globalSearchInput.fill('tipTap');
		await page.waitForTimeout(1000);

		const searchResults = page.locator('.vk_search_results');
		await searchResults.waitFor({ state: 'visible', timeout: 5000 });
		const searchCountText = await page.locator('.vk_search_count').innerText();
		console.log('[+] Global Search results count:', searchCountText);

		await page.screenshot({ path: 'test-step-3-global-search.png' });
		console.log('[✓] Step 3 passed! Screenshot saved: test-step-3-global-search.png');

		// Click on a search match item to open the file
		const matchItem = page.locator('.vk_search_match_item').first();
		if (await matchItem.isVisible()) {
			await matchItem.click();
			await page.waitForTimeout(1000);
		}

		// 4. Verify Quick Open Palette (Ctrl+P)
		console.log('[+] Step 4: Testing Quick Open Palette (Ctrl+P)...');
		await page.keyboard.press('Control+p');
		await page.waitForTimeout(500);

		const quickOpen = page.locator('.vk_quick_open_palette[data-vk-quickopen="true"]');
		await quickOpen.waitFor({ state: 'visible', timeout: 3000 });
		console.log('[✓] Quick Open palette opened via Ctrl+P!');

		const quickInput = page.locator('.vk_quick_open_input');
		await quickInput.fill('note.md');
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'test-step-4-quick-open.png' });
		console.log('[✓] Step 4 passed! Screenshot saved: test-step-4-quick-open.png');

		// Press Enter to open note.md from Quick Open
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// 5. Verify TipTap Notion Editor with note.md
		console.log('[+] Step 5: Testing TipTap Notion WYSIWYG...');
		const ttProse = page.locator('.tiptap, .vk_tiptap_wrapper').first();
		await ttProse.waitFor({ state: 'visible', timeout: 5000 });

		const footerStat = page.locator('.vk_stat_pill');
		if (await footerStat.isVisible()) {
			console.log('[+] TipTap Document stats:', await footerStat.innerText());
		}

		await page.screenshot({ path: 'test-step-5-tiptap-suite.png' });
		console.log('[✓] Step 5 passed! Screenshot saved: test-step-5-tiptap-suite.png');

		console.log('[🎉] ALL ADVANCED VS CODE SUITE TESTS PASSED PERFECTLY!');
	} catch (err) {
		console.error('[!] Test failed with error:', err);
		await page.screenshot({ path: 'test-failed-state.png' });
		throw err;
	} finally {
		await browser.close();
	}
}

run();
