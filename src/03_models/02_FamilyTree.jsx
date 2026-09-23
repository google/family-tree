class FamilyTree {
    /**
     * Identifies whether a person entity is a synthetic ghost parent created solely to hold sibling relationships.
     * 
     * @param {Object} person - The person instance to inspect
     * @returns {boolean} True if person is a synthetic sibling ghost parent
     *
     * @example
     * FamilyTree.isSyntheticSiblingParent({ isGhost: true, name: 'Rosa Father' });
     * // => true
     *
     * @example
     * FamilyTree.isSyntheticSiblingParent({ id: 'real', isGhost: false });
     * // => false
     */
    static isSyntheticSiblingParent(person) {
        if (!person || !person.isGhost) return false;
        if (person._isSyntheticSiblingParent) return true;
        if (person.name && (person.name.endsWith(' Father') || person.name.endsWith(' Mother'))) {
            if (!person.momId && !person.fatherId && !person.mom && !person.father) {
                return true;
            }
        }
        return false;
    }

    /**
     * Constructs a FamilyTree populated with Person instances.
     *
     * @param {Object} [nodeMap={}] - Dictionary mapping person IDs to profile objects
     * @param {string|null} [rootId=null] - Primary root node identifier
     * @param {Object} [sheetNames={}] - Dictionary of spreadsheet tab names
     *
     * @example
     * const tree = new FamilyTree({ a: { id: 'a', name: 'Alice' } }, 'a');
     * tree.root.id; // => 'a'
     *
     * @example
     * const emptyTree = new FamilyTree();
     * emptyTree.all; // => []
     */
    constructor(nodeMap = {}, rootId = null, sheetNames = {}) {
        this.nodes = {};
        for (const [id, data] of Object.entries(nodeMap)) {
            this.nodes[id] = new Person(data);
        }
        this.rootId = rootId;
        this.sheetNames = sheetNames;
    }

    /**
     * Looks up a person instance by identifier.
     *
     * @param {string} id - Person ID
     * @returns {Person|null} Person instance or null if absent
     *
     * @example
     * tree.get('p1'); // => Person instance
     *
     * @example
     * tree.get('unknown'); // => null
     */
    get(id) { return this.nodes[id] || null; }

    /**
     * Retrieves the primary root person instance.
     *
     * @type {Person|null}
     *
     * @example
     * tree.root; // => primary root Person
     *
     * @example
     * const empty = new FamilyTree();
     * empty.root; // => null
     */
    get root() { return this.get(this.rootId); }

    /**
     * Retrieves an array of all person instances in the tree.
     *
     * @type {Person[]}
     *
     * @example
     * tree.all.length; // => total count of people
     *
     * @example
     * const names = tree.all.map(p => p.name);
     */
    get all() { return Object.values(this.nodes); }

    /**
     * Determines whether a person node has no concrete parent lineage in the tree (acts as an ancestral root).
     *
     * @param {Person} person - Domain person node
     * @returns {boolean} True if person lacks concrete, non-ghost parents
     *
     * @example
     * tree._isLineageRoot(adam);
     * // => true
     *
     * @example
     * tree._isLineageRoot(childWithParents);
     * // => false
     */
    _isLineageRoot(person) {
        if (!person) return false;
        const mom = this.get(person.momId);
        const dad = this.get(person.fatherId);
        return (!mom || mom.isGhost || mom._isUnknown) && (!dad || dad.isGhost || dad._isUnknown);
    }

    /**
     * Computes the maximum downward generational depth from a starting person node using memoized traversal.
     *
     * @param {string} id - Person ID
     * @param {Map<string, number>} memo - Memoization map for computed subtree depths
     * @param {Set<string>} [visited=new Set()] - Set of visited node IDs to guard against cycles
     * @returns {number} Subtree depth (minimum 1)
     *
     * @example
     * tree._computeSubtreeGenerations('rootId', new Map());
     * // => 3
     *
     * @example
     * tree._computeSubtreeGenerations('leafId', new Map());
     * // => 1
     */
    _computeSubtreeGenerations(id, memo, visited = new Set()) {
        if (!id || visited.has(id)) return 0;
        if (memo.has(id)) return memo.get(id);

        visited.add(id);
        const p = this.get(id);
        if (!p || !p.children || p.children.length === 0) {
            memo.set(id, 1);
            return 1;
        }

        let maxChild = 0;
        for (const cId of p.children) {
            maxChild = Math.max(maxChild, this._computeSubtreeGenerations(cId, memo, new Set(visited)));
        }

        const depth = 1 + maxChild;
        memo.set(id, depth);
        return depth;
    }

    /**
     * Calculates the maximum generational height of the tree using memoized DAG depth traversal.
     * 
     * @returns {number} The maximum generational depth (minimum 1)
     * 
     * @example
     * tree.getMaxGenerations();
     * // => 4 (Great-grandfather -> Grandfather -> Father -> Child)
     *
     * @example
     * const singleNodeTree = new FamilyTree({ a: { id: 'a' } }, 'a');
     * singleNodeTree.getMaxGenerations();
     * // => 1
     */
    getMaxGenerations() {
        const memo = new Map();
        let maxGen = 1;
        const validNodes = this.all.filter(p => !p.isGhost && !p._isUnknown);
        for (const p of validNodes) {
            if (this._isLineageRoot(p)) {
                maxGen = Math.max(maxGen, this._computeSubtreeGenerations(p.id, memo));
            }
        }
        return Math.max(1, maxGen);
    }

    /**
     * Resolves the effective birth year for the root node, falling back to the earliest
     * child's YOB if the root is a synthetic sibling ghost parent.
     *
     * @returns {number} Effective root YOB
     *
     * @example
     * tree._resolveRootDisplayYob();
     * // => 1920
     *
     * @example
     * ghostTree._resolveRootDisplayYob();
     * // => 1945 (derived from earliest child)
     */
    _resolveRootDisplayYob() {
        if (!this.root) return 1900;
        if (FamilyTree.isSyntheticSiblingParent(this.root) && this.root.children && this.root.children.length > 0) {
            const childYobs = this.root.children.map(cid => this.get(cid)?.bestYob).filter(Boolean);
            if (childYobs.length > 0) return Math.min(...childYobs);
        }
        return this.root.bestYob;
    }

    /**
     * Returns aggregate demographic and generational metrics for the tree.
     * 
     * @returns {{ minYear: number, maxYear: number, rootNodeYob: number, generationsCount: number, totalPeople: number }}
     * 
     * @example
     * tree.getStats();
     * // => { minYear: 1850, maxYear: 2024, rootNodeYob: 1850, generationsCount: 5, totalPeople: 120 }
     *
     * @example
     * const empty = new FamilyTree();
     * empty.getStats();
     * // => { minYear: 1900, maxYear: 2026, rootNodeYob: 1900, generationsCount: 1, totalPeople: 0 }
     */
    getStats() {
        const allYobs = this.all.map(p => p.yob || p._inferredYob).filter(y => y > 0);
        const minYear = allYobs.length > 0 ? Math.min(...allYobs) : 1900;
        const maxYear = allYobs.length > 0 ? Math.max(...allYobs) : new Date().getFullYear();
        const generationsCount = this.getMaxGenerations();

        return {
            minYear,
            maxYear,
            rootNodeYob: this._resolveRootDisplayYob(),
            generationsCount,
            totalPeople: this.all.filter(p => !p.isGhost && !p._isUnknown).length
        };
    }

    /**
     * Checks whether a sibling candidate's birth year is biologically compatible with the mother and father.
     * Enforces minimum parental childbirth age, maximum maternal childbirth age (with older child threshold),
     * and maximum paternal childbirth age.
     *
     * @param {Person} sib - Sibling candidate profile
     * @param {Person|null} mom - Mother profile
     * @param {Person|null} dad - Father profile
     * @param {FamilyTree} tree - Family tree instance
     * @returns {boolean} True if age difference is biologically plausible
     *
     * @example
     * // sib.yob = 1950, mom.yob = 1925 (age gap 25 yrs):
     * FamilyTree._isPlausibleSiblingAge({ yob: 1950 }, { yob: 1925 }, null, tree);
     * // => true
     *
     * @example
     * // sib.yob = 1950, mom.yob = 1945 (age gap 5 yrs, below minimum parental age 14):
     * FamilyTree._isPlausibleSiblingAge({ yob: 1950 }, { yob: 1945 }, null, tree);
     * // => false
     */
    static _isPlausibleSiblingAge(sib, mom, dad, tree) {
        if (!sib) return false;
        if (!sib.yob) return true;

        if (mom && mom.yob) {
            const ageDiff = sib.yob - mom.yob;
            if (ageDiff < FamilyTreeBuilder.GENERATIONAL_GAPS.MIN_PARENTAL_AGE || ageDiff > FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MAX_MOTHER_CHILDBIRTH_AGE) return false;
            if (ageDiff > FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MOTHER_OLDER_CHILD_THRESHOLD) {
                const hasValidFirstChild = mom.children.some(cId => {
                    const cn = tree ? tree.get(cId) : null;
                    if (!cn || !cn.yob) return false;
                    const cDiff = cn.yob - mom.yob;
                    return cDiff >= FamilyTreeBuilder.GENERATIONAL_GAPS.MIN_PARENTAL_AGE && cDiff <= FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MOTHER_OLDER_CHILD_THRESHOLD;
                });
                if (!hasValidFirstChild) return false;
            }
        }
        if (dad && dad.yob) {
            const ageDiff = sib.yob - dad.yob;
            if (ageDiff < FamilyTreeBuilder.GENERATIONAL_GAPS.MIN_PARENTAL_AGE || ageDiff > FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MAX_FATHER_CHILDBIRTH_AGE) return false;
        }
        return true;
    }

    /**
     * Retrieves all valid siblings of a person sharing either mother or father, subject to biological age checks.
     * 
     * @param {string} personId - ID of the target person
     * @returns {Person[]} Array of verified sibling Person entities
     * 
     * @example
     * tree.getSiblings('john_1980');
     * // => [maryPerson, davidPerson]
     *
     * @example
     * tree.getSiblings('onlyChild');
     * // => []
     */
    getSiblings(personId) {
        const p = this.get(personId);
        if (!p) return [];
        
        const siblingsSet = new Set();
        const mom = this.get(p.momId);
        const dad = this.get(p.fatherId);

        if (mom) mom.children.forEach(id => siblingsSet.add(id));
        if (dad) dad.children.forEach(id => siblingsSet.add(id));
        siblingsSet.delete(p.id);
        
        return Array.from(siblingsSet)
            .map(id => this.get(id))
            .filter(sib => FamilyTree._isPlausibleSiblingAge(sib, mom, dad, this));
    }

    /**
     * Traverses upward along parental edges to collect terminal root ancestors, recording for
     * each one how many generations up it sits and whether it was reached purely through
     * father links. Those two facts are properties of the GRAPH, which lets
     * {@link FamilyTree._sortRootAncestors} rank roots without leaning on birth years that may
     * themselves have been synthesised from demographic priors.
     *
     * @param {string} id - Current node ID
     * @param {Set<string>} visited - Visited node IDs
     * @param {Array<Object>} roots - Accumulated `{ person, depth, viaFatherOnly }` records
     * @param {number} [depth=0] - Generations climbed so far from the starting node
     * @param {boolean} [viaFatherOnly=true] - Whether every edge climbed so far was a father link
     *
     * @example
     * // Child -> father Jacob (no parents of his own) and mother Mary (likewise).
     * const roots = [];
     * tree._collectUpwardRoots('neville', new Set(), roots);
     * // => [{ person: Jacob, depth: 1, viaFatherOnly: true },
     * //     { person: Mary,  depth: 1, viaFatherOnly: false }]
     *
     * @example
     * // A node that is already a root reports itself at depth 0.
     * const roots = [];
     * tree._collectUpwardRoots('rootId', new Set(), roots);
     * // => [{ person: rootPerson, depth: 0, viaFatherOnly: true }]
     */
    _collectUpwardRoots(id, visited, roots, depth = 0, viaFatherOnly = true) {
        if (!id || visited.has(id)) return;
        visited.add(id);
        const p = this.get(id);
        if (!p) return;

        const hasValidFather = p.fatherId && this.get(p.fatherId);
        const hasValidMom = p.momId && this.get(p.momId);

        if (!hasValidFather && !hasValidMom) {
            roots.push({ person: p, depth, viaFatherOnly });
        } else {
            if (hasValidFather) this._collectUpwardRoots(p.fatherId, visited, roots, depth + 1, viaFatherOnly);
            // Stepping through a mother permanently marks this path as no longer purely paternal.
            if (hasValidMom) this._collectUpwardRoots(p.momId, visited, roots, depth + 1, false);
        }
    }

    /**
     * Ranks candidate root ancestors, most senior first.
     *
     * Seniority is decided by the SHAPE of the lineage rather than by birth years, because a
     * root's `bestYob` is frequently deduced from demographic priors: ranking on it meant that
     * nudging, say, the husband/wife age offset by one year could silently rename a person's
     * oldest ancestor. Order of precedence:
     *   1. depth        - the root furthest up the lineage wins (an in-law leaf parent must
     *                     never outrank a lineage going back several generations)
     *   2. recorded yob - only when BOTH roots have one; comparing a recorded year against a
     *                     deduced one just ranks the priors that produced the deduced one
     *   3. paternal     - the root reached purely through father links, matching how these
     *                     trees are conventionally rooted
     *   4. concrete     - a real person outranks a ghost/unknown placeholder
     *   5. best yob     - final deterministic tie-break, deduced years included
     *
     * @param {Array<Object>} roots - `{ person, depth, viaFatherOnly }` records from {@link FamilyTree._collectUpwardRoots}
     * @returns {Array<Object>} Same records, most senior ancestor first
     *
     * @example
     * // Depth beats birth year: a great-grandparent outranks a young in-law parent.
     * FamilyTree._sortRootAncestors([
     *     { person: { id: 'jossy', yob: 1942 }, depth: 1, viaFatherOnly: true },
     *     { person: { id: 'rosaSister' },       depth: 3, viaFatherOnly: false }]);
     * // => [rosaSister record, jossy record]
     *
     * @example
     * // Equal depth and only one recorded year: the paternal line wins.
     * FamilyTree._sortRootAncestors([
     *     { person: { id: 'mary', yob: 1949 }, depth: 1, viaFatherOnly: false },
     *     { person: { id: 'jacob' },           depth: 1, viaFatherOnly: true }]);
     * // => [jacob record, mary record]
     */
    static _sortRootAncestors(roots) {
        return [...roots].sort((a, b) => {
            if (a.depth !== b.depth) return b.depth - a.depth;

            const recordedA = a.person.yob;
            const recordedB = b.person.yob;
            if (recordedA && recordedB && recordedA !== recordedB) return recordedA - recordedB;

            if (a.viaFatherOnly !== b.viaFatherOnly) return a.viaFatherOnly ? -1 : 1;

            const aReal = !a.person.isGhost && !a.person._isUnknown ? 1 : 0;
            const bReal = !b.person.isGhost && !b.person._isUnknown ? 1 : 0;
            if (aReal !== bReal) return bReal - aReal;

            return (a.person.bestYob || 9999) - (b.person.bestYob || 9999);
        });
    }

    /**
     * Traverses upward along parental edges to discover the earliest patriarch/matriarch in the lineage.
     * 
     * @param {string} startId - Starting person ID
     * @returns {string} ID of the oldest root ancestor
     * 
     * @example
     * tree.getOldestAncestor('child_2010');
     * // => 'great_grandpa_1920'
     *
     * @example
     * tree.getOldestAncestor('orphan_1950');
     * // => 'orphan_1950'
     */
    getOldestAncestor(startId) {
        const startPerson = this.get(startId);
        if (!startPerson) return startId;
        const roots = [];

        const hasParents = (p) => p && ((p.fatherId && this.get(p.fatherId)) || (p.momId && this.get(p.momId)));

        if (hasParents(startPerson)) {
            this._collectUpwardRoots(startId, new Set(), roots);
        } else {
            // If start person has no parents, check partners for available ancestor trees
            for (const pId of startPerson.partners || []) {
                const partner = this.get(pId);
                if (hasParents(partner)) {
                    this._collectUpwardRoots(pId, new Set([startId]), roots);
                }
            }
            if (roots.length === 0) {
                this._collectUpwardRoots(startId, new Set(), roots);
            }
        }

        if (roots.length === 0) return startId;
        return FamilyTree._sortRootAncestors(roots)[0].person.id;
    }

    /**
     * Enqueues visible display children of a person into the BFS queue.
     *
     * @param {Person} person - Subject person
     * @param {Set<string>} visible - Set of accumulated visible IDs
     * @param {Array<string>} queue - BFS exploration queue
     * @param {Set<string>} collapsedNodes - Set of collapsed person IDs
     *
     * @example
     * this._enqueueDisplayChildren(person, visible, queue, collapsedNodes);
     * // => enqueues children into queue
     *
     * @example
     * this._enqueueDisplayChildren(childlessPerson, visible, queue, collapsedNodes);
     * // => queue remains unchanged
     */
    _enqueueDisplayChildren(person, visible, queue, collapsedNodes) {
        if (!person) return;
        person.getValidDisplayChildren(this).forEach(child => {
            if (child.momId && collapsedNodes.has(child.momId)) return;
            if (child.fatherId && collapsedNodes.has(child.fatherId)) return;
            if (!visible.has(child.id)) queue.push(child.id);
        });
    }

    /**
     * Determines whether a co-spouse node should be expanded as part of the visible tree unit.
     *
     * @param {Person} coSpouse - Candidate co-spouse node
     * @param {Set<string>} visible - Set of visible person IDs
     * @returns {boolean} True if co-spouse should be made visible
     *
     * @example
     * tree._shouldExpandCoSpouse(coSpouse, visible);
     * // => true
     *
     * @example
     * tree._shouldExpandCoSpouse(null, visible);
     * // => false
     */
    _shouldExpandCoSpouse(coSpouse, visible) {
        if (!coSpouse || coSpouse._isUnknown) return false;
        const hasParentsInTree = (coSpouse.momId && visible.has(coSpouse.momId)) ||
                                 (coSpouse.fatherId && visible.has(coSpouse.fatherId));
        return !hasParentsInTree;
    }

    /**
     * Determines whether a valid display child of a co-spouse belongs under the co-spouse
     * within the current matrimonial unit `[person, partner, coSpouse]`.
     * Includes children shared with `partner` as well as single-parent / prior-marriage children
     * of `coSpouse` whose other parent is absent or unknown in the tree.
     *
     * @param {Person} child - Child node of the co-spouse
     * @param {Person} coSpouse - Co-spouse person node
     * @param {Person} partner - Connecting partner node
     * @param {FamilyTree} tree - Family tree instance
     * @returns {boolean} True if child should be displayed under coSpouse in this unit
     *
     * @example
     * // Prior-marriage child of Devasikkutty (fatherId === devasikkutty.id, momId === null):
     * FamilyTree._isCoSpouseChildInUnit(daughter, devasikkutty, anne, tree);
     * // => true
     *
     * @example
     * // Shared child of co-spouse Thankamma and partner Joseph:
     * FamilyTree._isCoSpouseChildInUnit(sherly, thankamma, joseph, tree);
     * // => true
     */
    static _isCoSpouseChildInUnit(child, coSpouse, partner, tree) {
        if (!child || !coSpouse || !partner) return false;
        if (child.momId === partner.id || child.fatherId === partner.id) return true;
        const otherParentId = child.fatherId === coSpouse.id
            ? child.momId
            : (child.momId === coSpouse.id ? child.fatherId : null);
        const otherParent = (otherParentId && tree?.get) ? tree.get(otherParentId) : null;
        return !otherParent || Boolean(otherParent._isUnknown);
    }

    /**
     * Enqueues valid display children of a co-spouse in the marriage unit if not collapsed.
     *
     * @param {Person} coSpouse - Co-spouse person node
     * @param {Person} partner - Common partner node
     * @param {Set<string>} visible - Set of visible person IDs
     * @param {Array<string>} queue - BFS node traversal queue
     * @param {Set<string>} collapsedNodes - Set of collapsed node IDs
     *
     * @example
     * tree._enqueueCoSpouseChildren(coSpouse, partner, visible, queue, collapsedNodes);
     *
     * @example
     * tree._enqueueCoSpouseChildren(emptyCoSpouse, partner, visible, queue, collapsedNodes);
     */
    _enqueueCoSpouseChildren(coSpouse, partner, visible, queue, collapsedNodes) {
        if (collapsedNodes.has(coSpouse.id)) return;
        coSpouse.getValidDisplayChildren(this).forEach(child => {
            if (!FamilyTree._isCoSpouseChildInUnit(child, coSpouse, partner, this)) return;
            if (child.momId && collapsedNodes.has(child.momId)) return;
            if (child.fatherId && collapsedNodes.has(child.fatherId)) return;
            if (!visible.has(child.id)) queue.push(child.id);
        });
    }

    /**
     * Expands partner nodes and reachable co-spouses into the visible node set.
     *
     * @param {Person} person - Subject person node
     * @param {Set<string>} visible - Set of visible person IDs
     * @param {Array<string>} queue - BFS node traversal queue
     * @param {Set<string>} collapsedNodes - Set of collapsed node IDs
     *
     * @example
     * this._expandPartnerAndCoSpouses(person, visible, queue, collapsedNodes);
     * // => partners added to visible Set
     *
     * @example
     * this._expandPartnerAndCoSpouses(singlePerson, visible, queue, collapsedNodes);
     * // => visible remains unchanged
     */
    _expandPartnerAndCoSpouses(person, visible, queue, collapsedNodes) {
        const partners = person.partners.map(id => this.get(id)).filter(Boolean);
        partners.forEach(partner => {
            visible.add(partner.id);
            partner.partners.forEach(coSpouseId => {
                if (coSpouseId === person.id || visible.has(coSpouseId)) return;
                const coSpouse = this.get(coSpouseId);
                if (this._shouldExpandCoSpouse(coSpouse, visible)) {
                    visible.add(coSpouse.id);
                    this._enqueueCoSpouseChildren(coSpouse, partner, visible, queue, collapsedNodes);
                }
            });
        });
    }

    /**
     * Computes the subset of visible nodes in the visual layout via BFS from the root, respecting collapsed subtree states.
     * 
     * @param {Set<string>} collapsedNodes - Set of collapsed person IDs
     * @returns {Set<string>} Set of visible person IDs
     * 
     * @example
     * tree.getVisibleNodes(new Set(['grandpa_1940']));
     * // => Returns root + spouses, omitting grandpa's collapsed descendants
     *
     * @example
     * tree.getVisibleNodes();
     * // => Returns all reachable nodes when nothing is collapsed
     */
    getVisibleNodes(collapsedNodes = new Set()) {
        const visible = new Set();
        if (!this.rootId || !this.root) return visible;
        
        const queue = [this.rootId];
        let qIdx = 0;
        
        while (qIdx < queue.length) {
            const currId = queue[qIdx++];
            if (visible.has(currId)) continue;
            
            const person = this.get(currId);
            if (!person) continue;
            
            visible.add(currId);
            this._expandPartnerAndCoSpouses(person, visible, queue, collapsedNodes);

            if (!collapsedNodes.has(currId)) {
                this._enqueueDisplayChildren(person, visible, queue, collapsedNodes);
            }
        }
        return visible;
    }

    /**
     * Partitions partners and co-spouses around a person based on marriage order / age.
     *
     * @param {Object} person - Bloodline person node
     * @param {Array<Object>} sortedPartners - Sorted partner nodes
     * @param {Array<Object>} coSpouseEntries - Co-spouse entries
     * @returns {{ partnersLeft: Array<Object>, partnersRight: Array<Object> }}
     *
     * @example
     * FamilyTree._partitionPartnersByCoSpouses(person, [p1], []);
     * // => { partnersLeft: [], partnersRight: [p1] }
     *
     * @example
     * FamilyTree._partitionPartnersByCoSpouses(olderWife, [husband], [{ partner: husband, coSpouse: youngerWife }]);
     * // => { partnersLeft: [], partnersRight: [husband, youngerWife] }
     */
    static _partitionPartnersByCoSpouses(person, sortedPartners, coSpouseEntries) {
        const partnersLeft = [];
        const partnersRight = [];
        sortedPartners.forEach(p => {
            const pCoSpouses = coSpouseEntries.filter(e => e.partner.id === p.id).map(e => e.coSpouse);
            const personScore = person.bestYob || 9999;
            const coSpouseScore = pCoSpouses.length > 0 ? (pCoSpouses[0].bestYob || 9999) : 9999;

            if (personScore <= coSpouseScore) {
                // person is older wife: person on left of p, co-spouses on right of p -> [person, p, ...coSpouses]
                partnersRight.push(p, ...pCoSpouses);
            } else {
                // person is younger wife: co-spouses on left of p, person on right of p -> [...coSpouses, p, person]
                partnersLeft.push(...pCoSpouses, p);
            }
        });
        return { partnersLeft, partnersRight };
    }

    /**
     * Determines whether a partner should be positioned to the left of the bloodline person
     * based on gender roles (husbands on left, wives on right) or chronological age.
     *
     * @param {Object} partner - Partner node to place
     * @param {Object} person - Central bloodline person node
     * @returns {boolean} True if partner should be placed to the left
     *
     * @example
     * FamilyTree._isPartnerPlacedOnLeft({ gender: 'M' }, { gender: 'F' });
     * // => true (male partner placed on left)
     *
     * @example
     * FamilyTree._isPartnerPlacedOnLeft({ gender: 'F' }, { gender: 'M' });
     * // => false (female partner placed on right)
     */
    static _isPartnerPlacedOnLeft(partner, person) {
        if (partner.gender === 'M') return true;
        if (partner.gender === 'F') return false;
        if (person.gender === 'M') return false;
        if (person.gender === 'F') return true;
        return partner.bestYob < person.bestYob;
    }

    /**
     * Partitions partners to left or right of a person based on gender and age conventions.
     *
     * @param {Object} person - Bloodline person node
     * @param {Array<Object>} sortedPartners - Sorted partner nodes
     * @returns {{ partnersLeft: Array<Object>, partnersRight: Array<Object> }}
     *
     * @example
     * FamilyTree._partitionPartnersByGender({ gender: 'M' }, [{ gender: 'F' }]);
     * // => { partnersLeft: [], partnersRight: [wife] }
     *
     * @example
     * FamilyTree._partitionPartnersByGender({ gender: 'F' }, [{ gender: 'M' }]);
     * // => { partnersLeft: [husband], partnersRight: [] }
     */
    static _partitionPartnersByGender(person, sortedPartners) {
        const partnersLeft = [];
        const partnersRight = [];
        sortedPartners.forEach(p => {
            if (FamilyTree._isPartnerPlacedOnLeft(p, person)) {
                partnersLeft.push(p);
            } else {
                partnersRight.push(p);
            }
        });
        return { partnersLeft, partnersRight };
    }

    /**
     * Determines the horizontal sequence of family members (person, direct partners, and co-spouses)
     * for a family unit layout, ensuring shared partners bridge their respective spouses without crossing.
     * 
     * @param {Object} person - Bloodline person node
     * @param {Array<Object>} sortedPartners - Partners of person sorted by YOB
     * @param {Array<Object>} coSpouseEntries - Co-spouse entries: { partner, coSpouse }
     * @param {boolean} isMultiSpouseSplit - Whether multi-spouse split layout applies
     * @returns {{ familyMembers: Array<Object>, bloodlineIndex: number }}
     * 
     * @example
     * FamilyTree._orderFamilyMembers(Kochuthresia, [Joseph], [{ partner: Joseph, coSpouse: Thankamma }]);
     * // => { familyMembers: [Thankamma, Joseph, Kochuthresia], bloodlineIndex: 2 }
     *
     * @example
     * FamilyTree._orderFamilyMembers(Joseph, [Kochuthresia, Thankamma], [], true);
     * // => { familyMembers: [Kochuthresia, Joseph, Thankamma], bloodlineIndex: 1 }
     */
    static _orderFamilyMembers(person, sortedPartners, coSpouseEntries = [], isMultiSpouseSplit = false) {
        if (coSpouseEntries.length > 0) {
            const { partnersLeft, partnersRight } = FamilyTree._partitionPartnersByCoSpouses(person, sortedPartners, coSpouseEntries);
            return {
                familyMembers: [...partnersLeft, person, ...partnersRight],
                bloodlineIndex: partnersLeft.length
            };
        }

        if (isMultiSpouseSplit) {
            const mid = Math.ceil(sortedPartners.length / 2);
            const pLeft = sortedPartners.slice(0, mid);
            const pRight = sortedPartners.slice(mid);
            return {
                familyMembers: [...pLeft, person, ...pRight],
                bloodlineIndex: pLeft.length
            };
        }

        const { partnersLeft, partnersRight } = FamilyTree._partitionPartnersByGender(person, sortedPartners);
        return {
            familyMembers: [...partnersLeft, person, ...partnersRight],
            bloodlineIndex: partnersLeft.length
        };
    }

    /**
     * Normalizes a string by folding consecutive duplicate vowels into single instances.
     *
     * @param {string} s - Input string
     * @returns {string} Folded vowel string
     *
     * @example
     * FamilyTree.foldVowels("Ouseph") => "ouseph"
     *
     * @example
     * FamilyTree.foldVowels("Mariam") => "mariam"
     */
    static foldVowels(s) {
        if (!s) return '';
        if (typeof FamilyTreeBuilder !== 'undefined' && typeof FamilyTreeBuilder.foldVowels === 'function') {
            return FamilyTreeBuilder.foldVowels(s);
        }
        return s.toLowerCase().trim().replace(/([aeiou])\1+/g, '$1');
    }

    /**
     * Checks if a candidate co-spouse should be attached to the current family unit.
     * Co-spouses are eligible if they are not already visited, are known entities,
     * and do not have parents visible elsewhere in the tree (which would give them their own tree placement).
     *
     * @example
     * // Husband's second wife without parents in tree:
     * FamilyTree._isEligibleCoSpouse(secondWife, config)
     * // => true
     *
     * @example
     * // Co-spouse with visible parents elsewhere in tree:
     * FamilyTree._isEligibleCoSpouse(secondWifeWithParents, config)
     * // => false
     *
     * @private
     * @param {Person|null} candidate - Candidate co-spouse node
     * @param {Object} layoutConfig - Layout configuration
     * @returns {boolean} True if eligible to attach
     */
    static _isEligibleCoSpouse(candidate, layoutConfig) {
        if (!candidate || candidate._isUnknown) return false;
        const visibleNodes = layoutConfig?.visibleNodes;
        const hasVisibleParents = Boolean(
            (candidate.momId && visibleNodes?.has(candidate.momId)) ||
            (candidate.fatherId && visibleNodes?.has(candidate.fatherId))
        );
        return !hasVisibleParents;
    }

    /**
     * Identifies co-spouses through partners (e.g. husband's other wives) who lack visible parents in the tree.
     *
     * @param {Person} person - Subject bloodline person
     * @param {Array<Person>} partners - Partners of person
     * @param {FamilyTree} tree - Tree instance
     * @param {Object} layoutConfig - Layout configuration
     * @param {Set<string|number>} localVisited - Visited node ID set
     * @returns {Array<{partner: Person, coSpouse: Person}>}
     *
     * @example
     * FamilyTree._findCoSpouseEntries(firstWife, [husband], tree, config, visited)
     * // => [{ partner: husband, coSpouse: secondWife }]
     *
     * @example
     * FamilyTree._findCoSpouseEntries(personWithoutPartners, [], tree, config, visited)
     * // => []
     */
    static _findCoSpouseEntries(person, partners, tree, layoutConfig, localVisited) {
        const coSpouseEntries = [];
        for (const p of partners) {
            for (const coSpouseId of p.partners) {
                if (coSpouseId === person.id || localVisited.has(coSpouseId)) continue;
                const cs = tree.get(coSpouseId);
                if (FamilyTree._isEligibleCoSpouse(cs, layoutConfig)) {
                    coSpouseEntries.push({ partner: p, coSpouse: cs });
                    localVisited.add(cs.id);
                }
            }
        }
        return coSpouseEntries;
    }

    /**
     * Resolves a parent within the family unit whose name is prefixed in a child's descriptive title (e.g. 'Tensy3 Son 1').
     *
     * @param {Person} child - Child profile
     * @param {Array<Person>} unitParents - Available parent profiles in the family unit
     * @returns {Person|null} Matching parent or null
     *
     * @example
     * FamilyTree._findParentNamedInChildTitle({ name: 'Tensy3 Son 1' }, [dad, momTensy])
     * // => momTensy
     *
     * @example
     * FamilyTree._findParentNamedInChildTitle({ name: 'George' }, [dad, mom])
     * // => null
     */
    static _findParentNamedInChildTitle(child, unitParents) {
        const childWordsPattern = '(?:Daughter|Dau|Son|Girl|Boy|Child|Children|Kids)';
        const namedMatch = (child?.name || '').match(new RegExp(`^(.*?)\\s+${childWordsPattern}(?:\\s+\\d+)?$`, 'i'));
        if (!namedMatch) return null;

        const parentNamePart = namedMatch[1].toLowerCase().trim();
        const parentFolded = FamilyTree.foldVowels(parentNamePart);
        return unitParents.find(p => {
            if (!p?.name) return false;
            const pNorm = p.name.toLowerCase().trim();
            return pNorm === parentNamePart || FamilyTree.foldVowels(pNorm) === parentFolded || p._normName === parentNamePart;
        }) || null;
    }

    /**
     * Determines whether a parent node matches a child's declared or linked parental fields (ID or name).
     *
     * @param {Person} child - Child profile
     * @param {Person} parentNode - Candidate parent profile
     * @param {'mother'|'father'|null} [role=null] - Specific parental role to check, or null for either
     * @returns {boolean} True if parentNode matches child's parental link or declaration
     *
     * @example
     * FamilyTree._matchesChildParent({ momId: 'p1' }, { id: 'p1' }, 'mother')
     * // => true
     *
     * @example
     * FamilyTree._matchesChildParent({ father: 'John' }, { name: 'John' }, 'father')
     * // => true
     */
    static _matchesChildParent(child, parentNode, role = null) {
        if (!child || !parentNode) return false;
        const pName = parentNode.name?.toLowerCase().trim();

        if (role === 'mother') {
            return child.momId === parentNode.id || Boolean(child.mom && pName && child.mom.toLowerCase().trim() === pName);
        }
        if (role === 'father') {
            return child.fatherId === parentNode.id || Boolean(child.father && pName && child.father.toLowerCase().trim() === pName);
        }
        return child.momId === parentNode.id ||
               child.fatherId === parentNode.id ||
               child._namedParentId === parentNode.id ||
               Boolean(child.mom && pName && child.mom.toLowerCase().trim() === pName) ||
               Boolean(child.father && pName && child.father.toLowerCase().trim() === pName);
    }

    /**
     * Resolves the primary parent node in a family unit for a child using naming patterns,
     * biological parent IDs, or bloodline fallbacks.
     *
     * @param {Person} child - The child person instance
     * @param {Person} person - The central bloodline person of the family unit
     * @param {Array<Person>} unitParents - All parents in the unit (person, partners, co-spouses)
     * @param {Array<Person>} unitMothers - Mothers in the unit
     * @param {Array<Person>} unitFathers - Fathers in the unit
     * @returns {Person} The resolved parent node to which the child should attach
     *
     * @example
     * FamilyTree._findTargetParentForChild(childWithMotherId, dad, [dad, mom1, mom2], [mom1, mom2], [dad])
     * // => mom1
     *
     * @example
     * FamilyTree._findTargetParentForChild(namedChild, dad, [dad, mom], [mom], [dad])
     * // => dad
     */
    static _findTargetParentForChild(child, person, unitParents, unitMothers, unitFathers) {
        // 1. Primary Rule: Children names containing parent names (e.g. "Tensy3 Son 1") connect to that parent
        const namedParent = FamilyTree._findParentNamedInChildTitle(child, unitParents);
        if (namedParent) return namedParent;

        // 2. If multiple mothers/fathers are present in this unit, assign each child to their biological parent
        if (unitMothers.length > 1) {
            const matchedMother = unitMothers.find(m => FamilyTree._matchesChildParent(child, m, 'mother'));
            if (matchedMother) return matchedMother;
        } else if (unitFathers.length > 1) {
            const matchedFather = unitFathers.find(m => FamilyTree._matchesChildParent(child, m, 'father'));
            if (matchedFather) return matchedFather;
        }

        // 3. Fallback: prioritize the bloodline person if they are a parent, then any matching parent in the unit
        if (FamilyTree._matchesChildParent(child, person)) return person;

        return unitParents.find(m => FamilyTree._matchesChildParent(child, m)) || person;
    }

    /**
     * Initializes the partner-child map with empty arrays for person, partners, and uncollapsed co-spouses.
     *
     * @example
     * // person: P1, partners: [W1], coSpouseEntries: [{ partner: W1, coSpouse: H2 }]
     * FamilyTree._initPartnerChildMap(person, partners, coSpouseEntries, isCollapsed, layoutConfig, tree);
     * // => { 'P1': [], 'W1': [], 'H2': [children of H2 with W1] }
     *
     * @example
     * FamilyTree._initPartnerChildMap(soloPerson, [], [], false, config, tree)
     * // => { 'P1': [] }
     *
     * @param {Object} person - Primary node
     * @param {Array<Object>} partners - List of direct partner nodes
     * @param {Array<{partner: Object, coSpouse: Object}>} coSpouseEntries - Co-spouse pairs
     * @param {boolean} isCollapsed - Whether the family unit is collapsed
     * @param {Object} layoutConfig - Layout options containing collapsedNodes set
     * @param {FamilyTree} tree - Active family tree model
     * @returns {Object.<string, Array<Object>>} Initialized mapping of parent id to child arrays
     */
    static _initPartnerChildMap(person, partners, coSpouseEntries, isCollapsed, layoutConfig, tree) {
        const partnerChildMap = {};
        partnerChildMap[person.id] = [];
        partners.forEach(p => { partnerChildMap[p.id] = []; });
        coSpouseEntries.forEach(({ partner: p, coSpouse: cs }) => {
            partnerChildMap[cs.id] = cs.getValidDisplayChildren(tree).filter(c =>
                FamilyTree._isCoSpouseChildInUnit(c, cs, p, tree)
            );
        });
        return partnerChildMap;
    }

    /**
     * Determines whether children are split across multiple spouses/units,
     * resetting single-parent assignments to the primary person if not split.
     *
     * @example
     * // Only person P1 has children, no co-spouses:
     * FamilyTree._resolveMultiSpouseSplit(partnerChildMap, person, partners, coSpouseEntries, children);
     * // => false (and partnerChildMap[person.id] = children)
     *
     * @example
     * // Multiple partners have children:
     * FamilyTree._resolveMultiSpouseSplit({ 'W1': [c1], 'W2': [c2] }, dad, [mom1, mom2], [], [c1, c2]);
     * // => true
     *
     * @param {Object.<string, Array<Object>>} partnerChildMap - Mapping of parent id to child list
     * @param {Object} person - Primary person node
     * @param {Array<Object>} partners - Direct partner nodes
     * @param {Array<Object>} coSpouseEntries - Co-spouse pairs
     * @param {Array<Object>} children - Complete list of unit children
     * @returns {boolean} True if layout requires multi-spouse splitting, false otherwise
     */
    static _resolveMultiSpouseSplit(partnerChildMap, person, partners, coSpouseEntries, children) {
        const membersWithChildren = Object.entries(partnerChildMap).filter(([id, list]) => list.length > 0);
        if (membersWithChildren.length > 1 || coSpouseEntries.length > 0) {
            return true;
        }
        if (membersWithChildren.length === 1 && membersWithChildren[0][0] !== person.id) {
            return true;
        }
        partners.forEach(p => { partnerChildMap[p.id] = []; });
        partnerChildMap[person.id] = children;
        return false;
    }

    /**
     * Assigns children to their respective parents within a matrimonial unit,
     * determining whether layout requires a multi-spouse split.
     *
     * @param {Object} unitMembers - Matrimonial unit members ({ person, partners, coSpouseEntries })
     * @param {Array<Object>} children - Children of this unit
     * @param {Object} context - Layout and tree context ({ isCollapsed, layoutConfig, tree })
     * @returns {{ partnerChildMap: Object.<string, Array<Object>>, isMultiSpouseSplit: boolean }}
     *
     * @example
     * FamilyTree._assignChildrenToParents({ person: dad, partners: [mom1, mom2], coSpouseEntries: [] }, [child1, child2], { isCollapsed: false, layoutConfig: config, tree })
     * // => { partnerChildMap: { [mom1.id]: [child1], [mom2.id]: [child2] }, isMultiSpouseSplit: true }
     *
     * @example
     * FamilyTree._assignChildrenToParents({ person: dad, partners: [mom], coSpouseEntries: [] }, [child1], { isCollapsed: false, layoutConfig: config, tree })
     * // => { partnerChildMap: { [dad.id]: [child1], [mom.id]: [] }, isMultiSpouseSplit: false }
     */
    static _assignChildrenToParents(unitMembers, children, context) {
        const { person, partners, coSpouseEntries } = unitMembers;
        const { isCollapsed, layoutConfig, tree } = context;
        const partnerChildMap = FamilyTree._initPartnerChildMap(person, partners, coSpouseEntries, isCollapsed, layoutConfig, tree);

        const unitParents = [person, ...partners, ...coSpouseEntries.map(e => e.coSpouse)];
        const unitMothers = unitParents.filter(m => m.gender === 'F' || (!m.gender && m.spouseType === 'husband'));
        const unitFathers = unitParents.filter(m => m.gender === 'M' || (!m.gender && m.spouseType === 'wife'));

        children.forEach(child => {
            const targetParent = FamilyTree._findTargetParentForChild(child, person, unitParents, unitMothers, unitFathers);
            if (!partnerChildMap[targetParent.id]) partnerChildMap[targetParent.id] = [];
            partnerChildMap[targetParent.id].push(child);
        });

        const isMultiSpouseSplit = FamilyTree._resolveMultiSpouseSplit(partnerChildMap, person, partners, coSpouseEntries, children);
        return { partnerChildMap, isMultiSpouseSplit };
    }

    /**
     * Resolves partners, co-spouses, and child parent assignments for a family unit subtree.
     *
     * @param {Person} person - Subtree root person node
     * @param {FamilyTree} tree - Active family tree model
     * @param {Object} layoutConfig - Layout options
     * @param {boolean} isCollapsed - Whether the unit subtree is collapsed
     * @param {Set<string>} localVisited - Visited node IDs set
     * @returns {{
     *   partners: Array<Person>,
     *   coSpouseEntries: Array<Object>,
     *   partnerChildMap: Object.<string, Array<Person>>,
     *   isMultiSpouseSplit: boolean
     * }}
     *
     * @example
     * const unit = FamilyTree._resolveSubtreeUnitChildren(p, tree, config, false, new Set(['p1']));
     * // => { partners: [...], coSpouseEntries: [], partnerChildMap: {...}, isMultiSpouseSplit: false }
     *
     * @example
     * const unit = FamilyTree._resolveSubtreeUnitChildren(dad, tree, config, true, visited);
     * // => { partners: [mom], coSpouseEntries: [], partnerChildMap: {...}, isMultiSpouseSplit: false }
     */
    static _resolveSubtreeUnitChildren(person, tree, layoutConfig, isCollapsed, localVisited) {
        const partners = person.partners.map(id => tree.get(id)).filter(Boolean);
        partners.forEach(p => localVisited.add(p.id));
        const coSpouseEntries = FamilyTree._findCoSpouseEntries(person, partners, tree, layoutConfig, localVisited);
        const children = FamilyTree._collectUnitChildren(person, partners, coSpouseEntries, tree, layoutConfig, isCollapsed);
        const { partnerChildMap, isMultiSpouseSplit } = FamilyTree._assignChildrenToParents(
            { person, partners, coSpouseEntries }, children, { isCollapsed, layoutConfig, tree }
        );
        return { partners, coSpouseEntries, partnerChildMap, isMultiSpouseSplit };
    }

    /**
     * Computes horizontal spacing offsets for a sequence of child subtrees using contour distance
     * and minimum parent card separation gaps.
     *
     * @param {Array<Object>} rawChildSubtrees - Array of child subtree layout objects
     * @param {number} gap - Horizontal gap between adjacent subtrees
     * @returns {{ childOffsets: Array<number>, gContour: IntervalContour }}
     *
     * @example
     * FamilyTree._packChildSubtrees([sub1, sub2], 24)
     * // => { childOffsets: [0, 150], gContour: ... }
     *
     * @example
     * FamilyTree._packChildSubtrees([singleSubtree], 24)
     * // => { childOffsets: [0], gContour: ... }
     */
    static _packChildSubtrees(rawChildSubtrees, gap) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const childOffsets = [0];
        const gContour = rawChildSubtrees[0].contour.clone();

        for (let cIdx = 1; cIdx < rawChildSubtrees.length; cIdx++) {
            const prevSub = rawChildSubtrees[cIdx - 1];
            const curSub = rawChildSubtrees[cIdx];

            const distContour = gContour.computeDistance(curSub.contour, gap);
            const prevParentRight = Math.max(...prevSub.memberLayouts.map(minf => minf.cardX + nodeWidth));
            const curParentLeft = Math.min(...curSub.memberLayouts.map(minf => minf.cardX));
            const minParentDist = childOffsets[cIdx - 1] + (prevParentRight - curParentLeft + gap);

            const actualDist = Math.max(distContour, minParentDist);
            childOffsets.push(actualDist);

            const shiftedCur = curSub.contour.clone();
            shiftedCur.shift(actualDist);
            gContour.merge(shiftedCur);
        }

        return { childOffsets, gContour };
    }

    /**
     * Computes horizontal offsets for each spouse subtree by merging interval contours
     * and enforcing minimum partner card spacing.
     * 
     * @param {Array<Object>} spouseSubtrees - Array of spouse subtrees
     * @param {number} branchGap - Minimum spacing between subtree contours
     * @param {number} partnerTotal - Spacing between partner cards
     * @returns {number[]} Calculated horizontal offsets for each group
     *
     * @example
     * FamilyTree._calculateSpouseGroupOffsets([sub1, sub2], 24, 100)
     * // => [0, 200]
     *
     * @example
     * FamilyTree._calculateSpouseGroupOffsets([sub1], 24, 100)
     * // => [0]
     */
    static _calculateSpouseGroupOffsets(spouseSubtrees, branchGap, partnerTotal) {
        const groupOffsets = [0];
        const combinedGContour = spouseSubtrees[0].gContour.clone();

        for (let gIdx = 1; gIdx < spouseSubtrees.length; gIdx++) {
            const curG = spouseSubtrees[gIdx];
            const distContour = combinedGContour.computeDistance(curG.gContour, branchGap);
            const maxCombinedX = combinedGContour.layers.size > 0 
                ? Math.max(...Array.from(combinedGContour.layers.values()).map(s => s.maxX)) 
                : 0;
            const minCurX = curG.gContour.layers.size > 0 
                ? Math.min(...Array.from(curG.gContour.layers.values()).map(s => s.minX)) 
                : 0;
            const distMin = (maxCombinedX - minCurX + branchGap) - groupOffsets[gIdx - 1];
            const dist = Math.max(partnerTotal * 2, distContour, distMin);
            groupOffsets.push(groupOffsets[gIdx - 1] + dist);

            const shiftedCurG = curG.gContour.clone();
            shiftedCurG.shift(groupOffsets[gIdx]);
            combinedGContour.merge(shiftedCurG);
        }

        return groupOffsets;
    }

    /**
     * Positions cards, child layouts, and bus bar connectors for each spouse subtree.
     * 
     * @param {Array<Object>} spouseSubtrees - Array of spouse subtrees
     * @param {number[]} groupOffsets - Calculated horizontal offsets
     * @param {number} nodeWidth - Width of a person card
     * @param {number} nodeHeight - Height of a person card
     *
     * @example
     * FamilyTree._applySpouseGroupPositions([sub1, sub2], [0, 200], 90, 76)
     *
     * @example
     * FamilyTree._applySpouseGroupPositions([singleSub], [0], 90, 76)
     */
    static _applySpouseGroupPositions(spouseSubtrees, groupOffsets, nodeWidth, nodeHeight) {
        const midG = (groupOffsets[0] + groupOffsets[groupOffsets.length - 1]) / 2;
        spouseSubtrees.forEach((gSub, gIdx) => {
            const shift = groupOffsets[gIdx] - midG;
            gSub.spouseGroupOffset = shift;
            gSub.cardX = shift - nodeWidth / 2;
            const pDropX = gSub.cardX + nodeWidth / 2;

            if (gSub.childLayouts && gSub.childLayouts.length > 0) {
                gSub.childLayouts.forEach((c, cIdx) => {
                    const relX = (gSub.rawChildOffsets[cIdx] - gSub.childMidX) + pDropX;
                    c.relX = relX;
                });

                gSub.groupMinDropX = gSub.childLayouts[0].relX;
                gSub.groupMaxDropX = gSub.childLayouts[gSub.childLayouts.length - 1].relX;
                const minChildTopY = Math.min(...gSub.childLayouts.map(c => c.topY));
                const busY = Math.max(gSub.targetY + nodeHeight + 16, minChildTopY - 16);
                gSub.groupBusBarY = busY;
            } else {
                gSub.groupMinDropX = null;
                gSub.groupMaxDropX = null;
                gSub.groupBusBarY = null;
            }
        });
    }

    /**
     * Calculates contour offsets and bus bar coordinates for spouse subtrees with children.
     *
     * @param {Array<Object>} spouseSubtrees - Array of spouse subtrees with children
     * @param {number} branchGap - Spacing gap between branches
     * @param {number} nodeWidth - Width of a person card
     * @param {number} nodeHeight - Height of a person card
     * @param {number} partnerTotal - Spacing between partners
     *
     * @example
     * FamilyTree._distributeSpouseSubtrees(spouseSubtrees, 24, 90, 76, 100)
     *
     * @example
     * FamilyTree._distributeSpouseSubtrees([], 24, 90, 76, 100)
     * // returns early without modifying subtrees
     */
    static _distributeSpouseSubtrees(spouseSubtrees, branchGap, nodeWidth, nodeHeight, partnerTotal) {
        if (!spouseSubtrees || spouseSubtrees.length === 0) return;

        const groupOffsets = FamilyTree._calculateSpouseGroupOffsets(spouseSubtrees, branchGap, partnerTotal);
        FamilyTree._applySpouseGroupPositions(spouseSubtrees, groupOffsets, nodeWidth, nodeHeight);
    }

    /**
     * Calculates the horizontal card position for an unpositioned partner card relative to adjacent positioned cards.
     *
     * @param {?number} prev - Previous partner card X position, or null/undefined if absent
     * @param {?number} next - Next partner card X position, or null/undefined if absent
     * @param {number} partnerTotal - Distance between partner cards
     * @param {number} nodeWidth - Width of a person card
     * @returns {number} The calculated horizontal card X coordinate
     *
     * @example
     * FamilyTree._calculateAdjacentCardX(100, 300, 100, 90);
     * // => 200
     *
     * @example
     * FamilyTree._calculateAdjacentCardX(100, null, 100, 90);
     * // => 200
     */
    static _calculateAdjacentCardX(prev, next, partnerTotal, nodeWidth) {
        if (prev != null && next != null) return (prev + next) / 2;
        if (prev != null) return prev + partnerTotal;
        if (next != null) return next - partnerTotal;
        return -nodeWidth / 2;
    }

    /**
     * Assigns card horizontal positions to partners without children (e.g. centered between adjacent partners).
     *
     * @param {Array<Object>} memberLayouts - Layout items for members
     * @param {number} partnerTotal - Distance between partner cards
     * @param {number} nodeWidth - Width of a person card
     *
     * @example
     * FamilyTree._positionChildlessPartners(memberLayouts, 100, 90)
     *
     * @example
     * FamilyTree._positionChildlessPartners([], 100, 90)
     */
    static _positionChildlessPartners(memberLayouts, partnerTotal, nodeWidth) {
        for (let i = 0; i < memberLayouts.length; i++) {
            if (memberLayouts[i].cardX === undefined || memberLayouts[i].cardX === null) {
                const prev = i > 0 ? memberLayouts[i - 1].cardX : null;
                const next = i < memberLayouts.length - 1 ? memberLayouts[i + 1].cardX : null;
                memberLayouts[i].cardX = FamilyTree._calculateAdjacentCardX(prev, next, partnerTotal, nodeWidth);
            }
        }
    }


    /**
     * Shifts a member's card and child layout horizontal offsets by a delta amount.
     *
     * @param {Object} mInfo - Member layout descriptor
     * @param {number} dx - Horizontal distance to shift
     *
     * @example
     * FamilyTree._shiftMemberLayout(memberInfo, 25);
     *
     * @example
     * FamilyTree._shiftMemberLayout({ cardX: 10, childLayouts: [] }, -15);
     */
    static _shiftMemberLayout(mInfo, dx) {
        mInfo.cardX += dx;
        if (mInfo.childLayouts && mInfo.childLayouts.length > 0) {
            mInfo.childLayouts.forEach(c => { c.relX += dx; });
            mInfo.groupMinDropX += dx;
            mInfo.groupMaxDropX += dx;
        }
    }

    /**
     * Enforces the minimum horizontal partner gap between adjacent cards, shifting later cards if needed.
     *
     * @param {Array<Object>} memberLayouts - Layout items for members
     * @param {number} partnerTotal - Minimum horizontal gap between partner cards
     *
     * @example
     * FamilyTree._enforceMinPartnerGap(memberLayouts, 100)
     *
     * @example
     * FamilyTree._enforceMinPartnerGap([singleMember], 100)
     */
    static _enforceMinPartnerGap(memberLayouts, partnerTotal) {
        for (let i = 1; i < memberLayouts.length; i++) {
            if (memberLayouts[i].cardX < memberLayouts[i - 1].cardX + partnerTotal) {
                const shift = memberLayouts[i - 1].cardX + partnerTotal - memberLayouts[i].cardX;
                for (let j = i; j < memberLayouts.length; j++) {
                    FamilyTree._shiftMemberLayout(memberLayouts[j], shift);
                }
            }
        }
    }

    /**
     * Re-centers the entire subtree layout so that the bloodline member's card center aligns at x=0.
     *
     * @param {Array<Object>} memberLayouts - Layout items for members
     * @param {number} nodeWidth - Width of a person card
     *
     * @example
     * FamilyTree._centerBloodlineMember(memberLayouts, 90)
     *
     * @example
     * FamilyTree._centerBloodlineMember([], 90)
     */
    static _centerBloodlineMember(memberLayouts, nodeWidth) {
        const bloodlineMember = memberLayouts.find(m => m.isBloodline);
        if (bloodlineMember) {
            const bloodlineCenterX = bloodlineMember.cardX + nodeWidth / 2;
            if (bloodlineCenterX !== 0) {
                for (const mInfo of memberLayouts) {
                    FamilyTree._shiftMemberLayout(mInfo, -bloodlineCenterX);
                }
            }
        }
    }

    /**
     * Spaces out multiple spouse subtrees using contour distance, positions childless members,
     * enforces minimum partner gaps, and re-centers the bloodline member at x=0.
     *
     * @param {Array<Object>} memberLayouts - Array of member layout descriptors
     * @param {Array<Object>} spouseSubtrees - Array of spouse subtrees with children
     * @param {number} branchGap - Horizontal spacing gap between branches
     *
     * @example
     * FamilyTree._alignMultiSpouseMembers(memberLayouts, spouseSubtrees, 24)
     *
     * @example
     * FamilyTree._alignMultiSpouseMembers([soloMember], [], 24)
     */
    static _alignMultiSpouseMembers(memberLayouts, spouseSubtrees, branchGap) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeHeight = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;
        const partnerTotal = typeof TREE_PARTNER_TOTAL !== 'undefined' ? TREE_PARTNER_TOTAL : 100;

        FamilyTree._distributeSpouseSubtrees(spouseSubtrees, branchGap, nodeWidth, nodeHeight, partnerTotal);
        FamilyTree._positionChildlessPartners(memberLayouts, partnerTotal, nodeWidth);
        FamilyTree._enforceMinPartnerGap(memberLayouts, partnerTotal);
        FamilyTree._centerBloodlineMember(memberLayouts, nodeWidth);
    }

    /**
     * Checks whether a partner's child is eligible to be included in the central person's family unit.
     * Rejects children that already belong to a co-spouse branch or have another known biological
     * parent of the person's gender present in the tree.
     *
     * @example
     * // Johny (male) and Rosy are partners. Rosy has child Joy whose father is known to be Ousephunni.
     * FamilyTree._isEligibleUnitPartnerChild(joy, johny, [], tree)
     * // => false (rejected because Joy's father is Ousephunni, not Johny)
     *
     * @example
     * // Lovely (female) and Varghese are partners. Lovely has child Elsa with Varghese.
     * FamilyTree._isEligibleUnitPartnerChild(elsa, varghese, [], tree)
     * // => true
     *
     * @param {Person} child - Child node under consideration
     * @param {Person} person - Central person of the family unit
     * @param {Array<Object>} coSpouseEntries - Co-spouse relationships
     * @param {FamilyTree} tree - Family tree instance
     * @returns {boolean} True if child should be included with this unit
     */
    static _isEligibleUnitPartnerChild(child, person, coSpouseEntries, tree) {
        const isCoSpouseChild = coSpouseEntries.some(e =>
            e.coSpouse?.id === child.momId || e.coSpouse?.id === child.fatherId
        );
        if (isCoSpouseChild) return false;

        const isPersonMale = person.gender === 'M' || (!person.gender && person.spouseType === 'husband');
        if (isPersonMale && child.fatherId && child.fatherId !== person.id && tree.get(child.fatherId)) {
            return false;
        }

        const isPersonFemale = person.gender === 'F' || (!person.gender && person.spouseType === 'wife');
        if (isPersonFemale && child.momId && child.momId !== person.id && tree.get(child.momId)) {
            return false;
        }

        return true;
    }

    /**
     * Gathers all valid children belonging to the family unit (person, partners, and co-spouses).
     *
     * @param {Person} person - The central person
     * @param {Array<Person>} partners - Partner profiles
     * @param {Array<Object>} coSpouseEntries - Co-spouse associations
     * @param {FamilyTree} tree - Family tree instance
     * @param {Object} layoutConfig - Layout configuration
     * @param {boolean} isCollapsed - Whether the current node is collapsed
     * @returns {Array<Person>} Deduplicated array of valid children for this unit
     *
     * @example
     * FamilyTree._collectUnitChildren(dad, [mom1, mom2], [], tree, config, false)
     * // => [childA, childB, childC]
     *
     * @example
     * FamilyTree._collectUnitChildren(soloChildless, [], [], tree, config, false)
     * // => []
     */
    static _collectUnitChildren(person, partners, coSpouseEntries, tree, layoutConfig, isCollapsed) {
        const children = [...person.getValidDisplayChildren(tree)];
        const seenIds = new Set(children.map(c => c.id));

        for (const partner of partners) {
            for (const c of partner.getValidDisplayChildren(tree)) {
                if (!seenIds.has(c.id) && FamilyTree._isEligibleUnitPartnerChild(c, person, coSpouseEntries, tree)) {
                    seenIds.add(c.id);
                    children.push(c);
                }
            }
        }
        return children;
    }

    /**
     * Determines whether a family member has hidden parents or partners outside the currently visible tree nodes.
     *
     * @param {Person} person - Person profile
     * @param {Object} layoutConfig - Layout configuration with visibleNodes Set
     * @param {FamilyTree} tree - Tree instance for node lookups
     * @returns {boolean} True if person has hidden lineage
     *
     * @example
     * FamilyTree._hasHiddenLineage(personWithHiddenParents, { visibleNodes: new Set(['p1']) }, tree)
     * // => true
     *
     * @example
     * FamilyTree._hasHiddenLineage(null, config, tree)
     * // => false
     */
    static _hasHiddenLineage(person, layoutConfig, tree) {
        if (!person) return false;
        const momVisible = person.momId && layoutConfig.visibleNodes.has(person.momId);
        const dadVisible = person.fatherId && layoutConfig.visibleNodes.has(person.fatherId);
        const hasMom = person.momId && tree.get(person.momId) && !tree.get(person.momId)._isUnknown;
        const hasDad = person.fatherId && tree.get(person.fatherId) && !tree.get(person.fatherId)._isUnknown;
        const hasHiddenParents = (hasMom || hasDad) && !momVisible && !dadVisible;
        const hasHiddenPartner = person.partners.some(pId => !layoutConfig.visibleNodes.has(pId) && tree.get(pId) && !tree.get(pId)._isUnknown);
        return Boolean(hasHiddenParents || hasHiddenPartner);
    }

    /**
     * Constructs initial member layout descriptors with demographic and generational coordinates.
     *
     * @param {Array<Person>} familyMembers - Ordered array of family members
     * @param {number} bloodlineIndex - Index of the bloodline member
     * @param {Object} partnerChildMap - Map of member ID to assigned children
     * @param {number} nodeYob - Effective birth year of the central node
     * @param {number} targetY - Base vertical pixel coordinate
     * @param {boolean} isCollapsed - Whether node is collapsed
     * @param {Object} layoutConfig - Layout configuration options
     * @param {FamilyTree} tree - Family tree instance
     * @returns {Array<Object>} Array of member layout descriptors
     *
     * @example
     * FamilyTree._buildMemberLayouts([dad, mom], 0, { [dad.id]: [child1] }, 1950, 200, false, config, tree)
     * // => [{ person: dad, isBloodline: true, targetY: 200, ... }, { person: mom, isBloodline: false, ... }]
     *
     * @example
     * FamilyTree._buildMemberLayouts([solo], 0, {}, 1980, 0, false, config, tree)
     * // => [{ person: solo, isBloodline: true, targetY: 0, ... }]
     */
    /**
     * Determines whether a family member's children subtree should be rendered collapsed.
     *
     * @private
     * @param {Object} params
     * @param {Object} params.member - Person node
     * @param {Array<Object>} params.children - Children of this member
     * @param {boolean} params.isCollapsed - Root/branch collapsed status
     * @param {string|undefined} params.bloodlineId - ID of primary bloodline person
     * @param {Set<string>|null} params.collapsedNodes - Set of explicitly collapsed node IDs
     * @returns {boolean} True if member subtree is collapsed
     *
     * @example
     * FamilyTree._isMemberSubtreeCollapsed({ member: { id: 'p1' }, children: [], isCollapsed: true, bloodlineId: 'p1', collapsedNodes: new Set() });
     * // => true
     *
     * @example
     * FamilyTree._isMemberSubtreeCollapsed({ member: { id: 'p2' }, children: [], isCollapsed: false, bloodlineId: 'p1', collapsedNodes: new Set() });
     * // => false
     */
    static _isMemberSubtreeCollapsed({ member, children, isCollapsed, bloodlineId, collapsedNodes }) {
        const hasCollapsed = (id) => Boolean(id && collapsedNodes?.has(id));
        if (hasCollapsed(member.id)) return true;
        if (isCollapsed && member.id === bloodlineId) return true;
        return children.length > 0 && children.every(c =>
            (c.momId && hasCollapsed(c.momId)) ||
            (c.fatherId && hasCollapsed(c.fatherId))
        );
    }

    /**
     * Constructs initial member layout objects for all members of a family group.
     * Computes bloodline status, child associations, collapsed state, offsets, and target coordinates.
     *
     * @param {Array<Object>} familyMembers - Ordered family unit member objects
     * @param {number} bloodlineIndex - Index of the primary bloodline individual
     * @param {Object.<string, Array<Object>>} partnerChildMap - Map of partner IDs to children
     * @param {Object} layoutCtx - Subtree geometry and layout context ({ nodeYob, targetY, isCollapsed, layoutConfig, tree })
     * @returns {Array<Object>} Array of initialized member layout records
     *
     * @example
     * const members = [{ id: 'p1', bestYob: 1950 }];
     * const layouts = FamilyTree._buildMemberLayouts(members, 0, {}, { nodeYob: 1950, targetY: 100, isCollapsed: false, layoutConfig: { ppy: 10 }, tree: null });
     * // => layouts[0].isBloodline === true && layouts[0].targetY === 100
     *
     * @example
     * const members = [{ id: 'p1', bestYob: 1950 }, { id: 'p2', bestYob: 1955 }];
     * const layouts = FamilyTree._buildMemberLayouts(members, 0, { p1: [] }, { nodeYob: 1950, targetY: 200, isCollapsed: false, layoutConfig: { ppy: 10, verticalCompression: true }, tree: null });
     * // => layouts[1].isBloodline === false && layouts[1].offsetY === 0
     */
    static _buildMemberLayouts(familyMembers, bloodlineIndex, partnerChildMap, layoutCtx) {
        const { nodeYob, targetY, isCollapsed, layoutConfig, tree } = layoutCtx;
        const bloodlineId = familyMembers[bloodlineIndex]?.id;
        return familyMembers.map((m, idx) => {
            const isBloodline = idx === bloodlineIndex;
            const mChildren = partnerChildMap[m.id] || [];
            const mIsCollapsed = FamilyTree._isMemberSubtreeCollapsed({
                member: m, children: mChildren, isCollapsed, bloodlineId, collapsedNodes: layoutConfig?.collapsedNodes
            });
            const mYob = m.bestYob || nodeYob;
            const mOffsetY = layoutConfig.verticalCompression ? 0 : (mYob - nodeYob) * layoutConfig.ppy;
            const mTargetY = targetY + mOffsetY;
            const hasHiddenLineage = FamilyTree._hasHiddenLineage(m, layoutConfig, tree);

            return {
                person: m, isBloodline, hasHiddenLineage, mChildren, mIsCollapsed,
                targetY: mTargetY, offsetY: mOffsetY, cardX: null, childLayouts: [],
                groupBusBarY: null, groupMinDropX: null, groupMaxDropX: null
            };
        });
    }

    /**
     * Appends bounding boxes to a subtree contour for parent drop stem, horizontal bus-bar,
     * and individual child vertical drop stems.
     *
     * @param {IntervalContour} contour - Target contour to augment
     * @param {Object} options
     * @param {number} options.parentDropX - Center X coordinate of parent drop stem
     * @param {number} options.parentBottomY - Bottom Y coordinate of parent card
     * @param {number} options.busY - Vertical coordinate of connecting bus-bar
     * @param {number} options.minDropX - Leftmost child stem X coordinate
     * @param {number} options.maxDropX - Rightmost child stem X coordinate
     * @param {Array<Object>} options.childLayouts - Array of child layout descriptors ({ relX, targetY })
     * @param {boolean} [options.includeParentStem=true] - Whether to include parent-to-bus-bar stem
     *
     * @example
     * FamilyTree._addConnectionContourBoxes(contour, {
     *   parentDropX: 45, parentBottomY: 76, busY: 100,
     *   minDropX: 20, maxDropX: 70,
     *   childLayouts: [{ relX: 20, targetY: 150 }, { relX: 70, targetY: 150 }],
     *   includeParentStem: true
     * });
     *
     * @example
     * FamilyTree._addConnectionContourBoxes(contour, {
     *   parentDropX: 45, parentBottomY: 76, busY: 100,
     *   minDropX: 45, maxDropX: 45,
     *   childLayouts: [{ relX: 45, targetY: 150 }],
     *   includeParentStem: false
     * });
     */
    static _addConnectionContourBoxes(contour, {
        parentDropX, parentBottomY, busY, minDropX, maxDropX, childLayouts, includeParentStem = true
    }) {
        if (includeParentStem) {
            contour.addBox(parentDropX - 8, parentDropX + 8, parentBottomY, busY);
        }
        contour.addBox(minDropX - 6, maxDropX + 6, busY - 6, busY + 6);
        for (const c of childLayouts) {
            contour.addBox(c.relX - 8, c.relX + 8, busY, c.targetY);
        }
    }

    /**
     * Resolves vertical altitude, gap spacing, and node status metrics for a subtree root.
     *
     * @param {Object} person - The root person of the subtree.
     * @param {Object} tree - The FamilyTree instance.
     * @param {Object} layoutConfig - Active layout configuration.
     * @param {number} depth - Generation depth of the subtree.
     * @returns {{ siblingGap: number, branchGap: number, isCollapsed: boolean, nodeYob: number, targetY: number }}
     *
     * @example
     *   FamilyTree._computeSubtreeGeometry(person, tree, { collapsedNodes: new Set(), rootNodeYob: 1950, ppy: 3 }, 0);
     *   // => { siblingGap: 24, branchGap: 36, isCollapsed: false, nodeYob: 1950, targetY: 0 }
     *
     * @example
     *   FamilyTree._computeSubtreeGeometry(child, tree, { collapsedNodes: new Set(['c1']), verticalCompression: true, generationRowHeight: 160 }, 1);
     *   // => { siblingGap: 24, branchGap: 24, isCollapsed: true, targetY: 160 }
     */
    static _computeSubtreeGeometry(person, tree, layoutConfig, depth) {
        const siblingGap = layoutConfig.siblingGap || TREE_SIBLING_GAP;
        const isRootOrSynthetic = person.id === tree.rootId || FamilyTree.isSyntheticSiblingParent(person);
        const branchGap = isRootOrSynthetic ? Math.max(siblingGap, Math.round(siblingGap * 1.5)) : siblingGap;
        const isCollapsed = layoutConfig.collapsedNodes.has(person.id);
        const nodeYob = person.bestYob || layoutConfig.rootNodeYob;
        const genHeight = layoutConfig.generationRowHeight || 160;
        const targetY = layoutConfig.verticalCompression
            ? (depth * genHeight)
            : ((nodeYob - layoutConfig.rootNodeYob) * layoutConfig.ppy);
        return { siblingGap, branchGap, isCollapsed, nodeYob, targetY };
    }

    /**
     * Positions child subtrees relative to parent drop coordinate and merges their contours.
     *
     * @param {Array<Object>} rawChildSubtrees - Child layout descriptors.
     * @param {Array<number>} childOffsets - Relative packed offsets for each child.
     * @param {number} midX - Center horizontal midpoint of children span.
     * @param {number} pDropX - Parent vertical stem drop horizontal coordinate.
     * @param {Object} mInfo - Member layout descriptor receiving child layouts.
     * @param {IntervalContour} subtreeContour - Aggregated interval contour accumulator.
     *
     * @example
     *   FamilyTree._placeChildSubtrees(subtrees, [0, 100], 50, 45, mInfo, contour);
     *
     * @example
     *   FamilyTree._placeChildSubtrees([singleSub], [0], 0, 45, mInfo, contour);
     */
    static _placeChildSubtrees(rawChildSubtrees, childOffsets, midX, pDropX, mInfo, subtreeContour) {
        for (let cIdx = 0; cIdx < rawChildSubtrees.length; cIdx++) {
            const cSub = rawChildSubtrees[cIdx];
            const relX = (childOffsets[cIdx] - midX) + pDropX;
            cSub.relX = relX;
            mInfo.childLayouts.push(cSub);

            const cShiftedContour = cSub.contour.clone();
            cShiftedContour.shift(relX);
            subtreeContour.merge(cShiftedContour);
        }
    }

    /**
     * Computes the bus bar horizontal span and vertical altitude connecting a member to their children.
     *
     * @param {Object} mInfo - Member layout descriptor.
     * @param {Array<Object>} rawChildSubtrees - Positioned child subtrees.
     * @param {boolean} isSyntheticSiblingUnit - Whether parent unit is a synthetic placeholder.
     * @param {number} nodeHeight - Height of parent card.
     * @returns {number} The vertical Y altitude for the bus bar line.
     *
     * @example
     *   FamilyTree._computeBusBarGeometry(mInfo, subtrees, false, 76);
     *   // => 168
     *
     * @example
     *   FamilyTree._computeBusBarGeometry(syntheticInfo, subtrees, true, 76);
     *   // => minChildTopY - 20
     */
    static _computeBusBarGeometry(mInfo, rawChildSubtrees, isSyntheticSiblingUnit, nodeHeight) {
        mInfo.groupMinDropX = rawChildSubtrees[0].relX;
        mInfo.groupMaxDropX = rawChildSubtrees[rawChildSubtrees.length - 1].relX;
        const minChildTopY = Math.min(...mInfo.childLayouts.map(c => c.topY));
        const busY = isSyntheticSiblingUnit ? (minChildTopY - 20) : Math.max(mInfo.targetY + nodeHeight + 16, minChildTopY - 16);
        mInfo.groupBusBarY = busY;
        return busY;
    }

    /**
     * Traverses and lays out child subtrees for a specific family member, merging their contours.
     *
     * @param {Object} params
     * @param {Object} params.mInfo - Member layout descriptor
     * @param {number} params.nodeWidth - Visual card width
     * @param {number} params.nodeHeight - Visual card height
     * @param {boolean} params.isSyntheticSiblingUnit - Whether parent unit is a synthetic sibling placeholder
     * @param {FamilyTree} params.tree - FamilyTree domain model
     * @param {Object} params.layoutConfig - Layout styling parameters
     * @param {Set} params.localVisited - Local visited set for cycle avoidance
     * @param {number} params.branchGap - Sibling branch spacing
     * @param {number} params.depth - Traversal depth
     * @param {IntervalContour} params.subtreeContour - Subtree interval contour accumulator
     *
     * @example
     *   FamilyTree._layoutMemberChildren({ mInfo, nodeWidth: 90, nodeHeight: 76, ... });
     *   // => mInfo.childLayouts populated and subtreeContour expanded
     *
     * @example
     *   FamilyTree._layoutMemberChildren({ mInfo: childlessInfo, nodeWidth: 90, nodeHeight: 76, ... });
     *   // returns early without laying out children
     */
    static _layoutMemberChildren({
        mInfo, nodeWidth, nodeHeight, isSyntheticSiblingUnit,
        tree, layoutConfig, localVisited, branchGap, depth, subtreeContour
    }) {
        if (!mInfo.mChildren || mInfo.mChildren.length === 0 || mInfo.mIsCollapsed) {
            return;
        }
        const rawChildSubtrees = mInfo.mChildren.map(c => layoutSubtree(c, tree, layoutConfig, localVisited, depth + 1)).filter(Boolean);
        if (rawChildSubtrees.length === 0) return;

        const { childOffsets } = FamilyTree._packChildSubtrees(rawChildSubtrees, branchGap);
        const midX = (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2;
        const pDropX = mInfo.cardX + nodeWidth / 2;

        FamilyTree._placeChildSubtrees(rawChildSubtrees, childOffsets, midX, pDropX, mInfo, subtreeContour);
        const busY = FamilyTree._computeBusBarGeometry(mInfo, rawChildSubtrees, isSyntheticSiblingUnit, nodeHeight);

        FamilyTree._addConnectionContourBoxes(subtreeContour, {
            parentDropX: pDropX,
            parentBottomY: mInfo.targetY + nodeHeight,
            busY,
            minDropX: mInfo.groupMinDropX,
            maxDropX: mInfo.groupMaxDropX,
            childLayouts: mInfo.childLayouts,
            includeParentStem: !isSyntheticSiblingUnit
        });
    }

    /**
     * Assigns horizontal card coordinates to member layouts in a single-spouse family unit.
     *
     * @param {Array<Object>} memberLayouts - Member layout descriptors.
     * @param {number} bloodlineIndex - Index of the bloodline individual.
     * @param {number} nodeWidth - Width of a single card.
     * @param {number} partnerTotal - Width plus gap between adjacent partners.
     *
     * @example
     *   FamilyTree._positionSingleSpouseCards(memberLayouts, 0, 90, 100);
     *   // => sets cardX on each memberLayout entry
     *
     * @example
     *   FamilyTree._positionSingleSpouseCards([singleMember], 0, 90, 100);
     *   // => singleMember.cardX = -45
     */
    static _positionSingleSpouseCards(memberLayouts, bloodlineIndex, nodeWidth, partnerTotal) {
        memberLayouts.forEach((mInfo, idx) => {
            mInfo.cardX = -nodeWidth / 2 + (idx - bloodlineIndex) * partnerTotal;
        });
    }

    /**
     * Initializes the interval contour with bounding boxes for all non-synthetic member cards.
     *
     * @param {Array<Object>} memberLayouts - Member layout descriptors.
     * @param {boolean} isSyntheticSiblingUnit - Whether unit is synthetic sibling placeholder.
     * @param {number} nodeWidth - Card width.
     * @param {number} nodeHeight - Card height.
     * @returns {IntervalContour} Initialized contour.
     *
     * @example
     *   const contour = FamilyTree._initSingleSpouseContour(memberLayouts, false, 90, 76);
     *   // => IntervalContour { layers: Map(...) }
     *
     * @example
     *   const emptyContour = FamilyTree._initSingleSpouseContour(memberLayouts, true, 90, 76);
     *   // => empty IntervalContour for synthetic unit
     */
    static _initSingleSpouseContour(memberLayouts, isSyntheticSiblingUnit, nodeWidth, nodeHeight) {
        const subtreeContour = new IntervalContour();
        if (!isSyntheticSiblingUnit) {
            for (const mInfo of memberLayouts) {
                subtreeContour.addBox(mInfo.cardX, mInfo.cardX + nodeWidth, mInfo.targetY, mInfo.targetY + nodeHeight);
            }
        }
        return subtreeContour;
    }

    /**
     * Performs subtree layout and contour calculation for single-spouse family units.
     *
     * @param {Object} params - Layout parameters
     * @returns {Object} Subtree layout descriptor
     *
     * @example
     * FamilyTree._layoutSingleSpouseSubtree({ person, targetY, memberLayouts, ... })
     * // => { person, targetY, topY, contour, memberLayouts, isMultiSpouseSplit: false }
     *
     * @example
     * FamilyTree._layoutSingleSpouseSubtree({ person, targetY: 100, memberLayouts: [solo], isSyntheticSiblingUnit: true, ... })
     * // => { person, targetY: 100, isSyntheticSiblingUnit: true, ... }
     */
    static _layoutSingleSpouseSubtree({
        person, targetY, memberLayouts, bloodlineIndex, isSyntheticSiblingUnit,
        tree, layoutConfig, localVisited, branchGap, depth = 0
    }) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeHeight = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;
        const partnerTotal = typeof TREE_PARTNER_TOTAL !== 'undefined' ? TREE_PARTNER_TOTAL : 100;

        FamilyTree._positionSingleSpouseCards(memberLayouts, bloodlineIndex, nodeWidth, partnerTotal);
        const subtreeContour = FamilyTree._initSingleSpouseContour(memberLayouts, isSyntheticSiblingUnit, nodeWidth, nodeHeight);

        for (const mInfo of memberLayouts) {
            FamilyTree._layoutMemberChildren({
                mInfo, nodeWidth, nodeHeight, isSyntheticSiblingUnit,
                tree, layoutConfig, localVisited, branchGap, depth, subtreeContour
            });
        }

        const allMinY = Math.min(...memberLayouts.map(m => m.targetY));

        return {
            person,
            targetY,
            topY: isSyntheticSiblingUnit ? (memberLayouts[0]?.groupBusBarY || targetY) : allMinY,
            contour: subtreeContour,
            memberLayouts,
            isMultiSpouseSplit: false,
            isSyntheticSiblingUnit
        };
    }

    /**
     * Initializes an empty childless layout descriptor for a spouse group.
     *
     * @private
     * @param {Object} mInfo - Member layout descriptor
     * @param {number} nodeWidth - Card width
     * @param {number} nodeHeight - Card height
     *
     * @example
     * FamilyTree._initChildlessSpouseGroup(mInfo, 90, 76);
     *
     * @example
     * FamilyTree._initChildlessSpouseGroup(partnerInfo, 100, 80);
     */
    static _initChildlessSpouseGroup(mInfo, nodeWidth, nodeHeight) {
        mInfo.childLayouts = [];
        mInfo.rawChildOffsets = [0];
        mInfo.childMidX = 0;
        mInfo.groupMinDropX = null;
        mInfo.groupMaxDropX = null;
        mInfo.groupBusBarY = null;
        mInfo.gContour = new IntervalContour();
        mInfo.gContour.addBox(-nodeWidth / 2, nodeWidth / 2, mInfo.targetY, mInfo.targetY + nodeHeight);
    }

    /**
     * Packs child subtrees and connects contour boxes for a spouse group with children.
     *
     * @private
     * @param {Object} mInfo - Member layout descriptor
     * @param {Array<Object>} rawChildSubtrees - Positioned child subtrees
     * @param {number} siblingGap - Horizontal spacing between sibling branches
     * @param {number} nodeWidth - Card width
     * @param {number} nodeHeight - Card height
     *
     * @example
     * FamilyTree._packPopulatedSpouseGroup(mInfo, [childSub1, childSub2], 24, 90, 76);
     *
     * @example
     * FamilyTree._packPopulatedSpouseGroup(mInfo, [singleChildSub], 24, 90, 76);
     */
    static _packPopulatedSpouseGroup(mInfo, rawChildSubtrees, siblingGap, nodeWidth, nodeHeight) {
        const { childOffsets, gContour } = FamilyTree._packChildSubtrees(rawChildSubtrees, siblingGap);
        const midX = (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2;
        mInfo.childLayouts = rawChildSubtrees;
        mInfo.rawChildOffsets = childOffsets;
        mInfo.childMidX = midX;
        mInfo.gContour = gContour;
        mInfo.gContour.shift(-midX);
        const minChildTopY = Math.min(...rawChildSubtrees.map(c => c.topY));
        const busY = Math.max(mInfo.targetY + nodeHeight + 16, minChildTopY - 16);
        FamilyTree._addConnectionContourBoxes(mInfo.gContour, {
            parentDropX: 0,
            parentBottomY: mInfo.targetY + nodeHeight,
            busY,
            minDropX: childOffsets[0] - midX,
            maxDropX: childOffsets[childOffsets.length - 1] - midX,
            childLayouts: rawChildSubtrees.map((c, idx) => ({ relX: childOffsets[idx] - midX, targetY: c.targetY })),
            includeParentStem: true
        });
        mInfo.gContour.addBox(-nodeWidth / 2, nodeWidth / 2, mInfo.targetY, mInfo.targetY + nodeHeight);
    }

    /**
     * Lays out and packs child subtrees for each multi-spouse partner group.
     *
     * @param {Array<Object>} spouseGroups - Member layouts that have children.
     * @param {Object} context - Layout traversal context.
     * @returns {Array<Object>} Member layouts with populated child subtrees and contours.
     *
     * @example
     *   const subtrees = FamilyTree._packMultiSpouseChildren(groups, { tree, layoutConfig, localVisited, depth: 0, siblingGap: 24 });
     *   // => [mInfo, ...]
     *
     * @example
     *   const emptySubtrees = FamilyTree._packMultiSpouseChildren([], { tree, layoutConfig, localVisited, depth: 0, siblingGap: 24 });
     *   // => []
     */
    static _packMultiSpouseChildren(spouseGroups, { tree, layoutConfig, localVisited, depth, siblingGap }) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeHeight = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;
        const spouseSubtrees = [];
        for (const mInfo of spouseGroups) {
            const rawChildSubtrees = mInfo.mIsCollapsed
                ? []
                : mInfo.mChildren.map(c => layoutSubtree(c, tree, layoutConfig, localVisited, depth + 1)).filter(Boolean);
            if (rawChildSubtrees.length > 0) {
                FamilyTree._packPopulatedSpouseGroup(mInfo, rawChildSubtrees, siblingGap, nodeWidth, nodeHeight);
            } else {
                FamilyTree._initChildlessSpouseGroup(mInfo, nodeWidth, nodeHeight);
            }
            spouseSubtrees.push(mInfo);
        }
        return spouseSubtrees;
    }

    /**
     * Builds the unified bounding interval contour for multi-spouse family units.
     *
     * @param {Array<Object>} memberLayouts - Member layout descriptors.
     * @param {number} nodeWidth - Card width.
     * @param {number} nodeHeight - Card height.
     * @returns {IntervalContour} Aggregated spatial contour.
     *
     * @example
     *   const contour = FamilyTree._buildMultiSpouseContour(memberLayouts, 90, 76);
     *   // => IntervalContour { layers: Map(...) }
     *
     * @example
     *   const singleContour = FamilyTree._buildMultiSpouseContour([mInfo], 90, 76);
     *   // => contour containing bounding box of mInfo
     */
    static _buildMultiSpouseContour(memberLayouts, nodeWidth, nodeHeight) {
        const subtreeContour = new IntervalContour();
        for (const mInfo of memberLayouts) {
            subtreeContour.addBox(mInfo.cardX, mInfo.cardX + nodeWidth, mInfo.targetY, mInfo.targetY + nodeHeight);
            if (mInfo.childLayouts.length > 0) {
                const pDropX = mInfo.cardX + nodeWidth / 2;
                const busY = mInfo.groupBusBarY;
                FamilyTree._addConnectionContourBoxes(subtreeContour, {
                    parentDropX: pDropX,
                    parentBottomY: mInfo.targetY + nodeHeight,
                    busY,
                    minDropX: mInfo.groupMinDropX,
                    maxDropX: mInfo.groupMaxDropX,
                    childLayouts: mInfo.childLayouts,
                    includeParentStem: true
                });
                for (const c of mInfo.childLayouts) {
                    const cShifted = c.contour.clone();
                    cShifted.shift(c.relX);
                    subtreeContour.merge(cShifted);
                }
            }
        }
        return subtreeContour;
    }

    /**
     * Performs subtree layout and contour calculation for multi-spouse family units.
     *
     * @param {Object} params - Layout parameters
     * @returns {Object} Subtree layout descriptor
     *
     * @example
     * FamilyTree._layoutMultiSpouseSubtree({ person, targetY, memberLayouts, ... })
     * // => { person, targetY, topY, contour, memberLayouts, isMultiSpouseSplit: true }
     *
     * @example
     * FamilyTree._layoutMultiSpouseSubtree({ person, targetY: 0, memberLayouts: [p1, p2], ... })
     * // => { isMultiSpouseSplit: true, ... }
     */
    static _layoutMultiSpouseSubtree({
        person, targetY, memberLayouts, tree, layoutConfig, localVisited,
        siblingGap, branchGap, depth = 0
    }) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeHeight = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;

        const spouseGroups = memberLayouts.filter(m => m.mChildren.length > 0);
        const spouseSubtrees = FamilyTree._packMultiSpouseChildren(spouseGroups, {
            tree, layoutConfig, localVisited, depth, siblingGap
        });

        FamilyTree._alignMultiSpouseMembers(memberLayouts, spouseSubtrees, branchGap);

        const subtreeContour = FamilyTree._buildMultiSpouseContour(memberLayouts, nodeWidth, nodeHeight);
        const allMinY = Math.min(...memberLayouts.map(m => m.targetY));

        return {
            person,
            targetY,
            topY: allMinY,
            contour: subtreeContour,
            memberLayouts,
            isMultiSpouseSplit: true
        };
    }

    /**
     * Appends SVG bridge path descriptors between adjacent spouse/partner cards.
     *
     * @param {Array<Object>} memberLayouts - Member layout descriptors
     * @param {number} originX - Current horizontal subtree origin
     * @param {boolean} isSyntheticSiblingUnit - Whether unit is synthetic sibling ghost
     * @param {Array<Object>} paths - Target paths array
     *
     * @example
     * FamilyTree._generateSpouseBridges(memberLayouts, 0, false, paths)
     *
     * @example
     * FamilyTree._generateSpouseBridges(memberLayouts, 0, true, paths)
     * // does nothing for synthetic sibling unit
     */
    static _generateSpouseBridges(memberLayouts, originX, isSyntheticSiblingUnit, paths) {
        if (isSyntheticSiblingUnit) return;
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        for (let i = 0; i < memberLayouts.length - 1; i++) {
            const m1 = memberLayouts[i];
            const m2 = memberLayouts[i + 1];
            const x1 = originX + m1.cardX + nodeWidth;
            const y1 = m1.targetY + 38;
            const x2 = originX + m2.cardX;
            const y2 = m2.targetY + 38;

            paths.push({
                d: _generateSpouseBridgePath(x1, y1, x2, y2),
                type: 'spouse-bridge'
            });
        }
    }

    /**
     * Generates connector path and executes subtree traversal for a single-child family unit.
     *
     * @param {Object} params
     * @param {Object} params.cSub - Child subtree layout descriptor
     * @param {number} params.originX - Subtree X origin coordinate
     * @param {number} params.parentDropX - Center X coordinate of parent card drop stem
     * @param {number} params.busBarY - Vertical coordinate of bus-bar
     * @param {boolean} params.isSyntheticSiblingUnit - Whether unit is synthetic sibling ghost
     * @param {Array<Object>} params.paths - Target SVG path descriptors array
     * @param {Function} params.traverse - Recursive layout traversal callback
     *
     * @example
     * FamilyTree._generateSingleChildConnection({
     *   cSub: { relX: 10, targetY: 120 }, originX: 50, parentDropX: 50,
     *   busBarY: 90, isSyntheticSiblingUnit: false, paths: [], traverse: () => {}
     * });
     * // paths pushed: [{ d: '...', type: 'child-stem' }]
     *
     * @example
     * FamilyTree._generateSingleChildConnection({
     *   cSub: { relX: 10, targetY: 120 }, originX: 50, parentDropX: 50,
     *   busBarY: 90, isSyntheticSiblingUnit: true, paths: [], traverse: () => {}
     * });
     * // no stem pushed for synthetic unit
     */
    static _generateSingleChildConnection({ cSub, originX, parentDropX, busBarY, isSyntheticSiblingUnit, paths, traverse }) {
        const childOriginX = originX + cSub.relX;
        const childDropX = childOriginX;
        const childCardTopY = cSub.targetY;

        if (!isSyntheticSiblingUnit) {
            paths.push({
                d: _generateSingleChildStemPath(parentDropX, busBarY, childDropX, childCardTopY),
                type: 'child-stem'
            });
        }
        traverse(cSub, childOriginX);
    }

    /**
     * Generates horizontal bus-bar, intermediate vertical drop stems, and executes
     * recursive traversal for multiple child subtrees.
     *
     * @param {Object} params
     * @param {Array<Object>} params.children - Array of child subtree layout descriptors
     * @param {number} params.originX - Subtree X origin coordinate
     * @param {number} params.busBarY - Vertical coordinate of bus-bar
     * @param {Array<Object>} params.paths - Target SVG path descriptors array
     * @param {Function} params.traverse - Recursive layout traversal callback
     *
     * @example
     * FamilyTree._generateMultiChildConnections({
     *   children: [{ relX: 0, targetY: 120 }, { relX: 100, targetY: 120 }],
     *   originX: 50, busBarY: 90, paths: [], traverse: () => {}
     * });
     * // paths pushed: [{ d: '...', type: 'bus-bar' }]
     *
     * @example
     * FamilyTree._generateMultiChildConnections({
     *   children: [{ relX: 0, targetY: 120 }, { relX: 50, targetY: 120 }, { relX: 100, targetY: 120 }],
     *   originX: 0, busBarY: 80, paths: [], traverse: () => {}
     * });
     */
    static _generateMultiChildConnections({ children, originX, busBarY, paths, traverse }) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        const firstDropX = originX + firstChild.relX;
        const lastDropX = originX + lastChild.relX;
        const firstTopY = firstChild.targetY;
        const lastTopY = lastChild.targetY;

        paths.push({
            d: _generateBusBarPath(firstDropX, firstTopY, lastDropX, lastTopY, busBarY),
            type: 'bus-bar'
        });

        // Intermediate children (straight vertical drop stems from bus bar)
        for (let cIdx = 1; cIdx < children.length - 1; cIdx++) {
            const cSub = children[cIdx];
            const childOriginX = originX + cSub.relX;
            paths.push({ d: `M ${childOriginX} ${busBarY} L ${childOriginX} ${cSub.targetY}`, type: 'child-stem' });
        }

        // Recurse for all children
        children.forEach(cSub => {
            traverse(cSub, originX + cSub.relX);
        });
    }

    /**
     * Constructs a positioned card descriptor for flattened tree layout rendering.
     *
     * @param {Object} mInfo - Member layout descriptor
     * @param {number} cardAbsX - Absolute horizontal position coordinate
     * @param {number} cardAbsY - Absolute vertical position coordinate
     * @returns {Object} Positioned node descriptor
     *
     * @example
     * const card1 = FamilyTree._buildFlattenedNode(mInfo, 150, 200);
     *
     * @example
     * const card2 = FamilyTree._buildFlattenedNode(spouseInfo, 250, 200);
     */
    static _buildFlattenedNode(mInfo, cardAbsX, cardAbsY) {
        return {
            person: mInfo.person,
            isPartner: !mInfo.isBloodline,
            hasHiddenLineage: mInfo.hasHiddenLineage,
            hasChildren: mInfo.mChildren.length > 0,
            isCollapsed: mInfo.mIsCollapsed,
            x: cardAbsX,
            y: cardAbsY
        };
    }

    /**
     * Generates vertical drop stems, bus-bars, and child stem paths connecting parents to children.
     *
     * @param {Object} params - Parameter bundle
     *
     * @example
     * FamilyTree._generateChildConnections({ mInfo, originX: 0, cardAbsX: 100, cardAbsY: 200, ... })
     *
     * @example
     * FamilyTree._generateChildConnections({ mInfo: childlessInfo, originX: 0, cardAbsX: 0, cardAbsY: 0, ... })
     * // returns early when childLayouts is empty
     */
    static _generateChildConnections({ mInfo, originX, cardAbsX, cardAbsY, isSyntheticSiblingUnit, paths, traverse }) {
        if (mInfo.childLayouts.length === 0) return;
        const nodeW = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeH = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;
        const parentDropX = cardAbsX + nodeW / 2;
        const busBarY = mInfo.groupBusBarY;
        const children = mInfo.childLayouts;

        if (!isSyntheticSiblingUnit) {
            paths.push({ d: `M ${parentDropX} ${cardAbsY + nodeH} L ${parentDropX} ${busBarY}`, type: 'parent-stem' });
        }

        if (children.length === 1) {
            FamilyTree._generateSingleChildConnection({
                cSub: children[0], originX, parentDropX, busBarY, isSyntheticSiblingUnit, paths, traverse
            });
        } else {
            FamilyTree._generateMultiChildConnections({ children, originX, busBarY, paths, traverse });
        }
    }

    /**
     * Computes the bounding box of a set of connector paths.
     *
     * Connector `d` strings are plain "command x y ..." sequences (straight segments plus
     * quadratic corners), so reading every number positionally as an (x, y) pair is enough
     * to bound the drawing without parsing SVG properly — the same trick
     * {@link PrintTileBounds.intersectsPath} uses. Quadratic control points can sit slightly
     * outside the curve they shape, so the box may overshoot a rounded corner by its radius;
     * erring outwards is deliberate, since the only cost is a few unused pixels whereas
     * erring inwards crops the stroke off the page.
     *
     * @param {Array<Object>} paths - Connector path descriptors exposing an SVG path string `d`
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }|null} Bounds, or null when nothing is drawn
     *
     * @example
     * FamilyTree._computePathBounds([{ d: 'M 10 20 L 100 20' }]);
     * // => { minX: 10, minY: 20, maxX: 100, maxY: 20 }
     *
     * @example
     * // Real sibling bus-bar: fractional coordinates and rounded corners are both handled.
     * FamilyTree._computePathBounds([{ d: 'M -2685.4 179 L -2685.4 167 Q -2685.4 159 -2677.4 159' }]).minY;
     * // => 159
     *
     * @example
     * FamilyTree._computePathBounds([]);
     * // => null
     */
    static _computePathBounds(paths) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        (paths || []).forEach(p => {
            const nums = (String(p.d).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
            for (let i = 0; i + 1 < nums.length; i += 2) {
                const x = nums[i], y = nums[i + 1];
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        });

        return minX === Infinity ? null : { minX, minY, maxX, maxY };
    }

    /**
     * Computes the 2D bounding box and dimensions for the flattened tree layout.
     *
     * Covers connectors as well as cards: a sibling bus-bar is drawn *above* the cards it
     * joins, so bounding cards alone crops the top-most sibling link off the printed page.
     *
     * @param {Array<Object>} nodes - Positioned nodes
     * @param {Array<Object>} paths - Layout connector paths
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     *
     * @example
     * FamilyTree._computeLayoutBounds([{ x: 0, y: 0 }], [])
     * // => { minX: 0, minY: 0, maxX: 90, maxY: 76, width: 90, height: 76 }
     *
     * @example
     * // The bus-bar rises 20px above the cards, so the box starts at -20 rather than 0.
     * FamilyTree._computeLayoutBounds([{ x: 0, y: 0 }], [{ type: 'bus-bar', d: 'M 45 0 L 45 -20' }])
     * // => { minX: 0, minY: -20, maxX: 90, maxY: 76, width: 90, height: 96 }
     *
     * @example
     * FamilyTree._computeLayoutBounds([], [])
     * // => { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 }
     */
    static _computeLayoutBounds(nodes, paths) {
        const nodeWidth = typeof TREE_NODE_WIDTH !== 'undefined' ? TREE_NODE_WIDTH : 90;
        const nodeHeight = typeof TREE_NODE_HEIGHT !== 'undefined' ? TREE_NODE_HEIGHT : 76;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        nodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x + nodeWidth > maxX) maxX = n.x + nodeWidth;
            if (n.y < minY) minY = n.y;
            if (n.y + nodeHeight > maxY) maxY = n.y + nodeHeight;
        });

        const pathBounds = FamilyTree._computePathBounds(paths);
        if (pathBounds) {
            minX = Math.min(minX, pathBounds.minX);
            minY = Math.min(minY, pathBounds.minY);
            maxX = Math.max(maxX, pathBounds.maxX);
            maxY = Math.max(maxY, pathBounds.maxY);
        }

        if (minX === Infinity) {
            minX = 0; maxX = 1000; minY = 0; maxY = 1000;
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Checks whether a target ID matches a candidate's explicit ID or resolved node ID.
     *
     * @param {string|null} targetId - ID to match
     * @param {Object} c - Candidate object
     * @param {Person|null} candNode - Resolved candidate person node in the tree
     * @returns {boolean} True if targetId matches candidate's explicit or node ID
     *
     * @example
     * FamilyTree._matchesCandidateId('c1', { id: 'c1' }, null)
     * // => true
     *
     * @example
     * FamilyTree._matchesCandidateId('node_99', { id: 'c1' }, { id: 'node_99' })
     * // => true
     */
    static _matchesCandidateId(targetId, c, candNode) {
        if (!targetId || !c) return false;
        return targetId === c.id || Boolean(candNode && targetId === candNode.id);
    }

    /**
     * Checks whether a parent linked to a subject matches the candidate by ID or by name + sheet row.
     *
     * @param {string|null} parentId - Parent ID on the subject person
     * @param {Object} c - Candidate object
     * @param {Person|null} candNode - Resolved candidate person node
     * @param {FamilyTree} tree - Tree instance
     * @returns {boolean} True if parent matches candidate
     *
     * @example
     * FamilyTree._matchesParentCandidate('mom_1', { id: 'mom_1' }, null, tree)
     * // => true
     *
     * @example
     * FamilyTree._matchesParentCandidate(null, { id: 'mom_1' }, null, tree)
     * // => false
     */
    static _matchesParentCandidate(parentId, c, candNode, tree) {
        if (!parentId) return false;
        if (FamilyTree._matchesCandidateId(parentId, c, candNode)) return true;
        const parent = tree ? tree.get(parentId) : null;
        if (parent && parent.name?.toLowerCase() === (c.name || '').toLowerCase()) {
            if (c.sheetRow && parent.sheetRow && c.sheetRow === parent.sheetRow) return true;
        }
        return false;
    }

    /**
     * Checks whether the candidate node has a reciprocal parent, spouse, or child link pointing to the subject.
     *
     * @param {Person|null} candNode - Candidate node in the tree
     * @param {string} personId - Subject person ID
     * @returns {boolean} True if candidate links back to person
     *
     * @example
     * FamilyTree._hasReverseLinkToPerson({ momId: 'p1' }, 'p1')
     * // => true
     *
     * @example
     * FamilyTree._hasReverseLinkToPerson(null, 'p1')
     * // => false
     */
    static _hasReverseLinkToPerson(candNode, personId) {
        if (!candNode || !personId) return false;
        return candNode.momId === personId ||
               candNode.fatherId === personId ||
               Boolean(candNode.partners?.includes(personId)) ||
               Boolean(candNode.children?.includes(personId));
    }

    /**
     * Determines whether an ambiguity candidate is the one currently linked/used in the family tree.
     *
     * @param {Object} c - Candidate object
     * @param {Object} amb - Ambiguity descriptor
     * @param {Person} p - Subject person
     * @param {FamilyTree} tree - Family tree instance
     * @returns {boolean} True if candidate is currently used in the tree
     *
     * @example
     * FamilyTree._isCandidateUsed({ id: 'c1', isCurrentlyUsed: true }, amb, p, tree)
     * // => true
     *
     * @example
     * FamilyTree._isCandidateUsed(null, amb, p, tree)
     * // => false
     */
    static _isCandidateUsed(c, amb, p, tree) {
        if (!c) return false;
        const candNode = tree ? tree.get(c.id) : null;
        const livePerson = tree ? (tree.get(p.id) || p) : p;
        const rel = (amb?.relation || '').toLowerCase();

        if (rel.includes('mother') || rel.includes('mom')) {
            if (FamilyTree._matchesParentCandidate(livePerson.momId, c, candNode, tree)) return true;
        }
        if (rel.includes('father') || rel.includes('dad')) {
            if (FamilyTree._matchesParentCandidate(livePerson.fatherId, c, candNode, tree)) return true;
        }
        if (rel.includes('spouse') || rel.includes('husband') || rel.includes('wife')) {
            if (livePerson.partners?.some(pid => FamilyTree._matchesCandidateId(pid, c, candNode))) return true;
        }
        if (rel.includes('son') || rel.includes('daughter') || rel.includes('child')) {
            if (livePerson.children?.some(cid => FamilyTree._matchesCandidateId(cid, c, candNode))) return true;
        }

        if (FamilyTree._hasReverseLinkToPerson(candNode, livePerson.id)) return true;

        if (c.isCurrentlyUsed || c.isSelected) return true;
        if (FamilyTree._matchesCandidateId(amb?.selectedId, c, candNode)) return true;

        return false;
    }

    /**
     * Audits age gap between parent and child for biological constraints and generational warnings.
     *
     * @example
     * FamilyTree._checkParentChildAgeGap(child, parent, 'Mother', 45, issues);
     * // Appends error if gap <= 0, warning if gap < 12 or gap > 45
     *
     * @example
     * FamilyTree._checkParentChildAgeGap(child, parentWithoutYob, 'Father', 60, issues);
     * // returns early without appending issues
     *
     * @param {Person} child - Child profile with yob
     * @param {Person} parent - Parent profile with yob
     * @param {string} role - 'Mother' or 'Father'
     * @param {number} maxAge - Maximum expected age at childbirth
     * @param {Array<Object>} issues - Array to append issues to
     */
    static _checkParentChildAgeGap(child, parent, role, maxAge, issues) {
        if (!parent.yob) return;
        const gap = child.yob - parent.yob;
        if (gap <= 0) {
            issues.push({
                p: child,
                type: 'error',
                category: 'parent_child_inconsistency',
                text: `Born in ${child.yob}, but ${role.toLowerCase()} (${parent.name}) was born in ${parent.yob} (child cannot be born before or in the same year as parent).`
            });
        } else if (gap < FamilyTreeBuilder.GENERATIONAL_GAPS.MIN_PARENTAL_AGE) {
            issues.push({
                p: child,
                type: 'warning',
                category: 'parent_child_inconsistency',
                text: `${role} (${parent.name}) was only ${gap} years old at childbirth (under biological minimum age of ${FamilyTreeBuilder.GENERATIONAL_GAPS.MIN_PARENTAL_AGE}).`
            });
        }
        if (gap > maxAge) {
            issues.push({
                p: child,
                type: 'warning',
                category: 'parent_child_inconsistency',
                text: `${role} (${parent.name}) is unusually old (${gap} yrs) at birth.`
            });
        }
    }

    /**
     * Audits whether child was born after parent's death year.
     *
     * @example
     * FamilyTree._checkParentDeathConsistency(child, parent, 'Mother', false, issues);
     * // Appends error if child.yob > parent.death
     *
     * @example
     * FamilyTree._checkParentDeathConsistency(child, parentWithoutDeath, 'Father', true, issues);
     * // returns early without appending issues
     *
     * @param {Person} child - Child profile with yob
     * @param {Person} parent - Parent profile with death year
     * @param {string} role - 'Mother' or 'Father'
     * @param {boolean} allowPosthumous - Allow childbirth up to 1 year after death (for father)
     * @param {Array<Object>} issues - Array to append issues to
     */
    static _checkParentDeathConsistency(child, parent, role, allowPosthumous, issues) {
        if (!parent.death) return;
        const pDeath = parseInt(parent.death, 10);
        const limit = allowPosthumous ? pDeath + 1 : pDeath;
        if (!isNaN(pDeath) && child.yob > limit) {
            issues.push({
                p: child,
                type: 'error',
                category: 'parent_child_inconsistency',
                text: `Born in ${child.yob}, but ${role.toLowerCase()} (${parent.name}) died in ${pDeath}.`
            });
        }
    }

    /**
     * Audits a single parent-child relationship for biological childbirth age bounds and post-mortem errors.
     *
     * @param {Person} child - Child profile
     * @param {string|null} parentId - Parent profile ID
     * @param {Object} roleBounds - Parental role constraints ({ role, maxAge, allowPosthumous })
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditSingleParentChildLink(child, '1', { role: 'Mother', maxAge: 45, allowPosthumous: false }, tree, issues);
     *
     * @example
     * FamilyTree._auditSingleParentChildLink(child, null, { role: 'Father', maxAge: 60, allowPosthumous: true }, tree, issues);
     * // returns early when parentId is null
     */
    static _auditSingleParentChildLink(child, parentId, roleBounds, tree, issues) {
        if (!parentId) return;
        const parent = tree.get(parentId);
        if (!parent) return;

        const { role, maxAge, allowPosthumous } = roleBounds;
        FamilyTree._checkParentChildAgeGap(child, parent, role, maxAge, issues);
        FamilyTree._checkParentDeathConsistency(child, parent, role, allowPosthumous, issues);
    }

    /**
     * Audits parental age at childbirth and post-mortem childbirth errors.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree containing parent nodes
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditParentChildConsistency(childWithYob, tree, issues);
     *
     * @example
     * FamilyTree._auditParentChildConsistency(childWithoutYob, tree, issues);
     * // returns early when p.yob is falsy
     */
    static _auditParentChildConsistency(p, tree, issues) {
        if (!p.yob) return;
        FamilyTree._auditSingleParentChildLink(
            p, p.momId, { role: 'Mother', maxAge: FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MAX_MOTHER_CHILDBIRTH_AGE, allowPosthumous: false }, tree, issues
        );
        FamilyTree._auditSingleParentChildLink(
            p, p.fatherId, { role: 'Father', maxAge: FamilyTreeBuilder.BIOLOGICAL_BOUNDS.MAX_FATHER_CHILDBIRTH_AGE, allowPosthumous: true }, tree, issues
        );
    }

    /**
     * Determines whether a spousal ambiguity has been implicitly resolved by a single close sheet neighbor candidate.
     *
     * @param {Object} amb - Ambiguity descriptor
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @returns {boolean} True if ambiguity is resolved by proximity
     *
     * @example
     * FamilyTree._isSpouseAmbiguityResolvedByProximity({ relation: 'spouse', candidates: [nearCand, farCand] }, p, tree)
     * // => true
     *
     * @example
     * FamilyTree._isSpouseAmbiguityResolvedByProximity({ relation: 'mother', candidates: [] }, p, tree)
     * // => false
     */
    static _isSpouseAmbiguityResolvedByProximity(amb, p, tree) {
        const isSpouseRelation = ['spouse', 'husband', 'wife', 'partner'].includes(amb.relation);
        if (!isSpouseRelation) return false;

        const maxClose = FamilyTreeBuilder.GENERATIONAL_GAPS?.MAX_ROW_NEIGHBOR_DISTANCE || 5;
        const closebyCands = (amb.candidates || []).filter(c => {
            const cNode = tree.get(c.id) || c;
            return FamilyTreeBuilder.sharesSheet(cNode, p) && 
                FamilyTreeBuilder._getMinRowDistance(cNode, p) <= maxClose;
        });
        return closebyCands.length === 1;
    }

    /**
     * Orders ambiguity candidates with the currently used/linked candidate placed first.
     * Marks the active candidate with `isCurrentlyUsed = true`.
     *
     * @param {Object} amb - Ambiguity descriptor
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @returns {Array<Object>} Ordered candidate list
     *
     * @example
     * FamilyTree._orderAmbiguityCandidates({ candidates: [c1, c2] }, p, tree)
     * // => [c2, c1] (with c2.isCurrentlyUsed = true)
     *
     * @example
     * FamilyTree._orderAmbiguityCandidates({}, p, tree)
     * // => []
     */
    static _orderAmbiguityCandidates(amb, p, tree) {
        const candidates = amb.candidates || [];
        const usedCand = candidates.find(c => FamilyTree._isCandidateUsed(c, amb, p, tree)) || candidates[candidates.length - 1];
        const orderedCandidates = usedCand ? [usedCand, ...candidates.filter(c => c !== usedCand)] : candidates;
        if (usedCand) usedCand.isCurrentlyUsed = true;
        amb.candidates = orderedCandidates;
        return orderedCandidates;
    }

    /**
     * Formats ambiguity records for the audit log, ordering the active graph candidate first.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditAmbiguities(personWithAmbiguities, tree, issues);
     *
     * @example
     * FamilyTree._auditAmbiguities(personWithoutAmbiguities, tree, issues);
     * // returns early when ambiguities array is empty
     */
    static _auditAmbiguities(p, tree, issues) {
        if (!p.ambiguities || p.ambiguities.length === 0) return;
        const seenAmb = new Set();
        p.ambiguities.forEach(amb => {
            if (typeof amb === 'string') {
                if (!seenAmb.has(amb)) {
                    seenAmb.add(amb);
                    issues.push({ p, type: 'warning', category: 'ambiguity', amb: { message: amb }, text: `Ambiguity: ${amb}` });
                }
                return;
            }
            const key = `${amb.relation || ''}_${amb.query || ''}_${(amb.candidates || []).map(c => c.id || c.name).join('_')}`;
            if (seenAmb.has(key)) return;
            seenAmb.add(key);

            if (FamilyTree._isSpouseAmbiguityResolvedByProximity(amb, p, tree)) return;

            const orderedCandidates = FamilyTree._orderAmbiguityCandidates(amb, p, tree);
            const cList = FamilyTree._formatAmbiguityCandidatesSummary(orderedCandidates);
            const candStr = cList ? `: ${cList}` : '';
            const message = amb.message || `Found multiple candidates for ${amb.relation || 'relationship'} '${amb.query || ''}'`;
            issues.push({ p, type: 'warning', category: 'ambiguity', amb, text: `Ambiguity: ${message}${candStr}` });
        });
    }

    /**
     * Formats a list of candidate profiles into a concise comma-separated summary string.
     *
     * @param {Array<Object>} candidates - Candidate profiles
     * @returns {string} Comma-separated candidate details string
     *
     * @example
     * FamilyTree._formatAmbiguityCandidatesSummary([
     *   { name: 'Joseph', yob: 1920, death: 1995, sheetRow: 7 },
     *   { name: 'Joseph', yob: 1930 }
     * ])
     * // => 'Joseph (b. 1920, d. 1995, Row 7), Joseph (b. 1930)'
     *
     * @example
     * FamilyTree._formatAmbiguityCandidatesSummary([])
     * // => ''
     */
    static _formatAmbiguityCandidatesSummary(candidates) {
        return (candidates || [])
            .map(c => {
                const details = [
                    c.yob ? `b. ${c.yob}` : '',
                    c.death ? `d. ${c.death}` : '',
                    c.sheetRow ? `Row ${c.sheetRow}` : ''
                ].filter(Boolean).join(', ');
                return `${c.name}${details ? ` (${details})` : ''}`;
            })
            .filter(Boolean)
            .join(', ');
    }

    /**
     * Audits birth year, death year, and lifespan bounds for an individual.
     *
     * Rules checked:
     * - Death year recorded before birth year (error).
     * - Birth or death year in the future (error).
     * - Unusually early birth year < 1700 (warning).
     * - Lifespan > 115 years or living individual > 115 years old (warning).
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditDateConsistency({ yob: 1950, death: 1940 }, tree, issues);
     * // => issues.push({ type: 'error', category: 'date_anomaly', text: 'Death year (1940) is recorded before birth year (1950).' })
     *
     * @example
     * FamilyTree._auditDateConsistency({ yob: 1850, isGhost: false }, tree, issues);
     * // => issues.push({ type: 'warning', category: 'lifespan_anomaly', text: 'Profile born in 1850 is over 115 years old...' })
     */
    static _auditDateConsistency(p, tree, issues) {
        const currentYear = new Date().getFullYear();
        const yob = p.yob;
        const death = p.death ? parseInt(p.death, 10) : null;

        const dateRules = [
            { when: yob && death && death < yob, type: 'error', cat: 'date_anomaly', text: `Death year (${death}) is recorded before birth year (${yob}).` },
            { when: yob && yob > currentYear, type: 'error', cat: 'date_anomaly', text: `Birth year (${yob}) is in the future.` },
            { when: death && death > currentYear, type: 'error', cat: 'date_anomaly', text: `Death year (${death}) is in the future.` },
            { when: yob && yob < 1700, type: 'warning', cat: 'date_anomaly', text: `Unusually early birth year (${yob}) — check for typographical error.` },
            { when: yob && death && (death - yob > 115), type: 'warning', cat: 'lifespan_anomaly', text: `Recorded lifespan of ${death - yob} years (${yob}–${death}) exceeds normal human longevity (>115 yrs).` },
            { when: !p.isGhost && yob && !death && (currentYear - yob > 115), type: 'warning', cat: 'lifespan_anomaly', text: `Profile born in ${yob} is over 115 years old (${currentYear - yob} yrs) without a recorded death year.` }
        ];

        for (const { when, type, cat, text } of dateRules) {
            if (when) issues.push({ p, type, category: cat, text });
        }
    }

    /**
     * Audits the age difference between husband and wife, flagging wives recorded as older
     * or unusually large age gaps exceeding 30 years. Evaluated once per partnership pair (p.id < partner.id).
     *
     * @param {Person} p - First partner
     * @param {Person} partner - Second partner
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditSpousalAgeGap(Husband_1930, Wife_1925, issues);
     * // => issues.push({ category: 'spouse_inconsistency', text: 'Wife ... older than husband ... by 5 years.' })
     *
     * @example
     * FamilyTree._auditSpousalAgeGap(Husband_1930, Wife_1935, issues);
     * // normal age gap, no issue appended
     */
    static _auditSpousalAgeGap(p, partner, issues) {
        if (!p.yob || !partner.yob || p.id >= partner.id) return;

        const isHusband = p.gender === 'M' || partner.gender === 'F';
        const husband = isHusband ? p : partner;
        const wife = isHusband ? partner : p;
        const gap = wife.yob - husband.yob;

        if (gap < 0 && Math.abs(gap) > 0) {
            issues.push({
                p: husband,
                type: 'warning',
                category: 'spouse_inconsistency',
                text: `Wife ${wife.name} (b. ${wife.yob}) is recorded as older than husband ${husband.name} (b. ${husband.yob}) by ${Math.abs(gap)} years.`
            });
        } else if (gap > 30) {
            issues.push({
                p: husband,
                type: 'warning',
                category: 'spouse_inconsistency',
                text: `Unusually large spousal age gap: husband ${husband.name} (b. ${husband.yob}) is ${gap} years older than wife ${wife.name} (b. ${wife.yob}).`
            });
        }
    }

    /**
     * Audits an individual partner link for post-mortem marriage, age gap bounds, or celibacy violations.
     *
     * @param {Person} p - Target person
     * @param {Person} partner - Linked partner profile
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditSinglePartnerLink({ name: 'Mary', death: 1950 }, { name: 'John', yob: 1955 }, issues);
     * // => issues.push({ type: 'error', category: 'spouse_inconsistency', text: 'Spouse John was born in 1955, after Mary died in 1950.' })
     *
     * @example
     * FamilyTree._auditSinglePartnerLink({ name: 'Sr. Mary', isNun: true }, { name: 'John' }, issues);
     * // => issues.push({ type: 'warning', category: 'religious_vow', text: 'Religious profile with vows of celibacy (Sr. Mary) has a linked partner (John).' })
     */
    static _auditSinglePartnerLink(p, partner, issues) {
        if (p.death && partner.yob && parseInt(p.death, 10) < partner.yob) {
            issues.push({
                p,
                type: 'error',
                category: 'spouse_inconsistency',
                text: `Spouse ${partner.name} was born in ${partner.yob}, after ${p.name} died in ${p.death}.`
            });
        }

        FamilyTree._auditSpousalAgeGap(p, partner, issues);

        if (FamilyTreeBuilder._isCelibateReligious(p)) {
            issues.push({
                p,
                type: 'warning',
                category: 'religious_vow',
                text: `Religious profile with vows of celibacy (${p.name}) has a linked partner (${partner.name}).`
            });
        }
    }

    /**
     * Audits whether a profile is partnered with two or more biological siblings.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditSiblingSpouseConflicts(personWithSiblingPartners, tree, issues);
     * // => appends sibling_spouse_conflict error to issues
     *
     * @example
     * FamilyTree._auditSiblingSpouseConflicts(personWithOnePartner, tree, issues);
     * // returns without issues
     */
    static _auditSiblingSpouseConflicts(p, tree, issues) {
        for (let i = 0; i < p.partners.length; i++) {
            for (let j = i + 1; j < p.partners.length; j++) {
                const p1 = tree.get(p.partners[i]);
                const p2 = tree.get(p.partners[j]);
                if (p1 && p2 && FamilyTreeBuilder._areBiologicalSiblings(p1, p2)) {
                    issues.push({
                        p,
                        type: 'error',
                        category: 'sibling_spouse_conflict',
                        text: `Profile ${p.name} is partnered with biological siblings ${p1.name} and ${p2.name}.`
                    });
                }
            }
        }
    }

    /**
     * Extracts an explicit ordinal suffix (e.g. 1 from 'Wife 1') from a partner profile name.
     *
     * @param {Person} node - Partner profile
     * @returns {number|null} 1-based ordinal index or null if none
     *
     * @example
     * FamilyTree._extractPartnerOrdinal({ name: 'Kochappappan Wife 1' })
     * // => 1
     *
     * @example
     * FamilyTree._extractPartnerOrdinal({ name: 'Mary' })
     * // => null
     */
    static _extractPartnerOrdinal(node) {
        const match = (node?.name || '').match(/\b(?:Wife|Husband|Spouse|Partner)\s*(\d+)\b/i);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Determines the first and last childbearing birth years for a parent-spouse partnership.
     *
     * @param {Person} parent - Parent profile
     * @param {Person} spouse - Partner profile
     * @param {FamilyTree} tree - Tree instance for child lookups
     * @returns {{first: number|null, last: number|null}} First and last child YOB
     *
     * @example
     * FamilyTree._getSpouseChildbearingYears(parentWithChildren, spouse, tree)
     * // => { first: 1921, last: 1927 }
     *
     * @example
     * FamilyTree._getSpouseChildbearingYears(childlessParent, spouse, tree)
     * // => { first: null, last: null }
     */
    static _getSpouseChildbearingYears(parent, spouse, tree) {
        const spouseNormName = spouse._normName || spouse.name?.toLowerCase().trim();
        const children = (parent.children || [])
            .map(cid => tree.get(cid))
            .filter(c => c && (
                c.momId === spouse.id ||
                c.fatherId === spouse.id ||
                (c.mom && c.mom.toLowerCase().trim() === spouseNormName) ||
                (c.father && c.father.toLowerCase().trim() === spouseNormName)
            ));
        const yobs = children.map(c => c.yob || c._inferredYob).filter(Boolean);
        return {
            first: yobs.length ? Math.min(...yobs) : null,
            last: yobs.length ? Math.max(...yobs) : null
        };
    }

    /**
     * Determines whether partner p2 precedes partner p1 in chronological marriage sequence.
     *
     * @param {number|null} ord1 - Ordinal indicator of first partner
     * @param {number|null} ord2 - Ordinal indicator of second partner
     * @param {Object} ch1 - Childbearing years for first partner
     * @param {Object} ch2 - Childbearing years for second partner
     * @param {?number} y1 - Birth year of first partner
     * @param {?number} y2 - Birth year of second partner
     * @returns {boolean} True if p2 is chronologically earlier than p1
     *
     * @example
     * FamilyTree._isSecondPartnerEarlier(null, 1, {}, {}, 1950, 1945);
     * // => true
     *
     * @example
     * FamilyTree._isSecondPartnerEarlier(1, null, {}, {}, 1945, 1950);
     * // => false
     */
    static _isSecondPartnerEarlier(ord1, ord2, ch1, ch2, y1, y2) {
        if (ord1 === 1) return false;
        if (ord2 === 1) return true;
        if (ch1 && ch2 && ch1.first && ch2.first) {
            return ch1.first > ch2.first;
        }
        return Boolean(y1 && y2 && y1 > y2);
    }

    /**
     * Determines the chronological ordering of two spouses sharing a central partner.
     *
     * @param {Person} p1 - First spouse profile
     * @param {Person} p2 - Second spouse profile
     * @param {Person} p - Shared spouse profile
     * @param {FamilyTree} tree - Tree instance
     * @returns {{ earlySpouse: Person, lateSpouse: Person, earlyCh: Object, lateCh: Object, ord1: number|null, ord2: number|null }}
     *
     * @example
     * FamilyTree._determinePartnerOrder(Wife2, Wife1, p, tree)
     * // => { earlySpouse: Wife1, lateSpouse: Wife2, ... }
     *
     * @example
     * FamilyTree._determinePartnerOrder(WifeA, WifeB, p, tree)
     * // => { earlySpouse: WifeA, lateSpouse: WifeB, ... }
     */
    static _determinePartnerOrder(p1, p2, p, tree) {
        const ord1 = FamilyTree._extractPartnerOrdinal(p1);
        const ord2 = FamilyTree._extractPartnerOrdinal(p2);
        const ch1 = FamilyTree._getSpouseChildbearingYears(p, p1, tree);
        const ch2 = FamilyTree._getSpouseChildbearingYears(p, p2, tree);

        const y1 = p1.yob || p1._inferredYob;
        const y2 = p2.yob || p2._inferredYob;

        const p2Earlier = FamilyTree._isSecondPartnerEarlier(ord1, ord2, ch1, ch2, y1, y2);
        const earlySpouse = p2Earlier ? p2 : p1;
        const lateSpouse = p2Earlier ? p1 : p2;
        const earlyCh = p2Earlier ? ch2 : ch1;
        const lateCh = p2Earlier ? ch1 : ch2;
        return { earlySpouse, lateSpouse, earlyCh, lateCh, ord1, ord2 };
    }

    /**
     * Checks if two ordinal partner indicators denote sequential partnerships (e.g. Wife 1 vs Wife 2).
     *
     * @param {number|null} ord1 - Ordinal of first partner
     * @param {number|null} ord2 - Ordinal of second partner
     * @returns {boolean} True if ordinals denote sequential spouses
     *
     * @example
     * FamilyTree._areExplicitSequentialOrdinals(1, 2)
     * // => true
     *
     * @example
     * FamilyTree._areExplicitSequentialOrdinals(null, null)
     * // => false
     */
    static _areExplicitSequentialOrdinals(ord1, ord2) {
        if (ord1 === null && ord2 === null) return false;
        if (ord1 !== null && ord2 !== null) return ord1 !== ord2;
        return (ord1 === 1 && ord2 !== 1) || (ord2 === 1 && ord1 !== 1);
    }

    /**
     * Checks whether two partner profiles have overlapping lifespans.
     * When death year is not specified, lifespan is estimated up to 80 years from birth.
     *
     * @param {Person} p1 - First partner profile
     * @param {Person} p2 - Second partner profile
     * @returns {boolean} True if partner lifespans overlap
     *
     * @example
     * FamilyTree._haveOverlappingLifespans({ yob: 1920, death: 1980 }, { yob: 1930, death: 1990 })
     * // => true
     *
     * @example
     * FamilyTree._haveOverlappingLifespans({ yob: 1900, death: 1925 }, { yob: 1930, death: 1970 })
     * // => false
     */
    static _haveOverlappingLifespans(p1, p2) {
        const y1 = p1.yob || p1._inferredYob;
        const y2 = p2.yob || p2._inferredYob;
        const d1 = p1.death ? parseInt(p1.death, 10) : (y1 ? y1 + 80 : null);
        const d2 = p2.death ? parseInt(p2.death, 10) : (y2 ? y2 + 80 : null);
        return Boolean(y1 && y2 && d1 && d2 && Math.max(y1, y2) < Math.min(d1, d2));
    }

    /**
     * Evaluates whether two partners represent an allowable sequential remarriage rather than concurrent partners.
     *
     * Chronological order is determined by explicit ordinals (e.g. Wife 1 vs Wife 2), childbearing years,
     * or known birth years. If the earlier spouse died before or around the later spouse's childbearing/marriage
     * window, or if non-overlapping childbearing windows are established, returns true.
     *
     * @param {Person} p1 - First partner profile
     * @param {Person} p2 - Second partner profile
     * @param {Person} p - Parent profile
     * @param {FamilyTree} tree - Tree instance
     * @returns {boolean} True if relationship is a valid sequential remarriage
     *
     * @example
     * FamilyTree._isSequentialRemarriage(wife1, wife2, parent, tree)
     * // => true (when wife1 died before wife2 marriage)
     *
     * @example
     * FamilyTree._isSequentialRemarriage(wifeA, wifeB, parent, tree)
     * // => false (when lifespans and childbearing overlap)
     */
    static _isSequentialRemarriage(p1, p2, p, tree) {
        const { earlySpouse, lateSpouse, earlyCh, lateCh, ord1, ord2 } = FamilyTree._determinePartnerOrder(p1, p2, p, tree);

        const earlyDeath = earlySpouse.death ? parseInt(earlySpouse.death, 10) : null;
        const lateYob = lateSpouse.yob || lateSpouse._inferredYob;
        const lateMarriageStart = lateCh.first ? (lateCh.first - 1) : ((lateYob) ? lateYob + 20 : null);

        // If earlier spouse died before or around the later spouse marriage / childbearing, sequential remarriage!
        const remarriageCutoff = lateCh.first ? (lateCh.first + 2) : (lateMarriageStart ? lateMarriageStart + 2 : null);
        if (earlyDeath && remarriageCutoff && earlyDeath <= remarriageCutoff) {
            return true;
        }

        // If explicitly named sequential partners and earlier spouse had all children before later spouse started
        const isExplicitSequential = FamilyTree._areExplicitSequentialOrdinals(ord1, ord2);
        if (isExplicitSequential && (!earlyCh.last || !lateCh.first || earlyCh.last <= lateCh.first + 2)) {
            if (!earlyDeath || !lateMarriageStart || earlyDeath <= lateMarriageStart + 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Audits multi-partner profiles for concurrent overlapping living partners without recorded remarriage.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditConcurrentPartners(personWithConcurrentPartners, tree, issues);
     * // appends concurrent_partners error
     *
     * @example
     * FamilyTree._auditConcurrentPartners(personWithSinglePartner, tree, issues);
     * // returns early without appending issues
     */
    static _auditConcurrentPartners(p, tree, issues) {
        // Remarriages/multiple partners explicitly recorded with comma or slash are intentional polygamy/polyandry records
        if (p.spouse?.includes(',') || p.spouse?.includes('/')) return;

        const partnerNodes = p.partners.map(id => tree.get(id)).filter(Boolean);
        for (let i = 0; i < partnerNodes.length; i++) {
            for (let j = i + 1; j < partnerNodes.length; j++) {
                const p1 = partnerNodes[i], p2 = partnerNodes[j];
                if (FamilyTree._isSequentialRemarriage(p1, p2, p, tree)) {
                    continue;
                }

                if (FamilyTree._haveOverlappingLifespans(p1, p2)) {
                    issues.push({
                        p,
                        type: 'error',
                        category: 'concurrent_partners',
                        text: `Multiple concurrent living partners: ${p1.name} and ${p2.name} overlap in lifespan without recorded divorce or sequential remarriage.`
                    });
                }
            }
        }
    }

    /**
     * Audits spouse relationships for a person, checking single-partner anomalies,
     * sibling-spouse incest prohibitions, and concurrent living partners.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance for partner lookups
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditSpouseConsistency(personWithPartners, tree, issues);
     *
     * @example
     * FamilyTree._auditSpouseConsistency(unpartneredPerson, tree, issues);
     * // returns early when p.partners is empty
     */
    static _auditSpouseConsistency(p, tree, issues) {
        if (!p.partners || p.partners.length === 0) return;

        // 1. Audit individual partner pairings (age bounds, post-mortem marriages, celibacy vows)
        p.partners.forEach(partId => {
            const partner = tree.get(partId);
            if (partner) {
                FamilyTree._auditSinglePartnerLink(p, partner, issues);
            }
        });

        // 2. Multi-partner audits (biological sibling-spouses, concurrent living partners)
        if (p.partners.length > 1) {
            FamilyTree._auditSiblingSpouseConflicts(p, tree, issues);
            FamilyTree._auditConcurrentPartners(p, tree, issues);
        }
    }

    /**
     * Audits whether declared spouses, mothers, or fathers in spreadsheet data rows
     * were successfully linked to concrete or ghost profiles in the tree.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance
     * @param {Array<Object>} issues - Accumulated issue list
     *
     * @example
     * FamilyTree._auditUnresolvedClaims(personWithUnlinkedSpouse, tree, issues);
     * // appends unresolved_claim warning
     *
     * @example
     * FamilyTree._auditUnresolvedClaims(ghostPerson, tree, issues);
     * // returns early for ghost profiles
     */
    static _auditUnresolvedClaims(p, tree, issues) {
        if (p.isGhost) return;
        const claims = [
            { role: 'spouse', declared: p.spouse, isLinked: p.partners && p.partners.length > 0 },
            { role: 'mother', declared: p.mom, isLinked: !!p.momId },
            { role: 'father', declared: p.father, isLinked: !!p.fatherId }
        ];
        claims.forEach(({ role, declared, isLinked }) => {
            if (declared && !isLinked) {
                issues.push({
                    p,
                    type: 'warning',
                    category: 'unresolved_claim',
                    text: `Declared ${role} '${declared}' in spreadsheet, but no matching ${role} profile was linked in tree.`
                });
            }
        });
    }

    /**
     * Checks a person model for chronological, biological, or relational inconsistencies.
     *
     * Rules checked:
     * - Death year recorded before birth year.
     * - Parent age at childbirth below minimum marriage age or above biological ceiling.
     * - Child born after parent recorded death year.
     * - Unresolved ambiguous linkages or multiple partners.
     *
     * @param {Person} p - Target person
     * @param {FamilyTree} tree - Tree instance for parent lookups
     * @returns {Array<{p: Person, type: 'error'|'warning', text: string}>} Inconsistencies found
     *
     * @example
     * const issues = FamilyTree.auditPerson(person, tree);
     * // => [{ p: person, type: 'error', text: 'Death year (1950) is recorded before birth year (1960).' }]
     *
     * @example
     * const emptyIssues = FamilyTree.auditPerson(consistentPerson, tree);
     * // => []
     */
    static auditPerson(p, tree) {
        const issues = [];
        FamilyTree._auditDateConsistency(p, tree, issues);
        FamilyTree._auditParentChildConsistency(p, tree, issues);
        FamilyTree._auditSpouseConsistency(p, tree, issues);
        FamilyTree._auditUnresolvedClaims(p, tree, issues);
        FamilyTree._auditAmbiguities(p, tree, issues);

        if (p.partners && p.partners.length > 1) {
            issues.push({ p, type: 'warning', category: 'multiple_partners', partners: p.partners, text: `Has multiple partners (${p.partners.length}).` });
        }
        return issues;
    }

    /**
     * Strips common religious titles/honorifics ('Sr.', 'Fr.', 'Rev.', 'Br.') from a person name.
     *
     * @param {string} name - Raw person name
     * @returns {string} Cleaned name without title prefixes
     *
     * @example
     * FamilyTree.cleanPersonName('Sr. Philomena')
     * // => 'Philomena'
     *
     * @example
     * FamilyTree.cleanPersonName('Fr. Joseph')
     * // => 'Joseph'
     */
    static cleanPersonName(name) {
        if (!name || typeof name !== 'string') return '';
        let cleaned = name.trim();
        cleaned = cleaned.replace(/^(?:Rev\.|Fr\.|Sr\.|Br\.|Brother|Father|Sister)\s+/i, '');
        return cleaned.trim();
    }

    /**
     * Normalizes a string by phonetic spelling folding, reducing consecutive duplicates,
     * common digraphs (ph->p, th->t, ck->k, ch->c, sh->s, bh->b, dh->d, gh->g, kh->k),
     * and vowel digraphs (ee->i, oo->u).
     *
     * @param {string} str - Input word or name
     * @returns {string} Phonetically folded spelling string
     *
     * @example
     * FamilyTree.foldSpelling('Ouseph')
     * // => 'ousep'
     *
     * @example
     * FamilyTree.foldSpelling('Matthew')
     * // => 'matew'
     */
    static foldSpelling(str) {
        if (!str) return '';
        return str.toLowerCase().trim()
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/([a-z])\1+/g, '$1')
            .replace(/ck/g, 'k')
            .replace(/bh/g, 'b')
            .replace(/dh/g, 'd')
            .replace(/gh/g, 'g')
            .replace(/kh/g, 'k')
            .replace(/ph/g, 'p')
            .replace(/th/g, 't')
            .replace(/ch/g, 'c')
            .replace(/sh/g, 's')
            .replace(/ee/g, 'i')
            .replace(/oo/g, 'u');
    }

    /**
     * Calculates the Levenshtein edit distance between two strings.
     *
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Minimum number of single-character edits (insertions, deletions, substitutions)
     *
     * @example
     * FamilyTree.levenshtein('kitten', 'sitting')
     * // => 3
     *
     * @example
     * FamilyTree.levenshtein('flaw', 'lawn')
     * // => 2
     */
    static levenshtein(a, b) {
        if (!a) return (b || '').length;
        if (!b) return a.length;
        const s1 = a.toLowerCase();
        const s2 = b.toLowerCase();
        const m = s1.length, n = s2.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = s1[i - 1] === s2[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
    }

    /**
     * Computes the Jaro-Winkler similarity metric between two strings, returning
     * a normalized value in [0.0, 1.0]. Delegates to FamilyTreeBuilder.computeJaroWinkler.
     *
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number} Jaro-Winkler distance score between 0.0 and 1.0
     *
     * @example
     * FamilyTree.computeJaroWinkler('mothr', 'mother')
     * // => ~0.967
     *
     * @example
     * FamilyTree.computeJaroWinkler('dixon', 'dicksonx')
     * // => ~0.813
     */
    static computeJaroWinkler(s1, s2) {
        if (typeof FamilyTreeBuilder !== 'undefined' && typeof FamilyTreeBuilder.computeJaroWinkler === 'function') {
            return FamilyTreeBuilder.computeJaroWinkler(s1, s2);
        }
        if (s1 === s2) return 1.0;
        if (!s1 || !s2) return 0.0;
        return s1.toLowerCase() === s2.toLowerCase() ? 1.0 : 0.0;
    }

    /**
     * Checks if two strings differ ONLY by consonant gemination (letter doubling),
     * such as 'Mathew' vs 'Matthew', 'Chacko' vs 'Chako', 'Eliamma' vs 'Elliamma',
     * or 'Annamma' vs 'Anamma'.
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if words differ only by gemination
     *
     * @example
     * FamilyTree.isGeminationDifference('Mathew', 'Matthew')
     * // => true
     *
     * @example
     * FamilyTree.isGeminationDifference('Chinnu', 'Chinnan')
     * // => false
     */
    static isGeminationDifference(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;

        const degeminate = (s) => s.replace(/([a-z])\1+/g, '$1').replace(/ck/g, 'k');
        return degeminate(s1) === degeminate(s2);
    }

    /**
     * Checks whether a character is an English vowel (a, e, i, o, u) or semi-vowel (y, w).
     *
     * @param {string} ch - Character to check
     * @returns {boolean} True if character is a vowel or semi-vowel
     *
     * @example
     * FamilyTree.isVowelOrSemiVowel('a')
     * // => true
     *
     * @example
     * FamilyTree.isVowelOrSemiVowel('k')
     * // => false
     */
    static isVowelOrSemiVowel(ch) {
        return /^[aeiouyw]$/i.test(ch || '');
    }

    /**
     * Checks whether a candidate word extends another word by adding a single trailing vowel or semi-vowel.
     *
     * @param {string} s1 - First word
     * @param {string} s2 - Second word
     * @returns {boolean} True if one word is a strict prefix of the other with a trailing vowel/semi-vowel
     *
     * @example
     * FamilyTree._isTrailingVowelExtension('john', 'johny')
     * // => true
     *
     * @example
     * FamilyTree._isTrailingVowelExtension('ouseph', 'ousep')
     * // => false
     */
    static _isTrailingVowelExtension(s1, s2) {
        if (Math.abs(s1.length - s2.length) !== 1) return false;
        const shorter = s1.length < s2.length ? s1 : s2;
        const longer = s1.length < s2.length ? s2 : s1;
        if (!longer.startsWith(shorter)) return false;
        const extraChar = longer[longer.length - 1];
        return FamilyTree.isVowelOrSemiVowel(extraChar);
    }

    /**
     * Checks whether two words of identical length differ only by a single final character that is a vowel or semi-vowel.
     *
     * @param {string} s1 - First word
     * @param {string} s2 - Second word
     * @returns {boolean} True if words differ solely at the final character involving a vowel/semi-vowel
     *
     * @example
     * FamilyTree._isFinalVowelSubstitution('deepa', 'deepu')
     * // => true
     *
     * @example
     * FamilyTree._isFinalVowelSubstitution('deepa', 'deept')
     * // => false
     */
    static _isFinalVowelSubstitution(s1, s2) {
        if (s1.length !== s2.length || s1.length === 0) return false;
        if (s1.slice(0, -1) !== s2.slice(0, -1)) return false;
        const c1 = s1[s1.length - 1];
        const c2 = s2[s2.length - 1];
        return FamilyTree.isVowelOrSemiVowel(c1) || FamilyTree.isVowelOrSemiVowel(c2);
    }

    /**
     * Determines whether two words differ only by a word-ending vowel or semi-vowel.
     * Word-ending vowel or semi-vowel differences are meaningful distinctions (e.g. 'Deepa' vs 'Deepu',
     * 'John' vs 'Johny', 'Paul' vs 'Pauly', 'Anto' vs 'Antu', 'Rose' vs 'Rosa') and should be avoided
     * from spelling warnings.
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if the difference between w1 and w2 is at the word ending involving a vowel or semi-vowel
     *
     * @example
     *   FamilyTree.hasWordEndingVowelDifference('deepa', 'deepu')
     *   // => true ('a' vs 'u')
     *
     * @example
     *   FamilyTree.hasWordEndingVowelDifference('john', 'johny')
     *   // => true (appended 'y')
     */
    static hasWordEndingVowelDifference(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;

        return FamilyTree._isTrailingVowelExtension(s1, s2) ||
               FamilyTree._isFinalVowelSubstitution(s1, s2);
    }

    /**
     * Determines whether two words differ only by the dropping or addition of 'h'
     * (e.g. 'Ajes' vs 'Ajesh', 'Ouseph' vs 'Ousep', 'Joseph' vs 'Josep', 'Thomas' vs 'Tomas').
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if one word is formed by dropping a single 'h' from the other
     *
     * @example
     * FamilyTree.isDroppingHDifference('Ajes', 'Ajesh')
     * // => true
     *
     * @example
     * FamilyTree.isDroppingHDifference('Ouseph', 'Ousep')
     * // => true
     */
    static isDroppingHDifference(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;
        if (Math.abs(s1.length - s2.length) !== 1) return false;

        const shorter = s1.length < s2.length ? s1 : s2;
        const longer = s1.length < s2.length ? s2 : s1;

        for (let i = 0; i < longer.length; i++) {
            if (longer[i] === 'h') {
                const candidate = longer.slice(0, i) + longer.slice(i + 1);
                if (candidate === shorter) return true;
            }
        }
        return false;
    }

    /**
     * Determines whether two words differ only by a semi-vowel difference (i/y)
     * (e.g. 'Kochuthresia' vs 'Kochuthresya', 'Mariam' vs 'Mariyam').
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if difference is strictly an i/y semi-vowel substitution or glide
     *
     * @example
     * FamilyTree.isSemiVowelDifference('Kochuthresia', 'Kochuthresya')
     * // => true
     *
     * @example
     * FamilyTree.isSemiVowelDifference('Mariam', 'Mariyam')
     * // => true
     */
    static isSemiVowelDifference(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;

        // Substitution between 'i' and 'y' (e.g. Kochuthresia vs Kochuthresya)
        if (s1.length === s2.length && s1.replace(/y/g, 'i') === s2.replace(/y/g, 'i')) {
            return true;
        }

        // Glide 'y' adjacent to 'i' in transliterations (e.g. Mariam vs Mariyam: ia vs iya)
        if (s1.replace(/iya/g, 'ia') === s2.replace(/iya/g, 'ia')) {
            return true;
        }

        return false;
    }

    /**
     * Determines whether two words differ only by a diphthong difference (ie/e)
     * (e.g. 'Annie' vs 'Anne').
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if difference is strictly a diphthong variation (ie/e)
     *
     * @example
     * FamilyTree.isDiphthongDifference('Annie', 'Anne')
     * // => true
     *
     * @example
     * FamilyTree.isDiphthongDifference('Paul', 'Pauly')
     * // => false
     */
    static isDiphthongDifference(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;

        // Diphthong difference: 'ie' vs 'e' (e.g. Annie vs Anne)
        if (s1.replace(/ie/g, 'e') === s2.replace(/ie/g, 'e')) {
            return true;
        }

        return false;
    }

    /**
     * Determines whether two single-word tokens represent near-duplicate spelling variants.
     * Per domain rules, spelling warnings are triggered strictly by:
     *   1. Gemination differences (e.g. 'Annu' vs 'Anu', 'Mathew' vs 'Matthew', 'Chacko' vs 'Chako')
     *   2. Dropping or addition of 'h' (e.g. 'Ajes' vs 'Ajesh', 'Ouseph' vs 'Ousep', 'Thomas' vs 'Tomas')
     *   3. Semi-vowel differences (i/y) (e.g. 'Kochuthresia' vs 'Kochuthresya', 'Mariam' vs 'Mariyam')
     *   4. Diphthong differences (ie/e) (e.g. 'Annie' vs 'Anne')
     *
     * Consonant changes (e.g. 'Shibu' vs 'Shiju' [b/j], 'Franci' vs 'Francis' [s], 'Rehya' vs 'Rehva' [y/v])
     * and word-ending vowel changes (e.g. 'Deepa' vs 'Deepu') do NOT cause a warning.
     *
     * @param {string} w1 - First word
     * @param {string} w2 - Second word
     * @returns {boolean} True if words represent near-duplicate spellings warranting an audit warning
     *
     * @example
     * FamilyTree.isAlmostSameWord('Annu', 'Anu')
     * // => true
     *
     * @example
     * FamilyTree.isAlmostSameWord('Deepa', 'Deepu')
     * // => false
     */
    static isAlmostSameWord(w1, w2) {
        if (!w1 || !w2) return false;
        const s1 = w1.toLowerCase().trim();
        const s2 = w2.toLowerCase().trim();
        if (s1 === s2) return false;

        return FamilyTree.isGeminationDifference(s1, s2) ||
               FamilyTree.isDroppingHDifference(s1, s2) ||
               FamilyTree.isSemiVowelDifference(s1, s2) ||
               FamilyTree.isDiphthongDifference(s1, s2);
    }

    /**
     * Counts the number of near-match word differences between two equal-length word lists.
     * Returns -1 if any corresponding word pair fails both exact and near-match similarity.
     *
     * @param {string[]} wordsA - First word array
     * @param {string[]} wordsB - Second word array
     * @returns {number} Count of near-match differences, or -1 if incompatible
     *
     * @example
     * FamilyTree._countNearWordDifferences(['Ouseph', 'Varghese'], ['Ousep', 'Varghese']);
     * // => 1
     *
     * @example
     * FamilyTree._countNearWordDifferences(['John', 'Paul'], ['George', 'Ringo']);
     * // => -1
     */
    static _countNearWordDifferences(wordsA, wordsB) {
        let diffCount = 0;
        for (let i = 0; i < wordsA.length; i++) {
            const wA = wordsA[i], wB = wordsB[i];
            if (wA.toLowerCase() === wB.toLowerCase()) continue;
            if (FamilyTree.isAlmostSameWord(wA, wB)) {
                diffCount++;
            } else {
                return -1;
            }
        }
        return diffCount;
    }

    /**
     * Determines whether two person names are almost the same spelling (e.g. 'Ouseph' vs 'Ousep',
     * 'Kochu Thresia' vs 'Kochuthresia', 'Ouseph Varghese' vs 'Ousep Varghese').
     *
     * @param {string} nameA - First name
     * @param {string} nameB - Second name
     * @returns {boolean} True if names are near-duplicate spelling variants
     *
     * @example
     * FamilyTree.areAlmostSameNames('Ouseph', 'Ousep')
     * // => true
     *
     * @example
     * FamilyTree.areAlmostSameNames('Kochu Thresia', 'Kochuthresia')
     * // => true
     */
    static areAlmostSameNames(nameA, nameB) {
        const a = FamilyTree.cleanPersonName(nameA);
        const b = FamilyTree.cleanPersonName(nameB);
        if (!a || !b || a.toLowerCase() === b.toLowerCase()) return false;

        // Spacing variant: e.g. "Kochu Thresia" vs "Kochuthresia"
        if (a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()) {
            return true;
        }

        const wordsA = a.split(/\s+/), wordsB = b.split(/\s+/);
        if (wordsA.length !== wordsB.length) return false;

        return FamilyTree._countNearWordDifferences(wordsA, wordsB) === 1;
    }

    /**
     * Formats an audit warning message comparing a less-used spelling to a more common variant.
     *
     * @param {{canonicalDisplay: string, total: number}} rareGroup - Less-used (or peer) group
     * @param {{canonicalDisplay: string, total: number}} commonGroup - More common (or peer) group
     * @returns {string} Formatted audit warning text
     *
     * @example
     * FamilyTree._formatSpellingWarningText({ canonicalDisplay: 'Ousep', total: 1 }, { canonicalDisplay: 'Ouseph', total: 5 })
     * // => "Spelling 'Ousep' (used 1 time) is almost the same as 'Ouseph' (used 5 times)."
     *
     * @example
     * FamilyTree._formatSpellingWarningText({ canonicalDisplay: 'Annu', total: 2 }, { canonicalDisplay: 'Anu', total: 8 })
     * // => "Spelling 'Annu' (used 2 times) is almost the same as 'Anu' (used 8 times)."
     */
    static _formatSpellingWarningText(rareGroup, commonGroup) {
        const rareCount = `${rareGroup.total} ${rareGroup.total === 1 ? 'time' : 'times'}`;
        const commonCount = `${commonGroup.total} ${commonGroup.total === 1 ? 'time' : 'times'}`;
        return `Spelling '${rareGroup.canonicalDisplay}' (used ${rareCount}) is almost the same as '${commonGroup.canonicalDisplay}' (used ${commonCount}).`;
    }

    /**
     * Determines whether a person profile should be included in name spelling audits,
     * filtering out unknown placeholders, synthetic relative ghosts, and unnamed entries.
     *
     * @param {Object} p - Person profile
     * @returns {boolean} True if profile is eligible for spelling audit
     *
     * @example
     * FamilyTree._isEligibleForNameSpellingAudit({ name: 'Ouseph' })
     * // => true
     *
     * @example
     * FamilyTree._isEligibleForNameSpellingAudit({ name: 'George Son 1' })
     * // => false
     */
    static _isEligibleForNameSpellingAudit(p) {
        if (!p || !p.name) return false;
        if (p._isUnknown || p.name.startsWith('(')) return false;
        if (typeof FamilyTreeBuilder !== 'undefined' && typeof FamilyTreeBuilder._isRelativeName === 'function') {
            if (FamilyTreeBuilder._isRelativeName(p.name)) return false;
        } else if (/^(?:.+?\s+)?(?:Husband|Wife|Spouse|Partner|Son|Daughter|Boy|Girl|Brother|Sister|Father|Mother)(?:\s*\d+)?$/i.test(p.name.trim())) {
            return false;
        }
        return true;
    }

    /**
     * Resolves the most frequently occurring display capitalization/spelling in a name group.
     *
     * @param {Map<string, number>} displayCounts - Frequency map of display variants
     * @param {string} fallback - Default name if map is empty
     * @returns {string} Most common display name
     *
     * @example
     * FamilyTree._resolveCanonicalDisplayName(new Map([['Ouseph', 5], ['Ousep', 1]]), 'ouseph')
     * // => 'Ouseph'
     *
     * @example
     * FamilyTree._resolveCanonicalDisplayName(new Map(), 'mathew')
     * // => 'mathew'
     */
    static _resolveCanonicalDisplayName(displayCounts, fallback) {
        let maxCount = -1;
        let canonicalDisplay = fallback;
        for (const [disp, cnt] of displayCounts.entries()) {
            if (cnt > maxCount) {
                maxCount = cnt;
                canonicalDisplay = disp;
            }
        }
        return canonicalDisplay;
    }

    /**
     * Indexes an eligible person profile into normalized spelling name groups.
     *
     * @param {Person} p - Person profile to index
     * @param {Map<string, {displayCounts: Map<string, number>, total: number, people: Array<Person>}>} nameGroups - Target map
     *
     * @example
     * const groups = new Map();
     * FamilyTree._indexPersonInSpellingGroup({ name: 'Ouseph' }, groups);
     * // groups.has('ouseph') => true
     *
     * @example
     * const groups = new Map();
     * FamilyTree._indexPersonInSpellingGroup({ name: '(Unknown)' }, groups);
     * // groups.size => 0
     */
    static _indexPersonInSpellingGroup(p, nameGroups) {
        if (!FamilyTree._isEligibleForNameSpellingAudit(p)) return;
        const cleaned = FamilyTree.cleanPersonName(p.name);
        if (!cleaned) return;
        const normKey = cleaned.toLowerCase();
        if (!nameGroups.has(normKey)) {
            nameGroups.set(normKey, { displayCounts: new Map(), total: 0, people: [] });
        }
        const group = nameGroups.get(normKey);
        group.total++;
        group.people.push(p);
        group.displayCounts.set(cleaned, (group.displayCounts.get(cleaned) || 0) + 1);
    }

    /**
     * Groups eligible concrete profiles by normalized cleaned name, computing group frequency and canonical display name.
     *
     * Excludes unknowns, placeholder names in parentheses, and relative relation names (e.g. 'Mary Son 1').
     *
     * @param {Array<Person>} people - Profiles to group
     * @returns {Array<{normKey: string, canonicalDisplay: string, total: number, people: Array<Person>}>} Name groups
     *
     * @example
     * FamilyTree._groupProfilesByNormalizedName([{ name: 'Ouseph' }, { name: 'ouseph' }])
     * // => [{ normKey: 'ouseph', canonicalDisplay: 'Ouseph', total: 2, people: [...] }]
     *
     * @example
     * FamilyTree._groupProfilesByNormalizedName([{ name: '(Unknown)' }, { name: 'John Son 1' }])
     * // => []
     */
    static _groupProfilesByNormalizedName(people) {
        const nameGroups = new Map();
        for (const p of people) {
            FamilyTree._indexPersonInSpellingGroup(p, nameGroups);
        }
        return Array.from(nameGroups.entries(), ([normKey, data]) => ({
            normKey,
            canonicalDisplay: FamilyTree._resolveCanonicalDisplayName(data.displayCounts, normKey),
            total: data.total,
            people: data.people
        }));
    }

    /**
     * Records or updates spelling warning notices for all members of a target name group.
     *
     * @param {Map<string, Object>} warningsByPersonId - Map of person ID to warning descriptor
     * @param {Object} targetGroup - Group whose members receive the warning
     * @param {Object} referenceGroup - Comparison group whose spelling is contrasted
     * @param {boolean} [onlyIfMissing=false] - If true, only records warning if person doesn't already have one
     *
     * @example
     * const warnings = new Map();
     * FamilyTree._recordSpellingWarning(warnings, { canonicalDisplay: 'Ousep', total: 1, people: [{ id: 'p1' }] }, { canonicalDisplay: 'Ouseph', total: 5 }, false);
     * // warnings.get('p1').text => "Spelling 'Ousep' (used 1 time) is almost the same as 'Ouseph' (used 5 times)."
     *
     * @example
     * const warnings = new Map([['p1', { priority: 10 }]]);
     * FamilyTree._recordSpellingWarning(warnings, { people: [{ id: 'p1' }] }, { total: 3 }, false);
     * // warnings.get('p1').priority remains 10 (higher priority preserved)
     */
    static _recordSpellingWarning(warningsByPersonId, targetGroup, referenceGroup, onlyIfMissing = false) {
        const text = FamilyTree._formatSpellingWarningText(targetGroup, referenceGroup);
        const priority = referenceGroup.total;
        for (const p of targetGroup.people) {
            const existing = warningsByPersonId.get(p.id);
            if (onlyIfMissing) {
                if (!existing) {
                    warningsByPersonId.set(p.id, { p, text, priority });
                }
            } else if (!existing || priority > existing.priority) {
                warningsByPersonId.set(p.id, { p, text, priority });
            }
        }
    }

    /**
     * Compares pairs of distinct name groups for near-duplicate spellings, returning prioritized warnings per person.
     *
     * @param {Array<Object>} groups - Name groups
     * @returns {Map<string, {p: Person, text: string, priority: number}>} Map of person ID to warning descriptor
     *
     * @example
     * const g1 = { canonicalDisplay: 'Ouseph', total: 5, people: [{ id: 'p1' }] };
     * const g2 = { canonicalDisplay: 'Ousep', total: 1, people: [{ id: 'p2' }] };
     * FamilyTree._compareSpellingGroups([g1, g2]);
     * // => Map containing warning for 'p2' referencing 'Ouseph'
     *
     * @example
     * const g1 = { canonicalDisplay: 'George', total: 3, people: [{ id: 'p1' }] };
     * const g2 = { canonicalDisplay: 'Mathew', total: 4, people: [{ id: 'p2' }] };
     * FamilyTree._compareSpellingGroups([g1, g2]);
     * // => empty Map (distinct names)
     */
    /**
     * Compares a pair of spelling groups and records near-duplicate name warnings for the less frequent variant.
     *
     * @private
     * @param {Object} gA - First spelling group
     * @param {Object} gB - Second spelling group
     * @param {Map<string, Array<Object>>} warningsByPersonId - Accumulated warning map
     *
     * @example
     * const map = new Map();
     * FamilyTree._evaluateSpellingPair({ canonicalDisplay: 'Ousep', total: 1, people: [] }, { canonicalDisplay: 'Ouseph', total: 5, people: [] }, map);
     * // => map populated with warning
     *
     * @example
     * const map = new Map();
     * FamilyTree._evaluateSpellingPair({ canonicalDisplay: 'John', total: 2, people: [] }, { canonicalDisplay: 'Mary', total: 2, people: [] }, map);
     * // => map unmodified (distinct names)
     */
    static _evaluateSpellingPair(gA, gB, warningsByPersonId) {
        if (!FamilyTree.areAlmostSameNames(gA.canonicalDisplay, gB.canonicalDisplay)) return;
        if (gA.total < gB.total) {
            FamilyTree._recordSpellingWarning(warningsByPersonId, gA, gB, false);
        } else if (gB.total < gA.total) {
            FamilyTree._recordSpellingWarning(warningsByPersonId, gB, gA, false);
        } else {
            FamilyTree._recordSpellingWarning(warningsByPersonId, gA, gB, true);
            FamilyTree._recordSpellingWarning(warningsByPersonId, gB, gA, true);
        }
    }

    /**
     * Compares all pairs of phonetic spelling groups to detect name spelling anomalies and discrepancies.
     *
     * @param {Array<Object>} groups - Array of spelling groups with persons and name variants
     * @returns {Map<string, Object>} Map from person ID to detected spelling warning details
     *
     * @example
     * const warnings = FamilyTree._compareSpellingGroups([]);
     * // => warnings.size === 0
     *
     * @example
     * const groupA = { norm: 'joseph', count: 5, persons: [{ id: 'p1', name: 'Joseph' }] };
     * const groupB = { norm: 'josef', count: 1, persons: [{ id: 'p2', name: 'Josef' }] };
     * const warnings = FamilyTree._compareSpellingGroups([groupA, groupB]);
     * // => warnings.has('p2') === true
     */
    static _compareSpellingGroups(groups) {
        const warningsByPersonId = new Map();
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                FamilyTree._evaluateSpellingPair(groups[i], groups[j], warningsByPersonId);
            }
        }
        return warningsByPersonId;
    }

    /**
     * Audits near-duplicate name spellings across the entire tree, flagging the less-common variant.
     * Flags less-used spellings as the cause of warning (e.g. 'Ousep' used 1 time vs 'Ouseph' used 5 times).
     *
     * @param {FamilyTree} tree - Tree to audit
     * @param {Array<Object>} issues - Inconsistency issue sink
     *
     * @example
     * const issues = [];
     * FamilyTree._auditNameSpellings({ all: [{ id: 'p1', name: 'Ouseph' }, { id: 'p2', name: 'Ousep' }] }, issues);
     * // issues has 1 entry with category 'spelling'
     *
     * @example
     * const issues = [];
     * FamilyTree._auditNameSpellings({ all: [{ id: 'p1', name: 'George' }] }, issues);
     * // issues remains empty
     */
    static _auditNameSpellings(tree, issues) {
        if (!tree || !tree.all) return;

        const groups = FamilyTree._groupProfilesByNormalizedName(tree.all);
        if (groups.length < 2) return;

        const warningsByPersonId = FamilyTree._compareSpellingGroups(groups);
        for (const { p, text } of warningsByPersonId.values()) {
            issues.push({
                p,
                type: 'warning',
                category: 'spelling',
                text
            });
        }
    }

    /**
     * Traverses graph neighbors from a starting node to collect all reachable connected node IDs.
     *
     * @param {string} startId - Initial person node ID
     * @param {Set<string>} [visited] - Optional global visited set to avoid re-visiting
     * @returns {Set<string>} Set of connected person node IDs
     *
     * @example
     * tree._collectConnectedComponent('p1')
     * // => Set {'p1', 'p2', 'p3'}
     *
     * @example
     * const visited = new Set(['p1']);
     * tree._collectConnectedComponent('p1', visited)
     * // => Set {'p1'}
     */
    _collectConnectedComponent(startId, visited = new Set()) {
        const component = new Set([startId]);
        const queue = [startId];
        let qIdx = 0;
        visited.add(startId);

        while (qIdx < queue.length) {
            const id = queue[qIdx++];
            const p = this.get(id);
            if (!p) continue;
            const neighbors = [p.momId, p.fatherId, ...p.partners, ...p.children].filter(Boolean);
            for (const n of neighbors) {
                if (!visited.has(n)) {
                    visited.add(n);
                    component.add(n);
                    queue.push(n);
                }
            }
        }
        return component;
    }

    /**
     * Identifies the oldest non-ghost person profile within a set of node IDs.
     * Prioritizes nodes with an explicit birth year (minimum YOB); if no member has a birth year,
     * falls back to the first non-ghost member in the component.
     *
     * @param {Set<string>} componentIds - Set of node IDs in a connected component
     * @returns {Person|null} Oldest Person entity, or null if only ghosts
     *
     * @example
     * // Component with members: P1 (yob 1950), P2 (yob 1920), P3 (no yob)
     * tree._findOldestInComponent(new Set(['P1', 'P2', 'P3']))
     * // => P2
     *
     * @example
     * // Component with members without birth years: P1, P2
     * tree._findOldestInComponent(new Set(['P1', 'P2']))
     * // => P1
     */
    _findOldestInComponent(componentIds) {
        let oldest = null;
        let minYear = Infinity;

        for (const id of componentIds) {
            const p = this.get(id);
            if (!p || p.isGhost) continue;

            if (p.yob && p.yob < minYear) {
                minYear = p.yob;
                oldest = p;
            } else if (!oldest) {
                oldest = p;
            }
        }
        return oldest;
    }

    /**
     * Identifies all disconnected / disjoint subtrees in the graph outside
     * the primary tree connected to `rootId`.
     *
     * Performs breadth-first traversal from rootId to determine reachable nodes,
     * then clusters remaining unvisited nodes into disjoint subtrees, determining
     * each component's oldest member and size.
     *
     * @returns {Array<{root: Person, size: number}>} Disjoint roots sorted descending by component size
     *
     * @example
     * const subtrees = tree.findDisjointSubtrees();
     * // => [{ root: Person[John, 1850], size: 14 }, ...]
     *
     * @example
     * const singleTree = new FamilyTree();
     * singleTree.findDisjointSubtrees();
     * // => []
     */
    findDisjointSubtrees() {
        if (!this.root) return [];
        const roots = [];
        const visited = new Set();
        this._collectConnectedComponent(this.rootId, visited);

        for (const id of Object.keys(this.nodes)) {
            if (visited.has(id)) continue;
            const component = this._collectConnectedComponent(id, visited);
            const oldest = this._findOldestInComponent(component);
            if (oldest) {
                roots.push({ root: oldest, size: component.size });
            }
        }
        roots.sort((a, b) => b.size - a.size);
        return roots;
    }

    /**
     * Extracts duplicate spreadsheet source row references for a single person profile,
     * grouping by spreadsheet source ID and identifying sheets with multiple references.
     *
     * @param {Person} p - Profile to inspect
     * @returns {Array<Object>} List of duplicate source references
     *
     * @example
     * FamilyTree._findDuplicatePersonSourceRefs({ _allSourceRefs: [{ sheetId: 's1' }, { sheetId: 's1' }] })
     * // => [{ sheetId: 's1' }, { sheetId: 's1' }]
     *
     * @example
     * FamilyTree._findDuplicatePersonSourceRefs({ _allSourceRefs: [{ sheetId: 's1' }, { sheetId: 's2' }] })
     * // => []
     */
    static _findDuplicatePersonSourceRefs(p) {
        if (!p || p.isGhost || !p._allSourceRefs) return [];
        const sheetGroups = {};
        for (const ref of p._allSourceRefs) {
            if (!sheetGroups[ref.sheetId]) sheetGroups[ref.sheetId] = [];
            sheetGroups[ref.sheetId].push(ref);
        }
        const duplicatedRefs = [];
        for (const refs of Object.values(sheetGroups)) {
            if (refs.length > 1) duplicatedRefs.push(...refs);
        }
        return duplicatedRefs;
    }

    /**
     * Audits whether individual profiles appear in multiple duplicate rows on the same spreadsheet.
     *
     * @param {FamilyTree} tree - Target tree
     * @returns {Array<{p: Person, duplicatedRefs: Array<Object>}>} Duplicated source reference groups
     *
     * @example
     * const dupes = FamilyTree._auditDuplicateSourceRefs(treeWithDuplicates);
     * // => [{ p: Person[John], duplicatedRefs: [...] }]
     *
     * @example
     * const dupes = FamilyTree._auditDuplicateSourceRefs(cleanTree);
     * // => []
     */
    static _auditDuplicateSourceRefs(tree) {
        const dupes = [];
        for (const p of tree.all || []) {
            const duplicatedRefs = FamilyTree._findDuplicatePersonSourceRefs(p);
            if (duplicatedRefs.length > 0) {
                dupes.push({ p, duplicatedRefs });
            }
        }
        return dupes;
    }

    /**
     * Generates a temporary flattened visual layout of the tree from its root for audit verification.
     * 
     * @param {FamilyTree} tree - Target tree instance
     * @returns {Object|null} Flattened layout with nodes array, or null if layout cannot be generated
     *
     * @example
     * const layout = FamilyTree._generateAuditLayout(tree);
     * // => { nodes: [...], bounds: {...} }
     *
     * @example
     * const emptyLayout = FamilyTree._generateAuditLayout({ rootId: null });
     * // => null
     */
    static _generateAuditLayout(tree) {
        if (!tree.rootId || typeof layoutSubtree !== 'function' || typeof flattenTreeLayout !== 'function') {
            return null;
        }
        try {
            const rootNode = tree.get(tree.rootId);
            if (!rootNode) return null;

            const layout = layoutSubtree(rootNode, tree, {
                collapsedNodes: new Set(),
                visibleNodes: tree.getVisibleNodes(new Set()),
                rootNodeYob: rootNode.bestYob || 1900,
                ppy: 10,
                siblingGap: 24
            }, new Set());

            return layout ? flattenTreeLayout(layout) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Inspects flattened visual layout nodes to identify and record any profiles rendered more than once.
     * 
     * @param {Array<Object>} flatNodes - Flattened layout node records
     * @param {Array<Object>} inconsistencies - Accumulated audit issues list
     *
     * @example
     * const issues = [];
     * FamilyTree._collectDuplicateRenderedNodes([{ person: { id: 'p1', name: 'John' } }, { person: { id: 'p1', name: 'John' } }], issues);
     * // issues has 1 entry with category 'duplicate_rendered_node'
     *
     * @example
     * const issues = [];
     * FamilyTree._collectDuplicateRenderedNodes([{ person: { id: 'p1', name: 'John' } }], issues);
     * // issues remains empty
     */
    static _collectDuplicateRenderedNodes(flatNodes, inconsistencies) {
        const seenNodeIds = new Map();
        (flatNodes || []).forEach(n => {
            const p = n.person;
            if (!p || p.isGhost) return;
            if (seenNodeIds.has(p.id)) {
                inconsistencies.push({
                    p,
                    type: 'error',
                    category: 'duplicate_rendered_node',
                    text: `Node '${p.name}' (${p.id}) is rendered multiple times in the family tree layout.`
                });
            } else {
                seenNodeIds.set(p.id, true);
            }
        });
    }

    /**
     * Audits visual tree layout for structural invariants (e.g. guaranteeing no node card is duplicated in rendering).
     *
     * @param {FamilyTree} tree - Target tree
     * @param {Array<Object>} inconsistencies - Accumulated inconsistency issues
     *
     * @example
     * const issues = [];
     * FamilyTree._auditLayoutInvariants(validTree, issues);
     * // issues remains empty
     *
     * @example
     * const issues = [];
     * FamilyTree._auditLayoutInvariants(treeWithDupes, issues);
     * // issues contains duplicate_rendered_node warning/error
     */
    static _auditLayoutInvariants(tree, inconsistencies) {
        const flat = FamilyTree._generateAuditLayout(tree);
        if (flat) {
            FamilyTree._collectDuplicateRenderedNodes(flat.nodes, inconsistencies);
        }
    }

    /**
     * Encapsulated business logic to perform full graph integrity audit.
     *
     * Checks:
     * - Person chronological and biological inconsistencies.
     * - Duplicate source spreadsheet row references.
     * - Near-duplicate name spellings across distinct branches.
     * - Disjoint subtrees unreachable from root.
     * - Visual layout rendering invariants (no duplicated node cards).
     *
     * @returns {{inconsistencies: Array<Object>, dupes: Array<Object>, subtrees: Array<Object>}} Audit results
     *
     * @example
     * const { inconsistencies, dupes, subtrees } = tree.audit();
     * // returns structured report of all detected issues
     *
     * @example
     * const report = emptyTree.audit();
     * // => { inconsistencies: [], dupes: [], subtrees: [] }
     */
    audit() {
        const inconsistencies = [];
        const dupes = FamilyTree._auditDuplicateSourceRefs(this);
        this.all.forEach(p => inconsistencies.push(...FamilyTree.auditPerson(p, this)));
        FamilyTree._auditNameSpellings(this, inconsistencies);
        const subtrees = this.findDisjointSubtrees();
        FamilyTree._auditLayoutInvariants(this, inconsistencies);
        return { inconsistencies, dupes, subtrees };
    }
}
