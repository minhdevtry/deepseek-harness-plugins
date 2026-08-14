import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const baseDir = path.join(os.homedir(), '.dsh/profiles/web/node_modules/dsh-local-filetree/lib')
const serverFile = path.join(baseDir, 'index.js')
const clientFile = path.join(baseDir, 'client.js')
const tiptapBundleFile = path.join(__dirname, 'tiptap.bundle.js')

// ==========================================
// 1. PATCH SERVER (Add Read, Save & TipTap bundle API)
// ==========================================
if (fs.existsSync(serverFile)) {
  let content = fs.readFileSync(serverFile, 'utf8')

  if (!content.includes('node:fs/promises')) {
    content = `import fsPromises from 'node:fs/promises';\n` + content
  }

  const routesPatch = `
				if (pathname === "/filetree/read" && req.method === "GET") {
					const path = parsePathQuery(req.url ?? "/");
					if (!path) {
						sendJson(res, 400, { ok: false, message: "missing path" });
						return;
					}
					const target = await fs.resolve(path, {});
					const fileContent = await fsPromises.readFile(target.displayPath, "utf8");
					sendJson(res, 200, { ok: true, path: target.displayPath, content: fileContent });
					return;
				}
				if (pathname === "/filetree/save" && req.method === "POST") {
					let body = "";
					req.on("data", (chunk) => { body += chunk; });
					req.on("end", async () => {
						try {
							const data = JSON.parse(body);
							if (!data.path || typeof data.content !== "string") {
								sendJson(res, 400, { ok: false, message: "invalid request body" });
								return;
							}
							const target = await fs.resolve(data.path, {});
							await fsPromises.writeFile(target.displayPath, data.content, "utf8");
							sendJson(res, 200, { ok: true, path: target.displayPath });
						} catch (err) {
							sendJson(res, 500, { ok: false, message: err.message });
						}
					});
					return;
				}
  `

  if (!content.includes('/filetree/read')) {
    content = content.replace(
      'if (pathname === "/filetree/list") {',
      `${routesPatch}\n\t\t\t\tif (pathname === "/filetree/list") {`
    )
    content = content.replace(
      'if (req.method !== "GET" && req.method !== "HEAD")',
      'if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST")'
    )
    fs.writeFileSync(serverFile, content, 'utf8')
    console.log('[✓] Successfully patched filetree server with /filetree/read and /filetree/save APIs!')
  }
}

// Copy tiptap.bundle.js into dsh-local-filetree lib directory
const destBundle = path.join(baseDir, 'tiptap.bundle.js')
if (fs.existsSync(tiptapBundleFile)) {
  fs.copyFileSync(tiptapBundleFile, destBundle)
}

// ==========================================
// 2. PATCH CLIENT (Novel-Grade TipTap UI/UX & Precise Slash Commands)
// ==========================================
if (fs.existsSync(clientFile)) {
  let content = fs.readFileSync(clientFile, 'utf8')

  // A. English Translations & Rename to File Explorer
  const replacements = [
    ['"aria-label": "文件树"', '"aria-label": "File Explorer"'],
    ['title: "文件树"', 'title: "File Explorer"'],
    ['"文件树"', '"File Explorer"'],
    ['"等待加载…"', '"Waiting for load..."'],
    ['"加载中…"', '"Loading..."'],
    ['"折叠"', '"Collapse"'],
    ['"展开"', '"Expand"'],
    ['"（无会 session 工作区）"', '"(No session workspace)"'],
    ['"（无会话工作区）"', '"(No session workspace)"'],
    ['"隐藏隐藏文件"', '"Hide hidden files"'],
    ['"显示隐藏文件"', '"Show hidden files"'],
    ['"刷新"', '"Refresh"'],
    ['"恢复工具详情"', '"Restore tool details"'],
    ['"打开一个会话后显示其工作区文件树"', '"Open a session to display workspace files"']
  ]

  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to)
  }

  // B. TipTap Bundle Loader & Component
  let tiptapBundleCode = ''
  if (fs.existsSync(tiptapBundleFile)) {
    tiptapBundleCode = fs.readFileSync(tiptapBundleFile, 'utf8')
  }

  const vscodeEditorStyles = `
		.dsh-editor-panel-view {
			position: fixed; top: 0; bottom: 0; left: 260px; right: 0; z-index: 50;
			background: var(--dsw-alias-bg-base, #ffffff);
			display: flex; flex-direction: column; overflow: hidden;
			box-shadow: -3px 0 16px rgba(0,0,0,0.08);
		}
		@media (max-width: 1024px) {
			.dsh-editor-panel-view { left: 60px; right: 0; }
		}
		.dsh-editor-topbar {
			height: 42px; background: var(--dsw-alias-bg-subtle, #f9fafb);
			border-bottom: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			display: flex; align-items: center; justify-content: space-between;
			padding: 0 14px; flex-shrink: 0;
		}
		.dsh-editor-tab-active {
			background: var(--dsw-alias-bg-base, #ffffff);
			height: 42px; padding: 0 16px; display: flex; align-items: center; gap: 8px;
			border-right: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			border-top: 2.5px solid #3b82f6; font-size: 13px; font-weight: 600;
			color: var(--dsw-alias-label-primary, #111827);
		}
		.dsh-tab-close {
			border: none; background: transparent; font-size: 12px; cursor: pointer;
			color: var(--dsw-alias-label-tertiary, #9ca3af); border-radius: 4px; padding: 2px 5px;
		}
		.dsh-tab-close:hover { background: rgba(0,0,0,0.08); color: #ef4444; }
		.dsh-editor-top-actions { display: flex; align-items: center; gap: 10px; }
		.dsh-mode-switch { display: flex; background: var(--dsw-alias-border-l1, #e5e7eb); border-radius: 6px; padding: 2px; }
		.dsh-switch-btn {
			border: none; background: transparent; padding: 4px 10px; font-size: 11.5px;
			font-weight: 600; border-radius: 4px; cursor: pointer; color: var(--dsw-alias-label-secondary, #4b5563);
		}
		.dsh-switch-btn-active { background: #fff; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
		.dsh-save-btn {
			background: #10b981; color: #fff; border: none; padding: 5px 12px; border-radius: 6px;
			font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;
		}
		.dsh-save-btn:hover { background: #059669; }
		.dsh-close-btn {
			background: transparent; border: none; font-size: 16px; cursor: pointer;
			color: var(--dsw-alias-label-secondary, #6b7280); padding: 4px 8px; border-radius: 4px;
		}
		.dsh-close-btn:hover { background: rgba(0,0,0,0.06); }
		.dsh-tiptap-toolbar {
			background: var(--dsw-alias-bg-base, #ffffff);
			border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
			padding: 6px 14px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex-shrink: 0;
		}
		.dsh-table-toolbar {
			background: #f0fdf4; border-bottom: 1px solid #bbf7d0;
			padding: 4px 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex-shrink: 0;
			animation: dsh-slide-down 0.15s ease-out;
		}
		@keyframes dsh-slide-down { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
		.dsh-tb-tool {
			border: 1px solid transparent; background: transparent; padding: 4px 8px;
			border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
			color: var(--dsw-alias-label-secondary, #374151); min-width: 26px; text-align: center;
			display: inline-flex; align-items: center; gap: 4px;
		}
		.dsh-tb-tool:hover { background: var(--dsw-alias-interactive-bg-hover, #f3f4f6); border-color: var(--dsw-alias-border-l2, #d1d5db); }
		.dsh-tb-table-btn {
			border: 1px solid #86efac; background: #ffffff; padding: 3px 8px;
			border-radius: 5px; font-size: 11.5px; font-weight: 600; cursor: pointer;
			color: #166534; display: inline-flex; align-items: center; gap: 3px;
		}
		.dsh-tb-table-btn:hover { background: #dcfce7; border-color: #4ade80; }
		.dsh-tb-table-btn-danger { color: #dc2626; border-color: #fca5a5; }
		.dsh-tb-table-btn-danger:hover { background: #fee2e2; border-color: #f87171; }
		.dsh-tb-sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l2, #e5e7eb); margin: 0 4px; }
		.dsh-bold { font-weight: 800; }
		.dsh-italic { font-style: italic; }
		.dsh-strike { text-decoration: line-through; }
		.dsh-underline { text-decoration: underline; }
		.dsh-editor-canvas { flex: 1; overflow-y: auto; display: flex; flex-direction: column; position: relative; }
		.dsh-tiptap-container { flex: 1; display: flex; flex-direction: column; padding: 28px 48px; max-width: 960px; margin: 0 auto; width: 100%; box-sizing: border-box; }
		.dsh-tiptap-prose {
			outline: none; font-size: 15.5px; line-height: 1.75; min-height: 600px;
			color: var(--dsw-alias-label-primary, #111827); width: 100%;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		}
		.dsh-tiptap-prose h1 { font-size: 28px; font-weight: 800; margin: 24px 0 12px; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; line-height: 1.3; }
		.dsh-tiptap-prose h2 { font-size: 22px; font-weight: 700; margin: 20px 0 10px; color: #1f2937; line-height: 1.35; }
		.dsh-tiptap-prose h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: #374151; }
		.dsh-tiptap-prose p { margin: 8px 0; }
		.dsh-tiptap-prose blockquote { border-left: 4px solid #3b82f6; padding: 6px 16px; color: #4b5563; margin: 12px 0; font-style: italic; background: rgba(59,130,246,0.03); border-radius: 0 8px 8px 0; }
		.dsh-tiptap-prose pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; font-family: 'Fira Code', Consolas, Monaco, monospace; font-size: 13.5px; line-height: 1.6; margin: 14px 0; overflow-x: auto; }
		.dsh-tiptap-prose pre code { background: transparent; padding: 0; color: inherit; font-size: inherit; }
		.dsh-tiptap-prose code { background: rgba(59,130,246,0.08); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
		.dsh-tiptap-prose ul, .dsh-tiptap-prose ol { padding-left: 26px; margin: 8px 0; }
		.dsh-tiptap-prose li { margin: 4px 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] { list-style: none; padding: 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] li { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] li > label { display: flex; align-items: center; user-select: none; }
		.dsh-tiptap-prose ul[data-type="taskList"] li > label input[type="checkbox"] { width: 17px; height: 17px; cursor: pointer; accent-color: #3b82f6; }
		.dsh-tiptap-prose ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; opacity: 0.55; }
		.dsh-tiptap-prose table { border-collapse: collapse; width: 100%; margin: 16px 0; overflow: hidden; border-radius: 8px; border: 1px solid #cbd5e1; }
		.dsh-tiptap-prose th, .dsh-tiptap-prose td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; vertical-align: top; min-width: 80px; position: relative; }
		.dsh-tiptap-prose th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
		.dsh-tiptap-prose iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; margin: 16px 0; border: none; }
		.dsh-tiptap-prose img { max-width: 100%; border-radius: 8px; margin: 14px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
		.dsh-tiptap-prose mark { background: #fef08a; padding: 2px 4px; border-radius: 3px; }
		
		/* Caret-Anchored Slash Commands Popup */
		.dsh-slash-menu {
			position: absolute; z-index: 100; background: var(--dsw-alias-bg-base, #ffffff);
			border: 1px solid var(--dsw-alias-border-l2, #e5e7eb); border-radius: 10px;
			box-shadow: 0 12px 32px rgba(0,0,0,0.15); width: 300px; max-height: 360px;
			overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px;
		}
		.dsh-slash-header {
			font-size: 11px; font-weight: 700; color: #9ca3af; padding: 6px 10px 2px;
			text-transform: uppercase; letter-spacing: 0.5px;
		}
		.dsh-slash-item {
			display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px;
			cursor: pointer; font-size: 13px; color: var(--dsw-alias-label-primary, #1f2937);
			border: none; background: transparent; width: 100%; text-align: left; transition: all 0.1s ease;
		}
		.dsh-slash-item:hover, .dsh-slash-item-selected {
			background: #eff6ff; color: #2563eb; font-weight: 600;
		}
		.dsh-slash-icon { font-size: 15px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.04); border-radius: 4px; flex-shrink: 0; }
		.dsh-slash-desc { font-size: 11.5px; color: #6b7280; margin-left: auto; }
		
		/* Sleek Embed Modal Dialog */
		.dsh-modal-backdrop {
			position: fixed; inset: 0; z-index: 1000;
			background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);
			display: flex; justify-content: center; align-items: center; padding: 20px;
		}
		.dsh-modal-card {
			background: var(--dsw-alias-bg-base, #ffffff);
			border: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			border-radius: 12px; box-shadow: 0 20px 45px rgba(0,0,0,0.25);
			width: min(480px, 95vw); display: flex; flex-direction: column; overflow: hidden;
			animation: dsh-modal-pop 0.15s ease-out;
		}
		@keyframes dsh-modal-pop { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
		.dsh-modal-head {
			padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
			display: flex; align-items: center; justify-content: space-between;
			font-size: 15px; font-weight: 700; color: var(--dsw-alias-label-primary, #111827);
		}
		.dsh-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
		.dsh-modal-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
		.dsh-modal-label { font-size: 13.5px; font-weight: 600; color: var(--dsw-alias-label-secondary, #374151); }
		.dsh-modal-input {
			width: 100%; border: 1.5px solid #3b82f6; border-radius: 8px; padding: 10px 14px;
			font-size: 14px; outline: none; box-sizing: border-box; background: var(--dsw-alias-bg-base, #ffffff);
			color: var(--dsw-alias-label-primary, #111827);
		}
		.dsh-modal-num-input {
			width: 90px; border: 1.5px solid #d1d5db; border-radius: 6px; padding: 6px 10px;
			font-size: 14px; outline: none; box-sizing: border-box; background: #fff; text-align: center;
		}
		.dsh-modal-num-input:focus { border-color: #3b82f6; }
		.dsh-modal-checkbox { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }
		.dsh-modal-foot {
			padding: 12px 18px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
			background: var(--dsw-alias-bg-subtle, #f9fafb); display: flex; justify-content: flex-end; gap: 8px;
		}
		.dsh-modal-btn-cancel {
			padding: 6px 14px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff;
			font-size: 13px; font-weight: 600; cursor: pointer; color: #4b5563;
		}
		.dsh-modal-btn-submit {
			padding: 6px 16px; border-radius: 6px; border: none; background: #2563eb;
			font-size: 13px; font-weight: 600; cursor: pointer; color: #fff;
		}
		.dsh-modal-btn-submit:hover { background: #1d4ed8; }

		/* Code Syntax Highlighting colors */
		.hljs-keyword, .hljs-selector-tag { color: #f43f5e; font-weight: 700; }
		.hljs-string, .hljs-title { color: #10b981; }
		.hljs-comment, .hljs-quote { color: #64748b; font-style: italic; }
		.hljs-number, .hljs-literal { color: #fb923c; }
		.hljs-function, .hljs-attr { color: #38bdf8; }
		.hljs-built_in { color: #a855f7; }

		.dsh-code-canvas { flex: 1; display: flex; }
		.dsh-code-textarea {
			width: 100%; height: 100%; min-height: 100%; border: none; outline: none; padding: 18px 24px;
			font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
			font-size: 14px; line-height: 1.65; background: var(--dsw-alias-bg-base, #ffffff);
			color: var(--dsw-alias-label-primary, #111827); resize: none;
		}
		.ft-name-file { cursor: pointer; }
		.ft-name-file:hover { color: #3b82f6 !important; text-decoration: underline; }
		.ft-row:hover { background: rgba(59, 130, 246, 0.08); border-radius: 4px; }
  `

  const officialTipTapComponent = `
		function OfficialTipTapEditor({ filePath, initialContent, onClose, onSave }) {
			const [isRichMode, setIsRichMode] = react.useState(filePath.endsWith('.md'));
			const [rawContent, setRawContent] = react.useState(initialContent);
			const [isSaving, setIsSaving] = react.useState(false);
			const [savedToast, setSavedToast] = react.useState(false);
			const [slashMenu, _setSlashMenu] = react.useState(null);
			const [slashIdx, _setSlashIdx] = react.useState(0);
			const [slashQuery, _setSlashQuery] = react.useState('');
			const [isInTable, setIsInTable] = react.useState(false);
			const [embedModal, setEmbedModal] = react.useState(null); // { type: 'youtube'|'image'|'table', ... }
			const editorRef = react.useRef(null);
			const containerRef = react.useRef(null);
			const canvasRef = react.useRef(null);

			const slashStateRef = react.useRef({ menu: null, query: '', index: 0 });

			const setSlashMenu = (val) => {
				slashStateRef.current.menu = val;
				_setSlashMenu(val);
			};
			const setSlashQuery = (val) => {
				slashStateRef.current.query = val;
				_setSlashQuery(val);
			};
			const setSlashIdx = (val) => {
				if (typeof val === 'function') {
					slashStateRef.current.index = val(slashStateRef.current.index);
				} else {
					slashStateRef.current.index = val;
				}
				_setSlashIdx(slashStateRef.current.index);
			};

			const isMarkdown = filePath.endsWith('.md');
			const fileName = filePath.split('/').pop() || filePath;

			const slashItems = [
				{ category: 'BASIC BLOCKS', label: 'Heading 1', desc: 'Large title', icon: 'H1' },
				{ category: 'BASIC BLOCKS', label: 'Heading 2', desc: 'Section title', icon: 'H2' },
				{ category: 'BASIC BLOCKS', label: 'Heading 3', desc: 'Subsection title', icon: 'H3' },
				{ category: 'LISTS & TASKS', label: 'Task List', desc: 'Todo checkboxes', icon: '☑' },
				{ category: 'LISTS & TASKS', label: 'Bullet List', desc: 'Unordered list', icon: '•' },
				{ category: 'LISTS & TASKS', label: 'Numbered List', desc: 'Ordered list', icon: '1.' },
				{ category: 'ADVANCED & MEDIA', label: 'Table', desc: 'Custom Rows x Columns', icon: '📊' },
				{ category: 'ADVANCED & MEDIA', label: 'Code Block', desc: 'Syntax highlighting', icon: '</>' },
				{ category: 'ADVANCED & MEDIA', label: 'Blockquote', desc: 'Capture quote', icon: '❝' },
				{ category: 'ADVANCED & MEDIA', label: 'YouTube Video', desc: 'Embed YouTube player', icon: '🎥' },
				{ category: 'ADVANCED & MEDIA', label: 'Image', desc: 'Insert image URL', icon: '🖼️' },
				{ category: 'ADVANCED & MEDIA', label: 'Divider Line', desc: 'Horizontal rule', icon: '─' }
			];

			const filteredSlashItems = react.useMemo(() => {
				if (!slashQuery) return slashItems;
				const q = slashQuery.toLowerCase();
				return slashItems.filter(item => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
			}, [slashQuery]);

			const updateSlashFromDoc = (editor) => {
				if (!editor || !canvasRef.current) return;
				const { selection } = editor.state;
				if (!selection.empty) {
					setSlashMenu(null);
					return;
				}

				const { $from } = selection;
				const blockText = $from.parent.textContent;
				const offset = $from.parentOffset;
				const textBefore = blockText.slice(0, offset);

				const slashPos = textBefore.lastIndexOf('/');
				if (slashPos === -1) {
					setSlashMenu(null);
					return;
				}

				if (slashPos > 0 && !/\\s/.test(textBefore[slashPos - 1])) {
					setSlashMenu(null);
					return;
				}

				const query = textBefore.slice(slashPos + 1);
				if (query.includes(' ') || query.includes('\\n')) {
					setSlashMenu(null);
					return;
				}

				const containerRect = canvasRef.current.getBoundingClientRect();
				const slashAbsPos = $from.pos - query.length - 1;
				const coords = editor.view.coordsAtPos(slashAbsPos);
				const top = coords.bottom - containerRect.top + canvasRef.current.scrollTop + 6;
				const left = Math.min(coords.left - containerRect.left + canvasRef.current.scrollLeft, containerRect.width - 320);

				setSlashMenu({ top, left });
				setSlashQuery(query);
			};

			const executeSlashItem = (item) => {
				if (!editorRef.current) return;
				const editor = editorRef.current;

				setSlashMenu(null);

				const { $from } = editor.state.selection;
				const blockText = $from.parent.textContent;
				const posInBlock = $from.parentOffset;
				const textBeforeCursor = blockText.slice(0, posInBlock);
				const slashIndex = textBeforeCursor.lastIndexOf('/');

				let from = $from.pos - posInBlock + (slashIndex >= 0 ? slashIndex : 0);
				let to = $from.pos;

				if (item.label === 'Table') {
					if (from < to) {
						editor.chain().focus().deleteRange({ from, to }).run();
					}
					setEmbedModal({ type: 'table', rows: 3, cols: 3, withHeaderRow: true });
					return;
				}

				if (item.label === 'YouTube Video') {
					if (from < to) {
						editor.chain().focus().deleteRange({ from, to }).run();
					}
					setEmbedModal({ type: 'youtube', url: '' });
					return;
				}

				if (item.label === 'Image') {
					if (from < to) {
						editor.chain().focus().deleteRange({ from, to }).run();
					}
					setEmbedModal({ type: 'image', url: '' });
					return;
				}

				const chain = editor.chain().focus();
				if (from < to) {
					chain.deleteRange({ from, to });
				}

				if (item.label === 'Heading 1') {
					chain.setNode('heading', { level: 1 }).run();
				} else if (item.label === 'Heading 2') {
					chain.setNode('heading', { level: 2 }).run();
				} else if (item.label === 'Heading 3') {
					chain.setNode('heading', { level: 3 }).run();
				} else if (item.label === 'Task List') {
					chain.toggleTaskList().run();
				} else if (item.label === 'Bullet List') {
					chain.toggleBulletList().run();
				} else if (item.label === 'Numbered List') {
					chain.toggleOrderedList().run();
				} else if (item.label === 'Code Block') {
					chain.toggleCodeBlock().run();
				} else if (item.label === 'Blockquote') {
					chain.toggleBlockquote().run();
				} else if (item.label === 'Divider Line') {
					chain.setHorizontalRule().run();
				}
			};

			// Close slash menu on outside click
			react.useEffect(() => {
				const onPointerDown = (e) => {
					if (!e.target.closest('.dsh-slash-menu')) {
						setSlashMenu(null);
					}
				};
				window.addEventListener('pointerdown', onPointerDown);
				return () => window.removeEventListener('pointerdown', onPointerDown);
			}, []);

			// Initialize Official TipTap 3 Suite
			react.useEffect(() => {
				if (!containerRef.current || !isMarkdown || !isRichMode) return;

				if (window.TipTapBundle) {
					const {
						Editor, StarterKit, TaskList, TaskItem, Table, TableRow, TableCell, TableHeader,
						Image, Youtube, Underline, Highlight, TextAlign, CodeBlockLowlight, lowlight, Markdown
					} = window.TipTapBundle;

					const editor = new Editor({
						element: containerRef.current,
						extensions: [
							StarterKit.configure({
								heading: { levels: [1, 2, 3] },
								codeBlock: false
							}),
							TaskList,
							TaskItem.configure({ nested: true }),
							Table.configure({ resizable: true }),
							TableRow,
							TableCell,
							TableHeader,
							Image,
							Youtube.configure({ inline: false, nocookie: true }),
							Underline,
							Highlight,
							TextAlign.configure({ types: ['heading', 'paragraph'] }),
							CodeBlockLowlight.configure({ lowlight }),
							Markdown.configure({
								html: true,
								transformPastedText: true,
								transformCopiedText: true
							})
						],
						content: rawContent,
						onUpdate: ({ editor: ed }) => {
							updateSlashFromDoc(ed);
						},
						onSelectionUpdate: ({ editor: ed }) => {
							setIsInTable(ed.isActive('table'));
							updateSlashFromDoc(ed);
						},
						editorProps: {
							attributes: {
								class: 'dsh-tiptap-prose prose'
							},
							handleKeyDown: (view, event) => {
								const current = slashStateRef.current;
								if (current.menu) {
									const q = current.query.toLowerCase();
									const filtered = slashItems.filter(item => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));

									if (event.key === 'ArrowDown') {
										event.preventDefault();
										setSlashIdx((i) => (i + 1) % Math.max(1, filtered.length));
										return true;
									}
									if (event.key === 'ArrowUp') {
										event.preventDefault();
										setSlashIdx((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
										return true;
									}
									if (event.key === 'Enter') {
										event.preventDefault();
										const item = filtered[current.index] || filtered[0];
										if (item) {
											executeSlashItem(item);
										}
										return true;
									}
									if (event.key === 'Escape') {
										setSlashMenu(null);
										return true;
									}
								}
								return false;
							}
						}
					});

					editorRef.current = editor;

					return () => {
						editor.destroy();
						editorRef.current = null;
					};
				}
			}, [isRichMode, filePath]);

			const handleSave = async () => {
				let textToSave = rawContent;
				if (isMarkdown && isRichMode && editorRef.current && editorRef.current.storage && editorRef.current.storage.markdown) {
					textToSave = editorRef.current.storage.markdown.getMarkdown();
					setRawContent(textToSave);
				}
				setIsSaving(true);
				try {
					const res = await fetch('/filetree/save', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: filePath, content: textToSave })
					});
					const data = await res.json();
					if (data.ok) {
						setSavedToast(true);
						setTimeout(() => setSavedToast(false), 2000);
						if (onSave) onSave(textToSave);
					} else {
						alert('Save failed: ' + data.message);
					}
				} catch (err) {
					alert('Save error: ' + err.message);
				} finally {
					setIsSaving(false);
				}
			};

			const runCommand = (action) => {
				if (editorRef.current) {
					action(editorRef.current.chain().focus()).run();
				}
			};

			const handleEmbedSubmit = (e) => {
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

			react.useEffect(() => {
				const onKeyDown = (e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === 's') {
						e.preventDefault();
						handleSave();
					}
					if (e.key === 'Escape') {
						if (embedModal) {
							e.preventDefault();
							setEmbedModal(null);
							return;
						}
						if (!slashMenu) {
							e.preventDefault();
							onClose();
						}
					}
				};
				window.addEventListener('keydown', onKeyDown);
				return () => window.removeEventListener('keydown', onKeyDown);
			}, [rawContent, filePath, isRichMode, embedModal, slashMenu]);

			return react.createElement('div', { className: 'dsh-editor-panel-view' }, [
				// Editor Top Tab Bar
				react.createElement('div', { key: 'topbar', className: 'dsh-editor-topbar' }, [
					react.createElement('div', { key: 'tab', className: 'dsh-editor-tab-active' }, [
						react.createElement('span', { key: 'icon', className: 'dsh-tab-icon' }, isMarkdown ? '📄' : '💻'),
						react.createElement('span', { key: 'name', className: 'dsh-tab-name' }, fileName),
						react.createElement('button', { key: 'close', className: 'dsh-tab-close', title: 'Close Editor', onClick: onClose }, '✕')
					]),
					react.createElement('div', { key: 'actions', className: 'dsh-editor-top-actions' }, [
						isMarkdown ? react.createElement('div', { key: 'mode-switch', className: 'dsh-mode-switch' }, [
							react.createElement('button', {
								key: 'rich-btn',
								type: 'button',
								className: 'dsh-switch-btn ' + (isRichMode ? 'dsh-switch-btn-active' : ''),
								onClick: () => {
									if (!isRichMode) setIsRichMode(true);
								}
							}, '✨ Ultimate TipTap Suite'),
							react.createElement('button', {
								key: 'raw-btn',
								type: 'button',
								className: 'dsh-switch-btn ' + (!isRichMode ? 'dsh-switch-btn-active' : ''),
								onClick: () => {
									if (isRichMode && editorRef.current && editorRef.current.storage && editorRef.current.storage.markdown) {
										const md = editorRef.current.storage.markdown.getMarkdown();
										setRawContent(md);
									}
									setIsRichMode(false);
								}
							}, '💻 Code Source')
						]) : null,
						react.createElement('button', {
							key: 'save-btn',
							type: 'button',
							className: 'dsh-save-btn',
							disabled: isSaving,
							onClick: handleSave
						}, isSaving ? 'Saving...' : (savedToast ? '✓ Saved!' : '💾 Save (Ctrl+S)')),
						react.createElement('button', {
							key: 'close-btn',
							type: 'button',
							className: 'dsh-close-btn',
							title: 'Close Editor (Back to Chat)',
							onClick: onClose
						}, '✕')
					])
				]),

				// TipTap Toolbar (Driven directly by TipTap chain commands)
				isMarkdown && isRichMode ? react.createElement('div', { key: 'toolbar', className: 'dsh-tiptap-toolbar' }, [
					react.createElement('button', { key: 'h1', type: 'button', className: 'dsh-tb-tool', title: 'Heading 1 (or type /h1)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 1 })) }, 'H1'),
					react.createElement('button', { key: 'h2', type: 'button', className: 'dsh-tb-tool', title: 'Heading 2 (or type /h2)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 2 })) }, 'H2'),
					react.createElement('button', { key: 'h3', type: 'button', className: 'dsh-tb-tool', title: 'Heading 3 (or type /h3)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeading({ level: 3 })) }, 'H3'),
					react.createElement('span', { key: 'sep1', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'b', type: 'button', className: 'dsh-tb-tool dsh-bold', title: 'Bold (Ctrl+B)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBold()) }, 'B'),
					react.createElement('button', { key: 'i', type: 'button', className: 'dsh-tb-tool dsh-italic', title: 'Italic (Ctrl+I)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleItalic()) }, 'I'),
					react.createElement('button', { key: 'u', type: 'button', className: 'dsh-tb-tool dsh-underline', title: 'Underline (Ctrl+U)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleUnderline()) }, 'U'),
					react.createElement('button', { key: 's', type: 'button', className: 'dsh-tb-tool dsh-strike', title: 'Strikethrough', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleStrike()) }, 'S'),
					react.createElement('button', { key: 'hl', type: 'button', className: 'dsh-tb-tool', title: 'Highlight Text', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHighlight()) }, '🎨 Mark'),
					react.createElement('span', { key: 'sep2', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'ul', type: 'button', className: 'dsh-tb-tool', title: 'Bullet List', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBulletList()) }, '• List'),
					react.createElement('button', { key: 'ol', type: 'button', className: 'dsh-tb-tool', title: 'Numbered List', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleOrderedList()) }, '1. List'),
					react.createElement('button', { key: 'task', type: 'button', className: 'dsh-tb-tool', title: 'Task List (Checkboxes)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleTaskList()) }, '☑ Task'),
					react.createElement('button', { key: 'table', type: 'button', className: 'dsh-tb-tool', title: 'Insert Custom Table', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'table', rows: 3, cols: 3, withHeaderRow: true }) }, '📊 Table'),
					react.createElement('button', { key: 'quote', type: 'button', className: 'dsh-tb-tool', title: 'Blockquote', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBlockquote()) }, '❝ Quote'),
					react.createElement('button', { key: 'code', type: 'button', className: 'dsh-tb-tool', title: 'Code Block (Syntax Highlighted)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleCodeBlock()) }, '</> Code'),
					react.createElement('button', { key: 'yt', type: 'button', className: 'dsh-tb-tool', title: 'Embed YouTube Video', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'youtube', url: '' }) }, '🎥 YouTube'),
					react.createElement('button', { key: 'img', type: 'button', className: 'dsh-tb-tool', title: 'Insert Image URL', onMouseDown: (e) => e.preventDefault(), onClick: () => setEmbedModal({ type: 'image', url: '' }) }, '🖼️ Image'),
					react.createElement('button', { key: 'hr', type: 'button', className: 'dsh-tb-tool', title: 'Divider Line', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.setHorizontalRule()) }, '─ Line')
				]) : null,

				// Contextual Interactive Table Action Bar (Appears when cursor is inside any table)
				isMarkdown && isRichMode && isInTable ? react.createElement('div', { key: 'table-toolbar', className: 'dsh-table-toolbar' }, [
					react.createElement('span', { key: 'tbl-label', style: { fontSize: '11px', fontWeight: '700', color: '#15803d', marginRight: '4px' } }, '📊 TABLE TOOLS:'),
					react.createElement('button', { key: 'row-after', type: 'button', className: 'dsh-tb-table-btn', title: 'Add Row Below (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addRowAfter()) }, '➕ Row Below'),
					react.createElement('button', { key: 'row-before', type: 'button', className: 'dsh-tb-table-btn', title: 'Add Row Above (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addRowBefore()) }, '➕ Row Above'),
					react.createElement('button', { key: 'col-after', type: 'button', className: 'dsh-tb-table-btn', title: 'Add Column Right (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addColumnAfter()) }, '➕ Col Right'),
					react.createElement('button', { key: 'col-before', type: 'button', className: 'dsh-tb-table-btn', title: 'Add Column Left (+)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.addColumnBefore()) }, '➕ Col Left'),
					react.createElement('span', { key: 'sep-tbl', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'toggle-hdr', type: 'button', className: 'dsh-tb-table-btn', title: 'Toggle Header Row', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHeaderRow()) }, '🔲 Header Row'),
					react.createElement('button', { key: 'del-row', type: 'button', className: 'dsh-tb-table-btn dsh-tb-table-btn-danger', title: 'Delete Current Row (-)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteRow()) }, '➖ Del Row'),
					react.createElement('button', { key: 'del-col', type: 'button', className: 'dsh-tb-table-btn dsh-tb-table-btn-danger', title: 'Delete Current Column (-)', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteColumn()) }, '➖ Del Col'),
					react.createElement('button', { key: 'del-tbl', type: 'button', className: 'dsh-tb-table-btn dsh-tb-table-btn-danger', title: 'Delete Entire Table', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.deleteTable()) }, '🗑️ Delete Table')
				]) : null,

				// TipTap Canvas / Code Canvas
				react.createElement('div', { key: 'workspace', ref: canvasRef, className: 'dsh-editor-canvas' }, [
					isMarkdown && isRichMode
						? react.createElement('div', {
							key: 'tt-container',
							ref: containerRef,
							className: 'dsh-tiptap-container'
						})
						: react.createElement('div', { key: 'code-container', className: 'dsh-code-canvas' },
							react.createElement('textarea', {
								className: 'dsh-code-textarea',
								value: rawContent,
								spellCheck: false,
								onChange: (e) => setRawContent(e.target.value),
								onKeyDown: (e) => {
									if (e.key === 'Tab') {
										e.preventDefault();
										const start = e.target.selectionStart;
										const end = e.target.selectionEnd;
										const updated = rawContent.substring(0, start) + '  ' + rawContent.substring(end);
										setRawContent(updated);
										setTimeout(() => {
											e.target.selectionStart = e.target.selectionEnd = start + 2;
										}, 0);
									}
								}
							})
						),

					// Caret-Anchored Slash Command Popup Menu
					slashMenu && filteredSlashItems.length > 0 ? react.createElement('div', {
						key: 'slash-popup',
						className: 'dsh-slash-menu',
						style: { top: slashMenu.top + 'px', left: slashMenu.left + 'px' }
					}, [
						react.createElement('div', { key: 'hdr', className: 'dsh-slash-header' }, slashQuery ? 'Matching Commands (' + slashQuery + ')' : 'Insert Blocks & Media'),
						...filteredSlashItems.map((item, idx) => react.createElement('button', {
							key: item.label,
							type: 'button',
							className: 'dsh-slash-item ' + (idx === slashIdx ? 'dsh-slash-item-selected' : ''),
							onMouseDown: (e) => e.preventDefault(),
							onClick: () => executeSlashItem(item)
						}, [
							react.createElement('span', { key: 'icon', className: 'dsh-slash-icon' }, item.icon),
							react.createElement('span', { key: 'label' }, item.label),
							react.createElement('span', { key: 'desc', className: 'dsh-slash-desc' }, item.desc)
						]))
					]) : null
				]),

				// Sleek Inline Modal Dialog for Table Configuration, YouTube & Image Embeds
				embedModal ? react.createElement('div', {
					key: 'embed-dialog-backdrop',
					className: 'dsh-modal-backdrop',
					onClick: (e) => { if (e.target === e.currentTarget) setEmbedModal(null); }
				}, react.createElement('div', { className: 'dsh-modal-card' }, [
					react.createElement('div', { key: 'head', className: 'dsh-modal-head' }, [
						react.createElement('span', { key: 'title' },
							embedModal.type === 'youtube' ? '🎥 Embed YouTube Video' :
							embedModal.type === 'image' ? '🖼️ Insert Image URL' : '📊 Configure Table (Rows × Columns)'
						),
						react.createElement('button', { key: 'close', className: 'dsh-tab-close', onClick: () => setEmbedModal(null) }, '✕')
					]),
					react.createElement('form', { key: 'form', onSubmit: handleEmbedSubmit }, [
						react.createElement('div', { key: 'body', className: 'dsh-modal-body' },
							embedModal.type === 'table' ? [
								react.createElement('div', { key: 'row-input', className: 'dsh-modal-row' }, [
									react.createElement('span', { key: 'lbl1', className: 'dsh-modal-label' }, 'Number of Rows:'),
									react.createElement('input', {
										key: 'inp-rows',
										type: 'number',
										min: 1,
										max: 30,
										required: true,
										autoFocus: true,
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
										min: 1,
										max: 15,
										required: true,
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
									autoFocus: true,
									required: true,
									placeholder: embedModal.type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/image.png',
									value: embedModal.url,
									className: 'dsh-modal-input',
									onChange: (e) => setEmbedModal({ ...embedModal, url: e.target.value })
								})
							]
						),
						react.createElement('div', { key: 'foot', className: 'dsh-modal-foot' }, [
							react.createElement('button', {
								key: 'cancel',
								type: 'button',
								className: 'dsh-modal-btn-cancel',
								onClick: () => setEmbedModal(null)
							}, 'Cancel (Esc)'),
							react.createElement('button', {
								key: 'submit',
								type: 'submit',
								className: 'dsh-modal-btn-submit'
							}, embedModal.type === 'youtube' ? 'Embed Video' : embedModal.type === 'image' ? 'Insert Image' : 'Insert Table')
						])
					])
				])) : null
			]);
		}
  `

  if (!content.includes('OfficialTipTapEditor')) {
    const codeToInject = tiptapBundleCode + '\n\n' + officialTipTapComponent + '\n\n' +
      'if (typeof document !== "undefined" && !document.getElementById("dsh-vscode-editor-css")) {\n\tconst s = document.createElement("style");\n\ts.id = "dsh-vscode-editor-css";\n\ts.textContent = ' + JSON.stringify(vscodeEditorStyles) + ';\n\tdocument.head.appendChild(s);\n}\n\n' +
      '// ── the right-column file tree panel ─────────────────────────────────────'

    content = content.replace(
      '// ── the right-column file tree panel ─────────────────────────────────────',
      () => codeToInject
    )
  }

  // C. Update FileTreePanel to support Left-Sidebar Explorer & Center Editor
  if (!content.includes('const [editingFile, setEditingFile]')) {
    content = content.replace(
      'const [showHidden, setShowHidden] = react.useState(false);',
      `const [showHidden, setShowHidden] = react.useState(false);
			const [editingFile, setEditingFile] = react.useState(null);
			const [fileContent, setFileContent] = react.useState('');

			const openFile = async (filePath) => {
				try {
					const res = await fetch('/filetree/read?path=' + encodeURIComponent(filePath));
					const data = await res.json();
					if (data.ok) {
						setEditingFile(data.path);
						setFileContent(data.content || '');
					} else {
						alert('Cannot open file: ' + data.message);
					}
				} catch (err) {
					alert('Error reading file: ' + err.message);
				}
			};`
    )

    content = content.replace(
      'react.createElement("span", { key: "name", className: "ft-name ft-name-" + entry.type, title: entry.path }, entry.name),',
      `react.createElement("span", {
							key: "name",
							className: "ft-name ft-name-" + entry.type,
							title: isDir ? entry.path : (entry.path + " (Click to open in TipTap Editor)"),
							onClick: () => { if (!isDir) openFile(entry.path); }
						}, entry.name),`
    )

    content = content.replace(
      'return react.createElement("div", { className: "ft-panel" }, [',
      `return react.createElement(react.Fragment, null, [
				editingFile ? react.createElement(OfficialTipTapEditor, {
					key: "editor-canvas",
					filePath: editingFile,
					initialContent: fileContent,
					onClose: () => setEditingFile(null),
					onSave: (newContent) => setFileContent(newContent)
				}) : null,
				react.createElement("div", { key: "panel", className: "ft-panel" }, [`
    )

    content = content.replace(
      'react.createElement("div", { key: "body", className: "ft-body" },\n\t\t\t\t\troot === null\n\t\t\t\t\t\t? react.createElement("div", { className: "ft-hint" }, "Open a session to display workspace files")\n\t\t\t\t\t\t: react.createElement("div", { className: "ft-tree" }, renderLevel(root, 0))\n\t\t\t\t)\n\t\t\t]);\n\t\t}',
      `react.createElement("div", { key: "body", className: "ft-body" },
					root === null
						? react.createElement("div", { className: "ft-hint" }, "Open a session to display workspace files")
						: react.createElement("div", { className: "ft-tree" }, renderLevel(root, 0))
				)
			])
		]);
	}`
    )
  }

  fs.writeFileSync(clientFile, content, 'utf8')
  console.log('[✓] Successfully patched dsh-local-filetree with Document-Driven Live Slash Filtering!')
}
