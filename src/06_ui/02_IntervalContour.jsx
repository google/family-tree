/**
 * 2D Interval Profile Contour structure for non-overlapping spatial compaction of tree subtrees.
 * Discretizes subtree bounding boxes into 5px horizontal layers to compute minimum horizontal gaps.
 * 
 * @example
 * const c1 = new IntervalContour();
 * c1.addBox(0, 90, 0, 76);
 * const dist = c1.computeDistance(c2, 24);
 * 
 * @example
 * const c2 = c1.clone();
 * c2.shift(100);
 * c1.merge(c2);
 */
class IntervalContour {
    /**
     * Initializes an empty interval contour with an empty layer map.
     *
     * @example
     * const contour = new IntervalContour();
     *
     * @example
     * const subContour = new IntervalContour();
     */
    constructor() {
        this.layers = new Map(); // layerIdx (every 5px in Y) -> { minX, maxX }
    }

    /**
     * Computes the discretized start and end layer indices for a vertical coordinate span.
     *
     * @param {number} y1 - First vertical boundary
     * @param {number} y2 - Second vertical boundary
     * @returns {{ start: number, end: number }} Inclusive layer index range
     *
     * @example
     * IntervalContour._toLayerBounds(0, 76);
     * // => { start: -1, end: 16 }
     *
     * @example
     * IntervalContour._toLayerBounds(100, 150);
     * // => { start: 19, end: 30 }
     */
    static _toLayerBounds(y1, y2) {
        const start = Math.floor((Math.min(y1, y2) - 4) / 5);
        const end = Math.floor((Math.max(y1, y2) + 4) / 5);
        return { start, end };
    }

    /**
     * Updates or inserts a horizontal span for a specified layer index in the layers map.
     *
     * @param {Map<number, { minX: number, maxX: number }>} layers - The target layers map
     * @param {number} layerIdx - Discretized vertical layer index
     * @param {number} minX - Left horizontal coordinate
     * @param {number} maxX - Right horizontal coordinate
     *
     * @example
     * const layers = new Map();
     * IntervalContour._updateLayer(layers, 0, 10, 50);
     * // layers.get(0) => { minX: 10, maxX: 50 }
     *
     * @example
     * IntervalContour._updateLayer(layers, 0, 5, 60);
     * // layers.get(0) => { minX: 5, maxX: 60 }
     */
    static _updateLayer(layers, layerIdx, minX, maxX) {
        if (!layers.has(layerIdx)) {
            layers.set(layerIdx, { minX, maxX });
        } else {
            const cur = layers.get(layerIdx);
            cur.minX = Math.min(cur.minX, minX);
            cur.maxX = Math.max(cur.maxX, maxX);
        }
    }

    /**
     * Creates a deep clone of this contour with identical layer spans.
     *
     * @returns {IntervalContour} Cloned contour instance
     *
     * @example
     * const clone = contour.clone();
     *
     * @example
     * const c2 = new IntervalContour();
     * c2.addBox(10, 20, 30, 40);
     * const c3 = c2.clone();
     */
    clone() {
        const c = new IntervalContour();
        for (const [l, span] of this.layers.entries()) {
            c.layers.set(l, { minX: span.minX, maxX: span.maxX });
        }
        return c;
    }

    /**
     * Integrates a bounding box into this contour profile across its vertical layers.
     *
     * @param {number} x1 - First horizontal coordinate
     * @param {number} x2 - Second horizontal coordinate
     * @param {number} y1 - First vertical coordinate
     * @param {number} y2 - Second vertical coordinate
     *
     * @example
     * const c = new IntervalContour();
     * c.addBox(0, 90, 0, 76);
     *
     * @example
     * c.addBox(-45, 45, 100, 176);
     */
    addBox(x1, x2, y1, y2) {
        const { start, end } = IntervalContour._toLayerBounds(y1, y2);
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        for (let l = start; l <= end; l++) {
            IntervalContour._updateLayer(this.layers, l, minX, maxX);
        }
    }

    /**
     * Shifts all layer spans horizontally by dx pixels.
     *
     * @param {number} dx - Horizontal displacement
     *
     * @example
     * contour.shift(50);
     *
     * @example
     * contour.shift(-25);
     */
    shift(dx) {
        if (!dx) return;
        for (const span of this.layers.values()) {
            span.minX += dx;
            span.maxX += dx;
        }
    }

    /**
     * Merges another interval contour into this contour by expanding layer spans.
     *
     * @param {IntervalContour} other - Contour to merge into this instance
     *
     * @example
     * c1.merge(c2);
     *
     * @example
     * const c3 = new IntervalContour();
     * c3.merge(c1);
     */
    merge(other) {
        if (!other) return;
        for (const [l, oSpan] of other.layers.entries()) {
            IntervalContour._updateLayer(this.layers, l, oSpan.minX, oSpan.maxX);
        }
    }

    /**
     * Computes the minimum horizontal shift required to position another contour to the right
     * of this contour without overlapping, maintaining at least minGap clearance.
     *
     * @param {IntervalContour} other - Contour to clear to the right
     * @param {number} [minGap=24] - Minimum clearance gap in pixels
     * @returns {number} Required horizontal offset
     *
     * @example
     * const dist = c1.computeDistance(c2, 24);
     *
     * @example
     * const gap = c1.computeDistance(c2);
     */
    computeDistance(other, minGap = 24) {
        if (!other) return minGap;
        let maxD = minGap;
        for (const [l, oSpan] of other.layers.entries()) {
            if (this.layers.has(l)) {
                const tSpan = this.layers.get(l);
                const req = tSpan.maxX - oSpan.minX + minGap;
                if (req > maxD) maxD = req;
            }
        }
        return maxD;
    }
}
