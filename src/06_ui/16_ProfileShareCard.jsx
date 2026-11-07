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
 * Builds a `https://api.whatsapp.com/send?text=...` deep link that opens WhatsApp Web or the
 * native WhatsApp app pre-populated with `captionText`.
 *
 * @param {string} captionText - Formatted caption text including URL.
 * @returns {string} WhatsApp share URL.
 *
 * @example
 * buildWhatsAppDirectUrl('Hello Family Tree');
 * // => 'https://api.whatsapp.com/send?text=Hello%20Family%20Tree'
 *
 * @example
 * buildWhatsAppDirectUrl('');
 * // => 'https://api.whatsapp.com/send?text='
 */
function buildWhatsAppDirectUrl(captionText) {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(String(captionText || ''))}`;
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
 * Converts a rendered `<canvas>` element into a PNG `Blob`.
 *
 * @param {HTMLCanvasElement|null} canvas - Source canvas element.
 * @returns {Promise<Blob|null>} Resolved PNG blob, or `null` if unavailable.
 *
 * @example
 * const blob = await canvasToPngBlob(canvas);
 *
 * @example
 * await canvasToPngBlob(null); // => null
 */
function canvasToPngBlob(canvas) {
    if (!canvas || typeof canvas.toBlob !== 'function') return Promise.resolve(null);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob || null), 'image/png');
    });
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
        if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
        const probe = new window.File([pngBlob], 'family-tree-card.png', { type: 'image/png' });
        return Boolean(navigator.canShare({ files: [probe] }));
    } catch (err) {
        return false;
    }
}

/**
 * Copies plain text to the system clipboard with a hidden `<textarea>` fallback.
 *
 * @param {string} text - Text to copy.
 * @returns {Promise<boolean>} True if copying succeeded.
 *
 * @example
 * await copyTextToSystemClipboard('https://google.github.io/family-tree/?d');
 *
 * @example
 * await copyTextToSystemClipboard('');
 */
async function copyTextToSystemClipboard(text) {
    if (!text) return false;
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
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
 * @returns {Promise<boolean>} True when the image blob was written to the clipboard.
 *
 * @example
 * await copyClipboardPngBlob(pngBlob, '🌳 *Anto*\nhttps://google.github.io/family-tree/?d#abc');
 *
 * @example
 * await copyClipboardPngBlob(null); // => false
 */
async function copyClipboardPngBlob(pngBlob, captionText = '') {
    if (!pngBlob || typeof navigator === 'undefined' || !navigator.clipboard?.write) return false;
    if (typeof window === 'undefined' || !window.ClipboardItem) return false;
    if (captionText && window.Blob) {
        try {
            const textBlob = new window.Blob([captionText], { type: 'text/plain' });
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob, 'text/plain': textBlob })]);
            return true;
        } catch (_) {}
    }
    try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob })]);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Generates and manages the preview image URL, PNG blob, document title sync, and share actions.
 *
 * @param {Object} params
 * @param {FamilyTree} params.tree - Active family tree model.
 * @param {string} [params.sheetUrl=''] - Active Google Sheets URL.
 * @param {string|null} [params.focusId=null] - Active focused person ID for `document.title` sync.
 * @returns {Object} Share modal state and action callbacks.
 *
 * @example
 * const share = useProfileShareController({ tree, sheetUrl, focusId: 'Anto_1955_22' });
 * share.openShareForPerson(tree.get('Anto_1955_22'));
 *
 * @example
 * const { isOpen, closeShareModal } = useProfileShareController({ tree: new FamilyTree(), sheetUrl: '' });
 */
function useProfileShareController({ tree, sheetUrl = '', focusId = null }) {
    useDocumentTitleSync(focusId && tree ? tree.get(focusId) : null);
    const [sharePersonId, setSharePersonId] = useState(null);
    const [cardAsset, setCardAsset] = useState({ dataUrl: '', blob: null });
    const [statusMsg, setStatusMsg] = useState('');
    const sharePerson = sharePersonId && tree ? tree.get(sharePersonId) : null;
    const snapshot = useMemo(() => extractImmediateFamilySnapshot(sharePerson, tree, sheetUrl), [sharePerson, tree, sheetUrl]);
    const shareUrl = useMemo(() => (sharePerson ? buildPersonShareUrl({ person: sharePerson, tree, sheetUrl }) : ''), [sharePerson, tree, sheetUrl]);
    const caption = useMemo(() => buildWhatsAppShareCaption(snapshot, shareUrl), [snapshot, shareUrl]);

    useEffect(() => {
        let cancelled = false;
        setStatusMsg('');
        if (!snapshot) { setCardAsset({ dataUrl: '', blob: null }); return undefined; }
        const canvas = renderProfileShareCardCanvas(snapshot);
        const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
        setCardAsset({ dataUrl, blob: null });
        canvasToPngBlob(canvas).then((blob) => { if (!cancelled) setCardAsset({ dataUrl, blob }); });
        return () => { cancelled = true; };
    }, [snapshot]);

    const actions = useProfileShareActions({ snapshot, caption, cardAsset, setStatusMsg });
    return {
        isOpen: Boolean(sharePerson && snapshot), snapshot, shareUrl, caption,
        whatsappUrl: buildWhatsAppDirectUrl(caption), previewDataUrl: cardAsset.dataUrl,
        canNativeFileShare: canBrowserNativeShareFiles(cardAsset.blob), statusMsg,
        openShareForPerson: useCallback((p) => { if (p?.id) setSharePersonId(p.id); }, []),
        closeShareModal: useCallback(() => setSharePersonId(null), []),
        ...actions
    };
}

/**
 * Action handlers for native OS file sharing, clipboard image/caption copying, and PNG download.
 *
 * @param {Object} params
 * @param {Object|null} params.snapshot - Immediate-family snapshot.
 * @param {string} params.caption - Formatted WhatsApp caption with link.
 * @param {{ dataUrl: string, blob: Blob|null }} params.cardAsset - Pre-rendered card image asset.
 * @param {Function} params.setStatusMsg - Feedback banner message setter.
 * @returns {{ handleNativeShare: Function, handleCopyImage: Function, handleCopyCaption: Function, handleDownloadPng: Function }}
 *
 * @example
 * const actions = useProfileShareActions({ snapshot, caption: 'text', cardAsset: { dataUrl: '', blob: null }, setStatusMsg: () => {} });
 *
 * @example
 * actions.handleCopyCaption();
 */
function useProfileShareActions({ snapshot, caption, cardAsset, setStatusMsg }) {
    const handleNativeShare = useCallback(async () => {
        if (!snapshot || !cardAsset.blob || typeof window === 'undefined' || !window.File) return;
        const safeSlug = snapshot.name.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Profile';
        const file = new window.File([cardAsset.blob], `${safeSlug}_Family_Tree.png`, { type: 'image/png' });
        copyTextToSystemClipboard(caption);
        try {
            await navigator.share({ files: [file], title: `${snapshot.name} — Family Tree`, text: caption });
            setStatusMsg('Shared! (Caption + link also copied to clipboard)');
        } catch (err) {
            if (err && err.name !== 'AbortError') setStatusMsg('Link copied — paste directly into WhatsApp');
        }
    }, [snapshot, cardAsset.blob, caption, setStatusMsg]);

    const handleCopyImage = useCallback(async () => {
        if (await copyClipboardPngBlob(cardAsset.blob, caption)) {
            setStatusMsg('Copied! Press Ctrl+V / ⌘V in WhatsApp (and Ctrl+V again for caption & link)');
            return;
        }
        await copyTextToSystemClipboard(caption);
        setStatusMsg('Caption & link copied to clipboard!');
    }, [cardAsset.blob, caption, setStatusMsg]);

    const handleCopyCaption = useCallback(async () => {
        const ok = await copyTextToSystemClipboard(caption);
        setStatusMsg(ok ? 'Caption & short link copied — paste into WhatsApp!' : 'Unable to access clipboard');
    }, [caption, setStatusMsg]);

    const handleDownloadPng = useCallback(() => {
        if (!snapshot || !cardAsset.blob) return;
        const safeSlug = snapshot.name.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Profile';
        ExportUtils.triggerDownload(cardAsset.blob, `${safeSlug}_Family_Tree.png`);
        setStatusMsg('Saved preview card PNG!');
    }, [snapshot, cardAsset.blob, setStatusMsg]);

    return { handleNativeShare, handleCopyImage, handleCopyCaption, handleDownloadPng };
}

/**
 * Compact Share button rendered in the person details header and on the mobile Peek bar.
 *
 * @param {Object} props
 * @param {Person|null} props.person - Person profile to share.
 * @param {Function} [props.onShare] - Callback invoked with `person`.
 * @param {boolean} [props.compact=false] - Compact style for the mobile Peek bar.
 * @returns {React.ReactNode|null}
 *
 * @example
 * <SidebarShareButton person={focusPerson} onShare={openShareForPerson} />
 *
 * @example
 * <SidebarShareButton person={focusPerson} onShare={openShareForPerson} compact={true} />
 */
function SidebarShareButton({ person, onShare, compact = false }) {
    if (!person || person._isUnknown || typeof onShare !== 'function') return null;
    if (compact) {
        return (
            <button type="button" data-testid="share-person-peek-btn" onClick={() => onShare(person)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer leading-none inline-flex items-center gap-1 interactive-element"
                    title={`Share ${person.name} to WhatsApp`} aria-label={`Share ${person.name}`}>
                <Icons.Share />
                <span>Share</span>
            </button>
        );
    }
    return (
        <button type="button" data-testid="share-person-btn" onClick={() => onShare(person)}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs transition-colors cursor-pointer interactive-element"
                title={`Share ${person.name} with preview card to WhatsApp`} aria-label={`Share ${person.name}`}>
            <Icons.Share />
            <span>Share</span>
        </button>
    );
}

/**
 * Action button cluster inside `ProfileShareModal` adapting to mobile native file-share vs.
 * desktop WhatsApp Web clipboard/deep-link workflows.
 *
 * @param {Object} props
 * @returns {React.ReactNode}
 *
 * @example
 * <ProfileShareActionButtons canNativeFileShare={true} whatsappUrl="https://api.whatsapp.com/send?text=hi" handleNativeShare={() => {}} handleCopyImage={() => {}} handleCopyCaption={() => {}} handleDownloadPng={() => {}} />
 *
 * @example
 * <ProfileShareActionButtons canNativeFileShare={false} whatsappUrl="https://api.whatsapp.com/send?text=hi" handleNativeShare={() => {}} handleCopyImage={() => {}} handleCopyCaption={() => {}} handleDownloadPng={() => {}} />
 */
function ProfileShareActionButtons({
    canNativeFileShare, whatsappUrl, handleNativeShare, handleCopyImage, handleCopyCaption, handleDownloadPng
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {canNativeFileShare ? (
                <button type="button" data-testid="share-native-btn" onClick={handleNativeShare}
                        className="sm:col-span-2 w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Icons.WhatsApp />
                    <span>Share Preview Card &amp; Link…</span>
                </button>
            ) : (
                <button type="button" data-testid="share-copy-image-btn" onClick={handleCopyImage}
                        className="w-full py-2.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Icons.Copy />
                    <span>Copy Preview Card Image</span>
                </button>
            )}
            <a data-testid="share-whatsapp-link" href={whatsappUrl} target="_blank" rel="noopener noreferrer"
               className="w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 border border-slate-200 flex items-center justify-center gap-2 transition-colors">
                <Icons.WhatsApp />
                <span>Open Text &amp; Link in WhatsApp</span>
            </a>
            <button type="button" data-testid="share-copy-caption-btn" onClick={handleCopyCaption}
                    className="w-full py-2 px-3.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <Icons.Link />
                <span>Copy Caption &amp; Short Link</span>
            </button>
            <button type="button" data-testid="share-download-png-btn" onClick={handleDownloadPng}
                    className={`${canNativeFileShare ? 'sm:col-span-2' : ''} w-full py-2 px-3.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors`}>
                <Icons.Download />
                <span>Download Card PNG</span>
            </button>
        </div>
    );
}

/**
 * Header bar for `ProfileShareModal` displaying the person title and Escape/click dismiss button.
 *
 * @param {Object} props
 * @param {string} props.personName - Name of the profile being shared.
 * @param {Function} [props.onClose] - Callback to dismiss the modal.
 * @returns {React.ReactNode}
 *
 * @example
 * <ProfileShareModalHeader personName="Anto" onClose={closeShareModal} />
 *
 * @example
 * <ProfileShareModalHeader personName="Regina" />
 */
function ProfileShareModalHeader({ personName, onClose }) {
    return (
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 truncate">
                <Icons.Share />
                <span className="truncate">Share {personName} to WhatsApp</span>
            </div>
            <button type="button" data-testid="close-share-modal" onClick={onClose} aria-label="Dismiss share dialog"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors">
                <Icons.Close />
            </button>
        </div>
    );
}

/**
 * Modal dialog displaying the generated `1200x630` person + immediate-family preview card,
 * formatted WhatsApp caption, and 1-tap share/copy actions.
 *
 * @param {Object} props
 * @returns {React.ReactNode|null}
 *
 * @example
 * <ProfileShareModal isOpen={true} snapshot={snapshot} caption={caption} whatsappUrl={url} previewDataUrl={dataUrl} closeShareModal={() => {}} />
 *
 * @example
 * <ProfileShareModal isOpen={false} />
 */
function ProfileShareModal(props) {
    const { isOpen, snapshot, caption, previewDataUrl, statusMsg, closeShareModal } = props;
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeShareModal?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, closeShareModal]);

    if (!isOpen || !snapshot) return null;
    return (
        <div data-testid="profile-share-modal" role="dialog" aria-modal="true" aria-label={`Share ${snapshot.name}`}
             onClick={closeShareModal}
             className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 interactive-element">
            <div onClick={(e) => e.stopPropagation()}
                 className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
                <ProfileShareModalHeader personName={snapshot.name} onClose={closeShareModal} />
                <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[1200/630] w-full shadow-md">
                        {previewDataUrl && <img data-testid="profile-share-preview-img" src={previewDataUrl} alt={`${snapshot.name} family preview card`} className="w-full h-full object-cover block" />}
                    </div>
                    <pre data-testid="profile-share-caption" className="text-xs font-sans whitespace-pre-wrap break-all bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 leading-relaxed m-0">{caption}</pre>
                    <div data-testid="profile-share-status" style={{ visibility: statusMsg ? 'visible' : 'hidden', opacity: statusMsg ? 1 : 0 }}
                         className="min-h-[20px] text-xs font-semibold text-emerald-700 text-center transition-opacity">
                        {statusMsg || 'Ready to share'}
                    </div>
                    <ProfileShareActionButtons {...props} />
                </div>
            </div>
        </div>
    );
}
