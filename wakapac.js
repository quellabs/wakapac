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
     * Matches handlebars-style interpolation: {{variable}}
     * Captures variable name/expression with global flag
     * @type {RegExp}
     */
    const INTERPOLATION_REGEX = /\{\{\s*([^}]+)\s*}}/g;

    /**
     * Tests for presence of interpolation syntax without capture groups
     * More efficient for boolean checks than INTERPOLATION_REGEX
     * @type {RegExp}
     */
    const INTERPOLATION_TEST_REGEX = /\{\{.*}}/;

    /**
     * Extracts foreach item metadata from PAC syntax
     * Format: "pac-foreach-item: name, index=N, renderIndex=M"
     * Captures: [itemName, index, renderIndex] (indices as strings)
     * @type {RegExp}
     */
    const FOREACH_INDEX_REGEX = /pac-foreach-item:\s*([^,]+),\s*index=(\d+),\s*renderIndex=(\d+)/;

    /**
     * This regexp finds runs of dots and square brackets.
     * @type {RegExp}
     */
    const DOTS_AND_BRACKETS_PATTERN = /[.[\]]+/;

    /**
     * HTML attributes that are boolean (present = true, absent = false)
     * @constant {string[]}
     */
    const BOOLEAN_ATTRIBUTES = ["readonly", "required", "selected", "checked", "hidden", "multiple", "autofocus"];

    /**
     * All binding types
     * @type {string[]}
     */
    const KNOWN_BINDING_TYPES = [
        "value", "checked", "visible", "if", "foreach", "class", "style",
        "click", "change", "input", "submit", "focus", "blur", "keyup", "keydown"
    ];

    /**
     * Windows-style message type constants for event handling
     * Hex values match Win32 API message identifiers
     */
    const MSG_TYPES = {
        // Unknown message (should never occur)
        MSG_UNKNOWN: 0x0000,

        // Mouse movement
        MSG_MOUSEMOVE: 0x0200,      // Mouse position changed

        // Mouse button press/release events
        MSG_LBUTTONDOWN: 0x0201,    // Left mouse button pressed
        MSG_LBUTTONUP: 0x0202,      // Left mouse button released
        MSG_RBUTTONDOWN: 0x0204,    // Right mouse button pressed
        MSG_RBUTTONUP: 0x0205,      // Right mouse button released
        MSG_MBUTTONDOWN: 0x0207,    // Middle mouse button pressed
        MSG_MBUTTONUP: 0x0208,      // Middle mouse button released

        // Click event (semantic user activation)
        MSG_LCLICK: 0x0210,          // Web-style click event
        MSG_MCLICK: 0x0211,          // Web-style click event
        MSG_RCLICK: 0x0212,          // Web-style click event

        // Text input and form events
        MSG_CHAR: 0x0300,           // Character input received
        MSG_CHANGE: 0x0301,         // Input value changed
        MSG_SUBMIT: 0x0302,         // Form submission triggered

        // Element focus state changes
        MSG_FOCUS: 0x0007,          // Element gained focus
        MSG_BLUR: 0x0008,           // Element lost focus

        // Keyboard key press/release events
        MSG_KEYDOWN: 0x0100,        // Key pressed down
        MSG_KEYUP: 0x0101           // Key released
    };

    /**
     * Mouse and keyboard modifier key state flags
     * Used as bitmask - multiple flags can be OR'd together
     */
    const MK_LBUTTON = 0x0001;      // Left mouse button held down
    const MK_RBUTTON = 0x0002;      // Right mouse button held down
    const MK_MBUTTON = 0x0004;      // Middle mouse button held down
    const MK_SHIFT = 0x0008;        // Shift key held down
    const MK_CONTROL = 0x0010;      // Ctrl key held down
    const MK_ALT = 0x0020;          // Alt key held down

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Core utility functions for the framework
     * @namespace Utils
     */
    const Utils = {

        /**
         * Generates a unique identifier string based on current timestamp and optional random component
         * @param {string} [prefix=""] - Optional prefix to prepend to the generated ID
         * @param {boolean} [random=false] - Whether to append a random suffix for additional uniqueness
         * @returns {string} A unique identifier in hexadecimal format
         */
        uniqid(prefix = "", random = false) {
            // Get current timestamp in milliseconds and add sub-millisecond precision
            // Date.now() * 1000 converts ms to microseconds, Math.random() * 1000 adds fractional component
            const sec = Date.now() * 1000 + Math.random() * 1000;

            // Convert to hexadecimal string and ensure minimum 14 character length
            // The padEnd ensures consistent length even if the hex conversion results in fewer digits
            const id = sec.toString(16).padEnd(14, "0");

            // Combine prefix + base ID + optional random suffix.
            // Random suffix is a truncated 8-digit random number for additional entropy
            return `${prefix}${id}${random ? `.${Math.trunc(Math.random() * 100000000)}`:""}`;
        },

        /**
         * Sets a nested property value on the reactive abstraction
         * @param {string} path - The property path (e.g., "todos[0].completed")
         * @param {*} value - The value to set
         * @param {object} current
         */
        setNestedProperty(path, value, current) {
            const parts = path.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);

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
        },

        /**
         * Gets a unique identifier for an element to use in queue tracking
         * @param {HTMLElement} element - The element to identify
         * @returns {string} A unique identifier for the element
         */
        getElementIdentifier(element) {
            // If element has an ID, use it
            if (element.id) {
                return element.id;
            }

            // Otherwise, generate and assign a unique ID
            if (!element.hasAttribute('data-pac-element-id')) {
                element.setAttribute('data-pac-element-id', Utils.uniqid('pac-el-'));
            }

            return element.getAttribute('data-pac-element-id');
        },

        /**
         * Converts a path string into an array of segments.
         * @param {string|string[]} pathString - Path expression as string or array.
         * @returns {string[]} Array of path segments.
         */
        pathStringToArray(pathString) {
            if (Array.isArray(pathString)) {
                return pathString;
            }

            return String(pathString).split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);
        },

        /**
         * Converts an array of path segments into a JavaScript property access string.
         * Handles both dot notation for properties and bracket notation for numeric indices.
         * @param {string[]} pathArray - Array of path segments representing object property access
         * @returns {string} Formatted property access string (e.g., "user.settings[0].name")
         */
        pathArrayToString(pathArray) {
            if (pathArray.length === 0) {
                return '';
            }

            let result = String(pathArray[0]); // Convert first token to string

            for (let i = 1; i < pathArray.length; i++) {
                const part = pathArray[i];

                // Handle numeric indices
                if (typeof part === 'number' || /^\d+$/.test(String(part))) {
                    result += `[${part}]`;
                } else {
                    // Handle property names
                    result += `.${part}`;
                }
            }

            return result;
        },

        /**
         * Determines if an element belongs to the specified PAC container.
         * An element belongs to a container if that container is its immediate PAC parent.
         * @param {Element} container - The PAC container element with data-pac-id attribute
         * @param {Node} element - The element to check (can be Element or Text node)
         * @returns {boolean} True if element belongs directly to this container, false otherwise
         */
        belongsToPacContainer(container, element) {
            // Early validation: ensure container is an Element with required attribute
            if (!(container instanceof Element) || !container.hasAttribute('data-pac-id')) {
                return false;
            }

            // Handle Text nodes by getting their parent element for containment checking
            const targetElement = element && element.nodeType === Node.TEXT_NODE
                ? element.parentElement
                : element;

            // Validate that we have a valid Element to work with
            if (!(targetElement instanceof Element)) {
                return false;
            }

            // Quick containment check - if not contained, definitely doesn't belong
            if (!container.contains(targetElement)) {
                return false;
            }

            // Find the closest PAC container ancestor (or self)
            const immediateContainer = targetElement.closest('[data-pac-id]');

            // Element belongs to this container only if this container is its immediate PAC parent
            return immediateContainer === container;
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
         * Converts a DOMRect object to a plain JavaScript object
         * @param {DOMRect|DOMRectReadOnly} domRect - The DOMRect object to convert
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
         * Detects current network quality
         * @returns {*|string}
         */
        getNetworkEffectiveType() {
            if ('connection' in navigator && navigator.connection?.effectiveType) {
                return navigator.connection.effectiveType;
            } else {
                return '4g';
            }
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
            switch (this.getNetworkEffectiveType()) {
                case 'slow-2g':
                case '2g':
                case '3g':
                    return 'slow';

                default:
                    return 'fast';
            }
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
         * Simple djb2 hash algorithm implementation
         * Provides good distribution for typical string inputs
         * @param {string} str - String to hash
         * @returns {string} Hexadecimal hash string
         */
        djb2Hash(str) {
            let hash = 5381;

            for (let i = 0; i < str.length; i++) {
                // hash * 33 + char_code
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
                // Keep within 32-bit integer range
                hash = hash & 0xffffffff;
            }

            // Convert to positive hex string
            return (hash >>> 0).toString(16);
        },

        /**
         * Extracts the low-order word (x coordinate) from lParam
         * Equivalent to Win32 LOWORD macro - gets bits 0-15
         * Coordinates are container-relative (client-area relative in Win32 terms)
         * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
         * @returns {number} X coordinate relative to container's left edge
         */
        LOWORD(lParam) {
            return lParam & 0xFFFF;
        },

        /**
         * Extracts the high-order word (y coordinate) from lParam
         * Equivalent to Win32 HIWORD macro - gets bits 16-31
         * Coordinates are container-relative (client-area relative in Win32 terms)
         * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
         * @returns {number} Y coordinate relative to container's top edge
         */
        HIWORD(lParam) {
            return (lParam >> 16) & 0xFFFF;
        },

        /**
         * Extracts both x and y coordinates from lParam
         * Equivalent to Win32 MAKEPOINTS macro - converts lParam to POINTS structure
         * Coordinates are container-relative (client-area relative in Win32 terms)
         * To get absolute viewport coordinates, use event.detail.originalEvent.clientX/Y
         * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
         * @returns {{x: number, y: number}} Object containing container-relative x and y coordinates
         */
        MAKEPOINTS(lParam) {
            return {
                x: lParam & 0xFFFF,           // Low 16 bits = x coordinate (container-relative)
                y: (lParam >> 16) & 0xFFFF    // High 16 bits = y coordinate (container-relative)
            };
        }
    }

    // ========================================================================
    // ENHANCED REACTIVE PROXY WITH ARRAY-SPECIFIC EVENTS
    // ========================================================================

    function makeDeepReactiveProxy(value, container) {

        /**
         * List of all methods allowed on an array
         * @type {string[]}
         */
        const ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

        /**
         * Determines whether a property should be wrapped in a reactive proxy.
         * Properties starting with underscore (_) or dollar sign ($) are treated as non-reactive
         * to avoid performance overhead when storing complex objects, DOM references, or internal state.
         * @param {string|symbol|number} prop - The property name being accessed or set
         * @returns {boolean} True if the property should trigger reactivity and DOM updates, false otherwise
         */
        function shouldMakeReactive(prop) {
            return typeof prop === 'string' && !prop.startsWith('_') && !prop.startsWith('$');
        }

        /**
         * Creates a recursive proxy that intercepts property access and mutations to enable reactivity.
         * This is the core function that transforms plain objects into reactive proxies that can trigger
         * DOM updates when their properties change. It handles nested objects, arrays, and maintains
         * proper path tracking for deep property changes.
         * @param {Object|Array} obj - The object or array to make reactive
         * @param {string[]} [currentPath=[]] - Array representing the property path from root (e.g., ['users', '0', 'name'])
         * @returns {Object|Array} A proxy object that intercepts get/set operations for reactivity
         */
        function createProxy(obj, currentPath) {
            currentPath = currentPath || [];

            return new Proxy(obj, {
                get: function (target, prop) {
                    const val = target[prop];

                    // Handle array methods first
                    if (Array.isArray(target) && typeof val === 'function' && ARRAY_METHODS.includes(prop)) {
                        return function () {
                            // Store the old array state before modification
                            const oldArray = Array.prototype.slice.call(target);

                            // Apply the array method to get the result
                            const result = Array.prototype[prop].apply(target, arguments);

                            // Get the new array state after modification
                            const newArray = Array.prototype.slice.call(target);

                            // Re-proxy all items with correct indices after the operation
                            // This ensures all objects have the proper path references
                            newArray.forEach((item, index) => {
                                if (item && typeof item === 'object' && !item._isReactive) {
                                    const correctPath = currentPath.concat([index]);
                                    newArray[index] = createProxy(item, correctPath);
                                    newArray[index]._isReactive = true;
                                }
                            });

                            // Update the target array with the newly proxied items
                            // This is necessary because forEach works on a copy
                            for (let i = 0; i < newArray.length; i++) {
                                target[i] = newArray[i];
                            }

                            // Dispatch array-specific event
                            container.dispatchEvent(new CustomEvent("pac:array-change", {
                                detail: {
                                    path: currentPath,
                                    oldValue: oldArray,
                                    newValue: target, // Use the updated target, not newArray copy
                                    method: prop
                                }
                            }));

                            // Also trigger computed property updates
                            container.dispatchEvent(new CustomEvent("pac:change", {
                                detail: {
                                    path: currentPath,
                                    oldValue: oldArray,
                                    newValue: target // Use the updated target, not newArray copy
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
                    if (val && typeof val === 'object' && !val._isReactive && shouldMakeReactive(prop)) {
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
                    // Handle array length truncation
                    if (Array.isArray(target) && prop === 'length') {
                        const oldLength = target.length;
                        const newLength = newValue;

                        // Only trigger events if length actually changes
                        if (oldLength === newLength) {
                            return true;
                        }

                        // Store old array state before truncation
                        const oldArray = Array.prototype.slice.call(target);

                        // Perform the truncation
                        target.length = newLength;

                        // Dispatch array-specific event
                        container.dispatchEvent(new CustomEvent("pac:array-change", {
                            detail: {
                                path: currentPath,
                                oldValue: oldArray,
                                newValue: Array.prototype.slice.call(target),
                                method: 'length'
                            }
                        }));

                        // Also trigger computed property updates
                        container.dispatchEvent(new CustomEvent("pac:change", {
                            detail: {
                                path: currentPath,
                                oldValue: oldArray,
                                newValue: Array.prototype.slice.call(target)
                            }
                        }));

                        return true;
                    }

                    // Do nothing when value did not change
                    const oldValue = target[prop];
                    const propertyPath = currentPath.concat([prop]);

                    if (oldValue === newValue) {
                        return true;
                    }

                    // Special handling for scroll properties
                    if (propertyPath.length === 1) {
                        if (prop === 'containerScrollX' && container) {
                            container.scrollLeft = newValue;
                        } else if (prop === 'containerScrollY' && container) {
                            container.scrollTop = newValue;
                        } else if (prop === 'browserScrollX') {
                            window.scrollTo(newValue, window.scrollY);
                        } else if (prop === 'browserScrollY') {
                            window.scrollTo(window.scrollX, newValue);
                        }
                    }

                    // Only make reactive and dispatch events for non-underscore properties
                    if (!shouldMakeReactive(prop)) {
                        target[prop] = newValue;
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
        /** @private {boolean} Flag to prevent multiple initializations */
        _initialized: false,

        initialize() {
            // Store reference to this object for use in closures
            const self = this;

            // Prevent double initialization
            if (this._initialized) {
                return;
            }

            this._initialized = true;

            /**
             * Handle document visibility changes (tab switches, window minimize, etc.)
             * Updates browserVisible property for all PAC containers
             */
            document.addEventListener('visibilitychange', function() {
                self.dispatchBrowserStateEvent('visibility', {
                    visible: !document.hidden
                });
            });

            /**
             * Handle browser coming online
             * Updates network state for all PAC containers
             */
            window.addEventListener('online', function() {
                self.dispatchBrowserStateEvent('online', {
                    online: true,
                    networkType: Utils.getNetworkEffectiveType(),
                    networkQuality: Utils.detectNetworkQuality(),
                });
            });

            /**
             * Handle browser going offline
             * Updates network state for all PAC containers
             */
            window.addEventListener('offline', function() {
                self.dispatchBrowserStateEvent('online', {
                    online: false,
                    networkType: Utils.getNetworkEffectiveType(),
                    networkQuality: Utils.detectNetworkQuality(),
                });
            });

            /**
             * Handle network connection changes (if supported)
             * Updates network quality when connection type changes
             */
            if ('connection' in navigator && navigator.connection) {
                navigator.connection.addEventListener('change', function() {
                    self.dispatchBrowserStateEvent('online', {
                        online: navigator.onLine,
                        networkType: Utils.getNetworkEffectiveType(),
                        networkQuality: Utils.detectNetworkQuality(),
                    });
                });
            }

            /**
             * Handle focus entering any element (captures phase)
             * Updates container focus states when focus moves into PAC containers
             */
            document.addEventListener('focusin', function(event) {
                self.dispatchFocusEvent('focusin', event);
            }, true);

            /**
             * Handle focus leaving any element (captures phase)
             * Updates container focus states when focus moves out of PAC containers
             */
            document.addEventListener('focusout', function(event) {
                self.dispatchFocusEvent('focusout', event);
            }, true);

            /**
             * Handle mouse button down events
             * Maps browser mouse button codes to application message types
             */
            document.addEventListener('mousedown', function (event) {
                let messageType;

                if (event.button === 0) {
                    messageType = MSG_TYPES.MSG_LBUTTONDOWN;
                } else if (event.button === 1) {
                    messageType = MSG_TYPES.MSG_MBUTTONDOWN;
                } else if (event.button === 2) {
                    messageType = MSG_TYPES.MSG_RBUTTONDOWN;
                } else {
                    return; // Unknown button
                }

                self.dispatchTrackedEvent(messageType, event);
            });

            /**
             * Handle mouse button up events
             * Maps browser mouse button codes to application message types
             */
            document.addEventListener('mouseup', function (event) {
                let messageType;

                if (event.button === 0) {
                    messageType = MSG_TYPES.MSG_LBUTTONUP;
                } else if (event.button === 1) {
                    messageType = MSG_TYPES.MSG_MBUTTONUP;
                } else if (event.button === 2) {
                    messageType = MSG_TYPES.MSG_RBUTTONUP;
                } else {
                    return; // Unknown button
                }

                self.dispatchTrackedEvent(messageType, event);
            });

            // Add click for semantic activation (form submission, etc.)
            document.addEventListener('click', function (event) {
                let messageType;

                if (event.button === 0) {
                    messageType = MSG_TYPES.MSG_LCLICK;  // Left click
                } else if (event.button === 1) {
                    messageType = MSG_TYPES.MSG_MCLICK;  // Middle click
                } else {
                    return;  // Should never happen for click events
                }

                self.dispatchTrackedEvent(messageType, event);
            });

            // Handle right click
            document.addEventListener('contextmenu', function (event) {
                self.dispatchTrackedEvent(MSG_TYPES.MSG_RCLICK, event);
            });

            /**
             * Handle mouse movement with throttling
             * Throttles updates to configured FPS (default 60fps = ~16ms)
             * Set wakaPAC.mouseMoveThrottleFps = 0 for no throttling (updates on every mousemove)
             * Set wakaPAC.mouseMoveThrottleFps = 120 for higher precision (gaming, drawing apps)
             * Must be set before first wakaPAC() call
             */
            let mouseMoveThrottle = null;

            document.addEventListener('mousemove', function (event) {
                // Calculate throttle delay from FPS (0 = no throttle)
                const throttleDelay = wakaPAC.mouseMoveThrottleFps > 0
                    ? 1000 / wakaPAC.mouseMoveThrottleFps
                    : 0;

                // No throttling - dispatch immediately
                if (throttleDelay === 0) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_MOUSEMOVE, event);
                    return;
                }

                // Throttled - only dispatch if not currently throttled
                if (!mouseMoveThrottle) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_MOUSEMOVE, event);
                    mouseMoveThrottle = setTimeout(() => {
                        mouseMoveThrottle = null;
                    }, throttleDelay);
                }
            });

            /**
             * Handle keyboard key release events
             * Tracks when user releases any key
             */
            document.addEventListener('keyup', function (event) {
                self.dispatchTrackedEvent(MSG_TYPES.MSG_KEYUP, event, {
                    key: event.key,
                    code: event.code
                });
            });

            /**
             * Handle keyboard key press events
             * Tracks when user presses any key down
             */
            document.addEventListener('keydown', function (event) {
                self.dispatchTrackedEvent(MSG_TYPES.MSG_KEYDOWN, event);
            });

            /**
             * Handle form element change events
             */
            document.addEventListener('change', function (event) {
                if (
                    event.target.tagName === 'SELECT' ||
                    event.target.type === 'radio' ||
                    event.target.type === 'checkbox'
                ) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_CHANGE, event, {
                        elementType: (event.target.tagName === 'SELECT') ? 'select' : event.target.type
                    });
                }
            });

            /**
             * Handle real-time input events for text fields
             * Tracks continuous user typing in text inputs and textareas.
             * Excludes radio buttons and checkboxes which use 'change' event instead.
             */
            document.addEventListener('input', function (event) {
                // Handle text inputs (excluding radio/checkbox) and textareas
                if (
                    (event.target.tagName === 'INPUT' && !['radio', 'checkbox'].includes(event.target.type)) ||
                    event.target.tagName === 'TEXTAREA'
                ) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_CHAR, event, {
                        elementType: (event.target.tagName === 'TEXTAREA') ? 'textarea' : 'input'
                    });
                }
            });

            /**
             * Handle form submission events
             * Tracks when user submits any form on the page
             */
            document.addEventListener('submit', function (event) {
                self.dispatchTrackedEvent(MSG_TYPES.MSG_SUBMIT, event);
            });

            /**
             * Handle scroll events (debounced for performance)
             * Updates current scroll position for all PAC containers
             */
            let scrollTimeout;
            window.addEventListener('scroll', function() {
                if (scrollTimeout) {
                    return;
                }

                scrollTimeout = setTimeout(() => {
                    self.dispatchBrowserStateEvent('scroll', {
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    });

                    scrollTimeout = null;
                }, 16); // ~60fps
            });

            /**
             * Handle window resize events (debounced for performance)
             * Updates viewport/document dimensions and scroll position
             */
            let resizeTimeout;
            window.addEventListener('resize', function() {
                if (resizeTimeout) {
                    return;
                }

                resizeTimeout = setTimeout(() => {
                    self.dispatchBrowserStateEvent('resize', {
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        documentWidth: document.documentElement.scrollWidth,
                        documentHeight: document.documentElement.scrollHeight,
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    });

                    resizeTimeout = null;
                }, 100);
            });
        },

        /**
         * Creates a custom event that wraps the original DOM event with additional
         * tracking data including Win32-style wParam/lParam values, timestamps,
         * and extended metadata. The event is dispatched to the nearest container
         * element with a [data-pac-id] attribute.
         * @param {string} messageType - The Win32 message type (e.g., MSG_LBUTTONDOWN, MSG_KEYUP)
         * @param {Event} originalEvent - The original DOM event to wrap
         * @param {Object} [extended={}] - Additional extended data to include in the event detail
         * @returns {void}
         */
        dispatchTrackedEvent(messageType, originalEvent, extended = {}) {
            // Find the nearest container element that should receive the event
            const container = originalEvent.target.closest('[data-pac-id]');

            // Exit early if no container is found - event cannot be properly tracked
            if (!container) {
                return;
            }

            // Process event modifiers - return early if event should be filtered
            if (!this.processEventModifiers(originalEvent.target, originalEvent)) {
                return;
            }

            // Build Win32-style parameters based on the message type and original event
            const params = this.buildParams(messageType, originalEvent, container);

            // Create the custom event with comprehensive tracking data
            const customEvent = new CustomEvent('pac:event', {
                detail: {
                    // Core Win32-style message data
                    message: messageType,
                    wParam: params.wParam,
                    lParam: params.lParam,

                    // Standard tracking fields for all events
                    timestamp: Date.now(),
                    target: originalEvent.target,
                    id: originalEvent.target.id || null,
                    value: Utils.readDOMValue(originalEvent.target),

                    // Reference to the original DOM event for debugging/advanced usage
                    originalEvent: originalEvent,

                    // Additional extended data provided by caller
                    extended: extended,
                }
            });

            // Forward event control methods to the original event
            // This allows consumers to call preventDefault() on the custom event
            // and have it affect the original event
            const methodsToForward = ['preventDefault', 'stopPropagation', 'stopImmediatePropagation'];

            methodsToForward.forEach(methodName => {
                // Store reference to the custom event's original method
                const originalCustomMethod = customEvent[methodName];

                // Override the method to call both the custom event method and original event method
                customEvent[methodName] = function() {
                    // Call the custom event's method first (if it exists)
                    if (originalCustomMethod) {
                        originalCustomMethod.call(this);
                    }

                    // Then call the original event's method (if it exists)
                    if (originalEvent[methodName]) {
                        originalEvent[methodName].call(originalEvent);
                    }
                };
            });

            // Dispatch the custom event to the container
            container.dispatchEvent(customEvent);
        },

        /**
         * Dispatches browser state events (visibility, online/offline, etc.) to all PAC containers
         * @param {string} stateType - Type of state change ('visibility', 'online', etc.)
         * @param {Object} stateData - State data to include in event
         */
        dispatchBrowserStateEvent(stateType, stateData) {
            const containers = document.querySelectorAll('[data-pac-id]');

            containers.forEach(container => {
                const customEvent = new CustomEvent('pac:browser-state', {
                    detail: {
                        target: container,
                        stateType: stateType,
                        stateData: stateData,
                        timestamp: Date.now()
                    }
                });

                container.dispatchEvent(customEvent);
            });
        },

        /**
         * Dispatches focus state changes to relevant PAC containers
         * Also dispatches PAC events for form elements that can have data bindings
         * @param focusType
         * @param originalEvent
         */
        dispatchFocusEvent(focusType, originalEvent) {
            const containers = document.querySelectorAll('[data-pac-id]');
            const { target, relatedTarget } = originalEvent;

            containers.forEach(container => {
                if (!this.isContainerAffected(container, target, relatedTarget)) {
                    return;
                }

                // Dispatch focus state event
                container.dispatchEvent(new CustomEvent('pac:focus-state', {
                    detail: {
                        focusType: focusType,
                        target: target,
                        relatedTarget: relatedTarget,
                        containerFocus: Utils.isElementDirectlyFocused(container),
                        containerFocusWithin: Utils.isElementFocusWithin(container),
                        timestamp: Date.now()
                    }
                }));

                // Also dispatch PAC events for form elements within this container
                if (Utils.belongsToPacContainer(container, target) && this.isFormElement(target)) {
                    if (focusType === 'focusin') {
                        this.dispatchTrackedEvent(MSG_TYPES.MSG_FOCUS, originalEvent);
                    } else if (focusType === 'focusout') {
                        this.dispatchTrackedEvent(MSG_TYPES.MSG_BLUR, originalEvent);
                    }
                }
            });
        },

        /**
         * Checks if focus change affects the container
         * @param container
         * @param target
         * @param relatedTarget
         * @returns {*|boolean}
         */
        isContainerAffected(container, target, relatedTarget) {
            const containsTarget = container.contains(target) || container === target;
            const containsRelated = relatedTarget && (container.contains(relatedTarget) || container === relatedTarget);
            return containsTarget || containsRelated;
        },

        /**
         * Checks if an element is a form element that can have data bindings
         * @param {Element} element - The element to check
         * @returns {boolean} True if element is a bindable form element
         */
        isFormElement(element) {
            return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
        },

        /**
         * Converts DOM event data into Win32 message format for consistent handling
         * across different event types. Each message type has specific parameter
         * encoding rules that match Win32 conventions.
         * @param {string} messageType - The Win32 message type constant
         * @param {Event} event - The original DOM event containing the raw data
         * @param {Element} container - The PAC container element with data-pac-id
         * @returns {Object} Object containing wParam and lParam values
         * @returns {number} returns.wParam - The wParam value (typically flags or primary data)
         * @returns {number|Object} returns.lParam - The lParam value (typically coordinates or secondary data)
         */
        buildParams(messageType, event, container) {
            switch(messageType) {
                // Mouse movement and button events - encode button states and coordinates
                case MSG_TYPES.MSG_MOUSEMOVE:
                case MSG_TYPES.MSG_LBUTTONDOWN:
                case MSG_TYPES.MSG_RBUTTONDOWN:
                case MSG_TYPES.MSG_MBUTTONDOWN:
                case MSG_TYPES.MSG_LBUTTONUP:
                case MSG_TYPES.MSG_RBUTTONUP:
                case MSG_TYPES.MSG_MBUTTONUP:
                case MSG_TYPES.MSG_LCLICK:
                case MSG_TYPES.MSG_MCLICK:
                case MSG_TYPES.MSG_RCLICK:
                    return {
                        wParam: this.buildMouseWParam(event),  // Mouse button and modifier key flags
                        lParam: this.buildMouseLParam(event, container)   // Packed x,y coordinates (container-relative)
                    };

                // Keyboard events - encode key codes and modifier states
                case MSG_TYPES.MSG_KEYDOWN:
                case MSG_TYPES.MSG_KEYUP:
                    return {
                        wParam: event.keyCode || event.which || 0,  // Virtual key code (fallback to 0 if undefined)
                        lParam: this.buildKeyboardLParam(event)     // Keyboard state flags and repeat count
                    };

                // Character and input change events - encode text length
                case MSG_TYPES.MSG_CHAR:
                    return {
                        wParam: (event.target && event.target.value) ? event.target.value.length : 0,  // Text length
                        lParam: 0  // Not used for these message types
                    };

                // Select/radio change event
                case MSG_TYPES.MSG_CHANGE:
                    return {
                        wParam: this.buildChangeWParam(event),
                        lParam: 0        // Not used for change events
                    }

                // Form submission events - encode form data
                case MSG_TYPES.MSG_SUBMIT: {
                    // Safety check for form element
                    if (!event.target || typeof event.target.elements === 'undefined') {
                        return {
                            wParam: null,
                            lParam: {}
                        };
                    }

                    try {
                        // Extract form data into a plain object
                        const formData = new FormData(event.target);
                        const formObject = Object.fromEntries(formData.entries());

                        return {
                            wParam: event.target.id || null,  // Form ID for identification
                            lParam: formObject                 // Serialized form data
                        };
                    } catch (error) {
                        // Handle FormData creation failures gracefully
                        console.warn('Failed to extract form data:', error);
                        return {
                            wParam: event.target.id || null,
                            lParam: {}
                        };
                    }
                }

                // Default case for unhandled message types
                default:
                    return {
                        wParam: 0,
                        lParam: 0
                    };
            }
        },

        /**
         * Builds wParam for mouse messages following Win32 WM_LBUTTONDOWN format
         * Contains key state flags indicating which modifier keys and mouse buttons are pressed
         * @param {Event} event - The mouse event
         * @returns {number} wParam value with packed key state flags
         */
        buildMouseWParam(event) {
            let wParam = 0;

            // Modifier key states
            if (event.ctrlKey) {
                wParam |= MK_CONTROL;
            }

            if (event.shiftKey) {
                wParam |= MK_SHIFT;
            }

            if (event.altKey) {
                wParam |= MK_ALT;
            }

            // Mouse button states (which buttons are currently held down)
            // Note: This shows ALL buttons held, not just the one that triggered the event
            if (event.buttons & 1) {
                wParam |= MK_LBUTTON;
            }

            if (event.buttons & 2) {
                wParam |= MK_RBUTTON;
            }

            if (event.buttons & 4) {
                wParam |= MK_MBUTTON;
            }

            return wParam;
        },

        /**
         * Builds lParam for mouse messages following Win32 format
         * Packs x,y coordinates into a single 32-bit value
         * Coordinates are relative to the container element (client-area relative)
         * LOWORD (bits 0-15) = x-coordinate, HIWORD (bits 16-31) = y-coordinate
         * @param {MouseEvent} event - The mouse event
         * @param {Element} container - The PAC container element with data-pac-id
         * @returns {number} lParam value with packed container-relative coordinates
         */
        buildMouseLParam(event, container) {
            // Get container's bounding rectangle to calculate relative coordinates
            const rect = container.getBoundingClientRect();

            // Calculate container-relative coordinates (client-area relative)
            // This matches Win32 convention where coordinates are relative to the window's client area
            const relativeX = event.clientX - rect.left;
            const relativeY = event.clientY - rect.top;

            // Clamp to 16-bit unsigned range and ensure non-negative
            const x = Math.max(0, Math.min(0xFFFF, Math.round(relativeX)));
            const y = Math.max(0, Math.min(0xFFFF, Math.round(relativeY)));

            // Pack coordinates: high 16 bits = y, low 16 bits = x
            return (y << 16) | x;
        },

        /**
         * Builds lParam for keyboard messages - simplified for web use
         * Only includes meaningful data available from JavaScript events
         * @param {KeyboardEvent} event - The keyboard event
         * @returns {number} lParam value with basic keyboard information
         */
        buildKeyboardLParam(event) {
            let lParam = 0;

            // Bits 0-15: Repeat count (1 for single press, higher for held keys)
            const repeatCount = event.repeat ? 2 : 1;
            lParam |= (repeatCount & 0xFFFF);

            // Bit 24: Extended key flag (arrow keys, function keys, etc.)
            if (this.isExtendedKey(event.code)) {
                lParam |= (1 << 24);
            }

            // Bit 31: Transition state (0 for keydown, 1 for keyup)
            if (event.type === 'keyup') {
                lParam |= (1 << 31);
            }

            return lParam;
        },

        /**
         * Builds wParam for change events based on element type
         * @param {Event} event - The change event
         * @returns {number} wParam value appropriate for the element type
         */
        buildChangeWParam(event) {
            const element = event.target;

            switch (element.type) {
                case 'checkbox':
                    return element.checked ? 1 : 0;  // Boolean state as integer

                case 'radio': {
                    // For radio buttons, get the selected index in the group
                    const radioGroup = document.querySelectorAll(`input[name="${element.name}"]`);
                    return Array.from(radioGroup).indexOf(element);
                }

                default:
                    // For selects and other elements, use selectedIndex if available
                    if ('selectedIndex' in element) {
                        return element.selectedIndex;
                    }

                    // Fallback to 0 for unknown element types
                    return 0;
            }
        },

        /**
         * Determines if a key is an "extended" key in Win32 terms
         * Extended keys include arrow keys, function keys, numpad keys, etc.
         * @param {string} code - The KeyboardEvent.code value
         * @returns {boolean} True if this is considered an extended key
         */
        isExtendedKey(code) {
            if (!code) {
                return false;
            }

            const extendedKeys = [
                // Arrow keys
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',

                // Function keys
                'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',

                // Navigation keys
                'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete',

                // Numpad keys (when NumLock is on)
                'NumpadEnter', 'NumpadDivide',

                // Windows/Meta keys
                'MetaLeft', 'MetaRight',

                // Menu key
                'ContextMenu'
            ];

            return extendedKeys.includes(code);
        },

        /**
         * Processes event modifiers from the data-pac-event attribute to control event behavior.
         * Handles both behavioral modifiers (prevent, stop) and key filtering for keyboard events.
         * Returns false if the event should be filtered out (not dispatched), true otherwise.
         * @param {HTMLElement} element - The DOM element that has the data-pac-event attribute
         * @param {Event} event - The original DOM event being processed
         * @returns {boolean} True if the event should be dispatched, false if it should be filtered out
         */
        processEventModifiers(element, event) {
            const originalEvent = event.detail?.originalEvent || event;
            const modifiers = element.getAttribute('data-pac-event');

            // No modifiers, process normally
            if (!modifiers) {
                return true;
            }

            const modifierList = modifiers.split(/\s+/);

            for (const modifier of modifierList) {
                switch (modifier.toLowerCase()) {
                    case 'prevent':
                        originalEvent.preventDefault();
                        break;

                    case 'stop':
                        originalEvent.stopPropagation();
                        break;

                    case 'enter':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'Enter') {
                                return false; // Don't dispatch event
                            }
                        }

                        break;

                    case 'escape':
                    case 'esc':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'Escape') {
                                return false;
                            }
                        }

                        break;

                    case 'space':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== ' ') {
                                return false;
                            }
                        }

                        break;

                    case 'tab':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'Tab') {
                                return false;
                            }
                        }

                        break;

                    case 'delete':
                    case 'del':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'Delete') {
                                return false;
                            }
                        }

                        break;

                    case 'up':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'ArrowUp') {
                                return false;
                            }
                        }

                        break;

                    case 'down':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'ArrowDown') {
                                return false;
                            }
                        }

                        break;

                    case 'left':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'ArrowLeft') {
                                return false;
                            }
                        }

                        break;

                    case 'right':
                        if (originalEvent.type === 'keyup' || originalEvent.type === 'keydown') {
                            if (originalEvent.key !== 'ArrowRight') {
                                return false;
                            }
                        }

                        break;
                }
            }

            return true; // Process the event
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
            // Remove whitespace around expression
            expression = String(expression).trim();

            // Tokenize and parse
            this.tokens = this.tokenize(expression);
            this.currentToken = 0;

            if (this.tokens.length === 0) {
                return null;
            }

            // Add dependencies to the result
            return this.parseTernary();
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

                return this.parsePostfixOperators({
                    type: 'parentheses',
                    inner: expr
                });
            }

            // Array literals
            if (this.match('LBRACKET')) {
                return this.parsePostfixOperators(this.parseArrayLiteral());
            }

            // Object literals
            if (this.match('LBRACE')) {
                return this.parsePostfixOperators(this.parseObjectLiteral());
            }

            // String literals
            if (this.check('STRING')) {
                return this.parsePostfixOperators({
                    type: 'literal',
                    value: this.advance().value
                });
            }

            // Number literals
            if (this.check('NUMBER')) {
                return this.parsePostfixOperators({
                    type: 'literal',
                    value: this.advance().value
                });
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

                return this.parsePostfixOperators({
                    type: 'literal',
                    value: value
                });
            }

            // Property access
            if (this.check('IDENTIFIER')) {
                return this.parsePostfixOperators(this.parsePropertyAccess());
            }

            return null;
        },

        /**
         * Parses postfix operators including array/object indexing, property access, and method calls.
         * Handles chaining of multiple postfix operations (e.g., obj.prop[0].method()).
         * @param {Object} expr - The base expression to apply postfix operators to
         * @returns {Object} The final expression tree with all postfix operations applied
         * @throws {Error} When expected tokens are missing (closing bracket, property name, closing parenthesis)
         */
        parsePostfixOperators(expr) {
            while (true) {
                if (this.match('LBRACKET')) {
                    // Array/object indexing: expr[index]
                    const index = this.parseTernary();
                    this.consume('RBRACKET', 'Expected closing bracket');
                    expr = {
                        type: 'index',
                        object: expr,
                        index
                    };
                } else if (this.match('DOT')) {
                    // Property access or method call
                    if (this.check('IDENTIFIER')) {
                        const property = this.advance().value;

                        // Check for method call syntax
                        if (this.match('LPAREN')) {
                            const args = this.parseArgumentList();
                            this.consume('RPAREN', 'Expected closing parenthesis');

                            expr = {
                                type: 'methodCall',
                                object: expr,
                                method: property,
                                arguments: args
                            };
                        } else {
                            // Regular property access
                            expr = {
                                type: 'member',
                                object: expr,
                                property
                            };
                        }
                    } else {
                        throw new Error('Expected property name after "."');
                    }
                } else {
                    break;
                }
            }
            return expr;
        },

        /**
         * Parses a comma-separated list of function arguments.
         * Continues parsing until reaching a closing parenthesis or end of input.
         * @returns {Array} Array of parsed argument expressions
         */
        parseArgumentList() {
            const args = [];

            if (!this.check('RPAREN')) {
                do {
                    args.push(this.parseTernary());
                } while (this.match('COMMA') && !this.check('RPAREN'));
            }

            return args;
        },

        /**
         * Parses an array literal expression, handling comma-separated elements.
         * Expects the opening bracket to already be consumed.
         * @returns {{type: string, elements: *[]}} AST node representing the array literal
         * @returns {string} returns.type - Always 'array'
         * @returns {Array} returns.elements - Array of parsed element expressions
         * @throws {Error} When closing bracket is missing
         * @example
         */
        parseArrayLiteral() {
            const elements = [];

            if (!this.check('RBRACKET')) {
                do {
                    elements.push(this.parseTernary());
                } while (this.match('COMMA') && !this.check('RBRACKET'));
            }

            this.consume('RBRACKET', 'Expected closing bracket');

            return {
                type: 'array',
                elements
            };
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

                case 'array':
                    return this.evaluateArrayLiteral(parsedExpr, context, scopeResolver);

                case 'object':
                    return this.evaluateObjectLiteral(parsedExpr, context, scopeResolver);

                case 'index': {
                    const object = this.evaluate(parsedExpr.object, context, scopeResolver);
                    const index = this.evaluate(parsedExpr.index, context, scopeResolver);
                    return object && object[index];
                }

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

                case 'member': {
                    const object = this.evaluate(parsedExpr.object, context, scopeResolver);
                    return object && object[parsedExpr.property];
                }

                case 'methodCall': {
                    const object = this.evaluate(parsedExpr.object, context, scopeResolver);

                    // Only allow method calls on arrays for security
                    if (!Array.isArray(object)) {
                        console.warn('Method calls only supported on arrays');
                        return undefined;
                    }

                    return this.evaluateArrayMethod(object, parsedExpr.method,
                        parsedExpr.arguments.map(arg => this.evaluate(arg, context, scopeResolver))
                    );
                }

                default:
                    return undefined;
            }
        },

        evaluateArrayMethod(array, methodName, args) {
            switch (methodName) {
                case 'includes':
                    // Check if array contains the value
                    return array.includes(args[0]);

                case 'indexOf':
                    // Find first index of value, -1 if not found
                    return array.indexOf(args[0]);

                case 'length':
                    // Array length (handled as method for consistency)
                    return array.length;

                case 'join':
                    // Join array elements with separator
                    return array.join(args[0] || ',');

                default:
                    console.warn(`Array method '${methodName}' not supported`);
                    return undefined;
            }
        },

        getProperty(path, obj, scopeResolver = null) {
            if (!obj || !path) {
                return undefined;
            }

            let resolvedPath = path;

            // Use context to resolve scoped paths if available
            if (scopeResolver && scopeResolver.resolveScopedPath) {
                resolvedPath = scopeResolver.resolveScopedPath(path);
            }

            // If resolved path is a number, return it directly
            if (typeof resolvedPath === 'number') {
                return resolvedPath;
            }

            // Ensure resolvedPath is a string for string operations
            resolvedPath = String(resolvedPath);

            // Handle simple property access (no dots or brackets)
            if (resolvedPath.indexOf('.') === -1 && resolvedPath.indexOf('[') === -1) {
                return (resolvedPath in obj) ? obj[resolvedPath] : undefined;
            }

            // Split path by both dots and brackets, handling bracket notation correctly
            const parts = resolvedPath.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);

            let current = obj;
            for (let i = 0; i < parts.length; i++) {
                if (current == null) {
                    return undefined;
                }

                const part = parts[i];
                current = current[part];
            }

            return current;
        },

        evaluateArrayLiteral(arrayExpr, context, resolverContext = null) {
            if (!arrayExpr.elements) {
                return [];
            }

            return arrayExpr.elements.map(element =>
                this.evaluate(element, context, resolverContext)
            );
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
            let bracketDepth = 0;  // ADD: Track bracket depth

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
                    } else if (char === '[') {          // ADD: Track opening brackets
                        bracketDepth++;
                    } else if (char === ']') {          // ADD: Track closing brackets
                        bracketDepth--;
                    }
                }

                // CHANGE: Only split on commas at top level (not inside nested structures)
                if (char === ',' && !inQuotes && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
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
            // Check for known binding types first
            for (const type of KNOWN_BINDING_TYPES) {
                if (str.startsWith(type + ':')) {
                    return type.length;
                }
            }

            let inQuotes = false;
            let quoteChar = '';
            let parenDepth = 0;
            let bracketDepth = 0;  // Track bracket depth for arrays
            let braceDepth = 0;    // Track brace depth for objects

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
                    } else if (char === '[') {
                        bracketDepth++;
                    } else if (char === ']') {
                        bracketDepth--;
                    } else if (char === '{') {
                        braceDepth++;
                    } else if (char === '}') {
                        braceDepth--;
                    } else if (char === ':' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
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

        /** @type {Map<string, *>} Internal cache for binding strings */
        bindingCache: new Map(),

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
         * Parses a binding string with caching support.
         * Uses string representation of the binding string as cache key for consistent lookups.
         * Implements simple LRU eviction when cache exceeds maxSize.
         * @param {string} bindingString - The binding string to parse (e.g., "value: name, class: { active: isActive }")
         * @returns {Array} The parsed binding pairs from ExpressionParser or cache
         */
        parseBindingString(bindingString) {
            // Convert to string and use as cache key
            // Trimming ensures consistent keys regardless of whitespace variations
            const key = String(bindingString).trim();

            // Check binding cache first - O(1) lookup
            if (this.bindingCache.has(key)) {
                return this.bindingCache.get(key);
            }

            // Parse using existing parser
            const result = ExpressionParser.parseBindingString(bindingString);

            // Cache management - implement simple LRU eviction for binding cache
            if (this.bindingCache.size >= this.maxSize) {
                // Simple LRU: delete oldest entry (first inserted)
                // Note: Map maintains insertion order, so first key is oldest
                const firstKey = this.bindingCache.keys().next().value;
                this.bindingCache.delete(firstKey);
            }

            // Store result in binding cache for future lookups
            this.bindingCache.set(key, result);
            return result;
        },

        /**
         * Clears all cached expressions.
         * Useful for memory management or when expression parsing logic changes.
         * @returns {void}
         */
        clear() {
            this.cache.clear();
            this.bindingCache.clear();
        }
    };

    // ========================================================================
    // DOM UPDATER - Handles ALL binding applications
    // ========================================================================

    function DomUpdater(context) {
        this.context = context;
    }

    /**
     * Updates a text node by interpolating expressions within the template string.
     * Replaces interpolation patterns with evaluated expression results.
     * @param {Text|Node} element - The text node or element to update
     * @param {string} template - Template string containing interpolation expressions (e.g., "Hello {{name}}")
     * @returns {void}
     */
    DomUpdater.prototype.updateTextNode = function (element, template) {
        const self = this;

        const newText = template.replace(INTERPOLATION_REGEX, (match, expression) => {
            try {
                // Parse the expression
                const parsed = ExpressionCache.parseExpression(expression);

                // Resolve the scope - use parentElement for text nodes
                const scopeResolver = {
                    resolveScopedPath: (path) => {
                        return self.context.normalizePath(path, element);
                    }
                };

                // Evaluate the expression using the scope resolver
                const result = ExpressionParser.evaluate(parsed, self.context.abstraction, scopeResolver);
                return result != null ? String(result) : '';
            } catch (error) {
                console.warn('Error in text interpolation:', expression, error);
                return match;
            }
        });

        if (element.textContent !== newText) {
            element.textContent = newText;
        }
    };

    /**
     * Updates an element's attribute or property based on data binding configuration.
     * Evaluates the binding expression and applies the result using the appropriate binding method.
     * @param {Element} element - The DOM element to update
     * @param {string} bindingType - Type of binding (value, checked, visible, class, style, or attribute name)
     * @param {Object} bindingData - Binding configuration object
     * @param {string} bindingData.target - Expression string to evaluate for the binding value
     * @returns {void}
     */
    DomUpdater.prototype.updateAttributeBinding = function (element, bindingType, bindingData) {
        try {
            // Parse the expression
            const parsed = ExpressionCache.parseExpression(bindingData.target);

            // Create resolver context for this element
            const scopeResolver = {
                resolveScopedPath: (path) => this.context.normalizePath(path, element)
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

                case 'if':  // Add this case
                    this.applyConditionalBinding(element, value);
                    break;

                case 'class':
                    this.applyClassBinding(element, value);
                    break;

                case 'style':
                    this.applyStyleBinding(element, value);
                    break;

                case 'click':
                case 'foreach':
                    // foreach bindings are handled during renderForeach, not as attributes
                    break;

                default:
                    this.applyAttributeBinding(element, bindingType, value);
                    break;
            }
        } catch (error) {
            console.warn('Error updating binding:', bindingType, bindingData, error);
        }
    };

    /**
     * Applies value binding to form elements, handling different input types appropriately.
     * For radio buttons, sets checked state based on value match. For other elements,
     * updates the value property if it has changed.
     * @param {HTMLElement} element - The DOM element to update
     * @param {*} value - The value to bind to the element
     */
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

    /**
     * Applies checked binding to checkbox and radio input elements.
     * Only updates the checked property when the value actually differs to avoid
     * unnecessary DOM mutations.
     * @param {HTMLElement} element - The DOM element to update (should be checkbox or radio)
     * @param {*} value - The value to determine checked state (will be converted to boolean)
     */
    DomUpdater.prototype.applyCheckedBinding = function (element, value) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            const newChecked = Boolean(value);

            // Only update if the value is actually different
            if (element.checked !== newChecked) {
                element.checked = newChecked;
            }
        }
    };

    /**
     * Applies visibility binding to elements by managing display CSS property.
     * Preserves original display value when hiding elements and restores it when showing.
     * Uses data attributes to track hidden state and original display value.
     * @param {HTMLElement} element - The DOM element to show or hide
     * @param {*} value - Truthy values show the element, falsy values hide it
     */
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

    /**
     * Applies conditional binding to show/hide DOM elements based on a boolean value.
     * This replaces elements with placeholder comments when hidden and restores them when shown.
     * @param {HTMLElement} element - The DOM element to show/hide
     * @param {*} value - Truthy values show the element, falsy values hide it
     */
    DomUpdater.prototype.applyConditionalBinding = function(element, value) {
        const shouldShow = !!value;

        // Initialize tracking properties if not already set
        if (!element._pacPlaceholder) {
            element._pacPlaceholder = document.createComment('pac-if: hidden');
            element._pacOriginalParent = element.parentNode;
            element._pacOriginalNextSibling = element.nextSibling;
            element._pacIsRendered = true; // Initially rendered

            // Store original HTML to restore if needed
            element._pacOriginalHTML = element.innerHTML;
        }

        // Show the element: replace placeholder with actual element
        if (shouldShow && !element._pacIsRendered) {
            // Restore element
            element._pacPlaceholder.parentNode.replaceChild(element, element._pacPlaceholder);
            element._pacIsRendered = true;

            this.context.scanAndRegisterNewElements(element);
        }

        // Hide the element: replace element with placeholder
        if (!shouldShow && element._pacIsRendered) {
            // Update stored HTML before hiding in case content changed
            element._pacOriginalHTML = element.innerHTML;

            // Replace element with placeholder comment
            if (element.parentNode) {
                element.parentNode.replaceChild(element._pacPlaceholder, element);
            }

            element._pacIsRendered = false;
        }
    };

    /**
     * Applies class binding to an element using either string or object syntax.
     * String syntax replaces all classes, object syntax toggles individual classes.
     * @param {Element} element - The DOM element to update
     * @param {string|Object<string, boolean>} value - Class value as string or object
     * @param {string} value - When string: replaces element.className entirely
     * @param {Object<string, boolean>} value - When object: keys are class names, values determine add/remove
     */
    DomUpdater.prototype.applyClassBinding = function (element, value) {
        if (typeof value === 'object' && value !== null) {
            Object.keys(value).forEach(className => {
                if (value[className]) {
                    element.classList.add(className);
                } else {
                    element.classList.remove(className);
                }
            });

            return;
        }

        if (typeof value === 'string') {
            // Remove previous dynamic class if it exists
            if (element._pacDynamicClass) {
                element.classList.remove(element._pacDynamicClass);
            }

            // Add new dynamic class
            element.classList.add(value);
            element._pacDynamicClass = value;
        }
    };

    /**
     * Applies style binding to an element using either object or string syntax.
     * Object syntax is preferred for performance and supports CSS custom properties.
     * @param {Element} element - The DOM element to update
     * @param {Object<string, string|number|null>|string} value - Style value as object or CSS string
     * @param {Object<string, string|number|null>} value - When object: property names mapped to values, supports CSS custom properties (--prop)
     * @param {string} value - When string: sets entire cssText (less efficient, backwards compatible)
     */
    DomUpdater.prototype.applyStyleBinding = function (element, value) {
        // Object syntax: { color: 'red', fontSize: '16px' }
        // Check if value is an object (preferred object syntax)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const prop in value) {
                if (value[prop] != null) {
                    if (prop.startsWith('--')) {
                        element.style.setProperty(prop, value[prop]);
                    } else {
                        element.style[prop] = value[prop];
                    }
                }
            }

            return;
        }

        // String syntax: "color: red; font-size: 16px;"
        // Set the entire CSS text at once (less efficient but backwards compatible)
        if (typeof value === 'string') {
            element.style.cssText = value;
        }
    };

    /**
     * Applies attribute binding to an element with special handling for boolean attributes.
     * Supports 'enable' as reverse of 'disabled' attribute.
     * @param {Element} element - The DOM element to update
     * @param {string} attribute - The attribute name to set
     * @param {*} value - The attribute value (null/undefined removes attribute)
     */
    DomUpdater.prototype.applyAttributeBinding = function (element, attribute, value) {
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

    function Context(container, abstraction, config) {
        const self = this;

        this.originalAbstraction = abstraction;
        this.parent = null;
        this.children = new Set();
        this.container = container;
        this.config = config;
        this.abstraction = this.createReactiveAbstraction();
        this.domUpdater = new DomUpdater(this);
        this.dependencies = this.getDependencies();
        this.interpolationMap = new Map();
        this.textInterpolationMap = new Map();
        this.arrayHashMaps = new Map();
        this._readyCalled = false;

        // Set up container-specific scroll tracking
        this.setupContainerScrollTracking();

        // Setup intersection observer for container visibility checking
        this.setupIntersectionObserver();

        // Add interval for checking updateQueue
        this.updateQueue = new Map();
        this.updateQueueCallback = function() { self.updateQueueHandler(); };
        this.updateQueueInterval = setInterval(this.updateQueueCallback, 10);

        // Handle click events
        this.boundHandlePacEvent = function(event) { self.handleEvent(event); };

        // Add listeners using the stored references
        this.container.addEventListener('pac:event', this.boundHandlePacEvent);
        this.container.addEventListener('pac:change', this.boundHandlePacEvent);
        this.container.addEventListener('pac:array-change', this.boundHandlePacEvent);
        this.container.addEventListener('pac:browser-state', this.boundHandlePacEvent);
        this.container.addEventListener('pac:focus-state', this.boundHandlePacEvent);

        // Call init() method if it exists after all setup is complete
        if (
            this.abstraction.init &&
            typeof this.abstraction.init === 'function'
        ) {
            try {
                this.abstraction.init.call(this.abstraction);
            } catch (error) {
                console.error('Error in init() method:', error);
            }
        }
    }

    Context.prototype.destroy = function() {
        // Clear updateQueueCallback interval
        clearInterval(this.updateQueueInterval);
        this.updateQueueCallback = null;

        // Remove event listeners
        this.container.removeEventListener('pac:event', this.boundHandlePacEvent);
        this.container.removeEventListener('pac:change', this.boundHandlePacEvent);
        this.container.removeEventListener('pac:array-change', this.boundHandlePacEvent);
        this.container.removeEventListener('pac:browser-state', this.boundHandlePacEvent);
        this.container.removeEventListener('pac:focus-state', this.boundHandlePacEvent);

        // Clear boundHandlePacEvent callback
        this.boundHandlePacEvent = null;

        // Clean up container scroll listener and the timeout for it
        if (this.containerScrollHandler) {
            clearTimeout(this.scrollTimeout);
            this.container.removeEventListener('scroll', this.containerScrollHandler);
            this.containerScrollHandler = null;
        }

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

        // Clean up all maps
        this.interpolationMap.clear();
        this.textInterpolationMap.clear();
        this.arrayHashMaps.clear();
        this.updateQueue.clear();
    }

    /**
     * Sets up scroll event tracking for the container element with debounced handling.
     * Creates an optimized scroll listener that updates container scroll state at ~60fps
     * to prevent performance issues during rapid scroll events.
     * @memberof {Object} - The parent class/object containing this method
     * @method setupContainerScrollTracking
     * @returns {void}
     */
    Context.prototype.setupContainerScrollTracking = function() {
        // First time setup
        requestAnimationFrame(() => this.updateContainerScrollState());

        // Inline debounce implementation
        const scrollHandler = () => {
            clearTimeout(this.scrollTimeout); // Use instance property
            this.scrollTimeout = setTimeout(() => {
                this.updateContainerScrollState();
            }, 16);
        };

        // Add scroll listener to this container
        this.container.addEventListener('scroll', scrollHandler, { passive: true });

        // Store reference for cleanup
        this.containerScrollHandler = scrollHandler;
    }

    // Add new method to update container scroll state
    Context.prototype.updateContainerScrollState = function() {
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
    }

    /**
     * Modern approach using Intersection Observer API.
     * This is more performant as it runs on the main thread and batches calculations.
     */
    Context.prototype.setupIntersectionObserver = function() {
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
    };

    /**
     * Manual visibility calculation using getBoundingClientRect().
     * This is the fallback method used when IntersectionObserver isn't available
     */
    Context.prototype.updateContainerVisibility = function() {
        // Get current state using Utils
        const rect = Utils.domRectToSimpleObject(this.container.getBoundingClientRect());

        // Set dimensions
        this.abstraction.containerClientRect = rect;
        this.abstraction.containerWidth = rect.width;
        this.abstraction.containerHeight = rect.height;

        // Use Utils for consistent visibility calculation
        this.abstraction.containerVisible = Utils.isElementVisible(this.container);
        this.abstraction.containerFullyVisible = Utils.isElementFullyVisible(this.container);
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
            if (element !== parentElement) {
                this.interpolationMap.set(element, mappingData);
            }
        });

        newTextBindings.forEach((mappingData, textNode) => {
            this.textInterpolationMap.set(textNode, mappingData);
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

    /**
     * Analyzes computed properties to build a dependency graph showing which computed
     * properties depend on which data properties.
     * @returns {Map<string, string[]>} A Map where keys are property names that are accessed
     */
    Context.prototype.getDependencies = function() {
        /** @type {Map<string, string[]>} Dependency map from property names to computed property names */
        const dependencies = new Map();

        /** @type {Object<string, Function>} Computed properties from the original abstraction */
        const computed = this.originalAbstraction.computed || {};

        /** @type {Set<string>} Tracks which properties are accessed during each computed property execution */
        const accessed = new Set();

        /** @type {Object} Proxy that intercepts property access to track dependencies */
        const proxy = new Proxy(this.originalAbstraction, {
            /**
             * Trap for property access - records accessed property names
             * @param {Object} target - The original abstraction object
             * @param {string|symbol} prop - The property being accessed
             * @returns {*} The property value
             */
            get(target, prop) {
                if (typeof prop === 'string') {
                    accessed.add(prop);
                }

                return target[prop];
            }
        });

        // Execute each computed property to discover its dependencies
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

    /**
     * Try to infer which array property in the abstraction is the "source" array
     * behind a given computed property (for example, linking `filteredTodos` back to `todos`).
     * @param {string} computedName - Name of the computed getter (e.g. `"filteredTodos"`).
     * @returns {string|null} The source array property name (e.g. `"todos"`) or null if not found.
     */
    Context.prototype.inferArrayRoot = function inferArrayRoot(computedName) {
        // Step 1: Try dependency map (cheap and reliable if set up correctly).
        for (const [rootProperty, dependentList] of this.dependencies) {
            const rootValue = this.abstraction[rootProperty];
            const isArrayRoot = Array.isArray(rootValue);

            if (dependentList.includes(computedName) && isArrayRoot) {
                return rootProperty; // e.g. "todos"
            }
        }

        // Nothing matched
        return computedName;
    };

    /**
     * Processes queued updates that are ready for execution.
     * Handles both delay-triggered and blur-triggered updates safely by avoiding
     * Map modification during iteration and providing proper error handling.
     * @returns {void}
     */
    Context.prototype.updateQueueHandler = function() {
        // Early exit if queue is empty for performance
        if (this.updateQueue.size === 0) {
            return;
        }

        const now = Date.now();
        const updatesToProcess = [];
        const pathsToDelete = [];

        // Step 1: Collect all expired updates without modifying the queue
        // This prevents the race condition of modifying a Map during iteration
        this.updateQueue.forEach((queueEntry, resolvedPath) => {
            if (queueEntry.trigger === 'delay' && now >= queueEntry.executeAt) {
                updatesToProcess.push({
                    path: resolvedPath,
                    value: queueEntry.value,
                    trigger: queueEntry.trigger
                });
                pathsToDelete.push(resolvedPath);
            }
        });

        // Step 2: Process all collected updates
        // Apply updates in batch to minimize reactive system overhead
        updatesToProcess.forEach(update => {
            try {
                // Apply the property update to the reactive abstraction
                // This will trigger any dependent DOM updates automatically
                Utils.setNestedProperty(update.path, update.value, this.abstraction);
            } catch (error) {
                // Log error with context for debugging, but continue processing other updates
                console.warn(`Error applying queued update for path "${update.path}":`, error);
            }
        });

        // Step 3: Clean up processed entries from the queue
        // Remove entries only after all processing is complete to maintain consistency
        pathsToDelete.forEach(path => {
            this.updateQueue.delete(path);
        });
    };

    /**
     * Processes queued updates that should trigger on blur for a specific element
     * @param {HTMLElement} targetElement - The element that just lost focus
     * @returns {void}
     */
    Context.prototype.processBlurQueueUpdates = function(targetElement) {
        const elementId = Utils.getElementIdentifier(targetElement);
        const updatesToProcess = [];

        // Find all queued updates for this element that should trigger on blur
        this.updateQueue.forEach((queueEntry, resolvedPath) => {
            if (queueEntry.trigger === 'blur' && queueEntry.elementId === elementId) {
                updatesToProcess.push({
                    path: resolvedPath,
                    value: queueEntry.value
                });
            }
        });

        // Apply all blur-triggered updates for this element
        updatesToProcess.forEach(update => {
            try {
                Utils.setNestedProperty(update.path, update.value, this.abstraction);
                this.updateQueue.delete(update.path);
            } catch (error) {
                console.warn('Error applying blur-triggered update for path:', update.path, error);
                // Remove failed update to prevent infinite retries
                this.updateQueue.delete(update.path);
            }
        });
    };

    /**
     * Retrieves the update configuration for a specific element, combining element-specific
     * attributes with context-wide configuration defaults.
     * @param {HTMLElement} element - The DOM element to get update configuration for
     * @returns {{updateMode: (string|string|*), delay: number}} The update configuration object
     * @returns {string} returns.updateMode - The update mode ('immediate' or other configured modes)
     * @returns {number} returns.delay - The delay in milliseconds, capped at maximum 3000ms
     */
    Context.prototype.getUpdateConfiguration = function(element) {
        // Check element attributes first
        const updateMode = element.getAttribute('data-pac-update-mode') || this.config.updateMode || 'immediate';
        const delay = parseInt(element.getAttribute('data-pac-update-delay')) || this.config.delay || 300;

        // Cap maximum delay at 3000ms for safety
        const cappedDelay = Math.min(delay, 3000);

        // Return the delay information
        return { updateMode, delay: cappedDelay };
    };

    /**
     * Handles incoming events by dispatching them to appropriate handler methods based on event type.
     * This is the central event routing mechanism for the Context system.
     * @param {Object} event - The event object to be processed
     * @param {string} event.type - The type of event, determines which handler is called
     * @param {...*} event - Additional event properties vary by event type
     */
    Context.prototype.handleEvent = function(event) {
        // Route events to specialized handlers based on type
        // Each event type corresponds to a different aspect of the PAC (Presentation-Abstraction-Control) architecture
        switch(event.type) {
            // Handle general PAC events (likely business logic or component interactions)
            case 'pac:event':
                this.handlePacEvent(event);
                break;

            // Handle array modification events (insertions, deletions, reordering)
            case 'pac:array-change':
                this.handleArrayChange(event);
                break;

            // Handle reactive data binding changes (property updates, computed value changes)
            case 'pac:change':
                this.handleReactiveChange(event);
                break;

            // Handle browser state changes (navigation, history, URL changes)
            case 'pac:browser-state':
                this.handleBrowserState(event);
                break;

            // Handle focus management events (element focus)
            case 'pac:focus-state':
                this.handleFocusState(event);
                break;

            default:
                console.warn(`Unhandled event type ${event.type}`);
                break;
        }
    };

    /**
     * Handles PAC events based on message type
     * @param {CustomEvent} event - The PAC event containing message details
     * @param {Object} event.detail - Event detail object
     * @param {Number} event.detail.message - Message type from MSG_TYPES constants
     * @returns {void}
     */
    Context.prototype.handlePacEvent = function(event) {
        // Call msgProc if it exists
        let allowDefault = true;

        if (this.originalAbstraction.msgProc && typeof this.originalAbstraction.msgProc === 'function') {
            const msgProcResult = this.originalAbstraction.msgProc.call(this.abstraction, event);

            // Only certain message types can be cancelled by msgProc
            const cancellableEvents = [
                MSG_TYPES.MSG_LBUTTONUP,
                MSG_TYPES.MSG_MBUTTONUP,
                MSG_TYPES.MSG_RBUTTONUP,
                MSG_TYPES.MSG_LCLICK,
                MSG_TYPES.MSG_MCLICK,
                MSG_TYPES.MSG_RCLICK,
                MSG_TYPES.MSG_SUBMIT,
                MSG_TYPES.MSG_CHANGE
            ];

            if (cancellableEvents.includes(event.detail.message) && msgProcResult === false) {
                allowDefault = false;
            }
        }

        // Prevent default if msgProc returned false for cancellable events
        if (!allowDefault) {
            event.preventDefault();
            return;
        }

        // Call built in event handlers
        switch(event.detail.message) {
            case MSG_TYPES.MSG_MOUSEMOVE:
            case MSG_TYPES.MSG_LBUTTONDOWN:
            case MSG_TYPES.MSG_MBUTTONDOWN:
            case MSG_TYPES.MSG_RBUTTONDOWN:
            case MSG_TYPES.MSG_LBUTTONUP:
            case MSG_TYPES.MSG_MBUTTONUP:
            case MSG_TYPES.MSG_RBUTTONUP:
            case MSG_TYPES.MSG_MCLICK:
            case MSG_TYPES.MSG_RCLICK:
                // Mouse movement and button events - no default action, handled by msgProc if needed
                break;

            case MSG_TYPES.MSG_KEYUP:
            case MSG_TYPES.MSG_KEYDOWN:
                // Raw key events - no action taken
                break;

            case MSG_TYPES.MSG_LCLICK:
                // Mouse button up events - handle DOM clicks
                this.handleDomClicks(event);
                break;

            case MSG_TYPES.MSG_SUBMIT:
                // Form submission events
                this.handleDomSubmit(event);
                break;

            case MSG_TYPES.MSG_CHANGE:
                // DOM change event
                this.handleDomChange(event);
                break;

            case MSG_TYPES.MSG_CHAR:
                // Character input
                this.handleDomInput(event);
                break;

            case MSG_TYPES.MSG_FOCUS:
                // Focus events - handle any focus-related logic
                this.handleDomFocus(event);
                break;

            case MSG_TYPES.MSG_BLUR:
                // Blur events - handle change mode updates and other blur logic
                this.handleDomBlur(event);
                break;

            default :
                console.warn(`Unhandled event type ${event.detail.message}`);
                break;
        }
    }

    /**
     * Handles DOM click events by executing bound abstraction methods.
     * Supports both regular click handlers and foreach context-aware handlers.
     * @param {CustomEvent} event - Custom event containing click details
     * @param {Element} event.detail.target - The DOM element that was clicked
     * @throws {Error} Logs errors if method execution fails
     */
    Context.prototype.handleDomClicks = function(event) {
        // Get interpolation data for the clicked element
        const mappingData = this.interpolationMap.get(event.detail.target);
        if (!mappingData?.bindings?.click) {
            return;
        }

        // Resolve the target method from the abstraction object
        const method = this.abstraction[mappingData.bindings.click.target];
        if (typeof method !== 'function') {
            return;
        }

        try {
            // Check if click occurred within a foreach loop context
            const contextInfo = this.extractClosestForeachContext(event.detail.target);

            // Simple case: call method with just the event
            if (!contextInfo) {
                method.call(this.abstraction, event);
                return;
            }

            // Find the foreach element that contains this click target
            const foreachElement = Array.from(this.interpolationMap.entries())
                .find(([, data]) => data.foreachId === contextInfo.foreachId)?.[0];

            if (!foreachElement) {
                // Fallback to simple call if foreach element not found
                method.call(this.abstraction, event);
                return;
            }

            // Get the foreach configuration and set up scope resolution
            const foreachData = this.interpolationMap.get(foreachElement);
            const scopeResolver = {
                resolveScopedPath: (path) => this.normalizePath(path, event.detail.target)
            };

            // Evaluate the foreach expression to get the source array
            const array = ExpressionParser.evaluate(
                ExpressionCache.parseExpression(foreachData.foreachExpr),
                this.abstraction,
                scopeResolver
            );

            // Call method with foreach context: (arrayItem, index, originalEvent)
            method.call(this.abstraction, array[contextInfo.index], contextInfo.index, event);
        } catch (error) {
            console.error(`Error executing click binding '${mappingData.bindings.click.target}':`, error);
        }
    }

    /**
     * Handles DOM submit events by executing bound abstraction methods.
     * @param {CustomEvent} event - The DOM submit event containing target element details
     * @param {Object} event.detail - Event detail object
     * @param {HTMLElement} event.detail.target - The DOM element that triggered the submit
     * @returns {void}
     */
    Context.prototype.handleDomSubmit = function(event) {
        // Retrieve mapping data for the target element from the interpolation map
        const mappingData = this.interpolationMap.get(event.detail.target);

        // Early return if no mapping exists or no submit binding is configured
        if (!mappingData?.bindings?.submit) {
            return;
        }

        // Get the method reference from the abstraction object using the binding target
        const method = this.abstraction[mappingData.bindings.submit.target];

        // Verify the target is actually a callable function
        if (typeof method !== 'function') {
            return;
        }

        try {
            // Execute the bound method with the abstraction as context and pass the event
            method.call(this.abstraction, event);
        } catch (error) {
            // Log execution errors with context for debugging
            console.error(`Error executing submit binding '${mappingData.bindings.submit.target}':`, error);
        }
    };

    /**
     * Handles DOM change events for data-bound elements, updating the underlying data model
     * when form controls change their values. This enables two-way data binding by listening
     * for custom DOM change events and propagating changes back to the data context.
     * @param {CustomEvent} event - The DOM change event containing target element and new value
     * @param {Element} event.detail.target - The DOM element that changed
     * @param {*} event.detail.value - The new value from the changed element
     */
    Context.prototype.handleDomChange = function(event) {
        const self = this;
        const targetElement = event.detail.target;

        // Get the mapping data for this specific element from the interpolation map
        // This contains all the binding information (value, checked, etc.) for the element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found, this element isn't data-bound so nothing to do
        if (!mappingData) {
            return;
        }

        // Handle value binding (for inputs, selects, textareas)
        // This covers most form controls that have a "value" property
        if (mappingData.bindings.value) {
            // Fetch value binding
            const valueBinding = mappingData.bindings.value;

            // Resolve the target path considering any scoped context (e.g., loops, nested objects)
            const resolvedPath = self.normalizePath(valueBinding.target, targetElement);

            // Update the data model using nested property setter to handle complex object paths
            // e.g., "user.profile.name" gets properly set in the nested object structure
            Utils.setNestedProperty(resolvedPath, event.detail.value, this.abstraction);
        }

        // Handle checked binding (for checkboxes and radio buttons)
        // These controls have special behavior different from regular value binding
        if (mappingData.bindings.checked) {
            // Fetch checked binding
            const checkedBinding = mappingData.bindings.checked;

            // Resolve the target path for the checked property binding
            const resolvedPath = self.normalizePath(checkedBinding.target, targetElement);

            // Checkbox: set boolean value based on checked state
            // Radio button: only update when this radio is selected, use its value
            if (targetElement.type === 'checkbox') {
                Utils.setNestedProperty(resolvedPath, event.detail.target.checked, this.abstraction);
            } else if (targetElement.type === 'radio' && event.detail.target.checked) {
                Utils.setNestedProperty(resolvedPath, event.detail.value, this.abstraction);
            }
        }

        // Handle change binding (method execution)
        if (mappingData.bindings.change) {
            // Resolve the target method from the abstraction object
            const method = this.abstraction[mappingData.bindings.change.target];

            if (typeof method === 'function') {
                try {
                    // Execute the bound method with the abstraction as context
                    method.call(this.abstraction, event);
                } catch (error) {
                    console.error(`Error executing change binding '${mappingData.bindings.change.target}':`, error);
                }
            }
        }
    };

    /**
     * Handles DOM change events for data-bound elements, updating the underlying data model
     * when form controls change their values. This enables two-way data binding by listening
     * for custom DOM change events and propagating changes back to the data context.
     * @param {CustomEvent} event - The DOM change event containing target element and new value
     * @param {Element} event.detail.target - The DOM element that changed
     * @param {*} event.detail.value - The new value from the changed element
     */
    Context.prototype.handleDomInput = function(event) {
        const self = this;
        const targetElement = event.detail.target;

        // Get the mapping data for this specific element from the interpolation map
        // This contains all the binding information (value, checked, etc.) for the element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data found, this element isn't data-bound so nothing to do
        if (!mappingData) {
            return;
        }

        // Handle value binding (for inputs, selects, textareas)
        // This covers most form controls that have a "value" property
        if (mappingData.bindings.value) {
            // Fetch value binding
            const valueBinding = mappingData.bindings.value;

            // Resolve the target path considering any scoped context (e.g., loops, nested objects)
            const resolvedPath = self.normalizePath(valueBinding.target, targetElement);

            // Get update configuration for this element
            const config = this.getUpdateConfiguration(targetElement);

            // Update the data model using nested property setter to handle complex object paths
            // e.g., "user.profile.name" gets properly set in the nested object structure
            switch (config.updateMode) {
                case 'immediate':
                    // Immediate update - bypass queue entirely
                    Utils.setNestedProperty(resolvedPath, event.detail.value, this.abstraction);
                    break;

                case 'delayed':
                    // Delayed update - add to queue with time trigger
                    this.updateQueue.set(resolvedPath, {
                        trigger: 'delay',
                        value: event.detail.value,
                        executeAt: Date.now() + config.delay
                    });

                    break;

                case 'change':
                    // Change mode - add to queue with blur trigger
                    this.updateQueue.set(resolvedPath, {
                        trigger: 'blur',
                        value: event.detail.value,
                        elementId: Utils.getElementIdentifier(targetElement)
                    });

                    break;
            }
        }
    };

    /**
     * Handles DOM focus events for data-bound elements
     * @param {CustomEvent} event - The focus event containing target element details
     * @param {Object} event.detail - Event detail object
     * @param {HTMLElement} event.detail.target - The DOM element that gained focus
     * @returns {void}
     */
    Context.prototype.handleDomFocus = function(event) {
        const targetElement = event.detail.target;

        // Get the mapping data for this element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data, this element isn't data-bound
        if (!mappingData) {
            return;
        }

        // For now, focus events don't trigger immediate actions
        // but this is where you could add focus-related behaviors like:
        // - Clearing validation messages
        // - Highlighting related fields
        // - Loading autocomplete data
        // - Analytics tracking

        // Future: Could execute focus binding if implemented
        // if (mappingData.bindings.focus) {
        //     const method = this.abstraction[mappingData.bindings.focus.target];
        //     if (typeof method === 'function') {
        //         method.call(this.abstraction, event);
        //     }
        // }
    };

    /**
     * Handles DOM blur events for data-bound elements
     * Processes any pending "change" mode updates that should trigger on blur
     * @param {CustomEvent} event - The blur event containing target element details
     * @param {Object} event.detail - Event detail object
     * @param {HTMLElement} event.detail.target - The DOM element that lost focus
     * @returns {void}
     */
    Context.prototype.handleDomBlur = function (event) {
        const targetElement = event.detail.target;

        // Get the mapping data for this element
        const mappingData = this.interpolationMap.get(targetElement);

        // If no mapping data, this element isn't data-bound
        if (!mappingData) {
            return;
        }

        // Process any queued "change" mode updates for this element
        this.processBlurQueueUpdates(targetElement);

        // Future: Could execute blur binding if implemented
        // if (mappingData.bindings.blur) {
        //     const method = this.abstraction[mappingData.bindings.blur.target];
        //     if (typeof method === 'function') {
        //         method.call(this.abstraction, event);
        //     }
        // }
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
    Context.prototype.handleReactiveChange = function (event) {
        // Simple approach: check every element binding to see if it needs updating
        this.interpolationMap.forEach((mappingData, element) => {
            const { bindings } = mappingData;

            Object.keys(bindings).forEach(bindingType => {
                // Skip foreach and click binds. They are handled elsewhere
                if (['foreach', 'click'].includes(bindingType)) {
                    return;
                }

                // Fetch the binding type
                const bindingData = bindings[bindingType];

                // For each binding, evaluate it now and see if the result changed
                try {
                    // Create scope resolver for this element
                    const scopeResolver = {
                        resolveScopedPath: (path) => this.normalizePath(path, element)
                    };

                    // Parse and evaluate the binding expression
                    const parsed = ExpressionCache.parseExpression(bindingData.target);
                    const currentValue = ExpressionParser.evaluate(parsed, this.abstraction, scopeResolver);

                    // Store previous values to detect changes
                    if (!element._pacPreviousValues) {
                        element._pacPreviousValues = {};
                    }

                    // Grab previous value
                    const previousValue = element._pacPreviousValues[bindingType];

                    // Update if value changed
                    if (!Utils.isEqual(previousValue, currentValue)) {
                        element._pacPreviousValues[bindingType] = currentValue;
                        this.domUpdater.updateAttributeBinding(element, bindingType, bindingData);
                    }
                } catch (error) {
                    console.warn('Error evaluating binding:', bindingType, error);
                }
            });
        });

        // Handle text interpolations with proper foreach context resolution
        this.textInterpolationMap.forEach((mappingData, textNode) => {
            try {
                // Store previous text content to detect changes
                if (!textNode._pacPreviousText) {
                    textNode._pacPreviousText = textNode.textContent;
                }

                const newText = mappingData.template.replace(INTERPOLATION_REGEX, (match, expression) => {
                    try {
                        const parsed = ExpressionCache.parseExpression(expression);
                        const scopeResolver = {
                            resolveScopedPath: (path) => this.normalizePath(path, textNode)
                        };
                        const result = ExpressionParser.evaluate(parsed, this.abstraction, scopeResolver);
                        return result != null ? String(result) : '';
                    } catch (error) {
                        console.warn('Error evaluating text interpolation:', expression, error);
                        return match;
                    }
                });

                // Only update if text actually changed
                if (textNode._pacPreviousText !== newText) {
                    textNode.textContent = newText;
                    textNode._pacPreviousText = newText;
                }
            } catch (error) {
                console.warn('Error updating text node:', error);
            }
        });

        // Handle watchers for root-level changes
        if (event.detail.path.length === 1) {
            this.triggerWatcher(event.detail.path[0], event.detail.newValue, event.detail.oldValue);
        }

        // Handle foreach rebuilds only for array changes
        if (event.detail.path.length === 1 && Array.isArray(this.abstraction[event.detail.path[0]])) {
            const foreachElements = this.findForeachElementsByArrayPath(event.detail.path[0]);
            foreachElements.forEach((el) => {
                if (this.shouldRebuildForeach(el)) {
                    this.renderForeach(el);
                }
            });
        }
    };

    /**
     * Triggers watchers for property changes - simple property name matching only
     * @param {string} property - The property that changed
     * @param {*} newValue - The new value
     * @param {*} oldValue - The old value
     */
    Context.prototype.triggerWatcher = function(property, newValue, oldValue) {
        // Guard missing watch object
        if (!this.originalAbstraction.watch) {
            return;
        }

        // Only handle direct property watchers - no pattern matching
        if (
            this.originalAbstraction.watch[property] &&
            typeof this.originalAbstraction.watch[property] === 'function'
        ) {
            try {
                this.originalAbstraction.watch[property].call(this.abstraction, newValue, oldValue);
            } catch (error) {
                console.error('Error in watcher for \'' + property + '\':', error);
            }
        }
    };

    /**
     * Handles browser state change events and updates the context abstraction accordingly.
     * This method processes various types of browser state changes including visibility,
     * network connectivity, scroll position, and viewport dimensions.
     * @param {CustomEvent} event - Browser state change event
     * @param {Object} event.detail - Event payload containing state information
     * @param {string} event.detail.stateType - Type of state change ('visibility'|'online'|'scroll'|'resize')
     * @param {Object} event.detail.stateData - State-specific data object
     */
    Context.prototype.handleBrowserState = function(event) {
        const { stateType, stateData } = event.detail;

        switch(stateType) {
            case 'visibility':
                // Update browser visibility state
                this.abstraction.browserVisible = stateData.visible;
                break;

            case 'online':
                // Update network connectivity and connection type
                this.abstraction.browserOnline = stateData.online;
                this.abstraction.browserNetworkEffectiveType = stateData.networkType;
                this.abstraction.browserNetworkQuality = stateData.networkQuality;
                break;

            case 'scroll':
                // Update scroll position coordinates
                this.abstraction.browserScrollX = stateData.scrollX;
                this.abstraction.browserScrollY = stateData.scrollY;
                break;

            case 'resize':
                // Update viewport dimensions and document size
                this.abstraction.browserViewportWidth = stateData.viewportWidth;
                this.abstraction.browserViewportHeight = stateData.viewportHeight;
                this.abstraction.browserDocumentWidth = stateData.documentWidth;
                this.abstraction.browserDocumentHeight = stateData.documentHeight;

                // Update scroll position (resize can change scroll)
                this.abstraction.browserScrollX = stateData.scrollX;
                this.abstraction.browserScrollY = stateData.scrollY;

                // Recalculate container visibility after dimension changes
                this.updateContainerVisibility();
                break;

            default:
                console.warn('Unknown browser state message ' + stateType);
                break;
        }
    };

    /**
     * Update focus properties directly from the event detail
     * These are pre-calculated in DomUpdateTracker to avoid redundant computations
     * @param event
     */
    Context.prototype.handleFocusState = function(event) {
        this.abstraction.containerFocus = event.detail.containerFocus;
        this.abstraction.containerFocusWithin = event.detail.containerFocusWithin;
    };

    /**
     * Handles array change events by re-rendering associated foreach elements.
     * @param {CustomEvent} event - The array change event containing details about the modification
     * @param {Object} event.detail - The event detail object
     * @param {Array<string|number>} event.detail.path - Array representing the path to the changed array
     */
    Context.prototype.handleArrayChange = function(event) {
        // Convert the array path to a dot-notation string for easier matching
        // e.g., ['users', 0, 'orders'] becomes 'users.0.orders'
        const pathString = Utils.pathArrayToString(event.detail.path);

        // Locate all DOM elements with foreach directives that are bound to this array path
        // This method searches the DOM for elements whose foreach binding matches the changed array
        const foreachElements = this.findForeachElementsByArrayPath(pathString);

        // Re-render each affected foreach element to reflect the array changes
        // The index parameter is provided by forEach but not used in this implementation
        foreachElements.forEach((element) => {
            // Fetch the changes list
            const oldHashMap = this.arrayHashMaps.get(pathString) || new Map();
            const changes = this.classifyArrayChanges(oldHashMap, event.detail.newValue);

            if (this.canHandleSimply(changes)) {
                // Simple approach: handle common cases efficiently, fall back for complex ones
                this.handleSimpleArrayChange(element, changes, event.detail.newValue, pathString);
            } else {
                // Trigger a complete re-render of the foreach element
                // This will recreate child elements based on the updated array data
                this.renderForeach(element);
            }
        });
    };

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
            if (!Utils.belongsToPacContainer(self.container, element)) {
                return;
            }

            const bindingString = element.getAttribute('data-pac-bind');
            const parsedBindings = ExpressionCache.parseBindingString(bindingString);

            // Transform bindings array into object keyed by binding type
            const bindingsObject = {};
            parsedBindings.forEach(binding => {
                bindingsObject[binding.type] = {
                    target: binding.target
                };
            });

            // Put the data in the map
            interpolationMap.set(element, {
                bindingString: bindingString,
                bindings: bindingsObject
            });
        });

        // Extend data of foreach bindings
        this.extendBindingsWithForEachData(interpolationMap);

        // Return the map
        return interpolationMap;
    };

    Context.prototype.findElementByForEachId = function(forEachId) {
        for (const [element, mappingData] of this.interpolationMap) {
            if (mappingData.foreachId === forEachId) {
                return element;
            }
        }

        return null;
    };

    /**
     * Extend data of foreach binds
     * @param interpolationMap {Map<WeakKey, any>}
     */
    Context.prototype.extendBindingsWithForEachData = function(interpolationMap) {
        const self = this;

        interpolationMap.forEach((mappingData, element) => {
            // Do nothing when this is not a foreach binding
            if (!mappingData.bindings.foreach) {
                return;
            }

            // Do nothing when the binding already has a foreachId
            if (mappingData.foreachId) {
                return;
            }

            // If the element has an foreach-id attribute, but no internal foreachId, this is probably
            // a foreach that becomes out of hiding through the if binding. Lookup the previous element
            // and put its elementData inside the new element. Then remove the old binding
            if (element.hasAttribute('data-pac-foreach-id')) {
                const foreachId = element.getAttribute('data-pac-foreach-id');
                const elementByForEach = self.findElementByForEachId(foreachId);
                const elementData = self.interpolationMap.get(elementByForEach);

                interpolationMap.set(element, elementData);
                self.interpolationMap.delete(elementByForEach);
                return;
            }

            // Set a new foreachId
            const foreachId = Utils.uniqid('foreach');
            element.setAttribute('data-pac-foreach-id', foreachId);

            // Store the updated mapping data into the map
            const foreachExpr = mappingData.bindings.foreach.target;
            const itemVar = element.getAttribute('data-pac-item') || 'item';
            const indexVar = element.getAttribute('data-pac-index') || 'index';

            Object.assign(mappingData, {
                foreachId: foreachId,
                foreachExpr: foreachExpr,
                sourceArray: this.inferArrayRoot(foreachExpr),
                template: element.innerHTML, // Capture clean template
                itemVar: itemVar,
                indexVar: indexVar
            });

            interpolationMap.set(element, mappingData);
        })
    }

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
            {
                acceptNode: node => {
                    // Skip if no interpolation
                    if (!INTERPOLATION_TEST_REGEX.test(node.textContent)) {
                        return NodeFilter.FILTER_SKIP;
                    }

                    // Skip if belongs to a nested PAC container
                    if (!Utils.belongsToPacContainer(this.container, node)) {
                        return NodeFilter.FILTER_SKIP;
                    }

                    // Process this node
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // Walk through matching text nodes that belong to this container
        let element;

        while ((element = walker.nextNode())) {
            // Skip elements that are already in the map
            if (interpolationMap.has(element)) {
                continue;
            }

            // Skip elements that don't belong to this container
            if (!Utils.belongsToPacContainer(this.container, element)) {
                continue;
            }

            interpolationMap.set(element, {
                template: element.textContent
            });
        }

        return interpolationMap;
    };

    /**
     * Setup reactive properties for this container
     * @returns {*|object}
     */
    Context.prototype.createReactiveAbstraction = function() {
        const self = this;

        // Inject system properties
        this.injectHierarchyProperties(this.originalAbstraction);
        this.injectSystemProperties(this.originalAbstraction);

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

        /**
         * Hierarchy communication methods
         */
        Object.assign(proxiedReactive, {
            /**
             * Sends a notification to the parent component
             * @param {string} type - Type of notification
             * @param {*} data - Data to send with the notification
             */
            notifyParent: (type, data) => self.notifyParent(type, data),

            /**
             * Sends a command to all child components
             * @param {string} cmd - Command to send
             * @param {*} data - Data to send with the command
             */
            notifyChildren: (cmd, data) => self.notifyChildren(cmd, data),

            /**
             * Sends a command to a specific child component
             * @param {string|Function} selector - Selector to find the target child
             * @param {string} cmd - Command to send
             * @param {*} data - Data to send with the command
             */
            notifyChild: (selector, cmd, data) => self.notifyChild(selector, cmd, data),

            /**
             * Serializing the reactive object to JSON (excluding non-serializable properties)
             * @returns {Object}
             */
            toJSON: function() {
                // Initialize the result object that will hold serializable properties
                const result = {};

                // Get list of computed property names from the original component definition
                // Computed properties are derived values and shouldn't be serialized
                const computedProps = self.originalAbstraction.computed ? Object.keys(self.originalAbstraction.computed) : [];

                // Iterate through all properties in the component's abstraction layer
                Object.keys(this).forEach(key => {
                    const value = this[key];

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
        });

        // Add utility methods as non-enumerable properties
        Object.defineProperties(proxiedReactive, {

            /**
             * Formats a value for display in text content or UI elements
             * Handles null/undefined, objects, arrays, and primitives appropriately
             * @param {*} value - Value to format for display
             * @returns {string} Human-readable formatted string
             */
            formatValue: {
                value: (value) => Utils.formatValue(value),
                writable: false,
                enumerable: false
            },

            /**
             * Escapes HTML entities to prevent XSS when displaying user input
             * Converts <, >, &, quotes to their HTML entity equivalents
             * @param {string} str - String to escape HTML entities in
             * @returns {string} HTML-safe escaped string
             */
            escapeHTML: {
                value: (str) => Utils.escapeHTML(str),
                writable: false,
                enumerable: false
            },

            /**
             * Strips all HTML tags from user input to get plain text
             * Use this for user-generated content that should not contain HTML
             * @param {string} html - HTML string to sanitize
             * @returns {string} Plain text with all HTML tags removed
             */
            sanitizeUserInput: {
                value: (html) => Utils.sanitizeUserInput(html),
                writable: false,
                enumerable: false
            },

            /**
             * Gets the global position of an element within the document
             * @param {string|Element} elementOrId - Element ID or DOM element
             * @returns {Object|null} Position object with x, y properties or null if not found
             */
            getElementPosition: {
                value: (elementOrId) => Utils.getElementPosition(elementOrId),
                writable: false,
                enumerable: false
            },

            /**
             * Extracts mouse coordinates from lParam value
             * Mouse coordinates are packed into lParam as two 16-bit integers
             * Coordinates are container-relative (relative to the container's top-left corner)
             * To get absolute viewport coordinates, use event.detail.originalEvent.clientX/Y
             * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
             * @returns {{x: number, y: number}} Object containing container-relative x and y coordinates
             */
            LOWORD: {
                value: (lParam) => Utils.LOWORD(lParam),
                writable: false,
                enumerable: false
            },

            /**
             * Extracts the high-order word (y coordinate) from lParam
             * Equivalent to Win32 HIWORD macro - gets bits 16-31
             * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
             * @returns {number} Y coordinate relative to container's top edge
             */
            HIWORD: {
                value: (lParam) => Utils.HIWORD(lParam),
                writable: false,
                enumerable: false
            },

            /**
             * Extracts both x and y coordinates from lParam
             * Equivalent to Win32 MAKEPOINTS macro - converts lParam to POINTS structure
             * Coordinates are container-relative (relative to the container's top-left corner)
             * To get absolute viewport coordinates, use event.detail.originalEvent.clientX/Y
             * @param {number} lParam - Packed mouse coordinates from event.detail.lParam
             * @returns {{x: number, y: number}} Object containing container-relative x and y coordinates
             */
            MAKEPOINTS: {
                value: (lParam) => Utils.MAKEPOINTS(lParam),
                writable: false,
                enumerable: false
            }
        });

        // Return the proxy
        return proxiedReactive;
    };

    /**
     * Injects hierarchy-related properties into an abstraction object.
     * These properties are used to track parent-child relationships within a hierarchical structure.
     * @param {Object} abstraction - The abstraction object to inject properties into
     * @param {number} abstraction.childrenCount - Will be set to 0, representing the number of child elements
     * @param {boolean} abstraction.hasParent - Will be set to false, indicating whether this abstraction has a parent
     * @returns {void} This method modifies the abstraction object in place
     */
    Context.prototype.injectHierarchyProperties = function(abstraction) {
        abstraction.childrenCount = 0;
        abstraction.hasParent = false;
    };

    /**
     * Injects system properties into the abstraction
     * @param {Object} abstraction - The abstraction to enhance
     */
    Context.prototype.injectSystemProperties = function(abstraction) {
        // Initialize online/offline state and network quality
        abstraction.browserOnline = navigator.onLine;
        abstraction.browserNetworkEffectiveType = Utils.getNetworkEffectiveType();
        abstraction.browserNetworkQuality = Utils.detectNetworkQuality();

        // Initialize page visibility state - tracks if the browser tab/window is currently visible
        // Useful for pausing animations or reducing CPU usage when user switches tabs
        abstraction.browserVisible = !document.hidden;

        // Initialize current horizontal/vertical scroll position in pixels from left/top of document
        abstraction.browserScrollX  = window.scrollX;
        abstraction.browserScrollY = window.scrollY;

        // Initialize current viewport width & height - the visible area of the browser window
        // Updates automatically when user resizes window or rotates mobile device
        abstraction.browserViewportHeight = window.innerHeight;
        abstraction.browserViewportWidth = window.innerWidth;

        // Initialize total document width/height including content outside the viewport
        // Useful for calculating scroll percentages or infinite scroll triggers
        abstraction.browserDocumentWidth = document.documentElement.scrollWidth;
        abstraction.browserDocumentHeight = document.documentElement.scrollHeight;

        // Container scroll properties
        abstraction.containerIsScrollable =  false;                               // Can scroll in any direction
        abstraction.containerScrollX = this.container.scrollLeft;                 // Current horizontal scroll position
        abstraction.containerScrollY = this.container.scrollTop;                  // Current vertical scroll position
        abstraction.containerScrollContentWidth = this.container.scrollWidth;     // Total scrollable content width
        abstraction.containerScrollContentHeight = this.container.scrollHeight;   // Total scrollable content height
        abstraction.containerScrollWindow = {
            top: 0,        // scrollTop
            left: 0,       // scrollLeft
            right: 0,      // scrollWidth
            bottom: 0,     // scrollHeight
            x: 0,          // scrollLeft (alias)
            y: 0           // scrollTop (alias)
        };

        // Per-container viewport visibility properties
        abstraction.containerFocus = Utils.isElementDirectlyFocused(this.container);
        abstraction.containerFocusWithin = Utils.isElementFocusWithin(this.container);
        abstraction.containerVisible = Utils.isElementVisible(this.container);
        abstraction.containerFullyVisible = Utils.isElementFullyVisible(this.container);
        abstraction.containerClientRect = {top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0};
        abstraction.containerWidth = this.container.clientWidth;
        abstraction.containerHeight = this.container.clientHeight;
    };

    /**
     * Finds the nearest parent element that has a foreach binding.
     * @param {Element} element - The DOM element to start searching from. Must be a valid DOM Element.
     * @returns {Element|null} The nearest parent element with a foreach binding, or null
     */
    Context.prototype.findParentForeachElement = function(element) {
        let current = element.parentElement;

        while (current && current !== this.container) {
            if (current.hasAttribute('data-pac-bind') &&
                current.getAttribute('data-pac-bind').includes('foreach:')) {
                return current;
            }

            current = current.parentElement;
        }

        return null;
    }

    /**
     * Renders a foreach loop by evaluating its array expression and generating DOM content.
     * @param {Element} foreachElement - DOM element with foreach binding
     * @returns {void}
     */
    Context.prototype.renderForeach = function(foreachElement) {
        const self = this;
        const mappingData = this.interpolationMap.get(foreachElement);

        if (!mappingData || !mappingData.foreachId) {
            console.warn('No foreach binding found for element');
            return;
        }

        // Keep array path for later use
        const arrayPath = mappingData.sourceArray;

        // Clean up old elements from maps before clearing innerHTML
        // This prevents memory leaks when re-rendering dynamic content
        this.cleanupForeachMaps(foreachElement);

        // Create scope resolver for this foreach element
        // This handles variable resolution in nested contexts (e.g., converting "todo.subs" to "todos[0].subs")
        const scopeResolver = {
            resolveScopedPath: (path) => this.normalizePath(path, foreachElement)
        };

        try {
            // Evaluate the foreach expression (e.g., "todos" or "todo.subs")
            const array = ExpressionParser.evaluate(
                ExpressionCache.parseExpression(mappingData.foreachExpr),
                this.abstraction,
                scopeResolver
            );

            // TIMING FIX: Handle the case where parent context doesn't exist yet
            // Strategy: Silently skip rendering now, let natural retry handle it later
            // When parent foreach renders and calls scanAndRegisterNewElements(), this
            // method will be called again with proper context available.
            if (!array) {
                // Don't clear innerHTML - preserve template for when context becomes available
                // Don't log errors - this is expected behavior during initialization
                return;
            }

            // Validate that the resolved expression is actually an array
            if (!Array.isArray(array)) {
                console.warn(`Foreach expression "${mappingData.foreachExpr}" did not evaluate to an array, got:`, typeof array, array);
                foreachElement.innerHTML = ''; // Clear invalid content
                return;
            }

            // Get the source array to find original indices
            const sourceArray = this.getSourceArrayForFiltered(mappingData.foreachExpr, array, mappingData);

            // Get hash map and clear it
            const hashMap = self.arrayHashMaps.get(arrayPath) || new Map();
            hashMap.clear();

            // Store array to be able to compare later
            foreachElement._pacPreviousArray = array;

            // Build complete HTML string first, then set innerHTML once
            // This prevents DOM corruption caused by repeated innerHTML += operations
            let completeHTML = '';

            // Generate DOM content for each array item
            // HTML comments mark the boundaries and context for each iteration
            array.forEach((item, renderIndex) => {
                // Find the original index in the source array
                const originalIndex = self.findOriginalIndex(item, sourceArray, renderIndex);

                // Store in mapping data for later diffing
                const contentHash = self.createForeachEntryHash(item, originalIndex);

                // Put hash in map
                hashMap.set(contentHash, originalIndex);

                // Build the HTML for this item
                completeHTML +=
                    `<!-- pac-foreach-item: ${mappingData.foreachId}, index=${originalIndex}, renderIndex=${renderIndex} -->` +
                    mappingData.template + // Original template with bindings like {{item}}
                    `<!-- /pac-foreach-item -->`;
            });

            // Set the complete HTML at once - this preserves comment structure
            foreachElement.innerHTML = completeHTML;

            // Add to hash map
            this.arrayHashMaps.set(arrayPath, hashMap);

            // Recursively scan the newly generated content for bindings and nested foreach elements
            // This is where the "natural retry" happens - nested foreach elements found here
            // will now have proper parent context available for successful rendering
            this.scanAndRegisterNewElements(foreachElement);

        } catch (error) {
            console.error(`Error evaluating foreach expression "${mappingData.foreachExpr}":`, error);
            // Don't clear innerHTML on error during initial scan - preserve template
            // The error might resolve itself when parent context becomes available
        }
    };

    /**
     * Gets the source array for a potentially filtered expression
     * @param {string} foreachExpr - The foreach expression (e.g., "filteredTodos")
     * @param {Array} currentArray - The current evaluated array
     * @param mappingData
     * @returns {Array} The source array or current array if no source found
     */
    Context.prototype.getSourceArrayForFiltered = function (foreachExpr, currentArray, mappingData) {
        const rootName = (mappingData && mappingData.sourceArray) || this.inferArrayRoot(foreachExpr);

        if (!rootName) {
            return currentArray;
        }

        const rootArray = this.abstraction[rootName];
        return Array.isArray(rootArray) ? rootArray : currentArray;
    };

    /**
     * Finds the original index of an item in the source array
     * @param {*} item - The item to find
     * @param {Array} sourceArray - The source array to search in
     * @param {number} fallbackIndex - Fallback index if not found
     * @returns {number} The original index in the source array
     */
    Context.prototype.findOriginalIndex = function(item, sourceArray, fallbackIndex) {
        // For primitive arrays (like flatGrid with numbers), the renderIndex IS the correct index
        // because the array items are primitives that appear in order
        if (typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean') {
            return fallbackIndex;
        }

        // Strategy 1: Direct reference comparison (works for object references)
        for (let i = 0; i < sourceArray.length; i++) {
            if (sourceArray[i] === item) {
                return i;
            }
        }

        // Strategy 2: ID-based comparison (common pattern in data)
        if (item && typeof item === 'object' && item.id !== undefined) {
            for (let i = 0; i < sourceArray.length; i++) {
                const sourceItem = sourceArray[i];
                if (sourceItem && typeof sourceItem === 'object' && sourceItem.id === item.id) {
                    return i;
                }
            }
        }

        // Strategy 3: Deep equality comparison (for primitive values or value objects)
        for (let i = 0; i < sourceArray.length; i++) {
            if (Utils.isEqual(sourceArray[i], item)) {
                return i;
            }
        }

        // Strategy 4: Fallback to render index (maintains current behavior for edge cases)
        return fallbackIndex;
    };

    /**
     * Fetches the entire chain of foreaches for the given element
     * @param element
     * @returns {*[]}
     */
    Context.prototype.getForeachChain = function(element) {
        const result = [];

        let current = element;

        while (current != null) {
            const context = this.extractClosestForeachContext(current);

            if (context) {
                const forEachContainer = this.container.querySelector('[data-pac-foreach-id="' + context.foreachId + '"]');
                const forEachData = this.interpolationMap.get(forEachContainer);

                // Ensure forEachData exists before accessing properties
                if (forEachData) {
                    result.push({
                        foreachId: context.foreachId,
                        depth: forEachData.depth,
                        index: context.index,
                        renderIndex: context.renderIndex,
                        container: forEachContainer,
                        itemVar: forEachData.itemVar,
                        indexVar: forEachData.indexVar,
                        sourceArray: forEachData.sourceArray
                    });
                }
            }

            current = this.findParentForeachElement(current);
        }

        return result;
    }

    /**
     * Normalize a scoped path to a global path using the element's foreach chain.
     * Example: ["parent", "item", "name"] inside a nested foreach becomes "users[0].posts[1].name"
     * Note: Assumes getForeachChain returns frames in innermost-first order
     * @param {string|string[]} pathSegments - Local path as array or string.
     * @param {HTMLElement} element - DOM element inside the foreach hierarchy.
     * @returns {string} Fully qualified data path.
     */
    Context.prototype.normalizePath = function normalizePath(pathSegments, element) {
        // Convert to array and handle empty paths
        const path = Utils.pathStringToArray(pathSegments);

        if (!path.length) {
            return "";
        }

        // Count leading "parent" tokens to climb up foreach stack
        let climbs = 0;
        while (climbs < path.length && path[climbs] === "parent") {
            climbs++;
        }

        // Get the complete foreach chain
        const allFrames = this.getForeachChain(element);

        // Validate that we don't climb more than available frames
        if (climbs > allFrames.length) {
            console.warn(`Cannot climb ${climbs} levels - only ${allFrames.length} foreach frames available`);
            // Clamp to maximum available frames to prevent undefined behavior
            climbs = allFrames.length;
        }

        // Get effective frames after climbing (slice removes the climbed frames)
        const frames = allFrames.slice(climbs);
        const scope = new Map();

        // Build variable scope from remaining frames
        for (const f of frames) {
            // Map item variable: "item" → "users[0]"
            if (!scope.has(f.itemVar)) {
                const base = scope.get(f.sourceArray) || f.sourceArray;
                scope.set(f.itemVar, `${base}[${f.index}]`);
            }

            // Map index variable to numeric value
            if (f.indexVar && !scope.has(f.indexVar)) {
                scope.set(f.indexVar, f.index);
            }
        }

        // Get path after removing "parent" tokens
        const remaining = path.slice(climbs);

        if (!remaining.length) {
            // If all tokens were "parent", we've climbed out of all foreach contexts
            // This might be valid (accessing root scope) or an error condition
            console.warn(`Path resolved to empty after climbing ${climbs} levels`);
            return "";
        }

        // Process each token as a slot that might need replacement
        const resolvedTokens = [];

        for (let i = 0; i < remaining.length; i++) {
            const token = remaining[i];

            if (scope.has(token)) {
                const scopeValue = scope.get(token);

                if (typeof scopeValue === 'number') {
                    // Index variable - add as numeric index
                    resolvedTokens.push(scopeValue);
                } else {
                    // Item variable - it's already a resolved path like "users[0]"
                    // Split it and add each part
                    const itemParts = scopeValue.split(DOTS_AND_BRACKETS_PATTERN).filter(Boolean);
                    resolvedTokens.push(...itemParts);
                }
            } else {
                // Regular token - add as-is
                resolvedTokens.push(token);
            }
        }

        // Special case: if the entire path resolves to just a number, return it directly
        if (resolvedTokens.length === 1 && typeof resolvedTokens[0] === 'number') {
            return resolvedTokens[0];
        }

        // Convert resolved tokens back to path string
        return Utils.pathArrayToString(resolvedTokens);
    };

    /**
     * Determines whether a foreach element needs to be rebuilt based on array changes
     * @param {Element} foreachElement - The DOM element with foreach directive
     * @returns {boolean} True if the foreach should be rebuilt, false otherwise
     */
    Context.prototype.shouldRebuildForeach = function(foreachElement) {
        // Get the mapping data for this foreach element from the interpolation map
        const mappingData = this.interpolationMap.get(foreachElement);
        if (!mappingData) {
            // No mapping data means this isn't a valid foreach element
            return false;
        }

        // Create scope resolver to handle scoped path resolution within foreach context
        const scopeResolver = {
            resolveScopedPath: (path) => this.normalizePath(path, foreachElement)
        };

        // Evaluate the foreach expression to get the current array
        const newArray = ExpressionParser.evaluate(
            ExpressionCache.parseExpression(mappingData.foreachExpr),
            this.abstraction,
            scopeResolver
        );

        // If evaluation doesn't result in an array, no rebuild needed
        if (!Array.isArray(newArray)) {
            return false;
        }

        // Get the previously cached array from the element's internal property
        const previousArray = foreachElement._pacPreviousArray;
        if (!previousArray) {
            // First time rendering - rebuild required
            return true;
        }

        // Quick length comparison - if lengths differ, rebuild needed
        if (newArray.length !== previousArray.length) {
            return true;
        }

        // Check if any array items changed by reference comparison
        // This catches object mutations and item replacements
        for (let i = 0; i < newArray.length; i++) {
            if (newArray[i] !== previousArray[i]) {
                return true;
            }
        }

        // Arrays are identical - no rebuild needed
        return false;
    };

    Context.prototype.findForeachElementsByArrayPath = function(arrayPath) {
        const elementsToUpdate = [];

        for (const [element, mappingData] of this.interpolationMap) {
            if (mappingData.bindings && mappingData.bindings.foreach) {
                // Check both direct expression match and source array match
                if (mappingData.foreachExpr === arrayPath || mappingData.sourceArray === arrayPath) {
                    elementsToUpdate.push(element);
                }
            }
        }

        return elementsToUpdate;
    };

    /**
     * Extracts the closest foreach context information by walking up the DOM tree
     * from a starting element, looking for comment markers that identify foreach items.
     * @param {Element} startElement - The DOM element to start searching from
     * @returns {number|null} Foreach context object with foreachId, index, and renderIndex or null
     * @returns {string} returns.foreachId - The identifier of the foreach loop
     * @returns {number} returns.index - The logical index in the data array
     * @returns {number} returns.renderIndex - The rendering index (may differ from logical index)
     */
    Context.prototype.extractClosestForeachContext = function(startElement) {
        // Start from the element and walk up the DOM tree
        let current = startElement;

        while (current && current !== this.container) {
            // Check previous siblings for comment markers
            let sibling = current.previousSibling;

            while (sibling) {
                // Only process comment nodes
                if (sibling.nodeType === Node.COMMENT_NODE) {
                    const commentText = sibling.textContent.trim();

                    // Look for comment pattern: "pac-foreach-item: foreachId, index=X, renderIndex=Y"
                    // This regex captures the foreach ID and both index values
                    const match = commentText.match(FOREACH_INDEX_REGEX);

                    if (match) {
                        return {
                            foreachId: match[1].trim(),
                            index: parseInt(match[2], 10),      // Convert string to integer
                            renderIndex: parseInt(match[3], 10) // Convert string to integer
                        };
                    }
                }

                // Move to the next previous sibling
                sibling = sibling.previousSibling;
            }

            // Move up to parent element to continue searching
            current = current.parentElement;
        }

        // No foreach context found in the entire tree up to container
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

        // Remove them from the maps AND clean up cached state
        elementsToRemove.forEach(element => {
            this.interpolationMap.delete(element);

            // Clean up cached state to prevent memory leaks
            delete element._pacPreviousValues;
            delete element._pacPreviousArray;
            delete element._pacDynamicClass;
        });

        textNodesToRemove.forEach(textNode => {
            this.textInterpolationMap.delete(textNode);

            // Clean up cached text state
            delete textNode._pacPreviousText;
        });
    };

    /**
     * Establishes parent-child relationships in component hierarchy
     */
    Context.prototype.establishHierarchy = function() {
        const { parent, children } = window.PACRegistry.getHierarchy(this.container);

        // Updates relationships
        this.updateParentRelationship(parent);
        this.updateChildrenRelationships(children);

        // Updates reactive hierarchy properties
        this.abstraction.childrenCount = this.children.size;
        this.abstraction.hasParent = !!this.parent;

        // Perform scanning when all containers are properly marked
        this.scanAndRegisterNewElements(this.container);

        // Call ready() method if it exists after all bindings have been applied
        // Only call once per component instance
        if (
            !this._readyCalled &&
            this.abstraction.ready &&
            typeof this.abstraction.ready === 'function'
        ) {
            this._readyCalled = true;

            try {
                this.abstraction.ready.call(this.abstraction);
            } catch (error) {
                console.error('Error in ready() method:', error);
            }
        }
    };

    /**
     * Updates parent relationship - only sets parent reference
     * @param {Object|null} newParent - New parent component or null
     */
    Context.prototype.updateParentRelationship = function(newParent) {
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

        // Add to new parent's children set
        if (newParent) {
            newParent.children.add(this);
        }
    };

    /**
     * Rebuilds children relationships from current DOM hierarchy
     * @param {Array} currentChildren - Children found in DOM
     */
    Context.prototype.updateChildrenRelationships = function(currentChildren) {
        this.children.clear();

        currentChildren.forEach(child => {
            // Remove child from previous parent if different
            if (child.parent && child.parent !== this) {
                child.parent.children.delete(child);
            }

            child.parent = this;
            this.children.add(child);
        });
    };

    /**
     * Notifies parent component with optional bubbling
     * @param {string} type - Event type
     * @param {*} data - Event payload
     * @param {boolean} bubble - Whether to continue bubbling up the chain (default: false)
     */
    Context.prototype.notifyParent = function(type, data, bubble = false) {
        if (!this.parent) {
            return;
        }

        // Call parent's handler if it exists
        if (typeof this.parent.receiveUpdate === 'function') {
            const result = this.parent.receiveUpdate(type, data, this);

            // If bubbling is enabled, only stop if handler explicitly returns false
            if (bubble && result === false) {
                return;
            }
        }

        // Continue bubbling if requested
        if (bubble) {
            this.parent.notifyParent(type, data, bubble);
        }
    };

    /**
     * Receives updates from children
     * @param {string} type - Event type
     * @param {*} data - Event payload
     * @param {Object} child - Source child component
     * @returns {boolean} Return false to stop bubbling, anything else continues
     */
    Context.prototype.receiveUpdate = function(type, data, child) {
        if (this.abstraction.receiveFromChild && typeof this.abstraction.receiveFromChild === 'function') {
            return this.abstraction.receiveFromChild(type, data, child);
        }

        // Default: continue bubbling
        return true;
    };

    /**
     * Receives and processes commands sent down from parent component
     * @param {string} cmd - The command identifier
     * @param {*} data - The command data payload
     */
    Context.prototype.receiveFromParent = function(cmd, data) {
        if (this.abstraction.receiveFromParent && typeof this.abstraction.receiveFromParent === 'function') {
            this.abstraction.receiveFromParent(cmd, data);
        }
    };

    /**
     * Sends a command to all direct child components
     * @param {string} cmd - The command identifier
     * @param {*} data - The command data payload
     */
    Context.prototype.notifyChildren = function(cmd, data) {
        // Iterate through all child components
        this.children.forEach(child => {
            // Ensure child has the receiveFromParent method before calling
            if (child && typeof child.receiveFromParent === 'function') {
                child.receiveFromParent(cmd, data);
            }
        });
    };

    /**
     * Sends a command to a specific child component matching the given selector
     * @param {string} selector - CSS selector to identify the target child
     * @param {string} cmd - The command identifier
     * @param {*} data - The command data payload
     */
    Context.prototype.notifyChild = function(selector, cmd, data) {
        // Find the child by its pac-id attribute
        const child = Array.from(this.children).find(c =>
            c.container.getAttribute('data-pac-id') === selector
        );

        // If matching child found and has receiveFromParent method, send the command
        if (child && typeof child.receiveFromParent === 'function') {
            child.receiveFromParent(cmd, data);
        }
    };

    /**
     * Creates a stable hash from content data, handling various data types
     * @returns {string} A string representation suitable for hashing
     * @param inputData
     */
    Context.prototype.createContentHash = function(inputData) {
        /**
         * Convert any data structure into a deterministic string representation.
         * This ensures that logically equivalent objects produce the same hash string,
         * regardless of key order or formatting differences.
         */
        function createStableRepresentation(value) {
            // Handle null or undefined explicitly
            if (value === null || value === undefined) {
                return String(value);
            }

            // Handle primitive types (string, number, boolean, etc.)
            if (typeof value !== "object") {
                return String(value);
            }

            // Handle arrays: recursively hash each item in order
            if (Array.isArray(value)) {
                const arrayRepresentation = value.map(function (element) {
                    return createStableRepresentation(element);
                });

                return "[" + arrayRepresentation.join(",") + "]";
            }

            // Handle objects: sort keys to ensure consistent ordering
            const sortedKeys = Object.keys(value).sort();
            const objectRepresentation = sortedKeys.map(function(key) {
                return key + ":" + createStableRepresentation(value[key]);
            });

            return "{" + objectRepresentation.join(",") + "}";
        }

        // Entry point: return stable representation for the given input
        return createStableRepresentation(inputData);
    };

    /**
     * Creates a stable hash for a foreach entry based on content data, foreach ID, and logical index.
     * This hash can be used for change detection, caching, or reconciliation in foreach loops.
     * @param {*} contentData - The data item being rendered (object, primitive, etc.)
     * @param {number} index - The logical index in the source array (not renderIndex)
     * @returns {string} A hash string representing this foreach entry
     */
    Context.prototype.createForeachEntryHash = function(contentData, index) {
        if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
            throw new Error('index must be a non-negative integer');
        }

        // Serialize the content data to a stable string representation
        const contentHash = this.createContentHash(contentData);

        // Combine all components with delimiters to avoid collisions
        // Format: "foreachId|index|contentHash"
        const combined = `${index}|${contentHash}`;

        // Create a simple but effective hash using djb2 algorithm
        return Utils.djb2Hash(combined);
    }

    /**
     * Classifies changes between old and new arrays based on content hashes.
     * This function enables efficient DOM diffing by identifying what items were
     * added, removed, moved, or remained unchanged between array renders.
     * Uses the existing createForeachEntryHash method for consistent hashing.
     * @param {Map<string, number>} oldHashMap - Map of hash -> index from previous render
     * @param {Array} newArray - New array data to be rendered
     * @returns {{removed: *[], moved: *[], added: *[], unchanged: *[]}} Classification object with arrays for each change type
     * @returns {number[]} returns.removed - Indices of items to remove from DOM (sorted high to low)
     * @returns {Object[]} returns.moved - Items that moved positions [{from: oldIndex, to: newIndex, hash}]
     * @returns {number[]} returns.added - Indices where new items should be inserted
     * @returns {number[]} returns.unchanged - Indices of items that stayed in same position
     */
    Context.prototype.classifyArrayChanges = function(oldHashMap, newArray) {
        const self = this;

        // Step 1: Generate hash map for the new array state
        const newHashMap = new Map();

        // Create hashes for new array
        newArray.forEach((item, index) => {
            const hash = self.createForeachEntryHash(item, index);
            newHashMap.set(hash, index); // hash -> newIndex mapping
        });

        // Initialize result object to collect our classifications
        const result = {
            removed: [],    // Items present in old array but missing in new array
            moved: [],      // Items present in both arrays but at different positions
            added: [],      // Items present in new array but missing in old array
            unchanged: []   // Items present in both arrays at the same position
        };

        // Step 2: Find removed items by checking old hashes against new array
        // If an old hash is not found in the new array, the item was deleted
        oldHashMap.forEach((oldIndex, hash) => {
            if (!newHashMap.has(hash)) {
                result.removed.push(oldIndex);
            }
        });

        // Step 3: Process each item in the new array to find moves, adds, and unchanged
        newHashMap.forEach((newIndex, hash) => {
            if (oldHashMap.has(hash)) {
                // This hash existed in the previous render
                const oldIndex = oldHashMap.get(hash);

                if (oldIndex === newIndex) {
                    // Same position in both arrays - no DOM operation needed
                    result.unchanged.push(newIndex);
                } else {
                    // Different position - DOM element needs to be moved
                    result.moved.push({
                        from: oldIndex,    // Where the DOM element currently is
                        to: newIndex,      // Where it needs to move to
                        hash: hash         // Hash for debugging/verification
                    });
                }
            } else {
                // This hash is new - DOM element needs to be created
                result.added.push(newIndex);
            }
        });

        // Step 4: Sort arrays to ensure safe DOM manipulation order
        // CRITICAL: Process removals from highest index to lowest to avoid index shifting
        result.removed.sort((a, b) => b - a);

        // Process moves by target position to maintain proper order during DOM manipulation
        result.moved.sort((a, b) => a.to - b.to);

        // Process additions in ascending order to maintain natural insertion order
        result.added.sort((a, b) => a - b);

        // Return the result
        return result;
    }

    /**
     * Determines if changes can be handled with simple operations
     * @param {Object} changes - The changes object containing arrays of added, removed, and moved items
     * @param {Array} changes.added - Items that were added to the array
     * @param {Array} changes.removed - Items that were removed from the array
     * @param {Array} changes.moved - Items that were moved/reordered within the array
     * @returns {boolean} True if changes can be handled with simple DOM operations, false if full rebuild needed
     */
    Context.prototype.canHandleSimply = function (changes) {
        const totalChanges = changes.added.length + changes.removed.length + changes.moved.length;

        // Skip simple handling if changes are too complex
        if (totalChanges > 10) {
            return false;
        }

        // Handle these patterns efficiently:
        return (
            // Pure additions anywhere
            (changes.added.length > 0 && changes.removed.length === 0 && changes.moved.length === 0) ||

            // Pure removals anywhere
            (changes.removed.length > 0 && changes.added.length === 0 && changes.moved.length === 0) ||

            // Pure moves (reordering without add/remove)
            (changes.moved.length > 0 && changes.added.length === 0 && changes.removed.length === 0) ||

            // Simple replace operations (same number of items added/removed, no moves)
            (changes.added.length === changes.removed.length && changes.moved.length === 0) ||

            // Small mixed operations (a few changes of different types)
            (totalChanges <= 3)
        );
    };

    /**
     * Handles simple array changes with targeted DOM operations
     * FIXED: Proper hash map cleanup and index management
     * @param {HTMLElement} element - The DOM element containing the array representation
     * @param {Object} changes - The changes object with added, removed, and moved arrays
     * @param {Array} newArray - The complete updated array after changes
     * @param {string} arrayPath - The property path to the array being updated
     * @returns {void}
     */
    Context.prototype.handleSimpleArrayChange = function(element, changes, newArray, arrayPath) {
        const mappingData = this.interpolationMap.get(element);

        // Apply removals first (hash map will be rebuilt after all operations)
        if (changes.removed.length > 0) {
            this.removeItems(element, changes.removed);
        }

        if (changes.moved.length > 0) {
            this.moveItems(element, changes.moved);
        }

        if (changes.added.length > 0) {
            this.addItems(element, changes.added, newArray, mappingData);
        }

        // Scan newly added elements for bindings
        this.scanAndRegisterNewElements(element);

        // Rebuild hash map from scratch after all operations
        this.rebuildHashMap(element, newArray, arrayPath);

        // Store new array
        element._pacPreviousArray = newArray;
    };

    /**
     * Rebuilds the hash map from current DOM state
     * This ensures the hash map stays synchronized with actual DOM content
     * @param {HTMLElement} element - The foreach container
     * @param {Array} currentArray - Current array data
     * @param {string} arrayPath - Path to the array
     */
    Context.prototype.rebuildHashMap = function(element, currentArray, arrayPath) {
        const newHashMap = new Map();

        // Walk through current DOM and rebuild hash map
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
        let node;

        while ((node = walker.nextNode())) {
            const match = node.textContent.match(FOREACH_INDEX_REGEX);
            if (match) {
                const originalIndex = parseInt(match[2], 10);
                const renderIndex = parseInt(match[3], 10);

                // Get the current item data
                if (renderIndex < currentArray.length) {
                    const item = currentArray[renderIndex];
                    const hash = this.createForeachEntryHash(item, originalIndex);
                    newHashMap.set(hash, originalIndex);
                }
            }
        }

        // Replace the hash map
        this.arrayHashMaps.set(arrayPath, newHashMap);
    };

    /**
     * This method handles the complete removal of items including cleanup of interpolation maps
     * to prevent memory leaks and stale references.
     * @param {Element} element - The container element containing the items to remove
     * @param {number[]} removedIndices - Array of original indices of items to remove
     * @throws {TypeError} If element is not a valid DOM Element
     * @throws {TypeError} If removedIndices is not an array
     */
    Context.prototype.removeItems = function(element, removedIndices) {
        if (!(element instanceof Element)) {
            throw new TypeError('element must be a DOM Element');
        }

        if (!Array.isArray(removedIndices)) {
            throw new TypeError('removedIndices must be an array');
        }

        removedIndices.forEach(index => {
            this.findItemNodes(element, index).forEach(node => {
                node.remove();
            });
        });
    };

    /**
     * Handles DOM node repositioning while maintaining proper insertion order.
     * Each move operation relocates nodes from their current position to a new target position.
     * @param {Element} element - The container element containing the items to move
     * @param {Object[]} moves - Array of move operations
     * @param {number} moves[].from - Original index of the item to move
     * @param {number} moves[].to - Target index where the item should be moved
     */
    Context.prototype.moveItems = function(element, moves) {
        // Input validation
        if (!(element instanceof Element)) {
            throw new TypeError('element must be a DOM Element');
        }

        if (!Array.isArray(moves)) {
            throw new TypeError('moves must be an array');
        }

        moves.forEach(move => {
            // Validate move object structure
            if (typeof move !== 'object' || move === null) {
                throw new TypeError('each move must be an object');
            }

            if (typeof move.from !== 'number' || typeof move.to !== 'number') {
                throw new TypeError('move objects must have numeric "from" and "to" properties');
            }

            if (move.from < 0 || move.to < 0) {
                throw new RangeError('move indices cannot be negative');
            }

            const itemNodes = this.findItemNodes(element, move.from);
            const insertPoint = this.findInsertionPoint(element, move.to);

            itemNodes.forEach(node => {
                if (insertPoint) {
                    element.insertBefore(node, insertPoint);
                } else {
                    // Insert at end when no insertion point found (target index beyond current items)
                    element.appendChild(node);
                }
            });
        });
    };

    /**
     * Adds new items to a foreach-rendered element at specified indices
     * @param {HTMLElement} element - The DOM element containing the foreach-rendered items
     * @param {number[]} addedIndices - Array of indices where new items should be inserted
     * @param {Array} newArray - The updated array containing all items including new ones
     * @param {Object} mappingData - Configuration object for the foreach mapping
     * @param {string} mappingData.foreachId - Unique identifier for this foreach instance
     * @param {string} mappingData.template - HTML template string for rendering items
     * @param {string} mappingData.foreachExpr - The foreach expression used for filtering/mapping
     */
    Context.prototype.addItems = function(element, addedIndices, newArray, mappingData) {
        // Get the source array to determine original indices
        const sourceArray = this.getSourceArrayForFiltered(mappingData.foreachExpr, newArray, mappingData);

        addedIndices.forEach(index => {
            const item = newArray[index];

            // Find the original index in the source array for this item
            const originalIndex = this.findOriginalIndex(item, sourceArray, index);

            // Create HTML with proper comments
            const itemHTML =
                `<!-- pac-foreach-item: ${mappingData.foreachId}, index=${originalIndex}, renderIndex=${index} -->` +
                mappingData.template +
                `<!-- /pac-foreach-item -->`;

            // Create appropriate container based on parent element type
            const tempContainer = this.createTemporaryContainer(element);
            tempContainer.innerHTML = itemHTML;

            // Find insertion point
            const insertPoint = this.findInsertionPoint(element, index);

            // Insert all nodes
            while (tempContainer.firstChild) {
                if (insertPoint) {
                    element.insertBefore(tempContainer.firstChild, insertPoint);
                } else {
                    element.appendChild(tempContainer.firstChild);
                }
            }
        });
    };

    /**
     * Creates an appropriate temporary container based on the parent element type
     * This ensures the browser's HTML parser doesn't strip invalid element nesting
     * @param {HTMLElement} parentElement - The parent element that will receive the content
     * @returns {HTMLElement} A temporary container appropriate for the content type
     */
    Context.prototype.createTemporaryContainer = function(parentElement) {
        const tagName = parentElement.tagName.toLowerCase();

        switch(tagName) {
            case 'table':
            case 'tbody':
            case 'thead':
            case 'tfoot':
                return document.createElement('tbody');

            case 'tr':
                return document.createElement('tr');

            case 'ul':
            case 'ol':
                return document.createElement('ul');

            case 'select':
                return document.createElement('select');

            default:
                return document.createElement('div');
        }
    };

    /**
     * Finds all DOM nodes for a foreach item by its index, handling nested foreach loops
     * @param {Element} element - The DOM element to search within
     * @param {number} index - The index of the foreach item to find
     * @returns {Node[]} Array of DOM nodes that belong to the foreach item at the specified index
     */
    Context.prototype.findItemNodes = function(element, index) {
        const nodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);

        let collecting = false;  // Whether we're currently collecting nodes for our target item
        let depth = 0;           // Nesting depth counter for handling nested foreach loops
        let node;

        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.COMMENT_NODE) {
                const text = node.textContent.trim();
                const match = text.match(FOREACH_INDEX_REGEX);

                // Check if this is the start comment for our target index
                if (match && parseInt(match[2], 10) === index && !collecting) {
                    collecting = true;
                    depth = 0;
                    nodes.push(node);
                } else if (collecting) {
                    // We're collecting - add this comment node
                    nodes.push(node);

                    if (match) {
                        // Found a nested foreach start - increment depth
                        depth++;
                    } else if (text === '/pac-foreach-item') {
                        // Found a foreach end comment
                        if (depth === 0) {
                            // This closes our target item - stop collecting
                            break;
                        }

                        // This closes a nested foreach item - decrement depth
                        depth--;
                    }
                }
            } else if (collecting) {
                // Collect all non-comment nodes while we're in collection mode
                nodes.push(node);
            }
        }

        return nodes;
    };

    /**
     * Finds the insertion point for an item at the given index within a foreach loop
     * @param {Element} element - The DOM element to search within
     * @param {number} targetIndex - The index where the new item should be inserted
     * @returns {Comment|null} The comment node marking where to insert, or null to append at end
     */
    Context.prototype.findInsertionPoint = function(element, targetIndex) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);

        let node;
        while ((node = walker.nextNode())) {
            const match = node.textContent.match(FOREACH_INDEX_REGEX);

            if (match && parseInt(match[3], 10) >= targetIndex) {
                return node;
            }
        }

        return null; // Append at end
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
        this.pendingHierarchy = new Set();
        this.hierarchyTimer = null;
    }

    ComponentRegistry.prototype = {
        /**
         * Registers a new PAC component
         * @param {string} selector - Unique identifier for the component (from data-pac-id)
         * @param {Object} context - The PAC component context object
         */
        register(selector, context) {
            this.components.set(selector, context);
            this.pendingHierarchy.add(context);

            // Clear existing timer and start new one
            clearTimeout(this.hierarchyTimer);

            // Establish hierarchies
            this.hierarchyTimer = setTimeout(() => {
                this.establishAllHierarchies();
            }, 10); // Keep your current delay
        },

        /**
         * Processes all pending components to establish their parent-child relationships.
         *
         * This method handles cascading component registrations by:
         * 1. Processing all currently pending components in a batch
         * 2. Detecting if new components were registered during processing
         * 3. Scheduling another round if needed to handle the new components
         *
         * The recursive processing continues until no new components are added,
         * ensuring all components eventually get their hierarchy established even
         * when parent components dynamically create child components.
         *
         * @returns {void}
         */
        establishAllHierarchies() {
            // Nothing to do if no components are waiting
            if (this.pendingHierarchy.size === 0) {
                return;
            }

            // Clear hierarchy cache once for all components in this batch
            // This ensures fresh parent/child lookups for the current DOM state
            this.hierarchyCache = new WeakMap();

            // Snapshot the current pending components before clearing
            // This prevents infinite loops from components added during processing
            const componentsToProcess = Array.from(this.pendingHierarchy);
            this.pendingHierarchy.clear();

            // Establish hierarchy for each component in the batch
            // Note: This may trigger registration of new child components
            componentsToProcess.forEach(component => {
                component.establishHierarchy();
            });

            // Check if any new components were registered during processing
            // This happens when parent components dynamically create children
            if (this.pendingHierarchy.size > 0) {
                // Cancel any pending hierarchy processing to avoid duplicate runs
                clearTimeout(this.hierarchyTimer);

                // Schedule another round after a brief delay
                // The 10ms delay allows multiple rapid registrations to batch together
                // rather than processing them one at a time
                this.hierarchyTimer = setTimeout(() => {
                    this.establishAllHierarchies();
                }, 10);
            }
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

    // ========================================================================
    // MAIN FRAMEWORK
    // ========================================================================

    /**
     * Creates reactive PAC (Presentation-Abstraction-Control) components
     *
     * @param {string} selector - CSS selector ('#id' returns single, '.class' returns array)
     * @param {Object} [abstraction={}] - Reactive data model with properties and methods
     * @param {Object} [options={}] - Configuration options
     * @param {string} [options.updateMode='immediate'] - Update strategy ('immediate' or 'debounced')
     * @param {number} [options.delay=300] - Debounce delay in milliseconds
     * @returns {Object|Object[]|undefined} Single abstraction for ID, array for class/tag selectors
     *
     * @example
     * const app = wakaPAC('#app', { count: 0 });
     * const todos = wakaPAC('.todo-item', { text: '', done: false });
     */
    function wakaPAC(selector, abstraction = {}, options = {}) {
        // Initialize global event tracking first
        DomUpdateTracker.initialize();

        // Fetch all matching elements (supports both ID and class selectors)
        const containers = document.querySelectorAll(selector);

        // Determine if selector is for multiple elements (class, attribute, tag)
        const isMultiSelector = !selector.startsWith('#');

        if (containers.length === 0) {
            console.warn(`wakaPAC: No elements found for selector "${selector}"`);
            return isMultiSelector ? [] : undefined;
        }

        // Process each container and collect abstractions
        const abstractions = [];

        containers.forEach(container => {
            // Get or generate pac-id
            let pacId = container.getAttribute('data-pac-id');

            if (!pacId) {
                pacId = Utils.uniqid('pac-');
                container.setAttribute('data-pac-id', pacId);
            }

            // Merge configuration
            const config = Object.assign({
                updateMode: 'immediate',
                delay: 300
            }, options);

            // Create context for this container
            const context = new Context(container, abstraction, config);

            // Register using pac-id as key (not selector)
            window.PACRegistry.register(pacId, context);

            // Signal that a new component is ready
            document.dispatchEvent(new CustomEvent('pac:component-ready', {
                detail: { component: context, selector: selector, pacId: pacId }
            }));

            // Collect the abstraction
            abstractions.push(context.abstraction);
        });

        // Return array for multi-selectors, single abstraction for ID selectors
        return isMultiSelector ? abstractions : abstractions[0];
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    window.PACRegistry = window.PACRegistry || new ComponentRegistry();

    // Export to global scope
    window.wakaPAC = wakaPAC;
    window.MSG_TYPES = MSG_TYPES;

    // Export modifier key constants
    window.MK_LBUTTON = MK_LBUTTON;
    window.MK_RBUTTON = MK_RBUTTON;
    window.MK_MBUTTON = MK_MBUTTON;
    window.MK_SHIFT = MK_SHIFT;
    window.MK_CONTROL = MK_CONTROL;
    window.MK_ALT = MK_ALT;

    /**
     * Global mousemove throttling configuration
     * Controls the maximum frame rate for mousemove event processing
     * @type {number}
     * @default 60
     */
    wakaPAC.mouseMoveThrottleFps = 60;

})();