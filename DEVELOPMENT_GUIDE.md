# Family Tree Web App — Developer & Architecture Guide

This document details the modular architecture, interactive UI systems, genealogical inference pipeline, multi-stage testing framework, and automated quality gates for developing the Family Tree web application.

For end-user feature documentation, button references, and Google Sheets formatting examples, see [README.md](README.md).

---

## 1. Core Architectural Invariants

1. **Zero-Build Browser Execution (`index.html` + `App.jsx`)**:
   - The application runs directly in any modern browser via `http://localhost:8000/` or GitHub Pages (`https://google.github.io/family-tree/`).
   - In-browser Babel Standalone transpiles `App.jsx` on the fly with zero webpack/vite runtime dependencies.
   - Developers edit modular files under `src/` and run `node scripts/bundle.mjs` (or `node scripts/run_tests.mjs`, which bundles automatically) to produce the consolidated `App.jsx` artifact.

2. **Single-File Deliverable & Offline Standalone App Export**:
   - `executeStandaloneAppExport` embeds the active lineage dataset, styles, and `App.jsx` source code into a single self-contained `.html` file that works 100% offline.

3. **Strict Code Quality Gates (`scripts/audit_quality.mjs`)**:
   - **40-Line Function Limit**: Every function declaration, function expression, arrow component, and class method in `App.jsx` must be `<= 40` lines (`loc.end.line - loc.start.line + 1 <= 40`).
   - **100% JSDoc Coverage**: Every top-level function, component, and class must have a JSDoc comment block (`/** ... */`).
   - **>= 2 `@example` Blocks per JSDoc**: Every JSDoc comment must contain at least 2 distinct `@example` tags (and no legacy `Example:` / `Examples:` prose).
   - **Zero Undeclared Variables**: AST scope analysis (`@babel/traverse`) verifies that every identifier resolves to a declared binding or whitelisted browser global.

---

## 2. Interactive Rich-Text Button Documentation System

Every `<button>` across the UI displays a rich-text documentation popover with usage examples when hovered (`src/06_ui/10_TopNavigation.jsx`).

### Architecture & Key Functions

1. **`BUTTON_DOCUMENTATION_CATALOG`**:
   - Central dictionary mapping button titles/keys (e.g., `'Import Google Sheet from Clipboard URL'`, `'Zoom In'`, `'Expand Children'`, `'Ask AI'`) to structured documentation entries:
     ```javascript
     {
         title: 'Zoom In Canvas',
         badge: 'Camera • Magnify (+)',
         summary: 'Increases **canvas magnification** (`1.3x` per step) around the viewport center...',
         examples: [
             { label: 'Read Detailed Card Badges', detail: 'Click **Zoom In** (or scroll up) to read nicknames...' },
             { label: 'Dense Cohort Inspection', detail: 'Magnify large 8+ sibling families...' }
         ]
     }
     ```
2. **`resolveButtonDocumentation(docKey, buttonText)`**:
   - Resolves exact matches from `BUTTON_DOCUMENTATION_CATALOG`, dynamic filter prefixes via `resolveDynamicFilterButtonDoc` (`Filter by Family: <X>`, `Filter by Location: <X>`, `Filter by Career: <X>`), and contextual labels via `resolveContextualButtonDoc` (`Locations (42)`, `Rule`, `AI`, `Hide Directory`, etc.).
3. **`renderRichDocText(text)`**:
   - Parses lightweight markdown tokens (`**bold**` and `` `inline code` ``) into styled `<strong>` and `<code>` React elements inside the popover.
4. **`buildHoveredButtonDocState(btn)` & `restoreButtonNativeTitle(btn)`**:
   - When a user hovers over a `<button>`, `buildHoveredButtonDocState` stashes any native `title` attribute into `data-orig-title` and removes `title` while hovered so the browser's plain-text native tooltip never overlaps the rich-text popover. When the pointer leaves (`restoreButtonNativeTitle`), the `title` attribute is restored cleanly.
5. **`computeButtonDocPosition(rect, viewportW, viewportH)` & `<ButtonDocTooltipOverlay />`**:
   - Places the `340px` popover card below top-bar buttons or above bottom-bar buttons and clamps horizontal/vertical coordinates within viewport margins (`12px`).

---

## 3. Dynamic URL Query Parameter Loading (`?id=...`)

`resolveInitialSheetUrl(searchStr)` in `src/06_ui/11_CanvasViewport.jsx` inspects `window.location.search` on startup so users can open any root Google Sheet via URL parameters:

```javascript
// Example 1: Passing a Google Spreadsheet ID via ?id=
resolveInitialSheetUrl('?id=1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI');
// => 'https://docs.google.com/spreadsheets/d/1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI/edit'

// Example 2: Passing a full URL via ?url=
resolveInitialSheetUrl('?url=https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
// => 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
```

During bootstrap (`initializeTreeDataset`), if the resolved startup URL differs from `DEFAULT_URL` and its spreadsheet ID does not match the cached local tree, the app automatically triggers `handleImport(initialUrl, false, true)` to fetch the requested sheet live.

### 3.1 Shareable View State Hash (`#p=…&z=…&c=…`) — `src/06_ui/12_UrlViewState.jsx`

The query string selects *which* spreadsheet is loaded; the hash fragment captures *what the user is looking at* (Google-Maps style). `useUrlViewStateSync({ ...core, ...viewport, ...focusNav })` is mounted once from `useAppViewModel()` in `src/07_app/01_App.jsx` and does two jobs: it restores the view described by the initial hash after the dataset is ready, and it mirrors every later UI change back into the address bar with `history.replaceState` (no reload, no extra history entries).

| Key | State field | Encoder / Decoder | Sample |
| :--- | :--- | :--- | :--- |
| `p=` | `focusId` (person ID `<Name>_<YOB>_<row>`) | `encodeViewStateToken` / `decodeViewStateToken` (percent-encoding, spaces as `+`) | `p=Joseph_1920_152` |
| `s=0` | `isSidebarVisible === false` while a person is focused | `encodeSelectionHashParts` | `p=Joseph_1920_152&s=0` |
| `f=` | `activeFilter` as `<filterType>:<value>` (`place`, `job`, `family`, `search`, `directory`) | `parseViewStateFilterToken` | `f=place:New+York` |
| `v=map` | `showMap` | `encodeSelectionHashParts` | `v=map&f=place:Chalissery` |
| `z=` | `camera.z` (2 decimals via `formatCompactNumber`) | `applyViewStateHashEntry` | `z=0.8` |
| `c=` | Visible-viewport centre `<treeX>,<year>` | `computeViewCenterFromCamera` / `computeCameraFromViewCenter` | `c=1240,1953.5` |
| `k=` | `collapsedNodes` IDs, comma separated | `encodeSelectionHashParts` | `k=Antu_1931_12,Elsy_1935_13` |

```javascript
// Example 1: Encoding is lossless and only emits non-default keys (short URLs)
encodeViewStateHash({ focusId: 'Joseph_1920_152', isSidebarVisible: true, zoom: 0.8, center: { x: 1240, year: 1953.5 } });
// => 'p=Joseph_1920_152&z=0.8&c=1240,1953.5'
encodeViewStateHash({ showMap: true, activeFilter: { filterType: 'place', value: 'New York' } });
// => 'v=map&f=place:New+York'

// Example 2: Parsing tolerates hand-edited URLs (unknown keys and bad numbers are dropped)
parseViewStateHash('#p=Joseph_1920_152&s=0&z=abc&c=1240,1953.5&foo=bar');
// => { focusId: 'Joseph_1920_152', isSidebarVisible: false, center: { x: 1240, year: 1953.5 } }
```

**Screen-independent camera model.** The canvas transform is `screenX = treeX * z + camera.x` and `screenY = ((year - rootNodeYob) * ppy + 24) * z + camera.y`. The horizontal layout depends only on the zoom level, so `c=` stores the tree x-coordinate in unscaled pixels; the vertical scale (`ppy`, pixels-per-year) stretches with the window height, so the vertical position is stored as a calendar **year**. The "centre" is the middle of the canvas area that is actually visible — `measureViewStateViewport` subtracts the open sidebar width (the sidebar overlays the canvas) and `computeViewCenterFromCamera` offsets by the `48px` timeline gutter:

```javascript
// Example 1: camera -> URL centre on a 1048px-wide visible canvas
computeViewCenterFromCamera({ camera: { x: -600, y: -200, z: 1 }, ppy: 10, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800 });
// => { x: 1148, year: 1957.6 }

// Example 2: URL centre -> camera on the receiving screen (exact inverse, then clampCamera())
computeCameraFromViewCenter({ center: { x: 1148, year: 1957.6 }, zoom: 1, ppy: 10, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800 });
// => { x: -600, y: -200, z: 1 }
```

**Restore timing (`useUrlViewStateRestore` → `scheduleViewStateRestore`).** The hash is parsed exactly once at mount; the restore effect fires once `tree.rootId && !isLoading` (i.e. after the cache-then-live double load and after `applyImportSuccessFocus` has reset focus/filter), then runs in two phases so it never fights the app's own startup animations:

1. **`+350 ms` — selection** (`applyRestoredSelection`): map (`setShowMap(true)` + the same sidebar/filter/focus resets as the Map button), else filter via the real `handleFilterBy(type, value)`, else focus via `handleSetFocusId(id)` (so navigation history and re-rooting behave like a click) followed by `setIsSidebarVisible(false)` when `s=0`; finally `setCollapsedNodes(new Set(validIds))`. Person IDs are resolved with `resolveViewStatePersonId`, which falls back to a `<Name>_<YOB>_` prefix match so links survive spreadsheet row insertions.
2. **`+1000 ms` — camera** (`applyRestoredCamera`): after `centerOnPerson`'s own animation has settled, the stored centre is converted back with *this* screen's `getPpy(zoom)` and the visible width predicted by `resolveRestoredSidebarOpen(state)`, then `setCamera(clampCamera(next))`. Skipped entirely for `v=map`.

**Write rules (`useUrlViewStateWriter`).** Writes are enabled only after the restore completes (`phaseRef.current.writable`), debounced `300 ms`, and suppressed while `isLoading`, `isDragging`, or `isShifting` (live-sync camera shifts), so the address bar always contains a stable, copy-ready URL. `writeViewStateHash` is a no-op when the hash is unchanged and swallows any `SecurityError` a browser may raise from `replaceState` on `file://` standalone exports. In map view the `z=`/`c=` keys are omitted because the Leaflet camera is not part of the tree view state.

`tests.html` Section 205 ("Shareable URL View State") covers the encode/parse round trip, URL-safety of separators, the camera ↔ centre inverse pair, prefix-fallback person resolution, selection/camera application order against stubbed handlers, and `replaceState` behaviour; run it with `node scripts/run_tests.mjs --skip-ast --section 205`.

---

## 4. Multi-Tier Automated Test Runner (`scripts/run_tests.mjs`)

The test suite validates the application across 4 progressive stages:

| Tier / Stage | Description | Typical Latency | When to Use |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Whole-file Babel AST parse (detects syntax errors, missing braces, invalid JSX) | ~400 ms | Every run (unless `--skip-ast`) |
| **Stage 2** | AST Scope & Identifier Analysis (detects undeclared variables/globals) | ~800 ms | Every run (unless `--skip-ast`) |
| **Stage 3** | Algorithmic Unit Tests (`tests.html`, 2,680+ assertions across 205 sections) | ~1.5 s | Every run |
| **Stage 4** | Headless Chrome E2E browser smoke test via CDP (mounts `<App />`, verifies rendered person cards) | ~12 s | Pre-commit / Final validation |

### CLI Usage Examples

```bash
# 1. Fast Slice: Run only a single section during inner-loop debugging (<1s)
node scripts/run_tests.mjs --skip-ast --section 204

# 2. Grep Filter: Run tests matching a specific keyword
node scripts/run_tests.mjs --grep "Button Hover"

# 3. Fast Mode: Run Stages 1, 2, 3 for all 2,680+ unit tests (~3s)
node scripts/run_tests.mjs --fast

# 4. Full Quality Gate: Run all 4 stages including Headless Chrome E2E (~15s)
node scripts/run_tests.mjs

# 5. Code Quality Audit (<= 40 lines, 100% JSDoc, >= 2 @example tags, 0 undeclared vars)
node scripts/audit_quality.mjs
```

---

## 5. Source Architecture & Bundler (`src/` and `scripts/bundle.mjs`)

The codebase is organized into 37 modular files across 7 numbered directories under `src/`:

```text
src/
├── 00_header.jsx                 # License header & React hook imports
├── 01_core/
│   ├── 01_constants.jsx          # Demographic tokens, generational gap constants
│   ├── 02_DisjointSetForest.jsx  # Union-find with transactional snapshot/rollback
│   ├── 03_GenealogicalGraph.jsx  # Graph traversal, cycle detection, ancestor/descendant queries
│   └── 04_Icons.jsx              # Vector SVG icons & DEFAULT_URL constant
├── 02_utils/
│   ├── 01_ScriptLoader.jsx       # Dynamic external script/stylesheet loader
│   └── 02_CSVParser.jsx          # Multi-line CSV tokenizer, header detector, row mapper
├── 03_models/
│   ├── 01_Person.jsx             # Person domain model, lifespan badges, relative sorting
│   └── 02_FamilyTree.jsx         # FamilyTree graph, 2D IntervalContour layout, SVG/A4 print composer
├── 04_builder/
│   ├── 01_InvariantAuditor.jsx   # Graph integrity & biological anomaly auditor
│   ├── 02_FamilyTreePipeline.jsx # Declarative 5-phase construction pipeline
│   └── 03_FamilyTreeBuilder.jsx  # Entity resolution, ghost synthesis, YOB/gender/death deduction
├── 05_hooks/
│   ├── 01_TreeDataCache.jsx      # LocalStorage/embedded cache & parallel multi-sheet CSV crawler
│   ├── 02_useAppLogs.jsx         # Audit & ingestion log formatters and state hooks
│   ├── 03_useAncestryData.jsx    # Sheet crawler orchestration & live background sync
│   └── 04_useCanvasControls.jsx  # Wheel zoom, two-finger pinch, pan, camera clamping & framing
├── 06_ui/
│   ├── 01_theme.jsx              # Card color schemes, PersonCollapseButton, ZoomControls
│   ├── 02_IntervalContour.jsx    # 2D horizontal interval profile contour compaction
│   ├── 03_CompactTreeView.jsx    # PersonNode cards, marital bridges & bus-bar SVG connectors
│   ├── 04_AIAssistant.jsx        # Deterministic GenealogyEngine + Gemini LLM assistant & settings
│   ├── 05_OmniSearch.jsx         # Cmd+K OmniSearch classification & quick action shortcuts
│   ├── 06_FilteredListView.jsx   # Filtered member list & category attribute chips
│   ├── 07_PersonSidebar.jsx      # Resizable slide-over person biography, relatives & log drawer
│   ├── 08_QuickDirectory.jsx     # Hierarchical Locations, Careers, and Families browser
│   ├── 09_FamilyMapView.jsx      # Interactive Leaflet map view, custom pins & bottom controls
│   ├── 10_TopNavigation.jsx      # Floating navbar, OmniSearch bar & ButtonDocTooltipOverlay
│   ├── 11_CanvasViewport.jsx     # Main canvas viewport, timeline cohorts & URL sheet resolution
│   └── 12_UrlViewState.jsx       # Shareable #hash view state: encode/parse, restore & replaceState writer
└── 07_app/
    └── 01_App.jsx                # Root <App /> view model and layout shell
```

---

## 6. Deploying Updates to GitHub Pages (`./push.sh`)

The repository includes an automated deployment script `push.sh` that:
1. Runs `node scripts/bundle.mjs` to ensure `App.jsx` is freshly built from `src/`.
2. Ensures `.nojekyll` is present so GitHub Pages serves all static files without Jekyll preprocessing.
3. Syncs the workspace files (`index.html`, `App.jsx`, `src/`, `scripts/`, `tests.html`, `README.md`, `DEVELOPMENT_GUIDE.md`, etc.) to the local Git repository at `~/.family-tree-github`.
4. Commits and pushes to `origin/main` on `https://github.com/google/family-tree`.

### Examples

```bash
# Deploy with an automatic timestamped commit message
./push.sh

# Deploy with an explicit commit description
./push.sh "Add rich-text button hover documentation popovers and expand markdown guides"
```
