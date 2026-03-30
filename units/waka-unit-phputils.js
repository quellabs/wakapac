/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██████╗ ██╗  ██╗██████╗ ██╗   ██╗████████╗██╗██╗     ███████╗                       ║
 * ║  ██╔══██╗██║  ██║██╔══██╗██║   ██║╚══██╔══╝██║██║     ██╔════╝                       ║
 * ║  ██████╔╝███████║██████╔╝██║   ██║   ██║   ██║██║     ███████╗                       ║
 * ║  ██╔═══╝ ██╔══██║██╔═══╝ ██║   ██║   ██║   ██║██║     ╚════██║                       ║
 * ║  ██║     ██║  ██║██║     ╚██████╔╝   ██║   ██║███████╗███████║                       ║
 * ║  ╚═╝     ╚═╝  ╚═╝╚═╝      ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝                       ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — PhpUtils                                                             ║
 * ║                                                                                      ║
 * ║  Exposes a curated set of PHP-style utility functions as a WakaPAC unit, making      ║
 * ║  them available in bind expressions and text interpolations. Functions follow        ║
 * ║  PHP naming conventions and signatures where practical.                              ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(PhpUtils);                                                            ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ PhpUtils.implode(', ', tags) }}                                     ║
 * ║  Flat:        {{ implode(', ', tags) }}  (requires data-pac-uses="PhpUtils")         ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    /**
     * Builds a pad string of exactly n characters from padStr.
     * Hoisted out of str_pad to avoid closure allocation on every call.
     * @param {string} padStr
     * @param {number} n
     * @returns {string}
     */
    function buildPad(padStr, n) {
        return padStr.repeat(Math.ceil(n / padStr.length)).slice(0, n);
    }

    window.PhpUtils = {

        createPacPlugin() {
            return {
                /** Unit namespace — accessible in binds as PhpUtils.fn() */
                name: 'PhpUtils',

                functions: {

                    // ─── String ───────────────────────────────────────────────────────

                    /**
                     * Inserts HTML line breaks before all newlines in a string.
                     * Equivalent to PHP's nl2br().
                     * @param {string} s
                     * @returns {string}
                     */
                    nl2br: (s) => String(s ?? '').replace(/\r\n|\n|\r/g, '<br>$&'),

                    /**
                     * Wraps a string to a given number of characters.
                     * Equivalent to PHP's wordwrap().
                     * @param {string} s - The input string
                     * @param {number} [width=75] - Maximum line width in characters
                     * @param {string} [breakStr='\n'] - String inserted at wrap points
                     * @param {boolean} [cutLongWords=false] - If true, breaks words longer than width
                     * @returns {string}
                     */
                    wordwrap: (s, width = 75, breakStr = '\n', cutLongWords = false) => {
                        const str = String(s ?? '');

                        if (str.length <= width) {
                            return str;
                        }

                        const lines = [];

                        for (const paragraph of str.split('\n')) {
                            if (paragraph.length <= width) {
                                lines.push(paragraph);
                                continue;
                            }

                            let line = '';

                            for (const word of paragraph.split(' ')) {
                                if (cutLongWords && word.length > width) {
                                    if (line.length > 0) {
                                        lines.push(line);
                                        line = '';
                                    }

                                    let remaining = word;

                                    while (remaining.length > width) {
                                        lines.push(remaining.slice(0, width));
                                        remaining = remaining.slice(width);
                                    }

                                    line = remaining;
                                    continue;
                                }

                                const candidate = line.length === 0 ? word : line + ' ' + word;

                                if (candidate.length <= width) {
                                    line = candidate;
                                } else {
                                    if (line.length > 0) {
                                        lines.push(line);
                                    }

                                    line = word;
                                }
                            }

                            if (line.length > 0) {
                                lines.push(line);
                            }
                        }

                        return lines.join(breakStr);
                    },

                    /**
                     * Pads a string to a certain length with another string.
                     * Equivalent to PHP's str_pad().
                     * @param {string} s - The input string
                     * @param {number} length - Target length
                     * @param {string} [padStr=' '] - The padding string
                     * @param {number} [type=0] - 0 = right (STR_PAD_RIGHT), 1 = left (STR_PAD_LEFT), 2 = both (STR_PAD_BOTH)
                     * @returns {string}
                     */
                    str_pad: (s, length, padStr = ' ', type = 0) => {
                        const str = String(s ?? '');
                        const pad = String(padStr || ' ');
                        const padNeeded = length - str.length;

                        if (padNeeded <= 0) {
                            return str;
                        }

                        if (type === 1) {
                            return buildPad(pad, padNeeded) + str;
                        }

                        if (type === 2) {
                            const leftPad = Math.floor(padNeeded / 2);
                            return buildPad(pad, leftPad) + str + buildPad(pad, padNeeded - leftPad);
                        }

                        return str + buildPad(pad, padNeeded);
                    },

                    /**
                     * Repeats a string a given number of times.
                     * Equivalent to PHP's str_repeat().
                     * @param {string} s
                     * @param {number} times
                     * @returns {string}
                     */
                    str_repeat: (s, times) => {
                        if (times <= 0) {
                            return '';
                        }

                        return String(s ?? '').repeat(Math.floor(times));
                    },

                    /**
                     * Returns the number of words in a string.
                     * Equivalent to PHP's str_word_count() with format=0.
                     * Words are sequences of alphabetic characters, optionally containing
                     * apostrophes or hyphens.
                     * @param {string} s
                     * @returns {number}
                     */
                    str_word_count: (s) => {
                        const matches = String(s ?? '').match(/\b[a-zA-Z''-]+\b/g);
                        return matches ? matches.length : 0;
                    },

                    /**
                     * Uppercases the first character of each word in a string.
                     * Word boundaries are space, tab, newline, carriage return, form feed,
                     * and vertical tab — matching PHP's ucwords() default behaviour.
                     * Equivalent to PHP's ucwords().
                     * @param {string} s
                     * @returns {string}
                     */
                    ucwords: (s) => String(s ?? '').replace(/(^|[ \t\r\n\f\v])(\S)/g, (_, sep, char) => sep + char.toUpperCase()),

                    /**
                     * Lowercases the first character of a string, leaving the rest unchanged.
                     * Equivalent to PHP's lcfirst().
                     * @param {string} s
                     * @returns {string}
                     */
                    lcfirst: (s) => {
                        const str = String(s ?? '');
                        return str.charAt(0).toLowerCase() + str.slice(1);
                    },

                    // ─── Number ───────────────────────────────────────────────────────

                    /**
                     * Formats a number with grouped thousands and decimal point.
                     * Equivalent to PHP's number_format().
                     * @param {number} n - The number to format
                     * @param {number} [decimals=0] - Number of decimal digits
                     * @param {string} [decPoint='.'] - Decimal point character
                     * @param {string} [thousandsSep=','] - Thousands separator
                     * @returns {string}
                     */
                    number_format: (n, decimals = 0, decPoint = '.', thousandsSep = ',') => {
                        const num = Number(n);

                        if (n === null || n === undefined || isNaN(num)) {
                            return '';
                        }

                        const fixed = Math.abs(num).toFixed(decimals);
                        const [intPart, decPart] = fixed.split('.');
                        const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
                        const result = decPart !== undefined ? grouped + decPoint + decPart : grouped;

                        return num < 0 ? '-' + result : result;
                    },

                    // ─── Array ────────────────────────────────────────────────────────

                    /**
                     * Joins array elements into a string with a glue string between each.
                     * Equivalent to PHP's implode() / join().
                     * @param {string} glue
                     * @param {Array} arr
                     * @returns {string}
                     */
                    implode: (glue, arr) => Array.isArray(arr) ? arr.join(String(glue ?? '')) : '',

                    /**
                     * Counts the number of elements in an array or string, or own keys of an object.
                     * Equivalent to PHP's count() / strlen() for these types.
                     * Returns 0 for null, undefined, or unrecognised types.
                     * @param {Array|string|Object} value
                     * @returns {number}
                     */
                    count: (value) => {
                        if (value === null || value === undefined) {
                            return 0;
                        }

                        if (Array.isArray(value) || typeof value === 'string') {
                            return value.length;
                        }

                        if (typeof value === 'object') {
                            return Object.keys(value).length;
                        }

                        return 0;
                    },

                    /**
                     * Returns true if a value exists in an array.
                     * Equivalent to PHP's in_array() with strict=true.
                     * Always uses strict comparison (===).
                     * @param {*} needle
                     * @param {Array} haystack
                     * @returns {boolean}
                     */
                    in_array: (needle, haystack) => Array.isArray(haystack) && haystack.includes(needle),

                    /**
                     * Returns true if the given key exists in an array or object.
                     * Equivalent to PHP's array_key_exists().
                     * @param {string|number} key
                     * @param {Object|Array} value
                     * @returns {boolean}
                     */
                    array_key_exists: (key, value) => {
                        if (value === null || value === undefined) {
                            return false;
                        }

                        if (Array.isArray(value)) {
                            const index = parseInt(key, 10);
                            return !isNaN(index) && index >= 0 && index < value.length;
                        }

                        if (typeof value === 'object') {
                            return Object.prototype.hasOwnProperty.call(value, key);
                        }

                        return false;
                    }
                },

                /**
                 * Add unit to abstraction if instructed
                 * @param abstraction
                 * @param pacId
                 * @param config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.phpUtils?.property;

                    if (key && key in abstraction) {
                        abstraction[key] = this.functions;
                    }
                }
            };
        }
    };

})();