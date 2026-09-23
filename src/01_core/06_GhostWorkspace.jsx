/**
 * Scratch workspace shared by every stage of relative-reference expansion.
 *
 * Spreadsheet rows routinely name people who have no row of their own:
 * "Rosy Daughter 1 Husband" implies a "Rosy Daughter 1" who was never entered.
 * Expansion therefore has to (a) look a name up across both the real rows and
 * the placeholders invented so far, and (b) invent a new placeholder when the
 * lookup misses.
 *
 * Those two abilities plus the accumulator they share used to travel as three
 * separate positional arguments -- `findByName`, `createGhost`, `newNodes` --
 * threaded through a dozen helpers, re-splatted out of the context object in
 * places, and trivially swappable at call sites. This object bundles them so
 * that a single `ws` parameter replaces the trio everywhere.
 */
class GhostWorkspace {
    /**
     * The lookup and factory strategies are injected rather than hard-coded so that
     * this class stays independent of `FamilyTreeBuilder` (and is trivially fakeable).
     *
     * @param {Object[]} nodes - Real (spreadsheet-backed) person nodes; never mutated by this class
     * @param {Function} findCandidate - `(name, contextNode, pool) => Object|null` name resolver
     * @param {Function} buildGhost - `(name, gender, mom, dad, srcId, sequenceIndex) => Object` factory
     *
     * @example
     * const ws = new GhostWorkspace([{ name: 'Rosy' }], find, build);
     * ws.newNodes.length;
     * // => 0
     *
     * @example
     * const ws = new GhostWorkspace([], () => null, (name) => ({ name }));
     * ws.create('Rosy Husband').name;
     * // => 'Rosy Husband'
     */
    constructor(nodes, findCandidate, buildGhost) {
        /** @type {Object[]} Real person nodes parsed from the sheet. */
        this.nodes = nodes;

        /** @type {Object[]} Ghosts synthesized during this expansion run, in creation order. */
        this.newNodes = [];

        this._findCandidate = findCandidate;
        this._buildGhost = buildGhost;
    }

    /**
     * Every node a lookup may match: real rows first, then ghosts invented so far.
     *
     * Rebuilt on each access because `newNodes` grows throughout expansion and a
     * ghost created by an earlier stage must be visible to later ones.
     *
     * @returns {Object[]} Combined candidate pool
     *
     * @example
     * new GhostWorkspace([{ name: 'Rosy' }], find, build).pool.length;
     * // => 1
     *
     * @example
     * const ws = new GhostWorkspace([{ name: 'Rosy' }], () => null, (n) => ({ name: n }));
     * ws.create('Rosy Husband');
     * ws.pool.map(p => p.name);
     * // => ['Rosy', 'Rosy Husband']
     */
    get pool() {
        return [...this.nodes, ...this.newNodes];
    }

    /**
     * Resolves a name against the current pool, preferring candidates near `contextNode`.
     *
     * @param {string} name - Name to resolve (e.g. 'Rosy Daughter 1')
     * @param {Object|null} [contextNode=null] - Node whose sheet row biases proximity scoring
     * @returns {Object|null} Best matching node, or null when the name is unknown
     *
     * @example
     * ws.find('Rosy');
     * // => { name: 'Rosy', ... }
     *
     * @example
     * ws.find('Mother', childNode);
     * // => the 'Mother' nearest childNode's sheet row, not the first one in the file
     */
    find(name, contextNode = null) {
        return this._findCandidate(name, contextNode, this.pool);
    }

    /**
     * Synthesizes a ghost person and appends it to the accumulator.
     *
     * The ghost's sequence index is `newNodes.length` *before* the push, so ghosts are
     * numbered 0, 1, 2, ... in creation order; this feeds their generated ids.
     *
     * @param {string} name - Ghost's display name
     * @param {string} [gender=''] - 'F', 'M', or '' when undetermined
     * @param {Object} [seed={}] - Facts already known about the ghost
     * @param {string} [seed.mom=''] - Mother's name, if already known
     * @param {string} [seed.dad=''] - Father's name, if already known
     * @param {string} [seed.srcId=''] - Sheet source id inherited from the declaring row
     * @returns {Object} The newly created (and already accumulated) ghost node
     *
     * @example
     * ws.create('Rosy Husband', 'M', { srcId: 'sheet1' });
     * // => { name: 'Rosy Husband', gender: 'M', _isGhost: true, ... }
     *
     * @example
     * ws.create('Mary Son 2', 'M', { mom: 'Mary', dad: 'John', srcId: 's1' });
     * // => ghost appended to ws.newNodes with sequence index equal to its position
     */
    create(name, gender = '', { mom = '', dad = '', srcId = '' } = {}) {
        const ghost = this._buildGhost(name, gender, mom, dad, srcId, this.newNodes.length);
        this.newNodes.push(ghost);
        return ghost;
    }

    /**
     * Returns the existing node for `name`, synthesizing a ghost only if none exists.
     *
     * Deliberately resolves without a context node: these are fully-qualified generated
     * names ('Mary Father'), so proximity scoring would add ambiguity, not remove it.
     *
     * @param {string} name - Name to resolve or invent
     * @param {string} [gender=''] - Gender to stamp on a newly created ghost
     * @param {Object} [seed={}] - Facts to stamp on a newly created ghost (see {@link GhostWorkspace#create})
     * @returns {Object} Existing or newly created node
     *
     * @example
     * ws.resolveOrCreate('Mary Mother', 'F', { srcId: 's1' });
     * // => existing 'Mary Mother' row if the sheet had one
     *
     * @example
     * ws.resolveOrCreate('John Father', 'M', { srcId: 's1' });
     * // => freshly synthesized ghost, appended to ws.newNodes
     */
    resolveOrCreate(name, gender = '', seed = {}) {
        return this.find(name) || this.create(name, gender, seed);
    }
}
