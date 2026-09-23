// ============================================================================
// MODULE 1: CONSTANTS, ENUMS & CORE GRAPH DATA STRUCTURES
// ============================================================================

/**
 * Generational, biological, and relationship dictionary constants.
 * Aliased directly from FamilyTreeBuilder.
 */
let GENERATIONAL_GAPS;
let BIOLOGICAL_BOUNDS;
let HEURISTIC_PRIORS;
let RELATIONSHIP_TOKENS;
let TITLE_ONTOLOGY;
let DemographicProfile;

/**
 * Disjoint-Set (Union-Find) data structure with path compression, union-by-rank,
 * and reversible transaction history for safe genealogical entity merging and dis-unification.
 * 
 * Used to cluster duplicate profiles, resolve ghost-to-concrete equivalence classes,
 * and back out erroneous merges when invariants (e.g. cycles, incest, temporal paradoxes) are violated.
 * 
 * @example
 * const ds = new DisjointSetForest();
 * ds.makeSet('A'); ds.makeSet('B');
 * ds.union('A', 'B', 'Same name & YOB on sheet 1');
 * ds.find('A') === ds.find('B'); // => true
 *
 * @example
 * const ds = new DisjointSetForest();
 * ds.union('A', 'B');
 * ds.rollback(); // Undoes union('A', 'B')
 * ds.find('A') === ds.find('B'); // => false
 */