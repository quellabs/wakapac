# WakaPAC

A modern reactivity library using the PAC pattern — a spiritual successor to KnockoutJS, powered by Proxies.

## Introduction

WakaPAC is a lightweight reactive framework built around the Presentation–Abstraction–Control (PAC) pattern. It combines the declarative simplicity of KnockoutJS with the modern power of JavaScript Proxies — no hacks, no virtual DOM, no build step.

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

- **Declarative HTML bindings** with `{{mustache}}` templates and `data-pac-bind` attributes
- **Two-way reactivity** for objects and nested arrays
- **Win32-style** `eventProc` for low-level event handling when you want total control
- **Drop-in script file** — no bundler required
- **Hierarchical components** with parent–child notification

### Who It's For

- You loved KnockoutJS, but wish it had modern reactivity
- You want a small, drop-in framework without React/Vue's complexity
- You come from Win32/desktop dev and want familiar PAC patterns
- You're building internal tools, dashboards, or small-to-medium apps without needing a bundler

Not for you if:
- You need SSR or a giant ecosystem
- You want JSX/TSX or TypeScript-first DX
- You're building a massive SPA that already fits better in React/Vue

## Installation

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Or download -->
<script src="wakapac.min.js"></script>
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
    <h1>Hello {{name}}!</h1>
    <p>Count: {{count}}</p>
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
<p>Hello, {{name}}!</p>

<!-- Nested properties -->
<p>User: {{user.name}} ({{user.age}})</p>

<!-- Ternary expressions -->
<p>Status: {{user.age >= 18 ? 'Adult' : 'Minor'}}</p>

<!-- Computed properties -->
<p>Total: {{totalPrice}}</p>

<!-- Arithmetic Operations -->
<p>Total: ${{price * quantity}}</p>

<!-- String Operations -->
<p>Full Name: {{firstName + ' ' + lastName}}</p>
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

**`if`** - Conditional rendering (element added/removed from DOM)
```html
<div data-pac-bind="if: user.isAdmin">Admin Panel</div>
<div data-pac-bind="if: !isLoading">Content loaded</div>
```

**When to use each:**
- **`visible`**: Fast toggling, preserving form values, CSS transitions
- **`if`**: Better performance for large DOM trees, security-sensitive content

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

<!-- Array of classes -->
<div data-pac-bind="class: [baseClass, conditionalClass]">
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
        <span>{{index}}. {{item.name}}</span>
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

<!-- One-time event -->
<button data-pac-bind="click: initialize" data-pac-event="once">

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
        <span>{{index}}. {{todo.text}}</span>
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

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Network Status:**
- **`browserOnline`**: `true` when the browser is online, `false` when offline
- **`browserNetworkQuality`**: Network performance insights: `'fast'`, `'slow'` or `'offline'`

**Page Visibility:**
- **`browserVisible`**: `true` when the browser tab is active/visible, `false` when hidden

**Scroll Position:**
- **`browserScrollX`**: Horizontal scroll position in pixels
- **`browserScrollY`**: Vertical scroll position in pixels

**Page Dimensions:**
- **`browserViewportWidth`**: Browser viewport width in pixels
- **`browserViewportHeight`**: Browser viewport height in pixels
- **`browserDocumentWidth`**: Total document width in pixels
- **`browserDocumentHeight`**: Total document height in pixels

**Container Viewport Visibility:**
- **`containerVisible`**: `true` when any part of the container is visible in viewport
- **`containerFullyVisible`**: `true` when container is completely visible in viewport
- **`containerClientRect`**: Position and dimensions object relative to viewport
- **`containerWidth`**: Container width in pixels
- **`containerHeight`**: Container height in pixels

**Container Focus State:**
- **`containerFocus`**: `true` when container has direct focus (`:focus`)
- **`containerFocusWithin`**: `true` when container or child has focus (`:focus-within`)

### Usage Examples

```html
<!-- Browser properties in templates -->
<p>Viewport: {{browserViewportWidth}} x {{browserViewportHeight}}</p>
<p data-pac-bind="visible: !browserVisible">Tab is hidden - updates paused</p>
<p>Container is {{containerVisible ? 'visible' : 'hidden'}} in viewport</p>
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
    user: {
        profile: { name: 'John' },
        settings: { theme: 'dark' }
    },

    watch: {
        // Watch simple property
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2) {
                this.performSearch(newValue);
            }
        },

        // Watch specific nested property
        'user.profile.name'(newName, oldName, fullPath) {
            console.log('Name changed from', oldName, 'to', newName);
            this.updateDisplayName();
        },

        // Watch any change to user.settings using wildcard
        'user.settings.*'(newValue, oldValue, fullPath) {
            console.log('Settings changed at', fullPath);
            this.saveUserSettings();
        },

        // Watch ANY change anywhere in user object
        'user.**'(newValue, oldValue, fullPath) {
            this.markUserAsModified();
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

### EventProc - Win32-Style Message Processing

WakaPAC provides a powerful message processing system inspired by Win32 window procedures:

```javascript
wakaPAC('#file-manager', {
    activePane: 'left',

    eventProc(message) {
        switch(message.type) {
            case 'EVENT_KEYDOWN':
                if (message.ctrlKey) {
                    switch(message.key) {
                        case 's':
                            this.saveDocument();
                            return true;

                        case 'o':
                            this.openDocument();
                            return true;
                    }
                }
                break;

            case 'EVENT_LBUTTONDOWN':
                console.log('Left click at', message.clientX, message.clientY);
                break;

            case 'EVENT_RBUTTONDOWN':
                this.showContextMenu(message.clientX, message.clientY);
                break;
        }

        return false;
    }
});
```

**Message Object Structure:**

For keyboard events:
```javascript
{
    type:
        'EVENT_KEYDOWN',               // or EVENT_KEYUP
        wParam: 65,                    // Key code
        lParam: 0,                     // Reserved
        key: 'a',                      // Modern key name
        ctrlKey: false,                // Modifier states
        altKey: false,
        shiftKey: false,
        target: HTMLElement,           // Target element
        originalEvent: Event           // Original DOM event
}
```

For mouse events:
```javascript
{
    type:
        'EVENT_LBUTTONDOWN',           // LBUTTON, MBUTTON, RBUTTON + DOWN/UP
        wParam: 0,                     // Button: 0=left, 1=middle, 2=right
        lParam: 3435533,               // Packed coordinates
        clientX: 205,                  // X position
        clientY: 150,                  // Y position
        ctrlKey: false,                // Modifier states
        altKey: false,
        shiftKey: false,
        target: HTMLElement,           // Target element
        originalEvent: Event           // Original DOM event
}
```

**Focus State Requirements:**
Messages are only sent to components whose containers have keyboard focus. Make elements focusable:

```html
<!-- Add tabindex to make divs focusable -->
<div id="file-manager" tabindex="0" style="outline: none;">
    <!-- Component content -->
</div>
```

### Component Hierarchy

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
    onChildUpdate(eventType, data, childPAC) {
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

        // Notify specific child
        this.notifyChild('#child-app', 'focus');
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
        console.log(this.formatValue([1,2,3]));     // "[3 items]"
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

### Server Communication

```javascript
wakaPAC('#app', {
    user: null,
    loading: false,
    error: null,

    async loadUser() {
        this.loading = true;

        try {
            await this.control('/api/user', {
                method: 'GET',
                onSuccess: (data) => {
                    this.user = data;
                },
                onError: (error) => {
                    this.error = error.message;
                }
            });
        } finally {
            this.loading = false;
        }
    }
});
```

## API Reference

### Creating Components

```javascript
const component = wakaPAC(selector, abstraction, options);
```

### Core Methods

```javascript
// Communication
component.notifyParent(type, data)
component.notifyChildren(command, data)
component.notifyChild(selector, command, data)

// DOM interaction
component.readDOMValue(selector)
component.writeDOMValue(selector, value)
component.control(url, options)

// Data utilities
component.escapeHTML(str)
component.sanitizeUserInput(html)
component.formatValue(value)

// Lifecycle
component.destroy()
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
<div>{{message}}</div>
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