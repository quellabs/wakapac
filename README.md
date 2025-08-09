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

**Option 1: Direct Download**
```html
<script src="wakapac.js"></script>
<script src="wakapac.min.js"></script>
```

**Option 2: JSDelivr CDN (GitHub)**
```html
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.js"></script>
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>
```

**Option 3: Module Import**
```javascript
// If using as an ES module
import { wakaPAC } from './wakapac.js';
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

### Text Interpolation

Use double braces `{{}}` to bind data to text content:

```html
<!-- ✅ Simple properties -->
<p>Hello, {{name}}!</p>
<p>User name: {{userName}}</p>
<p>Computed value: {{computedProperty}}</p>

<!-- ✅ Nested property access -->
<p>User info: {{user.name}} ({{user.age}})</p>
<p>Theme: {{user.preferences.theme}}</p>

<!-- ✅ Ternary expressions -->
<p>Status: {{user.age >= 18 ? 'Adult' : 'Minor'}}</p>
<p>Theme mode: {{user.preferences.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}}</p>

<!-- ✅ Computed properties for complex logic -->
<p>Total items: {{itemCount}}</p>
<p>Completed todos: {{completedTodosCount}}</p>
```

### Deep Reactivity

WakaPAC automatically tracks changes in nested objects and arrays:

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
        // ✅ Array mutations are automatically reactive
        this.todos.push({
            id: Date.now(),
            text: 'New todo',
            completed: false
        });
    },

    toggleTodo(index) {
        // ✅ Deep nested changes are reactive
        this.todos[index].completed = !this.todos[index].completed;
    },

    updateTheme(newTheme) {
        // ✅ Deep nested property changes are reactive
        this.user.preferences.theme = newTheme;
    }
});
```

### Basic Attribute Binding

Use `data-pac-bind` to bind data to element attributes:

```html
<!-- Two-way data binding -->
<input type="text" data-pac-bind="value:name">
<textarea data-pac-bind="value:description"></textarea>
<select data-pac-bind="value:category">
    <option value="A">Category A</option>
    <option value="B">Category B</option>
</select>

<!-- Checkbox binding -->
<input type="checkbox" data-pac-bind="checked:isActive">

<!-- Simple attribute binding -->
<div data-pac-bind="class:statusClass,title:statusText"></div>

<!-- Visibility binding -->
<div data-pac-bind="visible:showDetails">Details here</div>
<div data-pac-bind="visible:!hideContent">Content</div>

<!-- Enable/Disable controls -->
<button data-pac-bind="enable:isFormValid">Submit</button>
<input data-pac-bind="enable:!isReadOnly" type="text">
```

### Enable/Disable Binding

The `enable` binding provides an intuitive way to control whether form elements are enabled or disabled:

```html
<!-- ✅ Enable button when form is valid -->
<button data-pac-bind="enable:isFormValid">Submit</button>

<!-- ✅ Disable input when in read-only mode -->
<input data-pac-bind="enable:!isReadOnly" type="text" placeholder="Enter data">

<!-- ✅ Enable select when user has permission -->
<select data-pac-bind="enable:hasEditPermission">
    <option>Option 1</option>
    <option>Option 2</option>
</select>

<!-- ✅ Complex expressions -->
<button data-pac-bind="enable:user.isAdmin && !isLoading">Admin Action</button>
```

```javascript
wakaPAC('#form-app', {
    isFormValid: false,
    isReadOnly: false,
    hasEditPermission: true,
    isLoading: false,
    user: { isAdmin: true },

    validateForm() {
        // Update form validity
        this.isFormValid = this.name && this.email && this.password;
    },

    toggleReadOnly() {
        this.isReadOnly = !this.isReadOnly;
    }
});
```

**How `enable` works:**
- When the bound expression is `true`, the element is enabled (no `disabled` attribute)
- When the bound expression is `false`, the element is disabled (`disabled="disabled"`)
- The `enable` binding is the logical opposite of the `disabled` attribute
- Works with all form elements: `<input>`, `<button>`, `<select>`, `<textarea>`

### Conditional Attribute Binding

WakaPAC supports powerful conditional expressions directly in attribute bindings:

```html
<!-- ✅ Conditional classes -->
<div data-pac-bind="class:isActive ? 'btn-primary' : 'btn-secondary'">Button</div>

<!-- ✅ Multiple conditions -->
<button data-pac-bind="disabled:loading || !isValid">Submit</button>

<!-- ✅ Complex expressions -->
<div data-pac-bind="class:user.role === 'admin' && user.isActive ? 'admin-panel' : 'user-panel'">
    Panel
</div>

<!-- ✅ Dynamic styles -->
<div data-pac-bind="style:theme === 'dark' ? 'background: #333; color: white' : 'background: white; color: black'">
    Content
</div>
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

## ⚡ Event Handling

### Basic Events

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

Reduce boilerplate with declarative event modifiers:

```html
<!-- ✅ Prevent form submission redirect -->
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent">

    <!-- ✅ Search on Enter key -->
    <input data-pac-bind="keyup:search" data-pac-modifiers="enter">

    <!-- ✅ Close modal on Escape -->
    <div data-pac-bind="keyup:closeModal" data-pac-modifiers="escape">

        <!-- ✅ One-time event (auto-removes after first trigger) -->
        <button data-pac-bind="click:initialize" data-pac-modifiers="once">

            <!-- ✅ Multiple modifiers -->
            <form data-pac-bind="submit:handleForm" data-pac-modifiers="prevent stop">
```

#### Supported Event Modifiers:

**Key Modifiers:**
- `enter`, `escape`/`esc`, `space`, `tab`
- `delete`/`del`, `up`, `down`, `left`, `right`

**Behavior Modifiers:**
- `prevent` - Calls `event.preventDefault()`
- `stop` - Calls `event.stopPropagation()`
- `once` - Removes the event listener after first execution

### Event Handler Signatures

**Regular elements:** `handler(event)`
```javascript
handleClick(event) {
    console.log('Clicked');
}
```

**Inside foreach loops:** `handler(item, index, event)`
```javascript
toggleTodo(todo, index, event) {
    todo.completed = !todo.completed;
}
```

### Supported Events

- `click`, `submit`, `change`, `input`
- `focus`, `blur`
- `keyup`, `keydown`

## 🧮 Computed Properties

Computed properties automatically recalculate when their dependencies change:

```javascript
const app = wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    items: [{price: 10}, {price: 20}, {price: 15}],

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
            return `Hello, ${this.fullName}! Your total is $${this.totalPrice}`;
        }
    }
});
```

### Automatic Dependency Tracking

The library automatically analyzes computed functions to determine dependencies:

```javascript
computed: {
    expensiveItems() {
        // Automatically depends on 'items' property
        return this.items.filter(item => item.price > 15);
    },

    summary() {
        // Depends on multiple properties and computed properties
        return `${this.fullName} has ${this.expensiveItems.length} expensive items`;
    }
}
```

## 🔧 Update Modes

Control when form inputs update your data model:

### Immediate Mode (Default)
Updates on every keystroke:
```html
<input type="text" data-pac-bind="value:name">
```

### Change Mode
Updates only when input loses focus:
```html
<input type="text" data-pac-bind="value:name" data-pac-update-mode="change">
```

### Delayed Mode
Updates after specified delay (debounced):
```html
<input type="text" data-pac-bind="value:searchQuery"
       data-pac-update-mode="delayed" data-pac-update-delay="500">
```

### Global Configuration
```javascript
const app = wakaPAC('#app', {
    name: 'John'
}, {
    updateMode: 'delayed',
    delay: 300
});
```

## 📋 Arrays and For-Each Binding

Display dynamic lists with the `foreach` binding:

```html
<div data-pac-bind="foreach:todos" data-pac-item="todo" data-pac-index="index">
    <div class="todo-item">
        <span>{{index}}. {{todo.text}}</span>
        <input type="checkbox" data-pac-bind="checked:todo.completed">
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

    computed: {
        todoCount() {
            return this.todos.length;
        },

        completedCount() {
            return this.todos.filter(todo => todo.completed).length;
        }
    },

    // Event handlers receive item, index, and event
    removeTodo(todo, index, event) {
        const todoIndex = this.todos.findIndex(t => t.id === todo.id);
        if (todoIndex !== -1) {
            this.todos.splice(todoIndex, 1);
        }
    }
});
```

### Foreach Callbacks

Execute custom logic whenever a foreach list is updated using the `then` syntax:

```html
<!-- Basic callback after list updates -->
<ul data-pac-bind="foreach:todos then onTodosUpdated" data-pac-item="todo">
    <li>{{todo.text}}</li>
</ul>

<!-- Select dropdown with callback -->
<select data-pac-bind="value:selectedCountry,foreach:countries then onCountriesRendered" 
        data-pac-item="country">
    <option data-pac-bind="value:country.code">{{country.name}}</option>
</select>

<!-- Complex list with status tracking -->
<div data-pac-bind="foreach:products then onProductsUpdated" data-pac-item="product" data-pac-index="i">
    <div class="product-card">
        <h3>{{product.name}}</h3>
        <p>Price: ${{product.price}}</p>
    </div>
</div>
```

```javascript
const app = wakaPAC('#app', {
    todos: [],
    countries: [],
    products: [],
    selectedCountry: '',
    status: 'Ready',
    
    // Callback receives: (currentArray, metadata)
    onTodosUpdated(todos, meta) {
        this.status = `Todo list updated with ${todos.length} items`;
        console.log('Todos changed:', meta);
        
        // Scroll to top when list changes significantly
        if (meta.element) {
            meta.element.scrollTop = 0;
        }
    },
    
    onCountriesRendered(countries, meta) {
        // Auto-select first country if none selected
        if (!this.selectedCountry && countries.length > 0) {
            this.selectedCountry = countries[0].code;
        }
        
        console.log(`Rendered ${countries.length} countries`);
    },
    
    onProductsUpdated(products, meta) {
        // Track analytics when product list changes
        this.trackEvent('products_displayed', { 
            count: products.length,
            timestamp: Date.now()
        });
    },
    
    addTodo() {
        this.todos.push({
            text: 'New todo',
            completed: false
        });
        // onTodosUpdated will be called automatically
    }
});
```

**Callback Metadata Object:**
The callback receives a metadata object with:
- `element`: The DOM element containing the foreach list
- `previous`: The previous array state (for comparison)
- `current`: The current array state (same as first parameter)
- `binding`: The internal binding object

**Use Cases for Foreach Callbacks:**
- **State synchronization**: Update related properties when lists change
- **UI management**: Scroll to top, focus elements, or animate changes
- **Validation**: Ensure dependent data remains valid when lists update
- **Analytics**: Track user interactions with dynamic lists
- **Performance**: Optimize rendering for large lists
- **Selection management**: Auto-select items in dropdowns when options change

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

## 🌐 Server Communication

Built-in fetch wrapper with PAC-specific features:

```javascript
const app = wakaPAC('#app', {
    user: null,
    loading: false,
    error: null,
    
    async loadUser() {
        this.loading = true;
        this.error = null;
        
        try {
            const userData = await this.control('/api/user', {
                method: 'GET',
                onSuccess: (data) => {
                    this.user = data;
                    console.log('User loaded:', data);
                },
                onError: (error) => {
                    this.error = error.message;
                    console.error('Failed to load user:', error);
                }
            });
        } catch (error) {
            this.error = error.message;
        } finally {
            this.loading = false;
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

## 🔍 DOM Value Reading

WakaPAC provides a convenient method to read values from DOM elements:

### Basic Usage

```javascript
const app = wakaPAC('#app', {
    validateForm() {
        // Read current values from form inputs
        const email = this.readDOMValue('#email-input');
        const agreeToTerms = this.readDOMValue('#terms-checkbox');
        
        return email.includes('@') && agreeToTerms;
    }
});
```

### Supported Input Types

```html
<!-- Text inputs (returns string) -->
<input id="username" type="text">
<textarea id="message"></textarea>

<!-- Checkboxes (returns boolean) -->
<input id="newsletter" type="checkbox">

<!-- Radio buttons (returns selected value) -->
<input name="gender" type="radio" value="male">
<input name="gender" type="radio" value="female">

<!-- Select dropdowns (returns selected value) -->
<select id="country">
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
</select>
```

**Return Value Types:**
- **Text inputs, textareas, selects**: Returns `string` value
- **Checkboxes**: Returns `boolean` (true if checked, false if unchecked)
- **Radio buttons**: Returns `string` value of the checked option, or empty string if none checked
- **Other elements**: Returns `textContent` or `innerText` as `string`

## 📋 API Reference

### Creating a PAC Component

```javascript
const component = wakaPAC(selector, abstraction, options);
```

**Parameters:**
- **selector** `{string}`: CSS selector for the container element
- **abstraction** `{object}`: Object containing properties, methods, and computed properties
- **options** `{object}`: Configuration object (optional)

### Template Syntax Reference

```html
<!-- Text interpolation -->
<span>Welcome {{userName}}!</span>
<span>Status: {{status === 'active' ? 'Online' : 'Offline'}}</span>

<!-- Conditional rendering -->
<div data-pac-bind="visible:isLoggedIn">User dashboard</div>
<div data-pac-bind="visible:!isLoggedIn">Please log in</div>

<!-- Event binding -->
<button data-pac-bind="click:handleLogin" data-pac-modifiers="once">Login</button>
<form data-pac-bind="submit:handleSubmit" data-pac-modifiers="prevent">...</form>

<!-- Input binding -->
<input data-pac-bind="value:email" type="email">
<textarea data-pac-bind="value:message"></textarea>

<!-- Conditional attributes -->
<div data-pac-bind="class:isActive ? 'btn-primary' : 'btn-secondary'">Button</div>
<button data-pac-bind="disabled:loading || !isValid">Submit</button>
<button data-pac-bind="enable:isFormValid && !isSubmitting">Submit</button>

<!-- List rendering -->
<div data-pac-bind="foreach:items" data-pac-item="item" data-pac-index="index">
    <span>{{index}}: {{item.name}}</span>
</div>

<!-- List rendering with callback -->
<div data-pac-bind="foreach:items then onItemsUpdated" data-pac-item="item" data-pac-index="index">
    <span>{{index}}: {{item.name}}</span>
</div>
```

### Core Methods

#### Communication
- `notifyParent(type, data)`: Send notification to parent
- `sendToChildren(command, data)`: Send command to all children
- `sendToChild(selector, command, data)`: Send command to specific child

#### Hierarchy Management
- `addChild(childPAC)`: Manually add a child
- `removeChild(childPAC)`: Remove a child
- `findChild(predicate)`: Find child matching predicate
- `findChildren(predicate)`: Find all children matching predicate

#### DOM Interaction
- `readDOMValue(selector)`: Read current value from DOM element
- `control(url, options)`: Built-in fetch wrapper

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

## 🎯 Browser Support

WakaPAC supports:
- **Modern browsers**: Chrome, Firefox, Safari, Edge (ES6 Proxy support)
- **Legacy browsers**: IE11+ (with fallback reactivity using Object.defineProperty)

The library automatically detects Proxy support and falls back gracefully.

## 🔄 Migration Guide

### From Vue.js
```html
<!-- Vue -->
<div>{{ message }}</div>
<input v-model="name">
<button @click="handleClick">Click</button>
<div v-if="isVisible">Content</div>

<!-- WakaPAC -->
<div>{{message}}</div>
<input data-pac-bind="value:name">
<button data-pac-bind="click:handleClick">Click</button>
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
        this.count++; // Direct assignment, no setState needed
    }
});
```

### From Knockout.js
```javascript
// Knockout
const viewModel = {
    firstName: ko.observable('John'),
    lastName: ko.observable('Doe'),
    fullName: ko.computed(function() {
        return this.firstName() + ' ' + this.lastName();
    })
};

// WakaPAC
wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    computed: {
        fullName() {
            return this.firstName + ' ' + this.lastName;
        }
    }
});
```

## 🎯 Why Choose WakaPAC?

**Choose WakaPAC when you want:**
- **Zero build complexity** - Start building immediately without webpack, vite, or any toolchain
- **Modern reactivity** - Get Vue/React-level reactivity with simpler mental models
- **Expressive templates** - Write conditions directly in templates without bloating your component logic
- **Architectural clarity** - PAC pattern provides better separation of concerns than MVC
- **Performance by default** - Direct DOM manipulation with intelligent batching
- **Progressive enhancement** - Drop into existing projects without rewriting everything
- **Component hierarchy** - Build complex applications with parent-child communication

**WakaPAC excels at:**
- **Complex single-page applications** with clean architecture
- **Dashboard and admin interfaces** with rich interactivity
- **Data-heavy applications** that benefit from reactive binding
- **Real-time applications** where performance matters
- **Enterprise applications** that need maintainable code structure
- **Rapid prototyping** when you need to move fast
- **Legacy modernization** where you can't start from scratch

**Consider other tools for:**
- **Server-side rendering** (add a backend framework like Next.js/Nuxt)
- **Mobile app development** (use React Native/Flutter alongside WakaPAC for web)
- **Massive teams** requiring extensive TypeScript tooling (though WakaPAC works with TypeScript)

## 📄 License

WakaPAC is released under the **MIT License**