/*
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║    ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗██████╗  ██████╗     ║
 * ║    ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔══██╗██╔════╝     ║
 * ║    ██║ █╗ ██║███████║█████╔╝ ███████║██████╔╝██████╔╝██║██║  ██║██║  ███╗    ║
 * ║    ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔══██╗██╔══██╗██║██║  ██║██║   ██║    ║
 * ║    ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝██║  ██║██║██████╔╝╚██████╔╝    ║
 * ║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚═════╝  ╚═════╝     ║
 * ║                                                                              ║
 * ║  WakaBridge - HTTP Message Bridge for WakaPAC                                ║
 * ║                                                                              ║
 * ║  Middleware that routes WakaSync HTTP responses through WakaPAC's msgProc    ║
 * ║  event system. Neither library is aware of the other — this bridge is the    ║
 * ║  only coupling point between them.                                           ║
 * ║                                                                              ║
 * ║  Load order: wakasync.js → wakapac.js → wakabridge.js                        ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // DEPENDENCY CHECK
    // =========================================================================

    if (typeof window.wakaSync === 'undefined') {
        throw new Error('wakaBridge: wakaSync must be loaded before wakabridge.js');
    }

    if (typeof window.wakaPAC === 'undefined') {
        throw new Error('wakaBridge: wakaPAC must be loaded before wakabridge.js');
    }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const VERSION = '1.0.0';

    /**
     * HTTP message types, offset from MSG_USER to avoid collisions with
     * application-defined messages. Applications should define their own
     * custom messages starting at wakaPAC.MSG_USER (0x1000).
     * The bridge reserves 0x1100–0x110F for HTTP lifecycle messages.
     * @constant {number}
     */
    const MSG_HTTP_SUCCESS = wakaPAC.MSG_USER + 0x100;
    const MSG_HTTP_ERROR   = wakaPAC.MSG_USER + 0x101;
    const MSG_HTTP_ABORT   = wakaPAC.MSG_USER + 0x102;

    // =========================================================================
    // BRIDGE CORE
    // =========================================================================

    /**
     * Monotonically increasing request counter.
     * Each request gets a unique ID so components can correlate responses
     * to their originating requests via event.wParam.
     * @type {number}
     */
    let _nextRequestId = 0;

    /**
     * Initiates an HTTP request through wakaSync and delivers the result
     * as a message to the specified wakaPAC component.
     *
     * On success:   MSG_HTTP_SUCCESS  wParam=requestId  lParam=0
     *   detail: { data, url, method, status, timing }
     *
     * On error:     MSG_HTTP_ERROR    wParam=requestId  lParam=httpStatus|0
     *   detail: { error, url, method, status, code }
     *
     * On abort:     MSG_HTTP_ABORT    wParam=requestId  lParam=0
     *   detail: { error, url, method }
     *
     * @param {string} pacId - Target component's data-pac-id
     * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD)
     * @param {string} url - Request URL
     * @param {Object} [opts={}] - WakaSync request options (headers, data, retries, etc.)
     * @returns {number} Request ID for correlation in msgProc via event.wParam
     */
    function request(pacId, method, url, opts) {
        opts = opts || {};

        const requestId = ++_nextRequestId;
        const startTime = Date.now();

        // Default groupKey to pacId so cancelGroup(pacId) cancels all
        // requests for this component. Explicit groupKey overrides this.
        const groupKey = opts.groupKey !== undefined ? opts.groupKey : pacId;

        wakaSync.request(url, assign({}, opts, {
            method: method,
            groupKey: groupKey
        })).then(function (data) {
            var endTime = Date.now();

            wakaPAC.postMessage(pacId, MSG_HTTP_SUCCESS, requestId, 0, {
                data: data,
                url: url,
                method: method,
                timing: {
                    startTime: startTime,
                    endTime: endTime,
                    duration: endTime - startTime
                }
            });
        }).catch(function (error) {
            // Distinguish cancellation from actual errors
            if (wakaSync.isCancellationError(error)) {
                wakaPAC.postMessage(pacId, MSG_HTTP_ABORT, requestId, 0, {
                    error: error,
                    url: url,
                    method: method
                });
            } else {
                // Extract HTTP status from the error's response if available
                const status = (error.response && error.response.status) ? error.response.status : 0;

                wakaPAC.postMessage(pacId, MSG_HTTP_ERROR, requestId, status, {
                    error: error,
                    url: url,
                    method: method,
                    status: status,
                    code: error.code || null
                });
            }
        });

        return requestId;
    }

    /**
     * Creates a component-bound HTTP handle.
     * Eliminates pacId boilerplate in component code and provides
     * a clean API surface scoped to a single component.
     *
     * Usage in init():
     *   this.http = wakaBridge.bind(this.pacId);
     *   this.http.get('/api/items');
     *
     * @param {string} pacId - Target component's data-pac-id
     * @returns {Object} Bound HTTP handle with get, post, put, patch, delete, head, cancel
     */
    function bind(pacId) {
        return {
            /**
             * Sends a GET request.
             * @param {string} url - Request URL
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            get: function (url, opts) {
                return request(pacId, 'GET', url, opts);
            },

            /**
             * Sends a POST request.
             * @param {string} url - Request URL
             * @param {*} data - Request body
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            post: function (url, data, opts) {
                return request(pacId, 'POST', url, assign({}, opts, { data: data }));
            },

            /**
             * Sends a PUT request.
             * @param {string} url - Request URL
             * @param {*} data - Request body
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            put: function (url, data, opts) {
                return request(pacId, 'PUT', url, assign({}, opts, { data: data }));
            },

            /**
             * Sends a PATCH request.
             * @param {string} url - Request URL
             * @param {*} data - Request body
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            patch: function (url, data, opts) {
                return request(pacId, 'PATCH', url, assign({}, opts, { data: data }));
            },

            /**
             * Sends a DELETE request.
             * @param {string} url - Request URL
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            delete: function (url, opts) {
                return request(pacId, 'DELETE', url, opts);
            },

            /**
             * Sends a HEAD request.
             * @param {string} url - Request URL
             * @param {Object} [opts] - WakaSync request options
             * @returns {number} Request ID
             */
            head: function (url, opts) {
                return request(pacId, 'HEAD', url, opts);
            },

            /**
             * Cancels all in-flight requests for this component.
             * Uses the default groupKey (pacId) set by the bridge.
             */
            cancel: function () {
                wakaSync.cancelGroup(pacId);
            }
        };
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /**
     * Simple object assign. Merges source objects into the target.
     * Does not deep-merge — consistent with how wakaSync handles opts.
     * @param {Object} target
     * @returns {Object} The target object
     */
    function assign(target) {
        for (let i = 1; i < arguments.length; i++) {
            const source = arguments[i];

            if (source != null) {
                for (const key in source) {
                    if (source.hasOwnProperty(key)) {
                        target[key] = source[key];
                    }
                }
            }
        }

        return target;
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const wakaBridge = {
        request: request,
        bind:    bind,

        // Message constants
        MSG_HTTP_SUCCESS: MSG_HTTP_SUCCESS,
        MSG_HTTP_ERROR:   MSG_HTTP_ERROR,
        MSG_HTTP_ABORT:   MSG_HTTP_ABORT,

        // Version
        VERSION: VERSION
    };

    /* globals module, define */
    // UMD export: CommonJS, AMD, and browser global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = wakaBridge;
    } else if (typeof define === 'function' && define.amd) {
        define(function () { return wakaBridge; });
    } else if (typeof window !== 'undefined') {
        window.wakaBridge = wakaBridge;
    }
})();