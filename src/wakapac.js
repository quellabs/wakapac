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
                if (path) {
                    target[k] = createReactive(target[k], onChange, `${path}.${k}`);
                } else {
                    target[k] = createReactive(target[k], onChange, k);
                }
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

                // Collect all text nodes first to avoid walker issues
                let node;
                while (node = walker.nextNode()) {
                    nodes.push(node);
                }

                nodes.forEach(function(n) {
                    // Original content
                    let txt = n.textContent;

                    // Replace item property references: {{item.property}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\.(\\w+)\\s*\\}\\}`, 'g'), function(m, p) {
                        return item && item.hasOwnProperty(p) ? item[p] : '';
                    });

                    // Replace item references: {{item}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\s*\\}\\}`, 'g'), function() {
                        return typeof item === 'object' ? JSON.stringify(item) : item || '';
                    });

                    // Replace index references: {{index}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${idxName}\\s*\\}\\}`, 'g'), function() {
                        return idx;
                    });

                    // Update content
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

                        switch (type) {
                            case 'class':
                                // Class binding: class:condition
                                if (this.evalExpr(target, item, idx, itemName, idxName)) {
                                    e.classList.add(target.includes('.') ? target.split('.').pop() : target);
                                }

                                break;

                            case 'checked':
                                // Checkbox binding: checked:condition
                                e.checked = !!this.evalExpr(target, item, idx, itemName, idxName);
                                break;

                            default:
                                if (U.isEvent(type)) {
                                    // Event binding: click:methodName
                                    e.addEventListener(type, ev => {
                                        if (typeof this.abstraction[target] === 'function') {
                                            this.abstraction[target].call(this.abstraction, item, idx, ev);
                                        }
                                    });
                                } else {
                                    // Attribute binding: attr:value
                                    const val = this.evalExpr(target, item, idx, itemName, idxName);

                                    if (val != null) {
                                        e.setAttribute(type, val);
                                    }
                                }

                                break;
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

                // Show the element
                if (show) {
                    if (el.hasAttribute('data-pac-hidden')) {
                        el.style.display = el.getAttribute('data-pac-orig-display') || '';
                        el.removeAttribute('data-pac-hidden');
                        el.removeAttribute('data-pac-orig-display');
                    }

                    return;
                }

                // Hide the element
                if (!el.hasAttribute('data-pac-hidden')) {
                    const orig = getComputedStyle(el).display;

                    if (orig !== 'none') {
                        el.setAttribute('data-pac-orig-display', orig);
                    }

                    el.style.display = 'none';
                    el.setAttribute('data-pac-hidden', 'true');
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

                (binding.textNode || binding.element).textContent = binding.origText.replace(regex, display);
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
                // Get all computed properties that depend on the changed property
                const deps = this.propDeps.get(changed) || [];

                // Process each dependent computed property
                deps.forEach(computed => {
                    // Store the previous value for comparison and change notifications
                    const old = this.computedCache.get(computed);

                    // Get the computed property function from the original configuration
                    const fn = this.orig.computed[computed];

                    // Execute the computed function in the context of the abstraction object
                    const val = fn.call(this.abstraction);

                    // Check if any bindings use this computed property as a foreach collection
                    // This is important because foreach bindings need updates even if the array
                    // reference hasn't changed (e.g., when array contents are modified)
                    const hasArray = Array.from(this.bindings.values()).some(function(b) {
                        return b.type === 'foreach' && b.collection === computed;
                    });

                    // Update only if:
                    // 1. There's a foreach binding using this computed property, OR
                    // 2. The computed value has actually changed (deep equality check)
                    if (hasArray || !U.deepEq(old, val)) {
                        // Cache the new computed value
                        this.computedCache.set(computed, val);

                        // Update any DOM elements bound to this computed property
                        this.updateDOM(computed, val);

                        // Notify parent component of the property change
                        this.notifyParent('propertyChange', {
                            property: computed,
                            oldValue: old,
                            newValue: val,
                            computed: true
                        });

                        // Recursively update any computed properties that depend on this one
                        // This handles cascading updates where computed properties depend on other computed properties
                        this.updateComputed(computed);
                    }
                });
            },

            /**
             * Creates the reactive abstraction object with getters/setters
             * @returns {Object} - Reactive abstraction object
             */
            createReactiveAbs() {
                const self = this;
                const reactive = {};

                // Set up computed properties
                if (this.orig.computed) {
                    // Iterate through all computed property definitions
                    for (const name in this.orig.computed) {
                        const fn = this.orig.computed[name];

                        // Only process function-based computed properties
                        if (typeof fn === 'function') {
                            // Analyze the computed function to find its dependencies
                            const deps = this.analyzeComputed(fn);
                            // Store the dependencies for this computed property
                            this.computedDeps.set(name, deps);

                            // Build reverse dependency map - track which computed properties
                            // depend on each regular property for efficient invalidation
                            deps.forEach(function(dep) {
                                // Initialize the dependency array if it doesn't exist
                                if (!self.propDeps.has(dep)) {
                                    self.propDeps.set(dep, []);
                                }

                                // Add this computed property to the dependency list
                                // of the property it depends on
                                self.propDeps.get(dep).push(name);
                            });

                            // Define computed property with getter that implements caching
                            Object.defineProperty(reactive, name, {
                                get: () => {
                                    // Return cached value if available (performance optimization)
                                    if (this.computedCache.has(name)) {
                                        return this.computedCache.get(name);
                                    }

                                    // Compute the value by calling the function with reactive context
                                    const val = fn.call(reactive);
                                    // Cache the computed value for future access
                                    this.computedCache.set(name, val);
                                    return val;
                                },
                                enumerable: true // Make property visible in for...in loops
                            });
                        }
                    }
                }

                // Set up regular properties (non-computed)
                for (const key in this.orig) {
                    // Only process own properties, skip computed (already handled above)
                    if (this.orig.hasOwnProperty(key) && key !== 'computed') {
                        const val = this.orig[key];

                        if (typeof val === 'function') {
                            // Bind methods to reactive object so 'this' refers to reactive instance
                            // This ensures methods can access reactive properties correctly
                            reactive[key] = val.bind(reactive);
                        } else {
                            // Create reactive property with getter/setter for data properties
                            // This enables change detection and computed property invalidation
                            this.createReactiveProp(reactive, key, val);
                        }
                    }
                }

                // Method to send notifications up the component hierarchy
                reactive.notifyParent = (type, data) => this.notifyParent(type, data);

                // Method to broadcast commands down to child components
                reactive.sendToChildren = (cmd, data) => this.sendToChildren(cmd, data);

                // Utility method to find a specific child component using a predicate function
                reactive.findChild = pred => Array.from(this.children).find(pred);

                // Return the reactive object
                return reactive;
            },

            /**
             * Creates a reactive property with getter/setter
             * @param {Object} obj - Object to add property to
             * @param {string} key - Property name
             * @param {*} init - Initial value
             */
            createReactiveProp(obj, key, init) {
                const self = this;
                let val = init;

                // Make initial value reactive if needed for deep reactivity.
                // This enables nested object/array change detection
                if (this.config.deepReactivity && U.isReactive(val)) {
                    val = createReactive(val, function(path, newVal, type, meta) {
                        // Delegate deep change handling to the parent's handler
                        return self.handleDeepChange(path, newVal, type, meta);
                    }, key);
                }

                // Define the reactive property using Object.defineProperty
                Object.defineProperty(obj, key, {
                    // Getter: simply returns the current value
                    get: () => val,

                    // Setter: handles value changes and triggers reactivity
                    set: newVal => {
                        // Check if either old or new value is a reactive object/array
                        // This helps determine if we need to perform deep equality checking
                        const isObj = U.isReactive(val) || U.isReactive(newVal);

                        // Only proceed with updates if:
                        // 1. At least one value is reactive (objects/arrays always trigger updates)
                        // 2. OR the values are not deeply equal (primitive value change)
                        if (isObj || !U.deepEq(val, newVal)) {
                            const old = val; // Store old value for change notifications

                            // Make new value reactive if deep reactivity is enabled
                            // and the new value is an object/array
                            if (this.config.deepReactivity && U.isReactive(newVal)) {
                                newVal = createReactive(newVal, function(path, changedVal, type, meta) {
                                    // Set up change handler for nested changes in the new value
                                    return self.handleDeepChange(path, changedVal, type, meta);
                                }, key);
                            }

                            // Update the internal value
                            val = newVal;

                            // Trigger DOM updates for this property
                            this.updateDOM(key, newVal);

                            // Recalculate any computed properties that depend on this property
                            this.updateComputed(key);

                            // Notify parent component/system about the property change
                            // Includes old and new values for comparison/logging
                            this.notifyParent('propertyChange', {
                                property: key,
                                oldValue: old,
                                newValue: newVal
                            });
                        }
                    },

                    // Make property enumerable so it shows up in Object.keys(), for...in loops, etc.
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
                // Create a TreeWalker to traverse only text nodes in the DOM
                // This is more efficient than recursively walking all nodes
                const walker = document.createTreeWalker(this.container, NodeFilter.SHOW_TEXT);

                // Array to temporarily store binding data before adding to the bindings map
                const bindings = [];

                // Iterate through each text node in the container
                let node;

                while (node = walker.nextNode()) {
                    const txt = node.textContent;

                    // Look for interpolation patterns like {{property}} or {{ property }}
                    // \{\{ matches opening braces, \s* allows optional whitespace
                    // (\w+) captures the property name (word characters only)
                    // \s* allows optional whitespace, \}\} matches closing braces
                    // g flag finds all matches in the text
                    const matches = txt.match(/\{\{\s*(\w+)\s*\}\}/g);

                    // If interpolation patterns were found in this text node
                    if (matches) {
                        // Process each match found in this text node
                        matches.forEach(match => {
                            // Extract the property name by removing braces and whitespace
                            // Example: "{{ name }}" becomes "name"
                            const prop = match.replace(/[{}\s]/g, '');

                            // Create a binding object with all necessary information
                            // U.id() generates a unique identifier for this binding
                            bindings.push([U.id(), {
                                type: 'text',              // Indicates this is a text interpolation binding
                                property: prop,            // The property name to bind to
                                element: node.parentElement, // The containing element
                                origText: txt,             // Original text content (for restoration/re-evaluation)
                                textNode: node             // Direct reference to the text node for efficient updates
                            }]);
                        });
                    }
                }

                // Add all discovered bindings to the component's bindings map
                // Using forEach with destructuring to separate the key from the binding object
                bindings.forEach(([key, binding]) => this.bindings.set(key, binding));
            },

            /**
             * Finds and sets up attribute bindings data-pac-bind="..."
             * Scans the container for elements with data-pac-bind attributes and creates appropriate binding objects
             * Excludes nested foreach elements to avoid duplicate processing
             */
            findAttrBindings: function() {
                // Find all elements with data-pac-bind attribute, excluding those inside foreach loops
                // The :not() selector prevents processing nested bindings that will be handled by foreach
                const elements = this.container.querySelectorAll('[data-pac-bind]:not([data-pac-bind*="foreach"] [data-pac-bind])');
                const bindings = [];

                // Process each element with binding attributes
                Array.from(elements).forEach(function(el) {
                    const bindStr = el.getAttribute('data-pac-bind');

                    // Handle multiple bindings on a single element (comma-separated)
                    for (let i = 0; i < bindStr.split(',').length; i++) {
                        // Fetch all binds
                        const bind = bindStr.split(',')[i];

                        // Split binding string into type and target (e.g., "click:handleClick" -> ["click", "handleClick"])
                        const parts = bind.trim().split(':');
                        const type = parts[0] ? parts[0].trim() : '';  // Binding type (click, value, visible, etc.)
                        const target = parts[1] ? parts[1].trim() : ''; // Target property or method
                        const key = bind + '_' + U.id(); // Unique key for this binding

                        // Handle foreach binding - creates repeating elements based on array data
                        if (type === 'foreach') {
                            bindings.push([key, this.createForeachBinding(el, target)]);
                            el.innerHTML = ''; // Clear template content after storing it
                            continue;
                        }

                        // Handle event bindings (click, change, submit, etc.)
                        if (U.isEvent(type)) {
                            bindings.push([key, this.createEventBinding(el, type, target)]);
                            continue;
                        }

                        // Handle visibility binding - shows/hides element based on property value
                        if (type === 'visible') {
                            bindings.push([key, this.createVisibilityBinding(el, target)]);
                            continue;
                        }

                        // Handle attribute bindings (class, style, disabled, etc.)
                        if (bind.indexOf(':') !== -1) {
                            bindings.push([key, this.createAttributeBinding(el, type, target)]);
                            continue;
                        }

                        // Default case: Input binding for two-way data binding with form elements
                        this.setupInput(el, bind.trim());
                        bindings.push([key, this.createInputBinding(el, bind.trim())]);
                    }
                }.bind(this));

                // Store all created bindings in the bindings map for later reference
                bindings.forEach(function(binding) {
                    this.bindings.set(binding[0], binding[1]);
                }.bind(this));
            },

            /**
             * Creates a foreach binding object for rendering collections/arrays
             * @param {Element} el - The template element that will be repeated
             * @param {string} target - The property name containing the array data
             * @returns {Object} Foreach binding configuration object
             */
            createForeachBinding: function(el, target) {
                const itemName = el.getAttribute('data-pac-item') || 'item';
                const indexName = el.getAttribute('data-pac-index') || 'index';

                return {
                    type: 'foreach',
                    property: target,         // Property name in the data model
                    collection: target,       // Same as property (legacy support)
                    itemName: itemName,       // Item variable name in template (defaults to 'item')
                    indexName: indexName,     // Index variable name in template (defaults to 'index')
                    template: el.innerHTML,   // HTML template to repeat for each item
                    element: el               // Reference to the container element
                };
            },

            /**
             * Creates an event binding object for handling DOM events
             * @param {Element} el - The element that will trigger the event
             * @param {string} type - The event type (click, change, etc.)
             * @param {string} target - The method name to call when event fires
             * @returns {Object} Event binding configuration object
             */
            createEventBinding: function(el, type, target) {
                return {
                    type: 'event',
                    event: type,        // Event name (click, change, submit, etc.)
                    method: target,     // Method to invoke when event occurs
                    element: el         // Element that triggers the event
                };
            },

            /**
             * Creates a visibility binding object for showing/hiding elements
             * @param {Element} el - The element whose visibility will be controlled
             * @param {string} target - The property name or condition (can start with ! for negation)
             * @returns {Object} Visibility binding configuration object
             */
            createVisibilityBinding: function(el, target) {
                // Remove negation operator to get actual property name
                const propertyName = target.replace(/^!/, '');

                return {
                    type: 'visible',
                    property: propertyName,
                    element: el,
                    condition: target   // Full condition including negation if present
                };
            },

            /**
             * Creates an attribute binding object for dynamic attribute values
             * @param {Element} el - The element whose attribute will be bound
             * @param {string} type - The attribute name (class, style, disabled, etc.)
             * @param {string} target - The property name containing the attribute value
             * @returns {Object} Attribute binding configuration object
             */
            createAttributeBinding: function(el, type, target) {
                return {
                    type: 'attribute',
                    property: target,   // Property name in data model
                    element: el,        // Target element
                    attribute: type     // Attribute name to update (class, style, etc.)
                };
            },

            /**
             * Creates an input binding object for two-way data binding with form elements
             * @param {Element} el - The input element to bind
             * @param {string} bind - The property name to bind to
             * @returns {Object} Input binding configuration object
             */
            createInputBinding: function(el, bind) {
                const delay = parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay || 0;
                const updateMode = el.getAttribute('data-pac-update-mode') || this.config.updateMode || 'immediate';

                return {
                    type: 'input',
                    property: bind,         // Property name in data model
                    element: el,            // Input element reference
                    updateMode: updateMode, // How often to update: 'immediate', 'change', or 'manual'
                    delay: delay            // Delay in milliseconds (for debouncing)
                };
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
             * Routes events to appropriate handlers based on event type and element attributes
             * @param {Event} ev - DOM event object
             */
            handleEvent(ev) {
                const {type, target} = ev;
                const prop = target.getAttribute('data-pac-property');

                // Route to the appropriate handler based on the event type
                if (this._isInputEvent(type, prop)) {
                    this._handleInputEvent(ev, target, prop);
                } else if (this._isChangeEvent(type, prop)) {
                    this._handleChangeEvent(ev, target, prop);
                } else {
                    this._handleEventBinding(ev, type, target);
                }
            },

            /**
             * Checks if this is an input event on a bound property
             * @param {string} type - Event type
             * @param {string} prop - Property name from data-pac-property
             * @returns {boolean} True if this is a bound input event
             */
            _isInputEvent(type, prop) {
                return type === 'input' && prop && this.abstraction.hasOwnProperty(prop);
            },

            /**
             * Checks if this is a change event on a bound property
             * @param {string} type - Event type
             * @param {string} prop - Property name from data-pac-property
             * @returns {boolean} True if this is a bound change event
             */
            _isChangeEvent(type, prop) {
                return type === 'change' && prop && this.abstraction.hasOwnProperty(prop);
            },

            /**
             * Handles input events based on the element's update mode
             * Supports three modes: change, immediate, and delayed
             * @param {Event} ev - The input event
             * @param {Element} target - The input element
             * @param {string} prop - The bound property name
             */
            _handleInputEvent(ev, target, prop) {
                // Get update mode from element attribute or fall back to config default
                const mode = target.getAttribute('data-pac-update-mode') || this.config.updateMode;
                const value = target.value;

                switch (mode) {
                    case 'change':
                        // Store value temporarily, wait for change event to commit
                        target.setAttribute('data-pac-pending-value', value);
                        break;

                    case 'immediate':
                        // Update data model immediately on every keystroke
                        this.abstraction[prop] = value;
                        break;

                    case 'delayed':
                        // Update after a delay (debounced input)
                        this.updateFromDOM(target, prop, value);
                        break;

                    default:
                        console.warn(`Unknown update mode: ${mode}. Using immediate.`);
                        this.abstraction[prop] = value;
                }
            },

            /**
             * Handles change events for bound properties
             * Cleans up any pending delayed updates and commits the value
             * @param {Event} ev - The change event
             * @param {Element} target - The input element that changed
             * @param {string} prop - The bound property name
             */
            _handleChangeEvent(ev, target, prop) {
                // Generate unique key for this element's delayed update
                const delayKey = `${prop}_${target.getAttribute('data-pac-property')}`;

                // Cancel any pending delayed update for this element
                if (this.delays.has(delayKey)) {
                    clearTimeout(this.delays.get(delayKey));
                    this.delays.delete(delayKey);
                }

                // Commit the current value to the data model
                this.abstraction[prop] = target.value;

                // Clean up pending value marker
                target.removeAttribute('data-pac-pending-value');
            },

            /**
             * Handles custom event bindings (click, submit, etc.)
             * Searches through registered bindings and executes matching event handlers
             * @param {Event} ev - The DOM event
             * @param {string} type - Event type (click, submit, etc.)
             * @param {Element} target - Element that triggered the event
             */
            _handleEventBinding(ev, type, target) {
                // Search through all registered event bindings
                this.bindings.forEach(binding => {
                    // Check if this binding matches the current event
                    if (this._isMatchingEventBinding(binding, type, target)) {
                        this._executeEventBinding(binding, ev);
                    }
                });
            },

            /**
             * Checks if a binding matches the current event and target
             * @param {Object} binding - The binding configuration object
             * @param {string} type - Event type
             * @param {Element} target - Target element
             * @returns {boolean} True if the binding matches
             */
            _isMatchingEventBinding(binding, type, target) {
                return binding.type === 'event' &&
                    binding.event === type &&
                    binding.element === target;
            },

            /**
             * Executes an event binding by calling the bound method
             * @param {Object} binding - The binding configuration
             * @param {Event} ev - The original DOM event
             */
            _executeEventBinding(binding, ev) {
                const method = this.abstraction[binding.method];

                // Ensure the method exists and is callable
                if (typeof method !== 'function') {
                    console.warn(`Event handler method '${binding.method}' is not a function`);
                    return;
                }

                // Prevent default form submission behavior
                if (binding.event === 'submit') {
                    ev.preventDefault();
                }

                // Execute the method with proper context and pass the event
                try {
                    method.call(this.abstraction, ev);
                } catch (error) {
                    console.error(`Error executing event handler '${binding.method}':`, error);
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