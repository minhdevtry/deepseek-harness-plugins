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
// 2. PATCH CLIENT (Official TipTap 3 Editor & VS Code Layout)
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
			height: 40px; background: var(--dsw-alias-bg-subtle, #f9fafb);
			border-bottom: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			display: flex; align-items: center; justify-content: space-between;
			padding: 0 14px; flex-shrink: 0;
		}
		.dsh-editor-tab-active {
			background: var(--dsw-alias-bg-base, #ffffff);
			height: 40px; padding: 0 16px; display: flex; align-items: center; gap: 8px;
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
		.dsh-tb-tool {
			border: 1px solid transparent; background: transparent; padding: 3px 8px;
			border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
			color: var(--dsw-alias-label-secondary, #374151); min-width: 26px; text-align: center;
		}
		.dsh-tb-tool:hover { background: var(--dsw-alias-interactive-bg-hover, #f3f4f6); border-color: var(--dsw-alias-border-l2, #d1d5db); }
		.dsh-tb-sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l2, #e5e7eb); margin: 0 4px; }
		.dsh-bold { font-weight: 800; }
		.dsh-italic { font-style: italic; }
		.dsh-strike { text-decoration: line-through; }
		.dsh-editor-canvas { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
		.dsh-tiptap-container { flex: 1; display: flex; flex-direction: column; padding: 28px 48px; max-width: 920px; margin: 0 auto; width: 100%; box-sizing: border-box; }
		.dsh-tiptap-prose {
			outline: none; font-size: 15px; line-height: 1.75; min-height: 500px;
			color: var(--dsw-alias-label-primary, #111827); width: 100%;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		}
		.dsh-tiptap-prose h1 { font-size: 28px; font-weight: 800; margin: 20px 0 10px; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; line-height: 1.3; }
		.dsh-tiptap-prose h2 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; color: #1f2937; line-height: 1.35; }
		.dsh-tiptap-prose h3 { font-size: 17px; font-weight: 600; margin: 14px 0 6px; color: #374151; }
		.dsh-tiptap-prose p { margin: 6px 0; }
		.dsh-tiptap-prose blockquote { border-left: 4px solid #3b82f6; padding-left: 14px; color: #4b5563; margin: 10px 0; font-style: italic; background: rgba(59,130,246,0.03); border-radius: 0 6px 6px 0; }
		.dsh-tiptap-prose pre { background: #1e293b; color: #f8fafc; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 13px; margin: 12px 0; }
		.dsh-tiptap-prose ul, .dsh-tiptap-prose ol { padding-left: 24px; margin: 6px 0; }
		.dsh-tiptap-prose li { margin: 4px 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] { list-style: none; padding: 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] li { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
		.dsh-tiptap-prose ul[data-type="taskList"] li > label { display: flex; align-items: center; }
		.dsh-tiptap-prose ul[data-type="taskList"] li > label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6; }
		.dsh-tiptap-prose ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; opacity: 0.55; }
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
			const editorRef = react.useRef(null);
			const containerRef = react.useRef(null);

			const isMarkdown = filePath.endsWith('.md');
			const fileName = filePath.split('/').pop() || filePath;

			react.useEffect(() => {
				if (!containerRef.current || !isMarkdown || !isRichMode) return;

				if (window.TipTapBundle) {
					const { Editor, StarterKit, TaskList, TaskItem, Markdown } = window.TipTapBundle;
					const editor = new Editor({
						element: containerRef.current,
						extensions: [
							StarterKit.configure({
								heading: { levels: [1, 2, 3] }
							}),
							TaskList,
							TaskItem.configure({ nested: true }),
							Markdown.configure({
								html: true,
								transformPastedText: true,
								transformCopiedText: true
							})
						],
						content: rawContent,
						editorProps: {
							attributes: {
								class: 'dsh-tiptap-prose prose'
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

			react.useEffect(() => {
				const onKeyDown = (e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === 's') {
						e.preventDefault();
						handleSave();
					}
					if (e.key === 'Escape') {
						e.preventDefault();
						onClose();
					}
				};
				window.addEventListener('keydown', onKeyDown);
				return () => window.removeEventListener('keydown', onKeyDown);
			}, [rawContent, filePath, isRichMode]);

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
									if (!isRichMode) {
										setIsRichMode(true);
									}
								}
							}, '✨ Official TipTap WYSIWYG'),
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

				// TipTap Toolbar
				isMarkdown && isRichMode ? react.createElement('div', { key: 'toolbar', className: 'dsh-tiptap-toolbar' }, [
					react.createElement('button', { key: 'h1', type: 'button', className: 'dsh-tb-tool', title: 'Heading 1 (or type # + Space)', onClick: () => runCommand(c => c.toggleHeading({ level: 1 })) }, 'H1'),
					react.createElement('button', { key: 'h2', type: 'button', className: 'dsh-tb-tool', title: 'Heading 2 (or type ## + Space)', onClick: () => runCommand(c => c.toggleHeading({ level: 2 })) }, 'H2'),
					react.createElement('button', { key: 'h3', type: 'button', className: 'dsh-tb-tool', title: 'Heading 3 (or type ### + Space)', onClick: () => runCommand(c => c.toggleHeading({ level: 3 })) }, 'H3'),
					react.createElement('span', { key: 'sep1', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'b', type: 'button', className: 'dsh-tb-tool dsh-bold', title: 'Bold (Ctrl+B or **text**)', onClick: () => runCommand(c => c.toggleBold()) }, 'B'),
					react.createElement('button', { key: 'i', type: 'button', className: 'dsh-tb-tool dsh-italic', title: 'Italic (Ctrl+I or *text*)', onClick: () => runCommand(c => c.toggleItalic()) }, 'I'),
					react.createElement('button', { key: 's', type: 'button', className: 'dsh-tb-tool dsh-strike', title: 'Strikethrough (~~text~~)', onClick: () => runCommand(c => c.toggleStrike()) }, 'S'),
					react.createElement('span', { key: 'sep2', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'ul', type: 'button', className: 'dsh-tb-tool', title: 'Bullet List (or type - + Space)', onClick: () => runCommand(c => c.toggleBulletList()) }, '• List'),
					react.createElement('button', { key: 'ol', type: 'button', className: 'dsh-tb-tool', title: 'Numbered List (or type 1. + Space)', onClick: () => runCommand(c => c.toggleOrderedList()) }, '1. List'),
					react.createElement('button', { key: 'task', type: 'button', className: 'dsh-tb-tool', title: 'Task List (or type [ ] + Space)', onClick: () => runCommand(c => c.toggleTaskList()) }, '☑ Task'),
					react.createElement('button', { key: 'quote', type: 'button', className: 'dsh-tb-tool', title: 'Blockquote (or type > + Space)', onClick: () => runCommand(c => c.toggleBlockquote()) }, '❝ Quote'),
					react.createElement('button', { key: 'code', type: 'button', className: 'dsh-tb-tool', title: 'Code Block (or type \`\`\` + Enter)', onClick: () => runCommand(c => c.toggleCodeBlock()) }, '</> Code'),
					react.createElement('button', { key: 'hr', type: 'button', className: 'dsh-tb-tool', title: 'Horizontal Line (or type --- + Enter)', onClick: () => runCommand(c => c.setHorizontalRule()) }, '─ Line')
				]) : null,

				// TipTap Canvas / Code Canvas
				react.createElement('div', { key: 'workspace', className: 'dsh-editor-canvas' },
					isMarkdown && isRichMode
						? react.createElement('div', {
							ref: containerRef,
							className: 'dsh-tiptap-container'
						})
						: react.createElement('div', { className: 'dsh-code-canvas' },
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
						)
				)
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
  console.log('[✓] Successfully patched dsh-local-filetree with OFFICIAL TipTap 3 Editor Engine!')
}
