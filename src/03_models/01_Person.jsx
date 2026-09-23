// ============================================================================
// MODULE 3: DOMAIN MODELS (Data Encapsulation)
// ============================================================================

/**
 * Domain model representing a single person in the family tree.
 * Encapsulates logic for formatting, display, and relational queries.
 *
 * @example
 * const person = new Person({ id: 'p1', name: 'John', yob: 1980, gender: 'M' });
 * person.currentAge; // => calculated age
 *
 * @example
 * const nun = new Person({ id: 'p2', name: 'Sr. Mary', yob: 1950 });
 * nun.isNun; // => true
 */
class Person {
    /**
     * Identifies spreadsheet instruction text, relational column subtitles,
     * or non-geographic entries (such as "husband/FATHER" or "if husband/father has it")
     * that should be avoided and never treated as real locations.
     * 
     * @param {string|null} p - Raw location string
     * @returns {boolean} True if the string is invalid / not a real location
     *
     * @example
     * Person.isInvalidLocation("husband/FATHER");
     * // => true
     *
     * @example
     * Person.isInvalidLocation("Chicago, IL");
     * // => false
     */
    static isInvalidLocation(p) {
        if (!p) return true;
        const s = p.toString().trim().toLowerCase();
        if (!s) return true;
        if (/\bhusband\s*[/]\s*father\b/i.test(s)) return true;
        if (/\b(?:if\s+)?(?:different\s+from\s+)?(?:husband|wife|father|mother|spouse|parents?)(?:\s*[/]\s*(?:father|mother|husband|wife))?(?:\s+(?:has\s+it|not\s+available|available))?/i.test(s) && 
            (s.includes('husband') || s.includes('father') || s.includes('mother') || s.includes('spouse'))) {
            const clean = s.replace(/^(?:location\s+)?(?:if\s+)?(?:different\s+from\s+)?/i, '')
                           .replace(/\s+(?:has\s+it|not\s+available|available).*$/i, '')
                           .trim();
            if (/^(?:husband|wife|father|mother|spouse|parents?)(?:\s*[/]\s*(?:father|mother|husband|wife|spouse))?$/i.test(clean)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Infers an estimated death year (at age 90) for individuals born over 100 years ago
     * who have no explicit death year recorded.
     *
     * @param {number|string|null} effectiveYob - Birth year (exact or inferred)
     * @param {number} [currentYear] - Reference year, defaults to current calendar year
     * @returns {number|null} Inferred death year or null if not applicable
     *
     * @example
     * Person.inferCentenarianDeath(1900, 2026);
     * // => 1990
     *
     * @example
     * Person.inferCentenarianDeath(1950, 2026);
     * // => null
     */
    static inferCentenarianDeath(effectiveYob, currentYear = new Date().getFullYear()) {
        const yob = effectiveYob ? parseInt(effectiveYob, 10) : null;
        if (yob && !isNaN(yob) && (currentYear - effectiveYob > 100)) {
            return yob + 90;
        }
        return null;
    }

    /**
     * Applies resolved religious vocation and gender attributes to a person.
     *
     * @param {Person} p - Person instance to mutate
     * @param {'Nun'|'Priest'} vocation - Religious role name
     * @param {'F'|'M'} gender - Associated gender code
     *
     * @example
     * const p = { name: 'Sr. Teresa' };
     * Person._applyReligiousVocation(p, 'Nun', 'F');
     * // => p.isNun === true, p.isCelibate === true, p.job === 'Nun', p.gender === 'F'
     *
     * @example
     * const p = { name: 'Fr. Joseph' };
     * Person._applyReligiousVocation(p, 'Priest', 'M');
     * // => p.isPriest === true, p.isCelibate === true, p.job === 'Priest', p.gender === 'M'
     */
    static _applyReligiousVocation(p, vocation, gender) {
        p.isCelibate = true;
        if (vocation === 'Nun') p.isNun = true;
        else if (vocation === 'Priest') p.isPriest = true;
        if (!p.job) p.job = vocation;
        if (!p.gender) p.gender = gender;
    }

    /**
     * Infers male gender from traditional patriarchal and generational name suffixes.
     *
     * @param {string} lowerName - Normalized lowercase name
     * @returns {boolean} True if name contains a male suffix indicator
     *
     * @example
     * Person._hasMaleNameSuffix('kuttappan');
     * // => true
     *
     * @example
     * Person._hasMaleNameSuffix('george son 2');
     * // => true
     */
    static _hasMaleNameSuffix(lowerName) {
        return lowerName.endsWith('appan') || lowerName.endsWith('son') || /\bson(?:\s+\d+)?$/i.test(lowerName);
    }

    /**
     * Identifies religious title prefix in normalized name or nickname ('sr.' for Nun, 'fr.' for Priest).
     *
     * @param {string} lowerName - Normalized lowercase name
     * @param {string} lowerNick - Normalized lowercase nickname
     * @returns {?{ vocation: string, gender: string }} Vocation object or null
     *
     * @example
     * Person._matchReligiousPrefix('sr. maria', '');
     * // => { vocation: 'Nun', gender: 'F' }
     *
     * @example
     * Person._matchReligiousPrefix('fr. thomas', '');
     * // => { vocation: 'Priest', gender: 'M' }
     */
    static _matchReligiousPrefix(lowerName, lowerNick) {
        if (/^sr(?:\.|\s)\s*/i.test(lowerName) || /^sr(?:\.|\s)\s*/i.test(lowerNick)) {
            return { vocation: 'Nun', gender: 'F' };
        }
        if (/^fr(?:\.|\s)\s*/i.test(lowerName) || /^fr(?:\.|\s)\s*/i.test(lowerNick)) {
            return { vocation: 'Priest', gender: 'M' };
        }
        return null;
    }

    /**
     * Resolves religious vocation, title ontology, and default gender attributes for a person
     * based on their name and nickname patterns.
     *
     * @param {Person} p - Person instance to mutate
     *
     * @example
     * const p = { name: 'Sr. Teresa', nick: '' };
     * Person._resolveTitleAndVocationAttributes(p);
     * // => p.isNun === true, p.gender === 'F', p.job === 'Nun'
     *
     * @example
     * const p = { name: 'Fr. Joseph', nick: '' };
     * Person._resolveTitleAndVocationAttributes(p);
     * // => p.isPriest === true, p.gender === 'M', p.job === 'Priest'
     */
    static _resolveTitleAndVocationAttributes(p) {
        if (!p.name) return;
        const lowerName = p.name.toLowerCase().trim();
        const lowerNick = (p.nick || '').toLowerCase().trim();
        const titleMatch = (typeof FamilyTreeBuilder !== 'undefined' && FamilyTreeBuilder.matchTitleOntology)
            ? FamilyTreeBuilder.matchTitleOntology(lowerName, lowerNick)
            : null;
        if (titleMatch) {
            if (titleMatch.isCelibate) p.isCelibate = true;
            if (titleMatch.isNun) p.isNun = true;
            if (titleMatch.isPriest) p.isPriest = true;
            if (titleMatch.career && !p.job) p.job = titleMatch.career;
            if (titleMatch.gender && !p.gender) p.gender = titleMatch.gender;
        } else {
            const prefix = Person._matchReligiousPrefix(lowerName, lowerNick);
            if (prefix) {
                Person._applyReligiousVocation(p, prefix.vocation, prefix.gender);
            } else if (!p.gender && Person._hasMaleNameSuffix(lowerName)) {
                p.gender = 'M';
            }
        }
    }

    /**
     * Infers death year for centenarian persons when death year is missing.
     *
     * @param {Person} p - Person instance to mutate
     *
     * @example
     * const p = { yob: 1910 };
     * Person._applyCentenarianDeathInference(p);
     * // => p.death === 2000
     *
     * @example
     * const p = { yob: 1980 };
     * Person._applyCentenarianDeathInference(p);
     * // => p.death is undefined
     */
    static _applyCentenarianDeathInference(p) {
        if (p.death) return;
        const effectiveYob = p.yob ? parseInt(p.yob, 10) : (p._inferredYob ? parseInt(p._inferredYob, 10) : null);
        const inferredDeath = Person.inferCentenarianDeath(effectiveYob);
        if (inferredDeath) {
            p.death = inferredDeath;
        }
    }

    /**
     * Constructs a new Person instance, initializing collections and deducing titles and lifespans.
     *
     * @param {Object} data - Raw profile attributes from sheet or JSON
     *
     * @example
     * const p = new Person({ id: 'john', name: 'John Doe', yob: 1970 });
     * p.partners; // => []
     *
     * @example
     * const p = new Person({ id: 'mary', name: 'Mary', place: 'husband/FATHER' });
     * p.place; // => '' (invalid location stripped)
     */
    constructor(data) {
        Object.assign(this, data);
        this.partners = this.partners || [];
        this.children = this.children || [];
        this.ambiguities = this.ambiguities || [];

        if (this.place && Person.isInvalidLocation(this.place)) {
            this.place = '';
        }

        Person._resolveTitleAndVocationAttributes(this);
        Person._applyCentenarianDeathInference(this);
    }

    /**
     * Retrieves array of valid parent IDs (mother and father).
     *
     * @type {string[]}
     *
     * @example
     * const p = new Person({ id: 'c1', momId: 'm1', fatherId: 'f1' });
     * p.parents; // => ['m1', 'f1']
     *
     * @example
     * const p = new Person({ id: 'c2', fatherId: 'f1' });
     * p.parents; // => ['f1']
     */
    get parents() {
        if (this.momId && this.fatherId && this.momId === this.fatherId) {
            return [this.momId];
        }
        const set = new Set([this.momId, this.fatherId, this._namedParentId].filter(Boolean));
        return Array.from(set);
    }

    /**
     * Calculates the current age in years (or age at death for deceased individuals).
     *
     * @type {number|null}
     *
     * @example
     * const p = new Person({ id: 'p1', yob: 1990, death: 2020 });
     * p.currentAge; // => 30
     *
     * @example
     * const p = new Person({ id: 'p2' });
     * p.currentAge; // => null
     */
    get currentAge() {
        const yob = this.yob || this._inferredYob;
        if (!yob) return null;
        const yobNum = parseInt(yob, 10);
        if (isNaN(yobNum)) return null;
        const currentYear = new Date().getFullYear();
        let d = this.death ? parseInt(this.death, 10) : null;
        if (!d) {
            d = Person.inferCentenarianDeath(yobNum, currentYear);
        }
        return (d ? d : currentYear) - yobNum;
    }

    /**
     * Selects an appropriate representative portrait emoji based on age and gender.
     *
     * @type {string}
     *
     * @example
     * const child = new Person({ id: 'c', yob: 2024, gender: 'M' });
     * child.emoji; // => '👶🏻'
     *
     * @example
     * const elder = new Person({ id: 'e', yob: 1950, gender: 'F' });
     * elder.emoji; // => '👵🏻'
     */
    get emoji() {
        const age = this.currentAge;
        const g = this.gender;
        if (age !== null && !isNaN(age)) {
            if (age <= 3) return '👶🏻';
            if (age <= 12) return g === 'M' ? '👦🏻' : g === 'F' ? '👧🏻' : '🧒🏻';
            if (age >= 60) return g === 'M' ? '👴🏻' : g === 'F' ? '👵🏻' : '🧓🏻';
        }
        return g === 'M' ? '👨🏻' : g === 'F' ? '👩🏻' : '🧑🏻';
    }

    /**
     * Resolves the primary 1-based spreadsheet row number for sorting and provenance citations.
     *
     * @type {number}
     *
     * @example
     * const p = new Person({ id: 'p1', _sheetRow: 42 });
     * p.sheetRow; // => 42
     *
     * @example
     * const p = new Person({ id: 'p2' });
     * p.sheetRow; // => 99999
     */
    get sheetRow() {
        if (this._sheetRows) {
            let sRows = this._sheetRows;
            if (typeof sRows === 'string') {
                try { sRows = JSON.parse(sRows); } catch (e) { sRows = null; }
            }
            if (sRows && typeof sRows === 'object' && Object.keys(sRows).length > 0) {
                const vals = Object.values(sRows).map(v => parseInt(v, 10)).filter(v => !isNaN(v));
                if (vals.length > 0) return Math.min(...vals);
            }
        }
        if (this._sheetRow !== undefined && this._sheetRow !== null) {
            return this._sheetRow;
        }
        return 99999;
    }

    /**
     * Returns the most reliable birth year, preferring explicit yob over inferred yob.
     *
     * @type {number|string}
     *
     * @example
     * const p = new Person({ id: 'p1', yob: 1985, _inferredYob: 1983 });
     * p.bestYob; // => 1985
     *
     * @example
     * const p = new Person({ id: 'p2', _inferredYob: 1960 });
     * p.bestYob; // => 1960
     */
    get bestYob() {
        return this.yob || this._inferredYob || 9999;
    }

    /**
     * Formats a lifespan and years-ago recency description for card badges.
     *
     * @param {number} lifespan - Computed lifespan in years
     * @param {number} yrsAgo - Elapsed years since death
     * @param {string} [prefix=''] - Formatting prefix ('~' for deduced dates)
     * @returns {string} Formatted card date text (e.g. "90y, 16y ago" or "~90y, 16y ago")
     *
     * @example
     * Person._formatCardLifespanRecency(90, 16, '');
     * // => "90y, 16y ago"
     *
     * @example
     * Person._formatCardLifespanRecency(90, 16, '~');
     * // => "~90y, 16y ago"
     */
    static _formatCardLifespanRecency(lifespan, yrsAgo, prefix = '') {
        const agoStr = yrsAgo > 0 ? `, ${yrsAgo}y ago` : (yrsAgo === 0 ? ', this year' : '');
        return `${prefix}${lifespan}y${agoStr}`;
    }

    /**
     * Formats a death-only recency description for card badges.
     *
     * @param {number} yrsAgo - Elapsed years since death
     * @param {number} yodNum - Year of death
     * @returns {string} Formatted death recency text (e.g. "16y ago", "this year", or "d. 2010")
     *
     * @example
     * Person._formatCardDeathRecency(16, 2010);
     * // => "16y ago"
     *
     * @example
     * Person._formatCardDeathRecency(0, 2026);
     * // => "this year"
     */
    static _formatCardDeathRecency(yrsAgo, yodNum) {
        return yrsAgo > 0 ? `${yrsAgo}y ago` : (yrsAgo === 0 ? 'this year' : `d. ${yodNum}`);
    }

    /**
     * Formats concise card date labels and tooltip strings for a person's lifespan.
     *
     * @param {number|null} effectiveYob - Concrete or deduced birth year
     * @param {number|null} yodNum - Year of death
     * @param {number} currentYear - Reference calendar year
     * @param {boolean} isDeduced - Whether the birth year was deduced
     * @returns {{ cardText: string, titleText: string, isDeduced: boolean }}
     *
     * @example
     * Person._formatCardDateStrings(1920, 2010, 2026, false);
     * // => { cardText: "90y, 16y ago", titleText: "1920 - 2010", isDeduced: false }
     *
     * @example
     * Person._formatCardDateStrings(1950, null, 2026, true);
     * // => { cardText: "~76y", titleText: "b. ~1950 (deduced)", isDeduced: true }
     */
    static _formatCardDateStrings(effectiveYob, yodNum, currentYear, isDeduced) {
        const prefix = isDeduced ? '~' : '';

        if (effectiveYob && yodNum) {
            const lifespan = Math.max(0, yodNum - effectiveYob);
            const yrsAgo = currentYear - yodNum;
            const cardText = Person._formatCardLifespanRecency(lifespan, yrsAgo, prefix);
            const titleText = `${prefix}${effectiveYob} - ${yodNum}${isDeduced ? ' (deduced birth year)' : ''}`;
            return { cardText, titleText, isDeduced };
        }

        if (effectiveYob) {
            const age = Math.max(0, currentYear - effectiveYob);
            const cardText = `${prefix}${age}y`;
            const titleText = `b. ${prefix}${effectiveYob}${isDeduced ? ' (deduced)' : ''}`;
            return { cardText, titleText, isDeduced };
        }

        if (yodNum) {
            const yrsAgo = currentYear - yodNum;
            const cardText = Person._formatCardDeathRecency(yrsAgo, yodNum);
            const titleText = `d. ${yodNum}`;
            return { cardText, titleText, isDeduced: false };
        }

        return { cardText: '', titleText: '', isDeduced: false };
    }

    /**
     * Formats concise lifespan and recency information for display on the tree node card.
     * 
     * @param {number} [currentYear] - Reference year, defaults to current calendar year
     * @returns {{ cardText: string, titleText: string, isDeduced: boolean }}
     *
     * @example
     * const p = new Person({ id: 'p1', yob: 1920, death: 2010 });
     * p.getCardDateString(2026);
     * // => { cardText: "90y, 16y ago", titleText: "1920 - 2010", isDeduced: false }
     *
     * @example
     * const p = new Person({ id: 'p2', _inferredYob: 1950 });
     * p.getCardDateString(2026);
     * // => { cardText: "~76y", titleText: "b. ~1950 (deduced)", isDeduced: true }
     */
    getCardDateString(currentYear = new Date().getFullYear()) {
        const yobNum = this.yob ? parseInt(this.yob, 10) : null;
        const infYobNum = this._inferredYob ? parseInt(this._inferredYob, 10) : null;
        let yodNum = this.death ? parseInt(this.death, 10) : null;

        const effectiveYob = yobNum || infYobNum;
        let isDeduced = !yobNum && !!infYobNum;

        // If age is deduced (not specified) to be > 100 without death, set lifespan to 90 years and mark as dead
        if (!yodNum && effectiveYob) {
            const inferredDeath = Person.inferCentenarianDeath(effectiveYob, currentYear);
            if (inferredDeath) {
                yodNum = inferredDeath;
                isDeduced = true;
            }
        }

        return Person._formatCardDateStrings(effectiveYob, yodNum, currentYear, isDeduced);
    }

    /**
     * Formats biographical date strings and age/lifespan summaries for a person.
     * 
     * @param {number|null} effectiveYob - Concrete or deduced year of birth
     * @param {number|null} deathNum - Year of death
     * @param {number} currentYear - Current reference year
     * @param {boolean} isDeduced - Whether year of birth is inferred
     * @returns {{ dateStr: string, extraStr: string, isDeduced: boolean }}
     *
     * @example
     * Person._formatLifeSpanDateStrings(1950, 2020, 2026, false);
     * // => { dateStr: '1950 - 2020', extraStr: '70 yrs • 6 yrs ago', isDeduced: false }
     *
     * @example
     * Person._formatLifeSpanDateStrings(1980, null, 2026, false);
     * // => { dateStr: 'b. 1980', extraStr: '46 yrs', isDeduced: false }
     */
    static _formatLifeSpanDateStrings(effectiveYob, deathNum, currentYear, isDeduced) {
        const prefix = isDeduced ? '~' : '';

        if (effectiveYob && deathNum) {
            const dateStr = `${prefix}${effectiveYob} - ${deathNum}`;
            const yrsAgo = currentYear - deathNum;
            const yrsAgoStr = yrsAgo > 0 ? ` • ${yrsAgo} yrs ago` : (yrsAgo === 0 ? ' • this year' : '');
            const extraStr = `${prefix}${deathNum - effectiveYob} yrs${yrsAgoStr}`;
            return { dateStr, extraStr, isDeduced };
        }

        if (effectiveYob) {
            const dateStr = `b. ${prefix}${effectiveYob}`;
            const extraStr = `${prefix}${currentYear - effectiveYob} yrs`;
            return { dateStr, extraStr, isDeduced };
        }

        if (deathNum) {
            const dateStr = `d. ${deathNum}`;
            const yrsAgo = currentYear - deathNum;
            const extraStr = yrsAgo > 0 ? `${yrsAgo} yrs ago` : (yrsAgo === 0 ? 'this year' : '');
            return { dateStr, extraStr, isDeduced: false };
        }

        return { dateStr: '', extraStr: '', isDeduced: false };
    }

    /**
     * Computes biographical date strings and lifespan metrics for this person instance.
     *
     * @returns {{ dateStr: string, extraStr: string, isDeduced: boolean }}
     *
     * @example
     * person.getDateStrings();
     * // => { dateStr: '1920 - 2010', extraStr: '90 yrs • 16 yrs ago', isDeduced: false }
     *
     * @example
     * livingPerson.getDateStrings();
     * // => { dateStr: 'b. ~1960', extraStr: '~66 yrs', isDeduced: true }
     */
    getDateStrings() {
        const currentYear = new Date().getFullYear();
        const yobNum = this.yob ? parseInt(this.yob, 10) : null;
        const infYobNum = this._inferredYob ? parseInt(this._inferredYob, 10) : null;
        let deathNum = this.death ? parseInt(this.death, 10) : null;
        const effectiveYob = yobNum || infYobNum;
        const isDeduced = !yobNum && !!infYobNum;

        // If age is deduced (not specified) to be > 100 without death, set lifespan to 90 years and mark as dead
        if (!deathNum && effectiveYob) {
            deathNum = Person.inferCentenarianDeath(effectiveYob, currentYear);
        }

        return Person._formatLifeSpanDateStrings(effectiveYob, deathNum, currentYear, isDeduced);
    }

    /**
     * Checks if a child is biologically and genealogically compatible with a spousal unit's parents.
     *
     * @param {Person} child - Child node to test
     * @param {Person[]} unitParents - Array of parents (person and their partners) in the display unit
     * @returns {boolean} True if child is compatible with the unit parents
     *
     * @example
     * Person._isChildValidForUnitParents(childNode, [fatherNode, motherNode]);
     * // => true
     *
     * @example
     * Person._isChildValidForUnitParents({ yob: 1980, momId: 'otherMom' }, [{ id: 'unitMom', gender: 'F' }]);
     * // => false (already assigned to different mother)
     */
    static _isChildValidForUnitParents(child, unitParents) {
        if (!child.yob) return true;

        for (const p of unitParents) {
            // If this parent is officially linked, they validate this child
            if (p.id === child.momId || p.id === child.fatherId || p.id === child._namedParentId) continue;
            // Avoid linking a child to a generic parent of the same gender if they already have one
            if (p.gender === 'F' && child.momId) continue;
            if (p.gender === 'M' && child.fatherId) continue;

            // Validate realistic age gaps
            if (p.yob) {
                const ageDiff = child.yob - p.yob;
                if (ageDiff < 10 || (p.gender === 'F' && ageDiff > 55) || (p.gender === 'M' && ageDiff > 80)) return false;
            }
        }
        return true;
    }

    /**
     * Compares two siblings for visual display order under parents based on explicit YOB,
     * spreadsheet row order, best inferred YOB, and name child numbering.
     *
     * @param {Person} a - First sibling
     * @param {Person} b - Second sibling
     * @returns {number} Negative if a precedes b, positive if b precedes a
     *
     * @example
     * Person._compareSiblingDisplayOrder(childA, childB);
     * // => -1 (childA displayed before childB)
     *
     * @example
     * Person._compareSiblingDisplayOrder({ yob: 1990 }, { yob: 1985 });
     * // => 5 (child with earlier birth year sorted first)
     */
    static _compareSiblingDisplayOrder(a, b) {
        const yA = a.bestYob, yB = b.bestYob;
        if (yA && yB && yA !== yB) return yA - yB;
        const rA = a.sheetRow, rB = b.sheetRow;
        if (rA < 99999 && rB < 99999 && rA !== rB && FamilyTreeBuilder.sharesSheet(a, b)) {
            return rA - rB;
        }
        return (a._nameChildNumber || 0) - (b._nameChildNumber || 0);
    }

    /** 
     * Filters and sorts the children of this person to determine the visually valid display children
     * belonging under this family unit (vs. being displayed under a different spouse), sorted in chronological order.
     *
     * @param {FamilyTree} tree - Populated family tree instance
     * @returns {Person[]} Chronologically ordered display child nodes
     *
     * @example
     * const displayChildren = person.getValidDisplayChildren(tree);
     * // => [firstChildNode, secondChildNode]
     *
     * @example
     * const childless = personWithoutKids.getValidDisplayChildren(tree);
     * // => []
     */
    getValidDisplayChildren(tree) {
        const partners = this.partners.map(id => tree.get(id)).filter(Boolean);
        const unitParents = [this, ...partners];
        
        return this.children.filter(cId => {
            const child = tree.get(cId);
            if (!child) return false;
            return Person._isChildValidForUnitParents(child, unitParents);
        }).map(cId => tree.get(cId)).sort((a, b) => Person._compareSiblingDisplayOrder(a, b));
    }
}

/**
 * Domain model representing the entire Family Tree.
 * Encapsulates graph traversal, statistics, and validation logic.
 *
 * @example
 * const tree = new FamilyTree({ p1: { id: 'p1', name: 'Root' } }, 'p1');
 * tree.root.name; // => 'Root'
 *
 * @example
 * const tree = new FamilyTree();
 * tree.getMaxGenerations(); // => 1
 */