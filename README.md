# WakaPAC Framework Manual

## 🌟 Introduction

**WakaPAC** is a lightweight, powerful reactive JavaScript framework that implements the **PAC (Presentation-Abstraction-Control)** architectural pattern. **Knockout.js was the main inspiration** for WakaPAC, enhanced with the best ideas from Vue and React to create a modern development experience.

### Why WakaPAC?

If you loved **Knockout's declarative data binding** but wanted modern component hierarchy from React and clean template syntax from Vue, WakaPAC is for you. It evolves Knockout's proven foundation with contemporary features and performance optimizations.

**🪶 Lightweight Alternative**
- **No build tools required** - works directly in the browser with vanilla HTML/JS
- **No virtual DOM overhead** - direct DOM manipulation with intelligent batching
- **No complex toolchain** - just include one JavaScript file and start building

**🎯 Key Improvements WakaPAC Brings:**
1. **Natural Reactivity**: Write normal JavaScript objects instead of wrapping everything in observables
2. **Component Hierarchy**: True parent-child relationships with bidirectional communication (inspired by React)
3. **Modern Templates**: Clean interpolation syntax and intuitive binding attributes (inspired by Vue)
4. **Deep Reactivity**: Automatically track changes in nested objects and arrays without manual setup
5. **Performance Optimizations**: Batched DOM updates, intelligent change detection, and computed property caching
6. **Architectural Clarity**: PAC structure provides better organization for complex applications

### What is PAC Architecture?

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

## 🚀 Quick Start

### Installation

Include WakaPAC in your HTML:

```html
<script src="wakapac.js"></script>
```

### Your First Component

```html
<!DOCTYPE html>
<html>
<head>
    <script src="wakapac.js"></script>
</head>
<body>
<div id="my-app">
    <h1>Hello {{fullName}}!</h1>
    <p>You clicked {{count}} times</p>
    <p>Double count: {{doubleCount}}</p>

    <input data-pac-bind="firstName" placeholder="First name">
    <input data-pac-bind="lastName" placeholder="Last name">

    <button data-pac-bind="click:increment">Click me!</button>

    <div data-pac-bind="visible:showMessage">
        This message is conditionally shown!
    </div>
    <div data-pac-bind="visible:!hideWelcome">
        Welcome message (hidden when hideWelcome is true)
    </div>
</div>

<script>
    wakaPAC('#my-app', {
        // Abstraction: Your data and business logic
        firstName: 'John',
        lastName: 'Doe',
        count: 0,
        showMessage: true,
        hideWelcome: false,

        // Computed properties (like Vue computed or Knockout computed observables)
        computed: {
            fullName() {
                return this.firstName + ' ' + this.lastName;
            },
            doubleCount() {
                return this.count * 2;
            }
        },

        // Methods (like React methods or Vue methods)
        increment() {
            this.count++;
            if (this.count > 5) {
                this.showMessage = false;
            }
        }
    });
    // Control layer automatically created by WakaPAC
    // Presentation layer is your HTML template above
</script>
</body>
</html>
```

**WakaPAC** gives you the simplicity of Vue-style templates with the power of React-style component hierarchies and the automatic reactivity of Knockout-style observables, but without any build tools or complex setup.

## 🔄 Core Features

### Reactive Data Binding
- **Automatic DOM updates** when JavaScript object properties change
- **Deep reactivity** for nested objects and arrays with path tracking
- **Two-way binding** between form inputs and data properties
- **Intelligent change detection** with batched DOM updates
- **Array mutation tracking** - `push()`, `pop()`, `splice()` automatically trigger updates

### Template Syntax (Vue-inspired)
- Simple `{{propertyName}}` syntax for dynamic content in HTML
- Support for computed properties with automatic dependency tracking
- Conditional rendering with `data-pac-bind="visible:property"` and negation support `visible:!property`

### Event Handling (React-inspired)
- Declarative event binding via data attributes
- Method binding with `data-pac-bind="click:methodName"`
- Automatic event delegation for performance

### Hierarchical Components (React-inspired)
- **Parent-to-child commands**: Send instructions and data down the hierarchy
- **Child-to-parent notifications**: Report status and request resources
- **Multi-level communication**: Messages can flow through intermediate components
- **Child querying**: Find and manipulate children by selectors, properties, or functions

### Performance Optimized
- Batched DOM updates using `requestAnimationFrame`
- Intelligent caching of computed properties
- Event delegation to minimize memory usage
- **Proxy-based reactivity** for modern browsers with fallback for older browsers

## 📊 Data Binding

### Text Interpolation (Vue-style)

Use double braces `{{}}` to bind data to text content:

```html
<p>Hello, {{name}}!</p>
<p>Total items: {{items.length}}</p>
<p>User info: {{user.name}} ({{user.age}})</p>
<p>Computed value: {{computedProperty}}</p>
```

### Deep Reactivity Example (Vue-inspired with React-like state updates)

```javascript
wakaPAC('#app', {
    user: {
        name: 'John',
        preferences: {
            theme: 'dark',
            notifications: true
        }
    },
    todos: [],

    addTodo() {
        // This works! Array mutations are reactive (unlike React, no setState needed)
        this.todos.push({
            id: Date.now(),
            text: 'New todo',
            completed: false
        });
    },

    toggleTodo(index) {
        // This works! Deep nested changes are reactive (unlike React)
        this.todos[index].completed = !this.todos[index].completed;
    },

    updateTheme(newTheme) {
        // This works! Deep nested property changes (like Vue, unlike React)
        this.user.preferences.theme = newTheme;
    }
});
```

### Attribute Binding

Use `data-pac-bind` to bind data to element attributes:

```html
<!-- Basic property binding (like Vue v-model) -->
<input type="text" data-pac-bind="name">

<!-- Attribute binding (like Vue :class) -->
<div data-pac-bind="class:statusClass,title:statusText"></div>

<!-- Visibility binding (like Vue v-if) -->
<div data-pac-bind="visible:showDetails">Details here</div>
<div data-pac-bind="visible:!hideContent">Always visible unless hideContent is true</div>
```

### Two-Way Data Binding (Knockout-style simplicity)

Form elements automatically sync with your data:

```html
<input type="text" data-pac-bind="username">
<input type="number" data-pac-bind="age">
<input type="email" data-pac-bind="email">
<textarea data-pac-bind="description"></textarea>
<select data-pac-bind="category">
    <option value="A">Category A</option>
    <option value="B">Category B</option>
</select>
```

## ⚡ Event Handling

### Basic Events (React-style with Vue syntax)

Bind DOM events to methods using the `data-pac-bind` attribute:

```html
<button data-pac-bind="click:handleClick">Click me</button>
<form data-pac-bind="submit:handleSubmit">
    <input type="text" data-pac-bind="searchQuery">
    <button type="submit">Search</button>
</form>
<input data-pac-bind="input:handleInput,focus:handleFocus,blur:handleBlur">
```

```javascript
const app = wakaPAC('#app', {
    searchQuery: '',
    
    handleClick(event) {
        console.log('Button clicked!', event);
    },
    
    handleSubmit(event) {
        event.preventDefault();
        console.log('Searching for:', this.searchQuery);
    },
    
    handleInput(event) {
        console.log('Input changed:', event.target.value);
    }
});
```

### Supported Events

- `click`, `submit`, `change`, `input`
- `focus`, `blur`
- `keyup`, `keydown`

## 🧮 Computed Properties

Computed properties (inspired by Vue computed and Knockout computed observables) automatically recalculate when their dependencies change:

```javascript
const app = wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    items: [{price: 10}, {price: 20}, {price: 15}],
    
    computed: {
        // Simple computed property (like Vue computed)
        fullName() {
            return `${this.firstName} ${this.lastName}`;
        },
        
        // Computed property with array dependency (like Knockout computed observables)
        totalPrice() {
            return this.items.reduce((sum, item) => sum + item.price, 0);
        },
        
        // Computed property depending on other computed properties
        greeting() {
            return `Hello, ${this.fullName}! Your total is $${this.totalPrice}`;
        }
    }
});
```

### Automatic Dependency Tracking (Knockout-style)

The framework automatically analyzes computed functions to determine dependencies:

```javascript
computed: {
    expensiveItems() {
        // Automatically depends on 'items' property
        return this.items.filter(item => item.price > 15);
    },
    
    summary() {
        // Depends on multiple properties and other computed properties
        return `${this.fullName} has ${this.expensiveItems.length} expensive items`;
    }
}
```

## 🔧 Update Modes

WakaPAC supports different update modes for form inputs to optimize performance:

### Immediate Mode (Default)

Updates data model on every keystroke:

```html
<input type="text" data-pac-bind="name">
<!-- Or explicitly -->
<input type="text" data-pac-bind="name" data-pac-update="immediate">
```

### Change Mode

Updates only when the input loses focus:

```html
<input type="text" data-pac-bind="name" data-pac-update="change">
```

### Delayed Mode

Updates after a specified delay (debounced):

```html
<input type="text" data-pac-bind="searchQuery" 
       data-pac-update="delayed" data-pac-delay="500">
```

### Global Configuration

Set default update modes when creating PAC units:

```javascript
const app = wakaPAC('#app', {
    name: 'John'
}, {
    updateMode: 'delayed',
    delay: 300,
    deepReactivity: true
});
```

## 🔗 Hierarchical Communication

### Parent-Child Relationships

WakaPAC automatically establishes parent-child relationships based on DOM hierarchy:

```html
<div id="parent-app">
    <h1>Parent Component</h1>
    
    <div id="child-app">
        <h2>Child Component</h2>
        
        <div id="grandchild-app">
            <h3>Grandchild Component</h3>
        </div>
    </div>
</div>
```

### Communication Methods

#### Child to Parent (Notifications)

```javascript
// In child component
const child = wakaPAC('#child-app', {
    sendAlert() {
        this.notifyParent('alert', {
            message: 'Something important happened',
            timestamp: Date.now()
        });
    }
});

// In parent component
const parent = wakaPAC('#parent-app', {
    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'alert') {
            console.log('Received alert:', data.message);
        }
    }
});
```

#### Parent to Child (Commands)

```javascript
// In parent component
const parent = wakaPAC('#parent-app', {
    broadcastMessage() {
        // Send to all children
        this.sendToChildren('update', {theme: 'dark'});
        
        // Send to specific child
        this.sendToChild('#child-app', 'focus', {reason: 'user action'});
    }
});

// In child component
const child = wakaPAC('#child-app', {
    receiveFromParent(command, data) {
        switch(command) {
            case 'update':
                this.applyTheme(data.theme);
                break;
            case 'focus':
                this.handleFocus(data.reason);
                break;
        }
    }
});
```

## 🎯 Advanced Features

### Arrays and For-Each Binding

Display dynamic lists with the `foreach` binding:

```html
<div data-pac-bind="foreach:todos" data-pac-item="todo" data-pac-index="index">
    <div class="todo-item">
        <span>{{index}}. {{todo.text}}</span>
        <input type="checkbox" data-pac-bind="checked:todo.completed,change:toggleTodo">
        <button data-pac-bind="click:removeTodo">Remove</button>
    </div>
</div>
```

```javascript
const app = wakaPAC('#app', {
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: false},
        {id: 2, text: 'Build an app', completed: true}
    ],
    
    // Methods receive item, index, and event
    toggleTodo(todo, index, event) {
        todo.completed = !todo.completed;
    },
    
    removeTodo(todo, index, event) {
        const todoIndex = this.todos.findIndex(t => t.id === todo.id);
        if (todoIndex !== -1) {
            this.todos.splice(todoIndex, 1);
        }
    }
});
```

### Server Communication (Built-in fetch wrapper)

Built-in AJAX support with automatic property updates:

```javascript
const app = wakaPAC('#app', {
    user: null,
    loading: false,
    
    async loadUser() {
        this.loading = true;
        
        try {
            const userData = await this.control('/api/user', {
                method: 'GET',
                updateProperties: true, // Automatically update matching properties
                onSuccess(data) {
                    console.log('User loaded:', data);
                },
                onError(error) {
                    console.error('Failed to load user:', error);
                }
            });
            
            this.loading = false;
        } catch (error) {
            this.loading = false;
            this.error = error.message;
        }
    },
    
    async saveUser() {
        await this.control('/api/user', {
            method: 'POST',
            data: {
                name: this.user.name,
                email: this.user.email
            }
        });
    }
});
```

### Coordinated Dashboard Example

```javascript
// Dashboard parent coordinates multiple widgets
wakaPAC('#dashboard', {
    theme: 'light',
    refreshInterval: 5000,
    isMaintenanceMode: false,

    // Coordinate all widgets
    refreshAllData() {
        this.sendToChildren('refresh', {
            timestamp: Date.now(),
            force: true
        });
    },

    enterMaintenanceMode() {
        this.isMaintenanceMode = true;
        this.sendToChildren('pause', {
            reason: 'Maintenance mode activated',
            showMessage: true
        });
    },

    changeTheme(newTheme) {
        this.theme = newTheme;
        this.sendToChildren('updateTheme', { theme: newTheme });
    },

    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'error') {
            // Handle widget errors
            console.error(`Widget error in ${childPAC.container.id}:`, data);
            
            // Pause the problematic widget
            childPAC.receiveFromParent('pause', {
                reason: 'Error occurred',
                showError: true
            });
        }
    }
});
```

## 📋 API Reference

### Creating a PAC Component

```javascript
const component = wakaPAC(selector, abstraction, options);
```

- **selector**: CSS selector for the container element
- **abstraction**: Object containing properties, methods, and computed properties
- **options**: Configuration object (optional)

### Template Syntax Reference

```html
<!-- Text interpolation -->
<span>Welcome {{userName}}!</span>

<!-- Conditional rendering -->
<div data-pac-bind="visible:isLoggedIn">User dashboard</div>
<div data-pac-bind="visible:!isLoggedIn">Please log in</div>

<!-- Event binding -->
<button data-pac-bind="click:handleLogin">Login</button>
<form data-pac-bind="submit:handleSubmit">...</form>

<!-- Input binding -->
<input data-pac-bind="email" type="email">
<textarea data-pac-bind="message"></textarea>

<!-- Attribute binding -->
<div data-pac-bind="class:statusClass,title:tooltipText">Status</div>

<!-- List rendering -->
<div data-pac-bind="foreach:items" data-pac-item="item" data-pac-index="index">
    <span>{{index}}: {{item.name}}</span>
</div>
```

### Core Methods

#### Communication (React-inspired)
- `notifyParent(type, data)`: Send notification to parent
- `sendToChildren(command, data)`: Send command to all children
- `sendToChild(selector, command, data)`: Send command to specific child

#### Hierarchy Management
- `addChild(childPAC)`: Manually add a child
- `removeChild(childPAC)`: Remove a child
- `findChild(predicate)`: Find child matching predicate
- `findChildren(predicate)`: Find all children matching predicate

#### Lifecycle
- `destroy()`: Clean up the PAC unit

### Configuration Options

```javascript
{
    updateMode: 'immediate',    // 'immediate', 'delayed', 'change'
    delay: 300,                 // Delay for 'delayed' mode (ms)
    deepReactivity: true        // Enable deep object reactivity
}
```

## 💡 Best Practices

### 1. Component Organization

```javascript
// Good: Organized component structure
const userProfile = wakaPAC('#user-profile', {
    // Data properties
    user: {
        name: '',
        email: '',
        avatar: null
    },
    editing: false,
    
    // Computed properties
    computed: {
        displayName() {
            return this.user.name || 'Anonymous';
        },
        
        isValid() {
            return this.user.name && this.user.email;
        }
    },
    
    // Event handlers
    startEdit() {
        this.editing = true;
    },
    
    saveProfile() {
        if (this.isValid) {
            this.control('/api/profile', {
                method: 'PUT',
                data: this.user
            });
        }
    },
    
    // Communication handlers
    receiveFromParent(command, data) {
        // Handle parent commands
    }
});
```

### 2. Efficient DOM Updates

```javascript
// Good: Use computed properties for expensive operations
computed: {
    filteredItems() {
        return this.items.filter(item => 
            item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
    }
}

// Good: Use appropriate update modes
// For search inputs (delayed)
<input data-pac-bind="searchQuery" data-pac-update="delayed" data-pac-delay="300">

// For form validation (change)
<input data-pac-bind="email" data-pac-update="change">
```

## 🔄 Migration Guide

### Key Concepts Translation

WakaPAC combines familiar patterns from popular frameworks:

**Template Syntax:**
- Use `{{property}}` for text interpolation
- Use `data-pac-bind="property"` for input binding
- Use `data-pac-bind="visible:condition"` for conditional rendering
- Use `data-pac-bind="click:method"` for event handling

**Reactivity:**
- Properties are automatically reactive (no `setState` needed)
- Computed properties recalculate automatically
- Deep object and array changes are detected

**Component Communication:**
- Use `notifyParent()` to send data up
- Use `sendToChildren()` to send commands down
- Use `receiveFromParent()` to handle parent commands

## 🐛 Troubleshooting

### Common Issues

**1. Bindings not working**
- Ensure the container element exists when creating the PAC unit
- Check that data-pac-bind syntax is correct
- Verify property names match between HTML and abstraction object

**2. Updates not triggering**
- Make sure you're modifying the reactive properties, not copies
- For nested objects, ensure deep reactivity is enabled
- Check that computed property dependencies are correctly accessed

**3. Performance issues**
- Use appropriate update modes (delayed for search, change for validation)
- Avoid complex operations in computed properties
- Consider using requestAnimationFrame for heavy DOM updates

**4. Hierarchy communication not working**
- Verify parent-child relationships are established (check DOM structure)
- Ensure onChildUpdate and receiveFromParent methods are defined
- Check that event types and data match between sender and receiver

### Debug Tips

```javascript
// Check hierarchy
console.log('Parent:', app.parent);
console.log('Children:', app.children);

// Monitor property changes
const app = wakaPAC('#app', {
    name: 'John',
    
    // Override property setter for debugging
    set name(value) {
        console.log('Name changing from', this._name, 'to', value);
        this._name = value;
    },
    
    get name() {
        return this._name;
    }
});
```

### Browser Support

WakaPAC supports:
- **Modern browsers**: Chrome, Firefox, Safari, Edge (ES6 Proxy support)
- **Legacy browsers**: IE11+ (with fallback reactivity using Object.defineProperty)

The framework automatically detects Proxy support and falls back gracefully.

## 🎯 Why Choose WakaPAC?

**Choose WakaPAC if you:**
- Want modern reactivity without build tools
- Love Vue's template syntax but want something lighter
- Need React-style component hierarchy without JSX
- Want Knockout's simplicity with modern features
- Are building small to medium applications
- Want to progressively enhance existing websites
- Need to get productive quickly without learning complex toolchains

**Consider other frameworks if you:**
- Need server-side rendering (use Next.js/Nuxt)
- Are building large, complex applications (use React/Vue)
- Need a mature ecosystem with thousands of plugins
- Require TypeScript integration out of the box
- Need mobile app development (use React Native/Vue Native)

---

WakaPAC brings together the best ideas from modern frameworks in a lightweight, approachable package that works everywhere JavaScript runs. No build tools, no complexity - just reactive, component-based development the way it should be.

## 📄 License

WakaPAC is released under the **MIT License**