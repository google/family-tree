/**
 * Declarative orchestrator executing the 5-phase genealogical construction pipeline.
 *
 * @example
 * const pipeline = new FamilyTreePipeline(rawRows, sheetNames);
 * const tree = pipeline.execute();
 *
 * @example
 * const pipeline = new FamilyTreePipeline([]);
 * const tree = pipeline.execute();
 * // => empty FamilyTree
 */
class FamilyTreePipeline {
    /**
     * Constructs a FamilyTreePipeline with raw row datasets and sheet mappings.
     *
     * @param {Array<Object>} rawRows - Array of raw row objects from input sheets
     * @param {Object} [sheetNames={}] - Dictionary mapping sheet ID to sheet display name
     *
     * @example
     * const pipeline = new FamilyTreePipeline([{ Name: 'John', Sex: 'M' }]);
     *
     * @example
     * const pipeline = new FamilyTreePipeline([], { '1': 'Sheet1' });
     */
    constructor(rawRows, sheetNames = {}) {
        this.builder = new FamilyTreeBuilder(rawRows, sheetNames);
    }

    /**
     * Executes the tree construction pipeline and returns the assembled FamilyTree.
     *
     * @returns {FamilyTree} Built and validated family tree
     *
     * @example
     * const pipeline = new FamilyTreePipeline(rawRows);
     * const tree = pipeline.execute();
     *
     * @example
     * const tree = new FamilyTreePipeline([]).execute();
     * // => FamilyTree with 0 nodes
     */
    execute() {
        return this.builder.build();
    }
}

// ============================================================================