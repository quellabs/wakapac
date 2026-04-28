## WakaPAC

A compact reactive UI runtime with a desktop-style event pipeline —
delivered as a single drop-in script. No build tools, no CLI, no
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

## Features

**Core**
- Centralized message pipeline for all UI and system events
- Reactive bindings, computed properties, watchers, deep reactive objects and arrays
- Parent–child component messaging

**Interaction**
- Mouse, keyboard, timers, gestures, clipboard, HTML5 drag & drop — all normalized through `msgProc`

**Canvas**
- Win32-style paint cycle with dirty rect accumulation and automatic clipping
- Metafile API: display list recording, playback, and hit testing

**Units** — optional utility libraries callable from templates and component methods:
Stdlib (built-in), Math, StringUtils, DateUtils, NumberUtils, TypeUtils, CollectionUtils, PhpUtils, RegexUtils, EscapeUtils, ColorUtils

## Plugins

**WakaCanvas** — Win32-style GDI drawing API for wakaPAC canvas components. Provides stateful device context management with pens, brushes, and a complete set of drawing primitives (lines, rectangles, ellipses, arcs, polygons, text, bitmaps). Includes a MetaFile API for recording, replaying, and hit-testing display lists — enabling resolution-independent rendering and decoupled paint logic.

**WakaDDraw** — DirectDraw-inspired blitter plugin for pixel-level canvas work. Provides a two-tier API: a low-level stateless blitter (`bltFast`) for immediate surface-to-surface pixel transfer with color key transparency, and a higher-level scene system that manages sprites, z-ordering, and dirty rectangle compositing automatically. Includes a tilemap renderer for scrolling tile-based worlds with parallax support via layered z-ordered tilemaps.

**WakaDSound** — DirectSound-inspired audio plugin for wakaPAC components. Manages static buffers for sound effects and streaming buffers for music and ambience. Includes 3D positional audio (opt-in per buffer), a waveform analyser with per-frame callback, and a rich message system that routes load, playback, and stream health events to the owning component automatically.

**WakaChart** — renders pie, bar, line, and sparkline charts onto WakaPAC canvas components via the metafile/display list API. Global defaults (colors, font, padding) are set at registration time; all options can be overridden per call.

**WakaStore** — shared reactive state across components, with server sync via polling, WebSocket, and HTTP push.

**WakaForm** — reactive form state and field-level validation with composable rules.

**WakaRoute** — client-side router delivering navigation events through `msgProc`.

**WakaMotion** — device motion and orientation sensors as reactive properties.

**WakaSync** — full-featured HTTP client with request grouping, cancellation, retries, and interceptors. Results delivered as `MSG_HTTP_SUCCESS`, `MSG_HTTP_ERROR`, or `MSG_HTTP_ABORT`.

**WakaCKEditor** — bridges CKEditor 4 into WakaPAC. Activate on any `<textarea data-ckeditor>` container; the CKEditor script is injected and shared automatically. Editor content is kept on `abstraction.value` on every change and synced back to the textarea on form submit, so native form posts work without extra handling.

**WakaVideo** — bridges native `<video>` elements into the WakaPAC message and abstraction model. Supports playback control, volume, seek, playback rate, programmatic cues (`addCue`), and canvas frame capture via `bitBlt`/`stretchBlt`.

**WakaYouTube** — bridges the YouTube IFrame API into WakaPAC. Activate on any `<div data-youtube-id="...">` container; the API script is injected and shared automatically. Supports playback control, volume, seek, and mute.

**WakaVimeo** — bridges the Vimeo Player SDK into WakaPAC. Activate on any `<div data-vimeo-id="...">` container; the SDK script is injected automatically. Supports playback control, volume, seek, mute, and playback rate (requires Vimeo PRO/Business).

## Documentation

Full docs, guides, and API reference:
**[wakapac.com/docs](https://www.wakapac.com/docs)**

## License

MIT