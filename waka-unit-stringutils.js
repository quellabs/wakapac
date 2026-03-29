/*
 * ╔════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                        ║
 * ║  ███████╗████████╗██████╗ ██╗███╗   ██╗ ██████╗ ██╗   ██╗████████╗██╗██╗     ███████╗  ║
 * ║  ██╔════╝╚══██╔══╝██╔══██╗██║████╗  ██║██╔════╝ ██║   ██║╚══██╔══╝██║██║     ██╔════╝  ║
 * ║  ███████╗   ██║   ██████╔╝██║██╔██╗ ██║██║  ███╗██║   ██║   ██║   ██║██║     ███████╗  ║
 * ║  ╚════██║   ██║   ██╔══██╗██║██║╚██╗██║██║   ██║██║   ██║   ██║   ██║██║     ╚════██║  ║
 * ║  ███████║   ██║   ██║  ██║██║██║ ╚████║╚██████╔╝╚██████╔╝   ██║   ██║███████╗███████║  ║
 * ║  ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝  ║
 * ║                                                                                        ║
 * ║  WakaPAC Unit — StringUtils                                                            ║
 * ║                                                                                        ║
 * ║  Exposes common string operations as a WakaPAC unit, making them                       ║
 * ║  available in bind expressions and text interpolations.                                ║
 * ║                                                                                        ║
 * ║  Usage:                                                                                ║
 * ║    wakaPAC.use(StringUtils);                                                           ║
 * ║                                                                                        ║
 * ║  Namespaced:  {{ StringUtils.capitalize(name) }}                                       ║
 * ║  Flat:        {{ capitalize(name) }}  (requires data-pac-uses="StringUtils")           ║
 * ║                                                                                        ║
 * ╚════════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    window.StringUtils = {

        createPacPlugin(pac) {
            return {
                /** Unit namespace — accessible in binds as StringUtils.fn() */
                name: 'StringUtils',

                functions: {
                    /**
                     * Converts the first character of a string to uppercase, the rest to lowercase.
                     * @param {string} s
                     * @returns {string}
                     */
                    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),

                    /**
                     * Converts a string to uppercase.
                     * @param {string} s
                     * @returns {string}
                     */
                    upper: (s) => s.toUpperCase(),

                    /**
                     * Converts a string to lowercase.
                     * @param {string} s
                     * @returns {string}
                     */
                    lower: (s) => s.toLowerCase(),

                    /**
                     * Removes leading and trailing whitespace from a string.
                     * @param {string} s
                     * @returns {string}
                     */
                    trim: (s) => s.trim(),

                    /**
                     * Truncates a string to a maximum length, appending an ellipsis if truncated.
                     * @param {string} s
                     * @param {number} max - Maximum character length including the ellipsis
                     * @param {string} [ellipsis='…'] - String appended when truncated
                     * @returns {string}
                     */
                    truncate: (s, max, ellipsis = '…') => s.length <= max ? s : s.slice(0, max - ellipsis.length) + ellipsis,

                    /**
                     * Replaces the first occurrence of a substring.
                     * @param {string} s
                     * @param {string} search
                     * @param {string} replacement
                     * @returns {string}
                     */
                    replace: (s, search, replacement) => s.replace(search, replacement),

                    /**
                     * Replaces all occurrences of a substring.
                     * @param {string} s
                     * @param {string} search
                     * @param {string} replacement
                     * @returns {string}
                     */
                    replaceAll: (s, search, replacement) => s.replaceAll(search, replacement),

                    /**
                     * Returns true if the string starts with the given substring.
                     * @param {string} s
                     * @param {string} search
                     * @returns {boolean}
                     */
                    startsWith: (s, search) => s.startsWith(search),

                    /**
                     * Returns true if the string ends with the given substring.
                     * @param {string} s
                     * @param {string} search
                     * @returns {boolean}
                     */
                    endsWith: (s, search) => s.endsWith(search),

                    /**
                     * Returns true if the string contains the given substring.
                     * @param {string} s
                     * @param {string} search
                     * @returns {boolean}
                     */
                    contains: (s, search) => s.includes(search),

                    /**
                     * Pads the start of a string to a target length with a given fill character.
                     * @param {string} s
                     * @param {number} length - Target length
                     * @param {string} [fill=' '] - Fill character
                     * @returns {string}
                     */
                    padStart: (s, length, fill = ' ') => s.padStart(length, fill),

                    /**
                     * Pads the end of a string to a target length with a given fill character.
                     * @param {string} s
                     * @param {number} length - Target length
                     * @param {string} [fill=' '] - Fill character
                     * @returns {string}
                     */
                    padEnd: (s, length, fill = ' ') => s.padEnd(length, fill),

                    /**
                     * Repeats a string a given number of times.
                     * @param {string} s
                     * @param {number} count
                     * @returns {string}
                     */
                    repeat: (s, count) => s.repeat(count),

                    /**
                     * Returns the number of characters in a string.
                     * @param {string} s
                     * @returns {number}
                     */
                    length: (s) => s.length,

                    /**
                     * Converts a string to a URL-friendly slug.
                     * Lowercases, replaces spaces and non-alphanumeric characters with hyphens,
                     * and collapses consecutive hyphens.
                     * @param {string} s
                     * @returns {string}
                     */
                    slug: (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                }
            };
        }
    };

})();