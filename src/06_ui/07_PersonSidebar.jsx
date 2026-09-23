
/**
 * Visual themes, titles, and icons for person attribute category badges in PersonSidebar.
 *
 * @type {Record<'family'|'job'|'place', {
 *   title: (val: string) => string,
 *   hoverColors: string,
 *   countHover: string,
 *   icon: React.ReactNode
 * }>}
 */
const SIDEBAR_CATEGORY_THEMES = Object.freeze({
    family: {
        title: val => `View all people with family name "${val}"`,
        hoverColors: 'hover:bg-purple-50 text-slate-700 hover:text-purple-800 hover:border-purple-300',
        countHover: 'group-hover:bg-purple-200 group-hover:text-purple-900',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-purple-600 shrink-0">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        )
    },
    job: {
        title: val => `View all people with career "${val}"`,
        hoverColors: 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 hover:border-emerald-300',
        countHover: 'group-hover:bg-emerald-200 group-hover:text-emerald-900',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-emerald-600 shrink-0">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
        )
    },
    place: {
        title: val => `View all people in "${val}"`,
        hoverColors: 'hover:bg-rose-50 text-slate-700 hover:text-rose-800 hover:border-rose-300',
        countHover: 'group-hover:bg-rose-200 group-hover:text-rose-900',
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-rose-600 shrink-0">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
        )
    }
});

/**
 * Renders an interactive attribute badge button (for family name, career, or location)
 * in PersonSidebar, displaying an icon, label, and matching person count.
 *
 * @param {object} props
 * @param {'family'|'job'|'place'} props.category - Attribute category
 * @param {string} props.value - Attribute text value
 * @param {number} props.count - Number of matching people in the tree
 * @param {Function} props.onFilterBy - Callback invoked when clicked
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarCategoryBadge
 *   category="family"
 *   value="Chalissery"
 *   count={42}
 *   onFilterBy={(cat, val) => handleFilter(cat, val)}
 * />
 *
 * @example
 * <SidebarCategoryBadge
 *   category="job"
 *   value="Doctor"
 *   count={5}
 *   onFilterBy={(cat, val) => handleFilter(cat, val)}
 * />
 */
const SidebarCategoryBadge = ({ category, value, count, onFilterBy }) => {
    const theme = SIDEBAR_CATEGORY_THEMES[category];
    if (!theme || !value) return null;
    return (
        <button
            type="button"
            onClick={() => onFilterBy(category, value)}
            className={`text-xs font-semibold bg-slate-100 ${theme.hoverColors} px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer group`}
            title={theme.title(value)}
        >
            {theme.icon}
            <span>{value}</span>
            <span className={`text-[10px] bg-slate-200 ${theme.countHover} text-slate-600 rounded px-1 ml-0.5 font-mono`}>
                {count}
            </span>
        </button>
    );
};

/**
 * Renders an individual diagnostic or status log entry in the logs panel.
 *
 * @param {object} props
 * @param {object} props.log - Log message object
 * @param {string|number} props.log.id - Unique ID of the log entry
 * @param {string} [props.log.type] - Severity level ('error', 'success', 'warning', 'info')
 * @param {string} [props.log.prefix] - Hierarchical or formatting prefix
 * @param {string} props.log.msg - Main text message of the log
 * @returns {React.ReactNode}
 *
 * @example
 *   <SidebarLogItem log={{ id: 1, type: 'info', prefix: '├─', msg: 'Loaded tree' }} />
 *
 * @example
 *   <SidebarLogItem log={{ id: 2, type: 'error', msg: 'Failed to fetch' }} />
 */
const SidebarLogItem = ({ log }) => (
    <div className={`leading-relaxed flex items-start text-slate-700 ${log.type === 'error' ? 'text-red-700' : log.type === 'success' ? 'text-emerald-700 font-medium' : log.type === 'warning' ? 'text-amber-900' : 'text-slate-700'}`}>
        {log.prefix && (
            <span className={`whitespace-pre select-none shrink-0 ${log.prefix.includes('─') || log.prefix.includes('│') ? 'font-mono text-slate-400 mr-1' : 'font-sans text-slate-400 mr-1.5'}`}>
                {log.prefix}
            </span>
        )}
        <span className="break-words font-sans flex-1">{log.msg}</span>
    </div>
);

/**
 * Renders the slide-over log viewer within the sidebar panel, displaying system logs,
 * import status messages, and ongoing network/data-fetching indicators.
 *
 * @param {object} props
 * @param {Array<object>} props.logs - Log entries with type, msg, and optional prefix
 * @param {boolean} props.isLoading - Whether background fetch operations are running
 * @param {Function} props.setShowLogs - State setter to toggle or dismiss the log viewer
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarLogsView
 *   logs={[{ id: 1, type: 'success', msg: 'Data imported successfully' }]}
 *   isLoading={false}
 *   setShowLogs={setShowLogs}
 * />
 *
 * @example
 * <SidebarLogsView
 *   logs={[]}
 *   isLoading={true}
 *   setShowLogs={() => setShowLogs(false)}
 * />
 */
const SidebarLogsView = ({ logs, isLoading, setShowLogs }) => {
    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 bg-slate-50/80">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm select-none">
                    <span className="text-blue-600"><Icons.Log /></span>
                    <span>Logs</span>
                </div>
                        <button 
                            onClick={() => setShowLogs(false)} 
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                            title="Close Log Panel"
                        >
                            <Icons.Close />
                        </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 font-sans text-xs space-y-2.5 flex flex-col custom-scrollbar bg-white">
                {logs.length === 0 ? <div className="text-slate-400 text-center py-4 italic font-sans text-sm">No logs yet. Click Import to start.</div> : 
                    logs.map((log) => <SidebarLogItem key={log.id} log={log} />)
                }
                {isLoading && <div className="text-blue-500 flex items-center gap-2 mt-3 text-sm font-sans"><Icons.Loader /> Fetching...</div>}
            </div>
        </div>
    );
};

/**
 * Renders an individual relative profile item button in the details panel,
 * displaying a gender indicator dot, relative name, and birth/death/age badges.
 *
 * @param {object} props
 * @param {Person|null} props.p - The relative person record
 * @param {string} props.id - Node identifier
 * @param {Function} props.onClick - Click callback to switch focus to this relative
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarRelativeItem
 *   p={tree.get('p1')}
 *   id="p1"
 *   onClick={() => setFocusId('p1')}
 * />
 *
 * @example
 * <SidebarRelativeItem
 *   p={parentPerson}
 *   id={parentPerson.id}
 *   onClick={handleSelectRelative}
 * />
 */
const SidebarRelativeItem = ({ p, id, onClick }) => {
    if (!p) return null;
    const { dateStr: relDate, extraStr: relExtra, isDeduced: relDeduced } = p.getDateStrings();

    const isFemale = p.gender === 'F';
    const isMale = p.gender === 'M';
    const dotColor = isMale ? 'bg-blue-500' : (isFemale ? 'bg-pink-500' : 'bg-slate-300');
    const dotTitle = isMale ? 'Male' : (isFemale ? 'Female' : 'Unknown');

    return (
        <div key={id} onClick={onClick} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 p-1.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-slate-200 interactive-element">
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} title={dotTitle} />
                <span className={`text-sm font-semibold text-slate-800 group-hover:text-blue-600 truncate ${p._isUnknown ? 'italic opacity-60' : ''}`}>
                    {p.name}
                    </span>
            </div>
            {relDate && (
                <div className={`inline-flex items-center text-[9px] font-medium bg-white text-slate-600 rounded border border-slate-200 overflow-hidden shadow-2xs group-hover:border-slate-300 transition-colors shrink-0 ${relDeduced ? 'border-dashed' : ''}`}
                     title={relDeduced ? "Deduced birth year and age" : undefined}
                >
                    <span className={`px-1.5 py-0.5 bg-slate-100 text-slate-800 ${relDeduced ? 'italic' : ''}`}>{relDate}</span>
                    {relExtra && <span className={`px-1.5 py-0.5 border-l border-slate-200 text-slate-500 bg-slate-50 ${relDeduced ? 'italic' : ''}`}>{relExtra}</span>}
                </div>
            )}
        </div>
    );
};

/**
 * Renders a relative section (e.g. Parents, Partners, Children, Siblings) in the details panel,
 * filtering out synthetic sibling parent placeholders and sorting candidates chronologically.
 *
 * @param {object} props
 * @param {string} props.title - Group section title (e.g. 'Parents', 'Partner', 'Children', 'Siblings')
 * @param {string[]} props.ids - Array of candidate person IDs
 * @param {FamilyTree} props.tree - Populated FamilyTree instance
 * @param {Function} props.setFocusId - Callback to select a person by ID
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarRelativeGroup
 *   title="Parents"
 *   ids={[focusPerson.momId, focusPerson.fatherId]}
 *   tree={tree}
 *   setFocusId={setFocusId}
 * />
 *
 * @example
 * <SidebarRelativeGroup
 *   title="Children"
 *   ids={focusPerson.children}
 *   tree={tree}
 *   setFocusId={setFocusId}
 * />
 */
const SidebarRelativeGroup = ({ title, ids, tree, setFocusId }) => {
    if (!ids || ids.length === 0) return null;

    const validIds = ids.filter(id => {
        const node = tree.get(id);
        return node && !FamilyTree.isSyntheticSiblingParent(node);
    }).sort((a, b) => compareSidebarRelatives(tree.get(a), tree.get(b)));

    if (validIds.length === 0) return null;

    return (
        <div key={title} className="mb-5">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
            <div className="flex flex-col gap-1.5">
                {validIds.map(id => (
                    <SidebarRelativeItem
                        key={id}
                        p={tree.get(id)}
                        id={id}
                        onClick={() => setFocusId(id)}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * Renders an external Google Sheets source citation link badge with an external link icon.
 *
 * @param {object} props
 * @param {string} props.href - URL pointing to the sheet row
 * @param {string} props.title - Tooltip text for sheet and row citation
 * @param {string} props.linkText - Display text (e.g. 'Sheet 1: Row 14')
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarSourceLink
 *   href="https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=14:14"
 *   title="Main Tree: Row 14"
 *   linkText="Main: Row 14"
 * />
 *
 * @example
 * <SidebarSourceLink
 *   href="https://docs.google.com/spreadsheets/d/xyz/edit#gid=0&range=2:2"
 *   title="Inlaws: Row 2"
 *   linkText="Inlaws: Row 2"
 * />
 */
const SidebarSourceLink = ({ href, title, linkText }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 transition-colors"
        title={title}
    >
        <span className="font-medium">{linkText}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
    </a>
);

/**
 * Header section of SidebarPersonDetails rendering gender dot, person name heading, and nickname.
 *
 * @param {object} props
 * @param {Person} props.focusPerson - Active person node
 * @param {Function} props.setFocusId - Callback to select person ID
 * @param {Function} [props.centerOnPerson] - Callback to center viewport on person card
 * @returns {React.ReactNode}
 *
 * @example
 *   <SidebarPersonHeader focusPerson={person} setFocusId={setFocusId} centerOnPerson={center} />
 *
 * @example
 *   <SidebarPersonHeader focusPerson={unknownPerson} setFocusId={() => {}} />
 */
const SidebarPersonHeader = ({ focusPerson, setFocusId, centerOnPerson }) => (
    <>
        <div className="flex justify-between items-center gap-3 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
                {focusPerson.gender === 'M' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" title="Male" />
                )}
                {focusPerson.gender === 'F' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" title="Female" />
                )}
                {focusPerson.gender !== 'M' && focusPerson.gender !== 'F' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" title="Unknown" />
                )}
                <h2
                    onClick={() => {
                        if (focusPerson?.id) {
                            setFocusId(focusPerson.id);
                            if (typeof centerOnPerson === 'function') centerOnPerson(focusPerson.id);
                        }
                    }}
                    className={`text-2xl font-bold text-slate-800 leading-tight truncate ${focusPerson._isUnknown ? 'italic opacity-60' : 'cursor-pointer hover:text-blue-600 transition-colors'}`}
                    title={focusPerson._isUnknown ? undefined : `Center on ${focusPerson.name} in tree`}
                >
                    {focusPerson.name}
                            </h2>
                </div>
            </div>
            {focusPerson.nick && <p className="text-sm italic text-slate-500 mb-2">"{focusPerson.nick}"</p>}
        </>
);

/**
 * Renders the lifespan date and age description pill badge in the person sidebar.
 *
 * @param {object} props
 * @param {string} props.dateStr - Formatted lifespan or birth year string
 * @param {string|undefined} props.extraStr - Formatted age/lifespan description
 * @param {boolean} [props.isDeduced=false] - Whether birth year is deduced
 * @returns {React.ReactNode|null} Rendered lifespan badge or null
 *
 * @example
 * <SidebarPersonLifespanBadge dateStr="1920 - 1990" extraStr="70 yrs" isDeduced={false} />
 *
 * @example
 * <SidebarPersonLifespanBadge dateStr="1935" extraStr="88 yrs" isDeduced={true} />
 */
const SidebarPersonLifespanBadge = ({ dateStr, extraStr, isDeduced = false }) => {
    if (!dateStr) return null;
    return (
        <div className={`inline-flex items-center text-xs font-medium bg-white text-slate-600 rounded-md border border-slate-200 overflow-hidden shadow-sm ${isDeduced ? 'border-dashed' : ''}`}
             title={isDeduced ? "Deduced birth year and age" : undefined}
        >
            <span className={`px-2.5 py-1 bg-slate-100 text-slate-800 ${isDeduced ? 'italic' : ''}`}>{dateStr}</span>
            {extraStr && <span className={`px-2.5 py-1 border-l border-slate-200 text-slate-500 bg-slate-50 ${isDeduced ? 'italic' : ''}`}>{extraStr}</span>}
        </div>
    );
};

/**
 * Renders a list of category filter badges for comma-delimited string attributes (e.g. jobs or places).
 *
 * @param {Object} props - Component properties
 * @param {string|undefined} props.tokens - Comma-delimited token string
 * @param {string} props.category - Category key ('job' | 'place')
 * @param {FamilyTree} props.tree - Genealogy tree model
 * @param {Function} props.onFilterBy - Callback invoked when a badge is selected
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarTokenCategoryBadges tokens="Teacher, Farmer" category="job" tree={tree} onFilterBy={() => {}} />
 *
 * @example
 * <SidebarTokenCategoryBadges tokens="" category="place" tree={tree} onFilterBy={() => {}} />
 */
const SidebarTokenCategoryBadges = ({ tokens, category, tree, onFilterBy }) => {
    if (!tokens) return null;
    return parseCommaDelimitedTokens(tokens).map((val, idx) => (
        <SidebarCategoryBadge
            key={`${category}-${idx}`}
            category={category}
            value={val}
            count={countCategoryMembers(tree, category, val)}
            onFilterBy={onFilterBy}
        />
    ));
};

/**
 * Dates, family name, careers, and location badges rendered in the person details sidebar.
 *
 * @param {object} props
 * @param {Person} props.focusPerson - Active person node
 * @param {FamilyTree} props.tree - Family tree instance
 * @param {Function} props.onFilterBy - Callback to activate attribute filter
 * @param {string|undefined} props.dateStr - Formatted lifespan date string
 * @param {string|undefined} props.extraStr - Formatted age/lifespan description
 * @param {boolean} [props.isDeduced=false] - Whether birth year is deduced
 * @returns {React.ReactNode}
 *
 * @example
 *   <SidebarPersonBadges focusPerson={p} tree={tree} onFilterBy={fn} dateStr="1920 - 1990" extraStr="70 yrs" />
 *
 * @example
 *   <SidebarPersonBadges focusPerson={p} tree={tree} onFilterBy={() => {}} />
 */
const SidebarPersonBadges = ({ focusPerson, tree, onFilterBy, dateStr, extraStr, isDeduced }) => (
    <div className="flex flex-wrap items-center gap-2 mb-6">
        <SidebarPersonLifespanBadge dateStr={dateStr} extraStr={extraStr} isDeduced={isDeduced} />
        {focusPerson.family && (
            <SidebarCategoryBadge
                category="family"
                value={focusPerson.family}
                count={countCategoryMembers(tree, 'family', focusPerson.family)}
                onFilterBy={onFilterBy}
            />
        )}
        <SidebarTokenCategoryBadges tokens={focusPerson.job} category="job" tree={tree} onFilterBy={onFilterBy} />
        <SidebarTokenCategoryBadges tokens={focusPerson.place} category="place" tree={tree} onFilterBy={onFilterBy} />
    </div>
);

/**
 * Citation links to external Google Sheet source rows in person details.
 *
 * @param {object} props
 * @param {Person} props.focusPerson - Active person node
 * @param {object} props.sheetNames - Mapping from sheet IDs to sheet names
 * @returns {React.ReactNode|null}
 *
 * @example
 *   <SidebarSourceCitations focusPerson={p} sheetNames={{}} />
 *
 * @example
 *   <SidebarSourceCitations focusPerson={{}} sheetNames={{}} />
 */
const SidebarSourceCitations = ({ focusPerson, sheetNames }) => {
    if (!focusPerson?._sourceId) return null;
    return (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="font-medium text-slate-400">Source:</span>
            <div className="flex flex-wrap gap-1.5 items-center">
                {Array.from(focusPerson._sourceIds || [focusPerson._sourceId]).map((sheetId, idx) => {
                    const { linkText, href, title } = formatSourceLinkDetails(focusPerson, sheetId, idx, sheetNames);
                    return (
                        <SidebarSourceLink
                            key={sheetId}
                            href={href}
                            title={title}
                            linkText={linkText}
                        />
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Renders the full details view for the selected person in the sidebar panel.
 *
 * Displays person header (with centerOnPerson navigation), attribute badges,
 * categorized relatives lists (parents, partners, siblings, children), and source sheet links.
 *
 * @param {object} props
 * @param {Person} props.focusPerson - The currently selected person profile
 * @param {FamilyTree} props.tree - Populated tree model
 * @param {Function} props.setFocusId - Callback to select a person
 * @param {Function} props.onFilterBy - Callback to filter tree by category
 * @param {Function} props.centerOnPerson - Callback to center canvas camera on a person
 * @returns {React.ReactNode}
 *
 * @example
 * <SidebarPersonDetails
 *   focusPerson={person}
 *   tree={tree}
 *   setFocusId={setFocusId}
 *   onFilterBy={handleFilterBy}
 *   centerOnPerson={centerOnPerson}
 * />
 *
 * @example
 * <SidebarPersonDetails
 *   focusPerson={null}
 *   tree={tree}
 *   setFocusId={setFocusId}
 *   onFilterBy={handleFilterBy}
 *   centerOnPerson={centerOnPerson}
 * />
 */
const SidebarPersonDetails = ({ focusPerson, tree, setFocusId, onFilterBy, centerOnPerson }) => {
    const siblings = useMemo(() => tree.getSiblings(focusPerson?.id), [focusPerson, tree]);
    const { dateStr, extraStr, isDeduced } = focusPerson ? focusPerson.getDateStrings() : {};

    const renderRelativeGroup = (title, ids) => (
        focusPerson ? <SidebarRelativeGroup key={title} title={title} ids={ids} tree={tree} setFocusId={setFocusId} /> : null
    );

    return (
        <div className="p-6 pt-[72px] overflow-y-auto flex-1 pb-24 interactive-element w-full">
            <SidebarPersonHeader focusPerson={focusPerson} setFocusId={setFocusId} centerOnPerson={centerOnPerson} />
            <SidebarPersonBadges focusPerson={focusPerson} tree={tree} onFilterBy={onFilterBy} dateStr={dateStr} extraStr={extraStr} isDeduced={isDeduced} />
            <div className="mt-6">
                        {renderRelativeGroup('Parents', [focusPerson.momId, focusPerson.fatherId])}
                        {renderRelativeGroup(focusPerson.partners && focusPerson.partners.length > 1 ? 'Partners' : 'Partner', focusPerson.partners)}
                        {renderRelativeGroup('Children', focusPerson.children)}
                        {renderRelativeGroup('Siblings', siblings.map(s => s.id))}
            </div>
            <SidebarSourceCitations focusPerson={focusPerson} sheetNames={tree.sheetNames} />
        </div>
    );
};

/**
 * Renders the vertical draggable handle on the left edge of the sidebar for width adjustments.
 *
 * @param {object} props
 * @param {Function} props.onResizeStart - Pointer down event handler to begin dragging
 * @returns {React.ReactNode} Formatted resize drag handle element
 *
 * @example
 * <SidebarResizeHandle onResizeStart={handlePointerDown} />
 *
 * @example
 * <SidebarResizeHandle onResizeStart={e => startResize(e)} />
 */
const SidebarResizeHandle = ({ onResizeStart }) => (
    <div
        onPointerDown={onResizeStart}
        className="absolute top-0 bottom-0 left-0 w-3.5 -translate-x-1/2 cursor-col-resize z-50 group flex items-center justify-center select-none"
        title="Drag to resize panel"
    >
        <div className="w-[3px] h-12 rounded-full bg-slate-300 group-hover:bg-blue-500 group-hover:h-20 group-hover:w-[4px] transition-all group-active:bg-blue-600 group-active:h-28 shadow-sm" />
    </div>
);

/**
 * Renders the active primary panel within the details sidebar (AI Assistant, Logs, Filtered List, or Person Details).
 *
 * @param {Object} props
 * @param {Object} props.aiProps - Properties passed to AIAssistant.
 * @param {boolean} props.showLogs - Whether logs view is visible.
 * @param {boolean} props.showAI - Whether AI view is visible.
 * @param {Array<Object>} props.logs - System activity logs array.
 * @param {boolean} props.isLoading - Whether tree is currently loading.
 * @param {Function} props.setShowLogs - Setter for logs view visibility.
 * @param {Object|null} props.activeFilter - Current active filter state.
 * @param {Object} props.filteredProps - Properties passed to FilteredListView.
 * @param {Object|null} props.focusPerson - Currently focused person profile.
 * @param {FamilyTree} props.tree - Family tree instance.
 * @param {Function} props.setFocusId - Person focus ID setter.
 * @param {Function} props.onFilterBy - Filter dispatcher.
 * @param {Function} [props.centerOnPerson] - Center canvas on person callback.
 * @returns {React.ReactElement}
 *
 * @example
 * <SidebarMainPanels aiProps={{}} showLogs={false} showAI={false} logs={[]} isLoading={false} setShowLogs={() => {}} activeFilter={null} filteredProps={{}} focusPerson={null} tree={tree} setFocusId={() => {}} onFilterBy={() => {}} />
 *
 * @example
 * <SidebarMainPanels aiProps={{}} showLogs={true} showAI={false} logs={[{ text: 'loaded' }]} isLoading={false} setShowLogs={() => {}} activeFilter={null} filteredProps={{}} focusPerson={null} tree={tree} setFocusId={() => {}} onFilterBy={() => {}} />
 */
const SidebarMainPanels = ({
    aiProps, showLogs, showAI, logs, isLoading, setShowLogs,
    activeFilter, filteredProps, focusPerson, tree, setFocusId, onFilterBy, centerOnPerson
}) => (
    <>
        <AIAssistant {...aiProps} />
        {showLogs && !showAI && <SidebarLogsView logs={logs} isLoading={isLoading} setShowLogs={setShowLogs} />}
        {activeFilter && activeFilter.filterType !== 'directory' && !showLogs && !showAI && (
            <FilteredListView {...filteredProps} />
        )}
        {focusPerson && (!activeFilter || activeFilter.filterType === 'directory') && !showLogs && !showAI && (
            <SidebarPersonDetails focusPerson={focusPerson} tree={tree} setFocusId={setFocusId} onFilterBy={onFilterBy} centerOnPerson={centerOnPerson} />
        )}
    </>
);

/**
 * Collapsible side panel orchestrating detail views for persons, attribute directories,
 * active filters, system logs, and the AI Assistant.
 *
 * @param {object} props
 * @param {object} [props.focusPerson] - Currently selected person node
 * @param {object} [props.activeFilter] - Active filter state { filterType, value, tab }
 * @param {Function} props.onFilterBy - Callback to set active filter
 * @param {object} props.tree - FamilyTree data model
 * @param {Function} props.setFocusId - State setter to select a person ID
 * @param {boolean} props.isVisible - Whether the sidebar is currently open/visible
 * @param {number} [props.sidebarWidth=360] - Width of sidebar in pixels
 * @param {Function} props.onResizeStart - Pointer down handler to initiate sidebar resizing
 * @param {boolean} [props.isResizing=false] - Whether a resize drag operation is active
 * @param {boolean} props.showLogs - Whether system logs view is active
 * @param {Function} props.setShowLogs - State setter for logs view visibility
 * @param {Array<object>} props.logs - System log messages
 * @param {boolean} props.isLoading - Whether tree or network operations are loading
 * @param {boolean} props.showAI - Whether AI Assistant panel is active
 * @param {Function} props.setShowAI - State setter for AI Assistant panel visibility
 * @param {boolean} props.isAILoading - Whether AI queries are loading
 * @param {Function} props.setIsAILoading - State setter for AI loading state
 * @param {Function} props.onAiProfilesResponded - Callback when AI returns profiles
 * @param {string} props.pendingAiQuery - Pending query string for AI Assistant
 * @param {Function} props.setPendingAiQuery - Setter for pending AI query
 * @param {boolean} props.showMap - Whether map view is active
 * @param {Function} props.setShowMap - State setter for map view
 * @param {number} props.omniSelectedIndex - Keyboard selection index in filtered list
 * @param {Function} props.setOmniSelectedIndex - Setter for keyboard selection index
 * @param {Function} [props.centerOnPerson] - Callback to center canvas on person
 * @returns {React.ReactNode}
 *
 * @example
 * <PersonSidebar
 *   focusPerson={currentPerson}
 *   tree={tree}
 *   setFocusId={setFocusId}
 *   isVisible={isSidebarVisible}
 *   showLogs={showLogs}
 *   setShowLogs={setShowLogs}
 * />
 *
 * @example
 * <PersonSidebar
 *   activeFilter={{ filterType: 'directory', tab: 'place' }}
 *   tree={tree}
 *   onFilterBy={handleFilterBy}
 *   isVisible={true}
 *   showMap={true}
 * />
 */
const PersonSidebar = ({ 
    focusPerson, activeFilter, onFilterBy, tree, setFocusId, isVisible, sidebarWidth = 360,
    onResizeStart, isResizing = false, showLogs, setShowLogs, logs, isLoading, showAI, setShowAI,
    isAILoading, setIsAILoading, onAiProfilesResponded, pendingAiQuery, setPendingAiQuery,
    showMap, setShowMap, omniSelectedIndex, setOmniSelectedIndex, centerOnPerson
}) => {
    const isDirectoryMode = (activeFilter?.filterType === 'directory') || (!focusPerson && !activeFilter && showMap);
    if (!focusPerson && !activeFilter && !showLogs && !showAI && !isDirectoryMode) return null;

    const aiProps = { isOpen: showAI, setIsOpen: setShowAI, tree, handleSetFocusId: setFocusId, isLoading: isAILoading, setIsLoading: setIsAILoading, onAiProfilesResponded, pendingAiQuery, setPendingAiQuery };
    const filteredProps = { activeFilter, tree, setFocusId, onFilterBy, setShowMap, setShowAI, setShowLogs, setPendingAiQuery, omniSelectedIndex, setOmniSelectedIndex };

    return (
        <div 
            className={`bg-white border-l border-slate-200 shadow-2xl flex flex-col z-40 sidebar-scroll relative shrink-0 overflow-hidden ${isResizing ? 'transition-none' : 'transition-all duration-300 ease-in-out'} ${isVisible ? 'opacity-100' : 'w-0 border-none opacity-0 pointer-events-none'}`}
            style={{ width: isVisible ? `${sidebarWidth}px` : 0 }}
        >
            {isVisible && <SidebarResizeHandle onResizeStart={onResizeStart} />}
            <SidebarMainPanels
                aiProps={aiProps} showLogs={showLogs} showAI={showAI} logs={logs} isLoading={isLoading}
                setShowLogs={setShowLogs} activeFilter={activeFilter} filteredProps={filteredProps}
                focusPerson={focusPerson} tree={tree} setFocusId={setFocusId} onFilterBy={onFilterBy} centerOnPerson={centerOnPerson}
            />
            {isDirectoryMode && !focusPerson && !showLogs && !showAI && (
                <QuickDirectorySelector
                    tree={tree}
                    activeFilter={activeFilter}
                    onFilterBy={onFilterBy}
                    showMap={showMap}
                    inSidebar={true}
                    initialTab={activeFilter?.tab || 'place'}
                />
            )}
        </div>
    );
};