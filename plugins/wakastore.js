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

    /** Owns the state and lifecycle of one store plugin. */
    class StorePlugin {
        constructor(owner) {
            this._owner = owner;

            this.findStoreReferences = this.findStoreReferences.bind(this);
            this.onStoreChanged = this.onStoreChanged.bind(this);
        }

        initialize() {
            const state = this;

            state._registry = state._owner._registry;

            // Listen to pac:store-changed event
            document.addEventListener(STORE_CHANGED_EVENT, state.onStoreChanged);

            return state.createDescriptor();
        }

        findStoreReferences(rawAbstraction) {
            const entries = [];

            for (const key of Object.keys(rawAbstraction)) {
                const val = rawAbstraction[key];

                if (val && typeof val === 'object' && val._wakaStoreId) {
                    entries.push({ key, storeId: val._wakaStoreId });
                }
            }

            return entries;
        }

        onStoreChanged(event) {
            const state = this;

            const onStoreChangedHandlers = {
                visitItem({ key, container }) {
                    container.dispatchEvent(new CustomEvent('pac:change', {
                        detail: {
                            path    : [key].concat(path),
                            oldValue: oldValue,
                            newValue: newValue
                        }
                    }));
                }
            };

            const { storeId, path, oldValue, newValue } = event.detail;

            // Do nothing if the value did not change
            if (oldValue === newValue) {
                return;
            }

            // Do nothing when no subscribers present
            const subscribers = state._registry.get(storeId);

            if (!subscribers || subscribers.size === 0) {
                return;
            }

            // Notify all subscribers
            subscribers.forEach(onStoreChangedHandlers.visitItem);
        }

        createDescriptor() {
            const state = this;

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

                    const storeEntries = state.findStoreReferences(context.originalAbstraction);

                    // Nothing to subscribe to, or container not yet in the DOM.
                    if (storeEntries.length === 0 || !context.container) {
                        return;
                    }

                    for (const { key, storeId } of storeEntries) {
                        // Lazily create the subscriber map for this store on first use.
                        if (!state._registry.has(storeId)) {
                            state._registry.set(storeId, new Map());
                        }

                        // key is the mount name (e.g. 'session' in { session: store }).
                        // onStoreChanged prepends it to the path so wakaPAC resolves
                        // the correct binding (e.g. ['session', 'user', 'name']).
                        state._registry.get(storeId).set(pacId, { key, container: context.container });
                    }
                },

                /**
                 * Removes the component from all store subscriptions.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    const onComponentDestroyedHandlers = {
                        visitItem(subscribers, storeId) {
                            subscribers.delete(pacId);

                            if (subscribers.size === 0) {
                                state._registry.delete(storeId);
                            }
                        }
                    };

                    state._registry.forEach(onComponentDestroyedHandlers.visitItem);
                }
            };
        }
    }

    /** Owns the state and lifecycle of one reactive store. */
    class ReactiveStore {
        constructor(owner, initialState, opts) {
            this._owner = owner;
            this._initialState = initialState;
            this._opts = opts;

            this.markExternalProxy = this.markExternalProxy.bind(this);
            this.notify = this.notify.bind(this);
            this.createProxy = this.createProxy.bind(this);
            this.localStorageOp = this.localStorageOp.bind(this);

            this.load = this.load.bind(this);

            this.poll = this.poll.bind(this);

            this.connect = this.connect.bind(this);

            this.disconnect = this.disconnect.bind(this);

            this.push = this.push.bind(this);

            this.stopPoll = this.stopPoll.bind(this);

            this.stopAutoSave = this.stopAutoSave.bind(this);

            this.destroy = this.destroy.bind(this);

            this.save = this.save.bind(this);

            this.clearPersist = this.clearPersist.bind(this);
        }

        initialize() {
            const state = this;

            if (!pluginRuntime.isPlainObject(state._initialState)) {
                throw new Error('wakaStore.createStore(): initialState must be a plain object');
            }

            state.configurePersistence();

            state.initializeProxyState();

            state.initializeTransportState();

            state.installPersistenceMethods();

            state.initializePersistence();

            state.installTransportMethods();

            return state._proxy;
        }

        markExternalProxy(obj, seen = new WeakSet()) {
            const state = this;

            if (!obj || typeof obj !== 'object' || obj[EXTERNAL_PROXY_FLAG] || seen.has(obj)) {
                return;
            }

            seen.add(obj);

            Object.defineProperty(obj, EXTERNAL_PROXY_FLAG, {
                value       : true,
                enumerable  : false,
                writable    : false,
                configurable: false
            });

            for (const key of Object.keys(obj)) {
                if (obj[key] && typeof obj[key] === 'object') {
                    state.markExternalProxy(obj[key], seen);
                }
            }
        }

        notify(path, oldValue, newValue) {
            const state = this;

            if (state._notifying) {
                return;
            }

            state._notifying = true;

            try {
                document.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, {
                    detail: { storeId: state._storeId, path, oldValue, newValue }
                }));
            } finally {
                state._notifying = false;
            }
        }

        createProxy(obj, currentPath) {
            const state = this;

            if (state._proxyCache.has(obj)) {
                return state._proxyCache.get(obj);
            }

            // Mark before proxying so wakaPAC reads _externalProxy off the raw object.
            state.markExternalProxy(obj);

            const proxy = new Proxy(obj, {
                /**
                 * Intercepts reads: exposes storeId, wraps mutating array methods,
                 * and lazily proxies nested objects for deep reactivity.
                 */
                get(target, prop) {
                    // Expose _wakaStoreId so the plugin can identify store references.
                    if (prop === '_wakaStoreId') {
                        return state._storeId;
                    }

                    const val = target[prop];

                    // Intercept mutating array methods
                    if (Array.isArray(target) && typeof val === 'function' && MUTATING_METHODS.includes(prop)) {
                        const getHandlers = {
                            mutateArray() {
                                const oldArray = target.slice();
                                const result = Array.prototype[prop].apply(target, arguments);
                                state.notify(currentPath, oldArray, target);
                                return result;
                            }
                        };

                        return getHandlers.mutateArray;
                    }

                    // Lazily wrap nested objects/arrays
                    if (pluginRuntime.isReactive(prop) && val && typeof val === 'object') {
                        return state.createProxy(val, currentPath.concat([prop]));
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
                        state.markExternalProxy(newValue);
                    }

                    const success = Reflect.set(target, prop, newValue);

                    if (success && pluginRuntime.isReactive(prop)) {
                        state.notify(currentPath.concat([prop]), oldValue, newValue);
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

                    if (deleted && pluginRuntime.isReactive(prop)) {
                        state.notify(currentPath.concat([prop]), oldValue, undefined);
                    }

                    return deleted;
                }
            });

            state._proxyCache.set(obj, proxy);
            return proxy;
        }

        localStorageOp(op, key, value) {
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

        createLoadDescriptor() {
            const state = this;

            return {
                enumerable  : false,
                configurable: true,
                value       : state.load
            };
        }

        createPollDescriptor() {
            const state = this;

            return {
                enumerable  : false,
                configurable: true,
                value       : state.poll
            };
        }

        createConnectDescriptor() {
            const state = this;

            return {
                enumerable  : false,
                configurable: true,
                value       : state.connect
            };
        }

        createDisconnectDescriptor() {
            const state = this;

            return {
                enumerable  : false,
                configurable: true,
                value       : state.disconnect
            };
        }

        createPushDescriptor() {
            const state = this;

            return {
                enumerable  : false,
                configurable: true,
                value       : state.push
            };
        }

        installTransportMethods() {
            const session = this;

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
            Object.defineProperty(session._proxy, 'poll', session.createPollDescriptor());

            /**
             * Stops an active poll started by poll().
             * Safe to call when no poll is active.
             */
            Object.defineProperty(session._proxy, 'stopPoll', {
                enumerable  : false,
                configurable: true,
                value       : session.stopPoll
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
            Object.defineProperty(session._proxy, 'connect', session.createConnectDescriptor());

            /**
             * Closes the active WebSocket and cancels any pending reconnect.
             * Safe to call when no connection is active. The store remains fully
             * usable after disconnect().
             *
             * @param {boolean} [_setInactive=true] - Internal. Pass false when
             *   replacing a connection inside connect() to skip the _wsActive toggle.
             */
            Object.defineProperty(session._proxy, 'disconnect', session.createDisconnectDescriptor());

            /**
             * Detaches the autoSave listener and cancels any pending debounced write.
             * save()/load()/clearPersist() remain available. Safe to call when autoSave
             * was not enabled.
             */
            Object.defineProperty(session._proxy, 'stopAutoSave', {
                enumerable  : false,
                configurable: true,
                value       : session.stopAutoSave
            });

            /**
             * Tears down all background activity: stopPoll + disconnect + stopAutoSave.
             * The store proxy remains usable — in-memory state and persistence methods
             * are unaffected. Call on SPA navigation to prevent listener accumulation.
             */
            Object.defineProperty(session._proxy, 'destroy', {
                enumerable  : false,
                configurable: true,
                value       : session.destroy
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
            Object.defineProperty(session._proxy, 'push', session.createPushDescriptor());
        }

        initializePersistence() {
            const session = this;

            // Debounced autoSave: one localStorage write per mutation batch.
            if (session._autoSave) {
                const initializePersistenceHandlers = {
                    onStoreChanged(event) {
                        const handleHandlers = {
                            onTimeout() {
                                session._autoSaveTimer = null;
                                session._proxy.save();
                            }
                        };

                        if (event.detail.storeId !== session._storeId) {
                            return;
                        }

                        if (session._autoSaveTimer !== null) {
                            clearTimeout(session._autoSaveTimer);
                        }

                        session._autoSaveTimer = setTimeout(handleHandlers.onTimeout, 0);
                    }
                };

                session._autoSaveListener = initializePersistenceHandlers.onStoreChanged;

                document.addEventListener(STORE_CHANGED_EVENT, session._autoSaveListener);
            }

            // Rehydrate before any component mounts. pac:store-changed events fired
            // here hit an empty registry, so no DOM updates occur — components read
            // the already-rehydrated state when they mount.
            if (session._persistKey && session._autoLoad) {
                session._proxy.load();
            }
        }

        installPersistenceMethods() {
            const session = this;

            /**
             * Writes the current store state to localStorage under the persist key.
             * No-op if no persist key was set on createStore.
             * @returns {boolean} True if the write succeeded
             */
            Object.defineProperty(session._proxy, 'save', {
                enumerable  : false,
                configurable: true,
                value       : session.save
            });

            /**
             * Rehydrates the store from localStorage. Stored values overwrite
             * matching keys; keys absent from storage are left untouched.
             * @returns {boolean} True if stored data was found and applied
             */
            Object.defineProperty(session._proxy, 'load', session.createLoadDescriptor());

            /**
             * Removes this store's entry from localStorage.
             * Does not affect current in-memory state.
             * @returns {boolean} True if a persist key was set
             */
            Object.defineProperty(session._proxy, 'clearPersist', {
                enumerable  : false,
                configurable: true,
                value       : session.clearPersist
            });
        }

        initializeTransportState() {
            const context = this;

            /** Internal poll state. */
            context._pollTimer = null;
            context._pollActive = false;

            /** Active WebSocket instance. @type {WebSocket|null} */
            context._ws = null;

            /** True while a connect() session is active (survives reconnects). @type {boolean} */
            context._wsActive = false;

            /** Reconnect attempt counter; reset to 0 on successful open. @type {number} */
            context._wsAttempt = 0;

            /** Pending reconnect timer handle. @type {number|null} */
            context._wsReconnectTimer = null;

            /** @type {number|null} Pending autoSave debounce timer */
            context._autoSaveTimer = null;

            /** @type {Function|null} autoSave listener reference, kept for removeEventListener */
            context._autoSaveListener = null;

            // Create proxy
            context._proxy = context.createProxy(context._initialState, []);
        }

        initializeProxyState() {
            const state = this;

            /**
             * Reentrancy guard. Prevents wakaPAC's watcher reconstruction
             * (which writes oldValue back through the proxy) from re-triggering
             * notify and causing an infinite loop.
             * @type {boolean}
             */
            state._notifying = false;

            /**
             * Cache so the same raw object always yields the same proxy.
             * Stable references prevent spurious change detection on repeated reads.
             * @type {WeakMap<Object, Proxy>}
             */
            state._proxyCache = new WeakMap();

            // Tag initialState so the plugin can identify it in originalAbstraction.
            // Non-enumerable — invisible to templates and for..in loops.
            Object.defineProperty(state._initialState, '_wakaStoreId', {
                value       : state._storeId,
                enumerable  : false,
                writable    : false,
                configurable: false
            });
        }

        configurePersistence() {
            const state = this;

            state._opts = state._opts || {};

            state._storeId = 'store-' + state._owner._nextStoreId++;
            state._persistKey = typeof state._opts.persist === 'string' ? state._opts.persist : null;
            state._autoSave = state._opts.autoSave === true && state._persistKey !== null;
            state._autoLoad = state._opts.autoLoad === true && state._persistKey !== null;
        }

        load() {
            const state = this;

            if (!state._persistKey) {
                console.warn('wakaStore.load(): no persist key set — pass { persist: \'key\' } to createStore');
                return false;
            }

            const raw = state.localStorageOp('get', state._persistKey);

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
            Object.assign(state._proxy, stored);
            return true;
        }

        poll(url, opts) {
            const state = this;

            const valueRuntimeMethods = {
                /**
                 * Merges a response into the store.
                 * @param {Object} response - Parsed response body
                 */
                applyResponse(response) {
                    if (merge) {
                        merge.call(state._proxy, response);
                        return;
                    }

                    // Default: shallow-merge onto the proxy, firing pac:store-changed per key.
                    if (response && typeof response === 'object' && !Array.isArray(response)) {
                        Object.assign(state._proxy, response);
                    } else {
                        console.warn('wakaStore poll: default merge expects a plain object, got', typeof response, '— supply a merge callback for non-object responses');
                    }
                },

                /**
                 * Schedules the next poll via setTimeout.
                 * Skips the fetch when the tab is hidden; reschedules in .finally()
                 * so errors don't break the loop.
                 */
                schedulePoll() {
                    const schedulePollHandlers = {
                        onTimeout() {
                            const onTimeoutHandlers = {
                                onSettled() {
                                    // Guard against stopPoll() racing with .finally().
                                    if (state._pollActive) {
                                        valueRuntimeMethods.schedulePoll();
                                    }
                                },

                                onRejected(error) {
                                    if (onError) {
                                        try { onError(error); } catch(_e) { /* swallow */ }
                                    } else {
                                        console.error('wakaStore poll error:', error);
                                    }
                                },

                                onResolved(response) {
                                    // stopPoll() may have fired while the request was in flight.
                                    if (state._pollActive) {
                                        valueRuntimeMethods.applyResponse(response);
                                    }
                                }
                            };

                            if (!state._pollActive) {
                                return;
                            }

                            // Skip fetch when tab is hidden; reschedule to catch the next interval.
                            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                                valueRuntimeMethods.schedulePoll();
                                return;
                            }

                            pluginRuntime.doFetch(url, fetchOptions)
                                .then(onTimeoutHandlers.onResolved)
                                .catch(onTimeoutHandlers.onRejected)
                                .finally(onTimeoutHandlers.onSettled);
                        }
                    };

                    // Guard: stopPoll() may have fired between request end and this call.
                    if (!state._pollActive) {
                        return;
                    }

                    // Recursive setTimeout: next poll starts only after current request settles,
                    // preventing pile-up on slow servers and avoiding setInterval drift.
                    state._pollTimer = setTimeout(schedulePollHandlers.onTimeout, interval);
                }
            };

            opts = opts || {};

            const interval = Math.max(0, opts.interval !== undefined ? opts.interval : 5000);
            const merge = typeof opts.merge === 'function' ? opts.merge : null;
            const onError = typeof opts.onError === 'function' ? opts.onError : null;
            const fetchOptions = opts.fetchOptions || {};

            // Calling poll() while already polling replaces the active poll.
            if (state._pollActive) {
                state._proxy.stopPoll();
            }

            state._pollActive = true;

            valueRuntimeMethods.schedulePoll();
        }

        connect(url, opts) {
            const state = this;

            const valueRuntime = {
                /** Exponential backoff: base * 2^attempt, capped at max. */
                backoffDelay() {
                    return Math.min(reconnectDelay * Math.pow(2, state._wsAttempt), reconnectDelayMax);
                },

                /** Creates and wires a new WebSocket. Called on connect and each reconnect. */
                openSocket() {
                    const openSocketHandlers = {
                        onclose(event) {
                            state._ws = null;

                            if (!state._wsActive) {
                                return;
                            }

                            // onClose returning false vetoes reconnect for this event.
                            if (onClose) {
                                let result;
                                try { result = onClose(event); } catch (_e) { /* swallow */ }
                                if (result === false) {
                                    state._wsActive = false;
                                    return;
                                }
                            }

                            valueRuntime.scheduleReconnect();
                        },

                        onerror(event) {
                            if (onError) {
                                try { onError(event); } catch (_e) { /* swallow */ }
                            } else {
                                console.error('wakaStore WebSocket error:', event);
                            }
                            // onerror is always followed by onclose; reconnect logic lives there.
                        },

                        onmessage(event) {
                            if (!state._wsActive) {
                                return;
                            }

                            let data;

                            try {
                                data = JSON.parse(event.data);
                            } catch (_e) {
                                console.error('wakaStore: received non-JSON message, ignoring', event.data);
                                return;
                            }

                            if (merge) {
                                merge.call(state._proxy, data);
                            } else {
                                // Default: shallow-merge onto the store — same convention as poll().
                                if (data && typeof data === 'object' && !Array.isArray(data)) {
                                    Object.assign(state._proxy, data);
                                } else {
                                    console.warn('wakaStore: default merge expects a plain object, got', typeof data, '— supply a merge callback for non-object messages');
                                }
                            }
                        },

                        onopen() {
                            // Reset backoff so the next reconnect starts from the base delay.
                            state._wsAttempt = 0;
                        }
                    };

                    // Guard: disconnect() may have fired during a backoff delay.
                    if (!state._wsActive) {
                        return;
                    }

                    try {
                        state._ws = protocols !== undefined
                            ? new WebSocket(url, protocols)
                            : new WebSocket(url);
                    } catch (e) {
                        // Constructor throws synchronously on invalid URLs.
                        if (onError) {
                            try { onError(e); } catch (_e) { /* swallow */ }
                        } else {
                            console.error('wakaStore connect error:', e);
                        }

                        valueRuntime.scheduleReconnect();
                        return;
                    }

                    state._ws.onopen = openSocketHandlers.onopen;

                    state._ws.onmessage = openSocketHandlers.onmessage;

                    state._ws.onerror = openSocketHandlers.onerror;

                    state._ws.onclose = openSocketHandlers.onclose;
                },

                /** Schedules the next reconnect after the backoff delay. */
                scheduleReconnect() {
                    const scheduleReconnectHandlers = {
                        onTimeout() {
                            state._wsReconnectTimer = null;
                            valueRuntime.openSocket();
                        }
                    };

                    if (!reconnect || !state._wsActive) {
                        return;
                    }

                    const delay = valueRuntime.backoffDelay();
                    state._wsAttempt++;

                    state._wsReconnectTimer = setTimeout(scheduleReconnectHandlers.onTimeout, delay);
                }
            };

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
            if (state._wsActive) {
                state._proxy.disconnect(false);
            }

            state._wsActive  = true;
            state._wsAttempt = 0;

            valueRuntime.openSocket();
        }

        disconnect(_setInactive) {
            const state = this;

            if (_setInactive !== false) {
                state._wsActive = false;
            }

            // Cancel any pending reconnect before it opens a new socket.
            if (state._wsReconnectTimer !== null) {
                clearTimeout(state._wsReconnectTimer);
                state._wsReconnectTimer = null;
            }

            if (state._ws !== null) {
                // Null handlers before close() so onclose doesn't trigger a reconnect.
                state._ws.onopen    = null;
                state._ws.onmessage = null;
                state._ws.onerror   = null;
                state._ws.onclose   = null;
                state._ws.close();
                state._ws = null;
            }

            state._wsAttempt = 0;
        }

        push(url, opts) {
            const state = this;

            const valueHandlers = {
                onRejected(error) {
                    if (onError) {
                        try { onError(error); } catch(_e) { /* swallow */ }
                    }

                    // Re-throw so the caller's .catch() / try-catch still fires.
                    throw error;
                },

                onResolved(response) {
                    if (!response) {
                        return response;
                    }

                    if (merge) {
                        merge.call(state._proxy, response);
                        return response;
                    }

                    // Fold response back into the store (e.g. server-generated IDs,
                    // timestamps). Skip gracefully for empty / non-object responses.
                    if (response && typeof response === 'object' && !Array.isArray(response)) {
                        Object.assign(state._proxy, response);
                    }

                    return response;
                }
            };

            opts = opts || {};

            const method        = opts.method        || 'PATCH';
            const merge         = typeof opts.merge   === 'function' ? opts.merge   : null;
            const onError       = typeof opts.onError === 'function' ? opts.onError : null;

            // Snapshot via JSON round-trip: strips proxy wrapper, non-enumerable
            // internals (_wakaStoreId, _externalProxy), and _ / $ prefixed props.
            const body = opts.body !== undefined
                ? opts.body
                : JSON.parse(JSON.stringify(state._initialState));

            // Deep-merge caller headers on top of Content-Type default.
            const fetchOptions = Object.assign({}, opts.fetchOptions, {
                method : method,
                headers: Object.assign(
                    { 'Content-Type': 'application/json' },
                    opts.fetchOptions && opts.fetchOptions.headers
                ),
                body: JSON.stringify(body)
            });

            return pluginRuntime.doFetch(url, fetchOptions)
                .then(valueHandlers.onResolved)
                .catch(valueHandlers.onRejected);
        }

        stopPoll() {
            const session = this;

            // Primary stop signal — checked by in-flight .then() and schedulePoll().
            session._pollActive = false;

            if (session._pollTimer !== null) {
                clearTimeout(session._pollTimer);
                session._pollTimer = null;
            }
        }

        stopAutoSave() {
            const session = this;

            if (session._autoSaveListener !== null) {
                document.removeEventListener(STORE_CHANGED_EVENT, session._autoSaveListener);
                session._autoSaveListener = null;
            }

            if (session._autoSaveTimer !== null) {
                clearTimeout(session._autoSaveTimer);
                session._autoSaveTimer = null;
            }
        }

        destroy() {
            const session = this;

            session._proxy.stopPoll();
            session._proxy.disconnect();
            session._proxy.stopAutoSave();
        }

        save() {
            const session = this;

            if (!session._persistKey) {
                console.warn('wakaStore.save(): no persist key set — pass { persist: \'key\' } to createStore');
                return false;
            }

            try {
                const snapshot = JSON.stringify(session._initialState);
                return session.localStorageOp('set', session._persistKey, snapshot) === true;
            } catch (e) {
                console.warn('wakaStore.save(): serialization failed', e);
                return false;
            }
        }

        clearPersist() {
            const session = this;

            if (!session._persistKey) {
                return false;
            }

            session.localStorageOp('remove', session._persistKey);
            return true;
        }
    }

    const pluginRuntime = {
        /**
         * Performs a fetch request and returns the parsed JSON body.
         * Rejects with a descriptive error on non-ok responses.
         * @param {string} url
         * @param {Object} [fetchOptions]
         * @returns {Promise<Object>}
         */
        doFetch(url, fetchOptions) {
            const doFetchHandlers = {
                onResolved(response) {
                    if (!response.ok) {
                        // Attach status + response so catch handlers can inspect without re-fetching.
                        const error = new Error('wakaStore: HTTP ' + response.status + ' for ' + url);
                        error.status = response.status;
                        error.response = response;
                        throw error;
                    }

                    // Non-JSON responses (e.g. 204 No Content) will reject and reach onError / catch.
                    return response.json();
                }
            };

            // Deep-merge headers so the Accept default and caller-supplied headers both survive.
            const opts = Object.assign({}, DEFAULT_FETCH_OPTIONS, fetchOptions, {
                headers: Object.assign({}, DEFAULT_FETCH_OPTIONS.headers, fetchOptions && fetchOptions.headers)
            });

            return fetch(url, opts).then(doFetchHandlers.onResolved);
        },

        /**
         * Returns true if the property should trigger reactivity.
         * Properties starting with _ or $ are non-reactive.
         * @param {string|symbol} prop
         * @returns {boolean}
         */
        isReactive(prop) {
            return typeof prop === 'string' && prop[0] !== '_' && prop[0] !== '$';
        },

        /**
         * Returns true if val is a plain object (not an array, Date, Map, etc.).
         * @param {*} val
         * @returns {boolean}
         */
        isPlainObject(val) {
            return !!val && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype;
        }
    };

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
            return new StorePlugin(this).initialize();
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
            return new ReactiveStore(this, initialState, opts).initialize();
        }
    };

    /** @type {string} */
    WakaStore.VERSION = VERSION;

    /** @type {WakaStore} */
    const wakaStore = new WakaStore();

    window.WakaStore = WakaStore;
    window.wakaStore = wakaStore;
})();