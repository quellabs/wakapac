# WakaPAC

A complete application library combining KnockoutJS-style reactivity with desktop-style event handling — in a single 60KB file.

## Introduction

WakaPAC provides two things that usually require separate libraries:

1. **Reactive data binding** — declare your data, bind it to HTML, and the DOM updates automatically. Two-way binding, computed properties, watchers, deep reactivity for nested objects and arrays.

2. **Desktop-style event system** — a centralized `msgProc` handles all events in one place, plus timer management and mouse gesture recognition.

No build tools. No dependency management. Just include the script and go.

### Why WakaPAC?

- **Declarative HTML bindings** with `{{ mustache }}` templates and `data-pac-bind` attributes
- **Two-way reactivity** — change a property, DOM updates; user types in input, property updates
- **Deep reactivity** — nested objects and arrays just work
- **Computed properties** that automatically recalculate when dependencies change
- **Desktop-style `msgProc`** — one function handles all events with full control
- **Timer API** — `setTimer()` and `killTimer()` for intervals that integrate with msgProc
- **Mouse gesture recognition** — right-click drag patterns like Opera browser
- **Hierarchical components** with parent–child messaging
- **Drop-in script file** — no bundler required

### Who WakaPAC is For

- **Reactive UIs without the ecosystem** — get Vue/Knockout-style binding without npm, webpack, or a build step
- **Complex interactions** — drag-drop, drawing apps, games become straightforward with centralized event handling instead of scattered `addEventListener` calls
- **Low-level control** — intercept and handle any event before it reaches your UI, validate input, implement shortcuts
- **Self-contained projects** — one 50KB file, no build step, no dependency tree to manage

### Not For You If

- You need SSR
- You want JSX/TSX or TypeScript-first DX
- You're building a massive SPA that fits better in React/Vue

📚 **Full documentation**: [wakapac.com](https://www.wakapac.com)

## Installation

```html
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional: HTTP client -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakasync.min.js"></script>
```

## Quick Example

```html
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
```

## Data Binding

### Text Interpolation

```html
<p>Hello, {{ name }}!</p>
<p>{{ user.age >= 18 ? 'Adult' : 'Minor' }}</p>
<p>Total: ${{ price * quantity }}</p>
```

### Attribute Bindings

```html
<input data-pac-bind="value: name">
<input type="checkbox" data-pac-bind="checked: isActive">
<div data-pac-bind="visible: showPanel">
<div data-pac-bind="if: user.isAdmin">Admin Panel</div>
<div data-pac-bind="class: {active: isSelected, disabled: !enabled}">
<button data-pac-bind="click: handleClick">
```

### List Rendering

```html
<div data-pac-bind="foreach: items" data-pac-item="item">
    <span>{{ item.name }}</span>
</div>
```

### Deep Reactivity

Nested objects and arrays are automatically reactive:

```javascript
wakaPAC('#app', {
    user: {
        name: 'John',
        preferences: { theme: 'dark' }
    },
    todos: [],

    addTodo() {
        this.todos.push({ text: 'New todo', done: false });
    },

    updateTheme(theme) {
        this.user.preferences.theme = theme; // Triggers DOM update
    }
});
```

## Computed Properties & Watchers

```javascript
wakaPAC('#app', {
    firstName: 'John',
    lastName: 'Doe',
    
    computed: {
        fullName() {
            return `${this.firstName} ${this.lastName}`;
        }
    },
    
    watch: {
        firstName(newVal, oldVal) {
            console.log(`Name changed from ${oldVal} to ${newVal}`);
        }
    }
});
```

## Desktop-Style Event Processing (msgProc)

The `msgProc` method provides low-level control over all events in your component:

```javascript
wakaPAC('#app', {
    msgProc(event) {
        switch(event.message) {
            case wakaPAC.MSG_KEYDOWN:
                if (event.wParam === wakaPAC.VK_ESCAPE) {
                    this.closeModal();
                }
                break;
                
            case wakaPAC.MSG_LCLICK:
                const pos = wakaPAC.MAKEPOINTS(event.lParam);
                console.log(`Click at (${pos.x}, ${pos.y})`);
                break;
                
            case wakaPAC.MSG_TIMER:
                this.onTimer(event.wParam); // wParam = timer ID
                break;
                
            case wakaPAC.MSG_GESTURE:
                this.handleGesture(event.pattern);
                break;
        }
        return true; // Continue to standard bindings
    }
});
```

### Message Types

| Category | Messages |
|----------|----------|
| Mouse | `MSG_LBUTTONDOWN`, `MSG_LBUTTONUP`, `MSG_RBUTTONDOWN`, `MSG_RBUTTONUP`, `MSG_MOUSEMOVE`, `MSG_LBUTTONDBLCLK` |
| Click | `MSG_LCLICK`, `MSG_MCLICK`, `MSG_RCLICK` |
| Keyboard | `MSG_KEYDOWN`, `MSG_KEYUP` |
| Form | `MSG_CHAR`, `MSG_CHANGE`, `MSG_SUBMIT` |
| Focus | `MSG_FOCUS`, `MSG_BLUR` |
| System | `MSG_TIMER`, `MSG_GESTURE` |

### Modifier Key Constants

```javascript
wakaPAC.MK_LBUTTON  // 0x0001 - Left mouse button
wakaPAC.MK_RBUTTON  // 0x0002 - Right mouse button
wakaPAC.MK_MBUTTON  // 0x0004 - Middle mouse button
wakaPAC.MK_SHIFT    // 0x0008 - Shift key
wakaPAC.MK_CONTROL  // 0x0010 - Control key
wakaPAC.MK_ALT      // 0x0020 - Alt key
```

### Virtual Key Constants

```javascript
wakaPAC.VK_BACK     // Backspace
wakaPAC.VK_TAB      // Tab
wakaPAC.VK_RETURN   // Enter
wakaPAC.VK_ESCAPE   // Escape
wakaPAC.VK_SPACE    // Space
wakaPAC.VK_LEFT     // Left Arrow
wakaPAC.VK_UP       // Up Arrow
wakaPAC.VK_RIGHT    // Right Arrow
wakaPAC.VK_DOWN     // Down Arrow
wakaPAC.VK_DELETE   // Delete
wakaPAC.VK_INSERT   // Insert
wakaPAC.VK_HOME     // Home
wakaPAC.VK_END      // End
wakaPAC.VK_PRIOR    // Page Up
wakaPAC.VK_NEXT     // Page Down
wakaPAC.VK_F1       // F1 (through VK_F12)
```

### Coordinate Utilities

```javascript
wakaPAC.LOWORD(lParam)       // Extract x coordinate
wakaPAC.HIWORD(lParam)       // Extract y coordinate
wakaPAC.MAKEPOINTS(lParam)   // Extract {x, y} object

this.containerToViewport(x, y)  // Container-relative → viewport
this.viewportToContainer(x, y)  // Viewport → container-relative
```

## Timer API

Create and manage timers that send `MSG_TIMER` messages to your component:

```javascript
wakaPAC('#game', {
    _animationTimer: null,
    frameCount: 0,
    
    init() {
        // Start a 60fps timer (returns timer ID)
        this._animationTimer = this.setTimer(16);
    },
    
    msgProc(event) {
        if (event.message === wakaPAC.MSG_TIMER) {
            const timerId = event.wParam;
            
            if (timerId === this._animationTimer) {
                this.frameCount++;
                this.updateAnimation();
            }
        }
        return true;
    },
    
    stopAnimation() {
        this.killTimer(this._animationTimer);
    }
});
```

### Timer Methods

| Method | Description |
|--------|-------------|
| `this.setTimer(ms)` | Start timer, returns timer ID |
| `this.killTimer(id)` | Stop specific timer |
| `this.killAllTimers()` | Stop all component timers |

Timers are automatically cleaned up when a component is destroyed.

## Gesture Recognition

WakaPAC recognizes mouse gestures drawn while holding the right mouse button:

```javascript
wakaPAC('#browser', {
    msgProc(event) {
        if (event.message === wakaPAC.MSG_GESTURE) {
            switch(event.pattern) {
                case 'left':
                    history.back();
                    break;
                case 'right':
                    history.forward();
                    break;
                case 'down':
                    this.openNewTab();
                    break;
                case 'L':  // Down then right
                    this.closeTab();
                    break;
            }
        }
        return true;
    }
});
```

### Built-in Patterns

| Pattern | Directions | Description |
|---------|------------|-------------|
| `right` | R | Swipe right |
| `left` | L | Swipe left |
| `up` | U | Swipe up |
| `down` | D | Swipe down |
| `L` | D, R | Down then right |
| `inverted-L` | D, L | Down then left |

### Custom Patterns

```javascript
// Register custom gesture
wakaPAC.registerGesture('refresh', ['U', 'D']);    // Up-down
wakaPAC.registerGesture('zigzag', ['R', 'D', 'R']); // Right-down-right

// Remove a pattern
wakaPAC.unregisterGesture('refresh');
```

### Gesture Event Properties

```javascript
event.pattern         // Matched pattern name: 'L', 'right', etc.
event.directions      // Direction array: ['D', 'R']
event.gestureStartX   // Start coordinates (container-relative)
event.gestureStartY
event.gestureEndX     // End coordinates
event.gestureEndY
event.gestureDuration // Milliseconds
event.pointCount      // Number of recorded points
```

## Component Communication

### Parent-Child

```javascript
// Child notifies parent
this.notifyParent('itemSelected', { id: 42 });

// Parent receives
receiveFromChild(eventType, data, childPAC) {
    if (eventType === 'itemSelected') {
        this.loadItem(data.id);
    }
}

// Parent commands child
this.notifyChild('item-list', 'refresh');
this.notifyChildren('themeChanged', { theme: 'dark' });
```

### Cross-Container Messaging

```javascript
// Define message constant
const WM_USER_LOGIN = wakaPAC.MSG_USER + 1;

// Broadcast to all containers
wakaPAC.broadcastMessage(WM_USER_LOGIN, userId, 0, { name: 'Floris' });

// Send to specific container
wakaPAC.sendMessage('user-panel', WM_USER_LOGIN, userId, 0);
```

## Lifecycle Methods

```javascript
wakaPAC('#app', {
    init() {
        // Called before DOM bindings — set up state
        this._socket = new WebSocket(url);
    },
    
    ready() {
        // Called after DOM bindings — safe for DOM manipulation
        this.loadInitialData();
    }
});
```

## Browser Reactive Properties

Built-in properties that update automatically:

```javascript
this.browserOnline        // Network status
this.browserVisible       // Tab visibility
this.browserScrollX/Y     // Scroll position
this.browserViewportWidth // Viewport dimensions
this.containerVisible     // Component in viewport
this.containerFocus       // Component has focus
```

## Non-Reactive Properties

Prefix with underscore to prevent DOM updates:

```javascript
wakaPAC('#app', {
    count: 0,        // Reactive
    _cache: {},      // Non-reactive — for internal state
    _timerId: null   // Non-reactive — for timer IDs
});
```

## API Reference

### Instance Methods

```javascript
this.setTimer(ms)                    // Start timer
this.killTimer(id)                   // Stop timer
this.killAllTimers()                 // Stop all timers
this.notifyParent(type, data)        // Send to parent
this.notifyChildren(cmd, data)       // Broadcast to children
this.notifyChild(id, cmd, data)      // Send to specific child
this.escapeHTML(str)                 // XSS protection
this.sanitizeUserInput(html)         // Strip HTML tags
this.containerToViewport(x, y)       // Coordinate conversion
this.viewportToContainer(x, y)       // Coordinate conversion
```

### Static Methods

```javascript
wakaPAC.sendMessage(id, msg, wParam, lParam, data)
wakaPAC.broadcastMessage(msg, wParam, lParam, data)
wakaPAC.registerGesture(name, directions)
wakaPAC.unregisterGesture(name)
wakaPAC.LOWORD(value)
wakaPAC.HIWORD(value)
wakaPAC.MAKEPOINTS(lParam)
```

## License

MIT License