/**
 * wakaPAC Framework - Fixed Version
 * Clear separation of concerns with properly working computed properties
 */
(function() {
    "use strict";

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPRESSION PARSER (KEPT INTACT)
    // ═══════════════════════════════════════════════════════════════════════════════

    const ExpressionParser = {
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

        parseExpression(expression) {
            if (typeof expression === 'object' && expression !== null) {
                if (expression.dependencies) {
                    return expression;
                }
                const dependencies = this.extractDependencies(expression);
                return Object.assign({}, expression, {dependencies});
            }

            expression = String(expression).trim();

            try {
                this.tokens = this.tokenize(expression);
                this.currentToken = 0;

                if (this.tokens.length === 0) {
                    return null;
                }

                const result = this.parseTernary();
                if (result) {
                    result.dependencies = this.extractDependencies(result);
                }
                return result;
            } catch (error) {
                throw new Error(`Expression parsing failed: "${expression}"\nOriginal error: ${error.message}`);
            }
        },

        tokenize(expression) {
            const tokens = [];
            let i = 0;

            while (i < expression.length) {
                const char = expression[i];

                if (/\s/.test(char)) {
                    i++;
                    continue;
                }

                if (char === '"' || char === "'") {
                    const result = this.tokenizeString(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                if (/\d/.test(char) || (char === '.' && /\d/.test(expression[i + 1]))) {
                    const result = this.tokenizeNumber(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                const multiChar = /^(===|!==|==|!=|>=|<=|&&|\|\|)/.exec(expression.slice(i));
                if (multiChar) {
                    const op = multiChar[1];
                    tokens.push({type: 'OPERATOR', value: op, precedence: this.getOperatorPrecedence(op)});
                    i += op.length;
                    continue;
                }

                const singleCharTokens = {
                    '(': 'LPAREN', ')': 'RPAREN', '{': 'LBRACE', '}': 'RBRACE',
                    '[': 'LBRACKET', ']': 'RBRACKET', ',': 'COMMA', '.': 'DOT'
                };

                if (singleCharTokens[char]) {
                    tokens.push({type: singleCharTokens[char], value: char});
                    i++;
                    continue;
                }

                if ('+-*/<>!?:%'.includes(char)) {
                    const precedence = this.getOperatorPrecedence(char);
                    let type = char === '?' ? 'QUESTION' : char === ':' ? 'COLON' : 'OPERATOR';
                    tokens.push({type, value: char, precedence});
                    i++;
                    continue;
                }

                if (/[a-zA-Z_$]/.test(char)) {
                    const result = this.tokenizeIdentifier(expression, i);
                    tokens.push(result.token);
                    i = result.nextIndex;
                    continue;
                }

                i++;
            }

            return tokens;
        },

        tokenizeString(expression, start) {
            const quote = expression[start];
            let i = start + 1;
            let value = '';

            while (i < expression.length) {
                const char = expression[i];
                if (char === '\\' && i + 1 < expression.length) {
                    const nextChar = expression[i + 1];
                    if (nextChar === quote || nextChar === '\\') {
                        value += nextChar;
                        i += 2;
                    } else {
                        value += char;
                        i++;
                    }
                } else if (char === quote) {
                    return {
                        token: {type: 'STRING', value},
                        nextIndex: i + 1
                    };
                } else {
                    value += char;
                    i++;
                }
            }

            throw new Error(`Unterminated string literal starting at position ${start}`);
        },

        tokenizeNumber(expression, start) {
            const numberMatch = /^(\d*\.?\d+(?:[eE][+-]?\d+)?)/.exec(expression.slice(start));
            if (numberMatch) {
                return {
                    token: {type: 'NUMBER', value: parseFloat(numberMatch[1])},
                    nextIndex: start + numberMatch[1].length
                };
            }
        },

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

        getOperatorPrecedence(operator) {
            return this.OPERATOR_PRECEDENCE[operator] || 0;
        },

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

        parseBinaryWithPrecedence(minPrec) {
            let left = this.parseUnary();

            while (this.peek().type === 'OPERATOR') {
                const opPrec = this.getOperatorPrecedence(this.peek().value);
                if (opPrec < minPrec) break;

                const op = this.advance().value;
                const right = this.parseBinaryWithPrecedence(opPrec + 1);
                const type = this.OPERATOR_TYPES[op] || 'arithmetic';

                left = {type, left, operator: op, right};
            }

            return left;
        },

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

        parsePrimary() {
            if (this.match('LPAREN')) {
                const expr = this.parseTernary();
                this.consume('RPAREN', 'Expected closing parenthesis');
                return {type: 'parentheses', inner: expr};
            }

            if (this.match('LBRACE')) {
                return this.parseObjectLiteral();
            }

            if (this.check('STRING')) {
                return {type: 'literal', value: this.advance().value};
            }

            if (this.check('NUMBER')) {
                return {type: 'literal', value: this.advance().value};
            }

            if (this.check('KEYWORD')) {
                const token = this.advance();
                const keywordValues = {
                    'true': true, 'false': false, 'null': null, 'undefined': undefined
                };
                return {type: 'literal', value: keywordValues[token.value]};
            }

            if (this.check('IDENTIFIER')) {
                return this.parsePropertyAccess();
            }

            return null;
        },

        parseObjectLiteral() {
            const pairs = [];

            if (!this.check('RBRACE')) {
                do {
                    let key;
                    if (this.check('STRING')) {
                        key = this.advance().value;
                    } else if (this.check('IDENTIFIER')) {
                        key = this.advance().value;
                    } else {
                        throw new Error('Expected property name');
                    }

                    this.consume('COLON', 'Expected ":" after object key');
                    const value = this.parseTernary();
                    pairs.push({key, value});

                } while (this.match('COMMA') && !this.check('RBRACE'));
            }

            this.consume('RBRACE', 'Expected closing brace');
            return {type: 'object', pairs};
        },

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

                    if (index.type === 'literal') {
                        path += '[' + JSON.stringify(index.value) + ']';
                    } else {
                        path += '[' + this.reconstructExpression(index) + ']';
                    }
                } else {
                    break;
                }
            }

            return {type: 'property', path};
        },

        reconstructExpression(node) {
            if (!node) return '';

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

        // Parser state management
        match(...types) {
            for (const type of types) {
                if (this.check(type)) {
                    this.advance();
                    return true;
                }
            }
            return false;
        },

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

        check(type) {
            if (this.isAtEnd()) return false;
            return this.peek().type === type;
        },

        advance() {
            if (!this.isAtEnd()) this.currentToken++;
            return this.previous();
        },

        isAtEnd() {
            return this.currentToken >= this.tokens.length;
        },

        peek() {
            return this.tokens[this.currentToken] || {type: 'EOF', value: null};
        },

        previous() {
            return this.tokens[this.currentToken - 1];
        },

        consume(type, message) {
            if (this.check(type)) return this.advance();
            throw new Error(message + ` at token: ${JSON.stringify(this.peek())}`);
        },

        evaluate(parsedExpr, context) {
            if (!parsedExpr) return undefined;

            switch (parsedExpr.type) {
                case 'literal':
                    return parsedExpr.value;

                case 'property':
                    return this.getProperty(context, parsedExpr.path);

                case 'parentheses':
                    return this.evaluate(parsedExpr.inner, context);

                case 'object':
                    return this.evaluateObjectLiteral(parsedExpr, context);

                case 'ternary': {
                    const condition = this.evaluate(parsedExpr.condition, context);
                    return condition ?
                        this.evaluate(parsedExpr.trueValue, context) :
                        this.evaluate(parsedExpr.falseValue, context);
                }

                case 'logical': {
                    const leftLogical = this.evaluate(parsedExpr.left, context);
                    if (parsedExpr.operator === '&&') {
                        return leftLogical ? this.evaluate(parsedExpr.right, context) : false;
                    } else if (parsedExpr.operator === '||') {
                        return leftLogical ? true : this.evaluate(parsedExpr.right, context);
                    }
                    return false;
                }

                case 'comparison':
                case 'arithmetic': {
                    const leftVal = this.evaluate(parsedExpr.left, context);
                    const rightVal = this.evaluate(parsedExpr.right, context);
                    return this.performOperation(leftVal, parsedExpr.operator, rightVal);
                }

                case 'unary': {
                    const operandValue = this.evaluate(parsedExpr.operand, context);
                    switch (parsedExpr.operator) {
                        case '!': return !operandValue;
                        case '-': return -operandValue;
                        case '+': return +operandValue;
                        default: return operandValue;
                    }
                }

                default:
                    return undefined;
            }
        },

        getProperty(obj, path) {
            if (!obj || !path) return undefined;

            if (path.indexOf('.') === -1) {
                return obj[path];
            }

            const parts = path.split('.');
            let current = obj;

            for (let i = 0; i < parts.length; i++) {
                if (current == null) return undefined;
                current = current[parts[i]];
            }

            return current;
        },

        evaluateObjectLiteral(objectExpr, context) {
            const result = {};
            if (objectExpr.pairs) {
                objectExpr.pairs.forEach(({key, value}) => {
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
                case '%': return Number(left) % Number(right);
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

        extractDependencies(node) {
            if (!node) return [];

            const dependencies = new Set();

            const traverse = (n) => {
                if (!n) return;

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
        }
    };

    // Expression cache
    const ExpressionCache = {
        cache: new Map(),
        maxSize: 500,

        parseExpression(expression) {
            const key = String(expression).trim();

            if (this.cache.has(key)) {
                const value = this.cache.get(key);
                this.cache.delete(key);
                this.cache.set(key, value);
                return value;
            }

            const result = ExpressionParser.parseExpression(expression);

            if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(key, result);
            return result;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHANGE DETECTION SYSTEM (ONLY EMITS EVENTS)
    // ═══════════════════════════════════════════════════════════════════════════════

    function ChangeDetector(container) {
        const ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

        this.makeReactive = function(obj, path = []) {
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }

            const self = this;

            return new Proxy(obj, {
                get(target, prop) {
                    const value = target[prop];

                    // Handle array mutations
                    if (Array.isArray(target) && ARRAY_METHODS.includes(prop)) {
                        return function(...args) {
                            const result = Array.prototype[prop].apply(target, args);
                            emitChange([...path], target);
                            return result;
                        };
                    }

                    // Make nested objects reactive
                    if (value && typeof value === 'object' && !value._isReactive) {
                        const reactiveValue = self.makeReactive(value, [...path, prop]);
                        reactiveValue._isReactive = true;
                        target[prop] = reactiveValue;
                    }

                    return target[prop];
                },

                set(target, prop, newValue) {
                    const oldValue = target[prop];

                    if (oldValue === newValue) {
                        return true;
                    }

                    // Make new value reactive if needed
                    if (newValue && typeof newValue === 'object') {
                        const reactiveValue = self.makeReactive(newValue, [...path, prop]);
                        reactiveValue._isReactive = true;
                        target[prop] = reactiveValue;
                    } else {
                        target[prop] = newValue;
                    }

                    emitChange([...path, prop], newValue, oldValue);
                    return true;
                }
            });
        };

        function emitChange(propertyPath, newValue, oldValue) {
            container.dispatchEvent(new CustomEvent('property:changed', {
                detail: { path: propertyPath, newValue, oldValue }
            }));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // COMPUTED PROPERTIES MANAGER
    // ═══════════════════════════════════════════════════════════════════════════════

    function ComputedManager(abstraction, computedDefs) {
        const computedCache = new Map();
        const computedDeps = new Map();
        const listeners = new Set();

        // Initialize computed properties
        Object.keys(computedDefs).forEach(name => {
            const fn = computedDefs[name];
            const deps = extractDependencies(fn);
            computedDeps.set(name, { fn, dependencies: deps, isDirty: true, lastValue: undefined });

            Object.defineProperty(abstraction, name, {
                get() {
                    const entry = computedDeps.get(name);

                    if (entry.isDirty || !computedCache.has(name)) {
                        const newValue = entry.fn.call(this);
                        const oldValue = entry.lastValue;

                        computedCache.set(name, newValue);
                        entry.isDirty = false;
                        entry.lastValue = newValue;

                        // Notify listeners if value changed
                        if (oldValue !== newValue) {
                            listeners.forEach(listener => {
                                listener(name, newValue, oldValue);
                            });
                        }
                    }

                    return computedCache.get(name);
                },
                enumerable: true
            });
        });

        function extractDependencies(fn) {
            const source = fn.toString();
            const matches = source.match(/this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
            return [...new Set(matches.map(m => m.replace('this.', '')))];
        }

        this.invalidateComputed = function(changedProperty) {
            const invalidated = [];
            computedDeps.forEach((entry, computedName) => {
                if (entry.dependencies.includes(changedProperty)) {
                    entry.isDirty = true;
                    invalidated.push(computedName);

                    // Trigger getter to check for value change
                    const _ = abstraction[computedName];
                }
            });
            return invalidated;
        };

        this.addChangeListener = function(listener) {
            listeners.add(listener);
        };

        this.removeChangeListener = function(listener) {
            listeners.delete(listener);
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHANGE HANDLER (ONLY HANDLES EVENTS)
    // ═══════════════════════════════════════════════════════════════════════════════

    function ChangeHandler(container, abstraction, computedManager) {
        const subscriptions = new Map(); // property -> Set of elements
        const bindings = new WeakMap();   // element -> binding info

        this.subscribe = function(element, property, bindingInfo) {
            if (!subscriptions.has(property)) {
                subscriptions.set(property, new Set());
            }
            subscriptions.get(property).add(element);
            bindings.set(element, bindingInfo);
        };

        this.handleChange = function(propertyPath) {
            const rootProperty = propertyPath[0];

            // Invalidate computed properties
            computedManager.invalidateComputed(rootProperty);

            // Update elements subscribed to this property
            const elements = subscriptions.get(rootProperty) || new Set();
            elements.forEach(element => {
                if (element.isConnected) {
                    updateElement(element);
                } else {
                    elements.delete(element);
                }
            });
        };

        // Listen for computed property changes
        computedManager.addChangeListener((computedName, newValue, oldValue) => {
            const elements = subscriptions.get(computedName) || new Set();
            elements.forEach(element => {
                if (element.isConnected) {
                    updateElement(element);
                } else {
                    elements.delete(element);
                }
            });
        });

        function updateElement(element) {
            const binding = bindings.get(element);
            if (!binding) return;

            const value = ExpressionParser.evaluate(binding.parsed, abstraction);
            applyBinding(element, binding.type, value, binding);
        }

        function applyBinding(element, type, value, binding) {
            switch (type) {
                case 'text':
                    const newText = processTextInterpolation(binding.originalText, abstraction);
                    if (element.textContent !== newText) {
                        element.textContent = newText;
                    }
                    break;

                case 'visible':
                    const shouldShow = !!value;
                    if (shouldShow) {
                        if (element.hasAttribute('data-hidden')) {
                            element.style.display = element.getAttribute('data-orig-display') || '';
                            element.removeAttribute('data-hidden');
                            element.removeAttribute('data-orig-display');
                        }
                    } else {
                        if (!element.hasAttribute('data-hidden')) {
                            const currentDisplay = getComputedStyle(element).display;
                            if (currentDisplay !== 'none') {
                                element.setAttribute('data-orig-display', currentDisplay);
                            }
                            element.style.display = 'none';
                            element.setAttribute('data-hidden', 'true');
                        }
                    }
                    break;

                case 'value':
                    const stringValue = String(value || '');
                    if ('value' in element && element.value !== stringValue) {
                        element.value = stringValue;
                    }
                    break;

                case 'checked':
                    element.checked = Boolean(value);
                    break;

                default:
                    // Generic attribute
                    const booleanAttrs = ['readonly', 'required', 'selected', 'checked', 'hidden', 'multiple'];
                    if (booleanAttrs.includes(type)) {
                        element.toggleAttribute(type, !!value);
                    } else if (value != null) {
                        element.setAttribute(type, value);
                    } else {
                        element.removeAttribute(type);
                    }
                    break;
            }
        }

        function processTextInterpolation(textContent, context) {
            let text = String(textContent || '');
            const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

            if (matches) {
                for (const match of matches) {
                    const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();
                    try {
                        const parsed = ExpressionCache.parseExpression(expression);
                        const result = ExpressionParser.evaluate(parsed, context);
                        const formattedValue = result != null ? String(result) : '';
                        text = text.replace(match, formattedValue);
                    } catch (error) {
                        console.warn(`Error evaluating expression "${expression}":`, error);
                    }
                }
            }

            return text;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MAIN FRAMEWORK
    // ═══════════════════════════════════════════════════════════════════════════════

    function wakaPAC(selector, abstraction, options) {
        abstraction = abstraction || {};
        options = options || {};

        const container = document.querySelector(selector);
        if (!container) {
            throw new Error('Container not found: ' + selector);
        }

        // Initialize subsystems in correct order
        const changeDetector = new ChangeDetector(container);
        const reactiveAbstraction = changeDetector.makeReactive(abstraction);

        // Bind methods to reactive abstraction
        Object.keys(abstraction).forEach(key => {
            if (typeof abstraction[key] === 'function' && key !== 'computed') {
                reactiveAbstraction[key] = abstraction[key].bind(reactiveAbstraction);
            }
        });

        // Set up computed properties and change handler
        const computedManager = new ComputedManager(reactiveAbstraction, abstraction.computed || {});
        const changeHandler = new ChangeHandler(container, reactiveAbstraction, computedManager);

        // Setup bindings
        setupTextBindings();
        setupAttributeBindings();
        setupEventBindings();

        // Setup change event listener
        container.addEventListener('property:changed', function(event) {
            changeHandler.handleChange(event.detail.path);
        });

        // Initial update
        performInitialUpdate();

        // Call init if provided
        if (abstraction.init) {
            abstraction.init.call(reactiveAbstraction);
        }

        function setupTextBindings() {
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                { acceptNode: (node) => /\{\{.*\}\}/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
            );

            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }

            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

                if (matches) {
                    matches.forEach(match => {
                        const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();
                        const parsed = ExpressionCache.parseExpression(expression);
                        const dependencies = parsed.dependencies || [];

                        const bindingInfo = {
                            type: 'text',
                            originalText: text,
                            parsed: parsed
                        };

                        dependencies.forEach(dep => {
                            changeHandler.subscribe(textNode, dep, bindingInfo);
                        });
                    });
                }
            });
        }

        function setupAttributeBindings() {
            const elements = container.querySelectorAll('[data-pac-bind]');

            Array.from(elements).forEach(element => {
                const bindingString = element.getAttribute('data-pac-bind');
                const bindingPairs = parseBindingString(bindingString);

                bindingPairs.forEach(pair => {
                    if (pair.target) {
                        const parsed = ExpressionCache.parseExpression(pair.target);
                        const dependencies = parsed.dependencies || [];

                        const bindingInfo = {
                            type: pair.type,
                            parsed: parsed
                        };

                        dependencies.forEach(dep => {
                            changeHandler.subscribe(element, dep, bindingInfo);
                        });
                    }
                });
            });
        }

        function setupEventBindings() {
            const elements = container.querySelectorAll('[data-pac-bind]');

            Array.from(elements).forEach(element => {
                const bindingString = element.getAttribute('data-pac-bind');
                const bindingPairs = parseBindingString(bindingString);

                bindingPairs.forEach(pair => {
                    if (pair.type === 'click' && pair.target) {
                        element.addEventListener('click', function(event) {
                            const method = reactiveAbstraction[pair.target];
                            if (typeof method === 'function') {
                                try {
                                    method.call(reactiveAbstraction, event);
                                } catch (error) {
                                    console.error(`Error executing click handler "${pair.target}":`, error);
                                }
                            }
                        });
                    }
                });
            });
        }

        function parseBindingString(bindingString) {
            const pairs = [];
            const knownTypes = ['value', 'checked', 'visible', 'if', 'foreach', 'class', 'style', 'click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];

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
                    if (char === '(') parenDepth++;
                    else if (char === ')') parenDepth--;
                    else if (char === '{') braceDepth++;
                    else if (char === '}') braceDepth--;
                }

                if (char === ',' && !inQuotes && parenDepth === 0 && braceDepth === 0) {
                    addBindingPair(current.trim(), pairs, knownTypes);
                    current = '';
                } else {
                    current += char;
                }
            }

            addBindingPair(current.trim(), pairs, knownTypes);
            return pairs;
        }

        function addBindingPair(pairString, pairs, knownTypes) {
            if (!pairString) return;

            const colonIndex = findBindingColon(pairString, knownTypes);

            if (colonIndex === -1) {
                pairs.push({ type: pairString, target: '' });
            } else {
                pairs.push({
                    type: pairString.substring(0, colonIndex).trim(),
                    target: pairString.substring(colonIndex + 1).trim()
                });
            }
        }

        function findBindingColon(str, knownTypes) {
            for (const type of knownTypes) {
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
                    if (char === '(') parenDepth++;
                    else if (char === ')') parenDepth--;
                    else if (char === ':' && parenDepth === 0) {
                        return i;
                    }
                }
            }

            return -1;
        }

        function performInitialUpdate() {
            const rootProperties = Object.keys(reactiveAbstraction).filter(key => {
                return typeof reactiveAbstraction[key] !== 'function' && !key.startsWith('_');
            });

            rootProperties.forEach(propertyName => {
                changeHandler.handleChange([propertyName]);
            });
        }

        return reactiveAbstraction;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════════

    // Simple registry for component management
    function SimplePACRegistry() {
        this.components = new Map();

        this.register = function(selector, component) {
            this.components.set(selector, component);
        };

        this.unregister = function(selector) {
            this.components.delete(selector);
        };
    }

    // Initialize global registry and export
    window.PACRegistry = window.PACRegistry || new SimplePACRegistry();
    window.wakaPAC = wakaPAC;

})();