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
 * ║  Components with data-pac-route receive MSG_ROUTE_BEFORE before each              ║
 * ║  navigation. Returning false from msgProc cancels the navigation.                ║
 * ║  Components with data-pac-route receive MSG_ROUTE_CHANGE with:                   ║
 * ║    { path, query, params }                                                       ║
 * ║                                                                                  ║
 * ║  query is a plain object of parsed query string values. Flag params              ║
 * ║  (no value) are boolean true. PHP-style array params collect into arrays:        ║
 * ║    ?tag[]=a&tag[]=b  →  { tag: ['a', 'b'] }                                      ║
 * ║                                                                                  ║
 * ║  params contains the extracted URL params for that component's own pattern,      ║
 * ║  or null if the pattern did not match the current path.                          ║
 * ║  Components without data-pac-route receive no message.                           ║
 * ║  wakaRoute.matchPattern() remains available for ad-hoc matching.                 ║
 * ║  wakaRoute.destroy() removes the popstate listener and clears state.             ║
 * ║                                                                                  ║
 * ║  Declarative registration via HTML attribute:                                    ║
 * ║    <div data-pac-id="user-view" data-pac-route="/users/{id}">                    ║
 * ║                                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";
    const pluginRuntime = {
        validatePattern(pattern) {
            const TOKEN = /\{([^}]*)\}/g;
            const VALID_TOKEN = /^[a-zA-Z_][a-zA-Z0-9_]*(?::\*\*?)?$/;
            let tokenMatch;

            while ((tokenMatch = TOKEN.exec(pattern)) !== null) {
                if (!VALID_TOKEN.test(tokenMatch[1])) {
                    throw new Error(
                        'wakaRoute: invalid token "' + tokenMatch[0] + '" in pattern "' + pattern + '"'
                    );
                }
            }

            if ((pattern.match(/\{/g) || []).length !== (pattern.match(/\}/g) || []).length) {
                throw new Error('wakaRoute: unmatched "{" in pattern "' + pattern + '"');
            }
        },

        /**
         * Compiles a route pattern string into a regex and a list of named parameter
         * keys. The compiled result is cached so repeated calls with the same pattern
         * do not re-run the compilation.
         *
         * Supported syntax:
         *   {name}    — named segment, matches one path segment (no slashes)
         *   {name:*}  — alias for {name}, explicit single-segment form
         *   {name:**} — named wildcard, matches multiple segments including slashes
         *   *         — bare single-segment wildcard, matches but does not capture
         *   **        — bare multi-segment wildcard, matches but does not capture (may appear multiple times)
         *
         * Examples:
         *   '/users/{id}'                  matches '/users/42'          → { id: '42' }
         *   '/users/{id}/posts/{postId}'   matches '/users/1/posts/7'   → { id: '1', postId: '7' }
         *   '/files/{rest:**}'             matches '/files/a/b/c'       → { rest: 'a/b/c' }
         *
         * @param {string} pattern - Route pattern, e.g. '/users/{id}/posts/{postId}'
         * @returns {{ regex: RegExp, keys: string[] }}
         * @throws {Error} If the pattern contains malformed tokens or unmatched braces
         */
        _compilePattern(pattern) {
            const compilePatternHandlers = {
                captureSegmentParameter(_, key) {
                    keys.push(key);
                    return SEGMENT;
                },

                capturePathParameter(_, key) {
                    keys.push(key);
                    return WILDCARD;
                }
            };

            // Get pattern from cache if present
            if (_patternCache.has(pattern)) {
                return _patternCache.get(pattern);
            }

            // Validate: every '{' must form a well-structured token.
            // Valid forms: {name}  {name:*}  {name:**}
            // Anything else — unclosed brace, empty name, bad identifier,
            // invalid quantifier — is caught here before compilation proceeds.
            pluginRuntime.validatePattern(pattern);

            const keys = [];

            // Replace tokens with placeholders BEFORE escaping so the regex escaper
            // never sees { } or * characters from our syntax.
            // Placeholders use characters illegal in URL paths so they can't collide.
            const SEGMENT           = '\u0001'; // placeholder for ([^/]+)
            const WILDCARD          = '\u0002'; // placeholder for (.*)
            const SEGMENT_SKIP      = '\u0003'; // placeholder for (?:[^/]+)
            const WILDCARD_SKIP     = '\u0004'; // placeholder for (?:.*)

            let processed = pattern
            // Named multi-segment wildcard: {name:**}
                .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*):\*\*\}/g, compilePatternHandlers.capturePathParameter)
            // Named single-segment alias: {name:*}
                .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*):\*\}/g, compilePatternHandlers.captureSegmentParameter)
            // Named segment: {name}
                .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, compilePatternHandlers.captureSegmentParameter)
            // Bare multi-segment wildcard: ** (non-capturing, may appear multiple times)
                .replace(/\*\*/g, WILDCARD_SKIP)
            // Bare single-segment wildcard: * (non-capturing)
                .replace(/\*/g, SEGMENT_SKIP);

            // Now safe to escape — no token characters remain
            processed = processed.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

            // Substitute placeholders for their regex groups
            const regexStr = processed
                .split(SEGMENT).join('([^/]+)')
                .split(WILDCARD).join('(.*)')
                .split(SEGMENT_SKIP).join('(?:[^/]+)')
                .split(WILDCARD_SKIP).join('(?:.*)');

            // Anchor the pattern — must match the full path
            const regex = new RegExp('^' + regexStr + '$');
            const compiled = { regex, keys };

            _patternCache.set(pattern, compiled);
            return compiled;
        },

        /**
         * Parses a URL search string into a plain object.
         * Flag parameters (no value) are boolean true. PHP-style bracket keys
         * (?tag[]=a&tag[]=b) collect into an Array: { tag: ['a', 'b'] }.
         * @param {string} search - location.search value, e.g. '?foo=bar&baz=1'
         * @returns {Object}
         */
        _parseQuery(search) {
            const parseQueryHandlers = {
                visitItem(pair) {
                    if (!pair) {
                        return;
                    }

                    const eqIndex = pair.indexOf('=');

                    if (eqIndex === -1) {
                        // Flag parameter with no value
                        query[decodeURIComponent(pair)] = true;
                        return;
                    }

                    const rawKey = decodeURIComponent(pair.slice(0, eqIndex));
                    const value  = decodeURIComponent(pair.slice(eqIndex + 1));

                    // PHP-style array syntax: key[] accumulates into an Array
                    if (rawKey.slice(-2) === '[]') {
                        const key = rawKey.slice(0, -2);

                        if (Object.prototype.hasOwnProperty.call(query, key) && Array.isArray(query[key])) {
                            query[key].push(value);
                        } else {
                            query[key] = [value];
                        }
                    } else {
                        query[rawKey] = value;
                    }
                }
            };

            const query = {};

            // Return query as-is when it's only 1 element long
            if (!search || search.length < 2) {
                return query;
            }

            // Strip leading '?'
            const pairs = search.slice(1).split('&');

            // Parse the pairs
            pairs.forEach(parseQueryHandlers.visitItem);

            return query;
        },

        /**
         * Strips trailing slashes from a path, preserving bare '/'.
         * Ensures '/users/42' and '/users/42/' are treated identically by
         * both the router state and matchPattern().
         * @param {string} path
         * @returns {string}
         * @private
         */
        _normalizePath(path) {
            return path.replace(/\/+$/, '') || '/';
        },

        /**
         * Reads the current location, updates internal route state, and sends
         * MSG_ROUTE_CHANGE to every component that declared a data-pac-route attribute.
         * Components without data-pac-route receive no message.
         *
         * Each component receives a detail object of the shape:
         *   { path, query, params }
         *
         * where `params` is the result of matching the component's own pattern
         * against the current path — equivalent to calling matchPattern() manually,
         * but pre-computed by the router. null if the pattern did not match.
         *
         * @param {WakaRoute} instance
         * @private
         */
        _broadcastCurrentRoute(instance) {
            const broadcastCurrentRouteHandlers = {
                visitItem(pattern, pacId) {
                    const params = instance.matchPattern(pattern, path);

                    instance._pac.sendMessage(
                        pacId,
                        instance.MSG_ROUTE_CHANGE,
                        params ? 1 : 0,
                        0,
                        {
                            path  : path,
                            query : pluginRuntime._parseQuery(location.search),
                            params: params
                        }
                    );
                }
            };

            // Send a targeted message to each component that declared a pattern,
            // with matches pre-computed from that component's own data-pac-route
            const path = pluginRuntime._normalizePath(location.pathname);

            instance._routeTable.forEach(broadcastCurrentRouteHandlers.visitItem);
        },

        /**
         * Broadcasts MSG_ROUTE_BEFORE to all registered components for the given path.
         * Returns true if any component's msgProc returned false (i.e. navigation blocked).
         * Components receive the same { path, query, params } detail as MSG_ROUTE_CHANGE.
         * @param {WakaRoute} instance
         * @param {string} path - The normalized target path
         * @returns {boolean} true if navigation was blocked
         * @private
         */
        _broadcastBeforeRoute(instance, path) {
            const broadcastBeforeRouteHandlers = {
                visitItem(pattern, pacId) {
                    const params = instance.matchPattern(pattern, path);

                    const result = instance._pac.sendMessage(
                        pacId,
                        instance.MSG_ROUTE_BEFORE,
                        params ? 1 : 0,
                        0,
                        {
                            path  : path,
                            query : query,
                            params: params
                        }
                    );

                    if (result === false) {
                        blocked = true;
                    }
                }
            };

            const query = pluginRuntime._parseQuery(location.search);
            let blocked = false;

            instance._routeTable.forEach(broadcastBeforeRouteHandlers.visitItem);

            return blocked;
        }
    };

    // Support standalone loading while using the host's plugin base when present.
    const MSG_PLUGIN = globalThis.wakaPAC?.MSG_PLUGIN ?? 0x2000;

    // =========================================================================
    // MESSAGES
    // =========================================================================

    /**
     * Message identifier for route change notifications.
     * Occupies the first slot in the MSG_PLUGIN range.
     * @type {number}
     */
    const MSG_ROUTE_CHANGE = MSG_PLUGIN + 0x000;

    /**
     * Sent before a navigation commits. A component's msgProc may return false
     * to cancel the navigation. Detail shape: { path, query, params }.
     * @type {number}
     */
    const MSG_ROUTE_BEFORE = MSG_PLUGIN + 0x001;

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

    // =========================================================================
    // QUERY STRING PARSER
    // =========================================================================

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * WakaRoute - Client-side router plugin for WakaPAC.
     * Exported as window.WakaRoute (class) and window.wakaRoute (singleton instance).
     * @constructor
     */
    function WakaRoute() {
        // Also attached to the wakaPAC instance by createPacPlugin() so they are
        // accessible as wakaPAC.MSG_ROUTE_BEFORE / wakaPAC.MSG_ROUTE_CHANGE
        // alongside the built-in messages.
        this.MSG_ROUTE_BEFORE = MSG_ROUTE_BEFORE;
        this.MSG_ROUTE_CHANGE = MSG_ROUTE_CHANGE;

        /**
         * Reference to the wakaPAC instance, populated by createPacPlugin().
         * Null until wakaPAC.use(wakaRoute) has been called.
         * @type {Object|null}
         */
        this._pac = null;

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
     * wakaPAC plugin factory. Called by wakaPAC.use(wakaRoute).
     * Attaches MSG_ROUTE_CHANGE to the wakaPAC instance, seeds the current
     * route from the actual URL, wires up the popstate listener, and returns
     * the plugin descriptor with component lifecycle hooks.
     * @param {Object} pac - The wakaPAC instance
     * @returns {{ onComponentCreated: Function, onComponentDestroyed: Function }}
     */
    WakaRoute.prototype.createPacPlugin = function createPacPlugin (pac) {
        this._pac = pac;

        // Extend wakaPAC with the router message constants so component authors
        // can reference them as wakaPAC.MSG_ROUTE_BEFORE / wakaPAC.MSG_ROUTE_CHANGE
        pac.MSG_ROUTE_BEFORE = this.MSG_ROUTE_BEFORE;
        pac.MSG_ROUTE_CHANGE = this.MSG_ROUTE_CHANGE;

        // Preserve instance reference for use inside callbacks
        const self = this;

        // Stored by reference so destroy() can remove it
        this._popstateHandler = this._handlePopstate.bind(this);

        // Browser back/forward navigation
        window.addEventListener('popstate', this._popstateHandler);

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
            onComponentCreated(abstraction, pacId, _config) {
                const componentLifecycleHandlers = {
                    onTimeout() {
                        pac.sendMessage(
                            pacId,
                            self.MSG_ROUTE_CHANGE,
                            params ? 1 : 0,
                            0,
                            {
                                path  : path,
                                query : query,
                                params: params
                            }
                        );
                    }
                };

                // Fetch container
                const container = pac.getContainerByPacId(pacId);

                if (!container) {
                    return;
                }

                // Fetch pattern
                const pattern = container.getAttribute('data-pac-route');

                if (!pattern) {
                    return;
                }

                // Pre-compile the pattern so it's ready for matchPattern() calls
                pluginRuntime._compilePattern(pattern);

                // Store in route table for introspection via getRouteTable()
                self._routeTable.set(pacId, pattern);

                // Fire MSG_ROUTE_CHANGE immediately so the component can decide
                // its own initial visibility — identical behavior to any navigation.
                // Capture before the timeout so the message reflects registration-time state.
                const path = pluginRuntime._normalizePath(location.pathname);
                const query  = pluginRuntime._parseQuery(location.search);
                const params = self.matchPattern(pattern, path);

                setTimeout(componentLifecycleHandlers.onTimeout, 0);
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

    /**
     * Handles the browser's popstate event (back/forward navigation).
     * Broadcasts MSG_ROUTE_BEFORE first; if blocked, undoes the navigation.
     * @private
     */
    WakaRoute.prototype._handlePopstate = function _handlePopstate () {
        const path = pluginRuntime._normalizePath(location.pathname);

        if (pluginRuntime._broadcastBeforeRoute(this, path)) {
            // Undo the browser navigation. We can't know the direction reliably,
            // so we go(1) — this works for back (the common case) and is a no-op
            // for forward if the guard triggers there too.
            history.go(1);
            return;
        }

        pluginRuntime._broadcastCurrentRoute(this);
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Navigates to the given path by updating the browser history and
     * broadcasting MSG_ROUTE_CHANGE to all registered components.
     * Before committing, broadcasts MSG_ROUTE_BEFORE — if any component's
     * msgProc returns false the navigation is cancelled and history is unchanged.
     * @param {string} path - Target path, e.g. '/users/42'. Trailing slashes are normalized.
     * @param {Object} [options={}]
     * @param {boolean} [options.replace=false] - Use replaceState instead of pushState
     * @returns {boolean} false if navigation was blocked, true otherwise
     * @throws {Error} If called before wakaPAC.use(wakaRoute)
     */
    WakaRoute.prototype.navigate = function navigate (path, options = {}) {
        if (!this._pac) {
            throw new Error('wakaRoute: call wakaPAC.use(wakaRoute) before navigating');
        }

        if (pluginRuntime._broadcastBeforeRoute(this, pluginRuntime._normalizePath(path))) {
            return false;
        }

        if (options.replace) {
            history.replaceState(null, '', path);
        } else {
            history.pushState(null, '', path);
        }

        pluginRuntime._broadcastCurrentRoute(this);
        return true;
    };

    /**
     * Returns a copy of the current route state.
     * Safe to call at any time, including before the first navigation —
     * the path is seeded from location.pathname when createPacPlugin() runs.
     * @returns {{ path: string, query: Object }}
     */
    WakaRoute.prototype.currentRoute = function currentRoute () {
        return {
            path : pluginRuntime._normalizePath(location.pathname),
            query: pluginRuntime._parseQuery(location.search)
        };
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
     * @param {string} path - Path to test, e.g. '/users/42'. Trailing slashes are normalized.
     * @returns {Object|null} Extracted params, or null if no match
     */
    WakaRoute.prototype.matchPattern = function matchPattern (pattern, path) {
        const matchPatternHandlers = {
            visitItem(key, index) {
                const raw = match[index + 1];
                params[key] = raw.indexOf('%') !== -1 ? decodeURIComponent(raw) : raw;
            }
        };

        const { regex, keys } = pluginRuntime._compilePattern(pattern);
        const match = pluginRuntime._normalizePath(path).match(regex);

        if (!match) {
            return null;
        }

        // Only decode if percent-encoded — location.pathname is already decoded by the browser.
        const params = {};

        keys.forEach(matchPatternHandlers.visitItem);

        return params;
    };

    /**
     * Returns a snapshot of the current route table.
     * Key: pacId, Value: registered pattern string.
     * Useful for debugging — lists all components that declared a
     * data-pac-route attribute and are currently registered.
     * @returns {Object}
     */
    WakaRoute.prototype.getRouteTable = function getRouteTable () {
        const getRouteTableHandlers = {
            visitItem(pattern, pacId) {
                table[pacId] = pattern;
            }
        };

        const table = {};

        this._routeTable.forEach(getRouteTableHandlers.visitItem);

        return table;
    };

    /**
     * Removes the popstate listener and clears all router state.
     * Useful for testing teardown.
     */
    WakaRoute.prototype.destroy = function destroy () {
        if (this._popstateHandler) {
            window.removeEventListener('popstate', this._popstateHandler);
            this._popstateHandler = null;
        }

        this._routeTable.clear();
        this._pac = null;
    };

    // Message IDs are available before wakaPAC.use(), relative to MSG_PLUGIN.
    WakaRoute.MSG_ROUTE_CHANGE = MSG_ROUTE_CHANGE;
    WakaRoute.MSG_ROUTE_BEFORE = MSG_ROUTE_BEFORE;

    // =========================================================================
    // EXPORTS
    // =========================================================================

    window.WakaRoute = WakaRoute;
    window.wakaRoute = new WakaRoute();
})();
