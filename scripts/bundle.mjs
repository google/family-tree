#!/usr/bin/env node
/**
 * @fileoverview Zero-Dependency Source Bundler for Family Tree Application.
 *
 * Scans all module source files under `src/` in hierarchical alphanumeric order,
 * concatenates them, and writes the consolidated `App.jsx` artifact in < 25ms.
 *
 * Usage:
 *   node scripts/bundle.mjs           # Bundle src/ -> App.jsx
 *   node scripts/bundle.mjs --check   # Check if App.jsx is in sync with src/
 *   node scripts/bundle.mjs --watch   # Watch src/ and auto-bundle on change
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = 'src';
const OUTPUT_FILE = 'App.jsx';

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Recursively discovers all .js/.jsx source files in a directory in sorted order.
 *
 * @param {string} dir - Directory to scan.
 * @returns {Array<string>} Relative file paths in alphabetical order.
 */
function discoverSourceFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    // Sort entries alphabetically
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...discoverSourceFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Bundles all files under `src/` into `App.jsx`.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.silent=false] - Suppress console output.
 * @param {boolean} [options.checkOnly=false] - Only verify sync without writing.
 * @returns {{ success: boolean, changed: boolean, fileCount: number, lineCount: number, sizeBytes: number, durationMs: number }}
 */
export function bundleApp(options = {}) {
    const { silent = false, checkOnly = false } = options;
    const startTime = Date.now();

    if (!fs.existsSync(SRC_DIR)) {
        if (!silent) console.error(`${RED}Error: "${SRC_DIR}" directory does not exist.${RESET}`);
        return { success: false, changed: false, fileCount: 0, lineCount: 0, sizeBytes: 0, durationMs: 0 };
    }

    const sourceFiles = discoverSourceFiles(SRC_DIR);
    if (sourceFiles.length === 0) {
        if (!silent) console.error(`${RED}Error: No .jsx or .js source files found in "${SRC_DIR}".${RESET}`);
        return { success: false, changed: false, fileCount: 0, lineCount: 0, sizeBytes: 0, durationMs: 0 };
    }

    const chunks = [];
    for (const file of sourceFiles) {
        chunks.push(fs.readFileSync(file, 'utf8'));
    }

    const bundledCode = chunks.join('\n');
    const lineCount = bundledCode.split('\n').length;
    const sizeBytes = Buffer.byteLength(bundledCode, 'utf8');

    let existingCode = null;
    if (fs.existsSync(OUTPUT_FILE)) {
        existingCode = fs.readFileSync(OUTPUT_FILE, 'utf8');
    }

    const isDifferent = existingCode !== bundledCode;
    const durationMs = Date.now() - startTime;

    if (checkOnly) {
        if (isDifferent) {
            if (!silent) {
                console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${OUTPUT_FILE} does not match ${SRC_DIR}/.`);
                console.log(`Run ${CYAN}node scripts/bundle.mjs${RESET} to synchronize.`);
            }
            return { success: false, changed: true, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
        } else {
            if (!silent) console.log(`${GREEN}✓${RESET} ${OUTPUT_FILE} is in sync with ${SRC_DIR}/ (${sourceFiles.length} files).`);
            return { success: true, changed: false, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
        }
    }

    if (isDifferent) {
        fs.writeFileSync(OUTPUT_FILE, bundledCode, 'utf8');
        if (!silent) {
            console.log(`${GREEN}✓${RESET} Bundled ${BOLD}${OUTPUT_FILE}${RESET} from ${CYAN}${sourceFiles.length} files${RESET} in ${SRC_DIR}/ (${lineCount.toLocaleString()} lines, ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) in ${durationMs}ms.`);
        }
    } else {
        if (!silent) {
            console.log(`${GREEN}✓${RESET} ${OUTPUT_FILE} already up to date (${sourceFiles.length} files, ${lineCount.toLocaleString()} lines) [${durationMs}ms].`);
        }
    }

    return { success: true, changed: isDifferent, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
}

// ─── CLI Entrypoint ──────────────────────────────────────────────────────────
const isDirectCall = process.argv[1] && (process.argv[1].endsWith('bundle.mjs') || process.argv[1].endsWith('bundle'));

if (isDirectCall) {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
${BOLD}${CYAN}Family Tree Source Bundler${RESET}

${BOLD}Usage:${RESET}
  node scripts/bundle.mjs [options]

${BOLD}Options:${RESET}
  ${BOLD}--check${RESET}      Check if App.jsx matches src/ without modifying files (exits 1 if out of sync).
  ${BOLD}--watch, -w${RESET}  Watch src/ and automatically re-bundle on any file change.
  ${BOLD}--help, -h${RESET}   Show this help message.
`);
        process.exit(0);
    }

    if (args.includes('--watch') || args.includes('-w')) {
        console.log(`\n${BOLD}${CYAN}Family Tree Bundler — Watching ${SRC_DIR}/ for changes...${RESET}\n`);
        bundleApp();

        let debounceTimer = null;
        fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
            if (filename && (filename.endsWith('.jsx') || filename.endsWith('.js'))) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log(`[${new Date().toLocaleTimeString()}] Change detected in ${filename}:`);
                    bundleApp();
                }, 50);
            }
        });
    } else {
        const checkOnly = args.includes('--check');
        const res = bundleApp({ checkOnly });
        process.exit(res.success ? 0 : 1);
    }
}
