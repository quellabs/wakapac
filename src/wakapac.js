/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║    ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗  █████╗  ██████╗                        ║
 * ║    ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔════╝                        ║
 * ║    ██║ █╗ ██║███████║█████╔╝ ███████║██████╔╝███████║██║                             ║
 * ║    ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔═══╝ ██╔══██║██║                             ║
 * ║    ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║     ██║  ██║╚██████╗                        ║
 * ║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝                        ║
 * ║                                                                                      ║
 * ║  PAC Framework - Presentation-Abstraction-Control for JavaScript                     ║
 * ║                                                                                      ║
 * ║  A powerful reactive framework that creates hierarchical components with two-way     ║
 * ║  data binding, event handling, and automatic DOM synchronization. Supports           ║
 * ║  deep reactivity for arrays and nested objects!                                      ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    'use strict';

    /**
     * Utility functions - Consolidated helper methods for the framework
     */
    const U = {
        // Check if Proxy is supported in the current environment
        PROXY: typeof Proxy !== 'undefined',

        /**
         * Determines if a value should be made reactive
         * @param {*} v - Value to test
         * @returns {boolean} - True if value should be reactive
         */
        isReactive: v => v && typeof v === 'object' && !v.nodeType &&
            !(v instanceof Date) && !(v instanceof RegExp) && !(v instanceof File),

        /**
         * Deep equality comparison for objects and arrays
         * @param {*} a - First value
         * @param {*} b - Second value
         * @returns {boolean} - True if values are deeply equal
         */
        deepEq: (a, b) => {
            if (a === b) {
                return true;
            }

            if (!a || !b || typeof a !== typeof b) {
                return false;
            }

            if (typeof a !== 'object') {
                return false;
            }

            const ka = Object.keys(a), kb = Object.keys(b);

            if (ka.length !== kb.length) {
                return false;
            }

            for (let i = 0; i < ka.length; i++) {
                const k = ka[i];

                if (!kb.includes(k) || !U.deepEq(a[k], b[k])) {
                    return false;
                }
            }
            return true;
        },

        /**
         * Generates a unique identifier
         * @returns {string} - Unique ID string
         */
        id: () => Date.now() + '_' + (Math.random() * 10000 | 0),

        /**
         * Checks if a string represents a DOM event type
         * @param {string} t - Event type to test
         * @returns {boolean} - True if it's a valid event type
         */
        isEvent: t => /^(click|submit|change|input|focus|blur|key(up|down))$/.test(t)
    };

    /**
     * Registry - Manages PAC units and their hierarchical relationships
     * Handles parent-child relationships between components and caches hierarchy lookups
     */
    function Registry() {
        this.units = new Map(); // Map of selector -> PAC unit
        this.cache = new WeakMap(); // Cache for hierarchy lookups
    }

    Registry.prototype = {
        /**
         * Registers a new PAC unit
         * @param {string} sel - CSS selector for the unit
         * @param {Object} unit - The PAC unit control object
         */
        register(sel, unit) {
            this.units.set(sel, unit);
            this.cache = new WeakMap(); // Clear cache when units change
        },

        /**
         * Unregisters a PAC unit
         * @param {string} sel - CSS selector for the unit to remove
         * @returns {Object|undefined} - The removed unit
         */
        unregister(sel) {
            const unit = this.units.get(sel);
            if (unit) {
                this.units.delete(sel);
                this.cache = new WeakMap(); // Clear cache when units change
            }
            return unit;
        },

        /**
         * Gets the hierarchy (parent and children) for a given container
         * @param {Element} container - DOM element to find hierarchy for
         * @returns {Object} - Object with parent and children properties
         */
        getHierarchy(container) {
            // Check cache first for performance
            if (this.cache.has(container)) {
                return this.cache.get(container);
            }

            let parent = null;
            const children = [];
            let el = container.parentElement;

            // Walk up the DOM tree to find parent PAC unit
            while (el && !parent) {
                this.units.forEach(unit => {
                    if (unit.container === el) {
                        parent = unit;
                    }
                });
                el = el.parentElement;
            }

            // Find all child PAC units within this container
            this.units.forEach(unit => {
                if (container.contains(unit.container) && unit.container !== container) {
                    children.push(unit);
                }
            });

            const hierarchy = {parent, children};
            this.cache.set(container, hierarchy); // Cache the result
            return hierarchy;
        }
    };

    // Global registry instance
    window.PACRegistry = window.PACRegistry || new Registry();

    /**
     * Creates a reactive proxy or fallback for an object
     * Handles deep reactivity and change notifications
     * @param {Object} target - Object to make reactive
     * @param {Function} onChange - Callback for changes
     * @param {string} path - Current property path for nested objects
     * @returns {Object} - Reactive version of the target
     */
    function createReactive(target, onChange, path = '') {
        if (!U.isReactive(target)) {
            return target;
        }

        // Use Proxy if available, otherwise fall back to Object.defineProperty
        if (U.PROXY) {
            return createProxy(target, onChange, path);
        }
        return createFallback(target, onChange, path);
    }

    /**
     * Creates a reactive proxy using ES6 Proxy
     * @param {Object} target - Object to make reactive
     * @param {Function} onChange - Change callback
     * @param {string} path - Property path
     * @returns {Proxy} - Proxied reactive object
     */
    function createProxy(target, onChange, path) {
        // Make nested objects reactive recursively
        for (const k in target) {
            if (target.hasOwnProperty(k) && U.isReactive(target[k])) {
                target[k] = createReactive(target[k], onChange, path ? `${path}.${k}` : k);
            }
        }

        const isArr = Array.isArray(target);
        const methods = {};

        // Store original array methods for mutation tracking
        if (isArr) {
            ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(m => {
                methods[m] = target[m];
            });
        }

        return new Proxy(target, {
            /**
             * Proxy get trap - handles property access and array method calls
             */
            get(obj, prop) {
                // Handle array mutation methods
                if (isArr && methods[prop]) {
                    return function (...args) {
                        const result = methods[prop].apply(obj, args);

                        // Make new items reactive for mutation methods
                        if (/^(push|unshift|splice)$/.test(prop)) {
                            for (let i = 0; i < obj.length; i++) {
                                if (U.isReactive(obj[i]) && !obj[i]._reactive) {
                                    obj[i] = createReactive(obj[i], onChange, `${path}.${i}`);
                                }
                            }
                        }

                        // Notify of array mutation
                        onChange(path || 'root', obj, 'array-mutation', {method: prop, args});
                        return result;
                    };
                }
                return obj[prop];
            },

            /**
             * Proxy set trap - handles property assignment
             */
            set(obj, prop, val) {
                const old = obj[prop];

                // Make new value reactive if needed
                if (U.isReactive(val)) {
                    val = createReactive(val, onChange, path ? `${path}.${prop}` : prop);
                }

                obj[prop] = val;

                // Only notify if value actually changed
                if (!U.deepEq(old, val)) {
                    onChange(path ? `${path}.${prop}` : prop, val, 'set', {old});
                }
                return true;
            },

            /**
             * Proxy deleteProperty trap - handles property deletion
             */
            deleteProperty(obj, prop) {
                const old = obj[prop];
                delete obj[prop];
                onChange(path ? `${path}.${prop}` : prop, undefined, 'delete', {old});
                return true;
            }
        });
    }

    /**
     * Fallback reactivity using Object.defineProperty for older browsers
     * @param {Object} target - Object to make reactive
     * @param {Function} onChange - Change callback
     * @param {string} path - Property path
     * @returns {Object} - Reactive object
     */
    function createFallback(target, onChange, path) {
        // Handle array mutation methods
        if (Array.isArray(target)) {
            ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(m => {
                const orig = target[m];
                Object.defineProperty(target, m, {
                    value: function (...args) {
                        const result = orig.apply(this, args);
                        // Make new items reactive for mutation methods
                        if (/^(push|unshift|splice)$/.test(m)) {
                            for (let i = 0; i < this.length; i++) {
                                if (U.isReactive(this[i]) && !this[i]._reactive) {
                                    this[i] = createReactive(this[i], onChange, `${path}.${i}`);
                                }
                            }
                        }
                        onChange(path || 'root', this, 'array-mutation', {method: m, args});
                        return result;
                    },
                    enumerable: false,
                    configurable: true
                });
            });
        }

        // Make nested objects reactive
        for (const k in target) {
            if (target.hasOwnProperty(k) && U.isReactive(target[k])) {
                target[k] = createReactive(target[k], onChange, path ? `${path}.${k}` : k);
            }
        }

        // Mark as reactive to avoid double-processing
        Object.defineProperty(target, '_reactive', {value: true, enumerable: false});
        return target;
    }

    /**
     * Main PAC Factory - Creates and manages PAC units
     * @param {string} selector - CSS selector for the container element
     * @param {Object} abstraction - Data and methods for the component
     * @param {Object} options - Configuration options
     * @returns {Object} - Public API for the PAC unit
     */
    function wakaPAC(selector, abstraction = {}, options = {}) {
        const container = document.querySelector(selector);
        if (!container) {
            throw new Error(`Container not found: ${selector}`);
        }

        // Merge default configuration with user options
        const config = Object.assign({
            updateMode: 'immediate', // immediate, delayed, or change
            delay: 300, // Delay for 'delayed' update mode
            deepReactivity: true // Enable deep object reactivity
        }, options);

        /**
         * Control object - Internal management of the PAC unit
         * Handles bindings, reactivity, DOM updates, and communication
         */
        const control = {
            bindings: new Map(), // Map of binding ID -> binding config
            container, // DOM container element
            abstraction: null, // Reactive abstraction object
            delays: new Map(), // Map of delayed update timeouts
            parent: null, // Parent PAC unit
            children: new Set(), // Set of child PAC units
            listeners: new Map(), // Map of event type -> handler function
            pending: null, // Set of properties pending DOM update
            pendingVals: null, // Values for pending updates
            orig: abstraction, // Original abstraction object
            config, // Configuration options
            computedCache: new Map(), // Cache for computed property values
            computedDeps: new Map(), // Map of computed property -> dependencies
            propDeps: new Map(), // Map of property -> dependent computed properties

            /**
             * Updates a foreach binding with new array data
             * @param {Object} binding - The foreach binding configuration
             * @param {string} prop - Property name that changed
             * @param {Array} val - New array value
             */
            updateForeach(binding, prop, val) {
                if (binding.collection !== prop) {
                    return;
                }

                let arr = val;
                if (!Array.isArray(arr)) {
                    console.warn('Foreach expects array, got:', typeof arr);
                    binding.element.innerHTML = '';
                    binding.prev = [];
                    return;
                }

                const prev = binding.prev || [];
                const curr = Array.from(arr);

                // Skip update if arrays are identical
                if (curr === prev) {
                    return;
                }
                if (this.arrEq(prev, curr)) {
                    binding.prev = [...curr];
                    return;
                }

                binding.prev = [...curr];
                const el = binding.element;
                el.innerHTML = ''; // Clear existing content

                // Render each item in the array
                curr.forEach((item, i) => {
                    const itemEl = this.renderItem(binding.template, item, i, binding.itemName, binding.indexName);
                    el.appendChild(itemEl);
                });
            },

            /**
             * Renders a single item template with data binding
             * @param {string} tmpl - HTML template string
             * @param {*} item - Data item to bind
             * @param {number} idx - Index of the item
             * @param {string} itemName - Variable name for the item
             * @param {string} idxName - Variable name for the index
             * @returns {Element} - Rendered DOM element
             */
            renderItem(tmpl, item, idx, itemName, idxName) {
                const div = document.createElement('div');
                div.innerHTML = tmpl;
                const el = div.firstElementChild || div.firstChild;
                if (!el) {
                    return document.createTextNode('');
                }

                const clone = el.cloneNode(true);
                this.processText(clone, item, idx, itemName, idxName);
                this.processAttrs(clone, item, idx, itemName, idxName);
                return clone;
            },

            /**
             * Shallow array equality check for optimization
             * @param {Array} a - First array
             * @param {Array} b - Second array
             * @returns {boolean} - True if arrays are equal
             */
            arrEq(a, b) {
                if (a.length !== b.length) {
                    return false;
                }
                for (let i = 0; i < a.length; i++) {
                    if (!U.deepEq(a[i], b[i])) {
                        return false;
                    }
                }
                return true;
            },

            /**
             * Processes text nodes in a template, replacing variable placeholders
             * @param {Element} el - Element to process
             * @param {*} item - Data item
             * @param {number} idx - Item index
             * @param {string} itemName - Item variable name
             * @param {string} idxName - Index variable name
             */
            processText(el, item, idx, itemName, idxName) {
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                const nodes = [];
                let node;
                // Collect all text nodes first to avoid walker issues
                while (node = walker.nextNode()) {
                    nodes.push(node);
                }

                nodes.forEach(n => {
                    let txt = n.textContent;
                    // Replace item property references: {{item.property}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\.(\\w+)\\s*\\}\\}`, 'g'), (m, p) =>
                        item && item.hasOwnProperty(p) ? item[p] : '');
                    // Replace item references: {{item}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\s*\\}\\}`, 'g'), () =>
                        typeof item === 'object' ? JSON.stringify(item) : item || '');
                    // Replace index references: {{index}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${idxName}\\s*\\}\\}`, 'g'), () => idx);
                    n.textContent = txt;
                });
            },

            /**
             * Processes attributes and bindings in a template
             * @param {Element} el - Element to process
             * @param {*} item - Data item
             * @param {number} idx - Item index
             * @param {string} itemName - Item variable name
             * @param {string} idxName - Index variable name
             */
            processAttrs(el, item, idx, itemName, idxName) {
                const bindable = [el, ...el.querySelectorAll('[data-pac-bind]')];

                bindable.forEach(e => {
                    const bind = e.getAttribute('data-pac-bind');
                    if (!bind) {
                        return;
                    }

                    // Process each binding (comma-separated)
                    bind.split(',').forEach(b => {
                        const [type, target] = b.trim().split(':').map(s => s.trim());

                        if (U.isEvent(type)) {
                            // Event binding: click:methodName
                            e.addEventListener(type, ev => {
                                if (typeof this.abstraction[target] === 'function') {
                                    this.abstraction[target].call(this.abstraction, item, idx, ev);
                                }
                            });
                        } else if (type === 'class') {
                            // Class binding: class:condition
                            if (this.evalExpr(target, item, idx, itemName, idxName)) {
                                e.classList.add(target.includes('.') ? target.split('.').pop() : target);
                            }
                        } else if (type === 'checked') {
                            // Checkbox binding: checked:condition
                            e.checked = !!this.evalExpr(target, item, idx, itemName, idxName);
                        } else {
                            // Attribute binding: attr:value
                            const val = this.evalExpr(target, item, idx, itemName, idxName);
                            if (val != null) {
                                e.setAttribute(type, val);
                            }
                        }
                    });
                });
            },

            /**
             * Evaluates an expression in the context of item data
             * @param {string} expr - Expression to evaluate
             * @param {*} item - Data item
             * @param {number} idx - Item index
             * @param {string} itemName - Item variable name
             * @param {string} idxName - Index variable name
             * @returns {*} - Evaluated result
             */
            evalExpr(expr, item, idx, itemName, idxName) {
                if (expr === idxName) {
                    return idx;
                }
                if (expr === itemName) {
                    return item;
                }
                if (expr.startsWith(`${itemName}.`)) {
                    // Navigate object path: item.property.subproperty
                    const path = expr.substring(itemName.length + 1).split('.');
                    let val = item;
                    for (const p of path) {
                        if (val && val.hasOwnProperty(p)) {
                            val = val[p];
                        } else {
                            return undefined;
                        }
                    }
                    return val;
                }
                return expr;
            },

            /**
             * Handles deep property changes in reactive objects
             * @param {string} path - Property path that changed
             * @param {*} val - New value
             * @param {string} type - Type of change (set, delete, array-mutation)
             * @param {Object} meta - Additional change metadata
             */
            handleDeepChange(path, val, type, meta) {
                const root = path.split('.')[0];
                this.updateComputed(root); // Update any computed properties

                // Update DOM if this is a root property or array mutation
                if (type === 'array-mutation' || this.abstraction.hasOwnProperty(root)) {
                    this.updateDOM(root, this.abstraction[root]);
                }

                // Notify parent of the change
                this.notifyParent('propertyChange', {property: root, path, newValue: val, changeType: type, meta});
            },

            /**
             * Queues a DOM update for a property (batched for performance)
             * @param {string} prop - Property name
             * @param {*} val - New value
             */
            updateDOM(prop, val) {
                if (!this.pending) {
                    this.pending = new Set();
                    this.pendingVals = {};

                    // Batch updates using requestAnimationFrame
                    (window.requestAnimationFrame || (f => setTimeout(f, 0)))(() => this.flushDOM());
                }

                this.pending.add(prop);
                this.pendingVals[prop] = val;
            },

            /**
             * Flushes all pending DOM updates
             */
            flushDOM() {
                if (!this.pending) {
                    return;
                }

                this.pending.forEach(prop => {
                    const val = this.pendingVals[prop];

                    // Update all bindings for this property
                    this.bindings.forEach(binding => {
                        if (binding.property !== prop && binding.type !== 'foreach') {
                            return;
                        }

                        switch (binding.type) {
                            case 'text':
                                this.updateText(binding, prop, val);
                                break;
                            case 'attribute':
                                binding.element.setAttribute(binding.attribute, val);
                                break;
                            case 'input':
                                if (binding.element.value !== val) {
                                    binding.element.value = val;
                                }
                                break;
                            case 'visible':
                                this.updateVisible(binding, val);
                                break;
                            case 'foreach':
                                this.updateForeach(binding, prop, val);
                                break;
                        }
                    });
                });

                // Clear pending updates
                this.pending = null;
                this.pendingVals = null;
            },

            /**
             * Updates element visibility based on a condition
             * @param {Object} binding - Visibility binding configuration
             * @param {*} val - Value to test for visibility
             */
            updateVisible(binding, val) {
                const el = binding.element;
                const show = binding.condition.startsWith('!') ? !val : !!val;

                if (show) {
                    // Show element
                    if (el.hasAttribute('data-pac-hidden')) {
                        el.style.display = el.getAttribute('data-pac-orig-display') || '';
                        el.removeAttribute('data-pac-hidden');
                        el.removeAttribute('data-pac-orig-display');
                    }
                } else {
                    // Hide element
                    if (!el.hasAttribute('data-pac-hidden')) {
                        const orig = getComputedStyle(el).display;
                        if (orig !== 'none') {
                            el.setAttribute('data-pac-orig-display', orig);
                        }
                        el.style.display = 'none';
                        el.setAttribute('data-pac-hidden', 'true');
                    }
                }
            },

            /**
             * Updates text content with interpolated values
             * @param {Object} binding - Text binding configuration
             * @param {string} prop - Property name
             * @param {*} val - New value
             */
            updateText(binding, prop, val) {
                const regex = new RegExp(`\\{\\{\\s*${prop}\\s*\\}\\}`, 'g');
                let display = val;

                // Format different value types for display
                if (typeof val === 'object' && val !== null) {
                    display = Array.isArray(val) ? `[${val.length} items]` : JSON.stringify(val, null, 2);
                } else if (val == null) {
                    display = '';
                }

                const txt = binding.origText.replace(regex, display);
                (binding.textNode || binding.element).textContent = txt;
            },

            /**
             * Analyzes a computed function to find its dependencies
             * @param {Function} fn - Computed function to analyze
             * @returns {Array} - Array of property names the function depends on
             */
            analyzeComputed(fn) {
                const deps = [];
                const src = fn.toString();
                const regex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
                let match;

                // Find all 'this.property' references in the function
                while ((match = regex.exec(src))) {
                    const prop = match[1];
                    if (this.orig.hasOwnProperty(prop) && !deps.includes(prop)) {
                        deps.push(prop);
                    }
                }
                return deps;
            },

            /**
             * Updates computed properties that depend on a changed property
             * @param {string} changed - Name of the property that changed
             */
            updateComputed(changed) {
                const deps = this.propDeps.get(changed) || [];

                deps.forEach(computed => {
                    const old = this.computedCache.get(computed);
                    const fn = this.orig.computed[computed];
                    const val = fn.call(this.abstraction);

                    // Check if we need foreach updates or value actually changed
                    const hasArray = Array.from(this.bindings.values()).some(b =>
                        b.type === 'foreach' && b.collection === computed);

                    if (hasArray || !U.deepEq(old, val)) {
                        this.computedCache.set(computed, val);
                        this.updateDOM(computed, val);
                        this.notifyParent('propertyChange', {
                            property: computed,
                            oldValue: old,
                            newValue: val,
                            computed: true
                        });
                        this.updateComputed(computed); // Handle cascading computed updates
                    }
                });
            },

            /**
             * Creates the reactive abstraction object with getters/setters
             * @returns {Object} - Reactive abstraction object
             */
            createReactiveAbs() {
                const reactive = {};

                // Set up computed properties
                if (this.orig.computed) {
                    for (const name in this.orig.computed) {
                        const fn = this.orig.computed[name];
                        if (typeof fn === 'function') {
                            const deps = this.analyzeComputed(fn);
                            this.computedDeps.set(name, deps);

                            // Build reverse dependency map
                            deps.forEach(dep => {
                                if (!this.propDeps.has(dep)) {
                                    this.propDeps.set(dep, []);
                                }
                                this.propDeps.get(dep).push(name);
                            });

                            // Define computed property with getter
                            Object.defineProperty(reactive, name, {
                                get: () => {
                                    if (this.computedCache.has(name)) {
                                        return this.computedCache.get(name);
                                    }
                                    const val = fn.call(reactive);
                                    this.computedCache.set(name, val);
                                    return val;
                                },
                                enumerable: true
                            });
                        }
                    }
                }

                // Set up regular properties
                for (const key in this.orig) {
                    if (this.orig.hasOwnProperty(key) && key !== 'computed') {
                        const val = this.orig[key];
                        if (typeof val === 'function') {
                            // Bind methods to reactive object
                            reactive[key] = val.bind(reactive);
                        } else {
                            // Create reactive property
                            this.createReactiveProp(reactive, key, val);
                        }
                    }
                }

                // Add communication methods
                reactive.notifyParent = (type, data) => this.notifyParent(type, data);
                reactive.sendToChildren = (cmd, data) => this.sendToChildren(cmd, data);
                reactive.findChild = pred => Array.from(this.children).find(pred);

                return reactive;
            },

            /**
             * Creates a reactive property with getter/setter
             * @param {Object} obj - Object to add property to
             * @param {string} key - Property name
             * @param {*} init - Initial value
             */
            createReactiveProp(obj, key, init) {
                let val = init;

                // Make initial value reactive if needed
                if (this.config.deepReactivity && U.isReactive(val)) {
                    val = createReactive(val, (path, newVal, type, meta) =>
                        this.handleDeepChange(path, newVal, type, meta), key);
                }

                Object.defineProperty(obj, key, {
                    get: () => val,
                    set: newVal => {
                        const isObj = U.isReactive(val) || U.isReactive(newVal);
                        if (isObj || !U.deepEq(val, newVal)) {
                            const old = val;

                            // Make new value reactive if needed
                            if (this.config.deepReactivity && U.isReactive(newVal)) {
                                newVal = createReactive(newVal, (path, changedVal, type, meta) =>
                                    this.handleDeepChange(path, changedVal, type, meta), key);
                            }

                            val = newVal;
                            this.updateDOM(key, newVal);
                            this.updateComputed(key);
                            this.notifyParent('propertyChange', {property: key, oldValue: old, newValue: newVal});
                        }
                    },
                    enumerable: true
                });
            },

            /**
             * Sends a command to all child PAC units
             * @param {string} cmd - Command name
             * @param {*} data - Command data
             */
            sendToChildren(cmd, data) {
                this.children.forEach(child => {
                    if (typeof child.receiveFromParent === 'function') {
                        child.receiveFromParent(cmd, data);
                    }
                });
            },

            /**
             * Sets up data bindings by scanning the DOM
             */
            setupBindings() {
                this.findTextBindings();
                this.findAttrBindings();
            },

            /**
             * Finds and sets up text interpolation bindings {{property}}
             */
            findTextBindings() {
                const walker = document.createTreeWalker(this.container, NodeFilter.SHOW_TEXT);
                const bindings = [];
                let node;

                while (node = walker.nextNode()) {
                    const txt = node.textContent;
                    const matches = txt.match(/\{\{\s*(\w+)\s*\}\}/g);

                    if (matches) {
                        matches.forEach(match => {
                            const prop = match.replace(/[{}\s]/g, '');
                            bindings.push([U.id(), {
                                type: 'text',
                                property: prop,
                                element: node.parentElement,
                                origText: txt,
                                textNode: node
                            }]);
                        });
                    }
                }

                bindings.forEach(([key, binding]) => this.bindings.set(key, binding));
            },

            /**
             * Finds and sets up attribute bindings data-pac-bind="..."
             */
            findAttrBindings() {
                // Exclude bindings inside foreach templates
                const elements = this.container.querySelectorAll('[data-pac-bind]:not([data-pac-bind*="foreach"] [data-pac-bind])');
                const bindings = [];

                Array.from(elements).forEach(el => {
                    const bindStr = el.getAttribute('data-pac-bind');

                    bindStr.split(',').forEach(bind => {
                        const [type, target] = bind.trim().split(':').map(s => s.trim());
                        const key = `${bind}_${U.id()}`;

                        if (type === 'foreach') {
                            // Foreach binding: foreach:arrayProperty
                            bindings.push([key, {
                                type: 'foreach',
                                property: target,
                                collection: target,
                                itemName: el.getAttribute('data-pac-item') || 'item',
                                indexName: el.getAttribute('data-pac-index') || 'index',
                                template: el.innerHTML,
                                element: el
                            }]);
                            el.innerHTML = ''; // Clear template content
                        } else if (U.isEvent(type)) {
                            // Event binding: click:methodName
                            bindings.push([key, {type: 'event', event: type, method: target, element: el}]);
                        } else if (type === 'visible') {
                            // Visibility binding: visible:property or visible:!property
                            bindings.push([key, {
                                type: 'visible',
                                property: target.replace(/^!/, ''),
                                element: el,
                                condition: target
                            }]);
                        } else if (bind.indexOf(':') !== -1) {
                            // Attribute binding: attribute:property
                            bindings.push([key, {type: 'attribute', property: target, element: el, attribute: type}]);
                        } else {
                            // Input binding: propertyName
                            this.setupInput(el, bind.trim());
                            bindings.push([key, {
                                type: 'input',
                                property: bind.trim(),
                                element: el,
                                updateMode: el.getAttribute('data-pac-update-mode') || this.config.updateMode,
                                delay: parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay
                            }]);
                        }
                    });
                });

                bindings.forEach(([key, binding]) => this.bindings.set(key, binding));
            },

            /**
             * Sets up input element attributes for data binding
             * @param {Element} el - Input element
             * @param {string} prop - Property name to bind to
             */
            setupInput(el, prop) {
                el.setAttribute('data-pac-property', prop);
                el.setAttribute('data-pac-update-mode', el.getAttribute('data-pac-update') || this.config.updateMode);
                el.setAttribute('data-pac-update-delay', el.getAttribute('data-pac-delay') || this.config.delay);
            },

            /**
             * Sets up event listeners for the container
             */
            setupEvents() {
                const events = ['input', 'change', 'click', 'submit', 'focus', 'blur', 'keyup', 'keydown'];

                events.forEach(type => {
                    const handler = ev => this.handleEvent(ev);
                    this.container.addEventListener(type, handler);
                    this.listeners.set(type, handler);
                });
            },

            /**
             * Handles all DOM events for the container
             * @param {Event} ev - DOM event
             */
            handleEvent(ev) {
                const {type, target} = ev;
                const prop = target.getAttribute('data-pac-property');

                if (type === 'input' && prop && this.abstraction.hasOwnProperty(prop)) {
                    // Handle input events based on update mode
                    const mode = target.getAttribute('data-pac-update-mode') || this.config.updateMode;

                    if (mode === 'change') {
                        // Wait for change event
                        target.setAttribute('data-pac-pending-value', target.value);
                    } else if (mode === 'immediate') {
                        // Update immediately
                        this.abstraction[prop] = target.value;
                    } else if (mode === 'delayed') {
                        // Update after delay
                        this.updateFromDOM(target, prop, target.value);
                    }
                } else if (type === 'change' && prop && this.abstraction.hasOwnProperty(prop)) {
                    // Handle change events
                    const key = `${prop}_${target.getAttribute('data-pac-property')}`;
                    if (this.delays.has(key)) {
                        clearTimeout(this.delays.get(key));
                        this.delays.delete(key);
                    }
                    this.abstraction[prop] = target.value;
                    target.removeAttribute('data-pac-pending-value');
                } else {
                    // Handle event bindings (click, submit, etc.)
                    this.bindings.forEach(binding => {
                        if (binding.type === 'event' && binding.event === type && binding.element === target) {
                            const method = this.abstraction[binding.method];
                            if (typeof method === 'function') {
                                if (type === 'submit') {
                                    ev.preventDefault();
                                }
                                method.call(this.abstraction, ev);
                            }
                        }
                    });
                }
            },

            /**
             * Updates property from DOM input with configurable timing
             * @param {Element} el - Input element
             * @param {string} prop - Property name
             * @param {*} val - New value
             */
            updateFromDOM(el, prop, val) {
                const mode = el.getAttribute('data-pac-update-mode') || this.config.updateMode;
                const delay = parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay;

                if (mode === 'immediate') {
                    this.abstraction[prop] = val;
                    return;
                }

                if (mode === 'delayed') {
                    const key = `${prop}_${el.id || el.getAttribute('data-pac-property')}`;

                    // Clear existing timeout
                    if (this.delays.has(key)) {
                        clearTimeout(this.delays.get(key));
                    }

                    // Set new timeout
                    const id = setTimeout(() => {
                        this.abstraction[prop] = val;
                        this.delays.delete(key);
                    }, delay);

                    this.delays.set(key, id);
                }
            },

            /**
             * Establishes parent-child relationships with other PAC units
             */
            establishHierarchy() {
                const {parent, children} = window.PACRegistry.getHierarchy(this.container);

                // Set up parent relationship
                if (parent && this.parent !== parent) {
                    this.parent = parent;
                    parent.children.add(this);
                }

                // Set up child relationships
                children.forEach(child => {
                    if (child.parent !== this) {
                        if (child.parent) {
                            child.parent.children.delete(child);
                        }
                        child.parent = this;
                        this.children.add(child);
                    }
                });
            },

            /**
             * Notifies parent PAC unit of events
             * @param {string} type - Event type
             * @param {*} data - Event data
             */
            notifyParent(type, data) {
                if (this.parent && typeof this.parent.receiveUpdate === 'function') {
                    this.parent.receiveUpdate(type, data, this);
                }
            },

            /**
             * Receives updates from child PAC units
             * @param {string} type - Update type
             * @param {*} data - Update data
             * @param {Object} child - Child PAC unit that sent the update
             */
            receiveUpdate(type, data, child) {
                // Call user-defined handler if it exists
                if (this.abstraction.onChildUpdate) {
                    this.abstraction.onChildUpdate(type, data, child);
                }

                // Dispatch DOM event for additional handling
                this.container.dispatchEvent(new CustomEvent('pac:childupdate', {
                    detail: {eventType: type, data, childPAC: child},
                    bubbles: true
                }));
            },

            /**
             * Receives commands from parent PAC unit
             * @param {string} cmd - Command name
             * @param {*} data - Command data
             */
            receiveFromParent(cmd, data) {
                // Call user-defined handler if it exists
                if (this.abstraction.receiveFromParent) {
                    this.abstraction.receiveFromParent(cmd, data);
                }

                // Dispatch DOM event for additional handling
                this.container.dispatchEvent(new CustomEvent('pac:parentcommand', {
                    detail: {command: cmd, data},
                    bubbles: true
                }));
            },

            /**
             * Performs initial DOM update with all property values
             */
            initialUpdate() {
                // Update regular properties
                for (const key in this.abstraction) {
                    if (this.abstraction.hasOwnProperty(key) && typeof this.abstraction[key] !== 'function') {
                        this.updateDOM(key, this.abstraction[key]);
                    }
                }

                // Update computed properties
                if (this.orig.computed) {
                    for (const name in this.orig.computed) {
                        const val = this.abstraction[name];
                        this.updateDOM(name, val);
                    }
                }

                // Initialize foreach bindings
                this.bindings.forEach(binding => {
                    if (binding.type === 'foreach') {
                        binding.prev = [];
                        const val = this.abstraction[binding.collection];
                        if (val !== undefined) {
                            this.updateForeach(binding, binding.collection, val);
                        }
                    }
                });
            },

            /**
             * Cleans up the PAC unit and removes all listeners
             */
            destroy() {
                // Remove event listeners
                this.listeners.forEach((handler, type) => {
                    this.container.removeEventListener(type, handler);
                });

                // Clear all timeouts
                this.delays.forEach(id => clearTimeout(id));

                // Remove from hierarchy
                if (this.parent) {
                    this.parent.children.delete(this);
                }
                this.children.forEach(child => child.parent = null);

                // Clear caches and references
                this.computedCache.clear();
                this.computedDeps.clear();
                this.propDeps.clear();
                this.bindings.clear();
                this.abstraction = null;
            },

            /**
             * Initializes the PAC unit
             * @returns {Object} - The control object for chaining
             */
            init() {
                this.setupBindings();
                this.abstraction = this.createReactiveAbs();
                this.setupEvents();
                this.initialUpdate();
                return this;
            }
        };

        // Initialize the control object
        const unit = control.init();

        /**
         * Public API object - External interface for the PAC unit
         * Provides access to abstraction properties and communication methods
         */
        const api = {};

        // Copy abstraction properties to API
        for (const key in unit.abstraction) {
            if (unit.abstraction.hasOwnProperty(key)) {
                api[key] = unit.abstraction[key];
            }
        }

        // Add public methods to API
        Object.assign(api, {
            /**
             * Manually adds a child PAC unit
             * @param {Object} child - Child PAC unit to add
             */
            addChild: child => {
                control.children.add(child);
                child.parent = control;
            },

            /**
             * Removes a child PAC unit
             * @param {Object} child - Child PAC unit to remove
             */
            removeChild: child => {
                control.children.delete(child);
                child.parent = null;
            },

            // Communication methods
            notifyParent: (type, data) => control.notifyParent(type, data),
            receiveUpdate: (type, data, child) => control.receiveUpdate(type, data, child),
            receiveFromParent: (cmd, data) => control.receiveFromParent(cmd, data),
            destroy: () => control.destroy(),

            /**
             * Performs server communication with automatic property updates
             * @param {string} url - Server endpoint URL
             * @param {Object} opts - Request options
             * @returns {Promise} - Promise that resolves with server response
             */
            control: (url, opts = {}) => {
                return fetch(url, {
                    method: opts.method || 'GET',
                    headers: Object.assign({
                        'Content-Type': 'application/json',
                        'X-PAC-Request': 'true'
                    }, opts.headers || {}),
                    body: opts.data ? JSON.stringify(opts.data) : undefined
                })
                    .then(r => r.json())
                    .then(data => {
                        // Automatically update properties if requested
                        if (opts.updateProperties) {
                            for (const k in data) {
                                if (control.abstraction.hasOwnProperty(k)) {
                                    control.abstraction[k] = data[k];
                                }
                            }
                        }
                        // Call success callback if provided
                        if (opts.onSuccess) {
                            opts.onSuccess.call(control.abstraction, data);
                        }
                        return data;
                    })
                    .catch(err => {
                        // Call error callback if provided
                        if (opts.onError) {
                            opts.onError.call(control.abstraction, err);
                        }
                        throw err;
                    });
            },

            // Child communication methods
            sendToChildren: (cmd, data) => control.sendToChildren(cmd, data),
            sendToChild: (sel, cmd, data) => {
                const child = control.findChild(c => c.container.matches(sel));
                if (child && child.receiveFromParent) {
                    child.receiveFromParent(cmd, data);
                }
            },

            // Child finding methods
            findChild: pred => Array.from(control.children).find(pred),
            findChildren: pred => Array.from(control.children).filter(pred),
            findChildBySelector: sel => Array.from(control.children).find(c => c.container.matches(sel)),
            findChildByProperty: (prop, val) => Array.from(control.children).find(c =>
                c.abstraction && c.abstraction[prop] === val)
        });

        // Define read-only properties
        Object.defineProperties(api, {
            parent: {get: () => control.parent, enumerable: true},
            children: {get: () => Array.from(control.children), enumerable: true},
            container: {get: () => control.container, enumerable: true}
        });

        // Register in global registry and establish hierarchy
        window.PACRegistry.register(selector, control);
        control.establishHierarchy();

        // Re-establish hierarchy for existing units that might be affected
        window.PACRegistry.units.forEach(pac => {
            if (pac !== control && !pac.parent) {
                pac.establishHierarchy();
            }
        });

        return api;
    }

    // Export to global scope
    window.wakaPAC = wakaPAC;

    // Export for CommonJS/Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {wakaPAC, PACRegistry: Registry, ReactiveUtils: U};
    }
})();