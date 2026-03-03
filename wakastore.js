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
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    "use strict";

    /** @type {string} */
    const VERSION = '1.0.0';

    /**
     * The custom event name fired on document when a store mutation occurs.
     * The plugin listens for this and handles all wakaPAC interaction,
     * keeping the store proxy completely decoupled from wakaPAC internals.
     * @type {string}
     */
    const STORE_CHANGED_EVENT = 'pac:store-changed';

    /**
     * Array methods that mutate in place — intercepted so that e.g.
     * store.items.push(x) is detected and triggers propagation.
     * @type {string[]}
     */
    const MUTATING_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

    /**
     * Returns true if the property should trigger reactivity.
     * Properties starting with _ or $ are non-reactive, matching wakaPAC's
     * convention for internal/DOM-reference data.
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
        /**
         * Monotonically increasing counter for generating unique store IDs.
         * @type {number}
         */
        this._nextStoreId = 1;

        /**
         * Registry populated by the plugin's onComponentCreated hook.
         * Maps storeId -> Map<pacId, { key: string, container: Element }>
         *
         * key       = the abstraction property name the store is mounted under
         * container = the component's DOM container
         *
         * @type {Map<string, Map<string, { key: string, container: Element }>>}
         */
        this._registry = new Map();
    }

    WakaStore.prototype = {
        constructor: WakaStore,

        /**
         * Creates a wakaPAC plugin descriptor.
         *
         * Two responsibilities:
         *
         * 1. onComponentCreated — scans the abstraction for store references and
         *    registers the container + mounted key in the registry.
         *
         * 2. document listener for STORE_CHANGED_EVENT — when the store proxy fires
         *    this event, the listener finds all subscriber components, writes the
         *    new store snapshot directly to context.originalAbstraction (bypassing
         *    wakaPAC's reactive proxy entirely), then dispatches pac:change on the
         *    container so wakaPAC re-renders from the updated raw data.
         *
         * The store proxy never touches wakaPAC's abstraction proxy. All wakaPAC
         * interaction is handled here, where we have access to originalAbstraction.
         *
         * @param {Object} pac - The wakaPAC instance, passed by wakaPAC.use()
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin(pac) {
            const registry = this._registry;

            /**
             * Scans a raw abstraction object for store references.
             * A store reference is any property whose value is tagged with a
             * non-enumerable _wakaStoreId (set by createStore on initialState).
             *
             * We receive context.originalAbstraction here — the plain object
             * before wakaPAC wraps it — so property reads are direct and safe.
             *
             * @param  {Object} rawAbstraction - context.originalAbstraction
             * @returns {Array<{key: string, storeId: string}>}
             */
            function findStoreReferences(rawAbstraction) {
                const entries = [];

                for (const key of Object.keys(rawAbstraction)) {
                    const val = rawAbstraction[key];

                    if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, '_wakaStoreId')) {
                        entries.push({ key, storeId: val._wakaStoreId });
                    }
                }

                return entries;
            }

            /**
             * Handles pac:store-changed events fired by store proxies.
             *
             * For each subscriber of the changed store:
             * 1. Retrieves the context from PACRegistry to get originalAbstraction
             * 2. Writes the snapshot directly to originalAbstraction[key] —
             *    a plain object write, no proxy involved
             * 3. Dispatches pac:change on the container so wakaPAC re-renders
             *
             * @param {CustomEvent} event
             * @param {string} event.detail.storeId   - ID of the store that changed
             * @param {Object} event.detail.snapshot  - Current raw store contents
             */
            function onStoreChanged(event) {
                const { storeId, snapshot } = event.detail;
                const subscribers = registry.get(storeId);

                if (!subscribers || subscribers.size === 0) {
                    return;
                }

                subscribers.forEach(function({ key, container }, pacId) {
                    // The store proxy already wrote the new value to initialState
                    // (the raw object) before firing this event. originalAbstraction[key]
                    // points to that same raw object, so wakaPAC's proxy already sees
                    // the correct data when it reads through to re-render.
                    // We only need to tell wakaPAC to re-render — no write needed here.
                    container.dispatchEvent(new CustomEvent('pac:change', {
                        detail: {
                            path: [key],
                            oldValue: null,
                            newValue: null
                        }
                    }));
                });
            }

            // Listen for store mutation events on document.
            // The store proxy fires these without any knowledge of wakaPAC.
            document.addEventListener(STORE_CHANGED_EVENT, onStoreChanged);

            return {
                /**
                 * Called by wakaPAC after a component is created.
                 *
                 * Receives context.originalAbstraction (the raw plain object) as
                 * the third argument via the plugin call in wakaPAC's source:
                 *   plugin.onComponentCreated(context.abstraction, pacId, config)
                 *
                 * Since wakaPAC passes context.abstraction (the proxy) as the first
                 * arg, we retrieve originalAbstraction from PACRegistry instead,
                 * which is safe and guaranteed to be the plain object.
                 *
                 * @param {Object} abstraction - context.abstraction (wakaPAC proxy) — not used
                 * @param {string} pacId
                 */
                onComponentCreated(abstraction, pacId) {
                    const context = window.PACRegistry.get(pacId);

                    if (!context || !context.originalAbstraction) {
                        return;
                    }

                    const storeEntries = findStoreReferences(context.originalAbstraction);
                    const container = context.container;

                    if (storeEntries.length === 0 || !container) {
                        return;
                    }

                    for (const { key, storeId } of storeEntries) {
                        if (!registry.has(storeId)) {
                            registry.set(storeId, new Map());
                        }

                        registry.get(storeId).set(pacId, { key, container });
                    }
                },

                /**
                 * Called by wakaPAC when a component is destroyed.
                 * Removes the component from the registry.
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
         * Returns a Proxy that intercepts all mutations — including nested
         * property writes and array method calls. On any mutation:
         * 1. The raw value is written to the target (plain object write)
         * 2. A pac:store-changed event is fired on document
         *
         * The store proxy has zero knowledge of wakaPAC. It never touches any
         * wakaPAC abstraction proxy. All wakaPAC interaction is handled by the
         * plugin's document listener, which writes to originalAbstraction directly
         * before dispatching pac:change.
         *
         * @param {Object} initialState - Plain object representing initial store state
         * @returns {Proxy} Store proxy for direct mutation
         */
        createStore(initialState) {
            if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
                throw new Error('wakaStore.createStore(): initialState must be a plain object');
            }

            const storeId = 'store-' + (this._nextStoreId++);

            /**
             * Fires pac:store-changed on document with the current snapshot.
             * This is the only thing the store proxy does to communicate a change.
             */
            function notifyChanged() {
                document.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, {
                    detail: {
                        storeId: storeId,
                        snapshot: initialState
                    }
                }));
            }

            /**
             * Cache of raw object -> proxy. Ensures the same raw object always
             * returns the same Proxy instance. Without this, every get() call on
             * a nested object returns a brand new Proxy, which wakaPAC treats as
             * a changed value and tries to re-wrap — causing infinite recursion.
             * @type {WeakMap<Object, Proxy>}
             */
            const proxyCache = new WeakMap();

            /**
             * Wraps an object or array in a store proxy, returning a cached
             * instance if one already exists for this object.
             * Nested objects are wrapped lazily on access so that deep mutations
             * like store.user.address.city = 'Haarlem' are intercepted.
             * @param {Object|Array} obj
             * @returns {Proxy}
             */
            function createProxy(obj) {
                if (proxyCache.has(obj)) {
                    return proxyCache.get(obj);
                }

                const proxy = new Proxy(obj, {

                    get(target, prop) {
                        const val = target[prop];

                        // Intercept mutating array methods so store.items.push(x)
                        // triggers notification after the mutation completes.
                        if (Array.isArray(target) && typeof val === 'function' && MUTATING_METHODS.includes(prop)) {
                            return function() {
                                const result = Array.prototype[prop].apply(target, arguments);
                                notifyChanged();
                                return result;
                            };
                        }

                        // Lazily wrap nested objects/arrays so deep writes are caught.
                        if (isReactive(prop) && val && typeof val === 'object') {
                            return createProxy(val);
                        }

                        return val;
                    },

                    set(target, prop, newValue) {
                        if (target[prop] === newValue) {
                            return true;
                        }

                        target[prop] = newValue;

                        if (isReactive(prop)) {
                            notifyChanged();
                        }

                        return true;
                    },

                    deleteProperty(target, prop) {
                        if (!(prop in target)) {
                            return true;
                        }

                        delete target[prop];

                        if (isReactive(prop)) {
                            notifyChanged();
                        }

                        return true;
                    }
                });

                proxyCache.set(obj, proxy);
                return proxy;
            }

            // Tag initialState so onComponentCreated can identify it when
            // scanning the raw abstraction. Non-enumerable so it stays invisible
            // to template bindings and for..in loops.
            Object.defineProperty(initialState, '_wakaStoreId', {
                value: storeId,
                enumerable: false,
                writable: false,
                configurable: false
            });

            return createProxy(initialState);
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