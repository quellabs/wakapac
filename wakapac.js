/**
 * Unified wakaPAC Framework with BindingManager Subsystem
 * Single subscription system, PAC events, original binding methods
 */
(function() {
    "use strict";

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
            const KNOWN_BINDING_TYPES = [
                "value", "checked", "visible", "if", "foreach", "class", "style",
                "click", "change", "input", "submit", "focus", "blur", "keyup", "keydown"
            ];

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
    // REACTIVE PROXY WITH PAC:CHANGE EVENTS
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
                            const oldArray = Array.prototype.slice.call(target);
                            const result = Array.prototype[prop].apply(target, arguments);

                            container.dispatchEvent(new CustomEvent("pac:change", {
                                detail: {
                                    path: currentPath,
                                    oldValue: oldArray,
                                    newValue: Array.prototype.slice.call(target)
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
            computedDeps.set(name, { fn, dependencies: deps, isDirty: true });

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

        this.invalidateComputed = function(changedProperty) {
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
        if (element.nodeType === Node.TEXT_NODE) {
            const parentElement = element.parentElement;
            if (!parentElement) return false;
            const closestContainer = parentElement.closest('[data-pac-container]');
            return closestContainer === this.container;
        }

        const closestContainer = element.closest('[data-pac-container]');
        return closestContainer === this.container;
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

    UnifiedSubscriptionMap.prototype.getBindingForElementAndProperty = function(element, propertyPath) {
        const bindings = this.elementToBindings.get(element) || new Set();

        for (const binding of bindings) {
            if (binding.dependencies && binding.dependencies.includes(propertyPath)) {
                return binding;
            }
        }

        return null;
    };

    // ========================================================================
    // BINDING MANAGEMENT SUBSYSTEM
    // ========================================================================

    function BindingManager(container, subscriptionMap) {
        this.container = container;
        this.subscriptionMap = subscriptionMap;
        this.bindings = new Map();
        this.eventBindings = [];
        this.bindingCounter = 0;
    }

    BindingManager.prototype.createBinding = function(type, element, config) {
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

    BindingManager.prototype.setupTextBindings = function() {
        const textNodes = this.getTextNodesFromElement(this.container);
        const self = this;

        textNodes.forEach(function(node) {
            const text = node.textContent;
            const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

            if (matches) {
                matches.forEach(function(match) {
                    const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();
                    const parsed = ExpressionCache.parseExpression(expression);
                    const dependencies = parsed.dependencies || [];

                    const binding = self.createBinding('text', node, {
                        target: expression,
                        originalText: text,
                        fullMatch: match,
                        dependencies: dependencies
                    });

                    dependencies.forEach(function(dependency) {
                        self.subscriptionMap.subscribe(node, dependency, binding);
                    });
                });
            }
        });
    };

    BindingManager.prototype.setupAttributeBindings = function(computedProperties) {
        const elements = this.container.querySelectorAll('[data-pac-bind]');
        const self = this;

        Array.from(elements).forEach(function(element) {
            const bindingString = element.getAttribute('data-pac-bind');
            const bindingPairs = ExpressionParser.parseBindingString(bindingString);

            bindingPairs.forEach(function(pair) {
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
                        dependencies.forEach(function(dep) {
                            self.subscriptionMap.subscribe(element, dep, binding);
                        });
                    }
                }
            });

            // Subscribe to computed properties referenced in bindings
            if (computedProperties) {
                const computedNames = Object.keys(computedProperties);

                bindingPairs.forEach(function(pair) {
                    if (pair.target) {
                        computedNames.forEach(function(computedName) {
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

    BindingManager.prototype.isEventBinding = function(type) {
        const eventTypes = ['click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
        return eventTypes.includes(type);
    };

    BindingManager.prototype.getTextNodesFromElement = function(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return /\{\{.*\}\}/.test(node.textContent) ?
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

    BindingManager.prototype.updateElementForProperty = function(element, propertyPath, context) {
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

    BindingManager.prototype.processTextInterpolation = function(textContent, context) {
        let text = String(textContent || '');
        const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

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

    BindingManager.prototype.applyTextBinding = function(binding, context) {
        const textNode = binding.element;
        const newText = this.processTextInterpolation(binding.originalText, context);

        if (textNode.textContent !== newText) {
            textNode.textContent = newText;
        }
    };

    BindingManager.prototype.applyVisibilityBinding = function(binding, value) {
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

    BindingManager.prototype.applyInputBinding = function(binding, value) {
        const element = binding.element;
        const stringValue = String(value || '');

        if ('value' in element && element.value !== stringValue) {
            element.value = stringValue;
        }
    };

    BindingManager.prototype.applyCheckedBinding = function(binding, value) {
        const element = binding.element;
        element.checked = Boolean(value);
    };

    BindingManager.prototype.applyAttributeBinding = function(binding, value) {
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

    BindingManager.prototype.getEventBindings = function() {
        return this.eventBindings;
    };

    BindingManager.prototype.getBinding = function(id) {
        return this.bindings.get(id);
    };

    BindingManager.prototype.removeBinding = function(id) {
        return this.bindings.delete(id);
    };

    BindingManager.prototype.cleanup = function() {
        this.bindings.clear();
        this.eventBindings = [];
    };

    // ========================================================================
    // MAIN FRAMEWORK WITH BINDING MANAGER INTEGRATION
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

            initialize: function () {
                this.subscriptionMap = new UnifiedSubscriptionMap(this.container);
                this.bindingManager = new BindingManager(this.container, this.subscriptionMap);

                this.bindingManager.setupTextBindings();
                this.bindingManager.setupAttributeBindings(this.original.computed);
                this.setupSimpleEventCapture();
                this.abstraction = this.createReactiveAbstraction();
                this.setupEventHandlers();
                this.performInitialUpdate();
                return this;
            },

            createReactiveAbstraction: function () {
                const reactive = {};
                const self = this;

                Object.keys(this.original).forEach(function (key) {
                    if (key !== 'computed' && typeof self.original[key] !== 'function') {
                        reactive[key] = self.original[key];
                    }
                });

                const proxiedReactive = makeDeepReactiveProxy(reactive, this.container);

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

            setupSimpleEventCapture: function () {
                const self = this;

                this.container.addEventListener('pac:change', function (event) {
                    const detail = event.detail;
                    const path = detail.path;
                    const propertyPath = path.join('.');

                    self.handlePropertyChange(propertyPath);

                    if (path.length > 1) {
                        self.handlePropertyChange(path[0]);
                    }
                });
            },

            handlePropertyChange: function (propertyPath) {
                const self = this;
                const subscribedElements = this.subscriptionMap.getSubscribedElements(propertyPath);

                if (subscribedElements.size > 0) {
                    subscribedElements.forEach(function (element) {
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
                    self.handlePropertyChange(propertyName);
                });

                if (this.original.init) {
                    this.original.init.call(this.abstraction);
                }
            }
        };

        const controlUnit = control.initialize();

        const publicAPI = Object.assign({}, controlUnit.abstraction);
        window.PACRegistry.register(selector, control);
        return publicAPI;
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    function SimplePACRegistry() {
        this.components = new Map();

        this.register = function(selector, component) {
            this.components.set(selector, component);
        };

        this.unregister = function(selector) {
            this.components.delete(selector);
        };
    }

    window.PACRegistry = window.PACRegistry || new SimplePACRegistry();
    window.wakaPAC = wakaPAC;

})();