#!/usr/bin/env node
/**
 * @fileoverview Code Quality Auditor for Family Tree Application.
 *
 * Validates the strict codebase standards:
 * 1. Function Line Limit: Zero functions, methods, or components > 40 lines.
 * 2. JSDoc Coverage: 100% of top-level functions, classes, and components have JSDoc blocks.
 * 3. JSDoc Examples: Every JSDoc block has at least 2 distinct @example tags.
 * 4. Identifier Scope: Zero undeclared variables across all lines.
 * 5. Brittle Test Warnings: Flags change-detector tests in tests.html using appCode.includes().
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const babelParser = require('/usr/share/nodejs/@babel/parser/index.cjs');
const traverseModule = await import('/usr/share/nodejs/@babel/traverse/lib/index.js');
const traverse = traverseModule.default.default;

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const isStrict = args.includes('--strict');
const isJson = args.includes('--json');
const isVerbose = args.includes('--verbose') || args.includes('-v');

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${BOLD}Usage:${RESET} node scripts/audit_quality.mjs [options]

${BOLD}Options:${RESET}
  --file <path>    Target JS/JSX file to audit (default: App.jsx)
  --strict         Fail with non-zero exit code on warnings (e.g. brittle tests)
  --json           Output results as structured JSON
  --verbose, -v    Show detailed violation lines and warning snippets
  --help, -h       Display this help message
`);
    process.exit(0);
}

// Resolve target file
let targetFile = 'App.jsx';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
        targetFile = args[i + 1];
        break;
    }
}

if (!fs.existsSync(targetFile)) {
    console.error(`${RED}${BOLD}Error:${RESET} Target file "${targetFile}" does not exist.`);
    process.exit(1);
}

const sourceCode = fs.readFileSync(targetFile, 'utf8');
const lines = sourceCode.split('\n');

if (!isJson) {
    console.log(`\n${BOLD}${CYAN}Family Tree Code Quality Auditor${RESET}`);
    console.log(`${DIM}Target: ${targetFile} (${lines.length.toLocaleString()} lines)${RESET}\n`);
}

// ─── 1. Babel AST Parse ───────────────────────────────────────────────────────
let ast;
try {
    ast = babelParser.parse(sourceCode, { sourceType: 'module', plugins: ['jsx'] });
} catch (syntaxErr) {
    if (isJson) {
        console.log(JSON.stringify({ success: false, error: syntaxErr.message, location: syntaxErr.loc }));
    } else {
        console.error(`${RED}${BOLD}FATAL SYNTAX ERROR:${RESET} ${syntaxErr.message} at line ${syntaxErr.loc?.line}, column ${syntaxErr.loc?.column}`);
    }
    process.exit(1);
}

// ─── 2. Rule: Function Line Count Limit (<= 40 lines) ─────────────────────────
const over40Functions = [];
let totalFunctionsCount = 0;

function resolveFunctionName(pathNode) {
    const node = pathNode.node;
    if (node.id && node.id.name) return node.id.name;
    if (node.key && node.key.name) return node.key.name;

    const parent = pathNode.parent;
    if (parent) {
        if (parent.type === 'VariableDeclarator' && parent.id && parent.id.name) {
            return parent.id.name;
        }
        if (parent.type === 'AssignmentExpression' && parent.left) {
            const left = parent.left;
            if (left.type === 'MemberExpression') {
                const obj = left.object?.name || left.object?.property?.name || 'object';
                const prop = left.property?.name || 'property';
                return `${obj}.${prop}`;
            }
            if (left.name) return left.name;
        }
        if (parent.type === 'Property' && parent.key) {
            return parent.key.name || parent.key.value || 'anonymous';
        }
    }
    return 'anonymous';
}

traverse(ast, {
    Function(p) {
        totalFunctionsCount++;
        const loc = p.node.loc;
        if (!loc) return;
        const lineCount = loc.end.line - loc.start.line + 1;
        if (lineCount > 40) {
            over40Functions.push({
                name: resolveFunctionName(p),
                startLine: loc.start.line,
                endLine: loc.end.line,
                lineCount
            });
        }
    }
});

// ─── 3. Rule: JSDoc & Example Coverage ─────────────────────────────────────────
const funcRegex = /^(?:export\s+(?:default\s+)?)?(?:(?:async\s+)?function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:memo\()?(?:(?:async\s+)?function|\([^)]*\)\s*=>|\([A-Za-z0-9_, {}:]+\)\s*=>|[A-Za-z0-9_]+\s*=>))/;

const documentedEntities = [];
const missingJsDoc = [];
const fewerThan2Examples = [];
const legacyExamplesList = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(funcRegex);
    if (match) {
        const name = match[1] || match[2];
        let hasJsDoc = false;
        let exampleCount = 0;
        let hasLegacyExamples = false;
        let j = i - 1;

        while (j >= 0 && (lines[j].trim() === '' || lines[j].trim().startsWith('//'))) {
            j--;
        }

        if (j >= 0 && lines[j].trim().endsWith('*/')) {
            const commentLines = [];
            while (j >= 0) {
                commentLines.unshift(lines[j]);
                if (lines[j].trim().startsWith('/**')) {
                    hasJsDoc = true;
                    break;
                }
                if (lines[j].trim().startsWith('/*')) break;
                j--;
            }
            const commentText = commentLines.join('\n');
            const examples = commentText.match(/@example/g);
            exampleCount = examples ? examples.length : 0;
            if (commentText.includes('Examples:') || commentText.includes('Example:')) {
                hasLegacyExamples = true;
            }
        }

        const entity = {
            line: i + 1,
            name,
            hasJsDoc,
            exampleCount,
            hasLegacyExamples
        };
        documentedEntities.push(entity);

        if (!hasJsDoc) missingJsDoc.push(entity);
        else if (exampleCount < 2) fewerThan2Examples.push(entity);

        if (hasLegacyExamples) legacyExamplesList.push(entity);
    }
}

// ─── 4. Rule: Identifier Scope & Undeclared Variable Check ─────────────────────
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
    'XMLHttpRequest', 'undefined', 'Infinity', 'escape', 'atob', 'unescape', 'btoa', 'Buffer', 'AbortController'
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

// ─── 5. Warning: Brittle appCode.includes() in tests.html ──────────────────────
const brittleTests = [];
const testsPath = 'tests.html';
if (fs.existsSync(testsPath)) {
    const testsContent = fs.readFileSync(testsPath, 'utf8');
    const testLines = testsContent.split('\n');
    for (let i = 0; i < testLines.length; i++) {
        const tLine = testLines[i];
        if (tLine.includes('appCode.includes(')) {
            const labelMatch = tLine.match(/assert\(\s*['"]([^'"]+)['"]/);
            brittleTests.push({
                line: i + 1,
                label: labelMatch ? labelMatch[1] : 'Source string assertion',
                snippet: tLine.trim()
            });
        }
    }
}

// ─── Output Formatting ────────────────────────────────────────────────────────
const passedLineLimit = over40Functions.length === 0;
const passedJsDoc = missingJsDoc.length === 0 && fewerThan2Examples.length === 0 && legacyExamplesList.length === 0;
const passedScope = undeclared.size === 0;

if (isJson) {
    console.log(JSON.stringify({
        success: passedLineLimit && passedJsDoc && passedScope && (!isStrict || brittleTests.length === 0),
        stats: {
            totalLines: lines.length,
            totalFunctions: totalFunctionsCount,
            topLevelEntities: documentedEntities.length,
            over40Count: over40Functions.length,
            missingJsDocCount: missingJsDoc.length,
            fewerThan2ExamplesCount: fewerThan2Examples.length,
            undeclaredVariablesCount: undeclared.size,
            brittleTestsCount: brittleTests.length
        },
        violations: {
            over40Functions,
            missingJsDoc,
            fewerThan2Examples,
            undeclared: Object.fromEntries(undeclared),
            brittleTests
        }
    }, null, 2));
    process.exit((passedLineLimit && passedJsDoc && passedScope) ? 0 : 1);
}

// Terminal Summary Card
console.log(`${BOLD}Quality Audit Results:${RESET}`);
console.log('──────────────────────────────────────────────────────────────────');

// 1. Function Length
if (passedLineLimit) {
    console.log(`  ${GREEN}✓${RESET} Function Length: All ${totalFunctionsCount} functions/methods are <= 40 lines.`);
} else {
    console.log(`  ${RED}✗${RESET} Function Length: ${over40Functions.length} function(s) exceed 40 lines:`);
    over40Functions.forEach(f => {
        console.log(`      ${RED}•${RESET} ${BOLD}${f.name}${RESET} (${f.lineCount} lines, L${f.startLine}-${f.endLine})`);
    });
}

// 2. JSDoc Coverage
if (missingJsDoc.length === 0) {
    console.log(`  ${GREEN}✓${RESET} JSDoc Coverage: 100% (${documentedEntities.length}/${documentedEntities.length} top-level entities documented).`);
} else {
    console.log(`  ${RED}✗${RESET} JSDoc Coverage: ${missingJsDoc.length} entity/entities missing JSDoc:`);
    missingJsDoc.forEach(f => {
        console.log(`      ${RED}•${RESET} Line ${f.line}: ${BOLD}${f.name}${RESET}`);
    });
}

// 3. JSDoc Examples
if (fewerThan2Examples.length === 0 && legacyExamplesList.length === 0) {
    console.log(`  ${GREEN}✓${RESET} JSDoc Examples: All documented entities have >= 2 @example blocks.`);
} else {
    if (fewerThan2Examples.length > 0) {
        console.log(`  ${RED}✗${RESET} JSDoc Examples: ${fewerThan2Examples.length} entities have < 2 @example tags:`);
        fewerThan2Examples.forEach(f => {
            console.log(`      ${RED}•${RESET} Line ${f.line}: ${BOLD}${f.name}${RESET} (${f.exampleCount} example(s))`);
        });
    }
    if (legacyExamplesList.length > 0) {
        console.log(`  ${YELLOW}⚠${RESET} Legacy Examples Syntax: ${legacyExamplesList.length} entities have legacy "Examples:" text.`);
    }
}

// 4. Identifier Scope
if (passedScope) {
    console.log(`  ${GREEN}✓${RESET} Scope Analysis: Zero undeclared variables across all lines.`);
} else {
    console.log(`  ${RED}✗${RESET} Scope Analysis: ${undeclared.size} undeclared identifier reference(s):`);
    for (const [name, errLines] of undeclared.entries()) {
        console.log(`      ${RED}•${RESET} ${BOLD}${name}${RESET} at lines: ${errLines.join(', ')}`);
    }
}

// 5. Brittle Tests Notice
if (brittleTests.length > 0) {
    const color = isStrict ? RED : YELLOW;
    const symbol = isStrict ? '✗' : '⚠';
    console.log(`  ${color}${symbol}${RESET} Brittle Tests in tests.html: ${brittleTests.length} test(s) check exact source-code strings.`);
    if (isVerbose || isStrict) {
        brittleTests.forEach(t => {
            console.log(`      ${DIM}Line ${t.line}:${RESET} ${t.label}`);
        });
    }
} else {
    console.log(`  ${GREEN}✓${RESET} Test Resilience: Zero brittle appCode.includes() checks in tests.html.`);
}

console.log('──────────────────────────────────────────────────────────────────');

if (passedLineLimit && passedJsDoc && passedScope) {
    if (isStrict && brittleTests.length > 0) {
        console.log(`\n${RED}${BOLD}AUDIT FAILED (Strict mode):${RESET} Brittle test assertions detected.\n`);
        process.exit(1);
    }
    console.log(`\n${GREEN}${BOLD}✓ ALL CODE QUALITY RULES PASSED 100%!${RESET}\n`);
    process.exit(0);
} else {
    console.log(`\n${RED}${BOLD}AUDIT FAILED:${RESET} Please address the violations listed above.\n`);
    process.exit(1);
}
