## WakaPAC

A compact reactive UI runtime with a desktop-style event pipeline —
delivered as a single drop-in script. No build tools, no CLI, no
node_modules.

**~31KB gzipped** (~100KB minified) · zero dependencies · works with any
browser that supports `Proxy` (all evergreen browsers)

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

Optional, drop-in scripts that extend WakaPAC's message pipeline into specific domains. Full details for each: **[wakapac.com/docs](https://www.wakapac.com/docs)**

**Graphics & Canvas**
- **WakaCanvas** — Win32-style GDI drawing API: pens, brushes, and drawing primitives, plus a MetaFile API for recording, replaying, and hit-testing display lists
- **WakaChart** — pie, bar, line, and sparkline charts rendered onto WakaPAC canvas components via the metafile/display list API
- **WakaD3D** — WebGL/WebGL2 support for 3D/GPU-accelerated canvas drawing, with automatic context-loss recovery
- **WakaDDraw** — DirectDraw-inspired blitter: low-level pixel transfer plus a higher-level sprite/z-order/dirty-rect scene system, with a scrolling tilemap renderer
- **WakaDSound** — DirectSound-inspired audio: static and streaming buffers, 3D positional audio, waveform analysis, and playback/stream-health messages

**Data & Forms**
- **WakaStore** — shared reactive state across components, with server sync via polling, WebSocket, and HTTP push
- **WakaForm** — reactive form state and field-level validation with composable rules
- **WakaMask** — live input masking (phone numbers, dates, custom codes) driven by a token pattern, running entirely on WakaPAC's message pipeline
- **WakaSync** — full-featured HTTP client with request grouping, cancellation, retries, and interceptors

**Navigation & Sensors**
- **WakaRoute** — client-side router delivering navigation events through `msgProc`
- **WakaMotion** — device motion and orientation sensors as reactive properties

**Media Embeds**
- **WakaCKEditor** — bridges CKEditor 4 into WakaPAC, with content synced to `abstraction.value` and back to the textarea on form submit
- **WakaVideo** — bridges native `<video>` elements: playback control, volume, seek, playback rate, programmatic cues, and canvas frame capture
- **WakaYouTube** — bridges the YouTube IFrame API: playback control, volume, seek, and mute
- **WakaVimeo** — bridges the Vimeo Player SDK: playback control, volume, seek, mute, and playback rate (PRO/Business)
- **WakaLightGallery** — bridges lightGallery v2, exposing the full gallery lifecycle as `msgProc` messages, with sub-plugin support (zoom, thumbnails, autoplay, etc.)

## Documentation

Full docs, guides, and API reference:
**[wakapac.com/docs](https://www.wakapac.com/docs)**

## License

MIT
