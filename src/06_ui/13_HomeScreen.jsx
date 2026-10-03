// ============================================================================
// MODULE 6.13: HOME SCREEN — pick the Google Sheet to visualize
//
// The app no longer hard-codes a spreadsheet. On first visit (or after the Home
// button) this full-screen overlay asks for a Google Sheets link or ID. The box is
// PREFILLED (clipboard → most-used sheet → demo) but nothing loads until the user
// presses Enter or clicks Open. Every sheet ever opened is remembered in a cookie
// (see 05_hooks/00_BrowserPreferences.jsx) and offered in a dropdown.
// ============================================================================

/** One-line hint under the textbox, keyed by where the current input value came from. */
const HOME_PREFILL_HINTS = Object.freeze({
    clipboard: 'Copied from your copy-paste buffer — press Enter or click Open to load this Google Sheet.',
    empty: 'Paste a Google Sheets link or spreadsheet ID above (shared as "Anyone with the link can view"), or pick a sheet below.',
    manual: 'Press Enter or click Open to load this Google Sheet.',
});

/**
 * Tries to prefill from the clipboard now, again when the window gains focus (Chrome rejects
 * `readText()` while the document is unfocused), and once on the first pointer interaction.
 * Returns a disposer; after disposal no prefill is applied.
 *
 * @param {Function} applyPrefill - Receives `{ id, url }` when the clipboard holds a sheet reference
 * @returns {Function} Cleanup that detaches the listeners
 *
 * @example
 * const dispose = attachClipboardPrefill(ref => setValue(ref.url));
 * // later, when the home screen closes:
 * dispose();
 *
 * @example
 * useEffect(() => attachClipboardPrefill(applyPrefill), [isOpen]);
 */
function attachClipboardPrefill(applyPrefill) {
    let disposed = false;
    const attempt = async () => {
        const ref = await readClipboardSheetReference();
        if (!disposed && ref) applyPrefill(ref);
    };
    attempt();
    if (typeof window === 'undefined') return () => { disposed = true; };
    window.addEventListener('focus', attempt);
    window.addEventListener('pointerdown', attempt, { once: true });
    return () => {
        disposed = true;
        window.removeEventListener('focus', attempt);
        window.removeEventListener('pointerdown', attempt);
    };
}

/**
 * State of the home-screen form: textbox value (empty unless prefilled from clipboard),
 * where its value came from, persisted sheet history, and validation error. Re-checks
 * clipboard each time the screen opens, without overwriting text the user has typed.
 *
 * @param {boolean} isOpen - Whether the home screen is showing
 * @returns {{value: string, setValue: Function, updateInputValue: Function, prefillSource: string,
 *   history: Array, error: string, validate: Function, forget: Function, resetHistory: Function, markTouched: Function}}
 *
 * @example
 * const form = useSheetSourceForm(true);
 * form.value; // => '' (unless clipboard holds a Google Sheets link)
 *
 * @example
 * const form = useSheetSourceForm(isHomeOpen);
 * const ref = form.validate('not a link'); // => null, form.error is set
 */
function useSheetSourceForm(isOpen) {
    const [history, setHistory] = useState(() => readSheetHistory());
    const [value, setValue] = useState('');
    const [prefillSource, setPrefillSource] = useState('empty');
    const [error, setError] = useState('');
    const touchedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) return undefined;
        touchedRef.current = false;
        const freshHistory = readSheetHistory();
        setHistory(freshHistory);
        setError('');
        const applyPrefill = (clipboardRef) => {
            if (touchedRef.current) return;
            const prefill = resolveHomeScreenPrefill(clipboardRef, freshHistory);
            setValue(prefill.url);
            setPrefillSource(prefill.source);
        };
        applyPrefill(null);
        return attachClipboardPrefill(applyPrefill);
    }, [isOpen]);

    const markTouched = useCallback(() => { touchedRef.current = true; }, []);
    const updateInputValue = useCallback((nextText) => {
        touchedRef.current = true;
        setValue(nextText);
        setPrefillSource(nextText.trim() ? 'manual' : 'empty');
    }, []);
    const validate = useCallback((text) => {
        const ref = normalizeSheetReference(text);
        setError(ref ? '' : 'That does not look like a Google Sheets link or spreadsheet ID (35–60 letters, digits, "-" or "_").');
        return ref;
    }, []);
    const forget = useCallback((id) => setHistory(forgetSheetHistoryEntry(id)), []);
    const resetHistory = useCallback(() => setHistory([]), []);

    return { value, setValue, updateInputValue, prefillSource, history, error, validate, forget, resetHistory, markTouched };
}

/**
 * One row of the inline previously-used-sheets list: bold title (or an "Untitled sheet"
 * placeholder), the bare ID in monospace, and a "×" button that forgets saved entries.
 *
 * @param {object} props
 * @param {{id: string, title: string, uses: number, isDemo?: boolean}} props.entry - History entry
 * @param {Function} props.onPick - Called with the entry when the row is clicked
 * @param {Function} props.onForget - Called with the entry ID when "×" is clicked
 * @returns {React.ReactNode}
 *
 * @example
 * <SheetHistoryRow entry={{ id: '1BQvy…', title: 'Ancestry Browser: Demo', uses: 3 }} onPick={open} onForget={forget} />
 *
 * @example
 * <SheetHistoryRow entry={{ id: '1BQvy…', title: '', uses: 1 }} onPick={open} onForget={forget} />
 */
const SheetHistoryRow = ({ entry, onPick, onForget }) => (
    <li className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-primary-container/60 cursor-pointer" onClick={() => onPick(entry)}
        title={formatSheetHistoryLabel(entry)} data-sheet-id={entry.id}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container/50 text-primary">
            <Icons.Sheet />
        </span>
        <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${entry.title ? 'font-semibold text-slate-800' : 'italic text-slate-500'}`}>
                {entry.title || 'Untitled sheet'}
            </div>
            <div className="truncate font-mono text-[11px] text-slate-500">{entry.id}</div>
        </div>
        {!entry.isDemo && onForget && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onForget(entry.id); }}
                className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                title="Forget this sheet" aria-label={`Forget ${entry.title || entry.id}`}>
                <Icons.Close />
            </button>
        )}
    </li>
);

/**
 * Always-visible inline list of previously used sheets rendered directly below the
 * home-screen input box, paired with the "← Back to the current tree" link in its header.
 *
 * @param {object} props
 * @param {Array} props.entries - Previously used sheet entries to display inline
 * @param {Function} props.onPick - Row click handler
 * @param {Function} props.onForget - "×" handler
 * @param {boolean} [props.hasTree=false] - Whether a tree is currently loaded behind the home screen
 * @param {Function} [props.onClose] - Handler for "← Back to the current tree"
 * @returns {React.ReactNode|null}
 *
 * @example
 * <SheetHistoryDropdown entries={history} onPick={open} onForget={forget} hasTree={true} onClose={closeHome} />
 *
 * @example
 * <SheetHistoryDropdown entries={[]} onPick={open} onForget={forget} /> // renders nothing
 */
const SheetHistoryDropdown = ({ entries, onPick, onForget, hasTree = false, onClose }) => {
    const hasEntries = Boolean(entries && entries.length > 0);
    if (!hasEntries && !hasTree) return null;
    return (
        <div data-testid="sheet-history-dropdown" className="mt-5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Previously used sheets
                </span>
                {hasTree && onClose && (
                    <button type="button" onClick={onClose} data-testid="back-to-tree-button"
                        className="text-xs font-semibold text-primary hover:underline">
                        ← Back to the current tree
                    </button>
                )}
            </div>
            {hasEntries && (
                <ul className="custom-scrollbar max-h-72 divide-y divide-slate-100 overflow-y-auto">
                    {entries.map(entry => (
                        <SheetHistoryRow key={entry.id} entry={entry} onPick={onPick} onForget={onForget} />
                    ))}
                </ul>
            )}
        </div>
    );
};

/**
 * URL / ID textbox without any pulldown menu. Kept empty unless a Google Sheets URL was
 * copied from the clipboard; typing marks the form as touched so late clipboard reads
 * never overwrite user input.
 *
 * @param {object} props
 * @param {object} props.form - Result of useSheetSourceForm()
 * @returns {React.ReactNode}
 *
 * @example
 * <SheetSourceInput form={form} />
 *
 * @example
 * <SheetSourceInput form={useSheetSourceForm(true)} />
 */
const SheetSourceInput = ({ form }) => {
    const isClipboard = form.prefillSource === 'clipboard' && Boolean(form.value);
    const handleChange = (e) => {
        if (form.updateInputValue) {
            form.updateInputValue(e.target.value);
        } else {
            form.markTouched();
            form.setValue(e.target.value);
        }
    };
    return (
        <div className="relative flex-1">
            <input id="sheet-source-input" type="text" value={form.value} autoFocus spellCheck={false} autoComplete="off"
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                placeholder="Paste a Google Sheets URL or spreadsheet ID…"
                className={`h-12 w-full rounded-xl border bg-white px-4 font-mono text-[13px] text-slate-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 ${
                    isClipboard ? 'border-primary/60 bg-primary-container/10' : 'border-slate-300'
                }`} />
        </div>
    );
};

/**
 * Header row above the home-screen input box: label on the left, plus optional clipboard
 * indicator badge and known-sheet-title chip on the right.
 *
 * @param {object} props
 * @param {boolean} props.isClipboardPrefill - True when the input value came from the copy buffer
 * @param {string} props.sheetTitle - Known human title for the spreadsheet in the input box
 * @returns {React.ReactNode}
 *
 * @example
 * <SheetSourceFormHeader isClipboardPrefill={true} sheetTitle="Ancestry Browser: Demo" />
 *
 * @example
 * <SheetSourceFormHeader isClipboardPrefill={false} sheetTitle="" />
 */
const SheetSourceFormHeader = ({ isClipboardPrefill, sheetTitle }) => (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="sheet-source-input" className="text-sm font-semibold text-slate-600">
            Google Sheets link or spreadsheet ID
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
            {isClipboardPrefill && (
                <span data-testid="clipboard-prefill-badge"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-sm">
                    📋 Copied from copy buffer
                </span>
            )}
            {sheetTitle && (
                <span data-testid="sheet-source-title" title={`Spreadsheet name: ${sheetTitle}`}
                    className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-full border border-slate-200 bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-primary shadow-sm">
                    <Icons.Sheet /><span className="truncate">{sheetTitle}</span>
                </span>
            )}
        </div>
    </div>
);

/**
 * The whole form: label + clipboard/title chips, textbox row with the Open button, prefill
 * hint, validation/import error, and the inline list of previously used sheets + back link.
 *
 * @param {object} props
 * @param {object} props.form - Result of useSheetSourceForm()
 * @param {boolean} props.isLoading - Whether an import is in flight
 * @param {string} props.errorMsg - Last import error from the app ('' when none)
 * @param {Function} props.onSubmit - Called with the raw text
 * @param {boolean} [props.hasTree=false] - Whether a tree is loaded behind the home screen
 * @param {Function} [props.onClose] - Closes the home overlay and returns to the current tree
 * @returns {React.ReactNode}
 *
 * @example
 * <SheetSourceForm form={form} isLoading={false} errorMsg="" onSubmit={handleSubmit} hasTree={true} onClose={closeHome} />
 *
 * @example
 * <SheetSourceForm form={form} isLoading={true} errorMsg="Invalid Google Sheets URL." onSubmit={handleSubmit} />
 */
const SheetSourceForm = ({ form, isLoading, errorMsg, onSubmit, hasTree = false, onClose }) => {
    const sheetTitle = resolveKnownSheetTitle(form.value, form.history);
    const isClipboardPrefill = form.prefillSource === 'clipboard' && Boolean(form.value);
    const inlineEntries = resolveHomeScreenSheetList(form.history);
    const pickEntry = (entry) => {
        const url = buildSheetUrlFromId(entry.id);
        form.markTouched();
        form.setValue(url);
        onSubmit(url);
    };
    return (
        <form className="relative z-20 w-full max-w-2xl px-6" onSubmit={(e) => { e.preventDefault(); onSubmit(form.value); }}>
            <SheetSourceFormHeader isClipboardPrefill={isClipboardPrefill} sheetTitle={sheetTitle} />
            <div className="flex gap-2">
                <SheetSourceInput form={form} />
                <button type="submit" disabled={isLoading} data-doc-key="Open the Google Sheet"
                    className="h-12 shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold text-on-primary shadow-md transition hover:bg-primary-hover disabled:opacity-60">
                    {isLoading ? 'Loading…' : 'Open'}
                </button>
            </div>
            <div className="mt-2 text-xs text-slate-500" data-prefill-source={form.prefillSource}>
                {HOME_PREFILL_HINTS[form.prefillSource] || HOME_PREFILL_HINTS.empty}
            </div>
            {(form.error || errorMsg) && (
                <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {form.error || errorMsg}
                </div>
            )}
            <SheetHistoryDropdown entries={inlineEntries} onPick={pickEntry} onForget={form.forget} hasTree={hasTree} onClose={onClose} />
        </form>
    );
};

/**
 * Emblem, title and tagline at the top of the home screen.
 *
 * @returns {React.ReactNode}
 *
 * @example
 * <HomeScreenHeader />
 *
 * @example
 * <div className="flex flex-col items-center"><HomeScreenHeader /><SheetSourceForm … /></div>
 */
const HomeScreenHeader = () => (
    <div className="relative z-10 mb-8 flex flex-col items-center text-center select-none">
        <BrandLogo size={128} idPrefix="home" className="h-[128px] w-[128px] drop-shadow-md" />
        <h1 className="mt-5 bg-gradient-to-r from-slate-700 via-primary to-inverse-primary bg-clip-text text-[48px] font-bold leading-none tracking-wide text-transparent"
            style={{ fontFamily: "'Uncial Antiqua', serif" }}>Family Tree</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-500">
            Turn a family register kept in a Google Sheet into an interactive, deduced family tree.
        </p>
    </div>
);

/**
 * GDPR / privacy notice pinned to the bottom of the home screen, with a one-click
 * "Clear stored data" that deletes all three preference cookies and their mirrors.
 *
 * @param {object} props
 * @param {Function} props.onClearStoredData - Handler for the clear button
 * @returns {React.ReactNode}
 *
 * @example
 * <HomePrivacyNotice onClearStoredData={() => clearStoredPreferences()} />
 *
 * @example
 * <HomePrivacyNotice onClearStoredData={handleClearStoredData} />
 */
const HomePrivacyNotice = ({ onClearStoredData }) => (
    <footer data-testid="home-privacy-notice" className="relative z-10 mt-auto w-full max-w-3xl px-6 pb-5 pt-8 text-center text-[11px] leading-relaxed text-slate-500 sm:px-20">
        <strong className="text-slate-600">Privacy.</strong> For your convenience this app stores the spreadsheet links you open, your
        deduction settings and your colour theme in cookies / local storage on <em>this device only</em>. Nothing is sent to any server other than
        Google Sheets, which serves the spreadsheet you request. You can withdraw this at any time:{' '}
        <button type="button" onClick={onClearStoredData} className="font-semibold text-primary underline underline-offset-2 hover:text-primary-hover">
            clear stored data
        </button>.
    </footer>
);

/**
 * Full-screen home overlay (z-70, above every toolbar). Hidden entirely while `isOpen` is
 * false, so the tree beneath keeps its state when the user returns to it.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Show the overlay
 * @param {boolean} props.hasTree - A tree is loaded (shows the "Back to the current tree" link)
 * @param {boolean} props.isLoading - Import in flight
 * @param {string} props.errorMsg - Last import error ('' when none)
 * @param {Function} props.onSubmit - Called with a canonical sheet URL to open
 * @param {Function} props.onClose - Closes the overlay without loading anything
 * @param {Function} props.onClearStoredData - GDPR clear handler
 * @returns {React.ReactNode|null}
 *
 * @example
 * <SheetSourceHomeScreen isOpen={true} hasTree={false} isLoading={false} errorMsg="" onSubmit={handleImport} onClose={() => {}} onClearStoredData={clearStoredPreferences} />
 *
 * @example
 * <SheetSourceHomeScreen isOpen={isHomeOpen} hasTree={Boolean(tree.rootId)} isLoading={isLoading} errorMsg={errorMsg} onSubmit={openSheet} onClose={closeHome} onClearStoredData={clearAll} />
 */
const SheetSourceHomeScreen = ({ isOpen, hasTree, isLoading, errorMsg, onSubmit, onClose, onClearStoredData }) => {
    const form = useSheetSourceForm(isOpen);
    if (!isOpen) return null;
    const handleSubmit = (text) => {
        const ref = form.validate(text);
        if (ref) onSubmit(ref.url);
    };
    const handleClear = () => {
        onClearStoredData();
        form.resetHistory();
    };
    return (
        <div data-testid="sheet-source-home" className="fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto bg-white bg-gradient-to-b from-white via-primary-container/30 to-primary-container pt-[9vh]"
            style={{ fontFamily: '"Google Sans", system-ui, -apple-system, sans-serif' }}>
            <BrandWatermark size={640} opacity={0.06} />
            <HomeScreenHeader />
            <SheetSourceForm form={form} isLoading={isLoading} errorMsg={errorMsg} onSubmit={handleSubmit} hasTree={hasTree} onClose={onClose} />
            <HomePrivacyNotice onClearStoredData={handleClear} />
        </div>
    );
};

/**
 * The emblem button pinned to the top-left corner of every tree/map view; clicking it
 * returns to the home screen. Not rendered in standalone `.html` exports, which carry
 * their own embedded dataset and cannot switch sheets.
 *
 * @param {object} props
 * @param {Function} props.onClick - Opens the home screen
 * @returns {React.ReactNode|null}
 *
 * @example
 * <HomeButton onClick={() => setIsHomeOpen(true)} />
 *
 * @example
 * {!isHomeOpen && <HomeButton onClick={openHome} />}
 */
const HomeButton = ({ onClick }) => {
    if (isStandaloneExportMode()) return null;
    return (
        <button type="button" onClick={onClick} data-testid="home-button" title="Family Tree Home – choose a Google Sheet"
            className="fixed left-4 top-4 z-[60] flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur-md transition-colors hover:bg-primary-container/60">
            <BrandLogo size={30} idPrefix="homebtn" className="h-[30px] w-[30px]" />
        </button>
    );
};
