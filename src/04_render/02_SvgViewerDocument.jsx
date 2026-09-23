/**
 * @fileoverview Wraps raw SVG markup in a self-contained, interactive HTML page.
 *
 * The exported file has no network dependencies: pan/zoom handlers, gesture
 * support, keyboard shortcuts, and toolbar styling are all inlined, so a shared
 * export keeps working offline. Independent of the rest of the render stack — it
 * takes SVG markup as input and never builds it.
 */

/**
 * Builds a standalone HTML viewer document around a raw SVG image.
 *
 * Also normalizes the `data:` URLs produced by canvas export so callers can hand
 * over whatever the browser gave them.
 *
 * @example
 * const html = SvgViewerDocument.buildInlineSvgHtml('<svg>...</svg>', 'Family Tree');
 * // => '<!DOCTYPE html>...' with inlined pan/zoom script
 *
 * @example
 * SvgViewerDocument.extractRawSvgFromDataUrl('data:image/svg+xml;utf8,<svg></svg>');
 * // => '<svg></svg>'
 */
class SvgViewerDocument {

    /**
     * Extracts raw SVG XML content from a data URL (URL-encoded or base64).
     *
     * @param {string} dataUrl - Data URL containing SVG content
     * @returns {string} Raw <svg>...</svg> string
     *
     * @example
     * SvgViewerDocument.extractRawSvgFromDataUrl('data:image/svg+xml;utf8,<svg></svg>')
     * // => '<svg></svg>'
     *
     * @example
     * SvgViewerDocument.extractRawSvgFromDataUrl('')
     * // => ''
     */
    static extractRawSvgFromDataUrl(dataUrl) {
        if (!dataUrl) return '';
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx === -1) return dataUrl;
        const header = dataUrl.substring(0, commaIdx);
        const content = dataUrl.substring(commaIdx + 1);
        if (header.includes('base64')) {
            try {
                return decodeURIComponent(escape(atob(content)));
            } catch (e) {
                return atob(content);
            }
        }
        try {
            return decodeURIComponent(content);
        } catch (e) {
            return unescape(content);
        }
    }

    /**
     * Generates CSS styles for the SVG canvas and viewport container.
     *
     * @returns {string} Viewport and canvas CSS rules.
     *
     * @example
     * SvgViewerDocument._getInlineSvgViewportStyles().includes('#tree-viewport')
     * // => true
     *
     * @example
     * const styles = SvgViewerDocument._getInlineSvgViewportStyles();
     * console.log(styles.includes('#tree-canvas'));
     */
    static _getInlineSvgViewportStyles() {
        return `body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
        svg { max-width: 100%; height: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1); background: white; }
        html, body {
            width: 100%; height: 100%; overflow: hidden; background: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #tree-viewport {
            width: 100vw; height: 100vh; overflow: auto; display: block;
            cursor: grab; position: relative; scrollbar-width: thin;
        }
        #tree-viewport:active { cursor: grabbing; }
        #tree-canvas { display: inline-block; transform-origin: 0 0; padding: 40px; box-sizing: border-box; }
        #tree-canvas svg {
            max-width: none !important; height: auto !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            border-radius: 8px; background: #ffffff; display: block;
        }`;
    }

    /**
     * Generates CSS styles for the floating pan/zoom control toolbar.
     *
     * @returns {string} Toolbar CSS rules.
     *
     * @example
     * SvgViewerDocument._getInlineSvgToolbarStyles().includes('.zoom-toolbar')
     * // => true
     *
     * @example
     * const styles = SvgViewerDocument._getInlineSvgToolbarStyles();
     * console.log(styles.includes('.zoom-btn'));
     */
    static _getInlineSvgToolbarStyles() {
        return `.zoom-toolbar {
            position: fixed; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 6px;
            background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(8px);
            border: 1px solid rgba(226, 232, 240, 0.9); box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
            border-radius: 9999px; padding: 4px 8px; z-index: 9999; user-select: none;
        }
        .zoom-btn {
            background: transparent; border: none; cursor: pointer; padding: 6px 10px; font-size: 14px;
            font-weight: 600; color: #334155; border-radius: 9999px; display: flex; align-items: center;
            justify-content: center; transition: all 0.15s ease;
        }
        .zoom-btn:hover { background: #f1f5f9; color: #0f172a; }
        .zoom-level { font-size: 12px; font-weight: 600; color: #64748b; min-width: 44px; text-align: center; }`;
    }

    /**
     * Generates combined CSS styles for the inline SVG viewer wrapper.
     *
     * @returns {string} CSS styles for SVG viewport, canvas, and zoom controls.
     *
     * @example
     * SvgViewerDocument._getInlineSvgStyles().includes('#tree-viewport')
     * // => true
     *
     * @example
     * SvgViewerDocument._getInlineSvgStyles().includes('.zoom-toolbar')
     * // => true
     */
    static _getInlineSvgStyles() {
        return `${SvgViewerDocument._getInlineSvgViewportStyles()}\n${SvgViewerDocument._getInlineSvgToolbarStyles()}`;
    }

    /**
     * Generates HTML markup for the floating zoom toolbar in the inline SVG viewer.
     *
     * @returns {string} Toolbar HTML markup string.
     *
     * @example
     * SvgViewerDocument._getInlineSvgToolbarHtml().includes('zoom-toolbar')
     * // => true
     *
     * @example
     * SvgViewerDocument._getInlineSvgToolbarHtml().includes('btn-fit')
     * // => true
     */
    static _getInlineSvgToolbarHtml() {
        return `<div class="zoom-toolbar">
        <button class="zoom-btn" id="btn-out" title="Zoom Out ( - )">−</button>
        <span class="zoom-level" id="zoom-text">100%</span>
        <button class="zoom-btn" id="btn-in" title="Zoom In ( + )">+</button>
        <div style="width: 1px; height: 16px; background: #cbd5e1; margin: 0 2px;"></div>
        <button class="zoom-btn" id="btn-fit" title="Fit to Window ( 0 )">Fit</button>
        <button class="zoom-btn" id="btn-actual" title="Actual Size ( 1 )">100%</button>
    </div>`;
    }

    /**
     * Generates JavaScript zoom and window fitting helper functions for inline SVG viewer.
     *
     * @returns {string} JS script fragment for zoom and fit logic.
     *
     * @example
     * SvgViewerDocument._getInlineSvgZoomFunctions().includes('function updateZoom')
     * // => true
     *
     * @example
     * const fns = SvgViewerDocument._getInlineSvgZoomFunctions();
     * console.log(fns.includes('fitToWindow'));
     */
    static _getInlineSvgZoomFunctions() {
        return `            function updateZoom(newScale, focalX, focalY) {
                newScale = Math.min(maxScale, Math.max(minScale, newScale));
                if (Math.abs(newScale - scale) < 0.001) return;
                const prevScale = scale;
                scale = newScale;
                if (canvas) canvas.style.transform = "scale(" + scale + ")";
                if (zoomText) zoomText.textContent = Math.round(scale * 100) + "%";
                if (focalX !== undefined && focalY !== undefined && viewport) {
                    const ratio = scale / prevScale;
                    viewport.scrollLeft = (viewport.scrollLeft + focalX) * ratio - focalX;
                    viewport.scrollTop = (viewport.scrollTop + focalY) * ratio - focalY;
                }
            }
            function fitToWindow() {
                if (!svg || !viewport) return;
                const naturalW = svg.getAttribute("width") ? parseFloat(svg.getAttribute("width")) : (svg.viewBox?.baseVal?.width || 1200);
                const naturalH = svg.getAttribute("height") ? parseFloat(svg.getAttribute("height")) : (svg.viewBox?.baseVal?.height || 800);
                const availW = viewport.clientWidth - 80;
                const availH = viewport.clientHeight - 80;
                if (naturalW <= 0 || naturalH <= 0 || availW <= 0 || availH <= 0) return;
                const scaleW = availW / naturalW;
                const scaleH = availH / naturalH;
                const targetScale = Math.min(1.0, Math.max(minScale, Math.min(scaleW, scaleH)));
                updateZoom(targetScale);
                viewport.scrollLeft = Math.max(0, (canvas.scrollWidth * targetScale - viewport.clientWidth) / 2);
                viewport.scrollTop = 0;
            }`;
    }

    /**
     * Generates JavaScript event listeners for zoom toolbar buttons and keyboard shortcuts.
     *
     * @returns {string} Script fragment binding zoom buttons and keys.
     *
     * @example
     * const script = SvgViewerDocument._getInlineSvgZoomShortcuts();
     * console.log(script.includes('btnIn'));
     *
     * @example
     * SvgViewerDocument._getInlineSvgZoomShortcuts().includes('keydown');
     * // => true
     */
    static _getInlineSvgZoomShortcuts() {
        return `            if (btnIn) btnIn.addEventListener("click", () => updateZoom(scale * 1.25));
            if (btnOut) btnOut.addEventListener("click", () => updateZoom(scale * 0.8));
            if (btnActual) btnActual.addEventListener("click", () => updateZoom(1.0));
            if (btnFit) btnFit.addEventListener("click", fitToWindow);
            window.addEventListener("keydown", (e) => {
                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
                if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); updateZoom(scale * 1.2); }
                else if ((e.key === "-" || e.key === "_") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); updateZoom(scale * 0.8); }
                else if (e.key === "0" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); fitToWindow(); }
                else if (e.key === "1" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); updateZoom(1.0); }
            });`;
    }

    /**
     * Generates event listener bindings for dragging, wheel zoom, and keyboard shortcuts.
     *
     * @returns {string} JS script fragment for gesture and event handlers.
     *
     * @example
     * SvgViewerDocument._getInlineSvgGestureHandlers().includes('viewport.addEventListener')
     * // => true
     *
     * @example
     * const handlers = SvgViewerDocument._getInlineSvgGestureHandlers();
     * console.log(handlers.includes('keydown'));
     */
    static _getInlineSvgGestureHandlers() {
        return `            let isDragging = false;
            let startX = 0, startY = 0;
            let initialScrollLeft = 0, initialScrollTop = 0;
            if (viewport) {
                viewport.addEventListener("mousedown", (e) => {
                    if (e.target.closest(".zoom-toolbar")) return;
                    isDragging = true; startX = e.clientX; startY = e.clientY;
                    initialScrollLeft = viewport.scrollLeft; initialScrollTop = viewport.scrollTop;
                });
                window.addEventListener("mousemove", (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    viewport.scrollLeft = initialScrollLeft - (e.clientX - startX);
                    viewport.scrollTop = initialScrollTop - (e.clientY - startY);
                });
                window.addEventListener("mouseup", () => { isDragging = false; });
                viewport.addEventListener("wheel", (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const rect = viewport.getBoundingClientRect();
                        const factor = e.deltaY < 0 ? 1.1 : 0.9;
                        updateZoom(scale * factor, e.clientX - rect.left, e.clientY - rect.top);
                    }
                }, { passive: false });
            }
${SvgViewerDocument._getInlineSvgZoomShortcuts()}`;
    }

    /**
     * Generates the client-side JavaScript that enables smooth pan, zoom, wheel pinch, and keyboard navigation.
     *
     * @returns {string} Self-invoking JavaScript code wrapped in a <script> tag.
     *
     * @example
     * SvgViewerDocument._getInlineSvgPanZoomScript().includes('<script>')
     * // => true
     *
     * @example
     * SvgViewerDocument._getInlineSvgPanZoomScript().includes('updateZoom')
     * // => true
     */
    static _getInlineSvgPanZoomScript() {
        return `<script>
        (function() {
            const viewport = document.getElementById("tree-viewport");
            const canvas = document.getElementById("tree-canvas");
            const zoomText = document.getElementById("zoom-text");
            const btnIn = document.getElementById("btn-in");
            const btnOut = document.getElementById("btn-out");
            const btnFit = document.getElementById("btn-fit");
            const btnActual = document.getElementById("btn-actual");
            const svg = canvas ? canvas.querySelector("svg") : null;
            let scale = 1.0;
            const minScale = 0.1;
            const maxScale = 5.0;
${SvgViewerDocument._getInlineSvgZoomFunctions()}
${SvgViewerDocument._getInlineSvgGestureHandlers()}
            if (document.readyState === "loading") {
                window.addEventListener("DOMContentLoaded", fitToWindow);
            } else {
                setTimeout(fitToWindow, 50);
            }
        })();
    </script>`;
    }

    /**
     * Generates a self-contained HTML document with inline SVG wrapper.
     *
     * @param {string} rawSvg - Raw SVG code
     * @param {string} [title='Family Tree'] - Page title
     * @returns {string} HTML document content
     *
     * @example
     * SvgViewerDocument.buildInlineSvgHtml('<svg></svg>', 'My Tree')
     * // => '<!DOCTYPE html><html>...'
     *
     * @example
     * SvgViewerDocument.buildInlineSvgHtml('<svg viewBox="0 0 100 100"></svg>')
     * // => HTML document with default title 'Family Tree'
     */
    static buildInlineSvgHtml(rawSvg, title = 'Family Tree') {
        return `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/svg+xml" href="${FamilyTreeBuilder.FAVICON_DATA_URI}">
    <style>
        ${SvgViewerDocument._getInlineSvgStyles()}
    </style>
</head>
<body>

    <div id="tree-viewport">
        <div id="tree-canvas">
            <!-- YOUR WEB APP INJECTS THE RAW <svg>...</svg> CODE HERE -->
            ${rawSvg}
        </div>
    </div>

    ${SvgViewerDocument._getInlineSvgToolbarHtml()}

    ${SvgViewerDocument._getInlineSvgPanZoomScript()}
</body>
</html>
`;
    }
}
