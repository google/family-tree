
/**
 * Unified omni search bar component handling text query entry, keyboard navigation,
 * and dispatching search actions (AI questions, location filters, career filters, person selections).
 *
 * @param {Object} props
 * @param {FamilyTree} props.tree - Family tree domain model
 * @param {string} props.searchQuery - Current search query text string
 * @param {Function} props.setSearchQuery - State setter for search query
 * @param {Function} props.onFilterBy - Callback to activate directory or filter
 * @param {Object|null} props.activeFilter - Current active filter state
 * @param {Function} props.handleSetFocusId - Callback to select a person node
 * @param {Function} props.setShowMap - State setter for map modal visibility
 * @param {Function} props.setShowAI - State setter for AI assistant visibility
 * @param {Function} props.setShowLogs - State setter for diagnostic logs drawer
 * @param {Function} [props.onAiSubmitQuery] - Callback to submit queries to AI
 * @param {number|null} props.omniSelectedIndex - Highlighted item index during keyboard navigation
 * @param {Function} props.setOmniSelectedIndex - State setter for highlighted item index
 * @param {boolean} [props.autoFocus=false] - Whether to automatically focus input on mount
 * @param {Function} [props.onClose] - Callback when search input is dismissed or blurred
 * @returns {React.ReactElement}
 *
 * @example
 *   <OmniSearchBar
 *     tree={tree}
 *     searchQuery=""
 *     setSearchQuery={() => {}}
 *     onFilterBy={() => {}}
 *     activeFilter={null}
 *     handleSetFocusId={() => {}}
 *     setShowMap={() => {}}
 *     setShowAI={() => {}}
 *     setShowLogs={() => {}}
 *     omniSelectedIndex={null}
 *     setOmniSelectedIndex={() => {}}
 *     autoFocus={false}
 *     onClose={() => {}}
 *   />
 *
 * @example
 *   <OmniSearchBar
 *     tree={null}
 *     searchQuery="Kerala"
 *     setSearchQuery={setQuery}
 *     onFilterBy={filterCategory}
 *     activeFilter={{ filterType: 'place', value: 'Kerala' }}
 *     handleSetFocusId={setFocus}
 *     setShowMap={setMap}
 *     setShowAI={setAI}
 *     setShowLogs={setLogs}
 *     omniSelectedIndex={0}
 *     setOmniSelectedIndex={setIdx}
 *     autoFocus={true}
 *   />
 */
const OmniSearchBar = ({
    tree, searchQuery, setSearchQuery, onFilterBy, activeFilter, handleSetFocusId, setShowMap,
    setShowAI, setShowLogs, onAiSubmitQuery, omniSelectedIndex, setOmniSelectedIndex, autoFocus = false, onClose
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    useOmniSearchAutoFocus(autoFocus, inputRef, setIsFocused);
    const { handleSubmit, handleKeyDown } = useOmniSearchNavigation({
        tree, searchQuery, setSearchQuery, onFilterBy, handleSetFocusId, setShowMap, setShowAI, setShowLogs, onAiSubmitQuery, omniSelectedIndex, setOmniSelectedIndex, onClose, inputRef, setIsFocused
    });
    const handleInputChange = (e) => processOmniInputChange(e.target.value, setSearchQuery, setOmniSelectedIndex, onFilterBy, activeFilter);
    return (
        <div className="relative h-[44px] w-full shrink-0 select-none">
            <form onSubmit={handleSubmit} className="relative h-full w-full">
                <div className={`flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-sm border px-3.5 h-full transition-colors duration-150 text-slate-600 w-full ${isFocused ? 'ring-2 ring-blue-500 border-blue-400 shadow-md' : 'border-slate-200'}`}>
                    <input 
                        ref={inputRef} type="text" placeholder="Omni Search: ask AI, find people, or explore places..." 
                        className="bg-transparent border-none outline-none flex-1 min-w-0 text-sm h-full font-sans text-slate-800 placeholder-slate-400" 
                        value={searchQuery} onChange={handleInputChange}
                        onFocus={() => {
                            setIsFocused(true);
                            if (searchQuery && searchQuery.trim()) {
                                if (!activeFilter || activeFilter.filterType !== 'search' || activeFilter.value !== searchQuery.trim()) {
                                    if (typeof onFilterBy === 'function') onFilterBy('search', searchQuery.trim());
                                }
                            }
                        }} 
                        onBlur={() => setIsFocused(false)} onKeyDown={handleKeyDown}
                    />
                </div>
            </form>
        </div>
    );
};

/**
 * Navigation history back/forward stepping buttons.
 *
 * @param {object} props
 * @param {boolean} props.canGoBack - Whether back navigation history is available
 * @param {boolean} props.canGoForward - Whether forward navigation history is available
 * @param {Function} props.onGoBack - Back navigation callback
 * @param {Function} props.onGoForward - Forward navigation callback
 * @returns {React.ReactElement}
 *
 * @example
 *   <NavigationHistoryButtons
 *     canGoBack={true}
 *     canGoForward={false}
 *     onGoBack={() => {}}
 *     onGoForward={() => {}}
 *   />
 *
 * @example
 *   <NavigationHistoryButtons
 *     canGoBack={false}
 *     canGoForward={true}
 *     onGoBack={handleBack}
 *     onGoForward={handleForward}
 *   />
 */
const NavigationHistoryButtons = ({
    canGoBack, canGoForward, onGoBack, onGoForward
}) => (
    <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-md border border-slate-200 p-1 rounded-xl shadow-sm h-[44px] shrink-0">
        <button 
            onClick={onGoBack} 
            disabled={!canGoBack} 
            className="h-full px-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer" 
            title="Go Back"
        >
            <Icons.ChevronLeft />
        </button>
        <div className="w-px h-4 bg-slate-200"></div>
        <button 
            onClick={onGoForward} 
            disabled={!canGoForward} 
            className="h-full px-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer" 
            title="Go Forward"
        >
            <Icons.ChevronRight />
        </button>
    </div>
);

/**
 * Renders a stylized floating action icon button for the top navigation bar.
 *
 * @param {object} props
 * @param {Function} props.onClick - Click event callback
 * @param {string} props.title - Tooltip description
 * @param {boolean} [props.isActive=false] - Whether button is in active state
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.customClass] - Optional style override classes
 * @param {React.ReactNode} props.children - Child icon content
 * @returns {React.ReactNode}
 *
 * @example
 * <TopNavIconButton onClick={handleOpenSearch} title="Search" isActive={Boolean(searchQuery)}>
 *   <Icons.Search />
 * </TopNavIconButton>
 *
 * @example
 * <TopNavIconButton onClick={onToggleMap} title="View Map" isActive={showMap}>
 *   <Icons.MapPin />
 * </TopNavIconButton>
 */
const TopNavIconButton = ({ onClick, title, isActive = false, disabled = false, customClass = '', children }) => {
    const base = 'h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-colors border shadow-sm shrink-0 cursor-pointer disabled:opacity-60';
    const activeCls = 'bg-blue-100 text-blue-600 border-blue-200 shadow-inner';
    const defaultCls = 'bg-white/95 backdrop-blur-md text-slate-600 hover:bg-slate-100 border-slate-200';
    const theme = customClass || (isActive ? activeCls : defaultCls);
    return (
        <button onClick={onClick} disabled={disabled} className={`${base} ${theme}`} title={title}>
            {children}
        </button>
    );
};

/**
 * Renders toolbar action buttons for Google Sheets import, standalone HTML export, and A4 print export.
 *
 * @param {object} props
 * @param {boolean} props.isStandalone - Whether running in embedded standalone mode
 * @param {Function} props.handleImport - Spreadsheet import handler
 * @param {boolean} props.isLoading - Whether tree data is actively loading
 * @param {Function} props.handleExportStandaloneApp - Standalone app export handler
 * @param {boolean} props.isExportingApp - Standalone app export in progress
 * @param {Function} props.handleExportA4Print - A4 print export handler
 * @param {boolean} props.isExportingA4 - A4 export in progress
 * @param {FamilyTree} props.tree - Current genealogy tree model
 * @returns {React.ReactNode}
 *
 * @example
 * <TopNavImportExportButtons isStandalone={false} handleImport={() => {}} isLoading={false} handleExportStandaloneApp={() => {}} isExportingApp={false} handleExportA4Print={() => {}} isExportingA4={false} tree={tree} />
 *
 * @example
 * <TopNavImportExportButtons isStandalone={true} handleImport={() => {}} isLoading={false} handleExportStandaloneApp={() => {}} isExportingApp={false} handleExportA4Print={() => {}} isExportingA4={false} tree={tree} />
 */
const TopNavImportExportButtons = ({
    isStandalone, handleImport, isLoading,
    handleExportStandaloneApp, isExportingApp,
    handleExportA4Print, isExportingA4, tree
}) => (
    <>
        {!isStandalone && (
            <>
                <TopNavIconButton onClick={() => handleImport()} disabled={isLoading} title="Import Google Sheet from Clipboard URL">
                    {isLoading ? <Icons.Loader /> : <Icons.Link />}
                </TopNavIconButton>
                <TopNavIconButton onClick={handleExportStandaloneApp} disabled={isExportingApp || isLoading} title="Download Standalone Interactive App (.html)">
                    {isExportingApp ? <Icons.Loader /> : <Icons.Download />}
                </TopNavIconButton>
            </>
        )}
        <TopNavIconButton onClick={handleExportA4Print} disabled={isExportingA4 || isLoading || !tree?.root} title="Print Tree / Export A4 Landscape SVGs (10pt names)">
            {isExportingA4 ? <Icons.Loader /> : <Icons.Printer />}
        </TopNavIconButton>
    </>
);

/**
 * Renders toolbar toggle buttons for Map, AI assistant, Logs drawer, and Search bar.
 *
 * @param {object} props
 * @param {boolean} props.showMap - Whether map view is active
 * @param {Function} props.onToggleMap - Handler to toggle map view
 * @param {boolean} props.isAILoading - Whether AI query is in flight
 * @param {boolean} props.showAI - Whether AI assistant panel is open
 * @param {Function} props.onToggleAI - Handler to toggle AI assistant
 * @param {boolean} props.isStandalone - Whether running in embedded standalone mode
 * @param {boolean} props.showLogs - Whether error/audit logs overlay is visible
 * @param {Function} props.setShowLogs - Logs visibility setter
 * @param {Function} props.setShowAI - AI assistant visibility setter
 * @param {string} props.searchQuery - Current search query
 * @param {Function} props.handleOpenSearch - Handler to expand search bar
 * @returns {React.ReactNode}
 *
 * @example
 * <TopNavViewToggleButtons showMap={false} onToggleMap={() => {}} isAILoading={false} showAI={false} onToggleAI={() => {}} isStandalone={false} showLogs={false} setShowLogs={() => {}} setShowAI={() => {}} searchQuery="" handleOpenSearch={() => {}} />
 *
 * @example
 * <TopNavViewToggleButtons showMap={true} onToggleMap={() => {}} isAILoading={false} showAI={true} onToggleAI={() => {}} isStandalone={true} showLogs={false} setShowLogs={() => {}} setShowAI={() => {}} searchQuery="Search" handleOpenSearch={() => {}} />
 */
const TopNavViewToggleButtons = ({
    showMap, onToggleMap, isAILoading, showAI, onToggleAI,
    isStandalone, showLogs, setShowLogs, setShowAI, searchQuery, handleOpenSearch
}) => {
    const aiTheme = isAILoading
        ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500 text-white animate-pulse border-transparent shadow-md'
        : (showAI ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white/95 backdrop-blur-md text-slate-600 hover:bg-slate-100 border-slate-200');

    return (
        <>
            <TopNavIconButton onClick={onToggleMap} title={showMap ? "Switch to Family Tree Diagram" : "View Family Locations Map"} isActive={showMap}>
                <Icons.MapPin />
            </TopNavIconButton>
            <TopNavIconButton onClick={onToggleAI} title="Ask AI" customClass={aiTheme}>
                <Icons.Sparkles />
            </TopNavIconButton>
            {!isStandalone && (
                <TopNavIconButton onClick={() => { setShowLogs(!showLogs); if (!showLogs) setShowAI(false); }} title="View Logs" isActive={showLogs}>
                    <Icons.Log />
                </TopNavIconButton>
            )}
            <button onClick={handleOpenSearch} className={`h-[44px] w-[44px] rounded-xl flex items-center justify-center transition-colors border shadow-sm shrink-0 cursor-pointer ${searchQuery ? 'bg-blue-100 text-blue-600 border-blue-200 shadow-inner' : 'bg-white/95 backdrop-blur-md text-slate-600 hover:bg-slate-100 border-slate-200'}`} title="Search"><Icons.Search /></button>
        </>
    );
};

/**
 * Top floating toolbar actions (Import, Export, Map, AI, Logs, Search).
 *
 * @param {object} props
 * @param {boolean} props.isStandalone - Embedded standalone flag
 * @param {Function} props.handleImport - Import sheet handler
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.handleExportStandaloneApp - Export standalone app handler
 * @param {boolean} props.isExportingApp - Export standalone loading state
 * @param {Function} props.handleExportA4Print - Export A4 print handler
 * @param {boolean} props.isExportingA4 - Export A4 loading state
 * @param {FamilyTree} props.tree - Family tree domain model
 * @param {boolean} props.showMap - Map view state
 * @param {Function} props.onToggleMap - Toggle map view handler
 * @param {boolean} props.showAI - AI drawer state
 * @param {boolean} props.isAILoading - AI loading indicator state
 * @param {Function} props.onToggleAI - Toggle AI drawer handler
 * @param {boolean} props.showLogs - Logs drawer state
 * @param {Function} props.setShowLogs - Set logs drawer state
 * @param {Function} props.setShowAI - Set AI drawer state
 * @param {string} props.searchQuery - Current search query
 * @param {Function} props.handleOpenSearch - Open search callback
 * @returns {React.ReactNode}
 *
 * @example
 *   <TopNavigationActions
 *     isStandalone={false}
 *     handleImport={() => {}}
 *     isLoading={false}
 *     handleExportStandaloneApp={() => {}}
 *     isExportingApp={false}
 *     handleExportA4Print={() => {}}
 *     isExportingA4={false}
 *     tree={{ people: {} }}
 *     showMap={false}
 *     onToggleMap={() => {}}
 *     showAI={false}
 *     isAILoading={false}
 *     onToggleAI={() => {}}
 *     showLogs={false}
 *     setShowLogs={() => {}}
 *     setShowAI={() => {}}
 *     searchQuery=""
 *     handleOpenSearch={() => {}}
 *   />
 *
 * @example
 *   <TopNavigationActions
 *     isStandalone={true}
 *     handleImport={fn}
 *     isLoading={true}
 *     handleExportStandaloneApp={fn}
 *     isExportingApp={false}
 *     handleExportA4Print={fn}
 *     isExportingA4={false}
 *     tree={null}
 *     showMap={true}
 *     onToggleMap={fn}
 *     showAI={true}
 *     isAILoading={true}
 *     onToggleAI={fn}
 *     showLogs={false}
 *     setShowLogs={fn}
 *     setShowAI={fn}
 *     searchQuery="Search"
 *     handleOpenSearch={fn}
 *   />
 */
const TopNavigationActions = (props) => (
    <>
        <TopNavImportExportButtons
            isStandalone={props.isStandalone}
            handleImport={props.handleImport}
            isLoading={props.isLoading}
            handleExportStandaloneApp={props.handleExportStandaloneApp}
            isExportingApp={props.isExportingApp}
            handleExportA4Print={props.handleExportA4Print}
            isExportingA4={props.isExportingA4}
            tree={props.tree}
        />
        <TopNavViewToggleButtons
            showMap={props.showMap}
            onToggleMap={props.onToggleMap}
            isAILoading={props.isAILoading}
            showAI={props.showAI}
            onToggleAI={props.onToggleAI}
            isStandalone={props.isStandalone}
            showLogs={props.showLogs}
            setShowLogs={props.setShowLogs}
            setShowAI={props.setShowAI}
            searchQuery={props.searchQuery}
            handleOpenSearch={props.handleOpenSearch}
        />
    </>
);

/**
 * Dismissible error alert banner floating below top navigation.
 *
 * @param {object} props
 * @param {string|null} props.errorMsg - Error message text to display.
 * @param {Function} props.onClear - Callback when banner close button is clicked.
 * @returns {React.ReactNode|null}
 *
 * @example
 *   <TopNavigationErrorBanner errorMsg="Error fetching sheet" onClear={() => setErrorMsg('')} />
 *
 * @example
 *   <TopNavigationErrorBanner errorMsg={null} onClear={() => {}} />
 */
const TopNavigationErrorBanner = ({ errorMsg, onClear }) => {
    if (!errorMsg) return null;
    return (
        <div className="self-end max-w-md bg-red-50/95 backdrop-blur-md border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-lg flex items-start gap-3 pointer-events-auto font-sans z-50 mt-4 mr-4">
            <div className="flex-1 text-sm font-medium">{errorMsg}</div>
            <button onClick={onClear} className="text-red-400 hover:text-red-600 p-1 -m-1"><Icons.Close /></button>
        </div>
    );
};

/**
 * Main floating header bar containing search input, navigation history controls,
 * view toggles (tree, map, AI, logs), and sheet import/export actions.
 *
 * @param {object} props
 * @param {FamilyTree} props.tree - Loaded family tree domain instance
 * @param {boolean} props.isSidebarVisible - Whether details sidebar is open
 * @param {number} [props.sidebarWidth=360] - Width of sidebar in pixels
 * @param {boolean} [props.isResizing=false] - Whether sidebar resize drag is active
 * @param {string} props.sheetUrl - Google sheet data source URL
 * @param {Function} props.setSheetUrl - Setter for sheet URL
 * @param {Function} props.handleImport - Import sheet handler
 * @param {boolean} props.isLoading - Whether import or tree build is in progress
 * @param {string} props.searchQuery - Current omni search text
 * @param {Function} props.setSearchQuery - Setter for search text
 * @param {Function} props.handleSetFocusId - Selection callback for person nodes
 * @param {Function} props.onFilterBy - Callback to set active filter/tab
 * @param {object|null} props.activeFilter - Active filter state
 * @param {boolean} props.showLogs - Whether debug logs panel is shown
 * @param {Function} props.setShowLogs - Setter for showLogs
 * @param {string|null} props.errorMsg - Displayed error message
 * @param {Function} props.setErrorMsg - Setter for error message
 * @param {boolean} props.showAI - Whether AI assistant panel is open
 * @param {Function} props.setShowAI - Setter for showAI
 * @param {boolean} props.canGoBack - Whether back navigation history exists
 * @param {boolean} props.canGoForward - Whether forward navigation history exists
 * @param {Function} props.onGoBack - Back navigation callback
 * @param {Function} props.onGoForward - Forward navigation callback
 * @param {boolean} props.isAILoading - Whether AI query is processing
 * @param {Function} props.handleExportImage - Export image callback
 * @param {boolean} props.isExporting - Whether image export is active
 * @param {Function} props.handleExportStandaloneApp - Export standalone HTML app callback
 * @param {boolean} props.isExportingApp - Whether app export is active
 * @param {Function} props.handleExportA4Print - A4 print export callback
 * @param {boolean} props.isExportingA4 - Whether print export is active
 * @param {boolean} props.showMap - Whether map view is active
 * @param {Function} props.setShowMap - Setter for showMap
 * @param {Function} [props.onAiSubmitQuery] - Callback to submit queries to AI
 * @param {number|null} props.omniSelectedIndex - Highlighted keyboard index in omni search
 * @param {Function} props.setOmniSelectedIndex - Setter for highlighted omni index
 * @returns {React.ReactElement}
 *
 * @example
 *   <TopNavigation
 *     tree={tree}
 *     isSidebarVisible={false}
 *     sidebarWidth={360}
 *     isResizing={false}
 *     sheetUrl=""
 *     setSheetUrl={() => {}}
 *     handleImport={() => {}}
 *     isLoading={false}
 *     searchQuery=""
 *     setSearchQuery={() => {}}
 *     handleSetFocusId={() => {}}
 *     onFilterBy={() => {}}
 *     activeFilter={null}
 *     showLogs={false}
 *     setShowLogs={() => {}}
 *     errorMsg={null}
 *     setErrorMsg={() => {}}
 *     showAI={false}
 *     setShowAI={() => {}}
 *     canGoBack={false}
 *     canGoForward={false}
 *     onGoBack={() => {}}
 *     onGoForward={() => {}}
 *     isAILoading={false}
 *     handleExportImage={() => {}}
 *     isExporting={false}
 *     handleExportStandaloneApp={() => {}}
 *     isExportingApp={false}
 *     handleExportA4Print={() => {}}
 *     isExportingA4={false}
 *     showMap={false}
 *     setShowMap={() => {}}
 *   />
 *
 * @example
 *   <TopNavigation
 *     tree={null}
 *     isSidebarVisible={true}
 *     searchQuery="Mary"
 *     setSearchQuery={fn}
 *     handleSetFocusId={fn}
 *     onFilterBy={fn}
 *     showMap={true}
 *     setShowMap={fn}
 *     showAI={false}
 *     setShowAI={fn}
 *   />
 */
/**
 * Registers global keyboard shortcut (Cmd+K / Ctrl+K) to open the search bar.
 *
 * @param {Function} handleOpenSearch - Callback invoked when the search shortcut is pressed.
 *
 * @example
 * useSearchShortcut(() => setIsSearchActive(true));
 *
 * @example
 * useSearchShortcut(handleOpenSearch);
 */
function useSearchShortcut(handleOpenSearch) {
    useEffect(() => {
        const handleGlobalSearchKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                handleOpenSearch();
            }
        };
        window.addEventListener('keydown', handleGlobalSearchKey);
        return () => window.removeEventListener('keydown', handleGlobalSearchKey);
    }, [handleOpenSearch]);
}

/**
 * Handles outside click and container blur events to dismiss the active search container.
 *
 * @param {React.RefObject<HTMLElement>} searchContainerRef - Ref to the search container element.
 * @param {boolean} isSearchActive - Whether the search container is currently active.
 * @param {Function} setIsSearchActive - State setter for search active flag.
 * @returns {{ handleSearchContainerBlur: (e: React.FocusEvent) => void }}
 *
 * @example
 * const { handleSearchContainerBlur } = useSearchContainerDismiss(searchContainerRef, isSearchActive, setIsSearchActive);
 *
 * @example
 * const { handleSearchContainerBlur } = useSearchContainerDismiss(ref, true, () => {});
 */
function useSearchContainerDismiss(searchContainerRef, isSearchActive, setIsSearchActive) {
    useEffect(() => {
        if (!isSearchActive) return;
        const handlePointerDown = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setIsSearchActive(false);
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isSearchActive, searchContainerRef, setIsSearchActive]);

    const handleSearchContainerBlur = (e) => {
        if (searchContainerRef.current && searchContainerRef.current.contains(e.relatedTarget)) {
            return;
        }
        setIsSearchActive(false);
    };

    return { handleSearchContainerBlur };
}

/**
 * Hook managing OmniSearchBar visibility, global keyboard shortcut (Cmd/Ctrl+K),
 * outside-click dismissal, and filter synchronization for top navigation.
 *
 * @param {object} options - Hook options.
 * @param {string} options.searchQuery - Current search query string.
 * @param {object|null} options.activeFilter - Current active filter state.
 * @param {boolean} options.isSidebarVisible - Whether right-hand sidebar is visible.
 * @param {Function} options.onFilterBy - Callback invoked to apply filter changes.
 * @returns {object} Object containing search active state, ref, and handlers.
 *
 * @example
 *   const { isSearchActive, searchContainerRef, handleOpenSearch } = useTopNavigationSearch({
 *     searchQuery: 'Raphael',
 *     activeFilter: null,
 *     isSidebarVisible: true,
 *     onFilterBy: (type, val) => console.log(type, val)
 *   });
 *
 * @example
 *   const { isSearchActive, setIsSearchActive, handleSearchContainerBlur } = useTopNavigationSearch({
 *     searchQuery: '',
 *     activeFilter: { filterType: 'job', value: 'Farmer' },
 *     isSidebarVisible: false,
 *     onFilterBy: () => {}
 *   });
 */
function useTopNavigationSearch({ searchQuery, activeFilter, isSidebarVisible, onFilterBy }) {
    const [isSearchActive, setIsSearchActive] = useState(false);
    const searchContainerRef = useRef(null);

    const { handleSearchContainerBlur } = useSearchContainerDismiss(
        searchContainerRef, isSearchActive, setIsSearchActive
    );

    const handleOpenSearch = useCallback(() => {
        setIsSearchActive(true);
        if (searchQuery && searchQuery.trim()) {
            if (!activeFilter || activeFilter.filterType !== 'search' || activeFilter.value !== searchQuery.trim() || !isSidebarVisible) {
                if (typeof onFilterBy === 'function') {
                    onFilterBy('search', searchQuery.trim());
                }
            }
        }
    }, [searchQuery, activeFilter, isSidebarVisible, onFilterBy]);

    useSearchShortcut(handleOpenSearch);

    return {
        isSearchActive,
        setIsSearchActive,
        searchContainerRef,
        handleSearchContainerBlur,
        handleOpenSearch
    };
}

/**
 * Renders the expanded search bar and navigation history buttons container when search mode is active.
 *
 * @param {Object} props
 * @param {React.RefObject} props.searchContainerRef - Ref to container for focus/blur management.
 * @param {Function} props.handleSearchContainerBlur - Blur handler for search container.
 * @param {Object} props.tree - Current genealogy tree data model.
 * @param {string} props.searchQuery - Current omni-search input query.
 * @param {Function} props.setSearchQuery - Search query state setter.
 * @param {Function} props.onFilterBy - Callback to apply search/directory filter.
 * @param {Object|null} props.activeFilter - Active filter state.
 * @param {Function} props.handleSetFocusId - Callback to change focused person.
 * @param {Function} props.setShowMap - Map view visibility setter.
 * @param {Function} props.setShowAI - AI assistant visibility setter.
 * @param {Function} props.setShowLogs - Logs visibility setter.
 * @param {Function} props.onAiSubmitQuery - AI query submission handler.
 * @param {number} props.omniSelectedIndex - Selected suggestion index in omni-search.
 * @param {Function} props.setOmniSelectedIndex - Selected suggestion index setter.
 * @param {Function} props.setIsSearchActive - Search active toggle setter.
 * @param {boolean} props.canGoBack - Whether backward navigation history exists.
 * @param {boolean} props.canGoForward - Whether forward navigation history exists.
 * @param {Function} props.onGoBack - Backward history navigation handler.
 * @param {Function} props.onGoForward - Forward history navigation handler.
 * @param {boolean} props.isSidebarVisible - Whether details sidebar is currently open.
 * @param {Function} props.setFocusId - Callback to reset/set focus ID.
 * @returns {React.ReactElement}
 *
 * @example
 * <TopNavigationActiveSearchBar
 *   searchContainerRef={{ current: null }}
 *   handleSearchContainerBlur={() => {}}
 *   tree={{ people: {} }}
 *   searchQuery=""
 *   setSearchQuery={() => {}}
 *   onFilterBy={() => {}}
 *   activeFilter={null}
 *   handleSetFocusId={() => {}}
 *   setShowMap={() => {}}
 *   setShowAI={() => {}}
 *   setShowLogs={() => {}}
 *   onAiSubmitQuery={() => {}}
 *   omniSelectedIndex={0}
 *   setOmniSelectedIndex={() => {}}
 *   setIsSearchActive={() => {}}
 *   canGoBack={false}
 *   canGoForward={false}
 *   onGoBack={() => {}}
 *   onGoForward={() => {}}
 *   isSidebarVisible={false}
 *   setFocusId={() => {}}
 * />
 *
 * @example
 * <TopNavigationActiveSearchBar
 *   searchContainerRef={{ current: null }}
 *   handleSearchContainerBlur={() => {}}
 *   tree={treeData}
 *   searchQuery="Mary"
 *   setSearchQuery={setQuery}
 *   onFilterBy={filterHandler}
 *   activeFilter={null}
 *   handleSetFocusId={focusHandler}
 *   setShowMap={setMap}
 *   setShowAI={setAI}
 *   setShowLogs={setLogs}
 *   onAiSubmitQuery={aiQueryHandler}
 *   omniSelectedIndex={1}
 *   setOmniSelectedIndex={setIndex}
 *   setIsSearchActive={setSearch}
 *   canGoBack={true}
 *   canGoForward={false}
 *   onGoBack={backHandler}
 *   onGoForward={forwardHandler}
 *   isSidebarVisible={true}
 *   setFocusId={focusHandler}
 * />
 */
const TopNavigationActiveSearchBar = ({
    searchContainerRef, handleSearchContainerBlur, tree, searchQuery, setSearchQuery,
    onFilterBy, activeFilter, handleSetFocusId, setShowMap, setShowAI, setShowLogs,
    onAiSubmitQuery, omniSelectedIndex, setOmniSelectedIndex, setIsSearchActive,
    canGoBack, canGoForward, onGoBack, onGoForward, isSidebarVisible, setFocusId
}) => {
    const omniProps = {
        tree, searchQuery, setSearchQuery, onFilterBy, activeFilter, handleSetFocusId,
        setShowMap, setShowAI, setShowLogs, onAiSubmitQuery, omniSelectedIndex,
        setOmniSelectedIndex, autoFocus: true, onClose: () => setIsSearchActive(false)
    };
    const historyProps = {
        canGoBack, canGoForward, onGoBack, onGoForward
    };
    return (
        <div ref={searchContainerRef} onBlur={handleSearchContainerBlur} className="flex gap-2 items-center w-full">
            <div className="flex-1 min-w-0">
                <OmniSearchBar {...omniProps} />
            </div>
            <NavigationHistoryButtons {...historyProps} />
        </div>
    );
};

/**
 * Renders the AI Assistant title badge in the top navigation toolbar.
 *
 * @returns {React.ReactNode}
 *
 * @example
 *   <TopNavigationAiTitle />
 *
 * @example
 *   {showAI && <TopNavigationAiTitle />}
 */
const TopNavigationAiTitle = () => (
    <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[14px] select-none pl-1 mr-auto truncate">
        <span className="text-blue-600"><Icons.Sparkles /></span>
        <span>AI Assistant</span>
    </div>
);

/**
 * Renders the compact toolbar actions when search is inactive, including AI badge,
 * import/export controls, map toggle, and navigation history.
 *
 * @param {Object} props
 * @param {boolean} props.showAI - Whether AI assistant panel is open.
 * @param {boolean} props.isStandalone - Whether running in embedded standalone mode.
 * @param {Function} props.handleImport - Spreadsheet import handler.
 * @param {boolean} props.isLoading - Whether tree data is loading.
 * @param {Function} props.handleExportStandaloneApp - Standalone app export handler.
 * @param {boolean} props.isExportingApp - Standalone app export status.
 * @param {Function} props.handleExportA4Print - Multi-page printable export handler.
 * @param {boolean} props.isExportingA4 - Multi-page export status.
 * @param {Object} props.tree - Current genealogy tree model.
 * @param {boolean} props.showMap - Whether map view is active.
 * @param {Function} props.handleToggleMap - Handler to toggle map view.
 * @param {boolean} props.isAILoading - Whether AI query is in flight.
 * @param {Function} props.handleToggleAI - Handler to toggle AI assistant.
 * @param {boolean} props.showLogs - Whether error/audit logs overlay is visible.
 * @param {Function} props.setShowLogs - Logs visibility setter.
 * @param {Function} props.setShowAI - AI assistant visibility setter.
 * @param {string} props.searchQuery - Current search query.
 * @param {Function} props.handleOpenSearch - Handler to expand search bar.
 * @param {boolean} props.isSidebarVisible - Whether details sidebar is visible.
 * @param {boolean} props.canGoBack - Whether back navigation is available.
 * @param {boolean} props.canGoForward - Whether forward navigation is available.
 * @param {Function} props.onGoBack - Back navigation handler.
 * @param {Function} props.onGoForward - Forward navigation handler.
 * @param {Function} props.setFocusId - Focus ID setter.
 * @returns {React.ReactElement}
 *
 * @example
 * <TopNavigationInactiveToolbar
 *   showAI={false}
 *   isStandalone={false}
 *   handleImport={() => {}}
 *   isLoading={false}
 *   handleExportStandaloneApp={() => {}}
 *   isExportingApp={false}
 *   handleExportA4Print={() => {}}
 *   isExportingA4={false}
 *   tree={{ people: {} }}
 *   showMap={false}
 *   handleToggleMap={() => {}}
 *   isAILoading={false}
 *   handleToggleAI={() => {}}
 *   showLogs={false}
 *   setShowLogs={() => {}}
 *   setShowAI={() => {}}
 *   searchQuery=""
 *   handleOpenSearch={() => {}}
 *   isSidebarVisible={false}
 *   canGoBack={false}
 *   canGoForward={false}
 *   onGoBack={() => {}}
 *   onGoForward={() => {}}
 *   setFocusId={() => {}}
 * />
 *
 * @example
 * <TopNavigationInactiveToolbar
 *   showAI={true}
 *   isStandalone={true}
 *   handleImport={() => {}}
 *   isLoading={false}
 *   handleExportStandaloneApp={() => {}}
 *   isExportingApp={false}
 *   handleExportA4Print={() => {}}
 *   isExportingA4={false}
 *   tree={treeData}
 *   showMap={true}
 *   handleToggleMap={() => {}}
 *   isAILoading={false}
 *   handleToggleAI={() => {}}
 *   showLogs={false}
 *   setShowLogs={() => {}}
 *   setShowAI={() => {}}
 *   searchQuery=""
 *   handleOpenSearch={() => {}}
 *   isSidebarVisible={true}
 *   canGoBack={true}
 *   canGoForward={false}
 *   onGoBack={() => {}}
 *   onGoForward={() => {}}
 *   setFocusId={() => {}}
 * />
 */
const TopNavigationInactiveToolbar = ({
    showAI, isStandalone, handleImport, isLoading, handleExportStandaloneApp,
    isExportingApp, handleExportA4Print, isExportingA4, tree, showMap,
    handleToggleMap, isAILoading, handleToggleAI, showLogs, setShowLogs,
    setShowAI, searchQuery, handleOpenSearch, isSidebarVisible, canGoBack,
    canGoForward, onGoBack, onGoForward, setFocusId
}) => {
    const actionsProps = {
        isStandalone, handleImport, isLoading, handleExportStandaloneApp, isExportingApp,
        handleExportA4Print, isExportingA4, tree, showMap, onToggleMap: handleToggleMap,
        showAI, isAILoading, onToggleAI: handleToggleAI, showLogs, setShowLogs,
        setShowAI, searchQuery, handleOpenSearch
    };
    const historyProps = {
        canGoBack, canGoForward, onGoBack, onGoForward
    };
    return (
        <div className="flex gap-2 items-center flex-nowrap justify-end w-full">
            {showAI && <TopNavigationAiTitle />}
            <div className="flex gap-2 items-center flex-nowrap justify-end ml-auto shrink-0">
                <TopNavigationActions {...actionsProps} />
                {(isSidebarVisible || canGoBack || canGoForward) && (
                    <NavigationHistoryButtons {...historyProps} />
                )}
            </div>
        </div>
    );
};

/**
 * Large brand emblem and "Family Tree" title displayed in the empty tree area while loading
 * (when the activity log drawer is open), and removed once loading completes.
 *
 * @returns {React.ReactNode}
 *
 * @example
 * <TreeLoadingBrandSplash />
 *
 * @example
 * {isLoading && <TreeLoadingBrandSplash />}
 */
const TreeLoadingBrandSplash = () => (
    <div data-testid="tree-loading-brand-splash" className="w-full h-full flex flex-col items-center justify-center gap-5 select-none pointer-events-none relative z-10 px-6">
        <div className="flex items-center justify-center gap-5 bg-white/85 backdrop-blur-xl px-8 py-6 rounded-3xl shadow-[0_0_40px_rgba(79,70,229,0.14),0_0_12px_rgba(0,0,0,0.08)] border border-indigo-100/80">
            <svg viewBox="0 0 64 64" className="w-[72px] h-[72px] shrink-0 drop-shadow-md" aria-hidden="true">
                <defs>
                    <linearGradient id="navBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#312e81" />
                        <stop offset="50%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id="navTrunkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#c7d2fe" />
                    </linearGradient>
                </defs>
                <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#navBgGrad)" stroke="#a5b4fc" strokeOpacity="0.35" strokeWidth="1.5" />
                <g fill="none" stroke="url(#navTrunkGrad)" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M32 49 V33" strokeWidth="4.5" />
                    <path d="M23 51 C28 51 32 48 32 43" strokeWidth="3.2" />
                    <path d="M41 51 C36 51 32 48 32 43" strokeWidth="3.2" />
                    <path d="M32 36 C22 36 16 30 16 21" strokeWidth="3.4" />
                    <path d="M32 34 V15" strokeWidth="3.4" />
                    <path d="M32 36 C42 36 48 30 48 21" strokeWidth="3.4" />
                </g>
                <circle cx="32" cy="14" r="6.2" fill="#fde68a" stroke="#ffffff" strokeWidth="2" />
                <circle cx="16" cy="21" r="5.2" fill="#ffffff" stroke="#c7d2fe" strokeWidth="1.5" />
                <circle cx="48" cy="21" r="5.2" fill="#ffffff" stroke="#c7d2fe" strokeWidth="1.5" />
                <circle cx="32" cy="35" r="3.6" fill="#ffffff" />
            </svg>
            <h1 className="text-[44px] leading-none tracking-wide font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 via-indigo-600/80 to-purple-600/80 opacity-85" style={{ fontFamily: "'Uncial Antiqua', serif" }}>Family Tree</h1>
        </div>
        <div className="text-sm text-slate-400 font-sans tracking-wide animate-pulse">Fetching and building tree...</div>
    </div>
);

/**
 * Hook providing toggle action handlers for map and AI assistant in top navigation.
 *
 * @param {object} params
 * @param {boolean} params.showMap - Current map visibility state
 * @param {Function} params.setShowMap - Map visibility setter
 * @param {Function} params.setIsSidebarVisible - Sidebar visibility setter
 * @param {Function} params.setActiveFilter - Filter setter
 * @param {Function} params.setFocusId - Person focus setter
 * @param {boolean} params.showAI - AI panel visibility state
 * @param {Function} params.setShowAI - AI panel visibility setter
 * @param {Function} params.setShowLogs - Logs visibility setter
 * @returns {{ handleToggleMap: Function, handleToggleAI: Function }}
 *
 * @example
 * const { handleToggleMap, handleToggleAI } = useTopNavigationHandlers({ showMap: false, setShowMap: () => {}, setIsSidebarVisible: () => {}, setActiveFilter: () => {}, setFocusId: () => {}, showAI: false, setShowAI: () => {}, setShowLogs: () => {} });
 *
 * @example
 * const { handleToggleMap, handleToggleAI } = useTopNavigationHandlers({ showMap: true, setShowMap: () => {}, setIsSidebarVisible: () => {}, setActiveFilter: () => {}, setFocusId: () => {}, showAI: true, setShowAI: () => {}, setShowLogs: () => {} });
 */
function useTopNavigationHandlers({ showMap, setShowMap, setIsSidebarVisible, setActiveFilter, setFocusId, showAI, setShowAI, setShowLogs }) {
    const handleToggleMap = () => {
        const nextMap = !showMap;
                                    setShowMap(nextMap);
                                    if (nextMap) {
                                        setIsSidebarVisible(true);
                                        setActiveFilter(null);
                                        setFocusId(null);
                                    }
    };

    const handleToggleAI = () => {
        setShowAI(!showAI);
        if (!showAI) setShowLogs(false);
    };

    return { handleToggleMap, handleToggleAI };
}

/**
 * Right-aligned container panel in top navigation housing search bar or compact toolbar.
 *
 * @param {object} props
 * @param {boolean} props.isSearchActive - Whether omni-search is currently expanded
 * @param {boolean} props.isSidebarVisible - Whether details sidebar is open
 * @param {number} props.sidebarWidth - Configured sidebar width in pixels
 * @param {React.ReactNode} props.activeSearchBar - Rendered active search bar element
 * @param {React.ReactNode} props.inactiveToolbar - Rendered inactive toolbar element
 * @returns {React.ReactNode}
 *
 * @example
 * <TopNavigationRightPanel isSearchActive={false} isSidebarVisible={true} sidebarWidth={360} activeSearchBar={null} inactiveToolbar={<div>Toolbar</div>} />
 *
 * @example
 * <TopNavigationRightPanel isSearchActive={true} isSidebarVisible={false} sidebarWidth={360} activeSearchBar={<div>Search</div>} inactiveToolbar={null} />
 */
const TopNavigationRightPanel = ({ isSearchActive, isSidebarVisible, sidebarWidth, activeSearchBar, inactiveToolbar }) => (
    <div 
        className={`flex flex-col gap-3 items-end pointer-events-auto ${(isSidebarVisible || isSearchActive) ? 'px-6' : 'pr-4'}`}
        style={{ width: (isSidebarVisible || isSearchActive) ? `${sidebarWidth}px` : 'auto' }}
    >
        {isSearchActive ? activeSearchBar : inactiveToolbar}
    </div>
);

/**
 * Main navigation row containing right-side interactive toolbars.
 *
 * @param {Object} props
 * @param {boolean} props.isStandalone - Whether app is running in standalone export mode.
 * @param {boolean} props.showLogs - Whether logs slide-over is open.
 * @param {boolean} props.isLoading - Whether tree import is loading.
 * @param {boolean} props.isSearchActive - Whether omni search input is expanded.
 * @param {boolean} props.isSidebarVisible - Whether details sidebar is open.
 * @param {number} [props.sidebarWidth=360] - Width of details sidebar in pixels.
 * @param {Object} props.activeProps - Props for active search bar.
 * @param {Object} props.inactiveProps - Props for inactive navigation toolbar.
 * @returns {React.ReactElement}
 *
 * @example
 * <TopNavigationMainBar isStandalone={false} showLogs={false} isLoading={false} isSearchActive={false} isSidebarVisible={false} activeProps={{}} inactiveProps={{}} />
 *
 * @example
 * <TopNavigationMainBar isStandalone={true} showLogs={true} isLoading={true} isSearchActive={true} isSidebarVisible={true} activeProps={{}} inactiveProps={{}} />
 */
const TopNavigationMainBar = ({
    isStandalone, showLogs, isLoading, isSearchActive, isSidebarVisible, sidebarWidth, activeProps, inactiveProps
}) => (
    <div className="flex justify-between items-start">
        {!isStandalone && (
                <div className="flex items-center pointer-events-auto ml-16">
                </div>
        )}
        {!showLogs && !isLoading && (
            <TopNavigationRightPanel
                isSearchActive={isSearchActive} isSidebarVisible={isSidebarVisible} sidebarWidth={sidebarWidth}
                activeSearchBar={<TopNavigationActiveSearchBar {...activeProps} />}
                inactiveToolbar={<TopNavigationInactiveToolbar {...inactiveProps} />}
            />
        )}
    </div>
);

/**
 * Renders the top floating navigation header including title, omni-search bar,
 * action toolbar, navigation history buttons, and error banner.
 *
 * @param {Object} props - Component properties.
 * @param {Object} props.tree - Current genealogy tree data model.
 * @param {boolean} props.isSidebarVisible - Whether person/directory sidebar is open.
 * @param {number} [props.sidebarWidth=360] - Width of sidebar in pixels.
 * @param {boolean} [props.isResizing=false] - Whether sidebar is actively being dragged/resized.
 * @param {string} props.sheetUrl - Google Sheets data source URL.
 * @param {Function} props.setSheetUrl - Sheet URL state setter.
 * @param {Function} props.handleImport - Spreadsheet import handler.
 * @param {boolean} props.isLoading - Whether tree data is actively loading.
 * @param {string} props.searchQuery - Current omni-search input query.
 * @param {Function} props.setSearchQuery - Search query state setter.
 * @param {Function} props.handleSetFocusId - Callback to change focused person.
 * @param {Function} props.onFilterBy - Callback to apply search/directory filter.
 * @param {Object|null} props.activeFilter - Active filter state.
 * @param {boolean} props.showLogs - Whether error/audit logs overlay is visible.
 * @param {Function} props.setShowLogs - Logs visibility setter.
 * @param {string} props.errorMsg - Active error message string.
 * @param {Function} props.setErrorMsg - Error message state setter.
 * @param {boolean} props.showAI - Whether AI assistant panel is open.
 * @param {Function} props.setShowAI - AI assistant visibility setter.
 * @param {boolean} props.canGoBack - Whether backward navigation history exists.
 * @param {boolean} props.canGoForward - Whether forward navigation history exists.
 * @param {Function} props.onGoBack - Backward history navigation handler.
 * @param {Function} props.onGoForward - Forward history navigation handler.
 * @param {boolean} props.isAILoading - Whether AI query is processing.
 * @param {Function} props.handleExportImage - Canvas image export handler.
 * @param {boolean} props.isExporting - Image export in-progress state.
 * @param {Function} props.handleExportStandaloneApp - Standalone HTML app export handler.
 * @param {boolean} props.isExportingApp - Standalone app export in-progress state.
 * @param {Function} props.handleExportA4Print - Multi-page printable export handler.
 * @param {boolean} props.isExportingA4 - Printable export in-progress state.
 * @param {boolean} props.showMap - Whether geographic map view is active.
 * @param {Function} props.setShowMap - Map view visibility setter.
 * @param {Function} props.onAiSubmitQuery - AI query submission handler.
 * @param {number} props.omniSelectedIndex - Selected suggestion index in omni-search.
 * @param {Function} props.setOmniSelectedIndex - Selected suggestion index setter.
 * @param {Function} [props.setIsSidebarVisible] - Sidebar visibility setter.
 * @param {Function} [props.setActiveFilter] - Active filter state setter.
 * @returns {React.ReactElement} The rendered top navigation header.
 *
 * @example
 * <TopNavigation
 *   tree={{ people: {} }}
 *   isSidebarVisible={false}
 *   sidebarWidth={360}
 *   handleImport={() => {}}
 *   isLoading={false}
 *   searchQuery=""
 *   setSearchQuery={() => {}}
 *   handleSetFocusId={() => {}}
 *   onFilterBy={() => {}}
 *   activeFilter={null}
 *   showLogs={false}
 *   setShowLogs={() => {}}
 *   errorMsg=""
 *   setErrorMsg={() => {}}
 *   showAI={false}
 *   setShowAI={() => {}}
 *   canGoBack={false}
 *   canGoForward={false}
 *   onGoBack={() => {}}
 *   onGoForward={() => {}}
 *   isAILoading={false}
 *   showMap={false}
 *   setShowMap={() => {}}
 *   omniSelectedIndex={0}
 *   setOmniSelectedIndex={() => {}}
 * />
 *
 * @example
 * <TopNavigation
 *   tree={treeData}
 *   isSidebarVisible={true}
 *   searchQuery="John"
 *   setSearchQuery={setQuery}
 *   handleSetFocusId={setFocus}
 *   showMap={true}
 *   setShowMap={setMap}
 *   errorMsg="Import failed"
 *   setErrorMsg={setError}
 * />
 */
const TopNavigation = (props) => {
    const {
        tree, isSidebarVisible, sidebarWidth = 360, isResizing = false, sheetUrl, setSheetUrl, handleImport, isLoading, searchQuery, setSearchQuery, 
        handleSetFocusId, onFilterBy, activeFilter, showLogs, setShowLogs, errorMsg, setErrorMsg,
        showAI, setShowAI, canGoBack, canGoForward, onGoBack, onGoForward, isAILoading, handleExportImage, isExporting,
        handleExportStandaloneApp, isExportingApp, handleExportA4Print, isExportingA4,
        showMap, setShowMap, onAiSubmitQuery, omniSelectedIndex, setOmniSelectedIndex,
        setIsSidebarVisible = () => {}, setActiveFilter = () => {}
    } = props;
    const isStandalone = isStandaloneExportMode();
    const setFocusId = handleSetFocusId;
    const { isSearchActive, setIsSearchActive, searchContainerRef, handleSearchContainerBlur, handleOpenSearch } =
        useTopNavigationSearch({ searchQuery, activeFilter, isSidebarVisible, onFilterBy });
    const { handleToggleMap, handleToggleAI } =
        useTopNavigationHandlers({ showMap, setShowMap, setIsSidebarVisible, setActiveFilter, setFocusId, showAI, setShowAI, setShowLogs });

    const activeProps = { searchContainerRef, handleSearchContainerBlur, tree, searchQuery, setSearchQuery, onFilterBy, activeFilter, handleSetFocusId, setShowMap, setShowAI, setShowLogs, onAiSubmitQuery, omniSelectedIndex, setOmniSelectedIndex, setIsSearchActive, canGoBack, canGoForward, onGoBack, onGoForward, isSidebarVisible, setFocusId };
    const inactiveProps = { showAI, isStandalone, handleImport, isLoading, handleExportStandaloneApp, isExportingApp, handleExportA4Print, isExportingA4, tree, showMap, handleToggleMap, isAILoading, handleToggleAI, showLogs, setShowLogs, setShowAI, searchQuery, handleOpenSearch, isSidebarVisible, canGoBack, canGoForward, onGoBack, onGoForward, setFocusId };

    return (
        <div className="absolute top-4 left-0 right-0 z-50 flex flex-col gap-3 pointer-events-none">
            <TopNavigationMainBar
                isStandalone={isStandalone} showLogs={showLogs} isLoading={isLoading}
                isSearchActive={isSearchActive} isSidebarVisible={isSidebarVisible} sidebarWidth={sidebarWidth}
                activeProps={activeProps} inactiveProps={inactiveProps}
            />
            <TopNavigationErrorBanner errorMsg={errorMsg} onClear={() => setErrorMsg('')} />
        </div>
    );
};

const BUTTON_DOCUMENTATION_CATALOG = {
    'Import Google Sheet from Clipboard URL': {
        title: 'Import Google Sheet from Clipboard',
        badge: 'Data Sync • Clipboard URL',
        summary: 'Reads a **Google Sheets URL** or **Spreadsheet ID** from your clipboard (or prompts for one), crawls the root sheet and all linked branch tabs in **`Links`** in parallel, and rebuilds the family tree.',
        examples: [
            { label: 'Clipboard URL Sync', detail: 'Copy `https://docs.google.com/spreadsheets/d/1ZDpcz2.../edit` and click this button to import all linked family sheets.' },
            { label: 'Direct URL Parameter', detail: 'Append `?id=1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI` to the app URL to load that root sheet automatically on startup.' }
        ]
    },
    'Download Standalone Interactive App (.html)': {
        title: 'Download Standalone Interactive App',
        badge: 'Offline Export • .html',
        summary: 'Packages the **entire interactive visualizer** and the currently focused lineage dataset into a single self-contained **`.html` file** that runs offline in any browser.',
        examples: [
            { label: 'Full Family Archive', detail: 'Focus on the root ancestor and click to download a complete offline `.html` bundle of all 240+ profiles.' },
            { label: 'Scoped Sub-Branch App', detail: 'Select a specific grandparent first to export an offline interactive app scoped to their ancestral and descendant lineage.' }
        ]
    },
    'Print Tree / Export A4 Landscape SVGs (10pt names)': {
        title: 'Print Tree & A4 Landscape Family Atlas',
        badge: 'Vector Print • 10pt SVG',
        summary: 'Generates a **multi-page A4 landscape printable document** and **Family Atlas** with crisp vector SVG cards, calibrated so every person name renders at a readable **10pt physical font size**.',
        examples: [
            { label: 'Multi-Page Wall Poster', detail: 'Click to open the A4 print preview, print or save as **PDF**, and assemble tiled pages using the margin alignment guides.' },
            { label: 'Branch Atlas Chapters', detail: 'Automatically partitions deep sub-branches into numbered **Atlas Chapters** with cross-page reference badges.' }
        ]
    },
    'View Family Locations Map': {
        title: 'View Family Locations Map',
        badge: 'Geographic View • Leaflet',
        summary: 'Switches the main viewport to an **interactive geographic map** plotting all ancestral villages, parishes, districts, and diaspora cities with **member count pins**.',
        examples: [
            { label: 'Regional Cluster Pins', detail: 'Click to explore family concentrations across **Kerala** (`Thrissur`, `Palakkad`, `Kottayam`), **Karnataka**, and global diaspora hubs.' },
            { label: 'Interactive Pin Filtering', detail: 'Click any marker pin on the map to list all relatives associated with that town in the right-hand sidebar.' }
        ]
    },
    'Switch to Family Tree Diagram': {
        title: 'Switch to Family Tree Diagram',
        badge: 'Tree Canvas • Timeline',
        summary: 'Returns from the geographic map to the **chronological 2D family tree diagram**, preserving your active person focus, filter highlights, and timeline grid.',
        examples: [
            { label: 'Inspect Highlighted Town on Tree', detail: 'Select a town on the map, then click this button to see those residents highlighted across generational cohorts.' },
            { label: 'Seamless View Toggle', detail: 'Switch back and forth between the **Map** and **Tree Diagram** without losing your navigation history.' }
        ]
    },
    'Ask AI': {
        title: 'AI Genealogy Assistant',
        badge: 'Hybrid AI • Gemini + Rules',
        summary: 'Opens the **AI Assistant** to answer natural-language questions about **kinship relationships**, **ancestral towns**, **lifespans**, and **tree statistics** using the deterministic rule engine or **Gemini LLM**.',
        examples: [
            { label: 'Kinship Path Tracing', detail: 'Ask `"How is Eliamma related to Vareeth?"` or `"Who are the children of Joseph and Thankamma?"`' },
            { label: 'Demographic Superlatives', detail: 'Ask `"Who lived the longest?"` or `"Who all lived in Chalissery?"` to highlight matching cards on the canvas.' }
        ]
    },
    'View Logs': {
        title: 'Ingestion & Audit Logs',
        badge: 'Diagnostics • Data Audit',
        summary: 'Opens the **Logs** panel displaying live **parallel sheet crawl status**, **merged duplicate profiles**, **deduced birth/death years**, and **data consistency warnings** with clickable source links.',
        examples: [
            { label: 'Google Sheet Row Citations', detail: 'Click any `[SheetName:Row]` pill in the audit log to jump directly to that row in Google Sheets.' },
            { label: 'Audit Biological & Name Warnings', detail: 'Inspect parent-child age-gap checks, ambiguous parent candidates, and unlinked subtree roots.' }
        ]
    },
    'Search': {
        title: 'Omni Search & Command Bar',
        badge: 'Shortcut • Cmd/Ctrl + K',
        summary: 'Expands the **Omni Search** bar to find **people by name or nickname**, filter by **location, family house, or career**, or send natural-language queries to the **AI Assistant**.',
        examples: [
            { label: 'Quick Person Jump', detail: 'Press `Cmd+K` (or `Ctrl+K`) and type `"Kochuthresia"` or `"Kunjappan"` to center the camera on their card.' },
            { label: 'Attribute Spotlight', detail: 'Type `"Moonilavu"` or `"Teacher"` and press `Enter` to highlight all matching profiles across the tree.' }
        ]
    },
    'Go Back': {
        title: 'Navigate Back in History',
        badge: 'History • Previous View',
        summary: 'Steps backward to the **previously focused person** or **category filter** in your session navigation stack and centers the canvas camera on their card.',
        examples: [
            { label: 'Retrace Ancestor Steps', detail: 'After clicking from a child up to their parents and grandparents, click **Go Back** to return to the child.' },
            { label: 'Restore Directory Filter', detail: 'Step back from an individual profile to the **Location** or **Family** filter list you were browsing earlier.' }
        ]
    },
    'Go Forward': {
        title: 'Navigate Forward in History',
        badge: 'History • Next View',
        summary: 'Steps forward in your **session navigation history** after using **Go Back**, restoring the next focused person or active directory filter.',
        examples: [
            { label: 'Redo Profile Focus', detail: 'Click **Go Forward** to return to the descendant or spouse profile you inspected before stepping back.' },
            { label: 'Compare Distant Branches', detail: 'Alternate between **Go Back** and **Go Forward** to compare two branches across different generations.' }
        ]
    },
    'Zoom In': {
        title: 'Zoom In Canvas',
        badge: 'Camera • Magnify (+)',
        summary: 'Increases **canvas magnification** (`1.3x` per step) around the viewport center to inspect **person cards**, **lifespan recency badges**, and **marital/sibling connectors**.',
        examples: [
            { label: 'Read Detailed Card Badges', detail: 'Click **Zoom In** (or scroll up) to read nicknames, deduced `~YOB` badges, and multi-spouse connectors.' },
            { label: 'Dense Cohort Inspection', detail: 'Magnify large 8+ sibling families to inspect individual birth order and spouse pairings.' }
        ]
    },
    'Zoom Out': {
        title: 'Zoom Out Canvas',
        badge: 'Camera • Overview (−)',
        summary: 'Decreases **canvas magnification** (`1 / 1.3x` per step) to reveal a broader **multi-generational bird’s-eye view** alongside the left-hand **century timeline**.',
        examples: [
            { label: 'Multi-Generation Panorama', detail: 'Click **Zoom Out** to view 6+ generations from the 1850s to the present day in a single viewport.' },
            { label: 'Subtree Structure Comparison', detail: 'Zoom out to see how co-spouse and sibling subtrees pack horizontally without line crossings.' }
        ]
    },
    'Reset to Root Person': {
        title: 'Reset to Root Ancestor',
        badge: 'Camera • Root Home',
        summary: 'Selects the **oldest root ancestor** of the family tree, opens their profile details in the sidebar, and pans the camera to the **top of the lineage**.',
        examples: [
            { label: 'Jump to Founding Patriarch/Matriarch', detail: 'Click after exploring 5th-generation descendants to return immediately to the earliest ancestor.' },
            { label: 'Restore Full Lineage Root', detail: 'Resets any sub-branch rerooting so the complete unified family tree is displayed.' }
        ]
    },
    'Fit to Screen': {
        title: 'Fit Entire Tree to Screen',
        badge: 'Camera • Auto-Frame',
        summary: 'Computes the **bounding box** of all currently visible person nodes, closes open sidebars for full screen width, and adjusts **zoom and pan** to fit the entire diagram.',
        examples: [
            { label: 'Auto-Frame Visible Tree', detail: 'Click **Fit to Screen** after expanding or collapsing branches to center and scale the active diagram.' },
            { label: 'Clean Presentation View', detail: 'Automatically hides side panels and frames all visible generations beside the year timeline.' }
        ]
    },
    'Expand Children': {
        title: 'Expand Descendant Branch',
        badge: 'Tree Node • Expand (+)',
        summary: 'Uncollapses the hidden **children, spouses, and descendants** beneath this person card and smoothly reflows the layout while keeping the clicked card anchored in place.',
        examples: [
            { label: 'Reveal Hidden Descendants', detail: 'Click the **`+`** button on the bottom edge of a card to expand its immediate children and sub-branches.' },
            { label: 'Anchored Camera Reflow', detail: 'The camera automatically compensates for layout shifts so the clicked ancestor stays stationary on screen.' }
        ]
    },
    'Collapse Children': {
        title: 'Collapse Descendant Branch',
        badge: 'Tree Node • Collapse (−)',
        summary: 'Folds all **descendant generations** beneath this person card into a compact collapsed state so you can focus on neighboring sibling or cousin lineages.',
        examples: [
            { label: 'Declutter Wide Branches', detail: 'Click **`−`** beneath an ancestor with 50+ descendants to compact the tree horizontally.' },
            { label: 'Scoped Print Preparation', detail: 'Collapse unneeded branches before clicking **Print Tree** to generate a tailored A4 chart.' }
        ]
    },
    'Close Panel': {
        title: 'Close Sidebar Panel',
        badge: 'Sidebar • Dismiss (✕)',
        summary: 'Closes the right-hand **Person Details**, **Quick Directory**, or **AI Assistant** sidebar and clears active filter highlights on the tree canvas.',
        examples: [
            { label: 'Restore Full Canvas Width', detail: 'Click **`✕`** in the top-right corner of the sidebar to close the panel and view the full diagram.' },
            { label: 'Clear Dimmed Filter Mode', detail: 'Closing an active filter list restores 100% opacity to all person cards on the canvas.' }
        ]
    },
    'Close Log Panel': {
        title: 'Close Ingestion & Audit Logs',
        badge: 'Logs • Dismiss (✕)',
        summary: 'Closes the **Logs** slide-over drawer and restores the floating **Top Navigation** toolbar and bottom-left **Zoom Controls**.',
        examples: [
            { label: 'Return to Interactive Tree', detail: 'Click **`✕`** after inspecting spreadsheet crawl metrics or biological audit warnings.' },
            { label: 'Dismiss Manual Log View', detail: 'Closes the log drawer opened via the **View Logs** toolbar button.' }
        ]
    },
    'Back to All Categories': {
        title: 'Back to Directory Categories',
        badge: 'Directory • All Categories',
        summary: 'Returns from a filtered **Location**, **Career**, or **Family** member list back to the top-level **Quick Directory** tabs (`Locations`, `Careers`, `Families`).',
        examples: [
            { label: 'Browse Another Region or House', detail: 'Click the **`←`** button after viewing `"Chalissery"` residents to pick another town or family surname.' },
            { label: 'Reset Active Filter', detail: 'Clears the active member filter and restores full-tree visibility on the canvas.' }
        ]
    },
    'Open Directory': {
        title: 'Open Quick Directory',
        badge: 'Directory • Category Browser',
        summary: 'Switches the sidebar from an individual **Person Details** card to the **Quick Directory** to browse everyone by **Locations**, **Careers**, or **Families**.',
        examples: [
            { label: 'Drill Down by Geography', detail: 'Click to explore hierarchical region trees (`India → Kerala → Thrissur → Chalissery`).' },
            { label: 'Audit Surnames & Careers', detail: 'Browse alphabetical lists of all family house names and professions with member count badges.' }
        ]
    },
    'Clear Conversation': {
        title: 'Clear AI Conversation History',
        badge: 'AI Chat • Reset',
        summary: 'Clears all chat messages in the **AI Assistant** drawer, removes AI mention badges from canvas cards, and generates fresh **sample genealogy questions**.',
        examples: [
            { label: 'Reset Chat Session', detail: 'Click the trash icon to clear the conversation and start a new genealogy inquiry.' },
            { label: 'Refresh Sample Prompts', detail: 'Generates a new set of clickable example questions tailored to your loaded family tree.' }
        ]
    },
    'Configure Gemini API Key': {
        title: 'Configure AI Engine & Gemini API Key',
        badge: 'AI Settings • Gemini API',
        summary: 'Opens the **AI Studio Settings** drawer to configure your **Gemini API Key**, select the API environment, or run live **connection diagnostics**.',
        examples: [
            { label: 'Save Gemini API Key', detail: 'Paste a Google AI Studio key (`AIza...`) and click **Save** to enable LLM-powered answers.' },
            { label: 'Test Model Connectivity', detail: 'Click **Test API Connection** inside settings to verify available Gemini models and response latency.' }
        ]
    },
    'Submit Query': {
        title: 'Submit Question to AI Assistant',
        badge: 'AI Chat • Send (Enter)',
        summary: 'Sends your natural-language question to the active **AI Engine**, highlights mentioned relatives on the tree diagram, and renders clickable **profile links**.',
        examples: [
            { label: 'Ask Relationship Questions', detail: 'Type `"How is Pauly related to Annamkutty?"` and click **Submit** to trace their kinship path.' },
            { label: 'Query Places & Eras', detail: 'Type `"Who all lived in Palakkad?"` to receive a formatted list and highlight those relatives on the tree.' }
        ]
    },
    'Tree View': {
        title: 'Switch to Family Tree Diagram',
        badge: 'Map Bar • Tree View',
        summary: 'Exits the **Family Locations Map** and returns to the **2D genealogical tree canvas** while preserving your active location or person selection.',
        examples: [
            { label: 'View Town Residents on Tree', detail: 'After clicking a town pin on the map, click **Tree View** to see where those relatives sit in the family tree.' },
            { label: 'Quick Bottom-Bar Switch', detail: 'Provides one-click switching back to the tree diagram directly from the bottom map control bar.' }
        ]
    },
    'Export CSV': {
        title: 'Export Mapped Locations (.csv)',
        badge: 'Map Bar • CSV Download',
        summary: 'Downloads a **CSV file** listing all geocoded ancestral towns and diaspora locations, including **coordinates**, **resident counts**, and **member names**.',
        examples: [
            { label: 'Spreadsheet & GIS Export', detail: 'Click **Export CSV** to save `Family_Locations_Map.csv` for analysis in Google Sheets or GIS tools.' },
            { label: 'Verify Geocoded Places', detail: 'Review exact latitude/longitude coordinates and resident lists for every plotted location.' }
        ]
    },
    'Toggle Directory': {
        title: 'Toggle Location Directory Sidebar',
        badge: 'Map Bar • Directory Panel',
        summary: 'Opens or closes the **Quick Directory** sidebar beside the map so you can browse **Country → State → District → Town** hierarchies and fly the map camera to any place.',
        examples: [
            { label: 'Fly Map to Selected Town', detail: 'Click **Show Directory** and select `"Thrissur"` or `"Moonilavu"` to animate the map directly to that pin.' },
            { label: 'Maximize Map Viewport', detail: 'Click **Hide Directory** to collapse the sidebar and inspect the world map across the full screen.' }
        ]
    }
};

/**
 * Resolves rich documentation for dynamic category filter buttons (`Filter by Family/Location/Career`).
 *
 * @param {string} key - Raw button title or doc key string.
 * @returns {object|null} Documentation entry object or null if not a dynamic filter key.
 *
 * @example
 * const doc = resolveDynamicFilterButtonDoc('Filter by Family: Parathottiyil');
 *
 * @example
 * const locDoc = resolveDynamicFilterButtonDoc('Filter by Location: Chalissery');
 */
function resolveDynamicFilterButtonDoc(key) {
    if (key.startsWith('Filter by Family:')) {
        const val = key.slice('Filter by Family:'.length).trim() || 'Selected Family';
        return {
            title: `Filter by Family: ${val}`, badge: 'Family House • Filter',
            summary: `Highlights all members belonging to the **\`${val}\`** family house (including patrilineally deduced descendants) and lists them in the sidebar.`,
            examples: [
                { label: 'Spotlight House Lineage', detail: `Click to highlight every **${val}** member on the tree canvas and dim unrelated branches.` },
                { label: 'Directory Cross-Reference', detail: 'Opens the filtered member list sorted chronologically by birth cohort and generation.' }
            ]
        };
    }
    if (key.startsWith('Filter by Location:')) {
        const val = key.slice('Filter by Location:'.length).trim() || 'Selected Location';
        return {
            title: `Filter by Location: ${val}`, badge: 'Geography • Filter',
            summary: `Filters the family tree to spotlight everyone residing in or originating from **\`${val}\`**, automatically uncollapsing branches to reveal matches.`,
            examples: [
                { label: 'Highlight Town Residents', detail: `Click to highlight all relatives linked to **${val}** on the tree diagram and list them in the sidebar.` },
                { label: 'View on Family Map', detail: 'Click the **Map** button while this filter is active to fly directly to this location pin.' }
            ]
        };
    }
    if (key.startsWith('Filter by Career:')) {
        const val = key.slice('Filter by Career:'.length).trim() || 'Selected Career';
        return {
            title: `Filter by Career: ${val}`, badge: 'Vocation • Filter',
            summary: `Highlights all family members whose recorded profession, vocation, or religious title matches **\`${val}\`**.`,
            examples: [
                { label: 'Vocation Cohort List', detail: `Click to list every relative with the career **"${val}"** sorted by birth year.` },
                { label: 'Deduced Titles Included', detail: 'Includes both explicit `Job` cells and deduced vocations like `Priest` (`Fr.`) and `Nun` (`Sr.`).' }
            ]
        };
    }
    return null;
}

/**
 * Resolves rich documentation for contextual buttons based on visible button label text.
 *
 * @param {string} text - Normalized visible text inside the button.
 * @returns {object} Documentation entry with title, badge, summary, and examples.
 *
 * @example
 * const tabDoc = resolveContextualButtonDoc('Locations (42)');
 *
 * @example
 * const aiToggleDoc = resolveContextualButtonDoc('Rule');
 */
function resolveContextualButtonDoc(text) {
    if (/^(Show|Hide)\s+Directory$/i.test(text)) return BUTTON_DOCUMENTATION_CATALOG['Toggle Directory'];
    if (/^Locations\s*\(/i.test(text) || /^Careers\s*\(/i.test(text) || /^Families\s*\(/i.test(text)) {
        const tabName = text.split('(')[0].trim();
        return {
            title: `Directory Tab: ${tabName}`, badge: 'Quick Directory • Category Tab',
            summary: `Switches the **Quick Directory** browser to the **\`${tabName}\`** category tab, displaying member counts for each group.`,
            examples: [
                { label: `Browse ${tabName}`, detail: `Click **${text}** to list all ${tabName.toLowerCase()} in the family tree and click any row to filter the canvas.` },
                { label: 'Instant Search Filtering', detail: 'Use the **Omni Search** bar at the top to filter items inside the active directory tab in real time.' }
            ]
        };
    }
    if (/^(AI|Rule)$/i.test(text)) {
        return {
            title: `Switch AI Engine Mode (${text.toUpperCase()})`, badge: 'AI Assistant • Engine Toggle',
            summary: 'Toggles the **AI Assistant** between **`AI` (Gemini LLM)** for open-ended reasoning and **`Rule` (Deterministic Genealogy Engine)** for instant, zero-latency kinship and demographic answers.',
            examples: [
                { label: 'Rule Engine Mode', detail: 'Select **`Rule`** for instant, 100% deterministic answers to relationship, birth/death year, and location queries without an API key.' },
                { label: 'Gemini LLM Mode', detail: 'Select **`AI`** (with a configured Gemini API key) for multi-hop narrative synthesis across the family graph.' }
            ]
        };
    }
    const clean = text ? text.slice(0, 48) : 'Interactive Control';
    return {
        title: `Select / Toggle: ${clean}`, badge: 'Interactive Control • Action',
        summary: `Activates **\`${clean}\`**, updating the **focused profile or filter** in the sidebar and synchronizing the **canvas camera** or **directory tree**.`,
        examples: [
            { label: 'Focus & Synchronize View', detail: `Click **"${clean}"** to navigate directly to the selected person, relative, region, or query.` },
            { label: 'History Tracking', detail: 'Your selection is added to the navigation history stack so you can step back with **Go Back** (`<`).' }
        ]
    };
}

/**
 * Resolves a complete rich-text documentation payload for any button key or label.
 *
 * @param {string} [docKey=''] - Button title attribute or `data-doc-key` identifier.
 * @param {string} [buttonText=''] - Fallback visible text inside the button.
 * @returns {{ title: string, badge: string, summary: string, examples: Array<{ label: string, detail: string }> }}
 *
 * @example
 * const doc = resolveButtonDocumentation('Zoom In', '');
 *
 * @example
 * const filterDoc = resolveButtonDocumentation('Filter by Location: Kerala', 'Kerala');
 */
function resolveButtonDocumentation(docKey = '', buttonText = '') {
    const key = String(docKey || '').trim();
    const text = String(buttonText || '').replace(/\s+/g, ' ').trim();
    if (key && BUTTON_DOCUMENTATION_CATALOG[key]) return BUTTON_DOCUMENTATION_CATALOG[key];
    if (text && BUTTON_DOCUMENTATION_CATALOG[text]) return BUTTON_DOCUMENTATION_CATALOG[text];
    const dynamicDoc = resolveDynamicFilterButtonDoc(key || text);
    if (dynamicDoc) return dynamicDoc;
    return resolveContextualButtonDoc(key || text);
}

/**
 * Parses lightweight markdown tokens (`**bold**` and `` `code` ``) into styled React elements.
 *
 * @param {string} text - Rich-text markdown string.
 * @returns {React.ReactNode} Array of strings and styled `<strong>` / `<code>` elements.
 *
 * @example
 * const nodes = renderRichDocText('Press `Cmd+K` to open **Omni Search**.');
 *
 * @example
 * const plain = renderRichDocText('Simple description text.');
 */
function renderRichDocText(text) {
    if (!text) return null;
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={idx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={idx} className="font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

/**
 * Calculates clamped viewport coordinates (`left`, `top`, `placement`) for the button documentation popover.
 *
 * @param {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} rect - Button bounding rect.
 * @param {number} [viewportW=1280] - Current viewport width in pixels.
 * @param {number} [viewportH=800] - Current viewport height in pixels.
 * @returns {{ left: number, top: number, placement: string }} Clamped popover coordinates.
 *
 * @example
 * const pos = computeButtonDocPosition({ left: 100, top: 20, right: 144, bottom: 64, width: 44, height: 44 }, 1280, 800);
 *
 * @example
 * const bottomPos = computeButtonDocPosition({ left: 24, top: 720, right: 64, bottom: 760, width: 40, height: 40 }, 1280, 800);
 */
function computeButtonDocPosition(rect, viewportW = 1280, viewportH = 800) {
    const cardW = 340, cardH = 248, gap = 10, margin = 12;
    const r = rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const idealLeft = r.left + (r.width / 2) - (cardW / 2);
    const left = Math.max(margin, Math.min(idealLeft, Math.max(margin, viewportW - cardW - margin)));
    const placeBelow = (r.bottom + gap + cardH <= viewportH - margin) || (r.top < cardH + gap);
    const top = placeBelow
        ? Math.min(Math.max(margin, viewportH - cardH - margin), r.bottom + gap)
        : Math.max(margin, r.top - cardH - gap);
    return { left: Math.round(left), top: Math.round(top), placement: placeBelow ? 'bottom' : 'top' };
}

/**
 * Extracts button documentation and suppresses native browser tooltip on the hovered button.
 *
 * @param {HTMLElement|null} btn - Hovered button DOM element.
 * @returns {{ doc: object, pos: { left: number, top: number, placement: string } }|null}
 *
 * @example
 * const payload = buildHoveredButtonDocState(document.querySelector('button'));
 *
 * @example
 * const empty = buildHoveredButtonDocState(null);
 */
function buildHoveredButtonDocState(btn) {
    if (!btn || btn.disabled) return null;
    const nativeTitle = btn.getAttribute('title');
    if (nativeTitle) {
        btn.setAttribute('data-orig-title', nativeTitle);
        btn.removeAttribute('title');
    }
    const rawKey = btn.getAttribute('data-doc-key') || btn.getAttribute('data-orig-title') || '';
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (!rawKey && !text) return null;
    const doc = resolveButtonDocumentation(rawKey, text);
    const rect = typeof btn.getBoundingClientRect === 'function' ? btn.getBoundingClientRect() : null;
    const pos = computeButtonDocPosition(rect, window.innerWidth || 1280, window.innerHeight || 800);
    return { doc, pos };
}

/**
 * Restores the stashed `data-orig-title` attribute back to `title` when hover ends.
 *
 * @param {HTMLElement|null} btn - Button element whose native title should be restored.
 *
 * @example
 * restoreButtonNativeTitle(buttonEl);
 *
 * @example
 * restoreButtonNativeTitle(null);
 */
function restoreButtonNativeTitle(btn) {
    if (!btn || typeof btn.getAttribute !== 'function') return;
    const orig = btn.getAttribute('data-orig-title');
    if (orig && !btn.getAttribute('title')) {
        btn.setAttribute('title', orig);
    }
}

/**
 * Global event hook that tracks button hover interactions and returns the active documentation popover state.
 *
 * @returns {{ doc: object, pos: { left: number, top: number, placement: string } }|null}
 *
 * @example
 * const hoverDoc = useButtonDocHover();
 *
 * @example
 * const state = useButtonDocHover();
 * if (state) console.log(state.doc.title);
 */
function useButtonDocHover() {
    const [hoverState, setHoverState] = useState(null);
    const activeBtnRef = useRef(null);
    useEffect(() => {
        const clearHover = () => { restoreButtonNativeTitle(activeBtnRef.current); activeBtnRef.current = null; setHoverState(null); };
        const onOver = (e) => {
            const btn = e.target && typeof e.target.closest === 'function' ? e.target.closest('button') : null;
            if (!btn || btn.disabled) { if (activeBtnRef.current) clearHover(); return; }
            if (activeBtnRef.current === btn) return;
            restoreButtonNativeTitle(activeBtnRef.current);
            activeBtnRef.current = btn;
            setHoverState(buildHoveredButtonDocState(btn));
        };
        const onOut = (e) => {
            if (activeBtnRef.current && (!e.relatedTarget || !activeBtnRef.current.contains(e.relatedTarget))) clearHover();
        };
        document.addEventListener('pointerover', onOver, true);
        document.addEventListener('pointerout', onOut, true);
        document.addEventListener('pointerdown', clearHover, true);
        window.addEventListener('wheel', clearHover, { passive: true });
        return () => {
            clearHover();
            document.removeEventListener('pointerover', onOver, true);
            document.removeEventListener('pointerout', onOut, true);
            document.removeEventListener('pointerdown', clearHover, true);
            window.removeEventListener('wheel', clearHover);
        };
    }, []);
    return hoverState;
}

/**
 * Floating rich-text documentation popover card rendered when hovering over any application button.
 *
 * @returns {React.ReactNode|null}
 *
 * @example
 * <ButtonDocTooltipOverlay />
 *
 * @example
 * <div className="relative"><ButtonDocTooltipOverlay /></div>
 */
const ButtonDocTooltipOverlay = () => {
    const hoverState = useButtonDocHover();
    if (!hoverState || !hoverState.doc) return null;
    const { doc, pos } = hoverState;
    return (
        <div
            role="tooltip"
            data-testid="button-doc-popover"
            className="fixed z-[9999] w-[340px] bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.18),0_4px_12px_rgba(15,23,42,0.08)] pointer-events-none overflow-hidden font-sans text-left transition-opacity duration-150"
            style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
        >
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
                <div className="text-[12.5px] font-bold text-white truncate">{doc.title}</div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 shrink-0">{doc.badge}</span>
            </div>
            <div className="p-3.5 space-y-2.5">
                <p className="text-[12px] leading-relaxed text-slate-600">{renderRichDocText(doc.summary)}</p>
                {doc.examples && doc.examples.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Usage Examples</div>
                        {doc.examples.map((ex, i) => (
                            <div key={i} className="bg-slate-50/90 border border-slate-200/70 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug text-slate-600">
                                <span className="font-semibold text-indigo-700 mr-1">{ex.label}:</span>
                                {renderRichDocText(ex.detail)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};