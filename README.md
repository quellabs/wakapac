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
    <button data-pac-bind="click:increment">Click me!</button>
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

### Attribute Binding

```html
<!-- Basic attributes -->
<div data-pac-bind="class: statusClass, title: statusText"></div>

<!-- Two-way data binding -->
<input data-pac-bind="value: name" type="text">
<textarea data-pac-bind="value: description"></textarea>
<select data-pac-bind="value: category">
    <option value="A">Category A</option>
    <option value="B">Category B</option>
</select>

<!-- Checkboxes (boolean values) -->
<input type="checkbox" data-pac-bind="checked: isActive">

<!-- Radio buttons (use value binding) -->
<input type="radio" name="theme" value="light" data-pac-bind="value: selectedTheme">
<input type="radio" name="theme" value="dark" data-pac-bind="value: selectedTheme">

<!-- Enable/Disable controls -->
<button data-pac-bind="enable: isFormValid">Submit</button>

<!-- Multiple bindings -->
<div data-pac-bind="class: statusClass,style: dynamicStyle,click: handleClick"></div>
```

### Conditional Rendering

```html
<!-- visible: CSS display control (stays in DOM) -->
<div data-pac-bind="visible: showDetails">Details here</div>
<div data-pac-bind="visible: !hideContent">Content</div>

<!-- if: DOM element control (added/removed from DOM) -->
<div data-pac-bind="if: user.isAdmin">Admin Panel</div>
<div data-pac-bind="if: !isLoading">Content loaded</div>

<!-- Browser state conditions -->
<div data-pac-bind="visible: browserVisible">Active content</div>
<div data-pac-bind="if: browserWindowHeight > 600">Large screen content</div>

<!-- Container viewport conditions -->
<div data-pac-bind="visible: containerVisible">Show when container is in viewport</div>
<div data-pac-bind="if: containerFullyVisible">Only when fully visible</div>
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

## Watchers

Watchers execute code when reactive properties change. Use them when you need to **perform side effects** in response to data changes.

```javascript
wakaPAC('#app', {
    searchQuery: '',
    count: 0,

    watch: {
        // Watch a simple property
        searchQuery(newValue, oldValue) {
            if (newValue.length > 2) {
                this.performSearch(newValue);
            }
        },

        // Watch with multiple side effects
        count(newCount, oldCount) {
            if (newCount > 10) {
                this.showWarning = true;
            }

            if (newCount % 5 === 0) {
                this.saveProgress();
            }
        },

        // Watch container viewport visibility
        containerVisible(isVisible) {
            if (isVisible) {
                this.startAnimation();
            } else {
                this.pauseAnimation(); // Save resources when not visible
            }
        },

        containerFullyVisible(isFullyVisible) {
            if (isFullyVisible) {
                this.trackViewedContent(); // Analytics when fully in view
            }
        }
    },
});
```

### Common Watcher Use Cases

**Form Validation:**
```javascript
wakaPAC('#app', {
    email: '',
    emailValid: false,

    watch: {
        email(newEmail) {
            this.emailValid = this.validateEmail(newEmail);
        }
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
});
```

**External Library Integration:**
```javascript
watch: {
    chartData(newData) {
        // Update external chart library
        this._chart.updateData(newData);
    }
}
```

**Performance Optimization:**
```javascript
watch: {
    browserVisible(isVisible) {
        if (isVisible) {
            this.startAnimation();
        } else {
            this.pauseAnimation();
        }
    }
}
```

### Watchers vs Computed Properties

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

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Page Visibility:**
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
- **`containerClientWidth`**: Width of the container
- **`containerClientHeight`**: Height of the container

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
component.sendToChildren(command, data)
component.sendToChild(selector, command, data)

// DOM interaction
component.readDOMValue(selector)
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
    updateMode: 'immediate',    // 'immediate', 'delayed', 'change'
    delay: 300                  // Delay for 'delayed' mode (ms)
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

** Perfect for:**
- Projects that need zero build complexity
- Rapid prototyping and legacy modernization
- Complex single-page applications with clean architecture
- Dashboard and admin interfaces
- Data-heavy applications with reactive binding
- Real-time applications where performance matters
- Applications that need visibility-aware performance optimization
- Lazy loading and performance optimization based on viewport visibility

**️ Consider alternatives for:**
- Server-side rendering requirements
- Mobile app development
- Teams requiring extensive TypeScript tooling

## Browser Support

- **Modern browsers**: Chrome, Firefox, Safari, Edge (with ES6 Proxy and IntersectionObserver)
- **Legacy browsers**: IE11+ (fallback using Object.defineProperty and scroll-based visibility detection)

## License

MIT License