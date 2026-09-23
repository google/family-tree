// ============================================================================
// MODULE 6: UI COMPONENTS (Presentational & Interactive)
// ============================================================================

/**
 * Resolves CSS theme classes (card background/border, date badge background, job text color)
 * based on person's gender.
 *
 * @param {string} [gender] - Gender code ('M', 'F', or undefined/other)
 * @returns {{ bgClass: string, dateBg: string, jobColor: string }}
 *
 * @example
 * getPersonCardTheme('M')
 * // => { bgClass: 'bg-sky-100 border-sky-300 text-sky-950', dateBg: 'bg-sky-200/80 text-sky-900', jobColor: 'text-sky-800' }
 *
 * @example
 * getPersonCardTheme('F')
 * // => { bgClass: 'bg-rose-100 border-rose-300 text-rose-950', dateBg: 'bg-rose-200/80 text-rose-900', jobColor: 'text-rose-800' }
 */
function getPersonCardTheme(gender) {
    if (gender === 'M') {
        return {
            bgClass: 'bg-sky-100 border-sky-300 text-sky-950',
            dateBg: 'bg-sky-200/80 text-sky-900',
            jobColor: 'text-sky-800'
        };
    }
    if (gender === 'F') {
        return {
            bgClass: 'bg-rose-100 border-rose-300 text-rose-950',
            dateBg: 'bg-rose-200/80 text-rose-900',
            jobColor: 'text-rose-800'
        };
    }
    return {
        bgClass: 'bg-slate-100 border-slate-300 text-slate-900',
        dateBg: 'bg-slate-300/50 text-slate-800',
        jobColor: 'text-slate-700'
    };
}

/**
 * Renders the birth/death date pill badge on a person card with deduced styling and tooltips.
 *
 * @param {Object} props
 * @param {Object} props.person - The person node instance
 * @param {string} props.dateBg - CSS background class for the date badge
 * @returns {React.ReactNode|null}
 *
 * @example
 * <PersonCardDateBadge person={person} dateBg="bg-sky-200/80 text-sky-900" />
 *
 * @example
 * <PersonCardDateBadge person={femaleNode} dateBg="bg-rose-200/80 text-rose-900" />
 */
const PersonCardDateBadge = React.memo(({ person, dateBg }) => {
    if (!person || (!person.yob && !person._inferredYob && !person.death)) return null;

    const cardInfo = typeof person.getCardDateString === 'function'
        ? person.getCardDateString()
        : null;
    const cardText = cardInfo?.cardText;
    if (!cardText) return null;

    return (
        <p
            className={`text-[9px] mt-1 font-semibold px-1 py-0.5 rounded shrink-0 border border-black/5 ${dateBg} ${cardInfo.isDeduced ? 'italic opacity-90' : ''}`}
            title={cardInfo.titleText}
        >
            {cardText}
        </p>
    );
});

/**
 * Collapse/expand toggle button anchored to the bottom border of a parent person card.
 *
 * @param {Object} props
 * @param {string} props.personId - The ID of the person to toggle
 * @param {boolean} props.isCollapsed - Whether the person's subtree is currently collapsed
 * @param {Function} props.onToggle - Callback invoked with personId when clicked
 * @returns {React.ReactNode}
 *
 * @example
 * <PersonCollapseButton personId="P1" isCollapsed={false} onToggle={layout.toggleCollapse} />
 *
 * @example
 * <PersonCollapseButton personId="P2" isCollapsed={true} onToggle={handleSubtreeToggle} />
 */
const PersonCollapseButton = React.memo(({ personId, isCollapsed, onToggle }) => (
    <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(personId); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30 w-5 h-5 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors shadow-sm cursor-pointer interactive-element"
        title={isCollapsed ? "Expand branch" : "Collapse branch"}
    >
        {isCollapsed ? <Icons.Plus /> : <Icons.Minus />}
    </button>
));

/**
 * Resolves the CSS highlight and ring classes for a person card based on focus, AI highlight, and filter match state.
 *
 * @param {Object} params
 * @param {boolean} params.isFocused - Whether the person is currently focused
 * @param {boolean} params.isAiHighlighted - Whether the person is highlighted by AI chat
 * @param {boolean} params.isFilterHighlighted - Whether the person matches the active directory/search filter
 * @param {string} [params.filterHighlightClass] - Custom highlight ring class for the filter match
 * @returns {string} Tailwind CSS class string
 *
 * @example
 * resolvePersonHighlightClasses({ isFocused: true, isAiHighlighted: false, isFilterHighlighted: false })
 * // => 'ring-2 ring-blue-600 !border-blue-600 shadow-lg scale-105 z-30'
 *
 * @example
 * resolvePersonHighlightClasses({ isFocused: false, isAiHighlighted: true, isFilterHighlighted: false })
 * // => 'ai-profile-highlight ring-4 ring-blue-500 !border-blue-600 shadow-2xl !z-30'
 */
function resolvePersonHighlightClasses({ isFocused, isAiHighlighted, isFilterHighlighted, filterHighlightClass }) {
    if (isFocused) {
        return 'ring-2 ring-blue-600 !border-blue-600 shadow-lg scale-105 z-30';
    }
    if (isAiHighlighted) {
        return 'ai-profile-highlight ring-4 ring-blue-500 !border-blue-600 shadow-2xl !z-30';
    }
    if (isFilterHighlighted) {
        return `filter-match-highlight ${filterHighlightClass || 'ring-2 ring-blue-500 !border-blue-500'} shadow-lg scale-105 z-20`;
    }
    return 'hover:shadow-lg hover:scale-[1.02]';
}

/**
 * Renders the pulsing ✦ badge when a person card is highlighted by AI context.
 *
 * @returns {React.ReactNode} Pulsing AI highlight badge element
 *
 * @example
 * <PersonAiBadge />
 *
 * @example
 * {isAiHighlighted && <PersonAiBadge />}
 */
const PersonAiBadge = React.memo(() => (
    <span className="absolute -top-2.5 -right-2 flex h-5 w-5 z-30 pointer-events-none">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-5 w-5 bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-white items-center justify-center text-[9px] text-white font-black shadow-md">✦</span>
    </span>
));

/**
 * Renders an indicator badge in the top-left corner of a person card when
 * unexpanded family lineage exists for this person.
 *
 * @returns {React.ReactNode} Lineage indicator badge icon
 *
 * @example
 * <PersonHiddenLineageBadge />
 *
 * @example
 * {hasHiddenLineage && <PersonHiddenLineageBadge />}
 */
const PersonHiddenLineageBadge = React.memo(() => (
    <div className="absolute top-1 left-1 text-blue-600 bg-blue-100/90 border border-blue-200 p-[3px] rounded-md z-20 shadow-sm" title="Family lineage available. Click to view.">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V10"/><path d="M12 10 4 2"/><path d="M12 10l8-8"/><path d="M4 6V2h4"/><path d="M20 6V2h-4"/></svg>
    </div>
));

/**
 * Renders textual profile details (name, date badge, job, nickname, and location) inside a person node card.
 *
 * @param {object} props - Component properties.
 * @param {object} props.person - Person data record.
 * @param {string} props.dateBg - Tailwind background class for date badge.
 * @param {string} props.jobColor - Tailwind text color class for occupation label.
 * @returns {React.ReactElement} Bio details elements.
 *
 * @example
 * <PersonBioDetails person={samplePerson} dateBg="bg-blue-100" jobColor="text-blue-700" />
 *
 * @example
 * <PersonBioDetails person={{ name: 'John', _isUnknown: false }} dateBg="bg-slate-100" jobColor="text-slate-600" />
 */
const PersonBioDetails = React.memo(({ person, dateBg, jobColor }) => {
    const location = (person.place || person.location || '').trim();
    const hasLocation = Boolean(location && (typeof Person === 'undefined' || !Person.isInvalidLocation || !Person.isInvalidLocation(location)));

    return (
        <>
            <h3 className={`font-bold text-[11px] leading-[1.1] break-words w-full px-0.5 ${person._isUnknown ? 'italic opacity-60' : ''}`}>{person.name}</h3>
            <PersonCardDateBadge person={person} dateBg={dateBg} />
            {person.job && <p className={`text-[8.5px] font-medium leading-tight mt-1 shrink-0 break-words w-full ${jobColor}`}>{person.job}</p>}
            {!person.job && hasLocation && <p className="text-[8.5px] font-normal leading-tight mt-1 shrink-0 break-words w-full opacity-75" title={location}>{location}</p>}
            {person.nick && <p className="text-[8.5px] italic leading-tight mt-0.5 shrink-0 break-words w-full opacity-75">"{person.nick}"</p>}
            {person.job && !person.nick && hasLocation && <p className="text-[8.5px] font-normal leading-tight mt-0.5 shrink-0 break-words w-full opacity-75" title={location}>{location}</p>}
        </>
    );
});

/**
 * Interactive genealogical profile card component rendered inside the 2D tree canvas.
 * Displays person's name, deduced/known dates, occupations, nicknames, and branch collapse/expand triggers.
 *
 * @param {Object} props
 * @param {Object} props.person - The person node object to display
 * @param {boolean} [props.isPartner] - Whether this node is rendered as a spouse/partner
 * @param {Object} props.layout - Global layout config containing focusId, highlights, and callbacks
 * @param {boolean} [props.hasHiddenLineage] - Whether this person has an ancestor lineage that can be navigated
 * @param {boolean} [props.hasChildren] - Whether this person has biological/adopted children in the tree
 * @param {boolean} [props.isCollapsed] - Whether this person's descendant branch is currently folded
 * @returns {React.ReactNode|null}
 *
 * @example
 * <PersonNode
 *   person={personObj}
 *   isPartner={false}
 *   layout={{ focusId: 'P1', onFocus: (id) => {}, toggleCollapse: (id) => {} }}
 *   hasHiddenLineage={false}
 *   hasChildren={true}
 *   isCollapsed={false}
 * />
 *
 * @example
 * <PersonNode
 *   person={partnerObj}
 *   isPartner={true}
 *   layout={{ focusId: null, onFocus: fn, toggleCollapse: fn }}
 *   hasHiddenLineage={true}
 *   hasChildren={false}
 *   isCollapsed={false}
 * />
 */
const PersonNode = React.memo(({ person, isPartner, layout, hasHiddenLineage, hasChildren, isCollapsed }) => {
    if (!person) return null;
    const isFocused = layout.focusId === person.id;
    const isAiHighlighted = layout.aiHighlightedIds && layout.aiHighlightedIds.has(person.id);
    const isFilterHighlighted = Boolean(layout.filterHighlightedIds && layout.filterHighlightedIds.has(person.id));
    
    const { bgClass, dateBg, jobColor } = getPersonCardTheme(person.gender);
    const ghostStyles = person.isGhost ? '!border-dashed opacity-80 !shadow-none' : 'border-solid shadow-md';
    const highlightClasses = resolvePersonHighlightClasses({
        isFocused,
        isAiHighlighted,
        isFilterHighlighted,
        filterHighlightClass: layout.filterHighlightClass
    });

    return (
        <div 
            id={`node-${person.id}`}
            onClick={(e) => { e.stopPropagation(); layout.onFocus(person.id); }}
            className={`person-node whitespace-normal relative w-[90px] min-h-[76px] h-fit shrink-0 rounded-xl p-1.5 cursor-pointer transition-all duration-300 z-10 flex flex-col items-center justify-center text-center border-2 group
                ${highlightClasses}
                ${bgClass} ${ghostStyles}`}
        >
            {isAiHighlighted && <PersonAiBadge />}
            {hasHiddenLineage && <PersonHiddenLineageBadge />}
            <PersonBioDetails person={person} dateBg={dateBg} jobColor={jobColor} />
            {hasChildren && (
                <PersonCollapseButton 
                    personId={person.id} 
                    isCollapsed={isCollapsed} 
                    onToggle={layout.toggleCollapse} 
                />
            )}
        </div>
    );
});

// ============================================================================
// HIERARCHICAL 2D TREE LAYOUT ENGINE (Interval Profile Contour Compaction)
// ============================================================================

const TREE_NODE_WIDTH = 90;
const TREE_NODE_HEIGHT = 76;
const TREE_PARTNER_GAP = 10;
const TREE_PARTNER_TOTAL = TREE_NODE_WIDTH + TREE_PARTNER_GAP;
const TREE_SIBLING_GAP = 24;

/**
 * Centralized design tokens and layout geometry metrics for the genealogical tree visualization.
 */
const UI_THEME_METRICS = Object.freeze({
    nodeWidth: TREE_NODE_WIDTH,
    nodeHeight: TREE_NODE_HEIGHT,
    partnerGap: TREE_PARTNER_GAP,
    partnerTotal: TREE_PARTNER_TOTAL,
    siblingGap: TREE_SIBLING_GAP,
    cardPad: 10,
    timelineWidth: 48,
});
FamilyTree.UI_THEME_METRICS = UI_THEME_METRICS;
FamilyTreeBuilder.UI_THEME_METRICS = UI_THEME_METRICS;
FamilyTree.PersonBioDetails = PersonBioDetails;
if (typeof window !== 'undefined') {
    window.PersonBioDetails = PersonBioDetails;
}