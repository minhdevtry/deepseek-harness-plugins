import { chromium } from 'playwright';
import path from 'path';

async function captureMarkdownStudio() {
	console.log('[+] Starting Visual Inspection of Markdown Notion Studio...');
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();

	try {
		await page.goto('http://127.0.0.1:3080', { waitUntil: 'networkidle', timeout: 20000 });
		await page.waitForTimeout(1500);

		// 1. Open note.md via Quick Open (Ctrl+P)
		console.log('[+] Opening note.md via Quick Open...');
		await page.keyboard.press('Control+p');
		await page.waitForTimeout(400);
		const quickInput = page.locator('.vk_quick_open_input').first();
		await quickInput.fill('note.md');
		await page.waitForTimeout(400);
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1200);

		// Close left sidebar to get clean canvas
		const sidebarToggle = page.locator('.vk_railBtn, .vk_tabBtn').filter({ hasText: '«' }).first();
		if (await sidebarToggle.isVisible()) {
			await sidebarToggle.click();
			await page.waitForTimeout(400);
		}

		// Screenshot 1: TipTap Canvas View with Split Chat
		const shot1Path = path.resolve('.system_generated_md_canvas.png');
		await page.screenshot({ path: shot1Path, fullPage: false });
		console.log('[✓] Screenshot 1 captured at:', shot1Path);

		// 2. Open Outline TOC
		const tocBtn = page.locator('.vk_editBtn').filter({ hasText: 'Outline' }).first();
		if (await tocBtn.isVisible()) {
			await tocBtn.click();
			await page.waitForTimeout(400);
			const shot2Path = path.resolve('.system_generated_md_outline.png');
			await page.screenshot({ path: shot2Path, fullPage: false });
			console.log('[✓] Screenshot 2 (Outline TOC) captured at:', shot2Path);
			const closeToc = page.locator('.vk_toc_close').first();
			if (await closeToc.isVisible()) await closeToc.click();
			await page.waitForTimeout(300);
		}

		// 3. Trigger Inline AI (Ctrl+K)
		const prose = page.locator('.vk_tiptap_prose, .ProseMirror').first();
		if (await prose.isVisible()) {
			await prose.click();
			await page.keyboard.press('Control+k');
			await page.waitForTimeout(400);
			const shot3Path = path.resolve('.system_generated_md_inline_ai.png');
			await page.screenshot({ path: shot3Path, fullPage: false });
			console.log('[✓] Screenshot 3 (Inline AI) captured at:', shot3Path);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(300);
		}

		// 4. Close Right Chat panel to see Fullscreen Distraction-Free Notion Canvas
		await page.keyboard.press('Control+l');
		await page.waitForTimeout(600);
		const shot4Path = path.resolve('.system_generated_md_fullcanvas.png');
		await page.screenshot({ path: shot4Path, fullPage: false });
		console.log('[✓] Screenshot 4 (Fullscreen Canvas) captured at:', shot4Path);

		console.log('[🎉] All visual inspection screenshots captured successfully!');
	} catch (err) {
		console.error('[!] Capture failed:', err);
	} finally {
		await browser.close();
	}
}

captureMarkdownStudio();
