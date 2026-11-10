/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██╗   ██╗██╗██████╗ ███████╗ ██████╗              ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██║   ██║██║██╔══██╗██╔════╝██╔═══██╗             ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║   ██║██║██║  ██║█████╗  ██║   ██║             ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║╚██╗ ██╔╝██║██║  ██║██╔══╝  ██║   ██║             ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║ ╚████╔╝ ██║██████╔╝███████╗╚██████╔╝             ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝              ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaVideo                                                          ║
 * ║                                                                                      ║
 * ║  Wraps <video> elements inside PAC containers, bridging the HTML video API           ║
 * ║  into the WakaPAC message and abstraction model.                                     ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaVideo);                                                           ║
 * ║                                                                                      ║
 * ║  The plugin activates only when the PAC container's root element is a                ║
 * ║  <video> element. It sends video messages to msgProc as playback events occur.       ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_VIDEO_PLAY       — playback started (play event)                              ║
 * ║    MSG_VIDEO_PAUSE      — playback paused (pause event)                              ║
 * ║    MSG_VIDEO_ENDED      — playback reached end (ended event)                         ║
 * ║    MSG_VIDEO_SEEK          — seek completed; wParam = ms (truncated),                ║
 * ║                              extended.currentTime (fractional seconds)               ║
 * ║    MSG_VIDEO_LOADED        — metadata available; extended.duration/videoWidth/       ║
 * ║                              videoHeight                                             ║
 * ║    MSG_VIDEO_VOLUME_CHANGE — volume or muted changed; wParam = volume (0–100),       ║
 * ║                              lParam = muted (1/0); extended.volume/muted             ║
 * ║    MSG_VIDEO_RATE_CHANGE   — playbackRate changed; extended.playbackRate             ║
 * ║    MSG_VIDEO_WAITING       — playback stalled waiting for data (waiting event)       ║
 * ║    MSG_VIDEO_CANPLAY       — enough data to resume playback (canplay event)          ║
 * ║    MSG_VIDEO_TIMEUPDATE    — fired each animation frame during playback, and via     ║
 * ║                              timeupdate (~4 Hz) when the tab is hidden;              ║
 * ║                              wParam = ms (truncated),                                ║
 * ║                              extended.currentTime (fractional seconds)               ║
 * ║    MSG_VIDEO_CUE_ENTER     — a cue was entered; extended: { startTime, endTime,      ║
 * ║                              text }                                                  ║
 * ║    MSG_VIDEO_CUE_LEAVE     — a cue was exited;  extended: { startTime, endTime,      ║
 * ║                              text }                                                  ║
 * ║    MSG_VIDEO_ERROR      — playback error; wParam = error code                        ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaVideo.play(pacId)                              — start playback               ║
 * ║    WakaVideo.pause(pacId)                             — pause playback               ║
 * ║    WakaVideo.seek(pacId, time)                        — seek to time in seconds      ║
 * ║    WakaVideo.setVolume(pacId, volume)                 — set volume (0–100)           ║
 * ║    WakaVideo.setMuted(pacId, muted)                   — set muted state              ║
 * ║    WakaVideo.setPlaybackRate(pacId, rate)             — set playback rate            ║
 * ║    WakaVideo.bitBlt(dc, pacId)                        — copy full frame into DC      ║
 * ║    WakaVideo.stretchBlt(dc, pacId, dx,dy,dw,dh)       — copy full frame into rect    ║
 * ║    WakaVideo.addCue(pacId, startTime, endTime, text)  — add a programmatic cue       ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    duration     — set when MSG_VIDEO_LOADED fires                                    ║
 * ║    videoWidth   — set when MSG_VIDEO_LOADED fires                                    ║
 * ║    videoHeight  — set when MSG_VIDEO_LOADED fires                                    ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    /** Owns the state and lifecycle of one video component. */
    class VideoComponent {
        constructor(owner, abstraction, pacId, _config, videoPluginContext) {
            this._owner = owner;
            this._videoPluginContext = videoPluginContext;
            this._abstraction = abstraction;
            this._pacId = pacId;
            this._config = _config;

            this.onPlay = this.onPlay.bind(this);
            this.onPause = this.onPause.bind(this);
            this.onEnded = this.onEnded.bind(this);
            this.onSeeked = this.onSeeked.bind(this);
            this.onLoadedMetadata = this.onLoadedMetadata.bind(this);
            this.onVolumeChange = this.onVolumeChange.bind(this);
            this.onRateChange = this.onRateChange.bind(this);
            this.onWaiting = this.onWaiting.bind(this);
            this.onCanPlay = this.onCanPlay.bind(this);
            this.onTimeUpdate = this.onTimeUpdate.bind(this);
            this.onError = this.onError.bind(this);
        }

        initialize() {
            const state = this;

            state._container = state._videoPluginContext._pac.getContainerByPacId(state._pacId);

            // Only activate for <video> containers
            if (!state._container || !(state._container instanceof HTMLVideoElement)) {
                return;
            }

            state.initializeEntry();

            state.attachListeners();

            state.seedMetadata();

            state.rememberListeners();
        }

        onPlay() {
            const state = this;

            // Start the rAF loop to drive MSG_VIDEO_TIMEUPDATE
            pluginRuntime.startRaf(state._pacId, state._video, state._entry);

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_PLAY, 0, 0);
        }

        onPause() {
            const state = this;

            // Stop the rAF loop
            pluginRuntime.stopRaf(state._entry);

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_PAUSE, 0, 0);
        }

        onEnded() {
            const state = this;

            // Stop the rAF loop
            pluginRuntime.stopRaf(state._entry);

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_ENDED, 0, 0);
        }

        onSeeked() {
            const state = this;

            const t = state._video.currentTime;

            // Notify msgProc of the landed position
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_SEEK, Math.trunc(t * 1000), 0, {
                currentTime: t
            });
        }

        onLoadedMetadata() {
            const state = this;

            // Update the abstraction
            state._abstraction.duration = state._video.duration;
            state._abstraction.videoWidth = state._video.videoWidth;
            state._abstraction.videoHeight = state._video.videoHeight;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_LOADED, 0, 0, {
                duration   : state._video.duration,
                videoWidth : state._video.videoWidth,
                videoHeight: state._video.videoHeight
            });
        }

        onVolumeChange() {
            const state = this;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_VOLUME_CHANGE, state._video.volume * 100, state._video.muted ? 1 : 0, {
                volume: state._video.volume * 100,
                muted : state._video.muted
            });
        }

        onRateChange() {
            const state = this;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_RATE_CHANGE, 0, 0, {
                playbackRate: state._video.playbackRate
            });
        }

        onWaiting() {
            const state = this;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_WAITING, 0, 0);
        }

        onCanPlay() {
            const state = this;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_CANPLAY, 0, 0);
        }

        onTimeUpdate() {
            const state = this;

            if (state._entry.rafHandle === null) {
                const t = state._video.currentTime;

                // Notify msgProc of the current playback position
                state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_TIMEUPDATE, Math.trunc(t * 1000), 0, {
                    currentTime: t
                });
            }
        }

        onError() {
            const state = this;

            const code = state._video.error?.code ?? 0;

            // Notify msgProc
            state._videoPluginContext._pac.sendMessage(state._pacId, state._videoPluginContext._MSG_VIDEO_ERROR, code, 0, {
                message: state._video.error ? `MediaError code ${state._video.error.code}` : ''
            });
        }

        rememberListeners() {
            const state = this;

            // Store listener references for clean removal in onComponentDestroyed
            _listeners.set(state._video, {
                play          : state.onPlay,
                pause         : state.onPause,
                ended         : state.onEnded,
                seeked        : state.onSeeked,
                loadedmetadata: state.onLoadedMetadata,
                volumechange  : state.onVolumeChange,
                ratechange    : state.onRateChange,
                waiting       : state.onWaiting,
                canplay       : state.onCanPlay,
                timeupdate    : state.onTimeUpdate,
                error         : state.onError
            });
        }

        seedMetadata() {
            const state = this;

            // Metadata may have already loaded before the listener was attached,
            // which is common with local files. Fire the message immediately if so.
            if (state._video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                state.onLoadedMetadata();
            }
        }

        attachListeners() {
            const state = this;

            // Wire up the video element events
            state._video.addEventListener('play', state.onPlay);
            state._video.addEventListener('pause', state.onPause);
            state._video.addEventListener('ended', state.onEnded);
            state._video.addEventListener('seeked', state.onSeeked);
            state._video.addEventListener('loadedmetadata', state.onLoadedMetadata);
            state._video.addEventListener('volumechange', state.onVolumeChange);
            state._video.addEventListener('ratechange', state.onRateChange);
            state._video.addEventListener('waiting', state.onWaiting);
            state._video.addEventListener('canplay', state.onCanPlay);
            state._video.addEventListener('timeupdate', state.onTimeUpdate);
            state._video.addEventListener('error', state.onError);
        }

        initializeEntry() {
            const state = this;

            state._video = state._container;
            state._entry = {
                video           : state._video,
                pac             : state._videoPluginContext._pac,
                msgVideoError   : state._videoPluginContext._MSG_VIDEO_ERROR,
                msgCueEnter     : state._videoPluginContext._MSG_VIDEO_CUE_ENTER,
                msgCueLeave     : state._videoPluginContext._MSG_VIDEO_CUE_LEAVE,
                msgTimeUpdate   : state._videoPluginContext._MSG_VIDEO_TIMEUPDATE,
                cueTrack        : null,
                cueChangeHandler: null,
                activeCues      : new Map(),
                rafHandle       : null
            };

            // Register the component
            _registry.set(state._pacId, state._entry);

            // Seed the abstraction with neutral initial values
            state._abstraction.duration = NaN;
            state._abstraction.videoWidth = null;
            state._abstraction.videoHeight = null;
        }
    }

    /** Owns the state and lifecycle of one video plugin. */
    class VideoPlugin {
        constructor(owner, pac, _options = {}) {
            this._owner = owner;
            this._pac = pac;
            this._options = _options;
        }

        initialize() {
            const state = this;

            // Use the public message IDs for delivery as well as comparisons.
            ({
                MSG_VIDEO_PLAY: state._MSG_VIDEO_PLAY,
                MSG_VIDEO_PAUSE: state._MSG_VIDEO_PAUSE,
                MSG_VIDEO_ENDED: state._MSG_VIDEO_ENDED,
                MSG_VIDEO_SEEK: state._MSG_VIDEO_SEEK,
                MSG_VIDEO_LOADED: state._MSG_VIDEO_LOADED,
                MSG_VIDEO_CUE_ENTER: state._MSG_VIDEO_CUE_ENTER,
                MSG_VIDEO_CUE_LEAVE: state._MSG_VIDEO_CUE_LEAVE,
                MSG_VIDEO_ERROR: state._MSG_VIDEO_ERROR,
                MSG_VIDEO_VOLUME_CHANGE: state._MSG_VIDEO_VOLUME_CHANGE,
                MSG_VIDEO_RATE_CHANGE: state._MSG_VIDEO_RATE_CHANGE,
                MSG_VIDEO_WAITING: state._MSG_VIDEO_WAITING,
                MSG_VIDEO_CANPLAY: state._MSG_VIDEO_CANPLAY,
                MSG_VIDEO_TIMEUPDATE: state._MSG_VIDEO_TIMEUPDATE
            } = state._owner);

            return state.createDescriptor();
        }

        createDescriptor() {
            const state = this;

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Checks whether the container is a <video> element; if so,
                 * registers it and wires up the event → message bridge.
                 *
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    return new VideoComponent(this, abstraction, pacId, _config, state).initialize();
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Cancels the rAF loop, removes all event listeners, and cleans
                 * up the registry entry.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    // Stop the rAF loop
                    pluginRuntime.stopRaf(entry);

                    // Remove the cue change listener if active
                    if (entry.cueTrack && entry.cueChangeHandler) {
                        entry.cueTrack.removeEventListener('cuechange', entry.cueChangeHandler);
                    }

                    // Remove all video element event listeners
                    const listeners = _listeners.get(entry.video);

                    if (listeners) {
                        for (const [event, fn] of Object.entries(listeners)) {
                            entry.video.removeEventListener(event, fn);
                        }

                        _listeners.delete(entry.video);
                    }

                    // Unregister the component
                    _registry.delete(pacId);
                }
            };
        }
    }

    const pluginRuntime = {
        /**
         * Returns the registered video element for a pacId, or null if not found.
         * Used by public API methods that only need the video element.
         * Methods that need the full entry (play, addCue) call _registry.get() directly.
         * @param {string} pacId
         * @returns {HTMLVideoElement|null}
         */
        getVideo(pacId) {
            return _registry.get(pacId)?.video ?? null;
        },

        /**
         * Returns a stable string key for a VTTCue, used to diff active cue maps.
         * @param {VTTCue} cue
         * @returns {string}
         */
        cueKey(cue) {
            return `${cue.startTime}:${cue.endTime}:${cue.text}`;
        },

        /**
         * Advances currentTime on the abstraction once per animation frame while
         * the video is playing. Self-terminates when the video is paused or ended.
         * @param {string} pacId
         * @param {HTMLVideoElement} video
         * @param {Object} entry
         */
        rafTick(pacId, video, entry) {
            const rafTickHandlers = {
                onAnimationFrame() { return pluginRuntime.rafTick(pacId, video, entry); }
            };

            // Stop the loop if playback is no longer active
            if (video.paused || video.ended) {
                entry.rafHandle = null;
                return;
            }

            const t = video.currentTime;

            // Notify msgProc of the current playback position
            entry.pac.sendMessage(pacId, entry.msgTimeUpdate, Math.trunc(t * 1000), 0, {
                currentTime: t
            });

            // Schedule the next tick
            entry.rafHandle = requestAnimationFrame(rafTickHandlers.onAnimationFrame.bind(this));
        },

        /**
         * Starts the rAF loop for the given entry. No-op if already running.
         * @param {string} pacId
         * @param {HTMLVideoElement} video
         * @param {Object} entry
         */
        startRaf(pacId, video, entry) {
            const startRafHandlers = {
                onAnimationFrame() { return pluginRuntime.rafTick(pacId, video, entry); }
            };

            if (entry.rafHandle !== null) {
                return;
            }

            entry.rafHandle = requestAnimationFrame(startRafHandlers.onAnimationFrame.bind(this));
        },

        /**
         * Stops the rAF loop for the given entry. No-op if not running.
         * @param {Object} entry
         */
        stopRaf(entry) {
            if (entry.rafHandle !== null) {
                cancelAnimationFrame(entry.rafHandle);
                entry.rafHandle = null;
            }
        },

        /**
         * Handles a cuechange event on the metadata track.
         * Diffs the current active cue map against the previous one and dispatches
         * MSG_VIDEO_CUE_ENTER / MSG_VIDEO_CUE_LEAVE for each cue that entered or left.
         * activeCues is a Map<key, VTTCue> so cue data is always available without
         * re-parsing the key.
         * @param {string} pacId
         * @param {Object} entry
         */
        onCueChange(pacId, entry) {
            const current = new Map();

            for (const cue of entry.cueTrack.activeCues ?? []) {
                current.set(pluginRuntime.cueKey(cue), cue);
            }

            // Cues in current but not in previous → entered
            for (const [key, cue] of current) {
                if (!entry.activeCues.has(key)) {
                    entry.pac.sendMessage(pacId, entry.msgCueEnter, 0, 0, {
                        startTime: cue.startTime,
                        endTime  : cue.endTime,
                        text     : cue.text
                    });
                }
            }

            // Cues in previous but not in current → left
            for (const [key, cue] of entry.activeCues) {
                if (!current.has(key)) {
                    entry.pac.sendMessage(pacId, entry.msgCueLeave, 0, 0, {
                        startTime: cue.startTime,
                        endTime  : cue.endTime,
                        text     : cue.text
                    });
                }
            }

            entry.activeCues = current;
        }
    };

    // Support standalone loading while using the host's plugin base when present.
    const MSG_PLUGIN = globalThis.wakaPAC?.MSG_PLUGIN ?? 0x2000;

    /**
     * Registry of active video components keyed by pacId.
     * Each entry holds the pac reference, the HTMLVideoElement, the MSG_VIDEO_ERROR
     * constant, the cue track, the previous active cue set for enter/leave diffing,
     * and the rAF handle.
     * @type {Map<string, { pac: Object, video: HTMLVideoElement, msgVideoError: number, msgCueEnter: number, msgCueLeave: number, cueTrack: TextTrack|null, cueChangeHandler: Function|null, activeCues: Map<string, VTTCue>, rafHandle: number|null }>}
     */
    const _registry = new Map();

    /**
     * Stores the named event listener references for each video element so
     * onComponentDestroyed can remove them cleanly.
     * @type {WeakMap<HTMLVideoElement, Object>}
     */
    const _listeners = new WeakMap();

    window.WakaVideo = {
        // Message IDs are available before wakaPAC.use(), relative to MSG_PLUGIN.
        MSG_VIDEO_PLAY         : MSG_PLUGIN + 0x100,
        MSG_VIDEO_PAUSE        : MSG_PLUGIN + 0x101,
        MSG_VIDEO_ENDED        : MSG_PLUGIN + 0x102,
        MSG_VIDEO_SEEK         : MSG_PLUGIN + 0x103,
        MSG_VIDEO_LOADED       : MSG_PLUGIN + 0x104,
        MSG_VIDEO_CUE_ENTER    : MSG_PLUGIN + 0x105,
        MSG_VIDEO_CUE_LEAVE    : MSG_PLUGIN + 0x106,
        MSG_VIDEO_ERROR        : MSG_PLUGIN + 0x107,
        MSG_VIDEO_VOLUME_CHANGE: MSG_PLUGIN + 0x108,
        MSG_VIDEO_RATE_CHANGE  : MSG_PLUGIN + 0x109,
        MSG_VIDEO_WAITING      : MSG_PLUGIN + 0x10A,
        MSG_VIDEO_CANPLAY      : MSG_PLUGIN + 0x10B,
        MSG_VIDEO_TIMEUPDATE   : MSG_PLUGIN + 0x10C,

        createPacPlugin(pac, _options = {}) {
            return new VideoPlugin(this, pac, _options).initialize();
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Start playback.
         * Autoplay policy rejections are caught and dispatched as MSG_VIDEO_ERROR
         * so all error handling stays in msgProc.
         * @param {string} pacId
         */
        play(pacId) {
            const playHandlers = {
                onRejected(err) {
                    entry.pac.sendMessage(pacId, entry.msgVideoError, 0, 0, {
                        message: err.message ?? ''
                    });
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // Call the video API; catch autoplay policy rejections and forward to msgProc
            entry.video.play().catch(playHandlers.onRejected.bind(this));
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
            // Call the video API
            pluginRuntime.getVideo(pacId)?.pause();
        },

        /**
         * Seek to a time in seconds.
         * MSG_VIDEO_SEEK fires when the seek completes.
         * @param {string} pacId
         * @param {number} time - Target time in seconds
         */
        seek(pacId, time) {
            const video = pluginRuntime.getVideo(pacId);

            if (video) {
                // Call the video API; MSG_VIDEO_SEEK fires from the seeked event
                video.currentTime = time;
            }
        },

        /**
         * Set the volume level.
         * MSG_VIDEO_VOLUME_CHANGE fires after the change.
         * @param {string} pacId
         * @param {number} volume - Value between 0 (silent) and 100 (full)
         */
        setVolume(pacId, volume) {
            const video = pluginRuntime.getVideo(pacId);

            if (video) {
                // Call the video API; MSG_VIDEO_VOLUME_CHANGE fires from the volumechange event
                video.volume = Math.max(0, Math.min(100, volume)) / 100;
            }
        },

        /**
         * Set the muted state.
         * MSG_VIDEO_VOLUME_CHANGE fires after the change.
         * @param {string} pacId
         * @param {boolean} muted
         */
        setMuted(pacId, muted) {
            const video = pluginRuntime.getVideo(pacId);

            if (video) {
                // Call the video API; MSG_VIDEO_VOLUME_CHANGE fires from the volumechange event
                video.muted = muted;
            }
        },

        /**
         * Set the playback rate.
         * MSG_VIDEO_RATE_CHANGE fires after the change.
         * Typical values: 0.5, 1.0, 1.5, 2.0. Browser support for extreme values varies.
         * @param {string} pacId
         * @param {number} rate
         */
        setPlaybackRate(pacId, rate) {
            const video = pluginRuntime.getVideo(pacId);

            if (video) {
                // Call the video API; MSG_VIDEO_RATE_CHANGE fires from the ratechange event
                video.playbackRate = rate;
            }
        },

        /**
         * Copies the full current video frame into the given canvas DC,
         * scaled to fill the DC's canvas dimensions.
         * Typically called from a MSG_VIDEO_PAUSE or MSG_VIDEO_SEEK handler.
         * @param {CanvasRenderingContext2D} dc - Target drawing context
         * @param {string} pacId
         */
        bitBlt(dc, pacId) {
            const video = pluginRuntime.getVideo(pacId);

            if (!video || !dc || !(dc instanceof CanvasRenderingContext2D)) {
                return;
            }

            dc.drawImage(video, 0, 0, dc.canvas.width, dc.canvas.height);
        },

        /**
         * Copies the full current video frame into a destination rectangle on
         * the given canvas DC. Mirrors the signature of wakaPAC.stretchBlt.
         * @param {CanvasRenderingContext2D} dc - Target drawing context
         * @param {string} pacId
         * @param {number} dx  - Destination x in canvas pixels
         * @param {number} dy  - Destination y in canvas pixels
         * @param {number} dw  - Destination width in canvas pixels
         * @param {number} dh  - Destination height in canvas pixels
         */
        stretchBlt(dc, pacId, dx, dy, dw, dh) {
            const video = pluginRuntime.getVideo(pacId);

            if (!video || !dc || !(dc instanceof CanvasRenderingContext2D)) {
                return;
            }

            dc.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, dx, dy, dw, dh);
        },

        /**
         * Adds a timed cue to the video.
         * MSG_VIDEO_CUE_ENTER fires when playback enters the cue's time range.
         * MSG_VIDEO_CUE_LEAVE fires when playback exits the cue's time range.
         * Each message carries the single cue that was entered or exited in extended:
         *   { startTime, endTime, text }
         * The cue track is lazy-created on first call.
         * @param {string} pacId
         * @param {number} startTime - Cue start in seconds
         * @param {number} endTime   - Cue end in seconds
         * @param {string} text      - Cue payload (plain string label or identifier)
         */
        addCue(pacId, startTime, endTime, text) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            if (typeof startTime !== 'number' || typeof endTime !== 'number' || endTime <= startTime) {
                return;
            }

            // Lazy-create the metadata track on first use
            if (!entry.cueTrack) {
                const addCueHandlers = {
                    cueChangeHandler() { return pluginRuntime.onCueChange(pacId, entry); }
                };

                entry.cueTrack = entry.video.addTextTrack('metadata', 'waka-cues', 'zxx');
                entry.cueTrack.mode = 'hidden';
                entry.cueChangeHandler = addCueHandlers.cueChangeHandler.bind(this);
                entry.cueTrack.addEventListener('cuechange', entry.cueChangeHandler);
            }

            // Add the cue to the track
            entry.cueTrack.addCue(new VTTCue(startTime, endTime, text));
        }
    };

    window.wakaVideo = window.WakaVideo;
})();
