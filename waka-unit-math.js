/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║        ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███╗   ███╗ █████╗ ████████╗██╗  ██╗        ║
 * ║        ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗████╗ ████║██╔══██╗╚══██╔══╝██║  ██║        ║
 * ║        ██║ █╗ ██║███████║█████╔╝ ███████║██╔████╔██║███████║   ██║   ███████║        ║
 * ║        ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║╚██╔╝██║██╔══██║   ██║   ██╔══██║        ║
 * ║        ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║        ║
 * ║         ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝        ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — Math                                                                 ║
 * ║                                                                                      ║
 * ║  Exposes common mathematical operations as a WakaPAC unit, making them               ║
 * ║  available in bind expressions and text interpolations.                              ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaMath);                                                            ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ Math.round(price) }}                                                ║
 * ║  Flat:        {{ round(price) }}  (requires data-pac-uses="Math")                    ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    window.WakaMath = {

        createPacPlugin(pac) {
            return {
                /** Unit namespace — accessible in binds as Math.fn() */
                name: 'Math',

                functions: {
                    /**
                     * Returns the absolute value of a number.
                     * @param {number} n
                     * @returns {number}
                     */
                    abs: (n) => Math.abs(n),

                    /**
                     * Rounds a number up to the nearest integer.
                     * @param {number} n
                     * @returns {number}
                     */
                    ceil: (n) => Math.ceil(n),

                    /**
                     * Rounds a number down to the nearest integer.
                     * @param {number} n
                     * @returns {number}
                     */
                    floor: (n) => Math.floor(n),

                    /**
                     * Rounds a number to the nearest integer.
                     * @param {number} n
                     * @returns {number}
                     */
                    round: (n) => Math.round(n),

                    /**
                     * Returns the smallest of the given values.
                     * @param {...number} args
                     * @returns {number}
                     */
                    min: (...args) => Math.min(...args),

                    /**
                     * Returns the largest of the given values.
                     * @param {...number} args
                     * @returns {number}
                     */
                    max: (...args) => Math.max(...args),

                    /**
                     * Clamps a number between a minimum and maximum value.
                     * @param {number} n
                     * @param {number} lo - Lower bound
                     * @param {number} hi - Upper bound
                     * @returns {number}
                     */
                    clamp: (n, lo, hi) => Math.min(Math.max(n, lo), hi),

                    /**
                     * Returns base raised to the power of exp.
                     * @param {number} base
                     * @param {number} exp
                     * @returns {number}
                     */
                    pow: (base, exp) => Math.pow(base, exp),

                    /**
                     * Returns the square root of a number.
                     * @param {number} n
                     * @returns {number}
                     */
                    sqrt: (n) => Math.sqrt(n),

                    /**
                     * Returns the sign of a number: 1, -1, or 0.
                     * @param {number} n
                     * @returns {number}
                     */
                    sign: (n) => Math.sign(n),

                    /**
                     * Returns the integer part of a number, removing any fractional digits.
                     * @param {number} n
                     * @returns {number}
                     */
                    trunc: (n) => Math.trunc(n),

                    /**
                     * Returns the value of π (pi).
                     * @returns {number}
                     */
                    PI: () => Math.PI,

                    /**
                     * Returns a pseudo-random number between 0 (inclusive) and 1 (exclusive).
                     * Note: re-evaluates on every render cycle — use sparingly in binds.
                     * @returns {number}
                     */
                    random: () => Math.random()
                }
            };
        }
    };

})();