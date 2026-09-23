class DisjointSetForest {
    /**
     * Constructs a new DisjointSetForest with empty parent and rank tables,
     * and an empty transaction history stack.
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.history.length;
     * // => 0
     *
     * @example
     * const forest = new DisjointSetForest();
     * Array.from(forest.parent.keys());
     * // => []
     */
    constructor() {
        this.parent = new Map();
        this.rank = new Map();
        this.history = []; // Stack of { child, oldParent, parent, rankModified, rootU, reason }
    }

    /**
     * Initializes a new singleton set for the specified item if not already present.
     *
     * @param {*} item - Entity identifier or item to register
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.makeSet('node1');
     * // => ds.find('node1') === 'node1'
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.makeSet('p1');
     * ds.makeSet('p1'); // idempotent registration
     * // => ds.find('p1') === 'p1'
     */
    makeSet(item) {
        if (!this.parent.has(item)) {
            this.parent.set(item, item);
            this.rank.set(item, 0);
        }
    }

    /**
     * Finds the canonical representative (root) of the set containing the item,
     * applying recursive path compression.
     *
     * @param {*} item - Entity identifier to look up
     * @returns {*} Canonical root identifier
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.union('A', 'B');
     * ds.find('B') === ds.find('A');
     * // => true
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.find('unregistered');
     * // => 'unregistered' (automatically initializes singleton set)
     */
    find(item) {
        if (!this.parent.has(item)) this.makeSet(item);
        if (this.parent.get(item) !== item) {
            this.parent.set(item, this.find(this.parent.get(item)));
        }
        return this.parent.get(item);
    }

    /**
     * Records a union operation in the transaction history stack and links the child root to the parent root.
     *
     * @private
     * @param {*} childRoot - Root node being attached as child
     * @param {*} parentRoot - Root node becoming the new parent
     * @param {boolean} rankModified - Whether parent root rank was incremented
     * @param {string} reason - Diagnostic explanation for the union
     *
     * @example
     * this._linkRoots('childRoot', 'parentRoot', false, 'merge components');
     * // => history length incremented by 1
     *
     * @example
     * this._linkRoots('rootB', 'rootA', true, 'equal rank union');
     * // => history contains rankModified: true
     */
    _linkRoots(childRoot, parentRoot, rankModified, reason) {
        this.parent.set(childRoot, parentRoot);
        this.history.push({
            child: childRoot,
            oldParent: childRoot,
            parent: parentRoot,
            rankModified,
            rootU: parentRoot,
            reason
        });
    }

    /**
     * Merges the sets containing items `u` and `v` using union-by-rank,
     * logging the operation onto the transaction history stack for rollback capability.
     *
     * @param {*} u - First item
     * @param {*} v - Second item
     * @param {string} [reason=''] - Diagnostic reason for this merge operation
     * @returns {boolean} True if sets were disjoint and merged, false if already in same set
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.union('profile1', 'profile2', 'Same email and birth year');
     * // => true
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.union('X', 'Y');
     * ds.union('X', 'Y');
     * // => false (already in the same connected component)
     */
    union(u, v, reason = '') {
        const rootU = this.find(u);
        const rootV = this.find(v);
        if (rootU === rootV) return false;

        const rankU = this.rank.get(rootU);
        const rankV = this.rank.get(rootV);

        if (rankU < rankV) {
            this._linkRoots(rootU, rootV, false, reason);
        } else if (rankU > rankV) {
            this._linkRoots(rootV, rootU, false, reason);
        } else {
            this.rank.set(rootU, rankU + 1);
            this._linkRoots(rootV, rootU, true, reason);
        }
        return true;
    }

    /**
     * Rolls back the most recent union operation, restoring original parent pointers and rank.
     *
     * @returns {boolean} True if an operation was rolled back, false if history stack was empty
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.union('A', 'B');
     * ds.rollback();
     * // => true (restored 'A' and 'B' as separate sets)
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.rollback();
     * // => false (history stack is empty)
     */
    rollback() {
        const op = this.history.pop();
        if (!op) return false;
        this.parent.set(op.child, op.oldParent);
        if (op.rankModified) {
            this.rank.set(op.rootU, this.rank.get(op.rootU) - 1);
        }
        return true;
    }

    /**
     * Partitions all tracked items into their respective connected components.
     *
     * @returns {Map<*, Array<*>>} Map from root representative to list of items in that set
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.union('A', 'B');
     * ds.makeSet('C');
     * ds.getComponents();
     * // => Map { 'A' => ['A', 'B'], 'C' => ['C'] }
     *
     * @example
     * const ds = new DisjointSetForest();
     * ds.getComponents();
     * // => Map {}
     */
    getComponents() {
        const groups = new Map();
        for (const item of this.parent.keys()) {
            const root = this.find(item);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(item);
        }
        return groups;
    }
}

/**
 * Directed Acyclic Graph (DAG) data structure with adjacency lists, indexing,
 * and graph query algorithms for family trees.
 * 
 * Encapsulates:
 *   - Parent-child directed edges
 *   - Mutual partner (spousal) undirected edges
 *   - Mutual sibling undirected edges
 *   - Graph traversal (BFS, DFS, Ancestor/Descendant closure, Cycle detection, Connected Components)
 * 
 * @example
 * const graph = new GenealogicalGraph();
 * graph.addNode(personA);
 * graph.addParentChild('fatherId', 'childId');
 * graph.getAncestors('childId'); // => Set {'fatherId'}
 *
 * @example
 * const graph = new GenealogicalGraph();
 * graph.wouldFormCycle('parentId', 'childId'); // => false
 */