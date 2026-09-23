/**
 * @fileoverview Paginates a family tree across A4 sheets and composes printable HTML.
 *
 * The top layer of the render stack. It decides how many pages the tree needs and
 * at what scale, slices the rendered vector output into per-page tiles, builds the
 * assembly guide and chapter atlas, and emits a print-ready document. Delegates
 * all SVG generation to {@link SvgTreeRenderer}.
 */

/**
 * Composes multi-page A4 print documents from a family tree.
 *
 * Two entry points exist because printing can start from either end: build the
 * vector art here (`buildPrintableA4Html`), or paginate SVG that was already
 * captured from the live canvas (`buildPrintableA4HtmlFromSvg`).
 *
 * @example
 * const grid = A4PrintComposer.computeA4PrintGrid(tree, layoutConfig, { mode: 'compact', targetPages: 8 });
 * // => { cols: 4, rows: 2, tiles: [...], scale: 0.42 }
 *
 * @example
 * const html = A4PrintComposer.buildPrintableA4Html(tree, layoutConfig, { title: 'Chalissery' });
 * // => '<!DOCTYPE html>...' with one .a4-sheet per tile
 */
class A4PrintComposer {

    /**
     * Calculates the optimal relaxed generation row height for compact A4 print mode
     * to eliminate unused bottom whitespace on printed pages.
     *
     * @param {FamilyTree} tree - Tree domain model
     * @param {Object} layoutConfig - Layout configuration
     * @param {Object} metrics - Page pixel metrics ({ tileHeightPx, standardScale, printableHeightPx })
     * @param {number} cardPadPx - Padding around canvas nodes
     * @param {boolean} isCompact - Whether compact mode is active
     * @returns {number} Effective generation row height in pixels (defaults to 160)
     *
     * @example
     * A4PrintComposer._computeEffectiveGenerationHeight(tree, {}, { tileHeightPx: 600, standardScale: 1.2, printableHeightPx: 718 }, 15, true)
     * // => 200 (max bound for roomy 2-gen tree)
     *
     * @example
     * A4PrintComposer._computeEffectiveGenerationHeight(tree, { generationRowHeight: 110 }, { tileHeightPx: 600, standardScale: 1.2, printableHeightPx: 718 }, 15, true)
     * // => 110
     */
    static _computeEffectiveGenerationHeight(tree, layoutConfig, metrics, cardPadPx, isCompact) {
        if (layoutConfig.generationRowHeight) return layoutConfig.generationRowHeight;
        if (!isCompact) return 160;

        const maxDepth = FamilyTreeBuilder.getMaxGenerationDepth(tree, layoutConfig.rootNode);
        if (maxDepth <= 0) return 160;

        const { tileHeightPx, standardScale, printableHeightPx } = metrics;
        const availH1Row = tileHeightPx - (cardPadPx * 2) - 76;
        const genH1Row = Math.floor(availH1Row / maxDepth);
        if (genH1Row >= 110) {
            return Math.min(200, Math.max(120, genH1Row));
        }

        const tileH2Rows = (printableHeightPx * 2) / standardScale;
        const availH2Rows = tileH2Rows - (cardPadPx * 2) - 76;
        return Math.min(200, Math.max(120, Math.floor(availH2Rows / maxDepth)));
    }

    /**
     * Constructs a print tile descriptor for a single grid coordinate (r, c).
     *
     * Tile geometry and occupancy testing are delegated to {@link PrintTileBounds}, which owns
     * the canvas-padding offset and edge arithmetic.
     *
     * @param {number} r - Grid row index
     * @param {number} c - Grid column index
     * @param {Object} dims - Grid dimensions ({ tileWidthPx, tileHeightPx, padX, padY })
     * @param {Object} layoutData - Positioned nodes and connection paths
     * @param {number} pageIndex - Sequential 1-based page index
     * @returns {Object} Tile descriptor
     *
     * @example
     * A4PrintComposer._buildPrintTile(0, 0, { tileWidthPx: 800, tileHeightPx: 600, padX: 10, padY: 10 }, { nodes: [], paths: [] }, 1)
     * // => { pageIndex: 1, row: 0, col: 0, x: 0, y: 0, width: 800, height: 600, nodeCount: 0, isEmpty: true, ... }
     *
     * @example
     * A4PrintComposer._buildPrintTile(0, 1, { tileWidthPx: 800, tileHeightPx: 600, padX: 10, padY: 10 }, { nodes: [{ x: 810, y: 10 }], paths: [] }, 2)
     * // => { pageIndex: 2, row: 0, col: 1, x: 800, y: 0, ... }
     */
    static _buildPrintTile(r, c, dims, layoutData, pageIndex) {
        const bounds = PrintTileBounds.forGridCell(r, c, dims.tileWidthPx, dims.tileHeightPx, dims.padX, dims.padY);
        const { nodeCount, isEmpty } = bounds.inspectOccupancy(layoutData);

        return {
            pageIndex,
            row: r,
            col: c,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            viewBox: bounds.viewBox,
            nodeCount,
            isEmpty
        };
    }

    /**
     * Slices the laid-out tree canvas into grid-aligned A4 printable page tiles.
     *
     * Page numbers are assigned only to tiles that are actually emitted, so skipping blank
     * tiles yields a gap-free 1..N page sequence rather than one with holes.
     *
     * @param {Object} dims - Grid dimensions ({ rows, cols, tileWidthPx, tileHeightPx, padX, padY })
     * @param {Object} layoutData - Positioned nodes and connection paths
     * @param {boolean} skipEmptyPages - Whether to exclude tiles with no nodes or paths
     * @returns {Array<Object>} List of tile specifications
     *
     * @example
     * A4PrintComposer._slicePrintGridTiles({ rows: 1, cols: 1, tileWidthPx: 800, tileHeightPx: 600, padX: 15, padY: 15 }, layoutData, true)
     * // => [{ pageIndex: 1, row: 0, col: 0, x: 0, y: 0, width: 800, height: 600, ... }]
     *
     * @example
     * A4PrintComposer._slicePrintGridTiles({ rows: 2, cols: 2, tileWidthPx: 800, tileHeightPx: 600, padX: 0, padY: 0 }, { nodes: [], paths: [] }, true)
     * // => [] (empty pages skipped)
     */
    static _slicePrintGridTiles(dims, layoutData, skipEmptyPages) {
        const tiles = [];
        let pageNumber = 1;

        for (let r = 0; r < dims.rows; r++) {
            for (let c = 0; c < dims.cols; c++) {
                const tile = A4PrintComposer._buildPrintTile(r, c, dims, layoutData, pageNumber);
                if (tile.isEmpty && skipEmptyPages) {
                    continue;
                }
                pageNumber++;
                tiles.push(tile);
            }
        }

        return tiles;
    }

    /**
     * Fixed physical geometry of a printed sheet, in millimeters.
     *
     * Every printed page is A4 landscape with a uniform margin. This is the one
     * source of truth: the tile math below and the emitted `.a4-sheet` CSS both
     * derive from it, so the two can never disagree about how much of the tree
     * fits on a page. Page size is deliberately not configurable — the generated
     * stylesheet hardcodes `@page { size: A4 landscape }`, so a caller-supplied
     * page size would silently mis-scale every sheet.
     *
     * @example
     * A4PrintComposer.SHEET_MM.widthMm;
     * // => 297
     *
     * @example
     * A4PrintComposer.SHEET_MM.marginMm;
     * // => 10 (leaving a 277 x 190 mm printable area)
     */
    static SHEET_MM = Object.freeze({ widthMm: 297, heightMm: 210, marginMm: 10 });

    /**
     * How much of the final row of sheets must be covered by the tree for that row to earn
     * its paper.
     *
     * When the chosen grid is limited by width rather than height, the rows together span
     * more canvas than the tree occupies, and the leftover can be a sliver: a 10x2 grid was
     * observed spending six extra sheets on a band only 8.4% of a page tall. Below this
     * threshold the tree is re-spaced to fit one row fewer instead.
     *
     * @example
     * A4PrintComposer.TRAILING_ROW_REFLOW_RATIO;
     * // => 0.4
     *
     * @example
     * // A final row covered 8.4% by the tree is reflowed away; one covered 62.6% is kept.
     * 0.084 < A4PrintComposer.TRAILING_ROW_REFLOW_RATIO;
     * // => true
     */
    static TRAILING_ROW_REFLOW_RATIO = 0.4;

    /**
     * Tightest generation spacing, in canvas pixels, that reflowing may fall back to.
     *
     * Matches the legibility floor {@link A4PrintComposer._computeEffectiveGenerationHeight}
     * already applies: below this, rows crowd badly enough that saving a sheet is not worth it.
     *
     * @example
     * A4PrintComposer.MIN_COMPACT_GENERATION_HEIGHT;
     * // => 110
     *
     * @example
     * // A tree needing 90px rows to save a sheet is left alone.
     * 90 >= A4PrintComposer.MIN_COMPACT_GENERATION_HEIGHT;
     * // => false
     */
    static MIN_COMPACT_GENERATION_HEIGHT = 110;

    /**
     * Computes raw millimeter dimensions and printable boundary areas for paper printing.
     *
     * @returns {Object} Millimeter dimensions derived from {@link A4PrintComposer.SHEET_MM}
     *
     * @example
     * A4PrintComposer._computePageMillimeterDimensions()
     * // => { pageWidthMm: 297, pageHeightMm: 210, marginMm: 10, printableWidthMm: 277, printableHeightMm: 190 }
     *
     * @example
     * A4PrintComposer._computePageMillimeterDimensions().printableWidthMm
     * // => 277 (297 less a 10mm margin on each side)
     */
    static _computePageMillimeterDimensions() {
        const { widthMm: pageWidthMm, heightMm: pageHeightMm, marginMm } = A4PrintComposer.SHEET_MM;
        const printableWidthMm = pageWidthMm - 2 * marginMm;
        const printableHeightMm = pageHeightMm - 2 * marginMm;
        return { pageWidthMm, pageHeightMm, marginMm, printableWidthMm, printableHeightMm };
    }

    /**
     * Converts physical millimeter dimensions and font sizes into pixel measurements, scale, and tile bounds.
     *
     * @param {Object} mmDims - Millimeter dimensions including printable width and height
     * @param {number} targetFontSizePt - Target font size in points
     * @param {number} baseFontSizePx - Base font size in pixels
     * @returns {Object} Calculated pixel metrics, scale, and tile dimensions
     *
     * @example
     * A4PrintComposer._computePagePixelMetrics({ printableWidthMm: 277, printableHeightMm: 190 }, 10, 11);
     * // => { MM_TO_PX: 3.7795275590551185, printableWidthPx: 1046.9291338582676, standardScale: 1.2121212121212122, ... }
     *
     * @example
     * A4PrintComposer._computePagePixelMetrics({ printableWidthMm: 200, printableHeightMm: 100 }, 12, 12);
     * // => { standardScale: 1.3333333333333333, tileWidthPx: 566.9291338582678, ... }
     */
    static _computePagePixelMetrics(mmDims, targetFontSizePt, baseFontSizePx) {
        const MM_TO_PX = 96 / 25.4;
        const PT_TO_PX = 96 / 72;
        const printableWidthPx = mmDims.printableWidthMm * MM_TO_PX;
        const printableHeightPx = mmDims.printableHeightMm * MM_TO_PX;
        const standardScale = (targetFontSizePt * PT_TO_PX) / baseFontSizePx;
        const tileWidthPx = printableWidthPx / standardScale;
        const tileHeightPx = printableHeightPx / standardScale;
        return { MM_TO_PX, PT_TO_PX, printableWidthPx, printableHeightPx, standardScale, tileWidthPx, tileHeightPx };
    }

    /**
     * Computes physical page metrics, printable pixel areas, scale factors,
     * and tile dimensions for partitioning an SVG diagram across A4 landscape sheets.
     *
     * @param {Object} [options={}] - Print sizing configuration
     * @returns {Object} Calculated page metric properties
     *
     * @example
     * A4PrintComposer._computePageMetrics({ targetFontSizePt: 10, baseFontSizePx: 11 })
     * // => { printableWidthMm: 277, printableHeightMm: 190, standardScale: 1.212, tileWidthPx: 863.3, ... }
     *
     * @example
     * A4PrintComposer._computePageMetrics({})
     * // => { targetFontSizePt: 10, baseFontSizePx: 11, ... }
     */
    static _computePageMetrics(options = {}) {
        const targetFontSizePt = options.targetFontSizePt || 10;
        const baseFontSizePx = options.baseFontSizePx || 11;
        const mmDims = A4PrintComposer._computePageMillimeterDimensions();
        const pixelMetrics = A4PrintComposer._computePagePixelMetrics(mmDims, targetFontSizePt, baseFontSizePx);
        return {
            targetFontSizePt,
            baseFontSizePx,
            ...mmDims,
            ...pixelMetrics
        };
    }

    /**
     * Constructs a fallback empty print grid structure when no layout nodes are available.
     *
     * @param {Object} params - Sizing and configuration parameters
     * @returns {Object} Empty grid descriptor
     *
     * @example
     * A4PrintComposer._createEmptyPrintGridResult({ scale: 1, targetFontSizePt: 10, isCompact: false, options: {} })
     * // => { cols: 0, rows: 0, tiles: [], totalCanvasWidth: 0, totalCanvasHeight: 0, ... }
     *
     * @example
     * A4PrintComposer._createEmptyPrintGridResult({ scale: 1.2, targetFontSizePt: 12, isCompact: true, options: { mode: 'compact' } })
     * // => { cols: 0, rows: 0, tiles: [], mode: 'compact', ... }
     */
    static _createEmptyPrintGridResult({ scale, targetFontSizePt, printableWidthMm, printableHeightMm, tileWidthPx, tileHeightPx, effectiveGenHeight, isCompact, options }) {
        return {
            scale,
            targetFontSizePt,
            effectiveFontSizePt: targetFontSizePt,
            printableWidthMm,
            printableHeightMm,
            tileWidthPx,
            tileHeightPx,
            cols: 0,
            rows: 0,
            tiles: [],
            totalCanvasWidth: 0,
            totalCanvasHeight: 0,
            generationRowHeight: effectiveGenHeight || 160,
            mode: isCompact ? 'compact' : (options.mode || 'full')
        };
    }

    /**
     * Resolves final grid column, row, scale, and tile dimensions, applying budget optimization if requested.
     *
     * @param {{ cols: number, rows: number, scale: number, tileWidthPx: number, tileHeightPx: number }} baseGrid
     * @param {boolean} isCompact - Whether compact/auto-fit mode is enabled
     * @param {Object} options - User options
     * @param {number} printableWidthPx - Printable page width in px
     * @param {number} printableHeightPx - Printable page height in px
     * @param {number} totalCanvasWidth - Total canvas width in px
     * @param {number} totalCanvasHeight - Total canvas height in px
     * @param {number} targetPages - Max page count
     * @returns {{ cols: number, rows: number, scale: number, tileWidthPx: number, tileHeightPx: number }}
     *
     * @example
     * A4PrintComposer._resolvePrintGridDimensions(
     *     { cols: 2, rows: 2, scale: 1, tileWidthPx: 800, tileHeightPx: 600 },
     *     { isCompact: true, options: { targetPages: 2 }, printableWidthPx: 800, printableHeightPx: 600, totalCanvasWidth: 1600, totalCanvasHeight: 1200, targetPages: 2 }
     * );
     * // => { cols: 2, rows: 1, scale: ~0.8, tileWidthPx: 1000, tileHeightPx: 750 }
     *
     * @example
     * A4PrintComposer._resolvePrintGridDimensions(
     *     { cols: 1, rows: 1, scale: 1, tileWidthPx: 800, tileHeightPx: 600 },
     *     { isCompact: false, options: {}, printableWidthPx: 800, printableHeightPx: 600, totalCanvasWidth: 800, totalCanvasHeight: 600, targetPages: 10 }
     * );
     * // => { cols: 1, rows: 1, scale: 1, tileWidthPx: 800, tileHeightPx: 600 }
     */
    static _resolvePrintGridDimensions(baseGrid, { isCompact, options, printableWidthPx, printableHeightPx, totalCanvasWidth, totalCanvasHeight, targetPages }) {
        // Page-budget optimization only applies to compact/auto-fit exports; a plain export
        // prints the natural grid at its natural scale.
        if (!isCompact || (!options.targetPages && !options.autoFitPages)) {
            return baseGrid;
        }
        const spec = new PrintGridSpec(printableWidthPx, printableHeightPx, totalCanvasWidth, totalCanvasHeight, targetPages);
        return spec.fitWithinPageBudget(baseGrid);
    }

    /**
     * Calculates canvas bounding dimensions and optimizes page budget (rows, cols, scale, tile sizes).
     *
     * @param {Object} params
     * @param {Object} params.layoutData - Computed layout tree geometry
     * @param {number} params.cardPadPx - Canvas edge padding in pixels
     * @param {number} params.initialTileWidthPx - Base unscaled tile width in pixels
     * @param {number} params.initialTileHeightPx - Base unscaled tile height in pixels
     * @param {number} params.initialScale - Standard scale ratio
     * @param {boolean} params.isCompact - Whether auto-fit or compact mode is enabled
     * @param {Object} params.options - User print options
     * @param {number} params.printableWidthPx - Available printable width on paper
     * @param {number} params.printableHeightPx - Available printable height on paper
     * @param {number} params.targetPages - Target page count ceiling
     * @returns {{ padX: number, padY: number, totalCanvasWidth: number, totalCanvasHeight: number, cols: number, rows: number, scale: number, tileWidthPx: number, tileHeightPx: number }}
     *
     * @example
     * A4PrintComposer._calculatePrintGridDimensions({
     *     layoutData: { minX: 0, minY: 0, width: 1000, height: 800 },
     *     cardPadPx: 15, initialTileWidthPx: 800, initialTileHeightPx: 600,
     *     initialScale: 1, isCompact: false, options: {},
     *     printableWidthPx: 800, printableHeightPx: 600, targetPages: 10
     * });
     * // => { padX: 15, padY: 15, cols: 2, rows: 2, ... }
     *
     * @example
     * A4PrintComposer._calculatePrintGridDimensions({
     *     layoutData: { minX: 0, minY: 0, width: 400, height: 300 },
     *     cardPadPx: 15, initialTileWidthPx: 800, initialTileHeightPx: 600,
     *     initialScale: 1, isCompact: false, options: {},
     *     printableWidthPx: 800, printableHeightPx: 600, targetPages: 10
     * });
     * // => { padX: 15, padY: 15, cols: 1, rows: 1, ... }
     */
    static _calculatePrintGridDimensions({
        layoutData, cardPadPx, initialTileWidthPx, initialTileHeightPx,
        initialScale, isCompact, options, printableWidthPx, printableHeightPx, targetPages
    }) {
        const padX = cardPadPx - layoutData.minX;
        const padY = cardPadPx - layoutData.minY;
        const totalCanvasWidth = Math.max(initialTileWidthPx, layoutData.width + cardPadPx * 2);
        const totalCanvasHeight = Math.max(initialTileHeightPx, layoutData.height + cardPadPx * 2);

        const baseGrid = {
            cols: Math.max(1, Math.ceil(totalCanvasWidth / initialTileWidthPx)),
            rows: Math.max(1, Math.ceil(totalCanvasHeight / initialTileHeightPx)),
            scale: initialScale,
            tileWidthPx: initialTileWidthPx,
            tileHeightPx: initialTileHeightPx
        };

        const grid = A4PrintComposer._resolvePrintGridDimensions(baseGrid, {
            isCompact, options, printableWidthPx, printableHeightPx,
            totalCanvasWidth, totalCanvasHeight, targetPages
        });

        return { padX, padY, totalCanvasWidth, totalCanvasHeight, ...grid };
    }

    /**
     * Resolves generation row height and computes tree layout for print grid generation.
     *
     * @param {Object} tree - Tree instance.
     * @param {Object} layoutConfig - User layout configuration.
     * @param {Object} metrics - Computed page metrics.
     * @param {number} cardPadPx - Padding around cards.
     * @param {boolean} isCompact - Whether compact compression mode is active.
     * @returns {{ effectiveGenHeight: number, layoutData: Object }} Layout data and row height.
     *
     * @example
     * A4PrintComposer._resolvePrintGridLayout(tree, {}, metrics, 15, false)
     * // => { effectiveGenHeight: 220, layoutData: { nodes: [...], paths: [...] } }
     *
     * @example
     * A4PrintComposer._resolvePrintGridLayout(tree, { verticalCompression: true }, metrics, 15, true)
     * // => { effectiveGenHeight: 160, layoutData: { nodes: [...], paths: [...] } }
     */
    static _resolvePrintGridLayout(tree, layoutConfig, metrics, cardPadPx, isCompact) {
        const effectiveGenHeight = A4PrintComposer._computeEffectiveGenerationHeight(
            tree, layoutConfig, metrics, cardPadPx, isCompact
        );
        const effectiveLayoutConfig = isCompact
            ? { ...layoutConfig, verticalCompression: true, generationRowHeight: effectiveGenHeight || 160 }
            : { ...layoutConfig };
        const layoutData = FamilyTreeBuilder.computeLayout(tree, effectiveLayoutConfig);
        return { effectiveGenHeight, layoutData };
    }

    /**
     * Assembles the final printable grid result object bundle.
     *
     * @param {Object} p - Output parameters and dimensions.
     * @returns {Object} Complete print grid descriptor.
     *
     * @example
     * A4PrintComposer._assemblePrintGridResult({ scale: 1, cols: 2, rows: 2, tiles: [], layoutData: null, options: {} });
     * // => { scale: 1, cols: 2, rows: 2, tiles: [], ... }
     *
     * @example
     * A4PrintComposer._assemblePrintGridResult({ scale: 1.2, cols: 1, rows: 1, tiles: [{}], isCompact: true, options: { mode: 'compact' } });
     * // => { scale: 1.2, cols: 1, rows: 1, mode: 'compact', ... }
     */
    static _assemblePrintGridResult(p) {
        return {
            scale: p.scale,
            targetFontSizePt: p.targetFontSizePt,
            effectiveFontSizePt: p.effectiveFontSizePt,
            baseFontSizePx: p.baseFontSizePx,
            pageWidthMm: p.pageWidthMm,
            pageHeightMm: p.pageHeightMm,
            marginMm: p.marginMm,
            printableWidthMm: p.printableWidthMm,
            printableHeightMm: p.printableHeightMm,
            tileWidthPx: p.tileWidthPx,
            tileHeightPx: p.tileHeightPx,
            totalCanvasWidth: p.totalCanvasWidth,
            totalCanvasHeight: p.totalCanvasHeight,
            padX: p.padX,
            padY: p.padY,
            cols: p.cols,
            rows: p.rows,
            tiles: p.tiles,
            layoutData: p.layoutData,
            generationRowHeight: p.effectiveGenHeight || 160,
            mode: p.isCompact ? 'compact' : (p.options.mode || 'full')
        };
    }

    /**
     * Slices printable grid tiles and computes the effective target font size in points.
     *
     * @param {Object} dims - Calculated grid dimensions and scale
     * @param {number} baseFontSizePx - Base unscaled font size in pixels
     * @param {number} PT_TO_PX - Conversion ratio from points to CSS pixels
     * @param {Object} layoutData - Computed tree layout data
     * @param {boolean} skipEmptyPages - Whether to omit blank tiles
     * @returns {{ effectiveFontSizePt: number, tiles: Array<Object> }}
     *
     * @example
     * A4PrintComposer._generatePrintGridTiles(
     *     { scale: 1.2, rows: 2, cols: 2, tileWidthPx: 800, tileHeightPx: 600, padX: 15, padY: 15 },
     *     11, 1.3333333333333333, layoutData, true
     * );
     * // => { effectiveFontSizePt: 10, tiles: [...] }
     *
     * @example
     * A4PrintComposer._generatePrintGridTiles(
     *     { scale: 1.0, rows: 1, cols: 1, tileWidthPx: 500, tileHeightPx: 400, padX: 10, padY: 10 },
     *     12, 1.3333333333333333, { nodes: [], paths: [] }, true
     * );
     * // => { effectiveFontSizePt: 9, tiles: [] }
     */
    static _generatePrintGridTiles(dims, baseFontSizePx, PT_TO_PX, layoutData, skipEmptyPages) {
        const effectiveFontSizePt = Number(((dims.scale * baseFontSizePx) / PT_TO_PX).toFixed(1));
        const tiles = A4PrintComposer._slicePrintGridTiles(dims, layoutData, skipEmptyPages);
        return { effectiveFontSizePt, tiles };
    }

    /**
     * Calculates grid dimensions, generates page tiles, and assembles the print grid result for populated layouts.
     *
     * @private
     * @param {Object} params - Computation parameters
     * @param {Object} params.metrics - Page metrics and standard scale settings
     * @param {Object} params.layoutData - Computed tree layout containing positioned nodes and paths
     * @param {number} params.effectiveGenHeight - Generation tier height in pixels
     * @param {number} params.cardPadPx - Padding around canvas cards
     * @param {boolean} params.isCompact - Whether compact compression is active
     * @param {Object} params.options - User-specified print options
     * @param {boolean} params.skipEmptyPages - Whether to omit empty tiles
     * @returns {Object} Complete grid specification, page tiles, and layout metadata
     *
     * @example
     * A4PrintComposer._buildActivePrintGridResult({
     *     metrics, layoutData, effectiveGenHeight: 80, cardPadPx: 15, isCompact: false, options: {}, skipEmptyPages: true
     * });
     * // => { cols: 2, rows: 1, tiles: [...], scale: 1.0, ... }
     *
     * @example
     * A4PrintComposer._buildActivePrintGridResult({
     *     metrics, layoutData: { nodes: [{ x: 0, y: 0 }], paths: [] }, effectiveGenHeight: 60,
     *     cardPadPx: 10, isCompact: true, options: { mode: 'compact' }, skipEmptyPages: false
     * });
     * // => { cols: 1, rows: 1, tiles: [...], scale: 0.85, ... }
     */
    static _buildActivePrintGridResult({
        metrics, layoutData, effectiveGenHeight, cardPadPx, isCompact, options, skipEmptyPages
    }) {
        const dims = A4PrintComposer._calculatePrintGridDimensions({
            layoutData, cardPadPx, isCompact, options,
            initialTileWidthPx: metrics.tileWidthPx, initialTileHeightPx: metrics.tileHeightPx,
            initialScale: metrics.standardScale, printableWidthPx: metrics.printableWidthPx,
            printableHeightPx: metrics.printableHeightPx, targetPages: options.targetPages || 10
        });

        const { effectiveFontSizePt, tiles } = A4PrintComposer._generatePrintGridTiles(
            dims, metrics.baseFontSizePx, metrics.PT_TO_PX, layoutData, skipEmptyPages
        );

        return A4PrintComposer._assemblePrintGridResult({
            ...metrics, ...dims, effectiveFontSizePt, tiles, layoutData, effectiveGenHeight, isCompact, options
        });
    }

    /**
     * Computes grid slicing parameters for printing the family tree on A4 landscape paper
     * such that person names are rendered at a specified physical font size (default 10pt),
     * with optional vertical compression and target page budget auto-fitting.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} [layoutConfig={}] - Tree layout configuration
     * @param {Object} [options={}] - Print formatting options
     * @param {number} [options.targetFontSizePt=10] - Desired font size of person names on paper (points)
     * @param {number} [options.baseFontSizePx=11] - Canvas font size of person names (pixels)
     * Sheet geometry is fixed (see {@link A4PrintComposer.SHEET_MM}); only how
     * much tree fits on each sheet is tunable, via the font size options.
     *
     * @param {number} [options.cardPadPx=15] - Margin padding around canvas nodes (px)
     * @param {boolean} [options.skipEmptyPages=true] - Whether to exclude grid tiles with no nodes or paths
     * @param {string} [options.mode='full'] - Print mode: 'full' | 'compact' | 'atlas'
     * @param {number} [options.targetPages=10] - Target page budget for compact mode
     * @param {boolean} [options.verticalCompression=false] - Whether to apply vertical compression
     * @param {boolean} [options.autoFitPages=false] - Whether to auto-fit to target page budget
     * @returns {Object} Grid specifications and tile list
     *
     * @example
     * const grid = A4PrintComposer.computeA4PrintGrid(tree, {}, { mode: 'compact', targetPages: 8 });
     * // => { cols: 4, rows: 2, tiles: [...], scale: ~0.95, ... }
     *
     * @example
     * const grid = A4PrintComposer.computeA4PrintGrid(tree);
     * // => { cols: ..., rows: ..., tiles: [...], mode: 'full', ... }
     */
    static computeA4PrintGrid(tree, layoutConfig = {}, options = {}) {
        const metrics = A4PrintComposer._computePageMetrics(options);
        const cardPadPx = typeof options.cardPadPx === 'number' ? options.cardPadPx : 15;
        const skipEmptyPages = options.skipEmptyPages !== false;
        const isCompact = options.mode === 'compact' || options.autoFitPages || options.verticalCompression || layoutConfig.verticalCompression;

        const { effectiveGenHeight, layoutData } = A4PrintComposer._resolvePrintGridLayout(
            tree, layoutConfig, metrics, cardPadPx, isCompact
        );

        if (!layoutData || layoutData.nodes.length === 0) {
            return A4PrintComposer._createEmptyPrintGridResult({
                scale: metrics.standardScale, targetFontSizePt: metrics.targetFontSizePt,
                effectiveGenHeight, isCompact, options,
                printableWidthMm: metrics.printableWidthMm, printableHeightMm: metrics.printableHeightMm,
                tileWidthPx: metrics.tileWidthPx, tileHeightPx: metrics.tileHeightPx
            });
        }

        const grid = A4PrintComposer._buildActivePrintGridResult({
            metrics, layoutData, effectiveGenHeight, cardPadPx, isCompact, options, skipEmptyPages
        });
        return A4PrintComposer._reflowTrailingSheetRow(grid, {
            tree, layoutConfig, metrics, cardPadPx, isCompact, options, skipEmptyPages
        });
    }

    /**
     * Drops a final row of sheets that the tree barely reaches into, by squeezing the
     * generations a little tighter.
     *
     * The page-budget search maximises legibility, so it happily spends a whole extra row of
     * sheets on the last few pixels of the tree: a grid limited by canvas *width* spans more
     * vertical canvas than the tree needs, and the overspill lands on paper that is otherwise
     * blank. Compact mode is already free to re-space generations, so the cheaper trade is to
     * pull the tree in until it fits the rows above.
     *
     * Shrinking the canvas can only ever raise the achievable scale, so the retry never costs
     * legibility; it is accepted purely on printing fewer sheets.
     *
     * @param {Object} grid - Grid descriptor from {@link A4PrintComposer._buildActivePrintGridResult}
     * @param {Object} ctx - Everything needed to lay the tree out again
     * @returns {Object} The tightened grid, or the original when it cannot be improved
     *
     * @example
     * // 10x2 grid whose last row is only 8.4% covered -> re-spaced to 10x1, 10 sheets instead of 16.
     * A4PrintComposer._reflowTrailingSheetRow(grid, { tree, layoutConfig: {}, metrics, cardPadPx: 15, isCompact: true, options: {}, skipEmptyPages: true }).rows;
     * // => 1
     *
     * @example
     * // A last row 62.6% covered is genuine content and is left untouched.
     * A4PrintComposer._reflowTrailingSheetRow(wellPackedGrid, ctx) === wellPackedGrid;
     * // => true
     */
    static _reflowTrailingSheetRow(grid, ctx) {
        const { tree, layoutConfig, metrics, cardPadPx, isCompact, options, skipEmptyPages } = ctx;
        if (!isCompact || grid.rows < 2) return grid;

        const trailingCanvas = grid.totalCanvasHeight - (grid.rows - 1) * grid.tileHeightPx;
        if (trailingCanvas > grid.tileHeightPx * A4PrintComposer.TRAILING_ROW_REFLOW_RATIO) return grid;

        const depth = FamilyTreeBuilder.getMaxGenerationDepth(tree, layoutConfig.rootNode);
        if (depth < 2 || !grid.generationRowHeight) return grid;

        // Calibrate against the layout we just produced rather than assuming a formula:
        // everything that is not generation spacing (the bottom card, connector overhang)
        // stays fixed as the spacing changes.
        const gaps = depth - 1;
        const fixedHeight = grid.layoutData.height - gaps * grid.generationRowHeight;
        const heightBudget = (grid.rows - 1) * grid.tileHeightPx - cardPadPx * 2;
        const generationRowHeight = Math.floor((heightBudget - fixedHeight) / gaps);
        if (generationRowHeight < A4PrintComposer.MIN_COMPACT_GENERATION_HEIGHT) return grid;

        const tightened = A4PrintComposer._buildActivePrintGridResult({
            metrics, cardPadPx, isCompact, options, skipEmptyPages,
            ...A4PrintComposer._resolvePrintGridLayout(
                tree, { ...layoutConfig, generationRowHeight }, metrics, cardPadPx, isCompact
            )
        });
        return tightened.tiles.length < grid.tiles.length ? tightened : grid;
    }

    /**
     * Identifies and chronologically sorts primary branch heads under a tree root
     * for generating Atlas chapter pages.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} root - Root node of the family tree
     * @returns {Array<Object>} Sorted list of primary branch head nodes
     *
     * @example
     * A4PrintComposer._collectAtlasBranchHeads(tree, rootNode);
     * // => [Person(Thomas, b. 1905), Person(Paul, b. 1908)]
     *
     * @example
     * A4PrintComposer._collectAtlasBranchHeads(emptyTree, singleRoot);
     * // => []
     */
    static _collectAtlasBranchHeads(tree, root) {
        let branchNodes = [];
        if (typeof root.getValidDisplayChildren === 'function') {
            branchNodes = root.getValidDisplayChildren(tree);
        } else if (root.children && Array.isArray(root.children)) {
            branchNodes = root.children.map(id => tree.get(id)).filter(Boolean);
        }

        // If root is a synthetic sibling parent, the siblings themselves can be the branches
        if (branchNodes.length === 0 && FamilyTree.isSyntheticSiblingParent(root)) {
            branchNodes = (tree.all || []).filter(n => !n.isGhost && (!n.parents || n.parents.length === 0));
        }

        return branchNodes.sort((a, b) => (a.bestYob - b.bestYob) || (a.sheetRow - b.sheetRow));
    }

    /**
     * Overlays clickable SVG chapter badges ("📖 Ch. 1 (p. 2)") on branch head nodes
     * within the master overview SVG layout.
     *
     * @param {Object} overviewResult - Generated SVG result { innerSvg, layoutData, padX, padY }
     * @param {Array<Object>} branchInfoList - Metadata list of branches { index, pageIndex, node, ... }
     * @returns {string} Enriched SVG inner content with chapter badges appended
     *
     * @example
     * A4PrintComposer._injectAtlasChapterBadges(
     *     { innerSvg: '<g>...</g>', layoutData: { nodes: [{ person: { id: 'p1' }, x: 10, y: 20 }] }, padX: 15, padY: 15 },
     *     [{ index: 1, pageIndex: 2, node: { id: 'p1' } }]
     * );
     * // => '<g>...</g><g class="atlas-badges"><g class="branch-badge">...</g></g>'
     *
     * @example
     * A4PrintComposer._injectAtlasChapterBadges({ innerSvg: '<g></g>', layoutData: { nodes: [] }, padX: 0, padY: 0 }, []);
     * // => '<g></g><g class="atlas-badges"></g>'
     */
    static _injectAtlasChapterBadges(overviewResult, branchInfoList) {
        let overviewInnerSvg = overviewResult.innerSvg;
        if (!overviewResult.layoutData || !overviewResult.layoutData.nodes) {
            return overviewInnerSvg;
        }

        let badgesSvg = '<g class="atlas-badges">';
        overviewResult.layoutData.nodes.forEach(n => {
            const bInfo = branchInfoList.find(b => b.node.id === n.person.id);
            if (bInfo) {
                const nx = n.x + overviewResult.padX;
                const ny = n.y + overviewResult.padY;
                const badgeText = `📖 Ch. ${bInfo.index} (p. ${bInfo.pageIndex})`;
                const badgeW = 86;
                const badgeH = 15;
                const bx = nx + 45 - badgeW / 2;
                const by = ny + 76 - 4;
                badgesSvg += `<g class="branch-badge" cursor="pointer">`;
                badgesSvg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${badgeW}" height="${badgeH}" rx="4" ry="4" fill="#2563eb" stroke="#ffffff" stroke-width="1"/>`;
                badgesSvg += `<text x="${(bx + badgeW / 2).toFixed(1)}" y="${(by + 11).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">${badgeText}</text>`;
                badgesSvg += `</g>`;
            }
        });
        badgesSvg += '</g>';
        return overviewInnerSvg + badgesSvg;
    }

    /**
     * Constructs the master overview sheet (Sheet 1) for the Family Atlas.
     *
     * Collapses all branch heads to display only the root and top-level branch nodes,
     * and overlays chapter badges referencing each branch's dedicated sheet.
     *
     * @param {FamilyTree} tree - Populated tree instance
     * @param {Person} root - Root person node
     * @param {Object} atlasMeta - Atlas branch metadata ({ branchNodes, branchInfoList, totalAtlasSheets })
     * @param {Object} layoutConfig - Layout configuration
     * @param {Object} options - Export and rendering options
     * @returns {Object} Overview sheet descriptor
     *
     * @example
     * A4PrintComposer._buildAtlasOverviewSheet(tree, root, { branchNodes: [branchA], branchInfoList: [bInfoA], totalAtlasSheets: 2 }, {}, {});
     * // => { type: 'overview', pageIndex: 1, totalSheets: 2, title: 'Master Overview & Table of Contents', ... }
     *
     * @example
     * A4PrintComposer._buildAtlasOverviewSheet(tree, root, { branchNodes: [], branchInfoList: [], totalAtlasSheets: 1 }, { verticalCompression: true }, {});
     * // => { type: 'overview', pageIndex: 1, totalSheets: 1, branches: [], ... }
     */
    static _buildAtlasOverviewSheet(tree, root, atlasMeta, layoutConfig, options) {
        const { branchNodes, branchInfoList, totalAtlasSheets } = atlasMeta;
        const collapsedForOverview = new Set(branchNodes.map(b => b.id));
        const overviewLayoutConfig = {
            ...layoutConfig,
            collapsedNodes: collapsedForOverview,
            verticalCompression: true
        };
        const overviewResult = SvgTreeRenderer.generatePureSvgTree(tree, overviewLayoutConfig, options);

        // Inject chapter badges on the branch head nodes in the overview SVG
        const overviewInnerSvg = A4PrintComposer._injectAtlasChapterBadges(overviewResult, branchInfoList);
        const overviewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${overviewResult.width.toFixed(1)} ${overviewResult.height.toFixed(1)}" preserveAspectRatio="xMidYMid meet">${overviewInnerSvg}</svg>`;

        return {
            type: 'overview',
            pageIndex: 1,
            totalSheets: totalAtlasSheets,
            title: 'Master Overview & Table of Contents',
            subtitle: `${root.name} Lineage • ${branchInfoList.length} Major Branches`,
            svg: overviewSvg,
            innerSvg: overviewInnerSvg,
            width: overviewResult.width,
            height: overviewResult.height,
            viewBox: `0 0 ${overviewResult.width.toFixed(1)} ${overviewResult.height.toFixed(1)}`,
            branches: branchInfoList
        };
    }

    /**
     * Constructs a dedicated branch chapter sheet (Sheets 2..N+1) for the Family Atlas.
     *
     * Renders the isolated descendant subtree rooted at the branch head node.
     *
     * @param {FamilyTree} tree - Populated tree instance
     * @param {Object} bInfo - Branch metadata and chapter descriptor
     * @param {number} totalAtlasSheets - Total count of atlas sheets
     * @param {Object} layoutConfig - Layout configuration
     * @param {Object} options - Export and rendering options
     * @returns {Object} Branch chapter sheet descriptor
     *
     * @example
     * A4PrintComposer._buildAtlasBranchSheet(tree, { node: bNode, index: 1, pageIndex: 2, name: 'John', branchTitle: 'John', memberCount: 5 }, 3, {}, {});
     * // => { type: 'branch', pageIndex: 2, chapterIndex: 1, totalSheets: 3, title: 'Chapter 1: The John Branch', ... }
     *
     * @example
     * A4PrintComposer._buildAtlasBranchSheet(tree, { node: bNode2, index: 2, pageIndex: 3, name: 'Mary', branchTitle: 'Mary & Joseph', memberCount: 8 }, 3, {}, {});
     * // => { type: 'branch', pageIndex: 3, chapterIndex: 2, title: 'Chapter 2: The Mary & Joseph Branch', ... }
     */
    static _buildAtlasBranchSheet(tree, bInfo, totalAtlasSheets, layoutConfig, options) {
        const branchLayoutConfig = {
            ...layoutConfig,
            rootNode: bInfo.node,
            rootId: bInfo.node.id,
            verticalCompression: true,
            collapsedNodes: new Set()
        };
        const branchSvgResult = SvgTreeRenderer.generatePureSvgTree(tree, branchLayoutConfig, options);
        const branchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${branchSvgResult.width.toFixed(1)} ${branchSvgResult.height.toFixed(1)}" preserveAspectRatio="xMidYMid meet">${branchSvgResult.innerSvg}</svg>`;

        return {
            type: 'branch',
            pageIndex: bInfo.pageIndex,
            chapterIndex: bInfo.index,
            totalSheets: totalAtlasSheets,
            title: `Chapter ${bInfo.index}: The ${bInfo.branchTitle} Branch`,
            subtitle: `${bInfo.memberCount} Members • Descendants of ${bInfo.name}`,
            svg: branchSvg,
            innerSvg: branchSvgResult.innerSvg,
            width: branchSvgResult.width,
            height: branchSvgResult.height,
            viewBox: `0 0 ${branchSvgResult.width.toFixed(1)} ${branchSvgResult.height.toFixed(1)}`,
            node: bInfo.node,
            branchInfo: bInfo
        };
    }

    /**
     * Builds chapter metadata and title descriptor for a family tree branch head.
     *
     * @param {Object} bNode - Branch head person node.
     * @param {number} idx - 0-based index of the branch.
     * @param {FamilyTree} tree - Tree instance for partner lookups.
     * @returns {{ index: number, pageIndex: number, node: Object, name: string, branchTitle: string, memberCount: number }}
     *
     * @example
     * A4PrintComposer._buildBranchInfoDescriptor(johnNode, 0, tree);
     * // => { index: 1, pageIndex: 2, node: johnNode, name: 'John', branchTitle: 'John & Mary', memberCount: 5 }
     *
     * @example
     * A4PrintComposer._buildBranchInfoDescriptor(singleNode, 2, tree);
     * // => { index: 3, pageIndex: 4, node: singleNode, name: 'Paul', branchTitle: 'Paul', memberCount: 1 }
     */
    static _buildBranchInfoDescriptor(bNode, idx, tree) {
        const count = FamilyTreeBuilder._countFamilyBranchDescendants(bNode, tree);
        const spouseNames = (bNode.partners || []).map(pId => tree.get(pId)?.name).filter(Boolean);
        const branchTitle = spouseNames.length > 0 ? `${bNode.name} & ${spouseNames.join(' / ')}` : bNode.name;
        return {
            index: idx + 1,
            pageIndex: idx + 2, // Sheet 1 is overview, Sheet 2+ are chapters
            node: bNode,
            name: bNode.name,
            branchTitle,
            memberCount: count
        };
    }

    /**
     * Builds multi-sheet Family Atlas export data consisting of a master overview sheet
     * and dedicated chapter sheets for each primary descendant branch.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} [layoutConfig={}] - Layout configuration options
     * @param {Object} [options={}] - Atlas rendering and export options
     * @returns {Array<Object>} List of atlas sheet descriptors (overview and chapter sheets)
     *
     * @example
     * const sheets = A4PrintComposer.buildFamilyAtlasSheets(tree);
     * // => [{ type: 'overview', pageIndex: 1, ... }, { type: 'branch', pageIndex: 2, ... }]
     *
     * @example
     * const sheets = A4PrintComposer.buildFamilyAtlasSheets(null);
     * // => []
     */
    static buildFamilyAtlasSheets(tree, layoutConfig = {}, options = {}) {
        if (!tree || !tree.root) return [];
        const root = tree.root;

        // Identify primary branch heads (children of the root)
        const branchNodes = A4PrintComposer._collectAtlasBranchHeads(tree, root);
        const branchInfoList = branchNodes.map((bNode, idx) =>
            A4PrintComposer._buildBranchInfoDescriptor(bNode, idx, tree)
        );

        const totalAtlasSheets = 1 + branchInfoList.length;
        const sheets = [];

        // 1. MASTER OVERVIEW SHEET (Sheet 1)
        sheets.push(A4PrintComposer._buildAtlasOverviewSheet(
            tree, root, { branchNodes, branchInfoList, totalAtlasSheets }, layoutConfig, options
        ));

        // 2. DEDICATED BRANCH CHAPTER SHEETS (Sheets 2..N+1)
        branchInfoList.forEach(bInfo => {
            sheets.push(A4PrintComposer._buildAtlasBranchSheet(tree, bInfo, totalAtlasSheets, layoutConfig, options));
        });

        return sheets;
    }

    /**
     * Generates base CSS layout rules for screen display of A4 pages in the preview wrapper.
     *
     * @returns {string} Screen layout CSS rules.
     *
     * @example
     * A4PrintComposer._getBaseA4SheetStyles().includes('.a4-sheet')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getBaseA4SheetStyles();
     * console.log(styles.includes('.sheet-header'));
     */
    static _getBaseA4SheetStyles() {
        const mm = A4PrintComposer._computePageMillimeterDimensions();
        return `        * { box-sizing: border-box; }
        body {
            margin: 0; padding: 0; background-color: #0f172a; color: #334155;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        .sheets-wrapper { padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 28px; }
        .a4-sheet {
            width: ${mm.pageWidthMm}mm; height: ${mm.pageHeightMm}mm; background: white; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            border-radius: 4px; padding: ${mm.marginMm}mm; display: flex; flex-direction: column; justify-content: space-between;
            position: relative; overflow: hidden; page-break-after: always; break-after: page;
            page-break-inside: avoid; break-inside: avoid;
        }
        .sheet-header, .sheet-footer { display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #94a3b8; user-select: none; }
        .sheet-header { border-bottom: 1px dashed #e2e8f0; padding-bottom: 3mm; margin-bottom: 2mm; }
        .sheet-footer { border-top: 1px dashed #e2e8f0; padding-top: 3mm; margin-top: 2mm; }
        .sheet-body { flex: 1; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .sheet-body svg { width: ${mm.printableWidthMm}mm; height: ${mm.printableHeightMm}mm; max-width: 100%; max-height: 100%; display: block; background: #ffffff; }`;
    }

    /**
     * Generates @page and @media print CSS rules for clean physical A4 page printing.
     *
     * @returns {string} Print media CSS rules.
     *
     * @example
     * A4PrintComposer._getBaseA4MediaPrintStyles().includes('@media print')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getBaseA4MediaPrintStyles();
     * console.log(styles.includes('size: A4 landscape'));
     */
    static _getBaseA4MediaPrintStyles() {
        const mm = A4PrintComposer._computePageMillimeterDimensions();
        return `        @page { size: A4 landscape; margin: 0; }
        @media print {
            html, body { background: white !important; color: black !important; }
            .no-print { display: none !important; }
            .sheets-wrapper { padding: 0 !important; gap: 0 !important; display: block !important; }
            .a4-sheet {
                width: ${mm.pageWidthMm}mm !important; height: ${mm.pageHeightMm}mm !important; box-shadow: none !important; border-radius: 0 !important;
                padding: ${mm.marginMm}mm !important; margin: 0 !important; page-break-after: always !important; break-after: page !important;
                -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            }
            .sheet-body svg { width: ${mm.printableWidthMm}mm !important; height: ${mm.printableHeightMm}mm !important; }
        }`;
    }

    /**
     * Generates base CSS styles for A4 landscape paper sheets, headers, footers, and print media rules.
     *
     * @returns {string} Base print stylesheet
     *
     * @example
     * A4PrintComposer._getBaseA4PrintStyles().includes('size: A4 landscape');
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getBaseA4PrintStyles();
     * console.log(styles.includes('.a4-sheet'));
     */
    static _getBaseA4PrintStyles() {
        return `${A4PrintComposer._getBaseA4SheetStyles()}\n${A4PrintComposer._getBaseA4MediaPrintStyles()}`;
    }

    /**
     * Generates CSS layout rules for the sticky print preview toolbar and left metadata.
     *
     * @returns {string} Toolbar container CSS rules.
     *
     * @example
     * A4PrintComposer._getToolbarA4ContainerStyles().includes('.print-toolbar')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getToolbarA4ContainerStyles();
     * console.log(styles.includes('.toolbar-title'));
     */
    static _getToolbarA4ContainerStyles() {
        return `        .print-toolbar {
            position: sticky; top: 0; z-index: 1000; background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
            color: #f8fafc; box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        }
        .toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .toolbar-title { margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; }
        .toolbar-badge {
            background: rgba(255, 255, 255, 0.12); color: #cbd5e1; font-size: 11px;
            font-weight: 600; padding: 3px 8px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.08);
        }`;
    }

    /**
     * Generates CSS styles for the primary print action button.
     *
     * @returns {string} Button CSS rules.
     *
     * @example
     * A4PrintComposer._getToolbarA4ButtonStyles().includes('.print-btn')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getToolbarA4ButtonStyles();
     * console.log(styles.includes('linear-gradient'));
     */
    static _getToolbarA4ButtonStyles() {
        return `        .print-btn {
            background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none;
            padding: 9px 18px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
            transition: all 0.2s ease;
        }
        .print-btn:hover {
            background: linear-gradient(135deg, #1d4ed8, #1e40af); transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5);
        }`;
    }

    /**
     * Combines container, layout, and button styling for the A4 print preview toolbar.
     *
     * @returns {string} Toolbar CSS stylesheet
     *
     * @example
     * A4PrintComposer._getToolbarA4PrintStyles().includes('.print-toolbar');
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getToolbarA4PrintStyles();
     * console.log(styles.includes('.print-btn'));
     */
    static _getToolbarA4PrintStyles() {
        return `${A4PrintComposer._getToolbarA4ContainerStyles()}\n${A4PrintComposer._getToolbarA4ButtonStyles()}`;
    }

    /**
     * Generates CSS styles for the multi-page poster assembly guide container and header instructions.
     *
     * @returns {string} Guide container CSS rules.
     *
     * @example
     * A4PrintComposer._getAssemblyGuideHeaderStyles().includes('.assembly-guide')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getAssemblyGuideHeaderStyles();
     * console.log(styles.includes('.guide-header'));
     */
    static _getAssemblyGuideHeaderStyles() {
        return `        .assembly-guide {
            max-width: 297mm; margin: 20px auto 0 auto; background: rgba(30, 41, 59, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 20px; color: #cbd5e1;
        }
        .guide-header { font-size: 12px; line-height: 1.5; margin-bottom: 12px; }
        .guide-header strong { color: #38bdf8; margin-right: 6px; }
        .grid-overview { display: flex; justify-content: center; }`;
    }

    /**
     * Generates CSS styles for the assembly matrix grid table and page indicator cells.
     *
     * @returns {string} Matrix grid cell CSS rules.
     *
     * @example
     * A4PrintComposer._getAssemblyGuideGridStyles().includes('.grid-table')
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getAssemblyGuideGridStyles();
     * console.log(styles.includes('.grid-cell'));
     */
    static _getAssemblyGuideGridStyles() {
        return `        .grid-table {
            display: grid; gap: 6px; background: rgba(15, 23, 42, 0.6); padding: 8px;
            border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .grid-cell {
            padding: 8px 12px; font-size: 11px; text-align: center; border-radius: 6px;
            text-decoration: none; line-height: 1.3;
        }
        .grid-cell.active { background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; font-weight: 600; }
        .grid-cell.active:hover { background: #2563eb; color: white; }
        .grid-cell.empty { background: rgba(51, 65, 85, 0.3); color: #64748b; border: 1px dashed rgba(255, 255, 255, 0.1); }`;
    }

    /**
     * Combines instructions header and matrix table styling for the poster assembly guide.
     *
     * @returns {string} Assembly guide CSS stylesheet
     *
     * @example
     * A4PrintComposer._getAssemblyGuideA4PrintStyles().includes('.assembly-guide');
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getAssemblyGuideA4PrintStyles();
     * console.log(styles.includes('.grid-table'));
     */
    static _getAssemblyGuideA4PrintStyles() {
        return `${A4PrintComposer._getAssemblyGuideHeaderStyles()}\n${A4PrintComposer._getAssemblyGuideGridStyles()}`;
    }

    /**
     * Generates CSS styles for printable A4 landscape pages and toolbar controls.
     *
     * @returns {string} CSS stylesheet
     *
     * @example
     * A4PrintComposer._getA4PrintStyles().includes('size: A4 landscape');
     * // => true
     *
     * @example
     * const styles = A4PrintComposer._getA4PrintStyles();
     * console.log(styles.includes('.print-toolbar'));
     */
    static _getA4PrintStyles() {
        return `
        ${A4PrintComposer._getBaseA4PrintStyles()}
        ${A4PrintComposer._getToolbarA4PrintStyles()}
        ${A4PrintComposer._getAssemblyGuideA4PrintStyles()}`;
    }

    /**
     * Renders HTML sections for each A4 landscape sheet in Compact Poster mode.
     *
     * @param {Object} compactGrid - Grid specification with tiles, printable dimensions, etc.
     * @param {string} innerSvg - Inner SVG content string
     * @param {string} title - Lineage or document title
     * @returns {string} Concatenated HTML sheets
     *
     * @example
     * A4PrintComposer._renderCompactA4Sheets(grid, '<g></g>', 'Smith');
     * // => '<section class="a4-sheet" ...>...</section>'
     *
     * @example
     * A4PrintComposer._renderCompactA4Sheets({ tiles: [], printableWidthMm: 277, printableHeightMm: 190, rows: 0, cols: 0 }, '', '');
     * // => ''
     */
    static _renderCompactA4Sheets(compactGrid, innerSvg, title) {
        const compactTotalPages = compactGrid.tiles.length;
        const escapedTitle = SvgTreeRenderer._escapeSvgXml(title);
        return compactGrid.tiles.map(tile => `
        <section class="a4-sheet" data-sheet-type="compact" id="page-${tile.pageIndex}" data-page="${tile.pageIndex}" data-row="${tile.row + 1}" data-col="${tile.col + 1}">
            <header class="sheet-header no-print">
                <span class="sheet-title"><strong>${escapedTitle}</strong> — Sheet ${tile.pageIndex} of ${compactTotalPages}</span>
                <span class="sheet-coords">Grid: Row ${tile.row + 1} of ${compactGrid.rows}, Column ${tile.col + 1} of ${compactGrid.cols}</span>
            </header>
            <div class="sheet-body">
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="${compactGrid.printableWidthMm}mm" 
                    height="${compactGrid.printableHeightMm}mm" 
                    viewBox="${tile.viewBox}"
                    preserveAspectRatio="xMidYMid meet"
                >
                    ${innerSvg}
                </svg>
            </div>
            <footer class="sheet-footer">
                <span class="sheet-meta">${escapedTitle} • Sheet ${tile.pageIndex} of ${compactTotalPages} • Row ${tile.row + 1}, Col ${tile.col + 1}</span>
                <span class="sheet-scale">Compact Poster (${compactGrid.cols}×${compactGrid.rows} Grid) • 10pt names on A4 Landscape</span>
            </footer>
        </section>`).join('\n');
    }

    /**
     * Renders a single cell inside the print grid overview table.
     *
     * @param {Object|null} matchTile - Matching grid tile or undefined
     * @param {number} r - Zero-indexed row number
     * @param {number} c - Zero-indexed column number
     * @returns {string} Cell HTML markup
     *
     * @example
     * A4PrintComposer._renderGridOverviewCell({ pageIndex: 1 }, 0, 0);
     * // => '<a href="#page-1" ...'
     *
     * @example
     * A4PrintComposer._renderGridOverviewCell(null, 0, 1);
     * // => '<div class="grid-cell empty" ...'
     */
    static _renderGridOverviewCell(matchTile, r, c) {
        if (matchTile) {
            return `<a href="#page-${matchTile.pageIndex}" class="grid-cell active" title="Page ${matchTile.pageIndex} (Row ${r+1}, Col ${c+1})">Page ${matchTile.pageIndex}<br><small>R${r+1} C${c+1}</small></a>`;
        }
        return `<div class="grid-cell empty" title="Empty (Row ${r+1}, Col ${c+1})"><em>Empty</em><br><small>R${r+1} C${c+1}</small></div>`;
    }

    /**
     * Renders the complete HTML grid overview table for compact poster assembly.
     *
     * @param {Object} compactGrid - Grid layout configuration and tiles
     * @returns {string} Grid table HTML string
     *
     * @example
     * A4PrintComposer._renderGridOverviewTable({ rows: 1, cols: 1, tiles: [{ pageIndex: 1, row: 0, col: 0 }] });
     *
     * @example
     * A4PrintComposer._renderGridOverviewTable({ rows: 0, cols: 0, tiles: [] });
     */
    static _renderGridOverviewTable(compactGrid) {
        if (!compactGrid || compactGrid.rows <= 0 || compactGrid.cols <= 0) return '';
        let cells = '';
        for (let r = 0; r < compactGrid.rows; r++) {
            for (let c = 0; c < compactGrid.cols; c++) {
                const matchTile = compactGrid.tiles.find(t => t.row === r && t.col === c);
                cells += A4PrintComposer._renderGridOverviewCell(matchTile, r, c);
            }
        }
        return `<div class="grid-overview"><div class="grid-table" style="grid-template-columns: repeat(${compactGrid.cols}, 1fr);">${cells}</div></div>`;
    }

    /**
     * Renders an HTML overview map showing the layout grid of A4 sheets for print assembly.
     *
     * @param {Object} compactGrid - Grid layout configuration and tiles
     * @returns {string} Assembly guide HTML string
     *
     * @example
     * A4PrintComposer._renderCompactAssemblyGuide({ rows: 1, cols: 1, tiles: [{ pageIndex: 1, row: 0, col: 0 }] });
     * // => '<div class="guide-compact">...<a href="#page-1" ...>Page 1...</a>...</div>'
     *
     * @example
     * A4PrintComposer._renderCompactAssemblyGuide({ rows: 0, cols: 0, tiles: [] });
     * // => '<div class="guide-compact">...</div>'
     */
    static _renderCompactAssemblyGuide(compactGrid) {
        const compactGridMapHtml = A4PrintComposer._renderGridOverviewTable(compactGrid);
        return `
        <div class="guide-compact">
            <div class="guide-header">
                <strong>📐 Compact Poster (${compactGrid.cols}×${compactGrid.rows} Grid, ${compactGrid.tiles.length} Pages):</strong>
                <span>Tree vertically compressed by generation depth with relaxed spacing to fill page height without bottom whitespace. Fits in <strong>${compactGrid.cols}×${compactGrid.rows} Grid (${compactGrid.tiles.length} Pages)</strong>. Names calibrated at ~${compactGrid.effectiveFontSizePt}pt.</span>
            </div>
            ${compactGridMapHtml}
        </div>`;
    }

    /**
     * Renders the top toolbar markup for the printable A4 HTML view.
     *
     * @param {string} escTitle - XML/HTML escaped document title
     * @param {string} badgesHtml - Formatted badge HTML elements
     * @returns {string} Toolbar HTML markup
     *
     * @example
     * A4PrintComposer._renderA4PrintToolbar('Smith Lineage', '<span class="toolbar-badge">Page 1</span>');
     * // => '    <div class="print-toolbar no-print">...'
     *
     * @example
     * A4PrintComposer._renderA4PrintToolbar('Tree', '');
     * // => '    <div class="print-toolbar no-print">...'
     */
    static _renderA4PrintToolbar(escTitle, badgesHtml) {
        return `    <div class="print-toolbar no-print">
        <div class="toolbar-left">
            <h1 class="toolbar-title">${escTitle}</h1>
            ${badgesHtml}
        </div>
        <div class="toolbar-right">
            <button class="print-btn" onclick="window.print()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>
                <span>Print / Save to PDF</span>
            </button>
        </div>
    </div>`;
    }

    /**
     * Builds the standard HTML5 shell and toolbar for printable A4 documents.
     *
     * @param {Object} p - Document configuration parameters.
     * @param {string} [p.title] - Document title.
     * @param {string} [p.escapedTitle] - Pre-escaped document title.
     * @param {Array<string>} [p.badges=[]] - Toolbar badge labels.
     * @param {string} [p.bodyHtml=''] - HTML content to inject in document body.
     * @returns {string} Full HTML document string.
     *
     * @example
     * A4PrintComposer._buildA4DocumentHtml({ title: 'Tree', badges: ['Page 1'], bodyHtml: '<main></main>' });
     * // => '<!DOCTYPE html>...'
     *
     * @example
     * A4PrintComposer._buildA4DocumentHtml({ escapedTitle: 'Custom &amp; Title' });
     * // => '<!DOCTYPE html>...<title>Custom &amp; Title — A4 Landscape Print View</title>...'
     */
    static _buildA4DocumentHtml({ title, escapedTitle, badges = [], bodyHtml = '' }) {
        const escTitle = escapedTitle || SvgTreeRenderer._escapeSvgXml(title || 'Family Tree');
        const badgesHtml = badges.map(b => `<span class="toolbar-badge">${b}</span>`).join('\n            ');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escTitle} — A4 Landscape Print View</title>
    <link rel="icon" type="image/svg+xml" href="${FamilyTreeBuilder.FAVICON_DATA_URI}">
    <style>
        ${A4PrintComposer._getA4PrintStyles()}
    </style>
</head>
<body>
${A4PrintComposer._renderA4PrintToolbar(escTitle, badgesHtml)}
${bodyHtml}
</body>
</html>`;
    }

    /**
     * Renders printable A4 assembly guide and sheet wrapper body HTML markup.
     *
     * @param {Object} compactGrid - Grid layout specification
     * @param {string} innerSvg - Inner SVG markup for family tree
     * @param {string} title - Lineage or document title
     * @returns {string} Body HTML container string
     *
     * @example
     * const body = A4PrintComposer._renderPrintableA4Body({ tiles: [], cols: 1, rows: 1 }, '<g></g>', 'Title');
     * // body.includes('<main class="sheets-wrapper">') => true
     *
     * @example
     * const body = A4PrintComposer._renderPrintableA4Body({ tiles: [], cols: 1, rows: 1 }, '', 'Tree');
     * // body.includes('assembly-guide') => true
     */
    static _renderPrintableA4Body(compactGrid, innerSvg, title) {
        const compactPagesHtml = A4PrintComposer._renderCompactA4Sheets(compactGrid, innerSvg, title);
        const compactGuideHtml = A4PrintComposer._renderCompactAssemblyGuide(compactGrid);
        return `    <div class="assembly-guide no-print">\n        ${compactGuideHtml}\n    </div>\n\n    <main class="sheets-wrapper">\n        ${compactPagesHtml}\n    </main>`;
    }

    /**
     * Builds a standalone, print-ready HTML document splitting the tree canvas into a series
     * of SVG images formatted for A4 landscape paper in Compact Poster mode (<= 10 pages).
     * Applies relaxed vertical compression to eliminate bottom whitespace.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} [layoutConfig={}] - Tree layout options
     * @param {Object} [options={}] - Formatting options
     * @returns {string} Complete HTML document content
     *
     * @example
     * const html = A4PrintComposer.buildPrintableA4Html(tree);
     * // => '<!DOCTYPE html>...'
     *
     * @example
     * const html = A4PrintComposer.buildPrintableA4Html(tree, {}, { title: 'Smith Lineage', targetPages: 6 });
     * // => '<!DOCTYPE html>...Smith Lineage...'
     */
    static buildPrintableA4Html(tree, layoutConfig = {}, options = {}) {
        const title = options.title || (tree?.root?.name ? `${tree.root.name} Family Tree` : 'Family Tree');
        const escapedTitle = SvgTreeRenderer._escapeSvgXml(title);

        const compactGrid = A4PrintComposer.computeA4PrintGrid(tree, layoutConfig, {
            ...options,
            mode: 'compact',
            targetPages: options.targetPages || 10,
            autoFitPages: true
        });
        const effectiveLayoutConfig = {
            ...layoutConfig,
            verticalCompression: true,
            generationRowHeight: compactGrid.generationRowHeight || layoutConfig.generationRowHeight || 160
        };
        const compactSvgResult = SvgTreeRenderer.generatePureSvgTree(tree, effectiveLayoutConfig, options);

        return A4PrintComposer._buildA4DocumentHtml({
            escapedTitle,
            badges: [`${compactGrid.tiles.length} Pages (${compactGrid.cols}×${compactGrid.rows} Grid)`],
            bodyHtml: A4PrintComposer._renderPrintableA4Body(compactGrid, compactSvgResult.innerSvg, title)
        });
    }

    /**
     * Generates an array of page tiles spanning a 2D SVG canvas.
     *
     * @param {number} vbX - Origin X.
     * @param {number} vbY - Origin Y.
     * @param {number} cols - Number of columns.
     * @param {number} rows - Number of rows.
     * @param {number} tileWidthPx - Tile width in user units.
     * @param {number} tileHeightPx - Tile height in user units.
     * @returns {Array<{ pageIndex: number, row: number, col: number, viewBox: string }>}
     *
     * @example
     * A4PrintComposer._generateSvgGridTiles(0, 0, 1, 1, 500, 400);
     * // => [{ pageIndex: 1, row: 0, col: 0, viewBox: "0.0 0.0 500.0 400.0" }]
     *
     * @example
     * A4PrintComposer._generateSvgGridTiles(10, 20, 2, 1, 300, 200);
     * // => [{ pageIndex: 1, row: 0, col: 0, ... }, { pageIndex: 2, row: 0, col: 1, ... }]
     */
    static _generateSvgGridTiles(vbX, vbY, cols, rows, tileWidthPx, tileHeightPx) {
        const tiles = [];
        let pageNumber = 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tx = vbX + c * tileWidthPx;
                const ty = vbY + r * tileHeightPx;
                tiles.push({
                    pageIndex: pageNumber++,
                    row: r,
                    col: c,
                    viewBox: `${tx.toFixed(1)} ${ty.toFixed(1)} ${tileWidthPx.toFixed(1)} ${tileHeightPx.toFixed(1)}`
                });
            }
        }
        return tiles;
    }

    /**
     * Parses viewBox/dimensions from a raw SVG string and slices it into a grid of page tiles.
     *
     * @param {string} rawSvg - Raw SVG string
     * @param {number} tileWidthPx - Tile width in SVG user units
     * @param {number} tileHeightPx - Tile height in SVG user units
     * @returns {{ cols: number, rows: number, tiles: Array<{ pageIndex: number, row: number, col: number, viewBox: string }> }}
     *
     * @example
     * A4PrintComposer._sliceRawSvgTiles('<svg viewBox="0 0 1000 800">...</svg>', 500, 400);
     * // => { cols: 2, rows: 2, tiles: [...] }
     *
     * @example
     * A4PrintComposer._sliceRawSvgTiles('<svg width="300" height="200">...</svg>', 500, 400);
     * // => { cols: 1, rows: 1, tiles: [...] }
     */
    static _sliceRawSvgTiles(rawSvg, tileWidthPx, tileHeightPx) {
        const { vbX, vbY, vbW, vbH } = SvgTreeRenderer._parseSvgDimensions(rawSvg);
        const cols = Math.max(1, Math.ceil(vbW / tileWidthPx));
        const rows = Math.max(1, Math.ceil(vbH / tileHeightPx));
        const tiles = A4PrintComposer._generateSvgGridTiles(vbX, vbY, cols, rows, tileWidthPx, tileHeightPx);
        return { cols, rows, tiles };
    }

    /**
     * Renders A4 printable sheet sections for raw SVG tiles.
     *
     * @param {Array<Object>} tiles - Sliced tile objects
     * @param {string} innerContent - Inner SVG XML contents without root <svg> tags
     * @param {string} title - Document title
     * @param {Object} sheetSpec - Sheet dimensions and grid counts ({ printableWidthMm, printableHeightMm, rows, cols })
     * @returns {string} Concatenated HTML sections
     *
     * @example
     * A4PrintComposer._renderRawSvgA4Sheets([{ pageIndex: 1, row: 0, col: 0, viewBox: '0 0 100 100' }], '<rect/>', 'Atlas', { printableWidthMm: 277, printableHeightMm: 190, rows: 1, cols: 1 });
     * // => '<section class="a4-sheet" id="page-1" ...>...</section>'
     *
     * @example
     * A4PrintComposer._renderRawSvgA4Sheets([], '', 'Empty', { printableWidthMm: 277, printableHeightMm: 190, rows: 0, cols: 0 });
     * // => ''
     */
    static _renderRawSvgA4Sheets(tiles, innerContent, title, sheetSpec) {
        const { printableWidthMm, printableHeightMm, rows, cols } = sheetSpec;
        const totalPages = tiles.length;
        return tiles.map(tile => `
        <section class="a4-sheet" id="page-${tile.pageIndex}" data-page="${tile.pageIndex}">
            <header class="sheet-header no-print">
                <span class="sheet-title"><strong>${title}</strong> — Sheet ${tile.pageIndex} of ${totalPages}</span>
                <span class="sheet-coords">Grid: Row ${tile.row + 1} of ${rows}, Column ${tile.col + 1} of ${cols}</span>
            </header>
            <div class="sheet-body">
                <svg xmlns="http://www.w3.org/2000/svg" width="${printableWidthMm}mm" height="${printableHeightMm}mm" viewBox="${tile.viewBox}" preserveAspectRatio="xMidYMid meet">
                    ${innerContent}
                </svg>
            </div>
            <footer class="sheet-footer">
                <span class="sheet-meta">${title} • Sheet [${tile.row + 1}, ${tile.col + 1}] • Page ${tile.pageIndex} of ${totalPages}</span>
                <span class="sheet-scale">Calibrated for 10pt names on A4 Landscape (297×210mm)</span>
            </footer>
        </section>`).join('\n');
    }

    /**
     * Builds printable A4 landscape pages from a pre-captured raw SVG string.
     *
     * @param {string} rawSvg - Master SVG content
     * @param {Object} [options={}] - Formatting options
     * @returns {string} Complete HTML document content
     *
     * @example
     * const html = A4PrintComposer.buildPrintableA4HtmlFromSvg('<svg viewBox="0 0 800 600"><circle/></svg>');
     * // => '<!DOCTYPE html>...'
     *
     * @example
     * const html = A4PrintComposer.buildPrintableA4HtmlFromSvg('', {});
     * // => ''
     */
    static buildPrintableA4HtmlFromSvg(rawSvg, options = {}) {
        if (!rawSvg) return '';
        const metrics = A4PrintComposer._computePageMetrics(options);
        const { printableWidthMm, printableHeightMm, tileWidthPx, tileHeightPx } = metrics;
        const title = options.title || 'Family Tree';

        const { cols, rows, tiles } = A4PrintComposer._sliceRawSvgTiles(rawSvg, tileWidthPx, tileHeightPx);
        const innerContent = rawSvg.replace(/<svg[^>]*>/i, '').replace(/<\/svg\s*>$/i, '');
        const pagesHtml = A4PrintComposer._renderRawSvgA4Sheets(
            tiles, innerContent, title, { printableWidthMm, printableHeightMm, rows, cols }
        );
        const totalPages = tiles.length;

        return A4PrintComposer._buildA4DocumentHtml({
            title,
            badges: [
                'A4 Landscape',
                '10pt Names',
                `${totalPages} ${totalPages === 1 ? 'Page' : 'Pages'}`
            ],
            bodyHtml: `    <main class="sheets-wrapper">
        ${pagesHtml}
    </main>`
        });
    }
}
