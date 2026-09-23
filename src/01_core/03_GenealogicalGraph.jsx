class GenealogicalGraph {
    /**
     * Initializes an empty genealogical graph with adjacency structures and name index.
     *
     * @example
     * const graph = new GenealogicalGraph();
     * graph.nodes.size;
     * // => 0
     *
     * @example
     * const graph = new GenealogicalGraph();
     * graph.getConnectedComponents();
     * // => []
     */
    constructor() {
        this.nodes = new Map();
        this.parents = new Map();
        this.children = new Map();
        this.partners = new Map();
        this.siblings = new Map();
        this.nameIndex = new Map();
    }

    /**
     * Retrieves or initializes a Set stored under the specified key in a Map.
     *
     * @private
     * @param {Map<*, Set<*>>} map - Target adjacency or indexing map
     * @param {*} key - Key to look up or insert
     * @returns {Set<*>} Associated set
     *
     * @example
     * const map = new Map();
     * const set = graph._getOrCreateSet(map, 'key1');
     * set.add('item1');
     * // => map.get('key1').has('item1') === true
     *
     * @example
     * const map = new Map([['existing', new Set(['val'])]]);
     * graph._getOrCreateSet(map, 'existing');
     * // => Set {'val'}
     */
    _getOrCreateSet(map, key) {
        let s = map.get(key);
        if (!s) {
            s = new Set();
            map.set(key, s);
        }
        return s;
    }

    /**
     * Registers a person node in the graph, initializing its adjacency lists and name indexing.
     *
     * @param {Person} person - Person instance to register
     *
     * @example
     * graph.addNode({ id: 'p1', _normName: 'john' });
     * graph.getNode('p1');
     * // => { id: 'p1', _normName: 'john' }
     *
     * @example
     * graph.addNode(null); // safely ignored
     * graph.getNode('p2');
     * // => null
     */
    addNode(person) {
        if (!person || !person.id) return;
        this.nodes.set(person.id, person);
        this._getOrCreateSet(this.parents, person.id);
        this._getOrCreateSet(this.children, person.id);
        this._getOrCreateSet(this.partners, person.id);
        this._getOrCreateSet(this.siblings, person.id);

        if (person._normName) {
            this._getOrCreateSet(this.nameIndex, person._normName).add(person.id);
        }
    }

    /**
     * Looks up a registered person node by its identifier.
     *
     * @param {string} id - Person identifier
     * @returns {Person|null} Person instance or null if not found
     *
     * @example
     * graph.getNode('existingId');
     * // => personInstance
     *
     * @example
     * graph.getNode('unknownId');
     * // => null
     */
    getNode(id) {
        return this.nodes.get(id) || null;
    }

    /**
     * Registers a directed parent-to-child relationship edge between two nodes.
     *
     * @param {string} parentId - Parent person ID
     * @param {string} childId - Child person ID
     *
     * @example
     * graph.addParentChild('father1', 'child1');
     * graph.parents.get('child1').has('father1');
     * // => true
     *
     * @example
     * graph.addParentChild('same', 'same'); // self-loop safely ignored
     * graph.children.get('same')?.has('same');
     * // => undefined or false
     */
    addParentChild(parentId, childId) {
        if (!parentId || !childId || parentId === childId) return;
        this._getOrCreateSet(this.parents, childId).add(parentId);
        this._getOrCreateSet(this.children, parentId).add(childId);
    }

    /**
     * Registers a mutual spousal relationship edge between two nodes.
     *
     * @param {string} idA - First partner ID
     * @param {string} idB - Second partner ID
     *
     * @example
     * graph.addPartner('husband1', 'wife1');
     * graph.partners.get('husband1').has('wife1');
     * // => true
     *
     * @example
     * graph.addPartner('p1', 'p1'); // self-partner safely ignored
     * graph.partners.get('p1')?.has('p1');
     * // => undefined or false
     */
    addPartner(idA, idB) {
        if (!idA || !idB || idA === idB) return;
        this._getOrCreateSet(this.partners, idA).add(idB);
        this._getOrCreateSet(this.partners, idB).add(idA);
    }

    /**
     * Traverses the directed graph from startId following the given directional adjacency map (parents or children).
     *
     * @private
     * @param {string} startId - Starting node identifier
     * @param {Map<string, Set<string>>} adjacencyMap - Directional adjacency map
     * @returns {Set<string>} Set of reachable node identifiers
     *
     * @example
     * // Graph with dad -> son -> grandson:
     * graph._traverseReachable('son', graph.children);
     * // => Set {'grandson'}
     *
     * @example
     * graph._traverseReachable('son', graph.parents);
     * // => Set {'dad'}
     */
    _traverseReachable(startId, adjacencyMap) {
        const visited = new Set();
        const queue = [startId];
        let qIdx = 0;
        while (qIdx < queue.length) {
            const curr = queue[qIdx++];
            const neighbors = adjacencyMap.get(curr);
            if (!neighbors) continue;
            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }
        return visited;
    }

    /**
     * Computes the transitive closure of all ancestor node IDs reachable by traversing upward via parents.
     *
     * @param {string} startId - Starting person ID
     * @returns {Set<string>} Set of all ancestor person IDs
     *
     * @example
     * graph.getAncestors('child')
     * // => Set {'father', 'mother', 'grandfather'}
     *
     * @example
     * graph.getAncestors('rootAncestor')
     * // => Set {}
     */
    getAncestors(startId) {
        return this._traverseReachable(startId, this.parents);
    }

    /**
     * Computes the transitive closure of all descendant node IDs reachable by traversing downward via children.
     *
     * @param {string} startId - Starting person ID
     * @returns {Set<string>} Set of all descendant person IDs
     *
     * @example
     * graph.getDescendants('parent')
     * // => Set {'child', 'grandchild'}
     *
     * @example
     * graph.getDescendants('leafPerson')
     * // => Set {}
     */
    getDescendants(startId) {
        return this._traverseReachable(startId, this.children);
    }

    /**
     * Determines whether targetNodeId is a descendant of ancestorId.
     *
     * @param {string} targetNodeId - Node ID to test for descendant status
     * @param {string} ancestorId - Potential ancestor node ID
     * @returns {boolean} True if targetNodeId is a descendant of ancestorId
     *
     * @example
     * graph.isDescendantOf('grandchild', 'grandparent')
     * // => true
     *
     * @example
     * graph.isDescendantOf('parent', 'child')
     * // => false
     */
    isDescendantOf(targetNodeId, ancestorId) {
        if (!targetNodeId || !ancestorId || targetNodeId === ancestorId) return false;
        return this.getDescendants(ancestorId).has(targetNodeId);
    }

    /**
     * Determines whether targetNodeId is an ancestor of descendantId.
     *
     * @param {string} targetNodeId - Node ID to test for ancestor status
     * @param {string} descendantId - Potential descendant node ID
     * @returns {boolean} True if targetNodeId is an ancestor of descendantId
     *
     * @example
     * graph.isAncestorOf('grandparent', 'grandchild')
     * // => true
     *
     * @example
     * graph.isAncestorOf('child', 'parent')
     * // => false
     */
    isAncestorOf(targetNodeId, descendantId) {
        if (!targetNodeId || !descendantId || targetNodeId === descendantId) return false;
        return this.getAncestors(descendantId).has(targetNodeId);
    }

    /**
     * Determines whether linking a parent to a child would introduce a genealogical cycle
     * (i.e. if the proposed parent is already a descendant of the child).
     *
     * @param {string} parentId - Proposed parent person ID
     * @param {string} childId - Proposed child person ID
     * @returns {boolean} True if the link creates a cycle, false otherwise
     *
     * @example
     * if (!graph.wouldFormCycle('pFather', 'pChild')) {
     *   graph.addParentChild('pFather', 'pChild');
     * }
     *
     * @example
     * graph.wouldFormCycle('self', 'self')
     * // => true
     */
    wouldFormCycle(parentId, childId) {
        if (parentId === childId) return true;
        return this.isDescendantOf(parentId, childId);
    }

    /**
     * Traverses all unvisited neighbors (parents, children, and partners) of a node,
     * marking them as visited and appending them to the exploration queue.
     *
     * @private
     * @param {string} id - Current node identifier
     * @param {Set<string>} visited - Visited tracking set
     * @param {Array<string>} queue - Traversal queue
     *
     * @example
     * // Node 'child' with parents {'dad', 'mom'} and partner {'spouse'}:
     * graph._enqueueNeighbors('child', visited, queue);
     * // => 'dad', 'mom', 'spouse' added to visited set and queue
     *
     * @example
     * // Node with all neighbors already in visited:
     * graph._enqueueNeighbors('nodeX', visited, queue);
     * // => queue remains unchanged
     */
    _enqueueNeighbors(id, visited, queue) {
        const adjSets = [this.parents.get(id), this.children.get(id), this.partners.get(id)];
        for (const set of adjSets) {
            if (!set) continue;
            for (const neighborId of set) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }
    }

    /**
     * Explores all reachable nodes in a connected component starting from a seed node ID using BFS.
     *
     * @private
     * @param {string} startId - Seed node identifier
     * @param {Set<string>} visited - Global visited tracking set
     * @returns {Set<string>} Set of all node IDs belonging to the component
     *
     * @example
     * const comp = graph._exploreComponent('rootId', visited);
     * // => Set {'rootId', 'spouseId', 'childId'}
     *
     * @example
     * const emptyComp = graph._exploreComponent('isolatedNode', visited);
     * // => Set {'isolatedNode'}
     */
    _exploreComponent(startId, visited) {
        const comp = new Set();
        const queue = [startId];
        let qIdx = 0;
        visited.add(startId);

        while (qIdx < queue.length) {
            const curr = queue[qIdx++];
            comp.add(curr);
            this._enqueueNeighbors(curr, visited, queue);
        }
        return comp;
    }

    /**
     * Identifies all mutually connected graph components linked through
     * parent, child, or spousal relationships.
     *
     * @returns {Array<Set<string>>} Array of component sets containing connected node IDs
     *
     * @example
     * const components = graph.getConnectedComponents();
     * console.log(`Discovered ${components.length} isolated lineages`);
     *
     * @example
     * const [primaryLineage, ...otherLineages] = graph.getConnectedComponents();
     */
    getConnectedComponents() {
        const visited = new Set();
        const components = [];

        for (const id of this.nodes.keys()) {
            if (!visited.has(id)) {
                components.push(this._exploreComponent(id, visited));
            }
        }
        return components;
    }
}
