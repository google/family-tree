
/**
 * Theme style mappings for OmniActionCard shortcut items.
 * Maps theme color keys ('blue', 'emerald', 'amber') to their selected and hover Tailwind classes.
 *
 * @type {Record<string, {
 *   card: string, cardSelected: string,
 *   icon: string, iconSelected: string,
 *   title: string, titleSelected: string,
 *   badge: string, badgeSelected: string
 * }>}
 */
const OMNI_ACTION_THEMES = {
    blue: {
        card: 'hover:bg-blue-50/80 hover:border-blue-200',
        cardSelected: 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/80 shadow-xs',
        icon: 'bg-slate-200 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors',
        iconSelected: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs',
        title: 'text-slate-700 group-hover:text-blue-900',
        titleSelected: 'text-blue-950 font-bold',
        badge: 'text-slate-500 bg-white border border-slate-200 group-hover:text-blue-700 group-hover:bg-blue-100 group-hover:border-blue-200',
        badgeSelected: 'bg-blue-600 text-white shadow-2xs'
    },
    emerald: {
        card: 'hover:bg-emerald-50/80 hover:border-emerald-200',
        cardSelected: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/80 shadow-xs',
        icon: 'bg-slate-200 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors',
        iconSelected: 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-xs',
        title: 'text-slate-700 group-hover:text-emerald-900',
        titleSelected: 'text-emerald-950 font-bold',
        badge: 'text-slate-500 bg-white border border-slate-200 group-hover:text-emerald-700 group-hover:bg-emerald-100 group-hover:border-emerald-200',
        badgeSelected: 'bg-emerald-600 text-white shadow-2xs'
    },
    amber: {
        card: 'hover:bg-amber-50/80 hover:border-amber-200',
        cardSelected: 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/80 shadow-xs',
        icon: 'bg-slate-200 text-slate-700 group-hover:bg-amber-600 group-hover:text-white transition-colors',
        iconSelected: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white shadow-xs',
        title: 'text-slate-700 group-hover:text-amber-900',
        titleSelected: 'text-amber-950 font-bold',
        badge: 'text-slate-500 bg-white border border-slate-200 group-hover:text-amber-700 group-hover:bg-amber-100 group-hover:border-amber-200',
        badgeSelected: 'bg-amber-600 text-white shadow-2xs'
    }
};

/**
 * Renders the leading icon and title container for an omni quick-action button card.
 *
 * @param {object} props
 * @param {React.ReactNode} props.icon - Graphic icon element
 * @param {string} props.title - Action title text
 * @param {boolean} props.isSelected - Whether card is highlighted
 * @param {object} props.theme - Color theme classes configuration object
 * @returns {React.ReactNode} Rendered action card content
 *
 * @example
 * <OmniActionCardContent icon="✨" title="Ask AI" isSelected={true} theme={OMNI_ACTION_THEMES.blue} />
 *
 * @example
 * <OmniActionCardContent icon="📍" title="Show Map" isSelected={false} theme={OMNI_ACTION_THEMES.emerald} />
 */
const OmniActionCardContent = ({ icon, title, isSelected, theme }) => (
    <div className="flex items-center gap-2 min-w-0">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] ${
            isSelected ? theme.iconSelected : theme.icon
        }`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className={`text-xs font-semibold truncate ${
                isSelected ? theme.titleSelected : theme.title
            }`}>
                {title}
            </div>
        </div>
    </div>
);

/**
 * Renders the trailing action label or enter key indicator badge for an omni action card.
 *
 * @param {object} props
 * @param {string} props.actionLabel - Default action text (e.g. 'Ask AI →')
 * @param {boolean} props.isSelected - Whether card is highlighted
 * @param {object} props.theme - Color theme classes configuration object
 * @returns {React.ReactNode} Rendered action card badge
 *
 * @example
 * <OmniActionCardBadge actionLabel="Ask AI →" isSelected={true} theme={OMNI_ACTION_THEMES.blue} />
 *
 * @example
 * <OmniActionCardBadge actionLabel="Explore →" isSelected={false} theme={OMNI_ACTION_THEMES.emerald} />
 */
const OmniActionCardBadge = ({ actionLabel, isSelected, theme }) => (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 transition-colors ${
        isSelected ? theme.badgeSelected : theme.badge
    }`}>
        {isSelected ? '↵ Enter' : actionLabel}
    </span>
);

/**
 * Reusable omnibar shortcut action button card with theme styling and keyboard selection badge.
 *
 * @param {Object} props
 * @param {string} props.id - DOM element id for keyboard navigation scroll targeting
 * @param {'blue'|'emerald'|'amber'} [props.theme='blue'] - Color theme for hover and selection states
 * @param {boolean} props.isSelected - Whether this action is currently selected in the omnibar
 * @param {React.ReactNode} props.icon - Action icon component or emoji string
 * @param {string} props.title - Action label text
 * @param {string} props.actionLabel - Default badge text when unselected (e.g. 'Ask AI →')
 * @param {Function} props.onHover - Mouse enter handler
 * @param {Function} props.onClick - Click handler
 * @returns {React.ReactNode}
 *
 * @example
 *   <OmniActionCard
 *     id="omni-item-shortcut-ai"
 *     theme="blue"
 *     isSelected={true}
 *     icon={<Icons.Sparkles />}
 *     title='Ask AI Assistant: "John"'
 *     actionLabel="Ask AI →"
 *     onHover={() => handleItemHover(0)}
 *     onClick={() => setShowAI(true)}
 *   />
 *
 * @example
 *   <OmniActionCard
 *     id="omni-item-dir"
 *     theme="purple"
 *     isSelected={false}
 *     title="Explore Directory"
 *     onClick={openDirectory}
 *   />
 */
const OmniActionCard = ({
    id,
    theme = 'blue',
    isSelected,
    icon,
    title,
    actionLabel,
    onHover,
    onClick
}) => {
    const t = OMNI_ACTION_THEMES[theme] || OMNI_ACTION_THEMES.blue;
    return (
        <button
            key={id}
            id={id}
            type="button"
            onMouseEnter={onHover}
            onClick={onClick}
            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all group text-left ${
                isSelected
                    ? t.cardSelected
                    : `bg-slate-50/90 border border-slate-200 shadow-2xs ${t.card}`
            }`}
        >
            <OmniActionCardContent icon={icon} title={title} isSelected={isSelected} theme={t} />
            <OmniActionCardBadge actionLabel={actionLabel} isSelected={isSelected} theme={t} />
        </button>
    );
};

/**
 * Quick action card routing the current search query directly to the AI Assistant.
 *
 * @param {object} props
 * @param {string} props.value - Current query string
 * @param {boolean} props.isSelected - Whether item is keyboard-focused
 * @param {Function} props.onHover - Hover handler callback
 * @param {Function} props.setPendingAiQuery - Sets pending AI assistant question
 * @param {Function} props.setShowAI - Toggles AI assistant drawer
 * @param {Function} props.setShowMap - Toggles map view
 * @param {Function} props.setShowLogs - Toggles logs drawer
 * @returns {React.ReactNode}
 *
 * @example
 * <OmniAiAction value="Who was born in 1920?" isSelected={true} onHover={() => {}} setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}} setPendingAiQuery={() => {}} />
 *
 * @example
 * <OmniAiAction value="Doctors in family" isSelected={false} onHover={() => {}} setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}} setPendingAiQuery={() => {}} />
 */
const OmniAiAction = ({
    value,
    isSelected,
    onHover,
    setPendingAiQuery,
    setShowAI,
    setShowMap,
    setShowLogs
}) => (
    <OmniActionCard
        id="omni-item-shortcut-ai"
        theme="blue"
        isSelected={isSelected}
        icon={<Icons.Sparkles />}
        title={`Ask AI Assistant: "${value}"`}
        actionLabel="Ask AI →"
        onHover={onHover}
        onClick={() => {
            if (typeof setPendingAiQuery === 'function') {
                setPendingAiQuery(value);
            }
            if (typeof setShowAI === 'function') setShowAI(true);
            if (typeof setShowMap === 'function') setShowMap(false);
            if (typeof setShowLogs === 'function') setShowLogs(false);
        }}
    />
);

/**
 * Quick action card switching to map exploration for a matched geographic place.
 *
 * @param {object} props
 * @param {string} props.matchedPlace - Matched place name
 * @param {boolean} props.isSelected - Whether item is keyboard-focused
 * @param {Function} props.onHover - Hover handler callback
 * @param {Function} props.setShowMap - Toggles map view
 * @param {Function} props.setShowAI - Toggles AI assistant drawer
 * @param {Function} props.setShowLogs - Toggles logs drawer
 * @param {Function} props.onFilterBy - Filter dispatcher callback
 * @returns {React.ReactNode}
 *
 * @example
 * <OmniPlaceAction matchedPlace="Kochi" isSelected={true} onHover={() => {}} setShowMap={() => {}} setShowAI={() => {}} setShowLogs={() => {}} onFilterBy={() => {}} />
 *
 * @example
 * <OmniPlaceAction matchedPlace="London" isSelected={false} onHover={() => {}} setShowMap={() => {}} setShowAI={() => {}} setShowLogs={() => {}} onFilterBy={() => {}} />
 */
const OmniPlaceAction = ({
    matchedPlace,
    isSelected,
    onHover,
    setShowMap,
    setShowAI,
    setShowLogs,
    onFilterBy
}) => (
    <OmniActionCard
        id={`omni-item-shortcut-loc-${matchedPlace}`}
        theme="emerald"
        isSelected={isSelected}
        icon={<Icons.MapPin />}
        title={`Explore "${matchedPlace}" on Map`}
        actionLabel="Map View →"
        onHover={onHover}
        onClick={() => {
            if (typeof setShowMap === 'function') setShowMap(true);
            if (typeof setShowAI === 'function') setShowAI(false);
            if (typeof setShowLogs === 'function') setShowLogs(false);
            if (typeof onFilterBy === 'function') onFilterBy('place', matchedPlace);
        }}
    />
);

/**
 * Quick action card filtering the tree by a matched occupation or career.
 *
 * @param {object} props
 * @param {string} props.matchedJob - Matched career or occupation name
 * @param {boolean} props.isSelected - Whether item is keyboard-focused
 * @param {Function} props.onHover - Hover handler callback
 * @param {Function} props.onFilterBy - Filter dispatcher callback
 * @returns {React.ReactNode}
 *
 * @example
 * <OmniJobAction matchedJob="Doctor" isSelected={true} onHover={() => {}} onFilterBy={() => {}} />
 *
 * @example
 * <OmniJobAction matchedJob="Engineer" isSelected={false} onHover={() => {}} onFilterBy={() => {}} />
 */
const OmniJobAction = ({
    matchedJob,
    isSelected,
    onHover,
    onFilterBy
}) => (
    <OmniActionCard
        id={`omni-item-shortcut-job-${matchedJob}`}
        theme="amber"
        isSelected={isSelected}
        icon="💼"
        title={`Filter Career: "${matchedJob}"`}
        actionLabel="Career →"
        onHover={onHover}
        onClick={() => {
            if (typeof onFilterBy === 'function') onFilterBy('job', matchedJob);
        }}
    />
);

/**
 * Resolves the array indices of specialized omni action items (AI prompt, location, job) within search items.
 *
 * @param {Array<object>} searchItems - Array of omni search result items
 * @returns {{ aiIdx: number, locIdx: number, jobIdx: number }} Map of action item indices
 *
 * @example
 * const indices = resolveOmniActionIndices([{ type: 'ai' }, { type: 'location' }]);
 *
 * @example
 * const emptyIndices = resolveOmniActionIndices([]);
 */
function resolveOmniActionIndices(searchItems) {
    return {
        aiIdx: searchItems.findIndex(it => it.type === 'ai'),
        locIdx: searchItems.findIndex(it => it.type === 'location'),
        jobIdx: searchItems.findIndex(it => it.type === 'job')
    };
}

/**
 * Renders quick action cards at the top of omnibar search results for switching to
 * AI Assistant, viewing a detected location on map, or filtering by career.
 *
 * @param {object} props
 * @param {string} props.filterType - Current filter type ('search', etc.)
 * @param {string} props.value - Active omnibar search query
 * @param {string} props.normValue - Lowercase trimmed query string
 * @param {number} props.effectiveSelectedIndex - Keyboard selected item index
 * @param {Array<object>} props.searchItems - Omnibar search items list
 * @param {Function} props.handleItemHover - Mouse enter index selector
 * @param {Function} props.setPendingAiQuery - Sets AI assistant prompt
 * @param {Function} props.setShowAI - Toggles AI assistant drawer
 * @param {Function} props.setShowMap - Toggles map view
 * @param {Function} props.setShowLogs - Toggles logs drawer
 * @param {Function} props.onFilterBy - Navigation filter callback
 * @param {string|null} props.matchedPlace - Closest matched place name
 * @param {string|null} props.matchedJob - Closest matched career name
 * @returns {React.ReactNode}
 *
 * @example
 * <OmniQuickActions
 *   filterType="search"
 *   value="Kochi"
 *   normValue="kochi"
 *   effectiveSelectedIndex={0}
 *   searchItems={[{ id: 'shortcut-ai', type: 'ai' }]}
 *   handleItemHover={idx => setOmniSelectedIndex(idx)}
 *   setPendingAiQuery={() => {}}
 *   setShowAI={() => {}}
 *   setShowMap={() => {}}
 *   setShowLogs={() => {}}
 *   onFilterBy={() => {}}
 *   matchedPlace="Kochi"
 *   matchedJob={null}
 * />
 *
 * @example
 * <OmniQuickActions
 *   filterType="place"
 *   value="Kerala"
 *   normValue="kerala"
 *   effectiveSelectedIndex={0}
 *   searchItems={[]}
 *   handleItemHover={() => {}}
 *   setPendingAiQuery={() => {}}
 *   setShowAI={() => {}}
 *   setShowMap={() => {}}
 *   setShowLogs={() => {}}
 *   onFilterBy={() => {}}
 *   matchedPlace={null}
 *   matchedJob={null}
 * />
 */
/**
 * Renders secondary quick actions (place and career directory filters) for matching omni queries.
 *
 * @param {Object} props
 * @param {Object} [props.matchedPlace] - Matching geographical place object if detected
 * @param {string} [props.matchedJob] - Matching career occupation title if detected
 * @param {string} props.normValue - Normalized query string
 * @param {number} props.effectiveSelectedIndex - Current keyboard highlighted item index
 * @param {number} props.locIdx - Location action item index
 * @param {number} props.jobIdx - Job action item index
 * @param {Function} props.handleItemHover - Hover index handler
 * @param {Function} props.onFilterBy - Filter selection dispatcher
 * @param {Object} props.viewProps - View state toggles (setShowAI, setShowMap, setShowLogs)
 * @returns {React.ReactNode}
 *
 * @example
 * <OmniSecondaryActions
 *     matchedPlace={{ name: 'Kerala' }} matchedJob="Doctor" normValue="doc"
 *     effectiveSelectedIndex={1} locIdx={1} jobIdx={2}
 *     handleItemHover={() => {}} onFilterBy={() => {}} viewProps={{}}
 * />
 *
 * @example
 * <OmniSecondaryActions
 *     matchedPlace={null} matchedJob={null} normValue=""
 *     effectiveSelectedIndex={-1} locIdx={-1} jobIdx={-1}
 *     handleItemHover={() => {}} onFilterBy={() => {}} viewProps={{}}
 * />
 */
const OmniSecondaryActions = ({
    matchedPlace, matchedJob, normValue, effectiveSelectedIndex,
    locIdx, jobIdx, handleItemHover, onFilterBy, viewProps
}) => (
    <>
        {matchedPlace && (
            <OmniPlaceAction
                matchedPlace={matchedPlace} isSelected={effectiveSelectedIndex === locIdx}
                onHover={() => handleItemHover(locIdx)} onFilterBy={onFilterBy}
                {...viewProps}
            />
        )}
        {matchedJob && matchedJob.toLowerCase() !== normValue && (
            <OmniJobAction
                matchedJob={matchedJob} isSelected={effectiveSelectedIndex === jobIdx}
                onHover={() => handleItemHover(jobIdx)} onFilterBy={onFilterBy}
            />
        )}
    </>
);
/**
 * Renders omni-search quick actions for AI query shortcuts, location filters, and occupation filters.
 *
 * @param {Object} props
 * @param {string} props.filterType - Active filter type ('search', 'place', etc.)
 * @param {string} props.value - Raw search query string
 * @param {string} props.normValue - Normalized lowercase search query
 * @param {number} props.effectiveSelectedIndex - Currently highlighted item index
 * @param {Array<Object>} props.searchItems - List of omni search items
 * @param {Function} props.handleItemHover - Hover callback for updating selected index
 * @param {Function} props.setPendingAiQuery - Callback to stage query in AI assistant
 * @param {Function} props.setShowAI - Callback to toggle AI assistant panel
 * @param {Function} props.setShowMap - Callback to toggle map view
 * @param {Function} props.setShowLogs - Callback to toggle log panel
 * @param {Function} props.onFilterBy - Callback to activate directory filter
 * @param {Object|null} props.matchedPlace - Matched place object if detected
 * @param {string|null} props.matchedJob - Matched occupation name if detected
 * @returns {React.ReactNode|null}
 *
 * @example
 * <OmniQuickActions
 *   filterType="search" value="Kochi" normValue="kochi"
 *   effectiveSelectedIndex={0} searchItems={[{ id: 'shortcut-ai', type: 'ai' }]}
 *   handleItemHover={() => {}} setPendingAiQuery={() => {}}
 *   setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}}
 *   onFilterBy={() => {}} matchedPlace="Kochi" matchedJob={null}
 * />
 *
 * @example
 * <OmniQuickActions
 *   filterType="place" value="Kerala" normValue="kerala"
 *   effectiveSelectedIndex={0} searchItems={[]}
 *   handleItemHover={() => {}} setPendingAiQuery={() => {}}
 *   setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}}
 *   onFilterBy={() => {}} matchedPlace={null} matchedJob={null}
 * />
 */
const OmniQuickActions = ({
    filterType, value, normValue, effectiveSelectedIndex, searchItems,
    handleItemHover, setPendingAiQuery, setShowAI, setShowMap, setShowLogs,
    onFilterBy, matchedPlace, matchedJob
}) => {
    if (filterType !== 'search' || !value) return null;

    const { aiIdx, locIdx, jobIdx } = resolveOmniActionIndices(searchItems);
    const viewProps = { setShowAI, setShowMap, setShowLogs };

    return (
        <div className="flex flex-col gap-1.5 mb-4">
            <OmniAiAction
                value={value} isSelected={effectiveSelectedIndex === aiIdx}
                onHover={() => handleItemHover(aiIdx)} setPendingAiQuery={setPendingAiQuery}
                {...viewProps}
            />
            <OmniSecondaryActions
                matchedPlace={matchedPlace} matchedJob={matchedJob} normValue={normValue}
                effectiveSelectedIndex={effectiveSelectedIndex} locIdx={locIdx} jobIdx={jobIdx}
                handleItemHover={handleItemHover} onFilterBy={onFilterBy} viewProps={viewProps}
            />
        </div>
    );
};

/**
 * Resolves sorted non-empty names of a person's children ordered chronologically by birth year.
 *
 * @param {Person} person - Parent person node
 * @param {FamilyTree} tree - Tree instance for resolving children nodes
 * @returns {string[]} Sorted child names
 *
 * @example
 * getSortedChildrenNames(parent, tree);
 * // => ['Alice', 'Bob', 'Charlie']
 *
 * @example
 * getSortedChildrenNames(null, tree);
 * // => []
 */
function getSortedChildrenNames(person, tree) {
    if (!person?.children || person.children.length === 0 || !tree) return [];
    return [...person.children]
        .sort((a, b) => (tree.get(a)?.bestYob || 0) - (tree.get(b)?.bestYob || 0))
        .map(cId => tree.get(cId)?.name)
        .filter(Boolean);
}

/**
 * Formats a concise summary string of child names with overflow indicator (+N).
 *
 * @param {string[]} childrenNames - List of child names
 * @param {number} [maxVisible=3] - Maximum number of names to display before truncating
 * @returns {string} Formatted preview string
 *
 * @example
 * formatChildrenSummary(['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'], 3);
 * // => 'Alice, Bob, Charlie +2'
 *
 * @example
 * formatChildrenSummary(['Alice', 'Bob'], 3);
 * // => 'Alice, Bob'
 */
function formatChildrenSummary(childrenNames, maxVisible = 3) {
    if (!childrenNames || childrenNames.length === 0) return '';
    const visible = childrenNames.slice(0, maxVisible).join(', ');
    const remainder = childrenNames.length - maxVisible;
    return remainder > 0 ? `${visible} +${remainder}` : visible;
}