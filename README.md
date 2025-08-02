# WakaPAC Framework

A powerful reactive JavaScript framework implementing the PAC (Presentation-Abstraction-Control) architectural pattern.
WakaPAC creates hierarchical components with two-way data binding, event handling, automatic DOM synchronization,
and **bidirectional parent-child communication** while working seamlessly with vanilla HTML and JavaScript.

## Features

### 🔄 **Reactive Data Binding**
- Automatic DOM updates when JavaScript object properties change
- **Deep reactivity** for nested objects and arrays with path tracking
- Two-way binding between form inputs and data properties
- Intelligent change detection with batched DOM updates
- **Array mutation tracking** - `push()`, `pop()`, `splice()` automatically trigger updates

### 🎯 **Template Syntax**
- Simple `{{propertyName}}` syntax for dynamic content in HTML
- Support for computed properties with automatic dependency tracking
- Conditional rendering with `data-pac-bind="visible:property"` and negation support `visible:!property`

### ⚡ **Event Handling**
- Declarative event binding via data attributes
- Method binding with `data-pac-bind="click:methodName"`
- Automatic event delegation for performance

### 🏗️ **Hierarchical Components with Bidirectional Communication**
- **Parent-to-child commands**: Send instructions and data down the hierarchy
- **Child-to-parent notifications**: Report status and request resources
- **Multi-level communication**: Messages can flow through intermediate components
- **Child querying**: Find and manipulate children by selectors, properties, or functions
- **Coordinated updates**: Parents can orchestrate complex interactions between children

### 🚀 **Performance Optimized**
- Batched DOM updates using `requestAnimationFrame`
- Intelligent caching of computed properties
- Event delegation to minimize memory usage
- **Proxy-based reactivity** for modern browsers with fallback for older browsers

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
    <div data-pac-bind="visible:!hideWelcome">
        Welcome message (hidden when hideWelcome is true)
    </div>
</div>

<script>
    wakaPAC('#my-app', {
        firstName: 'John',
        lastName: 'Doe',
        count: 0,
        showMessage: true,
        hideWelcome: false,

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

### Deep Reactivity Example

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
        // This now works! Array mutations are reactive
        this.todos.push({
            id: Date.now(),
            text: 'New todo',
            completed: false
        });
    },

    toggleTodo(index) {
        // This now works! Deep nested changes are reactive
        this.todos[index].completed = !this.todos[index].completed;
    },

    updateTheme(newTheme) {
        // This now works! Deep nested property changes
        this.user.preferences.theme = newTheme;
    }
});
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

### Bidirectional Parent-Child Communication

#### Parent Controlling Children

```javascript
// Parent component
const parent = wakaPAC('#dashboard', {
    theme: 'light',
    masterData: { status: 'active' },

    // Send commands to all children
    pauseAllTasks() {
        this.sendToChildren('pause', { reason: 'Maintenance mode' });
    },

    // Send command to specific child
    highlightTask(taskId) {
        this.sendToChild(`[data-task-id="${taskId}"]`, 'highlight', {
            color: 'yellow',
            duration: 3000
        });
    },

    // Broadcast data updates
    changeTheme(newTheme) {
        this.theme = newTheme;
        this.broadcastDataUpdate('theme', newTheme);
    },

    // Coordinate multiple children
    startWorkflow() {
        // Step 1: Prepare all children
        this.sendToChildren('prepare', { workflowId: 'WF-001' });

        // Step 2: Start specific children in sequence
        setTimeout(() => {
            this.sendToChild('.step-1', 'start', { priority: 'high' });
        }, 100);

        setTimeout(() => {
            this.sendToChild('.step-2', 'start', { dependsOn: 'step-1' });
        }, 200);
    },

    // Handle child communications
    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'taskComplete') {
            console.log(`Task completed by ${childPAC.container.id}`);

            // Coordinate next steps
            if (data.triggerNext) {
                this.sendToChild('.next-task', 'activate', data);
            }
        }

        if (eventType === 'requestData') {
            // Send requested data back to child
            childPAC.receiveFromParent('dataResponse', this.masterData);
        }
    }
});
```

#### Child Receiving Commands

```javascript
// Child component
const child = wakaPAC('#task-widget', {
    taskName: 'Data Processing',
    status: 'ready',
    isPaused: false,

    // Handle commands from parent
    receiveFromParent(command, data) {
        switch(command) {
            case 'pause':
                this.isPaused = true;
                this.status = 'paused';
                this.pauseReason = data.reason;
                break;

            case 'highlight':
                this.highlightElement(data.color, data.duration);
                break;

            case 'start':
                this.status = 'running';
                this.priority = data.priority;
                this.startTask();
                break;

            case 'prepare':
                this.workflowId = data.workflowId;
                this.status = 'prepared';
                break;
        }
    },

    // Notify parent of events
    completeTask() {
        this.status = 'completed';
        this.notifyParent('taskComplete', {
            taskName: this.taskName,
            duration: this.getTaskDuration(),
            triggerNext: true
        });
    },

    requestDataFromParent() {
        this.notifyParent('requestData', {
            requestedBy: this.taskName,
            timestamp: Date.now()
        });
    }
});
```

#### Child Querying and Manipulation

```javascript
const parent = wakaPAC('#container', {
    // Find children by various criteria
    getAllActiveTasks() {
        return this.findChildren(child =>
            child.status === 'active'
        );
    },

    getTaskById(taskId) {
        return this.findChildByProperty('taskId', taskId);
    },

    getChildrenByType(componentType) {
        return this.findChildrenBySelector(`[data-component="${componentType}"]`);
    },

    // Batch operations
    pauseAllActiveTasks() {
        this.findChildren(child => child.status === 'active')
            .forEach(child => {
                child.receiveFromParent('pause', { reason: 'Batch pause' });
            });
    },

    updateTaskGroup(groupName, updates) {
        this.syncDataToChildren({
            [`[data-group="${groupName}"]`]: updates
        });
    }
});
```

### Hierarchical Data Flow

```javascript
// Three-level hierarchy: Dashboard → TaskManager → SubTask
const dashboard = wakaPAC('#dashboard', {
    globalSettings: { timeout: 5000 },

    onChildUpdate(eventType, data, childPAC) {
        // Handle events from TaskManager (which may come from SubTasks)
        if (eventType === 'subtaskProgress') {
            console.log(`Subtask progress: ${data.progress}% via ${childPAC.container.id}`);
        }
    }
});

const taskManager = wakaPAC('#task-manager', {
    currentTask: 'Processing data',

    // Forward commands to subtasks
    receiveFromParent(command, data) {
        if (command === 'globalUpdate') {
            this.sendToChildren('configUpdate', data);
        }
    },

    // Handle subtask communications and forward to dashboard
    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'progress') {
            // Forward progress reports to dashboard
            this.notifyParent('subtaskProgress', {
                ...data,
                taskManager: this.currentTask
            });
        }
    }
});

const subTask = wakaPAC('#subtask', {
    progress: 0,

    updateProgress(newProgress) {
        this.progress = newProgress;
        // This will flow up: SubTask → TaskManager → Dashboard
        this.notifyParent('progress', { progress: newProgress });
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
                    // Notify children of user data update
                    this.sendToChildren('userLoaded', data);
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

## Configuration Options

```javascript
wakaPAC('#component', {
    // ... abstraction properties
}, {
    updateMode: 'immediate',    // 'immediate', 'delayed', or 'change'
    delay: 300,                // Delay in milliseconds for 'delayed' mode
    deepReactivity: true       // Enable deep reactivity (default: true)
});
```

## API Reference

### Component Instance Methods

```javascript
const component = wakaPAC('#app', { /* ... */ });

// Hierarchy management
component.addChild(childComponent);
component.removeChild(childComponent);

// Parent-to-child communication (NEW)
component.sendToChildren(command, data);           // Send to all children
component.sendToChild(selector, command, data);    // Send to specific child
component.broadcastDataUpdate(property, value);    // Update property in all children
component.syncDataToChildren(mapping);             // Sync different data to different children

// Child querying (NEW)
component.findChild(predicate);                    // Find first child matching predicate
component.findChildren(predicate);                 // Find all children matching predicate
component.findChildBySelector(selector);           // Find child by CSS selector
component.findChildrenBySelector(selector);        // Find children by CSS selector
component.findChildByProperty(property, value);    // Find child by property value

// Child-to-parent communication
component.notifyParent('eventType', data);         // Send notification to parent
component.receiveFromParent(command, data);        // Handle command from parent (override in abstraction)

// Server communication
component.control('/api/endpoint', options);

// Cleanup
component.destroy();

// Properties (read-only)
component.parent    // Parent component reference
component.children  // Array of child components
component.container // DOM container element
```

### Component Abstraction Methods

These methods are available within your component abstraction:

```javascript
wakaPAC('#app', {
    // ... properties ...

    // Handle commands from parent
    receiveFromParent(command, data) {
        // Override this method to handle parent commands
    },

    // Handle updates from children
    onChildUpdate(eventType, data, childPAC) {
        // Override this method to handle child communications
    },

    // Communication methods (available as 'this.methodName')
    sendToChildren: function(command, data) { /* ... */ },
    sendToChild: function(selector, command, data) { /* ... */ },
    findChild: function(predicate) { /* ... */ },
    findChildren: function(predicate) { /* ... */ },
    // ... and all other API methods
});
```

### Event Types

The framework supports all standard DOM events:

- `click`, `submit`, `change`, `input`
- `focus`, `blur`, `keyup`, `keydown`
- And any other standard DOM event

## Browser Support

WakaPAC works in all modern browsers that support:
- ES5 (IE9+) with fallback reactivity
- Modern browsers get Proxy-based deep reactivity
- `requestAnimationFrame`
- `querySelector`/`querySelectorAll`
- `Object.defineProperty`

## Performance Tips

1. **Use computed properties** for derived values instead of calculating in templates
2. **Prefer `change` update mode** for non-critical form inputs to reduce updates
3. **Batch property updates** when possible to minimize DOM updates
4. **Use bidirectional communication** instead of polling or manual DOM manipulation
5. **Leverage deep reactivity** for complex data structures
6. **Destroy components** when no longer needed to prevent memory leaks

## Examples

### Coordinated Dashboard

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
        this.broadcastDataUpdate('theme', newTheme);
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

        if (eventType === 'dataRequest') {
            // Provide requested data to child widgets
            const requestedData = this.getDataForWidget(data.requestType);
            childPAC.receiveFromParent('dataResponse', requestedData);
        }
    }
});

// Widget child responds to dashboard commands
wakaPAC('#user-widget', {
    users: [],
    loading: false,
    error: null,
    theme: 'light',
    isPaused: false,

    receiveFromParent(command, data) {
        switch(command) {
            case 'refresh':
                if (!this.isPaused) {
                    this.loadUsers(data.force);
                }
                break;

            case 'pause':
                this.isPaused = true;
                this.pauseReason = data.reason;
                if (data.showMessage) {
                    this.showPauseMessage(data.reason);
                }
                break;

            case 'dataResponse':
                this.handleDataFromDashboard(data);
                break;
        }
    },

    async loadUsers(force = false) {
        this.loading = true;
        this.error = null;

        try {
            const users = await this.control('/api/users', {
                method: 'GET',
                headers: force ? { 'Cache-Control': 'no-cache' } : {}
            });
            this.users = users;
        } catch (error) {
            this.error = error.message;
            // Notify dashboard of error
            this.notifyParent('error', {
                type: 'api_error',
                message: error.message,
                widget: 'user-widget'
            });
        } finally {
            this.loading = false;
        }
    },

    requestDashboardData(requestType) {
        this.notifyParent('dataRequest', {
            requestType: requestType,
            requesterId: 'user-widget'
        });
    }
});
```

### Multi-Step Form with Coordination

```javascript
// Form controller coordinates steps
wakaPAC('#multi-step-form', {
    currentStep: 1,
    totalSteps: 3,
    formData: {},

    goToStep(stepNumber) {
        // Hide all steps
        this.sendToChildren('hide', { animate: true });

        // Show target step
        this.sendToChild(`[data-step="${stepNumber}"]`, 'show', {
            animate: true,
            direction: stepNumber > this.currentStep ? 'forward' : 'backward'
        });

        this.currentStep = stepNumber;

        // Update progress indicator
        this.sendToChild('.progress-indicator', 'updateProgress', {
            current: stepNumber,
            total: this.totalSteps
        });
    },

    async validateAndProceed() {
        // Validate current step
        const currentStepComponent = this.findChild(child =>
            child.stepNumber === this.currentStep
        );

        if (currentStepComponent) {
            const isValid = await currentStepComponent.validate();
            if (isValid && this.currentStep < this.totalSteps) {
                this.goToStep(this.currentStep + 1);
            }
        }
    },

    onChildUpdate(eventType, data, childPAC) {
        if (eventType === 'stepComplete') {
            // Merge step data into form data
            Object.assign(this.formData, data.stepData);

            // Auto-advance to next step
            if (data.autoAdvance && this.currentStep < this.totalSteps) {
                this.goToStep(this.currentStep + 1);
            }
        }

        if (eventType === 'validationError') {
            // Handle validation errors
            this.showValidationSummary(data.errors);
        }
    }
});

// Individual form step
wakaPAC('#step-1', {
    stepNumber: 1,
    userData: { name: '', email: '' },
    isVisible: false,

    receiveFromParent(command, data) {
        switch(command) {
            case 'show':
                this.isVisible = true;
                this.animateIn(data.direction);
                break;

            case 'hide':
                this.isVisible = false;
                if (data.animate) {
                    this.animateOut();
                }
                break;
        }
    },

    async validate() {
        const errors = [];

        if (!this.userData.name.trim()) {
            errors.push('Name is required');
        }

        if (!this.isValidEmail(this.userData.email)) {
            errors.push('Valid email is required');
        }

        if (errors.length > 0) {
            this.notifyParent('validationError', { errors, step: this.stepNumber });
            return false;
        }

        return true;
    },

    completeStep() {
        this.notifyParent('stepComplete', {
            stepNumber: this.stepNumber,
            stepData: { userData: this.userData },
            autoAdvance: true
        });
    }
});
```

## License

MIT License - see the source file for full license terms.