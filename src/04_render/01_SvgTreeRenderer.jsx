/**
 * @fileoverview Renders a laid-out FamilyTree into standalone SVG markup.
 *
 * This is the lowest layer of the render stack: it owns XML escaping, person-card
 * geometry and typography, connector and timeline groups, and the assembly of a
 * complete <svg> document. It knows nothing about paper sizes or pagination —
 * {@link A4PrintComposer} sits on top of it for that.
 */

/**
 * Renders family tree layouts as pure SVG markup.
 *
 * Consumes the same layout data the on-screen canvas uses (via
 * `FamilyTreeBuilder.computeLayout`) so the exported vector output stays visually
 * faithful to the interactive view.
 *
 * @example
 * const { svg, width, height } = SvgTreeRenderer.generatePureSvgTree(tree, layoutConfig, {});
 * // => svg: '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
 *
 * @example
 * SvgTreeRenderer._escapeSvgXml('Tom & Jerry');
 * // => 'Tom &amp; Jerry'
 */
class SvgTreeRenderer {

    /**
     * Escapes XML/SVG special characters in text strings.
     *
     * @param {string|*} str - Input string to escape
     * @returns {string} Escaped XML string
     *
     * @example
     * SvgTreeRenderer._escapeSvgXml('Tom & Jerry <cartoon> "2024"');
     * // => 'Tom &amp; Jerry &lt;cartoon&gt; &quot;2024&quot;'
     *
     * @example
     * SvgTreeRenderer._escapeSvgXml(null);
     * // => ''
     */
    static _escapeSvgXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Wraps card text into up to 3 lines formatted for compact SVG display.
     *
     * @param {string} text - Input name or title
     * @param {number} [maxChars=13] - Maximum characters per line before line break
     * @returns {string[]} Array of up to 3 lines
     *
     * @example
     * SvgTreeRenderer._wrapSvgCardText('Grandfather Alexander The Great');
     * // => ['Grandfather', 'Alexander', 'The Great']
     *
     * @example
     * SvgTreeRenderer._wrapSvgCardText('Short Name');
     * // => ['Short Name']
     */
    static _wrapSvgCardText(text, maxChars = 13) {
        if (!text) return [];
        const words = String(text).trim().split(/\s+/);
        const lines = [];
        let cur = '';
        for (const w of words) {
            if (!cur) cur = w;
            else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
            else { lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        const out = [];
        for (const l of lines) {
            if (l.length > 15) {
                out.push(l.slice(0, 13) + '-');
                out.push(l.slice(13));
            } else {
                out.push(l);
            }
        }
        return out.slice(0, 3);
    }

    /**
     * Renders background timeline grid lines and year labels for SVG trees.
     *
     * @param {FamilyTree} tree - Populated tree instance
     * @param {Object} layoutConfig - Layout configuration
     * @param {number} padY - Vertical padding offset
     * @param {number} totalW - Canvas total width
     * @param {number} totalH - Canvas total height
     * @returns {string} SVG snippet of timeline grid lines and year markers
     *
     * @example
     * SvgTreeRenderer._renderSvgTimelineGrid(tree, { ppy: 1.5 }, 20, 1000, 800);
     * // => '<line x1="0" y1="24.0" .../><text x="6" ...>1900</text>...'
     *
     * @example
     * SvgTreeRenderer._renderSvgTimelineGrid(null, {}, 0, 100, 100);
     * // => ''
     */
    static _renderSvgTimelineGrid(tree, layoutConfig, padY, totalW, totalH) {
        if (!tree || typeof tree.getStats !== 'function') return '';
        const stats = tree.getStats();
        const rootYob = stats.rootNodeYob || 1900;
        const maxYear = stats.maxYear || new Date().getFullYear();
        const ppy = layoutConfig?.ppy || 1.5;
        const step = (maxYear - rootYob > 80) ? 20 : 10;
        const startYear = Math.floor(rootYob / step) * step;

        let timelineSvg = '';
        for (let y = startYear; y <= maxYear; y += step) {
            const lineY = ((y - rootYob) * ppy + 24) + padY;
            if (lineY >= 0 && lineY <= totalH) {
                timelineSvg += `<line x1="0" y1="${lineY.toFixed(1)}" x2="${totalW.toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4"/>`;
                timelineSvg += `<text x="6" y="${(lineY - 4).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="bold" fill="#cbd5e1" opacity="0.8">${y}</text>`;
            }
        }
        return timelineSvg;
    }

    /**
     * Resolves SVG color theme palette according to person gender.
     *
     * @param {'M'|'F'|string} [gender] - Gender character
     * @returns {{ bg: string, border: string, text: string, dateBg: string, dateText: string, jobText: string }}
     *
     * @example
     * SvgTreeRenderer._getSvgCardTheme('M');
     * // => { bg: '#e0f2fe', border: '#7dd3fc', text: '#082f49', dateBg: '#bae6fd', dateText: '#0c4a6e', jobText: '#0369a1' }
     *
     * @example
     * SvgTreeRenderer._getSvgCardTheme('F');
     * // => { bg: '#ffe4e6', border: '#fda4af', text: '#4c0519', dateBg: '#fecdd3', dateText: '#881337', jobText: '#be123c' }
     */
    static _getSvgCardTheme(gender) {
        if (gender === 'M') {
            return { bg: '#e0f2fe', border: '#7dd3fc', text: '#082f49', dateBg: '#bae6fd', dateText: '#0c4a6e', jobText: '#0369a1' };
        }
        if (gender === 'F') {
            return { bg: '#ffe4e6', border: '#fda4af', text: '#4c0519', dateBg: '#fecdd3', dateText: '#881337', jobText: '#be123c' };
        }
        return { bg: '#f1f5f9', border: '#cbd5e1', text: '#0f172a', dateBg: '#e2e8f0', dateText: '#334155', jobText: '#475569' };
    }

    /**
     * Renders the date badge element for an SVG person card.
     *
     * @param {Object} cardInfo - Date info object with cardText and isDeduced
     * @param {string} dateBg - Badge background color
     * @param {string} dateText - Badge text color
     * @param {number} currentY - Current vertical cursor position
     * @returns {{ svg: string, nextY: number }} Rendered SVG string and updated Y position
     *
     * @example
     * SvgTreeRenderer._renderSvgCardDateBadge({ cardText: 'b. 1950', isDeduced: false }, '#e2e8f0', '#334155', 38);
     * // => { svg: '<rect .../><text ...>b. 1950</text>', nextY: 53 }
     *
     * @example
     * SvgTreeRenderer._renderSvgCardDateBadge(null, '#e2e8f0', '#334155', 38);
     * // => { svg: '', nextY: 38 }
     */
    static _renderSvgCardDateBadge(cardInfo, dateBg, dateText, currentY) {
        const cardText = cardInfo?.cardText;
        if (!cardText || currentY >= 58) return { svg: '', nextY: currentY };
        const badgeW = Math.min(82, Math.max(36, cardText.length * 5.8 + 8));
        const badgeX = 45 - badgeW / 2;
        let svg = `<rect x="${badgeX.toFixed(1)}" y="${currentY.toFixed(1)}" width="${badgeW.toFixed(1)}" height="13" rx="3" ry="3" fill="${dateBg}" stroke="rgba(0,0,0,0.06)" stroke-width="0.5"/>`;
        svg += `<text x="45" y="${(currentY + 9.5).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" fill="${dateText}" text-anchor="middle"${cardInfo.isDeduced ? ' font-style="italic"' : ''}>${SvgTreeRenderer._escapeSvgXml(cardText)}</text>`;
        return { svg, nextY: currentY + 15 };
    }

    /**
     * Renders job or nickname subtitle text for an SVG person card.
     *
     * @param {Person} p - Person instance
     * @param {number} currentY - Current vertical cursor position
     * @param {string} jobText - Text fill color for jobs
     * @param {string} defaultText - Text fill color for nicknames
     * @returns {string} Rendered subtitle SVG string
     *
     * @example
     * SvgTreeRenderer._renderSvgCardSubtitle({ job: 'Doctor' }, 53, '#475569', '#0f172a');
     * // => '<text ...>Doctor</text>'
     *
     * @example
     * SvgTreeRenderer._renderSvgCardSubtitle({ nick: 'Bobby' }, 53, '#475569', '#0f172a');
     * // => '<text ...>"Bobby"</text>'
     */
    static _renderSvgCardSubtitle(p, currentY, jobText, defaultText) {
        if (currentY >= 70) return '';
        if (p.job) {
            const jobStr = p.job.length > 14 ? p.job.slice(0, 13) + '…' : p.job;
            return `<text x="45" y="${(currentY + 4).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="500" fill="${jobText}" text-anchor="middle">${SvgTreeRenderer._escapeSvgXml(jobStr)}</text>`;
        }
        if (p.nick) {
            const nickStr = p.nick.length > 14 ? p.nick.slice(0, 13) + '…' : p.nick;
            return `<text x="45" y="${(currentY + 4).toFixed(1)}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-style="italic" fill="${defaultText}" opacity="0.75" text-anchor="middle">&quot;${SvgTreeRenderer._escapeSvgXml(nickStr)}&quot;</text>`;
        }
        return '';
    }

    /**
     * Formats an SVG text element with tspans for multi-line person names on cards.
     *
     * @private
     * @param {string[]} nameLines - Wrapped lines of person name
     * @param {number} startNameY - Starting baseline Y coordinate
     * @param {string} text - Fill text color hex code
     * @returns {string} SVG text element markup
     *
     * @example
     * SvgTreeRenderer._renderSvgCardNameText(['Alice', 'Smith'], 18, '#1e293b');
     * // => '<text x="45" y="18" ...><tspan x="45" dy="0">Alice</tspan><tspan x="45" dy="13">Smith</tspan></text>'
     *
     * @example
     * SvgTreeRenderer._renderSvgCardNameText(['Bob'], 24, '#0f172a');
     * // => '<text x="45" y="24" ...><tspan x="45" dy="0">Bob</tspan></text>'
     */
    static _renderSvgCardNameText(nameLines, startNameY, text) {
        const tspans = nameLines.map((line, idx) =>
            `<tspan x="45" dy="${idx === 0 ? 0 : 13}">${SvgTreeRenderer._escapeSvgXml(line)}</tspan>`
        ).join('');
        return `<text x="45" y="${startNameY}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="${text}" text-anchor="middle">${tspans}</text>`;
    }

    /**
     * Renders an individual person node card as SVG elements.
     *
     * @param {Person} p - Person instance
     * @param {number} nx - Absolute X coordinate
     * @param {number} ny - Absolute Y coordinate
     * @returns {string} SVG snippet representing the person card
     *
     * @example
     * SvgTreeRenderer._renderSvgPersonCard(person, 100, 200);
     * // => '<g class="person-node" transform="translate(100.0, 200.0)"><rect width="90" .../>...</g>'
     *
     * @example
     * SvgTreeRenderer._renderSvgPersonCard(null, 0, 0);
     * // => ''
     */
    static _renderSvgPersonCard(p, nx, ny) {
        if (!p) return '';
        const isGhost = !!p.isGhost;
        const { bg, border, text, dateBg, dateText, jobText } = SvgTreeRenderer._getSvgCardTheme(p.gender);

        const strokeDash = isGhost ? 'stroke-dasharray="4,4" opacity="0.85"' : '';
        const nameLines = SvgTreeRenderer._wrapSvgCardText(p.name || 'Unknown');
        const startNameY = nameLines.length === 1 ? 24 : (nameLines.length === 2 ? 18 : 14);

        let cardSvg = `<g class="person-node" transform="translate(${nx.toFixed(1)}, ${ny.toFixed(1)})">`;
        cardSvg += `<rect width="90" height="76" rx="12" ry="12" fill="${bg}" stroke="${border}" stroke-width="2" ${strokeDash}/>`;
        cardSvg += SvgTreeRenderer._renderSvgCardNameText(nameLines, startNameY, text);

        const cardInfo = typeof p.getCardDateString === 'function' ? p.getCardDateString() : null;
        let currentY = startNameY + (nameLines.length - 1) * 13 + 12;

        const dateBadge = SvgTreeRenderer._renderSvgCardDateBadge(cardInfo, dateBg, dateText, currentY);
        cardSvg += dateBadge.svg;
        currentY = dateBadge.nextY;

        cardSvg += SvgTreeRenderer._renderSvgCardSubtitle(p, currentY, jobText, text);
        cardSvg += '</g>';
        return cardSvg;
    }

    /**
     * Renders an SVG <g class="tree-connectors"> element containing all connector paths.
     *
     * @param {Array<Object>} paths - Array of path objects with 'd' attribute string.
     * @param {number} padX - Horizontal padding offset.
     * @param {number} padY - Vertical padding offset.
     * @returns {string} SVG group markup string.
     *
     * @example
     * SvgTreeRenderer._renderSvgConnectorsGroup([{ d: 'M 0 0 L 10 10' }], 10, 20);
     * // => '<g class="tree-connectors" ...><path d="M 0 0 L 10 10" /></g>'
     *
     * @example
     * SvgTreeRenderer._renderSvgConnectorsGroup([], 0, 0);
     * // => '<g class="tree-connectors" ...></g>'
     */
    static _renderSvgConnectorsGroup(paths, padX, padY) {
        let pathsSvg = `<g class="tree-connectors" stroke="#cbd5e1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${padX.toFixed(1)}, ${padY.toFixed(1)})">`;
        for (const p of paths) {
            pathsSvg += `<path d="${p.d}" />`;
        }
        pathsSvg += '</g>';
        return pathsSvg;
    }

    /**
     * Renders an SVG <g class="tree-nodes"> element containing cards for all layout nodes.
     *
     * @param {Array<Object>} nodes - Array of layout node objects with person, x, and y.
     * @param {number} padX - Horizontal padding offset.
     * @param {number} padY - Vertical padding offset.
     * @returns {string} SVG group markup string.
     *
     * @example
     * SvgTreeRenderer._renderSvgNodesGroup([{ person: p1, x: 50, y: 100 }], 10, 20);
     * // => '<g class="tree-nodes"><g class="person-node" ...>...</g></g>'
     *
     * @example
     * SvgTreeRenderer._renderSvgNodesGroup([], 0, 0);
     * // => '<g class="tree-nodes"></g>'
     */
    static _renderSvgNodesGroup(nodes, padX, padY) {
        let nodesSvg = '<g class="tree-nodes">';
        for (const n of nodes) {
            nodesSvg += SvgTreeRenderer._renderSvgPersonCard(n.person, n.x + padX, n.y + padY);
        }
        nodesSvg += '</g>';
        return nodesSvg;
    }

    /**
     * Composes SVG markup containing timeline grid, connector paths, and person cards.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} layoutConfig - Layout configuration
     * @param {Object} layoutData - Computed layout geometry
     * @param {Object} options - Formatting and feature flags
     * @param {Object} svgBounds - Canvas padding and dimensions ({ padX, padY, totalW, totalH })
     * @returns {{ fullSvg: string, innerSvg: string }}
     *
     * @example
     * SvgTreeRenderer._composeSvgTreeContent(tree, {}, layoutData, {}, { padX: 10, padY: 10, totalW: 500, totalH: 400 });
     * // => { fullSvg: '<svg ...>...</svg>', innerSvg: '...' }
     *
     * @example
     * SvgTreeRenderer._composeSvgTreeContent(tree, {}, { paths: [], nodes: [] }, { showTimeline: false }, { padX: 0, padY: 0, totalW: 100, totalH: 100 });
     * // => { fullSvg: '<svg ...></svg>', innerSvg: '<g ...></g><g ...></g>' }
     */
    static _composeSvgTreeContent(tree, layoutConfig, layoutData, options, svgBounds) {
        const { padX, padY, totalW, totalH } = svgBounds;
        const timelineSvg = options.showTimeline !== false
            ? SvgTreeRenderer._renderSvgTimelineGrid(tree, layoutConfig, padY, totalW, totalH)
            : '';
        const pathsSvg = SvgTreeRenderer._renderSvgConnectorsGroup(layoutData.paths, padX, padY);
        const nodesSvg = SvgTreeRenderer._renderSvgNodesGroup(layoutData.nodes, padX, padY);

        const innerSvg = `${timelineSvg}${pathsSvg}${nodesSvg}`;
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${totalH.toFixed(1)}" viewBox="0 0 ${totalW.toFixed(1)} ${totalH.toFixed(1)}">${innerSvg}</svg>`;
        return { fullSvg, innerSvg };
    }

    /**
     * Returns a fallback empty SVG tree result when layout data contains no renderable nodes.
     *
     * @returns {{ svg: string, innerSvg: string, width: number, height: number, padX: number, padY: number, layoutData: null }}
     *
     * @example
     * SvgTreeRenderer._createEmptySvgTreeResult().width;
     * // => 100
     *
     * @example
     * SvgTreeRenderer._createEmptySvgTreeResult().layoutData;
     * // => null
     */
    static _createEmptySvgTreeResult() {
        return {
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
            innerSvg: '',
            width: 100,
            height: 100,
            padX: 0,
            padY: 0,
            layoutData: null
        };
    }

    /**
     * Generates a self-contained SVG representation of the entire family tree canvas.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @param {Object} [layoutConfig={}] - Tree layout options
     * @param {Object} [options={}] - Formatting options
     * @returns {{ svg: string, innerSvg: string, width: number, height: number, padX: number, padY: number, layoutData: Object }}
     *
     * @example
     * const svgResult = SvgTreeRenderer.generatePureSvgTree(tree);
     * // => { svg: '<svg ...>...</svg>', innerSvg: '...', width: 1200, height: 800, ... }
     *
     * @example
     * const svgResult = SvgTreeRenderer.generatePureSvgTree(null);
     * // => { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>', innerSvg: '', ... }
     */
    static generatePureSvgTree(tree, layoutConfig = {}, options = {}) {
        const layoutData = FamilyTreeBuilder.computeLayout(tree, layoutConfig);
        if (!layoutData || layoutData.nodes.length === 0) {
            return SvgTreeRenderer._createEmptySvgTreeResult();
        }

        const cardPadPx = typeof options.cardPadPx === 'number' ? options.cardPadPx : 15;
        const padX = cardPadPx - layoutData.minX;
        const padY = cardPadPx - layoutData.minY;
        const totalW = layoutData.width + cardPadPx * 2;
        const totalH = layoutData.height + cardPadPx * 2;

        const { fullSvg, innerSvg } = SvgTreeRenderer._composeSvgTreeContent(
            tree, layoutConfig, layoutData, options, { padX, padY, totalW, totalH }
        );

        return {
            svg: fullSvg,
            innerSvg,
            width: totalW,
            height: totalH,
            padX,
            padY,
            layoutData
        };
    }

    /**
     * Parses the bounding box / dimensions from an SVG string via viewBox or width/height attributes.
     *
     * @param {string} rawSvg - Raw SVG string.
     * @returns {{ vbX: number, vbY: number, vbW: number, vbH: number }} Parsed SVG bounds.
     *
     * @example
     * SvgTreeRenderer._parseSvgDimensions('<svg viewBox="0 0 1000 800">');
     * // => { vbX: 0, vbY: 0, vbW: 1000, vbH: 800 }
     *
     * @example
     * SvgTreeRenderer._parseSvgDimensions('<svg width="600" height="400">');
     * // => { vbX: 0, vbY: 0, vbW: 600, vbH: 400 }
     */
    static _parseSvgDimensions(rawSvg) {
        let vbX = 0, vbY = 0, vbW = 1000, vbH = 1000;
        const vbMatch = rawSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
        if (vbMatch) {
            const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
            if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
                vbX = parts[0]; vbY = parts[1]; vbW = parts[2]; vbH = parts[3];
            }
        } else {
            const wMatch = rawSvg.match(/width\s*=\s*["']?(\d+(?:\.\d+)?)/i);
            const hMatch = rawSvg.match(/height\s*=\s*["']?(\d+(?:\.\d+)?)/i);
            if (wMatch) vbW = parseFloat(wMatch[1]);
            if (hMatch) vbH = parseFloat(hMatch[1]);
        }
        return { vbX, vbY, vbW, vbH };
    }
}
