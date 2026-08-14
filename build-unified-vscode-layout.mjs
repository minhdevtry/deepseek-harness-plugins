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

			.vk_tiptap_prose {
				outline: none; font-size: 15.5px; line-height: 1.8; min-height: 480px;
				color: var(--dsw-alias-label-primary, #111827); width: 100%;
			}
			.vk_tiptap_prose h1, .vk_tiptap_prose h2, .vk_tiptap_prose h3 {
				color: var(--dsw-alias-label-primary, #111827);
			}
			.vk_tiptap_prose h1 { font-size: 2.1em; font-weight: 800; margin: 28px 0 12px; line-height: 1.25; }
			.vk_tiptap_prose h2 { font-size: 1.6em; font-weight: 700; margin: 22px 0 10px; line-height: 1.3; }
			.vk_tiptap_prose h3 { font-size: 1.3em; font-weight: 600; margin: 18px 0 8px; line-height: 1.4; }
			.vk_tiptap_prose p { margin: 8px 0; }

			.vk_callout_box {
				background: rgba(59,130,246,0.08); border: 1.5px solid rgba(59,130,246,0.3);
				border-radius: 8px; padding: 14px 18px; margin: 16px 0; display: flex; gap: 12px;
				color: var(--dsw-alias-label-primary, #0369a1);
			}
			.vk_callout_icon { font-size: 20px; line-height: 1.3; flex-shrink: 0; }
			.vk_callout_body { flex: 1; font-size: 15px; }

			.vk_tiptap_prose pre { background: #0f172a; color: #f8fafc; padding: 18px 20px; border-radius: 10px; font-family: 'Fira Code', Consolas, Monaco, monospace; font-size: 13.5px; line-height: 1.65; margin: 16px 0; overflow-x: auto; }
			.vk_tiptap_prose pre code { background: transparent; padding: 0; color: inherit; font-size: inherit; }
			.vk_tiptap_prose code { background: rgba(59,130,246,0.08); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
			.vk_tiptap_prose ul, .vk_tiptap_prose ol { padding-left: 28px; margin: 10px 0; }
			.vk_tiptap_prose li { margin: 5px 0; }
			.vk_tiptap_prose ul[data-type="taskList"] { list-style: none; padding: 0; }
			.vk_tiptap_prose ul[data-type="taskList"] li { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
			.vk_tiptap_prose ul[data-type="taskList"] li > label { display: flex; align-items: center; user-select: none; }
			.vk_tiptap_prose ul[data-type="taskList"] li > label input[type="checkbox"] { width: 17px; height: 17px; cursor: pointer; accent-color: #3b82f6; }
			.vk_tiptap_prose ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; opacity: 0.55; }
			.vk_tiptap_prose table { border-collapse: collapse; width: 100%; margin: 18px 0; overflow: hidden; border-radius: 8px; border: 1px solid #cbd5e1; }
			.vk_tiptap_prose th, .vk_tiptap_prose td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; vertical-align: top; min-width: 80px; }
			.vk_tiptap_prose th { background: #f8fafc; font-weight: 700; color: #1e293b; }
			.vk_tiptap_prose iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; margin: 18px 0; border: none; }
			.vk_tiptap_prose img { max-width: 100%; border-radius: 8px; margin: 16px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
			.vk_tiptap_prose mark { background: #fef08a; padding: 2px 4px; border-radius: 3px; }

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
		\`;

		if (typeof document !== "undefined" && !document.getElementById("vk-tiptap-styles")) {
			const s = document.createElement("style");
			s.id = "vk-tiptap-styles";
			s.textContent = tiptapStyles;
			document.head.appendChild(s);
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

			const editorRef = react.useRef(null);
			const containerRef = react.useRef(null);
			const canvasRef = react.useRef(null);
			const slashStateRef = react.useRef({ menu: null, query: '', index: 0 });

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
				const chatInput = document.querySelector('textarea, [contenteditable="true"]');
				if (chatInput) {
					if (chatInput.tagName === 'TEXTAREA') {
						chatInput.value = prompt;
						chatInput.dispatchEvent(new Event('input', { bubbles: true }));
					} else {
						chatInput.innerText = prompt;
					}
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
					Image, Youtube, Highlight, Typography, TextAlign, Link, Color, TextStyle, CodeBlockLowlight, lowlight, Markdown
				} = window.TipTapBundle;

				const editor = new Editor({
					element: containerRef.current,
					extensions: [
						StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, codeBlock: false, link: false, underline: false }),
						TaskList, TaskItem.configure({ nested: true }),
						Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
						Image, Youtube.configure({ inline: false, nocookie: true }),
						Highlight, Typography, TextAlign.configure({ types: ['heading', 'paragraph'] }),
						Link.configure({ openOnClick: false }), Color, TextStyle,
						CodeBlockLowlight.configure({ lowlight }),
						Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true })
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
				};
			}, []);

			react.useEffect(() => {
				if (editorRef.current && content !== undefined) {
					const currentMd = editorRef.current.storage?.markdown?.getMarkdown();
					if (currentMd !== content && !editorRef.current.isFocused) {
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
					react.createElement('div', { key: 'spacer', style: { flex: 1 } }),
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
					react.createElement('div', { key: 'head', className: 'dsh-modal-head' }, [
						react.createElement('span', { key: 'title' },
							embedModal.type === 'youtube' ? '🎥 Embed YouTube Video' : embedModal.type === 'image' ? '🖼️ Insert Image URL' : '📊 Insert Table'
						),
						react.createElement('button', { key: 'close', type: 'button', className: 'dsh-modal-close', onClick: () => setEmbedModal(null) }, '✕')
					]),
					react.createElement('form', { key: 'body', onSubmit: submitEmbedModal }, [
						react.createElement('div', { key: 'content', className: 'dsh-modal-body' },
							embedModal.type === 'table' ? [
								react.createElement('div', { key: 'row-input', className: 'dsh-modal-row' }, [
									react.createElement('span', { key: 'lbl1', className: 'dsh-modal-label' }, 'Number of Rows:'),
									react.createElement('input', {
										key: 'inp-rows',
										type: 'number',
										min: 1, max: 30, required: true, autoFocus: true,
										className: 'dsh-modal-num-input',
										value: embedModal.rows,
										onChange: (e) => setEmbedModal({ ...embedModal, rows: e.target.value })
									})
								]),
								react.createElement('div', { key: 'col-input', className: 'dsh-modal-row' }, [
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
				])) : null
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
												if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
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
								onSaveDirect: (txt, p) => saveWithText(txt, p),
								onUpdateDirect: (txt, p) => onEditText(txt, p),
								isDirectDirty: edits[active.path]?.dirty === true,
								saveMsg,
								busy
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
			return h("div", { className: "vk_colRight" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "conversation" ? " vk_tabBtnActive" : ""), onClick: () => onTab("conversation") }, "Chat"),
					showDetails ? h("button", { className: "vk_tabBtn" + (tab === "details" ? " vk_tabBtnActive" : ""), onClick: () => onTab("details") }, "Details") : null,
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn vk_modeBtn", title: mode === "native" ? "Switch to Split View (Editor + Chat)" : "Switch to Fullscreen Chat", onClick: onToggleMode }, mode === "native" ? "◫ Split View" : "⛶ Fullscreen Chat"),
					onCloseRight ? h("button", { className: "vk_tabBtn", title: "Close / Collapse Chat Panel (Ctrl+L)", onClick: onCloseRight }, "✕") : null
				),
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

			// Global Keyboard Shortcuts: Ctrl+P (Quick Open), Ctrl+L (Chat / Prompt), Ctrl+Shift+F (Global Search)
			react.useEffect(() => {
				const onKeyDown = (e) => {
					if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && !e.shiftKey) {
						e.preventDefault();
						setQuickOpen((prev) => !prev);
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
						const selectedText = sel ? sel.toString().trim() : "";
						if (selectedText.length > 0) {
							if (panels.right === 0) actions.setRight(440);
							if (panels.rightTab !== "conversation") actions.setRightTab("conversation");
							const activeFile = tabsState && tabsState.active ? tabsState.active.split(/[\\\\/]/).pop() : "snippet";
							const prompt = 'Please analyze and explain the following snippet from ' + activeFile + ':\\n\\n\`\`\`\\n' + selectedText + '\\n\`\`\`\\n';
							setTimeout(() => {
								const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
								if (chatInput) {
									if (chatInput.tagName === 'TEXTAREA' || chatInput.tagName === 'INPUT') {
										chatInput.value = prompt;
										chatInput.dispatchEvent(new Event('input', { bubbles: true }));
										const len = chatInput.value.length;
										if (typeof chatInput.setSelectionRange === 'function') chatInput.setSelectionRange(len, len);
									} else {
										chatInput.innerText = prompt;
										chatInput.dispatchEvent(new Event('input', { bubbles: true }));
									}
									chatInput.focus();
								}
							}, 120);
						} else {
							const curRight = panels.right;
							actions.setRight(curRight === 0 ? 440 : 0);
							if (curRight === 0) {
								setTimeout(() => {
									const chatInput = document.querySelector('.vk_colRight textarea, .vk_colRight [contenteditable="true"], textarea, [contenteditable="true"]');
									chatInput?.focus();
								}, 120);
							}
						}
					}
				};
				window.addEventListener('keydown', onKeyDown);
				return () => window.removeEventListener('keydown', onKeyDown);
			}, [panels.right, panels.rightTab, tabsState, sidebarCollapsed, actions]);`
);

clientSource = clientSource.replace(
	'const fileRoot = tabsState.root != null ? tabsState.root : sessionCwd;',
	`// Intercept clicks on file paths or tool badges in conversation / trajectory to open file directly in tab
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
				tree: h(FileTree, { root: fileRoot, custom: tabsState.root != null, onOpenFolder: openFolder, onCloseFolder: closeFolder, onOpenFile: openFile, onPickNative: pickFolder, activePath: tabsState.active, onDeleted, onRenamed }),
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
					h(QuickOpenModal, { isOpen: quickOpen, onClose: () => setQuickOpen(false), root: fileRoot, onOpenFile: openFile }),
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
