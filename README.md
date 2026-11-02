# Family Tree Web App

An interactive, zero-build genealogical visualization, demographic deduction, and exploration web application built with **React**, **SVG**, **Leaflet**, and **Tailwind CSS**.

The app reconstructs multi-generational family trees directly from **Google Sheets** (including multi-sheet linked workbooks), automatically deduces missing birth/death years, genders, and kinship links, and renders collision-free chronological diagrams, interactive geographic maps, printable A4 landscape atlases, and a hybrid **Rule + Gemini LLM** genealogy assistant.

---

## Table of Contents

1. [Key Features](#1-key-features)
2. [Quick Start & URL Parameters (`?id=...`)](#2-quick-start--url-parameters-id)
   - [Shareable View URLs (Google-Maps-style `#hash`)](#shareable-view-urls-google-maps-style-hash)
3. [Complete Button & Interactive Control Reference (with Examples)](#3-complete-button--interactive-control-reference-with-examples)
   - [3.1 Top Navigation Toolbar](#31-top-navigation-toolbar)
   - [3.2 Bottom-Right Settings Radial FAB (`⚙`) & Material 3 Themes](#32-bottom-right-settings-radial-fab--material-3-themes)
   - [3.3 Bottom-Left Canvas Camera & Zoom Controls](#33-bottom-left-canvas-camera--zoom-controls)
   - [3.4 Tree Card Controls & Visual Badges](#34-tree-card-controls--visual-badges)
   - [3.5 Person Details Sidebar & Attribute Filter Chips](#35-person-details-sidebar--attribute-filter-chips)
   - [3.6 Quick Directory Browser (`Locations`, `Careers`, `Families`)](#36-quick-directory-browser-locations-careers-families)
   - [3.7 Family Locations Map Controls](#37-family-locations-map-controls)
   - [3.8 AI Genealogy Assistant Controls](#38-ai-genealogy-assistant-controls)
4. [Google Sheets Data Format & Examples](#4-google-sheets-data-format--examples)
   - [4.1 Core Columns & Example Rows](#41-core-columns--example-rows)
   - [4.2 Multi-Sheet Crawling via the `Links` Tab](#42-multi-sheet-crawling-via-the-links-tab)
   - [4.3 Relative Naming & Free-Form Shorthand Examples](#43-relative-naming--free-form-shorthand-examples)
5. [Genealogical Deduction & Demographic Rules (with Examples)](#5-genealogical-deduction--demographic-rules-with-examples)
6. [Development, Testing & GitHub Pages Deployment](#6-development-testing--github-pages-deployment)

---

## 1. Key Features

- **Speech-Balloon Button Hover Help**: Hovering over any button in the UI pops up a speech-balloon help card with a directional pointer tail aimed at the button, a light full-title header (never truncated), a formatted explanation, and concrete usage examples.
- **Material 3 Colour Themes & Radial Settings FAB**: Choose from **10 Material 3 tonal colour themes** (6 light: `Classic`, `Soft Pastel`, `Warm Earthy`, `Deep Ocean`, `Twilight Lavender`, `Solarized Light`; 4 dark: `Charcoal Dark`, `Midnight Slate`, `Solarized Dark`, `High Contrast`) via the floating bottom-right **Settings radial button (`⚙`)**, available on both the home screen and the tree/map views and persisted in a browser cookie (`ft_color_theme`).
- **Multi-Sheet Google Sheets Crawler**: Fetches a root Google Sheet and recursively crawls all linked branch spreadsheets listed in its `Links` tab in parallel, caching datasets locally and live-syncing background updates without jarring camera jumps.
- **Automated Demographic & Kinship Deduction**: Infers missing birth years (`~YOB`), centenarian and sequential-remarriage death statuses, patrilineal family names, religious vocations (`Fr.` / `Sr.`), and intermediate ghost relatives (`Mary Son 1`, `Joy Son 1 Wife`).
- **Chronological 2D Contour Layout**: Positions every person vertically by birth year (`PPY` pixels-per-year timeline) and packs subtrees horizontally using 2D `IntervalContour` profiles with zero card overlaps, chronological multi-spouse ordering, and maternal drop-stem connectors.
- **Hybrid AI Genealogy Assistant**: Combines an instant, 100% deterministic **Genealogy Rule Engine** with optional **Google Gemini LLM** synthesis to answer natural-language questions and highlight mentioned relatives on the canvas.
- **Multi-Format Exports**:
  - **Standalone Interactive HTML App (`.html`)**: Bundles the entire app, Material 3 theme engine, and active lineage into a single offline HTML file.
  - **Multi-Page A4 Landscape Print & Family Atlas**: Generates crisp vector SVG pages scaled so every person's name prints at a readable **10pt physical font size**.
  - **Geographic Locations CSV (`.csv`)**: Exports geocoded ancestral villages, districts, and resident counts.

---

## 2. Quick Start & Shareable URLs (`?<sheetId>#<hash>`)

### Running Locally

1. Start the local zero-cache development server:
   ```bash
   ./start_server.sh 8000
   # or: python3 server.py 8000
   ```
2. Open [http://localhost:8000/](http://localhost:8000/) in your browser.

### The Home Screen: Choosing a Google Sheet

The app does **not** hard-code a spreadsheet. On first visit (and whenever you click the **Family Tree emblem** pinned to the top-left corner of every tree or map view) a full-screen home screen asks for a **Google Sheets link or spreadsheet ID**. Nothing is fetched until you press **Enter** or click **Open**.

| What the textbox is prefilled with | When | Example |
| :--- | :--- | :--- |
| A Google Sheets link or ID found on your **clipboard** | Chrome/Edge, after the clipboard permission is granted (Firefox/Safari do not expose clipboard reads to pages, so they fall through to the next rule) | You copied `https://docs.google.com/spreadsheets/d/1BxiMVs0…/edit` from a chat message |
| Your **most-used** sheet | Whenever this browser has opened at least one sheet before | `https://docs.google.com/spreadsheets/d/<your family's id>/edit` |
| The public **demo** sheet (`Ancestry Browser: Demo`) | Fresh browser, empty clipboard | `https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit?usp=drive_link` |

Whenever the prefilled or typed link/ID matches a spreadsheet whose title is known (from your cookie history, the current session's `Content-Disposition` header, or the built-in `Ancestry Browser: Demo` title), a **sheet name chip** appears directly above the input box so you can verify which family register is selected before pressing **Open**. Every sheet you successfully open is remembered in a first-party **cookie** (`ft_sheet_history`, mirrored into `localStorage` for `file://` standalone exports) together with its spreadsheet **title**. Below the textbox, previously opened sheets are listed **most-used first** as `<Title> — <spreadsheet ID>` with a use counter and a `×` to forget an entry. Clicking a row opens that sheet immediately. The sheet must be shared as *Anyone with the link can view*; a failed import reopens the home screen with the error message.

> **Privacy (GDPR):** the home screen footer states exactly what is stored (the sheet links you open, your deduction settings, and your colour theme), where (cookies / local storage on *this device only* — nothing is sent to any server other than Google Sheets), and offers a one-click **clear stored data** link (also accessible from the bottom-right Settings radial menu) that deletes all stored cookies and their mirrors.

### Loading Any Google Sheet via URL Query Parameters

You can skip the home screen by naming a spreadsheet in the query string. After **any** successful load the app rewrites the address bar (via `history.replaceState`, no reload) to the shortest form — `?d` for the built-in demo sheet or bare `?<spreadsheetId>` (without `id=`) for any other spreadsheet — while continuing to accept legacy `?id=`, `?sheet=`, and `?url=` links.

| Parameter | Format | Concrete Example |
| :--- | :--- | :--- |
| **`?d`** | Built-in public demo spreadsheet | `https://google.github.io/family-tree/?d` |
| **`?<sheetId>`** | Bare Google Spreadsheet ID (`35 to 60` chars) | `https://google.github.io/family-tree/?1SvPspyHtIV2E9UHwpZON8sUTf3FxIuqJZO-wx0WPl3k` |
| **`?id=` / `?sheet=` / `?url=`** | Legacy named parameters (upgraded in-place on load) | `https://google.github.io/family-tree/?id=1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0` |

### Shareable View URLs (Bit-Packed `#hash`)

Every action you take in the app — focusing a person, applying a filter, opening the map, zooming, panning, or folding a sibling bus-bar — is mirrored live into the address bar as a short Base64url `#hash` packet (`#<bitPacket>[.<filterSuffix>]`, typically `1 to 10` characters). Copy the URL to any other computer, phone, or browser window and you get **the same view**: the same person selected, the same zoom level, and the same people in the middle of the screen, even when the screen size differs or rows have since been inserted into the spreadsheet. Legacy `#p=...&z=...&o=...` links remain supported on read.

| View State | Hash Format | Concrete Example |
| :--- | :--- | :--- |
| **Focused person centred at reading zoom** | 6-char Base64url packet (6-bit header + 26-bit person fingerprint + 1-bit `z=0.8`) | `https://google.github.io/family-tree/?d#eKT4c8` |
| **Focused person with panned camera offset** | 9-char packet adding ZigZag-packed `<dx px, dy*10 years>` | `https://google.github.io/family-tree/?1SvPspyHtIV2E9UHwpZON8sUTf3FxIuqJZO-wx0WPl3k#iCzOffI0p` |
| **World map view** | Single Base64url flag (`#2`) | `https://google.github.io/family-tree/?d#2` |
| **Filter or directory tab** | `.` suffix (`p<place>`, `j<job>`, `f<family>`, `s<search>`, `dp`/`dj`/`df`) | `https://google.github.io/family-tree/?d#.pKochi`, `https://google.github.io/family-tree/?d#2.pChalissery` |
| **Folded sibling bus-bar** | Single 27-bit parent-group entry expanding to all foldable children of that parent | `https://google.github.io/family-tree/?d#94K10G1uA20` |

> **Why the link keeps working after the spreadsheet changes:** the camera is stored relative to an anchor person card in unscaled tree pixels horizontally and calendar **years** vertically (`ppy` stretches with window height), never as absolute canvas coordinates. Each person reference is a 26-bit fingerprint `(isGhost, nameHash11, yobTag4, row10)` resolved in three tiers: exact 26-bit match first, then same name hash and birth-year tag at the nearest spreadsheet row, then same name hash within 64 rows (covering corrected birth years).

> **Tip:** The hash is written only after the dataset has loaded and the initial URL view has restored, and never while dragging — so the address bar always holds a stable, copy-ready URL.

---

## 3. Complete Button & Interactive Control Reference (with Examples)

Every button in the application displays a speech-balloon help popover with a pointer tail and concrete usage examples when hovered. Below is the complete reference with examples.

### 3.1 Top Navigation Toolbar

| Button / Icon | Title & Shortcut | Detailed Behavior | Usage Examples |
| :--- | :--- | :--- | :--- |
| **Family Tree Emblem** (top-left corner) | **Family Tree Home – choose a Google Sheet** | Returns to the **home screen** where you paste any Google Sheets link or spreadsheet ID. Every sheet you open is remembered in a browser cookie and offered in a list, most-used first, as `<Title> — <ID>`. Hidden inside standalone `.html` exports, which carry their own embedded dataset. | **1. Switch Family:** Click the emblem, pick `Ancestry Browser: Demo — 1BQvy…` from the list or paste another link, then press **Enter** or **Open**.<br>**2. Shareable Link:** After a sheet loads the address bar carries `?<sheetId>` (or `?d` for the demo); share it and the recipient skips the home screen entirely. |
| **Download Icon** (`⬇`) | **Download Standalone Interactive App (`.html`)** | Packages the entire interactive React/SVG application, Material 3 theme engine, and the currently focused lineage dataset into a single self-contained `.html` file that runs 100% offline in any browser. | **1. Full Family Archive:** Focus on the root ancestor (`Kochuvareed`) and click `⬇` to download `Kochuvareed_Interactive_App_2026-09-27.html` containing all 240+ profiles.<br>**2. Scoped Sub-Branch App:** Select a specific grandparent first to export an offline interactive tree scoped only to their ancestors and descendants. |
| **Printer Icon** (`🖨`) | **Print Tree / Export A4 Landscape SVGs (10pt names)** | Generates a multi-page A4 landscape printable document and **Family Atlas** with vector SVG cards calibrated so every person's name renders at a readable **10pt physical font size**. | **1. Multi-Page Wall Poster:** Click `🖨` to open the A4 print preview, save as **PDF**, and tape adjacent tiled pages together using the alignment guides.<br>**2. Branch Atlas Chapters:** Deep sub-branches are automatically organized into numbered **Atlas Chapters** with cross-page reference badges. |
| **Map Pin Icon** (`📍`) | **View Family Locations Map** / **Switch to Family Tree Diagram** | Toggles the main viewport between the chronological 2D family tree diagram and an interactive **Leaflet World Map** plotting ancestral towns, parishes, and diaspora cities with member count pins. | **1. Explore Regional Clusters:** Click `📍` to view family concentrations across **Kerala** (`Thrissur`, `Palakkad`, `Kottayam`), **Karnataka**, and global diaspora hubs.<br>**2. Pin-to-Tree Spotlight:** Click a town pin on the map (e.g., `Chalissery`), then click `📍` again to see those exact residents highlighted on the tree canvas. |
| **Sparkles Icon** (`✨`) | **Ask AI** | Opens the **AI Genealogy Assistant** panel to answer natural-language questions about kinship paths, ancestral origins, birth/death cohorts, and tree statistics. | **1. Relationship Tracing:** Ask `"How is Eliamma related to Vareeth?"` or `"Who are the children of Joseph and Thankamma?"`<br>**2. Demographic Superlatives:** Ask `"Who lived the longest?"` or `"Who all lived in Moonilavu?"` to highlight matching cards on the canvas. |
| **Terminal / Log Icon** (`📋`) | **View Logs** | Opens the **Ingestion & Audit Logs** drawer showing live parallel sheet crawl progress, merged duplicate profiles, deduced birth/death years, and biological or kinship audit warnings. | **1. Spreadsheet Row Citations:** Click any `[Parathottiyil:53]` badge in the log to open row 53 directly in Google Sheets.<br>**2. Audit Data Warnings:** Review parent-child age-gap warnings, ambiguous parent candidates, and disconnected subtree roots. |
| **Magnifying Glass** (`🔍`) | **Search** (`Cmd+K` / `Ctrl+K`) | Expands the **Omni Search** bar to find people by name or nickname, filter by location, family house, or career, or dispatch natural-language questions to the AI Assistant. | **1. Person & Nickname Jump:** Press `Cmd+K` and type `"Kochuthresia"` or `"Kunjappan"` to center the camera on their card.<br>**2. Category Spotlight:** Type `"Teacher"` or `"Palakkad"` and press `Enter` to highlight all matching profiles across the tree. |
| **Left Chevron** (`‹`) | **Go Back** | Steps backward to the previously focused person profile or directory filter in your session navigation history stack. | **1. Retrace Ancestor Jumps:** After clicking from a child up to their father and grandfather, click `‹` to return to the child.<br>**2. Restore Filter List:** Step back from an individual profile to the `Location: Thrissur` filter list you were browsing earlier. |
| **Right Chevron** (`›`) | **Go Forward** | Steps forward in your session navigation history stack after using **Go Back**. | **1. Redo Profile Focus:** Click `›` to return to the descendant profile you inspected before stepping back.<br>**2. Compare Branches:** Alternate between `‹` and `›` to compare two distant cousin branches. |

---

### 3.2 Bottom-Right Settings Radial FAB (`⚙`) & Material 3 Themes

Pinned to the bottom-right corner on both the **Home Screen** and the **Tree / Map** views (`fixed bottom-6 right-6`), the circular **Settings** button fans out three satellite actions along a quarter-circle arc (`90° → 180°`):

| Button / Satellite | Title | Detailed Behavior | Usage Examples |
| :--- | :--- | :--- | :--- |
| **Gear FAB** (`⚙`) | **Settings – themes, deduction rules & privacy** | Toggles the quarter-circle radial menu with three satellite actions (`Colour theme`, `Deduction rules`, `Clear stored data`). Closes automatically on outside click or `Escape`. | **1. Theme Switch from Home Screen:** Click `⚙` on the initial home screen before loading any sheet to pick a dark or pastel palette.<br>**2. Quick Rule Tweak:** Click `⚙` while viewing the tree to adjust cohort marriage ages and rebuild in place. |
| **Palette Satellite** (`🎨`) | **Colour theme (Material 3 palettes)** | Opens the **Appearance** tab of the Settings dialog with **10 Material 3 tonal colour themes**: `Classic Forest`, `Soft Pastels`, `Earthy & Warm`, `Ocean Breeze`, `Lavender Dusk`, `Solarized Light`, `Dark Forest`, `Midnight Black`, `Solarized Dark`, and `High Contrast`. Persisted in `ft_color_theme`. | **1. Warm Parchment Look:** Select **Earthy & Warm** for terracotta, olive, and ochre cards on a warm parchment canvas.<br>**2. OLED Night Browsing:** Select **Midnight Black** or **Solarized Dark** to invert surfaces, connectors, and cards for low-light reading. |
| **Sliders Satellite** (`🎚`) | **Deduction Settings (marriage age by birth cohort)** | Opens the **Deduction rules** tab: bride's age at first marriage per birth cohort (`1900–2020`), wedding→first-child interval, husband–wife age offset, and sibling spacing, with a live cohort preview. **Apply & rebuild tree** saves to `ft_demographic_settings` and rebuilds from cached rows without refetching. | **1. Later Marriages:** Raise the `1940` cohort from **22** to **25** and every mother born in the 1940s is deduced three years older.<br>**2. Reset:** Click **Reset to defaults** then **Apply & rebuild tree** to return to the shipped curve. |
| **Eraser Satellite** (`🧹`) | **Clear stored data (cookies & local storage)** | Deletes the sheet-history cookie (`ft_sheet_history`), deduction-settings cookie (`ft_demographic_settings`), colour-theme cookie (`ft_color_theme`), and their `localStorage` mirrors, resetting the theme to `Classic Forest` and deduction rules to defaults. | **1. Shared Computer Cleanup:** Click `⚙` → `🧹` before leaving a shared browser so your opened sheet links are forgotten.<br>**2. Fresh Start:** Clear all saved preferences in one click from either the radial menu or the home screen privacy notice. |

---

### 3.3 Bottom-Left Canvas Camera & Zoom Controls

| Button | Title | Detailed Behavior | Usage Examples |
| :--- | :--- | :--- | :--- |
| **`+`** | **Zoom In** | Increases canvas magnification (`1.3x` per click) around the viewport center to inspect detailed person cards, lifespan badges, and connectors. | **1. Read Card Details:** Click `+` (or scroll wheel up) to inspect nicknames, deduced `~YOB` badges, and occupation labels.<br>**2. Dense Sibling Groups:** Magnify large 8+ sibling families to inspect individual birth order and spouse bridges. |
| **`−`** | **Zoom Out** | Decreases canvas magnification (`1 / 1.3x` per click) to show a broader multi-generational panorama alongside the left-hand century timeline. | **1. 6-Generation Overview:** Click `−` repeatedly to view lineages spanning from the 1850s to the 2020s in one frame.<br>**2. Subtree Packing Inspection:** Zoom out to see how first-wife and second-wife descendant subtrees pack without crossing. |
| **Person / Home Icon** | **Reset to Root Person** | Selects the oldest root ancestor of the loaded family tree, opens their details sidebar, and smoothly pans the camera to the top of the diagram. | **1. Return to Founding Ancestor:** Click after exploring 5th-generation descendants to jump straight back to the founding patriarch/matriarch.<br>**2. Reset Subtree Rerooting:** Restores the full connected tree if the canvas was temporarily rerooted on an in-law branch. |
| **Frame / Corners Icon** | **Fit to Screen** | Computes the exact bounding box of all currently expanded person nodes, closes open sidebars for full screen width, and scales/centers the tree to fit the viewport. | **1. Re-Center After Collapse:** Click after collapsing or expanding major branches to frame the active diagram cleanly.<br>**2. Full-Screen Presentation:** Automatically dismisses the right-hand sidebar and frames the complete tree beside the timeline. |

---

### 3.4 Tree Card Controls & Visual Badges

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

### 3.5 Person Details Sidebar & Attribute Filter Chips

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

### 3.6 Quick Directory Browser (`Locations`, `Careers`, `Families`)

Accessible via the **Open Directory** button in the sidebar header or from the Map view:

- **`Locations (N)` Tab**:
  - Organizes all ancestral and diaspora places into a collapsible 4-level geographic hierarchy: **Country → State → District → Town/Village**.
  - **Example:** Expand `India → Kerala → Thrissur` and click `Chalissery` to filter the tree or fly the map camera to Chalissery.
- **`Careers (N)` Tab**:
  - Lists all explicit professions and deduced vocations (`Teacher`, `Engineer`, `Doctor`, `Farmer`, `Priest`, `Nun`) sorted by member count.
- **`Families (N)` Tab**:
  - Lists all family house names / surnames (`Thalakkottukara`, `Parathottiyil`, `Kizhakkumthala`, `Alappatt`, etc.), including patrilineally inherited house names.

---

### 3.7 Family Locations Map Controls

When viewing the interactive **Family Locations Map**, a floating control bar appears at the bottom:

- **`Tree View`**: Switches back to the 2D genealogical diagram while preserving your active location filter or selected person.
- **`Export CSV`**: Downloads `Family_Locations_Map.csv` containing every geocoded location, latitude/longitude coordinates, resident count, and member names.
- **`Show Directory` / `Hide Directory`**: Toggles the right-hand Quick Directory sidebar so you can click regions to fly the map camera or collapse the panel for a full-screen map.

---

### 3.8 AI Genealogy Assistant Controls

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
| **`Sibling`** | `Brother`, `Sister`, `Sibling any one of them` | `Paul`, `Margaret` (resolved to the age-plausible namesake on the same sheet that shares the row's family name, else the nearest one: `Mathayi` on the next row rather than a `Mathayi` 45 rows above; `Paul` [Chiramal] rather than a nearer `Paul` [Kanjiraparamban] when the row says `Chiramal`) |
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

1. **Cohort-Aware Maternal & Spousal Birth Year Inference**:
   - **Marriage age by birth cohort:** the bride's age at first marriage is read from a piecewise-linear curve over her *birth year* — `[1900, 15] → [1928, 15] → [1940, 22] → [1970, 25] → [2000, 27] → [2020, 28]` (women born in the 1910s–20s married at ~15, those born in the 1940s at 20–25, those born in the 2000s at 25–30); years before/after the anchors clamp to the nearest one.
   - **Maternal Gap (cohort-dependent):** if a mother's birth year is unknown it is deduced from her eldest child by *inverting* that curve (`mother.yob = firstChild.yob - (marriageAge(mother cohort) + 2)`), so a child born in 1935 implies a ~1918 mother while a child born in 2005 implies a ~1978 mother. Deducing downward uses the parent's own cohort (`firstChild.yob = mother.yob + marriageAge(mother.yob) + 2`).
   - **Spousal Offset (`2 yrs`):** If one spouse's birth year is unknown, the husband is deduced as 2 years older than the wife (`husband.yob = wife.yob - 2`, `wife.yob = husband.yob + 2`); paternal gaps are the maternal gap of the offset-younger wife plus the offset.
   - **Second Wife / Remarriage Inference:** When a widower remarries and the second wife's birth year is unknown, she is assumed to have married at the marriage age of her own cohort in the wedding year estimated from the first wife's last child (`secondWife.yob = weddingYear - brideAgeAtMarriageYear(weddingYear)`).
   - **User-tunable:** every value above (the anchor rows, the wedding→first-child interval, the spousal offset and the sibling spacing) can be changed in the **Deduction Settings** panel (`⚙`); the choice is stored in a cookie and applied before the first build on the next visit.
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
node scripts/run_tests.mjs --skip-ast --section 213

# Run Stages 1-3 (AST parse + Scope check + 2,959 unit tests in ~3s)
node scripts/run_tests.mjs --fast

# Run all 4 stages including the Headless Chrome E2E flow (home screen → radial FAB → Open → tree → balloon tooltip → Home button, ~20s)
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
