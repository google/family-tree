#!/usr/bin/env node
/**
 * @fileoverview Golden-dataset coverage profile for the FamilyTreeBuilder business logic.
 *
 * Runs the builder on a captured fixture under V8 precise block coverage and reports, per
 * source line of `src/04_builder/03_FamilyTreeBuilder.jsx` (and the model files), how many times
 * it executed. This answers "which inference pathways does the real data actually exercise?":
 * never-executed methods/branches can be generalised or deleted with zero golden-tree risk,
 * while hot special-cases are where a refactor must be verified against the golden snapshot.
 *
 * Usage:
 *   node scripts/coverage_profile.mjs --fixture scratch/fixtures/x.json --out scratch/coverage/profile.md
 *   Options: --no-bundle   skip `node scripts/bundle.mjs`
 *            --json <p>    also dump the raw per-line counts
 *
 * Fixtures contain private family data: keep them under scratch/ (gitignored).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, execSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const fixturePath = getArg('--fixture');
const outPath = getArg('--out') || 'scratch/coverage/profile.md';
if (!fixturePath) {
    console.error('Usage: coverage_profile.mjs --fixture <rows.json> [--out <profile.md>] [--json <p>] [--no-bundle]');
    process.exit(2);
}
if (!hasFlag('--no-bundle')) execSync('node scripts/bundle.mjs', { cwd: root, stdio: 'ignore' });

// ─── Source extraction (same helpers as tree_snapshot.mjs) ──────────────────────────────────
function extractBlock(src, marker) {
    const start = src.indexOf(marker);
    if (start === -1) throw new Error(`Could not find ${marker}`);
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.substring(start, i + 1); }
    }
    throw new Error(`Could not find end of ${marker}`);
}
const extractClass = (src, name) => extractBlock(src, `class ${name} {`);
const extractConst = (src, name) => {
    const m = src.match(new RegExp(`^const ${name} = .*;$`, 'm'));
    if (!m) throw new Error(`Could not find const ${name}`);
    return m[0];
};

/** Files whose lines we want to attribute coverage to (class name → src path). */
const TRACKED = {
    CSVParser: 'src/02_utils/02_CSVParser.jsx',
    Person: 'src/03_models/01_Person.jsx',
    FamilyTree: 'src/03_models/02_FamilyTree.jsx',
    FamilyTreeBuilder: 'src/04_builder/03_FamilyTreeBuilder.jsx'
};

const app = fs.readFileSync(path.join(root, 'App.jsx'), 'utf8');
const parts = [];
const partMeta = []; // { className, srcFile, srcStartLine, sandboxStartLine, lineCount }
let sandboxLine = 1;
const pushPart = (text, meta) => {
    const lineCount = text.split('\n').length;
    if (meta) partMeta.push({ ...meta, sandboxStartLine: sandboxLine, lineCount });
    parts.push(text);
    sandboxLine += lineCount;
};
const classText = {};
for (const name of ['CSVParser', 'Person', 'FamilyTree', 'PrintTileBounds', 'PrintGridSpec', 'GhostWorkspace', 'FamilyTreeBuilder']) {
    classText[name] = extractClass(app, name);
}
const srcStartLineOf = (className) => {
    const srcPath = path.join(root, TRACKED[className]);
    const src = fs.readFileSync(srcPath, 'utf8');
    const idx = src.indexOf(`class ${className} {`);
    return src.slice(0, idx).split('\n').length;
};
for (const name of Object.keys(classText)) {
    pushPart(classText[name], TRACKED[name] ? { className: name, srcFile: TRACKED[name], srcStartLine: srcStartLineOf(name) } : null);
}
pushPart(extractBlock(app, 'const LOCATION_GEO_HIERARCHY ='));
pushPart('const SORTED_GEO_ENTRIES = Object.entries(LOCATION_GEO_HIERARCHY).sort((a, b) => b[0].length - a[0].length);');
for (const marker of ['const _matchGeoTrie =', 'const _matchSortedGeoEntries =', 'const _matchCachedGeoHierarchy =', 'const resolvePlaceHierarchy =']) {
    pushPart(extractBlock(app, marker));
}
pushPart(extractConst(app, 'DEFAULT_URL'));
pushPart('module.exports = { CSVParser, Person, FamilyTree, FamilyTreeBuilder };');

// ─── Run under V8 coverage ──────────────────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-cov-'));
const sandboxPath = path.join(tmp, 'sandbox.cjs');
fs.writeFileSync(sandboxPath, parts.join('\n'));
const runnerPath = path.join(tmp, 'run.cjs');
fs.writeFileSync(runnerPath, `
const fs = require('fs');
const { FamilyTreeBuilder, FamilyTree } = require(${JSON.stringify(sandboxPath)});
const fixture = JSON.parse(fs.readFileSync(${JSON.stringify(path.resolve(fixturePath))}, 'utf8'));
const tree = new FamilyTreeBuilder(fixture.rows.map(r => ({ ...r })), fixture.sheetTags || {}).build();
Object.values(tree.nodes).forEach(p => FamilyTree.auditPerson(p, tree));
console.log('nodes=' + Object.keys(tree.nodes).length);
`);
const covDir = path.join(tmp, 'cov');
fs.mkdirSync(covDir);
const stdout = execFileSync(process.execPath, [runnerPath], { env: { ...process.env, NODE_V8_COVERAGE: covDir }, encoding: 'utf8' });
process.stdout.write(`Build under coverage: ${stdout.trim()}\n`);

// ─── Map ranges → lines ─────────────────────────────────────────────────────────────────────
const sandboxSrc = fs.readFileSync(sandboxPath, 'utf8');
const lineStarts = [0];
for (let i = 0; i < sandboxSrc.length; i++) if (sandboxSrc[i] === '\n') lineStarts.push(i + 1);
const lineOfOffset = (off) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; }
    return lo + 1;
};
const covFile = fs.readdirSync(covDir).map(f => path.join(covDir, f))[0];
const coverage = JSON.parse(fs.readFileSync(covFile, 'utf8'));
const script = coverage.result.find(s => s.url.endsWith('sandbox.cjs'));
if (!script) throw new Error('No coverage entry for sandbox');

// Precise block coverage: nested ranges override outer ones. Apply outer→inner by sorting on span size,
// at character granularity; a line's count is the max over its non-whitespace characters so that a
// line holding both an executed statement and the start of an unexecuted block is reported as executed.
const totalLines = lineStarts.length;
const charCounts = new Int32Array(sandboxSrc.length + 1).fill(-1);
const ranges = [];
for (const fn of script.functions) for (const r of fn.ranges) ranges.push(r);
ranges.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
for (const r of ranges) charCounts.fill(r.count, r.startOffset, Math.min(r.endOffset, sandboxSrc.length));
const counts = new Array(totalLines + 1).fill(null);
const tailCounts = new Array(totalLines + 1).fill(null); // count at the line's last non-whitespace char
for (let l = 1; l <= totalLines; l++) {
    const start = lineStarts[l - 1], end = l < totalLines ? lineStarts[l] - 1 : sandboxSrc.length;
    let max = null;
    for (let i = start; i < end; i++) {
        const ch = sandboxSrc.charCodeAt(i);
        if (ch === 32 || ch === 9 || ch === 13) continue;
        const c = charCounts[i];
        if (c >= 0 && (max === null || c > max)) max = c;
        if (c >= 0) tailCounts[l] = c;
    }
    counts[l] = max;
}

// ─── Per-file, per-method report ───────────────────────────────────────────────────────────
const METHOD_RE = /^    (static\s+)?(async\s+)?(get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\((.*)\)\s*\{\s*$/;
const report = [];
const json = {};
for (const meta of partMeta) {
    const srcLines = fs.readFileSync(path.join(root, meta.srcFile), 'utf8').split('\n');
    const perLine = {};
    for (let i = 0; i < meta.lineCount; i++) {
        const sandboxL = meta.sandboxStartLine + i;
        const srcL = meta.srcStartLine + i;
        perLine[srcL] = counts[sandboxL];
    }
    json[meta.srcFile] = perLine;
    // Methods: find signature lines inside the class span, attribute the body's max count.
    const methods = [];
    const spanEnd = meta.srcStartLine + meta.lineCount - 1;
    let current = null;
    for (let l = meta.srcStartLine; l <= spanEnd; l++) {
        const m = srcLines[l - 1].match(METHOD_RE);
        if (m && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[4])) {
            if (current) current.end = l - 1;
            current = { name: (m[1] ? 'static ' : '') + m[4], start: l, end: spanEnd };
            methods.push(current);
        }
    }
    for (const mth of methods) {
        let max = 0, zeroLines = 0, codeLines = 0;
        for (let l = mth.start + 1; l <= mth.end; l++) {
            const text = srcLines[l - 1].trim();
            if (!text || text.startsWith('*') || text.startsWith('/**') || text.startsWith('//') || text === '}') continue;
            codeLines++;
            const c = perLine[l] ?? 0;
            if (c > max) max = c;
            if (c === 0) zeroLines++;
        }
        mth.calls = tailCounts[meta.sandboxStartLine + (mth.start - meta.srcStartLine)] ?? 0;
        mth.maxCount = max;
        mth.codeLines = codeLines;
        mth.uncoveredLines = zeroLines;
    }
    const never = methods.filter(m => m.maxCount === 0 && m.calls === 0);
    const partial = methods.filter(m => (m.maxCount > 0 || m.calls > 0) && m.uncoveredLines > 0);
    report.push(`## ${meta.srcFile} (class ${meta.className})`);
    report.push(`- methods: ${methods.length}, never executed on this fixture: ${never.length}, partially covered: ${partial.length}`);
    report.push('');
    report.push('### Never executed');
    report.push('| line | method | code lines |');
    report.push('|---:|---|---:|');
    never.forEach(m => report.push(`| ${m.start} | \`${m.name}\` | ${m.codeLines} |`));
    report.push('');
    report.push('### Partially covered (uncovered code lines inside executed methods)');
    report.push('| line | method | calls | uncovered / code lines | uncovered line numbers |');
    report.push('|---:|---|---:|---:|---|');
    for (const m of partial.sort((a, b) => b.uncoveredLines - a.uncoveredLines)) {
        const zero = [];
        for (let l = m.start + 1; l <= m.end; l++) {
            const text = srcLines[l - 1].trim();
            if (!text || text.startsWith('*') || text.startsWith('/**') || text.startsWith('//') || text === '}') continue;
            if ((perLine[l] ?? 0) === 0) zero.push(l);
        }
        report.push(`| ${m.start} | \`${m.name}\` | ${m.calls} | ${m.uncoveredLines} / ${m.codeLines} | ${compressRuns(zero)} |`);
    }
    report.push('');
    report.push('### Hottest methods (by entry count)');
    report.push('| line | method | calls |');
    report.push('|---:|---|---:|');
    methods.slice().sort((a, b) => b.calls - a.calls).slice(0, 25).forEach(m => report.push(`| ${m.start} | \`${m.name}\` | ${m.calls} |`));
    report.push('');
}

function compressRuns(lines) {
    if (!lines.length) return '';
    const runs = [];
    let s = lines[0], p = lines[0];
    for (const l of lines.slice(1)) {
        if (l === p + 1) { p = l; continue; }
        runs.push(s === p ? `${s}` : `${s}–${p}`);
        s = p = l;
    }
    runs.push(s === p ? `${s}` : `${s}–${p}`);
    return runs.join(', ');
}

const header = [
    `# Golden-dataset coverage profile`,
    `- fixture: ${path.basename(fixturePath)}; generated ${new Date().toISOString()}`,
    `- Counts are V8 precise block coverage of one build() + auditPerson() pass.`,
    ''
];
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header.concat(report).join('\n'));
if (getArg('--json')) fs.writeFileSync(getArg('--json'), JSON.stringify(json));
console.log(`Coverage profile written → ${outPath}`);
fs.rmSync(tmp, { recursive: true, force: true });
