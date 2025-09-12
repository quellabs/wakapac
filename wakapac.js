/**
 * wakaPAC Framework with Working Foreach Implementation
 * Fixed event handling in foreach contexts
 */
(function () {
    "use strict";

    // ========================================================================
    // CONSTANTS
    // ========================================================================

    const INTERPOLATION_REGEX = /\{\{\s*([^}]+)\s*}}/g;
    const INTERPOLATION_TEST_REGEX = /\{\{.*}}/;

    const KNOWN_BINDING_TYPES = [
        "value", "checked", "visible", "if", "foreach", "class", "style",
        "click", "change", "input", "submit", "focus", "blur", "keyup", "keydown"
    ];

    // ========================================================================
    // ORIGINAL EXPRESSION PARSER (COMPLETE)
    // ========================================================================

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

                if (opPrec < minPrec) {
                    break;
                }

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
            if (this.isAtEnd()) {
                return false;
            }

            return this.peek().type === type;
        },

        advance() {
            if (!this.isAtEnd()) {
                this.currentToken++;
            }

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
            if (this.check(type)) {
                return this.advance();
            }
            throw new Error(message + ` at token: ${JSON.stringify(this.peek())}`);
        },

        evaluate(parsedExpr, context) {
            if (!parsedExpr) {
                return undefined;
            }

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
                    } else {
                        return false;
                    }
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

        getProperty(obj, path) {
            if (!obj || !path) {
                return undefined;
            }

            if (path.indexOf('.') === -1) {
                return obj[path];
            }

            const parts = path.split('.');
            let current = obj;

            for (let i = 0; i < parts.length; i++) {
                if (current == null) {
                    return undefined;
                }

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

                    if (val && typeof val === 'object' && !val._isReactive) {
                        const nestedPath = currentPath.concat([prop]);
                        target[prop] = createProxy(val, nestedPath);
                        target[prop]._isReactive = true;
                    }

                    return target[prop];
                },

                set: function (target, prop, newValue) {
                    const oldValue = target[prop];
                    const propertyPath = currentPath.concat([prop]);

                    if (oldValue === newValue) {
                        return true;
                    }

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

    // ========================================================================
    // COMPUTED PROPERTIES
    // ========================================================================

    function ComputedManager(abstraction, computedDefs) {
        const computedCache = new Map();
        const computedDeps = new Map();

        Object.keys(computedDefs).forEach(name => {
            const fn = computedDefs[name];
            const deps = extractDependencies(fn);
            computedDeps.set(name, {fn, dependencies: deps, isDirty: true});

            Object.defineProperty(abstraction, name, {
                get() {
                    const entry = computedDeps.get(name);

                    if (entry.isDirty || !computedCache.has(name)) {
                        const value = entry.fn.call(this);
                        computedCache.set(name, value);
                        entry.isDirty = false;
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

        this.invalidateComputed = function (changedProperty) {
            const invalidated = [];
            computedDeps.forEach((entry, computedName) => {
                if (entry.dependencies.includes(changedProperty)) {
                    entry.isDirty = true;
                    computedCache.delete(computedName);
                    invalidated.push(computedName);
                }
            });
            return invalidated;
        };
    }

    // ========================================================================
    // UNIFIED SUBSCRIPTION SYSTEM
    // ========================================================================

    function UnifiedSubscriptionMap(container) {
        this.container = container;
        this.propertyToElements = new Map();
        this.elementToBindings = new WeakMap();
        this.container.setAttribute('data-pac-container', '');
    }

    UnifiedSubscriptionMap.prototype.subscribe = function (element, propertyPath, binding) {
        if (!this.belongsToThisContainer(element)) {
            return false;
        }

        if (!this.propertyToElements.has(propertyPath)) {
            this.propertyToElements.set(propertyPath, new Set());
        }

        this.propertyToElements.get(propertyPath).add(element);

        if (!this.elementToBindings.has(element)) {
            this.elementToBindings.set(element, new Set());
        }

        this.elementToBindings.get(element).add(binding);

        return true;
    };

    UnifiedSubscriptionMap.prototype.belongsToThisContainer = function (element) {
        // Cache the result since this gets called repeatedly
        if (element._pacContainerCheck === this.container) {
            return true;
        }

        if (element._pacContainerCheck) {
            return false;
        }

        let belongs;
        if (element.nodeType === Node.TEXT_NODE) {
            const parentElement = element.parentElement;

            if (!parentElement) {
                return false;
            }

            const closestContainer = parentElement.closest('[data-pac-container]');
            belongs = closestContainer === this.container;
        } else {
            const closestContainer = element.closest('[data-pac-container]');
            belongs = closestContainer === this.container;
        }

        // Cache the result
        element._pacContainerCheck = belongs ? this.container : false;
        return belongs;
    };

    UnifiedSubscriptionMap.prototype.getSubscribedElements = function (propertyPath) {
        const elements = this.propertyToElements.get(propertyPath) || new Set();
        const liveElements = new Set();
        const self = this;

        elements.forEach(function (el) {
            if (el.isConnected && self.belongsToThisContainer(el)) {
                liveElements.add(el);
            }
        });

        this.propertyToElements.set(propertyPath, liveElements);
        return liveElements;
    };

    UnifiedSubscriptionMap.prototype.getBindingForElementAndProperty = function (element, propertyPath) {
        const bindings = this.elementToBindings.get(element) || new Set();

        for (const binding of bindings) {
            if (binding.dependencies && binding.dependencies.includes(propertyPath)) {
                return binding;
            }
        }

        return null;
    };

    // ========================================================================
    // BINDING MANAGEMENT SUBSYSTEM WITH FOREACH CONTEXT SUPPORT
    // ========================================================================

    function BindingManager(container, subscriptionMap) {
        this.container = container;
        this.subscriptionMap = subscriptionMap;
        this.bindings = new Map();
        this.eventBindings = [];
        this.bindingCounter = 0;
        this.textNodes = [];
        this.attributeElements = [];

        // Cache elements immediately
        this.cacheElements();
    }

    BindingManager.prototype.cacheElements = function () {
        // Cache text nodes with interpolation ONCE
        const walker = document.createTreeWalker(
            this.container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return INTERPOLATION_TEST_REGEX.test(node.textContent) ?
                        NodeFilter.FILTER_ACCEPT :
                        NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            if (this.subscriptionMap.belongsToThisContainer(node)) {
                this.textNodes.push(node);
            }
        }

        // Cache attribute elements ONCE
        const elements = this.container.querySelectorAll('[data-pac-bind]');

        Array.from(elements).forEach(element => {
            if (this.subscriptionMap.belongsToThisContainer(element)) {
                this.attributeElements.push(element);
            }
        });
    };

    BindingManager.prototype.batchDOMUpdates = function (updates) {
        // Use requestAnimationFrame to batch DOM updates
        if (this.pendingUpdates) {
            this.pendingUpdates = this.pendingUpdates.concat(updates);
            return;
        }

        this.pendingUpdates = updates;

        requestAnimationFrame(() => {
            const allUpdates = this.pendingUpdates;
            this.pendingUpdates = null;

            // Apply all updates in one frame
            allUpdates.forEach(update => {
                update();
            });
        });
    };

    BindingManager.prototype.createBinding = function (type, element, config) {
        const binding = {
            id: ++this.bindingCounter + '_' + Date.now(),
            type: type,
            element: element,
            target: config.target,
            originalText: config.originalText,
            fullMatch: config.fullMatch,
            dependencies: config.dependencies || []
        };

        this.bindings.set(binding.id, binding);
        return binding;
    };

    BindingManager.prototype.setupTextBindings = function () {
        const self = this;

        // Use cached text nodes instead of searching again
        this.textNodes.forEach(function (node) {
            const text = node.textContent;
            const matches = text.match(INTERPOLATION_REGEX);

            if (matches) {
                matches.forEach(function (match) {
                    const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();
                    const parsed = ExpressionCache.parseExpression(expression);
                    const dependencies = parsed.dependencies || [];

                    const binding = self.createBinding('text', node, {
                        target: expression,
                        originalText: text,
                        fullMatch: match,
                        dependencies: dependencies
                    });

                    dependencies.forEach(function (dependency) {
                        self.subscriptionMap.subscribe(node, dependency, binding);
                    });
                });
            }
        });
    };

    BindingManager.prototype.setupAttributeBindings = function (computedProperties) {
        const self = this;

        // Use cached elements instead of querying again
        this.attributeElements.forEach(function (element) {
            const bindingString = element.getAttribute('data-pac-bind');
            const bindingPairs = ExpressionParser.parseBindingString(bindingString);

            bindingPairs.forEach(function (pair) {
                const type = pair.type;
                const target = pair.target;

                if (self.isEventBinding(type)) {
                    self.eventBindings.push({element, type, target});
                    return;
                }

                if (target) {
                    const parsed = ExpressionCache.parseExpression(target);
                    const dependencies = parsed.dependencies || [];
                    const binding = self.createBinding(type, element, {target, dependencies});

                    if (binding) {
                        dependencies.forEach(function (dep) {
                            self.subscriptionMap.subscribe(element, dep, binding);
                        });
                    }
                }
            });

            // Subscribe to computed properties referenced in bindings
            if (computedProperties) {
                const computedNames = Object.keys(computedProperties);

                bindingPairs.forEach(function (pair) {
                    if (pair.target) {
                        computedNames.forEach(function (computedName) {
                            if (pair.target.includes(computedName)) {
                                const computedBinding = self.createBinding(pair.type, element, {
                                    target: pair.target,
                                    dependencies: [computedName]
                                });

                                self.subscriptionMap.subscribe(element, computedName, computedBinding);
                            }
                        });
                    }
                });
            }
        });
    };

    BindingManager.prototype.setupDelegatedTwoWayBinding = function() {
        const self = this;

        // Single event listener for all input events
        this.container.addEventListener('input', function(event) {
            self.handleTwoWayBindingEvent(event, 'input');
        });

        // Single event listener for all change events
        this.container.addEventListener('change', function(event) {
            self.handleTwoWayBindingEvent(event, 'change');
        });
    };

    BindingManager.prototype.handleTwoWayBindingEvent = function(event, eventType) {
        const element = event.target;

        // Only process elements that belong to this container
        if (!this.subscriptionMap.belongsToThisContainer(element)) {
            return;
        }

        // Check if this element has two-way binding
        const bindingString = element.getAttribute('data-pac-bind');

        if (!bindingString) {
            return;
        }

        const bindingPairs = ExpressionParser.parseBindingString(bindingString);

        // Find the appropriate binding type for this event
        let propertyPath = null;

        for (const pair of bindingPairs) {
            if ((pair.type === 'value' && eventType === 'input' && 'value' in element) ||
                (pair.type === 'checked' && eventType === 'change' && element.type === 'checkbox')) {
                propertyPath = pair.target;
                break;
            }
        }

        if (!propertyPath) {
            return;
        }

        // Get the value to set
        const value = (element.type === 'checkbox') ? element.checked : element.value;

        // Get the component and set the property
        const containerSelector = this.getContainerSelector();
        const control = window.PACRegistry.components.get(containerSelector);

        if (control && control.abstraction) {
            this.setNestedProperty(control.abstraction, propertyPath, value);
        }
    };

    BindingManager.prototype.getContainerSelector = function() {
        if (this.container.id) {
            return '#' + this.container.id;
        }
        
        if (this.container.className) {
            return '.' + this.container.className.split(' ')[0];
        }

        return null;
    };

    // Helper to set nested properties like 'todo.completed'
    BindingManager.prototype.setNestedProperty = function (obj, path, value) {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }

            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    };

    // NEW: Methods for processing foreach contexts
    BindingManager.prototype.processElementBindings = function (element, context) {
        // Process text interpolation in the element
        this.processTextNodesWithContext(element, context);

        // Process attribute bindings in the element
        this.processAttributeBindingsWithContext(element, context);
    };

    BindingManager.prototype.processTextNodesWithContext = function (element, context) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    return INTERPOLATION_TEST_REGEX.test(node.textContent) ?
                        NodeFilter.FILTER_ACCEPT :
                        NodeFilter.FILTER_SKIP;
                }
            }
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        const self = this;
        textNodes.forEach(function (textNode) {
            const originalText = textNode.textContent;
            textNode.textContent = self.processTextInterpolation(originalText, context);
        });
    };

    BindingManager.prototype.processAttributeBindingsWithContext = function (element, context) {
        const elements = element.querySelectorAll('[data-pac-bind]');

        // Include the element itself if it has bindings
        const allElements = element.hasAttribute('data-pac-bind') ?
            [element].concat(Array.from(elements)) :
            Array.from(elements);

        const self = this;

        allElements.forEach(function (el) {
            const bindingString = el.getAttribute('data-pac-bind');
            const bindingPairs = ExpressionParser.parseBindingString(bindingString);

            bindingPairs.forEach(function (pair) {
                if (pair.type !== 'foreach') {
                    if (self.isEventBinding(pair.type) && pair.target) {
                        // Handle event bindings with context
                        self.setupContextualEventBinding(el, pair.type, pair.target, context);
                    } else if (pair.target) {
                        const parsed = ExpressionCache.parseExpression(pair.target);
                        const value = ExpressionParser.evaluate(parsed, context);
                        self.applyBindingWithType(el, pair.type, value);

                        // Set up two-way binding for form elements in foreach context
                        if (pair.type === 'value' && ('value' in el)) {
                            self.setupContextualTwoWayBinding(el, pair.target, context, 'input');
                        }

                        if (pair.type === 'checked' && el.type === 'checkbox') {
                            self.setupContextualTwoWayBinding(el, pair.target, context, 'change');
                        }
                    }
                }
            });
        });
    };

    BindingManager.prototype.setupContextualTwoWayBinding = function (element, propertyPath, context, eventType) {
        const self = this;

        element.addEventListener(eventType, function () {
            // Use the expression parser to set the property in the correct context
            const value = (element.type === 'checkbox') ? element.checked : element.value;
            const parsed = ExpressionCache.parseExpression(propertyPath);
            self.setPropertyInContext(parsed, context, value);
        });
    };

    // Helper to set properties using the expression parser
    BindingManager.prototype.setPropertyInContext = function (parsedExpr, context, value) {
        if (!parsedExpr || parsedExpr.type !== 'property') {
            return;
        }

        const path = parsedExpr.path;

        const parts = path.split('.');
        let current = context;

        // Navigate to the parent object
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current || typeof current !== 'object') {
                return;
            }

            current = current[parts[i]];
        }

        // Set the final property
        if (current && typeof current === 'object') {
            const finalProp = parts[parts.length - 1];
            current[finalProp] = value;
        }
    };

    // NEW: Event binding that passes context for foreach items
    BindingManager.prototype.setupContextualEventBinding = function (element, eventType, methodName, context) {
        element.addEventListener(eventType, function (event) {
            // Get the global context (main abstraction) that has the methods
            const globalContext = context.__parent || context;

            if (globalContext && typeof globalContext[methodName] === 'function') {
                const method = globalContext[methodName];

                try {
                    // Pass item, index, and event for foreach contexts
                    if (context.item !== undefined && context.index !== undefined) {
                        method.call(globalContext, context.item, context.index, event);
                    } else {
                        method.call(globalContext, event);
                    }
                } catch (error) {
                    console.error('Error executing ' + eventType + ' handler "' + methodName + '":', error);
                }
            } else {
                console.warn(eventType + ' handler "' + methodName + '" is not a function');
            }
        });
    };

    BindingManager.prototype.applyBindingWithType = function (element, type, value) {
        switch (type) {
            case 'visible':
                this.applyVisibilityBinding({element: element}, value);
                break;
            case 'value':
                this.applyInputBinding({element: element}, value);
                break;
            case 'checked':
                this.applyCheckedBinding({element: element}, value);
                break;
            default:
                this.applyAttributeBinding({element: element, type: type}, value);
                break;
        }
    };

    BindingManager.prototype.isEventBinding = function (type) {
        const eventTypes = ['click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
        return eventTypes.includes(type);
    };

    BindingManager.prototype.getTextNodesFromElement = function (element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return INTERPOLATION_TEST_REGEX.test(node.textContent) ?
                        NodeFilter.FILTER_ACCEPT :
                        NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        return textNodes;
    };

    BindingManager.prototype.updateElementForProperty = function (element, propertyPath, context) {
        const binding = this.subscriptionMap.getBindingForElementAndProperty(element, propertyPath);

        if (!binding) {
            return;
        }

        const parsed = ExpressionCache.parseExpression(binding.target);
        const evaluatedValue = ExpressionParser.evaluate(parsed, context);

        switch (binding.type) {
            case 'text':
                this.applyTextBinding(binding, context);
                break;
            case 'visible':
                this.applyVisibilityBinding(binding, evaluatedValue);
                break;
            case 'value':
                this.applyInputBinding(binding, evaluatedValue);
                break;
            case 'checked':
                this.applyCheckedBinding(binding, evaluatedValue);
                break;
            default:
                this.applyAttributeBinding(binding, evaluatedValue);
                break;
        }
    };

    BindingManager.prototype.processTextInterpolation = function (textContent, context) {
        let text = String(textContent || '');
        const matches = text.match(INTERPOLATION_REGEX);

        if (matches) {
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();

                try {
                    const parsed = ExpressionCache.parseExpression(expression);
                    const result = ExpressionParser.evaluate(parsed, context);
                    const formattedValue = result != null ? String(result) : '';
                    text = text.replace(match, formattedValue);
                } catch (error) {
                    console.warn('Error evaluating expression "' + expression + '":', error);
                }
            }
        }

        return text;
    };

    BindingManager.prototype.applyTextBinding = function (binding, context) {
        const textNode = binding.element;
        const newText = this.processTextInterpolation(binding.originalText, context);

        if (textNode.textContent !== newText) {
            textNode.textContent = newText;
        }
    };

    BindingManager.prototype.applyVisibilityBinding = function (binding, value) {
        const element = binding.element;
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

    BindingManager.prototype.applyInputBinding = function (binding, value) {
        const element = binding.element;
        const stringValue = String(value || '');

        if ('value' in element && element.value !== stringValue) {
            element.value = stringValue;
        }
    };

    BindingManager.prototype.applyCheckedBinding = function (binding, value) {
        const element = binding.element;
        element.checked = Boolean(value);
    };

    BindingManager.prototype.applyAttributeBinding = function (binding, value) {
        const element = binding.element;
        const attribute = binding.type;
        const booleanAttrs = ['readonly', 'required', 'selected', 'checked', 'hidden', 'multiple'];

        if (booleanAttrs.includes(attribute)) {
            element.toggleAttribute(attribute, !!value);
        } else if (value != null) {
            element.setAttribute(attribute, value);
        } else {
            element.removeAttribute(attribute);
        }
    };

    BindingManager.prototype.getEventBindings = function () {
        return this.eventBindings;
    };

    BindingManager.prototype.getBinding = function (id) {
        return this.bindings.get(id);
    };

    BindingManager.prototype.removeBinding = function (id) {
        return this.bindings.delete(id);
    };

    BindingManager.prototype.cleanup = function () {
        this.bindings.clear();
        this.eventBindings = [];
    };

    // ========================================================================
    // CLEAN FOREACH MANAGER (Only foreach-specific logic)
    // ========================================================================

    function ForeachManager(container, subscriptionMap, bindingManager) {
        this.container = container;
        this.subscriptionMap = subscriptionMap;
        this.bindingManager = bindingManager;
        this.foreachBindings = new Map();
        this.itemReactivityCleanup = new WeakMap();
    }

    ForeachManager.prototype.setupForeachBindings = function () {
        const elements = this.container.querySelectorAll('[data-pac-bind*="foreach:"]');
        const self = this;

        Array.from(elements).forEach(function (element) {
            // Skip elements that don't belong to this container
            if (!self.subscriptionMap.belongsToThisContainer(element)) {
                return;
            }

            const bindingString = element.getAttribute('data-pac-bind');
            const bindingPairs = ExpressionParser.parseBindingString(bindingString);

            const foreachPair = bindingPairs.find(function (pair) {
                return pair.type === 'foreach';
            });

            if (foreachPair) {
                const arrayProperty = foreachPair.target;
                const itemName = element.getAttribute('data-pac-item') || 'item';
                const indexName = element.getAttribute('data-pac-index') || 'index';

                const binding = {
                    arrayProperty: arrayProperty,
                    itemName: itemName,
                    indexName: indexName,
                    element: element
                };

                self.foreachBindings.set(element, binding);

                // Subscribe to the array property
                self.subscriptionMap.subscribe(element, arrayProperty, {
                    type: 'foreach',
                    element: element,
                    target: arrayProperty,
                    dependencies: [arrayProperty]
                });

                // Store the original template
                binding.template = element.cloneNode(true);
                binding.template.removeAttribute('data-pac-bind');
                binding.template.removeAttribute('data-pac-item');
                binding.template.removeAttribute('data-pac-index');

                // Clear the element initially
                element.innerHTML = '';
            }
        });
    };

    ForeachManager.prototype.rebuildArray = function (arrayProperty, newArray, context) {
        const self = this;

        this.foreachBindings.forEach(function (binding, element) {
            if (binding.arrayProperty === arrayProperty) {
                self.rebuildForeachElement(binding, newArray, context);
            }
        });
    };

    ForeachManager.prototype.rebuildForeachElement = function (binding, array, globalContext) {
        const element = binding.element;
        const template = binding.template;

        // Clean up old reactivity
        this.cleanupElementReactivity(element);

        // Clear current content
        element.innerHTML = '';

        if (!Array.isArray(array) || array.length === 0) {
            return;
        }

        const self = this;
        const fragment = document.createDocumentFragment();

        // Create elements for each array item
        array.forEach(function (item, index) {
            const itemElement = template.cloneNode(true);

            // Create item context with proper linking
            const itemContext = Object.assign({}, globalContext);

            // IMPORTANT: Use the actual array item, not a copy
            // This ensures changes to the item properties propagate to the original array
            itemContext[binding.itemName] = array[index];  // Direct reference to array item
            itemContext[binding.indexName] = index;

            // Add references for event handlers to find the main context
            itemContext.item = array[index];  // Direct reference to array item
            itemContext.index = index;
            itemContext.__parent = globalContext;

            // Don't create a separate reactive proxy for the item - use the array item directly
            // The array is already reactive, so items within it are also reactive

            // Delegate to BindingManager for processing bindings
            self.bindingManager.processElementBindings(itemElement, itemContext);

            fragment.appendChild(itemElement);
        });

        element.appendChild(fragment);
    };

    ForeachManager.prototype.makeItemReactive = function (item, parentElement, itemName) {
        if (!item || typeof item !== 'object') {
            return item;
        }

        // Create a reactive proxy for the item
        const reactiveItem = makeDeepReactiveProxy(item, this.container);

        // Track for cleanup
        if (!this.itemReactivityCleanup.has(parentElement)) {
            this.itemReactivityCleanup.set(parentElement, []);
        }
        this.itemReactivityCleanup.get(parentElement).push(reactiveItem);

        return reactiveItem;
    };

    ForeachManager.prototype.cleanupElementReactivity = function (element) {
        const cleanupItems = this.itemReactivityCleanup.get(element);
        if (cleanupItems) {
            // Clear the cleanup tracking
            this.itemReactivityCleanup.delete(element);
        }
    };

    ForeachManager.prototype.cleanup = function () {
        this.foreachBindings.clear();
        this.itemReactivityCleanup = new WeakMap();
    };

    // ========================================================================
    // MAIN FRAMEWORK WITH FOREACH INTEGRATION
    // ========================================================================

    function wakaPAC(selector, abstraction, options) {
        abstraction = abstraction || {};
        options = options || {};

        const container = document.querySelector(selector);

        if (!container) {
            throw new Error('Container not found: ' + selector);
        }

        const config = {
            updateMode: options.updateMode || 'batched',
            delay: options.delay || 300
        };

        const control = {
            selector: selector,
            container: container,
            config: config,
            original: abstraction,
            abstraction: null,
            subscriptionMap: null,
            bindingManager: null,
            foreachManager: null,

            initialize: function () {
                this.subscriptionMap = new UnifiedSubscriptionMap(this.container);
                this.bindingManager = new BindingManager(this.container, this.subscriptionMap);
                this.foreachManager = new ForeachManager(this.container, this.subscriptionMap, this.bindingManager);

                // Set up delegated two-way binding ONCE
                this.bindingManager.setupDelegatedTwoWayBinding();
                this.bindingManager.setupTextBindings();
                this.bindingManager.setupAttributeBindings(this.original.computed);
                this.foreachManager.setupForeachBindings();
                this.setupEventCapture();
                this.abstraction = this.createReactiveAbstraction();
                this.setupEventHandlers();
                this.performInitialUpdate();
                return this;
            },

            createReactiveAbstraction: function () {
                const reactive = {};
                const self = this;

                // First, create the reactive proxy with an empty object
                const proxiedReactive = makeDeepReactiveProxy(reactive, this.container);

                // Then set all properties through the proxy so they become reactive
                Object.keys(this.original).forEach(function (key) {
                    if (key !== 'computed' && typeof self.original[key] !== 'function') {
                        proxiedReactive[key] = self.original[key];  // This triggers the proxy setter
                    }
                });

                // Add methods
                Object.keys(this.original).forEach(function (key) {
                    if (typeof self.original[key] === 'function' && key !== 'computed') {
                        proxiedReactive[key] = self.original[key].bind(proxiedReactive);
                    }
                });

                if (this.original.computed) {
                    this.computedManager = new ComputedManager(proxiedReactive, this.original.computed);
                }

                return proxiedReactive;
            },

            setupEventHandlers: function () {
                const self = this;
                const eventBindings = this.bindingManager.getEventBindings();

                eventBindings.forEach(function (eventBinding) {
                    if (eventBinding.type === 'click') {
                        self.setupClickBinding(eventBinding.element, eventBinding.target);
                    }
                });
            },

            setupClickBinding: function (element, methodName) {
                const self = this;

                element.addEventListener('click', function (event) {
                    const method = self.abstraction[methodName];

                    if (typeof method === 'function') {
                        try {
                            method.call(self.abstraction, event);
                        } catch (error) {
                            console.error('Error executing click handler "' + methodName + '":', error);
                        }
                    } else {
                        console.warn('Click handler "' + methodName + '" is not a function');
                    }
                });
            },

            setupEventCapture: function () {
                const self = this;

                // Handle regular property changes
                this.container.addEventListener('pac:change', function (event) {
                    const detail = event.detail;
                    const path = detail.path;
                    const propertyPath = path.join('.');

                    self.handlePropertyChange(propertyPath);

                    if (path.length > 1) {
                        self.handlePropertyChange(path[0]);
                    }
                });

                // Handle array-specific changes
                this.container.addEventListener('pac:array-change', function (event) {
                    const detail = event.detail;
                    const path = detail.path;
                    const propertyPath = path.join('.');
                    const newArray = detail.newValue;

                    // Rebuild foreach elements for this array
                    self.foreachManager.rebuildArray(propertyPath, newArray, self.abstraction);
                });
            },

            handlePropertyChange: function (propertyPath) {
                const self = this;
                const subscribedElements = this.subscriptionMap.getSubscribedElements(propertyPath);

                if (subscribedElements.size > 0) {
                    subscribedElements.forEach(function (element) {
                        const binding = self.subscriptionMap.getBindingForElementAndProperty(element, propertyPath);

                        // Skip foreach bindings - they're handled by pac:array-change
                        if (binding && binding.type === 'foreach') {
                            return;
                        }

                        self.bindingManager.updateElementForProperty(element, propertyPath, self.abstraction);
                    });

                    this.invalidateComputedDependents(propertyPath);
                }
            },

            invalidateComputedDependents: function (changedProperty) {
                if (!this.computedManager) {
                    return;
                }

                const invalidatedComputed = this.computedManager.invalidateComputed(changedProperty);
                const self = this;

                invalidatedComputed.forEach(function (computedName) {
                    const _ = self.abstraction[computedName];
                    self.handlePropertyChange(computedName);
                });
            },

            performInitialUpdate: function () {
                const self = this;
                const rootProperties = Object.keys(this.abstraction).filter(function (key) {
                    return typeof self.abstraction[key] !== 'function' && !key.startsWith('_');
                });

                rootProperties.forEach(function (propertyName) {
                    const value = self.abstraction[propertyName];

                    // Handle initial array rendering
                    if (Array.isArray(value)) {
                        self.foreachManager.rebuildArray(propertyName, value, self.abstraction);
                    }

                    self.handlePropertyChange(propertyName);
                });

                if (this.original.init) {
                    this.original.init.call(this.abstraction);
                }
            }
        };

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