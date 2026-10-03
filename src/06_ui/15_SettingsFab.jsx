// ============================================================================
// MODULE 6.15: SETTINGS RADIAL FAB
//
// A floating action button pinned to the bottom-right corner (visible on the home
// screen AND over the tree) that fans out three actions in a quarter circle:
// colour theme, deduction rules and "clear stored data". It replaces the toolbar
// gear so settings are reachable before any sheet is loaded.
// ============================================================================

/** The actions of the radial menu, in fan order (first = straight up, last = straight left). */
const SETTINGS_FAB_ACTIONS = Object.freeze([
    { id: 'theme', label: 'Colour theme', title: 'Colour theme (Material 3 palettes)', icon: 'Palette' },
    { id: 'deduction', label: 'Deduction rules', title: 'Deduction Settings (marriage age by birth cohort)', icon: 'Sliders' },
    { id: 'privacy', label: 'Clear stored data', title: 'Clear stored data (cookies & local storage)', icon: 'Eraser' },
]);

/** Tooltip of the main FAB button (also the key of its documentation card). */
const SETTINGS_FAB_TITLE = 'Settings: theme, deduction rules, stored data';

/** Distance (px) from the FAB centre to each action centre. */
const SETTINGS_FAB_RADIUS = 84;

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
 * One satellite button of the radial menu with its label chip. Collapsed into the hub when the
 * menu is closed; slides out along its offset (staggered) when open.
 *
 * @param {object} props
 * @param {{id: string, label: string, title: string, icon: string}} props.action - Action definition
 * @param {{x: number, y: number}} props.offset - Position relative to the hub centre
 * @param {number} props.index - Position in the fan (drives the stagger delay)
 * @param {boolean} props.isOpen - Whether the menu is expanded
 * @param {Function} props.onSelect - Called with the action id
 * @returns {React.ReactNode}
 *
 * @example
 * <RadialFabAction action={SETTINGS_FAB_ACTIONS[0]} offset={{ x: 0, y: -84 }} index={0} isOpen={true} onSelect={openSettings} />
 *
 * @example
 * <RadialFabAction action={SETTINGS_FAB_ACTIONS[2]} offset={{ x: -84, y: 0 }} index={2} isOpen={false} onSelect={() => {}} />
 */
const RadialFabAction = ({ action, offset, index, isOpen, onSelect }) => {
    const Icon = Icons[action.icon] || Icons.Settings;
    const style = {
        transform: isOpen ? `translate(${offset.x}px, ${offset.y}px) scale(1)` : 'translate(0px, 0px) scale(0.4)',
        transitionDelay: `${isOpen ? index * 40 : (2 - index) * 30}ms`,
    };
    return (
        <div className={`absolute left-1/2 top-1/2 -ml-6 -mt-6 transition-all duration-200 ease-out ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} style={style}>
            <button type="button" role="menuitem" tabIndex={isOpen ? 0 : -1} title={action.title} data-testid={`settings-fab-${action.id}`}
                onClick={() => onSelect(action.id)}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary shadow-lg transition-colors hover:bg-primary-container">
                <Icon />
            </button>
            <span aria-hidden="true" className={`pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-1 text-xs font-semibold text-inverse-on-surface shadow ${index === 0 ? 'top-0 -translate-y-1.5' : 'top-1/2 -translate-y-1/2'}`}>
                {action.label}
            </span>
        </div>
    );
};

/**
 * The settings hub: a round primary button whose gear rotates when the quarter-circle menu
 * opens. Always mounted (home screen and tree view alike).
 *
 * @param {object} props
 * @param {Function} props.onSelect - Receives 'theme' | 'deduction' | 'privacy'
 * @returns {React.ReactNode}
 *
 * @example
 * <SettingsRadialFab onSelect={(id) => id === 'privacy' ? clearData() : openSettings(id)} />
 *
 * @example
 * <SettingsRadialFab onSelect={console.log} />
 */
const SettingsRadialFab = ({ onSelect }) => {
    const { isOpen, toggle, close } = useRadialFabState();
    const offsets = computeRadialMenuOffsets(SETTINGS_FAB_ACTIONS.length);
    const select = (id) => { close(); onSelect(id); };
    return (
        <>
            {isOpen && <div className="fixed inset-0 z-[79]" onPointerDown={close} aria-hidden="true" />}
            <div data-testid="settings-fab" className="fixed bottom-6 right-6 z-[80] h-14 w-14" role="menu" aria-label="Settings">
                {SETTINGS_FAB_ACTIONS.map((action, index) => (
                    <RadialFabAction key={action.id} action={action} offset={offsets[index]} index={index} isOpen={isOpen} onSelect={select} />
                ))}
                <button type="button" onClick={toggle} title={SETTINGS_FAB_TITLE} aria-expanded={isOpen} aria-haspopup="menu" data-testid="settings-fab-toggle"
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl ring-4 ring-primary/15 transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-primary/40">
                    <span className={`block transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}><Icons.Settings /></span>
                </button>
            </div>
        </>
    );
};
