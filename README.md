# WakaPAC

A full-featured application library built on the PAC pattern — bringing KnockoutJS-style simplicity to modern web apps.

## Introduction

WakaPAC is a complete application foundation built around the Presentation–Abstraction–Control (PAC) pattern. It provides everything needed for reactive web applications in a single 50KB library - no build tools, no dependency management, no ecosystem complexity.

### What's PAC?

**PAC (Presentation-Abstraction-Control)** is a hierarchical architectural pattern that creates a clean separation between:

1. **Presentation**: Your HTML templates and DOM elements - what the user sees
2. **Abstraction**: Your data model and business logic - what your app knows
3. **Control**: The reactive layer that mediates between presentation and abstraction - how they stay in sync

Unlike MVC where models and views can talk directly, PAC uses the Control layer as a smart mediator that:
- **Automatically syncs** data changes to the DOM
- **Handles events** from the presentation layer
- **Manages reactivity** and computed properties
- **Coordinates communication** between components

This results in more predictable data flow and easier debugging than traditional MVC patterns.

### Why WakaPAC?

- **Declarative HTML bindings** with `{{ mustache }}` templates and `data-pac-bind` attributes
- **Two-way reactivity** for objects and nested arrays
- **Advanced expression system** supporting arrays, objects, and complex operations
- **Drop-in script file** - no bundler required
- **Win32-style** `msgProc` for low-level event handling when you want total control
- **Hierarchical components** with parent—child notification
- **WakaSync** - seamlessly works with the companion WakaSync HTTP library for advanced features like request grouping, cancellation, and retry logic

### Who WakaPAC is For

- You want KnockoutJS-style simplicity with modern JavaScript power
- You need a complete solution without the complexity of React/Vue ecosystems
- You're building applications that need comprehensive functionality in a single library

### Not for you if

- You need SSR
- You want JSX/TSX or TypeScript-first DX
- You're building a massive SPA that already fits better in React/Vue

## Installation

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional: Add WakaSync for HTTP functionality -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakasync.min.js"></script>

<!-- Or download files -->
<script src="wakapac.min.js"></script>
<script src="wakasync.min.js"></script>
```

## Quick Example

```html
<!DOCTYPE html>
<html>
<head>
    <script src="wakapac.min.js"></script>
</head>
<body>
<div id="my-app">
    <h1>Hello {{ name }}!</h1>
    <p>Count: {{ count }}</p>
    <button data-pac-bind="click: increment">Click me!</button>
</div>

<script>
    wakaPAC('#my-app', {
        name: 'World',
        count: 0,

        increment() {
            this.count++;
        }
    });
</script>
</body>
</html>
```

## Basic Features - Data Binding

### Text Interpolation

Text interpolation allows you to dynamically insert data into your HTML templates using mustache syntax ({{ }}). This enables you to create dynamic content that updates based on your application's state.

```html
<!-- Simple properties -->
<p>Hello, {{ name }}!</p>

<!-- Nested properties -->
<p>User: {{ user.name }} ({{ user.age }})</p>

<!-- Ternary expressions -->
<p>Status: {{ user.age >= 18 ? 'Adult' : 'Minor'}}</p>

<!-- Computed properties -->
<p>Total: {{ totalPrice }}</p>

<!-- Arithmetic Operations -->
<p>Total: ${{ price * quantity }}</p>

<!-- String Operations -->
<p>Full Name: {{ firstName + ' ' + lastName }}</p>
```

### Advanced Expression System

WakaPAC supports JavaScript-like expressions in templates and bindings, enabling complex data operations directly in your HTML:

#### Array Literals and Operations
```html
<!-- Array literals -->
<div data-pac-bind="visible: [1, 2, 3][selectedIndex]">

    <!-- Array indexing -->
    <span>{{ items[currentIndex].title }}</span>

    <!-- Array length -->
    <p>Total items: {{ items.length }}</p>
```

#### Object Literals
```html
<!-- Object creation -->
<div data-pac-bind="style: {color: textColor, fontSize: size + 'px'}">

    <!-- Conditional object properties -->
    <div data-pac-bind="class: {active: isSelected, disabled: !isEnabled}">
```

#### Complex Conditionals
```html
<!-- Multiple conditions -->
<div data-pac-bind="visible: user.role === 'admin' && user.active">

    <!-- Nested ternary -->
    <span>{{ status === 'loading' ? 'Please wait...' : status === 'error' ? 'Try again' : 'Ready' }}</span>

    <!-- Array operations -->
    <div data-pac-bind="if: allowedRoles.includes(user.role)">
```

### Complete Binding Reference

WakaPAC provides comprehensive data binding capabilities through the `data-pac-bind` attribute. Here's the complete list of supported binding types:

#### Form Input Bindings

**`value`** - Two-way binding for form inputs
```html
<input data-pac-bind="value: name" type="text">
<textarea data-pac-bind="value: description"></textarea>
<select data-pac-bind="value: selectedOption">
    <option value="A">Option A</option>
    <option value="B">Option B</option>
</select>
```

**`checked`** - Boolean state for checkboxes
```html
<input type="checkbox" data-pac-bind="checked: isActive">

<!-- For radio buttons, use value binding instead -->
<input type="radio" name="theme" value="light" data-pac-bind="value: selectedTheme">
<input type="radio" name="theme" value="dark" data-pac-bind="value: selectedTheme">
```

#### Display Control Bindings

**`visible`** - Show/hide with CSS display (element stays in DOM)
```html
<div data-pac-bind="visible: shouldShow">Content</div>
<div data-pac-bind="visible: !hideContent">Always shown unless hideContent is true</div>
```

**`if`** - Conditional rendering (clears/restores innerHTML, element stays in DOM)
```html
<div data-pac-bind="if: user.isAdmin">Admin Panel</div>
<div data-pac-bind="if: !isLoading">Content loaded</div>
```

**`<!-- wp-if: expression -->`** - Conditional rendering without wrapper elements
```html
<!-- wp-if: showMessage -->
<div>This content is conditionally rendered</div>
<!-- /wp-if -->

<!-- Perfect for tables (no wrapper needed) -->
<table>
    <tbody>
    <!-- wp-if: user.isLoggedIn -->
    <tr><td>User data row 1</td></tr>
    <tr><td>User data row 2</td></tr>
    <!-- /wp-if -->
    </tbody>
</table>

<!-- Multiple siblings controlled together -->
<!-- wp-if: user.isPremium -->
<div>Premium Feature 1</div>
<div>Premium Feature 2</div>
<div>Premium Feature 3</div>
<!-- /wp-if -->
```

**When to use each:**

| Use Case                         | Best Choice      | Why                                          |
|----------------------------------|------------------|----------------------------------------------|
| Fast toggling, CSS transitions   | `visible`        | Element stays rendered, just hidden with CSS |
| Complex nested structures        | `if`             | Removes content from memory when hidden      |
| Form inputs you want to preserve | `visible`        | Input values remain intact                   |
| Table rows, grid items           | `<!-- wp-if -->` | No wrapper element needed                    |
| Multiple siblings as group       | `<!-- wp-if -->` | Controls multiple elements together          |
| Text nodes without wrapper       | `<!-- wp-if -->` | Works directly with text                     |
| Single element with wrapper      | `if`             | Simpler when wrapper already exists          |

#### Attribute Bindings

**`enable`** - Enable/disable form controls
```html
<button data-pac-bind="enable: isFormValid">Submit</button>
<input data-pac-bind="enable: !isReadonly">
```

**Custom attributes** - Any HTML attribute can be bound directly
```html
<!-- Standard attributes -->
<input data-pac-bind="placeholder: hintText, title: tooltipText">
<img data-pac-bind="src: imageUrl, alt: altText">
<div data-pac-bind="id: dynamicId, role: userRole">

    <!-- Data attributes -->
    <div data-pac-bind="data-id: userId, data-category: itemCategory">

        <!-- ARIA attributes -->
        <button data-pac-bind="aria-label: accessibilityLabel, aria-expanded: isExpanded">

            <!-- Multiple custom attributes -->
            <div data-pac-bind="title: tooltipText, data-id: itemId, tabindex: tabOrder">
```

#### Style and Appearance Bindings

**`class`** - CSS class manipulation (supports object syntax)
```html
<!-- Simple class binding -->
<div data-pac-bind="class: statusClass">

    <!-- Object syntax: conditional classes -->
    <div data-pac-bind="class: { active: isActive, disabled: !enabled, error: hasError }">
```

**`style`** - CSS style manipulation (supports object syntax)
```html
<!-- Simple style binding -->
<div data-pac-bind="style: dynamicStyleString">

    <!-- Object syntax: multiple CSS properties -->
    <div data-pac-bind="style: { color: textColor, backgroundColor: bgColor }">

        <!-- CSS custom properties -->
        <div data-pac-bind="style: { '--theme-color': primaryColor, '--border-width': borderSize + 'px' }">
```

#### List Rendering Binding

**`foreach`** - Render lists with templates
```html
<div data-pac-bind="foreach: items" data-pac-item="item" data-pac-index="index">
    <div class="item">
        <span>{{ $index }}. {{ item.name }}</span>
        <button data-pac-bind="click: removeItem">Remove</button>
    </div>
</div>
```

#### Event Bindings

All standard DOM events are supported:

**`click`** - Mouse click events
```html
<button data-pac-bind="click: handleClick">Click me</button>
```

**`change`** - Form change events
```html
<select data-pac-bind="change: handleChange">
```

**`input`** - Form input events (as user types)
```html
<input data-pac-bind="input: handleInput">
```

**`submit`** - Form submission
```html
<form data-pac-bind="submit: handleSubmit">
```

**`focus`** / **`blur`** - Focus events
```html
<input data-pac-bind="focus: handleFocus, blur: handleBlur">
```

**`keyup`** / **`keydown`** - Keyboard events
```html
<input data-pac-bind="keyup: handleKey" data-pac-event="enter">
<input data-pac-bind="keydown: handleKeyDown" data-pac-event="escape">
```

#### Event Modifiers

Event modifiers allow you to control how events behave by using the `data-pac-event` attribute. They can prevent default browser actions, filter events to specific keys, or control event propagation. Multiple modifiers can be combined by separating them with spaces.

```html
<!-- Prevent form submission redirect -->
<form data-pac-bind="submit: handleSubmit" data-pac-event="prevent">

    <!-- Search on Enter key -->
    <input data-pac-bind="keyup: search" data-pac-event="enter">

    <!-- Close modal on Escape -->
    <div data-pac-bind="keyup: closeModal" data-pac-event="escape">

        <!-- Multiple modifiers -->
        <form data-pac-bind="submit: handleForm" data-pac-event="prevent stop">
```

**Available modifiers:**
- **Keys**: `enter`, `escape`/`esc`, `space`, `tab`, `delete`/`del`, `up`, `down`, `left`, `right`
- **Behavior**: `prevent`, `stop`

### Deep Reactivity

WakaPAC automatically tracks changes in nested objects and arrays:

```javascript
wakaPAC('#app', {
    user: {
        name: 'John',
        preferences: { theme: 'dark' }
    },
    todos: [],

    addTodo() {
        // Array mutations are automatically reactive
        this.todos.push({ text: 'New todo', completed: false });
    },

    toggleTodo(index) {
        // Deep nested changes are reactive
        this.todos[index].completed = !this.todos[index].completed;
    },

    updateTheme(newTheme) {
        // Deep nested property changes are reactive
        this.user.preferences.theme = newTheme;
    }
});
```

### Lists and For-Each

```html
<div data-pac-bind="foreach: todos" data-pac-item="todo" data-pac-index="index">
    <div class="todo-item">
        <span>{{ $index }}. {{ todo.text }}</span>
        <input type="checkbox" data-pac-bind="checked: todo.completed">
        <button data-pac-bind="click: removeTodo">Remove</button>
    </div>
</div>
```

```javascript
wakaPAC('#app', {
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: false},
        {id: 2, text: 'Build an app', completed: true}
    ],

    // Event handlers receive item, index, and event
    removeTodo(todo, index, event) {
        const todoIndex = this.todos.findIndex(t => t.id === todo.id);
        this.todos.splice(todoIndex, 1);
    },

    // Foreach callback receives array and metadata
    onItemsUpdated(items, meta) {
        console.log(`List updated with ${items.length} items`);
    }
});
```

### Update Modes

Control when form inputs update your data:

```html
<!-- Immediate (default) - updates on every keystroke -->
<input data-pac-bind="value: name">

<!-- Change - updates when input loses focus -->
<input data-pac-bind="value: name" data-pac-update-mode="change">

<!-- Delayed - updates after specified delay (debounced) -->
<input data-pac-bind="value: searchQuery"
       data-pac-update-mode="delayed"
       data-pac-update-delay="500">
```

**Use cases:**
- **Immediate**: Real-time validation, character counters
- **Change**: Server validation, auto-save functionality
- **Delayed**: Search autocomplete, API queries

## HTTP Client Usage (WakaSync)

WakaPAC works well with WakaSync for HTTP requests. Simply instantiate WakaSync in your components where needed.

### Basic Usage

```javascript
wakaPAC('#app', {
    user: null,
    loading: false,
    error: null,

    init() {
        // Create HTTP client instance
        this.http = new WakaSync({
            timeout: 10000,
            retries: 1
        });
    },

    async loadUser() {
        this.loading = true;
        this.error = null;

        try {
            this.user = await this.http.get('/api/user');
        } catch (error) {
            this.error = error.message;
        } finally {
            this.loading = false;
        }
    }
});
```

### HTTP Methods

```javascript
wakaPAC('#app', {
    init() {
        this.http = new WakaSync();
    },

    async saveData() {
        // GET request
        const users = await this.http.get('/api/users');

        // POST with data
        const newUser = await this.http.post('/api/users', {
            name: 'John Doe',
            email: 'john@example.com'
        });

        // PUT update
        await this.http.put(`/api/users/${newUser.id}`, {
            name: 'Jane Doe'
        });

        // DELETE
        await this.http.delete(`/api/users/${newUser.id}`);

        // PATCH partial update
        await this.http.patch(`/api/users/${newUser.id}`, {
            lastLogin: new Date().toISOString()
        });
    }
});
```

### Advanced HTTP Features

#### Request with Options
```javascript
const userData = await this.http.request('/api/user', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${this.token}`
    },
    timeout: 5000,
    onSuccess: (data) => {
        console.log('User loaded:', data);
    },
    onError: (error) => {
        console.error('Load failed:', error);
    }
});
```

#### File Upload
```javascript
// FormData upload
const formData = new FormData();
formData.append('file', file);
await this.http.post('/api/upload', formData);
```

#### Request Cancellation
```javascript
wakaPAC('#app', {
    init() {
        this.http = new WakaSync();
    },

    cancelAllRequests() {
        this.http.cancelAll();
    },

    cancelSearches() {
        this.http.cancelGroup('search');
    }
});
```

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Network Status:**
- **`browserOnline`**: `true` when the browser is online, `false` when offline
- **`browserNetworkQuality`**: Network performance insights: `'fast'`, `'slow'` or `'offline'`

**Page Visibility:**
- **`browserVisible`**: `true` when the browser tab is active/visible, `false` when hidden

**Scroll Position:**
- **`browserScrollX`**: Horizontal scroll position in pixels (can be set programmatically)
- **`browserScrollY`**: Vertical scroll position in pixels (can be set programmatically)

**Page Dimensions:**
- **`browserViewportWidth`**: Browser viewport width in pixels
- **`browserViewportHeight`**: Browser viewport height in pixels
- **`browserDocumentWidth`**: Total document width in pixels
- **`browserDocumentHeight`**: Total document height in pixels

**Container Viewport Visibility:**
- **`containerVisible`**: `true` when any part of the container is visible in viewport
- **`containerFullyVisible`**: `true` when container is completely visible in viewport
- **`containerClientRect`**: Position and dimensions object relative to viewport (DOMRect)
- **`containerWidth`**: Container width in pixels
- **`containerHeight`**: Container height in pixels

**Container Scroll Properties:**
- **`containerIsScrollable`**: `true` if container can scroll in any direction
- **`containerScrollX`**: Current horizontal scroll position in pixels (can be set programmatically)
- **`containerScrollY`**: Current vertical scroll position in pixels (can be set programmatically)
- **`containerScrollContentWidth`**: Total scrollable content width (scrollWidth)
- **`containerScrollContentHeight`**: Total scrollable content height (scrollHeight)
- **`containerScrollWindow`**: Object containing scroll measurements (DOMRect)

**Container Focus State:**
- **`containerFocus`**: `true` when container has direct focus (`:focus`)
- **`containerFocusWithin`**: `true` when container or child has focus (`:focus-within`)

**Component Hierarchy Properties:**
- **`childrenCount`**: Number of direct child PAC components (read-only, reactive)
- **`hasParent`**: `true` if this component has a parent PAC component, `false` if it's a root component

### Usage Examples

```html
<!-- Browser properties in templates -->
<p>Viewport: {{ browserViewportWidth }} x {{ browserViewportHeight }}</p>
<p data-pac-bind="visible: !browserVisible">Tab is hidden - updates paused</p>
<p>Container is {{ containerVisible ? 'visible' : 'hidden' }} in viewport</p>
```

```javascript
wakaPAC('#app', {
    init() {
        // Set initial document title based on visibility
        document.title = this.browserVisible ? 'App Active' : 'App Paused';
    },

    watch: {
        browserVisible(isVisible) {
            document.title = isVisible ? 'App Active' : 'App Paused';
        },

        containerVisible(isVisible) {
            if (isVisible) {
                this.startAnimation();
            } else {
                this.pauseAnimation();
            }
        }
    }
});
```

## Advanced Features

### Computed Properties

Computed properties automatically recalculate when their dependencies change:

```javascript
wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    items: [{price: 10}, {price: 20}],

    computed: {
        // Simple computed property
        fullName() {
            return `${this.firstName} ${this.lastName}`;
        },

        // Array-dependent computed property
        totalPrice() {
            return this.items.reduce((sum, item) => sum + item.price, 0);
        },

        // Complex computed property with conditional logic
        shippingCost() {
            return this.totalPrice > 50 ? 0 : 9.99;
        }
    }
});
```

### Watchers

Watchers execute code when reactive properties change:

```javascript
wakaPAC('#app', {
    searchQuery: '',

    watch: {
        // Called when searchQuery changes 
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2) {
                this.performSearch(newValue);
            }
        }
    }
});
```

### Component Lifecycle

```javascript
wakaPAC('#app', {
    message: 'Hello',
    user: null,

    init() {
        // Runs after component initialization
        console.log('Component is ready!');
        document.title = `App - ${this.message}`;
        this.loadUserData();
    },

    async loadUserData() {
        this.user = await fetch('/api/user').then(r => r.json());
    }
});
```

### MsgProc - Win32-Style Message Processing

WakaPAC provides a powerful low-level event processing system inspired by Win32 window procedures. The `msgProc` method gives you complete control over event handling before standard bindings execute.

#### Message Flow

```
DOM Event Occurs
    ↓
msgProc processes message (if defined)
    ↓
    Returns false? → Event handled, stop processing (preventDefault called)
    Returns true (or undefined)? → Continue to standard bindings
    ↓
Standard data-pac-bind handlers execute (if msgProc returned true/undefined)
```

#### Basic Usage

```javascript
wakaPAC('#app', {
    msgProc(event) {
        // Handle specific message types
        switch(event.message) {
            case MSG_TYPES.MSG_KEYDOWN:
                // Handle keyboard input
                break;

            case MSG_TYPES.MSG_LCLICK:
                // Handle mouse clicks
                break;
        }

        // Return false to prevent standard bindings from executing
        // Return true (or undefined) to allow standard bindings to process
        return true;
    }
});
```

#### Event Object Structure

The `msgProc` method receives a CustomEvent with Win32-style message properties as top-level properties:

```javascript
{
    type: 'pac:event',             // Always 'pac:event' for msgProc
        message: 0x0201,               // Message type from MSG_TYPES constants
        wParam: 0x0001,                // Primary parameter (varies by message type)
        lParam: 0x00640032,            // Secondary parameter (varies by message type)
        target: HTMLElement,           // The DOM element that triggered the event
        originalEvent: Event,          // Original browser DOM event object
        timestamp: 1640995200000,      // Timestamp when event was dispatched
        id: 'element-id',              // Element ID if available, null otherwise
        detail: {}                     // Extended data specific to certain event types (optional)
}
```

**Key Properties:**

All Win32-style properties are directly on the event object (not nested in `event.detail`):

- **`message`**: Message type constant indicating what kind of event occurred
- **`wParam`**: Primary parameter containing flags, button states, or primary data
- **`lParam`**: Secondary parameter containing coordinates, form data, or other contextual info
- **`target`**: The actual DOM element where the event originated
- **`originalEvent`**: Access to all native browser event properties and methods
- **`timestamp`**: Milliseconds since epoch when the event was created
- **`id`**: Convenience access to target.id (or null if not set)
- **`detail`**: Optional extended metadata (only present for certain event types like MSG_CHAR, MSG_CHANGE)

**Note:** Prior versions of WakaPAC nested these properties in `event.detail`. The current version places them directly on the event for cleaner access. The `detail` property is now reserved only for optional extended data.

#### Message Types Reference

**Mouse Movement:**
```javascript
MSG_TYPES.MSG_MOUSEMOVE    // 0x0200 - Mouse position changed
// Throttled to 60 FPS by default (configurable via wakaPAC.mouseMoveThrottleFps)
// Coordinates in lParam are container-relative (client-area relative)
```

**Mouse Button Events (Raw Button Tracking):**
```javascript
MSG_TYPES.MSG_LBUTTONDOWN  // 0x0201 - Left button pressed
MSG_TYPES.MSG_LBUTTONUP    // 0x0202 - Left button released
MSG_TYPES.MSG_LBUTTONDBLCLK// 0x0203 - Left button double-click
MSG_TYPES.MSG_RBUTTONDOWN  // 0x0204 - Right button pressed
MSG_TYPES.MSG_RBUTTONUP    // 0x0205 - Right button released
MSG_TYPES.MSG_MBUTTONDOWN  // 0x0207 - Middle button pressed
MSG_TYPES.MSG_MBUTTONUP    // 0x0208 - Middle button released
```

**Click Events (Semantic User Actions):**
```javascript
MSG_TYPES.MSG_LCLICK       // 0x0210 - Left click (triggers click: bindings)
MSG_TYPES.MSG_MCLICK       // 0x0211 - Middle click
MSG_TYPES.MSG_RCLICK       // 0x0212 - Right click (contextmenu)
```

**Keyboard Events:**
```javascript
MSG_TYPES.MSG_KEYDOWN      // 0x0100 - Key pressed down
MSG_TYPES.MSG_KEYUP        // 0x0101 - Key released
```

**Form Events:**
```javascript
MSG_TYPES.MSG_CHAR         // 0x0300 - Text input (typing in fields)
MSG_TYPES.MSG_CHANGE       // 0x0301 - Form control changed (triggers change: bindings)
MSG_TYPES.MSG_SUBMIT       // 0x0302 - Form submitted (triggers submit: bindings)
```

**Focus Events:**
```javascript
MSG_TYPES.MSG_FOCUS        // 0x0007 - Element gained focus
MSG_TYPES.MSG_BLUR         // 0x0008 - Element lost focus
```

#### wParam and lParam by Message Type

##### Mouse Events (LBUTTONDOWN, RBUTTONDOWN, MBUTTONDOWN, LBUTTONUP, RBUTTONUP, MBUTTONUP, LCLICK, MCLICK, RCLICK)

**wParam** - Modifier key and button state flags (bitwise OR of flags):
```javascript
// Extract modifier keys and button states
if (wParam & MK_CONTROL) { /* Ctrl key held */ }     // 0x0010
if (wParam & MK_SHIFT)   { /* Shift key held */ }    // 0x0008
if (wParam & MK_ALT)     { /* Alt key held */ }      // 0x0020
if (wParam & MK_LBUTTON) { /* Left button held */ }  // 0x0001
if (wParam & MK_RBUTTON) { /* Right button held */ } // 0x0002
if (wParam & MK_MBUTTON) { /* Middle button held */ }// 0x0004
```

**lParam** - Mouse coordinates packed into 32 bits:
```javascript
// Extract x and y coordinates from lParam
const x = lParam & 0xFFFF;           // Low 16 bits = x coordinate
const y = (lParam >> 16) & 0xFFFF;   // High 16 bits = y coordinate

// These are viewport-relative coordinates (clientX, clientY)
```

**Example:**
```javascript
case MSG_TYPES.MSG_LBUTTONDOWN:
const x = lParam & 0xFFFF;
const y = (lParam >> 16) & 0xFFFF;

if (wParam & MK_CONTROL) {
    console.log(`Ctrl+Click at (${x}, ${y})`);
}
break;
```

##### Keyboard Events (KEYDOWN, KEYUP)

**wParam** - Virtual key code:
```javascript
// The keyCode from the original event
const keyCode = wParam;  // e.g., 13 for Enter, 27 for Escape
```

**lParam** - Keyboard state flags (32-bit value):
```javascript
// Bits 0-15: Repeat count
const repeatCount = lParam & 0xFFFF;

// Bit 24: Extended key flag (arrow keys, function keys, etc.)
const isExtended = (lParam & (1 << 24)) !== 0;

// Bit 31: Key release flag (0 = keydown, 1 = keyup)
const isRelease = (lParam & (1 << 31)) !== 0;
```

**Extended Keys:**
- Arrow keys (Up, Down, Left, Right)
- Function keys (F1-F12)
- Navigation keys (Home, End, PageUp, PageDown, Insert, Delete)
- Numpad Enter and Divide
- Windows/Meta keys
- Context Menu key

**Example:**
```javascript
case MSG_TYPES.MSG_KEYDOWN:
const keyCode = wParam;
const isExtended = (lParam & (1 << 24)) !== 0;

if (keyCode === 13) {  // Enter key
    console.log('Enter pressed');
}

if (isExtended) {
    console.log('Extended key (arrow, function key, etc.)');
}
break;
```

##### Text Input Events (CHAR)

**wParam** - Text length:
```javascript
const textLength = wParam;  // Length of text in the input field
```

**lParam** - Not used (always 0)

**Extended data:**
```javascript
event.detail = {
    elementType: 'input' | 'textarea'  // Type of input element
};
```

**Example:**
```javascript
case MSG_TYPES.MSG_CHAR:
console.log(`Text field has ${event.wParam} characters`);
console.log(`Value: ${event.target.value}`);
break;
```

##### Form Change Events (CHANGE)

**wParam** - Element-specific value:
```javascript
// For checkboxes: 1 = checked, 0 = unchecked
// For radio buttons: index in radio group
// For select elements: selectedIndex
```

**lParam** - Not used (always 0)

**Extended data:**
```javascript
event.detail = {
    elementType: 'select' | 'radio' | 'checkbox'
};
```

**Example:**
```javascript
case MSG_TYPES.MSG_CHANGE:
const target = event.target;

if (target.type === 'checkbox') {
    const isChecked = wParam === 1;
    console.log(`Checkbox is now ${isChecked ? 'checked' : 'unchecked'}`);
}

if (target.tagName === 'SELECT') {
    console.log(`Selected index: ${wParam}`);
}

break;
```

##### Form Submit Events (SUBMIT)

**wParam** - Form ID:
```javascript
const formId = wParam;  // The id attribute of the form, or null
```

**lParam** - Form data object:
```javascript
// Object containing all form fields
const formData = lParam;  // e.g., { name: 'John', email: 'john@example.com' }
```

**Example:**
```javascript
case MSG_TYPES.MSG_SUBMIT:
console.log('Form submitted:', lParam);
console.log('Form ID:', wParam);

// Validate form data
if (!lParam.email || !lParam.email.includes('@')) {
    originalEvent.preventDefault();
    return true;  // Stop processing
}
break;
```

##### Focus Events (FOCUS, BLUR)

**wParam** - Not used (always 0)

**lParam** - Not used (always 0)

**Example:**
```javascript
case MSG_TYPES.MSG_FOCUS:
console.log('Element gained focus:', event.target);
break;

case MSG_TYPES.MSG_BLUR:
console.log('Element lost focus:', event.target);
break;
```

#### Modifier Key Constants

Use these constants to check button and key states in wParam:

```javascript
const MK_LBUTTON = 0x0001;  // Left mouse button
const MK_RBUTTON = 0x0002;  // Right mouse button
const MK_MBUTTON = 0x0004;  // Middle mouse button
const MK_SHIFT   = 0x0008;  // Shift key
const MK_CONTROL = 0x0010;  // Control key
const MK_ALT     = 0x0020;  // Alt key
```

#### Cancellable Message Types

Only these message types can be cancelled by returning `false` from msgProc:

- `MSG_LBUTTONUP`, `MSG_MBUTTONUP`, `MSG_RBUTTONUP` (button release)
- `MSG_LCLICK`, `MSG_MCLICK`, `MSG_RCLICK` (click events)
- `MSG_SUBMIT` (form submission)
- `MSG_CHANGE` (form control changes)

Returning `false` prevents:
1. The original DOM event's default behavior (preventDefault is called)
2. Execution of standard `data-pac-bind` handlers

For all other message types, the return value is ignored and standard processing continues.

#### Complete Examples

##### Example 1: Global Keyboard Shortcuts

```javascript
wakaPAC('#app', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_KEYDOWN) {
            // Check for Ctrl key combinations
            if (event.wParam & MK_CONTROL) {
                switch (event.originalEvent.key) {
                    case 's':
                        this.saveDocument();
                        event.preventDefault();
                        return false;  // Stop processing

                    case 'o':
                        this.openDocument();
                        event.preventDefault();
                        return false;

                    case 'f':
                        this.showFindDialog();
                        event.preventDefault();
                        return false;
                }
            }

            // Escape key closes modals
            if (event.originalEvent.key === 'Escape') {
                this.closeAllModals();
                return true;
            }
        }

        return false;  // Allow other handlers to process
    }
});
```

##### Example 2: Keyboard State Tracking

```javascript
wakaPAC('#text-editor', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_KEYDOWN) {
            const repeatCount = event.lParam & 0xFFFF;
            const isExtended = (event.lParam & (1 << 24)) !== 0;

            // Track key repeats for auto-scroll
            if (repeatCount > 1 && isExtended) {
                // This is a repeated arrow key press
                this.accelerateScroll();
            }

            // Special handling for function keys
            if (isExtended && event.originalEvent.key.startsWith('F')) {
                this.handleFunctionKey(event.originalEvent.key);
                return true;
            }

        return true;
    }
});
```

##### Example 3: Mouse Tracking

```javascript
wakaPAC('#app', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_MOUSEMOVE) {
            // Extract container-relative coordinates
            const pos = this.MAKEPOINTS(event.lParam);  // {x, y}
            
            // Check if left button is held while moving (dragging)
            if (event.wParam & MK_LBUTTON) {
                this.handleDrag(pos);
            }
        }
        
        // Handle double-click
        if (event.message === MSG_TYPES.MSG_LBUTTONDBLCLK) {
            const pos = this.MAKEPOINTS(event.lParam);
            this.openItem(pos);
            return false;
        }
        
        return true;
    }
});
```

**Mouse Coordinate Functions:**
- `this.LOWORD(lParam)` - Extract x coordinate (low 16 bits)
- `this.HIWORD(lParam)` - Extract y coordinate (high 16 bits)
- `this.MAKEPOINTS(lParam)` - Extract both as `{x, y}` object
- `this.containerToViewport(x, y)` - Convert container coords to viewport coords
- `this.viewportToContainer(x, y)` - Convert viewport coords to container coords

**Mouse Movement Throttling:**
```javascript
// Set before creating components (default: 60 FPS)
wakaPAC.mouseMoveThrottleFps = 120;  // High precision (gaming, drawing)
wakaPAC.mouseMoveThrottleFps = 30;   // Battery saving
wakaPAC.mouseMoveThrottleFps = 0;    // No throttling (every event)
```

**Note:** All mouse coordinates in `lParam` are relative to the container's top-left corner (Win32 client-area style), making it easy to position elements or draw on canvas within the container.
}

        return false;
    }
});
```

#### When to Use MsgProc vs Standard Bindings

**Use msgProc for:**
- Global keyboard shortcuts (Ctrl+S, Ctrl+C, etc.)
- Low-level mouse tracking (drag operations, drawing)
- Complex event coordination across multiple elements
- Event interception and validation before standard processing
- Performance-critical event handling
- Custom context menus and right-click behavior

**Use standard `data-pac-bind` for:**
- Simple button clicks
- Form input handling
- Most user interactions
- Declarative, readable event handling
- When you don't need to prevent default behavior

#### Performance Considerations

1. **msgProc runs for every event** - keep logic fast and focused
2. **Return early** - use `return true` as soon as you know processing is complete
3. **Avoid heavy computations** - defer expensive operations to separate methods
4. **Cache calculations** - don't recalculate coordinates repeatedly

#### Common Patterns

**Pattern 1: Modifier Key Combos**
```javascript
if (message === MSG_TYPES.MSG_LCLICK) {
    if ((wParam & MK_CONTROL) && (wParam & MK_SHIFT)) {
        // Ctrl+Shift+Click
    } else if (wParam & MK_CONTROL) {
        // Ctrl+Click
    } else if (wParam & MK_SHIFT) {
        // Shift+Click
    }
}
```

**Pattern 2: Coordinate Extraction Helper**
```javascript
function getCoords(lParam) {
    return {
        x: lParam & 0xFFFF,
        y: (lParam >> 16) & 0xFFFF
    };
}

// Usage
const { x, y } = getCoords(lParam);
```

**Pattern 3: Event Filtering**
```javascript
// Only process events from specific elements
if (!target.matches('.draggable')) {
    return false;  // Let other handlers deal with it
}

// Your handling logic here
```

### Component Hierarchy

#### Component Identification

Each wakaPAC component is identified by a `data-pac-id` attribute. If your element has an `id` attribute, wakaPAC automatically uses it as the `data-pac-id` - otherwise it generates a unique identifier:

```html
<!-- Element with id - automatically uses "sidebar" as data-pac-id -->
<div id="sidebar"></div>

<!-- Element without id - generates "pac-abc123..." as data-pac-id -->
<div class="widget"></div>

<script>
    wakaPAC('#sidebar', { /* ... */ });  // data-pac-id="sidebar"
    wakaPAC('.widget', { /* ... */ });   // data-pac-id="pac-abc123..."
</script>
```

This makes debugging easier with meaningful identifiers and simplifies parent-child communication:

```html
<div id="parent">
    <div id="child-1"></div>
    <div id="child-2"></div>
</div>

<script>
    wakaPAC('#parent', {
        updateChild() {
            // Target specific child using its id (used as data-pac-id)
            this.notifyChild('child-1', 'update', { value: 42 });
        }
    });
</script>
```

#### Parent-Child Communication

Parent-child communication system:

```javascript
// Child to Parent (Notifications)
const child = wakaPAC('#child-app', {
    sendAlert() {
        this.notifyParent('alert', {
            message: 'Something important happened'
        });
    }
});

// Parent receives notifications
const parent = wakaPAC('#parent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'alert') {
            console.log('Alert:', data.message);
        }
    }
});

// Parent to Child (Commands)
const parent = wakaPAC('#parent-app', {
    broadcastMessage() {
        // Notify all children
        this.notifyChildren('update', {theme: 'dark'});

        // Notify specific child by its data-pac-id
        this.notifyChild('child-app', 'focus');
    }
});

// Child receives commands
const child = wakaPAC('#child-app', {
    receiveFromParent(command, data) {
        if (command === 'update') {
            this.applyTheme(data.theme);
        }
    }
});
```

#### Event Bubbling

By default, `notifyParent` only sends the event to the immediate parent. You can enable automatic bubbling up the entire component hierarchy by setting the third parameter to `true`:

```javascript
// Grandchild component
const grandchild = wakaPAC('#grandchild-app', {
    triggerValidation() {
        // Bubble event up through parent to grandparent
        this.notifyParent('validation-failed', {
            field: 'email',
            error: 'Invalid format'
        }, true);  // Enable bubbling
    }
});

// Parent component - event passes through
const parent = wakaPAC('#parent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'validation-failed') {
            console.log('Child validation failed:', data.field);
            // Return value controls bubbling:
            // - Don't return anything: event continues bubbling up
            // - Return true: event continues bubbling up
            // - Return false: stop bubbling here
            return false; // Stop propagation
        }
    }
});

// Grandparent component - receives event if not stopped
const grandparent = wakaPAC('#grandparent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'validation-failed') {
            this.showGlobalError(data);
        }
    }
});
```

**When to use bubbling:**
- Global error handling at root level
- Application-wide events (logout, theme change)
- Events that multiple ancestor levels need to observe

**When to use direct parent notification (default):**
- Direct parent-child communication
- Events specific to immediate parent
- Better performance (fewer handler calls)


### Inter-Container Communication

WakaPAC provides Win32-style messaging for communication between containers that aren't in a parent-child hierarchy.

#### Message Broadcasting

Broadcast a message to all containers using `postMessage`:

```javascript
wakaPAC.postMessage(WM_USER_LOGIN, 123, 0, { name: 'Harry', role: 'admin' });
```

#### Targeted Messaging

Send a message to a specific container using its `data-pac-id` with `sendMessage`:

```javascript
wakaPAC.sendMessage('user-panel', WM_USER_LOGIN, 123, 0, { name: 'Harry', role: 'admin' });
```

#### Handling Messages

Containers receive messages through their `msgProc` function:

```javascript
const WM_USER_LOGIN = 0x0001;

wakaPAC('#user-panel', {
    userName: '',
    
    msgProc(event) {
        if (event.message === WM_USER_LOGIN) {
            // Update container state using extraData
            this.userName = event.detail.name;
        }
    }
});
```

## Data Safety and Display Utilities

Built-in utility functions for safe data handling:

```javascript
wakaPAC('#app', {
    userInput: '<script>alert("hack")</script>',

    saveComment() {
        // Escape HTML to prevent XSS
        this.safeComment = this.escapeHTML(this.userInput);
        // Result: "&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;"
    },

    cleanUserBio() {
        // Strip all HTML tags and get plain text
        this.cleanBio = this.sanitizeUserInput(this.userInput);
        // Result: "alert(hack)"
    },

    displayData() {
        // Format any value for display
        console.log(this.formatValue(null));        // ""
        console.log(this.formatValue([1,2,3]));     // "[1,2,3]"
        console.log(this.formatValue({a: 1}));      // JSON formatted
    }
});
```

## Non-Reactive Properties

Use underscore prefix for properties that shouldn't trigger DOM updates:

```javascript
wakaPAC('#map-app', {
    // Reactive properties (trigger DOM updates)
    tracking: false,
    currentLocation: null,

    // Non-reactive properties (no DOM updates)
    _map: null,
    _markers: [],

    startTracking() {
        this.tracking = true; // Updates UI
        this._map = L.map('map'); // Safe for complex objects
    }
});
```

## Lifecycle Methods

WakaPAC provides two lifecycle hooks to control component initialization:

### `init()` - Early Initialization

Called immediately when the component is created, before DOM bindings are applied:

```javascript
wakaPAC('#app', {
    items: [],

    init() {
        // Set up initial state
        this.items = this.loadFromStorage();

        // Register external event listeners
        window.addEventListener('storage', this.handleStorageChange);

        // Initialize third-party libraries (that don't need DOM)
        this._analytics = new AnalyticsService();
    }
});
```

**Use `init()` for:**
- Setting up initial data state
- Registering global event listeners
- Initializing third-party services that don't require DOM access
- Setting up non-reactive properties

**Caution:** DOM bindings like `visible`, `if`, and `foreach` have not been applied yet. Avoid DOM manipulation in `init()`.

### `ready()` - Post-Initialization

Called after all DOM bindings have been applied and child components are initialized:

```javascript
wakaPAC('#app', {
    ready() {
        // DOM is fully bound and ready
        document.getElementById('logo').style.display = 'block';

        // Initialize libraries that need the DOM
        this._chart = new Chart(this.$el.querySelector('canvas'));

        // Trigger initial data fetch
        this.loadData();
    }
});
```

**Use `ready()` for:**
- Safe DOM manipulation after bindings are applied
- Initializing third-party libraries that require DOM elements
- Triggering initial API calls or data loading
- Setting up observers or DOM-dependent functionality

**Execution Order:**
1. Component constructor runs
2. `init()` is called
3. Reactive abstraction is created
4. Component hierarchy is established
5. DOM bindings are scanned and applied (`visible`, `foreach`, etc.)
6. `ready()` is called ← Safe for DOM manipulation
7. Component is fully operational

**Common Pattern - Showing Hidden Elements:**
```javascript
// HTML: Start with element hidden to prevent flash
<div id="app" style="display: none">
    <span data-pac-bind="visible: isLoggedIn">Welcome back!</span>
</div>

// JavaScript: Show after bindings are applied
wakaPAC('#app', {
    isLoggedIn: false,

    ready() {
        // Bindings are applied, no flash of wrong content
        document.getElementById('app').style.display = 'block';

        // Now safe to check auth status
        this.checkAuthStatus();
    }
});
```

## API Reference

### Internal Methods (Available as `this.methodName()` within component)

These methods are only accessible within component methods and provide core functionality for data binding, utilities, and component communication:

```javascript
// Data utilities  
this.formatValue(value)                 // Formats any value for display
this.escapeHTML(str)                    // Escapes HTML entities to prevent XSS
this.sanitizeUserInput(html)            // Strips HTML tags and returns plain text
this.getElementPosition(element)        // Returns the global position of an element within the document

// Mouse coordinate utilities (Win32-style)
this.LOWORD(lParam)                     // Extract x coordinate from lParam
this.HIWORD(lParam)                     // Extract y coordinate from lParam
this.MAKEPOINTS(lParam)                 // Extract {x, y} from lParam
this.containerToViewport(x, y)          // Convert container-relative to viewport-absolute
this.viewportToContainer(x, y)          // Convert viewport-absolute to container-relative

// Component communication
this.notifyParent(type, data, bubble)   // Send message to parent component (bubble defaults to false)
this.notifyChildren(command, data)      // Broadcast message to all child components
this.notifyChild(pacId, cmd, data)      // Send message to specific child by data-pac-id
```

### External Methods (Available on component instance)

These methods are available when you have a reference to the component instance:

```javascript
// Lifecycle management (external only)
component.destroy()   // Destroys component and cleans up resources
```

### Configuration Options

```javascript
wakaPAC('#app', data, {
    updateMode: 'immediate',  // 'immediate', 'delayed', 'change'
    delay: 300,              // Default delay for 'delayed' mode (ms)
});
```

## Migration Guide

### From Vue.js
```html
<!-- Vue -->
<div>{{ message }}</div>
<input v-model="name">
<button @click="handleClick">Click</button>
<div v-if="isVisible">Content</div>

<!-- WakaPAC -->
<div>{{ message }}</div>
<input data-pac-bind="value: name">
<button data-pac-bind="click: handleClick">Click</button>
<div data-pac-bind="if: isVisible">Content</div>
```

### From React
```javascript
// React
const [count, setCount] = useState(0);
const increment = () => setCount(count + 1);

// WakaPAC
wakaPAC('#app', {
    count: 0,
    increment() {
        this.count++; // Direct assignment
    }
});
```

### From Knockout.js
```javascript
// Knockout
const viewModel = {
    firstName: ko.observable('John'),
    fullName: ko.computed(() => this.firstName())
};

// WakaPAC
wakaPAC('#app', {
    firstName: 'John',
    computed: {
        fullName() {
            return this.firstName;
        }
    }
});
```

## License

MIT License# WakaPAC

A full-featured application library built on the PAC pattern — bringing KnockoutJS-style simplicity to modern web apps.

## Introduction

WakaPAC is a complete application foundation built around the Presentation–Abstraction–Control (PAC) pattern. It provides everything needed for reactive web applications in a single 50KB library - no build tools, no dependency management, no ecosystem complexity.

### What's PAC?

**PAC (Presentation-Abstraction-Control)** is a hierarchical architectural pattern that creates a clean separation between:

1. **Presentation**: Your HTML templates and DOM elements - what the user sees
2. **Abstraction**: Your data model and business logic - what your app knows
3. **Control**: The reactive layer that mediates between presentation and abstraction - how they stay in sync

Unlike MVC where models and views can talk directly, PAC uses the Control layer as a smart mediator that:
- **Automatically syncs** data changes to the DOM
- **Handles events** from the presentation layer
- **Manages reactivity** and computed properties
- **Coordinates communication** between components

This results in more predictable data flow and easier debugging than traditional MVC patterns.

### Why WakaPAC?

- **Declarative HTML bindings** with `{{ mustache }}` templates and `data-pac-bind` attributes
- **Two-way reactivity** for objects and nested arrays
- **Advanced expression system** supporting arrays, objects, and complex operations
- **Drop-in script file** - no bundler required
- **Win32-style** `msgProc` for low-level event handling when you want total control
- **Hierarchical components** with parent—child notification
- **WakaSync** - seamlessly works with the companion WakaSync HTTP library for advanced features like request grouping, cancellation, and retry logic

### Who WakaPAC is For

- You want KnockoutJS-style simplicity with modern JavaScript power
- You need a complete solution without the complexity of React/Vue ecosystems
- You're building applications that need comprehensive functionality in a single library

### Not for you if

- You need SSR
- You want JSX/TSX or TypeScript-first DX
- You're building a massive SPA that already fits better in React/Vue

## Installation

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional: Add WakaSync for HTTP functionality -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakasync.min.js"></script>

<!-- Or download files -->
<script src="wakapac.min.js"></script>
<script src="wakasync.min.js"></script>
```

## Quick Example

```html
<!DOCTYPE html>
<html>
<head>
    <script src="wakapac.min.js"></script>
</head>
<body>
<div id="my-app">
    <h1>Hello {{ name }}!</h1>
    <p>Count: {{ count }}</p>
    <button data-pac-bind="click: increment">Click me!</button>
</div>

<script>
    wakaPAC('#my-app', {
        name: 'World',
        count: 0,

        increment() {
            this.count++;
        }
    });
</script>
</body>
</html>
```

## Basic Features - Data Binding

### Text Interpolation

Text interpolation allows you to dynamically insert data into your HTML templates using mustache syntax ({{ }}). This enables you to create dynamic content that updates based on your application's state.

```html
<!-- Simple properties -->
<p>Hello, {{ name }}!</p>

<!-- Nested properties -->
<p>User: {{ user.name }} ({{ user.age }})</p>

<!-- Ternary expressions -->
<p>Status: {{ user.age >= 18 ? 'Adult' : 'Minor'}}</p>

<!-- Computed properties -->
<p>Total: {{ totalPrice }}</p>

<!-- Arithmetic Operations -->
<p>Total: ${{ price * quantity }}</p>

<!-- String Operations -->
<p>Full Name: {{ firstName + ' ' + lastName }}</p>
```

### Advanced Expression System

WakaPAC supports JavaScript-like expressions in templates and bindings, enabling complex data operations directly in your HTML:

#### Array Literals and Operations
```html
<!-- Array literals -->
<div data-pac-bind="visible: [1, 2, 3][selectedIndex]">

    <!-- Array indexing -->
    <span>{{ items[currentIndex].title }}</span>

    <!-- Array length -->
    <p>Total items: {{ items.length }}</p>
```

#### Object Literals
```html
<!-- Object creation -->
<div data-pac-bind="style: {color: textColor, fontSize: size + 'px'}">

    <!-- Conditional object properties -->
    <div data-pac-bind="class: {active: isSelected, disabled: !isEnabled}">
```

#### Complex Conditionals
```html
<!-- Multiple conditions -->
<div data-pac-bind="visible: user.role === 'admin' && user.active">

    <!-- Nested ternary -->
    <span>{{ status === 'loading' ? 'Please wait...' : status === 'error' ? 'Try again' : 'Ready' }}</span>

    <!-- Array operations -->
    <div data-pac-bind="if: allowedRoles.includes(user.role)">
```

### Complete Binding Reference

WakaPAC provides comprehensive data binding capabilities through the `data-pac-bind` attribute. Here's the complete list of supported binding types:

#### Form Input Bindings

**`value`** - Two-way binding for form inputs
```html
<input data-pac-bind="value: name" type="text">
<textarea data-pac-bind="value: description"></textarea>
<select data-pac-bind="value: selectedOption">
    <option value="A">Option A</option>
    <option value="B">Option B</option>
</select>
```

**`checked`** - Boolean state for checkboxes
```html
<input type="checkbox" data-pac-bind="checked: isActive">

<!-- For radio buttons, use value binding instead -->
<input type="radio" name="theme" value="light" data-pac-bind="value: selectedTheme">
<input type="radio" name="theme" value="dark" data-pac-bind="value: selectedTheme">
```

#### Display Control Bindings

**`visible`** - Show/hide with CSS display (element stays in DOM)
```html
<div data-pac-bind="visible: shouldShow">Content</div>
<div data-pac-bind="visible: !hideContent">Always shown unless hideContent is true</div>
```

**`if`** - Conditional rendering (clears/restores innerHTML, element stays in DOM)
```html
<div data-pac-bind="if: user.isAdmin">Admin Panel</div>
<div data-pac-bind="if: !isLoading">Content loaded</div>
```

**`<!-- wp-if: expression -->`** - Conditional rendering without wrapper elements
```html
<!-- wp-if: showMessage -->
<div>This content is conditionally rendered</div>
<!-- /wp-if -->

<!-- Perfect for tables (no wrapper needed) -->
<table>
  <tbody>
    <!-- wp-if: user.isLoggedIn -->
    <tr><td>User data row 1</td></tr>
    <tr><td>User data row 2</td></tr>
    <!-- /wp-if -->
  </tbody>
</table>

<!-- Multiple siblings controlled together -->
<!-- wp-if: user.isPremium -->
<div>Premium Feature 1</div>
<div>Premium Feature 2</div>
<div>Premium Feature 3</div>
<!-- /wp-if -->
```

**When to use each:**

| Use Case                         | Best Choice      | Why                                          |
|----------------------------------|------------------|----------------------------------------------|
| Fast toggling, CSS transitions   | `visible`        | Element stays rendered, just hidden with CSS |
| Complex nested structures        | `if`             | Removes content from memory when hidden      |
| Form inputs you want to preserve | `visible`        | Input values remain intact                   |
| Table rows, grid items           | `<!-- wp-if -->` | No wrapper element needed                    |
| Multiple siblings as group       | `<!-- wp-if -->` | Controls multiple elements together          |
| Text nodes without wrapper       | `<!-- wp-if -->` | Works directly with text                     |
| Single element with wrapper      | `if`             | Simpler when wrapper already exists          |

#### Attribute Bindings

**`enable`** - Enable/disable form controls
```html
<button data-pac-bind="enable: isFormValid">Submit</button>
<input data-pac-bind="enable: !isReadonly">
```

**Custom attributes** - Any HTML attribute can be bound directly
```html
<!-- Standard attributes -->
<input data-pac-bind="placeholder: hintText, title: tooltipText">
<img data-pac-bind="src: imageUrl, alt: altText">
<div data-pac-bind="id: dynamicId, role: userRole">

    <!-- Data attributes -->
    <div data-pac-bind="data-id: userId, data-category: itemCategory">

        <!-- ARIA attributes -->
        <button data-pac-bind="aria-label: accessibilityLabel, aria-expanded: isExpanded">

            <!-- Multiple custom attributes -->
            <div data-pac-bind="title: tooltipText, data-id: itemId, tabindex: tabOrder">
```

#### Style and Appearance Bindings

**`class`** - CSS class manipulation (supports object syntax)
```html
<!-- Simple class binding -->
<div data-pac-bind="class: statusClass">

    <!-- Object syntax: conditional classes -->
    <div data-pac-bind="class: { active: isActive, disabled: !enabled, error: hasError }">
```

**`style`** - CSS style manipulation (supports object syntax)
```html
<!-- Simple style binding -->
<div data-pac-bind="style: dynamicStyleString">

    <!-- Object syntax: multiple CSS properties -->
    <div data-pac-bind="style: { color: textColor, backgroundColor: bgColor }">

        <!-- CSS custom properties -->
        <div data-pac-bind="style: { '--theme-color': primaryColor, '--border-width': borderSize + 'px' }">
```

#### List Rendering Binding

**`foreach`** - Render lists with templates
```html
<div data-pac-bind="foreach: items" data-pac-item="item" data-pac-index="index">
    <div class="item">
        <span>{{ $index }}. {{ item.name }}</span>
        <button data-pac-bind="click: removeItem">Remove</button>
    </div>
</div>
```

#### Event Bindings

All standard DOM events are supported:

**`click`** - Mouse click events
```html
<button data-pac-bind="click: handleClick">Click me</button>
```

**`change`** - Form change events
```html
<select data-pac-bind="change: handleChange">
```

**`input`** - Form input events (as user types)
```html
<input data-pac-bind="input: handleInput">
```

**`submit`** - Form submission
```html
<form data-pac-bind="submit: handleSubmit">
```

**`focus`** / **`blur`** - Focus events
```html
<input data-pac-bind="focus: handleFocus, blur: handleBlur">
```

**`keyup`** / **`keydown`** - Keyboard events
```html
<input data-pac-bind="keyup: handleKey" data-pac-event="enter">
<input data-pac-bind="keydown: handleKeyDown" data-pac-event="escape">
```

#### Event Modifiers

Event modifiers allow you to control how events behave by using the `data-pac-event` attribute. They can prevent default browser actions, filter events to specific keys, or control event propagation. Multiple modifiers can be combined by separating them with spaces.

```html
<!-- Prevent form submission redirect -->
<form data-pac-bind="submit: handleSubmit" data-pac-event="prevent">

    <!-- Search on Enter key -->
    <input data-pac-bind="keyup: search" data-pac-event="enter">

    <!-- Close modal on Escape -->
    <div data-pac-bind="keyup: closeModal" data-pac-event="escape">

        <!-- Multiple modifiers -->
        <form data-pac-bind="submit: handleForm" data-pac-event="prevent stop">
```

**Available modifiers:**
- **Keys**: `enter`, `escape`/`esc`, `space`, `tab`, `delete`/`del`, `up`, `down`, `left`, `right`
- **Behavior**: `prevent`, `stop`

### Deep Reactivity

WakaPAC automatically tracks changes in nested objects and arrays:

```javascript
wakaPAC('#app', {
    user: {
        name: 'John',
        preferences: { theme: 'dark' }
    },
    todos: [],

    addTodo() {
        // Array mutations are automatically reactive
        this.todos.push({ text: 'New todo', completed: false });
    },

    toggleTodo(index) {
        // Deep nested changes are reactive
        this.todos[index].completed = !this.todos[index].completed;
    },

    updateTheme(newTheme) {
        // Deep nested property changes are reactive
        this.user.preferences.theme = newTheme;
    }
});
```

### Lists and For-Each

```html
<div data-pac-bind="foreach: todos" data-pac-item="todo" data-pac-index="index">
    <div class="todo-item">
        <span>{{ $index }}. {{ todo.text }}</span>
        <input type="checkbox" data-pac-bind="checked: todo.completed">
        <button data-pac-bind="click: removeTodo">Remove</button>
    </div>
</div>
```

```javascript
wakaPAC('#app', {
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: false},
        {id: 2, text: 'Build an app', completed: true}
    ],

    // Event handlers receive item, index, and event
    removeTodo(todo, index, event) {
        const todoIndex = this.todos.findIndex(t => t.id === todo.id);
        this.todos.splice(todoIndex, 1);
    },

    // Foreach callback receives array and metadata
    onItemsUpdated(items, meta) {
        console.log(`List updated with ${items.length} items`);
    }
});
```

### Update Modes

Control when form inputs update your data:

```html
<!-- Immediate (default) - updates on every keystroke -->
<input data-pac-bind="value: name">

<!-- Change - updates when input loses focus -->
<input data-pac-bind="value: name" data-pac-update-mode="change">

<!-- Delayed - updates after specified delay (debounced) -->
<input data-pac-bind="value: searchQuery"
       data-pac-update-mode="delayed"
       data-pac-update-delay="500">
```

**Use cases:**
- **Immediate**: Real-time validation, character counters
- **Change**: Server validation, auto-save functionality
- **Delayed**: Search autocomplete, API queries

## HTTP Client Usage (WakaSync)

WakaPAC works well with WakaSync for HTTP requests. Simply instantiate WakaSync in your components where needed.

### Basic Usage

```javascript
wakaPAC('#app', {
    user: null,
    loading: false,
    error: null,

    init() {
        // Create HTTP client instance
        this.http = new WakaSync({
            timeout: 10000,
            retries: 1
        });
    },

    async loadUser() {
        this.loading = true;
        this.error = null;

        try {
            this.user = await this.http.get('/api/user');
        } catch (error) {
            this.error = error.message;
        } finally {
            this.loading = false;
        }
    }
});
```

### HTTP Methods

```javascript
wakaPAC('#app', {
    init() {
        this.http = new WakaSync();
    },

    async saveData() {
        // GET request
        const users = await this.http.get('/api/users');

        // POST with data
        const newUser = await this.http.post('/api/users', {
            name: 'John Doe',
            email: 'john@example.com'
        });

        // PUT update
        await this.http.put(`/api/users/${newUser.id}`, {
            name: 'Jane Doe'
        });

        // DELETE
        await this.http.delete(`/api/users/${newUser.id}`);

        // PATCH partial update
        await this.http.patch(`/api/users/${newUser.id}`, {
            lastLogin: new Date().toISOString()
        });
    }
});
```

### Advanced HTTP Features

#### Request with Options
```javascript
const userData = await this.http.request('/api/user', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${this.token}`
    },
    timeout: 5000,
    onSuccess: (data) => {
        console.log('User loaded:', data);
    },
    onError: (error) => {
        console.error('Load failed:', error);
    }
});
```

#### File Upload
```javascript
// FormData upload
const formData = new FormData();
formData.append('file', file);
await this.http.post('/api/upload', formData);
```

#### Request Cancellation
```javascript
wakaPAC('#app', {
    init() {
        this.http = new WakaSync();
    },

    cancelAllRequests() {
        this.http.cancelAll();
    },

    cancelSearches() {
        this.http.cancelGroup('search');
    }
});
```

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Network Status:**
- **`browserOnline`**: `true` when the browser is online, `false` when offline
- **`browserNetworkQuality`**: Network performance insights: `'fast'`, `'slow'` or `'offline'`

**Page Visibility:**
- **`browserVisible`**: `true` when the browser tab is active/visible, `false` when hidden

**Scroll Position:**
- **`browserScrollX`**: Horizontal scroll position in pixels (can be set programmatically)
- **`browserScrollY`**: Vertical scroll position in pixels (can be set programmatically)

**Page Dimensions:**
- **`browserViewportWidth`**: Browser viewport width in pixels
- **`browserViewportHeight`**: Browser viewport height in pixels
- **`browserDocumentWidth`**: Total document width in pixels
- **`browserDocumentHeight`**: Total document height in pixels

**Container Viewport Visibility:**
- **`containerVisible`**: `true` when any part of the container is visible in viewport
- **`containerFullyVisible`**: `true` when container is completely visible in viewport
- **`containerClientRect`**: Position and dimensions object relative to viewport (DOMRect)
- **`containerWidth`**: Container width in pixels
- **`containerHeight`**: Container height in pixels

**Container Scroll Properties:**
- **`containerIsScrollable`**: `true` if container can scroll in any direction
- **`containerScrollX`**: Current horizontal scroll position in pixels (can be set programmatically)
- **`containerScrollY`**: Current vertical scroll position in pixels (can be set programmatically)
- **`containerScrollContentWidth`**: Total scrollable content width (scrollWidth)
- **`containerScrollContentHeight`**: Total scrollable content height (scrollHeight)
- **`containerScrollWindow`**: Object containing scroll measurements (DOMRect)

**Container Focus State:**
- **`containerFocus`**: `true` when container has direct focus (`:focus`)
- **`containerFocusWithin`**: `true` when container or child has focus (`:focus-within`)

**Component Hierarchy Properties:**
- **`childrenCount`**: Number of direct child PAC components (read-only, reactive)
- **`hasParent`**: `true` if this component has a parent PAC component, `false` if it's a root component

### Usage Examples

```html
<!-- Browser properties in templates -->
<p>Viewport: {{ browserViewportWidth }} x {{ browserViewportHeight }}</p>
<p data-pac-bind="visible: !browserVisible">Tab is hidden - updates paused</p>
<p>Container is {{ containerVisible ? 'visible' : 'hidden' }} in viewport</p>
```

```javascript
wakaPAC('#app', {
    init() {
        // Set initial document title based on visibility
        document.title = this.browserVisible ? 'App Active' : 'App Paused';
    },

    watch: {
        browserVisible(isVisible) {
            document.title = isVisible ? 'App Active' : 'App Paused';
        },

        containerVisible(isVisible) {
            if (isVisible) {
                this.startAnimation();
            } else {
                this.pauseAnimation();
            }
        }
    }
});
```

## Advanced Features

### Computed Properties

Computed properties automatically recalculate when their dependencies change:

```javascript
wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    items: [{price: 10}, {price: 20}],

    computed: {
        // Simple computed property
        fullName() {
            return `${this.firstName} ${this.lastName}`;
        },

        // Array-dependent computed property
        totalPrice() {
            return this.items.reduce((sum, item) => sum + item.price, 0);
        },

        // Complex computed property with conditional logic
        shippingCost() {
            return this.totalPrice > 50 ? 0 : 9.99;
        }
    }
});
```

### Watchers

Watchers execute code when reactive properties change:

```javascript
wakaPAC('#app', {
    searchQuery: '',

    watch: {
        // Called when searchQuery changes 
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2) {
                this.performSearch(newValue);
            }
        }
    }
});
```

### Component Lifecycle

```javascript
wakaPAC('#app', {
    message: 'Hello',
    user: null,

    init() {
        // Runs after component initialization
        console.log('Component is ready!');
        document.title = `App - ${this.message}`;
        this.loadUserData();
    },

    async loadUserData() {
        this.user = await fetch('/api/user').then(r => r.json());
    }
});
```

### MsgProc - Win32-Style Message Processing

WakaPAC provides a powerful low-level event processing system inspired by Win32 window procedures. The `msgProc` method gives you complete control over event handling before standard bindings execute.

#### Message Flow

```
DOM Event Occurs
    ↓
msgProc processes message (if defined)
    ↓
    Returns false? → Event handled, stop processing (preventDefault called)
    Returns true (or undefined)? → Continue to standard bindings
    ↓
Standard data-pac-bind handlers execute (if msgProc returned true/undefined)
```

#### Basic Usage

```javascript
wakaPAC('#app', {
    msgProc(event) {
        // Handle specific message types
        switch(event.message) {
            case MSG_TYPES.MSG_KEYDOWN:
                // Handle keyboard input
                break;

            case MSG_TYPES.MSG_LCLICK:
                // Handle mouse clicks
                break;
        }

        // Return false to prevent standard bindings from executing
        // Return true (or undefined) to allow standard bindings to process
        return true;
    }
});
```

#### Event Object Structure

The `msgProc` method receives a CustomEvent with Win32-style message properties as top-level properties:

```javascript
{
    type: 'pac:event',             // Always 'pac:event' for msgProc
        message: 0x0201,               // Message type from MSG_TYPES constants
        wParam: 0x0001,                // Primary parameter (varies by message type)
        lParam: 0x00640032,            // Secondary parameter (varies by message type)
        target: HTMLElement,           // The DOM element that triggered the event
        originalEvent: Event,          // Original browser DOM event object
        timestamp: 1640995200000,      // Timestamp when event was dispatched
        id: 'element-id',              // Element ID if available, null otherwise
        detail: {}                     // Extended data specific to certain event types (optional)
}
```

**Key Properties:**

All Win32-style properties are directly on the event object (not nested in `event.detail`):

- **`message`**: Message type constant indicating what kind of event occurred
- **`wParam`**: Primary parameter containing flags, button states, or primary data
- **`lParam`**: Secondary parameter containing coordinates, form data, or other contextual info
- **`target`**: The actual DOM element where the event originated
- **`originalEvent`**: Access to all native browser event properties and methods
- **`timestamp`**: Milliseconds since epoch when the event was created
- **`id`**: Convenience access to target.id (or null if not set)
- **`detail`**: Optional extended metadata (only present for certain event types like MSG_CHAR, MSG_CHANGE)

**Note:** Prior versions of WakaPAC nested these properties in `event.detail`. The current version places them directly on the event for cleaner access. The `detail` property is now reserved only for optional extended data.

#### Message Types Reference

**Mouse Movement:**
```javascript
MSG_TYPES.MSG_MOUSEMOVE    // 0x0200 - Mouse position changed
// Throttled to 60 FPS by default (configurable via wakaPAC.mouseMoveThrottleFps)
// Coordinates in lParam are container-relative (client-area relative)
```

**Mouse Button Events (Raw Button Tracking):**
```javascript
MSG_TYPES.MSG_LBUTTONDOWN  // 0x0201 - Left button pressed
MSG_TYPES.MSG_LBUTTONUP    // 0x0202 - Left button released
MSG_TYPES.MSG_LBUTTONDBLCLK// 0x0203 - Left button double-click
MSG_TYPES.MSG_RBUTTONDOWN  // 0x0204 - Right button pressed
MSG_TYPES.MSG_RBUTTONUP    // 0x0205 - Right button released
MSG_TYPES.MSG_MBUTTONDOWN  // 0x0207 - Middle button pressed
MSG_TYPES.MSG_MBUTTONUP    // 0x0208 - Middle button released
```

**Click Events (Semantic User Actions):**
```javascript
MSG_TYPES.MSG_LCLICK       // 0x0210 - Left click (triggers click: bindings)
MSG_TYPES.MSG_MCLICK       // 0x0211 - Middle click
MSG_TYPES.MSG_RCLICK       // 0x0212 - Right click (contextmenu)
```

**Keyboard Events:**
```javascript
MSG_TYPES.MSG_KEYDOWN      // 0x0100 - Key pressed down
MSG_TYPES.MSG_KEYUP        // 0x0101 - Key released
```

**Form Events:**
```javascript
MSG_TYPES.MSG_CHAR         // 0x0300 - Text input (typing in fields)
MSG_TYPES.MSG_CHANGE       // 0x0301 - Form control changed (triggers change: bindings)
MSG_TYPES.MSG_SUBMIT       // 0x0302 - Form submitted (triggers submit: bindings)
```

**Focus Events:**
```javascript
MSG_TYPES.MSG_FOCUS        // 0x0007 - Element gained focus
MSG_TYPES.MSG_BLUR         // 0x0008 - Element lost focus
```

#### wParam and lParam by Message Type

##### Mouse Events (LBUTTONDOWN, RBUTTONDOWN, MBUTTONDOWN, LBUTTONUP, RBUTTONUP, MBUTTONUP, LCLICK, MCLICK, RCLICK)

**wParam** - Modifier key and button state flags (bitwise OR of flags):
```javascript
// Extract modifier keys and button states
if (wParam & MK_CONTROL) { /* Ctrl key held */ }     // 0x0010
if (wParam & MK_SHIFT)   { /* Shift key held */ }    // 0x0008
if (wParam & MK_ALT)     { /* Alt key held */ }      // 0x0020
if (wParam & MK_LBUTTON) { /* Left button held */ }  // 0x0001
if (wParam & MK_RBUTTON) { /* Right button held */ } // 0x0002
if (wParam & MK_MBUTTON) { /* Middle button held */ }// 0x0004
```

**lParam** - Mouse coordinates packed into 32 bits:
```javascript
// Extract x and y coordinates from lParam
const x = lParam & 0xFFFF;           // Low 16 bits = x coordinate
const y = (lParam >> 16) & 0xFFFF;   // High 16 bits = y coordinate

// These are viewport-relative coordinates (clientX, clientY)
```

**Example:**
```javascript
case MSG_TYPES.MSG_LBUTTONDOWN:
const x = lParam & 0xFFFF;
const y = (lParam >> 16) & 0xFFFF;

if (wParam & MK_CONTROL) {
    console.log(`Ctrl+Click at (${x}, ${y})`);
}
break;
```

##### Keyboard Events (KEYDOWN, KEYUP)

**wParam** - Virtual key code:
```javascript
// The keyCode from the original event
const keyCode = wParam;  // e.g., 13 for Enter, 27 for Escape
```

**lParam** - Keyboard state flags (32-bit value):
```javascript
// Bits 0-15: Repeat count
const repeatCount = lParam & 0xFFFF;

// Bit 24: Extended key flag (arrow keys, function keys, etc.)
const isExtended = (lParam & (1 << 24)) !== 0;

// Bit 31: Key release flag (0 = keydown, 1 = keyup)
const isRelease = (lParam & (1 << 31)) !== 0;
```

**Extended Keys:**
- Arrow keys (Up, Down, Left, Right)
- Function keys (F1-F12)
- Navigation keys (Home, End, PageUp, PageDown, Insert, Delete)
- Numpad Enter and Divide
- Windows/Meta keys
- Context Menu key

**Example:**
```javascript
case MSG_TYPES.MSG_KEYDOWN:
const keyCode = wParam;
const isExtended = (lParam & (1 << 24)) !== 0;

if (keyCode === 13) {  // Enter key
    console.log('Enter pressed');
}

if (isExtended) {
    console.log('Extended key (arrow, function key, etc.)');
}
break;
```

##### Text Input Events (CHAR)

**wParam** - Text length:
```javascript
const textLength = wParam;  // Length of text in the input field
```

**lParam** - Not used (always 0)

**Extended data:**
```javascript
event.detail = {
    elementType: 'input' | 'textarea'  // Type of input element
};
```

**Example:**
```javascript
case MSG_TYPES.MSG_CHAR:
console.log(`Text field has ${event.wParam} characters`);
console.log(`Value: ${event.target.value}`);
break;
```

##### Form Change Events (CHANGE)

**wParam** - Element-specific value:
```javascript
// For checkboxes: 1 = checked, 0 = unchecked
// For radio buttons: index in radio group
// For select elements: selectedIndex
```

**lParam** - Not used (always 0)

**Extended data:**
```javascript
event.detail = {
    elementType: 'select' | 'radio' | 'checkbox'
};
```

**Example:**
```javascript
case MSG_TYPES.MSG_CHANGE:
    const target = event.target;
    
    if (target.type === 'checkbox') {
        const isChecked = wParam === 1;
        console.log(`Checkbox is now ${isChecked ? 'checked' : 'unchecked'}`);
    }
    
    if (target.tagName === 'SELECT') {
        console.log(`Selected index: ${wParam}`);
    }
    
    break;
```

##### Form Submit Events (SUBMIT)

**wParam** - Form ID:
```javascript
const formId = wParam;  // The id attribute of the form, or null
```

**lParam** - Form data object:
```javascript
// Object containing all form fields
const formData = lParam;  // e.g., { name: 'John', email: 'john@example.com' }
```

**Example:**
```javascript
case MSG_TYPES.MSG_SUBMIT:
console.log('Form submitted:', lParam);
console.log('Form ID:', wParam);

// Validate form data
if (!lParam.email || !lParam.email.includes('@')) {
    originalEvent.preventDefault();
    return true;  // Stop processing
}
break;
```

##### Focus Events (FOCUS, BLUR)

**wParam** - Not used (always 0)

**lParam** - Not used (always 0)

**Example:**
```javascript
case MSG_TYPES.MSG_FOCUS:
console.log('Element gained focus:', event.target);
break;

case MSG_TYPES.MSG_BLUR:
console.log('Element lost focus:', event.target);
break;
```

#### Modifier Key Constants

Use these constants to check button and key states in wParam:

```javascript
const MK_LBUTTON = 0x0001;  // Left mouse button
const MK_RBUTTON = 0x0002;  // Right mouse button
const MK_MBUTTON = 0x0004;  // Middle mouse button
const MK_SHIFT   = 0x0008;  // Shift key
const MK_CONTROL = 0x0010;  // Control key
const MK_ALT     = 0x0020;  // Alt key
```

#### Cancellable Message Types

Only these message types can be cancelled by returning `false` from msgProc:

- `MSG_LBUTTONUP`, `MSG_MBUTTONUP`, `MSG_RBUTTONUP` (button release)
- `MSG_LCLICK`, `MSG_MCLICK`, `MSG_RCLICK` (click events)
- `MSG_SUBMIT` (form submission)
- `MSG_CHANGE` (form control changes)

Returning `false` prevents:
1. The original DOM event's default behavior (preventDefault is called)
2. Execution of standard `data-pac-bind` handlers

For all other message types, the return value is ignored and standard processing continues.

#### Complete Examples

##### Example 1: Global Keyboard Shortcuts

```javascript
wakaPAC('#app', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_KEYDOWN) {
            // Check for Ctrl key combinations
            if (event.wParam & MK_CONTROL) {
                switch (event.originalEvent.key) {
                    case 's':
                        this.saveDocument();
                        event.preventDefault();
                        return false;  // Stop processing

                    case 'o':
                        this.openDocument();
                        event.preventDefault();
                        return false;

                    case 'f':
                        this.showFindDialog();
                        event.preventDefault();
                        return false;
                }
            }

            // Escape key closes modals
            if (event.originalEvent.key === 'Escape') {
                this.closeAllModals();
                return true;
            }
        }

        return false;  // Allow other handlers to process
    }
});
```

##### Example 2: Keyboard State Tracking

```javascript
wakaPAC('#text-editor', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_KEYDOWN) {
            const repeatCount = event.lParam & 0xFFFF;
            const isExtended = (event.lParam & (1 << 24)) !== 0;

            // Track key repeats for auto-scroll
            if (repeatCount > 1 && isExtended) {
                // This is a repeated arrow key press
                this.accelerateScroll();
            }

            // Special handling for function keys
            if (isExtended && event.originalEvent.key.startsWith('F')) {
                this.handleFunctionKey(event.originalEvent.key);
                return true;
            }

        return true;
    }
});
```

##### Example 3: Mouse Tracking

```javascript
wakaPAC('#app', {
    msgProc(event) {
        if (event.message === MSG_TYPES.MSG_MOUSEMOVE) {
            // Extract container-relative coordinates
            const pos = this.MAKEPOINTS(event.lParam);  // {x, y}
            
            // Check if left button is held while moving (dragging)
            if (event.wParam & MK_LBUTTON) {
                this.handleDrag(pos);
            }
        }
        
        // Handle double-click
        if (event.message === MSG_TYPES.MSG_LBUTTONDBLCLK) {
            const pos = this.MAKEPOINTS(event.lParam);
            this.openItem(pos);
            return false;
        }
        
        return true;
    }
});
```

**Mouse Coordinate Functions:**
- `this.LOWORD(lParam)` - Extract x coordinate (low 16 bits)
- `this.HIWORD(lParam)` - Extract y coordinate (high 16 bits)
- `this.MAKEPOINTS(lParam)` - Extract both as `{x, y}` object
- `this.containerToViewport(x, y)` - Convert container coords to viewport coords
- `this.viewportToContainer(x, y)` - Convert viewport coords to container coords

**Mouse Movement Throttling:**
```javascript
// Set before creating components (default: 60 FPS)
wakaPAC.mouseMoveThrottleFps = 120;  // High precision (gaming, drawing)
wakaPAC.mouseMoveThrottleFps = 30;   // Battery saving
wakaPAC.mouseMoveThrottleFps = 0;    // No throttling (every event)
```

**Note:** All mouse coordinates in `lParam` are relative to the container's top-left corner (Win32 client-area style), making it easy to position elements or draw on canvas within the container.
}

        return false;
    }
});
```

#### When to Use MsgProc vs Standard Bindings

**Use msgProc for:**
- Global keyboard shortcuts (Ctrl+S, Ctrl+C, etc.)
- Low-level mouse tracking (drag operations, drawing)
- Complex event coordination across multiple elements
- Event interception and validation before standard processing
- Performance-critical event handling
- Custom context menus and right-click behavior

**Use standard `data-pac-bind` for:**
- Simple button clicks
- Form input handling
- Most user interactions
- Declarative, readable event handling
- When you don't need to prevent default behavior

#### Performance Considerations

1. **msgProc runs for every event** - keep logic fast and focused
2. **Return early** - use `return true` as soon as you know processing is complete
3. **Avoid heavy computations** - defer expensive operations to separate methods
4. **Cache calculations** - don't recalculate coordinates repeatedly

#### Common Patterns

**Pattern 1: Modifier Key Combos**
```javascript
if (message === MSG_TYPES.MSG_LCLICK) {
    if ((wParam & MK_CONTROL) && (wParam & MK_SHIFT)) {
        // Ctrl+Shift+Click
    } else if (wParam & MK_CONTROL) {
        // Ctrl+Click
    } else if (wParam & MK_SHIFT) {
        // Shift+Click
    }
}
```

**Pattern 2: Coordinate Extraction Helper**
```javascript
function getCoords(lParam) {
    return {
        x: lParam & 0xFFFF,
        y: (lParam >> 16) & 0xFFFF
    };
}

// Usage
const { x, y } = getCoords(lParam);
```

**Pattern 3: Event Filtering**
```javascript
// Only process events from specific elements
if (!target.matches('.draggable')) {
    return false;  // Let other handlers deal with it
}

// Your handling logic here
```

### Component Hierarchy

#### Component Identification

Each wakaPAC component is identified by a `data-pac-id` attribute. If your element has an `id` attribute, wakaPAC automatically uses it as the `data-pac-id` - otherwise it generates a unique identifier:

```html
<!-- Element with id - automatically uses "sidebar" as data-pac-id -->
<div id="sidebar"></div>

<!-- Element without id - generates "pac-abc123..." as data-pac-id -->
<div class="widget"></div>

<script>
    wakaPAC('#sidebar', { /* ... */ });  // data-pac-id="sidebar"
    wakaPAC('.widget', { /* ... */ });   // data-pac-id="pac-abc123..."
</script>
```

This makes debugging easier with meaningful identifiers and simplifies parent-child communication:

```html
<div id="parent">
    <div id="child-1"></div>
    <div id="child-2"></div>
</div>

<script>
    wakaPAC('#parent', {
        updateChild() {
            // Target specific child using its id (used as data-pac-id)
            this.notifyChild('child-1', 'update', { value: 42 });
        }
    });
</script>
```

#### Parent-Child Communication

Parent-child communication system:

```javascript
// Child to Parent (Notifications)
const child = wakaPAC('#child-app', {
    sendAlert() {
        this.notifyParent('alert', {
            message: 'Something important happened'
        });
    }
});

// Parent receives notifications
const parent = wakaPAC('#parent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'alert') {
            console.log('Alert:', data.message);
        }
    }
});

// Parent to Child (Commands)
const parent = wakaPAC('#parent-app', {
    broadcastMessage() {
        // Notify all children
        this.notifyChildren('update', {theme: 'dark'});

        // Notify specific child by its data-pac-id
        this.notifyChild('child-app', 'focus');
    }
});

// Child receives commands
const child = wakaPAC('#child-app', {
    receiveFromParent(command, data) {
        if (command === 'update') {
            this.applyTheme(data.theme);
        }
    }
});
```

#### Event Bubbling

By default, `notifyParent` only sends the event to the immediate parent. You can enable automatic bubbling up the entire component hierarchy by setting the third parameter to `true`:

```javascript
// Grandchild component
const grandchild = wakaPAC('#grandchild-app', {
    triggerValidation() {
        // Bubble event up through parent to grandparent
        this.notifyParent('validation-failed', {
            field: 'email',
            error: 'Invalid format'
        }, true);  // Enable bubbling
    }
});

// Parent component - event passes through
const parent = wakaPAC('#parent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'validation-failed') {
            console.log('Child validation failed:', data.field);
            // Return value controls bubbling:
            // - Don't return anything: event continues bubbling up
            // - Return true: event continues bubbling up
            // - Return false: stop bubbling here
            return false; // Stop propagation
        }
    }
});

// Grandparent component - receives event if not stopped
const grandparent = wakaPAC('#grandparent-app', {
    receiveFromChild(eventType, data, childPAC) {
        if (eventType === 'validation-failed') {
            this.showGlobalError(data);
        }
    }
});
```

**When to use bubbling:**
- Global error handling at root level
- Application-wide events (logout, theme change)
- Events that multiple ancestor levels need to observe

**When to use direct parent notification (default):**
- Direct parent-child communication
- Events specific to immediate parent
- Better performance (fewer handler calls)


## Inter-Container Communication

WakaPAC provides Win32-style messaging for communication between containers that aren't in a parent-child hierarchy.

### Message Broadcasting

Broadcast a message to all containers using `postMessage`:

```javascript
// Define message constants (recommended)
const WM_USER_LOGIN = 0x0001;

// Simple broadcast with no parameters
wakaPAC.postMessage(WM_USER_LOGIN, 0, 0);

// wParam and lParam as integers
wakaPAC.postMessage(WM_USER_LOGIN, 123, 0);  // wParam = userId

// Complex data goes in extraData parameter
wakaPAC.postMessage(WM_USER_LOGIN, 123, 0, { 
    name: 'Floris', 
    role: 'admin' 
});
```

### Targeted Messaging

Send a message to a specific container using its `data-pac-id`:

```javascript
// Send to specific container (wParam/lParam as integers)
wakaPAC.sendMessage('user-panel', WM_USER_LOGIN, 123, 0);

// With complex data in extraData
wakaPAC.sendMessage('user-panel', WM_USER_LOGIN, 123, 0, { 
    name: 'Floris',
    role: 'admin'
});
```

### Handling Messages

Containers receive messages through their `msgProc` function:

```javascript
const WM_USER_LOGIN = 0x0001;

wakaPAC('#user-panel', {
    userName: '',
    
    msgProc(event) {
        if (event.message === WM_USER_LOGIN) {
            console.log('Message:', event.message);
            console.log('wParam:', event.wParam);      // integer
            console.log('lParam:', event.lParam);      // integer
            console.log('Extra data:', event.detail);  // object with complex data
            
            // Update container state using extraData
            this.userName = event.detail.name;
        }
    }
});

// Trigger from anywhere
wakaPAC.postMessage(WM_USER_LOGIN, 123, 0, { name: 'Floris' });
```

### Message Parameters

Following Win32 conventions:

- **messageId** (required): Integer constant identifying the message type (e.g., `0x0001`, `WM_USER + 1`)
- **wParam**: First message parameter - must be an **integer** (use for IDs, flags, counts, etc.)
- **lParam**: Second message parameter - must be an **integer** (use for secondary numeric data)
- **extraData**: Optional object stored in `event.detail` for complex data (objects, arrays, strings, etc.)

**Important:** Unlike Win32 where wParam/lParam can hold pointers, in WakaPAC they are strictly integers. Use `extraData` for any complex data structures.

### Message Constants

Define message constants like Win32:

```javascript
// User-defined messages start at WM_USER (0x0400)
const WM_USER = 0x0400;
const WM_CUSTOM_ACTION = WM_USER + 1;
const WM_DATA_LOADED = WM_USER + 2;
const WM_STATE_CHANGED = WM_USER + 3;

// Or use simple incrementing integers
const MSG_LOGIN = 0x0001;
const MSG_LOGOUT = 0x0002;
const MSG_REFRESH = 0x0003;
```

### Broadcast vs Targeted Messages

**Use `postMessage` when:**
- Multiple containers need to respond to the same event
- You don't know which containers exist or care
- Broadcasting application-wide state changes

**Use `sendMessage` when:**
- You need to communicate with a specific container
- You want to avoid unnecessary processing in other containers
- Implementing direct container-to-container communication

### Example: Login Flow

```javascript
const WM_USER_LOGIN = 0x0001;
const WM_USER_LOGOUT = 0x0002;

// Header container
wakaPAC('#header', {
    userId: 0,
    userName: '',
    showLogoutButton: false,

    msgProc(event) {
        if (event.message === WM_USER_LOGIN) {
            // userId in wParam, user data in extraData
            this.userId = event.wParam;
            this.userName = event.detail.name;
            this.showLogoutButton = true;
        }
    }
});

// Sidebar container
wakaPAC('#sidebar', {
    userId: 0,
    userRole: '',

    msgProc(event) {
        if (event.message === WM_USER_LOGIN) {
            this.userId = event.wParam;
            this.userRole = event.detail.role;
            this.loadUserMenu();
        }
    },

    loadUserMenu() {
        // Load menu based on role
    }
});

// Login form triggers broadcast
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = 123;
    const userData = { name: 'Floris', role: 'admin' };

    // All containers receive this
    // wParam = userId (integer), extraData = user details (object)
    wakaPAC.postMessage(WM_USER_LOGIN, userId, 0, userData);
});
```

### Data Safety and Display Utilities

Built-in utility functions for safe data handling:

```javascript
wakaPAC('#app', {
    userInput: '<script>alert("hack")</script>',

    saveComment() {
        // Escape HTML to prevent XSS
        this.safeComment = this.escapeHTML(this.userInput);
        // Result: "&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;"
    },

    cleanUserBio() {
        // Strip all HTML tags and get plain text
        this.cleanBio = this.sanitizeUserInput(this.userInput);
        // Result: "alert(hack)"
    },

    displayData() {
        // Format any value for display
        console.log(this.formatValue(null));        // ""
        console.log(this.formatValue([1,2,3]));     // "[1,2,3]"
        console.log(this.formatValue({a: 1}));      // JSON formatted
    }
});
```

### Non-Reactive Properties

Use underscore prefix for properties that shouldn't trigger DOM updates:

```javascript
wakaPAC('#map-app', {
    // Reactive properties (trigger DOM updates)
    tracking: false,
    currentLocation: null,

    // Non-reactive properties (no DOM updates)
    _map: null,
    _markers: [],

    startTracking() {
        this.tracking = true; // Updates UI
        this._map = L.map('map'); // Safe for complex objects
    }
});
```

### Lifecycle Methods

WakaPAC provides two lifecycle hooks to control component initialization:

#### `init()` - Early Initialization

Called immediately when the component is created, before DOM bindings are applied:

```javascript
wakaPAC('#app', {
    items: [],

    init() {
        // Set up initial state
        this.items = this.loadFromStorage();

        // Register external event listeners
        window.addEventListener('storage', this.handleStorageChange);

        // Initialize third-party libraries (that don't need DOM)
        this._analytics = new AnalyticsService();
    }
});
```

**Use `init()` for:**
- Setting up initial data state
- Registering global event listeners
- Initializing third-party services that don't require DOM access
- Setting up non-reactive properties

**Caution:** DOM bindings like `visible`, `if`, and `foreach` have not been applied yet. Avoid DOM manipulation in `init()`.

#### `ready()` - Post-Initialization

Called after all DOM bindings have been applied and child components are initialized:

```javascript
wakaPAC('#app', {
    ready() {
        // DOM is fully bound and ready
        document.getElementById('logo').style.display = 'block';

        // Initialize libraries that need the DOM
        this._chart = new Chart(this.$el.querySelector('canvas'));

        // Trigger initial data fetch
        this.loadData();
    }
});
```

**Use `ready()` for:**
- Safe DOM manipulation after bindings are applied
- Initializing third-party libraries that require DOM elements
- Triggering initial API calls or data loading
- Setting up observers or DOM-dependent functionality

**Execution Order:**
1. Component constructor runs
2. `init()` is called
3. Reactive abstraction is created
4. Component hierarchy is established
5. DOM bindings are scanned and applied (`visible`, `foreach`, etc.)
6. `ready()` is called ← Safe for DOM manipulation
7. Component is fully operational

**Common Pattern - Showing Hidden Elements:**
```javascript
// HTML: Start with element hidden to prevent flash
<div id="app" style="display: none">
    <span data-pac-bind="visible: isLoggedIn">Welcome back!</span>
</div>

// JavaScript: Show after bindings are applied
wakaPAC('#app', {
    isLoggedIn: false,

    ready() {
        // Bindings are applied, no flash of wrong content
        document.getElementById('app').style.display = 'block';

        // Now safe to check auth status
        this.checkAuthStatus();
    }
});
```

## API Reference

### Internal Methods (Available as `this.methodName()` within component)

These methods are only accessible within component methods and provide core functionality for data binding, utilities, and component communication:

```javascript
// Data utilities  
this.formatValue(value)                 // Formats any value for display
this.escapeHTML(str)                    // Escapes HTML entities to prevent XSS
this.sanitizeUserInput(html)            // Strips HTML tags and returns plain text
this.getElementPosition(element)        // Returns the global position of an element within the document

// Mouse coordinate utilities (Win32-style)
this.LOWORD(lParam)                     // Extract x coordinate from lParam
this.HIWORD(lParam)                     // Extract y coordinate from lParam
this.MAKEPOINTS(lParam)                 // Extract {x, y} from lParam
this.containerToViewport(x, y)          // Convert container-relative to viewport-absolute
this.viewportToContainer(x, y)          // Convert viewport-absolute to container-relative

// Component communication
this.notifyParent(type, data, bubble)   // Send message to parent component (bubble defaults to false)
this.notifyChildren(command, data)      // Broadcast message to all child components
this.notifyChild(pacId, cmd, data)      // Send message to specific child by data-pac-id
```

### External Methods (Available on component instance)

These methods are available when you have a reference to the component instance:

```javascript
// Lifecycle management (external only)
component.destroy()   // Destroys component and cleans up resources
```

### Configuration Options

```javascript
wakaPAC('#app', data, {
    updateMode: 'immediate',  // 'immediate', 'delayed', 'change'
    delay: 300,              // Default delay for 'delayed' mode (ms)
});
```

## Migration Guide

### From Vue.js
```html
<!-- Vue -->
<div>{{ message }}</div>
<input v-model="name">
<button @click="handleClick">Click</button>
<div v-if="isVisible">Content</div>

<!-- WakaPAC -->
<div>{{ message }}</div>
<input data-pac-bind="value: name">
<button data-pac-bind="click: handleClick">Click</button>
<div data-pac-bind="if: isVisible">Content</div>
```

### From React
```javascript
// React
const [count, setCount] = useState(0);
const increment = () => setCount(count + 1);

// WakaPAC
wakaPAC('#app', {
    count: 0,
    increment() {
        this.count++; // Direct assignment
    }
});
```

### From Knockout.js
```javascript
// Knockout
const viewModel = {
    firstName: ko.observable('John'),
    fullName: ko.computed(() => this.firstName())
};

// WakaPAC
wakaPAC('#app', {
    firstName: 'John',
    computed: {
        fullName() {
            return this.firstName;
        }
    }
});
```

## License

MIT License