/**
 * Geometry value objects for paginated (A4) printing of the family tree canvas.
 *
 * Printing slices one large tree canvas into a grid of page-sized tiles. Two
 * distinct concerns were previously expressed as long positional argument lists
 * threaded through half a dozen `FamilyTreeBuilder` statics:
 *
 *   1. "How many pages, and at what zoom?"  -> PrintGridSpec
 *   2. "Which content falls on THIS page?"  -> PrintTileBounds
 *
 * Modelling them as small immutable value objects keeps the tile arithmetic
 * (right/bottom edges, canvas padding offsets, viewBox strings) in one place
 * instead of recomputing it at every call site.
 */

/**
 * Immutable rectangle describing a single printable page tile in canvas coordinates.
 *
 * Layout nodes and connector paths are stored in unpadded canvas space, while the
 * rendered canvas is shifted by (padX, padY). This object owns that offset so callers
 * never have to remember to apply it.
 *
 * @example
 * const tile = new PrintTileBounds(0, 0, 800, 600, 15, 15);
 * tile.right;
 * // => 800
 *
 * @example
 * const secondColumn = PrintTileBounds.forGridCell(0, 1, 800, 600, 15, 15);
 * secondColumn.x;
 * // => 800
 */
class PrintTileBounds {
    /** Default rendered width of a person card, in canvas pixels. */
    static DEFAULT_NODE_WIDTH_PX = 90;

    /** Default rendered height of a person card, in canvas pixels. */
    static DEFAULT_NODE_HEIGHT_PX = 76;

    /**
     * Slack (in canvas pixels) added around a tile when testing connector paths, so a
     * line that merely crosses the page is still drawn rather than clipped away.
     */
    static DEFAULT_PATH_MARGIN_PX = 20;

    /**
     * @param {number} x - Tile left edge in canvas coordinates
     * @param {number} y - Tile top edge in canvas coordinates
     * @param {number} width - Tile width in canvas coordinates
     * @param {number} height - Tile height in canvas coordinates
     * @param {number} padX - Horizontal canvas padding applied to node/path coordinates
     * @param {number} padY - Vertical canvas padding applied to node/path coordinates
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).bottom;
     * // => 100
     *
     * @example
     * new PrintTileBounds(800, 600, 800, 600, 10, 10).right;
     * // => 1600
     */
    constructor(x, y, width, height, padX, padY) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.padX = padX;
        this.padY = padY;
        Object.freeze(this);
    }

    /**
     * Builds the tile covering grid cell (row, col) of a uniform tile grid.
     *
     * @param {number} row - Zero-based grid row index
     * @param {number} col - Zero-based grid column index
     * @param {number} tileWidthPx - Uniform tile width in canvas coordinates
     * @param {number} tileHeightPx - Uniform tile height in canvas coordinates
     * @param {number} padX - Horizontal canvas padding
     * @param {number} padY - Vertical canvas padding
     * @returns {PrintTileBounds} Bounds of the requested grid cell
     *
     * @example
     * PrintTileBounds.forGridCell(0, 0, 800, 600, 15, 15).x;
     * // => 0
     *
     * @example
     * PrintTileBounds.forGridCell(1, 2, 800, 600, 15, 15).y;
     * // => 600
     */
    static forGridCell(row, col, tileWidthPx, tileHeightPx, padX, padY) {
        return new PrintTileBounds(col * tileWidthPx, row * tileHeightPx, tileWidthPx, tileHeightPx, padX, padY);
    }

    /**
     * Right edge of the tile in canvas coordinates.
     *
     * @returns {number} x + width
     *
     * @example
     * new PrintTileBounds(0, 0, 800, 600, 0, 0).right;
     * // => 800
     *
     * @example
     * new PrintTileBounds(800, 0, 800, 600, 0, 0).right;
     * // => 1600
     */
    get right() {
        return this.x + this.width;
    }

    /**
     * Bottom edge of the tile in canvas coordinates.
     *
     * @returns {number} y + height
     *
     * @example
     * new PrintTileBounds(0, 0, 800, 600, 0, 0).bottom;
     * // => 600
     *
     * @example
     * new PrintTileBounds(0, 600, 800, 600, 0, 0).bottom;
     * // => 1200
     */
    get bottom() {
        return this.y + this.height;
    }

    /**
     * SVG `viewBox` attribute string for rendering just this tile, rounded to 1 decimal.
     *
     * @returns {string} "x y width height"
     *
     * @example
     * new PrintTileBounds(0, 0, 800, 600, 0, 0).viewBox;
     * // => '0.0 0.0 800.0 600.0'
     *
     * @example
     * new PrintTileBounds(800, 600, 800, 600, 0, 0).viewBox;
     * // => '800.0 600.0 800.0 600.0'
     */
    get viewBox() {
        return `${this.x.toFixed(1)} ${this.y.toFixed(1)} ${this.width.toFixed(1)} ${this.height.toFixed(1)}`;
    }

    /**
     * Tests whether a person card overlaps this tile (axis-aligned rectangle intersection).
     *
     * The node's stored coordinates are unpadded, so the canvas padding is applied here.
     *
     * @param {Object} node - Layout node exposing `x` and `y` in unpadded canvas coordinates
     * @param {number} [nodeWidth=90] - Card width in canvas pixels
     * @param {number} [nodeHeight=76] - Card height in canvas pixels
     * @returns {boolean} True when any part of the card falls inside the tile
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).containsNode({ x: 50, y: 50 });
     * // => true
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).containsNode({ x: 200, y: 200 });
     * // => false
     */
    containsNode(node, nodeWidth = PrintTileBounds.DEFAULT_NODE_WIDTH_PX, nodeHeight = PrintTileBounds.DEFAULT_NODE_HEIGHT_PX) {
        const nx = node.x + this.padX;
        const ny = node.y + this.padY;
        return nx + nodeWidth > this.x && nx < this.right && ny + nodeHeight > this.y && ny < this.bottom;
    }

    /**
     * Tests whether an SVG connector path has any control point inside this tile (plus margin).
     *
     * Coordinates are recovered by scanning the path's `d` string for numbers and reading them
     * as (x, y) pairs, e.g. "M 50 50 L 80 80" -> [[50, 50], [80, 80]].
     *
     * @param {Object} path - Connector path exposing an SVG path string `d`
     * @param {number} [margin=20] - Slack around the tile so crossing segments are retained
     * @returns {boolean} True when any point falls within the expanded tile
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).intersectsPath({ d: 'M 50 50 L 80 80' });
     * // => true
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).intersectsPath({ d: 'M 200 200 L 250 250' });
     * // => false
     */
    intersectsPath(path, margin = PrintTileBounds.DEFAULT_PATH_MARGIN_PX) {
        const nums = (path.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (nums.length < 2) return false;
        for (let i = 0; i < nums.length; i += 2) {
            const px = nums[i] + this.padX;
            const py = nums[i + 1] + this.padY;
            if (px >= this.x - margin && px <= this.right + margin &&
                py >= this.y - margin && py <= this.bottom + margin) {
                return true;
            }
        }
        return false;
    }

    /**
     * Counts the cards on this tile and reports whether the page would print blank.
     *
     * A tile is only "empty" when it holds no cards AND no connector passes through it;
     * a page showing just a long lineage connector is still worth printing.
     *
     * @param {Object} layoutData - Layout exposing `nodes` and `paths` arrays
     * @returns {{ nodeCount: number, isEmpty: boolean }} Occupancy summary
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).inspectOccupancy({ nodes: [], paths: [] });
     * // => { nodeCount: 0, isEmpty: true }
     *
     * @example
     * new PrintTileBounds(0, 0, 100, 100, 0, 0).inspectOccupancy({ nodes: [{ x: 10, y: 10 }], paths: [] });
     * // => { nodeCount: 1, isEmpty: false }
     */
    inspectOccupancy(layoutData) {
        const nodeCount = layoutData.nodes.filter(n => this.containsNode(n)).length;
        const hasPath = layoutData.paths.some(p => this.intersectsPath(p));
        return { nodeCount, isEmpty: nodeCount === 0 && !hasPath };
    }
}

/**
 * Immutable description of the printing problem: how big one printable page is, how big the
 * whole canvas is, and how many pages we are allowed to spend.
 *
 * Owns the search for the (cols x rows) split that keeps text as large as possible while
 * staying within the page budget.
 *
 * @example
 * const spec = new PrintGridSpec(1046, 718, 3000, 2000, 10);
 * spec.maxPages;
 * // => 10
 *
 * @example
 * new PrintGridSpec(1000, 700, 500, 350, 1).findOptimalGrid({ cols: 1, rows: 1, scale: 1 });
 * // => { bestC: 1, bestR: 1, bestScale: 2 }
 */
class PrintGridSpec {
    /**
     * Weight applied to aspect-ratio drift when ranking candidate grids. Deliberately tiny:
     * legibility (scale) dominates, and this only breaks ties between equally legible grids
     * in favour of the one whose shape best matches the canvas.
     */
    static ASPECT_RATIO_PENALTY = 0.0001;

    /**
     * @param {number} printableWidthPx - Printable page width in pixels (page minus margins)
     * @param {number} printableHeightPx - Printable page height in pixels
     * @param {number} totalCanvasWidth - Full tree canvas width in pixels
     * @param {number} totalCanvasHeight - Full tree canvas height in pixels
     * @param {number} maxPages - Maximum number of pages the grid may occupy
     *
     * @example
     * new PrintGridSpec(1046, 718, 3000, 2000, 10).totalCanvasWidth;
     * // => 3000
     *
     * @example
     * new PrintGridSpec(1000, 700, 1500, 1000, 8).maxPages;
     * // => 8
     */
    constructor(printableWidthPx, printableHeightPx, totalCanvasWidth, totalCanvasHeight, maxPages) {
        this.printableWidthPx = printableWidthPx;
        this.printableHeightPx = printableHeightPx;
        this.totalCanvasWidth = totalCanvasWidth;
        this.totalCanvasHeight = totalCanvasHeight;
        this.maxPages = maxPages;
        Object.freeze(this);
    }

    /**
     * Scores one candidate grid shape.
     *
     * `candidateScale` is the zoom at which a canvas slice still fits on a page: bigger is more
     * legible. The score then subtracts a negligible penalty for grids whose overall shape
     * distorts the canvas aspect ratio, measured as |log(candidateRatio / canvasRatio)| so that
     * being 2x too wide and 2x too tall are penalised equally.
     *
     * @param {number} cols - Candidate column count
     * @param {number} rows - Candidate row count
     * @returns {{ candidateScale: number, score: number }} Legibility scale and ranking score
     *
     * @example
     * new PrintGridSpec(1000, 700, 3000, 2000, 10).evaluateCandidate(2, 3).candidateScale;
     * // => 0.6666666666666666
     *
     * @example
     * new PrintGridSpec(1000, 700, 500, 350, 1).evaluateCandidate(1, 1).score;
     * // => 2
     */
    evaluateCandidate(cols, rows) {
        const scaleToFitWidth = this.printableWidthPx / (this.totalCanvasWidth / cols);
        const scaleToFitHeight = this.printableHeightPx / (this.totalCanvasHeight / rows);
        const candidateScale = Math.min(scaleToFitWidth, scaleToFitHeight);

        const candidateRatio = (cols * this.printableWidthPx) / (rows * this.printableHeightPx);
        const canvasRatio = this.totalCanvasWidth / this.totalCanvasHeight;
        const ratioDiff = Math.abs(Math.log(candidateRatio / canvasRatio));

        return { candidateScale, score: candidateScale - (ratioDiff * PrintGridSpec.ASPECT_RATIO_PENALTY) };
    }

    /**
     * Exhaustively searches every (cols x rows) grid within the page budget and returns the
     * highest-scoring one, falling back to `defaultCandidate` if nothing scores.
     *
     * @param {{ cols: number, rows: number, scale: number }} defaultCandidate - Fallback grid
     * @returns {{ bestC: number, bestR: number, bestScale: number }} Winning grid shape and zoom
     *
     * @example
     * new PrintGridSpec(1000, 700, 500, 350, 1).findOptimalGrid({ cols: 1, rows: 1, scale: 1 });
     * // => { bestC: 1, bestR: 1, bestScale: 2 }
     *
     * @example
     * new PrintGridSpec(1046, 718, 3000, 2000, 10).findOptimalGrid({ cols: 3, rows: 4, scale: 1.2 }).bestC;
     * // => 5
     */
    findOptimalGrid(defaultCandidate) {
        let bestScore = -1;
        let bestC = defaultCandidate.cols;
        let bestR = defaultCandidate.rows;
        let bestScale = defaultCandidate.scale;

        for (let c = 1; c <= this.maxPages; c++) {
            for (let r = 1; r <= this.maxPages; r++) {
                if (c * r > this.maxPages) continue;
                const { candidateScale, score } = this.evaluateCandidate(c, r);
                if (score > bestScore) {
                    bestScore = score;
                    bestC = c;
                    bestR = r;
                    bestScale = candidateScale;
                }
            }
        }
        return { bestC, bestR, bestScale };
    }

    /**
     * Returns the grid to actually print: keeps the caller's grid when it already fits the page
     * budget, otherwise re-solves for the most legible grid that does.
     *
     * @param {{ cols: number, rows: number, scale: number }} candidate - Unconstrained grid
     * @returns {{ cols: number, rows: number, scale: number, tileWidthPx: number, tileHeightPx: number }} Final grid
     *
     * @example
     * new PrintGridSpec(1000, 700, 1500, 1000, 8).fitWithinPageBudget({ cols: 2, rows: 2, scale: 1 }).cols;
     * // => 2
     *
     * @example
     * new PrintGridSpec(1046, 718, 3000, 2000, 10).fitWithinPageBudget({ cols: 3, rows: 4, scale: 1.2 }).cols;
     * // => 5
     */
    fitWithinPageBudget(candidate) {
        const { cols, rows, scale } = candidate;
        if (cols * rows <= this.maxPages) return this.#withTileSize(cols, rows, scale);

        const { bestC, bestR, bestScale } = this.findOptimalGrid(candidate);
        return this.#withTileSize(bestC, bestR, bestScale);
    }

    /**
     * Expands a grid shape into a full descriptor by deriving the canvas-space tile size.
     *
     * A page is a fixed number of pixels, so zooming in by `scale` means each page covers
     * proportionally *less* canvas — hence the division.
     *
     * @param {number} cols - Column count
     * @param {number} rows - Row count
     * @param {number} scale - Zoom factor
     * @returns {{ cols: number, rows: number, scale: number, tileWidthPx: number, tileHeightPx: number }} Descriptor
     */
    #withTileSize(cols, rows, scale) {
        return {
            cols,
            rows,
            scale,
            tileWidthPx: this.printableWidthPx / scale,
            tileHeightPx: this.printableHeightPx / scale
        };
    }
}
