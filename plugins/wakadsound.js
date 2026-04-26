/*
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                               ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗ ███████╗ ██████╗ ██╗   ██╗███╗   ██╗██████╗        ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔════╝██╔═══██╗██║   ██║████╗  ██║██╔══██╗       ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║  ██║███████╗██║   ██║██║   ██║██╔██╗ ██║██║  ██║       ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║  ██║╚════██║██║   ██║██║   ██║██║╚██╗██║██║  ██║       ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝███████║╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝       ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝        ║
 * ║                                                                                               ║
 * ║  WakaDSound — DirectSound-inspired audio plugin for wakaPAC                                   ║
 * ║                                                                                               ║
 * ║  Static buffers for sound effects, streaming buffers for music/ambience.                      ║
 * ║  One playback slot per handle. play() is a no-op if already playing.                          ║
 * ║  The Web Audio node graph is entirely hidden from the caller.                                 ║
 * ║                                                                                               ║
 * ║  Usage:                                                                                       ║
 * ║    wakaPAC.use(wakaDSound);                                                                   ║
 * ║                                                                                               ║
 * ║  Device:                                                                                      ║
 * ║    WakaDSound.masterVolume(0.8)    // set master volume (0–1)                                 ║
 * ║    WakaDSound.suspend()            // suspend AudioContext (e.g. tab hidden)                  ║
 * ║    WakaDSound.resume()             // resume AudioContext                                     ║
 * ║                                                                                               ║
 * ║  Loading:                                                                                     ║
 * ║    const snd   = await WakaDSound.loadBuffer('/sfx/shoot.wav')                                ║
 * ║    const snd   = await WakaDSound.loadBuffer('/sfx/shoot.wav', { volume: 80, pan: -0.5 })     ║
 * ║    const snd3d = await WakaDSound.loadBuffer('/sfx/boom.wav', { positional: true })           ║
 * ║    const music = await WakaDSound.loadStream('/music/theme.ogg')                              ║
 * ║    const music = await WakaDSound.loadStream('/music/theme.ogg', { volume: 60, loop: true })  ║
 * ║                                                                                               ║
 * ║  Generic playback (works on both buffer and stream handles):                                  ║
 * ║    WakaDSound.play(handle)                                                                    ║
 * ║    WakaDSound.stop(handle)                                                                    ║
 * ║    WakaDSound.setVolume(handle, 0.5)                                                          ║
 * ║    WakaDSound.isPlaying(handle)    // → true | false                                          ║
 * ║    WakaDSound.free(handle)         // stop and release; handle is dead after this             ║
 * ║                                                                                               ║
 * ║  Buffer-only:                                                                                 ║
 * ║    WakaDSound.setPan(snd, -1.0)    // -1 left, 0 center, +1 right                             ║
 * ║                                                                                               ║
 * ║  Stream-only:                                                                                 ║
 * ║    WakaDSound.loop(music, true)                                                               ║
 * ║    WakaDSound.seek(music, 30.0)    // seek to position in seconds                             ║
 * ║                                                                                               ║
 * ║  3D positional audio (opt-in per buffer):                                                     ║
 * ║    WakaDSound.setPosition(snd3d, x, y, z)                                                     ║
 * ║    WakaDSound.setListenerPosition(x, y, z)                                                    ║
 * ║    WakaDSound.setListenerOrientation(fx, fy, fz)  // forward vector                           ║
 * ║                                                                                               ║
 * ║  Analyser:                                                                                    ║
 * ║    const a = WakaDSound.createAnalyser(data => { // Uint8Array each frame })                  ║
 * ║    const a = WakaDSound.createAnalyser(data => { ... }, { fftSize: 1024 })                    ║
 * ║    WakaDSound.destroyAnalyser(a)   // stop loop and remove from graph                         ║
 * ║                                                                                               ║
 * ║  Messages — broadcast to all components (global):                                             ║
 * ║    WakaDSound.MSG_BUFFER_LOADED   // wParam: 0, lParam: { url, buffer }                       ║
 * ║    WakaDSound.MSG_BUFFER_FAILED   // wParam: 0, lParam: { url, error }                        ║
 * ║    WakaDSound.MSG_STREAM_LOADED   // wParam: 0, lParam: { url, stream }                       ║
 * ║    WakaDSound.MSG_STREAM_FAILED   // wParam: 0, lParam: { url, error }                        ║
 * ║    WakaDSound.MSG_STREAM_ERROR    // wParam: 0, event.detail: { handle, error }               ║
 * ║    WakaDSound.MSG_STREAM_BUFFERING  // wParam: 0, event.detail: { handle }                    ║
 * ║    WakaDSound.MSG_STREAM_READY // wParam: 0, event.detail: { handle }                         ║
 * ║                                                                                               ║
 * ║  Messages — sent to owning component only (handle must be in abstraction root):               ║
 * ║    WakaDSound.MSG_BUFFER_STARTED  // wParam: 0, lParam: { handle }                            ║
 * ║    WakaDSound.MSG_BUFFER_STOPPED  // wParam: 0, lParam: { handle }                            ║
 * ║    WakaDSound.MSG_STREAM_STARTED  // wParam: 0, lParam: { handle }                            ║
 * ║    WakaDSound.MSG_STREAM_STOPPED  // wParam: 0, lParam: { handle }                            ║
 * ║    WakaDSound.MSG_VOLUME_CHANGED  // wParam: 0, lParam: { handle, volume }                    ║
 * ║    WakaDSound.MSG_PAN_CHANGED     // wParam: 0, lParam: { handle, pan }                       ║
 * ║                                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /** @type {string} */
    const VERSION = '1.0.0';

    // =========================================================================
    // MESSAGES
    // =========================================================================

    const MSG_BUFFER_LOADED = 0xD001;
    const MSG_BUFFER_FAILED = 0xD002;
    const MSG_STREAM_LOADED = 0xD003;
    const MSG_STREAM_FAILED = 0xD004;
    const MSG_STREAM_ERROR = 0xD00C;
    const MSG_STREAM_BUFFERING = 0xD00D;
    const MSG_STREAM_READY = 0xD00E;
    const MSG_BUFFER_STARTED = 0xD006;
    const MSG_BUFFER_STOPPED = 0xD007;
    const MSG_STREAM_STARTED = 0xD008;
    const MSG_STREAM_STOPPED = 0xD009;
    const MSG_VOLUME_CHANGED = 0xD00A;
    const MSG_PAN_CHANGED = 0xD00B;

    // =========================================================================
    // STATE
    // =========================================================================

    /** @type {Object|null} Cached wakaPAC reference, set in createPacPlugin(). */
    let _pac = null;

    /** @type {AudioContext|null} */
    let _ctx = null;

    /** @type {GainNode|null} Master gain node — all sounds route through this. */
    let _masterGain = null;

    // =========================================================================
    // AUDIO CONTEXT MANAGEMENT
    //
    // Browsers require a user gesture before AudioContext can run.
    // _ensureContext() creates it lazily on first play() or resume() call.
    // =========================================================================

    /**
     * Creates the AudioContext and master gain node if not already created.
     * Safe to call multiple times — idempotent.
     * @returns {AudioContext}
     */
    function _ensureContext() {
        if (_ctx) {
            return _ctx;
        }

        // webkitAudioContext is the legacy prefix for Safari < 14.1
        _ctx = new (window.AudioContext || window.webkitAudioContext)();

        // All audio routes through this node so masterVolume() works globally
        _masterGain = _ctx.createGain();
        _masterGain.connect(_ctx.destination);
        return _ctx;
    }

    // =========================================================================
    // HANDLE OWNERSHIP LOOKUP
    //
    // Finds the pacId of the component whose abstraction contains the given
    // handle as a top-level property value. Used to route per-handle events
    // to the owning component via sendMessage rather than broadcastMessage.
    // Returns null if no owner is found or wakaPAC is not available.
    // =========================================================================

    /**
     * Returns the pacId of the component that owns the handle, or null.
     * Ownership is determined by a top-level reference equality scan of each
     * component's abstraction. The search stops at the first match.
     * @param {Object} handle  Buffer or stream handle
     * @returns {string|null}
     */
    function _findOwner(handle) {
        if (!_pac || !window.PACRegistry) {
            return null;
        }

        let owner = null;

        window.PACRegistry.components.forEach((context, pacId) => {
            if (owner) {
                return;
            }

            const abstraction = context.abstraction;

            if (!abstraction) {
                return;
            }

            // Values read from the abstraction proxy may themselves be reactive
            // proxies wrapping the raw handle. Unwrap via .unwrap() — a method
            // injected by wakapac.js into every reactive proxy via proxyGetHandler.
            const found = Object.values(abstraction).some(v => {
                const unwrapped = typeof v?.unwrap === 'function' ? v.unwrap() : v;
                return unwrapped === handle;
            });

            if (found) {
                owner = pacId;
            }
        });

        return owner;
    }

    /**
     * Sends a per-handle message to the owning component, or no-op if the
     * handle has no registered owner or wakaPAC is unavailable.
     * @param {Object} handle
     * @param {number} msg
     * @param {number} wParam
     * @param {number} lParam
     * @param {Object} extended
     */
    function _sendToOwner(handle, msg, wParam, lParam, extended) {
        if (!_pac) {
            return;
        }

        const pacId = _findOwner(handle);

        if (pacId) {
            _pac.sendMessage(pacId, msg, wParam, lParam, extended);
        }
    }

    // =========================================================================
    // BUFFER HANDLES
    //
    // A buffer handle is a plain object:
    // {
    //   _type:        'buffer',
    //   _audioBuffer: AudioBuffer,                   // decoded PCM
    //   _source:      AudioBufferSourceNode | null,  // active node; null when idle
    //   _gainNode:    GainNode,                      // per-handle gain
    //   _panNode:     StereoPannerNode | null,        // stereo pan (non-positional)
    //   _pannerNode:  PannerNode | null,             // 3D panner (positional only)
    //   _positional:  boolean,
    //   _playing:     boolean,
    //   _volume:      number,
    //   _pan:         number,
    // }
    //
    // AudioBufferSourceNode is single-use in Web Audio — once started it cannot
    // be restarted. _startBuffer() always creates a fresh node; _stopBuffer()
    // disconnects it. The buffer handle remains valid across play/stop cycles.
    // =========================================================================

    /**
     * Wires a new AudioBufferSourceNode for a buffer handle and starts it.
     * Assumes the AudioContext is running. Called from _playBuffer() only.
     * @param {Object} buf
     */
    function _startBuffer(buf) {
        const source = _ctx.createBufferSource();
        source.buffer = buf._audioBuffer;

        // When the sound ends naturally, mark it stopped and release the node.
        source.onended = function() {
            if (buf._source === source) {
                buf._source = null;
                buf._playing = false;

                _sendToOwner(buf, MSG_BUFFER_STOPPED, 0, 0, { handle: buf });
            }
        };

        // Wire: source → gainNode → panNode|pannerNode → masterGain → destination
        source.connect(buf._gainNode);

        buf._source = source;
        buf._playing = true;
        source.start(0);

        _sendToOwner(buf, MSG_BUFFER_STARTED, 0, 0, { handle: buf });
    }

    /**
     * Stops an active buffer. Updates state immediately — does not rely on onended.
     * No-op if not playing.
     * @param {Object} buf
     */
    function _stopBuffer(buf) {
        if (!buf._playing) {
            return;
        }

        try {
            buf._source.stop();
            buf._source.disconnect();
        } catch (_) {
            // Already stopped or never started
        }

        buf._source = null;
        buf._playing = false;

        _sendToOwner(buf, MSG_BUFFER_STOPPED, 0, 0, { handle: buf });
    }

    /**
     * Plays a buffer handle. No-op if already playing.
     * @param {Object} buf
     */
    function _playBuffer(buf) {
        if (buf._playing) {
            return;
        }

        // Resume first if the context was suspended by the browser's autoplay policy,
        // then start once the promise resolves.
        if (_ctx.state === 'suspended') {
            _ctx.resume().then(() => _startBuffer(buf));
        } else {
            _startBuffer(buf);
        }
    }

    /**
     * Releases all Web Audio nodes for a buffer handle.
     * Caller must stop playback first.
     * @param {Object} buf
     */
    function _freeBuffer(buf) {
        try {
            buf._gainNode.disconnect();
            buf._panNode && buf._panNode.disconnect();
            buf._pannerNode && buf._pannerNode.disconnect();
        } catch (_) {
            // Already disconnected
        }

        buf._audioBuffer = null;
        buf._gainNode = null;
        buf._panNode = null;
        buf._pannerNode = null;

        // Poison the handle so any subsequent API calls silently no-op
        buf._type = null;
    }

    // =========================================================================
    // STREAM HANDLES
    //
    // A stream handle wraps an HTMLAudioElement fed into a MediaElementSourceNode.
    // This avoids AudioWorklet complexity for long-form audio while still routing
    // through the Web Audio graph for volume control.
    //
    // {
    //   _type:      'stream',
    //   _el:        HTMLAudioElement,
    //   _source:    MediaElementAudioSourceNode | null,
    //   _gainNode:  GainNode,
    //   _volume:    number,
    //   _connected: boolean,   // MediaElementSourceNode is one-time per element
    //   _pending:   boolean,   // play() promise in flight — guards against rapid double-call race
    // }
    //
    // Streams are single-use: stop() auto-frees the handle. Reload to play again.
    // =========================================================================

    /**
     * Creates the MediaElementSourceNode for a stream on first play.
     * Idempotent — safe to call multiple times.
     * @param {Object} stream
     */
    function _ensureStreamConnected(stream) {
        if (stream._connected) {
            return;
        }

        // MediaElementAudioSourceNode can only be created once per element —
        // creating it a second time throws. The flag prevents that.
        const source = _ctx.createMediaElementSource(stream._el);
        source.connect(stream._gainNode);
        stream._source = source;
        stream._connected = true;
    }

    /**
     * Plays a stream handle. No-op if already playing.
     * @param {Object} stream
     */
    function _playStream(stream) {
        // _pending guards against a rapid double-call race where paused is still
        // true while the play() promise is already in flight.
        if (!stream._el.paused || stream._pending) {
            return;
        }

        stream._pending = true;

        _ensureStreamConnected(stream);

        const resume = _ctx.state === 'suspended' ? _ctx.resume() : Promise.resolve();

        resume.then(() => stream._el.play().then(() => {
            _sendToOwner(stream, MSG_STREAM_STARTED, 0, 0, { handle: stream });
        }).catch(() => {}))
            .finally(() => {
                stream._pending = false;
            });
    }

    /**
     * Stops a stream and resets playback to the beginning.
     * @param {Object} stream
     */
    function _stopStream(stream) {
        // Pause the stream and rewind to 0
        stream._el.pause();
        stream._el.currentTime = 0;

        // Send stop event to owner
        _sendToOwner(stream, MSG_STREAM_STOPPED, 0, 0, { handle: stream });

        // Streams are auto-freed on stop to prevent accumulation of dangling
        // media nodes. The handle is poisoned after this — do not reuse it.
        _freeStream(stream);
    }

    /**
     * Releases all resources for a stream handle.
     * Caller must stop playback first.
     * @param {Object} stream
     */
    function _freeStream(stream) {
        stream._el.src = '';
        stream._el.load();      // Abort any pending network activity

        try {
            stream._source && stream._source.disconnect();
            stream._gainNode && stream._gainNode.disconnect();
        } catch (_) {
            // Already disconnected
        }

        stream._el = null;
        stream._source = null;
        stream._gainNode = null;
        stream._type = null;    // Poison the handle
    }

    // =========================================================================
    // WAKA DSOUND
    // =========================================================================

    /**
     * WakaDSound — DirectSound-inspired audio plugin for wakaPAC.
     * @constructor
     */
    function WakaDSound() {
    }

    WakaDSound.prototype = {
        constructor: WakaDSound,

        // ─── Plugin registration ──────────────────────────────────────────────

        /**
         * Called by wakaPAC.use(WakaDSound).
         * @param {Object} pac
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin(pac) {
            _pac = pac;
            return { name: 'WakaDSound' };
        },

        // ─── Device ───────────────────────────────────────────────────────────

        /**
         * Sets the master volume for all sounds and streams.
         * @param {number} volume  0–1
         */
        masterVolume(volume) {
            _ensureContext();
            _masterGain.gain.setValueAtTime(
                Math.max(0, Math.min(100, volume)) / 100,
                _ctx.currentTime
            );
        },

        /**
         * Suspends the AudioContext. Call when the page is hidden or audio
         * should be completely silenced (e.g. on Page Visibility API hidden event).
         * @returns {Promise<void>}
         */
        async suspend() {
            if (_ctx && _ctx.state === 'running') {
                await _ctx.suspend();
            }
        },

        /**
         * Resumes the AudioContext. Must be called from a user gesture context
         * if the context was suspended by autoplay policy.
         * @returns {Promise<void>}
         */
        async resume() {
            _ensureContext();

            if (_ctx.state === 'suspended') {
                await _ctx.resume();
            }
        },

        // ─── Loading ──────────────────────────────────────────────────────────

        /**
         * Fetches, decodes, and returns a buffer handle for a sound effect URL.
         *
         * The returned handle is the single playback slot for this sound.
         * play() is a no-op if already playing. stop() is always safe.
         *
         * @param {string} url
         * @param {Object}  [options]
         * @param {number}  [options.volume=1.0]       Initial volume (0–1)
         * @param {number}  [options.pan=0]            Initial stereo pan (-1–1); ignored for positional
         * @param {boolean} [options.positional=false] Enable 3D positional audio
         * @returns {Promise<Object|null>}  Buffer handle, or null on failure
         */
        async loadBuffer(url, options = {}) {
            if (!url) {
                console.warn('WakaDSound.loadBuffer: url is required');
                return null;
            }

            _ensureContext();

            let audioBuffer;

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await _ctx.decodeAudioData(arrayBuffer);
            } catch (err) {
                console.warn(`WakaDSound.loadBuffer: failed to load "${url}"`, err);

                if (_pac) {
                    _pac.broadcastMessage(MSG_BUFFER_FAILED, 0, 0, { url, error: err });
                }

                return null;
            }

            const positional = !!options.positional;
            const volume = Math.max(0, Math.min(100, options.volume ?? 100));
            const pan = Math.max(-1, Math.min(1, options.pan ?? 0));

            const gainNode = _ctx.createGain();
            gainNode.gain.value = volume / 100;

            let panNode = null;
            let pannerNode = null;

            if (positional) {
                // source → gain → panner (3D) → master
                // HRTF gives head-related transfer function spatialization.
                // Inverse distance model attenuates naturally with distance.
                pannerNode = _ctx.createPanner();
                pannerNode.panningModel = 'HRTF';
                pannerNode.distanceModel = 'inverse';
                pannerNode.refDistance = 1;
                pannerNode.maxDistance = 10000;
                pannerNode.rolloffFactor = 1;
                gainNode.connect(pannerNode);
                pannerNode.connect(_masterGain);
            } else {
                // source → gain → stereoPanner → master
                panNode = _ctx.createStereoPanner();
                panNode.pan.value = pan;
                gainNode.connect(panNode);
                panNode.connect(_masterGain);
            }

            const buf = {
                _type: 'buffer',
                _audioBuffer: audioBuffer,
                _source: null,
                _gainNode: gainNode,
                _panNode: panNode,
                _pannerNode: pannerNode,
                _positional: positional,
                _playing: false,
                _volume: volume,
                _pan: pan,
            };

            if (_pac) {
                _pac.broadcastMessage(MSG_BUFFER_LOADED, 0, 0, { url, buffer: buf });
            }

            return buf;
        },

        /**
         * Creates a stream handle for long-form audio (music, ambience, narration).
         *
         * Internally uses an HTMLAudioElement fed into a MediaElementSourceNode.
         * The element is not attached to the DOM and does not play until play()
         * is called.
         *
         * @param {string}  url
         * @param {Object}  [options]
         * @param {number}  [options.volume=1.0]  Initial volume (0–1)
         * @param {boolean} [options.loop=false]  Whether the stream loops
         * @returns {Promise<Object|null>}  Stream handle, or null on failure
         */
        async loadStream(url, options = {}) {
            if (!url) {
                console.warn('WakaDSound.loadStream: url is required');
                return null;
            }

            _ensureContext();

            const volume = Math.max(0, Math.min(100, options.volume ?? 100));

            const el = new Audio();
            el.preload = 'auto';
            el.crossOrigin = 'anonymous';
            el.loop = !!options.loop;

            // canplay fires as soon as the browser has enough data to begin playback,
            // without waiting for the full file — sufficient for streaming use cases.
            const loadResult = await new Promise((resolve) => {
                el.addEventListener('canplay', () => resolve(true), { once: true });
                el.addEventListener('error', () => resolve(false), { once: true });
                el.src = url;
                el.load();
            });

            if (!loadResult) {
                console.warn(`WakaDSound.loadStream: failed to load "${url}"`);

                if (_pac) {
                    _pac.broadcastMessage(MSG_STREAM_FAILED, 0, 0, { url, error: el.error });
                }

                return null;
            }

            const gainNode = _ctx.createGain();
            gainNode.gain.value = volume / 100;
            gainNode.connect(_masterGain);

            const stream = {
                _type: 'stream',
                _el: el,
                _source: null,
                _gainNode: gainNode,
                _volume: volume,
                _connected: false,
                _pending: false,
            };

            el.addEventListener('ended', () => {
                _sendToOwner(stream, MSG_STREAM_STOPPED, 0, 0, { handle: stream });
            });

            // Surface mid-playback failures so state stays consistent
            const _onMediaError = () => {
                if (!stream._type) {
                    return;  // already freed
                }

                // already freed
                stream._pending = false;

                // Report stream error
                _sendToOwner(stream, MSG_STREAM_ERROR, 0, 0, { handle: stream, error: el.error });
            };

            el.addEventListener('error', _onMediaError);
            el.addEventListener('abort', _onMediaError);

            // Track stall state so MSG_STREAM_READY is only sent after an actual stall.
            let _stalled = false;

            el.addEventListener('stalled', () => {
                if (!stream._type) {
                    return;
                }

                _stalled = true;

                _sendToOwner(stream, MSG_STREAM_BUFFERING, 0, 0, { handle: stream });
            });

            const _onUnstalled = () => {
                if (!stream._type || !_stalled) {
                    return;
                }

                _stalled = false;

                _sendToOwner(stream, MSG_STREAM_READY, 0, 0, { handle: stream });
            };

            el.addEventListener('playing', _onUnstalled);
            el.addEventListener('canplay', _onUnstalled);

            if (_pac) {
                _pac.broadcastMessage(MSG_STREAM_LOADED, 0, 0, { url, stream });
            }

            return stream;
        },

        // ─── Generic playback ─────────────────────────────────────────────────

        /**
         * Plays a buffer or stream handle. No-op if already playing.
         * Resumes the AudioContext automatically if suspended by autoplay policy.
         *
         * @param {Object} handle  Buffer or stream handle
         */
        play(handle) {
            if (!handle) {
                return;
            }

            if (handle._type === 'buffer') {
                _playBuffer(handle);
            } else if (handle._type === 'stream') {
                _playStream(handle);
            }
        },

        /**
         * Stops a buffer or stream. No-op if not playing.
         * For buffers: resets to the beginning. The handle remains valid and can be played again.
         * For streams: auto-frees the handle. The handle must not be used after this call.
         *
         * @param {Object} handle  Buffer or stream handle
         */
        stop(handle) {
            if (!handle) {
                return;
            }

            if (handle._type === 'buffer') {
                _stopBuffer(handle);
            } else if (handle._type === 'stream') {
                _stopStream(handle);
            }
        },

        /**
         * Sets the volume for a buffer or stream handle.
         * Takes effect immediately, whether playing or not.
         *
         * @param {Object} handle  Buffer or stream handle
         * @param {number} volume  0–1
         */
        setVolume(handle, volume) {
            if (!handle || !handle._gainNode) {
                return;
            }

            if (handle._type !== 'buffer' && handle._type !== 'stream') {
                return;
            }

            handle._volume = Math.max(0, Math.min(100, volume));
            handle._gainNode.gain.setValueAtTime(handle._volume / 100, _ctx.currentTime);

            _sendToOwner(handle, MSG_VOLUME_CHANGED, 0, 0, { handle, volume: handle._volume });
        },

        /**
         * Returns true if a buffer or stream handle is currently playing.
         *
         * @param {Object} handle  Buffer or stream handle
         * @returns {boolean}
         */
        isPlaying(handle) {
            if (!handle) {
                return false;
            }

            if (handle._type === 'buffer') {
                return handle._playing;
            }

            if (handle._type === 'stream') {
                return !handle._el.paused && !handle._el.ended;
            }

            return false;
        },

        /**
         * Stops playback and releases all resources for a buffer or stream handle.
         * The handle must not be used after this call.
         *
         * @param {Object} handle  Buffer or stream handle
         */
        free(handle) {
            if (!handle) {
                return;
            }

            if (handle._type === 'buffer') {
                _stopBuffer(handle);
                _freeBuffer(handle);
            } else if (handle._type === 'stream') {
                _stopStream(handle);
                _freeStream(handle);
            }
        },

        // ─── Buffer-only ──────────────────────────────────────────────────────

        /**
         * Sets the stereo pan for a non-positional buffer handle.
         * No-op for positional buffers (use setPosition() instead) and streams.
         *
         * @param {Object} handle  Buffer handle
         * @param {number} pan     -1 (left) to +1 (right), 0 = center
         */
        setPan(handle, pan) {
            if (!handle || handle._type !== 'buffer' || !handle._panNode) {
                return;
            }

            handle._pan = Math.max(-1, Math.min(1, pan));
            handle._panNode.pan.setValueAtTime(handle._pan, _ctx.currentTime);

            _sendToOwner(handle, MSG_PAN_CHANGED, 0, 0, { handle, pan: handle._pan });
        },

        // ─── Stream-only ──────────────────────────────────────────────────────

        /**
         * Enables or disables looping for a stream handle.
         * Takes effect immediately, whether playing or not.
         * No-op for buffer handles.
         *
         * @param {Object}  handle  Stream handle
         * @param {boolean} loop
         */
        loop(handle, loop) {
            if (!handle || handle._type !== 'stream') {
                return;
            }

            handle._el.loop = !!loop;
        },

        /**
         * Seeks to a position in a stream handle.
         * No-op for buffer handles.
         *
         * @param {Object} handle   Stream handle
         * @param {number} seconds  Playback position in seconds
         */
        seek(handle, seconds) {
            if (!handle || handle._type !== 'stream') {
                return;
            }

            handle._el.currentTime = Math.max(0, seconds);
        },

        // ─── 3D Positional audio ──────────────────────────────────────────────

        /**
         * Sets the 3D position of a positional buffer's sound source.
         * No-op for non-positional buffers and streams.
         *
         * @param {Object} handle  Buffer handle (loaded with { positional: true })
         * @param {number} x
         * @param {number} y
         * @param {number} z
         */
        setPosition(handle, x, y, z) {
            if (!handle || handle._type !== 'buffer' || !handle._pannerNode) {
                return;
            }

            if (handle._pannerNode.positionX) {
                handle._pannerNode.positionX.setValueAtTime(x, _ctx.currentTime);
                handle._pannerNode.positionY.setValueAtTime(y, _ctx.currentTime);
                handle._pannerNode.positionZ.setValueAtTime(z, _ctx.currentTime);
            } else {
                handle._pannerNode.setPosition(x, y, z);
            }
        },

        /**
         * Sets the listener position in 3D space.
         * Affects all positional buffers simultaneously.
         * @param {number} x
         * @param {number} y
         * @param {number} z
         */
        setListenerPosition(x, y, z) {
            _ensureContext();
            const listener = _ctx.listener;

            // AudioParam setters are preferred; setPosition() is deprecated
            // but still needed for older Safari.
            if (listener.positionX) {
                listener.positionX.setValueAtTime(x, _ctx.currentTime);
                listener.positionY.setValueAtTime(y, _ctx.currentTime);
                listener.positionZ.setValueAtTime(z, _ctx.currentTime);
            } else {
                listener.setPosition(x, y, z);
            }
        },

        /**
         * Sets the listener's forward orientation vector.
         * The up vector is fixed at (0, 1, 0) — sufficient for 2D-plane
         * positional audio, which is the common case.
         * @param {number} x  Forward X component
         * @param {number} y  Forward Y component
         * @param {number} z  Forward Z component
         */
        setListenerOrientation(x, y, z) {
            _ensureContext();
            const listener = _ctx.listener;

            // Use AudioParam setters where available (modern browsers).
            // Fall back to the deprecated setOrientation() for older Safari.
            if (listener.forwardX) {
                listener.forwardX.setValueAtTime(x, _ctx.currentTime);
                listener.forwardY.setValueAtTime(y, _ctx.currentTime);
                listener.forwardZ.setValueAtTime(z, _ctx.currentTime);
                listener.upX.setValueAtTime(0, _ctx.currentTime);
                listener.upY.setValueAtTime(1, _ctx.currentTime);
                listener.upZ.setValueAtTime(0, _ctx.currentTime);
            } else {
                listener.setOrientation(x, y, z, 0, 1, 0);
            }
        },

        // ─── Analyser ─────────────────────────────────────────────────────────────

        /**
         * Inserts an AnalyserNode into the master audio graph and starts a RAF
         * loop that calls the provided callback with time-domain waveform data
         * on every animation frame. The loop pauses automatically when the
         * AudioContext is suspended and resumes when it runs again.
         *
         * The callback receives a pre-allocated Uint8Array of time-domain samples
         * on each frame. The same buffer is reused across frames — do not store
         * a reference to it; copy the data if you need it to persist.
         *
         * Returns an analyser handle that must be passed to destroyAnalyser()
         * when the oscilloscope is no longer needed.
         *
         * @param {Function} callback  Called each frame with (data: Uint8Array)
         * @param {Object}   [options]
         * @param {number}   [options.fftSize=2048]  FFT size. Must be a power of 2.
         * @returns {Object|null}  Analyser handle, or null if context unavailable
         */
        createAnalyser(callback, options = {}) {
            if (typeof callback !== 'function') {
                console.warn('WakaDSound.createAnalyser: callback is required');
                return null;
            }

            _ensureContext();

            const node = _ctx.createAnalyser();
            node.fftSize = options.fftSize ?? 2048;

            // Tap off master gain: masterGain → analyser → destination
            // We reconnect masterGain through the analyser so all audio is captured.
            _masterGain.disconnect();
            _masterGain.connect(node);
            node.connect(_ctx.destination);

            const data = new Uint8Array(node.frequencyBinCount);
            let rafId = null;
            let stopped = false;

            const handle = {
                _type: 'analyser',
                _node: node,
                _callback: callback,
                _data: data,
            };

            function tick() {
                if (stopped) {
                    return;
                }

                // Get a animation frame
                rafId = requestAnimationFrame(tick);

                // Skip data collection while suspended — avoids flat-line
                // waveforms being delivered to the callback during silence.
                if (_ctx.state !== 'running') {
                    return;
                }

                // Reuse the same Uint8Array to avoid GC pressure at 60fps
                node.getByteTimeDomainData(data);
                callback(data);
            }

            rafId = requestAnimationFrame(tick);

            handle._stop = () => {
                stopped = true;
                cancelAnimationFrame(rafId);
            };

            return handle;
        },

        /**
         * Stops the RAF loop and removes the AnalyserNode from the audio graph.
         * The handle must not be used after this call.
         *
         * @param {Object} handle  Analyser handle from createAnalyser()
         */
        destroyAnalyser(handle) {
            if (!handle || handle._type !== 'analyser') {
                return;
            }

            handle._stop();

            // Restore direct masterGain → destination connection
            try {
                handle._node.disconnect();
                _masterGain.disconnect();
            } catch (_) {
                // Nodes may already be disconnected
            }

            _masterGain.connect(_ctx.destination);

            handle._type = null;
        }
    };

    // =========================================================================
    // EXPORTS
    // =========================================================================

    /** @type {string} */
    WakaDSound.VERSION = VERSION;

    WakaDSound.MSG_BUFFER_LOADED = MSG_BUFFER_LOADED;
    WakaDSound.MSG_BUFFER_FAILED = MSG_BUFFER_FAILED;
    WakaDSound.MSG_STREAM_LOADED = MSG_STREAM_LOADED;
    WakaDSound.MSG_STREAM_FAILED = MSG_STREAM_FAILED;
    WakaDSound.MSG_BUFFER_STARTED = MSG_BUFFER_STARTED;
    WakaDSound.MSG_BUFFER_STOPPED = MSG_BUFFER_STOPPED;
    WakaDSound.MSG_STREAM_STARTED = MSG_STREAM_STARTED;
    WakaDSound.MSG_STREAM_STOPPED = MSG_STREAM_STOPPED;
    WakaDSound.MSG_VOLUME_CHANGED = MSG_VOLUME_CHANGED;
    WakaDSound.MSG_PAN_CHANGED = MSG_PAN_CHANGED;
    WakaDSound.MSG_STREAM_ERROR      = MSG_STREAM_ERROR;
    WakaDSound.MSG_STREAM_BUFFERING  = MSG_STREAM_BUFFERING;
    WakaDSound.MSG_STREAM_READY      = MSG_STREAM_READY;

    /** @type {WakaDSound} */
    const wakaDSound = new WakaDSound();

    window.WakaDSound = WakaDSound;
    window.wakaDSound = wakaDSound;

})();