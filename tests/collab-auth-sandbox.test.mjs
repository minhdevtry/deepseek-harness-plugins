import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// We test against running server on port 3080 and collab server on 3088
const BASE_URL = 'http://127.0.0.1:3080';
const COLLAB_WS_URL = 'ws://127.0.0.1:3088';

async function postJson(path, data, token) {
	const headers = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = 'Bearer ' + token;
	const res = await fetch(`${BASE_URL}${path}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(data)
	});
	return { status: res.status, data: await res.json() };
}

async function getJson(path, token) {
	const headers = {};
	if (token) headers['Authorization'] = 'Bearer ' + token;
	const res = await fetch(`${BASE_URL}${path}`, { headers });
	return { status: res.status, data: await res.json() };
}

test('1. Authentication Status & Login Verification', async () => {
	// Status without token
	const statusRes = await getJson('/vscode-files/auth/status');
	assert.equal(statusRes.status, 200);
	assert.equal(statusRes.data.ok, true);

	// Login with Lucas profile
	const loginLucas = await postJson('/vscode-files/auth/login', {
		name: 'Lucas',
		color: '#3b82f6',
		avatar: '👨‍💻',
		preset: 'lucas'
	});
	assert.equal(loginLucas.status, 200);
	assert.equal(loginLucas.data.ok, true);
	assert.ok(loginLucas.data.token);
	assert.equal(loginLucas.data.user.name, 'Lucas');
	assert.equal(loginLucas.data.user.color, '#3b82f6');

	// Login with Lona profile
	const loginLona = await postJson('/vscode-files/auth/login', {
		name: 'Lona',
		color: '#ec4899',
		avatar: '💖',
		preset: 'lona'
	});
	assert.equal(loginLona.status, 200);
	assert.equal(loginLona.data.ok, true);
	assert.ok(loginLona.data.token);
	assert.equal(loginLona.data.user.name, 'Lona');
	assert.equal(loginLona.data.user.color, '#ec4899');

	// Verify status with Lucas token
	const authStatusLucas = await getJson('/vscode-files/auth/status', loginLucas.data.token);
	assert.equal(authStatusLucas.status, 200);
	assert.equal(authStatusLucas.data.authenticated, true);
	assert.equal(authStatusLucas.data.user.name, 'Lucas');
});

test('2. Workspace Sandboxing & Path Traversal Protection', async () => {
	// Check Sandbox Info
	const info = await getJson('/vscode-files/sandbox-info');
	assert.equal(info.status, 200);
	assert.equal(info.data.ok, true);
	assert.equal(info.data.sandboxed, true);
	assert.ok(info.data.sandboxRoot);

	// In-App Folder switcher
	const folders = await getJson('/vscode-files/sandbox-folders');
	assert.equal(folders.status, 200);
	assert.equal(folders.data.ok, true);
	assert.ok(Array.isArray(folders.data.folders));

	// Safe read inside sandbox
	const safeRead = await fetch(`${BASE_URL}/vscode-files/read?path=package.json`);
	assert.equal(safeRead.status, 200);
	const safeData = await safeRead.json();
	assert.equal(safeData.ok, true);
	assert.ok(safeData.content.includes('deepseek-harness'));

	// Illegal path traversal attempts blocked with 403 Forbidden
	const illegal1 = await fetch(`${BASE_URL}/vscode-files/read?path=../../../../../../etc/passwd`);
	assert.equal(illegal1.status, 403);
	const illegal1Data = await illegal1.json();
	assert.equal(illegal1Data.ok, false);
	assert.ok(illegal1Data.error.toLowerCase().includes('outside'));

	const illegal2 = await fetch(`${BASE_URL}/vscode-files/read?path=/etc/shadow`);
	assert.equal(illegal2.status, 403);
});

test('3. Real-Time Collaborative Editing via Yjs WebSocket Server (Lucas & Lona)', async () => {
	const docRoom = 'doc:test-collab-note.md';
	const url = `${COLLAB_WS_URL}/${encodeURIComponent(docRoom)}`;

	// Lucas client
	const docLucas = new Y.Doc();
	const wsLucas = new WebSocket(url);
	const textLucas = docLucas.getText('content');

	// Lona client
	const docLona = new Y.Doc();
	const wsLona = new WebSocket(url);
	const textLona = docLona.getText('content');

	await Promise.race([
		new Promise((resolve) => {
			let connected = 0;
			wsLucas.on('open', () => { if (++connected === 2) resolve(); });
			wsLona.on('open', () => { if (++connected === 2) resolve(); });
		}),
		new Promise((_, reject) => setTimeout(() => reject(new Error('WS connection timeout')), 3000))
	]);

	// Wire message handler for Lucas
	wsLucas.on('message', (data) => {
		const buf = new Uint8Array(data);
		const decoder = decoding.createDecoder(buf);
		const messageType = decoding.readVarUint(decoder);
		if (messageType === 0) { // sync
			const syncMessageType = decoding.readVarUint(decoder);
			if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, 0);
				syncProtocol.writeSyncStep2(encoder, docLucas);
				wsLucas.send(encoding.toUint8Array(encoder));
			} else if (syncMessageType === syncProtocol.messageYjsSyncStep2 || syncMessageType === syncProtocol.messageYjsUpdate) {
				syncProtocol.readUpdate(decoder, docLucas, 'remote');
			}
		}
	});

	// Wire message handler for Lona
	wsLona.on('message', (data) => {
		const buf = new Uint8Array(data);
		const decoder = decoding.createDecoder(buf);
		const messageType = decoding.readVarUint(decoder);
		if (messageType === 0) { // sync
			const syncMessageType = decoding.readVarUint(decoder);
			if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, 0);
				syncProtocol.writeSyncStep2(encoder, docLona);
				wsLona.send(encoding.toUint8Array(encoder));
			} else if (syncMessageType === syncProtocol.messageYjsSyncStep2 || syncMessageType === syncProtocol.messageYjsUpdate) {
				syncProtocol.readUpdate(decoder, docLona, 'remote');
			}
		}
	});

	// Initial sync handshake from Lucas
	const encoderL1 = encoding.createEncoder();
	encoding.writeVarUint(encoderL1, 0);
	syncProtocol.writeSyncStep1(encoderL1, docLucas);
	wsLucas.send(encoding.toUint8Array(encoderL1));

	// Initial sync handshake from Lona
	const encoderLo1 = encoding.createEncoder();
	encoding.writeVarUint(encoderLo1, 0);
	syncProtocol.writeSyncStep1(encoderLo1, docLona);
	wsLona.send(encoding.toUint8Array(encoderLo1));

	// Lucas writes text into the shared document
	docLucas.on('update', (update, origin) => {
		if (origin !== 'remote' && wsLucas.readyState === WebSocket.OPEN) {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, 0);
			syncProtocol.writeUpdate(encoder, update);
			wsLucas.send(encoding.toUint8Array(encoder));
		}
	});

	// Lona listens and also writes
	docLona.on('update', (update, origin) => {
		if (origin !== 'remote' && wsLona.readyState === WebSocket.OPEN) {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, 0);
			syncProtocol.writeUpdate(encoder, update);
			wsLona.send(encoding.toUint8Array(encoder));
		}
	});

	// Wait 100ms for sync setup
	await new Promise(r => setTimeout(r, 100));

	// Lucas inserts: "Hello from Lucas! "
	docLucas.transact(() => {
		textLucas.insert(0, "Hello from Lucas! ");
	});

	// Wait 200ms for Lona to receive
	await new Promise(r => setTimeout(r, 200));
	assert.ok(textLona.toString().includes("Hello from Lucas!"));

	// Lona appends: "And hello from Lona! 💖"
	docLona.transact(() => {
		textLona.insert(textLona.length, "And hello from Lona! 💖");
	});

	// Wait 200ms for Lucas to receive
	await new Promise(r => setTimeout(r, 200));
	assert.ok(textLucas.toString().includes("And hello from Lona! 💖"));
	assert.equal(textLucas.toString(), textLona.toString());

	wsLucas.close();
	wsLona.close();
});
