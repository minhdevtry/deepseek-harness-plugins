window.__ModuleLoader__.load({
	id: "@anoslide/dsh-client-vscode-layout",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		const h = react.createElement;

		// ──────────────────────────────────────────────────────────────
		// 常量与工具
		// ──────────────────────────────────────────────────────────────
		const SIDEBAR_AUTO_COLLAPSE = 1024;
		const LS_KEY = "dsh-vscode-layout:v1";
		/** 工具详情轨迹的特殊标签路径（分栏模式下轨迹在中心区开标签）。 */
		const TRAJECTORY_TAB_PATH = "::vscode-trajectory::";

		function clampWidth(px, min, max) {
			return Math.min(max, Math.max(min, Math.round(px)));
		}
		/**
		 * 三栏宽度求解：左(264-420, 默认 280) | 中(弹性, 最小 360) | 右(340-640, 默认 440)。
		 * 右栏常驻不收起；窄视口先挤右栏，再挤左栏，最后保中间。
		 */
		function computeColumns(viewport, sidebar, right) {
			const s = sidebar === 0 ? 56 : clampWidth(sidebar, 264, 420);
			const r0 = right === 0 ? 0 : clampWidth(right, 340, 640);
			if (s + r0 + 360 <= viewport) return { sidebar: s, center: viewport - s - r0, right: r0 };
			const r1 = r0 === 0 ? 0 : Math.max(340, viewport - s - 360);
			if (s + r1 + 360 <= viewport) return { sidebar: s, center: viewport - s - r1, right: r1 };
			if (s + 360 <= viewport) return { sidebar: s, center: viewport - s, right: 0 };
			return { sidebar: 0, center: viewport, right: 0 };
		}

		function escapeHtml(text) {
			return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}

		// ──────────────────────────────────────────────────────────────
		// 简易语法高亮（零依赖；shiki 留作 v2）
		// ──────────────────────────────────────────────────────────────
		const TOKEN_CLASS = {
			com: "vk_tokCom",
			str: "vk_tokStr",
			kw: "vk_tokKw",
			num: "vk_tokNum",
			tag: "vk_tokTag",
			attr: "vk_tokAttr",
			md: "vk_tokMd"
		};
		function familyOf(path) {
			const ext = String(path).split(".").pop().toLowerCase();
			if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) return "js";
			if (["html", "htm", "xml", "svg", "vue"].includes(ext)) return "html";
			if (["py", "sh", "bash", "zsh", "toml"].includes(ext)) return "py";
			if (["css", "scss", "less"].includes(ext)) return "css";
			if (["json", "jsonc"].includes(ext)) return "json";
			if (["yml", "yaml"].includes(ext)) return "yaml";
			if (["md", "markdown"].includes(ext)) return "md";
			return "plain";
		}
		function tokenize(code, family) {
			if (family === "plain") return [[null, code]];
			const RE = {
				js: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(?:const|let|var|function|return|if|else|for|while|do|import|from|export|default|class|extends|super|new|this|typeof|instanceof|in|of|async|await|try|catch|finally|throw|switch|case|break|continue|delete|void|yield|null|undefined|true|false|static|get|set)\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/g,
				html: /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][a-zA-Z0-9-]*|\/?>)|([a-zA-Z-]+)(=)("[^"]*"|'[^']*')/g,
				py: /(#[^\n]*)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(?:def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|lambda|pass|break|continue|and|or|not|in|is|None|True|False|async|await|yield|global|nonlocal)\b|\b\d+(?:\.\d+)?\b/g,
				css: /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/g,
				json: /("(?:[^"\\\n]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/g,
				yaml: /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|^\s*(- |[a-zA-Z0-9_.-]+:)|(true|false|null)|(-?\d+(?:\.\d+)?)/gm,
				md: /(^#{1,6}[^\n]*$)|(\*\*[^*\n]+\*\*|`[^`\n]+`)|(^[-*+]\s.*$)|(^>.*$)/gm
			}[family];
			const out = [];
			let last = 0;
			let m;
			RE.lastIndex = 0;
			while ((m = RE.exec(code)) !== null) {
				if (m.index > last) out.push([null, code.slice(last, m.index)]);
				const full = m[0];
				let cls = null;
				if (family === "js") cls = m[1] ? TOKEN_CLASS.com : m[2] ? TOKEN_CLASS.str : m[3] ? TOKEN_CLASS.kw : m[4] ? TOKEN_CLASS.num : null;
				else if (family === "html") cls = m[1] ? TOKEN_CLASS.com : m[2] ? TOKEN_CLASS.tag : m[3] ? TOKEN_CLASS.attr : m[4] ? TOKEN_CLASS.str : null;
				else if (family === "py") cls = m[1] ? TOKEN_CLASS.com : m[2] ? TOKEN_CLASS.str : m[3] ? TOKEN_CLASS.kw : m[4] ? TOKEN_CLASS.num : null;
				else if (family === "css") cls = m[1] ? TOKEN_CLASS.com : m[2] ? TOKEN_CLASS.str : m[3] ? TOKEN_CLASS.num : m[4] ? TOKEN_CLASS.num : null;
				else if (family === "json") cls = m[1] ? TOKEN_CLASS.str : m[3] ? TOKEN_CLASS.kw : m[4] ? TOKEN_CLASS.num : null;
				else if (family === "yaml") cls = m[1] ? TOKEN_CLASS.com : m[2] ? TOKEN_CLASS.str : m[3] ? TOKEN_CLASS.attr : m[4] ? TOKEN_CLASS.kw : m[5] ? TOKEN_CLASS.num : null;
				else cls = TOKEN_CLASS.md;
				out.push([cls, full]);
				last = m.index + full.length;
				if (full.length === 0) RE.lastIndex++;
			}
			if (last < code.length) out.push([null, code.slice(last)]);
			return out;
		}

		// ──────────────────────────────────────────────────────────────
		// 文件图标（VS Code 式）：代码/数据类 = 按语言着色的字母徽章，
		// 媒体/压缩/二进制类 = emoji。徽章颜色在样式区按浅/深色双套定义
		// （body[data-ds-dark-theme] 覆盖），只改动 className，不改结构
		// ──────────────────────────────────────────────────────────────
		const FILE_ICONS = {
			js: ["JS", "Js"], mjs: ["JS", "Js"], cjs: ["JS", "Js"],
			ts: ["TS", "Ts"], mts: ["TS", "Ts"], cts: ["TS", "Ts"],
			jsx: ["⚛", "React"], tsx: ["⚛", "React"],
			vue: ["V", "Vue"], svelte: ["S", "Svelte"],
			py: ["Py", "Py"],
			json: ["{}", "Json"], jsonc: ["{}", "Json"],
			html: ["<>", "Html"], htm: ["<>", "Html"], xml: ["<>", "Xml"], svg: ["<>", "Svg"],
			css: ["#", "Css"], scss: ["#", "Scss"], sass: ["#", "Scss"], less: ["#", "Less"],
			md: ["M↓", "Md"], markdown: ["M↓", "Md"],
			yml: ["Y", "Yaml"], yaml: ["Y", "Yaml"],
			sh: ["❯", "Shell"], bash: ["❯", "Shell"], zsh: ["❯", "Shell"], ps1: ["❯", "Shell"], bat: ["❯", "Shell"], cmd: ["❯", "Shell"],
			toml: ["⚙", "Conf"], ini: ["⚙", "Conf"], cfg: ["⚙", "Conf"], conf: ["⚙", "Conf"], env: ["⚙", "Conf"], properties: ["⚙", "Conf"],
			txt: ["≡", "Txt"], log: ["≡", "Txt"],
			sql: ["DB", "Sql"], graphql: ["◈", "Gql"], gql: ["◈", "Gql"],
			rs: ["Rs", "Rs"], go: ["Go", "Go"], java: ["☕", "Emoji"],
			c: ["C", "C"], h: ["C", "C"],
			cpp: ["C+", "Cpp"], cc: ["C+", "Cpp"], cxx: ["C+", "Cpp"], hpp: ["C+", "Cpp"], cs: ["C#", "Cs"],
			rb: ["Rb", "Rb"], php: ["Φ", "Php"], kt: ["K", "Kt"], kts: ["K", "Kt"], swift: ["Sw", "Swift"],
			lua: ["Lu", "Lua"], r: ["R", "R"], wasm: ["W", "Wasm"],
			woff: ["A", "Font"], woff2: ["A", "Font"], ttf: ["A", "Font"], otf: ["A", "Font"], eot: ["A", "Font"],
			exe: ["⬢", "Bin"], dll: ["⬢", "Bin"], bin: ["⬢", "Bin"], dat: ["⬢", "Bin"], msi: ["⬢", "Bin"],
			png: ["🖼", "Emoji"], jpg: ["🖼", "Emoji"], jpeg: ["🖼", "Emoji"], gif: ["🖼", "Emoji"], webp: ["🖼", "Emoji"],
			bmp: ["🖼", "Emoji"], ico: ["🖼", "Emoji"], icns: ["🖼", "Emoji"], avif: ["🖼", "Emoji"],
			mp4: ["🎬", "Emoji"], mov: ["🎬", "Emoji"], avi: ["🎬", "Emoji"], mkv: ["🎬", "Emoji"], webm: ["🎬", "Emoji"],
			mp3: ["🎵", "Emoji"], wav: ["🎵", "Emoji"], ogg: ["🎵", "Emoji"], flac: ["🎵", "Emoji"],
			zip: ["📦", "Emoji"], tar: ["📦", "Emoji"], gz: ["📦", "Emoji"], rar: ["📦", "Emoji"], "7z": ["📦", "Emoji"], bz2: ["📦", "Emoji"], xz: ["📦", "Emoji"],
			pdf: ["📕", "Emoji"], lock: ["🔒", "Emoji"]
		};
		const FILE_ICON_NAMES = {
			"package.json": ["⬢", "Npm"], ".npmrc": ["⬢", "Npm"], ".nvmrc": ["⬢", "Npm"],
			"package-lock.json": ["🔒", "Emoji"], "yarn.lock": ["🔒", "Emoji"], "pnpm-lock.yaml": ["🔒", "Emoji"],
			"tsconfig.json": ["TS", "Ts"],
			"dockerfile": ["🐳", "Emoji"], "docker-compose.yml": ["🐳", "Emoji"], "docker-compose.yaml": ["🐳", "Emoji"], ".dockerignore": ["🐳", "Emoji"],
			"makefile": ["🛠", "Emoji"], "cmakelists.txt": ["🛠", "Emoji"],
			"license": ["📜", "Emoji"], "license.md": ["📜", "Emoji"], "license.txt": ["📜", "Emoji"],
			".gitignore": ["◆", "Git"], ".gitattributes": ["◆", "Git"], ".gitmodules": ["◆", "Git"]
		};
		function iconOf(name, isDir, expanded) {
			if (isDir) return { g: expanded ? "📂" : "📁", c: "vk_iconEmoji" };
			const lower = String(name).toLowerCase();
			const hit = FILE_ICON_NAMES[lower] ?? FILE_ICONS[lower.includes(".") ? lower.split(".").pop() : ""];
			if (hit) return { g: hit[0], c: hit[1] === "Emoji" ? "vk_iconEmoji" : "vk_iconChip vk_i" + hit[1] };
			return { g: "📄", c: "vk_iconEmoji" };
		}

		// ──────────────────────────────────────────────────────────────
		// 样式
		// ──────────────────────────────────────────────────────────────
		const css = [
			// ── 骨架与三栏 ─────────────────────────────────────────────
			// --vk-accent：官方主题未提供 --dsw-alias-accent（此前引用全部落空），
			// 回退到 --dsw-alias-state-business-primary（DeepSeek 蓝，浅/深自适应）
			".vk_frame{background:var(--dsw-alias-bg-base);height:100%;display:grid;grid-template-rows:100%;position:relative;overflow:hidden;--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary));--vk-accent-ring:color-mix(in srgb,var(--vk-accent) 22%,transparent);--vk-accent-soft:color-mix(in srgb,var(--vk-accent) 12%,transparent)}",
			".vk_frame[data-native] .vk_colRight{border-left:none}",
			".vk_frame[data-dragging]{user-select:none;cursor:col-resize}",
			".vk_colLeft{background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l1);min-width:0;overflow:hidden;display:flex;flex-direction:column}",
			".vk_colCenter{flex-direction:column;min-width:0;display:flex;overflow:hidden}",
			".vk_colRight{border-left:1px solid var(--dsw-alias-border-l2);min-width:0;overflow:hidden;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}",
			".vk_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}.vk_overlayLayer>*{pointer-events:auto}",
			// 拖拽手柄：悬停/拖动时浮现 accent 亮条
			".vk_handle{cursor:col-resize;z-index:2;touch-action:none;width:8px;margin-left:-4px;position:absolute;top:0;bottom:0}",
			".vk_handle::after{content:'';position:absolute;top:0;bottom:0;left:3px;width:2px;border-radius:1px;background:transparent;transition:background-color .15s}",
			".vk_handle:hover::after,.vk_handle[data-dragging]::after{background:var(--vk-accent)}",
			// ── 滚动条：细、半透明、贴主题；标签条隐藏但可滚 ─────────────
			".vk_tree,.vk_viewer,.vk_editorInput{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l1) transparent}",
			".vk_tree::-webkit-scrollbar,.vk_viewer::-webkit-scrollbar,.vk_editorInput::-webkit-scrollbar{width:10px;height:10px}",
			".vk_tree::-webkit-scrollbar-thumb,.vk_viewer::-webkit-scrollbar-thumb,.vk_editorInput::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l1);border:3px solid transparent;border-radius:6px;background-clip:padding-box;min-height:40px}",
			".vk_tree::-webkit-scrollbar-thumb:hover,.vk_viewer::-webkit-scrollbar-thumb:hover,.vk_editorInput::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l1);border:3px solid transparent;background-clip:padding-box}",
			".vk_tree::-webkit-scrollbar-track,.vk_viewer::-webkit-scrollbar-track,.vk_editorInput::-webkit-scrollbar-track,.vk_tree::-webkit-scrollbar-corner,.vk_viewer::-webkit-scrollbar-corner,.vk_editorInput::-webkit-scrollbar-corner{background:transparent}",
			// ── 面板 Tab 栏（左：文件/会话；右：对话/详情） ──────────────
			".vk_tabBar{display:flex;align-items:stretch;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-sidebar-fill)}",
			".vk_tabBtn{appearance:none;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-secondary);padding:7px 12px;font-size:12px;line-height:16px;font-family:inherit;border-bottom:2px solid transparent;transition:color .12s,background-color .12s,border-color .12s}",
			".vk_tabBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_tabBtnActive{color:var(--dsw-alias-label-primary);border-bottom-color:var(--vk-accent)}",
			".vk_tabBody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
			".vk_tabBodyHidden{display:none}",
			".vk_tabBarSpacer{flex:1}",
			// ── rail 窄条（左栏收起态）：图标 + accent 指示条 ────────────
			".vk_rail{align-items:center;padding:10px 0;gap:4px}",
			".vk_railBtn{appearance:none;border:none;background:none;cursor:pointer;width:38px;height:38px;border-radius:9px;font-size:17px;line-height:1;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;position:relative;transition:background-color .12s,color .12s,transform .08s}",
			".vk_railBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".vk_railBtn:active{transform:scale(.93)}",
			".vk_railBtnActive{background:var(--vk-accent-soft);color:var(--vk-accent)}",
			".vk_railBtnActive::before{content:'';position:absolute;left:-9px;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--vk-accent)}",
			".vk_railSpacer{flex:1}",
			// ── 文件树头部与工具按钮 ───────────────────────────────────
			".vk_treeWrap{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
			".vk_treeHead{display:flex;align-items:center;gap:2px;flex:none;padding:7px 6px 7px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".vk_treeTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}",
			".vk_treeBtn{appearance:none;border:none;background:none;cursor:pointer;width:24px;height:24px;padding:0;border-radius:6px;font-size:13px;line-height:1;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;flex:none;transition:background-color .12s,color .12s}",
			".vk_treeBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".vk_treeBtnActive{background:var(--vk-accent-soft);color:var(--vk-accent)}",
			// ── 表单（打开文件夹/新建/重命名/搜索） ─────────────────────
			".vk_pickForm{padding:8px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".vk_pickInput{box-sizing:border-box;width:100%;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:12px;padding:6px 9px;outline:none;font-family:inherit;transition:border-color .12s,box-shadow .12s}",
			".vk_pickInput:hover{border-color:var(--dsw-alias-border-l3)}",
			".vk_pickInput:focus{border-color:var(--vk-accent);box-shadow:0 0 0 2px var(--vk-accent-ring)}",
			".vk_pickInput::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".vk_row .vk_pickInput{padding:3px 8px}",
			".vk_pickRow{display:flex;gap:6px;justify-content:flex-end}",
			".vk_pickBtn{appearance:none;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;padding:4px 12px;font-family:inherit;transition:background-color .12s,border-color .12s,color .12s}",
			".vk_pickBtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}",
			// 模式切换胶囊（accent 实心；右栏「全屏对话/分栏视图」与「新建文件/文件夹」切换复用。
			// 位置须在 .vk_pickBtn/.vk_tabBtn 之后：同级特异性下靠后者覆盖底色与圆角）
			".vk_modeBtn{align-self:center;background:var(--vk-accent);color:#fff;border-radius:999px;padding:4px 13px;margin:0 8px 0 4px;border-bottom:none;font-weight:600;line-height:16px;letter-spacing:.2px;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:filter .12s,box-shadow .12s,color .12s,background-color .12s}",
			".vk_modeBtn:hover{color:#fff;background:var(--vk-accent);filter:brightness(1.1);box-shadow:0 2px 8px var(--vk-accent-ring)}",
			// ── 文件树行：缩进参考线 / 图标 / 悬停与选中层次 ─────────────
			".vk_tree{flex:1;min-height:0;overflow:auto;padding:4px 0}",
			".vk_row{position:relative;display:flex;align-items:center;gap:5px;padding:2px 8px 2px 4px;cursor:pointer;font-size:13px;line-height:22px;white-space:nowrap;user-select:none;transition:background-color .1s}",
			".vk_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_rowActive{background:var(--vk-accent-soft)}",
			".vk_rowActive:hover{background:var(--vk-accent-ring)}",
			".vk_rowHidden{opacity:.55}",
			".vk_guide{position:absolute;top:0;bottom:0;width:0;border-left:1px solid var(--dsw-alias-border-l2)}",
			".vk_row:hover .vk_guide{border-left-color:var(--dsw-alias-border-l3)}",
			".vk_caret{width:14px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center;font-size:10px}",
			".vk_name{overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}",
			".vk_dirName{font-weight:500}",
			".vk_relPath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".vk_nameFixed{flex:none}",
			".vk_rowActions{display:none;flex:none;margin-left:4px;align-items:center;gap:2px}",
			".vk_row:not(:has(.vk_gitBadge)) .vk_rowActions{margin-left:auto}",
			".vk_row:hover .vk_rowActions{display:flex}",
			".vk_rowBtn{appearance:none;border:none;background:none;cursor:pointer;font-size:11px;width:20px;height:20px;padding:0;border-radius:5px;line-height:1;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;transition:background-color .1s,color .1s}",
			".vk_rowBtn:hover{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-label-primary)}",
			".vk_hiddenHint{padding:3px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary);cursor:default;white-space:nowrap;font-style:italic}",
			// ── 文件图标徽章（浅色基准；深色在文末覆盖） ─────────────────
			".vk_icon{flex:none;width:17px;height:17px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1}",
			".vk_iconChip{width:16px;height:16px;border-radius:4px;font-size:8.5px;font-weight:700;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:.1px}",
			".vk_iJs{color:#9c8205;background:rgba(241,224,90,.28)}",
			".vk_iTs{color:#3178c6;background:rgba(49,120,198,.16)}",
			".vk_iReact{color:#0e9fc9;background:rgba(97,218,251,.2)}",
			".vk_iPy{color:#3572a5;background:rgba(53,114,165,.14)}",
			".vk_iJson{color:#a87b00;background:rgba(203,182,65,.18)}",
			".vk_iHtml{color:#e34c26;background:rgba(227,76,38,.12)}",
			".vk_iXml{color:#7d4b8f;background:rgba(125,75,143,.12)}",
			".vk_iSvg{color:#b8563e;background:rgba(184,86,62,.12)}",
			".vk_iCss{color:#2965f1;background:rgba(41,101,241,.12)}",
			".vk_iScss{color:#c6538c;background:rgba(198,83,140,.12)}",
			".vk_iLess{color:#2a4d8f;background:rgba(42,77,143,.12)}",
			".vk_iVue{color:#41b883;background:rgba(65,184,131,.16)}",
			".vk_iSvelte{color:#ff3e00;background:rgba(255,62,0,.1)}",
			".vk_iMd{color:#519aba;background:rgba(81,154,186,.14)}",
			".vk_iYaml{color:#c93c3c;background:rgba(203,60,60,.1)}",
			".vk_iShell{color:#4e9a06;background:rgba(137,224,81,.18)}",
			".vk_iConf{color:#6d8086;background:rgba(109,128,134,.14)}",
			".vk_iTxt{color:#7f8c8d;background:rgba(127,140,141,.14)}",
			".vk_iSql{color:#e38c00;background:rgba(227,140,0,.12)}",
			".vk_iGql{color:#e535ab;background:rgba(229,53,171,.12)}",
			".vk_iRs{color:#b4713d;background:rgba(222,165,132,.22)}",
			".vk_iGo{color:#00add8;background:rgba(0,173,216,.12)}",
			".vk_iC{color:#5c6bc0;background:rgba(92,107,192,.14)}",
			".vk_iCpp{color:#d1477b;background:rgba(243,75,125,.12)}",
			".vk_iCs{color:#2c8c1e;background:rgba(35,145,32,.12)}",
			".vk_iRb{color:#cc342d;background:rgba(204,52,45,.1)}",
			".vk_iPhp{color:#777bb4;background:rgba(119,123,180,.14)}",
			".vk_iKt{color:#7f52ff;background:rgba(127,82,255,.12)}",
			".vk_iSwift{color:#f05138;background:rgba(240,81,56,.12)}",
			".vk_iLua{color:#4a4ab8;background:rgba(74,74,184,.12)}",
			".vk_iR{color:#276dc3;background:rgba(39,109,195,.12)}",
			".vk_iWasm{color:#654ff0;background:rgba(101,79,240,.12)}",
			".vk_iFont{color:#a074c4;background:rgba(160,116,196,.14)}",
			".vk_iBin{color:#6e7681;background:rgba(110,118,129,.16)}",
			".vk_iGit{color:#e94e32;background:rgba(240,80,51,.12)}",
			".vk_iNpm{color:#cb3837;background:rgba(203,56,55,.12)}",
			// ── Git 角标：VS Code 式纯色字母（无底色胶囊） ────────────────
			".vk_gitBadge{flex:none;margin-left:auto;padding:0 2px;font-size:11px;font-weight:700;line-height:16px;letter-spacing:.2px}",
			".vk_gitM{color:#c09a52}",
			".vk_gitU,.vk_gitA{color:#4f9e68}",
			".vk_gitD{color:#d64545}",
			".vk_gitR{color:#a866c4}",
			// ── 中间编辑区：标签条 / 标签页（激活·脏标记·关闭键层次） ─────
			".vk_editor{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
			".vk_tabStrip{display:flex;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-sidebar-fill);overflow-x:auto;scrollbar-width:none}",
			".vk_tabStrip::-webkit-scrollbar{display:none}",
			".vk_fileTab{display:flex;align-items:center;gap:7px;flex:0 1 auto;min-width:112px;max-width:230px;cursor:pointer;padding:7px 10px 7px 12px;font-size:12.5px;color:var(--dsw-alias-label-secondary);border-right:1px solid var(--dsw-alias-border-l1);background:transparent;border-top:none;border-left:none;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap;transition:background-color .1s,color .1s,border-color .1s}",
			".vk_fileTab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_fileTabActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border-bottom-color:var(--vk-accent)}",
			".vk_tabName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".vk_menu{position:fixed;z-index:60;min-width:160px;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px;box-shadow:var(--dsw-shadow-lv3);display:flex;flex-direction:column}",
			".vk_menuItem{appearance:none;border:none;background:none;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary);font-size:12.5px;font-family:inherit;padding:6px 10px;border-radius:5px}",
			".vk_menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_menuItemDanger{color:var(--dsw-alias-state-error-primary)}",
			".vk_fileTab[draggable=true]{cursor:grab}",
			".vk_fileTab[draggable=true]:active{cursor:grabbing}",
			".vk_tabClose{appearance:none;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-tertiary);padding:0;width:18px;height:18px;font-size:13px;border-radius:5px;line-height:1;display:flex;align-items:center;justify-content:center;flex:none;opacity:0;pointer-events:none;transition:opacity .1s,background-color .1s,color .1s}",
			".vk_fileTab:hover .vk_tabClose,.vk_fileTabActive:not(.vk_fileTabDirty) .vk_tabClose{opacity:1;pointer-events:auto}",
			".vk_tabClose:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover-accent)}",
			".vk_fileTabDirty:hover .vk_tabDot{display:none}",
			// ── 查看器：行号槽与代码区 ─────────────────────────────────
			".vk_viewer{flex:1;min-height:0;overflow:auto;display:flex;font-family:ui-monospace,'Cascadia Mono',Consolas,'Courier New',monospace;font-size:12.5px;line-height:20px}",
			".vk_gutter{flex:none;white-space:pre;min-width:46px;text-align:right;padding:10px 12px 10px 0;color:var(--dsw-alias-label-tertiary);user-select:none;background:var(--dsw-alias-bg-base);border-right:1px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums;position:sticky;left:0;z-index:1}",
			".vk_code{flex:1;margin:0;padding:10px 14px;white-space:pre;tab-size:4;color:var(--dsw-alias-label-primary)}",
			".vk_viewer ::selection{background:var(--vk-accent-ring)}",
			".vk_codeHl{flex:1;overflow:visible;padding:0}",
			".vk_codeHl .shiki{background:transparent !important;color:var(--dsw-alias-label-primary);margin:0;padding:10px 14px;line-height:20px;font-size:12.5px;tab-size:4;overflow:visible !important;font-family:inherit}",
			".vk_codeHl .shiki code{font-family:inherit;font-size:inherit;line-height:20px}",
			// 兜底高亮（shiki 返回前的瞬态）：CSS 固定 dark 配色。
			// 正常路径已支持主题：后端 highlight 接口按 theme 参数返回
			// github-light/github-dark，Viewer 监听 body[data-ds-dark-theme]
			// 切换时重取。兜底仅在 shiki 失败时短暂出现，偏 dark 可接受
			".vk_tokCom{color:#8b949e;font-style:italic}",
			".vk_tokStr{color:#a5d6ff}",
			".vk_tokKw{color:#ff7b72}",
			".vk_tokNum{color:#79c0ff}",
			".vk_tokTag{color:#7ee787}",
			".vk_tokAttr{color:#79c0ff}",
			".vk_tokMd{color:#ffa657}",
			// ── 编辑模式：工具条 / 按钮 / 输入区 ────────────────────────
			".vk_editBar{display:flex;align-items:center;gap:8px;flex:none;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}",
			".vk_editBtn{appearance:none;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;padding:4px 12px;font-family:inherit;transition:background-color .12s,border-color .12s,filter .12s,opacity .12s}",
			".vk_editBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}",
			".vk_editBtn:disabled{opacity:.5;cursor:default}",
			".vk_editBtnPrimary{background:var(--vk-accent);border-color:transparent;color:#fff;font-weight:600}",
			".vk_editBtnPrimary:hover:not(:disabled){background:var(--vk-accent);border-color:transparent;filter:brightness(1.1)}",
			".vk_dirtyDot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--vk-accent)}",
			".vk_tabDot{flex:none}",
			".vk_editorBody{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
			".vk_editorInput{flex:1;min-height:0;box-sizing:border-box;width:100%;resize:none;border:none;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,'Cascadia Mono',Consolas,'Courier New',monospace;font-size:12.5px;line-height:20px;padding:10px 14px;white-space:pre;overflow:auto;tab-size:4;caret-color:var(--vk-accent)}",
			".vk_editorInput::selection{background:var(--vk-accent-ring)}",
			".vk_saveMsg{font-size:12px;color:var(--dsw-alias-label-secondary);flex:none}",
			".vk_trajBody{overflow:auto}",
			// ── 空态 / 错误 / 通知排版 ─────────────────────────────────
			".vk_err{margin:8px;padding:8px 10px;font-size:12px;line-height:1.6;color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover-danger);border-radius:6px}",
			".vk_empty{padding:32px 20px;font-size:12.5px;line-height:2;color:var(--dsw-alias-label-tertiary);text-align:center;white-space:pre-wrap}",
			".vk_notice{padding:32px 20px;font-size:13px;line-height:2;color:var(--dsw-alias-label-secondary);text-align:center;white-space:pre-wrap}",
			// ── 键盘聚焦可见态（统一 accent 光圈） ──────────────────────
			".vk_tabBtn:focus-visible,.vk_railBtn:focus-visible,.vk_treeBtn:focus-visible,.vk_rowBtn:focus-visible,.vk_pickBtn:focus-visible,.vk_editBtn:focus-visible,.vk_tabClose:focus-visible{outline:2px solid var(--vk-accent-ring);outline-offset:-2px}",
			// ── 深色主题覆盖：徽章/角标颜色提亮 ─────────────────────────
			"body[data-ds-dark-theme] .vk_iJs{color:#f1e05a;background:rgba(241,224,90,.14)}",
			"body[data-ds-dark-theme] .vk_iTs{color:#5496d8}",
			"body[data-ds-dark-theme] .vk_iReact{color:#61dafb;background:rgba(97,218,251,.12)}",
			"body[data-ds-dark-theme] .vk_iPy{color:#6aa5e0}",
			"body[data-ds-dark-theme] .vk_iJson{color:#cbcb41}",
			"body[data-ds-dark-theme] .vk_iHtml{color:#ff7a59}",
			"body[data-ds-dark-theme] .vk_iXml{color:#b47fd4}",
			"body[data-ds-dark-theme] .vk_iSvg{color:#e08a70}",
			"body[data-ds-dark-theme] .vk_iCss{color:#6ea8ff}",
			"body[data-ds-dark-theme] .vk_iLess{color:#7a9ee0}",
			"body[data-ds-dark-theme] .vk_iYaml{color:#ff7b72}",
			"body[data-ds-dark-theme] .vk_iShell{color:#89e051}",
			"body[data-ds-dark-theme] .vk_iConf{color:#9aa7b0}",
			"body[data-ds-dark-theme] .vk_iTxt{color:#9aa7b0}",
			"body[data-ds-dark-theme] .vk_iSql{color:#f0a63c}",
			"body[data-ds-dark-theme] .vk_iRs{color:#dea584}",
			"body[data-ds-dark-theme] .vk_iC{color:#8fa3e8}",
			"body[data-ds-dark-theme] .vk_iCs{color:#6fbf4a}",
			"body[data-ds-dark-theme] .vk_iRb{color:#ff7b72}",
			"body[data-ds-dark-theme] .vk_iLua{color:#8b8bff}",
			"body[data-ds-dark-theme] .vk_iR{color:#6aa5e0}",
			"body[data-ds-dark-theme] .vk_iBin{color:#9aa7b0}",
			"body[data-ds-dark-theme] .vk_iGit{color:#f05033}",
			"body[data-ds-dark-theme] .vk_gitM{color:#e2c08d}",
			"body[data-ds-dark-theme] .vk_gitU,body[data-ds-dark-theme] .vk_gitA{color:#73c991}",
			"body[data-ds-dark-theme] .vk_gitD{color:#f14c4c}",
			"body[data-ds-dark-theme] .vk_gitR{color:#c678dd}",
			// 设置面板 · 全局人设分区
			".vk_personaSection{display:flex;flex-direction:column;gap:10px;padding:16px;width:100%;box-sizing:border-box}",
			".vk_personaDesc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.7}",
			".vk_personaArea{min-height:280px;resize:vertical;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;font-family:inherit;font-size:12.5px;line-height:1.75;tab-size:4}",
			".vk_personaArea:focus{outline:none;border-color:var(--vk-accent)}",
			".vk_personaFoot{display:flex;align-items:center;gap:8px}",
			".vk_personaMsg{font-size:12px}",
			".vk_personaMsgOk{color:#73c991}",
			".vk_personaMsgErr{color:#f14c4c}",
			".vk_personaSave{background:var(--vk-accent);color:#fff;border-radius:6px;padding:6px 16px;font-weight:600;border:none;cursor:pointer;font-size:12.5px}",
			".vk_personaSave:hover{filter:brightness(1.1)}",
			".vk_personaSave:disabled{opacity:.5;cursor:default}"
		].join("");
		{
			const tagId = "@anoslide/dsh-client-vscode-layout/vscode.module.css";
			if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
				const tag = document.createElement("style");
				tag.dataset.plugin = "@anoslide/dsh-client-vscode-layout";
				tag.dataset.pluginCss = tagId;
				tag.textContent = css;
				document.head.appendChild(tag);
			}
		}

		// ──────────────────────────────────────────────────────────────
		// 本地持久化：标签页与侧栏 Tab
		// ──────────────────────────────────────────────────────────────
		function loadTabs() {
			try {
				const raw = localStorage.getItem(LS_KEY);
				if (raw) {
					const d = JSON.parse(raw);
					if (d && Array.isArray(d.tabs)) {
						return {
							tabs: d.tabs.filter((t) => t && typeof t.path === "string" && typeof t.name === "string").slice(-20),
							active: typeof d.active === "string" ? d.active : null,
							sidebarTab: d.sidebarTab === "sessions" ? "sessions" : "files",
							root: typeof d.root === "string" && d.root.length > 0 ? d.root : null,
							mode: d.mode === "native" ? "native" : "ide"
						};
					}
				}
			} catch {}
			return { tabs: [], active: null, sidebarTab: "files", root: null, mode: "ide" };
		}
		function saveTabs(state) {
			try {
				localStorage.setItem(LS_KEY, JSON.stringify(state));
			} catch {}
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：行内重命名输入（模块级：稳定组件身份，避免每次渲染重挂载丢光标）
		// ──────────────────────────────────────────────────────────────
		function RenameRow({ pad, initialName, error, onCommit, onCancel }) {
			const [value, setValue] = react.useState(initialName);
			const commit = react.useCallback(() => {
				onCommit(value);
			}, [value, onCommit]);
			return h("div", { className: "vk_row", style: pad },
				h("input", {
					className: "vk_pickInput",
					value,
					autoFocus: true,
					onChange: (e) => setValue(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") commit();
						if (e.key === "Escape") onCancel();
					},
					onBlur: commit
				}),
				error !== null ? h("span", { className: "vk_saveMsg" }, error) : null
			);
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：文件树
		// ──────────────────────────────────────────────────────────────
		function FileTree({ root, custom, onOpenFolder, onCloseFolder, onOpenFile, onPickNative, activePath, onDeleted, onRenamed }) {
			const [expanded, setExpanded] = react.useState(() => new Set());
			const [entries, setEntries] = react.useState(() => ({}));
			const [error, setError] = react.useState(null);
			const [picking, setPicking] = react.useState(false);
			const [draft, setDraft] = react.useState("");
			const [showHidden, setShowHidden] = react.useState(false);
			const [git, setGit] = react.useState(null);
			react.useEffect(() => {
				setGit(null);
				if (typeof root === "string" && root.length > 0) {
					fetch("/vscode-files/git?path=" + encodeURIComponent(root))
						.then((r) => r.json())
						.then((d) => { if (d && d.ok && d.statuses) setGit(d.statuses); })
						.catch(() => {});
				}
			}, [root]);
			const [creating, setCreating] = react.useState(null);
			const [createName, setCreateName] = react.useState("");
			const [createErr, setCreateErr] = react.useState(null);
			const [renaming, setRenaming] = react.useState(null);
			const [renameErr, setRenameErr] = react.useState(null);
			const [searchOn, setSearchOn] = react.useState(false);
			const [searchQ, setSearchQ] = react.useState("");
			const [searchResults, setSearchResults] = react.useState(null);
			react.useEffect(() => {
				const q = searchQ.trim();
				if (q.length === 0) {
					setSearchResults(null);
					return;
				}
				if (typeof root !== "string" || root.length === 0) return;
				let dead = false;
				const timer = setTimeout(() => {
					fetch("/vscode-files/search?path=" + encodeURIComponent(root) + "&q=" + encodeURIComponent(q))
						.then((r) => r.json())
						.then((d) => { if (!dead) setSearchResults(d && d.ok ? d.results : []); })
						.catch(() => { if (!dead) setSearchResults([]); });
				}, 250);
				return () => { dead = true; clearTimeout(timer); };
			}, [searchQ, root]);
			react.useEffect(() => {
				setExpanded(new Set());
				setEntries({});
				setError(null);
				if (typeof root === "string" && root.length > 0) load(root);
			}, [root]);
			function load(path) {
				fetch("/vscode-files/list?path=" + encodeURIComponent(path))
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) setEntries((m) => ({ ...m, [path]: d }));
						else setError((d && d.error) || "加载失败");
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
				if (p.startsWith(root + "\\") || p.startsWith(root + "/")) return p.slice(root.length + 1).replace(/\\/g, "/");
				return null;
			}
			function badgeOf(code) {
				if (code === "??") return { text: "U", cls: " vk_gitU" };
				if (code.includes("M")) return { text: "M", cls: " vk_gitM" };
				if (code.includes("A")) return { text: "A", cls: " vk_gitA" };
				if (code.includes("D")) return { text: "D", cls: " vk_gitD" };
				if (code.includes("R")) return { text: "R", cls: " vk_gitR" };
				return null;
			}
			function dirBadge(dirPath) {
				if (git === null) return null;
				const base = rel(dirPath);
				if (base === null) return null;
				const prefix = base === "" ? "" : base + "/";
				let hasM = false;
				let hasOther = false;
				for (const k of Object.keys(git)) {
					const hit = prefix === "" ? !k.includes("/") : k.startsWith(prefix);
					if (!hit) continue;
					if (git[k].includes("M") || git[k].includes("D") || git[k].includes("R")) hasM = true;
					else hasOther = true;
				}
				if (hasM) return { text: "M", cls: " vk_gitM" };
				if (hasOther) return { text: "U", cls: " vk_gitU" };
				return null;
			}
			function parentOf(p) {
				const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
				return i > 0 ? p.slice(0, i) : p;
			}
			function refreshGit() {
				if (typeof root !== "string" || root.length === 0) return;
				fetch("/vscode-files/git?path=" + encodeURIComponent(root))
					.then((r) => r.json())
					.then((d) => { if (d && d.ok && d.statuses) setGit(d.statuses); })
					.catch(() => {});
			}
			function refreshAround(dirPath) {
				load(dirPath);
				setEntries((m) => {
					const next = {};
					for (const k of Object.keys(m)) {
						if (k === dirPath) continue;
						if (k.startsWith(dirPath + "\\") || k.startsWith(dirPath + "/")) continue;
						next[k] = m[k];
					}
					return next;
				});
				refreshGit();
			}
			function commitCreate() {
				const n = createName.trim();
				const kind = creating;
				if (n.length === 0 || kind === null) return;
				const parent = typeof root === "string" ? root : "";
				if (parent.length === 0) return;
				const endpoint = kind === "dir" ? "/vscode-files/mkdir" : "/vscode-files/mkfile";
				fetch(endpoint + "?path=" + encodeURIComponent(parent), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ path: parent, name: n })
				})
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) {
							setCreateErr(null);
							setCreating(null);
							setCreateName("");
							refreshAround(parent);
							if (kind === "file" && d.path) onOpenFile({ path: d.path, name: n });
						} else setCreateErr((d && d.error) || "创建失败");
					})
					.catch((e) => setCreateErr(String(e)));
			}
			function commitRename(nameOverride) {
				if (renaming === null) return;
				const n = (nameOverride ?? renaming.name).trim();
				if (n.length === 0 || n === renaming.oldName) {
					setRenaming(null);
					setRenameErr(null);
					return;
				}
				fetch("/vscode-files/rename?path=" + encodeURIComponent(renaming.path), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ path: renaming.path, newName: n })
				})
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) {
							const newPath = d.path;
							setRenaming(null);
							setRenameErr(null);
							refreshAround(parentOf(renaming.path));
							onRenamed?.(renaming.path, newPath, n);
						} else setRenameErr((d && d.error) || "重命名失败");
					})
					.catch((e) => setRenameErr(String(e)));
			}
			function doDelete(path, name) {
				if (typeof confirm === "function" && !confirm(`删除「${name}」？\n（会送入回收站，可从回收站恢复）`)) return;
				fetch("/vscode-files/delete?path=" + encodeURIComponent(path), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ path })
				})
					.then((r) => r.json())
					.then((d) => {
						if (d && d.ok) {
							refreshAround(parentOf(path));
							onDeleted?.(path);
						} else setError((d && d.error) || "删除失败");
					})
					.catch((e) => setError(String(e)));
			}
			function rows(dir, depth) {
				if (!dir) return [];
				const out = [];
				for (const d of dir.dirs) {
					if (d.hidden && !showHidden) continue;
					out.push(h(Row, { key: d.path, path: d.path, name: d.name, isDir: true, hidden: d.hidden, active: false, badge: dirBadge(d.path), depth, expanded: expanded.has(d.path), onToggle: () => toggle(d.path) }));
					if (expanded.has(d.path) && entries[d.path] && entries[d.path].ok) out.push(...rows(entries[d.path], depth + 1));
				}
				for (const f of dir.files) {
					if (f.hidden && !showHidden) continue;
					const code = git !== null ? git[rel(f.path) ?? ""] ?? null : null;
					out.push(h(Row, { key: f.path, path: f.path, name: f.name, isDir: false, hidden: f.hidden, active: f.path === activePath, badge: code !== null && rel(f.path) !== null ? badgeOf(code) : null, depth, onToggle: () => onOpenFile({ path: f.path, name: f.name }) }));
				}
				return out;
			}
			function Row(props) {
				const pad = { paddingLeft: 10 + props.depth * 16 + "px" };
				if (renaming !== null && renaming.path === props.path) {
					return h(RenameRow, {
						pad,
						initialName: renaming.name,
						error: renameErr,
						onCommit: (value) => commitRename(value),
						onCancel: () => { setRenaming(null); setRenameErr(null); }
					});
				}
				const caret = props.isDir ? h("span", { className: "vk_caret" }, props.expanded ? "▾" : "▸") : h("span", { className: "vk_caret" }, "\u00A0");
				// 缩进参考线（纯装饰）：对齐各级祖先目录的 caret 中心
				const guides = [];
				for (let i = 0; i < props.depth; i++) guides.push(h("span", { key: "g" + i, className: "vk_guide", style: { left: 17 + i * 16 + "px" } }));
				const ic = iconOf(props.name, props.isDir, props.isDir && props.expanded === true);
				const icon = h("span", { className: "vk_icon " + ic.c }, ic.g);
				const name = props.isDir
					? h("span", { className: "vk_name vk_dirName" }, props.name)
					: h("span", { className: "vk_name" }, props.name);
				const badge = props.badge ? h("span", { className: "vk_gitBadge" + props.badge.cls }, props.badge.text) : null;
				const actions = h("span", { className: "vk_rowActions" },
					h("button", { className: "vk_rowBtn", title: "重命名", onClick: (e) => { e.stopPropagation(); setRenaming({ path: props.path, name: props.name, oldName: props.name }); setRenameErr(null); } }, "🖊"),
					h("button", { className: "vk_rowBtn", title: "删除（送入回收站）", onClick: (e) => { e.stopPropagation(); doDelete(props.path, props.name); } }, "🗑")
				);
				return h("div", { className: "vk_row" + (props.hidden ? " vk_rowHidden" : "") + (props.active ? " vk_rowActive" : ""), style: pad, onClick: props.onToggle }, guides, caret, icon, name, badge, actions);
			}
			function commitFolder() {
				const p = draft.trim();
				setPicking(false);
				setDraft("");
				if (p.length > 0) onOpenFolder(p);
			}
			const title = typeof root === "string" && root.length > 0 ? (root.split(/[\\/]/).pop() || root) : "文件";
			const head = h("div", { className: "vk_treeHead" },
				h("span", { className: "vk_treeTitle", title: typeof root === "string" ? root : "" }, title),
				h("button", {
					className: "vk_treeBtn",
					title: "打开文件夹（系统对话框）",
					onClick: async () => {
						try {
							const p = await onPickNative();
							if (typeof p === "string" && p.length > 0) onOpenFolder(p);
						} catch {
							setPicking(true);
							setDraft("");
						}
					}
				}, "📂"),
				h("button", { className: "vk_treeBtn" + (showHidden ? " vk_treeBtnActive" : ""), title: showHidden ? "隐藏系统/配置文件" : "显示系统/配置文件（node_modules、.git 等）", onClick: () => setShowHidden((v) => !v) }, "👁"),
				h("button", { className: "vk_treeBtn", title: "手动输入路径", onClick: () => { setPicking(true); setDraft(""); } }, "✏️"),
				h("button", { className: "vk_treeBtn" + (creating !== null ? " vk_treeBtnActive" : ""), title: "新建文件/文件夹", onClick: () => { setCreating(creating === null ? "file" : null); setCreateName(""); setCreateErr(null); } }, "＋"),
				h("button", { className: "vk_treeBtn" + (searchOn ? " vk_treeBtnActive" : ""), title: "搜索文件", onClick: () => { setSearchOn(!searchOn); setSearchQ(""); } }, "🔍"),
				custom ? h("button", { className: "vk_treeBtn", title: "关闭当前文件夹（回到会话工作区）", onClick: onCloseFolder }, "×") : null
			);
			const picker = picking ? h("div", { className: "vk_pickForm" },
				h("input", {
					className: "vk_pickInput",
					placeholder: "输入文件夹绝对路径，如 D:\\csgo.text",
					value: draft,
					autoFocus: true,
					onChange: (e) => setDraft(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") commitFolder();
						if (e.key === "Escape") { setPicking(false); setDraft(""); }
					}
				}),
				h("div", { className: "vk_pickRow" },
					h("button", { className: "vk_pickBtn", onClick: commitFolder }, "打开"),
					h("button", { className: "vk_pickBtn", onClick: () => { setPicking(false); setDraft(""); } }, "取消")
				)
			) : null;
			const createForm = creating !== null ? h("div", { className: "vk_pickForm" },
				h("div", { className: "vk_pickRow" },
					h("button", { className: "vk_pickBtn" + (creating === "file" ? " vk_modeBtn" : ""), onClick: () => setCreating("file") }, "新建文件"),
					h("button", { className: "vk_pickBtn" + (creating === "dir" ? " vk_modeBtn" : ""), onClick: () => setCreating("dir") }, "新建文件夹")
				),
				h("input", {
					className: "vk_pickInput",
					placeholder: creating === "dir" ? "文件夹名" : "文件名",
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
					h("button", { className: "vk_pickBtn", onClick: commitCreate }, "创建"),
					h("button", { className: "vk_pickBtn", onClick: () => { setCreating(null); setCreateName(""); setCreateErr(null); } }, "取消")
				)
			) : null;
			const searchForm = searchOn ? h("div", { className: "vk_pickForm" },
				h("input", {
					className: "vk_pickInput",
					placeholder: "搜索文件名…（回车打开第一个结果）",
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
					if (searchResults === null) return h("div", { className: "vk_empty" }, "搜索中…");
					if (searchResults.length === 0) return h("div", { className: "vk_empty" }, "没有匹配的文件");
					return searchResults.map((r) => h("div", { key: r.path, className: "vk_row", style: { paddingLeft: 10 + "px" }, onClick: () => { onOpenFile({ path: r.path, name: r.name }); setSearchOn(false); setSearchQ(""); } },
						h("span", { className: "vk_caret" }, "\u00A0"),
						h("span", { className: "vk_icon " + iconOf(r.name, false, false).c }, iconOf(r.name, false, false).g),
						h("span", { className: "vk_name vk_nameFixed" }, r.name),
						h("span", { className: "vk_relPath" }, r.rel)
					));
				}
				if (typeof root !== "string" || root.length === 0) return h("div", { className: "vk_empty" }, "暂无工作区\n打开一个会话后，这里会显示其文件树");
				if (error !== null) return h("div", { className: "vk_err" }, error);
				if (dir === void 0) return h("div", { className: "vk_empty" }, "加载中…");
				if (dir.ok) {
					const hiddenCount = showHidden ? 0 : dir.dirs.filter((d) => d.hidden).length + dir.files.filter((f) => f.hidden).length;
					return [...rows(dir, 0), hiddenCount > 0 ? h("div", { key: "__hiddenHint", className: "vk_hiddenHint" }, "⋯ 已折叠 " + hiddenCount + " 个隐藏项（点 👁 显示）") : null];
				}
				return h("div", { className: "vk_err" }, dir.error || "无法读取目录");
			})();
			return h("div", { className: "vk_treeWrap" }, head, picker, createForm, searchForm, h("div", { className: "vk_tree" }, body));
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：查看器
		// ──────────────────────────────────────────────────────────────
		function Viewer({ file, rev, onStartEdit }) {
			const [state, setState] = react.useState({ loading: true });
			const [hl, setHl] = react.useState(null);
			// 浅色/深色主题切换时重取高亮（服务端按 theme 出 github-light/github-dark 色板）
			const [themeTick, setThemeTick] = react.useState(0);
			react.useEffect(() => {
				const mo = new MutationObserver(() => setThemeTick((t) => t + 1));
				mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
				return () => mo.disconnect();
			}, []);
			react.useEffect(() => {
				let dead = false;
				setState({ loading: true });
				fetch("/vscode-files/read?path=" + encodeURIComponent(file.path))
					.then((r) => r.json())
					.then((d) => { if (!dead) setState(d && d.ok ? d : { error: (d && d.error) || "读取失败" }); })
					.catch((e) => { if (!dead) setState({ error: String(e) }); });
				return () => { dead = true; };
			}, [file.path, rev]);
			react.useEffect(() => {
				if (state.kind !== "text") return;
				let dead = false;
				const theme = document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
				fetch("/vscode-files/highlight?path=" + encodeURIComponent(file.path) + "&theme=" + theme)
					.then((r) => r.json())
					.then((d) => { if (!dead) setHl(d && d.ok ? d.html : null); })
					.catch(() => { if (!dead) setHl(null); });
				return () => { dead = true; };
			}, [file.path, rev, state.kind, themeTick]);
			const editable = state.kind === "text";
			const bar = h("div", { className: "vk_editBar" },
				editable ? h("button", { className: "vk_editBtn", title: "编辑此文件（Ctrl+S 保存）", onClick: () => onStartEdit(state.content) }, "✏️ 编辑") : null,
				h("div", { style: { flex: 1 } })
			);
			if (state.loading) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "加载中…"));
			if (state.error !== void 0) return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "读取失败：\n" + state.error));
			if (state.kind === "binary") return h("div", { className: "vk_editorBody" }, bar, h("div", { className: "vk_notice" }, "二进制文件，无法预览\n（" + state.size + " 字节）"));
			if (state.kind === "too-large") {
				const head = "文件过大，仅显示前 2 MB（超大文件暂不支持编辑）\n\n";
				const lines = (head + state.content).split("\n");
				const tokens = tokenize(head + state.content, familyOf(file.path));
				const gutter = lines.map((_, i) => String(i + 1)).join("\n");
				const codeChildren = tokens.map((tok, i) => tok[0] === null ? escapeHtml(tok[1]) : h("span", { key: i, className: tok[0] }, escapeHtml(tok[1])));
				return h("div", { className: "vk_editorBody" },
					bar,
					h("div", { className: "vk_viewer" },
						h("div", { className: "vk_gutter" }, gutter),
						h("pre", { className: "vk_code" }, codeChildren)
					)
				);
			}
			const lines = state.content.split("\n");
			const gutter = lines.map((_, i) => String(i + 1)).join("\n");
			if (hl !== null) {
				return h("div", { className: "vk_editorBody" },
					bar,
					h("div", { className: "vk_viewer" },
						h("div", { className: "vk_gutter" }, gutter),
						h("div", { className: "vk_code vk_codeHl", dangerouslySetInnerHTML: { __html: hl } })
					)
				);
			}
			const tokens = tokenize(state.content, familyOf(file.path));
			const codeChildren = tokens.map((tok, i) => tok[0] === null ? escapeHtml(tok[1]) : h("span", { key: i, className: tok[0] }, escapeHtml(tok[1])));
			return h("div", { className: "vk_editorBody" },
				bar,
				h("div", { className: "vk_viewer" },
					h("div", { className: "vk_gutter" }, gutter),
					h("pre", { className: "vk_code" }, codeChildren)
				)
			);
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：编辑区（多标签 + 查看器）
		// ──────────────────────────────────────────────────────────────
		function EditorArea({ tabs, activePath, onSelect, onClose, onMoveTab, trajectory }) {
			const hasTabs = tabs.length > 0;
			const active = hasTabs ? (tabs.find((t) => t.path === activePath) ?? tabs[tabs.length - 1]) : null;
			const currentPath = active !== null ? active.path : null;
			const [edits, setEdits] = react.useState({});
			const [revisions, setRevisions] = react.useState({});
			const [busy, setBusy] = react.useState(false);
			const [saveMsg, setSaveMsg] = react.useState(null);
			const [dragged, setDragged] = react.useState(null);
			const [ctxMenu, setCtxMenu] = react.useState(null);
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
				if (typeof document === "undefined" || currentPath === null) return;
				const el = document.querySelector(`[data-vk-path="${CSS.escape(currentPath)}"]`);
				el?.scrollIntoView({ inline: "nearest", block: "nearest" });
			}, [currentPath]);
			const editing = currentPath !== null && edits[currentPath] !== void 0;
			const dirty = editing && edits[currentPath].dirty === true;
			const save = react.useCallback(async () => {
				const edit = edits[currentPath];
				if (edit === void 0 || busy) return;
				setBusy(true);
				setSaveMsg("保存中…");
				try {
					const r = await fetch("/vscode-files/write?path=" + encodeURIComponent(currentPath), {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ path: currentPath, content: edit.text })
					});
					const d = await r.json();
					if (d && d.ok) {
						setEdits((prev) => {
							const next = { ...prev };
							delete next[currentPath];
							return next;
						});
						setRevisions((prev) => ({ ...prev, [currentPath]: (prev[currentPath] ?? 0) + 1 }));
						setSaveMsg("已保存");
						setTimeout(() => setSaveMsg(null), 2000);
					} else {
						setSaveMsg("保存失败：" + ((d && d.error) || "unknown"));
					}
				} catch (e) {
					setSaveMsg("保存失败：" + String(e));
				} finally {
					setBusy(false);
				}
			}, [currentPath, edits, busy]);
			const cancel = react.useCallback(() => {
				const edit = edits[currentPath];
				if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("放弃未保存的修改？")) return;
				setEdits((prev) => {
					const next = { ...prev };
					delete next[currentPath];
					return next;
				});
				setSaveMsg(null);
			}, [currentPath, edits]);
			const startEdit = react.useCallback((content) => {
				setEdits((prev) => ({ ...prev, [currentPath]: { text: content, dirty: false } }));
				setSaveMsg(null);
			}, [currentPath]);
			const onEditText = react.useCallback((text) => {
				setEdits((prev) => ({ ...prev, [currentPath]: { text, dirty: true } }));
			}, [currentPath]);
			const closeTab = react.useCallback((path) => {
				const edit = edits[path];
				if (edit !== void 0 && edit.dirty && typeof confirm === "function" && !confirm("该标签有未保存的修改，关闭将丢失。确定关闭？")) return;
				onClose(path);
				setEdits((prev) => {
					if (!(path in prev)) return prev;
					const next = { ...prev };
					delete next[path];
					return next;
				});
			}, [edits, onClose]);
			const closePaths = react.useCallback((paths) => {
				if (paths.length === 0) return;
				const dirtyAny = paths.some((p) => edits[p]?.dirty === true);
				if (dirtyAny && typeof confirm === "function" && !confirm("有未保存的标签，关闭将丢失修改。确定关闭？")) return;
				for (const p of paths) onClose(p);
				setEdits((prev) => {
					const next = { ...prev };
					for (const p of paths) delete next[p];
					return next;
				});
			}, [edits, onClose]);
			const menuItem = (label, action, danger) => h("button", {
				className: "vk_menuItem" + (danger ? " vk_menuItemDanger" : ""),
				onClick: () => { setCtxMenu(null); action(); }
			}, label);
			if (!hasTabs) {
				return h("div", { className: "vk_editor" }, h("div", { className: "vk_empty" }, "从左侧文件树打开一个文件\n（点击文件名即可在标签页中查看）"));
			}
			const editBar = editing
				? h("div", { className: "vk_editBar" },
					h("button", { className: "vk_editBtn vk_editBtnPrimary", disabled: busy, title: "保存 (Ctrl+S)", onClick: save }, "💾 保存"),
					h("button", { className: "vk_editBtn", disabled: busy, title: "取消编辑 (Esc)", onClick: cancel }, "✕ 取消"),
					dirty ? h("span", { className: "vk_dirtyDot", title: "有未保存的修改" }) : null,
					saveMsg !== null ? h("span", { className: "vk_saveMsg" }, saveMsg) : null,
					h("div", { style: { flex: 1 } }),
					h("span", { className: "vk_saveMsg" }, "编辑模式")
				)
				: null;
			return h("div", { className: "vk_editor" },
				h("div", {
					className: "vk_tabStrip",
					onWheel: (e) => {
						if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
					},
					onContextMenu: (e) => {
						if (e.target instanceof Element && e.target.closest(".vk_fileTab")) return;
						e.preventDefault();
						setCtxMenu({ x: e.clientX, y: e.clientY, path: null });
					}
				}, tabs.map((t) => {
					const ic = iconOf(t.name, false, false);
					const isDirty = edits[t.path]?.dirty === true;
					return h("div", {
						key: t.path,
						"data-vk-path": t.path,
						className: "vk_fileTab" + (t.path === active.path ? " vk_fileTabActive" : "") + (isDirty ? " vk_fileTabDirty" : ""),
						title: t.path,
						draggable: true,
						onDragStart: (e) => {
							setDragged(t.path);
							e.dataTransfer.effectAllowed = "move";
							try { e.dataTransfer.setData("text/plain", t.path); } catch {}
						},
						onDragOver: (e) => {
							e.preventDefault();
							if (dragged !== null && dragged !== t.path) onMoveTab(dragged, t.path);
						},
						onDragEnd: () => setDragged(null),
						onDrop: (e) => e.preventDefault(),
						onClick: () => onSelect(t.path),
						onContextMenu: (e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, path: t.path }); }
					},
						h("span", { className: "vk_icon " + ic.c }, ic.g),
						h("span", { className: "vk_tabName" }, t.name),
						isDirty ? h("span", { className: "vk_dirtyDot vk_tabDot", title: "未保存" }) : null,
						h("button", {
							className: "vk_tabClose",
							title: "关闭",
							onClick: (e) => { e.stopPropagation(); closeTab(t.path); }
						}, "×")
					);
				})),
				editing
					? h(react.Fragment, null,
						editBar,
						h("textarea", {
							className: "vk_editorInput",
							value: edits[currentPath].text,
							spellCheck: false,
							autoFocus: true,
							onChange: (e) => onEditText(e.target.value),
							onKeyDown: (e) => {
								if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
									e.preventDefault();
									save();
								}
								if (e.key === "Escape") cancel();
							}
						})
					)
					: (active !== null && active.path === TRAJECTORY_TAB_PATH)
						? h("div", { className: "vk_editorBody vk_trajBody" }, trajectory ?? h("div", { className: "vk_notice" }, "轨迹视图不可用"))
						: h(Viewer, { file: active, rev: revisions[active.path] ?? 0, onStartEdit: startEdit }),
				ctxMenu !== null ? h("div", {
					className: "vk_menu",
					"data-vk-menu": true,
					style: { left: Math.min(ctxMenu.x, window.innerWidth - 180) + "px", top: Math.min(ctxMenu.y, window.innerHeight - 200) + "px" }
				},
					ctxMenu.path !== null ? menuItem("关闭", () => closeTab(ctxMenu.path)) : null,
					ctxMenu.path !== null ? menuItem("关闭其他", () => closePaths(tabs.map((t) => t.path).filter((p) => p !== ctxMenu.path))) : null,
					ctxMenu.path !== null ? menuItem("关闭左侧", () => {
						const i = tabs.findIndex((t) => t.path === ctxMenu.path);
						closePaths(tabs.slice(0, i).map((t) => t.path));
					}) : null,
					ctxMenu.path !== null ? menuItem("关闭右侧", () => {
						const i = tabs.findIndex((t) => t.path === ctxMenu.path);
						closePaths(tabs.slice(i + 1).map((t) => t.path));
					}) : null,
					menuItem("关闭全部", () => closePaths(tabs.map((t) => t.path)), true)
				) : null
			);
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：全局人设设置分区（settings.section，类似 CC 的全局 CLAUDE.md）
		// ──────────────────────────────────────────────────────────────
		function PersonaSection() {
			const [content, setContent] = react.useState(null); // null = 加载中
			const [saving, setSaving] = react.useState(false);
			const [msg, setMsg] = react.useState(null); // {ok, text}
			react.useEffect(() => {
				let dead = false;
				fetch("/vscode-files/persona")
					.then((r) => r.json())
					.then((d) => { if (!dead) setContent(d && d.ok ? (d.content || "") : ""); })
					.catch(() => { if (!dead) setContent(""); });
				return () => { dead = true; };
			}, []);
			const save = () => {
				setSaving(true);
				setMsg(null);
				fetch("/vscode-files/persona", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) })
					.then((r) => r.json())
					.then((d) => { setSaving(false); setMsg(d && d.ok ? { ok: true, text: "已保存 ✓ 新消息立即生效" } : { ok: false, text: (d && d.error) || "保存失败" }); })
					.catch((e) => { setSaving(false); setMsg({ ok: false, text: String(e) }); });
			};
			return h("div", { className: "vk_personaSection" },
				h("div", { className: "vk_personaDesc" }, "类似 Claude Code 的全局 CLAUDE.md：内容会注入到所有会话的系统提示中，新消息立即生效（无需重启）。支持 Markdown。"),
				content === null
					? h("div", { className: "vk_personaDesc" }, "加载中…")
					: h("textarea", { className: "vk_personaArea", value: content, onChange: (e) => setContent(e.target.value), placeholder: "例如：\n- 你叫小鲸，说话简洁直接\n- 一律用简体中文回答\n- …" }),
				h("div", { className: "vk_personaFoot" },
					msg !== null ? h("div", { className: "vk_personaMsg" + (msg.ok ? " vk_personaMsgOk" : " vk_personaMsgErr") }, msg.text) : null,
					h("div", { style: { flex: 1 } }),
					h("button", { className: "vk_personaSave", disabled: saving || content === null, onClick: save }, saving ? "保存中…" : "保存")
				)
			);
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：左栏（文件/会话 双 Tab）与 右栏（对话/详情 双 Tab）
		// ──────────────────────────────────────────────────────────────
		function LeftPanel({ tab, onTab, tree, sessionSlot, collapsed, onExpand, onCollapse }) {
			if (collapsed) {
				return h("div", { className: "vk_colLeft vk_rail" },
					h("button", { className: "vk_railBtn" + (tab === "files" ? " vk_railBtnActive" : ""), title: "文件", onClick: () => { onTab("files"); onExpand(); } }, "📁"),
					h("button", { className: "vk_railBtn" + (tab === "sessions" ? " vk_railBtnActive" : ""), title: "会话", onClick: () => { onTab("sessions"); onExpand(); } }, "☰"),
					h("div", { className: "vk_railSpacer" }),
					h("button", { className: "vk_railBtn", title: "展开侧边栏", onClick: onExpand }, "»"),
					h("div", { style: { display: "none" } }, sessionSlot)
				);
			}
			return h("div", { className: "vk_colLeft" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "files" ? " vk_tabBtnActive" : ""), onClick: () => onTab("files") }, "文件"),
					h("button", { className: "vk_tabBtn" + (tab === "sessions" ? " vk_tabBtnActive" : ""), onClick: () => onTab("sessions") }, "会话"),
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn", title: "收起侧边栏", onClick: onCollapse }, "«")
				),
				h("div", { className: "vk_tabBody" + (tab === "files" ? "" : " vk_tabBodyHidden") }, tree),
				h("div", { className: "vk_tabBody" + (tab === "sessions" ? "" : " vk_tabBodyHidden") }, sessionSlot)
			);
		}
		function RightPanel({ tab, onTab, conversation, details, mode, onToggleMode, showDetails }) {
			return h("div", { className: "vk_colRight" },
				h("div", { className: "vk_tabBar" },
					h("button", { className: "vk_tabBtn" + (tab === "conversation" ? " vk_tabBtnActive" : ""), onClick: () => onTab("conversation") }, "对话"),
					showDetails ? h("button", { className: "vk_tabBtn" + (tab === "details" ? " vk_tabBtnActive" : ""), onClick: () => onTab("details") }, "详情") : null,
					h("div", { className: "vk_tabBarSpacer" }),
					h("button", { className: "vk_tabBtn vk_modeBtn", title: mode === "native" ? "切回分栏模式（文件查看器 + 侧栏对话）" : "切换为全屏对话模式（隐藏文件查看器）", onClick: onToggleMode }, mode === "native" ? "◫ 分栏视图" : "⛶ 全屏对话")
				),
				h("div", { className: "vk_tabBody" + (tab === "conversation" ? "" : " vk_tabBodyHidden") }, conversation),
				showDetails ? h("div", { className: "vk_tabBody" + (tab === "details" ? "" : " vk_tabBodyHidden") }, details) : null
			);
		}

		// ──────────────────────────────────────────────────────────────
		// 组件：拖拽手柄（沿用官方实现）
		// ──────────────────────────────────────────────────────────────
		function DragHandle(props) {
			const [dragging, setDragging] = react.useState(false);
			const origin = react.useRef(0);
			const latest = react.useRef(0);
			const frame = react.useRef(null);
			const callbacks = react.useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd });
			callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd };
			const onPointerDown = react.useCallback((e) => {
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				origin.current = e.clientX;
				latest.current = e.clientX;
				callbacks.current.onStart();
				setDragging(true);
			}, []);
			const onPointerMove = react.useCallback((e) => {
				if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
				latest.current = e.clientX;
				frame.current ??= requestAnimationFrame(() => {
					frame.current = null;
					callbacks.current.onDrag(latest.current - origin.current);
				});
			}, []);
			const onPointerUp = react.useCallback((e) => {
				if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
				e.currentTarget.releasePointerCapture(e.pointerId);
				if (frame.current !== null) {
					cancelAnimationFrame(frame.current);
					frame.current = null;
				}
				callbacks.current.onDrag(latest.current - origin.current);
				setDragging(false);
				callbacks.current.onEnd();
			}, []);
			return h("div", {
				className: "vk_handle",
				style: { left: props.left },
				"data-side": props.side,
				"data-dragging": dragging || void 0,
				onPointerDown,
				onPointerMove,
				onPointerUp
			});
		}

		// ──────────────────────────────────────────────────────────────
		// 三栏骨架 AppFrame（注册进内置 'root' 槽）
		// ──────────────────────────────────────────────────────────────
		function AppFrame({ useStore, useSessions, actions, renderSlot, pickFolder }) {
			const panels = useStore((s) => s);
			const sessionCwd = useSessions((s) => {
				const current = s.current;
				if (current === void 0) return void 0;
				const row = s.byId[current];
				return row !== void 0 && row.blank !== true ? row.cwd : void 0;
			});
			const frameRef = react.useRef(null);
			const [viewport, setViewport] = react.useState(() => window.innerWidth);
			const lastCwd = react.useRef(sessionCwd);
			react.useEffect(() => {
				if (lastCwd.current !== void 0 && lastCwd.current !== sessionCwd) actions.setRightTab("conversation");
				lastCwd.current = sessionCwd;
			}, [actions, sessionCwd]);
			react.useEffect(() => {
				const el = frameRef.current;
				if (el === null) return;
				let raf = null;
				const observer = new ResizeObserver(() => {
					raf ??= requestAnimationFrame(() => {
						raf = null;
						const width = el.getBoundingClientRect().width;
						if (width > 0) setViewport(width);
					});
				});
				observer.observe(el);
				return () => {
					observer.disconnect();
					if (raf !== null) cancelAnimationFrame(raf);
				};
			}, []);
			const [tabsState, setTabsState] = react.useState(loadTabs);
			react.useEffect(() => { saveTabs(tabsState); }, [tabsState]);
			const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
			react.useEffect(() => { actions.setNarrow(narrow); }, [actions, narrow]);
			const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0;
			const cols = computeColumns(viewport, sidebarCollapsed ? 0 : panels.sidebar === 0 ? 280 : panels.sidebar, panels.right === 0 ? 440 : panels.right);
			const colsRef = react.useRef(cols);
			colsRef.current = cols;
			const sidebarBase = react.useRef(0);
			const rightBase = react.useRef(0);
			const [dragging, setDragging] = react.useState(false);
			const onDragEnd = react.useCallback(() => setDragging(false), []);
			const onSidebarStart = react.useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true); }, []);
			const onRightStart = react.useCallback(() => { rightBase.current = colsRef.current.right; setDragging(true); }, []);
			const onSidebarDrag = react.useCallback((dx) => { actions.setSidebar(sidebarBase.current + dx); }, [actions]);
			const onRightDrag = react.useCallback((dx) => { actions.setRight(rightBase.current - dx); }, [actions]);
			const openFile = react.useCallback((f) => {
				setTabsState((prev) => {
					const exists = prev.tabs.some((t) => t.path === f.path);
					const tabs = exists ? prev.tabs : [...prev.tabs.slice(-19), { path: f.path, name: f.name }];
					return { ...prev, tabs, active: f.path, mode: "ide" };
				});
			}, []);
			const onDeleted = react.useCallback((path) => {
				setTabsState((prev) => {
					const tabs = prev.tabs.filter((t) => t.path !== path);
					const active = prev.active === path ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null) : prev.active;
					return { ...prev, tabs, active, mode: tabs.length === 0 ? "native" : prev.mode };
				});
			}, []);
			const onRenamed = react.useCallback((oldPath, newPath, newName) => {
				setTabsState((prev) => {
					const tabs = prev.tabs.map((t) => (t.path === oldPath ? { path: newPath, name: newName } : t));
					const active = prev.active === oldPath ? newPath : prev.active;
					return { ...prev, tabs, active };
				});
			}, []);
			const closeFile = react.useCallback((path) => {
				setTabsState((prev) => {
					const tabs = prev.tabs.filter((t) => t.path !== path);
					const active = prev.active === path ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null) : prev.active;
					// 关闭最后一个标签后自动转回全屏对话模式
					return { ...prev, tabs, active, mode: tabs.length === 0 ? "native" : prev.mode };
				});
			}, []);
			const selectTab = react.useCallback((path) => {
				setTabsState((prev) => (prev.active === path ? prev : { ...prev, active: path }));
			}, []);
			const setSidebarTab = react.useCallback((tab) => {
				setTabsState((prev) => (prev.sidebarTab === tab ? prev : { ...prev, sidebarTab: tab }));
			}, []);
			const openFolder = react.useCallback((p) => {
				setTabsState((prev) => ({ ...prev, root: p }));
			}, []);
			const closeFolder = react.useCallback(() => {
				setTabsState((prev) => ({ ...prev, root: null }));
			}, []);
			const toggleMode = react.useCallback(() => {
				setTabsState((prev) => {
					const goingNative = prev.mode !== "native";
					if (!goingNative) return { ...prev, mode: "ide" };
					// 切全屏时收起工具详情标签（全屏下详情回右侧详情 Tab）
					const tabs = prev.tabs.filter((t) => t.path !== TRAJECTORY_TAB_PATH);
					const active = prev.active === TRAJECTORY_TAB_PATH ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null) : prev.active;
					return { ...prev, mode: "native", tabs, active };
				});
			}, []);
			const moveTab = react.useCallback((fromPath, toPath) => {
				setTabsState((prev) => {
					const tabs = [...prev.tabs];
					const from = tabs.findIndex((t) => t.path === fromPath);
					const to = tabs.findIndex((t) => t.path === toPath);
					if (from === -1 || to === -1 || from === to) return prev;
					const [moved] = tabs.splice(from, 1);
					tabs.splice(to, 0, moved);
					return { ...prev, tabs };
				});
			}, []);
			const native = tabsState.mode === "native";
			const detailsSeq = panels.detailsSeq ?? 0;
			const lastDetailsSeq = react.useRef(0);
			react.useEffect(() => {
				if (detailsSeq === 0 || detailsSeq === lastDetailsSeq.current) return;
				lastDetailsSeq.current = detailsSeq;
				if (native) {
					actions.setRightTab("details");
					return;
				}
				// 分栏模式：轨迹在中心区开标签
				setTabsState((prev) => {
					const exists = prev.tabs.some((t) => t.path === TRAJECTORY_TAB_PATH);
					const tabs = exists ? prev.tabs : [...prev.tabs, { path: TRAJECTORY_TAB_PATH, name: "工具详情" }];
					return { ...prev, tabs, active: TRAJECTORY_TAB_PATH };
				});
			}, [detailsSeq, native, actions]);
			react.useEffect(() => {
				if (!native && panels.rightTab === "details") actions.setRightTab("conversation");
			}, [native, panels.rightTab, actions]);
			const fileRoot = tabsState.root != null ? tabsState.root : sessionCwd;
			const left = h(LeftPanel, {
				tab: tabsState.sidebarTab,
				onTab: setSidebarTab,
				collapsed: sidebarCollapsed,
				onExpand: () => actions.toggleSidebar(),
				onCollapse: () => actions.toggleSidebar(),
				tree: h(FileTree, { root: fileRoot, custom: tabsState.root != null, onOpenFolder: openFolder, onCloseFolder: closeFolder, onOpenFile: openFile, onPickNative: pickFolder, activePath: tabsState.active, onDeleted, onRenamed }),
				sessionSlot: renderSlot("sidebar", { collapsed: sidebarCollapsed, width: cols.sidebar })
			});
			const detailsSlot = renderSlot("details", {});
			const center = h(EditorArea, { tabs: tabsState.tabs, activePath: tabsState.active, onSelect: selectTab, onClose: closeFile, onMoveTab: moveTab, trajectory: native ? null : detailsSlot });
			const right = h(RightPanel, {
				tab: panels.rightTab,
				onTab: (t) => actions.setRightTab(t),
				mode: tabsState.mode,
				onToggleMode: toggleMode,
				showDetails: native,
				conversation: renderSlot("conversation", {}),
				details: detailsSlot
			});
			const gridCols = native
				? `${cols.sidebar}px 0px minmax(0, 1fr)`
				: `${cols.sidebar}px minmax(0, 1fr) ${cols.right}px`;
			return h("div", {
				ref: frameRef,
				className: "vk_frame",
				style: { gridTemplateColumns: gridCols },
				"data-native": native || void 0,
				"data-sidebar-collapsed": sidebarCollapsed || void 0,
				"data-dragging": dragging || void 0,
				children: [
					left,
					center,
					right,
					h("div", { className: "vk_overlayLayer", "data-shell-overlay": true }, renderSlot("shell.overlay", {})),
					!sidebarCollapsed ? h(DragHandle, { side: "sidebar", left: cols.sidebar, onStart: onSidebarStart, onDrag: onSidebarDrag, onEnd: onDragEnd }) : null,
					!native && cols.right > 0 ? h(DragHandle, { side: "right", left: viewport - cols.right, onStart: onRightStart, onDrag: onRightDrag, onEnd: onDragEnd }) : null
				]
			});
		}

		// ──────────────────────────────────────────────────────────────
		// 布局 store（框架 store：面板宽度 + 右栏 Tab）
		// ──────────────────────────────────────────────────────────────
		function createLayoutStore() {
			return _deepseek_ai_dsh_client_runtime_client.defineStore({
				init: () => ({
					sidebar: 280,
					right: 440,
					narrow: false,
					narrowExpanded: false,
					rightTab: "conversation",
					detailsSeq: 0
				}),
				actions: {
					setSidebar: (d, px) => { d.sidebar = clampWidth(px, 264, 420); },
					setRight: (d, px) => { d.right = clampWidth(px, 340, 640); },
					toggleSidebar: (d) => {
						if (d.narrow) d.narrowExpanded = !d.narrowExpanded;
						else d.sidebar = d.sidebar === 0 ? 280 : 0;
					},
					setNarrow: (d, narrow) => {
						if (d.narrow === narrow) return;
						d.narrow = narrow;
						d.narrowExpanded = false;
					},
					setRightTab: (d, tab) => { d.rightTab = tab === "details" ? "details" : "conversation"; },
					openDetails: (d) => { d.detailsSeq += 1; },
					closeDetails: (d) => { d.rightTab = "conversation"; }
				}
			});
		}

		// ──────────────────────────────────────────────────────────────
		// ctx.layout 服务面（与官方同名兼容：openDetails/closeDetails/toggleSidebar）
		// ──────────────────────────────────────────────────────────────
		var LayoutController = class {
			#panels;
			attachPanels(actions) { this.#panels = actions; }
			toggleSidebar() { this.#require().toggleSidebar(); }
			openDetails() { this.#require().openDetails(); }
			closeDetails() { this.#require().closeDetails(); }
			#require() {
				if (this.#panels === void 0) throw new Error("layout: panel actions not wired (root entry not mounted)");
				return this.#panels;
			}
		};

		// ──────────────────────────────────────────────────────────────
		// 主题呈现器（照搬官方）
		// ──────────────────────────────────────────────────────────────
		const DARK_ATTRIBUTE = "data-ds-dark-theme";
		var ThemePresenter = class {
			appliedTokens = [];
			themeColorMeta;
			constructor() {
				this.themeColorMeta = document.createElement("meta");
				this.themeColorMeta.name = "theme-color";
			}
			apply(snapshot) {
				const scheme = snapshot.active.colorScheme;
				document.documentElement.style.colorScheme = scheme;
				const body = document.body;
				if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
				else body.removeAttribute(DARK_ATTRIBUTE);
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				for (const [name, value] of Object.entries(snapshot.active.tokens)) {
					body.style.setProperty(name, value);
					this.appliedTokens.push(name);
				}
				this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
				if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
			}
			dispose() {
				document.documentElement.style.removeProperty("color-scheme");
				const body = document.body;
				body.removeAttribute(DARK_ATTRIBUTE);
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				this.themeColorMeta.remove();
			}
		};

		// ──────────────────────────────────────────────────────────────
		// 插件主体
		// ──────────────────────────────────────────────────────────────
		const inject = ["slots", "theme"];
		function apply(ctx) {
			const layout = new LayoutController();
			const pickFolder = async () => {
				const ws = ctx.get("workspaces");
				if (ws === void 0 || typeof ws.pickDirectory !== "function") throw new Error("native directory picker unavailable");
				return ws.pickDirectory();
			};
			ctx.effect(() => {
				const disposeService = ctx.reflect.provide("layout", layout);
				const disposeRegistration = ctx.slots.register({
					name: "root",
					children: {
						"sidebar": { kind: "single", scope: "root" },
						"conversation": { kind: "single", scope: "session-maybe" },
						"details": { kind: "single", scope: "session" },
						"shell.overlay": { kind: "list", scope: "root" }
					},
					store: createLayoutStore,
					inject: (actions) => {
						layout.attachPanels(actions);
						return { pickFolder };
					}
				}, AppFrame);
				return () => {
					disposeRegistration();
					disposeService();
				};
			}, "vscode-layout: service + root registration");
			// 注册「全局人设」设置分区（官方设置面板左侧导航 + 右侧内容）
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "persona",
				order: 1,
				label: () => "全局人设"
			}, PersonaSection)), "vscode-layout: settings persona section");
			ctx.effect(() => {
				const presenter = new ThemePresenter();
				presenter.apply(ctx.theme.getTheme());
				const off = ctx.on("theme/change", (snapshot) => {
					presenter.apply(snapshot);
				});
				return () => {
					off();
					presenter.dispose();
				};
			}, "vscode-layout: theme presenter");
		}

		exports.LayoutController = LayoutController;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
