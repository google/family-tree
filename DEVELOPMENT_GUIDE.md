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

## 2. Speech-Balloon Button Hover Help System

Every `<button>` across the UI displays a speech-balloon rich-text documentation popover (`data-testid="button-doc-popover"`) with a directional pointer tail (`data-testid="button-doc-tail"`) and usage examples when hovered (`src/06_ui/10_TopNavigation.jsx`).

### Architecture & Key Functions

1. **`BUTTON_DOCUMENTATION_CATALOG`**:
   - Central dictionary mapping button titles/keys (e.g., `'Settings – themes, deduction rules & privacy'`, `'Colour theme (Material 3 palettes)'`, `'Zoom In'`, `'Expand Children'`, `'Ask AI'`) to structured documentation entries:
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
   - Resolves exact matches from `BUTTON_DOCUMENTATION_CATALOG`, dynamic filter prefixes via `resolveDynamicFilterButtonDoc` (`Filter by Family: <X>`, `Filter by Location: <X>`, `Filter by Career: <X>`), Material 3 theme cards via `resolveThemeCardDoc` (`Colour theme: <Name>`), and contextual labels via `resolveContextualButtonDoc` (`Locations (42)`, `Rule`, `AI`, `Hide Directory`, etc.). Generic fallback entries use the full button label as `title` without any `"Select / Toggle: "` prefix.
3. **`renderRichDocText(text)`**:
   - Parses lightweight markdown tokens (`**bold**` and `` `inline code` ``) into styled `<strong>` and `<code>` React elements inside the popover.
4. **`buildHoveredButtonDocState(btn)` & `restoreButtonNativeTitle(btn)`**:
   - When a user hovers over a `<button>`, `buildHoveredButtonDocState` stashes any native `title` attribute into `data-orig-title` and removes `title` while hovered so the browser's plain-text native tooltip never overlaps the rich-text popover. When the pointer leaves (`restoreButtonNativeTitle`), the `title` attribute is restored cleanly.
5. **`computeButtonDocPosition(rect, viewportW, viewportH)`, `<ButtonDocBalloonTail />` & `<ButtonDocTooltipOverlay />`**:
   - Places the `340px` speech-balloon card below top-half buttons or above bottom-half buttons, clamps horizontal/vertical coordinates within viewport margins (`12px`), and computes `tail.x` (`22..318px`) so the rotated `12×12` diamond pointer (`ButtonDocBalloonTail`) points directly at the hovered button's horizontal center. The light header (`bg-slate-50`) renders `doc.title` with `break-words` (never truncated) and omits any type badge.

---

## 3. Startup: Home Screen vs. URL Query Parameter Loading (`?id=...`)

`resolveInitialSheetUrl(searchStr)` in `src/06_ui/11_CanvasViewport.jsx` inspects `window.location.search` on startup so users can open any root Google Sheet via URL parameters:

```javascript
// Example 1: Passing a Google Spreadsheet ID via ?id=
resolveInitialSheetUrl('?id=1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
// => 'https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit'

// Example 2: Passing a full URL via ?url=
resolveInitialSheetUrl('?url=https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
// => 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
```

No spreadsheet is hard-coded any more. During bootstrap (`initializeTreeDataset`) an embedded standalone dataset wins; otherwise the app auto-loads **only** when `hasExplicitSheetQueryParam()` is true (`?id=`, `?sheet=`, `?url=`, `?sheetId=`). Without such a parameter `useAppShellPanels()` starts with `isHomeOpen = true` and `sheetUrl = ''` (so the 20-second live-sync poller stays idle) and the user picks a sheet on the home screen. `DEFAULT_URL` (`src/01_core/04_Icons.jsx`) now points at the public demo spreadsheet (`Ancestry Browser: Demo`, ID `1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0`) and is used solely as the last-resort prefill.

### 3.0 Home Screen, Cookie History, Radial Settings FAB & Material 3 Colour Themes — `src/01_core/08_ColorThemes.jsx`, `src/05_hooks/00_BrowserPreferences.jsx`, `src/06_ui/13_HomeScreen.jsx`, `src/06_ui/14_SettingsPanel.jsx`, `src/06_ui/15_SettingsFab.jsx`

**Persistence layer (`00_BrowserPreferences.jsx`).** Three first-party cookies (`path=/; max-age=1y; SameSite=Lax`, `Secure` on https) hold everything the user has chosen; each is mirrored into `localStorage` under `ft_pref_<cookie>` because `document.cookie` is inert on `file://` standalone exports. `readPreference` prefers the cookie and falls back to the mirror; `removePreference` deletes both. All parsers are pure and unit-tested against an isolated cookie jar (see §4).

| Cookie | Payload | Writers / Readers |
| :--- | :--- | :--- |
| `ft_sheet_history` | JSON array of `{ i: sheetId, t: title, n: uses, l: lastUsedMs }` (compact keys; long keys accepted on read), ranked **uses desc → lastUsed desc → id**, capped at `SHEET_HISTORY_LIMIT = 12` entries / `SHEET_TITLE_MAX_LENGTH = 60` chars and trimmed from the bottom until the URL-encoded payload fits `SHEET_HISTORY_COOKIE_BUDGET = 3500` (browsers drop >4 KB cookies silently) | `recordSheetUse(id, title)` from `commitSuccessfulSheetImport` (only after a **successful** import), `forgetSheetHistoryEntry(id)` from the dropdown `×`, `readSheetHistory()` |
| `ft_demographic_settings` | Sanitized `DEFAULT_DEMOGRAPHIC_SETTINGS`-shaped object (`marriageAgeAnchors`, `firstChildAfterMarriage`, `spousalGenderOffset`, `consecutiveSiblingGap`) | `saveDemographicSettings` (Apply), `applyStoredDemographicSettings()` (called from a `useState` initializer in `useAppCoreState` so it runs **before** the first build), `clearStoredDemographicSettings` |
| `ft_color_theme` | Theme id from `COLOR_THEMES` (`'classic'`, `'pastel'`, `'earthy'`, `'ocean'`, `'lavender'`, `'solarized-light'`, `'dark'`, `'midnight'`, `'solarized-dark'`, `'contrast'`) | `saveColorThemeId(id)`, `loadStoredColorThemeId()`, `applyStoredColorTheme()` (called from `useColorTheme` in `useAppCoreState` before the first paint), `clearStoredColorTheme` |

```javascript
// Example 1: the dropdown payload after opening the demo twice and another sheet once
readSheetHistory();
// => [{ id: '1BQvy…', title: 'Ancestry Browser: Demo', uses: 2, lastUsed: 1759478400000 },
//     { id: '1BxiM…', title: '', uses: 1, lastUsed: 1759478100000 }]
formatSheetHistoryLabel(readSheetHistory()[1]);   // => 'Untitled sheet — 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'

// Example 2: resolveKnownSheetTitle checks cookie history → session sheetTitleRegistry → DEMO_SHEET_TITLE
resolveKnownSheetTitle('https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit');
// => 'Ancestry Browser: Demo'
```

**Prefill precedence (`resolveHomeScreenPrefill(clipboardRef, history)`) & Sheet Title Chip.** `useSheetSourceForm(isOpen)` re-prefills every time the screen opens: *clipboard → most-used → demo*. Whenever `resolveKnownSheetTitle(value)` returns a non-empty title for the current textbox value, `SheetSourceForm` renders a sheet-name chip (`data-testid="sheet-source-title"`) above the input box. `readClipboardSheetReference()` only accepts text that `isLikelySheetReference` approves — any Google URL, or a bare 35–60-char token containing an upper-case letter, `-` or `_` (so a 40-char lower-case git SHA is never mistaken for a sheet ID). Chrome rejects `navigator.clipboard.readText()` while the document is unfocused, so `attachClipboardPrefill` retries on `focus` and on the first `pointerdown`; Firefox/Safari do not expose page clipboard reads at all and silently fall through. A late clipboard hit never overwrites text the user already typed (`touchedRef`). Nothing is loaded until Enter/**Open** (`normalizeSheetReference` validates; a dropdown row click fills **and** opens).

```javascript
// Example 1: precedence
resolveHomeScreenPrefill({ id: '1Ekg…', url: '…/d/1Ekg…/edit' }, history).source;  // => 'clipboard'
resolveHomeScreenPrefill(null, []).url === DEFAULT_URL;                              // => true (demo)

// Example 2: clipboard strictness
isLikelySheetReference('3bd09a0f6c2e4d1b8a7f9e0c1d2b3a4f5e6d7c8b'); // => false (git SHA)
isLikelySheetReference('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0'); // => true
```

**Spreadsheet titles.** Google's CSV export answers with `Content-Disposition: attachment; filename="…"; filename*=UTF-8''<Title>%20-%20<Tab>.csv` and exposes the header via CORS. `fetchCSVData` calls `rememberSheetTitleFromResponse(sheetId, response)` for the default tab; `parseContentDispositionFilename` prefers the RFC 5987 `filename*` form, `deriveSpreadsheetTitle` strips `.csv` and only the **last** ` - <tab>` segment (so `Smith - Jones Family - Sheet1.csv` → `Smith - Jones Family`). The title lives in the in-memory `sheetTitleRegistry` until `commitSuccessfulSheetImport` copies it into the cookie. When the gviz fallback served the CSV there is no such header and the dropdown shows *Untitled sheet*.

**Address bar.** After every successful import `syncSheetIdIntoLocation(sheetId)` rewrites the URL to `buildSheetDeepLinkUrl(location, sheetId)` — path and `#hash` kept, legacy `sheet`/`url`/`sheetId` aliases dropped, `?id=` set — via `history.replaceState`, so a refresh reopens the sheet and the Home emblem (`HomeButton`, `fixed left-4 top-4 z-[60]`, hidden in standalone exports) returns to the chooser. A failed import reopens the home screen with the error (`useTreeImportHandler` → `setIsHomeOpen(true)`).

**Material 3 Colour Engine (`08_ColorThemes.jsx`), Radial Settings FAB (`15_SettingsFab.jsx`) & Tabbed Settings Panel (`14_SettingsPanel.jsx`).**
- `08_ColorThemes.jsx` is a pure JS module (shared by the browser bundle and `scripts/bundle.mjs`) that synthesizes 11-shade (`50..950`) Tailwind palettes from CIE LCh seed hues (`lchToHex`, `buildTonalShadeScale`, `resolveColorTheme`) across 9 colour families (`slate`, `sky`, `rose`, `amber`, `emerald`, `purple`, `indigo`, `orange`, `red`) plus Material 3 role tokens (`--ft-primary`, `--ft-primary-hover`, `--ft-on-primary`, `--ft-primary-container`, `--ft-on-primary-container`, `--ft-canvas`, `--ft-surface`, `--ft-connector`, `--ft-watermark-opacity`). `scripts/bundle.mjs` stamps `TAILWIND_THEME_CONFIG_SCRIPT` directly into `index.html` between `<!-- FT_TAILWIND_THEME_CONFIG:BEGIN/END -->` (and `_getStandaloneTailwindConfig` emits it into standalone `.html` exports) so every Tailwind utility (`bg-white`, `text-slate-800`, `bg-sky-100`, `bg-primary`, etc.) reads live `rgb(var(--tw-c-*) / <alpha-value>)` CSS variables without duplicating classes across components.
- `SettingsRadialFab` (`fixed bottom-6 right-6 z-[80]`, above the `z-50` home screen) renders the circular gear button (`data-testid="settings-fab-toggle"`) on both the home screen and the tree/map views and fans out 3 satellite actions (`theme`, `deduction`, `privacy`) along a quarter-circle arc (`computeRadialMenuOffsets(3, 84)` → `90°`, `135°`, `180°`).
- `AppSettingsPanel` (`data-testid="app-settings-panel"`) combines the **Appearance** tab (`AppearanceSettingsTab` + `ColorThemePicker` with 10 miniature `ThemePreviewArt` cards) and the **Deduction rules** tab (`DeductionSettingsTab` with `MarriageAgeAnchorsTable`, `MarriageAgePreview`, `DemographicScalarFields`, and `rebuildTreeFromCachedRows`). Both the home screen's **clear stored data** link and the radial FAB's `privacy` satellite invoke `clearStoredPreferences()`, resetting all three cookies, their `localStorage` mirrors, the demographic model, and the colour theme back to `Classic Forest`.

### 3.1 Shareable View State Hash (`#p=…&z=…&a=…&o=…`) — `src/06_ui/12_UrlViewState.jsx`

The query string selects *which* spreadsheet is loaded; the hash fragment captures *what the user is looking at* (Google-Maps style). `useUrlViewStateSync({ ...core, ...viewport, ...focusNav })` is mounted once from `useAppViewModel()` in `src/07_app/01_App.jsx` and does two jobs: it restores the view described by the initial hash after the dataset is ready, and it mirrors every later UI change back into the address bar with `history.replaceState` (no reload, no extra history entries).

| Key | State field | Encoder / Decoder | Sample |
| :--- | :--- | :--- | :--- |
| `p=` | `focusId` (person ID `<Name>_<YOB>_<row>`) | `encodePersonIdToken` / `decodeViewStateToken` (percent-encoding, spaces as `+`, sheet IDs as `~N`) | `p=Joseph_1920_152` |
| `s=0` | `isSidebarVisible === false` while a person is focused | `encodeSelectionHashParts` | `p=Joseph_1920_152&s=0` |
| `f=` | `activeFilter` as `<filterType>:<value>` (`place`, `job`, `family`, `search`, `directory`) | `parseViewStateFilterToken` | `f=place:New+York` |
| `v=map` | `showMap` | `encodeSelectionHashParts` | `v=map&f=place:Chalissery` |
| `z=` | `camera.z` (2 decimals via `formatCompactNumber`) | `applyViewStateHashEntry` | `z=0.8` |
| `a=` | Camera **anchor** card (`chooseViewStateAnchor`); omitted when it is the focused person | `encodeCameraHashParts` | `a=Antu_1931_12` |
| `o=` | Visible-centre **offset** from the anchor card `<tree px>,<years>`; omitted when both round to `0` | `computeAnchorOffset` / `computeCenterFromAnchorOffset` | `o=-320,12.5` |
| `k=` | `collapsedNodes` IDs, comma separated | `resolveRestoredCollapsedIds` | `k=Antu_1931_12,Elsy_1935_13` |

```javascript
// Example 1: Encoding is lossless and only emits non-default keys (short URLs)
encodeViewStateHash({ focusId: 'Joseph_1920_152', isSidebarVisible: true, zoom: 0.8, anchorId: 'Joseph_1920_152', offset: { dx: 0, dy: 0 } });
// => 'p=Joseph_1920_152&z=0.8'
encodeViewStateHash({ zoom: 0.12, anchorId: 'Antu_1931_12', offset: { dx: -320.4, dy: 12.46 }, collapsedIds: ['Elsy_1935_13'] });
// => 'z=0.12&a=Antu_1931_12&o=-320,12.5&k=Elsy_1935_13'

// Example 2: Parsing tolerates hand-edited URLs (unknown keys and bad numbers are dropped)
parseViewStateHash('#p=Joseph_1920_152&s=0&z=abc&o=-320,12.5&foo=bar');
// => { focusId: 'Joseph_1920_152', isSidebarVisible: false, offset: { dx: -320, dy: 12.5 } }
```

**Anchor-relative camera model (resilient to spreadsheet edits).** The canvas transform is `screenX = treeX * z + camera.x`, `screenY = treeY * z + camera.y`. Absolute layout coordinates are *not* stored: any unrelated row added to the spreadsheet re-flows the layout and would move them. Instead the writer measures the visible centre (`computeViewCenterFromCamera`, the middle of the canvas right of the `48px` timeline gutter and left of any open sidebar — `measureViewStateViewport`), picks an anchor card (`chooseViewStateAnchor`: the focused person while their card is on screen, else the rendered card nearest the centre via `listRenderedPersonNodes` + `pickNearestAnchor`), measures that card with `measurePersonNodeCenter` (DOM id `node-<personId>`, through `computePeopleBoundingBox`) and stores the difference as `o=<dx>,<dy>`: `dx` in unscaled tree pixels (the horizontal layout depends only on zoom), `dy` in calendar **years** (`ppy`, pixels-per-year, stretches with the window height):

```javascript
// Example 1: writer — visible centre relative to Joseph's card at 10 px/year
computeAnchorOffset({ center: { x: 1148, y: 600 }, anchor: { x: 1468, y: 475 }, ppy: 10 });
// => { dx: -320, dy: 12.5 }

// Example 2: reader — the same offset applied to Joseph's card as measured on THIS screen (8 px/year),
// then computeCameraFromViewCenter({ center, zoom, ...viewport }) and clampCamera()
computeCenterFromAnchorOffset({ anchor: { x: 1768, y: 380 }, offset: { dx: -320, dy: 12.5 }, ppy: 8 });
// => { x: 1448, y: 480 }
```

**Person ID resolution (`resolveViewStatePersonId`).** IDs are `<Name>_<YOB|unk>_<row>` where `row` is the person's index across all loaded sheets (`indexNodes`), so inserting a row above anyone renumbers everybody below. Shared IDs are resolved in tiers — exact `tree.get(id)`; else same `<Name>_<YOB>` stem with the nearest row (`parseViewStatePersonRef` + `pickNearestRowCandidate`, depth 1); else same `<Name>` with the nearest row (depth 2, covers a corrected birth year or a ghost whose source sheet moved). Ghost IDs embed their 44-char spreadsheet ID (`ghost_<Name>_<sheetId>_<n>`); `collectViewStateSheetIds(tree)` sorts the distinct `_sourceId`s (≥ `VIEW_STATE_MIN_SHEET_ID_LENGTH` = 20 chars) and `compactViewStateSheetIds` / `expandViewStateSheetIds` swap them for `~N`, so both sides derive the same abbreviation. The same resolver is used for `p=`, `a=` and every `k=` entry.

**Restore timing (`useUrlViewStateRestore` → `scheduleViewStateRestore`).** The hash is parsed exactly once at mount; the restore effect fires once `tree.rootId && !isLoading` (i.e. after the cache-then-live double load and after `applyImportSuccessFocus` has reset focus/filter), then runs in two phases so it never fights the app's own startup animations:

1. **`+350 ms` — selection** (`applyRestoredSelection`): map (`setShowMap(true)` + the same sidebar/filter/focus resets as the Map button), else filter via the real `handleFilterBy(type, value)`, else focus via `handleSetFocusId(id)` (so navigation history and re-rooting behave like a click) followed by `setIsSidebarVisible(false)` when `s=0`; finally `setCollapsedNodes(new Set(resolveRestoredCollapsedIds(state, tree)))`.
2. **`+1000 ms` — camera** (`applyRestoredCamera`), re-run at **`+1150 / +1450 / +1750 ms`** (`VIEW_STATE_CAMERA_REFINE_DELAYS_MS`): after `centerOnPerson`'s own animation has settled, `resolveRestoredCenter` resolves the anchor (`a=`, else `p=`), measures its card on the current layout and applies the offset with *this* screen's `getPpy(zoom)`; `buildRestoreCameraEnv` predicts the visible width from `resolveRestoredSidebarOpen(state)`, then `setCamera(clampCamera(computeCameraFromViewCenter(...)))`. The refinement passes exist because the horizontal layout re-flows with zoom (`calculateSiblingGap(camera.z)`), so the anchor must be re-measured once the target zoom is rendered; `onComplete` fires after the last pass. Without a rendered anchor only the zoom is applied; skipped entirely for `v=map`.

**Write rules (`useUrlViewStateWriter` → `captureAndWriteViewState`).** Writes are enabled only after the restore completes (`phaseRef.current.writable`), debounced `300 ms`, and suppressed while `isLoading`, `isDragging`, or `isShifting` (live-sync camera shifts), so the address bar always contains a stable, copy-ready URL. `writeViewStateHash` is a no-op when the hash is unchanged and swallows any `SecurityError` a browser may raise from `replaceState` on `file://` standalone exports. In map view the `z=`/`a=`/`o=` keys are omitted because the Leaflet camera is not part of the tree view state.

`tests.html` Section 205 ("Shareable URL View State", 56 tests) covers the encode/parse round trip, URL-safety of separators, the centre ↔ camera and offset ↔ centre inverse pairs, anchor choice, `~N` sheet compaction, the tiered resolver against stubbed trees *and* against the real `buildTree` (a row inserted at the top renumbers IDs and the link still lands on the same person), selection/camera application order against stubbed handlers, and `replaceState` behaviour; run it with `node scripts/run_tests.mjs --skip-ast --section 205`.

---

## 4. Multi-Tier Automated Test Runner (`scripts/run_tests.mjs`)

The test suite validates the application across 4 progressive stages:

| Tier / Stage | Description | Typical Latency | When to Use |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Whole-file Babel AST parse (detects syntax errors, missing braces, invalid JSX) | ~400 ms | Every run (unless `--skip-ast`) |
| **Stage 2** | AST Scope & Identifier Analysis (detects undeclared variables/globals) | ~800 ms | Every run (unless `--skip-ast`) |
| **Stage 3** | Algorithmic Unit Tests (`tests.html`, 2,959 assertions across 213 sections) | ~1.5 s | Every run |
| **Stage 4** | Headless Chrome E2E via CDP: home screen first (demo prefilled, `"Ancestry Browser: Demo"` title chip, radial FAB, 0 nodes) → radial FAB opens Appearance tab (10 M3 themes, switches to `midnight`, persists cookie) → **Open** → demo tree rendered → Home button + radial FAB + watermark + `?id=` + history cookie → speech-balloon hover tooltip with tail → Home button reopens chooser with title chip and history dropdown | ~15 s | Pre-commit / Final validation |

### CLI Usage Examples

```bash
# 1. Fast Slice: Run only a single section during inner-loop debugging (<1s)
node scripts/run_tests.mjs --skip-ast --section 213

# 2. Grep Filter: Run tests matching a specific keyword
node scripts/run_tests.mjs --grep "Colour Theme"

# 3. Fast Mode: Run Stages 1, 2, 3 for all 2,959 unit tests (~3s)
node scripts/run_tests.mjs --fast

# 4. Full Quality Gate: Run all 4 stages including Headless Chrome E2E (~20s)
node scripts/run_tests.mjs

# 5. Code Quality Audit (<= 40 lines, 100% JSDoc, >= 2 @example tags, 0 undeclared vars)
node scripts/audit_quality.mjs
```

---

## 5. Source Architecture & Bundler (`src/` and `scripts/bundle.mjs`)

The codebase is organized into 43 modular files across 7 numbered directories under `src/`:

```text
src/
├── 00_header.jsx                 # License header & React hook imports
├── 01_core/
│   ├── 01_constants.jsx          # Demographic tokens, generational gap constants
│   ├── 02_DisjointSetForest.jsx  # Union-find with transactional snapshot/rollback
│   ├── 03_GenealogicalGraph.jsx  # Graph traversal, cycle detection, ancestor/descendant queries
│   ├── 04_Icons.jsx              # Vector SVG icons & DEFAULT_URL (public demo sheet) constant
│   ├── 07_BrandAssets.jsx        # BrandLogo emblem (green ring + leafy tree) & BrandWatermark layer
│   └── 08_ColorThemes.jsx        # Material 3 CIE LCh colour theme engine (10 themes) & Tailwind CSS var script
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
│   ├── 00_BrowserPreferences.jsx # Cookie + localStorage persistence: sheet history, titles, demographic settings, colour theme
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
│   ├── 10_TopNavigation.jsx      # Floating navbar, OmniSearch bar & speech-balloon ButtonDocTooltipOverlay
│   ├── 11_CanvasViewport.jsx     # Main canvas viewport, timeline cohorts & URL sheet resolution
│   ├── 12_UrlViewState.jsx       # Shareable #hash view state: encode/parse, restore & replaceState writer
│   ├── 13_HomeScreen.jsx         # Home screen (sheet chooser, title chip, cookie history dropdown, GDPR notice) & HomeButton
│   ├── 14_SettingsPanel.jsx      # Tabbed AppSettingsPanel (Appearance M3 theme picker + Deduction rules)
│   └── 15_SettingsFab.jsx        # Floating bottom-right radial-menu Settings FAB (theme, deduction, privacy)
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
