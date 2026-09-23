
/**
 * Renders an individual person card item in the filtered list or omnibar search results.
 *
 * @param {object} props
 * @param {Person} props.p - The Person instance to render
 * @param {FamilyTree} props.tree - Populated tree instance for looking up partners/children
 * @param {boolean} props.isSelected - Whether this item is keyboard-navigated in omnibar
 * @param {number} props.personItemIdx - Index in search items list
 * @param {Function} props.handleItemHover - Hover callback for keyboard selection index
 * @param {Function} props.setFocusId - Callback to select and focus person
 * @param {string} props.filterType - Active filter type ('search', 'place', 'job', etc.)
 * @returns {React.ReactNode}
/**
 * Renders filtered person metadata badges including family name, occupation, and location.
 *
 * @param {object} props
 * @param {Person} props.p - Person node
 * @param {string} props.filterType - Currently active filter type
 * @returns {React.ReactNode}
 *
 * @example
 * <FilteredPersonMeta p={personNode} filterType="place" />
 *
 * @example
 * <FilteredPersonMeta p={personNode} filterType="job" />
 */
const FilteredPersonMeta = ({ p, filterType }) => (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-slate-500">
        {filterType !== 'family' && p.family && (
            <span className="font-medium text-slate-600 truncate max-w-[120px]">{p.family}</span>
        )}
        {filterType !== 'job' && p.job && (
            <span className="text-slate-500 truncate max-w-[140px]">{p.job}</span>
        )}
        {filterType !== 'place' && p.place && (
            <span className="text-slate-500 flex items-center gap-0.5 truncate max-w-[140px]">
                <Icons.MapPin /> {p.place}
            </span>
        )}
    </div>
);

/**
 * Renders summary line of spouse and children for a filtered person item.
 *
 * @param {object} props
 * @param {string|null} props.partnerName - Partner name if present
 * @param {number} props.childrenCount - Number of children
 * @param {string[]} props.childrenNames - Sorted names of children
 * @returns {React.ReactNode|null}
 *
 * @example
 * <FilteredPersonRelations partnerName="Alice" childrenCount={2} childrenNames={['Bob', 'Charlie']} />
 *
 * @example
 * <FilteredPersonRelations partnerName={null} childrenCount={0} childrenNames={[]} />
 */
const FilteredPersonRelations = ({ partnerName, childrenCount, childrenNames }) => {
    if (!partnerName && childrenCount === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500 pt-1 border-t border-slate-50">
            {partnerName && (
                <div className="truncate max-w-[180px]">
                    <span className="text-slate-400">Spouse:</span>{' '}
                    <span className="text-slate-600 font-medium">{partnerName}</span>
                </div>
            )}
            {childrenCount > 0 && (
                <div className="truncate max-w-[200px]" title={childrenNames.join(', ')}>
                    <span className="text-slate-400">Children:</span>{' '}
                    <span className="text-slate-600 font-medium">{formatChildrenSummary(childrenNames, 3)}</span>
                </div>
            )}
        </div>
    );
};

/**
 * Renders the top title and date badge row for a filtered person list item card.
 *
 * @param {object} props
 * @param {Person} props.p - Person data object
 * @param {string} props.dateStr - Formatted lifespan or birth/death year string
 * @returns {React.ReactNode} Rendered person item header
 *
 * @example
 * <FilteredPersonHeader p={person} dateStr="1920 - 1995" />
 *
 * @example
 * <FilteredPersonHeader p={person} dateStr="" />
 */
const FilteredPersonHeader = ({ p, dateStr }) => (
    <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm group-hover:text-blue-600 truncate leading-snug">
            {p.gender === 'M' && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Male" />}
            {p.gender === 'F' && <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" title="Female" />}
            {p.gender !== 'M' && p.gender !== 'F' && <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" title="Unknown" />}
            <span className="truncate">{p.name}</span>
            {p.nick && <span className="font-normal italic text-slate-400 text-xs shrink-0">"{p.nick}"</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
            {dateStr && (
                <span className="text-[9px] font-mono text-slate-500 bg-slate-100 group-hover:bg-blue-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    {dateStr}
                </span>
            )}
        </div>
    </div>
);

/**
 * Derives display metadata (dates, first partner name, children count and names) for a filtered person item.
 *
 * @param {Person} p - Person model node
 * @param {FamilyTree} tree - Genealogy tree model
 * @returns {{ dateStr: string, partnerName: string|null, childrenCount: number, childrenNames: string }}
 *
 * @example
 * const details = deriveFilteredPersonDetails(person, tree);
 * console.log(details.childrenCount);
 *
 * @example
 * const { dateStr, partnerName } = deriveFilteredPersonDetails(person, tree);
 */
function deriveFilteredPersonDetails(p, tree) {
    const { dateStr } = p.getDateStrings();
    const partnerName = p.partners.length > 0 ? tree.get(p.partners[0])?.name : null;
    const childrenCount = p.children.length;
    const childrenNames = getSortedChildrenNames(p, tree);
    return { dateStr, partnerName, childrenCount, childrenNames };
}

/**
 * Renders a single person search result card in the omnibar / filtered list dropdown.
 *
 * @param {object} props
 * @param {Person} props.p - Person node
 * @param {FamilyTree} props.tree - FamilyTree data model
 * @param {boolean} props.isSelected - Whether item is currently keyboard-selected
 * @param {number} props.personItemIdx - Index in omni results
 * @param {Function} props.handleItemHover - Hover index updater
 * @param {Function} props.setFocusId - Callback to select and focus person
 * @param {string} props.filterType - Active filter type ('search', 'place', 'job', etc.)
 * @returns {React.ReactNode}
 *
 * @example
 * <FilteredPersonItem
 *   p={person}
 *   tree={tree}
 *   isSelected={true}
 *   personItemIdx={2}
 *   handleItemHover={idx => setOmniSelectedIndex(idx)}
 *   setFocusId={id => setFocus(id)}
 *   filterType="search"
 * />
 *
 * @example
 * <FilteredPersonItem
 *   p={anotherPerson}
 *   tree={tree}
 *   isSelected={false}
 *   personItemIdx={0}
 *   handleItemHover={() => {}}
 *   setFocusId={() => {}}
 *   filterType="place"
 * />
 */
const FilteredPersonItem = ({
    p, tree, isSelected, personItemIdx, handleItemHover, setFocusId, filterType
}) => {
    const details = deriveFilteredPersonDetails(p, tree);

    return (
        <div
            key={p.id}
            id={`omni-item-person-${p.id}`}
            onMouseEnter={() => handleItemHover(personItemIdx)}
            onClick={() => setFocusId(p.id)}
            className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all group interactive-element ${
                isSelected
                    ? 'bg-blue-50/50 border border-blue-300 ring-2 ring-blue-400/60 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 shadow-2xs'
            }`}
            title={`Click to view ${p.name}`}
        >
            <div className="flex-1 min-w-0">
                <FilteredPersonHeader p={p} dateStr={details.dateStr} />
                <FilteredPersonMeta p={p} filterType={filterType} />
                <FilteredPersonRelations
                    partnerName={details.partnerName}
                    childrenCount={details.childrenCount}
                    childrenNames={details.childrenNames}
                />
            </div>
        </div>
    );
};

/**
 * Scrolls an omnibar search item comfortably into view within the scroll container,
 * accounting for floating search bar clearance and bottom padding.
 *
 * @param {HTMLElement|null} container - The list container element
 * @param {string} itemId - The ID of the item to scroll to (prefixed by 'omni-item-')
 *
 * @example
 * scrollOmniItemIntoView(containerRef.current, 'person-p1');
 *
 * @example
 * scrollOmniItemIntoView(null, 'shortcut-ai');
 */
function scrollOmniItemIntoView(container, itemId) {
    if (!container || !itemId) return;
    const el = document.getElementById(`omni-item-${itemId}`);
    if (!el) return;

    const topBarHeight = 140; // Clearance for floating search bar
    const bottomPadding = 40;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;

    const visibleTop = container.scrollTop + topBarHeight;
    const visibleBottom = container.scrollTop + container.clientHeight - bottomPadding;

    if (elTop < visibleTop) {
        // Scrolling up: ensure element is comfortably below the search bar
        container.scrollTo({
            top: Math.max(0, elTop - topBarHeight - 12),
            behavior: 'smooth'
        });
    } else if (elBottom > visibleBottom) {
        // Scrolling down: ensure element is within visible bottom
        container.scrollTo({
            top: elBottom - container.clientHeight + bottomPadding + 12,
            behavior: 'smooth'
        });
    }
}

/**
 * Renders the top header banner and back button for category/directory filtered lists.
 *
 * @param {Object} props
 * @param {Function} props.onFilterBy - Callback to switch filter mode
 * @param {string} props.filterType - Active filter type ('place', 'job', etc.)
 * @param {Object} props.titleInfo - Badge color, icon, and label metadata
 * @param {string} props.value - Active filter value title
 * @param {number} props.count - Number of matching profiles
 * @returns {React.ReactNode}
 * @example
 * <FilteredListHeader onFilterBy={onFilterBy} filterType="place" titleInfo={info} value="Thrissur" count={12} />
 *
 * @example
 * <FilteredListHeader onFilterBy={onFilterBy} filterType="job" titleInfo={jobInfo} value="Engineer" count={3} />
 */
const FilteredListHeader = React.memo(({ onFilterBy, filterType, titleInfo, value, count }) => (
    <div className="mb-3">
        {['place', 'job', 'family'].includes(filterType) && (
            <button
                type="button"
                onClick={() => onFilterBy('directory', filterType)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer mb-2.5 group shadow-xs ${titleInfo.color}`}
                title={`Back to ${titleInfo.typeLabel}s Directory`}
            >
                <span className="opacity-70 group-hover:opacity-100">←</span>
                {titleInfo.icon}
                <span>{titleInfo.directoryLabel || `All ${titleInfo.typeLabel}s`}</span>
            </button>
        )}
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2.5">
            <h2 className="text-lg font-bold text-slate-800 truncate leading-tight flex-1 min-w-0" title={value}>
                {value}
            </h2>
            <span className="text-xs font-medium text-slate-400 shrink-0 whitespace-nowrap">
                {count} {count === 1 ? 'person' : 'people'}
            </span>
        </div>
    </div>
));

/**
 * Renders the collection of filtered person cards or an empty state placeholder
 * when no profiles match the active query or filter criteria.
 *
 * @param {object} props
 * @param {Person[]} props.matchingPeople - Matching person records to display
 * @param {string} props.filterType - Active filter type ('search', 'place', 'job', etc.)
 * @param {string} props.value - Active filter search query
 * @param {string} props.typeLabel - Readable label of filter category (e.g. 'Location')
 * @param {Array<object>} props.searchItems - Unified list of omni search items
 * @param {number} props.effectiveSelectedIndex - Currently selected keyboard navigation index
 * @param {FamilyTree} props.tree - Populated family tree instance
 * @param {Function} props.handleItemHover - Hover handler for updating selected item index
 * @param {Function} props.setFocusId - Callback to select and focus a person
 * @returns {React.ReactNode}
 *
 * @example
 * <FilteredPeopleList
 *   matchingPeople={people}
 *   filterType="place"
 *   value="Thrissur"
 *   typeLabel="Location"
 *   searchItems={[]}
 *   effectiveSelectedIndex={0}
 *   tree={tree}
 *   handleItemHover={idx => {}}
 *   setFocusId={id => {}}
 * />
 *
 * @example
 * <FilteredPeopleList
 *   matchingPeople={[]}
 *   filterType="search"
 *   value="Unknown"
 *   typeLabel="Search"
 *   searchItems={[]}
 *   effectiveSelectedIndex={-1}
 *   tree={tree}
 *   handleItemHover={() => {}}
 *   setFocusId={() => {}}
 * />
 */
const FilteredPeopleList = ({
    matchingPeople, filterType, value, typeLabel,
    searchItems, effectiveSelectedIndex, tree, handleItemHover, setFocusId
}) => {
    if (matchingPeople.length === 0) {
        return (
            <div className="text-center py-10 text-slate-400 text-sm italic font-sans">
                No profiles found {filterType === 'search' ? `matching "${value}"` : `with this ${typeLabel.toLowerCase()}`}.
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {matchingPeople.map(p => {
                const idx = searchItems.findIndex(it => it.type === 'person' && it.person.id === p.id);
                return (
                    <FilteredPersonItem
                        key={p.id} p={p} tree={tree} filterType={filterType}
                        isSelected={filterType === 'search' && effectiveSelectedIndex === idx}
                        personItemIdx={idx} handleItemHover={handleItemHover} setFocusId={setFocusId}
                    />
                );
            })}
        </div>
    );
};

/**
 * Finds the first unique location from the tree that matches the search query.
 * Matches by case-insensitive substring inclusion in either direction.
 *
 * @param {FamilyTree} tree - The populated family tree instance
 * @param {string} normQuery - Lowercase trimmed query string
 * @returns {?string} Matched place name or null
 *
 * @example
 * findMatchingPlaceForQuery(tree, 'kochi');
 * // => 'Kochi'
 *
 * @example
 * findMatchingPlaceForQuery(tree, '');
 * // => null
 */
function findMatchingPlaceForQuery(tree, normQuery) {
    if (!tree?.all || !normQuery) return null;
    for (const p of tree.all) {
        if (!p.place) continue;
        const pl = p.place.trim();
        const lower = pl.toLowerCase();
        if (lower.includes(normQuery) || normQuery.includes(lower)) {
            return pl;
        }
    }
    return null;
}

/**
 * Finds the first unique career/job from the tree that matches the search query.
 * Matches by case-insensitive substring inclusion.
 *
 * @param {FamilyTree} tree - The populated family tree instance
 * @param {string} normQuery - Lowercase trimmed query string
 * @returns {?string} Matched career string or null
 *
 * @example
 * findMatchingJobForQuery(tree, 'doc');
 * // => 'Doctor'
 *
 * @example
 * findMatchingJobForQuery(tree, '');
 * // => null
 */
function findMatchingJobForQuery(tree, normQuery) {
    if (!tree?.all || !normQuery) return null;
    for (const p of tree.all) {
        if (!p.job) continue;
        const j = p.job.trim();
        if (j.toLowerCase().includes(normQuery)) {
            return j;
        }
    }
    return null;
}

/**
 * Hook computing omni search candidates, classified intent, matched places/jobs,
 * scroll positioning, and item hover state for search-mode filtered listings.
 *
 * @param {object} params
 * @param {string|undefined} params.filterType - Active filter type ('search', 'place', 'job', etc.)
 * @param {string|undefined} params.value - Active filter query string
 * @param {string} params.normValue - Normalized lowercase search query
 * @param {FamilyTree} params.tree - Family tree domain model instance
 * @param {number|null} params.omniSelectedIndex - Highlighted item index
 * @param {Function} params.setOmniSelectedIndex - State setter for highlighted index
 * @returns {{
 *   detectedIntent: object,
 *   matchedPlace: string|null,
 *   matchedJob: string|null,
 *   searchItems: Array<object>,
 *   effectiveSelectedIndex: number,
 *   listContainerRef: React.RefObject<HTMLElement>,
 *   handleItemHover: (idx: number) => void
 * }}
 *
 * @example
 * const omni = useFilteredListOmniSearchState({
 *   filterType: 'search',
 *   value: 'Pala',
 *   normValue: 'pala',
 *   tree,
 *   omniSelectedIndex: null,
 *   setOmniSelectedIndex: () => {}
 * });
 *
 * @example
 * const omni = useFilteredListOmniSearchState({
 *   filterType: 'place',
 *   value: 'Kerala',
 *   normValue: 'kerala',
 *   tree,
 *   omniSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {}
 * });
 */
/**
 * Resolves classified intent, matched places, matched careers, and candidate search items for omni-search.
 *
 * @param {object} options
 * @param {string} options.filterType - Active filter type ('search', 'place', etc.)
 * @param {string} options.value - Raw search query value
 * @param {string} options.normValue - Normalized search query value
 * @param {FamilyTree} options.tree - FamilyTree data model
 * @returns {object} Matched entities bundle ({ detectedIntent, matchedPlace, matchedJob, searchItems })
 *
 * @example
 * const matches = useOmniMatchedEntities({ filterType: 'search', value: 'Doctor', normValue: 'doctor', tree });
 *
 * @example
 * const matches = useOmniMatchedEntities({ filterType: 'place', value: '', normValue: '', tree });
 */
function useOmniMatchedEntities({ filterType, value, normValue, tree }) {
    const detectedIntent = useMemo(() => {
        if (filterType !== 'search' || !value) return { type: 'profile' };
        return classifyOmniQuery(value, tree);
    }, [filterType, value, tree]);

    const matchedPlace = useMemo(() => {
        if (filterType !== 'search' || !normValue) return null;
        return findMatchingPlaceForQuery(tree, normValue);
    }, [tree, filterType, normValue]);

    const matchedJob = useMemo(() => {
        if (filterType !== 'search' || !normValue) return null;
        return findMatchingJobForQuery(tree, normValue);
    }, [tree, filterType, normValue]);

    const searchItems = useMemo(() => {
        if (filterType !== 'search' || !value) return [];
        return getSearchItems(value, tree);
    }, [filterType, value, tree]);

    return { detectedIntent, matchedPlace, matchedJob, searchItems };
}

/**
 * Synchronizes list container scrolling with the currently active search item index.
 *
 * @param {object} options
 * @param {string} options.filterType - Active filter type
 * @param {Array<object>} options.searchItems - List of search items
 * @param {number} options.effectiveSelectedIndex - Currently selected item index
 * @returns {React.RefObject<HTMLDivElement>} Container ref to attach to scrollable list
 *
 * @example
 * const containerRef = useOmniAutoScroll({ filterType: 'search', searchItems: [{ id: 'item-1' }], effectiveSelectedIndex: 0 });
 *
 * @example
 * const containerRef = useOmniAutoScroll({ filterType: 'place', searchItems: [], effectiveSelectedIndex: 0 });
 */
function useOmniAutoScroll({ filterType, searchItems, effectiveSelectedIndex }) {
    const listContainerRef = useRef(null);

    useEffect(() => {
        if (filterType === 'search' && searchItems.length > 0) {
            const container = listContainerRef.current;
            if (!container) return;

            if (effectiveSelectedIndex === 0) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            const currentItem = searchItems[effectiveSelectedIndex];
            if (currentItem) {
                scrollOmniItemIntoView(container, currentItem.id);
            }
        }
    }, [effectiveSelectedIndex, filterType, searchItems]);

    return listContainerRef;
}

/**
 * Resolves the effective keyboard navigation index for omnibar search items,
 * falling back to the default intent index when within bounds.
 *
 * @param {number} searchItemsCount - Total number of search items
 * @param {number|null} omniSelectedIndex - Currently highlighted item index
 * @param {number} defaultIdx - Fallback default selected index
 * @returns {number} The resolved zero-based index
 *
 * @example
 * const idx = resolveEffectiveOmniIndex(5, 2, 0); // 2
 *
 * @example
 * const idx = resolveEffectiveOmniIndex(0, null, 1); // 0
 */
function resolveEffectiveOmniIndex(searchItemsCount, omniSelectedIndex, defaultIdx) {
    if (searchItemsCount === 0) return 0;
    if (omniSelectedIndex !== null && omniSelectedIndex >= 0 && omniSelectedIndex < searchItemsCount) {
        return omniSelectedIndex;
    }
    return defaultIdx;
}

/**
 * Hook resolving the effective selected index and hover callback for omni search items.
 *
 * @param {Array<Object>} searchItems - Matched search result items.
 * @param {string|null} detectedIntent - Detected query intent.
 * @param {number|null} omniSelectedIndex - Active keyboard-navigated index.
 * @param {Function} setOmniSelectedIndex - Index state updater.
 * @returns {{ effectiveSelectedIndex: number, handleItemHover: (idx: number) => void }}
 *
 * @example
 * const { effectiveSelectedIndex, handleItemHover } = useOmniEffectiveSelection([], null, 0, () => {});
 *
 * @example
 * const { effectiveSelectedIndex } = useOmniEffectiveSelection([{ id: 1 }], 'place', -1, () => {});
 */
function useOmniEffectiveSelection(searchItems, detectedIntent, omniSelectedIndex, setOmniSelectedIndex) {
    const defaultIdx = useMemo(() => {
        return getDefaultSelectedIndex(searchItems, detectedIntent);
    }, [searchItems, detectedIntent]);

    const effectiveSelectedIndex = useMemo(() => {
        return resolveEffectiveOmniIndex(searchItems.length, omniSelectedIndex, defaultIdx);
    }, [searchItems.length, omniSelectedIndex, defaultIdx]);

    const handleItemHover = useCallback((idx) => {
        if (Date.now() - (window.__omniLastKeyboardNav || 0) < 300) return;
        if (typeof setOmniSelectedIndex === 'function' && idx >= 0) {
            setOmniSelectedIndex(idx);
        }
    }, [setOmniSelectedIndex]);

    return { effectiveSelectedIndex, handleItemHover };
}

/**
 * Bundles omni item selection resolution and active item auto-scrolling for filtered list view.
 *
 * @param {Object} params
 * @param {Array<Object>} params.searchItems - Omni search candidate items.
 * @param {Object} params.detectedIntent - Query intent classification metadata.
 * @param {number|null} params.omniSelectedIndex - Explicit selected index.
 * @param {Function} params.setOmniSelectedIndex - State setter for omni selected index.
 * @param {string} params.filterType - Active filter type.
 * @returns {{ effectiveSelectedIndex: number, handleItemHover: Function, listContainerRef: React.RefObject<HTMLElement> }}
 *
 * @example
 * const { effectiveSelectedIndex, handleItemHover, listContainerRef } = useOmniSelectionAndScroll({
 *   searchItems: [], detectedIntent: {}, omniSelectedIndex: 0, setOmniSelectedIndex: () => {}, filterType: 'search'
 * });
 *
 * @example
 * const { effectiveSelectedIndex } = useOmniSelectionAndScroll({
 *   searchItems, detectedIntent, omniSelectedIndex: null, setOmniSelectedIndex, filterType: 'place'
 * });
 */
function useOmniSelectionAndScroll({ searchItems, detectedIntent, omniSelectedIndex, setOmniSelectedIndex, filterType }) {
    const { effectiveSelectedIndex, handleItemHover } = useOmniEffectiveSelection(
        searchItems,
        detectedIntent,
        omniSelectedIndex,
        setOmniSelectedIndex
    );

    const listContainerRef = useOmniAutoScroll({
        filterType,
        searchItems,
        effectiveSelectedIndex
    });

    return { effectiveSelectedIndex, handleItemHover, listContainerRef };
}

/**
 * Manages omni-search candidates, classification intent, auto-scrolling ref, and hover index state.
 *
 * @param {object} params
 * @param {string} params.filterType - Active filter type
 * @param {string} params.value - Raw search query
 * @param {string} params.normValue - Normalized search query
 * @param {FamilyTree} params.tree - Family tree domain model instance
 * @param {number|null} params.omniSelectedIndex - Highlighted item index
 * @param {Function} params.setOmniSelectedIndex - State setter for highlighted index
 * @returns {{
 *   detectedIntent: object,
 *   matchedPlace: string|null,
 *   matchedJob: string|null,
 *   searchItems: Array<object>,
 *   effectiveSelectedIndex: number,
 *   listContainerRef: React.RefObject<HTMLElement>,
 *   handleItemHover: (idx: number) => void
 * }}
 *
 * @example
 * const omni = useFilteredListOmniSearchState({
 *   filterType: 'search',
 *   value: 'Pala',
 *   normValue: 'pala',
 *   tree,
 *   omniSelectedIndex: null,
 *   setOmniSelectedIndex: () => {}
 * });
 *
 * @example
 * const omni = useFilteredListOmniSearchState({
 *   filterType: 'place',
 *   value: 'Kerala',
 *   normValue: 'kerala',
 *   tree,
 *   omniSelectedIndex: 0,
 *   setOmniSelectedIndex: () => {}
 * });
 */
function useFilteredListOmniSearchState({
    filterType, value, normValue, tree, omniSelectedIndex, setOmniSelectedIndex
}) {
    const { detectedIntent, matchedPlace, matchedJob, searchItems } = useOmniMatchedEntities({
        filterType, value, normValue, tree
    });
    const { effectiveSelectedIndex, handleItemHover, listContainerRef } = useOmniSelectionAndScroll({
        searchItems, detectedIntent, omniSelectedIndex, setOmniSelectedIndex, filterType
    });
    return {
        detectedIntent, matchedPlace, matchedJob, searchItems,
        effectiveSelectedIndex, listContainerRef, handleItemHover
    };
}

/**
 * Filters and sorts tree people matching a filter criterion and normalized search query.
 *
 * @param {FamilyTree} tree - Genealogy tree model.
 * @param {string|undefined} filterType - Type of filter to apply (e.g., 'place', 'generation').
 * @param {string} normValue - Normalized lowercase filter value.
 * @returns {Array<Object>} Sorted list of matching person nodes.
 *
 * @example
 * filterAndSortTreePeople(tree, 'place', 'kochi');
 * // => [person1, person2]
 *
 * @example
 * filterAndSortTreePeople(null, 'place', 'kochi');
 * // => []
 */
function filterAndSortTreePeople(tree, filterType, normValue) {
    if (!filterType || !tree?.all) return [];
    return tree.all
        .filter(p => matchesPersonFilter(p, filterType, normValue))
        .sort((a, b) => compareFilteredPersons(a, b, filterType, normValue));
}

/**
 * Resolves memoized matching people list and title badge configuration for filtered list view.
 *
 * @param {FamilyTree} tree - Genealogy tree model instance.
 * @param {string|undefined} filterType - Active filter type.
 * @param {string} normValue - Normalized lowercase filter value string.
 * @returns {{ matchingPeople: Array<Person>, titleInfo: Object }}
 *
 * @example
 * const { matchingPeople, titleInfo } = useFilteredPeopleAndTitle(tree, 'place', 'kerala');
 *
 * @example
 * const { matchingPeople, titleInfo } = useFilteredPeopleAndTitle(tree, 'job', 'farmer');
 */
function useFilteredPeopleAndTitle(tree, filterType, normValue) {
    const matchingPeople = useMemo(
        () => filterAndSortTreePeople(tree, filterType, normValue),
        [tree, filterType, normValue]
    );

    const titleInfo = useMemo(() => getFilterBadgeInfo(filterType), [filterType]);

    return { matchingPeople, titleInfo };
}

/**
 * Derives filtered list data, omni search suggestions, matching persons, and title badge info.
 *
 * @param {object} params
 * @param {object|null} params.activeFilter - Current active filter state
 * @param {FamilyTree} params.tree - Family tree domain model instance
 * @param {number|null} params.omniSelectedIndex - Keyboard-selected omni card index
 * @param {Function} params.setOmniSelectedIndex - Setter for omni card index
 * @returns {object|null} Filtered list data bundle or null if no active filter
 *
 * @example
 * const data = useFilteredListData({ activeFilter: { filterType: 'place', value: 'Kochi' }, tree, omniSelectedIndex: null, setOmniSelectedIndex: () => {} });
 *
 * @example
 * const data = useFilteredListData({ activeFilter: null, tree, omniSelectedIndex: 0, setOmniSelectedIndex: () => {} });
 * // => null
 */
function useFilteredListData({ activeFilter, tree, omniSelectedIndex, setOmniSelectedIndex }) {
    const filterType = activeFilter?.filterType;
    const value = activeFilter?.value;
    const normValue = (value || '').toLowerCase().trim();

    const omniState = useFilteredListOmniSearchState({
        filterType, value, normValue, tree, omniSelectedIndex, setOmniSelectedIndex
    });
    const { matchingPeople, titleInfo } = useFilteredPeopleAndTitle(tree, filterType, normValue);

    if (!activeFilter) return null;
    return { filterType, value, normValue, ...omniState, matchingPeople, titleInfo };
}

/**
 * Renders the body contents of the filtered list view, including header badge,
 * omni quick action cards, and matched persons list.
 *
 * @param {object} props
 * @param {object} props.listData - Data bundle produced by useFilteredListData
 * @param {Function} props.onFilterBy - Callback to change active filter
 * @param {Function} props.setPendingAiQuery - Sets pending AI assistant query
 * @param {Function} props.setShowAI - Toggles AI assistant drawer
 * @param {Function} props.setShowMap - Toggles map view
 * @param {Function} props.setShowLogs - Toggles logs drawer
 * @param {FamilyTree} props.tree - Family tree domain model instance
 * @param {Function} props.setFocusId - Callback to focus on a person
 * @returns {React.ReactNode}
 *
 * @example
 * <FilteredListBody listData={sampleListData} onFilterBy={() => {}} setPendingAiQuery={() => {}} setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}} tree={tree} setFocusId={() => {}} />
 *
 * @example
 * <FilteredListBody listData={emptyListData} onFilterBy={() => {}} setPendingAiQuery={() => {}} setShowAI={() => {}} setShowMap={() => {}} setShowLogs={() => {}} tree={tree} setFocusId={() => {}} />
 */
const FilteredListBody = ({
    listData, onFilterBy, setPendingAiQuery, setShowAI, setShowMap, setShowLogs, tree, setFocusId
}) => {
    const {
        filterType, value, searchItems, effectiveSelectedIndex, handleItemHover, matchingPeople, titleInfo
    } = listData;

    return (
        <>
            {filterType !== 'search' && (
                <FilteredListHeader
                    onFilterBy={onFilterBy} filterType={filterType}
                    titleInfo={titleInfo} value={value} count={matchingPeople.length}
                />
            )}
            <OmniQuickActions
                {...listData} setPendingAiQuery={setPendingAiQuery}
                setShowAI={setShowAI} setShowMap={setShowMap} setShowLogs={setShowLogs}
                onFilterBy={onFilterBy}
            />
            <FilteredPeopleList
                matchingPeople={matchingPeople} filterType={filterType} value={value}
                typeLabel={titleInfo.typeLabel} searchItems={searchItems}
                effectiveSelectedIndex={effectiveSelectedIndex} tree={tree}
                handleItemHover={handleItemHover} setFocusId={setFocusId}
            />
        </>
    );
};

/**
 * Sidebar panel displaying filtered search results, geographic directory matches,
 * or career listings with omni-search quick actions.
 *
 * @param {object} props
 * @param {object|null} props.activeFilter - Current active filter specification
 * @param {FamilyTree} props.tree - Family tree domain model instance
 * @param {Function} props.setFocusId - Callback to focus on a person
 * @param {Function} props.onFilterBy - Callback to change active filter
 * @param {Function} props.setShowMap - Toggles map view
 * @param {Function} props.setShowAI - Toggles AI assistant drawer
 * @param {Function} props.setShowLogs - Toggles logs drawer
 * @param {Function} props.setPendingAiQuery - Sets pending AI assistant query
 * @param {number|null} props.omniSelectedIndex - Highlighted item index
 * @param {Function} props.setOmniSelectedIndex - State setter for highlighted index
 * @returns {React.ReactNode|null}
 *
 * @example
 * <FilteredListView activeFilter={{ filterType: 'place', value: 'Kochi' }} tree={tree} setFocusId={() => {}} onFilterBy={() => {}} setShowMap={() => {}} setShowAI={() => {}} setShowLogs={() => {}} setPendingAiQuery={() => {}} omniSelectedIndex={null} setOmniSelectedIndex={() => {}} />
 *
 * @example
 * <FilteredListView activeFilter={null} tree={tree} setFocusId={() => {}} onFilterBy={() => {}} setShowMap={() => {}} setShowAI={() => {}} setShowLogs={() => {}} setPendingAiQuery={() => {}} omniSelectedIndex={0} setOmniSelectedIndex={() => {}} />
 */
const FilteredListView = ({ 
    activeFilter, tree, setFocusId, onFilterBy, setShowMap, 
    setShowAI, setShowLogs, setPendingAiQuery, omniSelectedIndex, setOmniSelectedIndex
}) => {
    const listData = useFilteredListData({ activeFilter, tree, omniSelectedIndex, setOmniSelectedIndex });
    if (!listData) return null;

    return (
        <div ref={listData.listContainerRef} className="p-6 pt-[68px] overflow-y-auto flex-1 pb-24 interactive-element w-full scroll-smooth">
            <FilteredListBody
                listData={listData} onFilterBy={onFilterBy} setPendingAiQuery={setPendingAiQuery}
                setShowAI={setShowAI} setShowMap={setShowMap} setShowLogs={setShowLogs}
                tree={tree} setFocusId={setFocusId}
            />
        </div>
    );
};

/**
 * Compares two relative person nodes for sorting within the details sidebar groups.
 * Orders primarily by known birth year (yob), then by sheet row proximity when on the same sheet,
 * then by best estimated birth year (bestYob), and finally alphabetically by name.
 *
 * @param {Person} nodeA - First person node
 * @param {Person} nodeB - Second person node
 * @returns {number} Negative if nodeA sorts first, positive if nodeB sorts first, 0 if equal
 *
 * @example
 * compareSidebarRelatives(personWithYob1950, personWithYob1955);
 * // => -5
 *
 * @example
 * compareSidebarRelatives(personSameYobRow10, personSameYobRow15);
 * // => -5
 */
function compareSidebarRelatives(nodeA, nodeB) {
    if (!nodeA && !nodeB) return 0;
    if (!nodeA) return 1;
    if (!nodeB) return -1;
    if (nodeA.yob && nodeB.yob && nodeA.yob !== nodeB.yob) {
        return nodeA.yob - nodeB.yob;
    }
    const rA = nodeA.sheetRow;
    const rB = nodeB.sheetRow;
    if (rA < 99999 && rB < 99999 && rA !== rB && FamilyTreeBuilder.sharesSheet(nodeA, nodeB)) {
        return rA - rB;
    }
    if (nodeA.bestYob !== nodeB.bestYob) {
        return nodeA.bestYob - nodeB.bestYob;
    }
    return (nodeA.name || '').localeCompare(nodeB.name || '');
}

/**
 * Resolves metadata (row number, sheet name, link text, target URL, and tooltip title)
 * for a person profile's Google Sheet source entry.
 *
 * @param {Person} person - The person node whose source is being resolved
 * @param {string} sheetId - Google Sheet spreadsheet ID
 * @param {number} idx - Zero-based index of the source entry in the list
 * @param {Object.<string, string>} [sheetNames={}] - Optional mapping of sheet IDs to human-readable names
 * @returns {{ rowNum: ?number, sheetName: string, linkText: string, href: string, title: string }}
 *
 * @example
 * formatSourceLinkDetails(person, '1NtFsX4YxXPVyCsS2o3PjNIn3WcLFuqY5G2vg6avPxRo', 0, { '1NtFs...': 'Chalissery' });
 * // => {
 * //   rowNum: 89,
 * //   sheetName: 'Chalissery',
 * //   linkText: 'Chalissery, row 89',
 * //   href: 'https://docs.google.com/spreadsheets/d/1NtFs.../edit?gid=0#gid=0&range=89:89',
 * //   title: 'Open Chalissery Row 89 in Google Sheets'
 * // }
 *
 * @example
 * formatSourceLinkDetails(personWithoutSheet, '1NtFsX4YxXPVyCsS2o3PjNIn3WcLFuqY5G2vg6avPxRo', 1);
 * // => {
 * //   rowNum: null,
 * //   sheetName: 'Sheet #2',
 * //   linkText: 'Sheet #2',
 * //   href: 'https://docs.google.com/spreadsheets/d/1NtFs.../edit',
 * //   title: 'Open Sheet #2 in Google Sheets'
 * // }
 */
function formatSourceLinkDetails(person, sheetId, idx, sheetNames = {}) {
    const rowNum = person?._sheetRows 
        ? person._sheetRows[sheetId] 
        : (person?._allSourceRefs?.find(r => r.sheetId === sheetId)?.row || null);
    const urlSuffix = rowNum ? `?gid=0#gid=0&range=${rowNum}:${rowNum}` : '';
    const sheetName = (sheetNames && sheetNames[sheetId]) ? sheetNames[sheetId] : `Sheet #${idx + 1}`;
    const linkText = rowNum ? `${sheetName}, row ${rowNum}` : sheetName;
    const href = `https://docs.google.com/spreadsheets/d/${sheetId}/edit${urlSuffix}`;
    const title = `Open ${sheetName}${rowNum ? ` Row ${rowNum}` : ''} in Google Sheets`;
    return { rowNum, sheetName, linkText, href, title };
}

/**
 * Splits a comma-delimited string into non-empty, whitespace-trimmed token strings.
 *
 * @param {?string} str - Comma-delimited string
 * @returns {string[]} Array of non-empty, trimmed tokens
 *
 * @example
 * parseCommaDelimitedTokens("Doctor, Engineer, Teacher");
 * // => ["Doctor", "Engineer", "Teacher"]
 *
 * @example
 * parseCommaDelimitedTokens("   New York ,  London  ,, Paris ");
 * // => ["New York", "London", "Paris"]
 */
function parseCommaDelimitedTokens(str) {
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Counts non-ghost, known people in the tree matching a specific category ('family', 'job', or 'place').
 *
 * @param {FamilyTree} tree - The family tree instance
 * @param {'family'|'job'|'place'} category - Attribute category
 * @param {string} term - Search term or attribute value to match
 * @returns {number} Number of matching people in the tree
 *
 * @example
 * countCategoryMembers(tree, 'family', 'Chalissery');
 * // => 42
 *
 * @example
 * countCategoryMembers(tree, 'job', 'Doctor');
 * // => 5
 */
function countCategoryMembers(tree, category, term) {
    if (!tree?.all || !term) return 0;
    const norm = term.toLowerCase().trim();
    if (category === 'family') {
        return tree.all.filter(p => !p.isGhost && !p._isUnknown && p.family && p.family.toLowerCase().trim() === norm).length;
    }
    if (category === 'job') {
        return tree.all.filter(p => !p.isGhost && !p._isUnknown && p.job && p.job.toLowerCase().includes(norm)).length;
    }
    if (category === 'place') {
        return tree.all.filter(p => !p.isGhost && !p._isUnknown && p.place && p.place.toLowerCase().includes(norm)).length;
    }
    return 0;
}