
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
        if (onInteract) onInteract();
        
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
    }, [clampCamera, getBounds, onInteract, getPpy, setCamera, containerRef]);
}

/**
 * Dispatches pointer move updates, either updating multi-touch pinch zoom geometry
 * or panning the camera according to single-finger / single-mouse dragging.
 *
 * @param {object} params
 * @param {React.PointerEvent} params.e - Native pointermove event
 * @param {React.MutableRefObject<Map<number, {x: number, y: number}>>} params.activePointersRef - Active pointers map
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
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

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
 * adjusting the active pinch anchor, or ending drag interactions.
 *
 * @param {object} params
 * @param {React.PointerEvent} params.e - Native pointerup event
 * @param {React.MutableRefObject<Map<number, {x: number, y: number}>>} params.activePointersRef - Active pointers map
 * @param {React.MutableRefObject<object|null>} params.pointerPinchRef - Multi-touch pinch tracking state
 * @param {React.MutableRefObject<object>} params.cameraRef - Current camera coordinates ref
 * @param {Function} params.setDragStart - Setter for drag origin
 * @param {Function} params.setIsDragging - Setter for drag state
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
    setIsDragging
}) {
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
 * @param {React.MutableRefObject<Map<number, {x: number, y: number}>>} options.activePointersRef - Active pointers tracking ref.
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
    setDragStart,
    onInteract
}) {
    if (shouldIgnorePointerDown(e, activePointersRef.current.size)) return;

    try {
        e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    initializePointerGestureState({
        e,
        activePointersRef,
        pointerPinchRef,
        cameraRef,
        setIsDragging,
        setDragStart
    });

    if (onInteract) onInteract();
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
            setIsDragging, setDragStart, onInteract
        });
    }, [onInteract, cameraRef]);
    
    const handlePointerMove = useCallback((e) => {
        processPointerMove({
            e, activePointersRef, pointerPinchRef, isDragging, dragStart,
            containerRef, getBounds, getPpy, setCamera, clampCamera
        });
    }, [isDragging, dragStart, clampCamera, getBounds, getPpy, setCamera, containerRef]);
    
    const handlePointerUp = useCallback((e) => {
        processPointerUp({
            e, activePointersRef, pointerPinchRef, cameraRef, setDragStart, setIsDragging
        });
    }, [cameraRef]);

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
    treeElement, container, isSidebarOpen, sidebarWidth, forceFullWindow, treeStats, targetPpy, z
}) {
    if (!treeElement) return { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, minZ: 0.05, centeredX: 0 };

    const { contW, contH } = resolveViewportDimensions({ container, isSidebarOpen, sidebarWidth, forceFullWindow });
    const treeW = getTreeElementWidth(treeElement);
    const treeH = computeTreeSpanHeight(treeStats, targetPpy);

    // 48px left timeline generation bar offset (0 in standalone mode)
    const isStandalone = isStandaloneExportMode();
    const TIMELINE_WIDTH = isStandalone ? 0 : 48;

    return computeCameraBounds({ treeW, treeH, contW, contH, z, timelineWidth: TIMELINE_WIDTH });
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
function useCanvasCameraBounds({ treeStats, isSidebarOpen = false, sidebarWidth = 360, containerRef, treeRef }) {
    const getPpy = useCallback((z, forceFullWindow = false) => {
        const contH = (forceFullWindow || !isSidebarOpen) && typeof window !== 'undefined'
            ? window.innerHeight
            : (containerRef.current ? containerRef.current.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 800));
        return computeDynamicPpy(treeStats, contH, z);
    }, [treeStats, isSidebarOpen, containerRef]);

    const getBounds = useCallback((z, forceFullWindow = false) => {
        const targetPpy = getPpy(z, forceFullWindow);
        return calculateViewportCameraBounds({
            treeElement: treeRef.current,
            container: containerRef.current,
            isSidebarOpen,
            sidebarWidth,
            forceFullWindow,
            treeStats,
            targetPpy,
            z
        });
    }, [treeStats, getPpy, isSidebarOpen, sidebarWidth, containerRef, treeRef]);

    const clampCamera = useCallback((cam) => clampCameraCoordinates(cam, getBounds), [getBounds]);

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

    const isStandalone = isStandaloneExportMode();
    const TIMELINE_WIDTH = isStandalone ? 0 : 48;
    const usableContW = Math.max(100, contW - TIMELINE_WIDTH);
    return {
        usableContW,
        timelineWidth: TIMELINE_WIDTH,
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
function buildPersonCenterFramingOptions(targetZ = null) {
    return {
        preferredZ: targetZ,
        targetPadX: 0,
        targetPadY: 0,
        maxAttempts: 15,
        intervalMs: 40,
        initialDelay: 15
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
 * @param {(cam: object) => object} params.clampCamera - Boundary clamping function
 * @returns {{
 *   framePeople: (ids: Array<string>, options?: object|null) => void,
 *   centerOnPerson: (id: string, targetZ?: number|null) => void,
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
    treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, setCamera, clampCamera
}) {
    const framePeople = useCallback((ids, options = null) => {
        pollFramePeople({
            ids, options, treeRef, containerRef, isSidebarOpen, sidebarWidth, setCamera, clampCamera
        });
    }, [clampCamera, isSidebarOpen, sidebarWidth, treeRef, containerRef, setCamera]);

    const centerOnPerson = useCallback((id, targetZ = null) => {
        if (!id) return;
        framePeople([id], buildPersonCenterFramingOptions(targetZ));
    }, [framePeople]);

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
    }, [isSidebarOpen, sidebarWidth, treeStats, clampCamera, setCamera]);

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
function useCanvasControls(onInteract, treeStats, isSidebarOpen = false, sidebarWidth = 360) {
    const { camera, setCamera, cameraRef } = useCanvasCameraState();
    const containerRef = useRef(null);
    const treeRef = useRef(null);

    const { getPpy, getBounds, clampCamera } = useCanvasCameraBounds({
        treeStats, isSidebarOpen, sidebarWidth, containerRef, treeRef
    });

    const gestures = useCanvasPointerGestures({
        onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy, containerRef
    });

    useCanvasTouchLifecycle({
        containerRef, onInteract, cameraRef, setCamera, clampCamera, getBounds, getPpy
    });

    const { framePeople, centerOnPerson, fitToScreen } = useCanvasCameraFraming({
        treeRef, containerRef, treeStats, isSidebarOpen, sidebarWidth, setCamera, clampCamera
    });

    useCanvasAutoClamp({
        setCamera, clampCamera, isSidebarOpen, sidebarWidth, treeStats, containerRef, treeRef
    });

    return {
        camera, setCamera, clampCamera, containerRef, treeRef,
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
 * Hook to manage sidebar width dragging, resizing constraints, cursor states,
 * and persistence to localStorage.
 *
 * @param {number} [initialWidth=360] - Default sidebar width in pixels
 * @returns {Object} { sidebarWidth, setSidebarWidth, isResizingSidebar, handleResizeStart }
 *
 * @example
 * const { sidebarWidth, isResizingSidebar, handleResizeStart } = useSidebarResize(360);
 *
 * @example
 * const { sidebarWidth, setSidebarWidth } = useSidebarResize();
 */
function useSidebarResize(initialWidth = 360) {
    const [sidebarWidth, setSidebarWidth] = useState(() => loadStoredSidebarWidth(initialWidth));
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingSidebar(true);
        setupSidebarDragListeners(e.clientX, sidebarWidth, setSidebarWidth, setIsResizingSidebar);
    }, [sidebarWidth]);

    return { sidebarWidth, setSidebarWidth, isResizingSidebar, handleResizeStart };
}
