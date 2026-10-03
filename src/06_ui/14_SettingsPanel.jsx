// ============================================================================
// MODULE 6.14: DEDUCTION SETTINGS PANEL
//
// Lets the user tune the social conventions behind the year deductions — above all
// the bride's age at first marriage per birth cohort (born 1910s-20s ≈ 15, 1940s
// ≈ 20-25, 2000s ≈ 25-30). Applying rebuilds the tree from the cached rows (no
// refetch) and persists the values in a cookie (05_hooks/00_BrowserPreferences.jsx).
// ============================================================================

/** The three scalar knobs shown under the cohort table, with their sanitizer bounds. */
const DEMOGRAPHIC_SCALAR_FIELDS = Object.freeze([
    { key: 'firstChildAfterMarriage', label: 'Wedding → first child', min: 0, max: 15,
      hint: 'Added to the bride\'s marriage age to get a mother\'s age at her first child.' },
    { key: 'spousalGenderOffset', label: 'Husband older than wife by', min: 0, max: 15,
      hint: 'Every husband/father deduction is shifted by this many years from the wife.' },
    { key: 'consecutiveSiblingGap', label: 'Gap between consecutive siblings', min: 1, max: 6,
      hint: 'Spacing assumed between birth-order siblings whose years are unknown.' },
]);

/** Birth cohorts used to illustrate the anchor curve inside the panel. */
const MARRIAGE_AGE_PREVIEW_COHORTS = Object.freeze([1915, 1945, 1975, 2005]);

/**
 * Suggests the next cohort row for the anchors table: ten years after the last row at the
 * same age (so the curve stays flat until the user edits it), or [1900, 15] for an empty table.
 *
 * @param {Array<Array<number|string>>} anchors - Current (possibly half-typed) rows
 * @returns {Array<number>} New [birthYear, marriageAge] row
 *
 * @example
 * suggestNextMarriageAnchor([[1900, 15], [1940, 22]]);
 * // => [1950, 22]
 *
 * @example
 * suggestNextMarriageAnchor([]);
 * // => [1900, 15]
 *
 * @example
 * suggestNextMarriageAnchor([[1940, '']]); // age cell still blank
 * // => [1950, 15]
 */
function suggestNextMarriageAnchor(anchors) {
    const last = Array.isArray(anchors) && anchors.length > 0 ? anchors[anchors.length - 1] : null;
    const asNumber = (v) => (v === '' || v === null || v === undefined ? Number.NaN : Number(v));
    const year = last ? asNumber(last[0]) : Number.NaN;
    const age = last ? asNumber(last[1]) : Number.NaN;
    return [Number.isFinite(year) ? year + 10 : 1900, Number.isFinite(age) ? age : 15];
}

/**
 * Evaluates a DRAFT (unapplied, possibly half-typed) settings object on a few illustrative
 * cohorts: marriage age and age at first child, after the same sanitization Apply would do.
 *
 * @param {Object} draft - Settings in DEFAULT_DEMOGRAPHIC_SETTINGS shape (raw strings allowed)
 * @param {Array<number>} [cohorts=MARRIAGE_AGE_PREVIEW_COHORTS] - Birth years to illustrate
 * @returns {Array<{year: number, marriageAge: number, firstChildAge: number}>}
 *
 * @example
 * describeMarriageAgePreview(FamilyTreeBuilder.getDemographicSettings(), [1915, 2005]);
 * // => [{ year: 1915, marriageAge: 15, firstChildAge: 17 }, { year: 2005, marriageAge: 27.3, firstChildAge: 29 }]
 *
 * @example
 * describeMarriageAgePreview({ marriageAgeAnchors: [[1900, 20], [2000, 30]], firstChildAfterMarriage: 1 }, [1950]);
 * // => [{ year: 1950, marriageAge: 25, firstChildAge: 26 }]
 */
function describeMarriageAgePreview(draft, cohorts = MARRIAGE_AGE_PREVIEW_COHORTS) {
    const clean = FamilyTreeBuilder.sanitizeDemographicSettings(draft);
    const model = {
        ANCHORS: clean.marriageAgeAnchors,
        REFERENCE_COHORT_YEAR: FamilyTreeBuilder.MARRIAGE_AGE_MODEL.REFERENCE_COHORT_YEAR,
    };
    return cohorts.map(year => {
        const marriageAge = FamilyTreeBuilder.marriageAgeForBirthYear(year, model);
        return {
            year,
            marriageAge: Math.round(marriageAge * 10) / 10,
            firstChildAge: Math.round(marriageAge + clean.firstChildAfterMarriage),
        };
    });
}

/**
 * Draft state for the panel. Re-seeded from the LIVE model each time the panel opens, so
 * cancelling discards edits. Cells hold raw input strings until Apply sanitizes them.
 *
 * @param {boolean} isOpen - Whether the panel is showing
 * @returns {{draft: Object, setField: Function, setAnchor: Function, addAnchor: Function, removeAnchor: Function, resetDraft: Function}}
 *
 * @example
 * const { draft, setField } = useDemographicSettingsDraft(true);
 * setField('spousalGenderOffset', '3');
 *
 * @example
 * const { draft, setAnchor, addAnchor } = useDemographicSettingsDraft(isSettingsOpen);
 * addAnchor(); setAnchor(draft.marriageAgeAnchors.length, 1, '29');
 */
function useDemographicSettingsDraft(isOpen) {
    const [draft, setDraft] = useState(() => FamilyTreeBuilder.getDemographicSettings());
    useEffect(() => {
        if (isOpen) setDraft(FamilyTreeBuilder.getDemographicSettings());
    }, [isOpen]);
    const setField = useCallback((key, value) => setDraft(d => ({ ...d, [key]: value })), []);
    const setAnchor = useCallback((index, column, value) => setDraft(d => ({
        ...d,
        marriageAgeAnchors: d.marriageAgeAnchors.map((pair, i) =>
            i === index ? pair.map((cell, c) => (c === column ? value : cell)) : pair),
    })), []);
    const addAnchor = useCallback(() => setDraft(d => ({
        ...d, marriageAgeAnchors: [...d.marriageAgeAnchors, suggestNextMarriageAnchor(d.marriageAgeAnchors)],
    })), []);
    const removeAnchor = useCallback((index) => setDraft(d => ({
        ...d, marriageAgeAnchors: d.marriageAgeAnchors.filter((_, i) => i !== index),
    })), []);
    const resetDraft = useCallback(() => setDraft(
        FamilyTreeBuilder.sanitizeDemographicSettings(FamilyTreeBuilder.DEFAULT_DEMOGRAPHIC_SETTINGS)
    ), []);
    return { draft, setField, setAnchor, addAnchor, removeAnchor, resetDraft };
}

/**
 * Compact numeric input used throughout the panel.
 *
 * @param {object} props
 * @param {number|string} props.value - Current raw value
 * @param {Function} props.onChange - Receives the raw input string
 * @param {number} [props.min] - Minimum (advisory; the sanitizer enforces it)
 * @param {number} [props.max] - Maximum (advisory)
 * @param {string} [props.ariaLabel] - Accessible label
 * @param {string} [props.className=''] - Extra classes
 * @returns {React.ReactNode}
 *
 * @example
 * <SettingsNumberInput value={22} onChange={v => setAnchor(2, 1, v)} min={10} max={60} ariaLabel="Marriage age" />
 *
 * @example
 * <SettingsNumberInput value="2" onChange={v => setField('spousalGenderOffset', v)} min={0} max={15} />
 */
const SettingsNumberInput = ({ value, onChange, min, max, ariaLabel, className = '' }) => (
    <input type="number" inputMode="numeric" value={value} min={min} max={max} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-right font-mono text-sm text-slate-800 outline-none focus:border-[#5c7c33] focus:ring-2 focus:ring-[#9cc95f]/50 ${className}`} />
);

/**
 * Editable table of [birth cohort → bride's age at first marriage] anchors with add/remove.
 *
 * @param {object} props
 * @param {Array<Array<number|string>>} props.anchors - Draft rows
 * @param {Function} props.onCell - (rowIndex, column, rawValue)
 * @param {Function} props.onAdd - Append a row
 * @param {Function} props.onRemove - (rowIndex)
 * @returns {React.ReactNode}
 *
 * @example
 * <MarriageAgeAnchorsTable anchors={draft.marriageAgeAnchors} onCell={setAnchor} onAdd={addAnchor} onRemove={removeAnchor} />
 *
 * @example
 * <MarriageAgeAnchorsTable anchors={[[1900, 15], [2000, 27]]} onCell={() => {}} onAdd={() => {}} onRemove={() => {}} />
 */
const MarriageAgeAnchorsTable = ({ anchors, onCell, onAdd, onRemove }) => (
    <div data-testid="marriage-age-anchors" className="rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_1fr_40px] gap-2 border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Bride born in</span><span>Married at age</span><span />
        </div>
        {anchors.map((pair, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_40px] items-center gap-2 px-3 py-1.5">
                <SettingsNumberInput value={pair[0]} min={1600} max={2200} ariaLabel={`Cohort ${index + 1} birth year`} onChange={(v) => onCell(index, 0, v)} />
                <SettingsNumberInput value={pair[1]} min={10} max={60} ariaLabel={`Cohort ${index + 1} marriage age`} onChange={(v) => onCell(index, 1, v)} />
                <button type="button" onClick={() => onRemove(index)} disabled={anchors.length <= 1} title="Remove this cohort"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                    <Icons.Close />
                </button>
            </div>
        ))}
        <button type="button" onClick={onAdd} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-[#5c7c33] hover:bg-[#f3f8ea]">
            + Add a cohort
        </button>
    </div>
);

/**
 * Sentence-style preview of the draft curve ("Born 1915 → marries at 15, first child at 17 …").
 *
 * @param {object} props
 * @param {Object} props.draft - Draft settings
 * @returns {React.ReactNode}
 *
 * @example
 * <MarriageAgePreview draft={draft} />
 *
 * @example
 * <MarriageAgePreview draft={FamilyTreeBuilder.getDemographicSettings()} />
 */
const MarriageAgePreview = ({ draft }) => (
    <ul data-testid="marriage-age-preview" className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-4">
        {describeMarriageAgePreview(draft).map(row => (
            <li key={row.year}>
                <span className="font-semibold text-slate-600">Born {row.year}</span>
                <br />marries at {row.marriageAge}, first child at {row.firstChildAge}
            </li>
        ))}
    </ul>
);

/**
 * The three scalar knobs (wedding → first child, husband/wife offset, sibling gap).
 *
 * @param {object} props
 * @param {Object} props.draft - Draft settings
 * @param {Function} props.onField - (key, rawValue)
 * @returns {React.ReactNode}
 *
 * @example
 * <DemographicScalarFields draft={draft} onField={setField} />
 *
 * @example
 * <DemographicScalarFields draft={{ firstChildAfterMarriage: 2, spousalGenderOffset: 2, consecutiveSiblingGap: 2 }} onField={() => {}} />
 */
const DemographicScalarFields = ({ draft, onField }) => (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {DEMOGRAPHIC_SCALAR_FIELDS.map(field => (
            <label key={field.key} className="flex items-center gap-4 px-3 py-2.5">
                <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-700">{field.label}</span>
                    <span className="block text-[11px] text-slate-500">{field.hint}</span>
                </span>
                <SettingsNumberInput value={draft[field.key]} min={field.min} max={field.max} ariaLabel={field.label}
                    onChange={(v) => onField(field.key, v)} />
                <span className="w-10 text-xs text-slate-400">years</span>
            </label>
        ))}
    </div>
);

/**
 * Footer actions: reset to shipped defaults, cancel, apply.
 *
 * @param {object} props
 * @param {Function} props.onReset - Reset draft to defaults
 * @param {Function} props.onCancel - Close without applying
 * @param {Function} props.onApply - Apply the draft
 * @returns {React.ReactNode}
 *
 * @example
 * <SettingsPanelFooter onReset={resetDraft} onCancel={onClose} onApply={apply} />
 *
 * @example
 * <SettingsPanelFooter onReset={() => {}} onCancel={() => {}} onApply={() => {}} />
 */
const SettingsPanelFooter = ({ onReset, onCancel, onApply }) => (
    <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onReset} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Reset to defaults</button>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" onClick={onApply} className="h-9 rounded-lg bg-[#5c7c33] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#4a6a27]">
            Apply &amp; rebuild tree
        </button>
    </div>
);

/**
 * Modal panel for the deduction settings. Apply sanitizes the draft, installs it into the
 * live model, persists it, and asks the app to rebuild the tree from cached rows.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Show the panel
 * @param {Function} props.onClose - Close without applying
 * @param {Function} props.onApply - Receives the raw draft to apply
 * @returns {React.ReactNode|null}
 *
 * @example
 * <DeductionSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onApply={applyDemographicSettings} />
 *
 * @example
 * <DeductionSettingsPanel isOpen={true} onClose={close} onApply={(draft) => console.log(draft)} />
 */
const DeductionSettingsPanel = ({ isOpen, onClose, onApply }) => {
    const { draft, setField, setAnchor, addAnchor, removeAnchor, resetDraft } = useDemographicSettingsDraft(isOpen);
    if (!isOpen) return null;
    return (
        <div data-testid="deduction-settings-panel" className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[2px]" onPointerDown={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="deduction-settings-title" onPointerDown={(e) => e.stopPropagation()}
                className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
                    <div className="flex-1">
                        <h2 id="deduction-settings-title" className="text-lg font-bold text-slate-800">Deduction settings</h2>
                        <p className="mt-0.5 text-xs text-slate-500">How missing birth years are guessed. Saved in a cookie on this device; applies to every sheet you open here.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close"><Icons.Close /></button>
                </div>
                <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-4">
                    <section>
                        <h3 className="text-sm font-semibold text-slate-700">Bride's age at first marriage, by birth cohort</h3>
                        <p className="mb-2 text-[11px] text-slate-500">Ages between cohorts are interpolated; outside the table the nearest cohort applies.</p>
                        <MarriageAgeAnchorsTable anchors={draft.marriageAgeAnchors} onCell={setAnchor} onAdd={addAnchor} onRemove={removeAnchor} />
                        <MarriageAgePreview draft={draft} />
                    </section>
                    <section>
                        <h3 className="mb-2 text-sm font-semibold text-slate-700">Other intervals</h3>
                        <DemographicScalarFields draft={draft} onField={setField} />
                    </section>
                </div>
                <SettingsPanelFooter onReset={resetDraft} onCancel={onClose} onApply={() => onApply(draft)} />
            </div>
        </div>
    );
};

/**
 * Rebuilds the family tree from the rows cached for `sheetUrl` (localStorage cache or the
 * embedded standalone payload) using the CURRENT model tables — no network round-trip.
 *
 * @param {string} sheetUrl - Sheet URL whose rows are cached
 * @param {Function} appendLog - Activity log callback
 * @returns {FamilyTree|null} The rebuilt tree, or null when nothing is cached
 *
 * @example
 * const tree = rebuildTreeFromCachedRows(sheetUrl, appendLog);
 * if (tree) setTree(tree);
 *
 * @example
 * rebuildTreeFromCachedRows('https://docs.google.com/spreadsheets/d/never-loaded/edit', () => {});
 * // => null
 */
function rebuildTreeFromCachedRows(sheetUrl, appendLog) {
    const cached = TreeDataCache.get(sheetUrl);
    if (!cached || !Array.isArray(cached.rows) || cached.rows.length === 0) return null;
    const tStart = performance.now();
    try {
        const tree = new FamilyTreeBuilder(cached.rows, cached.sheetTags || {}).build();
        appendLog(`⚙️ Rebuilt ${cached.rows.length} profiles with the updated deduction settings in ${Math.round(performance.now() - tStart)}ms.`, 'success');
        return tree;
    } catch (e) {
        console.error('Rebuild with new settings failed:', e);
        return null;
    }
}

/**
 * Hook returning the Apply handler for the panel: install + persist the settings, then
 * rebuild from cached rows (falling back to a fresh fetch when nothing is cached).
 *
 * @param {object} params
 * @param {string} params.sheetUrl - Current sheet URL
 * @param {Function} params.setTree - Tree state setter
 * @param {Function} params.appendLog - Activity log callback
 * @param {Function} params.fetchFromUrl - Network fetch fallback
 * @param {Function} params.setIsSettingsOpen - Panel visibility setter
 * @returns {Function} applyDemographicSettingsDraft(draft)
 *
 * @example
 * const applyDraft = useDemographicSettingsApply({ sheetUrl, setTree, appendLog, fetchFromUrl, setIsSettingsOpen });
 * <DeductionSettingsPanel isOpen={isSettingsOpen} onClose={close} onApply={applyDraft} />
 *
 * @example
 * const applyDraft = useDemographicSettingsApply({ sheetUrl: '', setTree: () => {}, appendLog: () => {}, fetchFromUrl: async () => false, setIsSettingsOpen: () => {} });
 * applyDraft({ spousalGenderOffset: 3 });
 */
function useDemographicSettingsApply({ sheetUrl, setTree, appendLog, fetchFromUrl, setIsSettingsOpen }) {
    return useCallback((draft) => {
        const applied = FamilyTreeBuilder.applyDemographicSettings(draft);
        saveDemographicSettings(applied);
        setIsSettingsOpen(false);
        if (!sheetUrl) return;
        const rebuilt = rebuildTreeFromCachedRows(sheetUrl, appendLog);
        if (rebuilt) {
            setTree(rebuilt);
        } else {
            fetchFromUrl(sheetUrl, { skipCache: true });
        }
    }, [sheetUrl, setTree, appendLog, fetchFromUrl, setIsSettingsOpen]);
}
