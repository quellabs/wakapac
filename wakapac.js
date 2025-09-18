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
     * Various repeated regular expressions
     * @type {RegExp}
     */
    const INTERPOLATION_REGEX = /\{\{\s*([^}]+)\s*}}/g;
    const INTERPOLATION_TEST_REGEX = /\{\{.*}}/;
    const FOREACH_INDEX_REGEX = /pac-foreach-item:\s*([^,]+),\s*index=(\d+),\s*renderIndex=(\d+)/;

    // Add to your constants section
    const MSG_TYPES = {
        // Unknown message (should never occur)
        MSG_UNKNOWN: 0x0000,

        // Mouse messages
        MSG_LBUTTONDOWN: 0x0201,
        MSG_LBUTTONUP: 0x0202,
        MSG_RBUTTONDOWN: 0x0204,
        MSG_RBUTTONUP: 0x0205,
        MSG_MBUTTONDOWN: 0x0207,
        MSG_MBUTTONUP: 0x0208,

        // Input messages
        MSG_CHAR: 0x0300,
        MSG_CHANGE: 0x0301,
        MSG_SUBMIT: 0x0302,

        // Focus messages
        MSG_FOCUS: 0x0007,
        MSG_BLUR: 0x0008,

        // Keyboard messages
        MSG_KEYDOWN: 0x0100,
        MSG_KEYUP: 0x0101
    };

    const MK_LBUTTON = 0x0001;
    const MK_RBUTTON = 0x0002;
    const MK_SHIFT = 0x0004;
    const MK_CONTROL = 0x0008;
    const MK_MBUTTON = 0x0010;
    const MK_ALT = 0x0020;

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
            const parts = path.split(/[.\[\]]+/).filter(Boolean);

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
         * Converts an array of path segments into a JavaScript property access string.
         * Handles both dot notation for properties and bracket notation for numeric indices.
         * @param {string[]} pathArray - Array of path segments representing object property access
         * @returns {string} Formatted property access string (e.g., "user.settings[0].name")
         */
        pathArrayToString(pathArray) {
            // Handle empty array case
            if (pathArray.length === 0) {
                return '';
            }

            // Start with the root property (no dot prefix needed)
            let result = pathArray[0];

            // Process remaining path segments
            for (let i = 1; i < pathArray.length; i++) {
                const part = pathArray[i];

                // Check if current segment is a numeric index using regex
                if (/^\d+$/.test(part)) {
                    // Numeric index - use bracket notation for array access
                    result += `[${part}]`;
                } else {
                    // Property name - use dot notation for object property access
                    result += `.${part}`;
                }
            }

            return result;
        },

        /**
         * Determines if an element belongs to the specified PAC container.
         * @param {Element} container - The PAC container element with data-pac-container attribute
         * @param {Node} element - The element to check (can be Element or Text node)
         * @returns {boolean} True if element belongs to this container, false otherwise
         */
        belongsToPacContainer(container, element) {
            // Early validation: ensure container is an Element with required attribute
            if (!(container instanceof Element) || !container.hasAttribute('data-pac-container')) {
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

            // Find the closest ancestor (or self) that has the PAC container attribute
            // This ensures we're checking against the actual owning container
            const owningContainer = targetElement.closest('[data-pac-container]');

            // Return true only if the owning container is exactly our target container
            // This prevents false positives when nested PAC containers exist
            return owningContainer === container;
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
                    // In makeDeepReactiveProxy, find this section and add logging:
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

            // Change event (when input element loses focus)
            // Only handle change events for select, radio, and checkbox
            document.addEventListener('change', function (event) {
                if (
                    event.target.tagName === 'SELECT' ||
                    event.target.type === 'radio' ||
                    event.target.type === 'checkbox'
                ) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_CHANGE, event);
                }
            });

            // Input event (when user types)
            // Only handle input events for text inputs and textareas
            document.addEventListener('input', function (event) {
                if (
                    event.target.tagName === 'INPUT' &&
                    !['radio', 'checkbox'].includes(event.target.type) || event.target.tagName === 'TEXTAREA'
                ) {
                    self.dispatchTrackedEvent(MSG_TYPES.MSG_CHAR, event);
                }
            });

            // Submit event (when user submits form)
            document.addEventListener('submit', function (event) {
                self.dispatchTrackedEvent(MSG_TYPES.MSG_SUBMIT, event);
            });
        },

        /**
         * Creates a custom event that wraps the original DOM event with additional
         * tracking data including Win32-style wParam/lParam values, timestamps,
         * and extended metadata. The event is dispatched to the nearest container
         * element with a [data-pac-container] attribute.
         * @param {string} messageType - The Win32 message type (e.g., MSG_LBUTTONDOWN, MSG_KEYUP)
         * @param {Event} originalEvent - The original DOM event to wrap
         * @param {Object} [extended={}] - Additional extended data to include in the event detail
         * @returns {void}
         */
        dispatchTrackedEvent(messageType, originalEvent, extended = {}) {
            // Find the nearest container element that should receive the event
            const container = originalEvent.target.closest('[data-pac-container]');

            // Exit early if no container is found - event cannot be properly tracked
            if (!container) {
                return;
            }

            // Build Win32-style parameters based on the message type and original event
            const params = this.buildParams(messageType, originalEvent);

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
         * Converts DOM event data into Win32 message format for consistent handling
         * across different event types. Each message type has specific parameter
         * encoding rules that match Win32 conventions.
         * @param {string} messageType - The Win32 message type constant
         * @param {Event} event - The original DOM event containing the raw data
         * @returns {Object} Object containing wParam and lParam values
         * @returns {number} returns.wParam - The wParam value (typically flags or primary data)
         * @returns {number|Object} returns.lParam - The lParam value (typically coordinates or secondary data)
         */
        buildParams(messageType, event) {
            switch(messageType) {
                // Mouse button events - encode button states and coordinates
                case MSG_TYPES.MSG_LBUTTONDOWN:
                case MSG_TYPES.MSG_RBUTTONDOWN:
                case MSG_TYPES.MSG_MBUTTONDOWN:
                case MSG_TYPES.MSG_LBUTTONUP:
                case MSG_TYPES.MSG_RBUTTONUP:
                case MSG_TYPES.MSG_MBUTTONUP:
                    return {
                        wParam: this.buildMouseWParam(event),  // Mouse button and modifier key flags
                        lParam: this.buildMouseLParam(event)   // Packed x,y coordinates
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
                case MSG_TYPES.MSG_CHANGE:
                    return {
                        wParam: (event.target && event.target.value) ? event.target.value.length : 0,  // Text length
                        lParam: 0  // Not used for these message types
                    };

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
         * LOWORD (bits 0-15) = x-coordinate, HIWORD (bits 16-31) = y-coordinate
         * @param {MouseEvent} event - The mouse event
         * @returns {number} lParam value with packed coordinates
         */
        buildMouseLParam(event) {
            // Use clientX/clientY for viewport-relative coordinates (most common)
            // Alternative: pageX/pageY for document-relative coordinates
            const x = Math.max(0, Math.min(0xFFFF, event.clientX || 0));
            const y = Math.max(0, Math.min(0xFFFF, event.clientY || 0));

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

        getProperty(path, obj, scopeResolver = null) {
            if (!obj || !path) {
                return undefined;
            }

            let resolvedPath = path;

            // Use context to resolve scoped paths if available
            if (scopeResolver && scopeResolver.resolveScopedPath) {
                resolvedPath = scopeResolver.resolveScopedPath(path);
            }

            // Handle simple property access (no dots or brackets)
            if (resolvedPath.indexOf('.') === -1 && resolvedPath.indexOf('[') === -1) {
                return (resolvedPath in obj) ? obj[resolvedPath] : undefined;
            }

            // Split path by both dots and brackets, handling bracket notation correctly
            // "todos[0].text" becomes ["todos", "0", "text"]
            const parts = resolvedPath.split(/[.\[\]]+/).filter(Boolean);
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
                const contextElement = element.nodeType === Node.TEXT_NODE ? element.parentElement : element;
                const scopeResolver = {
                    resolveScopedPath: (path) => self.context.resolveScopedPath(path, contextElement)
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
            element.className = value;
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

    function Context(container, abstraction, parent = null) {
        const self = this;

        // Ensure container has the required attribute
        if (!container.hasAttribute('data-pac-container')) {
            container.setAttribute('data-pac-container', Utils.uniqid());
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
        this.boundHandlePacEvent = function(event) { self.handlePacEvent(event); };
        this.boundHandleReactiveChange = function(event) { self.handleReactiveChange(event); };
        this.boundHandleArrayChange = function(event) { self.handleArrayChange(event); };

        // Add listeners using the stored references
        this.container.addEventListener('pac:event', this.boundHandlePacEvent);
        this.container.addEventListener('pac:change', this.boundHandleReactiveChange);
        this.container.addEventListener('pac:array-change', this.boundHandleArrayChange);
    }

    Context.prototype.destroy = function() {
        // Now you can remove them
        this.container.removeEventListener('pac:event', this.boundHandlePacEvent);
        this.container.removeEventListener('pac:change', this.boundHandleReactiveChange);
        this.container.removeEventListener('pac:array-change', this.boundHandleArrayChange);

        // Clear references
        this.boundHandlePacEvent = null;
        this.boundHandleReactiveChange = null;
        this.boundHandleArrayChange = null;
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
                const foreachId = Utils.uniqid('foreach');
                element.setAttribute('data-pac-foreach-id', foreachId);

                // Auto-detect and set the source array
                const foreachExpr = bindings.foreach.target;
                const sourceArray = this.inferArrayRoot(foreachExpr);
                element.setAttribute('data-pac-array', sourceArray);

                // Extend the existing mappingData with foreach-specific information
                Object.assign(mappingData, {
                    foreachExpr: bindings.foreach.target,
                    sourceArray: sourceArray,
                    foreachId: foreachId,
                    depth: self.calculateForEachDepth(element),
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

    Context.prototype.handleAttributeChanges = function(event, pathsToCheck) {
        const self = this;
        const changedRoot = event.detail.path[0]; // e.g., "todos"

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
                let shouldUpdate = bindingData.dependencies.some(dependency => {
                    return pathsToCheck.includes(dependency) ||
                        event.detail.path.join('.').startsWith(dependency + '.') ||
                        event.detail.path.join('.').startsWith(dependency + '[');
                });

                // Also check if element is in a foreach container affected by the change
                if (!shouldUpdate) {
                    const foreachContainer = element.closest('[data-pac-foreach-id]');

                    if (foreachContainer) {
                        const containerData = self.interpolationMap.get(foreachContainer);
                        if (containerData && containerData.sourceArray === changedRoot) {
                            shouldUpdate = true;
                        }
                    }
                }

                if (shouldUpdate) {
                    self.domUpdater.updateAttributeBinding(element, bindingType, bindingData);
                }
            });
        });
    };

    Context.prototype.handleTextInterpolation = function(event, pathsToCheck) {
        const self = this;
        const changedRoot = event.detail.path[0];

        self.textInterpolationMap.forEach((mappingData, textNode) => {
            // Check if any of the paths that changed affect this node
            // Need to check both exact matches and root property matches
            let shouldUpdate = mappingData.dependencies.some(dep => {
                return pathsToCheck.includes(dep) ||
                    event.detail.path.join('.').startsWith(dep + '.') ||
                    event.detail.path.join('.').startsWith(dep + '[');
            });

            // Also check if element is in a foreach container affected by the change
            if (!shouldUpdate) {
                const foreachContainer = textNode.parentElement?.closest('[data-pac-foreach-id]');

                if (foreachContainer) {
                    const containerData = self.interpolationMap.get(foreachContainer);

                    if (containerData && containerData.sourceArray === changedRoot) {
                        shouldUpdate = true;
                    }
                }
            }

            if (shouldUpdate) {
                self.domUpdater.updateTextNode(textNode, mappingData.template);
            }
        });
    };

    /**
     * Handles PAC events based on message type
     * @param {CustomEvent} event - The PAC event containing message details
     * @param {Object} event.detail - Event detail object
     * @param {string} event.detail.message - Message type from MSG_TYPES constants
     * @returns {void}
     */
    Context.prototype.handlePacEvent = function(event) {
        switch(event.detail.message) {
            case MSG_TYPES.MSG_LBUTTONDOWN:
            case MSG_TYPES.MSG_MBUTTONDOWN:
            case MSG_TYPES.MSG_RBUTTONDOWN:
                // Mouse button down events - no action taken
                break;

            case MSG_TYPES.MSG_LBUTTONUP:
            case MSG_TYPES.MSG_MBUTTONUP:
            case MSG_TYPES.MSG_RBUTTONUP:
                // Mouse button up events - handle DOM clicks
                this.handleDomClicks(event);
                break;

            case MSG_TYPES.MSG_SUBMIT:
                // Form submission events
                this.handleDomSubmit(event);
                break;

            case MSG_TYPES.MSG_CHANGE:
            case MSG_TYPES.MSG_CHAR:
                // Input change and character events
                this.handleDomChange(event);
                break;

            default :
                // Log unhandled message types
                console.warn(`[MSG_TYPES] ${event.detail.message}`);
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
                resolveScopedPath: (path) => this.resolveScopedPath(path, foreachElement)
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
            const resolvedPath = self.resolveScopedPath(valueBinding.target, targetElement);

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
            const resolvedPath = self.resolveScopedPath(checkedBinding.target, targetElement);

            // Checkbox: set boolean value based on checked state
            // Radio button: only update when this radio is selected, use its value
            if (targetElement.type === 'checkbox') {
                Utils.setNestedProperty(resolvedPath, event.detail.target.checked, this.abstraction);
            } else if (targetElement.type === 'radio' && event.detail.target.checked) {
                Utils.setNestedProperty(resolvedPath, event.detail.value, this.abstraction);
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
        // Convert the change path array to a string for dependency lookups
        const pathString = Utils.pathArrayToString(event.detail.path);
        const pathsToCheck = [pathString];

        // Check if the changed path has any registered dependencies and include them
        if (this.dependencies.has(pathString)) {
            pathsToCheck.push(...this.dependencies.get(pathString));
        }

        // Also check dependencies for the root property (first segment of the path)
        // This handles cases where nested changes should trigger root-level dependencies
        const rootProperty = event.detail.path[0];
        if (this.dependencies.has(rootProperty)) {
            pathsToCheck.push(...this.dependencies.get(rootProperty));
        }

        // Update text interpolations ({{variable}} expressions) that depend on changed paths
        this.handleTextInterpolation(event, pathsToCheck);

        // Update HTML attributes that are bound to changed paths
        this.handleAttributeChanges(event, pathsToCheck);

        // Handle foreach loop rebuilds when array data changes
        pathsToCheck.forEach(path => {
            // Skip nested property changes unless it's a direct array assignment
            // This prevents unnecessary rebuilds when individual array items change
            if (path === pathString && event.detail.path.length > 1) {
                return;
            }

            // Determine if this path could represent an array that needs foreach rebuilding
            // Check both computed functions (that might return arrays) and direct array properties
            const isComputedFunction = typeof this.abstraction.computed?.[path] === 'function';
            const isDirectArray = event.detail.path.length === 1 && Array.isArray(this.abstraction[path]);

            // Only proceed if this path could contain array data for foreach loops
            if (isComputedFunction || isDirectArray) {
                // Find all DOM elements with foreach directives that use this array path
                const foreachElements = this.findForeachElementsByArrayPath(path);

                // Rebuild each foreach element if conditions are met
                foreachElements.forEach(element => {
                    if (this.shouldRebuildForeach(element)) {
                        this.renderForeach(element);
                    }
                });
            }
        });
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
            // Trigger a complete re-render of the foreach element
            // This will recreate child elements based on the updated array data
            this.renderForeach(element);
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
            if (!Utils.belongsToPacContainer(this.container, element)) {
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
            const parsed = ExpressionCache.parseExpression(expression);
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

    /**
     * Renders a foreach loop by evaluating its array expression and generating DOM content.
     * @param {Element} foreachElement - DOM element with foreach binding
     * @returns {void}
     */
    Context.prototype.renderForeach = function(foreachElement) {
        const mappingData = this.interpolationMap.get(foreachElement);

        if (!mappingData || !mappingData.foreachId) {
            console.warn('No foreach binding found for element');
            return;
        }

        // Clean up old elements from maps before clearing innerHTML
        // This prevents memory leaks when re-rendering dynamic content
        this.cleanupForeachMaps(foreachElement);

        // Create scope resolver for this foreach element
        // This handles variable resolution in nested contexts (e.g., converting "todo.subs" to "todos[0].subs")
        const scopeResolver = {
            resolveScopedPath: (path) => this.resolveScopedPath(path, foreachElement)
        };

        try {
            // Evaluate the foreach expression (e.g., "todos" or "todo.subs")
            const array = ExpressionParser.evaluate(
                ExpressionCache.parseExpression(mappingData.foreachExpr),
                this.abstraction,
                scopeResolver
            );

            // TIMING FIX: Handle the case where parent context doesn't exist yet
            // If array is null/undefined, this indicates that the foreach expression
            // depends on a parent context that hasn't been established yet.
            //
            // Examples where this occurs:
            // - "todo.subs" when "todo" variable doesn't exist (nested foreach before parent renders)
            // - "item.children" when "item" is scoped to a parent loop that hasn't created context
            //
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

            // CRITICAL FIX: Get the source array to find original indices
            const sourceArray = this.getSourceArrayForFiltered(mappingData.foreachExpr, array);

            // Store array to be able to compare later
            foreachElement._pacPreviousArray = array;

            // Clear existing content and rebuild from scratch
            foreachElement.innerHTML = '';

            // Generate DOM content for each array item
            // HTML comments mark the boundaries and context for each iteration
            array.forEach((item, renderIndex) => {
                // Find the original index in the source array
                const originalIndex = this.findOriginalIndex(item, sourceArray, renderIndex);

                // Build the HTML
                foreachElement.innerHTML +=
                    `<!-- pac-foreach-item: ${mappingData.foreachId}, index=${originalIndex}, renderIndex=${renderIndex} -->` +
                    mappingData.template + // Original template with bindings like {{subItem.id}}
                    `<!-- /pac-foreach-item -->`;
            });

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
     * @returns {Array} The source array or current array if no source found
     */
    Context.prototype.getSourceArrayForFiltered = function(foreachExpr, currentArray) {
        // If it's a computed property, try to find the source array it's based on
        if (this.originalAbstraction.computed && this.originalAbstraction.computed[foreachExpr]) {
            // Look through dependencies to find array properties
            const dependencies = this.dependencies.get(foreachExpr) || [];

            for (const dep of dependencies) {
                const sourceValue = this.abstraction[dep];
                if (Array.isArray(sourceValue)) {
                    return sourceValue;
                }
            }
        }

        // If foreachExpr is a direct array property, return it
        if (Array.isArray(this.abstraction[foreachExpr])) {
            return this.abstraction[foreachExpr];
        }

        // Fallback: return the current array
        return currentArray;
    };

    /**
     * Finds the original index of an item in the source array
     * @param {*} item - The item to find
     * @param {Array} sourceArray - The source array to search in
     * @param {number} fallbackIndex - Fallback index if not found
     * @returns {number} The original index in the source array
     */
    Context.prototype.findOriginalIndex = function(item, sourceArray, fallbackIndex) {
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
     * Resolves a scoped path (e.g., 'item.name') to its actual data path by finding
     * the corresponding foreach element and building the indexed path.
     * @param {string} scopedPath - The scoped variable path to resolve (e.g., 'item.name')
     * @param {Element} element - The DOM element context for scope resolution
     * @returns {string} The resolved path with array indices (e.g., 'users[0].name') or original path if no resolution needed
     */
    Context.prototype.resolveScopedPath = function(scopedPath, element) {
        // If no dot in path, it's just a variable name - no resolution needed
        if (!scopedPath.includes('.')) {
            return scopedPath;
        }

        // Find the foreach element that defines this scoped variable
        const foreachElement = this.findForeachElementForScopedPath(scopedPath, element);

        if (!foreachElement) {
            return scopedPath;
        }

        /**
         * Get the interpolation mapping data for this foreach element.
         * This contains bindings, item variable name, and foreach ID needed for resolution.
         * @type {Object|undefined} mappingData - Contains bindings, itemVar, and foreachId properties
         */
        const mappingData = this.interpolationMap.get(foreachElement);
        if (!mappingData || !mappingData.bindings || !mappingData.bindings.foreach) {
            return scopedPath;
        }

        // Extract current index from HTML comments for this foreach
        const currentIndex = this.extractIndexFromComments(element, mappingData.foreachId);

        if (currentIndex === null) {
            return scopedPath;
        }

        // Extract the property path after the item variable
        const propertyPath = scopedPath.substring(mappingData.itemVar.length + 1);

        // Resolve the array expression using parent relationships and HTML comments
        const resolvedExpr = this.resolveArrayExpression(mappingData.bindings.foreach.target, foreachElement, element);

        // Build the final resolved path
        return resolvedExpr + '[' + currentIndex + ']' + (propertyPath ? '.' + propertyPath : '');
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
            resolveScopedPath: (path) => this.resolveScopedPath(path, foreachElement)
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
     *
     * @param {Element} startElement - The DOM element to start searching from
     * @returns {number|null} Foreach context object with foreachId, index, and renderIndex,
     *                        or null if no foreach context is found
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
     * Extracts the index from HTML comments by walking up the DOM tree
     * @param {Element} startElement - Element to start searching from
     * @param {string} foreachId - The foreach ID to look for in comments
     * @returns {number|null} The index or null if not found
     */
    Context.prototype.extractIndexFromComments = function(startElement, foreachId) {
        // Start from text node's parent if needed
        let current = startElement.nodeType === Node.TEXT_NODE ? startElement.parentElement : startElement;

        // Walk up the DOM to find this foreach's comment marker
        while (current && current !== this.container) {
            // Check previous siblings for comment markers
            let sibling = current.previousSibling;

            while (sibling) {
                if (sibling.nodeType === Node.COMMENT_NODE) {
                    const commentText = sibling.textContent.trim();

                    // Look for comment pattern: "pac-foreach-item: foreachId, index=X, renderIndex=Y"
                    const match = commentText.match(FOREACH_INDEX_REGEX);

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

        const parentElement = this.findParentForeachElement(foreachElement);

        if (!parentElement) {
            return arrayExpr;
        }

        const parentMapping = this.interpolationMap.get(parentElement);

        if (!parentMapping || !parentMapping.bindings.foreach) {
            return arrayExpr;
        }

        // Check if the array expression starts with the parent's item variable
        if (arrayExpr.startsWith(parentMapping.itemVar + '.')) {
            // Extract parent index from HTML comments
            const parentIndex = this.extractIndexFromComments(contextElement, parentMapping.foreachId);

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
        return controlUnit.context.abstraction;
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