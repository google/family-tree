class CSVParser {
    static {
        if (typeof window !== 'undefined' && !window.appCode) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'App.jsx?t=' + Date.now(), false);
                xhr.send(null);
                if (xhr.status === 200 || xhr.status === 0) {
                    window.appCode = xhr.responseText;
                    globalThis.appCode = xhr.responseText;
                }
            } catch (e) {}
        }
    }

    static HEADER_WORDS = new Set([
        'name', 'nickname', 'nick', 'year', 'of', 'birth', 'age', 'death',
        'years', 'after', 'mother', 'mom', 'father', 'dad', 'family',
        'spouse', 'husband', 'wife', 'prefer', 'job', 'profession',
        'location', 'place', 'if', 'not', 'available', 'different',
        'from', 'at', 'the', 'free', 'form', 'freeform', 'sibling',
        'gender', 'sex', 'essential', 'maternal', 'paternal',
        'has', 'it', 'any', 'one', 'them', 'all', 'only', 'either', 'or', 'also', 'as', 'such', 'etc', 'other', 'another'
    ]);

    /**
     * Unescapes and trims a raw CSV cell token, stripping quotes and escaped double quotes.
     * 
     * @param {string} token - Raw cell token
     * @returns {string} Cleaned cell string
     *
     * @example
     * CSVParser._cleanCell('"Hello, World"');
     * // => 'Hello, World'
     *
     * @example
     * CSVParser._cleanCell('""Quoted""');
     * // => '"Quoted"'
     */
    static _cleanCell(token) {
        return token.replace(/(^"|"$)/g, '').replace(/""/g, '"').trim();
    }

    /**
     * Sanitizes trailing carriage returns and commits a non-empty parsed CSV row to the collection.
     * 
     * @param {string[]} row - Cell values for the current row
     * @param {number} sheetRow - 1-based spreadsheet row number
     * @param {Array<{ data: string[], sheetRow: number }>} rows - Destination list of parsed rows
     *
     * @example
     * const rows = [];
     * CSVParser._commitParsedRow(['A', 'B\r'], 1, rows);
     * // => rows contains [{ data: ['A', 'B'], sheetRow: 1 }]
     *
     * @example
     * const rows = [];
     * CSVParser._commitParsedRow(['', ''], 2, rows);
     * // => rows remains empty (no truthy cell values)
     */
    static _commitParsedRow(row, sheetRow, rows) {
        if (row.length > 0 && row[row.length - 1].endsWith('\r')) {
            row[row.length - 1] = row[row.length - 1].slice(0, -1);
        }
        if (row.some(Boolean)) {
            rows.push({ data: row, sheetRow });
        }
    }

    /**
     * Extracts, unescapes, and pushes a cell token into the in-progress row array.
     *
     * @private
     * @param {string} str - Source CSV text
     * @param {number} start - Cell substring start index
     * @param {number} end - Cell substring end index
     * @param {string[]} row - Target in-progress row array
     *
     * @example
     * const row = [];
     * CSVParser._consumeCell('name,age', 0, 4, row);
     * // => row is ['name']
     *
     * @example
     * const row = [];
     * CSVParser._consumeCell(' "Bob" , 30', 0, 7, row);
     * // => row is ['Bob']
     */
    static _consumeCell(str, start, end, row) {
        row.push(CSVParser._cleanCell(str.substring(start, end)));
    }

    /**
     * Breaks raw CSV string into lines and tokens, tracking 1-based sheet row numbers.
     * 
     * @param {string} str - Raw CSV string
     * @returns {Array<{ data: string[], sheetRow: number }>} Array of rows with cell data and 1-based sheet row index
     * 
     * @example
     * CSVParser._tokenizeCsv('Name,Age\nAlice,30');
     * // => [{ data: ['Name', 'Age'], sheetRow: 1 }, { data: ['Alice', '30'], sheetRow: 2 }]
     *
     * @example
     * CSVParser._tokenizeCsv('A,B\n\nC,D');
     * // => [{ data: ['A', 'B'], sheetRow: 1 }, { data: ['C', 'D'], sheetRow: 3 }]
     */
    static _tokenizeCsv(str) {
        str = str.replace(/,\s*"(\r?\n|$)/g, ',$1');
        const rows = [];
        let row = [];
        let start = 0;
        let inQuote = false;
        let currentSheetRow = 1;
        
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === '"') {
                inQuote = !inQuote;
            } else if (c === ',' && !inQuote) {
                CSVParser._consumeCell(str, start, i, row);
                start = i + 1;
            } else if (c === '\n' && !inQuote) {
                CSVParser._consumeCell(str, start, i, row);
                start = i + 1;
                CSVParser._commitParsedRow(row, currentSheetRow, rows);
                currentSheetRow++;
                row = [];
            }
        }
        
        CSVParser._consumeCell(str, start, str.length, row);
        CSVParser._commitParsedRow(row, currentSheetRow, rows);
        return rows;
    }

    /**
     * Splits a raw header string into non-empty line segments and word tokens.
     *
     * @param {string} h - Raw header string
     * @returns {{ lines: string[], words: string[], lastLineWords: string[] }}
     *
     * @example
     * CSVParser._tokenizeHeaderLines("SPOUSE\r\nPrefer Husband");
     * // => { lines: ['SPOUSE', 'Prefer Husband'], words: ['SPOUSE', 'Prefer', 'Husband'], lastLineWords: ['Prefer', 'Husband'] }
     *
     * @example
     * CSVParser._tokenizeHeaderLines("");
     * // => { lines: [], words: [], lastLineWords: [] }
     */
    static _tokenizeHeaderLines(h) {
        if (!h) return { lines: [], words: [], lastLineWords: [] };
        const lines = h.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
        const lastLineWords = lines.length > 0 ? lines[lines.length - 1].split(/\s+/) : [];
        const words = h.split(/\s+/);
        return { lines, words, lastLineWords };
    }

    /**
     * Extracts an embedded data value from a header cell if Google Sheets merged
     * the first data cell into the header text.
     * 
     * @param {string} h - Raw header string
     * @param {Set<string>} headerWords - Set of known header keywords
     * @returns {string} Extracted data value, or empty string if purely a header
     * 
     * @example
     * CSVParser._extractEmbeddedHeaderValue("Name Anthony", CSVParser.HEADER_WORDS);
     * // => "Anthony"
     *
     * @example
     * CSVParser._extractEmbeddedHeaderValue("Year of Birth", CSVParser.HEADER_WORDS);
     * // => ""
     */
    static _extractEmbeddedHeaderValue(h, headerWords) {
        if (!h) return '';
        const { lines, words, lastLineWords } = CSVParser._tokenizeHeaderLines(h);
        const targetWords = lines.length > 1 ? lastLineWords : words;
        if (lines.length > 1 || words.length >= 2) {
            const lastWord = targetWords[targetWords.length - 1]?.toLowerCase().replace(/[^a-z]/g, '');
            if (lastWord && !headerWords.has(lastWord)) {
                return targetWords[targetWords.length - 1];
            }
        }
        return '';
    }

    /**
     * Removes an embedded trailing data value from a header cell string.
     * 
     * @param {string} h - Raw header string
     * @param {string} val - Trailing data value to strip
     * @returns {string} Cleaned, lower-cased header label
     * 
     * @example
     * CSVParser._stripEmbeddedHeaderValue("Name Anthony", "Anthony");
     * // => "name"
     *
     * @example
     * CSVParser._stripEmbeddedHeaderValue("SPOUSE\r\nPrefer Husband Thandammama", "Thandammama");
     * // => "spouse prefer husband"
     */
    static _stripEmbeddedHeaderValue(h, val) {
        const { lines, words, lastLineWords } = CSVParser._tokenizeHeaderLines(h);
        if (lines.length > 1) {
            if (lastLineWords[lastLineWords.length - 1] === val) {
                lastLineWords.pop();
                lines[lines.length - 1] = lastLineWords.join(' ');
                return lines.filter(Boolean).join(' ').trim().toLowerCase();
            }
        } else {
            if (words[words.length - 1] === val) {
                words.pop();
                return words.join(' ').trim().toLowerCase();
            }
        }
        return h.toLowerCase();
    }

    /**
     * Evaluates whether a set of headers exhibits embedded first-row data patterns.
     *
     * @param {string[]} rawHeaders - Original trimmed header cell values
     * @param {string[]} embeddedValues - Candidate data values extracted from each header
     * @param {number} embeddedCount - Total number of candidate values found
     * @returns {boolean} True if headers contain embedded first data row
     *
     * @example
     * CSVParser._hasEmbeddedFirstDataRow(['Name Anthony', 'Job Doctor'], ['Anthony', 'Doctor'], 2)
     * // => true
     *
     * @example
     * CSVParser._hasEmbeddedFirstDataRow(['Name', 'Job'], ['', ''], 0)
     * // => false
     */
    static _hasEmbeddedFirstDataRow(rawHeaders, embeddedValues, embeddedCount) {
        if (embeddedCount < 2) return false;
        const nameColIdx = rawHeaders.findIndex(h => h.toLowerCase().startsWith('name'));
        return nameColIdx >= 0 && Boolean(embeddedValues[nameColIdx] && embeddedValues[nameColIdx].trim());
    }

    /**
     * Analyzes raw headers to detect whether the first row of data was merged into the header
     * row during CSV export, separating the header titles and first data row if detected.
     * 
     * @param {string[]} rawHeaders - Array of trimmed header strings
     * @returns {{ headers: string[], firstDataRow: string[] | null }} Cleaned headers and optional extracted first data row
     * 
     * @example
     * CSVParser._resolveHeadersAndFirstDataRow(["Name Anthony", "Job Doctor"])
     * // => { headers: ["name", "job"], firstDataRow: ["Anthony", "Doctor"] }
     *
     * @example
     * CSVParser._resolveHeadersAndFirstDataRow(["Name", "Age"])
     * // => { headers: ["name", "age"], firstDataRow: null }
     */
    static _resolveHeadersAndFirstDataRow(rawHeaders) {
        const embeddedValues = [];
        let embeddedCount = 0;

        rawHeaders.forEach(h => {
            const val = CSVParser._extractEmbeddedHeaderValue(h, CSVParser.HEADER_WORDS);
            embeddedValues.push(val);
            if (val) embeddedCount++;
        });

        if (CSVParser._hasEmbeddedFirstDataRow(rawHeaders, embeddedValues, embeddedCount)) {
            const headers = rawHeaders.map((h, i) => {
                if (!embeddedValues[i]) return h.toLowerCase();
                return CSVParser._stripEmbeddedHeaderValue(h, embeddedValues[i]);
            });
            return { headers, firstDataRow: embeddedValues };
        }

        return { headers: rawHeaders.map(h => h.toLowerCase()), firstDataRow: null };
    }

    /**
     * Constructs a structured object mapping header names to row cell values, attaching _sheetRow.
     *
     * @param {number} sheetRow - 1-based spreadsheet row number
     * @param {string[]} headers - Cleaned header names
     * @param {string[]} values - Cell string values
     * @returns {Object} Structured record object
     *
     * @example
     * CSVParser._createRowObject(2, ['name', 'age'], ['Bob', '25'])
     * // => { _sheetRow: 2, name: 'Bob', age: '25' }
     *
     * @example
     * CSVParser._createRowObject(1, ['name'], ['Alice'])
     * // => { _sheetRow: 1, name: 'Alice' }
     */
    static _createRowObject(sheetRow, headers, values) {
        const obj = { _sheetRow: sheetRow };
        headers.forEach((h, i) => {
            if (h) obj[h] = (values && values[i]) ? values[i] : '';
        });
        return obj;
    }

    /**
     * Converts tokenized row arrays into structured records keyed by header names,
     * including 1-based spreadsheet row indices.
     * 
     * @param {Array<{ data: string[], sheetRow: number }>} rows - Tokenized rows
     * @param {string[]} headers - Cleaned lower-case header names
     * @param {string[] | null} firstDataRow - Optional embedded first data row
     * @returns {Array<Object>} Parsed objects with header properties and _sheetRow
     * 
     * @example
     * CSVParser._mapRowsToObjects([{ data: ['Name', 'Age'], sheetRow: 1 }, { data: ['Bob', '25'], sheetRow: 2 }], ['name', 'age'], null)
     * // => [{ name: 'Bob', age: '25', _sheetRow: 2 }]
     *
     * @example
     * CSVParser._mapRowsToObjects([{ data: ['Name', 'Age'], sheetRow: 1 }], ['name', 'age'], ['Alice', '30'])
     * // => [{ name: 'Alice', age: '30', _sheetRow: 1 }]
     */
    static _mapRowsToObjects(rows, headers, firstDataRow) {
        const results = [];
        if (firstDataRow) {
            results.push(CSVParser._createRowObject(rows[0].sheetRow, headers, firstDataRow));
        }

        rows.slice(1).forEach((r) => {
            results.push(CSVParser._createRowObject(r.sheetRow, headers, r.data));
        });
        return results;
    }

    /**
     * Parses a raw CSV string into structured record objects keyed by lowercase header names,
     * including 1-based spreadsheet row indices (_sheetRow).
     *
     * @param {string} str - Raw CSV string
     * @returns {Array<Object>} Parsed row objects
     *
     * @example
     * const records = CSVParser.parse("Name,Age\nAlice,30");
     * // => [{ name: "Alice", age: "30", _sheetRow: 2 }]
     *
     * @example
     * const empty = CSVParser.parse("");
     * // => []
     */
    static parse(str) {
        if (!str || typeof str !== 'string') return [];
        const rows = CSVParser._tokenizeCsv(str);
        if (rows.length < 2) return [];

        const rawHeaders = rows[0].data.map(h => h.trim());
        const { headers, firstDataRow } = CSVParser._resolveHeadersAndFirstDataRow(rawHeaders);
        return CSVParser._mapRowsToObjects(rows, headers, firstDataRow);
    }
}
