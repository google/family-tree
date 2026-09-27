# Family Tree Web App

An interactive, zero-build genealogical visualization, demographic deduction, and exploration web application built with **React**, **SVG**, **Leaflet**, and **Tailwind CSS**.

The app reconstructs multi-generational family trees directly from **Google Sheets** (including multi-sheet linked workbooks), automatically deduces missing birth/death years, genders, and kinship links, and renders collision-free chronological diagrams, interactive geographic maps, printable A4 landscape atlases, and a hybrid **Rule + Gemini LLM** genealogy assistant.

---

## Table of Contents

1. [Key Features](#1-key-features)
2. [Quick Start & URL Parameters (`?id=...`)](#2-quick-start--url-parameters-id)
3. [Complete Button & Interactive Control Reference (with Examples)](#3-complete-button--interactive-control-reference-with-examples)
   - [3.1 Top Navigation Toolbar](#31-top-navigation-toolbar)
   - [3.2 Bottom-Left Canvas Camera & Zoom Controls](#32-bottom-left-canvas-camera--zoom-controls)
   - [3.3 Tree Card Controls & Visual Badges](#33-tree-card-controls--visual-badges)
   - [3.4 Person Details Sidebar & Attribute Filter Chips](#34-person-details-sidebar--attribute-filter-chips)
   - [3.5 Quick Directory Browser (`Locations`, `Careers`, `Families`)](#35-quick-directory-browser-locations-careers-families)
   - [3.6 Family Locations Map Controls](#36-family-locations-map-controls)
   - [3.7 AI Genealogy Assistant Controls](#37-ai-genealogy-assistant-controls)
4. [Google Sheets Data Format & Examples](#4-google-sheets-data-format--examples)
   - [4.1 Core Columns & Example Rows](#41-core-columns--example-rows)
   - [4.2 Multi-Sheet Crawling via the `Links` Tab](#42-multi-sheet-crawling-via-the-links-tab)
   - [4.3 Relative Naming & Free-Form Shorthand Examples](#43-relative-naming--free-form-shorthand-examples)
5. [Genealogical Deduction & Demographic Rules (with Examples)](#5-genealogical-deduction--demographic-rules-with-examples)
6. [Development, Testing & GitHub Pages Deployment](#6-development-testing--github-pages-deployment)

---

## 1. Key Features

- **Interactive Rich-Text Button Documentation**: Hovering over any button in the UI pops up a rich-text documentation card with a category badge, formatted explanation, and concrete usage examples.
- **Multi-Sheet Google Sheets Crawler**: Fetches a root Google Sheet and recursively crawls all linked branch spreadsheets listed in its `Links` tab in parallel, caching datasets locally and live-syncing background updates without jarring camera jumps.
- **Automated Demographic & Kinship Deduction**: Infers missing birth years (`~YOB`), centenarian and sequential-remarriage death statuses, patrilineal family names, religious vocations (`Fr.` / `Sr.`), and intermediate ghost relatives (`Mary Son 1`, `Joy Son 1 Wife`).
- **Chronological 2D Contour Layout**: Positions every person vertically by birth year (`PPY` pixels-per-year timeline) and packs subtrees horizontally using 2D `IntervalContour` profiles with zero card overlaps, chronological multi-spouse ordering, and maternal drop-stem connectors.
- **Hybrid AI Genealogy Assistant**: Combines an instant, 100% deterministic **Genealogy Rule Engine** with optional **Google Gemini LLM** synthesis to answer natural-language questions and highlight mentioned relatives on the canvas.
- **Multi-Format Exports**:
  - **Standalone Interactive HTML App (`.html`)**: Bundles the entire app and active lineage into a single offline HTML file.
  - **Multi-Page A4 Landscape Print & Family Atlas**: Generates crisp vector SVG pages scaled so every person's name prints at a readable **10pt physical font size**.
  - **Geographic Locations CSV (`.csv`)**: Exports geocoded ancestral villages, districts, and resident counts.

---

## 2. Quick Start & URL Parameters (`?id=...`)

### Running Locally

1. Start the local zero-cache development server:
   ```bash
   ./start_server.sh 8000
   # or: python3 server.py 8000
   ```
2. Open [http://localhost:8000/](http://localhost:8000/) in your browser.

### Loading Any Google Sheet via URL Query Parameters

You can load any public or link-shared Google Sheet directly via URL query parameters (`?id=`, `?sheet=`, or `?url=`) on both GitHub Pages and localhost:

| Parameter | Format | Concrete Example |
| :--- | :--- | :--- |
| **`?id=`** | Google Spreadsheet ID (`20+` chars) | `https://google.github.io/family-tree/?id=1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI` |
| **`?sheet=`** | Google Spreadsheet ID or full URL | `https://google.github.io/family-tree/?sheet=1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI` |
| **`?url=`** | Full Google Sheets URL | `http://localhost:8000/?url=https://docs.google.com/spreadsheets/d/1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI/edit` |

> **How it works:** When `?id=<SPREADSHEET_ID>` is present in the URL, `resolveInitialSheetUrl()` automatically expands it to `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`, bypasses stale default cache entries if a new sheet ID is supplied, fetches the main genealogical tab plus any branch sheets referenced in the `Links` tab, and renders the unified tree.

---

## 3. Complete Button & Interactive Control Reference (with Examples)

Every button in the application displays an interactive rich-text documentation popover when hovered. Below is the complete reference with examples.

### 3.1 Top Navigation Toolbar

| Button / Icon | Title & Shortcut | Detailed Behavior | Usage Examples |
| :--- | :--- | :--- | :--- |
| **Link Icon** (`🔗`) | **Import Google Sheet from Clipboard URL** | Reads a Google Sheets URL or Spreadsheet ID from your system clipboard (or prompts if clipboard permission is denied), crawls the root sheet and all linked branch tabs in `Links` in parallel, and rebuilds the family tree. | **1. Clipboard Sync:** Copy `https://docs.google.com/spreadsheets/d/1ZDpcz2.../edit` and click `🔗` to import all linked family branches.<br>**2. Direct URL Load:** Append `?id=1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI` to the browser URL to load automatically on startup. |
| **Download Icon** (`⬇`) | **Download Standalone Interactive App (`.html`)** | Packages the entire interactive React/SVG application and the currently focused lineage dataset into a single self-contained `.html` file that runs 100% offline in any browser. | **1. Full Family Archive:** Focus on the root ancestor (`Kochuvareed`) and click `⬇` to download `Kochuvareed_Interactive_App_2026-09-27.html` containing all 240+ profiles.<br>**2. Scoped Sub-Branch App:** Select a specific grandparent first to export an offline interactive tree scoped only to their ancestors and descendants. |
| **Printer Icon** (`🖨`) | **Print Tree / Export A4 Landscape SVGs (10pt names)** | Generates a multi-page A4 landscape printable document and **Family Atlas** with vector SVG cards calibrated so every person's name renders at a readable **10pt physical font size**. | **1. Multi-Page Wall Poster:** Click `🖨` to open the A4 print preview, save as **PDF**, and tape adjacent tiled pages together using the alignment guides.<br>**2. Branch Atlas Chapters:** Deep sub-branches are automatically organized into numbered **Atlas Chapters** with cross-page reference badges. |
| **Map Pin Icon** (`📍`) | **View Family Locations Map** / **Switch to Family Tree Diagram** | Toggles the main viewport between the chronological 2D family tree diagram and an interactive **Leaflet World Map** plotting ancestral towns, parishes, and diaspora cities with member count pins. | **1. Explore Regional Clusters:** Click `📍` to view family concentrations across **Kerala** (`Thrissur`, `Palakkad`, `Kottayam`), **Karnataka**, and global diaspora hubs.<br>**2. Pin-to-Tree Spotlight:** Click a town pin on the map (e.g., `Chalissery`), then click `📍` again to see those exact residents highlighted on the tree canvas. |
| **Sparkles Icon** (`✨`) | **Ask AI** | Opens the **AI Genealogy Assistant** panel to answer natural-language questions about kinship paths, ancestral origins, birth/death cohorts, and tree statistics. | **1. Relationship Tracing:** Ask `"How is Eliamma related to Vareeth?"` or `"Who are the children of Joseph and Thankamma?"`<br>**2. Demographic Superlatives:** Ask `"Who lived the longest?"` or `"Who all lived in Moonilavu?"` to highlight matching cards on the canvas. |
| **Terminal / Log Icon** (`📋`) | **View Logs** | Opens the **Ingestion & Audit Logs** drawer showing live parallel sheet crawl progress, merged duplicate profiles, deduced birth/death years, and biological or kinship audit warnings. | **1. Spreadsheet Row Citations:** Click any `[Parathottiyil:53]` badge in the log to open row 53 directly in Google Sheets.<br>**2. Audit Data Warnings:** Review parent-child age-gap warnings, ambiguous parent candidates, and disconnected subtree roots. |
| **Magnifying Glass** (`🔍`) | **Search** (`Cmd+K` / `Ctrl+K`) | Expands the **Omni Search** bar to find people by name or nickname, filter by location, family house, or career, or dispatch natural-language questions to the AI Assistant. | **1. Person & Nickname Jump:** Press `Cmd+K` and type `"Kochuthresia"` or `"Kunjappan"` to center the camera on their card.<br>**2. Category Spotlight:** Type `"Teacher"` or `"Palakkad"` and press `Enter` to highlight all matching profiles across the tree. |
| **Left Chevron** (`‹`) | **Go Back** | Steps backward to the previously focused person profile or directory filter in your session navigation history stack. | **1. Retrace Ancestor Jumps:** After clicking from a child up to their father and grandfather, click `‹` to return to the child.<br>**2. Restore Filter List:** Step back from an individual profile to the `Location: Thrissur` filter list you were browsing earlier. |
| **Right Chevron** (`›`) | **Go Forward** | Steps forward in your session navigation history stack after using **Go Back**. | **1. Redo Profile Focus:** Click `›` to return to the descendant profile you inspected before stepping back.<br>**2. Compare Branches:** Alternate between `‹` and `›` to compare two distant cousin branches. |

---

### 3.2 Bottom-Left Canvas Camera & Zoom Controls

| Button | Title | Detailed Behavior | Usage Examples |
| :--- | :--- | :--- | :--- |
| **`+`** | **Zoom In** | Increases canvas magnification (`1.3x` per click) around the viewport center to inspect detailed person cards, lifespan badges, and connectors. | **1. Read Card Details:** Click `+` (or scroll wheel up) to inspect nicknames, deduced `~YOB` badges, and occupation labels.<br>**2. Dense Sibling Groups:** Magnify large 8+ sibling families to inspect individual birth order and spouse bridges. |
| **`−`** | **Zoom Out** | Decreases canvas magnification (`1 / 1.3x` per click) to show a broader multi-generational panorama alongside the left-hand century timeline. | **1. 6-Generation Overview:** Click `−` repeatedly to view lineages spanning from the 1850s to the 2020s in one frame.<br>**2. Subtree Packing Inspection:** Zoom out to see how first-wife and second-wife descendant subtrees pack without crossing. |
| **Person / Home Icon** | **Reset to Root Person** | Selects the oldest root ancestor of the loaded family tree, opens their details sidebar, and smoothly pans the camera to the top of the diagram. | **1. Return to Founding Ancestor:** Click after exploring 5th-generation descendants to jump straight back to the founding patriarch/matriarch.<br>**2. Reset Subtree Rerooting:** Restores the full connected tree if the canvas was temporarily rerooted on an in-law branch. |
| **Frame / Corners Icon** | **Fit to Screen** | Computes the exact bounding box of all currently expanded person nodes, closes open sidebars for full screen width, and scales/centers the tree to fit the viewport. | **1. Re-Center After Collapse:** Click after collapsing or expanding major branches to frame the active diagram cleanly.<br>**2. Full-Screen Presentation:** Automatically dismisses the right-hand sidebar and frames the complete tree beside the timeline. |

---

### 3.3 Tree Card Controls & Visual Badges

- **Expand Descendant Branch (`+` pill on card bottom edge)**:
  - **Behavior:** Uncollapses hidden children, spouses, and descendants beneath a person card while keeping the clicked card anchored at the exact same screen coordinates (zero jerky sideways motion).
  - **Example:** Click `+` beneath `Joseph` to reveal his children with both `Kochuthresia` (left branch) and `Thankamma` (right branch).
- **Collapse Descendant Branch (`−` pill on card bottom edge)**:
  - **Behavior:** Folds all descendant generations beneath the card into a compact state so neighboring sibling branches move closer together.
  - **Example:** Click `−` on a prolific ancestor before clicking **Print Tree** (`🖨`) to print a focused chart of selected branches.
- **Card Lifespan & Recency Badge**:
  - **Living Profiles:** Displays `"<age>y"` (e.g., `"78y"` or `"~78y"` when birth year is deduced).
  - **Deceased Profiles:** Displays `"<lifespan>y, <recency>y ago"` (e.g., `"90y, 16y ago"` for someone born in 1920 who died in 2010). Hovering over the badge shows exact calendar years (`"1920 - 2010"`).

---

### 3.4 Person Details Sidebar & Attribute Filter Chips

Clicking any person card opens the **Person Details Sidebar** on the right:

- **Person Name Header Button**:
  - **Example:** Click the person's name at the top of the sidebar to smoothly pan and center the canvas camera on their card.
- **Category Filter Chips (`Filter by Family`, `Filter by Location`, `Filter by Career`)**:
  - **Behavior:** Clicking any colored chip on a profile (e.g., `Family: Parathottiyil (34)`, `Location: Chalissery (18)`, `Career: Teacher (12)`) switches the sidebar to a chronological list of all relatives sharing that attribute and highlights all of them on the tree canvas.
  - **Example 1:** Click the purple **`Parathottiyil`** badge on `Eliamma`'s profile to spotlight all 34 members of the Parathottiyil house.
  - **Example 2:** Click the emerald **`Chalissery`** badge to highlight every relative from Chalissery and uncollapse any hidden branches containing matches.
- **Relative Navigation Cards (`Parents`, `Partner` / `Partners`, `Siblings`, `Children`)**:
  - **Behavior:** Sorted chronologically by birth year (with spreadsheet row number as tiebreaker). Clicking any relative selects their profile, updates the sidebar, and pans the canvas camera to their card.
- **Google Sheets Source Citation Pills (`[SheetName:Row]`)**:
  - **Example:** Click `Ollur:44` at the bottom of `Achama`'s profile to open the `Ollur` Google Sheet directly at row 44 in a new browser tab.

---

### 3.5 Quick Directory Browser (`Locations`, `Careers`, `Families`)

Accessible via the **Open Directory** button in the sidebar header or from the Map view:

- **`Locations (N)` Tab**:
  - Organizes all ancestral and diaspora places into a collapsible 4-level geographic hierarchy: **Country → State → District → Town/Village**.
  - **Example:** Expand `India → Kerala → Thrissur` and click `Chalissery` to filter the tree or fly the map camera to Chalissery.
- **`Careers (N)` Tab**:
  - Lists all explicit professions and deduced vocations (`Teacher`, `Engineer`, `Doctor`, `Farmer`, `Priest`, `Nun`) sorted by member count.
- **`Families (N)` Tab**:
  - Lists all family house names / surnames (`Thalakkottukara`, `Parathottiyil`, `Kizhakkumthala`, `Alappatt`, etc.), including patrilineally inherited house names.

---

### 3.6 Family Locations Map Controls

When viewing the interactive **Family Locations Map**, a floating control bar appears at the bottom:

- **`Tree View`**: Switches back to the 2D genealogical diagram while preserving your active location filter or selected person.
- **`Export CSV`**: Downloads `Family_Locations_Map.csv` containing every geocoded location, latitude/longitude coordinates, resident count, and member names.
- **`Show Directory` / `Hide Directory`**: Toggles the right-hand Quick Directory sidebar so you can click regions to fly the map camera or collapse the panel for a full-screen map.

---

### 3.7 AI Genealogy Assistant Controls

- **Engine Mode Toggle (`Rule` vs `AI`)**:
  - **`Rule` Mode (Default when no API key is set):** Uses the built-in deterministic `GenealogyEngine` for instant, zero-latency answers to relationship paths, birth/death queries, location residents, and superlatives (`"Who lived the longest?"`, `"Who had the most children?"`).
  - **`AI` Mode (Gemini LLM):** Uses your configured Google AI Studio Gemini API key to synthesize narrative responses over the serialized family graph.
- **`Configure Gemini API Key` (Gear Icon `⚙`)**:
  - Opens the **AI Studio Settings** drawer where you can paste a Gemini API key (`AIza...`), click **Save**, or click **Test API Connection** to probe available Gemini models and view latency diagnostics.
- **`Clear Conversation` (Trash Icon `🗑`)**:
  - Resets the chat history, clears purple AI mention highlights from the tree canvas, and generates fresh sample prompts.

---

## 4. Google Sheets Data Format & Examples

### 4.1 Core Columns & Example Rows

The CSV/Spreadsheet parser uses fuzzy Jaro-Winkler and token header matching, so column names are flexible and case-insensitive:

| Column Header | Aliases Supported | Example Values |
| :--- | :--- | :--- |
| **`Name`** | `Full Name`, `Person` | `Vareeth`, `Kochuthresia (kutty)`, `Fr. Thomas`, `Sr. Rosy`, `Joy Son 1` |
| **`Nickname`** | `Nick`, `Pet Name`, `Called` | `Appachan`, `Kunjappan`, `Ammachi` |
| **`Gender`** | `Sex`, `M/F` | `M`, `F` (automatically deduced if blank) |
| **`Year of Birth`** | `YOB`, `Birth Year`, `Born` | `1920`, `1945` |
| **`Age`** | `Current Age`, `Age at Death` | `81` (used to compute `YOB = CurrentYear - Age` or `DeathYear - Age`) |
| **`Year of Death`** | `YOD`, `Death Year`, `Died` | `2010`, `deceased`, `late` |
| **`Mother`** | `Mom`, `Maternal` | `Christina`, `Annamkutty` |
| **`Father`** | `Dad`, `Paternal`, `Father if Mother not available` | `Paappu`, `George` |
| **`Spouse`** | `Husband`, `Wife`, `Partner`, `Spouse prefer husband` | `Mercy`, `Kochappan` |
| **`Family Name`** | `House Name`, `Family name at birth if father not available` | `Parathottiyil`, `Thalakkottukara`, `Alappatt` |
| **`Location`** | `Place`, `Location if different from husband/father` | `Chalissery`, `Moonilavu`, `Ollur`, `Bangalore` |
| **`Job`** | `Occupation`, `Career`, `Profession` | `Teacher`, `Farmer`, `Engineer` |
| **`Sibling`** | `Brother`, `Sister`, `Sibling any one of them` | `Paul`, `Margaret` |
| **`Free Form`** | `Notes`, `Children`, `Description` | `3 sons, 2 daughters`, `No children` |

#### Concrete Spreadsheet Table Example

| Row | Name | Year of Birth | Year of Death | Mother | Father | Spouse | Family Name | Location | Free Form |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2** | `Joseph` | `1920` | `2002` | | | | `Parathottiyil` | `Moonilavu` | |
| **3** | `Kochuthresia` | `1922` | `1955` | | | `Joseph` | | `Moonilavu` | |
| **4** | `Thankamma` | | `2015` | | | `Joseph` | | `Moonilavu` | |
| **5** | `Eliamma` | `1944` | | `Kochuthresia` | `Joseph` | | `Parathottiyil` | `Chalissery` | `2 sons, 1 daughter` |
| **6** | `Sherly` | `1953` | | `Thankamma` | `Joseph` | | `Parathottiyil` | `Palakkad` | |

---

### 4.2 Multi-Sheet Crawling via the `Links` Tab

A root Google Sheet can link to any number of branch spreadsheets by including a worksheet tab named **`Links`**. Each row in `Links` specifies a branch name and its Google Sheets URL or ID:

| Branch / Family Tag | Google Sheet URL |
| :--- | :--- |
| `Ollur` | `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/edit` |
| `Kizhakkumthala` | `https://docs.google.com/spreadsheets/d/1ZyXwVuTsRqPoNmLkJiHgFeDcBa654321/edit` |
| `Parathottiyil` | `https://docs.google.com/spreadsheets/d/1PqRsTuVwXyZ0123456789AbCdEfGhIjK/edit` |

When the root sheet is imported, the crawler fetches all linked sheets in parallel, deduplicates cross-sheet profiles (such as marrying-in spouses appearing on both their birth family sheet and their spouse's sheet), and merges them into a single unified graph.

---

### 4.3 Relative Naming & Free-Form Shorthand Examples

When exact names of relatives are unknown in historical records, you can enter relational shorthand directly in the **`Name`** or **`Free Form`** columns:

1. **Numbered & Unnumbered Children (`<Parent> Son <N>`, `<Parent> Daughter <N>`)**:
   - **Example:** If Row 13 has `Name: Antu Daughter 3`, the builder automatically synthesizes intermediate ghost profiles `Antu Daughter 1` and `Antu Daughter 2`, links all three to `Antu` and his wife `Elsy`, and orders them chronologically (`Daughter 1` eldest → `Daughter 2` → `Daughter 3`).
2. **Multi-Level In-Law Compounds (`<Anchor> <Relation 1> <Relation 2>`)**:
   - **Example 1 (`Joy Son 1 Wife`):** Synthesizes `Joy Son 1` (if not already present), links him as a son of `Joy` and `Bollo`, and marries him to `Joy Son 1 Wife`.
   - **Example 2 (`Joy Son 1 Wife Father`):** Links the profile as the father of `Joy Son 1 Wife` without creating false incestuous loops.
3. **Free-Form Child Counts (`Free Form` column)**:
   - **Example:** Entering `"3 sons, 1 daughter"` on `Mary`'s row automatically generates `Mary Son 1`, `Mary Son 2`, `Mary Son 3`, and `Mary Daughter` and merges them with any explicit concrete children of `Mary` listed on nearby rows.

---

## 5. Genealogical Deduction & Demographic Rules (with Examples)

The `FamilyTreeBuilder` pipeline applies domain-calibrated demographic rules across 5 phases:

1. **Maternal & Spousal Birth Year Inference**:
   - **Maternal Gap (`20 yrs`):** If a mother's birth year is unknown, it is deduced from her eldest child (`mother.yob = firstChild.yob - 20`).
   - **Spousal Offset (`2 yrs`):** If one spouse's birth year is unknown, the husband is deduced as 2 years older than the wife (`husband.yob = wife.yob - 2`, `wife.yob = husband.yob + 2`).
   - **Second Wife / Remarriage Inference:** When a widower remarries and the second wife's birth year is unknown, her birth year is estimated from the first wife's last child (`secondWife.yob = lastChildOfFirstWife.yob - 18`).
2. **Sibling Seniority & 2-Year Spacing**:
   - Consecutive siblings without explicit birth years are spaced by **2 years** (`SIBLING_AGE_GAP = 2`), using **spreadsheet row order** as the authoritative seniority order (lower row number = older sibling).
3. **Biological Sanity & Consanguinity Guards**:
   - Enforces minimum parental age at childbirth (`14 years`), maximum maternal age (`45 years`), and maximum paternal age (`60 years`).
   - Strictly prohibits parent-child, biological sibling, and first-cousin marriages when resolving namesake spouse candidates, generating a distinct autoghost spouse when a cousin shares the declared spouse's name.
4. **Patrilineal Family Name Inheritance & Namesake Separation**:
   - Children inherit their father's family house name recursively. Two same-named candidates with conflicting family house names (e.g., `George [Immatty]` vs `George [Mecheri]`) are never merged or cross-linked.
5. **Religious Title Vocation & Celibacy Inference**:
   - Profiles prefixed with `Fr.` / `Father` (`gender = 'M'`, `job = 'Priest'`) or `Sr.` / `Sister` (`gender = 'F'`, `job = 'Nun'`) are marked celibate and excluded from spousal candidate matching. (Honorific kinship suffixes like `achan` are distinguished from clerical titles and permitted to marry.)

---

## 6. Development, Testing & GitHub Pages Deployment

### Modular Source Tree & Bundler

Source files are organized into 7 modular directories under `src/` and bundled into `App.jsx`:

```bash
# Bundle src/ modules into App.jsx (<250ms)
node scripts/bundle.mjs

# Verify App.jsx matches src/ exactly
node scripts/bundle.mjs --check
```

### Automated 4-Stage Test Suite & Quality Audit

```bash
# Run a single test section in <1s during development
node scripts/run_tests.mjs --skip-ast --section 204

# Run Stages 1-3 (AST parse + Scope check + 2,636 unit tests in ~3s)
node scripts/run_tests.mjs --fast

# Run all 4 stages including Headless Chrome E2E smoke test (~15s)
node scripts/run_tests.mjs

# Run strict code quality audit (<=40 lines/fn, 100% JSDoc, >=2 @example blocks)
node scripts/audit_quality.mjs
```

### Syncing & Deploying to GitHub Pages (`./push.sh`)

To bundle `src/` into `App.jsx`, sync all updated files to the local GitHub clone (`~/.family-tree-github`), commit, and push to `https://github.com/google/family-tree` (which deploys to `https://google.github.io/family-tree/`):

```bash
# Push with an automatic timestamped commit message
./push.sh

# Push with a custom commit message
./push.sh "Add interactive rich-text button hover documentation and elaborate README examples"
```

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for deep architectural documentation, AST quality rules, and contributor workflows.

---

## License

This project is licensed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.
