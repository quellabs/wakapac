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

    // =============================================================================
    // CONSTANTS AND CONFIGURATION
    // =============================================================================

    /**
     * Array mutation methods that trigger reactivity updates
     * @constant {string[]}
     */
    const ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

    /**
     * HTML attributes that are boolean (present = true, absent = false)
     * @constant {string[]}
     */
    const BOOLEAN_ATTRS = ['readonly', 'required', 'selected', 'checked', 'hidden', 'multiple'];

    /**
     * Common DOM event types for event listeners
     * @type {string[]}
     */
    const EVENT_TYPES = ['input', 'change', 'click', 'submit', 'focus', 'blur', 'keyup', 'keydown'];

    /**
     * Event key mappings for modifier handling
     * @constant {Object.<string, string|string[]>}
     */
    const EVENT_KEYS = {
        'enter': 'Enter',
        'escape': 'Escape',
        'esc': 'Escape',
        'space': ' ',
        'tab': 'Tab',
        'delete': ['Delete', 'Backspace'],
        'del': ['Delete', 'Backspace'],
        'up': 'ArrowUp',
        'down': 'ArrowDown',
        'left': 'ArrowLeft',
        'right': 'ArrowRight'
    };

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Core utility functions for the framework
     * @namespace Utils
     */
    const Utils = {

        /**
         * Check if Proxy is supported in the current environment
         * @type {boolean}
         */
        hasProxy: typeof Proxy !== 'undefined',

        /**
         * Determines if a value should be made reactive using Proxy mechanism
         * Simple values (primitives) are handled separately and don't need Proxy
         * @param {*} value - Value to test
         * @returns {boolean} True if value should be proxied for deep reactivity
         */
        isReactive(value) {
            // Primitives don't need Proxy - they're handled by property descriptors
            if (!value || typeof value !== 'object') {
                return false;
            }

            // Null check
            if (value === null) {
                return false;
            }

            // Plain objects (created with {} or new Object() or Object.create(null))
            if (this.isPlainObject(value)) {
                return true;
            }

            // Arrays (but not typed arrays)
            if (Array.isArray(value)) {
                return true;
            }

            // Everything else is NOT reactive by default
            return false;
        },

        /**
         * Check if the property should be reactive
         * @param {string} propertyName - Name of the property
         * @param {*} value - Value to test
         * @returns {boolean} True if property should be reactive
         */
        shouldPropertyBeReactive(propertyName, value) {
            // Library convention (jQuery, etc.)
            if (propertyName.startsWith('_') ||
                propertyName.startsWith('$') ||
                propertyName === 'constructor' ||
                propertyName === 'prototype' ||
                propertyName === '__proto__'
            ) {
                return false;
            }

            // Primitives are always reactive (handled by property descriptors)
            if (value === null || value === undefined ||
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean') {
                return true;
            }

            // For objects, check if they should be proxied for deep reactivity
            return this.isReactive(value);
        },

        /**
         * Checks if an object is a "plain object" - created with object literal,
         * new Object(), or Object.create(null)
         * @param {*} obj - Object to test
         * @returns {boolean} True if it's a plain object
         */
        isPlainObject(obj) {
            // Basic object check
            if (typeof obj !== 'object' || obj === null) {
                return false;
            }

            // Objects created with Object.create(null) have no prototype
            if (Object.getPrototypeOf(obj) === null) {
                return true;
            }

            // Objects created with {} or new Object()
            let proto = obj;
            while (Object.getPrototypeOf(proto) !== null) {
                proto = Object.getPrototypeOf(proto);
            }

            return Object.getPrototypeOf(obj) === Object.prototype;
        },

        /**
         * Deep equality comparison optimized for performance
         * @param {*} a - First value
         * @param {*} b - Second value
         * @returns {boolean} True if values are deeply equal
         */
        isEqual(a, b) {
            if (a === b) {
                return true;
            }

            // Handle NaN case
            if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
                return true;
            }

            if (!a || !b || typeof a !== typeof b || typeof a !== 'object') {
                return false;
            }

            if (Array.isArray(a)) {
                return Array.isArray(b) && a.length === b.length &&
                    a.every((item, i) => Utils.isEqual(item, b[i]));
            }

            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            return keysA.length === keysB.length &&
                keysA.every(key => b.hasOwnProperty(key) && Utils.isEqual(a[key], b[key]));
        },

        /**
         * Generates a unique identifier
         * @returns {string} Unique ID string
         */
        generateId() {
            return Date.now() + '_' + (Math.random() * 10000 | 0);
        },

        /**
         * Checks if a string represents a DOM event type
         * @param {string} type - Event type to test
         * @returns {boolean} True if it's a valid event type
         */
        isEventType(type) {
            return /^(click|submit|change|input|focus|blur|key(up|down))$/.test(type);
        },

        /**
         * Splits a property path into segments with caching
         * @param {string} path - Property path like "user.profile.name"
         * @returns {string[]} Array of path segments
         */
        splitPath(path) {
            if (!path || typeof path !== 'string') {
                return [];
            }

            return path.split('.');
        },

        /**
         * Safely resolves a nested property path
         * @param {Object} obj - Object to traverse
         * @param {string} path - Property path
         * @returns {*} Resolved value or undefined
         */
        getNestedValue(obj, path) {
            if (!path) {
                return obj;
            }

            return Utils.splitPath(path).reduce((current, segment) => {
                return current && current.hasOwnProperty(segment) ? current[segment] : undefined;
            }, obj);
        },

        /**
         * Formats a value for display in text content
         * @param {*} value - Value to format
         * @returns {string} Formatted string
         */
        formatValue(value) {
            if (value == null) {
                return '';
            }

            if (typeof value !== 'object') {
                return String(value);
            }

            if (Array.isArray(value)) {
                return `[${value.length} items]`;
            }

            return JSON.stringify(value, null, 2);
        },

        /**
         * Sanitizes user input by stripping HTML tags and returning escaped HTML
         * Uses the browser's built-in text content handling to safely process untrusted input
         * @param {string} html - The potentially unsafe HTML string to sanitize
         * @returns {string} The sanitized string with HTML tags stripped and special characters escaped
         */
        sanitizeUserInput(html) {
            // Create a temporary div element to leverage browser's text content handling
            const div = document.createElement('div');

            // Set textContent (not innerHTML) to automatically strip all HTML tags
            // The browser treats the input as plain text, removing any markup
            div.textContent = html;

            // Return the innerHTML, which gives us the text with HTML entities properly escaped
            // This converts characters like < > & " ' into their HTML entity equivalents
            return div.innerHTML;
        },

        /**
         * Manually escapes HTML special characters to prevent XSS attacks
         * Converts potentially dangerous characters into their HTML entity equivalents
         * @param {string} str - The string containing characters that need to be escaped
         * @returns {string} The escaped string safe for insertion into HTML
         */
        escapeHTML(str) {
            return String(str)
                .replace(/&/g, '&amp;')    // Replace & first (must be done before other entities)
                .replace(/</g, '&lt;')     // Replace < with less-than entity
                .replace(/>/g, '&gt;')     // Replace > with greater-than entity
                .replace(/"/g, '&quot;')   // Replace double quotes with quote entity
                .replace(/'/g, '&#39;');   // Replace single quotes with apostrophe entity
        }
    };

    // =============================================================================
    // COMPONENT REGISTRY
    // =============================================================================

    /**
     * Global registry for managing PAC components and their hierarchical relationships
     * @constructor
     */
    function ComponentRegistry() {
        this.components = new Map();
        this.hierarchyCache = new WeakMap();
    }

    ComponentRegistry.prototype = {
        /**
         * Registers a new PAC component
         * @param {string} selector - CSS selector for the component
         * @param {Object} component - The PAC component control object
         */
        register(selector, component) {
            this.components.set(selector, component);
            this.hierarchyCache = new WeakMap(); // Clear cache
        },

        /**
         * Unregisters a PAC component
         * @param {string} selector - CSS selector for the component
         * @returns {Object|undefined} The removed component
         */
        unregister(selector) {
            const component = this.components.get(selector);

            if (component) {
                this.components.delete(selector);
                this.hierarchyCache = new WeakMap(); // Clear cache

                // If this was the last component, clean up global state
                if (this.components.size === 0) {
                    if (window._wakaPACViewportComponents) {
                        window._wakaPACViewportComponents.clear();
                    }
                }
            }

            return component;
        },

        /**
         * Gets the hierarchy (parent and children) for a given container
         * @param {Element} container - DOM element to find hierarchy for
         * @returns {Object} Object with parent and children properties
         */
        getHierarchy(container) {
            // Pull from cache if possible
            if (this.hierarchyCache.has(container)) {
                return this.hierarchyCache.get(container);
            }

            // Find parent component
            let parent = null;
            let element = container.parentElement;

            while (element && !parent) {
                this.components.forEach(component => {
                    if (component.container === element) {
                        parent = component;
                    }
                });

                element = element.parentElement;
            }

            // Find child components
            const children = [];

            this.components.forEach(component => {
                if (container.contains(component.container) && component.container !== container) {
                    children.push(component);
                }
            });

            const hierarchy = {parent, children};
            this.hierarchyCache.set(container, hierarchy);
            return hierarchy;
        }
    };

    // ============================================================================
    // REACTIVITY SYSTEM
    // ============================================================================

    /**
     * Creates a reactive proxy with deep reactivity support
     * @param {Object} target - Object to make reactive
     * @param {Function} onChange - Change notification callback
     * @param {string} [path=''] - Current property path
     * @returns {Object} Reactive proxy object
     */
    function createReactive(target, onChange, path = '') {
        if (!Utils.isReactive(target)) {
            return target;
        }

        if (Utils.hasProxy) {
            return createProxyReactive(target, onChange, path);
        } else {
            return createFallbackReactive(target, onChange, path);
        }
    }

    /**
     * Creates reactive proxy using ES6 Proxy (modern browsers)
     * @param {Object} target - Target object
     * @param {Function} onChange - Change callback
     * @param {string} path - Property path
     * @returns {Object} Reactive proxy
     */
    function createProxyReactive(target, onChange, path) {
        // Make existing nested objects/arrays reactive immediately
        Object.keys(target).forEach(key => {
            if (target.hasOwnProperty(key) && Utils.isReactive(target[key])) {
                target[key] = createReactive(target[key], onChange, path ? `${path}.${key}` : key);
            }
        });

        // For arrays, also make existing items reactive
        if (Array.isArray(target)) {
            target.forEach((item, index) => {
                if (Utils.isReactive(item)) {
                    target[index] = createReactive(item, onChange, path ? `${path}.${index}` : index);
                }
            });
        }

        // Store original array methods for arrays
        const originalMethods = {};
        const isArray = Array.isArray(target);

        if (isArray) {
            ARRAY_METHODS.forEach(method => {
                originalMethods[method] = target[method];
            });
        }

        return new Proxy(target, {
            get(obj, prop) {
                // Handle array mutation methods
                if (isArray && originalMethods[prop]) {
                    return function (...args) {
                        const result = originalMethods[prop].apply(obj, args);

                        // Make new items reactive
                        if (/^(push|unshift|splice)$/.test(prop)) {
                            obj.forEach((item, index) => {
                                if (Utils.isReactive(item) && !item._isReactive) {
                                    obj[index] = createReactive(item, onChange, `${path}.${index}`);
                                }
                            });
                        }

                        onChange(path || 'root', obj, 'array-mutation', {method: prop, args});
                        return result;
                    };
                }

                return obj[prop];
            },

            set(obj, prop, value) {
                const oldValue = obj[prop];

                // Make new value reactive if needed
                if (Utils.isReactive(value)) {
                    value = createReactive(value, onChange, path ? `${path}.${prop}` : prop);
                }

                obj[prop] = value;

                // Only notify if value actually changed
                if (!Utils.isEqual(oldValue, value)) {
                    const propertyPath = path ? `${path}.${prop}` : prop;
                    onChange(propertyPath, value, 'set', {oldValue});

                    // CRITICAL FIX: Also notify parent array/object about nested changes
                    if (path) {
                        // Extract the root property (e.g., "todos" from "todos.0.completed")
                        const rootProperty = path.split('.')[0];
                        onChange(rootProperty, null, 'nested-change', {
                            nestedPath: propertyPath,
                            oldValue: oldValue,
                            newValue: value
                        });
                    }
                }

                return true;
            },

            deleteProperty(obj, prop) {
                const oldValue = obj[prop];
                delete obj[prop];

                const propertyPath = path ? `${path}.${prop}` : prop;
                onChange(propertyPath, undefined, 'delete', {oldValue});

                // Also notify parent about nested deletion
                if (path) {
                    const rootProperty = path.split('.')[0];
                    onChange(rootProperty, null, 'nested-change', {
                        nestedPath: propertyPath,
                        oldValue: oldValue,
                        newValue: undefined
                    });
                }

                return true;
            }
        });
    }

    /**
     * Creates reactive object using Object.defineProperty (legacy browsers)
     * @param {Object} target - Target object
     * @param {Function} onChange - Change callback
     * @param {string} path - Property path
     * @returns {Object} Reactive object
     */
    function createFallbackReactive(target, onChange, path) {
        // Handle array mutation methods
        if (Array.isArray(target)) {
            ARRAY_METHODS.forEach(method => {
                const original = target[method];

                Object.defineProperty(target, method, {
                    value: function (...args) {
                        const result = original.apply(this, args);
                        onChange(path || 'root', this, 'array-mutation', {method, args});
                        return result;
                    },
                    enumerable: false,
                    configurable: true
                });
            });
        }

        // Make nested objects reactive
        Object.keys(target).forEach(key => {
            if (target.hasOwnProperty(key) && Utils.isReactive(target[key])) {
                target[key] = createReactive(target[key], onChange, path ? `${path}.${key}` : key);
            }
        });

        // Mark as reactive
        Object.defineProperty(target, '_isReactive', {value: true, enumerable: false});
        return target;
    }

    // ============================================================================
    // EXPRESSION PARSER
    // ============================================================================

    /**
     * Sophisticated expression parser for template bindings
     * Supports ternary operators, logical operators (&&, ||), comparisons, and property access
     * @namespace ExpressionParser
     */
    const ExpressionParser = {
        /**
         * Cache for parsed expressions to avoid re-parsing
         * @type {Map<string, Object>}
         */
        cache: new Map(),
        bindingCache: new Map(),

        /**
         * Main entry point for parsing JavaScript-like expressions into an abstract syntax tree (AST).
         * Uses a hierarchical parsing approach, attempting to match operators in order of precedence.
         * Results are cached to improve performance on repeated parsing of the same expressions.
         * @param {string} expression - The expression string to parse (e.g., "user.name", "a > b ? 'yes' : 'no'", "!isActive")
         * @returns {Object|null} Parsed AST node representing the expression structure, or null if unparseable
         */
        parseExpression(expression) {
            // Remove leading/trailing whitespace to normalize input
            expression = expression.trim();

            // Check cache first to avoid redundant parsing of the same expression
            // This is especially beneficial for repeated evaluations in loops or frequent re-renders
            if (this.cache.has(expression)) {
                return this.cache.get(expression);
            }

            // Handle object literals first (before other parsing)
            if (expression.startsWith('{') && expression.endsWith('}')) {
                const result = {
                    type: 'object',
                    value: expression,
                    dependencies: this.extractDependencies(expression)
                };

                this.cache.set(expression, result);
                return result;
            }

            // Parse using operator precedence hierarchy (highest to lowest precedence)
            // Each parser method returns null if it can't handle the expression type
            // The || chain ensures we try progressively simpler parsing approaches
            const result = this.parseTernary(expression) ||      // Conditional: condition ? ifTrue : ifFalse
                this.parseLogical(expression) ||       // Logical: && (and), || (or)
                this.parseComparison(expression) ||    // Comparison: ==, !=, <, >, <=, >=
                this.parseUnary(expression) ||         // Unary: !, -, +
                this.parseParentheses(expression) ||   // Add parentheses parsing here
                this.parseProperty(expression);        // Property access, literals, identifiers

            // Cache the parsed result for future use
            // Even null results are cached to avoid repeated failed parsing attempts
            this.cache.set(expression, result);
            return result;
        },

        /**
         * Attempts to parse a parenthesized expression like "(count > 0 && enabled)"
         * @param {string} expression - Expression to parse
         * @returns {Object|null} Parsed parentheses object or null if not a parenthesized expression
         */
        parseParentheses(expression) {
            // Check if expression is wrapped in parentheses
            if (!expression.startsWith('(') || !expression.endsWith(')')) {
                return null;
            }

            // Extract the inner expression (remove outer parentheses)
            const innerExpression = expression.slice(1, -1).trim();

            // Recursively parse the inner expression
            const innerParsed = this.parseExpression(innerExpression);

            if (!innerParsed) {
                return null;
            }

            // Return a parentheses node that wraps the inner expression
            return {
                type: 'parentheses',
                inner: innerParsed,
                dependencies: innerParsed.dependencies || this.extractDependencies(innerExpression)
            };
        },

        /**
         * Parses a binding string into an array of key-value pairs.
         * Handles nested parentheses, quoted strings, and comma separation while respecting context.
         * Results are cached to improve performance on repeated parsing of the same binding string.
         * @param {string} bindingString - The binding string to parse (e.g., "prop1: value1, prop2: method(arg1, arg2)")
         * @returns {Array} Array of parsed binding pairs
         */
        parseBindingString(bindingString) {
            // Check cache first to avoid redundant parsing
            if (this.bindingCache.has(bindingString)) {
                return this.bindingCache.get(bindingString);
            }

            // Initialize array to store the final parsed key-value pairs
            const pairs = [];

            let current = ''; // Current token being built character by character
            let inQuotes = false; // Flag indicating if we're currently inside quotes
            let quoteChar = ''; // The specific quote character being used (single or double)
            let parenDepth = 0; // Track parentheses depth for expression grouping: (a && b), !(c || d)
            let braceDepth = 0; // Track curly brace depth for object literals: { class: condition }

            // Parse character by character to handle complex nested structures
            for (let i = 0; i < bindingString.length; i++) {
                const char = bindingString[i];
                const isEscaped = i > 0 && bindingString[i - 1] === '\\';

                // Handle quote characters to track string boundaries
                if ((char === '"' || char === "'") && !isEscaped) {
                    if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuotes = false;
                        quoteChar = '';
                    }
                }

                // Track parentheses and braces depth when not inside quotes
                if (!inQuotes) {
                    if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                    } else if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                    }
                }

                // Split on commas only when they're at the top level
                // (not inside quotes, parentheses, or braces)
                if (char === ',' && !inQuotes && parenDepth === 0 && braceDepth === 0) {
                    this.addBindingPairIfValid(current, pairs);
                    current = '';
                } else {
                    current += char;
                }
            }

            // Process the final binding pair
            this.addBindingPairIfValid(current, pairs);

            // Cache the result
            this.bindingCache.set(bindingString, pairs);
            return pairs;
        },

        /**
         * Validates and processes a single binding pair string, then adds it to the pairs array.
         * Handles both simple bindings (just a type) and key-value bindings (type: target).
         * Uses context-aware colon detection to avoid splitting on colons inside nested expressions.
         * @param {string} pairString - Raw binding pair string (e.g., "onClick: handleClick()" or "disabled")
         * @param {Array} pairs - Array to add the processed binding pair to (modified in place)
         */
        addBindingPairIfValid(pairString, pairs) {
            // Remove leading/trailing whitespace and validate the input
            const trimmed = pairString.trim();

            // Skip empty strings (e.g., from trailing commas or extra spaces)
            if (!trimmed) {
                return;
            }

            // Locate the binding colon that separates type from target
            // Uses expression parsing logic to avoid splitting on colons inside quoted strings,
            // function calls, or other nested structures (e.g., "style: { color: 'red' }")
            const colonIndex = this.findBindingColon(trimmed);

            if (colonIndex === -1) {
                // No colon found - this is a simple binding with just a type
                // Common for boolean attributes or event handlers without parameters
                // Examples: "disabled", "required", "click" (shorthand for click: click)
                pairs.push({
                    type: trimmed,    // The binding type/attribute name
                    target: ''        // Empty target indicates a simple binding
                });
            } else {
                // Colon found - this is a key-value binding pair
                // Split on the colon and trim both parts to handle spacing variations
                // Examples: "onClick: handleClick", "class : getClassName()", " value: user.name "
                pairs.push({
                    type: trimmed.substring(0, colonIndex).trim(),      // Everything before colon (attribute/event name)
                    target: trimmed.substring(colonIndex + 1).trim()    // Everything after colon (expression/value)
                });
            }
        },

        /**
         * Finds the binding colon (not expression colons like in ternaries)
         */
        /**
         * Locates the binding colon that separates the binding type from its target expression.
         * Uses a two-phase approach: fast path for common binding types, then comprehensive parsing
         * for complex cases with nested quotes, parentheses, or object literals.
         *
         * @param {string} str - The binding string to search (e.g., "onClick: handleClick()" or "style: { color: 'red' }")
         * @returns {number} Index of the binding colon, or -1 if no valid colon is found
         */
        findBindingColon(str) {
            // Phase 1: Fast path optimization for common binding types
            // This avoids expensive character-by-character parsing for the majority of cases
            // TODO: Consider moving this to a class constant or configuration
            const knownBindingTypes = [
                'value', 'checked', 'visible', 'if', 'foreach', 'class', 'style',      // Data bindings
                'click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'  // Event bindings
            ];

            // Quick pattern matching: if the string starts with "knownType:", return the colon position
            // This handles 90%+ of typical binding cases with minimal processing overhead
            for (const type of knownBindingTypes) {
                if (str.startsWith(type + ':')) {
                    return type.length; // Return index of the colon (length of the binding type)
                }
            }

            // Phase 2: Comprehensive parsing fallback for complex or custom binding types
            // Handles cases like custom bindings, complex expressions, or nested structures
            let inQuotes = false;      // Track if we're inside a quoted string
            let quoteChar = '';        // Remember which quote character opened the current string (' or ")
            let parenDepth = 0;        // Track nesting level of parentheses

            // Parse character by character to find the first "top-level" colon
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const isEscaped = i > 0 && str[i - 1] === '\\';

                // Handle quote boundaries to track string literals
                // Prevents finding colons inside strings like: title: "Hello: World"
                if ((char === '"' || char === "'") && !isEscaped) {
                    if (!inQuotes) {
                        // Starting a new quoted section
                        inQuotes = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        // Ending current quoted section (matching quote type)
                        inQuotes = false;
                        quoteChar = '';
                    }
                }

                // Track parentheses depth when not inside quotes
                // Prevents finding colons inside function calls or object literals
                // Examples: onClick: method(arg1, arg2) or style: { color: 'red', margin: '10px' }
                if (!inQuotes) {
                    if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                    } else if (char === ':' && parenDepth === 0) {
                        // Found a colon at the top level (not inside quotes or parentheses)
                        // This is our binding separator
                        return i;
                    }
                }
            }

            // No valid binding colon found - this might be a simple binding without a value
            // or a malformed binding string
            return -1;
        },

        /**
         * Parses a simple property access expression (fallback for non-operator expressions)
         * @param {string} expression - The property access expression to parse (e.g., "user.name", "items[0].value")
         * @returns {Object} Parsed property object
         */
        parseProperty(expression) {
            return {
                // Mark this as a property access type for the evaluation engine
                type: 'property',

                // Store the original expression path for runtime evaluation
                path: expression,

                // Extract all variable dependencies from this expression
                // This helps with change detection and reactive updates
                dependencies: this.extractDependencies(expression)
            };
        },

        /**
         * Attempts to parse a comparison expression (===, !==, ==, !=, >=, <=, >, <)
         * @param {string} expression - Expression to parse
         * @returns {Object|null} Parsed comparison object or null if not a comparison expression
         */
        parseComparison(expression) {
            // Use regex to match comparison expressions with operators
            const comparisonMatch = expression.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)$/);

            // If no comparison operator pattern is found, this isn't a comparison expression
            if (!comparisonMatch) {
                return null;
            }

            // Destructure the regex match results
            // Skip index 0 (full match) and extract the three capture groups
            const [, left, operator, right] = comparisonMatch;

            // Return structured comparison object
            return {
                type: 'comparison',                                 // Identifies this as a comparison expression
                left: left.trim(),                                  // Left operand with whitespace removed
                operator: operator.trim(),                          // Comparison operator with whitespace removed
                right: this.parseValue(right.trim()),               // Right operand parsed as a value (could be literal, variable, etc.)
                dependencies: this.extractDependencies(left.trim()) // Extract any variable dependencies from left operand
            };
        },

        /**
         * Attempts to parse a logical expression (&&, ||)
         * @param {string} expression - Expression to parse
         * @returns {Object|null} Parsed logical object or null if not a logical expression
         */
        parseLogical(expression) {
            // Use regex to match logical expressions with && or || operators
            const logicalMatch = expression.match(/^(.+?)\s*(&&|\|\|)\s*(.+?)$/);

            // If no logical operator found, this isn't a logical expression
            if (!logicalMatch) {
                return null;
            }

            // Destructure the regex capture groups
            // logicalMatch[0] is the full match, so we skip it with the empty comma
            const [, left, operator, right] = logicalMatch;

            // Return structured object representing the parsed logical expression
            return {
                type: 'logical',                                // Mark this as a logical expression type
                left: left.trim(),                              // Left operand with whitespace removed
                operator: operator.trim(),                      // Logical operator (&&, ||)
                right: right.trim(),                            // Right operand with whitespace removed
                dependencies: [                                 // Collect all dependencies from both sides
                    ...this.extractDependencies(left.trim()),   // Dependencies from left operand
                    ...this.extractDependencies(right.trim())   // Dependencies from right operand
                ]
            };
        },

        /**
         * Parses unary expressions, specifically the logical NOT operator (!).
         * Creates an AST node for unary operations and extracts dependencies from the operand.
         * This handles expressions like "!isActive", "! user.valid", or "!someMethod()".
         * @param {string} expression - The expression string to attempt parsing as a unary operation
         * @returns {Object|null} AST node for unary expression, or null if expression doesn't match unary pattern
         */
        parseUnary(expression) {
            // Use regex to match unary NOT pattern: ! followed by optional whitespace and an operand
            // Pattern breakdown:
            // ^!       - Must start with exclamation mark
            // \s*      - Zero or more whitespace characters (allows "!" or "! " or "!   ")
            // (.+)     - Capture group for the operand (everything after the !)
            // $        - Must match to end of string (ensures we capture the full operand)
            const unaryMatch = expression.match(/^!\s*(.+)$/);

            // If the regex doesn't match, this isn't a unary expression
            if (!unaryMatch) {
                return null;
            }

            // Destructure the regex match results
            // unaryMatch[0] would be the full match, unaryMatch[1] is the first capture group (operand)
            const [, operand] = unaryMatch;

            // Return AST node representing the unary operation
            return {
                type: 'unary',                                          // Node type for AST traversal
                operator: '!',                                          // The unary operator (currently only ! is supported)
                operand: operand.trim(),                                // The expression being negated (whitespace normalized)
                dependencies: this.extractDependencies(operand.trim())  // Variables/properties this expression depends on
            };
        },

        /**
         * Attempts to parse a ternary conditional expression (condition ? trueValue : falseValue)
         * @param {string} expression - Expression to parse
         * @returns {Object|null} Parsed ternary object or null if not a ternary expression
         */
        parseTernary(expression) {
            // Use regex to match the ternary pattern: condition ? trueValue : falseValue
            // The regex captures three groups: condition, trueValue, and falseValue
            // Uses non-greedy matching (.+?) to handle nested expressions correctly
            const ternaryMatch = expression.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/);

            // If the expression doesn't match the ternary pattern, return null
            if (!ternaryMatch) {
                return null;
            }

            // Destructure the regex match results
            // Index 0 is the full match, indices 1-3 are the captured groups
            const [, condition, trueValue, falseValue] = ternaryMatch;

            // Return a structured object representing the parsed ternary expression
            return {
                type: 'ternary',                                         // Identifies this as a ternary expression
                condition: condition.trim(),                             // The boolean condition (whitespace removed)
                trueValue: this.parseValue(trueValue.trim()),            // Recursively parse the true branch value
                falseValue: this.parseValue(falseValue.trim()),          // Recursively parse the false branch value
                dependencies: this.extractDependencies(condition.trim()) // Extract variable dependencies from condition
            };
        },

        /**
         * Parses a value (string literal, number, boolean, object literal, or property reference)
         * @param {string} value - Value to parse
         * @returns {Object} Parsed value object
         */
        parseValue(value) {
            // Remove leading and trailing whitespace from the input
            value = value.trim();

            // Check if value is a string literal (enclosed in single or double quotes)
            if ((value.startsWith("'") && value.endsWith("'")) ||
                (value.startsWith('"') && value.endsWith('"'))) {
                // Return literal object with the string content (quotes removed)
                return {type: 'literal', value: value.slice(1, -1)};
            }

            // Check if value is an object literal (enclosed in curly braces)
            if (value.startsWith('{') && value.endsWith('}')) {
                return {type: 'object', value: value};
            }

            // Check if value is a numeric literal (integer or decimal)
            if (/^\d+(\.\d+)?$/.test(value)) {
                return {type: 'literal', value: parseFloat(value)};
            }

            // Check if value is a boolean literal
            if (value === 'true' || value === 'false') {
                return {type: 'literal', value: value === 'true'};
            }

            // If none of the above patterns match, treat as property reference
            return {type: 'property', path: value};
        },

        /**
         * Extracts property dependencies from an expression
         * @param {string} expression - Expression to analyze
         * @returns {string[]} Array of property names
         */
        extractDependencies(expression) {
            const dependencies = [];
            const jsLiterals = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];

            // Handle object literals specially
            if (expression.trim().startsWith('{') && expression.trim().endsWith('}')) {
                const content = expression.trim().slice(1, -1);
                const pairs = this.parseObjectPairs(content);

                pairs.forEach(({value}) => {
                    const valueDeps = this.extractDependencies(value);
                    valueDeps.forEach(dep => {
                        if (!dependencies.includes(dep)) {
                            dependencies.push(dep);
                        }
                    });
                });

                return dependencies;
            }

            // Enhanced regex to find property access patterns (including complex paths)
            const propertyRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[[^\]]+\])*/g;

            let match;
            while ((match = propertyRegex.exec(expression))) {
                const fullPath = match[0];
                const rootProperty = match[1];

                if (!jsLiterals.includes(rootProperty) && !dependencies.includes(rootProperty)) {
                    dependencies.push(rootProperty);
                }
            }

            return dependencies;
        },

        /**
         * Evaluates a parsed expression in the given context
         * @param {Object} parsedExpr - Parsed expression object
         * @param {Object} context - Evaluation context (abstraction object)
         * @returns {*} Evaluated result
         */
        evaluate(parsedExpr, context) {
            switch (parsedExpr.type) {
                case 'object':
                    return this.evaluateObjectLiteral(parsedExpr.value, context);

                case 'parentheses':
                    return this.evaluate(parsedExpr.inner, context);

                case 'ternary':
                    const condition = this.evaluateCondition(parsedExpr.condition, context);

                    return condition ?
                        this.evaluateValue(parsedExpr.trueValue, context) :
                        this.evaluateValue(parsedExpr.falseValue, context);

                case 'logical':
                    const leftLogical = this.evaluateCondition(parsedExpr.left, context);

                    // Short-circuit evaluation for logical operators
                    if (parsedExpr.operator === '&&') {
                        return leftLogical ? this.evaluateCondition(parsedExpr.right, context) : false;
                    } else if (parsedExpr.operator === '||') {
                        return leftLogical ? true : this.evaluateCondition(parsedExpr.right, context);
                    } else {
                        return false;
                    }

                case 'unary':
                    const operandValue = this.evaluateCondition(parsedExpr.operand, context);
                    return parsedExpr.operator === '!' ? !operandValue : operandValue;

                case 'comparison':
                    const leftValue = Utils.getNestedValue(context, parsedExpr.left);
                    const rightValue = this.evaluateValue(parsedExpr.right, context);
                    return this.performComparison(leftValue, parsedExpr.operator, rightValue);

                case 'property':
                    return Utils.getNestedValue(context, parsedExpr.path);

                default:
                    return undefined;
            }
        },

        /**
         * Evaluates a condition expression to boolean
         * @param {string} condition - Condition string
         * @param {Object} context - Evaluation context
         * @returns {boolean} Boolean result
         */
        evaluateCondition(condition, context) {
            // Handle logical operators in conditions
            const logicalMatch = condition.match(/^(.+?)\s*(&&|\|\|)\s*(.+?)$/);

            if (logicalMatch) {
                const [, left, operator, right] = logicalMatch;
                const leftResult = this.evaluateCondition(left.trim(), context);

                // Short-circuit evaluation
                if (operator === '&&') {
                    return leftResult ? this.evaluateCondition(right.trim(), context) : false;
                } else {
                    return leftResult ? true : this.evaluateCondition(right.trim(), context);
                }
            }

            // Handle comparison operators in conditions
            const comparisonMatch = condition.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)$/);

            if (comparisonMatch) {
                const [, left, operator, right] = comparisonMatch;
                const leftValue = Utils.getNestedValue(context, left.trim());
                const rightValue = this.evaluateValue(this.parseValue(right.trim()), context);
                return this.performComparison(leftValue, operator, rightValue);
            }

            // Simple property check (truthiness)
            if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(condition)) {
                return Boolean(Utils.getNestedValue(context, condition));
            }

            // Parse and evaluate as expression
            const parsed = this.parseExpression(condition);
            return Boolean(this.evaluate(parsed, context));
        },

        /**
         * Evaluates a value object
         * @param {Object} valueObj - Value object to evaluate
         * @param {Object} context - Evaluation context
         * @returns {*} Evaluated value
         */
        evaluateValue(valueObj, context) {
            if (valueObj.type === 'literal') {
                return valueObj.value;
            }

            if (valueObj.type === 'property') {
                return Utils.getNestedValue(context, valueObj.path);
            }

            if (valueObj.type === 'object') {
                // Parse and evaluate object literal
                return this.evaluateObjectLiteral(valueObj.value, context);
            }

            return undefined;
        },

        /**
         * Evaluates an object literal string like "{ active: isActive, disabled: !enabled }"
         * @param {string} objectStr - Object literal string
         * @param {Object} context - Evaluation context
         * @returns {Object} Evaluated object
         */
        evaluateObjectLiteral(objectStr, context) {
            // Remove outer braces
            const content = objectStr.slice(1, -1).trim();

            if (!content) {
                return {};
            }

            const result = {};
            const pairs = this.parseObjectPairs(content);

            pairs.forEach(({key, value}) => {
                // Evaluate the value expression
                const parsed = this.parseExpression(value);
                result[key] = this.evaluate(parsed, context);
            });

            return result;
        },

        /**
         * Parses object pairs from string like "active: isActive, disabled: !enabled"
         * @param {string} content - Object content without braces
         * @returns {Array} Array of {key, value} pairs
         */
        parseObjectPairs(content) {
            const pairs = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';
            let parenDepth = 0;

            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                const isEscaped = i > 0 && content[i - 1] === '\\';

                if ((char === '"' || char === "'") && !isEscaped) {
                    if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuotes = false;
                        quoteChar = '';
                    }
                }

                if (!inQuotes) {
                    if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                    } else if (char === ',' && parenDepth === 0) {
                        // Found a top-level comma - process current pair
                        this.addObjectPair(current.trim(), pairs);
                        current = '';
                        continue;
                    }
                }

                current += char;
            }

            // Process final pair
            if (current.trim()) {
                this.addObjectPair(current.trim(), pairs);
            }

            return pairs;
        },

        /**
         * Adds a key-value pair to the pairs array
         * @param {string} pairStr - String like "active: isActive" or "'test': count > 0"
         * @param {Array} pairs - Array to add pair to
         */
        addObjectPair(pairStr, pairs) {
            const colonIndex = this.findObjectColon(pairStr);

            if (colonIndex === -1) {
                console.warn(`Invalid object pair: ${pairStr}`);
                return;
            }

            // Remove quotes from key if present (handles both single and double quotes)
            let key = pairStr.substring(0, colonIndex).trim();
            const value = pairStr.substring(colonIndex + 1).trim();

            if ((key.startsWith("'") && key.endsWith("'")) ||
                (key.startsWith('"') && key.endsWith('"'))) {
                key = key.slice(1, -1);
            }

            pairs.push({key: key, value: value});
        },

        /**
         * Finds the colon that separates key from value in an object pair
         * Handles quoted keys properly
         * @param {string} pairStr - The pair string to search
         * @returns {number} Index of the colon, or -1 if not found
         */
        findObjectColon(pairStr) {
            let inQuotes = false;
            let quoteChar = '';

            for (let i = 0; i < pairStr.length; i++) {
                const char = pairStr[i];
                const isEscaped = i > 0 && pairStr[i - 1] === '\\';

                if ((char === '"' || char === "'") && !isEscaped) {
                    if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuotes = false;
                        quoteChar = '';
                    }
                }

                if (!inQuotes && char === ':') {
                    return i;
                }
            }

            return -1;
        },

        /**
         * Performs a comparison operation
         * @param {*} left - Left operand
         * @param {string} operator - Comparison operator
         * @param {*} right - Right operand
         * @returns {boolean} Comparison result
         */
        performComparison(left, operator, right) {
            switch (operator) {
                case '===':
                    return left === right;

                case '!==':
                    return left !== right;

                case '==':
                    return left == right;

                case '!=':
                    return left != right;

                case '>=':
                    return left >= right;

                case '<=':
                    return left <= right;

                case '>':
                    return left > right;

                case '<':
                    return left < right;

                default:
                    return false;
            }
        }
    };

    // ============================================================================
    // MAIN PAC FRAMEWORK
    // ============================================================================

    /**
     * Creates a new PAC (Presentation-Abstraction-Control) component
     * @param {string} selector - CSS selector for the container element
     * @param {Object} [abstraction={}] - Data and methods for the component
     * @param {Object} [options={}] - Configuration options
     * @param {string} [options.updateMode='immediate'] - Update mode: 'immediate', 'delayed', or 'change'
     * @param {number} [options.delay=300] - Delay for 'delayed' update mode in milliseconds
     * @returns {Object} Public API for the PAC component
     */
    function wakaPAC(selector, abstraction = {}, options = {}) {
        const container = document.querySelector(selector);

        if (!container) {
            throw new Error(`Container not found: ${selector}`);
        }

        // Merge configuration
        const config = Object.assign({
            updateMode: 'immediate',
            delay: 300
        }, options);

        /**
         * Internal control object for managing the PAC component
         * @private
         */
        const control = {
            // Core state
            selector: selector,
            container: container,
            config: config,
            original: abstraction,
            abstraction: null,

            // Binding management
            bindings: new Map(),
            bindingIndex: new Map(),

            // Reactivity and caching
            computedCache: new Map(),
            computedDeps: new Map(),
            propertyDeps: new Map(),
            expressionCache: new Map(),
            lastValues: new Map(),

            // Update management
            pendingUpdates: null,
            pendingValues: null,
            updateTimeouts: new Map(),

            // Hierarchy
            parent: null,
            children: new Set(),

            // Event handling
            eventListeners: new Map(),

            // === INITIALIZATION SECTION ===

            /**
             * Initializes the PAC component
             */
            initialize() {
                this.setupBindings();
                this.abstraction = this.createReactiveAbstraction();
                this.setupEventHandling();
                this.setupViewportTracking();
                this.performInitialUpdate();
                return this;
            },

            /**
             * Creates the reactive abstraction object with computed properties
             * @returns {Object} Reactive abstraction
             */
            createReactiveAbstraction() {
                // Create the base reactive object that will be returned
                const reactive = {};

                // Set up global browser state properties
                this.setupBrowserProperties(reactive);

                // Set up computed properties first (these depend on other properties)
                // Computed properties are processed before regular properties to ensure
                // proper dependency resolution
                this.setupComputedProperties(reactive);

                // Set up regular properties by iterating through the original object
                Object.keys(this.original).forEach(key => {
                    // Only process own properties, skip inherited ones and the 'computed' key
                    // which was already handled by setupComputedProperties
                    if (this.original.hasOwnProperty(key) && key !== 'computed') {
                        // Read value
                        const value = this.original[key];

                        // Handle different property types appropriately
                        if (typeof value === 'function') {
                            // Bind functions to the reactive object so 'this' refers to reactive
                            // This ensures methods can access other reactive properties
                            reactive[key] = value.bind(reactive);
                        } else if (!Utils.shouldPropertyBeReactive(key, value)) {
                            // Non-reactive property - assign directly without proxy wrapping
                            // Useful for external library instances, DOM objects, or circular references
                            // These properties won't trigger change detection or DOM updates
                            reactive[key] = value;
                        } else {
                            // Reactive property - wrap with change detection and DOM synchronization
                            // These properties will trigger DOM updates when changed
                            this.createReactiveProperty(reactive, key, value);
                        }
                    }
                });

                // Add communication and utility methods to the reactive object
                // These methods provide the reactive object with capabilities for:
                Object.assign(reactive, {
                    // Parent-child component communication
                    notifyParent: (type, data) => this.notifyParent(type, data),

                    // Broadcasting messages to all child components
                    sendToChildren: (cmd, data) => this.sendToChildren(cmd, data),

                    // Sending targeted messages to a specific child component
                    sendToChild: (selector, cmd, data) => this.sendToChild(selector, cmd, data),

                    // Finding a specific child component using a predicate function
                    findChild: predicate => Array.from(this.children).find(predicate),

                    // Serializing the reactive object to JSON (excluding non-serializable properties)
                    toJSON: () => this.serializeToJSON(),

                    // Making HTTP requests with built-in error handling and response processing
                    control: (url, opts = {}) => this.makeHttpRequest(url, opts)
                });

                // Return the fully configured reactive object
                return reactive;
            },

            /**
             * Sets up computed properties with automatic dependency tracking
             */
            setupComputedProperties(reactive) {
                if (!this.original.computed) {
                    return;
                }

                Object.keys(this.original.computed).forEach(name => {
                    const computedFn = this.original.computed[name];

                    if (typeof computedFn === 'function') {
                        // Analyze dependencies
                        const dependencies = this.analyzeComputedDependencies(computedFn, reactive);
                        this.computedDeps.set(name, dependencies);

                        // Build reverse dependency map
                        dependencies.forEach(dep => {
                            if (!this.propertyDeps.has(dep)) {
                                this.propertyDeps.set(dep, []);
                            }

                            if (!this.propertyDeps.get(dep).includes(name)) {
                                this.propertyDeps.get(dep).push(name);
                            }
                        });

                        // Define computed property
                        Object.defineProperty(reactive, name, {
                            get: () => {
                                if (this.computedCache.has(name)) {
                                    return this.computedCache.get(name);
                                }

                                try {
                                    const result = computedFn.call(reactive);
                                    this.computedCache.set(name, result);
                                    return result;
                                } catch (error) {
                                    console.error(`Error computing property '${name}':`, error);
                                    return undefined;
                                }
                            },
                            enumerable: true
                        });
                    }
                });
            },

            /**
             * Analyzes computed function dependencies by parsing the function source
             * @param {Function} fn - The computed function to analyze
             * @param {Object} reactive - The reactive object containing reactive properties
             * @returns {Array<string>} Array of property names that the function depends on
             */
            analyzeComputedDependencies(fn, reactive) {
                // Array to store the discovered dependencies
                const dependencies = [];

                // Regex pattern to match property access on 'this' object
                // Matches: this.propertyName (where propertyName follows JS identifier rules)
                const regex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

                // Iterate through all regex matches in the function's string representation
                let match;

                while ((match = regex.exec(fn.toString()))) {
                    // Extract the property name from the regex capture group
                    const property = match[1];

                    // Check if this property should be considered a dependency:
                    // 1. Property exists in either the original object or reactive object
                    // 2. Property is NOT a computed property (to avoid circular dependencies)
                    // 3. Property hasn't already been added to dependencies (avoid duplicates)
                    if ((this.original.hasOwnProperty(property) || reactive.hasOwnProperty(property)) &&
                        (!this.original.computed || !this.original.computed.hasOwnProperty(property)) &&
                        !dependencies.includes(property)) {
                        // Add the valid dependency to our list
                        dependencies.push(property);
                    }
                }

                // Return the complete list of dependencies
                return dependencies;
            },

            /**
             * Initializes reactive browser state properties for a component
             * These properties automatically update when browser events occur (scroll, resize, visibility change)
             * @param {Object} reactive - The reactive object to attach browser properties to
             */
            setupBrowserProperties(reactive) {
                // Define empty rect for containerClientRect
                const emptyRect = {top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0};

                // Initialize page visibility state - tracks if the browser tab/window is currently visible
                // Useful for pausing animations or reducing CPU usage when user switches tabs
                this.createReactiveProperty(reactive, 'browserVisible', !document.hidden);

                // Initialize current horizontal/vertical scroll position in pixels from left/top of document
                this.createReactiveProperty(reactive, 'browserScrollX', window.scrollX);
                this.createReactiveProperty(reactive, 'browserScrollY', window.scrollY);

                // Initialize current viewport width & height - the visible area of the browser window
                // Updates automatically when user resizes window or rotates mobile device
                this.createReactiveProperty(reactive, 'browserViewportHeight', window.innerHeight);
                this.createReactiveProperty(reactive, 'browserViewportWidth', window.innerWidth);

                // Initialize total document width/height including content outside the viewport
                // Useful for calculating scroll percentages or infinite scroll triggers
                this.createReactiveProperty(reactive, 'browserDocumentWidth', document.documentElement.scrollWidth);
                this.createReactiveProperty(reactive, 'browserDocumentHeight', document.documentElement.scrollHeight);

                // Per-container viewport visibility properties
                this.createReactiveProperty(reactive, 'containerVisible', false);
                this.createReactiveProperty(reactive, 'containerFullyVisible', false);
                this.createReactiveProperty(reactive, 'containerClientRect', emptyRect);
                this.createReactiveProperty(reactive, 'containerWidth', 0);
                this.createReactiveProperty(reactive, 'containerHeight', 0);

                // Set up global event listeners to keep these properties synchronized
                // Uses singleton pattern to ensure listeners are only attached once per page
                // regardless of how many components use browser properties
                this.setupGlobalBrowserListeners();
            },

            /**
             * Sets up global browser event listeners to track browser state changes
             * and synchronize them across all registered PAC components
             */
            setupGlobalBrowserListeners() {
                // Use singleton pattern to avoid duplicate listeners
                // Check if listeners have already been set up to prevent memory leaks
                // and duplicate event handlers when this method is called multiple times
                if (window._wakaPACBrowserListeners) {
                    return;
                }

                // Initialize singleton
                window._wakaPACBrowserListeners = true;

                // Track page visibility changes (tab switching, window minimizing, etc.)
                // Useful for pausing animations or reducing CPU usage when page is not visible
                const visibilityHandler = () => {
                    if (window.PACRegistry && window.PACRegistry.components.size > 0) {
                        window.PACRegistry.components.forEach(component => {
                            // document.hidden is true when page is not visible, so invert it
                            // browserVisible will be false when tab is hidden/minimized
                            component.abstraction.browserVisible = !document.hidden;
                        });
                    }
                };

                // Track scroll position changes across the page
                // Updates all registered components with current scroll position and document height
                const scrollHandler = () => {
                    // Debounce scroll events for performance
                    clearTimeout(window._wakaPACScrollTimeout);

                    // Iterate through all registered PAC components
                    window._wakaPACScrollTimeout = setTimeout(() => {
                        if (window.PACRegistry && window.PACRegistry.components.size > 0) {
                            window.PACRegistry.components.forEach(component => {
                                component.abstraction.browserScrollX = window.scrollX;
                                component.abstraction.browserScrollY = window.scrollY;
                            });
                        }
                    }, 16);
                };

                // Track window resize events to handle responsive behavior
                // Updates components when user resizes browser window or rotates mobile device
                const resizeHandler = () => {
                    // Debounce resize events for performance
                    clearTimeout(window._wakaPACResizeTimeout);

                    // Iterate through all registered PAC components
                    window._wakaPACResizeTimeout = setTimeout(() => {
                        if (window.PACRegistry && window.PACRegistry.components.size > 0) {
                            window.PACRegistry.components.forEach(component => {
                                component.abstraction.browserViewportWidth = window.innerWidth;
                                component.abstraction.browserViewportHeight = window.innerHeight;
                                component.abstraction.browserDocumentWidth = document.documentElement.scrollWidth;
                                component.abstraction.browserDocumentHeight = document.documentElement.scrollHeight;
                                component.abstraction.browserScrollX = window.scrollX;
                                component.abstraction.browserScrollY = window.scrollY;
                            });
                        }
                    }, 100);
                };

                // Store handlers globally for cleanup
                window._wakaPACGlobalHandlers = {
                    visibility: visibilityHandler,
                    scroll: scrollHandler,
                    resize: resizeHandler
                };

                // Add event listeners
                document.addEventListener('visibilitychange', visibilityHandler);
                window.addEventListener('scroll', scrollHandler);
                window.addEventListener('resize', resizeHandler);
            },

            /**
             * Initialize viewport tracking for the container element.
             * Uses modern IntersectionObserver API when available, falls back to scroll-based detection.
             */
            setupViewportTracking() {
                // Check for modern browser support - IntersectionObserver is more efficient
                // and provides better performance than manual scroll calculations
                if ('IntersectionObserver' in window) {
                    this.setupIntersectionObserver();
                } else {
                    this.setupScrollBasedVisibility();
                }

                // Perform initial visibility calculation on setup
                // This ensures correct state even before any scroll/intersection events
                this.updateContainerVisibility();
            },

            /**
             * Modern approach using Intersection Observer API.
             * This is more performant as it runs on the main thread and batches calculations.
             */
            setupIntersectionObserver() {
                // Create observer that tracks when container enters/exits viewport
                this.intersectionObserver = new IntersectionObserver((entries) => {
                    // Process each observed element (in this case, just our container)
                    entries.forEach(entry => {
                        // Verify we're handling the correct element
                        if (entry.target === this.container) {
                            // Get the boundingClientRect
                            const rect = entry.boundingClientRect;

                            // Basic visibility: any part of element is in viewport
                            const isVisible = entry.isIntersecting;

                            // Full visibility: element is completely within viewport bounds
                            // intersectionRatio of 1.0 means 100% of element is visible
                            // Using 0.99 to account for potential floating point precision issues
                            const isFullyVisible = entry.intersectionRatio >= 0.99;

                            // Update component state with new visibility data
                            // These are reactive properties that trigger UI updates
                            this.abstraction.containerVisible = isVisible;
                            this.abstraction.containerFullyVisible = isFullyVisible;
                            this.abstraction.containerWidth = rect.width;
                            this.abstraction.containerHeight = rect.height;

                            // Store current position/size data for potential use by other components
                            this.abstraction.containerClientRect = {
                                top: rect.top,
                                left: rect.left,
                                right: rect.right,
                                bottom: rect.bottom,
                                width: rect.width,
                                height: rect.height,
                                x: rect.x,
                                y: rect.y
                            };
                        }
                    });
                }, {
                    // Define thresholds for intersection callbacks
                    // 0 = trigger when element enters/exits viewport
                    // 1.0 = trigger when element becomes fully visible/hidden
                    threshold: [0, 1.0]
                });

                // Start observing our container element
                this.intersectionObserver.observe(this.container);
            },

            /**
             * Fallback approach for older browsers that don't support IntersectionObserver.
             * Uses traditional scroll event listeners with manual visibility calculations.
             */
            setupScrollBasedVisibility() {
                // Create global registry for components that need viewport tracking
                // This prevents duplicate event listeners when multiple components exist
                if (!window._wakaPACViewportComponents) {
                    window._wakaPACViewportComponents = new Set();

                    // Only set up global listeners once
                    this.setupViewportVisibilityListener();
                }

                // Register this component instance for visibility updates
                window._wakaPACViewportComponents.add(this);
            },

            /**
             * Set up global scroll and resize event listeners.
             * These are shared across all component instances to improve performance.
             */
            setupViewportVisibilityListener() {
                let scrollTimeout;
                let resizeTimeout;

                // Batch visibility updates for all registered components
                const checkVisibility = () => {
                    // Update visibility for every component that's registered for tracking
                    window._wakaPACViewportComponents.forEach(component => {
                        component.updateContainerVisibility();
                    });
                };

                // Throttle scroll events to maintain 60fps performance
                // Scroll events fire very frequently and can cause performance issues
                // 16ms = ~60fps (1000ms/60frames = 16.67ms)
                window.addEventListener('scroll', () => {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(checkVisibility, 16);
                });

                // Handle window resize events with slightly longer delay
                // Resize events are less frequent but can be more expensive to process
                // 100ms delay gives time for resize to complete
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(checkVisibility, 100);
                });
            },

            /**
             * Manual visibility calculation using getBoundingClientRect().
             * This is the fallback method used when IntersectionObserver isn't available
             */
            updateContainerVisibility() {
                // Get current viewport dimensions
                // innerHeight/innerWidth exclude scrollbars and give the actual visible area
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                const boundingRect = this.container.getBoundingClientRect();

                // Convert DOMRect to simple object
                const rect = {
                    top: boundingRect.top,
                    left: boundingRect.left,
                    right: boundingRect.right,
                    bottom: boundingRect.bottom,
                    width: boundingRect.width,
                    height: boundingRect.height,
                    x: boundingRect.x,               // Same as left, but included for DOMRect compatibility
                    y: boundingRect.y                // Same as top, but included for DOMRect compatibility
                };

                // Set dimensions
                this.abstraction.containerClientRect = rect;
                this.abstraction.containerWidth = rect.width;
                this.abstraction.containerHeight = rect.height;

                // Check if any part of container intersects with viewport boundaries
                // Intersection logic: An element is considered "in viewport" if it overlaps
                // with the visible area in both horizontal and vertical dimensions.
                const isInViewport = (
                    rect.top < windowHeight &&    // Element's top edge hasn't scrolled below viewport bottom
                    rect.bottom > 0 &&            // Element's bottom edge hasn't scrolled above viewport top
                    rect.left < windowWidth &&    // Element's left edge hasn't scrolled past viewport right
                    rect.right > 0                // Element's right edge hasn't scrolled past viewport left
                );

                // Early exit optimization: If element is completely out of view,
                // skip the more expensive fully-visible calculation and update state immediately
                if (!isInViewport) {
                    // Set visibility flags to false since element is not in viewport
                    this.abstraction.containerVisible = false;
                    this.abstraction.containerFullyVisible = false;
                    return;
                }

                // Calculate if element is completely within viewport bounds (no clipping)
                // "Fully visible" means the entire element can be seen without any parts
                // being cut off by viewport edges. This is stricter than just "visible"
                // and useful for determining if content can be read/interacted with completely.
                const isFullyVisible = (
                    rect.top >= 0 &&                    // Top edge is at or below viewport top (not clipped above)
                    rect.bottom <= windowHeight &&      // Bottom edge is at or above viewport bottom (not clipped below)
                    rect.left >= 0 &&                   // Left edge is at or right of viewport left (not clipped on left)
                    rect.right <= windowWidth           // Right edge is at or left of viewport right (not clipped on right)
                );

                // Update component's reactive state with calculated visibility data
                // These property updates will trigger Wakapac's reactivity system
                // and can be observed by other components or used to conditionally render content,
                // start/stop animations, lazy load resources, etc.
                this.abstraction.containerVisible = true;                    // Element has some visible pixels
                this.abstraction.containerFullyVisible = isFullyVisible;     // Element is completely unclipped
            },

            /**
             * Creates a reactive property with getter/setter on the target object
             * This enables automatic change detection and propagation throughout the reactive system
             * @param {Object} obj - The target object to add the reactive property to
             * @param {string} key - The property name/key
             * @param {*} initialValue - The initial value for the property
             */
            createReactiveProperty(obj, key, initialValue) {
                // Store the actual value in closure scope for encapsulation
                let value = initialValue;

                // Check if the initial value is a complex object/array that needs deep reactivity
                // Make initial value reactive if needed
                if (Utils.isReactive(value)) {
                    // Wrap the initial value in a reactive proxy to track nested changes
                    value = createReactive(value, (path, newVal, type, meta) => {
                        // Forward deep change notifications up the chain with proper path context
                        this.handleDeepChange(path, newVal, type, meta);
                    }, key);
                }

                // Define the reactive property using Object.defineProperty for full control
                Object.defineProperty(obj, key, {
                    // Getter: Simply return the current value from closure
                    get: () => value,

                    // Setter: Handle value changes with full reactive capabilities
                    set: (newValue) => {
                        // Capture the previous value for change detection and watchers
                        const oldValue = value;

                        // Determine if we're dealing with objects that might need deep comparison
                        const isObject = Utils.isReactive(value) || Utils.isReactive(newValue);

                        // Only proceed with update if the value actually changed
                        // For objects, we skip equality check and always update (performance vs accuracy tradeoff)
                        if (isObject || !Utils.isEqual(value, newValue)) {
                            // Make new value reactive if needed
                            if (Utils.isReactive(newValue)) {
                                // Create reactive wrapper with change handler that forwards to deep change system
                                newValue = createReactive(newValue, (path, changedVal, type, meta) => {
                                    // Delegate nested property changes to the deep change handler
                                    this.handleDeepChange(path, changedVal, type, meta);
                                }, key);
                            }

                            // Update the stored value
                            value = newValue;

                            // Execute any registered watchers for this specific property
                            // Trigger watcher if it exists
                            this.triggerWatcher(key, newValue, oldValue, key);

                            // Schedule DOM/view updates for this property change
                            this.scheduleUpdate(key, newValue);

                            // Recalculate any computed properties that depend on this property
                            this.updateComputedProperties(key);
                        }
                    },

                    // Make the property enumerable so it shows up in Object.keys(), for...in, etc.
                    enumerable: true
                });
            },

            /**
             * Enhanced triggerWatcher method that supports both simple property watchers
             * and deep path pattern watchers with wildcards
             * @param {string} property - The property that changed
             * @param {*} newValue - The new value
             * @param {*} oldValue - The old value
             * @param {string} [changePath] - Full path of the change (for deep watchers)
             */
            triggerWatcher(property, newValue, oldValue, changePath = null) {
                if (!this.original.watch) {
                    return;
                }

                // 1. Handle existing simple property watchers (backward compatibility)
                if (this.original.watch[property]) {
                    try {
                        this.original.watch[property].call(this.abstraction, newValue, oldValue);
                    } catch (error) {
                        console.error(`Error in watcher for '${property}':`, error);
                    }
                }

                // 2. Handle deep path pattern watchers
                if (changePath) {
                    Object.keys(this.original.watch).forEach(watchKey => {
                        // Skip simple property watchers (already handled above)
                        if (!watchKey.includes('.') && !watchKey.includes('*')) {
                            return;
                        }

                        // Check if this watcher pattern matches the change path
                        if (this.matchesWatchPattern(watchKey, changePath)) {
                            const watcher = this.original.watch[watchKey];

                            if (typeof watcher === 'function') {
                                try {
                                    watcher.call(this.abstraction, newValue, oldValue, changePath);
                                } catch (error) {
                                    console.error(`Error in deep watcher for '${watchKey}':`, error);
                                }
                            }
                        }
                    });
                }
            },

            /**
             * Checks if a change path matches a watch pattern
             * Supports exact paths, single wildcards (*), and deep wildcards (**)
             * @param {string} pattern - Watch pattern (e.g., "user.profile.name", "todos.*.completed", "todos.**")
             * @param {string} changePath - Actual change path (e.g., "todos.0.completed")
             * @returns {boolean} True if pattern matches the change path
             */
            matchesWatchPattern(pattern, changePath) {
                // Handle deep wildcard pattern first (**) - matches any nested path
                if (pattern.includes('**')) {
                    const basePattern = pattern.replace('.**', '');

                    // Deep wildcard matches if changePath starts with the base pattern
                    return changePath === basePattern || changePath.startsWith(basePattern + '.');
                }

                // Handle single wildcard pattern (*) - matches one level
                if (pattern.includes('*')) {
                    return this.matchesSingleWildcard(pattern, changePath);
                }

                // Handle exact path matching
                return pattern === changePath;
            },

            /**
             * Handles single wildcard pattern matching
             * @param {string} pattern - Pattern with single wildcards (e.g., "todos.*.completed")
             * @param {string} changePath - Actual change path (e.g., "todos.0.completed")
             * @returns {boolean} True if pattern matches
             */
            matchesSingleWildcard(pattern, changePath) {
                // Split both pattern and path into segments
                const patternParts = pattern.split('.');
                const pathParts = changePath.split('.');

                // Must have same number of segments
                if (patternParts.length !== pathParts.length) {
                    return false;
                }

                // Check each segment - either exact match or wildcard
                return patternParts.every((patternPart, index) => {
                    return patternPart === '*' || patternPart === pathParts[index];
                });
            },

            // === BINDING SETUP SECTION ===

            /**
             * Sets up all DOM bindings by scanning for directives
             */
            setupBindings() {
                this.setupTextBindings();
                this.setupAttributeBindings();
                this.buildBindingIndex();
            },

            /**
             * Finds and creates text interpolation bindings {{property}}
             */
            setupTextBindings() {
                const walker = document.createTreeWalker(
                    this.container,
                    NodeFilter.SHOW_TEXT,
                    null
                );

                let node;
                let nodeCount = 0;

                while (node = walker.nextNode()) {
                    nodeCount++;
                    const text = node.textContent;

                    // Enhanced regex to catch ALL interpolation patterns, including complex expressions
                    const matches = text.match(/\{\{\s*([^}]+)\s*\}\}/g);

                    if (matches) {
                        matches.forEach((match, index) => {
                            const expression = match.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();

                            const binding = this.createBinding('text', node, {
                                target: expression,
                                originalText: text,
                                fullMatch: match,
                                parsedExpression: null,  // Will be lazily parsed on first use
                                dependencies: null       // Will be lazily extracted on first use
                            });

                            this.bindings.set(binding.id, binding);
                        });
                    }
                }
            },

            /**
             * Finds and creates attribute bindings data-pac-bind="..."
             */
            setupAttributeBindings() {
                // Find all elements in the container that have data-pac-bind attributes
                const elements = this.container.querySelectorAll('[data-pac-bind]');

                // Process each element with binding attributes
                Array.from(elements).forEach(element => {
                    // Get the binding string (e.g., "value:selectedItem,foreach:items")
                    const bindingString = element.getAttribute('data-pac-bind');

                    // Parse the binding string into individual binding pairs
                    const bindingPairs = this.parseBindingString(bindingString);

                    // Automatically reorder bindings: foreach first, then others
                    const reorderedBindings = this.reorderBindings(bindingPairs);

                    // Process each binding pair in the correct order
                    reorderedBindings.forEach(({ type, target }) => {
                        const binding = this.createBindingByType(element, type, target);

                        if (binding) {
                            // Store the binding in the bindings map using its unique ID
                            this.bindings.set(binding.id, binding);
                        }
                    });
                });
            },

            /**
             * Parses a binding string into an array of type-target pairs.
             * Handles comma separation while respecting quoted strings, parentheses, and escaped characters.
             * Supports ternary operators and other expressions with parentheses.
             * @param {string} bindingString - String in format "type1:target1,type2:target2"
             * @returns {Array<{type: string, target: string}>} Array of parsed binding pairs
             */
            parseBindingString(bindingString) {
                return ExpressionParser.parseBindingString(bindingString);
            },

            /**
             * Builds an index of bindings by property for efficient lookups
             */
            buildBindingIndex() {
                this.bindingIndex.clear();
                this.unparsedBindings = new Set();

                this.bindings.forEach(binding => {
                    if (binding.target) {
                        this.unparsedBindings.add(binding);
                    }
                });
            },

            // === BINDING CREATION SECTION ===

            /**
             * Gets parsed expression and ensures binding is indexed (lazy indexing)
             * @param {Object} binding - The binding object
             * @returns {Object} Parsed expression object
             */
            getParsedExpression(binding) {
                // Get parsed expression (ExpressionParser handles caching)
                const parsedExpression = ExpressionParser.parseExpression(binding.target);
                const dependencies = parsedExpression.dependencies || [];

                // Only do the indexing work if not already done
                if (!binding.isIndexed) {
                    // Index this binding under each of its dependencies
                    dependencies.forEach(dep => {
                        if (!this.bindingIndex.has(dep)) {
                            this.bindingIndex.set(dep, new Set());
                        }

                        this.bindingIndex.get(dep).add(binding);
                    });

                    // Mark as indexed to avoid re-indexing
                    binding.isIndexed = true;
                    binding.dependencies = dependencies;
                }

                return parsedExpression;
            },

            /**
             * Creates different types of bindings using a factory pattern
             * @param {string} type - Binding type
             * @param {Element} element - Target element
             * @param {Object} config - Binding configuration
             * @returns {Object} Binding object
             */
            createBinding(type, element, config) {
                const binding = {
                    id: Utils.generateId(),
                    type: type,
                    element: element,
                    ...config
                };

                // Add property tracking
                if (config.target) {
                    binding.property = Utils.splitPath(config.target)[0];
                    binding.propertyPath = config.target;
                }

                return binding;
            },

            /**
             * Reorders binding pairs to ensure optimal execution order
             * @param {Array} bindingPairs - Array of {type, target} objects
             * @returns {Array} Reordered binding pairs
             */
            reorderBindings(bindingPairs) {
                // Define binding priority order (lower number = higher priority)
                const priorityOrder = {
                    'foreach': 1,    // Must come first - creates DOM structure
                    'if': 2,         // Conditional DOM existence - before visibility
                    'visible': 3,    // Show/hide elements before setting their values
                    'value': 4,      // Form values after DOM exists and is visible
                    'checked': 4,    // Checkbox state after DOM exists and is visible
                    'click': 5,      // Event handlers after elements are ready
                    'change': 5,     // Event handlers after elements are ready
                    'input': 5,      // Event handlers after elements are ready
                    'submit': 5,     // Event handlers after elements are ready
                    'focus': 5,      // Event handlers after elements are ready
                    'blur': 5,       // Event handlers after elements are ready
                    'keyup': 5,      // Event handlers after elements are ready
                    'keydown': 5,    // Event handlers after elements are ready
                    // All other bindings get priority 6 (attributes, etc.)
                };

                // Sort bindings by priority, maintaining original order for same priority
                return bindingPairs.sort((a, b) => {
                    const priorityA = priorityOrder[a.type] || 6;
                    const priorityB = priorityOrder[b.type] || 6;
                    return priorityA - priorityB;
                });
            },

            /**
             * Helper method to create bindings by type (extracted for reuse)
             * This method acts as a factory for different binding types based on the
             * binding type string and target property.
             * @param {HTMLElement} element - The DOM element to bind to
             * @param {string} type - The type of binding (foreach, visible, value, etc.)
             * @param {string} target - The target property or method name
             * @returns {Object|null} The created binding object, or null if invalid
             */
            createBindingByType(element, type, target) {
                switch (type) {
                    case 'value':
                        this.setupInputElement(element, target);
                        return this.createInputBinding(element, target);

                    case 'visible':
                        return this.createVisibilityBinding(element, target);

                    case 'checked':
                        if (element.type === 'radio') {
                            console.warn('Radio buttons should use data-pac-bind="value:property", not "checked:property"');
                            this.setupInputElement(element, target);
                            return this.createInputBinding(element, target);
                        }

                        this.setupInputElement(element, target, 'checked');
                        return this.createCheckedBinding(element, target);

                    case 'class':
                        return this.createClassBinding(element, target);

                    case 'style':
                        return this.createStyleBinding(element, target);

                    case 'if':
                        return this.createConditionalBinding(element, target);

                    case 'foreach': {
                        const binding = this.createForeachBinding(element, target);
                        element.innerHTML = '';
                        return binding;
                    }

                    default:
                        if (Utils.isEventType(type)) {
                            return this.createEventBinding(element, type, target);
                        } else if (target) {
                            return this.createAttributeBinding(element, type, target);
                        } else {
                            return null;
                        }
                }
            },


            /**
             * Creates a foreach binding for rendering lists
             */
            createForeachBinding(element, target) {
                return this.createBinding('foreach', element, {
                    target: target,
                    collection: target,
                    itemName: element.getAttribute('data-pac-item') || 'item',
                    indexName: element.getAttribute('data-pac-index') || 'index',
                    template: element.innerHTML,
                    previous: []
                });
            },

            /**
             * Creates a conditional "if" binding that renders/removes DOM elements based on data values
             * @param {HTMLElement} element - The DOM element to conditionally render
             * @param {string} target - The data property name to watch (may include '!' for negation)
             * @returns {Object} The created binding object with conditional rendering configuration
             */
            createConditionalBinding(element, target) {
                return this.createBinding('conditional', element, {
                    target: target,
                    parsedExpression: null,
                    dependencies: null,
                    placeholder: null,
                    originalParent: element.parentNode,
                    originalNextSibling: element.nextSibling,
                    isRendered: true
                });
            },

            /**
             * Creates a visibility binding
             */
            createVisibilityBinding(element, target) {
                return this.createBinding('visible', element, {
                    target: target,
                    parsedExpression: null,
                    dependencies: null
                });
            },

            /**
             * Creates an input value binding
             */
            createInputBinding(element, target) {
                return this.createBinding('input', element, {
                    target: target,
                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Creates a checkbox/radio checked binding
             */
            createCheckedBinding(element, target) {
                return this.createBinding('checked', element, {
                    target: target,
                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            createClassBinding: function(element, target) {
                return this.createBinding('class', element, {
                    target: target,
                    parsedExpression: null,
                    dependencies: null
                });
            },

            /**
             * Creates an event binding
             */
            createEventBinding(element, eventType, target) {
                return this.createBinding('event', element, {
                    eventType: eventType,
                    method: target,
                    target: target
                });
            },

            /**
             * Creates an attribute binding
             */
            createAttributeBinding(element, attributeName, target) {
                return this.createBinding('attribute', element, {
                    target: target,
                    attribute: attributeName,
                    parsedExpression: null,
                    dependencies: null
                });
            },

            /**
             * Sets up input element attributes for binding
             */
            setupInputElement(element, property, bindingType = 'value') {
                element.setAttribute('data-pac-property', property);
                element.setAttribute('data-pac-binding-type', bindingType);
                element.setAttribute('data-pac-update-mode', element.getAttribute('data-pac-update') || this.config.updateMode);
                element.setAttribute('data-pac-update-delay', element.getAttribute('data-pac-delay') || this.config.delay);
            },

            // === UPDATE MANAGEMENT SECTION ===

            /**
             * Determines if a binding should update for a property change
             * Optimized to only update bindings affected by the specific property path
             * @param {Object} binding - Binding to check
             * @param {string} changedProperty - Property that changed
             * @returns {boolean} True if binding should update
             */
            shouldUpdateBinding(binding, changedProperty) {
                // Direct property match
                if (binding.property === changedProperty) {
                    return true;
                }

                // Property path match (e.g., 'user.name' starts with 'user')
                if (binding.propertyPath && binding.propertyPath.startsWith(changedProperty + '.')) {
                    return true;
                }

                // For lazy-parsed expressions, parse them now if needed
                if (binding.target && !binding.dependencies) {
                    const parsed = this.getParsedExpression(binding);
                }

                // Expression dependencies
                return !!(binding.dependencies && binding.dependencies.includes(changedProperty));
            },

            /**
             * Schedules DOM updates using requestAnimationFrame for optimal performance
             */
            scheduleUpdate(property, value) {
                if (!this.pendingUpdates) {
                    this.pendingUpdates = new Set();
                    this.pendingValues = {};

                    // Use requestAnimationFrame for smooth updates
                    (window.requestAnimationFrame || (f => setTimeout(f, 0)))(() => {
                        this.flushUpdates();
                    });
                }

                this.pendingUpdates.add(property);
                this.pendingValues[property] = value;
            },

            /**
             * Processes all pending DOM updates in a single batch
             */
            flushUpdates() {
                if (!this.pendingUpdates) {
                    return;
                }

                // Collect bindings that need updates with lazy parsing
                const relevantBindings = new Set();

                this.pendingUpdates.forEach(property => {
                    // Get already-indexed bindings for this property
                    const indexedBindings = this.bindingIndex.get(property) || new Set();

                    // Add all already-indexed bindings
                    indexedBindings.forEach(binding => {
                        if (this.shouldUpdateBinding(binding, property)) {
                            relevantBindings.add(binding);
                        }
                    });

                    // Check unparsed bindings (lazy parsing happens here)
                    this.unparsedBindings.forEach(binding => {
                        if (!binding.parsedExpression) {
                            // Lazy parse: only when we need to check dependencies
                            this.getParsedExpression(binding);
                            // Remove from unparsed set since it's now parsed and indexed
                            this.unparsedBindings.delete(binding);
                        }

                        // Check if this binding should update for this property
                        if (this.shouldUpdateBinding(binding, property)) {
                            relevantBindings.add(binding);
                        }
                    });
                });

                // Update all relevant bindings
                relevantBindings.forEach(binding => {
                    this.updateBinding(binding, null, null);
                });

                // Clear pending state
                this.pendingUpdates = null;
                this.pendingValues = null;
            },

            /**
             * Updates computed properties that depend on a changed property
             * @param {string} changedProperty - The name of the property that changed
             */
            updateComputedProperties(changedProperty) {
                // Get all computed properties that depend on the changed property
                const dependentComputed = this.propertyDeps.get(changedProperty) || [];

                dependentComputed.forEach(computedName => {
                    // Store the old value before recomputation
                    const oldValue = this.computedCache.get(computedName);

                    // Clear cache to force recomputation on next access
                    this.computedCache.delete(computedName);

                    // Get new value (this will trigger recomputation since cache is cleared)
                    const newValue = this.abstraction[computedName];

                    // Check if any foreach bindings use this computed property
                    // Array bindings may need updates even if the reference hasn't changed
                    const hasArrayBinding = Array.from(this.bindings.values())
                        .some(b => b.type === 'foreach' && b.collection === computedName);

                    // Update if value changed or if array binding needs update
                    // Array bindings are updated regardless of equality check since
                    // array contents may have changed without changing the reference
                    if (hasArrayBinding || !Utils.isEqual(oldValue, newValue)) {
                        // Trigger any watchers registered for this computed property
                        this.triggerWatcher(computedName, newValue, oldValue);

                        // Schedule DOM updates for elements bound to this property
                        this.scheduleUpdate(computedName, newValue);

                        // Recursively update any computed properties that depend on this one
                        // This handles chains of computed dependencies (A -> B -> C)
                        this.updateComputedProperties(computedName);
                    }
                });
            },

            /**
             * Handles deep property changes in nested objects/arrays
             */
            handleDeepChange(path, value, type, meta) {
                const rootProperty = Utils.splitPath(path)[0];

                // Handle nested property changes - force updates for computed properties
                if (type === 'set' || type === 'nested-change') {
                    // Clear computed cache for properties that might depend on this change
                    const dependentComputed = this.propertyDeps.get(rootProperty) || [];

                    dependentComputed.forEach(computedName => {
                        this.computedCache.delete(computedName);
                    });

                    // Force update of any foreach bindings that use this root property OR computed properties that depend on it
                    this.bindings.forEach(binding => {
                        if (binding.type === 'foreach') {
                            // Check if binding uses the changed root property directly
                            if (binding.collection === rootProperty) {
                                binding.previous = null;
                            }
                            // Check if binding uses a computed property that depends on the changed root property
                            else if (dependentComputed.includes(binding.collection)) {
                                binding.previous = null;
                            }
                        }
                    });
                }

                // Trigger watchers with full path context
                if ((type === 'set' || type === 'array-mutation') && path !== rootProperty) {
                    // For deep changes, trigger watchers with the actual changed value and path
                    // meta.oldValue contains the previous value from the Proxy set trap
                    const actualNewValue = Utils.getNestedValue(this.abstraction, path);
                    const actualOldValue = meta?.oldValue;
                    this.triggerWatcher(rootProperty, actualNewValue, actualOldValue, path);
                }

                // Update computed properties that depend on this root property
                this.updateComputedProperties(rootProperty);

                // Schedule DOM updates for the root property
                this.scheduleUpdate(rootProperty, this.abstraction[rootProperty]);

                // Also schedule updates for computed properties that depend on this root property
                const dependentComputed = this.propertyDeps.get(rootProperty) || [];

                dependentComputed.forEach(computedName => {
                    this.scheduleUpdate(computedName, this.abstraction[computedName]);
                });

                // Also schedule update for the specific nested path if it's different
                if (path !== rootProperty) {
                    this.scheduleUpdate(path, value);
                }
            },

            /**
             * Performs initial DOM synchronization
             */
            performInitialUpdate() {
                // Update all regular properties
                Object.keys(this.abstraction).forEach(key => {
                    // Only process non-function properties that belong to the object itself
                    if (this.abstraction.hasOwnProperty(key) && typeof this.abstraction[key] !== 'function') {
                        // Schedule an update for each property with its current value
                        this.scheduleUpdate(key, this.abstraction[key]);
                    }
                });

                // Update computed properties
                if (this.original.computed) {
                    // Iterate through all defined computed properties
                    Object.keys(this.original.computed).forEach(name => {
                        // Schedule update for computed property using its calculated value
                        this.scheduleUpdate(name, this.abstraction[name]);
                    });
                }

                // Initialize foreach bindings
                this.bindings.forEach(binding => {
                    // Only process foreach-type bindings
                    if (binding.type === 'foreach') {
                        // Initialize the previous state as empty array for change detection
                        binding.previous = [];

                        // Get the current collection value from the abstraction
                        const value = this.abstraction[binding.collection];

                        // Only update if the collection has a defined value
                        if (value !== undefined) {
                            // Perform initial rendering of the foreach binding
                            this.updateForeachBinding(binding, binding.collection);
                        }
                    }
                });

                // Call init() method if it exists
                if (this.original.init && typeof this.original.init === 'function') {
                    try {
                        this.original.init.call(this.abstraction);
                    } catch (error) {
                        console.error('Error in init() method:', error);
                    }
                }
            },

            // === BINDING UPDATE SECTION ===

            /**
             * Updates a specific binding based on its type
             */
            updateBinding(binding, property, foreachVars = null) {
                try {
                    switch (binding.type) {
                        case 'text':
                            this.updateTextBinding(binding, property, foreachVars);
                            break;

                        case 'attribute':
                            this.updateAttributeBinding(binding, property, foreachVars);
                            break;

                        case 'input':
                            this.updateInputBinding(binding, property, foreachVars);
                            break;

                        case 'checked':
                            this.updateCheckedBinding(binding, property, foreachVars);
                            break;

                        case 'visible':
                            this.updateVisibilityBinding(binding, property, foreachVars);
                            break;

                        case 'conditional':
                            this.updateConditionalBinding(binding, property, foreachVars);
                            break;

                        case 'foreach':
                            this.updateForeachBinding(binding, property, foreachVars);
                            break;

                        case 'class':
                            this.updateClassBinding(binding, property, foreachVars);
                            break;

                        case 'style':
                            this.updateStyleBinding(binding, property, foreachVars);
                            break;

                        case 'event':
                            // Events are already handled in processForeachBinding
                            break;
                    }
                } catch (error) {
                    console.error(`Error updating ${binding.type} binding:`, error);
                }
            },

            /**
             * Updates text content with interpolated values - FIXED VERSION
             * Now handles multiple placeholders in the same text node correctly
             */
            updateTextBinding(binding, property) {
                const textNode = binding.element;
                let text = binding.originalText;

                // Find ALL interpolation patterns in the original text
                const matches = text.match(/\{\{\s*([^}]+)\s*\}\}/g);

                if (matches) {
                    // Replace each match with its evaluated value
                    matches.forEach(match => {
                        const expression = match.replace(/[{}\s]/g, '');
                        const parsed = ExpressionParser.parseExpression(expression);
                        const result = ExpressionParser.evaluate(parsed, this.abstraction);
                        const formattedValue = Utils.formatValue(result);

                        // Replace this specific match in the text
                        text = text.replace(match, formattedValue);
                    });
                }

                // Update text content if changed
                const cacheKey = `text_${binding.id}`;
                const lastValue = this.lastValues.get(cacheKey);

                if (lastValue !== text) {
                    this.lastValues.set(cacheKey, text);
                    textNode.textContent = text;
                }
            },

            /**
             * Updates element attributes based on data binding
             * @param {Object} binding - The binding object containing element, attribute, and expression information
             * @param {string} property - The property name being bound
             * @param {Object|null} foreachVars - Additional variables from foreach context, defaults to null
             */
            updateAttributeBinding(binding, property, foreachVars = null) {
                // Create evaluation context by merging abstraction data with foreach variables
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Parse the binding expression into an evaluatable format
                const parsed = this.getParsedExpression(binding);

                // Regular input handling (text, number, etc.)
                const actualValue = ExpressionParser.evaluate(parsed, context);

                // Set new value
                this.setElementAttribute(binding.element, binding.attribute, actualValue);
            },

            /**
             * Updates input element values based on data binding
             * @param {Object} binding - The binding object containing element and expression information
             * @param {string} property - The property name being bound
             * @param {Object|null} foreachVars - Additional variables from foreach context, defaults to null
             */
            updateInputBinding(binding, property, foreachVars = null) {
                // Fetch element
                const element = binding.element;

                // Create evaluation context by merging abstraction data with foreach variables
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Parse the binding expression into an evaluatable format
                const parsed = this.getParsedExpression(binding);

                // Special handling for radio buttons
                if (element.type === 'radio') {
                    // For radio buttons, we check if the element's value matches the property value
                    const actualValue = ExpressionParser.evaluate(parsed, context);
                    this.applyCheckedBinding(element, element.value === actualValue)
                    return;
                }

                // Regular input handling (text, number, etc.)
                const actualValue = ExpressionParser.evaluate(parsed, context);

                if (element.value !== String(actualValue || '')) {
                    element.value = actualValue || '';
                }
            },

            /**
             * Updates checkbox/radio checked state based on a data binding expression
             * @param {Object} binding - The binding object containing element and expression
             * @param {string} property - The property name being bound (for debugging/logging)
             * @param {Object|null} foreachVars - Additional variables from foreach loops, if any
             */
            updateCheckedBinding(binding, property, foreachVars = null) {
                // Create evaluation context by merging abstraction data with foreach variables
                // foreach variables take precedence over abstraction properties
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Parse the binding expression into an evaluatable format
                const parsed = this.getParsedExpression(binding);

                // Evaluate the expression to get the raw value that determines checked state
                const actualValue = ExpressionParser.evaluate(parsed, context);

                // Convert to boolean and apply to the form element's checked property
                // Handles truthy/falsy conversion for consistent checkbox/radio behavior
                this.applyCheckedBinding(binding.element, Boolean(actualValue));
            },

            /**
             * Updates element visibility based on a data binding expression
             * @param {Object} binding - The binding object containing element and expression
             * @param {string} property - The property name being bound (for debugging/logging)
             * @param {Object|null} foreachVars - Additional variables from foreach loops, if any
             */
            updateVisibilityBinding(binding, property, foreachVars = null) {
                // Create evaluation context by merging abstraction data with foreach variables
                // foreach variables take precedence over abstraction properties
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Parse the binding expression into an evaluatable format
                const parsed = this.getParsedExpression(binding);

                // Use expression parser to evaluate the visibility condition
                // Returns boolean indicating whether element should be visible
                const shouldShow = ExpressionParser.evaluate(parsed, context);

                // Apply the visibility state to the DOM element
                this.applyVisibilityBinding(binding.element, shouldShow);
            },

            /**
             * Updates the conditional binding by adding/removing DOM elements based on expression evaluation
             * @param {Object} binding - The binding object containing element, placeholder, and parsed expression
             * @param {string} property - The property name that changed (used for change detection)
             * @param {Object|null} foreachVars - Optional foreach variables to merge into evaluation context
             */
            updateConditionalBinding(binding, property, foreachVars = null) {
                const context = Object.assign({}, this.abstraction, foreachVars || {});
                const parsed = this.getParsedExpression(binding);

                // Determine if element should be rendered based on the expression evaluation
                const shouldRender = ExpressionParser.evaluate(parsed, context);

                // Early exit if the rendering state hasn't changed
                if (binding.isRendered === shouldRender) {
                    return;
                }

                if (shouldRender) {
                    // Add element to DOM: Replace the placeholder comment with the actual DOM element
                    if (binding.placeholder && binding.placeholder.parentNode) {
                        binding.placeholder.parentNode.replaceChild(binding.element, binding.placeholder);
                    }

                    // Update the binding state to reflect that element is now in the DOM
                    binding.isRendered = true;
                } else {
                    // Remove element from DOM: Replace the DOM element with a placeholder comment
                    // Create placeholder comment if it doesn't exist yet
                    if (!binding.placeholder) {
                        binding.placeholder = document.createComment(`pac-if: ${binding.target}`);
                    }

                    // Replace the element with the invisible placeholder comment (removes from DOM)
                    if (binding.element.parentNode) {
                        binding.element.parentNode.replaceChild(binding.placeholder, binding.element);
                    }

                    // Update the binding state to reflect that element is now removed from DOM
                    binding.isRendered = false;
                }
            },

            /**
             * Updates foreach bindings for list rendering
             */
            updateForeachBinding(binding, property, foreachVars = null) {
                // Only update if this binding is for the changed property
                // OR if property is null (force update)
                if (property && binding.collection !== property) {
                    return;
                }

                // Use parsed expression to get the array value
                const context = Object.assign({}, this.abstraction, foreachVars || {});
                const parsed = this.getParsedExpression(binding);
                const arrayValue = ExpressionParser.evaluate(parsed, context);

                // Ensure we have a valid array to work with
                const array = Array.isArray(arrayValue) ? arrayValue : [];
                const previous = binding.previous || [];
                const forceUpdate = binding.previous === null;

                // Skip update if arrays are deeply equal AND we're not forcing an update
                if (!forceUpdate && Utils.isEqual(previous, array)) {
                    binding.previous = [...array];
                    return;
                }

                // Update cache with current array state
                binding.previous = [...array];

                // Build new content using DocumentFragment for efficient DOM manipulation
                const fragment = document.createDocumentFragment();

                // Render each item in the array
                array.forEach((item, index) => {
                    const itemElement = this.renderForeachItem(
                        binding.template,     // Template to clone for each item
                        item,                 // Current item data
                        index,                // Current item index
                        binding.itemName,     // Variable name for item in template
                        binding.indexName,    // Variable name for index in template
                        binding.collection    // Pass collection name to template processor
                    );

                    fragment.appendChild(itemElement);
                });

                // Replace all existing content with new rendered items
                binding.element.innerHTML = '';
                binding.element.appendChild(fragment);
            },

            /**
             * Updates CSS class bindings by evaluating expressions and applying/removing classes
             * Handles both regular property bindings (e.g., "isActive") and foreach context bindings (e.g., "todo.completed")
             * @param {Object} binding - The binding object containing element, target expression, and parsed data
             * @param {string} property - The property name that changed (used for change detection, can be null for full evaluation)
             * @param {Object|null} foreachVars - Optional foreach variables (item, index, etc.) to merge into evaluation context
             */
            updateClassBinding(binding, property, foreachVars = null) {
                // Create evaluation context by merging the component's abstraction with foreach variables
                // For regular bindings: context = this.abstraction
                // For foreach bindings: context = this.abstraction + {item: todoItem, index: 0, ...}
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Get the parsed expression object (uses caching to avoid re-parsing)
                const parsed = this.getParsedExpression(binding);

                // Evaluate the expression in the current context to get the boolean result
                const actualValue = ExpressionParser.evaluate(parsed, context);

                // Apply the class binding by adding/removing the CSS class based on the boolean value
                // This calls applyClassBinding which extracts the class name from the target
                // and adds/removes it from the element's classList
                this.applyClassBinding(binding.element, binding.target, actualValue);
            },

            /**
             * Creates a style binding for dynamic CSS styling
             * @param {HTMLElement} element - The DOM element to bind styles to
             * @param {string} target - The style expression or property name to bind
             * @returns {Object} The created binding object with element reference and metadata
             */
            createStyleBinding(element, target) {
                return this.createBinding('style', element, {
                    target: target,                // The style expression to evaluate
                    parsedExpression: null,        // Will be populated when first parsed
                    dependencies: null             // Will track what data this binding depends on
                });
            },

            /**
             * Updates style bindings with current data context
             * @param {Object} binding - The style binding object to update
             * @param {string} property - The property name that triggered this update
             * @param {Object|null} [foreachVars=null] - Additional variables from foreach loops
             */
            updateStyleBinding(binding, property, foreachVars = null) {
                // Merge abstraction data with any foreach loop variables
                // This creates the complete context for expression evaluation
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Get or create parsed version of the expression for efficiency
                const parsed = this.getParsedExpression(binding);

                // Evaluate the expression with current context to get actual style value
                const actualValue = ExpressionParser.evaluate(parsed, context);

                // Apply the computed value to the element's styles
                this.applyStyleBinding(binding.element, binding.target, actualValue);
            },

            /**
             * Applies style binding to a DOM element
             * @param {HTMLElement} element - The target DOM element
             * @param {string} target - The original target expression (for debugging)
             * @param {Object|string} value - The style value(s) to apply
             */
            applyStyleBinding(element, target, value) {
                // Check if value is an object (preferred object syntax)
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Object syntax: { color: 'red', fontSize: '16px' }
                    // Iterate through each style property in the object
                    Object.keys(value).forEach(styleProp => {
                        // Only set non-null/undefined values to avoid clearing styles accidentally
                        if (value[styleProp] != null) {
                            // Check if this is a CSS custom property (starts with --)
                            if (styleProp.startsWith('--')) {
                                // Use setProperty for CSS custom properties
                                element.style.setProperty(styleProp, value[styleProp]);
                            } else {
                                // Use direct assignment for regular CSS properties
                                element.style[styleProp] = value[styleProp];
                            }
                        }
                    });
                } else if (typeof value === 'string') {
                    // String syntax: "color: red; font-size: 16px;"
                    // Set the entire CSS text at once (less efficient but backwards compatible)
                    element.style.cssText = value;
                }
            },

            /**
             * Applies attribute binding to a DOM element
             * @param {HTMLElement} element - The target DOM element
             * @param {string} target - The original target expression (for debugging)
             * @param {Object} value - Object mapping attribute names to values
             */
            applyAttrBinding(element, target, value) {
                // Verify we have an object with attribute mappings
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Object syntax: { placeholder: 'Enter text', title: 'Tooltip' }
                    // Iterate through each attribute name/value pair
                    Object.keys(value).forEach(attrName => {
                        // Only set non-null/undefined values to avoid unwanted attribute removal
                        if (value[attrName] != null) {
                            // Use helper method to properly set the attribute
                            // This handles special cases like boolean attributes, data attributes, etc.
                            this.setElementAttribute(element, attrName, value[attrName]);
                        }
                    });
                } else {
                    // Log warning for incorrect usage - attr: binding requires object syntax
                    // This helps developers identify binding syntax errors
                    console.warn('attr: binding expects object syntax: { attrName: value }');
                }
            },

            // === FOREACH RENDERING SECTION ===

            /**
             * Renders a single item from a foreach loop by processing the template with item-specific data.
             * Handles both single-element and multi-node templates, optimizing DOM structure when possible.
             * @param {string} template - The HTML template string to render for this item
             * @param {*} item - The current item data from the collection being iterated
             * @param {number} index - The zero-based index of the current item in the collection
             * @param {string} itemName - The variable name used to reference the current item in the template
             * @param {string} indexName - The variable name used to reference the current index in the template
             * @param {string} collectionName - The name of the collection being iterated over
             * @returns {Element} The rendered DOM element(s) for this foreach item
             */
            renderForeachItem(template, item, index, itemName, indexName, collectionName) {
                // Create a temporary container to parse the HTML template string
                const tempTbody = document.createElement('tbody');
                tempTbody.innerHTML = template.trim();

                // Convert NodeList to Array for easier manipulation
                const childNodes = Array.from(tempTbody.childNodes);

                // If there's exactly one top-level element, use it directly (no wrapper)
                // This optimizes the DOM structure by avoiding unnecessary wrapper elements
                if (childNodes.length === 1 && childNodes[0].nodeType === Node.ELEMENT_NODE) {
                    const element = childNodes[0];

                    // Clone the element to avoid modifying the original template
                    const clone = element.cloneNode(true);

                    // Process the cloned element with foreach context data (item, index, variable names)
                    this.processForeachTemplate(clone, item, index, itemName, indexName, collectionName);

                    // Return the clode
                    return clone;
                }

                // Multiple top-level nodes or text nodes - need wrapper
                // This handles cases like: "Text <span>element</span> more text" or multiple sibling elements
                const wrapper = document.createElement('span');

                // Copy childnodes in the wrapper
                childNodes.forEach(node => {
                    wrapper.appendChild(node.cloneNode(true));
                });

                // Process the wrapper and all its children with foreach context data
                this.processForeachTemplate(wrapper, item, index, itemName, indexName, collectionName);

                // Return the wrapper
                return wrapper;
            },

            /**
             * Processes a template element for foreach loops, handling text interpolation and data bindings
             * @param {Element} element - The DOM element to process
             * @param {*} item - The current item from the collection being iterated
             * @param {number} index - The current index in the iteration
             * @param {string} itemName - The variable name for the current item (e.g., 'user')
             * @param {string} indexName - The variable name for the current index (e.g., 'i')
             * @param {string} collectionName - The name of the collection being iterated
             */
            processForeachTemplate(element, item, index, itemName, indexName, collectionName) {
                // Create foreach variables for this iteration
                const foreachVars = {
                    [itemName]: item,
                    [indexName]: index
                };

                // Create a tree walker to traverse all text nodes in the element
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                const textNodes = [];

                // Collect all text nodes first to avoid modifying the tree while traversing
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }

                // Process each text node for template interpolation
                textNodes.forEach(textNode => {
                    // Replace template expressions in the format {{expression}}
                    textNode.textContent = textNode.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
                        expr = expr.trim();

                        // Handle index variable (e.g., {{i}} -> current index)
                        if (expr === indexName) {
                            return index;
                        }

                        // Handle item variable (e.g., {{item}} -> formatted item value)
                        if (expr === itemName) {
                            return Utils.formatValue(item);
                        }

                        // Handle item property access (e.g., {{item.name}} -> item's name property)
                        if (expr.startsWith(`${itemName}.`)) {
                            // Extract the property path after the item name
                            return Utils.formatValue(Utils.getNestedValue(item, expr.substring(itemName.length + 1)));
                        }

                        // If no pattern matches, return the original expression unchanged
                        return match;
                    });
                });

                // Process data binding attributes on the current element and all its descendants
                [element, ...element.querySelectorAll('[data-pac-bind]')].forEach(el => {
                    const bindings = el.getAttribute('data-pac-bind');

                    // Skip elements without binding attributes
                    if (!bindings) {
                        return;
                    }

                    // Parse multiple bindings separated by commas
                    this.parseBindingString(bindings).forEach(({ type, target }) => {
                        // Set up two-way binding for form inputs
                        if ((type === 'value' || type === 'checked') && target.startsWith(`${itemName}.`)) {
                            // Extract the property path from the target
                            const propertyPath = target.substring(itemName.length + 1);

                            // Create a full path including collection and index for proper data binding
                            this.setupInputElement(el, `${collectionName}.${index}.${propertyPath}`, type);
                        }

                        // Process other types of bindings using unified expression evaluation
                        this.processForeachBinding(el, type, target, foreachVars);
                    });
                });
            },

            /**
             * Processes individual bindings within foreach templates by creating lightweight
             * binding objects and using the unified updateBinding system
             * @param {HTMLElement} element - The DOM element to apply the binding to
             * @param {string} type - The type of binding (class, checked, event name, or attribute name)
             * @param {string} target - The expression or property path to evaluate
             * @param {Object} foreachVars - The foreach variables (item, index, etc.)
             */
            processForeachBinding(element, type, target, foreachVars) {
                // For event bindings, handle them specially since they need item/index passed
                if (Utils.isEventType(type)) {
                    this.handleEventBinding(element, type, target, foreachVars[Object.keys(foreachVars)[0]], foreachVars[Object.keys(foreachVars)[1]]);
                    return;
                }

                // Create a lightweight binding object specifically for foreach evaluation
                // This avoids the two-way data binding setup that createBindingByType does
                const tempBinding = this.createForeachEvaluationBinding(element, type, target);

                // Use the unified updateBinding method with foreach context
                this.updateBinding(tempBinding, null, foreachVars);
            },

            /**
             * Creates a lightweight binding object for foreach evaluation
             * This is different from createBindingByType because it doesn't set up
             * two-way data binding infrastructure - it's just for one-way evaluation
             * @param {HTMLElement} element - Target element
             * @param {string} type - Binding type
             * @param {string} target - Target expression
             * @returns {Object} Lightweight binding object
             */
            createForeachEvaluationBinding(element, type, target) {
                // Map foreach types to updateBinding types
                const bindingTypeMap = {
                    'visible': 'visible',
                    'checked': 'checked',
                    'value': 'input',
                    'class': 'class'
                };

                const bindingType = bindingTypeMap[type] || 'attribute';

                return {
                    id: `foreach_eval_${Utils.generateId()}`,
                    type: bindingType,
                    element: element,
                    target: target,
                    attribute: bindingType === 'attribute' ? type : null,
                    parsedExpression: null, // Will be set by getParsedExpression
                    dependencies: null // Will be set by getParsedExpression
                };
            },

            // === EVENT HANDLING SECTION ===

            /**
             * Sets up event handling with delegation
             * Uses event delegation pattern to handle multiple event types efficiently
             * by attaching a single listener to the container that captures all child events
             */
            setupEventHandling() {
                // Create a single delegated handler function that will process all event types
                // This handler acts as a router, directing events to the main handleEvent method
                const delegatedHandler = (event) => {
                    this.handleEvent(event);
                };

                // Iterate through each event type and set up delegation
                EVENT_TYPES.forEach(type => {
                    // Add event listener to the container with capture phase (true)
                    // Capture phase ensures events are caught before they reach target elements
                    // This allows the handler to intercept and process events consistently
                    this.container.addEventListener(type, delegatedHandler, true);

                    // Store reference to the handler function for potential cleanup later
                    // Maps event type to its handler for easy removal if needed
                    this.eventListeners.set(type, delegatedHandler);
                });
            },

            /**
             * Handles DOM events with routing to appropriate handlers
             * Processes both form input events and custom event bindings
             * @param {Event} event - The DOM event object
             */
            handleEvent(event) {
                // Extract event type and target element for processing
                const {type, target} = event;

                // Get the property name from data attribute (used for form binding)
                const property = target.getAttribute('data-pac-property');

                // Handle form input events ONLY if there's a data-pac-property
                // This ensures we only process elements that are bound to data properties
                if ((type === 'input' || type === 'change') && property) {
                    // Route to specialized input handler for form data binding
                    this.handleInputEvent(event, target, property);
                }

                // Always also check for custom event bindings
                // This allows for additional event handling beyond form inputs
                // (e.g., clicks, custom events, etc.)
                this.handleCustomEvent(event, type, target);
            },

            /**
             * Handles input events for two-way data binding
             * @param {Event} event - The DOM event (input, change, etc.)
             * @param {HTMLElement} target - The input element that triggered the event
             * @param {string} property - The property path to update (e.g., "todos.0.completed")
             */
            handleInputEvent(event, target, property) {
                // Determine the update mode - check element's data attribute first, fall back to global config
                const updateMode = target.getAttribute('data-pac-update-mode') || this.config.updateMode;

                // Determine the binding type - 'value' for most inputs, 'checked' for checkboxes/radios
                const bindingType = target.getAttribute('data-pac-binding-type') || 'value';

                // Extract the appropriate value based on the input type
                const value = this.readDOMValue(target);

                // Apply the update based on the configured mode
                switch (updateMode) {
                    case 'immediate':
                        // Update the data model immediately as the user types/changes the input
                        this.setNestedProperty(property, value);
                        break;

                    case 'delayed':
                        // Debounce the update - wait for a pause in user input before updating
                        // This prevents excessive updates during rapid typing
                        this.handleDelayedUpdate(target, property, value);
                        break;

                    case 'change':
                        // Only update when the input loses focus or user explicitly commits the change
                        // This prevents updates during intermediate typing states
                        if (event.type === 'change') {
                            this.setNestedProperty(property, value);
                        }

                        break;
                }
            },

            /**
             * Handles custom event bindings by processing modifiers and executing bound methods
             * @param {Event} event - The DOM event object
             * @param {string} eventType - The type of event (e.g., 'click', 'keydown')
             * @param {Element} target - The DOM element that triggered the event
             */
            handleCustomEvent(event, eventType, target) {
                // For submit events, we need to check if the target is a form or if we should look for a parent form
                let actualTarget = target;

                if (eventType === 'submit' && target.tagName !== 'FORM') {
                    // Find the closest form element
                    actualTarget = target.closest('form');

                    if (!actualTarget) {
                        return; // No form found, can't handle submit
                    }
                }

                // Parse event modifiers (e.g., .prevent, .stop, .once) from the target element
                const modifiers = this.parseEventModifiers(target);

                // Apply modifiers and check if event should continue processing
                // Returns false if a modifier (like .prevent) should halt execution
                if (!this.applyEventModifiers(event, modifiers)) {
                    return;
                }

                // Iterate through all registered event bindings to find matches
                this.bindings.forEach(binding => {
                    // Check if this binding matches the current event criteria
                    if (binding.type === 'event' &&
                        binding.eventType === eventType &&
                        (binding.element === target || binding.element.contains(target))
                    ) {

                        // Get the method reference from the abstraction object
                        const method = this.abstraction[binding.method];

                        // Verify the method exists and is callable
                        if (typeof method === 'function') {
                            try {
                                // Execute the bound method with proper context and pass the event
                                method.call(this.abstraction, event);
                            } catch (error) {
                                // Log any errors that occur during method execution
                                console.error(`Error executing event handler '${binding.method}':`, error);
                            }
                        }
                    }
                });
            },

            /**
             * Handles event listener binding by attaching the event handler to the element
             * @param {HTMLElement} element - The target DOM element
             * @param {string} type - The event type (click, change, etc.)
             * @param {string} target - The method name to call on the abstraction
             * @param {*} item - The current foreach item to pass to the handler
             * @param {number} index - The current foreach index to pass to the handler
             */
            handleEventBinding(element, type, target, item, index) {
                element.addEventListener(type, (event) => {
                    // Verify the target method exists before calling it
                    const method = this.abstraction[target];

                    if (typeof method !== 'function') {
                        console.warn(`Event handler "${target}" is not a function`);
                        return;
                    }

                    // Call the method with proper context and foreach parameters
                    method.call(this.abstraction, item, index, event);
                });
            },

            /**
             * Parses event modifiers from data-pac-modifiers attribute
             */
            parseEventModifiers(element) {
                const modifiersAttr = element.getAttribute('data-pac-modifiers');
                return modifiersAttr ? modifiersAttr.trim().split(/\s+/).filter(m => m.length > 0) : [];
            },

            /**
             * Applies event modifiers to validate if event should trigger
             * @param {Event} event - The keyboard/mouse event to validate
             * @param {string[]} modifiers - Array of modifier strings to check against
             * @returns {boolean} - True if event matches modifiers, false otherwise
             */
            applyEventModifiers(event, modifiers) {
                // Iterate through each modifier to find a matching key constraint
                for (const modifier of modifiers) {
                    // Read key
                    const expectedKey = EVENT_KEYS[modifier.toLowerCase()];

                    // Skip modifiers that don't correspond to key constraints
                    if (!expectedKey) {
                        continue;
                    }

                    // Handle multiple valid keys (array format)
                    if (Array.isArray(expectedKey)) {
                        // Return false immediately if pressed key isn't in the valid key list
                        if (!expectedKey.includes(event.key)) {
                            return false;
                        }
                    } else {
                        // Handle single valid key (string format)
                        // Return false immediately if pressed key doesn't match expected key
                        if (event.key !== expectedKey) {
                            return false;
                        }
                    }

                    // Found a matching key constraint, stop checking further modifiers
                    break;
                }

                // All key constraints passed (or no key constraints found)
                return true;
            },

            /**
             * Handles delayed updates with proper debouncing
             * This method ensures that rapid consecutive updates to the same property
             * are debounced, so only the final value is applied after a delay period.
             * @param {HTMLElement} element - The DOM element that triggered the update
             * @param {string} property - The property name to update on the abstraction object
             * @param {*} value - The new value to set for the property
             */
            handleDelayedUpdate(element, property, value) {
                // Get the delay from element's data attribute, fallback to config default
                // This allows per-element customization of delay timing
                const delay = parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay;

                // Create a consistent key based on property name only
                // This ensures all updates to the same property share the same debounce timer
                // Note: Using property-only key means updates to different elements but same property
                // will debounce together (which may be intentional behavior)
                const key = `delayed_${property}`;

                // Debouncing logic: Clear any existing timeout for this property
                // This cancels the previous delayed update, ensuring only the most recent
                // value will be applied after the delay period expires
                if (this.updateTimeouts.has(key)) {
                    clearTimeout(this.updateTimeouts.get(key));
                }

                // Set up new delayed execution
                // Only this timeout will execute unless another update comes in first
                const timeoutId = setTimeout(() => {
                    // Apply the final value to the abstraction object
                    this.abstraction[property] = value;

                    // Clean up: remove the timeout reference since it's completed
                    // This prevents memory leaks from accumulating timeout references
                    this.updateTimeouts.delete(key);
                }, delay);

                // Store the new timeout ID so it can be cleared if needed
                // This maintains the debouncing mechanism for subsequent calls
                this.updateTimeouts.set(key, timeoutId);
            },

            // === UTILITY METHODS SECTION ===

            /**
             * Sets element attribute with special handling for boolean attributes
             * @param element
             * @param name
             * @param value
             */
            setElementAttribute(element, name, value) {
                switch (name) {
                    case 'style':
                        if (typeof value === 'object' && value) {
                            Object.assign(element.style, value);
                        } else {
                            element.style.cssText = value || '';
                        }

                        break;

                    case 'enable':
                        // Handle 'enable' as reverse of 'disabled'
                        if (value) {
                            element.removeAttribute('disabled');
                        } else {
                            element.setAttribute('disabled', 'disabled');
                        }

                        break;

                    default:
                        if (BOOLEAN_ATTRS.includes(name)) {
                            if (value) {
                                element.setAttribute(name, name);
                            } else {
                                element.removeAttribute(name);
                            }
                        } else if (value != null) {
                            element.setAttribute(name, value);
                        } else {
                            element.removeAttribute(name);
                        }

                        break;
                }
            },

            /**
             * Sets a nested property value (e.g., "todos.0.completed" = true)
             * @param {string} propertyPath - Dot-separated property path
             * @param {*} value - Value to set
             */
            setNestedProperty(propertyPath, value) {
                // Split the property path into individual parts (e.g., "todos.0.completed" → ["todos", "0", "completed"])
                const parts = propertyPath.split('.');

                // Simple property (no nesting)
                // If there's only one part, we're setting a top-level property directly
                if (parts.length === 1) {
                    this.abstraction[propertyPath] = value;
                    return;
                }

                // Navigate to the parent object
                // We need to traverse through all parts except the last one to reach the parent
                let current = this.abstraction;

                for (let i = 0; i < parts.length - 1; i++) {
                    // Move deeper into the nested structure using the current part as a key
                    current = current[parts[i]];

                    // Check if the current path exists - if not, we can't set the property
                    if (!current) {
                        // Show which part of the path failed for debugging purposes
                        console.warn(`Cannot set property: ${propertyPath} - path not found at '${parts.slice(0, i + 1).join('.')}'`);
                        return;
                    }
                }

                // Set the final property
                // Extract the last part of the path (the actual property name to set)
                const finalProperty = parts[parts.length - 1];

                // Set the value on the parent object we navigated to
                current[finalProperty] = value;
            },

            /**
             * Applies visibility binding to an element by showing or hiding it
             * while preserving the original display style value
             * @param {HTMLElement} element - The DOM element to show or hide.
             * @param {boolean} shouldShow - Determines the visibility action to perform
             */
            applyVisibilityBinding(element, shouldShow) {
                if (shouldShow) {
                    // Show element: restore original display value
                    if (element.hasAttribute('data-pac-hidden')) {
                        // Restore the original display value (or empty string if none was saved)
                        element.style.display = element.getAttribute('data-pac-orig-display') || '';

                        // Clean up our tracking attributes
                        element.removeAttribute('data-pac-hidden');
                        element.removeAttribute('data-pac-orig-display');
                    }
                } else {
                    // Hide element: save current display and set to none
                    if (!element.hasAttribute('data-pac-hidden')) {
                        // Get the computed display style before we change it
                        const currentDisplay = getComputedStyle(element).display;

                        // Only save the display value if it's not already 'none'
                        // (no point in saving 'none' as the original value)
                        if (currentDisplay !== 'none') {
                            element.setAttribute('data-pac-orig-display', currentDisplay);
                        }

                        // Hide the element and mark it as hidden by our binding
                        element.style.display = 'none';
                        element.setAttribute('data-pac-hidden', 'true');
                    }
                }
            },

            /**
             * Applies checked state to an element
             * @param {HTMLElement} element - The target DOM element
             * @param {boolean} checked - Whether the element should be checked
             */
            applyCheckedBinding(element, checked) {
                element.checked = checked;
            },

            /**
             * Enhanced applyClassBinding that handles conditional classes, boolean-based classes, and multiple classes
             * @param {HTMLElement} element - The target DOM element
             * @param {string} target - The class expression (e.g., "todo.completed", "item.active", or object syntax)
             * @param {*} value - The evaluated expression value
             */
            applyClassBinding(element, target, value) {
                // Get previous classes that were applied by this binding
                const previousClasses = element.dataset.pacPreviousClasses || '';

                // Remove all previously applied classes
                if (previousClasses) {
                    previousClasses.split(' ').forEach(cls => {
                        if (cls.trim()) {
                            element.classList.remove(cls.trim());
                        }
                    });
                }

                let newClasses = '';

                // Handle different value types
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Object syntax: { className: boolean, className2: boolean }
                    Object.keys(value).forEach(className => {
                        if (value[className] && className.trim()) {
                            element.classList.add(className.trim());
                            newClasses += (newClasses ? ' ' : '') + className.trim();
                        }
                    });
                } else if (Array.isArray(value) && value !== null) {
                    // Array of class names
                    value.forEach(className => {
                        if (className && typeof className === 'string' && className.trim()) {
                            element.classList.add(className.trim());
                            newClasses += (newClasses ? ' ' : '') + className.trim();
                        }
                    });
                } else if (typeof value === 'string') {
                    // String value - could be single class or space-separated classes
                    const classNames = value.trim().split(/\s+/);
                    classNames.forEach(className => {
                        if (className.trim()) {
                            element.classList.add(className.trim());
                            newClasses += (newClasses ? ' ' : '') + className.trim();
                        }
                    });
                } else if (value) {
                    // Truthy non-string value - convert to string and treat as class name
                    const className = String(value).trim();
                    if (className) {
                        element.classList.add(className);
                        newClasses = className;
                    }
                }

                // Store the new classes for next time
                element.dataset.pacPreviousClasses = newClasses;
            },

            /**
             * Reads the current value from a DOM element (input, select, textarea, etc.)
             * @param {string|Element} elementOrSelector - CSS selector, ID selector, or DOM element reference
             * @returns {string|boolean} The element's value (string for most inputs, boolean for checkboxes)
             */
            readDOMValue: (elementOrSelector) => {
                // Find the element using either ID selector (#id) or CSS selector
                // Check if selector starts with '#' to use getElementById for better performance
                let element;

                if (typeof elementOrSelector === 'string') {
                    if (elementOrSelector.startsWith('#')) {
                        element = document.getElementById(elementOrSelector.slice(1));
                    } else {
                        element = document.querySelector(elementOrSelector);
                    }
                } else if (elementOrSelector && elementOrSelector.nodeType) {
                    element = elementOrSelector;
                }

                // Early return if element doesn't exist to prevent errors
                if (!element) {
                    console.warn(`Element not found: ${elementOrSelector}`);
                    return false;
                }

                // Use switch(true) pattern to check multiple conditions in order of priority
                switch (true) {
                    case element.tagName === 'SELECT':
                        return element.value; // Get selected option value

                    case element.type === 'checkbox':
                        return element.checked; // true/false based on checked state

                    case element.type === 'radio':
                        // Radio buttons work in groups, so find the currently checked one
                        // Use the 'name' attribute to identify radio buttons in the same group
                        const checkedRadio = document.querySelector(`input[name="${element.name}"]:checked`);
                        return checkedRadio ? checkedRadio.value : ''; // Get value or empty string

                    case element.tagName === 'INPUT' || element.tagName === 'TEXTAREA':
                        return element.value; // Get the input value

                    default:
                        // Extract text content, preferring textContent over innerText
                        // textContent gets all text including hidden elements
                        // innerText respects styling and returns visible text only
                        return element.textContent || element.innerText;
                }
            },

            // === HIERARCHY SECTION ===

            /**
             * Establishes parent-child relationships in component hierarchy
             */
            establishHierarchy() {
                // Get the hierarchical relationship data for this component's container
                // from the global registry
                const {parent, children} = window.PACRegistry.getHierarchy(this.container);

                // Handle parent relationship establishment
                if (parent && this.parent !== parent) {
                    // Update this component's parent reference
                    this.parent = parent;
                    // Add this component to the parent's children collection
                    parent.children.add(this);
                }

                // Handle children relationship establishment
                children.forEach(child => {
                    // Only process children that aren't already properly linked
                    if (child.parent !== this) {
                        // If the child already has a different parent, remove it from
                        // that parent's children collection first
                        if (child.parent) {
                            child.parent.children.delete(child);
                        }

                        // Set this component as the child's parent
                        child.parent = this;

                        // Add the child to this component's children collection
                        this.children.add(child);
                    }
                });
            },

            /**
             * Notifies the parent component of an event or state change
             * @param {string} type - The type of event being reported
             * @param {*} data - The data payload associated with the event
             */
            notifyParent(type, data) {
                // Check if parent exists and has the required receiveUpdate method
                if (this.parent && typeof this.parent.receiveUpdate === 'function') {
                    // Call parent's receiveUpdate method, passing this component as the child reference
                    this.parent.receiveUpdate(type, data, this);
                }
            },

            /**
             * Receives and processes updates from child components
             * @param {string} type - The type of event received from child
             * @param {*} data - The data payload from the child
             * @param {Object} child - Reference to the child component that sent the update
             */
            receiveUpdate(type, data, child) {
                // If abstraction layer has a child update handler, call it
                if (this.abstraction.onChildUpdate) {
                    this.abstraction.onChildUpdate(type, data, child);
                }

                // Dispatch a custom DOM event to allow external listeners to respond
                // Uses bubbling to propagate up the DOM tree
                this.container.dispatchEvent(new CustomEvent('pac:childupdate', {
                    detail: {eventType: type, data, childPAC: child},
                    bubbles: true
                }));
            },

            /**
             * Receives and processes commands sent down from parent component
             * @param {string} cmd - The command identifier
             * @param {*} data - The command data payload
             */
            receiveFromParent(cmd, data) {
                // If abstraction layer has a parent command handler, call it
                if (this.abstraction.receiveFromParent) {
                    this.abstraction.receiveFromParent(cmd, data);
                }

                // Dispatch a custom DOM event to notify external listeners of parent command
                // Uses bubbling to propagate up the DOM tree
                this.container.dispatchEvent(new CustomEvent('pac:parentcommand', {
                    detail: {command: cmd, data},
                    bubbles: true
                }));
            },

            /**
             * Sends a command to all direct child components
             * @param {string} cmd - The command identifier
             * @param {*} data - The command data payload
             */
            sendToChildren(cmd, data) {
                // Iterate through all child components
                this.children.forEach(child => {
                    // Ensure child has the receiveFromParent method before calling
                    if (typeof child.receiveFromParent === 'function') {
                        child.receiveFromParent(cmd, data);
                    }
                });
            },

            /**
             * Sends a command to a specific child component matching the given selector
             * @param {string} selector - CSS selector to identify the target child
             * @param {string} cmd - The command identifier
             * @param {*} data - The command data payload
             */
            sendToChild(selector, cmd, data) {
                // Find the first child whose container element matches the selector
                const child = Array.from(this.children).find(c => c.container.matches(selector));

                // If matching child found and has receiveFromParent method, send the command
                if (child && child.receiveFromParent) {
                    child.receiveFromParent(cmd, data);
                }
            },

            // === HTTP/SERIALIZATION SECTION ===

            /**
             * Makes an HTTP request with PAC-specific headers and handling
             * @param {string} url - URL to request
             * @param {Object} opts - Request options
             * @returns {Promise} Promise that resolves with response data
             */
            makeHttpRequest(url, opts = {}) {
                return fetch(url, {
                    method: opts.method || 'GET',
                    headers: Object.assign({
                        'Content-Type': 'application/json',
                        'X-PAC-Request': 'true'
                    }, opts.headers || {}),
                    body: opts.data ? JSON.stringify(opts.data) : undefined
                })
                    .then(response => response.json())
                    .then(data => {
                        if (opts.onSuccess) {
                            opts.onSuccess.call(this.abstraction, data);
                        }

                        return data;
                    })
                    .catch(error => {
                        if (opts.onError) {
                            opts.onError.call(this.abstraction, error);
                        }

                        throw error;
                    });
            },

            /**
             * Serializes component state to JSON
             * @returns {Object} A plain object containing only the serializable properties
             */
            serializeToJSON() {
                // Initialize the result object that will hold serializable properties
                const result = {};

                // Get list of computed property names from the original component definition
                // Computed properties are derived values and shouldn't be serialized
                const computedProps = this.original.computed ? Object.keys(this.original.computed) : [];

                // Define internal method names that should be excluded from serialization
                // These are component lifecycle and communication methods, not data
                const methodNames = ['notifyParent', 'sendToChildren', 'sendToChild', 'findChild', 'toJSON'];

                // Iterate through all properties in the component's abstraction layer
                Object.keys(this.abstraction).forEach(key => {
                    const value = this.abstraction[key];

                    // Include property in serialization only if it meets all criteria:
                    if (value !== undefined &&              // Has a defined value
                        typeof value !== 'function' &&     // Is not a function
                        !computedProps.includes(key) &&     // Is not a computed property
                        !methodNames.includes(key)) {       // Is not an internal method

                        // Add the property to our serialized result
                        result[key] = value;
                    }
                });

                // Return the clean, serializable object
                return result;
            },

            // === CLEANUP SECTION ===

            /**
             * Main cleanup method that orchestrates component destruction
             * Calls all cleanup sub-methods in the correct order to ensure
             * proper resource deallocation and prevent memory leaks
             */
            destroy() {
                // Clear timeouts first (might trigger other operations)
                this._clearTimeouts();

                // Remove from registry (this also handles global cleanup)
                this._unregisterFromGlobalRegistry();

                // Clean up hierarchy (break circular references)
                this._cleanupHierarchy();

                // Clean up reactive references
                this._cleanupReactiveReferences();

                // Remove event listeners
                this._removeEventListeners();

                // Clean up viewport tracking
                this._cleanupViewportTracking();

                // Clear caches
                this._clearCaches();

                // Clear bindings
                this._clearBindings();

                // Final nullification (MOVED TO END)
                this._nullifyReferences();
            },

            /**
             * Clears all pending timeout operations
             * Prevents callbacks from executing after component destruction
             */
            _clearTimeouts() {
                this.updateTimeouts.forEach(id => clearTimeout(id));
                this.updateTimeouts.clear();
            },

            /**
             * Clears all cached data structures
             * Releases memory held by computed values and expression caches
             */
            _clearCaches() {
                this.computedCache.clear();
                this.expressionCache.clear();
                this.lastValues.clear();
            },

            /**
             * Removes component from the global registry
             * Ensures the component can be garbage collected and won't be
             * referenced by the global registry system
             */
            _unregisterFromGlobalRegistry() {
                // Unregister this component instance from the global PAC registry
                window.PACRegistry.unregister(this.selector);

                // Check if this was the last component and clean up global resources
                // Clean up global listeners if this was the last component
                if (window._wakaPACGlobalHandlers && window.PACRegistry.components.size === 0) {
                    // Remove document-level event listeners that were shared across all components
                    document.removeEventListener('visibilitychange', window._wakaPACGlobalHandlers.visibility);
                    window.removeEventListener('scroll', window._wakaPACGlobalHandlers.scroll);
                    window.removeEventListener('resize', window._wakaPACGlobalHandlers.resize);

                    // Clean up global handler references to prevent memory leaks
                    delete window._wakaPACGlobalHandlers;
                    delete window._wakaPACBrowserListeners;

                    // Clear any pending timeouts to prevent them from firing after cleanup
                    // Clear scroll debounce timeout if it exists
                    if (window._wakaPACScrollTimeout) {
                        clearTimeout(window._wakaPACScrollTimeout);
                    }

                    // Clear resize debounce timeout if it exists
                    if (window._wakaPACResizeTimeout) {
                        clearTimeout(window._wakaPACResizeTimeout);
                    }
                }
            },

            /**
             * Clears all binding-related data structures
             * Removes references between data bindings and their indices
             */
            _clearBindings() {
                this.bindings.clear();
                this.bindingIndex.clear();
            },

            /**
             * Cleans up parent-child relationships in the component hierarchy
             * Removes this component from parent's children and orphans all child components
             */
            _cleanupHierarchy() {
                // Remove this component from parent's children set
                if (this.parent) {
                    this.parent.children.delete(this);
                }

                // Orphan all child components by removing parent reference
                this.children.forEach(child => {
                    if (child.parent === this) {
                        child.parent = null;
                    }
                });

                // Clear all references
                this.parent = null;
                this.children.clear();
            },

            /**
             * Cleans up reactive references to prevent memory leaks and circular references
             * This method is typically called during component destruction or cleanup phases
             */
            _cleanupReactiveReferences() {
                // Check if the abstraction object exists before attempting cleanup
                if (this.abstraction) {
                    // Iterate through all properties of the abstraction object
                    // Clear method references that might create cycles
                    Object.keys(this.abstraction).forEach(key => {
                        // Get the current property value
                        const value = this.abstraction[key];

                        // Check if the value is a function and appears to be a bound method
                        // Bound methods often contain references to their original context,
                        // which can create circular references and prevent garbage collection
                        if (typeof value === 'function' && value.name.includes('bound')) {
                            // These are bound methods, clear them to break potential circular references
                            // Setting to null allows the garbage collector to reclaim the memory
                            this.abstraction[key] = null;
                        }
                    });
                }
            },

            /**
             * Removes all event listeners that were registered by this component
             * This method prevents memory leaks by ensuring event handlers are properly cleaned up
             */
            _removeEventListeners() {
                // Iterate through all stored event listeners
                this.eventListeners.forEach((handler, type) => {
                    // Remove the event listener from the container element
                    // The 'true' parameter indicates this was registered with capture=true
                    // It's important to use the same parameters (capture flag) that were used when adding the listener
                    this.container.removeEventListener(type, handler, true);
                });

                // Clear the Map to remove all stored references
                this.eventListeners.clear();
            },

            /**
             * Cleans up viewport tracking resources to prevent memory leaks
             * This method should be called when the component is being destroyed or no longer needs viewport tracking
             */
            _cleanupViewportTracking() {
                // Clean up intersection observer
                // The IntersectionObserver API is used to track when elements enter/exit the viewport
                if (this.intersectionObserver) {
                    // Disconnect the observer to stop monitoring all target elements
                    // This prevents the observer from continuing to fire callbacks after cleanup
                    this.intersectionObserver.disconnect();

                    // Set reference to null to allow garbage collection
                    // Without this, the observer and its associated DOM references might remain in memory
                    this.intersectionObserver = null;
                }

                // Remove from per-instance tracking
                // Check if the global viewport components registry exists
                if (window._wakaPACViewportComponents) {
                    // Remove this component instance from the global Set/Map
                    // This prevents the global registry from holding a reference to this component
                    // which could prevent proper garbage collection of the component
                    window._wakaPACViewportComponents.delete(this);
                }
            },

            /**
             * Nullifies core object references to aid garbage collection
             * Final step to ensure no circular references prevent cleanup
             */
            _nullifyReferences() {
                this.abstraction = null;
                this.container = null;
            },
        };

        // Initialize the control object
        const controlUnit = control.initialize();

        /**
         * Creates the public API for the PAC component
         * @param {Object} unit - Initialized control unit
         * @returns {Object} Public API
         */
        function createPublicAPI(unit) {
            const api = {};

            // Copy all abstraction properties and methods to the public API
            // This allows external code to access the component's abstraction layer
            Object.keys(unit.abstraction).forEach(key => {
                const descriptor = Object.getOwnPropertyDescriptor(unit.abstraction, key);

                if (descriptor) {
                    // Preserve property descriptors (getters, setters, configurability)
                    Object.defineProperty(api, key, descriptor);
                }
            });

            // Add component management methods to the API
            Object.assign(api, {

                /**
                 * Adds a child component to this component
                 * @param {Object} child - The child component to add
                 */
                addChild: child => {
                    control.children.add(child);
                    child.parent = control; // Establish parent-child relationship
                },

                /**
                 * Removes a child component from this component
                 * @param {Object} child - The child component to remove
                 */
                removeChild: child => {
                    control.children.delete(child);
                    child.parent = null; // Clear parent reference
                },

                /**
                 * Sends a notification to the parent component
                 * @param {string} type - Type of notification
                 * @param {*} data - Data to send with the notification
                 */
                notifyParent: (type, data) => control.notifyParent(type, data),

                /**
                 * Receives an update from a child component
                 * @param {string} type - Type of update
                 * @param {*} data - Update data
                 * @param {Object} child - The child component sending the update
                 */
                receiveUpdate: (type, data, child) => control.receiveUpdate(type, data, child),

                /**
                 * Receives a command or message from the parent component
                 * @param {string} cmd - Command type
                 * @param {*} data - Command data
                 */
                receiveFromParent: (cmd, data) => control.receiveFromParent(cmd, data),

                /**
                 * Sends a command to all child components
                 * @param {string} cmd - Command to send
                 * @param {*} data - Data to send with the command
                 */
                sendToChildren: (cmd, data) => control.sendToChildren(cmd, data),

                /**
                 * Sends a command to a specific child component
                 * @param {string|Function} selector - Selector to find the target child
                 * @param {string} cmd - Command to send
                 * @param {*} data - Data to send with the command
                 */
                sendToChild: (selector, cmd, data) => control.sendToChild(selector, cmd, data),

                /**
                 * Finds the first child component that matches the predicate
                 * @param {Function} predicate - Function to test each child
                 * @returns {Object|undefined} First matching child or undefined
                 */
                findChild: predicate => Array.from(control.children).find(predicate),

                /**
                 * Finds all child components that match the predicate
                 * @param {Function} predicate - Function to test each child
                 * @returns {Array} Array of matching child components
                 */
                findChildren: predicate => Array.from(control.children).filter(predicate),

                /**
                 * Finds a child component by CSS selector
                 * @param {string} selector - CSS selector to match against child containers
                 * @returns {Object|undefined} First matching child or undefined
                 */
                findChildBySelector: selector => Array.from(control.children).find(c => c.container.matches(selector)),

                /**
                 * Finds a child component by a property value in its abstraction
                 * @param {string} prop - Property name to check
                 * @param {*} val - Value to match
                 * @returns {Object|undefined} First matching child or undefined
                 */
                findChildByProperty: (prop, val) => Array.from(control.children).find(c => c.abstraction && c.abstraction[prop] === val),

                /**
                 * Makes an HTTP request with PAC-specific headers and handling
                 * @param {string} url - URL to request
                 * @param {Object} opts - Request options
                 * @param {string} [opts.method='GET'] - HTTP method
                 * @param {Object} [opts.headers] - Additional headers
                 * @param {*} [opts.data] - Request body data (will be JSON stringified)
                 * @param {Function} [opts.onSuccess] - Success callback
                 * @param {Function} [opts.onError] - Error callback
                 * @returns {Promise} Promise that resolves with response data
                 */
                control: (url, opts = {}) => control.makeHttpRequest(url, opts),

                /**
                 * Reads DOM state from a specific element and stores it in a data model property
                 * @param {string} elementSelector - CSS selector or ID to find the element
                 * @returns {boolean|boolean|*|string|string}
                 */
                readDOMValue: (elementSelector) => control.readDOMValue(elementSelector),

                /**
                 * Formats a value for display in text content or UI elements
                 * Handles null/undefined, objects, arrays, and primitives appropriately
                 * @param {*} value - Value to format for display
                 * @returns {string} Human-readable formatted string
                 */
                formatValue: (value) => Utils.formatValue(value),

                /**
                 * Escapes HTML entities to prevent XSS when displaying user input
                 * Converts <, >, &, quotes to their HTML entity equivalents
                 * @param {string} str - String to escape HTML entities in
                 * @returns {string} HTML-safe escaped string
                 */
                escapeHTML: (str) => Utils.escapeHTML(str),

                /**
                 * Strips all HTML tags from user input to get plain text
                 * Use this for user-generated content that should not contain HTML
                 * @param {string} html - HTML string to sanitize
                 * @returns {string} Plain text with all HTML tags removed
                 */
                sanitizeUserInput: (html) => Utils.sanitizeUserInput(html),

                /**
                 * Destroys the component and cleans up resources
                 */
                destroy: () => control.destroy()
            });

            // Define read-only introspection properties
            // These provide access to internal state without allowing modification
            Object.defineProperties(api, {
                /**
                 * Gets the parent component (read-only)
                 */
                parent: {
                    get: () => control.parent,
                    enumerable: true // Make property visible in for...in loops and Object.keys()
                },

                /**
                 * Gets an array of child components (read-only)
                 */
                children: {
                    get: () => Array.from(control.children), // Convert Set to Array for easier consumption
                    enumerable: true
                },

                /**
                 * Gets the DOM container element (read-only)
                 */
                container: {
                    get: () => control.container,
                    enumerable: true
                }
            });

            return api;
        }

        // Create public API
        // Generates the external-facing API object that exposes safe methods
        // and properties for interacting with this PAC component
        const publicAPI = createPublicAPI(controlUnit);

        // Register in global registry and establish hierarchy
        // Add this component to the global registry using its CSS selector as the key,
        // making it discoverable by other components and external code
        window.PACRegistry.register(selector, control);

        // Establish parent-child relationships for this component by traversing
        // the DOM hierarchy and linking it to any parent PAC components
        control.establishHierarchy();

        // Re-establish hierarchy for existing components
        // Iterate through all previously registered components to update their
        // hierarchical relationships, as the new component may now serve as
        // a parent to existing orphaned components
        window.PACRegistry.components.forEach(component => {
            // Skip the current component (already processed) and components
            // that already have established parent relationships
            if (component !== control && !component.parent) {
                // Attempt to find and establish parent-child relationships
                // for components that were previously orphaned
                component.establishHierarchy();
            }
        });

        // Return the public API for immediate use
        // This allows the caller to interact with the component through
        // its safe, exposed interface
        return publicAPI;
    }

    // =============================================================================
    // GLOBAL REGISTRY INITIALIZATION AND EXPORTS
    // =============================================================================

    // Initialize global registry
    window.PACRegistry = window.PACRegistry || new ComponentRegistry();

    // Export to global scope
    window.wakaPAC = wakaPAC;

    // Export for CommonJS/Node.js environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {wakaPAC, ComponentRegistry, Utils};
    }
})();