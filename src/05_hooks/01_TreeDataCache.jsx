// ============================================================================
// MODULE 5: CUSTOM HOOKS & DATA ENGINE (Parallel Fetching & Caching)
// ============================================================================

/**
 * Client-side persistence cache for spreadsheet data to enable instant (<50ms) initial render.
 *
 * @example
 * TreeDataCache.set('https://docs.google.com/...', rows, sheetTags);
 * const cached = TreeDataCache.get('https://docs.google.com/...');
 *
 * @example
 * TreeDataCache.clear('https://docs.google.com/...');
 */
const TreeDataCache = {
    CACHE_PREFIX: 'ft_cache_v61_',

    /**
     * Generates a namespaced cache key for the provided spreadsheet URL.
     *
     * @param {string} [url] - Spreadsheet URL
     * @returns {string} Prefixed cache storage key
     *
     * @example
     * const key = TreeDataCache.getKey('https://docs.google.com/spreadsheets/d/123');
     *
     * @example
     * const emptyKey = TreeDataCache.getKey();
     */
    getKey(url) {
        return `${this.CACHE_PREFIX}${(url || '').trim()}`;
    },

    /**
     * Attempts to read embedded tree dataset from the document script tag.
     *
     * @param {string} [url] - Target sheet URL to match against embedded payload
     * @returns {Object|null} Embedded tree data object or null if not available
     *
     * @example
     * TreeDataCache._getEmbeddedTreeData('https://example.com')
     * // => { url: 'https://example.com', rows: [...] }
     *
     * @example
     * TreeDataCache._getEmbeddedTreeData('mismatched-url')
     * // => null
     */
    _getEmbeddedTreeData(url) {
        if (typeof document === 'undefined') return null;
        try {
            const embeddedElem = document.getElementById('embedded-tree-data');
            if (embeddedElem && embeddedElem.textContent.trim()) {
                const embeddedData = JSON.parse(embeddedElem.textContent);
                if (embeddedData && Array.isArray(embeddedData.rows) && embeddedData.rows.length > 0) {
                    if (!url || embeddedData.url === url || !embeddedData.url) {
                        return embeddedData;
                    }
                }
            }
        } catch (e) {}
        return null;
    },

    /**
     * Reads and parses cached tree data from browser localStorage.
     *
     * @param {string} key - Cache lookup key
     * @returns {Object|null} Cached tree dataset or null if missing or invalid
     *
     * @example
     * TreeDataCache._getLocalStorageTreeData('ft_cache_v61_sheet1')
     * // => { rows: [...], sheetTags: {...}, timestamp: 1672531199000 }
     *
     * @example
     * TreeDataCache._getLocalStorageTreeData('invalid_key')
     * // => null
     */
    _getLocalStorageTreeData(key) {
        if (typeof localStorage === 'undefined') return null;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.rows) && data.rows.length > 0) {
                return data;
            }
        } catch (e) {
            console.log("Cache read error:", e);
        }
        return null;
    },

    /**
     * Retrieves cached tree dataset for a URL from embedded script tag or localStorage.
     *
     * @param {string} [url] - Target sheet URL
     * @returns {Object|null} Cached tree dataset or null if not found
     *
     * @example
     * const data = TreeDataCache.get('https://docs.google.com/spreadsheets/d/123');
     *
     * @example
     * const fallbackData = TreeDataCache.get();
     */
    get(url) {
        const embedded = this._getEmbeddedTreeData(url);
        if (embedded) return embedded;
        return this._getLocalStorageTreeData(this.getKey(url));
    },

    /**
     * Serializes and writes tree dataset into localStorage under the given URL key.
     *
     * @param {string} url - Target sheet URL
     * @param {Array<Object>} rows - Parsed genealogical rows
     * @param {Object} sheetTags - Mapping of sheet IDs to tags/names
     * @returns {void}
     *
     * @example
     * TreeDataCache.set('https://docs.google.com/spreadsheets/d/123', rawRows, { '123': 'Main' });
     *
     * @example
     * TreeDataCache.set(sheetUrl, parsedData, tags);
     */
    set(url, rows, sheetTags) {
        try {
            const data = { rows, sheetTags, timestamp: Date.now() };
            localStorage.setItem(this.getKey(url), JSON.stringify(data));
        } catch (e) {
            console.log("Cache write error:", e);
        }
    },

    /**
     * Clears cached tree datasets for a specific URL or purges all family tree cache entries.
     *
     * @param {string} [url] - Specific sheet URL to purge; if omitted, clears all ft_cache_ entries
     * @returns {void}
     *
     * @example
     * TreeDataCache.clear('https://docs.google.com/spreadsheets/d/123');
     *
     * @example
     * TreeDataCache.clear();
     */
    clear(url) {
        try {
            if (url) {
                localStorage.removeItem(this.getKey(url));
            } else {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('ft_cache_')) localStorage.removeItem(k);
                });
            }
        } catch (e) {}
    }
};

/**
 * Constructs the Google Spreadsheet CSV export URL for direct downloads or named tabs.
 *
 * @param {string} sheetId - Google Spreadsheet document identifier.
 * @param {string} sheetName - Optional named sheet tab (e.g. 'Links').
 * @param {boolean} bypassCache - Whether to append cache-busting timestamp parameter.
 * @returns {string} Fully qualified export URL.
 *
 * @example
 * buildGoogleSheetCsvUrl('1AbC', '', false)
 * // => 'https://docs.google.com/spreadsheets/d/1AbC/export?format=csv'
 *
 * @example
 * buildGoogleSheetCsvUrl('1AbC', 'Links', false)
 * // => 'https://docs.google.com/spreadsheets/d/1AbC/gviz/tq?tqx=out:csv&sheet=Links'
 */
const buildGoogleSheetCsvUrl = (sheetId, sheetName = '', bypassCache = false) => {
    let url = sheetName
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
        : `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    if (bypassCache) url += `${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
    return url;
};

/**
 * Attempts a fallback fetch using the Google Visualization Query endpoint if direct export fails or returns HTML.
 *
 * @param {string} sheetId - Google Spreadsheet document identifier.
 * @param {boolean} [bypassCache=false] - Whether to append cache-busting parameters.
 * @param {number} [timeoutMs=8000] - Request timeout in milliseconds.
 * @returns {Promise<string|null>} CSV text content if valid, otherwise null.
 *
 * @example
 * await fetchFallbackGvizCsv('1AbC', false, 8000);
 * // => 'Name,Father,Mother\nPaul,Joseph,Mary'
 *
 * @example
 * await fetchFallbackGvizCsv('nonexistent_id', true, 5000);
 * // => null
 */
const fetchFallbackGvizCsv = async (sheetId, bypassCache = false, timeoutMs = 8000) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${bypassCache ? `&_cb=${Date.now()}` : ''}`;
        const fetchOptions = { signal: controller.signal };
        if (bypassCache) {
            fetchOptions.cache = 'no-store';
        }
        const fbRes = await fetch(fallbackUrl, fetchOptions);
        clearTimeout(timeoutId);
        if (fbRes.ok) {
            const fbText = await fbRes.text();
            if (fbText && !fbText.trim().startsWith('<html')) return fbText;
        }
    } catch (_) {}
    return null;
};

/**
 * Checks whether CSV text content contains standard genealogical header keywords.
 *
 * @param {string|null} text - Raw CSV text line.
 * @returns {boolean} True if header keywords match.
 *
 * @example
 * hasGenealogicalHeaders('Name,Father,Mother\nPaul,Joseph,Mary')
 * // => true
 *
 * @example
 * hasGenealogicalHeaders('Index,Timestamp,Score\n1,12345,99')
 * // => false
 */
const hasGenealogicalHeaders = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('name') && (lower.includes('mother') || lower.includes('mom') || lower.includes('father') || lower.includes('hus') || lower.includes('spouse') || lower.includes('family'));
};

/**
 * Recursively flattens a hierarchical sheet node tree into displayable lines with ASCII branching prefixes.
 *
 * @param {Object} node - Hierarchical sheet node { id, tag, status, count, children }
 * @param {string} [prefix=''] - Parent indentation prefix
 * @param {boolean} [isLast=true] - Whether this node is the last sibling
 * @param {number} [depth=0] - Current tree recursion depth
 * @returns {Array<{id: string, prefix: string, tag: string, status: string, count: number}>}
 *
 * @example
 * flattenSheetTree({ id: 's1', tag: 'Root', status: 'success', count: 12, children: [] })
 * // => [{ id: 's1', prefix: '', tag: 'Root', status: 'success', count: 12 }]
 *
 * @example
 * flattenSheetTree({ id: 's1', tag: 'Root', children: [{ id: 's2', tag: 'Branch', children: [] }] })
 * // => [{ id: 's1', prefix: '', ... }, { id: 's2', prefix: '└── ', ... }]
 */
function flattenSheetTree(node, prefix = '', isLast = true, depth = 0) {
    const nodePrefix = depth === 0 ? '' : (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (depth === 0 ? '' : (isLast ? '    ' : '│   '));
    const fullPrefix = prefix + nodePrefix;
    const line = {
        id: node.id,
        prefix: fullPrefix,
        tag: node.tag,
        status: node.status,
        count: node.count
    };
    const childLines = (node.children || []).flatMap((c, idx) => 
        flattenSheetTree(c, childPrefix, idx === node.children.length - 1, depth + 1)
    );
    return [line, ...childLines];
}

/**
 * Renders the JSX message for a sheet tree log entry based on its crawl status.
 *
 * @param {JSX.Element} sheetLink - Sheet hyperlink anchor element
 * @param {Object} item - Tree line descriptor with status and extracted profile count
 * @returns {JSX.Element} Formatted message node
 *
 * @example
 * _renderSheetLogStatusMessage(<a href="#">Sheet</a>, { status: 'loading', count: 0 });
 * // => <span>...</span>
 *
 * @example
 * _renderSheetLogStatusMessage(<a href="#">Sheet</a>, { status: 'success', count: 15 });
 * // => <span>...</span>
 */
function _renderSheetLogStatusMessage(sheetLink, item) {
    if (item.status === 'loading') {
        return <span>{sheetLink} <span className="text-slate-400 animate-pulse">...</span></span>;
    }
    const countColor = item.status === 'success' ? 'text-slate-500' : 'text-orange-500';
    return <span>{sheetLink} <span className={`${countColor} font-normal text-[11px]`}>({item.count || 0} profiles)</span></span>;
}

/**
 * Transforms flattened sheet tree nodes into formatted React log entry objects.
 *
 * @param {Array<{id: string, tag: string, status: string, count: number, prefix: string}>} lines - Flattened tree lines
 * @returns {Array<{id: string, time: string, msg: JSX.Element, type: string, prefix: string}>} Array of formatted log entries
 *
 * @example
 * buildSheetTreeLogItems([{ id: 's1', tag: 'Main Sheet', status: 'success', count: 12, prefix: '' }])
 * // => [{ id: 's1', time: '14:20:00', msg: <span>...</span>, type: 'success', prefix: '' }]
 *
 * @example
 * buildSheetTreeLogItems([{ id: 's2', tag: 'Branch', status: 'loading', count: 0, prefix: '└── ' }])
 * // => [{ id: 's2', type: 'info', prefix: '└── ', ... }]
 */
function buildSheetTreeLogItems(lines) {
    return lines.map(item => {
        const sheetLink = (
            <a 
                href={`https://docs.google.com/spreadsheets/d/${item.id}/edit`} 
                target="_blank" rel="noopener noreferrer" 
                className="text-blue-600 hover:text-blue-800 font-semibold underline decoration-blue-300 underline-offset-2"
                title={item.id}
            >
                {item.tag}
            </a>
        );

        return {
            id: item.id,
            time: new Date().toLocaleTimeString([], { hour12: false }),
            msg: _renderSheetLogStatusMessage(sheetLink, item),
            type: item.status === 'loading' ? 'info' : item.status,
            prefix: item.prefix
        };
    });
}

/**
 * Merges updated sheet tree log items into the previous logs array, preserving non-tree logs.
 *
 * @param {Array<Object>} prevLogs - Existing log entries
 * @param {Array<Object>} treeLogItems - Newly generated tree log entries
 * @returns {Array<Object>} Merged log entries
 *
 * @example
 * mergeTreeLogEntries([{ id: 'init', msg: 'start' }], [{ id: 's1', msg: 'sheet' }])
 * // => [{ id: 'init', msg: 'start' }, { id: 's1', msg: 'sheet' }]
 *
 * @example
 * mergeTreeLogEntries([], [{ id: 's1', msg: 'sheet' }])
 * // => [{ id: 's1', msg: 'sheet' }]
 */
function mergeTreeLogEntries(prevLogs, treeLogItems) {
    const treeIds = new Set(treeLogItems.map(tl => tl.id));
    const nonTreeLogs = prevLogs.filter(l => !treeIds.has(l.id));
    return [...nonTreeLogs, ...treeLogItems];
}

/**
 * Deterministically sorts row objects by source sheet ID and row number.
 *
 * @param {Array<Object>} rows - Raw person record rows
 * @returns {Array<Object>} Sorted row objects
 *
 * @example
 * sortSpreadsheetRows([{ _sourceId: 'B', _sheetRow: 2 }, { _sourceId: 'A', _sheetRow: 5 }])
 * // => [{ _sourceId: 'A', _sheetRow: 5 }, { _sourceId: 'B', _sheetRow: 2 }]
 *
 * @example
 * sortSpreadsheetRows([{ _sourceId: 'A', _sheetRow: 8 }, { _sourceId: 'A', _sheetRow: 3 }])
 * // => [{ _sourceId: 'A', _sheetRow: 3 }, { _sourceId: 'A', _sheetRow: 8 }]
 */
function sortSpreadsheetRows(rows) {
    return rows.sort((a, b) => 
        (a._sourceId || '').localeCompare(b._sourceId || '') || 
        (a._sheetRow || 0) - (b._sheetRow || 0)
    );
}

/**
 * Renders an interactive, clickable person link that dispatches a 'focusPerson' event to center on the person.
 *
 * @param {string|number} personId - ID of person to focus
 * @param {string} personName - Label name for the link
 * @param {string} [title='Click to focus on this person'] - Hover tooltip
 * @param {string} [extraClass=''] - Additional CSS classes
 * @returns {JSX.Element} Interactive link element
 *
 * @example
 * renderPersonFocusLink('p1', 'Alice', 'Click to focus')
 * // => <span onClick={...} className="..." title="Click to focus">Alice</span>
 *
 * @example
 * renderPersonFocusLink('p2', 'Bob', 'Focus Bob', 'ml-2')
 * // => <span onClick={...} className="... ml-2" title="Focus Bob">Bob</span>
 */
function renderPersonFocusLink(personId, personName, title = 'Click to focus on this person', extraClass = '') {
    return (
        <span 
            onClick={() => window.dispatchEvent(new CustomEvent('focusPerson', { detail: personId }))} 
            className={`text-blue-600 hover:text-blue-800 underline decoration-blue-300 font-semibold cursor-pointer inline ${extraClass}`}
            title={title}
        >
            {personName}
        </span>
    );
}

/**
 * Renders an external link badge that opens a specific row in Google Sheets.
 *
 * @param {string} sheetId - Google Sheets document ID
 * @param {number|string} row - Spreadsheet row number
 * @param {string} [sheetName='Sheet'] - Display sheet label
 * @param {string} [extraClass=''] - Additional styling classes
 * @returns {JSX.Element|null}
 *
 * @example
 * renderSheetRowBadge('1abc...', 42, 'Main Sheet')
 * // => <a href="https://docs.google.com/spreadsheets/d/1abc.../edit?gid=0#gid=0&range=42:42" ...>Main Sheet Row 42 ↗</a>
 *
 * @example
 * renderSheetRowBadge('', 10)
 * // => null
 */
function renderSheetRowBadge(sheetId, row, sheetName = 'Sheet', extraClass = '') {
    if (!row || !sheetId) return null;
    return (
        <a 
            href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=0#gid=0&range=${row}:${row}`}
            target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 shadow-2xs transition-colors align-middle ${extraClass}`}
            title={`Open Row ${row} in ${sheetName}`}
        >
            {sheetName} Row {row} ↗
        </a>
    );
}

/**
 * Resolves spreadsheet row number, sheet ID, and badge component for a person node.
 *
 * @param {Object} p - Person node
 * @param {string} startId - Default sheet ID
 * @param {Object} sheetTags - Sheet ID to display label mapping
 * @param {Object} [sheetNames={}] - Sheet ID to sheet name mapping
 * @param {string} [extraClass='bg-slate-100 ml-1'] - CSS class for badge
 * @returns {{ pRow: number|null, pSheetId: string, pSheetName: string, pRowBadge: React.ReactNode }}
 *
 * @example
 *   _resolvePersonSheetBadge({ sheetRow: 12, _sourceId: 's1' }, 's1', { s1: 'Main' }, {});
 *   // => { pRow: 12, pSheetId: 's1', pSheetName: 'Main', pRowBadge: <Badge ...> }
 *
 * @example
 *   _resolvePersonSheetBadge({ sheetRow: 99999, _sheetRow: 45 }, 's2', {}, { s2: 'Branch' });
 *   // => { pRow: 45, pSheetId: 's2', pSheetName: 'Branch', pRowBadge: <Badge ...> }
 */
function _resolvePersonSheetBadge(p, startId, sheetTags, sheetNames = {}, extraClass = 'bg-slate-100 ml-1') {
    const pRow = (p.sheetRow < 99999 ? p.sheetRow : p._sheetRow) || (p._allSourceRefs?.[0]?.row);
    const pSheetId = (p._sourceId && p._sourceId !== 'default') ? p._sourceId : startId;
    const pSheetName = sheetTags[pSheetId] || sheetNames?.[pSheetId] || 'Sheet';
    const pRowBadge = renderSheetRowBadge(pSheetId, pRow, pSheetName, extraClass);
    return { pRow, pSheetId, pSheetName, pRowBadge };
}

/**
 * Renders an inconsistency log item with person link, sheet row badge, and diagnostic text.
 *
 * @param {Object} inc - Inconsistency audit item
 * @param {string} startId - Default sheet ID
 * @param {Object} sheetTags - Sheet ID to display label mapping
 * @param {Object} [sheetNames={}] - Sheet ID to sheet name mapping
 * @param {string} [textClass='text-slate-700'] - Container text CSS classes
 * @param {React.ReactNode} [textNode=null] - Optional customized message node (defaults to inc.text)
 * @returns {React.ReactNode}
 *
 * @example
 *   _renderAuditInconsistencyItem({ p: { id: 'p1', name: 'John' }, text: 'Age mismatch' }, 's1', { s1: 'Main' }, {});
 *
 * @example
 *   _renderAuditInconsistencyItem(inc, 's1', tags, names, 'text-rose-600', <b>Custom Warning</b>);
 */
function _renderAuditInconsistencyItem(inc, startId, sheetTags, sheetNames, textClass = 'text-slate-700', textNode = null) {
    const linkNode = renderPersonFocusLink(inc.p.id, inc.p.name, 'Click to focus');
    const { pRowBadge } = _resolvePersonSheetBadge(inc.p, startId, sheetTags, sheetNames);
    return (
        <span className={`whitespace-normal leading-relaxed text-[12px] block mt-0.5 ${textClass}`}>
            {linkNode} {pRowBadge} <span className="text-slate-400 font-sans mx-1">—</span> {textNode || inc.text}
        </span>
    );
}

/**
 * Renders a compact chip for a partner profile in the multi-partner audit log.
 *
 * @param {string} partnerId - Partner person ID
 * @param {FamilyTree} newTree - Tree domain instance
 * @param {string} startId - Default sheet ID
 * @param {Object} sheetTags - Sheet ID to display label mapping
 * @returns {React.ReactNode}
 *
 * @example
 *   _renderMultiplePartnerPill('p1', tree, 's1', { s1: 'Main' });
 *
 * @example
 *   _renderMultiplePartnerPill('p2', tree, 's2', {});
 */
function _renderMultiplePartnerPill(partnerId, newTree, startId, sheetTags) {
    const partner = newTree.get(partnerId);
    const pName = partner ? partner.name : partnerId;
    const datePart = [
        partner?.yob ? `b. ${partner.yob}` : '',
        partner?.death ? `d. ${partner.death}` : ''
    ].filter(Boolean).join(', ');

    const partRow = (partner?.sheetRow < 99999 ? partner.sheetRow : partner?._sheetRow) || (partner?._allSourceRefs?.[0]?.row);
    const partSheetId = (partner?._sourceId && partner?._sourceId !== 'default') ? partner._sourceId : startId;
    const partSheetName = sheetTags[partSheetId] || newTree.sheetNames?.[partSheetId] || 'Sheet';
    const partRowBadge = partRow ? (
        <a 
            href={`https://docs.google.com/spreadsheets/d/${partSheetId}/edit?gid=0#gid=0&range=${partRow}:${partRow}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 shadow-2xs transition-colors"
            title={`Open Row ${partRow} in ${partSheetName}`}
        >
            {partSheetName} Row {partRow} ↗
        </a>
    ) : null;

    return (
        <span key={partnerId} className="inline-flex items-center flex-wrap gap-1 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/70 text-slate-700 shadow-2xs">
            {renderPersonFocusLink(partnerId, pName, 'Click to focus partner', 'font-medium')}
            {datePart && <span className="text-[11px] text-slate-500">({datePart})</span>}
            {partRowBadge}
        </span>
    );
}

/**
 * Renders a candidate selection chip for an ambiguous relationship in the audit log.
 *
 * @param {Object} c - Candidate match descriptor
 * @param {number} cIdx - Index of candidate in list
 * @param {boolean} isUsed - Whether this candidate is currently linked in the tree
 * @param {FamilyTree} newTree - Tree domain instance
 * @param {string} startId - Default sheet ID
 * @param {Object} sheetTags - Sheet ID to display label mapping
 * @returns {React.ReactNode}
 *
 * @example
 *   _renderAmbiguityCandidatePill({ id: 'p1', name: 'Mary', sheetRow: 15 }, 0, true, tree, 's1', tags);
 *
 * @example
 *   _renderAmbiguityCandidatePill({ id: 'p2', name: 'Mary Ann', sheetRow: 22 }, 1, false, tree, 's1', tags);
 */
/**
 * Resolves candidate identity, sheet provenance, and formatted dates for ambiguity pills.
 *
 * @param {Object} c - Candidate descriptor
 * @param {Object} newTree - Tree instance containing node definitions
 * @param {string} startId - Fallback source sheet identifier
 * @param {Object} sheetTags - Mapping of sheet IDs to sheet tag display names
 * @returns {{ candName: string, cRow: (number|string|undefined), cSheetId: string, cSheetName: string, datePart: string }} Resolved candidate details
 *
 * @example
 * const res = _resolveAmbiguityCandidateDetails({ id: 'p1', name: 'John' }, tree, 's1', {});
 * // returns { candName: 'John', cRow: undefined, cSheetId: 's1', cSheetName: 'Sheet', datePart: '' }
 *
 * @example
 * const res = _resolveAmbiguityCandidateDetails({ id: 'p2', yob: 1940, sheetRow: 15 }, tree, 's1', { s1: 'Main' });
 * // returns { candName: 'Unknown', cRow: 15, cSheetId: 's1', cSheetName: 'Main', datePart: 'b. 1940' }
 */
function _resolveAmbiguityCandidateDetails(c, newTree, startId, sheetTags) {
    const candNode = newTree.get(c.id);
    const candName = c.name || candNode?.name || 'Unknown';
    const cRow = c.sheetRow || (candNode?.sheetRow < 99999 ? candNode.sheetRow : candNode?._sheetRow);
    const cSheetId = (c.sheetId && c.sheetId !== 'default') ? c.sheetId : (candNode?._sourceId || startId);
    const cSheetName = sheetTags[cSheetId] || newTree.sheetNames?.[cSheetId] || 'Sheet';
    const datePart = [
        c.yob ? `b. ${c.yob}` : (candNode?.yob ? `b. ${candNode.yob}` : ''),
        c.death ? `d. ${c.death}` : (candNode?.death ? `d. ${candNode.death}` : '')
    ].filter(Boolean).join(', ');
    return { candName, cRow, cSheetId, cSheetName, datePart };
}

/**
 * Renders an interactive candidate pill for resolving person ambiguity in the logs.
 *
 * @param {Object} c - Candidate match descriptor
 * @param {number} cIdx - Index of candidate in list
 * @param {boolean} isUsed - Whether this candidate is currently linked in the tree
 * @param {FamilyTree} newTree - Tree domain instance
 * @param {string} startId - Default sheet ID
 * @param {Object} sheetTags - Sheet ID to display label mapping
 * @returns {React.ReactNode}
 *
 * @example
 *   _renderAmbiguityCandidatePill({ id: 'p1', name: 'Mary', sheetRow: 15 }, 0, true, tree, 's1', tags);
 *
 * @example
 *   _renderAmbiguityCandidatePill({ id: 'p2', name: 'Mary Ann', sheetRow: 22 }, 1, false, tree, 's1', tags);
 */
function _renderAmbiguityCandidatePill(c, cIdx, isUsed, newTree, startId, sheetTags) {
    const { candName, cRow, cSheetId, cSheetName, datePart } =
        _resolveAmbiguityCandidateDetails(c, newTree, startId, sheetTags);

    const pillClass = isUsed
        ? "inline-flex items-center flex-wrap gap-1 bg-orange-100/90 px-2 py-0.5 rounded-md border border-orange-300 text-slate-800 shadow-2xs"
        : "inline-flex items-center flex-wrap gap-1 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/70 text-slate-700";

    const cRowBadge = cRow ? (
        <a 
            href={`https://docs.google.com/spreadsheets/d/${cSheetId}/edit?gid=0#gid=0&range=${cRow}:${cRow}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 shadow-2xs transition-colors"
            title={`Open Row ${cRow} in ${cSheetName}`}
        >
            {cSheetName} Row {cRow} ↗
        </a>
    ) : null;

    return (
        <span key={c.id || cIdx} className={pillClass}>
            {renderPersonFocusLink(c.id, candName, `Click to focus candidate${isUsed ? ' (currently used in tree)' : ''}`, 'font-medium')}
            {datePart && <span className="text-[11px] text-slate-500">({datePart})</span>}
            {cRowBadge}
        </span>
    );
}

/**
 * Logs details of profiles merged from duplicate spreadsheet rows into the activity log.
 *
 * @param {Array<{ p: Person, duplicatedRefs: Array<{ sheetId: string, row: number }> }>} dupes - Merged duplicate profile records.
 * @param {Object<string, string>} sheetTags - Mapping of sheet IDs to sheet tag display names.
 * @param {Function} appendLog - Logger append callback.
 *
 * @example
 * logMergedDupes(
 *     [{ p: person1, duplicatedRefs: [{ sheetId: 's1', row: 12 }] }],
 *     { s1: 'Branch A' },
 *     appendLog
 * );
 *
 * @example
 * // With empty duplicates list (no-op)
 * logMergedDupes([], {}, appendLog);
 */
function logMergedDupes(dupes, sheetTags, appendLog) {
    if (!dupes || dupes.length === 0) return;
    appendLog(`Merged duplicate row entries for ${dupes.length} profiles:`, 'info');
    dupes.forEach(({ p, duplicatedRefs }) => {
        const linkNode = renderPersonFocusLink(p.id, p.name);
        const sourceLinks = (
            <span className="inline-flex flex-wrap gap-1.5 ml-2 align-middle">
                {duplicatedRefs.map((ref, idx) => (
                    <React.Fragment key={`${ref.sheetId}-${ref.row}-${idx}`}>
                        {renderSheetRowBadge(ref.sheetId, ref.row, sheetTags[ref.sheetId] || 'Sheet', 'bg-slate-100')}
                    </React.Fragment>
                ))}
            </span>
        );
        appendLog(<span className="whitespace-normal leading-relaxed text-[12px] block mt-0.5 text-slate-600">Combined {duplicatedRefs.length} entries for {linkNode} {sourceLinks}</span>, 'info', `${p.id}-merge-log`, '  • ');
    });
}

/**
 * Sorts partner IDs in ascending chronological order by birth year and sheet row order.
 *
 * @param {Array<string>} partnerIds - Array of partner profile IDs
 * @param {FamilyTree} tree - Genealogy tree model
 * @returns {Array<string>} Sorted partner IDs
 *
 * @example
 * const sorted = sortPartnerIdsChronologically(['p2', 'p1'], tree);
 *
 * @example
 * const sorted = sortPartnerIdsChronologically([], tree);
 * // => []
 */
function sortPartnerIdsChronologically(partnerIds, tree) {
    return [...(partnerIds || [])].sort((aId, bId) => {
        const a = tree?.get(aId);
        const b = tree?.get(bId);
        const aYob = a?.yob || a?.bestYob || a?._inferredYob || 0;
        const bYob = b?.yob || b?.bestYob || b?._inferredYob || 0;
        if (aYob && bYob && aYob !== bYob) return aYob - bYob;
        const aRow = (a?.sheetRow < 99999 ? a.sheetRow : a?._sheetRow) || 0;
        const bRow = (b?.sheetRow < 99999 ? b.sheetRow : b?._sheetRow) || 0;
        return aRow - bRow;
    });
}

/**
 * Logs warnings for profiles associated with multiple partners, sorting partners chronologically by YOB or row.
 *
 * @param {Array<Object>} multiplePartners - List of multiple partner inconsistency objects.
 * @param {FamilyTree} newTree - Unified family tree instance.
 * @param {string} startId - Root sheet identifier.
 * @param {Object<string, string>} sheetTags - Mapping of sheet IDs to sheet tags.
 * @param {Function} appendLog - Logger append callback.
 *
 * @example
 * logMultiplePartnerInconsistencies(
 *     [{ p: personWithTwoPartners }],
 *     tree,
 *     'root-sheet-id',
 *     { 'root-sheet-id': 'Root' },
 *     appendLog
 * );
 *
 * @example
 * // When no multiple partners exist (no-op)
 * logMultiplePartnerInconsistencies([], tree, 'root', {}, appendLog);
 */
function logMultiplePartnerInconsistencies(multiplePartners, newTree, startId, sheetTags, appendLog) {
    if (!multiplePartners || multiplePartners.length === 0) return;
    appendLog(`Found ${multiplePartners.length} profile(s) with multiple partners:`, 'warning');
    multiplePartners.forEach((inc, idx) => {
        const linkNode = renderPersonFocusLink(inc.p.id, inc.p.name, 'Click to focus');
        const { pRowBadge } = _resolvePersonSheetBadge(inc.p, startId, sheetTags, newTree.sheetNames);
        const sortedPartners = sortPartnerIdsChronologically(inc.p.partners, newTree);
        const partnerNodes = sortedPartners.map(partnerId => 
            _renderMultiplePartnerPill(partnerId, newTree, startId, sheetTags)
        );

        appendLog(
            <span className="whitespace-normal leading-relaxed text-[12px] block mt-0.5 text-slate-700">
                {linkNode} {pRowBadge} <span className="text-slate-400 font-sans mx-1">—</span> <span className="font-medium text-slate-600">{inc.p.partners.length} partners:</span>
                <span className="inline-flex flex-wrap gap-1.5 mt-1 ml-1 align-middle">
                    {partnerNodes}
                </span>
            </span>,
            'warning',
            `multi-partner-${idx}`,
            '  • '
        );
    });
}

/**
 * Identifies the active candidate currently chosen in the tree and orders ambiguity candidates
 * with the chosen candidate placed first.
 *
 * @param {Object} amb - Ambiguity record containing candidate nodes
 * @param {Person} person - Person node for whom the ambiguity was recorded
 * @param {FamilyTree} tree - Tree instance containing person records
 * @returns {{ usedCandidate: Object, sortedCandidates: Array<Object> }}
 *
 * @example
 * _orderAmbiguityCandidates({ relation: 'father', candidates: [c1, c2] }, person, tree);
 * // => { usedCandidate: c2, sortedCandidates: [c2, c1] }
 *
 * @example
 * _orderAmbiguityCandidates({ relation: 'spouse', candidates: [c1] }, person, tree);
 * // => { usedCandidate: c1, sortedCandidates: [c1] }
 */
function _orderAmbiguityCandidates(amb, person, tree) {
    const usedCandidate = amb.candidates.find(c => FamilyTree._isCandidateUsed(c, amb, person, tree)) || amb.candidates[0];
    const sortedCandidates = usedCandidate
        ? [usedCandidate, ...amb.candidates.filter(c => c !== usedCandidate)]
        : amb.candidates;
    return { usedCandidate, sortedCandidates };
}

/**
 * Logs an ambiguity entry that contains multiple candidates with individual candidate pills.
 *
 * @param {Object} params - Ambiguity logging context
 * @param {Object} params.inc - Inconsistency record containing person and ambiguity details
 * @param {number} params.idx - Unique index of the ambiguity record
 * @param {React.ReactNode} params.linkNode - Focusable link element for the person
 * @param {React.ReactNode} params.pRowBadge - Sheet identifier badge for the person
 * @param {FamilyTree} params.newTree - Tree instance containing person records
 * @param {string} params.startId - Root spreadsheet ID
 * @param {Object} params.sheetTags - Mapping of sheet IDs to metadata
 * @param {Function} params.appendLog - Function to append formatted log entries
 *
 * @example
 * _logAmbiguityWithCandidates({ inc, idx: 0, linkNode, pRowBadge: badge, newTree: tree, startId: 's1', sheetTags: {}, appendLog });
 *
 * @example
 * _logAmbiguityWithCandidates({ inc, idx: 1, linkNode, pRowBadge: badge, newTree: tree, startId: 's2', sheetTags: {}, appendLog });
 */
function _logAmbiguityWithCandidates({ inc, idx, linkNode, pRowBadge, newTree, startId, sheetTags, appendLog }) {
    const amb = inc.amb;
    const relDesc = amb.relation ? `${amb.relation} '${amb.query || ''}'` : `'${amb.query || ''}'`;
    const { usedCandidate, sortedCandidates } = _orderAmbiguityCandidates(amb, inc.p, newTree);
    const candidateElements = sortedCandidates.map((c, cIdx) =>
        _renderAmbiguityCandidatePill(c, cIdx, c === usedCandidate, newTree, startId, sheetTags)
    );

    appendLog(
        <span className="whitespace-normal leading-relaxed text-[12px] block mt-0.5 text-slate-700">
            {linkNode} {pRowBadge} <span className="text-slate-400 font-sans mx-1">—</span> <span className="text-amber-800 font-medium">Multiple candidates for {relDesc}:</span>
            <span className="inline-flex flex-wrap gap-1.5 mt-1 ml-1 align-middle">
                {candidateElements}
            </span>
        </span>,
        'warning',
        `amb-${idx}`,
        '  • '
    );
}

/**
 * Formats and appends a single ambiguous relationship entry to the activity log.
 *
 * @param {object} inc - Inconsistency entry with person and ambiguity candidates
 * @param {number} idx - Index of the ambiguity entry
 * @param {FamilyTree} newTree - Tree instance containing person records
 * @param {string} startId - Root spreadsheet ID
 * @param {object} sheetTags - Mapping of sheet IDs to metadata
 * @param {function} appendLog - Function to append formatted log entries
 *
 * @example
 * logSingleAmbiguity({ p: { id: 'p1', name: 'John' }, text: 'Ambiguous' }, 0, tree, 's1', {}, appendLog);
 *
 * @example
 * logSingleAmbiguity({ p: { id: 'p2', name: 'Mary' }, amb: { relation: 'father', candidates: [] } }, 1, tree, 's1', {}, appendLog);
 */
function logSingleAmbiguity(inc, idx, newTree, startId, sheetTags, appendLog) {
    const linkNode = renderPersonFocusLink(inc.p.id, inc.p.name, 'Click to focus');
    const { pRowBadge } = _resolvePersonSheetBadge(inc.p, startId, sheetTags, newTree.sheetNames);

    if (inc.amb && inc.amb.candidates && inc.amb.candidates.length > 0) {
        _logAmbiguityWithCandidates({ inc, idx, linkNode, pRowBadge, newTree, startId, sheetTags, appendLog });
    } else {
        const rawText = inc.text || '';
        appendLog(
            <span className="whitespace-normal leading-relaxed text-[12px] block mt-0.5 text-slate-700">
                {linkNode} {pRowBadge} <span className="text-slate-400 font-sans mx-1">—</span> {rawText}
            </span>,
            inc.type,
            `amb-${idx}`,
            '  • '
        );
    }
}

/**
 * Logs warnings for ambiguous parent or spouse relationships with multiple candidate choices.
 *
 * @param {Array<Object>} ambiguities - List of ambiguity inconsistency records.
 * @param {FamilyTree} newTree - Unified family tree instance.
 * @param {string} startId - Root sheet identifier.
 * @param {Object<string, string>} sheetTags - Mapping of sheet IDs to sheet tags.
 * @param {Function} appendLog - Logger append callback.
 *
 * @example
 * logAmbiguityInconsistencies(
 *     [{ p: childNode, amb: { relation: 'Father', query: 'John', candidates: [c1, c2] } }],
 *     tree,
 *     'root-sheet-id',
 *     { 'root-sheet-id': 'Root' },
 *     appendLog
 * );
 *
 * @example
 * // When no ambiguities exist (no-op)
 * logAmbiguityInconsistencies([], tree, 'root', {}, appendLog);
 */
function logAmbiguityInconsistencies(ambiguities, newTree, startId, sheetTags, appendLog) {
    if (!ambiguities || ambiguities.length === 0) return;
    appendLog(`Found ${ambiguities.length} ambiguous relationship(s):`, 'warning');
    ambiguities.forEach((inc, idx) => {
        logSingleAmbiguity(inc, idx, newTree, startId, sheetTags, appendLog);
    });
}

/**
 * Appends a grouped list of audit inconsistencies to the activity log with formatted labels.
 *
 * @param {object} params
 * @param {Array<object>} params.items - Inconsistency items belonging to this category
 * @param {string} params.headerMsg - Header summary message to log
 * @param {string} [params.logType] - Log level ('error' | 'warning' | 'info')
 * @param {string} params.keyPrefix - Unique key prefix for log item tracking
 * @param {string} params.colorClass - CSS text color class for item display
 * @param {Function} [params.textFormatter] - Custom formatter returning a string or JSX node
 * @param {string} params.startId - Root spreadsheet identifier
 * @param {object} params.sheetTags - Sheet tags dictionary
 * @param {object} params.sheetNames - Sheet names dictionary
 * @param {Function} params.appendLog - Logger append callback
 *
 * @example
 * _logInconsistencyGroup({
 *   items: [{ text: 'Invalid YOB', type: 'error' }],
 *   headerMsg: 'Found 1 critical error:',
 *   logType: 'error',
 *   keyPrefix: 'err',
 *   colorClass: 'text-red-700',
 *   startId: 'sheet1',
 *   sheetTags: {},
 *   sheetNames: {},
 *   appendLog: (msg, type) => console.log(type, msg)
 * });
 *
 * @example
 * // No-op when items is empty
 * _logInconsistencyGroup({ items: [], headerMsg: 'None', appendLog: () => {} });
 */
function _logInconsistencyGroup({
    items,
    headerMsg,
    logType,
    keyPrefix,
    colorClass,
    textFormatter,
    startId,
    sheetTags,
    sheetNames,
    appendLog
}) {
    if (!items || items.length === 0) return;
    appendLog(headerMsg, logType);
    items.forEach((inc, idx) => {
        const textContent = textFormatter ? textFormatter(inc) : inc.text;
        appendLog(
            _renderAuditInconsistencyItem(inc, startId, sheetTags, sheetNames, colorClass, textContent),
            logType || inc.type,
            `${keyPrefix}-${idx}`,
            '  • '
        );
    });
}

/**
 * Logs partitioned non-ambiguity audit warnings and errors (critical errors, unresolved spreadsheet claims,
 * chronological/biological warnings, and near-duplicate spelling warnings).
 *
 * @param {Array<Object>} otherInconsistencies - Filtered inconsistency records.
 * @param {string} startId - Root sheet identifier.
 * @param {Object<string, string>} sheetTags - Mapping of sheet IDs to sheet tags.
 * @param {FamilyTree} newTree - Unified family tree instance.
 * @param {Function} appendLog - Logger append callback.
 *
 * @example
 * logCategorizedAuditInconsistencies(
 *     [
 *         { type: 'error', text: 'Parent younger than child', p: node1 },
 *         { category: 'spelling', text: "Spelling 'Annu' is almost the same as 'Anu'", p: node2 }
 *     ],
 *     'root',
 *     { root: 'Root' },
 *     tree,
 *     appendLog
 * );
 *
 * @example
 * // With clean tree (no-op)
 * logCategorizedAuditInconsistencies([], 'root', {}, tree, appendLog);
 */
function logCategorizedAuditInconsistencies(otherInconsistencies, startId, sheetTags, newTree, appendLog) {
    if (!otherInconsistencies || otherInconsistencies.length === 0) return;

    const criticalErrors = otherInconsistencies.filter(inc => inc.type === 'error');
    const unresolvedClaims = otherInconsistencies.filter(inc => inc.category === 'unresolved_claim');
    const spellingWarnings = otherInconsistencies.filter(inc => inc.category === 'spelling');
    const bioWarnings = otherInconsistencies.filter(inc => inc.type !== 'error' && inc.category !== 'unresolved_claim' && inc.category !== 'spelling');

    const baseParams = { startId, sheetTags, sheetNames: newTree.sheetNames, appendLog };
    const amberFmt = inc => <span className="text-amber-800 font-medium">{inc.text}</span>;
    const groups = [
        { items: criticalErrors, headerMsg: `Found ${criticalErrors.length} critical data error(s):`, logType: 'error', keyPrefix: 'err-inc', colorClass: 'text-red-700', textFormatter: inc => <span className="font-semibold text-red-800">{inc.text}</span> },
        { items: unresolvedClaims, headerMsg: `Found ${unresolvedClaims.length} unresolved spreadsheet claim(s):`, logType: 'warning', keyPrefix: 'unresolved-claim', colorClass: 'text-slate-700', textFormatter: amberFmt },
        { items: bioWarnings, headerMsg: `Found ${bioWarnings.length} chronological/biological warning(s):`, logType: 'warning', keyPrefix: 'bio-warn', colorClass: 'text-slate-700', textFormatter: inc => inc.text },
        { items: spellingWarnings, headerMsg: `Found ${spellingWarnings.length} spelling warning(s):`, logType: 'warning', keyPrefix: 'spell-warn', colorClass: 'text-slate-700', textFormatter: amberFmt },
    ];
    groups.forEach(g => _logInconsistencyGroup({ ...baseParams, ...g }));
}

/**
 * Logs warnings for unreachable or disconnected subtrees in the activity log with their root name, YOB, and size.
 *
 * @param {Array<{ root: Person, size: number }>} subtrees - Array of unreachable subtree descriptor objects.
 * @param {Function} appendLog - Logger append callback.
 *
 * @example
 * logDisconnectedSubtrees(
 *     [{ root: orphanRootNode, size: 3 }],
 *     appendLog
 * );
 *
 * @example
 * // When no disconnected subtrees exist (no-op)
 * logDisconnectedSubtrees([], appendLog);
 */
function logDisconnectedSubtrees(subtrees, appendLog) {
    if (!subtrees || subtrees.length === 0) return;
    appendLog(`Found ${subtrees.length} disconnected subtree(s):`, 'warning');
    subtrees.forEach((rt, idx) => {
        const linkNode = renderPersonFocusLink(rt.root.id, rt.root.name);
        const yearStr = rt.root.yob ? `b. ${rt.root.yob}` : 'Unknown year';
        const sizeStr = `${rt.size} ${rt.size === 1 ? 'person' : 'people'}`;
        appendLog(<span className="whitespace-normal leading-relaxed text-[11.5px] block mt-0.5 text-slate-600">{linkNode} <span className="text-slate-400 font-sans mx-1">—</span> {yearStr} <span className="text-slate-400 font-sans mx-1">—</span> <b>{sizeStr}</b></span>, 'warning', `unreachable-${idx}`, '  • ');
    });
}

/**
 * Logs the comprehensive validation, audit, and diagnostic results of a built family tree,
 * formatting timing metrics, merged duplicates, partner counts, relationship ambiguities,
 * biological inconsistencies, and disconnected subtrees into interactive UI log entries.
 *
 * @param {Object} params
 * @param {FamilyTree} params.newTree - Built tree instance
 * @param {string} params.startId - Root Google Sheet ID
 * @param {Object<string, string>} params.sheetTags - Sheet ID to display name mapping
 * @param {Function} params.appendLog - Logger append callback
 * @param {number} params.allRowsCount - Total rows parsed across all sheets
 * @param {number} params.visitedCount - Total sheets loaded
 * @param {Object} params.timing - Timing metrics { fetchTimeSec, buildTimeMs, totalTimeSec }
 *
 * @example
 * logTreeAuditResults({
 *     newTree: tree,
 *     startId: 'sheet1',
 *     sheetTags: { sheet1: 'Root' },
 *     appendLog: (msg, type) => {},
 *     allRowsCount: 50,
 *     visitedCount: 1,
 *     timing: { fetchTimeSec: '0.45', buildTimeMs: 15, totalTimeSec: '0.47' }
 * });
 *
 * @example
 * // With multiple sheets and clean tree
 * logTreeAuditResults({
 *     newTree: cleanTree,
 *     startId: 'root',
 *     sheetTags: { root: 'Root', branch1: 'Branch' },
 *     appendLog,
 *     allRowsCount: 120,
 *     visitedCount: 2,
 *     timing: { fetchTimeSec: '1.20', buildTimeMs: 25, totalTimeSec: '1.23' }
 * });
 */
function logTreeAuditResults({ newTree, startId, sheetTags, appendLog, allRowsCount, visitedCount, timing }) {
    const { inconsistencies, dupes, subtrees } = newTree.audit();
    const { fetchTimeSec, buildTimeMs, totalTimeSec } = timing;

    // Log exact timing breakdown
    appendLog(
        <span>⏱️ <b>Fetch time:</b> {fetchTimeSec}s ({visitedCount} sheets) | <b>Build time:</b> {buildTimeMs}ms ({allRowsCount} profiles) | <b>Total:</b> {totalTimeSec}s</span>, 
        'success'
    );
    appendLog(`Family Tree loaded successfully (${allRowsCount} profiles, ${visitedCount} sheets)!`, 'success');

    logMergedDupes(dupes, sheetTags, appendLog);

    if (inconsistencies.length > 0) {
        const ambiguities = inconsistencies.filter(inc => inc.category === 'ambiguity' || inc.text?.startsWith('Ambiguity:'));
        const multiplePartners = inconsistencies.filter(inc => inc.category === 'multiple_partners' || inc.text?.includes('Has multiple partners'));
        const otherInconsistencies = inconsistencies.filter(inc => !ambiguities.includes(inc) && !multiplePartners.includes(inc));

        logMultiplePartnerInconsistencies(multiplePartners, newTree, startId, sheetTags, appendLog);
        logAmbiguityInconsistencies(ambiguities, newTree, startId, sheetTags, appendLog);
        logCategorizedAuditInconsistencies(otherInconsistencies, startId, sheetTags, newTree, appendLog);
    } else {
        appendLog(`Tree audit passed. No chronological inconsistencies found.`, 'success');
    }

    logDisconnectedSubtrees(subtrees, appendLog);
}

/**
 * Computes a deterministic string fingerprint of parsed spreadsheet rows to detect data changes.
 *
 * @param {Array<Object>} rows - Parsed genealogical rows
 * @returns {string} Semicolon- and pipe-delimited normalized fingerprint
 *
 * @example
 * computeDataFingerprint([{ name: 'Alice', gender: 'F' }])
 * // => 'gender:F;name:Alice'
 *
 * @example
 * computeDataFingerprint([])
 * // => ''
 */
function computeDataFingerprint(rows) {
    if (!rows || rows.length === 0) return '';
    return rows.map(r => {
        const entries = Object.entries(r).sort(([a], [b]) => a.localeCompare(b));
        return entries.map(([k, v]) => `${k}:${String(v != null ? v : '').trim()}`).join(';');
    }).join('|');
}

/**
 * Fetches CSV text for a specific Google Sheet tab with timeout and fallback to GViz.
 *
 * @param {string} sheetId - Google Sheets document ID
 * @param {string} [sheetName=''] - Tab/sheet name (e.g. 'Links' or 'Data')
 * @param {number} [timeoutMs=6000] - Request timeout in milliseconds
 * @param {boolean} [bypassCache=false] - Whether to bypass browser cache
 * @returns {Promise<string|null>} CSV text or null if failed
 *
 * @example
 * const csv = await fetchCSVData('1abc...', 'Links', 5000);
 *
 * @example
 * const defaultCsv = await fetchCSVData('1abc...', '', 8000, true);
 */
async function fetchCSVData(sheetId, sheetName = '', timeoutMs = 8000, bypassCache = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const url = buildGoogleSheetCsvUrl(sheetId, sheetName, bypassCache);
    try {
        const fetchOptions = { signal: controller.signal };
        if (bypassCache) {
            fetchOptions.cache = 'no-store';
        }
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        if (!response.ok) {
            return sheetName ? null : fetchFallbackGvizCsv(sheetId, bypassCache, timeoutMs);
        }
        const text = await response.text();
        if (!text || text.trim().startsWith('<html')) {
            return sheetName ? null : fetchFallbackGvizCsv(sheetId, bypassCache, timeoutMs);
        }
        return text;
    } catch (err) {
        clearTimeout(timeoutId);
        if (!sheetName) {
            return fetchFallbackGvizCsv(sheetId, bypassCache, timeoutMs);
        }
        return null;
    }
}

/**
 * Extracts linked Google Spreadsheet IDs and optional display labels from CSV text.
 *
 * @param {string} text - Raw CSV text
 * @param {string} currentSheetId - ID of current sheet to avoid self-linking
 * @returns {Array<{ id: string, tag: string|null }>} List of extracted sheet links
 *
 * @example
 * extractLinkedSheetIds('"Chalissery",https://docs.google.com/spreadsheets/d/1abc12345678901234567890123456789012345/edit', 'curr')
 * // => [{ id: '1abc12345678901234567890123456789012345', tag: 'Chalissery' }]
 *
 * @example
 * extractLinkedSheetIds('', 'curr')
 * // => []
 */
function extractLinkedSheetIds(text, currentSheetId) {
    if (!text) return [];
    const foundLinks = [];
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
        const idMatches = [...line.matchAll(/[a-zA-Z0-9-_]{35,60}/g)].map(m => m[0]);
        for (const match of idMatches) {
            if (match !== currentSheetId && !foundLinks.some(l => l.id === match)) {
                const firstColMatch = line.match(/^(?:"([^"]*)"|([^,]*))/);
                const firstCol = firstColMatch ? (firstColMatch[1] || firstColMatch[2] || '').trim() : '';
                const tag = (firstCol && !firstCol.includes('http') && !firstCol.match(/[a-zA-Z0-9-_]{35,60}/)) ? firstCol : null;
                foundLinks.push({ id: match, tag });
            }
        }
    }
    return foundLinks;
}

/**
 * Extracts and parses genealogical profile rows from CSV text by detecting header columns.
 *
 * @param {string} text - Raw CSV text from sheet
 * @param {string} currentSheetId - Source Google Sheet ID
 * @returns {Array<Object>} Parsed data rows with _sourceId and _sheetRow metadata
 *
 * @example
 * extractGenealogicalRows('Name,Gender,Father\nThomas,M,Ouseph', 'sheet1')
 * // => [{ name: 'Thomas', gender: 'M', father: 'Ouseph', _sourceId: 'sheet1', _sheetRow: 2, ... }]
 *
 * @example
 * extractGenealogicalRows('', 'sheet1')
 * // => []
 */
function extractGenealogicalRows(text, currentSheetId) {
    if (!text) return [];

    // Fast path: parse directly with CSVParser if headers match, avoiding slicing across multi-line quoted cells
    if (hasGenealogicalHeaders(text)) {
        try {
            const parsed = CSVParser.parse(text);
            if (parsed.length > 0 && hasGenealogicalHeaders(Object.keys(parsed[0]).join(','))) {
                return tagParsedRowMetadata(parsed, currentSheetId, 0, 2);
            }
        } catch (_) {}
    }

    const rawLines = text.split('\n');
    const lines = rawLines.filter(l => l.trim().length > 0);

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        if (hasGenealogicalHeaders(lines[i])) {
            const rawIndex = rawLines.indexOf(lines[i]);
            const parsed = CSVParser.parse(rawLines.slice(rawIndex).join('\n'));
            if (parsed.length > 0) {
                return tagParsedRowMetadata(parsed, currentSheetId, rawIndex, i + 2);
            }
        }
    }
    return [];
}

/**
 * Tags sheet source identifier and serializes initial sheet row tracking on parsed CSV rows.
 *
 * @param {Array<Object>} rows - Parsed CSV row objects.
 * @param {string} sheetId - Spreadsheet identifier.
 * @param {number} [rowOffset=0] - Additional offset to add to parsed _sheetRow.
 * @param {number} [defaultRowFallback=2] - Fallback row number if row has no _sheetRow.
 * @returns {Array<Object>} The mutated rows array.
 *
 * @example
 * tagParsedRowMetadata([{ _sheetRow: 3 }], 'sheet1', 10, 2);
 * // => [{ _sourceId: 'sheet1', _sheetRow: 13, _sheetRows: '{"sheet1":13}' }]
 *
 * @example
 * tagParsedRowMetadata([{ name: 'John' }], 'sheet2', 0, 5);
 * // => [{ name: 'John', _sourceId: 'sheet2', _sheetRow: 5, _sheetRows: '{"sheet2":5}' }]
 */
function tagParsedRowMetadata(rows, sheetId, rowOffset = 0, defaultRowFallback = 2) {
    rows.forEach(r => {
        r._sourceId = sheetId;
        if (rowOffset > 0) {
            r._sheetRow = (r._sheetRow || 0) + rowOffset;
        }
        if (!r._sheetRows) {
            const sheetRows = {};
            sheetRows[r._sourceId || 'default'] = r._sheetRow || defaultRowFallback;
            r._sheetRows = JSON.stringify(sheetRows);
        }
    });
    return rows;
}

/**
 * Probes primary and fallback tabs of a Google Sheet in parallel, extracting data rows and outgoing links.
 *
 * @param {string} sheetId - Google Sheets document ID
 * @param {boolean} [bypassCache=false] - Whether to bypass HTTP cache
 * @param {string} [sheetTag=''] - Optional branch sheet tag name to probe as tab
 * @returns {Promise<{ sheetId: string, rows: Array<Object>, links: Array<{ id: string, tag: string|null }>, extractedCount: number }>}
 *
 * @example
 * const res = await fetchSingleSheetParallel('1abc...', false);
 * // => { sheetId: '1abc...', rows: [...], links: [...], extractedCount: 50 }
 *
 * @example
 * const resWithTag = await fetchSingleSheetParallel('1abc...', true, 'Branch');
 * // => { sheetId: '1abc...', rows: [...], links: [...], extractedCount: 20 }
 */
async function fetchSingleSheetParallel(sheetId, bypassCache = false, sheetTag = '') {
    // Fast probe: check default tab and 'Links' in parallel first
    const primaryTabs = ['', 'Links'];
    const primaryResults = await Promise.all(primaryTabs.map(async tab => {
        const text = await fetchCSVData(sheetId, tab, 8000, bypassCache);
        return { tab, text };
    }));

    let tabResults = [...primaryResults];

    const hasDataInPrimary = primaryResults.some(({ text }) => hasGenealogicalHeaders(text));

    // If no data rows found in primary tabs, probe fallback tabs in parallel
    if (!hasDataInPrimary) {
        const cleanTag = sheetTag && !['Root sheet', 'Data sheet'].includes(sheetTag) ? sheetTag.trim() : '';
        const fallbackTabs = ['Data', 'Family', 'Sheet1'];
        if (cleanTag && !fallbackTabs.includes(cleanTag)) {
            fallbackTabs.unshift(cleanTag);
        }
        const fallbackResults = await Promise.all(fallbackTabs.map(async tab => {
            const text = await fetchCSVData(sheetId, tab, 8000, bypassCache);
            return { tab, text };
        }));
        tabResults = [...tabResults, ...fallbackResults];
    }

    const { rows, links, extractedCount } = processFetchedTabResults(tabResults, sheetId);
    return { sheetId, rows, links, extractedCount };
}

/**
 * Processes fetched CSV tab contents, extracting unique outgoing sheet links
 * and first available genealogical data rows.
 *
 * @example
 * processFetchedTabResults([{ tab: '', text: 'ID,Name\n1,John' }], 'sheet123');
 * // => { rows: [...], links: [], extractedCount: 1 }
 *
 * @example
 * processFetchedTabResults([], 'sheet123');
 * // => { rows: [], links: [], extractedCount: 0 }
 *
 * @param {Array<{ tab: string, text: string }>} tabResults - Fetched tab outputs
 * @param {string} sheetId - Current sheet identifier
 * @returns {{ rows: Array<Object>, links: Array<{ id: string, tag: string|null }>, extractedCount: number }}
 */
function processFetchedTabResults(tabResults, sheetId) {
    let rows = [];
    const links = [];
    let extractedCount = 0;

    for (const { tab, text } of tabResults) {
        if (!text) continue;

        const tabLinks = extractLinkedSheetIds(text, sheetId);
        for (const tl of tabLinks) {
            if (!links.some(l => l.id === tl.id)) links.push(tl);
        }

        if (rows.length === 0) {
            const parsedRows = extractGenealogicalRows(text, sheetId);
            if (parsedRows.length > 0) {
                rows = parsedRows;
                extractedCount = parsedRows.length;
            }
        }
    }

    return { rows, links, extractedCount };
}

/**
 * Extracts a Google Spreadsheet ID token (35-60 alphanumeric characters with hyphens or underscores)
 * from a given URL or raw identifier string.
 *
 * @param {string} url - Input Google Sheets URL or raw sheet ID string.
 * @returns {string|null} Extracted spreadsheet ID string, or null if invalid.
 *
 * @example
 * extractSheetIdFromUrl("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit");
 * // => "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
 *
 * @example
 * extractSheetIdFromUrl("invalid-short-url");
 * // => null
 */
function extractSheetIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/[a-zA-Z0-9-_]{35,60}/);
    return match ? match[0] : null;
}

/**
 * Attempts to load and construct a family tree instance from the local TreeDataCache for instant first paint.
 *
 * @param {string} sheetUrl - Target spreadsheet URL.
 * @param {Function} appendLog - Callback to append log messages.
 * @returns {FamilyTree|null} Cached tree instance, or null if not cached or construction fails.
 *
 * @example
 * const cached = loadTreeFromCache("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", appendLog);
 *
 * @example
 * const noCache = loadTreeFromCache("https://invalid-url", appendLog);
 * // => null
 */
function loadTreeFromCache(sheetUrl, appendLog) {
    const tCacheStart = performance.now();
    const cached = TreeDataCache.get(sheetUrl);
    if (cached && cached.rows && cached.rows.length > 0) {
        try {
            const cachedBuilder = new FamilyTreeBuilder(cached.rows, cached.sheetTags || {});
            const cachedTree = cachedBuilder.build();
            const cacheDurationMs = Math.round(performance.now() - tCacheStart);
            appendLog(<span>⚡ Loaded <b>{cached.rows.length} profiles</b> instantly from cache in <b>{cacheDurationMs}ms</b>. Synchronizing live data in background...</span>, 'info');
            return cachedTree;
        } catch (e) {
            console.log("Cached tree build failed:", e);
        }
    }
    return null;
}

/**
 * Registers unvisited linked sheet IDs into the sheet tree node and tags mapping.
 *
 * @param {Array<{ id: string, tag?: string }>} links - Newly discovered links.
 * @param {Set<string>} visited - Set of visited sheet IDs.
 * @param {Object} sheetTags - Target map of sheet IDs to tags.
 * @param {Object} parentNode - The parent tree node to attach child sheet descriptors to.
 *
 * @example
 * registerUnvisitedSheetLinks([{ id: 'sheet-2', tag: 'Spouse sheet' }], visited, sheetTags, rootTreeNode);
 *
 * @example
 * registerUnvisitedSheetLinks([], visited, sheetTags, rootTreeNode);
 */
function registerUnvisitedSheetLinks(links, visited, sheetTags, parentNode) {
    const unvisitedLinks = links.filter(l => !visited.has(l.id));
    unvisitedLinks.forEach(l => {
        visited.add(l.id);
        const tag = l.tag || 'Data sheet';
        sheetTags[l.id] = tag;
        parentNode.children.push({
            id: l.id,
            tag,
            status: 'loading',
            count: 0,
            children: []
        });
    });
}

/**
 * Builds and sets an initial preliminary tree if streaming root rows without cache.
 *
 * @param {Array<Object>} rows - Current accumulated rows.
 * @param {Object} sheetTags - Mapping of sheet IDs to tags.
 * @param {Function} setTree - State setter for the family tree.
 *
 * @example
 * renderPreliminaryRootTree(allRows, sheetTags, setTree);
 *
 * @example
 * renderPreliminaryRootTree([], {}, setTree);
 */
function renderPreliminaryRootTree(rows, sheetTags, setTree) {
    try {
        const tempBuilder = new FamilyTreeBuilder(rows, sheetTags);
        const tempTree = tempBuilder.build();
        setTree(tempTree);
    } catch (e) {}
}

/**
 * Updates node status, registers unvisited sheet links, and invokes preliminary root callback.
 *
 * @param {object} params - Parameters object.
 * @param {object} params.node - Target sheet node.
 * @param {object} params.res - Sheet fetch result.
 * @param {boolean} params.isRoot - Whether node is root sheet.
 * @param {Set<string>} params.visited - Visited sheet IDs set.
 * @param {object} params.sheetTags - Sheet tags lookup map.
 * @param {boolean} params.background - Whether running in background.
 * @param {boolean} params.hasLoadedFromCache - Whether loaded from cache.
 * @param {Function|null} params.onPreliminaryRoot - Preliminary callback.
 * @param {Array<object>} params.allRows - Accumulated row objects.
 *
 * @example
 * handleSheetNodeResults({
 *   node: { id: 's1', count: 0 },
 *   res: { extractedCount: 10, links: [] },
 *   isRoot: true,
 *   visited: new Set(['s1']),
 *   sheetTags: {},
 *   background: false,
 *   hasLoadedFromCache: false,
 *   onPreliminaryRoot: () => {},
 *   allRows: []
 * });
 *
 * @example
 * handleSheetNodeResults({
 *   node: { id: 's2', count: 0 },
 *   res: { extractedCount: 0, links: [] },
 *   isRoot: false,
 *   visited: new Set(),
 *   sheetTags: {},
 *   background: true,
 *   hasLoadedFromCache: true,
 *   onPreliminaryRoot: null,
 *   allRows: []
 * });
 */
function handleSheetNodeResults({
    node, res, isRoot, visited, sheetTags, background, hasLoadedFromCache, onPreliminaryRoot, allRows
}) {
    node.count = res.extractedCount;
    node.status = res.extractedCount > 0 ? 'success' : 'warning';
    if (!background && !hasLoadedFromCache && isRoot && allRows.length > 0 && onPreliminaryRoot) {
        onPreliminaryRoot(allRows);
    }
    registerUnvisitedSheetLinks(res.links, visited, sheetTags, node);
}

/**
 * Crawls a tree of linked Google Sheets starting from rootTreeNode, loading and aggregating all rows.
 *
 * Traverses sheet nodes recursively, fetching sheets in parallel, registering
 * extracted child links into the tree, and reporting progress via onRefreshTreeInLogs.
 *
 * @param {Object} options - Configuration options for crawling linked spreadsheets
 * @param {Object} options.rootTreeNode - Root sheet tree node with id and children array
 * @param {Set<string>} options.visited - Set of visited sheet IDs to avoid cycles
 * @param {Object} options.sheetTags - Map from sheet ID to sheet display tag/name
 * @param {boolean} [options.skipCache=false] - Whether to bypass local cache
 * @param {boolean} [options.background=false] - Whether this is a silent background sync
 * @param {boolean} [options.hasLoadedFromCache=false] - Whether preliminary cache data was loaded
 * @param {Function} [options.onPreliminaryRoot] - Callback invoked with root rows for preliminary tree render
 * @param {Function} [options.onRefreshTreeInLogs] - Callback to update the live tree representation in logs
 * @returns {Promise<Array<Object>>} Aggregated raw row objects across all traversed sheets
 *
 * @example
 * const rows = await crawlLinkedSpreadsheets({
 *   rootTreeNode: { id: 'root', tag: 'Main', children: [] },
 *   visited: new Set(),
 *   sheetTags: { root: 'Main' }
 * });
 *
 * @example
 * const rows = await crawlLinkedSpreadsheets({
 *   rootTreeNode: { id: 'sheet2', tag: 'Sub', children: [] },
 *   visited: new Set(),
 *   sheetTags: { sheet2: 'Sub' },
 *   skipCache: true,
 *   background: false
 * });
 */
async function crawlLinkedSpreadsheets(options) {
    const {
        rootTreeNode, visited, sheetTags, skipCache = false, background = false,
        hasLoadedFromCache = false, onPreliminaryRoot = null, onRefreshTreeInLogs = null
    } = options;
    let allRows = [];

    const processSheetNode = async (node, isRoot = false) => {
        visited.add(node.id);
        node.status = 'loading';
        if (onRefreshTreeInLogs) onRefreshTreeInLogs();

        let res = await fetchSingleSheetParallel(node.id, background || skipCache, node.tag);
        if (!isRoot && res.extractedCount === 0 && res.links.length === 0) {
            const retryRes = await fetchSingleSheetParallel(node.id, true, node.tag);
            if (retryRes.extractedCount > 0 || retryRes.links.length > 0) {
                res = retryRes;
            }
        }

        if (res.rows && res.rows.length > 0) allRows = [...allRows, ...res.rows];
        handleSheetNodeResults({
            node, res, isRoot, visited, sheetTags, background, hasLoadedFromCache, onPreliminaryRoot, allRows
        });
        if (onRefreshTreeInLogs) onRefreshTreeInLogs();

        if (node.children.length > 0) {
            await Promise.all(node.children.map(child => processSheetNode(child, false)));
        }
        if (onRefreshTreeInLogs) onRefreshTreeInLogs();
    };

    await processSheetNode(rootTreeNode, true);
    return allRows;
}