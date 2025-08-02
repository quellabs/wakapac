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
 * ║  Enhanced with Deep Reactivity Support                                               ║
 * ║                                                                                      ║
 * ║  A powerful reactive framework that creates hierarchical components with two-way     ║
 * ║  data binding, event handling, and automatic DOM synchronization. Now supports      ║
 * ║  deep reactivity for arrays and nested objects!                                     ║
 * ║                                                                                      ║
 * ║  New Deep Reactivity Features:                                                       ║
 * ║  • Array Mutations - push(), pop(), splice(), etc. automatically trigger updates    ║
 * ║  • Nested Object Changes - deeply nested property changes are detected              ║
 * ║  • Collection Methods - Built-in reactive array and object manipulation             ║
 * ║  • Path-based Updates - Track exactly what changed for optimal performance          ║
 * ║                                                                                      ║
 * ║  Example Usage with Deep Reactivity:                                                 ║
 * ║    wakaPAC('#todo-app', {                                                            ║
 * ║      todos: [],                                                                      ║
 * ║      user: { name: 'John', preferences: { theme: 'dark' } },                        ║
 * ║                                                                                      ║
 * ║      addTodo() {                                                                     ║
 * ║        // This now works! Array mutations are reactive                              ║
 * ║        this.todos.push({ text: 'New todo', completed: false });                     ║
 * ║      },                                                                              ║
 * ║                                                                                      ║
 * ║      toggleTodo(index) {                                                             ║
 * ║        // This now works! Nested property changes are reactive                      ║
 * ║        this.todos[index].completed = !this.todos[index].completed;                  ║
 * ║      },                                                                              ║
 * ║                                                                                      ║
 * ║      updateTheme(newTheme) {                                                         ║
 * ║        // This now works! Deep nested changes are reactive                          ║
 * ║        this.user.preferences.theme = newTheme;                                      ║
 * ║      }                                                                               ║
 * ║    });                                                                               ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    /**
     * ReactiveUtils - Utility class for reactive system operations
     * Contains helper methods for reactivity detection, comparison, and validation
     */
    function ReactiveUtils() {
    }

    /**
     * Check if environment supports Proxy for deep reactivity
     * @returns {boolean} True if Proxy is supported
     */
    ReactiveUtils.SUPPORTS_PROXY = typeof Proxy !== 'undefined';

    /**
     * Check if a value should be made reactive (objects and arrays, but not DOM elements or functions)
     * @param {*} value - Value to check
     * @returns {boolean} True if value should be made reactive
     */
    ReactiveUtils.shouldBeReactive = function (value) {
        return value !== null &&
            typeof value === 'object' &&
            !value.nodeType && // Not a DOM element
            !(value instanceof Date) &&
            !(value instanceof RegExp) &&
            !(value instanceof File);
    };

    /**
     * Compare two values for deep equality
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean} True if values are deeply equal
     */
    ReactiveUtils.deepEqual = function (a, b) {
        if (a === b) {
            return true;
        }

        if (a == null || b == null) {
            return a === b;
        }

        if (typeof a !== typeof b) {
            return false;
        }

        if (typeof a === 'object') {
            if (Array.isArray(a) !== Array.isArray(b)) {
                return false;
            }

            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            if (keysA.length !== keysB.length) {
                return false;
            }

            for (let i = 0; i < keysA.length; i++) {
                const key = keysA[i];
                if (!keysB.includes(key)) {
                    return false;
                }
                if (!ReactiveUtils.deepEqual(a[key], b[key])) {
                    return false;
                }
            }

            return true;
        }

        return false;
    };

    /**
     * Generate a random ID for binding keys
     * @returns {string} Unique identifier based on timestamp and random number
     */
    ReactiveUtils.createRandomId = function () {
        return Date.now() + '_' + Math.floor(Math.random() * 10000);
    };

    /**
     * Check if a string represents a DOM event type
     * @param {string} type - String to check
     * @returns {boolean} True if it's a recognized event type
     */
    ReactiveUtils.isEventType = function (type) {
        const eventTypes = ['click', 'submit', 'change', 'input', 'focus', 'blur', 'keyup', 'keydown'];
        return eventTypes.indexOf(type) !== -1;
    };

    /**
     * PAC (Presentation-Abstraction-Control) Registry System
     * Manages hierarchical relationships between PAC units and caches hierarchy computations
     */
    function PACRegistry() {
        // Map of selectors to PAC units for quick lookup
        this.units = new Map();

        // WeakMap cache for hierarchy computations to improve performance
        this.hierarchyCache = new WeakMap();
    }

    /**
     * Register a new PAC unit in the registry
     * @param {string} selector - CSS selector for the unit
     * @param {Object} unit - The PAC unit control object
     */
    PACRegistry.prototype.register = function (selector, unit) {
        this.units.set(selector, unit);
        this.invalidateHierarchyCache();
    };

    /**
     * Unregister a PAC unit from the registry
     * @param {string} selector - CSS selector for the unit to remove
     * @returns {Object|undefined} The removed unit, if it existed
     */
    PACRegistry.prototype.unregister = function (selector) {
        const unit = this.units.get(selector);

        if (unit) {
            this.units.delete(selector);
            this.invalidateHierarchyCache();
        }
        return unit;
    };

    /**
     * Clear the hierarchy cache when registry changes
     * This ensures hierarchy computations are recalculated when needed
     */
    PACRegistry.prototype.invalidateHierarchyCache = function () {
        this.hierarchyCache = new WeakMap();
    };

    /**
     * Get the hierarchy for a container (cached or computed)
     * @param {Element} container - DOM element to get hierarchy for
     * @returns {Object} Hierarchy object with parent and children properties
     */
    PACRegistry.prototype.getHierarchy = function (container) {
        // Return cached hierarchy if available
        if (this.hierarchyCache.has(container)) {
            return this.hierarchyCache.get(container);
        }

        // Compute and cache new hierarchy
        const hierarchy = this.computeHierarchy(container);
        this.hierarchyCache.set(container, hierarchy);
        return hierarchy;
    };

    /**
     * Compute the parent-child hierarchy for a given container
     * @param {Element} container - DOM element to compute hierarchy for
     * @returns {Object} Object containing parent unit and array of child units
     */
    PACRegistry.prototype.computeHierarchy = function (container) {
        let parent = null;
        const children = [];
        const self = this;

        // Walk up the DOM tree to find parent PAC unit
        let parentElement = container.parentElement;

        while (parentElement && !parent) {
            // Check if any registered unit uses this parent element as container
            this.units.forEach(function (unit) {
                if (unit.container === parentElement) {
                    parent = unit;
                }
            });

            parentElement = parentElement.parentElement;
        }

        // Find child PAC units by checking if their containers are contained within this container
        this.units.forEach(function (unit) {
            if (container.contains(unit.container) && unit.container !== container) {
                children.push(unit);
            }
        });

        return {parent: parent, children: children};
    };

    // Initialize global registry singleton
    window.PACRegistry = window.PACRegistry || new PACRegistry();

    /**
     * Legacy compatibility functions - these delegate to ReactiveUtils
     */
    function isEventType(type) {
        return ReactiveUtils.isEventType(type);
    }

    function createRandomId() {
        return ReactiveUtils.createRandomId();
    }

    /**
     * Create a deep reactive object/array using Proxy (modern browsers) or fallback methods
     * @param {*} target - Object or array to make reactive
     * @param {Function} onChange - Callback when changes occur
     * @param {string} path - Current path in the object tree (for nested tracking)
     * @returns {*} Reactive version of the target
     */
    function createReactiveProxy(target, onChange, path) {
        path = path || '';

        if (!ReactiveUtils.shouldBeReactive(target)) {
            return target;
        }

        if (ReactiveUtils.SUPPORTS_PROXY) {
            return createProxyReactive(target, onChange, path);
        } else {
            return createFallbackReactive(target, onChange, path);
        }
    }

    /**
     * Create reactive object using Proxy (for modern browsers)
     */
    function createProxyReactive(target, onChange, path) {
        // Make nested objects reactive too
        for (const key in target) {
            if (target.hasOwnProperty(key) && ReactiveUtils.shouldBeReactive(target[key])) {
                const nestedPath = path ? path + '.' + key : key;
                target[key] = createReactiveProxy(target[key], onChange, nestedPath);
            }
        }

        // Store original array methods for arrays
        const isArray = Array.isArray(target);
        const originalMethods = {};

        if (isArray) {
            const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
            arrayMethods.forEach(method => {
                originalMethods[method] = target[method];
            });
        }

        return new Proxy(target, {
            get(obj, prop) {
                // Intercept array mutation methods
                if (isArray && originalMethods.hasOwnProperty(prop)) {
                    return function (...args) {
                        const oldLength = obj.length;
                        const result = originalMethods[prop].apply(obj, args);

                        // Make any new items reactive
                        if (prop === 'push' || prop === 'unshift' || prop === 'splice') {
                            for (let i = 0; i < obj.length; i++) {
                                if (ReactiveUtils.shouldBeReactive(obj[i]) && !obj[i]._isReactive) {
                                    const itemPath = path ? path + '.' + i : i.toString();
                                    obj[i] = createReactiveProxy(obj[i], onChange, itemPath);
                                }
                            }
                        }

                        // Notify of change
                        const changePath = path || 'root';
                        onChange(changePath, obj, 'array-mutation', {method: prop, args: args});

                        return result;
                    };
                }

                return obj[prop];
            },

            set(obj, prop, value) {
                const oldValue = obj[prop];

                // Make new value reactive if needed
                if (ReactiveUtils.shouldBeReactive(value)) {
                    const newPath = path ? path + '.' + prop : prop.toString();
                    value = createReactiveProxy(value, onChange, newPath);
                }

                obj[prop] = value;

                // Notify of change only if value actually changed
                if (!ReactiveUtils.deepEqual(oldValue, value)) {
                    const changePath = path ? path + '.' + prop : prop.toString();
                    onChange(changePath, value, 'property-set', {oldValue: oldValue});
                }

                return true;
            },

            deleteProperty(obj, prop) {
                const oldValue = obj[prop];
                delete obj[prop];

                const changePath = path ? path + '.' + prop : prop.toString();
                onChange(changePath, undefined, 'property-delete', {oldValue: oldValue});

                return true;
            }
        });
    }

    /**
     * Create reactive object using traditional methods (fallback for older browsers)
     */
    function createFallbackReactive(target, onChange, path) {
        const isArray = Array.isArray(target);

        if (isArray) {
            // For arrays in older browsers, replace mutation methods
            const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

            arrayMethods.forEach(method => {
                const original = target[method];

                Object.defineProperty(target, method, {
                    value: function (...args) {
                        const result = original.apply(this, args);

                        // Make new items reactive
                        if (method === 'push' || method === 'unshift' || method === 'splice') {
                            for (let i = 0; i < this.length; i++) {
                                if (ReactiveUtils.shouldBeReactive(this[i]) && !this[i]._isReactive) {
                                    const itemPath = path ? path + '.' + i : i.toString();
                                    this[i] = createReactiveProxy(this[i], onChange, itemPath);
                                }
                            }
                        }

                        const changePath = path || 'root';
                        onChange(changePath, this, 'array-mutation', {method: method, args: args});

                        return result;
                    },
                    enumerable: false,
                    configurable: true
                });
            });
        }

        // Make nested objects reactive
        for (const key in target) {
            if (target.hasOwnProperty(key)) {
                const value = target[key];

                if (ReactiveUtils.shouldBeReactive(value)) {
                    const nestedPath = path ? path + '.' + key : key;
                    target[key] = createReactiveProxy(value, onChange, nestedPath);
                }
            }
        }

        // Mark as reactive to avoid double-processing
        Object.defineProperty(target, '_isReactive', {
            value: true,
            enumerable: false,
            configurable: false
        });

        return target;
    }

    /**
     * Create a new PAC (Presentation-Abstraction-Control) Unit
     * This is the main factory function that creates reactive DOM components
     *
     * @param {string} selector - CSS selector for the container element
     * @param {Object} abstraction - Object containing properties and methods for the component
     * @param {Object} options - Configuration options for the PAC unit
     * @returns {Object} Public API object for interacting with the PAC unit
     */
    function wakaPAC(selector, abstraction, options) {
        let key;
        abstraction = abstraction || {};
        options = options || {};

        // Find the DOM container element
        const container = document.querySelector(selector);

        if (!container) {
            throw new Error('Container not found for selector: ' + selector);
        }

        // Default configuration options
        const config = {
            updateMode: 'immediate',  // How quickly to update: 'immediate', 'delayed', or 'change'
            delay: 300,               // Delay in milliseconds for 'delayed' mode
            deepReactivity: true      // Enable deep reactivity for arrays and objects
        };

        // Merge user options with defaults
        for (key in options) {
            if (options.hasOwnProperty(key)) {
                config[key] = options[key];
            }
        }

        // Main control object - this is the internal implementation
        const control = {
            bindings: new Map(),           // Stores all data bindings (text, attribute, input, event)
            container: container,          // Reference to the DOM container
            abstraction: null,            // Will hold the reactive abstraction object
            delayedUpdates: new Map(),    // Tracks delayed update timeouts
            parent: null,                 // Parent PAC unit in hierarchy
            children: new Set(),          // Set of child PAC units
            eventListeners: new Map(),    // Tracks event listeners for cleanup
            pendingDOMUpdates: null,      // Batched DOM updates awaiting flush
            pendingUpdates: null,         // Values for pending updates
            originalAbstraction: abstraction, // Original abstraction object
            config: config,               // Configuration options
            computedCache: new Map(),     // Cache for computed property values
            computedDependencies: new Map(), // Tracks which properties each computed property depends on
            propertyDependents: new Map(), // Tracks which computed properties depend on each property
            reactiveProxies: new WeakMap(), // Track reactive proxies to avoid cycles

            /**
             * Handle deep reactive changes from proxied objects/arrays
             * @param {string} path - The path that changed (e.g., 'todos.0.completed')
             * @param {*} newValue - The new value
             * @param {string} changeType - Type of change ('property-set', 'array-mutation', etc.)
             * @param {Object} meta - Additional metadata about the change
             */
            handleDeepChange: function (path, newValue, changeType, meta) {
                // Extract the root property name from the path
                const rootProperty = path.split('.')[0];

                // Update computed properties that depend on this root property
                this.updateComputedProperties(rootProperty);

                // Trigger DOM update for the root property
                // The DOM update system will re-render the entire property
                if (this.abstraction.hasOwnProperty(rootProperty)) {
                    this.updateDOM(rootProperty, this.abstraction[rootProperty]);
                }

                // Notify parent of the change
                this.notifyParent('propertyChange', {
                    property: rootProperty,
                    path: path,
                    newValue: newValue,
                    changeType: changeType,
                    meta: meta
                });
            },

            /**
             * Queue a DOM update for batching
             * This optimizes performance by batching multiple DOM updates together
             * @param {string} property - Property name that changed
             * @param {*} newValue - New value for the property
             */
            updateDOM: function (property, newValue) {
                const self = this;

                // Initialize batching if not already started
                if (!this.pendingDOMUpdates) {
                    this.pendingDOMUpdates = new Set();
                    this.pendingUpdates = {};

                    // Schedule batch flush using requestAnimationFrame for optimal performance
                    if (window.requestAnimationFrame) {
                        requestAnimationFrame(function () {
                            self.flushDOMUpdates();
                        });
                    } else {
                        // Fallback for older browsers
                        setTimeout(function () {
                            self.flushDOMUpdates();
                        }, 0);
                    }
                }

                // Add to pending updates
                this.pendingDOMUpdates.add(property);
                this.pendingUpdates[property] = newValue;
            },

            /**
             * Execute all pending DOM updates in a single batch
             * This reduces DOM manipulation overhead and prevents layout thrashing
             */
            flushDOMUpdates: function () {
                if (!this.pendingDOMUpdates) {
                    return;
                }

                const self = this;

                // Process each pending update
                this.pendingDOMUpdates.forEach(function (property) {
                    const newValue = self.pendingUpdates[property];

                    // Update all bindings for this property
                    self.bindings.forEach(function (binding) {
                        if (binding.property !== property) {
                            return;
                        }

                        // Handle different binding types
                        switch (binding.type) {
                            case 'text':
                                self.updateTextBinding(binding, property, newValue);
                                break;

                            case 'attribute':
                                binding.element.setAttribute(binding.attribute, newValue);
                                break;

                            case 'input':
                                // Only update if value actually changed to prevent cursor jumping
                                if (binding.element.value !== newValue) {
                                    binding.element.value = newValue;
                                }
                                break;

                            case 'visible':
                                self.updateVisibilityBinding(binding, newValue);
                                break;
                        }
                    });
                });

                // Clear pending updates
                this.pendingDOMUpdates = null;
                this.pendingUpdates = null;
            },

            /**
             * Update a visibility binding by showing/hiding the element
             * @param {Object} binding - The visibility binding object
             * @param {*} newValue - New value to determine visibility (truthy/falsy)
             */
            updateVisibilityBinding: function (binding, newValue) {
                const element = binding.element;
                const shouldShow = this.evaluateVisibilityCondition(binding.condition, newValue);

                if (shouldShow) {
                    // Show the element
                    if (element.hasAttribute('data-pac-hidden')) {
                        // Restore original display value if it was stored
                        const originalDisplay = element.getAttribute('data-pac-original-display');
                        element.style.display = originalDisplay || '';
                        element.removeAttribute('data-pac-hidden');
                        element.removeAttribute('data-pac-original-display');
                    }
                } else {
                    // Hide the element
                    if (!element.hasAttribute('data-pac-hidden')) {
                        // Store original display value before hiding
                        const originalDisplay = window.getComputedStyle(element).display;
                        if (originalDisplay !== 'none') {
                            element.setAttribute('data-pac-original-display', originalDisplay);
                        }
                        element.style.display = 'none';
                        element.setAttribute('data-pac-hidden', 'true');
                    }
                }
            },

            /**
             * Evaluate visibility condition (supports negation with !)
             * @param {string} condition - The condition string (e.g., 'isVisible' or '!isHidden')
             * @param {*} value - The current value of the property
             * @returns {boolean} Whether the element should be visible
             */
            evaluateVisibilityCondition: function (condition, value) {
                if (condition.startsWith('!')) {
                    return !value;
                }
                return !!value;
            },

            /**
             * Update a text binding by replacing template placeholders
             * Enhanced to handle complex object/array serialization
             * @param {Object} binding - The text binding object
             * @param {string} property - Property name
             * @param {*} newValue - New value to inject
             */
            updateTextBinding: function (binding, property, newValue) {
                // Create regex to match template syntax: {{propertyName}}
                const regex = new RegExp('\\{\\{\\s*' + property + '\\s*\\}\\}', 'g');

                // Convert complex values to strings
                let displayValue = newValue;
                if (typeof newValue === 'object' && newValue !== null) {
                    if (Array.isArray(newValue)) {
                        displayValue = '[' + newValue.length + ' items]';
                    } else {
                        displayValue = JSON.stringify(newValue, null, 2);
                    }
                } else if (newValue === null || newValue === undefined) {
                    displayValue = '';
                }

                const newText = binding.originalText.replace(regex, displayValue);

                // Update either the text node or element text content
                if (binding.textNode) {
                    binding.textNode.textContent = newText;
                } else {
                    binding.element.textContent = newText;
                }
            },

            /**
             * Analyze computed property function to determine its dependencies
             * This uses static analysis of the function source code to find property references
             * Also analyzes visibility conditions for negation support
             * @param {Function} computedFunction - The computed property function
             * @returns {Array} Array of property names this computed property depends on
             */
            analyzeComputedDependencies: function (computedFunction) {
                const dependencies = [];
                const functionSource = computedFunction.toString();

                // Simple regex to find 'this.propertyName' patterns
                // This catches most common dependency patterns in computed properties
                const thisPropertyRegex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
                let match;

                while ((match = thisPropertyRegex.exec(functionSource)) !== null) {
                    const propertyName = match[1];

                    // Only include if it's a property we know about and not already in dependencies
                    if (this.originalAbstraction.hasOwnProperty(propertyName) &&
                        dependencies.indexOf(propertyName) === -1) {
                        dependencies.push(propertyName);
                    }
                }

                return dependencies;
            },

            /**
             * Analyze visibility condition to extract the actual property name
             * Handles negation (!) in visibility conditions
             * @param {string} condition - The visibility condition (e.g., 'property' or '!property')
             * @returns {string} The actual property name without negation
             */
            analyzeVisibilityCondition: function (condition) {
                // Remove leading ! if present to get the actual property name
                return condition.startsWith('!') ? condition.substring(1) : condition;
            },

            /**
             * Update computed properties that depend on a changed property
             * This implements the reactive computed property system
             * @param {string} changedProperty - Name of the property that changed
             */
            updateComputedProperties: function (changedProperty) {
                const self = this;

                // Get all computed properties that depend on the changed property
                const dependentComputeds = this.propertyDependents.get(changedProperty) || [];

                // Update each dependent computed property
                dependentComputeds.forEach(function (computedName) {
                    const oldValue = self.computedCache.get(computedName);

                    // Recalculate the computed property value
                    const computedFunction = self.originalAbstraction.computed[computedName];
                    const newValue = computedFunction.call(self.abstraction);

                    // Only update if the value actually changed
                    if (!ReactiveUtils.deepEqual(oldValue, newValue)) {
                        self.computedCache.set(computedName, newValue);

                        // Trigger DOM update for the computed property
                        self.updateDOM(computedName, newValue);

                        // Notify parent of computed property change
                        self.notifyParent('propertyChange', {
                            property: computedName,
                            oldValue: oldValue,
                            newValue: newValue,
                            computed: true
                        });

                        // Check if any other computed properties depend on this computed property
                        // This handles chains of computed dependencies (computed A depends on computed B)
                        self.updateComputedProperties(computedName);
                    }
                });
            },

            /**
             * Create a reactive abstraction object with deep reactivity support
             * @returns {Object} The reactive abstraction object
             */
            createReactiveAbstraction: function () {
                const reactiveAbstraction = {};
                const self = this;

                // First, process computed properties if they exist
                if (this.originalAbstraction.computed) {
                    for (const computedName in this.originalAbstraction.computed) {
                        if (this.originalAbstraction.computed.hasOwnProperty(computedName)) {
                            const computedFunction = this.originalAbstraction.computed[computedName];

                            if (typeof computedFunction === 'function') {
                                // Analyze dependencies for this computed property
                                const dependencies = this.analyzeComputedDependencies(computedFunction);
                                this.computedDependencies.set(computedName, dependencies);

                                // Build reverse dependency map (property -> computed properties that depend on it)
                                dependencies.forEach(function (dependency) {
                                    if (!self.propertyDependents.has(dependency)) {
                                        self.propertyDependents.set(dependency, []);
                                    }
                                    self.propertyDependents.get(dependency).push(computedName);
                                });

                                // Create getter-only property for computed value
                                Object.defineProperty(reactiveAbstraction, computedName, {
                                    get: function () {
                                        // Return cached value if available
                                        if (self.computedCache.has(computedName)) {
                                            return self.computedCache.get(computedName);
                                        }

                                        // Calculate and cache the value
                                        const value = computedFunction.call(reactiveAbstraction);
                                        self.computedCache.set(computedName, value);
                                        return value;
                                    },
                                    enumerable: true,
                                    configurable: true
                                });
                            }
                        }
                    }
                }

                // Process regular properties and methods from the original abstraction
                for (const key in this.originalAbstraction) {
                    if (this.originalAbstraction.hasOwnProperty(key) && key !== 'computed') {
                        const value = this.originalAbstraction[key];

                        if (typeof value === 'function') {
                            // Bind methods to the reactive object context
                            reactiveAbstraction[key] = value.bind(reactiveAbstraction);
                        } else {
                            // Create reactive property with getter/setter and deep reactivity
                            this.createReactiveProperty(reactiveAbstraction, key, value);
                        }
                    }
                }

                // Add parent communication method
                reactiveAbstraction.notifyParent = function (eventType, data) {
                    self.notifyParent(eventType, data);
                };

                return reactiveAbstraction;
            },

            /**
             * Create a reactive property with getter/setter that triggers updates
             * Enhanced with deep reactivity support for objects and arrays
             * @param {Object} obj - Object to add property to
             * @param {string} key - Property name
             * @param {*} initialValue - Initial value for the property
             */
            createReactiveProperty: function (obj, key, initialValue) {
                let value = initialValue;
                const self = this;

                // Make initial value reactive if it's an object/array and deep reactivity is enabled
                if (this.config.deepReactivity && ReactiveUtils.shouldBeReactive(value)) {
                    value = createReactiveProxy(value, function (path, newValue, changeType, meta) {
                        self.handleDeepChange(path, newValue, changeType, meta);
                    }, key);
                }

                Object.defineProperty(obj, key, {
                    get: function () {
                        return value;
                    },
                    set: function (newValue) {
                        // Only trigger updates if value actually changed
                        if (!ReactiveUtils.deepEqual(value, newValue)) {
                            const oldValue = value;

                            // Make new value reactive if deep reactivity is enabled
                            if (self.config.deepReactivity && ReactiveUtils.shouldBeReactive(newValue)) {
                                newValue = createReactiveProxy(newValue, function (path, changedValue, changeType, meta) {
                                    self.handleDeepChange(path, changedValue, changeType, meta);
                                }, key);
                            }

                            value = newValue;

                            // Trigger DOM update
                            self.updateDOM(key, newValue);

                            // Update any computed properties that depend on this property
                            self.updateComputedProperties(key);

                            // Notify parent of property change
                            self.notifyParent('propertyChange', {
                                property: key,
                                oldValue: oldValue,
                                newValue: newValue
                            });
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            },

            /**
             * Make a request to a server controller and handle the response
             * This implements the Control layer's communication with external controllers
             * @param {string} url - Server endpoint URL to communicate with
             * @param {Object} options - Configuration options for the request
             * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
             * @param {Object} options.headers - Additional HTTP headers to send
             * @param {Object} options.data - Data to send in request body (will be JSON stringified)
             * @param {boolean} options.updateProperties - If true, automatically update abstraction properties from response
             * @param {Function} options.onSuccess - Callback function called on successful response
             * @param {Function} options.onError - Callback function called on error
             * @returns {Promise} Promise that resolves with the response data
             */
            makeServerRequest: function (url, options) {
                const self = this;
                options = options || {};

                // Make HTTP request using fetch API with configured options
                return fetch(url, {
                    method: options.method || 'GET',
                    headers: Object.assign({
                        'Content-Type': 'application/json',
                        'X-PAC-Request': 'true',
                        'X-PAC-Version': '1.0',
                        'X-PAC-Component': this.container.id || 'anonymous'  // Which component is making the call
                    }, options.headers || {}),
                    body: options.data ? JSON.stringify(options.data) : undefined
                })
                    .then(response => response.json())  // Parse response as JSON
                    .then(data => {
                        // Auto-sync: Update abstraction properties with matching keys from server response
                        // This enables automatic UI updates when server returns new data
                        if (options.updateProperties) {
                            for (const key in data) {
                                // Only update properties that already exist in the abstraction
                                // This prevents accidental creation of new reactive properties
                                if (self.abstraction.hasOwnProperty(key)) {
                                    self.abstraction[key] = data[key];  // Triggers reactive update
                                }
                            }
                        }

                        // Call success callback with abstraction as 'this' context
                        // This allows the callback to access other abstraction methods/properties
                        if (options.onSuccess) {
                            options.onSuccess.call(self.abstraction, data);
                        }

                        // Return data for promise chaining
                        return data;
                    })
                    .catch(error => {
                        // Call error callback with abstraction as 'this' context
                        // Allows error handling to update UI state or show error messages
                        if (options.onError) {
                            options.onError.call(self.abstraction, error);
                        }

                        // Re-throw error to maintain promise chain behavior
                        // Callers can still catch errors if they need custom handling
                        throw error;
                    });
            },

            /**
             * Set up all data bindings by scanning the DOM
             * This finds and registers text and attribute bindings
             */
            setupBindings: function () {
                this.findTextBindings();
                this.findAttributeBindings();
            },

            /**
             * Find and register text bindings in the DOM
             * Looks for {{propertyName}} syntax in text nodes
             */
            findTextBindings: function () {
                let i;

                // Use TreeWalker for efficient text node traversal
                const walker = document.createTreeWalker(
                    this.container,
                    NodeFilter.SHOW_TEXT,  // Only text nodes
                    null,
                    false
                );

                const textBindings = [];
                let node;

                // Walk through all text nodes
                while (node = walker.nextNode()) {
                    // Look for template syntax: {{propertyName}}
                    const text = node.textContent;
                    const matches = text.match(/\{\{\s*(\w+)\s*\}\}/g);

                    if (matches) {
                        const element = node.parentElement;

                        // Create binding for each match
                        for (i = 0; i < matches.length; i++) {
                            const match = matches[i];
                            const property = match.replace(/[{}\s]/g, ''); // Extract property name
                            const bindingKey = property + '_text_' + createRandomId();

                            textBindings.push({
                                key: bindingKey,
                                binding: {
                                    type: 'text',
                                    property: property,
                                    element: element,
                                    originalText: text,
                                    textNode: node
                                }
                            });
                        }
                    }
                }

                // Batch register all text bindings
                for (i = 0; i < textBindings.length; i++) {
                    this.bindings.set(textBindings[i].key, textBindings[i].binding);
                }
            },

            /**
             * Find and register attribute bindings in the DOM
             * Looks for elements with data-pac-bind attributes
             */
            findAttributeBindings: function () {
                let i;
                const elements = this.container.querySelectorAll('[data-pac-bind]');
                const attributeBindings = [];
                const self = this;

                // Process each element with binding attributes
                for (i = 0; i < elements.length; i++) {
                    const element = elements[i];
                    const bindingString = element.getAttribute('data-pac-bind');
                    const bindings = bindingString.split(','); // Support multiple bindings

                    // Process each binding declaration
                    for (let j = 0; j < bindings.length; j++) {
                        const binding = bindings[j].trim();
                        const bindingKey = binding + '_' + createRandomId();

                        if (binding.indexOf(':') !== -1) {
                            // Typed binding: "type:target" (e.g., "click:handleClick" or "class:className")
                            const parts = binding.split(':');
                            const type = parts[0].trim();
                            const target = parts[1].trim();
                            const isEvent = isEventType(type);

                            if (isEvent) {
                                // Event binding
                                attributeBindings.push({
                                    key: bindingKey,
                                    binding: {
                                        type: 'event',
                                        event: type,
                                        method: target,
                                        element: element
                                    }
                                });
                            } else {
                                // Attribute binding - check if it's a visibility binding
                                if (type === 'visible') {
                                    attributeBindings.push({
                                        key: bindingKey,
                                        binding: {
                                            type: 'visible',
                                            property: target,
                                            element: element,
                                            condition: target  // Store the original condition for negation support
                                        }
                                    });
                                } else {
                                    // Regular attribute binding
                                    attributeBindings.push({
                                        key: bindingKey,
                                        binding: {
                                            type: 'attribute',
                                            property: target,
                                            element: element,
                                            attribute: type
                                        }
                                    });
                                }
                            }
                        } else {
                            // Simple property binding for form inputs
                            const property = binding.trim();
                            this.setupInputElement(element, property);

                            attributeBindings.push({
                                key: bindingKey,
                                binding: {
                                    type: 'input',
                                    property: property,
                                    element: element,
                                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                                }
                            });
                        }
                    }
                }

                // Batch register all attribute bindings and set up visibility bindings
                for (i = 0; i < attributeBindings.length; i++) {
                    const bindingData = attributeBindings[i];
                    this.bindings.set(bindingData.key, bindingData.binding);

                    // For visibility bindings, we need to track the actual property being watched
                    if (bindingData.binding.type === 'visible') {
                        const actualProperty = this.analyzeVisibilityCondition(bindingData.binding.condition);
                        bindingData.binding.property = actualProperty;
                    }
                }
            },

            /**
             * Configure an input element for property binding
             * @param {Element} element - Input element to configure
             * @param {string} property - Property name to bind to
             */
            setupInputElement: function (element, property) {
                const updateMode = element.getAttribute('data-pac-update') || this.config.updateMode;
                const delay = parseInt(element.getAttribute('data-pac-delay')) || this.config.delay;

                // Set data attributes for later reference
                element.setAttribute('data-pac-property', property);
                element.setAttribute('data-pac-update-mode', updateMode);
                element.setAttribute('data-pac-update-delay', delay.toString());
            },

            /**
             * Set up event listeners for the container
             * Uses event delegation for efficient event handling
             */
            setupEventHandlers: function () {
                const eventTypes = ['input', 'change', 'click', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
                const self = this;

                // Add delegated event listeners
                for (let i = 0; i < eventTypes.length; i++) {
                    const eventType = eventTypes[i];
                    const handler = this.createEventHandler(eventType);
                    this.container.addEventListener(eventType, handler);
                    this.eventListeners.set(eventType, handler);
                }
            },

            /**
             * Create an event handler function for a specific event type
             * @param {string} eventType - Type of event to handle
             * @returns {Function} Event handler function
             */
            createEventHandler: function (eventType) {
                const self = this;

                return function (event) {
                    // Route to appropriate handler based on event type
                    if (eventType === 'input') {
                        self.handleInput(event);
                    } else if (eventType === 'change') {
                        self.handleChange(event);
                    } else {
                        self.handleEvent(event);
                    }
                };
            },

            /**
             * Handle input events for form elements
             * Respects different update modes (immediate, delayed, change)
             * @param {Event} event - Input event
             */
            handleInput: function (event) {
                const property = event.target.getAttribute('data-pac-property');

                if (!property || !this.abstraction.hasOwnProperty(property)) {
                    return;
                }

                const updateMode = event.target.getAttribute('data-pac-update-mode') || this.config.updateMode;

                if (updateMode === 'change') {
                    // Store pending value but don't update abstraction yet
                    event.target.setAttribute('data-pac-pending-value', event.target.value);
                } else if (updateMode === 'immediate') {
                    // Update abstraction immediately
                    this.abstraction[property] = event.target.value;
                } else if (updateMode === 'delayed') {
                    // Use delayed update with debouncing
                    this.updatePropertyFromDOM(event.target, property, event.target.value, false);
                }
            },

            /**
             * Handle change events for form elements
             * Always updates the abstraction regardless of update mode
             * @param {Event} event - Change event
             */
            handleChange: function (event) {
                const property = event.target.getAttribute('data-pac-property');

                if (!property || !this.abstraction.hasOwnProperty(property)) {
                    return;
                }

                const updateKey = property + '_' + event.target.getAttribute('data-pac-property');

                // Clear any pending delayed update
                if (this.delayedUpdates.has(updateKey)) {
                    clearTimeout(this.delayedUpdates.get(updateKey));
                    this.delayedUpdates.delete(updateKey);
                }

                // Update abstraction and clear pending value
                this.abstraction[property] = event.target.value;
                event.target.removeAttribute('data-pac-pending-value');
            },

            /**
             * Handle general events (click, submit, etc.)
             * Looks for bound methods in the abstraction to call
             * @param {Event} event - DOM event
             */
            handleEvent: function (event) {
                const eventType = event.type;
                let handled = false;
                const self = this;

                // Check for bound event handlers first
                this.bindings.forEach(function (binding) {
                    if (binding.type === 'event' &&
                        binding.event === eventType &&
                        binding.element === event.target) {

                        const method = self.abstraction[binding.method];

                        if (typeof method === 'function') {
                            if (eventType === 'submit') {
                                event.preventDefault();
                            }
                            method.call(self.abstraction, event);
                            handled = true;
                        }
                    }
                });

                // Fallback to legacy data attribute approach
                if (!handled) {
                    const action = event.target.getAttribute('data-pac-' + eventType);

                    if (action) {
                        const method = this.abstraction[action];

                        if (typeof method === 'function') {
                            if (eventType === 'submit') {
                                event.preventDefault();
                            }

                            method.call(this.abstraction, event);
                        }
                    }
                }
            },

            /**
             * Update a property from DOM input with optional delay/debouncing
             * @param {Element} element - Input element
             * @param {string} property - Property name
             * @param {*} value - New value
             * @param {boolean} immediate - Whether to update immediately
             */
            updatePropertyFromDOM: function (element, property, value, immediate) {
                immediate = immediate || false;
                const updateMode = element.getAttribute('data-pac-update-mode') || this.config.updateMode;
                const delay = parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay;

                // Update immediately if requested or in immediate mode
                if (immediate || updateMode === 'immediate') {
                    this.abstraction[property] = value;
                    return;
                }

                // Handle delayed updates with debouncing
                if (updateMode === 'delayed') {
                    const updateKey = property + '_' + (element.id || element.getAttribute('data-pac-property') || 'element');
                    const self = this;

                    // Clear existing timeout for this specific element/property combination
                    if (this.delayedUpdates.has(updateKey)) {
                        clearTimeout(this.delayedUpdates.get(updateKey));
                    }

                    // Set new timeout
                    const timeoutId = setTimeout(function () {
                        self.abstraction[property] = value;
                        self.delayedUpdates.delete(updateKey);
                    }, delay);

                    this.delayedUpdates.set(updateKey, timeoutId);
                }

                // For 'change' mode, we don't update here - only on change event
            },

            /**
             * Establish parent-child hierarchy relationships
             * Uses the global registry to determine relationships based on DOM structure
             */
            establishHierarchy: function () {
                const hierarchy = window.PACRegistry.getHierarchy(this.container);
                const parent = hierarchy.parent;
                const children = hierarchy.children;

                // Set parent relationship
                if (parent && this.parent !== parent) {
                    this.parent = parent;
                    parent.children.add(this);
                }

                // Set child relationships
                const self = this;

                children.forEach(function (child) {
                    if (child.parent !== self) {
                        // Remove from old parent if necessary
                        if (child.parent) {
                            child.parent.children.delete(child);
                        }
                        // Set new parent relationship
                        child.parent = self;
                        self.children.add(child);
                    }
                });
            },

            /**
             * Send a notification to the parent PAC unit
             * @param {string} eventType - Type of event to notify about
             * @param {*} data - Data to send with the notification
             */
            notifyParent: function (eventType, data) {
                if (this.parent && typeof this.parent.receiveUpdate === 'function') {
                    this.parent.receiveUpdate(eventType, data, this);
                }
            },

            /**
             * Receive an update notification from a child PAC unit
             * @param {string} eventType - Type of event
             * @param {*} data - Event data
             * @param {Object} childPAC - Reference to the child PAC unit
             */
            receiveUpdate: function (eventType, data, childPAC) {
                // Call custom handler if defined
                if (this.abstraction.onChildUpdate && typeof this.abstraction.onChildUpdate === 'function') {
                    this.abstraction.onChildUpdate(eventType, data, childPAC);
                }

                // Dispatch custom DOM event for external listeners
                const customEvent = new CustomEvent('pac:childupdate', {
                    detail: {eventType: eventType, data: data, childPAC: childPAC},
                    bubbles: true
                });

                this.container.dispatchEvent(customEvent);
            },

            /**
             * Perform initial DOM update to sync abstraction state with DOM
             * This ensures the UI reflects the initial state of the abstraction
             * Now includes computed properties in the initial sync
             */
            initialDOMUpdate: function () {
                // Update regular properties
                for (const key in this.abstraction) {
                    if (this.abstraction.hasOwnProperty(key) && typeof this.abstraction[key] !== 'function') {
                        this.updateDOM(key, this.abstraction[key]);
                    }
                }

                // Force initial computation of all computed properties
                // This ensures they are cached and available for DOM binding
                if (this.originalAbstraction.computed) {
                    for (const computedName in this.originalAbstraction.computed) {
                        if (this.originalAbstraction.computed.hasOwnProperty(computedName)) {
                            // Access the computed property to trigger initial calculation
                            var computedValue = this.abstraction[computedName];
                            this.updateDOM(computedName, computedValue);
                        }
                    }
                }
            },

            /**
             * Clean up the PAC unit and remove all references/listeners
             * This prevents memory leaks and ensures proper cleanup
             * Now includes cleanup of computed property caches and reactive proxies
             */
            destroy: function () {
                const self = this;

                // Remove all event listeners
                this.eventListeners.forEach(function (handler, eventType) {
                    self.container.removeEventListener(eventType, handler);
                });

                this.eventListeners.clear();

                // Clear all delayed update timeouts
                this.delayedUpdates.forEach(function (timeoutId) {
                    clearTimeout(timeoutId);
                });

                this.delayedUpdates.clear();

                // Remove from parent-child hierarchy
                if (this.parent) {
                    this.parent.children.delete(this);
                }

                this.children.forEach(function (child) {
                    child.parent = null;
                });

                // Clear computed property caches and dependency maps
                this.computedCache.clear();
                this.computedDependencies.clear();
                this.propertyDependents.clear();

                // Clear reactive proxy tracking
                this.reactiveProxies.clear();

                // Clear all references
                this.bindings.clear();
                this.abstraction = null;
            },

            /**
             * Initialize the PAC unit
             * This sets up all bindings, creates reactive abstraction, and performs initial updates
             * @returns {Object} The control object itself
             */
            init: function () {
                this.setupBindings();
                this.abstraction = this.createReactiveAbstraction();
                this.setupEventHandlers();
                this.initialDOMUpdate();
                return this;
            }
        };

        // Initialize the control object
        const pacUnit = control.init();

        // Create public API object that exposes safe methods and properties
        const publicAPI = {};

        // Copy abstraction properties and methods to public API
        for (key in pacUnit.abstraction) {
            if (pacUnit.abstraction.hasOwnProperty(key)) {
                publicAPI[key] = pacUnit.abstraction[key];
            }
        }

        /**
         * Add a child PAC unit to this unit
         * @param {Object} childPAC - Child PAC unit to add
         */
        publicAPI.addChild = function (childPAC) {
            control.children.add(childPAC);
            childPAC.parent = control;
        };

        /**
         * Remove a child PAC unit from this unit
         * @param {Object} childPAC - Child PAC unit to remove
         */
        publicAPI.removeChild = function (childPAC) {
            control.children.delete(childPAC);
            childPAC.parent = null;
        };

        /**
         * Send notification to parent unit
         * @param {string} eventType - Type of event
         * @param {*} data - Event data
         */
        publicAPI.notifyParent = function (eventType, data) {
            control.notifyParent(eventType, data);
        };

        /**
         * Receive update from child unit
         * @param {string} eventType - Type of event
         * @param {*} data - Event data
         * @param {Object} childPAC - Child PAC unit reference
         */
        publicAPI.receiveUpdate = function (eventType, data, childPAC) {
            control.receiveUpdate(eventType, data, childPAC);
        };

        /**
         * Destroy this PAC unit and clean up resources
         */
        publicAPI.destroy = function () {
            control.destroy();
        };

        /**
         * Make a request to a server controller
         * @param {string} url - Server endpoint URL
         * @param {Object} options - Request options
         */
        publicAPI.control = function (url, options) {
            return control.makeServerRequest(url, options);
        };

        // Add read-only properties using getters
        Object.defineProperty(publicAPI, 'parent', {
            get: function () {
                return control.parent;
            },
            enumerable: true
        });

        Object.defineProperty(publicAPI, 'children', {
            get: function () {
                return Array.from(control.children);
            },
            enumerable: true
        });

        Object.defineProperty(publicAPI, 'container', {
            get: function () {
                return control.container;
            },
            enumerable: true
        });

        // Register this unit in the global registry
        window.PACRegistry.register(selector, control);

        // Establish hierarchy relationships
        control.establishHierarchy();

        // Re-establish hierarchy for all existing units
        // This ensures proper parent-child relationships when units are created dynamically
        window.PACRegistry.units.forEach(function (existingPAC) {
            if (existingPAC !== control && !existingPAC.parent) {
                existingPAC.establishHierarchy();
            }
        });

        return publicAPI;
    }

    // Expose the main factory function globally
    window.wakaPAC = wakaPAC;

    // Module export for CommonJS/Node.js compatibility
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {wakaPAC: wakaPAC, PACRegistry: PACRegistry, ReactiveUtils: ReactiveUtils};
    }
})();