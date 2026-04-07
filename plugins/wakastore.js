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
 * ║  Shared reactive state for wakaPAC components. Mount a store under any key;      ║
 * ║  mutations propagate to all subscribers automatically.                           ║
 * ║                                                                                  ║
 * ║    wakaPAC.use(wakaStore);                                                       ║
 * ║    const store = wakaStore.createStore({ user: { name: 'Floris' } });            ║
 * ║    wakaPAC('#header', { session: store });   // {{session.user.name}}            ║
 * ║    store.user.name = 'Jan';                  // all components update            ║
 * ║                                                                                  ║
 * ║  Poll / push:                                                                    ║
 * ║    store.poll('/api/users', { interval: 3000 });   // GET, merge response        ║
 * ║    store.push('/api/users/1');                     // PATCH, merge response      ║
 * ║    store.stopPoll();                                                             ║
 * ║    // Custom merge: store.poll(url, { merge: function(r) { this.x = r.x; } });   ║
 * ║    // Note: poll overwrites local mutations each cycle. Call push() first.       ║
 * ║                                                                                  ║
 * ║  WebSocket:                                                                      ║
 * ║    store.connect('wss://example.com/updates');   // auto-reconnects by default   ║
 * ║    store.connect(url, {                                                          ║
 * ║        merge:             function(data) { this.items = data.items; },           ║
 * ║        onClose:           (e) => { if (e.code === 4001) return false; },         ║
 * ║        reconnectDelay:    1000,    // base backoff in ms (default)               ║
 * ║        reconnectDelayMax: 30000    // backoff cap in ms (default)                ║
 * ║    });                                                                           ║
 * ║    store.disconnect();                                                           ║
 * ║    // Receive-only. Use push() to send data back; combine both for               ║
 * ║    // full duplex: connect() for inbound push, push() for outbound writes.       ║
 * ║                                                                                  ║
 * ║  Persistence:                                                                    ║
 * ║    const store = wakaStore.createStore({ theme: 'dark' }, {                      ║
 * ║        persist: 'app-settings', autoLoad: true, autoSave: true                   ║
 * ║    });                                                                           ║
 * ║    store.save();  store.load();  store.clearPersist();                           ║
 * ║                                                                                  ║
 * ║  Cleanup:                                                                        ║
 * ║    store.destroy();   // stopPoll + disconnect + stopAutoSave                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    "use strict";

    /** @type {string} */
    const VERSION = '1.3.0';

    /**
     * Fired on document when any store mutation occurs.
     * Carries storeId and store-relative path; no proxy objects in payload.
     * Subscribers re-render by reading through the store proxy directly.
     * @type {string}
     */
    const STORE_CHANGED_EVENT = 'pac:store-changed';

    /**
     * Non-enumerable flag set on every store proxy (root and nested).
     * wakaPAC's proxyGetHandler skips re-wrapping objects that carry this flag.
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
        headers: { 'Accept': 'application/json' }
    };

    /**
     * Performs a fetch request and returns the parsed JSON body.
     * Rejects with a descriptive error on non-ok responses.
     * @param {string} url
     * @param {Object} [fetchOptions]
     * @returns {Promise<Object>}
     */
    function doFetch(url, fetchOptions) {
        // Deep-merge headers so the Accept default and caller-supplied headers both survive.
        const opts = Object.assign({}, DEFAULT_FETCH_OPTIONS, fetchOptions, {
            headers: Object.assign({}, DEFAULT_FETCH_OPTIONS.headers, fetchOptions && fetchOptions.headers)
        });

        return fetch(url, opts).then(function(response) {
            if (!response.ok) {
                // Attach status + response so catch handlers can inspect without re-fetching.
                const error = new Error('wakaStore: HTTP ' + response.status + ' for ' + url);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            // Non-JSON responses (e.g. 204 No Content) will reject and reach onError / catch.
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
     * Returns true if val is a plain object (not an array, Date, Map, etc.).
     * @param {*} val
     * @returns {boolean}
     */
    function isPlainObject(val) {
        return !!val && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype;
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

    /**
     * WakaStore prototype methods.
     */
    WakaStore.prototype = {
        constructor: WakaStore,

        /**
         * Creates a wakaPAC plugin descriptor.
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
             * Handles pac:store-changed events from store proxies.
             * Dispatches pac:change (or pac:array-change) on each subscriber
             * container so wakaPAC re-renders the affected bindings.
             * newValue is omitted from pac:change — wakaPAC reads from
             * this.abstraction directly and ignores event.detail.newValue.
             * @param {CustomEvent} event
             */
            function onStoreChanged(event) {
                const { storeId, path, oldValue, newValue } = event.detail;

                // Do nothing if the value did not change
                if (oldValue === newValue) {
                    return;
                }

                // Do nothing when no subscribers present
                const subscribers = registry.get(storeId);

                if (!subscribers || subscribers.size === 0) {
                    return;
                }

                // Notify all subscribers
                subscribers.forEach(function({ key, container }) {
                    container.dispatchEvent(new CustomEvent('pac:change', {
                        detail: {
                            path: [key].concat(path),
                            oldValue: oldValue,
                            newValue: newValue
                        }
                    }));
                });
            }

            // Listen to pac:store-changed event
            document.addEventListener(STORE_CHANGED_EVENT, onStoreChanged);

            return {
                /**
                 * Registers the component's store subscriptions.
                 * @param {Object} abstraction - context.abstraction (proxy) — not used
                 * @param {string} pacId
                 */
                onComponentCreated(abstraction, pacId) {
                    // originalAbstraction holds the raw pre-proxy object. Store references
                    // are identified by their non-enumerable _wakaStoreId tag.
                    const context = window.PACRegistry.get(pacId);

                    if (!context || !context.originalAbstraction) {
                        return;
                    }

                    const storeEntries = findStoreReferences(context.originalAbstraction);

                    // Nothing to subscribe to, or container not yet in the DOM.
                    if (storeEntries.length === 0 || !context.container) {
                        return;
                    }

                    for (const { key, storeId } of storeEntries) {
                        // Lazily create the subscriber map for this store on first use.
                        if (!registry.has(storeId)) {
                            registry.set(storeId, new Map());
                        }

                        // key is the mount name (e.g. 'session' in { session: store }).
                        // onStoreChanged prepends it to the path so wakaPAC resolves
                        // the correct binding (e.g. ['session', 'user', 'name']).
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
         * @param {Object}  [opts]                 - Optional configuration
         * @param {string}  [opts.persist]          - localStorage key. When set, the store rehydrates
         *                                            from localStorage on creation and save(), load(),
         *                                            and clearPersist() become available on the proxy.
         * @param {boolean} [opts.autoSave=false]   - When true (and opts.persist is set), automatically
         *                                            saves to localStorage on every mutation (debounced).
         *                                            When omitted or false, call store.save() explicitly.
         * @param {boolean} [opts.autoLoad=false]   - When true (and opts.persist is set), automatically
         *                                            rehydrates from localStorage on creation.
         *                                            Set to false to start from initialState and call
         *                                            store.load() yourself when ready.
         * @returns {Proxy} Store proxy for direct mutation
         */
        createStore(initialState, opts) {
            if (!isPlainObject(initialState)) {
                throw new Error('wakaStore.createStore(): initialState must be a plain object');
            }

            opts = opts || {};

            const storeId = 'store-' + (this._nextStoreId++);
            const persistKey = typeof opts.persist === 'string' ? opts.persist : null;
            const autoSave = opts.autoSave === true && persistKey !== null;
            const autoLoad = opts.autoLoad === true && persistKey !== null;

            /**
             * Recursively marks obj and all nested objects with _externalProxy = true
             * as a non-enumerable own property. wakaPAC reads this flag directly off
             * the raw object (not through the proxy's get trap), so it must be on
             * the raw target itself.
             * @param {Object|Array} obj
             * @param {WeakSet} [seen] - Cycle guard
             */
            function markExternalProxy(obj, seen = new WeakSet()) {
                if (!obj || typeof obj !== 'object' || obj[EXTERNAL_PROXY_FLAG] || seen.has(obj)) {
                    return;
                }

                seen.add(obj);

                Object.defineProperty(obj, EXTERNAL_PROXY_FLAG, {
                    value: true,
                    enumerable: false,
                    writable: false,
                    configurable: false
                });

                for (const key of Object.keys(obj)) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        markExternalProxy(obj[key], seen);
                    }
                }
            }

            /**
             * Reentrancy guard. Prevents wakaPAC's watcher reconstruction
             * (which writes oldValue back through the proxy) from re-triggering
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
             * Cache so the same raw object always yields the same proxy.
             * Stable references prevent spurious change detection on repeated reads.
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

                // Mark before proxying so wakaPAC reads _externalProxy off the raw object.
                markExternalProxy(obj);

                const proxy = new Proxy(obj, {
                    /**
                     * Intercepts reads: exposes storeId, wraps mutating array methods,
                     * and lazily proxies nested objects for deep reactivity.
                     */
                    get(target, prop) {
                        // Expose _wakaStoreId so the plugin can identify store references.
                        if (prop === '_wakaStoreId') {
                            return storeId;
                        }

                        const val = target[prop];

                        // Intercept mutating array methods
                        if (Array.isArray(target) && typeof val === 'function' && MUTATING_METHODS.includes(prop)) {
                            return function() {
                                const oldArray = target.slice();
                                const result = Array.prototype[prop].apply(target, arguments);
                                notify(currentPath, oldArray, target);
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
                     * Intercepts writes. Skips unchanged values, marks new objects,
                     * then fires a notification.
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

                        const success = Reflect.set(target, prop, newValue);

                        if (success && isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, newValue);
                        }

                        return success;
                    },

                    /**
                     * Intercepts deletions and notifies with undefined as newValue.
                     */
                    deleteProperty(target, prop) {
                        if (!(prop in target)) {
                            return true;
                        }

                        const oldValue = target[prop];
                        const deleted  = Reflect.deleteProperty(target, prop);

                        if (deleted && isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, undefined);
                        }

                        return deleted;
                    }
                });

                proxyCache.set(obj, proxy);
                return proxy;
            }

            // Tag initialState so the plugin can identify it in originalAbstraction.
            // Non-enumerable — invisible to templates and for..in loops.
            Object.defineProperty(initialState, '_wakaStoreId', {
                value: storeId,
                enumerable: false,
                writable: false,
                configurable: false
            });

            /** Internal poll state. */
            let _pollTimer = null;
            let _pollActive = false;

            /** Active WebSocket instance. @type {WebSocket|null} */
            let _ws = null;

            /** True while a connect() session is active (survives reconnects). @type {boolean} */
            let _wsActive = false;

            /** Reconnect attempt counter; reset to 0 on successful open. @type {number} */
            let _wsAttempt = 0;

            /** Pending reconnect timer handle. @type {number|null} */
            let _wsReconnectTimer = null;

            /**
             * Safe localStorage wrapper. Returns null on any error (private
             * browsing, storage quota exceeded, security restrictions).
             * @param {'get'|'set'|'remove'} op
             * @param {string} key
             * @param {string} [value]
             * @returns {string|boolean|null} The stored string for 'get', true for 'set'/'remove', null on error
             */
            function localStorageOp(op, key, value) {
                try {
                    switch(op) {
                        case "get":
                            return localStorage.getItem(key);

                        case "set":
                            localStorage.setItem(key, value);
                            return true;

                        case "remove":
                            localStorage.removeItem(key);
                            return true;
                    }
                } catch (_e) {
                    // Swallow — quota exceeded, private browsing, or security error.
                }

                return null;
            }

            /** @type {number|null} Pending autoSave debounce timer */
            let _autoSaveTimer = null;

            /** @type {Function|null} autoSave listener reference, kept for removeEventListener */
            let _autoSaveListener = null;

            // Create proxy
            const proxy = createProxy(initialState, []);

            /**
             * Writes the current store state to localStorage under the persist key.
             * No-op if no persist key was set on createStore.
             * @returns {boolean} True if the write succeeded
             */
            Object.defineProperty(proxy, 'save', {
                enumerable: false,
                configurable: true,
                value: function() {
                    if (!persistKey) {
                        console.warn('wakaStore.save(): no persist key set — pass { persist: \'key\' } to createStore');
                        return false;
                    }

                    try {
                        const snapshot = JSON.stringify(initialState);
                        return localStorageOp('set', persistKey, snapshot) === true;
                    } catch (e) {
                        console.warn('wakaStore.save(): serialization failed', e);
                        return false;
                    }
                }
            });

            /**
             * Rehydrates the store from localStorage. Stored values overwrite
             * matching keys; keys absent from storage are left untouched.
             * @returns {boolean} True if stored data was found and applied
             */
            Object.defineProperty(proxy, 'load', {
                enumerable: false,
                configurable: true,
                value: function() {
                    if (!persistKey) {
                        console.warn('wakaStore.load(): no persist key set — pass { persist: \'key\' } to createStore');
                        return false;
                    }

                    const raw = localStorageOp('get', persistKey);

                    if (raw === null) {
                        return false;
                    }

                    let stored;

                    try {
                        stored = JSON.parse(raw);
                    } catch (e) {
                        console.warn('wakaStore.load(): stored data is not valid JSON, ignoring', e);
                        return false;
                    }

                    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
                        console.warn('wakaStore.load(): stored data is not a plain object, ignoring');
                        return false;
                    }

                    // Write through proxy so reactivity fires for each key.
                    Object.assign(proxy, stored);
                    return true;
                }
            });

            /**
             * Removes this store's entry from localStorage.
             * Does not affect current in-memory state.
             * @returns {boolean} True if a persist key was set
             */
            Object.defineProperty(proxy, 'clearPersist', {
                enumerable: false,
                configurable: true,
                value: function() {
                    if (!persistKey) {
                        return false;
                    }

                    localStorageOp('remove', persistKey);
                    return true;
                }
            });

            // Debounced autoSave: one localStorage write per mutation batch.
            if (autoSave) {
                _autoSaveListener = function(event) {
                    if (event.detail.storeId !== storeId) {
                        return;
                    }

                    if (_autoSaveTimer !== null) {
                        clearTimeout(_autoSaveTimer);
                    }

                    _autoSaveTimer = setTimeout(function() {
                        _autoSaveTimer = null;
                        proxy.save();
                    }, 0);
                };

                document.addEventListener(STORE_CHANGED_EVENT, _autoSaveListener);
            }

            // Rehydrate before any component mounts. pac:store-changed events fired
            // here hit an empty registry, so no DOM updates occur — components read
            // the already-rehydrated state when they mount.
            if (persistKey && autoLoad) {
                proxy.load();
            }

            /**
             * Polls an endpoint and merges the response into the store.
             * Default merge: Object.assign(store, response) — expects a plain JSON object.
             * Uses recursive setTimeout so the next poll starts only after the current
             * request settles. Pauses automatically when the tab is hidden.
             *
             * Note: local mutations are overwritten on the next cycle. Call push() first
             * to persist them before they are lost.
             *
             * @param {string} url - Endpoint to poll
             * @param {Object} [opts]
             * @param {number}   [opts.interval=5000]  - Ms between polls
             * @param {Function} [opts.merge]           - Custom merge: function(response), `this` = store
             * @param {Function} [opts.onError] - Error callback: (error) => void
             * @param {Object}   [opts.fetchOptions]    - Forwarded to fetch()
             */
            Object.defineProperty(proxy, 'poll', {
                enumerable: false,
                configurable: true,
                value: function(url, opts) {
                    opts = opts || {};

                    const interval = Math.max(0, opts.interval !== undefined ? opts.interval : 5000);
                    const merge = typeof opts.merge === 'function' ? opts.merge : null;
                    const onError = typeof opts.onError === 'function' ? opts.onError : null;
                    const fetchOptions = opts.fetchOptions || {};

                    // Calling poll() while already polling replaces the active poll.
                    if (_pollActive) {
                        proxy.stopPoll();
                    }

                    _pollActive = true;

                    /**
                     * Merges a response into the store.
                     * @param {Object} response - Parsed response body
                     */
                    function applyResponse(response) {
                        if (merge) {
                            merge.call(proxy, response);
                            return;
                        }

                        // Default: shallow-merge onto the proxy, firing pac:store-changed per key.
                        if (response && typeof response === 'object' && !Array.isArray(response)) {
                            Object.assign(proxy, response);
                        } else {
                            console.warn('wakaStore poll: default merge expects a plain object, got', typeof response, '— supply a merge callback for non-object responses');
                        }
                    }

                    /**
                     * Schedules the next poll via setTimeout.
                     * Skips the fetch when the tab is hidden; reschedules in .finally()
                     * so errors don't break the loop.
                     */
                    function schedulePoll() {
                        // Guard: stopPoll() may have fired between request end and this call.
                        if (!_pollActive) {
                            return;
                        }

                        // Recursive setTimeout: next poll starts only after current request settles,
                        // preventing pile-up on slow servers and avoiding setInterval drift.
                        _pollTimer = setTimeout(function() {
                            if (!_pollActive) {
                                return;
                            }

                            // Skip fetch when tab is hidden; reschedule to catch the next interval.
                            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                                schedulePoll();
                                return;
                            }

                            doFetch(url, fetchOptions)
                                .then(function(response) {
                                    // stopPoll() may have fired while the request was in flight.
                                    if (_pollActive) {
                                        applyResponse(response);
                                    }
                                })
                                .catch(function(error) {
                                    if (onError) {
                                        try { onError(error); } catch(_e) { /* swallow */ }
                                    } else {
                                        console.error('wakaStore poll error:', error);
                                    }
                                })
                                .finally(function() {
                                    // Guard against stopPoll() racing with .finally().
                                    if (_pollActive) {
                                        schedulePoll();
                                    }
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
                    // Primary stop signal — checked by in-flight .then() and schedulePoll().
                    _pollActive = false;

                    if (_pollTimer !== null) {
                        clearTimeout(_pollTimer);
                        _pollTimer = null;
                    }
                }
            });

            /**
             * Opens a WebSocket connection and merges incoming JSON messages into the store.
             * Default merge: Object.assign(store, data) — expects a plain JSON object.
             * Reconnects automatically with exponential backoff; onClose returning false
             * suppresses reconnect for that close event.
             * Calling connect() while already connected replaces the existing socket.
             *
             * @param {string} url - WebSocket endpoint (ws:// or wss://)
             * @param {Object} [opts]
             * @param {string|string[]} [opts.protocols]             - Subprotocol(s) for the WebSocket constructor
             * @param {Function}        [opts.merge]                 - Custom merge: function(data), `this` = store
             * @param {Function}        [opts.onError]          - Error callback: (event) => void
             * @param {Function}        [opts.onClose]               - Close callback: (CloseEvent) => void|false
             * @param {boolean}         [opts.reconnect=true]        - Auto-reconnect on close
             * @param {number}          [opts.reconnectDelay=1000]   - Base backoff delay in ms
             * @param {number}          [opts.reconnectDelayMax=30000] - Backoff cap in ms
             */
            Object.defineProperty(proxy, 'connect', {
                enumerable: false,
                configurable: true,
                value: function(url, opts) {
                    opts = opts || {};

                    const protocols        = opts.protocols       || undefined;
                    const merge            = typeof opts.merge   === 'function' ? opts.merge   : null;
                    const onError          = typeof opts.onError === 'function' ? opts.onError : null;
                    const onClose          = typeof opts.onClose === 'function' ? opts.onClose : null;
                    const reconnect        = opts.reconnect !== false;
                    const reconnectDelay   = typeof opts.reconnectDelay    === 'number' ? Math.max(0, opts.reconnectDelay)    : 1000;
                    const reconnectDelayMax = typeof opts.reconnectDelayMax === 'number' ? Math.max(0, opts.reconnectDelayMax) : 30000;

                    // Replace any active connection. Pass false so _wsActive stays true
                    // across the teardown — we're immediately setting it again below.
                    if (_wsActive) {
                        proxy.disconnect(false);
                    }

                    _wsActive  = true;
                    _wsAttempt = 0;

                    /** Exponential backoff: base * 2^attempt, capped at max. */
                    function backoffDelay() {
                        return Math.min(reconnectDelay * Math.pow(2, _wsAttempt), reconnectDelayMax);
                    }

                    /** Creates and wires a new WebSocket. Called on connect and each reconnect. */
                    function openSocket() {
                        // Guard: disconnect() may have fired during a backoff delay.
                        if (!_wsActive) {
                            return;
                        }

                        try {
                            _ws = protocols !== undefined
                                ? new WebSocket(url, protocols)
                                : new WebSocket(url);
                        } catch (e) {
                            // Constructor throws synchronously on invalid URLs.
                            if (onError) {
                                try { onError(e); } catch (_e) { /* swallow */ }
                            } else {
                                console.error('wakaStore connect error:', e);
                            }

                            scheduleReconnect();
                            return;
                        }

                        _ws.onopen = function() {
                            // Reset backoff so the next reconnect starts from the base delay.
                            _wsAttempt = 0;
                        };

                        _ws.onmessage = function(event) {
                            if (!_wsActive) {
                                return;
                            }

                            let data;

                            try {
                                data = JSON.parse(event.data);
                            } catch (e) {
                                console.error('wakaStore: received non-JSON message, ignoring', event.data);
                                return;
                            }

                            if (merge) {
                                merge.call(proxy, data);
                            } else {
                                // Default: shallow-merge onto the store — same convention as poll().
                                if (data && typeof data === 'object' && !Array.isArray(data)) {
                                    Object.assign(proxy, data);
                                } else {
                                    console.warn('wakaStore: default merge expects a plain object, got', typeof data, '— supply a merge callback for non-object messages');
                                }
                            }
                        };

                        _ws.onerror = function(event) {
                            if (onError) {
                                try { onError(event); } catch (_e) { /* swallow */ }
                            } else {
                                console.error('wakaStore WebSocket error:', event);
                            }
                            // onerror is always followed by onclose; reconnect logic lives there.
                        };

                        _ws.onclose = function(event) {
                            _ws = null;

                            if (!_wsActive) {
                                return;
                            }

                            // onClose returning false vetoes reconnect for this event.
                            if (onClose) {
                                let result;
                                try { result = onClose(event); } catch (_e) { /* swallow */ }
                                if (result === false) {
                                    _wsActive = false;
                                    return;
                                }
                            }

                            scheduleReconnect();
                        };
                    }

                    /** Schedules the next reconnect after the backoff delay. */
                    function scheduleReconnect() {
                        if (!reconnect || !_wsActive) {
                            return;
                        }

                        const delay = backoffDelay();
                        _wsAttempt++;

                        _wsReconnectTimer = setTimeout(function() {
                            _wsReconnectTimer = null;
                            openSocket();
                        }, delay);
                    }

                    openSocket();
                }
            });

            /**
             * Closes the active WebSocket and cancels any pending reconnect.
             * Safe to call when no connection is active. The store remains fully
             * usable after disconnect().
             *
             * @param {boolean} [_setInactive=true] - Internal. Pass false when
             *   replacing a connection inside connect() to skip the _wsActive toggle.
             */
            Object.defineProperty(proxy, 'disconnect', {
                enumerable: false,
                configurable: true,
                value: function(_setInactive) {
                    if (_setInactive !== false) {
                        _wsActive = false;
                    }

                    // Cancel any pending reconnect before it opens a new socket.
                    if (_wsReconnectTimer !== null) {
                        clearTimeout(_wsReconnectTimer);
                        _wsReconnectTimer = null;
                    }

                    if (_ws !== null) {
                        // Null handlers before close() so onclose doesn't trigger a reconnect.
                        _ws.onopen    = null;
                        _ws.onmessage = null;
                        _ws.onerror   = null;
                        _ws.onclose   = null;
                        _ws.close();
                        _ws = null;
                    }

                    _wsAttempt = 0;
                }
            });

            /**
             * Detaches the autoSave listener and cancels any pending debounced write.
             * save()/load()/clearPersist() remain available. Safe to call when autoSave
             * was not enabled.
             */
            Object.defineProperty(proxy, 'stopAutoSave', {
                enumerable: false,
                configurable: true,
                value: function() {
                    if (_autoSaveListener !== null) {
                        document.removeEventListener(STORE_CHANGED_EVENT, _autoSaveListener);
                        _autoSaveListener = null;
                    }

                    if (_autoSaveTimer !== null) {
                        clearTimeout(_autoSaveTimer);
                        _autoSaveTimer = null;
                    }
                }
            });

            /**
             * Tears down all background activity: stopPoll + disconnect + stopAutoSave.
             * The store proxy remains usable — in-memory state and persistence methods
             * are unaffected. Call on SPA navigation to prevent listener accumulation.
             */
            Object.defineProperty(proxy, 'destroy', {
                enumerable: false,
                configurable: true,
                value: function() {
                    proxy.stopPoll();
                    proxy.disconnect();
                    proxy.stopAutoSave();
                }
            });

            /**
             * Sends store state to a server endpoint and merges the response back in.
             * Default: PATCH with full store as body; plain JSON object response merged
             * via Object.assign. Supply merge for custom response handling.
             *
             * @param {string} url - Endpoint to push to
             * @param {Object} [opts]
             * @param {string} [opts.method='PATCH'] - HTTP method
             * @param {Object}   [opts.body]             - Body to send; defaults to full store state
             * @param {Function} [opts.merge]            - Custom merge: function(response), `this` = store
             * @param {Function} [opts.onError] - Error callback: (error) => void
             * @param {Object}   [opts.fetchOptions]     - Forwarded to fetch()
             * @returns {Promise<Object>} Resolves with the parsed response body
             */
            Object.defineProperty(proxy, 'push', {
                enumerable: false,
                configurable: true,
                value: function(url, opts) {
                    opts = opts || {};

                    const method        = opts.method        || 'PATCH';
                    const merge         = typeof opts.merge   === 'function' ? opts.merge   : null;
                    const onError       = typeof opts.onError === 'function' ? opts.onError : null;

                    // Snapshot via JSON round-trip: strips proxy wrapper, non-enumerable
                    // internals (_wakaStoreId, _externalProxy), and _ / $ prefixed props.
                    const body = opts.body !== undefined
                        ? opts.body
                        : JSON.parse(JSON.stringify(initialState));

                    // Deep-merge caller headers on top of Content-Type default.
                    const fetchOptions = Object.assign({}, opts.fetchOptions, {
                        method: method,
                        headers: Object.assign(
                            { 'Content-Type': 'application/json' },
                            opts.fetchOptions && opts.fetchOptions.headers
                        ),
                        body: JSON.stringify(body)
                    });

                    return doFetch(url, fetchOptions)
                        .then(function(response) {
                            if (!response) {
                                return response;
                            }

                            if (merge) {
                                merge.call(proxy, response);
                                return response;
                            }

                            // Fold response back into the store (e.g. server-generated IDs,
                            // timestamps). Skip gracefully for empty / non-object responses.
                            if (response && typeof response === 'object' && !Array.isArray(response)) {
                                Object.assign(proxy, response);
                            }

                            return response;
                        })
                        .catch(function(error) {
                            if (onError) {
                                try { onError(error); } catch(_e) { /* swallow */ }
                            }

                            // Re-throw so the caller's .catch() / try-catch still fires.
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

    window.WakaStore = WakaStore;
    window.wakaStore = wakaStore;
})();