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

## Plugins

**WakaStore** adds a shared reactive state layer across components. A store is created once and mounted on any number of components under any property name --- mutations to the store propagate automatically to every subscriber, keeping all components in sync without manual coordination. The plugin also supports server synchronization via polling and push to JSON:API endpoints, with optional custom merge logic for non-standard response formats.

**WakaMotion** exposes device motion and orientation sensors as reactive properties injected into every component. It normalizes the browser's DeviceMotion API into tilt angles, raw acceleration, and rotation rates, handles the iOS 13+ permission flow, and provides a configurable threshold and axis inversion system to filter noise and correct for inconsistent sensor orientation across devices.

**WakaSync** is a full-featured HTTP client built to integrate with wakaPAC's message pipeline. It supports request grouping and cancellation, automatic retries with fixed, linear, or exponential backoff, and request/response interceptors. Completed requests deliver `MSG_HTTP_SUCCESS`, `MSG_HTTP_ERROR`, or `MSG_HTTP_ABORT` messages directly to the component's `msgProc`, keeping HTTP responses in the same predictable event flow as the rest of the runtime.

## Documentation

Full docs, guides, and API reference:
**[wakapac.com/docs](https://www.wakapac.com/docs)**

## License

MIT