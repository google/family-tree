
/**
 * Floating zoom and camera framing controls overlay for the tree canvas.
 *
 * @param {object} props
 * @param {Function} props.setCamera - State updater for camera coordinates and scale
 * @param {Function} props.clampCamera - Clamping function constraining camera within valid viewport bounds
 * @param {Function} props.centerOnPerson - Smoothly centers the camera on a specific person card
 * @param {Function} props.fitToScreen - Auto-fits the entire active tree within the viewport
 * @param {string|null} props.focusId - ID of currently selected person
 * @param {string|null} props.rootId - ID of active tree root
 * @param {Function} props.setIsSidebarVisible - Toggle for details sidebar panel
 * @param {Function} [props.closeAllPanels] - Optional callback to close all overlay panels
 * @returns {React.ReactNode}
 *
 * @example
 * <ZoomControls
 *   setCamera={setCamera}
 *   clampCamera={clampCamera}
 *   centerOnPerson={centerOnPerson}
 *   fitToScreen={fitToScreen}
 *   focusId={focusId}
 *   rootId={tree.rootId}
 *   setIsSidebarVisible={setIsSidebarVisible}
 *   closeAllPanels={closeAllPanels}
 * />
 *
 * @example
 * <ZoomControls
 *   setCamera={() => {}}
 *   clampCamera={(c) => c}
 *   centerOnPerson={() => {}}
 *   fitToScreen={() => {}}
 *   focusId={null}
 *   rootId={null}
 *   setIsSidebarVisible={() => {}}
 * />
 */
const ZoomControls = ({ setCamera, clampCamera, centerOnPerson, fitToScreen, focusId, rootId, setIsSidebarVisible, closeAllPanels }) => {
    const handleZoom = (delta) => {
        setCamera(cam => clampCamera({ ...cam, z: cam.z + delta }));
        if (closeAllPanels) {
            closeAllPanels();
        } else {
            setIsSidebarVisible(false);
        }
    };

    return (
        <div className="absolute bottom-6 left-16 z-50 flex gap-2 pointer-events-auto bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-md border border-slate-200">
            <button onClick={() => handleZoom(0.15)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors" title="Zoom In"><Icons.ZoomIn /></button>
            <div className="w-px bg-slate-200 my-1"></div>
            <button onClick={() => handleZoom(-0.15)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors" title="Zoom Out"><Icons.ZoomOut /></button>
            <div className="w-px bg-slate-200 my-1"></div>
            <button onClick={() => fitToScreen()} className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors" title="Fit to Screen"><Icons.Maximize /></button>
            <div className="w-px bg-slate-200 my-1"></div>
            <button onClick={() => { centerOnPerson(focusId || rootId, 0.80); setIsSidebarVisible(true); }} className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors" title="Center Focus"><Icons.Target /></button>
        </div>
    );
};

/**
 * Generational cohorts (Strauss-Howe generational theory) mapped across historical eras.
 * Hoisted to module level to eliminate per-render array allocations.
 */
const HISTORICAL_GENERATION_COHORTS = Object.freeze([
    { name: "Ancestral", start: 1650, end: 1701, color: "bg-slate-500/10", text: "text-slate-600" },
    { name: "Awakening", start: 1701, end: 1724, color: "bg-amber-500/10", text: "text-amber-600" },
    { name: "Liberty", start: 1724, end: 1742, color: "bg-lime-500/10", text: "text-lime-600" },
    { name: "Republican", start: 1742, end: 1767, color: "bg-emerald-500/10", text: "text-emerald-600" },
    { name: "Compromise", start: 1767, end: 1792, color: "bg-teal-500/10", text: "text-teal-600" },
    { name: "Transcendental", start: 1792, end: 1822, color: "bg-cyan-500/10", text: "text-cyan-600" },
    { name: "Gilded", start: 1822, end: 1843, color: "bg-sky-500/10", text: "text-sky-600" },
    { name: "Progressive", start: 1843, end: 1860, color: "bg-indigo-500/10", text: "text-indigo-600" },
    { name: "Missionary", start: 1860, end: 1883, color: "bg-purple-500/10", text: "text-purple-600" },
    { name: "Lost Gen", start: 1883, end: 1901, color: "bg-stone-500/10", text: "text-stone-600" },
    { name: "Greatest", start: 1901, end: 1928, color: "bg-rose-500/10", text: "text-rose-600" },
    { name: "Silent", start: 1928, end: 1946, color: "bg-orange-500/10", text: "text-orange-600" },
    { name: "Boomers", start: 1946, end: 1965, color: "bg-emerald-500/10", text: "text-emerald-600" },
    { name: "Gen X", start: 1965, end: 1981, color: "bg-cyan-500/10", text: "text-cyan-600" },
    { name: "Millennials", start: 1981, end: 1997, color: "bg-blue-500/10", text: "text-blue-600" },
    { name: "Gen Z", start: 1997, end: 2013, color: "bg-indigo-500/10", text: "text-indigo-600" },
    { name: "Gen Alpha", start: 2013, end: 2030, color: "bg-violet-500/10", text: "text-violet-600" }
]);

/**
 * Renders vertical generational era bands and milestone year labels on the timeline margin.
 *
 * @param {object} props
 * @param {number[]} props.dynamicYears - Array of timeline interval years to render
 * @param {number} props.rootNodeYob - Year of birth of tree root baseline
 * @param {number} props.maxYear - Maximum year represented in tree
 * @param {object} props.camera - Active camera coordinate and zoom transform
 * @param {number} props.ppy - Pixels per calendar year scaling factor
 * @returns {React.ReactNode}
 *
 * @example
 * <TimelineLabels
 *   dynamicYears={[1900, 1950, 2000]}
 *   rootNodeYob={1900}
 *   maxYear={2025}
 *   camera={{ x: 0, y: 0, z: 1 }}
 *   ppy={20}
 * />
 *
 * @example
 * <TimelineLabels
 *   dynamicYears={[]}
 *   rootNodeYob={1850}
 *   maxYear={1980}
 *   camera={{ x: 100, y: 50, z: 0.8 }}
 *   ppy={15}
 * />
 */
const TimelineLabels = ({ dynamicYears, rootNodeYob, maxYear, camera, ppy }) => {
    const GENERATIONS = HISTORICAL_GENERATION_COHORTS;

    return (
        <div className="absolute top-0 left-0 bottom-0 w-12 pointer-events-none z-20 border-r border-slate-200 bg-[#f8fafc]/90 backdrop-blur-sm shadow-[2px_0_4px_rgba(0,0,0,0.02)] font-sans overflow-hidden">
            {GENERATIONS.map(gen => {
                if (maxYear && gen.start > maxYear) return null;
                const effectiveEnd = maxYear ? Math.min(gen.end, maxYear) : gen.end;
                const startY = ((gen.start - rootNodeYob) * ppy + 24) * camera.z + camera.y;
                const endY = ((effectiveEnd - rootNodeYob) * ppy + 24) * camera.z + camera.y;
                const height = Math.max(0, endY - startY);
                if (height <= 0) return null;
                return (
                    <div key={gen.name} className={`absolute left-0 w-full flex items-center justify-start pl-0.5 border-b border-black/5 overflow-hidden ${gen.color}`} style={{ top: startY, height }}>
                        <span className={`text-[10px] leading-tight font-bold uppercase tracking-widest opacity-60 ${gen.text}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{gen.name}</span>
                    </div>
                );
            })}
            {dynamicYears.map(year => (
                <div key={`label-${year}`} className="absolute w-full text-right pr-1 text-[10px] tracking-wider font-bold text-slate-600 py-1 z-10" style={{ top: ((year - rootNodeYob) * ppy + 24) * camera.z + camera.y, transform: 'translateY(-50%)' }}>{year}</div>
            ))}
        </div>
    );
};
TimelineLabels.GENERATIONS = HISTORICAL_GENERATION_COHORTS;

/**
 * Renders dashed horizontal background grid lines corresponding to timeline years across the canvas.
 *
 * @param {object} props
 * @param {number[]} props.dynamicYears - Array of calendar years for horizontal gridlines
 * @param {number} props.rootNodeYob - Base year of birth for y-offset computation
 * @param {object} props.camera - Canvas viewport camera state
 * @param {number} props.ppy - Pixels per year layout scale
 * @param {boolean} [props.isStandalone=false] - Whether running in standalone mode (adjusts left padding)
 * @returns {React.ReactNode}
 *
 * @example
 * <TimelineGrid
 *   dynamicYears={[1920, 1940, 1960, 1980, 2000]}
 *   rootNodeYob={1920}
 *   camera={{ x: 0, y: 0, z: 1 }}
 *   ppy={20}
 *   isStandalone={false}
 * />
 *
 * @example
 * <TimelineGrid
 *   dynamicYears={[1950, 2000]}
 *   rootNodeYob={1900}
 *   camera={{ x: 0, y: 50, z: 0.5 }}
 *   ppy={10}
 *   isStandalone={true}
 * />
 */
const TimelineGrid = ({ dynamicYears, rootNodeYob, camera, ppy, isStandalone = false }) => (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {dynamicYears.map(year => (
            <div key={`line-${year}`} className={`absolute w-full ${isStandalone ? 'pl-4' : 'pl-12'}`} style={{ top: ((year - rootNodeYob) * ppy + 24) * camera.z + camera.y, transform: 'translateY(-50%)' }}>
                <div className="w-full border-t border-slate-300 border-dashed"></div>
            </div>
        ))}
    </div>
);

/**
 * Utility helpers for formatting, bundling, and exporting family tree artifacts
 * (CSV spreadsheets, vector HTML diagrams, and standalone single-file apps).
 *
 * @example
 * const ts = ExportUtils.formatTimestamp(new Date());
 * console.log(`Export timestamp: ${ts}`);
 *
 * @example
 * const csv = ExportUtils.generateCsv(peopleMap, 'Raphael');
 * ExportUtils.downloadFile(csv, 'family_tree.csv', 'text/csv;charset=utf-8;');
 */
class ExportUtils {
    /**
     * Formats a date object into a filename-safe timestamp string.
     *
     * Format: YYYY-MM-DD_HH-mm-ss (with zero-padded 2-digit components).
     *
     * @param {Date} [date=new Date()] - Date to format
     * @returns {string} Safe timestamp string for filenames
     *
     * @example
     *   ExportUtils.formatTimestamp(new Date(2026, 8, 1, 15, 30, 45));
     *   // => "2026-09-01_15-30-45"
     *
     * @example
     *   ExportUtils.formatTimestamp(new Date(2026, 0, 5, 9, 4, 7));
     *   // => "2026-01-05_09-04-07"
     */
    static formatTimestamp(date = new Date()) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    }

    /**
     * Sanitizes a person or tree name into a filesystem-safe filename token.
     *
     * Replaces non-alphanumeric characters (except hyphens and underscores) with underscores.
     *
     * @param {string} [name] - Raw label to sanitize
     * @param {string} [fallback='Family_Tree'] - Fallback name if input is empty
     * @returns {string} Sanitized string safe for file downloads
     *
     * @example
     *   ExportUtils.sanitizeFilename("John Doe");
     *   // => "John_Doe"
     *
     * @example
     *   ExportUtils.sanitizeFilename("Kochi / Kerala");
     *   // => "Kochi___Kerala"
     */
    static sanitizeFilename(name, fallback = 'Family_Tree') {
        return (name || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * Predicate determining whether a DOM node should be included when rendering vector SVG exports.
     * Excludes navigation overlays, directories, and elements marked with data-export-ignore.
     *
     * @param {Node} node - DOM node evaluated by html-to-image
     * @returns {boolean} True if the element should be rendered in the export
     *
     * @example
     *   ExportUtils.isExportableSvgNode(document.createElement('div'));
     *   // => true
     *
     * @example
     *   const el = document.createElement('div');
     *   el.className = 'export-ignore';
     *   ExportUtils.isExportableSvgNode(el);
     *   // => false
     */
    static isExportableSvgNode(node) {
        if (node && node.nodeType === 1) {
            if (
                node.classList?.contains('quick-directory-selector') ||
                node.classList?.contains('export-ignore') ||
                node.getAttribute?.('data-export-ignore') === 'true' ||
                node.hasAttribute?.('data-export-ignore')
            ) {
                return false;
            }
        }
        return true;
    }

    /**
     * Groups living, non-ghost individuals by their trimmed location string.
     *
     * @param {FamilyTree} tree - Active family tree model
     * @returns {Record<string, Array<Person>>} Dictionary mapping location to resident Person objects
     *
     * @example
     * ExportUtils._collectLocationResidentGroups(tree)
     * // => { 'Thrissur': [personA, personB] }
     *
     * @example
     * ExportUtils._collectLocationResidentGroups(null)
     * // => {}
     */
    static _collectLocationResidentGroups(tree) {
        const locGroups = {};
        if (!tree || !tree.all) return locGroups;
        tree.all.forEach(p => {
            if (p.place && !p.isGhost && !p._isUnknown) {
                const loc = p.place.trim();
                if (!locGroups[loc]) locGroups[loc] = [];
                locGroups[loc].push(p);
            }
        });
        return locGroups;
    }

    /**
     * Formats a single person's demographic summary bullet point for CSV export.
     *
     * @param {Person} p - Target person
     * @returns {string} Formatted bullet point string
     *
     * @example
     * ExportUtils._formatResidentCsvDetail({ name: 'John', family: 'Doe', yob: 1950, job: 'Farmer' })
     * // => "• John Doe (b. 1950) - Farmer"
     *
     * @example
     * ExportUtils._formatResidentCsvDetail({ name: 'Mary' })
     * // => "• Mary"
     */
    static _formatResidentCsvDetail(p) {
        return `• ${p.name}${p.family ? ` ${p.family}` : ''}${p.yob ? ` (b. ${p.yob})` : ''}${p.job ? ` - ${p.job}` : ''}`;
    }

    /**
     * Generates CSV content summarizing residents grouped by location across the tree.
     *
     * Filters out ghost and unknown entries, aggregates individuals under each trimmed
     * location name, formats family member bullet summaries, and produces a UTF-8 BOM CSV.
     *
     * @param {FamilyTree} tree - The populated family tree instance
     * @returns {string|null} UTF-8 BOM CSV text, or null if no valid locations exist
     *
     * @example
     *   ExportUtils.generateMapLocationsCSV(treeWithResidents);
     *   // => "\uFEFFLocation,Total Residents,Family Members\n..."
     *
     * @example
     *   ExportUtils.generateMapLocationsCSV(null);
     *   // => null
     */
    static generateMapLocationsCSV(tree) {
        const locGroups = this._collectLocationResidentGroups(tree);
        if (Object.keys(locGroups).length === 0) return null;

        const rows = [['Location', 'Total Residents', 'Family Members']];
        Object.entries(locGroups).forEach(([loc, people]) => {
            const details = people.map(p => this._formatResidentCsvDetail(p)).join('\n');
            rows.push([`"${String(loc).replace(/"/g, '""')}"`, people.length, `"${String(details).replace(/"/g, '""')}"`]);
        });

        return "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    }

    /**
     * Searches localStorage for any cached spreadsheet rows matching the provided key prefix.
     *
     * @param {string} prefix - LocalStorage key prefix to search for
     * @returns {Array<Object>|null} Cached rows array or null if none found
     *
     * @example
     * ExportUtils._findCachedRowsInLocalStorage('ft_cache_')
     * // => [{ name: 'John Doe', ... }]
     *
     * @example
     * ExportUtils._findCachedRowsInLocalStorage('nonexistent_')
     * // => null
     */
    static _findCachedRowsInLocalStorage(prefix) {
        if (typeof localStorage === 'undefined') return null;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    const cached = JSON.parse(localStorage.getItem(k));
                    if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
                        return cached.rows;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * Resolves raw profile rows to embed into the standalone app bundle using a 4-tier fallback:
     * 1. In-memory `tree.rawRows`
     * 2. `TreeDataCache` entry for the active sheet URL
     * 3. Global `window._cachedLiveRows.allRows`
     * 4. Any cached dataset in `localStorage` starting with `TreeDataCache.CACHE_PREFIX`
     *
     * @param {FamilyTree} tree - Active family tree model
     * @param {string} [sheetUrl] - Active Google Sheet URL
     * @returns {Array<Object>} Array of raw spreadsheet row objects
     * @throws {Error} If no dataset rows could be located across any storage tier
     *
     * @example
     * ExportUtils.resolveExportableRows(treeWithRows)
     * // => [{ name: 'John Doe', ... }]
     *
     * @example
     * ExportUtils.resolveExportableRows(emptyTree, 'https://docs.google.com/spreadsheets/d/123')
     * // => [{ name: 'Cached Person', ... }]
     */
    static resolveExportableRows(tree, sheetUrl) {
        let rowsToEmbed = (tree && Array.isArray(tree.rawRows) && tree.rawRows.length > 0)
            ? tree.rawRows
            : (TreeDataCache.get(sheetUrl)?.rows || []);

        if ((!rowsToEmbed || rowsToEmbed.length === 0) && typeof window !== 'undefined' && window._cachedLiveRows) {
            rowsToEmbed = window._cachedLiveRows.allRows || [];
        }

        if (!rowsToEmbed || rowsToEmbed.length === 0) {
            rowsToEmbed = this._findCachedRowsInLocalStorage(TreeDataCache.CACHE_PREFIX) || [];
        }

        if (!rowsToEmbed || rowsToEmbed.length === 0) {
            throw new Error("No family tree profile rows available to embed. Please import data first.");
        }
        return rowsToEmbed;
    }

    /**
     * Triggers a browser file download for a given Blob or object URL and cleans up the resource.
     *
     * @param {Blob|string} blobOrUrl - Blob or object URL to download
     * @param {string} filename - Suggested filename for the download
     *
     * @example
     *   ExportUtils.triggerDownload(new Blob(['hello']), 'test.txt');
     *
     * @example
     *   ExportUtils.triggerDownload('blob:https://...', 'export.html');
     */
    static triggerDownload(blobOrUrl, filename) {
        const url = (typeof blobOrUrl === 'string') ? blobOrUrl : URL.createObjectURL(blobOrUrl);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Enqueues unvisited node IDs into the traversal queue.
     *
     * @param {Iterable<string>} ids - Candidate IDs to enqueue
     * @param {Set<string>} visited - Set of already-visited IDs
     * @param {Array<string>} queue - Traversal queue
     *
     * @example
     *   ExportUtils._enqueueUnvisited(['p1', 'p2'], new Set(), []);
     *
     * @example
     *   ExportUtils._enqueueUnvisited(['p1'], new Set(['p1']), []);
     */
    static _enqueueUnvisited(ids, visited, queue) {
        if (!ids) return;
        for (const id of ids) {
            if (id && !visited.has(id)) {
                visited.add(id);
                queue.push(id);
            }
        }
    }

    /**
     * Identifies all downstream descendants (children, grandchildren, etc.) of a set of seed profiles.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Set<string>} seedIds - Initial profile IDs
     * @returns {Set<string>} Set of descendant person IDs
     *
     * @example
     *   ExportUtils._collectDescendants(tree, new Set(['p1']));
     *   // => Set { 'p2', 'p3' }
     *
     * @example
     *   ExportUtils._collectDescendants(tree, new Set());
     *   // => Set {}
     */
    static _collectDescendants(tree, seedIds) {
        const descendantIds = new Set();
        const descQueue = [];
        const enqueueChildren = (children) => {
            if (!children) return;
            for (const childId of children) {
                if (childId && !seedIds.has(childId) && !descendantIds.has(childId)) {
                    descendantIds.add(childId);
                    descQueue.push(childId);
                }
            }
        };

        for (const sId of seedIds) {
            const sPerson = tree.get(sId);
            if (sPerson) enqueueChildren(sPerson.children);
        }
        while (descQueue.length > 0) {
            const curr = tree.get(descQueue.shift());
            if (curr) enqueueChildren(curr.children);
        }
        return descendantIds;
    }

    /**
     * Identifies marrying-in partners of descendants who are not themselves seeds or descendants.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Set<string>} descendantIds - Set of descendant IDs
     * @param {Set<string>} seedIds - Set of seed IDs
     * @returns {Set<string>} Set of marrying-in partner IDs
     *
     * @example
     *   ExportUtils._collectDescendantSpouses(tree, new Set(['c1']), new Set(['p1']));
     *   // => Set { 'spouse1' }
     *
     * @example
     *   ExportUtils._collectDescendantSpouses(tree, new Set(), new Set());
     *   // => Set {}
     */
    static _collectDescendantSpouses(tree, descendantIds, seedIds) {
        const descendantSpouseIds = new Set();
        for (const dId of descendantIds) {
            const dPerson = tree.get(dId);
            if (!dPerson) continue;
            for (const partnerId of (dPerson.partners || [])) {
                if (partnerId && !seedIds.has(partnerId) && !descendantIds.has(partnerId)) {
                    descendantSpouseIds.add(partnerId);
                }
            }
        }
        return descendantSpouseIds;
    }

    /**
     * Collects all spreadsheet row references associated with a person across source IDs and multi-sheet references.
     * 
     * @param {Object} person - Domain Person instance
     * @param {Set<string>} refs - Output set accumulating "sheetId:row" keys
     *
     * @example
     *   const refs = new Set();
     *   ExportUtils._collectPersonRowRefs({ _sourceId: 's1', _sheetRow: 10 }, refs);
     *   // refs contains 's1:10'
     *
     * @example
     *   const refs = new Set();
     *   ExportUtils._collectPersonRowRefs({ _sheetRows: { s1: 4, s2: 7 } }, refs);
     *   // refs contains 's1:4', 's2:7'
     */
    static _collectPersonRowRefs(person, refs) {
        const addRef = (sheetId, row) => {
            if (row !== undefined && row !== null) {
                refs.add(`${sheetId || 'default'}:${row}`);
            }
        };

        if (Array.isArray(person._allSourceRefs)) {
            person._allSourceRefs.forEach(ref => ref && addRef(ref.sheetId, ref.row));
        }
        if (person._sheetRows && typeof person._sheetRows === 'object') {
            Object.entries(person._sheetRows).forEach(([sid, row]) => addRef(sid, row));
        }
        addRef(person._sourceId, person._sheetRow);
    }

    /**
     * Indexes normalized person names and nicknames into global and per-sheet name sets.
     * 
     * @param {Object} person - Domain Person instance
     * @param {Set<string>} globalNames - Set of all known normalized names and nicknames
     * @param {Map<string, Set<string>>} namesBySheet - Map of sheet ID to set of normalized names on that sheet
     *
     * @example
     *   const globalNames = new Set();
     *   const namesBySheet = new Map();
     *   ExportUtils._indexPersonNames({ name: 'John Doe', _sourceId: 's1', nick: 'Johnny' }, globalNames, namesBySheet);
     *   // globalNames has 'john doe', 'johnny'; namesBySheet.get('s1') has 'john doe'
     *
     * @example
     *   const globalNames = new Set();
     *   const namesBySheet = new Map();
     *   ExportUtils._indexPersonNames({ name: 'Mary', nick: '' }, globalNames, namesBySheet);
     *   // globalNames has 'mary'
     */
    static _indexPersonNames(person, globalNames, namesBySheet) {
        const norm = person._normName || (person.name ? person.name.toLowerCase().trim() : '');
        if (norm && !person.isGhost && !person._isUnknown) {
            globalNames.add(norm);
            const sids = person._sourceIds ? Array.from(person._sourceIds) : [person._sourceId || 'default'];
            sids.forEach(sid => {
                const k = sid || 'default';
                if (!namesBySheet.has(k)) namesBySheet.set(k, new Set());
                namesBySheet.get(k).add(norm);
            });
        }
        if (person.nick) {
            const normNick = person.nick.toLowerCase().trim();
            if (normNick) globalNames.add(normNick);
        }
    }

    /**
     * Builds index sets and sheet maps for fast lookup of sheet row references and normalized names.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Iterable<string>} personIds - Person IDs to index
     * @returns {{ refs: Set<string>, namesBySheet: Map<string, Set<string>>, globalNames: Set<string> }}
     *
     * @example
     *   const index = ExportUtils._buildLineageRefIndex(tree, ['p1', 'p2']);
     *   // => { refs: Set { ... }, namesBySheet: Map { ... }, globalNames: Set { ... } }
     *
     * @example
     *   const index = ExportUtils._buildLineageRefIndex(tree, []);
     *   // => { refs: Set {}, namesBySheet: Map {}, globalNames: Set {} }
     */
    static _buildLineageRefIndex(tree, personIds) {
        const refs = new Set();
        const namesBySheet = new Map();
        const globalNames = new Set();

        personIds.forEach(id => {
            const p = tree.get(id);
            if (!p) return;

            ExportUtils._collectPersonRowRefs(p, refs);
            ExportUtils._indexPersonNames(p, globalNames, namesBySheet);
        });

        return { refs, namesBySheet, globalNames };
    }

    /**
     * Sanitizes parental and outside sibling columns on a row belonging to a descendant spouse,
     * preventing spurious outside lineages from being instantiated in standalone export.
     *
     * @param {Object} r - Raw spreadsheet row object
     * @returns {Object} Sanitized row object
     *
     * @example
     *   ExportUtils._sanitizeDescendantSpouseRow({ Name: 'Alice', Father: 'Bob', Place: 'Kochi' });
     *   // => { Name: 'Alice', Father: '', Place: 'Kochi' }
     *
     * @example
     *   ExportUtils._sanitizeDescendantSpouseRow({ Name: 'Charlie', Sibling: 'Dave' });
     *   // => { Name: 'Charlie', Sibling: '' }
     */
    static _sanitizeDescendantSpouseRow(r) {
        const sanitized = { ...r };
        const parentSiblingKeys = ['father', 'dad', 'mother', 'mom', 'parent', 'sibling', 'brother', 'sister'];
        Object.keys(sanitized).forEach(k => {
            if (k.startsWith('_')) return;
            const lowerKey = k.toLowerCase().trim();
            if (parentSiblingKeys.some(tok => lowerKey === tok || lowerKey.includes(tok))) {
                sanitized[k] = '';
            }
        });
        return sanitized;
    }

    /**
     * Traverses the graph from seed profiles, collecting connected ancestors, partners,
     * and descendants, while treating descendant spouses as outer boundaries without expanding
     * into their external ancestors.
     * 
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Set<string>} seedIds - Starting seed profile IDs
     * @param {Set<string>} descendantSpouseIds - IDs of marrying-in descendant spouses
     * @returns {Set<string>} Set of person IDs reachable within the bounded lineage
     * 
     * @example
     *   ExportUtils._traverseBoundedLineage(tree, new Set(['p1']), new Set(['sp1']));
     *   // => Set(['p1', 'parent1', 'sp1', ...])
     *
     * @example
     *   ExportUtils._traverseBoundedLineage(tree, new Set(), new Set());
     *   // => Set([])
     */
    static _traverseBoundedLineage(tree, seedIds, descendantSpouseIds) {
        const ids = new Set();
        const visited = new Set(seedIds);
        const queue = Array.from(seedIds);

        while (queue.length > 0) {
            const currId = queue.shift();
            const curr = tree.get(currId);
            if (!curr) continue;
            ids.add(curr.id);

            // Boundary: descendant spouses are included in the tree, but we do NOT expand
            // into their outside lineages (parents, outside children, other partners).
            if (descendantSpouseIds.has(curr.id)) {
                continue;
            }

            // A. Upward traversal: parents
            ExportUtils._enqueueUnvisited([curr.momId, curr.fatherId], visited, queue);

            // B. Horizontal traversal: partners
            ExportUtils._enqueueUnvisited(curr.partners, visited, queue);

            // C. Downward traversal: children
            ExportUtils._enqueueUnvisited(curr.children, visited, queue);
        }
        return ids;
    }

    /**
     * Collects all person IDs belonging to the extended lineage of a target person
     * and their partners, including ancestors, siblings, collaterals, and descendant spouses,
     * while avoiding additional outside lineages for descendants.
     *
     * @param {FamilyTree} tree - The populated family tree instance
     * @param {string} targetPersonId - Person ID of the selected profile
     * @returns {Set<string>} Set of person IDs in the bounded lineage component
     *
     * @example
     *   ExportUtils.getLineagePersonIds(tree, 'p1');
     *   // => Set { 'p1', 'p2', ... }
     *
     * @example
     *   ExportUtils.getLineagePersonIds(null, '');
     *   // => Set {}
     */
    static getLineagePersonIds(tree, targetPersonId) {
        if (!tree || !targetPersonId) return new Set();
        const targetPerson = tree.get(targetPersonId) || tree.root;
        if (!targetPerson) return new Set();

        // 1. Seeds: selected profile and all their direct partners
        const seedIds = new Set([targetPerson.id]);
        if (Array.isArray(targetPerson.partners)) {
            targetPerson.partners.forEach(pId => {
                if (pId && tree.get(pId)) seedIds.add(pId);
            });
        }

        // 2. Identify all descendants and descendant spouses
        const descendantIds = ExportUtils._collectDescendants(tree, seedIds);
        const descendantSpouseIds = ExportUtils._collectDescendantSpouses(tree, descendantIds, seedIds);

        // 3. Graph traversal starting from seed profiles bounded by descendant spouses
        const ids = ExportUtils._traverseBoundedLineage(tree, seedIds, descendantSpouseIds);
        ids.descendantSpouseIds = descendantSpouseIds;
        return ids;
    }

    /**
     * Extracts the lowercase primary name from a raw spreadsheet row record,
     * stripping slash-delimited nicknames (e.g. "Joseph / Kochappu" -> "joseph").
     *
     * @param {Object} r - Raw spreadsheet row record
     * @returns {string} Normalized lowercase primary name or empty string
     *
     * @example
     *   ExportUtils._extractNormalizedRowName({ Name: 'Joseph / Kochappu' });
     *   // => 'joseph'
     *
     * @example
     *   ExportUtils._extractNormalizedRowName({ name: '  Mary Ann  ' });
     *   // => 'mary ann'
     */
    static _extractNormalizedRowName(r) {
        const rawName = (r?.Name || r?.name || '').trim();
        if (!rawName) return '';
        const cleanName = rawName.includes('/') ? rawName.split('/')[0].trim() : rawName;
        return cleanName.toLowerCase().trim();
    }

    /**
     * Determines whether a raw spreadsheet row matches the lineage reference index
     * by sheet+row or by normalized name.
     *
     * @param {Object} r - Raw row record
     * @param {string} sid - Sheet / source ID
     * @param {number} rowNum - 1-based sheet row index
     * @param {{ refs: Set<string>, namesBySheet: Map<string, Set<string>>, globalNames: Set<string> }} targetIndex - Lineage reference index
     * @returns {boolean} True if row matches target lineage
     *
     * @example
     *   ExportUtils._isRowInLineageIndex({ Name: 'Alice' }, 'default', 2, { refs, namesBySheet: map, globalNames: set });
     *   // => true
     *
     * @example
     *   ExportUtils._isRowInLineageIndex({ Name: 'Unknown' }, 'default', 99, { refs: new Set(), namesBySheet: new Map(), globalNames: new Set() });
     *   // => false
     */
    static _isRowInLineageIndex(r, sid, rowNum, targetIndex) {
        if (targetIndex.refs.has(`${sid}:${rowNum}`)) return true;
        const norm = ExportUtils._extractNormalizedRowName(r);
        if (!norm) return false;
        if (targetIndex.namesBySheet.has(sid) && targetIndex.namesBySheet.get(sid).has(norm)) {
            return true;
        }
        return !r._sourceId && targetIndex.globalNames.has(norm);
    }

    /**
     * Checks if a row belongs to a marrying-in descendant spouse.
     *
     * @param {Object} r - Raw row record
     * @param {string} sid - Sheet ID
     * @param {number} rowNum - Sheet row index
     * @param {{ refs: Set<string>, namesBySheet: Map<string, Set<string>> }} spouseIndex - Descendant spouse reference index
     * @returns {boolean} True if row corresponds to a descendant spouse
     *
     * @example
     *   ExportUtils._isRowDescendantSpouse({ Name: 'Bob' }, 'default', 3, { refs, namesBySheet: map });
     *   // => true
     *
     * @example
     *   ExportUtils._isRowDescendantSpouse({ Name: 'Nobody' }, 'default', 99, { refs: new Set(), namesBySheet: new Map() });
     *   // => false
     */
    static _isRowDescendantSpouse(r, sid, rowNum, spouseIndex) {
        if (spouseIndex.refs.has(`${sid}:${rowNum}`)) return true;
        const norm = ExportUtils._extractNormalizedRowName(r);
        return Boolean(norm && spouseIndex.namesBySheet.has(sid) && spouseIndex.namesBySheet.get(sid).has(norm));
    }

    /**
     * Filters a collection of raw spreadsheet rows against target lineage and descendant spouse indices,
     * sanitizing descendant spouses to exclude outside lineages.
     *
     * @param {Array<Object>} rawRows - Array of raw row objects from spreadsheets
     * @param {{ refs: Set<string>, namesBySheet: Map<string, Set<string>>, globalNames: Set<string> }} targetIndex - Target lineage index
     * @param {{ refs: Set<string>, namesBySheet: Map<string, Set<string>> }} spouseIndex - Descendant spouse index
     * @returns {Array<Object>} Filtered and sanitized raw row objects
     *
     * @example
     *   const filtered = ExportUtils._filterAndSanitizeLineageRows(rawRows, targetIndex, spouseIndex);
     *
     * @example
     *   const filtered = ExportUtils._filterAndSanitizeLineageRows(
     *       [],
     *       { refs: new Set(), namesBySheet: new Map(), globalNames: new Set() },
     *       { refs: new Set(), namesBySheet: new Map() }
     *   );
     *   // => []
     */
    static _filterAndSanitizeLineageRows(rawRows, targetIndex, spouseIndex) {
        const filtered = [];
        rawRows.forEach((r, idx) => {
            const sid = r._sourceId || 'default';
            const rowNum = r._sheetRow !== undefined ? r._sheetRow : (idx + 2);

            if (!ExportUtils._isRowInLineageIndex(r, sid, rowNum, targetIndex)) {
                return;
            }

            if (ExportUtils._isRowDescendantSpouse(r, sid, rowNum, spouseIndex)) {
                filtered.push(ExportUtils._sanitizeDescendantSpouseRow(r));
            } else {
                filtered.push(r);
            }
        });
        return filtered;
    }

    /**
     * Filters raw spreadsheet rows to retain only those corresponding to persons
     * in the lineage of the target person and the lineages of their partners.
     * For descendant spouses, parent and outside sibling fields are sanitized to avoid
     * generating outside lineages in the standalone application.
     *
     * @param {FamilyTree} tree - Active family tree model
     * @param {Array<Object>} rawRows - Complete array of raw spreadsheet row objects
     * @param {string} targetPersonId - Person ID of the selected profile
     * @returns {Array<Object>} Filtered array of raw spreadsheet row objects
     *
     * @example
     *   ExportUtils.filterRowsByLineage(tree, rawRows, 'p1');
     *   // => [{ Name: 'John', ... }]
     *
     * @example
     *   ExportUtils.filterRowsByLineage(null, [], '');
     *   // => []
     */
    static filterRowsByLineage(tree, rawRows, targetPersonId) {
        if (!tree || !Array.isArray(rawRows) || rawRows.length === 0) {
            return rawRows || [];
        }

        const lineageIds = ExportUtils.getLineagePersonIds(tree, targetPersonId);
        if (!lineageIds || lineageIds.size === 0) {
            return rawRows;
        }

        const targetIndex = ExportUtils._buildLineageRefIndex(tree, lineageIds);
        const spouseIndex = ExportUtils._buildLineageRefIndex(tree, lineageIds.descendantSpouseIds || []);
        const filtered = ExportUtils._filterAndSanitizeLineageRows(rawRows, targetIndex, spouseIndex);

        return (filtered.length > 0) ? filtered : rawRows;
    }
}

/**
 * Selects the optimal anchor layout node to maintain viewport stability during tree updates.
 *
 * Prioritizes the currently focused person if present in both layouts; otherwise selects the
 * node closest to the viewport's visual center.
 *
 * @param {Array<Object>} nodes - Layout nodes from the current view
 * @param {FamilyTree} newTree - Newly computed family tree instance
 * @param {string|null} focusId - Current focus person ID, if any
 * @param {Object} camera - Viewport camera { x, y, z }
 * @param {number} screenCenterX - Center X coordinate of viewport
 * @param {number} screenCenterY - Center Y coordinate of viewport
 * @param {number} padX - Horizontal padding offset of layout
 * @param {number} padY - Vertical padding offset of layout
 * @returns {Object|null} The best anchor layout node, or null
 *
 * @example
 *   findBestAnchorNode([{ person: { id: 'p1' }, x: 10, y: 20 }], newTree, 'p1', { x: 0, y: 0, z: 1 }, 400, 300, 10, 10);
 *   // => node for 'p1'
 *
 * @example
 *   findBestAnchorNode([], newTree, null, { x: 0, y: 0, z: 1 }, 400, 300, 10, 10);
 *   // => null
 */
function findBestAnchorNode(nodes, newTree, focusId, camera, screenCenterX, screenCenterY, padX, padY) {
    if (!nodes || nodes.length === 0) return null;
    if (focusId && newTree.get(focusId)) {
        const focused = nodes.find(n => n.person.id === focusId);
        if (focused) return focused;
    }
    let bestNode = null;
    let minDistanceSq = Infinity;
    for (const n of nodes) {
        if (!newTree.get(n.person.id)) continue;
        const nScreenX = (n.x + padX) * camera.z + camera.x;
        const nScreenY = (n.y + padY) * camera.z + camera.y;
        const distSq = (nScreenX - screenCenterX) ** 2 + (nScreenY - screenCenterY) ** 2;
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestNode = n;
        }
    }
    return bestNode;
}

/**
 * Computes tree layout for an updated tree with current zoom and layout configuration.
 *
 * @param {Object} params
 * @param {FamilyTree} params.newTree - Target family tree instance
 * @param {Object} params.layoutConfig - Base layout options
 * @param {number} params.cameraZ - Current camera zoom level
 * @param {Function} params.getPpy - Dynamic pixels-per-year calculation function
 * @param {number} params.siblingGap - Sibling card separation distance
 * @returns {Object|null} Computed layout geometry
 *
 * @example
 *   computeUpdatedTreeLayout({ newTree: tree, layoutConfig: {}, cameraZ: 1, getPpy: () => 10, siblingGap: 24 });
 *   // => { nodes: [...], minX: 0, minY: 0 }
 *
 * @example
 *   computeUpdatedTreeLayout({ newTree: tree, layoutConfig: { cardWidth: 200 }, cameraZ: 0.8, getPpy: null, siblingGap: 16 });
 *   // => { nodes: [...], minX: -50, minY: 0 }
 */
function computeUpdatedTreeLayout({ newTree, layoutConfig, cameraZ, getPpy, siblingGap }) {
    const collapsedNodes = layoutConfig?.collapsedNodes || new Set();
    const config = {
        ...layoutConfig,
        visibleNodes: typeof newTree.getVisibleNodes === 'function'
            ? newTree.getVisibleNodes(collapsedNodes)
            : layoutConfig?.visibleNodes,
        rootNodeYob: newTree.getStats().rootNodeYob,
        ppy: getPpy ? getPpy(cameraZ) : 10,
        siblingGap
    };
    return FamilyTreeBuilder.computeLayout(newTree, config);
}

/**
 * Calculates screen center coordinates for a container DOM element with fallback window dimensions.
 *
 * @param {HTMLElement|null} containerEl - Container DOM element
 * @returns {{ screenCenterX: number, screenCenterY: number }}
 *
 * @example
 *   getContainerScreenCenter({ clientWidth: 800, clientHeight: 600 });
 *   // => { screenCenterX: 400, screenCenterY: 300 }
 *
 * @example
 *   getContainerScreenCenter(null);
 *   // => { screenCenterX: 500, screenCenterY: 250 }
 */
function getContainerScreenCenter(containerEl) {
    const contW = (containerEl && containerEl.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth - 360 : 800);
    const contH = (containerEl && containerEl.clientHeight) || (typeof window !== 'undefined' ? window.innerHeight : 600);
    return { screenCenterX: contW / 2, screenCenterY: contH / 2 };
}

/**
 * Computes shifted camera coordinates to preserve an anchor node's visual screen position across layout updates.
 *
 * @param {number} oldScreenX - Original anchor screen X
 * @param {number} oldScreenY - Original anchor screen Y
 * @param {Object} newAnchorNode - Corresponding node in the updated layout
 * @param {number} newPadX - Horizontal padding in updated layout
 * @param {number} newPadY - Vertical padding in updated layout
 * @param {number} cameraZ - Current camera zoom factor
 * @returns {{ targetCamX: number, targetCamY: number }}
 *
 * @example
 *   calculateShiftedCamera(100, 150, { x: 10, y: 20 }, 10, 10, 1.2);
 *   // => { targetCamX: 76, targetCamY: 114 }
 *
 * @example
 *   calculateShiftedCamera(0, 0, { x: 0, y: 0 }, 0, 0, 1);
 *   // => { targetCamX: 0, targetCamY: 0 }
 */
function calculateShiftedCamera(oldScreenX, oldScreenY, newAnchorNode, newPadX, newPadY, cameraZ) {
    return {
        targetCamX: oldScreenX - (newAnchorNode.x + newPadX) * cameraZ,
        targetCamY: oldScreenY - (newAnchorNode.y + newPadY) * cameraZ
    };
}

/**
 * Computes screen pixel coordinates of a node given its layout coordinates, canvas padding, and camera state.
 *
 * @param {Object} node - Layout node with x and y properties
 * @param {number} padX - Horizontal canvas offset padding
 * @param {number} padY - Vertical canvas offset padding
 * @param {{ x: number, y: number, z: number }} camera - Camera state
 * @returns {{ screenX: number, screenY: number }}
 *
 * @example
 *   projectNodeToScreen({ x: 100, y: 50 }, 10, 20, { x: 500, y: 300, z: 1.5 });
 *   // => { screenX: 665, screenY: 405 }
 *
 * @example
 *   projectNodeToScreen({ x: 0, y: 0 }, 0, 0, { x: 10, y: 20, z: 1 });
 *   // => { screenX: 10, screenY: 20 }
 */
function projectNodeToScreen(node, padX, padY, camera) {
    return {
        screenX: (node.x + padX) * camera.z + camera.x,
        screenY: (node.y + padY) * camera.z + camera.y
    };
}

/**
 * Resolves shifted camera coordinates from the newly updated layout, matching the previous anchor node.
 *
 * @param {Object|null} newLayout - Updated layout data with nodes and minX/minY
 * @param {Object} anchorNode - Original anchor node
 * @param {number} oldScreenX - Original screen X
 * @param {number} oldScreenY - Original screen Y
 * @param {{ x: number, y: number, z: number }} camera - Current camera state
 * @returns {{ targetCamX: number, targetCamY: number }|null}
 *
 * @example
 *   resolveUpdatedCameraShift({ minX: 0, minY: 0, nodes: [{ person: { id: 'p1' }, x: 10, y: 20 }] }, { person: { id: 'p1' } }, 200, 300, { x: 100, y: 50, z: 1.2 });
 *   // => { targetCamX: 176, targetCamY: 264 }
 *
 * @example
 *   resolveUpdatedCameraShift(null, { person: { id: 'p1' } }, 200, 300, { x: 0, y: 0, z: 1 });
 *   // => null
 */
function resolveUpdatedCameraShift(newLayout, anchorNode, oldScreenX, oldScreenY, camera) {
    if (!newLayout) return null;
    const newPadX = 10 - newLayout.minX;
    const newPadY = 10 - newLayout.minY;
    const newAnchorNode = newLayout.nodes.find(n => n.person.id === anchorNode.person.id);
    if (!newAnchorNode) return null;
    return calculateShiftedCamera(oldScreenX, oldScreenY, newAnchorNode, newPadX, newPadY, camera.z);
}

/**
 * Computes camera offset adjustment to keep the viewport anchored to the same focal person
 * or visual center after a background tree reload.
 *
 * @param {Object} params
 * @param {FamilyTree} params.tree - Current family tree
 * @param {FamilyTree} params.newTree - New family tree
 * @param {Object} params.layoutConfig - Base layout configuration
 * @param {Object} params.camera - Current camera { x, y, z }
 * @param {HTMLElement|null} params.containerEl - Canvas container element
 * @param {string|null} params.focusId - Focused person ID
 * @param {Function} params.getPpy - Function returning pixels-per-year for zoom level
 * @param {number} params.siblingGap - Sibling card separation gap
 * @returns {{ targetCamX: number, targetCamY: number }|null} New camera coordinates or null
 *
 * @example
 *   computeLayoutAnchorShift({ tree, newTree, layoutConfig, camera, containerEl, focusId, getPpy, siblingGap });
 *   // => { targetCamX: 120.5, targetCamY: -45.0 }
 *
 * @example
 *   computeLayoutAnchorShift({ tree: null, newTree: null, layoutConfig: {}, camera: { x: 0, y: 0, z: 1 }, containerEl: null });
 *   // => null
 */
function computeLayoutAnchorShift({
    tree, newTree, layoutConfig, camera, containerEl, focusId, getPpy, siblingGap
}) {
    if (!tree || !newTree || !newTree.root) return null;
    const oldLayout = FamilyTreeBuilder.computeLayout(tree, layoutConfig);
    if (!oldLayout?.nodes?.length) return null;

    const { screenCenterX, screenCenterY } = getContainerScreenCenter(containerEl);
    const oldPadX = 10 - oldLayout.minX;
    const oldPadY = 10 - oldLayout.minY;

    const anchorNode = findBestAnchorNode(oldLayout.nodes, newTree, focusId, camera, screenCenterX, screenCenterY, oldPadX, oldPadY);
    if (!anchorNode) return null;

    const { screenX: oldScreenX, screenY: oldScreenY } = projectNodeToScreen(anchorNode, oldPadX, oldPadY, camera);
    const newLayout = computeUpdatedTreeLayout({ newTree, layoutConfig, cameraZ: camera.z, getPpy, siblingGap });
    return resolveUpdatedCameraShift(newLayout, anchorNode, oldScreenX, oldScreenY, camera);
}

/**
 * Enqueues immediate parents of target person IDs and uncollapses target IDs if requested.
 *
 * @param {Array<string>} ids - Target person IDs
 * @param {Set<string>} next - Mutable set of collapsed IDs
 * @param {boolean} uncollapseTarget - Whether to remove target IDs from collapsed set
 * @param {FamilyTree} tree - Active family tree model
 * @param {Array<string>} queue - Output queue receiving parent IDs
 * @returns {boolean} True if any target was removed from next
 *
 * @example
 *   const queue = [];
 *   _enqueueImmediateParents(['child1'], new Set(['child1']), true, tree, queue);
 *   // => true, queue has parents
 *
 * @example
 *   const queue = [];
 *   _enqueueImmediateParents([], new Set(), false, tree, queue);
 *   // => false, queue empty
 */
function _enqueueImmediateParents(ids, next, uncollapseTarget, tree, queue) {
    let changed = false;
    ids.forEach(id => {
        if (!id) return;
        if (uncollapseTarget && next.has(id)) {
            next.delete(id);
            changed = true;
        }
        const p = tree.get(id);
        if (p) {
            if (p.momId) queue.push(p.momId);
            if (p.fatherId) queue.push(p.fatherId);
        }
    });
    return changed;
}

/**
 * Traverses parent linkages via BFS queue, uncollapsing every encountered ancestor node.
 *
 * @param {Array<string>} queue - BFS queue containing ancestor IDs to visit
 * @param {Set<string>} next - Mutable set of collapsed IDs
 * @param {Set<string>} visited - Set tracking already visited person IDs
 * @param {FamilyTree} tree - Active family tree model
 * @returns {boolean} True if any ancestor was removed from next
 *
 * @example
 *   const queue = ['p1'];
 *   const collapsed = new Set(['p1', 'p2']);
 *   _drainAncestorQueue(queue, collapsed, new Set(), tree);
 *   // => true, collapsed no longer has 'p1'
 *
 * @example
 *   const queue = [];
 *   _drainAncestorQueue(queue, new Set(['p1']), new Set(), tree);
 *   // => false
 */
function _drainAncestorQueue(queue, next, visited, tree) {
    let changed = false;
    while (queue.length > 0) {
        const parentId = queue.shift();
        if (visited.has(parentId)) continue;
        visited.add(parentId);

        if (next.has(parentId)) {
            next.delete(parentId);
            changed = true;
        }
        const pNode = tree.get(parentId);
        if (pNode) {
            if (pNode.momId) queue.push(pNode.momId);
            if (pNode.fatherId) queue.push(pNode.fatherId);
        }
    }
    return changed;
}

/**
 * Uncollapses all ancestors of the specified person IDs in a collapsed set.
 *
 * Traverses parent linkages (momId, fatherId) up to root, removing any encountered
 * ancestors (and optionally target nodes) from the collapsed set so cards are visible.
 *
 * @param {Set<string>} collapsedSet - Current set of collapsed node IDs
 * @param {FamilyTree} tree - Active family tree model
 * @param {Array<string>|string} targetIds - One or more person IDs whose ancestors should be uncollapsed
 * @param {boolean} [uncollapseTarget=true] - Whether to also uncollapse the target node itself
 * @returns {Set<string>} New set if changes were made, or existing set reference if unchanged
 *
 * @example
 *   uncollapseAncestors(new Set(['m1', 'f1', 'other']), tree, ['child1']);
 *   // => Set containing ['other'] (parents 'm1' and 'f1' removed)
 *
 * @example
 *   uncollapseAncestors(new Set(), tree, 'p1');
 *   // => Set {}
 */
function uncollapseAncestors(collapsedSet, tree, targetIds, uncollapseTarget = true) {
    if (!collapsedSet || collapsedSet.size === 0 || !tree) return collapsedSet;
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    if (ids.length === 0) return collapsedSet;

    const next = new Set(collapsedSet);
    const queue = [];
    const changed = _enqueueImmediateParents(ids, next, uncollapseTarget, tree, queue);
    const ancestorChanged = _drainAncestorQueue(queue, next, new Set(), tree);

    return (changed || ancestorChanged) ? next : collapsedSet;
}

/**
 * Determines whether focusing a person requires shifting the tree view's active root
 * to their oldest ancestor (e.g. if the person or their immediate family are not currently visible).
 *
 * @param {Person|null} person - Target person object
 * @param {FamilyTree} tree - Active family tree model
 * @param {Set<string>} visibleNodes - Set of currently visible layout node IDs
 * @returns {boolean} True if tree root should be updated to reveal the person's lineage
 *
 * @example
 *   // With person already visible and connected: returns false
 *   shouldRerootForPerson(visiblePerson, tree, visibleNodes);
 *   // => false
 *
 * @example
 *   // With person having hidden parents, partner, or child: returns true
 *   shouldRerootForPerson(hiddenPerson, tree, visibleNodes);
 *   // => true
 */
function shouldRerootForPerson(person, tree, visibleNodes) {
    if (!person || !tree || !visibleNodes) return false;
    if (!visibleNodes.has(person.id)) return true;

    const momIsVisible = visibleNodes.has(person.momId) || (person.momId && tree.get(person.momId)?.partners.some(pId => visibleNodes.has(pId)));
    const dadIsVisible = visibleNodes.has(person.fatherId) || (person.fatherId && tree.get(person.fatherId)?.partners.some(pId => visibleNodes.has(pId)));

    const hasValidHiddenMom = person.momId && tree.get(person.momId) && !tree.get(person.momId)._isUnknown && !momIsVisible;
    const hasValidHiddenDad = person.fatherId && tree.get(person.fatherId) && !tree.get(person.fatherId)._isUnknown && !dadIsVisible;

    const hasHiddenParents = (hasValidHiddenMom || hasValidHiddenDad) && !momIsVisible && !dadIsVisible;
    const hasHiddenPartner = person.partners.some(pId => !visibleNodes.has(pId) && tree.get(pId) && !tree.get(pId)._isUnknown);
    const hasHiddenChild = person.children.some(cId => !visibleNodes.has(cId) && tree.get(cId) && !tree.get(cId)._isUnknown);

    return hasHiddenParents || hasHiddenPartner || hasHiddenChild;
}

/**
 * Checks whether an element's bounding rect overlaps with the visible bounds of its container.
 *
 * @param {Element|null} el - Target DOM element
 * @param {Element|null} containerEl - Container DOM element
 * @returns {boolean} True if the element is inside the viewport bounds
 *
 * @example
 *   isElementVisibleInContainer(document.getElementById('node-1'), document.getElementById('canvas'));
 *   // => true
 *
 * @example
 *   isElementVisibleInContainer(null, null);
 *   // => false
 */
function isElementVisibleInContainer(el, containerEl) {
    if (!el || !containerEl) return false;
    const r = el.getBoundingClientRect();
    const c = containerEl.getBoundingClientRect();
    return r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom;
}

/**
 * Calculates decade and generation boundary labels for the vertical timeline ruler.
 *
 * At zoom levels < 0.8, renders major generational era boundaries (Strauss-Howe generations)
 * that fall within the tree's active birth-year span. At higher zoom levels, generates 5-year
 * or 10-year decade ticks.
 *
 * @param {number|undefined} minYear - Earliest recorded birth year in tree
 * @param {number|undefined} maxYear - Latest recorded birth/event year in tree
 * @param {number} zoom - Current viewport zoom factor
 * @returns {Array<number>} Sorted array of year markers
 *
 * @example
 *   calculateDynamicTimelineYears(1900, 1950, 0.5);
 *   // => [1901, 1928, 1946]
 *
 * @example
 *   calculateDynamicTimelineYears(1900, 1950, 1.0);
 *   // => [1890, 1900, 1910, 1920, 1930, 1940, 1950]
 */
function calculateDynamicTimelineYears(minYear, maxYear, zoom) {
    if (!minYear || !maxYear) return [];
    if (zoom < 0.8) {
        const boundaries = [1650, 1701, 1724, 1742, 1767, 1792, 1822, 1843, 1860, 1883, 1901, 1928, 1946, 1965, 1981, 1997, 2013, 2030, 2050];
        return boundaries.filter(y => y >= minYear - 35 && y <= maxYear);
    }
    const step = zoom > 1.5 ? 5 : 10;
    const start = Math.floor((minYear - 15) / step) * step;
    const end = Math.floor(maxYear / step) * step;
    const years = [];
    for (let y = start; y <= end; y += step) years.push(y);
    return years;
}

/**
 * Resolves a spreadsheet or data URL from user input or clipboard.
 *
 * If a non-empty string is provided directly, it is trimmed and returned.
 * Otherwise, attempts to read from navigator.clipboard and validates whether
 * the clipboard contains a Google Sheets or spreadsheet/CSV URL.
 *
 * @param {string|null} [directUrl=null] - Candidate URL provided directly
 * @returns {Promise<string|null>} Resolved valid URL, or null if none available
 *
 * @example
 *   await resolveImportUrl("https://docs.google.com/spreadsheets/d/123");
 *   // => "https://docs.google.com/spreadsheets/d/123"
 *
 * @example
 *   await resolveImportUrl(null);
 *   // => "https://docs.google.com/..." (or null if clipboard has no URL)
 */
async function resolveImportUrl(directUrl = null) {
    if (typeof directUrl === 'string' && directUrl.trim()) {
        return directUrl.trim();
    }

    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
            const clipText = await navigator.clipboard.readText();
            if (clipText && clipText.trim()) {
                const trimmed = clipText.trim();
                if (trimmed.includes('docs.google.com') || (trimmed.startsWith('http') && (trimmed.includes('spreadsheet') || trimmed.includes('csv') || trimmed.includes('tq')))) {
                    return trimmed;
                }
            }
        }
    } catch (err) {
        console.log('Clipboard access note:', err);
    }
    return null;
}

/**
 * Clears cached family tree data from localStorage.
 *
 * Removes all keys starting with 'ft_cache_' or 'family_tree_'.
 *
 * @example
 *   clearAppStorage();
 *
 * @example
 *   // Invoked during hard refresh when clipboard contains no URL
 *   if (!urlToLoad) {
 *     clearAppStorage();
 *     window.location.reload(true);
 *   }
 */
function clearAppStorage() {
    try {
        if (typeof localStorage !== 'undefined') {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('ft_cache_') || k.startsWith('family_tree_')) {
                    localStorage.removeItem(k);
                }
            });
        }
    } catch (e) {
        console.log('Cache clear note:', e);
    }
}

/**
 * Smoothly shifts camera coordinates to a target anchor while temporarily suppressing transition animations.
 *
 * @param {Object} params
 * @param {{ targetCamX: number, targetCamY: number }} params.shift - Computed anchor camera coordinates
 * @param {Function} params.setCamera - Camera state setter
 * @param {Function} params.setIsShifting - State setter toggling transition suppression
 *
 * @example
 *   applyCameraShiftTransition({
 *     shift: { targetCamX: 120, targetCamY: -45 },
 *     setCamera,
 *     setIsShifting
 *   });
 *
 * @example
 *   applyCameraShiftTransition({
 *     shift: { targetCamX: 0, targetCamY: 0 },
 *     setCamera: () => {},
 *     setIsShifting: () => {}
 *   });
 */
function applyCameraShiftTransition({ shift, setCamera, setIsShifting }) {
    setIsShifting(true);
    setCamera(cam => ({ ...cam, x: shift.targetCamX, y: shift.targetCamY }));
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsShifting(false);
            });
        });
    } else {
        setTimeout(() => setIsShifting(false), 50);
    }
}

/**
 * Registers polling and visibility/focus change event listeners that trigger a sync callback
 * whenever the document is visible.
 *
 * @param {Function} onTrigger - Callback to invoke when active and visible
 * @param {number} [intervalMs=20000] - Periodic polling interval in milliseconds
 * @returns {Function} Cleanup function to unregister listeners and cancel timers
 *
 * @example
 *   const teardown = setupVisibilitySyncListener(() => refreshTree(), 20000);
 *   // ... later
 *   teardown();
 *
 * @example
 *   const cleanup = setupVisibilitySyncListener(triggerBackgroundSync, 10000);
 *   window.addEventListener('beforeunload', cleanup);
 */
function setupVisibilitySyncListener(onTrigger, intervalMs = 20000) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => {};
    }

    const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
            onTrigger();
        }
    }, intervalMs);

    const handleVisibilityOrFocus = () => {
        if (document.visibilityState === 'visible') {
            onTrigger();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
    };
}

/**
 * Calculates anchor shifts and executes atomic camera repositioning when
 * background live synchronization yields a structural update to the tree.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Previous tree state
 * @param {FamilyTree} params.newTree - Updated tree state from background sync
 * @param {object} params.layoutConfig - Visual node positioning options
 * @param {object} params.camera - Current camera coordinates
 * @param {HTMLElement|null} params.containerEl - Outer canvas container DOM node
 * @param {string|null} params.focusId - Selected person ID
 * @param {Function} params.getPpy - Function returning pixels-per-year scale
 * @param {number} params.siblingGap - Distance between siblings
 * @param {Function} params.setCamera - Camera state setter
 * @param {Function} params.setIsShifting - State setter for transition animation lock
 * @param {Function} params.setTree - Tree state setter
 * @param {Function} params.setFocusId - Focus ID state setter
 *
 * @example
 * executeBackgroundTreeTransition({
 *   tree,
 *   newTree,
 *   layoutConfig: {},
 *   camera: { x: 0, y: 0, z: 1 },
 *   containerEl: null,
 *   focusId: null,
 *   getPpy: () => 1,
 *   siblingGap: 24,
 *   setCamera: () => {},
 *   setIsShifting: () => {},
 *   setTree: () => {},
 *   setFocusId: () => {}
 * });
 *
 * @example
 * executeBackgroundTreeTransition({
 *   tree: null,
 *   newTree: null,
 *   layoutConfig: {},
 *   camera: { x: 0, y: 0, z: 1 },
 *   containerEl: null,
 *   focusId: 'p1',
 *   getPpy: () => 1,
 *   siblingGap: 24,
 *   setCamera: () => {},
 *   setIsShifting: () => {},
 *   setTree: () => {},
 *   setFocusId: () => {}
 * });
 */
function executeBackgroundTreeTransition({
    tree, newTree, layoutConfig, camera, containerEl,
    focusId, getPpy, siblingGap, setCamera, setIsShifting, setTree, setFocusId
}) {
    if (!newTree || !newTree.root) return;

    // Preserve active subtree root to maintain visual continuity and avoid resetting displayed lineage
    let targetRootId = tree?.rootId;
    if (!targetRootId || !newTree.get(targetRootId)) {
        if (focusId && newTree.get(focusId)) {
            targetRootId = newTree.getOldestAncestor(focusId) || newTree.rootId;
        } else {
            targetRootId = newTree.rootId;
        }
    }
    if (targetRootId && newTree.get(targetRootId)) {
        newTree.rootId = targetRootId;
    }

    try {
        const shift = computeLayoutAnchorShift({
            tree, newTree, layoutConfig, camera,
            containerEl, focusId, getPpy, siblingGap
        });
        if (shift) {
            applyCameraShiftTransition({ shift, setCamera, setIsShifting });
        }
    } catch (anchorErr) {
        console.warn('[LiveSync] View anchor calculation note:', anchorErr);
    }

    setTree(newTree);
    setFocusId(prev => (prev && newTree.get(prev) ? prev : null));
}

/**
 * Executes a silent background fetch cycle if no other sync is currently in progress.
 *
 * @param {Object} options
 * @param {Function} options.fetchFromUrl - Network fetch dispatcher
 * @param {string} options.sheetUrl - Google Sheets source URL
 * @param {Function} options.onBackgroundUpdate - Handler for updated tree models
 * @param {React.MutableRefObject<boolean>} options.isSyncingRef - Reentrancy lock ref
 * @param {boolean} options.isLoading - Whether a foreground load is currently active
 * @returns {Promise<void>}
 *
 * @example
 * await performLiveSyncFetch({
 *   fetchFromUrl: async () => {},
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/abc',
 *   onBackgroundUpdate: () => {},
 *   isSyncingRef: { current: false },
 *   isLoading: false
 * });
 *
 * @example
 * await performLiveSyncFetch({
 *   fetchFromUrl: async () => {},
 *   sheetUrl: '',
 *   onBackgroundUpdate: () => {},
 *   isSyncingRef: { current: true },
 *   isLoading: true
 * });
 */
async function performLiveSyncFetch({ fetchFromUrl, sheetUrl, onBackgroundUpdate, isSyncingRef, isLoading }) {
    if (isSyncingRef.current || isLoading || !sheetUrl) return;
    isSyncingRef.current = true;
    try {
        await fetchFromUrl(sheetUrl, { 
            background: true, 
            skipCache: true, 
            onBackgroundUpdate 
        });
    } catch (err) {
        console.log('[LiveSync] Silent background check note:', err);
    } finally {
        isSyncingRef.current = false;
    }
}

/**
 * Hook to manage background synchronization with remote Google Sheets data source,
 * maintaining view stability by calculating layout deltas and anchoring the camera.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {Function} params.setTree - Tree state dispatcher
 * @param {string|null} params.focusId - Focused person identifier
 * @param {Function} params.setFocusId - Focus state dispatcher
 * @param {object} params.layoutConfig - Structural view configuration
 * @param {{x: number, y: number, z: number}} params.camera - Canvas viewport state
 * @param {Function} params.setCamera - Viewport state dispatcher
 * @param {React.RefObject} params.containerRef - Canvas DOM container ref
 * @param {Function} params.getPpy - Function returning pixels per year
 * @param {number} params.siblingGap - Distance between sibling tree nodes
 * @param {Function} params.setIsShifting - State updater for anchor transitions
 * @param {string} params.sheetUrl - Remote spreadsheet source URL
 * @param {boolean} params.isLoading - Initial or user-initiated loading flag
 * @param {Function} params.fetchFromUrl - Network fetch dispatcher
 *
 * @example
 *   useLiveSync({
 *     tree, setTree, focusId, setFocusId, layoutConfig,
 *     camera, setCamera, containerRef, getPpy, siblingGap,
 *     setIsShifting, sheetUrl, isLoading, fetchFromUrl
 *   });
 *
 * @example
 *   useLiveSync({
 *     tree: null, setTree: () => {}, focusId: null, setFocusId: () => {},
 *     layoutConfig: {}, camera: { x: 0, y: 0, z: 1 }, setCamera: () => {},
 *     containerRef: { current: null }, getPpy: () => 1, siblingGap: 24,
 *     setIsShifting: () => {}, sheetUrl: '', isLoading: false, fetchFromUrl: async () => {}
 *   });
 */
function useLiveSync({
    tree, setTree, focusId, setFocusId,
    layoutConfig, camera, setCamera, containerRef,
    getPpy, siblingGap, setIsShifting, sheetUrl, isLoading, fetchFromUrl
}) {
    const isSyncingRef = useRef(false);
    const liveParamsRef = useRef();
    liveParamsRef.current = {
        tree, layoutConfig, camera, containerEl: containerRef ? containerRef.current : null,
        focusId, getPpy, siblingGap, setCamera, setIsShifting, setTree, setFocusId
    };

    const applyBackgroundTreeUpdate = useCallback((newTree) => {
        const params = liveParamsRef.current || {
            tree, layoutConfig, camera, containerEl: containerRef ? containerRef.current : null,
            focusId, getPpy, siblingGap, setCamera, setIsShifting, setTree, setFocusId
        };
        executeBackgroundTreeTransition({
            ...params,
            newTree
        });
    }, [tree, layoutConfig, camera, focusId, getPpy, setTree, setFocusId, setCamera, containerRef, siblingGap, setIsShifting]);

    const triggerBackgroundSync = useCallback(async () => {
        await performLiveSyncFetch({
            fetchFromUrl, sheetUrl, onBackgroundUpdate: applyBackgroundTreeUpdate,
            isSyncingRef, isLoading
        });
    }, [isLoading, sheetUrl, fetchFromUrl, applyBackgroundTreeUpdate]);

    useEffect(() => {
        const isStandalone = isStandaloneExportMode();
        if (isStandalone) return;
        return setupVisibilitySyncListener(triggerBackgroundSync, 20000);
    }, [triggerBackgroundSync]);
}

/**
 * Exports the tree canvas as a standalone HTML file containing an inline SVG vector graphic.
 * Captures an HTML element as an inline SVG document string using htmlToImage.
 *
 * @param {HTMLElement} element - Target DOM element to rasterize to vector SVG.
 * @param {string} [title='Family Tree'] - Document title for the generated HTML.
 * @returns {Promise<string>} Generated HTML content with inline SVG.
 *
 * @example
 * const html = await captureElementInlineSvgHtml(containerElement);
 *
 * @example
 * const customHtml = await captureElementInlineSvgHtml(divNode, 'Exported Chart');
 */
async function captureElementInlineSvgHtml(element, title = 'Family Tree') {
    await ScriptLoader.load('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js');
    const dataUrl = await window.htmlToImage.toSvg(element, { 
        backgroundColor: '#ffffff', 
        width: element.clientWidth, 
        height: element.clientHeight,
        filter: ExportUtils.isExportableSvgNode
    });
    const rawSvg = SvgViewerDocument.extractRawSvgFromDataUrl(dataUrl);
    return SvgViewerDocument.buildInlineSvgHtml(rawSvg, title);
}

/**
 * Exports the visible family tree canvas to an interactive HTML document containing vector SVG and pan/zoom controls.
 *
 * @param {Object} params
 * @param {React.RefObject} params.containerRef - Element reference to the visual tree canvas.
 * @param {FamilyTree} params.tree - Active family tree data structure.
 * @param {Function} params.setErrorMsg - Callback to report export failure message.
 * @param {Function} params.setIsExporting - Loading state toggle for export progress UI.
 *
 * @example
 * await executeVectorSvgExport({ containerRef, tree, setErrorMsg, setIsExporting });
 *
 * @example
 * // Trigger export from button handler
 * const handleExportImage = useCallback(() => executeVectorSvgExport({
 *   containerRef, tree, setErrorMsg, setIsExporting
 * }), [containerRef, tree, setErrorMsg]);
 */
async function executeVectorSvgExport({ containerRef, tree, setErrorMsg, setIsExporting }) {
    if (!containerRef.current || !tree.root) {
        setErrorMsg("Please load and display a family tree first.");
        return;
    }

    setIsExporting(true);
    try {
        const htmlContent = await captureElementInlineSvgHtml(containerRef.current, 'Family Tree');

        const dateStr = ExportUtils.formatTimestamp();
        const rootName = (tree.root?.name || 'Family_Tree').replace(/[^a-zA-Z0-9_-]/g, '_');
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${rootName}_Vector_View_${dateStr}.html`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
        console.error("Failed to export HTML with inline SVG:", err);
        setErrorMsg("Failed to generate vector HTML: " + (err.message || err));
    } finally {
        setIsExporting(false);
    }
}

/**
 * Retrieves application source code for standalone app generation from window cache or server.
 *
 * @returns {Promise<string>} Application source code content.
 *
 * @example
 * const code = await resolveApplicationSourceCode();
 *
 * @example
 * resolveApplicationSourceCode().then(text => console.log(text.length));
 */
async function resolveApplicationSourceCode() {
    let appCodeText = (typeof window !== 'undefined' && window.appCode) ? window.appCode : null;
    if (!appCodeText) {
        const res = await fetch('./App.jsx?t=' + Date.now());
        if (res.ok) appCodeText = await res.text();
    }
    if (!appCodeText) {
        throw new Error("Could not retrieve application source code.");
    }
    return appCodeText;
}

/**
 * Prepares genealogical dataset payload, lineage-filtered rows, and metadata
 * for packaging into the standalone offline application.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - Current genealogy tree model.
 * @param {string} options.sheetUrl - Source spreadsheet URL.
 * @param {string|null} options.focusId - Focused person identifier.
 * @returns {{
 *   treeData: {
 *     url: string,
 *     rows: Array<Object>,
 *     sheetTags: Object,
 *     rootId: string|null,
 *     selectedId: string|null
 *   },
 *   selectedName: string,
 *   dateStr: string,
 *   title: string
 * }} Prepared export metadata and bundle payload.
 *
 * @example
 * prepareStandaloneExportData({
 *   tree: sampleTree,
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/abc',
 *   focusId: 'p1'
 * });
 *
 * @example
 * prepareStandaloneExportData({
 *   tree: emptyTree,
 *   sheetUrl: '',
 *   focusId: null
 * });
 */
function prepareStandaloneExportData({ tree, sheetUrl, focusId }) {
    const selectedPerson = (focusId ? tree.get(focusId) : null) || tree.root;
    const allRows = ExportUtils.resolveExportableRows(tree, sheetUrl);
    const rowsToEmbed = ExportUtils.filterRowsByLineage(tree, allRows, selectedPerson?.id || tree.rootId);

    const treeData = {
        url: sheetUrl,
        rows: rowsToEmbed,
        sheetTags: tree.sheetNames || {},
        rootId: (selectedPerson && tree.getOldestAncestor && tree.getOldestAncestor(selectedPerson.id)) || tree.rootId || null,
        selectedId: focusId || tree.rootId || null
    };

    const selectedName = (selectedPerson?.name || tree.root?.name || 'Family_Tree').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = ExportUtils.formatTimestamp();
    const title = `${selectedPerson?.name ? `${selectedPerson.name} - ` : ''}Family Tree (Interactive Standalone App)`;

    return { treeData, selectedName, dateStr, title };
}

/**
 * Packages current family tree view into a self-contained single-file HTML application.
 * Serializes lineage-filtered rows, metadata, and embed script, and triggers browser download.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - The current FamilyTree instance.
 * @param {string} options.sheetUrl - Active Google Sheets source URL.
 * @param {string|null} options.focusId - Selected or active person node ID.
 * @param {Function} options.appendLog - Function to append log message in status drawer.
 * @param {Function} options.setErrorMsg - Function to display error message.
 * @param {Function} options.setIsExportingApp - State setter for standalone app export indicator.
 * @returns {Promise<void>}
 *
 * @example
 * await executeStandaloneAppExport({ tree, sheetUrl, focusId, appendLog, setErrorMsg, setIsExportingApp });
 *
 * @example
 * // Trigger export from button handler
 * const handleExportStandaloneApp = useCallback(() => executeStandaloneAppExport({
 *   tree, sheetUrl, focusId, appendLog, setErrorMsg, setIsExportingApp
 * }), [tree, sheetUrl, focusId, appendLog, setErrorMsg]);
 */
async function executeStandaloneAppExport({ tree, sheetUrl, focusId, appendLog, setErrorMsg, setIsExportingApp }) {
    setIsExportingApp(true);
    try {
        const appCodeText = await resolveApplicationSourceCode();
        const { treeData, selectedName, dateStr, title } = prepareStandaloneExportData({ tree, sheetUrl, focusId });
        const standaloneHtml = FamilyTreeBuilder.buildStandaloneAppHtml(appCodeText, treeData, title);

        const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${selectedName}_Interactive_App_${dateStr}.html`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        appendLog(`⚡ Exported standalone interactive app (${(blob.size / 1024).toFixed(0)} KB)`, 'success');
    } catch (err) {
        console.error("Failed to export standalone application:", err);
        setErrorMsg("Failed to export standalone app: " + (err.message || err));
    } finally {
        setIsExportingApp(false);
    }
}

/**
 * Generates a printable A4 landscape HTML document string for a family tree.
 *
 * @param {FamilyTree} tree - Active family tree model.
 * @param {Object} layoutConfig - Layout configuration options.
 * @returns {string} Rendered A4 print document HTML markup.
 *
 * @example
 * const html = generatePrintableA4Document(tree, layoutConfig);
 *
 * @example
 * const html = generatePrintableA4Document(myTree, { showBadges: true });
 */
function generatePrintableA4Document(tree, layoutConfig) {
    const title = `${tree.root?.name ? `${tree.root.name} - ` : ''}Family Tree (A4 Landscape Print)`;
    return A4PrintComposer.buildPrintableA4Html(tree, layoutConfig, {
        title,
        targetFontSizePt: 10,
        baseFontSizePx: 11
    });
}

/**
 * Opens a Blob in a new browser tab/window safely, revoking the object URL after a timeout.
 *
 * @param {Blob} blob - Binary object to preview in browser tab.
 * @param {number} [revokeTimeoutMs=60000] - Duration before revoking object URL.
 *
 * @example
 * previewBlobInNewTab(htmlBlob);
 *
 * @example
 * previewBlobInNewTab(pdfBlob, 30000);
 */
function previewBlobInNewTab(blob, revokeTimeoutMs = 60000) {
    const blobUrl = URL.createObjectURL(blob);
    try {
        window.open(blobUrl, '_blank');
    } catch (e) {
        // Ignore popup blocker errors
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), revokeTimeoutMs);
}

/**
 * Exports the family tree to a printable multi-page A4 landscape HTML document and initiates print preview.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - The current FamilyTree instance.
 * @param {Object} options.layoutConfig - Current layout configuration with highlights and display options.
 * @param {Function} options.appendLog - Function to append log message in status drawer.
 * @param {Function} options.setErrorMsg - Function to display error message.
 * @param {Function} options.setIsExportingA4 - State setter for A4 print exporting indicator.
 * @returns {Promise<void>}
 *
 * @example
 * await executeA4PrintExport({ tree, layoutConfig, appendLog, setErrorMsg, setIsExportingA4 });
 *
 * @example
 * // Trigger print export from button handler
 * const handleExportA4Print = useCallback(() => executeA4PrintExport({
 *   tree, layoutConfig, appendLog, setErrorMsg, setIsExportingA4
 * }), [tree, layoutConfig, appendLog, setErrorMsg]);
 */
async function executeA4PrintExport({ tree, layoutConfig, appendLog, setErrorMsg, setIsExportingA4 }) {
    if (!tree || !tree.root) {
        setErrorMsg("Please load and display a family tree first.");
        return;
    }

    setIsExportingA4(true);
    try {
        const rootName = (tree.root?.name || 'Family_Tree').replace(/[^a-zA-Z0-9_-]/g, '_');
        const dateStr = ExportUtils.formatTimestamp();
        const htmlContent = generatePrintableA4Document(tree, layoutConfig);

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const fileName = `${rootName}_A4_Landscape_Print_${dateStr}.html`;
        ExportUtils.triggerDownload(blob, fileName);
        previewBlobInNewTab(blob);

        appendLog(`🖨️ Exported printable A4 landscape pages (${(blob.size / 1024).toFixed(0)} KB)`, 'success');
    } catch (err) {
        console.error("Failed to generate printable A4 document:", err);
        setErrorMsg("Failed to export A4 print HTML: " + (err.message || err));
    } finally {
        setIsExportingA4(false);
    }
}

/**
 * Generates and downloads a CSV export file containing all geocoded locations from the family tree.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {Function} params.setErrorMsg - Error notification setter
 * @returns {void}
 *
 * @example
 *   executeMapLocationsExport({ tree, setErrorMsg });
 *
 * @example
 *   executeMapLocationsExport({ tree: null, setErrorMsg: console.error });
 */
function executeMapLocationsExport({ tree, setErrorMsg }) {
    const csvContent = ExportUtils.generateMapLocationsCSV(tree);
    if (!csvContent) return setErrorMsg("No locations found in the family tree to export.");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    ExportUtils.triggerDownload(blob, "Family_Tree_Locations.csv");
}

/**
 * Hook providing export action handlers and loading state indicators for family tree artifacts
 * (vector SVG image HTML, map locations CSV, standalone single-file app, and printable A4 landscape HTML).
 *
 * @param {Object} params
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {string} params.sheetUrl - Remote Google Sheet data source URL
 * @param {React.RefObject} params.containerRef - Tree viewport container element ref
 * @param {string|null} params.focusId - Currently focused person id
 * @param {Object} params.layoutConfig - Calculated tree layout configuration object
 * @param {Function} params.appendLog - Append system/diagnostic log entry
 * @param {Function} params.setErrorMsg - Global error message setter
 * @returns {{
 *   isExporting: boolean,
 *   handleExportImage: () => Promise<void>,
 *   handleExportMapCSV: () => void,
 *   isExportingApp: boolean,
 *   handleExportStandaloneApp: () => Promise<void>,
 *   isExportingA4: boolean,
 *   handleExportA4Print: () => Promise<void>
 * }}
 *
 * @example
 *   const {
 *     isExporting, handleExportImage,
 *     isExportingApp, handleExportStandaloneApp,
 *     isExportingA4, handleExportA4Print
 *   } = useTreeExportHandlers({ tree, sheetUrl, containerRef, focusId, layoutConfig, appendLog, setErrorMsg });
 *
 * @example
 *   const exportHandlers = useTreeExportHandlers({
 *     tree: null, sheetUrl: '', containerRef: { current: null },
 *     focusId: null, layoutConfig: {}, appendLog: () => {}, setErrorMsg: () => {}
 *   });
 */
function useTreeExportHandlers({ tree, sheetUrl, containerRef, focusId, layoutConfig, appendLog, setErrorMsg }) {
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingApp, setIsExportingApp] = useState(false);
    const [isExportingA4, setIsExportingA4] = useState(false);

    const handleExportImage = useCallback(async () => {
        return executeVectorSvgExport({ containerRef, tree, setErrorMsg, setIsExporting });
    }, [tree, containerRef, setErrorMsg]);

    const handleExportMapCSV = useCallback(() => {
        executeMapLocationsExport({ tree, setErrorMsg });
    }, [tree, setErrorMsg]);

    const handleExportStandaloneApp = useCallback(async () => {
        return executeStandaloneAppExport({ tree, sheetUrl, focusId, appendLog, setErrorMsg, setIsExportingApp });
    }, [tree, sheetUrl, appendLog, setErrorMsg, focusId]);

    const handleExportA4Print = useCallback(async () => {
        return executeA4PrintExport({ tree, layoutConfig, appendLog, setErrorMsg, setIsExportingA4 });
    }, [tree, layoutConfig, appendLog, setErrorMsg]);

    return {
        isExporting, handleExportImage, handleExportMapCSV,
        isExportingApp, handleExportStandaloneApp,
        isExportingA4, handleExportA4Print
    };
}

/**
 * Inspects person IDs referenced in an AI response to check whether any profile
 * belongs to an ancestor lineage outside the currently displayed tree root.
 *
 * @param {FamilyTree} tree - Active family tree model
 * @param {string[]} ids - Person IDs returned by AI Assistant
 * @returns {string|null} ID of a new oldest ancestor root if rerooting is required, otherwise null.
 *
 * @example
 *   const newRoot = findAiMentionedTreeRoot(tree, ['id_joseph_12', 'id_mary_34']);
 *   if (newRoot && newRoot !== tree.rootId) {
 *     setTree(prev => new FamilyTree(prev.nodes, newRoot, prev.sheetNames));
 *   }
 *
 * @example
 *   findAiMentionedTreeRoot(tree, []);
 *   // => null
 */
function findAiMentionedTreeRoot(tree, ids) {
    if (!tree || !ids || ids.length === 0) return null;
    for (const id of ids) {
        const p = tree.get(id);
        if (p) {
            const newRoot = tree.getOldestAncestor(id);
            if (newRoot && newRoot !== tree.rootId) {
                return newRoot;
            }
        }
    }
    return null;
}

/**
 * Determines whether focusing a person requires rerooting the tree display,
 * and returns the new oldest ancestor root ID if needed.
 *
 * @param {FamilyTree} tree - Active family tree model
 * @param {string} personId - ID of focused person
 * @param {Set<string>} visibleNodes - Set of currently visible node IDs
 * @returns {string|null} ID of new root if reroot is needed, otherwise null
 *
 * @example
 *   const newRoot = resolveRerootForFocusPerson(tree, 'p123', visibleNodes);
 *   if (newRoot) {
 *     anchorRequestRef.current = null;
 *     setTree(prev => new FamilyTree(prev.nodes, newRoot, prev.sheetNames));
 *   }
 *
 * @example
 *   resolveRerootForFocusPerson(null, 'p123', new Set());
 *   // => null
 */
function resolveRerootForFocusPerson(tree, personId, visibleNodes) {
    if (!tree || !personId) return null;
    const p = tree.get(personId);
    if (p && shouldRerootForPerson(p, tree, visibleNodes)) {
        const newRoot = tree.getOldestAncestor(personId);
        if (newRoot && newRoot !== tree.rootId) {
            return newRoot;
        }
    }
    return null;
}

/**
 * Calculates camera displacement delta (dx, dy) required to keep a node card
 * pinned to its exact screen coordinate before and after a branch collapse/expand.
 *
 * @param {HTMLElement} nodeEl - Rendered DOM element of the anchor node
 * @param {DOMRect} startRect - Bounding rectangle of the node before state change
 * @returns {{ dx: number, dy: number }} Pixel offsets to apply to camera
 *
 * @example
 *   const { dx, dy } = calculateAnchorShift(nodeEl, startRect);
 *   if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
 *     setCamera(cam => ({ ...cam, x: cam.x + dx, y: cam.y + dy }));
 *   }
 *
 * @example
 *   calculateAnchorShift(nodeEl, { left: 100, top: 150, width: 200, height: 80 });
 *   // => { dx: 0, dy: 0 } (when nodeEl has matching screen position)
 */
function calculateAnchorShift(nodeEl, startRect) {
    const currentRect = nodeEl.getBoundingClientRect();
    const currentX = currentRect.left + (currentRect.width / 2);
    const currentY = currentRect.top + (currentRect.height / 2);
    const targetX = startRect.left + (startRect.width / 2);
    const targetY = startRect.top + (startRect.height / 2);
    return {
        dx: targetX - currentX,
        dy: targetY - currentY
    };
}

/**
 * Resolves the CSS highlight class for cards matching the active filter.
 *
 * @param {object|null} activeFilter - Active filter descriptor ({ filterType, value })
 * @returns {string} Tailwind CSS class string for highlight border/ring
 *
 * @example
 *   getFilterHighlightClass({ filterType: 'place', value: 'Thrissur' });
 *   // => 'ring-2 ring-rose-500 !border-rose-500'
 *
 * @example
 *   getFilterHighlightClass(null);
 *   // => ''
 */
function getFilterHighlightClass(activeFilter) {
    if (!activeFilter || activeFilter.filterType === 'directory') return '';
    const config = FILTER_BADGE_CONFIG[activeFilter.filterType];
    return config?.ringColor || 'ring-2 ring-blue-500 !border-blue-500';
}

/**
 * Loads pre-bundled tree data from an `#embedded-tree-data` script element if present in the DOM.
 * Used in standalone HTML exports to provide instantaneous zero-network rendering.
 *
 * @returns {{
 *   tree: FamilyTree,
 *   sheetUrl: string|null,
 *   selectedId: string|null,
 *   rowCount: number
 * } | null} Parsed payload or null if unavailable or invalid.
 *
 * @example
 *   const embedded = loadEmbeddedTreeDataset();
 *   if (embedded) {
 *     setTree(embedded.tree);
 *     if (embedded.sheetUrl) setSheetUrl(embedded.sheetUrl);
 *   }
 *
 * @example
 *   // When no #embedded-tree-data script tag is present
 *   loadEmbeddedTreeDataset();
 *   // => null
 */
function loadEmbeddedTreeDataset() {
    if (typeof document === 'undefined') return null;
    const embeddedElem = document.getElementById('embedded-tree-data');
    if (!embeddedElem || !embeddedElem.textContent.trim()) return null;

    try {
        const embedded = JSON.parse(embeddedElem.textContent);
        if (embedded && Array.isArray(embedded.rows) && embedded.rows.length > 0) {
            return embedded;
        }
    } catch (e) {
        console.error("Failed to parse embedded tree data:", e);
    }
    return null;
}

/**
 * Calculates the next history pointer when stepping forward or backward.
 *
 * @param {number} currentPointer - Current index in navigation history
 * @param {number} historyLength - Total number of history entries
 * @param {'back'|'forward'} direction - Direction to step
 * @returns {number|null} Target index if valid step, or null if bounded
 *
 * @example
 *   getNextHistoryPointer(2, 5, 'back');
 *   // => 1
 *
 * @example
 *   getNextHistoryPointer(0, 5, 'back');
 *   // => null
 *
 * @example
 *   getNextHistoryPointer(2, 5, 'forward');
 *   // => 3
 */
function getNextHistoryPointer(currentPointer, historyLength, direction) {
    if (direction === 'back') {
        return currentPointer > 0 ? currentPointer - 1 : null;
    }
    if (direction === 'forward') {
        return currentPointer < historyLength - 1 ? currentPointer + 1 : null;
    }
    return null;
}

/**
 * Normalizes the root person ID from a data-fetch or import response.
 *
 * @param {object|string|null} res - API response object or raw ID string
 * @returns {string|null} Normalized root ID or null
 *
 * @example
 *   extractRootIdFromImportResponse({ rootId: 'p123' });
 *   // => 'p123'
 *
 * @example
 *   extractRootIdFromImportResponse('p123');
 *   // => 'p123'
 *
 * @example
 *   extractRootIdFromImportResponse(null);
 *   // => null
 */
function extractRootIdFromImportResponse(res) {
    if (!res) return null;
    return typeof res === 'object' ? res?.rootId || null : res;
}

/**
 * Calculates the dynamic horizontal gap between sibling cards based on camera zoom.
 *
 * @param {number} cameraZ - Current zoom level of the canvas camera
 * @returns {number} Sibling gap in pixels (bounded between 24 and 64)
 *
 * @example
 *   calculateSiblingGap(1.0);
 *   // => 24
 *
 * @example
 *   calculateSiblingGap(0.1);
 *   // => 64
 */
function calculateSiblingGap(cameraZ) {
    return Math.round(Math.max(24, Math.min(64, 24 / Math.sqrt(Math.max(0.05, cameraZ)))));
}

/**
 * Toggles presence of an item within an immutable Set.
 *
 * @template T
 * @param {Set<T>} set - Original set
 * @param {T} item - Item to toggle
 * @returns {Set<T>} New Set with item added if absent, or removed if present
 *
 * @example
 *   toggleSetMember(new Set(['a', 'b']), 'b');
 *   // => Set {'a'}
 *
 * @example
 *   toggleSetMember(new Set(['a']), 'b');
 *   // => Set {'a', 'b'}
 */
function toggleSetMember(set, item) {
    const next = new Set(set);
    if (next.has(item)) {
        next.delete(item);
    } else {
        next.add(item);
    }
    return next;
}

/**
 * Resolves the target profile ID from a history entry or legacy ID string.
 *
 * @param {object|string|null} entry - Nav history entry or raw person ID string
 * @returns {string|null} Resolved person ID or null if entry is not for a person
 *
 * @example
 *   resolveNavHistoryPersonId({ type: 'person', id: 'p123' });
 *   // => 'p123'
 *
 * @example
 *   resolveNavHistoryPersonId('p123');
 *   // => 'p123'
 *
 * @example
 *   resolveNavHistoryPersonId({ type: 'filter', filterType: 'place', value: 'Thrissur' });
 *   // => null
 */
function resolveNavHistoryPersonId(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    return entry.type === 'person' || !entry.type ? entry.id || null : null;
}

/**
 * Appends a person profile to navigation history, truncating forward history beyond pointer.
 *
 * @param {Array<object>} history - Current navigation history stack
 * @param {number} pointer - Current navigation pointer index
 * @param {string} personId - Unique person profile ID
 * @returns {{ history: Array<object>, pointer: number }} Updated navigation history and pointer
 *
 * @example
 *   appendPersonHistoryEntry([], -1, 'p1');
 *   // => { history: [{ type: 'person', id: 'p1' }], pointer: 0 }
 *
 * @example
 *   appendPersonHistoryEntry([{ type: 'person', id: 'p1' }, { type: 'person', id: 'p2' }], 0, 'p3');
 *   // => { history: [{ type: 'person', id: 'p1' }, { type: 'person', id: 'p3' }], pointer: 1 }
 */
function appendPersonHistoryEntry(history, pointer, personId) {
    const nextEntry = { type: 'person', id: personId };
    const nextHistory = [...history.slice(0, pointer + 1), nextEntry];
    return {
        history: nextHistory,
        pointer: nextHistory.length - 1
    };
}

/**
 * Appends or updates a filter entry in navigation history, updating search queries in-place.
 *
 * @param {Array<object>} history - Current navigation history stack
 * @param {number} pointer - Current navigation pointer index
 * @param {{ filterType: string, value: string, tab?: string }} filterParams - Active filter parameters
 * @returns {{ history: Array<object>, pointer: number }} Updated navigation history and pointer
 *
 * @example
 *   appendFilterHistoryEntry([], -1, { filterType: 'place', value: 'Kochi' });
 *   // => { history: [{ type: 'filter', filterType: 'place', value: 'Kochi' }], pointer: 0 }
 *
 * @example
 *   // Consecutive live search updates replace previous search entry in-place
 *   appendFilterHistoryEntry([{ type: 'filter', filterType: 'search', value: 'Jos' }], 0, { filterType: 'search', value: 'Joseph' });
 *   // => { history: [{ type: 'filter', filterType: 'search', value: 'Joseph' }], pointer: 0 }
 */
function appendFilterHistoryEntry(history, pointer, { filterType, value, tab }) {
    const nextEntry = {
        type: 'filter',
        filterType,
        value,
        tab: filterType === 'directory' ? value : tab
    };

    if (pointer >= 0 && history[pointer]?.type === 'filter' && history[pointer]?.filterType === 'search' && filterType === 'search') {
        const updated = [...history];
        updated[pointer] = nextEntry;
        return { history: updated, pointer };
    }

    const nextHistory = [...history.slice(0, pointer + 1), nextEntry];
    return {
        history: nextHistory,
        pointer: nextHistory.length - 1
    };
}

/**
 * Hook providing push action callbacks for person focus and category filter changes in navigation history.
 *
 * @param {number} historyPointer - Active position pointer in the navigation history stack.
 * @param {Function} setNavHistory - State setter for the navigation history array.
 * @param {Function} setHistoryPointer - State setter for the active history pointer.
 * @returns {{
 *   pushPersonHistory: (id: string) => void,
 *   pushFilterHistory: (filterType: string, value: string, tab?: string) => void
 * }} Action dispatchers for pushing navigation entries.
 *
 * @example
 *   const { pushPersonHistory, pushFilterHistory } = useNavigationPushActions(pointer, setHistory, setPointer);
 *   pushPersonHistory('p101');
 *
 * @example
 *   const { pushFilterHistory } = useNavigationPushActions(pointer, setHistory, setPointer);
 *   pushFilterHistory('job', 'Farmer', 'job');
 */
function useNavigationPushActions(historyPointer, setNavHistory, setHistoryPointer) {
    const pushPersonHistory = useCallback((id) => {
        setNavHistory(prev => {
            const result = appendPersonHistoryEntry(prev, historyPointer, id);
            setHistoryPointer(result.pointer);
            return result.history;
        });
    }, [historyPointer, setNavHistory, setHistoryPointer]);

    const pushFilterHistory = useCallback((filterType, value, tab) => {
        setNavHistory(prev => {
            const result = appendFilterHistoryEntry(prev, historyPointer, { filterType, value, tab });
            setHistoryPointer(result.pointer);
            return result.history;
        });
    }, [historyPointer, setNavHistory, setHistoryPointer]);

    return { pushPersonHistory, pushFilterHistory };
}

/**
 * Hook providing history stepping callback across navigation stack entries.
 *
 * @param {number} historyPointer - Current navigation stack index
 * @param {Array<object>} navHistory - Navigation history entries
 * @param {Function} setHistoryPointer - State setter for navigation stack pointer
 * @returns {Function} Stepping callback taking direction and entry consumer
 *
 * @example
 * const stepHistory = useNavigationHistoryStepper(0, [{ type: 'person', id: 'p1' }], () => {});
 *
 * @example
 * const stepHistory = useNavigationHistoryStepper(-1, [], () => {});
 */
function useNavigationHistoryStepper(historyPointer, navHistory, setHistoryPointer) {
    return useCallback((direction, onApply) => {
        const targetIndex = getNextHistoryPointer(historyPointer, navHistory.length, direction);
        if (targetIndex !== null) {
            setHistoryPointer(targetIndex);
            if (onApply) onApply(navHistory[targetIndex]);
        }
    }, [historyPointer, navHistory, setHistoryPointer]);
}

/**
 * Hook to initialize the navigation history stack with the initial focus person when first loaded.
 *
 * @param {string|null} initialFocusId - Identifier of the initial focus person node.
 * @param {number} historyLength - Current length of the navigation history stack.
 * @param {Function} setNavHistory - State setter for the navigation history stack.
 * @param {Function} setHistoryPointer - State setter for the current history pointer.
 *
 * @example
 * useInitialNavigationHistory('p1', 0, setNavHistory, setHistoryPointer);
 *
 * @example
 * useInitialNavigationHistory(null, 1, () => {}, () => {});
 */
function useInitialNavigationHistory(initialFocusId, historyLength, setNavHistory, setHistoryPointer) {
    useEffect(() => {
        if (initialFocusId && historyLength === 0) {
            setNavHistory([{ type: 'person', id: initialFocusId }]);
            setHistoryPointer(0);
        }
    }, [initialFocusId, historyLength, setNavHistory, setHistoryPointer]);
}

/**
 * Custom hook for managing forward/backward breadcrumb navigation history across persons and filter states.
 *
 * @param {string|null} initialFocusId - Initial focus person ID used to seed empty history
 * @returns {{
 *   navHistory: Array<object>,
 *   historyPointer: number,
 *   canGoBack: boolean,
 *   canGoForward: boolean,
 *   pushPersonHistory: (id: string) => void,
 *   pushFilterHistory: (filterType: string, value: string, tab?: string) => void,
 *   stepHistory: (direction: 'back'|'forward', onApply: (entry: object) => void) => void,
 *   resetNavHistory: () => void
 * }}
 *
 * @example
 *   const { canGoBack, canGoForward, pushPersonHistory, stepHistory } = useTreeNavigationHistory(focusId);
 *   pushPersonHistory('p123');
 *   if (canGoBack) stepHistory('back', applyEntry);
 *
 * @example
 *   const { navHistory, historyPointer, resetNavHistory } = useTreeNavigationHistory(null);
 *   resetNavHistory();
 */
function useTreeNavigationHistory(initialFocusId) {
    const [navHistory, setNavHistory] = useState([]);
    const [historyPointer, setHistoryPointer] = useState(-1);

    useInitialNavigationHistory(initialFocusId, navHistory.length, setNavHistory, setHistoryPointer);

    const { pushPersonHistory, pushFilterHistory } = useNavigationPushActions(
        historyPointer, setNavHistory, setHistoryPointer
    );

    const resetNavHistory = useCallback(() => {
        setNavHistory([]);
        setHistoryPointer(-1);
    }, []);

    const stepHistory = useNavigationHistoryStepper(historyPointer, navHistory, setHistoryPointer);

    return {
        navHistory, historyPointer,
        canGoBack: historyPointer > 0,
        canGoForward: historyPointer < navHistory.length - 1,
        pushPersonHistory, pushFilterHistory, stepHistory, resetNavHistory
    };
}

/**
 * Hook for managing temporary visual highlights on profile cards mentioned in AI assistant responses.
 *
 * @param {number} [duration=10000] - Duration in milliseconds before highlights are automatically cleared
 * @returns {{
 *   aiHighlightedIds: Set<string>,
 *   triggerAiHighlights: (ids: string[]) => void,
 *   clearAiHighlights: () => void
 * }}
 *
 * @example
 *   const { aiHighlightedIds, triggerAiHighlights, clearAiHighlights } = useAiProfileHighlights();
 *   triggerAiHighlights(['p1', 'p2']);
 *   clearAiHighlights();
 *
 * @example
 *   const { triggerAiHighlights } = useAiProfileHighlights(5000);
 *   triggerAiHighlights(['id_123']);
 */
function useAiProfileHighlights(duration = 10000) {
    const [aiHighlightedIds, setAiHighlightedIds] = useState(new Set());
    const timerRef = useRef(null);

    const clearAiHighlights = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setAiHighlightedIds(new Set());
    }, []);

    const triggerAiHighlights = useCallback((ids) => {
        if (!ids || ids.length === 0) return;
        setAiHighlightedIds(new Set(ids));
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setAiHighlightedIds(new Set());
        }, duration);
    }, [duration]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return { aiHighlightedIds, triggerAiHighlights, clearAiHighlights };
}

/**
 * Hook for managing subtree collapse state with smooth viewport anchor compensation.
 * When expanding or collapsing subtrees, adjusts the camera position to keep the toggled card anchored in place.
 *
 * @param {object} params - Anchor configuration
 * @param {React.RefObject} params.treeRef - Reference to the family tree canvas container
 * @param {React.Dispatch<React.SetStateAction<object>>} params.setCamera - Camera state setter
 * @param {(personId: string) => void} params.centerOnPerson - Fallback centering function if card is off-screen
 * @param {string|null} [params.rootId] - Root ID of the active family tree
 * @param {string|null} [params.focusId] - Currently focused person ID
 * @returns {{
 *   collapsedNodes: Set<string>,
 *   setCollapsedNodes: React.Dispatch<React.SetStateAction<Set<string>>>,
 *   isShifting: boolean,
 *   setIsShifting: React.Dispatch<React.SetStateAction<boolean>>,
 *   toggleCollapse: (id: string) => void,
 *   clearAnchorRequest: () => void
 * }}
 *
 * @example
 *   const { collapsedNodes, setCollapsedNodes, isShifting, toggleCollapse } = useSubtreeCollapseAnchor({
 *     treeRef,
 *     setCamera,
 *     centerOnPerson,
 *     rootId: tree.rootId,
 *     focusId
 *   });
 *
 * @example
 *   const { toggleCollapse, clearAnchorRequest } = useSubtreeCollapseAnchor({
 *     treeRef: { current: null },
 *     setCamera: () => {},
 *     centerOnPerson: () => {},
 *     rootId: null,
 *     focusId: null
 *   });
 *   toggleCollapse('p_root');
 */
/**
 * Calculates and applies camera offset compensation when expanding or collapsing subtrees.
 *
 * @param {object} anchorRequest - Captured anchor metadata before tree re-layout
 * @param {string} anchorRequest.id - Person node ID
 * @param {DOMRect} [anchorRequest.startRect] - Node element bounding rect prior to collapse/expansion
 * @param {boolean} [anchorRequest.isVisibleOnScreen] - Whether node was initially visible in viewport
 * @param {Function} setCamera - React state setter for camera position
 * @param {Function} centerOnPerson - Centering fallback when node was not on screen
 * @param {Function} setIsShifting - State setter indicating active anchor compensation
 *
 * @example
 * applySubtreeAnchorShift(
 *   { id: 'p1', startRect: rect, isVisibleOnScreen: true },
 *   setCamera,
 *   centerOnPerson,
 *   setIsShifting
 * );
 *
 * @example
 * applySubtreeAnchorShift(
 *   { id: 'p2', isVisibleOnScreen: false },
 *   setCamera,
 *   centerOnPerson,
 *   setIsShifting
 * );
 */
function applySubtreeAnchorShift(anchorRequest, setCamera, centerOnPerson, setIsShifting) {
    const { id, startRect, isVisibleOnScreen } = anchorRequest;
    const nodeEl = document.getElementById(`node-${id}`);
        if (!nodeEl) {
            setIsShifting(false);
            return;
        }

    if (startRect && isVisibleOnScreen) {
        const { dx, dy } = calculateAnchorShift(nodeEl, startRect);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            setCamera(cam => ({ ...cam, x: cam.x + dx, y: cam.y + dy }));
        }
    } else if (!isVisibleOnScreen) {
        centerOnPerson(id);
    }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsShifting(false);
            });
        });
}

/**
 * Hook managing collapsible tree subtrees and camera position compensation during expand/collapse transitions.
 *
 * @param {object} params
 * @param {React.RefObject} params.treeRef - Reference to the SVG/DOM container
 * @param {Function} params.setCamera - React state setter for viewport camera
 * @param {Function} params.centerOnPerson - Centering fallback when node was not on screen
 * @param {string|null} params.rootId - Active tree root ID
 * @param {string|null} params.focusId - Focused person ID
 * @returns {object} Collapsed nodes set, shifting state, toggle function, and clear callback.
 *
 * @example
 * const { collapsedNodes, toggleCollapse } = useSubtreeCollapseAnchor({
 *   treeRef, setCamera, centerOnPerson, rootId: 'root', focusId: null
 * });
 *
 * @example
 * const { isShifting, clearAnchorRequest } = useSubtreeCollapseAnchor(anchorParams);
 */
function useSubtreeCollapseAnchor({ treeRef, setCamera, centerOnPerson, rootId, focusId }) {
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [isShifting, setIsShifting] = useState(false);
    const anchorRequestRef = useRef(null);

    const clearAnchorRequest = useCallback(() => { anchorRequestRef.current = null; }, []);

    const toggleCollapse = useCallback((id) => {
        const nodeEl = document.getElementById(`node-${id}`);
        if (nodeEl) {
            setIsShifting(true);
            anchorRequestRef.current = { id, startRect: nodeEl.getBoundingClientRect(), isVisibleOnScreen: true };
        }
        setCollapsedNodes(prev => toggleSetMember(prev, id));
    }, []);

    useLayoutEffect(() => {
        if (!anchorRequestRef.current || !treeRef.current) return;
        const req = anchorRequestRef.current;
        anchorRequestRef.current = null;
        applySubtreeAnchorShift(req, setCamera, centerOnPerson, setIsShifting);
    }, [collapsedNodes, focusId, rootId, setCamera, centerOnPerson, treeRef]);

    return {
        collapsedNodes, setCollapsedNodes,
        isShifting, setIsShifting,
        toggleCollapse, clearAnchorRequest
    };
}

/**
 * Subscribes to global window 'focusPerson' CustomEvents (dispatched by external controls,
 * dialogs, or embedded widgets) to coordinate person focus and camera centering.
 * 
 * @param {Function} onFocusPerson - Callback invoked with the person ID (string).
 * 
 * @example
 *   useGlobalFocusPersonListener(useCallback((personId) => {
 *       handleSetFocusId(personId);
 *       centerOnPerson(personId);
 *   }, [handleSetFocusId, centerOnPerson]));
 *
 * @example
 *   useGlobalFocusPersonListener((id) => console.log('Focus request:', id));
 */
function useGlobalFocusPersonListener(onFocusPerson) {
    useEffect(() => {
        const handleFocusPersonEvent = (e) => {
            if (e.detail && onFocusPerson) {
                onFocusPerson(e.detail);
            }
        };
        window.addEventListener('focusPerson', handleFocusPersonEvent);
        return () => window.removeEventListener('focusPerson', handleFocusPersonEvent);
    }, [onFocusPerson]);
}

/**
 * Automatically fits the tree to the screen upon initial tree load and keeps camera
 * framed or centered when the tree root changes (e.g., following re-rooting or import).
 * 
 * @param {Object} options
 * @param {React.RefObject} options.treeRef - Reference to the tree DOM container element.
 * @param {string|null} options.rootId - Currently active root person ID in the family tree.
 * @param {number} options.collapsedCount - Number of currently collapsed nodes.
 * @param {string|null} options.focusId - ID of currently focused person, if any.
 * @param {Function} options.onFitToScreen - Callback to auto-fit tree in viewport.
 * @param {Function} options.onCenterPerson - Callback to center viewport on a specific person.
 * @returns {{ resetInitialFit: Function }}
 * 
 * @example
 *   const { resetInitialFit } = useTreeAutoFit({
 *       treeRef,
 *       rootId: tree.rootId,
 *       collapsedCount: collapsedNodes.size,
 *       focusId,
 *       onFitToScreen: handleFitToScreen,
 *       onCenterPerson: centerOnPerson
 *   });
 *
 * @example
 *   const { resetInitialFit } = useTreeAutoFit({
 *       treeRef: { current: null },
 *       rootId: null,
 *       collapsedCount: 0,
 *       focusId: null,
 *       onFitToScreen: () => {},
 *       onCenterPerson: () => {}
 *   });
 *   resetInitialFit();
 */
function useTreeAutoFit({ treeRef, rootId, collapsedCount, focusId, onFitToScreen, onCenterPerson }) {
    const hasInitialFitDone = useRef(false);

    useLayoutEffect(() => {
        if (!hasInitialFitDone.current && treeRef.current && rootId && !collapsedCount && !focusId) {
            hasInitialFitDone.current = true;
            onFitToScreen();
        }
    }, [rootId, collapsedCount, focusId, onFitToScreen, treeRef]);

    const prevRootIdRef = useRef(rootId);
    useLayoutEffect(() => {
        if (prevRootIdRef.current !== rootId) {
            prevRootIdRef.current = rootId;
            if (focusId) {
                onCenterPerson(focusId);
            } else {
                onFitToScreen();
            }
        }
    }, [rootId, focusId, onCenterPerson, onFitToScreen]);

    const resetInitialFit = useCallback(() => {
        hasInitialFitDone.current = false;
    }, []);

    return { resetInitialFit };
}

/**
 * Hides auxiliary sidebar panels (logs drawer and AI assistant).
 *
 * @param {Object} options
 * @param {Function} options.setShowLogs - Setter for logs panel visibility.
 * @param {Function} options.setShowAI - Setter for AI assistant panel visibility.
 *
 * @example
 * hideAuxiliaryPanels({
 *   setShowLogs: () => {},
 *   setShowAI: () => {}
 * });
 *
 * @example
 * hideAuxiliaryPanels({ setShowLogs, setShowAI });
 */
function hideAuxiliaryPanels({ setShowLogs, setShowAI }) {
    setShowLogs(false);
    setShowAI(false);
}

/**
 * Creates actions for activating individual sidebar and auxiliary panels.
 *
 * @param {Object} params
 * @param {Function} params.setIsSidebarVisible - Sidebar visibility setter.
 * @param {Function} params.setShowLogs - Logs drawer visibility setter.
 * @param {Function} params.setShowAI - AI assistant visibility setter.
 * @param {Function} params.setShowMap - Map view visibility setter.
 * @param {Function} params.setActiveFilter - Active filter state setter.
 * @param {Function} params.hideAux - Callback to hide auxiliary panels.
 * @returns {{ openPersonPanel: Function, openFilterPanel: Function, openAiPanel: Function }}
 *
 * @example
 * const openers = createPanelOpeners({ setIsSidebarVisible, setShowLogs, setShowAI, setShowMap, setActiveFilter, hideAux });
 *
 * @example
 * const { openPersonPanel } = createPanelOpeners({ setIsSidebarVisible, setShowLogs, setShowAI, setShowMap, setActiveFilter, hideAux });
 */
function createPanelOpeners({ setIsSidebarVisible, setShowLogs, setShowAI, setShowMap, setActiveFilter, hideAux }) {
    const openPersonPanel = () => {
        setActiveFilter(null);
        setShowMap(false);
        setIsSidebarVisible(true);
        hideAux();
    };

    const openFilterPanel = () => {
        setIsSidebarVisible(true);
        hideAux();
    };

    const openAiPanel = () => {
        setShowAI(true);
        setShowMap(false);
        setShowLogs(false);
        setIsSidebarVisible(false);
    };

    return { openPersonPanel, openFilterPanel, openAiPanel };
}

/**
 * Creates dispatch callbacks for coordinating panel visibility across the application.
 *
 * @param {Object} setStates
 * @param {Function} setStates.setIsSidebarVisible - Sidebar visibility setter
 * @param {Function} setStates.setShowLogs - Logs drawer visibility setter
 * @param {Function} setStates.setShowAI - AI assistant visibility setter
 * @param {Function} setStates.setShowMap - Map view visibility setter
 * @param {Function} setStates.setActiveFilter - Active filter state setter
 * @returns {{ closeAllPanels: Function, openPersonPanel: Function, openFilterPanel: Function, openAiPanel: Function }}
 *
 * @example
 * const { closeAllPanels, openPersonPanel } = createPanelVisibilityActions({
 *   setIsSidebarVisible: () => {},
 *   setShowLogs: () => {},
 *   setShowAI: () => {},
 *   setShowMap: () => {},
 *   setActiveFilter: () => {}
 * });
 * Handy helper closing all panels.
 * closeAllPanels();
 *
 * @example
 * const { openFilterPanel, openAiPanel } = createPanelVisibilityActions({
 *   setIsSidebarVisible: () => {},
 *   setShowLogs: () => {},
 *   setShowAI: () => {},
 *   setShowMap: () => {},
 *   setActiveFilter: () => {}
 * });
 * openFilterPanel();
 */
function createPanelVisibilityActions({
    setIsSidebarVisible,
    setShowLogs,
    setShowAI,
    setShowMap,
    setActiveFilter
}) {
    const hideAux = () => hideAuxiliaryPanels({ setShowLogs, setShowAI });

    const closeAllPanels = () => {
        setIsSidebarVisible(false);
        hideAux();
        setActiveFilter(null);
    };

    const openers = createPanelOpeners({
        setIsSidebarVisible,
        setShowLogs,
        setShowAI,
        setShowMap,
        setActiveFilter,
        hideAux
    });

    return { closeAllPanels, ...openers };
}

/**
 * Hook initializing core UI sidebar panel state flags and setters.
 *
 * @returns {Object} Panel visibility states and state setter functions.
 *
 * @example
 * const panelStates = usePanelStates();
 *
 * @example
 * const { isSidebarVisible, setIsSidebarVisible } = usePanelStates();
 */
function usePanelStates() {
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [activeFilter, setActiveFilter] = useState(null);
    return {
        isSidebarVisible, setIsSidebarVisible,
        showLogs, setShowLogs,
        showAI, setShowAI,
        showMap, setShowMap,
        activeFilter, setActiveFilter
    };
}

/**
 * Coordinates UI sidebar panels, drawers, and modal visibility states
 * (person details sidebar, search filters, activity logs, AI assistant drawer, and map view).
 * 
 * @param {boolean} isLoading - Whether tree data is actively loading.
 * @returns {{
 *   isSidebarVisible: boolean,
 *   setIsSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>,
 *   showLogs: boolean,
 *   setShowLogs: React.Dispatch<React.SetStateAction<boolean>>,
 *   showAI: boolean,
 *   setShowAI: React.Dispatch<React.SetStateAction<boolean>>,
 *   showMap: boolean,
 *   setShowMap: React.Dispatch<React.SetStateAction<boolean>>,
 *   activeFilter: Object|null,
 *   setActiveFilter: React.Dispatch<React.SetStateAction<Object|null>>,
 *   isAnySidebarOpen: boolean,
 *   closeAllPanels: Function,
 *   openPersonPanel: Function,
 *   openFilterPanel: Function,
 *   openAiPanel: Function
 * }}
 * 
 * @example
 *   const {
 *     isSidebarVisible, setIsSidebarVisible,
 *     showLogs, setShowLogs,
 *     showAI, setShowAI,
 *     showMap, setShowMap,
 *     activeFilter, setActiveFilter,
 *     isAnySidebarOpen,
 *     closeAllPanels,
 *     openPersonPanel,
 *     openFilterPanel,
 *     openAiPanel
 *   } = useAppPanels(isLoading);
 *
 * @example
 *   const { closeAllPanels, isAnySidebarOpen } = useAppPanels(false);
 *   if (isAnySidebarOpen) closeAllPanels();
 */
function useAppPanels(isLoading) {
    const panelStates = usePanelStates();
    const { isSidebarVisible, showLogs, setShowLogs, showAI, showMap, activeFilter, setIsSidebarVisible, setShowAI, setShowMap, setActiveFilter } = panelStates;

    useEffect(() => {
        if (isLoading) {
            setShowLogs(true);
        }
    }, [isLoading, setShowLogs]);

    const { closeAllPanels, openPersonPanel, openFilterPanel, openAiPanel } = useMemo(() => 
        createPanelVisibilityActions({
            setIsSidebarVisible, setShowLogs, setShowAI, setShowMap, setActiveFilter
        }), [setIsSidebarVisible, setShowLogs, setShowAI, setShowMap, setActiveFilter]);

    const isAnySidebarOpen = Boolean(isSidebarVisible || showLogs || showAI || activeFilter);

    return {
        isSidebarVisible, setIsSidebarVisible,
        showLogs, setShowLogs,
        showAI, setShowAI,
        showMap, setShowMap,
        activeFilter, setActiveFilter,
        isAnySidebarOpen,
        closeAllPanels, openPersonPanel, openFilterPanel, openAiPanel
    };
}

/**
 * Initializes the family tree from an embedded script dataset if present (e.g. standalone app export),
 * or falls back to importing data from the default Google Sheets URL.
 * 
 * @param {Object} options
 * @param {Function} options.setTree - Tree state updater.
 * @param {Function} options.setSheetUrl - Sheet URL state updater.
 * @param {Function} options.setFocusId - Focus person ID state updater.
 * @param {Function} options.setIsSidebarVisible - Sidebar visibility state updater.
 * @param {Function} options.centerOnPerson - Camera centering callback.
 * @param {Function} options.appendLog - Log appending callback.
 * @param {Function} options.handleImport - Sheet import callback.
 * @returns {boolean} True if embedded dataset was successfully loaded, false otherwise.
 * 
 * @example
 *   initializeTreeDataset({
 *     setTree,
 *     setSheetUrl,
 *     setFocusId,
 *     setIsSidebarVisible,
 *     centerOnPerson,
 *     appendLog,
 *     handleImport
 *   });
 *
 * @example
 *   const loaded = initializeTreeDataset({
 *     setTree: () => {}, setSheetUrl: () => {}, setFocusId: () => {},
 *     setIsSidebarVisible: () => {}, centerOnPerson: () => {},
 *     appendLog: () => {}, handleImport: () => {}
 *   });
 */
function initializeTreeDataset({
    setTree, setSheetUrl, setFocusId, setIsSidebarVisible,
    centerOnPerson, appendLog, handleImport
}) {
    // In standalone mode with embedded data, load directly from embedded dataset with zero network fetch
    const embedded = loadEmbeddedTreeDataset();
    if (embedded) {
        const builder = new FamilyTreeBuilder(embedded.rows, embedded.sheetTags || {});
        const initialTree = builder.build();
        setTree(initialTree);
        if (embedded.url) setSheetUrl(embedded.url);
        const initialRoot = embedded.rootId || initialTree.rootId;
        const targetSelected = embedded.selectedId || initialRoot;
        if (targetSelected) {
            setFocusId(targetSelected);
            setIsSidebarVisible(false);
                            setTimeout(() => centerOnPerson(targetSelected, 0.70), 200);
        }
        appendLog(`⚡ Loaded ${embedded.rows.length} profiles directly from embedded dataset.`, 'success');
        return true; // Completely avoid fetching Google Sheets
    }

    handleImport(DEFAULT_URL);
    return false;
}

/**
 * Global CSS styling rules and webfont imports for the family tree canvas,
 * node connector lines, custom scrollbars, and AI animations.
 *
 * @returns {React.ReactElement} Style element containing global stylesheet definitions
 *
 * @example
 *   <GlobalAppStyles />
 *
 * @example
 *   // Rendered as top-level style inject in App
 *   return (
 *     <div className="flex h-screen w-screen">
 *       <GlobalAppStyles />
 *     </div>
 *   );
 */
const GlobalAppStyles = React.memo(() => (
    <>
        <link href="https://fonts.googleapis.com/css2?family=Uncial+Antiqua&display=swap" rel="stylesheet" crossOrigin="anonymous" />
        <style>{`
            .tf-tree { text-align: center; display: inline-block; white-space: nowrap; transform-origin: top center; }
            .tf-tree ul { padding-top: 24px; position: relative; display: flex; justify-content: center; margin: 0; padding-left: 0; }
            .tf-tree li { float: left; text-align: center; list-style-type: none; position: relative; padding: 0; flex-shrink: 0; margin-right: var(--partner-margin, 0px); margin-left: var(--left-partner-margin, 0px); }
            .tf-tree li::before { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #cbd5e1; width: calc(50% + var(--left-partner-margin, 0px)); height: 16px; z-index: 0; }
            .tf-tree li::after { content: ''; position: absolute; top: 0; left: calc(50% - 1px); border-top: 2px solid #cbd5e1; border-left: 2px solid #cbd5e1; width: calc(50% + var(--partner-margin, 0px) + 1px); height: 16px; z-index: 0; }
            .tf-tree li:first-child::before, .tf-tree li:last-child::after { border: 0 none; }
            .tf-tree li:first-child::after { border-radius: 12px 0 0 0; left: calc(50% - 1px); }
            .tf-tree li:last-child::before { border-right: 2px solid #cbd5e1; border-radius: 0 12px 0 0; right: calc(50% - 1px); width: calc(50% + var(--left-partner-margin, 0px) + 1px); }
            .tf-tree li:only-child::after { display: block; border-top: none; border-left: 2px solid #cbd5e1; border-radius: 0; height: 16px; left: calc(50% - 1px); }
            .tf-tree li:only-child::before { display: none; }
            .family-unit { display: inline-flex; align-items: stretch; justify-content: center; padding: 0 12px; }
            .disable-transitions, .disable-transitions * { transition: none !important; animation: none !important; }
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; margin: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
            @keyframes text-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            .animate-text-gradient { background-size: 200% auto; animation: text-gradient 3s linear infinite; }
            @keyframes ai-pulse {
                0%, 100% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                50% {
                    transform: scale(1.14);
                    box-shadow: 0 0 0 12px rgba(59, 130, 246, 0), 0 20px 25px -5px rgba(59, 130, 246, 0.35);
                }
            }
            .ai-profile-highlight {
                animation: ai-pulse 1.6s ease-in-out infinite !important;
            }
        `}</style>
    </>
));

/**
 * Hook managing asynchronous family tree data imports from remote spreadsheet URLs or system clipboard.
 * Orchestrates panel states, activity logging, camera auto-fit reset, history clearing, and root centering.
 *
 * @param {Object} params
 * @param {Function} params.setSheetUrl - Spreadsheet URL state updater
 * @param {Function} params.resetInitialFit - Callback to reset camera auto-fit state
 * @param {Function} params.setShowLogs - Activity log panel visibility dispatcher
 * @param {Function} params.setShowAI - AI Assistant panel visibility dispatcher
 * @param {Function} params.setActiveFilter - Active filter state dispatcher
 * @param {Function} params.resetNavHistory - Navigation history reset function
 * @param {Function} params.fetchFromUrl - Remote spreadsheet fetch function
 * @param {Function} params.setFocusId - Active focus person ID state updater
 * @param {Function} params.setIsSidebarVisible - Sidebar panel visibility dispatcher
 * @param {Function} params.centerOnPerson - Camera centering function
 * @returns {Function} Memoized async handler: (directUrl?: string | null) => Promise<void>
 *
 * @example
 *   const handleImport = useTreeImportHandler({
 *     setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
 *     setActiveFilter, resetNavHistory, fetchFromUrl, setFocusId,
 *     setIsSidebarVisible, centerOnPerson
 *   });
 *   handleImport('https://docs.google.com/spreadsheets/d/...');
 *
 * @example
 *   const importHandler = useTreeImportHandler({
 *     setSheetUrl: () => {}, resetInitialFit: () => {}, setShowLogs: () => {},
 *     setShowAI: () => {}, setActiveFilter: () => {}, resetNavHistory: () => {},
 *     fetchFromUrl: async () => ({ rootId: 'p1' }), setFocusId: () => {},
 *     setIsSidebarVisible: () => {}, centerOnPerson: () => {}
 *   });
 *   importHandler();
 */
/**
 * Applies UI state resets prior to fetching an imported family tree from a sheet URL.
 *
 * @param {Object} params - UI state setters
 * @param {Function} params.setSheetUrl - Sheet URL updater
 * @param {Function} params.resetInitialFit - Fit-to-screen reset callback
 * @param {Function} params.setShowLogs - Logs visibility setter
 * @param {Function} params.setShowAI - AI panel visibility setter
 * @param {Function} params.setActiveFilter - Active directory/search filter setter
 * @param {Function} params.resetNavHistory - Navigation history reset callback
 * @param {string} params.urlToLoad - Resolved Google Sheet URL to load
 *
 * @example
 * initiateImportUIState({
 *     setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
 *     setActiveFilter, resetNavHistory, urlToLoad: 'https://docs.google.com/spreadsheets/d/abc/edit'
 * });
 *
 * @example
 * initiateImportUIState({
 *     setSheetUrl: () => {}, resetInitialFit: () => {}, setShowLogs: () => {},
 *     setShowAI: () => {}, setActiveFilter: () => {}, resetNavHistory: () => {},
 *     urlToLoad: 'https://example.com/tree'
 * });
 */
function initiateImportUIState({
    setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
    setActiveFilter, resetNavHistory, urlToLoad
}) {
    setSheetUrl(urlToLoad);
    resetInitialFit();
    setShowLogs(true);
    setShowAI(false);
    setActiveFilter(null);
    resetNavHistory();
}

/**
 * Applies navigation and camera focus after a tree import successfully resolves a root node.
 *
 * @param {Object} params - Callbacks and identifiers
 * @param {string} params.newRootId - Root node identifier of the newly imported tree
 * @param {Function} params.setFocusId - Active person focus ID setter
 * @param {Function} params.setActiveFilter - Filter reset setter
 * @param {Function} params.setIsSidebarVisible - Sidebar visibility setter
 * @param {Function} params.centerOnPerson - Camera centering callback
 * @param {Function} params.setShowLogs - Logs visibility setter
 *
 * @example
 * applyImportSuccessFocus({
 *     newRootId: 'p123', setFocusId, setActiveFilter,
 *     setIsSidebarVisible, centerOnPerson, setShowLogs
 * });
 *
 * @example
 * applyImportSuccessFocus({
 *     newRootId: 'rootNode', setFocusId: () => {}, setActiveFilter: () => {},
 *     setIsSidebarVisible: () => {}, centerOnPerson: () => {}, setShowLogs: () => {}
 * });
 */
function applyImportSuccessFocus({
    newRootId, setFocusId, setActiveFilter, setIsSidebarVisible,
    centerOnPerson, setShowLogs
}) {
    clearAllFocusSelection({ setFocusId, setActiveFilter, setIsSidebarVisible });
    setTimeout(() => centerOnPerson(newRootId, 0.70), 200);
    setTimeout(() => setShowLogs(false), 1500);
}

/**
 * Hook providing a memoized asynchronous handler for importing remote spreadsheet data,
 * updating tree state, resetting navigation history, and focusing the root person.
 *
 * @param {Object} params
 * @param {Function} params.setSheetUrl - Sheet URL state dispatcher
 * @param {Function} params.resetInitialFit - Fit-to-screen reset function
 * @param {Function} params.setShowLogs - Log panel visibility dispatcher
 * @param {Function} params.setShowAI - AI assistant visibility dispatcher
 * @param {Function} params.setActiveFilter - Active filter state dispatcher
 * @param {Function} params.resetNavHistory - Navigation history reset function
 * @param {Function} params.fetchFromUrl - Remote spreadsheet fetch function
 * @param {Function} params.setFocusId - Active focus person ID state updater
 * @param {Function} params.setIsSidebarVisible - Sidebar panel visibility dispatcher
 * @param {Function} params.centerOnPerson - Camera centering function
 * @returns {Function} Memoized async handler: (directUrl?: string | null) => Promise<void>
 *
 * @example
 * const handleImport = useTreeImportHandler({
 *   setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
 *   setActiveFilter, resetNavHistory, fetchFromUrl, setFocusId,
 *   setIsSidebarVisible, centerOnPerson
 * });
 * handleImport('https://docs.google.com/spreadsheets/d/...');
 *
 * @example
 * const importHandler = useTreeImportHandler({
 *   setSheetUrl: () => {}, resetInitialFit: () => {}, setShowLogs: () => {},
 *   setShowAI: () => {}, setActiveFilter: () => {}, resetNavHistory: () => {},
 *   fetchFromUrl: async () => ({ rootId: 'p1' }), setFocusId: () => {},
 *   setIsSidebarVisible: () => {}, centerOnPerson: () => {}
 * });
 * importHandler();
 */
function useTreeImportHandler({
    setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
    setActiveFilter, resetNavHistory, fetchFromUrl,
    setFocusId, setIsSidebarVisible, centerOnPerson
}) {
    return useCallback(async (directUrl = null) => {
        const urlToLoad = await resolveImportUrl(directUrl);
        if (!urlToLoad) {
            clearAppStorage();
            window.location.reload(true);
            return;
        }

        initiateImportUIState({
            setSheetUrl, resetInitialFit, setShowLogs, setShowAI,
            setActiveFilter, resetNavHistory, urlToLoad
        });
        
        const res = await fetchFromUrl(urlToLoad);
        const newRootId = extractRootIdFromImportResponse(res);
        if (newRootId) {
            applyImportSuccessFocus({
                newRootId, setFocusId, setActiveFilter, setIsSidebarVisible,
                centerOnPerson, setShowLogs
            });
        }
    }, [setSheetUrl, resetInitialFit, setShowLogs, setShowAI, setActiveFilter, resetNavHistory, fetchFromUrl, setFocusId, setIsSidebarVisible, centerOnPerson]);
}

/**
 * Clears the active person focus, active filter, and closes the sidebar.
 *
 * @param {Object} options
 * @param {Function} options.setFocusId - State setter for focused person ID.
 * @param {Function} options.setActiveFilter - State setter for active filter.
 * @param {Function} options.setIsSidebarVisible - State setter for sidebar visibility.
 *
 * @example
 * clearAllFocusSelection({
 *   setFocusId: () => {},
 *   setActiveFilter: () => {},
 *   setIsSidebarVisible: () => {}
 * });
 *
 * @example
 * clearAllFocusSelection({ setFocusId, setActiveFilter, setIsSidebarVisible });
 */
function clearAllFocusSelection({ setFocusId, setActiveFilter, setIsSidebarVisible }) {
    setFocusId(null);
    setActiveFilter(null);
    setIsSidebarVisible(false);
}

/**
 * Conditionally re-roots the family tree if the focused person belongs to an unrendered lineage.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - Current genealogy tree model.
 * @param {string} options.id - Focused person node ID.
 * @param {Set<string>} options.visibleNodes - Currently visible node IDs.
 * @param {Function} options.clearAnchorRequest - Callback to reset scroll anchoring.
 * @param {Function} options.setTree - Tree state setter.
 *
 * @example
 * applyFocusReroot({ tree, id: 'p1', visibleNodes: new Set(['p1']), clearAnchorRequest: () => {}, setTree: () => {} });
 *
 * @example
 * applyFocusReroot({ tree, id: 'p99', visibleNodes: new Set(['p1']), clearAnchorRequest: () => {}, setTree: () => {} });
 */
function applyFocusReroot({ tree, id, visibleNodes, clearAnchorRequest, setTree }) {
    const newRoot = resolveRerootForFocusPerson(tree, id, visibleNodes);
    if (newRoot) {
        clearAnchorRequest();
        setTree(prev => new FamilyTree(prev.nodes, newRoot, prev.sheetNames));
    }
}

/**
 * Applies person focus transition: records navigation history, updates focus,
 * opens the person panel, triggers tree rerooting if needed, uncollapses ancestors, and centers the camera.
 *
 * @param {Object} options
 * @param {string} options.id - Target person ID.
 * @param {boolean} options.isHistoryNav - Whether invoked during history back/forward navigation.
 * @param {Function} options.pushPersonHistory - Callback to record person in history.
 * @param {Function} options.setFocusId - State setter for focus person ID.
 * @param {Function} options.openPersonPanel - Callback to reveal person panel.
 * @param {FamilyTree} options.tree - Family tree domain model.
 * @param {Set<string>} options.visibleNodes - Currently visible node IDs.
 * @param {Function} options.clearAnchorRequest - Callback to reset scroll anchoring.
 * @param {Function} options.setTree - State setter for family tree.
 * @param {Function} options.setCollapsedNodes - State setter for collapsed node IDs.
 * @param {Function} options.centerOnPerson - Camera centering callback.
 *
 * @example
 * applyPersonFocusTransition({
 *   id: 'p1',
 *   isHistoryNav: false,
 *   pushPersonHistory: () => {},
 *   setFocusId: () => {},
 *   openPersonPanel: () => {},
 *   tree,
 *   visibleNodes: new Set(['p1']),
 *   clearAnchorRequest: () => {},
 *   setTree: () => {},
 *   setCollapsedNodes: () => {},
 *   centerOnPerson: () => {}
 * });
 *
 * @example
 * applyPersonFocusTransition({
 *   id: 'p2',
 *   isHistoryNav: true,
 *   pushPersonHistory: () => {},
 *   setFocusId: () => {},
 *   openPersonPanel: () => {},
 *   tree,
 *   visibleNodes: new Set(),
 *   clearAnchorRequest: () => {},
 *   setTree: () => {},
 *   setCollapsedNodes: () => {},
 *   centerOnPerson: () => {}
 * });
 */
function applyPersonFocusTransition({
    id,
    isHistoryNav,
    pushPersonHistory,
    setFocusId,
    openPersonPanel,
    tree,
    visibleNodes,
    clearAnchorRequest,
    setTree,
    setCollapsedNodes,
    centerOnPerson
}) {
    if (!isHistoryNav) {
        pushPersonHistory(id);
    }
    setFocusId(id);
    openPersonPanel();
    applyFocusReroot({ tree, id, visibleNodes, clearAnchorRequest, setTree });
    setCollapsedNodes(prev => uncollapseAncestors(prev, tree, id, false));
    centerOnPerson(id);
}

/**
 * Evaluates and handles early-exit person focus cases (selection reset or re-centering already focused person).
 *
 * @param {Object} params
 * @param {string|null} params.id - Target person identifier to focus, or null to clear focus.
 * @param {string|null} params.focusId - Currently focused person identifier.
 * @param {Object|null} params.activeFilter - Current active filter state.
 * @param {Function} params.setFocusId - State setter for focused person identifier.
 * @param {Function} params.setActiveFilter - State setter for active filter.
 * @param {Function} params.setIsSidebarVisible - State setter for sidebar visibility.
 * @param {Function} params.openPersonPanel - Callback to reveal person details panel.
 * @param {Function} params.centerOnPerson - Callback to pan camera to focus person.
 * @returns {boolean} True if early focus case was handled and further transition should stop.
 *
 * @example
 * handleEarlyPersonFocus({ id: null, focusId: 'p1', activeFilter: null, setFocusId: () => {}, setActiveFilter: () => {}, setIsSidebarVisible: () => {}, openPersonPanel: () => {}, centerOnPerson: () => {} });
 * // => true
 *
 * @example
 * handleEarlyPersonFocus({ id: 'p2', focusId: 'p1', activeFilter: null, setFocusId: () => {}, setActiveFilter: () => {}, setIsSidebarVisible: () => {}, openPersonPanel: () => {}, centerOnPerson: () => {} });
 * // => false
 */
function handleEarlyPersonFocus({
    id, focusId, activeFilter, setFocusId, setActiveFilter,
    setIsSidebarVisible, openPersonPanel, centerOnPerson
}) {
    if (id === null) {
        clearAllFocusSelection({ setFocusId, setActiveFilter, setIsSidebarVisible });
        return true;
    }
    if (id === focusId && activeFilter === null) {
        openPersonPanel();
        centerOnPerson(id);
        return true;
    }
    return false;
}

/**
 * Hook providing a memoized callback to focus on a person node, coordinate sidebar panels,
 * handle navigation history, re-root the tree when needed, and pan the canvas camera.
 *
 * @param {Object} options
 * @param {string|null} options.focusId - Currently focused person node ID.
 * @param {Function} options.setFocusId - State setter for focused person ID.
 * @param {Object|null} options.activeFilter - Currently active filter descriptor, if any.
 * @param {Function} options.setActiveFilter - State setter for active filter.
 * @param {Function} options.setIsSidebarVisible - State setter for sidebar visibility.
 * @param {Function} options.openPersonPanel - Callback to switch sidebar tab to person details.
 * @param {Function} options.pushPersonHistory - Callback to record person navigation in history.
 * @param {FamilyTree} options.tree - Current genealogy tree model.
 * @param {Function} options.setTree - Tree state setter.
 * @param {Set<string>} options.visibleNodes - Set of currently visible person node IDs.
 * @param {Function} options.clearAnchorRequest - Callback to reset scroll anchoring.
 * @param {Function} options.setCollapsedNodes - State setter for collapsed node IDs.
 * @param {Function} options.clearAiHighlights - Callback to clear AI search highlights.
 * @param {Function} options.centerOnPerson - Callback to pan canvas camera to center on person.
 * @returns {Function} Callback `(id: string|null, isHistoryNav?: boolean) => void` handling person focus.
 *
 * @example
 * const handleFocus = usePersonFocusHandler({
 *   focusId: 'p1',
 *   setFocusId: () => {},
 *   activeFilter: null,
 *   setActiveFilter: () => {},
 *   setIsSidebarVisible: () => {},
 *   openPersonPanel: () => {},
 *   pushPersonHistory: () => {},
 *   tree,
 *   setTree: () => {},
 *   visibleNodes: new Set(['p1', 'p2']),
 *   clearAnchorRequest: () => {},
 *   setCollapsedNodes: () => {},
 *   clearAiHighlights: () => {},
 *   centerOnPerson: () => {}
 * });
 * handleFocus('p2');
 *
 * @example
 * const handleFocus = usePersonFocusHandler(options);
 * handleFocus(null);
 */
function usePersonFocusHandler(opts) {
    const {
        focusId, setFocusId, activeFilter, setActiveFilter, setIsSidebarVisible,
        openPersonPanel, pushPersonHistory, tree, setTree, visibleNodes,
        clearAnchorRequest, setCollapsedNodes, clearAiHighlights, centerOnPerson
    } = opts;
    return useCallback((id, isHistoryNav = false) => { 
        clearAiHighlights();
        if (handleEarlyPersonFocus({ id, focusId, activeFilter, setFocusId, setActiveFilter, setIsSidebarVisible, openPersonPanel, centerOnPerson })) {
            return;
        }
        applyPersonFocusTransition({
            id, isHistoryNav, pushPersonHistory, setFocusId, openPersonPanel,
            tree, visibleNodes, clearAnchorRequest, setTree, setCollapsedNodes, centerOnPerson
        });
    }, [focusId, activeFilter, pushPersonHistory, tree, setFocusId, visibleNodes, setTree, centerOnPerson, clearAnchorRequest, setCollapsedNodes, clearAiHighlights, openPersonPanel, setActiveFilter, setIsSidebarVisible]);
}

/**
 * Applies a navigation history record (either filter or person focus) to the application state.
 *
 * @param {Object} options
 * @param {Object} options.entry - Navigation history entry to restore
 * @param {Function} options.setActiveFilter - Active filter state setter
 * @param {Function} options.setFocusId - Focused person state setter
 * @param {Function} options.openFilterPanel - Callback to reveal filter panel
 * @param {Function} options.handleSetFocusId - Callback to focus and transition to a person
 *
 * @example
 * applyNavHistoryItem({
 *   entry: { type: 'filter', filterType: 'place', value: 'London' },
 *   setActiveFilter: () => {},
 *   setFocusId: () => {},
 *   openFilterPanel: () => {},
 *   handleSetFocusId: () => {}
 * });
 *
 * @example
 * applyNavHistoryItem({
 *   entry: { type: 'person', id: 'p_123' },
 *   setActiveFilter: () => {},
 *   setFocusId: () => {},
 *   openFilterPanel: () => {},
 *   handleSetFocusId: (id, isHist) => console.log(id, isHist)
 * });
 */
function applyNavHistoryItem({ entry, setActiveFilter, setFocusId, openFilterPanel, handleSetFocusId }) {
    if (!entry) return;
    if (entry.type === 'filter') {
        setActiveFilter({ filterType: entry.filterType, value: entry.value, tab: entry.tab });
        setFocusId(null);
        openFilterPanel();
    } else {
        const personId = resolveNavHistoryPersonId(entry);
        if (personId) {
            handleSetFocusId(personId, true);
        }
    }
}

/**
 * Hook providing callback to activate and navigate a person or category filter.
 *
 * @param {Object} params - Hook parameters
 * @param {Function} params.setActiveFilter - Setter for active filter
 * @param {Function} params.setFocusId - Setter for focus node ID
 * @param {Function} params.openFilterPanel - Function to open filter panel
 * @param {Function} params.pushFilterHistory - Function to push filter navigation history
 * @returns {Function} Callback to execute filtering
 *
 * @example
 * const handleFilterBy = useTreeFilterAction({ setActiveFilter, setFocusId, openFilterPanel, pushFilterHistory });
 * handleFilterBy('place', 'Kochi');
 *
 * @example
 * const handleFilterBy = useTreeFilterAction({ setActiveFilter, setFocusId, openFilterPanel, pushFilterHistory });
 * handleFilterBy('directory', 'India', true);
 */
function useTreeFilterAction({ setActiveFilter, setFocusId, openFilterPanel, pushFilterHistory }) {
    return useCallback((filterType, value, isHistoryNav = false) => {
        if (!filterType || !value) {
            setActiveFilter(null);
            return;
        }
        if (!isHistoryNav) {
            pushFilterHistory(filterType, value, filterType === 'directory' ? value : undefined);
        }
        setActiveFilter({ 
            filterType, 
            value,
            tab: filterType === 'directory' ? value : undefined 
        });
        setFocusId(null);
        openFilterPanel();
    }, [pushFilterHistory, openFilterPanel, setActiveFilter, setFocusId]);
}

/**
 * Hook providing back and forward stepping navigation through tree history.
 *
 * @param {Object} params - Hook parameters
 * @param {Function} params.stepHistory - Step function accepting direction and handler
 * @param {Function} params.applyNavHistoryEntry - Callback to apply a history entry
 * @returns {{ handleGoBack: Function, handleGoForward: Function }} Navigation callbacks
 *
 * @example
 * const { handleGoBack } = useTreeHistoryStepping({ stepHistory: (dir, cb) => cb({}), applyNavHistoryEntry: () => {} });
 * handleGoBack();
 *
 * @example
 * const { handleGoForward } = useTreeHistoryStepping({ stepHistory: (dir, cb) => cb({}), applyNavHistoryEntry: () => {} });
 * handleGoForward();
 */
function useTreeHistoryStepping({ stepHistory, applyNavHistoryEntry }) {
    const handleGoBack = useCallback(() => {
        stepHistory('back', applyNavHistoryEntry);
    }, [stepHistory, applyNavHistoryEntry]);

    const handleGoForward = useCallback(() => {
        stepHistory('forward', applyNavHistoryEntry);
    }, [stepHistory, applyNavHistoryEntry]);

    return { handleGoBack, handleGoForward };
}

/**
 * Custom React hook encapsulating tree navigation and history action callbacks.
 * Manages category/attribute filtering, back/forward history traversal, and panel toggles.
 *
 * @param {Object} params
 * @param {Function} params.setActiveFilter - State updater for currently applied attribute filter
 * @param {Function} params.setFocusId - State updater for currently focused person node ID
 * @param {Function} params.openFilterPanel - Function to open/maximize the filter and search sidebar
 * @param {Function} params.pushFilterHistory - Function to record a navigation history breadcrumb
 * @param {Function} params.stepHistory - Function to step backward or forward in navigation history
 * @param {Function} params.handleSetFocusId - Contextual setter callback when focus node changes
 * @returns {{ handleFilterBy: Function, handleGoBack: Function, handleGoForward: Function }}
 *
 * @example
 * const { handleFilterBy } = useTreeNavigationActions({
 *   setActiveFilter,
 *   setFocusId,
 *   openFilterPanel,
 *   pushFilterHistory,
 *   stepHistory,
 *   handleSetFocusId
 * });
 * handleFilterBy('place', 'Chicago');
 *
 * @example
 * const { handleGoBack, handleGoForward } = useTreeNavigationActions({
 *   setActiveFilter: () => {},
 *   setFocusId: () => {},
 *   openFilterPanel: () => {},
 *   pushFilterHistory: () => {},
 *   stepHistory: (dir, cb) => cb({ type: 'filter', filterType: 'place', value: 'Kochi' }),
 *   handleSetFocusId: () => {}
 * });
 * handleGoBack();
 */
function useTreeNavigationActions({
    setActiveFilter, setFocusId, openFilterPanel,
    pushFilterHistory, stepHistory, handleSetFocusId
}) {
    const handleFilterBy = useTreeFilterAction({ setActiveFilter, setFocusId, openFilterPanel, pushFilterHistory });

    const applyNavHistoryEntry = useCallback((entry) => {
        applyNavHistoryItem({ entry, setActiveFilter, setFocusId, openFilterPanel, handleSetFocusId });
    }, [openFilterPanel, setActiveFilter, setFocusId, handleSetFocusId]);

    const { handleGoBack, handleGoForward } = useTreeHistoryStepping({ stepHistory, applyNavHistoryEntry });

    return { handleFilterBy, handleGoBack, handleGoForward };
}

/**
 * Hook providing callback to handle profiles returned in AI assistant responses.
 * Triggers visual card highlights, switches off map view, switches tree root if needed,
 * uncollapses ancestors to reveal mentioned cards, and frames them in the viewport.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {function} params.setTree - Tree model state updater
 * @param {function} params.triggerAiHighlights - Callback to highlight profile IDs
 * @param {function} params.setShowMap - Map view visibility setter
 * @param {function} params.setCollapsedNodes - Collapsed nodes state updater
 * @param {function} params.framePeople - Canvas viewport framing function for person IDs
 * @returns {function(string[]): void} Memoized handler for AI responded profile IDs
 *
 * @example
 * const handleAiProfilesResponded = useAiProfilesResponseHandler({
 *   tree,
 *   setTree,
 *   triggerAiHighlights,
 *   setShowMap,
 *   setCollapsedNodes,
 *   framePeople
 * });
 * handleAiProfilesResponded(['p1', 'p2']);
 *
 * @example
 * const handler = useAiProfilesResponseHandler({
 *   tree: null,
 *   setTree: () => {},
 *   triggerAiHighlights: () => {},
 *   setShowMap: () => {},
 *   setCollapsedNodes: () => {},
 *   framePeople: () => {}
 * });
 * handler([]);
 */
function useAiProfilesResponseHandler({
    tree,
    setTree,
    triggerAiHighlights,
    setShowMap,
    setCollapsedNodes,
    framePeople
}) {
    return useCallback((ids) => {
        if (!ids || ids.length === 0) return;
        
        triggerAiHighlights(ids);
        setShowMap(false);

        // Check if any mentioned person is outside the current tree root
        const newRoot = findAiMentionedTreeRoot(tree, ids);
        if (newRoot) {
            setTree(prev => new FamilyTree(prev.nodes, newRoot, prev.sheetNames));
        }

        // Uncollapse ancestors and target nodes for all mentioned profiles so cards are rendered
        setCollapsedNodes(prev => uncollapseAncestors(prev, tree, ids, true));

        // Frame all mentioned profiles comfortably in the tree viewport
        framePeople(ids);
    }, [tree, framePeople, setTree, triggerAiHighlights, setShowMap, setCollapsedNodes]);
}

/**
 * Hook coordinating canvas pan/zoom viewport controls, subtree collapse anchoring, and fit-to-screen actions.
 *
 * @param {Object} options
 * @param {Function} options.closeAllPanels - Callback to dismiss all active overlay drawers and sidebars.
 * @param {Object} options.treeStats - Computed min/max years and root birth year stats for the tree.
 * @param {boolean} options.isAnySidebarOpen - Whether any details or utility sidebar is currently expanded.
 * @param {number} options.sidebarWidth - Width in pixels of the active sidebar.
 * @param {string|null} options.rootId - Root person identifier of the current tree model.
 * @param {string|null} options.focusId - Currently focused person identifier.
 * @returns {{
 *   camera: Object,
 *   setCamera: Function,
 *   clampCamera: Function,
 *   isDragging: boolean,
 *   containerRef: React.RefObject,
 *   treeRef: React.RefObject,
 *   handlePointerDown: Function,
 *   handlePointerMove: Function,
 *   handlePointerUp: Function,
 *   handleWheel: Function,
 *   centerOnPerson: Function,
 *   framePeople: Function,
 *   fitToScreen: Function,
 *   getPpy: Function,
 *   collapsedNodes: Set<string>,
 *   setCollapsedNodes: Function,
 *   isShifting: boolean,
 *   setIsShifting: Function,
 *   toggleCollapse: Function,
 *   clearAnchorRequest: Function,
 *   handleFitToScreen: Function
 * }} Coordinated canvas navigation, viewport controls, and collapse states.
 *
 * @example
 *   const canvas = useAppCanvasViewportManager({
 *     closeAllPanels: () => {},
 *     treeStats: { rootNodeYob: 1900 },
 *     isAnySidebarOpen: false,
 *     sidebarWidth: 360,
 *     rootId: 'p1',
 *     focusId: null
 *   });
 *
 * @example
 *   const { camera, containerRef, toggleCollapse } = useAppCanvasViewportManager({
 *     closeAllPanels: handleClose,
 *     treeStats,
 *     isAnySidebarOpen,
 *     sidebarWidth,
 *     rootId: tree.rootId,
 *     focusId
 *   });
 */
function useAppCanvasViewportManager({
    closeAllPanels, treeStats, isAnySidebarOpen, sidebarWidth, rootId, focusId
}) {
    const handleInteract = useCallback(() => {
        closeAllPanels();
    }, [closeAllPanels]);

    const canvas = useCanvasControls(handleInteract, treeStats, isAnySidebarOpen, sidebarWidth);

    const collapse = useSubtreeCollapseAnchor({
        treeRef: canvas.treeRef,
        setCamera: canvas.setCamera,
        centerOnPerson: canvas.centerOnPerson,
        rootId,
        focusId
    });

    const handleFitToScreen = useCallback(() => {
        closeAllPanels();
        canvas.fitToScreen(true);
    }, [closeAllPanels, canvas.fitToScreen]);

    return {
        ...canvas,
        ...collapse,
        handleFitToScreen
    };
}

/**
 * Hook coordinating AI assistant loading state, highlighted card IDs, and response profile handling.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - Family tree domain model instance.
 * @param {Function} options.setTree - State setter for family tree.
 * @param {Function} options.setShowMap - State setter for map display.
 * @param {Function} options.setCollapsedNodes - State setter for collapsed node set.
 * @param {Function} options.framePeople - Canvas camera framing callback.
 * @returns {{
 *   isAILoading: boolean,
 *   setIsAILoading: Function,
 *   aiHighlightedIds: Set<string>,
 *   clearAiHighlights: Function,
 *   handleAiProfilesResponded: Function
 * }} Coordinated AI assistant states and response handler.
 *
 * @example
 *   const ai = useAppAiCoordinator({
 *     tree: mockTree,
 *     setTree: () => {},
 *     setShowMap: () => {},
 *     setCollapsedNodes: () => {},
 *     framePeople: () => {}
 *   });
 *
 * @example
 *   const { isAILoading, handleAiProfilesResponded } = useAppAiCoordinator({
 *     tree,
 *     setTree,
 *     setShowMap,
 *     setCollapsedNodes,
 *     framePeople
 *   });
 */
function useAppAiCoordinator({
    tree,
    setTree,
    setShowMap,
    setCollapsedNodes,
    framePeople
}) {
    const [isAILoading, setIsAILoading] = useState(false);
    const { aiHighlightedIds, triggerAiHighlights, clearAiHighlights } = useAiProfileHighlights();

    const handleAiProfilesResponded = useAiProfilesResponseHandler({
        tree,
        setTree,
        triggerAiHighlights,
        setShowMap,
        setCollapsedNodes,
        framePeople
    });

    return {
        isAILoading,
        setIsAILoading,
        aiHighlightedIds,
        clearAiHighlights,
        handleAiProfilesResponded
    };
}

/**
 * Custom hook to compute and memoize tree layout configuration, filtering highlights, and node interactivity bindings.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Active family tree model
 * @param {object|null} params.activeFilter - Active filter criteria
 * @param {string|null} params.focusId - Currently focused person ID
 * @param {Set<string>|Array<string>} params.aiHighlightedIds - Profiles highlighted by AI query
 * @param {number} params.rootNodeYob - Tree root node birth year for timeline calculations
 * @param {Set<string>} params.visibleNodes - Currently uncollapsed visible node IDs
 * @param {Set<string>} params.collapsedNodes - Currently collapsed node IDs
 * @param {function} params.toggleCollapse - Callback to toggle node collapse state
 * @param {number} params.ppy - Pixels per year scale factor
 * @param {number} params.siblingGap - Dynamic horizontal spacing between sibling cards
 * @param {function} params.handleSetFocusId - Handler to set focused person ID
 * @returns {object} Layout configuration object passed to CompactTreeView and export handlers
 *
 * @example
 * const layoutConfig = useTreeLayoutConfig({
 *   tree,
 *   activeFilter,
 *   focusId,
 *   aiHighlightedIds,
 *   rootNodeYob: 1950,
 *   visibleNodes: new Set(['p1']),
 *   collapsedNodes: new Set(),
 *   toggleCollapse: () => {},
 *   ppy: 2.0,
 *   siblingGap: 24,
 *   handleSetFocusId: () => {}
 * });
 *
 * @example
 * const config = useTreeLayoutConfig({
 *   tree: null,
 *   activeFilter: null,
 *   focusId: null,
 *   aiHighlightedIds: [],
 *   rootNodeYob: 1900,
 *   visibleNodes: new Set(),
 *   collapsedNodes: new Set(),
 *   toggleCollapse: () => {},
 *   ppy: 1.0,
 *   siblingGap: 16,
 *   handleSetFocusId: () => {}
 * });
 */
function useTreeLayoutConfig({
    tree, activeFilter, focusId, aiHighlightedIds, rootNodeYob,
    visibleNodes, collapsedNodes, toggleCollapse, ppy, siblingGap, handleSetFocusId
}) {
    const filterHighlightedIds = useMemo(() => (
        FamilyTreeBuilder.computeFilterHighlightedIds(tree, activeFilter)
    ), [tree, activeFilter]);

    const filterHighlightClass = useMemo(() => (
        getFilterHighlightClass(activeFilter)
    ), [activeFilter]);

    return useMemo(() => ({
        focusId, aiHighlightedIds, filterHighlightedIds, filterHighlightClass,
        rootNodeYob, visibleNodes, collapsedNodes, toggleCollapse,
        ppy, siblingGap, onFocus: handleSetFocusId
    }), [focusId, aiHighlightedIds, filterHighlightedIds, filterHighlightClass, rootNodeYob, visibleNodes, collapsedNodes, toggleCollapse, ppy, siblingGap, handleSetFocusId]);
}

/**
 * Hook managing OmniSearchBar search query, selection index, and pending AI query state.
 *
 * @param {function} openAiPanel - Callback to open the AI assistant drawer/panel
 * @returns {{
 *   searchQuery: string,
 *   setSearchQuery: function(string): void,
 *   pendingAiQuery: string|null,
 *   setPendingAiQuery: function(string|null): void,
 *   omniSelectedIndex: number|null,
 *   setOmniSelectedIndex: function(number|null): void,
 *   handleAiSubmitQuery: function(string): void
 * }}
 *
 * @example
 * const {
 *   searchQuery, setSearchQuery,
 *   pendingAiQuery, setPendingAiQuery,
 *   omniSelectedIndex, setOmniSelectedIndex,
 *   handleAiSubmitQuery
 * } = useTreeSearchState(openAiPanel);
 * handleAiSubmitQuery('Who is John?');
 *
 * @example
 * const searchState = useTreeSearchState(() => {});
 * searchState.setSearchQuery('Mary');
 */
function useTreeSearchState(openAiPanel) {
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingAiQuery, setPendingAiQuery] = useState(null);
    const [omniSelectedIndex, setOmniSelectedIndex] = useState(null);

    const handleAiSubmitQuery = useCallback((queryText) => {
        if (!queryText || !queryText.trim()) return;
        setPendingAiQuery(queryText.trim());
        openAiPanel();
    }, [openAiPanel]);

    return {
        searchQuery,
        setSearchQuery,
        pendingAiQuery,
        setPendingAiQuery,
        omniSelectedIndex,
        setOmniSelectedIndex,
        handleAiSubmitQuery
    };
}

/**
 * Renders the tree canvas content including timeline labels, year grid, and interactive tree nodes.
 *
 * @param {object} props
 * @param {FamilyTree} props.tree - Populated family tree model
 * @param {boolean} props.isStandalone - Whether running in standalone export mode
 * @param {number[]} props.dynamicYears - Generation cohort year values
 * @param {object} props.treeStats - Tree generational statistics (rootNodeYob, maxYear)
 * @param {{ x: number, y: number, z: number }} props.camera - Viewport camera transform
 * @param {number} props.ppy - Pixels per year scale factor
 * @param {boolean} props.isDragging - Whether viewport is being dragged
 * @param {boolean} props.isShifting - Whether camera shift transition is active
 * @param {React.RefObject} props.treeRef - Ref to inner tree container element
 * @param {object} props.layoutConfig - Subtree layout configuration
 * @param {boolean} props.isLoading - Whether tree is currently loading/building
 * @returns {React.ReactNode}
 *
 * @example
 * <TreeCanvasContent
 *   tree={tree}
 *   isStandalone={false}
 *   dynamicYears={[1900, 1920, 1940]}
 *   treeStats={{ rootNodeYob: 1900, maxYear: 2020 }}
 *   camera={{ x: 0, y: 0, z: 1 }}
 *   ppy={1.5}
 *   isDragging={false}
 *   isShifting={false}
 *   treeRef={treeRef}
 *   layoutConfig={layoutConfig}
 *   isLoading={false}
 * />
 *
 * @example
 * <TreeCanvasContent
 *   tree={{ rootId: null }}
 *   isStandalone={true}
 *   dynamicYears={[]}
 *   treeStats={null}
 *   camera={{ x: 0, y: 0, z: 1 }}
 *   ppy={1}
 *   isDragging={false}
 *   isShifting={false}
 *   treeRef={{ current: null }}
 *   layoutConfig={{}}
 *   isLoading={true}
 * />
 */
const TreeCanvasContent = ({
    tree, isStandalone, dynamicYears, treeStats, camera, ppy,
    isDragging, isShifting, treeRef, layoutConfig, isLoading
}) => {
    if (!tree?.rootId || !tree?.root) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-400 relative z-10 pointer-events-none font-sans">
                {isLoading ? "Fetching and building tree..." : "Import data to view the family tree."}
            </div>
        );
    }

    return (
        <>
            {!isStandalone && <TimelineLabels dynamicYears={dynamicYears} rootNodeYob={treeStats.rootNodeYob} maxYear={treeStats.maxYear} camera={camera} ppy={ppy} />}
            <TimelineGrid dynamicYears={dynamicYears} rootNodeYob={treeStats.rootNodeYob} camera={camera} ppy={ppy} isStandalone={isStandalone} />
            <div className={`absolute top-0 left-0 w-full h-full ${isDragging || isShifting ? '' : 'transition-transform duration-300 ease-out'} z-10`} style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`, transformOrigin: '0 0' }}>
                <div className={`min-w-max min-h-max relative inline-block ${isShifting ? 'disable-transitions' : ''}`} ref={treeRef}>
                    <CompactTreeView tree={tree} layout={layoutConfig} />
                </div>
            </div>
        </>
    );
};

/**
 * Main interactive canvas viewport container.
 * Hosts the pannable/zoomable tree container or the geographic family map view based on mode,
 * binding pointer and wheel drag interactions.
 *
 * @param {object} props - Component properties.
 * @param {React.RefObject} props.containerRef - Ref for the outer viewport DOM element.
 * @param {boolean} props.showMap - Whether geographic map view is active instead of tree canvas.
 * @param {boolean} props.isDragging - Whether viewport panning is currently active.
 * @param {Function} props.handlePointerDown - Pointer down event handler.
 * @param {Function} props.handlePointerMove - Pointer move event handler.
 * @param {Function} props.handlePointerUp - Pointer up/leave/cancel event handler.
 * @param {Function} props.handleWheel - Mouse wheel zoom event handler.
 * @param {object} props.tree - Family tree data model.
 * @param {object|null} props.activeFilter - Currently active filter criterion.
 * @param {Function} props.handleFilterBy - Filter selection callback.
 * @param {Function} props.handleExportMapCSV - Map CSV export callback.
 * @param {Function} props.setShowMap - Callback to toggle/set map view display.
 * @param {number} props.sidebarWidth - Width of the right details sidebar in pixels.
 * @param {boolean} props.isAnySidebarOpen - Whether any sidebar panel is currently visible.
 * @param {boolean} props.isStandalone - Whether app is running in offline standalone mode.
 * @param {Array<number>} props.dynamicYears - List of grid year numbers to display on timeline.
 * @param {object} props.treeStats - Tree chronological bounds and metrics.
 * @param {object} props.camera - Current canvas camera position and scale {x, y, z}.
 * @param {number} props.ppy - Pixels per year scale factor.
 * @param {boolean} props.isShifting - Whether camera shift transition is active.
 * @param {React.RefObject} props.treeRef - Ref to inner tree container element.
 * @param {object} props.layoutConfig - Subtree layout configuration.
 * @param {boolean} props.isLoading - Whether tree data is actively loading.
 * @returns {React.ReactElement}
 *
 * @example
 *   <MainCanvasViewport
 *     containerRef={containerRef}
 *     showMap={false}
 *     isDragging={false}
 *     handlePointerDown={onDown}
 *     handlePointerMove={onMove}
 *     handlePointerUp={onUp}
 *     handleWheel={onWheel}
 *     tree={tree}
 *     activeFilter={null}
 *     handleFilterBy={() => {}}
 *     handleExportMapCSV={() => {}}
 *     setShowMap={() => {}}
 *     sidebarWidth={420}
 *     isAnySidebarOpen={true}
 *     isStandalone={false}
 *     dynamicYears={[1900, 1950, 2000]}
 *     treeStats={{ rootNodeYob: 1900, maxYear: 2024 }}
 *     camera={{ x: 0, y: 0, z: 1 }}
 *     ppy={1.5}
 *     isShifting={false}
 *     treeRef={treeRef}
 *     layoutConfig={{}}
 *     isLoading={false}
 *   />
 *
 * @example
 *   <MainCanvasViewport
 *     containerRef={{ current: null }}
 *     showMap={true}
 *     isDragging={false}
 *     handlePointerDown={() => {}}
 *     handlePointerMove={() => {}}
 *     handlePointerUp={() => {}}
 *     handleWheel={() => {}}
 *     tree={{ rootId: null }}
 *     activeFilter={{ type: 'job', value: 'Engineer' }}
 *     handleFilterBy={() => {}}
 *     handleExportMapCSV={() => {}}
 *     setShowMap={() => {}}
 *     sidebarWidth={360}
 *     isAnySidebarOpen={false}
 *     isStandalone={true}
 *     dynamicYears={[]}
 *     treeStats={{}}
 *     camera={{ x: 100, y: 50, z: 1.2 }}
 *     ppy={2}
 *     isShifting={false}
 *     treeRef={{ current: null }}
 *     layoutConfig={{}}
 *     isLoading={false}
 *   />
 */
/**
 * Renders the full-screen map overlay in the main viewport when map mode is active.
 *
 * @param {object} props
 * @param {boolean} props.showMap - Whether map view is active
 * @param {FamilyTree} props.tree - Family tree instance
 * @param {object|null} props.activeFilter - Current directory/search filter
 * @param {Function} props.handleFilterBy - Filter selection handler
 * @param {Function} props.handleExportMapCSV - CSV export handler
 * @param {Function} props.setShowMap - Map visibility toggle
 * @param {number} props.sidebarWidth - Width of open sidebar in pixels
 * @param {boolean} props.isAnySidebarOpen - Whether any sidebar is open
 * @returns {React.ReactNode}
 *
 * @example
 * <MainCanvasMapOverlay
 *   showMap={true}
 *   tree={treeData}
 *   activeFilter={null}
 *   handleFilterBy={() => {}}
 *   handleExportMapCSV={() => {}}
 *   setShowMap={() => {}}
 *   sidebarWidth={360}
 *   isAnySidebarOpen={false}
 * />
 *
 * @example
 * <MainCanvasMapOverlay
 *   showMap={false}
 *   tree={treeData}
 *   activeFilter={{ type: 'place', value: 'Kerala' }}
 *   handleFilterBy={() => {}}
 *   handleExportMapCSV={() => {}}
 *   setShowMap={() => {}}
 *   sidebarWidth={400}
 *   isAnySidebarOpen={true}
 * />
 */
const MainCanvasMapOverlay = ({
    showMap, tree, activeFilter, handleFilterBy, handleExportMapCSV, setShowMap, sidebarWidth, isAnySidebarOpen
}) => (
    <div className={showMap ? "absolute inset-0 z-10 w-full h-full bg-slate-100 flex overflow-hidden" : "hidden"}>
        <FamilyMapView 
            tree={tree} 
            activeFilter={activeFilter} 
            onFilterBy={handleFilterBy} 
            onExportCSV={handleExportMapCSV} 
            onSwitchToTree={() => setShowMap(false)}
            sidebarWidth={sidebarWidth}
            isSidebarVisible={isAnySidebarOpen}
            showMap={showMap}
        />
    </div>
);

/**
 * Viewport container component for the interactive tree canvas and map overlay.
 *
 * @param {object} props - Component properties for canvas interaction, tree data, and viewport state
 * @returns {React.ReactNode} The rendered viewport container.
 *
 * @example
 * <MainCanvasViewport
 *   containerRef={{ current: null }}
 *   showMap={false}
 *   isDragging={false}
 *   handlePointerDown={() => {}}
 *   handlePointerMove={() => {}}
 *   handlePointerUp={() => {}}
 *   handleWheel={() => {}}
 *   tree={treeData}
 *   activeFilter={null}
 *   handleFilterBy={() => {}}
 *   handleExportMapCSV={() => {}}
 *   setShowMap={() => {}}
 *   sidebarWidth={360}
 *   isAnySidebarOpen={false}
 *   isStandalone={false}
 *   dynamicYears={[]}
 *   treeStats={{}}
 *   camera={{ x: 0, y: 0, z: 1 }}
 *   ppy={2}
 *   isShifting={false}
 *   treeRef={{ current: null }}
 *   layoutConfig={{}}
 *   isLoading={false}
 * />
 *
 * @example
 * <MainCanvasViewport {...viewportProps} />
 */
const MainCanvasViewport = (props) => {
    const {
        containerRef, showMap, isDragging, handlePointerDown, handlePointerMove,
        handlePointerUp, handleWheel, tree, activeFilter, handleFilterBy,
        handleExportMapCSV, setShowMap, sidebarWidth, isAnySidebarOpen,
        isStandalone, dynamicYears, treeStats, camera, ppy, isShifting,
        treeRef, layoutConfig, isLoading
    } = props;
    const mapOverlayProps = { showMap, tree, activeFilter, handleFilterBy, handleExportMapCSV, setShowMap, sidebarWidth, isAnySidebarOpen };
    const canvasContentProps = { tree, isStandalone, dynamicYears, treeStats, camera, ppy, isDragging, isShifting, treeRef, layoutConfig, isLoading };

    return (
        <div 
            ref={containerRef} className="flex-1 relative overflow-hidden bg-white select-none" 
            style={{ cursor: showMap ? 'default' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}
            onPointerDown={showMap ? undefined : handlePointerDown} 
            onPointerMove={showMap ? undefined : handlePointerMove} 
            onPointerUp={showMap ? undefined : handlePointerUp} 
            onPointerLeave={showMap ? undefined : handlePointerUp} 
            onPointerCancel={showMap ? undefined : handlePointerUp} 
            onWheel={showMap ? undefined : handleWheel}
        >
            <MainCanvasMapOverlay {...mapOverlayProps} />
            <div className={!showMap ? "w-full h-full relative" : "hidden"}>
                <TreeCanvasContent {...canvasContentProps} />
            </div>
        </div>
    );
};

/**
 * Computes viewport visual metrics, timeline dynamic years, and visible nodes for canvas rendering.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Family tree domain model
 * @param {Set<string>} params.collapsedNodes - Set of collapsed node IDs
 * @param {object} params.camera - Camera state object containing zoom { z }
 * @param {Function} params.getPpy - Function returning pixels-per-year for a zoom level
 * @param {object} params.treeStats - Min and max year statistics
 * @returns {{
 *   ppy: number,
 *   siblingGap: number,
 *   visibleNodes: Set<string>,
 *   dynamicYears: Array<{ year: number, y: number }>
 * }}
 *
 * @example
 * const metrics = useTreeCanvasMetrics({ tree, collapsedNodes: new Set(), camera: { z: 1 }, getPpy: () => 20, treeStats: { minYear: 1900, maxYear: 2000 } });
 *
 * @example
 * const metrics = useTreeCanvasMetrics({ tree: emptyTree, collapsedNodes: new Set(), camera: { z: 0.5 }, getPpy: () => 10, treeStats: null });
 */
function useTreeCanvasMetrics({ tree, collapsedNodes, camera, getPpy, treeStats }) {
    const ppy = getPpy(camera.z);
    const siblingGap = useMemo(() => calculateSiblingGap(camera.z), [camera.z]);
    const visibleNodes = useMemo(() => tree.getVisibleNodes(collapsedNodes), [tree, collapsedNodes]);
    const dynamicYears = useMemo(() => {
        return calculateDynamicTimelineYears(treeStats?.minYear, treeStats?.maxYear, camera.z);
    }, [treeStats?.minYear, treeStats?.maxYear, camera.z]);

    return { ppy, siblingGap, visibleNodes, dynamicYears };
}

/**
 * Hook to bootstrap and initialize tree dataset on initial application mount.
 *
 * @param {object} params
 * @param {Function} params.setTree - Tree state setter
 * @param {Function} params.setSheetUrl - Sheet URL state setter
 * @param {Function} params.setFocusId - Focus ID state setter
 * @param {Function} params.setIsSidebarVisible - Sidebar visibility setter
 * @param {Function} params.centerOnPerson - Camera centering function
 * @param {Function} params.appendLog - Append log callback
 * @param {Function} params.handleImport - Spreadsheet import handler
 *
 * @example
 * useTreeDatasetBootstrap({ setTree, setSheetUrl, setFocusId, setIsSidebarVisible, centerOnPerson, appendLog, handleImport });
 *
 * @example
 * useTreeDatasetBootstrap({ setTree: () => {}, setSheetUrl: () => {}, setFocusId: () => {}, setIsSidebarVisible: () => {}, centerOnPerson: () => {}, appendLog: () => {}, handleImport: () => {} });
 */
function useTreeDatasetBootstrap({
    setTree,
    setSheetUrl,
    setFocusId,
    setIsSidebarVisible,
    centerOnPerson,
    appendLog,
    handleImport
}) {
    const hasInitialLoaded = useRef(false);

    useEffect(() => {
        if (!hasInitialLoaded.current) {
            hasInitialLoaded.current = true;
            initializeTreeDataset({
                setTree,
                setSheetUrl,
                setFocusId,
                setIsSidebarVisible,
                centerOnPerson,
                appendLog,
                handleImport
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
