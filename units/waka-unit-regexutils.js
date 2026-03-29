/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██████╗ ███████╗ ██████╗ ███████╗██╗  ██╗██╗   ██╗████████╗██╗██╗     ███████╗     ║
 * ║  ██╔══██╗██╔════╝██╔════╝ ██╔════╝╚██╗██╔╝██║   ██║╚══██╔══╝██║██║     ██╔════╝     ║
 * ║  ██████╔╝█████╗  ██║  ███╗█████╗   ╚███╔╝ ██║   ██║   ██║   ██║██║     ███████╗     ║
 * ║  ██╔══██╗██╔══╝  ██║   ██║██╔══╝   ██╔██╗ ██║   ██║   ██║   ██║██║     ╚════██║     ║
 * ║  ██║  ██║███████╗╚██████╔╝███████╗██╔╝ ██╗╚██████╔╝   ██║   ██║███████╗███████║     ║
 * ║  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝     ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — RegexUtils                                                           ║
 * ║                                                                                      ║
 * ║  Exposes regular expression operations as a WakaPAC unit, making them available      ║
 * ║  in bind expressions and text interpolations.                                        ║
 * ║                                                                                      ║
 * ║  Patterns can be plain strings or slash-delimited with flags:                        ║
 * ║    'foo'       plain pattern, no flags                                               ║
 * ║    '/foo/i'    case-insensitive                                                      ║
 * ║    '/^\\d+$/m' anchored, multiline                                                   ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(RegexUtils);                                                          ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ RegexUtils.test('/^\\d+$/', value) }}                               ║
 * ║  Flat:        {{ test('/^\\d+$/', value) }}  (requires data-pac-uses="RegexUtils")   ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    /** @type {Map<string, RegExp|null>} */
    const patternCache = new Map();

    /**
     * Parses a pattern string into a RegExp object.
     * Accepts slash-delimited patterns with flags (e.g. '/foo/i') or plain strings.
     * Results are cached by pattern string to avoid repeated RegExp construction
     * across render cycles.
     * Returns null if the pattern is null, undefined, or produces an invalid RegExp.
     * @param {string} pattern
     * @returns {RegExp|null}
     */
    function parsePattern(pattern) {
        if (pattern === null || pattern === undefined) {
            return null;
        }

        const str = String(pattern);

        if (patternCache.has(str)) {
            return patternCache.get(str);
        }

        let re = null;

        try {
            const slashMatch = str.match(/^\/(.+)\/([gimsuy]*)$/);
            re = slashMatch ? new RegExp(slashMatch[1], slashMatch[2]) : new RegExp(str);
        } catch {
            console.warn(`RegexUtils: invalid pattern "${str}"`);
        }

        patternCache.set(str, re);
        return re;
    }

    window.RegexUtils = {

        createPacPlugin(pac, options = {}) {
            return {
                /** Unit namespace — accessible in binds as RegexUtils.fn() */
                name: 'RegexUtils',

                functions: {
                    /**
                     * Returns true if the pattern matches anywhere in the string.
                     * @param {string} pattern - Plain string or slash-delimited pattern (e.g. '/foo/i')
                     * @param {string} s - The string to test
                     * @returns {boolean}
                     */
                    test: (pattern, s) => {
                        const re = parsePattern(pattern);

                        if (!re) {
                            return false;
                        }

                        return re.test(String(s ?? ''));
                    },

                    /**
                     * Returns the first match of the pattern in the string, or null if not found.
                     * @param {string} pattern - Plain string or slash-delimited pattern (e.g. '/foo/i')
                     * @param {string} s - The string to search
                     * @returns {string|null}
                     */
                    match: (pattern, s) => {
                        const re = parsePattern(pattern);

                        if (!re) {
                            return null;
                        }

                        const result = String(s ?? '').match(re);
                        return result ? result[0] : null;
                    },

                    /**
                     * Returns the value of a specific capture group from the first match.
                     * Group 0 is the full match; group 1 is the first capture group, and so on.
                     * Returns null if there is no match or the group index is out of range.
                     * @param {string} pattern - Plain string or slash-delimited pattern (e.g. '/(\\d+)/')
                     * @param {string} s - The string to search
                     * @param {number} [group=1] - Capture group index (0 = full match)
                     * @returns {string|null}
                     */
                    extract: (pattern, s, group = 1) => {
                        const re = parsePattern(pattern);

                        if (!re) {
                            return null;
                        }

                        const result = String(s ?? '').match(re);

                        if (!result) {
                            return null;
                        }

                        return result[group] !== undefined ? result[group] : null;
                    },

                    /**
                     * Replaces the first match of the pattern in the string with the replacement.
                     * If the pattern includes the g flag, all matches are replaced.
                     * @param {string} pattern - Plain string or slash-delimited pattern (e.g. '/foo/i')
                     * @param {string} s - The string to search
                     * @param {string} replacement - Replacement string
                     * @returns {string}
                     */
                    replace: (pattern, s, replacement) => {
                        const re = parsePattern(pattern);

                        if (!re) {
                            return String(s ?? '');
                        }

                        return String(s ?? '').replace(re, String(replacement ?? ''));
                    },

                    /**
                     * Replaces all matches of the pattern in the string with the replacement.
                     * Forces the g flag regardless of what was specified in the pattern.
                     * @param {string} pattern - Plain string or slash-delimited pattern (e.g. '/foo/i')
                     * @param {string} s - The string to search
                     * @param {string} replacement - Replacement string
                     * @returns {string}
                     */
                    replaceAll: (pattern, s, replacement) => {
                        const re = parsePattern(pattern);

                        if (!re) {
                            return String(s ?? '');
                        }

                        // Force g flag — replaceAll requires it. Cache the rebuilt
                        // RegExp under a '+g' suffixed key to avoid collision with
                        // the non-global version stored by parsePattern.
                        let reG = re;

                        if (!re.flags.includes('g')) {
                            const cacheKey = String(pattern) + '+g';

                            if (patternCache.has(cacheKey)) {
                                reG = patternCache.get(cacheKey);
                            } else {
                                reG = new RegExp(re.source, re.flags + 'g');
                                patternCache.set(cacheKey, reG);
                            }
                        }

                        return String(s ?? '').replace(reG, String(replacement ?? ''));
                    }
                }
            };
        }
    };

})();