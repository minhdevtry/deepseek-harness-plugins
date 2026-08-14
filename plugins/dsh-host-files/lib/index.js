import { execFile } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

/** 插件名（loader 条目用）。 */
const name = "dsh-host-files";
/** 依赖服务。 */
const inject = ["webServer"];
/** 单文件读取上限（超出则截断并标记）。 */
const MAX_READ_BYTES = 2 * 1024 * 1024;
/** 单文件写入上限。 */
const MAX_WRITE_BYTES = 10 * 1024 * 1024;
/** 服务端高亮处理上限。 */
const MAX_HIGHLIGHT_BYTES = 1024 * 1024;
/** 搜索递归深度/条目/结果上限。 */
const SEARCH_DEPTH_LIMIT = 8;
const SEARCH_ENTRY_LIMIT = 20000;
const SEARCH_RESULT_LIMIT = 200;
/** 默认折叠的目录名。 */
const COLLAPSED_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", ".next", ".dsh"]);
/** 全局人设文件（~/.dsh/global-persona.md，注入所有会话的 systemPrompt）。 */
const PERSONA_FILE = join(homedir(), ".dsh", "global-persona.md");
const MAX_PERSONA_BYTES = 128 * 1024;
/** 全局人设的 prompt 段名与排序（紧随官方 persona order 0 之后）。 */
const PERSONA_SECTION = "user:global-persona";
const PERSONA_ORDER = 1;

function sendJson(res, code, value) {
	const body = JSON.stringify(value);
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}

function isHiddenName(name) {
	return name.startsWith(".") || COLLAPSED_DIRS.has(name);
}

/** 判断内容是否像二进制（NUL 字节比例过高）。 */
function looksBinary(text) {
	const n = text.length;
	if (n === 0) return false;
	let nul = 0;
	for (let i = 0; i < Math.min(n, 8192); i++) if (text.charCodeAt(i) === 0) nul++;
	return nul / Math.min(n, 8192) > 0.01;
}

/** 读取 JSON 请求体（带大小上限）。 */
function readJsonBody(req, cap) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > cap) {
				reject(new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch {
				reject(new Error("invalid JSON body"));
			}
		});
		req.on("error", reject);
	});
}

/** 跑 git status --porcelain，返回 相对路径 → 状态码 映射。 */
function gitStatusOf(root) {
	return new Promise((resolve) => {
		execFile("git", ["-C", root, "status", "--porcelain=v1", "--untracked-files=normal"], {
			timeout: 8000,
			maxBuffer: 8 * 1024 * 1024,
			windowsHide: true
		}, (error, stdout) => {
			if (error) {
				resolve({ ok: false, notRepo: true, error: "not a git repository" });
				return;
			}
			const statuses = {};
			for (const line of stdout.split(/\r?\n/)) {
				if (line.length < 4) continue;
				const code = line.slice(0, 2).trim();
				let path = line.slice(3).trim();
				if (code === "R") {
					const arrow = path.indexOf(" -> ");
					if (arrow !== -1) path = path.slice(arrow + 4).trim();
				}
				if (path.length === 0) continue;
				if (!(path in statuses)) statuses[path] = code === "R" ? "R" : code;
			}
			resolve({ ok: true, statuses });
		});
	});
}

/** 递归搜索文件名（跳过隐藏目录，带深度/条目/结果上限）。 */
async function searchDir(root, q) {
	const needle = q.toLowerCase();
	const out = [];
	const budget = { used: 0 };
	async function walk(dir, depth) {
		if (depth > SEARCH_DEPTH_LIMIT || budget.used >= SEARCH_ENTRY_LIMIT || out.length >= SEARCH_RESULT_LIMIT) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (out.length >= SEARCH_RESULT_LIMIT || budget.used >= SEARCH_ENTRY_LIMIT) return;
			if (isHiddenName(entry.name)) continue;
			budget.used += 1;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await walk(full, depth + 1);
			else if (entry.name.toLowerCase().includes(needle)) {
				out.push({ name: entry.name, path: full, rel: full.slice(root.length + 1).replace(/\\/g, "/") });
			}
		}
	}
	await walk(root, 0);
	return out;
}

/** 送回收站删除（可恢复；目录递归）。 */
function recycleBinDelete(target, isDir) {
	return new Promise((resolvePromise, rejectPromise) => {
		if (process.platform === "win32") {
			const script = isDir
				? 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")'
				: 'Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($env:DSH_DELETE_PATH, "OnlyErrorDialogs", "SendToRecycleBin")';
			execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
				env: { ...process.env, DSH_DELETE_PATH: target },
				timeout: 60000,
				windowsHide: true
			}, (error) => {
				if (error) rejectPromise(new Error(`recycle-bin delete failed: ${error.message}`));
				else resolvePromise();
			});
		} else {
			execFile("gio", ["trash", target], (error) => {
				if (!error) return resolvePromise();
				rm(target, { recursive: true, force: true }).then(resolvePromise, rejectPromise);
			});
		}
	});
}

/** 名称合法性：单段、非空、不含路径分隔符。 */
function validSegment(s) {
	return typeof s === "string" && s.length > 0 && s.length <= 120 && !/[\\/]/.test(s) && s !== "." && s !== "..";
}

// ── 服务端 shiki 高亮（通用解析：先按插件自���依赖链，退回全局 dsh 安装）──
let shikiPromise = null;
function resolveShikiEntry() {
	try {
		return createRequire(import.meta.url).resolve("shiki");
	} catch {}
	// 退回：全局 npm 安装（Windows 默认 %APPDATA%\npm\node_modules）
	const globalRoot = process.env.APPDATA ? join(process.env.APPDATA, "npm", "node_modules") : null;
	if (globalRoot) {
		const dshBin = join(globalRoot, "@deepseek-ai", "dsh", "lib", "bin.js");
		if (existsSync(dshBin)) {
			try {
				return createRequire(dshBin).resolve("shiki");
			} catch {}
		}
	}
	throw new Error("无法定位 shiki：请确认全局安装了 @deepseek-ai/dsh");
}
function loadShiki() {
	if (shikiPromise === null) {
		shikiPromise = (async () => {
			const entry = resolveShikiEntry();
			return import(pathToFileURL(entry).href);
		})();
	}
	return shikiPromise;
}
const LANG_BY_EXT = {
	js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", mjs: "javascript", cjs: "javascript",
	html: "html", htm: "html", xml: "xml", svg: "xml", vue: "vue",
	css: "css", scss: "scss", less: "less", json: "json", jsonc: "jsonc",
	yml: "yaml", yaml: "yaml", md: "markdown", py: "python",
	sh: "shellscript", bash: "shellscript", zsh: "shellscript", go: "go", rs: "rust",
	java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", sql: "sql", toml: "toml", ini: "ini"
};
function shikiLangOf(path) {
	return LANG_BY_EXT[extname(path).slice(1).toLowerCase()] ?? "text";
}

/**
 * 浏览器端文件树/查看器的宿主接口。
 * GET  /vscode-files/list?path=<绝对路径> → { ok, path, dirs, files }
 * GET  /vscode-files/read?path=<绝对路径> → { ok, kind, content, size }
 * GET  /vscode-files/git?path=<仓库根>  → { ok, statuses } 或 { ok:false, notRepo:true }
 * GET  /vscode-files/search?path=<根>&q=<关键词> → { ok, results: [{name, path, rel}] }
 * GET  /vscode-files/highlight?path=<绝对路径>&theme=<dark|light> → { ok, html }（服务端 shiki，默认 github-dark）
 * POST /vscode-files/write?path=<绝对路径> body { path, content } → { ok, size }
 * POST /vscode-files/mkdir  body { path: 父目录, name } → { ok, path }
 * POST /vscode-files/mkfile body { path: 父目录, name } → { ok, path }
 * POST /vscode-files/rename body { path, newName } → { ok, path }
 * POST /vscode-files/delete body { path } → { ok }（送回收站，可恢复）
 * GET  /vscode-files/persona → { ok, content }（全局人设，~/.dsh/global-persona.md）
 * POST /vscode-files/persona body { content } → { ok }（保存全局人设）
 */
function apply(ctx) {
	// 全局人设：注入所有会话的 systemPrompt（text 为函数，每次组装时读文件，改后即时生效）
	ctx.inject(["systemPrompt"], (promptCtx) => {
		promptCtx.systemPrompt.section({
			name: PERSONA_SECTION,
			order: PERSONA_ORDER,
			text: () => {
				try {
					return readFileSync(PERSONA_FILE, "utf8").slice(0, MAX_PERSONA_BYTES);
				} catch {
					return "";
				}
			}
		});
	});
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/vscode-files",
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			// 全局人设（无 path 参数，需在 path 校验之前处理）
			if (url.pathname === "/vscode-files/persona") {
				if (req.method === "POST") {
					try {
						const body = await readJsonBody(req, MAX_PERSONA_BYTES + 4096);
						const content = body?.content;
						if (typeof content !== "string") return sendJson(res, 400, { ok: false, error: "body needs { content: string }" });
						if (Buffer.byteLength(content, "utf8") > MAX_PERSONA_BYTES) return sendJson(res, 400, { ok: false, error: "persona too large" });
						await writeFile(PERSONA_FILE, content, "utf8");
						return sendJson(res, 200, { ok: true });
					} catch (error) {
						return sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
					}
				}
				let content = "";
				try {
					content = await readFile(PERSONA_FILE, "utf8");
				} catch {}
				return sendJson(res, 200, { ok: true, content });
			}
			const rawTarget = url.searchParams.get("path");
			if (typeof rawTarget !== "string" || rawTarget.length === 0) {
				return sendJson(res, 400, { ok: false, error: "missing path" });
			}
			const target = resolve(rawTarget);
			try {
				if (url.pathname === "/vscode-files/list") {
					const entries = await readdir(target, { withFileTypes: true });
					const dirs = [];
					const files = [];
					for (const entry of entries) {
						const full = join(target, entry.name);
						const hidden = isHiddenName(entry.name);
						if (entry.isDirectory()) dirs.push({ name: entry.name, path: full, hidden });
						else if (entry.isFile()) {
							let size = 0;
							let mtimeMs = 0;
							try {
								const info = await stat(full);
								size = info.size;
								mtimeMs = info.mtimeMs;
							} catch {}
							files.push({ name: entry.name, path: full, size, mtimeMs, hidden });
						}
					}
					dirs.sort((a, b) => a.name.localeCompare(b.name));
					files.sort((a, b) => a.name.localeCompare(b.name));
					return sendJson(res, 200, { ok: true, path: target, root: target, dirs, files });
				}
				if (url.pathname === "/vscode-files/read") {
					const info = await stat(target);
					if (info.isDirectory()) return sendJson(res, 400, { ok: false, error: "path is a directory" });
					if (info.size > MAX_READ_BYTES) {
						const text = await readFile(target, "utf8");
						return sendJson(res, 200, { ok: true, kind: "too-large", content: text.slice(0, MAX_READ_BYTES), size: info.size });
					}
					const text = await readFile(target, "utf8");
					if (looksBinary(text)) return sendJson(res, 200, { ok: true, kind: "binary", content: "", size: info.size });
					return sendJson(res, 200, { ok: true, kind: "text", content: text, size: info.size });
				}
				if (url.pathname === "/vscode-files/git") {
					return sendJson(res, 200, await gitStatusOf(target));
				}
				if (url.pathname === "/vscode-files/search") {
					const q = url.searchParams.get("q");
					if (typeof q !== "string" || q.trim().length === 0) return sendJson(res, 400, { ok: false, error: "missing q" });
					return sendJson(res, 200, { ok: true, results: await searchDir(target, q.trim()) });
				}
				if (url.pathname === "/vscode-files/highlight") {
					const info = await stat(target);
					if (info.isDirectory()) return sendJson(res, 400, { ok: false, error: "path is a directory" });
					if (info.size > MAX_HIGHLIGHT_BYTES) return sendJson(res, 200, { ok: false, error: "too large to highlight" });
					const text = await readFile(target, "utf8");
					if (looksBinary(text)) return sendJson(res, 200, { ok: false, error: "binary" });
					try {
						const shiki = await loadShiki();
						const theme = url.searchParams.get("theme") === "light" ? "github-light" : "github-dark";
						const html = await shiki.codeToHtml(text, { lang: shikiLangOf(target), theme });
						return sendJson(res, 200, { ok: true, html });
					} catch (error) {
						return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
					}
				}
				if (req.method === "POST") {
					let body;
					try {
						body = await readJsonBody(req, 12 * 1024 * 1024);
					} catch (error) {
						return sendJson(res, 400, { ok: false, error: error.message });
					}
					if (url.pathname === "/vscode-files/write") {
						const writePath = body?.path;
						const content = body?.content;
						if (typeof writePath !== "string" || writePath.length === 0 || typeof content !== "string") {
							return sendJson(res, 400, { ok: false, error: "body needs { path: string, content: string }" });
						}
						if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
							return sendJson(res, 400, { ok: false, error: "content too large" });
						}
						const info = await stat(writePath).catch(() => void 0);
						if (info !== void 0 && info.isDirectory()) return sendJson(res, 400, { ok: false, error: "path is a directory" });
						await writeFile(writePath, content, "utf8");
						return sendJson(res, 200, { ok: true, size: Buffer.byteLength(content, "utf8") });
					}
					if (url.pathname === "/vscode-files/mkdir") {
						const parent = body?.path;
						if (typeof parent !== "string" || !validSegment(body?.name)) return sendJson(res, 400, { ok: false, error: "body needs { path: string, name: string }" });
						const full = join(parent, body.name);
						try {
							await mkdir(full);
						} catch (error) {
							return sendJson(res, 409, { ok: false, error: "已存在或无法创建：" + (error?.code ?? "unknown") });
						}
						return sendJson(res, 200, { ok: true, path: full });
					}
					if (url.pathname === "/vscode-files/mkfile") {
						const parent = body?.path;
						if (typeof parent !== "string" || !validSegment(body?.name)) return sendJson(res, 400, { ok: false, error: "body needs { path: string, name: string }" });
						const full = join(parent, body.name);
						try {
							await writeFile(full, "", { flag: "wx" });
						} catch (error) {
							return sendJson(res, 409, { ok: false, error: "已存在或无法创建：" + (error?.code ?? "unknown") });
						}
						return sendJson(res, 200, { ok: true, path: full });
					}
					if (url.pathname === "/vscode-files/rename") {
						const oldPath = body?.path;
						if (typeof oldPath !== "string" || !validSegment(body?.newName)) return sendJson(res, 400, { ok: false, error: "body needs { path: string, newName: string }" });
						const newPath = join(dirname(oldPath), body.newName);
						await rename(oldPath, newPath);
						return sendJson(res, 200, { ok: true, path: newPath });
					}
					if (url.pathname === "/vscode-files/delete") {
						const delPath = body?.path;
						if (typeof delPath !== "string" || delPath.length === 0) return sendJson(res, 400, { ok: false, error: "body needs { path: string }" });
						const info = await stat(delPath).catch(() => void 0);
						if (info === void 0) return sendJson(res, 404, { ok: false, error: "not found" });
						await recycleBinDelete(delPath, info.isDirectory());
						return sendJson(res, 200, { ok: true });
					}
				}
				return sendJson(res, 404, { ok: false, error: "unknown vscode-files endpoint" });
			} catch (error) {
				return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "dsh-host-files: /vscode-files routes");
}

export { name, inject, apply };
