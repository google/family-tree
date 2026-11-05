// ============================================================================
// MODULE 6.12: SHAREABLE URL VIEW STATE (Ultra-short bit-packed #hash links)
// ============================================================================
//
// Every meaningful UI action is mirrored into an ultra-short Base64url `#hash`
// packet (with full backward-compatibility parsing for legacy `#p=...&z=...`
// URLs) so the address bar reproduces the exact view in ~6 to 10 characters:
//
//   https://google.github.io/family-tree/?1SvPspyHtIV2E9UHwpZON8sUTf3FxIuqJZO-wx0WPl3k#e4K10p890
//   https://google.github.io/family-tree/?d#o4K10G           (Demo sheet, focused person at z=0.8)
//   https://google.github.io/family-tree/?d#2                (Demo sheet, world map)
//
// Packet layout (`#<bitPacket>[.<filterSuffix>]`):
//   • 6-bit header: [hasFocus, sidebarClosed, hasZoom, hasOffset, showMap, hasExtra]
//     (when `hasExtra=1`, 2 extra bits follow: [hasExplicitAnchor, hasCollapsed])
//   • 26-bit person fingerprint: `(isGhost<<25) | (nameHash11<<14) | (yobTag4<<10) | row10`
//   • Variable-width zoom (`1` bit for default `z=0.8`, else 10 or 14 bits)
//   • ZigZag-encoded anchor-relative offset (`<dx tree px>, <dy*10 years>`, 21 to 33 bits)
//   • Collapsed branches with sibling bus-bar parent-group compression (`^@xxxxx`)
//   • Optional `.` filter suffix (`p<place>`, `j<job>`, `f<family>`, `s<search>`, `dp`/`dj`/`df`)
//
// Resilience to spreadsheet edits: the camera is stored relative to an anchor
// card in tree pixels + calendar years, and 26-bit person fingerprints resolve
// in 3 tiers (exact 26-bit match -> same name hash + birth-year tag + nearest
// row -> same name hash + nearest row within 64 rows), surviving inserted rows,
// namesakes, and corrected birth years.

/** Debounce applied before mirroring UI state into the URL hash. */
const VIEW_STATE_WRITE_DEBOUNCE_MS = 300;
/** Delay after dataset readiness before restoring focus/filter/map from the hash. */
const VIEW_STATE_SELECTION_DELAY_MS = 350;
/** Delay after dataset readiness before restoring camera zoom/anchor offset from the hash. */
const VIEW_STATE_CAMERA_DELAY_MS = 1000;
/** Extra delays after the camera phase at which the anchor is re-measured on the re-flowed layout. */
const VIEW_STATE_CAMERA_REFINE_DELAYS_MS = [150, 450, 750];
/** Minimum length for a `_sourceId` to be treated as a spreadsheet ID worth compacting. */
const VIEW_STATE_MIN_SHEET_ID_LENGTH = 20;
/** URL-safe 64-character alphabet (6 bits per char, no `.` or `=` so separators stay unambiguous). */
const VIEW_STATE_B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
/** In-memory prefix marking a parsed 26-bit compact person reference (`@xxxxx`). */
const VIEW_STATE_PERSON_REF_PREFIX = '@';
/** In-memory prefix marking a collapsed sibling-bar parent group reference (`^@xxxxx`). */
const VIEW_STATE_GROUP_REF_PREFIX = '^';

/**
 * Formats a number compactly for URL use by rounding to a fixed number of decimals
 * and dropping trailing zeros (so `0.80` becomes `0.8` and `1953.0` becomes `1953`).
 *
 * @param {number} value - Number to format.
 * @param {number} [decimals=2] - Maximum number of decimal places to keep.
 * @returns {string} Compact decimal string, or `'0'` for non-finite input.
 *
 * @example
 * formatCompactNumber(0.8000001, 2);
 * // => '0.8'
 *
 * @example
 * formatCompactNumber(12.46, 1);
 * // => '12.5'
 */
function formatCompactNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return '0';
    return String(Number(value.toFixed(decimals)));
}

/**
 * Percent-encodes a hash token so person IDs and filter values can never collide with the
 * `&`, `=`, `:` and `,` separators, while keeping spaces readable as `+`.
 *
 * @param {string} text - Raw token text.
 * @returns {string} URL-safe token.
 *
 * @example
 * encodeViewStateToken('Joseph_1920_152');
 * // => 'Joseph_1920_152'
 *
 * @example
 * encodeViewStateToken('New York, USA');
 * // => 'New+York%2C+USA'
 */
function encodeViewStateToken(text) {
    return encodeURIComponent(String(text)).replace(/%20/g, '+');
}

/**
 * Decodes a hash token produced by encodeViewStateToken, tolerating malformed percent
 * sequences typed by hand (they are returned verbatim instead of throwing).
 *
 * @param {string} text - Encoded token text.
 * @returns {string} Decoded token.
 *
 * @example
 * decodeViewStateToken('New+York%2C+USA');
 * // => 'New York, USA'
 *
 * @example
 * decodeViewStateToken('100%');
 * // => '100%'
 */
function decodeViewStateToken(text) {
    const spaced = String(text).replace(/\+/g, '%20');
    try {
        return decodeURIComponent(spaced);
    } catch (err) {
        return String(text);
    }
}

/**
 * Collects the distinct spreadsheet IDs referenced by the people of a tree, sorted so both the
 * encoder and the decoder derive the same `~N` abbreviation for each sheet.
 *
 * @param {FamilyTree|null} tree - Loaded tree (uses each person's `_sourceId`).
 * @returns {Array<string>} Sorted spreadsheet IDs (short synthetic source IDs are ignored).
 *
 * @example
 * collectViewStateSheetIds(tree);
 * // => ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']
 *
 * @example
 * collectViewStateSheetIds({ all: [{ id: 'Mary_1924_7', _sourceId: 's1' }] });
 * // => []
 */
function collectViewStateSheetIds(tree) {
    const ids = new Set();
    ((tree && tree.all) || []).forEach((person) => {
        const sourceId = person && person._sourceId;
        if (typeof sourceId === 'string' && sourceId.length >= VIEW_STATE_MIN_SHEET_ID_LENGTH) ids.add(sourceId);
    });
    return Array.from(ids).sort();
}

/**
 * Replaces every full spreadsheet ID inside a person ID with its `~N` abbreviation so ghost IDs
 * (which embed their source sheet) stay short and sheet-underscore-safe.
 *
 * @param {string} text - Person ID or ID list.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs from collectViewStateSheetIds.
 * @returns {string} Compacted text.
 *
 * @example
 * compactViewStateSheetIds('ghost_George_Daughter_1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']);
 * // => 'ghost_George_Daughter_~1_642'
 *
 * @example
 * compactViewStateSheetIds('Joseph_1920_152', []);
 * // => 'Joseph_1920_152'
 */
function compactViewStateSheetIds(text, sheetIds) {
    return (sheetIds || []).reduce((acc, sheetId, index) => acc.split(sheetId).join(`~${index}`), String(text));
}

/**
 * Inverse of compactViewStateSheetIds: expands `~N` abbreviations back into full spreadsheet IDs.
 * Unknown indexes are left untouched so hand-edited URLs degrade gracefully.
 *
 * @param {string} text - Compacted person ID.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs from collectViewStateSheetIds.
 * @returns {string} Expanded text.
 *
 * @example
 * expandViewStateSheetIds('ghost_George_Daughter_~1_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI', '1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs']);
 * // => 'ghost_George_Daughter_1o11yWxLZJjXJzlFvmn13z00OQ5dvYISvxnTmo6DThUs_642'
 *
 * @example
 * expandViewStateSheetIds('ghost_George_Daughter_~7_642', ['1ZDpcz2ACmG63dUjHLfoHZSW7-dG51FbzaJVcqHYdkEI']);
 * // => 'ghost_George_Daughter_~7_642'
 */
function expandViewStateSheetIds(text, sheetIds) {
    return String(text).replace(/~(\d+)/g, (match, index) => (sheetIds && sheetIds[Number(index)]) || match);
}

/**
 * Appends `width` bits of a non-negative integer (`width <= 26`) MSB-first onto a bit array.
 *
 * @param {Array<number>} bits - Mutable bit array (`0` or `1` entries).
 * @param {number} value - Non-negative integer to append.
 * @param {number} width - Number of bits to emit.
 * @returns {Array<number>} The same `bits` array for chaining.
 *
 * @example
 * pushViewStateBits([], 5, 4);
 * // => [0, 1, 0, 1]
 *
 * @example
 * pushViewStateBits([1], 2, 2);
 * // => [1, 1, 0]
 */
function pushViewStateBits(bits, value, width) {
    const clean = Math.max(0, Math.trunc(value));
    for (let shift = width - 1; shift >= 0; shift--) {
        bits.push((clean >>> shift) & 1);
    }
    return bits;
}

/**
 * Reads `width` bits MSB-first from a bit cursor, returning `null` if fewer than `width` bits remain.
 *
 * @param {{bits: Array<number>, pos: number}|null} cursor - Bit reader cursor.
 * @param {number} width - Number of bits to consume.
 * @returns {number|null} Unsigned integer value, or `null` on underflow.
 *
 * @example
 * readViewStateBits({ bits: [0, 1, 0, 1], pos: 0 }, 4);
 * // => 5
 *
 * @example
 * readViewStateBits({ bits: [1, 0], pos: 0 }, 4);
 * // => null
 */
function readViewStateBits(cursor, width) {
    if (!cursor || cursor.pos + width > cursor.bits.length) return null;
    let value = 0;
    for (let i = 0; i < width; i++) {
        value = value * 2 + cursor.bits[cursor.pos++];
    }
    return value;
}

/**
 * Packs a bit array into Base64url characters (6 bits per character, zero-padded on the right).
 *
 * @param {Array<number>} bits - Bit stream (`0` or `1` per element).
 * @returns {string} Compact URL-safe token.
 *
 * @example
 * packBitsToBase64Url([0, 0, 0, 0, 1, 0]);
 * // => '2'
 *
 * @example
 * packBitsToBase64Url([]);
 * // => ''
 */
function packBitsToBase64Url(bits) {
    if (!bits || bits.length === 0) return '';
    let out = '';
    for (let i = 0; i < bits.length; i += 6) {
        let chunk = 0;
        for (let b = 0; b < 6; b++) {
            chunk = (chunk << 1) | (bits[i + b] || 0);
        }
        out += VIEW_STATE_B64[chunk];
    }
    return out;
}

/**
 * Unpacks a Base64url packet back into a bit cursor, returning `null` if any character lies
 * outside `VIEW_STATE_B64`.
 *
 * @param {string} text - Base64url string.
 * @returns {{bits: Array<number>, pos: number}|null} Bit cursor, or `null` when invalid.
 *
 * @example
 * unpackBase64UrlToBits('2');
 * // => { bits: [0, 0, 0, 0, 1, 0], pos: 0 }
 *
 * @example
 * unpackBase64UrlToBits('bad=char');
 * // => null
 */
function unpackBase64UrlToBits(text) {
    const bits = [];
    for (let i = 0; i < text.length; i++) {
        const idx = VIEW_STATE_B64.indexOf(text[i]);
        if (idx < 0) return null;
        pushViewStateBits(bits, idx, 6);
    }
    return { bits, pos: 0 };
}

/**
 * Encodes a non-negative integer into a fixed-width Base64url string.
 *
 * @param {number} value - Non-negative integer.
 * @param {number} length - Number of Base64url characters to emit.
 * @returns {string} Fixed-length Base64url string.
 *
 * @example
 * encodeFixedBase64Url(65, 2);
 * // => '11'
 *
 * @example
 * encodeFixedBase64Url(0, 5);
 * // => '00000'
 */
function encodeFixedBase64Url(value, length) {
    let rem = Math.max(0, Math.trunc(value));
    let out = '';
    for (let i = 0; i < length; i++) {
        out = VIEW_STATE_B64[rem & 63] + out;
        rem = Math.floor(rem / 64);
    }
    return out;
}

/**
 * Decodes a Base64url integer produced by `encodeFixedBase64Url`, returning `null` on invalid input.
 *
 * @param {string} token - Base64url integer token.
 * @returns {number|null} Decoded non-negative integer, or `null`.
 *
 * @example
 * decodeFixedBase64Url('11');
 * // => 65
 *
 * @example
 * decodeFixedBase64Url('!bad');
 * // => null
 */
function decodeFixedBase64Url(token) {
    if (!token) return null;
    let value = 0;
    for (let i = 0; i < token.length; i++) {
        const idx = VIEW_STATE_B64.indexOf(token[i]);
        if (idx < 0) return null;
        value = value * 64 + idx;
    }
    return value;
}

/**
 * ZigZag-maps a signed integer onto non-negative integers (`0 -> 0, -1 -> 1, 1 -> 2, -2 -> 3`)
 * so small positive and negative camera offsets fit in narrow bit fields.
 *
 * @param {number} value - Signed integer.
 * @returns {number} Non-negative ZigZag integer.
 *
 * @example
 * zigZagEncodeInt(-26);
 * // => 51
 *
 * @example
 * zigZagEncodeInt(164);
 * // => 328
 */
function zigZagEncodeInt(value) {
    const n = Math.trunc(value);
    return n >= 0 ? n * 2 : (-n) * 2 - 1;
}

/**
 * Inverse of `zigZagEncodeInt`: restores the signed integer from a ZigZag-encoded value.
 *
 * @param {number} encoded - Non-negative ZigZag integer.
 * @returns {number} Signed integer.
 *
 * @example
 * zigZagDecodeInt(51);
 * // => -26
 *
 * @example
 * zigZagDecodeInt(328);
 * // => 164
 */
function zigZagDecodeInt(encoded) {
    return (encoded & 1) === 0 ? encoded / 2 : -((encoded + 1) / 2);
}

/**
 * Computes an 11-bit case-insensitive FNV-1a XOR-folded fingerprint of a person's name stem.
 *
 * @param {string} name - Clean person name stem (without `ghost_`, birth year, or row).
 * @returns {number} Unsigned 11-bit hash (`0..2047`).
 *
 * @example
 * hashPersonName11('Joseph') === hashPersonName11('joseph');
 * // => true
 *
 * @example
 * hashPersonName11('Joseph') !== hashPersonName11('Joseph_Son');
 * // => true
 */
function hashPersonName11(name) {
    const lower = String(name || '').toLowerCase();
    let h = 0x811c9dc5;
    for (let i = 0; i < lower.length; i++) {
        h ^= lower.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    const u = h >>> 0;
    return ((u >>> 21) ^ (u >>> 10) ^ u) & 0x7ff;
}

/**
 * Encodes a person ID (or an already-parsed `@xxxxx` compact token) into a 26-bit fingerprint:
 * `(isGhost << 25) | (nameHash11 << 14) | (yobTag4 << 10) | row10`.
 *
 * @param {string} personId - Full person ID or `@xxxxx` compact token.
 * @param {Array<string>} [sheetIds=[]] - Sorted spreadsheet IDs from `collectViewStateSheetIds`.
 * @returns {number|null} Unsigned 26-bit code, or `null` when malformed.
 *
 * @example
 * Number.isInteger(encodePersonCode26('Anto_1955_166'));
 * // => true
 *
 * @example
 * encodePersonCode26('');
 * // => null
 */
function encodePersonCode26(personId, sheetIds = []) {
    const raw = String(personId || '').replace(/^\^/, '');
    if (raw.startsWith(VIEW_STATE_PERSON_REF_PREFIX)) {
        const parsed = decodeFixedBase64Url(raw.slice(1));
        return parsed !== null ? (parsed & 0x03ffffff) : null;
    }
    const ref = parseViewStatePersonRef(compactViewStateSheetIds(raw, sheetIds));
    if (!ref || !ref.nameStem) return null;
    const isGhost = ref.nameStem.startsWith('ghost_') ? 1 : 0;
    const cleanName = isGhost ? ref.nameStem.slice(6) : ref.nameStem;
    const nameHash = hashPersonName11(cleanName);
    const yobTag = /^\d{3,4}$/.test(ref.midToken) ? ((((parseInt(ref.midToken, 10) % 15) + 15) % 15) + 1) : 0;
    const row10 = ref.row !== null && ref.row >= 0 ? Math.min(1022, ref.row) : 1023;
    return ((isGhost << 25) | (nameHash << 14) | (yobTag << 10) | row10) >>> 0;
}

/**
 * Unpacks a 26-bit person fingerprint into its `(isGhost, nameHash, yobTag, row)` fields.
 *
 * @param {number} code - Unsigned 26-bit person code.
 * @returns {{code: number, isGhost: number, nameHash: number, yobTag: number, row: number}}
 *
 * @example
 * decodePersonCode26(encodePersonCode26('Anto_1955_166')).row;
 * // => 166
 *
 * @example
 * decodePersonCode26(encodePersonCode26('ghost_Paul_Wife_~0_88')).isGhost;
 * // => 1
 */
function decodePersonCode26(code) {
    return {
        code,
        isGhost: (code >>> 25) & 1,
        nameHash: (code >>> 14) & 0x7ff,
        yobTag: (code >>> 10) & 0x0f,
        row: code & 0x3ff
    };
}

/**
 * Formats a 26-bit person code into the in-memory `@xxxxx` compact reference token.
 *
 * @param {number} code - Unsigned 26-bit person code.
 * @returns {string} 6-character `@xxxxx` token.
 *
 * @example
 * formatCompactPersonRef(0);
 * // => '@00000'
 *
 * @example
 * encodePersonCode26(formatCompactPersonRef(123456));
 * // => 123456
 */
function formatCompactPersonRef(code) {
    return `${VIEW_STATE_PERSON_REF_PREFIX}${encodeFixedBase64Url(code, 5)}`;
}

/**
 * Lists the direct child IDs of a person in `tree`, supporting both `Person` instances and
 * plain stub objects in unit tests.
 *
 * @param {FamilyTree|null} tree - Loaded tree.
 * @param {Object|null} person - Person node.
 * @returns {Array<string>} Direct child IDs present in `tree`.
 *
 * @example
 * getPersonDirectChildIds(tree, tree.get('Anto_1955_166'));
 * // => ['Rupak_1984_168', 'Innez_1989_170']
 *
 * @example
 * getPersonDirectChildIds(null, null);
 * // => []
 */
function getPersonDirectChildIds(tree, person) {
    if (!person || !tree) return [];
    if (typeof person.getValidDisplayChildren === 'function') {
        return person.getValidDisplayChildren(tree).map((child) => child.id);
    }
    return (person.children || []).filter((id) => Boolean(tree.get(id)));
}

/**
 * Whether a person's family unit lays out at least one child (the exact predicate for showing a
 * `+/-` collapse button and participating in a foldable sibling bus-bar).
 *
 * @param {FamilyTree|null} tree - Loaded tree.
 * @param {Object|null} person - Candidate person node.
 * @returns {boolean} True when collapsing `person` hides at least one child branch.
 *
 * @example
 * isFoldableBranchPerson(tree, parentPerson);
 * // => true
 *
 * @example
 * isFoldableBranchPerson(tree, childlessLeafPerson);
 * // => false
 */
function isFoldableBranchPerson(tree, person) {
    if (!person || !tree) return false;
    if (getPersonDirectChildIds(tree, person).length > 0) return true;
    return (person.partners || []).some((pid) => getPersonDirectChildIds(tree, tree.get(pid)).length > 0);
}

/**
 * Returns the IDs of all foldable children of `parent` (the exact set toggled when clicking
 * `parent`'s horizontal sibling bus-bar).
 *
 * @param {FamilyTree|null} tree - Loaded tree.
 * @param {Object|null} parent - Parent person node.
 * @returns {Array<string>} Foldable child IDs.
 *
 * @example
 * getFoldableChildIdsOfParent(tree, chackoPerson);
 * // => ['Baby_1952_164', 'Anto_1955_166', 'Jose_1949_162']
 *
 * @example
 * getFoldableChildIdsOfParent(tree, null);
 * // => []
 */
function getFoldableChildIdsOfParent(tree, parent) {
    return getPersonDirectChildIds(tree, parent).filter((cid) => isFoldableBranchPerson(tree, tree.get(cid)));
}

/**
 * Collects all parents in `tree` with `>= 2` foldable children, ordered concrete-parents-first
 * and largest sibling sets first so bus-bar folds compress greedily into single 27-bit entries.
 *
 * @param {FamilyTree|null} tree - Loaded tree.
 * @returns {Array<{person: Object, foldable: Array<string>}>}
 *
 * @example
 * collectCollapsibleParentGroups(tree).every((g) => g.foldable.length >= 2);
 * // => true
 *
 * @example
 * collectCollapsibleParentGroups(null);
 * // => []
 */
function collectCollapsibleParentGroups(tree) {
    if (!tree || !Array.isArray(tree.all)) return [];
    const groups = [];
    for (const person of tree.all) {
        if (!person || typeof person.id !== 'string') continue;
        const foldable = getFoldableChildIdsOfParent(tree, person);
        if (foldable.length >= 2) groups.push({ person, foldable });
    }
    groups.sort((a, b) => (Number(Boolean(a.person.isGhost)) - Number(Boolean(b.person.isGhost)))
        || (b.foldable.length - a.foldable.length));
    return groups;
}

/**
 * Compresses collapsed branch IDs into `{isGroup, code}` bit entries, folding full sibling
 * bus-bar child sets into a single `{isGroup: 1, code: parentCode}` entry when `tree` is supplied.
 *
 * @param {Array<string>} collapsedIds - Collapsed IDs (or `^@xxxxx` group tokens).
 * @param {FamilyTree|null} tree - Loaded tree (optional).
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs.
 * @returns {Array<{isGroup: number, code: number}>}
 *
 * @example
 * encodeCollapsedEntries(['Elsy_1935_13'], null, []);
 * // => [{ isGroup: 0, code: encodePersonCode26('Elsy_1935_13') }]
 *
 * @example
 * encodeCollapsedEntries([], null, []);
 * // => []
 */
function encodeCollapsedEntries(collapsedIds, tree, sheetIds) {
    if (!Array.isArray(collapsedIds) || collapsedIds.length === 0) return [];
    const remaining = new Set(collapsedIds.filter(Boolean));
    const entries = [];
    for (const id of Array.from(remaining)) {
        if (String(id).startsWith(VIEW_STATE_GROUP_REF_PREFIX)) {
            const code = encodePersonCode26(String(id).slice(1), sheetIds);
            if (code !== null) entries.push({ isGroup: 1, code });
            remaining.delete(id);
        }
    }
    for (const { person, foldable } of collectCollapsibleParentGroups(tree)) {
        if (!foldable.every((cid) => remaining.has(cid))) continue;
        const code = encodePersonCode26(person.id, sheetIds);
        if (code === null) continue;
        entries.push({ isGroup: 1, code });
        foldable.forEach((cid) => remaining.delete(cid));
    }
    for (const id of remaining) {
        const code = encodePersonCode26(id, sheetIds);
        if (code !== null) entries.push({ isGroup: 0, code });
    }
    return entries.slice(0, 1024);
}

/**
 * Appends a prefix-free variable-width zoom code (`1` for the standard `0.8` reading zoom,
 * `00` + 8-bit `z*100` up to `2.55`, or `01` + 12-bit `z*100` up to `40.95`).
 *
 * @param {Array<number>} bits - Target bit buffer.
 * @param {number} zoom - Positive zoom level.
 * @returns {Array<number>} The same `bits` buffer.
 *
 * @example
 * writeZoomBits([], 0.8);
 * // => [1]
 *
 * @example
 * writeZoomBits([], 0.12).length;
 * // => 10
 */
function writeZoomBits(bits, zoom) {
    const z100 = Math.max(1, Math.min(4095, Math.round(zoom * 100)));
    if (z100 === 80) return pushViewStateBits(bits, 1, 1);
    if (z100 <= 255) {
        pushViewStateBits(bits, 0, 2);
        return pushViewStateBits(bits, z100, 8);
    }
    pushViewStateBits(bits, 1, 2);
    return pushViewStateBits(bits, z100, 12);
}

/**
 * Reads a variable-width zoom level written by `writeZoomBits`.
 *
 * @param {{bits: Array<number>, pos: number}} cursor - Bit cursor.
 * @returns {number|null} Zoom level rounded to 2 decimals, or `null` when truncated/zero.
 *
 * @example
 * readZoomBits({ bits: writeZoomBits([], 0.8), pos: 0 });
 * // => 0.8
 *
 * @example
 * readZoomBits({ bits: writeZoomBits([], 1.25), pos: 0 });
 * // => 1.25
 */
function readZoomBits(cursor) {
    const isDefault = readViewStateBits(cursor, 1);
    if (isDefault === null) return null;
    if (isDefault === 1) return 0.8;
    const isWide = readViewStateBits(cursor, 1);
    if (isWide === null) return null;
    const z100 = readViewStateBits(cursor, isWide ? 12 : 8);
    if (z100 === null || z100 <= 0) return null;
    return Number((z100 / 100).toFixed(2));
}

/**
 * Rounds an anchor offset to integer tree pixels (`dx`) and tenths of a calendar year (`dy10`),
 * returning `null` when both round to `0` so centred views omit the offset field.
 *
 * @param {{dx: number, dy: number}|null|undefined} offset - Raw camera offset.
 * @returns {{dx: number, dy10: number}|null}
 *
 * @example
 * normalizeOffsetPair({ dx: 0.3, dy: -0.02 });
 * // => null
 *
 * @example
 * normalizeOffsetPair({ dx: -320.4, dy: 12.46 });
 * // => { dx: -320, dy10: 125 }
 */
function normalizeOffsetPair(offset) {
    if (!offset || !Number.isFinite(offset.dx) || !Number.isFinite(offset.dy)) return null;
    const dx = Math.max(-32767, Math.min(32767, Math.round(offset.dx)));
    const dy10 = Math.max(-16380, Math.min(16380, Math.round(offset.dy * 10)));
    if (dx === 0 && dy10 === 0) return null;
    return { dx, dy10 };
}

/**
 * Appends a ZigZag-encoded camera offset (`1+10` or `1+16` bits for `dx`, `1+9` or `1+15` bits
 * for `dy*10`).
 *
 * @param {Array<number>} bits - Target bit buffer.
 * @param {{dx: number, dy10: number}} pair - Normalized non-zero offset pair.
 * @returns {Array<number>} The same `bits` buffer.
 *
 * @example
 * writeOffsetBits([], { dx: 164, dy10: -26 }).length;
 * // => 21
 *
 * @example
 * writeOffsetBits([], { dx: 2500, dy10: 10 }).length;
 * // => 27
 */
function writeOffsetBits(bits, pair) {
    const zDx = zigZagEncodeInt(pair.dx);
    const zDy = zigZagEncodeInt(pair.dy10);
    pushViewStateBits(bits, zDx < 1024 ? 0 : 1, 1);
    pushViewStateBits(bits, zDx, zDx < 1024 ? 10 : 16);
    pushViewStateBits(bits, zDy < 512 ? 0 : 1, 1);
    return pushViewStateBits(bits, zDy, zDy < 512 ? 9 : 15);
}

/**
 * Reads a ZigZag-encoded camera offset written by `writeOffsetBits`.
 *
 * @param {{bits: Array<number>, pos: number}} cursor - Bit cursor.
 * @returns {{dx: number, dy: number}|null} Decoded `{dx, dy}`, or `null` when truncated.
 *
 * @example
 * readOffsetBits({ bits: writeOffsetBits([], { dx: 164, dy10: -26 }), pos: 0 });
 * // => { dx: 164, dy: -2.6 }
 *
 * @example
 * readOffsetBits({ bits: [0], pos: 0 });
 * // => null
 */
function readOffsetBits(cursor) {
    const dxWide = readViewStateBits(cursor, 1);
    if (dxWide === null) return null;
    const zDx = readViewStateBits(cursor, dxWide ? 16 : 10);
    const dyWide = readViewStateBits(cursor, 1);
    if (zDx === null || dyWide === null) return null;
    const zDy = readViewStateBits(cursor, dyWide ? 15 : 9);
    if (zDy === null) return null;
    return { dx: zigZagDecodeInt(zDx), dy: Number((zigZagDecodeInt(zDy) / 10).toFixed(1)) };
}

/**
 * Appends collapsed branch entries (`0` + 4-bit count up to 16, or `1` + 10-bit count up to 1024,
 * followed by 27 bits `[isGroup, code26]` per entry).
 *
 * @param {Array<number>} bits - Target bit buffer.
 * @param {Array<{isGroup: number, code: number}>} entries - Non-empty collapsed entry list.
 * @returns {Array<number>} The same `bits` buffer.
 *
 * @example
 * writeCollapsedBits([], [{ isGroup: 0, code: 42 }]).length;
 * // => 32
 *
 * @example
 * writeCollapsedBits([], [{ isGroup: 1, code: 42 }, { isGroup: 0, code: 99 }]).length;
 * // => 59
 */
function writeCollapsedBits(bits, entries) {
    const countMinusOne = entries.length - 1;
    const wide = countMinusOne >= 16 ? 1 : 0;
    pushViewStateBits(bits, wide, 1);
    pushViewStateBits(bits, countMinusOne, wide ? 10 : 4);
    for (const entry of entries) {
        pushViewStateBits(bits, entry.isGroup ? 1 : 0, 1);
        pushViewStateBits(bits, entry.code, 26);
    }
    return bits;
}

/**
 * Reads collapsed branch references written by `writeCollapsedBits` as `@xxxxx` / `^@xxxxx` tokens.
 *
 * @param {{bits: Array<number>, pos: number}} cursor - Bit cursor.
 * @returns {Array<string>|null} Compact person/group tokens, or `null` when truncated.
 *
 * @example
 * readCollapsedBits({ bits: writeCollapsedBits([], [{ isGroup: 1, code: 0 }]), pos: 0 });
 * // => ['^@00000']
 *
 * @example
 * readCollapsedBits({ bits: [0, 0], pos: 0 });
 * // => null
 */
function readCollapsedBits(cursor) {
    const wide = readViewStateBits(cursor, 1);
    if (wide === null) return null;
    const rawCount = readViewStateBits(cursor, wide ? 10 : 4);
    if (rawCount === null) return null;
    const count = rawCount + 1;
    const ids = [];
    for (let i = 0; i < count; i++) {
        const isGroup = readViewStateBits(cursor, 1);
        const code = readViewStateBits(cursor, 26);
        if (isGroup === null || code === null) return null;
        ids.push(`${isGroup ? VIEW_STATE_GROUP_REF_PREFIX : ''}${formatCompactPersonRef(code)}`);
    }
    return ids;
}

/**
 * Encodes an active filter into a compact single-character-prefixed suffix (`p<place>`, `j<job>`,
 * `f<family>`, `s<search>`, `dp`/`dj`/`df` for directory tabs, or `x<type>:<value>`).
 *
 * @param {{filterType: string, value: string}|null|undefined} filter - Active filter descriptor.
 * @returns {string} Suffix without leading `.`, or `''` when inactive.
 *
 * @example
 * encodeFilterSuffix({ filterType: 'place', value: 'New York' });
 * // => 'pNew+York'
 *
 * @example
 * encodeFilterSuffix({ filterType: 'directory', value: 'places' });
 * // => 'dp'
 */
function encodeFilterSuffix(filter) {
    if (!filter || !filter.filterType || !filter.value) return '';
    const type = String(filter.filterType);
    const val = String(filter.value);
    if (type === 'directory') {
        if (val === 'places') return 'dp';
        if (val === 'jobs') return 'dj';
        if (val === 'families') return 'df';
        return `d:${encodeViewStateToken(val)}`;
    }
    const shortCode = { place: 'p', job: 'j', family: 'f', search: 's' }[type];
    if (shortCode) return `${shortCode}${encodeViewStateToken(val)}`;
    return `x${encodeViewStateToken(type)}:${encodeViewStateToken(val)}`;
}

/**
 * Inverse of `encodeFilterSuffix`: decodes the `.` suffix back into `{filterType, value}`.
 *
 * @param {string} suffix - Raw filter suffix after `.`.
 * @returns {{filterType: string, value: string}|null}
 *
 * @example
 * decodeFilterSuffix('pNew+York');
 * // => { filterType: 'place', value: 'New York' }
 *
 * @example
 * decodeFilterSuffix('dp');
 * // => { filterType: 'directory', value: 'places' }
 */
function decodeFilterSuffix(suffix) {
    if (!suffix) return null;
    const head = suffix[0];
    const rest = suffix.slice(1);
    if (head === 'd') {
        const tab = { p: 'places', j: 'jobs', f: 'families' }[rest];
        if (tab) return { filterType: 'directory', value: tab };
        return rest.startsWith(':') && rest.length > 1
            ? { filterType: 'directory', value: decodeViewStateToken(rest.slice(1)) }
            : null;
    }
    const type = { p: 'place', j: 'job', f: 'family', s: 'search' }[head];
    if (type) return rest ? { filterType: type, value: decodeViewStateToken(rest) } : null;
    return head === 'x' ? parseViewStateFilterToken(rest) : null;
}

/**
 * Encodes all non-filter view state fields into the Base64url `<bitPacket>` string.
 *
 * @param {Object} state - View state snapshot.
 * @param {FamilyTree|null} tree - Optional loaded tree for sibling-bar group compression.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs.
 * @returns {string} Base64url bit packet, or `''` when all header flags are zero.
 *
 * @example
 * encodeBitPacket({ showMap: true }, null, []);
 * // => '2'
 *
 * @example
 * encodeBitPacket({}, null, []);
 * // => ''
 */
function encodeBitPacket(state, tree, sheetIds) {
    const focusCode = state.focusId ? encodePersonCode26(state.focusId, sheetIds) : null;
    const rawAnchorCode = (state.anchorId && state.anchorId !== state.focusId)
        ? encodePersonCode26(state.anchorId, sheetIds)
        : null;
    const anchorCode = (rawAnchorCode !== null && rawAnchorCode !== focusCode) ? rawAnchorCode : null;
    const hasZoom = Number.isFinite(state.zoom) && state.zoom > 0 ? 1 : 0;
    const offsetPair = normalizeOffsetPair(state.offset);
    const collapsed = encodeCollapsedEntries(state.collapsedIds, tree, sheetIds);
    const hasExtra = (anchorCode !== null || collapsed.length > 0) ? 1 : 0;
    const sidebarClosed = (focusCode !== null && state.isSidebarVisible === false) ? 1 : 0;
    const header = ((focusCode !== null ? 1 : 0) << 5) | (sidebarClosed << 4)
        | (hasZoom << 3) | ((offsetPair ? 1 : 0) << 2) | ((state.showMap ? 1 : 0) << 1) | hasExtra;
    if (header === 0) return '';
    const bits = [];
    pushViewStateBits(bits, header, 6);
    if (hasExtra) pushViewStateBits(bits, ((anchorCode !== null ? 1 : 0) << 1) | (collapsed.length > 0 ? 1 : 0), 2);
    if (focusCode !== null) pushViewStateBits(bits, focusCode, 26);
    if (hasZoom) writeZoomBits(bits, state.zoom);
    if (anchorCode !== null) pushViewStateBits(bits, anchorCode, 26);
    if (offsetPair) writeOffsetBits(bits, offsetPair);
    if (collapsed.length > 0) writeCollapsedBits(bits, collapsed);
    return packBitsToBase64Url(bits);
}

/**
 * Decodes a Base64url `<bitPacket>` string onto a mutable view state object, stopping cleanly on
 * invalid or truncated bit streams without throwing.
 *
 * @param {string} packet - Base64url bit packet.
 * @param {Object} state - Mutable view state target.
 * @returns {Object} The populated `state` object.
 *
 * @example
 * decodeBitPacket('2', {});
 * // => { showMap: true }
 *
 * @example
 * decodeBitPacket('!invalid', {});
 * // => {}
 */
function decodeBitPacket(packet, state) {
    const cursor = unpackBase64UrlToBits(packet);
    const header = readViewStateBits(cursor, 6);
    if (!header) return state;
    const extra = (header & 1) ? readViewStateBits(cursor, 2) : 0;
    if (extra === null) return state;
    if ((header >>> 1) & 1) state.showMap = true;
    if ((header >>> 5) & 1) {
        const focusCode = readViewStateBits(cursor, 26);
        if (focusCode === null) return state;
        state.focusId = formatCompactPersonRef(focusCode);
        if ((header >>> 4) & 1) state.isSidebarVisible = false;
    }
    if ((header >>> 3) & 1) {
        const zoom = readZoomBits(cursor);
        if (zoom === null) return state;
        state.zoom = zoom;
    }
    if ((extra >>> 1) & 1) {
        const anchorCode = readViewStateBits(cursor, 26);
        if (anchorCode === null) return state;
        state.anchorId = formatCompactPersonRef(anchorCode);
    }
    if ((header >>> 2) & 1) {
        const offset = readOffsetBits(cursor);
        if (offset === null) return state;
        state.offset = offset;
    }
    if (extra & 1) {
        const ids = readCollapsedBits(cursor);
        if (ids) state.collapsedIds = ids;
    }
    return state;
}

/**
 * Serialises a view state snapshot into the ultra-short URL hash body (without `#`). Accepts
 * either a `FamilyTree` (enabling sibling bus-bar parent-group compression and sheet compaction)
 * or a precomputed `sheetIds` array.
 *
 * @param {Object} state - View state snapshot.
 * @param {FamilyTree|Array<string>|null} [treeOrSheetIds=null] - Loaded tree or sorted sheet IDs.
 * @returns {string} Compact hash body (e.g. `'e4K10p890'`, `'2'`, `'.pKochi'`), or `''` when empty.
 *
 * @example
 * encodeViewStateHash({ showMap: true });
 * // => '2'
 *
 * @example
 * encodeViewStateHash({});
 * // => ''
 */
function encodeViewStateHash(state, treeOrSheetIds = null) {
    if (!state) return '';
    const isTree = Boolean(treeOrSheetIds && !Array.isArray(treeOrSheetIds));
    const tree = isTree ? treeOrSheetIds : null;
    const sheetIds = isTree ? collectViewStateSheetIds(tree) : (treeOrSheetIds || []);
    const packet = encodeBitPacket(state, tree, sheetIds);
    const filterSuffix = encodeFilterSuffix(state.activeFilter);
    return filterSuffix ? `${packet}.${filterSuffix}` : packet;
}

/**
 * Parses the legacy `f=<type>:<value>` filter entry (and custom `x<type>:<value>` suffixes).
 *
 * @param {string} value - Raw (still encoded) `<type>:<value>` token.
 * @returns {{filterType: string, value: string}|null} Filter descriptor, or null when malformed.
 *
 * @example
 * parseViewStateFilterToken('place:New+York');
 * // => { filterType: 'place', value: 'New York' }
 *
 * @example
 * parseViewStateFilterToken('place');
 * // => null
 */
function parseViewStateFilterToken(value) {
    const sep = value.indexOf(':');
    if (sep <= 0 || sep === value.length - 1) return null;
    return {
        filterType: decodeViewStateToken(value.slice(0, sep)),
        value: decodeViewStateToken(value.slice(sep + 1))
    };
}

/**
 * Applies a single legacy `key=value` hash entry onto a view state object being parsed so
 * previously shared `#p=Anto_1955_166&z=0.8&o=164,-2.6` links continue to restore cleanly.
 *
 * @param {Object} state - Mutable view state accumulator.
 * @param {string} key - Legacy hash key (`p`, `s`, `f`, `v`, `z`, `a`, `o`, or `k`).
 * @param {string} value - Raw (still encoded) value.
 * @returns {Object} The same state object for chaining.
 *
 * @example
 * applyViewStateHashEntry({}, 'o', '-320,12.5');
 * // => { offset: { dx: -320, dy: 12.5 } }
 *
 * @example
 * applyViewStateHashEntry({}, 'z', 'abc');
 * // => {}
 */
function applyViewStateHashEntry(state, key, value) {
    if (key === 'p' && value) state.focusId = decodeViewStateToken(value);
    else if (key === 'a' && value) state.anchorId = decodeViewStateToken(value);
    else if (key === 's') state.isSidebarVisible = value !== '0';
    else if (key === 'v') state.showMap = value === 'map';
    else if (key === 'f') {
        const filter = parseViewStateFilterToken(value);
        if (filter) state.activeFilter = filter;
    } else if (key === 'z') {
        const zoom = parseFloat(value);
        if (Number.isFinite(zoom) && zoom > 0) state.zoom = zoom;
    } else if (key === 'o') {
        const [dx, dy] = value.split(',').map((token) => parseFloat(token));
        if (Number.isFinite(dx) && Number.isFinite(dy)) state.offset = { dx, dy };
    } else if (key === 'k') {
        const ids = value.split(',').filter(Boolean).map(decodeViewStateToken);
        if (ids.length > 0) state.collapsedIds = ids;
    }
    return state;
}

/**
 * Parses a legacy `key=value&...` view-state hash body.
 *
 * @param {string} body - Hash body without `#`.
 * @returns {Object} Parsed partial view state.
 *
 * @example
 * parseLegacyViewStateHash('p=Joseph_1920_152&s=0&z=0.8');
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: false, zoom: 0.8 }
 *
 * @example
 * parseLegacyViewStateHash('z=abc&foo=bar');
 * // => {}
 */
function parseLegacyViewStateHash(body) {
    const state = {};
    body.split('&').forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq > 0) applyViewStateHashEntry(state, pair.slice(0, eq), pair.slice(eq + 1));
    });
    return state;
}

/**
 * Parses a URL hash (with or without `#`) into a view state snapshot, supporting both the
 * ultra-short bit-packed Base64url format and legacy `p=...&z=...` links.
 *
 * @param {string} hash - Hash fragment such as `#e4K10p890`, `#2.pKochi`, or `#p=Anto_1955_166&z=0.8`.
 * @returns {Object} Partial view state; empty object when the hash carries no valid view state.
 *
 * @example
 * parseViewStateHash('#2.pKochi');
 * // => { showMap: true, activeFilter: { filterType: 'place', value: 'Kochi' } }
 *
 * @example
 * parseViewStateHash('#p=Joseph_1920_152&s=0&z=0.8');
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: false, zoom: 0.8 }
 */
function parseViewStateHash(hash) {
    const body = String(hash || '').replace(/^#/, '').trim();
    if (!body) return {};
    const dot = body.indexOf('.');
    const head = dot >= 0 ? body.slice(0, dot) : body;
    if (head.includes('=')) return parseLegacyViewStateHash(body);
    const state = head ? decodeBitPacket(head, {}) : {};
    if (dot >= 0) {
        const filter = decodeFilterSuffix(body.slice(dot + 1));
        if (filter) state.activeFilter = filter;
    }
    return state;
}

/**
 * Converts the camera transform into the point of the tree (in unscaled tree pixels) that sits in
 * the middle of the visible canvas area, i.e. right of the timeline gutter and left of any sidebar.
 *
 * @param {Object} params
 * @param {{x: number, y: number, z: number}} params.camera - Current camera transform.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, y: number}} Visible centre in unscaled tree pixels.
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 1148, y: 600 }
 *
 * @example
 * computeViewCenterFromCamera({ camera: { x: 48, y: 24, z: 0.5 }, visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 });
 * // => { x: 1000, y: 752 }
 */
function computeViewCenterFromCamera({ camera, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const zoom = camera.z || 1;
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    return { x: (centerScreenX - camera.x) / zoom, y: (centerScreenY - camera.y) / zoom };
}

/**
 * Inverse of computeViewCenterFromCamera: derives the camera transform that places the given
 * tree point in the middle of the visible viewport at the requested zoom.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.center - Desired visible centre in unscaled tree pixels.
 * @param {number} params.zoom - Desired camera zoom level.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {{x: number, y: number, z: number}} Camera transform.
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1148, y: 600 }, zoom: 1, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: -600, y: -200, z: 1 }
 *
 * @example
 * computeCameraFromViewCenter({ center: { x: 1000, y: 752 }, zoom: 0.5, visibleWidth: 1048, visibleHeight: 800 });
 * // => { x: 48, y: 24, z: 0.5 }
 */
function computeCameraFromViewCenter({ center, zoom, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const centerScreenX = timelineWidth + (visibleWidth - timelineWidth) / 2;
    const centerScreenY = visibleHeight / 2;
    return { x: centerScreenX - center.x * zoom, y: centerScreenY - center.y * zoom, z: zoom };
}

/**
 * Expresses the visible centre relative to an anchor person card: horizontally in unscaled tree
 * pixels, vertically in calendar years (so the value is independent of this screen's pixels-per-year).
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.center - Visible centre in unscaled tree pixels.
 * @param {{x: number, y: number}} params.anchor - Anchor card centre in unscaled tree pixels.
 * @param {number} params.ppy - Pixels-per-year of the current layout.
 * @returns {{dx: number, dy: number}} Offset in tree pixels (dx) and years (dy).
 *
 * @example
 * computeAnchorOffset({ center: { x: 1148, y: 600 }, anchor: { x: 1468, y: 475 }, ppy: 10 });
 * // => { dx: -320, dy: 12.5 }
 *
 * @example
 * computeAnchorOffset({ center: { x: 500, y: 300 }, anchor: { x: 500, y: 300 }, ppy: 8 });
 * // => { dx: 0, dy: 0 }
 */
function computeAnchorOffset({ center, anchor, ppy }) {
    return { dx: center.x - anchor.x, dy: (center.y - anchor.y) / (ppy || 8) };
}

/**
 * Inverse of computeAnchorOffset: rebuilds the visible centre from the anchor card measured on
 * THIS screen and the shared offset, using this screen's pixels-per-year for the vertical part.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.anchor - Anchor card centre in unscaled tree pixels.
 * @param {{dx: number, dy: number}} params.offset - Shared offset (tree pixels, years).
 * @param {number} params.ppy - Pixels-per-year of the layout on this screen.
 * @returns {{x: number, y: number}} Visible centre in unscaled tree pixels.
 *
 * @example
 * computeCenterFromAnchorOffset({ anchor: { x: 1768, y: 380 }, offset: { dx: -320, dy: 12.5 }, ppy: 8 });
 * // => { x: 1448, y: 480 }
 *
 * @example
 * computeCenterFromAnchorOffset({ anchor: { x: 500, y: 300 }, offset: { dx: 0, dy: 0 }, ppy: 8 });
 * // => { x: 500, y: 300 }
 */
function computeCenterFromAnchorOffset({ anchor, offset, ppy }) {
    return { x: anchor.x + offset.dx, y: anchor.y + offset.dy * (ppy || 8) };
}

/**
 * Tests whether an anchor card centre (unscaled tree pixels) is currently on screen inside the
 * visible canvas area.
 *
 * @param {Object} params
 * @param {{x: number, y: number}} params.anchor - Card centre in unscaled tree pixels.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {number} params.visibleWidth - Width of the canvas area not covered by the sidebar.
 * @param {number} params.visibleHeight - Height of the canvas area.
 * @param {number} [params.timelineWidth=48] - Width of the left timeline gutter.
 * @returns {boolean} True when the card centre is visible.
 *
 * @example
 * isAnchorInsideViewport({ anchor: { x: 1148, y: 600 }, camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => true
 *
 * @example
 * isAnchorInsideViewport({ anchor: { x: 5000, y: 600 }, camera: { x: -600, y: -200, z: 1 }, visibleWidth: 1048, visibleHeight: 800 });
 * // => false
 */
function isAnchorInsideViewport({ anchor, camera, visibleWidth, visibleHeight, timelineWidth = 48 }) {
    const screenX = anchor.x * camera.z + camera.x;
    const screenY = anchor.y * camera.z + camera.y;
    return screenX >= timelineWidth && screenX <= visibleWidth && screenY >= 0 && screenY <= visibleHeight;
}

/**
 * Picks the rendered person card whose centre is nearest to a point of the tree.
 *
 * @param {Array<{id: string, x: number, y: number}>} nodes - Rendered card centres in unscaled tree pixels.
 * @param {{x: number, y: number}} center - Reference point in unscaled tree pixels.
 * @returns {{id: string, x: number, y: number}|null} Nearest card, or null when nothing is rendered.
 *
 * @example
 * pickNearestAnchor([{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 100, y: 100 }], { x: 90, y: 80 });
 * // => { id: 'B', x: 100, y: 100 }
 *
 * @example
 * pickNearestAnchor([], { x: 0, y: 0 });
 * // => null
 */
function pickNearestAnchor(nodes, center) {
    let best = null;
    let bestDistance = Infinity;
    (nodes || []).forEach((node) => {
        const distance = (node.x - center.x) ** 2 + (node.y - center.y) ** 2;
        if (distance < bestDistance) {
            best = node;
            bestDistance = distance;
        }
    });
    return best;
}

/**
 * Measures the centre of one rendered person card in unscaled tree pixels.
 *
 * @param {string} personId - Person ID (card element id is `node-<personId>`).
 * @param {HTMLElement|null} treeElement - Inner tree element carrying the camera transform.
 * @returns {{id: string, x: number, y: number}|null} Card centre, or null when not rendered.
 *
 * @example
 * measurePersonNodeCenter('Joseph_1920_152', treeRef.current);
 * // => { id: 'Joseph_1920_152', x: 1468, y: 475 }
 *
 * @example
 * measurePersonNodeCenter('Nobody_unk_0', treeRef.current);
 * // => null
 */
function measurePersonNodeCenter(personId, treeElement) {
    const box = computePeopleBoundingBox([personId], treeElement);
    if (!box || !box.foundCount) return null;
    return { id: personId, x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

/**
 * Lists the centres of all rendered person cards in unscaled tree pixels.
 *
 * @param {HTMLElement|null} treeElement - Inner tree element carrying the camera transform.
 * @param {FamilyTree} tree - Loaded tree, used to ignore non-person elements with a `node-` id.
 * @returns {Array<{id: string, x: number, y: number}>} Rendered card centres.
 *
 * @example
 * listRenderedPersonNodes(treeRef.current, tree).length;
 * // => 239
 *
 * @example
 * listRenderedPersonNodes(null, tree);
 * // => []
 */
function listRenderedPersonNodes(treeElement, tree) {
    if (!treeElement || typeof treeElement.querySelectorAll !== 'function') return [];
    const treeRect = treeElement.getBoundingClientRect();
    const scale = treeElement.offsetWidth ? (treeRect.width / treeElement.offsetWidth) : 1;
    const nodes = [];
    treeElement.querySelectorAll('[id^="node-"]').forEach((element) => {
        const id = element.id.slice(5);
        if (!tree || !tree.get(id)) return;
        const rect = element.getBoundingClientRect();
        nodes.push({
            id,
            x: ((rect.left + rect.right) / 2 - treeRect.left) / scale,
            y: ((rect.top + rect.bottom) / 2 - treeRect.top) / scale
        });
    });
    return nodes;
}

/**
 * Chooses the person card the camera is anchored to in the URL: the focused person while their
 * card is on screen (shortest URL), otherwise the card nearest to the middle of the viewport.
 *
 * @param {Object} params
 * @param {HTMLElement|null} params.treeElement - Inner tree element.
 * @param {FamilyTree} params.tree - Loaded tree.
 * @param {string|null} params.focusId - Focused person ID.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} params.viewport - Visible area.
 * @returns {{id: string, x: number, y: number}|null} Anchor card centre in unscaled tree pixels.
 *
 * @example
 * chooseViewStateAnchor({ treeElement: treeRef.current, tree, focusId: 'Joseph_1920_152', camera, viewport });
 * // => { id: 'Joseph_1920_152', x: 1468, y: 475 }   (Joseph's card is on screen)
 *
 * @example
 * chooseViewStateAnchor({ treeElement: treeRef.current, tree, focusId: null, camera, viewport });
 * // => { id: 'Antu_1931_12', x: 2210, y: 710 }      (card nearest to the viewport centre)
 */
function chooseViewStateAnchor({ treeElement, tree, focusId, camera, viewport }) {
    if (!treeElement) return null;
    const focused = focusId ? measurePersonNodeCenter(focusId, treeElement) : null;
    if (focused && isAnchorInsideViewport({ anchor: focused, camera, ...viewport })) return focused;
    const center = computeViewCenterFromCamera({ camera, ...viewport });
    return pickNearestAnchor(listRenderedPersonNodes(treeElement, tree), center);
}

/**
 * Splits a person ID (`<Name>_<YOB|unk>_<row>` or `ghost_<Name>_<sheet>_<n>`) into the parts used
 * by the fallback matchers and 26-bit coder, pre-collapsing any embedded 35-60 char spreadsheet ID
 * (even one containing underscores, such as `DEMO_SHEET_ID`) so `nameStem` is never corrupted.
 *
 * @param {string} personId - Person ID from a shared URL or loaded tree.
 * @returns {{stem: string, nameStem: string, midToken: string, row: number|null}|null}
 *
 * @example
 * parseViewStatePersonRef('Joseph_1920_152');
 * // => { stem: 'Joseph_1920', nameStem: 'Joseph', midToken: '1920', row: 152 }
 *
 * @example
 * parseViewStatePersonRef('ghost_George_Daughter_~1_642');
 * // => { stem: 'ghost_George_Daughter_~1', nameStem: 'ghost_George_Daughter', midToken: '~1', row: 642 }
 */
function parseViewStatePersonRef(personId) {
    const normalized = String(personId || '').replace(
        /_(?:1[A-Za-z0-9-][A-Za-z0-9_-]{32,44}|[A-Za-z0-9-]{25,60})(?=_\d+$)/,
        '_~0'
    );
    const tokens = normalized.split('_');
    if (tokens.length < 3) return null;
    const row = parseInt(tokens[tokens.length - 1], 10);
    return {
        stem: tokens.slice(0, -1).join('_'),
        nameStem: tokens.slice(0, -2).join('_'),
        midToken: tokens[tokens.length - 2],
        row: Number.isFinite(row) ? row : null
    };
}

/**
 * Finds the person whose (compacted) ID starts with `<stem>_` followed by exactly `depth` more
 * tokens, preferring the candidate whose trailing row number is nearest to the shared one so that
 * namesakes further away in the spreadsheet never win over the intended person.
 *
 * @param {Array<{id: string, key: string}>} people - Raw IDs paired with their compacted form.
 * @param {string} stem - ID prefix to match (without the trailing underscore).
 * @param {number} depth - Number of `_`-separated tokens expected after the stem.
 * @param {number|null} row - Row number from the shared ID.
 * @returns {string|null} Raw ID of the best candidate, or null.
 *
 * @example
 * pickNearestRowCandidate([{ id: 'Jose_1950_10', key: 'Jose_1950_10' }, { id: 'Jose_1950_60', key: 'Jose_1950_60' }], 'Jose_1950', 1, 11);
 * // => 'Jose_1950_10'
 *
 * @example
 * pickNearestRowCandidate([{ id: 'Joseph_Son_1950_12', key: 'Joseph_Son_1950_12' }], 'Joseph', 2, 152);
 * // => null  (three tokens follow "Joseph", so it is a different person)
 */
function pickNearestRowCandidate(people, stem, depth, row) {
    if (!stem) return null;
    let best = null;
    let bestDistance = Infinity;
    people.forEach((person) => {
        if (!person.key.startsWith(`${stem}_`)) return;
        const rest = person.key.slice(stem.length + 1).split('_');
        if (rest.length !== depth) return;
        const candidateRow = parseInt(rest[rest.length - 1], 10);
        const distance = Number.isFinite(candidateRow) && row !== null ? Math.abs(candidateRow - row) : Number.MAX_SAFE_INTEGER;
        if (distance < bestDistance) {
            best = person.id;
            bestDistance = distance;
        }
    });
    return best;
}

/**
 * Precomputes the 26-bit fingerprint descriptors for all valid people in `tree`.
 *
 * @param {FamilyTree} tree - Loaded family tree.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs.
 * @returns {Array<{id: string, actualRow: number|null, code: number, isGhost: number, nameHash: number, yobTag: number, row: number}>}
 *
 * @example
 * buildCompactCandidateList({ all: [{ id: 'Mary_1924_7' }] }, []).length;
 * // => 1
 *
 * @example
 * buildCompactCandidateList({ all: [] }, []);
 * // => []
 */
function buildCompactCandidateList(tree, sheetIds) {
    const out = [];
    for (const person of (tree && tree.all) || []) {
        if (!person || typeof person.id !== 'string') continue;
        const code = encodePersonCode26(person.id, sheetIds);
        if (code === null) continue;
        const ref = parseViewStatePersonRef(compactViewStateSheetIds(person.id, sheetIds));
        out.push({ id: person.id, actualRow: ref ? ref.row : null, ...decodePersonCode26(code) });
    }
    return out;
}

/**
 * Selects the candidate passing `predicate` whose spreadsheet row is nearest to `targetRow`
 * within `maxDistance` rows.
 *
 * @param {Array<Object>} candidates - Precomputed candidate descriptors from `buildCompactCandidateList`.
 * @param {number} targetRow - 10-bit row from the target person fingerprint (`1023` when unknown).
 * @param {Function} predicate - Candidate filter function.
 * @param {number} [maxDistance=Infinity] - Maximum allowed row delta.
 * @returns {string|null} Best matching `person.id`, or `null`.
 *
 * @example
 * pickNearestCompactCandidate([{ id: 'A', actualRow: 10 }, { id: 'B', actualRow: 60 }], 58, () => true);
 * // => 'B'
 *
 * @example
 * pickNearestCompactCandidate([{ id: 'A', actualRow: 200 }], 10, () => true, 64);
 * // => null
 */
function pickNearestCompactCandidate(candidates, targetRow, predicate, maxDistance = Infinity) {
    let best = null;
    let bestDistance = Infinity;
    for (const cand of candidates) {
        if (!predicate(cand)) continue;
        const candRow = cand.actualRow !== null ? cand.actualRow : cand.row;
        const distance = targetRow < 1023 && candRow !== null
            ? Math.abs(candRow - targetRow)
            : Number.MAX_SAFE_INTEGER;
        if (distance <= maxDistance && distance < bestDistance) {
            best = cand.id;
            bestDistance = distance;
        }
    }
    return best;
}

/**
 * Resolves a `@xxxxx` 26-bit compact person reference against `tree` in 3 tiers:
 * (1) exact 26-bit code match, (2) same `(isGhost, nameHash, yobTag)` + nearest row,
 * (3) same `(isGhost, nameHash)` + nearest row within 64 rows (for corrected birth years).
 *
 * @param {FamilyTree} tree - Loaded family tree.
 * @param {string} compactRef - `@xxxxx` compact person reference.
 * @param {Array<string>} sheetIds - Sorted spreadsheet IDs.
 * @returns {string|null} Matching `person.id` in `tree`, or `null`.
 *
 * @example
 * resolveCompactPersonRef(tree, formatCompactPersonRef(encodePersonCode26('Mary_1924_7')), []);
 * // => 'Mary_1924_7'
 *
 * @example
 * resolveCompactPersonRef(tree, formatCompactPersonRef(encodePersonCode26('Nobody_unk_0')), []);
 * // => null
 */
function resolveCompactPersonRef(tree, compactRef, sheetIds) {
    const code = encodePersonCode26(compactRef, sheetIds);
    if (code === null) return null;
    const target = decodePersonCode26(code);
    const candidates = buildCompactCandidateList(tree, sheetIds);
    return pickNearestCompactCandidate(candidates, target.row, (c) => c.code === target.code)
        || pickNearestCompactCandidate(
            candidates,
            target.row,
            (c) => c.isGhost === target.isGhost && c.nameHash === target.nameHash && c.yobTag === target.yobTag
        )
        || pickNearestCompactCandidate(
            candidates,
            target.row,
            (c) => c.isGhost === target.isGhost && c.nameHash === target.nameHash,
            target.row < 1023 ? 64 : Infinity
        );
}

/**
 * Resolves a person reference from a shared URL (either a compact `@xxxxx` 26-bit fingerprint or
 * a legacy `<Name>_<YOB>_<row>` string) against the loaded tree, surviving inserted rows,
 * namesakes, corrected birth years, and shifted ghost counters.
 *
 * @param {FamilyTree} tree - Loaded family tree.
 * @param {string|null|undefined} personId - Compact `@xxxxx` token or legacy person ID.
 * @returns {string|null} A valid person ID in `tree`, or null when nobody matches.
 *
 * @example
 * // A row was inserted above Joseph, so the tree now holds Joseph_1920_153
 * resolveViewStatePersonId(tree, parseViewStateHash(encodeViewStateHash({ focusId: 'Joseph_1920_152' })).focusId);
 * // => 'Joseph_1920_153'
 *
 * @example
 * // Legacy person IDs continue to resolve with full edit tolerance
 * resolveViewStatePersonId(tree, 'Joseph_1920_152');
 * // => 'Joseph_1920_153'
 */
function resolveViewStatePersonId(tree, personId) {
    if (!tree || !personId) return null;
    const raw = String(personId);
    const sheetIds = collectViewStateSheetIds(tree);
    if (raw.startsWith(VIEW_STATE_PERSON_REF_PREFIX)) {
        return resolveCompactPersonRef(tree, raw, sheetIds);
    }
    const wanted = compactViewStateSheetIds(raw, sheetIds);
    const exactId = expandViewStateSheetIds(wanted, sheetIds);
    if (tree.get(exactId)) return exactId;
    const ref = parseViewStatePersonRef(wanted);
    if (!ref) return null;
    const people = (tree.all || [])
        .filter((person) => person && typeof person.id === 'string')
        .map((person) => ({ id: person.id, key: compactViewStateSheetIds(person.id, sheetIds) }));
    return pickNearestRowCandidate(people, ref.stem, 1, ref.row)
        || pickNearestRowCandidate(people, ref.nameStem, 2, ref.row);
}

/**
 * Predicts whether a sidebar panel will be open once a parsed view state has been applied,
 * which determines the visible canvas width used to place the restored centre.
 *
 * @param {Object} state - Parsed view state.
 * @returns {boolean} True when a person panel, filter list, or map directory will be open.
 *
 * @example
 * resolveRestoredSidebarOpen({ focusId: 'Joseph_1920_152' });
 * // => true
 *
 * @example
 * resolveRestoredSidebarOpen({ focusId: 'Joseph_1920_152', isSidebarVisible: false });
 * // => false
 */
function resolveRestoredSidebarOpen(state) {
    if (!state) return false;
    if (state.showMap || state.activeFilter) return true;
    return Boolean(state.focusId) && state.isSidebarVisible !== false;
}

/**
 * Measures the canvas area that is actually visible to the user (the sidebar overlays the
 * right edge of the full-width canvas) together with the timeline gutter width.
 *
 * @param {Object} params
 * @param {HTMLElement|null} params.container - Canvas container element.
 * @param {boolean} params.isSidebarOpen - Whether any sidebar panel is open.
 * @param {number} params.sidebarWidth - Sidebar width in pixels.
 * @returns {{visibleWidth: number, visibleHeight: number, timelineWidth: number}}
 *
 * @example
 * measureViewStateViewport({ container: containerRef.current, isSidebarOpen: false, sidebarWidth: 360 });
 * // => { visibleWidth: 1440, visibleHeight: 900, timelineWidth: 48 }
 *
 * @example
 * measureViewStateViewport({ container: null, isSidebarOpen: true, sidebarWidth: 400 });
 * // => { visibleWidth: 1040, visibleHeight: 900, timelineWidth: 48 }
 */
function measureViewStateViewport({ container, isSidebarOpen, sidebarWidth, bottomSheetHeight = 0 }) {
    const { contW, contH } = resolveViewportDimensions({ container, isSidebarOpen, sidebarWidth, bottomSheetHeight });
    return { visibleWidth: contW, visibleHeight: contH, timelineWidth: resolveTimelineGutterWidth() };
}

/**
 * Captures the live application state as a serialisable view state snapshot. The camera is
 * expressed relative to the anchor card so the snapshot survives layout changes; camera details
 * are omitted while the map view is shown because the tree canvas is hidden there.
 *
 * @param {Object} params
 * @param {string|null} params.focusId - Focused person ID.
 * @param {boolean} params.isSidebarVisible - Whether the person sidebar is open.
 * @param {Object|null} params.activeFilter - Active filter descriptor.
 * @param {boolean} params.showMap - Whether the map view is shown.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {number} params.ppy - Current pixels-per-year.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} params.viewport - Measured viewport.
 * @param {{id: string, x: number, y: number}|null} params.anchor - Anchor card centre (see chooseViewStateAnchor).
 * @param {Set<string>|Array<string>} params.collapsedNodes - Collapsed branch IDs.
 * @returns {Object} View state snapshot accepted by encodeViewStateHash.
 *
 * @example
 * buildCurrentViewState({ focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 *   camera: { x: -600, y: -200, z: 1 }, ppy: 10, viewport: { visibleWidth: 1048, visibleHeight: 800, timelineWidth: 48 },
 *   anchor: { id: 'Joseph_1920_152', x: 1468, y: 475 }, collapsedNodes: new Set() });
 * // => { focusId: 'Joseph_1920_152', isSidebarVisible: true, activeFilter: null, showMap: false,
 * //      zoom: 1, anchorId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 }, collapsedIds: [] }
 *
 * @example
 * encodeViewStateHash(buildCurrentViewState({ ...liveState, showMap: true }));
 * // => 'v=map'
 */
function buildCurrentViewState({ focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, viewport, anchor, collapsedNodes }) {
    const center = showMap ? null : computeViewCenterFromCamera({ camera, ...viewport });
    const useAnchor = Boolean(center && anchor);
    return {
        focusId: focusId || null,
        isSidebarVisible: Boolean(isSidebarVisible),
        activeFilter: activeFilter || null,
        showMap: Boolean(showMap),
        zoom: showMap ? null : camera.z,
        anchorId: useAnchor ? anchor.id : null,
        offset: useAnchor ? computeAnchorOffset({ center, anchor, ppy }) : null,
        collapsedIds: Array.from(collapsedNodes || [])
    };
}

/**
 * Mirrors the given hash body into the address bar without reloading or adding history entries,
 * so the browser back button keeps working as before. No-op when the hash is already current.
 *
 * @param {string} hashBody - Hash body without `#` (empty string clears the hash).
 * @returns {boolean} True when the address bar was updated.
 *
 * @example
 * writeViewStateHash('p=Joseph_1920_152&z=0.8');
 * // address bar => https://google.github.io/family-tree/?id=1ZDpc…#p=Joseph_1920_152&z=0.8
 *
 * @example
 * writeViewStateHash('');
 * // => false when the URL already has no hash
 */
function writeViewStateHash(hashBody) {
    saveLastViewStateHash(hashBody);
    if (typeof window === 'undefined' || !window.history || !window.location) return false;
    const target = hashBody ? `#${hashBody}` : '';
    if ((window.location.hash || '') === target) return false;
    try {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${target}`);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Re-applies the focused person (and sidebar visibility) from a shared view state.
 *
 * @param {Object} state - Parsed view state.
 * @param {Object} actions - Live application handlers (`tree`, `handleSetFocusId`, `setIsSidebarVisible`).
 * @returns {boolean} True when a person was focused.
 *
 * @example
 * applyRestoredFocus({ focusId: 'Joseph_1920_152', isSidebarVisible: false }, actions);
 * // => true  (focuses Joseph, then hides the sidebar)
 *
 * @example
 * applyRestoredFocus({ focusId: 'Nobody_unk_0' }, actions);
 * // => false (unknown person is ignored)
 */
function applyRestoredFocus(state, actions) {
    const personId = resolveViewStatePersonId(actions.tree, state.focusId);
    if (!personId) return false;
    actions.handleSetFocusId(personId);
    if (state.isSidebarVisible === false) actions.setIsSidebarVisible(false);
    return true;
}

/**
 * Resolves the collapsed branch references of a shared view state against the loaded tree,
 * expanding `^@xxxxx` sibling bus-bar parent-group entries into all foldable children of that
 * parent and resolving individual entries with row-shift tolerance.
 *
 * @param {Object} state - Parsed view state (uses `collapsedIds`).
 * @param {FamilyTree} tree - Loaded tree.
 * @returns {Array<string>} Valid deduplicated collapsed branch IDs.
 *
 * @example
 * resolveRestoredCollapsedIds({ collapsedIds: ['Antu_1931_12', 'Nobody_unk_0'] }, tree);
 * // => ['Antu_1931_13']   (Antu's row shifted by one, Nobody is dropped)
 *
 * @example
 * resolveRestoredCollapsedIds({}, tree);
 * // => []
 */
function resolveRestoredCollapsedIds(state, tree) {
    if (!state || !Array.isArray(state.collapsedIds) || !tree) return [];
    const resolved = [];
    for (const entry of state.collapsedIds) {
        const raw = String(entry || '');
        if (raw.startsWith(VIEW_STATE_GROUP_REF_PREFIX)) {
            const parentId = resolveViewStatePersonId(tree, raw.slice(1));
            const parent = parentId ? tree.get(parentId) : null;
            getFoldableChildIdsOfParent(tree, parent).forEach((cid) => resolved.push(cid));
        } else {
            const personId = resolveViewStatePersonId(tree, raw);
            if (personId) resolved.push(personId);
        }
    }
    return Array.from(new Set(resolved));
}

/**
 * Re-applies the selection half of a shared view state (map, filter, focused person,
 * sidebar visibility, collapsed branches) through the regular UI action handlers so
 * navigation history, re-rooting, and panel coordination behave exactly like user clicks.
 *
 * @param {Object} state - Parsed view state.
 * @param {Object} actions - Live application handlers and setters.
 * @param {FamilyTree} actions.tree - Loaded tree.
 * @param {Function} actions.handleSetFocusId - Person focus handler.
 * @param {Function} actions.handleFilterBy - Filter activation handler.
 * @param {Function} actions.setShowMap - Map visibility setter.
 * @param {Function} actions.setIsSidebarVisible - Sidebar visibility setter.
 * @param {Function} actions.setActiveFilter - Active filter setter.
 * @param {Function} actions.setFocusId - Focus ID setter.
 * @param {Function} actions.setCollapsedNodes - Collapsed node set setter.
 * @returns {boolean} True when any selection was applied.
 *
 * @example
 * applyRestoredSelection({ activeFilter: { filterType: 'place', value: 'Kochi' } }, actions);
 * // => true  (opens the Kochi filter list)
 *
 * @example
 * applyRestoredSelection({ zoom: 0.8 }, actions);
 * // => false (nothing to select; camera is handled separately)
 */
function applyRestoredSelection(state, actions) {
    let applied = false;
    if (state.showMap) {
        actions.setShowMap(true);
        actions.setIsSidebarVisible(true);
        actions.setActiveFilter(null);
        actions.setFocusId(null);
        applied = true;
    }
    if (state.activeFilter) {
        actions.handleFilterBy(state.activeFilter.filterType, state.activeFilter.value);
        applied = true;
    } else if (!state.showMap && applyRestoredFocus(state, actions)) {
        applied = true;
    }
    const collapsedIds = resolveRestoredCollapsedIds(state, actions.tree);
    if (collapsedIds.length > 0) {
        actions.setCollapsedNodes(new Set(collapsedIds));
        applied = true;
    }
    return applied;
}

/**
 * Rebuilds the visible centre of a shared view state on this screen: the anchor person (the
 * explicit `a=` anchor, else the focused person) is resolved against the tree, measured on the
 * current layout, and offset by the shared `o=` distance using this screen's pixels-per-year.
 *
 * @param {Object} state - Parsed view state (uses `anchorId`, `focusId`, `offset`).
 * @param {Object} env - Live camera environment (uses `tree`, `measureAnchor`, `getPpy`).
 * @param {number} zoom - Zoom level the centre will be shown at.
 * @returns {{x: number, y: number}|null} Visible centre in unscaled tree pixels, or null when no anchor is rendered.
 *
 * @example
 * resolveRestoredCenter({ focusId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 } }, env, 0.8);
 * // => { x: 1148, y: 580 }
 *
 * @example
 * resolveRestoredCenter({ zoom: 0.8 }, env, 0.8);
 * // => null  (no anchor in the URL)
 */
function resolveRestoredCenter(state, env, zoom) {
    const anchorId = resolveViewStatePersonId(env.tree, state.anchorId || state.focusId);
    const anchor = anchorId ? env.measureAnchor(anchorId) : null;
    if (!anchor) return null;
    return computeCenterFromAnchorOffset({ anchor, offset: state.offset || { dx: 0, dy: 0 }, ppy: env.getPpy(zoom) });
}

/**
 * Re-applies the camera half of a shared view state. The anchor-relative centre is converted back
 * into a camera transform using THIS screen's layout, pixels-per-year and visible area, so the same
 * people appear in the middle of the viewport regardless of window size or spreadsheet edits, then
 * clamped to the tree bounds. Without a resolvable anchor only the zoom level is applied.
 *
 * @param {Object} state - Parsed view state (uses `zoom`, `anchorId`, `focusId`, `offset`, and `showMap`).
 * @param {Object} env - Live camera environment.
 * @param {{x: number, y: number, z: number}} env.camera - Current camera transform.
 * @param {Function} env.setCamera - Camera state setter.
 * @param {Function} env.clampCamera - Camera bounds clamp.
 * @param {Function} env.getPpy - Returns pixels-per-year for a zoom level on this screen.
 * @param {FamilyTree} env.tree - Loaded tree.
 * @param {Function} env.measureAnchor - Returns `{id, x, y}` for a rendered person card, or null.
 * @param {{visibleWidth: number, visibleHeight: number, timelineWidth: number}} env.viewport - Visible area.
 * @returns {boolean} True when the camera was updated.
 *
 * @example
 * applyRestoredCamera({ zoom: 0.8, focusId: 'Joseph_1920_152', offset: { dx: -320, dy: 12.5 } }, env);
 * // => true
 *
 * @example
 * applyRestoredCamera({ focusId: 'Joseph_1920_152' }, { ...env, measureAnchor: () => null });
 * // => false (no zoom and no rendered anchor: camera left untouched)
 */
function applyRestoredCamera(state, env) {
    if (state.showMap) return false;
    const hasZoom = Number.isFinite(state.zoom) && state.zoom > 0;
    const zoom = hasZoom ? state.zoom : env.camera.z;
    const center = resolveRestoredCenter(state, env, zoom);
    if (center) {
        env.setCamera(env.clampCamera(computeCameraFromViewCenter({ center, zoom, ...env.viewport })));
        return true;
    }
    if (!hasZoom) return false;
    env.setCamera(env.clampCamera({ ...env.camera, z: zoom }));
    return true;
}

/**
 * Builds the camera environment used by applyRestoredCamera from the live hook parameters,
 * predicting the sidebar state the restored view will end up with.
 *
 * @param {Object} p - Latest hook parameters (see useUrlViewStateSync).
 * @param {Object} state - Parsed view state.
 * @returns {Object} Environment accepted by applyRestoredCamera.
 *
 * @example
 * applyRestoredCamera(state, buildRestoreCameraEnv(latest.current, state));
 *
 * @example
 * buildRestoreCameraEnv(latest.current, { focusId: 'Joseph_1920_152' }).viewport;
 * // => { visibleWidth: 1080, visibleHeight: 900, timelineWidth: 48 }   (sidebar predicted open)
 */
function buildRestoreCameraEnv(p, state) {
    const restoredOpen = resolveRestoredSidebarOpen(state);
    const restoredSnap = state?.activeFilter ? 'half' : 'peek';
    const restoredSheetH = (p.isCompactViewport && restoredOpen)
        ? resolveBottomSheetPixelHeight({ isCompactViewport: true, isSidebarOpen: true, sheetSnap: restoredSnap })
        : 0;
    const viewport = measureViewStateViewport({
        container: p.containerRef.current, isSidebarOpen: restoredOpen,
        sidebarWidth: p.sidebarWidth, bottomSheetHeight: restoredSheetH
    });
    return {
        camera: p.camera, setCamera: p.setCamera, clampCamera: p.clampCamera, getPpy: p.getPpy, tree: p.tree, viewport,
        measureAnchor: (id) => measurePersonNodeCenter(id, p.treeRef ? p.treeRef.current : null)
    };
}

/**
 * Runs the phased restore of a shared view state after the dataset is ready: first the selection
 * (which triggers the app's own person-centring animation), then — once that centring has settled —
 * the zoom and anchor offset from the URL, re-measured a few times because the horizontal layout
 * re-flows with the zoom level.
 *
 * @param {Object} params
 * @param {{current: Object}} params.latest - Ref holding the latest hook parameters.
 * @param {Object} params.state - Parsed view state from the initial URL hash.
 * @param {Function} params.onComplete - Invoked after the final phase.
 * @returns {Array<number>} Timer handles for all phases.
 *
 * @example
 * scheduleViewStateRestore({ latest, state: parseViewStateHash(window.location.hash), onComplete: () => {} });
 *
 * @example
 * const timers = scheduleViewStateRestore({ latest, state: {}, onComplete: enableUrlWrites });
 * timers.forEach(clearTimeout);
 */
function scheduleViewStateRestore({ latest, state, onComplete }) {
    const timers = [setTimeout(() => {
        applyRestoredSelection(state, latest.current);
    }, VIEW_STATE_SELECTION_DELAY_MS)];
    const delays = [0, ...VIEW_STATE_CAMERA_REFINE_DELAYS_MS];
    delays.forEach((extraDelay, index) => {
        timers.push(setTimeout(() => {
            applyRestoredCamera(state, buildRestoreCameraEnv(latest.current, state));
            if (index === delays.length - 1) onComplete();
        }, VIEW_STATE_CAMERA_DELAY_MS + extraDelay));
    });
    return timers;
}

/**
 * One-shot effect restoring the view state captured in the initial URL hash once the dataset has
 * finished loading (so the restore survives the cache-then-live double tree load and the import
 * handler's own focus reset).
 *
 * @param {Object} params
 * @param {{current: Object}} params.latest - Ref holding the latest hook parameters.
 * @param {Object} params.initialState - View state parsed from the URL at startup.
 * @param {{current: {done: boolean, writable: boolean}}} params.phaseRef - Restore lifecycle flags.
 * @param {string|null} params.rootId - Current tree root ID (null until a tree is loaded).
 * @param {boolean} params.isLoading - Whether a dataset import is in flight.
 * @param {Function} params.onComplete - Called when the restore has finished.
 *
 * @example
 * useUrlViewStateRestore({ latest, initialState: { focusId: 'Joseph_1920_152' }, phaseRef, rootId: tree.rootId, isLoading, onComplete });
 *
 * @example
 * useUrlViewStateRestore({ latest, initialState: {}, phaseRef, rootId: null, isLoading: true, onComplete: () => {} });
 */
function useUrlViewStateRestore({ latest, initialState, phaseRef, rootId, isLoading, onComplete }) {
    useEffect(() => {
        if (phaseRef.current.done || !rootId || isLoading) return;
        phaseRef.current.done = true;
        scheduleViewStateRestore({ latest, state: initialState, onComplete });
    }, [rootId, isLoading, latest, initialState, phaseRef, onComplete]);
}

/**
 * Debounced effect mirroring every meaningful UI change (focus, filter, map, sidebar, zoom, pan,
 * collapsed branches) into the URL hash. Writes are suppressed while loading, dragging, or during
 * live-sync camera shifts, and until the initial URL restore has completed.
 *
 * @param {Object} params - Live hook parameters (see useUrlViewStateSync).
 * @param {{current: {done: boolean, writable: boolean}}} params.phaseRef - Restore lifecycle flags.
 * @param {Function} params.writeNow - Captures and writes the current view state immediately.
 *
 * @example
 * useUrlViewStateWriter({ ...params, phaseRef, writeNow });
 *
 * @example
 * // While dragging no URL write happens; the hash updates once the pointer is released.
 * useUrlViewStateWriter({ ...params, isDragging: true, phaseRef, writeNow });
 */
function useUrlViewStateWriter(params) {
    const {
        focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, collapsedNodes, isLoading,
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, tree, phaseRef, writeNow
    } = params;
    useEffect(() => {
        if (!phaseRef.current.writable || isLoading || isDragging || isShifting) return undefined;
        const timer = setTimeout(writeNow, VIEW_STATE_WRITE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [focusId, isSidebarVisible, activeFilter, showMap, camera, ppy, collapsedNodes, isLoading,
        isDragging, isShifting, isAnySidebarOpen, sidebarWidth, tree, phaseRef, writeNow]);
}

/**
 * Captures the live view (anchor card, offset, zoom, selection, sibling-bar folds) and writes the
 * ultra-short bit-packed packet to the URL hash.
 *
 * @param {Object} p - Latest hook parameters (see useUrlViewStateSync).
 * @returns {boolean} True when the address bar was updated.
 *
 * @example
 * captureAndWriteViewState(latest.current);
 * // address bar => …#e4K10p890
 *
 * @example
 * captureAndWriteViewState({ ...latest.current, showMap: true });
 * // address bar => …#2
 */
function captureAndWriteViewState(p) {
    const viewport = measureViewStateViewport({
        container: p.containerRef.current, isSidebarOpen: p.isAnySidebarOpen,
        sidebarWidth: p.sidebarWidth, bottomSheetHeight: p.bottomSheetHeight || 0
    });
    const anchor = p.showMap ? null : chooseViewStateAnchor({
        treeElement: p.treeRef ? p.treeRef.current : null, tree: p.tree, focusId: p.focusId, camera: p.camera, viewport
    });
    const state = buildCurrentViewState({
        focusId: p.focusId, isSidebarVisible: p.isSidebarVisible, activeFilter: p.activeFilter, showMap: p.showMap,
        camera: p.camera, ppy: p.ppy, viewport, anchor, collapsedNodes: p.collapsedNodes
    });
    return writeViewStateHash(encodeViewStateHash(state, p.tree));
}

/**
 * Picks the view-state hash to restore on startup: an explicit `#…` hash in the URL always wins;
 * when the URL has no hash (e.g. opening `https://google.github.io/family-tree/` or `localhost:8000/`),
 * falls back to the last view-state hash saved in browser preferences unless a sheet was explicitly
 * requested via `?id=` without a hash.
 *
 * @param {string|null} [locationHash=null] - `window.location.hash` override
 * @param {string|null} [searchString=null] - `window.location.search` override
 * @param {string} [storedHash=loadLastViewStateHash()] - Saved hash body from preferences
 * @returns {string} Hash string to pass to `parseViewStateHash`
 *
 * @example
 * resolveInitialViewStateHash('#p=Joseph_1920_152', '', 'v=map');
 * // => '#p=Joseph_1920_152'
 *
 * @example
 * resolveInitialViewStateHash('', '', 'p=Joseph_1920_152&z=0.8');
 * // => 'p=Joseph_1920_152&z=0.8'
 */
function resolveInitialViewStateHash(locationHash = null, searchString = null, storedHash = loadLastViewStateHash()) {
    const rawHash = locationHash !== null
        ? String(locationHash)
        : (typeof window !== 'undefined' && window.location ? String(window.location.hash || '') : '');
    if (rawHash.replace(/^#/, '').trim()) return rawHash;
    if (hasExplicitSheetQueryParam(searchString)) return '';
    return storedHash || '';
}

/**
 * Keeps the browser URL in sync with the current view (Google-Maps style) and restores the view
 * from the URL (or the last saved view state) on startup. Mount once from the application view model.
 *
 * @param {Object} params - Live application state and handlers.
 * @param {FamilyTree} params.tree - Loaded tree.
 * @param {string|null} params.focusId - Focused person ID.
 * @param {Object|null} params.activeFilter - Active filter descriptor.
 * @param {boolean} params.showMap - Map view flag.
 * @param {boolean} params.isSidebarVisible - Person sidebar flag.
 * @param {boolean} params.isAnySidebarOpen - Whether any sidebar panel is open.
 * @param {number} params.sidebarWidth - Sidebar width in pixels.
 * @param {boolean} params.isLoading - Dataset import in flight.
 * @param {boolean} params.isDragging - Pointer drag in progress.
 * @param {boolean} params.isShifting - Live-sync camera shift in progress.
 * @param {{x: number, y: number, z: number}} params.camera - Camera transform.
 * @param {Function} params.setCamera - Camera setter.
 * @param {Function} params.clampCamera - Camera bounds clamp.
 * @param {Function} params.getPpy - Pixels-per-year resolver.
 * @param {number} params.ppy - Current pixels-per-year.
 * @param {Set<string>} params.collapsedNodes - Collapsed branch IDs.
 * @param {Function} params.setCollapsedNodes - Collapsed set setter.
 * @param {{current: HTMLElement|null}} params.containerRef - Canvas container ref.
 * @param {{current: HTMLElement|null}} params.treeRef - Inner tree element ref (person cards).
 * @param {Function} params.handleSetFocusId - Person focus handler.
 * @param {Function} params.handleFilterBy - Filter handler.
 * @param {Function} params.setShowMap - Map setter.
 * @param {Function} params.setIsSidebarVisible - Sidebar setter.
 * @param {Function} params.setActiveFilter - Filter setter.
 * @param {Function} params.setFocusId - Focus setter.
 *
 * @example
 * useUrlViewStateSync({ ...core, ...viewport, ...focusNav });
 *
 * @example
 * // Opening https://google.github.io/family-tree/#p=Joseph_1920_152&z=0.8&o=-320,12.5
 * // focuses Joseph and places the viewport centre 320 tree px left of and 12.5 years below his card at zoom 0.8.
 * useUrlViewStateSync(params);
 */
function useUrlViewStateSync(params) {
    const latest = useRef(params);
    latest.current = params;
    const phaseRef = useRef({ done: false, writable: false });
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        initialStateRef.current = parseViewStateHash(resolveInitialViewStateHash());
    }
    const writeNow = useCallback(() => captureAndWriteViewState(latest.current), []);
    const onComplete = useCallback(() => {
        phaseRef.current.writable = true;
        setTimeout(writeNow, VIEW_STATE_WRITE_DEBOUNCE_MS);
    }, [writeNow]);
    useUrlViewStateRestore({
        latest, initialState: initialStateRef.current, phaseRef,
        rootId: params.tree.rootId, isLoading: params.isLoading, onComplete
    });
    useUrlViewStateWriter({ ...params, phaseRef, writeNow });
}
