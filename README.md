# WakaPAC

A reactive UI library with a centralized desktop-style event engine — in a single ~60KB drop-in script. WakaPAC combines declarative data binding with a message-based event system.

## Installation

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional: Add WakaSync for HTTP functionality -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakasync.min.js"></script>
```

## Introduction

WakaPAC is a small runtime that attaches a reactive, message-driven execution model to a DOM container.

```js
wakaPAC('#app', { ... })
```

When a component is created, WakaPAC wraps your object in an internal context and wires three pipelines:

- **State pipeline** — property writes are observed and propagate to bound DOM nodes
- **Binding pipeline** — templates and `data-pac-bind` attributes are compiled into live DOM bindings
- **Event pipeline** — browser events, timers, and gestures are normalized and dispatched as messages

## Binding Types

Bindings are declared with `data-pac-bind` attributes. Multiple bindings can be combined with commas. Text nodes support mustache-style interpolation using `{{ expression }}`. 

### Value and Checked

Two-way form bindings:

```html
<input data-pac-bind="value: name">
<input type="checkbox" data-pac-bind="checked: isActive">
```

### Click and Event Handlers

Call component methods directly:

```html
<button data-pac-bind="click: save">Save</button>
<button data-pac-bind="click: removeItem">Delete</button>
```

### Visibility and Conditional Rendering

```html
<div data-pac-bind="visible: showPanel">
<div data-pac-bind="if: isAdmin">
```

- `visible` toggles display
- `if` adds or removes the node

### Comment Block Conditionals (`wp-if`)

For conditional rendering of multiple sibling nodes or larger fragments, WakaPAC supports comment-based conditional blocks.

```html
<!-- wp-if: isAdmin -->
<div class="admin-panel">
  <h2>Admin</h2>
  <button data-pac-bind="click: resetSystem">Reset</button>
</div>
<!-- /wp-if -->
```

### Class Binding

```html
<div data-pac-bind="class: { active: isSelected, disabled: !enabled }">
```

Object keys are class names, values are expressions.

### Style Binding

```html
<div data-pac-bind="style: { color: textColor, fontSize: size + 'px' }">
```

Style properties map to expressions.

### List Rendering

```html
<ul data-pac-bind="foreach: items" data-pac-item="item">
  <li>{{ item.label }}</li>
</ul>
```

`data-pac-item` defines the loop variable name inside the template. The default value is `item`.

### Multiple Bindings

```html
<input data-pac-bind="value: name, class: { invalid: hasError }">
```

## Browser Reactive Properties

WakaPAC automatically provides reactive browser state properties that update when the browser environment changes. These are available in all components without any setup:

### Available Properties

**Component Identity:**
- **`pacId`**: The unique identifier for this component. Taken from `id` attribute, `data-pac-id` attribute or auto-generated when absent.

**Network Status:**
- **`browserOnline`**: `true` when the browser is online, `false` when offline
- **`browserNetworkQuality`**: Network performance insights: `'fast'`, `'slow'` or `'offline'`

**Page Visibility:**
- **`browserVisible`**: `true` when the browser tab is active/visible, `false` when hidden

**Scroll Position:**
- **`browserScrollX`**: Horizontal scroll position in pixels (can be set programmatically)
- **`browserScrollY`**: Vertical scroll position in pixels (can be set programmatically)

**Page Dimensions:**
- **`browserViewportWidth`**: Browser viewport width in pixels
- **`browserViewportHeight`**: Browser viewport height in pixels
- **`browserDocumentWidth`**: Total document width in pixels
- **`browserDocumentHeight`**: Total document height in pixels

**Container Viewport Visibility:**
- **`containerVisible`**: `true` when any part of the container is visible in viewport
- **`containerFullyVisible`**: `true` when container is completely visible in viewport
- **`containerClientRect`**: Position and dimensions object relative to viewport (DOMRect)
- **`containerWidth`**: Container width in pixels
- **`containerHeight`**: Container height in pixels

**Container Scroll Properties:**
- **`containerIsScrollable`**: `true` if container can scroll in any direction
- **`containerScrollX`**: Current horizontal scroll position in pixels (can be set programmatically)
- **`containerScrollY`**: Current vertical scroll position in pixels (can be set programmatically)
- **`containerScrollContentWidth`**: Total scrollable content width (scrollWidth)
- **`containerScrollContentHeight`**: Total scrollable content height (scrollHeight)
- **`containerScrollWindow`**: Object containing scroll measurements (DOMRect)

**Container Focus State:**
- **`containerFocus`**: `true` when container has direct focus (`:focus`)
- **`containerFocusWithin`**: `true` when container or child has focus (`:focus-within`)

**Component Hierarchy Properties:**
- **`childrenCount`**: Number of direct child PAC components (read-only, reactive)
- **`hasParent`**: `true` if this component has a parent PAC component, `false` if it's a root component


### Usage Examples

```html
<!-- Browser properties in templates -->
<p>Viewport: {{ browserViewportWidth }} x {{ browserViewportHeight }}</p>
<p data-pac-bind="visible: !browserVisible">Tab is hidden - updates paused</p>
<p>Container is {{ containerVisible ? 'visible' : 'hidden' }} in viewport</p>
```

## Lifecycle Hooks

Components can define optional lifecycle methods. These are called automatically by the runtime at specific stages. Only methods that are defined are invoked.

```javascript
init()     // runs once after the component context is created, before bindings are applied
ready()    // runs after bindings are active and the container is connected
destroy()  // runs when the component container is removed from the DOM
```

Typical usage:
- `init` — start timers, initialize internal state, register gestures
- `ready` — perform DOM-dependent work or measurements
- `destroy` — stop timers and release external resources

## Message Processing (msgProc)

Bindings define how state connects to the DOM. Interaction and system input are handled separately through the message pipeline, which delivers normalized events to your component via `msgProc`.

```js
msgProc(event) {
    if (event.message === wakaPAC.MSG_LCLICK) {
        const {x, y} = wakaPAC.MAKEPOINTS(event.lParam);
        console.log('click at', x, y);
    }

    return true;
}
```

WakaPAC messages are plain objects with a normalized structure. A typical event looks like:

```javascript
{
    type: 'pac:event',             // Always 'pac:event' for msgProc
    message: wakaPAC.MSG_*,        // Message type from MSG_TYPES constants
    wParam: 0x0001,                // Primary parameter (varies by message type)
    lParam: 0x00640032,            // Secondary parameter (varies by message type)
    target: HTMLElement,           // The DOM element that triggered the event
    originalEvent: Event,          // Original browser DOM event object
    timestamp: 1640995200000       // Timestamp when event was dispatched
}
```

Message constants identify the source category:

| Category | Messages                                                                 |
|----------|--------------------------------------------------------------------------|
| Mouse    | `MSG_LBUTTONDOWN`, `MSG_LBUTTONUP`, `MSG_MOUSEMOVE`, `MSG_LBUTTONDBLCLK` |
| Click    | `MSG_LCLICK`, `MSG_MCLICK`, `MSG_RCLICK`                                 |
| Keyboard | `MSG_KEYDOWN`, `MSG_KEYUP`                                               |
| Form     | `MSG_CHAR`, `MSG_CHANGE`, `MSG_SUBMIT`                                   |
| Focus    | `MSG_FOCUS`, `MSG_BLUR`                                                  |
| System   | `MSG_TIMER`, `MSG_GESTURE`                                               |

Bindings update the DOM from state changes. `msgProc` updates state and behavior from messages. This keeps DOM synchronization and interaction logic separate while operating on the same component state.

> Note: This is not a complete list. See the full message constant reference in the documentation.

## Quick Examples

The following examples show the core execution model in practice.

### Reactive State + Two-Way Binding

State updates the DOM. Input updates state. No listeners required.

```html
<div id="app">
  <h1>Hello {{ name }}</h1>
  <input data-pac-bind="value: name">
</div>

<script>
wakaPAC('#app', {
  name: 'World'
});
</script>
```

### Computed Property

Computed values recalculate automatically.

```html
<div id="app">
  <p>{{ fullName }}</p>
</div>

<script>
    wakaPAC('#app', {
        first: 'Ada',
        last: 'Lovelace',

        computed: {
            fullName() {
                return this.first + ' ' + this.last;
            }
        }
    });
</script>
```

### Watchers

Watchers run a function when a reactive property changes. Use watchers for side effects such as logging, persistence, or triggering external actions. They run after the property value has been updated.

```javascript
wakaPAC('#app', {
    count: 0,

    watchers: {
        count(newValue, oldValue) {
            console.log('count changed:', oldValue, '→', newValue);
        }
    }
});
```

### Centralized Event Handling

```html
<div id="app">
  <p>Ticks: {{ ticks }}</p>
</div>

<script>
    wakaPAC('#app', {
        ticks: 0,
        _timerId: null,

        init() {
            this._timerId = wakaPAC.setTimer(this.pacId, 1000);
        },

        msgProc(event) {
            if (event.message === wakaPAC.MSG_TIMER && event.wParam === this._timerId) {
                this.ticks++;
            }

            // Return `true` from msgProc to allow default processing
            // Return `false` to stop further handling.
            return true;
        }
    });
</script>
```

> Note: Properties starting with `_`, like _timerId, are not made reactive and are ignored by the binding engine.

## Mouse Capture

Mouse capture routes all mouse events to a specific component, even when the pointer leaves its container. This is useful for drag operations, drawing tools, and resize interactions.

```javascript
msgProc(event) {
    if (event.message === wakaPAC.MSG_LBUTTONDOWN) {
        wakaPAC.setCapture(this.pacId);
    }

    if (event.message === wakaPAC.MSG_LBUTTONUP) {
        wakaPAC.releaseCapture();
    }

    return true;
}
```

While capture is active, mouse move and button events are delivered to the captured component.

## Mouse Gesture Recognition

WakaPAC includes built-in mouse gesture recognition. While holding the right mouse button, pointer movement is recorded and matched against direction patterns. When a pattern matches, `msgProc` receives a `MSG_GESTURE` message.

### Example — Gesture Commands

```html
<div id="app">
  <p>Draw a right-button gesture</p>
</div>

<script>
    wakaPAC('#app', {
        msgProc(event) {
            if (event.message === wakaPAC.MSG_GESTURE) {
                switch (event.pattern) {
                    case 'left':
                        history.back();
                        break;

                    case 'right':
                        history.forward();
                        break;
                }
            }

            return true;
        }
    });
</script>
```

### Built-in Patterns

| Pattern      | Directions | Description     |
|--------------|------------|-----------------|
| `right`      | R          | Swipe right     |
| `left`       | L          | Swipe left      |
| `up`         | U          | Swipe up        |
| `down`       | D          | Swipe down      |
| `L`          | D, R       | Down then right |
| `inverted-L` | D, L       | Down then left  |

Register custom patterns:

```javascript
wakaPAC.registerGesture('refresh', ['U','D']);
wakaPAC.unregisterGesture('refresh');
```

## Component Communication

Components can communicate without DOM event wiring using built-in messaging helpers. Parent/child relationships are determined automatically from the DOM structure. If a WakaPAC container is nested inside another WakaPAC container, it is treated as a child component of that parent. No manual registration or wiring is required.

### Parent–Child

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

## HTTP Client Usage (WakaSync)

WakaPAC works well with WakaSync for HTTP requests. Simply instantiate WakaSync in your components where needed.

### Basic Usage

```javascript
wakaPAC('#app', {
    user: null,
    loading: false,
    error: null,

    init() {
        // Create HTTP client instance
        this.http = new WakaSync({
            timeout: 10000,
            retries: 1
        });
    },

    async loadUser() {
        this.loading = true;
        this.error = null;

        try {
            this.user = await this.http.get('/api/user');
        } catch (error) {
            this.error = error.message;
        } finally {
            this.loading = false;
        }
    }
});
```

## Core Features

- Central `msgProc` message pipeline for all input and system events
- Normalized event objects with message constants (wParam/lParam model)
- Built-in mouse gesture recognition (pattern detection + matching)
- Integrated timer system with message delivery
- Mustache-style interpolation
- Declarative attribute bindings
- Two-way inputs
- Deep reactive objects and arrays
- Computed properties
- Property watchers
- Parent–child component messaging
- Cross-container messaging
- No build tooling required

Full documentation: https://www.wakapac.com/docs

## License

MIT