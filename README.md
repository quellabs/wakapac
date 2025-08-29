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

## PAC Architecture

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

## Complete Binding Reference

WakaPAC provides comprehensive data binding capabilities through the `data-pac-bind` attribute. Here's the complete list of supported binding types:

### Form Input Bindings

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

### Display Control Bindings

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

### Attribute Bindings

**`enable`** - Enable/disable form controls (reverse of disabled)
```html
<button data-pac-bind="enable: isFormValid">Submit</button>
<input data-pac-bind="enable: !isReadonly">
```

### Style and Appearance Bindings

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

### List Rendering Binding

**`foreach`** - Render lists with templates
```html
<div data-pac-bind="foreach: items" data-pac-item="item" data-pac-index="index">
    <div class="item">
        <span>{{index}}. {{item.name}}</span>
        <button data-pac-bind="click: removeItem">Remove</button>
    </div>
</div>
```

### Event Bindings

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
<input data-pac-bind="keyup: handleKey" data-pac-modifiers="enter">
<input data-pac-bind="keydown: handleKeyDown" data-pac-modifiers="escape">
```

### Advanced Binding Syntax

WakaPAC supports **object syntax** for certain binding types, allowing you to bind multiple values or create conditional bindings in a single expression.

#### Supported Object Syntax Bindings

| Binding Type | Object Syntax | Example                                                         |
|--------------|---------------|-----------------------------------------------------------------|
| **`class`**  | ✅ Yes         | `class: { active: isActive, disabled: !enabled }`               |
| **`style`**  | ✅ Yes         | `style: { color: 'red', backgroundColor: 'blue' }`              |
| All others   | ❌ No          | Use direct binding: `title: tooltipText, placeholder: hintText` |

#### Class Binding Examples

```html
<!-- Object syntax: multiple conditional classes -->
<div data-pac-bind="class: { active: isActive, disabled: !enabled, error: hasError }">

<!-- Simple string class binding -->
<div data-pac-bind="class: dynamicClassName">

<!-- Multiple class bindings -->
<div data-pac-bind="class: baseClass, class: conditionalClass">
```

```javascript
wakaPAC('#app', {
    isActive: true,
    enabled: false,
    hasError: false,
    baseClass: 'btn',
    conditionalClass: 'btn-primary',

    // Result: class="btn active disabled"
    // The 'active' class is applied because isActive is true
    // The 'disabled' class is applied because !enabled is true 
    // The 'error' class is NOT applied because hasError is false
});
```

#### Style Binding Examples

```html
<!-- Object syntax: multiple CSS properties -->
<div data-pac-bind="style: { color: textColor, backgroundColor: bgColor }">

<!-- CSS custom properties -->
<div data-pac-bind="style: { '--theme-color': primaryColor, '--border-width': borderSize }">

<!-- Simple string style binding -->
<div data-pac-bind="style: inlineStyleString">

<!-- Computed styles -->
<div data-pac-bind="style: computedStyles">
```

```javascript
wakaPAC('#app', {
    textColor: 'red',
    bgColor: 'lightblue',
    primaryColor: '#007bff',
    borderSize: '3px',
    showElement: true,
    inlineStyleString: 'font-weight: bold; margin: 10px;',

    computed: {
        computedStyles() {
            return {
                backgroundColor: this.isActive ? '#f0f0f0' : 'white',
                opacity: this.loading ? 0.5 : 1,
                transform: this.zoom > 1 ? 'scale(' + this.zoom + ')' : 'none',
                // CSS custom properties work in computed styles too
                '--dynamic-size': this.itemSize + 'px'
            };
        }
    }
});
```

#### Attribute Binding Examples

Since WakaPAC supports direct attribute binding, you can bind any HTML attribute directly without needing a special `attr:` syntax:

```html
<!-- Standard HTML attributes -->
<input data-pac-bind="placeholder: dynamicPlaceholder, title: helpText, maxlength: fieldLimit">
<img data-pac-bind="src: imageSource, alt: imageDescription, width: imageWidth">
<a data-pac-bind="href: linkUrl, target: linkTarget">

<!-- Data attributes -->
<div data-pac-bind="data-user-id: userId, data-role: userRole, data-category: itemType">

<!-- ARIA accessibility attributes -->
<button data-pac-bind="aria-label: buttonLabel, aria-expanded: menuOpen, aria-disabled: !isEnabled">

<!-- Form attributes -->
<input data-pac-bind="required: isRequired, readonly: !canEdit, min: minValue, max: maxValue">
```

```javascript
wakaPAC('#form', {
    dynamicPlaceholder: 'Enter your name here',
    helpText: 'This field is required for registration',
    fieldLimit: 50,
    imageSource: '/uploads/profile.jpg',
    imageDescription: 'User profile photo',
    linkUrl: 'https://example.com',
    linkTarget: '_blank',
    userId: 'user-12345',
    userRole: 'admin',
    isEnabled: true,
    isRequired: true,
    canEdit: false
});
```

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

<!-- Browser properties -->
<p>Viewport: {{browserViewportWidth}} x {{browserViewportHeight}}</p>
<p data-pac-bind="visible:!browserVisible">Tab is hidden - updates paused</p>

<!-- Container viewport properties -->
<p>Container is {{containerVisible ? 'visible' : 'hidden'}} in viewport</p>
<p>Container bounds: {{containerClientRect.left}}, {{containerClientRect.top}}</p>
```

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
<button data-pac-bind="click: handleClick">Click me</button>
<form data-pac-bind="submit: handleSubmit">
    <input data-pac-bind="value: searchQuery">
    <button type="submit">Search</button>
</form>
<input data-pac-bind="input: handleInput,focus: handleFocus">
```

### Event Modifiers

```html
<!-- Prevent form submission redirect -->
<form data-pac-bind="submit: handleSubmit" data-pac-modifiers="prevent">

    <!-- Search on Enter key -->
    <input data-pac-bind="keyup: search" data-pac-modifiers="enter">

    <!-- Close modal on Escape -->
    <div data-pac-bind="keyup: closeModal" data-pac-modifiers="escape">

        <!-- One-time event -->
        <button data-pac-bind="click: initialize" data-pac-modifiers="once">

            <!-- Multiple modifiers -->
            <form data-pac-bind="submit: handleForm" data-pac-modifiers="prevent stop">
```

**Available modifiers:**
- **Keys**: `enter`, `escape`/`esc`, `space`, `tab`, `delete`/`del`, `up`, `down`, `left`, `right`
- **Behavior**: `prevent`, `stop`, `once`

## Lists and For-Each

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

## Computed Properties

Computed properties automatically recalculate when their dependencies change. Use them when you need a **derived value** that depends on other reactive properties.

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
            return `Hello, ${this.fullName}! Total: ${this.totalPrice}`;
        },

        // Complex computed property with conditional logic
        shippingCost() {
            return this.totalPrice > 50 ? 0 : 9.99;
        }
    }
});
```

**Key characteristics:**
- **Pure functions**: Should not have side effects
- **Cached**: Only recalculate when dependencies change
- **Return values**: Used in templates and other expressions
- **Declarative**: Define what the value should be, not how to calculate it

# Watchers

Watchers execute code when reactive properties change. Use them when you need to **perform side effects** in response to data changes.

## Simple Property Watchers

Basic watchers monitor changes to individual properties on your component:

```javascript
wakaPAC('#app', {
    searchQuery: '',
    count: 0,
    username: '',
    isActive: false,

    watch: {
        // Watch a simple string property
        searchQuery: function(newValue, oldValue) {
            if (newValue.length > 2) {
                this.performSearch(newValue);
            }
        },

        // Watch a number property with multiple side effects
        count: function(newCount, oldCount) {
            if (newCount > 10) {
                this.showWarning = true;
            }

            if (newCount % 5 === 0) {
                this.saveProgress();
            }
        },

        // Watch boolean property changes
        isActive: function(isNowActive) {
            if (isNowActive) {
                this.startBackgroundSync();
            } else {
                this.stopBackgroundSync();
            }
        }
    }
});
```

## Deep Reactivity Watchers

WakaPAC also supports **deep property watchers** that can observe changes in nested objects and arrays using powerful pattern matching. This lets you watch for changes deep within your data structure without having to set up individual watchers for every nested property.

### Watching Nested Objects

```javascript
wakaPAC('#app', {
    user: {
        profile: {
            name: 'John',
            email: 'john@example.com'
        },
        settings: {
            theme: 'dark',
            notifications: true
        }
    },

    watch: {
        // Watch specific nested property
        'user.profile.name': function(newName, oldName, fullPath) {
            console.log('Name changed from ' + oldName + ' to ' + newName);
            console.log('Full path: ' + fullPath); // "user.profile.name"
            this.updateDisplayName();
        },

        // Watch any change to user.settings using wildcard
        'user.settings.*': function(newValue, oldValue, fullPath) {
            console.log('Settings changed at ' + fullPath);
            this.saveUserSettings();
        },

        // Watch ANY change anywhere in user object
        'user.**': function(newValue, oldValue, fullPath) {
            console.log('User data changed at: ' + fullPath);
            this.markUserAsModified();
        }
    }
});
```

### Watching Arrays

```javascript
wakaPAC('#todo-app', {
    todos: [
        {id: 1, text: 'Learn WakaPAC', completed: false},
        {id: 2, text: 'Build an app', completed: true}
    ],

    watch: {
        // Watch when any todo's completed status changes
        'todos.*.completed': function(newValue, oldValue, fullPath) {
            console.log('Todo completion changed: ' + fullPath + ' = ' + newValue);
            // fullPath will be something like "todos.0.completed"
            
            this.updateTodoCount();
            this.saveToLocalStorage();
        },

        // Watch any change to any todo property
        'todos.*.*': function(newValue, oldValue, fullPath) {
            console.log('Todo property changed: ' + fullPath);
            this.markAsModified();
        }
    },

    updateTodoCount: function() {
        const completed = this.todos.filter(function(t) { 
            return t.completed; 
        }).length;
        
        console.log(completed + ' of ' + this.todos.length + ' todos completed');
    }
});
```

## Pattern Reference

| Pattern        | Matches                       | Example                                                 |
|----------------|-------------------------------|---------------------------------------------------------|
| `property`     | Direct property changes       | `'name'` → `obj.name = 'new'`                           |
| `obj.property` | Specific nested property      | `'user.name'` → `obj.user.name = 'new'`                 |
| `obj.*`        | Any direct child of obj       | `'user.*'` → `obj.user.anything = 'new'`                |
| `obj.**`       | Any nested change in obj      | `'user.**'` → `obj.user.deep.nested = 'new'`            |
| `arr.*.prop`   | Property in any array element | `'todos.*.completed'` → `obj.todos[0].completed = true` |

## Watchers vs Computed Properties

| Feature          | Computed Properties                | Watchers                               |
|------------------|------------------------------------|----------------------------------------|
| **Purpose**      | Calculate derived values           | Perform side effects                   |
| **Return value** | Always returns a value             | No return value needed                 |
| **Side effects** | Should avoid side effects          | Designed for side effects              |
| **Usage**        | Use in templates: `{{computed}}`   | Execute code when data changes         |
| **When to use**  | Need a value based on other values | Need to do something when data changes |

## Data Safety and Display Utilities

WakaPAC provides built-in utility functions to help you safely handle and display data. These functions are available on all component instances and help prevent XSS attacks while providing consistent data formatting.

### HTML Security Functions

#### `escapeHTML(str)`
Converts HTML special characters to their safe HTML entity equivalents to prevent XSS attacks.

```javascript
wakaPAC('#app', {
    userInput: '<script>alert("hack")</script>',
    safeComment: '',

    saveComment() {
        // Escape user input before storing or displaying
        this.safeComment = this.escapeHTML(this.userInput);
        // Result: "&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;"
    },

    computed: {
        safeTitle() {
            // Use in computed properties for safe dynamic content
            return this.escapeHTML(this.user.title);
        }
    }
});
```

**What gets escaped:**
- `<` becomes `&lt;`
- `>` becomes `&gt;`
- `&` becomes `&amp;`
- `"` becomes `&quot;`
- `'` becomes `&#39;`

**When to use:**
- Before displaying user-generated content in HTML
- When building dynamic HTML strings
- Before setting innerHTML with user data
- In computed properties that generate safe HTML

#### `sanitizeUserInput(html)`
Strips all HTML tags from user input and returns escaped plain text.

```javascript
wakaPAC('#app', {
    userBio: '<p>Hello <strong>world</strong>!</p><script>alert("xss")</script>',
    cleanBio: '',

    cleanUserBio() {
        // Strip all HTML tags and get safe plain text
        this.cleanBio = this.sanitizeUserInput(this.userBio);
        // Result: "Hello world!"
    },

    processComment(comment) {
        // Clean user comments before storage
        const cleaned = this.sanitizeUserInput(comment);
        
        this.comments.push({
            text: cleaned,
            timestamp: new Date()
        });
    }
});
```

**What it does:**
1. Removes all HTML tags (`<p>`, `<script>`, `<div>`, etc.)
2. Extracts plain text content only
3. Escapes any remaining special characters
4. Returns safe text suitable for display

**When to use:**
- Processing user comments or posts
- Cleaning pasted content from rich text editors
- Before saving user input to databases
- When you want plain text only, no HTML formatting

### Data Display Function

#### `formatValue(value)`
Intelligently formats any value for display in templates or UI components.

```javascript
wakaPAC('#app', {
    data: {
        name: 'John',
        age: null,
        scores: [95, 87, 92],
        profile: { city: 'New York', country: 'USA' },
        isActive: true
    },

    showData() {
        // Format different types of values
        console.log(this.formatValue(this.data.name));    // "John"
        console.log(this.formatValue(this.data.age));     // ""
        console.log(this.formatValue(this.data.scores));  // "[3 items]"
        console.log(this.formatValue(this.data.profile)); // JSON formatted object
        console.log(this.formatValue(this.data.isActive)); // "true"
    },

    computed: {
        displayItems() {
            return this.items.map(item => ({
                ...item,
                // Format complex values for display
                formattedData: this.formatValue(item.complexData)
            }));
        }
    }
});
```

**Formatting rules:**
- **`null`/`undefined`**: Returns empty string `""`
- **Strings/Numbers/Booleans**: Converts to string representation
- **Arrays**: Returns `"[X items]"` format for easy scanning
- **Objects**: Returns formatted JSON for debugging/display
- **Functions**: Returns function name or `"[Function]"`

**When to use:**
- In templates when you're not sure of the data type: `{{formatValue(dynamicData)}}`
- For debugging output in development
- When displaying API responses of unknown structure
- In admin interfaces showing database records

### Practical Examples

#### Safe User Profile Display
```html
<div id="profile">
    <h2>{{safeDisplayName}}</h2>
    <p class="bio">{{safeBio}}</p>
    <div class="debug">Raw data: {{formattedRawData}}</div>
</div>
```

```javascript
wakaPAC('#profile', {
    displayName: 'John "The Rock" <strong>Doe</strong>',
    bio: '<p>I love <script>coding</script> and hiking!</p>',
    rawData: { preferences: ['hiking', 'coding'], score: 95 },

    computed: {
        safeDisplayName() {
            return this.escapeHTML(this.displayName);
        },

        safeBio() {
            return this.sanitizeUserInput(this.bio);
        },

        formattedRawData() {
            return this.formatValue(this.rawData);
        }
    }
});
```

#### Comment System with Safety
```javascript
wakaPAC('#comments', {
    comments: [],
    newComment: '',

    addComment() {
        if (this.newComment.trim()) {
            this.comments.push({
                id: Date.now(),
                text: this.sanitizeUserInput(this.newComment), // Strip HTML, keep text
                author: this.escapeHTML(this.currentUser.name), // Escape for display
                timestamp: new Date(),
                raw: this.formatValue(this.newComment) // For debugging
            });
            
            this.newComment = '';
        }
    }
});
```

#### API Response Display
```javascript
wakaPAC('#api-explorer', {
    response: null,
    loading: false,

    async callAPI(endpoint) {
        this.loading = true;
        
        try {
            this.response = await fetch(endpoint).then(r => r.json());
        } catch (error) {
            this.response = { error: error.message };
        } finally {
            this.loading = false;
        }
    },

    computed: {
        formattedResponse() {
            // Use formatValue to display any type of API response
            return this.formatValue(this.response);
        }
    }
});
```

#### Form Validation with Safe Display
```javascript
wakaPAC('#registration', {
    form: {
        username: '',
        bio: ''
    },
    errors: [],

    validateForm() {
        this.errors = [];
        
        // Validate username (escape for safe error display)
        if (!this.form.username.trim()) {
            this.errors.push('Username is required');
        } else if (this.form.username.includes('<')) {
            this.errors.push(`Invalid character in username: ${this.escapeHTML(this.form.username)}`);
        }
        
        // Clean bio input
        this.form.bio = this.sanitizeUserInput(this.form.bio);
        
        // Debug output
        console.log('Form data:', this.formatValue(this.form));
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

## Component Lifecycle

### Initialization Hook

WakaPAC provides an `init()` method that runs automatically after the component is fully initialized and all reactive properties are set up.

```javascript
wakaPAC('#app', {
    message: 'Hello',
    user: null,

    init() {
        // This runs after component initialization
        console.log('Component is ready!');
        console.log('Current message:', this.message);

        // Perfect place for setup that depends on reactive properties
        document.title = `App - ${this.message}`;

        // Load initial data
        this.loadUserData();
    },

    async loadUserData() {
        this.user = await fetch('/api/user').then(r => r.json());
    }
});
```

**When to use `init()`:**
- Setting up external libraries that need reactive data
- Making initial API calls
- Setting document properties based on component state
- Any setup that requires fully initialized reactive properties

**Execution order:**
1. Reactive properties are created
2. Computed properties are set up
3. DOM bindings are established
4. Initial DOM update occurs
5. **`init()` is called**
6. Component is ready for user interaction

### Common `init()` Patterns

**External Library Integration:**
```javascript
wakaPAC('#chart', {
    chartData: [1, 2, 3, 4],

    init() {
        // Initialize chart library with reactive data
        this._chart = new Chart('#canvas', {
            data: this.chartData
        });
    },

    watch: {
        chartData(newData) {
            // Update chart when data changes
            this._chart.updateData(newData);
        }
    }
});
```

**Initial Setup with Browser Properties:**
```javascript
wakaPAC('#app', {
    init() {
        // Set initial document title based on visibility
        document.title = this.browserVisible ? 'App Active' : 'App Paused';

        // Start background processes if visible
        if (this.browserVisible) {
            this.startBackgroundSync();
        }
    },

    watch: {
        browserVisible(isVisible) {
            document.title = isVisible ? 'App Active' : 'App Paused';
        }
    }
});
```

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

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Network Status:**
- **`browserOnline`**: `true` when the browser is online, `false` when offline
- **`browserNetworkQuality`**: A reactive string property that provides network performance insights. Possible values: ``fast`, 'slow` and 'offline`.
 
- **Page Visibility:**
- **`browserVisible`**: `true` when the browser tab is active/visible, `false` when tab is hidden or minimized

**Scroll Position:**
- **`browserScrollX`**: How many pixels the page is scrolled horizontally (left/right)
- **`browserScrollY`**: How many pixels the page is scrolled vertically (up/down)

**Page Dimensions:**
- **`browserViewportWidth`**: Width of the browser's content area (viewport) in pixels
- **`browserViewportHeight`**: Height of the browser's content area (viewport) in pixels
- **`browserDocumentWidth`**: Total width of the entire webpage content in pixels
- **`browserDocumentHeight`**: Total height of the entire webpage content in pixels

**Container Viewport Visibility:**
- **`containerVisible`**: `true` when any part of the component's container is visible in the viewport
- **`containerFullyVisible`**: `true` when the component's container is completely visible in the viewport
- **`containerClientRect`**: Object containing the container's position and dimensions relative to the viewport
- **`containerWidth`**: Width of the container element in pixels
- **`containerHeight`**: Height of the container element in pixels

### Understanding difference between viewport and document

Think of it like looking through a window at a tall building:

```
┌─────────────────────┐ ← browserViewportHeight (800px)
│   What you can see  │   The "viewport" - your browser window.
│   right now         │   Changes when you resize browser window
│                     │
│   [Webpage Content] │
├─────────────────────┤ ← You scroll down to see more...
│   [More Content]    │
│   [Even More]       │   browserDocumentHeight (2000px) 
│   [Content Below]   │   The "building" - total webpage height
│   [Footer]          │   Changes when content is added/removed
└─────────────────────┘
```

### Container ClientRect Object

The `containerClientRect` property contains detailed position and size information:

```javascript
// containerClientRect contains:
{
    top: 150,      // Distance from top of viewport
    left: 50,      // Distance from left of viewport  
    right: 850,    // Distance from left to right edge
    bottom: 400,   // Distance from top to bottom edge
    width: 800,    // Width of the container
    height: 250,   // Height of the container
    x: 50,         // Same as left
    y: 150         // Same as top
}
```

### Practical Browser Property Examples

```html
<div id="scroll-app">
    <!-- Scroll-based navigation -->
    <nav data-pac-bind="class: { fixed: browserScrollY > 100 }">
        <span>Scroll position: {{browserScrollY}}px</span>
    </nav>
    
    <!-- Responsive design without CSS media queries -->
    <div data-pac-bind="class: { mobile: browserViewportWidth < 768, desktop: browserViewportWidth >= 1200 }">
        <p data-pac-bind="if: browserViewportWidth < 480">Mobile view</p>
        <p data-pac-bind="if: browserViewportWidth >= 480 && browserViewportWidth < 1024">Tablet view</p>
        <p data-pac-bind="if: browserViewportWidth >= 1024">Desktop view</p>
    </div>
    
    <!-- Visibility-aware performance -->
    <div data-pac-bind="visible: browserVisible">
        <p>Active content that only updates when tab is visible</p>
        <span>Last updated: {{lastUpdateTime}}</span>
    </div>
    
    <!-- Viewport intersection -->
    <div data-pac-bind="class: { highlight: containerVisible, pulse: containerFullyVisible }">
        <p>This element knows when it's in the viewport!</p>
        <p data-pac-bind="if: containerVisible">I'm visible in viewport</p>
        <p data-pac-bind="if: containerFullyVisible">I'm completely visible!</p>
    </div>
    
    <!-- Scroll progress indicator -->
    <div class="progress-bar" data-pac-bind="style: { width: scrollProgress + '%' }"></div>
</div>
```

```javascript
wakaPAC('#scroll-app', {
    lastUpdateTime: new Date().toLocaleTimeString(),
    updateTimer: null,

    computed: {
        scrollProgress() {
            // Calculate scroll percentage
            const maxScroll = this.browserDocumentHeight - this.browserViewportHeight;
            return maxScroll > 0 ? (this.browserScrollY / maxScroll) * 100 : 0;
        }
    },

    watch: {
        browserVisible(isVisible) {
            if (isVisible) {
                // Start updates when tab becomes visible
                this.startUpdates();
            } else {
                // Pause updates when tab is hidden
                this.stopUpdates();
            }
        },

        containerVisible(isVisible) {
            if (isVisible) {
                console.log('Component entered viewport');
                // Start lazy loading, animations, etc.
            }
        }
    },

    init() {
        if (this.browserVisible) {
            this.startUpdates();
        }
    },

    startUpdates() {
        this.updateTimer = setInterval(() => {
            this.lastUpdateTime = new Date().toLocaleTimeString();
        }, 1000);
    },

    stopUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
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
- `abstraction`: Object with properties, methods, computed properties, watchers
- `options`: Configuration object (optional)

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

// Data safety and display utilities
component.escapeHTML(str)
component.sanitizeUserInput(html)
component.formatValue(value)

// Lifecycle
component.destroy()
```

### Configuration Options

```javascript
wakaPAC('#app', data, {
    // 'immediate', 'delayed', 'change'
    updateMode: 'immediate',

    // Default delay for 'delayed' mode (ms)
    delay: 300
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
<input data-pac-bind="value: name">
<button data-pac-bind="click: handleClick">Click</button>
<div data-pac-bind="if: isVisible">Content</div>
<div data-pac-bind="visible: isVisible">Content</div>
```

```javascript
// Vue
export default {
    data() {
        return { count: 0 }
    },
    computed: {
        doubled() { return this.count * 2 }
    },
    watch: {
        count(newVal) { console.log('Count changed') }
    }
}

// WakaPAC
wakaPAC('#app', {
    count: 0,
    computed: {
        doubled() { return this.count * 2; }
    },
    watch: {
        count(newVal) { console.log('Count changed'); }
    }
});
```

### From React
```javascript
// React
const [count, setCount] = useState(0);
const increment = () => setCount(count + 1);

useEffect(() => {
    console.log('Count changed');
}, [count]);

// WakaPAC
wakaPAC('#app', {
    count: 0,

    watch: {
        count() {
            console.log('Count changed');
        }
    },

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
    },
    watch: {
        firstName(newVal) {
            console.log('Name changed to:', newVal);
        }
    }
});
```

## When to Choose WakaPAC

**✅ Perfect for:**
- Projects that need zero build complexity
- Rapid prototyping and legacy modernization
- Complex single-page applications with clean architecture
- Dashboard and admin interfaces
- Data-heavy applications with reactive binding
- Real-time applications where performance matters
- Applications that need visibility-aware performance optimization
- Lazy loading and performance optimization based on viewport visibility

**⚠️ Consider alternatives for:**
- Server-side rendering requirements
- Mobile app development
- Teams requiring extensive TypeScript tooling

## License

MIT License