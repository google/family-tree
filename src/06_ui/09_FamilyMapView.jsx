
/**
 * Renders the primary Tree View and Export CSV buttons for the map bottom overlay.
 *
 * @param {object} props
 * @param {Function} props.onSwitchToTree - Callback to return to family tree view
 * @param {Function} props.onExportCSV - Handler to trigger map locations CSV export
 * @returns {React.ReactNode}
 *
 * @example
 *   <MapStandardControls onSwitchToTree={() => {}} onExportCSV={() => {}} />
 *
 * @example
 *   <MapStandardControls onSwitchToTree={fn} onExportCSV={fn} />
 */
const MapStandardControls = ({ onSwitchToTree, onExportCSV }) => (
    <>
        <button
            onClick={onSwitchToTree}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Return to Family Tree diagram view"
        >
            <span>🌳</span>
            <span>Tree View</span>
        </button>
        <div className="w-px h-4 bg-slate-200"></div>
        <button
            onClick={onExportCSV}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Download CSV file for Google My Maps"
        >
            <Icons.MapPin />
            <span>Export CSV</span>
        </button>
    </>
);

/**
 * Renders bottom-left floating toolbar overlay for the family map view.
 * Provides quick actions to return to tree view, export map coordinates as CSV,
 * and open the locations directory when the sidebar is closed.
 *
 * @param {Object} props
 * @param {Function} props.onSwitchToTree - Callback to switch from map view back to tree canvas.
 * @param {Function} props.onExportCSV - Callback to trigger CSV download of map locations.
 * @param {Function} props.onFilterBy - Callback to activate directory or filtered search.
 * @param {boolean} props.isSidebarVisible - Whether any sidebar is currently open.
 * @returns {React.ReactElement}
 *
 * @example
 * <MapBottomControls
 *   onSwitchToTree={() => setShowMap(false)}
 *   onExportCSV={handleExportMapCSV}
 *   onFilterBy={handleFilterBy}
 *   isSidebarVisible={isSidebarOpen}
 * />
 *
 * @example
 * // In mobile view without sidebar
 * <MapBottomControls
 *   onSwitchToTree={closeMap}
 *   onExportCSV={exportCSV}
 *   onFilterBy={filterCategory}
 *   isSidebarVisible={false}
 * />
 */
function MapBottomControls({ onSwitchToTree, onExportCSV, onFilterBy, isSidebarVisible }) {
    return (
        <div className="export-ignore absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-md border border-slate-200" data-export-ignore="true">
            <MapStandardControls onSwitchToTree={onSwitchToTree} onExportCSV={onExportCSV} />
                {!isSidebarVisible && (
                    <>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <button
                            onClick={() => onFilterBy('directory', 'place')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Open Locations & Careers Directory"
                        >
                            <span>📁</span>
                            <span>Directory</span>
                        </button>
                    </>
                )}
        </div>
    );
}

/**
 * Interactive geographical map view rendering Leaflet markers for family member residential locations,
 * clustered geographical coordinates, and quick switching between map and lineage tree views.
 *
 * @param {Object} props
 * @param {FamilyTree} props.tree - Active family tree model
 * @param {Object|null} props.activeFilter - Active filter definition
 * @param {Function} props.onFilterBy - Callback to filter or navigate by place/directory
 * @param {Function} props.onExportCSV - Handler for CSV export of map locations
 * @param {Function} props.onSwitchToTree - Callback to switch viewport back to tree view
 * @param {number} props.sidebarWidth - Width of the sidebar in pixels
 * @param {boolean} props.isSidebarVisible - Whether the details sidebar is open
 * @param {boolean} props.showMap - Whether the map view is currently visible
 * @returns {React.ReactElement} Leaflet map container and control overlay element
 *
 * @example
 * <FamilyMapView
 *   tree={tree}
 *   activeFilter={activeFilter}
 *   onFilterBy={handleFilterBy}
 *   onExportCSV={handleExportMapCSV}
 *   onSwitchToTree={() => setShowMap(false)}
 *   sidebarWidth={sidebarWidth}
 *   isSidebarVisible={isAnySidebarOpen}
 *   showMap={showMap}
 * />
 *
 * @example
 * <FamilyMapView
 *   tree={null}
 *   activeFilter={null}
 *   onFilterBy={() => {}}
 *   onExportCSV={() => {}}
 *   onSwitchToTree={() => {}}
 *   sidebarWidth={320}
 *   isSidebarVisible={false}
 *   showMap={false}
 * />
 */
const FamilyMapView = ({ tree, activeFilter, onFilterBy, onExportCSV, onSwitchToTree, sidebarWidth, isSidebarVisible, showMap }) => {
    const { mapContainerRef } = useLeafletMap({
        tree,
        activeFilter,
        onFilterBy,
        showMap,
        sidebarWidth,
        isSidebarVisible
    });

    return (
        <div className="absolute inset-0 z-10 w-full h-full bg-slate-100 flex overflow-hidden">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />

            <MapBottomControls
                onSwitchToTree={onSwitchToTree}
                onExportCSV={onExportCSV}
                onFilterBy={onFilterBy}
                isSidebarVisible={isSidebarVisible}
            />
        </div>
    );
};

/**
 * Calculates the next index for keyboard arrow navigation, clamping within [0, totalItems - 1].
 *
 * @param {'up'|'down'} direction - Direction of movement ('up' or 'down').
 * @param {number} currentIndex - Current active item index.
 * @param {number} totalItems - Total number of items in the search list.
 * @returns {number} Clamped index between 0 and totalItems - 1.
 *
 * @example
 * getNextKeyboardIndex('down', 0, 5);
 * // => 1
 *
 * @example
 * getNextKeyboardIndex('up', 0, 5);
 * // => 0 (clamped to lower bound)
 */
function getNextKeyboardIndex(direction, currentIndex, totalItems) {
    if (totalItems <= 0) return 0;
    if (direction === 'down') {
        return Math.min(totalItems - 1, currentIndex + 1);
    }
    if (direction === 'up') {
        return Math.max(0, currentIndex - 1);
    }
    return currentIndex;
}

/**
 * Steps the omni search selected index in response to an arrow key navigation event,
 * updating the navigation timestamp and invoking the index state updater.
 *
 * @param {'ArrowDown'|'ArrowUp'|'down'|'up'} keyOrDirection - The arrow key or movement direction.
 * @param {number} currentIndex - Current active selected index.
 * @param {number} totalItems - Total number of items in search list.
 * @param {Function} [setIndexFn] - Setter function to receive the next index.
 * @returns {number} The updated selected index.
 *
 * @example
 *   const next = stepOmniSelectedIndex('ArrowDown', 0, 5, setIdx);
 *   // next is 1, setIdx(1) called
 *
 * @example
 *   const prev = stepOmniSelectedIndex('ArrowUp', 3, 5);
 *   // prev is 2
 */
function stepOmniSelectedIndex(keyOrDirection, currentIndex, totalItems, setIndexFn) {
    if (totalItems <= 0) return currentIndex;
    const direction = (keyOrDirection === 'ArrowDown' || keyOrDirection === 'down') ? 'down' : 'up';
    if (typeof window !== 'undefined') {
        window.__omniLastKeyboardNav = Date.now();
    }
    const nextIdx = getNextKeyboardIndex(direction, currentIndex, totalItems);
    if (typeof setIndexFn === 'function') {
        setIndexFn(nextIdx);
    }
    return nextIdx;
}

/**
 * Dispatches non-AI omni search entity selection (location, job, or person).
 *
 * @param {Object} item - The selected search item.
 * @param {Object} ctx - Handlers and setters for UI view navigation.
 *
 * @example
 *   _dispatchOmniEntitySelection({ type: 'location', place: 'Kochi' }, {
 *       setShowMap: () => {},
 *       onFilterBy: () => {},
 *       setSearchQuery: () => {}
 *   });
 *
 * @example
 *   _dispatchOmniEntitySelection({ type: 'person', person: { id: 'p123' } }, {
 *       setShowMap: () => {},
 *       handleSetFocusId: () => {}
 *   });
 */
function _dispatchOmniEntitySelection(item, ctx) {
    if (item.type === 'location') {
        ctx.setShowMap(true);
        ctx.onFilterBy('place', item.place);
        ctx.setSearchQuery(item.place);
    } else if (item.type === 'job') {
        ctx.setShowMap(false);
        ctx.onFilterBy('job', item.job);
        ctx.setSearchQuery(item.job);
    } else if (item.type === 'person') {
        ctx.setShowMap(false);
        ctx.handleSetFocusId(item.person.id);
    }
}

/**
 * Dispatches an omni search item action based on its type category ('ai', 'location', 'job', or 'person').
 *
 * @param {Object} item - The selected search item.
 * @param {Object} ctx - Handlers and setters for UI view navigation.
 *
 * @example
 *   _dispatchOmniSearchCategory({ type: 'location', place: 'Kochi' }, {
 *       setShowAI: () => {},
 *       setShowLogs: () => {},
 *       setShowMap: () => {},
 *       onFilterBy: () => {},
 *       setSearchQuery: () => {}
 *   });
 *
 * @example
 *   _dispatchOmniSearchCategory({ type: 'person', person: { id: 'p123' } }, {
 *       setShowAI: () => {},
 *       setShowLogs: () => {},
 *       setShowMap: () => {},
 *       handleSetFocusId: (id) => {}
 *   });
 */
function _dispatchOmniSearchCategory(item, ctx) {
    if (item.type === 'ai') {
        ctx.setShowMap(false);
        ctx.setShowLogs(false);
        ctx.setShowAI(true);
        if (typeof ctx.onAiSubmitQuery === 'function') {
            ctx.onAiSubmitQuery(item.query || ctx.searchQuery.trim());
        }
        ctx.setSearchQuery('');
        return;
    }

    ctx.setShowAI(false);
    ctx.setShowLogs(false);
    _dispatchOmniEntitySelection(item, ctx);
}

/**
 * Executes the action associated with an omni search result item.
 *
 * Dispatches to AI query, location filter on map, career/job filter, or person selection.
 *
 * @param {Object} options
 * @param {Object} options.item - The selected search item ({ type: 'ai'|'location'|'job'|'person', ... }).
 * @param {string} options.searchQuery - Current search query text.
 * @param {Function} options.setShowMap - State setter for map modal visibility.
 * @param {Function} options.setShowLogs - State setter for log panel visibility.
 * @param {Function} options.setShowAI - State setter for AI dialog visibility.
 * @param {Function} [options.onAiSubmitQuery] - Callback to submit AI query.
 * @param {Function} options.setSearchQuery - State setter for search query.
 * @param {Function} options.onFilterBy - Callback to activate filter (e.g. 'place', 'job').
 * @param {Function} options.handleSetFocusId - Callback to focus a person node by ID.
 * @param {Function} [options.onClose] - Callback when omni search finishes.
 *
 * @example
 * executeOmniSearchItem({ item: { type: 'ai', query: 'Find doctors' }, setShowMap: () => {}, setShowLogs: () => {}, setShowAI: () => {}, setSearchQuery: () => {} });
 *
 * @example
 * executeOmniSearchItem({ item: { type: 'location', place: 'Kochi' }, setShowMap: () => {}, setShowLogs: () => {}, setShowAI: () => {}, onFilterBy: () => {}, setSearchQuery: () => {} });
 */
function executeOmniSearchItem(options) {
    if (!options?.item) return;

    _dispatchOmniSearchCategory(options.item, options);

    if (typeof options.onClose === 'function') {
        options.onClose();
    }
}

/**
 * Hook computing classified query intent, candidate search results, and effective selected index
 * for omni search query strings.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Family tree domain model
 * @param {string} params.searchQuery - Query string typed by the user
 * @param {number|null} params.omniSelectedIndex - Explicit keyboard/hover selection index
 * @returns {{
 *   detectedIntent: object,
 *   searchItems: Array<object>,
 *   defaultIdx: number,
 *   effectiveSelectedIndex: number
 * }}
 *
 * @example
 * const { searchItems, effectiveSelectedIndex } = useOmniSearchResults({
 *   tree,
 *   searchQuery: 'Kochi',
 *   omniSelectedIndex: null
 * });
 *
 * @example
 * const { detectedIntent } = useOmniSearchResults({
 *   tree,
 *   searchQuery: 'Who is father of John?',
 *   omniSelectedIndex: 0
 * });
 */
function useOmniSearchResults({ tree, searchQuery, omniSelectedIndex }) {
    const detectedIntent = useMemo(() => {
        return classifyOmniQuery(searchQuery, tree);
    }, [searchQuery, tree]);

    const searchItems = useMemo(() => {
        if (!searchQuery || !searchQuery.trim()) return [];
        return getSearchItems(searchQuery, tree);
    }, [searchQuery, tree]);

    const defaultIdx = useMemo(() => {
        return getDefaultSelectedIndex(searchItems, detectedIntent);
    }, [searchItems, detectedIntent]);

    const effectiveSelectedIndex = useMemo(() => {
        if (searchItems.length === 0) return 0;
        if (omniSelectedIndex !== null && omniSelectedIndex >= 0 && omniSelectedIndex < searchItems.length) {
            return omniSelectedIndex;
        }
        return defaultIdx;
    }, [searchItems, omniSelectedIndex, defaultIdx]);

    return { detectedIntent, searchItems, defaultIdx, effectiveSelectedIndex };
}

/**
 * Processes keydown events originating from the omni search input box, navigating
 * candidate dropdown items with Arrow keys, executing items on Enter, and dismissing on Escape.
 *
 * @param {object} params
 * @param {React.KeyboardEvent} params.e - Native or synthetic keyboard event
 * @param {Array<object>} params.searchItems - Available omni search items
 * @param {number} params.effectiveSelectedIndex - Currently selected item index
 * @param {Function} params.setOmniSelectedIndex - State setter for selected index
 * @param {Function} params.handleSubmit - Callback to submit currently selected item
 * @param {React.RefObject<HTMLElement>} params.inputRef - Ref to the input element
 * @param {Function} params.setIsFocused - State setter for input focus status
 * @param {Function} [params.onClose] - Optional callback invoked on search dismissal
 *
 * @example
 * handleOmniSearchInputKeyDown({
 *   e: { key: 'ArrowDown', preventDefault: () => {}, stopPropagation: () => {} },
 *   searchItems: [{ id: 'item1' }],
 *   effectiveSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {},
 *   handleSubmit: () => {},
 *   inputRef: { current: null },
 *   setIsFocused: () => {}
 * });
 *
 * @example
 * handleOmniSearchInputKeyDown({
 *   e: { key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} },
 *   searchItems: [],
 *   effectiveSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {},
 *   handleSubmit: () => {},
 *   inputRef: { current: { blur: () => {} } },
 *   setIsFocused: () => {},
 *   onClose: () => {}
 * });
 */
function handleOmniSearchInputKeyDown({
    e, searchItems, effectiveSelectedIndex, setOmniSelectedIndex,
    handleSubmit, inputRef, setIsFocused, onClose
}) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (searchItems.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            stepOmniSelectedIndex(e.key, effectiveSelectedIndex, searchItems.length, setOmniSelectedIndex);
        }
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit(e);
        return;
    }
    if (e.key === 'Escape') {
        inputRef.current?.blur();
        setIsFocused(false);
        if (typeof onClose === 'function') onClose();
    }
}

/**
 * Hook registering window keydown listeners to navigate and execute omni search suggestions
 * when the search query is non-empty and the user is not focused on another input.
 *
 * @param {object} params
 * @param {string} params.searchQuery - Current query string
 * @param {Array<object>} params.searchItems - Filtered candidate items
 * @param {number} params.effectiveSelectedIndex - Current active item index
 * @param {Function} params.setOmniSelectedIndex - Selection index setter
 * @param {Function} params.executeItem - Action dispatcher for executing active item
 * @param {React.RefObject<HTMLElement>} params.inputRef - Ref to the search input element
 *
 * @example
 * useOmniSearchGlobalKeydown({
 *   searchQuery: 'Raphael',
 *   searchItems: [{ id: 'p1' }],
 *   effectiveSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {},
 *   executeItem: () => {},
 *   inputRef: { current: null }
 * });
 *
 * @example
 * useOmniSearchGlobalKeydown({
 *   searchQuery: '',
 *   searchItems: [],
 *   effectiveSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {},
 *   executeItem: () => {},
 *   inputRef: { current: null }
 * });
 */
function useOmniSearchGlobalKeydown({
    searchQuery,
    searchItems,
    effectiveSelectedIndex,
    setOmniSelectedIndex,
    executeItem,
    inputRef
}) {
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (!searchQuery.trim() || searchItems.length === 0) return;
            // If already focused in input, handleKeyDown on the input element will handle it exclusively
            if (e.target === inputRef.current) return;
            // Avoid intercepting when typing in another text input or textarea
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                stepOmniSelectedIndex(e.key, effectiveSelectedIndex, searchItems.length, setOmniSelectedIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [searchQuery, searchItems, effectiveSelectedIndex, setOmniSelectedIndex, executeItem, inputRef]);
}

/**
 * Hook providing item execution and form submission callbacks for the omni search navigation workflow.
 *
 * @param {Object} options
 * @param {Array<Object>} options.searchItems - Current filtered and suggested search items.
 * @param {number} options.effectiveSelectedIndex - Currently active or highlighted item index.
 * @param {string} options.searchQuery - Current search query text string.
 * @param {Function} options.setShowMap - State setter for geographic map modal visibility.
 * @param {Function} options.setShowLogs - State setter for system logs drawer visibility.
 * @param {Function} options.setShowAI - State setter for AI assistant panel visibility.
 * @param {Function} [options.onAiSubmitQuery] - Callback to submit queries directly to AI assistant.
 * @param {Function} options.setSearchQuery - State setter function for search query text.
 * @param {Function} options.onFilterBy - Callback to activate category or attribute filter.
 * @param {Function} options.handleSetFocusId - Callback to select and focus a specific person.
 * @param {Function} [options.onClose] - Callback when omni search is dismissed or submitted.
 * @returns {{ executeItem: Function, handleSubmit: Function }}
 *   Execution callback and submit event handler.
 *
 * @example
 *   const { executeItem, handleSubmit } = useOmniSearchExecution({
 *       searchItems: [],
 *       effectiveSelectedIndex: 0,
 *       searchQuery: '',
 *       setShowMap: () => {},
 *       setShowLogs: () => {},
 *       setShowAI: () => {},
 *       onAiSubmitQuery: () => {},
 *       setSearchQuery: () => {},
 *       onFilterBy: () => {},
 *       handleSetFocusId: () => {},
 *       onClose: () => {}
 *   });
 *
 * @example
 *   const { executeItem, handleSubmit } = useOmniSearchExecution({
 *       searchItems: [{ type: 'person', id: 'p1' }],
 *       effectiveSelectedIndex: 0,
 *       searchQuery: 'John',
 *       setShowMap: (val) => {},
 *       setShowLogs: (val) => {},
 *       setShowAI: (val) => {},
 *       onAiSubmitQuery: (query) => {},
 *       setSearchQuery: (query) => {},
 *       onFilterBy: (filter) => {},
 *       handleSetFocusId: (id) => {},
 *       onClose: () => {}
 *   });
 */
function useOmniSearchExecution({
    searchItems, effectiveSelectedIndex, searchQuery, setShowMap, setShowLogs,
    setShowAI, onAiSubmitQuery, setSearchQuery, onFilterBy, handleSetFocusId, onClose
}) {
    const executeItem = useCallback((itemToRun = null) => {
        const item = itemToRun || searchItems[effectiveSelectedIndex];
        executeOmniSearchItem({
            item, searchQuery, setShowMap, setShowLogs, setShowAI,
            onAiSubmitQuery, setSearchQuery, onFilterBy, handleSetFocusId, onClose
        });
    }, [searchItems, effectiveSelectedIndex, setShowAI, setShowMap, setShowLogs, onAiSubmitQuery, searchQuery, onFilterBy, handleSetFocusId, setSearchQuery, onClose]);

    const handleSubmit = useCallback((e) => {
        if (e) e.preventDefault();
        executeItem();
    }, [executeItem]);

    return { executeItem, handleSubmit };
}

/**
 * Hook managing search item evaluation, active index resolution, keyboard navigation,
 * and command execution for the OmniSearchBar component.
 *
 * @param {Object} options
 * @param {FamilyTree} options.tree - Family tree instance for relationship/profile search.
 * @param {string} options.searchQuery - Current search query text string.
 * @param {Function} options.setSearchQuery - State setter function for search query text.
 * @param {Function} options.onFilterBy - Callback to activate category or attribute filter.
 * @param {Function} options.handleSetFocusId - Callback to select and focus a specific person.
 * @param {Function} options.setShowMap - State setter for geographic map modal visibility.
 * @param {Function} options.setShowAI - State setter for AI assistant panel visibility.
 * @param {Function} options.setShowLogs - State setter for system logs drawer visibility.
 * @param {Function} [options.onAiSubmitQuery] - Callback to submit queries directly to AI assistant.
 * @param {number|null} options.omniSelectedIndex - Highlighted keyboard navigation index.
 * @param {Function} options.setOmniSelectedIndex - State setter for highlighted search item index.
 * @param {Function} [options.onClose] - Callback when omni search is dismissed or submitted.
 * @param {React.RefObject} options.inputRef - Ref pointing to the search HTMLInputElement.
 * @param {Function} options.setIsFocused - State setter for input focus state.
 * @returns {{
 *   searchItems: Array<Object>,
 *   effectiveSelectedIndex: number,
 *   executeItem: Function,
 *   handleSubmit: Function,
 *   handleKeyDown: Function
 * }}
 *
 * @example
 *   const {
 *       searchItems,
 *       effectiveSelectedIndex,
 *       executeItem,
 *       handleSubmit,
 *       handleKeyDown
 *   } = useOmniSearchNavigation({
 *       tree,
 *       searchQuery,
 *       setSearchQuery,
 *       onFilterBy,
 *       handleSetFocusId,
 *       setShowMap,
 *       setShowAI,
 *       setShowLogs,
 *       onAiSubmitQuery,
 *       omniSelectedIndex,
 *       setOmniSelectedIndex,
 *       onClose,
 *       inputRef,
 *       setIsFocused
 *   });
 *
 * @example
 *   // Mock search navigation in test harness
 *   const nav = useOmniSearchNavigation({
 *       tree: new FamilyTree(),
 *       searchQuery: 'Pala',
 *       setSearchQuery: () => {},
 *       onFilterBy: () => {},
 *       handleSetFocusId: () => {},
 *       setShowMap: () => {},
 *       setShowAI: () => {},
 *       setShowLogs: () => {},
 *       omniSelectedIndex: 0,
 *       setOmniSelectedIndex: () => {},
 *       inputRef: { current: null },
 *       setIsFocused: () => {}
 *   });
 */
function useOmniSearchNavigation({
    tree, searchQuery, setSearchQuery, onFilterBy, handleSetFocusId,
    setShowMap, setShowAI, setShowLogs, onAiSubmitQuery, omniSelectedIndex,
    setOmniSelectedIndex, onClose, inputRef, setIsFocused
}) {
    const { searchItems, effectiveSelectedIndex } = useOmniSearchResults({ tree, searchQuery, omniSelectedIndex });

    const { executeItem, handleSubmit } = useOmniSearchExecution({
        searchItems, effectiveSelectedIndex, searchQuery, setShowMap, setShowLogs,
        setShowAI, onAiSubmitQuery, setSearchQuery, onFilterBy, handleSetFocusId, onClose
    });

    const handleKeyDown = (e) => {
        handleOmniSearchInputKeyDown({
            e, searchItems, effectiveSelectedIndex, setOmniSelectedIndex,
            handleSubmit, inputRef, setIsFocused, onClose
        });
    };

    useOmniSearchGlobalKeydown({
        searchQuery, searchItems, effectiveSelectedIndex, setOmniSelectedIndex,
        executeItem, inputRef
    });

    return { searchItems, effectiveSelectedIndex, executeItem, handleSubmit, handleKeyDown };
}

/**
 * Manages auto-focus behavior and caret positioning for the omni-search input field.
 *
 * @param {boolean} autoFocus - Whether to trigger auto-focus on mount
 * @param {React.RefObject} inputRef - Reference to the HTML input element
 * @param {Function} setIsFocused - State setter for input focus tracking
 *
 * @example
 * useOmniSearchAutoFocus(true, inputRef, setIsFocused);
 *
 * @example
 * useOmniSearchAutoFocus(false, inputRef, setIsFocused);
 */
function useOmniSearchAutoFocus(autoFocus, inputRef, setIsFocused) {
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
            setIsFocused(true);
            const len = inputRef.current.value ? inputRef.current.value.length : 0;
            if (typeof inputRef.current.setSelectionRange === 'function') {
                inputRef.current.setSelectionRange(len, len);
            }
        }
    }, [autoFocus, inputRef, setIsFocused]);
}

/**
 * Processes text input changes in the omni search bar and updates query and filter state.
 *
 * @param {string} val - New search input value.
 * @param {Function} setSearchQuery - Search query setter.
 * @param {Function} [setOmniSelectedIndex] - Omni selected index setter.
 * @param {Function} onFilterBy - Filter dispatcher.
 * @param {Object|null} activeFilter - Currently active filter state.
 *
 * @example
 * processOmniInputChange('John', setQuery, setIdx, onFilter, null);
 *
 * @example
 * processOmniInputChange('', setQuery, setIdx, onFilter, { filterType: 'search' });
 */
function processOmniInputChange(val, setSearchQuery, setOmniSelectedIndex, onFilterBy, activeFilter) {
    setSearchQuery(val);
    if (typeof setOmniSelectedIndex === 'function') setOmniSelectedIndex(null);
    if (val.trim()) onFilterBy('search', val.trim());
    else if (activeFilter?.filterType === 'search') onFilterBy(null, null);
}