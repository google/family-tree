// ============================================================================
// MODULE 4: BUILDER LOGIC (Tree Construction)

/**
 * Validates genealogical graph invariants and detects anomalies, cycles, and chronological violations.
 *
 * @example
 * const auditor = new InvariantAuditor();
 * const report = auditor.audit(tree);
 * // report.inconsistencies => Array of { p, type: 'error'|'warning', text }
 *
 * @example
 * const auditor = new InvariantAuditor();
 * const report = auditor.audit(emptyTree);
 * // report.subtrees => []
 */
class InvariantAuditor {
    /**
     * Constructs a new InvariantAuditor instance.
     *
     * @example
     * const auditor = new InvariantAuditor();
     *
     * @example
     * const isInstance = new InvariantAuditor() instanceof InvariantAuditor;
     * // => true
     */
    constructor() {}

    /**
     * Performs comprehensive graph integrity analysis.
     *
     * @param {FamilyTree} tree - Tree to analyze
     * @returns {{ inconsistencies: Array<Object>, dupes: Array<Object>, subtrees: Array<Object> }}
     *
     * @example
     * const auditor = new InvariantAuditor();
     * const report = auditor.audit(tree);
     * // => { inconsistencies: [...], dupes: [...], subtrees: [...] }
     *
     * @example
     * const auditor = new InvariantAuditor();
     * const report = auditor.audit(emptyTree);
     * // => { inconsistencies: [], dupes: [], subtrees: [] }
     */
    audit(tree) {
        return tree.audit();
    }
}
