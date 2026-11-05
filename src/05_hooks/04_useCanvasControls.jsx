
/**
 * Hook generating a wheel event listener to handle zoom-at-pointer interactions on the canvas.
 *
 * @param {object} params
 * @param {Function} [params.onInteract] - Callback invoked on interaction
 * @param {React.RefObject<HTMLElement>} params.containerRef - Ref to outer canvas container DOM node
 * @param {React.Dispatch<React.SetStateAction<object>>} params.setCamera - State setter for camera coordinates
 * @param {(cam: object) => object} params.clampCamera - Coordinate clamping function
 * @param {Function} params.getBounds - Returns canvas boundary dimensions
 * @param {Function} params.getPpy - Returns current pixels-per-year zoom scale
 * @returns {(e: React.WheelEvent) => void} Wheel event handler
 *
 * @example
 * const handleWheel = useCanvasWheelZoom({ onInteract, containerRef, setCamera, clampCamera, getBounds, getPpy });
 *
 * @example
 * <div onWheel={handleWheel} />
 */
function useCanvasWheelZoom({ onInteract, containerRef, setCamera, clampCamera, getBounds, getPpy }) {
    return useCallback((e) => {
        if (e.target.closest('.interactive-element')) return;
        
        const cont = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 };
        const pointerX = e.clientX - cont.left;
        const pointerY = e.clientY - cont.top;
        const zoomSensitivity = 0.002;
        const deltaZ = -e.deltaY * zoomSensitivity;
        
        setCamera(cam => {
            const nextCam = computeZoomAtPointer({
                pointerX,
                pointerY,
                cam,
                deltaZ,
                getBounds,
                getPpy
            });
            return clampCamera(nextCam);
        });
    }, [clampCamera, getBounds, getPpy, setCamera, containerRef]);
}

/**
 * Dispatches pointer move updates, either updating multi-touch pinch zoom geometry
 * or panning the camera according to single-finger / single-mouse dragging.
 *
 * @param {object} params
 * @param {React.PointerEvent} params.e - Native pointermove event
 * @param {React.MutableRefObject<Map<number, {x: number, y: number, startX?: number, startY?: number, moved?: boolean}>>} params.activePointersRef - Active pointers map
 * @param {React.MutableRefObject<object|null>} params.pointerPinchRef - Multi-touch pinch tracking state
 * @param {boolean} params.isDragging - Whether single pointer drag is active
 * @param {{x: number, y: number}} params.dragStart - Drag origin coordinates
 * @param {React.RefObject<HTMLElement>} params.containerRef - Canvas container ref
 * @param {Function} params.getBounds - Boundary calculator
 * @param {Function} params.getPpy - Pixels-per-year calculator
 * @param {React.Dispatch<React.SetStateAction<object>>} params.setCamera - Camera setter
 * @param {Function} params.clampCamera - Boundary clamper
 *
 * @example
 * processPointerMove({
 *   e: { pointerId: 1, clientX: 100, clientY: 100 },
 *   activePointersRef: { current: new Map() },
 *   pointerPinchRef: { current: null },
 *   isDragging: false,
 *   dragStart: { x: 0, y: 0 },
 *   containerRef: { current: null },
 *   getBounds: () => ({}),
 *   getPpy: () => 10,
 *   setCamera: () => {},
 *   clampCamera: c => c
 * });
 *
 * @example
 * processPointerMove({
 *   e: { pointerId: 1, clientX: 200, clientY: 200 },
 *   activePointersRef: { current: new Map([[1, { x: 100, y: 100 }]]) },
 *   pointerPinchRef: { current: null },
 *   isDragging: true,
 *   dragStart: { x: 0, y: 0 },
 *   containerRef: { current: null },
 *   getBounds: () => ({}),
 *   getPpy: () => 10,
 *   setCamera: () => {},
 *   clampCamera: c => c
 * });
 */
function processPointerMove({
    e, activePointersRef, pointerPinchRef, isDragging, dragStart,
    containerRef, getBounds, getPpy, setCamera, clampCamera
}) {
    const prev = activePointersRef.current.get(e.pointerId);
    if (!prev) return;
    const startX = prev.startX !== undefined ? prev.startX : prev.x;
    const startY = prev.startY !== undefined ? prev.startY : prev.y;
    const moved = Boolean(prev.moved) || activePointersRef.current.size > 1 || Math.hypot(e.clientX - startX, e.clientY - startY) > 5;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, startX, startY, moved });

    if (activePointersRef.current.size === 2 && pointerPinchRef.current && pointerPinchRef.current.dist > 10) {
        const [p1, p2] = Array.from(activePointersRef.current.values());
        const { dist: newDist, mid: newMid } = calculateTwoPointGeometry(p1, p2);
        const containerRect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 };
        const nextCam = computePinchCamera({
            newDist, newMid, pinchState: pointerPinchRef.current,
            containerRect, getBounds, getPpy
        });
        setCamera(clampCamera(nextCam));
    } else if (activePointersRef.current.size === 1 && isDragging) {
        setCamera(cam => clampCamera({ ...cam, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    }
}

/**
 * Handles pointer release or cancellation by clearing pointer tracking state,
 * adjusting the active pinch anchor, ending drag interactions, and invoking `onInteract`
 * when a single-pointer click on the empty canvas completes without dragging.
 *
 * @param {object} params
 * @param {React.PointerEvent} params.e - Native pointerup event
 * @param {React.MutableRefObject<Map<number, {x: number, y: number, startX?: number, startY?: number, moved?: boolean}>>} params.activePointersRef - Active pointers map
 * @param {React.MutableRefObject<object|null>} params.pointerPinchRef - Multi-touch pinch tracking state
 * @param {React.MutableRefObject<object>} params.cameraRef - Current camera coordinates ref
 * @param {Function} params.setDragStart - Setter for drag origin
 * @param {Function} params.setIsDragging - Setter for drag state
 * @param {Function} [params.onInteract] - Callback invoked on clean background tap/click
 *
 * @example
 * processPointerUp({
 *   e: { pointerId: 1, currentTarget: null },
 *   activePointersRef: { current: new Map() },
 *   pointerPinchRef: { current: null },
 *   cameraRef: { current: { x: 0, y: 0, z: 1 } },
 *   setDragStart: () => {},
 *   setIsDragging: () => {}
 * });
 *
 * @example
 * processPointerUp({
 *   e: { pointerId: 2, currentTarget: null },
 *   activePointersRef: { current: new Map([[1, { x: 0, y: 0 }]]) },
 *   pointerPinchRef: { current: null },
 *   cameraRef: { current: { x: 0, y: 0, z: 1 } },
 *   setDragStart: () => {},
 *   setIsDragging: () => {}
 * });
 */
function processPointerUp({
    e,
    activePointersRef,
    pointerPinchRef,
    cameraRef,
    setDragStart,
    setIsDragging,
    onInteract
}) {
    const released = activePointersRef.current.get(e.pointerId);
    const wasCleanTap = Boolean(
        released && !released.moved && activePointersRef.current.size === 1 && !pointerPinchRef.current
    );
    activePointersRef.current.delete(e.pointerId);
    try {
        if (e.pointerId && e.currentTarget) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    } catch (err) {}

    if (activePointersRef.current.size < 2) {
        pointerPinchRef.current = null;
    }
    if (activePointersRef.current.size === 1) {
        const remaining = activePointersRef.current.values().next().value;
        setDragStart({ x: remaining.x - cameraRef.current.x, y: remaining.y - cameraRef.current.y });
    } else if (activePointersRef.current.size === 0) {
        setIsDragging(false);
    }
    if (wasCleanTap && onInteract) onInteract();
}

/**
 * Evaluates whether an incoming pointerdown event should be ignored for canvas dragging or pinching.
 *
 * @param {PointerEvent} e - DOM pointer down event.
 * @param {number} activePointerCount - Current number of active tracked pointers.
 * @returns {boolean} True if the pointer event should be ignored.
 *
 * @example
 * shouldIgnorePointerDown({ button: 1, pointerType: 'mouse' }, 0);
 * // => true
 *
 * @example
 * shouldIgnorePointerDown({ button: 0, pointerType: 'mouse', target: { closest: () => null } }, 0);
 * // => false
 */
function shouldIgnorePointerDown(e, activePointerCount) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return true;
    if (activePointerCount === 0) {
        if (e.target?.closest?.('.interactive-element') || e.target?.closest?.('.person-node')) return true;
    }
    return false;
}

/**
 * Initializes single-pointer drag or two-pointer pinch gesture tracking state on pointer down.
 *
 * @param {Object} params
 * @param {PointerEvent} params.e - DOM pointer event.
 * @param {React.MutableRefObject<Map>} params.activePointersRef - Active pointers tracking map.
 * @param {React.MutableRefObject<Object>} params.pointerPinchRef - Ref tracking two-point pinch state.
 * @param {React.MutableRefObject<Object>} params.cameraRef - Ref storing latest camera position and zoom.
 * @param {Function} params.setIsDragging - Setter for dragging state boolean.
 * @param {Function} params.setDragStart - Setter for drag start anchor coordinates.
 *
 * @example
 * initializePointerGestureState({
 *   e: { clientX: 100, clientY: 200 },
 *   activePointersRef: { current: new Map([[1, { x: 100, y: 200 }]]) },
 *   pointerPinchRef: { current: null },
 *   cameraRef: { current: { x: 0, y: 0, z: 1 } },
 *   setIsDragging: () => {},
 *   setDragStart: () => {}
 * });
 *
 * @example
 * initializePointerGestureState({
 *   e: { clientX: 150, clientY: 250 },
 *   activePointersRef: { current: new Map([[1, { x: 100, y: 200 }], [2, { x: 150, y: 250 }]]) },
 *   pointerPinchRef: { current: null },
 *   cameraRef: { current: { x: 0, y: 0, z: 1 } },
 *   setIsDragging: () => {},
 *   setDragStart: () => {}
 * });
 */
function initializePointerGestureState({
    e,
    activePointersRef,
    pointerPinchRef,
    cameraRef,
    setIsDragging,
    setDragStart
}) {
    if (activePointersRef.current.size === 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - cameraRef.current.x, y: e.clientY - cameraRef.current.y });
    } else if (activePointersRef.current.size === 2) {
        const [p1, p2] = Array.from(activePointersRef.current.values());
        const { dist, mid } = calculateTwoPointGeometry(p1, p2);
        pointerPinchRef.current = {
            dist,
            mid,
            cam: { ...cameraRef.current }
        };
    }
}

/**
 * Processes a pointer down event for the canvas, managing pointer capture, tracking active pointers,
 * single-pointer drag initialization, and two-pointer pinch gesture setup.
 *
 * @param {Object} options
 * @param {PointerEvent} options.e - Native DOM pointer down event.
 * @param {React.MutableRefObject<Map<number, {x: number, y: number, startX?: number, startY?: number, moved?: boolean}>>} options.activePointersRef - Active pointers tracking ref.
 * @param {React.MutableRefObject<Object|null>} options.pointerPinchRef - Multi-touch pinch state ref.
 * @param {React.MutableRefObject<Object>} options.cameraRef - Current camera state ref.
 * @param {Function} options.setIsDragging - State setter for isDragging boolean.
 * @param {Function} options.setDragStart - State setter for drag start coordinates.
 * @param {Function} [options.onInteract] - Callback invoked when interaction starts.
 *
 * @example
 *   processPointerDown({
 *     e: mockPointerEvent,
 *     activePointersRef: { current: new Map() },
 *     pointerPinchRef: { current: null },
 *     cameraRef: { current: { x: 0, y: 0, z: 1 } },
 *     setIsDragging: () => {},
 *     setDragStart: () => {},
 *     onInteract: () => {}
 *   });
 *
 * @example
 *   processPointerDown({
 *     e: touchPointerEvent,
 *     activePointersRef,
 *     pointerPinchRef,
 *     cameraRef,
 *     setIsDragging: setDragging,
 *     setDragStart: setStart
 *   });
 */
function processPointerDown({
    e,
    activePointersRef,
    pointerPinchRef,
    cameraRef,
    setIsDragging,
    setDragStart
}) {
    if (shouldIgnorePointerDown(e, activePointersRef.current.size)) return;

    try {
        e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const isMultiPointer = activePointersRef.current.size >= 1;
    if (isMultiPointer) {
        activePointersRef.current.forEach((val, key) => {
            activePointersRef.current.set(key, { ...val, moved: true });
        });
    }
    activePointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        moved: isMultiPointer
    });

    initializePointerGestureState({
        e,
        activePointersRef,
        pointerPinchRef,
        cameraRef,
        setIsDragging,
        setDragStart
    });
}

/**
 * Hook providing memoized pointer event callbacks for canvas drag and pinch gestures.
 *
 * @param {Object} params
 * @param {React.RefObject} params.activePointersRef - Active pointers tracking map ref.
 * @param {React.RefObject} params.pointerPinchRef - Pointer pinch state ref.
 * @param {React.RefObject} params.cameraRef - Current camera coordinates ref.
 * @param {Function} params.setIsDragging - Dragging state setter.
 * @param {Function} params.setDragStart - Drag start coordinates setter.
 * @param {boolean} params.isDragging - Whether dragging is active.
 * @param {{x: number, y: number}} params.dragStart - Drag start position.
 * @param {Function} params.onInteract - Interaction callback.
 * @param {React.RefObject} params.containerRef - Viewport container ref.
 * @param {Function} params.getBounds - Viewport bounds resolver.
 * @param {Function} params.getPpy - Current pixels-per-year resolver.
 * @param {Function} params.setCamera - Camera setter.
 * @param {Function} params.clampCamera - Camera clamping function.
 * @returns {{handlePointerDown: Function, handlePointerMove: Function, handlePointerUp: Function}}
 *
 * @example
 * const callbacks = useCanvasPointerCallbacks({ ...params });
 *
 * @example
 * const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasPointerCallbacks({ ...params });
 */
function useCanvasPointerCallbacks({
    activePointersRef, pointerPinchRef, cameraRef, setIsDragging, setDragStart,
    isDragging, dragStart, onInteract, containerRef, getBounds, getPpy, setCamera, clampCamera
}) {
    const handlePointerDown = useCallback((e) => {
        processPointerDown({
            e, activePointersRef, pointerPinchRef, cameraRef,
            setIsDragging, setDragStart
        });
    }, [cameraRef]);
    
    const handlePointerMove = useCallback((e) => {
        processPointerMove({
            e, activePointersRef, pointerPinchRef, isDragging, dragStart,
            containerRef, getBounds, getPpy, setCamera, clampCamera
        });
    }, [isDragging, dragStart, clampCamera, getBounds, getPpy, setCamera, containerRef]);
    
    const handlePointerUp = useCallback((e) => {
        processPointerUp({
            e, activePointersRef, pointerPinchRef, cameraRef, setDragStart, setIsDragging, onInteract
        });
    }, [cameraRef, onInteract]);

    return { handlePointerDown, handlePointerMove, handlePointerUp };
}

/**
 * Custom hook to manage canvas pointer and wheel drag/pinch/zoom gestures.
 * Handles mouse and multi-touch pointer tracking, pinch-to-zoom calculation,
 * pointer capture lifecycle, and wheel-based zooming around cursor position.
 *
 * @param {Object} options
 * @param {Function} [options.onInteract] - Callback invoked whenever user gestures begin or zoom occurs.
 * @param {React.MutableRefObject<Object>} options.cameraRef - Ref storing the latest camera state {x, y, z}.
 * @param {Function} options.setCamera - React state setter for camera {x, y, z}.
 * @param {Function} options.clampCamera - Function to constrain camera coordinates within boundaries.
 * @param {Function} options.getBounds - Function to calculate canvas camera bounds for a given zoom level.
 * @param {Function} options.getPpy - Function to calculate pixels per year for a given zoom level.
 * @param {React.RefObject<HTMLElement>} options.containerRef - Ref to the canvas container element.
 * @returns {{
 *   isDragging: boolean,
 *   handlePointerDown: Function,
 *   handlePointerMove: Function,
 *   handlePointerUp: Function,
 *   handleWheel: Function
 * }}
 *
 * @example
 * const { isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } = useCanvasPointerGestures({
 *   onInteract: () => console.log('gesture started'),
 *   cameraRef,
 *   setCamera,
 *   clampCamera,
 *   getBounds,
 *   getPpy,
 *   containerRef
 * });
 *
 * @example
 * // Bind returned gesture event handlers to canvas viewport
 * <div
 *   ref={containerRef}
 *   onPointerDown={handlePointerDown}
 *   onPointerMove={handlePointerMove}
 *   onPointerUp={handlePointerUp}
 *   onWheel={handleWheel}
 * />
 */
function useCanvasPointerGestures({
    onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy, containerRef
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const activePointersRef = useRef(new Map());
    const pointerPinchRef = useRef(null);

    const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasPointerCallbacks({
        activePointersRef, pointerPinchRef, cameraRef, setIsDragging, setDragStart,
        isDragging, dragStart, onInteract, containerRef, getBounds, getPpy, setCamera, clampCamera
    });

    const handleWheel = useCanvasWheelZoom({
        onInteract, containerRef, setCamera, clampCamera, getBounds, getPpy
    });

    return { isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel };
}

/**
 * Calculates estimated vertical tree height in pixels based on generational span and target pixels-per-year.
 *
 * @param {Object|null} treeStats - Tree chronological and demographic statistics.
 * @param {number} targetPpy - Target pixels per year at current zoom.
 * @returns {number} Estimated height in pixels.
 *
 * @example
 * computeTreeSpanHeight({ minYear: 1900, maxYear: 2000, rootNodeYob: 1920 }, 15)
 * // => 1286
 *
 * @example
 * computeTreeSpanHeight(null, 15)
 * // => 836
 */
function computeTreeSpanHeight(treeStats, targetPpy) {
    const spanYears = treeStats && treeStats.minYear ? Math.max(5, treeStats.maxYear - treeStats.rootNodeYob) : 50;
    return (spanYears * targetPpy) + 86;
}

/**
 * Calculates bounding box and pan limits for the canvas camera based on container and tree dimensions.
 *
 * @param {Object} options
 * @param {HTMLElement|null} options.treeElement - The tree DOM element.
 * @param {HTMLElement|null} options.container - The container DOM element.
 * @param {boolean} options.isSidebarOpen - Whether the sidebar is expanded.
 * @param {number} options.sidebarWidth - Width of the sidebar in pixels.
 * @param {boolean} options.forceFullWindow - Whether to force measuring against the full window.
 * @param {Object|null} options.treeStats - Tree chronological and demographic stats.
 * @param {number} options.targetPpy - Pixels per year at current zoom.
 * @param {number} options.z - Current zoom scale factor.
 * @returns {Object} Camera bounds containing minX, maxX, minY, maxY, minZ, and centeredX.
 *
 * @example
 * calculateViewportCameraBounds({
 *   treeElement: null,
 *   container: null,
 *   isSidebarOpen: false,
 *   sidebarWidth: 360,
 *   forceFullWindow: false,
 *   treeStats: null,
 *   targetPpy: 10,
 *   z: 1
 * });
 *
 * @example
 * calculateViewportCameraBounds({
 *   treeElement: document.createElement('div'),
 *   container: document.createElement('div'),
 *   isSidebarOpen: true,
 *   sidebarWidth: 400,
 *   forceFullWindow: false,
 *   treeStats: { minYear: 1900, maxYear: 2000, rootNodeYob: 1920 },
 *   targetPpy: 15,
 *   z: 0.8
 * });
 */
function calculateViewportCameraBounds({
    treeElement, container, isSidebarOpen, sidebarWidth, forceFullWindow, treeStats, targetPpy, z, bottomSheetHeight = 0
}) {
    if (!treeElement) return { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, minZ: 0.05, centeredX: 0 };

    const { contW, contH } = resolveViewportDimensions({
        container, isSidebarOpen, sidebarWidth, forceFullWindow, bottomSheetHeight
    });
    const treeW = getTreeElementWidth(treeElement);
    const treeH = computeTreeSpanHeight(treeStats, targetPpy);

    return computeCameraBounds({ treeW, treeH, contW, contH, z, timelineWidth: resolveTimelineGutterWidth() });
}

/** Viewports no wider than this (just under Tailwind's `sm` breakpoint) get the phone layout. */
const COMPACT_VIEWPORT_MAX_WIDTH = 639;
/** Left timeline gutter (era bands + year labels) on desktop, in px. */
const TIMELINE_GUTTER_WIDTH = 48;
/** Narrow year-labels-only gutter on phones, in px (the era bands are dropped). */
const TIMELINE_GUTTER_COMPACT_WIDTH = 32;
/** Compact peek height of the mobile bottom sheet (`96px`), leaving ~89% of the portrait canvas open. */
const MOBILE_SHEET_PEEK_PX = 96;
/** Viewport-height fraction for the half-expanded mobile bottom sheet (`45vh`). */
const MOBILE_SHEET_HALF_VH = 0.45;
/** Viewport-height fraction for the fully-expanded mobile bottom sheet (`85vh`). */
const MOBILE_SHEET_FULL_VH = 0.85;
/** Pixel height threshold below which dragging down dismisses the mobile bottom sheet (`56px`). */
const MOBILE_SHEET_DISMISS_PX = 56;
/** Top floating toolbar clearance (`56px`) reserved when centering cards on compact viewports. */
const MOBILE_TOP_CHROME_INSET_PX = 56;

/**
 * Resolves the pixel heights of the 3 mobile bottom-sheet snap stops (`peek`, `half`, `full`)
 * for a given viewport height.
 *
 * @param {number} [windowHeight=window.innerHeight] - Viewport height in CSS pixels.
 * @returns {{ peek: number, half: number, full: number }}
 *
 * @example
 * resolveSheetSnapHeights(844);
 * // => { peek: 96, half: 380, full: 717 }
 *
 * @example
 * resolveSheetSnapHeights(667);
 * // => { peek: 96, half: 300, full: 567 }
 */
function resolveSheetSnapHeights(windowHeight = (typeof window !== 'undefined' ? window.innerHeight : 844)) {
    const winH = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 844;
    return {
        peek: MOBILE_SHEET_PEEK_PX,
        half: Math.max(180, Math.round(winH * MOBILE_SHEET_HALF_VH)),
        full: Math.max(280, Math.round(winH * MOBILE_SHEET_FULL_VH))
    };
}

/**
 * Maps a named mobile bottom-sheet snap stop (`'peek' | 'half' | 'full'`) to its CSS height string,
 * falling back to `'55vh'` when unset.
 *
 * @param {string|null|undefined} sheetSnap - Active snap stop identifier.
 * @returns {string} CSS height token (`'96px'`, `'45vh'`, `'85vh'`, or `'55vh'`).
 *
 * @example
 * resolveSheetSnapCssHeight('peek'); // => '96px'
 * resolveSheetSnapCssHeight('half'); // => '45vh'
 *
 * @example
 * resolveSheetSnapCssHeight('full'); // => '85vh'
 * resolveSheetSnapCssHeight(null);   // => '55vh'
 */
function resolveSheetSnapCssHeight(sheetSnap) {
    if (sheetSnap === 'peek') return `${MOBILE_SHEET_PEEK_PX}px`;
    if (sheetSnap === 'half') return '45vh';
    if (sheetSnap === 'full') return '85vh';
    return '55vh';
}

/**
 * Cycles a mobile bottom-sheet snap stop on handle tap (`'peek' -> 'half' -> 'full' -> 'peek'`).
 *
 * @param {string} [currentSnap='peek'] - Current snap stop.
 * @returns {'peek'|'half'|'full'} Next snap stop in cycle.
 *
 * @example
 * cycleSheetSnapStop('peek'); // => 'half'
 *
 * @example
 * cycleSheetSnapStop('full'); // => 'peek'
 */
function cycleSheetSnapStop(currentSnap = 'peek') {
    if (currentSnap === 'peek') return 'half';
    if (currentSnap === 'half') return 'full';
    return 'peek';
}

/**
 * Computes the effective mobile bottom-sheet snap stop for the currently open panel:
 * returns `null` on desktop or when closed, preserves `'peek'` when viewing a focused person,
 * and promotes `'peek'` to `'half'` (`45vh`) for list/chat/log drawers that need vertical space.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.isCompactViewport=false] - Whether compact phone layout is active.
 * @param {boolean} [options.isAnySidebarOpen=false] - Whether any bottom panel is open.
 * @param {string} [options.sheetSnap='peek'] - User-selected snap stop.
 * @param {boolean} [options.hasFocusPerson=false] - Whether a person profile is currently focused.
 * @param {boolean} [options.showLogs=false] - Whether system logs view is open.
 * @param {boolean} [options.showAI=false] - Whether AI Assistant view is open.
 * @param {Object|null} [options.activeFilter=null] - Active search/category filter descriptor.
 * @returns {'peek'|'half'|'full'|null}
 *
 * @example
 * resolveEffectiveSheetSnap({ isCompactViewport: true, isAnySidebarOpen: true, sheetSnap: 'peek', hasFocusPerson: true });
 * // => 'peek'
 *
 * @example
 * resolveEffectiveSheetSnap({ isCompactViewport: true, isAnySidebarOpen: true, sheetSnap: 'peek', showAI: true });
 * // => 'half'
 */
function resolveEffectiveSheetSnap({
    isCompactViewport = false, isAnySidebarOpen = false, sheetSnap = 'peek',
    hasFocusPerson = false, showLogs = false, showAI = false, activeFilter = null
} = {}) {
    if (!isCompactViewport || !isAnySidebarOpen) return null;
    const isNonDirectoryFilter = Boolean(activeFilter && activeFilter.filterType !== 'directory');
    const canUsePeek = Boolean(hasFocusPerson && !showLogs && !showAI && !isNonDirectoryFilter);
    const requested = (sheetSnap === 'peek' || sheetSnap === 'half' || sheetSnap === 'full') ? sheetSnap : 'peek';
    if (!canUsePeek && requested === 'peek') return 'half';
    return requested;
}

/**
 * Resolves the active or predicted pixel height of the mobile bottom sheet for synchronous camera math.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.isCompactViewport=false] - Whether phone layout is active.
 * @param {boolean} [options.isSidebarOpen=false] - Whether bottom sheet is open.
 * @param {number|null} [options.sidebarHeight=null] - Live pixel drag height override, if any.
 * @param {string|null} [options.sheetSnap=null] - Active snap stop (`'peek' | 'half' | 'full'`).
 * @param {number} [options.windowHeight] - Optional viewport height override.
 * @returns {number} Reserved bottom-sheet height in pixels (`0` on desktop or when closed).
 *
 * @example
 * resolveBottomSheetPixelHeight({ isCompactViewport: true, isSidebarOpen: true, sheetSnap: 'peek', windowHeight: 844 });
 * // => 96
 *
 * @example
 * resolveBottomSheetPixelHeight({ isCompactViewport: false, isSidebarOpen: true, sheetSnap: 'peek', windowHeight: 844 });
 * // => 0
 */
function resolveBottomSheetPixelHeight({
    isCompactViewport = false, isSidebarOpen = false, sidebarHeight = null, sheetSnap = null, windowHeight
} = {}) {
    if (!isCompactViewport || !isSidebarOpen) return 0;
    if (typeof sidebarHeight === 'number' && sidebarHeight > 0) return Math.round(sidebarHeight);
    const heights = resolveSheetSnapHeights(windowHeight);
    if (sheetSnap === 'peek' || sheetSnap === 'half' || sheetSnap === 'full') {
        return heights[sheetSnap];
    }
    const winH = Number.isFinite(windowHeight) && windowHeight > 0
        ? windowHeight
        : (typeof window !== 'undefined' ? window.innerHeight : 844);
    return Math.round(winH * 0.55);
}

/**
 * Aggregates mobile bottom-sheet eligibility, effective snap stop, active pixel height,
 * and predicted person-focus pixel height for camera centering.
 *
 * @param {Object} [options={}]
 * @returns {{ canPeek: boolean, effectiveSheetSnap: 'peek'|'half'|'full'|null, bottomSheetHeight: number, focusBottomSheetHeight: number }}
 *
 * @example
 * resolveMobileSheetState({ isCompactViewport: true, isAnySidebarOpen: false, sheetSnap: 'peek', windowHeight: 844 });
 * // => { canPeek: false, effectiveSheetSnap: null, bottomSheetHeight: 0, focusBottomSheetHeight: 96 }
 *
 * @example
 * resolveMobileSheetState({ isCompactViewport: true, isAnySidebarOpen: true, sheetSnap: 'half', hasFocusPerson: true, windowHeight: 844 });
 * // => { canPeek: true, effectiveSheetSnap: 'half', bottomSheetHeight: 380, focusBottomSheetHeight: 380 }
 */
function resolveMobileSheetState({
    isCompactViewport = false, isAnySidebarOpen = false, sheetSnap = 'peek',
    sidebarHeight = null, hasFocusPerson = false, showLogs = false, showAI = false,
    activeFilter = null, windowHeight
} = {}) {
    const canPeek = Boolean(
        isCompactViewport && hasFocusPerson && !showLogs && !showAI &&
        (!activeFilter || activeFilter.filterType === 'directory')
    );
    const effectiveSheetSnap = resolveEffectiveSheetSnap({
        isCompactViewport, isAnySidebarOpen, sheetSnap, hasFocusPerson, showLogs, showAI, activeFilter
    });
    const bottomSheetHeight = resolveBottomSheetPixelHeight({
        isCompactViewport, isSidebarOpen: isAnySidebarOpen, sidebarHeight, sheetSnap: effectiveSheetSnap, windowHeight
    });
    const personTargetSnap = sheetSnap === 'half' ? 'half' : 'peek';
    const focusBottomSheetHeight = isCompactViewport
        ? resolveBottomSheetPixelHeight({
            isCompactViewport: true, isSidebarOpen: true, sidebarHeight, sheetSnap: personTargetSnap, windowHeight
        })
        : 0;
    return { canPeek, effectiveSheetSnap, bottomSheetHeight, focusBottomSheetHeight };
}

/**
 * Whether a viewport width calls for the phone layout: details panel docked below the canvas,
 * narrow timeline gutter, full-width top bar.
 *
 * @param {number} [width=window.innerWidth] - Viewport width in CSS px
 * @returns {boolean}
 *
 * @example
 * isCompactViewportWidth(390);   // => true  (portrait phone)
 *
 * @example
 * isCompactViewportWidth(640);   // => false (Tailwind `sm` and up: tablets, laptops)
 */
function isCompactViewportWidth(width = (typeof window !== 'undefined' ? window.innerWidth : 1024)) {
    return width <= COMPACT_VIEWPORT_MAX_WIDTH;
}

/**
 * Width of the left timeline gutter the camera must keep clear: 48px on desktop, 32px on
 * phones (year labels only — the 48px band would eat an eighth of a portrait screen) and 0 in
 * standalone exports, which draw no gutter at all.
 *
 * @param {Object} [options]
 * @param {boolean} [options.isStandalone=isStandaloneExportMode()] - Standalone export mode
 * @param {boolean} [options.isCompact=isCompactViewportWidth()] - Phone layout active
 * @returns {number}
 *
 * @example
 * resolveTimelineGutterWidth({ isStandalone: false, isCompact: false });   // => 48
 *
 * @example
 * resolveTimelineGutterWidth({ isStandalone: false, isCompact: true });    // => 32
 * resolveTimelineGutterWidth({ isStandalone: true, isCompact: true });     // => 0
 */
function resolveTimelineGutterWidth({ isStandalone = isStandaloneExportMode(), isCompact = isCompactViewportWidth() } = {}) {
    if (isStandalone) return 0;
    return isCompact ? TIMELINE_GUTTER_COMPACT_WIDTH : TIMELINE_GUTTER_WIDTH;
}

/**
 * Horizontal space the details panel reserves beside the canvas: its width on desktop, 0 on
 * phones, where it docks BELOW the canvas instead (the canvas then shrinks vertically, which the
 * container measurements already reflect — see `resolveViewportDimensions`).
 *
 * @param {number} sidebarWidth - Configured sidebar width in px
 * @param {boolean} isCompact - Phone layout active (see `isCompactViewportWidth`)
 * @returns {number}
 *
 * @example
 * resolveDockedSidebarWidth(360, false);   // => 360
 *
 * @example
 * resolveDockedSidebarWidth(360, true);    // => 0
 */
function resolveDockedSidebarWidth(sidebarWidth, isCompact) {
    return isCompact ? 0 : sidebarWidth;
}

/**
 * Tracks whether the phone layout applies, re-evaluating on resize / rotation via a
 * `matchMedia` listener (no per-frame resize handler).
 *
 * @returns {boolean} true on viewports up to `COMPACT_VIEWPORT_MAX_WIDTH` px wide
 *
 * @example
 * const isCompactViewport = useCompactViewport();
 * <PersonSidebar dockBottom={isCompactViewport} />
 *
 * @example
 * const isCompact = useCompactViewport();   // false on a 1280px laptop window
 */
function useCompactViewport() {
    const [isCompact, setIsCompact] = useState(() => isCompactViewportWidth());
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const query = window.matchMedia(`(max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`);
        const sync = () => setIsCompact(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);
    return isCompact;
}

/**
 * Clamps camera x, y, and z coordinates within computed viewport boundary constraints.
 *
 * @param {{x: number, y: number, z: number}} cam - Input camera coordinate vector.
 * @param {Function} getBounds - Function returning viewport boundaries for a given zoom level.
 * @returns {{x: number, y: number, z: number}} Clamped camera coordinate vector.
 *
 * @example
 * clampCameraCoordinates({ x: 100, y: 50, z: 1 }, (z) => ({ minX: 0, maxX: 500, minY: 0, maxY: 500, minZ: 0.1 }));
 *
 * @example
 * clampCameraCoordinates({ x: -1000, y: 10000, z: 0.01 }, (z) => ({ minX: -500, maxX: 500, minY: -500, maxY: 500, minZ: 0.05 }));
 */
function clampCameraCoordinates(cam, getBounds) {
    const bounds = getBounds(cam.z);
    const z = Math.max(bounds.minZ, Math.min(cam.z, 3)); 
    const finalBounds = getBounds(z);
    return {
        x: Math.max(finalBounds.minX, Math.min(finalBounds.maxX, cam.x)),
        y: Math.max(finalBounds.minY, Math.min(finalBounds.maxY, cam.y)),
        z
    };
}

/**
 * Hook providing dynamic pixels-per-year calculation, camera pan/zoom boundary computation,
 * and coordinate clamping for the interactive canvas viewport.
 *
 * @param {object} params
 * @param {object|null} params.treeStats - Tree generational statistics (minYear, maxYear, rootNodeYob)
 * @param {boolean} [params.isSidebarOpen=false] - Whether details sidebar is open
 * @param {number} [params.sidebarWidth=360] - Width of details sidebar in pixels
 * @param {React.RefObject} params.containerRef - Ref to outer canvas container DOM node
 * @param {React.RefObject} params.treeRef - Ref to inner tree element DOM node
 * @returns {{ getPpy: Function, getBounds: Function, clampCamera: Function }}
 *
 * @example
 *   const { getPpy, getBounds, clampCamera } = useCanvasCameraBounds({
 *       treeStats: { minYear: 1900, maxYear: 2020, rootNodeYob: 1900 },
 *       isSidebarOpen: false,
 *       sidebarWidth: 360,
 *       containerRef,
 *       treeRef
 *   });
 *
 * @example
 *   const { clampCamera } = useCanvasCameraBounds({
 *       treeStats: null,
 *       isSidebarOpen: true,
 *       sidebarWidth: 400,
 *       containerRef: { current: null },
 *       treeRef: { current: null }
 *   });
 */
function useCanvasCameraBounds({
    treeStats, isSidebarOpen = false, sidebarWidth = 360, bottomSheetHeight = 0, containerRef, treeRef
}) {
    const getPpy = useCallback((z, forceFullWindow = false, sheetOverride) => {
        const activeSheetH = sheetOverride !== undefined ? sheetOverride : bottomSheetHeight;
        const { contH } = resolveViewportDimensions({
            container: containerRef.current, isSidebarOpen, sidebarWidth, forceFullWindow, bottomSheetHeight: activeSheetH
        });
        return computeDynamicPpy(treeStats, contH, z);
    }, [treeStats, isSidebarOpen, sidebarWidth, bottomSheetHeight, containerRef]);

    const getBounds = useCallback((z, forceFullWindow = false, sheetOverride) => {
        const activeSheetH = sheetOverride !== undefined ? sheetOverride : bottomSheetHeight;
        const targetPpy = getPpy(z, forceFullWindow, activeSheetH);
        return calculateViewportCameraBounds({
            treeElement: treeRef.current, container: containerRef.current,
            isSidebarOpen, sidebarWidth, forceFullWindow, treeStats, targetPpy, z,
            bottomSheetHeight: activeSheetH
        });
    }, [treeStats, getPpy, isSidebarOpen, sidebarWidth, bottomSheetHeight, containerRef, treeRef]);

    const clampCamera = useCallback(
        (cam, sheetOverride) => clampCameraCoordinates(cam, (z) => getBounds(z, false, sheetOverride)),
        [getBounds]
    );

    return { getPpy, getBounds, clampCamera };
}

/**
 * Calculates fit-to-screen metrics including timeline bar adjustments and usable viewport width.
 *
 * @param {Object} options
 * @param {HTMLElement|null} options.container - Canvas container element.
 * @param {boolean} options.isSidebarOpen - Whether sidebar is open.
 * @param {number} options.sidebarWidth - Sidebar width in pixels.
 * @param {boolean} options.forceFullWindow - Whether to force measuring full window.
 * @returns {Object} Framing layout metrics containing usableContW, timelineWidth, paddingX, topMargin.
 *
 * @example
 * resolveFitToScreenMetrics({ container: null, isSidebarOpen: false, sidebarWidth: 360, forceFullWindow: false });
 *
 * @example
 * resolveFitToScreenMetrics({ container: document.createElement('div'), isSidebarOpen: true, sidebarWidth: 400, forceFullWindow: true });
 */
function resolveFitToScreenMetrics({ container, isSidebarOpen, sidebarWidth, forceFullWindow }) {
    const { contW } = resolveViewportDimensions({
        container,
        isSidebarOpen,
        sidebarWidth,
        forceFullWindow
    });

    const timelineWidth = resolveTimelineGutterWidth();
    const usableContW = Math.max(100, contW - timelineWidth);
    return {
        usableContW,
        timelineWidth,
        paddingX: 8,
        topMargin: 16
    };
}

/**
 * Computes and applies initial fit-to-screen camera framing, returning metrics for scheduling refinements.
 *
 * @param {Object} params
 * @param {HTMLElement} params.treeElement - DOM node containing the tree canvas.
 * @param {HTMLElement} params.container - Outer canvas container DOM element.
 * @param {boolean} [params.isSidebarOpen] - Whether details sidebar is open.
 * @param {number} [params.sidebarWidth] - Sidebar width in pixels.
 * @param {boolean} [params.forceFullWindow] - Whether to ignore sidebar width.
 * @param {Function} params.setCamera - State setter for camera coordinates.
 * @returns {Object|null} Resolved fit-to-screen metrics or null if tree width is non-positive.
 *
 * @example
 * const metrics = applyInitialFitToScreen({ treeElement, container, setCamera });
 *
 * @example
 * applyInitialFitToScreen({ treeElement, container, isSidebarOpen: true, sidebarWidth: 360, setCamera });
 */
function applyInitialFitToScreen({ treeElement, container, isSidebarOpen, sidebarWidth, forceFullWindow, setCamera }) {
    const treeW = getTreeElementWidth(treeElement);
    if (treeW <= 0) return null;

    const metrics = resolveFitToScreenMetrics({
        container,
        isSidebarOpen,
        sidebarWidth,
        forceFullWindow
    });

    setCamera(computeFitToScreenCamera({
        treeW,
        usableContW: metrics.usableContW,
        timelineWidth: metrics.timelineWidth,
        paddingX: metrics.paddingX,
        topMargin: metrics.topMargin
    }));

    return metrics;
}

/**
 * Calculates and applies fit-to-screen camera framing for the tree canvas.
 *
 * Resolves available viewport dimensions minus optional timeline rulers,
 * calculates zoom scale matching the tree element width, updates camera position,
 * and schedules secondary refinement checks for asynchronous rendering.
 *
 * @param {object} options - Framing configuration options.
 * @param {React.RefObject} options.treeRef - Ref to the inner tree container element.
 * @param {React.RefObject} options.containerRef - Ref to the outer canvas container.
 * @param {object|null} options.treeStats - Chronological stats and bounds of the active tree.
 * @param {boolean} options.isSidebarOpen - Whether the sidebar details panel is expanded.
 * @param {number} options.sidebarWidth - Width of the sidebar in pixels.
 * @param {boolean} [options.forceFullWindow=false] - Whether to ignore sidebar and measure full window.
 * @param {Function} options.setCamera - Camera state updater function.
 *
 * @example
 *   executeFitToScreen({
 *     treeRef,
 *     containerRef,
 *     treeStats: { rootNodeYob: 1900 },
 *     isSidebarOpen: true,
 *     sidebarWidth: 360,
 *     setCamera: () => {}
 *   });
 *
 * @example
 *   executeFitToScreen({
 *     treeRef: { current: null },
 *     containerRef: { current: null },
 *     treeStats: null,
 *     isSidebarOpen: false,
 *     sidebarWidth: 0,
 *     forceFullWindow: true,
 *     setCamera: () => {}
 *   });
 */
function executeFitToScreen({
    treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, forceFullWindow = false, setCamera
}) {
    const treeElement = treeRef.current;
    const cont = containerRef.current;
    if (!treeElement || !cont || !treeStats) return;

    const metrics = applyInitialFitToScreen({
        treeElement, container: cont, isSidebarOpen, sidebarWidth, forceFullWindow, setCamera
    });
    if (!metrics) return;

    scheduleFitToScreenRefinement({
        treeRef, containerRef, setCamera, isSidebarOpen, sidebarWidth, forceFullWindow,
        timelineWidth: metrics.timelineWidth, paddingX: metrics.paddingX, topMargin: metrics.topMargin
    });
}

/**
 * Constructs viewport framing options for centering the camera on an individual person node.
 *
 * @param {number|null} targetZ - Preferred target zoom level, or null for automatic default.
 * @returns {Object} Camera framing polling options.
 *
 * @example
 * buildPersonCenterFramingOptions(1.2);
 *
 * @example
 * buildPersonCenterFramingOptions(null);
 */
function buildPersonCenterFramingOptions(targetZ = null, bottomSheetHeight = 0, topInset = 0) {
    return {
        preferredZ: targetZ,
        targetPadX: 0,
        targetPadY: 0,
        maxAttempts: 15,
        intervalMs: 40,
        initialDelay: 15,
        bottomSheetHeight,
        topInset
    };
}

/**
 * Hook providing viewport navigation and framing callbacks for focusing individuals,
 * multi-person clusters, and fitting the entire tree to the screen.
 *
 * @param {object} params
 * @param {React.RefObject<HTMLElement>} params.treeRef - Ref to the inner tree DOM node
 * @param {React.RefObject<HTMLElement>} params.containerRef - Ref to the outer canvas container DOM node
 * @param {object|null} params.treeStats - Generational metrics and bounds for fitting logic
 * @param {boolean} params.isSidebarOpen - Whether the sidebar panel is expanded
 * @param {number} params.sidebarWidth - Width in pixels allocated for the sidebar
 * @param {React.Dispatch<React.SetStateAction<object>>} params.setCamera - Camera state setter
 * @param {(cam: object, sheetOverride?: number) => object} params.clampCamera - Boundary clamping function
 * @param {number} [params.bottomSheetHeight=0] - Active mobile bottom-sheet pixel height
 * @param {number} [params.focusBottomSheetHeight=0] - Predicted mobile bottom-sheet pixel height when focusing a person
 * @param {boolean} [params.isCompactViewport=false] - Whether compact phone layout is active
 * @returns {{
 *   framePeople: (ids: Array<string>, options?: object|null) => void,
 *   centerOnPerson: (id: string, targetZ?: number|null, sheetHeightOverride?: number|null) => void,
 *   fitToScreen: (forceFullWindow?: boolean) => void
 * }}
 *
 * @example
 * const { framePeople, centerOnPerson } = useCanvasCameraFraming({
 *   treeRef,
 *   containerRef,
 *   treeStats,
 *   isSidebarOpen: false,
 *   sidebarWidth: 360,
 *   setCamera,
 *   clampCamera
 * });
 * centerOnPerson('person-123');
 *
 * @example
 * const { fitToScreen } = useCanvasCameraFraming({
 *   treeRef,
 *   containerRef,
 *   treeStats,
 *   isSidebarOpen: true,
 *   sidebarWidth: 400,
 *   setCamera,
 *   clampCamera
 * });
 * fitToScreen(true);
 */
function useCanvasCameraFraming({
    treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, setCamera, clampCamera,
    bottomSheetHeight = 0, focusBottomSheetHeight = 0, isCompactViewport = false
}) {
    const framePeople = useCallback((ids, options = null) => {
        const baseOpts = typeof options === 'number' ? { preferredZ: options } : (options || {});
        const mergedOptions = {
            bottomSheetHeight,
            topInset: isCompactViewport ? MOBILE_TOP_CHROME_INSET_PX : 0,
            ...baseOpts
        };
        pollFramePeople({
            ids, options: mergedOptions, treeRef, containerRef, isSidebarOpen, sidebarWidth, setCamera, clampCamera
        });
    }, [clampCamera, isSidebarOpen, sidebarWidth, bottomSheetHeight, isCompactViewport, treeRef, containerRef, setCamera]);

    const centerOnPerson = useCallback((id, targetZ = null, sheetHeightOverride = null) => {
        if (!id) return;
        const targetSheetH = sheetHeightOverride !== null ? sheetHeightOverride : (focusBottomSheetHeight || bottomSheetHeight);
        const topInset = isCompactViewport ? MOBILE_TOP_CHROME_INSET_PX : 0;
        framePeople([id], buildPersonCenterFramingOptions(targetZ, targetSheetH, topInset));
    }, [framePeople, focusBottomSheetHeight, bottomSheetHeight, isCompactViewport]);

    const fitToScreen = useCallback((forceFullWindow = false) => {
        executeFitToScreen({
            treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, forceFullWindow, setCamera
        });
    }, [treeStats, isSidebarOpen, sidebarWidth, setCamera, treeRef, containerRef]);

    return { framePeople, centerOnPerson, fitToScreen };
}

/**
 * Hook synchronizing canvas boundary clamping on layout changes, sidebar toggles,
 * and DOM resize observer events.
 *
 * @param {object} params
 * @param {React.Dispatch<React.SetStateAction<object>>} params.setCamera - Camera state setter
 * @param {(cam: object) => object} params.clampCamera - Boundary clamping function
 * @param {boolean} params.isSidebarOpen - Whether the sidebar is visible
 * @param {number} params.sidebarWidth - Width of the sidebar in pixels
 * @param {number} [params.bottomSheetHeight=0] - Active mobile bottom-sheet pixel height
 * @param {object|null} params.treeStats - Generational tree metrics
 * @param {React.RefObject<HTMLElement>} params.containerRef - Ref to container DOM node
 * @param {React.RefObject<HTMLElement>} params.treeRef - Ref to tree content DOM node
 *
 * @example
 * useCanvasAutoClamp({
 *   setCamera,
 *   clampCamera,
 *   isSidebarOpen: false,
 *   sidebarWidth: 360,
 *   treeStats,
 *   containerRef,
 *   treeRef
 * });
 *
 * @example
 * useCanvasAutoClamp({
 *   setCamera,
 *   clampCamera,
 *   isSidebarOpen: true,
 *   sidebarWidth: 420,
 *   treeStats: null,
 *   containerRef,
 *   treeRef
 * });
 */
function useCanvasAutoClamp({
    setCamera,
    clampCamera,
    isSidebarOpen,
    sidebarWidth,
    bottomSheetHeight = 0,
    treeStats,
    containerRef,
    treeRef
}) {
    useEffect(() => {
        setCamera(cam => clampCamera(cam));
        const t1 = setTimeout(() => setCamera(cam => clampCamera(cam)), 100);
        const t2 = setTimeout(() => setCamera(cam => clampCamera(cam)), 350);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [isSidebarOpen, sidebarWidth, bottomSheetHeight, treeStats, clampCamera, setCamera]);

    useEffect(() => {
        return setupCanvasResizeObserver({
            containerRef,
            treeRef,
            setCamera,
            clampCamera
        });
    }, [clampCamera, containerRef, treeRef, setCamera]);
}

/**
 * Manages core camera coordinates state and a synchronized reference for gesture handlers.
 *
 * @returns {{ camera: { x: number, y: number, z: number }, setCamera: React.Dispatch<React.SetStateAction<{ x: number, y: number, z: number }>>, cameraRef: React.RefObject<{ x: number, y: number, z: number }> }}
 *
 * @example
 * const { camera, setCamera, cameraRef } = useCanvasCameraState();
 *
 * @example
 * const { camera } = useCanvasCameraState();
 */
function useCanvasCameraState() {
    const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
    const cameraRef = useRef(camera);
    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);
    return { camera, setCamera, cameraRef };
}

/**
 * Synchronizes native mobile touch event listeners for pinch-to-zoom gestures on the canvas container.
 *
 * @param {Object} params
 * @param {React.RefObject<HTMLDivElement>} params.containerRef - Ref to interactive canvas container element.
 * @param {Function} [params.onInteract] - Optional interaction callback.
 * @param {React.RefObject<Object>} params.cameraRef - Ref storing current camera coordinates.
 * @param {Function} params.setCamera - State setter for camera coordinates.
 * @param {Function} params.clampCamera - Boundary clamping function.
 * @param {Function} params.getBounds - Function computing camera boundaries.
 * @param {Function} params.getPpy - Function returning current pixels-per-year.
 *
 * @example
 * useCanvasTouchLifecycle({ containerRef, onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy });
 *
 * @example
 * useCanvasTouchLifecycle({ containerRef, cameraRef, setCamera, clampCamera, getBounds, getPpy });
 */
function useCanvasTouchLifecycle({ containerRef, onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy }) {
    useEffect(() => {
        return setupCanvasTouchListeners({
            container: containerRef.current, onInteract, cameraRef,
            setCamera, clampCamera, getBounds, getPpy
        });
    }, [clampCamera, getBounds, getPpy, onInteract]);
}

/**
 * Hook providing comprehensive pan, zoom, pinch gestures, coordinate clamping,
 * and person/tree framing controls for the family tree interactive viewport.
 *
 * @param {Function} [onInteract] - Callback invoked when the user interacts with the canvas
 * @param {object} [treeStats] - Cached tree bounding dimensions and generation years
 * @param {boolean} [isSidebarOpen=false] - Whether the sidebar details panel is expanded
 * @param {number} [sidebarWidth=360] - Width of sidebar in pixels to adjust viewport padding
 * @returns {{
 *   camera: { x: number, y: number, z: number },
 *   setCamera: React.Dispatch<React.SetStateAction<{ x: number, y: number, z: number }>>,
 *   cameraRef: React.MutableRefObject<{ x: number, y: number, z: number }>,
 *   containerRef: React.RefObject<HTMLDivElement>,
 *   treeRef: React.RefObject<HTMLDivElement>,
 *   isDragging: boolean,
 *   handlePointerDown: Function,
 *   handlePointerMove: Function,
 *   handlePointerUp: Function,
 *   handleWheel: Function,
 *   fitToScreen: Function,
 *   framePeople: Function,
 *   zoomIn: Function,
 *   zoomOut: Function,
 *   resetZoom: Function,
 *   clampCamera: Function
 * }}
 *
 * @example
 * const canvas = useCanvasControls(handleUserInteraction, treeStats, isSidebarOpen, 360);
 *
 * @example
 * const { camera, setCamera, containerRef, treeRef, fitToScreen } = useCanvasControls();
 */
function useCanvasControls(onInteract, treeStats, isSidebarOpen = false, sidebarWidth = 360, mobileSheetOpts = {}) {
    const { bottomSheetHeight = 0, focusBottomSheetHeight = 0, isCompactViewport = false } = mobileSheetOpts || {};
    const { camera, setCamera, cameraRef } = useCanvasCameraState();
    const containerRef = useRef(null);
    const treeRef = useRef(null);

    const { getPpy, getBounds, clampCamera } = useCanvasCameraBounds({
        treeStats, isSidebarOpen, sidebarWidth, bottomSheetHeight, containerRef, treeRef
    });

    const gestures = useCanvasPointerGestures({
        onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy, containerRef
    });

    useCanvasTouchLifecycle({
        containerRef, onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy
    });

    const { framePeople, centerOnPerson, fitToScreen } = useCanvasCameraFraming({
        treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, setCamera, clampCamera,
        bottomSheetHeight, focusBottomSheetHeight, isCompactViewport
    });

    useCanvasAutoClamp({
        setCamera, clampCamera, isSidebarOpen, sidebarWidth, bottomSheetHeight, treeStats, containerRef, treeRef
    });

    return {
        camera, setCamera, cameraRef, clampCamera, containerRef, treeRef,
        centerOnPerson, framePeople, fitToScreen, getPpy, ...gestures
    };
}

/**
 * Loads stored sidebar width from localStorage or falls back to initialWidth.
 * Clamps width between 280px and 1000px.
 *
 * @param {number} [initialWidth=360]
 * @returns {number}
 *
 * @example
 * loadStoredSidebarWidth(360)
 * // => 360
 *
 * @example
 * loadStoredSidebarWidth(400)
 * // => 400
 */
function loadStoredSidebarWidth(initialWidth = 360) {
    try {
        const saved = localStorage.getItem('familyTree_sidebarWidth');
        return saved ? Math.max(280, Math.min(parseInt(saved, 10), 1000)) : initialWidth;
    } catch (e) {
        return initialWidth;
    }
}

/**
 * Clamps dragged sidebar width within viewport bounds [280, windowWidth - 100].
 *
 * @param {number} startWidth - Initial sidebar width at drag start
 * @param {number} deltaX - Horizontal drag displacement (startX - clientX)
 * @param {number} [windowWidth] - Total window width (defaults to window.innerWidth)
 * @returns {number} Clamped sidebar width
 *
 * @example
 * clampSidebarWidth(360, 50, 1024)
 * // => 410
 *
 * @example
 * clampSidebarWidth(360, -200, 1024)
 * // => 280
 */
function clampSidebarWidth(startWidth, deltaX, windowWidth = (typeof window !== 'undefined' ? window.innerWidth : 1024)) {
    return Math.max(280, Math.min(startWidth + deltaX, windowWidth - 100));
}

/**
 * Attaches pointermove and pointerup listeners to resize and persist sidebar width during drag.
 *
 * @param {number} startX - Initial pointer X coordinate at drag start
 * @param {number} startWidth - Initial sidebar width in pixels
 * @param {Function} setSidebarWidth - State setter for sidebar width
 * @param {Function} setIsResizingSidebar - State setter for resizing flag
 *
 * @example
 * setupSidebarDragListeners(200, 360, setSidebarWidth, setIsResizingSidebar);
 *
 * @example
 * setupSidebarDragListeners(500, 420, (w) => console.log(w), (resizing) => {});
 */
function setupSidebarDragListeners(startX, startWidth, setSidebarWidth, setIsResizingSidebar) {
    const handlePointerMove = (moveEvent) => {
        const newWidth = clampSidebarWidth(startWidth, startX - moveEvent.clientX);
        setSidebarWidth(newWidth);
    };

    const handlePointerUp = (upEvent) => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizingSidebar(false);

        const finalWidth = clampSidebarWidth(startWidth, startX - upEvent.clientX);
        try {
            localStorage.setItem('familyTree_sidebarWidth', String(Math.round(finalWidth)));
        } catch (err) {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
}

/**
 * Loads stored bottom-sheet sidebar height from localStorage or falls back to initialHeight.
 * Clamps stored height between 160px and 1000px.
 *
 * @param {number|null} [initialHeight=null]
 * @returns {number|null}
 *
 * @example
 * loadStoredSidebarHeight(null);
 * // => null (uses default 55vh until resized)
 *
 * @example
 * loadStoredSidebarHeight(420);
 * // => 420
 */
function loadStoredSidebarHeight(initialHeight = null) {
    try {
        const saved = localStorage.getItem('familyTree_sidebarHeight');
        const parsed = saved ? parseInt(saved, 10) : Number.NaN;
        return Number.isFinite(parsed) ? Math.max(160, Math.min(parsed, 1000)) : initialHeight;
    } catch (e) {
        return initialHeight;
    }
}

/**
 * Clamps dragged bottom-docked sidebar height within viewport bounds [160, windowHeight - 100].
 *
 * @param {number} startHeight - Initial sidebar height in px at drag start
 * @param {number} deltaY - Vertical drag displacement (startY - clientY; positive = dragged up)
 * @param {number} [windowHeight] - Total window height (defaults to window.innerHeight)
 * @returns {number} Clamped sidebar height in px
 *
 * @example
 * clampSidebarHeight(400, 80, 844)
 * // => 480
 *
 * @example
 * clampSidebarHeight(400, -300, 844)
 * // => 160
 */
function clampSidebarHeight(startHeight, deltaY, windowHeight = (typeof window !== 'undefined' ? window.innerHeight : 844)) {
    return Math.max(160, Math.min(startHeight + deltaY, Math.max(160, windowHeight - 100)));
}

/**
 * Clamps live finger-dragged mobile bottom-sheet height within `[40, windowHeight - 64]`
 * so users can drag smoothly between `96px` peek, `45vh` half, `85vh` full, or below `56px` to dismiss.
 *
 * @param {number} startHeight - Initial sheet height in px at pointerdown.
 * @param {number} deltaY - Vertical displacement (`startY - clientY`; positive = dragged upward).
 * @param {number} [windowHeight=window.innerHeight] - Viewport height in px.
 * @returns {number} Clamped live drag height in px.
 *
 * @example
 * clampMobileSheetDragHeight(96, 120, 844); // => 216
 *
 * @example
 * clampMobileSheetDragHeight(96, -80, 844); // => 40
 */
function clampMobileSheetDragHeight(
    startHeight,
    deltaY,
    windowHeight = (typeof window !== 'undefined' ? window.innerHeight : 844)
) {
    const maxH = Math.max(180, windowHeight - 64);
    return Math.max(40, Math.min(startHeight + deltaY, maxH));
}

/**
 * Resolves the target snap stop (`'peek' | 'half' | 'full' | 'dismiss'`) when releasing a mobile
 * bottom-sheet drag or tapping the top grab handle (`|deltaY| <= 6` cycles stops).
 *
 * @param {Object} [params={}]
 * @param {number} [params.startHeight=96] - Sheet height in px when pointerdown started.
 * @param {number} [params.deltaY=0] - Vertical displacement (`startY - clientY`; positive = up).
 * @param {string} [params.currentSnap='peek'] - Active snap stop before gesture started.
 * @param {number} [params.windowHeight=844] - Viewport height in px.
 * @returns {'peek'|'half'|'full'|'dismiss'}
 *
 * @example
 * resolveReleaseSheetSnap({ startHeight: 96, deltaY: 0, currentSnap: 'peek', windowHeight: 844 });
 * // => 'half'
 *
 * @example
 * resolveReleaseSheetSnap({ startHeight: 96, deltaY: -45, currentSnap: 'peek', windowHeight: 844 });
 * // => 'dismiss'
 */
function resolveReleaseSheetSnap({ startHeight = 96, deltaY = 0, currentSnap = 'peek', windowHeight = 844 } = {}) {
    if (Math.abs(deltaY) <= 6) return cycleSheetSnapStop(currentSnap);
    const rawH = startHeight + deltaY;
    if ((rawH < MOBILE_SHEET_DISMISS_PX && deltaY < -16) || (currentSnap === 'peek' && deltaY < -32)) {
        return 'dismiss';
    }
    const heights = resolveSheetSnapHeights(windowHeight);
    const midPeekHalf = (heights.peek + heights.half) / 2;
    const midHalfFull = (heights.half + heights.full) / 2;
    if (deltaY > 28) {
        return (rawH > midHalfFull || startHeight >= heights.half - 24) ? 'full' : 'half';
    }
    if (deltaY < -28) {
        return (rawH < midPeekHalf || startHeight <= heights.half + 24) ? 'peek' : 'half';
    }
    if (rawH < midPeekHalf) return 'peek';
    return rawH < midHalfFull ? 'half' : 'full';
}

/**
 * Applies either 3-stop snap transitions (when `snapOptions` is supplied) or legacy pixel height
 * persistence upon releasing a vertical bottom-sheet drag.
 *
 * @param {number} deltaY - Total vertical displacement (`startY - clientY`).
 * @param {number} startHeight - Starting sheet height in px.
 * @param {Function} setSidebarHeight - State setter for live pixel height.
 * @param {Object|null} snapOptions - Optional `{ currentSnap, setSheetSnap, onDismiss }` snap callbacks.
 *
 * @example
 * applyVerticalDragRelease(80, 96, setSidebarHeight, { currentSnap: 'peek', setSheetSnap });
 *
 * @example
 * applyVerticalDragRelease(-50, 96, setSidebarHeight, { currentSnap: 'peek', setSheetSnap, onDismiss });
 */
function applyVerticalDragRelease(deltaY, startHeight, setSidebarHeight, snapOptions) {
    if (!snapOptions) {
        const finalHeight = clampSidebarHeight(startHeight, deltaY);
        try { localStorage.setItem('familyTree_sidebarHeight', String(Math.round(finalHeight))); } catch (err) {}
        return;
    }
    const winH = typeof window !== 'undefined' ? window.innerHeight : 844;
    const nextSnap = resolveReleaseSheetSnap({
        startHeight, deltaY, currentSnap: snapOptions.currentSnap || 'peek', windowHeight: winH
    });
    setSidebarHeight(null);
    if (nextSnap === 'dismiss') {
        snapOptions.setSheetSnap?.('peek');
        snapOptions.onDismiss?.();
    } else {
        snapOptions.setSheetSnap?.(nextSnap);
    }
}

/**
 * Attaches pointermove and pointerup listeners to resize or snap the mobile bottom sheet during vertical drag.
 *
 * @param {number} startY - Initial pointer Y coordinate at drag start
 * @param {number} startHeight - Initial sidebar height in pixels
 * @param {Function} setSidebarHeight - State setter for sidebar height
 * @param {Function} setIsResizingSidebar - State setter for resizing flag
 * @param {Object|null} [snapOptions=null] - Optional 3-stop snap configuration `{ currentSnap, setSheetSnap, onDismiss }`
 *
 * @example
 * setupSidebarVerticalDragListeners(400, 460, setSidebarHeight, setIsResizingSidebar);
 *
 * @example
 * setupSidebarVerticalDragListeners(750, 96, setSidebarHeight, setIsResizingSidebar, { currentSnap: 'peek', setSheetSnap });
 */
function setupSidebarVerticalDragListeners(
    startY, startHeight, setSidebarHeight, setIsResizingSidebar, snapOptions = null
) {
    const handlePointerMove = (moveEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const newHeight = snapOptions
            ? clampMobileSheetDragHeight(startHeight, deltaY)
            : clampSidebarHeight(startHeight, deltaY);
        setSidebarHeight(newHeight);
    };

    const handlePointerUp = (upEvent) => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizingSidebar(false);
        applyVerticalDragRelease(startY - upEvent.clientY, startHeight, setSidebarHeight, snapOptions);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
}

/**
 * Resolves the starting pixel height of the bottom-docked sidebar when a vertical drag starts.
 *
 * @param {PointerEvent|Object} e - Pointer down event on the resize handle
 * @param {number|null} sidebarHeight - Current configured height in px (or null for snap/55vh default)
 * @param {string|null} [sheetSnap=null] - Optional active snap stop (`'peek' | 'half' | 'full'`)
 * @returns {number} Starting height in pixels
 *
 * @example
 * resolveInitialVerticalResizeHeight({}, 420);
 * // => 420
 *
 * @example
 * resolveInitialVerticalResizeHeight({ currentTarget: { parentElement: { getBoundingClientRect: () => ({ height: 464 }) } } }, null);
 * // => 464
 */
function resolveInitialVerticalResizeHeight(e, sidebarHeight, sheetSnap = null) {
    const rectHeight = e?.currentTarget?.parentElement?.getBoundingClientRect?.()?.height;
    if (typeof rectHeight === 'number' && rectHeight > 0) return Math.round(rectHeight);
    if (typeof sidebarHeight === 'number' && sidebarHeight > 0) return sidebarHeight;
    if (sheetSnap) {
        return resolveBottomSheetPixelHeight({ isCompactViewport: true, isSidebarOpen: true, sheetSnap });
    }
    const winH = typeof window !== 'undefined' ? window.innerHeight : 844;
    return Math.round(winH * 0.55);
}

/**
 * Hook to manage sidebar width (desktop) and 3-stop snap / drag height (mobile bottom-sheet),
 * resizing constraints, cursor states, and swipe-down dismissal.
 *
 * @param {number} [initialWidth=360] - Default sidebar width in pixels
 * @param {Function|null} [onDismiss=null] - Optional callback invoked when mobile sheet is swiped down to dismiss
 * @returns {Object} { sidebarWidth, setSidebarWidth, sidebarHeight, setSidebarHeight, sheetSnap, setSheetSnap, isResizingSidebar, handleResizeStart, handleVerticalResizeStart }
 *
 * @example
 * const { sidebarWidth, sheetSnap, isResizingSidebar, handleResizeStart, handleVerticalResizeStart } = useSidebarResize(360, closeAllPanels);
 *
 * @example
 * const { sidebarWidth, setSidebarWidth } = useSidebarResize();
 */
function useSidebarResize(initialWidth = 360, onDismiss = null) {
    const [sidebarWidth, setSidebarWidth] = useState(() => loadStoredSidebarWidth(initialWidth));
    const [sidebarHeight, setSidebarHeight] = useState(null);
    const [sheetSnap, setSheetSnap] = useState('peek');
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingSidebar(true);
        setupSidebarDragListeners(e.clientX, sidebarWidth, setSidebarWidth, setIsResizingSidebar);
    }, [sidebarWidth]);

    const handleVerticalResizeStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const startH = resolveInitialVerticalResizeHeight(e, sidebarHeight, sheetSnap);
        setSidebarHeight(startH);
        setIsResizingSidebar(true);
        setupSidebarVerticalDragListeners(e.clientY, startH, setSidebarHeight, setIsResizingSidebar, {
            currentSnap: sheetSnap, setSheetSnap, onDismiss
        });
    }, [sidebarHeight, sheetSnap, onDismiss]);

    return {
        sidebarWidth, setSidebarWidth, sidebarHeight, setSidebarHeight,
        sheetSnap, setSheetSnap, isResizingSidebar, handleResizeStart, handleVerticalResizeStart
    };
}
