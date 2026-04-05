/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║   ██████╗ ██████╗ ██╗     ██╗     ███████╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗   ║
 * ║  ██╔════╝██╔═══██╗██║     ██║     ██╔════╝██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║   ║
 * ║  ██║     ██║   ██║██║     ██║     █████╗  ██║        ██║   ██║██║   ██║██╔██╗ ██║   ║
 * ║  ██║     ██║   ██║██║     ██║     ██╔══╝  ██║        ██║   ██║██║   ██║██║╚██╗██║   ║
 * ║  ╚██████╗╚██████╔╝███████╗███████╗███████╗╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║   ║
 * ║   ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — CollectionUtils                                                      ║
 * ║                                                                                      ║
 * ║  Exposes array and collection operations as a WakaPAC unit, making them              ║
 * ║  available in bind expressions and text interpolations.                              ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(CollectionUtils);                                                     ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ CollectionUtils.groupBy(orders, 'status') }}                        ║
 * ║  Flat:        {{ groupBy(orders, 'status') }}                                        ║
 * ║               (requires data-pac-uses="CollectionUtils")                            ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    /**
     * Resolves a pre-split path segment array against an object.
     * Returns undefined if any segment in the path is missing.
     * @param {Object} obj
     * @param {string[]} segments - Pre-split path segments
     * @returns {*}
     */
    function getPathSegments(obj, segments) {
        if (segments.length === 0) {
            return undefined;
        }

        let current = obj;

        for (let i = 0, len = segments.length; i < len; i++) {
            if (current === null || current === undefined) {
                return undefined;
            }

            current = current[segments[i]];
        }

        return current;
    }

    /**
     * Normalises a key to a pre-split segment array.
     * Handles null, undefined, non-string, and empty values safely.
     * @param {*} key
     * @returns {string[]}
     */
    function toSegments(key) {
        if (key === null || key === undefined || key === '') {
            return [];
        }

        return String(key).split('.');
    }

    window.CollectionUtils = {

        createPacPlugin() {
            return {
                /** Unit namespace — accessible in binds as CollectionUtils.fn() */
                name: 'CollectionUtils',

                functions: {
                    /**
                     * Groups array elements by the value at the given dot-notation key path.
                     * Returns a plain object whose keys are the distinct group values and
                     * whose values are arrays of matching items.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path (e.g. 'status' or 'address.city')
                     * @returns {Object}
                     */
                    groupBy: (arr, key) => {
                        if (!Array.isArray(arr)) {
                            return {};
                        }

                        const segments = toSegments(key);
                        const result = Object.create(null);

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const group = String(getPathSegments(arr[i], segments) ?? '');

                            if (result[group] === undefined) {
                                result[group] = [];
                            }

                            result[group].push(arr[i]);
                        }

                        return result;
                    },

                    /**
                     * Returns a new array sorted by the value at the given dot-notation key path.
                     * Does not mutate the original array.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @param {'asc'|'desc'} [dir='asc'] - Sort direction
                     * @returns {Array}
                     */
                    sortBy: (arr, key, dir = 'asc') => {
                        if (!Array.isArray(arr)) {
                            return [];
                        }

                        const segments = toSegments(key);
                        const factor = dir === 'desc' ? -1 : 1;

                        return [...arr].sort((a, b) => {
                            const av = getPathSegments(a, segments);
                            const bv = getPathSegments(b, segments);

                            if (av === bv) {
                                return 0;
                            }

                            if (av === null || av === undefined) {
                                return factor;
                            }

                            if (bv === null || bv === undefined) {
                                return -factor;
                            }

                            return av < bv ? -factor : factor;
                        });
                    },

                    /**
                     * Returns a new array with duplicate values removed.
                     * For arrays of objects, pass a key path to deduplicate by that property.
                     * Without a key, uses strict equality (===).
                     * @param {Array} arr
                     * @param {string} [key] - Optional dot-notation property path
                     * @returns {Array}
                     */
                    unique: (arr, key) => {
                        if (!Array.isArray(arr)) {
                            return [];
                        }

                        if (!key) {
                            return [...new Set(arr)];
                        }

                        const segments = toSegments(key);
                        const seen = new Set();
                        const result = [];

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const val = getPathSegments(arr[i], segments);

                            if (!seen.has(val)) {
                                seen.add(val);
                                result.push(arr[i]);
                            }
                        }

                        return result;
                    },

                    /**
                     * Returns an object mapping each distinct value at key to its count in arr.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @returns {Object}
                     */
                    countBy: (arr, key) => {
                        if (!Array.isArray(arr)) {
                            return {};
                        }

                        const segments = toSegments(key);
                        const result = Object.create(null);

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const group = String(getPathSegments(arr[i], segments) ?? '');
                            result[group] = (result[group] ?? 0) + 1;
                        }

                        return result;
                    },

                    /**
                     * Splits an array into chunks of a given size.
                     * The last chunk may be smaller if the array length is not evenly divisible.
                     * @param {Array} arr
                     * @param {number} size - Chunk size (must be >= 1)
                     * @returns {Array<Array>}
                     */
                    chunk: (arr, size) => {
                        if (!Array.isArray(arr) || size < 1) {
                            return [];
                        }

                        const result = [];
                        const len = arr.length;

                        for (let i = 0; i < len; i += size) {
                            result.push(arr.slice(i, i + size));
                        }

                        return result;
                    },

                    /**
                     * Flattens one level of nesting from an array.
                     * Does not recursively flatten deeper levels.
                     * @param {Array} arr
                     * @returns {Array}
                     */
                    flatten: (arr) => Array.isArray(arr) ? arr.flat() : [],

                    /**
                     * Interleaves two arrays into an array of [a, b] pairs.
                     * Stops at the length of the shorter array.
                     * @param {Array} a
                     * @param {Array} b
                     * @returns {Array<Array>}
                     */
                    zip: (a, b) => {
                        if (!Array.isArray(a) || !Array.isArray(b)) {
                            return [];
                        }

                        const len = Math.min(a.length, b.length);
                        const result = new Array(len);

                        for (let i = 0; i < len; i++) {
                            result[i] = [a[i], b[i]];
                        }

                        return result;
                    },

                    /**
                     * Returns the sum of values at the given dot-notation key path across all items.
                     * Non-numeric values are skipped. Returns 0 for an empty array.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @returns {number}
                     */
                    sum: (arr, key) => {
                        if (!Array.isArray(arr)) {
                            return 0;
                        }

                        const segments = toSegments(key);
                        let total = 0;

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const val = Number(getPathSegments(arr[i], segments));

                            if (!isNaN(val)) {
                                total += val;
                            }
                        }

                        return total;
                    },

                    /**
                     * Returns the average of values at the given dot-notation key path across all items.
                     * Non-numeric values are excluded from both the sum and the count.
                     * Returns null for an empty array or when no numeric values are found.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @returns {number|null}
                     */
                    avg: (arr, key) => {
                        if (!Array.isArray(arr) || arr.length === 0) {
                            return null;
                        }

                        const segments = toSegments(key);
                        let total = 0;
                        let count = 0;

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const val = Number(getPathSegments(arr[i], segments));

                            if (!isNaN(val)) {
                                total += val;
                                count++;
                            }
                        }

                        return count === 0 ? null : total / count;
                    },

                    /**
                     * Returns the minimum value at the given dot-notation key path across all items.
                     * Non-numeric values are excluded.
                     * Returns null for an empty array or when no numeric values are found.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @returns {number|null}
                     */
                    min: (arr, key) => {
                        if (!Array.isArray(arr) || arr.length === 0) {
                            return null;
                        }

                        const segments = toSegments(key);
                        let result = null;

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const val = Number(getPathSegments(arr[i], segments));

                            if (!isNaN(val) && (result === null || val < result)) {
                                result = val;
                            }
                        }

                        return result;
                    },

                    /**
                     * Returns the maximum value at the given dot-notation key path across all items.
                     * Non-numeric values are excluded.
                     * Returns null for an empty array or when no numeric values are found.
                     * @param {Array} arr
                     * @param {string} key - Dot-notation property path
                     * @returns {number|null}
                     */
                    max: (arr, key) => {
                        if (!Array.isArray(arr) || arr.length === 0) {
                            return null;
                        }

                        const segments = toSegments(key);
                        let result = null;

                        for (let i = 0, len = arr.length; i < len; i++) {
                            const val = Number(getPathSegments(arr[i], segments));

                            if (!isNaN(val) && (result === null || val > result)) {
                                result = val;
                            }
                        }

                        return result;
                    }
                }
            };
        }
    };

})();