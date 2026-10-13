#!/usr/bin/env node
/**
 * @fileoverview Captures the exact spreadsheet rows the running app would crawl for a
 * Google Sheet (root tab + linked sheets), using the app's own crawler inside headless
 * Chrome, and writes them to a JSON fixture. The fixture feeds scripts/tree_snapshot.mjs
 * so deduction-engine refactors can be verified against a frozen, reproducible input.
 *
 * Usage:
 *   node scripts/capture_sheet_rows.mjs --id <sheetId> --out <path.json> [--server http://localhost:8000/]
 *
 * NOTE: Fixtures captured from private family sheets contain personal data. Keep them
 * under scratch/ (gitignored, never mirrored by push.sh) — never commit them.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const argValue = (flag, fallback = null) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : fallback;
};

const sheetId = argValue('--id');
const outPath = argValue('--out');
const serverUrl = argValue('--server', 'http://localhost:8000/');
if (!sheetId || !outPath) {
    console.error('Usage: node scripts/capture_sheet_rows.mjs --id <sheetId> --out <path.json> [--server <url>]');
    process.exit(1);
}

const userDataDir = `/tmp/chrome-capture-${Date.now()}`;
fs.mkdirSync(userDataDir, { recursive: true });
const pageUrl = `${serverUrl.replace(/\/?$/, '/')}?id=${encodeURIComponent(sheetId)}`;
const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', '--window-size=1280,800', `--user-data-dir=${userDataDir}`, pageUrl
], { stdio: ['ignore', 'pipe', 'pipe'] });

/** Waits for Chrome to announce its DevTools port on stderr. */
function waitForDevToolsPort() {
    return new Promise((resolve, reject) => {
        let stderr = '';
        chrome.stderr.on('data', chunk => {
            stderr += chunk.toString();
            const m = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
            if (m) resolve(m[1]);
        });
        setTimeout(() => reject(new Error('Timed out waiting for headless Chrome')), 15000);
    });
}

/** Opens a CDP session on the first page target and returns an evaluate() helper. */
async function connectToPage(port) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('message', ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
    await send('Runtime.enable');
    const evaluate = async (expression) => {
        const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ': ' + JSON.stringify(res.exceptionDetails.exception));
        return res.result ? res.result.value : undefined;
    };
    return { evaluate, close: () => ws.close() };
}

// The app persists the complete crawled row set (all linked sheets) in localStorage once the
// import succeeds; App.jsx itself runs inside `new Function`, so its crawler is not reachable
// from the page scope — reading the persisted cache is the faithful way to get the same rows.
const CACHE_PROBE = `(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('ft_cache_') && k.includes(${JSON.stringify(sheetId)}));
    if (!key) return null;
    const data = JSON.parse(localStorage.getItem(key));
    return JSON.stringify({ key, rowCount: data.rows.length, nodes: document.querySelectorAll('.person-node').length });
})()`;

try {
    const port = await waitForDevToolsPort();
    const { evaluate, close } = await connectToPage(port);

    // Wait for the import to finish: the cache entry exists and its row count is stable for 3 polls.
    let stable = 0, last = null, probe = null;
    for (let i = 0; i < 240 && stable < 3; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const raw = await evaluate(CACHE_PROBE);
        probe = raw ? JSON.parse(raw) : null;
        const signature = probe ? `${probe.rowCount}:${probe.nodes}` : null;
        stable = (signature && signature === last) ? stable + 1 : 0;
        last = signature;
    }
    if (!probe) throw new Error('The app never persisted a TreeDataCache entry for this sheet (import failed?)');

    const payload = await evaluate(`(() => {
        const data = JSON.parse(localStorage.getItem(${JSON.stringify(probe.key)}));
        return JSON.stringify({ sheetId: ${JSON.stringify(sheetId)}, capturedAt: new Date().toISOString(),
            sheetTags: data.sheetTags || {}, rows: data.rows, renderedNodes: document.querySelectorAll('.person-node').length });
    })()`);

    const data = JSON.parse(payload);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(data, null, 1));
    const perSheet = {};
    data.rows.forEach(r => { perSheet[r._sourceId] = (perSheet[r._sourceId] || 0) + 1; });
    console.log(`Captured ${data.rows.length} rows from ${Object.keys(perSheet).length} sheet(s) (${data.renderedNodes} person cards rendered) → ${outPath}`);
    Object.entries(perSheet).forEach(([sid, n]) => console.log(`  ${sid}  (${data.sheetTags[sid] || '?'}): ${n} rows`));
    close();
} finally {
    chrome.kill('SIGKILL');
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
}
