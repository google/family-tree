// ============================================================================
// MODULE 6.15: SETTINGS & ACTIONS RADIAL FAB
//
// A floating action button pinned to the bottom-right corner (visible on the home
// screen AND over the tree) that fans out all floating tool & settings actions in a
// quarter-circle arc: Ask AI, Locations Map, Print Tree, Download App, View Logs,
// Colour Theme, Deduction Rules, and Clear Stored Data.
// ============================================================================

/** The actions of the radial menu, in fan order (first = top of arc, last = left of arc). */
const SETTINGS_FAB_ACTIONS = Object.freeze([
    { id: 'ai', label: 'Ask AI', title: 'Ask AI', icon: 'Sparkles', treeOnly: true },
    { id: 'map', label: 'Locations map', title: 'View Family Locations Map', icon: 'MapPin', treeOnly: true },
    { id: 'print', label: 'Print tree', title: 'Print Tree / Export A4 Landscape SVGs (10pt names)', icon: 'Printer', treeOnly: true },
    { id: 'download', label: 'Download app', title: 'Download Standalone Interactive App (.html)', icon: 'Download', treeOnly: true, standaloneHidden: true },
    { id: 'logs', label: 'View logs', title: 'View Logs', icon: 'Log', treeOnly: true, standaloneHidden: true },
    { id: 'theme', label: 'Colour theme', title: 'Colour theme (Material 3 palettes)', icon: 'Palette' },
    { id: 'deduction', label: 'Deduction rules', title: 'Deduction Settings (marriage age by birth cohort)', icon: 'Sliders' },
    { id: 'privacy', label: 'Clear stored data', title: 'Clear stored data (cookies & local storage)', icon: 'Eraser' },
]);

/** Tooltip of the main FAB button (also the key of its documentation card). */
const SETTINGS_FAB_TITLE = 'Settings: theme, deduction rules, stored data';

/** Distance (px) from the FAB centre to each action centre on the inner 3-button arc. */
const SETTINGS_FAB_RADIUS = 84;

/** Distance (px) from the FAB centre to each action centre on the outer arc. */
const SETTINGS_FAB_EXPANDED_RADIUS = 148;

/**
 * Evenly spreads `count` items along an arc and returns their pixel offsets from the hub.
 * Angles follow the maths convention (0° = right, 90° = up) so the default 90°→180° arc fans
 * towards the top-left — right for a hub pinned to the bottom-right corner. Screen `y` grows
 * downwards, hence the negated sine.
 *
 * @param {number} count - Number of items
 * @param {number} [radius=SETTINGS_FAB_RADIUS] - Arc radius in px
 * @param {number} [startDeg=90] - Angle of the first item
 * @param {number} [endDeg=180] - Angle of the last item
 * @returns {Array<{x: number, y: number}>} Offsets, rounded to whole pixels
 *
 * @example
 * computeRadialMenuOffsets(3, 100);
 * // => [{ x: 0, y: -100 }, { x: -71, y: -71 }, { x: -100, y: 0 }]
 *
 * @example
 * computeRadialMenuOffsets(1, 100);
 * // => [{ x: -71, y: -71 }] (a single item sits in the middle of the arc)
 *
 * @example
 * computeRadialMenuOffsets(0);
 * // => []
 */
function computeRadialMenuOffsets(count, radius = SETTINGS_FAB_RADIUS, startDeg = 90, endDeg = 180) {
    const n = Math.max(0, Math.floor(count));
    if (n === 0) return [];
    const offsets = [];
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const angle = (startDeg + (endDeg - startDeg) * t) * Math.PI / 180;
        offsets.push({ x: Math.round(Math.cos(angle) * radius), y: Math.round(-Math.sin(angle) * radius) });
    }
    return offsets;
}

/**
 * Arranges `count` radial items across two concentric quarter-circle arcs (90°→180°):
 * up to 3 buttons sit on the inner arc (`SETTINGS_FAB_RADIUS`) and any remaining buttons
 * fan along the outer arc (`SETTINGS_FAB_EXPANDED_RADIUS`).
 *
 * @param {number} count - Number of visible radial items
 * @returns {Array<{x: number, y: number}>} Offsets from the hub centre
 *
 * @example
 * resolveRadialFabOffsets(3);
 * // => [{ x: 0, y: -84 }, { x: -59, y: -59 }, { x: -84, y: 0 }]
 *
 * @example
 * resolveRadialFabOffsets(8).length;
 * // => 8 (3 on the inner arc + 5 on the outer arc)
 */
function resolveRadialFabOffsets(count) {
    const n = Math.max(0, Math.floor(count));
    if (n <= 3) return computeRadialMenuOffsets(n, SETTINGS_FAB_RADIUS, 90, 180);
    const inner = computeRadialMenuOffsets(3, SETTINGS_FAB_RADIUS, 90, 180);
    const outer = computeRadialMenuOffsets(n - 3, SETTINGS_FAB_EXPANDED_RADIUS, 90, 180);
    return [...inner, ...outer];
}

/**
 * Resolves the visible radial menu actions and their live status (active / busy / disabled)
 * for the current screen state.
 *
 * @param {object} [state={}] - Current application state
 * @returns {Array<object>} Action descriptors ready to render
 *
 * @example
 * resolveRadialFabActions({ isHomeOpen: true }).map(a => a.id);
 * // => ['theme', 'deduction', 'privacy']
 *
 * @example
 * resolveRadialFabActions({ isHomeOpen: false, isStandalone: false, hasTree: true }).map(a => a.id);
 * // => ['ai', 'map', 'print', 'download', 'logs', 'theme', 'deduction', 'privacy']
 */
function resolveRadialFabActions(state = {}) {
    const { isHomeOpen = false, isStandalone = false, hasTree = true, isLoading = false,
        showMap = false, showAI = false, showLogs = false, isAILoading = false,
        isExportingApp = false, isExportingA4 = false } = state;
    return SETTINGS_FAB_ACTIONS.filter((a) => {
        if (isHomeOpen && a.treeOnly) return false;
        if (isStandalone && a.standaloneHidden) return false;
        return true;
    }).map((a) => {
        if (a.id === 'map') {
            return { ...a, isActive: Boolean(showMap), label: showMap ? 'Tree diagram' : 'Locations map',
                title: showMap ? 'Switch to Family Tree Diagram' : 'View Family Locations Map' };
        }
        if (a.id === 'ai') return { ...a, isActive: Boolean(showAI), isBusy: Boolean(isAILoading) };
        if (a.id === 'logs') return { ...a, isActive: Boolean(showLogs) };
        if (a.id === 'print') return { ...a, isBusy: Boolean(isExportingA4), disabled: Boolean(isExportingA4 || isLoading || !hasTree) };
        if (a.id === 'download') return { ...a, isBusy: Boolean(isExportingApp), disabled: Boolean(isExportingApp || isLoading || !hasTree) };
        return a;
    });
}

/**
 * Open/close state of the radial menu: toggled by the hub button, closed by Escape, by the
 * invisible backdrop, or after an action is chosen.
 *
 * @returns {{isOpen: boolean, toggle: Function, close: Function}}
 *
 * @example
 * const { isOpen, toggle, close } = useRadialFabState();
 * <button onClick={toggle} aria-expanded={isOpen} />
 *
 * @example
 * const fab = useRadialFabState();
 * fab.toggle(); fab.isOpen; // => true (after re-render)
 */
function useRadialFabState() {
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback(() => setIsOpen(open => !open), []);
    const close = useCallback(() => setIsOpen(false), []);
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);
    return { isOpen, toggle, close };
}

/**
 * One satellite button of the radial menu. Collapsed into the hub when the menu is closed;
 * slides out along its offset (staggered) when open.
 *
 * @param {object} props
 * @param {{id: string, label: string, title: string, icon: string, isActive?: boolean, isBusy?: boolean, disabled?: boolean}} props.action - Action definition
 * @param {{x: number, y: number}} props.offset - Position relative to the hub centre
 * @param {number} props.index - Position in the fan (drives the stagger delay)
 * @param {number} [props.total=3] - Total number of visible actions
 * @param {boolean} props.isOpen - Whether the menu is expanded
 * @param {Function} props.onSelect - Called with the action id
 * @returns {React.ReactNode}
 *
 * @example
 * <RadialFabAction action={SETTINGS_FAB_ACTIONS[0]} offset={{ x: 0, y: -84 }} index={0} total={3} isOpen={true} onSelect={openSettings} />
 *
 * @example
 * <RadialFabAction action={SETTINGS_FAB_ACTIONS[2]} offset={{ x: -84, y: 0 }} index={2} total={3} isOpen={false} onSelect={() => {}} />
 */
const RadialFabAction = ({ action, offset, index, total = 3, isOpen, onSelect }) => {
    const Icon = action.isBusy ? Icons.Loader : (Icons[action.icon] || Icons.Settings);
    const style = {
        transform: isOpen ? `translate(${offset.x}px, ${offset.y}px) scale(1)` : 'translate(0px, 0px) scale(0.4)',
        transitionDelay: `${isOpen ? index * 30 : Math.max(0, total - 1 - index) * 20}ms`,
    };
    const toneCls = action.isActive
        ? 'border-primary bg-primary-container text-on-primary-container'
        : 'border-outline-variant bg-surface-container-lowest text-primary hover:bg-primary-container';
    return (
        <div className={`absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px] transition-all duration-200 ease-out ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} style={style}>
            <button type="button" role="menuitem" tabIndex={isOpen ? 0 : -1} title={action.title} data-testid={`settings-fab-${action.id}`}
                disabled={Boolean(action.disabled)} onClick={() => onSelect(action.id)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors disabled:opacity-50 ${toneCls}`}>
                <Icon />
            </button>
            {total <= 3 && (
                <span aria-hidden="true" className={`pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-1 text-xs font-semibold text-inverse-on-surface shadow ${index === 0 ? 'top-0 -translate-y-1.5' : 'top-1/2 -translate-y-1/2'}`}>
                    {action.label}
                </span>
            )}
        </div>
    );
};

/**
 * The settings & tools hub: a round primary button whose gear rotates when the quarter-circle
 * menu opens. Always mounted (home screen and tree view alike).
 *
 * @param {object} props
 * @param {Function} props.onSelect - Receives action id ('ai'|'map'|'print'|'download'|'logs'|'theme'|'deduction'|'privacy')
 * @param {boolean} [props.isHomeOpen=false] - Whether the home screen is currently open
 * @param {boolean} [props.isStandalone=false] - Whether running in standalone export mode
 * @param {boolean} [props.hasTree=true] - Whether a tree dataset is loaded
 * @param {boolean} [props.isLoading=false] - Whether a sheet import is in flight
 * @param {boolean} [props.showMap=false] - Whether locations map view is active
 * @param {boolean} [props.showAI=false] - Whether AI assistant drawer is open
 * @param {boolean} [props.showLogs=false] - Whether logs drawer is open
 * @param {boolean} [props.isAILoading=false] - Whether AI assistant is processing
 * @param {boolean} [props.isExportingApp=false] - Whether standalone HTML export is running
 * @param {boolean} [props.isExportingA4=false] - Whether A4 print export is running
 * @returns {React.ReactNode}
 *
 * @example
 * <SettingsRadialFab onSelect={(id) => id === 'privacy' ? clearData() : openSettings(id)} />
 *
 * @example
 * <SettingsRadialFab onSelect={console.log} isHomeOpen={false} hasTree={true} />
 */
const SettingsRadialFab = (props) => {
    const { onSelect } = props;
    const { isOpen, toggle, close } = useRadialFabState();
    const actions = resolveRadialFabActions(props);
    const offsets = resolveRadialFabOffsets(actions.length);
    const select = (id) => { close(); onSelect(id); };
    return (
        <>
            {isOpen && <div className="fixed inset-0 z-[79]" onPointerDown={close} aria-hidden="true" />}
            <div data-testid="settings-fab" className="fixed bottom-6 right-6 z-[80] h-14 w-14" role="menu" aria-label="Settings">
                {actions.map((action, index) => (
                    <RadialFabAction key={action.id} action={action} offset={offsets[index]} index={index} total={actions.length} isOpen={isOpen} onSelect={select} />
                ))}
                <button type="button" onClick={toggle} title={SETTINGS_FAB_TITLE} aria-expanded={isOpen} aria-haspopup="menu" data-testid="settings-fab-toggle"
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl ring-4 ring-primary/15 transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-primary/40">
                    <span className={`block transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}><Icons.Settings /></span>
                </button>
            </div>
        </>
    );
};
