/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ████████╗██╗   ██╗██████╗ ███████╗██╗   ██╗████████╗██╗██╗     ███████╗             ║
 * ║  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝██║   ██║╚══██╔══╝██║██║     ██╔════╝             ║
 * ║     ██║    ╚████╔╝ ██████╔╝█████╗  ██║   ██║   ██║   ██║██║     ███████╗             ║
 * ║     ██║     ╚██╔╝  ██╔═══╝ ██╔══╝  ██║   ██║   ██║   ██║██║     ╚════██║             ║
 * ║     ██║      ██║   ██║     ███████╗╚██████╔╝   ██║   ██║███████╗███████║             ║
 * ║     ╚═╝      ╚═╝   ╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝             ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — TypeUtils                                                            ║
 * ║                                                                                      ║
 * ║  Exposes type checking and type coercion functions as a WakaPAC unit, making         ║
 * ║  them available in bind expressions and text interpolations.                         ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(TypeUtils);                                                           ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ TypeUtils.isNull(value) }}                                          ║
 * ║  Flat:        {{ isNull(value) }}  (requires data-pac-uses="TypeUtils")              ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    window.TypeUtils = {

        createPacPlugin(pac, options = {}) {
            return {
                /** Unit namespace — accessible in binds as TypeUtils.fn() */
                name: 'TypeUtils',

                functions: {

                    // ─── Type Checking ────────────────────────────────────────────────

                    /**
                     * Returns true if the value is null or undefined.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isNull: (value) => value === null || value === undefined,

                    /**
                     * Returns true if the value is not null and not undefined.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isDefined: (value) => value !== null && value !== undefined,

                    /**
                     * Returns true if the value is a string.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isString: (value) => typeof value === 'string',

                    /**
                     * Returns true if the value is a finite number (excludes NaN and Infinity).
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isNumber: (value) => typeof value === 'number' && isFinite(value),

                    /**
                     * Returns true if the value is an integer.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isInt: (value) => Number.isInteger(value),

                    /**
                     * Returns true if the value is a boolean.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isBool: (value) => typeof value === 'boolean',

                    /**
                     * Returns true if the value is an array.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isArray: (value) => Array.isArray(value),

                    /**
                     * Returns true if the value is a plain object (not an array, Date, or null).
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isObject: (value) => value !== null
                        && typeof value === 'object'
                        && !Array.isArray(value)
                        && !(value instanceof Date),

                    /**
                     * Returns true if the value is a Date object.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isDate: (value) => value instanceof Date && !isNaN(value.getTime()),

                    /**
                     * Returns true if the value is a function.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isFunction: (value) => typeof value === 'function',

                    // ─── Emptiness ────────────────────────────────────────────────────

                    /**
                     * Returns true if the value is empty.
                     * Empty means: null, undefined, empty string, empty array,
                     * object with no own keys, or the number 0.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isEmpty: (value) => {
                        if (value === null || value === undefined) {
                            return true;
                        }

                        if (typeof value === 'string' || Array.isArray(value)) {
                            return value.length === 0;
                        }

                        if (typeof value === 'object' && !(value instanceof Date)) {
                            return Object.keys(value).length === 0;
                        }

                        if (typeof value === 'number') {
                            return value === 0;
                        }

                        return false;
                    },

                    /**
                     * Returns true if the value is not empty (inverse of isEmpty).
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isNotEmpty: (value) => {
                        if (value === null || value === undefined) {
                            return false;
                        }

                        if (typeof value === 'string' || Array.isArray(value)) {
                            return value.length > 0;
                        }

                        if (typeof value === 'object' && !(value instanceof Date)) {
                            return Object.keys(value).length > 0;
                        }

                        if (typeof value === 'number') {
                            return value !== 0;
                        }

                        return true;
                    },

                    /**
                     * Returns true if the value is NaN.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    isNaN: (value) => Number.isNaN(value),

                    // ─── Type Coercion ────────────────────────────────────────────────

                    /**
                     * Converts a value to an integer.
                     * Returns null if the result is NaN.
                     * Supports optional radix (default 10).
                     * @param {*} value
                     * @param {number} [radix=10]
                     * @returns {number|null}
                     */
                    toInt: (value, radix = 10) => {
                        const n = parseInt(value, radix);
                        return isNaN(n) ? null : n;
                    },

                    /**
                     * Converts a value to a floating-point number.
                     * Returns null if the result is NaN.
                     * @param {*} value
                     * @returns {number|null}
                     */
                    toFloat: (value) => {
                        const n = parseFloat(value);
                        return isNaN(n) ? null : n;
                    },

                    /**
                     * Converts a value to a boolean.
                     * Truthy strings: 'true', '1', 'yes', 'on' (case-insensitive).
                     * Falsy strings: 'false', '0', 'no', 'off' (case-insensitive).
                     * All other values use standard JavaScript truthiness.
                     * @param {*} value
                     * @returns {boolean}
                     */
                    toBool: (value) => {
                        if (typeof value === 'boolean') {
                            return value;
                        }

                        if (typeof value === 'string') {
                            const s = value.trim().toLowerCase();

                            if (s === 'true' || s === '1' || s === 'yes' || s === 'on') {
                                return true;
                            }

                            if (s === 'false' || s === '0' || s === 'no' || s === 'off') {
                                return false;
                            }
                        }

                        return Boolean(value);
                    },

                    /**
                     * Converts a value to a string.
                     * Returns '' for null and undefined rather than 'null' or 'undefined'.
                     * @param {*} value
                     * @returns {string}
                     */
                    toString: (value) => {
                        if (value === null || value === undefined) {
                            return '';
                        }

                        return String(value);
                    },

                    /**
                     * Returns the first non-null, non-undefined value from the arguments.
                     * Returns null if all values are null or undefined.
                     * @param {...*} args
                     * @returns {*}
                     */
                    coalesce: (...args) => {
                        for (const arg of args) {
                            if (arg !== null && arg !== undefined) {
                                return arg;
                            }
                        }

                        return null;
                    },

                    /**
                     * Returns the type of the value as a string.
                     * Returns 'null', 'array', 'date', or standard typeof values.
                     * @param {*} value
                     * @returns {string}
                     */
                    typeOf: (value) => {
                        if (value === null) {
                            return 'null';
                        }

                        if (Array.isArray(value)) {
                            return 'array';
                        }

                        if (value instanceof Date) {
                            return 'date';
                        }

                        return typeof value;
                    }
                }
            };
        }
    };

})();