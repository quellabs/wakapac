
# WakaPAC

A reactive UI library with a centralized desktop-style event engine — in a single ~60KB drop-in script. WakaPAC combines declarative data binding with a message-based event system. You get automatic DOM updates and full low-level input control without a framework stack or build step. No bundler. No dependencies. Include and run.

## Introduction

WakaPAC provides two capabilities that are normally split across separate libraries:

1. **Reactive data binding** — declare your state, bind it to HTML, and the DOM updates automatically. Supports two-way binding, computed properties, watchers, and deep reactivity for nested objects and arrays.
2. **Desktop-style event system** — a centralized `msgProc` receives normalized messages for mouse, keyboard, timers, and gestures.

## Quick Examples

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

## Mouse Gesture Recognition (Why `msgProc` Exists)

WakaPAC includes built-in mouse gesture recognition. While holding the right mouse button, pointer movement is recorded and matched against direction patterns. When a pattern matches, `msgProc` receives a `MSG_GESTURE` message.

No per-element listeners. No custom tracking logic. No gesture state machines.

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

What you get automatically:

- Direction detection
- Pattern matching
- Start/end coordinates
- Gesture duration
- Direction sequence

All delivered through the same message pipeline as clicks, keys, and timers.

### Built-in Patterns

- `left`, `right`, `up`, `down`
- `L` (down → right)
- `inverted-L` (down → left)

Register custom patterns:

```javascript
wakaPAC.registerGesture('refresh', ['U','D']);
```


## Installation

```html
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

<!-- Optional HTTP client -->
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakasync.min.js"></script>
```

## Core Features

- Central `msgProc` message pipeline for all input and system events
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