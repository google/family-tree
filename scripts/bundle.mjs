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
const INDEX_FILE = 'index.html';
const THEME_MODULE_SUFFIX = '08_ColorThemes.jsx';
const THEME_CONFIG_BEGIN = '<!-- FT_TAILWIND_THEME_CONFIG:BEGIN -->';
const THEME_CONFIG_END = '<!-- FT_TAILWIND_THEME_CONFIG:END -->';

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
 * Evaluates the (JSX-free, side-effect free) colour theme module and returns the generated
 * `tailwind.config = {…}` script that maps every Tailwind colour onto a CSS variable.
 *
 * @param {Array<string>} sourceFiles - Discovered source files.
 * @returns {string|null} Script body, or null when the module is absent.
 */
function buildThemeConfigScript(sourceFiles) {
    const themeFile = sourceFiles.find((file) => file.endsWith(THEME_MODULE_SUFFIX));
    if (!themeFile) return null;
    const source = fs.readFileSync(themeFile, 'utf8');
    return new Function(`${source}\n;return TAILWIND_THEME_CONFIG_SCRIPT;`)();
}

/**
 * Returns the index.html text with the theme config script stamped between the markers
 * (unchanged when the markers are missing).
 *
 * @param {string} html - Current index.html content.
 * @param {string} script - Script body from buildThemeConfigScript().
 * @returns {string}
 */
export function stampThemeConfigIntoHtml(html, script) {
    const begin = html.indexOf(THEME_CONFIG_BEGIN);
    const end = html.indexOf(THEME_CONFIG_END);
    if (begin < 0 || end < 0 || end < begin) return html;
    const indented = script.split('\n').map((line) => (line ? `    ${line}` : line)).join('\n');
    const block = `${THEME_CONFIG_BEGIN}\n  <script>\n${indented}\n  </script>\n  `;
    return html.slice(0, begin) + block + html.slice(end);
}

/**
 * Keeps index.html's embedded Tailwind theme config in sync with the theme module.
 *
 * @param {Array<string>} sourceFiles - Discovered source files.
 * @param {{ silent: boolean, checkOnly: boolean }} options
 * @returns {{ success: boolean, changed: boolean }}
 */
function syncIndexHtmlThemeConfig(sourceFiles, { silent, checkOnly }) {
    if (!fs.existsSync(INDEX_FILE)) return { success: true, changed: false };
    const script = buildThemeConfigScript(sourceFiles);
    if (!script) return { success: true, changed: false };
    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    const stamped = stampThemeConfigIntoHtml(html, script);
    if (stamped === html) return { success: true, changed: false };
    if (checkOnly) {
        if (!silent) console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${INDEX_FILE} theme config does not match ${THEME_MODULE_SUFFIX}.`);
        return { success: false, changed: true };
    }
    fs.writeFileSync(INDEX_FILE, stamped, 'utf8');
    if (!silent) console.log(`${GREEN}✓${RESET} Stamped Tailwind theme config into ${BOLD}${INDEX_FILE}${RESET}.`);
    return { success: true, changed: true };
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
    const indexSync = syncIndexHtmlThemeConfig(sourceFiles, { silent, checkOnly });
    const durationMs = Date.now() - startTime;

    if (checkOnly) {
        if (isDifferent || !indexSync.success) {
            if (!silent) {
                if (isDifferent) console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${OUTPUT_FILE} does not match ${SRC_DIR}/.`);
                console.log(`Run ${CYAN}node scripts/bundle.mjs${RESET} to synchronize.`);
            }
            return { success: false, changed: true, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
        } else {
            if (!silent) console.log(`${GREEN}✓${RESET} ${OUTPUT_FILE} and ${INDEX_FILE} are in sync with ${SRC_DIR}/ (${sourceFiles.length} files).`);
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

    return { success: true, changed: isDifferent || indexSync.changed, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
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
