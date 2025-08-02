# WakaPAC Framework

A powerful reactive JavaScript framework implementing the PAC (Presentation-Abstraction-Control) architectural pattern.
WakaPAC creates hierarchical components with two-way data binding, event handling, and automatic DOM synchronization
while working seamlessly with vanilla HTML and JavaScript.

## Features

### 🔄 **Reactive Data Binding**
- Automatic DOM updates when JavaScript object properties change
- Two-way binding between form inputs and data properties
- Intelligent change detection with batched DOM updates

### 🎯 **Template Syntax**
- Simple `{{propertyName}}` syntax for dynamic content in HTML
- Support for computed properties with automatic dependency tracking
- Conditional rendering with `data-pac-bind="visible:property"`

### ⚡ **Event Handling**
- Declarative event binding via data attributes
- Method binding with `data-pac-bind="click:methodName"`
- Automatic event delegation for performance

### 🏗️ **Hierarchical Components**
- Parent-child relationships with automatic communication
- Component nesting with proper lifecycle management
- Inter-component messaging system

### 🚀 **Performance Optimized**
- Batched DOM updates using `requestAnimationFrame`
- Intelligent caching of computed properties
- Event delegation to minimize memory usage

### 🔧 **Flexible Update Modes**
- **Immediate**: Updates happen instantly on input
- **Delayed**: Debounced updates with configurable delay
- **Change**: Updates only on blur/change events

## Quick Start

### Basic Setup

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
    </div>

    <script>
        wakaPAC('#my-app', {
            firstName: 'John',
            lastName: 'Doe',
            count: 0,
            showMessage: true,
            
            computed: {
                fullName() {
                    return this.firstName + ' ' + this.lastName;
                },
                doubleCount() {
                    return this.count * 2;
                }
            },
            
            increment() {
                this.count++;
                if (this.count > 5) {
                    this.showMessage = false;
                }
            }
        });
    </script>
</body>
</html>
```

## Core Concepts

### Creating a PAC Component

```javascript
const component = wakaPAC(selector, abstraction, options);
```

- **selector**: CSS selector for the container element
- **abstraction**: Object containing properties, methods, and computed properties
- **options**: Configuration object (optional)

### Template Syntax

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
```

### Computed Properties

Computed properties automatically recalculate when their dependencies change:

```javascript
wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    
    computed: {
        fullName() {
            return `${this.firstName} ${this.lastName}`;
        },
        
        displayName() {
            return this.fullName || this.email;
        },
        
        initials() {
            return this.firstName.charAt(0) + this.lastName.charAt(0);
        }
    }
});
```

### Update Modes

Control how and when form inputs update your data:

```html
<!-- Immediate updates (default) -->
<input data-pac-bind="search" data-pac-update="immediate">

<!-- Delayed updates with debouncing -->
<input data-pac-bind="search" data-pac-update="delayed" data-pac-delay="500">

<!-- Update only on blur/change -->
<input data-pac-bind="email" data-pac-update="change">
```

## Advanced Features

### Hierarchical Components

```javascript
// Parent component
const parent = wakaPAC('#parent', {
    parentData: 'Hello from parent',
    
    onChildUpdate(eventType, data, childPAC) {
        console.log('Child updated:', eventType, data);
    }
});

// Child component
const child = wakaPAC('#child', {
    childData: 'Hello from child',
    
    notifyParent() {
        this.notifyParent('customEvent', { message: 'Hello parent!' });
    }
});
```

### Server Communication

```javascript
wakaPAC('#user-profile', {
    user: { name: '', email: '' },
    loading: false,
    error: null,
    
    async loadUser() {
        this.loading = true;
        this.error = null;
        
        try {
            await this.control('/api/user', {
                method: 'GET',
                updateProperties: true, // Auto-sync response with component
                onSuccess(data) {
                    console.log('User loaded:', data);
                },
                onError(error) {
                    this.error = 'Failed to load user';
                }
            });
        } finally {
            this.loading = false;
        }
    },
    
    async saveUser() {
        await this.control('/api/user', {
            method: 'POST',
            data: this.user,
            updateProperties: true
        });
    }
});
```

### Component Communication

```javascript
// Components can communicate through parent-child relationships
const parentComponent = wakaPAC('#parent', {
    sharedData: 'Initial value',
    
    updateSharedData(newValue) {
        this.sharedData = newValue;
        // All child components automatically receive updates
    },
    
    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'dataRequest') {
            // Send data to requesting child
            childPAC.receiveUpdate('dataResponse', this.sharedData, this);
        }
    }
});
```

## Configuration Options

```javascript
wakaPAC('#component', {
    // ... abstraction properties
}, {
    updateMode: 'immediate', // 'immediate', 'delayed', or 'change'
    delay: 300              // Delay in milliseconds for 'delayed' mode
});
```

## API Reference

### Component Instance Methods

```javascript
const component = wakaPAC('#app', { /* ... */ });

// Hierarchy management
component.addChild(childComponent);
component.removeChild(childComponent);

// Communication
component.notifyParent('eventType', data);

// Server communication
component.control('/api/endpoint', options);

// Cleanup
component.destroy();

// Properties (read-only)
component.parent    // Parent component reference
component.children  // Array of child components
component.container // DOM container element
```

### Event Types

The framework supports all standard DOM events:

- `click`, `submit`, `change`, `input`
- `focus`, `blur`, `keyup`, `keydown`
- And any other standard DOM event

## Browser Support

WakaPAC works in all modern browsers that support:
- ES5 (IE9+)
- `requestAnimationFrame`
- `querySelector`/`querySelectorAll`
- `Object.defineProperty`

## Performance Tips

1. **Use computed properties** for derived values instead of calculating in templates
2. **Prefer `change` update mode** for non-critical form inputs to reduce updates
3. **Batch property updates** when possible to minimize DOM updates
4. **Destroy components** when no longer needed to prevent memory leaks

## Examples

### Todo List

```javascript
wakaPAC('#todo-app', {
    newTodo: '',
    todos: [],
    filter: 'all', // 'all', 'active', 'completed'
    
    computed: {
        filteredTodos() {
            if (this.filter === 'active') {
                return this.todos.filter(todo => !todo.completed);
            } else if (this.filter === 'completed') {
                return this.todos.filter(todo => todo.completed);
            }
            return this.todos;
        },
        
        activeCount() {
            return this.todos.filter(todo => !todo.completed).length;
        }
    },
    
    addTodo() {
        if (this.newTodo.trim()) {
            this.todos.push({
                id: Date.now(),
                text: this.newTodo.trim(),
                completed: false
            });
            this.newTodo = '';
        }
    },
    
    toggleTodo(todo) {
        todo.completed = !todo.completed;
    },
    
    removeTodo(todoId) {
        this.todos = this.todos.filter(todo => todo.id !== todoId);
    }
});
```

### Form Validation

```javascript
wakaPAC('#signup-form', {
    email: '',
    password: '',
    confirmPassword: '',
    
    computed: {
        isValidEmail() {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
        },
        
        isValidPassword() {
            return this.password.length >= 8;
        },
        
        passwordsMatch() {
            return this.password === this.confirmPassword;
        },
        
        isFormValid() {
            return this.isValidEmail && this.isValidPassword && this.passwordsMatch;
        }
    },
    
    async submitForm() {
        if (this.isFormValid) {
            await this.control('/api/signup', {
                method: 'POST',
                data: {
                    email: this.email,
                    password: this.password
                }
            });
        }
    }
});
```

## License

This framework is provided as-is for educational and development purposes. Check the source file for specific licensing terms.