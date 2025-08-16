# WakaPAC

**WakaPAC** is a lightweight, powerful reactive JavaScript library that implements the **PAC (Presentation-Abstraction-Control)** architectural pattern. Inspired by Knockout.js with modern features from Vue and React.

## Why WakaPAC?

**🪶 Zero Build Complexity**
- No webpack, vite, or toolchain required
- Works directly in the browser with vanilla HTML/JS
- Drop into existing projects without rewriting everything

**⚡ Modern Reactivity**
- Write normal JavaScript objects instead of wrapping everything in observables
- Deep reactivity for nested objects and arrays
- Intelligent batching and performance optimizations

**🎯 Clean Architecture**
- PAC pattern provides better separation of concerns than MVC
- Component hierarchy with parent-child communication
- Expressive templates with Vue-like syntax

## Quick Start

### Installation

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Or download -->
<script src="wakapac.min.js"></script>
```

### Your First Component

```html
<!DOCTYPE html>
<html>
<head>
    <script src="wakapac.min.js"></script>
</head>
<body>
<div id="my-app">
    <h1>Hello {{fullName}}!</h1>
    <p>You clicked {{count}} times (Double: {{doubleCount}})</p>

    <input data-pac-bind="value:firstName" placeholder="First name">
    <input data-pac-bind="value:lastName" placeholder="Last name">
    <button data-pac-bind="click:increment">Click me!</button>

    <div data-pac-bind="visible:showMessage">
        This message is conditionally shown!
    </div>
    <div data-pac-bind="if:count > 10">
        <p>Congratulations! You've clicked more than 10 times!</p>
        <button data-pac-bind="click:reset">Reset</button>
    </div>
</div>

<script>
    wakaPAC('#my-app', {
        // Data
        firstName: 'John',
        lastName: 'Doe',
        count: 0,
        showMessage: true,

        // Computed properties
        computed: {
            fullName() {
                return this.firstName + ' ' + this.lastName;
            },
            doubleCount() {
                return this.count * 2;
            }
        },

        // Methods
        increment() {
            this.count++;
            if (this.count > 5) {
                this.showMessage = false;
            }
        },

        reset() {
            this.count = 0;
            this.showMessage = true;
        }
    });
</script>
</body>
</html>
```

## PAC Architecture

**PAC (Presentation-Abstraction-Control)** creates clean separation between:

- **Presentation**: Your HTML templates and DOM elements (what the user sees)
- **Abstraction**: Your data model and business logic (what your app knows)
- **Control**: The reactive layer that automatically syncs data changes to the DOM (how they stay synchronized)

Unlike MVC where models and views can talk directly, PAC uses the Control layer as a smart mediator that handles reactivity, events, and component communication.

## Data Binding

### Text Interpolation

```html
<!-- Simple properties -->
<p>Hello, {{name}}!</p>

<!-- Nested properties -->
<p>User: {{user.name}} ({{user.age}})</p>

<!-- Ternary expressions -->
<p>Status: {{user.age >= 18 ? 'Adult' : 'Minor'}}</p>

<!-- Computed properties -->
<p>Total: {{totalPrice}}</p>
```

### Attribute Binding

```html
<!-- Basic attributes -->
<div data-pac-bind="class:statusClass, title:statusText"></div>

<!-- Two-way data binding -->
<input data-pac-bind="value:name" type="text">
<textarea data-pac-bind="value:description"></textarea>
<select data-pac-bind="value:category">
    <option value="A">Category A</option>
    <option value="B">Category B</option>
</select>

<!-- Checkboxes (boolean values) -->
<input type="checkbox" data-pac-bind="checked:isActive">

<!-- Radio buttons (use value binding) -->
<input type="radio" name="theme" value="light" data-pac-bind="value:selectedTheme">
<input type="radio" name="theme" value="dark" data-pac-bind="value:selectedTheme">

<!-- Enable/Disable controls -->
<button data-pac-bind="enable:isFormValid">Submit</button>

<!-- Multiple bindings -->
<div data-pac-bind="class:statusClass,style:dynamicStyle,click:handleClick"></div>
```

### Conditional Rendering

```html
<!-- visible: CSS display control (stays in DOM) -->
<div data-pac-bind="visible:showDetails">Details here</div>
<div data-pac-bind="visible:!hideContent">Content</div>

<!-- if: DOM element control (added/removed from DOM) -->
<div data-pac-bind="if:user.isAdmin">Admin Panel</div>
<div data-pac-bind="if:!isLoading">Content loaded</div>
```

**When to use each:**
- **`visible`**: Fast toggling, preserving form values, CSS transitions
- **`if`**: Better performance for large DOM trees, security-sensitive content

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

## Event Handling

### Basic Events

```html
<button data-pac-bind="click:handleClick">Click me</button>
<form data-pac-bind="submit:handleSubmit">
    <input data-pac-bind="value:searchQuery">
    <button type="submit">Search</button>
</form>
<input data-pac-bind="input:handleInput,focus:handleFocus">
```

### Event Modifiers

```html
<!-- Prevent form submission redirect -->
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent">

<!-- Search on Enter key -->
<input data-pac-bind="keyup:search" data-pac-modifiers="enter">

<!-- Close modal on Escape -->
<div data-pac-bind="keyup:closeModal" data-pac-modifiers="escape">

<!-- One-time event -->
<button data-pac-bind="click:initialize" data-pac-modifiers="once">

<!-- Multiple modifiers -->
<form data-pac-bind="submit:handleForm" data-pac-modifiers="prevent stop">
```

**Available modifiers:**
- **Keys**: `enter`, `escape`/`esc`, `space`, `tab`, `delete`/`del`, `up`, `down`, `left`, `right`
- **Behavior**: `prevent`, `stop`, `once`

## Lists and For-Each

```html
<div data-pac-bind="foreach:todos" data-pac-item="todo" data-pac-index="index">
    <div class="todo-item">
        <span>{{index}}. {{todo.text}}</span>
        <input type="checkbox" data-pac-bind="checked:todo.completed">
        <button data-pac-bind="click:removeTodo">Remove</button>
    </div>
</div>

<!-- With callback -->
<ul data-pac-bind="foreach:items then onItemsUpdated" data-pac-item="item">
    <li>{{item.name}}</li>
</ul>
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

## Computed Properties

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

        // Dependent on other computed properties
        greeting() {
            return `Hello, ${this.fullName}! Total: $${this.totalPrice}`;
        }
    }
});
```

## Non-Reactive Properties

Use underscore prefix (`_`) for properties that shouldn't be reactive:

```javascript
wakaPAC('#map-app', {
    // ✅ Reactive properties (trigger DOM updates)
    tracking: false,
    currentLocation: null,
    
    // ✅ Non-reactive properties (no DOM updates, no circular references)
    _map: null,
    _markers: [],
    
    startTracking() {
        this.tracking = true; // Updates UI
        this._map = L.map('map'); // Safe for complex objects
    }
});
```

**Use non-reactive properties for:**
- External library instances (maps, charts, WebGL contexts)
- Large datasets that never change
- Objects with circular references
- Configuration objects

## Update Modes

Control when form inputs update your data:

```html
<!-- Immediate (default) - updates on every keystroke -->
<input data-pac-bind="value:name">

<!-- Change - updates when input loses focus -->
<input data-pac-bind="value:name" data-pac-update-mode="change">

<!-- Delayed - updates after specified delay (debounced) -->
<input data-pac-bind="value:searchQuery" 
       data-pac-update-mode="delayed" data-pac-update-delay="500">
```

**Use cases:**
- **Immediate**: Real-time validation, character counters
- **Change**: Server validation, auto-save functionality
- **Delayed**: Search autocomplete, API queries

## Component Hierarchy

### Parent-Child Communication

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
        // Send to all children
        this.sendToChildren('update', {theme: 'dark'});
        
        // Send to specific child
        this.sendToChild('#child-app', 'focus');
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

## Server Communication

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
    },

    async saveUser() {
        await this.control('/api/user', {
            method: 'POST',
            data: this.user
        });
    }
});
```

## API Reference

### Creating Components

```javascript
const component = wakaPAC(selector, abstraction, options);
```

**Parameters:**
- `selector`: CSS selector for container element
- `abstraction`: Object with properties, methods, computed properties
- `options`: Configuration object (optional)

### Core Methods

```javascript
// Communication
component.notifyParent(type, data)
component.sendToChildren(command, data)
component.sendToChild(selector, command, data)

// DOM interaction
component.readDOMValue(selector)
component.control(url, options)

// Lifecycle
component.destroy()
```

### Configuration Options

```javascript
wakaPAC('#app', data, {
    updateMode: 'immediate',    // 'immediate', 'delayed', 'change'
    delay: 300,                 // Delay for 'delayed' mode (ms)
    deepReactivity: true        // Enable deep object reactivity
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
<div v-show="isVisible">Content</div>

<!-- WakaPAC -->
<div>{{message}}</div>
<input data-pac-bind="value:name">
<button data-pac-bind="click:handleClick">Click</button>
<div data-pac-bind="if:isVisible">Content</div>
<div data-pac-bind="visible:isVisible">Content</div>
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

## When to Choose WakaPAC

**✅ Perfect for:**
- Complex single-page applications with clean architecture
- Dashboard and admin interfaces
- Data-heavy applications with reactive binding
- Real-time applications where performance matters
- Rapid prototyping and legacy modernization
- Projects that need zero build complexity

**⚠️ Consider alternatives for:**
- Server-side rendering requirements
- Mobile app development
- Teams requiring extensive TypeScript tooling

## Browser Support

- **Modern browsers**: Chrome, Firefox, Safari, Edge (with ES6 Proxy)
- **Legacy browsers**: IE11+ (fallback using Object.defineProperty)

## License

MIT License