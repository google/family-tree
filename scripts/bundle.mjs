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

import crypto from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

const SRC_DIR = 'src';
const OUTPUT_FILE = 'App.jsx';
const COMPILED_FILE = 'App.compiled.js';
const INDEX_FILE = 'index.html';
const THEME_MODULE_SUFFIX = '08_ColorThemes.jsx';
const THEME_CONFIG_BEGIN = '<!-- FT_TAILWIND_THEME_CONFIG:BEGIN -->';
const THEME_CONFIG_END = '<!-- FT_TAILWIND_THEME_CONFIG:END -->';
const THEME_BOOT_BEGIN = '<!-- FT_THEME_BOOT:BEGIN -->';
const THEME_BOOT_END = '<!-- FT_THEME_BOOT:END -->';
const BUNDLE_VERSION_BEGIN = '<!-- FT_BUNDLE_VERSION:BEGIN -->';
const BUNDLE_VERSION_END = '<!-- FT_BUNDLE_VERSION:END -->';

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
 * Evaluates the (JSX-free, side-effect free) colour theme module and returns the two scripts
 * stamped into index.html: the generated `tailwind.config = {…}` that maps every Tailwind
 * colour onto a CSS variable, and the pre-React boot script that pre-paints the stored theme.
 *
 * @param {Array<string>} sourceFiles - Discovered source files.
 * @returns {{ config: string, boot: string }|null} Script bodies, or null when the module is absent.
 */
function buildThemeScripts(sourceFiles) {
    const themeFile = sourceFiles.find((file) => file.endsWith(THEME_MODULE_SUFFIX));
    if (!themeFile) return null;
    const source = fs.readFileSync(themeFile, 'utf8');
    return new Function(`${source}\n;return { config: TAILWIND_THEME_CONFIG_SCRIPT, boot: THEME_BOOT_SCRIPT };`)();
}

/**
 * Returns the html text with `script` stamped as a `<script>` block between the `begin` / `end`
 * marker comments (unchanged when the markers are missing).
 *
 * @param {string} html - Current index.html content.
 * @param {string} begin - Opening marker comment.
 * @param {string} end - Closing marker comment.
 * @param {string} script - Script body.
 * @returns {string}
 */
function stampScriptBetweenMarkers(html, begin, end, script) {
    const beginAt = html.indexOf(begin);
    const endAt = html.indexOf(end);
    if (beginAt < 0 || endAt < 0 || endAt < beginAt) return html;
    const indented = script.split('\n').map((line) => (line ? `    ${line}` : line)).join('\n');
    const block = `${begin}\n  <script>\n${indented}\n  </script>\n  `;
    return html.slice(0, beginAt) + block + html.slice(endAt);
}

/**
 * Loads @babel/core and presets from either local node_modules or the system Node install.
 *
 * @returns {{ babel: any, presetReact: any, presetEnv: any }}
 */
function loadBabelCompiler() {
    const resolvePkg = (pkg, systemFallback) => {
        try {
            return require(pkg);
        } catch (_) {
            return require(systemFallback);
        }
    };
    return {
        babel: resolvePkg('@babel/core', '/usr/share/nodejs/@babel/core'),
        presetReact: resolvePkg('@babel/preset-react', '/usr/share/nodejs/@babel/preset-react'),
        presetEnv: resolvePkg('@babel/preset-env', '/usr/share/nodejs/@babel/preset-env')
    };
}

/**
 * Ensures `App.compiled.js` matches the current `bundledCode` SHA-256 fingerprint, avoiding
 * expensive re-transpilation on no-op runs while guaranteeing zero in-browser Babel overhead.
 *
 * @param {string} bundledCode - Concatenated JSX bundle source.
 * @param {{ silent: boolean, checkOnly: boolean }} options
 * @returns {{ success: boolean, changed: boolean, bundleVersion: string }}
 */
function syncCompiledBundle(bundledCode, { silent, checkOnly }) {
    const srcHash = crypto.createHash('sha256').update(bundledCode).digest('hex').slice(0, 12);
    const headerPrefix = `/* FT-SRC-SHA256: ${srcHash} */`;
    if (fs.existsSync(COMPILED_FILE)) {
        const existingCompiled = fs.readFileSync(COMPILED_FILE, 'utf8');
        if (existingCompiled.startsWith(headerPrefix)) {
            const bundleVersion = crypto.createHash('sha256').update(existingCompiled).digest('hex').slice(0, 8);
            return { success: true, changed: false, bundleVersion };
        }
    }
    if (checkOnly) {
        if (!silent) console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${COMPILED_FILE} does not match ${SRC_DIR}/.`);
        return { success: false, changed: true, bundleVersion: srcHash.slice(0, 8) };
    }
    const compileStart = Date.now();
    const { babel, presetReact, presetEnv } = loadBabelCompiler();
    const transformed = babel.transformSync(bundledCode, {
        presets: [[presetReact], [presetEnv, { targets: { chrome: '90', safari: '15', firefox: '90', edge: '90' } }]],
        filename: OUTPUT_FILE,
        compact: true,
        comments: false
    }).code;
    const compiledOutput = `${headerPrefix}\n${transformed}\n`;
    fs.writeFileSync(COMPILED_FILE, compiledOutput, 'utf8');
    const bundleVersion = crypto.createHash('sha256').update(compiledOutput).digest('hex').slice(0, 8);
    if (!silent) {
        const kb = (Buffer.byteLength(compiledOutput, 'utf8') / 1024).toFixed(1);
        console.log(`${GREEN}✓${RESET} Pre-compiled ${BOLD}${COMPILED_FILE}${RESET} (${kb} KB, v=${bundleVersion}) in ${Date.now() - compileStart}ms.`);
    }
    return { success: true, changed: true, bundleVersion };
}

/**
 * Returns the index.html text with the theme config, boot script, and optional bundle version
 * stamped between their markers (unchanged when the markers are missing).
 *
 * @param {string} html - Current index.html content.
 * @param {{ config: string, boot: string, bundleVersion?: string }} scripts - Script bodies.
 * @returns {string}
 */
export function stampThemeConfigIntoHtml(html, scripts) {
    const withConfig = stampScriptBetweenMarkers(html, THEME_CONFIG_BEGIN, THEME_CONFIG_END, scripts.config);
    const withBoot = stampScriptBetweenMarkers(withConfig, THEME_BOOT_BEGIN, THEME_BOOT_END, scripts.boot);
    if (!scripts.bundleVersion) return withBoot;
    return stampScriptBetweenMarkers(
        withBoot,
        BUNDLE_VERSION_BEGIN,
        BUNDLE_VERSION_END,
        `var FT_APP_BUNDLE_VERSION = '${scripts.bundleVersion}';`
    );
}

/**
 * Keeps index.html's embedded Tailwind theme config, theme boot script, and bundle cache hash in sync.
 *
 * @param {Array<string>} sourceFiles - Discovered source files.
 * @param {{ silent: boolean, checkOnly: boolean, bundleVersion?: string }} options
 * @returns {{ success: boolean, changed: boolean }}
 */
function syncIndexHtmlThemeConfig(sourceFiles, { silent, checkOnly, bundleVersion }) {
    if (!fs.existsSync(INDEX_FILE)) return { success: true, changed: false };
    const scripts = buildThemeScripts(sourceFiles);
    if (!scripts) return { success: true, changed: false };
    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    const stamped = stampThemeConfigIntoHtml(html, { ...scripts, bundleVersion });
    if (stamped === html) return { success: true, changed: false };
    if (checkOnly) {
        if (!silent) console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${INDEX_FILE} stamped scripts do not match ${SRC_DIR}/.`);
        return { success: false, changed: true };
    }
    fs.writeFileSync(INDEX_FILE, stamped, 'utf8');
    if (!silent) console.log(`${GREEN}✓${RESET} Stamped Tailwind theme config and bundle version into ${BOLD}${INDEX_FILE}${RESET}.`);
    return { success: true, changed: true };
}

/**
 * Bundles all files under `src/` into `App.jsx` and pre-compiled `App.compiled.js`.
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
    const compiledSync = syncCompiledBundle(bundledCode, { silent, checkOnly });
    const indexSync = syncIndexHtmlThemeConfig(sourceFiles, {
        silent, checkOnly, bundleVersion: compiledSync.bundleVersion
    });
    const durationMs = Date.now() - startTime;

    if (checkOnly) {
        if (isDifferent || !compiledSync.success || !indexSync.success) {
            if (!silent) {
                if (isDifferent) console.error(`${RED}${BOLD}OUT OF SYNC:${RESET} ${OUTPUT_FILE} does not match ${SRC_DIR}/.`);
                console.log(`Run ${CYAN}node scripts/bundle.mjs${RESET} to synchronize.`);
            }
            return { success: false, changed: true, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
        } else {
            if (!silent) console.log(`${GREEN}✓${RESET} ${OUTPUT_FILE}, ${COMPILED_FILE}, and ${INDEX_FILE} are in sync with ${SRC_DIR}/ (${sourceFiles.length} files).`);
            return { success: true, changed: false, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
        }
    }

    if (isDifferent) {
        fs.writeFileSync(OUTPUT_FILE, bundledCode, 'utf8');
        if (!silent) {
            console.log(`${GREEN}✓${RESET} Bundled ${BOLD}${OUTPUT_FILE}${RESET} from ${CYAN}${sourceFiles.length} files${RESET} in ${SRC_DIR}/ (${lineCount.toLocaleString()} lines, ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) in ${durationMs}ms.`);
        }
    } else if (!compiledSync.changed) {
        if (!silent) {
            console.log(`${GREEN}✓${RESET} ${OUTPUT_FILE} and ${COMPILED_FILE} already up to date (${sourceFiles.length} files, ${lineCount.toLocaleString()} lines) [${durationMs}ms].`);
        }
    }

    return { success: true, changed: isDifferent || compiledSync.changed || indexSync.changed, fileCount: sourceFiles.length, lineCount, sizeBytes, durationMs };
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
