// ============================================================================
// MODULE 2: UTILITY CLASSES (Data Loading & Parsing)
// ============================================================================

/**
 * DOM id of the JSON payload embedded in exported standalone `.html` trees.
 *
 * Written by `FamilyTreeBuilder` when it serializes a self-contained export;
 * its presence at runtime is what distinguishes a downloaded standalone file
 * from the live, sheet-backed app.
 */
const STANDALONE_DATA_ELEMENT_ID = 'embedded-tree-data';

/**
 * Detects whether the app is running from an exported standalone HTML file.
 *
 * Standalone exports ship their data inline and have no live spreadsheet to
 * poll, so callers use this to drop chrome that only makes sense in the live
 * app (the timeline gutter, background re-sync, import controls).
 *
 * @returns {boolean} True when running inside a standalone export
 *
 * @example
 * isStandaloneExportMode();
 * // => false (live app served from index.html; no embedded payload)
 *
 * @example
 * isStandaloneExportMode();
 * // => true (downloaded Kochuvareed_Tree.html; payload script present)
 */
function isStandaloneExportMode() {
    return typeof document !== 'undefined' && !!document.getElementById(STANDALONE_DATA_ELEMENT_ID);
}

/**
 * Asynchronous external script loader that injects script tags into the document head
 * and resolves once loaded, preventing duplicate script injection.
 *
 * @example
 * await ScriptLoader.load('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js');
 *
 * @example
 * await ScriptLoader.load('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
 */
class ScriptLoader {
    /**
     * Loads an external JavaScript library URL asynchronously.
     *
     * @param {string} src - URL of the script to load
     * @returns {Promise<void>} Resolves when script is loaded or already present
     *
     * @example
     * await ScriptLoader.load('/path/to/lib.js');
     *
     * @example
     * await ScriptLoader.load('https://cdn.jsdelivr.net/npm/chart.js');
     */
    static load(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

/**
 * Robust CSV parsing and tabular record extraction engine for Google Sheets genealogical exports.
 *
 * Handles quote escaping, multi-line cells, embedded first data rows merged into headers,
 * whitespace sanitization, and 1-based spreadsheet row number tracking.
 *
 * @example
 * const records = CSVParser.parse('Name,Age\nAlice,30\nBob,25');
 * // => [{ name: 'Alice', age: '30', _sheetRow: 2 }, { name: 'Bob', age: '25', _sheetRow: 3 }]
 *
 * @example
 * const rows = CSVParser._tokenizeCsv('A,B\nC,D');
 * // => [{ data: ['A', 'B'], sheetRow: 1 }, { data: ['C', 'D'], sheetRow: 2 }]
 */