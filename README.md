# WakaPAC

## 🌟 Introduction

**WakaPAC** is a lightweight, powerful reactive JavaScript library that implements the **PAC (Presentation-Abstraction-Control)** architectural pattern. **Knockout.js was the main inspiration** for WakaPAC, enhanced with the best ideas from Vue and React to create a modern development experience.

### Why WakaPAC?

If you love **Knockout's declarative data binding** but want modern component hierarchy from React and clean template syntax from Vue, WakaPAC is for you. It evolves Knockout's proven foundation with contemporary features and performance optimizations.

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

    <input data-pac-bind="value:firstName" placeholder="First name">
    <input data-pac-bind="value:lastName" placeholder="Last name">

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
- **Conditional expressions** in text interpolation with ternary operators
- Conditional rendering with `data-pac-bind="visible:property"` and negation support `visible:!property`

### Enhanced Attribute Binding
- **Conditional attribute binding** with expressions
- **Multiple binding support** on single elements
- **Performance-optimized** expression parsing and caching

### Event Handling (React-inspired)
- Declarative event binding via data attributes
- Method binding with `data-pac-bind="click:methodName"`
- **Event modifiers** for common patterns like prevent default and key filtering
- Automatic event delegation for performance

### Hierarchical Components (React-inspired)
- **Parent-to-child commands**: Send instructions and data down the hierarchy
- **Child-to-parent notifications**: Report status and request resources
- **Multi-level communication**: Messages can flow through intermediate components
- **Child querying**: Find and manipulate children by selectors, properties, or functions

### Performance Optimized
- Batched DOM updates using `requestAnimationFrame`
- Intelligent caching of computed properties
- **Expression caching** to avoid re-parsing
- Event delegation to minimize memory usage
- **Proxy-based reactivity** for modern browsers with fallback for older browsers

## 📊 Data Binding

### Text Interpolation (Vue-style)

Use double braces `{{}}` to bind data to text content. Property access and expressions are fully supported:

```html
<!-- ✅ Simple properties -->
<p>Hello, {{name}}!</p>
<p>User name: {{userName}}</p>
<p>Computed value: {{computedProperty}}</p>

<!-- ✅ Nested property access (dot notation only) -->
<p>Total items: {{itemCount}}</p>
<p>User info: {{user.name}} ({{user.age}})</p>
<p>Theme: {{user.preferences.theme}}</p>
<p>Email notifications: {{user.settings.notifications.email}}</p>

<!-- ✅ Ternary expressions -->
<p>Status: {{user.age >= 18 ? 'Adult' : 'Minor'}}</p>
<p>Theme mode: {{user.preferences.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}}</p>

<!-- ✅ Computed properties for complex logic -->
<p>Completed todos: {{completedTodosCount}}</p>
<p>User initials: {{userInitials}}</p>
<p>First item: {{firstItemName}}</p>
<p>Summary: {{userSummary}}</p>
```

```javascript
wakaPAC('#app', {
    name: 'John',
    userName: 'john_doe',
    items: [{name: 'Item 1'}, {name: 'Item 2'}, {name: 'Item 3'}],
    user: {
        name: 'John Doe',
        age: 30,
        preferences: {
            theme: 'dark',
            notifications: true
        },
        settings: {
            notifications: {
                email: true,
                sms: false
            }
        }
    },
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: true},
        {id: 2, text: 'Build an app', completed: false}
    ],

    computed: {
        // Simple computed properties for values that need calculation
        itemCount() {
            return this.items.length;
        },

        completedTodosCount() {
            return this.todos.filter(t => t.completed).length;
        },

        userInitials() {
            return this.user.name.split(' ').map(n => n[0]).join('.');
        },

        firstItemName() {
            return this.items.length > 0 ? this.items[0].name : 'No items';
        },

        userSummary() {
            const completedTodos = this.todos.filter(t => t.completed).length;
            return `${this.user.name} has completed ${completedTodos} todos`;
        }
    }
});
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

### Basic Attribute Binding

Use `data-pac-bind` to bind data to element attributes:

```html
<!-- Basic property binding (like Vue v-model) -->
<input type="text" data-pac-bind="value:name">

<!-- Simple attribute binding -->
<div data-pac-bind="class:statusClass,title:statusText"></div>

<!-- Visibility binding (like Vue v-if) -->
<div data-pac-bind="visible:showDetails">Details here</div>
<div data-pac-bind="visible:!hideContent">Always visible unless hideContent is true</div>
```

### Conditional Attribute Binding

WakaPAC now supports powerful conditional expressions directly in attribute bindings:

```html
<!-- ✅ Simple conditional classes -->
<div data-pac-bind="class:isActive ? 'btn-primary' : 'btn-secondary'">Button</div>

<!-- ✅ Multiple conditions -->
<button data-pac-bind="disabled:loading || !isValid">Submit</button>

<!-- ✅ Complex expressions -->
<div data-pac-bind="class:user.role === 'admin' && user.isActive ? 'admin-panel' : 'user-panel'">Panel</div>

<!-- ✅ Dynamic styles -->
<div data-pac-bind="style:theme === 'dark' ? 'background: #333; color: white' : 'background: white; color: black'">Content</div>

<!-- ✅ Multiple bindings with mixed expressions -->
<button data-pac-bind="class:status === 'loading' ? 'spinner' : '', disabled:loading">Save</button>
```

#### Supported Expression Types:

**Ternary Operators:**
```html
<!-- condition ? trueValue : falseValue -->
<div data-pac-bind="class:isActive ? 'active highlight' : 'inactive'">
```

**Comparison Operators:**
```html
<!-- ===, !==, ==, !=, >=, <=, >, < -->
<div data-pac-bind="visible:user.age >= 18">Adult content</div>
<div data-pac-bind="class:status === 'complete' ? 'done' : 'pending'">
```

**Logical Operators:**
```html
<!-- && (AND), || (OR) -->
<button data-pac-bind="disabled:loading || !isValid">Submit</button>
<div data-pac-bind="visible:user.isLoggedIn && user.hasPermission">Admin panel</div>
```

### Two-Way Data Binding (Knockout-style simplicity)

Form elements automatically sync with your data:

```html
<input type="text" data-pac-bind="value:username">
<input type="number" data-pac-bind="value:age">
<input type="email" data-pac-bind="value:email">
<textarea data-pac-bind="value:description"></textarea>
<select data-pac-bind="value:category">
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
    <input type="text" data-pac-bind="value:searchQuery">
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

### Event Modifiers

WakaPAC provides powerful event modifiers to reduce boilerplate in your event handlers:

```html
<!-- ✅ Prevent form submission redirect -->
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent">

<!-- ✅ Search on Enter key -->
<input data-pac-bind="keyup:search" data-pac-modifiers="enter">

<!-- ✅ Close modal on Escape -->
<div data-pac-bind="keyup:closeModal" data-pac-modifiers="escape">

<!-- ✅ Stop event propagation -->
<button data-pac-bind="click:handleClick" data-pac-modifiers="stop">

<!-- ✅ One-time event (auto-removes after first trigger) -->
<button data-pac-bind="click:initialize" data-pac-modifiers="once">

<!-- ✅ Multiple modifiers -->
<form data-pac-bind="submit:handleForm" data-pac-modifiers="prevent stop">
<input data-pac-bind="keydown:handleShortcut" data-pac-modifiers="ctrl enter prevent">
</html>
```

#### Supported Event Modifiers:

**Behavior Modifiers:**
- `prevent` - Calls `event.preventDefault()`
- `stop` - Calls `event.stopPropagation()`
- `once` - Removes the event listener after first execution
- `passive` - Adds passive event listener for better performance

**Key Modifiers:**
- `enter`, `escape`/`esc`, `space`, `tab`
- `delete`/`del`, `up`, `down`, `left`, `right`
- `ctrl`, `alt`, `shift`, `meta`

**Benefits of Event Modifiers:**

```javascript
// ❌ Without modifiers (lots of boilerplate)
const app = wakaPAC('#app', {
    handleSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        // Your actual logic here
        this.submitForm();
    },

    handleKeyPress(event) {
        if (event.key !== 'Enter') return;
        if (!event.ctrlKey) return;
        event.preventDefault();
        // Your actual logic here
        this.search();
    }
});
```

```javascript
// ✅ With modifiers (clean, focused methods)
const app = wakaPAC('#app', {
    handleSubmit() {
        // Just your logic - no event handling boilerplate!
        this.submitForm();
    },
    
    search() {
        // Direct to the point
        this.performSearch();
    }
});
```

```html
<!-- Clean declarative templates -->
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent stop">
<input data-pac-bind="keyup:search" data-pac-modifiers="ctrl enter prevent">
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
        
        // Array length computed property
        itemCount() {
            return this.items.length;
        },
        
        // Computed property depending on other computed properties
        greeting() {
            return `Hello, ${this.fullName}! Your total is $${this.totalPrice}`;
        }
    }
});
```

### Automatic Dependency Tracking (Knockout-style)

The library automatically analyzes computed functions to determine dependencies:

```javascript
computed: {
    expensiveItems() {
        // Automatically depends on 'items' property
        return this.items.filter(item => item.price > 15);
    },
    
    expensiveItemCount() {
        // Depends on other computed property
        return this.expensiveItems.length;
    },
    
    summary() {
        // Depends on multiple properties and other computed properties
        return `${this.fullName} has ${this.expensiveItemCount} expensive items`;
    }
}
```

## 🔧 Update Modes

WakaPAC supports different update modes for form inputs to optimize performance:

### Immediate Mode (Default)

Updates data model on every keystroke:

```html
<input type="text" data-pac-bind="value:name">
<!-- Or explicitly -->
<input type="text" data-pac-bind="value:name" data-pac-update-mode="immediate">
```

### Change Mode

Updates only when the input loses focus:

```html
<input type="text" data-pac-bind="value:name" data-pac-update-mode="change">
```

### Delayed Mode

Updates after a specified delay (debounced):

```html
<input type="text" data-pac-bind="value:searchQuery"
       data-pac-update-mode="delayed" data-pac-update-delay="500">
```

### Global Configuration

Set default update modes when creating PAC units:

```javascript
const app = wakaPAC('#app', {
    name: 'John'
}, {
    updateMode: 'delayed',
    delay: 300
});
```

## 🎯 Event Handler Signatures

**WakaPAC event handlers receive different parameters depending on where they're used:**

### Outside Foreach Loops → Just the Event
When you bind events to regular elements, your handler gets only the `event` parameter:

```html
<!-- Regular button outside any foreach -->
<button data-pac-bind="click:saveData">Save</button>
<form data-pac-bind="submit:handleLogin" data-pac-modifiers="prevent">Login</form>
```

```javascript
wakaPAC('#app', {
    saveData(event) {
        // ✅ Only receives: event
        console.log('Save clicked');
    },
    
    handleLogin(event) {
        // ✅ Only receives: event (no need for event.preventDefault() with modifiers!)
        console.log('Login submitted');
    }
});
```

### Inside Foreach Loops → Item, Index, and Event
When you bind events inside a `foreach` template, your handler gets three parameters:

```html
<!-- Buttons inside foreach get extra context -->
<div data-pac-bind="foreach:todos" data-pac-item="todo" data-pac-index="i">
    <span>{{todo.text}}</span>
    <button data-pac-bind="click:toggleTodo">Toggle</button>
    <button data-pac-bind="click:removeTodo">Delete</button>
</div>
```

```javascript
wakaPAC('#app', {
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: false},
        {id: 2, text: 'Build an app', completed: true}
    ],
    
    toggleTodo(todo, index, event) {
        // ✅ Receives: current todo item, its array index, and the click event
        console.log('Toggling todo:', todo.text, 'at position', index);
        todo.completed = !todo.completed;
    },
    
    removeTodo(todo, index, event) {
        // ✅ Receives: current todo item, its array index, and the click event
        console.log('Removing todo:', todo.text);
        this.todos.splice(index, 1);
    }
});
```

### Quick Reference

| **Context**     | **Handler Signature**         | **Example**                                            |
|-----------------|-------------------------------|--------------------------------------------------------|
| Regular element | `handler(event)`              | `<button data-pac-bind="click:save">`                  |
| Inside foreach  | `handler(item, index, event)` | `<button data-pac-bind="click:toggle">` inside foreach |

**💡 Tip:** The foreach context gives you direct access to the current item and its position, making it easy to modify or remove specific items without searching through the array.

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
    receiveUpdate(eventType, data, childPAC) {
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
    
    // Computed property for todo count
    computed: {
        todoCount() {
            return this.todos.length;
        },
        
        completedCount() {
            return this.todos.filter(todo => todo.completed).length;
        }
    },
    
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
    
    loadUser() {
        this.loading = true;
        
        try {
            const userData = this.control('/api/user', {
                method: 'GET',
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
    
    saveUser() {
        this.control('/api/user', {
            method: 'POST',
            data: {
                name: this.user.name,
                email: this.user.email
            }
        });
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
<!-- Text interpolation with expression support -->
<span>Welcome {{userName}}!</span>
<span>Items: {{items.length}}</span>
<span>Status: {{status === 'active' ? 'Online' : 'Offline'}}</span>

<!-- Conditional rendering -->
<div data-pac-bind="visible:isLoggedIn">User dashboard</div>
<div data-pac-bind="visible:!isLoggedIn">Please log in</div>

<!-- Event binding with modifiers -->
<button data-pac-bind="click:handleLogin" data-pac-modifiers="once">Login</button>
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent">...</form>
<input data-pac-bind="keyup:search" data-pac-modifiers="enter">

<!-- Input binding -->
<input data-pac-bind="value:email" type="email">
<textarea data-pac-bind="value:message"></textarea>

<!-- Conditional attribute binding -->
<div data-pac-bind="class:isActive ? 'btn-primary' : 'btn-secondary'">Button</div>
<button data-pac-bind="disabled:loading || !isValid">Submit</button>

<!-- Multiple attribute bindings -->
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
    delay: 300                  // Delay for 'delayed' mode (ms)
}
```

## 🔄 Migration Guide

### Key Concepts Translation

WakaPAC combines familiar patterns from popular libraries:

**Template Syntax:**
- Use `{{property}}` or `{{object.property}}` for text interpolation
- Use `{{condition ? 'true' : 'false'}}` for conditional text
- Use `data-pac-bind="value:property"` for input binding
- Use `data-pac-bind="visible:condition"` for conditional rendering
- Use `data-pac-bind="click:method"` for event handling
- Use `data-pac-modifiers="prevent enter"` for event modifiers

**Conditional Attributes:**
- Use `data-pac-bind="class:condition ? 'class1' : 'class2'"` instead of computed properties
- Use `data-pac-bind="disabled:loading || !valid"` for dynamic attributes
- Combine with regular bindings: `data-pac-bind="class:statusClass, disabled:loading"`

**Reactivity:**
- Properties are automatically reactive (no `setState` needed)
- Computed properties recalculate automatically
- Deep object and array changes are detected
- Use computed properties for complex or frequently accessed derived values

**Component Communication:**
- Use `notifyParent()` to send data up
- Use `sendToChildren()` to send commands down
- Use `receiveFromParent()` to handle parent commands

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

// Debug expression parsing
// Check browser console for expression parsing warnings
```

### Browser Support

WakaPAC supports:
- **Modern browsers**: Chrome, Firefox, Safari, Edge (ES6 Proxy support)
- **Legacy browsers**: IE11+ (with fallback reactivity using Object.defineProperty)

The library automatically detects Proxy support and falls back gracefully.

## 🎯 Why Choose WakaPAC?

**Choose WakaPAC when you want:**
- **Zero build complexity** - Start building immediately without webpack, vite, or any toolchain
- **Modern reactivity** - Get Vue/React-level reactivity with simpler mental models
- **Expressive templates** - Write conditions directly in templates without bloating your component logic
- **Architectural clarity** - PAC pattern provides better separation of concerns than MVC
- **Performance by default** - Direct DOM manipulation with intelligent batching outperforms virtual DOM overhead
- **Progressive enhancement** - Drop into existing projects without rewriting everything
- **Component hierarchy** - Build complex applications with parent-child communication
- **True simplicity** - Focus on your application logic, not library complexity

**WakaPAC excels at:**
- **Complex single-page applications** with clean architecture
- **Dashboard and admin interfaces** with rich interactivity
- **Data-heavy applications** that benefit from reactive binding
- **Real-time applications** where performance matters
- **Enterprise applications** that need maintainable code structure
- **Rapid prototyping** when you need to move fast
- **Legacy modernization** where you can't start from scratch

**Consider other tools only for specific needs:**
- **Server-side rendering** (add a backend framework like Next.js/Nuxt)
- **Mobile app development** (use React Native/Flutter alongside WakaPAC for web)
- **Massive teams** requiring extensive TypeScript tooling (though WakaPAC works great with TypeScript)

WakaPAC brings together the best ideas from modern libraries in a lightweight, approachable package that works everywhere JavaScript runs. No build tools, no complexity - just reactive, component-based development the way it should be.

## 📄 License

WakaPAC is released under the **MIT License**