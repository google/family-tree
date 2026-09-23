
/**
 * React hook managing genealogy dataset state, spreadsheet fetching, audit logs, and focus selection.
 *
 * Provides functions to fetch and parse Google Sheets data from URLs, apply preliminary
 * and complete tree datasets, record load logs, and track selection state.
 *
 * @returns {{
 *   tree: FamilyTree,
 *   setTree: React.Dispatch<React.SetStateAction<FamilyTree>>,
 *   focusId: string|null,
 *   setFocusId: React.Dispatch<React.SetStateAction<string|null>>,
 *   isLoading: boolean,
 *   errorMsg: string,
 *   logs: Array<object>,
 *   setLogs: React.Dispatch<React.SetStateAction<Array<object>>>,
 *   appendLog: Function,
 *   updateLog: Function,
 *   fetchFromUrl: (sheetUrl: string, options?: { skipCache?: boolean, background?: boolean, onBackgroundUpdate?: Function|null }) => Promise<boolean>
 * }}
 *
 * @example
 * const { tree, focusId, setFocusId, isLoading, fetchFromUrl } = useAncestryData();
 *
 * @example
 * const { tree, logs, errorMsg, appendLog } = useAncestryData();
 */
function useAncestryData() {
    const [tree, setTree] = useState(new FamilyTree());
    const [focusId, setFocusId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const { logs, setLogs, appendLog, updateLog } = useAppLogs();

    const lastDataFingerprintRef = useRef('');

    const fetchFromUrl = useCallback(async (sheetUrl, options = {}) => {
        return fetchDatasetFromUrl({
            sheetUrl,
            options,
            setIsLoading,
            setErrorMsg,
            setLogs,
            appendLog,
            tree,
            setTree,
            setFocusId,
            lastDataFingerprintRef
        });
    }, [appendLog, setLogs, tree]);

    return {
        tree, setTree, focusId, setFocusId,
        isLoading, errorMsg, setErrorMsg, logs, appendLog,
        fetchFromUrl
    };
}

/**
 * Calculates the horizontal and vertical scale change factors between two zoom levels,
 * accounting for non-linear vertical pixels-per-year (ppy) scaling.
 *
 * @param {number} oldZ - Previous camera zoom level
 * @param {number} newZ - Target camera zoom level
 * @param {Function} getPpy - Pixels-per-year resolution function
 * @returns {{ scaleChangeX: number, scaleChangeY: number }}
 *
 * @example
 * calculateZoomScaleChanges(1, 2, (z) => 8)
 * // => { scaleChangeX: 2, scaleChangeY: 2 }
 *
 * @example
 * calculateZoomScaleChanges(1, 1, () => 8)
 * // => { scaleChangeX: 1, scaleChangeY: 1 }
 */
function calculateZoomScaleChanges(oldZ, newZ, getPpy) {
    const oldPpy = getPpy(oldZ);
    const newPpy = getPpy(newZ);
    const scaleChangeX = newZ / oldZ;
    const effectiveScaleY_old = oldPpy * oldZ;
    const effectiveScaleY_new = newPpy * newZ;
    const scaleChangeY = effectiveScaleY_new / effectiveScaleY_old;
    return { scaleChangeX, scaleChangeY };
}

/**
 * Calculates updated camera coordinates and zoom during a two-finger pinch gesture,
 * scaling around the focal point while accounting for variable vertical pixels-per-year.
 *
 * @param {Object} params
 * @param {number} params.newDist - Current distance between two touch points
 * @param {Object} params.newMid - Current midpoint { x, y } in client coordinates
 * @param {Object} params.pinchState - Initial pinch state { dist, mid, cam }
 * @param {DOMRect|Object} params.containerRect - Bounding client rect of container
 * @param {Function} params.getBounds - Returns viewport camera bounds { minX, maxX, minY, maxY, minZ }
 * @param {Function} params.getPpy - Returns pixels-per-year for a given zoom level
 * @returns {{x: number, y: number, z: number}} New camera position and zoom
 *
 * @example
 * // Pinching outwards from 100px to 150px distance:
 * computePinchCamera({
 *   newDist: 150,
 *   newMid: { x: 200, y: 300 },
 *   pinchState: { dist: 100, mid: { x: 200, y: 300 }, cam: { x: 0, y: 0, z: 1 } },
 *   containerRect: { left: 0, top: 0 },
 *   getBounds: (z) => ({ minZ: 0.1 }),
 *   getPpy: (z) => 8
 * })
 * // => { x: -100, y: -150, z: 1.5 }
 *
 * @example
 * computePinchCamera({
 *   newDist: 100,
 *   newMid: { x: 200, y: 300 },
 *   pinchState: { dist: 100, mid: { x: 200, y: 300 }, cam: { x: 10, y: 20, z: 1 } },
 *   containerRect: null,
 *   getBounds: () => ({ minZ: 0.1 }),
 *   getPpy: () => 8
 * })
 */
function computePinchCamera({ newDist, newMid, pinchState, containerRect, getBounds, getPpy }) {
    const scaleFactor = newDist / pinchState.dist;
    const contLeft = containerRect ? containerRect.left : 0;
    const contTop = containerRect ? containerRect.top : 0;
    const focalX = pinchState.mid.x - contLeft;
    const focalY = pinchState.mid.y - contTop;
    const panDeltaX = newMid.x - pinchState.mid.x;
    const panDeltaY = newMid.y - pinchState.mid.y;

    const baseCam = pinchState.cam;
    const targetZ = baseCam.z * scaleFactor;
    const bounds = getBounds(targetZ);
    const clampedZ = Math.max(bounds.minZ, Math.min(targetZ, 3));

    const { scaleChangeX, scaleChangeY } = calculateZoomScaleChanges(baseCam.z, clampedZ, getPpy);

    const newX = focalX - (focalX - baseCam.x) * scaleChangeX + panDeltaX;
    const newY = focalY - (focalY - baseCam.y) * scaleChangeY + panDeltaY;

    return { x: newX, y: newY, z: clampedZ };
}

/**
 * Computes updated camera coordinates when zooming in or out centered at a specific pointer position,
 * adjusting for variable vertical pixels-per-year scaling.
 *
 * @param {Object} params
 * @param {number} params.pointerX - Cursor X relative to container
 * @param {number} params.pointerY - Cursor Y relative to container
 * @param {{x: number, y: number, z: number}} params.cam - Current camera position and zoom
 * @param {number} params.deltaZ - Zoom delta multiplier exponent (-deltaY * sensitivity)
 * @param {Function} params.getBounds - Camera boundary function
 * @param {Function} params.getPpy - Pixels-per-year calculation function
 * @returns {{x: number, y: number, z: number}}
 *
 * @example
 * computeZoomAtPointer({
 *   pointerX: 400,
 *   pointerY: 300,
 *   cam: { x: 0, y: 0, z: 1 },
 *   deltaZ: 0.1,
 *   getBounds: () => ({ minZ: 0.1 }),
 *   getPpy: () => 8
 * })
 * // => { x: -42.1, y: -31.5, z: 1.105 }
 *
 * @example
 * computeZoomAtPointer({
 *   pointerX: 0,
 *   pointerY: 0,
 *   cam: { x: 0, y: 0, z: 1 },
 *   deltaZ: 0,
 *   getBounds: () => ({ minZ: 0.1 }),
 *   getPpy: () => 8
 * })
 * // => { x: 0, y: 0, z: 1 }
 */
function computeZoomAtPointer({ pointerX, pointerY, cam, deltaZ, getBounds, getPpy }) {
    const newZ = cam.z * Math.exp(deltaZ);
    const bounds = getBounds(newZ);
    const clampedZ = Math.max(bounds.minZ, Math.min(newZ, 3));
    
    const { scaleChangeX, scaleChangeY } = calculateZoomScaleChanges(cam.z, clampedZ, getPpy);
    
    const newX = pointerX - (pointerX - cam.x) * scaleChangeX;
    const newY = pointerY - (pointerY - cam.y) * scaleChangeY;
    
    return { x: newX, y: newY, z: clampedZ };
}

/**
 * Computes the unscaled coordinate bounding box enclosing an array of person node elements
 * relative to the family tree canvas container.
 *
 * @param {Array<string|number>} ids - List of person IDs to include in the bounding box
 * @param {HTMLElement|null} treeElement - Root tree DOM element for coordinate scaling
 * @returns {{minX: number, maxX: number, minY: number, maxY: number, foundCount: number}|null}
 *
 * @example
 * // Two nodes spanning x from 100 to 190 and y from 200 to 276:
 * computePeopleBoundingBox(['p1', 'p2'], treeDiv);
 * // => { minX: 100, maxX: 190, minY: 200, maxY: 276, foundCount: 2 }
 *
 * @example
 * computePeopleBoundingBox([], treeDiv);
 * // => null
 */
function computePeopleBoundingBox(ids, treeElement) {
    if (!treeElement || !ids || ids.length === 0) return null;
    const treeRect = treeElement.getBoundingClientRect();
    const currentScale = treeElement.offsetWidth ? (treeRect.width / treeElement.offsetWidth) : 1;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let foundCount = 0;

    for (const id of ids) {
        const node = document.getElementById(`node-${id}`);
        if (node) {
            foundCount++;
            const nodeRect = node.getBoundingClientRect();
            minX = Math.min(minX, (nodeRect.left - treeRect.left) / currentScale);
            maxX = Math.max(maxX, (nodeRect.right - treeRect.left) / currentScale);
            minY = Math.min(minY, (nodeRect.top - treeRect.top) / currentScale);
            maxY = Math.max(maxY, (nodeRect.bottom - treeRect.top) / currentScale);
        }
    }
    return { minX, maxX, minY, maxY, foundCount };
}

/**
 * Resolves camera zoom level for framed bounding boxes.
 *
 * Preserves preferred zoom if specified, anchors single-person focus to comfortable reading zoom (0.80)
 * if currently outside [0.75, 0.95], or fits multi-node clusters within usable viewport dimensions.
 *
 * @param {Object} params
 * @param {number|null} [params.preferredZ] - Explicit override zoom
 * @param {number} [params.foundCount=1] - Number of target nodes framed in the box
 * @param {number} [params.currentZ=1] - Existing camera zoom level
 * @param {number} [params.usableContW=1000] - Viewport width excluding timeline offset
 * @param {number} [params.neededW=1000] - Target width with horizontal margins
 * @param {number} [params.contH=800] - Viewport height
 * @param {number} [params.neededH=800] - Target height with vertical margins
 * @returns {number} Resolved zoom level (clamped between 0.08 and 0.85 for multi-node fit)
 *
 * @example
 * resolveFramedZoom({ preferredZ: 1.2 })
 * // => 1.2
 *
 * @example
 * resolveFramedZoom({ foundCount: 1, currentZ: 0.5 })
 * // => 0.80
 *
 * @example
 * resolveFramedZoom({ foundCount: 5, usableContW: 1000, neededW: 2000, contH: 800, neededH: 1000 })
 * // => 0.5
 */
function resolveFramedZoom({
    preferredZ = null,
    foundCount = 1,
    currentZ = 1,
    usableContW = 1000,
    neededW = 1000,
    contH = 800,
    neededH = 800
}) {
    if (preferredZ !== null && preferredZ !== undefined) {
        return preferredZ;
    }
    if (foundCount === 1) {
        return (currentZ >= 0.75 && currentZ <= 0.95) ? currentZ : 0.80;
    }
    const maxZ_X = usableContW / neededW;
    const maxZ_Y = contH / neededH;
    return Math.min(0.85, Math.max(0.08, Math.min(maxZ_X, maxZ_Y)));
}

/**
 * Calculates the horizontal camera translation (X) so that the focused tree or box
 * is visually centered within the available viewport width.
 *
 * Centering calculation accounts for timeline gutter offset, and centers the entire
 * tree if it fits within the usable viewport width.
 *
 * @example
 * resolveFramedCameraX(840, 48, 550, 0.8, 155) // => 224
 *
 * @example
 * resolveFramedCameraX(840, 48, 1200, 1, 600) // => -132
 *
 * @param {number} usableContW - Usable container width
 * @param {number} timelineWidth - Left timeline width offset
 * @param {number} treeW - Unscaled tree width
 * @param {number} finalZ - Target camera zoom factor
 * @param {number} boxCenterX - Center X of the framed bounding box
 * @returns {number} Camera X position
 */
function resolveFramedCameraX(usableContW, timelineWidth, treeW, finalZ, boxCenterX) {
    const visualCenterX = timelineWidth + usableContW / 2;
    const isTreeFitting = treeW > 0 && (treeW * finalZ <= usableContW);
    return isTreeFitting
        ? timelineWidth + (usableContW - treeW * finalZ) / 2
        : visualCenterX - (boxCenterX * finalZ);
}

/**
 * Resolves bounding dimensions and padding needs for framing a target box.
 *
 * @param {Object} options
 * @param {Object} options.box - Target bounding box { minX, maxX, minY, maxY }.
 * @param {number} [options.minBoxW=90] - Minimum box width clamp.
 * @param {number} [options.minBoxH=76] - Minimum box height clamp.
 * @param {number} [options.targetPadX=100] - Horizontal padding.
 * @param {number} [options.targetPadY=120] - Vertical padding.
 * @param {number} [options.contW=1000] - Container viewport width.
 * @param {number} [options.timelineWidth=48] - Left timeline width offset.
 * @returns {{ boxCenterX: number, boxCenterY: number, usableContW: number, neededW: number, neededH: number }}
 *
 * @example
 * resolveFramedBoxMetrics({ box: { minX: 0, maxX: 100, minY: 0, maxY: 80 }, minBoxW: 90, minBoxH: 76, targetPadX: 100, targetPadY: 120, contW: 1000, timelineWidth: 48 });
 * // => { boxCenterX: 50, boxCenterY: 40, usableContW: 952, neededW: 300, neededH: 320 }
 *
 * @example
 * resolveFramedBoxMetrics({ box: { minX: 10, maxX: 20, minY: 10, maxY: 20 }, contW: 800 });
 * // => { boxCenterX: 15, boxCenterY: 15, ... }
 */
function resolveFramedBoxMetrics({
    box,
    minBoxW = 90,
    minBoxH = 76,
    targetPadX = 100,
    targetPadY = 120,
    contW = 1000,
    timelineWidth = 48
}) {
    const boxW = Math.max(minBoxW, box.maxX - box.minX);
    const boxH = Math.max(minBoxH, box.maxY - box.minY);
    const boxCenterX = (box.minX + box.maxX) / 2;
    const boxCenterY = (box.minY + box.maxY) / 2;
    const usableContW = Math.max(100, contW - timelineWidth);
    const neededW = boxW + targetPadX * 2;
    const neededH = boxH + targetPadY * 2;
    return { boxCenterX, boxCenterY, usableContW, neededW, neededH };
}

/**
 * Calculates the target camera position (x, y) and zoom (z) to neatly frame a bounding box
 * centered in the available viewport.
 *
 * @param {Object} params
 * @param {{minX: number, maxX: number, minY: number, maxY: number, foundCount: number}} params.box - Target bounding box
 * @param {number} params.contW - Viewport width
 * @param {number} params.contH - Viewport height
 * @param {number|null} [params.preferredZ] - Explicit preferred zoom level, if any
 * @param {number} params.currentZ - Current camera zoom level
 * @param {number} [params.timelineWidth=48] - Left timeline gutter offset
 * @param {number} [params.targetPadX=100] - Horizontal padding around framed box
 * @param {number} [params.targetPadY=120] - Vertical padding around framed box
 * @param {number} [params.minBoxW=90] - Minimum width of framed bounding box
 * @param {number} [params.minBoxH=76] - Minimum height of framed bounding box
 * @returns {{x: number, y: number, z: number}}
 *
 * @example
 * computeFramedCamera({
 *   box: { minX: 0, maxX: 200, minY: 0, maxY: 300, foundCount: 1 },
 *   contW: 1000,
 *   contH: 800,
 *   preferredZ: null,
 *   currentZ: 0.8
 * })
 * // => { x: 424, y: 280, z: 0.8 }
 *
 * @example
 * computeFramedCamera({
 *   box: { minX: 0, maxX: 100, minY: 0, maxY: 100, foundCount: 1 },
 *   contW: 800,
 *   contH: 600,
 *   preferredZ: 1.0,
 *   currentZ: 1.0
 * })
 */
function computeFramedCamera({
    box, contW, contH, preferredZ = null, currentZ = 1,
    timelineWidth = 48, targetPadX = 100, targetPadY = 120,
    minBoxW = 90, minBoxH = 76, treeW = null
}) {
    const { boxCenterX, boxCenterY, usableContW, neededW, neededH } = resolveFramedBoxMetrics({
        box, minBoxW, minBoxH, targetPadX, targetPadY, contW, timelineWidth
    });

    const finalZ = resolveFramedZoom({
        preferredZ, foundCount: box.foundCount, currentZ,
        usableContW, neededW, contH, neededH
    });

    return {
        x: resolveFramedCameraX(usableContW, timelineWidth, treeW, finalZ, boxCenterX),
        y: (contH * 0.50) - (boxCenterY * finalZ),
        z: finalZ
    };
}

/**
 * Calculates fit-to-screen target camera zoom and (x, y) coordinates.
 *
 * @param {Object} params
 * @param {number} params.treeW - Tree unscaled width
 * @param {number} params.usableContW - Usable container width
 * @param {number} [params.timelineWidth=48] - Timeline offset
 * @param {number} [params.paddingX=8] - Horizontal padding
 * @param {number} [params.topMargin=16] - Top margin offset
 * @returns {{x: number, y: number, z: number}}
 *
 * @example
 * computeFitToScreenCamera({ treeW: 1000, usableContW: 800, timelineWidth: 48 })
 * // => { x: 56, y: 16, z: 0.784 }
 *
 * @example
 * computeFitToScreenCamera({ treeW: 0, usableContW: 800 })
 * // => { x: 0, y: 16, z: 1 }
 */
function computeFitToScreenCamera({ treeW, usableContW, timelineWidth = 48, paddingX = 8, topMargin = 16 }) {
    if (treeW <= 0) return { x: 0, y: topMargin, z: 1 };
    const targetZ = Math.max(0.05, Math.min((usableContW - paddingX * 2) / treeW, 1));
    const scaledW = treeW * targetZ;
    const targetX = scaledW <= usableContW
        ? timelineWidth + (usableContW - scaledW) / 2
        : timelineWidth + paddingX;
    return { x: targetX, y: topMargin, z: targetZ };
}

/**
 * Calculates dynamically stretched pixels-per-year for timeline scaling based on viewport height and tree year span.
 *
 * @param {Object} treeStats - Family tree statistics (rootNodeYob, maxYear, minYear)
 * @param {number} contH - Container/viewport height
 * @param {number} z - Camera zoom scale
 * @param {number} [topMargin=16] - Top margin offset
 * @param {number} [bottomMargin=0] - Bottom margin offset
 * @returns {number} Calculated pixels-per-year (at least nativePpy = 8)
 *
 * @example
 * computeDynamicPpy({ minYear: 1900, maxYear: 2000, rootNodeYob: 1900 }, 800, 1)
 * // => 8
 *
 * @example
 * computeDynamicPpy(null, 800, 1)
 * // => 8
 */
function computeDynamicPpy(treeStats, contH, z, topMargin = 16, bottomMargin = 0) {
    const nativePpy = 8;
    if (!treeStats || !treeStats.minYear) return nativePpy;
    const spanYears = Math.max(5, treeStats.maxYear - treeStats.rootNodeYob);
    const stretchedPpy = ((contH - bottomMargin - topMargin) / z - 86) / spanYears;
    return Math.max(nativePpy, stretchedPpy);
}

/**
 * Computes boundary clamp limits for canvas camera panning and zooming.
 *
 * @param {Object} params
 * @param {number} params.treeW - Tree unscaled width
 * @param {number} params.treeH - Tree unscaled height
 * @param {number} params.contW - Viewport width
 * @param {number} params.contH - Viewport height
 * @param {number} params.z - Camera zoom scale
 * @param {number} [params.timelineWidth=48] - Left timeline offset
 * @param {number} [params.paddingX=8] - Panning horizontal margin
 * @param {number} [params.topMargin=16] - Panning top margin
 * @param {number} [params.bottomMargin=0] - Panning bottom margin
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, centeredX: number }}
 *
 * @example
 * computeCameraBounds({ treeW: 1000, treeH: 600, contW: 800, contH: 600, z: 1, timelineWidth: 48 })
 * // => { minX: -208, maxX: 56, minY: 16, maxY: 16, minZ: 0.736, centeredX: 48 }
 *
 * @example
 * computeCameraBounds({ treeW: 200, treeH: 200, contW: 800, contH: 600, z: 1 })
 * // => { minX: 324, maxX: 324, minY: 16, maxY: 16, minZ: 1, centeredX: 324 }
 */
function computeCameraBounds({
    treeW,
    treeH,
    contW,
    contH,
    z,
    timelineWidth = 48,
    paddingX = 8,
    topMargin = 16,
    bottomMargin = 0
}) {
    const usableContW = Math.max(100, contW - timelineWidth);
    const usableH = Math.max(100, contH - topMargin - bottomMargin);

    const minZ = Math.max(0.05, Math.min((usableContW - paddingX * 2) / Math.max(1, treeW), 1));
    const scaledW = treeW * z;
    const scaledH = treeH * z;

    const centeredX = timelineWidth + (usableContW - scaledW) / 2;

    let minX = scaledW <= usableContW ? centeredX : contW - scaledW - paddingX;
    let maxX = scaledW <= usableContW ? centeredX : timelineWidth + paddingX;
    let minY = scaledH <= usableH ? topMargin : contH - scaledH - bottomMargin;
    let maxY = scaledH <= usableH ? topMargin : topMargin;

    return { minX, maxX, minY, maxY, minZ, centeredX };
}

/**
 * Resolves the actual layout width of the tree DOM element, taking into account compact tree view if present.
 *
 * @param {HTMLElement|null} treeElement - The root tree DOM container.
 * @returns {number} Width in pixels, or 0 if element is not mounted.
 *
 * @example
 * getTreeElementWidth(document.getElementById('tree-view'));
 * // => 1420
 *
 * @example
 * getTreeElementWidth(null);
 * // => 0
 */
function getTreeElementWidth(treeElement) {
    if (!treeElement) return 0;
    const compactTree = treeElement.querySelector?.('.compact-tree-view');
    return compactTree
        ? (compactTree.offsetWidth || parseFloat(compactTree.style.width) || treeElement.scrollWidth)
        : treeElement.scrollWidth;
}

/**
 * Computes the Euclidean distance and midpoint between two 2D coordinates.
 *
 * @param {{ x: number, y: number }} p1 - First coordinate.
 * @param {{ x: number, y: number }} p2 - Second coordinate.
 * @returns {{ dist: number, mid: { x: number, y: number } }} Distance and midpoint.
 *
 * @example
 * calculateTwoPointGeometry({ x: 0, y: 0 }, { x: 3, y: 4 });
 * // => { dist: 5, mid: { x: 1.5, y: 2 } }
 *
 * @example
 * calculateTwoPointGeometry({ x: 10, y: 10 }, { x: 10, y: 20 });
 * // => { dist: 10, mid: { x: 10, y: 15 } }
 */
function calculateTwoPointGeometry(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return { dist, mid };
}

/**
 * Resolves container viewport dimensions accounting for sidebar state, window bounds, and standalone mode.
 *
 * @param {Object} options
 * @param {HTMLElement|null} options.container - Container DOM element.
 * @param {boolean} [options.isSidebarOpen=false] - Whether sidebar is open.
 * @param {number} [options.sidebarWidth=360] - Width of sidebar in pixels.
 * @param {boolean} [options.forceFullWindow=false] - If true, ignores sidebar and uses full window.
 * @returns {{ contW: number, contH: number }} Viewport width and height.
 *
 * @example
 * resolveViewportDimensions({ isSidebarOpen: false });
 * // => { contW: 1024, contH: 768 }
 *
 * @example
 * resolveViewportDimensions({ isSidebarOpen: true, sidebarWidth: 400 });
 * // => { contW: 624, contH: 768 }
 */
function resolveViewportDimensions({
    container,
    isSidebarOpen = false,
    sidebarWidth = 360,
    forceFullWindow = false
}) {
    const hasWindow = typeof window !== 'undefined';
    const effectiveContW = (isSidebarOpen && hasWindow)
        ? (window.innerWidth - (sidebarWidth || 360))
        : (container ? container.clientWidth : (hasWindow ? window.innerWidth : 1000));
    const contW = (forceFullWindow && hasWindow) ? window.innerWidth : effectiveContW;
    const contH = (forceFullWindow || !isSidebarOpen) && hasWindow
        ? window.innerHeight
        : (container ? container.clientHeight : (hasWindow ? window.innerHeight : 800));
    return { contW, contH };
}

/**
 * Attaches touch event listeners for pinch-to-zoom to the canvas container and returns a cleanup callback.
 *
 * @param {HTMLElement} container - Canvas container element.
 * @param {Function} onTouchStart - Touch start event handler.
 * @param {Function} onTouchMove - Touch move event handler.
 * @param {Function} onTouchEnd - Touch end event handler.
 * @returns {() => void} Cleanup function removing attached listeners.
 *
 * @example
 * const cleanup = bindCanvasTouchEvents(container, () => {}, () => {}, () => {});
 *
 * @example
 * const cleanup = bindCanvasTouchEvents(document.body, () => {}, () => {}, () => {});
 */
function bindCanvasTouchEvents(container, onTouchStart, onTouchMove, onTouchEnd) {
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        container.removeEventListener('touchcancel', onTouchEnd);
    };
}

/**
 * Calculates distance and midpoint geometry between the first two touch points of a touch event.
 *
 * @param {TouchList|Touch[]} touches - Active touch points list.
 * @returns {{ dist: number, mid: { x: number, y: number } }} Distance and midpoint coordinates.
 *
 * @example
 * const geom = getTouchPinchGeometry(e.touches);
 *
 * @example
 * const geom = getTouchPinchGeometry([t1, t2]);
 */
function getTouchPinchGeometry(touches) {
    const p1 = { x: touches[0].clientX, y: touches[0].clientY };
    const p2 = { x: touches[1].clientX, y: touches[1].clientY };
    return calculateTwoPointGeometry(p1, p2);
}

/**
 * Processes a 2-finger touch pinch movement and calculates the clamped next camera state.
 *
 * @param {Object} params
 * @param {TouchList} params.touches - Active touch list
 * @param {Object} params.touchPinch - Current active pinch reference state
 * @param {Element} params.container - Viewport container element
 * @param {Function} params.getBounds - Camera bounds getter
 * @param {Function} params.getPpy - Pixels-per-year getter
 * @param {Function} params.clampCamera - Coordinate clamping function
 * @returns {Object|null} Clamped next camera state, or null if pinch is invalid
 *
 * @example
 * const next = processTouchPinchMove({ touches, touchPinch, container, getBounds, getPpy, clampCamera });
 *
 * @example
 * const next = processTouchPinchMove({ touches: [], touchPinch: null });
 * // => null
 */
function processTouchPinchMove({ touches, touchPinch, container, getBounds, getPpy, clampCamera }) {
    if (!touches || touches.length !== 2 || !touchPinch || touchPinch.dist <= 10) return null;
    const { dist: newDist, mid: newMid } = getTouchPinchGeometry(touches);
    const containerRect = container.getBoundingClientRect();
    const nextCam = computePinchCamera({
        newDist, newMid, pinchState: touchPinch, containerRect, getBounds, getPpy
    });
    return clampCamera(nextCam);
}

/**
 * Initializes touch pinch tracking state from a two-finger touch event and triggers interaction callback.
 *
 * @param {TouchList} touches - TouchList with two active touches
 * @param {Object} cameraRef - React ref holding current camera coordinates
 * @param {Function} [onInteract] - Optional interaction callback
 * @returns {Object} Initial pinch state containing distance, midpoint, and snapshot camera
 *
 * @example
 * const pinch = initTouchPinchState(e.touches, cameraRef, onInteract);
 * // => { dist: 120, mid: { x: 100, y: 150 }, cam: { x: 0, y: 0, z: 1 } }
 *
 * @example
 * const pinch = initTouchPinchState(e.touches, { current: { x: 10, y: 20, z: 1.5 } });
 * // => { dist: 85, mid: { x: 50, y: 75 }, cam: { x: 10, y: 20, z: 1.5 } }
 */
function initTouchPinchState(touches, cameraRef, onInteract) {
    const { dist, mid } = getTouchPinchGeometry(touches);
    if (onInteract) onInteract();
    return { dist, mid, cam: { ...cameraRef.current } };
}

/**
 * Registers multi-touch pinch-to-zoom and pan gesture listeners on the tree canvas container.
 *
 * @param {object} params
 * @param {HTMLElement} params.container - Canvas viewport container element
 * @param {Function} params.onInteract - Callback invoked when user interacts with canvas
 * @param {React.MutableRefObject} params.cameraRef - Ref storing current camera coordinates
 * @param {Function} params.setCamera - Camera state setter
 * @param {Function} params.clampCamera - Boundary clamping function
 * @param {Function} params.getBounds - Dynamic camera boundaries getter
 * @param {Function} params.getPpy - Dynamic pixels-per-year getter
 * @returns {Function} Cleanup function removing attached event listeners
 *
 * @example
 * useEffect(() => {
 *     return setupCanvasTouchListeners({
 *         container: containerRef.current,
 *         onInteract,
 *         cameraRef,
 *         setCamera,
 *         clampCamera,
 *         getBounds,
 *         getPpy
 *     });
 * }, [clampCamera, getBounds, getPpy, onInteract]);
 *
 * @example
 * const cleanup = setupCanvasTouchListeners({ container: null });
 * // returns empty no-op function
 */
function setupCanvasTouchListeners({
    container, onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy
}) {
    if (!container) return () => {};
    let touchPinch = null;

    const onTouchStart = (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        touchPinch = initTouchPinchState(e.touches, cameraRef, onInteract);
    };

    const onTouchMove = (e) => {
        const nextCam = processTouchPinchMove({
            touches: e.touches, touchPinch, container, getBounds, getPpy, clampCamera
        });
        if (nextCam) {
            e.preventDefault();
            setCamera(nextCam);
        }
    };

    const onTouchEnd = (e) => { if (e.touches.length < 2) touchPinch = null; };

    return bindCanvasTouchEvents(container, onTouchStart, onTouchMove, onTouchEnd);
}

/**
 * Resolves viewport dimensions and updates camera coordinates to enclose a bounding box of people.
 *
 * @param {object} params
 * @param {object} params.box - Computed bounding box of people nodes
 * @param {HTMLElement} params.treeElement - Inner tree DOM element
 * @param {HTMLElement} params.container - Outer canvas container DOM element
 * @param {boolean} params.isSidebarOpen - Whether the sidebar is currently open
 * @param {number} params.sidebarWidth - Width of the sidebar in pixels
 * @param {number|null} params.preferredZ - Optional forced zoom level
 * @param {number} params.targetPadX - Horizontal padding in pixels
 * @param {number} params.targetPadY - Vertical padding in pixels
 * @param {Function} params.setCamera - State setter for camera coordinates
 * @param {Function} params.clampCamera - Function clamping camera coordinates to viewport bounds
 *
 * @example
 * applyFramedCamera({
 *   box: { minX: 0, maxX: 400, minY: 0, maxY: 300, foundCount: 2 },
 *   treeElement: document.getElementById('tree'),
 *   container: document.getElementById('canvas'),
 *   isSidebarOpen: false,
 *   sidebarWidth: 360,
 *   preferredZ: 1,
 *   targetPadX: 50,
 *   targetPadY: 50,
 *   setCamera: (fn) => {},
 *   clampCamera: (cam) => cam
 * });
 *
 * @example
 * // Apply camera centering with auto zoom
 * applyFramedCamera({
 *   box: { minX: 10, maxX: 500, minY: 20, maxY: 600, foundCount: 5 },
 *   treeElement: document.getElementById('tree'),
 *   container: document.getElementById('canvas'),
 *   isSidebarOpen: true,
 *   sidebarWidth: 400,
 *   preferredZ: null,
 *   targetPadX: 100,
 *   targetPadY: 120,
 *   setCamera: (fn) => {},
 *   clampCamera: (cam) => cam
 * });
 */
function applyFramedCamera({
    box, treeElement, container, isSidebarOpen, sidebarWidth,
    preferredZ, targetPadX, targetPadY, setCamera, clampCamera
}) {
    const { contW: effectiveContW, contH } = resolveViewportDimensions({
        container, isSidebarOpen, sidebarWidth, forceFullWindow: false
    });
    const currentTreeW = getTreeElementWidth(treeElement);

    setCamera(cam => {
        const nextCam = computeFramedCamera({
            box, contW: effectiveContW, contH, preferredZ,
            currentZ: cam.z, targetPadX, targetPadY, treeW: currentTreeW
        });
        return clampCamera(nextCam);
    });
}

/**
 * Resolves configuration parameters with default values for polling and framing people nodes.
 *
 * @param {number|Object|null} options - Optional preferred zoom level number or options object.
 * @returns {{
 *   preferredZ: number|null,
 *   targetPadX: number,
 *   targetPadY: number,
 *   maxAttempts: number,
 *   intervalMs: number,
 *   initialDelay: number
 * }} Normalized polling configuration options.
 *
 * @example
 *   resolveFramePeopleOptions(1.5);
 *   // returns { preferredZ: 1.5, targetPadX: 100, targetPadY: 120, maxAttempts: 35, intervalMs: 35, initialDelay: 25 }
 *
 * @example
 *   resolveFramePeopleOptions({ targetPadX: 80, maxAttempts: 20 });
 *   // returns { preferredZ: null, targetPadX: 80, targetPadY: 120, maxAttempts: 20, intervalMs: 35, initialDelay: 25 }
 */
function resolveFramePeopleOptions(options) {
    const preferredZ = typeof options === 'number' ? options : options?.preferredZ ?? null;
    const targetPadX = options?.targetPadX ?? 100;
    const targetPadY = options?.targetPadY ?? 120;
    const maxAttempts = options?.maxAttempts ?? 35;
    const intervalMs = options?.intervalMs ?? 35;
    const initialDelay = options?.initialDelay ?? 25;

    return { preferredZ, targetPadX, targetPadY, maxAttempts, intervalMs, initialDelay };
}

/**
 * Attempts to locate target people in the tree and apply framed camera coordinates.
 *
 * @param {Object} params
 * @param {string[]} params.ids - Array of person profile IDs to frame.
 * @param {HTMLElement|null} params.treeElement - DOM element of tree container.
 * @param {HTMLElement|null} params.container - DOM element of viewport container.
 * @param {boolean} params.isSidebarOpen - Whether sidebar details panel is open.
 * @param {number} params.sidebarWidth - Width of sidebar in pixels.
 * @param {number} params.preferredZ - Preferred zoom level.
 * @param {number} params.targetPadX - Target horizontal padding.
 * @param {number} params.targetPadY - Target vertical padding.
 * @param {Function} params.setCamera - State setter for camera coordinates.
 * @param {Function} params.clampCamera - Clamping function for camera coordinates.
 * @returns {boolean} True if framing was successfully applied.
 *
 * @example
 * attemptFramePeople({ ids: ['p1'], treeElement: el, container: c, isSidebarOpen: false, sidebarWidth: 360, preferredZ: 1, targetPadX: 40, targetPadY: 40, setCamera: () => {}, clampCamera: c => c });
 *
 * @example
 * attemptFramePeople({ ids: [], treeElement: null, container: null, isSidebarOpen: false, sidebarWidth: 360, preferredZ: 1, targetPadX: 40, targetPadY: 40, setCamera: () => {}, clampCamera: c => c });
 */
function attemptFramePeople({
    ids, treeElement, container, isSidebarOpen, sidebarWidth,
    preferredZ, targetPadX, targetPadY, setCamera, clampCamera
}) {
    if (!treeElement || !container) return false;
    const box = computePeopleBoundingBox(ids, treeElement);
    if (box && box.foundCount < ids.length) return false;
    if (box && box.foundCount > 0) {
        applyFramedCamera({
            box, treeElement, container, isSidebarOpen,
            sidebarWidth, preferredZ, targetPadX, targetPadY, setCamera, clampCamera
        });
        return true;
    }
    return false;
}

/**
 * Executes a polling retry loop to frame a collection of person node IDs in the canvas
 * once their DOM elements are rendered and their bounding boxes are measurable.
 *
 * @param {Object} params
 * @param {string[]} params.ids - Array of person IDs to frame.
 * @param {Object|number|null} [params.options] - Configuration options or preferred zoom level.
 * @param {React.RefObject} params.treeRef - Ref to family tree container element.
 * @param {React.RefObject} params.containerRef - Ref to canvas viewport container element.
 * @param {boolean} [params.isSidebarOpen=false] - Whether sidebar is open.
 * @param {number} [params.sidebarWidth=360] - Width of sidebar in pixels.
 * @param {Function} params.setCamera - State setter for camera.
 * @param {Function} params.clampCamera - Clamping function for camera coordinates.
 * @returns {number|null} Initial timer ID from setTimeout or null if empty ids.
 *
 * @example
 * const timerId = pollFramePeople({
 *     ids: ['p1', 'p2'],
 *     options: { preferredZ: 1.0 },
 *     treeRef,
 *     containerRef,
 *     isSidebarOpen: false,
 *     sidebarWidth: 360,
 *     setCamera,
 *     clampCamera
 * });
 *
 * @example
 * // With custom attempts and delay
 * pollFramePeople({
 *     ids: ['root'],
 *     options: { maxAttempts: 10, intervalMs: 20, initialDelay: 10 },
 *     treeRef,
 *     containerRef,
 *     isSidebarOpen: true,
 *     sidebarWidth: 400,
 *     setCamera,
 *     clampCamera
 * });
 */
function pollFramePeople({
    ids, options = null, treeRef, containerRef,
    isSidebarOpen = false, sidebarWidth = 360, setCamera, clampCamera
}) {
    if (!ids || ids.length === 0) return null;
    const { preferredZ, targetPadX, targetPadY, maxAttempts, intervalMs, initialDelay } = resolveFramePeopleOptions(options);

    let attempts = 0;
    const tryFrame = () => {
        attempts++;
        const framed = attemptFramePeople({
            ids, treeElement: treeRef.current, container: containerRef.current, isSidebarOpen,
            sidebarWidth, preferredZ, targetPadX, targetPadY, setCamera, clampCamera
        });
        if (!framed && attempts < maxAttempts) {
            setTimeout(tryFrame, intervalMs);
        }
    };

    return setTimeout(tryFrame, initialDelay);
}

/**
 * Performs a single measurement and camera update to refine canvas fit-to-screen geometry.
 *
 * @param {Object} params
 * @param {React.RefObject} params.treeRef - Ref to family tree container element.
 * @param {React.RefObject} params.containerRef - Ref to canvas viewport container element.
 * @param {Function} params.setCamera - State setter for camera.
 * @param {boolean} [params.isSidebarOpen=false] - Whether sidebar is open.
 * @param {number} [params.sidebarWidth=360] - Width of sidebar in pixels.
 * @param {boolean} [params.forceFullWindow=false] - Whether to use full window dimensions.
 * @param {number} [params.timelineWidth=48] - Width offset for timeline bar.
 * @param {number} [params.paddingX=8] - Horizontal padding.
 * @param {number} [params.topMargin=16] - Top margin offset.
 *
 * @example
 * performFitToScreenRefinement({
 *     treeRef: { current: null },
 *     containerRef: { current: null },
 *     setCamera: () => {}
 * });
 *
 * @example
 * performFitToScreenRefinement({
 *     treeRef: { current: document.createElement('div') },
 *     containerRef: { current: document.createElement('div') },
 *     setCamera: (cam) => console.log(cam),
 *     isSidebarOpen: true
 * });
 */
function performFitToScreenRefinement({
    treeRef, containerRef, setCamera, isSidebarOpen = false, sidebarWidth = 360,
    forceFullWindow = false, timelineWidth = 48, paddingX = 8, topMargin = 16
}) {
    if (!treeRef?.current || !containerRef?.current) return;
    const dims = resolveViewportDimensions({
        container: containerRef.current, isSidebarOpen, sidebarWidth, forceFullWindow
    });
    const updatedTreeW = getTreeElementWidth(treeRef.current);
    if (updatedTreeW > 0) {
        const usableContW = Math.max(100, dims.contW - timelineWidth);
        setCamera(computeFitToScreenCamera({
            treeW: updatedTreeW, usableContW, timelineWidth, paddingX, topMargin
        }));
    }
}

/**
 * Schedules two-stage delayed camera refinement passes (at 50ms and 350ms)
 * after a fit-to-screen invocation to allow re-render and CSS transitions to settle.
 *
 * @param {Object} params
 * @param {React.RefObject} params.treeRef - Ref to family tree container element.
 * @param {React.RefObject} params.containerRef - Ref to canvas viewport container element.
 * @param {Function} params.setCamera - State setter for camera.
 * @param {boolean} [params.isSidebarOpen=false] - Whether sidebar is open.
 * @param {number} [params.sidebarWidth=360] - Width of sidebar in pixels.
 * @param {boolean} [params.forceFullWindow=false] - Whether to use full window dimensions.
 * @param {number} [params.timelineWidth=48] - Width offset for timeline bar.
 * @param {number} [params.paddingX=8] - Horizontal padding.
 * @param {number} [params.topMargin=16] - Top margin offset.
 * @returns {Array<number>} Array of timeout IDs.
 *
 * @example
 * const timerIds = scheduleFitToScreenRefinement({
 *     treeRef,
 *     containerRef,
 *     setCamera,
 *     isSidebarOpen: true,
 *     sidebarWidth: 360,
 *     forceFullWindow: false,
 *     timelineWidth: 48,
 *     paddingX: 8,
 *     topMargin: 16
 * });
 *
 * @example
 * // Cleanup refinement timers if needed
 * const timers = scheduleFitToScreenRefinement({
 *     treeRef,
 *     containerRef,
 *     setCamera
 * });
 * timers.forEach(clearTimeout);
 */
function scheduleFitToScreenRefinement(params) {
    const refine = () => performFitToScreenRefinement(params);
    const t1 = setTimeout(refine, 50);
    const t2 = setTimeout(refine, 350);
    return [t1, t2];
}

/**
 * Sets up a ResizeObserver on the canvas container and tree elements to re-clamp
 * camera coordinates when the container viewport resizes (e.g. window resize or sidebar toggle),
 * while ignoring layout-induced tree dimension changes.
 *
 * @param {Object} params
 * @param {React.RefObject} params.containerRef - Ref to container element.
 * @param {React.RefObject} params.treeRef - Ref to tree element.
 * @param {Function} params.setCamera - State setter for camera.
 * @param {Function} params.clampCamera - Clamping function for camera coordinates.
 * @returns {Function} Cleanup function to cancel pending rAF and disconnect ResizeObserver.
 *
 * @example
 * const cleanup = setupCanvasResizeObserver({
 *     containerRef,
 *     treeRef,
 *     setCamera,
 *     clampCamera
 * });
 * // On cleanup:
 * cleanup();
 *
 * @example
 * useEffect(() => {
 *     return setupCanvasResizeObserver({
 *         containerRef,
 *         treeRef,
 *         setCamera,
 *         clampCamera
 *     });
 * }, [clampCamera]);
 */
function setupCanvasResizeObserver({
    containerRef,
    treeRef,
    setCamera,
    clampCamera
}) {
    if (typeof ResizeObserver === 'undefined') return () => {};
    let rafId;
    const ro = new ResizeObserver((entries) => {
        const isContainerResize = !entries || entries.some(entry => entry.target === containerRef.current);
        if (!isContainerResize) return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            setCamera(cam => clampCamera(cam));
        });
    });

    if (containerRef.current) ro.observe(containerRef.current);
    if (treeRef.current) ro.observe(treeRef.current);

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
        ro.disconnect();
    };
}