#!/usr/bin/env node
/**
 * @fileoverview Golden-tree snapshot & diff tool for the FamilyTreeBuilder business logic.
 *
 * Builds a FamilyTree in node from a captured row fixture (see capture_sheet_rows.mjs),
 * serialises it into a canonical, id-independent JSON snapshot, and diffs snapshots.
 * Node ids are NOT stable across logic changes (ghost counters), so every node is keyed by
 * a semantic label: `[~]name|bestYob|sheetTag:row[#n]` (`~` marks ghosts, `#n` breaks ties).
 *
 * Usage:
 *   node scripts/tree_snapshot.mjs --fixture scratch/fixtures/x.json --out scratch/snapshots/baseline.json
 *   node scripts/tree_snapshot.mjs --fixture scratch/fixtures/x.json --compare-with scratch/snapshots/baseline.json
 *   node scripts/tree_snapshot.mjs --compare a.json b.json
 *   Options: --no-bundle (skip `node scripts/bundle.mjs`), --verbose (print every field change)
 *
 * Exit code is 1 whenever a comparison finds differences, so it can gate refactors.
 * Fixtures/snapshots contain private family data: keep them under scratch/ (gitignored).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

// ─── Source extraction (mirrors the tests.html sandbox helpers) ─────────────────────────────
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

/** Evaluates the model + builder classes out of App.jsx and returns them. */
function loadBuilderSandbox(appPath) {
    const source = fs.readFileSync(appPath, 'utf8');
    const parts = [
        extractClass(source, 'CSVParser'),
        extractClass(source, 'Person'),
        extractClass(source, 'FamilyTree'),
        extractClass(source, 'PrintTileBounds'),
        extractClass(source, 'PrintGridSpec'),
        extractClass(source, 'GhostWorkspace'),
        extractClass(source, 'FamilyTreeBuilder'),
        extractBlock(source, 'const LOCATION_GEO_HIERARCHY ='),
        'const SORTED_GEO_ENTRIES = Object.entries(LOCATION_GEO_HIERARCHY).sort((a, b) => b[0].length - a[0].length);',
        extractBlock(source, 'const _matchGeoTrie ='),
        extractBlock(source, 'const _matchSortedGeoEntries ='),
        extractBlock(source, 'const _matchCachedGeoHierarchy ='),
        extractBlock(source, 'const resolvePlaceHierarchy ='),
        extractConst(source, 'DEFAULT_URL'),
        'return { CSVParser, Person, FamilyTree, FamilyTreeBuilder };'
    ];
    return new Function(parts.join('\n'))();
}

// ─── Canonical snapshot ─────────────────────────────────────────────────────────────────────
const SHORT_ID_LENGTH = 30; // `_sourceId` is a 30-char prefix of the sheet id.

/** Maps a (possibly truncated) sheet id to its human tag. */
function sheetTagFor(sourceId, sheetTags) {
    if (!sourceId) return '?';
    const full = Object.keys(sheetTags || {}).find(id => id === sourceId || id.startsWith(sourceId));
    return full ? sheetTags[full] : String(sourceId).slice(0, 8);
}

/** Provenance string like `Deepa:12` (or `Deepa:12+Ollur:40` for merged rows). */
function provenanceOf(p, sheetTags) {
    let rows = p._sheetRows;
    if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = null; } }
    if (rows && typeof rows === 'object' && Object.keys(rows).length > 0) {
        return Object.entries(rows)
            .map(([sid, row]) => `${sheetTagFor(sid, sheetTags)}:${row}`)
            .sort()
            .join('+');
    }
    const row = (p._sheetRow !== undefined && p._sheetRow !== null) ? p._sheetRow : '?';
    return `${sheetTagFor(p._sourceId, sheetTags)}:${row}`;
}

/** Secondary sort key so `#n` tie-break suffixes are deterministic without ids. */
function tieBreakKey(p, nodes) {
    const nameOf = (id) => (nodes.get(id) || {}).name || '';
    return [
        p.gender || '', nameOf(p.fatherId), nameOf(p.momId),
        (p.partners || []).map(nameOf).join(','),
        (p.children || []).map(nameOf).join(','),
        p.place || '', p.job || ''
    ].join('|');
}

/** Assigns a unique semantic label to every node id. */
function labelNodes(tree, sheetTags) {
    const nodes = tree.nodes instanceof Map ? tree.nodes : new Map(Object.entries(tree.nodes));
    const base = new Map();
    for (const [id, p] of nodes) {
        const label = `${p.isGhost ? '~' : ''}${p.name || '?'}|${p.bestYob}|${provenanceOf(p, sheetTags)}`;
        if (!base.has(label)) base.set(label, []);
        base.get(label).push(id);
    }
    const labelOf = new Map();
    for (const [label, ids] of base) {
        if (ids.length === 1) { labelOf.set(ids[0], label); continue; }
        ids.sort((a, b) => tieBreakKey(nodes.get(a), nodes).localeCompare(tieBreakKey(nodes.get(b), nodes)));
        ids.forEach((id, i) => labelOf.set(id, `${label}#${i + 1}`));
    }
    return { nodes, labelOf };
}

/** Audit issue texts with volatile node ids rewritten to labels. */
function auditTexts(p, tree, FamilyTree, labelOf) {
    let issues = [];
    try { issues = FamilyTree.auditPerson(p, tree) || []; } catch (e) { return [`audit-error: ${e.message}`]; }
    const ids = [...labelOf.keys()].sort((a, b) => b.length - a.length);
    return issues.map(i => {
        let text = `${i.type}${i.category ? `/${i.category}` : ''}: ${i.text || ''}`;
        for (const id of ids) if (text.includes(id)) text = text.split(id).join(`<${labelOf.get(id)}>`);
        return text;
    }).sort();
}

/** Ordered reachable set from the root through children + partners (what the UI renders). */
function reachableFromRoot(tree, nodes) {
    const seen = new Set();
    const stack = tree.rootId ? [tree.rootId] : [];
    while (stack.length) {
        const id = stack.pop();
        if (!id || seen.has(id) || !nodes.has(id)) continue;
        seen.add(id);
        const p = nodes.get(id);
        for (const c of (p.children || [])) stack.push(c);
        for (const q of (p.partners || [])) stack.push(q);
    }
    return seen;
}

/** Undirected connected components; each node maps to the label of its component's oldest member. */
function componentLabels(nodes, labelOf) {
    const componentOf = new Map();
    const sizes = {};
    const neighbours = (p) => [p.momId, p.fatherId, ...(p.partners || []), ...(p.children || [])].filter(id => id && nodes.has(id));
    for (const startId of nodes.keys()) {
        if (componentOf.has(startId)) continue;
        const members = [];
        const stack = [startId];
        const seen = new Set([startId]);
        while (stack.length) {
            const id = stack.pop();
            members.push(id);
            for (const n of neighbours(nodes.get(id))) if (!seen.has(n)) { seen.add(n); stack.push(n); }
        }
        members.sort((a, b) => (Number(nodes.get(a).bestYob) - Number(nodes.get(b).bestYob)) || labelOf.get(a).localeCompare(labelOf.get(b)));
        const key = labelOf.get(members[0]);
        members.forEach(id => componentOf.set(id, key));
        sizes[key] = members.length;
    }
    return { componentOf, sizes };
}

/** Builds the canonical snapshot object for a tree. */
function snapshotTree(tree, sheetTags, { FamilyTree }) {
    const { nodes, labelOf } = labelNodes(tree, sheetTags);
    const L = (id) => (id ? (labelOf.get(id) || `<unknown:${id}>`) : null);
    const reachable = reachableFromRoot(tree, nodes);
    const { componentOf, sizes } = componentLabels(nodes, labelOf);
    const out = {};
    for (const [id, p] of nodes) {
        out[labelOf.get(id)] = {
            name: p.name || null,
            nick: p.nick || null,
            gender: p.gender || null,
            yob: p.yob || null,
            inferredYob: p._inferredYob || null,
            death: p.death || null,
            age: p.age || null,
            place: p.place || null,
            job: p.job || null,
            ghost: !!p.isGhost,
            celibate: !!p.isCelibate,
            spouseType: p.spouseType || null,
            mom: L(p.momId),
            father: L(p.fatherId),
            partners: (p.partners || []).map(L),
            children: (p.children || []).map(L),
            ambiguities: (p.ambiguities || []).map(a => (typeof a === 'string' ? a : JSON.stringify(a))).sort(),
            reachable: reachable.has(id),
            component: componentOf.get(id),
            audit: auditTexts(p, tree, FamilyTree, labelOf)
        };
    }
    const all = Object.values(out);
    const summary = {
        nodes: all.length,
        ghosts: all.filter(n => n.ghost).length,
        reachableFromRoot: reachable.size,
        root: L(tree.rootId),
        components: Object.fromEntries(Object.entries(sizes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
        parentEdges: all.reduce((s, n) => s + (n.mom ? 1 : 0) + (n.father ? 1 : 0), 0),
        partnerEdges: all.reduce((s, n) => s + n.partners.length, 0) / 2,
        genders: { M: all.filter(n => n.gender === 'M').length, F: all.filter(n => n.gender === 'F').length,
            unknown: all.filter(n => !n.gender).length },
        explicitYob: all.filter(n => n.yob).length,
        inferredYob: all.filter(n => !n.yob && n.inferredYob).length,
        auditIssues: all.reduce((s, n) => s + n.audit.length, 0)
    };
    const sorted = {};
    for (const k of Object.keys(out).sort()) sorted[k] = out[k];
    return { summary, nodes: sorted };
}

// ─── Diff ───────────────────────────────────────────────────────────────────────────────────
function diffSnapshots(a, b, verbose) {
    const lines = [];
    const keysA = new Set(Object.keys(a.nodes)), keysB = new Set(Object.keys(b.nodes));
    const removed = [...keysA].filter(k => !keysB.has(k));
    const added = [...keysB].filter(k => !keysA.has(k));
    const changed = [];
    for (const k of keysA) {
        if (!keysB.has(k)) continue;
        const fields = Object.keys({ ...a.nodes[k], ...b.nodes[k] })
            .filter(f => JSON.stringify(a.nodes[k][f]) !== JSON.stringify(b.nodes[k][f]));
        if (fields.length) changed.push({ k, fields });
    }
    for (const f of Object.keys({ ...a.summary, ...b.summary })) {
        if (JSON.stringify(a.summary[f]) !== JSON.stringify(b.summary[f])) {
            lines.push(`summary.${f}: ${JSON.stringify(a.summary[f])} → ${JSON.stringify(b.summary[f])}`);
        }
    }
    removed.forEach(k => lines.push(`- removed node ${k}`));
    added.forEach(k => lines.push(`+ added node ${k}`));
    const limit = verbose ? Infinity : 60;
    changed.slice(0, limit).forEach(({ k, fields }) => {
        lines.push(`~ ${k}`);
        fields.forEach(f => lines.push(`    ${f}: ${JSON.stringify(a.nodes[k][f])} → ${JSON.stringify(b.nodes[k][f])}`));
    });
    if (changed.length > limit) lines.push(`… ${changed.length - limit} more changed nodes (use --verbose)`);
    return { lines, total: removed.length + added.length + changed.length + (lines.length ? 1 : 0) };
}

function report(label, lines) {
    if (!lines.length) { console.log(`✓ ${label}: identical`); return 0; }
    console.log(`✗ ${label}: ${lines.length} difference line(s)`);
    lines.forEach(l => console.log('  ' + l));
    return 1;
}

// ─── Main ───────────────────────────────────────────────────────────────────────────────────
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const compare = hasFlag('--compare') ? args.slice(args.indexOf('--compare') + 1, args.indexOf('--compare') + 3) : null;
if (compare && compare.length === 2) {
    const a = JSON.parse(fs.readFileSync(compare[0], 'utf8'));
    const b = JSON.parse(fs.readFileSync(compare[1], 'utf8'));
    process.exit(report(`${compare[0]} vs ${compare[1]}`, diffSnapshots(a, b, hasFlag('--verbose')).lines));
}

const fixturePath = getArg('--fixture');
if (!fixturePath) {
    console.error('Usage: tree_snapshot.mjs --fixture <rows.json> [--out <snap.json>] [--compare-with <snap.json>] | --compare <a> <b>');
    process.exit(2);
}
if (!hasFlag('--no-bundle')) execSync('node scripts/bundle.mjs', { cwd: root, stdio: 'ignore' });
const sandbox = loadBuilderSandbox(path.join(root, 'App.jsx'));
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const rows = fixture.rows.map(r => ({ ...r }));
const t0 = Date.now();
const tree = new sandbox.FamilyTreeBuilder(rows, fixture.sheetTags || {}).build();
const snap = snapshotTree(tree, fixture.sheetTags || {}, sandbox);
snap.meta = { fixture: path.basename(fixturePath), sheetId: fixture.sheetId, rows: fixture.rows.length,
    builtInMs: Date.now() - t0, createdAt: new Date().toISOString() };
console.log(`Built tree: ${snap.summary.nodes} nodes (${snap.summary.ghosts} ghosts), root=${snap.summary.root}, ` +
    `reachable=${snap.summary.reachableFromRoot}, audit issues=${snap.summary.auditIssues}, ${snap.meta.builtInMs}ms`);

let exitCode = 0;
const outPath = getArg('--out');
if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(snap, null, 1));
    console.log(`Snapshot written → ${outPath}`);
}
const compareWith = getArg('--compare-with');
if (compareWith) {
    const baseline = JSON.parse(fs.readFileSync(compareWith, 'utf8'));
    exitCode = report(`baseline ${compareWith} vs current`, diffSnapshots(baseline, snap, hasFlag('--verbose')).lines);
}
process.exit(exitCode);
