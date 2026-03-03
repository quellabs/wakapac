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

            return createProxy(initialState, []);
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