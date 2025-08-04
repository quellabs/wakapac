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

            if (!a || !b || typeof a !== typeof b || typeof a !== 'object') {
                return false;
            }

            const ka = Object.keys(a), kb = Object.keys(b);

            return ka.length === kb.length &&
                ka.every(k => kb.includes(k) && U.deepEq(a[k], b[k]));
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

            let parent = null, el = container.parentElement;
            const children = [];

            // Find parent PAC unit by walking up DOM tree
            while (el && !parent) {
                this.units.forEach(unit => {
                    if (unit.container === el) {
                        parent = unit;
                    }
                });
                el = el.parentElement;
            }

            // Find children PAC units within this container
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
     * Creates reactive proxy or fallback for objects with deep reactivity
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

        if (U.PROXY) {
            return createProxy(target, onChange, path);
        } else {
            return createFallback(target, onChange, path);
        }
    }

    /**
     * Creates a reactive proxy using ES6 Proxy
     * @param {Object} target - Object to make reactive
     * @param {Function} onChange - Change callback
     * @param {string} path - Property path
     * @returns {Object} - Proxied reactive object
     */
    function createProxy(target, onChange, path) {
        // Initialize nested objects as reactive proxies recursively
        // This ensures that any existing nested objects/arrays are also reactive
        Object.keys(target).forEach(k => {
            // Check if the property exists directly on the object (not inherited)
            // and if it's a type that should be made reactive (object/array)
            if (target.hasOwnProperty(k) && U.isReactive(target[k])) {
                // Create reactive proxy for nested object with proper path tracking
                target[k] = createReactive(target[k], onChange, path ? `${path}.${k}` : k);
            }
        });

        // Check if target is an array to handle array-specific operations
        const methods = {};
        const isArr = Array.isArray(target);

        // Store references to original array mutation methods
        // This allows us to intercept calls and trigger change notifications
        if (isArr) {
            ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(m => {
                // Store original method implementation
                methods[m] = target[m];
            });
        }

        // Create and return the proxy with custom behavior
        return new Proxy(target, {
            /**
             * Proxy get trap - intercepts property access and method calls
             * @param {Object} obj - The target object
             * @param {string|symbol} prop - The property being accessed
             * @returns {*} - The property value or wrapped method
             */
            get(obj, prop) {
                // Handle array mutation methods specially
                if (isArr && methods[prop]) {
                    // Return a wrapped version of the array method
                    return function (...args) {
                        // Call the original method with the provided arguments
                        const result = methods[prop].apply(obj, args);

                        // For methods that add new elements, ensure they become reactive
                        if (/^(push|unshift|splice)$/.test(prop)) {
                            // Iterate through all array items
                            obj.forEach((item, i) => {
                                // If item should be reactive but isn't already proxied
                                if (U.isReactive(item) && !item._reactive) {
                                    // Make the item reactive with proper path
                                    obj[i] = createReactive(item, onChange, `${path}.${i}`);
                                }
                            });
                        }

                        // Notify observers about the array mutation
                        onChange(path || 'root', obj, 'array-mutation', {method: prop, args});
                        return result;
                    };
                }

                // Default behavior: return the property value
                return obj[prop];
            },

            /**
             * Proxy set trap - intercepts property assignment
             * @param {Object} obj - The target object
             * @param {string|symbol} prop - The property being set
             * @param {*} val - The new value
             * @returns {boolean} - Success indicator
             */
            set(obj, prop, val) {
                // Store the old value for comparison and change notification
                const old = obj[prop];

                // If the new value should be reactive, wrap it in a proxy
                if (U.isReactive(val)) {
                    val = createReactive(val, onChange, path ? `${path}.${prop}` : prop);
                }

                // Perform the actual assignment
                obj[prop] = val;

                // Only trigger change notification if the value actually changed
                if (!U.deepEq(old, val)) {
                    // Notify about the direct property change
                    onChange(path ? `${path}.${prop}` : prop, val, 'set', {old});

                    // If this is a nested property, also notify about root-level changes
                    // This allows parent objects/arrays to react to nested changes
                    if (path && path.includes('.')) {
                        // Extract the root path (first segment before the dot)
                        const rootPath = path.split('.')[0];
                        // Notify about nested property change at root level
                        onChange(rootPath, null, 'nested-property-change', {
                            nestedPath: path ? `${path}.${prop}` : prop,
                            oldValue: old,
                            newValue: val
                        });
                    }
                }

                // Return true to indicate successful assignment
                return true;
            },

            /**
             * Proxy deleteProperty trap - intercepts property deletion
             * @param {Object} obj - The target object
             * @param {string|symbol} prop - The property being deleted
             * @returns {boolean} - Success indicator
             */
            deleteProperty(obj, prop) {
                // Store the old value before deletion
                const old = obj[prop];

                // Perform the actual deletion
                delete obj[prop];

                // Notify observers about the property deletion
                onChange(path ? `${path}.${prop}` : prop, undefined, 'delete', {old});

                // Return true to indicate successful deletion
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
        // Simplified fallback implementation for older browsers
        if (Array.isArray(target)) {
            ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(m => {
                const orig = target[m];
                Object.defineProperty(target, m, {
                    value: function (...args) {
                        const result = orig.apply(this, args);
                        onChange(path || 'root', this, 'array-mutation', {method: m, args});
                        return result;
                    },
                    enumerable: false,
                    configurable: true
                });
            });
        }

        // Make nested objects reactive
        Object.keys(target).forEach(k => {
            if (target.hasOwnProperty(k) && U.isReactive(target[k])) {
                target[k] = createReactive(target[k], onChange, path ? `${path}.${k}` : k);
            }
        });

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
         */
        const control = {
            bindings: new Map(), // Map of binding ID -> binding config
            abstraction: null, // Reactive abstraction object
            delays: new Map(), // Map of delayed update timeouts
            parent: null, // Parent PAC unit
            children: new Set(), // Set of child PAC units
            listeners: new Map(), // Map of event type -> handler function
            pending: null, // Set of properties pending DOM update
            pendingVals: null, // Values for pending updates
            orig: abstraction, // Original abstraction object
            computedCache: new Map(), // Cache for computed property values
            computedDeps: new Map(), // Map of computed property -> dependencies
            propDeps: new Map(), // Map of property -> dependent computed properties
            container,
            config,

            /**
             * Generic method to create any binding type - DRY principle
             * Creates a standardized binding object with common properties for all binding types
             * @param {string} type - The binding type (text, attribute, input, etc.)
             * @param {Element} element - The DOM element this binding applies to
             * @param {Object} config - Configuration object with binding-specific properties
             * @returns {Object} - Standardized binding configuration object
             */
            createBinding(type, element, config) {
                const baseBinding = {
                    type,
                    element,
                    ...config
                };

                // Add common properties based on type
                // Extract root property and full path for reactivity tracking
                if (config.target) {
                    baseBinding.property = config.target.split('.')[0];        // Root property for change detection
                    baseBinding.propertyPath = config.target;   // Full path for value resolution
                }

                return baseBinding;
            },

            /**
             * Generic DOM updater - handles all binding types uniformly
             * Uses strategy pattern to delegate to specific update methods based on binding type
             * Determines whether a binding needs updating based on the changed property
             * @param {Object} binding - The binding configuration object
             * @param {string} prop - The property name that changed
             * @param {*} val - The new value of the property
             */
            updateBinding(binding, prop, val) {
                // Determine if this binding should be updated based on the changed property
                // Update if the binding's property matches OR if it uses a property path that starts with the changed property
                const shouldUpdate = binding.property === prop ||
                    (binding.propertyPath && binding.propertyPath.startsWith(prop + '.'));

                // Skip bindings that don't need updates (except foreach which has special handling)
                if (!shouldUpdate && binding.type !== 'foreach') {
                    return;
                }

                // Strategy pattern - map binding types to their update methods
                const updaters = {
                    text: () => this.updateText(binding, prop, val),
                    attribute: () => this.updateAttribute(binding, prop, val),
                    input: () => this.updateInput(binding, prop, val),
                    checked: () => this.updateChecked(binding, prop, val),
                    visible: () => this.updateVisible(binding, val),
                    foreach: () => this.updateForeach(binding, prop, val)
                };

                // Execute the appropriate updater if it exists and the binding should be updated
                const updater = updaters[binding.type];
                if (updater && (shouldUpdate || binding.type === 'foreach')) {
                    updater.call(this);
                }
            },

            /**
             * Enhanced foreach update with better item handling
             * Updates a foreach binding when the associated array property changes
             * Performs efficient array comparison to avoid unnecessary DOM rebuilds
             * @param {Object} binding - The foreach binding configuration object
             * @param {string} prop - The property name that changed
             * @param {*} val - The new array value to render
             */
            updateForeach(binding, prop, val) {
                // Only process if this foreach binding matches the changed property
                if (binding.collection !== prop) {
                    return;
                }

                // Ensure we have a valid array to work with, default to empty array
                const arr = Array.isArray(val) ? val : [];
                const prev = binding.prev || [];

                // Performance optimization: skip update if arrays are deeply equal
                // This prevents unnecessary DOM rebuilds when array contents haven't changed
                if (this.arrEq(prev, arr)) {
                    binding.prev = [...arr];  // Update reference for future comparisons
                    return;
                }

                // Store current array state for next comparison
                binding.prev = [...arr];

                // Clear existing content before rendering new items
                binding.element.innerHTML = '';

                // Render each item in the array using the stored template
                arr.forEach((item, i) => {
                    const itemEl = this.renderItem(binding.template, item, i,
                        binding.itemName, binding.indexName);
                    binding.element.appendChild(itemEl);
                });
            },

            /**
             * Enhanced expression parser that supports ternary operators
             * Parses expressions like: property ? 'true' : 'false', object.property, etc.
             * @param {string} expr - Expression to parse
             * @returns {Object} - Parsed expression data
             */
            parseExpression(expr) {
                // Remove leading and trailing whitespace from the expression
                // This ensures consistent parsing regardless of input formatting
                expr = expr.trim();

                // Use regex to detect ternary operator pattern: condition ? trueValue : falseValue
                // The regex captures three groups:
                // 1. (.+?) - condition (non-greedy match up to the first '?')
                // 2. (.+?) - true value (non-greedy match between '?' and ':')
                // 3. (.+?) - false value (everything after ':')
                // \s* allows for optional whitespace around operators
                const ternaryMatch = expr.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/);

                // If ternary pattern is found, parse it as a conditional expression
                if (ternaryMatch) {
                    // Destructure the regex match results
                    // [0] is the full match, [1-3] are the captured groups
                    const [, condition, trueValue, falseValue] = ternaryMatch;

                    // Return structured ternary expression object
                    return {
                        type: 'ternary',                                    // Mark as ternary expression
                        condition: condition.trim(),                        // Clean condition part
                        trueValue: this.parseValue(trueValue.trim()),      // Parse and clean true branch
                        falseValue: this.parseValue(falseValue.trim()),    // Parse and clean false branch
                        dependencies: this.extractDependencies(condition.trim()) // Extract variable dependencies from condition
                    };
                }

                // If no ternary operator found, treat as simple property access
                // This handles cases like: 'user.name', 'isActive', 'config.settings.theme'
                return {
                    type: 'property',                           // Mark as property access
                    path: expr,                                 // Store the full property path
                    dependencies: this.extractDependencies(expr) // Extract all dependencies from the path
                };
            },

            /**
             * Parses a value which could be a string literal, number, or property reference
             * @param {string} value - Value to parse
             * @returns {Object} - Parsed value data
             */
            parseValue(value) {
                // Remove leading and trailing whitespace from input
                value = value.trim();

                // Check if value is a string literal (enclosed in quotes)
                // Handles both single quotes ('hello') and double quotes ("hello")
                if ((value.startsWith("'") && value.endsWith("'")) ||
                    (value.startsWith('"') && value.endsWith('"'))) {
                    return {
                        type: 'literal',
                        // Remove the surrounding quotes by slicing off first and last character
                        value: value.slice(1, -1)
                    };
                }

                // Check if value is a numeric literal
                // Regex matches: whole numbers (123) or decimals (123.45)
                // ^ = start of string, \d+ = one or more digits, (\.\d+)? = optional decimal part, $ = end of string
                if (/^\d+(\.\d+)?$/.test(value)) {
                    return {
                        type: 'literal',
                        // Convert string to actual number (handles both integers and floats)
                        value: parseFloat(value)
                    };
                }

                // Check if value is a boolean literal
                // Only accepts exact matches for 'true' or 'false'
                if (value === 'true' || value === 'false') {
                    return {
                        type: 'literal',
                        // Convert string to actual boolean value
                        value: value === 'true'
                    };
                }

                // If none of the above conditions match, treat as property reference
                // This handles cases like: obj.prop, myVariable, nested.property.path
                return {
                    type: 'property',
                    // Store the property path as-is for later resolution
                    path: value
                };
            },

            /**
             * Extracts property dependencies from an expression
             * @param {string} expr - Expression to analyze (e.g., "user.name && status === 'active'")
             * @returns {Array} - Array of property names this expression depends on
             */
            extractDependencies(expr) {
                const deps = [];

                // Regular expression to match JavaScript identifiers and property access patterns
                // Matches: variable names, object.property, nested.object.property, etc.
                // Pattern breakdown: \b = word boundary, [a-zA-Z_$] = valid identifier start chars,
                // [a-zA-Z0-9_$.]* = valid identifier continuation chars including dots for property access
                const propertyRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$.]*)\b/g;

                // Iterate through all matches in the expression
                let match;

                while ((match = propertyRegex.exec(expr))) {
                    const prop = match[1];

                    // Filter out JavaScript boolean literals and avoid duplicate entries
                    // TODO: Consider filtering out other literals like 'null', 'undefined', numbers
                    if (prop !== 'true' && prop !== 'false' && !deps.includes(prop)) {
                        deps.push(prop);
                    }
                }

                return deps;
            },

            /**
             * Evaluates a parsed expression in the context of the reactive abstraction
             * @param {Object} parsedExpr - Parsed expression object
             * @returns {*} - Evaluated result
             */
            evaluateExpression(parsedExpr) {
                // Handle ternary conditional expressions (condition ? trueValue : falseValue)
                if (parsedExpr.type === 'ternary') {
                    // Evaluate the condition part of the ternary expression
                    // This determines which branch of the ternary to execute
                    const conditionValue = this.evaluateCondition(parsedExpr.condition);

                    // Execute the appropriate branch based on the condition result
                    if (conditionValue) {
                        // Condition is truthy - evaluate and return the "true" branch value
                        return this.evaluateValue(parsedExpr.trueValue);
                    } else {
                        // Condition is falsy - evaluate and return the "false" branch value
                        return this.evaluateValue(parsedExpr.falseValue);
                    }
                }

                // Handle property access expressions (e.g., object.property, nested.path.value)
                else if (parsedExpr.type === 'property') {
                    // Resolve the property path to get the actual value from the reactive context
                    return this.resolvePropertyPath(parsedExpr.path);
                }

                // Return undefined for any unrecognized expression types
                // This serves as a fallback for unsupported or malformed expressions
                return undefined;
            },

            /**
             * Evaluates a condition expression (the part before ? in ternary)
             * @param {string} condition - Condition to evaluate
             * @returns {boolean} - Truthy/falsy result
             */
            evaluateCondition(condition) {
                // Handle simple property access (e.g., "user.name", "isActive")
                // Uses regex to match valid JavaScript property names and dot notation
                if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(condition)) {
                    const value = this.resolvePropertyPath(condition);
                    return !!value; // Convert to boolean using double negation
                }

                // Handle comparison operators (===, !==, ==, !=, >=, <=, >, <)
                // Regex captures: left operand, operator, right operand
                const comparisonMatch = condition.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)$/);

                if (comparisonMatch) {
                    const [, left, operator, right] = comparisonMatch;

                    // Resolve left side (usually a property path like "user.age")
                    const leftValue = this.resolvePropertyPath(left.trim());

                    // Parse and evaluate right side (could be literal value, property, etc.)
                    const rightValue = this.parseAndEvaluateValue(right.trim());

                    // Perform the comparison based on operator
                    switch (operator) {
                        case '===': return leftValue === rightValue; // Strict equality
                        case '!==': return leftValue !== rightValue; // Strict inequality
                        case '==': return leftValue == rightValue;   // Loose equality
                        case '!=': return leftValue != rightValue;   // Loose inequality
                        case '>=': return leftValue >= rightValue;   // Greater than or equal
                        case '<=': return leftValue <= rightValue;   // Less than or equal
                        case '>': return leftValue > rightValue;     // Greater than
                        case '<': return leftValue < rightValue;     // Less than
                        default: return false; // Unknown operator
                    }
                }

                // Fallback: treat as simple property access and check truthiness
                // This handles cases where regex didn't match but it's still a valid property
                const value = this.resolvePropertyPath(condition);
                return !!value; // Convert to boolean
            },

            /**
             * Evaluates a value object (literal or property reference)
             * @param {Object} valueObj - Value object from parseValue
             * @returns {*} - Evaluated value
             */
            evaluateValue(valueObj) {
                // Handle literal values (strings, numbers, booleans, etc.)
                if (valueObj.type === 'literal') {
                    return valueObj.value;
                }
                // Handle property references (e.g., "user.name", "config.timeout")
                else if (valueObj.type === 'property') {
                    // Resolve the property path to get the actual value
                    return this.resolvePropertyPath(valueObj.path);
                }
                // Handle unknown or invalid value types
                else {
                    // Return undefined for unrecognized value types
                    return undefined;
                }
            },

            /**
             * Parses and evaluates a value string (for use in conditions)
             * @param {string} valueStr - Value string to parse and evaluate
             * @returns {*} - Evaluated value
             */
            parseAndEvaluateValue(valueStr) {
                const parsed = this.parseValue(valueStr);
                return this.evaluateValue(parsed);
            },

            /**
             * Consolidated item rendering with better expression evaluation
             * Creates a DOM element from a template string with data binding applied
             * Processes both text interpolation and attribute bindings for the item
             * @param {string} tmpl - HTML template string to render
             * @param {*} item - Data item to bind to the template
             * @param {number} idx - Index of the item in the collection
             * @param {string} itemName - Variable name for the item in template expressions
             * @param {string} idxName - Variable name for the index in template expressions
             * @returns {Element} - Rendered DOM element with data binding applied
             */
            renderItem(tmpl, item, idx, itemName, idxName) {
                // Create temporary container to parse HTML template
                const div = document.createElement('div');
                div.innerHTML = tmpl;

                // Extract the first element or text node from the template
                const el = div.firstElementChild || div.firstChild;

                // Return empty text node if no content
                if (!el) {
                    return document.createTextNode('');
                }

                // Clone the element to avoid modifying the original template
                const clone = el.cloneNode(true);

                // Process the cloned element to apply data binding
                this.processTemplate(clone, item, idx, itemName, idxName);

                // Return the clone
                return clone;
            },

            /**
             * Unified template processing - combines text and attribute processing
             * Processes both text content and element attributes for data binding
             * Handles variable interpolation and binding directives in a single pass
             * @param {Element} el - The element to process for data binding
             * @param {*} item - Data item for binding context
             * @param {number} idx - Item index for binding context
             * @param {string} itemName - Item variable name for template expressions
             * @param {string} idxName - Index variable name for template expressions
             */
            processTemplate(el, item, idx, itemName, idxName) {
                // Process text nodes for variable interpolation {{variable}}
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                const nodes = [];

                // Collect all text nodes first to avoid walker issues during modification
                let node;

                while (node = walker.nextNode()) {
                    nodes.push(node);
                }

                // Process each text node for variable interpolation
                nodes.forEach(n => {
                    let txt = n.textContent;

                    // Replace item property references: {{item.property}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\.(\\w+)\\s*\\}\\}`, 'g'),
                        (m, p) => item && item.hasOwnProperty(p) ? item[p] : '');

                    // Replace item references: {{item}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${itemName}\\s*\\}\\}`, 'g'),
                        () => typeof item === 'object' ? JSON.stringify(item) : item || '');

                    // Replace index references: {{index}}
                    txt = txt.replace(new RegExp(`\\{\\{\\s*${idxName}\\s*\\}\\}`, 'g'), () => idx);

                    // Update the text content with interpolated values
                    n.textContent = txt;
                });

                // Process elements with data-pac-bind attributes for directive binding
                [el, ...el.querySelectorAll('[data-pac-bind]')].forEach(e => {
                    const bind = e.getAttribute('data-pac-bind');

                    if (!bind) {
                        return;
                    }

                    // Handle multiple bindings on a single element (comma-separated)
                    bind.split(',').forEach(b => {
                        const [type, target] = b.trim().split(':').map(s => s.trim());
                        this.processBinding(e, type, target, item, idx, itemName, idxName);
                    });
                });
            },

            /**
             * Unified binding processor for template items
             * Handles different types of data bindings within foreach templates
             * Supports class toggling, checked states, events, and attribute binding
             * @param {Element} element - The element to apply binding to
             * @param {string} type - The binding type (class, checked, event name, attribute name)
             * @param {string} target - The binding target (property name, method name, etc.)
             * @param {*} item - Data item for binding context
             * @param {number} idx - Item index for binding context
             * @param {string} itemName - Item variable name for template expressions
             * @param {string} idxName - Index variable name for template expressions
             */
            processBinding(element, type, target, item, idx, itemName, idxName) {
                // Map of specific binding types to their handlers
                const bindingMap = {
                    // Class binding: conditionally add CSS class based on expression value
                    class: () => {
                        if (this.evalExpr(target, item, idx, itemName, idxName)) {
                            const className = target.includes('.') ? target.split('.').pop() : target;
                            element.classList.add(className);
                        }
                    },

                    // Checked binding: set checkbox/radio checked state based on expression
                    checked: () => {
                        element.checked = !!this.evalExpr(target, item, idx, itemName, idxName);
                    }
                };

                // Execute specific binding handler if available
                if (bindingMap[type]) {
                    bindingMap[type]();
                } else if (U.isEvent(type)) {
                    // Event binding: attach event listener that calls abstraction method
                    element.addEventListener(type, ev => {
                        if (typeof this.abstraction[target] === 'function') {
                            // Call method with item, index, and event as parameters
                            this.abstraction[target].call(this.abstraction, item, idx, ev);
                        }
                    });
                } else {
                    // Generic attribute binding: set attribute value from expression
                    const val = this.evalExpr(target, item, idx, itemName, idxName);
                    if (val != null) {
                        element.setAttribute(type, val);
                    }
                }
            },

            /**
             * Simple expression evaluator for template binding contexts
             * Evaluates property access expressions in the context of foreach items
             * Supports simple property access and nested object property paths
             * @param {string} expr - The expression to evaluate (e.g., "item.name", "index")
             * @param {*} item - The current item data
             * @param {number} idx - The current item index
             * @param {string} itemName - Variable name for item in expressions
             * @param {string} idxName - Variable name for index in expressions
             * @returns {*} - The evaluated expression result
             */
            evalExpr(expr, item, idx, itemName, idxName) {
                // Direct index reference
                if (expr === idxName) {
                    return idx;
                }

                // Direct item reference
                if (expr === itemName) {
                    return item;
                }

                // Property path on item (e.g., "item.property.subproperty")
                if (expr.startsWith(`${itemName}.`)) {
                    // Navigate the property path starting from the item
                    return expr.substring(itemName.length + 1)
                        .split('.')
                        .reduce((val, p) => val && val.hasOwnProperty(p) ? val[p] : undefined, item);
                }

                // Return literal value if not a recognized expression pattern
                return expr;
            },

            /**
             * Simplified array equality check for performance optimization
             * Performs shallow comparison of array elements using deep equality for objects
             * Used to determine if foreach bindings need DOM updates
             * @param {Array} a - First array to compare
             * @param {Array} b - Second array to compare
             * @returns {boolean} - True if arrays are equal
             */
            arrEq: (a, b) => a.length === b.length && a.every((item, i) => U.deepEq(item, b[i])),

            /**
             * Handles deep property changes with unified logic
             * Manages reactive updates when nested object/array properties change
             * Triggers computed property updates and DOM synchronization
             * @param {string} path - The full property path that changed (e.g., "user.profile.name")
             * @param {*} val - The new value at the changed path
             * @param {string} type - Type of change (set, delete, array-mutation)
             * @param {Object} meta - Additional metadata about the change
             */
            handleDeepChange(path, val, type, meta) {
                // Extract the root property name from the path for reactivity system
                // e.g., "user.profile.name" -> "user"
                const root = path.split('.')[0];

                // Handle nested property changes and cache invalidation
                // For nested property changes, clear the cache for both direct and computed property bindings
                if (type === 'nested-property-change' || (type === 'set' && path.includes('.'))) {
                    let foundForeach = false;

                    // Get all computed properties that depend on this root property
                    // This ensures we update computed values that might be affected by the change
                    const dependentComputed = this.propDeps.get(root) || [];

                    // Iterate through all bindings to find affected foreach loops
                    this.bindings.forEach((binding, key) => {
                        // Check if this is a foreach binding that needs cache invalidation
                        if (binding.type === 'foreach') {
                            // Clear cache if binding is directly on the root property
                            // OR on a computed property that depends on root
                            if (binding.collection === root || dependentComputed.includes(binding.collection)) {
                                // Clear the previous value cache to force re-render
                                // This ensures the foreach loop will detect changes and update the DOM
                                binding.prev = null;
                                foundForeach = true;
                            }
                        }
                    });
                }

                // Update computed properties that depend on the changed root property
                // This ensures derived values are recalculated when their dependencies change
                this.updateComputed(root);

                // Trigger DOM updates for various change types
                // Check if this change requires a DOM update based on change type or property existence
                if (type === 'array-mutation' ||          // Array was modified (push, pop, splice, etc.)
                    type === 'nested-property-change' ||  // Nested object property was changed
                    type === 'set' ||                     // Property was directly set
                    this.abstraction.hasOwnProperty(root)) { // Root property exists in the data model

                    // Update the DOM to reflect the new value
                    this.updateDOM(root, this.abstraction[root]);
                }

                // Notify parent component of the property change for hierarchical communication
                // This enables parent-child component communication in nested component structures
                this.notifyParent('propertyChange', {
                    property: root,    // The root property that changed
                    path,             // The full path of the change
                    newValue: val     // The new value (note: original code had 'newValue' without defining it)
                });
            },

            /**
             * Batched DOM updates with requestAnimationFrame for optimal performance
             * Queues property updates to be processed in the next animation frame
             * Prevents excessive DOM manipulation during rapid property changes
             * @param {string} prop - Property name that changed
             * @param {*} val - New property value
             */
            updateDOM(prop, val) {
                // Initialize batching system if not already active
                if (!this.pending) {
                    this.pending = new Set();        // Set of properties pending update
                    this.pendingVals = {};           // Map of property -> new value

                    // Schedule flush for next animation frame (or fallback to setTimeout)
                    const self = this;
                    (window.requestAnimationFrame || (f => setTimeout(f, 0)))(() => {
                        self.flushDOM();
                    });
                }

                // Add this property to the pending updates queue
                this.pending.add(prop);
                this.pendingVals[prop] = val;
            },

            /**
             * Flushes all pending DOM updates efficiently in a single batch
             * Processes all queued property changes and applies them to bindings
             * Clears the pending queue after processing to prepare for next batch
             */
            flushDOM() {
                // Exit early if no updates are pending
                if (!this.pending) {
                    return;
                }

                // Process each property that has pending changes
                this.pending.forEach(prop => {
                    // Apply the property change to all relevant bindings
                    this.bindings.forEach(binding => this.updateBinding(binding, prop, this.pendingVals[prop]));
                });

                // Clear the pending updates queue after processing
                this.pending = null;
                this.pendingVals = null;
            },

            /**
             * Updates text content with interpolated property values
             * Handles property path resolution and display formatting
             * @param {Object} binding - Text binding configuration object
             * @param {string} prop - Property name that changed
             * @param {*} val - New property value
             */
            updateText(binding, prop, val) {
                // Check if this binding should be updated
                if (binding.property !== prop &&
                    (!binding.parsedExpression || !binding.parsedExpression.dependencies.includes(prop))) {
                    return;
                }

                let displayValue;

                // Handle ternary expressions
                if (binding.parsedExpression && binding.expressionContent) {
                    displayValue = this.evaluateExpression(binding.parsedExpression);
                } else {
                    // Fallback to simple property path resolution
                    displayValue = this.resolvePropertyPath(binding.propertyPath || binding.property);
                }

                // Format the value for display
                const formattedValue = this.formatDisplayValue(displayValue);

                // Create regex to match the specific expression in template
                const escapedMatch = binding.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedMatch, 'g');

                // Update the text content by replacing template placeholders
                (binding.textNode || binding.element).textContent = binding.origText.replace(regex, formattedValue);
            },

            /**
             * Updates attribute bindings on DOM elements
             * Handles both simple properties and complex property paths
             * Sets or removes attributes based on resolved values
             * @param {Object} binding - Attribute binding configuration object
             * @param {string} prop - Property name that changed
             * @param {*} val - New property value
             */
            updateAttribute(binding, prop, val) {
                // Resolve the actual value using property path if available
                // This handles nested property access (e.g., user.profile.name)
                const actualValue = binding.propertyPath && binding.propertyPath !== binding.property ?
                    this.resolvePropertyPath(binding.propertyPath) : val;

                // Set or remove the attribute based on the resolved value
                if (actualValue != null) {
                    binding.element.setAttribute(binding.attribute, actualValue);
                } else {
                    // Remove attribute when value is null/undefined
                    binding.element.removeAttribute(binding.attribute);
                }
            },

            /**
             * Updates input element values for two-way data binding
             * Only updates if the value has actually changed to prevent cursor issues
             * Handles form controls like text inputs, textareas, and selects
             * @param {Object} binding - Input binding configuration object
             * @param {string} prop - Property name that changed
             * @param {*} val - New property value
             */
            updateInput(binding, prop, val) {
                // Only update if the property matches and the value has actually changed
                // This prevents unnecessary updates and cursor position issues
                if (binding.property === prop && binding.element.value !== val) {
                    binding.element.value = val;
                }
            },

            /**
             * Updates checkbox/radio button checked state
             * Converts values to boolean and only updates if state changed
             * Prevents unnecessary DOM manipulation for unchanged states
             * @param {Object} binding - Checked binding configuration object
             * @param {string} prop - Property name that changed
             * @param {*} val - New property value
             */
            updateChecked(binding, prop, val) {
                // Convert value to boolean and only update if state has changed
                if (binding.property === prop && binding.element.checked !== !!val) {
                    binding.element.checked = !!val;
                }
            },

            /**
             * Updates element visibility based on binding conditions
             * Handles both direct values and complex property paths
             * Supports negation for hide-when-true scenarios
             * @param {Object} binding - Visibility binding configuration object
             * @param {*} val - Value to test for visibility (may be unused if property path differs)
             */
            updateVisible(binding, val) {
                // Resolve the actual value using property path if available
                // This enables complex visibility conditions like "todos.length"
                const actualValue = binding.propertyPath && binding.propertyPath !== binding.property ?
                    this.resolvePropertyPath(binding.propertyPath) : val;

                // Apply negation logic if present (for hide-when-true scenarios)
                const show = binding.isNegated ? !actualValue : !!actualValue;

                // Delegate to helper method for actual DOM manipulation
                this.toggleElementVisibility(binding.element, show);
            },

            /**
             * Helper methods extracted for reusability
             * Formats different value types for appropriate display in text content
             * Handles objects, arrays, primitives, and null/undefined values
             * @param {*} value - The value to format for display
             * @returns {string} - Formatted display string
             */
            formatDisplayValue(value) {
                if (typeof value === 'object' && value !== null) {
                    // Format arrays as item count, objects as formatted JSON
                    return Array.isArray(value) ?
                        `[${value.length} items]` :
                        JSON.stringify(value, null, 2);
                }

                // Return empty string for null/undefined, otherwise convert to string
                return value == null ? '' : value;
            },

            /**
             * Toggles element visibility while preserving original display style
             * Stores and restores the original CSS display value when showing/hiding
             * Uses custom attributes to track visibility state and original styles
             * @param {Element} el - The element to show or hide
             * @param {boolean} show - Whether to show (true) or hide (false) the element
             */
            toggleElementVisibility(el, show) {
                if (show) {
                    // Show the element by restoring original display style
                    if (el.hasAttribute('data-pac-hidden')) {
                        el.style.display = el.getAttribute('data-pac-orig-display') || '';
                        el.removeAttribute('data-pac-hidden');
                        el.removeAttribute('data-pac-orig-display');
                    }
                } else {
                    // Hide the element by setting display: none
                    if (!el.hasAttribute('data-pac-hidden')) {
                        const orig = getComputedStyle(el).display;

                        // Store original display value if it's not already 'none'
                        if (orig !== 'none') {
                            el.setAttribute('data-pac-orig-display', orig);
                        }

                        el.style.display = 'none';
                        el.setAttribute('data-pac-hidden', 'true');
                    }
                }
            },

            /**
             * Resolves property paths like "items.length" or "user.profile.name"
             * Safely navigates nested object properties without throwing errors
             * Returns undefined for invalid or non-existent property paths
             * @param {string} path - The property path to resolve (dot-separated)
             * @returns {*} - The resolved value or undefined if path is invalid
             */
            resolvePropertyPath(path) {
                return path.split('.').reduce((current, part) =>
                    current == null ? undefined : current[part], this.abstraction);
            },

            /**
             * Enhanced computed property handling with better dependency tracking
             * Analyzes computed function source code to automatically detect dependencies
             * Uses regex parsing to find 'this.property' references in function body
             * @param {Function} fn - The computed property function to analyze
             * @returns {Array} - Array of property names this function depends on
             */
            analyzeComputed(fn) {
                if (!fn || typeof fn !== 'function') {
                    return [];
                }

                try {
                    const deps = [];
                    // Regular expression to find 'this.property' references in function source
                    const regex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
                    let match;

                    // Extract function source and find all property references
                    while ((match = regex.exec(fn.toString()))) {
                        const prop = match[1];

                        // Only include properties that exist in original data
                        // Exclude computed properties to prevent circular dependencies
                        if (this.orig.hasOwnProperty(prop) &&
                            (!this.orig.computed || !this.orig.computed.hasOwnProperty(prop)) &&
                            !deps.includes(prop)) {
                            deps.push(prop);
                        }
                    }
                    return deps;
                } catch (error) {
                    console.error('Error analyzing computed function:', error);
                    return [];
                }
            },

            /**
             * Updates computed properties that depend on a changed property
             * Handles cascading updates when computed properties depend on other computed properties
             * Includes performance optimization to avoid unnecessary recalculations
             * @param {string} changed - Name of the property that changed
             */
            updateComputed(changed) {
                // Get all computed properties that depend on the changed property
                const deps = this.propDeps.get(changed) || [];

                // Process each dependent computed property
                deps.forEach(computed => {
                    // Store previous value for change detection and notifications
                    const old = this.computedCache.get(computed);
                    if (!this.orig.computed) {
                        return;
                    }

                    // Get the computed property function from configuration
                    const fn = this.orig.computed[computed];
                    if (!fn || typeof fn !== 'function') {
                        return;
                    }

                    try {
                        // Execute the computed function in the context of reactive abstraction
                        const val = fn.call(this.abstraction);

                        // Check if any foreach bindings use this computed property
                        // This is important because foreach needs updates even if array reference is same
                        const hasArray = Array.from(this.bindings.values())
                            .some(b => b.type === 'foreach' && b.collection === computed);

                        // Update only if value changed or if foreach binding needs update
                        if (hasArray || !U.deepEq(old, val)) {
                            // Cache the new computed value for future access
                            this.computedCache.set(computed, val);

                            // Trigger DOM updates for elements bound to this computed property
                            this.updateDOM(computed, val);

                            // Notify parent component of computed property change
                            this.notifyParent('propertyChange', {
                                property: computed,
                                oldValue: old,
                                newValue: val,
                                computed: true
                            });

                            // Recursively update computed properties that depend on this one
                            this.updateComputed(computed);
                        }
                    } catch (error) {
                        console.error(`Error executing computed property '${computed}':`, error);
                    }
                });
            },

            /**
             * Creates the main reactive object that serves as the data model
             * Sets up computed properties, regular properties, and communication methods
             * @returns {Object} - The reactive abstraction object with getters/setters
             */
            createReactiveAbs() {
                // Initialize empty reactive object that will become the data model
                const reactive = {};

                // Setup computed properties first (they may depend on regular properties)
                // Computed properties are derived values that automatically update when dependencies change
                this.setupComputedProperties(reactive);

                // Setup regular properties from original configuration
                // Iterate through all properties defined in the original configuration object
                Object.keys(this.orig).forEach(key => {
                    // Only process properties that exist on the object itself (not inherited)
                    // Skip the 'computed' property as it's handled separately above
                    if (this.orig.hasOwnProperty(key) && key !== 'computed') {
                        const val = this.orig[key];

                        // Handle function properties (methods)
                        if (typeof val === 'function') {
                            // Bind methods to reactive object so 'this' refers to reactive instance
                            // This ensures methods have access to reactive properties and other methods
                            reactive[key] = val;
                        } else {
                            // Handle data properties by creating reactive getters/setters
                            // This enables automatic updates and change detection
                            this.createReactiveProp(reactive, key, val);
                        }
                    }
                });

                // Add communication methods for component hierarchy management
                // These methods enable parent-child communication in a component tree structure
                Object.assign(reactive, {
                    // Method to send notifications up the component hierarchy to parent
                    // @param {string} type - The type/name of the notification
                    // @param {*} data - The data payload to send with the notification
                    notifyParent: (type, data) => this.notifyParent(type, data),

                    // Method to broadcast commands/data down to all child components
                    // @param {string} cmd - The command identifier
                    // @param {*} data - The data to send with the command
                    sendToChildren: (cmd, data) => this.sendToChildren(cmd, data),

                    // Method to send commands/data to a specific child component by selector
                    // @param {string} sel - CSS selector to identify the target child component
                    // @param {string} cmd - The command identifier
                    // @param {*} data - The data to send with the command
                    sendToChild: (sel, cmd, data) => {
                        // Find the first child component whose container matches the selector
                        const child = Array.from(this.children).find(c => c.container.matches(sel));

                        // If child exists and has a receiveFromParent method, send the command
                        if (child && child.receiveFromParent) {
                            child.receiveFromParent(cmd, data);
                        }
                    },

                    // Utility method to find a child component using a custom predicate function
                    // @param {Function} pred - Predicate function that returns true for the desired child
                    // @returns {Object|undefined} - The first child that matches the predicate
                    findChild: pred => Array.from(this.children).find(pred),

                    /**
                     * Serializes all non-computed member variables to a JSON-ready object
                     * Excludes undefined values, functions, and computed properties
                     * @returns {Object} - Plain object containing all defined property values
                     */
                    toJSON: () => {
                        const result = {};

                        // Get computed property names to exclude them
                        const computedProps = control.orig.computed ? Object.keys(control.orig.computed) : [];

                        // Iterate through all abstraction properties
                        Object.keys(control.abstraction).forEach(key => {
                            const value = control.abstraction[key];

                            // Include property if:
                            // - It has a defined value (not undefined)
                            // - It's not a function
                            // - It's not a computed property
                            // - It's not one of the built-in communication methods
                            if (value !== undefined &&
                                typeof value !== 'function' &&
                                !computedProps.includes(key) &&
                                !['notifyParent', 'sendToChildren', 'sendToChild', 'findChild', 'toJSON'].includes(key)) {
                                result[key] = value;
                            }
                        });

                        return result;
                    },
                });

                // Return the fully configured reactive object
                return reactive;
            },

            /**
             * Sets up computed properties with dependency tracking and caching
             * Creates getter-only properties that automatically recalculate when dependencies change
             * Builds reverse dependency maps for efficient invalidation
             * @param {Object} reactive - The reactive object to add computed properties to
             */
            setupComputedProperties(reactive) {
                // Early return if no computed properties are defined
                if (!this.orig.computed) {
                    return;
                }

                // Iterate through all defined computed properties
                Object.keys(this.orig.computed).forEach(name => {
                    const computedDef = this.orig.computed[name];

                    // Handle both function and object definitions
                    let getter, setter;

                    if (typeof computedDef === 'function') {
                        // Simple computed property - just a getter function
                        // Example: computed: { fullName() { return this.firstName + ' ' + this.lastName; } }
                        getter = computedDef;
                        setter = null;
                    } else if (computedDef && typeof computedDef === 'object') {
                        // Two-way computed property with get and set methods
                        // Example: computed: { fullName: { get() {...}, set(val) {...} } }
                        getter = computedDef.get;
                        setter = computedDef.set;

                        // Validate that getter function exists
                        if (typeof getter !== 'function') {
                            console.error(`Computed property '${name}' must have a getter function`);
                            return;
                        }
                    } else {
                        // Invalid computed property definition
                        console.error(`Invalid computed property definition for '${name}'`);
                        return;
                    }

                    try {
                        // Analyze the getter function to determine what reactive properties it depends on
                        // This creates a dependency graph for efficient cache invalidation
                        const deps = this.analyzeComputed(getter);
                        this.computedDeps.set(name, deps);

                        // Build reverse dependency map for efficient invalidation
                        // When a reactive property changes, we need to know which computed properties to invalidate
                        deps.forEach(dep => {
                            // Initialize dependency list if it doesn't exist
                            if (!this.propDeps.has(dep)) {
                                this.propDeps.set(dep, []);
                            }

                            // Add this computed property to the dependency list of the reactive property
                            const depList = this.propDeps.get(dep);
                            if (!depList.includes(name)) {
                                depList.push(name);
                            }
                        });

                        // Create the property descriptor for the computed property
                        const descriptor = {
                            get: () => {
                                try {
                                    // Special handling for computed properties that access dynamic children
                                    // These properties need to be recalculated every time since children can change
                                    const fnString = getter.toString();
                                    const accessesChildren = /this\.children|this\.findChild|Array\.from\(this\.children\)/.test(fnString);

                                    if (accessesChildren) {
                                        // Always recalculate for dynamic children access
                                        // Don't use cache since children relationships can change dynamically
                                        const val = getter.call(reactive);
                                        this.computedCache.set(name, val);
                                        return val;
                                    } else {
                                        // Standard caching behavior for static dependencies
                                        // Return cached value if available, otherwise compute and cache
                                        if (this.computedCache.has(name)) {
                                            return this.computedCache.get(name);
                                        }

                                        // Compute new value and store in cache
                                        const val = getter.call(reactive);
                                        this.computedCache.set(name, val);
                                        return val;
                                    }
                                } catch (error) {
                                    // Handle errors gracefully during computation
                                    console.error(`Error computing property '${name}':`, error);
                                    return undefined;
                                }
                            },
                            enumerable: true // Make property visible in for...in loops and Object.keys()
                        };

                        // Add setter functionality if defined (for two-way computed properties)
                        if (setter && typeof setter === 'function') {
                            descriptor.set = (newVal) => {
                                try {
                                    // Clear the cache before calling setter to ensure fresh computation
                                    this.computedCache.delete(name);

                                    // Call the custom setter with the new value
                                    // The setter should modify the underlying reactive properties
                                    setter.call(reactive, newVal);

                                    // The setter should have modified underlying properties,
                                    // which will trigger reactivity and update the computed value
                                    // Force recalculation by clearing cache again (safety measure)
                                    this.computedCache.delete(name);

                                    // Manually trigger DOM updates for this computed property
                                    // This ensures the UI reflects the new computed value immediately
                                    this.updateDOM(name, reactive[name]);

                                } catch (error) {
                                    // Handle setter errors gracefully
                                    console.error(`Error setting computed property '${name}':`, error);
                                }
                            };
                        }

                        // Actually define the computed property on the reactive object
                        // This makes the computed property accessible as a regular property
                        Object.defineProperty(reactive, name, descriptor);

                    } catch (error) {
                        // Handle any errors during the setup process
                        console.error(`Error setting up computed property '${name}':`, error);
                    }
                });
            },

            /**
             * Creates a reactive property with getter/setter that triggers updates
             * Handles deep reactivity for nested objects and arrays
             * Integrates with computed property system and DOM update batching
             * @param {Object} obj - Object to add the reactive property to
             * @param {string} key - Property name
             * @param {*} init - Initial property value
             */
            createReactiveProp(obj, key, init) {
                let val = init;

                // Make initial value reactive if deep reactivity is enabled
                if (this.config.deepReactivity && U.isReactive(val)) {
                    val = createReactive(val, (path, newVal, type, meta) =>
                        this.handleDeepChange(path, newVal, type, meta), key);
                }

                // Define reactive property using Object.defineProperty
                Object.defineProperty(obj, key, {
                    // Getter: simply returns current value
                    get: () => val,

                    // Setter: handles change detection and triggers reactivity system
                    set: newVal => {
                        // Check if change detection is needed (objects always trigger, primitives only if different)
                        const isObj = U.isReactive(val) || U.isReactive(newVal);
                        if (isObj || !U.deepEq(val, newVal)) {
                            const old = val; // Store old value for change notifications

                            // Make new value reactive if it's an object/array
                            if (this.config.deepReactivity && U.isReactive(newVal)) {
                                newVal = createReactive(newVal, (path, changedVal, type, meta) =>
                                    this.handleDeepChange(path, changedVal, type, meta), key);
                            }

                            // Update internal value
                            val = newVal;

                            // Trigger DOM updates and computed property recalculation
                            this.updateDOM(key, newVal);
                            this.updateComputed(key);

                            // Notify parent component of the change
                            this.notifyParent('propertyChange', {
                                property: key,
                                oldValue: old,
                                newValue: newVal
                            });
                        }
                    },
                    enumerable: true // Make property enumerable for Object.keys(), etc.
                });
            },

            /**
             * Unified binding setup with factory pattern
             * Scans the DOM container for binding directives and creates appropriate binding objects
             * Delegates to specialized methods for text interpolation and attribute bindings
             */
            setupBindings() {
                this.findTextBindings();    // Setup {{property}} text interpolation bindings
                this.findAttrBindings();    // Setup data-pac-bind attribute bindings
            },

            /**
             * Finds and sets up text interpolation bindings {{property}}
             * Scans all text nodes in the container for template expressions
             * Supports property paths like {{user.name}} and {{items.length}}
             */
            findTextBindings() {
                // Create a TreeWalker to traverse only text nodes in the DOM
                // This is more efficient than recursively walking all nodes manually
                const walker = document.createTreeWalker(this.container, NodeFilter.SHOW_TEXT);
                const bindings = [];
                let node;

                // Walk through each text node in the container
                while (node = walker.nextNode()) {
                    const txt = node.textContent;

                    // Enhanced regex to capture any expression inside {{ }}
                    // Matches patterns like {{name}}, {{user.email}}, {{items.length}}
                    // \s* allows for optional whitespace around the expression
                    const matches = txt.match(/\{\{\s*([^}]+)\s*\}\}/g);

                    if (matches) {
                        // Process each template expression found in this text node
                        matches.forEach(match => {
                            // Extract the expression content by removing braces and whitespace
                            // Example: "{{ user.name }}" becomes "user.name"
                            const exprContent = match.replace(/[{}\s]/g, '').trim();

                            // Parse the expression to handle complex cases (functions, operators, etc.)
                            // This likely returns an object with the parsed expression and its dependencies
                            const parsedExpr = this.parseExpression(exprContent);

                            // Get all dependencies for reactivity tracking
                            // If parsing didn't provide dependencies, fall back to the root property
                            // Example: for "user.name.first", dependencies might include ["user", "user.name"]
                            const dependencies = parsedExpr.dependencies || [exprContent.split('.')[0]];

                            // Create a binding for each dependency to ensure proper reactivity
                            // This allows the system to update when any part of the property path changes
                            dependencies.forEach(dep => {
                                // Get the root property name (first part before any dots)
                                // Example: "user.profile.name" -> "user"
                                const rootProperty = dep.split('.')[0];

                                // Create a binding object with all necessary information for updates
                                bindings.push([U.id(), {
                                    type: 'text',                    // Binding type for text interpolation
                                    property: rootProperty,          // Root property for change detection
                                    propertyPath: dep,              // Full property path for value resolution
                                    expressionContent: exprContent, // Original expression without braces
                                    parsedExpression: parsedExpr,   // Parsed expression object
                                    element: node.parentElement,    // Parent element containing the text
                                    origText: txt,                  // Original text content of the node
                                    textNode: node,                 // Reference to the actual text node
                                    fullMatch: match                // Full matched pattern including braces
                                }]);
                            });
                        });
                    }
                }

                // Register all discovered text bindings in the bindings map
                // Each binding gets a unique ID and can be looked up for updates
                bindings.forEach(([key, binding]) => this.bindings.set(key, binding));
            },

            /**
             * Finds and sets up attribute bindings data-pac-bind="..."
             * Processes various binding types: foreach, events, visibility, form inputs, attributes
             * Uses factory pattern to create appropriate binding objects based on type
             */
            findAttrBindings() {
                // Find elements with binding directives, excluding nested foreach children
                const elements = this.container.querySelectorAll('[data-pac-bind]:not([data-pac-bind*="foreach"] [data-pac-bind])');
                const bindings = [];

                Array.from(elements).forEach(el => {
                    const bindStr = el.getAttribute('data-pac-bind');

                    // Handle multiple bindings on single element (comma-separated)
                    bindStr.split(',').forEach(bind => {
                        const [type, target] = bind.trim().split(':').map(s => s.trim());
                        const key = bind + '_' + U.id();

                        // Factory pattern for creating different binding types
                        const bindingCreators = {
                            // Collection rendering binding
                            foreach: () => this.createForeachBinding(el, target),

                            // Conditional visibility binding
                            visible: () => this.createVisibilityBinding(el, target),

                            // Two-way form input binding
                            value: () => {
                                this.setupInput(el, target);
                                return this.createInputBinding(el, target);
                            },

                            // Checkbox/radio checked state binding
                            checked: () => {
                                this.setupInput(el, target, 'checked');
                                return this.createCheckedBinding(el, target);
                            }
                        };

                        // Create appropriate binding based on type
                        if (bindingCreators[type]) {
                            bindings.push([key, bindingCreators[type]()]);
                            // Clear foreach template content after storing it
                            if (type === 'foreach') {
                                el.innerHTML = '';
                            }
                        } else if (U.isEvent(type)) {
                            // Event handler binding (click, submit, etc.)
                            bindings.push([key, this.createEventBinding(el, type, target)]);
                        } else if (bind.includes(':') && target) {
                            // Generic attribute binding (class, style, disabled, etc.)
                            bindings.push([key, this.createAttributeBinding(el, type, target)]);
                        } else if (!bind.includes(':')) {
                            // Invalid binding syntax error
                            console.error(`Invalid binding syntax: "${bind}". Use "type:target" format.`);
                        }
                    });
                });

                // Register all discovered attribute bindings
                bindings.forEach(([key, binding]) => this.bindings.set(key, binding));
            },

            /**
             * Simplified binding creators using the generic createBinding method
             * Each creator handles the specific configuration for its binding type
             * Reduces code duplication through consistent patterns
             */

            /**
             * Creates a foreach binding for rendering collections/arrays
             * @param {Element} el - Template element that will be repeated
             * @param {string} target - Property name containing array data
             * @returns {Object} - Foreach binding configuration
             */
            createForeachBinding(el, target) {
                return this.createBinding('foreach', el, {
                    target,
                    collection: target,
                    itemName: el.getAttribute('data-pac-item') || 'item',
                    indexName: el.getAttribute('data-pac-index') || 'index',
                    template: el.innerHTML
                });
            },

            /**
             * Creates an event binding for DOM event handling
             * @param {Element} el - Element that will trigger the event
             * @param {string} type - Event type (click, submit, etc.)
             * @param {string} target - Method name to call when event fires
             * @returns {Object} - Event binding configuration
             */
            createEventBinding(el, type, target) {
                return this.createBinding('event', el, {
                    event: type,
                    method: target
                });
            },

            /**
             * Creates a visibility binding for show/hide functionality
             * @param {Element} el - Element whose visibility will be controlled
             * @param {string} target - Property/condition (supports ! negation)
             * @returns {Object} - Visibility binding configuration
             */
            createVisibilityBinding(el, target) {
                const isNegated = target.startsWith('!');
                const cleanTarget = target.replace(/^!/, '');
                return this.createBinding('visible', el, {
                    target: cleanTarget,
                    condition: target,
                    isNegated
                });
            },

            /**
             * Creates an attribute binding for dynamic attribute values
             * @param {Element} el - Element whose attribute will be bound
             * @param {string} type - Attribute name (class, style, etc.)
             * @param {string} target - Property name containing attribute value
             * @returns {Object} - Attribute binding configuration
             */
            createAttributeBinding(el, type, target) {
                return this.createBinding('attribute', el, {
                    target,
                    attribute: type
                });
            },

            /**
             * Creates an input binding for two-way data binding
             * @param {Element} el - Input element to bind
             * @param {string} bind - Property name to bind to
             * @returns {Object} - Input binding configuration
             */
            createInputBinding(el, bind) {
                return this.createBinding('input', el, {
                    target: bind,
                    updateMode: el.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Creates a checked binding for checkboxes/radio buttons
             * @param {Element} el - Input element to bind
             * @param {string} prop - Property name to bind to
             * @returns {Object} - Checked binding configuration
             */
            createCheckedBinding(el, prop) {
                return this.createBinding('checked', el, {
                    target: prop,
                    updateMode: el.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Sets up input element attributes for data binding
             * Configures elements with necessary data attributes for the binding system
             * @param {Element} el - Input element to configure
             * @param {string} prop - Property name to bind to
             * @param {string} bindingType - Type of binding ('value' or 'checked')
             */
            setupInput(el, prop, bindingType = 'value') {
                el.setAttribute('data-pac-property', prop);
                el.setAttribute('data-pac-binding-type', bindingType);
                el.setAttribute('data-pac-update-mode', el.getAttribute('data-pac-update') || this.config.updateMode);
                el.setAttribute('data-pac-update-delay', el.getAttribute('data-pac-delay') || this.config.delay);
            },

            /**
             * Unified event handling with routing pattern
             * Sets up event listeners for the container and delegates to appropriate handlers
             * Uses event delegation to handle all events from a single container listener
             */
            setupEvents() {
                // Standard DOM events that the framework handles
                const events = ['input', 'change', 'click', 'submit', 'focus', 'blur', 'keyup', 'keydown'];

                events.forEach(type => {
                    const handler = ev => this.handleEvent(ev);
                    this.container.addEventListener(type, handler);
                    this.listeners.set(type, handler); // Store for cleanup during destroy
                });
            },

            /**
             * Main event router that delegates to specific handlers based on event type
             * Uses strategy pattern to route events to appropriate processing methods
             * Handles both data binding events and custom event bindings
             * @param {Event} ev - The DOM event object
             */
            handleEvent(ev) {
                const {type, target} = ev;
                const prop = target.getAttribute('data-pac-property');

                // Route events using strategy pattern for cleaner code organization
                const eventHandlers = {
                    // Handle input events for real-time data binding
                    input: () => prop && this.abstraction.hasOwnProperty(prop) && this._handleInputEvent(ev, target, prop),

                    // Handle change events for delayed data binding
                    change: () => prop && this.abstraction.hasOwnProperty(prop) && this._handleChangeEvent(ev, target, prop),

                    // Default handler for custom event bindings (click, submit, etc.)
                    default: () => this._handleEventBinding(ev, type, target)
                };

                // Execute appropriate handler
                const handler = eventHandlers[type] || eventHandlers.default;
                handler();
            },

            /**
             * Handles input events based on the element's configured update mode
             * Supports three update modes: change (wait for blur), immediate, and delayed
             * Manages two-way data binding for form controls
             * @param {Event} ev - The input event
             * @param {Element} target - The input element that triggered the event
             * @param {string} prop - The bound property name
             */
            _handleInputEvent(ev, target, prop) {
                // Determine update strategy from element configuration
                const mode = target.getAttribute('data-pac-update-mode') || this.config.updateMode;
                const bindingType = target.getAttribute('data-pac-binding-type') || 'value';

                // Extract appropriate value based on element type
                const value = bindingType === 'checked' ? target.checked : target.value;

                // Strategy pattern for different update modes
                const modeHandlers = {
                    // CHANGE MODE: Store value but don't update model until change event
                    change: () => target.setAttribute('data-pac-pending-value', value),

                    // IMMEDIATE MODE: Update model immediately on every keystroke
                    immediate: () => this.abstraction[prop] = value,

                    // DELAYED MODE: Use debounced updates for better performance
                    delayed: () => this.updateFromDOM(target, prop, value),

                    // Fallback for unknown modes
                    default: () => {
                        console.warn(`Unknown update mode: ${mode}. Using immediate.`);
                        this.abstraction[prop] = value;
                    }
                };

                (modeHandlers[mode] || modeHandlers.default)();
            },

            /**
             * Handles change events for bound form elements
             * Commits pending values and cleans up delayed update timeouts
             * Ensures data model stays synchronized with user changes
             * @param {Event} ev - The change event
             * @param {Element} target - The input element that changed
             * @param {string} prop - The bound property name
             */
            _handleChangeEvent(ev, target, prop) {
                // Generate unique key for tracking delayed updates per element
                const delayKey = `${prop}_${target.getAttribute('data-pac-property')}`;
                const bindingType = target.getAttribute('data-pac-binding-type') || 'value';

                // Cancel any pending delayed update for this element
                if (this.delays.has(delayKey)) {
                    clearTimeout(this.delays.get(delayKey));
                    this.delays.delete(delayKey);
                }

                // Extract current value and commit to data model
                this.abstraction[prop] = bindingType === 'checked' ? target.checked : target.value;

                // Clean up pending value marker
                target.removeAttribute('data-pac-pending-value');
            },

            /**
             * Handles custom event bindings defined in data-pac-bind attributes
             * Searches for matching event bindings and executes corresponding methods
             * Provides error handling and automatic form submission prevention
             * @param {Event} ev - The DOM event
             * @param {string} type - Event type (click, submit, etc.)
             * @param {Element} target - Element that triggered the event
             */
            _handleEventBinding(ev, type, target) {
                // Search through all registered event bindings for matches
                this.bindings.forEach(binding => {
                    // Check if this binding matches the current event and element
                    if (binding.type === 'event' && binding.event === type && binding.element === target) {
                        const method = this.abstraction[binding.method];

                        // Validate that the bound method exists and is callable
                        if (typeof method !== 'function') {
                            console.warn(`Event handler method '${binding.method}' is not a function`);
                            return;
                        }

                        // Prevent default form submission behavior for submit events
                        if (binding.event === 'submit') {
                            ev.preventDefault();
                        }

                        // Stop event propagation to prevent parent PAC units from handling it
                        ev.stopPropagation();

                        // Execute the method with proper context and error handling
                        try {
                            method.call(this.abstraction, ev);
                        } catch (error) {
                            console.error(`Error executing event handler '${binding.method}':`, error);
                        }
                    }
                });
            },

            /**
             * Updates property from DOM input with configurable timing strategies
             * Handles immediate updates or delayed updates with debouncing
             * Used primarily for delayed update mode to improve performance
             * @param {Element} el - The input element
             * @param {string} prop - Property name to update
             * @param {*} val - New value to set
             */
            updateFromDOM(el, prop, val) {
                const mode = el.getAttribute('data-pac-update-mode') || this.config.updateMode;
                const delay = parseInt(el.getAttribute('data-pac-update-delay')) || this.config.delay;

                // Immediate mode: update right away
                if (mode === 'immediate') {
                    this.abstraction[prop] = val;
                    return;
                }

                // Delayed mode: use debouncing to batch rapid changes
                if (mode === 'delayed') {
                    const key = `${prop}_${el.id || el.getAttribute('data-pac-property')}`;

                    // Clear any existing timeout for this element
                    if (this.delays.has(key)) {
                        clearTimeout(this.delays.get(key));
                    }

                    // Set new timeout for delayed update
                    const id = setTimeout(() => {
                        this.abstraction[prop] = val;
                        this.delays.delete(key);
                    }, delay);

                    this.delays.set(key, id);
                }
            },

            /**
             * Simplified hierarchy management
             * Establishes parent-child relationships between PAC components
             * Updates relationships when new components are added to the DOM
             */
            establishHierarchy() {
                const {parent, children} = window.PACRegistry.getHierarchy(this.container);

                // Set up parent relationship if found and not already established
                if (parent && this.parent !== parent) {
                    this.parent = parent;
                    parent.children.add(this);

                    // Refresh parent's computed properties that might depend on children
                    this.refreshChildDependentComputed(parent);
                }

                // Set up child relationships for all discovered children
                children.forEach(child => {
                    if (child.parent !== this) {
                        // Remove child from previous parent if it had one
                        if (child.parent) {
                            child.parent.children.delete(child);
                        }

                        // Establish new parent-child relationship
                        child.parent = this;
                        this.children.add(child);
                    }
                });

                // Refresh computed properties that might depend on children
                this.refreshChildDependentComputed(this);
            },

            /**
             * Refreshes computed properties that might depend on children
             * @param {Object} pacUnit - The PAC unit to refresh
             */
            refreshChildDependentComputed(pacUnit) {
                if (!pacUnit.orig.computed) {
                    return;
                }

                Object.keys(pacUnit.orig.computed).forEach(name => {
                    const fn = pacUnit.orig.computed[name];
                    if (typeof fn === 'function') {
                        const fnString = fn.toString();
                        // Check if this computed property accesses children
                        if (/this\.children|this\.findChild|Array\.from\(this\.children\)/.test(fnString)) {
                            // Clear cache to force recomputation
                            pacUnit.computedCache.delete(name);
                            // Trigger DOM update for this computed property
                            pacUnit.updateDOM(name, pacUnit.abstraction[name]);
                        }
                    }
                });
            },

            /**
             * Communication methods with consistent patterns
             * These methods enable hierarchical component communication
             */

            /**
             * Notifies parent PAC unit of events and state changes
             * Part of the hierarchical communication system
             * @param {string} type - Type of notification (e.g., 'propertyChange')
             * @param {*} data - Notification data payload
             */
            notifyParent(type, data) {
                if (this.parent && typeof this.parent.receiveUpdate === 'function') {
                    this.parent.receiveUpdate(type, data, this);
                }
            },

            /**
             * Receives updates from child PAC units
             * Calls user-defined handlers and dispatches DOM events for additional handling
             * @param {string} type - Update type
             * @param {*} data - Update data
             * @param {Object} child - Child PAC unit that sent the update
             */
            receiveUpdate(type, data, child) {
                // Call user-defined handler if it exists
                if (this.abstraction.onChildUpdate) {
                    this.abstraction.onChildUpdate(type, data, child);
                }

                // Dispatch DOM event for additional handling opportunities
                this.container.dispatchEvent(new CustomEvent('pac:childupdate', {
                    detail: {eventType: type, data, childPAC: child},
                    bubbles: true
                }));

                // REFRESH COMPUTED PROPERTIES that might depend on child state
                this.refreshChildDependentComputed(this);
            },

            /**
             * Receives commands from parent PAC unit
             * Enables top-down communication in the component hierarchy
             * @param {string} cmd - Command name
             * @param {*} data - Command data payload
             */
            receiveFromParent(cmd, data) {
                // Call user-defined handler if it exists
                if (this.abstraction.receiveFromParent) {
                    this.abstraction.receiveFromParent(cmd, data);
                }

                // Dispatch DOM event for declarative handling
                this.container.dispatchEvent(new CustomEvent('pac:parentcommand', {
                    detail: {command: cmd, data},
                    bubbles: true
                }));
            },

            /**
             * Sends commands to all child PAC units
             * Broadcasts messages down the component hierarchy
             * @param {string} cmd - Command name
             * @param {*} data - Command data payload
             */
            sendToChildren(cmd, data) {
                this.children.forEach(child => {
                    if (typeof child.receiveFromParent === 'function') {
                        child.receiveFromParent(cmd, data);
                    }
                });
            },

            /**
             * Initialization and cleanup methods
             * Handle component lifecycle and resource management
             */

            /**
             * Performs initial DOM update with all current property values
             * Synchronizes the DOM state with the initial data model
             * Initializes foreach bindings and computed properties
             */
            initialUpdate() {
                // Update all regular properties to sync DOM with initial state
                Object.keys(this.abstraction).forEach(key => {
                    if (this.abstraction.hasOwnProperty(key) && typeof this.abstraction[key] !== 'function') {
                        this.updateDOM(key, this.abstraction[key]);
                    }
                });

                // Update all computed properties
                if (this.orig.computed) {
                    Object.keys(this.orig.computed).forEach(name => {
                        this.updateDOM(name, this.abstraction[name]);
                    });
                }

                // Initialize foreach bindings with empty state
                this.bindings.forEach(binding => {
                    if (binding.type === 'foreach') {
                        binding.prev = []; // Initialize comparison array
                        const val = this.abstraction[binding.collection];

                        if (val !== undefined) {
                            this.updateForeach(binding, binding.collection, val);
                        }
                    }
                });
            },

            /**
             * Cleans up the PAC unit and removes all listeners and references
             * Prevents memory leaks by properly disposing of resources
             * Should be called when removing components from the DOM
             */
            destroy() {
                // Remove all DOM event listeners
                this.listeners.forEach((handler, type) => {
                    this.container.removeEventListener(type, handler);
                });

                // Clear all pending timeouts to prevent delayed execution
                this.delays.forEach(id => clearTimeout(id));

                // Clean up hierarchy relationships
                if (this.parent) {
                    this.parent.children.delete(this);
                }

                this.children.forEach(child => child.parent = null);

                // Clear all internal caches and maps to free memory
                [this.computedCache, this.computedDeps, this.propDeps, this.bindings].forEach(map => map.clear());

                // Remove reference to reactive abstraction
                this.abstraction = null;
            },

            /**
             * Initializes the PAC unit by setting up all systems
             * Entry point that coordinates the setup of bindings, reactivity, and events
             * @returns {Object} - The control object for method chaining
             */
            init() {
                this.setupBindings();                    // Scan DOM for binding directives
                this.trackPropertyPathDependencies();    // Set up dependency tracking for complex paths
                this.abstraction = this.createReactiveAbs(); // Create reactive data model
                this.setupEvents();                      // Attach event listeners
                this.initialUpdate();                    // Sync initial DOM state
                return this;
            },

            /**
             * Tracks dependencies for property paths in text bindings
             * Ensures that complex property paths like "items.length" trigger updates correctly
             * Builds dependency maps for efficient change propagation
             */
            trackPropertyPathDependencies() {
                this.bindings.forEach(binding => {
                    if (binding.type === 'text' && binding.propertyPath) {
                        const parts = binding.propertyPath.split('.');

                        // Track all parts of the property path for reactivity
                        for (let i = 0; i < parts.length; i++) {
                            const rootProp = parts[0];

                            // Initialize dependency tracking for root property
                            if (!this.propDeps.has(rootProp)) {
                                this.propDeps.set(rootProp, []);
                            }

                            // Add this binding to dependency list if not already present
                            const deps = this.propDeps.get(rootProp);
                            if (!deps.includes(binding)) {
                                deps.push(binding);
                            }
                        }
                    }
                });
            }
        };

        // Initialize the control object
        const unit = control.init();

        /**
         * Creates the public API with a cleaner separation of concerns
         * Provides external interface while keeping internal control methods private
         * Includes communication methods and child management functionality
         * @param {Object} unit - The initialized control unit
         * @param {Object} control - The internal control object
         * @returns {Object} - Public API object with abstraction properties and methods
         */
        function createPublicAPI(unit, control) {
            const api = {};

            // Add public methods for component management and communication
            Object.assign(api, {
                /**
                 * Child management methods for programmatic hierarchy control
                 */

                /**
                 * Manually adds a child PAC unit to this component
                 * @param {Object} child - Child PAC unit to add
                 */
                addChild: child => {
                    control.children.add(child);
                    child.parent = control;
                },

                /**
                 * Removes a child PAC unit from this component
                 * @param {Object} child - Child PAC unit to remove
                 */
                removeChild: child => {
                    control.children.delete(child);
                    child.parent = null;
                },

                /**
                 * Communication methods for hierarchical component interaction
                 */
                notifyParent: (type, data) => control.notifyParent(type, data),
                receiveUpdate: (type, data, child) => control.receiveUpdate(type, data, child),
                receiveFromParent: (cmd, data) => control.receiveFromParent(cmd, data),
                sendToChildren: (cmd, data) => control.sendToChildren(cmd, data),

                /**
                 * Targeted child communication with enhanced API
                 * Sends command to specific child component matching CSS selector
                 * @param {string} sel - CSS selector to match child component
                 * @param {string} cmd - Command name
                 * @param {*} data - Command data
                 */
                sendToChild: (sel, cmd, data) => {
                    const child = Array.from(control.children).find(c => c.container.matches(sel));

                    if (child && child.receiveFromParent) {
                        child.receiveFromParent(cmd, data);
                    }
                },

                /**
                 * Child finding and querying methods
                 */
                findChild: pred => Array.from(control.children).find(pred),
                findChildren: pred => Array.from(control.children).filter(pred),
                findChildBySelector: sel => Array.from(control.children).find(c => c.container.matches(sel)),
                findChildByProperty: (prop, val) => Array.from(control.children).find(c =>
                    c.abstraction && c.abstraction[prop] === val),

                /**
                 * Server communication with automatic property updates
                 * Provides built-in fetch wrapper with PAC-specific features
                 * @param {string} url - Server endpoint URL
                 * @param {Object} opts - Request options with PAC extensions
                 * @returns {Promise} - Promise resolving to server response
                 */
                control: (url, opts = {}) => {
                    return fetch(url, {
                        method: opts.method || 'GET',
                        headers: Object.assign({
                            'Content-Type': 'application/json',
                            'X-PAC-Request': 'true'  // Identify PAC framework requests
                        }, opts.headers || {}),
                        body: opts.data ? JSON.stringify(opts.data) : undefined
                    })
                        .then(r => r.json())
                        .then(data => {
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

                /**
                 * Component lifecycle method
                 */
                destroy: () => control.destroy()
            });

            // Copy all abstraction properties and methods
            Object.entries(Object.getOwnPropertyDescriptors(unit.abstraction)).forEach(([key, descriptor]) => {
                if (typeof descriptor.value === 'function') {
                    if (!api.hasOwnProperty(key)) {
                        api[key] = descriptor.value.bind(api);
                    }
                } else if (descriptor.get || descriptor.set) {
                    Object.defineProperty(api, key, {
                        ...descriptor,
                        get: descriptor.get,
                        set: descriptor.set
                    });
                } else {
                    api[key] = descriptor.value;
                }
            });

            // Define read-only properties for component introspection
            Object.defineProperties(api, {
                parent: {get: () => control.parent, enumerable: true},
                children: {get: () => Array.from(control.children), enumerable: true},
                container: {get: () => control.container, enumerable: true}
            });

            return api;
        }

        // Initialize and create public API
        const api = createPublicAPI(unit, control);

        // Register component in global registry
        window.PACRegistry.register(selector, control);
        control.establishHierarchy();

        // Re-establish hierarchy for existing components that might be affected
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