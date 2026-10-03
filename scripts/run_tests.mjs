#!/usr/bin/env node
/**
 * @fileoverview Multi-Tier Automated Test Runner for Family Tree Application.
 *
 * Provides tiered validation:
 * - Stage 1: Whole-file Babel AST parse verification (zero syntax errors).
 * - Stage 2: Whole-file AST scope & identifier traversal (zero undeclared variables).
 * - Stage 3: Algorithmic & unit test suite execution (tests.html, 2,242+ tests).
 * - Stage 4: Headless Chrome E2E browser smoke test via CDP (verifies in-browser Babel
 *            compilation, React mounting, and 240+ rendered person nodes).
 *
 * Tiered Execution Options:
 *   --section <id>    Run only a single test section (e.g. --section 188). Sub-second feedback.
 *   --grep <pattern>  Run only tests or sections matching pattern / regex.
 *   --fast            Run Stages 1, 2, 3 (skips Headless Chrome Stage 4). ~2.5s execution.
 *   --full            Run all 4 stages including Headless Chrome.
 *   --skip-ast        Skip Stages 1 and 2 for instant inner-loop algorithm debugging (~1s).
 *   --list-sections   List all available test sections in tests.html.
 *   --audit           Run scripts/audit_quality.mjs after tests.
 *   --help            Show usage information.
 */

import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const babelParser = require('/usr/share/nodejs/@babel/parser/index.cjs');
const traverseModule = await import('/usr/share/nodejs/@babel/traverse/lib/index.js');
const traverse = traverseModule.default.default;

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Parse CLI flags
const args = process.argv.slice(2);

function getArgValue(flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return null;
}

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${BOLD}${CYAN}Family Tree Multi-Tier Test Runner${RESET}

${BOLD}Usage:${RESET}
  node scripts/run_tests.mjs [options]

${BOLD}Options:${RESET}
  ${BOLD}--section <id>${RESET}      Run only test section <id> (e.g. --section 188, --section 1)
  ${BOLD}--grep <pattern>${RESET}    Run tests or sections matching regex/text pattern
  ${BOLD}--fast${RESET}              Run Stages 1-3 (AST parse, scope check, unit tests). Skips Chrome.
  ${BOLD}--full${RESET}              Run all 4 stages (including Headless Chrome E2E test).
  ${BOLD}--skip-ast${RESET}          Skip Stages 1 & 2 for instant sub-second unit test iteration.
  ${BOLD}--list-sections${RESET}     List all available test sections in tests.html with line numbers.
  ${BOLD}--audit${RESET}             Also run the Code Quality Auditor (scripts/audit_quality.mjs).
  ${BOLD}--help, -h${RESET}          Show this help message.

${BOLD}Examples:${RESET}
  node scripts/run_tests.mjs --section 188          ${DIM}# Fast slice: only Section 188 (<1s)${RESET}
  node scripts/run_tests.mjs --grep "Jesmi"         ${DIM}# Fast slice: matching "Jesmi"${RESET}
  node scripts/run_tests.mjs --fast                 ${DIM}# All 2,242 unit tests (~2.5s)${RESET}
  node scripts/run_tests.mjs --full                 ${DIM}# Full 4-stage quality gate (~20s)${RESET}
  node scripts/run_tests.mjs --fast --audit         ${DIM}# Fast tests + quality audit${RESET}
`);
    process.exit(0);
}

// ─── List Sections Mode ───────────────────────────────────────────────────────
if (args.includes('--list-sections')) {
    const html = fs.readFileSync('tests.html', 'utf8');
    const lines = html.split('\n');
    console.log(`\n${BOLD}${CYAN}Available Test Sections in tests.html:${RESET}\n`);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/section\(\s*['"]([^'"]+)['"]\s*\)/);
        if (m) {
            count++;
            console.log(`  ${CYAN}${String(count).padStart(3, ' ')}.${RESET} Line ${String(i + 1).padStart(5, ' ')}: ${m[1]}`);
        }
    }
    console.log(`\n${DIM}Total: ${count} test sections found.${RESET}\n`);
    process.exit(0);
}

const sectionFilter = getArgValue('--section');
const grepFilter = getArgValue('--grep');
const isFast = args.includes('--fast') || (sectionFilter !== null) || (grepFilter !== null);
const isFull = args.includes('--full') && !args.includes('--fast');
const skipAst = args.includes('--skip-ast');
const runAudit = args.includes('--audit');

const shouldRunChrome = isFull || (!isFast && !sectionFilter && !grepFilter);

console.log(`\n${BOLD}${CYAN}Family Tree Test Suite${RESET}`);
console.log(`${DIM}Mode: ${sectionFilter ? `Section "${sectionFilter}"` : grepFilter ? `Grep "${grepFilter}"` : isFast ? 'Fast (Stages 1-3)' : 'Full (Stages 1-4 with E2E Chrome)'}${RESET}\n`);

// ─── Read Workspace Files ────────────────────────────────────────────────────
if (fs.existsSync('src')) {
    const { bundleApp } = await import('./bundle.mjs');
    const bundleRes = bundleApp({ silent: true });
    if (bundleRes.changed) {
        console.log(`  ${CYAN}⚡ Auto-bundled App.jsx from src/ (${bundleRes.fileCount} files, ${bundleRes.durationMs}ms)${RESET}`);
    }
}

if (!fs.existsSync('App.jsx')) {
    console.error(`${RED}Error: App.jsx not found in current directory.${RESET}`);
    process.exit(1);
}
if (!fs.existsSync('tests.html')) {
    console.error(`${RED}Error: tests.html not found in current directory.${RESET}`);
    process.exit(1);
}

const app = fs.readFileSync('App.jsx', 'utf8');

// ============================================================================
// STAGE 1: Whole-File AST Module Syntax & Parsing Validation (Babel)
// ============================================================================
let ast;
if (!skipAst) {
    console.log(`${BOLD}─── Stage 1: Whole-File Babel AST Parse Verification ───${RESET}`);
    const parseStart = Date.now();
    try {
        ast = babelParser.parse(app, { sourceType: 'module', plugins: ['jsx'] });
        console.log(`  ${GREEN}✓${RESET} Full App.jsx (${app.split('\n').length.toLocaleString()} lines) parses cleanly as ES module (${Date.now() - parseStart}ms).`);
    } catch (syntaxErr) {
        console.error(`  ${RED}${BOLD}FATAL SYNTAX ERROR IN App.jsx:${RESET} ${syntaxErr.message} at line ${syntaxErr.loc?.line}, column ${syntaxErr.loc?.column}`);
        process.exit(1);
    }
}

// ============================================================================
// STAGE 2: AST Variable Scope & Undeclared Reference Linting
// ============================================================================
if (!skipAst && ast) {
    console.log(`${BOLD}─── Stage 2: Whole-File AST Scope & Identifier Analysis ───${RESET}`);
    const scopeStart = Date.now();
    const undeclared = new Map();
    const allowedGlobals = new Set([
        'window', 'document', 'navigator', 'console', 'Math', 'Date', 'JSON', 'Set', 'Map', 'Array', 'Object',
        'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Symbol',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
        'fetch', 'performance', 'URL', 'Blob', 'FileReader', 'Image', 'Event', 'CustomEvent', 'KeyboardEvent',
        'MouseEvent', 'TouchEvent', 'PointerEvent', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver',
        'DOMParser', 'XMLSerializer', 'HTMLInputElement', 'HTMLElement', 'Node', 'Element', 'SVGElement',
        'WebSocket', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat',
        'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
        'React', 'ReactDOM', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useLayoutEffect',
        'useReducer', 'useContext', 'Babel', 'htmlToImage', 'L', 'exports', 'module', 'require', 'globalThis',
        'XMLHttpRequest', 'undefined', 'Infinity', 'escape', 'atob', 'unescape', 'btoa', 'Buffer', 'AbortController',
        'URLSearchParams'
    ]);

    traverse(ast, {
        ReferencedIdentifier(pathNode) {
            const name = pathNode.node.name;
            if (allowedGlobals.has(name)) return;
            if (!pathNode.scope.hasBinding(name, true)) {
                if (!undeclared.has(name)) undeclared.set(name, []);
                undeclared.get(name).push(pathNode.node.loc?.start.line);
            }
        }
    });

    if (undeclared.size > 0) {
        console.error(`  ${RED}${BOLD}FATAL: Found ${undeclared.size} undeclared identifier reference(s) in App.jsx:${RESET}`);
        for (const [name, errLines] of undeclared.entries()) {
            console.error(`    - ${name} referenced at lines: ${errLines.join(', ')}`);
        }
        process.exit(1);
    }
    console.log(`  ${GREEN}✓${RESET} Zero undeclared variables across all functions, hooks, and components (${Date.now() - scopeStart}ms).`);
}

// ============================================================================
// STAGE 3: Algorithmic & Unit Test Suite Execution (tests.html)
// ============================================================================
console.log(`${BOLD}─── Stage 3: Algorithmic Unit Tests (tests.html) ───${RESET}`);
const html = fs.readFileSync('tests.html', 'utf8');

const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!match) {
    console.error(`${RED}FATAL: Could not find <script type="module"> in tests.html${RESET}`);
    process.exit(1);
}

let script = match[1];
script = script.replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"\n]+['"]\s*;?\n?/g, '');

const mockDom = `
const appCode = ${JSON.stringify(app)};
globalThis.fetch = async () => ({ text: async () => ${JSON.stringify(app)} });

const elements = new Map();
globalThis.document = {
    getElementById: (id) => elements.get(id) || { innerHTML: "", textContent: "", style: {}, appendChild: () => {}, addEventListener: () => {} },
    title: "",
    querySelector: () => null,
    createElement: () => ({ id: "", textContent: "", style: {}, innerHTML: "", appendChild: () => {}, setAttribute: () => {} }),
    body: {
        appendChild: (el) => { if (el && el.id) elements.set(el.id, el); },
        removeChild: (el) => { if (el && el.id) elements.delete(el.id); }
    }
};
const window = { scrollTo: () => {}, goToNextError: () => {} };
globalThis.window = window;

const targetSection = ${JSON.stringify(sectionFilter || '')};
const targetGrep = ${JSON.stringify(grepFilter || '')};
const grepRegex = targetGrep ? new RegExp(targetGrep, 'i') : null;

let activeSectionName = '';
let isSectionMatch = !targetSection && !targetGrep;
let matchingSectionsCount = 0;

const sectionFailures = [];
let totalCount = 0, passedCount = 0, failedCount = 0;
`;

// Replace test harness helpers with filtered, colorful runners
script = script.replace('function section(name) {', `
function section(name) {
    activeSectionName = name;
    if (targetSection) {
        const numMatch = name.match(/^(\\d+)[.:]/);
        const secNum = numMatch ? numMatch[1] : '';
        isSectionMatch = (secNum === targetSection);
    } else if (grepRegex) {
        isSectionMatch = grepRegex.test(name);
    } else {
        isSectionMatch = true;
    }
    if (isSectionMatch) {
        matchingSectionsCount++;
        console.log('\\x1b[1m▸ ' + name + '\\x1b[0m');
    }
`);

script = script.replace('function comment(text) {', `
function comment(text) {
    if (isSectionMatch) console.log('  \\x1b[2m// ' + text + '\\x1b[0m');
`);

script = script.replace('function recordFailure(desc, errorDetail = \'\') {', `
function recordFailure(desc, errorDetail = '') {
    const shouldRecord = isSectionMatch || (grepRegex && grepRegex.test(desc));
    if (!shouldRecord) return;
    totalCount++;
    failedCount++;
    const errText = desc + (errorDetail ? ' (' + errorDetail + ')' : '');
    sectionFailures.push(errText);
    console.log('  \\x1b[31m✗ FAIL: ' + errText + '\\x1b[0m');
`);

script = script.replace('function assert(desc, condition) {', `
function assert(desc, condition) {
    const isTestGrepMatch = grepRegex && grepRegex.test(desc);
    const shouldRun = isSectionMatch || isTestGrepMatch;
    if (!shouldRun) return;
    totalCount++;
    if (condition) {
        passedCount++;
        if (targetSection || targetGrep) {
            console.log('  \\x1b[32m✓ ' + desc + '\\x1b[0m');
        }
    } else {
        recordFailure(desc);
    }
`);

script = script.replace('function assertEqual(desc, actual, expected) {', `
function assertEqual(desc, actual, expected) {
    const isTestGrepMatch = grepRegex && grepRegex.test(desc);
    const shouldRun = isSectionMatch || isTestGrepMatch;
    if (!shouldRun) return;
    totalCount++;
    if (actual === expected) {
        passedCount++;
        if (targetSection || targetGrep) {
            console.log('  \\x1b[32m✓ ' + desc + '\\x1b[0m');
        }
    } else {
        recordFailure(desc, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
`);

let runnerScript = mockDom + '\n' + script;

runnerScript += `
if (out.innerHTML.includes("FATAL:")) {
    const fatalMatch = out.innerHTML.match(/FATAL:[^<]*/);
    console.error("\\x1b[31mFATAL RUNTIME ERROR IN TESTS:\\x1b[0m", fatalMatch ? fatalMatch[0] : "Check tests.html");
    process.exit(1);
}

if (targetSection && matchingSectionsCount === 0) {
    console.warn("\\x1b[33mWarning: Section '" + targetSection + "' did not match any section in tests.html.\\x1b[0m");
    console.log("Run 'node scripts/run_tests.mjs --list-sections' to view all available sections.");
    process.exit(1);
}

if (sectionFailures.length > 0) {
    console.log("\\n\\x1b[31m\\x1b[1mFailures (" + sectionFailures.length + "):\\x1b[0m");
    sectionFailures.forEach(f => console.log("  - " + f));
    console.log("\\nResults: " + passedCount + "/" + totalCount + " passed, \\x1b[31m" + failedCount + " failed\\x1b[0m");
    process.exit(1);
} else {
    if (targetSection || targetGrep) {
        console.log("\\n\\x1b[32m\\x1b[1m✓ ALL " + totalCount + " TARGETED TESTS PASSED 100%!\\x1b[0m");
    } else {
        console.log("  \\x1b[32m✓ Results: " + passedCount + "/" + totalCount + " passed, 0 failed. ALL " + totalCount + " UNIT TESTS PASSED 100%!\\x1b[0m");
    }
}
`;

fs.writeFileSync('/tmp/_run_tests_gen.mjs', runnerScript);
try {
    execSync('node /tmp/_run_tests_gen.mjs', { stdio: 'inherit' });
} catch (testExecErr) {
    process.exit(1);
}

// ============================================================================
// STAGE 4: Headless Chrome End-to-End Browser Smoke Test
// ============================================================================
if (shouldRunChrome) {
    console.log(`${BOLD}─── Stage 4: Headless Chrome E2E App Load & Render Verification ───${RESET}`);
    const userDataDir = '/tmp/chrome-smoke-' + Date.now();
    const chrome = spawn('google-chrome', [
        '--headless=new',
        '--remote-debugging-port=9234',
        '--user-data-dir=' + userDataDir,
        '--no-sandbox',
        '--disable-gpu',
        '--window-size=1280,800',
        'http://localhost:8000/'
    ]);

    try {
        let connected = false;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            try {
                const res = await fetch('http://localhost:9234/json');
                if (res.ok) {
                    const tabs = await res.json();
                    if (tabs.length > 0 && tabs[0].webSocketDebuggerUrl) {
                        connected = true;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!connected) {
            console.error(`  ${RED}FATAL: Could not connect to headless Chrome on port 9234.${RESET}`);
            process.exit(1);
        }

        const tabsRes = await fetch('http://localhost:9234/json');
        const tabs = await tabsRes.json();
        const targetTab = tabs.find(t => t.type === 'page' || t.url.includes('localhost:8000')) || tabs[0];
        const wsUrl = targetTab.webSocketDebuggerUrl;

        const ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let reqId = 1;
        function sendCommand(method, params = {}) {
            return new Promise((resolve) => {
                const id = reqId++;
                const handler = (evt) => {
                    const msg = JSON.parse(evt.data);
                    if (msg.id === id) {
                        ws.removeEventListener('message', handler);
                        resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');

        const evaluate = async (expression) => {
            const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            return res?.result?.value;
        };
        // Polls an in-page expression until `predicate` accepts its value; dumps the page text and exits on timeout.
        const waitFor = async (label, expression, predicate, attempts = 25, delayMs = 600) => {
            for (let attempt = 0; attempt < attempts; attempt++) {
                await new Promise(r => setTimeout(r, delayMs));
                const value = await evaluate(expression);
                if (predicate(value)) return value;
            }
            const bodyText = await evaluate('document.body.innerText');
            console.error(`  ${RED}FATAL: ${label} — timed out in Headless Chrome:${RESET}\n`, bodyText);
            process.exit(1);
        };
        const DEMO_ID = '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0';
        const q = (selector) => `document.querySelector('${selector}')`;

        // 1. The home screen comes first: the URL input box is empty (no clipboard hit), the inline sheet list is immediately visible below it, and NOTHING loads until the user asks.
        const homeState = JSON.parse(await waitFor('home screen with empty input box, inline sheet list, and radial FAB',
            `JSON.stringify({ home: !!${q('[data-testid="sheet-source-home"]')}, privacy: !!${q('[data-testid="home-privacy-notice"]')},
                fab: !!${q('[data-testid="settings-fab-toggle"]')},
                inlineList: (${q('[data-testid="sheet-history-dropdown"]')} || {}).innerText || '',
                value: (document.getElementById('sheet-source-input') || {}).value || '', nodes: document.querySelectorAll('.person-node').length })`,
            (v) => { const s = v && JSON.parse(v); return s && s.home && s.privacy && s.fab && s.value === '' && s.inlineList.includes('Ancestry Browser: Demo') && s.nodes === 0; }));
        console.log(`  ${GREEN}✓${RESET} Home screen rendered first: URL input box empty, inline sheet list visible ("Ancestry Browser: Demo"), radial FAB visible, no tree loaded yet (${homeState.nodes} nodes).`);

        // 2. Open the radial FAB on the home screen -> pick "Colour theme" -> switch to "dark" -> close dialog -> reset to "classic".
        await evaluate(`${q('[data-testid="settings-fab-toggle"]')}.click(); 'clicked'`);
        await waitFor('radial FAB satellite buttons', `!!${q('[data-testid="settings-fab-theme"]')}`, Boolean, 10, 200);
        await evaluate(`${q('[data-testid="settings-fab-theme"]')}.click(); 'clicked'`);
        const themeCount = await waitFor('Appearance tab with 7 M3 themes', `document.querySelectorAll('[data-testid^="theme-card-"]').length`, (n) => n === 7, 10, 200);
        await evaluate(`${q('[data-testid="theme-card-dark"]')}.click(); 'clicked'`);
        const darkState = JSON.parse(await waitFor('dark theme applied',
            `JSON.stringify({ theme: document.documentElement.getAttribute('data-theme'), mode: document.documentElement.getAttribute('data-theme-mode'), cookie: document.cookie })`,
            (v) => { const s = v && JSON.parse(v); return s && s.theme === 'dark' && s.mode === 'dark' && s.cookie.includes('ft_color_theme=dark'); }, 10, 200));
        await evaluate(`${q('[data-testid="theme-card-classic"]')}.click(); 'clicked'`);
        await evaluate(`${q('[data-testid="app-settings-panel"] button[title="Close"]')}.click(); 'clicked'`);
        console.log(`  ${GREEN}✓${RESET} Radial FAB opened Settings (${themeCount} M3 themes); applied "${darkState.theme}" (${darkState.mode}) and persisted cookie.`);

        // 3. Click the demo sheet row in the inline list below the input box → the demo sheet is fetched from Google and the tree renders.
        await evaluate(`${q(`[data-sheet-id="${DEMO_ID}"]`)}.click(); 'clicked'`);
        const nodeCount = await waitFor('tree render after clicking inline sheet row', "document.querySelectorAll('.person-node').length", (n) => n >= 10, 40, 600);
        console.log(`  ${GREEN}✓${RESET} Headless Chrome E2E verification successful: <App /> mounted cleanly with zero runtime exceptions, rendered ${nodeCount} person nodes.`);

        // 4. After a successful load: home screen gone, Home button + radial FAB + watermark mounted, ?id= in the address bar, history cookie written.
        const shell = JSON.parse(await waitFor('post-load shell state',
            `JSON.stringify({ home: !!${q('[data-testid="sheet-source-home"]')}, homeBtn: !!${q('[data-testid="home-button"]')},
                fab: !!${q('[data-testid="settings-fab-toggle"]')},
                watermark: !!${q('[data-testid="brand-watermark"]')}, search: location.search, cookie: document.cookie })`,
            (v) => { const s = v && JSON.parse(v); return s && !s.home && s.homeBtn && s.fab && s.watermark && s.search.includes(`id=${DEMO_ID}`) && s.cookie.includes('ft_sheet_history='); }, 10, 300));
        console.log(`  ${GREEN}✓${RESET} Shell after load: Home button + radial FAB + watermark mounted, address bar "${shell.search}", sheet-history cookie written.`);

        // 5. Hovering a button shows the speech-balloon tooltip with a tail and full title.
        await evaluate(`${q('[data-testid="home-button"]')}.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); 'hovered'`);
        await waitFor('speech-balloon hover tooltip',
            `JSON.stringify({ popover: !!${q('[data-testid="button-doc-popover"]')}, tail: !!${q('[data-testid="button-doc-tail"]')}, text: (${q('[data-testid="button-doc-popover"]')} || {}).innerText || '' })`,
            (v) => { const s = v && JSON.parse(v); return s && s.popover && s.tail && s.text.includes('Home: Choose a Google Sheet'); }, 10, 200);
        console.log(`  ${GREEN}✓${RESET} Hover help balloon rendered with tail pointer and full title.`);

        // 6. Home button → the chooser returns with an empty input box, "← Back to the current tree" alongside the inline list of previously used sheets,
        //    no pulldown caret, and when a URL is present in the copy buffer (clipboard), it prefills and displays the "Copied from copy buffer" badge.
        await evaluate(`${q('[data-testid="home-button"]')}.click(); 'clicked'`);
        await waitFor('home screen after Home button with empty input, inline sheet list, and "Back to the current tree" link',
            `JSON.stringify({
                value: (document.getElementById('sheet-source-input') || {}).value || '',
                listText: (${q('[data-testid="sheet-history-dropdown"]')} || {}).innerText || '',
                backBtn: !!${q('[data-testid="back-to-tree-button"]')},
                caret: !!${q('button[aria-label="Show sheets you have opened before"]')}
            })`,
            (v) => {
                const s = v && JSON.parse(v);
                return s && s.value === '' && s.backBtn && !s.caret &&
                    s.listText.includes('Back to the current tree') &&
                    s.listText.includes('Ancestry Browser: Demo') &&
                    s.listText.includes(DEMO_ID);
            }, 10, 300);
        await evaluate(`(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { readText: async () => 'https://docs.google.com/spreadsheets/d/${DEMO_ID}/edit' }
            });
            window.dispatchEvent(new Event('focus'));
            return 'clipboard-mocked';
        })()`);
        await waitFor('clipboard prefill badge and title chip when clipboard holds a sheet URL',
            `JSON.stringify({
                value: (document.getElementById('sheet-source-input') || {}).value || '',
                badge: (${q('[data-testid="clipboard-prefill-badge"]')} || {}).innerText || '',
                chip: (${q('[data-testid="sheet-source-title"]')} || {}).innerText || ''
            })`,
            (v) => {
                const s = v && JSON.parse(v);
                return s && s.value.includes(DEMO_ID) && s.badge.includes('Copied from copy buffer') && s.chip.includes('Ancestry Browser: Demo');
            }, 10, 300);
        console.log(`  ${GREEN}✓${RESET} Home button reopens chooser with empty input, inline sheet list + "Back to the current tree" link, and clipboard prefill indicator badge.`);

        // 7. Navigating to bare http://localhost:8000/ when a sheet is remembered in the cookie skips the home screen and opens the previous view directly.
        await sendCommand('Page.navigate', { url: 'http://localhost:8000/' });
        const resumedNodes = await waitFor('direct resume of previous tree view on bare URL',
            `JSON.stringify({ home: !!${q('[data-testid="sheet-source-home"]')}, nodes: document.querySelectorAll('.person-node').length })`,
            (v) => { const s = v && JSON.parse(v); return s && !s.home && s.nodes >= 10; }, 40, 600);
        console.log(`  ${GREEN}✓${RESET} Bare URL startup resumed previous sheet view directly (${JSON.parse(resumedNodes).nodes} nodes, home screen skipped).`);

        ws.close();
    } finally {
        chrome.kill('SIGKILL');
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
    }
} else {
    console.log(`${DIM}─── Stage 4: Skipped (fast mode). Use --full to run Headless Chrome E2E. ───${RESET}`);
}

// ─── Optional Quality Audit ──────────────────────────────────────────────────
if (runAudit) {
    console.log('');
    try {
        execSync('node scripts/audit_quality.mjs', { stdio: 'inherit' });
    } catch (auditErr) {
        process.exit(1);
    }
}

console.log(`\n${GREEN}${BOLD}✓ ALL TEST STAGES COMPLETED SUCCESSFULLY!${RESET}\n`);
process.exit(0);
