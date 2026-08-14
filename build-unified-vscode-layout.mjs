import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[+] Building Unified 3-Column VS Code + TipTap Notion Suite (Perfected UI & Shortcuts)...');

const hostDir = path.join(__dirname, 'plugins/dsh-host-files');
const clientDir = path.join(__dirname, 'plugins/dsh-client-vscode-layout');

// 1. Read TipTap Bundle and SVG Icons Block
const tiptapBundle = fs.readFileSync(path.join(clientDir, 'assets/tiptap.bundle.js'), 'utf8');
const svgIcons = fs.readFileSync(path.join(clientDir, 'assets/file-icons-block.js'), 'utf8');

// 2. Read base client.base.js
let clientSource = fs.readFileSync(path.join(clientDir, 'lib/client.base.js'), 'utf8');

// 3. Update computeColumns to support wider right panel (up to 80% viewport) and collapsible right panel
const computeColumnsRegex = /function computeColumns\(viewport, sidebar, right\) \{[\s\S]*?\n\t\t\}/;
const newComputeColumns = `function computeColumns(viewport, sidebar, right) {
			const s = sidebar === 0 ? 0 : clampWidth(sidebar, 220, 500);
			const maxRight = Math.max(480, Math.floor(viewport * 0.82));
			const r0 = right === 0 ? 0 : clampWidth(right, 280, maxRight);
			if (s + r0 + 300 <= viewport) return { sidebar: s, center: viewport - s - r0, right: r0 };
			const r1 = r0 === 0 ? 0 : Math.max(280, viewport - s - 300);
			if (s + r1 + 300 <= viewport) return { sidebar: s, center: viewport - s - r1, right: r1 };
			if (s + 300 <= viewport) return { sidebar: s, center: viewport - s, right: 0 };
			return { sidebar: 0, center: viewport, right: 0 };
		}`;
clientSource = clientSource.replace(computeColumnsRegex, () => newComputeColumns);

// 4. Inject TipTap Bundle, SVG Icons, FindWidget, GlobalSearchPanel & TipTapNotionEditor
const customComponentsCode = `
		// ── Ultimate TipTap Suite Bundle ──
		${tiptapBundle}

		// ── Official VS Code / Material SVG Icon Sprites & Mappings ──
		${svgIcons}

		function FileTypeIcon({ symbolId }) {
			return react.createElement("svg", {
				className: "ft-icon",
				viewBox: "0 0 24 24",
				"aria-hidden": true,
				style: { width: "16px", height: "16px", flexShrink: 0 }
			}, react.createElement("use", { href: "#" + symbolId }));
		}

		if (typeof document !== "undefined" && !document.getElementById("ft-icons-sprite")) {
			const container = document.createElement("div");
			container.id = "ft-icons-sprite";
			container.innerHTML = FILE_ICON_SPRITE;
			document.body.appendChild(container);
		}

		// ── Custom Layout & TipTap Notion Suite CSS Styles ──
		const tiptapStyles = \`
			.vk_tiptap_wrapper {
				display: flex; flex-direction: column; height: 100%; width: 100%;
				background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #111827);
				overflow: hidden; position: relative;
			}
			.vk_tiptap_toolbar {
				background: var(--dsw-alias-bg-base, #ffffff);
				border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				padding: 6px 14px; display: flex; align-items: center; gap: 3px; flex-wrap: wrap; flex-shrink: 0;
			}
			.vk_tb_tool {
				border: none; background: transparent; color: var(--dsw-alias-label-primary, #374151);
				padding: 4px 8px; border-radius: 5px; font-size: 12.5px; font-weight: 500; cursor: pointer;
				display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px;
				transition: background 0.1s, color 0.1s;
			}
			.vk_tb_tool:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06)); color: var(--dsw-alias-state-business-primary, #2563eb); }
			.vk_tb_sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l2, #e5e7eb); margin: 0 4px; }
			.vk_bold { font-weight: 800; }
			.vk_italic { font-style: italic; }
			.vk_underline { text-decoration: underline; }
			.vk_strike { text-decoration: line-through; }

			.vk_table_toolbar {
				background: #f0fdf4; border-bottom: 1px solid #bbf7d0; padding: 4px 14px;
				display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex-shrink: 0;
			}
			.vk_tb_table_btn {
				background: #ffffff; border: 1px solid #86efac; border-radius: 4px;
				color: #166534; font-size: 11.5px; font-weight: 600; padding: 2px 7px;
				cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
			}
			.vk_tb_table_btn:hover { background: #dcfce7; }
			.vk_tb_table_btn_danger { border-color: #fca5a5; color: #991b1b; }
			.vk_tb_table_btn_danger:hover { background: #fee2e2; }

			.vk_tiptap_canvas {
				flex: 1; overflow-y: auto; overflow-x: hidden; padding: 36px 48px;
				display: flex; flex-direction: column; align-items: center;
				cursor: text; position: relative;
			}
			.vk_tiptap_container { width: 100%; max-width: 860px; min-height: 100%; }

			.tiptap.ProseMirror, .vk_tiptap_container .ProseMirror, .vk_tiptap_prose {
				outline: none; font-size: 15.5px; line-height: 1.75; min-height: 480px;
				color: var(--dsw-alias-label-primary, #1e293b); width: 100%;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			}
			.tiptap.ProseMirror h1, .tiptap.ProseMirror h2, .tiptap.ProseMirror h3,
			.vk_tiptap_container .ProseMirror h1, .vk_tiptap_container .ProseMirror h2, .vk_tiptap_container .ProseMirror h3 {
				color: #0f172a; font-weight: 700; letter-spacing: -0.02em;
			}
			.tiptap.ProseMirror h1, .vk_tiptap_container .ProseMirror h1 { font-size: 2.1em; font-weight: 800; margin: 28px 0 12px; line-height: 1.25; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 8px; }
			.tiptap.ProseMirror h2, .vk_tiptap_container .ProseMirror h2 { font-size: 1.55em; font-weight: 700; margin: 24px 0 10px; line-height: 1.3; }
			.tiptap.ProseMirror h3, .vk_tiptap_container .ProseMirror h3 { font-size: 1.25em; font-weight: 600; margin: 18px 0 6px; line-height: 1.4; }
			.tiptap.ProseMirror p, .vk_tiptap_container .ProseMirror p { margin: 10px 0; }
			.tiptap.ProseMirror hr, .vk_tiptap_container .ProseMirror hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }

			.tiptap.ProseMirror blockquote, .vk_tiptap_container .ProseMirror blockquote {
				border-left: 4px solid #3b82f6 !important;
				background: rgba(59, 130, 246, 0.05) !important;
				margin: 16px 0 !important;
				padding: 12px 18px !important;
				border-radius: 0 8px 8px 0 !important;
				color: #334155 !important;
				font-style: normal !important;
			}
			.tiptap.ProseMirror blockquote p, .vk_tiptap_container .ProseMirror blockquote p { margin: 4px 0 !important; }

			/* Task Lists in Notion Style */
			.tiptap.ProseMirror ul[data-type="taskList"], .vk_tiptap_container .ProseMirror ul[data-type="taskList"] {
				list-style: none !important;
				padding-left: 0 !important;
				margin: 12px 0 !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li, .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li {
				display: flex !important;
				align-items: flex-start !important;
				gap: 10px !important;
				margin: 6px 0 !important;
				list-style: none !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li::before,
			.tiptap.ProseMirror ul[data-type="taskList"] li::marker,
			.vk_tiptap_container .ProseMirror ul[data-type="taskList"] li::before,
			.vk_tiptap_container .ProseMirror ul[data-type="taskList"] li::marker {
				display: none !important;
				content: "" !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li > label, .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li > label {
				margin-top: 3px !important;
				flex-shrink: 0 !important;
				user-select: none !important;
				cursor: pointer !important;
				display: inline-flex !important;
				align-items: center !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"], .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
				width: 16px !important;
				height: 16px !important;
				border-radius: 4px !important;
				cursor: pointer !important;
				accent-color: #2563eb !important;
				margin: 0 !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li > div, .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li > div {
				flex: 1 1 auto !important;
				min-width: 0 !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li > div > p, .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li > div > p {
				margin: 0 !important;
				line-height: 1.6 !important;
			}
			.tiptap.ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div, .vk_tiptap_container .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
				text-decoration: line-through !important;
				opacity: 0.55 !important;
				color: #64748b !important;
			}

			/* Tables */
			.tiptap.ProseMirror table, .vk_tiptap_container .ProseMirror table {
				border-collapse: separate !important;
				border-spacing: 0 !important;
				width: 100% !important;
				margin: 20px 0 !important;
				border-radius: 8px !important;
				border: 1px solid #e2e8f0 !important;
				box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important;
				overflow: hidden !important;
			}
			.tiptap.ProseMirror th, .tiptap.ProseMirror td,
			.vk_tiptap_container .ProseMirror th, .vk_tiptap_container .ProseMirror td {
				border-right: 1px solid #e2e8f0 !important;
				border-bottom: 1px solid #e2e8f0 !important;
				padding: 10px 14px !important;
				font-size: 13.5px !important;
				text-align: left !important;
				line-height: 1.5 !important;
			}
			.tiptap.ProseMirror th, .vk_tiptap_container .ProseMirror th {
				background: #f8fafc !important;
				font-weight: 700 !important;
				color: #1e293b !important;
				border-bottom: 2px solid #cbd5e1 !important;
			}
			.tiptap.ProseMirror tr:last-child td, .vk_tiptap_container .ProseMirror tr:last-child td { border-bottom: none !important; }
			.tiptap.ProseMirror tr td:last-child, .tiptap.ProseMirror tr th:last-child,
			.vk_tiptap_container .ProseMirror tr td:last-child, .vk_tiptap_container .ProseMirror tr th:last-child { border-right: none !important; }
			.tiptap.ProseMirror tr:hover td, .vk_tiptap_container .ProseMirror tr:hover td { background: rgba(241, 245, 249, 0.6) !important; }

			/* Code Blocks & Inline Code */
			.tiptap.ProseMirror pre, .vk_tiptap_container .ProseMirror pre {
				background: #0f172a !important; color: #f8fafc !important;
				padding: 16px 20px !important; border-radius: 10px !important;
				font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace !important;
				font-size: 13px !important; line-height: 1.7 !important; margin: 16px 0 !important;
				box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12) !important;
				border: 1px solid #1e293b !important; overflow-x: auto !important;
			}
			.tiptap.ProseMirror pre code, .vk_tiptap_container .ProseMirror pre code { background: transparent !important; padding: 0 !important; color: inherit !important; font-size: inherit !important; }
			.tiptap.ProseMirror code:not(pre code), .vk_tiptap_container .ProseMirror code:not(pre code) {
				background: rgba(59, 130, 246, 0.08) !important; color: #2563eb !important;
				padding: 2px 6px !important; border-radius: 5px !important;
				font-family: 'Fira Code', Consolas, Monaco, monospace !important;
				font-size: 0.88em !important; font-weight: 500 !important;
				border: 1px solid rgba(59, 130, 246, 0.15) !important;
			}
			.tiptap.ProseMirror mark, .vk_tiptap_container .ProseMirror mark {
				background: #fef08a !important; color: #854d0e !important;
				padding: 2px 5px !important; border-radius: 4px !important;
			}
			.tiptap.ProseMirror ul:not([data-type="taskList"]), .tiptap.ProseMirror ol,
			.vk_tiptap_container .ProseMirror ul:not([data-type="taskList"]), .vk_tiptap_container .ProseMirror ol { padding-left: 28px; margin: 10px 0; }
			.tiptap.ProseMirror li:not([data-type="taskItem"]), .vk_tiptap_container .ProseMirror li:not([data-type="taskItem"]) { margin: 5px 0; }
			.tiptap.ProseMirror iframe, .vk_tiptap_container .ProseMirror iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; margin: 18px 0; border: none; }
			.tiptap.ProseMirror img, .vk_tiptap_container .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 16px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }

			.vk_slash_menu {
				position: absolute; z-index: 100; background: var(--dsw-alias-bg-base, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 10px;
				box-shadow: 0 12px 32px rgba(0,0,0,0.15); width: 300px; max-height: 360px;
				overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px;
			}
			.vk_slash_header { font-size: 11px; font-weight: 700; color: #9ca3af; padding: 6px 10px 2px; text-transform: uppercase; letter-spacing: 0.5px; }
			.vk_slash_item {
				display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px;
				cursor: pointer; font-size: 13px; color: var(--dsw-alias-label-primary, #1f2937);
				border: none; background: transparent; width: 100%; text-align: left; transition: all 0.1s ease;
			}
			.vk_slash_item:hover, .vk_slash_item_selected { background: #eff6ff; color: #2563eb; font-weight: 600; }
			.vk_slash_icon { font-size: 15px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.04); border-radius: 4px; flex-shrink: 0; }
			.vk_slash_desc { font-size: 11.5px; color: #6b7280; margin-left: auto; }

			.vk_bubble_menu {
				position: absolute; z-index: 100; background: #1f2937; color: #ffffff;
				border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
				padding: 4px; display: flex; align-items: center; gap: 2px;
				animation: vk-pop-in 0.12s ease-out;
			}
			@keyframes vk-pop-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
			.vk_bubble_btn {
				border: none; background: transparent; color: #f3f4f6; padding: 4px 8px;
				border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
				display: flex; align-items: center; gap: 3px;
			}
			.vk_bubble_btn:hover { background: #374151; color: #ffffff; }
			.vk_bubble_ai_btn {
				background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff;
				padding: 4px 9px; border-radius: 5px; font-size: 11.5px; font-weight: 700;
				border: none; cursor: pointer; display: flex; align-items: center; gap: 4px;
			}
			.vk_bubble_ai_btn:hover { filter: brightness(1.15); }
			.vk_tiptap_footer {
				position: sticky; bottom: 0; display: flex; justify-content: flex-end; align-items: center;
				padding: 6px 20px; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #6b7280);
				background: linear-gradient(to top, var(--dsw-alias-bg-base, #ffffff) 65%, transparent);
				pointer-events: none; margin-top: auto; z-index: 10;
			}
			.vk_stat_pill {
				background: var(--dsw-alias-bg-elevated, rgba(0,0,0,0.04));
				border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				border-radius: 12px; padding: 2px 10px; font-weight: 500;
				box-shadow: 0 1px 4px rgba(0,0,0,0.03); pointer-events: auto;
			}
			.vk_open_chat_float {
				position: absolute; top: 10px; right: 14px; z-index: 50;
				background: linear-gradient(135deg, #2563eb, #1d4ed8);
				color: #ffffff; border: none; padding: 7px 16px; border-radius: 20px;
				font-size: 12.5px; font-weight: 600; cursor: pointer;
				display: flex; align-items: center; gap: 6px;
				box-shadow: 0 4px 14px rgba(37,99,235,0.35);
				backdrop-filter: blur(8px);
				transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
			}
			.vk_open_chat_float:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 20px rgba(37,99,235,0.45);
				filter: brightness(1.1);
			}
			.vk_open_chat_float:active {
				transform: translateY(0);
			}

			/* In-Editor Find & Replace Widget (Ctrl+F / Ctrl+H) */
			.vk_find_widget {
				position: absolute; top: 38px; right: 24px; z-index: 90;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
				border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
				padding: 6px 10px; display: flex; flex-direction: column; gap: 6px;
				width: 360px; max-width: 90vw; animation: vk-pop-in 0.12s ease-out;
			}
			.vk_find_row { display: flex; align-items: center; gap: 6px; }
			.vk_find_toggle_btn { border: none; background: transparent; cursor: pointer; color: #6b7280; font-size: 13px; transition: transform 0.1s; padding: 2px 4px; border-radius: 3px; }
			.vk_find_toggle_btn:hover { background: rgba(0,0,0,0.06); }
			.vk_find_toggle_open { transform: rotate(90deg); }
			.vk_find_input_wrap { position: relative; flex: 1; display: flex; align-items: center; }
			.vk_find_input { width: 100%; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 5px; padding: 4px 54px 4px 8px; font-size: 12.5px; background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #111827); outline: none; }
			.vk_find_input:focus { border-color: #2563eb; }
			.vk_find_flags { position: absolute; right: 4px; display: flex; align-items: center; gap: 2px; }
			.vk_flag_btn { border: 1px solid transparent; background: transparent; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; font-weight: 700; cursor: pointer; color: #6b7280; }
			.vk_flag_btn:hover { background: rgba(0,0,0,0.06); }
			.vk_flag_btn_active { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
			.vk_find_count { font-size: 11px; color: #6b7280; white-space: nowrap; min-width: 48px; text-align: center; }
			.vk_find_icon_btn { border: none; background: transparent; border-radius: 4px; padding: 3px 6px; cursor: pointer; color: var(--dsw-alias-label-primary, #374151); font-size: 13px; }
			.vk_find_icon_btn:hover { background: rgba(0,0,0,0.06); }
			.vk_replace_btn { border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: var(--dsw-alias-bg-base, #ffffff); border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; color: var(--dsw-alias-label-primary, #374151); }
			.vk_replace_btn:hover { background: rgba(0,0,0,0.05); }

			/* Global Workspace Search Panel (Ctrl+Shift+F) */
			.vk_search_panel { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
			.vk_search_opts { display: flex; align-items: center; gap: 4px; }
			.vk_opt_btn { border: 1px solid transparent; background: transparent; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; color: #6b7280; }
			.vk_opt_btn:hover { background: rgba(0,0,0,0.06); }
			.vk_opt_btn_active { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
			.vk_search_input_box { padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); flex-shrink: 0; }
			.vk_search_results { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
			.vk_search_count { padding: 4px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
			.vk_search_file_group { display: flex; flex-direction: column; margin-bottom: 6px; }
			.vk_search_file_head { display: flex; align-items: center; gap: 6px; padding: 5px 12px; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-primary, #111827); border-radius: 4px; }
			.vk_search_file_head:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.04)); }
			.vk_search_file_name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.vk_search_file_badge { font-size: 10.5px; background: rgba(37,99,235,0.12); color: #2563eb; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
			.vk_search_match_item { display: flex; align-items: flex-start; gap: 8px; padding: 3px 12px 3px 28px; cursor: pointer; font-size: 12px; font-family: monospace; border-radius: 3px; }
			.vk_search_match_item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.04)); color: #2563eb; }
			.vk_search_match_line { color: #9ca3af; flex-shrink: 0; min-width: 22px; text-align: right; }
			.vk_search_match_text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

			/* Quick Open Palette (Ctrl+P) */
			.vk_quick_open_backdrop {
				position: fixed; inset: 0; z-index: 99999;
				background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
				display: flex; justify-content: center; align-items: flex-start;
				padding-top: 64px; animation: vk-pop-in 0.15s ease-out;
			}
			.vk_quick_open_palette {
				width: 580px; max-width: 90vw; max-height: 480px;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
				box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05);
				border-radius: 10px; display: flex; flex-direction: column; overflow: hidden;
			}
			.vk_quick_open_input_wrap {
				display: flex; align-items: center; padding: 10px 14px;
				border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				gap: 10px; background: var(--dsw-alias-bg-base, #ffffff);
			}
			.vk_quick_open_icon { font-size: 14px; opacity: 0.7; }
			.vk_quick_open_input {
				flex: 1; background: transparent; border: none; outline: none;
				font-size: 13.5px; color: var(--dsw-alias-label-primary, #111827); font-family: inherit;
			}
			.vk_quick_open_hint {
				font-size: 11px; color: #6b7280; background: var(--dsw-alias-bg-subtle, #f3f4f6);
				padding: 2px 6px; border-radius: 4px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
			}
			.vk_quick_open_list { flex: 1; overflow-y: auto; max-height: 380px; padding: 6px; }
			.vk_quick_open_item {
				display: flex; align-items: center; gap: 8px; padding: 7px 10px;
				border-radius: 6px; cursor: pointer; transition: background 0.1s ease;
				font-size: 13px; color: var(--dsw-alias-label-primary, #374151);
			}
			.vk_quick_open_item:hover, .vk_quick_open_item_active {
				background: #2563eb; color: #ffffff;
			}
			.vk_quick_open_item:hover .vk_quick_open_rel, .vk_quick_open_item_active .vk_quick_open_rel {
				color: #e0e7ff;
			}
			.vk_quick_open_name { font-weight: 500; }
			.vk_quick_open_rel {
				margin-left: auto; font-size: 11px; color: #9ca3af;
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
			}
			.vk_quick_open_empty { padding: 24px; text-align: center; font-size: 13px; color: #6b7280; }

			/* In-App Modal Dialog (Unsaved Changes, Confirmations) */
			.vk_modal_backdrop {
				position: fixed; inset: 0; z-index: 999999;
				background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(5px);
				display: flex; justify-content: center; align-items: center;
				padding: 20px; animation: vk-pop-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
			}
			.vk_dialog_card {
				width: 440px; max-width: 92vw;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
				border-radius: 12px; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0, 0, 0, 0.04);
				padding: 22px; display: flex; flex-direction: column; gap: 16px;
			}
			.vk_dialog_icon_wrap {
				display: flex; align-items: center; justify-content: center;
				width: 42px; height: 42px; border-radius: 50%;
				background: rgba(245, 158, 11, 0.12); color: #f59e0b; font-size: 20px;
			}
			.vk_dialog_icon_danger {
				background: rgba(239, 68, 68, 0.12); color: #dc2626;
			}
			.vk_dialog_body { display: flex; flex-direction: column; gap: 6px; }
			.vk_dialog_title { font-size: 16px; font-weight: 700; color: var(--dsw-alias-label-primary, #111827); margin: 0; }
			.vk_dialog_desc { font-size: 13.5px; color: var(--dsw-alias-label-primary, #374151); line-height: 1.5; margin: 0; }
			.vk_dialog_sub { font-size: 12px; color: #6b7280; margin: 0; }
			.vk_dialog_highlight { font-weight: 600; color: #2563eb; }
			.vk_dialog_actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 4px; }
			.vk_dialog_btn {
				padding: 7px 15px; border-radius: 6px; font-size: 13px; font-weight: 600;
				cursor: pointer; transition: all 0.12s ease; border: 1px solid transparent; outline: none;
			}
			.vk_dialog_btn_primary { background: #2563eb; color: #ffffff; }
			.vk_dialog_btn_primary:hover { background: #1d4ed8; }
			.vk_dialog_btn_danger { background: rgba(239, 68, 68, 0.1); color: #dc2626; border-color: rgba(239, 68, 68, 0.2); }
			.vk_dialog_btn_danger:hover { background: #dc2626; color: #ffffff; }
			.vk_dialog_btn_primary_danger { background: #dc2626; color: #ffffff; }
			.vk_dialog_btn_primary_danger:hover { background: #b91c1c; }
			.vk_dialog_btn_secondary { background: var(--dsw-alias-bg-subtle, #f3f4f6); color: var(--dsw-alias-label-primary, #374151); border-color: var(--dsw-alias-border-l1, #e5e7eb); }
			.vk_dialog_btn_secondary:hover { background: var(--dsw-alias-interactive-bg-hover, #e5e7eb); }

			/* Diff Viewer Styles */
			.vk_diff_container {
				display: flex; flex-direction: column; height: 100%; width: 100%;
				background: var(--dsw-alias-bg-base, #ffffff); overflow: hidden; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			}
			.vk_diff_header {
				display: flex; align-items: center; justify-content: space-between;
				padding: 8px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				background: var(--dsw-alias-bg-subtle, #f9fafb); flex-shrink: 0;
			}
			.vk_diff_info { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
			.vk_diff_stat { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
			.vk_diff_stat_add { background: rgba(34, 197, 94, 0.15); color: #16a34a; }
			.vk_diff_stat_del { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
			.vk_diff_actions { display: flex; align-items: center; gap: 6px; }
			.vk_diff_btn { padding: 4px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--dsw-alias-border-l2, #d1d5db); background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #374151); }
			.vk_diff_btn:hover { background: var(--dsw-alias-interactive-bg-hover, #f3f4f6); }
			.vk_diff_btn_accept { background: #16a34a; color: #ffffff; border-color: #15803d; }
			.vk_diff_btn_accept:hover { background: #15803d; }
			.vk_diff_btn_discard { background: rgba(239, 68, 68, 0.1); color: #dc2626; border-color: rgba(239, 68, 68, 0.2); }
			.vk_diff_btn_discard:hover { background: #dc2626; color: #ffffff; }
			.vk_diff_body { flex: 1; overflow: auto; padding: 4px 0; font-size: 12.5px; line-height: 1.5; }
			.vk_diff_line { display: flex; align-items: stretch; min-height: 20px; white-space: pre; }
			.vk_diff_line_add { background: rgba(34, 197, 94, 0.12); }
			.vk_diff_line_del { background: rgba(239, 68, 68, 0.12); }
			.vk_diff_num { width: 36px; padding: 0 6px; text-align: right; color: #9ca3af; user-select: none; font-size: 11px; flex-shrink: 0; }
			.vk_diff_prefix { width: 18px; text-align: center; color: #6b7280; user-select: none; flex-shrink: 0; font-weight: 700; }
			.vk_diff_line_add .vk_diff_prefix { color: #16a34a; }
			.vk_diff_line_del .vk_diff_prefix { color: #dc2626; }
			.vk_diff_text { flex: 1; padding: 0 6px; overflow-x: auto; }

			/* Breadcrumb navigation */
			.vk_breadcrumb {
				display: flex; align-items: center; gap: 4px; padding: 4px 12px;
				font-size: 11.5px; color: #6b7280; background: var(--dsw-alias-bg-subtle, #f9fafb);
				border-bottom: 1px solid var(--dsw-alias-border-l1, #f3f4f6); overflow-x: auto; flex-shrink: 0;
			}
			.vk_breadcrumb_item {
				cursor: pointer; border-radius: 3px; padding: 1px 4px; transition: all 0.1s;
				white-space: nowrap;
			}
			.vk_breadcrumb_item:hover {
				background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06));
				color: #2563eb;
			}
			.vk_breadcrumb_last {
				font-weight: 600; color: var(--dsw-alias-label-primary, #111827); cursor: default;
			}
			.vk_breadcrumb_sep {
				font-size: 12px; color: #9ca3af; user-select: none;
			}

			/* Status Bar */
			.vk_statusbar {
				display: flex; align-items: center; justify-content: space-between;
				height: 24px; padding: 0 12px; font-size: 11px;
				background: #0f172a; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08);
				flex-shrink: 0; user-select: none; z-index: 10;
			}
			.vk_statusbar_left, .vk_statusbar_right {
				display: flex; align-items: center; gap: 12px;
			}
			.vk_status_item {
				display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 5px; border-radius: 3px;
			}
			.vk_status_item:hover {
				background: rgba(255,255,255,0.1); color: #ffffff;
			}
			.vk_status_badge {
				background: rgba(37,99,235,0.3); color: #93c5fd; padding: 1px 5px; border-radius: 3px; font-weight: 600; font-size: 10.5px;
			}

			/* AI Assist Dropdown */
			.vk_ai_assist_wrap { position: relative; display: inline-flex; }
			.vk_ai_assist_btn {
				background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff; border: none;
				border-radius: 5px; padding: 3px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
				display: flex; align-items: center; gap: 5px; transition: opacity 0.15s;
			}
			.vk_ai_assist_btn:hover { opacity: 0.9; }
			.vk_ai_dropdown {
				position: absolute; top: calc(100% + 4px); right: 0; z-index: 9999;
				width: 230px; background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 8px;
				box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding: 4px; display: flex; flex-direction: column; gap: 2px;
				animation: vk-pop-in 0.12s ease-out;
			}
			.vk_ai_dropdown_item {
				display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 5px;
				border: none; background: transparent; font-size: 12px; text-align: left; cursor: pointer;
				color: var(--dsw-alias-label-primary, #374151); transition: background 0.1s;
			}
			.vk_ai_dropdown_item:hover {
				background: #eff6ff; color: #1d4ed8;
			}

			/* Inline AI Widget (Ctrl+K) */
			.vk_inline_ai_backdrop {
				position: fixed; inset: 0; z-index: 99998;
				background: rgba(0,0,0,0.12); pointer-events: auto;
			}
			.vk_inline_ai_card {
				position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
				width: min(540px, 90vw); z-index: 99999;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #d1d5db);
				border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.22);
				padding: 14px; display: flex; flex-direction: column; gap: 10px;
				animation: vk-pop-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
				backdrop-filter: blur(8px);
			}
			.vk_inline_ai_header {
				display: flex; align-items: center; justify-content: space-between;
			}
			.vk_inline_ai_title {
				font-size: 13px; font-weight: 700; color: #2563eb; display: flex; align-items: center; gap: 6px;
			}
			.vk_inline_ai_close {
				background: transparent; border: none; font-size: 16px; cursor: pointer; color: #9ca3af;
				border-radius: 4px; padding: 2px 6px;
			}
			.vk_inline_ai_close:hover { background: #fee2e2; color: #ef4444; }
			.vk_inline_ai_preview {
				font-size: 11px; padding: 6px 10px; border-radius: 6px;
				background: var(--dsw-alias-bg-subtle, #f3f4f6); color: #4b5563;
				overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
			}
			.vk_inline_ai_preview_label { font-weight: 700; color: #6b7280; }
			.vk_inline_ai_input_wrap {
				display: flex; align-items: center; gap: 8px; background: var(--dsw-alias-bg-base, #ffffff);
				border: 1.5px solid #3b82f6; border-radius: 8px; padding: 4px 8px;
				box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
			}
			.vk_inline_ai_input {
				flex: 1; border: none; outline: none; background: transparent; font-size: 13px;
				color: var(--dsw-alias-label-primary, #111827);
			}
			.vk_inline_ai_submit {
				background: #2563eb; color: #ffffff; border: none; border-radius: 5px;
				width: 26px; height: 26px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center;
			}
			.vk_inline_ai_chips {
				display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
			}
			.vk_inline_ai_chip {
				background: var(--dsw-alias-bg-subtle, #f3f4f6); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				border-radius: 6px; padding: 3px 8px; font-size: 11px; color: var(--dsw-alias-label-secondary, #4b5563);
				cursor: pointer; transition: all 0.1s;
			}
			.vk_inline_ai_chip:hover {
				background: #eff6ff; border-color: #93c5fd; color: #1d4ed8;
			}

			/* @ Mention File Dropdown in Chat */
			.vk_at_file_dropdown {
				position: absolute; bottom: calc(100% + 8px); left: 16px; z-index: 9999;
				width: 320px; max-height: 240px; overflow-y: auto;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 8px;
				box-shadow: 0 10px 25px rgba(0,0,0,0.18); padding: 4px;
			}
			.vk_at_file_header {
				font-size: 10.5px; font-weight: 700; color: #6b7280; padding: 4px 8px; text-transform: uppercase;
			}
			.vk_at_file_item {
				display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 5px;
				cursor: pointer; font-size: 12px;
			}
			.vk_at_file_item:hover { background: #eff6ff; color: #1d4ed8; }
			.vk_at_file_name { font-weight: 600; }
			.vk_at_file_path { font-size: 10px; color: #9ca3af; margin-left: auto; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

			/* Document Outline (TOC) */
			.vk_toc_backdrop {
				position: fixed; inset: 0; z-index: 99998; background: rgba(0,0,0,0.15);
			}
			.vk_toc_card {
				position: fixed; top: 70px; right: 24px; width: 300px; max-height: 70vh;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 10px;
				box-shadow: 0 12px 35px rgba(0,0,0,0.2); padding: 12px; display: flex; flex-direction: column; gap: 8px;
				z-index: 99999; animation: vk-pop-in 0.15s ease-out;
			}
			.vk_toc_header {
				display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--dsw-alias-border-l1, #f3f4f6); padding-bottom: 6px;
			}
			.vk_toc_title { font-size: 12.5px; font-weight: 700; color: var(--dsw-alias-label-primary, #111827); }
			.vk_toc_close { background: transparent; border: none; font-size: 14px; cursor: pointer; color: #9ca3af; }
			.vk_toc_list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 55vh; }
			.vk_toc_item {
				display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px;
				cursor: pointer; font-size: 11.5px; color: var(--dsw-alias-label-secondary, #4b5563);
			}
			.vk_toc_item:hover { background: #eff6ff; color: #2563eb; }
			.vk_toc_level_1 { font-weight: 600; padding-left: 6px; }
			.vk_toc_level_2 { padding-left: 16px; }
			.vk_toc_level_3 { padding-left: 26px; font-size: 11px; color: #6b7280; }
			.vk_toc_badge { font-size: 9.5px; font-weight: 700; padding: 1px 4px; border-radius: 3px; background: rgba(37,99,235,0.15); color: #2563eb; }
			.vk_toc_empty { font-size: 11.5px; color: #9ca3af; padding: 12px; text-align: center; }

			/* Chat Code Block Action Buttons */
			.vk_chat_code_bar {
				display: flex; align-items: center; gap: 6px; margin-bottom: 4px; justify-content: flex-end;
			}
			.vk_code_action_btn {
				display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 4px;
				font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.15);
				background: rgba(30, 41, 59, 0.85); color: #e2e8f0; transition: all 0.12s;
			}
			.vk_code_action_btn:hover { background: #2563eb; color: #ffffff; border-color: #2563eb; }

			/* AI Mode Selector */
			.vk_ai_mode_bar {
				display: flex; align-items: center; gap: 4px; padding: 4px 10px;
				background: var(--dsw-alias-bg-subtle, #f8fafc); border-bottom: 1px solid var(--dsw-alias-border-l1, #e2e8f0);
			}
			.vk_ai_mode_pill {
				background: transparent; border: 1px solid transparent; border-radius: 5px;
				padding: 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer;
				color: var(--dsw-alias-label-secondary, #64748b); transition: all 0.12s;
			}
			.vk_ai_mode_pill:hover { background: rgba(37,99,235,0.08); color: #2563eb; }
			.vk_ai_mode_pill_active {
				background: #eff6ff !important; border-color: #93c5fd !important;
				color: #1d4ed8 !important; font-weight: 700;
			}

			/* Chat Slash Command Dropdown */
			.vk_chat_slash_dropdown {
				position: absolute; bottom: calc(100% + 8px); left: 16px; z-index: 9999;
				width: 380px; max-height: 280px; overflow-y: auto;
				background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #d1d5db); border-radius: 10px;
				box-shadow: 0 12px 30px rgba(0,0,0,0.2); padding: 6px; animation: vk-pop-in 0.12s ease-out;
			}
			.vk_chat_slash_item {
				display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px;
				cursor: pointer; font-size: 12px; transition: background 0.1s;
			}
			.vk_chat_slash_item:hover { background: #eff6ff; color: #1d4ed8; }
			.vk_chat_slash_label { font-weight: 700; color: #2563eb; font-family: monospace; font-size: 12.5px; }
			.vk_chat_slash_desc { font-size: 11px; color: #64748b; margin-left: auto; text-align: right; }

			/* Reasoning Accordion (<think>) */
			.vk_colRight details.thinking, .vk_colRight details[data-thinking="true"] {
				background: rgba(30, 41, 59, 0.05); border: 1px solid var(--dsw-alias-border-l1, #e2e8f0);
				border-radius: 8px; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: #64748b;
			}

			/* TipTap Collaboration Multi-User Cursors */
			.collaboration-cursor__caret {
				position: relative;
				margin-left: -1px;
				margin-right: -1px;
				border-left: 2px solid #3b82f6;
				border-right: 0;
				word-break: normal;
				pointer-events: none;
			}
			.collaboration-cursor__label {
				position: absolute;
				top: -1.4em;
				left: -2px;
				font-size: 10.5px;
				font-weight: 600;
				line-height: normal;
				user-select: none;
				color: #fff;
				padding: 1px 6px;
				border-radius: 4px;
				white-space: nowrap;
				pointer-events: none;
				box-shadow: 0 2px 6px rgba(0,0,0,0.2);
			}

			/* Code-Server Login Modal (Password Protection Gate) */
			.vk_login_backdrop {
				position: fixed; inset: 0; z-index: 9999999;
				background: radial-gradient(circle at 50% 30%, rgba(37, 99, 235, 0.15), rgba(15, 23, 42, 0.85) 70%), rgba(15, 23, 42, 0.95);
				backdrop-filter: blur(16px);
				display: flex; justify-content: center; align-items: center; padding: 20px;
				animation: vk-pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
			}
			.vk_login_card {
				width: 460px; max-width: 92vw;
				background: rgba(30, 41, 59, 0.95);
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 16px;
				box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.2);
				padding: 32px; display: flex; flex-direction: column; gap: 20px;
				color: #f8fafc;
			}
			.vk_login_header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
			.vk_login_badge {
				background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);
				padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
			}
			.vk_login_title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 4px 0 0 0; }
			.vk_login_subtitle { font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.4; }
			.vk_login_section { display: flex; flex-direction: column; gap: 8px; }
			.vk_login_label { font-size: 12px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
			.vk_profile_grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
			.vk_profile_card {
				background: rgba(15, 23, 42, 0.6); border: 2px solid rgba(255, 255, 255, 0.08);
				border-radius: 12px; padding: 12px 8px; text-align: center; cursor: pointer;
				transition: all 0.15s ease; display: flex; flex-direction: column; align-items: center; gap: 4px;
			}
			.vk_profile_card:hover { border-color: rgba(255, 255, 255, 0.25); transform: translateY(-2px); }
			.vk_profile_card_active { transform: translateY(-2px); }
			.vk_profile_lucas.vk_profile_card_active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.15); box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
			.vk_profile_lona.vk_profile_card_active { border-color: #ec4899; background: rgba(236, 72, 153, 0.15); box-shadow: 0 0 15px rgba(236, 72, 153, 0.3); }
			.vk_profile_custom.vk_profile_card_active { border-color: #10b981; background: rgba(16, 185, 129, 0.15); box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
			.vk_profile_avatar { font-size: 26px; line-height: 1; }
			.vk_profile_name { font-size: 13.5px; font-weight: 700; color: #ffffff; }
			.vk_profile_role { font-size: 10.5px; color: #94a3b8; }
			.vk_login_input_wrap {
				display: flex; align-items: center; background: rgba(15, 23, 42, 0.8);
				border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 4px 12px;
				transition: border-color 0.15s;
			}
			.vk_login_input_wrap:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25); }
			.vk_login_input {
				flex: 1; background: transparent; border: none; outline: none; padding: 8px 0;
				font-size: 14px; color: #ffffff;
			}
			.vk_login_input::placeholder { color: #64748b; }
			.vk_login_eye_btn { background: transparent; border: none; cursor: pointer; font-size: 16px; opacity: 0.7; }
			.vk_login_eye_btn:hover { opacity: 1; }
			.vk_login_error {
				background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
				color: #fca5a5; padding: 8px 12px; border-radius: 8px; font-size: 12.5px;
			}
			.vk_login_submit_btn {
				background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff;
				border: none; border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 700;
				cursor: pointer; transition: all 0.15s ease; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
				width: 100%; margin-top: 4px;
			}
			.vk_login_submit_btn:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5); }
			.vk_login_submit_btn:disabled { opacity: 0.6; cursor: not-allowed; }

			/* Presence & Sandbox Badges */
			.vk_collab_pill {
				display: inline-flex; align-items: center; gap: 5px; background: rgba(34, 197, 94, 0.15);
				color: #15803d; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px;
				padding: 2px 8px; font-size: 11px; font-weight: 600;
			}
			.vk_sandbox_pill {
				display: inline-flex; align-items: center; gap: 4px; background: rgba(59, 130, 246, 0.1);
				color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px;
				padding: 2px 7px; font-size: 11px; font-weight: 600; cursor: pointer;
			}
			.vk_sandbox_pill:hover { background: rgba(59, 130, 246, 0.18); }
			.vk_user_profile_pill {
				display: inline-flex; align-items: center; gap: 5px; background: var(--dsw-alias-bg-elevated, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 20px;
				padding: 2px 8px; font-size: 11.5px; font-weight: 600; cursor: pointer;
				color: var(--dsw-alias-label-primary, #374151); transition: all 0.12s;
			}
			.vk_user_profile_pill:hover { border-color: #3b82f6; }
			/* Shortcuts Cheat Sheet Modal */
			.vk_shortcuts_grid {
				display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
				gap: 14px; max-height: 480px; overflow-y: auto; padding: 4px;
			}
			.vk_shortcut_group {
				background: var(--dsw-alias-bg-subtle, #f8fafc);
				border: 1px solid var(--dsw-alias-border-l1, #e2e8f0);
				border-radius: 8px; padding: 12px;
			}
			.vk_shortcut_group_title {
				font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase;
				letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
			}
			.vk_shortcut_row {
				display: flex; align-items: center; justify-content: space-between;
				padding: 5px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); font-size: 12px;
			}
			.vk_shortcut_row:last-child { border-bottom: none; }
			.vk_shortcut_desc { color: var(--dsw-alias-label-primary, #334155); }
			.vk_kbd {
				background: var(--dsw-alias-bg-base, #ffffff);
				border: 1px solid var(--dsw-alias-border-l2, #cbd5e1);
				box-shadow: 0 1px 2px rgba(0,0,0,0.08); border-radius: 4px;
				padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, monospace;
				font-size: 11px; font-weight: 600; color: #2563eb;
			}

			/* Document Statistics Modal */
			.vk_stats_grid {
				display: grid; grid-template-columns: repeat(2, 1fr);
				gap: 12px; margin-bottom: 16px;
			}
			.vk_stat_card {
				background: var(--dsw-alias-bg-subtle, #f8fafc);
				border: 1px solid var(--dsw-alias-border-l1, #e2e8f0);
				border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
			}
			.vk_stat_label { font-size: 11.5px; color: #64748b; font-weight: 600; }
			.vk_stat_val { font-size: 20px; font-weight: 800; color: #2563eb; }

			/* Zen / Focus Mode Exit Banner */
			.vk_zen_banner {
				position: fixed; top: 12px; right: 16px; z-index: 9999;
				background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
				color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.18);
				border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 600;
				cursor: pointer; display: flex; align-items: center; gap: 6px;
				box-shadow: 0 4px 16px rgba(0,0,0,0.3); transition: all 0.15s ease;
			}
			.vk_zen_banner:hover { background: #2563eb; transform: scale(1.03); }

			/* Toast Notification */
			.vk_toast_msg {
				position: fixed; bottom: 34px; left: 50%; transform: translateX(-50%);
				z-index: 10000; background: #0f172a; color: #f8fafc;
				border: 1px solid #334155; border-radius: 8px; padding: 8px 18px;
				font-size: 12px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
				display: flex; align-items: center; gap: 8px; animation: vk-pop-in 0.15s ease-out;
			}

			/* Clean Print / PDF styles */
			@media print {
				.vk_tiptap_toolbar, .vk_statusbar, .vk_colLeft, .vk_colRight, .vk_breadcrumb, .vk_open_chat_float, .vk_zen_banner, .vk_modal_backdrop { display: none !important; }
				.vk_frame { display: block !important; }
				.vk_colCenter { width: 100% !important; overflow: visible !important; }
				.vk_tiptap_canvas { padding: 0 !important; overflow: visible !important; }
				.tiptap.ProseMirror { font-size: 12pt !important; line-height: 1.5 !important; }
			}
		\`;

		if (typeof document !== "undefined" && !document.getElementById("vk-tiptap-styles")) {
			const s = document.createElement("style");
			s.id = "vk-tiptap-styles";
			s.textContent = tiptapStyles;
			document.head.appendChild(s);
		}

		// ── Code-Server Password Login Gate ──
		function LoginModal({ isOpen, onLoginSuccess }) {
			if (!isOpen) return null;
			const [preset, setPreset] = react.useState('lucas');
			const [customName, setCustomName] = react.useState('');
			const [customColor, setCustomColor] = react.useState('#10b981');
			const [customAvatar, setCustomAvatar] = react.useState('✨');
			const [password, setPassword] = react.useState('');
			const [showPass, setShowPass] = react.useState(false);
			const [remember, setRemember] = react.useState(true);
			const [error, setError] = react.useState('');
			const [loading, setLoading] = react.useState(false);

			const handleSubmit = async (e) => {
				if (e) e.preventDefault();
				setError('');
				setLoading(true);
				try {
					const name = preset === 'lucas' ? 'Lucas' : (preset === 'lona' ? 'Lona' : (customName || 'Collaborator'));
					const color = preset === 'lucas' ? '#3b82f6' : (preset === 'lona' ? '#ec4899' : customColor);
					const avatar = preset === 'lucas' ? '👨‍💻' : (preset === 'lona' ? '💖' : customAvatar);
					const res = await fetch('/vscode-files/auth/login', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ password, name, color, avatar, preset })
					});
					const data = await res.json();
					if (data && data.ok) {
						if (remember && data.token) {
							try {
								localStorage.setItem('dsh_auth_token', data.token);
								localStorage.setItem('dsh_user_profile', JSON.stringify(data.user));
							} catch {}
						}
						onLoginSuccess(data.token, data.user);
					} else {
						setError(data?.error || 'Invalid password. Please try again.');
					}
				} catch (err) {
					setError('Network error during login: ' + err.message);
				} finally {
					setLoading(false);
				}
			};

			return h('div', { className: 'vk_login_backdrop' },
				h('div', { className: 'vk_login_card' },
					h('div', { className: 'vk_login_header' },
						h('div', { className: 'vk_login_badge' }, '🚀 DeepSeek Harness Cloud'),
						h('h2', { className: 'vk_login_title' }, 'Workspace Access'),
						h('p', { className: 'vk_login_subtitle' }, 'Select your profile and enter workspace password to collaborate.')
					),
					h('div', { className: 'vk_login_section' },
						h('label', { className: 'vk_login_label' }, '1. Who is logging in?'),
						h('div', { className: 'vk_profile_grid' },
							h('div', {
								className: 'vk_profile_card' + (preset === 'lucas' ? ' vk_profile_card_active vk_profile_lucas' : ''),
								onClick: () => setPreset('lucas')
							},
								h('div', { className: 'vk_profile_avatar' }, '👨‍💻'),
								h('div', { className: 'vk_profile_name' }, 'Lucas'),
								h('div', { className: 'vk_profile_role' }, 'Host (Blue)')
							),
							h('div', {
								className: 'vk_profile_card' + (preset === 'lona' ? ' vk_profile_card_active vk_profile_lona' : ''),
								onClick: () => setPreset('lona')
							},
								h('div', { className: 'vk_profile_avatar' }, '💖'),
								h('div', { className: 'vk_profile_name' }, 'Lona'),
								h('div', { className: 'vk_profile_role' }, 'Collaborator (Pink)')
							),
							h('div', {
								className: 'vk_profile_card' + (preset === 'custom' ? ' vk_profile_card_active vk_profile_custom' : ''),
								onClick: () => setPreset('custom')
							},
								h('div', { className: 'vk_profile_avatar' }, customAvatar || '✨'),
								h('div', { className: 'vk_profile_name' }, customName || 'Custom'),
								h('div', { className: 'vk_profile_role' }, 'Custom User')
							)
						),
						preset === 'custom' ? h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
							h('input', {
								type: 'text',
								placeholder: 'Your Name (e.g. Alex)',
								value: customName,
								onChange: (e) => setCustomName(e.target.value),
								className: 'vk_login_input',
								style: { flex: 1, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 10px' }
							}),
							h('input', {
								type: 'color',
								value: customColor,
								onChange: (e) => setCustomColor(e.target.value),
								style: { width: '40px', height: '36px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer' }
							})
						) : null
					),
					h('form', { onSubmit: handleSubmit, className: 'vk_login_form', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
						h('label', { className: 'vk_login_label' }, '2. Workspace Password'),
						h('div', { className: 'vk_login_input_wrap' },
							h('input', {
								type: showPass ? 'text' : 'password',
								placeholder: 'Enter password...',
								value: password,
								autoFocus: true,
								onChange: (e) => setPassword(e.target.value),
								className: 'vk_login_input'
							}),
							h('button', {
								type: 'button',
								onClick: () => setShowPass(!showPass),
								className: 'vk_login_eye_btn'
							}, showPass ? '👁️' : '🙈')
						),
						error ? h('div', { className: 'vk_login_error' }, '⚠️ ' + error) : null,
						h('div', { className: 'vk_login_remember_row' },
							h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#94a3b8' } },
								h('input', {
									type: 'checkbox',
									checked: remember,
									onChange: (e) => setRemember(e.target.checked)
								}),
								'Remember me on this device'
							)
						),
						h('button', {
							type: 'submit',
							disabled: loading,
							className: 'vk_login_submit_btn'
						}, loading ? 'Verifying...' : '🚀 Unlock Workspace & Collab')
					)
				)
			);
		}

		// ── Sandboxed In-App Workspace Folder Switcher ──
		function OpenFolderModal({ isOpen, onClose, onSelectFolder }) {
			if (!isOpen) return null;
			const [folders, setFolders] = react.useState([]);
			const [sandboxRoot, setSandboxRoot] = react.useState('');
			const [loading, setLoading] = react.useState(true);
			const [search, setSearch] = react.useState('');

			react.useEffect(() => {
				setLoading(true);
				fetch('/vscode-files/sandbox-folders')
					.then(r => r.json())
					.then(d => {
						if (d && d.ok) {
							setFolders(d.folders || []);
							setSandboxRoot(d.sandboxRoot || '');
						}
					})
					.catch(() => {})
					.finally(() => setLoading(false));
			}, []);

			const filtered = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.rel.toLowerCase().includes(search.toLowerCase()));

			return h('div', { className: 'vk_quick_open_backdrop', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
				h('div', { className: 'vk_quick_open_palette', style: { width: '600px' } },
					h('div', { className: 'vk_quick_open_input_wrap' },
						h('span', { className: 'vk_quick_open_icon' }, '🔒'),
						h('input', {
							type: 'text',
							placeholder: 'Select sandboxed folder in workspace...',
							value: search,
							autoFocus: true,
							onChange: (e) => setSearch(e.target.value),
							className: 'vk_quick_open_input'
						}),
						h('span', { className: 'vk_quick_open_hint' }, 'Sandboxed')
					),
					h('div', { style: { padding: '8px 14px', background: 'rgba(59, 130, 246, 0.06)', borderBottom: '1px solid #e5e7eb', fontSize: '11.5px', color: '#2563eb' } },
						'Sandbox Root: ', h('strong', null, sandboxRoot || 'Current Project'), ' (Strictly Sandboxed)'
					),
					h('div', { className: 'vk_quick_open_list' },
						loading ? h('div', { style: { padding: '20px', textAlign: 'center', color: '#9ca3af' } }, 'Loading sandboxed folders...') :
						filtered.length === 0 ? h('div', { style: { padding: '20px', textAlign: 'center', color: '#9ca3af' } }, 'No subfolders found') :
						filtered.map(f => h('div', {
							key: f.path,
							className: 'vk_quick_open_item',
							onClick: () => onSelectFolder(f.path)
						},
							h('span', null, '📁'),
							h('span', { style: { fontWeight: 600 } }, f.name),
							h('span', { style: { marginLeft: 'auto', fontSize: '11px', color: '#9ca3af' } }, f.rel)
						))
					)
				)
			);
		}

		// ── User Profile & Live Cursor Settings Modal ──
		function UserProfileModal({ isOpen, currentUser, onClose, onSaveProfile }) {
			if (!isOpen) return null;
			const [name, setName] = react.useState(currentUser?.name || 'Lucas');
			const [color, setColor] = react.useState(currentUser?.color || '#3b82f6');
			const [avatar, setAvatar] = react.useState(currentUser?.avatar || '👨‍💻');

			const setPreset = (p) => {
				if (p === 'lucas') { setName('Lucas'); setColor('#3b82f6'); setAvatar('👨‍💻'); }
				else if (p === 'lona') { setName('Lona'); setColor('#ec4899'); setAvatar('💖'); }
			};

			const handleSave = (e) => {
				if (e) e.preventDefault();
				onSaveProfile({ name, color, avatar });
				onClose();
			};

			return h('div', { className: 'vk_quick_open_backdrop', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
				h('div', { className: 'vk_quick_open_palette', style: { width: '420px', padding: '20px' } },
					h('h3', { style: { margin: '0 0 8px 0', fontSize: '16px', color: 'var(--dsw-alias-label-primary, #111827)' } }, '👤 Collaborator Profile'),
					h('p', { style: { margin: '0 0 16px 0', fontSize: '12.5px', color: '#6b7280' } }, 'Set your live cursor color and nickname for real-time collaboration.'),
					h('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } },
						h('button', {
							type: 'button',
							onClick: () => setPreset('lucas'),
							className: 'vk_profile_quick_btn' + (name === 'Lucas' ? ' vk_profile_quick_btn_active' : ''),
							style: { flex: 1, borderColor: '#3b82f6' }
						}, '👨‍💻 Lucas (Blue)'),
						h('button', {
							type: 'button',
							onClick: () => setPreset('lona'),
							className: 'vk_profile_quick_btn' + (name === 'Lona' ? ' vk_profile_quick_btn_active' : ''),
							style: { flex: 1, borderColor: '#ec4899' }
						}, '💖 Lona (Pink)')
					),
					h('form', { onSubmit: handleSave, style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
						h('div', null,
							h('label', { style: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, #374151)', marginBottom: '4px' } }, 'Display Name'),
							h('input', { type: 'text', value: name, onChange: (e) => setName(e.target.value), className: 'vk_login_input', style: { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px', color: '#111827' } })
						),
						h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
							h('div', { style: { flex: 1 } },
								h('label', { style: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, #374151)', marginBottom: '4px' } }, 'Cursor Color'),
								h('input', { type: 'color', value: color, onChange: (e) => setColor(e.target.value), style: { width: '100%', height: '36px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer' } })
							),
							h('div', { style: { flex: 1 } },
								h('label', { style: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, #374151)', marginBottom: '4px' } }, 'Emoji Avatar'),
								h('input', { type: 'text', value: avatar, onChange: (e) => setAvatar(e.target.value), className: 'vk_login_input', style: { width: '100%', boxSizing: 'border-box', textAlign: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px', color: '#111827' } })
							)
						),
						h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
							h('button', { type: 'button', onClick: onClose, className: 'vk_editBtn' }, 'Cancel'),
							h('button', { type: 'submit', className: 'vk_editBtn vk_editBtnPrimary' }, 'Save Profile')
						)
					)
				)
			);
		}

		// ── Breadcrumb Navigation Component ──
		function Breadcrumb({ path, onOpenFolder }) {
			if (!path || path === TRAJECTORY_TAB_PATH) return null;
			const parts = path.split(/[\\/\\\\]/).filter(Boolean);
			
			return h("div", { className: "vk_breadcrumb", "data-vk-breadcrumb": true },
				parts.map((part, idx) => {
					const currentSubPath = parts.slice(0, idx + 1).join("/");
					const isLast = idx === parts.length - 1;
					return h(react.Fragment, { key: currentSubPath },
						idx > 0 ? h("span", { className: "vk_breadcrumb_sep" }, "›") : null,
						h("span", {
							className: "vk_breadcrumb_item" + (isLast ? " vk_breadcrumb_last" : ""),
							title: currentSubPath,
							onClick: () => {
								if (!isLast && onOpenFolder) onOpenFolder(currentSubPath);
							}
						}, part)
					);
				})
			);
		}

		// ── Bottom Status Bar Component ──
		function StatusBar({ active, isMarkdown, stats, lineCount, isDirty, onToggleDiff, autoSave, onToggleAutoSave }) {
			const activeName = active?.name || "";
			const ext = activeName.includes(".") ? activeName.split(".").pop().toUpperCase() : "TEXT";

			return h("div", { className: "vk_statusbar", "data-vk-statusbar": true },
				h("div", { className: "vk_statusbar_left" },
					h("span", { className: "vk_status_item" }, "🌿 main"),
					active ? h("span", { className: "vk_status_item", title: active.path }, "📄 " + activeName) : null,
					isDirty ? h("span", { className: "vk_status_badge" }, "● Unsaved") : null
				),
				h("div", { className: "vk_statusbar_right" },
					onToggleAutoSave ? h("span", {
						className: "vk_status_item" + (autoSave ? " vk_status_badge" : ""),
						onClick: onToggleAutoSave,
						title: "Click to toggle Auto-Save (1.5s delay)"
					}, "💾 Auto-Save: " + (autoSave ? "ON" : "OFF")) : null,
					isMarkdown && stats ? h("span", { className: "vk_status_item" }, stats.words + " words, " + stats.chars + " chars") : null,
					lineCount ? h("span", { className: "vk_status_item" }, lineCount + " lines") : null,
					h("span", { className: "vk_status_item" }, "UTF-8"),
					h("span", { className: "vk_status_item vk_status_badge" }, isMarkdown ? "Markdown (TipTap)" : ext),
					onToggleDiff ? h("span", { className: "vk_status_item", onClick: onToggleDiff, title: "Toggle Diff Changes" }, "⚡ Diff") : null
				)
			);
		}

		// ── Inline AI Widget (Ctrl+K) ──
		function InlineAIWidget({ isOpen, selectionText, onClose, onSubmit }) {
			const [prompt, setPrompt] = react.useState("");
			const inputRef = react.useRef(null);

			react.useEffect(() => {
				if (isOpen) {
					setPrompt("");
					setTimeout(() => inputRef.current?.focus(), 60);
				}
			}, [isOpen]);

			if (!isOpen) return null;

			const chips = [
				{ label: "⚡ Polish Text", action: "Rewrite and polish this text to be clear, engaging, and professional." },
				{ label: "📊 Format Table", action: "Convert this information into a clean, formatted Markdown table." },
				{ label: "💡 Summarize", action: "Summarize the key takeaways and actionable points from this text." },
				{ label: "🔧 Refactor Code", action: "Refactor this code to follow modern best practices, clean architecture, and type safety." }
			];

			const handleSubmit = (customInstruction) => {
				const instruction = customInstruction || prompt.trim();
				if (!instruction) return;
				onSubmit(instruction, selectionText);
				onClose();
			};

			return h("div", {
				className: "vk_inline_ai_backdrop",
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", {
					className: "vk_inline_ai_card",
					"data-vk-inline-ai": true
				},
					h("div", { className: "vk_inline_ai_header" },
						h("span", { className: "vk_inline_ai_title" }, "🤖 Inline AI Assist (Ctrl+K)"),
						h("button", { className: "vk_inline_ai_close", onClick: onClose }, "×")
					),
					selectionText ? h("div", { className: "vk_inline_ai_preview" },
						h("span", { className: "vk_inline_ai_preview_label" }, "Selection: "),
						h("span", { className: "vk_inline_ai_preview_text" }, selectionText.slice(0, 120) + (selectionText.length > 120 ? "..." : ""))
					) : null,
					h("div", { className: "vk_inline_ai_input_wrap" },
						h("input", {
							ref: inputRef,
							className: "vk_inline_ai_input",
							placeholder: "Ask AI to rewrite, edit, convert, or refactor...",
							value: prompt,
							onChange: (e) => setPrompt(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSubmit();
								} else if (e.key === "Escape") {
									e.preventDefault();
									onClose();
								}
							}
						}),
						h("button", {
							type: "button",
							className: "vk_inline_ai_submit",
							onClick: () => handleSubmit()
						}, "↵")
					),
					h("div", { className: "vk_inline_ai_chips" },
						chips.map((c) => h("button", {
							key: c.label,
							type: "button",
							className: "vk_inline_ai_chip",
							onClick: () => handleSubmit(c.action)
						}, c.label))
					)
				)
			);
		}

		// ── Document Outline TOC Component ──
		function OutlineTocDropdown({ editor, isOpen, onClose }) {
			const [headings, setHeadings] = react.useState([]);

			react.useEffect(() => {
				if (!isOpen || !editor) return;
				const items = [];
				editor.state.doc.descendants((node, pos) => {
					if (node.type.name === "heading") {
						items.push({
							level: node.attrs.level,
							text: node.textContent,
							pos
						});
					}
				});
				setHeadings(items);
			}, [isOpen, editor]);

			if (!isOpen) return null;

			const scrollToPos = (pos) => {
				if (!editor) return;
				editor.commands.setTextSelection(pos + 1);
				editor.commands.scrollIntoView();
				onClose();
			};

			return h("div", {
				className: "vk_toc_backdrop",
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", { className: "vk_toc_card", "data-vk-toc": true },
					h("div", { className: "vk_toc_header" },
						h("span", { className: "vk_toc_title" }, "📑 Document Outline"),
						h("button", { className: "vk_toc_close", onClick: onClose }, "×")
					),
					headings.length === 0
						? h("div", { className: "vk_toc_empty" }, "No headings found. Add H1, H2, or H3 in TipTap to see outline.")
						: h("div", { className: "vk_toc_list" },
							headings.map((hItem, idx) => h("div", {
								key: idx,
								className: "vk_toc_item vk_toc_level_" + hItem.level,
								onClick: () => scrollToPos(hItem.pos)
							},
								h("span", { className: "vk_toc_badge" }, "H" + hItem.level),
								h("span", { className: "vk_toc_text" }, hItem.text || "Untitled Section")
							))
						)
				)
			);
		}

		// ── @ Mention File Dropdown Component ──
		function AtFileMentionDropdown({ isOpen, query, onSelect, onClose }) {
			const [files, setFiles] = react.useState([]);

			react.useEffect(() => {
				if (!isOpen) return;
				fetch("/vscode-files/search?type=filename&q=" + encodeURIComponent(query || ""))
					.then(r => r.json())
					.then(d => { if (d && d.ok && d.results) setFiles(d.results.slice(0, 12)); })
					.catch(() => {});
			}, [isOpen, query]);

			if (!isOpen || files.length === 0) return null;

			return h("div", { className: "vk_at_file_dropdown", "data-vk-at-file": true },
				h("div", { className: "vk_at_file_header" }, "Mention Workspace File (@)"),
				files.map(f => h("div", {
					key: f.path,
					className: "vk_at_file_item",
					onClick: () => onSelect(f)
				},
					h("span", { className: "vk_at_file_icon" }, "📄"),
					h("span", { className: "vk_at_file_name" }, f.name),
					h("span", { className: "vk_at_file_path" }, f.path)
				))
			);
		}

		// ── AI Assist Quick Actions Dropdown Component ──
		function AIAssistDropdown({ onAction }) {
			const [open, setOpen] = react.useState(false);
			const ref = react.useRef(null);

			react.useEffect(() => {
				if (!open) return;
				const onDown = (e) => {
					if (ref.current && !ref.current.contains(e.target)) setOpen(false);
				};
				window.addEventListener("pointerdown", onDown);
				return () => window.removeEventListener("pointerdown", onDown);
			}, [open]);

			const trigger = (type) => {
				setOpen(false);
				if (onAction) onAction(type);
			};

			return h("div", { ref, className: "vk_ai_assist_wrap" },
				h("button", {
					type: "button",
					className: "vk_ai_assist_btn",
					title: "AI Code Actions & Assistance",
					onClick: () => setOpen(!open)
				}, "🤖 AI Assist ▾"),
				open ? h("div", { className: "vk_ai_dropdown", "data-vk-ai-menu": true },
					h("button", { className: "vk_ai_dropdown_item", onClick: () => trigger("explain") }, "📖 Explain Code / File"),
					h("button", { className: "vk_ai_dropdown_item", onClick: () => trigger("tests") }, "🧪 Generate Unit Tests"),
					h("button", { className: "vk_ai_dropdown_item", onClick: () => trigger("refactor") }, "🔧 Refactor & Optimize"),
					h("button", { className: "vk_ai_dropdown_item", onClick: () => trigger("docs") }, "📝 Generate JSDoc / Docs"),
					h("button", { className: "vk_ai_dropdown_item", onClick: () => trigger("review") }, "🔍 Code Review & Bug Check")
				) : null
			);
		}

		// ── AI Mode Selector Component (Agent / Plan / Ask) ──
		function AIModeSelector({ currentMode, onSelectMode }) {
			const modes = [
				{ id: "agent", label: "🚀 Agent", title: "Autonomous execution: read, edit files & run commands" },
				{ id: "plan", label: "📋 Plan", title: "Planning mode: architectural analysis & step-by-step design" },
				{ id: "ask", label: "💬 Ask", title: "Explain & brainstorm: discuss without modifying files" }
			];

			return h("div", { className: "vk_ai_mode_bar", "data-vk-ai-mode-bar": true },
				modes.map(m => h("button", {
					key: m.id,
					type: "button",
					className: "vk_ai_mode_pill" + (currentMode === m.id ? " vk_ai_mode_pill_active" : ""),
					title: m.title,
					onClick: () => onSelectMode(m.id)
				}, m.label))
			);
		}

		// ── Chat Slash Command Dropdown Component (/) ──
		function ChatSlashCommandDropdown({ isOpen, query, onSelect, onClose }) {
			const commands = [
				{ id: "/plan", label: "/plan", desc: "Step-by-step implementation plan before coding", prefix: "[PLANNING MODE] Please create a comprehensive, step-by-step implementation plan with architectural overview for: " },
				{ id: "/review", label: "/review", desc: "Review git diffs, edge cases and security", prefix: "[CODE REVIEW] Please perform a thorough code review on the active file and recent workspace changes for: " },
				{ id: "/test", label: "/test", desc: "Run and fix automated test suite", prefix: "[TEST SUITE] Please run our automated test suite and fix any failing tests: " },
				{ id: "/skill", label: "/skill", desc: "Load and activate specialized AI Skill", prefix: "[SKILL ACTIVATION] Activate skill: " },
				{ id: "/compact", label: "/compact", desc: "Compact and summarize chat context", prefix: "/compact" },
				{ id: "/clear", label: "/clear", desc: "Start a fresh discussion session", prefix: "/clear" }
			];

			const filtered = react.useMemo(() => {
				if (!query) return commands;
				const q = query.toLowerCase();
				return commands.filter(c => c.id.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
			}, [query]);

			if (!isOpen || filtered.length === 0) return null;

			return h("div", { className: "vk_chat_slash_dropdown", "data-vk-slash-commands": true },
				h("div", { className: "vk_slash_header" }, "AI Slash Commands (/)"),
				filtered.map(c => h("div", {
					key: c.id,
					className: "vk_chat_slash_item",
					onClick: () => onSelect(c)
				},
					h("span", { className: "vk_chat_slash_label" }, c.label),
					h("span", { className: "vk_chat_slash_desc" }, c.desc)
				))
			);
		}

		// ── Keyboard Shortcuts Cheat Sheet Modal (Ctrl+/ or F1) ──
		function ShortcutsCheatSheetModal({ isOpen, onClose }) {
			const [search, setSearch] = react.useState("");
			const inputRef = react.useRef(null);

			react.useEffect(() => {
				if (isOpen) {
					setSearch("");
					setTimeout(() => inputRef.current?.focus(), 50);
				}
			}, [isOpen]);

			if (!isOpen) return null;

			const categories = [
				{
					title: "🧭 Navigation & Windows",
					items: [
						{ desc: "Quick Open File", kbd: "Ctrl + P" },
						{ desc: "Command Palette", kbd: "Ctrl + Shift + P / F1" },
						{ desc: "Global Workspace Search", kbd: "Ctrl + Shift + F" },
						{ desc: "Toggle Focus / Zen Mode", kbd: "Ctrl + Shift + Z" },
						{ desc: "Open / Create Daily Scratchpad", kbd: "Ctrl + Shift + N" }
					]
				},
				{
					title: "✍️ Editing & Markdown",
					items: [
						{ desc: "Save Document", kbd: "Ctrl + S" },
						{ desc: "Find in Document", kbd: "Ctrl + F" },
						{ desc: "Find & Replace", kbd: "Ctrl + H" },
						{ desc: "Undo Edit", kbd: "Ctrl + Z" },
						{ desc: "Redo Edit", kbd: "Ctrl + Y / Ctrl+Shift+Z" },
						{ desc: "Bold Text", kbd: "Ctrl + B" },
						{ desc: "Italic Text", kbd: "Ctrl + I" },
						{ desc: "Insert Slash Block (/)", kbd: "/" }
					]
				},
				{
					title: "🤖 AI Assistant & Collaboration",
					items: [
						{ desc: "Inline AI Assist", kbd: "Ctrl + K" },
						{ desc: "Send Selection to AI Chat", kbd: "Ctrl + L" },
						{ desc: "Mention File in Chat", kbd: "@" },
						{ desc: "Chat Slash Commands", kbd: "/" },
						{ desc: "Switch Collaborator Profile", kbd: "Palette -> Collab" }
					]
				},
				{
					title: "🔍 View & Zoom",
					items: [
						{ desc: "Zoom In Editor Font", kbd: "Ctrl + =" },
						{ desc: "Zoom Out Editor Font", kbd: "Ctrl + -" },
						{ desc: "Reset Editor Font", kbd: "Ctrl + 0" },
						{ desc: "Toggle Code Diff Viewer", kbd: "Status Bar -> Diff" }
					]
				}
			];

			const filtered = categories.map(cat => ({
				...cat,
				items: cat.items.filter(i => i.desc.toLowerCase().includes(search.toLowerCase()) || i.kbd.toLowerCase().includes(search.toLowerCase()))
			})).filter(cat => cat.items.length > 0);

			return h("div", {
				className: "vk_modal_backdrop",
				"data-vk-shortcuts-modal": true,
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", { className: "vk_dialog_card", style: { width: "640px", maxWidth: "94vw", padding: "24px" } },
					h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" } },
						h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" } }, "⌨️ Keyboard Shortcuts Cheat Sheet"),
						h("button", { className: "vk_inline_ai_close", onClick: onClose }, "✕")
					),
					h("div", { style: { marginBottom: "14px" } },
						h("input", {
							ref: inputRef,
							className: "vk_pickInput",
							placeholder: "Search shortcuts (e.g. search, save, diff, ai)...",
							value: search,
							onChange: (e) => setSearch(e.target.value)
						})
					),
					h("div", { className: "vk_shortcuts_grid" },
						filtered.length === 0 ? h("div", { style: { padding: "20px", textAlign: "center", color: "#9ca3af", gridColumn: "1 / -1" } }, "No matching shortcuts found") :
						filtered.map(cat => h("div", { key: cat.title, className: "vk_shortcut_group" },
							h("div", { className: "vk_shortcut_group_title" }, cat.title),
							cat.items.map(item => h("div", { key: item.desc, className: "vk_shortcut_row" },
								h("span", { className: "vk_shortcut_desc" }, item.desc),
								h("kbd", { className: "vk_kbd" }, item.kbd)
							))
						))
					),
					h("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "16px" } },
						h("button", { className: "vk_dialog_btn vk_dialog_btn_primary", onClick: onClose }, "Got it (Esc)")
					)
				)
			);
		}

		// ── Document Reading Metrics & Stats Modal ──
		function DocumentStatsModal({ isOpen, stats, fileName, content, onClose }) {
			if (!isOpen) return null;
			const text = content || "";
			const words = stats?.words || (text.trim() ? text.trim().split(/\\s+/).length : 0);
			const chars = stats?.chars || text.length;
			const charsNoSpaces = text.replace(/\\s/g, "").length;
			const lines = text.split(String.fromCharCode(10)).length;
			const paragraphs = text.split(/\\n\\s*\\n/).filter(p => p.trim().length > 0).length;
			const readTime = Math.max(1, Math.ceil(words / 200));
			const speakTime = Math.max(1, Math.ceil(words / 130));

			return h("div", {
				className: "vk_modal_backdrop",
				"data-vk-stats-modal": true,
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", { className: "vk_dialog_card", style: { width: "460px", maxWidth: "92vw", padding: "24px" } },
					h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
						h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" } }, "📊 Document Reading Metrics"),
						h("button", { className: "vk_inline_ai_close", onClick: onClose }, "✕")
					),
					h("div", { style: { fontSize: "12px", color: "#64748b", marginBottom: "16px", fontWeight: "500" } }, "Document: " + (fileName || "Untitled")),
					h("div", { className: "vk_stats_grid" },
						h("div", { className: "vk_stat_card" },
							h("span", { className: "vk_stat_label" }, "📖 Estimated Reading Time"),
							h("span", { className: "vk_stat_val" }, readTime + " min"),
							h("span", { style: { fontSize: "10.5px", color: "#94a3b8" } }, "Based on ~200 words/min")
						),
						h("div", { className: "vk_stat_card" },
							h("span", { className: "vk_stat_label" }, "🎙️ Estimated Speaking Time"),
							h("span", { className: "vk_stat_val" }, speakTime + " min"),
							h("span", { style: { fontSize: "10.5px", color: "#94a3b8" } }, "Based on ~130 words/min")
						),
						h("div", { className: "vk_stat_card" },
							h("span", { className: "vk_stat_label" }, "Total Words"),
							h("span", { className: "vk_stat_val" }, words.toLocaleString()),
							h("span", { style: { fontSize: "10.5px", color: "#94a3b8" } }, paragraphs + " paragraphs")
						),
						h("div", { className: "vk_stat_card" },
							h("span", { className: "vk_stat_label" }, "Characters"),
							h("span", { className: "vk_stat_val" }, chars.toLocaleString()),
							h("span", { style: { fontSize: "10.5px", color: "#94a3b8" } }, charsNoSpaces.toLocaleString() + " without spaces")
						)
					),
					h("div", { style: { display: "flex", justifyContent: "flex-end" } },
						h("button", { className: "vk_dialog_btn vk_dialog_btn_primary", onClick: onClose }, "Close (Esc)")
					)
				)
			);
		}

		// ── Command Palette (Ctrl+Shift+P / F1) ──
		function CommandPaletteModal({ isOpen, onClose, onExecuteAction }) {
			const [query, setQuery] = react.useState("");
			const [selectedIndex, setSelectedIndex] = react.useState(0);
			const inputRef = react.useRef(null);

			const commands = [
				{ id: "quick_open", title: "File: Quick Open File...", shortcut: "Ctrl+P", icon: "📄" },
				{ id: "daily_scratchpad", title: "File: Open / Create Daily Scratchpad", shortcut: "Ctrl+Shift+N", icon: "📓" },
				{ id: "open_folder", title: "File: Open Sandboxed Folder in Workspace...", icon: "🔒" },
				{ id: "user_profile", title: "Collab: Switch User Profile / Cursor Color...", icon: "👤" },
				{ id: "zen_mode", title: "View: Toggle Focus / Zen Mode", shortcut: "Ctrl+Shift+Z", icon: "🧘" },
				{ id: "keyboard_shortcuts", title: "Help: Keyboard Shortcuts Cheat Sheet", shortcut: "Ctrl+/", icon: "⌨️" },
				{ id: "doc_stats", title: "Document: View Reading Time & Statistics", icon: "📊" },
				{ id: "global_search", title: "Search: Find in Workspace Files", shortcut: "Ctrl+Shift+F", icon: "🔍" },
				{ id: "save_file", title: "File: Save Current File", shortcut: "Ctrl+S", icon: "💾" },
				{ id: "export_download", title: "Export: Download Markdown File", icon: "📥" },
				{ id: "export_markdown", title: "Export: Copy Clean Markdown to Clipboard", icon: "📋" },
				{ id: "export_html", title: "Export: Copy Formatted HTML to Clipboard", icon: "📄" },
				{ id: "export_pdf", title: "Export: Print / Save Document as PDF", icon: "🖨️" },
				{ id: "toggle_diff", title: "Diff: Toggle File Diff Viewer", icon: "⚡" },
				{ id: "undo", title: "Edit: Undo", shortcut: "Ctrl+Z", icon: "↺" },
				{ id: "redo", title: "Edit: Redo", shortcut: "Ctrl+Y", icon: "↻" },
				{ id: "zoom_in", title: "View: Zoom In Editor Font", shortcut: "Ctrl+=", icon: "🔍" },
				{ id: "zoom_out", title: "View: Zoom Out Editor Font", shortcut: "Ctrl+-", icon: "🔍" },
				{ id: "zoom_reset", title: "View: Reset Editor Zoom", shortcut: "Ctrl+0", icon: "↺" },
				{ id: "ai_explain", title: "AI Assist: Explain Current File", shortcut: "Ctrl+L", icon: "🤖" },
				{ id: "ai_tests", title: "AI Assist: Generate Unit Tests", icon: "🧪" },
				{ id: "ai_refactor", title: "AI Assist: Refactor & Optimize Code", icon: "🔧" },
				{ id: "ai_docs", title: "AI Assist: Generate Documentation", icon: "📝" },
				{ id: "toggle_chat", title: "View: Toggle AI Chat Panel", shortcut: "Ctrl+L", icon: "💬" },
				{ id: "toggle_sidebar", title: "View: Toggle Left Sidebar", icon: "📁" },
				{ id: "new_file", title: "Explorer: New File...", icon: "➕" },
				{ id: "new_folder", title: "Explorer: New Folder...", icon: "📁" },
				{ id: "refresh_explorer", title: "Explorer: Refresh Files", icon: "🔄" }
			];

			const filtered = react.useMemo(() => {
				if (!query.trim()) return commands;
				const q = query.toLowerCase().trim();
				return commands.filter(c => c.title.toLowerCase().includes(q) || (c.shortcut && c.shortcut.toLowerCase().includes(q)));
			}, [query]);

			react.useEffect(() => {
				if (isOpen) {
					setQuery("");
					setSelectedIndex(0);
					setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 60);
				}
			}, [isOpen]);

			react.useEffect(() => {
				setSelectedIndex(0);
			}, [query]);

			if (!isOpen) return null;

			const selectCommand = (cmd) => {
				if (!cmd) return;
				onClose();
				if (onExecuteAction) onExecuteAction(cmd.id);
			};

			return h("div", {
				className: "vk_quick_open_backdrop",
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", { className: "vk_quick_open_palette", "data-vk-cmd-palette": true },
					h("div", { className: "vk_quick_open_input_wrap" },
						h("span", { className: "vk_quick_open_icon" }, ">"),
						h("input", {
							ref: inputRef,
							className: "vk_quick_open_input",
							placeholder: "Type a command or action (e.g. Save, Diff, Explain, Search)...",
							value: query,
							onChange: (e) => setQuery(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "ArrowDown") {
									e.preventDefault();
									setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
								} else if (e.key === "ArrowUp") {
									e.preventDefault();
									setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
								} else if (e.key === "Enter") {
									e.preventDefault();
									if (filtered[selectedIndex]) selectCommand(filtered[selectedIndex]);
								} else if (e.key === "Escape") {
									e.preventDefault();
									onClose();
								}
							}
						}),
						h("span", { className: "vk_quick_open_hint" }, "Esc")
					),
					h("div", { className: "vk_quick_open_list" },
						filtered.length === 0 ? h("div", { className: "vk_quick_open_empty" }, "No matching commands") :
						filtered.map((item, idx) => h("div", {
							key: item.id,
							className: "vk_quick_open_item" + (idx === selectedIndex ? " vk_quick_open_item_active" : ""),
							onClick: () => selectCommand(item),
							onMouseEnter: () => setSelectedIndex(idx)
						},
							h("span", { style: { fontSize: "14px" } }, item.icon),
							h("span", { className: "vk_quick_open_name" }, item.title),
							item.shortcut ? h("span", { className: "vk_quick_open_rel" }, item.shortcut) : null
						))
					)
				)
			);
		}

		// ── Sleek In-App Modal Dialog (Replacing Browser confirm/alert) ──
		function UnsavedChangesModal({ isOpen, title, fileName, message, saveLabel, dontSaveLabel, cancelLabel, onSave, onDontSave, onCancel, isDanger }) {
			react.useEffect(() => {
				if (!isOpen) return;
				const onKey = (e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						if (onCancel) onCancel();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [isOpen, onCancel]);

			if (!isOpen) return null;

			return h("div", {
				className: "vk_modal_backdrop",
				"data-vk-modal": true,
				onClick: (e) => { if (e.target === e.currentTarget && onCancel) onCancel(); }
			},
				h("div", { className: "vk_dialog_card", "data-vk-dialog": true },
					h("div", { className: "vk_dialog_icon_wrap" + (isDanger ? " vk_dialog_icon_danger" : "") },
						h("span", { className: "vk_dialog_icon" }, isDanger ? "🗑️" : "⚠️")
					),
					h("div", { className: "vk_dialog_body" },
						h("h3", { className: "vk_dialog_title" }, title || "Save changes?"),
						h("p", { className: "vk_dialog_desc" },
							message || (fileName ? [
								"Do you want to save the changes you made to ",
								h("strong", { key: "fn", className: "vk_dialog_highlight" }, fileName),
								"?"
							] : "Do you want to save changes?")
						),
						!isDanger ? h("p", { className: "vk_dialog_sub" }, "Your changes will be lost if you don't save them.") : null
					),
					h("div", { className: "vk_dialog_actions" },
						onSave ? h("button", {
							className: "vk_dialog_btn vk_dialog_btn_primary",
							"data-vk-btn-save": true,
							onClick: onSave,
							autoFocus: true
						}, saveLabel || "Save") : null,
						onDontSave ? h("button", {
							className: "vk_dialog_btn " + (isDanger ? "vk_dialog_btn_primary_danger" : "vk_dialog_btn_danger"),
							"data-vk-btn-dontsave": true,
							onClick: onDontSave
						}, dontSaveLabel || (isDanger ? "Delete" : "Don't Save")) : null,
						h("button", {
							className: "vk_dialog_btn vk_dialog_btn_secondary",
							"data-vk-btn-cancel": true,
							onClick: onCancel
						}, cancelLabel || "Cancel")
					)
				)
			);
		}

		// ── Diff Viewer Component (Side-by-side or Unified Diff) ──
		function DiffViewer({ oldText, newText, fileName, onAccept, onDiscard, onClose }) {
			const diffLines = react.useMemo(() => {
				const oldLines = (oldText || "").split("\\n");
				const newLines = (newText || "").split("\\n");
				const lines = [];
				let added = 0;
				let removed = 0;
				
				let i = 0, j = 0;
				while (i < oldLines.length || j < newLines.length) {
					if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
						lines.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: oldLines[i] });
						i++; j++;
					} else if (j < newLines.length && (i >= oldLines.length || !oldLines.slice(i, i + 10).includes(newLines[j]))) {
						lines.push({ type: "add", oldLine: null, newLine: j + 1, text: newLines[j] });
						added++;
						j++;
					} else if (i < oldLines.length) {
						lines.push({ type: "del", oldLine: i + 1, newLine: null, text: oldLines[i] });
						removed++;
						i++;
					} else {
						break;
					}
				}
				return { lines, added, removed };
			}, [oldText, newText]);

			return h("div", { className: "vk_diff_container", "data-vk-diff": true },
				h("div", { className: "vk_diff_header" },
					h("div", { className: "vk_diff_info" },
						h("span", { className: "vk_diff_icon" }, "⚡"),
						h("span", { className: "vk_diff_filename" }, fileName || "Diff Comparison"),
						h("span", { className: "vk_diff_stat vk_diff_stat_add" }, "+" + diffLines.added),
						h("span", { className: "vk_diff_stat vk_diff_stat_del" }, "-" + diffLines.removed)
					),
					h("div", { className: "vk_diff_actions" },
						onAccept ? h("button", { className: "vk_diff_btn vk_diff_btn_accept", onClick: onAccept }, "✓ Accept") : null,
						onDiscard ? h("button", { className: "vk_diff_btn vk_diff_btn_discard", onClick: onDiscard }, "✕ Discard") : null,
						onClose ? h("button", { className: "vk_diff_btn", onClick: onClose }, "Close") : null
					)
				),
				h("div", { className: "vk_diff_body" },
					diffLines.lines.map((l, idx) => h("div", {
						key: idx,
						className: "vk_diff_line vk_diff_line_" + l.type
					},
						h("span", { className: "vk_diff_num" }, l.oldLine || ""),
						h("span", { className: "vk_diff_num" }, l.newLine || ""),
						h("span", { className: "vk_diff_prefix" }, l.type === "add" ? "+" : l.type === "del" ? "-" : " "),
						h("span", { className: "vk_diff_text" }, l.text)
					))
				)
			);
		}

		// ── Quick Open File Modal (Ctrl+P) ──
		function QuickOpenModal({ isOpen, onClose, root, onOpenFile }) {
			const [query, setQuery] = react.useState("");
			const [results, setResults] = react.useState([]);
			const [selectedIndex, setSelectedIndex] = react.useState(0);
			const [loading, setLoading] = react.useState(false);
			const inputRef = react.useRef(null);

			react.useEffect(() => {
				if (isOpen) {
					setQuery("");
					setSelectedIndex(0);
					setLoading(true);
					const targetRoot = typeof root === "string" && root.length > 0 ? root : ".";
					fetch("/vscode-files/search?path=" + encodeURIComponent(targetRoot) + "&type=filename&q=")
						.then((r) => r.json())
						.then((d) => {
							setResults(d && d.ok && Array.isArray(d.results) ? d.results : []);
							setLoading(false);
						})
						.catch(() => { setResults([]); setLoading(false); });
					setTimeout(() => {
						if (inputRef.current) {
							inputRef.current.focus();
							inputRef.current.select();
						}
					}, 60);
				}
			}, [isOpen, root]);

			const filtered = react.useMemo(() => {
				if (!query.trim()) return results.slice(0, 50);
				const q = query.toLowerCase().trim();
				return results.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.rel && r.rel.toLowerCase().includes(q))).slice(0, 50);
			}, [query, results]);

			react.useEffect(() => {
				setSelectedIndex(0);
			}, [query]);

			if (!isOpen) return null;

			const selectItem = (item) => {
				if (!item) return;
				onClose();
				if (onOpenFile) onOpenFile({ path: item.path, name: item.name });
			};

			return h("div", {
				className: "vk_quick_open_backdrop",
				onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
			},
				h("div", { className: "vk_quick_open_palette", "data-vk-quickopen": true },
					h("div", { className: "vk_quick_open_input_wrap" },
						h("span", { className: "vk_quick_open_icon" }, "🔍"),
						h("input", {
							ref: inputRef,
							className: "vk_quick_open_input",
							placeholder: "Search files by name (e.g. app.js, README.md)...",
							value: query,
							onChange: (e) => setQuery(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "ArrowDown") {
									e.preventDefault();
									setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
								} else if (e.key === "ArrowUp") {
									e.preventDefault();
									setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
								} else if (e.key === "Enter") {
									e.preventDefault();
									if (filtered[selectedIndex]) selectItem(filtered[selectedIndex]);
								} else if (e.key === "Escape") {
									e.preventDefault();
									onClose();
								}
							}
						}),
						h("span", { className: "vk_quick_open_hint" }, "Esc to close")
					),
					h("div", { className: "vk_quick_open_list" },
						loading ? h("div", { className: "vk_quick_open_empty" }, "Loading workspace files...") :
						filtered.length === 0 ? h("div", { className: "vk_quick_open_empty" }, "No matching files found") :
						filtered.map((item, idx) => h("div", {
							key: item.path || item.rel,
							className: "vk_quick_open_item" + (idx === selectedIndex ? " vk_quick_open_item_active" : ""),
							onClick: () => selectItem(item),
							onMouseEnter: () => setSelectedIndex(idx)
						},
							h(FileTypeIcon, { symbolId: fileIconId(item.name, "file", false) }),
							h("span", { className: "vk_quick_open_name" }, item.name),
							h("span", { className: "vk_quick_open_rel" }, item.rel || item.path)
						))
					)
				)
			);
		}

		// ── Global Full-Text Workspace Search Panel (Ctrl+Shift+F) ──
		function GlobalSearchPanel({ root, onOpenFile }) {
			const [query, setQuery] = react.useState("");
			const [caseSensitive, setCaseSensitive] = react.useState(false);
			const [isRegex, setIsRegex] = react.useState(false);
			const [results, setResults] = react.useState(null);
			const [searching, setSearching] = react.useState(false);
			const [error, setError] = react.useState(null);
			const inputRef = react.useRef(null);

			const doSearch = react.useCallback((q) => {
				if (!q || q.trim().length === 0) {
					setResults(null);
					setSearching(false);
					return;
				}
				setSearching(true);
				setError(null);
				const targetRoot = root || ".";
				fetch("/vscode-files/search?path=" + encodeURIComponent(targetRoot) + "&type=content&q=" + encodeURIComponent(q.trim()) + "&caseSensitive=" + caseSensitive + "&isRegex=" + isRegex)
					.then((r) => r.json())
					.then((d) => {
						setSearching(false);
						if (d && d.ok && d.results) {
							setResults(d.results);
						} else {
							setError((d && d.error) || "Search failed");
						}
					})
					.catch((err) => {
						setSearching(false);
						setError(String(err));
					});
			}, [root, caseSensitive, isRegex]);

			react.useEffect(() => {
				const timer = setTimeout(() => doSearch(query), 300);
				return () => clearTimeout(timer);
			}, [query, doSearch]);

			const grouped = react.useMemo(() => {
				if (!results) return [];
				const map = new Map();
				for (const r of results) {
					if (!map.has(r.path)) {
						map.set(r.path, { name: r.name, path: r.path, rel: r.rel, matches: [] });
					}
					map.get(r.path).matches.push(r);
				}
				return Array.from(map.values());
			}, [results]);

			return h("div", { className: "vk_search_panel" },
				h("div", { className: "vk_treeHead" },
					h("span", { className: "vk_treeTitle" }, "SEARCH"),
					h("div", { className: "vk_search_opts" },
						h("button", {
							className: "vk_opt_btn" + (caseSensitive ? " vk_opt_btn_active" : ""),
							title: "Match Case (Alt+C)",
							onClick: () => setCaseSensitive(!caseSensitive)
						}, "Aa"),
						h("button", {
							className: "vk_opt_btn" + (isRegex ? " vk_opt_btn_active" : ""),
							title: "Use Regular Expression (Alt+R)",
							onClick: () => setIsRegex(!isRegex)
						}, ".*")
					)
				),
				h("div", { className: "vk_search_input_box" },
					h("input", {
						ref: inputRef,
						id: "global-search-input",
						className: "vk_pickInput",
						placeholder: "Search in files (e.g. function, class)...",
						value: query,
						autoFocus: true,
						onChange: (e) => setQuery(e.target.value),
						onKeyDown: (e) => { if (e.key === "Enter") doSearch(query); }
					})
				),
				h("div", { className: "vk_tree" },
					searching ? h("div", { className: "vk_empty" }, "Searching workspace...") :
					error ? h("div", { className: "vk_err" }, error) :
					results === null ? h("div", { className: "vk_empty" }, "Type keyword to search across all project files") :
					results.length === 0 ? h("div", { className: "vk_empty" }, "No matching results found") :
					h("div", { className: "vk_search_results" },
						h("div", { className: "vk_search_count" }, results.length + " results in " + grouped.length + " files"),
						grouped.map((g) => h("div", { key: g.path, className: "vk_search_file_group" },
							h("div", {
								className: "vk_search_file_head",
								onClick: () => onOpenFile({ path: g.path, name: g.name })
							},
								h(FileTypeIcon, { symbolId: fileIconId(g.name, "file", false) }),
								h("span", { className: "vk_search_file_name" }, g.name),
								h("span", { className: "vk_search_file_badge" }, g.matches.length)
							),
							g.matches.map((m) => h("div", {
								key: m.path + ":" + m.line,
								className: "vk_search_match_item",
								onClick: () => onOpenFile({ path: m.path, name: m.name, line: m.line })
							},
								h("span", { className: "vk_search_match_line" }, m.line),
								h("span", { className: "vk_search_match_text" }, m.preview)
							))
						))
					)
				)
			);
		}

		// ── In-Editor Find & Replace Widget (Ctrl+F / Ctrl+H) ──
		function FindWidget({ isOpen, isReplace, onClose, onFindNext, onFindPrev, onReplace, onReplaceAll, matchCount, activeIndex, onToggleReplace }) {
			const [findVal, setFindVal] = react.useState("");
			const [replaceVal, setReplaceVal] = react.useState("");
			const [matchCase, setMatchCase] = react.useState(false);
			const [wholeWord, setWholeWord] = react.useState(false);
			const [isRegex, setIsRegex] = react.useState(false);
			const inputRef = react.useRef(null);

			react.useEffect(() => {
				if (isOpen && inputRef.current) {
					inputRef.current.focus();
					inputRef.current.select();
				}
			}, [isOpen]);

			if (!isOpen) return null;

			return h("div", { className: "vk_find_widget", "data-vk-find": true },
				h("div", { className: "vk_find_row" },
					h("button", {
						className: "vk_find_toggle_btn" + (isReplace ? " vk_find_toggle_open" : ""),
						title: isReplace ? "Collapse Replace (Ctrl+H)" : "Expand Replace (Ctrl+H)",
						onClick: onToggleReplace
					}, "▸"),
					h("div", { className: "vk_find_input_wrap" },
						h("input", {
							ref: inputRef,
							className: "vk_find_input",
							placeholder: "Find...",
							value: findVal,
							onChange: (e) => {
								setFindVal(e.target.value);
								if (onFindNext) onFindNext(e.target.value, 0, { matchCase, wholeWord, isRegex });
							},
							onKeyDown: (e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									if (e.shiftKey && onFindPrev) onFindPrev(findVal, { matchCase, wholeWord, isRegex });
									else if (onFindNext) onFindNext(findVal, 1, { matchCase, wholeWord, isRegex });
								}
								if (e.key === "Escape") onClose();
							}
						}),
						h("div", { className: "vk_find_flags" },
							h("button", {
								className: "vk_flag_btn" + (matchCase ? " vk_flag_btn_active" : ""),
								title: "Match Case (Alt+C)",
								onClick: () => {
									const next = !matchCase;
									setMatchCase(next);
									if (onFindNext) onFindNext(findVal, 0, { matchCase: next, wholeWord, isRegex });
								}
							}, "Aa"),
							h("button", {
								className: "vk_flag_btn" + (wholeWord ? " vk_flag_btn_active" : ""),
								title: "Match Whole Word (Alt+W)",
								onClick: () => {
									const next = !wholeWord;
									setWholeWord(next);
									if (onFindNext) onFindNext(findVal, 0, { matchCase, wholeWord: next, isRegex });
								}
							}, "\\\\b"),
							h("button", {
								className: "vk_flag_btn" + (isRegex ? " vk_flag_btn_active" : ""),
								title: "Use Regular Expression (Alt+R)",
								onClick: () => {
									const next = !isRegex;
									setIsRegex(next);
									if (onFindNext) onFindNext(findVal, 0, { matchCase, wholeWord, isRegex: next });
								}
							}, ".*")
						)
					),
					h("span", { className: "vk_find_count" },
						findVal.length === 0 ? "No results" :
						matchCount === 0 ? "No results" :
						(activeIndex + 1) + " of " + matchCount
					),
					h("button", { className: "vk_find_icon_btn", title: "Previous Match (Shift+Enter)", onClick: () => onFindPrev && onFindPrev(findVal, { matchCase, wholeWord, isRegex }) }, "↑"),
					h("button", { className: "vk_find_icon_btn", title: "Next Match (Enter)", onClick: () => onFindNext && onFindNext(findVal, 1, { matchCase, wholeWord, isRegex }) }, "↓"),
					h("button", { className: "vk_find_icon_btn", title: "Close (Escape)", onClick: onClose }, "✕")
				),
				isReplace ? h("div", { className: "vk_find_row vk_replace_row" },
					h("div", { style: { width: "18px" } }),
					h("input", {
						className: "vk_find_input vk_replace_input",
						placeholder: "Replace...",
						value: replaceVal,
						onChange: (e) => setReplaceVal(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								if (onReplace) onReplace(findVal, replaceVal, { matchCase, wholeWord, isRegex });
							}
							if (e.key === "Escape") onClose();
						}
					}),
					h("button", { className: "vk_replace_btn", title: "Replace Current Match", onClick: () => onReplace && onReplace(findVal, replaceVal, { matchCase, wholeWord, isRegex }) }, "Replace"),
					h("button", { className: "vk_replace_btn", title: "Replace All Matches", onClick: () => onReplaceAll && onReplaceAll(findVal, replaceVal, { matchCase, wholeWord, isRegex }) }, "Replace All")
				) : null
			);
		}

		// ── TipTap Notion Suite WYSIWYG Component ──
		function TipTapNotionEditor({ file, content, isDirty, onUpdateContent, onSave, onCancel, busy, saveMsg, onToggleRawMode }) {
			const [slashMenu, _setSlashMenu] = react.useState(null);
			const [slashIdx, _setSlashIdx] = react.useState(0);
			const [slashQuery, _setSlashQuery] = react.useState('');
			const [bubbleMenu, setBubbleMenu] = react.useState(null);
			const [isInTable, setIsInTable] = react.useState(false);
			const [embedModal, setEmbedModal] = react.useState(null);
			const [stats, setStats] = react.useState({ words: 0, chars: 0 });
			const [tocOpen, setTocOpen] = react.useState(false);
			const [inlineAIOpen, setInlineAIOpen] = react.useState(false);
			const [inlineSelection, setInlineSelection] = react.useState("");
			const [exportOpen, setExportOpen] = react.useState(false);
			const [collaborators, setCollaborators] = react.useState([]);
			const [collabConnected, setCollabConnected] = react.useState(false);

			const handleInlineAISubmit = (instruction, selText) => {
				const activeName = file?.name || "document.md";
				const prompt = 'Please assist with the following section from ' + activeName + ':\\n\\n\`\`\`markdown\\n' + (selText || content || "") + '\\n\`\`\`\\n\\nInstruction: ' + instruction;
				const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
				if (chatInput) {
					if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
						chatInput.value = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					} else {
						chatInput.innerText = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					}
					chatInput.focus();
				}
			};

			const handleExport = (type) => {
				setExportOpen(false);
				if (!editorRef.current) return;
				if (type === 'markdown') {
					const md = editorRef.current.storage?.markdown?.getMarkdown() || content || "";
					navigator.clipboard?.writeText(md);
				} else if (type === 'html') {
					const html = editorRef.current.getHTML();
					navigator.clipboard?.writeText(html);
				} else if (type === 'print') {
					window.print();
				}
			};

			const editorRef = react.useRef(null);
			const containerRef = react.useRef(null);
			const canvasRef = react.useRef(null);
			const slashStateRef = react.useRef({ menu: null, query: '', index: 0 });
			const providerRef = react.useRef(null);
			const ydocRef = react.useRef(null);

			const setSlashMenu = (val) => { slashStateRef.current.menu = val; _setSlashMenu(val); };
			const setSlashQuery = (val) => {
				slashStateRef.current.query = typeof val === 'function' ? val(slashStateRef.current.query) : val;
				_setSlashQuery(slashStateRef.current.query);
			};
			const setSlashIdx = (val) => {
				slashStateRef.current.index = typeof val === 'function' ? val(slashStateRef.current.index) : val;
				_setSlashIdx(slashStateRef.current.index);
			};

			const slashItems = [
				{ label: 'Heading 1', desc: 'Large title (#)', icon: 'H1' },
				{ label: 'Heading 2', desc: 'Section title (##)', icon: 'H2' },
				{ label: 'Heading 3', desc: 'Subsection title (###)', icon: 'H3' },
				{ label: 'Task List', desc: 'Todo checkboxes ([ ])', icon: '☑' },
				{ label: 'Bullet List', desc: 'Unordered list (*, -)', icon: '•' },
				{ label: 'Numbered List', desc: 'Ordered list (1.)', icon: '1.' },
				{ label: 'Table', desc: 'Custom Rows x Columns', icon: '📊' },
				{ label: 'Callout Box', desc: 'Notion alert container', icon: '💡' },
				{ label: 'Code Block', desc: 'Syntax highlighting (\`\`\`)', icon: '</>' },
				{ label: 'Blockquote', desc: 'Capture quote (>)', icon: '❝' },
				{ label: 'YouTube Video', desc: 'Embed YouTube player', icon: '🎥' },
				{ label: 'Image', desc: 'Insert image URL', icon: '🖼️' },
				{ label: 'Divider Line', desc: 'Horizontal rule (---)', icon: '─' }
			];

			const filteredSlashItems = react.useMemo(() => {
				if (!slashQuery) return slashItems;
				const q = slashQuery.toLowerCase();
				return slashItems.filter(item => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
			}, [slashQuery]);

			const updateDocState = (editor) => {
				if (!editor || !canvasRef.current) return;
				const { selection } = editor.state;
				const text = editor.getText();
				const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
				const chars = text.length;
				setStats({ words, chars });

				if (!selection.empty && selection.from !== selection.to) {
					const coordsFrom = editor.view.coordsAtPos(selection.from);
					const coordsTo = editor.view.coordsAtPos(selection.to);
					const containerRect = canvasRef.current.getBoundingClientRect();
					const top = coordsFrom.top - containerRect.top + canvasRef.current.scrollTop - 44;
					const left = Math.max(10, Math.min(((coordsFrom.left + coordsTo.left) / 2) - containerRect.left + canvasRef.current.scrollLeft - 120, containerRect.width - 340));
					setBubbleMenu({ top, left, selectedText: editor.state.doc.textBetween(selection.from, selection.to) });
				} else {
					setBubbleMenu(null);
				}

				if (selection.empty) {
					const { $from } = selection;
					const blockText = $from.parent.textContent;
					const slashPos = blockText.lastIndexOf('/');
					if (slashPos !== -1 && slashPos === blockText.length - 1) {
						const coords = editor.view.coordsAtPos($from.pos);
						const containerRect = canvasRef.current.getBoundingClientRect();
						const top = coords.bottom - containerRect.top + canvasRef.current.scrollTop + 8;
						const left = Math.max(10, Math.min(coords.left - containerRect.left + canvasRef.current.scrollLeft, containerRect.width - 320));
						setSlashMenu({ top, left, range: { from: $from.pos - 1, to: $from.pos } });
						setSlashQuery('');
						setSlashIdx(0);
					} else if (slashStateRef.current.menu && slashPos !== -1) {
						setSlashQuery(blockText.slice(slashPos + 1));
					} else {
						setSlashMenu(null);
					}
				} else {
					setSlashMenu(null);
				}

				setIsInTable(editor.isActive('table'));
			};

			const runCommand = (cmd) => {
				if (!editorRef.current) return;
				cmd(editorRef.current.chain().focus()).run();
			};

			const executeSlashItem = (item) => {
				if (!editorRef.current) return;
				const editor = editorRef.current;
				const range = slashStateRef.current.menu?.range;
				setSlashMenu(null);
				let chain = editor.chain().focus();
				if (range) chain = chain.deleteRange(range);

				if (item.label === 'Heading 1') chain.setNode('heading', { level: 1 }).run();
				else if (item.label === 'Heading 2') chain.setNode('heading', { level: 2 }).run();
				else if (item.label === 'Heading 3') chain.setNode('heading', { level: 3 }).run();
				else if (item.label === 'Task List') chain.toggleTaskList().run();
				else if (item.label === 'Bullet List') chain.toggleBulletList().run();
				else if (item.label === 'Numbered List') chain.toggleOrderedList().run();
				else if (item.label === 'Callout Box') chain.insertContent('<blockquote class="vk_callout_box"><div class="vk_callout_icon">💡</div><div class="vk_callout_body"><p>Note: Type your highlighted callout here...</p></div></blockquote>').run();
				else if (item.label === 'Code Block') chain.toggleCodeBlock().run();
				else if (item.label === 'Blockquote') chain.toggleBlockquote().run();
				else if (item.label === 'Divider Line') chain.setHorizontalRule().run();
				else if (item.label === 'Table') setEmbedModal({ type: 'table', rows: 3, cols: 3, withHeaderRow: true });
				else if (item.label === 'YouTube Video') setEmbedModal({ type: 'youtube', url: '' });
				else if (item.label === 'Image') setEmbedModal({ type: 'image', url: '' });
			};

			const sendSelectionToAI = (text) => {
				const prompt = 'Please analyze and explain the following snippet from ' + file.name + ':\\n\\n\`\`\`\\n' + text + '\\n\`\`\`';
				const chatInput = document.querySelector('.vk_colRight textarea, textarea') || document.querySelector('.vk_colRight [contenteditable="true"], [contenteditable="true"]');
				if (chatInput) {
					if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
						try {
							const proto = chatInput.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
							const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
							if (setter) setter.call(chatInput, prompt);
							else chatInput.value = prompt;
						} catch {
							chatInput.value = prompt;
						}
					} else {
						chatInput.innerText = prompt;
						chatInput.textContent = prompt;
					}
					chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					chatInput.dispatchEvent(new Event('change', { bubbles: true }));
					chatInput.focus();
				}
			};

			react.useEffect(() => {
				const onPointerDown = (e) => {
					if (!e.target.closest('.vk_slash_menu')) setSlashMenu(null);
					if (!e.target.closest('.vk_bubble_menu')) setBubbleMenu(null);
				};
				window.addEventListener('pointerdown', onPointerDown);
				return () => window.removeEventListener('pointerdown', onPointerDown);
			}, []);

			react.useEffect(() => {
				if (!containerRef.current || !window.TipTapBundle) return;
				const {
					Editor, StarterKit, TaskList, TaskItem, Table, TableRow, TableCell, TableHeader,
					Image, Youtube, Highlight, Typography, TextAlign, Link, Color, TextStyle, CodeBlockLowlight, lowlight, Markdown,
					Collaboration, CollaborationCursor, Y, WebsocketProvider
				} = window.TipTapBundle;

				let activeUser = { name: 'Lucas', color: '#3b82f6', avatar: '👨‍💻' };
				try {
					const saved = localStorage.getItem('dsh_user_profile');
					if (saved) activeUser = JSON.parse(saved);
				} catch {}

				let ydoc = null;
				let provider = null;

				if (Y && WebsocketProvider && Collaboration && CollaborationCursor) {
					try {
						ydoc = new Y.Doc();
						ydocRef.current = ydoc;
						const room = 'doc:' + encodeURIComponent(file?.path || 'note.md');
						const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
						const wsHost = window.location.hostname || 'localhost';
						const wsUrl = wsProtocol + '//' + wsHost + ':3088';

						provider = new WebsocketProvider(wsUrl, room, ydoc);
						providerRef.current = provider;

						provider.on('status', ({ status }) => {
							setCollabConnected(status === 'connected');
						});

						provider.awareness.setLocalStateField('user', {
							name: activeUser.name,
							color: activeUser.color,
							avatar: activeUser.avatar
						});

						const onAwarenessChange = () => {
							const states = provider.awareness.getStates();
							const users = [];
							states.forEach((state, clientId) => {
								if (state.user) users.push({ clientId, ...state.user });
							});
							setCollaborators(users);
						};
						provider.awareness.on('change', onAwarenessChange);
					} catch (err) {
						console.warn('Collab WS skipped:', err);
					}
				}

				const editor = new Editor({
					element: containerRef.current,
					extensions: [
						StarterKit.configure({
							heading: { levels: [1, 2, 3, 4, 5, 6] },
							codeBlock: false,
							link: false,
							underline: false,
							history: !provider
						}),
						TaskList, TaskItem.configure({ nested: true }),
						Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
						Image, Youtube.configure({ inline: false, nocookie: true }),
						Highlight, Typography, TextAlign.configure({ types: ['heading', 'paragraph'] }),
						Link.configure({ openOnClick: false }), Color, TextStyle,
						CodeBlockLowlight.configure({ lowlight }),
						Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true }),
						...(provider ? [
							Collaboration.configure({ document: ydoc }),
							CollaborationCursor.configure({
								provider: provider,
								user: {
									name: activeUser.name,
									color: activeUser.color
								}
							})
						] : [])
					],
					content: content,
					onUpdate: ({ editor: ed }) => {
						updateDocState(ed);
						if (ed.storage && ed.storage.markdown) {
							const md = ed.storage.markdown.getMarkdown();
							onUpdateContent(md);
						}
					},
					onSelectionUpdate: ({ editor: ed }) => {
						updateDocState(ed);
					}
				});

				editorRef.current = editor;
				updateDocState(editor);

				const handleKeyDown = (e) => {
					const cur = slashStateRef.current;
					if (cur.menu) {
						const items = filteredSlashItems;
						if (e.key === 'ArrowDown') {
							e.preventDefault();
							setSlashIdx((cur.index + 1) % items.length);
						} else if (e.key === 'ArrowUp') {
							e.preventDefault();
							setSlashIdx((cur.index - 1 + items.length) % items.length);
						} else if (e.key === 'Enter') {
							e.preventDefault();
							if (items[cur.index]) executeSlashItem(items[cur.index]);
						} else if (e.key === 'Escape') {
							setSlashMenu(null);
						}
					}
					if ((e.ctrlKey || e.metaKey) && e.key === 's') {
						e.preventDefault();
						if (editor.storage && editor.storage.markdown) {
							onSave(editor.storage.markdown.getMarkdown());
						}
					}
					if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
						e.preventDefault();
						const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
						setInlineSelection(sel || editor.getText().slice(0, 300));
						setInlineAIOpen(true);
					}
					if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
						e.preventDefault();
						runCommand(c => c.undo());
					} else if (((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y'))) {
						e.preventDefault();
						runCommand(c => c.redo());
					}
				};

				containerRef.current.addEventListener('keydown', handleKeyDown, true);

				return () => {
					containerRef.current?.removeEventListener('keydown', handleKeyDown, true);
					editor.destroy();
					if (providerRef.current) {
						providerRef.current.destroy();
						providerRef.current = null;
					}
					if (ydocRef.current) {
						ydocRef.current.destroy();
						ydocRef.current = null;
					}
				};
			}, [file?.path]);

			react.useEffect(() => {
				if (editorRef.current && content !== undefined) {
					const currentMd = editorRef.current.storage?.markdown?.getMarkdown();
					if (currentMd !== content && !editorRef.current.isFocused && !providerRef.current) {
						editorRef.current.commands.setContent(content);
					}
				}
			}, [content]);

			const submitEmbedModal = (e) => {
				e.preventDefault();
				if (!embedModal) return;
				if (embedModal.type === 'youtube' && embedModal.url) {
					runCommand(c => c.setYoutubeVideo({ src: embedModal.url }));
				} else if (embedModal.type === 'image' && embedModal.url) {
					runCommand(c => c.setImage({ src: embedModal.url }));
				} else if (embedModal.type === 'table') {
					const rows = parseInt(embedModal.rows, 10) || 3;
					const cols = parseInt(embedModal.cols, 10) || 3;
					const withHeaderRow = !!embedModal.withHeaderRow;
					runCommand(c => c.insertTable({ rows, cols, withHeaderRow }));
				}
				setEmbedModal(null);
			};

			return react.createElement('div', { className: 'vk_tiptap_wrapper' }, [
				// Top Formatting Toolbar
				react.createElement('div', { key: 'toolbar', className: 'vk_tiptap_toolbar' }, [
					react.createElement('button', { key: 'save', type: 'button', className: 'vk_editBtn vk_editBtnPrimary', disabled: busy, onClick: () => {
						if (editorRef.current && editorRef.current.storage && editorRef.current.storage.markdown) {
							onSave(editorRef.current.storage.markdown.getMarkdown());
						} else {
							onSave(content);
						}
					} }, busy ? 'Saving...' : '💾 Save (Ctrl+S)'),
					react.createElement('button', { key: 'undo', type: 'button', className: 'vk_editBtn', title: 'Undo (Ctrl+Z)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.undo()) }, '↺ Undo'),
					react.createElement('button', { key: 'redo', type: 'button', className: 'vk_editBtn', title: 'Redo (Ctrl+Y / Ctrl+Shift+Z)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.redo()) }, '↻ Redo'),
					isDirty ? react.createElement('span', { key: 'dirty', className: 'vk_dirtyDot', title: 'Unsaved changes' }) : null,
					saveMsg ? react.createElement('span', { key: 'msg', className: 'vk_saveMsg' }, saveMsg) : null,
					react.createElement('span', { key: 'sep0', className: 'vk_tb_sep' }),
					react.createElement('button', { key: 'h1', type: 'button', className: 'vk_tb_tool', title: 'Heading 1 (#)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 1 })) }, 'H1'),
					react.createElement('button', { key: 'h2', type: 'button', className: 'vk_tb_tool', title: 'Heading 2 (##)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 2 })) }, 'H2'),
					react.createElement('button', { key: 'h3', type: 'button', className: 'vk_tb_tool', title: 'Heading 3 (###)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 3 })) }, 'H3'),
					react.createElement('span', { key: 'sep1', className: 'vk_tb_sep' }),
					react.createElement('button', { key: 'b', type: 'button', className: 'vk_tb_tool vk_bold', title: 'Bold (**text**)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBold()) }, 'B'),
					react.createElement('button', { key: 'i', type: 'button', className: 'vk_tb_tool vk_italic', title: 'Italic (*text*)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleItalic()) }, 'I'),
					react.createElement('button', { key: 'u', type: 'button', className: 'vk_tb_tool vk_underline', title: 'Underline', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleUnderline()) }, 'U'),
					react.createElement('button', { key: 's', type: 'button', className: 'vk_tb_tool vk_strike', title: 'Strikethrough (~~text~~)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleStrike()) }, 'S'),
					react.createElement('button', { key: 'hl', type: 'button', className: 'vk_tb_tool', title: 'Highlight (==text==)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHighlight()) }, '🎨 Mark'),
					react.createElement('span', { key: 'sep2', className: 'vk_tb_sep' }),
					react.createElement('button', { key: 'ul', type: 'button', className: 'vk_tb_tool', title: 'Bullet List (*, -)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBulletList()) }, '• List'),
					react.createElement('button', { key: 'ol', type: 'button', className: 'vk_tb_tool', title: 'Numbered List (1.)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleOrderedList()) }, '1. List'),
					react.createElement('button', { key: 'task', type: 'button', className: 'vk_tb_tool', title: 'Task List ([ ])', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleTaskList()) }, '☑ Task'),
					react.createElement('button', { key: 'table', type: 'button', className: 'vk_tb_tool', title: 'Insert Table', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'table', rows: 3, cols: 3, withHeaderRow: true }) }, '📊 Table'),
					react.createElement('button', { key: 'callout', type: 'button', className: 'vk_tb_tool', title: 'Notion Callout', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.insertContent('<blockquote class="vk_callout_box"><div class="vk_callout_icon">💡</div><div class="vk_callout_body"><p>Note: Type your highlighted callout here...</p></div></blockquote>')) }, '💡 Callout'),
					react.createElement('button', { key: 'code', type: 'button', className: 'vk_tb_tool', title: 'Code Block (\`\`\`)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleCodeBlock()) }, '</> Code'),
					react.createElement('button', { key: 'yt', type: 'button', className: 'vk_tb_tool', title: 'Embed YouTube Video', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'youtube', url: '' }) }, '🎥 YouTube'),
					react.createElement('button', { key: 'img', type: 'button', className: 'vk_tb_tool', title: 'Insert Image URL', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'image', url: '' }) }, '🖼️ Image'),
					react.createElement('span', { key: 'sep3', className: 'vk_tb_sep' }),
					react.createElement('button', { key: 'toc', type: 'button', className: 'vk_editBtn', title: 'Document Outline / Table of Contents', onClick: () => setTocOpen(true) }, '📑 Outline'),
					react.createElement('div', { key: 'export-wrap', style: { position: 'relative', display: 'inline-flex' } }, [
						react.createElement('button', { key: 'export-btn', type: 'button', className: 'vk_editBtn', title: 'Export Document', onClick: () => setExportOpen(!exportOpen) }, '📤 Export ▾'),
						exportOpen ? react.createElement('div', { key: 'export-menu', className: 'vk_ai_dropdown', style: { width: '180px' } }, [
							react.createElement('button', { key: 'exp-md', type: 'button', className: 'vk_ai_dropdown_item', onClick: () => handleExport('markdown') }, '📋 Copy Markdown'),
							react.createElement('button', { key: 'exp-html', type: 'button', className: 'vk_ai_dropdown_item', onClick: () => handleExport('html') }, '📋 Copy HTML'),
							react.createElement('button', { key: 'exp-print', type: 'button', className: 'vk_ai_dropdown_item', onClick: () => handleExport('print') }, '📄 Print / PDF Preview')
						]) : null
					]),
					react.createElement('button', { key: 'inline-ai-btn', type: 'button', className: 'vk_ai_assist_btn', title: 'Inline AI Assist (Ctrl+K)', onClick: () => { setInlineSelection(editorRef.current?.getText()?.slice(0, 300) || ""); setInlineAIOpen(true); } }, '🤖 AI (Ctrl+K)'),
					react.createElement('div', { key: 'spacer', style: { flex: 1 } }),
					collabConnected ? react.createElement('div', { key: 'collab-badge', className: 'vk_collab_pill', title: 'Real-time collaborative editing active' }, [
						react.createElement('span', { key: 'collab-dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' } }),
						'Live (' + (collaborators.length || 1) + ')',
						collaborators.length > 0 ? react.createElement('span', { key: 'collab-users', style: { marginLeft: '3px', opacity: 0.85 } },
							collaborators.map(u => u.name).join(', ')
						) : null
					]) : null,
					react.createElement('button', { key: 'raw-mode', type: 'button', className: 'vk_editBtn', title: 'Switch to Code / Shiki Source View', onClick: onToggleRawMode }, '💻 Code Source')
				]),

				// Contextual Table Bar
				isInTable ? react.createElement('div', { key: 'table-toolbar', className: 'vk_table_toolbar' }, [
					react.createElement('span', { key: 'tbl-label', style: { fontSize: '11px', fontWeight: '700', color: '#15803d', marginRight: '4px' } }, '📊 TABLE TOOLS:'),
					react.createElement('button', { key: 'row-after', type: 'button', className: 'vk_tb_table_btn', title: 'Add Row Below (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addRowAfter()) }, '➕ Row Below'),
					react.createElement('button', { key: 'row-before', type: 'button', className: 'vk_tb_table_btn', title: 'Add Row Above (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addRowBefore()) }, '➕ Row Above'),
					react.createElement('button', { key: 'col-after', type: 'button', className: 'vk_tb_table_btn', title: 'Add Column Right (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addColumnAfter()) }, '➕ Col Right'),
					react.createElement('button', { key: 'col-before', type: 'button', className: 'vk_tb_table_btn', title: 'Add Column Left (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addColumnBefore()) }, '➕ Col Left'),
					react.createElement('span', { key: 'sep-tbl', className: 'vk_tb_sep' }),
					react.createElement('button', { key: 'toggle-hdr', type: 'button', className: 'vk_tb_table_btn', title: 'Toggle Header Row', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeaderRow()) }, '🔲 Header Row'),
					react.createElement('button', { key: 'del-row', type: 'button', className: 'vk_tb_table_btn vk_tb_table_btn_danger', title: 'Delete Current Row (-)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteRow()) }, '➖ Del Row'),
					react.createElement('button', { key: 'del-col', type: 'button', className: 'vk_tb_table_btn vk_tb_table_btn_danger', title: 'Delete Current Column (-)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteColumn()) }, '➖ Del Col'),
					react.createElement('button', { key: 'del-tbl', type: 'button', className: 'vk_tb_table_btn vk_tb_table_btn_danger', title: 'Delete Entire Table', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteTable()) }, '🗑️ Delete Table')
				]) : null,

				// Canvas
				react.createElement('div', { key: 'workspace', ref: canvasRef, className: 'vk_tiptap_canvas' }, [
					react.createElement('div', { key: 'tt-container', ref: containerRef, className: 'vk_tiptap_container' }),

					// Floating Selection Bubble Menu
					bubbleMenu ? react.createElement('div', {
						key: 'bubble-menu',
						className: 'vk_bubble_menu',
						style: { top: bubbleMenu.top + 'px', left: bubbleMenu.left + 'px' }
					}, [
						react.createElement('button', { key: 'b', type: 'button', className: 'vk_bubble_btn', title: 'Bold (Ctrl+B)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBold()) }, 'B'),
						react.createElement('button', { key: 'i', type: 'button', className: 'vk_bubble_btn', title: 'Italic (Ctrl+I)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleItalic()) }, 'I'),
						react.createElement('button', { key: 'u', type: 'button', className: 'vk_bubble_btn', title: 'Underline (Ctrl+U)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleUnderline()) }, 'U'),
						react.createElement('button', { key: 's', type: 'button', className: 'vk_bubble_btn', title: 'Strikethrough', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleStrike()) }, 'S'),
						react.createElement('button', { key: 'code', type: 'button', className: 'vk_bubble_btn', title: 'Inline Code', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleCode()) }, '</>'),
						react.createElement('button', { key: 'hl', type: 'button', className: 'vk_bubble_btn', title: 'Highlight', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHighlight()) }, '🎨'),
						react.createElement('button', {
							key: 'ask-ai',
							type: 'button',
							className: 'vk_bubble_ai_btn',
							onMouseDown: (e) => e.preventDefault(),
							onClick: () => sendSelectionToAI(bubbleMenu.selectedText)
						}, '🤖 Ask AI')
					]) : null,

					// Caret-Anchored Slash Popup
					slashMenu && filteredSlashItems.length > 0 ? react.createElement('div', {
						key: 'slash-popup',
						className: 'vk_slash_menu',
						style: { top: slashMenu.top + 'px', left: slashMenu.left + 'px' }
					}, [
						react.createElement('div', { key: 'hdr', className: 'vk_slash_header' }, slashQuery ? 'Matching Commands (' + slashQuery + ')' : 'Insert Blocks & Media'),
						...filteredSlashItems.map((item, idx) => react.createElement('button', {
							key: item.label,
							type: 'button',
							className: 'vk_slash_item ' + (idx === slashIdx ? 'vk_slash_item_selected' : ''),
							onMouseDown: (e) => e.preventDefault(),
							onClick: () => executeSlashItem(item)
						}, [
							react.createElement('span', { key: 'icon', className: 'vk_slash_icon' }, item.icon),
							react.createElement('span', { key: 'label' }, item.label),
							react.createElement('span', { key: 'desc', className: 'vk_slash_desc' }, item.desc)
						]))
					]) : null,

					// Document Statistics Footer
					react.createElement('div', { key: 'doc-footer', className: 'vk_tiptap_footer' }, [
						react.createElement('span', { key: 'stat-pill', className: 'vk_stat_pill' },
							(stats.words || 0) + ' words · ' + (stats.chars || 0) + ' chars'
						)
					])
				]),

				// Table / Media Modals
				embedModal ? react.createElement('div', {
					key: 'embed-dialog-backdrop',
					className: 'dsh-modal-backdrop',
					onClick: (e) => { if (e.target === e.currentTarget) setEmbedModal(null); }
				}, react.createElement('div', { className: 'dsh-modal-card' }, [
					react.createElement('div', { key: 'hdr', className: 'dsh-modal-header' }, [
						react.createElement('span', { key: 'title', className: 'dsh-modal-title' }, embedModal.type === 'youtube' ? '🎥 Embed YouTube Video' : embedModal.type === 'image' ? '🖼️ Insert Image URL' : '📊 Insert Custom Table'),
						react.createElement('button', { key: 'close', type: 'button', className: 'dsh-modal-close', onClick: () => setEmbedModal(null) }, '×')
					]),
					react.createElement('form', { key: 'form', onSubmit: submitEmbedModal }, [
						react.createElement('div', { key: 'body', className: 'dsh-modal-body' },
							embedModal.type === 'table' ? [
								react.createElement('div', { key: 'rows-input', className: 'dsh-modal-row' }, [
									react.createElement('span', { key: 'lbl1', className: 'dsh-modal-label' }, 'Number of Rows:'),
									react.createElement('input', {
										key: 'inp-rows',
										type: 'number',
										min: 1, max: 25, required: true,
										className: 'dsh-modal-num-input',
										value: embedModal.rows,
										onChange: (e) => setEmbedModal({ ...embedModal, rows: e.target.value })
									})
								]),
								react.createElement('div', { key: 'cols-input', className: 'dsh-modal-row' }, [
									react.createElement('span', { key: 'lbl2', className: 'dsh-modal-label' }, 'Number of Columns:'),
									react.createElement('input', {
										key: 'inp-cols',
										type: 'number',
										min: 1, max: 15, required: true,
										className: 'dsh-modal-num-input',
										value: embedModal.cols,
										onChange: (e) => setEmbedModal({ ...embedModal, cols: e.target.value })
									})
								]),
								react.createElement('div', { key: 'hdr-input', className: 'dsh-modal-row' }, [
									react.createElement('span', { key: 'lbl3', className: 'dsh-modal-label' }, 'Include Header Row:'),
									react.createElement('input', {
										key: 'inp-hdr',
										type: 'checkbox',
										className: 'dsh-modal-checkbox',
										checked: embedModal.withHeaderRow,
										onChange: (e) => setEmbedModal({ ...embedModal, withHeaderRow: e.target.checked })
									})
								])
							] : [
								react.createElement('input', {
									key: 'input',
									type: 'url',
									autoFocus: true, required: true,
									placeholder: embedModal.type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/image.png',
									value: embedModal.url,
									className: 'dsh-modal-input',
									onChange: (e) => setEmbedModal({ ...embedModal, url: e.target.value })
								})
							]
						),
						react.createElement('div', { key: 'foot', className: 'dsh-modal-foot' }, [
							react.createElement('button', { key: 'cancel', type: 'button', className: 'dsh-modal-btn-cancel', onClick: () => setEmbedModal(null) }, 'Cancel (Esc)'),
							react.createElement('button', { key: 'submit', type: 'submit', className: 'dsh-modal-btn-submit' }, embedModal.type === 'youtube' ? 'Embed Video' : embedModal.type === 'image' ? 'Insert Image' : 'Insert Table')
						])
					])
				])) : null,

				// Document Outline TOC Dialog
				h(OutlineTocDropdown, {
					editor: editorRef.current,
					isOpen: tocOpen,
					onClose: () => setTocOpen(false)
				}),

				// Inline AI Assist Dialog
				h(InlineAIWidget, {
					isOpen: inlineAIOpen,
					selectionText: inlineSelection,
					onClose: () => setInlineAIOpen(false),
					onSubmit: handleInlineAISubmit
				})
			]);
		}
`;
// Inject into clientSource right before function Viewer
const viewerIndex = clientSource.indexOf('function Viewer');
if (viewerIndex !== -1) {
	clientSource = clientSource.slice(0, viewerIndex) + customComponentsCode + '\n\n' + clientSource.slice(viewerIndex);
}

// 5. Clean, Professional FileTree with VS Code Right-Click Context Menu
const fileTreeRegex = /function FileTree\(\{[\s\S]*?\n\t\t\}/;
const newFileTree = `function FileTree({ root, custom, onOpenFolder, onCloseFolder, onOpenFile, onPickNative, activePath, onDeleted, onRenamed }) {
			const [expanded, setExpanded] = react.useState(() => new Set());
			const [entries, setEntries] = react.useState(() => ({}));
			const [error, setError] = react.useState(null);
			const [picking, setPicking] = react.useState(false);
			const [draft, setDraft] = react.useState("");
			const [showHidden, setShowHidden] = react.useState(false);
			const [git, setGit] = react.useState(null);
			const [creating, setCreating] = react.useState(null);
			const [createName, setCreateName] = react.useState("");
			const [createErr, setCreateErr] = react.useState(null);
			const [renaming, setRenaming] = react.useState(null);
			const [renameErr, setRenameErr] = react.useState(null);
			const [searchOn, setSearchOn] = react.useState(false);
			const [searchQ, setSearchQ] = react.useState("");
			const [searchResults, setSearchResults] = react.useState(null);
			const [ctxMenu, setCtxMenu] = react.useState(null);
			const [deleteModal, setDeleteModal] = react.useState(null);

			react.useEffect(() => {
				setGit(null);
				if (typeof root === "string" && root.length > 0) {
					fetch("/vscode-files/git?path=" + encodeURIComponent(root))
						.then((r) => r.json())
						.then((d) => { if (d && d.ok && d.statuses) setGit(d.statuses); })
						.catch(() => {});
				}
			}, [root]);

			react.useEffect(() => {
				setExpanded(new Set());
				setEntries({});
				setError(null);
				if (typeof root === "string" && root.length > 0) load(root);
			}, [root]);

			react.useEffect(() => {
				if (ctxMenu === null) return;
				const onDown = (e) => {
					if (e.target instanceof Element && e.target.closest("[data-vk-menu]")) return;
					setCtxMenu(null);
				};
				window.addEventListener("pointerdown", onDown);
				return () => window.removeEventListener("pointerdown", onDown);
			}, [ctxMenu]);

			function load(path) {
				fetch("/vscode-files/list?path=" + encodeURIComponent(path))
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) setEntries((m) => ({ ...m, [path]: d }));
						else setError((d && d.error) || "Load failed");
					})
					.catch((e) => setError(String(e)));
			}

			function toggle(path) {
				const next = new Set(expanded);
				if (next.has(path)) next.delete(path);
				else {
					next.add(path);
					if (entries[path] === void 0) load(path);
				}
				setExpanded(next);
			}

			function rel(p) {
				if (typeof root !== "string") return null;
				if (p === root) return "";
				if (p.startsWith(root + "\\\\") || p.startsWith(root + "/")) return p.slice(root.length + 1).replace(/\\\\/g, "/");
				return null;
			}

			function badgeOf(code) {
				if (code === "??") return { text: "U", cls: " vk_gitBadgeUntracked" };
				if (code === "M") return { text: "M", cls: " vk_gitBadgeModified" };
				if (code === "A") return { text: "A", cls: " vk_gitBadgeAdded" };
				if (code === "D") return { text: "D", cls: " vk_gitBadgeDeleted" };
				if (code === "R") return { text: "R", cls: " vk_gitBadgeRenamed" };
				return { text: code, cls: "" };
			}

			async function executeDelete(p) {
				try {
					const r = await fetch("/vscode-files/delete", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: p })
					});
					const d = await r.json();
					if (d && d.ok) {
						if (typeof root === "string") load(root);
						if (onDeleted) onDeleted(p);
					} else {
						setError((d && d.error) || "Delete failed");
					}
				} catch (e) {
					setError(String(e));
				}
			}

			function doDelete(p, name) {
				setDeleteModal({ path: p, name });
			}

			async function commitCreate() {
				if (creating === null) return;
				const name = createName.trim();
				if (name.length === 0) return;
				const parent = creating.parentPath || (typeof root === "string" ? root : "");
				const endpoint = creating.type === "dir" ? "/vscode-files/mkdir" : "/vscode-files/mkfile";
				try {
					const r = await fetch(endpoint, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: parent, name })
					});
					const d = await r.json();
					if (d && d.ok) {
						setCreating(null);
						setCreateName("");
						setCreateErr(null);
						if (typeof root === "string") load(root);
						if (parent && parent !== root) load(parent);
						if (creating.type === "file" && onOpenFile) onOpenFile({ path: d.path, name });
					} else {
						setCreateErr((d && d.error) || "Create failed");
					}
				} catch (e) {
					setCreateErr(String(e));
				}
			}

			async function commitRename(newName) {
				if (renaming === null) return;
				const val = newName.trim();
				if (val.length === 0 || val === renaming.name) {
					setRenaming(null);
					setRenameErr(null);
					return;
				}
				try {
					const r = await fetch("/vscode-files/rename", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: renaming.path, newName: val })
					});
					const d = await r.json();
					if (d && d.ok) {
						const oldP = renaming.path;
						const newP = d.path;
						setRenaming(null);
						setRenameErr(null);
						if (typeof root === "string") load(root);
						if (onRenamed) onRenamed(oldP, newP, val);
					} else {
						setRenameErr((d && d.error) || "Rename failed");
					}
				} catch (e) {
					setRenameErr(String(e));
				}
			}

			function rows(dir, depth) {
				if (!dir || !dir.ok) return [];
				const list = [];
				for (const d of dir.dirs) {
					if (d.hidden && !showHidden) continue;
					const exp = expanded.has(d.path);
					const badge = git ? (git[rel(d.path) || ""] ? badgeOf(git[rel(d.path) || ""]) : null) : null;
					list.push(renderRow({
						key: d.path,
						path: d.path,
						name: d.name,
						isDir: true,
						expanded: exp,
						depth,
						hidden: d.hidden,
						badge,
						onToggle: () => toggle(d.path)
					}));
					if (exp && entries[d.path]) {
						list.push(...rows(entries[d.path], depth + 1));
					}
				}
				for (const f of dir.files) {
					if (f.hidden && !showHidden) continue;
					const badge = git ? (git[rel(f.path) || ""] ? badgeOf(git[rel(f.path) || ""]) : null) : null;
					list.push(renderRow({
						key: f.path,
						path: f.path,
						name: f.name,
						isDir: false,
						depth,
						hidden: f.hidden,
						active: activePath === f.path,
						badge,
						onToggle: () => onOpenFile({ path: f.path, name: f.name })
					}));
				}
				return list;
			}

			function renderRow(props) {
				const pad = { paddingLeft: 12 + props.depth * 14 + "px" };
				if (renaming !== null && renaming.path === props.path) {
					return h(RenameRow, {
						key: props.key,
						pad,
						initialName: renaming.name,
						error: renameErr,
						onCommit: (value) => commitRename(value),
						onCancel: () => { setRenaming(null); setRenameErr(null); }
					});
				}
				const caret = props.isDir ? h("span", { className: "vk_caret" }, props.expanded ? "▾" : "▸") : h("span", { className: "vk_caret" }, "\u00A0");
				const guides = [];
				for (let i = 0; i < props.depth; i++) guides.push(h("span", { key: "g" + i, className: "vk_guide", style: { left: 17 + i * 14 + "px" } }));
				const icon = props.isDir
					? h(FileTypeIcon, { symbolId: props.expanded ? "fti-FolderOpen" : "fti-Folder" })
					: h(FileTypeIcon, { symbolId: fileIconId(props.name, "file", false) });
				const name = h("span", { className: "vk_name" + (props.isDir ? " vk_dirName" : "") }, props.name);
				const badge = props.badge ? h("span", { className: "vk_gitBadge" + props.badge.cls }, props.badge.text) : null;

				return h("div", {
					key: props.key,
					className: "vk_row" + (props.hidden ? " vk_rowHidden" : "") + (props.active ? " vk_rowActive" : ""),
					style: pad,
					onClick: props.onToggle,
					onContextMenu: (e) => {
						e.preventDefault();
						e.stopPropagation();
						setCtxMenu({ x: e.clientX, y: e.clientY, item: props });
					}
				}, guides, caret, icon, name, badge);
			}

			function commitFolder() {
				const p = draft.trim();
				setPicking(false);
				setDraft("");
				if (p.length > 0) onOpenFolder(p);
			}

			const title = typeof root === "string" && root.length > 0 && root !== "." ? (root.split(/[\\\\/]/).pop() || root) : "EXPLORER";
			const head = h("div", { className: "vk_treeHead" },
				h("span", { className: "vk_treeTitle", title: typeof root === "string" ? root : "" }, title),
				h("button", { className: "vk_treeBtn", title: "Open Folder", onClick: async () => {
					try {
						const p = await onPickNative();
						if (typeof p === "string" && p.length > 0) onOpenFolder(p);
					} catch {
						setPicking(true);
						setDraft("");
					}
				} }, "📂"),
				h("button", { className: "vk_treeBtn" + (showHidden ? " vk_treeBtnActive" : ""), title: showHidden ? "Hide Hidden Files" : "Show Hidden Files (.git, node_modules, etc.)", onClick: () => setShowHidden((v) => !v) }, "👁"),
				h("button", { className: "vk_treeBtn", title: "Enter Path Manually", onClick: () => { setPicking(true); setDraft(""); } }, "✏️"),
				h("button", { className: "vk_treeBtn" + (creating !== null ? " vk_treeBtnActive" : ""), title: "New File / Folder", onClick: () => { setCreating(creating === null ? { type: "file", parentPath: typeof root === "string" ? root : "" } : null); setCreateName(""); setCreateErr(null); } }, "＋"),
				h("button", { className: "vk_treeBtn" + (searchOn ? " vk_treeBtnActive" : ""), title: "Search Files", onClick: () => { setSearchOn(!searchOn); setSearchQ(""); } }, "🔍"),
				custom ? h("button", { className: "vk_treeBtn", title: "Reset to Workspace Folder", onClick: onCloseFolder }, "×") : null
			);

			const picker = picking ? h("div", { className: "vk_pickForm" },
				h("input", {
					className: "vk_pickInput",
					placeholder: "Enter directory path...",
					value: draft,
					autoFocus: true,
					onChange: (e) => setDraft(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") commitFolder();
						if (e.key === "Escape") { setPicking(false); setDraft(""); }
					}
				}),
				h("div", { className: "vk_pickRow" },
					h("button", { className: "vk_pickBtn", onClick: commitFolder }, "Open"),
					h("button", { className: "vk_pickBtn", onClick: () => { setPicking(false); setDraft(""); } }, "Cancel")
				)
			) : null;

			const createForm = creating !== null ? h("div", { className: "vk_pickForm" },
				h("div", { className: "vk_pickRow" },
					h("button", { className: "vk_pickBtn" + (creating.type === "file" ? " vk_modeBtn" : ""), onClick: () => setCreating({ ...creating, type: "file" }) }, "New File"),
					h("button", { className: "vk_pickBtn" + (creating.type === "dir" ? " vk_modeBtn" : ""), onClick: () => setCreating({ ...creating, type: "dir" }) }, "New Folder")
				),
				h("input", {
					className: "vk_pickInput",
					placeholder: (creating.type === "dir" ? "Folder name" : "File name") + (creating.parentPath && creating.parentPath !== root ? " in " + (creating.parentPath.split(/[\\\\/]/).pop() || "") : ""),
					value: createName,
					autoFocus: true,
					onChange: (e) => setCreateName(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") commitCreate();
						if (e.key === "Escape") { setCreating(null); setCreateName(""); setCreateErr(null); }
					}
				}),
				createErr !== null ? h("span", { className: "vk_saveMsg" }, createErr) : null,
				h("div", { className: "vk_pickRow" },
					h("button", { className: "vk_pickBtn", onClick: commitCreate }, "Create"),
					h("button", { className: "vk_pickBtn", onClick: () => { setCreating(null); setCreateName(""); setCreateErr(null); } }, "Cancel")
				)
			) : null;

			const searchForm = searchOn ? h("div", { className: "vk_pickForm" },
				h("input", {
					className: "vk_pickInput",
					placeholder: "Search files... (Enter to open first match)",
					value: searchQ,
					autoFocus: true,
					onChange: (e) => setSearchQ(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Escape") { setSearchOn(false); setSearchQ(""); }
						if (e.key === "Enter" && searchResults !== null && searchResults.length > 0) {
							const first = searchResults[0];
							onOpenFile({ path: first.path, name: first.name });
							setSearchOn(false);
							setSearchQ("");
						}
					}
				})
			) : null;

			const dir = typeof root === "string" && root.length > 0 ? entries[root] : void 0;
			const body = (() => {
				if (searchOn && searchQ.trim().length > 0) {
					if (searchResults === null) return h("div", { className: "vk_empty" }, "Searching...");
					if (searchResults.length === 0) return h("div", { className: "vk_empty" }, "No matching files found");
					return searchResults.map((r) => h("div", { key: r.path, className: "vk_row", style: { paddingLeft: "10px" }, onClick: () => { onOpenFile({ path: r.path, name: r.name }); setSearchOn(false); setSearchQ(""); } },
						h("span", { className: "vk_caret" }, "\u00A0"),
						h(FileTypeIcon, { symbolId: fileIconId(r.name, "file", false) }),
						h("span", { className: "vk_name vk_nameFixed" }, r.name),
						h("span", { className: "vk_relPath" }, r.rel)
					));
				}
				if (typeof root !== "string" || root.length === 0) return h("div", { className: "vk_empty" }, "No workspace active\\nSelect a Quest or open a folder to explore");
				if (error !== null) return h("div", { className: "vk_err" }, error);
				if (dir === void 0) return h("div", { className: "vk_empty" }, "Loading files...");
				if (dir.ok) {
					const hiddenCount = showHidden ? 0 : dir.dirs.filter((d) => d.hidden).length + dir.files.filter((f) => f.hidden).length;
					return [...rows(dir, 0), hiddenCount > 0 ? h("div", { key: "__hiddenHint", className: "vk_hiddenHint" }, "⋯ " + hiddenCount + " hidden items collapsed (click 👁 to show)") : null];
				}
				return h("div", { className: "vk_err" }, dir.error || "Unable to read directory");
			})();

			const menuItem = (label, action, danger) => h("button", {
				key: label,
				className: "vk_menuItem" + (danger ? " vk_menuItemDanger" : ""),
				onClick: () => { setCtxMenu(null); action(); }
			}, label);

			return h("div", {
				className: "vk_treeWrap",
				onContextMenu: (e) => {
					if (e.target instanceof Element && e.target.closest(".vk_row")) return;
					e.preventDefault();
					setCtxMenu({ x: e.clientX, y: e.clientY, item: null });
				}
			},
				head, picker, createForm, searchForm,
				h("div", { className: "vk_tree" }, body),
				ctxMenu !== null ? h("div", {
					className: "vk_menu",
					"data-vk-menu": true,
					style: { left: Math.min(ctxMenu.x, window.innerWidth - 220) + "px", top: Math.min(ctxMenu.y, window.innerHeight - 260) + "px" }
				},
					ctxMenu.item ? [
						!ctxMenu.item.isDir ? menuItem("📄 Open File", () => onOpenFile({ path: ctxMenu.item.path, name: ctxMenu.item.name })) : null,
						ctxMenu.item.isDir ? menuItem("📄 New File...", () => { setCreating({ type: "file", parentPath: ctxMenu.item.path }); setCreateName(""); setCreateErr(null); }) : null,
						ctxMenu.item.isDir ? menuItem("📁 New Folder...", () => { setCreating({ type: "dir", parentPath: ctxMenu.item.path }); setCreateName(""); setCreateErr(null); }) : null,
						menuItem("✏️ Rename (F2)", () => { setRenaming({ path: ctxMenu.item.path, name: ctxMenu.item.name, oldName: ctxMenu.item.name }); setRenameErr(null); }),
						menuItem("🗑️ Move to Trash (Delete)", () => doDelete(ctxMenu.item.path, ctxMenu.item.name), true),
						menuItem("📋 Copy Path", () => { navigator.clipboard?.writeText(ctxMenu.item.path); }),
						menuItem("📋 Copy Relative Path", () => { navigator.clipboard?.writeText(rel(ctxMenu.item.path) || ctxMenu.item.name); }),
						!ctxMenu.item.isDir ? menuItem("🤖 Ask AI About This File", () => {
							const prompt = "Please analyze and explain the file: " + ctxMenu.item.name;
							const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
							if (chatInput) {
								if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
									chatInput.value = prompt;
									chatInput.dispatchEvent(new Event('input', { bubbles: true }));
								} else {
									chatInput.innerText = prompt;
									chatInput.dispatchEvent(new Event('input', { bubbles: true }));
								}
								chatInput.focus();
							}
						}) : null
					] : [
						menuItem("📄 New File...", () => { setCreating({ type: "file", parentPath: typeof root === "string" ? root : "" }); setCreateName(""); setCreateErr(null); }),
						menuItem("📁 New Folder...", () => { setCreating({ type: "dir", parentPath: typeof root === "string" ? root : "" }); setCreateName(""); setCreateErr(null); }),
						menuItem("🔄 Refresh Explorer", () => { if (root) load(root); })
					]
				) : null,
				h(UnsavedChangesModal, {
					isOpen: !!deleteModal,
					isDanger: true,
					title: "Move to Trash?",
					fileName: deleteModal?.name,
					message: "Are you sure you want to move " + (deleteModal?.name || "this item") + " to Trash?",
					dontSaveLabel: "Move to Trash",
					onDontSave: () => {
						const target = deleteModal;
						setDeleteModal(null);
						if (target) executeDelete(target.path);
					},
					onCancel: () => setDeleteModal(null)
				})
			);
		}`;
clientSource = clientSource.replace(fileTreeRegex, () => newFileTree);

// 6. Viewer: English strings & Direct TipTap WYSIWYG for Markdown files
clientSource = clientSource.replace(
	'function Viewer({ file, rev, onStartEdit }) {',
	`function Viewer({ file, rev, onStartEdit, onSaveDirect, onUpdateDirect, isDirectDirty, saveMsg, busy }) {
			const [forceRaw, setForceRaw] = react.useState(false);
			const isMarkdown = (file.path.endsWith(".md") || file.path.endsWith(".markdown")) && !forceRaw;`
);

clientSource = clientSource.replace(
	'if (state.loading) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "加载中…"));',
	`if (state.loading) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "Loading file..."));
			if (isMarkdown && state.kind === "text") {
				return h(TipTapNotionEditor, {
					file,
					content: state.content,
					isDirty: isDirectDirty || false,
					onUpdateContent: (text) => onUpdateDirect ? onUpdateDirect(text, file?.path) : onStartEdit(text),
					onSave: (text) => onSaveDirect ? onSaveDirect(text, file?.path) : onStartEdit(text),
					onCancel: () => {},
					busy: busy || false,
					saveMsg: saveMsg || null,
					onToggleRawMode: () => setForceRaw(true)
				});
			}`
);

clientSource = clientSource.replace('if (state.error !== void 0) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "读取失败：\\n" + state.error));', 'if (state.error !== void 0) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "Failed to read file:\\n" + state.error));');
clientSource = clientSource.replace('if (state.kind === "binary") return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "二进制文件，无法预览\\n（" + state.size + " 字节）"));', 'if (state.kind === "binary") return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "Binary file, preview unavailable\\n(" + state.size + " bytes)"));');
clientSource = clientSource.replace('const head = "文件过大，仅显示前 2 MB（超大文件暂不支持编辑）\\n\\n";', 'const head = "File too large, showing first 2 MB (large files are read-only)\\n\\n";');
clientSource = clientSource.replace('editable ? h("button", { className: "vk_editBtn", title: "编辑此文件（Ctrl+S 保存）", onClick: () => onStartEdit(state.content) }, "✏️ 编辑") : null,', 'editable ? h("button", { className: "vk_editBtn", title: "Edit File (Ctrl+S to save)", onClick: () => onStartEdit(state.content) }, "✏️ Edit") : null,');

// 7. Full-Featured EditorArea with In-Editor Find & Replace (Ctrl+F / Ctrl+H)
const editorAreaRegex = /function EditorArea\(\{[\s\S]*?\n\t\t\}/;
const newEditorArea = `function EditorArea({ tabs, activePath, onSelect, onClose, onMoveTab, trajectory }) {
			const hasTabs = tabs.length > 0;
			const active = hasTabs ? (tabs.find((t) => t.path === activePath) ?? tabs[tabs.length - 1]) : null;
			const currentPath = active !== null ? active.path : null;
			const [edits, setEdits] = react.useState({});
			const [revisions, setRevisions] = react.useState({});
			const [initialContent, setInitialContent] = react.useState({});
			const [busy, setBusy] = react.useState(false);
			const [saveMsg, setSaveMsg] = react.useState(null);
			const [dragged, setDragged] = react.useState(null);
			const [ctxMenu, setCtxMenu] = react.useState(null);
			const [showDiff, setShowDiff] = react.useState(false);
			const [pendingUnsaved, setPendingUnsaved] = react.useState(null);

			// Auto-Save Engine (1.5s debounce, persisted in localStorage)
			const [autoSave, setAutoSave] = react.useState(() => {
				try { return localStorage.getItem("vk_autosave") !== "false"; } catch { return true; }
			});

			const toggleAutoSave = () => {
				setAutoSave((prev) => {
					const next = !prev;
					try { localStorage.setItem("vk_autosave", String(next)); } catch {}
					return next;
				});
			};

			// Inline AI state for raw text editor
			const [rawInlineAIOpen, setRawInlineAIOpen] = react.useState(false);
			const [rawInlineSelection, setRawInlineSelection] = react.useState("");

			const handleRawInlineAISubmit = (instruction, selText) => {
				const activeName = active?.name || "code";
				const prompt = 'Please assist with the following snippet from ' + activeName + ':\\n\\n\`\`\`\\n' + (selText || edits[currentPath]?.text || "") + '\\n\`\`\`\\n\\nInstruction: ' + instruction;
				const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
				if (chatInput) {
					if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
						chatInput.value = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					} else {
						chatInput.innerText = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					}
					chatInput.focus();
				}
			};

			// History stack for raw text editor
			const historyStateRef = react.useRef({});

			const getHistory = (p) => {
				if (!historyStateRef.current[p]) {
					historyStateRef.current[p] = { past: [], future: [] };
				}
				return historyStateRef.current[p];
			};

			const handleUndo = react.useCallback(() => {
				if (!currentPath) return;
				const h = getHistory(currentPath);
				if (h.past.length === 0) return;
				const prevText = h.past.pop();
				const curText = edits[currentPath]?.text;
				if (curText !== undefined) h.future.push(curText);
				setEdits((prev) => ({ ...prev, [currentPath]: { text: prevText, dirty: true } }));
			}, [currentPath, edits]);

			const handleRedo = react.useCallback(() => {
				if (!currentPath) return;
				const h = getHistory(currentPath);
				if (h.future.length === 0) return;
				const nextText = h.future.pop();
				const curText = edits[currentPath]?.text;
				if (curText !== undefined) h.past.push(curText);
				setEdits((prev) => ({ ...prev, [currentPath]: { text: nextText, dirty: true } }));
			}, [currentPath, edits]);

			// In-Editor Find & Replace state (Ctrl+F / Ctrl+H)
			const [findOpen, setFindOpen] = react.useState(false);
			const [replaceOpen, setReplaceOpen] = react.useState(false);
			const [findMatchCount, setFindMatchCount] = react.useState(0);
			const [findActiveIndex, setFindActiveIndex] = react.useState(0);

			react.useEffect(() => {
				const onKeyDown = (e) => {
					if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F") && !e.shiftKey) {
						e.preventDefault();
						setFindOpen(true);
						setReplaceOpen(false);
					} else if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "H")) {
						e.preventDefault();
						setFindOpen(true);
						setReplaceOpen(true);
					} else if (e.key === "Escape" && findOpen) {
						setFindOpen(false);
					}
				};
				window.addEventListener("keydown", onKeyDown);
				return () => window.removeEventListener("keydown", onKeyDown);
			}, [findOpen]);

			react.useEffect(() => {
				if (ctxMenu === null) return;
				const onDown = (e) => {
					if (e.target instanceof Element && e.target.closest("[data-vk-menu]")) return;
					setCtxMenu(null);
				};
				const onKey = (e) => { if (e.key === "Escape") setCtxMenu(null); };
				document.addEventListener("mousedown", onDown, true);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, [ctxMenu]);

			react.useEffect(() => {
				if (typeof document === "undefined") return;
				const cur = currentPath;
				if (cur === null || cur === TRAJECTORY_TAB_PATH) return;
				const onKey = (e) => {
					if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
						e.preventDefault();
						save();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			});

			const onEditText = react.useCallback((text, explicitPath) => {
				const targetPath = explicitPath || currentPath;
				if (!targetPath || typeof text !== "string") return;
				const curText = edits[targetPath]?.text;
				if (curText !== undefined && curText !== text) {
					const h = getHistory(targetPath);
					h.past.push(curText);
					if (h.past.length > 80) h.past.shift();
					h.future = [];
				}
				setEdits((prev) => ({ ...prev, [targetPath]: { text, dirty: true } }));
			}, [currentPath, edits]);

			const saveWithText = react.useCallback(async (textToSave, explicitPath) => {
				const targetPath = explicitPath || currentPath;
				if (!targetPath || typeof textToSave !== "string" || busy) return;
				setBusy(true);
				setSaveMsg("Saving...");
				try {
					const r = await fetch("/vscode-files/write", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: targetPath, content: textToSave })
					});
					const d = await r.json();
					if (d && d.ok) {
						setEdits((prev) => {
							const next = { ...prev };
							delete next[targetPath];
							return next;
						});
						setInitialContent((prev) => ({ ...prev, [targetPath]: textToSave }));
						setRevisions((prev) => ({ ...prev, [targetPath]: (prev[targetPath] ?? 0) + 1 }));
						setSaveMsg("Saved");
						setTimeout(() => setSaveMsg(null), 2000);
					} else {
						setSaveMsg("Save failed: " + ((d && d.error) || "unknown"));
					}
				} catch (e) {
					setSaveMsg("Save failed: " + String(e));
				} finally {
					setBusy(false);
				}
			}, [currentPath, busy]);

			const save = react.useCallback(async () => {
				const edit = edits[currentPath];
				if (edit === void 0 || typeof edit.text !== "string" || busy) return;
				saveWithText(edit.text, currentPath);
			}, [currentPath, edits, busy, saveWithText]);

			// Auto-Save debounced effect (1.5s)
			react.useEffect(() => {
				if (!autoSave || currentPath === null) return;
				const edit = edits[currentPath];
				if (!edit || !edit.dirty || typeof edit.text !== "string" || busy) return;
				const timer = setTimeout(() => {
					saveWithText(edit.text, currentPath);
				}, 1500);
				return () => clearTimeout(timer);
			}, [autoSave, edits, currentPath, busy, saveWithText]);

			const doCancel = (path) => {
				setEdits((prev) => {
					const next = { ...prev };
					delete next[path];
					return next;
				});
				setSaveMsg(null);
			};

			const requestCancel = react.useCallback(() => {
				if (currentPath === null) return;
				const edit = edits[currentPath];
				if (edit !== void 0 && edit.dirty) {
					setPendingUnsaved({ type: "cancel", path: currentPath, name: active?.name || currentPath, text: edit.text });
					return;
				}
				doCancel(currentPath);
			}, [currentPath, edits, active]);

			const doCloseTab = (path) => {
				setEdits((prev) => {
					if (!(path in prev)) return prev;
					const next = { ...prev };
					delete next[path];
					return next;
				});
				onClose(path);
			};

			const requestCloseTab = react.useCallback((path) => {
				const edit = edits[path];
				if (edit !== void 0 && edit.dirty) {
					const tab = tabs.find(t => t.path === path);
					setPendingUnsaved({ type: "single", path, name: tab?.name || path, text: edit.text });
					return;
				}
				doCloseTab(path);
			}, [edits, onClose, tabs]);

			const doClosePaths = (paths) => {
				setEdits((prev) => {
					const next = { ...prev };
					for (const p of paths) delete next[p];
					return next;
				});
				for (const p of paths) onClose(p);
			};

			const requestClosePaths = react.useCallback((paths) => {
				const dirtyPaths = paths.filter(p => edits[p]?.dirty);
				if (dirtyPaths.length > 0) {
					const first = dirtyPaths[0];
					const tab = tabs.find(t => t.path === first);
					setPendingUnsaved({ type: "paths", path: first, paths, name: tab?.name || first, text: edits[first]?.text });
					return;
				}
				doClosePaths(paths);
			}, [edits, onClose, tabs]);

			const handleModalSave = async () => {
				if (!pendingUnsaved) return;
				const target = pendingUnsaved;
				if (target.text !== undefined) {
					await saveWithText(target.text, target.path);
				}
				setPendingUnsaved(null);
				if (target.type === "single") doCloseTab(target.path);
				else if (target.type === "paths") doClosePaths(target.paths);
				else if (target.type === "cancel") doCancel(target.path);
			};

			const handleModalDontSave = () => {
				if (!pendingUnsaved) return;
				const target = pendingUnsaved;
				setPendingUnsaved(null);
				if (target.type === "single") doCloseTab(target.path);
				else if (target.type === "paths") doClosePaths(target.paths);
				else if (target.type === "cancel") doCancel(target.path);
			};

			const handleModalCancel = () => {
				setPendingUnsaved(null);
			};

			const startEdit = react.useCallback((text) => {
				if (currentPath === null) return;
				setInitialContent((prev) => ({ ...prev, [currentPath]: text }));
				setEdits((prev) => ({ ...prev, [currentPath]: { text, dirty: false } }));
			}, [currentPath]);

			// Find / Replace helpers
			const handleFindNext = react.useCallback((findVal, direction = 1, opts = {}) => {
				if (!findVal || currentPath === null) {
					setFindMatchCount(0);
					setFindActiveIndex(0);
					return;
				}
				const currentText = edits[currentPath]?.text;
				if (typeof currentText !== "string") return;
				let regex;
				try {
					const flags = opts.matchCase ? "g" : "gi";
					const pattern = opts.isRegex ? findVal : (opts.wholeWord ? ("\\\\b" + findVal + "\\\\b") : findVal.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&"));
					regex = new RegExp(pattern, flags);
				} catch {
					return;
				}
				const matches = [];
				let m;
				while ((m = regex.exec(currentText)) !== null) {
					matches.push({ index: m.index, length: m[0].length });
					if (!regex.global) break;
				}
				setFindMatchCount(matches.length);
				if (matches.length > 0) {
					setFindActiveIndex((prev) => {
						const nextIdx = (prev + direction + matches.length) % matches.length;
						return nextIdx;
					});
				} else {
					setFindActiveIndex(0);
				}
			}, [currentPath, edits]);

			const handleFindPrev = react.useCallback((findVal, opts) => {
				handleFindNext(findVal, -1, opts);
			}, [handleFindNext]);

			const handleReplace = react.useCallback((findVal, replaceVal, opts = {}) => {
				if (!findVal || currentPath === null) return;
				const currentText = edits[currentPath]?.text;
				if (typeof currentText !== "string") return;
				try {
					const flags = opts.matchCase ? "" : "i";
					const pattern = opts.isRegex ? findVal : (opts.wholeWord ? ("\\\\b" + findVal + "\\\\b") : findVal.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&"));
					const regex = new RegExp(pattern, flags);
					const newText = currentText.replace(regex, replaceVal);
					onEditText(newText);
					handleFindNext(findVal, 0, opts);
				} catch {}
			}, [currentPath, edits, onEditText, handleFindNext]);

			const handleReplaceAll = react.useCallback((findVal, replaceVal, opts = {}) => {
				if (!findVal || currentPath === null) return;
				const currentText = edits[currentPath]?.text;
				if (typeof currentText !== "string") return;
				try {
					const flags = opts.matchCase ? "g" : "gi";
					const pattern = opts.isRegex ? findVal : (opts.wholeWord ? ("\\\\b" + findVal + "\\\\b") : findVal.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&"));
					const regex = new RegExp(pattern, flags);
					const newText = currentText.replace(regex, replaceVal);
					onEditText(newText);
					handleFindNext(findVal, 0, opts);
				} catch {}
			}, [currentPath, edits, onEditText, handleFindNext]);

			if (!hasTabs) {
				return h("div", { className: "vk_editor" },
					h("div", { className: "vk_empty" }, "Select a file from the Explorer\\n(Click any file to view and edit in tabs)")
				);
			}

			const menuItem = (label, action, danger) => h("button", {
				key: label,
				className: "vk_menuItem" + (danger ? " vk_menuItemDanger" : ""),
				onClick: () => { setCtxMenu(null); action(); }
			}, label);

			const isMarkdown = active !== null && (active.path.endsWith(".md") || active.path.endsWith(".markdown"));
			const editing = currentPath !== null && edits[currentPath] !== void 0;
			const isTraj = active !== null && active.path === TRAJECTORY_TAB_PATH;

			const handleAIAssist = (actionType) => {
				if (!active) return;
				const promptMap = {
					explain: 'Please analyze and explain the file "' + active.name + '" in detail, outlining its architecture, key functions, and data flow.',
					tests: 'Please write a comprehensive suite of unit tests for the file "' + active.name + '" using modern testing best practices.',
					refactor: 'Please analyze the file "' + active.name + '" and suggest clean refactorings, optimizations, and modern code improvements.',
					docs: 'Please add comprehensive documentation, JSDoc comments, and clear markdown explanations for "' + active.name + '".',
					review: 'Please perform a thorough code review on "' + active.name + '", identifying potential bugs, edge cases, security vulnerabilities, or performance bottlenecks.'
				};
				const prompt = promptMap[actionType] || ('Please assist me with ' + active.name);
				const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
				if (chatInput) {
					if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
						chatInput.value = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					} else {
						chatInput.innerText = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					}
					chatInput.focus();
				}
			};

			return h("div", { className: "vk_editor" },
				h("div", { className: "vk_tabStrip" },
					tabs.map((t) => {
						const isAct = t.path === currentPath;
						const isDirty = edits[t.path]?.dirty === true;
						return h("div", {
							key: t.path,
							className: "vk_fileTab" + (isAct ? " vk_fileTabActive" : "") + (dragged === t.path ? " vk_fileTabDragging" : ""),
							draggable: true,
							onDragStart: (e) => { e.dataTransfer.setData("text/plain", t.path); setDragged(t.path); },
							onDragEnd: () => setDragged(null),
							onDragOver: (e) => { e.preventDefault(); },
							onDrop: (e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (from && from !== t.path) onMoveTab(from, t.path); },
							onClick: () => onSelect(t.path),
							onAuxClick: (e) => { if (e.button === 1) { e.preventDefault(); requestCloseTab(t.path); } },
							onContextMenu: (e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, path: t.path }); }
						},
							h(FileTypeIcon, { symbolId: fileIconId(t.name, "file", false) }),
							h("span", { className: "vk_tabName" }, t.name),
							isDirty ? h("span", { className: "vk_dirtyDot vk_tabDot", title: "Unsaved changes" }) : null,
							h("button", { className: "vk_tabClose", title: "Close Tab", onClick: (e) => { e.stopPropagation(); requestCloseTab(t.path); } }, "×")
						);
					})
				),
				h(Breadcrumb, { path: active?.path }),
				h(FindWidget, {
					isOpen: findOpen,
					isReplace: replaceOpen,
					onClose: () => setFindOpen(false),
					onToggleReplace: () => setReplaceOpen(!replaceOpen),
					matchCount: findMatchCount,
					activeIndex: findActiveIndex,
					onFindNext: handleFindNext,
					onFindPrev: handleFindPrev,
					onReplace: handleReplace,
					onReplaceAll: handleReplaceAll
				}),
				isTraj
					? h("div", { className: "vk_editorBody vk_trajBody" }, trajectory ?? h("div", { className: "vk_notice" }, "Trajectory view unavailable"))
					: (isMarkdown && editing)
						? h(TipTapNotionEditor, {
							file: active,
							content: edits[active.path].text,
							isDirty: edits[active.path].dirty === true,
							onUpdateContent: onEditText,
							onSave: (txt) => saveWithText(txt),
							onCancel: requestCancel,
							busy,
							saveMsg,
							onToggleRawMode: requestCancel
						})
						: (editing && !isMarkdown)
							? h(react.Fragment, null,
								h("div", { className: "vk_bar" },
									h("span", { className: "vk_barPath" }, active.path),
									h("button", { className: "vk_editBtn vk_editBtnPrimary", disabled: busy, title: "Save (Ctrl+S)", onClick: save }, "💾 Save"),
									h("button", { className: "vk_editBtn", disabled: busy, title: "Undo (Ctrl+Z)", onClick: handleUndo }, "↺ Undo"),
									h("button", { className: "vk_editBtn", disabled: busy, title: "Redo (Ctrl+Y / Ctrl+Shift+Z)", onClick: handleRedo }, "↻ Redo"),
									h("button", { className: "vk_editBtn" + (showDiff ? " vk_editBtnPrimary" : ""), disabled: busy, title: "Toggle Diff View", onClick: () => setShowDiff(!showDiff) }, "⚡ Diff"),
									h(AIAssistDropdown, { onAction: handleAIAssist }),
									h("button", { className: "vk_editBtn", disabled: busy, title: "Cancel Edit (Esc)", onClick: requestCancel }, "✕ Cancel"),
									edits[active.path]?.dirty ? h("span", { className: "vk_dirtyDot", title: "Unsaved changes" }) : null,
									saveMsg ? h("span", { className: "vk_saveMsg" }, saveMsg) : h("span", { className: "vk_saveMsg" }, "Edit Mode")
								),
								showDiff
									? h(DiffViewer, {
										oldText: initialContent[active.path] || "",
										newText: edits[active.path]?.text || "",
										fileName: active.name,
										onAccept: () => { save(); setShowDiff(false); },
										onDiscard: () => { requestCancel(); setShowDiff(false); },
										onClose: () => setShowDiff(false)
									})
									: h("div", { className: "vk_editorBody" },
										h("textarea", {
											className: "vk_textarea",
											value: edits[active.path].text,
											autoFocus: true,
											onChange: (e) => onEditText(e.target.value),
											onKeyDown: (e) => {
												if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
													e.preventDefault();
													const sel = e.target.value.substring(e.target.selectionStart, e.target.selectionEnd);
													setRawInlineSelection(sel || edits[active.path]?.text?.slice(0, 300) || "");
													setRawInlineAIOpen(true);
												} else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
													e.preventDefault();
													handleUndo();
												} else if (((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && e.shiftKey) || ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y"))) {
													e.preventDefault();
													handleRedo();
												}
											}
										})
									)
							)
							: h(Viewer, {
								file: active,
								rev: revisions[active.path] ?? 0,
								onStartEdit: startEdit,
								onSaveDirect: (txt, p) => saveWithText(txt, p || active.path),
								onUpdateDirect: (txt, p) => onEditText(txt, p || active.path),
								isDirectDirty: edits[active.path]?.dirty === true,
								saveMsg,
								busy
							}),
				h(StatusBar, {
					active,
					isMarkdown,
					isDirty: edits[active?.path]?.dirty === true,
					lineCount: edits[active?.path]?.text ? edits[active?.path]?.text.split("\\n").length : null,
					autoSave,
					onToggleAutoSave: toggleAutoSave,
					onToggleDiff: editing && !isMarkdown ? () => setShowDiff(!showDiff) : null
				}),
				h(InlineAIWidget, {
					isOpen: rawInlineAIOpen,
					selectionText: rawInlineSelection,
					onClose: () => setRawInlineAIOpen(false),
					onSubmit: handleRawInlineAISubmit
				}),
				ctxMenu !== null ? h("div", {
					className: "vk_menu",
					"data-vk-menu": true,
					style: { left: Math.min(ctxMenu.x, window.innerWidth - 180) + "px", top: Math.min(ctxMenu.y, window.innerHeight - 240) + "px" }
				},
					ctxMenu.path !== null ? menuItem("Close", () => requestCloseTab(ctxMenu.path)) : null,
					ctxMenu.path !== null ? menuItem("Close Others", () => requestClosePaths(tabs.map((t) => t.path).filter((p) => p !== ctxMenu.path))) : null,
					ctxMenu.path !== null ? menuItem("Close to the Left", () => {
						const idx = tabs.findIndex((t) => t.path === ctxMenu.path);
						if (idx > 0) requestClosePaths(tabs.slice(0, idx).map((t) => t.path));
					}) : null,
					ctxMenu.path !== null ? menuItem("Close to the Right", () => {
						const idx = tabs.findIndex((t) => t.path === ctxMenu.path);
						if (idx !== -1 && idx < tabs.length - 1) requestClosePaths(tabs.slice(idx + 1).map((t) => t.path));
					}) : null,
					menuItem("Close All", () => requestClosePaths(tabs.map((t) => t.path)), true),
					ctxMenu.path !== null ? menuItem("📋 Copy Path", () => { navigator.clipboard?.writeText(ctxMenu.path); }) : null
				) : null,
				h(UnsavedChangesModal, {
					isOpen: !!pendingUnsaved,
					title: "Save changes?",
					fileName: pendingUnsaved?.name,
					onSave: handleModalSave,
					onDontSave: handleModalDontSave,
					onCancel: handleModalCancel
				})
			);
		}`;
clientSource = clientSource.replace(editorAreaRegex, () => newEditorArea);

// 8. LeftPanel: 3 Tabs (Explorer, Search, Quests)
const leftPanelRegex = /function LeftPanel\(\{[\s\S]*?\n\t\t\}/;
const newLeftPanel = `function LeftPanel({ tab, onTab, tree, searchPanel, sessionSlot, collapsed, onExpand, onCollapse }) {
			if (collapsed) {
				return h("div", { className: "vk_colLeft vk_rail" },
					h("button", { className: "vk_railBtn" + (tab === "files" ? " vk_railBtnActive" : ""), title: "Explorer", onClick: () => { onTab("files"); onExpand(); } }, "📁"),
					h("button", { className: "vk_railBtn" + (tab === "search" ? " vk_railBtnActive" : ""), title: "Search (Ctrl+Shift+F)", onClick: () => { onTab("search"); onExpand(); } }, "🔍"),
					h("button", { className: "vk_railBtn" + (tab === "sessions" ? " vk_railBtnActive" : ""), title: "Quests", onClick: () => { onTab("sessions"); onExpand(); } }, "☰"),
					h("div", { className: "vk_railSpacer" }),
					h("button", { className: "vk_railBtn", title: "Expand Sidebar", onClick: onExpand }, "»"),
					h("div", { style: { display: "none" } }, sessionSlot)
				);
			}
			return h("div", { className: "vk_colLeft" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "files" ? " vk_tabBtnActive" : ""), onClick: () => onTab("files") }, "Explorer"),
					h("button", { className: "vk_tabBtn" + (tab === "search" ? " vk_tabBtnActive" : ""), title: "Search in Workspace (Ctrl+Shift+F)", onClick: () => onTab("search") }, "Search"),
					h("button", { className: "vk_tabBtn" + (tab === "sessions" ? " vk_tabBtnActive" : ""), onClick: () => onTab("sessions") }, "Quests"),
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn", title: "Collapse Sidebar", onClick: onCollapse }, "«")
				),
				h("div", { className: "vk_tabBody" + (tab === "files" ? "" : " vk_tabBodyHidden") }, tree),
				h("div", { className: "vk_tabBody" + (tab === "search" ? "" : " vk_tabBodyHidden") }, searchPanel),
				h("div", { className: "vk_tabBody" + (tab === "sessions" ? "" : " vk_tabBodyHidden") }, sessionSlot)
			);
		}`;
clientSource = clientSource.replace(leftPanelRegex, () => newLeftPanel);

// 9. RightPanel: English tabs, Fullscreen, and Close/Collapse button
const rightPanelRegex = /function RightPanel\(\{[\s\S]*?\n\t\t\}/;
const newRightPanel = `function RightPanel({ tab, onTab, conversation, details, mode, onToggleMode, showDetails, onCloseRight }) {
			const [aiMode, setAiMode] = react.useState(() => {
				try { return localStorage.getItem("vk_ai_mode") || "agent"; } catch { return "agent"; }
			});

			const handleSelectMode = (newMode) => {
				setAiMode(newMode);
				try { localStorage.setItem("vk_ai_mode", newMode); } catch {}
				const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
				if (chatInput && newMode === "plan") {
					const cur = chatInput.value || chatInput.innerText || "";
					if (!cur.startsWith("[PLANNING MODE]")) {
						const newVal = "[PLANNING MODE] " + cur;
						if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
							chatInput.value = newVal;
							chatInput.dispatchEvent(new Event('input', { bubbles: true }));
						} else {
							chatInput.innerText = newVal;
							chatInput.dispatchEvent(new Event('input', { bubbles: true }));
						}
					}
				}
			};

			return h("div", { className: "vk_colRight" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "conversation" ? " vk_tabBtnActive" : ""), onClick: () => onTab("conversation") }, "Chat"),
					showDetails ? h("button", { className: "vk_tabBtn" + (tab === "details" ? " vk_tabBtnActive" : ""), onClick: () => onTab("details") }, "Details") : null,
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn vk_modeBtn", title: mode === "native" ? "Switch to Split View (Editor + Chat)" : "Switch to Fullscreen Chat", onClick: onToggleMode }, mode === "native" ? "◫ Split View" : "⛶ Fullscreen Chat"),
					onCloseRight ? h("button", { className: "vk_tabBtn", title: "Close / Collapse Chat Panel (Ctrl+L)", onClick: onCloseRight }, "✕") : null
				),
				tab === "conversation" ? h(AIModeSelector, { currentMode: aiMode, onSelectMode: handleSelectMode }) : null,
				h("div", { className: "vk_tabBody" + (tab === "conversation" ? "" : " vk_tabBodyHidden") }, conversation),
				showDetails ? h("div", { className: "vk_tabBody" + (tab === "details" ? "" : " vk_tabBodyHidden") }, details) : null
			);
		}`;
clientSource = clientSource.replace(rightPanelRegex, () => newRightPanel);

clientSource = clientSource.replace(
	'setSidebar: (d, px) => { d.sidebar = clampWidth(px, 264, 420); },',
	'setSidebar: (d, px) => { d.sidebar = px === 0 ? 0 : clampWidth(px, 220, 500); },'
);
clientSource = clientSource.replace(
	'setRight: (d, px) => { d.right = clampWidth(px, 340, 640); },',
	'setRight: (d, px) => { d.right = px === 0 ? 0 : clampWidth(px, 280, 1400); },'
);

// 10. AppFrame: Workspace Root Auto-fallback, Ctrl+L & Ctrl+Shift+F shortcuts & Full width collapse
clientSource = clientSource.replace(
	'const panels = useStore((s) => s);',
	`const panels = useStore((s) => s);
			const [defaultCwd, setDefaultCwd] = react.useState(null);
			react.useEffect(() => {
				fetch("/vscode-files/list?path=.")
					.then((r) => r.json())
					.then((d) => { if (d && d.ok && (d.root || d.path)) setDefaultCwd(d.root || d.path); })
					.catch(() => {});
			}, []);`
);

clientSource = clientSource.replace(
	'const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;',
	`const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
			const [quickOpen, setQuickOpen] = react.useState(false);
			const [cmdPalette, setCmdPalette] = react.useState(false);
			const [folderModalOpen, setFolderModalOpen] = react.useState(false);
			const [profileModalOpen, setProfileModalOpen] = react.useState(false);
			const [sandboxInfo, setSandboxInfo] = react.useState(null);
			const [authState, setAuthState] = react.useState({ checked: false, requiresAuth: false, authenticated: true, user: { name: 'Lucas', color: '#3b82f6', avatar: '👨‍💻' } });

			react.useEffect(() => {
				let token = '';
				let user = { name: 'Lucas', color: '#3b82f6', avatar: '👨‍💻' };
				try {
					token = localStorage.getItem('dsh_auth_token') || '';
					const saved = localStorage.getItem('dsh_user_profile');
					if (saved) user = JSON.parse(saved);
				} catch {}
				fetch('/vscode-files/auth/status' + (token ? '?token=' + encodeURIComponent(token) : ''))
					.then(r => r.json())
					.then(d => {
						if (d && d.ok) {
							setAuthState({
								checked: true,
								requiresAuth: d.requiresAuth,
								authenticated: d.authenticated,
								user: d.user || user
							});
						}
					})
					.catch(() => {});
				fetch('/vscode-files/sandbox-info')
					.then(r => r.json())
					.then(d => { if (d && d.ok) setSandboxInfo(d); })
					.catch(() => {});
			}, []);

			const [shortcutsModalOpen, setShortcutsModalOpen] = react.useState(false);
			const [statsModalOpen, setStatsModalOpen] = react.useState(false);
			const [isZenMode, setIsZenMode] = react.useState(false);
			const [toastMsg, setToastMsg] = react.useState(null);
			const savedPanelsRef = react.useRef({ left: 280, right: 440 });

			const showToast = (msg) => {
				setToastMsg(msg);
				setTimeout(() => setToastMsg(null), 3000);
			};

			const handleCommandPaletteAction = (cmdId) => {
				if (cmdId === "quick_open") setQuickOpen(true);
				else if (cmdId === "open_folder") setFolderModalOpen(true);
				else if (cmdId === "user_profile") setProfileModalOpen(true);
				else if (cmdId === "keyboard_shortcuts") setShortcutsModalOpen(true);
				else if (cmdId === "doc_stats") setStatsModalOpen(true);
				else if (cmdId === "zen_mode") {
					setIsZenMode(prev => {
						const nextZen = !prev;
						if (nextZen) {
							savedPanelsRef.current = { left: panels.sidebar, right: panels.right };
							if (!sidebarCollapsed) actions.toggleSidebar();
							actions.setRight(0);
							showToast("🧘 Entered Zen Mode. Press Esc or Ctrl+Shift+Z to exit.");
						} else {
							if (sidebarCollapsed) actions.toggleSidebar();
							actions.setRight(savedPanelsRef.current.right || 440);
							showToast("Exited Zen Mode.");
						}
						return nextZen;
					});
				} else if (cmdId === "daily_scratchpad") {
					const today = new Date().toISOString().slice(0, 10);
					const scratchPath = "scratchpad.md";
					fetch("/vscode-files/read?path=" + encodeURIComponent(scratchPath))
						.then(r => r.json())
						.then(d => {
							if (!d || !d.ok) {
								const template = "# 📓 Daily Scratchpad - " + today + "\\n> Quick capture for thoughts, code snippets, task lists, and AI discussions.\\n\\n## 🎯 Today's Goals\\n- [ ] Review daily priorities\\n- [ ] Document project architecture\\n- [ ] Test real-time collaboration with team\\n\\n## 💡 Quick Notes & Ideas\\n- Type / anywhere in the document to insert blocks, tables, callouts, or YouTube embeds!\\n- Use Ctrl+K on any selection for Instant AI polishing and table generation.\\n";
								fetch("/vscode-files/write", {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ path: scratchPath, content: template })
								}).then(() => {
									openFile({ path: scratchPath, name: "scratchpad.md" });
									showToast("📓 Created Daily Scratchpad: scratchpad.md");
								});
							} else {
								openFile({ path: scratchPath, name: "scratchpad.md" });
								showToast("📓 Opened Daily Scratchpad: scratchpad.md");
							}
						});
				} else if (cmdId === "export_download") {
					const md = document.querySelector('.tiptap.ProseMirror')?.innerText || "";
					const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
					const a = document.createElement("a");
					a.href = URL.createObjectURL(blob);
					a.download = (tabsState && tabsState.active ? tabsState.active.split(/[\\\\/]/).pop() : "document.md");
					a.click();
					showToast("📥 Downloading markdown file...");
				} else if (cmdId === "export_markdown") {
					const md = document.querySelector('.tiptap.ProseMirror')?.innerText || "";
					navigator.clipboard?.writeText(md);
					showToast("📋 Copied Markdown to clipboard!");
				} else if (cmdId === "export_html") {
					const html = document.querySelector('.tiptap.ProseMirror')?.innerHTML || "";
					navigator.clipboard?.writeText(html);
					showToast("📄 Copied HTML to clipboard!");
				} else if (cmdId === "export_pdf") {
					window.print();
				} else if (cmdId === "zoom_in") {
					const el = document.querySelector('.tiptap.ProseMirror, .vk_tiptap_prose');
					if (el) {
						const cur = parseFloat(window.getComputedStyle(el).fontSize) || 15.5;
						const next = Math.min(24, cur + 2);
						el.style.fontSize = next + "px";
						showToast("🔍 Editor Font Zoom: " + Math.round((next / 15.5) * 100) + "% (" + next + "px)");
					}
				} else if (cmdId === "zoom_out") {
					const el = document.querySelector('.tiptap.ProseMirror, .vk_tiptap_prose');
					if (el) {
						const cur = parseFloat(window.getComputedStyle(el).fontSize) || 15.5;
						const next = Math.max(11, cur - 2);
						el.style.fontSize = next + "px";
						showToast("🔍 Editor Font Zoom: " + Math.round((next / 15.5) * 100) + "% (" + next + "px)");
					}
				} else if (cmdId === "zoom_reset") {
					const el = document.querySelector('.tiptap.ProseMirror, .vk_tiptap_prose');
					if (el) {
						el.style.fontSize = "15.5px";
						showToast("↺ Reset Editor Font Zoom to 100% (15.5px)");
					}
				} else if (cmdId === "global_search") {
					setSidebarTab("search");
					if (sidebarCollapsed) actions.toggleSidebar();
					setTimeout(() => document.getElementById("global-search-input")?.focus(), 100);
				} else if (cmdId === "save_file") {
					document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
				} else if (cmdId === "toggle_diff") {
					const diffBtn = document.querySelector('.vk_editBtn[title*="Diff"], .vk_status_item[title*="Diff"]');
					diffBtn?.click();
				} else if (cmdId === "undo") {
					const undoBtn = document.querySelector('.vk_editBtn[title*="Undo"]');
					undoBtn?.click();
				} else if (cmdId === "redo") {
					const redoBtn = document.querySelector('.vk_editBtn[title*="Redo"]');
					redoBtn?.click();
				} else if (cmdId === "toggle_chat") {
					actions.setRight(panels.right === 0 ? 440 : 0);
				} else if (cmdId === "toggle_sidebar") {
					actions.toggleSidebar();
				} else if (cmdId === "refresh_explorer" || cmdId === "new_file" || cmdId === "new_folder") {
					setSidebarTab("files");
					if (sidebarCollapsed) actions.toggleSidebar();
				} else if (cmdId.startsWith("ai_")) {
					const type = cmdId.replace(/^ai_/, "");
					const activeFile = tabsState && tabsState.active ? tabsState.active.split(/[\\\\/]/).pop() : "current file";
					const promptMap = {
						explain: 'Please analyze and explain ' + activeFile + ' in detail.',
						tests: 'Please write comprehensive unit tests for ' + activeFile + '.',
						refactor: 'Please refactor and optimize ' + activeFile + '.',
						docs: 'Please add documentation and comments for ' + activeFile + '.'
					};
					const prompt = promptMap[type] || ('Please assist me with ' + activeFile);
					if (panels.right === 0) actions.setRight(440);
					if (panels.rightTab !== "conversation") actions.setRightTab("conversation");
					setTimeout(() => setChatInputValue(prompt), 120);
				}
			};

			const setChatInputValue = (val) => {
				let attempts = 0;
				const trySet = () => {
					const chatInput = document.querySelector('.vk_colRight textarea, textarea') || document.querySelector('.vk_colRight [contenteditable="true"], [contenteditable="true"]');
					if (chatInput) {
						if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
							try {
								const proto = chatInput.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
								const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
								if (setter) setter.call(chatInput, val);
								else chatInput.value = val;
							} catch (err) {
								chatInput.value = val;
							}
						} else {
							chatInput.innerText = val;
							chatInput.textContent = val;
						}
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
						chatInput.dispatchEvent(new Event('change', { bubbles: true }));
						chatInput.focus();
						return;
					}
					if (attempts < 6) {
						attempts++;
						setTimeout(trySet, 80);
					}
				};
				trySet();
			};

			// Global Keyboard Shortcuts: Ctrl+P (Quick Open), Ctrl+Shift+P / F1 (Command Palette), Ctrl+L (Chat), Ctrl+Shift+F (Search), Ctrl+Shift+Z (Zen), Ctrl+/ (Shortcuts)
			react.useEffect(() => {
				const onKeyDown = (e) => {
					if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) || e.key === 'F1') {
						e.preventDefault();
						setCmdPalette((prev) => !prev);
					} else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && !e.shiftKey) {
						e.preventDefault();
						setQuickOpen((prev) => !prev);
					} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
						e.preventDefault();
						handleCommandPaletteAction("zen_mode");
					} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
						e.preventDefault();
						handleCommandPaletteAction("daily_scratchpad");
					} else if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
						e.preventDefault();
						setShortcutsModalOpen((prev) => !prev);
					} else if (e.key === 'Escape' && isZenMode) {
						handleCommandPaletteAction("zen_mode");
					} else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
						e.preventDefault();
						handleCommandPaletteAction("zoom_in");
					} else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
						e.preventDefault();
						handleCommandPaletteAction("zoom_out");
					} else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
						e.preventDefault();
						handleCommandPaletteAction("zoom_reset");
					} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
						e.preventDefault();
						setSidebarTab("search");
						if (sidebarCollapsed) actions.toggleSidebar();
						setTimeout(() => {
							const inp = document.getElementById("global-search-input");
							if (inp) { inp.focus(); inp.select(); }
						}, 120);
					} else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
						e.preventDefault();
						const sel = window.getSelection();
						let selectedText = sel ? sel.toString().trim() : "";
						if (!selectedText) {
							const pEl = document.querySelector('.tiptap.ProseMirror p, .vk_tiptap_container .ProseMirror p, .tiptap p');
							if (pEl) selectedText = pEl.textContent.trim();
						}
						const activeFile = tabsState && tabsState.active ? tabsState.active.split(/[\\\\/]/).pop() : "snippet";
						if (panels.right === 0) actions.setRight(440);
						if (panels.rightTab !== "conversation") actions.setRightTab("conversation");
						if (selectedText.length > 0) {
							const prompt = 'Please analyze and explain the following snippet from ' + activeFile + ':\\n\\n\`\`\`\\n' + selectedText + '\\n\`\`\`\\n';
							setChatInputValue(prompt);
						} else {
							const prompt = 'Please analyze and explain ' + activeFile + ' in detail.';
							setChatInputValue(prompt);
						}
					}
				};
				window.addEventListener('keydown', onKeyDown);
				return () => window.removeEventListener('keydown', onKeyDown);
			}, [panels.right, panels.rightTab, tabsState, sidebarCollapsed, isZenMode, actions]);`
);

clientSource = clientSource.replace(
	'const fileRoot = tabsState.root != null ? tabsState.root : sessionCwd;',
	`// @ Mention File & Slash Commands State in Chat
			const [atFileOpen, setAtFileOpen] = react.useState(false);
			const [atFileQuery, setAtFileQuery] = react.useState("");
			const [slashCmdOpen, setSlashCmdOpen] = react.useState(false);
			const [slashCmdQuery, setSlashCmdQuery] = react.useState("");

			react.useEffect(() => {
				const onInput = (e) => {
					const target = e.target;
					if (!target || !(target.matches && (target.matches('.vk_colRight textarea') || target.matches('.vk_colRight [contenteditable="true"]') || target.matches('textarea')))) return;
					const val = target.value || target.innerText || "";
					const lastAt = val.lastIndexOf("@");
					const lastSlash = val.lastIndexOf("/");
					if (lastAt !== -1 && lastAt >= val.length - 25) {
						const q = val.slice(lastAt + 1).split(/\\s/)[0];
						setAtFileQuery(q);
						setAtFileOpen(true);
					} else {
						setAtFileOpen(false);
					}
					if (lastSlash === 0 || (lastSlash > 0 && val[lastSlash - 1] === " ")) {
						const q = val.slice(lastSlash);
						setSlashCmdQuery(q);
						setSlashCmdOpen(true);
					} else {
						setSlashCmdOpen(false);
					}
				};
				document.addEventListener("input", onInput);
				return () => document.removeEventListener("input", onInput);
			}, []);

			const handleSelectAtFile = (fileObj) => {
				setAtFileOpen(false);
				const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
				if (!chatInput) return;
				const val = chatInput.value || chatInput.innerText || "";
				const lastAt = val.lastIndexOf("@");
				if (lastAt !== -1) {
					const newVal = val.slice(0, lastAt) + "@" + fileObj.path + " ";
					setChatInputValue(newVal);
				}
			};

			const handleSelectSlashCmd = (cmd) => {
				setSlashCmdOpen(false);
				setChatInputValue(cmd.prefix);
			};

			// Enhance chat code blocks with ⚡ Apply & 📋 Copy
			react.useEffect(() => {
				const enhanceBlocks = () => {
					const blocks = document.querySelectorAll('.vk_colRight pre:not(.vk_code_enhanced)');
					blocks.forEach((pre) => {
						pre.classList.add('vk_code_enhanced');
						const bar = document.createElement('div');
						bar.className = 'vk_chat_code_bar';

						const copyBtn = document.createElement('button');
						copyBtn.className = 'vk_code_action_btn';
						copyBtn.innerHTML = '📋 Copy';
						copyBtn.onclick = (e) => {
							e.stopPropagation();
							const codeEl = pre.querySelector('code') || pre;
							navigator.clipboard?.writeText(codeEl.innerText);
							copyBtn.innerHTML = '✓ Copied!';
							setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
						};

						const applyBtn = document.createElement('button');
						applyBtn.className = 'vk_code_action_btn';
						applyBtn.innerHTML = '⚡ Apply to Tab';
						applyBtn.title = 'Apply this code snippet to active tab';
						applyBtn.onclick = (e) => {
							e.stopPropagation();
							const codeEl = pre.querySelector('code') || pre;
							const codeText = codeEl.innerText;
							if (tabsState && tabsState.active) {
								openFile({ path: tabsState.active, name: tabsState.active.split(/[\\\\/]/).pop() });
								setTimeout(() => {
									const txtArea = document.querySelector('.vk_textarea');
									if (txtArea) {
										txtArea.value = codeText;
										txtArea.dispatchEvent(new Event('input', { bubbles: true }));
									}
								}, 100);
							}
						};

						bar.appendChild(applyBtn);
						bar.appendChild(copyBtn);
						pre.insertBefore(bar, pre.firstChild);
					});
				};

				const obs = new MutationObserver(enhanceBlocks);
				const col = document.querySelector('.vk_colRight');
				if (col) {
					obs.observe(col, { childList: true, subtree: true });
					enhanceBlocks();
				}
				return () => obs.disconnect();
			}, [tabsState, openFile]);

			// Intercept clicks on file paths or tool badges in conversation / trajectory to open file directly in tab
			react.useEffect(() => {
				const onGlobalClick = (e) => {
					const target = e.target;
					if (!(target instanceof Element)) return;
					const fileEl = target.closest('[data-file-path], .vk_file_link, a[href*="file://"], code');
					if (!fileEl) return;
					const pathAttr = fileEl.getAttribute('data-file-path') || fileEl.getAttribute('href');
					const text = fileEl.textContent ? fileEl.textContent.trim() : "";
					const candidate = pathAttr ? pathAttr.replace(/^file:\\/\\//, '') : text;
					if (candidate && /\\.(js|mjs|cjs|ts|tsx|jsx|json|md|html|css|py|rs|go|sh|yml|yaml|txt)$/i.test(candidate) && !candidate.includes('\\n') && candidate.length < 200) {
						const cleanPath = candidate.trim().replace(/^[\`\'\"]|[\`\'\"]$/g, '');
						openFile({ path: cleanPath, name: cleanPath.split(/[\\/\\\\]/).pop() });
					}
				};
				document.addEventListener('click', onGlobalClick);
				return () => document.removeEventListener('click', onGlobalClick);
			}, [openFile]);

			const fileRoot = tabsState.root != null ? tabsState.root : (sessionCwd || defaultCwd || ".");`
);

clientSource = clientSource.replace(
	'const cols = computeColumns(viewport, sidebarCollapsed ? 0 : panels.sidebar === 0 ? 280 : panels.sidebar, panels.right === 0 ? 440 : panels.right);',
	'const cols = computeColumns(viewport, sidebarCollapsed ? 0 : (panels.sidebar === 0 ? 0 : (panels.sidebar ?? 280)), panels.right === 0 ? 0 : (panels.right ?? 440));'
);

const leftBlockRegex = /const left = h\(LeftPanel, \{[\s\S]*?\}\);/;
const newLeftBlock = `const left = h(LeftPanel, {
				tab: tabsState.sidebarTab,
				onTab: setSidebarTab,
				collapsed: sidebarCollapsed,
				onExpand: () => actions.toggleSidebar(),
				onCollapse: () => actions.toggleSidebar(),
				tree: h(FileTree, { root: fileRoot, custom: tabsState.root != null, onOpenFolder: openFolder, onCloseFolder: closeFolder, onOpenFile: openFile, onPickNative: () => setFolderModalOpen(true), activePath: tabsState.active, onDeleted, onRenamed }),
				searchPanel: h(GlobalSearchPanel, { root: fileRoot, onOpenFile: openFile }),
				sessionSlot: renderSlot("sidebar", { collapsed: sidebarCollapsed, width: cols.sidebar })
			});`;
clientSource = clientSource.replace(leftBlockRegex, () => newLeftBlock);

// AppFrame: Pass onCloseRight to RightPanel and render floating open chat when collapsed
const rightBlockRegex = /const right = h\(RightPanel, \{[\s\S]*?\}\);/;
const newRightBlock = `const right = cols.right > 0 ? h(RightPanel, {
				onCloseRight: () => actions.setRight(0),
				tab: panels.rightTab,
				onTab: (t) => actions.setRightTab(t),
				mode: tabsState.mode,
				onToggleMode: toggleMode,
				showDetails: native,
				conversation: renderSlot("conversation", {}),
				details: detailsSlot
			}) : null;`;
clientSource = clientSource.replace(rightBlockRegex, () => newRightBlock);

const appFrameReturnRegex = /return h\("div", \{\s*ref: frameRef,[\s\S]*?children: \[/;
const newAppFrameReturn = `const showOpenChatBtn = cols.right === 0 && panels.mode !== "native";
			return h("div", {
				ref: frameRef,
				className: "vk_frame",
				style: { gridTemplateColumns: gridCols },
				"data-native": native || void 0,
				"data-sidebar-collapsed": sidebarCollapsed || void 0,
				"data-dragging": dragging || void 0,
				children: [
					h(LoginModal, {
						isOpen: authState.requiresAuth && !authState.authenticated,
						onLoginSuccess: (token, user) => {
							setAuthState({ checked: true, requiresAuth: true, authenticated: true, user });
							if (user) {
								try { localStorage.setItem("dsh_user_profile", JSON.stringify(user)); } catch {}
							}
						}
					}),
					h(OpenFolderModal, {
						isOpen: folderModalOpen,
						onClose: () => setFolderModalOpen(false),
						onSelectFolder: (p) => {
							openFolder(p);
							setFolderModalOpen(false);
						}
					}),
					h(UserProfileModal, {
						isOpen: profileModalOpen,
						currentUser: authState.user,
						onClose: () => setProfileModalOpen(false),
						onSaveProfile: (u) => {
							setAuthState(prev => ({ ...prev, user: u }));
							try { localStorage.setItem("dsh_user_profile", JSON.stringify(u)); } catch {}
						}
					}),
					h(QuickOpenModal, { isOpen: quickOpen, onClose: () => setQuickOpen(false), root: fileRoot, onOpenFile: openFile }),
					h(CommandPaletteModal, { isOpen: cmdPalette, onClose: () => setCmdPalette(false), onExecuteAction: handleCommandPaletteAction }),
					h(ShortcutsCheatSheetModal, { isOpen: shortcutsModalOpen, onClose: () => setShortcutsModalOpen(false) }),
					h(DocumentStatsModal, { isOpen: statsModalOpen, fileName: tabsState && tabsState.active ? tabsState.active.split(/[\\\\/]/).pop() : "document.md", content: tabsState && tabsState.active && tabsState[tabsState.active] ? tabsState[tabsState.active].content : "", onClose: () => setStatsModalOpen(false) }),
					h(AtFileMentionDropdown, { isOpen: atFileOpen, query: atFileQuery, onSelect: handleSelectAtFile, onClose: () => setAtFileOpen(false) }),
					h(ChatSlashCommandDropdown, { isOpen: slashCmdOpen, query: slashCmdQuery, onSelect: handleSelectSlashCmd, onClose: () => setSlashCmdOpen(false) }),
					isZenMode ? h("div", { className: "vk_zen_banner", onClick: () => handleCommandPaletteAction("zen_mode") }, "🧘 Zen Mode Active — Press Esc or Click to Exit") : null,
					toastMsg ? h("div", { className: "vk_toast_msg" }, toastMsg) : null,
					showOpenChatBtn ? h("button", {
						className: "vk_open_chat_float",
						title: "Open AI Chat Panel (Ctrl+L)",
						onClick: () => actions.setRight(440)
					}, "💬 Open Chat (Ctrl+L)") : null,`;
clientSource = clientSource.replace(appFrameReturnRegex, () => newAppFrameReturn);

// 11. Global Persona section translation
clientSource = clientSource.replace('label: () => "全局人设"', 'label: () => "Global Persona"');
clientSource = clientSource.replace('h("div", { className: "vk_personaDesc" }, "类似 Claude Code 的全局 CLAUDE.md：内容会注入到所有会话的系统提示中，新消息立即生效（无需重启）。支持 Markdown。"),', 'h("div", { className: "vk_personaDesc" }, "Global Instructions (similar to CLAUDE.md): Injected into system prompt of all sessions. Takes effect immediately. Supports Markdown."),');
clientSource = clientSource.replace('placeholder: "例如：\\n- 你叫小鲸，说话简洁直接\\n- 一律用简体中文回答\\n- …"', 'placeholder: "Example:\\n- Be concise and precise\\n- Follow coding guidelines\\n- ..."');
clientSource = clientSource.replace('saving ? "保存中…" : "保存"', 'saving ? "Saving..." : "Save"');
clientSource = clientSource.replace('{ ok: true, text: "已保存 ✓ 新消息立即生效" }', '{ ok: true, text: "Saved ✓ Effective immediately" }');
clientSource = clientSource.replace('text: (d && d.error) || "保存失败"', 'text: (d && d.error) || "Save failed"');
clientSource = clientSource.replace('(d && d.error) || "读取失败"', '(d && d.error) || "Failed to read file"');
clientSource = clientSource.replace('? h("div", { className: "vk_personaDesc" }, "加载中…")', '? h("div", { className: "vk_personaDesc" }, "Loading...")');
clientSource = clientSource.replace('name: "工具详情"', 'name: "Tool Trajectory"');

fs.writeFileSync(path.join(clientDir, 'lib/client.js'), clientSource, 'utf8');
console.log('[✓] Successfully generated and bundled dsh-client-vscode-layout with English UI, Search Suite & Right-Click Context Menu!');
