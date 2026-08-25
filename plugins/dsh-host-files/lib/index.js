import { execFile } from "node:child_process";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { uploadImageToR2 } from "./r2Service.js";

/** Plugin name (for loader entry). */
const name = "dsh-host-files";
/** Injected services. */
const inject = ["webServer"];
/** Single file read size cap (truncated and flagged if exceeded). */
const MAX_READ_BYTES = 2 * 1024 * 1024;
/** Single file write size cap. */
const MAX_WRITE_BYTES = 10 * 1024 * 1024;
/** Server-side syntax highlighting cap. */
const MAX_HIGHLIGHT_BYTES = 1024 * 1024;
/** Search recursion depth / entry / results limits. */
const SEARCH_DEPTH_LIMIT = 8;
const SEARCH_ENTRY_LIMIT = 20000;
const SEARCH_RESULT_LIMIT = 200;
/** Default collapsed directory names. */
const COLLAPSED_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", ".next", ".dsh"]);
/** Global Persona file (~/.dsh/global-persona.md, injected into systemPrompt of all sessions). */
const PERSONA_FILE = join(homedir(), ".dsh", "global-persona.md");
const MAX_PERSONA_BYTES = 128 * 1024;
/** Global persona prompt section name and ordering. */
const PERSONA_SECTION = "user:global-persona";
const PERSONA_ORDER = 1;

/** Workspace Sandbox Root Directory */
const SANDBOX_ROOT = resolve(process.env.DSH_SANDBOX_ROOT || process.cwd());

/** Code-Server Authentication System */
const DSH_PASSWORD = process.env.DSH_PASSWORD || "";
const activeSessions = new Map();

/** Real-time Collaboration Engine (Yjs + WebSocket) */
const collabDocs = new Map();
const collabAwareness = new Map();
let collabWss = null;
let activeCollabPort = 3088;

function getYDoc(room) {
	let doc = collabDocs.get(room);
	if (!doc) {
		doc = new Y.Doc();
		collabDocs.set(room, doc);
	}
	return doc;
}

function getAwareness(room, doc) {
	let awareness = collabAwareness.get(room);
	if (!awareness) {
		awareness = new awarenessProtocol.Awareness(doc);
		collabAwareness.set(room, awareness);
	}
	return awareness;
}

function initCollabServer(startPort = 3088) {
	if (collabWss) return;
	try {
		const wss = new WebSocketServer({ port: startPort }, () => {
			activeCollabPort = startPort;
			collabWss = wss;
		});

		wss.on("connection", (conn, req) => {
			const rawPath = req.url ? req.url.split('?')[0].replace(/^\/+/, '') : '';
			const room = rawPath ? decodeURIComponent(rawPath) : 'default';
			const doc = getYDoc(room);
			const awareness = getAwareness(room, doc);

			const safeSend = (data) => {
				if (conn && conn.readyState === WebSocket.OPEN) {
					try { conn.send(data); } catch {}
				}
			};

			// 1. Send SyncStep1 to initiate document sync
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, 0); // messageSync = 0
			syncProtocol.writeSyncStep1(encoder, doc);
			safeSend(encoding.toUint8Array(encoder));

			// 2. Send current awareness states if any
			if (awareness.getStates().size > 0) {
				const awEncoder = encoding.createEncoder();
				encoding.writeVarUint(awEncoder, 1); // messageAwareness = 1
				encoding.writeVarUint8Array(awEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())));
				safeSend(encoding.toUint8Array(awEncoder));
			}

			conn.on("message", (message) => {
				try {
					const decoder = decoding.createDecoder(new Uint8Array(message));
					const messageType = decoding.readVarUint(decoder);
					if (messageType === 0) { // Sync
						const respEncoder = encoding.createEncoder();
						encoding.writeVarUint(respEncoder, 0);
						syncProtocol.readSyncMessage(decoder, respEncoder, doc, conn);
						if (encoding.length(respEncoder) > 1) {
							safeSend(encoding.toUint8Array(respEncoder));
						}
					} else if (messageType === 1) { // Awareness
						awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn);
					} else if (messageType === 3) { // Query Awareness
						const awEncoder = encoding.createEncoder();
						encoding.writeVarUint(awEncoder, 1);
						encoding.writeVarUint8Array(awEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())));
						safeSend(encoding.toUint8Array(awEncoder));
					}
				} catch (err) {
					console.error("Collab WS message error:", err);
				}
			});

			const updateHandler = (update, origin) => {
				if (origin !== conn) {
					const updEncoder = encoding.createEncoder();
					encoding.writeVarUint(updEncoder, 0);
					syncProtocol.writeUpdate(updEncoder, update);
					safeSend(encoding.toUint8Array(updEncoder));
				}
			};
			doc.on("update", updateHandler);

			const awarenessHandler = ({ added, updated, removed }, origin) => {
				if (origin !== conn) {
					const changed = added.concat(updated, removed);
					const awUpdateEncoder = encoding.createEncoder();
					encoding.writeVarUint(awUpdateEncoder, 1);
					encoding.writeVarUint8Array(awUpdateEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
					safeSend(encoding.toUint8Array(awUpdateEncoder));
				}
			};
			awareness.on("update", awarenessHandler);

			conn.on("close", () => {
				doc.off("update", updateHandler);
				awareness.off("update", awarenessHandler);
			});
		});

		wss.on("error", (err) => {
			if (collabWss === wss) collabWss = null;
			try { wss.close(); } catch {}
			if (err.code === "EADDRINUSE" && startPort < 3095) {
				initCollabServer(startPort + 1);
			}
		});
	} catch (err) {
		// ignore
	}
}

// Collab server disabled for single-user local workflow
// initCollabServer();

function isInsideSandbox(targetPath, root = SANDBOX_ROOT) {
	return true;
}

function verifyAuth(req, url) {
	if (!DSH_PASSWORD) {
		return { authenticated: true, requiresAuth: false, user: { name: "Lucas", color: "#3b82f6", avatar: "👨‍💻" } };
	}
	const authHeader = req.headers["authorization"];
	let token = null;
	if (authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.slice(7).trim();
	} else if (url.searchParams.has("token")) {
		token = url.searchParams.get("token");
	} else if (req.headers["cookie"]) {
		const match = req.headers["cookie"].match(/(?:^|;\s*)dsh_token=([^;]+)/);
		if (match) token = match[1];
	}
	if (token && activeSessions.has(token)) {
		return { authenticated: true, requiresAuth: true, token, user: activeSessions.get(token).user };
	}
	return { authenticated: false, requiresAuth: true };
}

function sendJson(res, code, value) {
	const body = JSON.stringify(value);
	res.writeHead(code, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"access-control-allow-origin": "*",
		"access-control-allow-headers": "authorization, content-type",
		"access-control-allow-methods": "GET, POST, OPTIONS"
	});
	res.end(body);
}

function isHiddenName(name) {
	return name.startsWith(".") || COLLAPSED_DIRS.has(name);
}

/** Check if content looks binary (high ratio of NUL bytes). */
function looksBinary(text) {
	const n = text.length;
	if (n === 0) return false;
	let nul = 0;
	for (let i = 0; i < Math.min(n, 8192); i++) if (text.charCodeAt(i) === 0) nul++;
	return nul / Math.min(n, 8192) > 0.01;
}

/** Read JSON request body with size cap. */
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

/** Run git status --porcelain, returns Relative Path -> Status Code map + staged & unstaged lists. */
function gitStatusOf(root) {
	return new Promise((resolve) => {
		execFile("git", ["-C", root, "status", "--porcelain=v1", "--branch", "--untracked-files=normal"], {
			timeout: 8000,
			maxBuffer: 8 * 1024 * 1024,
			windowsHide: true
		}, (error, stdout) => {
			if (error) {
				resolve({ ok: false, notRepo: true, error: "not a git repository" });
				return;
			}
			const statuses = {};
			const staged = [];
			const unstaged = [];
			let branch = "main";
			for (const line of stdout.split(/\r?\n/)) {
				// --branch prepends one "## <name>...<upstream>" header line.
				if (line.startsWith("## ")) {
					const head = line.slice(3).split("...")[0].trim();
					// A detached HEAD reports "HEAD (no branch)".
					branch = head.startsWith("HEAD ") ? "HEAD" : head;
					continue;
				}
				if (line.length < 4) continue;
				const x = line[0];
				const y = line[1];
				const code = line.slice(0, 2).trim();
				let path = line.slice(3).trim();
				if (code === "R" || x === "R" || y === "R") {
					const arrow = path.indexOf(" -> ");
					if (arrow !== -1) path = path.slice(arrow + 4).trim();
				}
				if (path.length === 0) continue;
				if (!(path in statuses)) statuses[path] = code === "R" ? "R" : code;

				if (x !== " " && x !== "?") {
					staged.push({ path, status: x });
				}
				if (y !== " " || x === "?") {
					unstaged.push({ path, status: x === "?" ? "U" : y });
				}
			}
			resolve({ ok: true, repo: true, statuses, branch, staged, unstaged });
		});
	});
}

/** Execute a git command inside a repo root. */
function gitExec(root, args) {
	return new Promise((resolve, reject) => {
		execFile("git", ["-C", root, ...args], {
			timeout: 15000,
			maxBuffer: 8 * 1024 * 1024,
			windowsHide: true
		}, (error, stdout, stderr) => {
			if (error) reject(new Error(stderr || error.message));
			else resolve(stdout);
		});
	});
}

/** Recursively search file names (skips hidden directories, with depth/entry caps). */
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
			const rel = full.slice(root.length + 1).replace(/\\/g, "/");
			if (entry.isDirectory()) await walk(full, depth + 1);
			else if (entry.name.toLowerCase().includes(needle) || rel.toLowerCase().includes(needle) || full.replace(/\\/g, "/").toLowerCase().includes(needle)) {
				out.push({ name: entry.name, path: full, rel });
			}
		}
	}
	await walk(root, 0);
	return out;
}

/** Recursively search file content with line numbers, code preview, match case and regex options. */
async function searchContent(root, q, caseSensitive = false, isRegex = false) {
	const out = [];
	const budget = { used: 0 };
	let regex = null;
	if (isRegex) {
		try {
			regex = new RegExp(q, caseSensitive ? "g" : "gi");
		} catch {
			regex = null;
		}
	}
	const needle = caseSensitive ? q : q.toLowerCase();

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
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full, depth + 1);
			} else if (entry.isFile()) {
				const ext = extname(entry.name).toLowerCase();
				if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".eot", ".exe", ".dll", ".so", ".dylib"].includes(ext)) continue;
				budget.used += 1;
				try {
					const info = await stat(full);
					if (info.size > 512 * 1024) continue;
					const content = await readFile(full, "utf8");
					if (looksBinary(content)) continue;
					const lines = content.split("\n");
					for (let i = 0; i < lines.length; i++) {
						if (out.length >= SEARCH_RESULT_LIMIT) break;
						const line = lines[i];
						let match = false;
						if (regex) {
							regex.lastIndex = 0;
							match = regex.test(line);
						} else {
							match = caseSensitive ? line.includes(needle) : line.toLowerCase().includes(needle);
						}
						if (match) {
							out.push({
								name: entry.name,
								path: full,
								rel: full.slice(root.length + 1).replace(/\\/g, "/"),
								line: i + 1,
								preview: line.trim().slice(0, 200)
							});
						}
					}
				} catch {}
			}
		}
	}
	await walk(root, 0);
	return out;
}

/** Move to recycle bin / trash (restorable; recursive for directories). */
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
		} else if (process.platform === "darwin") {
			const escaped = target.replace(/["\\]/g, "\\$&");
			execFile("osascript", ["-e", `tell application "Finder" to delete POSIX file "${escaped}"`], (error) => {
				if (!error) return resolvePromise();
				rm(target, { recursive: true, force: true }).then(resolvePromise, rejectPromise);
			});
		} else {
			execFile("gio", ["trash", target], (error) => {
				if (!error) return resolvePromise();
				rm(target, { recursive: true, force: true }).then(resolvePromise, rejectPromise);
			});
		}
	});
}

/** Segment validity: single segment, non-empty, no path separators. */
function validSegment(s) {
	return typeof s === "string" && s.length > 0 && s.length <= 120 && !/[\\/]/.test(s) && s !== "." && s !== "..";
}

// ── Server-side shiki highlighting (First check plugin dependencies, fallback to global dsh) ──
let shikiPromise = null;
function resolveShikiEntry() {
	try {
		return createRequire(import.meta.url).resolve("shiki");
	} catch {}
	// Fallback: Global npm install (Windows default %APPDATA%\npm\node_modules)
	const globalRoot = process.env.APPDATA ? join(process.env.APPDATA, "npm", "node_modules") : null;
	if (globalRoot) {
		const dshBin = join(globalRoot, "@deepseek-ai", "dsh", "lib", "bin.js");
		if (existsSync(dshBin)) {
			try {
				return createRequire(dshBin).resolve("shiki");
			} catch {}
		}
	}
	throw new Error("Unable to locate shiki: please ensure @deepseek-ai/dsh is installed globally");
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
 * Host interface for browser file tree / viewer.
 * GET  /vscode-files/auth/status → { ok, requiresAuth, authenticated, user }
 * POST /vscode-files/auth/login  body { password, name, color, avatar } → { ok, token, user }
 * POST /vscode-files/auth/logout → { ok }
 * GET  /vscode-files/sandbox-info → { ok, sandboxRoot, projectName }
 * GET  /vscode-files/sandbox-folders → { ok, folders: [{ name, path, rel }] }
 * GET  /vscode-files/collab-info → { ok, wsPort, wsUrl }
 * GET  /vscode-files/list?path=<absPath> → { ok, path, dirs, files }
 * GET  /vscode-files/read?path=<absPath> → { ok, kind, content, size }
 * GET  /vscode-files/git?path=<repoRoot>  → { ok, statuses } or { ok:false, notRepo:true }
 * GET  /vscode-files/search?path=<root>&q=<keyword> → { ok, results: [{name, path, rel}] }
 * GET  /vscode-files/highlight?path=<absPath>&theme=<dark|light> → { ok, html } (shiki syntax highlight)
 * POST /vscode-files/write?path=<absPath> body { path, content } → { ok, size }
 * POST /vscode-files/mkdir  body { path: parentDir, name } → { ok, path }
 * POST /vscode-files/mkfile body { path: parentDir, name } → { ok, path }
 * POST /vscode-files/rename body { path, newName } → { ok, path }
 * POST /vscode-files/delete body { path } → { ok } (move to trash)
 * GET  /vscode-files/persona → { ok, content } (global persona ~/.dsh/global-persona.md)
 * POST /vscode-files/persona body { content } → { ok } (save global persona)
 */
function apply(ctx) {
	// Global persona: injected into systemPrompt of all sessions
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
	ctx.on("dispose", () => {
		if (collabWss) {
			try { collabWss.close(); } catch {}
			collabWss = null;
		}
	});
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/vscode-files",
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");

			// Handle CORS preflight
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"access-control-allow-origin": "*",
					"access-control-allow-headers": "authorization, content-type",
					"access-control-allow-methods": "GET, POST, OPTIONS"
				});
				return res.end();
			}

			// ── Public / Auth Endpoints ──
			if (url.pathname === "/vscode-files/auth/status") {
				const auth = verifyAuth(req, url);
				return sendJson(res, 200, {
					ok: true,
					requiresAuth: auth.requiresAuth,
					authenticated: auth.authenticated,
					user: auth.user || null
				});
			}

			if (url.pathname === "/vscode-files/auth/login" && req.method === "POST") {
				try {
					const body = await readJsonBody(req, 4096);
					const inputPassword = body?.password || "";
					if (DSH_PASSWORD && inputPassword !== DSH_PASSWORD) {
						return sendJson(res, 401, { ok: false, error: "Invalid workspace password. Please try again." });
					}
					const token = crypto.randomBytes(24).toString("hex");
					const user = {
						name: body?.name || (body?.preset === "lona" ? "Lona" : "Lucas"),
						color: body?.color || (body?.preset === "lona" ? "#ec4899" : "#3b82f6"),
						avatar: body?.avatar || (body?.preset === "lona" ? "💖" : "👨‍💻")
					};
					activeSessions.set(token, { user, createdAt: Date.now() });
					res.setHeader("Set-Cookie", `dsh_token=${token}; Path=/; SameSite=Lax; Max-Age=2592000`);
					return sendJson(res, 200, { ok: true, token, user });
				} catch (err) {
					return sendJson(res, 400, { ok: false, error: err.message });
				}
			}

			if (url.pathname === "/vscode-files/auth/logout" && req.method === "POST") {
				const authHeader = req.headers["authorization"];
				let token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
				if (token) activeSessions.delete(token);
				res.setHeader("Set-Cookie", `dsh_token=; Path=/; Max-Age=0`);
				return sendJson(res, 200, { ok: true });
			}

			if (url.pathname === "/vscode-files/sandbox-info") {
				const queryRoot = url.searchParams.get("root") || url.searchParams.get("path");
				const activeRoot = queryRoot ? resolve(queryRoot) : SANDBOX_ROOT;
				return sendJson(res, 200, {
					ok: true,
					sandboxed: true,
					sandboxRoot: activeRoot,
					projectName: basename(activeRoot)
				});
			}

			if (url.pathname === "/vscode-files/collab-info") {
				const hostName = (req.headers.host || "localhost:3080").split(":")[0];
				return sendJson(res, 200, {
					ok: true,
					wsPort: activeCollabPort,
					wsUrl: `ws://${hostName}:${activeCollabPort}`
				});
			}

			// ── Auth Protection Middleware ──
			const auth = verifyAuth(req, url);
			if (auth.requiresAuth && !auth.authenticated) {
				return sendJson(res, 401, {
					ok: false,
					error: "Unauthorized: Password authentication required to access this workspace."
				});
			}

			// ── Sandbox Subdirectory Explorer for in-app folder picker ──
			if (url.pathname === "/vscode-files/sandbox-folders") {
				const folders = [{ name: basename(SANDBOX_ROOT) + " (Root)", path: SANDBOX_ROOT, rel: "." }];
				async function walkFolders(dir, depth) {
					if (depth > 3 || folders.length >= 50) return;
					let entries;
					try {
						entries = await readdir(dir, { withFileTypes: true });
					} catch { return; }
					for (const entry of entries) {
						if (!entry.isDirectory() || isHiddenName(entry.name)) continue;
						const full = join(dir, entry.name);
						folders.push({
							name: entry.name,
							path: full,
							rel: full.slice(SANDBOX_ROOT.length + 1).replace(/\\/g, "/")
						});
						await walkFolders(full, depth + 1);
					}
				}
				await walkFolders(SANDBOX_ROOT, 0);
				return sendJson(res, 200, { ok: true, sandboxRoot: SANDBOX_ROOT, folders });
			}

			// Global Persona (~/.dsh/global-persona.md)
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

			// ── Protected POST Operations ──
			if (req.method === "POST") {
				let body;
				try {
					body = await readJsonBody(req, 12 * 1024 * 1024);
				} catch (error) {
					return sendJson(res, 400, { ok: false, error: error.message });
				}
				if (url.pathname === "/vscode-files/write") {
					const writePath = body?.path || url.searchParams.get("path");
					const content = typeof body?.content === "string" ? body.content : (typeof body === "string" ? body : "");
					if (typeof writePath !== "string" || writePath.length === 0) {
						return sendJson(res, 400, { ok: false, error: "body needs { path: string, content: string } or ?path= query" });
					}
					if (!isInsideSandbox(writePath, SANDBOX_ROOT)) {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Path is outside the sandboxed workspace directory" });
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
					if (!isInsideSandbox(parent, SANDBOX_ROOT)) {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Path is outside the sandboxed workspace directory" });
					}
					const full = join(parent, body.name);
					try {
						await mkdir(full);
					} catch (error) {
						return sendJson(res, 409, { ok: false, error: "Already exists or cannot create directory: " + (error?.code ?? "unknown") });
					}
					return sendJson(res, 200, { ok: true, path: full });
				}
				if (url.pathname === "/vscode-files/mkfile") {
					const parent = body?.path;
					if (typeof parent !== "string" || !validSegment(body?.name)) return sendJson(res, 400, { ok: false, error: "body needs { path: string, name: string }" });
					if (!isInsideSandbox(parent, SANDBOX_ROOT)) {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Path is outside the sandboxed workspace directory" });
					}
					const full = join(parent, body.name);
					try {
						await writeFile(full, "", { flag: "wx" });
					} catch (error) {
						return sendJson(res, 409, { ok: false, error: "Already exists or cannot create file: " + (error?.code ?? "unknown") });
					}
					return sendJson(res, 200, { ok: true, path: full });
				}
				if (url.pathname === "/vscode-files/rename") {
					const oldPath = body?.path;
					if (typeof oldPath !== "string" || !validSegment(body?.newName)) return sendJson(res, 400, { ok: false, error: "body needs { path: string, newName: string }" });
					if (!isInsideSandbox(oldPath, SANDBOX_ROOT)) {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Path is outside the sandboxed workspace directory" });
					}
					const newPath = join(dirname(oldPath), body.newName);
					if (!isInsideSandbox(newPath, SANDBOX_ROOT)) {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Target path is outside the sandboxed workspace directory" });
					}
					await rename(oldPath, newPath);
					return sendJson(res, 200, { ok: true, path: newPath });
				}
				if (url.pathname === "/vscode-files/delete") {
					const delPath = body?.path;
					if (typeof delPath !== "string" || delPath.length === 0) return sendJson(res, 400, { ok: false, error: "body needs { path: string }" });
					if (resolve(delPath) === "/" || resolve(delPath) === "C:\\") {
						return sendJson(res, 403, { ok: false, error: "Access Denied: Cannot delete root filesystem directory" });
					}
					const info = await stat(delPath).catch(() => void 0);
					if (info === void 0) return sendJson(res, 404, { ok: false, error: "not found" });
					await recycleBinDelete(delPath, info.isDirectory());
					return sendJson(res, 200, { ok: true });
				}
				if (url.pathname === "/vscode-files/git/stage") {
					const root = body?.root || SANDBOX_ROOT;
					const file = body?.file;
					if (!file) return sendJson(res, 400, { ok: false, error: "missing file" });
					try {
						await gitExec(root, ["add", file]);
						return sendJson(res, 200, { ok: true });
					} catch (err) {
						return sendJson(res, 500, { ok: false, error: err.message });
					}
				}
				if (url.pathname === "/vscode-files/git/unstage") {
					const root = body?.root || SANDBOX_ROOT;
					const file = body?.file;
					if (!file) return sendJson(res, 400, { ok: false, error: "missing file" });
					try {
						await gitExec(root, ["restore", "--staged", file]);
						return sendJson(res, 200, { ok: true });
					} catch (err) {
						return sendJson(res, 500, { ok: false, error: err.message });
					}
				}
				if (url.pathname === "/vscode-files/git/discard") {
					const root = body?.root || SANDBOX_ROOT;
					const file = body?.file;
					if (!file) return sendJson(res, 400, { ok: false, error: "missing file" });
					try {
						await gitExec(root, ["restore", file]);
					} catch {
						try {
							await gitExec(root, ["clean", "-fd", file]);
						} catch (err) {
							return sendJson(res, 500, { ok: false, error: err.message });
						}
					}
					return sendJson(res, 200, { ok: true });
				}
				if (url.pathname === "/vscode-files/git/commit") {
					const root = body?.root || SANDBOX_ROOT;
					const message = body?.message;
					if (!message || typeof message !== "string" || message.trim().length === 0) {
						return sendJson(res, 400, { ok: false, error: "missing message" });
					}
					try {
						await gitExec(root, ["commit", "-m", message.trim()]);
						return sendJson(res, 200, { ok: true });
					} catch (err) {
						return sendJson(res, 500, { ok: false, error: err.message });
					}
				}
				if (url.pathname === "/vscode-files/upload-image") {
					const root = body?.root ? resolve(body.root) : SANDBOX_ROOT;
					const storage = body?.storage || "local";
					const base64Data = body?.data;
					const mimeType = body?.mimeType || "image/png";
					const altText = body?.altText || "image";

					if (!base64Data) {
						return sendJson(res, 400, { ok: false, error: "missing image data" });
					}

					const raw = typeof base64Data === "string" ? base64Data.replace(/^data:image\/\w+;base64,/, "") : "";
					const buffer = Buffer.from(raw, "base64");

					if (storage === "r2") {
						try {
							const r2Config = body?.r2Config || {};
							const publicUrl = await uploadImageToR2(r2Config, buffer, mimeType, altText);
							return sendJson(res, 200, { ok: true, url: publicUrl });
						} catch (err) {
							return sendJson(res, 500, { ok: false, error: err.message });
						}
					} else {
						// Local storage with MD5 deduplication
						try {
							const imagesDir = join(root, "images");
							await mkdir(imagesDir, { recursive: true });
							const extMap = {
								"image/png": ".png",
								"image/jpeg": ".jpg",
								"image/jpg": ".jpg",
								"image/gif": ".gif",
								"image/webp": ".webp",
								"image/svg+xml": ".svg",
							};
							const ext = extMap[mimeType] || ".png";
							const md5Hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 10);
							const filename = `${md5Hash}${ext}`;
							const absPath = join(imagesDir, filename);
							await writeFile(absPath, buffer);
							const relPath = "./images/" + filename;
							return sendJson(res, 200, { ok: true, url: `/vscode-files/raw?path=${encodeURIComponent(absPath)}`, relPath });
						} catch (err) {
							return sendJson(res, 500, { ok: false, error: err.message });
						}
					}
				}
			}

			// ── Protected GET Operations ──
			let rawTarget = url.searchParams.get("path");
			if (!rawTarget || rawTarget === "." || rawTarget === "./") {
				rawTarget = SANDBOX_ROOT;
			} else if (rawTarget === "~") {
				rawTarget = homedir();
			} else if (rawTarget.startsWith("~/")) {
				rawTarget = join(homedir(), rawTarget.slice(2));
			}
			const target = resolve(rawTarget);

			if (!isInsideSandbox(target, SANDBOX_ROOT)) {
				return sendJson(res, 403, { ok: false, error: "Access Denied: Path is outside the sandboxed workspace directory (" + SANDBOX_ROOT + ")" });
			}

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
					return sendJson(res, 200, { ok: true, path: target, root: target, sandboxRoot: SANDBOX_ROOT, dirs, files });
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
				if (url.pathname === "/vscode-files/raw") {
					const info = await stat(target);
					if (info.isDirectory()) return sendJson(res, 400, { ok: false, error: "path is a directory" });
					const ext = extname(target).slice(1).toLowerCase();
					const mimeMap = {
						png: "image/png",
						jpg: "image/jpeg",
						jpeg: "image/jpeg",
						gif: "image/gif",
						webp: "image/webp",
						svg: "image/svg+xml",
						ico: "image/x-icon",
						bmp: "image/bmp",
						mp4: "video/mp4",
						webm: "video/webm",
						mp3: "audio/mpeg",
						wav: "audio/wav",
						pdf: "application/pdf"
					};
					const mime = mimeMap[ext] || "application/octet-stream";
					const buf = await readFile(target);
					res.writeHead(200, {
						"content-type": mime,
						"content-length": buf.length,
						"cache-control": "no-cache",
						"access-control-allow-origin": "*"
					});
					return res.end(buf);
				}
				if (url.pathname === "/vscode-files/git") {
					return sendJson(res, 200, await gitStatusOf(target));
				}
				if (url.pathname === "/vscode-files/search") {
					const q = url.searchParams.get("q") ?? "";
					const type = url.searchParams.get("type") || "filename";
					const caseSensitive = url.searchParams.get("caseSensitive") === "true";
					const isRegex = url.searchParams.get("isRegex") === "true";
					if (type === "content") {
						if (typeof q !== "string" || q.trim().length === 0) return sendJson(res, 400, { ok: false, error: "missing q" });
						return sendJson(res, 200, { ok: true, results: await searchContent(target, q.trim(), caseSensitive, isRegex) });
					}
					return sendJson(res, 200, { ok: true, results: await searchDir(target, typeof q === "string" ? q.trim() : "") });
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
				return sendJson(res, 404, { ok: false, error: "unknown vscode-files endpoint" });
			} catch (error) {
				return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "dsh-host-files: /vscode-files routes");
}

export { name, inject, apply };
