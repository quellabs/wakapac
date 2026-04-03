/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                          ║
 * ║   ███████╗███████╗ ██████╗ █████╗ ██████╗ ███████╗██╗   ██╗████████╗██╗██╗     ███████╗  ║
 * ║   ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║╚══██╔══╝██║██║     ██╔════╝  ║
 * ║   █████╗  ███████╗██║     ███████║██████╔╝█████╗  ██║   ██║   ██║   ██║██║     ███████╗  ║
 * ║   ██╔══╝  ╚════██║██║     ██╔══██║██╔═══╝ ██╔══╝  ██║   ██║   ██║   ██║██║     ╚════██║  ║
 * ║   ███████╗███████║╚██████╗██║  ██║██║     ███████╗╚██████╔╝   ██║   ██║███████╗███████║  ║
 * ║   ╚══════╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝  ║
 * ║                                                                                          ║
 * ║  WakaPAC Unit — EscapeUtils                                                              ║
 * ║                                                                                          ║
 * ║  Utility functions for escaping and sanitizing strings in templates.                     ║
 * ║                                                                                          ║
 * ║  Usage:                                                                                  ║
 * ║    wakaPAC.use(EscapeUtils);                                                             ║
 * ║                                                                                          ║
 * ║  Namespaced:  {{ EscapeUtils.escapeHtml(value) }}                                        ║
 * ║  Flat:        {{ escapeHtml(value) }}  (requires data-pac-uses="EscapeUtils")            ║
 * ║                                                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    window.EscapeUtils = {

        /**
         * Creates the WakaPAC plugin definition.
         *
         * @returns {{name:string, functions:Object, onComponentCreated:Function}}
         */
        createPacPlugin() {

            const htmlEscapeMap = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            const htmlUnescapeMap = {
                "&amp;": "&",
                "&lt;": "<",
                "&gt;": ">",
                "&quot;": '"',
                "&#39;": "'"
            };

            const htmlEscapeRegex = /[&<>"']/g;
            const htmlUnescapeRegex = /&(amp|lt|gt|quot|#39);/g;

            /**
             * Converts a value to string safely.
             *
             * @param {*} value
             * @returns {string}
             */
            function toString(value) {
                if (value === null || value === undefined) {
                    return "";
                }

                return String(value);
            }

            return {
                name: "EscapeUtils",
                functions: {

                    /**
                     * Escapes HTML special characters.
                     * @param {*} value
                     * @returns {string}
                     */
                    escapeHtml(value) {
                        const str = toString(value);

                        return str.replace(htmlEscapeRegex, char => {
                            return htmlEscapeMap[char] || char;
                        });
                    },

                    /**
                     * Unescapes HTML entities back to characters.
                     * @param {*} value
                     * @returns {string}
                     */
                    unescapeHtml(value) {
                        const str = toString(value);

                        return str.replace(htmlUnescapeRegex, entity => {
                            return htmlUnescapeMap[entity] || entity;
                        });
                    },

                    /**
                     * Escapes characters so the string can safely be used
                     * inside a regular expression.
                     * @param {*} value
                     * @returns {string}
                     */
                    escapeRegex(value) {
                        const str = toString(value);

                        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    },

                    /**
                     * Escapes a string for safe usage inside a URL component.
                     * @param {*} value
                     * @returns {string}
                     */
                    escapeUrl(value) {
                        return encodeURIComponent(toString(value));
                    },

                    /**
                     * Decodes a URL component.
                     * @param {*} value
                     * @returns {string}
                     */
                    unescapeUrl(value) {
                        try {
                            return decodeURIComponent(toString(value));
                        } catch {
                            return "";
                        }
                    }
                },

                /**
                 * Attaches EscapeUtils to the component namespace
                 * if the configured property already exists.
                 * @param {Object} abstraction
                 * @param {string} pacId
                 * @param {Object} config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.escapeUtils?.property;

                    if (key && key in abstraction) {
                        abstraction[key] = this.functions;
                    }
                }
            };
        }
    };

})();