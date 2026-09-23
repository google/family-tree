
/**
 * Manages application activity logs, including entry formatting, timestamps, and live log updates.
 *
 * @returns {{
 *   logs: Array<Object>,
 *   setLogs: React.Dispatch<React.SetStateAction<Array<Object>>>,
 *   appendLog: Function,
 *   updateLog: Function
 * }}
 *
 * @example
 * const { logs, appendLog, updateLog } = useAppLogs();
 * appendLog("Loaded dataset", "success");
 *
 * @example
 * const { logs, setLogs } = useAppLogs();
 */
function useAppLogs() {
    const [logs, setLogs] = useState([]);

    const appendLog = useCallback((msg, type = 'info', id = null, prefix = '') => {
        const logId = id || Date.now() + Math.random().toString();
        setLogs(prev => [...prev, { id: logId, time: new Date().toLocaleTimeString([], { hour12: false }), msg, type, prefix }]);
        return logId;
    }, []);

    const updateLog = useCallback((id, msg, type = 'info') => {
        setLogs(prev => prev.map(log => log.id === id ? { ...log, msg, type } : log));
    }, []);

    return { logs, setLogs, appendLog, updateLog };
}

/**
 * Applies a newly constructed family tree model to state, handling background updates,
 * focus reset, and logging of validation/audit metrics.
 *
 * @param {Object} params
 * @param {FamilyTree} params.newTree - The freshly built family tree instance
 * @param {boolean} params.background - Whether this update was run as a background revalidation
 * @param {Function|null} params.onBackgroundUpdate - Optional callback for custom background updates
 * @param {Function} params.setTree - State setter for the active tree
 * @param {Function} params.setFocusId - State setter for the active person focus
 * @param {string} params.startId - Root sheet identifier
 * @param {Object} params.sheetTags - Map of sheet IDs to human-readable names
 * @param {Function} params.appendLog - Activity logger function
 * @param {number} params.allRowsCount - Total rows parsed across all sheets
 * @param {number} params.visitedCount - Total number of sheets visited
 * @param {{ fetchTimeSec: string, buildTimeMs: number, totalTimeSec: string }} params.timing - Fetch and build performance metrics
 * @returns {void}
 *
 * @example
 * applyConstructedTree({
 *   newTree: treeInstance,
 *   background: false,
 *   onBackgroundUpdate: null,
 *   setTree,
 *   setFocusId,
 *   startId: 'sheet-123',
 *   sheetTags: { 'sheet-123': 'Root sheet' },
 *   appendLog: (msg, type) => console.log(msg),
 *   allRowsCount: 150,
 *   visitedCount: 1,
 *   timing: { fetchTimeSec: '0.45', buildTimeMs: 12, totalTimeSec: '0.46' }
 * });
 *
 * @example
 * applyConstructedTree({
 *   newTree: treeInstance,
 *   background: true,
 *   onBackgroundUpdate: (t) => console.log('Updated', t),
 *   setTree,
 *   setFocusId,
 *   startId: 'sheet-123',
 *   sheetTags: {},
 *   appendLog: () => {},
 *   allRowsCount: 0,
 *   visitedCount: 1,
 *   timing: { fetchTimeSec: '0.1', buildTimeMs: 2, totalTimeSec: '0.1' }
 * });
 */
function applyConstructedTree({
    newTree, background, onBackgroundUpdate, setTree, setFocusId,
    startId, sheetTags, appendLog, allRowsCount, visitedCount, timing
}) {
    if (background) {
        if (typeof onBackgroundUpdate === 'function') {
            onBackgroundUpdate(newTree);
        } else {
            setTree(prev => {
                if (prev?.rootId && newTree.get(prev.rootId)) {
                    newTree.rootId = prev.rootId;
                }
                return newTree;
            });
            setFocusId(prev => (prev && newTree.get(prev) ? prev : null));
        }
    } else {
        setTree(newTree);
        setFocusId(null);
        logTreeAuditResults({
            newTree, startId, sheetTags, appendLog,
            allRowsCount, visitedCount, timing
        });
    }
}

/**
 * Coordinates recursive discovery and parallel crawling of linked spreadsheet trees,
 * reporting real-time hierarchical progress into the audit logs.
 *
 * @param {Object} options
 * @param {string} options.startId - Root sheet identifier
 * @param {boolean} options.skipCache - Whether to bypass local storage cache
 * @param {boolean} options.background - Whether run is an unobtrusive background refresh
 * @param {boolean} options.hasLoadedFromCache - Whether initial data came from cache
 * @param {Function} options.setLogs - State setter for audit logs
 * @param {Function} options.setTree - State setter for preliminary tree updates
 * @returns {Promise<{ allRows: Array<Object>, visited: Set<string>, sheetTags: Object }>}
 *
 * @example
 * const { allRows, visited, sheetTags } = await executeSpreadsheetCrawl({
 *   startId: 'sheet1',
 *   skipCache: false,
 *   background: false,
 *   hasLoadedFromCache: false,
 *   setLogs: () => {},
 *   setTree: () => {}
 * });
 *
 * @example
 * const { allRows } = await executeSpreadsheetCrawl({
 *   startId: 'sheetRoot',
 *   skipCache: true,
 *   background: true,
 *   hasLoadedFromCache: true,
 *   setLogs: setLogState,
 *   setTree: setTreeState
 * });
 */
async function executeSpreadsheetCrawl({
    startId, skipCache, background, hasLoadedFromCache, setLogs, setTree
}) {
    const visited = new Set();
    const sheetTags = { [startId]: 'Root sheet' };
    const rootTreeNode = { id: startId, tag: 'Root sheet', status: 'loading', count: 0, children: [] };

    const refreshTreeInLogs = () => {
        if (background) return;
        const lines = flattenSheetTree(rootTreeNode);
        setLogs(prev => mergeTreeLogEntries(prev, buildSheetTreeLogItems(lines)));
    };

    const allRows = await crawlLinkedSpreadsheets({
        rootTreeNode, visited, sheetTags, skipCache, background, hasLoadedFromCache,
        onPreliminaryRoot: (rootRows) => renderPreliminaryRootTree(rootRows, sheetTags, setTree),
        onRefreshTreeInLogs: refreshTreeInLogs
    });
    return { allRows, visited, sheetTags };
}

/**
 * Checks whether rows match the previous fingerprint during background synchronization.
 *
 * @param {Array<Object>} allRows - Extracted spreadsheet profile rows
 * @param {boolean} background - Whether background sync is active
 * @param {React.MutableRefObject<string>} lastDataFingerprintRef - Ref storing hash of last imported dataset
 * @returns {boolean} True if data is unchanged in background sync, false otherwise
 *
 * @example
 * const unchanged = checkDataFingerprintUnchanged(rows, true, { current: 'hash123' });
 *
 * @example
 * const unchanged = checkDataFingerprintUnchanged(rows, false, { current: '' });
 */
function checkDataFingerprintUnchanged(allRows, background, lastDataFingerprintRef) {
    sortSpreadsheetRows(allRows);
    const newFingerprint = computeDataFingerprint(allRows);
    if (background && lastDataFingerprintRef.current && lastDataFingerprintRef.current === newFingerprint) {
        return true;
    }
    lastDataFingerprintRef.current = newFingerprint;
    return false;
}

/**
 * Constructs a FamilyTree instance from spreadsheet rows and measures build and total timing.
 *
 * @param {Array<Object>} allRows - Extracted spreadsheet profile rows
 * @param {Object} sheetTags - Map of sheet IDs to sheet tags/names
 * @param {number} tFetchStart - Fetch start timestamp from performance.now()
 * @returns {{ newTree: FamilyTree, buildTimeMs: number, totalTimeSec: string }}
 *
 * @example
 * const { newTree, buildTimeMs, totalTimeSec } = buildAndMeasureTreeModel(rows, tags, performance.now() - 500);
 *
 * @example
 * const { newTree } = buildAndMeasureTreeModel([], {}, performance.now());
 */
function buildAndMeasureTreeModel(allRows, sheetTags, tFetchStart) {
    const tBuildStart = performance.now();
    const builder = new FamilyTreeBuilder(allRows, sheetTags);
    const newTree = builder.build();
    const tBuildEnd = performance.now();
    const buildTimeMs = Math.round(tBuildEnd - tBuildStart);
    const totalTimeSec = ((tBuildEnd - tFetchStart) / 1000).toFixed(2);
    return { newTree, buildTimeMs, totalTimeSec };
}

/**
 * Orchestrates parallel spreadsheet crawling, determinism sorting, cache caching, and tree construction.
 *
 * Logs introductory diagnostic details when starting a direct URL tree import.
 *
 * @param {Function} appendLog - Activity log append callback
 * @param {string} startId - Initial root spreadsheet identifier
 * @param {boolean} hasLoadedFromCache - Whether tree data was already loaded from local cache
 * @param {boolean} background - Whether the crawl runs as a background operation
 *
 * @example
 * logUrlImportStart(appendLog, 'root123', false, false);
 *
 * @example
 * logUrlImportStart(appendLog, 'root123', true, false);
 */
function logUrlImportStart(appendLog, startId, hasLoadedFromCache, background) {
    if (!hasLoadedFromCache && !background && appendLog) {
        appendLog('Initializing parallel import from URL...', 'info');
        appendLog(`Root ID: ${startId}`, 'success');
    }
}

/**
 * Orchestrates the full lifecycle of importing and compiling a family tree from a root Google Sheets URL.
 *
 * Fetches all linked spreadsheets concurrently, detects content differences, parses genealogical models,
 * caches the resulting dataset, and applies UI state transitions.
 *
 * @param {Object} options
 * @param {string} options.startId - Root sheet identifier
 * @param {string} options.sheetUrl - Complete source spreadsheet URL
 * @param {boolean} options.skipCache - Whether to bypass local cache
 * @param {boolean} options.background - Whether import is executed in silent background sync mode
 * @param {boolean} options.hasLoadedFromCache - Whether previous data was successfully hydrated from cache
 * @param {Function} [options.onBackgroundUpdate] - Optional callback triggered on background updates
 * @param {React.MutableRefObject} options.lastDataFingerprintRef - Ref storing previous data fingerprint
 * @param {FamilyTree} options.tree - Current active family tree model instance
 * @param {Function} options.setTree - State setter for active tree model
 * @param {Function} options.setFocusId - State setter for focused person node ID
 * @param {Function} options.setLogs - State setter for application event logs
 * @param {Function} options.appendLog - Function to record a single log entry
 * @returns {Promise<{ changed: boolean, rootId: string|null }>} Result indicating change status and root ID
 *
 * @example
 * const res = await executeUrlTreeImport({
 *   startId: 'sheet123',
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet123',
 *   skipCache: false,
 *   background: false,
 *   hasLoadedFromCache: false,
 *   lastDataFingerprintRef: { current: null },
 *   tree: null,
 *   setTree: () => {},
 *   setFocusId: () => {},
 *   setLogs: () => {},
 *   appendLog: () => {}
 * });
 *
 * @example
 * const res = await executeUrlTreeImport({
 *   startId: 'sheet456',
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet456',
 *   skipCache: true,
 *   background: true,
 *   hasLoadedFromCache: true,
 *   lastDataFingerprintRef: { current: 'abc' },
 *   tree: currentTree,
 *   setTree: updateTree,
 *   setFocusId: updateFocus,
 *   setLogs: updateLogs,
 *   appendLog: addLog
 * });
 */
async function executeUrlTreeImport({
    startId, sheetUrl, skipCache, background, hasLoadedFromCache,
    onBackgroundUpdate, lastDataFingerprintRef, tree, setTree, setFocusId, setLogs, appendLog
}) {
    const tFetchStart = performance.now();
    logUrlImportStart(appendLog, startId, hasLoadedFromCache, background);

    const { allRows, visited, sheetTags } = await executeSpreadsheetCrawl({
        startId, skipCache, background, hasLoadedFromCache, setLogs, setTree
    });

    const fetchTimeSec = ((performance.now() - tFetchStart) / 1000).toFixed(2);
    if (allRows.length === 0) throw new Error(`No valid data found across ${visited.size} linked spreadsheets checked.`);
    
    if (checkDataFingerprintUnchanged(allRows, background, lastDataFingerprintRef)) {
        return { changed: false, rootId: tree.rootId };
    }

    const { newTree, buildTimeMs, totalTimeSec } = buildAndMeasureTreeModel(allRows, sheetTags, tFetchStart);
    TreeDataCache.set(sheetUrl, allRows, sheetTags);

    applyConstructedTree({
        newTree, background, onBackgroundUpdate, setTree, setFocusId,
        startId, sheetTags, appendLog, allRowsCount: allRows.length,
        visitedCount: visited.size, timing: { fetchTimeSec, buildTimeMs, totalTimeSec }
    });

    return { changed: true, rootId: newTree.rootId };
}

/**
 * Attempts to load and apply a cached family tree for the given Google Sheets URL.
 *
 * @param {string} sheetUrl - Google Sheets URL to check in cache.
 * @param {Function} appendLog - Logger append callback.
 * @param {Function} setTree - State setter for family tree.
 * @returns {boolean} Whether a cached tree was found and applied.
 *
 * @example
 * const applied = tryApplyCachedTree('https://docs.google.com/...', console.log, () => {});
 *
 * @example
 * const applied = tryApplyCachedTree('https://sheets.google.com/...', () => {}, () => {});
 */
function tryApplyCachedTree(sheetUrl, appendLog, setTree) {
    const cachedTree = loadTreeFromCache(sheetUrl, appendLog);
    if (cachedTree) {
        setTree(cachedTree);
        return true;
    }
    return false;
}

/**
 * Resets loading, error, and log state when starting a non-background spreadsheet fetch.
 *
 * @param {Object} params
 * @param {boolean} params.background - Whether fetch is executing in background.
 * @param {Function} params.setIsLoading - Loading state setter.
 * @param {Function} params.setErrorMsg - Error message setter.
 * @param {Function} params.setLogs - Logs array setter.
 *
 * @example
 * resetFetchStatus({ background: false, setIsLoading, setErrorMsg, setLogs });
 *
 * @example
 * resetFetchStatus({ background: true, setIsLoading, setErrorMsg, setLogs });
 */
function resetFetchStatus({ background, setIsLoading, setErrorMsg, setLogs }) {
    if (!background) {
        setIsLoading(true);
        setErrorMsg('');
        setLogs([]);
    }
}

/**
 * Extracts and validates a Google Sheet ID from a URL, updating error state on invalid input.
 *
 * @param {string} sheetUrl - Remote spreadsheet URL.
 * @param {boolean} background - Whether fetch is in background.
 * @param {Function} setErrorMsg - Error message setter.
 * @param {Function} setIsLoading - Loading state setter.
 * @returns {string|null} Valid sheet ID or null.
 *
 * @example
 * const id = validateAndExtractSheetId('https://docs.google.com/spreadsheets/d/abc/edit', false, setErrorMsg, setIsLoading);
 *
 * @example
 * const invalid = validateAndExtractSheetId('invalid-url', true, setErrorMsg, setIsLoading);
 */
function validateAndExtractSheetId(sheetUrl, background, setErrorMsg, setIsLoading) {
    const startId = extractSheetIdFromUrl(sheetUrl);
    if (!startId && !background) {
        setErrorMsg("Invalid Google Sheets URL. Could not find a valid ID.");
        setIsLoading(false);
    }
    return startId || null;
}

/**
 * Prepares environment state, extracts sheet identifier, and attempts cache loading before network tree fetch.
 *
 * @param {Object} params
 * @param {string} params.sheetUrl - Google Sheets URL.
 * @param {Object} [params.options={}] - Fetch configuration options.
 * @param {Function} params.setIsLoading - State setter for loading status.
 * @param {Function} params.setErrorMsg - State setter for error message.
 * @param {Function} params.setLogs - State setter for log entries.
 * @param {Function} params.appendLog - Function to record log entry.
 * @param {Function} params.setTree - State setter for active tree dataset.
 * @returns {Object|null} Fetch parameters object, or null if start ID is invalid.
 *
 * @example
 * prepareDatasetFetch({
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/12345/edit',
 *   options: {},
 *   setIsLoading: () => {},
 *   setErrorMsg: () => {},
 *   setLogs: () => {},
 *   appendLog: () => {},
 *   setTree: () => {}
 * });
 *
 * @example
 * prepareDatasetFetch({
 *   sheetUrl: 'invalid-url',
 *   options: { background: true },
 *   setIsLoading: () => {},
 *   setErrorMsg: () => {},
 *   setLogs: () => {},
 *   appendLog: () => {},
 *   setTree: () => {}
 * });
 * // => null
 */
function prepareDatasetFetch({
    sheetUrl, options = {}, setIsLoading, setErrorMsg, setLogs, appendLog, setTree
}) {
    const { skipCache = false, background = false, onBackgroundUpdate = null } = options;
    if (!background) {
        setIsLoading(true);
        setErrorMsg('');
        setLogs([]);
    }
    const startId = extractSheetIdFromUrl(sheetUrl);
    if (!startId) {
        if (!background) {
            setErrorMsg("Invalid Google Sheets URL. Could not find a valid ID.");
            setIsLoading(false);
        }
        return null;
    }
    const hasLoadedFromCache = (!skipCache && !background)
        ? tryApplyCachedTree(sheetUrl, appendLog, setTree)
        : false;
    return { startId, skipCache, background, onBackgroundUpdate, hasLoadedFromCache };
}

/**
 * Initiates an end-to-end dataset fetch for a Google Sheet URL, handling cache, background polling, and tree updates.
 *
 * @param {Object} params - Parameter bundle
 * @param {string} params.sheetUrl - Target Google Sheets URL
 * @param {Object} [params.options={}] - Fetch configuration options
 * @param {boolean} [params.options.skipCache=false] - Whether to bypass cache
 * @param {boolean} [params.options.background=false] - Whether running as background refresh
 * @param {Function|null} [params.options.onBackgroundUpdate=null] - Callback invoked when background update finds newer data
 * @param {Function} params.setIsLoading - Loading state toggle
 * @param {Function} params.setErrorMsg - Error message setter
 * @param {Function} params.setLogs - Audit logs setter
 * @param {Function} params.appendLog - Log appending helper
 * @param {FamilyTree} params.tree - Active FamilyTree model instance
 * @param {Function} params.setTree - Tree state setter
 * @param {Function} params.setFocusId - Selected person ID setter
 * @param {React.MutableRefObject<string>} params.lastDataFingerprintRef - Ref storing last applied data fingerprint
 * @returns {Promise<boolean>} True if dataset was successfully fetched and applied
 *
 * @example
 * await fetchDatasetFromUrl({
 *   sheetUrl: 'https://docs.google.com/spreadsheets/d/123/edit',
 *   options: { skipCache: true },
 *   setIsLoading: () => {},
 *   setErrorMsg: () => {},
 *   setLogs: () => {},
 *   appendLog: () => {},
 *   tree: new FamilyTree(),
 *   setTree: () => {},
 *   setFocusId: () => {},
 *   lastDataFingerprintRef: { current: '' }
 * });
 *
 * @example
 * const success = await fetchDatasetFromUrl({
 *   sheetUrl: 'invalid-url',
 *   options: { background: true },
 *   setIsLoading: () => {},
 *   setErrorMsg: () => {},
 *   setLogs: () => {},
 *   appendLog: () => {},
 *   tree: new FamilyTree(),
 *   setTree: () => {},
 *   setFocusId: () => {},
 *   lastDataFingerprintRef: { current: 'abc' }
 * });
 */
async function fetchDatasetFromUrl({
    sheetUrl, options = {}, setIsLoading, setErrorMsg, setLogs,
    appendLog, tree, setTree, setFocusId, lastDataFingerprintRef
}) {
    const prep = prepareDatasetFetch({
        sheetUrl, options, setIsLoading, setErrorMsg, setLogs, appendLog, setTree
    });
    if (!prep) return false;
    const { startId, skipCache, background, onBackgroundUpdate, hasLoadedFromCache } = prep;
    try {
        return await executeUrlTreeImport({
            startId, sheetUrl, skipCache, background, hasLoadedFromCache,
            onBackgroundUpdate, lastDataFingerprintRef, tree, setTree,
            setFocusId, setLogs, appendLog
        });
    } catch (err) {
        if (!background) setErrorMsg(err.message);
        return false;
    } finally {
        if (!background) setIsLoading(false);
    }
}