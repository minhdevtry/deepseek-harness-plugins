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
clientSource = clientSource.replace(computeColumnsRegex, newComputeColumns);

// 4. Inject TipTap Bundle, SVG Icons & TipTapNotionEditor Component
const tiptapEditorComponentCode = `
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

		// ── TipTap Notion Suite CSS Styles ──
		const tiptapStyles = \`
			.vk_tiptap_wrapper {
				display: flex; flex-direction: column; height: 100%; width: 100%;
				background: var(--dsw-alias-bg-base, #ffffff); overflow: hidden; position: relative;
			}
			.vk_tiptap_toolbar {
				background: var(--dsw-alias-bg-base, #ffffff);
				border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
				padding: 6px 14px; display: flex; align-items: center; gap: 3px; flex-wrap: wrap; flex-shrink: 0;
			}
			.vk_table_toolbar {
				background: #f0fdf4; border-bottom: 1px solid #bbf7d0;
				padding: 4px 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex-shrink: 0;
				animation: vk-slide-down 0.15s ease-out;
			}
			@keyframes vk-slide-down { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
			.vk_tb_tool {
				border: 1px solid transparent; background: transparent; padding: 4px 8px;
				border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer;
				color: var(--dsw-alias-label-secondary, #374151); min-width: 26px; text-align: center;
				display: inline-flex; align-items: center; gap: 4px; transition: background 0.1s;
			}
			.vk_tb_tool:hover { background: var(--dsw-alias-interactive-bg-hover, #f3f4f6); border-color: var(--dsw-alias-border-l2, #d1d5db); }
			.vk_tb_table_btn {
				border: 1px solid #86efac; background: #ffffff; padding: 3px 8px;
				border-radius: 5px; font-size: 11.5px; font-weight: 600; cursor: pointer;
				color: #166534; display: inline-flex; align-items: center; gap: 3px;
			}
			.vk_tb_table_btn:hover { background: #dcfce7; border-color: #4ade80; }
			.vk_tb_table_btn_danger { color: #dc2626; border-color: #fca5a5; }
			.vk_tb_table_btn_danger:hover { background: #fee2e2; border-color: #f87171; }
			.vk_tb_sep { width: 1px; height: 16px; background: var(--dsw-alias-border-l2, #e5e7eb); margin: 0 4px; }
			.vk_bold { font-weight: 800; }
			.vk_italic { font-style: italic; }
			.vk_strike { text-decoration: line-through; }
			.vk_underline { text-decoration: underline; }

			.vk_tiptap_canvas { flex: 1; overflow-y: auto; display: flex; flex-direction: column; position: relative; }
			.vk_tiptap_container { flex: 1; display: flex; flex-direction: column; padding: 32px 52px 80px; max-width: 900px; margin: 0 auto; width: 100%; box-sizing: border-box; }
			.vk_tiptap_prose { outline: none; font-size: 15.5px; line-height: 1.8; min-height: 480px; color: var(--dsw-alias-label-primary, #111827); width: 100%; }
			.vk_tiptap_prose h1 { font-size: 28px; font-weight: 800; margin: 26px 0 14px; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; line-height: 1.3; }
			.vk_tiptap_prose h2 { font-size: 22px; font-weight: 700; margin: 22px 0 12px; color: #1f2937; line-height: 1.35; }
			.vk_tiptap_prose h3 { font-size: 18px; font-weight: 600; margin: 18px 0 10px; color: #374151; }
			.vk_tiptap_prose p { margin: 10px 0; }
			.vk_tiptap_prose blockquote { border-left: 4px solid #3b82f6; padding: 10px 18px; color: #4b5563; margin: 14px 0; font-style: italic; background: rgba(59,130,246,0.04); border-radius: 0 8px 8px 0; }
			
			.vk_callout_box {
				border: 1.5px solid #bae6fd; background: #f0f9ff; border-radius: 10px;
				padding: 14px 18px; margin: 18px 0; display: flex; align-items: flex-start; gap: 12px;
				color: #0369a1; box-shadow: 0 2px 8px rgba(2,132,199,0.05);
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
			.vk_open_chat_float {
				position: absolute; top: 8px; right: 12px; z-index: 50;
				background: var(--dsw-alias-state-business-primary, #2563eb); color: #ffffff;
				border: none; padding: 6px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 600;
				cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
				transition: transform 0.1s, filter 0.1s;
			}
			.vk_open_chat_float:hover { filter: brightness(1.1); transform: translateY(-1px); }
		\`;

		if (typeof document !== "undefined" && !document.getElementById("vk-tiptap-styles")) {
			const s = document.createElement("style");
			s.id = "vk-tiptap-styles";
			s.textContent = tiptapStyles;
			document.head.appendChild(s);
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
					const offset = $from.parentOffset;
					const textBefore = blockText.slice(0, offset);
					const slashPos = textBefore.lastIndexOf('/');
					if (slashPos === -1 || (slashPos > 0 && !/\\s/.test(textBefore[slashPos - 1]))) {
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
				} else {
					setSlashMenu(null);
				}
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
					if (from < to) editor.chain().focus().deleteRange({ from, to }).run();
					setEmbedModal({ type: 'table', rows: 3, cols: 3, withHeaderRow: true });
					return;
				}
				if (item.label === 'YouTube Video') {
					if (from < to) editor.chain().focus().deleteRange({ from, to }).run();
					setEmbedModal({ type: 'youtube', url: '' });
					return;
				}
				if (item.label === 'Image') {
					if (from < to) editor.chain().focus().deleteRange({ from, to }).run();
					setEmbedModal({ type: 'image', url: '' });
					return;
				}

				const chain = editor.chain().focus();
				if (from < to) chain.deleteRange({ from, to });

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
						setIsInTable(ed.isActive('table'));
						updateDocState(ed);
					},
					editorProps: {
						attributes: { class: 'vk_tiptap_prose prose' },
						handleKeyDown: (view, event) => {
							if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
								event.preventDefault();
								if (editorRef.current && editorRef.current.storage && editorRef.current.storage.markdown) {
									onSave(editorRef.current.storage.markdown.getMarkdown());
								}
								return true;
							}
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
									if (item) executeSlashItem(item);
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
				return () => { editor.destroy(); editorRef.current = null; };
			}, [file.path]);

			const runCommand = (action) => {
				if (editorRef.current) action(editorRef.current.chain().focus()).run();
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
						react.createElement('button', { key: 'b', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleBold()) }, 'B'),
						react.createElement('button', { key: 'i', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleItalic()) }, 'I'),
						react.createElement('button', { key: 'u', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleUnderline()) }, 'U'),
						react.createElement('button', { key: 's', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleStrike()) }, 'S'),
						react.createElement('button', { key: 'hl', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleHighlight()) }, '🎨 Mark'),
						react.createElement('button', { key: 'code', type: 'button', className: 'vk_bubble_btn', onMouseDown: (e) => e.preventDefault(), onClick: () => runCommand(c => c.toggleCode()) }, '</> Code'),
						react.createElement('button', {
							key: 'ai-btn',
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
					]) : null
				]),

				// Table / Media Modals
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
						react.createElement('button', { key: 'close', className: 'vk_tabClose', onClick: () => setEmbedModal(null) }, '✕')
					]),
					react.createElement('form', { key: 'form', onSubmit: handleEmbedSubmit }, [
						react.createElement('div', { key: 'body', className: 'dsh-modal-body' },
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
	clientSource = clientSource.slice(0, viewerIndex) + tiptapEditorComponentCode + '\n\n' + clientSource.slice(viewerIndex);
}

// 5. English translations & UI improvements in LeftPanel, RightPanel, FileTree, Viewer, EditorArea, AppFrame

// LeftPanel: English tabs & titles
const leftPanelRegex = /function LeftPanel\(\{[\s\S]*?\n\t\t\}/;
const newLeftPanel = `function LeftPanel({ tab, onTab, tree, sessionSlot, collapsed, onExpand, onCollapse }) {
			if (collapsed) {
				return h("div", { className: "vk_colLeft vk_rail" },
					h("button", { className: "vk_railBtn" + (tab === "files" ? " vk_railBtnActive" : ""), title: "Explorer", onClick: () => { onTab("files"); onExpand(); } }, "📁"),
					h("button", { className: "vk_railBtn" + (tab === "sessions" ? " vk_railBtnActive" : ""), title: "Quests", onClick: () => { onTab("sessions"); onExpand(); } }, "☰"),
					h("div", { className: "vk_railSpacer" }),
					h("button", { className: "vk_railBtn", title: "Expand Sidebar", onClick: onExpand }, "»"),
					h("div", { style: { display: "none" } }, sessionSlot)
				);
			}
			return h("div", { className: "vk_colLeft" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "files" ? " vk_tabBtnActive" : ""), onClick: () => onTab("files") }, "Explorer"),
					h("button", { className: "vk_tabBtn" + (tab === "sessions" ? " vk_tabBtnActive" : ""), onClick: () => onTab("sessions") }, "Quests"),
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn", title: "Collapse Sidebar", onClick: onCollapse }, "«")
				),
				h("div", { className: "vk_tabBody" + (tab === "files" ? "" : " vk_tabBodyHidden") }, tree),
				h("div", { className: "vk_tabBody" + (tab === "sessions" ? "" : " vk_tabBodyHidden") }, sessionSlot)
			);
		}`;
clientSource = clientSource.replace(leftPanelRegex, newLeftPanel);

// RightPanel: English tabs, Fullscreen, and Close/Collapse button
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
clientSource = clientSource.replace(rightPanelRegex, newRightPanel);

clientSource = clientSource.replace(
	'setSidebar: (d, px) => { d.sidebar = clampWidth(px, 264, 420); },',
	'setSidebar: (d, px) => { d.sidebar = px === 0 ? 0 : clampWidth(px, 220, 500); },'
);
clientSource = clientSource.replace(
	'setRight: (d, px) => { d.right = clampWidth(px, 340, 640); },',
	'setRight: (d, px) => { d.right = px === 0 ? 0 : clampWidth(px, 280, 1400); },'
);

// AppFrame: Workspace Root Auto-fallback, Ctrl+L shortcut & Full width collapse
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
	'const [tabsState, setTabsState] = react.useState(loadTabs);',
	`const [tabsState, setTabsState] = react.useState(loadTabs);

			// Global Ctrl+L shortcut: If text is selected, send snippet to chat input & focus; otherwise toggle chat panel
			react.useEffect(() => {
				const onKeyDown = (e) => {
					if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
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
			}, [panels.right, panels.rightTab, tabsState, actions]);`
);

clientSource = clientSource.replace(
	'const fileRoot = tabsState.root != null ? tabsState.root : sessionCwd;',
	'const fileRoot = tabsState.root != null ? tabsState.root : (sessionCwd || defaultCwd || ".");'
);

clientSource = clientSource.replace(
	'const cols = computeColumns(viewport, sidebarCollapsed ? 0 : panels.sidebar === 0 ? 280 : panels.sidebar, panels.right === 0 ? 440 : panels.right);',
	'const cols = computeColumns(viewport, sidebarCollapsed ? 0 : (panels.sidebar === 0 ? 0 : (panels.sidebar ?? 280)), panels.right === 0 ? 0 : (panels.right ?? 440));'
);

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
clientSource = clientSource.replace(rightBlockRegex, newRightBlock);

clientSource = clientSource.replace(
	'return h("div", { ref: frameRef, className: "vk_frame" + (dragging ? " vk_resizing" : "") },',
	`const showOpenChatBtn = cols.right === 0 && panels.mode !== "native";
			return h("div", { ref: frameRef, className: "vk_frame" + (dragging ? " vk_resizing" : "") },
				showOpenChatBtn ? h("button", {
					className: "vk_open_chat_float",
					title: "Open AI Chat Panel (Ctrl+L)",
					onClick: () => actions.setRight(440)
				}, "💬 Open Chat (Ctrl+L)") : null,`
);

// FileTree: English Strings & SVG icons
clientSource = clientSource.replace('const title = typeof root === "string" && root.length > 0 ? (root.split(/[\\\\/]/).pop() || root) : "文件";', 'const title = typeof root === "string" && root.length > 0 && root !== "." ? (root.split(/[\\\\/]/).pop() || root) : "EXPLORER";');
clientSource = clientSource.replace('title: "打开文件夹（系统对话框）",', 'title: "Open Folder",');
clientSource = clientSource.replace('title: showHidden ? "隐藏系统/配置文件" : "显示系统/配置文件（node_modules、.git 等）",', 'title: showHidden ? "Hide Hidden Files" : "Show Hidden Files (.git, node_modules, etc.)",');
clientSource = clientSource.replace('title: "手动输入路径",', 'title: "Enter Path Manually",');
clientSource = clientSource.replace('title: "新建文件/文件夹",', 'title: "New File / Folder",');
clientSource = clientSource.replace('title: "搜索文件",', 'title: "Search Files",');
clientSource = clientSource.replace('title: "关闭当前文件夹（回到会话工作区）",', 'title: "Reset to Workspace Folder",');
clientSource = clientSource.replace('placeholder: "输入文件夹绝对路径，如 D:\\\\csgo.text",', 'placeholder: "Enter directory path...",');
clientSource = clientSource.replace('h("button", { className: "vk_pickBtn", onClick: commitFolder }, "打开"),', 'h("button", { className: "vk_pickBtn", onClick: commitFolder }, "Open"),');
clientSource = clientSource.replace('h("button", { className: "vk_pickBtn", onClick: () => { setPicking(false); setDraft(""); } }, "取消")', 'h("button", { className: "vk_pickBtn", onClick: () => { setPicking(false); setDraft(""); } }, "Cancel")');
clientSource = clientSource.replace('h("button", { className: "vk_pickBtn" + (creating === "file" ? " vk_modeBtn" : ""), onClick: () => setCreating("file") }, "新建文件"),', 'h("button", { className: "vk_pickBtn" + (creating === "file" ? " vk_modeBtn" : ""), onClick: () => setCreating("file") }, "New File"),');
clientSource = clientSource.replace('h("button", { className: "vk_pickBtn" + (creating === "dir" ? " vk_modeBtn" : ""), onClick: () => setCreating("dir") }, "新建文件夹")', 'h("button", { className: "vk_pickBtn" + (creating === "dir" ? " vk_modeBtn" : ""), onClick: () => setCreating("dir") }, "New Folder")');
clientSource = clientSource.replace('placeholder: creating === "dir" ? "文件夹名" : "文件名",', 'placeholder: creating === "dir" ? "Folder name" : "File name",');
clientSource = clientSource.replace('h("button", { className: "vk_pickBtn", onClick: commitCreate }, "创建"),', 'h("button", { className: "vk_pickBtn", onClick: commitCreate }, "Create"),');
clientSource = clientSource.replace('placeholder: "搜索文件名…（回车打开第一个结果）",', 'placeholder: "Search files... (Enter to open first match)",');
clientSource = clientSource.replace('if (searchResults === null) return h("div", { className: "vk_empty" }, "搜索中…");', 'if (searchResults === null) return h("div", { className: "vk_empty" }, "Searching...");');
clientSource = clientSource.replace('if (searchResults.length === 0) return h("div", { className: "vk_empty" }, "没有匹配的文件");', 'if (searchResults.length === 0) return h("div", { className: "vk_empty" }, "No matching files found");');
clientSource = clientSource.replace('if (typeof root !== "string" || root.length === 0) return h("div", { className: "vk_empty" }, "暂无工作区\\n打开一个会话后，这里会显示其文件树");', 'if (typeof root !== "string" || root.length === 0) return h("div", { className: "vk_empty" }, "No workspace active\\nSelect a Quest or open a folder to explore");');
clientSource = clientSource.replace('if (dir === void 0) return h("div", { className: "vk_empty" }, "加载中…");', 'if (dir === void 0) return h("div", { className: "vk_empty" }, "Loading files...");');
clientSource = clientSource.replace('return h("div", { className: "vk_err" }, dir.error || "无法读取目录");', 'return h("div", { className: "vk_err" }, dir.error || "Unable to read directory");');
clientSource = clientSource.replace('title: "重命名",', 'title: "Rename",');
clientSource = clientSource.replace('title: "删除（送入回收站）",', 'title: "Delete (Move to Trash)",');
clientSource = clientSource.replace('if (typeof confirm === "function" && !confirm(`删除「${name}」？\\n（会送入回收站，可从回收站恢复）`)) return;', 'if (typeof confirm === "function" && !confirm(`Move "${name}" to Trash?`)) return;');
clientSource = clientSource.replace('} else setCreateErr((d && d.error) || "创建失败");', '} else setCreateErr((d && d.error) || "Create failed");');
clientSource = clientSource.replace('} else setRenameErr((d && d.error) || "重命名失败");', '} else setRenameErr((d && d.error) || "Rename failed");');
clientSource = clientSource.replace('} else setError((d && d.error) || "删除失败");', '} else setError((d && d.error) || "Delete failed");');
clientSource = clientSource.replace('} else setError((d && d.error) || "加载失败");', '} else setError((d && d.error) || "Load failed");');

// Use SVG FileTypeIcon for FileTree rows
clientSource = clientSource.replace(
	'h("span", { className: "vk_icon " + ic.c, "aria-hidden": true }, ic.g),',
	'props.isDir ? h(FileTypeIcon, { symbolId: props.expanded ? "fti-FolderOpen" : "fti-Folder" }) : h(FileTypeIcon, { symbolId: fileIconId(props.name, "file", false) }),'
);

// Viewer: English strings & Direct TipTap WYSIWYG for Markdown files
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
					onUpdateContent: (text) => onUpdateDirect ? onUpdateDirect(text) : onStartEdit(text),
					onSave: (text) => onSaveDirect ? onSaveDirect(text) : onStartEdit(text),
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

// EditorArea: English strings, save callback & multi-tab icons
const saveRegex = /const save = react\.useCallback\(async \(\) => \{[\s\S]*?\}, \[currentPath, edits, busy\]\);/;
const newSaveBlock = `const saveWithText = react.useCallback(async (textToSave) => {
				if (busy) return;
				setBusy(true);
				setSaveMsg("Saving...");
				try {
					const r = await fetch("/vscode-files/write?path=" + encodeURIComponent(currentPath), {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: currentPath, content: textToSave })
					});
					const d = await r.json();
					if (d && d.ok) {
						setEdits((prev) => {
							const next = { ...prev };
							delete next[currentPath];
							return next;
						});
						setRevisions((prev) => ({ ...prev, [currentPath]: (prev[currentPath] ?? 0) + 1 }));
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
				if (edit === void 0 || busy) return;
				saveWithText(edit.text);
			}, [currentPath, edits, busy, saveWithText]);`;

clientSource = clientSource.replace(saveRegex, newSaveBlock);

clientSource = clientSource.replace('if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("放弃未保存的修改？")) return;', 'if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("Discard unsaved changes?")) return;');
clientSource = clientSource.replace('if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("该标签有未保存的修改，关闭将丢失。确定关闭？")) return;', 'if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("This tab has unsaved changes. Discard and close?")) return;');
clientSource = clientSource.replace('if (dirtyAny && typeof confirm === "function" && !confirm("有未保存的标签，关闭将丢失修改。确定关闭？")) return;', 'if (dirtyAny && typeof confirm === "function" && !confirm("Some tabs have unsaved changes. Discard and close?")) return;');
clientSource = clientSource.replace('return h("div", { className: "vk_editor" }, h("div", { className: "vk_empty" }, "从左侧文件树打开一个文件\\n（点击文件名即可在标签页中查看）"));', 'return h("div", { className: "vk_editor" }, h("div", { className: "vk_empty" }, "Select a file from the Explorer\\n(Click any file to view and edit in tabs)"));');
clientSource = clientSource.replace('h("button", { className: "vk_editBtn vk_editBtnPrimary", disabled: busy, title: "保存 (Ctrl+S)", onClick: save }, "💾 保存"),', 'h("button", { className: "vk_editBtn vk_editBtnPrimary", disabled: busy, title: "Save (Ctrl+S)", onClick: save }, "💾 Save"),');
clientSource = clientSource.replace('h("button", { className: "vk_editBtn", disabled: busy, title: "取消编辑 (Esc)", onClick: cancel }, "✕ 取消"),', 'h("button", { className: "vk_editBtn", disabled: busy, title: "Cancel Edit (Esc)", onClick: cancel }, "✕ Cancel"),');
clientSource = clientSource.replace('dirty ? h("span", { className: "vk_dirtyDot", title: "有未保存的修改" }) : null,', 'dirty ? h("span", { className: "vk_dirtyDot", title: "Unsaved changes" }) : null,');
clientSource = clientSource.replace('h("span", { className: "vk_saveMsg" }, "编辑模式")', 'h("span", { className: "vk_saveMsg" }, "Edit Mode")');
clientSource = clientSource.replace('title: "关闭",', 'title: "Close Tab",');
clientSource = clientSource.replace('? h("div", { className: "vk_editorBody vk_trajBody" }, trajectory ?? h("div", { className: "vk_notice" }, "轨迹视图不可用"))', '? h("div", { className: "vk_editorBody vk_trajBody" }, trajectory ?? h("div", { className: "vk_notice" }, "Trajectory view unavailable"))');
clientSource = clientSource.replace('ctxMenu.path !== null ? menuItem("关闭", () => closeTab(ctxMenu.path)) : null,', 'ctxMenu.path !== null ? menuItem("Close", () => closeTab(ctxMenu.path)) : null,');
clientSource = clientSource.replace('ctxMenu.path !== null ? menuItem("关闭其他", () => closePaths(tabs.map((t) => t.path).filter((p) => p !== ctxMenu.path))) : null,', 'ctxMenu.path !== null ? menuItem("Close Others", () => closePaths(tabs.map((t) => t.path).filter((p) => p !== ctxMenu.path))) : null,');
clientSource = clientSource.replace('ctxMenu.path !== null ? menuItem("关闭左侧", () => {', 'ctxMenu.path !== null ? menuItem("Close to the Left", () => {');
clientSource = clientSource.replace('ctxMenu.path !== null ? menuItem("关闭右侧", () => {', 'ctxMenu.path !== null ? menuItem("Close to the Right", () => {');
clientSource = clientSource.replace('menuItem("关闭全部", () => closePaths(tabs.map((t) => t.path)), true)', 'menuItem("Close All", () => closePaths(tabs.map((t) => t.path)), true)');

// Tab SVG Icon in EditorArea
clientSource = clientSource.replace(
	'h("span", { className: "vk_icon " + ic.c }, ic.g),',
	'h(FileTypeIcon, { symbolId: fileIconId(t.name, "file", false) }),'
);

// Markdown tabs ALWAYS use direct TipTap WYSIWYG Suite, not raw textarea
clientSource = clientSource.replace(
	'editing\n\t\t\t\t\t? h(react.Fragment, null,',
	'(editing && !(active !== null && (active.path.endsWith(".md") || active.path.endsWith(".markdown"))))\n\t\t\t\t\t? h(react.Fragment, null,'
);

// Multi-Tab Renderer with TipTapNotionEditor for .md files
clientSource = clientSource.replace(
	': h(Viewer, { file: active, rev: revisions[active.path] ?? 0, onStartEdit: startEdit }),',
	`: (active !== null && (active.path.endsWith(".md") || active.path.endsWith(".markdown")) && edits[active.path] !== void 0)
						? h(TipTapNotionEditor, {
							file: active,
							content: edits[active.path].text,
							isDirty: edits[active.path].dirty === true,
							onUpdateContent: onEditText,
							onSave: (txt) => saveWithText(txt),
							onCancel: cancel,
							busy,
							saveMsg,
							onToggleRawMode: cancel
						})
						: h(Viewer, {
							file: active,
							rev: revisions[active.path] ?? 0,
							onStartEdit: startEdit,
							onSaveDirect: (txt) => saveWithText(txt),
							onUpdateDirect: onEditText,
							isDirectDirty: edits[active.path]?.dirty === true
						}),`
);

// Global Persona section translation
clientSource = clientSource.replace('label: () => "全局人设"', 'label: () => "Global Persona"');
clientSource = clientSource.replace('h("div", { className: "vk_personaDesc" }, "类似 Claude Code 的全局 CLAUDE.md：内容会注入到所有会话的系统提示中，新消息立即生效（无需重启）。支持 Markdown。"),', 'h("div", { className: "vk_personaDesc" }, "Global Instructions (similar to CLAUDE.md): Injected into system prompt of all sessions. Takes effect immediately. Supports Markdown."),');
clientSource = clientSource.replace('placeholder: "例如：\\n- 你叫小鲸，说话简洁直接\\n- 一律用简体中文回答\\n- …"', 'placeholder: "Example:\\n- Be concise and precise\\n- Follow coding guidelines\\n- ..."');
clientSource = clientSource.replace('saving ? "保存中…" : "保存"', 'saving ? "Saving..." : "Save"');
clientSource = clientSource.replace('{ ok: true, text: "已保存 ✓ 新消息立即生效" }', '{ ok: true, text: "Saved ✓ Effective immediately" }');
clientSource = clientSource.replace('text: (d && d.error) || "保存失败"', 'text: (d && d.error) || "Save failed"');
clientSource = clientSource.replace('(d && d.error) || "读取失败"', '(d && d.error) || "Failed to read file"');
clientSource = clientSource.replace('title: "未保存"', 'title: "Unsaved changes"');
clientSource = clientSource.replace('? h("div", { className: "vk_personaDesc" }, "加载中…")', '? h("div", { className: "vk_personaDesc" }, "Loading...")');
clientSource = clientSource.replace('name: "工具详情"', 'name: "Tool Trajectory"');

fs.writeFileSync(path.join(clientDir, 'lib/client.js'), clientSource, 'utf8');
console.log('[✓] Successfully generated and bundled dsh-client-vscode-layout with English UI & enhanced controls!');
