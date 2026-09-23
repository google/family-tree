
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
 * Renders the brand title logo badge in the top navigation header.
 *
 * @returns {React.ReactNode}
 *
 * @example
 * <TopNavigationBrandTitle />
 *
 * @example
 * {!isStandalone && <TopNavigationBrandTitle />}
 */
const TopNavigationBrandTitle = () => (
    <div className="flex items-center justify-center gap-2 bg-white/80 backdrop-blur-xl px-3.5 rounded-xl shadow-[0_0_24px_rgba(0,0,0,0.18),0_0_8px_rgba(0,0,0,0.10)] border border-white/90 shrink-0 h-[38px]">
        <svg viewBox="0 0 64 64" className="w-[22px] h-[22px] shrink-0 drop-shadow-sm" aria-hidden="true">
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
        <h1 className="text-[17px] leading-none tracking-wide font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 via-indigo-600/80 to-purple-600/80 opacity-80" style={{ fontFamily: "'Uncial Antiqua', serif" }}>Family Tree</h1>
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
 * Main navigation row containing optional brand title and right-side interactive toolbars.
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
                    <TopNavigationBrandTitle />
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