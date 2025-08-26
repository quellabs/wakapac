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
     * Binding map
     * @type {{visible: string, checked: string, value: string, class: string, style: string}}
     */
    const BINDING_TYPE_MAP = {'visible': 'visible', 'checked': 'checked', 'value': 'input', 'class': 'class', 'style': 'style'};

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
         * Checks if a string represents a DOM event type
         * @param {string} type - Event type to test
         * @returns {boolean} True if it's a valid event type
         */
        isEventType(type) {
            return /^(click|submit|change|input|focus|blur|key(up|down))$/.test(type);
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

            return path.split('.').reduce((current, segment) => {
                return current && current.hasOwnProperty(segment) ? current[segment] : undefined;
            }, obj);
        },

        /**
         * Formats a value for display in text content
         * @param {*} value - Value to format
         * @returns {string} Formatted string
         */
        formatValue(value) {
            return value == null ? '' : String(value);
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

        // Make existing nested objects/arrays reactive immediately
        makeNestedReactive(target, onChange, path);

        // Store original array methods for arrays
        const originalMethods = {};
        const isArray = Array.isArray(target);

        if (isArray) {
            ARRAY_METHODS.forEach(method => {
                originalMethods[method] = target[method];
            });
        }

        // Create specialized handlers
        // noinspection JSCheckFunctionSignatures
        const arrayMutationHandler = createArrayMutationHandler(target, originalMethods, onChange, path);
        const proxyGetter = createProxyGetter(isArray, originalMethods, arrayMutationHandler);
        const proxySetter = createProxySetter(onChange, path);
        const proxyDeleter = createProxyDeleter(onChange, path);

        return new Proxy(target, {
            get: proxyGetter,
            set: proxySetter,
            deleteProperty: proxyDeleter
        });
    }

    /**
     * Recursively makes nested objects and arrays reactive by wrapping them
     * with reactive proxies. This enables deep reactivity for complex data structures.
     * @param {Object|Array} target - The object or array to make nested properties reactive
     * @param {Function} onChange - Callback function to invoke when changes occur
     * @param {string} path - Current path in the nested structure (for tracking changes)
     */
    function makeNestedReactive(target, onChange, path) {
        // Iterate through all enumerable properties of the target object
        Object.keys(target).forEach(key => {
            if (target.hasOwnProperty(key) && Utils.isReactive(target[key])) {
                target[key] = createReactive(target[key], onChange, path ? `${path}.${key}` : key);
            }
        });

        // Handle arrays separately to make their elements reactive
        if (Array.isArray(target)) {
            target.forEach((item, index) => {
                if (Utils.isReactive(item)) {
                    target[index] = createReactive(item, onChange, path ? `${path}.${index}` : index);
                }
            });
        }
    }

    /**
     * Creates a handler function that wraps array mutation methods to maintain reactivity
     * when arrays are modified. This ensures that new items added to reactive arrays
     * are automatically made reactive as well.
     *
     * @param {Array} arr - The reactive array being monitored
     * @param {Object} originalMethods - Reference to the original Array.prototype methods
     * @param {Function} onChange - Callback function to invoke when array mutations occur
     * @param {string} path - The path of this array in the nested reactive structure
     * @returns {Function} A handler function that creates wrapped mutation methods
     */
    function createArrayMutationHandler(arr, originalMethods, onChange, path) {
        return function(prop) {
            return function (...args) {
                // Execute the original array method with the provided arguments
                const result = originalMethods[prop].apply(arr, args);

                // Check if this method adds new items to the array
                // Methods that can add new elements: push (end), unshift (beginning), splice (anywhere)
                if (/^(push|unshift|splice)$/.test(prop)) {
                    // Iterate through all array items to make new ones reactive
                    arr.forEach((item, index) => {
                        if (Utils.isReactive(item) && !item._isReactive) {
                            arr[index] = createReactive(item, onChange, `${path}.${index}`);
                        }
                    });
                }

                // Notify observers that an array mutation occurred
                // Provides context about the mutation including method name and arguments
                onChange(path || 'root', arr, 'array-mutation', {method: prop, args});

                // Return the result of the original method call
                return result;
            };
        };
    }

    /**
     * Creates proxy getter handler
     * @param {boolean} isArray - Whether target is an array
     * @param {Object} originalMethods - Original array methods
     * @param {Function} arrayMutationHandler - Array mutation handler
     * @returns {Function} Proxy getter function
     */
    function createProxyGetter(isArray, originalMethods, arrayMutationHandler) {
        return function(obj, prop) {
            // Check if we're dealing with an array
            // If so, return a wrapped version of the array method
            if (isArray && originalMethods[prop]) {
                return arrayMutationHandler(prop);
            }

            // For non-array objects or non-mutating properties,
            // return the property value directly without interception
            return obj[prop];
        };
    }

    /**
     * Creates a proxy setter function that handles reactive property assignments
     * This function is used as the 'set' trap in the Proxy handler
     * @param {Function} onChange - Callback function to invoke when properties change
     * @param {string} path - The current path in the object hierarchy (e.g., "user.profile")
     * @returns {Function} A proxy setter function that handles property assignments
     */
    function createProxySetter(onChange, path) {
        return function(obj, prop, value) {
            // Store the current value before modification for comparison
            const oldValue = obj[prop];

            // Convert the new value to a reactive object if it's an object/array
            // This ensures nested objects also trigger change notifications
            if (Utils.isReactive(value)) {
                value = createReactive(value, onChange, path ? `${path}.${prop}` : prop);
            }

            // Perform the actual property assignment
            obj[prop] = value;

            // Only trigger change notifications if the value actually changed
            // This prevents unnecessary updates when the same value is assigned
            if (!Utils.isEqual(oldValue, value)) {
                // Construct the full property path (e.g., "user.profile.name")
                const propertyPath = path ? `${path}.${prop}` : prop;

                // Notify listeners about the property change
                // Includes the path, new value, operation type, and old value
                onChange(propertyPath, value, 'set', {oldValue});
            }

            // Return true to indicate the set operation was successful
            // This is required by the Proxy specification
            return true;
        };
    }

    /**
     * Creates proxy delete handler
     * @param {Function} onChange - Change notification callback
     * @param {string} path - Current property path
     * @returns {Function} Proxy delete function
     */
    function createProxyDeleter(onChange, path) {
        return function(obj, prop) {
            // Store the value being deleted for the change notification
            const oldValue = obj[prop];

            // Perform the actual deletion on the target object
            delete obj[prop];

            // Build the full property path for nested objects
            // If path exists, append the property with a dot separator
            // Otherwise, use just the property name for root-level properties
            const propertyPath = path ? `${path}.${prop}` : prop;

            // Notify listeners of the deletion
            onChange(propertyPath, undefined, 'delete', {oldValue});

            // Return true to indicate successful deletion (Proxy requirement)
            return true;
        };
    }

    // ============================================================================
    // EXPRESSION PARSER
    // ============================================================================

    const ExpressionParser = {
        /**
         * Cache for parsed expressions to avoid re-parsing
         * @type {Map<string, Object>}
         */
        cache: new Map(),
        bindingCache: new Map(),
        tokens: [],
        currentToken: 0,

        OPERATOR_PRECEDENCE: {
            '||': 1, '&&': 2,
            '===': 6, '!==': 6, '==': 6, '!=': 6,
            '<': 7, '>': 7, '<=': 7, '>=': 7,
            '+': 8, '-': 8, '*': 9, '/': 9,
            '!': 10, 'unary-': 10, 'unary+': 10
        },

        OPERATOR_TYPES: {
            '||': 'logical', '&&': 'logical',
            '===': 'comparison', '!==': 'comparison', '==': 'comparison', '!=': 'comparison',
            '>=': 'comparison', '<=': 'comparison', '>': 'comparison', '<': 'comparison',
            '+': 'arithmetic', '-': 'arithmetic', '*': 'arithmetic', '/': 'arithmetic'
        },

        /**
         * Creates helpful error messages for common expression parsing mistakes
         */
        createHelpfulError(expression, originalError) {
            let message = `Expression parsing failed: "${expression}"\n`;
            message += `Original error: ${originalError.message}\n`;

            // Add specific suggestions based on common patterns
            if (originalError.message.includes('Expected ":" after object key')) {
                if (expression.includes('?') && expression.includes('{')) {
                    message += '\nSuggestion: Ternary operators cannot be used as object keys in class bindings.\n';
                    message += `Try removing the braces: ${expression.replace(/^\{|\}$/g, '').trim()}\n`;
                    message += 'Or use object syntax: { className: condition, otherClass: !condition }';
                }
            }

            // ... other error patterns ...

            const enhancedError = new Error(message);
            enhancedError.originalError = originalError;
            enhancedError.expression = expression;
            return enhancedError;
        },

        /**
         * Main entry point for parsing JavaScript-like expressions into an AST
         * @param {string|Object} expression - The expression string to parse
         * @returns {Object|null} Parsed AST node or null if unparseable
         */
        parseExpression(expression) {
            // Handle already parsed objects
            if (typeof expression === 'object' && expression !== null) {
                if (expression.dependencies) {
                    return expression;
                }

                const dependencies = this.extractDependencies(expression);
                return Object.assign({}, expression, { dependencies });
            }

            expression = String(expression).trim();

            // Check cache first
            if (this.cache.has(expression)) {
                return this.cache.get(expression);
            }

            // Tokenize and parse
            try {
                this.tokens = this.tokenize(expression);
                this.currentToken = 0;

                if (this.tokens.length === 0) {
                    return null;
                }

                // Add dependencies to the result
                const result = this.parseTernary();

                if (result) {
                    result.dependencies = this.extractDependencies(result);
                }

                // Cache the result
                this.cache.set(expression, result);
                return result;
            } catch (error) {
                // Use the parser's own error enhancement method
                throw this.createHelpfulError(expression, error);
            }
        },

        /**
         * Tokenizes the input expression into an array of tokens
         * @param {string} expression - Expression to tokenize
         * @returns {Array} Array of token objects
         */
        tokenize(expression) {
            const tokens = [];
            let i = 0;

            while (i < expression.length) {
                const char = expression[i];

                // Skip whitespace
                if (/\s/.test(char)) {
                    i++;
                    continue;
                }

                // String literals
                if (char === '"' || char === "'") {
                    const result = this.tokenizeString(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Numbers
                if (/\d/.test(char) || (char === '.' && /\d/.test(expression[i + 1]))) {
                    const result = this.tokenizeNumber(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Multi-character operators
                const multiChar = /^(===|!==|==|!=|>=|<=|&&|\|\|)/.exec(expression.slice(i));

                if (multiChar) {
                    const op = multiChar[1];
                    tokens.push({ type: 'OPERATOR', value: op, precedence: this.getOperatorPrecedence(op) });
                    i += op.length;
                    continue;
                }

                // Single character tokens
                const singleCharTokens = {
                    '(': 'LPAREN',
                    ')': 'RPAREN',
                    '{': 'LBRACE',
                    '}': 'RBRACE',
                    '[': 'LBRACKET',
                    ']': 'RBRACKET',
                    ',': 'COMMA',
                    '.': 'DOT'
                };

                if (singleCharTokens[char]) {
                    tokens.push({ type: singleCharTokens[char], value: char });
                    i++;
                    continue;
                }

                // Single character operators
                if ('+-*/<>!?:'.includes(char)) {
                    const precedence = this.getOperatorPrecedence(char);

                    let type;
                    switch (char) {
                        case '?':
                            type = 'QUESTION';
                            break;

                        case ':':
                            type = 'COLON';
                            break;

                        default:
                            type = 'OPERATOR';
                            break;
                    }

                    tokens.push({ type, value: char, precedence });
                    i++;
                    continue;
                }

                // Identifiers and keywords
                if (/[a-zA-Z_$]/.test(char)) {
                    const result = this.tokenizeIdentifier(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                // Unknown character - skip it
                i++;
            }

            return tokens;
        },

        /**
         * Tokenizes a string literal
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeString(expression, start) {
            const quote = expression[start];
            let i = start + 1;
            let value = '';

            while (i < expression.length) {
                const char = expression[i];

                if (char === '\\' && i + 1 < expression.length) {
                    // Handle escaped characters
                    const nextChar = expression[i + 1];

                    if (nextChar === quote || nextChar === '\\') {
                        value += nextChar;
                        i += 2;
                    } else {
                        value += char;
                        i++;
                    }
                } else if (char === quote) {
                    // End of string
                    return {
                        token: { type: 'STRING', value },
                        nextIndex: i + 1
                    };
                } else {
                    value += char;
                    i++;
                }
            }

            // Unterminated string - throw error
            throw new Error(`Unterminated string literal starting at position ${start}: expected closing ${quote}`);
        },

        /**
         * Tokenizes a number literal
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeNumber(expression, start) {
            const numberMatch = /^(\d*\.?\d+(?:[eE][+-]?\d+)?)/.exec(expression.slice(start));

            if (numberMatch) {
                return {
                    token: { type: 'NUMBER', value: parseFloat(numberMatch[1]) },
                    nextIndex: start + numberMatch[1].length
                };
            }
        },

        /**
         * Tokenizes an identifier or keyword
         * @param {string} expression - Full expression
         * @param {number} start - Starting index
         * @returns {Object} {token, nextIndex}
         */
        tokenizeIdentifier(expression, start) {
            const identMatch = /^([a-zA-Z_$][a-zA-Z0-9_$]*)/.exec(expression.slice(start));

            if (identMatch) {
                const value = identMatch[1];
                const type = ['true', 'false', 'null', 'undefined'].includes(value) ? 'KEYWORD' : 'IDENTIFIER';

                return {
                    token: { type, value },
                    nextIndex: start + value.length
                };
            }
        },

        /**
         * Gets operator precedence (higher number = higher precedence)
         * @param {string} operator - Operator to check
         * @returns {number} Precedence level (0 if operator not found)
         */
        getOperatorPrecedence(operator) {
            return this.OPERATOR_PRECEDENCE[operator] || 0;
        },

        /**
         * Parses ternary conditional expressions (condition ? true : false)
         * @returns {Object|null} Ternary AST node or lower precedence expression
         */
        parseTernary() {
            let expr = this.parseBinaryExpression();

            if (this.match('QUESTION')) {
                const trueExpr = this.parseTernary();
                this.consume('COLON', 'Expected ":" in ternary expression');
                const falseExpr = this.parseTernary();

                return {
                    type: 'ternary',
                    condition: expr,
                    trueValue: trueExpr,
                    falseValue: falseExpr
                };
            }

            return expr;
        },

        /**
         * Parse a binary expression using precedence climbing algorithm.
         * Entry point that starts parsing with minimum precedence level.
         * @returns {Object} AST node representing the parsed binary expression
         */
        parseBinaryExpression() {
            return this.parseBinaryWithPrecedence(1);
        },

        /**
         * Parse binary expressions with operator precedence using the precedence climbing method.
         * This recursive algorithm handles operator precedence and associativity correctly.
         * @param {number} minPrec - Minimum precedence level for operators to be parsed at this level
         * @returns {Object} AST node representing the parsed expression tree
         */
        parseBinaryWithPrecedence(minPrec) {
            // Start by parsing the left operand (could be a unary expression, literal, etc.)
            let left = this.parseUnary();

            // Continue parsing while we encounter operators
            while (this.peek().type === 'OPERATOR') {
                // Get the precedence of the current operator
                const opPrec = this.getOperatorPrecedence(this.peek().value);

                // If this operator's precedence is lower than our minimum threshold,
                // we should stop parsing at this level and let a higher level handle it
                if (opPrec < minPrec) {
                    break;
                }

                // Consume the operator token
                const op = this.advance().value;

                // Parse the right operand with higher precedence (opPrec + 1)
                // This ensures left-associativity by requiring higher precedence for right side
                // For right-associative operators, you would use opPrec instead of opPrec + 1
                const right = this.parseBinaryWithPrecedence(opPrec + 1);

                // Determine the AST node type based on the operator
                // Falls back to 'arithmetic' if operator type is not defined
                const type = this.OPERATOR_TYPES[op] || 'arithmetic';

                // Create a new binary expression node with the parsed components
                // This becomes the new left operand for potential further parsing
                left = { type, left, operator: op, right };
            }

            // Return the final parsed expression (could be the original left operand
            // if no operators were processed, or a complex binary expression tree)
            return left;
        },

        /**
         * Parses unary expressions (!, -, +)
         * @returns {Object|null} Unary AST node or primary expression
         */
        parseUnary() {
            if (this.matchOperator('!', '-', '+')) {
                const operator = this.previous().value;
                const operand = this.parseUnary();

                return {
                    type: 'unary',
                    operator,
                    operand
                };
            }

            return this.parsePrimary();
        },

        /**
         * Parses primary expressions (parentheses, properties, literals)
         * @returns {Object|null} Primary expression AST node
         */
        parsePrimary() {
            // Parentheses
            if (this.match('LPAREN')) {
                const expr = this.parseTernary();
                this.consume('RPAREN', 'Expected closing parenthesis');

                return {
                    type: 'parentheses',
                    inner: expr
                };
            }

            // Object literals
            if (this.match('LBRACE')) {
                return this.parseObjectLiteral();
            }

            // String literals
            if (this.check('STRING')) {
                return {
                    type: 'literal',
                    value: this.advance().value
                };
            }

            // Number literals
            if (this.check('NUMBER')) {
                return {
                    type: 'literal',
                    value: this.advance().value
                };
            }

            // Keywords (true, false, null, undefined)
            if (this.check('KEYWORD')) {
                const token = this.advance();

                let value;
                switch (token.value) {
                    case 'true':
                        value = true;
                        break;

                    case 'false':
                        value = false;
                        break;

                    case 'null':
                        value = null;
                        break;

                    case 'undefined':
                        value = undefined;
                        break;
                }

                return {
                    type: 'literal',
                    value: value
                };
            }

            // Property access
            if (this.check('IDENTIFIER')) {
                return this.parsePropertyAccess();
            }

            return null;
        },

        /**
         * Parses object literals { key: value, ... }
         * @returns {Object} Object literal AST node
         */
        parseObjectLiteral() {
            const pairs = [];

            if (!this.check('RBRACE')) {
                do {
                    // Parse key
                    let key;
                    if (this.check('STRING')) {
                        key = this.advance().value;
                    } else if (this.check('IDENTIFIER')) {
                        key = this.advance().value;
                    } else {
                        throw new Error('Expected property name');
                    }

                    this.consume('COLON', 'Expected ":" after object key');

                    // Parse value
                    const value = this.parseTernary();

                    pairs.push({ key, value });

                } while (this.match('COMMA') && !this.check('RBRACE'));
            }

            this.consume('RBRACE', 'Expected closing brace');

            return {
                type: 'object',
                pairs
            };
        },

        /**
         * Parses property access expressions (obj.prop, obj[key], etc.)
         * @returns {Object} Property access AST node
         */
        parsePropertyAccess() {
            let path = this.advance().value;

            while (true) {
                if (this.match('DOT')) {
                    if (this.check('IDENTIFIER')) {
                        path += '.' + this.advance().value;
                    } else {
                        throw new Error('Expected property name after "."');
                    }
                } else if (this.match('LBRACKET')) {
                    const index = this.parseTernary();
                    this.consume('RBRACKET', 'Expected closing bracket');

                    // For simplicity, convert bracket notation to string
                    if (index.type === 'literal') {
                        path += `[${JSON.stringify(index.value)}]`;
                    } else {
                        path += `[${this.reconstructExpression(index)}]`;
                    }
                } else {
                    break;
                }
            }

            return {
                type: 'property',
                path
            };
        },

        /**
         * Helper method to reconstruct expression from AST (for bracket notation)
         * @param {Object} node - AST node to reconstruct
         * @returns {string} Reconstructed expression string
         */
        reconstructExpression(node) {
            if (!node) {
                return '';
            }

            switch (node.type) {
                case 'literal':
                    return typeof node.value === 'string' ? `"${node.value}"` : String(node.value);

                case 'property':
                    return node.path;

                case 'arithmetic':
                    return `${this.reconstructExpression(node.left)} ${node.operator} ${this.reconstructExpression(node.right)}`;

                default:
                    return 'unknown';
            }
        },

        /**
         * Checks if current token matches any of the given types
         * @param {...string} types - Token types to match
         * @returns {boolean} True if current token matches any type
         */
        match(...types) {
            for (const type of types) {
                if (this.check(type)) {
                    this.advance();
                    return true;
                }
            }

            return false;
        },

        /**
         * Checks if current token is an operator with given value(s)
         * @param {...string} operators - Operator values to match
         * @returns {boolean} True if current token is a matching operator
         */
        matchOperator(...operators) {
            if (this.check('OPERATOR')) {
                const current = this.peek();

                if (operators.includes(current.value)) {
                    this.advance();
                    return true;
                }
            }

            return false;
        },

        /**
         * Checks if current token is of given type
         * @param {string} type - Token type to check
         * @returns {boolean} True if current token matches type
         */
        check(type) {
            if (this.isAtEnd()) {
                return false;
            }

            return this.peek().type === type;
        },

        /**
         * Advances to next token and returns previous
         * @returns {Object} Previous token
         */
        advance() {
            if (!this.isAtEnd()) {
                this.currentToken++;
            }

            return this.previous();
        },

        /**
         * Checks if we're at end of tokens
         * @returns {boolean} True if at end
         */
        isAtEnd() {
            return this.currentToken >= this.tokens.length;
        },

        /**
         * Returns current token without advancing
         * @returns {Object} Current token
         */
        peek() {
            return this.tokens[this.currentToken] || { type: 'EOF', value: null };
        },

        /**
         * Returns previous token
         * @returns {Object} Previous token
         */
        previous() {
            return this.tokens[this.currentToken - 1];
        },

        /**
         * Consumes token of given type or throws error
         * @param {string} type - Expected token type
         * @param {string} message - Error message if not found
         * @returns {Object} Consumed token
         */
        consume(type, message) {
            if (this.check(type)) {
                return this.advance();
            }

            throw new Error(message + ` at token: ${JSON.stringify(this.peek())}`);
        },

        /**
         * Evaluates a parsed expression in the given context
         * @param {Object} parsedExpr - Parsed expression object
         * @param {Object} context - Evaluation context
         * @returns {*} Evaluated result
         */
        evaluate(parsedExpr, context) {
            if (!parsedExpr) {
                return undefined;
            }

            switch (parsedExpr.type) {
                case 'literal':
                    return parsedExpr.value;

                case 'property':
                    return Utils.getNestedValue(context, parsedExpr.path);

                case 'parentheses':
                    return this.evaluate(parsedExpr.inner, context);

                case 'object':
                    return this.evaluateObjectLiteral(parsedExpr, context);

                case 'ternary':
                    const condition = this.evaluate(parsedExpr.condition, context);

                    return condition ?
                        this.evaluate(parsedExpr.trueValue, context) :
                        this.evaluate(parsedExpr.falseValue, context);

                case 'logical':
                    const leftLogical = this.evaluate(parsedExpr.left, context);

                    if (parsedExpr.operator === '&&') {
                        return leftLogical ? this.evaluate(parsedExpr.right, context) : false;
                    } else if (parsedExpr.operator === '||') {
                        return leftLogical ? true : this.evaluate(parsedExpr.right, context);
                    } else {
                        return false;
                    }

                case 'comparison':
                case 'arithmetic':
                    const leftVal = this.evaluate(parsedExpr.left, context);
                    const rightVal = this.evaluate(parsedExpr.right, context);
                    return this.performOperation(leftVal, parsedExpr.operator, rightVal);

                case 'unary':
                    const operandValue = this.evaluate(parsedExpr.operand, context);

                    switch (parsedExpr.operator) {
                        case '!':
                            return !operandValue;

                        case '-':
                            return -operandValue;

                        case '+':
                            return +operandValue;

                        default:
                            return operandValue;
                    }

                default:
                    return undefined;
            }
        },

        /**
         * Evaluates object literal from AST
         * @param {Object} objectExpr - Object expression AST
         * @param {Object} context - Evaluation context
         * @returns {Object} Evaluated object
         */
        evaluateObjectLiteral(objectExpr, context) {
            const result = {};

            if (objectExpr.pairs) {
                objectExpr.pairs.forEach(({ key, value }) => {
                    result[key] = this.evaluate(value, context);
                });
            }

            return result;
        },

        performOperation(left, operator, right) {
            switch (operator) {
                case '+': return left + right;
                case '-': return Number(left) - Number(right);
                case '*': return Number(left) * Number(right);
                case '/': return Number(left) / Number(right);
                case '===': return left === right;
                case '!==': return left !== right;
                case '==': return left == right;
                case '!=': return left != right;
                case '>=': return left >= right;
                case '<=': return left <= right;
                case '>': return left > right;
                case '<': return left < right;
                default: return false;
            }
        },

        /**
         * Extracts dependencies from parsed AST
         * @param {Object} node - AST node
         * @returns {string[]} Array of property dependencies
         */
        extractDependencies(node) {
            if (!node) {
                return [];
            }

            const dependencies = new Set();

            const traverse = (n) => {
                if (!n) return;

                switch (n.type) {
                    case 'property':
                        const rootProp = n.path.split(/[.\[]/, 1)[0];
                        if (rootProp && !['true', 'false', 'null', 'undefined'].includes(rootProp)) {
                            dependencies.add(rootProp);
                        }
                        break;

                    case 'ternary':
                        traverse(n.condition);
                        traverse(n.trueValue);
                        traverse(n.falseValue);
                        break;

                    case 'logical':
                    case 'comparison':
                    case 'arithmetic':
                        traverse(n.left);
                        traverse(n.right);
                        break;

                    case 'unary':
                        traverse(n.operand);
                        break;

                    case 'parentheses':
                        traverse(n.inner);
                        break;

                    case 'object':
                        if (n.pairs) {
                            n.pairs.forEach(pair => traverse(pair.value));
                        }
                        break;
                }
            };

            traverse(node);
            return Array.from(dependencies);
        },

        /**
         * Parses a binding string into key-value pairs
         * @param {string} bindingString - Binding string to parse
         * @returns {Array} Array of binding pairs
         */
        parseBindingString(bindingString) {
            if (this.bindingCache.has(bindingString)) {
                return this.bindingCache.get(bindingString);
            }

            const pairs = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = '';
            let parenDepth = 0;
            let braceDepth = 0;

            for (let i = 0; i < bindingString.length; i++) {
                const char = bindingString[i];
                const isEscaped = i > 0 && bindingString[i - 1] === '\\';

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
                    } else if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                    }
                }

                if (char === ',' && !inQuotes && parenDepth === 0 && braceDepth === 0) {
                    this.addBindingPairIfValid(current, pairs);
                    current = '';
                } else {
                    current += char;
                }
            }

            this.addBindingPairIfValid(current, pairs);
            this.bindingCache.set(bindingString, pairs);
            return pairs;
        },

        /**
         * Adds a binding pair if valid
         * @param {string} pairString - Pair string
         * @param {Array} pairs - Pairs array
         */
        addBindingPairIfValid(pairString, pairs) {
            const trimmed = pairString.trim();
            if (!trimmed) return;

            const colonIndex = this.findBindingColon(trimmed);

            if (colonIndex === -1) {
                pairs.push({
                    type: trimmed,
                    target: ''
                });
            } else {
                pairs.push({
                    type: trimmed.substring(0, colonIndex).trim(),
                    target: trimmed.substring(colonIndex + 1).trim()
                });
            }
        },

        /**
         * Finds binding colon in string
         * @param {string} str - String to search
         * @returns {number} Index of colon or -1
         */
        findBindingColon(str) {
            const knownBindingTypes = [
                'value', 'checked', 'visible', 'if', 'foreach', 'class', 'style',
                'click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'
            ];

            for (const type of knownBindingTypes) {
                if (str.startsWith(type + ':')) {
                    return type.length;
                }
            }

            let inQuotes = false;
            let quoteChar = '';
            let parenDepth = 0;

            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const isEscaped = i > 0 && str[i - 1] === '\\';

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
                    } else if (char === ':' && parenDepth === 0) {
                        return i;
                    }
                }
            }

            return -1;
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
            deps: new Map(),
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
             * Sets up computed properties with consolidated dependency tracking
             */
            setupComputedProperties(reactive) {
                if (!this.original.computed) return;

                Object.keys(this.original.computed).forEach(name => {
                    const computedFn = this.original.computed[name];
                    const dependencies = this.analyzeComputedDependencies(computedFn, reactive);

                    // Store computed info
                    this.deps.set(name, {
                        fn: computedFn,
                        value: undefined,
                        isDirty: true
                    });

                    // Build reverse lookup - don't overwrite existing entries
                    dependencies.forEach(dep => {
                        if (!this.deps.has(dep)) {
                            this.deps.set(dep, { dependents: [] });
                        }
                        this.deps.get(dep).dependents = this.deps.get(dep).dependents || [];
                        this.deps.get(dep).dependents.push(name);
                    });

                    Object.defineProperty(reactive, name, {
                        get: () => {
                            const entry = this.deps.get(name);
                            if (entry.isDirty || entry.value === undefined) {
                                entry.value = entry.fn.call(reactive);
                                entry.isDirty = false;
                            }
                            return entry.value;
                        },
                        enumerable: true
                    });
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
                // Setup the intersection server
                this.setupIntersectionObserver();

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
                        this.notifyChange(path, newVal, type, meta);
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
                                    this.notifyChange(path, changedVal, type, meta);
                                }, key);
                            }

                            // Update the stored value
                            value = newValue;

                            // Notify system of changes
                            this.notifyChange(key, newValue, 'set', {oldValue});
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
                    const bindingPairs = ExpressionParser.parseBindingString(bindingString);;

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
                    id: Date.now() + '_' + (Math.random() * 10000 | 0),
                    type: type,
                    element: element,
                    ...config
                };

                // Add property tracking
                if (config.target) {
                    binding.property = config.target.split('.')[0];
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
                        return this.createValueBinding(element, target);

                    case 'visible':
                        return this.createVisibilityBinding(element, target);

                    case 'checked':
                        return this.createCheckedBinding(element, target);

                    case 'class':
                        return this.createClassBinding(element, target);

                    case 'style':
                        return this.createStyleBinding(element, target);

                    case 'if':
                        return this.createConditionalBinding(element, target);

                    case 'foreach':
                        return this.createForeachBinding(element, target);

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
                const bindingElement = this.createBinding('foreach', element, {
                    target: target,
                    collection: target,
                    itemName: element.getAttribute('data-pac-item') || 'item',
                    indexName: element.getAttribute('data-pac-index') || 'index',
                    template: element.innerHTML,
                    previous: [],
                    fingerprints: null
                });

                element.innerHTML = '';

                return bindingElement;
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
             * Creates a value binding
             */
            createValueBinding(element, target) {
                // Add attributes to element
                this.setupInputElement(element, target);
                
                // Create an input binding
                return this.createInputBinding(element, target);
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
                if (element.type === 'radio') {
                    console.warn('Radio buttons should use data-pac-bind="value:property", not "checked:property"');
                    this.setupInputElement(element, target);
                    return this.createInputBinding(element, target);
                }

                this.setupInputElement(element, target, 'checked');

                return this.createBinding('checked', element, {
                    target: target,
                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Creates a class binding
             * @param element
             * @param target
             * @returns {{id: string, type: string, element: Element}}
             */
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
                            this.getParsedExpression(binding);
                            this.unparsedBindings.delete(binding);
                        }

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
             * Marks computed properties as dirty and schedules updates
             * @param {string} changedProperty - The property that changed
             */
            updateComputedProperties(changedProperty) {
                const entry = this.deps.get(changedProperty);
                const dependentComputed = (entry && entry.dependents) ? entry.dependents : [];

                dependentComputed.forEach(computedName => {
                    const computedEntry = this.deps.get(computedName);
                    const oldValue = computedEntry ? computedEntry.value : undefined;

                    if (computedEntry) {
                        computedEntry.isDirty = true;
                    }

                    const newValue = this.abstraction[computedName];
                    const hasArrayBinding = Array.from(this.bindings.values())
                        .some(b => b.type === 'foreach' && b.collection === computedName);

                    if (hasArrayBinding || !Utils.isEqual(oldValue, newValue)) {
                        this.triggerWatcher(computedName, newValue, oldValue);
                        this.scheduleUpdate(computedName, newValue);
                        this.updateComputedProperties(computedName);
                    }
                });
            },

            /**
             * Performs initial DOM synchronization
             */
            performInitialUpdate() {
                // Update all regular properties
                Object.keys(this.abstraction).forEach(key => {
                    if (this.abstraction.hasOwnProperty(key) && typeof this.abstraction[key] !== 'function') {
                        this.scheduleUpdate(key, this.abstraction[key]);
                    }
                });

                // Update computed properties
                if (this.original.computed) {
                    Object.keys(this.original.computed).forEach(name => {
                        this.scheduleUpdate(name, this.abstraction[name]);
                    });
                }

                // Initialize foreach bindings and process no-dependency bindings
                this.bindings.forEach(binding => {
                    if (binding.type === 'foreach') {
                        // Initialize the previous state as empty array for change detection
                        binding.previous = [];

                        // Get the current collection value from the abstraction
                        const value = this.abstraction[binding.collection];

                        // Only update if the collection has a defined value
                        if (value !== undefined) {
                            // Perform initial rendering of the foreach binding
                            this.applyForeachBinding(binding, binding.collection);
                        }
                    } else if (
                        binding.target &&
                        binding.type !== 'text' &&
                        (!binding.dependencies || binding.dependencies.length === 0)
                    ) {
                        this.updateBinding(binding, null, null);
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
                            this.applyTextBinding(binding, property, foreachVars);
                            break;

                        case 'foreach':
                            this.applyForeachBinding(binding, property, foreachVars);
                            break;

                        case 'event':
                            // Events are already handled in processForeachBinding
                            break;

                        default:
                            // Create evaluation context by merging abstraction data with foreach variables
                            const context = Object.assign({}, this.abstraction, foreachVars || {});

                            // Parse the binding expression into an evaluatable format
                            const parsed = this.getParsedExpression(binding);

                            // Regular input handling (text, number, etc.)
                            const actualValue = ExpressionParser.evaluate(parsed, context);

                            // Call the correct apply method
                            switch (binding.type) {
                                case 'attribute':
                                    this.applyAttributeBinding(binding.element, binding.attribute, actualValue);
                                    break;

                                case 'input':
                                    this.applyInputBinding(binding.element, actualValue);
                                    break;

                                case 'checked':
                                    this.applyCheckedBinding(binding.element, !!actualValue);
                                    break;

                                case 'visible':
                                    this.applyVisibilityBinding(binding.element, actualValue);
                                    break;

                                case 'conditional':
                                    this.applyConditionalBinding(binding.element, actualValue, binding);
                                    break;

                                case 'class':
                                    this.applyClassBinding(binding.element, binding.target, actualValue);
                                    break;

                                case 'style':
                                    this.applyStyleBinding(binding.element, binding.target, actualValue);
                                    break;
                            }
                    }
                } catch (error) {
                    console.error(`Error updating ${binding.type} binding:`, error);
                }
            },


            /**
             * Creates a DOM element from a foreach template string by parsing HTML
             * and optimizing the structure when possible. Handles both single-element
             * and multi-node templates efficiently.
             * @param {string} template - HTML template string for the foreach item
             * @returns {Element} The rendered DOM element(s) for this foreach item
             */
            createForeachItemElement(template) {
                // Create a temporary container to parse the HTML template string
                const tempContainer = document.createElement('tbody');
                tempContainer.innerHTML = template.trim();

                // Convert NodeList to Array for easier manipulation
                const childNodes = Array.from(tempContainer.childNodes);

                // If there's exactly one top-level element, use it directly (no wrapper)
                // This optimizes the DOM structure by avoiding unnecessary wrapper elements
                if (childNodes.length === 1 && childNodes[0].nodeType === Node.ELEMENT_NODE) {
                    return childNodes[0].cloneNode(true);
                }

                // Multiple top-level nodes or text nodes - need wrapper
                // This handles cases like: "Text <span>element</span> more text" or multiple sibling elements
                const wrapper = document.createElement('span');
                childNodes.forEach(node => wrapper.appendChild(node.cloneNode(true)));
                return wrapper;
            },

            /**
             * Processes text interpolation bindings for an element by reusing existing text binding logic
             * @param {HTMLElement} element - The DOM element to process text bindings on
             * @param {Object} contextVars - Context variables for expression evaluation
             */
            processTextBindingsForElement(element, contextVars) {
                // Create a tree walker to traverse all text nodes in the element
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

                // Collect all text nodes first to avoid modifying the tree while traversing
                const textNodes = [];
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }

                // Create evaluation context
                const context = Object.assign({}, this.abstraction, contextVars);

                // Process each text node that contains interpolation patterns
                textNodes.forEach(textNode => {
                    // Fetch original text to replace
                    const originalText = textNode.textContent;

                    // Only process nodes that have interpolation patterns
                    if (/\{\{\s*[^}]+\s*\}\}/.test(originalText)) {
                        textNode.textContent = this.processTextInterpolation(originalText, context);
                    }
                });
            },

            /**
             * Processes text interpolation by finding and evaluating expressions within double curly braces.
             * Replaces {{expression}} patterns with their evaluated values from the provided context.
             * @param {string|null|undefined} textContent - The text content containing interpolation patterns
             * @param {Object} context - The context object containing variables and values for expression evaluation
             * @returns {string} The processed text with interpolations replaced by their evaluated values
             * @throws Will log warnings to console if expression evaluation fails, but won't throw errors
             * @see ExpressionParser.parseExpression
             * @see ExpressionParser.evaluate
             * @see Utils.formatValue
             */
            processTextInterpolation(textContent, context) {
                // Convert to string and handle null/undefined cases
                let text = String(textContent || '');

                // Find ALL interpolation patterns in the text
                const matches = text.match(/\{\{\s*([^}]+)\s*\}\}/g);

                if (matches) {
                    matches.forEach(match => {
                        const expression = match.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();

                        try {
                            const parsed = ExpressionParser.parseExpression(expression);
                            const result = ExpressionParser.evaluate(parsed, context);
                            const formattedValue = Utils.formatValue(result);

                            text = text.replace(match, formattedValue);
                        } catch (error) {
                            console.warn(`Error evaluating expression "${expression}":`, error);
                        }
                    });
                }

                return text;
            },

            /**
             * Processes attribute bindings for an element using existing binding infrastructure
             * @param {HTMLElement} element - Element to process attribute bindings on
             * @param {Object} contextVars - Context variables for expression evaluation
             * @param {Object} parentBinding - Parent binding context for nested scenarios
             */
            processAttributeBindingsForElement(element, contextVars, parentBinding) {
                // Find all elements with data-pac-bind attributes (including root element)
                let bindingElements = Array.from(element.querySelectorAll('[data-pac-bind]'));

                if (element.hasAttribute('data-pac-bind')) {
                    bindingElements.push(element);
                }

                // Process each element's bindings
                bindingElements.forEach(el => {
                    const bindingString = el.getAttribute('data-pac-bind');

                    if (!bindingString) {
                        return;
                    }

                    ExpressionParser.parseBindingString(bindingString).forEach(({ type, target }) => {
                        // Handle nested foreach - existing code
                        if (type === 'foreach') {
                            return;
                        }

                        // Set up two-way binding for form inputs if we're in a foreach context
                        if (parentBinding && (type === 'value' || type === 'checked') && this.isNestedProperty(target, contextVars)) {
                            const propertyPath = this.buildNestedPropertyPath(target, contextVars, parentBinding.collection, contextVars[parentBinding.indexName]);
                            this.setupInputElement(el, propertyPath, type);
                        }

                        // Handle event bindings specially if we're in foreach context
                        if (Utils.isEventType(type) && parentBinding) {
                            this.handleEventBinding(
                                el, type, target,
                                contextVars[parentBinding.itemName],
                                contextVars[parentBinding.indexName]
                            );

                            return;
                        }

                        // Handle all other bindings using existing infrastructure
                        const tempBinding = this.createEvaluationBinding(el, type, target);
                        this.updateBinding(tempBinding, null, contextVars);
                    });
                });
            },

            /**
             * Creates lightweight binding for evaluation - works with existing binding system
             * @param {HTMLElement} element - Target element
             * @param {string} type - Binding type
             * @param {string} target - Target expression
             * @returns {Object} Lightweight binding object
             */
            createEvaluationBinding(element, type, target) {
                // Determine the actual binding type to use
                // Falls back to 'attribute' for any unmapped types (custom attributes)
                const bindingType = BINDING_TYPE_MAP[type] || 'attribute';

                return {
                    id: `eval_${Date.now() + '_' + (Math.random() * 10000 | 0)}`,
                    type: bindingType,
                    element: element,
                    target: target,
                    attribute: bindingType === 'attribute' ? type : null,
                    parsedExpression: null,
                    dependencies: null
                };
            },

            /**
             * Generates fingerprints for change detection
             * @param {Array} array - Array to generate fingerprints for
             * @returns {Array} Array of fingerprint objects
             */
            generateFingerprints(array) {
                return array.map((item, index) => ({
                    index,
                    id: this.getItemId(item),
                    hash: this.generateItemHash(item)
                }));
            },

            /**
             * Gets stable identifier for an item
             * @param {*} item - Item to get identifier for
             * @returns {string|*} Stable identifier
             */
            getItemId(item) {
                if (!item || typeof item !== 'object') {
                    return item;
                }

                return item.id !== undefined ? item.id : `hash_${this.generateItemHash(item)}`;
            },

            /**
             * Generates hash for deep content comparison
             * @param {*} item - Item to hash
             * @returns {string} Hash string
             */
            generateItemHash(item) {
                if (item === null || item === undefined) {
                    return 'null';
                }

                if (typeof item !== 'object') {
                    return `${typeof item}:${item}`;
                }

                const sortedEntries = Object.entries(item)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => `${key}:${this.generateItemHash(value)}`);

                return this.hashString(sortedEntries.join('|'));
            },

            /**
             * Simple string hash function
             * @param {string} str - String to hash
             * @returns {string} Hash value as base36 string
             */
            hashString(str) {
                let hash = 0;

                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }

                return hash.toString(36);
            },

            /**
             * Applies style binding to a DOM element
             * @param {HTMLElement} element - The target DOM element
             * @param {string} target - The original target expression (for debugging)
             * @param {Object|string} value - The style value(s) to apply
             */
            applyStyleBinding(element, target, value) {
                if (typeof value === 'string') {
                    // String syntax: "color: red; font-size: 16px;"
                    // Set the entire CSS text at once (less efficient but backwards compatible)
                    element.style.cssText = value;
                    return;
                }

                // Check if value is an object (preferred object syntax)
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Object syntax: { color: 'red', fontSize: '16px' }
                    // Iterate through each style property in the object
                    Object.keys(value).forEach(styleProp => {
                        // Only set non-null/undefined values to avoid clearing styles accidentally
                        if (value[styleProp] != null) {
                            // Check if this is a CSS custom property (starts with --)
                            if (styleProp.startsWith('--')) {
                                element.style.setProperty(styleProp, value[styleProp]); // CSS custom properties
                            } else {
                                element.style[styleProp] = value[styleProp]; // regular CSS properties
                            }
                        }
                    });
                }
            },

            // === FOREACH RENDERING SECTION ===

            /**
             * Renders a single item from a foreach loop by processing the template with item-specific data.
             * Handles both single-element and multi-node templates, optimizing DOM structure when possible.
             * @param {Object} binding - The foreach binding object containing template and configuration
             * @param {*} item - The current item data from the collection being iterated
             * @param {number} index - The zero-based index of the current item in the collection
             * @returns {Element} The rendered DOM element(s) for this foreach item
             */
            renderForeachItem(binding, item, index) {
                // Create a temporary container to parse the HTML template string
                const tempTbody = document.createElement('tbody');
                tempTbody.innerHTML = binding.template.trim();

                // Convert NodeList to Array for easier manipulation
                const childNodes = Array.from(tempTbody.childNodes);

                // If there's exactly one top-level element, use it directly (no wrapper)
                // This optimizes the DOM structure by avoiding unnecessary wrapper elements
                if (childNodes.length === 1 && childNodes[0].nodeType === Node.ELEMENT_NODE) {
                    const element = childNodes[0];

                    // Clone the element to avoid modifying the original template
                    const clone = element.cloneNode(true);

                    // Process the cloned element with foreach context data (item, index, variable names)
                    this.processForeachTemplate(clone, item, index, binding.itemName, binding.indexName, binding.collection);

                    // Return the clone
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
                this.processForeachTemplate(wrapper, item, index, binding.itemName, binding.indexName, binding.collection);

                // Return the wrapper
                return wrapper;
            },

            /**
             * Processes a template element for foreach loops, handling text interpolation and data bindings
             * with proper support for nested foreach loops by maintaining a scope chain of variables.
             * @param {Element} element - The DOM element to process (template container)
             * @param {*} item - The current item from the collection being iterated over
             * @param {number} index - The zero-based index of the current item in the iteration
             * @param {string} itemName - The variable name for the current item (e.g., 'user', 'product')
             * @param {string} indexName - The variable name for the current index (e.g., 'i', 'index')
             * @param {string} collectionName - The name of the collection being iterated over
             * @param {Object} [parentVars={}] - Variables inherited from parent foreach scopes for nesting support
             */
            processForeachTemplate(element, item, index, itemName, indexName, collectionName, parentVars = {}) {
                // Create foreach variables for this iteration, inheriting from parent scopes
                const foreachVars = Object.assign({}, parentVars, {
                    [itemName]: item,
                    [indexName]: index
                });

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
                    // Replace template expressions with improved variable resolution
                    textNode.textContent = textNode.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
                        expr = expr.trim();

                        // Try to resolve the expression using the current scope chain
                        const resolved = this.resolveTemplateExpression(expr, foreachVars);
                        return resolved !== undefined ? Utils.formatValue(resolved) : match;
                    });
                });

                // Find immediate child foreach elements to handle nested loops separately
                const childForeachElements = this.findDirectChildForeachElements(element);

                // Process non-foreach binding elements first
                let bindingElements = Array.from(element.querySelectorAll('[data-pac-bind]'))
                    .filter(el => !childForeachElements.includes(el));

                // Also check if the current element itself has bindings
                // Also check if the current element itself has bindings
                if (element.hasAttribute('data-pac-bind')) {
                    bindingElements.push(element);
                }

                bindingElements.forEach(el => {
                    const bindings = el.getAttribute('data-pac-bind');

                    if (!bindings) {
                        return;
                    }

                    // Parse and process each binding
                    ExpressionParser.parseBindingString(bindings).forEach(({ type, target }) => {
                        // Skip nested foreach bindings - they'll be handled separately
                        if (type === 'foreach') {
                            return;
                        }

                        // Set up two-way binding for form inputs
                        if ((type === 'value' || type === 'checked') && this.isNestedProperty(target, foreachVars)) {
                            const propertyPath = this.buildNestedPropertyPath(target, foreachVars, collectionName, index);
                            this.setupInputElement(el, propertyPath, type);
                        }

                        // Process other types of bindings
                        this.processForeachBinding(el, type, target, foreachVars);
                    });
                });

                // Now handle nested foreach loops with proper scope inheritance
                childForeachElements.forEach(childElement => {
                    const bindingAttr = childElement.getAttribute('data-pac-bind');
                    const foreachMatch = bindingAttr.match(/foreach:\s*([^,}]+)/);

                    if (foreachMatch) {
                        const nestedTarget = foreachMatch[1].trim();
                        const nestedItemName = childElement.getAttribute('data-pac-item') || 'item';
                        const nestedIndexName = childElement.getAttribute('data-pac-index') || 'index';

                        // Create nested foreach binding with proper scope inheritance
                        this.processNestedForeachBinding(
                            childElement,
                            nestedTarget,
                            nestedItemName,
                            nestedIndexName,
                            foreachVars
                        );
                    }
                });
            },

            /**
             * Resolves template expressions using a hierarchical variable scope chain.
             * @param {string} expr - The expression to resolve (e.g., 'item', 'item.name', 'user.profile.email')
             * @param {Object} foreachVars - Object containing all foreach variables from current and parent scopes
             * @returns {*} The resolved value, or undefined if the expression cannot be resolved
             */
            resolveTemplateExpression(expr, foreachVars) {
                // Try foreach variables first (most specific scope)
                if (foreachVars.hasOwnProperty(expr)) {
                    return foreachVars[expr];
                }

                // Check for property access on foreach variables
                for (const [varName, varValue] of Object.entries(foreachVars)) {
                    if (expr.startsWith(`${varName}.`)) {
                        const propertyPath = expr.substring(varName.length + 1);
                        return Utils.getNestedValue(varValue, propertyPath);
                    }
                }

                // Fall back to component abstraction
                return Utils.getNestedValue(this.abstraction, expr);
            },

            /**
             * Finds direct child elements that have foreach bindings to prevent improper nesting processing.
             * @param {Element} element - The parent element to search within
             * @returns {Element[]} Array of direct child elements that have foreach bindings
             */
            findDirectChildForeachElements(element) {
                const result = [];
                const children = Array.from(element.children);

                children.forEach(child => {
                    const bindings = child.getAttribute('data-pac-bind');

                    if (bindings && bindings.includes('foreach:')) {
                        result.push(child);
                    }
                });

                return result;
            },

            /**
             * Processes a nested foreach binding by evaluating the target expression
             * and rendering each item in the resulting array
             * @param {HTMLElement} element - The DOM element containing the foreach template
             * @param {string} target - The expression to evaluate (e.g., "items.children")
             * @param {string} itemName - Variable name for each item (e.g., "child")
             * @param {string} indexName - Variable name for the index (e.g., "childIndex")
             * @param {Object} parentVars - Variables from parent scope (outer foreach loops)
             */
            processNestedForeachBinding(element, target, itemName, indexName, parentVars) {
                // Create evaluation context by merging abstraction data with foreach variables
                // This allows access to both component data and parent loop variables
                const context = Object.assign({}, this.abstraction, parentVars);

                // Parse the binding expression into an evaluatable format
                // Converts string like "items.children" into an Abstract Syntax Tree
                const parsed = ExpressionParser.parseExpression(target);

                // Evaluate the AST against the current context to get the actual array
                // This resolves the expression to its concrete value
                const nestedArray = ExpressionParser.evaluate(parsed, context);

                // Safety check: ensure we have a valid array to iterate over
                // If the expression doesn't resolve to an array, exit early
                if (!Array.isArray(nestedArray)) {
                    return;
                }

                // Store original template HTML before clearing the element
                // This template will be cloned for each array item
                const template = element.innerHTML;

                // Clear the element to prepare for new content
                element.innerHTML = '';

                // Create document fragment for efficient DOM manipulation
                // Fragments allow batch DOM updates, improving performance
                const fragment = document.createDocumentFragment();

                // Iterate through each item in the nested array
                nestedArray.forEach((nestedItem, nestedIndex) => {
                    // Render individual item using the stored template
                    // Pass all necessary context including parent variables
                    const itemElement = this.renderNestedForeachItem(
                        template,           // Original template HTML
                        nestedItem,         // Current array item data
                        nestedIndex,        // Current item index
                        itemName,           // Variable name for the item
                        indexName,          // Variable name for the index
                        target,             // Original target expression
                        parentVars          // Variables from parent scope for nested access
                    );

                    // Add the rendered item to the document fragment
                    fragment.appendChild(itemElement);
                });

                // Append all rendered items to the DOM in a single operation
                // This minimizes DOM reflows and improves performance
                element.appendChild(fragment);
            },

            /**
             * Renders a single item from a nested foreach loop by cloning the template
             * and processing it with the current item's data and scope variables
             * @param {string} template - HTML template string to clone for this item
             * @param {*} item - The current array item data
             * @param {number} index - The current item's index in the array
             * @param {string} itemName - Variable name for the current item (e.g., "child")
             * @param {string} indexName - Variable name for the current index (e.g., "childIndex")
             * @param {string} collectionName - Name of the collection being iterated
             * @param {Object} parentVars - Variables inherited from parent foreach scopes
             * @returns {HTMLElement} Processed DOM element ready for insertion
             */
            renderNestedForeachItem(template, item, index, itemName, indexName, collectionName, parentVars) {
                // Create a temporary container to parse the template HTML
                // This allows us to work with actual DOM nodes rather than raw HTML strings
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = template.trim(); // Remove whitespace to avoid text nodes

                // Convert NodeList to Array for easier manipulation
                // This gives us access to array methods and ensures consistent behavior
                const childNodes = Array.from(tempContainer.childNodes);

                // Check if template contains a single element node
                // Single elements are preferred as they don't need wrapper containers
                if (childNodes.length === 1 && childNodes[0].nodeType === Node.ELEMENT_NODE) {
                    // Extract the single element from the temporary container
                    const element = childNodes[0];

                    // Create a deep clone to avoid modifying the original template
                    // Deep cloning ensures all child elements and attributes are copied
                    const clone = element.cloneNode(true);

                    // Process the cloned element with current item data and parent scope
                    // This handles binding resolution, nested loops, and variable substitution
                    this.processForeachTemplate(clone, item, index, itemName, indexName, collectionName, parentVars);

                    // Return the processed single element
                    return clone;
                }

                // Handle multiple nodes or text nodes in template
                // When template has multiple root elements, we need a wrapper container
                const wrapper = document.createElement('span'); // Use span as lightweight wrapper

                // Clone each child node and add to wrapper
                // This preserves the original template structure while creating an isolated copy
                childNodes.forEach(node => {
                    // Clone each node (element, text, comment, etc.) and append to wrapper
                    wrapper.appendChild(node.cloneNode(true));
                });

                // Process the entire wrapper with all child nodes
                // The wrapper acts as a single root element for processing
                this.processForeachTemplate(wrapper, item, index, itemName, indexName, collectionName, parentVars);

                // Return the wrapper containing all processed template nodes
                return wrapper;
            },

            /**
             * Checks if a target expression represents a nested property that should use foreach variables.
             * @param {string} target - The binding target expression to check (e.g., "item.completed", "user.name")
             * @param {Object} foreachVars - Object containing all available foreach variables from current and parent scopes
             * @returns {boolean} True if the target starts with a foreach variable name, false otherwise
             */
            isNestedProperty(target, foreachVars) {
                return Object.keys(foreachVars).some(varName =>
                    target.startsWith(`${varName}.`)
                );
            },

            /**
             * Builds the proper property path for nested bindings in foreach contexts.
             * @param {string} target - The original binding target expression (e.g., "item.completed")
             * @param {Object} foreachVars - Object containing all foreach variables with their current values
             * @param {string} collectionName - The name of the collection in the data model (e.g., "todos")
             * @param {number} index - The current index in the foreach iteration
             * @returns {string} The absolute property path for data binding, or original target if no match
             */
            buildNestedPropertyPath(target, foreachVars, collectionName, index) {
                for (const [varName, varValue] of Object.entries(foreachVars)) {
                    if (target.startsWith(`${varName}.`)) {
                        const propertyPath = target.substring(varName.length + 1);
                        return `${collectionName}.${index}.${propertyPath}`;
                    }
                }

                return target;
            },

            /**
             * Processes individual bindings within foreach templates by using the existing binding system
             * @param {HTMLElement} element - The DOM element to apply the binding to
             * @param {string} type - The type of binding (class, checked, event name, or attribute name)
             * @param {string} target - The expression or property path to evaluate
             * @param {Object} foreachVars - The foreach variables (item, index, etc.)
             */
            processForeachBinding(element, type, target, foreachVars) {
                // For event bindings, handle them specially since they need item/index passed
                if (Utils.isEventType(type)) {
                    this.handleEventBinding(
                        element, type, target,
                        foreachVars[Object.keys(foreachVars)[0]],
                        foreachVars[Object.keys(foreachVars)[1]]
                    );

                    return;
                }

                // Create a temporary binding object for updateBindingGeneric
                const tempBinding = this.createBindingByType(element, type, target);

                // Use the existing generic binding update system
                this.updateBinding(tempBinding, null, foreachVars);
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

            // === UNIFIED CHANGE DETECTION SECTION ===

            /**
             * Central change notification hub - all property changes flow through here
             */
            notifyChange(propertyPath, newValue, changeType, metadata = {}) {
                const rootProperty = propertyPath.split('.')[0];

                // 1. Update watchers (immediate)
                this.triggerWatcher(rootProperty, newValue, metadata.oldValue, propertyPath);

                // 2. Invalidate computed properties (immediate)
                this.updateComputedProperties(rootProperty);

                // 3. Schedule DOM updates (batched)
                this.scheduleUpdate(propertyPath, newValue);

                // 4. Bubble to root if this is a nested change
                if (propertyPath !== rootProperty) {
                    this.bubbleChangeNotification(rootProperty, this.abstraction[rootProperty], 'nested-change', {
                        nestedPath: propertyPath,
                        newValue,
                        oldValue: metadata.oldValue
                    });
                }
            },

            /**
             * Renamed from notifyParentChange - bubbles nested changes to root property listeners
             */
            bubbleChangeNotification(rootProperty, rootValue, changeType, metadata) {
                // Trigger root property watcher with full context
                this.triggerWatcher(rootProperty, rootValue, metadata.oldValue, metadata.nestedPath);

                // Update computed properties that depend on root
                this.updateComputedProperties(rootProperty);

                // Schedule root property updates
                this.scheduleUpdate(rootProperty, rootValue);
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
             * Apply the condition binding
             * @param element
             * @param actualValue
             * @param binding
             */
            applyConditionalBinding(element, actualValue, binding) {
                // Early return if the value did not change
                if (binding.isRendered === actualValue) {
                    return;
                }

                // If true, add the element to the DOM
                if (actualValue) {
                    // Add element to DOM: Replace the placeholder comment with the actual DOM element
                    if (binding.placeholder && binding.placeholder.parentNode) {
                        binding.placeholder.parentNode.replaceChild(element, binding.placeholder);
                    }

                    // Update the binding state to reflect that element is now in the DOM
                    binding.isRendered = true;
                    return;
                }

                // Otherwise remove element from DOM
                // Replace the DOM element with a placeholder comment
                // Create placeholder comment if it doesn't exist yet
                if (!binding.placeholder) {
                    binding.placeholder = document.createComment(`pac-if: ${binding.target}`);
                }

                // Replace the element with the invisible placeholder comment (removes from DOM)
                if (element.parentNode) {
                    element.parentNode.replaceChild(binding.placeholder, element);
                }

                // Update the binding state to reflect that element is now removed from DOM
                binding.isRendered = false;
            },

            /**
             * Apply attribute binding
             * @param element
             * @param attribute
             * @param value
             */
            applyAttributeBinding(element, attribute, value) {
                this.setElementAttribute(element, attribute, value);
            },

            /**
             * Apply input binding to element
             * @param {HTMLElement} element - The target DOM element
             * @param actualValue - The value to set
             */
            applyInputBinding(element, actualValue) {
                // For radio buttons, we check if the element's value matches the property value
                if (element.type === 'radio') {
                    this.applyRadioBinding(element, actualValue);
                    return;
                }

                // For everything else directly set the value
                if (element.value !== String(actualValue || '')) {
                    element.value = actualValue || '';
                }
            },

            /**
             * Applies checked state to a radio element
             * @param {HTMLElement} element - The target DOM element
             * @param {boolean} value
             */
            applyRadioBinding(element, value) {
                element.checked = (element.value === String(value || ''));
            },

            /**
             * Applies checked state to any element except radio
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
                // Remove previously applied classes
                this.clearPreviousClasses(element);

                // Determine new classes to apply
                const newClasses = this.parseClassValue(value);

                // Apply new classes and store for next time
                newClasses.forEach(cls => element.classList.add(cls));
                element.dataset.pacPreviousClasses = newClasses.join(' ');
            },

            /**
             * Remove all previously applied classes from the element
             * @param {HTMLElement} element - The target DOM element
             */
            clearPreviousClasses(element) {
                const previousClasses = element.dataset.pacPreviousClasses;

                if (previousClasses) {
                    previousClasses.split(' ').forEach(cls => {
                        if (cls.trim()) {
                            element.classList.remove(cls.trim());
                        }
                    });
                }
            },

            /**
             * Parse different value types and return array of class names to apply
             * @param {*} value - The evaluated expression value
             * @returns {string[]} Array of valid class names
             */
            parseClassValue(value) {
                // Object syntax: { className: boolean, className2: boolean }
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    return Object.entries(value)
                        .filter(([className, isActive]) => isActive && className.trim())
                        .map(([className]) => className.trim());
                }

                // Array of class names
                if (Array.isArray(value)) {
                    return value
                        .filter(cls => cls && typeof cls === 'string' && cls.trim())
                        .map(cls => cls.trim());
                }

                // String value - single class or space-separated classes
                if (typeof value === 'string') {
                    return value.trim().split(/\s+/).filter(cls => cls.trim());
                }

                // Truthy non-string value - convert to string
                if (value) {
                    const className = String(value).trim();
                    return className ? [className] : [];
                }

                return [];
            },

            /**
             * Updates text content with interpolated values - FIXED VERSION
             * Now handles multiple placeholders in the same text node correctly
             */
            applyTextBinding(binding, property, contextVars = null) {
                const textNode = binding.element;

                // Create evaluation context - merge abstraction with optional context
                const context = contextVars ?
                    Object.assign({}, this.abstraction, contextVars) :
                    this.abstraction;

                // Use the shared interpolation utility
                const newText = this.processTextInterpolation(binding.originalText, context);

                // Update text content if changed (with caching)
                const cacheKey = `text_${binding.id}`;
                const lastValue = this.lastValues.get(cacheKey);

                if (lastValue !== newText) {
                    this.lastValues.set(cacheKey, newText);
                    textNode.textContent = newText;
                }
            },

            /**
             * Updates foreach bindings for list rendering by re-rendering the entire collection
             * when the underlying data changes. Uses intelligent diffing and fingerprinting
             * to avoid unnecessary DOM updates when the collection hasn't actually changed.
             * @param {Object} binding - The foreach binding configuration object
             * @param {string} binding.collection - Name of the collection property being rendered
             * @param {string} binding.template - HTML template string for each item
             * @param {string} binding.itemName - Variable name for the current item (e.g., 'item', 'user')
             * @param {string} binding.indexName - Variable name for the current index (e.g., 'index', 'i')
             * @param {Array} binding.previous - Previously rendered array state for change detection
             * @param {array} binding.fingerprints - Hashes of the previous array state for quick comparison
             * @param {HTMLElement} binding.element - DOM container element to render items into
             * @param {string|null} property - The specific property that changed (null for force update)
             * @param {Object|null} foreachVars - Additional context variables from parent foreach loops
             * @returns {void}
             */
            applyForeachBinding(binding, property, foreachVars = null) {
                // Only update if this binding is for the changed property OR if property is null (force update)
                if (property && binding.collection !== property) {
                    return;
                }

                // Create evaluation context by merging abstraction data with foreach variables
                const context = Object.assign({}, this.abstraction, foreachVars || {});

                // Parse the binding expression to get the array value
                const parsed = this.getParsedExpression(binding);
                const arrayValue = ExpressionParser.evaluate(parsed, context);

                // Ensure we have a valid array to work with
                const array = Array.isArray(arrayValue) ? arrayValue : [];
                const forceUpdate = binding.previous === null;

                // Check if any nested properties of the collection have changed
                const hasDirectNestedChanges = this.pendingUpdates &&
                    Array.from(this.pendingUpdates).some(prop =>
                        prop.startsWith(binding.collection + '.')
                    );

                // Generate fingerprint for change detection - comparing deep structure
                const currentFingerprints = this.generateFingerprints(array);
                const previousFingerprints = binding.fingerprints || [];

                // Skip update if arrays are deeply equal AND we're not forcing an update AND no nested changes
                if (!forceUpdate && !hasDirectNestedChanges &&
                    Utils.isEqual(currentFingerprints, previousFingerprints)) {
                    binding.previous = [...array];
                    return;
                }

                // Store new fingerprint and cache current array state
                binding.fingerprints = currentFingerprints;
                binding.previous = [...array];

                // Clear current element html to accept new html
                binding.element.innerHTML = '';

                // Build new content using DocumentFragment for efficient DOM manipulation
                const fragment = document.createDocumentFragment();

                array.forEach((item, index) => {
                    // Create DOM structure from template
                    const itemElement = this.createForeachItemElement(binding.template);

                    // Create context variables for this foreach item
                    const itemContext = Object.assign({}, foreachVars || {}, {
                        [binding.itemName]: item,
                        [binding.indexName]: index
                    });

                    // Process text interpolation using existing text binding infrastructure
                    this.processTextBindingsForElement(itemElement, itemContext);

                    // Process attribute bindings using existing attribute binding system
                    this.processAttributeBindingsForElement(itemElement, itemContext, binding);

                    // Add itemElement to fragment
                    fragment.appendChild(itemElement);
                });

                // Replace all existing content with new rendered items
                binding.element.appendChild(fragment);
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
                this.deps.clear();
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