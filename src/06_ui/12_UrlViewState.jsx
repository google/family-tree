// ============================================================================
// MODULE 6.12: SHAREABLE URL VIEW STATE (Google-Maps-style deep links)
// ============================================================================
//
// Every meaningful UI action is mirrored into a compact `#hash` fragment so the
// address bar can be copied to another computer and reproduce the same view:
//
//   https://google.github.io/family-tree/?id=1ZDpcz2…#p=Joseph_1920_152&z=0.8&c=1240,1953.5
//
//   Key  Meaning                                      Sample
//   ---  -------------------------------------------  ------------------------------
//   p    Focused person ID                            p=Joseph_1920_152
//   s    Sidebar closed while a person is focused     s=0
//   f    Active filter `<type>:<value>`               f=place:Kochi
//   v    Alternate view (world map)                   v=map
//   z    Camera zoom level (2 decimals)               z=0.8
//   c    Visible-viewport centre `<x>,<year>`         c=1240,1953.5
//   k    Collapsed branch IDs (comma separated)       k=Antu_1931_12,Elsy_1935_13
//
// Horizontal position is encoded in unscaled tree pixels (the same zoom level
// yields the same horizontal layout on every screen), while vertical position
// is encoded in calendar YEARS because pixels-per-year stretches with the
// viewport height. `?id=<sheetId>` stays a regular query parameter so sheet
// selection and view state never interfere with each other.

/** Debounce applied before mirroring UI state into the URL hash. */
const VIEW_STATE_WRITE_DEBOUNCE_MS = 300;
/** Delay after dataset readiness before restoring focus/filter/map from the hash. */
const VIEW_STATE_SELECTION_DELAY_MS = 350;
/** Delay after dataset readiness before restoring camera zoom/centre from the hash. */
const VIEW_STATE_CAMERA_DELAY_MS = 1000;

/**
 * Formats a number compactly for URL use by rounding to a fixed number of decimals
 * and dropping trailing zeros (so `0.80` becomes `0.8` and `1953.0` becomes `1953`).
 *
 * @param {number} value - Number to format.
 * @param {number} [decimals=2] - Maximum number of decimal places to keep.
 * @returns {string} Compact decimal string, or `'0'` for non-finite input.
 *
 * @example
 * formatCompactNumber(0.8000001, 2);
 * // => '0.8'
 *
 * @example
 * formatCompactNumber(1953.46, 1);
 * // => '1953.5'
 */
function formatCompactNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return '0';
    return String(Number(value.toFixed(decimals)));
}

/**
 * Percent-encodes a hash token so person IDs and filter values can never collide with the
 * `&`, `=`, `:` and `,` separators, while keeping spaces readable as `+`.
 *
 * @param {string} text - Raw token text.
 * @returns {string} URL-safe token.
 *
 * @example
 * encodeViewStateToken('Joseph_1920_152');
 * // => 'Joseph_1920_152'
 *
 * @example
 * encodeViewStateToken('New York, USA');
 * // => 'New+York%2C+USA'
 */
function encodeViewStateToken(text) {
    return encodeURIComponent(String(text)).replace(/%20/g, '+');
}

/**
 * Decodes a hash token produced by encodeViewStateToken, tolerating malformed percent
 * sequences typed by hand (they are returned verbatim instead of throwing).
 *
 * @param {string} text - Encoded token text.
 * @returns {string} Decoded token.
 *
 * @example
 * decodeViewStateToken('New+York%2C+USA');
 * // => 'New York, USA'
 *
 * @example
 * decodeViewStateToken('100%');
 * // => '100%'
 */
function decodeViewStateToken(text) {
    const spaced = String(text).replace(/\+/g, '%20');
    try {
        return decodeURIComponent(spaced);
    } catch (err) {
        return String(text);
    }
}

/**
 * Encodes the selection half of the view state (focused person, sidebar, filter, map).
 *
 * @param {Object} state - View state snapshot.
 * @param {string|null} [state.focusId] - Focused person ID.
 * @param {boolean} [state.isSidebarVisible] - Whether the person sidebar is open.
 * @param {{filterType: string, value: string}|null} [state.activeFilter] - Active filter.
 * @param {boolean} [state.showMap] - Whether the world map view is shown.
 * @returns {Array<string>} `key=value` fragments in canonical order.
 *
 * @example
 * encodeSelectionHashParts({ focusId: 'Joseph_1920_152', isSidebarVisible: false });
 * // => ['p=Joseph_1920_152', 's=0']
 *
 * @example
 * encodeSelectionHashParts({ activeFilter: { filterType: 'place', value: 'Kochi' }, showMap: true });
 * // => ['f=place:Kochi', 'v=map']
 */
function encodeSelectionHashParts(state) {
    const parts = [];
    if (state.focusId) {
        parts.push(`p=${encodeViewStateToken(state.focusId)}`);
        if (state.isSidebarVisible === false) parts.push('s=0');
    }
    const filter = state.activeFilter;
    if (filter && filter.filterType && filter.value) {
        parts.push(`f=${encodeViewStateToken(filter.filterType)}:${encodeViewStateToken(filter.value)}`);
    }
    if (state.showMap) parts.push('v=map');
    return parts;
}

/**
 * Encodes the camera half of the view state (zoom, visible centre, collapsed branches).
 *
 * @param {Object} state - View state snapshot.
 * @param {number} [state.zoom] - Camera zoom level.
 * @param {{x: number, year: number}} [state.center] - Visible-viewport centre.
 * @param {Array<string>} [state.collapsedIds] - Collapsed branch root IDs.
 * @returns {Array<string>} `key=value` fragments in canonical order.
 *
 * @example
 * encodeCameraHashParts({ zoom: 0.8, center: { x: 1240.4, year: 1953.46 } });
 * // => ['z=0.8', 'c=1240,1953.5']
 *
 * @example
 * encodeCameraHashParts({ collapsedIds: ['Antu_1931_12', 'Elsy_1935_13'] });
 * // => ['k=Antu_1931_12,Elsy_1935_13']
 */
function encodeCameraHashParts(state) {
    const parts = [];
    if (Number.isFinite(state.zoom) && state.zoom > 0) parts.push(`z=${formatCompactNumber(state.zoom, 2)}`);
    const center = state.center;
    if (center && Number.isFinite(center.x) && Number.isFinite(center.year)) {
        parts.push(`c=${Math.round(center.x)},${formatCompactNumber(center.year, 1)}`);
    }
    if (Array.isArray(state.collapsedIds) && state.collapsedIds.length > 0) {
        parts.push(`k=${state.collapsedIds.map(encodeViewStateToken).join(',')}`);
    }
    return parts;
}

/**
 * Serialises a view state snapshot into the compact URL hash body (without the leading `#`).
 * Only non-default values are emitted so the URL stays short.
 *
 * @param {Object} state - View state snapshot (see encodeSelectionHashParts / encodeCameraHashParts).
 * @returns {string} Hash body such as `p=Joseph_1920_152&z=0.8&c=1240,1953.5`, or `''` when empty.
 *
 * @example
 * encodeViewStateHash({ focusId: 'Joseph_1920_152', isSidebarVisible: true, zoom: 0.8, center: { x: 1240, year: 1953.5 } });
 * // => 'p=Joseph_1920_152&z=0.8&c=1240,1953.5'
 *
 * @example
 * encodeViewStateHash({});
 * // => ''
 */
function encodeViewStateHash(state) {
    if (!state) return '';
    return [...encodeSelectionHashParts(state), ...encodeCameraHashParts(state)].join('&');
}

/**
 * Parses the `f=<type>:<value>` filter entry of a view state hash.
 *
 * @param {string} value - Raw (still encoded) filter token.
 * @returns {{filterType: string, value: string}|null} Filter descriptor, or null when malformed.
 *
 * @example
 * parseViewStateFilterToken('place:New+York');
 * // => { filterType: 'place', value: 'New York' }
 *
 * @example
 * parseViewStateFilterToken('place');
 * // => null
 */
function parseViewStateFilterToken(value) {
    const sep = value.indexOf(':');
    if (sep <= 0 || sep === value.length - 1) return null;
    return {
        filterType: decodeViewStateToken(value.slice(0, sep)),
        value: decodeViewStateToken(value.slice(sep + 1))
    };
}

/**
 * Applies a single `key=value` hash entry onto a view state object being parsed.
 * Unknown keys and malformed numbers are ignored so hand-edited URLs degrade gracefully.
 *
 * @param {Object} state - Mutable view state accumulator.
 * @param {string} key - Hash key (`p`, `s`, `f`, `v`, `z`, `c`, or `k`).
 * @param {string} value - Raw (still encoded) value.
 * @returns {Object} The same state object for chaining.
 *
 * @example
 * applyViewStateHashEntry({}, 'c', '1240,1953.5');
 * // => { center: { x: 1240, year: 1953.5 } }
 *
 * @example
 * applyViewStateHashEntry({}, 'z', 'abc');
 * // => {}
 */
function applyViewStateHashEntry(state, key, value) {
    if (key === 'p') state.focusId = decodeViewStateToken(value);
    else if (key === 's') state.isSidebarVisible = value !== '0';
    else if (key === 'v') state.showMap = value === 'map';
    else if (key === 'f') {
        const filter = parseViewStateFilterToken(value);
        if (filter) state.activeFilter = filter;
    } else if (key === 'z') {
        const zoom = parseFloat(value);
        if (Number.isFinite(zoom) && zoom > 0) state.zoom = zoom;
    } else if (key === 'c') {
        const [x, year] = value.split(',').map((token) => parseFloat(token));
        if (Number.isFinite(x) && Number.isFinite(year)) state.center = { x, year };
    } else if (key === 'k') {
        state.collapsedIds = value.split(',').filter(Boolean).map(decodeViewStateToken);
    }
    return state;
}

/**
 * Parses a URL hash (with or without the leading `#`) back into a view state snapshot.
 *
 * @param {string} hash - Hash fragment such as `#p=Joseph_1920_152&z=0.8&c=1240,1953.5`.
 * @returns {Object} Partial view state; empty object when the hash carries no view state.
 *
 * @example
 * parseViewStateHash('#p=Joseph_1920_152&s=0&z=0.8&c=1240,1953.5');
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: false, zoom: 0.8, center: { x: 1240, year: 1953.5 } }
 *
 * @example
 * parseViewStateHash('');
 * // => {}
 */
function parseViewStateHash(hash) {
    const body = String(hash || '').replace(/^#/, '');
    const state = {};
    if (!body) return state;
    body.split('&').forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq > 0) applyViewStateHashEntry(state, pair.slice(0, eq), pair.slice(eq + 1));
    });
    return state;
}

/**
 * Converts the camera transform into a screen-independent visible-viewport centre:
 * horizontal position in unscaled tree pixels and vertical position in calendar years.
 *
 * @param {Object} params
 * @param {{x: number, y: number, z: number}} params.camera - Current camera transform.
 * @param {number} params.ppy - Current pixels-per-year of the timeline.
 * @param {number} params.rootNodeYob - Birth year anchoring the top of the timeline.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, year: number}} Visible centre in tree pixels and years.
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: -600, y: -200, z: 1 }, ppy: 10, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 1148, year: 1957.6 }
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: 48, y: 24, z: 0.5 }, ppy: 8, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 });
 * // => { x: 1000, year: 1991 }
 */
function computeViewCenterFromCamera({ camera, ppy, rootNodeYob, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const zoom = camera.z || 1;
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    const worldX = (centerScreenX - camera.x) / zoom;
    const worldY = (centerScreenY - camera.y) / zoom;
    return { x: worldX, year: rootNodeYob + (worldY - 24) / (ppy || 8) };
}

/**
 * Inverse of computeViewCenterFromCamera: derives the camera transform that places the given
 * tree-pixel / calendar-year centre in the middle of the visible viewport at the requested zoom.
 *
 * @param {Object} params
 * @param {{x: number, year: number}} params.center - Desired visible centre.
 * @param {number} params.zoom - Desired camera zoom level.
 * @param {number} params.ppy - Pixels-per-year the timeline uses at `zoom` on this screen.
 * @param {number} params.rootNodeYob - Birth year anchoring the top of the timeline.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, y: number, z: number}} Camera transform.
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1148, year: 1957.6 }, zoom: 1, ppy: 10, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: -600, y: -200, z: 1 }
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1000, year: 1991 }, zoom: 0.5, ppy: 8, rootNodeYob: 1900, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 48, y: 24, z: 0.5 }
 */
function computeCameraFromViewCenter({ center, zoom, ppy, rootNodeYob, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    const worldY = (center.year - rootNodeYob) * ppy + 24;
    return { x: centerScreenX - center.x * zoom, y: centerScreenY - worldY * zoom, z: zoom };
}

/**
 * Resolves a person ID from a shared URL against the loaded tree. Falls back to a
 * `<name>_<yob>_` prefix match so links survive spreadsheet row insertions that shift
 * the trailing raw row number of generated IDs.
 *
 * @param {FamilyTree} tree - Loaded family tree.
 * @param {string|null|undefined} personId - Person ID from the URL hash.
 * @returns {string|null} A valid person ID in `tree`, or null when nobody matches.
 *
 * @example
 * resolveViewStatePersonId(tree, 'Joseph_1920_152');
 * // => 'Joseph_1920_152'
 *
 * @example
 * // A row was inserted above Joseph, so the tree now holds Joseph_1920_153
 * resolveViewStatePersonId(tree, 'Joseph_1920_152');
 * // => 'Joseph_1920_153'
 */
function resolveViewStatePersonId(tree, personId) {
    if (!tree || !personId) return null;
    if (tree.get(personId)) return personId;
    const prefix = personId.replace(/[^_]*$/, '');
    if (!prefix) return null;
    const match = (tree.all || []).find((p) => p && typeof p.id === 'string' && p.id.startsWith(prefix));
    return match ? match.id : null;
}

/**
 * Predicts whether a sidebar panel will be open once a parsed view state has been applied,
 * which determines the visible canvas width used to place the restored centre.
 *
 * @param {Object} state - Parsed view state.
 * @returns {boolean} True when a person panel, filter list, or map directory will be open.
 *
 * @example
 * resolveRestoredSidebarOpen({ focusId: 'Joseph_1920_152' });
 * // => true
 *
 * @example
 * resolveRestoredSidebarOpen({ focusId: 'Joseph_1920_152', isSidebarVisible: false });
 * // => false
 */
function resolveRestoredSidebarOpen(state) {
    if (!state) return false;
    if (state.showMap || state.activeFilter) return true;
    return Boolean(state.focusId) && state.isSidebarVisible !== false;
}

/**
 * Measures the canvas area that is actually visible to the user (the sidebar overlays the
 * right edge of the full-width canvas) together with the timeline gutter width.
 *
 * @param {Object} params
 * @param {HTMLElement|null} params.container - Canvas container element.
 * @param {boolean} params.isSidebarOpen - Whether any sidebar panel is open.
 * @param {number} params.sidebarWidth - Sidebar width in pixels.
 * @returns {{visibleWidth: number, visibleHeight: number, timelineWidth: number}}
 *
 * @example
 * measureViewStateViewport({ container: containerRef.current, isSidebarOpen: false, sidebarWidth: 360 });
 * // => { visibleWidth: 1440, visibleHeight: 900, timelineWidth: 48 }
 *
 * @example
 * measureViewStateViewport({ container: null, isSidebarOpen: true, sidebarWidth: 400 });
 * // => { visibleWidth: 1040, visibleHeight: 900, timelineWidth: 48 }
 */
function measureViewStateViewport({ container, isSidebarOpen, sidebarWidth }) {
    const { contW, contH } = resolveViewportDimensions({ container, isSidebarOpen, sidebarWidth });
    return { visibleWidth: contW, visibleHeight: contH, timelineWidth: isStandaloneExportMode() ? 0 : 48 };
}

/**
 * Captures the live application state as a serialisable view state snapshot. Camera details are
 * omitted while the map view is shown because the tree canvas is hidden there.
 *
 * @param {Object} params
 * @param {string|null} params.focusId - Focused person ID.
 * @param {boolean} params.isSidebarVisible - Whether the person sidebar is open.
 * @param {Object|null} params.activeFilter - Active filter descriptor.
 * @param {boolean} params.showMap - Whether the map view is shown.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {number} params.ppy - Current pixels-per-year.
 * @param {number} params.rootNodeYob - Timeline anchor year.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} params.viewport - Measured viewport.
 * @param {Set<string>|Array<string>} params.collapsedNodes - Collapsed branch IDs.
 * @returns {Object} View state snapshot accepted by encodeViewStateHash.
 *
 * @example
 * buildCurrentViewState({ focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 *   camera: { x: -600, y: -200, z: 1 }, ppy: 10, rootNodeYob: 1900,
 *   viewport: { visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 }, collapsedNodes: new Set() });
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 * //      zoom: 1, center: { x: 1148, year: 1957.6 }, collapsedIds: [] }
 *
 * @example
 * encodeViewStateHash(buildCurrentViewState({ ...liveState, showMap: true }));
 * // => 'v=map'
 */
function buildCurrentViewState({ focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, rootNodeYob, viewport, collapsedNodes }) {
    const center = showMap ? null : computeViewCenterFromCamera({ camera, ppy, rootNodeYob, ...viewport });
    return {
        focusId: focusId || null,
        isSidebarVisible: Boolean(isSidebarVisible),
        activeFilter: activeFilter || null,
        showMap: Boolean(showMap),
        zoom: showMap ? null : camera.z,
        center,
        collapsedIds: Array.from(collapsedNodes || [])
    };
}

/**
 * Mirrors the given hash body into the address bar without reloading or adding history entries,
 * so the browser back button keeps working as before. No-op when the hash is already current.
 *
 * @param {string} hashBody - Hash body without `#` (empty string clears the hash).
 * @returns {boolean} True when the address bar was updated.
 *
 * @example
 * writeViewStateHash('p=Joseph_1920_152&z=0.8&c=1240,1953.5');
 * // address bar => https://google.github.io/family-tree/?id=1ZDpc…#p=Joseph_1920_152&z=0.8&c=1240,1953.5
 *
 * @example
 * writeViewStateHash('');
 * // => false when the URL already has no hash
 */
function writeViewStateHash(hashBody) {
    if (typeof window === 'undefined' || !window.history || !window.location) return false;
    const target = hashBody ? `#${hashBody}` : '';
    if ((window.location.hash || '') === target) return false;
    try {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${target}`);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Re-applies the focused person (and sidebar visibility) from a shared view state.
 *
 * @param {Object} state - Parsed view state.
 * @param {Object} actions - Live application handlers (`tree`, `handleSetFocusId`, `setIsSidebarVisible`).
 * @returns {boolean} True when a person was focused.
 *
 * @example
 * applyRestoredFocus({ focusId: 'Joseph_1920_152', isSidebarVisible: false }, actions);
 * // => true  (focuses Joseph, then hides the sidebar)
 *
 * @example
 * applyRestoredFocus({ focusId: 'Nobody_unk_0' }, actions);
 * // => false (unknown person is ignored)
 */
function applyRestoredFocus(state, actions) {
    const personId = resolveViewStatePersonId(actions.tree, state.focusId);
    if (!personId) return false;
    actions.handleSetFocusId(personId);
    if (state.isSidebarVisible === false) actions.setIsSidebarVisible(false);
    return true;
}

/**
 * Re-applies the selection half of a shared view state (map, filter, focused person,
 * sidebar visibility, collapsed branches) through the regular UI action handlers so
 * navigation history, re-rooting, and panel coordination behave exactly like user clicks.
 *
 * @param {Object} state - Parsed view state.
 * @param {Object} actions - Live application handlers and setters.
 * @param {FamilyTree} actions.tree - Loaded tree.
 * @param {Function} actions.handleSetFocusId - Person focus handler.
 * @param {Function} actions.handleFilterBy - Filter activation handler.
 * @param {Function} actions.setShowMap - Map visibility setter.
 * @param {Function} actions.setIsSidebarVisible - Sidebar visibility setter.
 * @param {Function} actions.setActiveFilter - Active filter setter.
 * @param {Function} actions.setFocusId - Focus ID setter.
 * @param {Function} actions.setCollapsedNodes - Collapsed node set setter.
 * @returns {boolean} True when any selection was applied.
 *
 * @example
 * applyRestoredSelection({ activeFilter: { filterType: 'place', value: 'Kochi' } }, actions);
 * // => true  (opens the Kochi filter list)
 *
 * @example
 * applyRestoredSelection({ zoom: 0.8 }, actions);
 * // => false (nothing to select; camera is handled separately)
 */
function applyRestoredSelection(state, actions) {
    let applied = false;
    if (state.showMap) {
        actions.setShowMap(true);
        actions.setIsSidebarVisible(true);
        actions.setActiveFilter(null);
        actions.setFocusId(null);
        applied = true;
    }
    if (state.activeFilter) {
        actions.handleFilterBy(state.activeFilter.filterType, state.activeFilter.value);
        applied = true;
    } else if (!state.showMap && applyRestoredFocus(state, actions)) {
        applied = true;
    }
    if (Array.isArray(state.collapsedIds) && state.collapsedIds.length > 0) {
        const validIds = state.collapsedIds.filter((id) => actions.tree.get(id));
        if (validIds.length > 0) {
            actions.setCollapsedNodes(new Set(validIds));
            applied = true;
        }
    }
    return applied;
}

/**
 * Re-applies the camera half of a shared view state. The stored centre is converted back into a
 * camera transform using THIS screen's pixels-per-year and visible area, so the same people appear
 * in the middle of the viewport regardless of window size, then clamped to the tree bounds.
 *
 * @param {Object} state - Parsed view state (uses `zoom`, `center`, and `showMap`).
 * @param {Object} env - Live camera environment.
 * @param {{x: number, y: number, z: number}} env.camera - Current camera transform.
 * @param {Function} env.setCamera - Camera state setter.
 * @param {Function} env.clampCamera - Camera bounds clamp.
 * @param {Function} env.getPpy - Returns pixels-per-year for a zoom level on this screen.
 * @param {number} env.rootNodeYob - Timeline anchor year.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} env.viewport - Visible area.
 * @returns {boolean} True when the camera was updated.
 *
 * @example
 * applyRestoredCamera({ zoom: 0.8, center: { x: 1240, year: 1953.5 } }, env);
 * // => true
 *
 * @example
 * applyRestoredCamera({ focusId: 'Joseph_1920_152' }, env);
 * // => false (no camera information in the URL)
 */
function applyRestoredCamera(state, env) {
    const hasZoom = Number.isFinite(state.zoom) && state.zoom > 0;
    if (state.showMap || (!hasZoom && !state.center)) return false;
    const zoom = hasZoom ? state.zoom : env.camera.z;
    const center = state.center || computeViewCenterFromCamera({
        camera: env.camera, ppy: env.getPpy(env.camera.z), rootNodeYob: env.rootNodeYob, ...env.viewport
    });
    const next = computeCameraFromViewCenter({
        center, zoom, ppy: env.getPpy(zoom), rootNodeYob: env.rootNodeYob, ...env.viewport
    });
    env.setCamera(env.clampCamera(next));
    return true;
}

/**
 * Runs the two-phase restore of a shared view state after the dataset is ready: first the
 * selection (which triggers the app's own person-centring animation), then — once that
 * centring has settled — the exact zoom and centre from the URL.
 *
 * @param {Object} params
 * @param {{current: Object}} params.latest - Ref holding the latest hook parameters.
 * @param {Object} params.state - Parsed view state from the initial URL hash.
 * @param {Function} params.onComplete - Invoked after the final phase.
 * @returns {Array<number>} Timer handles for the two phases.
 *
 * @example
 * scheduleViewStateRestore({ latest, state: parseViewStateHash(window.location.hash), onComplete: () => {} });
 *
 * @example
 * const timers = scheduleViewStateRestore({ latest, state: {}, onComplete: enableUrlWrites });
 * timers.forEach(clearTimeout);
 */
function scheduleViewStateRestore({ latest, state, onComplete }) {
    const selectionTimer = setTimeout(() => {
        applyRestoredSelection(state, latest.current);
    }, VIEW_STATE_SELECTION_DELAY_MS);
    const cameraTimer = setTimeout(() => {
        const p = latest.current;
        const viewport = measureViewStateViewport({
            container: p.containerRef.current, isSidebarOpen: resolveRestoredSidebarOpen(state), sidebarWidth: p.sidebarWidth
        });
        applyRestoredCamera(state, {
            camera: p.camera, setCamera: p.setCamera, clampCamera: p.clampCamera, getPpy: p.getPpy,
            rootNodeYob: p.treeStats.rootNodeYob, viewport
        });
        onComplete();
    }, VIEW_STATE_CAMERA_DELAY_MS);
    return [selectionTimer, cameraTimer];
}

/**
 * One-shot effect restoring the view state captured in the initial URL hash once the dataset has
 * finished loading (so the restore survives the cache-then-live double tree load and the import
 * handler's own focus reset).
 *
 * @param {Object} params
 * @param {{current: Object}} params.latest - Ref holding the latest hook parameters.
 * @param {Object} params.initialState - View state parsed from the URL at startup.
 * @param {{current: {done: boolean, writable: boolean}}} params.phaseRef - Restore lifecycle flags.
 * @param {string|null} params.rootId - Current tree root ID (null until a tree is loaded).
 * @param {boolean} params.isLoading - Whether a dataset import is in flight.
 * @param {Function} params.onComplete - Called when the restore has finished.
 *
 * @example
 * useUrlViewStateRestore({ latest, initialState: { focusId: 'Joseph_1920_152' }, phaseRef, rootId: tree.rootId, isLoading, onComplete });
 *
 * @example
 * useUrlViewStateRestore({ latest, initialState: {}, phaseRef, rootId: null, isLoading: true, onComplete: () => {} });
 */
function useUrlViewStateRestore({ latest, initialState, phaseRef, rootId, isLoading, onComplete }) {
    useEffect(() => {
        if (phaseRef.current.done || !rootId || isLoading) return;
        phaseRef.current.done = true;
        scheduleViewStateRestore({ latest, state: initialState, onComplete });
    }, [rootId, isLoading, latest, initialState, phaseRef, onComplete]);
}

/**
 * Debounced effect mirroring every meaningful UI change (focus, filter, map, sidebar, zoom, pan,
 * collapsed branches) into the URL hash. Writes are suppressed while loading, dragging, or during
 * live-sync camera shifts, and until the initial URL restore has completed.
 *
 * @param {Object} params - Live hook parameters (see useUrlViewStateSync).
 * @param {{current: {done: boolean, writable: boolean}}} params.phaseRef - Restore lifecycle flags.
 * @param {Function} params.writeNow - Captures and writes the current view state immediately.
 *
 * @example
 * useUrlViewStateWriter({ ...params, phaseRef, writeNow });
 *
 * @example
 * // While dragging no URL write happens; the hash updates once the pointer is released.
 * useUrlViewStateWriter({ ...params, isDragging: true, phaseRef, writeNow });
 */
function useUrlViewStateWriter(params) {
    const {
        focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, collapsedNodes, isLoading,
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, treeStats, phaseRef, writeNow
    } = params;
    useEffect(() => {
        if (!phaseRef.current.writable || isLoading || isDragging || isShifting) return undefined;
        const timer = setTimeout(writeNow, VIEW_STATE_WRITE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, collapsedNodes, isLoading,
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, treeStats, phaseRef, writeNow]);
}

/**
 * Keeps the browser URL in sync with the current view (Google-Maps style) and restores the view
 * from the URL on startup. Mount once from the application view model.
 *
 * @param {Object} params - Live application state and handlers.
 * @param {FamilyTree} params.tree - Loaded tree.
 * @param {string|null} params.focusId - Focused person ID.
 * @param {Object|null} params.activeFilter - Active filter descriptor.
 * @param {boolean} params.showMap - Map view flag.
 * @param {boolean} params.isSidebarVisible - Person sidebar flag.
 * @param {boolean} params.isAnySidebarOpen - Whether any sidebar panel is open.
 * @param {number} params.sidebarWidth - Sidebar width in pixels.
 * @param {boolean} params.isLoading - Dataset import in flight.
 * @param {boolean} params.isDragging - Pointer drag in progress.
 * @param {boolean} params.isShifting - Live-sync camera shift in progress.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {Function} params.setCamera - Camera setter.
 * @param {Function} params.clampCamera - Camera bounds clamp.
 * @param {Function} params.getPpy - Pixels-per-year resolver.
 * @param {number} params.ppy - Current pixels-per-year.
 * @param {Object} params.treeStats - Tree statistics (uses `rootNodeYob`).
 * @param {Set<string>} params.collapsedNodes - Collapsed branch IDs.
 * @param {Function} params.setCollapsedNodes - Collapsed set setter.
 * @param {{current: HTMLElement|null}} params.containerRef - Canvas container ref.
 * @param {Function} params.handleSetFocusId - Person focus handler.
 * @param {Function} params.handleFilterBy - Filter handler.
 * @param {Function} params.setShowMap - Map setter.
 * @param {Function} params.setIsSidebarVisible - Sidebar setter.
 * @param {Function} params.setActiveFilter - Filter setter.
 * @param {Function} params.setFocusId - Focus setter.
 *
 * @example
 * useUrlViewStateSync({ ...core, ...viewport, ...focusNav });
 *
 * @example
 * // Opening https://google.github.io/family-tree/#p=Joseph_1920_152&z=0.8&c=1240,1953.5
 * // focuses Joseph and centres the viewport on tree x=1240 / year 1953.5 at zoom 0.8.
 * useUrlViewStateSync(params);
 */
function useUrlViewStateSync(params) {
    const latest = useRef(params);
    latest.current = params;
    const phaseRef = useRef({ done: false, writable: false });
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        initialStateRef.current = parseViewStateHash(typeof window !== 'undefined' && window.location ? window.location.hash : '');
    }
    const writeNow = useCallback(() => {
        const p = latest.current;
        const viewport = measureViewStateViewport({
            container: p.containerRef.current, isSidebarOpen: p.isAnySidebarOpen, sidebarWidth: p.sidebarWidth
        });
        writeViewStateHash(encodeViewStateHash(buildCurrentViewState({
            focusId: p.focusId, isSidebarVisible: p.isSidebarVisible, activeFilter: p.activeFilter, showMap: p.showMap,
            camera: p.camera, ppy: p.ppy, rootNodeYob: p.treeStats.rootNodeYob, viewport, collapsedNodes: p.collapsedNodes
        })));
    }, []);
    const onComplete = useCallback(() => {
        phaseRef.current.writable = true;
        setTimeout(writeNow, VIEW_STATE_WRITE_DEBOUNCE_MS);
    }, [writeNow]);
    useUrlViewStateRestore({
        latest, initialState: initialStateRef.current, phaseRef,
        rootId: params.tree.rootId, isLoading: params.isLoading, onComplete
    });
    useUrlViewStateWriter({ ...params, phaseRef, writeNow });
}
