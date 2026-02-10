# WakaPAC

A reactive UI library with a centralized desktop-style event engine — in a single ~60KB drop-in script. No build tools, no CLI, no node_modules.

## Why WakaPAC?

Most reactive libraries stop at data binding. WakaPAC adds a **centralized message pipeline** inspired by desktop UI frameworks — mouse input, keyboard events, timers, and gestures all flow through a single `msgProc` handler with normalized event objects. The result is reactive DOM updates *and* structured interaction logic in one lightweight runtime.

## Quick Start

```html
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

Where WakaPAC diverges from other reactive libraries: all browser events are normalized and delivered as messages to your component.

```javascript
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

Mouse capture, gesture recognition, keyboard handling, and timer delivery all work through this same pipeline.

## Features

- Central `msgProc` message pipeline for all input and system events
- Normalized event objects with message constants (wParam/lParam model)
- Built-in mouse gesture recognition
- Mouse capture support for drag-style interactions
- Integrated timer system with message delivery
- Declarative bindings, two-way inputs, computed properties, watchers
- Deep reactive objects and arrays
- Parent–child component messaging
- No build tooling required

## Documentation

Full docs, guides, and API reference: **[wakapac.com/docs](https://www.wakapac.com/docs)**

## License

MIT