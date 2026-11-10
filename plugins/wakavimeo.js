/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██╗   ██╗██╗███╗   ███╗███████╗ ██████╗          ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██║   ██║██║████╗ ████║██╔════╝██╔═══██╗         ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║   ██║██║██╔████╔██║█████╗  ██║   ██║         ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║╚██╗ ██╔╝██║██║╚██╔╝██║██╔══╝  ██║   ██║         ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║ ╚████╔╝ ██║██║ ╚═╝ ██║███████╗╚██████╔╝         ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝          ║
 * ║                                                                                     ║
 * ║  WakaPAC Plugin — WakaVimeo                                                         ║
 * ║                                                                                     ║
 * ║  Wraps Vimeo Player SDK instances inside PAC containers, bridging the Vimeo         ║
 * ║  Player SDK into the WakaPAC message and abstraction model.                         ║
 * ║                                                                                     ║
 * ║  The plugin activates when the PAC container is a <div> element with a              ║
 * ║  data-vimeo-id attribute holding the Vimeo video ID. The Vimeo Player SDK           ║
 * ║  script is injected automatically on first use. Components created before           ║
 * ║  the script loads are queued and initialized once the script's onload fires.        ║
 * ║                                                                                     ║
 * ║  Usage:                                                                             ║
 * ║    wakaPAC.use(WakaVimeo);                                                          ║
 * ║                                                                                     ║
 * ║  HTML:                                                                              ║
 * ║    <div data-pac-id="player1" data-vimeo-id="76979871"></div>                       ║
 * ║    <waka-vimeo data-pac-id="player1" data-vimeo-id="76979871"></waka-vimeo>         ║
 * ║                                                                                     ║
 * ║  Compared to WakaVideo, the following are additionally supported:                   ║
 * ║    - setPlaybackRate / MSG_VIDEO_RATE_CHANGE  (Vimeo SDK exposes playback rate)     ║
 * ║    - MSG_VIDEO_VOLUME_CHANGE fires for UI-driven changes (volumechange event)       ║
 * ║                                                                                     ║
 * ║  The following features from WakaVideo are omitted — cross-origin restrictions      ║
 * ║  apply equally to Vimeo iframes:                                                    ║
 * ║    - bitBlt / stretchBlt  (canvas taint blocks drawImage on cross-origin iframes)   ║
 * ║    - addCue / MSG_VIDEO_CUE_ENTER / MSG_VIDEO_CUE_LEAVE  (no TextTrack access)      ║
 * ║                                                                                     ║
 * ║  Messages dispatched:                                                               ║
 * ║    MSG_VIDEO_PLAY         — playback started                                        ║
 * ║    MSG_VIDEO_PAUSE        — playback paused                                         ║
 * ║    MSG_VIDEO_ENDED        — playback reached the end                                ║
 * ║    MSG_VIDEO_SEEK         — seek completed; wParam = ms (truncated),                ║
 * ║                             extended.currentTime (fractional seconds)               ║
 * ║    MSG_VIDEO_LOADED       — video ready; extended.duration/videoWidth/videoHeight   ║
 * ║    MSG_VIDEO_VOLUME_CHANGE — volume or muted changed; wParam = volume (0–100),      ║
 * ║                              lParam = muted (1/0); extended.volume/muted            ║
 * ║    MSG_VIDEO_RATE_CHANGE  — playback rate changed; extended.playbackRate            ║
 * ║    MSG_VIDEO_WAITING      — buffering started (bufferstart event)                   ║
 * ║    MSG_VIDEO_CANPLAY      — buffering ended (bufferend event)                       ║
 * ║    MSG_VIDEO_TIMEUPDATE   — fired via timeupdate (~250 ms) during playback;         ║
 * ║                             wParam = ms (truncated),                                ║
 * ║                             extended.currentTime (fractional seconds)               ║
 * ║    MSG_VIDEO_ERROR        — playback error; extended.message                        ║
 * ║                                                                                     ║
 * ║  API — all methods take pacId as first argument:                                    ║
 * ║    WakaVimeo.play(pacId)                    — start playback                        ║
 * ║    WakaVimeo.pause(pacId)                   — pause playback                        ║
 * ║    WakaVimeo.seek(pacId, time)              — seek to time in seconds               ║
 * ║    WakaVimeo.setVolume(pacId, volume)       — set volume (0–100)                    ║
 * ║    WakaVimeo.setMuted(pacId, muted)         — set muted state                       ║
 * ║    WakaVimeo.setPlaybackRate(pacId, rate)   — set playback rate (0.5–2)             ║
 * ║                                                                                     ║
 * ║  Reactive properties injected on the abstraction:                                   ║
 * ║    duration      — set when MSG_VIDEO_LOADED fires                                  ║
 * ║    videoWidth    — set when MSG_VIDEO_LOADED fires                                  ║
 * ║    videoHeight   — set when MSG_VIDEO_LOADED fires                                  ║
 * ║                                                                                     ║
 * ╚═════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    /** Owns the state and lifecycle of one vimeo session. */
    class VimeoSession {
        constructor(owner, abstraction, pacId, videoId, pac, msgConstants, embedOptions) {
            this._owner = owner;
            this._abstraction = abstraction;
            this._pacId = pacId;
            this._videoId = videoId;
            this._pac = pac;
            this._msgConstants = msgConstants;
            this._embedOptions = embedOptions;

            this.onError = this.onError.bind(this);
            this.onBufferend = this.onBufferend.bind(this);
            this.onBufferstart = this.onBufferstart.bind(this);
            this.onPlaybackratechange = this.onPlaybackratechange.bind(this);
            this.onVolumechange = this.onVolumechange.bind(this);
            this.onSeeked = this.onSeeked.bind(this);
            this.onEnded = this.onEnded.bind(this);
            this.onPause = this.onPause.bind(this);
            this.onPlay = this.onPlay.bind(this);
            this.onTimeupdate = this.onTimeupdate.bind(this);
            this.onLoaded = this.onLoaded.bind(this);
        }

        initialize() {
            const state = this;

            state._container = state._pac.getContainerByPacId(state._pacId);

            if (!state._container || !state._container.isConnected) {
                return;
            }

            // Guard against duplicate initialization (framework re-renders, hydration, etc.).
            if (_registry.has(state._pacId)) {
                return;
            }

            // Validate the video ID before handing it to the SDK.
            state._id = Number(state._videoId);

            if (!Number.isFinite(state._id)) {
                state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                    message: `Invalid Vimeo video ID: "${state._videoId}"`
                });

                return;
            }

            // Confirm the SDK is actually present on the global scope. _apiReady
            // being true is normally sufficient, but an explicit check guards against
            // environments where the script loaded but the global was not set.
            if (!window.Vimeo?.Player) {
                state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                    message: 'Vimeo Player SDK is not available'
                });

                return;
            }

            state.initializePlayer();

            state.attachListeners();
        }

        onError(data) {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                message: data.message ?? 'Unknown Vimeo error'
            });
        }

        onBufferend() {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_CANPLAY, 0, 0);
        }

        onBufferstart() {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_WAITING, 0, 0);
        }

        onPlaybackratechange(data) {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_RATE_CHANGE, 0, 0, {
                playbackRate: data.playbackRate
            });
        }

        onVolumechange(data) {
            const state = this;

            const volume = data.volume * 100;
            const muted = data.muted ? 1 : 0;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_VOLUME_CHANGE, volume, muted, {
                volume: volume,
                muted : data.muted
            });
        }

        onSeeked(data) {
            const state = this;

            const t = data.seconds;

            // Notify msgProc of the landed position
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_SEEK, Math.trunc(t * 1000), 0, {
                currentTime: t
            });
        }

        onEnded(_data) {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_ENDED, 0, 0);
        }

        onPause(_data) {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_PAUSE, 0, 0);
        }

        onPlay() {
            const state = this;

            // Notify msgProc
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_PLAY, 0, 0);
        }

        onTimeupdate(data) {
            const state = this;

            const t = data.seconds;

            // Notify msgProc of the current playback position
            state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_TIMEUPDATE, Math.trunc(t * 1000), 0, {
                currentTime: t
            });
        }

        onLoaded() {
            const state = this;

            const onLoadedHandlers = {
                onRejected(err) {
                    state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                        message: err.message ?? 'Error reading video metadata'
                    });
                },

                onResolved([duration, videoWidth, videoHeight]) {
                    // Update the abstraction
                    state._abstraction.duration = duration;
                    state._abstraction.videoWidth = videoWidth;
                    state._abstraction.videoHeight = videoHeight;

                    // Notify msgProc
                    state._pac.sendMessage(state._pacId, state._msgConstants.MSG_VIDEO_LOADED, 0, 0, {
                        duration,
                        videoWidth,
                        videoHeight
                    });
                }
            };

            Promise.all([
                state._player.getDuration(),
                state._player.getVideoWidth(),
                state._player.getVideoHeight()
            ]).then(onLoadedHandlers.onResolved).catch(onLoadedHandlers.onRejected);
        }

        attachListeners() {
            const state = this;

            /**
             * loaded — fires when the video metadata is ready (also when
             * loadVideo() loads a new video into an existing player).
             * We read all metadata asynchronously via Promise.all since the
             * Vimeo SDK exposes only async getters.
             */
            state._player.on('loaded', state.onLoaded);

            /**
             * timeupdate — fires at ~250 ms intervals during playback.
             * data: { seconds, percent, duration }
             */
            state._player.on('timeupdate', state.onTimeupdate);

            /**
             * Fires when playback starts
             */
            state._player.on('play', state.onPlay);

            /**
             * Fires when playback is paused. data: { seconds, percent, duration }
             */
            state._player.on('pause', state.onPause);

            /**
             * Fires when playback reaches the end of the video. data: { seconds, percent, duration }
             */
            state._player.on('ended', state.onEnded);

            /**
             * seeked — fires after setCurrentTime() resolves with the actual
             * position the player landed on (may differ from requested time).
             * data: { seconds, percent, duration }
             */
            state._player.on('seeked', state.onSeeked);

            /**
             * volumechange — fires for both volume level and muted changes,
             * including changes made through the player UI.
             * data: { volume, muted }  (volume is 0–1)
             */
            state._player.on('volumechange', state.onVolumechange);

            /**
             * Fires when the playback rate changes. data: { playbackRate }
             */
            state._player.on('playbackratechange', state.onPlaybackratechange);

            /**
             * Fires when the player starts buffering.
             */
            state._player.on('bufferstart', state.onBufferstart);

            /**
             * Fires when buffering ends and playback can resume.
             */
            state._player.on('bufferend', state.onBufferend);

            /**
             *  Fires on playback errors. data: { message, method, name }
             */
            state._player.on('error', state.onError);
        }

        initializePlayer() {
            const state = this;

            // Instantiate the Vimeo player in the container
            state._player = new Vimeo.Player(state._container, {
                id : state._id,
                dnt: true,            // privacy-enhanced embed; no tracking cookies
                ...state._embedOptions
            });

            // Register the component
            state._entry = {pac: state._pac, player: state._player, abstraction: state._abstraction, msgConstants: state._msgConstants};
            _registry.set(state._pacId, state._entry);
        }
    }

    /** Owns the state and lifecycle of one vimeo plugin. */
    class VimeoPlugin {
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
                MSG_VIDEO_ERROR: state._MSG_VIDEO_ERROR,
                MSG_VIDEO_VOLUME_CHANGE: state._MSG_VIDEO_VOLUME_CHANGE,
                MSG_VIDEO_RATE_CHANGE: state._MSG_VIDEO_RATE_CHANGE,
                MSG_VIDEO_WAITING: state._MSG_VIDEO_WAITING,
                MSG_VIDEO_CANPLAY: state._MSG_VIDEO_CANPLAY,
                MSG_VIDEO_TIMEUPDATE: state._MSG_VIDEO_TIMEUPDATE
            } = state._owner);

            state._msgConstants = {
                MSG_VIDEO_PLAY         : state._MSG_VIDEO_PLAY,
                MSG_VIDEO_PAUSE        : state._MSG_VIDEO_PAUSE,
                MSG_VIDEO_ENDED        : state._MSG_VIDEO_ENDED,
                MSG_VIDEO_SEEK         : state._MSG_VIDEO_SEEK,
                MSG_VIDEO_LOADED       : state._MSG_VIDEO_LOADED,
                MSG_VIDEO_ERROR        : state._MSG_VIDEO_ERROR,
                MSG_VIDEO_VOLUME_CHANGE: state._MSG_VIDEO_VOLUME_CHANGE,
                MSG_VIDEO_RATE_CHANGE  : state._MSG_VIDEO_RATE_CHANGE,
                MSG_VIDEO_WAITING      : state._MSG_VIDEO_WAITING,
                MSG_VIDEO_CANPLAY      : state._MSG_VIDEO_CANPLAY,
                MSG_VIDEO_TIMEUPDATE   : state._MSG_VIDEO_TIMEUPDATE
            };

            // Plugin-level embed option defaults, set via wakaPAC.use(WakaVimeo, { ... }).
            // Per-instance config under the 'vimeo' key overrides these.
            state._defaultEmbedOptions = {
                controls   : state._options.controls ?? false,
                speed      : state._options.speed ?? false,
                transparent: state._options.transparent ?? true
            };

            return state.createDescriptor();
        }

        createDescriptor() {
            const state = this;

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Activates only when the container is a <div> with a data-vimeo-id
                 * attribute. Injects the SDK script on first use and either creates
                 * the player immediately (SDK ready) or queues it.
                 *
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Full component config; plugin options under 'vimeo' key
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = state._pac.getContainerByPacId(pacId);

                    if (!container) {
                        return;
                    }

                    // Accept either:
                    //   <div data-vimeo-id="…">   — classic attribute-based usage
                    //   <waka-vimeo data-vimeo-id="…">  — custom element usage
                    const tag = container.tagName.toLowerCase();

                    if (!(container instanceof HTMLDivElement) && tag !== 'waka-vimeo') {
                        return;
                    }

                    const videoId = container.dataset.vimeoId;

                    if (!videoId || !Number.isFinite(Number(videoId))) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    // wakaPAC('id', { msgProc }, { vimeo: { controls: false } })
                    const embedOptions = {
                        ...state._defaultEmbedOptions,
                        ..._config.vimeo ?? {}
                    };

                    // Seed the abstraction with neutral initial values.
                    abstraction.duration = NaN;
                    abstraction.videoWidth = null;
                    abstraction.videoHeight = null;

                    // Inject the SDK script if not already done, then create the player
                    pluginRuntime.ensureApiLoaded();

                    if (_apiReady) {
                        pluginRuntime.createPlayer(abstraction, pacId, videoId, state._pac, state._msgConstants, embedOptions);
                    } else {
                        _pendingInits.push({abstraction, pacId, videoId, pac: state._pac, msgConstants: state._msgConstants, embedOptions});
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init, destroys the Vimeo.Player instance,
                 * and removes the registry entry.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    const onComponentDestroyedHandlers = {
                        onRejected() {
                            // Ignore errors during destruction.
                        },

                        findIndexCallback(p) { return p.pacId === pacId; }
                    };

                    // Remove from the pending queue if the SDK has not loaded yet
                    const pendingIndex = _pendingInits.findIndex(onComponentDestroyedHandlers.findIndexCallback.bind(this));

                    if (pendingIndex !== -1) {
                        _pendingInits.splice(pendingIndex, 1);
                    }

                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    // destroy() returns a Promise; we don't await it since the
                    // component is already being torn down.
                    entry.player.destroy().catch(onComponentDestroyedHandlers.onRejected);

                    // Unregister the component
                    _registry.delete(pacId);
                }
            };
        }
    }

    const pluginRuntime = {
        /**
         * Injects the Vimeo Player SDK script tag. Safe to call multiple times —
         * only injects once. Drains the pending queue on load.
         */
        ensureApiLoaded() {
            const ensureApiLoadedHandlers = {
                onerror() {
                    // Script failed to load (network error, CSP block, etc.).
                    // Notify each queued component via MSG_VIDEO_ERROR so msgProc can
                    // react rather than silently waiting forever.
                    for (const pending of _pendingInits) {
                        pending.pac.sendMessage(
                            pending.pacId,
                            pending.msgConstants.MSG_VIDEO_ERROR,
                            0, 0,
                            {message: 'Vimeo Player SDK failed to load'}
                        );
                    }

                    _pendingInits.length = 0;
                },

                onload() {
                    _apiReady = true;

                    for (const pending of _pendingInits) {
                        pluginRuntime.createPlayer(
                            pending.abstraction,
                            pending.pacId,
                            pending.videoId,
                            pending.pac,
                            pending.msgConstants,
                            pending.embedOptions
                        );
                    }

                    _pendingInits.length = 0;
                }
            };

            if (_apiReady || _apiLoading) {
                return;
            }

            _apiLoading = true;

            const tag = document.createElement('script');
            tag.id = 'waka-vimeo-api-script';
            tag.src = 'https://player.vimeo.com/api/player.js';

            tag.onload = ensureApiLoadedHandlers.onload;

            tag.onerror = ensureApiLoadedHandlers.onerror;

            (document.head ?? document.body).appendChild(tag);
        },

        /**
         * Instantiates a Vimeo.Player for the given container and wires up all
         * SDK events into WakaPAC messages.
         * @param {Object} abstraction
         * @param {string} pacId
         * @param {string} videoId      - Numeric Vimeo video ID (as string from dataset)
         * @param {Object} pac
         * @param {Object} msgConstants
         * @param {Object} embedOptions - Merged plugin-level and per-instance embed options
         */
        createPlayer(abstraction, pacId, videoId, pac, msgConstants, embedOptions) {
            return new VimeoSession(this, abstraction, pacId, videoId, pac, msgConstants, embedOptions).initialize();
        }
    };

    // Support standalone loading while using the host's plugin base when present.
    const MSG_PLUGIN = globalThis.wakaPAC?.MSG_PLUGIN ?? 0x2000;

    // =========================================================================
    // Vimeo Player SDK bootstrap
    //
    // The SDK exposes window.Vimeo synchronously once its script tag loads.
    // There is no global callback race like YouTube's onYouTubeIframeAPIReady —
    // we simply listen for the script's onload event.
    // =========================================================================

    /**
     * True once the Vimeo Player SDK script has loaded and window.Vimeo.Player
     * is available.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * True once the SDK script tag has been injected, preventing a second
     * injection if two components call ensureApiLoaded() synchronously before
     * the first appendChild has committed to the DOM.
     * @type {boolean}
     */
    let _apiLoading = false;

    /**
     * Queue of pending component descriptors created before the SDK loaded.
     * @type {Array<{ abstraction: Object, pacId: string, videoId: string, pac: Object, msgConstants: Object, embedOptions: Object }>}
     */
    const _pendingInits = [];

    // =========================================================================
    // Registry
    // =========================================================================

    /**
     * Registry of active Vimeo components keyed by pacId.
     * @type {Map<string, {
     *   pac:          Object,
     *   player:       Vimeo.Player,
     *   abstraction:  Object,
     *   msgConstants: Object
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // Player construction
    // =========================================================================

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaVimeo = {
        // Message IDs are available before wakaPAC.use(), relative to MSG_PLUGIN.
        MSG_VIDEO_PLAY         : MSG_PLUGIN + 0x100,
        MSG_VIDEO_PAUSE        : MSG_PLUGIN + 0x101,
        MSG_VIDEO_ENDED        : MSG_PLUGIN + 0x102,
        MSG_VIDEO_SEEK         : MSG_PLUGIN + 0x103,
        MSG_VIDEO_LOADED       : MSG_PLUGIN + 0x104,
        MSG_VIDEO_ERROR        : MSG_PLUGIN + 0x107,
        MSG_VIDEO_VOLUME_CHANGE: MSG_PLUGIN + 0x108,
        MSG_VIDEO_RATE_CHANGE  : MSG_PLUGIN + 0x109,
        MSG_VIDEO_WAITING      : MSG_PLUGIN + 0x10A,
        MSG_VIDEO_CANPLAY      : MSG_PLUGIN + 0x10B,
        MSG_VIDEO_TIMEUPDATE   : MSG_PLUGIN + 0x10C,

        createPacPlugin(pac, _options = {}) {
            return new VimeoPlugin(this, pac, _options).initialize();
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Start playback.
         * Errors (e.g. PasswordError, PrivacyError) are dispatched as MSG_VIDEO_ERROR.
         * @param {string} pacId
         */
        play(pacId) {
            const playHandlers = {
                onRejected(err) {
                    entry.pac.sendMessage(pacId, entry.msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                        message: err.message ?? 'Play failed'
                    });
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // Call the Vimeo SDK; forward errors to msgProc
            entry.player.play().catch(playHandlers.onRejected);
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
            const pauseHandlers = {
                onRejected(err) {
                    console.warn('WakaVimeo: pause failed:', err);
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // Call the Vimeo SDK
            entry.player.pause().catch(pauseHandlers.onRejected);
        },

        /**
         * Seek to a time in seconds.
         * MSG_VIDEO_SEEK fires from the 'seeked' event with the actual landed position,
         * which may differ slightly from the requested time.
         * @param {string} pacId
         * @param {number} time - Target time in seconds
         */
        seek(pacId, time) {
            const seekHandlers = {
                onRejected(err) {
                    console.warn('WakaVimeo: seek failed:', err);
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            if (typeof time !== 'number' || Number.isNaN(time)) {
                return;
            }

            // Call the Vimeo SDK; MSG_VIDEO_SEEK fires from the seeked event
            entry.player.setCurrentTime(Math.max(0, time)).catch(seekHandlers.onRejected);
        },

        /**
         * Set the volume level.
         * MSG_VIDEO_VOLUME_CHANGE fires from the SDK's volumechange event.
         * The Vimeo SDK uses a 0–1 scale; we accept 0–100 to match WakaVideo convention.
         * @param {string} pacId
         * @param {number} volume - Value between 0 (silent) and 100 (full)
         */
        setVolume(pacId, volume) {
            const setVolumeHandlers = {
                onRejected(err) {
                    console.warn('WakaVimeo: setVolume failed:', err);
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            const clamped = Math.max(0, Math.min(100, volume));

            // Call the Vimeo SDK; MSG_VIDEO_VOLUME_CHANGE fires from the volumechange event
            entry.player.setVolume(clamped / 100).catch(setVolumeHandlers.onRejected);
        },

        /**
         * Set the muted state.
         * MSG_VIDEO_VOLUME_CHANGE fires from the SDK's volumechange event.
         * @param {string} pacId
         * @param {boolean} muted
         */
        setMuted(pacId, muted) {
            const setMutedHandlers = {
                onRejected(err) {
                    console.warn('WakaVimeo: setMuted failed:', err);
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // Call the Vimeo SDK; MSG_VIDEO_VOLUME_CHANGE fires from the volumechange event
            entry.player.setMuted(Boolean(muted)).catch(setMutedHandlers.onRejected);
        },

        /**
         * Set the playback rate.
         * MSG_VIDEO_RATE_CHANGE fires from the SDK's playbackratechange event.
         * Valid range is 0.5–2. Requires the 'speed' embed option to be true,
         * and a Vimeo PRO or Business account.
         * @param {string} pacId
         * @param {number} rate
         */
        setPlaybackRate(pacId, rate) {
            const setPlaybackRateHandlers = {
                onRejected(err) {
                    console.warn('WakaVimeo: setPlaybackRate failed:', err);
                }
            };

            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            if (typeof rate !== 'number' || Number.isNaN(rate)) {
                return;
            }

            // Clamp to the range the Vimeo SDK accepts. Values outside 0.5–2
            // will be rejected with a RangeError by the SDK.
            const clamped = Math.min(2, Math.max(0.5, rate));

            // Call the Vimeo SDK; MSG_VIDEO_RATE_CHANGE fires from the playbackratechange event
            entry.player.setPlaybackRate(clamped).catch(setPlaybackRateHandlers.onRejected);
        }
    };

    window.wakaVimeo = window.WakaVimeo;
})();
