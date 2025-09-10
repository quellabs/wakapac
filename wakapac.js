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

    /**
     * All binding types
     * @type {string[]}
     */
    const KNOWN_BINDING_TYPES = [
        "value", "checked", "visible", "if", "foreach", "class", "style",
        "click", "change", "input", "submit", "focus", "blur", "keyup", "keydown"
    ];

    /**
     * Array mutation methods that trigger reactivity updates
     * @constant {string[]}
     */
    const ARRAY_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];

    /**
     * HTML attributes that are boolean (present = true, absent = false)
     * @constant {string[]}
     */
    const BOOLEAN_ATTRS = ["readonly", "required", "selected", "checked", "hidden", "multiple"];

    /**
     * Common DOM event types for event listeners
     * @type {string[]}
     */
    const EVENT_TYPES = ["input", "change", "click", "submit", "focus", "blur", "keyup", "keydown"];

    /**
     * Event key mappings for modifier handling
     * @constant {Object.<string, string|string[]>}
     */
    const EVENT_KEYS = {
        "enter": "Enter",
        "escape": "Escape",
        "esc": "Escape",
        "space": " ",
        "tab": "Tab",
        "delete": ["Delete", "Backspace"],
        "del": ["Delete", "Backspace"],
        "up": "ArrowUp",
        "down": "ArrowDown",
        "left": "ArrowLeft",
        "right": "ArrowRight"
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
         * Creates a new scope object that inherits from the given parent scope
         * and optionally extends it with local variables and context metadata.
         * @param {string} contextType - The type of context being created ('foreach', 'component', etc.)
         * @param {Object|null} parentScope - The parent scope to inherit from.
         * @param {Object<string, any>} [localVars] - An object containing local variables
         * @returns {Object} The newly created scope object with context metadata
         */
        createScopedContext(contextType, parentScope, localVars) {
            // Parameter validity
            if (!localVars && !contextType) {
                return parentScope;
            }

            // Create new scope
            const scope = Object.create(parentScope || null);

            // Store context type metadata
            Object.defineProperty(scope, '_contextType', {
                value: contextType,
                writable: false,
                enumerable: false,
                configurable: false
            });

            // Add local variables if provided
            if (localVars && typeof localVars === 'object') {
                Object.assign(scope, localVars);
            }

            // Return scope
            return scope;
        },

        /**
         * Query all elements with the given selector, including the element self
         * @param element
         * @param selector
         * @returns {unknown[]}
         */
        queryElementsIncludingSelf(element, selector) {
            const descendants = Array.from(element.querySelectorAll(selector));
            return element.matches(selector) ? [element, ...descendants] : descendants;
        },

        /**
         * Determines if a value should be made reactive using Proxy mechanism
         * Simple values (primitives) are handled separately and don't need Proxy
         * @param {*} value - Value to test
         * @returns {boolean} True if value should be proxied for deep reactivity
         */
        isReactive(value) {
            if (!value || typeof value !== 'object') {
                return false;
            }

            if (this.isPlainObject(value)) {
                return true;
            }

            return Array.isArray(value);
        },

        /**
         * Check if the property should be reactive
         * @param {string} propertyName - Name of the property
         * @param {*} value - Value to test
         * @returns {boolean} True if property should be reactive
         */
        shouldReact(propertyName, value) {
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

            if (Number.isNaN(a) && Number.isNaN(b)) {
                return true;
            }

            if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
                return false;
            }

            if (Array.isArray(a)) {
                return Array.isArray(b) &&
                    a.length === b.length &&
                    a.every((item, i) => this.isEqual(item, b[i]));
            }

            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            return keysA.length === keysB.length &&
                keysA.every(k => Object.hasOwn(b, k) && this.isEqual(a[k], b[k]));
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
         * Formats a value for display in text content
         * @param {*} value - Value to format
         * @returns {string} Formatted string
         */
        formatValue(value) {
            return value !== null ? String(value) : '';
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
        },

        /**
         * Converts a DOMRect object to a plain JavaScript object
         * @param {DOMRect} domRect - The DOMRect object to convert
         * @returns {Object} Plain object containing all DOMRect properties
         */
        domRectToSimpleObject(domRect) {
            return {
                // Position relative to viewport
                top: domRect.top,           // Distance from top of viewport
                left: domRect.left,         // Distance from left of viewport
                right: domRect.right,       // Distance from left of viewport to right edge
                bottom: domRect.bottom,     // Distance from top of viewport to bottom edge

                // Dimensions
                width: domRect.width,       // Width of the element
                height: domRect.height,     // Height of the element

                // Alternative position properties (aliases)
                x: domRect.x,               // Same as left, but included for DOMRect compatibility
                y: domRect.y                // Same as top, but included for DOMRect compatibility
            };
        },

        /**
         * Collects all text nodes within a given DOM element using TreeWalker
         * @param {Element} element - The DOM element to traverse for text nodes
         * @returns {Text[]} Array of all text nodes found within the element
         */
        getTextNodesFromElement(element) {
            // Create a tree walker to traverse all text nodes in the element
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

            // Collect all text nodes first to avoid modifying the tree while traversing
            const textNodes = [];

            // Walk through each text node and add it to our collection
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }

            // Return the text nodes
            return textNodes;
        },

        /**
         * Checks if an element is at least partially visible in the viewport
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if element intersects with viewport
         */
        isElementVisible(element) {
            const rect = element.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            const viewWidth = window.innerWidth;

            return (
                rect.top < viewHeight &&
                rect.bottom > 0 &&
                rect.left < viewWidth &&
                rect.right > 0
            );
        },

        /**
         * Checks if an element is completely visible in the viewport
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if entire element is within viewport bounds
         */
        isElementFullyVisible(element) {
            const rect = element.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            const viewWidth = window.innerWidth;

            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= viewHeight &&
                rect.right <= viewWidth
            );
        },

        /**
         * Checks if an element has direct focus (is the activeElement)
         * @param {HTMLElement} element - The element to check
         * @returns {boolean} True if the element is currently focused
         */
        isElementDirectlyFocused(element) {
            return element === document.activeElement;
        },

        /**
         * Checks if an element or any of its descendants has focus
         * @param {HTMLElement} element - The container element to check
         * @returns {boolean} True if focus is within the element's boundaries
         */
        isElementFocusWithin(element) {
            return element === document.activeElement ||
                element.contains(document.activeElement);
        },

        /**
         * Gets the global position of an element within the document
         * @param {string|Element} elementOrId - Element ID (with or without #) or DOM element
         * @returns {Object|null} Object with x, y properties, or null if not found
         */
        getElementPosition(elementOrId) {
            let element;

            // Handle different input types
            if (typeof elementOrId === 'string') {
                // Remove # prefix if present
                const id = elementOrId.startsWith('#') ? elementOrId.slice(1) : elementOrId;
                element = document.getElementById(id);
            } else if (elementOrId && elementOrId.nodeType === Node.ELEMENT_NODE) {
                element = elementOrId;
            } else {
                return null;
            }

            if (!element) {
                return null;
            }

            // Get bounding rect relative to viewport
            const rect = element.getBoundingClientRect();

            // Add current scroll position to get global document coordinates
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

            return {
                x: rect.left + scrollX,
                y: rect.top + scrollY
            };
        },

        /**
         * Detects current network quality by measuring response time
         * to a small test resource.
         */
        detectNetworkQuality() {
            if (!navigator.onLine) {
                return 'offline';
            }

            // Use Network Information API when available (Chrome, Edge, mobile browsers)
            if ('connection' in navigator && navigator.connection?.effectiveType) {
                switch (navigator.connection.effectiveType) {
                    case 'slow-2g':
                    case '2g':
                    case '3g':
                        return 'slow';

                    default:
                        return 'fast';
                }
            }

            // Default when navigator.connection.effectiveType is not available
            return 'fast';
        }
    };

    // =============================================================================
    // Unified Property Path Utility
    // =============================================================================

    const PropertyPath = {

        /**
         * Safely resolves a nested property path
         * @param {Object} context - Object to traverse
         * @param {string} path - Property path
         * @returns {*} Resolved value or undefined
         */
        get(context, path) {
            if (context == null) {
                return undefined;
            }

            const parts = Array.isArray(path) ? path : String(path).split('.');

            let current = context;
            for (const segment of parts) {
                if (current == null) {
                    return undefined;
                }

                current = (segment in current) ? current[segment] : undefined;
            }

            return current;
        },

        /**
         * Sets a nested property value using dot notation, with prototype-chain awareness.
         * Reads always see inherited values, but writes go to the nearest owner
         * in the chain or fall back to the base parent object.
         * @param {Object} control - Object containing the abstraction and dependencies
         * @param {string} propertyPath - Dot-separated path (e.g. "activeTab.sampleInput")
         * @param {*} value - Value to assign
         * @returns {boolean} True if assignment succeeded, false otherwise
         */
        set(control, propertyPath, value) {
            // Validate input path
            if (typeof propertyPath !== 'string' || propertyPath.length === 0) {
                return false;
            }

            // Split into parts and separate the final property key
            const parts = propertyPath.split('.');
            const key = parts.pop();
            const parentPath = parts.join('.');

            // Resolve the parent object using chain-aware get()
            const parent = parts.length
                ? PropertyPath.get(control.abstraction, parentPath)
                : control.abstraction;

            if (parent == null) {
                return false;
            }

            // Walk up the prototype chain to find the closest object that *owns* this key
            let target = parent;
            while (target && !Object.prototype.hasOwnProperty.call(target, key)) {
                target = Object.getPrototypeOf(target);
            }

            // If no owner found, write directly on the resolved parent
            if (!target) {
                target = parent;
            }

            // Save old value for change detection
            const oldValue = target[key];

            // Assign new value
            target[key] = value;

            // Fire change notifications if value actually changed
            this.triggerChangeIfNeeded(control, propertyPath, value, oldValue);

            return true;
        },

        /**
         * Triggers change notification if the property is computed
         * @param {Object} control - The control object
         * @param {string} propertyPath - Full property path
         * @param {*} newValue - New value that was set
         * @param {*} oldValue - Previous value
         */
        triggerChangeIfNeeded(control, propertyPath, newValue, oldValue) {
            const rootProperty = propertyPath.split('.')[0];
            const isComputedProperty = control.deps?.has(rootProperty) && control.deps.get(rootProperty)?.fn;

            if (isComputedProperty) {
                control.notifyChange(propertyPath, newValue, 'nested-set', {
                    oldValue,
                    nestedPath: propertyPath,
                    newValue
                });
            }
        },

        /**
         * Checks if a target expression represents a nested property that should use foreach variables.
         * @param {string} target - The binding target expression to check (e.g., "item.completed", "user.name")
         * @param {Object} foreachVars - Object containing all available foreach variables from current and parent scopes
         * @returns {boolean} True if the target starts with a foreach variable name, false otherwise
         */
        isNested(target, foreachVars) {
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
            for (const [varName] of Object.entries(foreachVars)) {
                if (target.startsWith(`${varName}.`)) {
                    const propertyPath = target.substring(varName.length + 1);
                    return collectionName + '.' + index + '.' + propertyPath;
                }
            }

            return target;
        }
    }

    // =============================================================================
    // DEPENDENCY TRACKING
    // =============================================================================

    /**
     * A utility class for tracking property dependencies during function execution.
     * Uses Proxy objects to monitor which properties are accessed during evaluation,
     * enabling reactive programming patterns and dependency-aware caching.
     * @class DependencyTracker
     */
    function DependencyTracker() {
        /**
         * Creates a new DependencyTracker instance.
         * Initializes the evaluation stack and current dependencies tracker.
         * @constructor
         */
        this.evaluationStack = [];
        this.currentDependencies = null;
    }

    /**
     * Tracks property dependencies during function execution.
     * Wraps the provided context in a Proxy to monitor property access,
     * then executes the function and returns both result and dependencies.
     * @param {Function} fn - The function to execute and track dependencies for
     * @param {Object} context - The context object to proxy and bind as 'this'
     * @returns {{result: any, dependencies: string[]}} Object containing function result and tracked dependencies
     */
    DependencyTracker.prototype.track = function (fn, context) {
        // Create new dependency set for this tracking session
        const dependencies = new Set();

        // Push to stack and set as current tracker
        this.evaluationStack.push(dependencies);
        this.currentDependencies = dependencies;

        try {
            // Create tracking proxy and execute function
            const trackedContext = this.createTrackingProxy(context);
            const result = fn.call(trackedContext);

            return {
                result: result,
                dependencies: Array.from(dependencies)
            };
        } finally {
            // Clean up: pop from stack and restore previous tracker
            this.evaluationStack.pop();
            this.currentDependencies = this.evaluationStack[this.evaluationStack.length - 1] || null;
        }
    };

    /**
     * Creates a tracking proxy that intercepts property access to automatically discover dependencies
     * during computed property evaluation. This proxy wraps the reactive context object and records
     * which properties are accessed, enabling precise dependency tracking without fragile string parsing.
     * @param {Object} target - The object to wrap with dependency tracking (usually the reactive abstraction)
     * @param {string} [path=''] - Current property path for nested object tracking (e.g., "user.profile")
     * @returns {Object} A proxy that intercepts property access and records dependencies
     */
    DependencyTracker.prototype.createTrackingProxy = function (target, path) {
        path = path || '';
        const self = this;

        return new Proxy(target, {
            /**
             * Intercepts property access to track dependencies and handle nested objects
             * @param {Object} obj - The target object being accessed
             * @param {string|Symbol} prop - The property being accessed
             * @returns {*} The property value, potentially wrapped in another tracking proxy
             */
            get: function (obj, prop) {
                // Skip tracking for internal JavaScript symbols
                if (typeof prop === 'symbol') {
                    return obj[prop];
                }

                // Skip tracking for internal JavaScript properties
                // These are not user-defined reactive properties and should not trigger dependency tracking
                if (!Utils.shouldReact(prop, obj[prop])) {
                    return obj[prop];
                }

                // Build the complete property path for this access
                // Root level: prop='name', path='' → fullPath='name'
                // Nested: prop='settings', path='user.profile' → fullPath='user.profile.settings'
                const fullPath = path ? path + '.' + prop : prop;

                // Record dependencies if we're currently tracking (inside computed property evaluation)
                if (self.currentDependencies) {
                    // Extract root property for compatibility with existing reactivity system
                    // Many parts of the framework expect root-level property names (e.g., 'user', 'todos')
                    const rootProperty = fullPath.split('.')[0];

                    // Record root property dependency (required for existing invalidation system)
                    self.currentDependencies.add(rootProperty);

                    // Also record the full nested path for precise change detection
                    // This allows the system to distinguish between different nested property changes
                    // Example: 'user.profile.name' vs 'user.settings.theme' are tracked separately
                    if (fullPath !== rootProperty) {
                        self.currentDependencies.add(fullPath);
                    }
                }

                // Get the actual property value from the target object
                const value = obj[prop];

                // Handle nested object access by creating recursive tracking proxies
                // Only wrap plain objects and arrays - skip primitives, DOM elements, and custom classes
                if (Utils.isReactive(value)) {
                    // Create a new tracking proxy for the nested object with extended path
                    // This enables deep dependency tracking: user.profile.settings.theme
                    return self.createTrackingProxy(value, fullPath);
                }

                // Return primitive values directly (strings, numbers, booleans, null, undefined)
                return value;
            }
        });
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
        // Return target unchanged when it's not reactive
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

        return new Proxy(target, {
            get: createProxyGetter(isArray, originalMethods, arrayMutationHandler),
            set: createProxySetter(onChange, path),
            deleteProperty: createProxyDeleter(onChange, path)
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
            if (Object.prototype.hasOwnProperty.call(target, key) && Utils.isReactive(target[key])) {
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
     * @param {Array} arr - The reactive array being monitored
     * @param {Object} originalMethods - Reference to the original Array.prototype methods
     * @param {Function} onChange - Callback function to invoke when array mutations occur
     * @param {string} path - The path of this array in the nested reactive structure
     * @returns {Function} A handler function that creates wrapped mutation methods
     */
    function createArrayMutationHandler(arr, originalMethods, onChange, path) {
        return function (prop) {
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
        return function (obj, prop) {
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
        return function (obj, prop, value) {
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
                const propertyPath = path ? path + '.' + prop : prop;

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
        return function (obj, prop) {
            // Store the value being deleted for the change notification
            const oldValue = obj[prop];

            // Perform the actual deletion on the target object
            delete obj[prop];

            // Build the full property path for nested objects
            // If path exists, append the property with a dot separator
            // Otherwise, use just the property name for root-level properties
            const propertyPath = path ? path + '.' + prop : prop;

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
                return Object.assign({}, expression, {dependencies});
            }

            // Remove whitespace around expression
            expression = String(expression).trim();

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

        lookupInScopeChain(ctx, name) {
            let cur = ctx;

            while (cur && cur !== Object.prototype) {
                if (Object.prototype.hasOwnProperty.call(cur, name)) {
                    return cur[name];
                }

                cur = Object.getPrototypeOf(cur);
            }

            return undefined;
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
                    return PropertyPath.get(context, parsedExpr.path);

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

        /**
         * Evaluates object literal from AST
         * @param {Object} objectExpr - Object expression AST
         * @param {Object} context - Evaluation context
         * @returns {Object} Evaluated object
         */
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
                // Setup bindings
                this.setupTextBindings();
                this.setupAttributeBindings();
                this.buildBindingIndex();

                // Creates the reactive abstraction object with computed properties
                this.abstraction = this.createReactiveAbstraction();

                // Sets up event handling with delegation
                this.setupEventHandling();
                this.setupIntersectionObserver();
                this.updateContainerVisibility();

                // Read all binds and set there initial values
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

                // Add hierarchy properties as reactive
                this.createReactiveProperty(reactive, 'childrenCount', 0);
                this.createReactiveProperty(reactive, 'hasParent', false);

                // Set up regular properties by iterating through the original object
                Object.keys(this.original).forEach(key => {
                    // Only process own properties, skip inherited ones and the 'computed' key
                    // which was already handled by setupComputedProperties
                    if (Object.prototype.hasOwnProperty.call(this.original, key) && key !== 'computed') {
                        // Read value
                        const value = this.original[key];

                        // Handle different property types appropriately
                        if (typeof value === 'function') {
                            // Bind functions to the reactive object so 'this' refers to reactive
                            // This ensures methods can access other reactive properties
                            reactive[key] = value.bind(reactive);
                        } else if (!Utils.shouldReact(key, value)) {
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
                    /**
                     * Sends a notification to the parent component
                     * @param {string} type - Type of notification
                     * @param {*} data - Data to send with the notification
                     */
                    notifyParent: (type, data) => this.notifyParent(type, data),

                    /**
                     * Sends a command to all child components
                     * @param {string} cmd - Command to send
                     * @param {*} data - Data to send with the command
                     */
                    notifyChildren: (cmd, data) => this.notifyChildren(cmd, data),

                    /**
                     * Sends a command to a specific child component
                     * @param {string|Function} selector - Selector to find the target child
                     * @param {string} cmd - Command to send
                     * @param {*} data - Data to send with the command
                     */
                    notifyChild: (selector, cmd, data) => this.notifyChild(selector, cmd, data),

                    /**
                     * Serializing the reactive object to JSON (excluding non-serializable properties)
                     * @returns {{}}
                     */
                    toJSON: () => this.serializeToJSON(),

                    /**
                     * Makes an HTTP request with PAC-specific headers and handling
                     * @param {string} url - URL to request
                     * @param {Object} opts - Request options
                     * @returns {Promise} Promise that resolves with response data
                     */
                    control: (url, opts = {}) => this.makeHttpRequest(url, opts),

                    /**
                     * Reads DOM state from a specific element and stores it in a data model property
                     * @param {string} elementSelector - CSS selector or ID to find the element
                     * @returns {boolean|boolean|*|string|string}
                     */
                    readDOMValue: (elementSelector) => control.readDOMValue(elementSelector),

                    /**
                     * Sets a value to a DOM element (input, select, textarea, etc.)
                     * @param {string|Element} elementOrSelector - CSS selector, ID selector, or DOM element reference
                     * @param {string|boolean} value - The value to set (string for most inputs, boolean for checkboxes)
                     * @returns {boolean} True if value was set successfully, false otherwise
                     */
                    writeDOMValue: (elementOrSelector, value) => control.writeDOMValue(elementOrSelector, value),

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
                     * Gets the global position of an element within the document
                     * @param {string|Element} elementOrId - Element ID or DOM element
                     * @returns {Object|null} Position object with x, y properties or null if not found
                     */
                    getElementPosition: (elementOrId) => Utils.getElementPosition(elementOrId)
                });

                // Return the fully configured reactive object
                return reactive;
            },

            /**
             * Sets up computed properties with consolidated dependency tracking
             */
            setupComputedProperties(reactive) {
                if (!this.original.computed) {
                    return;
                }

                // Create dependency tracker instance
                const tracker = new DependencyTracker();

                Object.keys(this.original.computed).forEach(name => {
                    const computedFn = this.original.computed[name];

                    // Store computed info
                    this.deps.set(name, {
                        fn: computedFn,
                        value: undefined,
                        isDirty: true,
                        dependencies: [] // Will be populated by proxy tracking
                    });

                    Object.defineProperty(reactive, name, {
                        get: () => {
                            const entry = this.deps.get(name);

                            if (entry.isDirty || entry.value === undefined) {
                                // Use proxy tracking to discover dependencies
                                const {result, dependencies} = tracker.track(computedFn, reactive);

                                entry.value = result;
                                entry.isDirty = false;
                                entry.dependencies = dependencies;

                                // Update reverse dependency mappings
                                this.updateReverseDependencies(name, dependencies);
                            }
                            return entry.value;
                        },
                        enumerable: true
                    });
                });
            },

            /**
             * Updates the reverse dependency mapping by registering a computed property
             * as a dependent of the specified dependencies.
             * @param {string} computedName - The name of the computed property that depends on the dependencies
             * @param {string[]} dependencies - Array of dependency names that the computed property relies on
             * @returns {void}
             */
            updateReverseDependencies(computedName, dependencies) {
                dependencies.forEach(dep => {
                    if (!this.deps.has(dep)) {
                        this.deps.set(dep, {dependents: []});
                    }

                    const entry = this.deps.get(dep);
                    entry.dependents = entry.dependents || [];

                    if (!entry.dependents.includes(computedName)) {
                        entry.dependents.push(computedName);
                    }
                });
            },

            /**
             * Initializes reactive browser state properties for a component
             * These properties automatically update when browser events occur (scroll, resize, visibility change)
             * @param {Object} reactive - The reactive object to attach browser properties to
             */
            setupBrowserProperties(reactive) {
                const props = {
                    // Initialize online/offline state and network quality
                    browserOnline: navigator.onLine,
                    browserNetworkQuality: Utils.detectNetworkQuality(),

                    // Initialize page visibility state - tracks if the browser tab/window is currently visible
                    // Useful for pausing animations or reducing CPU usage when user switches tabs
                    browserVisible: !document.hidden,

                    // Initialize current horizontal/vertical scroll position in pixels from left/top of document
                    browserScrollX: window.scrollX,
                    browserScrollY: window.scrollY,

                    // Initialize current viewport width & height - the visible area of the browser window
                    // Updates automatically when user resizes window or rotates mobile device
                    browserViewportHeight: window.innerHeight,
                    browserViewportWidth: window.innerWidth,

                    // Initialize total document width/height including content outside the viewport
                    // Useful for calculating scroll percentages or infinite scroll triggers
                    browserDocumentWidth: document.documentElement.scrollWidth,
                    browserDocumentHeight: document.documentElement.scrollHeight,

                    // Container scroll properties
                    containerIsScrollable: false,                                // Can scroll in any direction
                    containerScrollX: this.container.scrollLeft,                 // Current horizontal scroll position
                    containerScrollY: this.container.scrollTop,                  // Current vertical scroll position
                    containerScrollContentWidth: this.container.scrollWidth,     // Total scrollable content width
                    containerScrollContentHeight: this.container.scrollHeight,   // Total scrollable content height
                    containerScrollWindow: {
                        top: 0,        // scrollTop
                        left: 0,       // scrollLeft
                        right: 0,      // scrollWidth
                        bottom: 0,     // scrollHeight
                        x: 0,          // scrollLeft (alias)
                        y: 0           // scrollTop (alias)
                    },

                    // Per-container viewport visibility properties
                    containerFocus: Utils.isElementDirectlyFocused(this.container),
                    containerFocusWithin: Utils.isElementFocusWithin(this.container),
                    containerVisible: Utils.isElementVisible(this.container),
                    containerFullyVisible: Utils.isElementFullyVisible(this.container),
                    containerClientRect: {top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0},
                    containerWidth: this.container.clientWidth,
                    containerHeight: this.container.clientHeight
                };

                // Create reactive properties for all properties
                Object.entries(props).forEach(([k, v]) => this.createReactiveProperty(reactive, k, v));

                // Set up global event listeners to keep these properties synchronized
                // Uses singleton pattern to ensure listeners are only attached once per page
                // regardless of how many components use browser properties
                this.setupGlobalBrowserListeners();

                // Set up container-specific scroll tracking
                this.setupContainerScrollTracking();
            },

            /**
             * Sets up global browser event listeners to track and synchronize
             * browser state (visibility, scroll, resize) across all registered PAC components.
             */
            setupGlobalBrowserListeners() {
                // Prevent duplicate setup (singleton pattern)
                if (window._wakaPACBrowserListeners) {
                    return;
                }

                // Set flag to indicate that the singleton was initialized
                window._wakaPACBrowserListeners = true;

                /**
                 * Utility: Iterate over all registered PAC components (if any)
                 * and apply a given callback function.
                 * @param {Function} fn - Callback executed with each component
                 */
                const eachComponent = fn => {
                    const comps = window.PACRegistry?.components;

                    if (comps?.size) {
                        comps.forEach(fn);
                    }
                };

                /**
                 * Utility: Create a debounced version of a function
                 * that cancels previous calls until the delay passes.
                 * Timeout ID is stored on `window` to avoid leaks.
                 * @param {Function} fn - Function to debounce
                 * @param {number} delay - Delay in ms
                 * @param {string} key - Unique window property to store timeout ID
                 * @returns {Function} Debounced function
                 */
                const debounce = (fn, delay, key) => (...args) => {
                    clearTimeout(window[key]);
                    window[key] = setTimeout(() => fn(...args), delay);
                };

                // Define all event handlers
                const handlers = {
                    /**
                     * Handles online/offline events.
                     * Updates network status for each component.
                     */
                    online: () => {
                        const quality = Utils.detectNetworkQuality();
                        eachComponent(c => {
                            c.abstraction.browserOnline = true;
                            c.abstraction.browserNetworkQuality = quality;
                        });
                    },

                    offline: () => eachComponent(c => {
                        c.abstraction.browserOnline = false;
                        c.abstraction.browserNetworkQuality = 'offline';
                    }),

                    /**
                     * Handles network connection changes.
                     * Updates network quality when connection type changes.
                     */
                    connectionChange: () => {
                        const quality = Utils.detectNetworkQuality();

                        eachComponent(c => {
                            c.abstraction.browserNetworkQuality = quality;
                        });
                    },

                    /**
                     * Handles tab/window visibility changes.
                     * Updates each component's `browserVisible` state.
                     */
                    visibility: () => eachComponent(c =>
                        c.abstraction.browserVisible = !document.hidden
                    ),

                    /**
                     * Handles scroll events.
                     * Updates current scroll position for each component.
                     * Debounced for performance (~60fps).
                     */
                    scroll: debounce(() => eachComponent(c => {
                        c.abstraction.browserScrollX = window.scrollX;
                        c.abstraction.browserScrollY = window.scrollY;
                    }), 16, "_wakaPACScrollTimeout"),

                    /**
                     * Handles window resize events.
                     * Updates viewport/document dimensions and scroll position.
                     * Debounced for performance (fires after resizing stops).
                     */
                    resize: debounce(() => eachComponent(c => {
                        Object.assign(c.abstraction, {
                            browserViewportWidth: window.innerWidth,
                            browserViewportHeight: window.innerHeight,
                            browserDocumentWidth: document.documentElement.scrollWidth,
                            browserDocumentHeight: document.documentElement.scrollHeight,
                            browserScrollX: window.scrollX,
                            browserScrollY: window.scrollY
                        });

                        // Update container dimensions on resize
                        c.updateContainerVisibility();
                    }), 100, "_wakaPACResizeTimeout"),

                    /**
                     * Handles global message processing for components with eventProc
                     */
                    keyboard_message: (event) => {
                        this.dispatchEventToEventProc(event, {
                            type: event.type === 'keydown' ? 'EVENT_KEYDOWN' : 'EVENT_KEYUP',
                            wParam: event.keyCode,
                            lParam: 0,
                            key: event.key,
                            ctrlKey: event.ctrlKey,
                            altKey: event.altKey,
                            shiftKey: event.shiftKey,
                            target: event.target,
                            originalEvent: event
                        });
                    },

                    /**
                     * Handles global mouse events for components with eventProc
                     */
                    mouse_message: (event) => {
                        requestAnimationFrame(() => {
                            // Dispatch mouse event to eventProc
                            // Determine mouse event type
                            let msgType;

                            if (event.type === 'mousedown') {
                                if (event.button === 0) {
                                    msgType = 'EVENT_LBUTTONDOWN';
                                } else if (event.button === 1) {
                                    msgType = 'EVENT_MBUTTONDOWN';
                                } else if (event.button === 2) {
                                    msgType = 'EVENT_RBUTTONDOWN';
                                }
                            } else if (event.type === 'mouseup') {
                                if (event.button === 0) {
                                    msgType = 'EVENT_LBUTTONUP';
                                } else if (event.button === 1) {
                                    msgType = 'EVENT_MBUTTONUP';
                                } else if (event.button === 2) {
                                    msgType = 'EVENT_RBUTTONUP';
                                }
                            }

                            this.dispatchEventToEventProc(event, {
                                type: msgType, // etc
                                wParam: event.button,  // 0=left, 1=middle, 2=right
                                lParam: (event.clientY << 16) | event.clientX,  // Win32-style coordinates
                                clientX: event.clientX,
                                clientY: event.clientY,
                                ctrlKey: event.ctrlKey,
                                altKey: event.altKey,
                                shiftKey: event.shiftKey,
                                target: event.target,
                                originalEvent: event
                            });
                        });
                    },

                    focusin_message: (event) => {
                        eachComponent(component => {
                            if (component.container.contains(event.target) || component.container === event.target) {
                                component.abstraction.containerFocus = Utils.isElementDirectlyFocused(component.container);
                                component.abstraction.containerFocusWithin = Utils.isElementFocusWithin(component.container);
                            }
                        });
                    },

                    focusout_message: (event) => {
                        eachComponent(component => {
                            if (component.container.contains(event.target) || component.container === event.target) {
                                component.abstraction.containerFocus = Utils.isElementDirectlyFocused(component.container);
                                component.abstraction.containerFocusWithin = component.container.contains(event.relatedTarget);
                            }
                        });
                    }
                };

                // Store handlers globally for potential cleanup
                window._wakaPACGlobalHandlers = handlers;

                // Attach event listeners
                document.addEventListener('visibilitychange', handlers.visibility);
                document.addEventListener('keydown', handlers.keyboard_message, true);
                document.addEventListener('keyup', handlers.keyboard_message, true);
                document.addEventListener('mousedown', handlers.mouse_message, true);
                document.addEventListener('mouseup', handlers.mouse_message, true);
                document.addEventListener('focusin', handlers.focusin_message, true);
                document.addEventListener('focusout', handlers.focusout_message, true);
                window.addEventListener('online', handlers.online);
                window.addEventListener('offline', handlers.offline);
                window.addEventListener('scroll', handlers.scroll);
                window.addEventListener('resize', handlers.resize);

                // Add connection change listener if supported
                if ('connection' in navigator && navigator.connection) {
                    navigator.connection.addEventListener('change', handlers.connectionChange);
                }
            },

            /**
             * Sets up scroll event tracking for the container element with debounced handling.
             * Creates an optimized scroll listener that updates container scroll state at ~60fps
             * to prevent performance issues during rapid scroll events.
             * @memberof {Object} - The parent class/object containing this method
             * @method setupContainerScrollTracking
             * @returns {void}
             */
            setupContainerScrollTracking() {
                // First time setup
                requestAnimationFrame(() => this.updateContainerScrollState());

                // Create debounced scroll handler for this container
                const debouncedScrollHandler = this.debounce(() => {
                    this.updateContainerScrollState();
                }, 16); // ~60fps

                // Add scroll listener to this container
                this.container.addEventListener('scroll', debouncedScrollHandler, { passive: true });

                // Store reference for cleanup
                this.containerScrollHandler = debouncedScrollHandler;
            },

            // Add new method to update container scroll state
            updateContainerScrollState() {
                // Get scroll measurements
                const scrollX = this.container.scrollLeft;
                const scrollY = this.container.scrollTop;
                const clientWidth = this.container.clientWidth;
                const clientHeight = this.container.clientHeight;
                const scrollContentWidth = this.container.scrollWidth;
                const scrollContentHeight = this.container.scrollHeight;

                // Calculate scrollable state (use existing containerWidth/Height for visible dimensions)
                const isScrollable =
                    scrollContentWidth > this.abstraction.containerWidth ||
                    scrollContentHeight > this.abstraction.containerHeight;

                // Update individual properties
                this.abstraction.containerScrollX = scrollX;
                this.abstraction.containerScrollY = scrollY;
                this.abstraction.containerScrollContentWidth = scrollContentWidth;
                this.abstraction.containerScrollContentHeight = scrollContentHeight;
                this.abstraction.containerIsScrollable = isScrollable;

                // Update scroll window object
                Object.assign(this.abstraction.containerScrollWindow, {
                    top: scrollY,
                    left: scrollX,
                    right: scrollX + clientWidth,
                    bottom: scrollY + clientHeight,
                    x: scrollX,
                    y: scrollY
                });
            },

            // Add debounce utility method
            debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },

            /**
             * Dispatch an event to eventProc
             * @param event
             * @param message
             */
            dispatchEventToEventProc(event, message) {
                const comps = window.PACRegistry?.components;

                if (comps?.size) {
                    comps.forEach(component => {
                        if (
                            component.original.eventProc &&
                            typeof component.original.eventProc === 'function' &&
                            component.container.contains(event.target)
                        ) {
                            try {
                                if (component.original.eventProc.call(component.abstraction, message)) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                }
                            } catch (error) {
                                console.error('Error in eventProc method:', error);
                            }
                        }
                    });
                }
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
                            this.abstraction.containerClientRect = Utils.domRectToSimpleObject(rect);
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
                // Get current state using Utils
                const rect = Utils.domRectToSimpleObject(this.container.getBoundingClientRect());

                // Set dimensions
                this.abstraction.containerClientRect = rect;
                this.abstraction.containerWidth = rect.width;
                this.abstraction.containerHeight = rect.height;

                // Use Utils for consistent visibility calculation
                this.abstraction.containerVisible = Utils.isElementVisible(this.container);
                this.abstraction.containerFullyVisible = Utils.isElementFullyVisible(this.container);
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
                        // Special handling for scroll properties
                        if (key === 'containerScrollX' && this.container) {
                            this.container.scrollLeft = newValue;
                        } else if (key === 'containerScrollY' && this.container) {
                            this.container.scrollTop = newValue;
                        } else if (key === 'browserScrollX') {
                            window.scrollTo(newValue, window.scrollY);
                        } else if (key === 'browserScrollY') {
                            window.scrollTo(window.scrollX, newValue);
                        }

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
                // Guard missing abstraction
                if (!this.abstraction || !this.original.watch) {
                    return;
                }

                // 1. Handle existing simple property watchers (backward compatibility)
                if (this.original.watch[property]) {
                    try {
                        this.original.watch[property].call(this.abstraction, newValue, oldValue);
                    } catch (error) {
                        console.error('Error in watcher for \'' + property + '\':', error);
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
                                    console.error('Error in deep watcher for \'' + watchKey + '\':', error);
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
             * Finds and creates text interpolation bindings {{property}}
             */
            setupTextBindings() {
                // Single pass to collect all text nodes
                const textNodes = Utils.getTextNodesFromElement(this.container);

                // Process collected nodes
                textNodes.forEach(node => {
                    const text = node.textContent;
                    const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

                    if (matches) {
                        matches.forEach((match) => {
                            const binding = this.createBinding('text', node, {
                                target: match.replace(/^\{\{\s*|\s*}}$/g, '').trim(),
                                originalText: text,
                                fullMatch: match,
                                parsedExpression: null,
                                dependencies: null
                            });

                            this.bindings.set(binding.id, binding);
                        });
                    }
                });
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
                    const bindingPairs = ExpressionParser.parseBindingString(bindingString);

                    // Automatically reorder bindings: foreach first, then others
                    const reorderedBindings = this.reorderBindings(bindingPairs);

                    // Process each binding pair in the correct order
                    reorderedBindings.forEach(({type, target}) => {
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
             * Creates a mapping from property names to the bindings that depend on them
             * @returns {void}
             */
            buildBindingIndex() {
                // Clear existing index to rebuild from scratch
                this.bindingIndex.clear();

                this.bindings.forEach((binding) => {
                    // Skip bindings without targets - they have no dependencies to track
                    if (!binding.target) {
                        return;
                    }

                    // Parse the binding expression to extract its dependencies
                    binding.parsedExpression = ExpressionParser.parseExpression(binding.target);
                    let dependencies = binding.parsedExpression.dependencies || [];

                    // Templates can reference properties that aren't in the main expression
                    if (binding.type === 'foreach' && binding.template) {
                        // Extract the dependencies
                        const templateDeps = this.extractCombinedTemplateDependencies(binding.template);

                        // Merge with existing dependencies, removing duplicates
                        dependencies = [...new Set([...dependencies, ...templateDeps])];
                    }

                    // Index each dependency - create reverse mapping from property to bindings
                    dependencies.forEach((dep) => {
                        // Initialize set for this property if it doesn't exist
                        if (!this.bindingIndex.has(dep)) {
                            this.bindingIndex.set(dep, new Set());
                        }

                        // Add this binding to the set of bindings that depend on this property
                        this.bindingIndex.get(dep).add(binding);
                    });

                    // Store final dependencies on the binding for later use
                    binding.dependencies = dependencies;
                });
            },

            // === BINDING CREATION SECTION ===

            /**
             * Extracts dependencies from text interpolation patterns like {{property}} or {{object.property}}
             * @param {string} template - HTML template string
             * @returns {Set<string>} Set of property names referenced in text interpolations
             */
            extractTextInterpolationDependencies(template) {
                const dependencies = new Set();
                const textMatches = template.match(/\{\{\s*([^}]+)\s*\}\}/g);

                if (textMatches) {
                    textMatches.forEach(match => {
                        const expression = match.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();

                        try {
                            const parsed = ExpressionParser.parseExpression(expression);

                            if (parsed && parsed.dependencies) {
                                parsed.dependencies.forEach(dep => dependencies.add(dep));
                            }
                        } catch (error) {
                            console.warn('Could not parse template expression:', expression);
                        }
                    });
                }

                return dependencies;
            },

            /**
             * Extracts all data binding dependencies from a template string.
             * Parses data-pac-bind attributes to identify which data properties
             * the template relies on for dynamic content binding.
             * @param {string} template - HTML template string containing data-pac-bind attributes
             * @returns {Set<string>} Set of unique dependency names referenced in binding expressions
             */
            extractAttributeBindingDependencies(template) {
                // Initialize set to store unique dependency names
                const dependencies = new Set();

                // Create temporary DOM element to parse HTML template safely
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = template;

                // Find all elements that have data binding attributes
                const elementsWithBindings = Utils.queryElementsIncludingSelf(tempDiv, '[data-pac-bind]');

                // Process each element with data bindings
                elementsWithBindings.forEach(element => {
                    // Extract the binding configuration string
                    const bindingString = element.getAttribute('data-pac-bind');

                    // Skip empty or whitespace-only binding strings
                    if (bindingString && bindingString.trim()) {
                        try {
                            // Parse the binding string into target-value pairs
                            // Example: "text: user.name; visible: user.isActive" -> [{target: "text", value: "user.name"}, ...]
                            const bindingPairs = ExpressionParser.parseBindingString(bindingString);

                            // Extract dependencies from each binding pair
                            bindingPairs.forEach(({target}) => {
                                // Skip empty target expressions
                                if (target && target.trim()) {
                                    // Parse the target expression to extract variable dependencies
                                    const parsed = ExpressionParser.parseExpression(target);

                                    // Add all discovered dependencies to our set
                                    if (parsed && parsed.dependencies) {
                                        parsed.dependencies.forEach(dep => dependencies.add(dep));
                                    }
                                }
                            });
                        } catch (error) {
                            // Log parsing errors without breaking the entire process
                            console.warn('Could not parse binding string:', bindingString);
                        }
                    }
                });

                // Return the complete set of unique dependencies
                return dependencies;
            },

            /**
             * Extracts property dependencies from foreach template HTML
             * @param {string} template - HTML template string
             * @returns {string[]} Array of property names referenced in template
             */
            extractCombinedTemplateDependencies(template) {
                const textDependencies = this.extractTextInterpolationDependencies(template);
                const bindingDependencies = this.extractAttributeBindingDependencies(template);
                const allDependencies = new Set([...textDependencies, ...bindingDependencies]);

                return Array.from(allDependencies);
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
                const bindingMap = {
                    'value': () => this.createValueBinding(element, target),
                    'visible': () => this.createVisibilityBinding(element, target),
                    'checked': () => this.createCheckedBinding(element, target),
                    'class': () => this.createClassBinding(element, target),
                    'style': () => this.createStyleBinding(element, target),
                    'if': () => this.createConditionalBinding(element, target),
                    'foreach': () => this.createForeachBinding(element, target)
                };

                if (bindingMap[type]) {
                    return bindingMap[type]();
                }

                if (Utils.isEventType(type)) {
                    return this.createEventBinding(element, type, target);
                }

                return target ? this.createAttributeBinding(element, type, target) : null;
            },

            /**
             * Creates a standard binding with common default properties that most binding types share.
             * This method consolidates the repetitive pattern found across multiple binding creation methods:
             * setting target, parsedExpression to null, dependencies to null, and merging extra configuration.
             * @param {string} bindingType - The type of binding to create (e.g., 'visible', 'class', 'style', 'attribute')
             * @param {HTMLElement} element - The DOM element this binding will be attached to
             * @param {string} target - The property path or expression that this binding will watch/evaluate
             * @param {Object} [extraConfig={}] - Additional configuration properties specific to the binding type
             * @param {string} [extraConfig.attribute] - For attribute bindings, the HTML attribute name to modify
             * @param {string} [extraConfig.eventType] - For event bindings, the DOM event type to listen for
             * @param {string} [extraConfig.method] - For event bindings, the method name to call when event fires
             * @param {string} [extraConfig.updateMode] - For input bindings, when to update ('immediate', 'delayed', 'change')
             * @param {number} [extraConfig.delay] - For delayed input bindings, milliseconds to wait before updating
             * @param {HTMLElement} [extraConfig.originalParent] - For conditional bindings, parent element for restoration
             * @param {Node} [extraConfig.originalNextSibling] - For conditional bindings, sibling for proper insertion
             * @param {boolean} [extraConfig.isRendered] - For conditional bindings, current visibility state
             * @returns {Object} The created binding object with unified structure and provided configuration
             */
            createBaseBinding(bindingType, element, target, extraConfig = {}) {
                return this.createBinding(bindingType, element, {
                    target: target,
                    parsedExpression: null,  // Populated lazily during first evaluation for performance
                    dependencies: null,      // Discovered automatically when expression is first parsed
                    ...extraConfig           // Merge binding-specific configuration properties
                });
            },

            /**
             * Creates a visibility binding to show/hide elements based on data
             * @param {HTMLElement} element - The DOM element to control visibility
             * @param {string} target - The target property path that determines visibility
             * @returns {Object} The created visibility binding object
             */
            createVisibilityBinding(element, target) {
                return this.createBaseBinding('visible', element, target);
            },

            /**
             * Creates a class binding
             * @param element
             * @param target
             * @returns {{id: string, type: string, element: Element}}
             */
            createClassBinding: function (element, target) {
                return this.createBaseBinding('class', element, target);
            },

            /**
             * Creates a style binding for dynamic CSS styling
             * @param {HTMLElement} element - The DOM element to bind styles to
             * @param {string} target - The style expression or property name to bind
             * @returns {Object} The created binding object with element reference and metadata
             */
            createStyleBinding(element, target) {
                return this.createBaseBinding('style', element, target);
            },

            /**
             * Creates an attribute binding between a DOM element attribute and a target value
             * @param {Element} element - The DOM element whose attribute will be bound
             * @param {string} attributeName - The name of the attribute to bind (e.g., 'class', 'disabled', 'value')
             * @param {string} target - The target property or expression that will provide the attribute value
             * @returns {Object} The created attribute binding object with target, attribute, parsedExpression, and dependencies properties
             */
            createAttributeBinding(element, attributeName, target) {
                return this.createBaseBinding('attribute', element, target, {
                    attribute: attributeName
                });
            },

            /**
             * Creates a conditional "if" binding that renders/removes DOM elements based on data values
             * @param {HTMLElement} element - The DOM element to conditionally render
             * @param {string} target - The data property name to watch (may include '!' for negation)
             * @returns {Object} The created binding object with conditional rendering configuration
             */
            createConditionalBinding(element, target) {
                return this.createBaseBinding('conditional', element, target, {
                    placeholder: null,
                    originalParent: element.parentNode,
                    originalNextSibling: element.nextSibling,
                    isRendered: true
                });
            },

            /**
             * Creates an event binding between a DOM element and a target method
             * @param {Element} element - The DOM element to bind the event to
             * @param {string} eventType - The type of event to listen for (e.g., 'click', 'change', 'input')
             * @param {string|Function} target - The target method name or function to execute when the event occurs
             * @returns {Object} The created event binding object
             */
            createEventBinding(element, eventType, target) {
                return this.createBaseBinding('event', element, target, {
                    eventType: eventType,
                    method: target
                });
            },

            /**
             * Creates a value binding for form elements
             * @param {HTMLElement} element - The DOM element to bind
             * @param {string} target - The target property path for binding
             * @returns {Object} The created input binding object
             */
            createValueBinding(element, target) {
                // Add attributes to element
                this.setupInputElement(element, target);

                // Create an input binding
                return this.createInputBinding(element, target);
            },

            /**
             * Creates a checkbox/radio checked binding with special handling for radio buttons
             * @param {HTMLElement} element - The checkbox or radio input element
             * @param {string} target - The target property path for the checked state
             * @returns {Object} The created checked binding object
             * @throws {Warning} Logs warning if used with radio buttons (should use value binding instead)
             */
            createCheckedBinding(element, target) {
                // Creates an input value binding with configurable update behavior
                this.setupInputElement(element, target, 'checked');

                // Sets up check binding
                return this.createBaseBinding('checked', element, target, {
                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Creates an input value binding with configurable update behavior
             * @param {HTMLElement} element - The input element to bind
             * @param {string} target - The target property path for two-way binding
             * @returns {Object} The created input binding object with update configuration
             */
            createInputBinding(element, target) {
                return this.createBaseBinding('input', element, target, {
                    updateMode: element.getAttribute('data-pac-update-mode') || this.config.updateMode,
                    delay: parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay
                });
            },

            /**
             * Creates a foreach binding for rendering dynamic lists of data
             * @param {HTMLElement} element - The DOM element that will contain the rendered list
             * @param {string|Array} target - The data source (property path or array) to iterate over
             * @returns {Object} The created binding element object for further manipulation
             */
            createForeachBinding(element, target) {
                // Check if this element already has a foreach binding for this target
                // This prevents duplicate bindings which could cause rendering conflicts
                const existingBinding = Array.from(this.bindings.values())
                    .find(b =>
                        b.element === element &&         // Same DOM element
                        b.type === 'foreach' &&          // Same binding type
                        b.collection === target          // Same collection target
                    );

                // If duplicate binding exists, return existing instead of creating new
                if (existingBinding) {
                    return existingBinding;
                }

                // Capture the template BEFORE any processing
                // Extract configuration from element attributes with sensible defaults
                const itemName = element.getAttribute('data-pac-item') || 'item';    // Variable name for current item
                const indexName = element.getAttribute('data-pac-index') || 'index'; // Variable name for current index
                const template = element.innerHTML.trim();                           // Preserve original content as template

                // Create the binding object with foreach-specific properties
                const bindingElement = this.createBinding('foreach', element, {
                    target: target,          // Property path to watch for changes
                    collection: target,      // Collection to iterate over (same as target)
                    itemName: itemName,      // Template variable name for each item
                    indexName: indexName,    // Template variable name for item index
                    template: template,      // HTML template to render for each item
                    previous: []             // Cache of previous collection state for diff optimization
                });

                // Clear the element's content AFTER capturing the template
                // The original innerHTML is preserved in the template property above
                element.innerHTML = '';

                // Return the created binding for potential further configuration
                return bindingElement;
            },

            /**
             * Sets up input element attributes for binding to properties
             * This method configures an HTML element with data attributes needed for
             * property binding and automatic updates in the PAC (Property Auto-Complete) system.
             * @param {HTMLElement} element - The DOM element to configure for binding
             * @param {string} property - The property name to bind to this element
             * @param {string} [bindingType='value'] - The type of binding ('value', 'text', 'html', etc.)
             * @returns {void}
             */
            setupInputElement(element, property, bindingType = 'value') {
                // Check if element is already bound to prevent conflicts
                const existingProperty = element.getAttribute('data-pac-property');
                const existingType = element.getAttribute('data-pac-binding-type');

                if (existingProperty || existingType) {
                    console.warn(`Element already has PAC binding: ${existingProperty}:${existingType}. Skipping new binding: ${property}:${bindingType}`);
                    return;
                }

                const attrs = {
                    'data-pac-property': property,
                    'data-pac-binding-type': bindingType,
                    'data-pac-update-mode': element.getAttribute('data-pac-update') || this.config.updateMode,
                    'data-pac-update-delay': element.getAttribute('data-pac-delay') || this.config.delay
                };

                Object.entries(attrs).forEach(([k,v]) => element.setAttribute(k, v));
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
             * Processes all pending DOM updates in a single batch.
             *
             *  1. Collects all bindings that need updating (from both parsed and unparsed sources).
             *  2. Ensures unparsed bindings are parsed before being updated.
             *  3. Executes all updates in a single pass.
             *  4. Resets pending state after completion.
             *
             * @returns {void}
             */
            flushUpdates() {
                if (!this.pendingUpdates) {
                    return;
                }

                const relevantBindings = this.collectRelevantBindings();
                this.handleForeachBindingUpdates(relevantBindings);
                this.executeBindingUpdates(relevantBindings);
                this.resetPendingState();
            },

            /**
             * Collects all bindings that need updating based on pending property changes.
             * @returns {Set} Set of bindings that require updates
             */
            collectRelevantBindings() {
                const relevantBindings = new Set();

                this.pendingUpdates.forEach(property => {
                    const bindingsForProperty = this.bindingIndex.get(property) || [];

                    bindingsForProperty.forEach(binding => {
                        if (this.shouldUpdateBinding(binding, property)) {
                            relevantBindings.add(binding);
                        }
                    });
                });

                return relevantBindings;
            },

            /**
             * Forces rebuild of foreach bindings when global properties change.
             * @param {Set} relevantBindings - Set of bindings to check and potentially reset
             */
            handleForeachBindingUpdates(relevantBindings) {
                relevantBindings.forEach(binding => {
                    if (binding.type !== 'foreach') {
                        return;
                    }

                    const hasGlobalPropertyChange = Array.from(this.pendingUpdates)
                        .some(prop => prop !== binding.collection);

                    if (hasGlobalPropertyChange) {
                        binding.previous = null;
                    }
                });
            },

            /**
             * Executes updates for all collected bindings.
             * @param {Set} relevantBindings - Set of bindings to update
             */
            executeBindingUpdates(relevantBindings) {
                relevantBindings.forEach(binding => {
                    this.updateBinding(binding, null, null);
                });
            },

            /**
             * Resets the pending update state.
             * @returns {void} No return value
             */
            resetPendingState() {
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
                    if (Object.prototype.hasOwnProperty.call(this.abstraction, key) && typeof this.abstraction[key] !== 'function') {
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

            getBindingHandler(type) {
                const handlers = {
                    visible: this.applyVisibilityBinding,
                    class: this.applyClassBinding,
                    style: this.applyStyleBinding,
                    checked: this.applyInputBinding,
                    input: this.applyInputBinding,
                    value: this.applyInputBinding,
                    attribute: this.applyAttributeBinding
                };

                return handlers[type] || this.applyAttributeBinding;
            },

            /**
             * Updates a data binding by evaluating its expression and applying the result to the bound element.
             * This method serves as the central dispatcher for all binding types, handling expression evaluation
             * and delegating to appropriate specialized binding handlers.
             * @param {Object} binding - The binding configuration object
             * @param {string} binding.type - The type of binding (text, foreach, event, attribute, input, checked, visible, conditional, class, style)
             * @param {HTMLElement} binding.element - The DOM element this binding is attached to
             * @param {string} [binding.attribute] - The attribute name (for attribute bindings)
             * @param {string} [binding.target] - The target property name (for class/style bindings)
             * @param {string|Object} binding.expression - The expression to evaluate or parsed expression object
             * @param {string} property - The property name that triggered this update (used for change tracking)
             * @param {Object|null} [foreachVars=null] - Additional variables from foreach loop context
             * @throws {Error} Logs errors to console if binding evaluation or application fails
             */
            updateBinding(binding, property, foreachVars = null) {
                try {
                    // Handler lookup table for all binding types
                    const handlers = {
                        // Special handlers that don't need context evaluation
                        text: () => this.applyTextBinding(binding, property, foreachVars),
                        foreach: () => this.applyForeachBinding(binding, property, foreachVars),
                        event: () => {},

                        // Default handlers that need context evaluation
                        attribute: (ctx, val) => this.applyAttributeBinding(binding, val),
                        input: (ctx, val) => this.applyInputBinding(binding, val),
                        checked: (ctx, val) => this.applyInputBinding(binding, val),
                        visible: (ctx, val) => this.applyVisibilityBinding(binding, val),
                        conditional: (ctx, val) => this.applyConditionalBinding(binding, val),
                        class: (ctx, val) => this.applyClassBinding(binding, val),
                        style: (ctx, val) => this.applyStyleBinding(binding, val)
                    };

                    // Get the appropriate handler for this binding type
                    const handler = handlers[binding.type];

                    // Skip unknown binding types silently
                    if (!handler) {
                        return;
                    }

                    // Special cases that manage their own expression evaluation and context
                    if (binding.type === 'text' || binding.type === 'foreach' || binding.type === 'event') {
                        handler();
                        return;
                    }

                    // Default case: evaluate expression and apply result
                    const context = Object.assign({}, this.abstraction, foreachVars || {});
                    const parsed = ExpressionParser.parseExpression(binding.target);

                    handler(context, ExpressionParser.evaluate(parsed, context));

                } catch (error) {
                    console.error('Error updating ' + binding.type + ' binding:', error);
                }
            },

            /**
             * Applies a binding directly without creating a binding object
             * @param {HTMLElement} element - Target element
             * @param {string} type - Binding type
             * @param {*} value - Evaluated value
             */
            updateBindingDirect(element, type, value) {
                const tempBinding = { element, type, attribute: type };

                switch (type) {
                    case 'visible':
                        this.applyVisibilityBinding(tempBinding, value);
                        break;

                    case 'class':
                        this.applyClassBinding(tempBinding, value);
                        break;

                    case 'style':
                        this.applyStyleBinding(tempBinding, value);
                        break;

                    case 'input':
                    case 'value':
                    case 'checked':
                        this.applyInputBinding(tempBinding, value);
                        break;

                    default:
                        // Attribute binding
                        tempBinding.attribute = type;
                        this.applyAttributeBinding(tempBinding, value);
                        break;
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
                const tempContainer = document.createElement('template');
                tempContainer.innerHTML = template.trim();

                // Convert NodeList to Array for easier manipulation
                const childNodes = Array.from(tempContainer.content.childNodes);

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
             * Processes text interpolation bindings for an element by creating reactive bindings
             * that update when dependencies change, even in foreach contexts
             * @param {HTMLElement} element - The DOM element to process text bindings on
             * @param {Object} contextVars - Context variables for expression evaluation
             */
            processTextBindingsForElement(element, contextVars) {
                // Collect all text nodes first to avoid modifying the tree while traversing
                const textNodes = Utils.getTextNodesFromElement(element);

                // Create evaluation context
                const context = Utils.createScopedContext('text', this.abstraction, contextVars);

                // Process each text node that contains interpolation patterns
                textNodes.forEach(textNode => {
                    // Fetch original text to replace
                    const originalText = textNode.textContent;

                    // Only process nodes that have interpolation patterns
                    if (/\{\{\s*[^}]+\s*}}/.test(originalText)) {
                        // Create a reactive text binding for this node
                        this.createReactiveTextBinding(textNode, originalText, context);
                    }
                });
            },

            /**
             * Creates a reactive text binding that updates when dependencies change
             * @param {Text} textNode - The text node to bind
             * @param {string} originalText - Original text with interpolation patterns
             * @param {Object} context - Evaluation context
             */
            createReactiveTextBinding(textNode, originalText, context) {
                // Extract dependencies from the text interpolations
                const dependencies = this.extractTextInterpolationDependencies(originalText);

                // Create a unique binding for this text node
                const binding = this.createBinding('text', textNode, {
                    target: null, // No single target, multiple interpolations
                    originalText: originalText,
                    dependencies: Array.from(dependencies)
                });

                // Store the binding
                this.bindings.set(binding.id, binding);

                // Index the binding by its dependencies
                dependencies.forEach(dep => {
                    if (!this.bindingIndex.has(dep)) {
                        this.bindingIndex.set(dep, new Set());
                    }

                    this.bindingIndex.get(dep).add(binding);
                });

                // Perform initial text replacement
                textNode.textContent = this.processTextInterpolation(originalText, context);
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
                const matches = text.match(/\{\{\s*([^}]+)\s*}}/g);

                if (matches) {
                    matches.forEach(match => {
                        const expression = match.replace(/^\{\{\s*|\s*}}$/g, '').trim();

                        try {
                            const parsed = ExpressionParser.parseExpression(expression);
                            const result = ExpressionParser.evaluate(parsed, context);
                            const formattedValue = Utils.formatValue(result);

                            // Automatically sanitize all interpolated values
                            const sanitizedValue = Utils.sanitizeUserInput(formattedValue);

                            text = text.replace(match, sanitizedValue);
                        } catch (error) {
                            console.warn('Error evaluating expression "' + expression + '":', error);
                        }
                    });
                }

                return text;
            },

            /**
             * Processes attribute bindings for a given element and its descendants.
             * @param {Element} element - The root element to process bindings for
             * @param {Object} contextVars - Additional context variables to merge with abstraction
             * @returns {void}
             */
            processElementAttributeBindings(element, contextVars ) {
                // Merge abstraction data with context variables to create evaluation context
                const context = Utils.createScopedContext('attribute', this.abstraction, contextVars);

                // Find all descendant elements with binding attributes
                const bindingElements = Utils.queryElementsIncludingSelf(element, '[data-pac-bind]');

                // Process each element that has binding attributes
                bindingElements.forEach(el => {
                    // Get the binding string from the data-pac-bind attribute
                    const bindingString = el.getAttribute('data-pac-bind');

                    // Skip elements without binding strings (defensive programming)
                    if (!bindingString) {
                        return;
                    }

                    // Parse the binding string to extract individual binding definitions
                    // Filter out 'foreach' bindings as they're handled separately
                    ExpressionParser.parseBindingString(bindingString)
                        .filter(({type}) => type !== 'foreach')
                        .forEach(({type, target}) => {
                            // Handle parent binding context if present
                            // This allows for nested binding scenarios with inherited context
                            if (this.isInForeachContext(contextVars) && this.processForeachChildBinding(el, type, target, contextVars)) {
                                return; // Skip further processing if parent context handled it
                            }

                            // Parse the target expression (e.g., "user.name" or "items[0].title")
                            const parsed = ExpressionParser.parseExpression(target);

                            // Evaluate the parsed expression against the current context
                            const value = ExpressionParser.evaluate(parsed, context);

                            // Apply the binding by updating the element's property/attribute
                            this.updateBindingDirect(el, type, value);
                        });
                });
            },

            /**
             * Processes bindings within foreach loop contexts, handling two-way data binding
             * and event delegation for dynamically generated elements
             * @param {HTMLElement} el - DOM element to bind
             * @param {string} type - Binding type ('value', 'checked', 'click', etc.)
             * @param {string} target - Property path or expression to bind to
             * @param {Object} contextVars - Loop variables (item, index, etc.)
             * @returns {boolean} Whether the binding was successfully handled
             */
            processForeachChildBinding(el, type, target, contextVars) {
                // Handle two-way binding for form controls within foreach loops
                if (type === 'value' || type === 'checked') {
                    // Create evaluation context by merging global scope with loop-specific variables
                    const context = Utils.createScopedContext('foreach', this.abstraction, contextVars);

                    // Parse and evaluate the target expression to get initial value
                    const currentValue = ExpressionParser.evaluate(ExpressionParser.parseExpression(target), context);

                    // Set the initial display value on the DOM element
                    this.updateBindingDirect(el, type, currentValue);

                    // Resolve the actual property path for bidirectional binding updates
                    // This converts relative paths (like "item.name") to absolute paths (like "users.0.name")
                    const resolvedPath = this.resolveForeachPropertyPath(target, contextVars);

                    // Establish the two-way binding connection for form input synchronization
                    this.setupInputElement(el, resolvedPath, type);

                    // Done
                    return true;
                }

                // Handle event delegation for dynamic elements
                if (Utils.isEventType(type)) {
                    // Set up event handlers with proper context binding
                    // Pass the current item and index for event handler context
                    const parentBinding = this.getParentBindingFromContext(contextVars);

                    this.handleEventBinding(
                        el, type, target,
                        contextVars[parentBinding.itemName],
                        contextVars[parentBinding.indexName]
                    );

                    return true;
                }

                // Binding type not handled by foreach-specific logic
                return false;
            },

            // === CONTEXT ===

            /**
             * Resolves relative property paths within foreach contexts to absolute paths
             * for proper data binding. Handles both nested object properties and root-level properties.
             * @param {string} target - The property path expression to resolve
             * @param {Object} contextVars - Loop context variables (item, index, etc.)
             * @returns {string} Absolute property path for data binding
             */
            resolveForeachPropertyPath(target, contextVars) {
                // Check if this is a nested property path (e.g., "item.name", "item.address.street")
                if (PropertyPath.isNested(target, contextVars)) {
                    // Get the nearest foreach context
                    const foreachContext = this.findNearestForeachContext(contextVars);
                    if (!foreachContext) {
                        return target;
                    }

                    // Extract the item and variable names from the foreach context
                    const contextKeys = Object.getOwnPropertyNames(foreachContext);
                    const localVars = contextKeys.filter(key => key !== '_contextType');

                    // Find the matching binding to get collection info
                    const binding = this.findMatchingForeachBinding(localVars);

                    if (!binding) {
                        return target;
                    }

                    // Get the actual item value and index
                    const item = foreachContext[binding.itemName];
                    const index = foreachContext[binding.indexName];

                    // Find the source array in the abstraction that contains this item
                    const sourceArray = Object.keys(this.abstraction).find(key =>
                        Array.isArray(this.abstraction[key]) && this.abstraction[key].includes(item)
                    );

                    // Build the absolute path: use found source array or fall back to binding collection
                    const collection = sourceArray || binding.collection;
                    return PropertyPath.buildNestedPropertyPath(target, contextVars, collection, index);
                }

                return target;
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
                if (property && (type === 'input' || type === 'change')) {
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

                // Extract the appropriate value based on the input type
                const value = this.readDOMValue(target);

                // Apply the update based on the configured mode
                switch (updateMode) {
                    case 'immediate':
                        // Update the data model immediately as the user types/changes the input
                        PropertyPath.set(control, property, value);
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
                            PropertyPath.set(control, property, value);
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
                if (!this.validateEventModifiers(event, modifiers)) {
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
                                console.error('Error executing event handler \'' + binding.method + '\':', error);
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
                        console.warn('Event handler "' + target + '" is not a function');
                        return;
                    }

                    // Call the method with proper context and foreach parameters
                    method.call(this.abstraction, item, index, event);
                });
            },

            /**
             * Parses event modifiers from data-pac-event attribute
             */
            parseEventModifiers(element) {
                const modifiersAttr = element.getAttribute('data-pac-event');
                return modifiersAttr ? modifiersAttr.trim().split(/\s+/).filter(m => m.length > 0) : [];
            },

            /**
             * Applies event modifiers to validate if event should trigger
             * @param {Event} event - The keyboard/mouse event to validate
             * @param {string[]} modifiers - Array of modifier strings to check against
             * @returns {boolean} - True if event matches modifiers, false otherwise
             */
            validateEventModifiers(event, modifiers) {
                let hasKeyConstraints = false;
                let keyConstraintsMet = false;

                // Iterate through each modifier
                for (const modifier of modifiers) {
                    switch (modifier.toLowerCase()) {
                        case 'prevent':
                            event.preventDefault();
                            break;

                        case 'stop':
                            event.stopPropagation();
                            break;

                        default: {
                            // Read key
                            const expectedKey = EVENT_KEYS[modifier.toLowerCase()];

                            // Skip modifiers that don't correspond to key constraints
                            if (!expectedKey) {
                                continue;
                            }

                            // Handle multiple valid keys (array format)
                            hasKeyConstraints = true;

                            if (Array.isArray(expectedKey)) {
                                if (expectedKey.includes(event.key)) {
                                    keyConstraintsMet = true;
                                }
                            } else {
                                // Handle single valid key (string format)
                                if (event.key === expectedKey) {
                                    keyConstraintsMet = true;
                                }
                            }

                            break;
                        }
                    }
                }

                // If there were key constraints, at least one must be met
                return !hasKeyConstraints || keyConstraintsMet;
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
                const key = 'delayed_' + property;

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

            // ====================================================================
            //  UNIFIED CHANGE DETECTION SECTION
            // ====================================================================

            /**
             * Central change notification hub - all property changes flow through here
             * @param propertyPath
             * @param newValue
             * @param changeType
             * @param metadata
             */
            notifyChange(propertyPath, newValue, changeType, metadata = {}) {
                // Guard against calls during initialization when abstraction is not yet set
                if (!this.abstraction) {
                    return;
                }

                // Fetch the property path
                const rootProperty = propertyPath.split('.')[0];

                // 1. Update watchers (immediate)
                this.triggerWatcher(rootProperty, newValue, metadata.oldValue, propertyPath);

                // 2. Invalidate computed properties (immediate)
                this.updateComputedProperties(rootProperty);

                // 3. Schedule DOM updates (batched)
                this.scheduleUpdate(propertyPath, newValue);

                // 4. Bubble to root if this is a nested change
                if (propertyPath !== rootProperty) {
                    this.propagateNestedChange(rootProperty, this.abstraction[rootProperty], 'nested-change', {
                        nestedPath: propertyPath,
                        newValue,
                        oldValue: metadata.oldValue
                    });
                }
            },

            /**
             * Propagates nested property changes up to the root property level.
             * When a deeply nested value changes (e.g., obj.a.b.c), this method ensures
             * that watchers and computed properties observing the root object are notified.
             * @param {string} rootProperty - The name of the root property that contains the nested change
             * @param {*} rootValue - The current value of the root property after the nested change
             * @param {string} changeType - Type of change operation ('set', 'delete', 'push', etc.)
             * @param {Object} metadata - Additional context about the change
             * @param {*} metadata.oldValue - The previous value before the change
             * @param {string} metadata.nestedPath - Dot-notation path to the nested property that changed
             * @param {*} [metadata.newValue] - The new nested value (for reference)
             * @param {number} [metadata.depth] - Nesting depth of the change
             */
            propagateNestedChange(rootProperty, rootValue, changeType, metadata) {
                // Trigger watchers for the root property when nested values change
                // This ensures parent object watchers receive notifications about deep changes
                // with context about what specifically changed within the nested structure
                this.triggerWatcher(rootProperty, rootValue, metadata.oldValue, metadata.nestedPath);

                // Recompute any derived values that depend on this root property
                // Nested changes can affect computed properties that observe the parent object
                this.updateComputedProperties(rootProperty);

                // Queue the root property for batch updates to prevent excessive re-renders
                // The scheduler will handle timing and deduplication of multiple nested changes
                this.scheduleUpdate(rootProperty, rootValue);
            },

            /**
             * Applies visibility binding to an element by showing or hiding it
             * while preserving the original display style value
             * @param {Object} binding - The binding
             * @param {boolean} value - Determines the visibility action to perform
             */
            applyVisibilityBinding(binding, value) {
                const element = binding.element;
                const shouldShow = !!value;

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
             * Applies conditional binding to show/hide DOM elements based on a boolean value.
             * This function manages the visibility of elements by replacing them with placeholder
             * comments when they should be hidden, and restoring them when they should be shown.
             * @param {Object} binding - The binding configuration object
             * @param {HTMLElement} binding.element - The DOM element to show/hide
             * @param {Comment} [binding.placeholder] - Comment node placeholder when element is hidden
             * @param {string} binding.target - Target identifier for the binding (used in placeholder text)
             * @param {boolean} binding.isRendered - Current render state of the element
             * @param {boolean} value - Whether the element should be visible (true) or hidden (false)
             * @returns {void}
             */
            applyConditionalBinding(binding, value) {
                // Early return if the value did not change - avoids unnecessary DOM manipulation
                if (binding.isRendered === value) {
                    return;
                }

                // Destructure binding properties for cleaner code
                const {element, placeholder} = binding;

                // Show the element: replace placeholder with actual element
                if (value) {
                    // Only replace if placeholder exists and has a parent node
                    placeholder?.parentNode?.replaceChild(element, placeholder);
                    // Update the rendered state to reflect that element is now visible
                    binding.isRendered = true;
                    return;
                }

                // Hide the element: create placeholder if it doesn't exist
                if (!binding.placeholder) {
                    // Create a comment node as placeholder with descriptive text for debugging
                    binding.placeholder = document.createComment('pac-if: ' + binding.target);
                }

                // Replace the visible element with the placeholder comment
                // This effectively hides the element while maintaining its position in the DOM
                element.parentNode?.replaceChild(binding.placeholder, element);

                // Update the rendered state to reflect that element is now hidden
                binding.isRendered = false;
            },

            /**
             * Apply attribute binding
             * @param {Object} binding
             * @param value
             */
            applyAttributeBinding(binding, value) {
                const element = binding.element;
                const attribute = binding.attribute;

                if (attribute === 'style') {
                    if (typeof value === 'object' && value) {
                        Object.assign(element.style, value);
                    } else {
                        element.style.cssText = value || '';
                    }
                } else if (attribute === 'enable') {
                    // Handle 'enable' as reverse of 'disabled'
                    element.toggleAttribute('disabled', !value);
                } else if (BOOLEAN_ATTRS.includes(attribute)) {
                    element.toggleAttribute(attribute, !!value);
                } else if (value != null) {
                    element.setAttribute(attribute, value);
                } else {
                    element.removeAttribute(attribute);
                }
            },

            /**
             * Apply input binding to element
             * @param {Object} binding
             * @param {*} value
             */
            applyInputBinding(binding, value) {
                const element = binding.element;
                const type = (element.getAttribute('type') || '').toLowerCase();
                const stringValue = String(value ?? '');

                if (type === 'radio') {
                    element.checked = (element.value === stringValue);
                    return;
                }

                if (type === 'checkbox') {
                    element.checked = Boolean(value);
                    return;
                }

                if ('value' in element && element.value !== stringValue) {
                    element.value = stringValue;
                }
            },

            /**
             * Enhanced applyClassBinding that handles conditional classes, boolean-based classes, and multiple classes
             * @param {Object} binding - The binding
             * @param {*} value - The evaluated expression value
             */
            applyClassBinding(binding, value) {
                // Fetch the element
                const element = binding.element;

                // Remove previously applied classes
                const previousClasses = element.dataset.pacPreviousClasses;

                if (previousClasses) {
                    previousClasses.split(' ').forEach(cls => {
                        if (cls.trim()) {
                            element.classList.remove(cls.trim());
                        }
                    });
                }

                // Determine new classes to apply
                const newClasses = this.parseClassValue(value);

                // Apply new classes and store for next time
                newClasses.forEach(cls => element.classList.add(cls));
                element.dataset.pacPreviousClasses = newClasses.join(' ');
            },

            /**
             * Applies style binding to a DOM element
             * @param {Object} binding - The binding
             * @param {Object|string} value - The style value(s) to apply
             */
            applyStyleBinding(binding, value) {
                // Fetch the element
                const element = binding.element;

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
            },

            /**
             * Applies text binding to update DOM element content with interpolated values
             * @param {Object} binding - Binding object containing element reference and original text
             * @param {string} property - The property name being bound (for potential debugging/logging)
             * @param {Object|null} contextVars - Optional additional context variables to merge
             */
            applyTextBinding(binding, property, contextVars = null) {
                // Get reference to the DOM text node that will be updated
                const textNode = binding.element;

                // Determine the evaluation context
                const context = binding.contextVars || contextVars || this.abstraction;

                // Use the shared interpolation utility to process template strings
                // This handles variable substitution within the original text template
                const newText = this.processTextInterpolation(binding.originalText, context);

                // Performance optimization: Only update DOM if text actually changed
                // Create unique cache key for this specific binding
                const cacheKey = 'text_' + binding.id;

                // Check if we've cached a previous value for this binding
                const lastValue = this.lastValues.get(cacheKey);

                // Only update the DOM if the new text differs from the cached value
                if (lastValue !== newText) {
                    // Cache the new value for future comparisons
                    this.lastValues.set(cacheKey, newText);

                    // Update the actual DOM element's text content
                    textNode.textContent = newText;
                }
            },

            /**
             * Applies foreach binding updates using a smart skip system that minimizes DOM manipulation.
             * @param {Object} binding - The foreach binding configuration object
             * @param {string} binding.collection - Name of the collection property being rendered
             * @param {string} binding.template - HTML template string for each item
             * @param {string} binding.itemName - Variable name for the current item (e.g., 'item', 'todo')
             * @param {string} binding.indexName - Variable name for the current index (e.g., 'index', 'i')
             * @param {Array} binding.previous - Previously rendered array state for change detection
             * @param {HTMLElement} binding.element - DOM container element to render items into
             * @param {string|null} property - The specific property that changed (null for force update)
             * @param {Object|null} foreachVars - Additional context variables from parent foreach loops
             * @returns {void}
             */
            applyForeachBinding(binding, property, foreachVars = null) {
                // Early exit: Only update if this binding matches the changed property OR if property is null (force update)
                if (property && binding.collection !== property) {
                    return;
                }

                // Ensure we have a valid template to work with
                binding = this.findBindingWithTemplate(binding);

                if (!binding) {
                    return;
                }

                // Fetch container
                const container = binding.element;

                if (!container) {
                    console.error('FOREACH: No container element found');
                    return;
                }

                // Clean up existing text bindings before clearing DOM
                this.cleanupForeachTextBindings(binding);

                // Create evaluation context by merging data source with parent foreach variables
                const context = foreachVars || this.abstraction;

                // Parse and evaluate the binding expression on-demand
                const parsed = ExpressionParser.parseExpression(binding.target || binding.collection);
                const arrayValue = ExpressionParser.evaluate(parsed, context);
                const array = Array.isArray(arrayValue) ? arrayValue : [];

                // Clear existing content
                container.innerHTML = '';

                // If we have no items or no template, exit
                if (array.length === 0 || binding.template?.length === 0) {
                    return;
                }

                // Create elements
                array.forEach((item, index) => {
                    try {
                        // Create new DOM element from the stored template HTML
                        const itemElement = this.createForeachItemElement(binding.template);

                        // Create context variables for this foreach item
                        const itemContext = Utils.createScopedContext('foreach', context, {
                            [binding.itemName]: item,
                            [binding.indexName]: index
                        });

                        // Set up text interpolation for the new element
                        this.processTextBindingsForElement(itemElement, itemContext);

                        // Set up attribute bindings (class, style, events, etc.) for the new element
                        this.processElementAttributeBindings(itemElement, itemContext);

                        // Add the configured element to the fragment
                        container.appendChild(itemElement);
                    } catch (error) {
                        console.error('FOREACH: Error creating element for item', index, error);
                    }
                });
            },

            /**
             * Parse different value types and return array of class names to apply
             * @param {*} value - The evaluated expression value
             * @returns {string[]} Array of valid class names
             */
            parseClassValue(value) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return Object.entries(value).filter(([k, v]) => v && k.trim()).map(([k]) => k.trim());
                }

                if (typeof value === 'string') {
                    return value.trim().split(/\s+/).filter(Boolean);
                }

                if (value) {
                    const className = String(value).trim();
                    return className ? [className] : [];
                }

                return [];
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
            },

            /**
             * Helper method to detect if current context is inside a foreach loop
             * @param {Object|null} contextVars - The hierarchical context to check
             * @returns {boolean} True if context is within a foreach binding
             */
            isInForeachContext(contextVars) {
                if (!contextVars) {
                    return false;
                }

                // Walk up the prototype chain to find a foreach context
                let current = contextVars;

                while (current) {
                    if (current._contextType === 'foreach') {
                        return true;
                    }

                    current = Object.getPrototypeOf(current);
                }

                return false;
            },

            /**
             * Finds the nearest foreach context in the prototype chain
             * @param {Object|null} contextVars - The hierarchical context to search
             * @returns {Object|null} The nearest foreach context object, or null if none found
             */
            findNearestForeachContext(contextVars) {
                if (!contextVars) return null;

                let current = contextVars;
                while (current) {
                    if (current._contextType === 'foreach') {
                        return current;
                    }
                    current = Object.getPrototypeOf(current);
                }

                return null;
            },

            /**
             * Extracts parent foreach binding information from hierarchical context
             * Uses context type metadata to efficiently find foreach contexts
             * @param {Object|null} contextVars - The hierarchical context containing foreach variables
             * @returns {Object|null} The parent foreach binding object, or null if not found
             */
            getParentBindingFromContext(contextVars) {
                // Find the nearest foreach context
                const foreachContext = this.findNearestForeachContext(contextVars);

                if (!foreachContext) {
                    return null;
                }

                // Get the foreach variables from this context level
                const contextKeys = Object.getOwnPropertyNames(foreachContext);

                // Find the binding that matches these variable names
                return this.findMatchingForeachBinding(contextKeys);
            },

            /**
             * Finds a foreach binding by matching its variable names with context keys
             * @param {string[]} contextKeys - Array of variable names found in the foreach context
             * @returns {Object|null} Matching foreach binding or null if none found
             */
            findMatchingForeachBinding(contextKeys) {
                // Search through all foreach bindings to find one with matching itemName/indexName
                for (const binding of this.bindings.values()) {
                    if (binding.type === 'foreach' &&
                        binding.itemName &&
                        binding.indexName &&
                        contextKeys.includes(binding.itemName) &&
                        contextKeys.includes(binding.indexName)) {
                        return binding;
                    }
                }
                return null;
            },

            /**
             * Cleans up all child text bindings for a foreach binding
             * Uses DOM hierarchy to find child text bindings
             * @param {Object} foreachBinding - The foreach binding to clean up
             */
            cleanupForeachTextBindings(foreachBinding) {
                const foreachContainer = foreachBinding.element;
                const textBindingsToRemove = [];

                // Find all text bindings whose elements are contained within this foreach container
                this.bindings.forEach(binding => {
                    if (
                        binding.type === 'text' &&
                        binding.element &&
                        foreachContainer.contains(binding.element)
                    ) {
                        textBindingsToRemove.push(binding);
                    }
                });

                // Remove all found text bindings
                textBindingsToRemove.forEach(binding => {
                    this.removeBinding(binding);
                });
            },

            /**
             * Removes a binding and cleans up all references
             * @param {Object} binding - The binding to remove
             */
            removeBinding(binding) {
                // Remove from main bindings map
                this.bindings.delete(binding.id);

                // Remove from dependency index
                if (binding.dependencies) {
                    binding.dependencies.forEach(dep => {
                        const bindingSet = this.bindingIndex.get(dep);

                        if (bindingSet) {
                            // Remove binding
                            bindingSet.delete(binding);

                            // Clean up empty sets
                            if (bindingSet.size === 0) {
                                this.bindingIndex.delete(dep);
                            }
                        }
                    });
                }
            },

            // === HIERARCHY SECTION ===

            /**
             * Establishes parent-child relationships in component hierarchy
             */
            establishHierarchy() {
                const { parent, children } = window.PACRegistry.getHierarchy(this.container);

                this.updateParentRelationship(parent);
                this.updateChildrenRelationships(children);
                this.updateReactiveProperties();
            },

            /**
             * Updates parent relationship - only sets parent reference
             * Children sets are managed by updateChildrenRelationships
             * @param {Object|null} newParent - New parent component or null
             */
            updateParentRelationship(newParent) {
                // Do nothing when parent did not change
                if (this.parent === newParent) {
                    return;
                }

                // Remove from old parent's children set
                if (this.parent) {
                    this.parent.children.delete(this);
                }

                // Set new parent
                this.parent = newParent;

                // Add to its children set
                if (newParent) {
                    newParent.children.add(this);
                }
            },

            /**
             * Rebuilds children relationships from current DOM hierarchy
             * @param {Array} currentChildren - Children found in DOM
             */
            updateChildrenRelationships(currentChildren) {
                this.children.clear();

                currentChildren.forEach(child => {
                    // Remove child from previous parent if different
                    if (child.parent && child.parent !== this) {
                        child.parent.children.delete(child);
                    }

                    child.parent = this;
                    this.children.add(child);
                });
            },

            /**
             * Updates reactive hierarchy properties
             */
            updateReactiveProperties() {
                if (this.abstraction) {
                    this.abstraction.childrenCount = this.children.size;
                    this.abstraction.hasParent = !!this.parent;
                }
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
                if (this.abstraction.receiveFromChild) {
                    this.abstraction.receiveFromChild(type, data, child);
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
            notifyChildren(cmd, data) {
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
            notifyChild(selector, cmd, data) {
                // Find the first child whose container element matches the selector
                const child = Array.from(this.children).find(c => c.container.matches(selector));

                // If matching child found and has receiveFromParent method, send the command
                if (child && child.receiveFromParent) {
                    child.receiveFromParent(cmd, data);
                }
            },

            /*
             * Finds a binding with a valid template, either using the current binding or searching globally.
             * If the current binding has no template, searches all components for a matching binding with template.
             * @param {Object} binding - The binding object to check/find template for
             * @returns {Object|null} Binding object with valid template, or null if none found
             */
            findBindingWithTemplate(binding) {
                // Return current binding if it already has a template
                if (binding.template && binding.template.length > 0) {
                    return binding;
                }

                // Search across ALL components in the registry for a binding with template
                let bindingWithTemplate = null;

                if (window.PACRegistry && window.PACRegistry.components) {
                    window.PACRegistry.components.forEach(component => {
                        // Found one already
                        if (bindingWithTemplate) {
                            return;
                        }

                        const found = Array.from(component.bindings.values()).find(b =>
                            b.type === 'foreach' &&
                            b.collection === binding.collection &&
                            b.template &&
                            b.template.length > 0
                        );

                        if (found) {
                            bindingWithTemplate = found;
                        }
                    });
                }

                return bindingWithTemplate;
            },

            /**
             * Finds the data source object containing the target property for this binding.
             * Searches in order: current abstraction → child components → global registry.
             * @param {Object} binding - The binding object containing target/collection property
             * @returns {Object} Data source object containing the property
             */
            findDataSource(binding) {
                let dataSource = this.abstraction;
                const targetProperty = binding.target || binding.collection;

                if (!(targetProperty in this.abstraction)) {
                    // Look for the property in child components
                    for (const child of this.children) {
                        if (child.abstraction && targetProperty in child.abstraction) {
                            dataSource = child.abstraction;
                            break;
                        }
                    }

                    // If still not found, search globally
                    if (!(targetProperty in dataSource) && window.PACRegistry) {
                        window.PACRegistry.components.forEach(component => {
                            if (component.abstraction && targetProperty in component.abstraction) {
                                dataSource = component.abstraction;
                            }
                        });
                    }
                }

                return dataSource;
            },

            // === HTTP/SERIALIZATION SECTION ===

            /**
             * Makes an HTTP request with request grouping and cancellation support
             * @param {string} url - The URL to request
             * @param {Object} opts - Request options
             * @param {string} [opts.method='GET'] - HTTP method
             * @param {Object} [opts.headers] - Additional headers
             * @param {*} [opts.data] - Request body data
             * @param {string} [opts.groupKey] - Group key for request cancellation
             * @param {boolean} [opts.latestOnly] - Use URL as groupKey automatically
             * @param {boolean} [opts.ignoreAbort] - Suppress AbortError when cancelled
             * @param {Function} [opts.onSuccess] - Success callback
             * @param {Function} [opts.onError] - Error callback
             * @param {number} [opts.timeout=30000] - Request timeout in milliseconds
             * @param {Function} [opts.validateStatus] - Custom status validation function
             * @param {Function} [opts.onProgress] - Progress callback for uploads (not supported with fetch)
             * @param {string} [opts.responseType='auto'] - Response type: 'json', 'text', 'blob', 'response', 'auto'
             * @param {Function} [opts.urlNormalizer] - Function to normalize URLs for grouping
             * @param {string} [opts.credentials] - Fetch credentials option
             * @param {string} [opts.mode] - Fetch mode option
             * @param {string} [opts.cache] - Fetch cache option
             * @param {string} [opts.redirect] - Fetch redirect option
             * @param {string} [opts.referrer] - Fetch referrer option
             * @param {string} [opts.integrity] - Fetch integrity option
             * @param {boolean} [opts.keepalive] - Fetch keepalive option
             * @param {string} [opts.priority] - Fetch priority option
             * @param {string} [opts.baseUrl] - Base URL for URL normalization
             */
            makeHttpRequest(url, opts = {}) {
                // Extract and validate configuration
                const config = this.validateAndNormalizeConfig(url, opts);

                // Initialize request tracking
                if (!this._requestGroups) {
                    this._requestGroups = new Map();
                }

                // Setup request state and immediately register to prevent race conditions
                const requestState = this.setupRequestState(config);

                // Create timeout promise for request timeout handling
                const timeoutPromise = config.timeout > 0 ?
                    this.createTimeoutPromise(config.timeout, requestState.controller) :
                    null;

                // Create the main fetch promise
                const fetchPromise = this.executeFetch(config, requestState)
                    .then(response => this.processResponse(response, config, requestState))
                    .then(data => this.handleSuccess(data, config, requestState))
                    .catch(error => this.handleError(error, config));

                // Race between fetch and timeout (if timeout is enabled)
                const finalPromise = timeoutPromise ?
                    Promise.race([fetchPromise, timeoutPromise]) :
                    fetchPromise;

                return finalPromise.finally(() => {
                    this.cleanupRequest(config.groupKey, requestState.token);
                });
            },

            /**
             * Validates and normalizes request configuration to ensure consistent behavior.
             * Applies default values and validates required parameters.
             * @param {string} url - Request URL (required)
             * @param {Object} opts - Request options
             * @returns {Object} Normalized configuration object
             * @throws {Error} If URL is invalid or validation fails
             */
            validateAndNormalizeConfig(url, opts) {
                // Validate required URL parameter - must be non-empty string
                if (!url || typeof url !== 'string') {
                    throw new Error('URL must be a non-empty string');
                }

                // Validate callback functions and abort controller configurations
                // These methods should throw descriptive errors for invalid configurations
                this.validateCallbacks(opts);
                this.validateAbortControls(opts);

                // Process and normalize HTTP method and request body
                // This handles method inference from body presence and validates method/body combinations
                const { method, body } = this.normalizeMethodAndBody(opts);

                // Build complete headers object, merging defaults with user-provided headers
                // Handles content-type inference, authentication, and other standard headers
                const headers = this.buildHeaders(opts, body);

                // Extract and validate fetch API options that should be passed through directly
                // Includes credentials, cache, redirect, referrer, etc.
                const fetchOptions = this.buildFetchPassthrough(opts);

                // Determine request grouping key for deduplication/cancellation logic
                // Explicit groupKey takes precedence over auto-generated keys, even if falsy
                // Auto-generation only occurs when latestOnly is enabled
                const groupKey = opts.groupKey ?? (opts.latestOnly ? this.getGroupKeyFromUrl(url, opts) : null);

                return {
                    url,
                    method,
                    headers,
                    body,
                    groupKey,
                    fetchOptions,

                    // Ensure timeout is non-negative integer with sensible default
                    timeout: Math.max(0, parseInt(opts.timeout) || 30000),

                    // Convert to boolean to ensure consistent type
                    ignoreAbort: !!opts.ignoreAbort,

                    // Provide default status validator if none specified
                    validateStatus: opts.validateStatus || ((response) => response.ok),

                    // Default to automatic response type detection
                    responseType: opts.responseType || 'auto',

                    // Pass through callback functions (already validated above)
                    onSuccess: opts.onSuccess,
                    onError: opts.onError,
                    onProgress: opts.onProgress,

                    // Include abort controller for request cancellation
                    abortController: opts.abortController
                };
            },

            /**
             * Validates callback functions and other options.
             * @param {Object} opts - Request options
             * @throws {Error} If validation fails
             */
            validateCallbacks(opts) {
                const validators = [
                    ['onSuccess', opts.onSuccess],
                    ['onError', opts.onError],
                    ['onProgress', opts.onProgress],
                    ['urlNormalizer', opts.urlNormalizer]
                ];

                validators.forEach(([name, fn]) => {
                    if (fn && typeof fn !== 'function') {
                        throw new Error(`${name} must be a function`);
                    }
                });
            },

            /**
             * Validates abort controller and signal options.
             * @param {Object} opts - Request options
             * @throws {Error} If validation fails
             */
            validateAbortControls(opts) {
                if (opts.abortController && typeof opts.abortController.abort !== 'function') {
                    throw new Error('abortController must have an abort method');
                }
            },

            /**
             * Normalizes HTTP method and processes request body.
             * @param {Object} opts - Request options
             * @returns {Object} Object with method and body properties
             */
            normalizeMethodAndBody(opts) {
                // Fetch method
                const method = (opts.method || 'GET').toUpperCase();

                // GET and HEAD don't use body data
                if (['GET', 'HEAD'].includes(method)) {
                    if (opts.data !== undefined) {
                        console.warn(`Method ${method} should not have a body. Data will be ignored.`);
                    }

                    return { method };
                }

                // For other methods, process body data
                let body;

                if (opts.data !== undefined) {
                    if (
                        typeof opts.data !== 'object' ||
                        (opts.data instanceof FormData) ||
                        (opts.data instanceof Blob) ||
                        (opts.data instanceof ArrayBuffer)
                    ) {
                        body = JSON.stringify(opts.data);
                    } else {
                        body = opts.data;
                    }
                }

                return { method, body };
            },

            /**
             * Builds normalized headers object with proper content types.
             * @param {Object} opts - Request options
             * @param {*} body - Request body (used to determine content type)
             * @returns {Object} Headers object with canonical casing
             */
            buildHeaders(opts, body) {
                // Create Headers object for canonical casing
                const headers = new Headers();
                headers.set('X-PAC-Request', 'true');

                // Add content type based on body type (only when body exists)
                if (body !== undefined) {
                    if (body instanceof FormData) {
                        // Don't set Content-Type for FormData - let browser set boundary
                    } else if (body instanceof Blob || body instanceof ArrayBuffer) {
                        headers.set('Content-Type', 'application/octet-stream');
                    } else if (typeof body === 'string') {
                        headers.set('Content-Type', 'text/plain; charset=utf-8');
                    } else {
                        headers.set('Content-Type', 'application/json; charset=utf-8');
                    }
                }

                // Add Accept header if not provided by user
                const userHeaders = opts.headers || {};
                const hasAccept = Object.keys(userHeaders).some(key => key.toLowerCase() === 'accept');

                if (!hasAccept) {
                    headers.set('Accept', 'application/json, text/plain, */*');
                }

                // Add user headers (they override defaults)
                Object.entries(userHeaders).forEach(([key, value]) => {
                    headers.set(key, value);
                });

                // Return headers
                return headers;
            },

            /**
             * Builds fetch passthrough options object by extracting relevant fetch API options
             * from the provided options object. Only includes properties that have defined values.
             * @param {Object} opts - Request options containing potential fetch API properties
             * @returns {Object} Fetch options object with only the passthrough properties that were defined
             */
            buildFetchPassthrough(opts) {
                const fetchOptions = {};

                // Define which properties from opts should be passed directly to fetch()
                // These correspond to standard fetch API RequestInit properties
                const passthroughKeys = [
                    'credentials',    // 'omit' | 'same-origin' | 'include'
                    'mode',           // 'cors' | 'no-cors' | 'same-origin' | 'navigate'
                    'cache',          // 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'
                    'redirect',       // 'follow' | 'error' | 'manual'
                    'referrer',       // URL string or 'no-referrer'
                    'referrerPolicy', // Referrer policy string
                    'integrity',      // Subresource integrity string
                    'keepalive',      // Boolean for keeping connection alive
                    'priority'        // 'high' | 'low' | 'auto'
                ];

                // Copy only defined properties from opts to fetchOptions
                // This avoids passing undefined values to fetch() which could cause issues
                passthroughKeys.forEach(key => {
                    if (opts[key] !== undefined) {
                        fetchOptions[key] = opts[key];
                    }
                });

                return fetchOptions;
            },

            /**
             * Gets group key from URL for latestOnly option.
             * @param {string} url - Request URL
             * @param {Object} opts - Request options
             * @returns {string} Group key
             */
            getGroupKeyFromUrl(url, opts) {
                if (opts.urlNormalizer) {
                    return opts.urlNormalizer(url);
                } else {
                    return this.normalizeUrlForGrouping(url, opts.baseUrl);
                }
            },

            /**
             * Basic URL normalization for grouping requests.
             * Removes hash and sorts query parameters for consistent grouping.
             * @param {string} url - URL to normalize
             * @param {string} [baseUrl] - Base URL for normalization
             * @returns {string} Normalized URL for grouping
             */
            normalizeUrlForGrouping(url, baseUrl) {
                try {
                    let defaultBase;

                    // Determine base URL - prioritize parameter, then global location, then localhost fallback
                    if (typeof globalThis !== 'undefined' && globalThis.location) {
                        defaultBase = baseUrl || globalThis.location.origin;
                    } else {
                        defaultBase = baseUrl || 'http://localhost';
                    }

                    // Parse URL and remove fragment identifier for consistent grouping
                    const urlObj = new URL(url, defaultBase);
                    urlObj.hash = '';

                    // Extract and sort query parameters alphabetically
                    const params = new URLSearchParams(urlObj.search);
                    const sortedParams = new URLSearchParams();

                    // Sort parameter names, then sort values within each parameter
                    [...params.keys()].sort().forEach(key => {
                        params.getAll(key).sort().forEach(value => {
                            sortedParams.append(key, value);
                        });
                    });

                    // Apply sorted parameters back to URL
                    urlObj.search = sortedParams.toString();
                    return urlObj.toString();
                } catch {
                    // Return original URL if parsing fails (malformed URLs, unsupported schemes, etc.)
                    return url;
                }
            },

            /**
             * Sets up request state and handles request grouping logic.
             * If a groupKey is provided, cancels any previous request in that group.
             * @param {Object} config - Normalized configuration
             * @returns {Object} Request state with token and controller
             */
            setupRequestState(config) {
                // Create a combined controller that handles both timeout and manual cancellation
                const controller = this.createCombinedController(config);

                // Handle request grouping - only one request per group can be active
                let token = 0;

                if (config.groupKey) {
                    // Check if there's already a request in this group
                    const prev = this._requestGroups.get(config.groupKey);

                    if (prev) {
                        // Cancel the previous request if it's still active
                        if (prev.controller && !prev.controller.signal.aborted) {
                            prev.controller.abort();
                        }
                        // Increment token to invalidate any pending responses from the cancelled request
                        token = prev.token + 1;
                    } else {
                        // First request in this group
                        token = 1;
                    }

                    // Store the new request state for this group
                    this._requestGroups.set(config.groupKey, { token, controller });
                }

                return { token, controller, groupKey: config.groupKey };
            },

            /**
             * Creates a controller combining internal and external controllers.
             * @param {Object} config - Request configuration
             * @returns {Object} Combined controller
             */
            createCombinedController(config) {
                if (config.abortController) {
                    return config.abortController;
                } else {
                    return new AbortController();
                }
            },

            /**
             * Creates a timeout promise that rejects after specified milliseconds.
             * @param {number} timeout - Timeout in milliseconds
             * @param {AbortController} controller - Controller to abort on timeout
             * @returns {Promise} Promise that rejects on timeout
             */
            createTimeoutPromise(timeout, controller) {
                return new Promise((_, reject) => {
                    // Early exit if the controller is already aborted to avoid unnecessary work
                    if (controller.signal.aborted) {
                        reject(this.createTaggedCancellationError('Request was cancelled before timeout', 'timeout'));
                        return;
                    }

                    // Set up timeout to abort the controller and reject the promise
                    const timeoutId = setTimeout(() => {
                        // Double-check abort status to prevent race conditions
                        if (!controller.signal.aborted) {
                            controller.abort();
                            reject(this.createTaggedCancellationError(`Request timeout after ${timeout}ms`, 'timeout'));
                        }
                    }, timeout);

                    // Clean up timeout if the controller is aborted externally
                    // Using { once: true } ensures the listener is automatically removed after firing
                    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
                });
            },

            /**
             * Executes the fetch request with the provided configuration.
             * Handles request cancellation, network errors, and signal propagation.
             * @param {Object} config - Request configuration object
             * @param {string} config.method - HTTP method (GET, POST, etc.)
             * @param {string} config.url - Target URL for the request
             * @param {Object} config.headers - HTTP headers to include
             * @param {string|FormData|Object} config.body - Request body data
             * @param {Object} config.fetchOptions - Additional fetch API options
             * @param {Object} requestState - Current request state tracking object
             * @param {AbortController} requestState.controller - Controller for request cancellation
             * @returns {Promise<Response>} Fetch response object
             * @throws {Error} Tagged cancellation error if request was aborted
             * @throws {TypeError} Network error with added network flag
             */
            async executeFetch(config, requestState) {
                // Early cancellation check - prevents unnecessary network calls
                // if the request was already cancelled before reaching execution
                if (requestState.controller.signal.aborted) {
                    throw this.createTaggedCancellationError('Request was cancelled before execution', 'cancelled');
                }

                // Construct fetch options by merging config properties
                // Signal is critical for enabling request cancellation mid-flight
                const fetchOptions = {
                    method: config.method,           // HTTP verb (GET, POST, PUT, DELETE, etc.)
                    headers: config.headers,         // Authorization, content-type, custom headers
                    body: config.body,               // Payload for POST/PUT requests
                    signal: requestState.controller.signal,  // Enables cancellation via AbortController
                    ...config.fetchOptions           // Additional options like credentials, mode, cache
                };

                try {
                    // Execute the actual HTTP request
                    // This is where the network call happens and can throw various errors
                    return await fetch(config.url, fetchOptions);
                } catch (e) {
                    // Handle network-specific errors vs cancellation errors
                    // TypeError typically indicates network issues (DNS, connection refused, etc.)
                    // but we need to distinguish from user-initiated cancellations
                    if (e.name === 'TypeError' && !requestState.controller.signal.aborted) {
                        // Tag network errors for upstream error handling logic
                        // This helps differentiate network failures from other TypeErrors
                        e.network = true;
                    }

                    // Re-throw the error with enhanced context
                    // Upstream handlers can now distinguish between network vs cancellation vs other errors
                    throw e;
                }
            },

            /**
             * Processes the HTTP response, validating status and parsing content.
             * @param {Response} response - Fetch API response object
             * @param {Object} config - Request configuration
             * @param {Object} requestState - Current request state
             * @returns {Promise<any>} Parsed response data
             */
            async processResponse(response, config, requestState) {
                // Check if request was cancelled during processing
                if (requestState.controller.signal.aborted) {
                    throw this.createTaggedCancellationError('Request was cancelled during processing', 'cancelled');
                }

                // Validate response status using custom validator
                if (!config.validateStatus(response)) {
                    const errorText = await this.safeGetResponseText(response);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
                }

                // Return undefined for HEAD requests or status codes that shouldn't have content
                if (config.method === 'HEAD' || [204, 205, 304].includes(response.status)) {
                    return undefined;
                }

                // Parse response body based on configured response type
                return this.parseResponse(response, config.responseType);
            },

            /**
             * Parses response based on specified response type with broadened JSON detection.
             * @param {Response} response - Fetch API response object
             * @param {string} responseType - Desired response type
             * @returns {Promise<any>} Parsed response data
             */
            async parseResponse(response, responseType) {
                try {
                    switch (responseType) {
                        case 'json':
                            return await response.json();

                        case 'text':
                            return await response.text();

                        case 'blob':
                            return await response.blob();

                        case 'response':
                            return response;

                        default:
                            return this.autoParseResponse(response);
                    }
                } catch (error) {
                    throw new Error(`Failed to parse response as ${responseType}: ${error.message}`);
                }
            },

            /**
             * Auto-parses response with broadened JSON detection.
             * @param {Response} response - Fetch API response object
             * @returns {Promise<any>} Parsed response data
             */
            async autoParseResponse(response) {
                const contentType = response.headers.get('content-type') || '';
                const contentLength = response.headers.get('content-length');

                if (contentLength === '0') {
                    return undefined;
                }

                if (/json|\+json/i.test(contentType)) {
                    const t = await response.text();
                    return t.trim() ? JSON.parse(t) : undefined;
                }

                if (/^text\//i.test(contentType)) {
                    return response.text();
                }

                return response.blob();
            },

            /**
             * Safely extracts response text for error reporting.
             * @param {Response} response - Fetch API response object
             * @returns {Promise<string|null>} Response text or null if extraction fails
             */
            async safeGetResponseText(response) {
                try {
                    if (response.bodyUsed) {
                        return null;
                    }

                    const clone = response.clone();
                    const text = await clone.text();
                    return text.substring(0, 200);
                } catch {
                    return null;
                }
            },

            /**
             * Handles successful response processing.
             * @param {any} data - Parsed response data
             * @param {Object} config - Request configuration
             * @param {Object} requestState - Current request state
             * @returns {any} Response data
             */
            handleSuccess(data, config, requestState) {
                if (requestState.controller.signal.aborted) {
                    if (config.ignoreAbort) {
                        return undefined;
                    } else {
                        throw this.createTaggedCancellationError('Request was cancelled', 'cancelled');
                    }
                }

                if (config.onSuccess) {
                    try {
                        const context = this.abstraction || this;
                        config.onSuccess.call(context, data);
                    } catch (callbackError) {
                        console.error(callbackError);
                    }
                }

                return data;
            },

            /**
             * Handles request errors including network failures, timeouts, and aborts.
             * @param {Error} error - The error that occurred
             * @param {Object} config - Request configuration
             * @returns {any|throws} Returns undefined for ignored cancellations, otherwise re-throws
             */
            handleError(error, config) {
                const isCancellation = this.isCancellationError(error);

                if (isCancellation && config.ignoreAbort) {
                    return undefined;
                }

                if (config.onError) {
                    try {
                        const context = this.abstraction || this;
                        config.onError.call(context, error);
                    } catch (callbackError) {
                        console.error(callbackError);
                    }
                }

                throw error;
            },

            /**
             * Helper to create tagged cancellation errors consistently.
             * @param {string} message - Error message
             * @param {string} type - Cancellation type
             * @returns {Error} Tagged cancellation error
             */
            createTaggedCancellationError(message, type) {
                const error = new Error(message);
                error.name = 'CancellationError';
                error.cancellationType = type;
                return error;
            },

            /**
             * Helper to detect cancellation errors deterministically.
             * @param {Error} error - Error to check
             * @returns {boolean} True if error represents cancellation
             */
            isCancellationError(error) {
                // Standard cancellation error names
                if (error.name === 'AbortError' || error.name === 'CancellationError') {
                    return true;
                }

                // Custom cancellation types
                if (error.cancellationType) {
                    const cancellationTypes = ['timeout', 'cancelled', 'superseded'];
                    return cancellationTypes.includes(error.cancellationType);
                }

                return false;
            },

            /**
             * Cleans up request tracking to prevent memory leaks.
             * @param {string} groupKey - The group key to clean up
             * @param {number} token - The request token for validation
             */
            cleanupRequest(groupKey, token) {
                if (!groupKey) {
                    return;
                }

                const current = this._requestGroups.get(groupKey);

                if (!current) {
                    return;
                }

                if (current.token === token) {
                    this._requestGroups.delete(groupKey);
                } else if (current.token < token) {
                    console.warn(`Cleaning up stale request entry for ${groupKey}`);
                    this._requestGroups.delete(groupKey);
                }
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

                // Iterate through all properties in the component's abstraction layer
                Object.keys(this.abstraction).forEach(key => {
                    const value = this.abstraction[key];

                    // Include property in serialization only if it meets all criteria:
                    if (value !== undefined &&              // Has a defined value
                        typeof value !== 'function' &&      // Is not a function
                        !computedProps.includes(key)        // Is not a computed property
                    ) {
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
                // Clear all collections in one operation
                this._clearCollections();

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

                // Final nullification (MOVED TO END)
                this._nullifyReferences();
            },

            /**
             * Clears all collection-based data structures in a single operation
             * This consolidates the clearing of timeouts, caches, and bindings to reduce code duplication
             */
            _clearCollections() {
                // Clear all pending timeout operations
                // Prevents callbacks from executing after component destruction
                this.updateTimeouts.forEach(id => clearTimeout(id));
                this.updateTimeouts.clear();

                // Clear all cached data structures
                // Releases memory held by computed values and expression caches
                this.deps.clear();
                this.lastValues.clear();

                // Clear all binding-related data structures
                // Removes references between data bindings and their indices
                this.bindings.clear();
                this.bindingIndex.clear();

                // Clear hierarchy relationships
                this.children.clear();
                this.eventListeners.clear();
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
                    document.removeEventListener('keydown', window._wakaPACGlobalHandlers.keyboard_message, true);
                    document.removeEventListener('keyup', window._wakaPACGlobalHandlers.keyboard_message, true);
                    document.removeEventListener('mousedown', window._wakaPACGlobalHandlers.mouse_message, true);
                    document.removeEventListener('mouseup', window._wakaPACGlobalHandlers.mouse_message, true);
                    document.removeEventListener('focusin', window._wakaPACGlobalHandlers.focusin_message, true);
                    document.removeEventListener('focusout', window._wakaPACGlobalHandlers.focusout_message, true);
                    window.removeEventListener('online', window._wakaPACGlobalHandlers.online);
                    window.removeEventListener('offline', window._wakaPACGlobalHandlers.offline);
                    window.removeEventListener('scroll', window._wakaPACGlobalHandlers.scroll);
                    window.removeEventListener('resize', window._wakaPACGlobalHandlers.resize);

                    // Remove connection event listener
                    if ('connection' in navigator && navigator.connection) {
                        navigator.connection.removeEventListener('change', window._wakaPACGlobalHandlers.connectionChange);
                    }

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
             * Prevents memory leaks by ensuring event handlers are properly cleaned up
             * @private
             */
            _removeEventListeners() {
                // Remove all stored event listeners with capture=true
                this.eventListeners?.forEach((handler, type) => {
                    this.container?.removeEventListener(type, handler, true);
                });

                // Clear the event listener list
                this.eventListeners?.clear();

                // Clean up container scroll listener
                if (this.containerScrollHandler) {
                    this.container?.removeEventListener('scroll', this.containerScrollHandler);
                    this.containerScrollHandler = null;
                }
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
                 * Makes an HTTP request with PAC-specific headers and handling
                 * @param {string} url - URL to request
                 * @param {Object} opts - Request options
                 * @returns {Promise} Promise that resolves with response data
                 */
                control: (url, opts = {}) => control.makeHttpRequest(url, opts),

                /**
                 * Serializing the reactive object to JSON (excluding non-serializable properties)
                 * @returns {{}}
                 */
                toJSON: () => control.serializeToJSON(),

                /**
                 * Gets the global position of an element within the document
                 * @param {string|Element} elementOrId - Element ID or DOM element
                 * @returns {Object|null} Position object with x, y properties or null if not found
                 */
                getElementPosition: (elementOrId) => Utils.getElementPosition(elementOrId),

                /**
                 * Destroys the component and cleans up resources
                 */
                destroy: () => control.destroy()
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

        // Signal that a new component is ready to set proper hierarchies
        document.dispatchEvent(new CustomEvent('pac:component-ready', {
            detail: { component: control, selector: selector }
        }));

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

    // Set up event-driven hierarchy resolution (singleton)
    if (!window._wakaPACHierarchyListener) {
        window._wakaPACHierarchyListener = true;

        // Listen for pac:component-ready events
        document.addEventListener('pac:component-ready', () => {
            // Clear any existing timeout to debounce multiple rapid component creations
            clearTimeout(window._wakaPACHierarchyTimeout);
            window._wakaPACHierarchyTimeout = setTimeout(() => {
                // Clear hierarchy cache
                window.PACRegistry.hierarchyCache = new WeakMap();

                // Re-establish hierarchy for all components
                window.PACRegistry.components.forEach(component => {
                    component.establishHierarchy();
                });
            }, 20);
        });
    }

    // Export to global scope
    window.wakaPAC = wakaPAC;

    // Export for CommonJS/Node.js environments
    // eslint-disable-next-line no-undef
    if (typeof module !== 'undefined' && module.exports) {
        // eslint-disable-next-line no-undef
        module.exports = {wakaPAC, ComponentRegistry, Utils};
    }
})();