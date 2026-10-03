// ============================================================================
// MODULE 7: MAIN APP COMPONENT
/**
 * Main application component for the interactive Family Tree visualizer.
 * Coordinates top navigation, canvas zoom/pan viewport, sidebar details, directory search,
 * AI genealogy assistant, family map view, and multi-format export utilities.
 *
 * @returns {React.ReactElement} The root application element.
 *
 * @example
 *   <App />
 *
 * @example
 *   const root = ReactDOM.createRoot(document.getElementById('root'));
 *   root.render(<App />);
 */
/**
 * Manages the active Material 3 colour theme and applies its CSS custom properties
 * to the document root on mount and whenever changed.
 *
 * @returns {{themeId: string, setThemeId: Function, changeTheme: Function}}
 *
 * @example
 * const { themeId, changeTheme } = useColorTheme();
 * changeTheme('midnight');
 *
 * @example
 * const theme = useColorTheme();
 * console.log(theme.themeId); // => 'classic'
 */
function useColorTheme() {
    const [themeId, setThemeId] = useState(() => applyStoredColorTheme().id);
    const changeTheme = useCallback((nextId) => {
        const resolved = applyColorTheme(nextId);
        saveColorThemeId(resolved.id);
        setThemeId(resolved.id);
    }, []);
    return { themeId, setThemeId, changeTheme };
}

/**
 * Visibility of the two app-shell overlays: the home screen (sheet chooser) and the
 * settings panel (Appearance + Deduction rules). The home screen opens on startup unless
 * the page URL already names a sheet (`?id=`) or the app runs as a standalone export.
 *
 * @param {boolean} isStandalone - Whether running inside an exported standalone file
 * @returns {{isHomeOpen: boolean, setIsHomeOpen: Function, isSettingsOpen: boolean, setIsSettingsOpen: Function, settingsTab: string, setSettingsTab: Function, openSettings: Function}}
 *
 * @example
 * const { isHomeOpen, openSettings } = useAppShellPanels(false);
 * openSettings('theme');
 *
 * @example
 * const shell = useAppShellPanels(true); // standalone export
 * shell.isHomeOpen; // => false
 */
function useAppShellPanels(isStandalone) {
    const [isHomeOpen, setIsHomeOpen] = useState(() => !isStandalone && !hasInitialSheetToLoad());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState('theme');
    const openSettings = useCallback((tab = 'theme') => {
        setSettingsTab(tab);
        setIsSettingsOpen(true);
    }, []);
    return { isHomeOpen, setIsHomeOpen, isSettingsOpen, setIsSettingsOpen, settingsTab, setSettingsTab, openSettings };
}

/**
 * Bundles top-level application state including dataset records, navigation history,
 * panel visibility, shell overlays (home screen, settings, theme), and sidebar sizing.
 *
 * @returns {object} Core application state and updater functions.
 *
 * @example
 * const core = useAppCoreState();
 * console.log(core.tree, core.focusId);
 *
 * @example
 * const { isStandalone, isLoading, treeStats, isHomeOpen } = useAppCoreState();
 */
function useAppCoreState() {
    const isStandalone = isStandaloneExportMode();
    // Install the user's cookie-stored deduction settings BEFORE any tree is built.
    useState(() => applyStoredDemographicSettings());
    const theme = useColorTheme();
    const data = useAncestryData();
    const nav = useTreeNavigationHistory(data.focusId);
    const panels = useAppPanels(data.isLoading);
    const sidebar = useSidebarResize(360);
    const shell = useAppShellPanels(isStandalone);
    const treeStats = useMemo(() => data.tree.getStats(), [data.tree]);
    const [sheetUrl, setSheetUrl] = useState(() => (hasInitialSheetToLoad() ? resolveInitialSheetUrl() : ''));
    return { isStandalone, ...theme, ...data, ...nav, ...panels, ...sidebar, ...shell, treeStats, sheetUrl, setSheetUrl };
}

/**
 * Bundles viewport search state, camera manager, AI coordinator, and canvas metrics.
 *
 * @param {object} params
 * @param {FamilyTree} params.tree - Family tree domain model
 * @param {string|null} params.focusId - Focused person ID
 * @param {object} params.treeStats - Tree statistics
 * @param {boolean} params.isAnySidebarOpen - Whether any sidebar is currently open
 * @param {number} params.sidebarWidth - Pixel width of active sidebar
 * @param {Function} params.closeAllPanels - Callback to close all open sidebars
 * @param {Function} params.openAiPanel - Callback to open AI panel
 * @param {Function} params.setShowMap - Map visibility toggle
 * @param {Function} params.setTree - Tree model setter
 * @returns {object} Viewport, search, AI, and canvas metric state.
 *
 * @example
 * const viewport = useAppViewportState({
 *   tree, focusId, treeStats, isAnySidebarOpen: false, sidebarWidth: 360,
 *   closeAllPanels: () => {}, openAiPanel: () => {}, setShowMap: () => {}, setTree: () => {}
 * });
 *
 * @example
 * const { camera, setCamera, isDragging } = useAppViewportState(params);
 */
function useAppViewportState({ tree, focusId, treeStats, isAnySidebarOpen, sidebarWidth, closeAllPanels, openAiPanel, setShowMap, setTree }) {
    const search = useTreeSearchState(openAiPanel);
    const viewport = useAppCanvasViewportManager({
        closeAllPanels, treeStats, isAnySidebarOpen, sidebarWidth, rootId: tree.rootId, focusId
    });
    const ai = useAppAiCoordinator({
        tree, setTree, setShowMap, setCollapsedNodes: viewport.setCollapsedNodes, framePeople: viewport.framePeople
    });
    const metrics = useTreeCanvasMetrics({
        tree, collapsedNodes: viewport.collapsedNodes, camera: viewport.camera, getPpy: viewport.getPpy, treeStats
    });
    return { ...search, ...viewport, ...ai, ...metrics };
}

/**
 * Hook providing memoized person focus dispatcher and registering global focus event listeners.
 *
 * @param {object} params
 * @param {string|null} params.focusId - Currently focused person identifier.
 * @param {Function} params.setFocusId - State setter for focus person identifier.
 * @param {object|null} params.activeFilter - Active filter state.
 * @param {Function} params.setActiveFilter - State setter for active filter.
 * @param {Function} params.setIsSidebarVisible - State setter for sidebar visibility.
 * @param {Function} params.openPersonPanel - Callback to display person details sidebar.
 * @param {Function} params.pushPersonHistory - History stack pusher for person navigation.
 * @param {FamilyTree} params.tree - FamilyTree data model.
 * @param {Function} params.setTree - State setter for FamilyTree.
 * @param {Array<object>} params.visibleNodes - Array of currently rendered layout nodes.
 * @param {Function} params.clearAnchorRequest - Callback to clear pending anchor requests.
 * @param {Function} params.setCollapsedNodes - State setter for collapsed node states.
 * @param {Function} params.clearAiHighlights - Callback to clear AI mention highlights.
 * @param {Function} params.centerOnPerson - Callback to pan camera to focus person.
 * @returns {Function} Memoized handleSetFocusId callback.
 *
 * @example
 * const handleSetFocusId = useAppFocusHandlers({ focusId: null, setFocusId: () => {}, centerOnPerson: () => {} });
 *
 * @example
 * const handleSetFocusId = useAppFocusHandlers(params);
 * handleSetFocusId('p123');
 */
function useAppFocusHandlers({
    focusId, setFocusId, activeFilter, setActiveFilter, setIsSidebarVisible,
    openPersonPanel, pushPersonHistory, tree, setTree, visibleNodes,
    clearAnchorRequest, setCollapsedNodes, clearAiHighlights, centerOnPerson
}) {
    const handleSetFocusId = usePersonFocusHandler({
        focusId, setFocusId, activeFilter, setActiveFilter, setIsSidebarVisible,
        openPersonPanel, pushPersonHistory, tree, setTree, visibleNodes,
        clearAnchorRequest, setCollapsedNodes, clearAiHighlights, centerOnPerson
    });

    useGlobalFocusPersonListener(useCallback((personId) => {
        handleSetFocusId(personId);
        centerOnPerson(personId);
    }, [handleSetFocusId, centerOnPerson]));

    return handleSetFocusId;
}

/**
 * Bundles person focus handlers, global focus listeners, navigation actions,
 * auto-fit adjustments, and sheet import workflows.
 *
 * @param {object} params
 * @returns {object} Focus, navigation, and import callbacks.
 *
 * @example
 * const { handleSetFocusId, handleFilterBy, handleImport } = useAppFocusAndNavigation(params);
 *
 * @example
 * const nav = useAppFocusAndNavigation({ focusId, setFocusId, activeFilter, setActiveFilter, ...rest });
 */
function useAppFocusAndNavigation(params) {
    const handleSetFocusId = useAppFocusHandlers(params);
    const navActions = useTreeNavigationActions({
        setActiveFilter: params.setActiveFilter, setFocusId: params.setFocusId,
        openFilterPanel: params.openFilterPanel, pushFilterHistory: params.pushFilterHistory,
        stepHistory: params.stepHistory, handleSetFocusId
    });
    const { resetInitialFit } = useTreeAutoFit({
        treeRef: params.treeRef, rootId: params.tree.rootId, collapsedCount: params.collapsedCount,
        focusId: params.focusId, onFitToScreen: params.handleFitToScreen, onCenterPerson: params.centerOnPerson
    });
    const handleImport = useTreeImportHandler({
        setSheetUrl: params.setSheetUrl, resetInitialFit, setShowLogs: params.setShowLogs,
        setShowAI: params.setShowAI, setActiveFilter: params.setActiveFilter,
        resetNavHistory: params.resetNavHistory, fetchFromUrl: params.fetchFromUrl,
        setFocusId: params.setFocusId, setIsSidebarVisible: params.setIsSidebarVisible,
        centerOnPerson: params.centerOnPerson, setIsHomeOpen: params.setIsHomeOpen
    });
    return { handleSetFocusId, ...navActions, handleImport };
}

/**
 * Bundles layout node configurations, export handlers, live sync synchronization,
 * and dataset bootstrap loader.
 *
 * @param {object} params
 * @returns {object} Layout configuration and export handlers.
 *
 * @example
 * const { layoutConfig, handleExportImage, handleExportA4Print } = useAppLayoutAndExports(params);
 *
 * @example
 * const layoutExp = useAppLayoutAndExports({ tree, activeFilter, focusId, ...rest });
 */
function useAppLayoutAndExports(params) {
    const layoutConfig = useTreeLayoutConfig({
        tree: params.tree, activeFilter: params.activeFilter, focusId: params.focusId,
        aiHighlightedIds: params.aiHighlightedIds, rootNodeYob: params.treeStats.rootNodeYob,
        visibleNodes: params.visibleNodes, collapsedNodes: params.collapsedNodes,
        toggleCollapse: params.toggleCollapse, ppy: params.ppy, siblingGap: params.siblingGap,
        handleSetFocusId: params.handleSetFocusId
    });

    const exports = useTreeExportHandlers({
        tree: params.tree, sheetUrl: params.sheetUrl, containerRef: params.containerRef,
        focusId: params.focusId, layoutConfig, appendLog: params.appendLog, setErrorMsg: params.setErrorMsg
    });

    useLiveSync({
        tree: params.tree, setTree: params.setTree, focusId: params.focusId, setFocusId: params.setFocusId,
        layoutConfig, camera: params.camera, setCamera: params.setCamera, containerRef: params.containerRef,
        getPpy: params.getPpy, siblingGap: params.siblingGap, setIsShifting: params.setIsShifting,
        sheetUrl: params.sheetUrl, isLoading: params.isLoading, fetchFromUrl: params.fetchFromUrl
    });

    useTreeDatasetBootstrap({
        setTree: params.setTree, setSheetUrl: params.setSheetUrl, setFocusId: params.setFocusId,
        setIsSidebarVisible: params.setIsSidebarVisible, centerOnPerson: params.centerOnPerson,
        appendLog: params.appendLog, handleImport: params.handleImport
    });

    return { layoutConfig, ...exports };
}

/**
 * Formats properties for the TopNavigation component from application state slices.
 *
 * @param {object} core - Core state slice
 * @param {object} viewport - Viewport state slice
 * @param {object} focusNav - Focus and navigation handlers
 * @param {object} layoutExp - Layout and export handlers
 * @returns {object} TopNavigation props object.
 *
 * @example
 * const topNavProps = buildTopNavProps(core, viewport, focusNav, layoutExp);
 *
 * @example
 * <TopNavigation {...buildTopNavProps(core, viewport, focusNav, layoutExp)} />
 */
function buildTopNavProps(core, viewport, focusNav, layoutExp) {
    return {
        tree: core.tree, isSidebarVisible: core.isAnySidebarOpen, sidebarWidth: core.sidebarWidth,
        isResizing: core.isResizingSidebar, sheetUrl: core.sheetUrl, setSheetUrl: core.setSheetUrl,
        isLoading: core.isLoading, searchQuery: viewport.searchQuery,
        setSearchQuery: viewport.setSearchQuery, handleSetFocusId: focusNav.handleSetFocusId,
        onFilterBy: focusNav.handleFilterBy, activeFilter: core.activeFilter, showLogs: core.showLogs,
        setShowLogs: core.setShowLogs, errorMsg: core.errorMsg, setErrorMsg: core.setErrorMsg,
        showAI: core.showAI, setShowAI: core.setShowAI, canGoBack: core.historyPointer > 0,
        canGoForward: core.historyPointer < core.navHistory.length - 1, onGoBack: focusNav.handleGoBack,
        onGoForward: focusNav.handleGoForward, isAILoading: viewport.isAILoading,
        handleExportImage: layoutExp.handleExportImage, isExporting: layoutExp.isExporting,
        handleExportStandaloneApp: layoutExp.handleExportStandaloneApp, isExportingApp: layoutExp.isExportingApp,
        handleExportA4Print: layoutExp.handleExportA4Print, isExportingA4: layoutExp.isExportingA4,
        showMap: core.showMap, setShowMap: core.setShowMap, onAiSubmitQuery: viewport.handleAiSubmitQuery,
        omniSelectedIndex: viewport.omniSelectedIndex, setOmniSelectedIndex: viewport.setOmniSelectedIndex
    };
}

/**
 * Formats properties for the MainCanvasViewport component from application state slices.
 *
 * @param {object} core - Core state slice
 * @param {object} viewport - Viewport state slice
 * @param {object} focusNav - Focus and navigation handlers
 * @param {object} layoutExp - Layout and export handlers
 * @returns {object} MainCanvasViewport props object.
 *
 * @example
 * const viewportProps = buildViewportProps(core, viewport, focusNav, layoutExp);
 *
 * @example
 * <MainCanvasViewport {...buildViewportProps(core, viewport, focusNav, layoutExp)} />
 */
function buildViewportProps(core, viewport, focusNav, layoutExp) {
    return {
        containerRef: viewport.containerRef, showMap: core.showMap, isDragging: viewport.isDragging,
        handlePointerDown: viewport.handlePointerDown, handlePointerMove: viewport.handlePointerMove,
        handlePointerUp: viewport.handlePointerUp, handleWheel: viewport.handleWheel, tree: core.tree,
        activeFilter: core.activeFilter, handleFilterBy: focusNav.handleFilterBy,
        handleExportMapCSV: layoutExp.handleExportMapCSV, setShowMap: core.setShowMap,
        sidebarWidth: core.sidebarWidth, isAnySidebarOpen: core.isAnySidebarOpen,
        isStandalone: core.isStandalone, dynamicYears: viewport.dynamicYears, treeStats: core.treeStats,
        camera: viewport.camera, ppy: viewport.ppy, isShifting: viewport.isShifting,
        treeRef: viewport.treeRef, layoutConfig: layoutExp.layoutConfig, isLoading: core.isLoading
    };
}

/**
 * Formats properties for the PersonSidebar component from application state slices.
 *
 * @param {object} core - Core state slice
 * @param {object} viewport - Viewport state slice
 * @param {object} focusNav - Focus and navigation handlers
 * @returns {object} PersonSidebar props object.
 *
 * @example
 * const sidebarProps = buildSidebarProps(core, viewport, focusNav);
 *
 * @example
 * <PersonSidebar {...buildSidebarProps(core, viewport, focusNav)} />
 */
function buildSidebarProps(core, viewport, focusNav) {
    return {
        focusPerson: core.tree.get(core.focusId), activeFilter: core.activeFilter,
        onFilterBy: focusNav.handleFilterBy, sidebarWidth: core.sidebarWidth,
        onResizeStart: core.handleResizeStart, isResizing: core.isResizingSidebar,
        tree: core.tree, setFocusId: focusNav.handleSetFocusId, isVisible: core.isAnySidebarOpen,
        centerOnPerson: viewport.centerOnPerson, showLogs: core.showLogs, setShowLogs: core.setShowLogs,
        logs: core.logs, isLoading: core.isLoading, showAI: core.showAI, setShowAI: core.setShowAI,
        isAILoading: viewport.isAILoading, setIsAILoading: viewport.setIsAILoading,
        onAiProfilesResponded: viewport.handleAiProfilesResponded, pendingAiQuery: viewport.pendingAiQuery,
        setPendingAiQuery: viewport.setPendingAiQuery, showMap: core.showMap, setShowMap: core.setShowMap,
        omniSelectedIndex: viewport.omniSelectedIndex, setOmniSelectedIndex: viewport.setOmniSelectedIndex
    };
}

/**
 * Formats properties for the ZoomControls component from application state slices.
 *
 * @param {object} core - Core state slice
 * @param {object} viewport - Viewport state slice
 * @returns {object} ZoomControls props object.
 *
 * @example
 * const zoomProps = buildZoomProps(core, viewport);
 *
 * @example
 * <ZoomControls {...buildZoomProps(core, viewport)} />
 */
function buildZoomProps(core, viewport) {
    return {
        setCamera: viewport.setCamera, clampCamera: viewport.clampCamera, centerOnPerson: viewport.centerOnPerson,
        fitToScreen: viewport.handleFitToScreen, focusId: core.focusId, rootId: core.tree.rootId,
        setIsSidebarVisible: core.setIsSidebarVisible, closeAllPanels: core.closeAllPanels
    };
}

/**
 * Dispatches an action chosen from the bottom-right radial menu (`SettingsRadialFab`).
 *
 * @param {string} actionId - Chosen action id ('ai'|'map'|'print'|'download'|'logs'|'theme'|'deduction'|'privacy')
 * @param {object} ctx - Dispatch context (`core`, `layoutExp`, `clearAllStoredData`)
 *
 * @example
 * dispatchRadialFabAction('theme', { core, layoutExp, clearAllStoredData });
 *
 * @example
 * dispatchRadialFabAction('ai', { core, layoutExp, clearAllStoredData });
 */
function dispatchRadialFabAction(actionId, { core, layoutExp, clearAllStoredData }) {
    if (actionId === 'privacy') {
        if (typeof window === 'undefined' || window.confirm('Clear remembered Google Sheets, deduction settings and colour theme from this browser?')) {
            clearAllStoredData();
        }
        return;
    }
    if (actionId === 'ai') {
        const nextAI = !core.showAI;
        core.setShowAI(nextAI);
        if (nextAI) core.setShowLogs(false);
        return;
    }
    if (actionId === 'map') {
        const nextMap = !core.showMap;
        core.setShowMap(nextMap);
        if (nextMap) {
            core.setIsSidebarVisible(true);
            core.setActiveFilter(null);
            core.setFocusId(null);
        }
        return;
    }
    if (actionId === 'print') { layoutExp.handleExportA4Print(); return; }
    if (actionId === 'download') { layoutExp.handleExportStandaloneApp(); return; }
    if (actionId === 'logs') {
        const nextLogs = !core.showLogs;
        core.setShowLogs(nextLogs);
        if (nextLogs) core.setShowAI(false);
        return;
    }
    core.openSettings(actionId);
}

/**
 * Formats properties for the app-shell overlays: the Home emblem button, the sheet-chooser
 * home screen, the radial settings FAB, and the tabbed settings panel.
 *
 * @param {object} core - Core state slice
 * @param {object} viewport - Viewport state slice
 * @param {object} focusNav - Focus and navigation handlers (provides handleImport)
 * @param {object} layoutExp - Layout and export handlers
 * @param {Function} applyDemographicSettingsDraft - Settings-panel Apply handler
 * @returns {object} Props for AppRootView's shell overlays.
 *
 * @example
 * const shellProps = buildShellProps(core, viewport, focusNav, layoutExp, applyDraft);
 * <SheetSourceHomeScreen {...shellProps.homeScreenProps} />
 *
 * @example
 * const { homeButtonProps, settingsPanelProps, settingsFabProps } = buildShellProps(core, viewport, focusNav, layoutExp, applyDraft);
 */
function buildShellProps(core, viewport, focusNav, layoutExp, applyDemographicSettingsDraft) {
    const openSheet = (url) => {
        core.setIsHomeOpen(false);
        focusNav.handleImport(url);
    };
    const clearAllStoredData = () => {
        clearStoredPreferences();
        core.setThemeId(DEFAULT_COLOR_THEME_ID);
    };
    return {
        isHomeOpen: core.isHomeOpen,
        homeButtonProps: { onClick: () => core.setIsHomeOpen(true) },
        homeScreenProps: {
            isOpen: core.isHomeOpen, hasTree: Boolean(core.tree.rootId), isLoading: core.isLoading,
            errorMsg: core.errorMsg, onSubmit: openSheet, onClose: () => core.setIsHomeOpen(false),
            onClearStoredData: clearAllStoredData
        },
        settingsFabProps: {
            onSelect: (actionId) => dispatchRadialFabAction(actionId, { core, layoutExp, clearAllStoredData }),
            isHomeOpen: core.isHomeOpen, isStandalone: core.isStandalone, hasTree: Boolean(core.tree?.root),
            isLoading: core.isLoading, showMap: core.showMap, showAI: core.showAI, showLogs: core.showLogs,
            isAILoading: viewport.isAILoading, isExportingApp: layoutExp.isExportingApp, isExportingA4: layoutExp.isExportingA4
        },
        settingsPanelProps: {
            isOpen: core.isSettingsOpen, initialTab: core.settingsTab,
            onClose: () => core.setIsSettingsOpen(false),
            onApplyDeduction: applyDemographicSettingsDraft,
            themeId: core.themeId, onThemeChange: core.changeTheme
        }
    };
}

/**
 * Master hook that coordinates domain hooks and returns complete visual props for the root view.
 *
 * @returns {object} Object containing topNavProps, zoomProps, viewportProps, sidebarProps, shellProps, and showZoom.
 *
 * @example
 * const { topNavProps, viewportProps } = useAppViewModel();
 *
 * @example
 * const viewProps = useAppViewModel();
 * return <AppRootView {...viewProps} />;
 */
function useAppViewModel() {
    const core = useAppCoreState();
    const viewport = useAppViewportState({
        tree: core.tree, focusId: core.focusId, treeStats: core.treeStats,
        isAnySidebarOpen: core.isAnySidebarOpen, sidebarWidth: core.sidebarWidth,
        closeAllPanels: core.closeAllPanels, openAiPanel: core.openAiPanel,
        setShowMap: core.setShowMap, setTree: core.setTree
    });
    const focusNav = useAppFocusAndNavigation({
        ...core, ...viewport, collapsedCount: viewport.collapsedNodes.size
    });
    const layoutExp = useAppLayoutAndExports({
        ...core, ...viewport, ...focusNav
    });
    useUrlViewStateSync({ ...core, ...viewport, ...focusNav });
    const applyDemographicSettingsDraft = useDemographicSettingsApply({
        sheetUrl: core.sheetUrl, setTree: core.setTree, appendLog: core.appendLog,
        fetchFromUrl: core.fetchFromUrl, setIsSettingsOpen: core.setIsSettingsOpen
    });

    return {
        showZoom: !core.showMap && !core.showLogs && !core.isLoading,
        topNavProps: buildTopNavProps(core, viewport, focusNav, layoutExp),
        zoomProps: buildZoomProps(core, viewport),
        viewportProps: buildViewportProps(core, viewport, focusNav, layoutExp),
        sidebarProps: buildSidebarProps(core, viewport, focusNav),
        shellProps: buildShellProps(core, viewport, focusNav, layoutExp, applyDemographicSettingsDraft)
    };
}

/**
 * Main application visual layout shell containing top navigation, zoom controls,
 * main canvas viewport, collateral sidebar panels, and the shell overlays
 * (Home emblem button, sheet-chooser home screen, radial settings FAB, and settings panel).
 *
 * @param {object} props
 * @param {object} props.topNavProps - Props for TopNavigation component
 * @param {object} props.zoomProps - Props for ZoomControls component
 * @param {object} props.viewportProps - Props for MainCanvasViewport component
 * @param {object} props.sidebarProps - Props for PersonSidebar component
 * @param {object} props.shellProps - Props for the home button, home screen, radial FAB and settings panel
 * @param {boolean} props.showZoom - Whether zoom controls should be displayed
 * @returns {React.ReactNode}
 *
 * @example
 * <AppRootView
 *   topNavProps={{}}
 *   zoomProps={{}}
 *   viewportProps={{}}
 *   sidebarProps={{}}
 *   shellProps={{ isHomeOpen: false, homeButtonProps: {}, homeScreenProps: {}, settingsFabProps: {}, settingsPanelProps: {} }}
 *   showZoom={true}
 * />
 *
 * @example
 * <AppRootView
 *   topNavProps={{ isLoading: true }}
 *   zoomProps={{}}
 *   viewportProps={{}}
 *   sidebarProps={{}}
 *   shellProps={{ isHomeOpen: true, homeButtonProps: {}, homeScreenProps: { isOpen: true }, settingsFabProps: {}, settingsPanelProps: {} }}
 *   showZoom={false}
 * />
 */
const AppRootView = ({ topNavProps, zoomProps, viewportProps, sidebarProps, shellProps, showZoom }) => (
    <div className="flex h-screen w-screen bg-white overflow-hidden text-slate-800 relative" style={{ fontFamily: '"Google Sans", system-ui, -apple-system, sans-serif' }}>
        <GlobalAppStyles />
        <ButtonDocTooltipOverlay />
        <TopNavigation {...topNavProps} />
        {!shellProps.isHomeOpen && <HomeButton {...shellProps.homeButtonProps} />}
        {showZoom && <ZoomControls {...zoomProps} />}
        <MainCanvasViewport {...viewportProps} />
        <PersonSidebar {...sidebarProps} />
        <AppSettingsPanel {...shellProps.settingsPanelProps} />
        <SheetSourceHomeScreen {...shellProps.homeScreenProps} />
        <SettingsRadialFab {...shellProps.settingsFabProps} />
    </div>
);

/**
 * Root component of the Interactive Family Tree application.
 *
 * @returns {React.ReactNode} The mounted family tree application view.
 *
 * @example
 * <App />
 *
 * @example
 * ReactDOM.createRoot(document.getElementById('root')).render(<App />);
 */
export default function App() {
    const viewProps = useAppViewModel();
    return <AppRootView {...viewProps} />;
}
