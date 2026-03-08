/*
 * ╔══════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                  ║
 * ║    ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███████╗████████╗ ██████╗ ██████╗ ███████╗  ║
 * ║    ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝  ║
 * ║    ██║ █╗ ██║███████║█████╔╝ ███████║███████╗   ██║   ██║   ██║██████╔╝█████╗    ║
 * ║    ██║███╗██║██╔══██║██╔═██╗ ██╔══██║╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝    ║
 * ║    ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║███████║   ██║   ╚██████╔╝██║  ██║███████╗  ║
 * ║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝  ║
 * ║                                                                                  ║
 * ║  WakaStore - Shared Reactive Store Plugin for wakaPAC                            ║
 * ║                                                                                  ║
 * ║  Provides a shared reactive state object that can be mounted on any              ║
 * ║  wakaPAC component abstraction under any property name. Changes to the           ║
 * ║  store propagate to all subscriber components automatically.                     ║
 * ║                                                                                  ║
 * ║  Usage:                                                                          ║
 * ║    wakaPAC.use(wakaStore);                                                       ║
 * ║                                                                                  ║
 * ║    const store = wakaStore.createStore({ user: { name: 'Floris' } });            ║
 * ║                                                                                  ║
 * ║    // Mount under any key name                                                   ║
 * ║    wakaPAC('#header', { session: store });                                       ║
 * ║    wakaPAC('#nav',    { currentUser: store });                                   ║
 * ║                                                                                  ║
 * ║    // In templates: {{session.user.name}}  or  {{currentUser.user.name}}         ║
 * ║                                                                                  ║
 * ║    // Direct mutation — all components update automatically:                     ║
 * ║    store.user.name = 'Jan';                                                      ║
 * ║                                                                                  ║
 * ║  Server sync:                                                                    ║
 * ║                                                                                  ║
 * ║    // Poll a JSON:API endpoint — store updates, DOM follows automatically:       ║
 * ║    store.poll('/api/users', { interval: 3000 });                                 ║
 * ║    store.stopPoll();                                                             ║
 * ║                                                                                  ║
 * ║    // Push store state to server, merge JSON:API response back in:               ║
 * ║    store.push('/api/users/1').then(...).catch(...);                              ║
 * ║                                                                                  ║
 * ║    // Custom merge for non-JSON:API or envelope responses:                       ║
 * ║    store.poll('/api/data', {                                                     ║
 * ║        interval: 5000,                                                           ║
 * ║        merge: (response) => { this.items = response.data.items; }                ║
 * ║    });                                                                           ║
 * ║                                                                                  ║
 * ║  Note: poll will overwrite local store mutations on the next cycle.              ║
 * ║  Call push() first to persist local changes before they are overwritten.         ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    "use strict";

    /** @type {string} */
    const VERSION = '1.1.0';

    /**
     * Event fired on document when any store mutation occurs.
     * Carries the storeId and store-relative path of the change.
     * No proxy objects in the payload — only the storeId and path are
     * needed; subscribers re-render by reading through the store proxy.
     * @type {string}
     */
    const STORE_CHANGED_EVENT = 'pac:store-changed';

    /**
     * Non-enumerable flag set on every store proxy (root and nested).
     * wakaPAC's proxyGetHandler checks this flag and returns the value
     * as-is instead of wrapping it in a second reactive proxy.
     * The name is intentionally generic — it means "this object already
     * manages its own reactivity; do not proxy it again".
     * @type {string}
     */
    const EXTERNAL_PROXY_FLAG = '_externalProxy';

    /**
     * Array methods that mutate in place.
     * @type {string[]}
     */
    const MUTATING_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

    /**
     * Default fetch options applied to all poll and push requests.
     * Can be overridden per-call via opts.fetchOptions.
     * @type {Object}
     */
    const DEFAULT_FETCH_OPTIONS = {
        headers: { 'Accept': 'application/vnd.api+json' }
    };

    /**
     * Deserializes a JSON:API response document into a plain object suitable
     * for merging into the store via Object.assign.
     *
     * Convention: the JSON:API resource `type` is used as-is as the store key.
     * The developer controls naming by choosing type names that match store keys.
     *
     * Handles both single resources ({ data: {...} }) and collections
     * ({ data: [...] }). Flattens `id` and `attributes` into a plain object.
     * Relationships and `included` are intentionally not resolved — use a
     * custom `merge` callback for responses that require relationship handling.
     *
     * @param {Object} response - Parsed JSON:API response body
     * @returns {Object} Plain object keyed by resource type
     */
    function deserializeJsonApi(response) {
        if (!response || !response.data) {
            throw new Error('wakaStore: JSON:API response missing `data` member');
        }

        // Normalise to array so we can iterate uniformly regardless of whether
        // the server returned a single resource object or a resource collection.
        const resources = Array.isArray(response.data) ? response.data : [response.data];
        const result = {};

        for (const resource of resources) {
            if (!resource.type) {
                throw new Error('wakaStore: JSON:API resource missing `type` member');
            }

            // `type` becomes the store key as-is. The developer controls naming
            // by matching their JSON:API type names to their store property names.
            const key = resource.type;

            // Flatten id + attributes into a single plain object. This is the
            // entire deserialization — relationships and included are out of scope.
            const record = Object.assign({ id: resource.id }, resource.attributes || {});

            if (Array.isArray(response.data)) {
                // Collection response: accumulate records under the shared type key.
                // Multiple types in one response are handled correctly because each
                // type gets its own array bucket.
                if (!result[key]) {
                    result[key] = [];
                }

                result[key].push(record);
            } else {
                // Single resource response: store the record directly, not wrapped
                // in an array, so store.user.name works instead of store.user[0].name.
                result[key] = record;
            }
        }

        return result;
    }

    /**
     * Performs a fetch request and returns the parsed JSON body.
     * Rejects with a descriptive error on non-ok responses.
     * @param {string} url
     * @param {Object} [fetchOptions]
     * @returns {Promise<Object>}
     */
    function doFetch(url, fetchOptions) {
        // Merge caller options on top of defaults, deep-merging headers so that
        // both the Accept default and any caller-supplied headers survive.
        const opts = Object.assign({}, DEFAULT_FETCH_OPTIONS, fetchOptions, {
            headers: Object.assign({}, DEFAULT_FETCH_OPTIONS.headers, fetchOptions && fetchOptions.headers)
        });

        return fetch(url, opts).then(function(response) {
            if (!response.ok) {
                // Attach status and raw response to the error so onError callbacks
                // and catch handlers can inspect them without re-fetching.
                const error = new Error('wakaStore: HTTP ' + response.status + ' for ' + url);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            // Always parse as JSON. poll and push both expect JSON:API bodies.
            // Non-JSON responses (e.g. 204 No Content) will reject here and
            // reach the onError / catch path, which is the right behaviour.
            return response.json();
        });
    }

    /**
     * Returns true if the property should trigger reactivity.
     * Properties starting with _ or $ are non-reactive.
     * @param {string|symbol} prop
     * @returns {boolean}
     */
    function isReactive(prop) {
        return typeof prop === 'string' && prop[0] !== '_' && prop[0] !== '$';
    }

    /**
     * WakaStore - Shared Reactive Store
     * @constructor
     */
    function WakaStore() {
        /** @type {number} */
        this._nextStoreId = 1;

        /**
         * Maps storeId -> Map<pacId, { key: string, container: Element }>
         * @type {Map<string, Map<string, { key: string, container: Element }>>}
         */
        this._registry = new Map();
    }

    WakaStore.prototype = {
        constructor: WakaStore,

        /**
         * Creates a wakaPAC plugin descriptor.
         *
         * Architecture:
         *
         * The store proxy wraps initialState and intercepts all mutations.
         * It is tagged with _externalProxy = true (non-enumerable) so that
         * wakaPAC's proxyGetHandler recognises it and returns it as-is,
         * never wrapping it in a second reactive proxy.
         *
         * On any mutation the store fires pac:store-changed on document with
         * the storeId. The plugin listener dispatches pac:change on each
         * subscriber container. wakaPAC re-renders by reading the abstraction,
         * which returns the store proxy directly. Template reads go through
         * the store proxy's get trap — pure reads, no writes, no re-notification.
         *
         * Required change in wakaPAC's proxyGetHandler:
         *
         *   if (val && typeof val === 'object' && !val._isReactive && shouldMakeReactive(prop)) {
         *       if (val._externalProxy) { return val; }   // ← add this
         *       // ... existing wrapping logic
         *   }
         *
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin() {
            const registry = this._registry;

            /**
             * Scans the raw abstraction for store references.
             * A store reference is any property whose value is tagged with
             * a non-enumerable _wakaStoreId (set by createStore).
             * @param {Object} rawAbstraction - context.originalAbstraction
             * @returns {Array<{key: string, storeId: string}>}
             */
            function findStoreReferences(rawAbstraction) {
                const entries = [];

                for (const key of Object.keys(rawAbstraction)) {
                    const val = rawAbstraction[key];

                    if (val && typeof val === 'object' && val._wakaStoreId) {
                        entries.push({ key, storeId: val._wakaStoreId });
                    }
                }

                return entries;
            }

            /**
             * Handles pac:store-changed events fired by store proxies.
             *
             * Dispatches pac:change on each subscriber container so wakaPAC
             * re-renders. The path in the event tells wakaPAC which bindings
             * to update. No data is written here — wakaPAC reads the current
             * value directly from the store proxy when it re-renders.
             *
             * newValue is intentionally omitted from the pac:change detail.
             * Passing the store proxy as newValue would cause proxySetHandler
             * to attempt wrapping it. wakaPAC's render methods read from
             * this.abstraction directly and do not use event.detail.newValue
             * for DOM updates.
             *
             * @param {CustomEvent} event
             */
            function onStoreChanged(event) {
                const { storeId, path, oldValue, newValue } = event.detail;
                const subscribers = registry.get(storeId);

                if (!subscribers || subscribers.size === 0) {
                    return;
                }

                const isArrayChange = Array.isArray(newValue);

                subscribers.forEach(function({ key, container }) {
                    const translatedPath = [key].concat(path);

                    if (isArrayChange) {
                        // pac:array-change for foreach rebuilds.
                        // handleArrayChange only reads detail.newValue — no write-back.
                        container.dispatchEvent(new CustomEvent('pac:array-change', {
                            detail: {
                                path: translatedPath,
                                oldValue: oldValue,
                                newValue: newValue
                            }
                        }));
                    } else {
                        container.dispatchEvent(new CustomEvent('pac:change', {
                            detail: {
                                path: translatedPath,
                                oldValue: oldValue,
                                newValue: newValue
                            }
                        }));
                    }
                });
            }

            document.addEventListener(STORE_CHANGED_EVENT, onStoreChanged);

            return {
                /**
                 * Registers the component's store subscriptions.
                 * @param {Object} abstraction - context.abstraction (proxy) — not used
                 * @param {string} pacId
                 */
                onComponentCreated(abstraction, pacId) {
                    const context = window.PACRegistry.get(pacId);

                    if (!context || !context.originalAbstraction) {
                        return;
                    }

                    const storeEntries = findStoreReferences(context.originalAbstraction);

                    if (storeEntries.length === 0 || !context.container) {
                        return;
                    }

                    for (const { key, storeId } of storeEntries) {
                        if (!registry.has(storeId)) {
                            registry.set(storeId, new Map());
                        }

                        registry.get(storeId).set(pacId, { key, container: context.container });
                    }
                },

                /**
                 * Removes the component from all store subscriptions.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    registry.forEach(function(subscribers, storeId) {
                        subscribers.delete(pacId);

                        if (subscribers.size === 0) {
                            registry.delete(storeId);
                        }
                    });
                }
            };
        },

        /**
         * Creates a new reactive store from a plain object.
         *
         * Returns a Proxy tagged with _externalProxy = true so wakaPAC
         * recognises it and skips re-wrapping. All nested objects and arrays
         * are also wrapped in store proxies (lazily, via a WeakMap cache)
         * so that deep mutations like store.user.name = 'Jan' are intercepted.
         *
         * On any mutation, fires pac:store-changed on document with the
         * storeId and the store-relative path of the change.
         *
         * @param {Object} initialState - Plain object representing initial state
         * @returns {Proxy} Store proxy for direct mutation
         */
        createStore(initialState) {
            if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
                throw new Error('wakaStore.createStore(): initialState must be a plain object');
            }

            const storeId = 'store-' + (this._nextStoreId++);

            /**
             * Marks obj and all nested objects with _externalProxy = true as a
             * real non-enumerable own property. This is what wakaPAC's
             * proxyGetHandler reads via target[prop]._externalProxy — it reads
             * the raw object directly, not through the store proxy's get trap,
             * so the flag must exist on the raw object itself.
             * @param {Object|Array} obj
             */
            function markExternalProxy(obj) {
                if (!obj || typeof obj !== 'object' || obj._externalProxy) {
                    return;
                }

                Object.defineProperty(obj, EXTERNAL_PROXY_FLAG, {
                    value: true,
                    enumerable: false,
                    writable: false,
                    configurable: true
                });

                for (const key of Object.keys(obj)) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        markExternalProxy(obj[key]);
                    }
                }
            }

            /**
             * Reentrancy guard. True while a notification is being dispatched.
             * Prevents write-backs from wakaPAC's watcher reconstruction
             * (which writes oldValue back through the store proxy to rebuild
             * the pre-change state for watcher callbacks) from re-triggering
             * notify and causing an infinite loop.
             * @type {boolean}
             */
            let notifying = false;

            /**
             * Fires pac:store-changed with the store-relative path and old/new values.
             * @param {string[]} path
             * @param {*} oldValue
             * @param {*} newValue
             */
            function notify(path, oldValue, newValue) {
                if (notifying) {
                    return;
                }

                notifying = true;

                try {
                    document.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, {
                        detail: { storeId, path, oldValue, newValue }
                    }));
                } finally {
                    notifying = false;
                }
            }

            /**
             * WeakMap cache so the same raw object always returns the same
             * proxy. Stable references prevent spurious change detection when
             * wakaPAC or other code reads nested properties multiple times.
             * @type {WeakMap<Object, Proxy>}
             */
            const proxyCache = new WeakMap();

            /**
             * Wraps obj in a store proxy, returning the cached instance if
             * one already exists.
             * @param {Object|Array} obj
             * @param {string[]} currentPath - Store-relative path to obj
             * @returns {Proxy}
             */
            function createProxy(obj, currentPath) {
                if (proxyCache.has(obj)) {
                    return proxyCache.get(obj);
                }

                // Mark before creating the proxy so wakaPAC reads _externalProxy
                // directly off the raw object and skips re-wrapping it.
                markExternalProxy(obj);

                const proxy = new Proxy(obj, {
                    /**
                     * Intercepts property reads. Returns storeId for internal identification,
                     * wraps mutating array methods to trigger notifications, and lazily
                     * proxies nested objects for deep reactivity.
                     * @param {Object|Array} target
                     * @param {string|symbol} prop
                     * @returns {*}
                     */
                    get(target, prop) {
                        // Expose _wakaStoreId on the root proxy so the plugin
                        // can identify store references in originalAbstraction.
                        if (prop === '_wakaStoreId') {
                            return storeId;
                        }

                        const val = target[prop];

                        // Intercept mutating array methods
                        if (Array.isArray(target) && typeof val === 'function' && MUTATING_METHODS.includes(prop)) {
                            return function() {
                                const oldArray = target.slice();
                                const result = Array.prototype[prop].apply(target, arguments);
                                notify(currentPath, oldArray, target.slice());
                                return result;
                            };
                        }

                        // Lazily wrap nested objects/arrays
                        if (isReactive(prop) && val && typeof val === 'object') {
                            return createProxy(val, currentPath.concat([prop]));
                        }

                        return val;
                    },

                    /**
                     * Intercepts property writes. Skips if value is unchanged.
                     * Marks new object values as external proxies, then notifies.
                     * @param {Object|Array} target
                     * @param {string|symbol} prop
                     * @param {*} newValue
                     * @returns {boolean}
                     */
                    set(target, prop, newValue) {
                        const oldValue = target[prop];

                        if (oldValue === newValue) {
                            return true;
                        }

                        // Mark new object values so wakaPAC won't re-wrap them.
                        if (newValue && typeof newValue === 'object') {
                            markExternalProxy(newValue);
                        }

                        target[prop] = newValue;

                        if (isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, newValue);
                        }

                        return true;
                    },

                    /**
                     * Intercepts property deletions and notifies with undefined as newValue.
                     * @param {Object|Array} target
                     * @param {string|symbol} prop
                     * @returns {boolean}
                     */
                    deleteProperty(target, prop) {
                        if (!(prop in target)) {
                            return true;
                        }

                        const oldValue = target[prop];
                        delete target[prop];

                        if (isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, undefined);
                        }

                        return true;
                    }
                });

                proxyCache.set(obj, proxy);
                return proxy;
            }

            // Tag initialState so onComponentCreated can identify it when
            // scanning originalAbstraction. Non-enumerable so it is invisible
            // to template bindings and for..in loops.
            Object.defineProperty(initialState, '_wakaStoreId', {
                value: storeId,
                enumerable: false,
                writable: false,
                configurable: false
            });

            /**
             * Internal poll state. Kept on initialState as non-enumerable
             * so it survives proxy round-trips but is invisible to templates.
             */
            let _pollTimer = null;
            let _pollActive = false;

            const proxy = createProxy(initialState, []);

            /**
             * Starts polling an endpoint and merging the response into the store.
             *
             * Convention: the server returns a JSON:API document. The deserializer
             * flattens each resource into a plain object keyed by its `type`, then
             * Object.assign writes each key onto the store. DOM updates happen
             * automatically through the existing proxy/event machinery.
             *
             * If your server does not speak JSON:API, supply a `merge` callback.
             * The callback receives the store proxy and the raw parsed response body
             * and is responsible for writing whatever it needs onto the store.
             *
             * Poll timing uses recursive setTimeout so the next poll only starts
             * after the current request settles. This prevents request pile-up when
             * the server is slow and avoids setInterval drift.
             *
             * The poll pauses automatically when the tab is hidden (Page Visibility
             * API) and resumes when it becomes visible again. Call stopPoll() to
             * stop permanently.
             *
             * Note: if you mutate the store locally while polling is active, the
             * next poll cycle will overwrite those changes with server data. This is
             * expected behaviour. To persist local changes, call push() first so
             * the server reflects them before the next poll.
             *
             * @param {string} url - Endpoint to poll
             * @param {Object} [opts]
             * @param {number} [opts.interval=5000] - Milliseconds between polls
             * @param {Function} [opts.merge] - Custom merge: function(response), called with store as `this`
             * @param {Function} [opts.onError] - Error callback: (error) => void
             * @param {Object} [opts.fetchOptions] - Options forwarded to fetch()
             */
            Object.defineProperty(proxy, 'poll', {
                enumerable: false,
                configurable: true,
                value: function(url, opts) {
                    opts = opts || {};

                    const interval     = opts.interval     !== undefined ? opts.interval : 5000;
                    const merge        = typeof opts.merge    === 'function' ? opts.merge    : null;
                    const onError      = typeof opts.onError  === 'function' ? opts.onError  : null;
                    const fetchOptions = opts.fetchOptions || {};

                    // Calling poll() while already polling replaces the active poll.
                    // stopPoll() clears the timer and resets the flag before we start fresh.
                    if (_pollActive) {
                        proxy.stopPoll();
                    }

                    _pollActive = true;

                    /**
                     * Applies a server response to the store.
                     * Uses the custom merge callback when provided, otherwise falls back
                     * to the JSON:API deserializer + Object.assign convention.
                     * @param {Object} response - Parsed response body
                     */
                    function applyResponse(response) {
                        if (merge) {
                            merge.call(proxy, response);
                            return;
                        }

                        // deserializeJsonApi returns a plain object keyed by resource
                        // type. Object.assign writes each key onto the store proxy,
                        // which fires individual pac:store-changed events per key —
                        // exactly the same path as a direct store mutation.
                        const data = deserializeJsonApi(response);
                        Object.assign(proxy, data);
                    }

                    /**
                     * Schedules the next poll cycle via setTimeout.
                     * Skips the fetch if the tab is hidden and reschedules immediately.
                     * Always reschedules in .finally() so errors don't break the loop.
                     */
                    function schedulePoll() {
                        // Guard: stopPoll() may have been called between the end of the
                        // last request and schedulePoll() firing inside .finally().
                        if (!_pollActive) {
                            return;
                        }

                        // Recursive setTimeout instead of setInterval: the next poll
                        // only starts after the previous request has fully settled.
                        // This prevents concurrent requests when the server is slow
                        // and keeps the interval measured from response, not dispatch.
                        _pollTimer = setTimeout(function() {
                            // Do nothing if there is no active poll
                            if (!_pollActive) {
                                return;
                            }

                            // Respect Page Visibility API — skip fetch when hidden,
                            // reschedule immediately so we catch the next interval.
                            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                                schedulePoll();
                                return;
                            }

                            doFetch(url, fetchOptions)
                                .then(function(response) {
                                    // Check _pollActive again — stopPoll() could have been
                                    // called while the request was in flight.
                                    if (_pollActive) {
                                        applyResponse(response);
                                    }
                                })
                                .catch(function(error) {
                                    if (onError) {
                                        // Swallow errors thrown inside the callback — they
                                        // are the caller's problem, not the poll loop's.
                                        try { onError(error); } catch(e) { /* swallow */ }
                                    } else {
                                        console.error('wakaStore poll error:', error);
                                    }
                                })
                                .finally(function() {
                                    // Always reschedule, whether the request succeeded or
                                    // failed. onError is responsible for deciding whether
                                    // to call stopPoll() if errors should be terminal.
                                    schedulePoll();
                                });
                        }, interval);
                    }

                    schedulePoll();
                }
            });

            /**
             * Stops an active poll started by poll().
             * Safe to call when no poll is active.
             */
            Object.defineProperty(proxy, 'stopPoll', {
                enumerable: false,
                configurable: true,
                value: function() {
                    // Setting _pollActive = false is the primary stop signal.
                    // Any in-flight request will see this flag in its .then() and
                    // skip applyResponse. schedulePoll() also checks it before
                    // setting a new timer.
                    _pollActive = false;

                    // Clear any pending timer. Without this the scheduled callback
                    // would still fire once more after stopPoll(), see _pollActive
                    // is false, and exit cleanly — but clearing it is tidier and
                    // avoids an unnecessary wakeup.
                    if (_pollTimer !== null) {
                        clearTimeout(_pollTimer);
                        _pollTimer = null;
                    }
                }
            });

            /**
             * Pushes store state to a server endpoint.
             *
             * By default serializes the entire store as JSON and sends it as a
             * PATCH request. Supply a `body` option to send a subset, or set
             * `method` to override the HTTP verb.
             *
             * If the server returns a JSON:API document, the response is
             * deserialized and merged back into the store automatically — useful
             * when the server enriches the saved object with computed fields,
             * timestamps, or generated IDs. Supply a custom `merge` callback if
             * the response shape requires different handling.
             *
             * Returns the raw parsed response body for callers that need it.
             *
             * @param {string} url - Endpoint to push to
             * @param {Object} [opts]
             * @param {string} [opts.method='PATCH'] - HTTP method
             * @param {Object} [opts.body] - Body to send. Defaults to the full store state.
             * @param {boolean} [opts.applyResponse=true] - Merge server response back into store
             * @param {Function} [opts.merge] - Custom merge: function(response), called with store as `this`
             * @param {Function} [opts.onError] - Error callback: (error) => void
             * @param {Object} [opts.fetchOptions] - Extra options forwarded to fetch()
             * @returns {Promise<Object>} Resolves with the parsed response body
             */
            Object.defineProperty(proxy, 'push', {
                enumerable: false,
                configurable: true,
                value: function(url, opts) {
                    opts = opts || {};

                    const method        = opts.method        || 'PATCH';
                    const applyResponse = opts.applyResponse !== false;
                    const merge         = typeof opts.merge   === 'function' ? opts.merge   : null;
                    const onError       = typeof opts.onError === 'function' ? opts.onError : null;

                    // Default body: snapshot the raw initialState via JSON round-trip.
                    // This strips the proxy wrapper, non-enumerable internals (_wakaStoreId,
                    // _externalProxy), and any _ / $ prefixed properties, leaving only
                    // the plain data the template layer sees.
                    const body = opts.body !== undefined
                        ? opts.body
                        : JSON.parse(JSON.stringify(initialState));

                    // Build fetch options, ensuring Content-Type is set for JSON:API
                    // and that any caller-supplied headers are deep-merged on top.
                    const fetchOptions = Object.assign({}, opts.fetchOptions, {
                        method: method,
                        headers: Object.assign(
                            { 'Content-Type': 'application/vnd.api+json' },
                            opts.fetchOptions && opts.fetchOptions.headers
                        ),
                        body: JSON.stringify(body)
                    });

                    return doFetch(url, fetchOptions)
                        .then(function(response) {
                            if (!applyResponse || !response) {
                                return response;
                            }

                            if (merge) {
                                merge.call(proxy, response);
                                return response;
                            }

                            try {
                                // Fold the server response back into the store so that
                                // server-generated fields (timestamps, IDs, computed
                                // values) are reflected immediately without waiting for
                                // the next poll cycle.
                                const data = deserializeJsonApi(response);
                                Object.assign(proxy, data);
                            } catch(e) {
                                // Response may be empty or non-JSON:API (e.g. 204 No Content
                                // parsed as null). Silently skip — caller can use a merge
                                // callback if they need to handle the response shape.
                            }

                            // Return the raw response so callers can inspect it if needed,
                            // e.g. to read a Location header or act on a specific status code.
                            return response;
                        })
                        .catch(function(error) {
                            if (onError) {
                                try { onError(error); } catch(e) { /* swallow */ }
                            }

                            // Re-throw so the caller's own .catch() / await try-catch still fires.
                            throw error;
                        });
                }
            });

            return proxy;
        }
    };

    /** @type {string} */
    WakaStore.VERSION = VERSION;

    /** @type {WakaStore} */
    const wakaStore = new WakaStore();

    /* globals module, define */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { WakaStore, wakaStore };
    } else if (typeof define === 'function' && define.amd) {
        define(function () {
            return { WakaStore, wakaStore };
        });
    } else if (typeof window !== 'undefined') {
        window.WakaStore = WakaStore;
        window.wakaStore = wakaStore;
    }
})();