# WakaPAC

A reactive UI library with a centralized desktop-style event engine — in a single ~60KB drop-in script. WakaPAC combines declarative data binding with a message-based event system. You get automatic DOM updates and full low-level input control without a framework stack or build step. No bundler. No dependencies. Include and run.

## Installation

```html
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional HTTP client -->
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

Bindings are declared with `data-pac-bind` attributes. Multiple bindings can be combined with commas.

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

### Multiple Bindings

```html
<input data-pac-bind="value: name, class: { invalid: hasError }">
```

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
    message: 0x0201,               // Message type from MSG_TYPES constants
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

> Note: This is not a complete list. See the full message constant reference in the documentation.

Bindings update the DOM from state changes. `msgProc` updates state and behavior from messages. This keeps DOM synchronization and interaction logic separate while operating on the same component state.

## Quick Examples

The following examples show the core execution model in practice.

### Reactive State + Two-Way Binding

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

State updates the DOM. Input updates state. No listeners required.

### Computed Property

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

Computed values recalculate automatically.

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

            return true;
        }
    });
</script>
```

Input, timers, and system events are handled in one place.

## Mouse Gesture Recognition

WakaPAC includes built-in mouse gesture recognition. While holding the right mouse button, pointer movement is recorded and matched against direction patterns. When a pattern matches, `msgProc` receives a `MSG_GESTURE` message. Gesture tracking and pattern matching are built in and delivered as MSG_GESTURE messages.

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

                    case 'L': // down → right
                        this.closeTab();
                        break;
                }
            }

            return true;
        },

        closeTab() {
            console.log('Close action');
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