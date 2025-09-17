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
    "use strict";

    // =============================================================================
    // CONSTANTS AND CONFIGURATION
    // =============================================================================

    const INTERPOLATION_REGEX = /\{\{\s*([^}]+)\s*}}/g;
    const INTERPOLATION_TEST_REGEX = /\{\{.*}}/;

    /**
     * All binding types
     * @type {string[]}
     */
    const KNOWN_BINDING_TYPES = [
        "value", "checked", "visible", "if", "foreach", "class", "style",
        "click", "change", "input", "submit", "focus", "blur", "keyup", "keydown"
    ];

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Core utility functions for the framework
     * @namespace Utils
     */
    const Utils = {

        /**
         * Determines if an element belongs to the specified PAC container, with performance optimizations.
         * Uses WeakMap caching to avoid repeated DOM traversals for the same elements.
         * @param {Element} container - The PAC container element with data-pac-container attribute
         * @param {Node} element - The element to check (can be Element or Text node)
         * @returns {boolean} True if element belongs to this container, false otherwise
         */
        belongsToThisContainer(container, element) {
            // Initialize WeakMap cache on first use - automatically garbage collected when elements are removed
            if (!this._cache) {
                this._cache = new WeakMap();
            }

            // Check cache first - O(1) lookup avoids expensive DOM traversals
            const cached = this._cache.get(element);

            // Cache hit: element belongs to this container
            if (cached === container) {
                return true;
            }

            // Cache hit: element doesn't belong to any container
            if (cached === false) {
                return false;
            }

            // Determine if element belongs to container
            let belongs;

            if (element.nodeType === Node.TEXT_NODE) {
                // Text nodes don't have closest() method, so check their parent element
                const parent = element.parentElement;

                belongs = parent &&
                    container.contains(parent) &&  // Fast containment check first
                    parent.closest('[data-pac-container]') === container;  // Verify correct container
            } else {
                // Element nodes: check containment then verify it's not in a nested container
                belongs = container.contains(element) &&  // Fast containment check first
                    element.closest('[data-pac-container]') === container;  // Verify correct container
            }

            // Cache result: store container reference if belongs, false if not
            // WeakMap automatically cleans up when element is garbage collected
            this._cache.set(element, belongs ? container : false);
            return belongs;
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

            if (typeof elementOrSelector !== 'string') {
                element = elementOrSelector && elementOrSelector.nodeType ? elementOrSelector : null;
            } else if (elementOrSelector.startsWith('#')) {
                element = document.getElementById(elementOrSelector.slice(1));
            } else {
                element = document.querySelector(elementOrSelector);
            }

            // Early return if element doesn't exist to prevent errors
            if (!element) {
                console.warn('Element not found: ' + elementOrSelector);
                return false;
            }

            // Use switch(true) pattern to check multiple conditions in order of priority
            switch (true) {
                case element.tagName === 'SELECT':
                    return element.value; // Get selected option value

                case element.type === 'checkbox':
                    return element.checked; // true/false based on checked state

                case element.type === 'radio': {
                    // Radio buttons work in groups, so find the currently checked one
                    // Use the 'name' attribute to identify radio buttons in the same group
                    const checkedRadio = document.querySelector('input[name="' + element.name + '"]:checked');
                    return checkedRadio ? checkedRadio.value : ''; // Get value or empty string
                }

                case element.tagName === 'INPUT' || element.tagName === 'TEXTAREA':
                    return element.value; // Get the input value

                default:
                    // Extract text content, preferring textContent over innerText
                    // textContent gets all text including hidden elements
                    // innerText respects styling and returns visible text only
                    return element.textContent || element.innerText;
            }
        },

        /**
         * Sets a value to a DOM element (input, select, textarea, etc.)
         * @param {string|Element} elementOrSelector - CSS selector, ID selector, or DOM element reference
         * @param {string|boolean} value - The value to set (string for most inputs, boolean for checkboxes)
         * @returns {boolean} True if value was set successfully, false otherwise
         */
        writeDOMValue: (elementOrSelector, value) => {
            // Find the element using either ID selector (#id) or CSS selector
            // Check if selector starts with '#' to use getElementById for better performance
            let element;

            if (typeof elementOrSelector !== 'string') {
                element = elementOrSelector && elementOrSelector.nodeType ? elementOrSelector : null;
            } else if (elementOrSelector.startsWith('#')) {
                element = document.getElementById(elementOrSelector.slice(1));
            } else {
                element = document.querySelector(elementOrSelector);
            }

            // Early return if element doesn't exist to prevent errors
            if (!element) {
                console.warn('Element not found: ' + elementOrSelector);
                return false;
            }

            // Use switch(true) pattern to check multiple conditions in order of priority
            switch (true) {
                case element.tagName === 'SELECT': {
                    element.value = value;
                    element.dispatchEvent(new Event('change', {bubbles: true}));
                    return true;
                }

                case element.type === 'checkbox': {
                    element.checked = Boolean(value);
                    element.dispatchEvent(new Event('change', {bubbles: true}));
                    return true;
                }

                case element.type === 'radio': {
                    // Radio buttons work in groups, so find the one with matching value
                    // Use the 'name' attribute to identify radio buttons in the same group
                    const targetRadio = document.querySelector('input[name="' + element.name + '"][value="' + value + '"]');

                    if (!targetRadio) {
                        console.warn('Radio button with value "' + value + '" not found in group "' + element.name + '"');
                        return false;
                    }

                    targetRadio.checked = true;
                    targetRadio.dispatchEvent(new Event('change', {bubbles: true}));
                    return true;
                }

                case element.tagName === 'INPUT' || element.tagName === 'TEXTAREA': {
                    element.value = value;
                    element.dispatchEvent(new Event('input', {bubbles: true}));
                    element.dispatchEvent(new Event('change', {bubbles: true}));
                    return true;
                }

                default: {
                    // Set text content for other elements
                    // Use textContent to set plain text (safer than innerHTML)
                    element.textContent = value;
                    return true;
                }
            }
        }
    }

    // ========================================================================
    // ENHANCED REACTIVE PROXY WITH ARRAY-SPECIFIC EVENTS
    // ========================================================================

    function makeDeepReactiveProxy(value, container) {
        const ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

        function createProxy(obj, currentPath) {
            currentPath = currentPath || [];

            return new Proxy(obj, {
                get: function (target, prop) {
                    const val = target[prop];

                    // Handle array methods first
                    if (Array.isArray(target) && typeof val === 'function' && ARRAY_METHODS.includes(prop)) {
                        return function () {
                            // For methods that add items, proxy the arguments first
                            if (prop === 'push' || prop === 'unshift') {
                                for (let i = 0; i < arguments.length; i++) {
                                    if (arguments[i] && typeof arguments[i] === 'object' && !arguments[i]._isReactive) {
                                        arguments[i] = createProxy(arguments[i], currentPath.concat([target.length + i]));
                                        arguments[i]._isReactive = true;
                                    }
                                }
                            } else if (prop === 'splice' && arguments.length > 2) {
                                // For splice, items to add start at index 2
                                for (let i = 2; i < arguments.length; i++) {
                                    if (arguments[i] && typeof arguments[i] === 'object' && !arguments[i]._isReactive) {
                                        arguments[i] = createProxy(arguments[i], currentPath.concat([arguments[0] + i - 2]));
                                        arguments[i]._isReactive = true;
                                    }
                                }
                            }

                            const oldArray = Array.prototype.slice.call(target);
                            const result = Array.prototype[prop].apply(target, arguments);
                            const newArray = Array.prototype.slice.call(target);

                            // Dispatch array-specific event
                            container.dispatchEvent(new CustomEvent("pac:array-change", {
                                detail: {
                                    path: currentPath,
                                    oldValue: oldArray,
                                    newValue: newArray,
                                    method: prop
                                }
                            }));

                            return result;
                        };
                    }

                    // Check if this property is a getter-only property (computed property)
                    const descriptor = Object.getOwnPropertyDescriptor(target, prop);
                    if (descriptor && descriptor.get && !descriptor.set) {
                        // This is a getter-only property (computed), return the value as-is
                        return val;
                    }

                    // Don't make functions reactive, just return them as-is
                    if (typeof val === 'function') {
                        return val;
                    }

                    // CRITICAL FIX: Lazy wrapping of nested objects and arrays
                    // If the value is an object/array and not already reactive, wrap it in a proxy
                    if (val && typeof val === 'object' && !val._isReactive) {
                        const propertyPath = currentPath.concat([prop]);
                        const proxiedVal = createProxy(val, propertyPath);
                        proxiedVal._isReactive = true;

                        // Update the original object with the proxy
                        target[prop] = proxiedVal;

                        return proxiedVal;
                    }

                    return val;
                },

                set: function (target, prop, newValue) {
                    const oldValue = target[prop];
                    const propertyPath = currentPath.concat([prop]);

                    if (oldValue === newValue) {
                        return true;
                    }

                    // Wrap objects and arrays in proxies when they're assigned
                    if (newValue && typeof newValue === 'object') {
                        target[prop] = createProxy(newValue, propertyPath);
                        target[prop]._isReactive = true;
                    } else {
                        target[prop] = newValue;
                    }

                    // Dispatch array-specific event if this is an array assignment
                    if (Array.isArray(newValue)) {
                        container.dispatchEvent(new CustomEvent("pac:array-change", {
                            detail: {
                                path: propertyPath,
                                oldValue: oldValue,
                                newValue: target[prop],
                                method: 'assignment'
                            }
                        }));
                    }

                    container.dispatchEvent(new CustomEvent("pac:change", {
                        detail: {
                            path: propertyPath,
                            oldValue: oldValue,
                            newValue: target[prop]
                        }
                    }));

                    return true;
                }
            });
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        return createProxy(value, []);
    }

    // ============================================================================
    // Send PAC-events for changed DOM elements
    // ============================================================================

    const DomUpdateTracker = {
        _initialized: false,

        initialize() {
            const self = this;

            if (this._initialized) {
                return;
            }

            this._initialized = true;

            document.addEventListener('click', function (event) {
                self.dispatchTrackedEvent('pac:dom:click', event, {
                    clientX: event.clientX ?? null,   // Relative to viewport
                    clientY: event.clientY ?? null,
                    pageX: event.pageX ?? null,       // Relative to document
                    pageY: event.pageY ?? null,
                    screenX: event.screenX ?? null,   // Relative to screen
                    screenY: event.screenY ?? null,
                    button: event.button ?? null,     // which button was pressed (0=left, 1=middle, 2=right, -1=none)
                    buttons: event.buttons ?? null,   // bitmask of currently pressed buttons (1=left, 2=right, 4=middle)
                });
            });

            // Change event (when input element loses focus)
            // Only handle change events for select, radio, and checkbox
            document.addEventListener('change', function (event) {
                if (
                    event.target.tagName === 'SELECT' ||
                    event.target.type === 'radio' ||
                    event.target.type === 'checkbox'
                ) {
                    self.dispatchTrackedEvent('pac:dom:change', event);
                }
            });

            // Input event (when user types)
            // Only handle input events for text inputs and textareas
            document.addEventListener('input', function (event) {
                if (
                    event.target.tagName === 'INPUT' &&
                    !['radio', 'checkbox'].includes(event.target.type) || event.target.tagName === 'TEXTAREA'
                ) {
                    self.dispatchTrackedEvent('pac:dom:change', event);
                }
            });

            // Submit event (when user submits form)
            document.addEventListener('submit', function (event) {
                const formData = new FormData(event.target);
                const formObject = Object.fromEntries(formData.entries());

                self.dispatchTrackedEvent('pac:dom:submit', event, {
                    formId: event.target.id || null,
                    formData: formObject,
                    elementCount: event.target.elements.length
                });
            });
        },

        dispatchTrackedEvent(eventName, originalEvent, extra = {}) {
            const container = originalEvent.target.closest('[data-pac-container]');

            if (!container) {
                return;
            }

            container.dispatchEvent(new CustomEvent(eventName, {
                detail: {
                    timestamp: Date.now(),
                    id: originalEvent.target.id || null,
                    elementType: originalEvent.target.type || originalEvent.target.tagName.toLowerCase(),
                    elementName: originalEvent.target.name || null,
                    target: originalEvent.target,
                    value: Utils.readDOMValue(originalEvent.target),
                    originalEvent: originalEvent,
                    bindString: originalEvent.target.getAttribute('data-pac-bind') ?? '',
                    extra: extra
                }
            }));
        }
    }

    // ============================================================================
    // EXPRESSION PARSER
    // ============================================================================

    const ExpressionParser = {
        /**
         * Cache for parsed expressions to avoid re-parsing
         * @type {Map<string, Object>}
         */
        tokens: [],
        currentToken: 0,

        OPERATOR_PRECEDENCE: {
            '||': 1, '&&': 2,
            '===': 6, '!==': 6, '==': 6, '!=': 6,
            '<': 7, '>': 7, '<=': 7, '>=': 7,
            '+': 8, '-': 8, '*': 9, '/': 9, '%': 9,
            '!': 10, 'unary-': 10, 'unary+': 10
        },

        OPERATOR_TYPES: {
            '||': 'logical', '&&': 'logical',
            '===': 'comparison', '!==': 'comparison', '==': 'comparison', '!=': 'comparison',
            '>=': 'comparison', '<=': 'comparison', '>': 'comparison', '<': 'comparison',
            '+': 'arithmetic', '-': 'arithmetic', '*': 'arithmetic', '/': 'arithmetic',
            '%': 'arithmetic'
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
                return Object.assign({}, expression, {dependencies});
            }

            // Remove whitespace around expression
            expression = String(expression).trim();

            // Tokenize and parse
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
            return result;
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
                    tokens.push({type: 'OPERATOR', value: op, precedence: this.getOperatorPrecedence(op)});
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
                    tokens.push({type: singleCharTokens[char], value: char});
                    i++;
                    continue;
                }

                // Single character operators
                if ('+-*/<>!?:%'.includes(char)) {
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

                    tokens.push({type, value: char, precedence});
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
                        token: {type: 'STRING', value},
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
                    token: {type: 'NUMBER', value: parseFloat(numberMatch[1])},
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
                    token: {type, value},
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
            let expr = this.parseBinaryWithPrecedence(1);

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
                left = {type, left, operator: op, right};
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

                    pairs.push({key, value});

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
                        path += '[' + JSON.stringify(index.value) + ']';
                    } else {
                        path += '[' + this.reconstructExpression(index) + ']';
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
                    return typeof node.value === 'string' ? '"' + node.value + '"' : String(node.value);

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
            return this.tokens[this.currentToken] || {type: 'EOF', value: null};
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
         * @param scopeResolver
         * @returns {*} Evaluated result
         */
        evaluate(parsedExpr, context, scopeResolver = null) {
            if (!parsedExpr) {
                return undefined;
            }

            switch (parsedExpr.type) {
                case 'literal':
                    return parsedExpr.value;

                case 'property':
                    return this.getProperty(parsedExpr.path, context, scopeResolver);

                case 'parentheses':
                    return this.evaluate(parsedExpr.inner, context, scopeResolver);

                case 'object':
                    return this.evaluateObjectLiteral(parsedExpr, context, scopeResolver);

                case 'ternary': {
                    const condition = this.evaluate(parsedExpr.condition, context, scopeResolver);
                    return condition ?
                        this.evaluate(parsedExpr.trueValue, context, scopeResolver) :
                        this.evaluate(parsedExpr.falseValue, context, scopeResolver);
                }

                case 'logical': {
                    const leftLogical = this.evaluate(parsedExpr.left, context, scopeResolver);
                    if (parsedExpr.operator === '&&') {
                        return leftLogical ? this.evaluate(parsedExpr.right, context, scopeResolver) : false;
                    } else if (parsedExpr.operator === '||') {
                        return leftLogical ? true : this.evaluate(parsedExpr.right, context, scopeResolver);
                    } else {
                        return false;
                    }
                }

                case 'comparison':
                case 'arithmetic': {
                    const leftVal = this.evaluate(parsedExpr.left, context, scopeResolver);
                    const rightVal = this.evaluate(parsedExpr.right, context, scopeResolver);
                    return this.performOperation(leftVal, parsedExpr.operator, rightVal);
                }

                case 'unary': {
                    const operandValue = this.evaluate(parsedExpr.operand, context, scopeResolver);
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
                }

                default:
                    return undefined;
            }
        },

        getProperty(path, obj, scopeResolver  = null) {
            if (!obj || !path) {
                return undefined;
            }

            let resolvedPath = path;

            // Use context to resolve scoped paths if available
            if (scopeResolver  && scopeResolver.resolveScopedPath) {
                resolvedPath = scopeResolver.resolveScopedPath(path);
            }

            if (resolvedPath.indexOf('.') === -1) {
                return (resolvedPath in obj) ? obj[resolvedPath] : undefined;
            }

            const parts = resolvedPath.split('.');
            let current = obj;

            for (let i = 0; i < parts.length; i++) {
                if (current == null) {
                    return undefined;
                }

                current = current[parts[i]];
            }

            return current;
        },

        evaluateObjectLiteral(objectExpr, context, resolverContext = null) {
            const result = {};

            if (objectExpr.pairs) {
                objectExpr.pairs.forEach(({key, value}) => {
                    result[key] = this.evaluate(value, context, resolverContext);
                });
            }

            return result;
        },

        performOperation(left, operator, right) {
            switch (operator) {
                case '+':
                    return left + right;

                case '-':
                    return Number(left) - Number(right);

                case '*':
                    return Number(left) * Number(right);

                case '/':
                    return Number(left) / Number(right);

                case '%':
                    return Number(left) % Number(right);

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
                if (!n) {
                    return;
                }

                switch (n.type) {
                    case 'property': {
                        const rootProp = n.path.split(/[.[]/, 1)[0];

                        if (rootProp && !['true', 'false', 'null', 'undefined'].includes(rootProp)) {
                            dependencies.add(rootProp);
                        }

                        break;
                    }

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
            return pairs;
        },

        /**
         * Adds a binding pair if valid
         * @param {string} pairString - Pair string
         * @param {Array} pairs - Pairs array
         */
        addBindingPairIfValid(pairString, pairs) {
            const trimmed = pairString.trim();

            if (!trimmed) {
                return;
            }

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
            for (const type of KNOWN_BINDING_TYPES) {
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
    // Parser caching
    // ============================================================================

    /**
     * A caching layer for parsed expressions with LRU eviction policy.
     * Improves performance by avoiding redundant parsing of identical expressions.
     * @namespace ExpressionCache
     */
    const ExpressionCache = {
        /** @type {Map<string, *>} Internal cache storage mapping expression strings to parsed results */
        cache: new Map(),

        /** @type {number} Maximum number of cached entries before LRU eviction begins */
        maxSize: 1000, // Prevent unbounded growth

        /**
         * Parses an expression with caching support.
         * Uses string representation of the expression as cache key for consistent lookups.
         * Implements simple LRU eviction when cache exceeds maxSize.
         * @param {*} expression - The expression to parse (will be converted to string for caching)
         * @returns {*} The parsed expression result from ExpressionParser or cache
         */
        parseExpression(expression) {
            // Convert to string and use as cache key
            // Trimming ensures consistent keys regardless of whitespace variations
            const key = String(expression).trim();

            // Check cache first - O(1) lookup
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }

            // Parse using existing parser
            const result = ExpressionParser.parseExpression(expression);

            // Cache management - implement simple LRU eviction
            if (this.cache.size >= this.maxSize) {
                // Simple LRU: delete oldest entry (first inserted)
                // Note: Map maintains insertion order, so first key is oldest
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            // Store result in cache for future lookups
            this.cache.set(key, result);
            return result;
        },

        /**
         * Clears all cached expressions.
         * Useful for memory management or when expression parsing logic changes.
         * @returns {void}
         */
        clear() {
            this.cache.clear();
        }
    };

    // ========================================================================
    // DOM UPDATER - Handles ALL binding applications
    // ========================================================================

    function DomUpdater(context) {
        this.context = context;
    }

    DomUpdater.prototype.updateTextNode = function (element, template) {
        const self = this;

        const newText = template.replace(INTERPOLATION_REGEX, (match, expression) => {
            try {
                const parsed = ExpressionCache.parseExpression(expression);

                const scopeResolver = {
                    resolveScopedPath: (path) => self.context.resolveScopedPath(path, element)
                };

                // Get abstraction from context instead of parameter
                const result = ExpressionParser.evaluate(parsed, self.context.abstraction, scopeResolver);
                return result != null ? String(result) : '';
            } catch (error) {
                return match;
            }
        });

        if (element.textContent !== newText) {
            element.textContent = newText;
        }
    };

    DomUpdater.prototype.updateAttributeBinding = function (element, bindingType, bindingData) {
        try {
            // Parse the expression
            const parsed = ExpressionCache.parseExpression(bindingData.target);

            // Create resolver context for this element
            const scopeResolver = {
                resolveScopedPath: (path) => this.context.resolveScopedPath(path, element)
            };

            // Evaluate the expression
            const value = ExpressionParser.evaluate(parsed, this.context.abstraction, scopeResolver);
            
            // Handle the result
            switch (bindingType) {
                case 'value':
                    this.applyValueBinding(element, value);
                    break;

                case 'checked':
                    this.applyCheckedBinding(element, value);
                    break;

                case 'visible':
                    this.applyVisibleBinding(element, value);
                    break;

                case 'class':
                    this.applyClassBinding(element, value);
                    break;

                case 'style':
                    this.applyStyleBinding(element, value);
                    break;

                default:
                    this.applyAttributeBinding(element, bindingType, value);
                    break;
            }
        } catch (error) {
            console.warn('Error updating binding:', bindingType, bindingData, error);
        }
    };

    // All binding application methods - centralized in DomUpdater
    DomUpdater.prototype.applyValueBinding = function (element, value) {
        // Handle radio buttons specially - they should be checked/unchecked based on value match
        if (element.type === 'radio') {
            element.checked = (element.value === String(value));
            return;
        }

        // Handle all other elements with value property (input, select, textarea, etc.)
        if ('value' in element) {
            const stringValue = String(value || '');

            if (element.value !== stringValue) {
                element.value = stringValue;
            }
        }
    };

    DomUpdater.prototype.applyCheckedBinding = function (element, value) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            const newChecked = Boolean(value);

            // Only update if the value is actually different
            if (element.checked !== newChecked) {
                element.checked = newChecked;
            }
        }
    };

    DomUpdater.prototype.applyVisibleBinding = function (element, value) {
        const shouldShow = !!value;

        if (shouldShow) {
            if (element.hasAttribute('data-pac-hidden')) {
                element.style.display = element.getAttribute('data-pac-orig-display') || '';
                element.removeAttribute('data-pac-hidden');
                element.removeAttribute('data-pac-orig-display');
            }
        } else {
            if (!element.hasAttribute('data-pac-hidden')) {
                const currentDisplay = getComputedStyle(element).display;

                if (currentDisplay !== 'none') {
                    element.setAttribute('data-pac-orig-display', currentDisplay);
                }

                element.style.display = 'none';
                element.setAttribute('data-pac-hidden', 'true');
            }
        }
    };

    DomUpdater.prototype.applyClassBinding = function (element, value) {
        if (typeof value === 'string') {
            element.className = value;
        } else if (typeof value === 'object' && value !== null) {
            Object.keys(value).forEach(className => {
                if (value[className]) {
                    element.classList.add(className);
                } else {
                    element.classList.remove(className);
                }
            });
        }
    };

    DomUpdater.prototype.applyStyleBinding = function (element, value) {
        // Object syntax: { color: 'red', fontSize: '16px' }
        // Check if value is an object (preferred object syntax)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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

            return;
        }

        // String syntax: "color: red; font-size: 16px;"
        // Set the entire CSS text at once (less efficient but backwards compatible)
        if (typeof value === 'string') {
            element.style.cssText = value;
        }
    };

    DomUpdater.prototype.applyAttributeBinding = function (element, attribute, value) {
        const BOOLEAN_ATTRIBUTES = [
            'readonly', 'required', 'selected', 'checked',
            'hidden', 'multiple', 'autofocus'
        ];

        if (attribute === 'enable') {
            // Handle 'enable' as reverse of 'disabled'
            element.toggleAttribute('disabled', !value);
        } else if (BOOLEAN_ATTRIBUTES.includes(attribute)) {
            element.toggleAttribute(attribute, !!value);
        } else if (value != null) {
            element.setAttribute(attribute, value);
        } else {
            element.removeAttribute(attribute);
        }
    };

    // ========================================================================
    // CONTEXT
    // ========================================================================

    function Context(container, abstraction, parent = null) {
        const self = this;

        // Ensure container has the required attribute
        if (!container.hasAttribute('data-pac-container')) {
            container.setAttribute('data-pac-container', this.uniqid());
        }

        this.originalAbstraction = abstraction;
        this.parent = parent;
        this.container = container;
        this.abstraction = this.createReactiveAbstraction();
        this.domUpdater = new DomUpdater(this);
        this.dependencies = this.getDependencies();
        this.interpolationMap = new Map();
        this.textInterpolationMap = new Map();

        // Scan the container for items and store them in interpolationMap and textInterpolationMap
        this.scanAndRegisterNewElements(this.container);

        // Handle click events
        this.boundHandleDomClicks = function(event) { self.handleDomClicks(event); };
        this.boundHandleDomChange = function(event) { self.handleDomChange(event); };
        this.boundHandleReactiveChange = function(event) { self.handleReactiveChange(event); };

        // Add listeners using the stored references
        this.container.addEventListener('pac:dom:click', this.boundHandleDomClicks);
        this.container.addEventListener('pac:dom:change', this.boundHandleDomChange);
        this.container.addEventListener('pac:change', this.boundHandleReactiveChange);
    }

    Context.prototype.destroy = function() {
        // Now you can remove them
        this.container.removeEventListener('pac:dom:click', this.boundHandleDomClicks);
        this.container.removeEventListener('pac:dom:change', this.boundHandleDomChange);
        this.container.removeEventListener('pac:change', this.boundHandleReactiveChange);

        // Clear references
        this.boundHandleDomClicks = null;
        this.boundHandleDomChange = null;
        this.boundHandleReactiveChange = null;
    }

    Context.prototype.uniqid = function(prefix = "", random = false) {
        const sec = Date.now() * 1000 + Math.random() * 1000;
        const id = sec.toString(16).replace(/\./g, "").padEnd(14, "0");
        return `${prefix}${id}${random ? `.${Math.trunc(Math.random() * 100000000)}`:""}`;
    }

    /**
     * Scans and registers newly created content within a foreach container
     * @param {Element} parentElement - The foreach container element
     */
    Context.prototype.scanAndRegisterNewElements = function(parentElement) {
        const self = this;

        // Scan for new bound elements within this container
        const newBindings = this.scanBindings(parentElement);
        const newTextBindings = this.scanTextBindings(parentElement);

        // Add new bindings to main maps
        newBindings.forEach((mappingData, element) => {
            if (element !== parentElement) { // Don't re-add the foreach element itself
                this.interpolationMap.set(element, mappingData);
            }
        });

        newTextBindings.forEach((mappingData, textNode) => {
            this.textInterpolationMap.set(textNode, mappingData);
        });

        // Process nested foreach elements
        newBindings.forEach((mappingData, element) => {
            const { bindings } = mappingData;

            if (bindings.foreach && element !== parentElement) {
                // Set the ID as an attribute for debugging/identification
                const foreachId = self.uniqid('foreach');
                element.setAttribute('data-pac-foreach-id', foreachId);

                // Extend the existing mappingData with foreach-specific information
                Object.assign(mappingData, {
                    foreachExpr: bindings.foreach.target,
                    foreachId: foreachId,
                    depth: self.calculateForEachDepth(element),
                    parentElement: self.findParentForeachElement(element),
                    template: element.innerHTML,
                    itemVar: element.getAttribute('data-pac-item') || 'item',
                    indexVar: element.getAttribute('data-pac-index') || 'index'
                });
            }
        });

        // Apply initial bindings to new elements
        newBindings.forEach((mappingData, element) => {
            Object.keys(mappingData.bindings).forEach(bindingType => {
                const bindingData = mappingData.bindings[bindingType];
                self.domUpdater.updateAttributeBinding(element, bindingType, bindingData);
            });
        });

        // Apply text interpolations
        newTextBindings.forEach((mappingData, textNode) => {
            self.domUpdater.updateTextNode(textNode, mappingData.template);
        });

        // Handle nested foreach rendering (sort by depth, deepest first)
        Array.from(newBindings.entries())
            .filter(([element, mappingData]) =>
                mappingData.bindings.foreach && element !== parentElement
            )
            .sort(([, mappingDataA], [, mappingDataB]) => {
                const depthA = mappingDataA.depth;
                const depthB = mappingDataB.depth;
                return depthB - depthA; // deepest first
            })
            .forEach(([element]) => {
                this.renderForeach(element);
            });
    };

    Context.prototype.getDependencies = function() {
        const dependencies = new Map();
        const computed = this.originalAbstraction.computed || {};
        const accessed = new Set();

        const proxy = new Proxy(this.originalAbstraction, {
            get(target, prop) {
                if (typeof prop === 'string') {
                    accessed.add(prop);
                }
                return target[prop];
            }
        });

        Object.keys(computed).forEach(name => {
            accessed.clear();
            computed[name].call(proxy);

            // For each accessed property, add this computed property as a dependent
            accessed.forEach(prop => {
                if (!dependencies.has(prop)) {
                    dependencies.set(prop, []);
                }

                dependencies.get(prop).push(name);
            });
        });

        return dependencies;
    };

    Context.prototype.handleAttributeChanges = function(event, pathsToCheck) {
        const self = this;

        this.interpolationMap.forEach((mappingData, element) => {
            const { bindings } = mappingData;

            // Check each binding type individually
            Object.keys(bindings).forEach(bindingType => {
                // Skip foreach and click bindings (handled separately)
                if (['foreach', 'click'].includes(bindingType)) {
                    return;
                }

                const bindingData = bindings[bindingType];

                // Check if any of the paths that changed affect this binding
                // Need to check both exact matches and root property matches
                const shouldUpdate = bindingData.dependencies.some(dependency => {
                    // Exact match
                    if (pathsToCheck.includes(dependency)) {
                        return true;
                    }

                    // Check if the dependency is a root of the changed path
                    // e.g., "todos" dependency should match "todos.0.completed" change
                    const pathString = event.detail.path.join('.');
                    return pathString.startsWith(dependency + '.') || pathString.startsWith(dependency + '[');
                });

                if (shouldUpdate) {
                    self.domUpdater.updateAttributeBinding(element, bindingType, bindingData);
                }
            });
        });
    };

    Context.prototype.handleTextInterpolation = function(event, pathsToCheck) {
        const self = this;

        self.textInterpolationMap.forEach((mappingData, textNode) => {
            // Check if any of the paths that changed affect this node
            // Need to check both exact matches and root property matches
            const shouldUpdate = mappingData.dependencies.some(dep => {
                // Exact match
                if (pathsToCheck.includes(dep)) {
                    return true;
                }

                // Check if the dependency is a root of the changed path
                // e.g., "todos" dependency should match "todos.0.completed" change
                const pathString = event.detail.path.join('.');
                return pathString.startsWith(dep + '.') || pathString.startsWith(dep + '[');
            });

            if (shouldUpdate) {
                self.domUpdater.updateTextNode(textNode, mappingData.template);
            }
        });
    };

    Context.prototype.handleDomClicks = function(event) {
        const self = this;
        const targetElement = event.detail.target;

        // Get the mapping data for this specific element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found or no click binding, return early
        if (!mappingData || !mappingData.bindings.click) {
            return;
        }

        // Get the click binding data
        const clickBinding = mappingData.bindings.click;

        // Fetch target function from abstraction
        const method = self.abstraction[clickBinding.target];

        // Check if the function is inside the abstraction. If so, call it
        if (typeof method === 'function') {
            try {
                method.call(self.abstraction, event);
            } catch (error) {
                console.error(`Error executing click binding '${clickBinding.target}':`, error);
            }
        }
    };

    Context.prototype.handleDomChange = function(event) {
        const self = this;
        const targetElement = event.detail.target;

        // Get the mapping data for this specific element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found, return early
        if (!mappingData) {
            return;
        }

        // Handle value binding (for inputs, selects, textareas)
        if (mappingData.bindings.value) {
            const valueBinding = mappingData.bindings.value;
            const resolvedPath = self.resolveScopedPath(valueBinding.target, targetElement);

            // Use the nested property setter to handle complex paths
            self.setNestedProperty(resolvedPath, event.detail.value);
        }

        // Handle checked binding (for checkboxes and radio buttons)
        if (mappingData.bindings.checked) {
            const checkedBinding = mappingData.bindings.checked;
            const resolvedPath = self.resolveScopedPath(checkedBinding.target, targetElement);

            if (targetElement.type === 'checkbox') {
                self.setNestedProperty(resolvedPath, event.detail.target.checked)
            } else if (targetElement.type === 'radio' && event.detail.target.checked) {
                self.setNestedProperty(resolvedPath, event.detail.value)
            }
        }
    };

    /**
     * Handles reactive data changes by determining which DOM elements need updates.
     * This is the central event handler that responds to property changes in the reactive
     * abstraction and coordinates DOM updates for both text interpolations and attribute bindings.
     * @param {CustomEvent} event - The pac:change event containing change details
     * @param {Object} event.detail - Event payload
     * @param {string[]} event.detail.path - Array representing the property path that changed (e.g., ['todos', '0', 'completed'])
     * @param {*} event.detail.oldValue - The previous value before the change
     * @param {*} event.detail.newValue - The new value after the change
     */
    Context.prototype.handleReactiveChange = function(event) {
        // Convert the property path array to a dot-notation string for dependency lookup
        // Example: ['todos', '0', 'completed'] becomes 'todos.0.completed'
        const pathString = event.detail.path.join('.');

        // Initialize the list of dependency paths that need DOM updates
        // Always include the exact path that changed
        const pathsToCheck = [pathString];

        // Check for computed properties that depend on this exact property path
        // Example: If "todos.0.completed" has registered dependencies, include them
        if (this.dependencies.has(pathString)) {
            pathsToCheck.push(...this.dependencies.get(pathString));
        }

        // CRITICAL FIX: Also check root-level dependencies
        // Many computed properties depend on the root collection rather than individual items.
        // When todos[0].completed changes, computed properties like "completedCount" that
        // depend on the entire "todos" array also need to be recalculated and updated.
        // This ensures collection-level computed properties stay synchronized with item changes.
        const rootProperty = event.detail.path[0]; // Extract first segment
        if (this.dependencies.has(rootProperty)) {
            pathsToCheck.push(...this.dependencies.get(rootProperty));
        }

        // Trigger DOM updates for all affected text interpolations
        // This handles {{expression}} patterns in text content
        this.handleTextInterpolation(event, pathsToCheck);

        // Trigger DOM updates for all affected attribute bindings
        // This handles data-pac-bind attribute expressions
        this.handleAttributeChanges(event, pathsToCheck);
    }

    /**
     * Scans the container for elements with data-pac-bind attributes and extracts
     * their binding information along with expression dependencies.
     * @returns {Map<WeakKey, any>}
     */
    Context.prototype.scanBindings = function(parentElement) {
        const self = this;
        const interpolationMap = new Map();
        const elements = parentElement.querySelectorAll('[data-pac-bind]');

        elements.forEach(element => {
            // Skip elements that are already in the map
            if (interpolationMap.has(element)) {
                return;
            }

            // Skip elements that don't belong to this container
            if (!Utils.belongsToThisContainer(self.container, element)) {
                return;
            }

            const bindingString = element.getAttribute('data-pac-bind');
            const parsedBindings = ExpressionParser.parseBindingString(bindingString);

            // Transform bindings array into object keyed by binding type
            const bindingsObject = {};

            parsedBindings.forEach(binding => {
                bindingsObject[binding.type] = {
                    target: binding.target,
                    dependencies: this.extractDependencies(binding.target)
                };
            });

            interpolationMap.set(element, {
                bindingString: bindingString,
                bindings: bindingsObject
            });
        });

        return interpolationMap;
    };

    /**
     * Scans the container for text nodes containing interpolation expressions and builds
     * a mapping of nodes to their templates and dependencies.
     * @returns {Map<WeakKey, any>}
     */
    Context.prototype.scanTextBindings = function(parentElement) {
        const interpolationMap = new Map();

        // Create tree walker to find text nodes with interpolation expressions
        const walker = document.createTreeWalker(
            parentElement,
            NodeFilter.SHOW_TEXT,
            { acceptNode: node => INTERPOLATION_TEST_REGEX.test(node.textContent) ?
                    NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
        );

        // Walk through matching text nodes that belong to this container
        let element;

        while ((element = walker.nextNode())) {
            // Skip elements that are already in the map
            if (interpolationMap.has(element)) {
                continue;
            }

            // Skip elements that don't belong to this container
            if (!Utils.belongsToThisContainer(this.container, element)) {
                continue;
            }

            interpolationMap.set(element, {
                template: element.textContent,
                dependencies: this.extractInterpolationDependencies(element.textContent)
            });
        }

        return interpolationMap;
    };

    /**
     * Extracts all unique dependencies from interpolation expressions in a text template.
     * @param {string} template - The text template containing interpolation expressions
     * @returns {Array<string>} Array of unique dependency identifiers
     * @private
     */
    Context.prototype.extractInterpolationDependencies = function(template) {
        const dependencies = new Set();

        template.replace(INTERPOLATION_REGEX, (match, expression) => {
            const expressionDependencies = this.extractDependencies(expression.trim());
            expressionDependencies.forEach(dep => dependencies.add(dep));
            return match; // Return match to satisfy replace callback
        });

        return Array.from(dependencies);
    };

    /**
     * Extracts dependencies from a binding expression, with error handling.
     * @param {string} expression - The binding expression to parse
     * @returns {Array<string>} Array of dependency identifiers
     * @private
     */
    Context.prototype.extractDependencies = function(expression) {
        try {
            const parsed = ExpressionParser.parseExpression(expression);
            return parsed?.dependencies || [];
        } catch (error) {
            console.warn('Failed to parse binding dependencies:', expression, error);
            return [];
        }
    };

    /**
     * Setup reactive properties for this container
     * @returns {*|object}
     */
    Context.prototype.createReactiveAbstraction = function() {
        const self = this;

        // Create reactive proxy directly from original abstraction
        const proxiedReactive = makeDeepReactiveProxy(this.originalAbstraction, this.container);

        // Copy all methods from the original abstraction to the reactive proxy (except the special
        // 'computed' property which gets handled separately), but critically: rebind their 'this'
        // context to point to the reactive proxy instead of the original object.
        // This ensures that when methods access properties via 'this.propertyName', they interact
        // with the reactive proxy (triggering DOM updates) rather than the non-reactive original.
        Object.keys(this.originalAbstraction).forEach(function (key) {
            if (typeof self.originalAbstraction[key] === 'function' && key !== 'computed') {
                proxiedReactive[key] = self.originalAbstraction[key].bind(proxiedReactive);
            }
        });

        // Add computed properties as getters
        const computed = this.originalAbstraction.computed || {};
        Object.keys(computed).forEach(function (computedName) {
            Object.defineProperty(proxiedReactive, computedName, {
                get: function () {
                    return computed[computedName].call(proxiedReactive);
                },
                enumerable: true,
                configurable: true
            });
        });

        return proxiedReactive;
    };

    Context.prototype.calculateForEachDepth = function(element) {
        let depth = 0;
        let current = element.parentElement;

        while (current && current !== this.container) {
            // Check if this ancestor has a foreach binding
            if (current.hasAttribute('data-pac-bind') &&
                current.getAttribute('data-pac-bind').includes('foreach:')) {
                depth++;
            }

            current = current.parentElement;
        }

        return depth;
    }

    Context.prototype.findParentForeachElement = function(element) {
        let current = element.parentElement;

        while (current && current !== this.container) {
            // Check if this ancestor has a foreach binding
            if (current.hasAttribute('data-pac-bind') &&
                current.getAttribute('data-pac-bind').includes('foreach:')) {
                return current;
            }

            current = current.parentElement;
        }

        return null;
    }

    Context.prototype.renderForeach = function(foreachElement) {
        const mappingData = this.interpolationMap.get(foreachElement);

        if (!mappingData || !mappingData.foreachId) {
            console.warn('No foreach binding found for element');
            return;
        }

        // Clean up old elements from maps before clearing innerHTML
        this.cleanupForeachMaps(foreachElement);

        // Create scope resolver for this foreach element
        const scopeResolver = {
            resolveScopedPath: (path) => this.resolveScopedPath(path, foreachElement)
        };

        const array = ExpressionParser.evaluate(
            ExpressionCache.parseExpression(mappingData.foreachExpr),
            this.abstraction,
            scopeResolver
        );

        foreachElement.innerHTML = '';

        array.forEach((item, index) => {
            // Get parent scope if this is nested
            let parentScope = this.abstraction;

            if (mappingData.parentElement) {
                const parentMappingData = this.interpolationMap.get(mappingData.parentElement);
                if (parentMappingData && parentMappingData.currentScope) {
                    parentScope = parentMappingData.currentScope;
                }
            }

            // Create scope with item and index variables
            const scope = Object.create(parentScope);
            scope[mappingData.itemVar] = item;
            scope[mappingData.indexVar] = index;

            // Clone template and process interpolations
            const itemHTML = mappingData.template.replace(INTERPOLATION_REGEX, (match, expr) => {
                const result = ExpressionParser.evaluate(
                    ExpressionParser.parseExpression(expr),
                    scope
                );

                return result != null ? String(result) : '';
            });

            // Add with comment markers
            foreachElement.innerHTML +=
                `<!-- pac-foreach-item: ${mappingData.foreachId}, index=${index} -->` +
                itemHTML +
                `<!-- /pac-foreach-item -->`;
        });

        // Scan and register new elements
        this.scanAndRegisterNewElements(foreachElement);
    }

    /**
     * Resolves a scoped path by automatically finding context from the DOM element
     * @param {string} scopedPath - The scoped path to resolve (e.g., "sub_item.text")
     * @param {Element} element - The DOM element containing the expression (text node or bound element)
     * @returns {string} The resolved actual data path or original path if no foreach context found
     */
    Context.prototype.resolveScopedPath = function(scopedPath, element) {
        // If no dot in path, it's just a variable name - no resolution needed
        if (!scopedPath.includes('.')) {
            return scopedPath;
        }

        // Find the foreach element that defines this scoped variable
        const foreachElement = this.findForeachElementForScopedPath(scopedPath, element);

        if (!foreachElement) {
            return scopedPath; // Return original path if no foreach context found
        }

        const mappingData = this.interpolationMap.get(foreachElement);
        if (!mappingData || !mappingData.bindings.foreach) {
            return scopedPath; // Return original path if mapping data invalid
        }

        // Extract current index from HTML comments for this foreach
        const currentIndex = this.extractCurrentIndexFromComments(element, mappingData.foreachId);

        if (currentIndex === null) {
            return scopedPath; // Return original path if index not found
        }

        // Extract the property path after the item variable
        const propertyPath = scopedPath.substring(mappingData.itemVar.length + 1);

        // Resolve the array expression using parent relationships and HTML comments
        const resolvedExpr = this.resolveArrayExpression(mappingData.foreachExpr, foreachElement, element);

        // Build the final resolved path
        return resolvedExpr + '[' + currentIndex + ']' + (propertyPath ? '.' + propertyPath : '');
    };

    /**
     * Finds the foreach element that defines the given scoped variable
     * @param {string} scopedPath - The scoped path (e.g., "sub_item.text")
     * @param {Element} startElement - The DOM element to search from
     * @returns {Element|null} The foreach element or null if not found
     */
    Context.prototype.findForeachElementForScopedPath = function(scopedPath, startElement) {
        const rootVariable = scopedPath.split('.')[0];

        // Start from text node's parent if needed
        let current = startElement.nodeType === Node.TEXT_NODE ? startElement.parentElement : startElement;

        // Walk up from current element to find foreach that defines this variable
        while (current && current !== this.container) {
            const mappingData = this.interpolationMap.get(current);

            if (mappingData && mappingData.bindings && mappingData.bindings.foreach) {
                if (mappingData.itemVar === rootVariable) {
                    return current;
                }
            }

            current = current.parentElement;
        }

        return null;
    };

    /**
     * Extracts the current item index from HTML comments by walking up from element
     * @param {Element} startElement - Element to start searching from
     * @param {string} foreachId - The foreach ID to look for in comments
     * @returns {number|null} The current index or null if not found
     */
    Context.prototype.extractCurrentIndexFromComments = function(startElement, foreachId) {
        // Start from text node's parent if needed
        let current = startElement.nodeType === Node.TEXT_NODE ? startElement.parentElement : startElement;

        // Walk up the DOM to find this foreach's comment marker
        while (current && current !== this.container) {
            // Check previous siblings for comment markers
            let sibling = current.previousSibling;

            while (sibling) {
                if (sibling.nodeType === Node.COMMENT_NODE) {
                    const commentText = sibling.textContent.trim();

                    // Look for comment pattern: "pac-foreach-item: foreachId, index=X"
                    const match = commentText.match(/pac-foreach-item:\s*([^,]+),\s*index=(\d+)/);

                    if (match && match[1].trim() === foreachId) {
                        return parseInt(match[2], 10);
                    }
                }
                sibling = sibling.previousSibling;
            }

            current = current.parentElement;
        }

        return null;
    };

    /**
     * Resolves an array expression by substituting parent item variables with their actual paths
     * @param {string} arrayExpr - The array expression to resolve (e.g., "item.subitems")
     * @param {Element} foreachElement - The foreach element context
     * @param {Element} contextElement - The DOM element for context (to find parent indices)
     * @returns {string} The resolved array expression
     */
    Context.prototype.resolveArrayExpression = function(arrayExpr, foreachElement, contextElement) {
        // If the array expression doesn't contain any variables to substitute, return as-is
        if (!arrayExpr.includes('.')) {
            return arrayExpr;
        }

        const mappingData = this.interpolationMap.get(foreachElement);
        if (!mappingData || !mappingData.parentElement) {
            return arrayExpr;
        }

        const parentElement = mappingData.parentElement;
        const parentMapping = this.interpolationMap.get(parentElement);

        if (!parentMapping || !parentMapping.bindings.foreach) {
            return arrayExpr;
        }

        // Check if the array expression starts with the parent's item variable
        if (arrayExpr.startsWith(parentMapping.itemVar + '.')) {
            // Extract parent index from HTML comments
            const parentIndex = this.extractParentIndexFromComments(contextElement, parentMapping.foreachId);

            if (parentIndex !== null) {
                // Recursively resolve the parent expression first
                const parentResolvedExpr = this.resolveArrayExpression(
                    parentMapping.foreachExpr,
                    parentElement,
                    contextElement
                );

                // Replace the item variable with the resolved path + index
                return arrayExpr.replace(
                    parentMapping.itemVar + '.',
                    parentResolvedExpr + '[' + parentIndex + '].'
                );
            }
        }

        return arrayExpr;
    };

    /**
     * Extracts parent index from HTML comments by walking up the DOM
     * @param {Element} startElement - Element to start searching from
     * @param {string} foreachId - The foreach ID to look for in comments
     * @returns {number|null} The parent index or null if not found
     */
    Context.prototype.extractParentIndexFromComments = function(startElement, foreachId) {
        // Start from text node's parent if needed
        let current = startElement.nodeType === Node.TEXT_NODE ? startElement.parentElement : startElement;

        // Walk up the DOM to find the parent foreach item
        while (current && current !== this.container) {
            // Check previous siblings for comment markers
            let sibling = current.previousSibling;

            while (sibling) {
                if (sibling.nodeType === Node.COMMENT_NODE) {
                    const commentText = sibling.textContent.trim();

                    // Look for comment pattern: "pac-foreach-item: foreachId, index=X"
                    const match = commentText.match(/pac-foreach-item:\s*([^,]+),\s*index=(\d+)/);

                    if (match && match[1].trim() === foreachId) {
                        return parseInt(match[2], 10);
                    }
                }

                sibling = sibling.previousSibling;
            }

            current = current.parentElement;
        }

        return null;
    };

    /**
     * Removes all child elements of a foreach container from interpolation maps
     * @param {Element} foreachElement - The foreach container element
     */
    Context.prototype.cleanupForeachMaps = function(foreachElement) {
        const elementsToRemove = [];
        const textNodesToRemove = [];

        // Find all elements that belong to this foreach container
        this.interpolationMap.forEach((mappingData, element) => {
            if (foreachElement.contains(element) && element !== foreachElement) {
                elementsToRemove.push(element);
            }
        });

        this.textInterpolationMap.forEach((mappingData, textNode) => {
            if (foreachElement.contains(textNode)) {
                textNodesToRemove.push(textNode);
            }
        });

        // Remove them from the maps
        elementsToRemove.forEach(element => {
            this.interpolationMap.delete(element);
        });

        textNodesToRemove.forEach(textNode => {
            this.textInterpolationMap.delete(textNode);
        });
    };

    /**
     * Sets a nested property value on the reactive abstraction
     * @param {string} path - The property path (e.g., "todos[0].completed")
     * @param {*} value - The value to set
     */
    Context.prototype.setNestedProperty = function (path, value) {
        const parts = path.split(/[.\[\]]+/).filter(Boolean);
        let current = this.abstraction;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];

            // If current part doesn't exist, create it
            if (!(part in current)) {
                // Create array if next part is numeric, object otherwise
                current[part] = /^\d+$/.test(nextPart) ? [] : {};
            }

            current = current[part];
        }

        // Set the final property
        const finalPart = parts[parts.length - 1];
        current[finalPart] = value;
    };

    // ========================================================================
    // MAIN FRAMEWORK
    // ========================================================================

    function wakaPAC(selector, abstraction, options) {
        // Initialize global event tracking first
        DomUpdateTracker.initialize();

        // Fetch selector
        const container = document.querySelector(selector);

        if (!container) {
            throw new Error(`Container not found: ${selector}`);
        }

        // Merge configuration
        const config = Object.assign({
            updateMode: 'immediate',
            delay: 300
        }, options);

        const control = {
            selector: selector,
            container: container,
            config: config,
            context: new Context(container, abstraction),

            /**
             * Constructor
             * @returns {control}
             */
            initialize: function () {
                return this;
            }
        };

        // Initialize control
        const controlUnit = control.initialize();

        // Return the reactive abstraction directly, not a copy
        window.PACRegistry.register(selector, control);
        return controlUnit.abstraction;
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    function SimplePACRegistry() {
        this.components = new Map();

        this.register = function (selector, component) {
            this.components.set(selector, component);
        };

        this.unregister = function (selector) {
            this.components.delete(selector);
        };
    }

    window.PACRegistry = window.PACRegistry || new SimplePACRegistry();
    window.wakaPAC = wakaPAC;
})();