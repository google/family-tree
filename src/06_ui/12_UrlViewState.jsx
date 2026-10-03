// ============================================================================
// MODULE 6.12: SHAREABLE URL VIEW STATE (Google-Maps-style deep links)
// ============================================================================
//
// Every meaningful UI action is mirrored into a compact `#hash` fragment so the
// address bar can be copied to another computer and reproduce the same view:
//
//   https://google.github.io/family-tree/?id=1ZDpcz2…#p=Joseph_1920_152&z=0.8
//
//   Key  Meaning                                         Sample
//   ---  ----------------------------------------------  ------------------------------
//   p    Focused person ID                               p=Joseph_1920_152
//   s    Sidebar closed while a person is focused        s=0
//   f    Active filter `<type>:<value>`                  f=place:Kochi
//   v    Alternate view (world map)                      v=map
//   z    Camera zoom level (2 decimals)                  z=0.8
//   a    Camera anchor person (omitted when it is `p`)   a=Antu_1931_12
//   o    Viewport-centre offset from the anchor card     o=-320,12.5
//        (`<tree px>,<years>`; omitted when centred)
//   k    Collapsed branch IDs (comma separated)          k=Antu_1931_12,Elsy_1935_13
//
// Resilience to spreadsheet edits: the camera is never stored as absolute layout
// coordinates (those shift whenever an unrelated row re-flows the tree) but as an
// offset from a person card, horizontally in unscaled tree pixels and vertically
// in calendar years (pixels-per-year stretches with the viewport height). Person
// IDs (`<Name>_<YOB>_<row>`) are resolved exactly first, then by the same name and
// birth year with the nearest row, then by the same name with the nearest row, so
// inserted rows, namesakes, and corrected birth years keep pointing at the right
// person. Long spreadsheet IDs embedded in ghost IDs are compacted to `~N`.
// `?id=<sheetId>` stays a regular query parameter so sheet selection and view
// state never interfere with each other.

/** Debounce applied before mirroring UI state into the URL hash. */
const VIEW_STATE_WRITE_DEBOUNCE_MS = 300;
/** Delay after dataset readiness before restoring focus/filter/map from the hash. */
const VIEW_STATE_SELECTION_DELAY_MS = 350;
/** Delay after dataset readiness before restoring camera zoom/anchor offset from the hash. */
const VIEW_STATE_CAMERA_DELAY_MS = 1000;
/** Extra delays after the camera phase at which the anchor is re-measured on the re-flowed layout. */
const VIEW_STATE_CAMERA_REFINE_DELAYS_MS = [150, 450, 750];
/** Minimum length for a `_sourceId` to be treated as a spreadsheet ID worth compacting. */
const VIEW_STATE_MIN_SHEET_ID_LENGTH = 20;

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
 * formatCompactNumber(12.46, 1);
 * // => '12.5'
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
 * Collects the distinct spreadsheet IDs referenced by the people of a tree, sorted so both the
 * encoder and the decoder derive the same `~N` abbreviation for each sheet.
 *
 * @param {FamilyTree|null} tree - Loaded tree (uses each person's `_sourceId`).
 * @returns {Array<string>} Sorted spreadsheet IDs (short synthetic source IDs are ignored).
 *
 * @example
 * collectViewStateSheetIds(tree);
 * // => ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']
 *
 * @example
 * collectViewStateSheetIds({ all: [{ id: 'Mary_1924_7', _sourceId: 's1' }] });
 * // => []
 */
function collectViewStateSheetIds(tree) {
    const ids = new Set();
    ((tree && tree.all) || []).forEach((person) => {
        const sourceId = person && person._sourceId;
        if (typeof sourceId === 'string' && sourceId.length >= VIEW_STATE_MIN_SHEET_ID_LENGTH) ids.add(sourceId);
    });
    return Array.from(ids).sort();
}

/**
 * Replaces every full spreadsheet ID inside a person ID with its `~N` abbreviation so ghost IDs
 * (which embed their source sheet) stay short in shared URLs.
 *
 * @param {string} text - Person ID or ID list.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs from collectViewStateSheetIds.
 * @returns {string} Compacted text.
 *
 * @example
 * compactViewStateSheetIds('ghost_George_Daughter_1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']);
 * // => 'ghost_George_Daughter_~1_642'
 *
 * @example
 * compactViewStateSheetIds('Joseph_1920_152', []);
 * // => 'Joseph_1920_152'
 */
function compactViewStateSheetIds(text, sheetIds) {
    return (sheetIds || []).reduce((acc, sheetId, index) => acc.split(sheetId).join(`~${index}`), String(text));
}

/**
 * Inverse of compactViewStateSheetIds: expands `~N` abbreviations back into full spreadsheet IDs.
 * Unknown indexes are left untouched so hand-edited URLs degrade gracefully.
 *
 * @param {string} text - Compacted person ID.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs from collectViewStateSheetIds.
 * @returns {string} Expanded text.
 *
 * @example
 * expandViewStateSheetIds('ghost_George_Daughter_~1_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']);
 * // => 'ghost_George_Daughter_1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs_642'
 *
 * @example
 * expandViewStateSheetIds('ghost_George_Daughter_~7_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI']);
 * // => 'ghost_George_Daughter_~7_642'
 */
function expandViewStateSheetIds(text, sheetIds) {
    return String(text).replace(/~(\d+)/g, (match, index) => (sheetIds && sheetIds[Number(index)]) || match);
}

/**
 * Encodes a person ID for the hash: spreadsheet IDs are abbreviated first, then the result is
 * percent-encoded.
 *
 * @param {string} personId - Raw person ID.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs from collectViewStateSheetIds.
 * @returns {string} URL-safe compact person token.
 *
 * @example
 * encodePersonIdToken('Joseph_1920_152', []);
 * // => 'Joseph_1920_152'
 *
 * @example
 * encodePersonIdToken('ghost_George_Daughter_1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs_642', ['1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']);
 * // => 'ghost_George_Daughter_~0_642'
 */
function encodePersonIdToken(personId, sheetIds) {
    return encodeViewStateToken(compactViewStateSheetIds(personId, sheetIds));
}

/**
 * Encodes the selection half of the view state (focused person, sidebar, filter, map).
 *
 * @param {Object} state - View state snapshot.
 * @param {string|null} [state.focusId] - Focused person ID.
 * @param {boolean} [state.isSidebarVisible] - Whether the person sidebar is open.
 * @param {{filterType: string, value: string}|null} [state.activeFilter] - Active filter.
 * @param {boolean} [state.showMap] - Whether the world map view is shown.
 * @param {Array<string>} [sheetIds=[]] - Sorted spreadsheet IDs used to abbreviate person IDs.
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
function encodeSelectionHashParts(state, sheetIds = []) {
    const parts = [];
    if (state.focusId) {
        parts.push(`p=${encodePersonIdToken(state.focusId, sheetIds)}`);
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
 * Encodes the camera half of the view state (zoom, anchor person, centre offset, collapsed
 * branches). The anchor is omitted when it is the focused person and the offset is omitted
 * when the anchor card sits in the middle of the viewport, which keeps typical URLs short.
 *
 * @param {Object} state - View state snapshot.
 * @param {number} [state.zoom] - Camera zoom level.
 * @param {string|null} [state.focusId] - Focused person ID.
 * @param {string|null} [state.anchorId] - Camera anchor person ID.
 * @param {{dx: number, dy: number}|null} [state.offset] - Viewport-centre offset from the anchor card.
 * @param {Array<string>} [state.collapsedIds] - Collapsed branch root IDs.
 * @param {Array<string>} [sheetIds=[]] - Sorted spreadsheet IDs used to abbreviate person IDs.
 * @returns {Array<string>} `key=value` fragments in canonical order.
 *
 * @example
 * encodeCameraHashParts({ zoom: 0.8, focusId: 'Joseph_1920_152', anchorId: 'Joseph_1920_152', offset: { dx: 0.3, dy: -0.02 } });
 * // => ['z=0.8']
 *
 * @example
 * encodeCameraHashParts({ zoom: 0.12, anchorId: 'Antu_1931_12', offset: { dx: -320.4, dy: 12.46 }, collapsedIds: ['Elsy_1935_13'] });
 * // => ['z=0.12', 'a=Antu_1931_12', 'o=-320,12.5', 'k=Elsy_1935_13']
 */
function encodeCameraHashParts(state, sheetIds = []) {
    const parts = [];
    if (Number.isFinite(state.zoom) && state.zoom > 0) parts.push(`z=${formatCompactNumber(state.zoom, 2)}`);
    if (state.anchorId && state.anchorId !== state.focusId) parts.push(`a=${encodePersonIdToken(state.anchorId, sheetIds)}`);
    const offset = state.offset;
    if (offset && Number.isFinite(offset.dx) && Number.isFinite(offset.dy)) {
        const dx = Math.round(offset.dx);
        const dy = formatCompactNumber(offset.dy, 1);
        if (dx !== 0 || dy !== '0') parts.push(`o=${dx},${dy}`);
    }
    if (Array.isArray(state.collapsedIds) && state.collapsedIds.length > 0) {
        parts.push(`k=${state.collapsedIds.map((id) => encodePersonIdToken(id, sheetIds)).join(',')}`);
    }
    return parts;
}

/**
 * Serialises a view state snapshot into the compact URL hash body (without the leading `#`).
 * Only non-default values are emitted so the URL stays short.
 *
 * @param {Object} state - View state snapshot (see encodeSelectionHashParts / encodeCameraHashParts).
 * @param {Array<string>} [sheetIds=[]] - Sorted spreadsheet IDs used to abbreviate person IDs.
 * @returns {string} Hash body such as `p=Joseph_1920_152&z=0.8`, or `''` when empty.
 *
 * @example
 * encodeViewStateHash({ focusId: 'Joseph_1920_152', isSidebarVisible: true, zoom: 0.8, anchorId: 'Joseph_1920_152', offset: { dx: 0, dy: 0 } });
 * // => 'p=Joseph_1920_152&z=0.8'
 *
 * @example
 * encodeViewStateHash({});
 * // => ''
 */
function encodeViewStateHash(state, sheetIds = []) {
    if (!state) return '';
    return [...encodeSelectionHashParts(state, sheetIds), ...encodeCameraHashParts(state, sheetIds)].join('&');
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
 * Applies a single `key=value` hash entry onto a view state object being parsed. Person IDs keep
 * their `~N` sheet abbreviations here; they are expanded when resolved against the loaded tree.
 * Unknown keys and malformed numbers are ignored so hand-edited URLs degrade gracefully.
 *
 * @param {Object} state - Mutable view state accumulator.
 * @param {string} key - Hash key (`p`, `s`, `f`, `v`, `z`, `a`, `o`, or `k`).
 * @param {string} value - Raw (still encoded) value.
 * @returns {Object} The same state object for chaining.
 *
 * @example
 * applyViewStateHashEntry({}, 'o', '-320,12.5');
 * // => { offset: { dx: -320, dy: 12.5 } }
 *
 * @example
 * applyViewStateHashEntry({}, 'z', 'abc');
 * // => {}
 */
function applyViewStateHashEntry(state, key, value) {
    if (key === 'p') state.focusId = decodeViewStateToken(value);
    else if (key === 'a') state.anchorId = decodeViewStateToken(value);
    else if (key === 's') state.isSidebarVisible = value !== '0';
    else if (key === 'v') state.showMap = value === 'map';
    else if (key === 'f') {
        const filter = parseViewStateFilterToken(value);
        if (filter) state.activeFilter = filter;
    } else if (key === 'z') {
        const zoom = parseFloat(value);
        if (Number.isFinite(zoom) && zoom > 0) state.zoom = zoom;
    } else if (key === 'o') {
        const [dx, dy] = value.split(',').map((token) => parseFloat(token));
        if (Number.isFinite(dx) && Number.isFinite(dy)) state.offset = { dx, dy };
    } else if (key === 'k') {
        state.collapsedIds = value.split(',').filter(Boolean).map(decodeViewStateToken);
    }
    return state;
}

/**
 * Parses a URL hash (with or without the leading `#`) back into a view state snapshot.
 *
 * @param {string} hash - Hash fragment such as `#p=Joseph_1920_152&z=0.8&o=-320,12.5`.
 * @returns {Object} Partial view state; empty object when the hash carries no view state.
 *
 * @example
 * parseViewStateHash('#p=Joseph_1920_152&s=0&z=0.8&o=-320,12.5');
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: false, zoom: 0.8, offset: { dx: -320, dy: 12.5 } }
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
 * Converts the camera transform into the point of the tree (in unscaled tree pixels) that sits in
 * the middle of the visible canvas area, i.e. right of the timeline gutter and left of any sidebar.
 *
 * @param {Object} params
 * @param {{x: number, y: number, z: number}} params.camera - Current camera transform.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, y: number}} Visible centre in unscaled tree pixels.
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 1148, y: 600 }
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: 48, y: 24, z: 0.5 }, visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 });
 * // => { x: 1000, y: 752 }
 */
function computeViewCenterFromCamera({ camera, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const zoom = camera.z || 1;
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    return { x: (centerScreenX - camera.x) / zoom, y: (centerScreenY - camera.y) / zoom };
}

/**
 * Inverse of computeViewCenterFromCamera: derives the camera transform that places the given
 * tree point in the middle of the visible viewport at the requested zoom.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.center - Desired visible centre in unscaled tree pixels.
 * @param {number} params.zoom - Desired camera zoom level.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, y: number, z: number}} Camera transform.
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1148, y: 600 }, zoom: 1, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: -600, y: -200, z: 1 }
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1000, y: 752 }, zoom: 0.5, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 48, y: 24, z: 0.5 }
 */
function computeCameraFromViewCenter({ center, zoom, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    return { x: centerScreenX - center.x * zoom, y: centerScreenY - center.y * zoom, z: zoom };
}

/**
 * Expresses the visible centre relative to an anchor person card: horizontally in unscaled tree
 * pixels, vertically in calendar years (so the value is independent of this screen's pixels-per-year).
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.center - Visible centre in unscaled tree pixels.
 * @param {{x: number, y: number}} params.anchor - Anchor card centre in unscaled tree pixels.
 * @param {number} params.ppy - Pixels-per-year of the current layout.
 * @returns {{dx: number, dy: number}} Offset in tree pixels (dx) and years (dy).
 *
 * @example
 * computeAnchorOffset({ center: { x: 1148, y: 600 }, anchor: { x: 1468, y: 475 }, ppy: 10 });
 * // => { dx: -320, dy: 12.5 }
 *
 * @example
 * computeAnchorOffset({ center: { x: 500, y: 300 }, anchor: { x: 500, y: 300 }, ppy: 8 });
 * // => { dx: 0, dy: 0 }
 */
function computeAnchorOffset({ center, anchor, ppy }) {
    return { dx: center.x - anchor.x, dy: (center.y - anchor.y) / (ppy || 8) };
}

/**
 * Inverse of computeAnchorOffset: rebuilds the visible centre from the anchor card measured on
 * THIS screen and the shared offset, using this screen's pixels-per-year for the vertical part.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.anchor - Anchor card centre in unscaled tree pixels.
 * @param {{dx: number, dy: number}} params.offset - Shared offset (tree pixels, years).
 * @param {number} params.ppy - Pixels-per-year of the layout on this screen.
 * @returns {{x: number, y: number}} Visible centre in unscaled tree pixels.
 *
 * @example
 * computeCenterFromAnchorOffset({ anchor: { x: 1768, y: 380 }, offset: { dx: -320, dy: 12.5 }, ppy: 8 });
 * // => { x: 1448, y: 480 }
 *
 * @example
 * computeCenterFromAnchorOffset({ anchor: { x: 500, y: 300 }, offset: { dx: 0, dy: 0 }, ppy: 8 });
 * // => { x: 500, y: 300 }
 */
function computeCenterFromAnchorOffset({ anchor, offset, ppy }) {
    return { x: anchor.x + offset.dx, y: anchor.y + offset.dy * (ppy || 8) };
}

/**
 * Tests whether an anchor card centre (unscaled tree pixels) is currently on screen inside the
 * visible canvas area.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.anchor - Card centre in unscaled tree pixels.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {boolean} True when the card centre is visible.
 *
 * @example
 * isAnchorInsideViewport({ anchor: { x: 1148, y: 600 }, camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => true
 *
 * @example
 * isAnchorInsideViewport({ anchor: { x: 5000, y: 600 }, camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => false
 */
function isAnchorInsideViewport({ anchor, camera, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const screenX = anchor.x * camera.z + camera.x;
    const screenY = anchor.y * camera.z + camera.y;
    return screenX >= timelineWidth && screenX <= visibleWidth && screenY >= 0 && screenY <= visibleHeight;
}

/**
 * Picks the rendered person card whose centre is nearest to a point of the tree.
 *
 * @param {Array<{id: string, x: number, y: number}>} nodes - Rendered card centres in unscaled tree pixels.
 * @param {{x: number, y: number}} center - Reference point in unscaled tree pixels.
 * @returns {{id: string, x: number, y: number}|null} Nearest card, or null when nothing is rendered.
 *
 * @example
 * pickNearestAnchor([{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 100, y: 100 }], { x: 90, y: 80 });
 * // => { id: 'B', x: 100, y: 100 }
 *
 * @example
 * pickNearestAnchor([], { x: 0, y: 0 });
 * // => null
 */
function pickNearestAnchor(nodes, center) {
    let best = null;
    let bestDistance = Infinity;
    (nodes || []).forEach((node) => {
        const distance = (node.x - center.x) ** 2 + (node.y - center.y) ** 2;
        if (distance < bestDistance) {
            best = node;
            bestDistance = distance;
        }
    });
    return best;
}

/**
 * Measures the centre of one rendered person card in unscaled tree pixels.
 *
 * @param {string} personId - Person ID (card element id is `node-<personId>`).
 * @param {HTMLElement|null} treeElement - Inner tree element carrying the camera transform.
 * @returns {{id: string, x: number, y: number}|null} Card centre, or null when not rendered.
 *
 * @example
 * measurePersonNodeCenter('Joseph_1920_152', treeRef.current);
 * // => { id: 'Joseph_1920_152', x: 1468, y: 475 }
 *
 * @example
 * measurePersonNodeCenter('Nobody_unk_0', treeRef.current);
 * // => null
 */
function measurePersonNodeCenter(personId, treeElement) {
    const box = computePeopleBoundingBox([personId], treeElement);
    if (!box || !box.foundCount) return null;
    return { id: personId, x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

/**
 * Lists the centres of all rendered person cards in unscaled tree pixels.
 *
 * @param {HTMLElement|null} treeElement - Inner tree element carrying the camera transform.
 * @param {FamilyTree} tree - Loaded tree, used to ignore non-person elements with a `node-` id.
 * @returns {Array<{id: string, x: number, y: number}>} Rendered card centres.
 *
 * @example
 * listRenderedPersonNodes(treeRef.current, tree).length;
 * // => 239
 *
 * @example
 * listRenderedPersonNodes(null, tree);
 * // => []
 */
function listRenderedPersonNodes(treeElement, tree) {
    if (!treeElement || typeof treeElement.querySelectorAll !== 'function') return [];
    const treeRect = treeElement.getBoundingClientRect();
    const scale = treeElement.offsetWidth ? (treeRect.width / treeElement.offsetWidth) : 1;
    const nodes = [];
    treeElement.querySelectorAll('[id^="node-"]').forEach((element) => {
        const id = element.id.slice(5);
        if (!tree || !tree.get(id)) return;
        const rect = element.getBoundingClientRect();
        nodes.push({
            id,
            x: ((rect.left + rect.right) / 2 - treeRect.left) / scale,
            y: ((rect.top + rect.bottom) / 2 - treeRect.top) / scale
        });
    });
    return nodes;
}

/**
 * Chooses the person card the camera is anchored to in the URL: the focused person while their
 * card is on screen (shortest URL), otherwise the card nearest to the middle of the viewport.
 *
 * @param {Object} params
 * @param {HTMLElement|null} params.treeElement - Inner tree element.
 * @param {FamilyTree} params.tree - Loaded tree.
 * @param {string|null} params.focusId - Focused person ID.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} params.viewport - Visible area.
 * @returns {{id: string, x: number, y: number}|null} Anchor card centre in unscaled tree pixels.
 *
 * @example
 * chooseViewStateAnchor({ treeElement: treeRef.current, tree, focusId: 'Joseph_1920_152', camera, viewport });
 * // => { id: 'Joseph_1920_152', x: 1468, y: 475 }   (Joseph's card is on screen)
 *
 * @example
 * chooseViewStateAnchor({ treeElement: treeRef.current, tree, focusId: null, camera, viewport });
 * // => { id: 'Antu_1931_12', x: 2210, y: 710 }      (card nearest to the viewport centre)
 */
function chooseViewStateAnchor({ treeElement, tree, focusId, camera, viewport }) {
    if (!treeElement) return null;
    const focused = focusId ? measurePersonNodeCenter(focusId, treeElement) : null;
    if (focused && isAnchorInsideViewport({ anchor: focused, camera, ...viewport })) return focused;
    const center = computeViewCenterFromCamera({ camera, ...viewport });
    return pickNearestAnchor(listRenderedPersonNodes(treeElement, tree), center);
}

/**
 * Splits a person ID (`<Name>_<YOB|unk>_<row>` or `ghost_<Name>_<sheet>_<n>`) into the parts used
 * by the fallback matchers: the stem without the trailing row, the stem without row and birth
 * year (or sheet), and the numeric row.
 *
 * @param {string} personId - Person ID from a shared URL.
 * @returns {{stem: string, nameStem: string, row: number|null}|null} Reference parts, or null when too short.
 *
 * @example
 * parseViewStatePersonRef('Joseph_1920_152');
 * // => { stem: 'Joseph_1920', nameStem: 'Joseph', row: 152 }
 *
 * @example
 * parseViewStatePersonRef('ghost_George_Daughter_~1_642');
 * // => { stem: 'ghost_George_Daughter_~1', nameStem: 'ghost_George_Daughter', row: 642 }
 */
function parseViewStatePersonRef(personId) {
    const tokens = String(personId).split('_');
    if (tokens.length < 3) return null;
    const row = parseInt(tokens[tokens.length - 1], 10);
    return {
        stem: tokens.slice(0, -1).join('_'),
        nameStem: tokens.slice(0, -2).join('_'),
        row: Number.isFinite(row) ? row : null
    };
}

/**
 * Finds the person whose (compacted) ID starts with `<stem>_` followed by exactly `depth` more
 * tokens, preferring the candidate whose trailing row number is nearest to the shared one so that
 * namesakes further away in the spreadsheet never win over the intended person.
 *
 * @param {Array<{id: string, key: string}>} people - Raw IDs paired with their compacted form.
 * @param {string} stem - ID prefix to match (without the trailing underscore).
 * @param {number} depth - Number of `_`-separated tokens expected after the stem.
 * @param {number|null} row - Row number from the shared ID.
 * @returns {string|null} Raw ID of the best candidate, or null.
 *
 * @example
 * pickNearestRowCandidate([{ id: 'Jose_1950_10', key: 'Jose_1950_10' }, { id: 'Jose_1950_60', key: 'Jose_1950_60' }], 'Jose_1950', 1, 11);
 * // => 'Jose_1950_10'
 *
 * @example
 * pickNearestRowCandidate([{ id: 'Joseph_Son_1950_12', key: 'Joseph_Son_1950_12' }], 'Joseph', 2, 152);
 * // => null  (three tokens follow "Joseph", so it is a different person)
 */
function pickNearestRowCandidate(people, stem, depth, row) {
    if (!stem) return null;
    let best = null;
    let bestDistance = Infinity;
    people.forEach((person) => {
        if (!person.key.startsWith(`${stem}_`)) return;
        const rest = person.key.slice(stem.length + 1).split('_');
        if (rest.length !== depth) return;
        const candidateRow = parseInt(rest[rest.length - 1], 10);
        const distance = Number.isFinite(candidateRow) && row !== null ? Math.abs(candidateRow - row) : Number.MAX_SAFE_INTEGER;
        if (distance < bestDistance) {
            best = person.id;
            bestDistance = distance;
        }
    });
    return best;
}

/**
 * Resolves a person ID from a shared URL against the loaded tree, surviving spreadsheet edits:
 * exact match first, then the same name and birth year with the nearest row (rows inserted above
 * shift the trailing row number), then the same name with the nearest row (corrected birth year
 * or a ghost whose source sheet moved).
 *
 * @param {FamilyTree} tree - Loaded family tree.
 * @param {string|null|undefined} personId - Person ID from the URL hash (may use `~N` sheet abbreviations).
 * @returns {string|null} A valid person ID in `tree`, or null when nobody matches.
 *
 * @example
 * // A row was inserted above Joseph, so the tree now holds Joseph_1920_153
 * resolveViewStatePersonId(tree, 'Joseph_1920_152');
 * // => 'Joseph_1920_153'
 *
 * @example
 * // Joseph's birth year was corrected from 1920 to 1921 in the sheet
 * resolveViewStatePersonId(tree, 'Joseph_1920_152');
 * // => 'Joseph_1921_152'
 */
function resolveViewStatePersonId(tree, personId) {
    if (!tree || !personId) return null;
    const sheetIds = collectViewStateSheetIds(tree);
    const wanted = compactViewStateSheetIds(personId, sheetIds);
    const exactId = expandViewStateSheetIds(wanted, sheetIds);
    if (tree.get(exactId)) return exactId;
    const ref = parseViewStatePersonRef(wanted);
    if (!ref) return null;
    const people = (tree.all || [])
        .filter((person) => person && typeof person.id === 'string')
        .map((person) => ({ id: person.id, key: compactViewStateSheetIds(person.id, sheetIds) }));
    return pickNearestRowCandidate(people, ref.stem, 1, ref.row)
        || pickNearestRowCandidate(people, ref.nameStem, 2, ref.row);
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
 * Captures the live application state as a serialisable view state snapshot. The camera is
 * expressed relative to the anchor card so the snapshot survives layout changes; camera details
 * are omitted while the map view is shown because the tree canvas is hidden there.
 *
 * @param {Object} params
 * @param {string|null} params.focusId - Focused person ID.
 * @param {boolean} params.isSidebarVisible - Whether the person sidebar is open.
 * @param {Object|null} params.activeFilter - Active filter descriptor.
 * @param {boolean} params.showMap - Whether the map view is shown.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {number} params.ppy - Current pixels-per-year.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} params.viewport - Measured viewport.
 * @param {{id: string, x: number, y: number}|null} params.anchor - Anchor card centre (see chooseViewStateAnchor).
 * @param {Set<string>|Array<string>} params.collapsedNodes - Collapsed branch IDs.
 * @returns {Object} View state snapshot accepted by encodeViewStateHash.
 *
 * @example
 * buildCurrentViewState({ focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 *   camera: { x: -600, y: -200, z: 1 }, ppy: 10, viewport: { visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 },
 *   anchor: { id: 'Joseph_1920_152', x: 1468, y: 475 }, collapsedNodes: new Set() });
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 * //      zoom: 1, anchorId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 }, collapsedIds: [] }
 *
 * @example
 * encodeViewStateHash(buildCurrentViewState({ ...liveState, showMap: true }));
 * // => 'v=map'
 */
function buildCurrentViewState({ focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, viewport, anchor, collapsedNodes }) {
    const center = showMap ? null : computeViewCenterFromCamera({ camera, ...viewport });
    const useAnchor = Boolean(center && anchor);
    return {
        focusId: focusId || null,
        isSidebarVisible: Boolean(isSidebarVisible),
        activeFilter: activeFilter || null,
        showMap: Boolean(showMap),
        zoom: showMap ? null : camera.z,
        anchorId: useAnchor ? anchor.id : null,
        offset: useAnchor ? computeAnchorOffset({ center, anchor, ppy }) : null,
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
 * writeViewStateHash('p=Joseph_1920_152&z=0.8');
 * // address bar => https://google.github.io/family-tree/?id=1ZDpc…#p=Joseph_1920_152&z=0.8
 *
 * @example
 * writeViewStateHash('');
 * // => false when the URL already has no hash
 */
function writeViewStateHash(hashBody) {
    saveLastViewStateHash(hashBody);
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
 * Resolves the collapsed branch IDs of a shared view state against the loaded tree with the same
 * row-shift tolerant matching used for the focused person, dropping duplicates and unknown people.
 *
 * @param {Object} state - Parsed view state (uses `collapsedIds`).
 * @param {FamilyTree} tree - Loaded tree.
 * @returns {Array<string>} Valid collapsed branch IDs.
 *
 * @example
 * resolveRestoredCollapsedIds({ collapsedIds: ['Antu_1931_12', 'Nobody_unk_0'] }, tree);
 * // => ['Antu_1931_13']   (Antu's row shifted by one, Nobody is dropped)
 *
 * @example
 * resolveRestoredCollapsedIds({}, tree);
 * // => []
 */
function resolveRestoredCollapsedIds(state, tree) {
    if (!Array.isArray(state.collapsedIds)) return [];
    const resolved = state.collapsedIds.map((id) => resolveViewStatePersonId(tree, id)).filter(Boolean);
    return Array.from(new Set(resolved));
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
    const collapsedIds = resolveRestoredCollapsedIds(state, actions.tree);
    if (collapsedIds.length > 0) {
        actions.setCollapsedNodes(new Set(collapsedIds));
        applied = true;
    }
    return applied;
}

/**
 * Rebuilds the visible centre of a shared view state on this screen: the anchor person (the
 * explicit `a=` anchor, else the focused person) is resolved against the tree, measured on the
 * current layout, and offset by the shared `o=` distance using this screen's pixels-per-year.
 *
 * @param {Object} state - Parsed view state (uses `anchorId`, `focusId`, `offset`).
 * @param {Object} env - Live camera environment (uses `tree`, `measureAnchor`, `getPpy`).
 * @param {number} zoom - Zoom level the centre will be shown at.
 * @returns {{x: number, y: number}|null} Visible centre in unscaled tree pixels, or null when no anchor is rendered.
 *
 * @example
 * resolveRestoredCenter({ focusId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 } }, env, 0.8);
 * // => { x: 1148, y: 580 }
 *
 * @example
 * resolveRestoredCenter({ zoom: 0.8 }, env, 0.8);
 * // => null  (no anchor in the URL)
 */
function resolveRestoredCenter(state, env, zoom) {
    const anchorId = resolveViewStatePersonId(env.tree, state.anchorId || state.focusId);
    const anchor = anchorId ? env.measureAnchor(anchorId) : null;
    if (!anchor) return null;
    return computeCenterFromAnchorOffset({ anchor, offset: state.offset || { dx: 0, dy: 0 }, ppy: env.getPpy(zoom) });
}

/**
 * Re-applies the camera half of a shared view state. The anchor-relative centre is converted back
 * into a camera transform using THIS screen's layout, pixels-per-year and visible area, so the same
 * people appear in the middle of the viewport regardless of window size or spreadsheet edits, then
 * clamped to the tree bounds. Without a resolvable anchor only the zoom level is applied.
 *
 * @param {Object} state - Parsed view state (uses `zoom`, `anchorId`, `focusId`, `offset`, and `showMap`).
 * @param {Object} env - Live camera environment.
 * @param {{x: number, y: number, z: number}} env.camera - Current camera transform.
 * @param {Function} env.setCamera - Camera state setter.
 * @param {Function} env.clampCamera - Camera bounds clamp.
 * @param {Function} env.getPpy - Returns pixels-per-year for a zoom level on this screen.
 * @param {FamilyTree} env.tree - Loaded tree.
 * @param {Function} env.measureAnchor - Returns `{id, x, y}` for a rendered person card, or null.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} env.viewport - Visible area.
 * @returns {boolean} True when the camera was updated.
 *
 * @example
 * applyRestoredCamera({ zoom: 0.8, focusId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 } }, env);
 * // => true
 *
 * @example
 * applyRestoredCamera({ focusId: 'Joseph_1920_152' }, { ...env, measureAnchor: () => null });
 * // => false (no zoom and no rendered anchor: camera left untouched)
 */
function applyRestoredCamera(state, env) {
    if (state.showMap) return false;
    const hasZoom = Number.isFinite(state.zoom) && state.zoom > 0;
    const zoom = hasZoom ? state.zoom : env.camera.z;
    const center = resolveRestoredCenter(state, env, zoom);
    if (center) {
        env.setCamera(env.clampCamera(computeCameraFromViewCenter({ center, zoom, ...env.viewport })));
        return true;
    }
    if (!hasZoom) return false;
    env.setCamera(env.clampCamera({ ...env.camera, z: zoom }));
    return true;
}

/**
 * Builds the camera environment used by applyRestoredCamera from the live hook parameters,
 * predicting the sidebar state the restored view will end up with.
 *
 * @param {Object} p - Latest hook parameters (see useUrlViewStateSync).
 * @param {Object} state - Parsed view state.
 * @returns {Object} Environment accepted by applyRestoredCamera.
 *
 * @example
 * applyRestoredCamera(state, buildRestoreCameraEnv(latest.current, state));
 *
 * @example
 * buildRestoreCameraEnv(latest.current, { focusId: 'Joseph_1920_152' }).viewport;
 * // => { visibleWidth: 1080, visibleHeight: 900, timelineWidth: 48 }   (sidebar predicted open)
 */
function buildRestoreCameraEnv(p, state) {
    const viewport = measureViewStateViewport({
        container: p.containerRef.current, isSidebarOpen: resolveRestoredSidebarOpen(state), sidebarWidth: p.sidebarWidth
    });
    return {
        camera: p.camera, setCamera: p.setCamera, clampCamera: p.clampCamera, getPpy: p.getPpy, tree: p.tree, viewport,
        measureAnchor: (id) => measurePersonNodeCenter(id, p.treeRef ? p.treeRef.current : null)
    };
}

/**
 * Runs the phased restore of a shared view state after the dataset is ready: first the selection
 * (which triggers the app's own person-centring animation), then — once that centring has settled —
 * the zoom and anchor offset from the URL, re-measured a few times because the horizontal layout
 * re-flows with the zoom level.
 *
 * @param {Object} params
 * @param {{current: Object}} params.latest - Ref holding the latest hook parameters.
 * @param {Object} params.state - Parsed view state from the initial URL hash.
 * @param {Function} params.onComplete - Invoked after the final phase.
 * @returns {Array<number>} Timer handles for all phases.
 *
 * @example
 * scheduleViewStateRestore({ latest, state: parseViewStateHash(window.location.hash), onComplete: () => {} });
 *
 * @example
 * const timers = scheduleViewStateRestore({ latest, state: {}, onComplete: enableUrlWrites });
 * timers.forEach(clearTimeout);
 */
function scheduleViewStateRestore({ latest, state, onComplete }) {
    const timers = [setTimeout(() => {
        applyRestoredSelection(state, latest.current);
    }, VIEW_STATE_SELECTION_DELAY_MS)];
    const delays = [0, ...VIEW_STATE_CAMERA_REFINE_DELAYS_MS];
    delays.forEach((extraDelay, index) => {
        timers.push(setTimeout(() => {
            applyRestoredCamera(state, buildRestoreCameraEnv(latest.current, state));
            if (index === delays.length - 1) onComplete();
        }, VIEW_STATE_CAMERA_DELAY_MS + extraDelay));
    });
    return timers;
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
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, tree, phaseRef, writeNow
    } = params;
    useEffect(() => {
        if (!phaseRef.current.writable || isLoading || isDragging || isShifting) return undefined;
        const timer = setTimeout(writeNow, VIEW_STATE_WRITE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, collapsedNodes, isLoading,
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, tree, phaseRef, writeNow]);
}

/**
 * Captures the live view (anchor card, offset, zoom, selection) and writes it to the URL hash.
 *
 * @param {Object} p - Latest hook parameters (see useUrlViewStateSync).
 * @returns {boolean} True when the address bar was updated.
 *
 * @example
 * captureAndWriteViewState(latest.current);
 * // address bar => …#p=Joseph_1920_152&z=0.8
 *
 * @example
 * captureAndWriteViewState({ ...latest.current, showMap: true });
 * // address bar => …#v=map
 */
function captureAndWriteViewState(p) {
    const viewport = measureViewStateViewport({
        container: p.containerRef.current, isSidebarOpen: p.isAnySidebarOpen, sidebarWidth: p.sidebarWidth
    });
    const anchor = p.showMap ? null : chooseViewStateAnchor({
        treeElement: p.treeRef ? p.treeRef.current : null, tree: p.tree, focusId: p.focusId, camera: p.camera, viewport
    });
    const state = buildCurrentViewState({
        focusId: p.focusId, isSidebarVisible: p.isSidebarVisible, activeFilter: p.activeFilter, showMap: p.showMap,
        camera: p.camera, ppy: p.ppy, viewport, anchor, collapsedNodes: p.collapsedNodes
    });
    return writeViewStateHash(encodeViewStateHash(state, collectViewStateSheetIds(p.tree)));
}

/**
 * Picks the view-state hash to restore on startup: an explicit `#…` hash in the URL always wins;
 * when the URL has no hash (e.g. opening `https://google.github.io/family-tree/` or `localhost:8000/`),
 * falls back to the last view-state hash saved in browser preferences unless a sheet was explicitly
 * requested via `?id=` without a hash.
 *
 * @param {string|null} [locationHash=null] - `window.location.hash` override
 * @param {string|null} [searchString=null] - `window.location.search` override
 * @param {string} [storedHash=loadLastViewStateHash()] - Saved hash body from preferences
 * @returns {string} Hash string to pass to `parseViewStateHash`
 *
 * @example
 * resolveInitialViewStateHash('#p=Joseph_1920_152', '', 'v=map');
 * // => '#p=Joseph_1920_152'
 *
 * @example
 * resolveInitialViewStateHash('', '', 'p=Joseph_1920_152&z=0.8');
 * // => 'p=Joseph_1920_152&z=0.8'
 */
function resolveInitialViewStateHash(locationHash = null, searchString = null, storedHash = loadLastViewStateHash()) {
    const rawHash = locationHash !== null
        ? String(locationHash)
        : (typeof window !== 'undefined' && window.location ? String(window.location.hash || '') : '');
    if (rawHash.replace(/^#/, '').trim()) return rawHash;
    if (hasExplicitSheetQueryParam(searchString)) return '';
    return storedHash || '';
}

/**
 * Keeps the browser URL in sync with the current view (Google-Maps style) and restores the view
 * from the URL (or the last saved view state) on startup. Mount once from the application view model.
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
 * @param {Set<string>} params.collapsedNodes - Collapsed branch IDs.
 * @param {Function} params.setCollapsedNodes - Collapsed set setter.
 * @param {{current: HTMLElement|null}} params.containerRef - Canvas container ref.
 * @param {{current: HTMLElement|null}} params.treeRef - Inner tree element ref (person cards).
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
 * // Opening https://google.github.io/family-tree/#p=Joseph_1920_152&z=0.8&o=-320,12.5
 * // focuses Joseph and places the viewport centre 320 tree px left of and 12.5 years below his card at zoom 0.8.
 * useUrlViewStateSync(params);
 */
function useUrlViewStateSync(params) {
    const latest = useRef(params);
    latest.current = params;
    const phaseRef = useRef({ done: false, writable: false });
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        initialStateRef.current = parseViewStateHash(resolveInitialViewStateHash());
    }
    const writeNow = useCallback(() => captureAndWriteViewState(latest.current), []);
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
