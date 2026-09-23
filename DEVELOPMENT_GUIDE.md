# Family Tree Web App — Developer & Gemini Guide

This document outlines the architectural principles, testing framework, automated quality checks, and pair-programming best practices for developing the Family Tree web application.

---

## 1. Core Architectural Invariants

1. **Zero-Build Development (`index.html`)**:
   - The app runs directly in any modern browser via `http://localhost:8000/`.
   - In-browser Babel Standalone dynamically transpiles `App.jsx` with zero npm/webpack/vite build step.
   - Any architectural changes or refactoring must **never** break direct browser loading from `index.html`.

2. **Single-File Deliverable & Offline Standalone App Export**:
   - The app provides an offline export feature (`executeStandaloneAppExport`) that bundles genealogical data, assets, and source code into a single, self-contained `.html` deliverable.
   - `App.jsx` serves as the consolidated artifact read by both `index.html` and the standalone exporter.

3. **Strict Code Quality Gates**:
   - **40-Line Function Limit**: Zero functions, arrow functions, or class methods may exceed 40 lines (`loc.end - loc.start + 1 <= 40`).
   - **100% JSDoc Coverage**: All top-level functions, classes, and exported components must have JSDoc blocks (`/** ... */`).
   - **>= 2 Examples per JSDoc**: Every JSDoc block must contain at least 2 distinct `@example` tags.
   - **Zero Undeclared Variables**: Every identifier reference must resolve to a valid scope binding or recognized global.

---

## 2. Multi-Tier Automated Test Runner (`scripts/run_tests.mjs`)

The test suite validates the app across 4 progressive tiers:

| Tier / Stage | Description | Typical Latency | When to Use |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Whole-file Babel AST parse (detects syntax errors, missing braces, invalid JSX) | ~400 ms | Every run (unless `--skip-ast`) |
| **Stage 2** | AST Scope & Identifier Analysis (detects missing imports/variables) | ~800 ms | Every run (unless `--skip-ast`) |
| **Stage 3** | Algorithmic Unit Tests (`tests.html`, 2,242+ tests across 174 sections) | ~1.5 s | Every run |
| **Stage 4** | Headless Chrome E2E browser smoke test via CDP (mounts `<App />`, counts rendered cards) | ~15 s | Pre-commit / Final validation |

### CLI Usage & Flags

```bash
# 1. Fast Slice: Run only a single section during inner-loop debugging (<1s)
node scripts/run_tests.mjs --section 188
node scripts/run_tests.mjs --skip-ast --section 188

# 2. Grep Filter: Run tests matching a specific name or keyword
node scripts/run_tests.mjs --grep "Jesmi"
node scripts/run_tests.mjs --grep "Mariyama"

# 3. Fast Mode: Run Stages 1, 2, 3 for all 2,242 tests (skips Headless Chrome, ~3-4s)
node scripts/run_tests.mjs --fast

# 4. Full Quality Gate: Run all 4 stages including Headless Chrome E2E (~20s)
node scripts/run_tests.mjs --full
# or simply:
node scripts/run_tests.mjs

# 5. Fast Tests + Quality Audit:
node scripts/run_tests.mjs --fast --audit

# 6. List all available test sections with line numbers:
node scripts/run_tests.mjs --list-sections
```

---

## 3. Automated Code Quality Auditor (`scripts/audit_quality.mjs`)

Enforces the 40-line function limit, JSDoc coverage, example counts, scope integrity, and scans for brittle tests in `tests.html`.

```bash
# Standard quality audit against App.jsx (~2s):
node scripts/audit_quality.mjs

# Strict mode (fails if any brittle tests exist in tests.html):
node scripts/audit_quality.mjs --strict

# Verbose output (shows exact line numbers and warnings):
node scripts/audit_quality.mjs --verbose

# JSON output for programmatic tools/subagents:
node scripts/audit_quality.mjs --json
```

---

## 4. Gemini-Assisted Development Best Practices

To maximize speed and eliminate turn latency when working with Gemini on this app:

### 1. The TDD (Test-Driven Development) Loop
1. **Identify or Write the Test First**:
   - Add a new section at the bottom of `tests.html` (e.g. `section('189: ...')`) asserting the desired genealogical behavior with synthetic rows.
2. **Run the Fast Slice**:
   - Execute `node scripts/run_tests.mjs --skip-ast --section 189` (runs in **< 1.1s**).
   - Confirm failure as expected.
3. **Make Targeted Code Changes in `App.jsx`**:
   - Edit the specific helper or deduction function.
4. **Re-Run Fast Slice**:
   - Confirm test passes in **< 1.1s**.
5. **Run the Full Gate**:
   - Run `node scripts/run_tests.mjs --fast --audit` before wrapping up to verify zero regressions across all 2,242 tests, 0 functions > 40 lines, and complete JSDoc coverage.

### 2. Precise Prompting Template
When requesting a fix or feature, provide:
- **Person / Profile Names**: (e.g., "Kunjaagasthi, Mariyama, Kochuthresia")
- **Spreadsheet Context**: (e.g., "Ollur sheet, rows 45–50")
- **Expected vs Actual Invariant**: (e.g., "Mariyama is born ~1916 and Kochuthresia in 1922; Mariyama must sort on the left, but currently Kochuthresia sorts first because row number is used instead of effective birth year").

---

## 5. Source Architecture & Bundler (`src/` and `scripts/bundle.mjs`)

The codebase is organized into modular files under `src/` while generating `App.jsx` in < 25ms:

```
src/
├── 00_header.jsx                 # License header & React imports (16 lines)
├── 01_core/
│   ├── 01_constants.jsx          # Demographic tokens, generational gap definitions (33 lines)
│   ├── 02_DisjointSetForest.jsx  # Union-find with transactional rollback (212 lines)
│   ├── 03_GenealogicalGraph.jsx  # Graph traversal, cycle detection, reachability (362 lines)
│   └── 04_Icons.jsx              # SVG icons & DEFAULT_URL (27 lines)
├── 02_utils/
│   ├── 01_ScriptLoader.jsx       # Dynamic script loader (54 lines)
│   └── 02_CSVParser.jsx          # CSV tokenizer, headers, row mapping (355 lines)
├── 03_models/
│   ├── 01_Person.jsx             # Person model, attributes, dates, relations (642 lines)
│   └── 02_FamilyTree.jsx         # Family tree model, layout algorithms, contours (4,046 lines)
├── 04_builder/
│   ├── 01_InvariantAuditor.jsx   # Graph integrity & anomaly auditor (50 lines)
│   ├── 02_FamilyTreePipeline.jsx # Declarative 5-phase construction pipeline (48 lines)
│   └── 03_FamilyTreeBuilder.jsx  # Demographic inference & candidate deduplication (15,879 lines)
├── 05_hooks/
│   ├── 01_TreeDataCache.jsx      # Client-side cache & parallel CSV fetcher (1,518 lines)
│   ├── 02_useAppLogs.jsx         # Tree audit & crawl logging hooks (507 lines)
│   ├── 03_useAncestryData.jsx    # Sheet crawler & tree lifecycle state hook (1,082 lines)
│   └── 04_useCanvasControls.jsx  # Wheel zoom, pinch, pan, camera clamping & framing (1,077 lines)
├── 06_ui/
│   ├── 01_theme.jsx              # UI theme metrics & card color schemes (285 lines)
│   ├── 02_IntervalContour.jsx    # 2D Interval Profile Contour compaction (186 lines)
│   ├── 03_CompactTreeView.jsx    # Tree canvas cards & SVG connectors (2,229 lines)
│   ├── 04_AIAssistant.jsx        # Gemini AI Assistant drawer, settings & messages (2,837 lines)
│   ├── 05_OmniSearch.jsx         # Global Cmd+K quick actions & search cards (524 lines)
│   ├── 06_FilteredListView.jsx   # Filtered persons list & attribute chips (974 lines)
│   ├── 07_PersonSidebar.jsx      # Slide-over person details & relationship panels (698 lines)
│   ├── 08_QuickDirectory.jsx     # Places, Careers, and Families directory hierarchy (3,666 lines)
│   ├── 09_FamilyMapView.jsx      # Leaflet geographic map view & pins (704 lines)
│   ├── 10_TopNavigation.jsx      # Navbar, search trigger & action buttons (1,066 lines)
│   └── 11_CanvasViewport.jsx     # Canvas gestures, timeline labels & generation grid (4,296 lines)
└── 07_app/
    └── 01_App.jsx                # Main root App component (406 lines)
```

### Bundler Commands
```bash
# Bundle src/ -> App.jsx (<25ms)
node scripts/bundle.mjs

# Verify App.jsx is in sync with src/
node scripts/bundle.mjs --check

# Watch src/ and auto-rebuild App.jsx on save
node scripts/bundle.mjs --watch
```
*Note: `node scripts/run_tests.mjs` automatically executes `bundle.mjs` on every test run, so edits in `src/` are instantly and transparently reflected.*

---

## 6. Architectural Refactoring Roadmap

### Pillar B: Decouple Brittle Code-String Tests in `tests.html`
- **Goal**: 153 tests in `tests.html` currently assert on exact source-code strings (e.g. `appCode.includes(...)`).
- **Refactoring**: Migrate these tests to behavioral input/output assertions.
  - *Before*: `assert('Test 147B', appCode.includes("cNode.momId = anchorNode.id..."))`
  - *After*: Call `FamilyTreeBuilder._expandChildSpouseCompound` with test rows and assert that `cNode.momId` matches the anchor ID.
- **Result**: Eliminates false-positive test failures during refactoring, freeing developers from arbitrary indentation and naming constraints.

### Pillar C: Declarative Demographic Rules Catalog
- **Goal**: Consolidate scattered generational heuristics into a single typed constant object:
  ```javascript
  export const DEMOGRAPHIC_RULES = Object.freeze({
      SPOUSAL_GENDER_OFFSET: 2,         // Husband inferred >= wife birth year + 2
      MIN_BIOLOGICAL_PARENT_GAP: 15,    // Youngest biological parent age
      MAX_BIOLOGICAL_MOTHER_GAP: 50,    // Oldest biological mother age
      MAX_BIOLOGICAL_FATHER_GAP: 70,    // Oldest biological father age
      DEFAULT_GENERATION_GAP: 25,       // Default child-to-parent gap
      CENTENARIAN_LIFESPAN_CAP: 100,    // Deceased inference threshold
      MAX_CONVERGENCE_PASSES: 30        // Safety convergence cap
  });
  ```
- **Result**: Simplifies demographic tuning without modifying complex procedural loops.
