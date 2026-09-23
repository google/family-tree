/**
 * Computes spatial layout, node coordinates, partner alignments, and connector geometry for a family subtree.
 *
 * Recursively positions unit members (parents, partners, co-spouses) and child branches,
 * packing subtrees horizontally using IntervalContour clearance to prevent card and bus-bar overlaps.
 *
 * @param {Person} person - Subtree root person node
 * @param {FamilyTree} tree - Populated tree data model
 * @param {object} layoutConfig - Layout options (collapsed nodes, timeline scale, ppy, rootNodeYob)
 * @param {Set<string>} visitedSet - Set of visited node IDs to guard against cyclical graph loops
 * @param {number} [depth=0] - Recursion generation depth from tree root
 * @returns {object|null} Subtree layout structure containing members, child layouts, contours, and bounding box
 *
 * @example
 * const subtree = layoutSubtree(rootPerson, tree, layoutConfig, new Set());
 *
 * @example
 * const branch = layoutSubtree(childPerson, tree, layoutConfig, visitedSet, depth + 1);
 */
function layoutSubtree(person, tree, layoutConfig, visitedSet, depth = 0) {
    if (!person || visitedSet.has(person.id)) return null;

    const { siblingGap, branchGap, isCollapsed, nodeYob, targetY } = FamilyTree._computeSubtreeGeometry(person, tree, layoutConfig, depth);

    const localVisited = new Set(visitedSet);
    localVisited.add(person.id);

    const { partners, coSpouseEntries, partnerChildMap, isMultiSpouseSplit } =
        FamilyTree._resolveSubtreeUnitChildren(person, tree, layoutConfig, isCollapsed, localVisited);

    const sortedPartners = [...partners].sort((a, b) => a.bestYob - b.bestYob);

    const { familyMembers, bloodlineIndex } = FamilyTree._orderFamilyMembers(person, sortedPartners, coSpouseEntries, isMultiSpouseSplit);
    const isSyntheticSiblingUnit = familyMembers.length > 0 && familyMembers.every(m => FamilyTree.isSyntheticSiblingParent(m));

    // Map each member's info
    const memberLayouts = FamilyTree._buildMemberLayouts(
        familyMembers, bloodlineIndex, partnerChildMap, { nodeYob, targetY, isCollapsed, layoutConfig, tree }
    );

    const commonParams = { person, targetY, memberLayouts, tree, layoutConfig, localVisited, branchGap, depth };
    return !isMultiSpouseSplit
        ? FamilyTree._layoutSingleSpouseSubtree({ ...commonParams, bloodlineIndex, isSyntheticSiblingUnit })
        : FamilyTree._layoutMultiSpouseSubtree({ ...commonParams, siblingGap });
}

/**
 * Generates an SVG path string for connecting two adjacent spouses.
 * 
 * @param {number} x1 - Right edge of spouse 1 card
 * @param {number} y1 - Vertical midpoint of spouse 1 card
 * @param {number} x2 - Left edge of spouse 2 card
 * @param {number} y2 - Vertical midpoint of spouse 2 card
 * @returns {string} SVG path d attribute string
 *
 * @example
 * _generateSpouseBridgePath(100, 50, 120, 50);
 * // => "M 100 50 L 120 50"
 *
 * @example
 * _generateSpouseBridgePath(100, 50, 120, 70);
 * // => "M 100 50 C 110 50, 110 70, 120 70"
 */
function _generateSpouseBridgePath(x1, y1, x2, y2) {
    if (y1 === y2) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

/**
 * Generates an SVG path string for a single child drop stem from parent bus bar down to child card top.
 * 
 * @param {number} parentDropX - Horizontal center of parent card
 * @param {number} busBarY - Bus bar horizontal line altitude
 * @param {number} childDropX - Horizontal center of child card
 * @param {number} childCardTopY - Top Y coordinate of child card
 * @returns {string} SVG path d attribute string
 *
 * @example
 * _generateSingleChildStemPath(100, 50, 100, 120);
 * // => "M 100 50 L 100 120"
 *
 * @example
 * _generateSingleChildStemPath(100, 50, 140, 120);
 * // => "M 100 50 L 132 50 Q 140 50 140 58 L 140 120"
 */
function _generateSingleChildStemPath(parentDropX, busBarY, childDropX, childCardTopY) {
    if (Math.abs(parentDropX - childDropX) < 1) {
        return `M ${parentDropX} ${busBarY} L ${childDropX} ${childCardTopY}`;
    }
    const isLeft = childDropX < parentDropX;
    const R = Math.min(8, Math.abs(parentDropX - childDropX) / 2, Math.max(0, (childCardTopY - busBarY) / 2));
    if (R > 0) {
        return `M ${parentDropX} ${busBarY} L ${childDropX + (isLeft ? R : -R)} ${busBarY} Q ${childDropX} ${busBarY} ${childDropX} ${busBarY + R} L ${childDropX} ${childCardTopY}`;
    }
    return `M ${parentDropX} ${busBarY} L ${childDropX} ${busBarY} L ${childDropX} ${childCardTopY}`;
}

/**
 * Generates an SVG path string for the multi-child rounded bus-bar.
 * 
 * @param {number} firstDropX - Center X of first (leftmost) child
 * @param {number} firstTopY - Top Y of first child card
 * @param {number} lastDropX - Center X of last (rightmost) child
 * @param {number} lastTopY - Top Y of last child card
 * @param {number} busBarY - Bus bar altitude
 * @returns {string} SVG path d attribute string
 *
 * @example
 * _generateBusBarPath(50, 120, 150, 120, 80);
 * // => "M 50 120 L 50 88 Q 50 80 58 80 L 142 80 Q 150 80 150 88 L 150 120"
 *
 * @example
 * _generateBusBarPath(100, 100, 100, 100, 100);
 * // => "M 100 100 L 100 100 L 100 100 L 100 100"
 */
function _generateBusBarPath(firstDropX, firstTopY, lastDropX, lastTopY, busBarY) {
    const R = Math.min(8, (lastDropX - firstDropX) / 2, Math.max(0, (firstTopY - busBarY) / 2), Math.max(0, (lastTopY - busBarY) / 2));
    if (R > 0) {
        return `M ${firstDropX} ${firstTopY} L ${firstDropX} ${busBarY + R} Q ${firstDropX} ${busBarY} ${firstDropX + R} ${busBarY} L ${lastDropX - R} ${busBarY} Q ${lastDropX} ${busBarY} ${lastDropX} ${busBarY + R} L ${lastDropX} ${lastTopY}`;
    }
    return `M ${firstDropX} ${firstTopY} L ${firstDropX} ${busBarY} L ${lastDropX} ${busBarY} L ${lastDropX} ${lastTopY}`;
}

/**
 * Flattens a recursive subtree layout hierarchy into flat node positioning records,
 * branch toggle buttons, SVG connection paths, and bounding box dimensions.
 *
 * @param {Object} rootSubtree - Root subtree layout node produced by layoutSubtree
 * @returns {{
 *   nodes: Array<Object>,
 *   buttons: Array<Object>,
 *   paths: Array<Object>,
 *   width: number,
 *   height: number,
 *   minX: number,
 *   minY: number
 * }}
 *
 * @example
 * const layout = flattenTreeLayout(rootSubtree);
 * console.log(layout.nodes.length, layout.width, layout.height);
 *
 * @example
 * const emptyLayout = flattenTreeLayout(null);
 * // => { nodes: [], buttons: [], paths: [], width: 0, height: 0, minX: 0, minY: 0 }
 */
function flattenTreeLayout(rootSubtree) {
    if (!rootSubtree) return { nodes: [], buttons: [], paths: [], width: 0, height: 0, minX: 0, minY: 0 };

    const nodes = [], buttons = [], paths = [];

    /**
     * Traverses member layouts recursively to collect positioned node cards and edge paths.
     *
     * @param {Object} sub - Subtree layout descriptor
     * @param {number} originX - Base horizontal offset coordinate
     *
     * @example
     * traverse(rootSubtree, 0);
     *
     * @example
     * traverse(childSubtree, 250);
     */
    function traverse(sub, originX) {
        FamilyTree._generateSpouseBridges(sub.memberLayouts, originX, sub.isSyntheticSiblingUnit, paths);
        sub.memberLayouts.forEach(mInfo => {
            const cardAbsX = originX + mInfo.cardX, cardAbsY = mInfo.targetY;
            if (!sub.isSyntheticSiblingUnit) {
                nodes.push(FamilyTree._buildFlattenedNode(mInfo, cardAbsX, cardAbsY));
            }
            FamilyTree._generateChildConnections({
                mInfo, originX, cardAbsX, cardAbsY, isSyntheticSiblingUnit: sub.isSyntheticSiblingUnit, paths, traverse
            });
        });
    }

    traverse(rootSubtree, 0);
    return { nodes, buttons, paths, ...FamilyTree._computeLayoutBounds(nodes, paths) };
}

FamilyTreeBuilder._computeLayoutFn = function(tree, layout) {
    if (!tree || !tree.root) return null;
    const normalized = FamilyTreeBuilder.normalizeLayoutConfig ? FamilyTreeBuilder.normalizeLayoutConfig(tree, layout) : layout;
    const sub = layoutSubtree(tree.root, tree, normalized, new Set());
    return flattenTreeLayout(sub);
};
FamilyTreeBuilder.computeLayout = FamilyTreeBuilder._computeLayoutFn;

/**
 * Renders the SVG connector layer containing orthogonal paths between ancestors, spouses, and descendants.
 *
 * @param {Object} props
 * @param {Array<{ d: string }>} props.paths - Array of path descriptors with SVG d path strings
 * @param {number} props.padX - Horizontal coordinate offset
 * @param {number} props.padY - Vertical coordinate offset
 * @param {number} props.totalW - Total canvas width in pixels
 * @param {number} props.totalH - Total canvas height in pixels
 * @returns {React.ReactNode}
 *
 * @example
 * <CompactTreeConnectorSvg paths={layoutData.paths} padX={10} padY={10} totalW={800} totalH={600} />
 *
 * @example
 * <CompactTreeConnectorSvg paths={[]} padX={0} padY={0} totalW={100} totalH={100} />
 */
const CompactTreeConnectorSvg = React.memo(({ paths, padX, padY, totalW, totalH }) => (
    <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible"
        style={{ width: `${totalW}px`, height: `${totalH}px` }}
    >
        <g transform={`translate(${padX}, ${padY})`}>
            {paths.map((p, idx) => (
                <path 
                    key={`path-${idx}`} 
                    d={p.d} 
                    stroke="#cbd5e1" 
                    strokeWidth="2" 
                    fill="none" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
        </g>
    </svg>
));

/**
 * Renders an absolutely positioned person card container within the compact tree canvas.
 *
 * @param {object} props
 * @param {object} props.node - Layout node containing person and coordinates
 * @param {number} props.padX - Horizontal canvas padding offset
 * @param {number} props.padY - Vertical canvas padding offset
 * @param {object} props.layout - Layout configuration and callbacks
 * @returns {React.ReactNode} Positioned node wrapper element
 *
 * @example
 * <CompactTreeNodeItem node={layoutNode} padX={10} padY={10} layout={layoutConfig} />
 *
 * @example
 * <CompactTreeNodeItem node={{ person: p, x: 100, y: 50 }} padX={0} padY={0} layout={layoutConfig} />
 */
const CompactTreeNodeItem = ({ node, padX, padY, layout }) => (
    <div 
        className="absolute z-10"
        style={{ left: `${node.x + padX}px`, top: `${node.y + padY}px` }}
    >
        <PersonNode 
            person={node.person} 
            isPartner={node.isPartner} 
            layout={layout} 
            hasHiddenLineage={node.hasHiddenLineage} 
            hasChildren={node.hasChildren}
            isCollapsed={node.isCollapsed}
        />
    </div>
);

/**
 * Renders the compact 2D SVG canvas layout of the genealogical tree,
 * containing orthogonal path connectors and positioned PersonNode cards.
 *
 * @param {Object} props
 * @param {FamilyTree} props.tree - The genealogical tree model
 * @param {Object} props.layout - Viewport layout state including focusId, collapse sets, and callbacks
 * @returns {React.ReactNode|null}
 *
 * @example
 * <CompactTreeView tree={familyTreeInstance} layout={layoutConfig} />
 *
 * @example
 * <CompactTreeView tree={tree} layout={{ focusId: 'p1', collapsedNodes: new Set() }} />
 */
const CompactTreeView = React.memo(({ tree, layout }) => {
    const layoutData = useMemo(() => {
        return FamilyTreeBuilder.computeLayout(tree, layout);
    }, [tree, layout]);

    if (!layoutData || layoutData.nodes.length === 0) return null;

    const CARD_PAD = 10;
    const padX = CARD_PAD - layoutData.minX;
    const padY = CARD_PAD - layoutData.minY;
    const totalW = layoutData.width + CARD_PAD * 2;
    const totalH = layoutData.height + CARD_PAD * 2;

    return (
        <div className="compact-tree-view relative" style={{ width: `${totalW}px`, height: `${totalH}px` }}>
            <CompactTreeConnectorSvg 
                paths={layoutData.paths}
                padX={padX}
                padY={padY}
                totalW={totalW}
                totalH={totalH}
            />

            {/* Person Card Nodes */}
            {layoutData.nodes.map(n => (
                <CompactTreeNodeItem 
                    key={n.person.id}
                    node={n}
                    padX={padX}
                    padY={padY}
                    layout={layout}
                />
            ))}
        </div>
    );
});


// ============================================================================
// GENEALOGY INFERENCE ENGINE (Instant, Deterministic Local Q&A)
// ============================================================================

/**
 * Local deterministic Q&A inference engine capable of directly parsing natural language
 * genealogical questions, resolving relationships, superlatives, occupations, and demographics.
 *
 * @example
 * const engine = new GenealogyEngine(familyTree);
 *
 * @example
 * const answer = engine.answer("Who is the oldest person in Kerala?");
 */
class GenealogyEngine {
    /**
     * Stop words filtered during entity extraction from natural language genealogical queries.
     * @type {Set<string>}
     */
    static QUERY_STOP_WORDS = new Set([
        'who', 'what', 'when', 'where', 'how', 'why', 'is', 'are', 'was', 'were', 'the', 'and', 'with', 'from', 'in', 'at', 'on', 'of', 'for', 'to',
        'has', 'have', 'had', 'his', 'her', 'their', 'its', 'starting', 'starts', 'start', 'begins', 'begin', 'letter', 'name', 'names',
        'husband', 'wife', 'spouse', 'partner', 'married', 'marry',
        'father', 'mother', 'parent', 'parents', 'dad', 'mom',
        'child', 'children', 'son', 'daughter', 'kids', 'kid',
        'sibling', 'siblings', 'brother', 'sister', 'brothers', 'sisters',
        'grandfather', 'grandmother', 'grandparent', 'grandparents', 'grandpa', 'grandma',
        'grandchild', 'grandchildren', 'grandson', 'granddaughter',
        'uncle', 'aunt', 'nephew', 'niece', 'cousin', 'cousins',
        'tell', 'about', 'find', 'show', 'list', 'related', 'relationship', 'between', 'tree', 'family',
        'born', 'died', 'lived', 'live', 'living', 'work', 'worked', 'job', 'career', 'place', 'location',
        'oldest', 'youngest', 'many', 'people', 'person'
    ]);

    /**
     * Vocabulary that signals a particular query intent, grouped by the question being asked.
     *
     * Extracted from long inline `q.includes(...) || q.includes(...)` chains so the vocabulary
     * for each intent can be read, extended, and reviewed as data rather than as control flow.
     *
     * @type {Object<string, ReadonlyArray<string>>}
     */
    static QUERY_INTENT_KEYWORDS = Object.freeze({
        // "who works as a nurse?" - profession lookups, including common professions by name.
        JOB: Object.freeze(['who', 'work', 'job', 'career', 'doctor', 'engineer', 'teacher', 'priest', 'nun', 'nurse', 'advocate', 'list']),
        // "who are in the Mechery family?" - family/branch membership lookups.
        FAMILY: Object.freeze(['family', 'members', 'branch', 'who is from', 'who are in']),
        // "who lived the longest?" - maximum lifespan.
        LONGEST_LIFESPAN: Object.freeze(['lived the longest', 'longest life', 'longest lifespan', 'maximum age']),
        // "who is the earliest ancestor?" - root of the pedigree.
        EARLIEST_ANCESTOR: Object.freeze(['earliest ancestor', 'first ancestor', 'root ancestor']),
        // Ambiguous phrasings that mean "earliest ancestor" only when not scoped to a place.
        OLDEST_PERSON: Object.freeze(['oldest person', 'oldest ancestor']),
        // "who is the oldest living person?" - superlative among the living.
        OLDEST_LIVING: Object.freeze(['oldest living', 'eldest living']),
        // "who is the youngest?" - most recent birth.
        YOUNGEST: Object.freeze(['youngest', 'latest birth', 'newest baby']),
        // "who has the most children?" - largest sibling group.
        MOST_CHILDREN: Object.freeze(['most children', 'largest family', 'most kids'])
    });

    /**
     * Reports whether a lowercased query mentions any phrase from a keyword list.
     *
     * @param {string} qLower - Lowercased query text
     * @param {ReadonlyArray<string>} keywords - Phrases that signal the intent
     * @returns {boolean} True when at least one phrase appears in the query
     *
     * @example
     * GenealogyEngine._mentionsAny('who are the nurses', GenealogyEngine.QUERY_INTENT_KEYWORDS.JOB);
     * // => true
     *
     * @example
     * GenealogyEngine._mentionsAny('show the tree', GenealogyEngine.QUERY_INTENT_KEYWORDS.YOUNGEST);
     * // => false
     */
    static _mentionsAny(qLower, keywords) {
        return keywords.some(keyword => qLower.includes(keyword));
    }

    /**
     * Creates a GenealogyEngine instance initialized with the given family tree.
     *
     * @param {Object} tree - Family tree instance
     *
     * @example
     * const engine = new GenealogyEngine(tree);
     *
     * @example
     * const localEngine = new GenealogyEngine(activeFamilyTree);
     */
    constructor(tree) {
        this.tree = tree;
    }

    /**
     * Normalizes a text string by lowercasing, stripping quotes, and removing punctuation.
     *
     * @param {string} str - Raw string to clean
     * @returns {string} Sanitized string
     *
     * @example
     * engine.clean("John's"); // => "johns"
     *
     * @example
     * engine.clean("Mary, Joseph!"); // => "mary  joseph"
     */
    clean(str) {
        if (!str) return '';
        return String(str)
            .toLowerCase()
            .replace(/["“”'‘’]/g, '')
            .replace(/[?.,!;:()\[\]{}]/g, ' ')
            .trim();
    }

    /**
     * Sorts an array of persons by birth year ascending, placing unknown birth years at the end.
     * 
     * @param {Object[]} people - List of person nodes
     * @returns {Object[]} Sorted list
     * 
     * @example
     * engine._sortByYob([{ yob: 1980 }, { yob: 1950 }]);
     * // => [{ yob: 1950 }, { yob: 1980 }]
     *
     * @example
     * engine._sortByYob([{ yob: null }, { yob: 1920 }]);
     * // => [{ yob: 1920 }, { yob: null }]
     */
    _sortByYob(people) {
        return people.sort((a, b) => (a.yob || 9999) - (b.yob || 9999));
    }

    /**
     * Searches for exact primary name or exact nickname matches.
     * 
     * @param {Object[]} all - All concrete persons
     * @param {string} q - Cleaned query name
     * @returns {Object[]} Matching persons or empty array
     * 
     * @example
     * engine._findExactNameOrNickMatches(allPeople, 'mary');
     *
     * @example
     * engine._findExactNameOrNickMatches(allPeople, 'unknown_name');
     * // => []
     */
    _findExactNameOrNickMatches(all, q) {
        const exactName = all.filter(p => this.clean(p.name) === q);
        const exactNick = all.filter(p => {
            if (this.clean(p.name) === q) return false;
            if (p.nick) {
                const nicks = p.nick.split(',').map(n => this.clean(n));
                return nicks.includes(q) || this.clean(p.nick) === q;
            }
            return false;
        });

        if (exactName.length > 0 || exactNick.length > 0) {
            return [...this._sortByYob(exactName), ...this._sortByYob(exactNick)];
        }
        return [];
    }

    /**
     * Searches for first-name, nickname token, or substring matches.
     * 
     * @param {Object[]} all - All concrete persons
     * @param {string} q - Cleaned query name
     * @returns {Object[]} Matching persons or empty array
     * 
     * @example
     * engine._findPartialOrSubstringMatches(allPeople, 'john');
     *
     * @example
     * engine._findPartialOrSubstringMatches(allPeople, 'paul');
     */
    _findPartialOrSubstringMatches(all, q) {
        const byFirst = all.filter(p => this.clean(p.name.split(/\s+/)[0]) === q);
        if (byFirst.length > 0) return this._sortByYob(byFirst);

        const byNickWord = all.filter(p => {
            if (!p.nick) return false;
            const nicks = p.nick.split(',').map(n => this.clean(n));
            return nicks.some(n => n.split(/\s+/).includes(q));
        });
        if (byNickWord.length > 0) return this._sortByYob(byNickWord);

        if (q.length >= 3) {
            const substring = all.filter(p => this.clean(p.name).includes(q) || (p.nick && this.clean(p.nick).includes(q)));
            return this._sortByYob(substring);
        }
        return [];
    }

    /**
     * Finds all concrete persons in the tree matching the given name query via exact, nickname, or partial match.
     *
     * @param {string} nameQuery - Name to search for
     * @returns {Object[]} Array of matching person nodes
     *
     * @example
     * const matches = engine.findAllMatchingPeople('Mary');
     *
     * @example
     * const empty = engine.findAllMatchingPeople('');
     * // => []
     */
    findAllMatchingPeople(nameQuery) {
        if (!nameQuery) return [];
        const q = this.clean(nameQuery);
        if (!q) return [];
        const all = this.tree.all.filter(p => !p.isGhost && !p._isUnknown);

        const exact = this._findExactNameOrNickMatches(all, q);
        if (exact.length > 0) return exact;

        return this._findPartialOrSubstringMatches(all, q);
    }

    /**
     * Normalizes query string for entity extraction by stripping possessives and punctuation,
     * returning non-stopword tokens.
     * 
     * @param {string} query - Natural language query
     * @returns {string[]} Candidate non-stop words
     * 
     * @example
     * engine._extractCandidateQueryWords("Who is Mary's son?");
     * // => ['mary']
     *
     * @example
     * engine._extractCandidateQueryWords("Tell me about George and Paul");
     * // => ['george', 'paul']
     */
    _extractCandidateQueryWords(query) {
        const normalized = String(query)
            .replace(/["“”'‘’]s\b/gi, ' ')
            .replace(/['’]s\b/gi, ' ')
            .replace(/["“”'‘’]/g, ' ')
            .replace(/[?.,!;:()\[\]{}]/g, ' ');
        const qClean = normalized.toLowerCase().trim();
        const words = qClean.split(/\s+/).filter(w => w.length >= 2);
        return words.filter(w => !GenealogyEngine.QUERY_STOP_WORDS.has(w));
    }

    /**
     * Extracts person domain entities referenced within a natural language query string.
     *
     * @param {string} query - Natural language query
     * @returns {Object[]} Unique matching person records
     *
     * @example
     * const people = engine.extractPeopleFromQuery("How is Paul related to John?");
     *
     * @example
     * const none = engine.extractPeopleFromQuery("");
     * // => []
     */
    extractPeopleFromQuery(query) {
        if (!query) return [];
        const candidateWords = this._extractCandidateQueryWords(query);
        const found = [];
        const addMatches = (matches) => {
            for (const m of matches) {
                if (!found.some(existing => existing.id === m.id)) {
                    found.push(m);
                }
            }
        };

        if (candidateWords.length > 1) {
            addMatches(this.findAllMatchingPeople(candidateWords.join(' ')));
        }
        for (const word of candidateWords) {
            addMatches(this.findAllMatchingPeople(word));
        }
        return found;
    }

    /**
     * Generates a markdown link string for a person profile node.
     *
     * @param {Object|null} person - Person node
     * @returns {string} Markdown link string or empty string
     *
     * @example
     * engine.link(personNode); // => "[Paul](P1)"
     *
     * @example
     * engine.link(null); // => ""
     */
    link(person) {
        if (!person) return '';
        return `[${person.name}](${person.id})`;
    }

    /**
     * Determines the relationship label if p1 and p2 are in a grandparent/grandchild relationship.
     * 
     * @param {Object} p1 - First person
     * @param {Object} p2 - Second person
     * @param {Object[]} p1Parents - Parents of p1
     * @returns {string|null} Formatted relationship string or null
     * 
     * @example
     * engine._getGrandparentRelationship(grandchild, grandpa, [father]);
     * // => "the grandchild of [Grandpa](id)"
     *
     * @example
     * engine._getGrandparentRelationship(unrelated1, unrelated2, []);
     * // => null
     */
    _getGrandparentRelationship(p1, p2, p1Parents) {
        for (const parent of p1Parents) {
            if (parent.momId === p2.id || parent.fatherId === p2.id) {
                return `the grandchild of ${this.link(p2)}`;
            }
        }
        for (const childId of p1.children) {
            const child = this.tree.get(childId);
            if (child && (child.children.includes(p2.id) || p2.momId === child.id || p2.fatherId === child.id)) {
                return `the grandparent of ${this.link(p2)}`;
            }
        }
        return null;
    }

    /**
     * Determines the relationship label if p1 and p2 are avuncular (uncle/aunt/nephew/niece) or first cousins.
     * 
     * @param {Object} p1 - First person
     * @param {Object} p2 - Second person
     * @param {Object[]} p1Parents - Parents of p1
     * @param {Object[]} p1Siblings - Siblings of p1
     * @returns {string|null} Formatted relationship string or null
     * 
     * @example
     * engine._getAvuncularOrCousinRelationship(nephew, uncle, [father], []);
     * // => "the niece/nephew of [Uncle](id)"
     *
     * @example
     * engine._getAvuncularOrCousinRelationship(cousin1, cousin2, [parent1], []);
     * // => "a first cousin of [Cousin2](id)"
     */
    _getAvuncularOrCousinRelationship(p1, p2, p1Parents, p1Siblings) {
        for (const parent of p1Parents) {
            const parentSiblings = this.tree.getSiblings(parent.id);
            if (parentSiblings.some(s => s.id === p2.id)) return `the niece/nephew of ${this.link(p2)}`;
        }
        for (const sib of p1Siblings) {
            if (sib.children.includes(p2.id)) return `the aunt/uncle of ${this.link(p2)}`;
        }
        for (const parent of p1Parents) {
            const parentSiblings = this.tree.getSiblings(parent.id);
            for (const pSib of parentSiblings) {
                if (pSib.children.includes(p2.id)) return `a first cousin of ${this.link(p2)}`;
            }
        }
        return null;
    }

    /**
     * Determines whether p1 and p2 share a direct nuclear relationship (spouse, parent, child, or sibling).
     *
     * @param {Object} p1 - First person
     * @param {Object} p2 - Second person
     * @param {Object[]} p1Siblings - Sibling profiles of p1
     * @returns {string|null} Formatted relationship string or null if not directly related
     *
     * @example
     *   _getDirectKinship(pSpouseA, pSpouseB, []) // "the spouse of [SpouseB](id)"
     * @example
     *   _getDirectKinship(pChild, pParent, []) // "the child of [Parent](id)"
     */
    _getDirectKinship(p1, p2, p1Siblings) {
        if (p1.partners.includes(p2.id) || p2.partners.includes(p1.id)) {
            return `the spouse of ${this.link(p2)}`;
        }
        if (p1.children.includes(p2.id) || p2.momId === p1.id || p2.fatherId === p1.id) {
            return `the parent of ${this.link(p2)}`;
        }
        if (p2.children.includes(p1.id) || p1.momId === p2.id || p1.fatherId === p2.id) {
            return `the child of ${this.link(p2)}`;
        }
        if (p1Siblings.some(s => s.id === p2.id)) {
            return `a sibling of ${this.link(p2)}`;
        }
        return null;
    }

    /**
     * Computes the human-readable genealogical kinship relationship from person p1 to person p2.
     *
     * @param {Object} p1 - First person node
     * @param {Object} p2 - Second person node
     * @returns {string} Human-readable relationship label
     *
     * @example
     * engine.getRelationship(childNode, parentNode);
     * // => "the child of [Parent](id)"
     *
     * @example
     * engine.getRelationship(personNode, personNode);
     * // => "the same person"
     */
    getRelationship(p1, p2) {
        if (p1.id === p2.id) return "the same person";

        const p1Siblings = this.tree.getSiblings(p1.id);
        const directRel = this._getDirectKinship(p1, p2, p1Siblings);
        if (directRel) return directRel;

        const p1Parents = [p1.momId, p1.fatherId].map(id => this.tree.get(id)).filter(Boolean);
        const grandparentRel = this._getGrandparentRelationship(p1, p2, p1Parents);
        if (grandparentRel) return grandparentRel;

        const collateralRel = this._getAvuncularOrCousinRelationship(p1, p2, p1Parents, p1Siblings);
        if (collateralRel) return collateralRel;

        return `related in the family tree to ${this.link(p2)}`;
    }

    /**
     * Resolves the primary subject person name to display in relationship query responses.
     * Extracts non-stop words from the query or defaults to the first matched person's name.
     *
     * @param {string} query - Raw natural language query
     * @param {Object[]} matchedPeople - Array of matched Person objects
     * @returns {string} Capitalized display query name
     *
     * @example
     *   _resolveDisplayQueryName("Who is Rosy's husband?", [{ name: 'Rosy' }]) // "Rosy"
     * @example
     *   _resolveDisplayQueryName("Tell me about George", [{ name: 'George' }]) // "George"
     */
    _resolveDisplayQueryName(query, matchedPeople) {
        const queryWords = this.clean(query).replace(/['’]s\b/gi, ' ').split(/\s+/).filter(w => w.length >= 2);
        const queryStopWords = new Set(['who', 'what', 'when', 'where', 'how', 'why', 'is', 'are', 'was', 'were', 'the', 'and', 'with', 'from', 'in', 'at', 'on', 'of', 'for', 'to', 'has', 'have', 'child', 'children', 'son', 'daughter', 'kids', 'husband', 'wife', 'spouse', 'partner', 'parents', 'father', 'mother', 'sibling', 'brother', 'sister']);
        const searchedName = queryWords.find(w => !queryStopWords.has(w)) || (matchedPeople.length > 0 ? matchedPeople[0].name : '');
        return searchedName ? (searchedName.charAt(0).toUpperCase() + searchedName.slice(1)) : (matchedPeople[0]?.name || '');
    }

    /**
     * Attempts to directly answer natural language genealogical questions without LLM invocation.
     * 
     * Supported query categories:
     * 1. Direct relationship between two people (e.g. "How is Paul related to John?")
     * 2. Location residents and superlatives (e.g. "Who is the oldest person in Palakkad?")
     * 3. Professions and occupations (e.g. "Who are the engineers?")
     * 4. Family branch membership (e.g. "Members of the Mechery family")
     * 5. Spousal queries (e.g. "Who is Rosy's husband?")
     * 6. Parental queries (e.g. "Who are Antu's parents?")
     * 7. Children and offspring (e.g. "Tell me about George's children")
     * 8. Sibling queries (e.g. "Who are Mary's siblings?")
     * 9. Grandparent queries (e.g. "Grandparents of Thomas")
     * 10. Superlatives across tree (e.g. "Oldest living person", "Longest lifespan")
     * 11. Calendar year inquiries (e.g. "Who was born in 1950?")
     * 12. Single person profile summaries (e.g. "Tell me about Joseph")
     * 13. Overall tree stats / count
     * 
     * @param {string} query - Natural language query string
     * @returns {string|null} Markdown-formatted direct answer or null
     *
     * @example
     * engine.tryDirectAnswer("Who is Rosy's husband?");
     * // => "**Rosy's** husband is Antu."
     * 
     * @example
     * engine.tryDirectAnswer("How is Paul related to John?");
     * // => "[Paul](id) is the brother of [John](id)."
     */
    tryDirectAnswer(query) {
        const q = (query || '').trim();
        const qLower = q.toLowerCase();
        if (!q) return null;

        const relAnswer = this._answerTwoPersonRelationship(qLower);
        if (relAnswer) return relAnswer;

        const matchedPeople = this.extractPeopleFromQuery(q);
        const person = matchedPeople.length > 0 ? matchedPeople[0] : null;
        const displayQueryName = this._resolveDisplayQueryName(q, matchedPeople);

        return this._answerLocationQuery(qLower) ||
               this._answerJobQuery(qLower) ||
               this._answerFamilyQuery(qLower) ||
               this._answerSpouseQuery(qLower, matchedPeople, displayQueryName) ||
               this._answerParentsQuery(qLower, matchedPeople, displayQueryName) ||
               this._answerChildrenQuery(qLower, matchedPeople, displayQueryName) ||
               this._answerSiblingsQuery(qLower, matchedPeople, displayQueryName) ||
               this._answerGrandparentsQuery(qLower, person) ||
               this._answerSuperlativeQuery(qLower) ||
               this._answerYearQuery(qLower) ||
               this._answerSinglePersonSummary(qLower, person) ||
               this._answerTreeStatsQuery(qLower) ||
               null;
    }

    /**
     * Answers queries determining the relationship between two explicitly named individuals.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Relationship answer string or null
     *
     * @example
     * engine._answerTwoPersonRelationship("how is paul related to john");
     *
     * @example
     * engine._answerTwoPersonRelationship("relationship between mary and rose");
     */
    _answerTwoPersonRelationship(qLower) {
        const relMatch = qLower.match(/(?:how is|relationship between|relate)\s+([a-zA-Z0-9\s]+?)\s+(?:related to|and|to)\s+([a-zA-Z0-9\s?]+)/i);
        if (relMatch) {
            const name1 = relMatch[1].replace(/['’]s|\?/g, '').trim();
            const name2 = relMatch[2].replace(/['’]s|\?/g, '').trim();
            const list1 = this.findAllMatchingPeople(name1);
            const list2 = this.findAllMatchingPeople(name2);
            if (list1.length > 0 && list2.length > 0) {
                const p1 = list1[0];
                const p2 = list2[0];
                return `${this.link(p1)} is ${this.getRelationship(p1, p2)}.`;
            }
        }
        return null;
    }

    /**
     * Searches for a matching entity attribute value (place, job, family) within a query string.
     * Values are prioritized by length descending to match specific multi-word phrases first.
     *
     * @param {string} attrName - Profile attribute property name (e.g. 'place', 'job', 'family')
     * @param {string} qLower - Lowercase normalized query string
     * @param {boolean} [matchPlural=false] - Whether to allow trailing plural suffixes ('s', 'es')
     * @returns {string|null} Matched attribute value or null
     *
     * @example
     * engine._matchAttributeInQuery('place', 'who lives in chalakudy');
     * // => 'Chalakudy'
     *
     * @example
     * engine._matchAttributeInQuery('job', 'who are the teachers', true);
     * // => 'Teacher'
     */
    _matchAttributeInQuery(attrName, qLower, matchPlural = false) {
        const values = Array.from(new Set(this.tree.all.map(p => p[attrName]).filter(Boolean).map(v => v.trim())));
        values.sort((a, b) => b.length - a.length);

        for (const val of values) {
            const valLower = val.toLowerCase();
            const escaped = valLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = matchPlural ? `\\b${escaped}(?:s|es)?\\b` : `\\b${escaped}\\b`;
            const regex = new RegExp(pattern, 'i');
            if (regex.test(qLower) || qLower.includes(valLower)) {
                return val;
            }
        }
        return null;
    }

    /**
     * Formats an AI assistant response identifying the oldest resident in a place along with any other residents.
     *
     * @param {string} matchedPlace - Name of the matched geographic location
     * @param {Array<Object>} residents - List of domain person objects residing in this place
     * @param {function(Object): string} linkFn - Markdown link formatter for person profiles
     * @returns {string} Formatted markdown response
     *
     * @example
     * GenealogyEngine._formatOldestResidentAnswer('Kottayam', residents, p => `[${p.name}](...)`);
     *
     * @example
     * GenealogyEngine._formatOldestResidentAnswer('Thrissur', [p1, p2], p => `[${p.name}](${p.id})`);
     */
    static _formatOldestResidentAnswer(matchedPlace, residents, linkFn) {
        const sortedOldest = [...residents].sort((a, b) => (a.yob || a._inferredYob || 9999) - (b.yob || b._inferredYob || 9999));
        const oldest = sortedOldest[0];
        const others = sortedOldest.slice(1);
        let resStr = `The oldest recorded person in **${matchedPlace}** is **${linkFn(oldest)}** (born in **${oldest.yob || 'unknown'}**${oldest.death ? `, d. ${oldest.death}` : ''}${oldest.job ? `, ${oldest.job}` : ''}${oldest.family ? `, ${oldest.family} family` : ''}).`;
        if (others.length > 0) {
            resStr += `\n\n**Other residents in ${matchedPlace} (${others.length}):**\n` + 
                others.map(p => `• **${linkFn(p)}**${p.yob ? ` (b. ${p.yob}${p.death ? ` - d. ${p.death}` : ''})` : ''}${p.job ? ` • ${p.job}` : ''}${p.family ? ` • ${p.family}` : ''}`).join('\n');
        }
        return resStr;
    }

    /**
     * Formats an AI assistant response identifying the youngest resident in a place along with any other residents.
     *
     * @param {string} matchedPlace - Name of the matched geographic location
     * @param {Array<Object>} residents - List of domain person objects residing in this place
     * @param {function(Object): string} linkFn - Markdown link formatter for person profiles
     * @returns {string} Formatted markdown response
     *
     * @example
     * GenealogyEngine._formatYoungestResidentAnswer('Chicago', residents, p => `[${p.name}](...)`);
     *
     * @example
     * GenealogyEngine._formatYoungestResidentAnswer('London', [youngest, older], p => `[${p.name}](${p.id})`);
     */
    static _formatYoungestResidentAnswer(matchedPlace, residents, linkFn) {
        const sortedYoungest = [...residents].sort((a, b) => (b.yob || b._inferredYob || -9999) - (a.yob || a._inferredYob || -9999));
        const youngest = sortedYoungest[0];
        const others = sortedYoungest.slice(1);
        let resStr = `The youngest recorded person in **${matchedPlace}** is **${linkFn(youngest)}** (born in **${youngest.yob || 'unknown'}**${youngest.job ? `, ${youngest.job}` : ''}${youngest.family ? `, ${youngest.family} family` : ''}).`;
        if (others.length > 0) {
            resStr += `\n\n**Other residents in ${matchedPlace} (${others.length}):**\n` + 
                others.map(p => `• **${linkFn(p)}**${p.yob ? ` (b. ${p.yob})` : ''}${p.job ? ` • ${p.job}` : ''}${p.family ? ` • ${p.family}` : ''}`).join('\n');
        }
        return resStr;
    }

    /**
     * Formats an AI assistant response listing all recorded residents of a location sorted by year of birth.
     *
     * @param {string} matchedPlace - Name of the matched geographic location
     * @param {Array<Object>} residents - List of domain person objects residing in this place
     * @param {function(Object): string} linkFn - Markdown link formatter for person profiles
     * @returns {string} Formatted markdown response
     *
     * @example
     * GenealogyEngine._formatAllResidentsAnswer('Pala', residents, p => `[${p.name}](...)`);
     *
     * @example
     * GenealogyEngine._formatAllResidentsAnswer('Seattle', [p1, p2], p => `[${p.name}](${p.id})`);
     */
    static _formatAllResidentsAnswer(matchedPlace, residents, linkFn) {
        const sorted = [...residents].sort((a, b) => (a.yob || 9999) - (b.yob || 9999));
        const list = sorted.map(p => `• **${linkFn(p)}**${p.yob ? ` (b. ${p.yob}${p.death ? ` - d. ${p.death}` : ''})` : ''}${p.job ? ` • ${p.job}` : ''}${p.family ? ` • ${p.family}` : ''}`).join('\n');
        return `Found **${residents.length}** person(s) recorded in **${matchedPlace}**:\n\n${list}`;
    }

    /**
     * Answers queries regarding residents or superlatives within a specific geographic place.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Markdown response or null if place not matched
     *
     * @example
     * engine._answerLocationQuery('who is the oldest person in thrissur');
     *
     * @example
     * engine._answerLocationQuery('who all are in chalakudy');
     */
    _answerLocationQuery(qLower) {
        const matchedPlace = this._matchAttributeInQuery('place', qLower);
        if (!matchedPlace) return null;

        const plLower = matchedPlace.toLowerCase();
        const residents = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.place && p.place.toLowerCase().includes(plLower));
        if (residents.length === 0) return null;

        if (qLower.includes('oldest') || qLower.includes('earliest') || qLower.includes('first') || qLower.includes('elder') || qLower.includes('eldest')) {
            return AIAssistant._formatOldestResidentAnswer(matchedPlace, residents, p => this.link(p));
        }

        if (qLower.includes('youngest') || qLower.includes('latest') || qLower.includes('newest')) {
            return AIAssistant._formatYoungestResidentAnswer(matchedPlace, residents, p => this.link(p));
        }

        return AIAssistant._formatAllResidentsAnswer(matchedPlace, residents, p => this.link(p));
    }

    /**
     * Answers queries inquiring about people working in a specific job or profession.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Markdown response listing workers or null
     *
     * @example
     * engine._answerJobQuery('who are the engineers');
     *
     * @example
     * engine._answerJobQuery('list doctors');
     */
    _answerJobQuery(qLower) {
        const matchedJob = this._matchAttributeInQuery('job', qLower, true);
        if (!matchedJob || !GenealogyEngine._mentionsAny(qLower, GenealogyEngine.QUERY_INTENT_KEYWORDS.JOB)) return null;

        const jLower = matchedJob.toLowerCase();
        const workers = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.job && p.job.toLowerCase().includes(jLower));
        if (workers.length === 0) return null;

        const list = workers.map(p => `• **${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''}${p.place ? ` • ${p.place}` : ''}${p.family ? ` • ${p.family}` : ''}`).join('\n');
        return `Found **${workers.length}** person(s) working as **${matchedJob}**:\n\n${list}`;
    }

    /**
     * Answers queries inquiring about members belonging to a specific family or branch.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Markdown response listing family members or null
     *
     * @example
     * engine._answerFamilyQuery('who are in the mechery family');
     *
     * @example
     * engine._answerFamilyQuery('members of the alappat family');
     */
    _answerFamilyQuery(qLower) {
        const matchedFamily = this._matchAttributeInQuery('family', qLower);
        if (!matchedFamily || !GenealogyEngine._mentionsAny(qLower, GenealogyEngine.QUERY_INTENT_KEYWORDS.FAMILY)) return null;

        const fLower = matchedFamily.toLowerCase();
        const members = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.family && p.family.toLowerCase().includes(fLower));
        if (members.length === 0) return null;

        const list = members.map(p => `• **${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''}${p.place ? ` • ${p.place}` : ''}${p.job ? ` • ${p.job}` : ''}`).join('\n');
        return `Found **${members.length}** member(s) of the **${matchedFamily}** family:\n\n${list}`;
    }

    /**
     * Formats a person label with nickname and birth year for query disambiguation lists.
     * 
     * @param {Object} p - Person node
     * @param {string} displayQueryName - Query search name for nickname comparison
     * @returns {string} Formatted label markdown
     * 
     * @example
     *   _formatPersonQueryLabel(person, 'John')
     *   // => "**[John Paul](id)** (b. 1960, \"Johnny\")"
     * 
     * @example
     *   _formatPersonQueryLabel(personWithNickMatch, 'Johnny')
     *   // => "**[John](id)** (aka \"Johnny\", b. 1960)"
     */
    _formatPersonQueryLabel(p, displayQueryName) {
        const isNickMatch = this.clean(p.name) !== this.clean(displayQueryName);
        return isNickMatch 
            ? `**${this.link(p)}** (aka "${p.nick}", b. ${p.yob || '?'})` 
            : `**${this.link(p)}** (b. ${p.yob || '?'}${p.nick ? `, "${p.nick}"` : ''})`;
    }

    /**
     * Answers queries about spouse or partners for a single matched individual.
     * 
     * @param {Object} p - Matched person record
     * @param {string} qLower - Lowercase query string
     * @returns {string} Formatted markdown response
     * 
     * @example
     *   _answerSinglePersonSpouseQuery(marriedPerson, 'who is the husband?')
     *   // => "**[Mary](id)'s** husband is [John](id)."
     * 
     * @example
     *   _answerSinglePersonSpouseQuery(unmarriedPerson, 'who is the spouse?')
     *   // => "**[Paul](id)** has no recorded spouse or partner in the family tree."
     */
    _answerSinglePersonSpouseQuery(p, qLower) {
        if (p.partners && p.partners.length > 0) {
            const spouses = p.partners.map(id => this.tree.get(id)).filter(Boolean);
            const label = spouses.length > 1 ? 'partners are' : (qLower.includes('husband') ? 'husband is' : (qLower.includes('wife') ? 'wife is' : 'spouse is'));
            return `**${this.link(p)}'s** ${label} ${spouses.map(s => this.link(s)).join(', ')}.`;
        }
        return `**${this.link(p)}** has no recorded spouse or partner in the family tree.`;
    }

    /**
     * Formats spouse information for multiple matched individuals sharing a query name.
     * 
     * @param {Object[]} matchedPeople - Matching person records
     * @param {string} displayQueryName - Query name for display
     * @returns {string} Formatted markdown list
     * 
     * @example
     *   _formatMultiPersonSpouseList([p1, p2], 'John')
     *   // => "Found **2** people matching \"**John**\":\n\n• ..."
     * 
     * @example
     *   _formatMultiPersonSpouseList([p1], 'Mary')
     *   // => "Found **1** people matching \"**Mary**\":\n\n• ..."
     */
    _formatMultiPersonSpouseList(matchedPeople, displayQueryName) {
        const results = matchedPeople.map(p => {
            const label = this._formatPersonQueryLabel(p, displayQueryName);
            if (p.partners && p.partners.length > 0) {
                const spouses = p.partners.map(id => this.tree.get(id)).filter(Boolean);
                return `• ${label}: Spouse is ${spouses.map(s => this.link(s)).join(', ')}`;
            }
            return `• ${label}: No spouse recorded.`;
        });
        return `Found **${matchedPeople.length}** people matching "**${displayQueryName}**":\n\n${results.join('\n')}`;
    }

    /**
     * Answers spousal queries (husband, wife, partner) for matched people.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object[]} matchedPeople - Array of matching Person objects
     * @param {string} displayQueryName - Query name for display
     * @returns {string|null} Markdown response or null
     *
     * @example
     * engine._answerSpouseQuery('who is rosy wife', [rosy], 'Rosy');
     *
     * @example
     * engine._answerSpouseQuery('husband of mary', [mary1, mary2], 'Mary');
     */
    _answerSpouseQuery(qLower, matchedPeople, displayQueryName) {
        if (qLower.includes('husband') || qLower.includes('wife') || qLower.includes('spouse') || qLower.includes('partner') || qLower.includes('married')) {
            if (matchedPeople.length === 1) {
                return this._answerSinglePersonSpouseQuery(matchedPeople[0], qLower);
            }
            if (matchedPeople.length > 1) {
                return this._formatMultiPersonSpouseList(matchedPeople, displayQueryName);
            }
        }
        return null;
    }

    /**
     * Answers parent queries for a single matched individual.
     *
     * @param {Object} p - Matched person record
     * @param {string} qLower - Lowercase query string
     * @returns {string} Formatted response
     *
     * @example
     * engine._answerSinglePersonParentsQuery(person, 'father of john');
     * // => "**[John](id)'s** father is [Dad](dadId)."
     *
     * @example
     * engine._answerSinglePersonParentsQuery(personWithoutParents, 'who are parents');
     * // => "**[John](id)** has no recorded parents in the tree."
     */
    _answerSinglePersonParentsQuery(p, qLower) {
        const mom = p.momId ? this.tree.get(p.momId) : null;
        const dad = p.fatherId ? this.tree.get(p.fatherId) : null;

        if (qLower.includes('father') || qLower.includes('dad')) {
            return dad ? `**${this.link(p)}'s** father is ${this.link(dad)}.` : `**${this.link(p)}'s** father is not recorded in the tree.`;
        }
        if (qLower.includes('mother') || qLower.includes('mom')) {
            return mom ? `**${this.link(p)}'s** mother is ${this.link(mom)}.` : `**${this.link(p)}'s** mother is not recorded in the tree.`;
        }

        const parents = [dad, mom].filter(Boolean);
        if (parents.length > 0) {
            return `**${this.link(p)}'s** parents are ${parents.map(par => this.link(par)).join(' and ')}.`;
        }
        return `**${this.link(p)}** has no recorded parents in the tree.`;
    }

    /**
     * Formats parent information for multiple matched individuals sharing a query name.
     * 
     * @param {Object[]} matchedPeople - Matching person records
     * @param {string} displayQueryName - Query name for display
     * @returns {string} Formatted markdown list
     *
     * @example
     * engine._formatMultiPersonParentsList([p1, p2], 'John');
     * // => "Found **2** people matching \"**John**\":\n\n• ..."
     *
     * @example
     * engine._formatMultiPersonParentsList([p1], 'Mary');
     * // => "Found **1** people matching \"**Mary**\":\n\n• ..."
     */
    _formatMultiPersonParentsList(matchedPeople, displayQueryName) {
        const results = matchedPeople.map(p => {
            const label = this._formatPersonQueryLabel(p, displayQueryName);
            const mom = p.momId ? this.tree.get(p.momId) : null;
            const dad = p.fatherId ? this.tree.get(p.fatherId) : null;
            const par = [dad, mom].filter(Boolean);
            if (par.length > 0) {
                return `• ${label}: Parents are ${par.map(pr => this.link(pr)).join(' and ')}`;
            }
            return `• ${label}: No parents recorded.`;
        });
        return `Found **${matchedPeople.length}** people matching "**${displayQueryName}**":\n\n${results.join('\n')}`;
    }

    /**
     * Answers queries about parents (mother, father, or both) for matched people.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object[]} matchedPeople - Array of matched person profiles
     * @param {string} displayQueryName - Query display name
     * @returns {string|null} Formatted response or null
     *
     * @example
     * engine._answerParentsQuery('who is father of antu', [antu], 'Antu');
     * // => "**[Antu](id)'s** father is [George](dadId)."
     *
     * @example
     * engine._answerParentsQuery('who are cousins of antu', [antu], 'Antu');
     * // => null
     */
    _answerParentsQuery(qLower, matchedPeople, displayQueryName) {
        if (qLower.includes('father') || qLower.includes('dad') || qLower.includes('mother') || qLower.includes('mom') || qLower.includes('parent')) {
            if (matchedPeople.length === 1) {
                return this._answerSinglePersonParentsQuery(matchedPeople[0], qLower);
            }
            if (matchedPeople.length > 1) {
                return this._formatMultiPersonParentsList(matchedPeople, displayQueryName);
            }
        }
        return null;
    }

    /**
     * Answers queries about children for a single matched individual.
     * 
     * @param {Object} p - Matched person record
     * @returns {string} Formatted markdown response
     * 
     * @example
     *   _answerSinglePersonChildrenQuery(personWithKids)
     *   // => "**[John](id)** (b. 1950) has **2** recorded children:\n\n• ..."
     * 
     * @example
     *   _answerSinglePersonChildrenQuery(personWithoutKids)
     *   // => "**[Mary](id)** (b. 1960) has no recorded children in the tree."
     */
    _answerSinglePersonChildrenQuery(p) {
        const children = (p.children || []).map(id => this.tree.get(id)).filter(Boolean);
        if (children.length > 0) {
            const list = children.map(c => `• ${this.link(c)}${c.yob ? ` (b. ${c.yob})` : ''}${c.job ? ` • ${c.job}` : ''}`).join('\n');
            return `**${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''} has **${children.length}** recorded child${children.length > 1 ? 'ren' : ''}:\n\n${list}`;
        }
        return `**${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''} has no recorded children in the tree.`;
    }

    /**
     * Formats children information for multiple matched individuals sharing a query name.
     * 
     * @param {Object[]} matchedPeople - Matching person records
     * @param {string} displayQueryName - Query name for display
     * @returns {string} Formatted markdown list
     * 
     * @example
     *   _formatMultiPersonChildrenList([p1, p2], 'John')
     *   // => "Found **2** people matching \"**John**\":\n\n• ..."
     * 
     * @example
     *   _formatMultiPersonChildrenList([p1], 'Mary')
     *   // => "Found **1** people matching \"**Mary**\":\n\n• ..."
     */
    _formatMultiPersonChildrenList(matchedPeople, displayQueryName) {
        const sections = matchedPeople.map(p => {
            const label = this._formatPersonQueryLabel(p, displayQueryName);
            const children = (p.children || []).map(id => this.tree.get(id)).filter(Boolean);
            if (children.length > 0) {
                const list = children.map(c => `  • ${this.link(c)}${c.yob ? ` (b. ${c.yob})` : ''}${c.job ? ` • ${c.job}` : ''}`).join('\n');
                return `• ${label} has **${children.length}** child${children.length > 1 ? 'ren' : ''}:\n${list}`;
            }
            return `• ${label} has no recorded children.`;
        });

        return `Found **${matchedPeople.length}** people matching "**${displayQueryName}**":\n\n${sections.join('\n\n')}`;
    }

    /**
     * Answers queries about children (sons, daughters, kids) for matched people.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object[]} matchedPeople - Array of matched person profiles
     * @param {string} displayQueryName - Query display name
     * @returns {string|null} Formatted response or null
     *
     * @example
     * engine._answerChildrenQuery('who are children of john', [john], 'John');
     * // => "**[John](id)** (b. 1950) has **2** recorded children:\n\n• ..."
     *
     * @example
     * engine._answerChildrenQuery('tell me about job', [john], 'John');
     * // => null
     */
    _answerChildrenQuery(qLower, matchedPeople, displayQueryName) {
        if (qLower.includes('child') || qLower.includes('son') || qLower.includes('daughter') || qLower.includes('kid')) {
            if (matchedPeople.length === 1) {
                return this._answerSinglePersonChildrenQuery(matchedPeople[0]);
            }
            if (matchedPeople.length > 1) {
                return this._formatMultiPersonChildrenList(matchedPeople, displayQueryName);
            }
        }
        return null;
    }

    /**
     * Answers queries about siblings for a single matched individual.
     * 
     * @param {Object} p - Matched person record
     * @returns {string} Formatted markdown response
     * 
     * @example
     *   _answerSinglePersonSiblingsQuery(personWithSibs)
     *   // => "**[John](id)** has **2** recorded siblings:\n\n• ..."
     * 
     * @example
     *   _answerSinglePersonSiblingsQuery(onlyChild)
     *   // => "**[Mary](id)** has no recorded siblings in the tree."
     */
    _answerSinglePersonSiblingsQuery(p) {
        const sibs = this.tree.getSiblings(p.id);
        if (sibs.length > 0) {
            const list = sibs.map(s => `• ${this.link(s)}${s.yob ? ` (b. ${s.yob})` : ''}`).join('\n');
            return `**${this.link(p)}** has **${sibs.length}** recorded sibling${sibs.length > 1 ? 's' : ''}:\n\n${list}`;
        }
        return `**${this.link(p)}** has no recorded siblings in the tree.`;
    }

    /**
     * Formats sibling information for multiple matched individuals sharing a query name.
     * 
     * @param {Object[]} matchedPeople - Matching person records
     * @param {string} displayQueryName - Query name for display
     * @returns {string} Formatted markdown list
     * 
     * @example
     *   _formatMultiPersonSiblingsList([p1, p2], 'John')
     *   // => "Found **2** people matching \"**John**\":\n\n• ..."
     * 
     * @example
     *   _formatMultiPersonSiblingsList([p1], 'Mary')
     *   // => "Found **1** people matching \"**Mary**\":\n\n• ..."
     */
    _formatMultiPersonSiblingsList(matchedPeople, displayQueryName) {
        const results = matchedPeople.map(p => {
            const label = this._formatPersonQueryLabel(p, displayQueryName);
            const sibs = this.tree.getSiblings(p.id);
            if (sibs.length > 0) {
                return `• ${label} has **${sibs.length}** sibling${sibs.length > 1 ? 's' : ''}: ${sibs.map(s => this.link(s)).join(', ')}`;
            }
            return `• ${label}: No siblings recorded.`;
        });
        return `Found **${matchedPeople.length}** people matching "**${displayQueryName}**":\n\n${results.join('\n')}`;
    }

    /**
     * Answers queries about siblings (brothers, sisters) for matched people.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object[]} matchedPeople - Array of matched person profiles
     * @param {string} displayQueryName - Query display name
     * @returns {string|null} Formatted response or null
     *
     * @example
     * engine._answerSiblingsQuery('who are siblings of mary', [mary], 'Mary');
     * // => "**[Mary](id)** has **2** recorded siblings:\n\n• ..."
     *
     * @example
     * engine._answerSiblingsQuery('who is spouse of mary', [mary], 'Mary');
     * // => null
     */
    _answerSiblingsQuery(qLower, matchedPeople, displayQueryName) {
        if (qLower.includes('sibling') || qLower.includes('brother') || qLower.includes('sister')) {
            if (matchedPeople.length === 1) {
                return this._answerSinglePersonSiblingsQuery(matchedPeople[0]);
            }
            if (matchedPeople.length > 1) {
                return this._formatMultiPersonSiblingsList(matchedPeople, displayQueryName);
            }
        }
        return null;
    }

    /**
     * Collects recorded grandparent profiles for a given person.
     *
     * @param {Object} person - Domain person profile
     * @returns {Object[]} List of grandparent Person profiles
     *
     * @example
     * engine._collectGrandparents(person);
     * // => [grandpaPerson, grandmaPerson]
     *
     * @example
     * engine._collectGrandparents(rootPerson);
     * // => []
     */
    _collectGrandparents(person) {
        if (!person) return [];
        const parents = [person.momId, person.fatherId].map(id => this.tree.get(id)).filter(Boolean);
        const grandparents = [];
        parents.forEach(p => {
            if (p.fatherId && this.tree.get(p.fatherId)) grandparents.push(this.tree.get(p.fatherId));
            if (p.momId && this.tree.get(p.momId)) grandparents.push(this.tree.get(p.momId));
        });
        return grandparents;
    }

    /**
     * Answers grandparent queries for a given person.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object|null} person - Target person profile
     * @returns {string|null} Formatted response or null if query does not match
     *
     * @example
     * engine._answerGrandparentsQuery('who are grandparents of thomas', thomasPerson);
     * // => "Recorded grandparents for **[Thomas](id)**:\n\n• ..."
     *
     * @example
     * engine._answerGrandparentsQuery('tell me about siblings', thomasPerson);
     * // => null
     */
    _answerGrandparentsQuery(qLower, person) {
        if (qLower.includes('grandparent') || qLower.includes('grandfather') || qLower.includes('grandmother') || qLower.includes('grandpa') || qLower.includes('grandma')) {
            if (person) {
                const grandparents = this._collectGrandparents(person);
                if (grandparents.length > 0) {
                    const list = grandparents.map(gp => `• ${this.link(gp)}`).join('\n');
                    return `Recorded grandparents for **${this.link(person)}**:\n\n${list}`;
                }
                return `No grandparents are recorded for **${this.link(person)}**.`;
            }
        }
        return null;
    }

    /**
     * Finds and summarizes the oldest living person in the tree.
     * 
     * @returns {string|null} Summary text or null
     *
     * @example
     * engine._getOldestLivingSummary();
     * // => "The oldest living person in the tree is **[Paul](id)** (born in **1930**, age **~96**)."
     *
     * @example
     * emptyEngine._getOldestLivingSummary();
     * // => null
     */
    _getOldestLivingSummary() {
        const currentYear = new Date().getFullYear();
        const living = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && !p.death && p.yob).sort((a, b) => a.yob - b.yob);
        if (living.length > 0) {
            const oldestLiving = living[0];
            const age = currentYear - oldestLiving.yob;
            return `The oldest living person in the tree is **${this.link(oldestLiving)}** (born in **${oldestLiving.yob}**, age **~${age}**${oldestLiving.place ? `, living in ${oldestLiving.place}` : ''}${oldestLiving.job ? `, ${oldestLiving.job}` : ''}).`;
        }
        return null;
    }

    /**
     * Finds and summarizes the person with the longest recorded lifespan.
     * 
     * @returns {string|null} Summary text or null
     *
     * @example
     * engine._getLongestLifespanSummary();
     * // => "The person with the longest recorded lifespan is **[Mary](id)** (1900 - 2005, **105 years**)."
     *
     * @example
     * emptyEngine._getLongestLifespanSummary();
     * // => null
     */
    _getLongestLifespanSummary() {
        const currentYear = new Date().getFullYear();
        const withAge = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.yob).map(p => {
            const span = p.death ? (p.death - p.yob) : (currentYear - p.yob);
            return { person: p, span };
        }).filter(item => item.span > 0 && item.span < 130).sort((a, b) => b.span - a.span);

        if (withAge.length > 0) {
            const top = withAge[0];
            return `The person with the longest recorded lifespan is **${this.link(top.person)}** (${top.person.yob}${top.person.death ? ` - ${top.person.death}` : ''}, **${top.span} years**).`;
        }
        return null;
    }

    /**
     * Finds and summarizes the earliest recorded ancestor.
     * 
     * @returns {string|null} Summary text or null
     *
     * @example
     * engine._getEarliestAncestorSummary();
     * // => "The earliest recorded ancestor is **[Joseph](id)** (born in **1850**)."
     *
     * @example
     * emptyEngine._getEarliestAncestorSummary();
     * // => null
     */
    _getEarliestAncestorSummary() {
        const pool = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.yob).sort((a, b) => a.yob - b.yob);
        if (pool.length > 0) {
            const target = pool[0];
            return `The earliest recorded ancestor is **${this.link(target)}** (born in **${target.yob}**${target.place ? `, living in ${target.place}` : ''}${target.job ? `, ${target.job}` : ''}).`;
        }
        return null;
    }

    /**
     * Finds and summarizes the youngest recorded person.
     * 
     * @returns {string|null} Summary text or null
     *
     * @example
     * engine._getYoungestPersonSummary();
     * // => "The youngest recorded person in the tree is **[Baby](id)** (born in **2024**)."
     *
     * @example
     * emptyEngine._getYoungestPersonSummary();
     * // => null
     */
    _getYoungestPersonSummary() {
        const sortedYoungest = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.yob).sort((a, b) => b.yob - a.yob);
        if (sortedYoungest.length > 0) {
            const youngest = sortedYoungest[0];
            return `The youngest recorded person in the tree is **${this.link(youngest)}** (born in **${youngest.yob}**${youngest.place ? `, in ${youngest.place}` : ''}).`;
        }
        return null;
    }

    /**
     * Finds and summarizes the person with the most children recorded.
     * 
     * @returns {string|null} Summary text or null
     *
     * @example
     * engine._getMostChildrenSummary();
     * // => "**[Father](id)** has the most recorded children (**12**):\n\n• ..."
     *
     * @example
     * emptyEngine._getMostChildrenSummary();
     * // => null
     */
    _getMostChildrenSummary() {
        const withKids = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.children && p.children.length > 0).sort((a, b) => b.children.length - a.children.length);
        if (withKids.length > 0) {
            const top = withKids[0];
            const kids = top.children.map(id => this.tree.get(id)).filter(Boolean);
            return `**${this.link(top)}** has the most recorded children (**${kids.length}**):\n\n` + kids.map(k => `• ${this.link(k)}`).join('\n');
        }
        return null;
    }

    /**
     * Dispatches superlative queries across the family tree (oldest living, longest lifespan, earliest ancestor, youngest, most children).
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Formatted answer or null
     *
     * @example
     * engine._answerSuperlativeQuery('who is oldest living person');
     * // => "The oldest living person in the tree is..."
     *
     * @example
     * engine._answerSuperlativeQuery('who has the most children');
     * // => "**[Father](id)** has the most recorded children..."
     */
    _answerSuperlativeQuery(qLower) {
        const INTENTS = GenealogyEngine.QUERY_INTENT_KEYWORDS;
        const mentions = keywords => GenealogyEngine._mentionsAny(qLower, keywords);

        if (mentions(INTENTS.OLDEST_LIVING)) return this._getOldestLivingSummary();
        if (mentions(INTENTS.LONGEST_LIFESPAN)) return this._getLongestLifespanSummary();

        // "oldest person" alone means the earliest ancestor, but "oldest person IN Kottayam" is a
        // place-scoped query that _answerLocationQuery owns, so the bare phrasing is excluded here.
        const isPlaceScoped = qLower.includes(' in ');
        if (mentions(INTENTS.EARLIEST_ANCESTOR) || (mentions(INTENTS.OLDEST_PERSON) && !isPlaceScoped)) {
            return this._getEarliestAncestorSummary();
        }

        if (mentions(INTENTS.YOUNGEST)) return this._getYoungestPersonSummary();
        if (mentions(INTENTS.MOST_CHILDREN)) return this._getMostChildrenSummary();
        return null;
    }

    /**
     * Formats an answer listing all individuals who passed away in the specified calendar year.
     *
     * @param {number} year - Four-digit calendar year
     * @returns {string|null} Formatted markdown list of deceased individuals or null if none
     *
     * @example
     *   _formatYearDiedAnswer(1985) // "Found **2** person(s) who passed away in **1985**:\n\n• **[John](id)** (b. 1910)"
     * @example
     *   _formatYearDiedAnswer(1750) // null
     */
    _formatYearDiedAnswer(year) {
        const diedList = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.death === year);
        if (diedList.length > 0) {
            return `Found **${diedList.length}** person(s) who passed away in **${year}**:\n\n` + diedList.map(p => `• **${this.link(p)}** (b. ${p.yob || '?'})`).join('\n');
        }
        return null;
    }

    /**
     * Formats an answer listing all individuals born in the specified calendar year.
     *
     * @param {number} year - Four-digit calendar year
     * @returns {string|null} Formatted markdown list of individuals born in that year or null if none
     *
     * @example
     *   _formatYearBornAnswer(1950) // "Found **1** person(s) born in **1950**:\n\n• **[Paul](id)** in Kochi • Engineer"
     * @example
     *   _formatYearBornAnswer(1700) // null
     */
    _formatYearBornAnswer(year) {
        const bornList = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p.yob === year);
        if (bornList.length > 0) {
            return `Found **${bornList.length}** person(s) born in **${year}**:\n\n` + bornList.map(p => `• **${this.link(p)}**${p.place ? ` in ${p.place}` : ''}${p.job ? ` • ${p.job}` : ''}`).join('\n');
        }
        return null;
    }

    /**
     * Answers queries asking who was born or passed away in a specific 4-digit calendar year.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Formatted answer or null
     *
     * @example
     * engine._answerYearQuery('who died in 1985');
     * // => "Found **2** person(s) who passed away in **1985**:\n\n• ..."
     *
     * @example
     * engine._answerYearQuery('who was born in 1950');
     * // => "Found **1** person(s) born in **1950**:\n\n• ..."
     */
    _answerYearQuery(qLower) {
        const yearMatch = qLower.match(/\b(18\d\d|19\d\d|20\d\d)\b/);
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (qLower.includes('died') || qLower.includes('death')) {
                return this._formatYearDiedAnswer(year);
            }
            if (qLower.includes('born') || qLower.includes('birth')) {
                return this._formatYearBornAnswer(year);
            }
        }
        return null;
    }

    /**
     * Compiles an array of profile bullet points (lifespan, family, career, location, parents, spouses, children, siblings).
     * 
     * @param {Object} person - Target person node
     * @returns {string[]} Bullet lines describing person
     * 
     * @example
     *   _buildPersonSummaryDetails(person)
     *   // => ["• **Lifespan**: 1950 - 2020", "• **Career**: Engineer"]
     * 
     * @example
     *   _buildPersonSummaryDetails(childlessPerson)
     *   // => ["• **Lifespan**: 1990 - Present"]
     */
    _buildPersonSummaryDetails(person) {
        const { dateStr, extraStr } = person.getDateStrings();
        const parents = [person.fatherId, person.momId].map(id => this.tree.get(id)).filter(Boolean);
        const spouses = person.partners.map(id => this.tree.get(id)).filter(Boolean);
        const children = person.children.map(id => this.tree.get(id)).filter(Boolean);
        const sibs = this.tree.getSiblings(person.id);

        const details = [];
        if (dateStr) details.push(`• **Lifespan**: ${dateStr}${extraStr ? ` (${extraStr})` : ''}`);
        if (person.family) details.push(`• **Family**: ${person.family}`);
        if (person.job) details.push(`• **Career**: ${person.job}`);
        if (person.place) details.push(`• **Location**: ${person.place}`);
        if (parents.length > 0) details.push(`• **Parents**: ${parents.map(p => this.link(p)).join(', ')}`);
        if (spouses.length > 0) details.push(`• **Spouse**: ${spouses.map(s => this.link(s)).join(', ')}`);
        if (children.length > 0) details.push(`• **Children** (${children.length}): ${children.map(c => this.link(c)).join(', ')}`);
        if (sibs.length > 0) details.push(`• **Siblings** (${sibs.length}): ${sibs.map(s => this.link(s)).join(', ')}`);
        return details;
    }

    /**
     * Answers queries requesting a biographical summary/profile of a single individual.
     *
     * @param {string} qLower - Lowercase query string
     * @param {Object|null} person - Target person profile
     * @returns {string|null} Formatted markdown profile summary or null
     *
     * @example
     * engine._answerSinglePersonSummary('tell me about joseph', josephPerson);
     * // => "### [Joseph](id)\n\n• **Lifespan**: 1920 - 2010..."
     *
     * @example
     * engine._answerSinglePersonSummary('who are the engineers', null);
     * // => null
     */
    _answerSinglePersonSummary(qLower, person) {
        if (person && (qLower.startsWith('tell me about') || qLower.startsWith('who is') || qLower.startsWith('profile of')) && !qLower.includes(' and ')) {
            const details = this._buildPersonSummaryDetails(person);
            return `### ${this.link(person)}\n\n${details.join('\n')}`;
        }
        return null;
    }

    /**
     * Formats an overview summary of the entire family tree, including total individuals,
     * time span, and approximate number of generations.
     *
     * @returns {string} Markdown-formatted family tree overview summary
     *
     * @example
     *   _formatTreeOverviewSummary()
     *   // => "### Family Tree Overview\n\n• **Total Individuals**: 120 people..."
     *
     * @example
     *   _formatTreeOverviewSummary()
     *   // Returns structured stats markdown block
     */
    _formatTreeOverviewSummary() {
        const stats = this.tree.getStats();
        const total = this.tree.all.filter(p => !p.isGhost && !p._isUnknown).length;
        return `### Family Tree Overview\n\n• **Total Individuals**: ${total} people\n• **Time Span**: ${stats.minYear} – ${stats.maxYear}\n• **Generations**: ~${stats.generationsCount} generations`;
    }

    /**
     * Answers general family tree count and statistical summary queries.
     *
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Formatted markdown tree statistics or null
     *
     * @example
     * engine._answerTreeStatsQuery('how many people in the tree');
     * // => "### Family Tree Overview\n\n• **Total Individuals**: 120..."
     *
     * @example
     * engine._answerTreeStatsQuery('tell me about antu');
     * // => null
     */
    _answerTreeStatsQuery(qLower) {
        if (qLower.includes('how many') || qLower.includes('total') || qLower.includes('count') || qLower.includes('stats')) {
            return this._formatTreeOverviewSummary();
        }
        return null;
    }

    /**
     * Formats a markdown list of multiple matched people profiles with year of birth, place, and job.
     *
     * @param {Object[]} matchedPeople - Array of matched person records (3 or more)
     * @returns {string} Formatted markdown list of matched people
     *
     * @example
     *   _formatMultipleMatchedPeopleList([p1, p2, p3])
     *   // => "Found **3** people matching your query:\n\n• **[P1](id)** (b. 1950)..."
     *
     * @example
     *   _formatMultipleMatchedPeopleList(allPeople)
     *   // Returns list of all matching candidates
     */
    _formatMultipleMatchedPeopleList(matchedPeople) {
        const list = matchedPeople.map(p => `• **${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''}${p.place ? ` in ${p.place}` : ''}${p.job ? ` • ${p.job}` : ''}`).join('\n');
        return `Found **${matchedPeople.length}** people matching your query:\n\n${list}`;
    }

    /**
     * Answers queries referencing one, two, or multiple specific individuals.
     * 
     * @param {Object[]} matchedPeople - People matched in the query
     * @returns {string} Formatted response
     * 
     * @example
     * engine._answerMatchedPeopleQuery([p1]);
     * // => "Here is the record for [P1]..."
     *
     * @example
     * engine._answerMatchedPeopleQuery([p1, p2]);
     * // => "[P1] is the spouse of [P2]."
     */
    _answerMatchedPeopleQuery(matchedPeople) {
        if (matchedPeople.length === 1) {
            const person = matchedPeople[0];
            const details = this._buildPersonSummaryDetails(person);
            return `Here is the record for **${this.link(person)}** in the family tree:\n\n${details.join('\n')}`;
        }
        if (matchedPeople.length === 2) {
            const p1 = matchedPeople[0];
            const p2 = matchedPeople[1];
            return `**${this.link(p1)}** is ${this.getRelationship(p1, p2)}.`;
        }
        return this._formatMultipleMatchedPeopleList(matchedPeople);
    }

    /**
     * Checks if a query mentions a known attribute (e.g. location or job) and formats
     * a markdown bulleted list of matching individuals.
     *
     * @param {string} attrName - Target person attribute ('place' or 'job')
     * @param {string} qLower - Lowercase query string
     * @param {function(number, string): string} headerPattern - Header format callback before the list
     * @param {function(Person): string} secondaryInfoFormatter - Formatter for secondary attribute info
     * @returns {string|null} Markdown summary or null if no attribute matched
     *
     * @example
     *   engine._formatAttributeFallbackResponse('place', 'who is in thrissur', (count, val) => `Found **${count}** people in **${val}**:`, p => p.job ? ` • ${p.job}` : '')
     *   // => "Found **3** people in **Thrissur**:\n\n• **Alice**..."
     *
     * @example
     *   engine._formatAttributeFallbackResponse('job', 'who is a doctor', (count, val) => `Found **${count}** person(s) working as **${val}**:`, p => p.place ? ` in ${p.place}` : '')
     *   // => "Found **1** person(s) working as **Doctor**:\n\n• **Bob**..."
     */
    _formatAttributeFallbackResponse(attrName, qLower, headerPattern, secondaryInfoFormatter) {
        const values = Array.from(new Set(this.tree.all.map(p => p[attrName]).filter(Boolean).map(val => val.trim())));
        for (const val of values) {
            if (qLower.includes(val.toLowerCase())) {
                const matches = this.tree.all.filter(p => !p.isGhost && !p._isUnknown && p[attrName] && p[attrName].toLowerCase().includes(val.toLowerCase()));
                if (matches.length > 0) {
                    const list = matches.map(p => `• **${this.link(p)}**${p.yob ? ` (b. ${p.yob})` : ''}${secondaryInfoFormatter(p)}`).join('\n');
                    return `${headerPattern(matches.length, val)}\n\n${list}`;
                }
            }
        }
        return null;
    }

    /**
     * Checks if a query mentions a known location and returns matching residents.
     * 
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Residents summary or null
     *
     * @example
     *   engine._answerLocationFallback('who lives in thrissur')
     *   // => "Found **5** people in **Thrissur**:\n\n• **Alice**..."
     *
     * @example
     *   engine._answerLocationFallback('unknown place')
     *   // => null
     */
    _answerLocationFallback(qLower) {
        return this._formatAttributeFallbackResponse(
            'place',
            qLower,
            (count, val) => `Found **${count}** people in **${val}**:`,
            p => (p.job ? ` • ${p.job}` : '')
        );
    }

    /**
     * Checks if a query mentions a known profession and returns matching individuals.
     * 
     * @param {string} qLower - Lowercase query string
     * @returns {string|null} Workers summary or null
     *
     * @example
     *   engine._answerJobFallback('who works as engineer')
     *   // => "Found **2** person(s) working as **Engineer**:\n\n• **Bob**..."
     *
     * @example
     *   engine._answerJobFallback('astronaut')
     *   // => null
     */
    _answerJobFallback(qLower) {
        return this._formatAttributeFallbackResponse(
            'job',
            qLower,
            (count, val) => `Found **${count}** person(s) working as **${val}**:`,
            p => (p.place ? ` in ${p.place}` : '')
        );
    }

    /**
     * Builds the default guided response for unrecognized queries, describing total individuals,
     * generations, year bounds, and sample questions based on prominent places in the tree.
     *
     * @returns {string} Formatted markdown guided assistance summary
     *
     * @example
     *   _buildDefaultHelpfulSummary()
     *   // => "The family tree contains **120 individuals** across ~**4 generations**..."
     *
     * @example
     *   _buildDefaultHelpfulSummary()
     *   // Returns default query prompt suggestions
     */
    _buildDefaultHelpfulSummary() {
        const places = Array.from(new Set(this.tree.all.map(p => p.place).filter(Boolean).map(pl => pl.trim())));
        const stats = this.tree.getStats();
        const total = this.tree.all.filter(p => !p.isGhost && !p._isUnknown).length;
        return `The family tree contains **${total} individuals** across ~**${stats.generationsCount} generations** (${stats.minYear} – ${stats.maxYear}).\n\nTry asking:\n• *"Who is the oldest person in ${places[0] || 'the tree'}?"*\n• *"Who all are in ${places[1] || 'California'}?"*\n• *"Who are the children of Brijitha?"*\n• *"Who is the earliest ancestor?"*`;
    }

    /**
     * Resolves an answer for any natural language genealogical query using deterministic rules,
     * entity extraction, location/job matching, or default guided prompts.
     *
     * @param {string} query - Natural language query
     * @returns {string} Formatted markdown response
     *
     * @example
     * engine.fallbackAnswer('Who is Rosy\'s husband?');
     * // => "**Rosy's** husband is Antu."
     *
     * @example
     * engine.fallbackAnswer('unknown inquiry');
     * // => "The family tree contains **120 individuals**..."
     */
    fallbackAnswer(query) {
        const direct = this.tryDirectAnswer(query);
        if (direct) return direct;

        const q = (query || '').trim();
        const qLower = q.toLowerCase();
        
        // 1. Check if any people in tree are mentioned in query
        const matchedPeople = this.extractPeopleFromQuery(q);
        if (matchedPeople.length > 0) {
            return this._answerMatchedPeopleQuery(matchedPeople);
        }

        // 2. Check if any location is mentioned
        const locAnswer = this._answerLocationFallback(qLower);
        if (locAnswer) return locAnswer;

        // 3. Check if any job is mentioned
        const jobAnswer = this._answerJobFallback(qLower);
        if (jobAnswer) return jobAnswer;

        // 4. Default helpful tree summary
        return this._buildDefaultHelpfulSummary();
    }

    /**
     * Public entrypoint to query the genealogical engine for direct answers.
     *
     * @param {string} query - Natural language question
     * @returns {string} Answer response string
     *
     * @example
     * engine.answer('How many people in the tree?');
     * // => "### Family Tree Overview..."
     *
     * @example
     * engine.answer('Tell me about Joseph');
     * // => "### [Joseph](id)..."
     */
    answer(query) {
        return this.fallbackAnswer(query);
    }
}

/**
 * Extracts a lightweight, structured JSON-serializable context of all real family tree profiles.
 *
 * Excludes ghost and unknown nodes. Maps relatives to their names for prompt embedding.
 *
 * @param {FamilyTree} tree - Active family tree model
 * @returns {Array<Object>} Structured context array
 *
 * @example
 * const context = buildTreeAIContext(tree);
 * // => [{ id: 'Paul_1940_1', name: 'Paul', father: 'Joseph', ... }]
 *
 * @example
 * const emptyContext = buildTreeAIContext(null);
 * // => []
 */
function buildTreeAIContext(tree) {
    if (!tree || !tree.all) return [];
    return tree.all.filter(p => !p.isGhost && !p._isUnknown).map(p => ({
        id: p.id,
        name: p.name,
        nick: p.nick || undefined,
        gender: p.gender || undefined,
        yob: p.yob || p._inferredYob || undefined,
        death: p.death || undefined,
        age: p.age || (p.yob && !p.death ? (new Date().getFullYear() - p.yob) : undefined),
        family: p.family || undefined,
        job: p.job || undefined,
        place: p.place || undefined,
        father: tree.get(p.fatherId)?.name || undefined,
        mother: tree.get(p.momId)?.name || undefined,
        spouses: (p.partners || []).map(pid => tree.get(pid)?.name).filter(Boolean),
        children: (p.children || []).map(cid => tree.get(cid)?.name).filter(Boolean)
    }));
}

/**
 * Builds the system prompt grounding Gemini models in the active family tree dataset.
 *
 * @param {Array<Object>} treeContext - Structured tree context
 * @returns {string} System prompt string
 *
 * @example
 * const prompt = buildGenealogySystemPrompt(treeContext);
 *
 * @example
 * const emptyPrompt = buildGenealogySystemPrompt([]);
 */
function buildGenealogySystemPrompt(treeContext) {
    return `You are an expert genealogist answering questions about the user's family tree.
The entire family tree dataset is provided below as a structured JSON array of individual profiles.

Answer the user's question accurately, concisely, and insightfully based strictly on this dataset.
Do not hallucinate relationships or facts not in the tree.

CRITICAL INSTRUCTIONS FOR NAMES AND IDS:
Whenever you mention a specific person in your response, you MUST format their name as a markdown link using their exact "id" from the JSON as the URL.
Format: [Person Name](exact_id_here)
Example: [Nila](Nila_2015_92)
This allows the user to click any name to instantly highlight and focus their card in the interactive tree diagram.

Use **bold** for key facts, dates, and locations.
Use clean markdown bullet points when listing multiple individuals.

Family Tree Data:
${JSON.stringify(treeContext, null, 2)}`;
}

/**
 * Resolves priority endpoint URLs for Gemini API requests based on environment setting.
 *
 * @param {string} [envSetting='auto'] - 'auto' | 'prod'
 * @returns {Array<string>} Prioritized list of base API URLs
 *
 * @example
 * getGeminiEndpoints('auto');
 * // => ['https://generativelanguage.googleapis.com/v1beta']
 *
 * @example
 * getGeminiEndpoints('prod');
 * // => ['https://generativelanguage.googleapis.com/v1beta']
 */
function getGeminiEndpoints(envSetting = 'auto') {
    return ['https://generativelanguage.googleapis.com/v1beta'];
}

/**
 * Helper to render delimited inline markdown spans (e.g. bold or italic).
 *
 * @param {Array<string>} parts - Text split by delimiter regex
 * @param {Object} spanStyle - Span formatting specification ({ delimiter, className, tag })
 * @param {string} keyPrefix - React key prefix
 * @param {object} tree - Family tree model
 * @param {Function} onFocusPerson - Navigation callback
 * @returns {React.ReactNode[]} Rendered span elements
 *
 * @example
 * _renderDelimitedSpan(['**bold**'], { delimiter: '**', className: 'font-bold text-slate-900', tag: 'b' }, 'k1', tree, fn);
 * // => [<strong key="k1-b-0" className="...">bold</strong>]
 *
 * @example
 * _renderDelimitedSpan(['*italic*'], { delimiter: '*', className: 'italic text-slate-800', tag: 'i' }, 'k2', tree, fn);
 * // => [<em key="k2-i-0" className="...">italic</em>]
 */
function _renderDelimitedSpan(parts, spanStyle, keyPrefix, tree, onFocusPerson) {
    const { delimiter, className, tag } = spanStyle;
    const isStrong = tag === 'b';
    return parts.map((part, i) => {
        if (part.startsWith(delimiter) && part.endsWith(delimiter)) {
            const inner = part.slice(delimiter.length, -delimiter.length);
            const content = parseAiMarkdownText(inner, `${keyPrefix}-${tag}-${i}`, tree, onFocusPerson);
            return isStrong ? (
                <strong key={`${keyPrefix}-${tag}-${i}`} className={className}>{content}</strong>
            ) : (
                <em key={`${keyPrefix}-${tag}-${i}`} className={className}>{content}</em>
            );
        }
        return parseAiMarkdownText(part, `${keyPrefix}-t-${i}`, tree, onFocusPerson);
    });
}

/**
 * Parses and renders clickable person profile links from markdown link syntax.
 *
 * @param {Array<string>} linkParts - Text split by link regex
 * @param {string} keyPrefix - React key prefix
 * @param {object} tree - Family tree model
 * @param {Function} onFocusPerson - Navigation callback
 * @returns {React.ReactNode[]} Rendered link buttons or plain text fragments
 *
 * @example
 * _renderPersonLinks(['[George](p_123)'], 'k1', tree, fn);
 * // => [<button key="k1-l-0" ...>George</button>]
 *
 * @example
 * _renderPersonLinks(['plain text without link'], 'k2', tree, fn);
 * // => [<React.Fragment key="k2-frag-0">plain text without link</React.Fragment>]
 */
function _renderPersonLinks(linkParts, keyPrefix, tree, onFocusPerson) {
    return linkParts.map((part, i) => {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            const linkText = linkMatch[1].replace(/\*/g, '');
            const targetId = linkMatch[2];
            const isValid = !!(tree && tree.get && tree.get(targetId));
            if (isValid && typeof onFocusPerson === 'function') {
                return (
                    <button
                        key={`${keyPrefix}-l-${i}`}
                        onClick={(e) => { e.preventDefault(); onFocusPerson(targetId); }}
                        className="inline text-blue-700 hover:text-blue-900 bg-blue-100/50 hover:bg-blue-200 px-1 rounded transition-colors font-semibold cursor-pointer align-baseline shadow-sm border border-blue-200/50"
                        title={`Focus on ${linkText}`}
                    >
                        {linkText}
                    </button>
                );
            }
            return <strong key={`${keyPrefix}-l-${i}`} className="text-slate-800 font-semibold">{linkText}</strong>;
        }
        return <React.Fragment key={`${keyPrefix}-frag-${i}`}>{part}</React.Fragment>;
    });
}

/**
 * Formats inline markdown styling (bold, italics, and person profile links).
 *
 * @param {string} text - Inline text content to format
 * @param {string} [keyPrefix=''] - Unique key prefix for React reconciliation
 * @param {object} [tree=null] - Family tree model to validate person IDs
 * @param {Function} [onFocusPerson=null] - Callback when person link is clicked
 * @returns {React.ReactNode} Formatted React elements or raw string
 *
 * @example
 * parseAiMarkdownText('**George** is the father of *Paul*', 'k1', tree, fn)
 * // => [<strong key="k1-b-0">George</strong>, ' is the father of ', <em key="k1-i-0">Paul</em>]
 *
 * @example
 * parseAiMarkdownText('Focus on [George](p_123)', 'k2', tree, fn)
 * // => ['Focus on ', <button key="k2-l-0" onClick=...>George</button>]
 */
function parseAiMarkdownText(text, keyPrefix = '', tree = null, onFocusPerson = null) {
    if (!text) return null;

    const boldParts = text.split(/(\*\*(?:.*?)\*\*)/g);
    if (boldParts.length > 1) {
        return _renderDelimitedSpan(boldParts, { delimiter: '**', className: 'font-bold text-slate-900', tag: 'b' }, keyPrefix, tree, onFocusPerson);
    }

    const italicParts = text.split(/(\*(?:.*?)\*)/g);
    if (italicParts.length > 1) {
        return _renderDelimitedSpan(italicParts, { delimiter: '*', className: 'italic text-slate-800', tag: 'i' }, keyPrefix, tree, onFocusPerson);
    }

    const linkParts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    if (linkParts.length > 1) {
        return _renderPersonLinks(linkParts, keyPrefix, tree, onFocusPerson);
    }

    return text;
}

/**
 * Renders a markdown header block with level-appropriate typography.
 *
 * @param {Array<string>} headerMatch - Regex match array for header
 * @param {number} lineIndex - Line index for keying
 * @param {Function} parseInlineText - Inline parser callback
 * @returns {React.ReactNode} Rendered header element
 *
 * @example
 * _renderMarkdownHeader(['# Header', '#', 'Header'], 0, parseFn);
 * // => <div key="h-0" className="...">Header</div>
 *
 * @example
 * _renderMarkdownHeader(['## Subtitle', '##', 'Subtitle'], 1, parseFn);
 * // => <div key="h-1" className="...">Subtitle</div>
 */
function _renderMarkdownHeader(headerMatch, lineIndex, parseInlineText) {
    const level = headerMatch[1].length;
    const content = parseInlineText(headerMatch[2], `line-${lineIndex}`);
    let headerClass = "font-bold text-slate-800 mb-2 mt-3";
    if (level === 1) headerClass += " text-lg border-b pb-1";
    else if (level === 2) headerClass += " text-[15px]";
    else headerClass += " text-[14px]";
    return <div key={`h-${lineIndex}`} className={headerClass}>{content}</div>;
}

/**
 * Renders a markdown list item with nested indentation styling.
 *
 * @param {Array<string>} listMatch - Regex match array for list item
 * @param {number} lineIndex - Line index for keying
 * @param {Function} parseInlineText - Inline parser callback
 * @returns {React.ReactNode} Rendered <li> element
 *
 * @example
 * _renderMarkdownListItem(['* Item', '', 'Item'], 0, parseFn);
 * // => <li key="li-0" className="...">...</li>
 *
 * @example
 * _renderMarkdownListItem(['  * Subitem', '  ', 'Subitem'], 1, parseFn);
 * // => <li key="li-1" className="...">...</li>
 */
function _renderMarkdownListItem(listMatch, lineIndex, parseInlineText) {
    const isNested = listMatch[1].length > 0;
    const className = `leading-relaxed ${isNested ? 'ml-5 list-[circle] text-[13px] text-slate-700 my-0.5' : 'font-medium mt-1.5 pl-1'}`;
    return (
        <li key={`li-${lineIndex}`} className={className}>
            {parseInlineText(listMatch[2], `line-${lineIndex}`)}
        </li>
    );
}

/**
 * Renders a non-list markdown line as either a header or paragraph element.
 *
 * @param {string} line - Raw markdown line text
 * @param {number} lineIndex - Line index for key generation
 * @param {Function} parseInlineText - Inline parser function
 * @returns {React.ReactNode} Rendered React element
 *
 * @example
 * _renderMarkdownNonListElement('## Title', 2, parseFn);
 * // => <div key="h-2" ...>Title</div>
 *
 * @example
 * _renderMarkdownNonListElement('Regular paragraph text', 3, parseFn);
 * // => <div key="p-3" ...>Regular paragraph text</div>
 */
function _renderMarkdownNonListElement(line, lineIndex, parseInlineText) {
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
        return _renderMarkdownHeader(headerMatch, lineIndex, parseInlineText);
    }
    return (
        <div key={`p-${lineIndex}`} className="mb-2 last:mb-0 leading-relaxed">
            {parseInlineText(line, `line-${lineIndex}`)}
        </div>
    );
}

/**
 * Transforms a multi-line markdown message into formatted headings, lists, and paragraphs.
 *
 * @param {string} text - Multiline response text from assistant or user
 * @param {Function} parseInlineText - Function to parse inline formatting within each block
 * @returns {React.ReactNode[]} Array of structured React elements
 *
 * @example
 * renderAiMarkdownMessage('# Header\n* Item 1\n* Item 2', parseFn);
 * // => [<div key="h-0" className="...">Header</div>, <ul key="ul-end" className="...">...</ul>]
 *
 * @example
 * renderAiMarkdownMessage('Single body paragraph', parseFn);
 * // => [<div key="p-0" className="...">Single body paragraph</div>]
 */
function renderAiMarkdownMessage(text, parseInlineText) {
    const lines = (text || '').split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];
    const flushList = (key) => {
        if (inList) {
            elements.push(<ul key={key} className="list-disc pl-5 mb-2 space-y-1">{listItems}</ul>);
            listItems = [];
            inList = false;
        }
    };
    lines.forEach((line, i) => {
        if (!line.trim()) {
            flushList(`ul-${i}`);
            elements.push(<div key={`br-${i}`} className="h-2" />);
            return;
        }
        const listMatch = line.match(/^(\s*)(?:\*|-|•)\s+(.*)$/);
        if (listMatch) {
            inList = true;
            listItems.push(_renderMarkdownListItem(listMatch, i, parseInlineText));
        } else {
            flushList(`ul-${i}-close`);
            elements.push(_renderMarkdownNonListElement(line, i, parseInlineText));
        }
    });
    flushList('ul-end');
    return elements;
}