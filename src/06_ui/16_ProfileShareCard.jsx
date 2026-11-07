// ============================================================================
// MODULE 6.16: PROFILE SHARE CARD & WHATSAPP PREVIEW GENERATOR
// ============================================================================

const SHARE_CARD_WIDTH = 1200;
const SHARE_CARD_HEIGHT = 630;
const DEFAULT_SHARE_ORIGIN = 'https://google.github.io';

/**
 * Synchronizes `document.title` with the currently selected person so browser tabs, bookmarks,
 * and native share sheets display `"<Name> — Family Tree"` instead of a generic title.
 *
 * @param {Person|null} focusPerson - Active selected person record, if any.
 *
 * @example
 * useDocumentTitleSync(tree.get('Anto_1955_22'));
 * // document.title => 'Anto — Family Tree'
 *
 * @example
 * useDocumentTitleSync(null);
 * // document.title => 'Family Tree'
 */
function useDocumentTitleSync(focusPerson) {
    const personName = (focusPerson && !focusPerson._isUnknown && focusPerson.name) ? String(focusPerson.name).trim() : '';
    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.title = personName ? `${personName} — Family Tree` : 'Family Tree';
    }, [personName]);
}

/**
 * Builds a concise secondary line (`place` or `job`) for a mini person card in the share graphic.
 *
 * @param {Person|null} person - Person node from `FamilyTree`.
 * @returns {string} Primary place or job label, or empty string.
 *
 * @example
 * formatShareNodeSubtitle({ place: 'Chalakkudy, Kerala', job: 'Banker' });
 * // => 'Chalakkudy'
 *
 * @example
 * formatShareNodeSubtitle({ place: '', job: 'Teacher, Principal' });
 * // => 'Teacher'
 */
function formatShareNodeSubtitle(person) {
    if (!person) return '';
    const primaryPlace = parseCommaDelimitedTokens(person.place || '')[0] || '';
    if (primaryPlace) return primaryPlace;
    return parseCommaDelimitedTokens(person.job || '')[0] || '';
}

/**
 * Converts a domain `Person` into a lightweight descriptor for mini-tree card rendering.
 *
 * @param {Person|null} person - Domain person node.
 * @returns {{ id: string, name: string, gender: string, badge: string, subtitle: string }|null}
 *
 * @example
 * toMiniShareNode(tree.get('Anto_1955_22'));
 * // => { id: 'Anto_1955_22', name: 'Anto', gender: 'M', badge: 'b. 1955', subtitle: 'Chalakkudy' }
 *
 * @example
 * toMiniShareNode(null);
 * // => null
 */
function toMiniShareNode(person) {
    if (!person || person._isUnknown || FamilyTree.isSyntheticSiblingParent(person)) return null;
    const { dateStr, extraStr } = typeof person.getDateStrings === 'function' ? person.getDateStrings() : {};
    const badge = extraStr ? extraStr.replace(/\s*yrs\b/, 'y') : (dateStr || '');
    return {
        id: person.id,
        name: String(person.name || 'Unknown').trim(),
        gender: person.gender || 'U',
        badge: badge || dateStr || '',
        subtitle: formatShareNodeSubtitle(person)
    };
}

/**
 * Resolves valid, non-synthetic `Person` records from an array of node IDs.
 *
 * @param {FamilyTree|null} tree - Family tree model.
 * @param {Array<string>} ids - Candidate person IDs.
 * @param {boolean} [sortChronologically=false] - Whether to sort with `compareSidebarRelatives`.
 * @returns {Array<Person>} Valid person instances.
 *
 * @example
 * resolveRealRelativeNodes(tree, ['Anto_1955_22'], false);
 * // => [Person]
 *
 * @example
 * resolveRealRelativeNodes(null, ['Anto_1955_22'], true);
 * // => []
 */
function resolveRealRelativeNodes(tree, ids, sortChronologically = false) {
    if (!tree || typeof tree.get !== 'function' || !Array.isArray(ids)) return [];
    const seen = new Set();
    const list = [];
    for (const id of ids) {
        if (!id || seen.has(id)) continue;
        const node = tree.get(id);
        if (node && !node._isUnknown && !FamilyTree.isSyntheticSiblingParent(node)) {
            seen.add(id);
            list.push(node);
        }
    }
    if (sortChronologically) list.sort(compareSidebarRelatives);
    return list;
}

/**
 * Extracts a structured immediate-family snapshot (parents, partners, children, and biographical
 * badges) around `person` for rendering the `1200x630` share preview card and WhatsApp caption.
 *
 * @param {Person|null} person - Focused person record.
 * @param {FamilyTree|null} tree - Family tree instance.
 * @param {string} [sheetUrl=''] - Active Google Sheets URL for resolving sheet title.
 * @returns {Object|null} Immediate-family snapshot, or `null` when `person` is missing.
 *
 * @example
 * extractImmediateFamilySnapshot(tree.get('Anto_1955_22'), tree, '').name;
 * // => 'Anto'
 *
 * @example
 * extractImmediateFamilySnapshot(null, tree, '');
 * // => null
 */
function extractImmediateFamilySnapshot(person, tree, sheetUrl = '') {
    if (!person) return null;
    const { dateStr = '', extraStr = '' } = typeof person.getDateStrings === 'function' ? person.getDateStrings() : {};
    const parentsRaw = resolveRealRelativeNodes(tree, [person.fatherId, person.momId], false);
    const partnersRaw = resolveRealRelativeNodes(tree, person.partners || [], false);
    const childrenRaw = resolveRealRelativeNodes(tree, person.children || [], true);
    const siblingsRaw = (tree && typeof tree.getSiblings === 'function')
        ? tree.getSiblings(person.id).filter((s) => s && !s._isUnknown && !FamilyTree.isSyntheticSiblingParent(s))
        : [];
    const visibleChildren = childrenRaw.slice(0, 4).map(toMiniShareNode).filter(Boolean);
    return {
        id: person.id,
        name: String(person.name || 'Profile').trim(),
        nick: person.nick ? String(person.nick).trim() : '',
        gender: person.gender || 'U',
        lifespan: dateStr,
        ageLabel: extraStr,
        familyName: person.family ? String(person.family).trim() : '',
        primaryJob: parseCommaDelimitedTokens(person.job || '')[0] || '',
        primaryPlace: parseCommaDelimitedTokens(person.place || '')[0] || '',
        sheetTitle: sheetUrl ? resolveKnownSheetTitle(sheetUrl) : '',
        focusNode: toMiniShareNode(person) || { id: person.id, name: String(person.name || 'Profile'), gender: person.gender || 'U', badge: dateStr, subtitle: '' },
        parents: parentsRaw.slice(0, 2).map(toMiniShareNode).filter(Boolean),
        allParentNames: parentsRaw.map((p) => p.name),
        partners: partnersRaw.slice(0, 1).map(toMiniShareNode).filter(Boolean),
        allPartnerNames: partnersRaw.map((p) => p.name),
        children: visibleChildren,
        allChildNames: childrenRaw.map((p) => p.name),
        extraChildrenCount: Math.max(0, childrenRaw.length - visibleChildren.length),
        siblingsCount: siblingsRaw.length
    };
}

/**
 * Builds the canonical ultra-short deep-link URL targeting `person` at a readable `0.8` zoom,
 * even if the debounced address-bar writer has not flushed yet.
 *
 * @param {Object} params
 * @param {Person|null} params.person - Person to link to.
 * @param {FamilyTree|null} params.tree - Active tree model.
 * @param {string} [params.sheetUrl=''] - Active Google Sheets URL.
 * @param {{ origin?: string, pathname?: string, search?: string }|null} [params.locationObj=null] - Location override for tests.
 * @returns {string} Full shareable `https://...` (or current origin) URL.
 *
 * @example
 * buildPersonShareUrl({ person: { id: 'Anto_1955_22' }, tree, sheetUrl: 'https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit', locationObj: { origin: 'https://google.github.io', pathname: '/family-tree/', search: '' } });
 * // => 'https://google.github.io/family-tree/?d#...'
 *
 * @example
 * buildPersonShareUrl({ person: null, tree: null });
 * // => 'https://google.github.io/family-tree/'
 */
function buildPersonShareUrl({ person, tree, sheetUrl = '', locationObj = null } = {}) {
    const loc = locationObj || (typeof window !== 'undefined' && window.location ? window.location : {});
    const origin = (loc.origin && /^https?:/i.test(loc.origin)) ? loc.origin : DEFAULT_SHARE_ORIGIN;
    const pathname = loc.pathname || (origin === DEFAULT_SHARE_ORIGIN ? '/family-tree/' : '/');
    if (!person || !person.id) return `${origin}${pathname}${loc.search || ''}`;
    const hashBody = encodeViewStateHash({ focusId: person.id, isSidebarVisible: true, zoom: 0.8 }, tree);
    const hashPart = hashBody ? `#${hashBody}` : '';
    const sheetId = extractSheetIdFromUrl(sheetUrl) || extractSheetIdFromUrl(extractSheetQueryValue(loc.search || ''));
    if (sheetId) {
        return `${origin}${buildSheetDeepLinkUrl({ pathname, search: loc.search || '', hash: hashPart }, sheetId)}`;
    }
    return `${origin}${pathname}${loc.search || ''}${hashPart}`;
}

/**
 * Formats the parenthetical biographical summary (`lifespan · age · job · place`) for captions.
 *
 * @param {Object|null} snapshot - Snapshot returned by `extractImmediateFamilySnapshot`.
 * @returns {string} Dot-separated bio string, or empty string.
 *
 * @example
 * formatShareBioParenthetical({ lifespan: 'b. 1955', ageLabel: '71 yrs', primaryJob: 'Banker', primaryPlace: 'Chalakkudy' });
 * // => 'b. 1955 · 71 yrs · Banker · Chalakkudy'
 *
 * @example
 * formatShareBioParenthetical(null);
 * // => ''
 */
function formatShareBioParenthetical(snapshot) {
    if (!snapshot) return '';
    return [snapshot.lifespan, snapshot.ageLabel, snapshot.primaryJob, snapshot.primaryPlace]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Formats a concise single-line summary of immediate relatives (`Parents`, `Partner`, `Children`)
 * for WhatsApp text captions.
 *
 * @param {Object|null} snapshot - Snapshot returned by `extractImmediateFamilySnapshot`.
 * @returns {string} Dot-separated relatives summary line.
 *
 * @example
 * formatShareRelativesLine({ allParentNames: ['Chacko', 'Regina'], allPartnerNames: ['Beena'], allChildNames: ['Rupak', 'Innez'] });
 * // => 'Parents: Chacko & Regina · Partner: Beena · Children: Rupak, Innez'
 *
 * @example
 * formatShareRelativesLine({ allParentNames: [], allPartnerNames: [], allChildNames: [] });
 * // => ''
 */
function formatShareRelativesLine(snapshot) {
    if (!snapshot) return '';
    const parts = [];
    if (Array.isArray(snapshot.allParentNames) && snapshot.allParentNames.length > 0) {
        const label = snapshot.allParentNames.length > 1 ? 'Parents' : 'Parent';
        parts.push(`${label}: ${snapshot.allParentNames.join(' & ')}`);
    }
    if (Array.isArray(snapshot.allPartnerNames) && snapshot.allPartnerNames.length > 0) {
        const label = snapshot.allPartnerNames.length > 1 ? 'Partners' : 'Partner';
        parts.push(`${label}: ${snapshot.allPartnerNames.join(', ')}`);
    }
    if (Array.isArray(snapshot.allChildNames) && snapshot.allChildNames.length > 0) {
        const shown = snapshot.allChildNames.slice(0, 4).join(', ');
        const more = snapshot.allChildNames.length > 4 ? ` +${snapshot.allChildNames.length - 4}` : '';
        const label = snapshot.allChildNames.length > 1 ? 'Children' : 'Child';
        parts.push(`${label}: ${shown}${more}`);
    }
    return parts.join(' · ');
}

/**
 * Builds the formatted multi-line WhatsApp share caption combining bold profile title,
 * biographical badges, immediate-family relationships, and the clickable short deep link.
 *
 * @param {Object|null} snapshot - Snapshot from `extractImmediateFamilySnapshot`.
 * @param {string} shareUrl - Canonical share URL from `buildPersonShareUrl`.
 * @returns {string} Multi-line caption ready for WhatsApp or clipboard.
 *
 * @example
 * buildWhatsAppShareCaption({ name: 'Anto', lifespan: 'b. 1955', ageLabel: '71 yrs', primaryJob: 'Banker', primaryPlace: 'Chalakkudy', allParentNames: ['Chacko', 'Regina'], allPartnerNames: ['Beena'], allChildNames: ['Rupak'] }, 'https://google.github.io/family-tree/?d#abc');
 * // => '🌳 *Anto* (b. 1955 · 71 yrs · Banker · Chalakkudy)\nParents: Chacko & Regina · Partner: Beena · Child: Rupak\nhttps://google.github.io/family-tree/?d#abc'
 *
 * @example
 * buildWhatsAppShareCaption(null, 'https://google.github.io/family-tree/');
 * // => 'https://google.github.io/family-tree/'
 */
function buildWhatsAppShareCaption(snapshot, shareUrl) {
    if (!snapshot) return String(shareUrl || '');
    const bio = formatShareBioParenthetical(snapshot);
    const headline = bio ? `🌳 *${snapshot.name}* (${bio})` : `🌳 *${snapshot.name}*`;
    const relativesLine = formatShareRelativesLine(snapshot);
    return [headline, relativesLine, shareUrl].filter(Boolean).join('\n');
}

/**
 * Computes non-overlapping mini-card positions and orthogonal SVG/Canvas connector segments for
 * the 3-generation immediate-family diagram on the right half of the `1200x630` share card.
 *
 * @param {Object} snapshot - Immediate-family snapshot from `extractImmediateFamilySnapshot`.
 * @param {{ x: number, y: number, width: number, height: number }} box - Diagram bounding box.
 * @returns {{ cards: Array<Object>, lines: Array<Object>, overflowBadge: Object|null }}
 *
 * @example
 * computeMiniTreeCardLayout(snapshot, { x: 580, y: 48, width: 564, height: 534 }).cards.length >= 1;
 * // => true
 *
 * @example
 * computeMiniTreeCardLayout({ focusNode: { id: 'p1', name: 'Solo', gender: 'M' }, parents: [], partners: [], children: [], extraChildrenCount: 0 }, { x: 0, y: 0, width: 500, height: 500 }).lines;
 * // => []
 */
function computeMiniTreeCardLayout(snapshot, box) {
    if (!snapshot || !snapshot.focusNode) return { cards: [], lines: [], overflowBadge: null };
    const cx = box.x + box.width / 2;
    const hasParents = snapshot.parents.length > 0;
    const hasChildren = snapshot.children.length > 0;
    const midY = hasParents && hasChildren ? box.y + 214 : (hasParents ? box.y + 296 : (hasChildren ? box.y + 146 : box.y + 220));
    const cards = [];
    const lines = [];
    const focusW = 166, focusH = 88, spouseW = 152, spouseH = 84;
    const hasPartner = snapshot.partners.length > 0;
    const focusX = hasPartner ? cx - focusW - 14 : cx - focusW / 2;
    cards.push({ ...snapshot.focusNode, x: focusX, y: midY, w: focusW, h: focusH, isFocus: true });
    let coupleMidX = focusX + focusW / 2;
    if (hasPartner) {
        const spX = cx + 14;
        cards.push({ ...snapshot.partners[0], x: spX, y: midY + 2, w: spouseW, h: spouseH, isFocus: false });
        lines.push({ x1: focusX + focusW, y1: midY + focusH / 2, x2: spX, y2: midY + focusH / 2, highlight: true });
        coupleMidX = (focusX + focusW + spX) / 2;
    }
    addParentTierToMiniLayout(snapshot.parents, { box, cx, focusCenterX: focusX + focusW / 2, midY, cards, lines });
    const overflowBadge = addChildTierToMiniLayout(snapshot, { box, cx, coupleMidX, midY, focusH, cards, lines });
    return { cards, lines, overflowBadge };
}

/**
 * Places up to two parent mini-cards and marriage/descent connectors above the focused profile.
 *
 * @param {Array<Object>} parents - Up to two parent descriptors.
 * @param {Object} ctx - Layout geometry accumulator.
 *
 * @example
 * addParentTierToMiniLayout([], { box: { y: 48 }, cx: 860, focusCenterX: 800, midY: 260, cards: [], lines: [] });
 *
 * @example
 * addParentTierToMiniLayout([{ id: 'f', name: 'Chacko', gender: 'M' }], { box: { y: 48 }, cx: 860, focusCenterX: 860, midY: 260, cards: [], lines: [] });
 */
function addParentTierToMiniLayout(parents, { box, cx, focusCenterX, midY, cards, lines }) {
    if (!Array.isArray(parents) || parents.length === 0) return;
    const pw = 154, ph = 80, topY = midY - 156 < box.y + 28 ? box.y + 28 : midY - 156;
    if (parents.length === 1) {
        const px = focusCenterX - pw / 2;
        cards.push({ ...parents[0], x: px, y: topY, w: pw, h: ph, isFocus: false });
        lines.push({ x1: focusCenterX, y1: topY + ph, x2: focusCenterX, y2: midY, highlight: true });
        return;
    }
    const leftX = cx - pw - 16, rightX = cx + 16, barY = topY + ph / 2, elbowY = Math.round((barY + midY) / 2 + 12);
    cards.push({ ...parents[0], x: leftX, y: topY, w: pw, h: ph, isFocus: false });
    cards.push({ ...parents[1], x: rightX, y: topY, w: pw, h: ph, isFocus: false });
    lines.push({ x1: leftX + pw, y1: barY, x2: rightX, y2: barY, highlight: false });
    lines.push({ x1: cx, y1: barY, x2: cx, y2: elbowY, highlight: true });
    lines.push({ x1: cx, y1: elbowY, x2: focusCenterX, y2: elbowY, highlight: true });
    lines.push({ x1: focusCenterX, y1: elbowY, x2: focusCenterX, y2: midY, highlight: true });
}

/**
 * Places up to four child mini-cards, sibling bus-bar connectors, and an optional `+N more` pill.
 *
 * @param {Object} snapshot - Immediate-family snapshot.
 * @param {Object} ctx - Layout geometry accumulator.
 * @returns {{ text: string, x: number, y: number }|null} Optional overflow badge descriptor.
 *
 * @example
 * addChildTierToMiniLayout({ children: [], extraChildrenCount: 0 }, { box: { x: 580, width: 564 }, cx: 862, coupleMidX: 862, midY: 260, focusH: 88, cards: [], lines: [] });
 * // => null
 *
 * @example
 * addChildTierToMiniLayout({ children: [{ id: 'c1', name: 'Rupak', gender: 'M' }], extraChildrenCount: 2 }, { box: { x: 580, width: 564 }, cx: 862, coupleMidX: 862, midY: 260, focusH: 88, cards: [], lines: [] }).text;
 * // => '+2 more children'
 */
function addChildTierToMiniLayout(snapshot, { box, cx, coupleMidX, midY, focusH, cards, lines }) {
    const kids = snapshot.children || [];
    if (kids.length === 0) return null;
    const n = kids.length;
    const gap = n >= 4 ? 10 : 14;
    const cw = n >= 4 ? 120 : (n === 3 ? 144 : 152);
    const ch = 78;
    const totalW = n * cw + (n - 1) * gap;
    const startX = Math.max(box.x + 18, cx - totalW / 2);
    const childY = midY + focusH + 74;
    const busY = midY + focusH + 36;
    const stemStartY = snapshot.partners.length > 0 ? midY + focusH / 2 : midY + focusH;
    const firstCenter = startX + cw / 2;
    const lastCenter = startX + (n - 1) * (cw + gap) + cw / 2;
    lines.push({ x1: coupleMidX, y1: stemStartY, x2: coupleMidX, y2: busY, highlight: true });
    lines.push({ x1: Math.min(firstCenter, coupleMidX), y1: busY, x2: Math.max(lastCenter, coupleMidX), y2: busY, highlight: false });
    kids.forEach((kid, idx) => {
        const kx = startX + idx * (cw + gap);
        const kcx = kx + cw / 2;
        cards.push({ ...kid, x: kx, y: childY, w: cw, h: ch, isFocus: false });
        lines.push({ x1: kcx, y1: busY, x2: kcx, y2: childY, highlight: false });
    });
    if (snapshot.extraChildrenCount > 0) {
        return { text: `+${snapshot.extraChildrenCount} more ${snapshot.extraChildrenCount === 1 ? 'child' : 'children'}`, x: cx, y: childY + ch + 22 };
    }
    return null;
}

/**
 * Traces a rounded rectangle path onto a 2D canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {number} x - Left coordinate.
 * @param {number} y - Top coordinate.
 * @param {number} w - Width in px.
 * @param {number} h - Height in px.
 * @param {number} r - Corner radius in px.
 *
 * @example
 * drawRoundedRectPath(ctx, 10, 10, 120, 60, 12);
 *
 * @example
 * drawRoundedRectPath(ctx, 0, 0, 1200, 630, 0);
 */
function drawRoundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

/**
 * Truncates `text` with an ellipsis so its measured pixel width fits within `maxWidth`.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context with active font set.
 * @param {string} text - Input string.
 * @param {number} maxWidth - Maximum pixel width.
 * @returns {string} Fitted text string.
 *
 * @example
 * truncateCanvasText(ctx, 'Short', 300);
 * // => 'Short'
 *
 * @example
 * truncateCanvasText(ctx, 'Very Long Ancestor Name That Overflows', 80);
 * // => 'Very Long…'
 */
function truncateCanvasText(ctx, text, maxWidth) {
    const str = String(text || '');
    if (!str || maxWidth <= 0 || ctx.measureText(str).width <= maxWidth) return str;
    let lo = 0, hi = str.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(`${str.slice(0, mid)}…`).width <= maxWidth) lo = mid;
        else hi = mid - 1;
    }
    return lo > 0 ? `${str.slice(0, lo)}…` : '…';
}

/**
 * Paints the Solarized Dark canvas backdrop, radial emerald/sky glow, and subtle timeline rules.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 *
 * @example
 * drawShareCardBackdrop(ctx, 1200, 630);
 *
 * @example
 * drawShareCardBackdrop(ctx, 600, 315);
 */
function drawShareCardBackdrop(ctx, width, height) {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#002630');
    bg.addColorStop(0.55, '#002b36');
    bg.addColorStop(1, '#042028');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.74, height * 0.48, 20, width * 0.74, height * 0.48, 390);
    glow.addColorStop(0, 'rgba(138, 184, 78, 0.18)');
    glow.addColorStop(0.6, 'rgba(56, 189, 248, 0.06)');
    glow.addColorStop(1, 'rgba(0, 43, 54, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1;
    [138, 315, 492].forEach((gy) => {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
    });
    ctx.restore();
}

/**
 * Draws the circular green Family Tree emblem badge at `(cx, cy)` on the share card.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {number} cx - Center X coordinate.
 * @param {number} cy - Center Y coordinate.
 * @param {number} radius - Outer circle radius in px.
 *
 * @example
 * drawShareCardLeafEmblem(ctx, 78, 76, 22);
 *
 * @example
 * drawShareCardLeafEmblem(ctx, 40, 40, 16);
 */
function drawShareCardLeafEmblem(ctx, cx, cy, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fcfdf8';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#5c7c33';
    ctx.stroke();
    ctx.strokeStyle = '#5c7c33';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + radius * 0.62);
    ctx.lineTo(cx, cy - radius * 0.42);
    ctx.moveTo(cx, cy + radius * 0.12);
    ctx.lineTo(cx - radius * 0.36, cy - radius * 0.22);
    ctx.moveTo(cx, cy + radius * 0.12);
    ctx.lineTo(cx + radius * 0.36, cy - radius * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#7cb342';
    [[0, -0.56, 4.4], [-0.42, -0.28, 3.8], [0.42, -0.28, 3.8], [-0.48, 0.08, 3.4], [0.48, 0.08, 3.4]].forEach(([dx, dy, lr]) => {
        ctx.beginPath();
        ctx.arc(cx + dx * radius, cy + dy * radius, lr, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

/**
 * Draws the left-column brand header, person name + gender dot, and nickname on the share card.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {Object} snapshot - Immediate-family snapshot.
 * @param {number} leftX - Left margin X coordinate.
 * @param {number} maxW - Maximum column width in px.
 * @returns {number} Next vertical Y cursor position.
 *
 * @example
 * const nextY = drawShareCardHeroHeader(ctx, snapshot, 56, 476);
 *
 * @example
 * drawShareCardHeroHeader(ctx, { name: 'Anto', nick: '', gender: 'M', sheetTitle: 'Demo' }, 56, 476);
 */
function drawShareCardHeroHeader(ctx, snapshot, leftX, maxW) {
    drawShareCardLeafEmblem(ctx, leftX + 22, 74, 22);
    ctx.fillStyle = '#9cc95f';
    ctx.font = '700 22px Georgia, serif';
    ctx.fillText('Family Tree', leftX + 54, 81);
    if (snapshot.sheetTitle) {
        const brandEnd = leftX + 54 + Math.ceil(ctx.measureText('Family Tree').width) + 10;
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(truncateCanvasText(ctx, `· ${snapshot.sheetTitle}`, leftX + maxW - brandEnd), brandEnd, 80);
    }

    const dotColor = snapshot.gender === 'M' ? '#38bdf8' : (snapshot.gender === 'F' ? '#f472b6' : '#94a3b8');
    ctx.beginPath();
    ctx.arc(leftX + 10, 154, 8, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();

    const nameLen = snapshot.name.length;
    const fontSize = nameLen > 22 ? 34 : (nameLen > 15 ? 42 : 50);
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(truncateCanvasText(ctx, snapshot.name, maxW - 32), leftX + 30, 170);
    if (snapshot.nick) {
        ctx.font = 'italic 500 20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(truncateCanvasText(ctx, `"${snapshot.nick}"`, maxW), leftX, 204);
        return 228;
    }
    return 202;
}

/**
 * Renders wrapping attribute pills (lifespan/age, family house, career, hometown) in the left column.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {Object} snapshot - Immediate-family snapshot.
 * @param {number} leftX - Left column X coordinate.
 * @param {number} startY - Starting Y coordinate.
 * @param {number} maxW - Maximum column width in px.
 * @returns {number} Next vertical Y cursor position.
 *
 * @example
 * drawShareCardHeroPills(ctx, snapshot, 56, 210, 476);
 *
 * @example
 * drawShareCardHeroPills(ctx, { lifespan: 'b. 1955', ageLabel: '71 yrs' }, 56, 210, 476);
 */
function drawShareCardHeroPills(ctx, snapshot, leftX, startY, maxW) {
    const lifeText = [snapshot.lifespan, snapshot.ageLabel].filter(Boolean).join(' · ');
    const rawPills = [
        lifeText ? { text: lifeText, bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(125, 211, 252, 0.35)', fg: '#e0f2fe' } : null,
        snapshot.familyName ? { text: `⌂ ${snapshot.familyName}`, bg: 'rgba(168, 85, 247, 0.14)', border: 'rgba(216, 180, 254, 0.32)', fg: '#f3e8ff' } : null,
        snapshot.primaryJob ? { text: snapshot.primaryJob, bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(110, 231, 183, 0.32)', fg: '#d1fae5' } : null,
        snapshot.primaryPlace ? { text: `📍 ${snapshot.primaryPlace}`, bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(253, 164, 175, 0.34)', fg: '#ffe4e6' } : null
    ].filter(Boolean);
    if (rawPills.length === 0) return startY + 8;

    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    let curX = leftX, curY = startY;
    rawPills.forEach((pill) => {
        const label = truncateCanvasText(ctx, pill.text, maxW - 28);
        const pw = Math.ceil(ctx.measureText(label).width) + 28, ph = 36;
        if (curX > leftX && curX + pw > leftX + maxW) { curX = leftX; curY += ph + 10; }
        drawRoundedRectPath(ctx, curX, curY, pw, ph, 18);
        ctx.fillStyle = pill.bg; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = pill.border; ctx.stroke();
        ctx.fillStyle = pill.fg;
        ctx.fillText(label, curX + 14, curY + 23.5);
        curX += pw + 10;
    });
    return curY + 56;
}

/**
 * Renders structured `PARENTS`, `PARTNER`, and `CHILDREN` rows + the bottom call-to-action pill.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {Object} snapshot - Immediate-family snapshot.
 * @param {number} leftX - Left column X coordinate.
 * @param {number} startY - Starting Y coordinate.
 * @param {number} maxW - Maximum column width in px.
 *
 * @example
 * drawShareCardLineageRows(ctx, snapshot, 56, 310, 476);
 *
 * @example
 * drawShareCardLineageRows(ctx, { allParentNames: [], allPartnerNames: [], allChildNames: [], siblingsCount: 0 }, 56, 310, 476);
 */
function drawShareCardLineageRows(ctx, snapshot, leftX, startY, maxW) {
    const rows = [];
    if (snapshot.allParentNames?.length) rows.push([snapshot.allParentNames.length > 1 ? 'PARENTS' : 'PARENT', snapshot.allParentNames.join(' & ')]);
    if (snapshot.allPartnerNames?.length) rows.push([snapshot.allPartnerNames.length > 1 ? 'PARTNERS' : 'PARTNER', snapshot.allPartnerNames.join(', ')]);
    if (snapshot.allChildNames?.length) {
        const extra = snapshot.allChildNames.length > 4 ? ` (+${snapshot.allChildNames.length - 4} more)` : '';
        rows.push([snapshot.allChildNames.length > 1 ? 'CHILDREN' : 'CHILD', `${snapshot.allChildNames.slice(0, 4).join(', ')}${extra}`]);
    }
    if (rows.length < 3 && snapshot.siblingsCount > 0) {
        rows.push(['SIBLINGS', `${snapshot.siblingsCount} ${snapshot.siblingsCount === 1 ? 'sibling' : 'siblings'} in branch`]);
    }

    let y = Math.max(startY, 310);
    rows.slice(0, 3).forEach(([heading, value]) => {
        if (y > 492) return;
        ctx.font = '700 11.5px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(heading, leftX, y);
        ctx.font = '600 18px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(truncateCanvasText(ctx, value, maxW), leftX, y + 23);
        y += 56;
    });

    drawRoundedRectPath(ctx, leftX, 534, 378, 44, 12);
    ctx.fillStyle = '#7cb342';
    ctx.fill();
    ctx.font = '800 15.5px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#051e11';
    ctx.fillText('Tap link below to explore family branch →', leftX + 20, 561);
}

/**
 * Draws a single mini genealogy node card (focus profile, parent, partner, or child) onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {Object} card - Positioned card descriptor from `computeMiniTreeCardLayout`.
 *
 * @example
 * drawMiniPersonNodeCard(ctx, { name: 'Anto', gender: 'M', badge: '71y', subtitle: 'Chalakkudy', x: 700, y: 260, w: 166, h: 88, isFocus: true });
 *
 * @example
 * drawMiniPersonNodeCard(ctx, { name: 'Beena', gender: 'F', badge: '68y', subtitle: 'Chelakkara', x: 890, y: 262, w: 152, h: 84, isFocus: false });
 */
function drawMiniPersonNodeCard(ctx, card) {
    const isFemale = card.gender === 'F';
    const fill = isFemale ? '#4d2638' : '#163f48';
    const border = card.isFocus ? (isFemale ? '#f9a8d4' : '#93c5fd') : (isFemale ? '#8c4b68' : '#4d7c85');
    ctx.save();
    if (card.isFocus) {
        ctx.shadowColor = isFemale ? 'rgba(249, 168, 212, 0.35)' : 'rgba(147, 197, 253, 0.35)';
        ctx.shadowBlur = 18;
    }
    drawRoundedRectPath(ctx, card.x, card.y, card.w, card.h, 15);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = card.isFocus ? 3 : 1.8;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.restore();

    const cx = card.x + card.w / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `700 ${card.isFocus ? 17 : 15}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#f8fafc';
    const topOffset = card.subtitle ? 27 : (card.badge ? 33 : 46);
    ctx.fillText(truncateCanvasText(ctx, card.name, card.w - 18), cx, card.y + topOffset);
    if (card.badge) {
        ctx.font = '700 11.5px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(truncateCanvasText(ctx, card.badge, card.w - 20), cx, card.y + topOffset + 21);
    }
    if (card.subtitle) {
        ctx.font = 'italic 500 11.5px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(truncateCanvasText(ctx, card.subtitle, card.w - 18), cx, card.y + topOffset + 40);
    }
    ctx.restore();
}

/**
 * Draws the right-hand glass panel and 3-generation immediate-family diagram onto the share card.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
 * @param {Object} snapshot - Immediate-family snapshot.
 * @param {{ x: number, y: number, width: number, height: number }} box - Diagram panel bounds.
 *
 * @example
 * drawMiniFamilyTreeDiagram(ctx, snapshot, { x: 576, y: 48, width: 568, height: 534 });
 *
 * @example
 * drawMiniFamilyTreeDiagram(ctx, { focusNode: { id: 'p1', name: 'Anto', gender: 'M' }, parents: [], partners: [], children: [], extraChildrenCount: 0 }, { x: 576, y: 48, width: 568, height: 534 });
 */
function drawMiniFamilyTreeDiagram(ctx, snapshot, box) {
    drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, 26);
    ctx.fillStyle = 'rgba(7, 54, 66, 0.64)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.stroke();

    const layout = computeMiniTreeCardLayout(snapshot, box);
    ctx.save();
    ctx.lineCap = 'round';
    layout.lines.forEach((seg) => {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.lineWidth = seg.highlight ? 2.8 : 2.2;
        ctx.strokeStyle = seg.highlight ? '#93c5fd' : '#64748b';
        ctx.stroke();
    });
    ctx.restore();

    layout.cards.forEach((card) => drawMiniPersonNodeCard(ctx, card));
    if (layout.overflowBadge) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(layout.overflowBadge.text, layout.overflowBadge.x, layout.overflowBadge.y);
        ctx.restore();
    }
}

/**
 * Renders a complete `1200x630` HTML5 `<canvas>` preview card for `snapshot`, combining biographical
 * badges on the left with a live 3-generation immediate-family tree diagram on the right.
 *
 * @param {Object} snapshot - Immediate-family snapshot from `extractImmediateFamilySnapshot`.
 * @returns {HTMLCanvasElement|null} Rendered `1200x630` canvas, or `null` outside browser DOM.
 *
 * @example
 * const canvas = renderProfileShareCardCanvas(snapshot);
 * // canvas.width => 1200, canvas.height => 630
 *
 * @example
 * renderProfileShareCardCanvas(null);
 * // => null
 */
function renderProfileShareCardCanvas(snapshot) {
    if (!snapshot || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = SHARE_CARD_WIDTH;
    canvas.height = SHARE_CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawShareCardBackdrop(ctx, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
    const pillsStartY = drawShareCardHeroHeader(ctx, snapshot, 56, 484);
    const lineageStartY = drawShareCardHeroPills(ctx, snapshot, 56, pillsStartY, 484);
    drawShareCardLineageRows(ctx, snapshot, 56, lineageStartY, 484);
    drawMiniFamilyTreeDiagram(ctx, snapshot, { x: 572, y: 48, width: 572, height: 534 });
    return canvas;
}

/**
 * Synchronously decodes a `data:image/png;base64,...` data URL into a `Blob` (`image/png`)
 * without awaiting `canvas.toBlob`, keeping WebKit/Chromium transient user-gesture activation
 * intact so `navigator.share` and `navigator.clipboard.write` succeed on the first click.
 *
 * @param {string} dataUrl - PNG data URL emitted by `canvas.toDataURL('image/png')`.
 * @returns {Blob|null} Decoded PNG `Blob`, or `null` when unavailable or malformed.
 *
 * @example
 * const blob = dataUrlToPngBlob(canvas.toDataURL('image/png'));
 *
 * @example
 * dataUrlToPngBlob(''); // => null
 */
function dataUrlToPngBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !globalThis.Blob || !globalThis.Uint8Array || typeof globalThis.atob !== 'function') {
        return null;
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    try {
        const binary = globalThis.atob(dataUrl.slice(commaIdx + 1));
        const bytes = new globalThis.Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new globalThis.Blob([bytes], { type: 'image/png' });
    } catch (_) {
        return null;
    }
}

/**
 * Builds the richest Web Share API payload supported by `nav.canShare` for sharing `file`
 * alongside `title` and `caption`, or returns `null` when native file sharing is unavailable.
 *
 * @param {File|null} file - Rendered PNG `File` instance.
 * @param {string} title - Share sheet title (`"<Name> — Family Tree"`).
 * @param {string} caption - Formatted text summary and short URL.
 * @param {Object|null} [nav] - Navigator object (injectable for tests).
 * @returns {Object|null} Supported `navigator.share` payload, or `null`.
 *
 * @example
 * buildNativeSharePayload(pngFile, 'Anto — Family Tree', '🌳 *Anto*\nhttps://...');
 *
 * @example
 * buildNativeSharePayload(null, 'Anto — Family Tree', '', null); // => null
 */
function buildNativeSharePayload(file, title, caption, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
    if (!file || !nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return null;
    const candidates = [
        { files: [file], title, text: caption },
        { files: [file], text: caption },
        { files: [file] }
    ];
    for (const candidate of candidates) {
        try {
            if (nav.canShare(candidate)) return candidate;
        } catch (_) {}
    }
    return null;
}

/**
 * Tests whether the active browser supports sharing a PNG `File` via the native OS share sheet
 * (`navigator.share` + `navigator.canShare({ files })`).
 *
 * @param {Blob|null} pngBlob - Pre-rendered PNG blob.
 * @returns {boolean} True when native file sharing is supported.
 *
 * @example
 * canBrowserNativeShareFiles(pngBlob);
 *
 * @example
 * canBrowserNativeShareFiles(null); // => false
 */
function canBrowserNativeShareFiles(pngBlob) {
    try {
        if (!pngBlob || typeof navigator === 'undefined' || typeof window === 'undefined' || !window.File) return false;
        const probe = new window.File([pngBlob], 'family-tree-card.png', { type: 'image/png' });
        return Boolean(buildNativeSharePayload(probe, 'Family Tree', '', navigator));
    } catch (_) {
        return false;
    }
}

/**
 * Copies plain text to the system clipboard with a hidden `<textarea>` fallback.
 *
 * @param {string} text - Text to copy.
 * @param {Object|null} [nav] - Optional `navigator` override for tests.
 * @returns {Promise<boolean>} True if copying succeeded.
 *
 * @example
 * await copyTextToSystemClipboard('https://google.github.io/family-tree/?d');
 *
 * @example
 * await copyTextToSystemClipboard('');
 */
async function copyTextToSystemClipboard(text, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
    if (!text) return false;
    try {
        if (nav?.clipboard?.writeText) {
            await nav.clipboard.writeText(text);
            return true;
        }
    } catch (_) {}
    try {
        if (typeof document === 'undefined') return false;
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return Boolean(ok);
    } catch (_) {
        return false;
    }
}

/**
 * Writes a PNG `Blob` (paired with `captionText` as `text/plain` when multi-MIME `ClipboardItem`
 * is supported) to the system clipboard so `Ctrl+V` pastes the card image into WhatsApp Web and a
 * second `Ctrl+V` in WhatsApp's caption field pastes the formatted text + link.
 *
 * @param {Blob|null} pngBlob - Rendered PNG image blob.
 * @param {string} [captionText=''] - Companion plain-text caption and short URL.
 * @param {Object|null} [nav] - Optional `navigator` override for tests.
 * @param {Object|null} [win] - Optional `window`/`globalThis` override for tests.
 * @returns {Promise<boolean>} True when the image blob was written to the clipboard.
 *
 * @example
 * await copyClipboardPngBlob(pngBlob, '🌳 *Anto*\nhttps://google.github.io/family-tree/?d#abc');
 *
 * @example
 * await copyClipboardPngBlob(null); // => false
 */
async function copyClipboardPngBlob(
    pngBlob,
    captionText = '',
    nav = (typeof navigator !== 'undefined' ? navigator : null),
    win = (typeof globalThis !== 'undefined' ? globalThis : null)
) {
    if (!pngBlob || !nav?.clipboard?.write || !win?.ClipboardItem) return false;
    if (captionText && win.Blob) {
        try {
            const textBlob = new win.Blob([captionText], { type: 'text/plain' });
            await nav.clipboard.write([new win.ClipboardItem({ 'image/png': pngBlob, 'text/plain': textBlob })]);
            return true;
        } catch (_) {}
    }
    try {
        await nav.clipboard.write([new win.ClipboardItem({ 'image/png': pngBlob })]);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Synchronously assembles the `1200x630` PNG card `Blob`, formatted text caption, and short
 * deep-link URL for `person` so clicking Share can invoke the OS share sheet or clipboard
 * immediately within the active user gesture.
 *
 * @param {Object} [params={}]
 * @param {Person|null} params.person - Selected person record.
 * @param {FamilyTree|null} params.tree - Active family tree model.
 * @param {string} [params.sheetUrl=''] - Active Google Sheets URL.
 * @param {Object|null} [params.locationObj=null] - Optional location override for tests.
 * @returns {{ snapshot: Object, shareUrl: string, caption: string, pngBlob: Blob|null, fileName: string, title: string }|null}
 *
 * @example
 * const bundle = buildProfileShareBundle({ person: tree.get('Anto_1955_22'), tree, sheetUrl });
 *
 * @example
 * buildProfileShareBundle({ person: null, tree: null }); // => null
 */
function buildProfileShareBundle({ person, tree, sheetUrl = '', locationObj = null } = {}) {
    const snapshot = extractImmediateFamilySnapshot(person, tree, sheetUrl);
    if (!snapshot) return null;
    const shareUrl = buildPersonShareUrl({ person, tree, sheetUrl, locationObj });
    const caption = buildWhatsAppShareCaption(snapshot, shareUrl);
    const canvas = renderProfileShareCardCanvas(snapshot);
    const dataUrl = (canvas && typeof canvas.toDataURL === 'function') ? canvas.toDataURL('image/png') : '';
    const pngBlob = dataUrlToPngBlob(dataUrl);
    const safeSlug = snapshot.name.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Profile';
    return {
        snapshot,
        shareUrl,
        caption,
        pngBlob,
        fileName: `${safeSlug}_Family_Tree.png`,
        title: `${snapshot.name} — Family Tree`
    };
}

/**
 * Executes desktop/non-file-share fallbacks for `executeDirectProfileShare`: writes the
 * multi-MIME PNG card + text to the clipboard, or falls back to text `navigator.share` / text copy.
 *
 * @param {{ title: string, caption: string, shareUrl: string, pngBlob: Blob|null }} bundle - Prepared share bundle.
 * @param {Object|null} nav - Navigator instance.
 * @param {Object|null} win - Global window object.
 * @returns {Promise<{ mode: string, message: string, shareUrl: string, caption: string }>}
 *
 * @example
 * await executeFallbackProfileShare(bundle, navigator, window);
 *
 * @example
 * await executeFallbackProfileShare({ title: 'Anto', caption: 'hi', shareUrl: 'https://...', pngBlob: null }, null, null);
 */
async function executeFallbackProfileShare(bundle, nav, win) {
    if (await copyClipboardPngBlob(bundle.pngBlob, bundle.caption, nav, win)) {
        return {
            mode: 'clipboard-card',
            message: 'Copied preview card, text & link — paste into WhatsApp',
            shareUrl: bundle.shareUrl,
            caption: bundle.caption
        };
    }
    if (typeof nav?.share === 'function') {
        try {
            await nav.share({ title: bundle.title, text: bundle.caption });
            return { mode: 'native-text', message: '', shareUrl: bundle.shareUrl, caption: bundle.caption };
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return { mode: 'aborted', message: '', shareUrl: bundle.shareUrl, caption: bundle.caption };
            }
        }
    }
    const ok = await copyTextToSystemClipboard(bundle.caption, nav);
    return {
        mode: ok ? 'clipboard-text' : 'failed',
        message: ok ? 'Copied text & short link — paste into WhatsApp' : 'Unable to share from this browser',
        shareUrl: bundle.shareUrl,
        caption: bundle.caption
    };
}

/**
 * Shares a profile's `1200x630` preview card, formatted text, and short deep link directly on
 * button click without any intermediate modal dialog: invokes `navigator.share` with the PNG
 * file + caption when supported, or copies both to the system clipboard on desktop browsers.
 *
 * @param {Object} [params={}]
 * @param {Person|null} params.person - Selected person record to share.
 * @param {FamilyTree|null} params.tree - Active family tree model.
 * @param {string} [params.sheetUrl=''] - Active Google Sheets URL.
 * @param {Object|null} [params.locationObj=null] - Optional location override for tests.
 * @param {Object|null} [params.nav] - Optional `navigator` override for tests.
 * @param {Object|null} [params.win] - Optional `window`/`globalThis` override for tests.
 * @returns {Promise<{ mode: string, message: string, shareUrl: string, caption: string }>}
 *
 * @example
 * await executeDirectProfileShare({ person: tree.get('Anto_1955_22'), tree, sheetUrl });
 *
 * @example
 * await executeDirectProfileShare({ person: null, tree: null }); // => { mode: 'noop', message: '', shareUrl: '', caption: '' }
 */
async function executeDirectProfileShare({
    person, tree, sheetUrl = '', locationObj = null,
    nav = (typeof navigator !== 'undefined' ? navigator : null),
    win = (typeof globalThis !== 'undefined' ? globalThis : null)
} = {}) {
    const bundle = buildProfileShareBundle({ person, tree, sheetUrl, locationObj });
    if (!bundle) return { mode: 'noop', message: '', shareUrl: '', caption: '' };
    const file = (bundle.pngBlob && typeof win?.File === 'function')
        ? new win.File([bundle.pngBlob], bundle.fileName, { type: 'image/png' })
        : null;
    const nativePayload = buildNativeSharePayload(file, bundle.title, bundle.caption, nav);
    if (nativePayload) {
        try {
            // Invoke navigator.share first before any clipboard call so transient user activation stays intact.
            const sharePromise = nav.share(nativePayload);
            if (nav?.clipboard?.writeText) nav.clipboard.writeText(bundle.caption).catch(() => {});
            await sharePromise;
            return { mode: 'native-file', message: '', shareUrl: bundle.shareUrl, caption: bundle.caption };
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return { mode: 'aborted', message: '', shareUrl: bundle.shareUrl, caption: bundle.caption };
            }
        }
    }
    return executeFallbackProfileShare(bundle, nav, win);
}

/**
 * Coordinates `document.title` synchronization, 1-click profile sharing, and non-modal toast
 * feedback when falling back to clipboard copy on desktop browsers.
 *
 * @param {Object} params
 * @param {FamilyTree} params.tree - Active family tree model.
 * @param {string} [params.sheetUrl=''] - Active Google Sheets URL.
 * @param {string|null} [params.focusId=null] - Active focused person ID for `document.title` sync.
 * @returns {{ toastMessage: string, sharePerson: Function }}
 *
 * @example
 * const share = useProfileShareController({ tree, sheetUrl, focusId: 'Anto_1955_22' });
 * share.sharePerson(tree.get('Anto_1955_22'));
 *
 * @example
 * const { toastMessage } = useProfileShareController({ tree: new FamilyTree(), sheetUrl: '' });
 */
function useProfileShareController({ tree, sheetUrl = '', focusId = null }) {
    useDocumentTitleSync(focusId && tree ? tree.get(focusId) : null);
    const [toastMessage, setToastMessage] = useState('');
    const timerRef = useRef(null);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const sharePerson = useCallback(async (person) => {
        if (!person || person._isUnknown) return;
        const res = await executeDirectProfileShare({ person, tree, sheetUrl });
        if (timerRef.current) clearTimeout(timerRef.current);
        if (res.message) {
            setToastMessage(res.message);
            timerRef.current = setTimeout(() => setToastMessage(''), 3200);
        } else {
            setToastMessage('');
        }
    }, [tree, sheetUrl]);

    return { toastMessage, sharePerson };
}

/**
 * Compact Share button rendered in the person details header and on the mobile Peek bar.
 * Shares the `1200x630` preview card, formatted text, and short link directly on click.
 *
 * @param {Object} props
 * @param {Person|null} props.person - Person profile to share.
 * @param {Function} [props.onShare] - Callback invoked with `person`.
 * @param {boolean} [props.compact=false] - Compact style for the mobile Peek bar.
 * @returns {React.ReactNode|null}
 *
 * @example
 * <SidebarShareButton person={focusPerson} onShare={sharePerson} />
 *
 * @example
 * <SidebarShareButton person={focusPerson} onShare={sharePerson} compact={true} />
 */
function SidebarShareButton({ person, onShare, compact = false }) {
    if (!person || person._isUnknown || typeof onShare !== 'function') return null;
    if (compact) {
        return (
            <button type="button" data-testid="share-person-peek-btn" onClick={() => onShare(person)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer leading-none inline-flex items-center gap-1 interactive-element"
                    title={`Share ${person.name} preview card & link`} aria-label={`Share ${person.name}`}>
                <Icons.Share />
                <span>Share</span>
            </button>
        );
    }
    return (
        <button type="button" data-testid="share-person-btn" onClick={() => onShare(person)}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs transition-colors cursor-pointer interactive-element"
                title={`Share ${person.name} preview card & link`} aria-label={`Share ${person.name}`}>
            <Icons.Share />
            <span>Share</span>
        </button>
    );
}

/**
 * Non-modal floating status pill rendered briefly when desktop browsers without a native OS
 * file-share sheet copy the `1200x630` preview card, text, and short link to the clipboard.
 * Keeps fixed geometry (`visibility`/`opacity` toggle) so appearing/hiding causes zero layout shift.
 *
 * @param {Object} props
 * @param {string} [props.message=''] - Active feedback message, or empty string when hidden.
 * @returns {React.ReactElement}
 *
 * @example
 * <ProfileShareToast message="Copied preview card, text & link — paste into WhatsApp" />
 *
 * @example
 * <ProfileShareToast message="" />
 */
function ProfileShareToast({ message = '' }) {
    const visible = Boolean(message);
    return (
        <div data-testid="profile-share-toast" role="status" aria-live="polite"
             style={{ visibility: visible ? 'visible' : 'hidden', opacity: visible ? 1 : 0 }}
             className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] pointer-events-none px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap max-w-[92vw] truncate transition-opacity duration-150">
            <span className="text-emerald-600 shrink-0 inline-flex"><Icons.Check /></span>
            <span className="truncate">{message || 'Ready'}</span>
        </div>
    );
}
