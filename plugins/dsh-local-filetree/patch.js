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
// 2. REBUILD CLIENT (Robust File Tree rendering)
// ==========================================
if (fs.existsSync(clientFile)) {
  const fullClientJs = `window.__ModuleLoader__.load({
	id: "dsh-local-filetree",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		// ── styles (injected at materialization; claimed by the module system) ──
		const css = [
			".ft-panel{box-sizing:border-box;height:100%;flex-direction:column;display:flex;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}",
			".ft-header{flex:none;border-bottom:1px solid var(--dsw-alias-border-l2);padding:10px 12px;gap:6px;flex-direction:column;display:flex;min-width:0}",
			".ft-title{font-size:14px;font-weight:600;line-height:20px}",
			".ft-root{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".ft-tools{display:flex;flex-wrap:wrap;gap:6px}",
			".ft-btn{color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:3px 8px;font-size:12px;line-height:16px;cursor:pointer}",
			".ft-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".ft-body{flex:1;min-height:0;overflow:auto;padding:6px 4px}",
			".ft-tree{font-size:13px;line-height:20px}",
			".ft-row{display:flex;align-items:center;gap:1px;min-width:0;border-radius:6px;padding-right:8px}",
			".ft-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".ft-twist{flex:none;width:24px;height:30px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;font-size:22px;line-height:1;display:inline-flex;align-items:center;justify-content:center}",
			".ft-twist-off{visibility:hidden}",
			".ft-twist:disabled{cursor:default}",
			".ft-name{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".ft-name-file{color:var(--dsw-alias-label-primary);cursor:pointer}",
			".ft-name-file:hover{color:#3b82f6!important;text-decoration:underline}",
			".ft-name-directory{color:var(--dsw-alias-label-primary);font-weight:500}",
			".ft-size{margin-left:auto;flex:none;color:var(--dsw-alias-label-quaternary);font-size:11px;font-variant-numeric:tabular-nums;padding-left:8px}",
			".ft-toggle{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:32px;padding:0 8px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;line-height:1;gap:8px}",
			".ft-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".ft-toggle-active{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary);font-weight:600}",
			".ft-toggle-icon{flex:none}",
			".ft-toggle-label{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".ft-icon{flex:none;width:16px;height:16px;margin:0 4px;display:inline-flex;align-items:center;justify-content:center}",
			".ft-icon svg{width:16px;height:16px}",
			".ft-hint{color:var(--dsw-alias-label-quaternary);font-size:12px;line-height:18px;padding:24px 12px;text-align:center}",
			".dsh-editor-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:center;padding:24px}",
			".dsh-editor-modal{background:var(--dsw-alias-bg-base,#ffffff);color:var(--dsw-alias-label-primary,#1a1a1a);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;box-shadow:0 20px 45px rgba(0,0,0,0.25);width:min(960px,95vw);height:min(85vh,900px);display:flex;flex-direction:column;overflow:hidden}",
			".dsh-editor-header{padding:12px 18px;border-bottom:1px solid var(--dsw-alias-separator-primary,#e5e7eb);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--dsw-alias-bg-subtle,#f9fafb)}",
			".dsh-editor-title-box{display:flex;align-items:center;gap:10px;min-width:0}",
			".dsh-editor-badge{background:#3b82f6;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:0.5px}",
			".dsh-editor-filename{font-weight:700;font-size:14px;white-space:nowrap}",
			".dsh-editor-filepath{font-size:12px;color:var(--dsw-alias-label-tertiary,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-editor-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}",
			".dsh-editor-btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s ease}",
			".dsh-editor-mode-btn{background:#e0e7ff;color:#4338ca}",
			".dsh-editor-mode-btn:hover{background:#c7d2fe}",
			".dsh-editor-save-btn{background:#10b981;color:#fff}",
			".dsh-editor-save-btn:hover{background:#059669}",
			".dsh-editor-close-btn{background:#f3f4f6;color:#4b5563;font-size:14px;padding:6px 10px}",
			".dsh-editor-close-btn:hover{background:#e5e7eb;color:#111827}",
			".dsh-editor-body{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column}",
			".dsh-code-editor-container{flex:1;display:flex}",
			".dsh-code-editor-textarea{width:100%;height:100%;min-height:500px;font-family:'Fira Code','Cascadia Code',Consolas,Monaco,monospace;font-size:13.5px;line-height:1.6;padding:12px;background:var(--dsw-alias-bg-base,#ffffff);color:var(--dsw-alias-label-primary,#1a1a1a);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:8px;outline:none;resize:none}",
			".dsh-blocknote-container{display:flex;flex-direction:column;gap:6px;max-width:800px;margin:0 auto;width:100%}",
			".dsh-bn-block{display:flex;align-items:center;gap:8px;padding:2px 0;border-radius:4px}",
			".dsh-bn-block:hover{background:rgba(0,0,0,0.02)}",
			".dsh-bn-tag{font-size:10px;font-weight:700;color:#9ca3af;width:24px;text-align:right;flex-shrink:0}",
			".dsh-bn-input{flex:1;border:none;outline:none;background:transparent;color:inherit;font-size:14px;line-height:1.6;font-family:inherit;padding:4px 6px}",
			".dsh-bn-input:focus{background:rgba(59,130,246,0.05);border-radius:4px}",
			".dsh-bn-h1-inp{font-size:22px;font-weight:800;color:#111827}",
			".dsh-bn-h2-inp{font-size:18px;font-weight:700;color:#1f2937}",
			".dsh-bn-h3-inp{font-size:15px;font-weight:600;color:#374151}",
			".dsh-bn-checkbox{width:16px;height:16px;cursor:pointer;accent-color:#3b82f6;margin-left:28px}",
			".dsh-bn-todo-done{text-decoration:line-through;opacity:0.55}",
			".dsh-bn-bullet-dot{margin-left:32px;font-size:18px;color:#6b7280;line-height:1}",
			".dsh-bn-quote{border-left:3px solid #3b82f6;padding-left:12px;margin-left:24px}",
			".dsh-bn-quote-inp{font-style:italic;color:#4b5563}",
			".dsh-bn-code{flex-direction:column;background:#1e293b;color:#f8fafc;border-radius:8px;overflow:hidden;margin:6px 0 6px 24px}",
			".dsh-bn-code-header{background:#0f172a;padding:4px 12px;font-size:11px;color:#94a3b8;font-family:monospace}",
			".dsh-bn-code-textarea{width:100%;border:none;outline:none;background:transparent;color:#f8fafc;font-family:monospace;font-size:12.5px;line-height:1.5;padding:10px 12px;resize:vertical}"
		].join("");

		if (typeof document !== "undefined" && !document.getElementById("ft-styles")) {
			const s = document.createElement("style");
			s.id = "ft-styles";
			s.textContent = css;
			document.head.appendChild(s);
		}

		// ── file type icon mapping ────────────────────────────────────────────────
		function fileIconId(name, type, isOpen) {
			if (type === "directory") return isOpen ? "folder-open" : "folder";
			const lower = name.toLowerCase();
			if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "file-type-typescript";
			if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "file-type-js";
			if (lower.endsWith(".json")) return "file-type-json";
			if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "file-type-markdown";
			if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "file-type-yaml";
			if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".less")) return "file-type-css";
			if (lower.endsWith(".html") || lower.endsWith(".htm")) return "file-type-html";
			if (lower.endsWith(".sh") || lower.endsWith(".bash") || lower.endsWith(".zsh")) return "file-type-shell";
			if (lower.endsWith(".py")) return "file-type-python";
			if (lower.endsWith(".rs")) return "file-type-rust";
			if (lower.endsWith(".go")) return "file-type-go";
			return "default-file";
		}

		function FileTypeIcon({ symbolId }) {
			return react.createElement("span", { className: "ft-icon" },
				react.createElement("svg", { "aria-hidden": true },
					react.createElement("use", { href: "#" + symbolId })
				)
			);
		}

		// ── helpers ──────────────────────────────────────────────────────────────
		function formatSize(bytes) {
			if (bytes === null || bytes === undefined) return "";
			if (bytes < 1024) return bytes + " B";
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
			return (bytes / 1024 / 1024).toFixed(1) + " MB";
		}

		// ── sidebar footer toggle ────────────────────────────────────────────────
		function FileTreeToggle({ wide, active, onClick }) {
			return react.createElement("button", {
				type: "button",
				className: "ft-toggle" + (active ? " ft-toggle-active" : ""),
				"aria-label": "File Tree",
				title: "File Tree",
				onClick
			}, [
				react.createElement("svg", { key: "icon", className: "ft-toggle-icon", viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true },
					react.createElement("path", {
						d: "M2 2h4l1.5 2H14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
						fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round"
					}),
					react.createElement("path", {
						d: "M5.5 9.5l2 2 2-2M7.5 11.5v-4",
						fill: "none", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round"
					})
				),
				wide ? react.createElement("span", { key: "label", className: "ft-toggle-label" }, "File Tree") : null
			]);
		}

		// ── BlockNote Markdown & Code Editor Component ───────────────────────────
		function BlockNoteMarkdownEditor({ filePath, initialContent, onClose, onSave }) {
			const [content, setContent] = react.useState(initialContent);
			const [isBlockMode, setIsBlockMode] = react.useState(filePath.endsWith('.md'));
			const [isSaving, setIsSaving] = react.useState(false);
			const [savedToast, setSavedToast] = react.useState(false);

			const isMarkdown = filePath.endsWith('.md');
			const fileName = filePath.split('/').pop() || filePath;

			const handleSave = async () => {
				setIsSaving(true);
				try {
					const res = await fetch('/filetree/save', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: filePath, content })
					});
					const data = await res.json();
					if (data.ok) {
						setSavedToast(true);
						setTimeout(() => setSavedToast(false), 2000);
						if (onSave) onSave(content);
					} else {
						alert('Save failed: ' + data.message);
					}
				} catch (err) {
					alert('Save error: ' + err.message);
				} finally {
					setIsSaving(false);
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
			}, [content, filePath]);

			const blocks = react.useMemo(() => {
				if (!content) return [];
				const lines = content.split('\\n');
				const result = [];
				let inCode = false;
				let codeBuffer = [];
				let codeLang = '';

				lines.forEach((line, idx) => {
					if (line.startsWith('\`\`\`')) {
						if (inCode) {
							result.push({ type: 'code', content: codeBuffer.join('\\n'), lang: codeLang, startLine: idx - codeBuffer.length });
							codeBuffer = [];
							inCode = false;
						} else {
							inCode = true;
							codeLang = line.slice(3).trim();
						}
						return;
					}
					if (inCode) {
						codeBuffer.push(line);
						return;
					}
					if (line.startsWith('# ')) {
						result.push({ type: 'h1', content: line.slice(2), lineIdx: idx });
					} else if (line.startsWith('## ')) {
						result.push({ type: 'h2', content: line.slice(3), lineIdx: idx });
					} else if (line.startsWith('### ')) {
						result.push({ type: 'h3', content: line.slice(4), lineIdx: idx });
					} else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
						const checked = line.startsWith('- [x] ') || line.startsWith('- [X] ');
						result.push({ type: 'todo', content: line.slice(6), checked, lineIdx: idx });
					} else if (line.startsWith('- ') || line.startsWith('* ')) {
						result.push({ type: 'bullet', content: line.slice(2), lineIdx: idx });
					} else if (line.startsWith('> ')) {
						result.push({ type: 'quote', content: line.slice(2), lineIdx: idx });
					} else if (line.trim() === '') {
						result.push({ type: 'blank', content: '', lineIdx: idx });
					} else {
						result.push({ type: 'paragraph', content: line, lineIdx: idx });
					}
				});
				if (inCode) {
					result.push({ type: 'code', content: codeBuffer.join('\\n'), lang: codeLang, startLine: lines.length - codeBuffer.length });
				}
				return result;
			}, [content]);

			const updateBlockLine = (lineIdx, newText) => {
				const lines = content.split('\\n');
				lines[lineIdx] = newText;
				setContent(lines.join('\\n'));
			};

			const toggleTodo = (lineIdx, checked, text) => {
				const newPrefix = checked ? '- [ ] ' : '- [x] ';
				updateBlockLine(lineIdx, newPrefix + text);
			};

			return react.createElement('div', { className: 'dsh-editor-backdrop', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
				react.createElement('div', { className: 'dsh-editor-modal' }, [
					react.createElement('div', { key: 'head', className: 'dsh-editor-header' }, [
						react.createElement('div', { key: 'title-box', className: 'dsh-editor-title-box' }, [
							react.createElement('span', { key: 'badge', className: 'dsh-editor-badge' }, isMarkdown ? 'MARKDOWN' : 'FILE'),
							react.createElement('span', { key: 'fname', className: 'dsh-editor-filename' }, fileName),
							react.createElement('span', { key: 'fpath', className: 'dsh-editor-filepath', title: filePath }, filePath)
						]),
						react.createElement('div', { key: 'actions', className: 'dsh-editor-actions' }, [
							isMarkdown ? react.createElement('button', {
								key: 'mode-toggle',
								type: 'button',
								className: 'dsh-editor-btn dsh-editor-mode-btn',
								onClick: () => setIsBlockMode(!isBlockMode)
							}, isBlockMode ? '📝 Raw Source' : '🧱 BlockNote Mode') : null,
							react.createElement('button', {
								key: 'save-btn',
								type: 'button',
								className: 'dsh-editor-btn dsh-editor-save-btn',
								disabled: isSaving,
								onClick: handleSave
							}, isSaving ? 'Saving...' : (savedToast ? '✓ Saved!' : '💾 Save (Ctrl+S)')),
							react.createElement('button', {
								key: 'close-btn',
								type: 'button',
								className: 'dsh-editor-btn dsh-editor-close-btn',
								onClick: onClose
							}, '✕')
						])
					]),
					react.createElement('div', { key: 'body', className: 'dsh-editor-body' },
						isMarkdown && isBlockMode
							? react.createElement('div', { className: 'dsh-blocknote-container' },
								blocks.map((b, i) => {
									if (b.type === 'h1') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-h1' }, [
											react.createElement('span', { key: 'tag', className: 'dsh-bn-tag' }, 'H1'),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input dsh-bn-h1-inp',
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, '# ' + e.target.value)
											})
										]);
									}
									if (b.type === 'h2') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-h2' }, [
											react.createElement('span', { key: 'tag', className: 'dsh-bn-tag' }, 'H2'),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input dsh-bn-h2-inp',
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, '## ' + e.target.value)
											})
										]);
									}
									if (b.type === 'h3') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-h3' }, [
											react.createElement('span', { key: 'tag', className: 'dsh-bn-tag' }, 'H3'),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input dsh-bn-h3-inp',
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, '### ' + e.target.value)
											})
										]);
									}
									if (b.type === 'todo') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-todo' }, [
											react.createElement('input', {
												key: 'chk',
												type: 'checkbox',
												checked: b.checked,
												className: 'dsh-bn-checkbox',
												onChange: () => toggleTodo(b.lineIdx, b.checked, b.content)
											}),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input ' + (b.checked ? 'dsh-bn-todo-done' : ''),
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, (b.checked ? '- [x] ' : '- [ ] ') + e.target.value)
											})
										]);
									}
									if (b.type === 'bullet') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-bullet' }, [
											react.createElement('span', { key: 'dot', className: 'dsh-bn-bullet-dot' }, '•'),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input',
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, '- ' + e.target.value)
											})
										]);
									}
									if (b.type === 'quote') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-quote' }, [
											react.createElement('span', { key: 'qbar', className: 'dsh-bn-quote-bar' }),
											react.createElement('input', {
												key: 'inp',
												className: 'dsh-bn-input dsh-bn-quote-inp',
												value: b.content,
												onChange: (e) => updateBlockLine(b.lineIdx, '> ' + e.target.value)
											})
										]);
									}
									if (b.type === 'code') {
										return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-code' }, [
											react.createElement('div', { key: 'lang', className: 'dsh-bn-code-header' }, b.lang || 'code'),
											react.createElement('textarea', {
												key: 'txt',
												className: 'dsh-bn-code-textarea',
												rows: Math.max(2, b.content.split('\\n').length),
												value: b.content,
												onChange: (e) => {
													const lines = content.split('\\n');
													const newCodeLines = e.target.value.split('\\n');
													const start = b.startLine;
													const count = b.content.split('\\n').length;
													lines.splice(start + 1, count, ...newCodeLines);
													setContent(lines.join('\\n'));
												}
											})
										]);
									}
									return react.createElement('div', { key: i, className: 'dsh-bn-block dsh-bn-p' }, [
										react.createElement('input', {
											key: 'inp',
											className: 'dsh-bn-input',
											value: b.content,
											placeholder: 'Empty block (type to add text)...',
											onChange: (e) => updateBlockLine(b.lineIdx, e.target.value)
										})
									]);
								})
							)
							: react.createElement('div', { className: 'dsh-code-editor-container' },
								react.createElement('textarea', {
									className: 'dsh-code-editor-textarea',
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
				])
			);
		}

		// ── panel body (tree view + editor) ──────────────────────────────────────
		function FileTree({ root, onRestoreDetails }) {
			const [activeRoot, setActiveRoot] = react.useState(root || null);
			const [cache, setCache] = react.useState({});
			const [expanded, setExpanded] = react.useState({});
			const [showHidden, setShowHidden] = react.useState(false);
			const [nonce, setNonce] = react.useState(0);
			const [editingFile, setEditingFile] = react.useState(null);
			const [fileContent, setFileContent] = react.useState('');

			react.useEffect(() => {
				if (root) {
					setActiveRoot(root);
				} else {
					fetch("/filetree/root")
						.then((res) => res.json())
						.then((data) => {
							if (data.ok && data.path) {
								setActiveRoot(data.path);
							}
						})
						.catch(() => {});
				}
			}, [root]);

			const refresh = () => {
				setCache({});
				setNonce((n) => n + 1);
			};

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
			};

			const fetchDir = (dirPath) => {
				setCache((c) => ({ ...c, [dirPath]: "loading" }));
				fetch("/filetree/list?path=" + encodeURIComponent(dirPath))
					.then((res) => res.json())
					.then((data) => {
						if (data.ok && Array.isArray(data.entries)) {
							setCache((c) => ({ ...c, [dirPath]: data.entries }));
						} else {
							setCache((c) => ({ ...c, [dirPath]: "error" }));
						}
					})
					.catch(() => setCache((c) => ({ ...c, [dirPath]: "error" })));
			};

			react.useEffect(() => {
				if (activeRoot) {
					setExpanded((e) => ({ ...e, [activeRoot]: true }));
					fetchDir(activeRoot);
				}
			}, [activeRoot, nonce]);

			const toggle = (dirPath) => {
				const next = !expanded[dirPath];
				setExpanded((e) => ({ ...e, [dirPath]: next }));
				if (next && cache[dirPath] === undefined) fetchDir(dirPath);
			};

			function renderLevel(dirPath, depth) {
				const state = cache[dirPath];
				if (state === undefined || state === "loading") {
					return [react.createElement("div", { key: dirPath + ":wait", className: "ft-row", style: { paddingLeft: (depth * 14 + 20) + "px" } },
						react.createElement("span", { className: "ft-hint" },
							state === undefined ? "Waiting for load..." : "Loading..."))];
				}
				if (state === "error") {
					return [react.createElement("div", { key: dirPath + ":err", className: "ft-row", style: { paddingLeft: (depth * 14 + 20) + "px" } },
						react.createElement("span", { className: "ft-hint" }, "Load failed"))];
				}
				const entries = Array.isArray(state) ? state : [];
				const visible = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));
				const sorted = visible.slice().sort((a, b) => {
					if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
					return a.name.localeCompare(b.name);
				});

				const rows = [];
				const pad = { paddingLeft: (depth * 14) + "px" };
				for (const entry of sorted) {
					const isDir = entry.type === "directory";
					const isOpen = expanded[entry.path] === true;
					rows.push(react.createElement("div", { key: entry.path, className: "ft-row", style: pad }, [
						react.createElement("button", {
							key: "twist",
							type: "button",
							className: "ft-twist" + (isDir ? "" : " ft-twist-off"),
							disabled: !isDir,
							"aria-label": isDir ? (isOpen ? "Collapse" : "Expand") : "",
							onClick: () => toggle(entry.path)
						}, isDir ? (isOpen ? "\\u25BE" : "\\u25B8") : ""),
						react.createElement(FileTypeIcon, {
							key: "icon",
							symbolId: fileIconId(entry.name, entry.type, isOpen)
						}),
						react.createElement("span", {
							key: "name",
							className: "ft-name ft-name-" + entry.type,
							title: isDir ? entry.path : (entry.path + " (Click to edit)"),
							onClick: () => { if (!isDir) openFile(entry.path); }
						}, entry.name),
						!isDir && entry.size !== null
							? react.createElement("span", { key: "size", className: "ft-size" }, formatSize(entry.size))
							: null
					]));
					if (isDir && isOpen) rows.push.apply(rows, renderLevel(entry.path, depth + 1));
				}
				return rows;
			}

			return react.createElement(react.Fragment, null, [
				editingFile ? react.createElement(BlockNoteMarkdownEditor, {
					key: "editor-modal",
					filePath: editingFile,
					initialContent: fileContent,
					onClose: () => setEditingFile(null),
					onSave: (newContent) => setFileContent(newContent)
				}) : null,
				react.createElement("div", { key: "panel", className: "ft-panel" }, [
					react.createElement("div", { key: "header", className: "ft-header" }, [
						react.createElement("div", { key: "title", className: "ft-title" }, "File Tree"),
						react.createElement("div", { key: "root", className: "ft-root", title: activeRoot ?? "" }, activeRoot ?? "(No session workspace)"),
						react.createElement("div", { key: "tools", className: "ft-tools" }, [
							react.createElement("button", { key: "hidden", type: "button", className: "ft-btn", onClick: () => setShowHidden((v) => !v) },
								showHidden ? "Hide hidden files" : "Show hidden files"),
							react.createElement("button", { key: "refresh", type: "button", className: "ft-btn", onClick: refresh }, "Refresh"),
							react.createElement("button", { key: "restore", type: "button", className: "ft-btn", onClick: onRestoreDetails }, "Restore tool details")
						])
					]),
					react.createElement("div", { key: "body", className: "ft-body" },
						!activeRoot
							? react.createElement("div", { className: "ft-hint" }, "Open a session to display its workspace file tree")
							: react.createElement("div", { className: "ft-tree" }, renderLevel(activeRoot, 0))
					)
				])
			]);
		}

		// ── plugin body ──────────────────────────────────────────────────────────
		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === undefined) return;

			let treeDisposer = null;
			let treeActive = false;

			const openTree = () => {
				if (treeActive) return;
				treeActive = true;
				const workspaces = ctx.get("workspaces");
				const getRoot = () => {
					try {
						if (workspaces && typeof workspaces.getSnapshot === "function") {
							const snap = workspaces.getSnapshot();
							if (snap && snap.activeWorkspace && snap.activeWorkspace.root) {
								return snap.activeWorkspace.root.displayPath || snap.activeWorkspace.root.path || null;
							}
						}
						if (workspaces && workspaces.activeWorkspace && workspaces.activeWorkspace.root) {
							return workspaces.activeWorkspace.root.displayPath || workspaces.activeWorkspace.root.path || null;
						}
					} catch (e) {
						console.warn("[filetree] getRoot error", e);
					}
					return null;
				};

				treeDisposer = slots.register(
					{ name: "details", id: "filetree-panel", priority: -1 },
					() => react.createElement(FileTree, {
						root: getRoot(),
						onRestoreDetails: closeTree
					})
				);
			};

			const closeTree = () => {
				if (!treeActive) return;
				treeActive = false;
				if (treeDisposer !== null) {
					treeDisposer();
					treeDisposer = null;
				}
				const l = ctx.get("layout");
				if (l !== undefined) l.closeDetails();
			};

			const toggleTree = () => (treeActive ? closeTree() : openTree());

			slots.inject("sidebar.footer.action", () => slots.register(
				{ name: "sidebar.footer.action", id: "filetree-toggle" },
				(props) => react.createElement(FileTreeToggle, {
					wide: props.wide === true,
					active: treeActive,
					onClick: toggleTree
				})
			));
		}

		exports.apply = apply;
		exports.fileIconId = fileIconId;
		return module.exports;
	}
});
`
  fs.writeFileSync(clientFile, fullClientJs, 'utf8')
  console.log('[✓] Successfully built clean dsh-local-filetree client.js with stateful root fetching!')
}
