/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ███╗   ██╗██╗   ██╗███╗   ███╗██████╗ ███████╗██████╗ ███████╗                      ║
 * ║  ████╗  ██║██║   ██║████╗ ████║██╔══██╗██╔════╝██╔══██╗██╔════╝                      ║
 * ║  ██╔██╗ ██║██║   ██║██╔████╔██║██████╔╝█████╗  ██████╔╝███████╗                      ║
 * ║  ██║╚██╗██║██║   ██║██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗╚════██║                      ║
 * ║  ██║ ╚████║╚██████╔╝██║ ╚═╝ ██║██████╔╝███████╗██║  ██║███████║                      ║
 * ║  ╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝                      ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — NumberUtils                                                          ║
 * ║                                                                                      ║
 * ║  Exposes number formatting operations as a WakaPAC unit, making them available       ║
 * ║  in bind expressions and text interpolations.                                        ║
 * ║  Backed entirely by the native Intl API — no external libraries required.            ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(NumberUtils);                          // browser default locale      ║
 * ║    wakaPAC.use(NumberUtils, { locale: 'nl-NL' });     // explicit locale             ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ NumberUtils.currency(price, 'EUR') }}                               ║
 * ║  Flat:        {{ currency(price, 'EUR') }}  (requires data-pac-uses="NumberUtils")   ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    window.NumberUtils = {

        createPacPlugin(pac, options) {
            const locale = options.locale ?? navigator.language;

            return {
                /** Unit namespace — accessible in binds as NumberUtils.fn() */
                name: 'NumberUtils',

                functions: {
                    /**
                     * Formats a number with locale-appropriate grouping and the given number of decimal places.
                     * @param {number} n
                     * @param {number} [decimals=0] - Number of decimal places
                     * @returns {string}
                     */
                    format: (n, decimals = 0) => {
                        if (n === null || n === undefined || isNaN(n)) {
                            return '';
                        }

                        return new Intl.NumberFormat(locale, {
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals
                        }).format(n);
                    },

                    /**
                     * Formats a number as a currency value.
                     * @param {number} n
                     * @param {string} [currency='EUR'] - ISO 4217 currency code (e.g. 'EUR', 'USD', 'GBP')
                     * @param {string} [display='symbol'] - 'symbol' (€), 'code' (EUR), or 'name' (euro)
                     * @returns {string}
                     */
                    currency: (n, currency = 'EUR', display = 'symbol') => {
                        if (n === null || n === undefined || isNaN(n)) {
                            return '';
                        }

                        return new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency,
                            currencyDisplay: display
                        }).format(n);
                    },

                    /**
                     * Formats a number as a percentage.
                     * Input is a fraction (0.75 → "75%"). Pass decimals to control precision.
                     * @param {number} n - Fractional value (e.g. 0.75 for 75%)
                     * @param {number} [decimals=0] - Number of decimal places
                     * @returns {string}
                     */
                    percent: (n, decimals = 0) => {
                        if (n === null || n === undefined || isNaN(n)) {
                            return '';
                        }

                        return new Intl.NumberFormat(locale, {
                            style: 'percent',
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals
                        }).format(n);
                    },

                    /**
                     * Formats a number in compact notation (e.g. 1400 → "1.4K", 1200000 → "1.2M").
                     * @param {number} n
                     * @param {'short'|'long'} [display='short'] - 'short' (1.4K) or 'long' (1.4 thousand)
                     * @returns {string}
                     */
                    compact: (n, display = 'short') => {
                        if (n === null || n === undefined || isNaN(n)) {
                            return '';
                        }

                        return new Intl.NumberFormat(locale, {
                            notation: 'compact',
                            compactDisplay: display
                        }).format(n);
                    },

                    /**
                     * Formats a duration given in total seconds into a human-readable string.
                     * Produces hours, minutes, and seconds as applicable (e.g. 3661 → "1h 01m 01s").
                     * Omits leading zero units: 90 seconds → "1m 30s", not "0h 01m 30s".
                     * @param {number} totalSeconds - Total duration in seconds (non-negative integer)
                     * @returns {string}
                     */
                    duration: (totalSeconds) => {
                        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) {
                            return '';
                        }

                        const s = Math.floor(Math.abs(totalSeconds));
                        const sign = totalSeconds < 0 ? '-' : '';
                        const hours = Math.floor(s / 3600);
                        const minutes = Math.floor((s % 3600) / 60);
                        const seconds = s % 60;

                        const pad = (n) => String(n).padStart(2, '0');

                        if (hours > 0) {
                            return `${sign}${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
                        }

                        if (minutes > 0) {
                            return `${sign}${minutes}m ${pad(seconds)}s`;
                        }

                        return `${sign}${seconds}s`;
                    }
                },

                /**
                 * Add unit to abstraction if instructed
                 * @param abstraction
                 * @param pacId
                 * @param config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.numberUtils?.property;

                    if (key && key in abstraction) {
                        abstraction[key] = this.functions;
                    }
                }
            };
        }
    };

})();