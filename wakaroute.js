/*
 * ╔══════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                  ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗   ██╗████████╗███████╗   ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝   ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██████╔╝██║   ██║██║   ██║   ██║   █████╗     ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝     ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗   ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝   ║
 * ║                                                                                  ║
 * ║  WakaPAC Router Plugin                                                           ║
 * ║                                                                                  ║
 * ║  A client-side router plugin for the WakaPAC framework. Broadcasts               ║
 * ║  MSG_ROUTE_CHANGE to all components on navigation, with route pattern            ║
 * ║  matching and parameter extraction utilities.                                    ║
 * ║                                                                                  ║
 * ║  Usage:                                                                          ║
 * ║    wakaPAC.use(wakaRoute);                                                       ║
 * ║    wakaRoute.navigate('/users/42');                                              ║
 * ║                                                                                  ║
 * ║  Components receive MSG_ROUTE_CHANGE with detail: { path, query }                ║
 * ║  Use wakaRoute.matchPattern('/users/:id', detail.path) to extract params.        ║
 * ║                                                                                  ║
 * ║  Declarative registration via HTML attribute:                                    ║
 * ║    <div data-pac-id="user-view" data-pac-route="/users/:id">                     ║
 * ║                                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // PATTERN COMPILER
    // =========================================================================

    /**
     * Cache of compiled route patterns. Keyed by the original pattern string,
     * valued by the compiled { regex, keys } descriptor. Prevents redundant
     * regex compilation when the same pattern is matched on multiple navigations.
     * @type {Map<string, { regex: RegExp, keys: string[] }>}
     */
    const _patternCache = new Map();

    /**
     * Compiles a route pattern string into a regex and a list of named parameter
     * keys. The compiled result is cached so repeated calls with the same pattern
     * do not re-run the compilation.
     *
     * Supported syntax:
     *   {name}    — named segment, matches one path segment (no slashes)
     *   {name:*}  — alias for {name}, explicit single-segment form
     *   {name:**} — named wildcard, matches multiple segments including slashes (must be last)
     *
     * Examples:
     *   '/users/{id}'                  matches '/users/42'          → { id: '42' }
     *   '/users/{id}/posts/{postId}'   matches '/users/1/posts/7'   → { id: '1', postId: '7' }
     *   '/files/{rest:**}'             matches '/files/a/b/c'       → { rest: 'a/b/c' }
     *
     * @param {string} pattern - Route pattern, e.g. '/users/{id}/posts/{postId}'
     * @returns {{ regex: RegExp, keys: string[] }}
     * @throws {Error} If a bare * or ** is used without a name
     */
    function _compilePattern(pattern) {
        // Get pattern from cache if present
        if (_patternCache.has(pattern)) {
            return _patternCache.get(pattern);
        }

        const keys = [];

        // Reject bare * — strip all valid tokens first, then check for any remaining *
        const stripped = pattern.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*(?::\*\*?)?\}/g, '');
        if (stripped.indexOf('*') !== -1) {
            throw new Error(`wakaRoute: bare wildcard is not allowed in pattern "${pattern}". Use {name:*} or {name:**} instead.`);
        }

        // Replace tokens with placeholders BEFORE escaping so the regex escaper
        // never sees { } or * characters from our syntax
        const SEGMENT  = '\x01'; // placeholder for ([^/]+)
        const WILDCARD = '\x02'; // placeholder for (.*)

        let processed = pattern
            // Multi-segment wildcard: {name:**}
            .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*):\*\*\}/g, function (_, key) {
                keys.push(key);
                return WILDCARD;
            })
            // Single-segment alias: {name:*}
            .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*):\*\}/g, function (_, key) {
                keys.push(key);
                return SEGMENT;
            })
            // Named segment: {name}
            .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (_, key) {
                keys.push(key);
                return SEGMENT;
            });

        // Now safe to escape — no token characters remain
        processed = processed.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');

        // Substitute placeholders for their regex capture groups
        const regexStr = processed
            .replace(/\x01/g, '([^/]+)')
            .replace(/\x02/g, '(.*)');

        // Anchor the pattern — must match the full path
        const regex = new RegExp('^' + regexStr + '$');
        const compiled = { regex, keys };

        _patternCache.set(pattern, compiled);
        return compiled;
    }

    // =========================================================================
    // QUERY STRING PARSER
    // =========================================================================

    /**
     * Parses a URL search string into a plain object.
     * Flag parameters (no value) are stored as boolean true.
     * @param {string} search - location.search value, e.g. '?foo=bar&baz=1'
     * @returns {Object} Key/value map of query parameters
     */
    function _parseQuery(search) {
        const query = {};

        // Return query as-is when it's only 1 element long
        if (!search || search.length < 2) {
            return query;
        }

        // Strip leading '?'
        const pairs = search.slice(1).split('&');

        // Parse the pairs
        pairs.forEach(function (pair) {
            if (!pair) {
                return;
            }

            const eqIndex = pair.indexOf('=');

            if (eqIndex === -1) {
                // Flag parameter with no value
                query[decodeURIComponent(pair)] = true;
                return;
            }

            const key = decodeURIComponent(pair.slice(0, eqIndex));
            query[key] = decodeURIComponent(pair.slice(eqIndex + 1));
        });

        return query;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * WakaRoute - Client-side router plugin for WakaPAC.
     * Exported as a singleton instance (window.wakaRoute).
     * @constructor
     */
    function WakaRoute() {

        /**
         * Message identifier for route change notifications.
         * Occupies the first slot above MSG_USER (0x1001).
         * Also attached to the wakaPAC instance by createPacPlugin() so it is
         * accessible as wakaPAC.MSG_ROUTE_CHANGE alongside the built-in messages.
         * @type {number}
         */
        this.MSG_ROUTE_CHANGE = 0x2000;

        /**
         * Reference to the wakaPAC instance, populated by createPacPlugin().
         * Null until wakaPAC.use(wakaRoute) has been called.
         * @type {Object|null}
         */
        this._pac = null;

        /**
         * The current route state. Updated on every navigation.
         * @type {{ path: string, query: Object }}
         */
        this._currentRoute = { path: '', query: {} };

        /**
         * Route table populated by onComponentCreated when it discovers a
         * data-pac-route attribute on a newly registered component.
         * Key: pacId, Value: pattern string
         * @type {Map<string, string>}
         */
        this._routeTable = new Map();
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * Reads the current location, updates internal route state, and broadcasts
     * MSG_ROUTE_CHANGE to all registered WakaPAC components.
     * @param {WakaRoute} instance
     * @private
     */
    function _broadcastCurrentRoute(instance) {
        // Snapshot the current location into the route state
        instance._currentRoute = {
            path: location.pathname,
            query: _parseQuery(location.search)
        };

        // Broadcast to all registered components — each receives a shallow copy
        // of the route state so mutations in one msgProc don't affect others
        instance._pac.broadcastMessage(
            instance.MSG_ROUTE_CHANGE,
            0,
            0,
            Object.assign({}, instance._currentRoute)
        );
    }

    // =========================================================================
    // PLUGIN FACTORY
    // =========================================================================

    /**
     * wakaPAC plugin factory. Called by wakaPAC.use(wakaRoute).
     * Attaches MSG_ROUTE_CHANGE to the wakaPAC instance, seeds the current
     * route from the actual URL, wires up the popstate listener, and returns
     * the plugin descriptor with component lifecycle hooks.
     * @param {Object} pac - The wakaPAC instance
     * @returns {{ onComponentCreated: Function, onComponentDestroyed: Function }}
     */
    WakaRoute.prototype.createPacPlugin = function (pac) {
        this._pac = pac;

        // Extend wakaPAC with the router message constant so component authors
        // can reference it as wakaPAC.MSG_ROUTE_CHANGE alongside the built-in messages
        pac.MSG_ROUTE_CHANGE = this.MSG_ROUTE_CHANGE;

        // Seed the current route from the actual URL at registration time
        this._currentRoute = {
            path: location.pathname,
            query: _parseQuery(location.search)
        };

        // Preserve instance reference for use inside callbacks
        const self = this;

        // Browser back/forward navigation
        window.addEventListener('popstate', function () {
            _broadcastCurrentRoute(self);
        });

        return {
            /**
             * Called by wakaPAC whenever a new component is created.
             * Reads data-pac-route from the container and registers the
             * pattern in the route table, pre-compiling it for later use
             * by matchPattern().
             *
             * @param {Object} abstraction - The component's reactive abstraction
             * @param {string} pacId - The component's data-pac-id
             * @param {Object} config - The component's configuration
             */
            onComponentCreated(abstraction, pacId, config) {
                const container = pac.getContainerByPacId(pacId);

                if (!container) {
                    return;
                }

                const pattern = container.getAttribute('data-pac-route');

                if (!pattern) {
                    return;
                }

                // Pre-compile the pattern so it's ready for matchPattern() calls
                _compilePattern(pattern);

                // Store in route table for introspection via getRouteTable()
                self._routeTable.set(pacId, pattern);
            },

            /**
             * Called by wakaPAC when a component is removed from the DOM.
             * Removes the route table entry to avoid stale registrations.
             * @param {string} pacId - The component's data-pac-id
             */
            onComponentDestroyed(pacId) {
                self._routeTable.delete(pacId);
            }
        };
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Navigates to the given path by updating the browser history and
     * broadcasting MSG_ROUTE_CHANGE to all registered components.
     * @param {string} path - Target path, e.g. '/users/42'
     * @param {Object} [options={}]
     * @param {boolean} [options.replace=false] - Use replaceState instead of pushState,
     *   replacing the current history entry rather than adding a new one
     * @throws {Error} If called before wakaPAC.use(wakaRoute)
     */
    WakaRoute.prototype.navigate = function (path, options = {}) {
        if (!this._pac) {
            throw new Error('wakaRoute: call wakaPAC.use(wakaRoute) before navigating');
        }

        if (options.replace) {
            history.replaceState(null, '', path);
        } else {
            history.pushState(null, '', path);
        }

        _broadcastCurrentRoute(this);
    };

    /**
     * Returns a copy of the current route state.
     * Safe to call at any time, including before the first navigation —
     * the path is seeded from location.pathname when createPacPlugin() runs.
     * @returns {{ path: string, query: Object }}
     */
    WakaRoute.prototype.currentRoute = function () {
        return Object.assign({}, this._currentRoute, {
            // Return a copy of query so callers cannot mutate internal state
            query: Object.assign({}, this._currentRoute.query)
        });
    };

    /**
     * Tests a path against a route pattern and returns the extracted
     * parameters, or null if the pattern does not match.
     *
     * Intended for use inside a component's msgProc when handling
     * MSG_ROUTE_CHANGE, to extract named segments from the incoming path.
     *
     * Example:
     *   wakaRoute.matchPattern('/users/{id}', '/users/42')
     *   // → { id: '42' }
     *
     *   wakaRoute.matchPattern('/users/{id}', '/posts/1')
     *   // → null
     *
     *   wakaRoute.matchPattern('/files/{rest:**}', '/files/docs/readme.txt')
     *   // → { rest: 'docs/readme.txt' }
     *
     * @param {string} pattern - Route pattern, e.g. '/users/{id}'
     * @param {string} path - Path to test, e.g. '/users/42'
     * @returns {Object|null} Extracted params, or null if no match
     */
    WakaRoute.prototype.matchPattern = function (pattern, path) {
        const { regex, keys } = _compilePattern(pattern);
        const match = path.match(regex);

        if (!match) {
            return null;
        }

        // Build params object from capture groups
        const params = {};

        keys.forEach(function (key, index) {
            params[key] = decodeURIComponent(match[index + 1]);
        });

        return params;
    };

    /**
     * Returns a snapshot of the current route table.
     * Key: pacId, Value: registered pattern string.
     * Useful for debugging — lists all components that declared a
     * data-pac-route attribute and are currently registered.
     *
     * @returns {Object}
     */
    WakaRoute.prototype.getRouteTable = function () {
        const table = {};

        this._routeTable.forEach(function (pattern, pacId) {
            table[pacId] = pattern;
        });

        return table;
    };

    // =========================================================================
    // EXPORTS
    // =========================================================================

    window.wakaRoute = new WakaRoute();

})();