import fs from 'fs'
import path from 'path'
import os from 'os'

const baseDir = path.join(os.homedir(), '.dsh/profiles/web/node_modules/dsh-local-filetree/lib')
const serverFile = path.join(baseDir, 'index.js')
const clientFile = path.join(baseDir, 'client.js')

// ==========================================
// 1. PATCH SERVER (Add Read & Save file API)
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

// ==========================================
// 2. PATCH CLIENT (VSCode-like Editor & TipTap Markdown)
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

  // B. TipTap-style Markdown Parser & Rich Editor Component
  const tiptapEditorCode = `
		// ── TipTap Markdown Parser & Converter ──────────────────────────────────
		function markdownToHtml(md) {
			if (!md) return '<p><br></p>';
			let html = md
				.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
				.replace(/^### (.*$)/gim, '<h3>$1</h3>')
				.replace(/^## (.*$)/gim, '<h2>$1</h2>')
				.replace(/^# (.*$)/gim, '<h1>$1</h1>')
				.replace(/^\\> (.*$)/gim, '<blockquote>$1</blockquote>')
				.replace(/\\*\\*(.*?)\\*\\*/gim, '<b>$1</b>')
				.replace(/\\*(.*?)\\*/gim, '<i>$1</i>')
				.replace(/~~(.*?)~~/gim, '<strike>$1</strike>')
				.replace(/\`\`\`([a-z0-9_-]*)\\n([\\s\\S]*?)\`\`\`/gim, '<pre data-lang="$1"><code>$2</code></pre>')
				.replace(/\`([^\\n\`]+)\`/gim, '<code>$1</code>')
				.replace(/^- \\[x\\] (.*$)/gim, '<div class="dsh-task-item"><input type="checkbox" checked disabled /> <span>$1</span></div>')
				.replace(/^- \\[ \\] (.*$)/gim, '<div class="dsh-task-item"><input type="checkbox" disabled /> <span>$1</span></div>')
				.replace(/^- (.*$)/gim, '<li>$1</li>');

			html = html.replace(/(<li>[\\s\\S]*?<\\/li>)/gim, '<ul>$1</ul>');
			const lines = html.split('\\n');
			return lines.map(line => {
				const trimmed = line.trim();
				if (!trimmed) return '<p><br></p>';
				if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<pre') || trimmed.startsWith('<div')) return line;
				return '<p>' + line + '</p>';
			}).join('');
		}

		function htmlToMarkdown(element) {
			if (!element) return '';
			let md = '';
			element.childNodes.forEach(node => {
				if (node.nodeType === Node.TEXT_NODE) {
					md += node.textContent;
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					const tag = node.tagName.toLowerCase();
					if (tag === 'h1') md += '# ' + node.textContent.trim() + '\\n\\n';
					else if (tag === 'h2') md += '## ' + node.textContent.trim() + '\\n\\n';
					else if (tag === 'h3') md += '### ' + node.textContent.trim() + '\\n\\n';
					else if (tag === 'p') {
						const text = node.textContent.trim();
						md += (text ? text : '') + '\\n\\n';
					}
					else if (tag === 'blockquote') md += '> ' + node.textContent.trim() + '\\n\\n';
					else if (tag === 'pre') {
						const lang = node.getAttribute('data-lang') || '';
						md += '\`\`\`' + lang + '\\n' + node.textContent + '\\n\`\`\`\\n\\n';
					}
					else if (tag === 'ul') {
						node.childNodes.forEach(li => {
							if (li.nodeType === Node.ELEMENT_NODE && li.tagName.toLowerCase() === 'li') {
								md += '- ' + li.textContent.trim() + '\\n';
							}
						});
						md += '\\n';
					}
					else if (node.classList && node.classList.contains('dsh-task-item')) {
						const chk = node.querySelector('input[type="checkbox"]');
						const checked = chk && chk.checked;
						md += (checked ? '- [x] ' : '- [ ] ') + node.textContent.trim() + '\\n';
					}
					else {
						md += node.textContent;
					}
				}
			});
			return md.trim();
		}

		// ── TipTap Markdown & Code Editor Component ──────────────────────────────
		function TipTapMarkdownEditor({ filePath, initialContent, onClose, onSave }) {
			const [content, setContent] = react.useState(initialContent);
			const [isRichMode, setIsRichMode] = react.useState(filePath.endsWith('.md'));
			const [isSaving, setIsSaving] = react.useState(false);
			const [savedToast, setSavedToast] = react.useState(false);
			const richRef = react.useRef(null);

			const isMarkdown = filePath.endsWith('.md');
			const fileName = filePath.split('/').pop() || filePath;

			react.useEffect(() => {
				if (richRef.current && isRichMode) {
					richRef.current.innerHTML = markdownToHtml(content);
				}
			}, [isRichMode]);

			const handleSave = async () => {
				let textToSave = content;
				if (isMarkdown && isRichMode && richRef.current) {
					textToSave = htmlToMarkdown(richRef.current);
					setContent(textToSave);
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

			const execFormat = (command, value = null) => {
				document.execCommand(command, false, value);
				if (richRef.current) richRef.current.focus();
			};

			const formatBlock = (tag) => {
				document.execCommand('formatBlock', false, tag);
				if (richRef.current) richRef.current.focus();
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
			}, [content, filePath, isRichMode]);

			return react.createElement('div', { className: 'dsh-editor-panel-view' }, [
				// Editor Top Tab Bar
				react.createElement('div', { key: 'topbar', className: 'dsh-editor-topbar' }, [
					react.createElement('div', { key: 'tab', className: 'dsh-editor-tab-active' }, [
						react.createElement('span', { key: 'icon', className: 'dsh-tab-icon' }, isMarkdown ? '📄' : '💻'),
						react.createElement('span', { key: 'name', className: 'dsh-tab-name' }, fileName),
						react.createElement('button', { key: 'close', className: 'dsh-tab-close', onClick: onClose }, '✕')
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
							}, '✨ TipTap Rich WYSIWYG'),
							react.createElement('button', {
								key: 'raw-btn',
								type: 'button',
								className: 'dsh-switch-btn ' + (!isRichMode ? 'dsh-switch-btn-active' : ''),
								onClick: () => {
									if (isRichMode && richRef.current) {
										const md = htmlToMarkdown(richRef.current);
										setContent(md);
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
							title: 'Close Editor',
							onClick: onClose
						}, '✕')
					])
				]),

				// TipTap Toolbar (When in Rich WYSIWYG Mode)
				isMarkdown && isRichMode ? react.createElement('div', { key: 'toolbar', className: 'dsh-tiptap-toolbar' }, [
					react.createElement('button', { key: 'h1', type: 'button', className: 'dsh-tb-tool', title: 'Heading 1', onClick: () => formatBlock('<h1>') }, 'H1'),
					react.createElement('button', { key: 'h2', type: 'button', className: 'dsh-tb-tool', title: 'Heading 2', onClick: () => formatBlock('<h2>') }, 'H2'),
					react.createElement('button', { key: 'h3', type: 'button', className: 'dsh-tb-tool', title: 'Heading 3', onClick: () => formatBlock('<h3>') }, 'H3'),
					react.createElement('span', { key: 'sep1', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'b', type: 'button', className: 'dsh-tb-tool dsh-bold', title: 'Bold (Ctrl+B)', onClick: () => execFormat('bold') }, 'B'),
					react.createElement('button', { key: 'i', type: 'button', className: 'dsh-tb-tool dsh-italic', title: 'Italic (Ctrl+I)', onClick: () => execFormat('italic') }, 'I'),
					react.createElement('button', { key: 's', type: 'button', className: 'dsh-tb-tool dsh-strike', title: 'Strikethrough', onClick: () => execFormat('strikeThrough') }, 'S'),
					react.createElement('span', { key: 'sep2', className: 'dsh-tb-sep' }),
					react.createElement('button', { key: 'ul', type: 'button', className: 'dsh-tb-tool', title: 'Bullet List', onClick: () => execFormat('insertUnorderedList') }, '• List'),
					react.createElement('button', { key: 'ol', type: 'button', className: 'dsh-tb-tool', title: 'Numbered List', onClick: () => execFormat('insertOrderedList') }, '1. List'),
					react.createElement('button', { key: 'quote', type: 'button', className: 'dsh-tb-tool', title: 'Blockquote', onClick: () => formatBlock('<blockquote>') }, '❝ Quote'),
					react.createElement('button', { key: 'code', type: 'button', className: 'dsh-tb-tool', title: 'Code Block', onClick: () => formatBlock('<pre>') }, '</> Code'),
					react.createElement('button', { key: 'hr', type: 'button', className: 'dsh-tb-tool', title: 'Horizontal Line', onClick: () => execFormat('insertHorizontalRule') }, '─ Line')
				]) : null,

				// Editor Workspace Area
				react.createElement('div', { key: 'workspace', className: 'dsh-editor-canvas' },
					isMarkdown && isRichMode
						? react.createElement('div', {
							ref: richRef,
							className: 'dsh-tiptap-content prose',
							contentEditable: true,
							spellCheck: false,
							suppressContentEditableWarning: true
						})
						: react.createElement('div', { className: 'dsh-code-canvas' },
							react.createElement('textarea', {
								className: 'dsh-code-textarea',
								value: content,
								spellCheck: false,
								onChange: (e) => setContent(e.target.value),
								onKeyDown: (e) => {
									if (e.key === 'Tab') {
										e.preventDefault();
										const start = e.target.selectionStart;
										const end = e.target.selectionEnd;
										const updated = content.substring(0, start) + '  ' + content.substring(end);
										setContent(updated);
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

		// ── VS Code + Codex Style Layout CSS ────────────────────────────────────
		const vscodeEditorStyles = \`
		.dsh-editor-panel-view {
			position: fixed; top: 0; bottom: 0; left: 240px; right: 340px; z-index: 40;
			background: var(--dsw-alias-bg-base, #ffffff);
			display: flex; flex-direction: column; overflow: hidden;
			box-shadow: -2px 0 12px rgba(0,0,0,0.06);
		}
		@media (max-width: 1024px) {
			.dsh-editor-panel-view { left: 60px; right: 0; }
		}
		.dsh-editor-topbar {
			height: 38px; background: var(--dsw-alias-bg-subtle, #f3f4f6);
			border-bottom: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			display: flex; align-items: center; justify-content: space-between;
			padding: 0 12px; flex-shrink: 0;
		}
		.dsh-editor-tab-active {
			background: var(--dsw-alias-bg-base, #ffffff);
			height: 38px; padding: 0 14px; display: flex; align-items: center; gap: 8px;
			border-right: 1px solid var(--dsw-alias-border-l2, #e5e7eb);
			border-top: 2px solid #3b82f6; font-size: 13px; font-weight: 600;
			color: var(--dsw-alias-label-primary, #111827);
		}
		.dsh-tab-close {
			border: none; background: transparent; font-size: 11px; cursor: pointer;
			color: var(--dsw-alias-label-tertiary, #9ca3af); border-radius: 4px; padding: 2px 4px;
		}
		.dsh-tab-close:hover { background: rgba(0,0,0,0.08); color: #ef4444; }
		.dsh-editor-top-actions { display: flex; align-items: center; gap: 10px; }
		.dsh-mode-switch { display: flex; background: var(--dsw-alias-border-l1, #e5e7eb); border-radius: 6px; padding: 2px; }
		.dsh-switch-btn {
			border: none; background: transparent; padding: 3px 8px; font-size: 11.5px;
			font-weight: 600; border-radius: 4px; cursor: pointer; color: var(--dsw-alias-label-secondary, #4b5563);
		}
		.dsh-switch-btn-active { background: #fff; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
		.dsh-save-btn {
			background: #10b981; color: #fff; border: none; padding: 4px 10px; border-radius: 6px;
			font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;
		}
		.dsh-save-btn:hover { background: #059669; }
		.dsh-close-btn {
			background: transparent; border: none; font-size: 14px; cursor: pointer;
			color: var(--dsw-alias-label-secondary, #6b7280); padding: 4px 6px; border-radius: 4px;
		}
		.dsh-close-btn:hover { background: rgba(0,0,0,0.06); }
		.dsh-tiptap-toolbar {
			background: var(--dsw-alias-bg-base, #ffffff);
			border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
			padding: 6px 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex-shrink: 0;
		}
		.dsh-tb-tool {
			border: 1px solid transparent; background: transparent; padding: 3px 7px;
			border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
			color: var(--dsw-alias-label-secondary, #374151); min-width: 24px; text-align: center;
		}
		.dsh-tb-tool:hover { background: var(--dsw-alias-interactive-bg-hover, #f3f4f6); border-color: var(--dsw-alias-border-l2, #d1d5db); }
		.dsh-tb-sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l2, #e5e7eb); margin: 0 4px; }
		.dsh-bold { font-weight: 800; }
		.dsh-italic { font-style: italic; }
		.dsh-strike { text-decoration: line-through; }
		.dsh-editor-canvas { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
		.dsh-tiptap-content {
			flex: 1; padding: 24px 36px; outline: none; font-size: 15px; line-height: 1.7;
			color: var(--dsw-alias-label-primary, #111827); max-width: 900px; margin: 0 auto; width: 100%;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		}
		.dsh-tiptap-content h1 { font-size: 26px; font-weight: 800; margin: 16px 0 10px; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; }
		.dsh-tiptap-content h2 { font-size: 20px; font-weight: 700; margin: 14px 0 8px; color: #1f2937; }
		.dsh-tiptap-content h3 { font-size: 16px; font-weight: 600; margin: 12px 0 6px; color: #374151; }
		.dsh-tiptap-content p { margin: 6px 0; }
		.dsh-tiptap-content blockquote { border-left: 4px solid #3b82f6; padding-left: 12px; color: #4b5563; margin: 8px 0; font-style: italic; }
		.dsh-tiptap-content pre { background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; margin: 10px 0; }
		.dsh-tiptap-content ul, .dsh-tiptap-content ol { padding-left: 24px; margin: 6px 0; }
		.dsh-tiptap-content li { margin: 3px 0; }
		.dsh-task-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
		.dsh-code-canvas { flex: 1; display: flex; }
		.dsh-code-textarea {
			width: 100%; height: 100%; min-height: 100%; border: none; outline: none; padding: 16px 20px;
			font-family: 'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace;
			font-size: 13.5px; line-height: 1.6; background: var(--dsw-alias-bg-base, #ffffff);
			color: var(--dsw-alias-label-primary, #111827); resize: none;
		}
		.ft-name-file { cursor: pointer; }
		.ft-name-file:hover { color: #3b82f6 !important; text-decoration: underline; }
		.ft-row:hover { background: rgba(59, 130, 246, 0.08); border-radius: 4px; }
		\`;

		if (typeof document !== "undefined" && !document.getElementById("dsh-vscode-editor-css")) {
			const s = document.createElement("style");
			s.id = "dsh-vscode-editor-css";
			s.textContent = vscodeEditorStyles;
			document.head.appendChild(s);
		}
  `

  if (!content.includes('dsh-vscode-editor-css')) {
    content = content.replace(
      '// ── the right-column file tree panel ─────────────────────────────────────',
      `${tiptapEditorCode}\n\n\t\t// ── the right-column file tree panel ─────────────────────────────────────`
    )
  }

  // C. Update FileTreePanel to mount editor in center column (VS Code style!)
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
							title: isDir ? entry.path : (entry.path + " (Click to open editor)"),
							onClick: () => { if (!isDir) openFile(entry.path); }
						}, entry.name),`
    )

    content = content.replace(
      'return react.createElement("div", { className: "ft-panel" }, [',
      `return react.createElement(react.Fragment, null, [
				editingFile ? react.createElement(TipTapMarkdownEditor, {
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
  console.log('[✓] Successfully applied TipTap Markdown & VS Code Editor layout patch!')
}
