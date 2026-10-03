// ============================================================================
// MODULE: BRAND ASSETS (logo, favicon, watermark)
// ============================================================================

/**
 * Brand palette for the "Family Tree" emblem: a thin olive ring around a leafy tree.
 * Kept in one place so the React logo, the favicon data URI and exported documents agree.
 */
const BRAND_COLORS = Object.freeze({
    ring: '#5c7c33',
    ringFill: '#fcfdf8',
    leafLight: '#9cc95f',
    leafDark: '#5f8b35',
    leafEdge: '#4a6a27',
});

/**
 * Limb geometry of the emblem (viewBox 0 0 64 64): [path, strokeWidth] pairs for the roots,
 * trunk, centre limb, upper/middle/lower limbs and the two twigs off the centre limb.
 */
const BRAND_LOGO_LIMBS = Object.freeze([
    ['M32 54 C29.8 54.3 27.4 55.1 25 56.6', 2.3],
    ['M32 54 C34.2 54.3 36.6 55.1 39 56.6', 2.3],
    ['M32 54.5 C31.6 49.5 31.8 45 32 40.5', 3.4],
    ['M32 41 C32.6 35 31.4 29 32 18.5', 2.7],
    ['M32 41 C31 36 27.4 33 24 28.6 C22.8 27 21.9 25.6 21.3 24', 2.5],
    ['M32 41 C33 36 36.6 33 40 28.6 C41.2 27 42.1 25.6 42.7 24', 2.5],
    ['M27.6 34.6 C24.4 34.8 20.6 34.2 17.4 32.6', 2.1],
    ['M36.4 34.6 C39.6 34.8 43.4 34.2 46.6 32.6', 2.1],
    ['M31.8 46.5 C28.6 46.8 25.4 45.6 22.8 43.2', 1.9],
    ['M32.2 46.5 C35.4 46.8 38.6 45.6 41.2 43.2', 1.9],
    ['M31.8 27.5 C30 27 28.6 26 27.6 24.6', 1.5],
    ['M32.2 27.5 C34 27 35.4 26 36.4 24.6', 1.5],
]);

/**
 * Leaf placements of the emblem: [halfLength, x, y, rotationDeg]. Each leaf is a symmetric
 * almond drawn around its own origin and then translated/rotated onto the tip of a limb.
 */
const BRAND_LOGO_LEAVES = Object.freeze([
    [5.4, 32, 13.2, 0],
    [4.8, 19.7, 19.9, -22],
    [4.8, 44.3, 19.9, 22],
    [4.5, 13.7, 30.8, -64],
    [4.5, 50.3, 30.8, 64],
    [4.1, 19.9, 40.5, -47],
    [4.1, 44.1, 40.5, 47],
    [3.3, 25.8, 22.1, -36],
    [3.3, 38.2, 22.1, 36],
]);

/**
 * Builds the almond-shaped leaf outline for a leaf of the given half-length (the control
 * points scale with the length so every leaf keeps the same proportions).
 *
 * @param {number} halfLength - Distance from the leaf centre to either tip
 * @returns {string} SVG path data centred on the origin
 *
 * @example
 * buildBrandLeafPath(5.4);
 * // => 'M0 -5.4 C3.1 -2.5 3.1 2.5 0 5.4 C-3.1 2.5 -3.1 -2.5 0 -5.4 Z'
 *
 * @example
 * buildBrandLeafPath(3.3).startsWith('M0 -3.3');
 * // => true
 */
const buildBrandLeafPath = (halfLength) => {
    const w = Math.round(halfLength * 0.575 * 10) / 10;
    const c = Math.round(halfLength * 0.46 * 10) / 10;
    return `M0 -${halfLength} C${w} -${c} ${w} ${c} 0 ${halfLength} C-${w} ${c} -${w} -${c} 0 -${halfLength} Z`;
};

/**
 * Serialises the emblem as a standalone SVG document string (for the favicon data URI and for
 * exported HTML/SVG documents). The gradient id is prefixed so several copies can share a page.
 *
 * @param {string} [idPrefix='brand'] - Prefix for the gradient id
 * @returns {string} Minified SVG markup
 *
 * @example
 * buildBrandLogoSvgMarkup().startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"');
 * // => true
 *
 * @example
 * buildBrandLogoSvgMarkup('print').includes('id="printLeafGrad"');
 * // => true
 */
const buildBrandLogoSvgMarkup = (idPrefix = 'brand') => {
    const gradId = `${idPrefix}LeafGrad`;
    const limbs = BRAND_LOGO_LIMBS.map(([d, w]) => `<path d="${d}" stroke-width="${w}"/>`).join('');
    const leaves = BRAND_LOGO_LEAVES.map(([len, x, y, rot]) =>
        `<path d="${buildBrandLeafPath(len)}" transform="translate(${x} ${y})${rot ? ` rotate(${rot})` : ''}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`
        + `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`
        + `<stop offset="0%" stop-color="${BRAND_COLORS.leafLight}"/><stop offset="100%" stop-color="${BRAND_COLORS.leafDark}"/>`
        + `</linearGradient></defs>`
        + `<circle cx="32" cy="32" r="29.6" fill="${BRAND_COLORS.ringFill}" stroke="${BRAND_COLORS.ring}" stroke-width="2.4"/>`
        + `<g fill="none" stroke="${BRAND_COLORS.ring}" stroke-linecap="round" stroke-linejoin="round">${limbs}</g>`
        + `<g fill="url(#${gradId})" stroke="${BRAND_COLORS.leafEdge}" stroke-width="0.5" stroke-linejoin="round">${leaves}</g>`
        + `</svg>`;
};

/**
 * The emblem as a `data:` URI usable in `<link rel="icon">` and `<img src>`.
 * (FamilyTreeBuilder.FAVICON_DATA_URI carries the same string as a literal because the builder
 * class is also evaluated in isolation by the test harness.)
 *
 * @example
 * BRAND_FAVICON_DATA_URI.startsWith('data:image/svg+xml,%3Csvg');
 * // => true
 *
 * @example
 * decodeURIComponent(BRAND_FAVICON_DATA_URI.slice('data:image/svg+xml,'.length)) === buildBrandLogoSvgMarkup();
 * // => true
 */
const BRAND_FAVICON_DATA_URI = 'data:image/svg+xml,' + encodeURIComponent(buildBrandLogoSvgMarkup());

/**
 * React rendering of the emblem. `idPrefix` must differ between simultaneously mounted copies so
 * their gradient ids do not collide; `title` adds an accessible label.
 *
 * @param {Object} props
 * @param {number} [props.size=44] - Rendered width/height in px
 * @param {string} [props.idPrefix='brand'] - Gradient id prefix
 * @param {string} [props.className=''] - Extra classes on the <svg>
 * @param {Object} [props.style] - Inline styles on the <svg>
 * @param {string} [props.title] - Accessible title; omitted => decorative (aria-hidden)
 * @returns {JSX.Element}
 *
 * @example
 * <BrandLogo size={160} idPrefix="splash" />
 *
 * @example
 * <BrandLogo size={28} idPrefix="home" title="Family Tree home" className="drop-shadow" />
 */
const BrandLogo = ({ size = 44, idPrefix = 'brand', className = '', style, title }) => {
    const gradId = `${idPrefix}LeafGrad`;
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size}
            className={className} style={style} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
            {title && <title>{title}</title>}
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND_COLORS.leafLight} />
                    <stop offset="100%" stopColor={BRAND_COLORS.leafDark} />
                </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="29.6" fill={BRAND_COLORS.ringFill} stroke={BRAND_COLORS.ring} strokeWidth="2.4" />
            <g fill="none" stroke={BRAND_COLORS.ring} strokeLinecap="round" strokeLinejoin="round">
                {BRAND_LOGO_LIMBS.map(([d, w]) => <path key={d} d={d} strokeWidth={w} />)}
            </g>
            <g fill={`url(#${gradId})`} stroke={BRAND_COLORS.leafEdge} strokeWidth="0.5" strokeLinejoin="round">
                {BRAND_LOGO_LEAVES.map(([len, x, y, rot]) => (
                    <path key={`${x}-${y}`} d={buildBrandLeafPath(len)} transform={`translate(${x} ${y})${rot ? ` rotate(${rot})` : ''}`} />
                ))}
            </g>
        </svg>
    );
};

/**
 * Barely visible emblem centred behind the tree canvas. Pointer-events are off so it never
 * intercepts panning, and it sits at z-0 beneath the z-10 tree layer.
 *
 * @param {Object} props
 * @param {number} [props.size=420] - Emblem size in px
 * @param {number} [props.opacity=0.05] - Opacity (the user asked for "barely visible")
 * @returns {JSX.Element}
 *
 * @example
 * <BrandWatermark />
 *
 * @example
 * <BrandWatermark size={300} opacity={0.04} />
 */
const BrandWatermark = ({ size = 420, opacity = 0.05 }) => (
    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true"
        data-testid="brand-watermark" style={{ opacity }}>
        <BrandLogo size={size} idPrefix="watermark" />
    </div>
);
