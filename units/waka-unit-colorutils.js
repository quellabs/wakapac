/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║   ██████╗ ██████╗ ██╗      ██████╗ ██████╗ ██╗   ██╗████████╗██╗██╗     ███████╗     ║
 * ║  ██╔════╝██╔═══██╗██║     ██╔═══██╗██╔══██╗██║   ██║╚══██╔══╝██║██║     ██╔════╝     ║
 * ║  ██║     ██║   ██║██║     ██║   ██║██████╔╝██║   ██║   ██║   ██║██║     ███████╗     ║
 * ║  ██║     ██║   ██║██║     ██║   ██║██╔══██╗██║   ██║   ██║   ██║██║     ╚════██║     ║
 * ║  ╚██████╗╚██████╔╝███████╗╚██████╔╝██║  ██║╚██████╔╝   ██║   ██║███████╗███████║     ║
 * ║   ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝     ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — ColorUtils                                                           ║
 * ║                                                                                      ║
 * ║  Utility functions for working with colors in templates.                             ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(ColorUtils);                                                          ║
 * ║                                                                                      ║
 * ║  Namespaced:  {{ ColorUtils.lighten('#3366ff', 0.2) }}                               ║
 * ║  Flat:        {{ lighten('#3366ff', 0.2) }}  (requires data-pac-uses="ColorUtils")   ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    window.ColorUtils = {

        createPacPlugin() {

            /**
             * Restricts a numeric value to a specific range.
             * @param {number} value
             * @param {number} [min=0]
             * @param {number} [max=255]
             * @returns {number}
             */
            function clamp(value, min = 0, max = 255) {
                return Math.min(max, Math.max(min, value));
            }

            /**
             * Normalizes a hex color string to a 6-character lowercase format.
             * Accepts `#rgb` and `#rrggbb`.
             * @param {string} hex
             * @returns {string|null} Normalized hex string without `#`, or null if invalid
             */
            function normalizeHex(hex) {
                if (!hex) {
                    return null;
                }

                hex = hex.replace('#', '');

                if (hex.length === 3) {
                    hex = hex.split('').map(c => c + c).join('');
                }

                if (hex.length !== 6) {
                    return null;
                }

                return hex.toLowerCase();
            }

            /**
             * Converts a hex color string to an RGB object.
             * @param {string} hex
             * @returns {{r:number,g:number,b:number}|null}
             */
            function hexToRgbInternal(hex) {
                const normalized = normalizeHex(hex);

                if (!normalized) {
                    return null;
                }

                const r = parseInt(normalized.slice(0, 2), 16);
                const g = parseInt(normalized.slice(2, 4), 16);
                const b = parseInt(normalized.slice(4, 6), 16);

                return {r, g, b};
            }

            /**
             * Converts RGB channel values to a hex color string.
             * @param {number} r
             * @param {number} g
             * @param {number} b
             * @returns {string}
             */
            function rgbToHexInternal(r, g, b) {
                const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            }

            /**
             * Mixes a color toward a target color by a specified ratio.
             * @param {string} color Base hex color
             * @param {{r:number,g:number,b:number}} target Target RGB color
             * @param {number} amount Blend ratio (0..1)
             * @returns {string}
             */
            function mix(color, target, amount) {
                const rgb = hexToRgbInternal(color);

                if (!rgb) {
                    return '';
                }

                const r = rgb.r + (target.r - rgb.r) * amount;
                const g = rgb.g + (target.g - rgb.g) * amount;
                const b = rgb.b + (target.b - rgb.b) * amount;

                return rgbToHexInternal(r, g, b);
            }

            return {
                name: 'ColorUtils',

                functions: {

                    /**
                     * Converts a hex color string to an RGB object.
                     * @param {string} hex Hex color string
                     * @returns {{r:number,g:number,b:number}|''}
                     */
                    hexToRgb: (hex) => {
                        const rgb = hexToRgbInternal(hex);
                        return rgb ?? '';
                    },

                    /**
                     * Converts RGB channel values to a hex color string.
                     * @param {number} r Red channel (0–255)
                     * @param {number} g Green channel (0–255)
                     * @param {number} b Blue channel (0–255)
                     * @returns {string}
                     */
                    rgbToHex: (r, g, b) => {
                        if ([r, g, b].some(v => v === null || v === undefined)) {
                            return '';
                        }

                        return rgbToHexInternal(r, g, b);
                    },

                    /**
                     * Lightens a hex color by mixing it with white.
                     * @param {string} hex Base hex color
                     * @param {number} [amount=0.2] Blend ratio (0..1)
                     * @returns {string}
                     */
                    lighten: (hex, amount = 0.2) => {
                        return mix(hex, {r: 255, g: 255, b: 255}, amount);
                    },

                    /**
                     * Darkens a hex color by mixing it with black.
                     * @param {string} hex Base hex color
                     * @param {number} [amount=0.2] Blend ratio (0..1)
                     * @returns {string}
                     */
                    darken: (hex, amount = 0.2) => {
                        return mix(hex, {r: 0, g: 0, b: 0}, amount);
                    },

                    /**
                     * Converts a hex color to an RGBA string with an alpha channel.
                     * @param {string} hex Base hex color
                     * @param {number} [alpha=1] Alpha value (0..1)
                     * @returns {string}
                     */
                    alpha: (hex, alpha = 1) => {
                        const rgb = hexToRgbInternal(hex);

                        if (!rgb) {
                            return '';
                        }

                        alpha = Math.min(1, Math.max(0, alpha));
                        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
                    }
                },

                /**
                 * Add unit to abstraction if instructed
                 * @param abstraction
                 * @param pacId
                 * @param config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.colorUtils?.property;

                    if (key && key in abstraction) {
                        abstraction[key] = this.functions;
                    }
                }
            };
        }
    };
})();