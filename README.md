## WakaPAC

A compact reactive UI runtime with a desktop-style event pipeline ---
delivered as a single ~70KB drop-in script. No build tools, no CLI, no
node_modules.

## Why WakaPAC?

Most reactive libraries stop at data binding. WakaPAC routes **all interaction through a centralized message pipeline**, inspired by desktop UI frameworks.
Instead of scattering event listeners, timers, and gesture logic across your code, everything flows through a single `msgProc` handler with normalized events.
You get reactive DOM updates *and* predictable interaction logic in one lightweight runtime.

## Quick Start

``` html
<script src="https://cdn.jsdelivr.net/gh/quellabs/wakapac@main/wakapac.min.js"></script>

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

Two-way binding, reactive updates, zero configuration.

## The Message Pipeline

WakaPAC unifies browser input, timers, and system events into a single
component handler:

``` javascript
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
```

Mouse input, keyboard events, timers, and gestures are normalized and
delivered through the same pipeline --- simplifying complex UI behavior.

## Features

**Core architecture**

-   Centralized message pipeline for all UI and system events
-   Normalized desktop-style event model
-   Parent--child component messaging

**Reactive system**

-   Declarative bindings with two-way inputs
-   Computed properties and watchers
-   Deep reactive objects and arrays

**Interaction primitives**

-   Integrated timers with message delivery
-   Mouse capture for drag-style interactions
-   Built-in gesture recognition
-   Clipboard integration
-   HTML5 drag & drop with normalized behavior

No build tooling required.

## Documentation

Full docs, guides, and API reference:
**[wakapac.com/docs](https://www.wakapac.com/docs)**

## License

MIT