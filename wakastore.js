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
 * ║  store — whether made through a component proxy or directly on the store —       ║
 * ║  automatically propagate to all components that hold a reference.                ║
 * ║                                                                                  ║
 * ║  Usage:                                                                          ║
 * ║    wakaPAC.use(wakaStore);                                                       ║
 * ║                                                                                  ║
 * ║    const store = wakaStore.createStore({ user: { name: 'Floris' } });            ║
 * ║                                                                                  ║
 * ║    // Mount under any key name                                                   ║
 * ║    wakaPAC('#header', { user: store });                                          ║
 * ║    wakaPAC('#cart',   { shopData: store });                                      ║
 * ║                                                                                  ║
 * ║    // In templates: {{user.name}}  or  {{shopData.name}}                         ║
 * ║                                                                                  ║
 * ║    // Direct mutation also propagates correctly:                                 ║
 * ║    store.user.name = 'Jan';                                                      ║
 * ║                                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    "use strict";

    const VERSION = '1.0.0';

    /**
     * The custom event name fired on document when store state changes.
     * Components listen for this event to trigger local DOM updates.
     * @type {string}
     */
    const STORE_CHANGE_EVENT = 'pac:store-change';

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
    }

    WakaStore.prototype = {
        constructor: WakaStore,

        /**
         * Creates a wakaPAC plugin descriptor.
         *
         * When registered via wakaPAC.use(wakaStore), this method is called
         * automatically. The returned descriptor hooks into component lifecycle
         * to listen for pac:store-change events on document and re-dispatch
         * them as pac:change on each container that holds a reference to the
         * changed store.
         *
         * The store proxy is responsible for firing pac:store-change on document
         * whenever any store property changes — regardless of whether the mutation
         * came from a component abstraction or directly on the store object.
         * The plugin's only job is translating those events into per-container
         * pac:change events that wakaPAC's existing DOM update machinery handles.
         *
         * @param {Object} pac - The wakaPAC object, passed by wakaPAC.use()
         * @returns {Object} Plugin descriptor with onComponentCreated, onComponentDestroyed
         */
        createPacPlugin(pac) {
            /**
             * Registry of all active components that hold at least one store reference.
             * Maps pacId -> Array<{ key: string, storeId: string }>
             * key     = the abstraction property name the store is mounted under
             * storeId = the store's unique identifier (_wakaStoreId)
             * @type {Map<string, Array<{key: string, storeId: string}>>}
             */
            const componentStores = new Map();

            /**
             * Reverse index: storeId -> Set<pacId>.
             * Allows O(1) lookup of all components sharing a given store.
             * @type {Map<string, Set<string>>}
             */
            const storeSubscribers = new Map();

            /**
             * Scans an abstraction for properties that are store proxies
             * created by wakaStore.createStore(), identified by _wakaStoreId.
             *
             * @param  {Object} abstraction
             * @returns {Array<{key: string, storeId: string}>}
             */
            function findStoreReferences(abstraction) {
                const entries = [];

                for (const key of Object.keys(abstraction)) {
                    const val = abstraction[key];

                    if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, '_wakaStoreId')) {
                        entries.push({ key: key, storeId: val._wakaStoreId });
                    }
                }

                return entries;
            }

            /**
             * Handles pac:store-change events fired by any store proxy.
             * Looks up all components that reference the changed store and
             * dispatches a synthetic pac:change on each container, translating
             * the store-relative path to the component's mounted key name.
             *
             * @param {CustomEvent} event
             * @param {string} event.detail.storeId  - ID of the store that changed
             * @param {Array}  event.detail.path     - Property path within the store
             * @param {*}      event.detail.oldValue
             * @param {*}      event.detail.newValue
             */
            function onStoreChange(event) {
                if (!event.detail) {
                    return;
                }

                const { storeId, path, oldValue, newValue, method } = event.detail;

                const subscribers = storeSubscribers.get(storeId);

                if (!subscribers) {
                    return;
                }

                subscribers.forEach(function(pacId) {
                    const entries = componentStores.get(pacId);

                    if (!entries) {
                        return;
                    }

                    const entry = entries.find(e => e.storeId === storeId);

                    if (!entry) {
                        return;
                    }

                    const container = pac.getContainerByPacId(pacId);

                    if (!container) {
                        return;
                    }

                    // Translate the store-relative path to the abstraction-relative path.
                    // e.g. store path ['user', 'name'] mounted as 'shopData'
                    // -> pac:change path ['shopData', 'user', 'name']
                    const translatedPath = [entry.key].concat(path);

                    // For array mutations, fire pac:array-change first so wakaPAC's
                    // diffing machinery can attempt a minimal DOM update before the
                    // general pac:change triggers any remaining bindings.
                    if (method) {
                        container.dispatchEvent(new CustomEvent('pac:array-change', {
                            detail: {
                                path: translatedPath,
                                oldValue: oldValue,
                                newValue: newValue,
                                method: method
                            }
                        }));
                    }

                    container.dispatchEvent(new CustomEvent('pac:change', {
                        detail: {
                            path: translatedPath,
                            oldValue: oldValue,
                            newValue: newValue
                        }
                    }));
                });
            }

            // Single document-level listener handles all store changes for all components
            document.addEventListener(STORE_CHANGE_EVENT, onStoreChange);

            return {
                /**
                 * Called by wakaPAC after each new component is created.
                 * Scans the abstraction for store references and registers them
                 * in the forward and reverse indexes.
                 *
                 * Store references are assumed to be static after mount. Reassigning
                 * a store property on the abstraction after component creation will
                 * not be detected — the new store will not propagate and the old
                 * registration remains active. If dynamic store replacement is needed,
                 * destroy and recreate the component.
                 *
                 * @param {Object} abstraction - The component's reactive data model
                 * @param {string} pacId       - The component's data-pac-id
                 */
                onComponentCreated(abstraction, pacId) {
                    const storeEntries = findStoreReferences(abstraction);

                    if (storeEntries.length === 0) {
                        return;
                    }

                    const container = pac.getContainerByPacId(pacId);

                    if (!container) {
                        return;
                    }

                    // Register this component's store associations
                    componentStores.set(pacId, storeEntries);

                    // Populate the reverse index for each store this component references
                    storeEntries.forEach(function(entry) {
                        if (!storeSubscribers.has(entry.storeId)) {
                            storeSubscribers.set(entry.storeId, new Set());
                        }

                        storeSubscribers.get(entry.storeId).add(pacId);
                    });
                },

                /**
                 * Called by wakaPAC when a component is removed from the DOM.
                 * Removes the component from both indexes.
                 *
                 * @param {string} pacId - The component's data-pac-id
                 */
                onComponentDestroyed(pacId) {
                    const entries = componentStores.get(pacId);

                    if (entries) {
                        entries.forEach(function(entry) {
                            const subscribers = storeSubscribers.get(entry.storeId);

                            if (subscribers) {
                                subscribers.delete(pacId);

                                // Clean up empty subscriber sets
                                if (subscribers.size === 0) {
                                    storeSubscribers.delete(entry.storeId);
                                }
                            }
                        });
                    }

                    componentStores.delete(pacId);
                }
            };
        },

        /**
         * Creates a new reactive store from a plain object.
         *
         * Returns a proxy that intercepts all mutations and fires pac:store-change
         * on document, carrying the changed path and values. This ensures that
         * direct mutations on the store (store.user.name = 'Jan') propagate to
         * all mounted components, not just mutations made through a component proxy.
         *
         * The proxy's only responsibility is event dispatch — all DOM reactivity
         * is handled by wakaPAC's existing pac:change machinery in each component.
         *
         * Store references are assumed to be static after mount. Reassigning a
         * store property on the abstraction after component creation (e.g.
         * abstraction.user = newStore) will not be detected by the plugin.
         * If dynamic store replacement is needed, destroy and recreate the component.
         *
         * @param {Object} initialState - Plain object representing initial store state
         * @returns {Proxy} Reactive store proxy
         */
        createStore(initialState) {
            if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
                throw new Error('wakaStore.createStore(): initialState must be a plain object');
            }

            const storeId = 'store-' + (this._nextStoreId++);

            /**
             * Guards against re-entrant mutations (e.g. a pac:store-change handler
             * that itself modifies the store). Scoped to this store instance.
             * @type {boolean}
             */
            let dispatching = false;

            /**
             * Fires pac:store-change on document for a mutation at the given path.
             * Guarded by dispatching flag to prevent infinite loops.
             *
             * @param {Array}  path
             * @param {*}      oldValue
             * @param {*}      newValue
             * @param {string} [method] - Array method name if the change came from an array mutation
             */
            function dispatchChange(path, oldValue, newValue, method) {
                if (dispatching) {
                    console.warn(
                        'wakaStore: re-entrant mutation detected at path [' +
                        path.join('.') + ']. Mutation ignored to prevent infinite loop.'
                    );
                    return;
                }

                dispatching = true;

                try {
                    document.dispatchEvent(new CustomEvent(STORE_CHANGE_EVENT, {
                        detail: {
                            storeId: storeId,
                            path: path,
                            oldValue: oldValue,
                            newValue: newValue,
                            method: method || null
                        }
                    }));
                } finally {
                    dispatching = false;
                }
            }

            /**
             * Recursively wraps an object or array in a reactive proxy.
             * Each nested proxy carries the correct path from the store root.
             * Properties prefixed with _ or $ are treated as non-reactive,
             * mirroring wakaPAC's own convention for internal/non-reactive data.
             *
             * @param {Object|Array} obj
             * @param {Array}        currentPath - Path from store root to this object
             * @returns {Proxy}
             */
            function createProxy(obj, currentPath) {

                /**
                 * Returns true if the property should trigger reactivity.
                 * Properties starting with _ or $ are excluded, allowing components
                 * to store DOM references, internal flags, or other non-reactive
                 * data on the store without triggering DOM updates.
                 * @param {string|symbol} prop
                 * @returns {boolean}
                 */
                function shouldMakeReactive(prop) {
                    return typeof prop === 'string' && !prop.startsWith('_') && !prop.startsWith('$');
                }

                return new Proxy(obj, {

                    get(target, prop) {
                        const val = target[prop];

                        // Intercept mutating array methods
                        if (Array.isArray(target) && typeof val === 'function') {
                            const MUTATING_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

                            if (MUTATING_METHODS.includes(prop)) {
                                return function () {
                                    const oldArray = target.slice();
                                    const result = Array.prototype[prop].apply(target, arguments);
                                    dispatchChange(currentPath, oldArray, target.slice(), prop);
                                    return result;
                                };
                            }
                        }

                        // Lazily wrap nested objects and arrays, but only for reactive properties
                        if (shouldMakeReactive(prop) && val && typeof val === 'object') {
                            return createProxy(val, currentPath.concat([prop]));
                        }

                        return val;
                    },

                    set(target, prop, newValue) {
                        const oldValue = target[prop];

                        if (oldValue === newValue) {
                            return true;
                        }

                        target[prop] = newValue;

                        // Only dispatch change events for reactive properties
                        if (shouldMakeReactive(prop)) {
                            dispatchChange(currentPath.concat([prop]), oldValue, newValue);
                        }

                        return true;
                    },

                    deleteProperty(target, prop) {
                        if (!(prop in target)) {
                            return true;
                        }

                        const oldValue = target[prop];

                        delete target[prop];

                        // Only dispatch change events for reactive properties
                        if (shouldMakeReactive(prop)) {
                            dispatchChange(currentPath.concat([prop]), oldValue, undefined);
                        }

                        return true;
                    }
                });
            }

            const proxy = createProxy(initialState, []);

            // Tag the proxy so the plugin can identify it as a store reference.
            // Non-enumerable so it does not appear in template bindings or for..in loops.
            Object.defineProperty(initialState, '_wakaStoreId', {
                value: storeId,
                enumerable: false,
                writable: false,
                configurable: false
            });

            return proxy;
        }
    };

    // Static version property
    WakaStore.VERSION = VERSION;

    // Create default instance
    const wakaStore = new WakaStore();

    /* globals module, define */
    // UMD export: CommonJS, AMD, and browser global
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