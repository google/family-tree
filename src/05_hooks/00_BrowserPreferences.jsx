// ============================================================================
// MODULE 5.0: BROWSER PREFERENCES — cookie-backed persistence of the Google Sheet
// history shown on the home screen, the user-tuned demographic settings and the
// chosen colour theme.
//
// Everything the user has typed or chosen stays in THIS browser (first-party
// cookie mirrored into localStorage for file:// standalone exports where
// document.cookie is inert). Nothing is ever sent to a server; the GDPR note on
// the home screen describes exactly these three cookies.
// ============================================================================

/** Cookie holding the ranked list of every Google Sheet the user has opened. */
const SHEET_HISTORY_COOKIE = 'ft_sheet_history';
/** Cookie holding the user-tuned demographic deduction settings (JSON). */
const DEMOGRAPHIC_SETTINGS_COOKIE = 'ft_demographic_settings';
/** Cookie holding the id of the chosen colour theme (see COLOR_THEMES). */
const COLOR_THEME_COOKIE = 'ft_color_theme';
/** Cookie holding the last URL hash view state (p=…&z=…&o=…&v=map) for session restore. */
const LAST_VIEW_STATE_COOKIE = 'ft_last_view_state';
/** Cookie holding background-geocoded location coordinates and hierarchies (JSON). */
const GEO_CACHE_COOKIE = 'ft_geo_cache';
/** Keep the URL-encoded geo-cache cookie payload under this many characters. */
const GEO_CACHE_COOKIE_BUDGET = 3400;
/** Preferences survive one year of inactivity; every write refreshes the clock. */
const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
/** Browsers cap a single cookie at 4096 bytes; a dozen compact entries stay well below. */
const SHEET_HISTORY_LIMIT = 12;
/** Longest sheet title persisted per entry (characters). */
const SHEET_TITLE_MAX_LENGTH = 60;
/** Keep the URL-encoded cookie payload under this many characters. */
const SHEET_HISTORY_COOKIE_BUDGET = 3500;
/** The public demo spreadsheet offered when the browser has never opened a sheet. */
const DEMO_SHEET_ID = '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0';
/** Human title of the demo spreadsheet (what Google reports in Content-Disposition). */
const DEMO_SHEET_TITLE = 'Ancestry Browser: Demo';
/** Sheet IDs are 35-60 URL-safe characters; the whole string must be the token. */
const SHEET_ID_EXACT_PATTERN = /^[a-zA-Z0-9-_]{35,60}$/;

// ─── Cookie primitives (pure parsers + thin DOM shells) ─────────────────────

/**
 * Finds one named cookie inside a raw `document.cookie` string and URL-decodes it.
 * Pure: the cookie string is passed in, so it is unit-testable without a DOM.
 *
 * @param {string} cookieString - Raw `document.cookie` text (`a=1; b=2`)
 * @param {string} name - Cookie name to look up
 * @returns {string|null} Decoded value, or null when absent
 *
 * @example
 * parseCookieHeader('theme=dark; ft_sheet_history=%5B%5D', 'ft_sheet_history');
 * // => '[]'
 *
 * @example
 * parseCookieHeader('theme=dark', 'missing');
 * // => null
 */
function parseCookieHeader(cookieString, name) {
    if (!cookieString || !name) return null;
    const prefix = `${name}=`;
    for (const part of String(cookieString).split(';')) {
        const trimmed = part.trim();
        if (!trimmed.startsWith(prefix)) continue;
        const rawValue = trimmed.slice(prefix.length);
        try {
            return decodeURIComponent(rawValue);
        } catch (e) {
            return rawValue;
        }
    }
    return null;
}

/**
 * Builds the `document.cookie` assignment string for a first-party preference cookie:
 * URL-encoded value, site-wide path, one-year max-age, `SameSite=Lax`, and `Secure` on https.
 *
 * @param {string} name - Cookie name
 * @param {string} value - Raw value (will be URL-encoded)
 * @param {number} [maxAgeSeconds=PREFERENCE_COOKIE_MAX_AGE_SECONDS] - Lifetime; 0 deletes
 * @param {boolean} [secure=false] - Append the `Secure` attribute
 * @returns {string} Cookie assignment string
 *
 * @example
 * buildCookieAssignment('ft_demo', 'a b', 60);
 * // => 'ft_demo=a%20b; path=/; max-age=60; SameSite=Lax'
 *
 * @example
 * buildCookieAssignment('ft_demo', '', 0, true);
 * // => 'ft_demo=; path=/; max-age=0; SameSite=Lax; Secure'
 */
function buildCookieAssignment(name, value, maxAgeSeconds = PREFERENCE_COOKIE_MAX_AGE_SECONDS, secure = false) {
    const encoded = encodeURIComponent(value == null ? '' : String(value));
    const maxAge = Math.max(0, Math.floor(Number(maxAgeSeconds) || 0));
    return `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Reads one cookie from the live document (null outside a browser or when absent).
 *
 * @param {string} name - Cookie name
 * @returns {string|null} Decoded cookie value or null
 *
 * @example
 * readCookieValue('ft_sheet_history');
 * // => '[{"i":"1BQvy...","t":"Ancestry Browser: Demo","n":3,"l":1759478400}]'
 *
 * @example
 * readCookieValue('never_set');
 * // => null
 */
function readCookieValue(name) {
    if (typeof document === 'undefined') return null;
    try {
        return parseCookieHeader(document.cookie, name);
    } catch (e) {
        return null;
    }
}

/**
 * Writes (or, with `maxAgeSeconds = 0`, deletes) one first-party cookie on the live document.
 *
 * @param {string} name - Cookie name
 * @param {string} value - Raw value
 * @param {number} [maxAgeSeconds=PREFERENCE_COOKIE_MAX_AGE_SECONDS] - Lifetime in seconds
 * @returns {boolean} True when the assignment did not throw (file:// silently ignores cookies)
 *
 * @example
 * writeCookieValue('ft_demographic_settings', JSON.stringify({ spousalGenderOffset: 3 }));
 * // => true
 *
 * @example
 * writeCookieValue('ft_demographic_settings', '', 0); // delete
 */
function writeCookieValue(name, value, maxAgeSeconds = PREFERENCE_COOKIE_MAX_AGE_SECONDS) {
    if (typeof document === 'undefined') return false;
    try {
        const secure = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
        document.cookie = buildCookieAssignment(name, value, maxAgeSeconds, secure);
        return true;
    } catch (e) {
        return false;
    }
}

// ─── Preference store: cookie first, localStorage mirror second ─────────────

/**
 * localStorage key mirroring a preference cookie (standalone `.html` exports run from
 * `file://`, where `document.cookie` is a no-op but localStorage still works).
 *
 * @param {string} name - Cookie name
 * @returns {string} Mirror key
 *
 * @example
 * preferenceStorageKey('ft_sheet_history');
 * // => 'ft_pref_ft_sheet_history'
 *
 * @example
 * preferenceStorageKey('ft_demographic_settings');
 * // => 'ft_pref_ft_demographic_settings'
 */
function preferenceStorageKey(name) {
    return `ft_pref_${name}`;
}

/**
 * Reads a preference: the cookie wins, the localStorage mirror is the fallback.
 *
 * @param {string} name - Preference (cookie) name
 * @returns {string|null} Stored raw string or null
 *
 * @example
 * readPreference('ft_demographic_settings');
 * // => '{"spousalGenderOffset":3,...}'
 *
 * @example
 * readPreference('ft_sheet_history'); // never written
 * // => null
 */
function readPreference(name) {
    const fromCookie = readCookieValue(name);
    if (fromCookie !== null && fromCookie !== '') return fromCookie;
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(preferenceStorageKey(name));
    } catch (e) {
        return null;
    }
}

/**
 * Writes a preference to both the cookie and its localStorage mirror.
 *
 * @param {string} name - Preference (cookie) name
 * @param {string} value - Raw string value
 * @returns {boolean} Whether the cookie assignment succeeded
 *
 * @example
 * writePreference('ft_sheet_history', '[]');
 * // => true
 *
 * @example
 * writePreference('ft_demographic_settings', JSON.stringify(settings));
 */
function writePreference(name, value) {
    const wroteCookie = writeCookieValue(name, value);
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(preferenceStorageKey(name), value);
        } catch (e) {
            // Quota exceeded or privacy mode: the cookie (if any) is still authoritative.
        }
    }
    return wroteCookie;
}

/**
 * Deletes a preference from the cookie jar and the localStorage mirror.
 *
 * @param {string} name - Preference (cookie) name
 *
 * @example
 * removePreference('ft_sheet_history');
 *
 * @example
 * removePreference('ft_demographic_settings');
 * readPreference('ft_demographic_settings'); // => null
 */
function removePreference(name) {
    writeCookieValue(name, '', 0);
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem(preferenceStorageKey(name));
        } catch (e) {
            // Nothing to clean up in privacy mode.
        }
    }
}

// ─── Sheet history: ranked record of every spreadsheet ever opened ──────────

/**
 * @typedef {Object} SheetHistoryEntry
 * @property {string} id - Google Sheet ID
 * @property {string} title - Spreadsheet title ('' when never learned)
 * @property {number} uses - How many times the sheet was loaded
 * @property {number} lastUsed - Unix time (ms) of the latest load
 */

/**
 * Whether a string is exactly one Google Sheet ID token (35-60 URL-safe characters).
 *
 * @param {*} id - Candidate
 * @returns {boolean}
 *
 * @example
 * isValidSheetId('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => true
 *
 * @example
 * isValidSheetId('https://docs.google.com/spreadsheets/d/1BQvy/edit');
 * // => false (not a bare token)
 */
function isValidSheetId(id) {
    return typeof id === 'string' && SHEET_ID_EXACT_PATTERN.test(id);
}

/**
 * Orders history entries most-used first, breaking ties by most recent use, then by ID
 * for determinism. Returns a new array; the input is not mutated.
 *
 * @param {Array<SheetHistoryEntry>} entries - Unordered entries
 * @returns {Array<SheetHistoryEntry>} Ranked copy
 *
 * @example
 * rankSheetHistory([{ id: 'a', uses: 1, lastUsed: 9 }, { id: 'b', uses: 5, lastUsed: 1 }]).map(e => e.id);
 * // => ['b', 'a']
 *
 * @example
 * rankSheetHistory([{ id: 'a', uses: 2, lastUsed: 1 }, { id: 'b', uses: 2, lastUsed: 7 }]).map(e => e.id);
 * // => ['b', 'a'] (same use count, b is more recent)
 */
function rankSheetHistory(entries) {
    return [...(entries || [])].sort((a, b) =>
        (b.uses - a.uses) || (b.lastUsed - a.lastUsed) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Parses the persisted JSON (compact keys `i`/`t`/`n`/`l`, long keys also accepted),
 * dropping corrupt, duplicate, or non-ID entries so a damaged cookie can never crash the UI.
 *
 * @param {string|null} json - Raw stored JSON
 * @returns {Array<SheetHistoryEntry>} Clean, ranked entries (at most SHEET_HISTORY_LIMIT)
 *
 * @example
 * parseSheetHistoryJson('[{"i":"1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0","t":"Demo","n":2,"l":5}]');
 * // => [{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 2, lastUsed: 5 }]
 *
 * @example
 * parseSheetHistoryJson('not json');
 * // => []
 */
function parseSheetHistoryJson(json) {
    if (!json) return [];
    let parsed;
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const entries = [];
    for (const raw of parsed) {
        const id = raw && (raw.i || raw.id);
        if (!isValidSheetId(id) || seen.has(id)) continue;
        seen.add(id);
        const title = raw.t !== undefined ? raw.t : raw.title;
        entries.push({
            id,
            title: typeof title === 'string' ? title.slice(0, SHEET_TITLE_MAX_LENGTH) : '',
            uses: Math.max(1, Math.round(Number(raw.n !== undefined ? raw.n : raw.uses) || 1)),
            lastUsed: Math.max(0, Math.round(Number(raw.l !== undefined ? raw.l : raw.lastUsed) || 0)),
        });
    }
    return rankSheetHistory(entries).slice(0, SHEET_HISTORY_LIMIT);
}

/**
 * Serializes entries with compact keys, trimming the lowest-ranked entries until the
 * URL-encoded payload fits the cookie budget (browsers drop over-size cookies silently).
 *
 * @param {Array<SheetHistoryEntry>} entries - Entries to persist
 * @param {number} [budget=SHEET_HISTORY_COOKIE_BUDGET] - Max encoded length
 * @returns {string} JSON text
 *
 * @example
 * serializeSheetHistory([{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 1, lastUsed: 5 }]);
 * // => '[{"i":"1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0","t":"Demo","n":1,"l":5}]'
 *
 * @example
 * serializeSheetHistory([]);
 * // => '[]'
 */
function serializeSheetHistory(entries, budget = SHEET_HISTORY_COOKIE_BUDGET) {
    const ranked = rankSheetHistory(entries).slice(0, SHEET_HISTORY_LIMIT);
    const toJson = (list) => JSON.stringify(list.map(e => ({
        i: e.id, t: (e.title || '').slice(0, SHEET_TITLE_MAX_LENGTH), n: e.uses, l: e.lastUsed
    })));
    let json = toJson(ranked);
    while (ranked.length > 1 && encodeURIComponent(json).length > budget) {
        ranked.pop();
        json = toJson(ranked);
    }
    return json;
}

/**
 * Returns a new history with one more use of `id`: an existing entry gains a use and a
 * fresher title (when one is supplied), a new entry starts at one use. Pure function.
 *
 * @param {Array<SheetHistoryEntry>} entries - Current history
 * @param {string} id - Sheet ID that was just loaded
 * @param {string} [title=''] - Spreadsheet title if known
 * @param {number} [now=Date.now()] - Timestamp of the use
 * @returns {Array<SheetHistoryEntry>} Ranked, capped history
 *
 * @example
 * mergeSheetHistoryEntry([], '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', 'Demo', 100);
 * // => [{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 1, lastUsed: 100 }]
 *
 * @example
 * const once = mergeSheetHistoryEntry([], '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', '', 100);
 * mergeSheetHistoryEntry(once, '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', 'Demo', 200)[0];
 * // => { id: '1BQvy…', title: 'Demo', uses: 2, lastUsed: 200 }
 */
function mergeSheetHistoryEntry(entries, id, title = '', now = Date.now()) {
    if (!isValidSheetId(id)) return rankSheetHistory(entries);
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, SHEET_TITLE_MAX_LENGTH) : '';
    const existing = (entries || []).find(e => e.id === id);
    const others = (entries || []).filter(e => e.id !== id);
    const merged = existing
        ? { ...existing, title: cleanTitle || existing.title || '', uses: existing.uses + 1, lastUsed: now }
        : { id, title: cleanTitle, uses: 1, lastUsed: now };
    return rankSheetHistory([merged, ...others]).slice(0, SHEET_HISTORY_LIMIT);
}

/**
 * Picks the most-used sheet (ties → most recent), or null for an empty history.
 *
 * @param {Array<SheetHistoryEntry>} entries - History
 * @returns {SheetHistoryEntry|null}
 *
 * @example
 * resolveMostUsedSheet([{ id: 'a', uses: 1, lastUsed: 1 }, { id: 'b', uses: 4, lastUsed: 1 }]).id;
 * // => 'b'
 *
 * @example
 * resolveMostUsedSheet([]);
 * // => null
 */
function resolveMostUsedSheet(entries) {
    const ranked = rankSheetHistory(entries);
    return ranked.length > 0 ? ranked[0] : null;
}

/**
 * Picks the most recently opened sheet (highest `lastUsed` timestamp, ties → most uses),
 * or null for an empty history. Used when reopening the site without `?id=` in the URL.
 *
 * @param {Array<SheetHistoryEntry>} entries - History
 * @returns {SheetHistoryEntry|null}
 *
 * @example
 * resolveLastUsedSheet([{ id: 'a', uses: 5, lastUsed: 10 }, { id: 'b', uses: 1, lastUsed: 99 }]).id;
 * // => 'b'
 *
 * @example
 * resolveLastUsedSheet([]);
 * // => null
 */
function resolveLastUsedSheet(entries) {
    const sorted = [...(entries || [])].sort((a, b) =>
        (b.lastUsed - a.lastUsed) || (b.uses - a.uses) || String(a.id).localeCompare(String(b.id)));
    return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Loads the persisted sheet history from the cookie (or its localStorage mirror).
 *
 * @returns {Array<SheetHistoryEntry>} Ranked entries, [] when nothing is stored
 *
 * @example
 * readSheetHistory();
 * // => [{ id: '1BQvy…', title: 'Ancestry Browser: Demo', uses: 3, lastUsed: 1759478400000 }]
 *
 * @example
 * readSheetHistory(); // fresh browser
 * // => []
 */
function readSheetHistory() {
    return parseSheetHistoryJson(readPreference(SHEET_HISTORY_COOKIE));
}

/**
 * Persists the sheet history (cookie + localStorage mirror).
 *
 * @param {Array<SheetHistoryEntry>} entries - Entries to store
 * @returns {Array<SheetHistoryEntry>} The ranked entries that were written
 *
 * @example
 * writeSheetHistory([{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 1, lastUsed: Date.now() }]);
 *
 * @example
 * writeSheetHistory([]); // forget everything
 */
function writeSheetHistory(entries) {
    const ranked = rankSheetHistory(entries).slice(0, SHEET_HISTORY_LIMIT);
    writePreference(SHEET_HISTORY_COOKIE, serializeSheetHistory(ranked));
    return ranked;
}

/**
 * Records one successful load of a sheet (bumping its use count) and persists the history.
 *
 * @param {string} id - Sheet ID that was loaded
 * @param {string} [title=''] - Spreadsheet title when known
 * @param {number} [now=Date.now()] - Timestamp
 * @returns {Array<SheetHistoryEntry>} Updated ranked history
 *
 * @example
 * recordSheetUse('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', 'Ancestry Browser: Demo');
 *
 * @example
 * recordSheetUse('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0'); // title still unknown
 */
function recordSheetUse(id, title = '', now = Date.now()) {
    return writeSheetHistory(mergeSheetHistoryEntry(readSheetHistory(), id, title, now));
}

/**
 * Removes one sheet from the persisted history (the "×" in the home-screen dropdown).
 *
 * @param {string} id - Sheet ID to forget
 * @returns {Array<SheetHistoryEntry>} Remaining ranked history
 *
 * @example
 * forgetSheetHistoryEntry('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 *
 * @example
 * forgetSheetHistoryEntry('unknown-id'); // no-op, returns the unchanged history
 */
function forgetSheetHistoryEntry(id) {
    return writeSheetHistory(readSheetHistory().filter(e => e.id !== id));
}

// ─── Sheet references: URLs and bare IDs typed, pasted, or copied ───────────

/**
 * Canonical edit URL for a sheet ID (what the history dropdown and deep links use).
 *
 * @param {string} id - Sheet ID
 * @returns {string} `https://docs.google.com/spreadsheets/d/<id>/edit`
 *
 * @example
 * buildSheetUrlFromId('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => 'https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit'
 *
 * @example
 * buildSheetUrlFromId(DEMO_SHEET_ID).startsWith('https://docs.google.com/spreadsheets/d/');
 * // => true
 */
function buildSheetUrlFromId(id) {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/**
 * Normalizes whatever the user typed into `{ id, url }`: a Google Sheets/Drive URL
 * containing an ID, or a bare ID token. Anything else (prose, other sites) → null.
 *
 * @param {string} text - Raw textbox / clipboard content
 * @returns {{id: string, url: string}|null}
 *
 * @example
 * normalizeSheetReference(' https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit?usp=drive_link ');
 * // => { id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', url: 'https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit' }
 *
 * @example
 * normalizeSheetReference('https://example.com/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => null (not a Google host)
 */
function normalizeSheetReference(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2048) return null;
    const isGoogleUrl = /^(https?:\/\/)?(docs|drive|sheets)\.google\.com\//i.test(trimmed);
    const bareId = SHEET_ID_EXACT_PATTERN.test(trimmed) ? trimmed : null;
    const id = bareId || (isGoogleUrl ? extractSheetIdFromUrl(trimmed) : null);
    if (!id) return null;
    return { id, url: buildSheetUrlFromId(id) };
}

/**
 * Stricter test used for CLIPBOARD content, where the text was not typed on purpose:
 * Google URLs always qualify, but a bare token must contain an upper-case letter or a
 * `-`/`_` so lower-case hex digests (git SHAs, hashes) are not mistaken for sheet IDs.
 *
 * @param {string} text - Clipboard text
 * @returns {boolean}
 *
 * @example
 * isLikelySheetReference('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => true
 *
 * @example
 * isLikelySheetReference('3bd09a0f6c2e4d1b8a7f9e0c1d2b3a4f5e6d7c8b'); // 40-char git SHA
 * // => false
 */
function isLikelySheetReference(text) {
    const ref = normalizeSheetReference(text);
    if (!ref) return false;
    const trimmed = text.trim();
    if (/google\.com\//i.test(trimmed)) return true;
    return /[A-Z_-]/.test(trimmed);
}

/**
 * Reads the clipboard and returns a sheet reference if (and only if) it plausibly holds
 * one. Permission prompts, unfocused documents, and unsupported browsers all yield null.
 *
 * @returns {Promise<{id: string, url: string}|null>}
 *
 * @example
 * // Clipboard: 'https://docs.google.com/spreadsheets/d/1BQvy…/edit'
 * await readClipboardSheetReference();
 * // => { id: '1BQvy…', url: 'https://docs.google.com/spreadsheets/d/1BQvy…/edit' }
 *
 * @example
 * // Clipboard: 'Dear aunt Mary, ...'
 * await readClipboardSheetReference();
 * // => null
 */
async function readClipboardSheetReference() {
    try {
        if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return null;
        const text = await navigator.clipboard.readText();
        return isLikelySheetReference(text) ? normalizeSheetReference(text) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Decides what the home-screen textbox shows before the user touches it:
 * clipboard sheet → most-used sheet → demo sheet. Never loads anything by itself.
 *
 * @param {{id: string, url: string}|null} clipboardRef - Result of readClipboardSheetReference()
 * @param {Array<SheetHistoryEntry>} history - Persisted history
 * @returns {{id: string, url: string, source: 'clipboard'|'history'|'demo'}}
 *
 * @example
 * resolveHomeScreenPrefill(null, []).source;
 * // => 'demo'
 *
 * @example
 * resolveHomeScreenPrefill(null, [{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: '', uses: 2, lastUsed: 1 }]).source;
 * // => 'history'
 */
function resolveHomeScreenPrefill(clipboardRef, history) {
    if (clipboardRef && clipboardRef.id) {
        return { id: clipboardRef.id, url: clipboardRef.url || buildSheetUrlFromId(clipboardRef.id), source: 'clipboard' };
    }
    const mostUsed = resolveMostUsedSheet(history);
    if (mostUsed) {
        return { id: mostUsed.id, url: buildSheetUrlFromId(mostUsed.id), source: 'history' };
    }
    return { id: DEMO_SHEET_ID, url: DEFAULT_URL, source: 'demo' };
}

/**
 * Dropdown label: the title (or a placeholder) followed by the ID; the rest of the URL
 * is deliberately omitted to save space.
 *
 * @param {SheetHistoryEntry} entry - History entry
 * @returns {string}
 *
 * @example
 * formatSheetHistoryLabel({ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Ancestry Browser: Demo' });
 * // => 'Ancestry Browser: Demo — 1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0'
 *
 * @example
 * formatSheetHistoryLabel({ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: '' });
 * // => 'Untitled sheet — 1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0'
 */
function formatSheetHistoryLabel(entry) {
    const title = ((entry && entry.title) || '').trim() || 'Untitled sheet';
    return `${title} — ${entry.id}`;
}

/**
 * Filters out the spreadsheet currently filled in the input box so the history
 * dropdown only lists alternative sheets rather than duplicating the active value.
 *
 * @param {Array<SheetHistoryEntry>} entries - Ranked history entries
 * @param {string} inputValue - Raw text currently in the input box
 * @returns {Array<SheetHistoryEntry>} Entries whose ID differs from the input's sheet ID
 *
 * @example
 * filterSheetHistoryForInput([{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 2, lastUsed: 1 }], '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => []
 *
 * @example
 * filterSheetHistoryForInput([{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 2, lastUsed: 1 }], '');
 * // => [{ id: '1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', title: 'Demo', uses: 2, lastUsed: 1 }]
 */
function filterSheetHistoryForInput(entries, inputValue) {
    const ref = normalizeSheetReference(inputValue);
    const currentId = ref ? ref.id : '';
    return (entries || []).filter((entry) => Boolean(entry && entry.id && entry.id !== currentId));
}

/**
 * Best-known human title for whatever sits in the home-screen textbox: the history entry's
 * title, else the title learned from a CSV response this session, else the demo title when
 * the text points at the demo sheet; '' when the text is not a sheet reference or unknown.
 *
 * @param {string} text - Raw textbox content (URL or bare ID)
 * @param {Array<SheetHistoryEntry>} [history=readSheetHistory()] - Persisted history
 * @param {Map<string, string>} [registry=sheetTitleRegistry] - Session title registry
 * @returns {string}
 *
 * @example
 * resolveKnownSheetTitle('https://docs.google.com/spreadsheets/d/1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0/edit', [], new Map());
 * // => 'Ancestry Browser: Demo'
 *
 * @example
 * resolveKnownSheetTitle('1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd', [{ id: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd', title: 'Smith family', uses: 1, lastUsed: 1 }], new Map());
 * // => 'Smith family'
 *
 * @example
 * resolveKnownSheetTitle('not a sheet', [], new Map());
 * // => ''
 */
function resolveKnownSheetTitle(text, history = readSheetHistory(), registry = sheetTitleRegistry) {
    const ref = normalizeSheetReference(text);
    if (!ref) return '';
    const entry = (history || []).find((item) => item && item.id === ref.id);
    const fromHistory = entry && typeof entry.title === 'string' ? entry.title.trim() : '';
    if (fromHistory) return fromHistory;
    const fromRegistry = getRememberedSheetTitle(ref.id, registry).trim();
    if (fromRegistry) return fromRegistry;
    return ref.id === DEMO_SHEET_ID ? DEMO_SHEET_TITLE : '';
}

// ─── Sheet titles learned from the CSV export response ──────────────────────

/** In-memory map sheetId → spreadsheet title, filled while crawling. */
const sheetTitleRegistry = new Map();

/**
 * Extracts the file name from a `Content-Disposition` header, preferring the RFC 5987
 * `filename*=UTF-8''…` form (which keeps punctuation Google strips from `filename=`).
 *
 * @param {string|null} header - Header value
 * @returns {string|null} Decoded file name or null
 *
 * @example
 * parseContentDispositionFilename('attachment; filename="AncestryBrowserDemo-Data.csv"; filename*=UTF-8\'\'Ancestry%20Browser%3A%20Demo%20-%20Data.csv');
 * // => 'Ancestry Browser: Demo - Data.csv'
 *
 * @example
 * parseContentDispositionFilename('attachment; filename="Family - Links.csv"');
 * // => 'Family - Links.csv'
 */
function parseContentDispositionFilename(header) {
    if (!header || typeof header !== 'string') return null;
    const star = header.match(/filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i);
    if (star) {
        const raw = star[1].trim();
        try {
            return decodeURIComponent(raw);
        } catch (e) {
            return raw;
        }
    }
    const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
    return plain ? plain[1].trim() : null;
}

/**
 * Turns Google's export file name `<Spreadsheet title> - <Tab name>.csv` into the title.
 * Only the LAST " - " segment is the tab, so titles containing dashes survive.
 *
 * @param {string|null} filename - File name from Content-Disposition
 * @returns {string} Spreadsheet title ('' when unknown)
 *
 * @example
 * deriveSpreadsheetTitle('Ancestry Browser: Demo - Data.csv');
 * // => 'Ancestry Browser: Demo'
 *
 * @example
 * deriveSpreadsheetTitle('Smith - Jones Family - Sheet1.csv');
 * // => 'Smith - Jones Family'
 */
function deriveSpreadsheetTitle(filename) {
    if (!filename) return '';
    let title = String(filename).trim().replace(/\.csv$/i, '');
    const separator = title.lastIndexOf(' - ');
    if (separator > 0) title = title.slice(0, separator);
    return title.trim().slice(0, SHEET_TITLE_MAX_LENGTH);
}

/**
 * Remembers a spreadsheet title for a sheet ID (ignores empty titles).
 *
 * @param {string} sheetId - Sheet ID
 * @param {string} title - Title to remember
 * @param {Map<string, string>} [registry=sheetTitleRegistry] - Target map (injectable for tests)
 * @returns {boolean} Whether something was stored
 *
 * @example
 * rememberSheetTitle('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', 'Ancestry Browser: Demo');
 * // => true
 *
 * @example
 * rememberSheetTitle('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', '');
 * // => false
 */
function rememberSheetTitle(sheetId, title, registry = sheetTitleRegistry) {
    const clean = typeof title === 'string' ? title.trim() : '';
    if (!sheetId || !clean) return false;
    registry.set(sheetId, clean.slice(0, SHEET_TITLE_MAX_LENGTH));
    return true;
}

/**
 * Looks up a remembered spreadsheet title ('' when the crawl never saw one, e.g. when
 * the gviz fallback served the CSV without a Content-Disposition header).
 *
 * @param {string} sheetId - Sheet ID
 * @param {Map<string, string>} [registry=sheetTitleRegistry] - Source map
 * @returns {string}
 *
 * @example
 * rememberSheetTitle('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0', 'Demo');
 * getRememberedSheetTitle('1BQvyFoA_-u4MG-r1SRDel93F1TwEaN3I6v6p-kOH8z0');
 * // => 'Demo'
 *
 * @example
 * getRememberedSheetTitle('never-fetched');
 * // => ''
 */
function getRememberedSheetTitle(sheetId, registry = sheetTitleRegistry) {
    return registry.get(sheetId) || '';
}

/**
 * Captures the spreadsheet title from a CSV export `Response` (Google exposes
 * `Content-Disposition` via CORS). Safe to call with any response; failures are ignored.
 *
 * @param {string} sheetId - Sheet ID the response belongs to
 * @param {Response|{headers: {get: Function}}} response - Fetch response
 * @param {Map<string, string>} [registry=sheetTitleRegistry] - Target map
 * @returns {string} The title learned ('' when none)
 *
 * @example
 * rememberSheetTitleFromResponse('1BQvy…', { headers: { get: () => "attachment; filename*=UTF-8''Ancestry%20Browser%3A%20Demo%20-%20Data.csv" } });
 * // => 'Ancestry Browser: Demo'
 *
 * @example
 * rememberSheetTitleFromResponse('1BQvy…', { headers: { get: () => null } });
 * // => ''
 */
function rememberSheetTitleFromResponse(sheetId, response, registry = sheetTitleRegistry) {
    try {
        const header = response && response.headers && typeof response.headers.get === 'function'
            ? response.headers.get('content-disposition')
            : null;
        const title = deriveSpreadsheetTitle(parseContentDispositionFilename(header));
        rememberSheetTitle(sheetId, title, registry);
        return title;
    } catch (e) {
        return '';
    }
}

// ─── Demographic settings persistence ───────────────────────────────────────

/**
 * Loads the raw user settings object stored by the Settings panel (null when none or corrupt).
 * Sanitization happens in FamilyTreeBuilder.applyDemographicSettings, not here.
 *
 * @returns {Object|null}
 *
 * @example
 * loadStoredDemographicSettings();
 * // => { marriageAgeAnchors: [[1900, 15], ...], spousalGenderOffset: 2, ... }
 *
 * @example
 * loadStoredDemographicSettings(); // nothing stored
 * // => null
 */
function loadStoredDemographicSettings() {
    const raw = readPreference(DEMOGRAPHIC_SETTINGS_COOKIE);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * Sanitizes and persists settings from the Settings panel.
 *
 * @param {Object} settings - Settings in DEFAULT_DEMOGRAPHIC_SETTINGS shape (partial allowed)
 * @returns {Object} The sanitized settings that were stored
 *
 * @example
 * saveDemographicSettings({ spousalGenderOffset: 3 }).spousalGenderOffset;
 * // => 3
 *
 * @example
 * saveDemographicSettings({ consecutiveSiblingGap: 99 }).consecutiveSiblingGap;
 * // => 2 (out-of-range value replaced by the default before storing)
 */
function saveDemographicSettings(settings) {
    const clean = FamilyTreeBuilder.sanitizeDemographicSettings(settings);
    writePreference(DEMOGRAPHIC_SETTINGS_COOKIE, JSON.stringify(clean));
    return clean;
}

/**
 * Forgets the stored settings (the model itself is reset by the caller if desired).
 *
 * @example
 * clearStoredDemographicSettings();
 *
 * @example
 * clearStoredDemographicSettings();
 * loadStoredDemographicSettings(); // => null
 */
function clearStoredDemographicSettings() {
    removePreference(DEMOGRAPHIC_SETTINGS_COOKIE);
}

/**
 * Installs the stored settings into the live model at startup, BEFORE the first build,
 * so a returning user sees the tree deduced with their own conventions.
 *
 * @returns {Object|null} The applied settings, or null when nothing was stored
 *
 * @example
 * applyStoredDemographicSettings(); // cookie holds { spousalGenderOffset: 4 }
 * FamilyTreeBuilder.GENERATIONAL_GAPS.SPOUSAL_GENDER_OFFSET; // => 4
 *
 * @example
 * applyStoredDemographicSettings(); // nothing stored
 * // => null (shipped defaults untouched)
 */
function applyStoredDemographicSettings() {
    const stored = loadStoredDemographicSettings();
    if (!stored) return null;
    return FamilyTreeBuilder.applyDemographicSettings(stored);
}

// ─── Colour theme persistence ───────────────────────────────────────────────

/**
 * Reads the stored theme id, or null when nothing (or an unknown / retired id) is stored.
 *
 * @returns {string|null}
 *
 * @example
 * saveColorThemeId('dark');
 * loadStoredColorThemeId(); // => 'dark'
 *
 * @example
 * writePreference(COLOR_THEME_COOKIE, 'neon-1999');
 * loadStoredColorThemeId(); // => null (unknown ids are ignored)
 */
function loadStoredColorThemeId() {
    const raw = readPreference(COLOR_THEME_COOKIE);
    return isKnownColorThemeId(raw) ? raw : null;
}

/**
 * Persists the chosen theme id (unknown ids are rejected and nothing is written).
 *
 * @param {string} id - One of COLOR_THEMES[].id
 * @returns {boolean} true when stored
 *
 * @example
 * saveColorThemeId('earthy'); // => true
 *
 * @example
 * saveColorThemeId('not-a-theme'); // => false
 */
function saveColorThemeId(id) {
    if (!isKnownColorThemeId(id)) return false;
    writePreference(COLOR_THEME_COOKIE, id);
    return true;
}

/**
 * Forgets the stored theme (the page keeps its current colours until re-applied).
 *
 * @example
 * clearStoredColorTheme();
 * loadStoredColorThemeId(); // => null
 *
 * @example
 * saveColorThemeId('pastel'); clearStoredColorTheme(); readPreference(COLOR_THEME_COOKIE); // => null
 */
function clearStoredColorTheme() {
    removePreference(COLOR_THEME_COOKIE);
}

/**
 * Applies the stored theme (or Classic) to the document at startup and returns it.
 *
 * @returns {Object} The resolved theme (`{ id, name, mode, roles, … }`)
 *
 * @example
 * saveColorThemeId('dark');
 * applyStoredColorTheme().id; // => 'dark' (<html data-theme="dark">)
 *
 * @example
 * clearStoredColorTheme();
 * applyStoredColorTheme().id; // => 'classic'
 */
function applyStoredColorTheme() {
    return applyColorTheme(loadStoredColorThemeId() || DEFAULT_COLOR_THEME_ID);
}

// ─── Last view state persistence (for resuming previous view on bare URL open) ─

/**
 * Reads the last saved view-state hash body (without leading `#`), or '' when none is stored.
 *
 * @returns {string}
 *
 * @example
 * saveLastViewStateHash('p=Joseph_1920_152&z=0.8');
 * loadLastViewStateHash(); // => 'p=Joseph_1920_152&z=0.8'
 *
 * @example
 * clearLastViewStateHash();
 * loadLastViewStateHash(); // => ''
 */
function loadLastViewStateHash() {
    const raw = readPreference(LAST_VIEW_STATE_COOKIE);
    return typeof raw === 'string' ? raw.replace(/^#/, '').trim() : '';
}

/**
 * Persists the latest view-state hash body so reopening the site at its root URL restores
 * the exact view (focused person, zoom, pan offset, filter, or map mode).
 *
 * @param {string} hashBody - Hash body with or without leading `#`
 * @returns {string} The normalized hash body that was written
 *
 * @example
 * saveLastViewStateHash('#p=Joseph_1920_152&z=0.8');
 * // => 'p=Joseph_1920_152&z=0.8'
 *
 * @example
 * saveLastViewStateHash('');
 * // => ''
 */
function saveLastViewStateHash(hashBody) {
    const clean = typeof hashBody === 'string' ? hashBody.replace(/^#/, '').trim().slice(0, 1800) : '';
    writePreference(LAST_VIEW_STATE_COOKIE, clean);
    return clean;
}

/**
 * Removes the stored view-state hash.
 *
 * @example
 * clearLastViewStateHash();
 * loadLastViewStateHash(); // => ''
 *
 * @example
 * saveLastViewStateHash('v=map'); clearLastViewStateHash(); readPreference(LAST_VIEW_STATE_COOKIE); // => null
 */
function clearLastViewStateHash() {
    removePreference(LAST_VIEW_STATE_COOKIE);
}

// ─── Background-geocoded location cache (cookie + localStorage mirror) ──────

/** In-memory mirror of `ft_geo_cache` so synchronous coordinate/hierarchy lookups are O(1). */
const geoLocationMemoryCache = new Map();
let geoLocationCacheRawSnapshot = null;

/**
 * Validates and normalizes one cached geocoding entry (`{ coords: [lat, lng], country, state, district }`).
 *
 * @param {*} entry - Candidate cache value
 * @returns {{coords: [number, number], country: string|null, state: string|null, district: string|null}|null}
 *
 * @example
 * sanitizeGeoCacheEntry({ coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' });
 * // => { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' }
 *
 * @example
 * sanitizeGeoCacheEntry({ coords: ['bad', 0] });
 * // => null
 */
function sanitizeGeoCacheEntry(entry) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.coords) || entry.coords.length !== 2) return null;
    const lat = Number(entry.coords[0]);
    const lng = Number(entry.coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const roundCoord = (n) => Math.round(n * 10000) / 10000;
    return {
        coords: [roundCoord(lat), roundCoord(lng)],
        country: typeof entry.country === 'string' && entry.country.trim() ? entry.country.trim() : null,
        state: typeof entry.state === 'string' && entry.state.trim() ? entry.state.trim() : null,
        district: typeof entry.district === 'string' && entry.district.trim() ? entry.district.trim() : null
    };
}

/**
 * Parses a JSON string of cached geocoded locations into a validated `{ [normPlace]: entry }` map.
 *
 * @param {string|null} raw - Raw JSON text from `ft_geo_cache`
 * @returns {Object<string, {coords: [number, number], country: string|null, state: string|null, district: string|null}>}
 *
 * @example
 * parseGeoLocationCacheJson('{"edappilly":{"coords":[10.025,76.308],"country":"India","state":"Kerala","district":"Ernakulam"}}');
 * // => { edappilly: { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' } }
 *
 * @example
 * parseGeoLocationCacheJson('not-json');
 * // => {}
 */
function parseGeoLocationCacheJson(raw) {
    if (!raw || typeof raw !== 'string') return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const clean = {};
        for (const [key, val] of Object.entries(parsed)) {
            const normKey = String(key || '').toLowerCase().trim();
            const entry = sanitizeGeoCacheEntry(val);
            if (normKey && entry) clean[normKey] = entry;
        }
        return clean;
    } catch (e) {
        return {};
    }
}

/**
 * Serializes a geo-location cache map to a compact JSON string that fits within the browser cookie budget.
 *
 * @param {Object<string, Object>} cacheObj - Map of normalized place → entry
 * @returns {string} JSON text
 *
 * @example
 * serializeGeoLocationCache({ edappilly: { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' } });
 * // => '{"edappilly":{"coords":[10.025,76.308],"country":"India","state":"Kerala","district":"Ernakulam"}}'
 *
 * @example
 * serializeGeoLocationCache({});
 * // => '{}'
 */
function serializeGeoLocationCache(cacheObj) {
    const entries = Object.entries(cacheObj || {})
        .map(([k, v]) => [String(k || '').toLowerCase().trim(), sanitizeGeoCacheEntry(v)])
        .filter(([k, v]) => k && v);
    let json = JSON.stringify(Object.fromEntries(entries));
    while (entries.length > 1 && encodeURIComponent(json).length > GEO_CACHE_COOKIE_BUDGET) {
        entries.shift();
        json = JSON.stringify(Object.fromEntries(entries));
    }
    return json;
}

/**
 * Loads the persisted geocoding cache from the `ft_geo_cache` cookie/localStorage and syncs the in-memory map.
 *
 * @returns {Object<string, {coords: [number, number], country: string|null, state: string|null, district: string|null}>}
 *
 * @example
 * saveCachedGeoLocation('Edappilly', { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' });
 * loadGeoLocationCache().edappilly.coords; // => [10.025, 76.308]
 *
 * @example
 * clearGeoLocationCache();
 * loadGeoLocationCache(); // => {}
 */
function loadGeoLocationCache() {
    const raw = readPreference(GEO_CACHE_COOKIE);
    if (raw !== geoLocationCacheRawSnapshot) {
        geoLocationMemoryCache.clear();
        const parsed = parseGeoLocationCacheJson(raw);
        for (const [k, v] of Object.entries(parsed)) {
            geoLocationMemoryCache.set(k, v);
        }
        geoLocationCacheRawSnapshot = raw;
    }
    return Object.fromEntries(geoLocationMemoryCache.entries());
}

/**
 * Synchronously looks up a place in the browser geocoding cache (hydrating from `ft_geo_cache` if needed).
 *
 * @param {string} place - Raw or normalized location name
 * @returns {{coords: [number, number], country: string|null, state: string|null, district: string|null}|null}
 *
 * @example
 * saveCachedGeoLocation('Edappilly', { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' });
 * getCachedGeoLocation('edappilly').coords; // => [10.025, 76.308]
 *
 * @example
 * getCachedGeoLocation('unknown-village-xyz'); // => null
 */
function getCachedGeoLocation(place) {
    if (!place || typeof place !== 'string') return null;
    const norm = place.toLowerCase().trim();
    if (!norm) return null;
    loadGeoLocationCache();
    return geoLocationMemoryCache.get(norm) || null;
}

/**
 * Persists a resolved location entry (`coords` + optional `country`/`state`/`district`) in the
 * browser's `ft_geo_cache` cookie and `localStorage` mirror.
 *
 * @param {string} place - Location name to cache
 * @param {Object} entry - `{ coords: [lat, lng], country?, state?, district? }`
 * @returns {{coords: [number, number], country: string|null, state: string|null, district: string|null}|null}
 *
 * @example
 * saveCachedGeoLocation('Edappilly', { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' });
 * // => { coords: [10.025, 76.308], country: 'India', state: 'Kerala', district: 'Ernakulam' }
 *
 * @example
 * saveCachedGeoLocation('', { coords: [0, 0] });
 * // => null
 */
function saveCachedGeoLocation(place, entry) {
    if (!place || typeof place !== 'string') return null;
    const norm = place.toLowerCase().trim();
    const clean = sanitizeGeoCacheEntry(entry);
    if (!norm || !clean) return null;
    const current = loadGeoLocationCache();
    current[norm] = clean;
    const json = serializeGeoLocationCache(current);
    writePreference(GEO_CACHE_COOKIE, json);
    geoLocationMemoryCache.set(norm, clean);
    geoLocationCacheRawSnapshot = readPreference(GEO_CACHE_COOKIE);
    return clean;
}

/**
 * Clears all cached geocoded locations from the browser cookie, localStorage mirror, and in-memory map.
 *
 * @example
 * clearGeoLocationCache();
 * getCachedGeoLocation('Edappilly'); // => null
 *
 * @example
 * saveCachedGeoLocation('TVM', { coords: [8.5241, 76.9366] }); clearGeoLocationCache(); loadGeoLocationCache(); // => {}
 */
function clearGeoLocationCache() {
    removePreference(GEO_CACHE_COOKIE);
    geoLocationMemoryCache.clear();
    geoLocationCacheRawSnapshot = null;
}

/**
 * The "Clear stored data" action of the GDPR notice: deletes all preference cookies and
 * their mirrors, empties the in-memory title registry and geo cache, restores the shipped model
 * and repaints the Classic theme.
 *
 * @example
 * clearStoredPreferences();
 * readSheetHistory(); // => []
 *
 * @example
 * clearStoredPreferences();
 * loadStoredDemographicSettings(); // => null
 * loadStoredColorThemeId();        // => null
 */
function clearStoredPreferences() {
    removePreference(SHEET_HISTORY_COOKIE);
    removePreference(DEMOGRAPHIC_SETTINGS_COOKIE);
    removePreference(COLOR_THEME_COOKIE);
    removePreference(LAST_VIEW_STATE_COOKIE);
    clearGeoLocationCache();
    sheetTitleRegistry.clear();
    FamilyTreeBuilder.resetDemographicSettings();
    applyColorTheme(DEFAULT_COLOR_THEME_ID);
}
