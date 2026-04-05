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
 * ║    MSG_VIDEO_SEEK         — seek completed; extended.currentTime (actual position)  ║
 * ║    MSG_VIDEO_LOADED       — video ready; extended.duration/videoWidth/              ║
 * ║                             videoHeight/volume/muted/playbackRate                   ║
 * ║    MSG_VIDEO_VOLUME_CHANGE — volume or muted changed; wParam = volume (0–100),      ║
 * ║                              lParam = muted (1/0); extended.volume/muted            ║
 * ║    MSG_VIDEO_RATE_CHANGE  — playback rate changed; extended.playbackRate            ║
 * ║    MSG_VIDEO_WAITING      — buffering started (bufferstart event)                   ║
 * ║    MSG_VIDEO_CANPLAY      — buffering ended (bufferend event)                       ║
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
 * ║    currentTime   — updated via timeupdate event (~250 ms) during playback           ║
 * ║    duration      — set when MSG_VIDEO_LOADED fires                                  ║
 * ║    videoWidth    — set when MSG_VIDEO_LOADED fires                                  ║
 * ║    videoHeight   — set when MSG_VIDEO_LOADED fires                                  ║
 * ║    volume        — 0–100; updated on MSG_VIDEO_VOLUME_CHANGE                        ║
 * ║    muted         — updated on MSG_VIDEO_VOLUME_CHANGE                               ║
 * ║    playbackRate  — updated on MSG_VIDEO_RATE_CHANGE                                 ║
 * ║                                                                                     ║
 * ╚═════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

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
     * Queue of pending component descriptors created before the SDK loaded.
     * @type {Array<{ abstraction: Object, pacId: string, videoId: string, pac: Object, msgConstants: Object, embedOptions: Object }>}
     */
    const _pendingInits = [];

    /**
     * Injects the Vimeo Player SDK script tag. Safe to call multiple times —
     * only injects once. Drains the pending queue on load.
     */
    function ensureApiLoaded() {
        if (document.getElementById('waka-vimeo-api-script')) {
            return;
        }

        const tag = document.createElement('script');
        tag.id  = 'waka-vimeo-api-script';
        tag.src = 'https://player.vimeo.com/api/player.js';

        tag.onload = function () {
            _apiReady = true;

            for (const pending of _pendingInits) {
                createPlayer(
                    pending.abstraction,
                    pending.pacId,
                    pending.videoId,
                    pending.pac,
                    pending.msgConstants,
                    pending.embedOptions
                );
            }

            _pendingInits.length = 0;
        };

        tag.onerror = function () {
            // Script failed to load (network error, CSP block, etc.).
            // Components in the queue will never initialize; remove them to
            // prevent them from sitting in memory indefinitely.
            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

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

    /**
     * Returns the Vimeo.Player for a pacId, or null if not found.
     * @param {string} pacId
     * @returns {Vimeo.Player|null}
     */
    function getPlayer(pacId) {
        return _registry.get(pacId)?.player ?? null;
    }

    // =========================================================================
    // Player construction
    // =========================================================================

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
    function createPlayer(abstraction, pacId, videoId, pac, msgConstants, embedOptions) {
        const container = pac.getContainerByPacId(pacId);

        if (!container || !container.isConnected) {
            return;
        }

        const player = new Vimeo.Player(container, {
            id:  Number(videoId),
            dnt: true,            // privacy-enhanced embed; no tracking cookies
            ...embedOptions
        });

        const entry = { pac, player, abstraction, msgConstants };
        _registry.set(pacId, entry);

        // -----------------------------------------------------------------
        // loaded — fires when the video metadata is ready (also when
        // loadVideo() loads a new video into an existing player).
        // We read all metadata asynchronously via Promise.all since the
        // Vimeo SDK exposes only async getters.
        // -----------------------------------------------------------------
        player.on('loaded', function () {
            Promise.all([
                player.getDuration(),
                player.getVideoWidth(),
                player.getVideoHeight(),
                player.getVolume(),
                player.getMuted(),
                player.getPlaybackRate()
            ]).then(function ([duration, videoWidth, videoHeight, volume, muted, playbackRate]) {
                abstraction.duration    = duration;
                abstraction.videoWidth  = videoWidth;
                abstraction.videoHeight = videoHeight;
                abstraction.volume      = volume * 100;
                abstraction.muted       = muted;
                abstraction.playbackRate = playbackRate;

                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_LOADED, 0, 0, {
                    duration,
                    videoWidth,
                    videoHeight,
                    volume:       volume * 100,
                    muted,
                    playbackRate
                });
            }).catch(function (err) {
                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                    message: err.message ?? 'Error reading video metadata'
                });
            });
        });

        // -----------------------------------------------------------------
        // timeupdate — fires at ~250 ms intervals during playback.
        // data: { seconds, percent, duration }
        // -----------------------------------------------------------------
        player.on('timeupdate', function (data) {
            abstraction.currentTime = data.seconds;
        });

        // -----------------------------------------------------------------
        // play / pause / ended
        // -----------------------------------------------------------------
        player.on('play', function () {
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_PLAY, 0, 0);
        });

        player.on('pause', function (data) {
            abstraction.currentTime = data.seconds;
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_PAUSE, 0, 0);
        });

        player.on('ended', function (data) {
            abstraction.currentTime = data.seconds;
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_ENDED, 0, 0);
        });

        // -----------------------------------------------------------------
        // seeked — fires after setCurrentTime() resolves with the actual
        // position the player landed on (may differ from requested time).
        // data: { seconds, percent, duration }
        // -----------------------------------------------------------------
        player.on('seeked', function (data) {
            abstraction.currentTime = data.seconds;
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_SEEK, 0, 0, {
                currentTime: data.seconds
            });
        });

        // -----------------------------------------------------------------
        // volumechange — fires for both volume level and muted changes,
        // including changes made through the player UI.
        // data: { volume, muted }  (volume is 0–1)
        // -----------------------------------------------------------------
        player.on('volumechange', function (data) {
            const volume = data.volume * 100;

            abstraction.volume = volume;
            abstraction.muted  = data.muted;

            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_VOLUME_CHANGE, volume, data.muted ? 1 : 0, {
                volume: volume,
                muted:  data.muted
            });
        });

        // -----------------------------------------------------------------
        // playbackratechange — data: { playbackRate }
        // -----------------------------------------------------------------
        player.on('playbackratechange', function (data) {
            abstraction.playbackRate = data.playbackRate;

            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_RATE_CHANGE, 0, 0, {
                playbackRate: data.playbackRate
            });
        });

        // -----------------------------------------------------------------
        // bufferstart / bufferend → WAITING / CANPLAY
        // -----------------------------------------------------------------
        player.on('bufferstart', function () {
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_WAITING, 0, 0);
        });

        player.on('bufferend', function () {
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_CANPLAY, 0, 0);
        });

        // -----------------------------------------------------------------
        // error — data: { message, method, name }
        // -----------------------------------------------------------------
        player.on('error', function (data) {
            pac.sendMessage(pacId, msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                message: data.message ?? 'Unknown Vimeo error'
            });
        });
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaVimeo = {

        createPacPlugin(pac, _options = {}) {

            // Derive message constants from the host's MSG_PLUGIN base.
            // Offsets are identical to WakaVideo and WakaYouTube so msgProc
            // handlers are interchangeable across all three plugins.
            const MSG_VIDEO_PLAY          = pac.MSG_PLUGIN + 0x100;
            const MSG_VIDEO_PAUSE         = pac.MSG_PLUGIN + 0x101;
            const MSG_VIDEO_ENDED         = pac.MSG_PLUGIN + 0x102;
            const MSG_VIDEO_SEEK          = pac.MSG_PLUGIN + 0x103;
            const MSG_VIDEO_LOADED        = pac.MSG_PLUGIN + 0x104;
            // 0x105 MSG_VIDEO_CUE_ENTER — not supported (no TextTrack access)
            // 0x106 MSG_VIDEO_CUE_LEAVE — not supported (no TextTrack access)
            const MSG_VIDEO_ERROR         = pac.MSG_PLUGIN + 0x107;
            const MSG_VIDEO_VOLUME_CHANGE = pac.MSG_PLUGIN + 0x108;
            const MSG_VIDEO_RATE_CHANGE   = pac.MSG_PLUGIN + 0x109;
            const MSG_VIDEO_WAITING       = pac.MSG_PLUGIN + 0x10A;
            const MSG_VIDEO_CANPLAY       = pac.MSG_PLUGIN + 0x10B;

            // Attach constants so components can reference WakaVimeo.MSG_VIDEO_PLAY etc.
            this.MSG_VIDEO_PLAY          = MSG_VIDEO_PLAY;
            this.MSG_VIDEO_PAUSE         = MSG_VIDEO_PAUSE;
            this.MSG_VIDEO_ENDED         = MSG_VIDEO_ENDED;
            this.MSG_VIDEO_SEEK          = MSG_VIDEO_SEEK;
            this.MSG_VIDEO_LOADED        = MSG_VIDEO_LOADED;
            this.MSG_VIDEO_ERROR         = MSG_VIDEO_ERROR;
            this.MSG_VIDEO_VOLUME_CHANGE = MSG_VIDEO_VOLUME_CHANGE;
            this.MSG_VIDEO_RATE_CHANGE   = MSG_VIDEO_RATE_CHANGE;
            this.MSG_VIDEO_WAITING       = MSG_VIDEO_WAITING;
            this.MSG_VIDEO_CANPLAY       = MSG_VIDEO_CANPLAY;

            const msgConstants = {
                MSG_VIDEO_PLAY,
                MSG_VIDEO_PAUSE,
                MSG_VIDEO_ENDED,
                MSG_VIDEO_SEEK,
                MSG_VIDEO_LOADED,
                MSG_VIDEO_ERROR,
                MSG_VIDEO_VOLUME_CHANGE,
                MSG_VIDEO_RATE_CHANGE,
                MSG_VIDEO_WAITING,
                MSG_VIDEO_CANPLAY
            };

            // Plugin-level embed option defaults, set via wakaPAC.use(WakaVimeo, { ... }).
            // Per-instance config under the 'vimeo' key overrides these.
            const _defaultEmbedOptions = {
                controls:     _options.controls     ?? true,
                speed:        _options.speed        ?? false,
                transparent:  _options.transparent  ?? true
            };

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
                    const container = pac.getContainerByPacId(pacId);

                    if (!container || !(container instanceof HTMLDivElement)) {
                        return;
                    }

                    const videoId = container.dataset.vimeoId;

                    if (!videoId) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    // wakaPAC('id', { msgProc }, { vimeo: { controls: false } })
                    const embedOptions = {
                        ..._defaultEmbedOptions,
                        ...(_config.vimeo ?? {})
                    };

                    // Seed the abstraction with neutral initial values.
                    abstraction.currentTime  = 0;
                    abstraction.duration     = NaN;
                    abstraction.videoWidth   = null;
                    abstraction.videoHeight  = null;
                    abstraction.volume       = 100;
                    abstraction.muted        = false;
                    abstraction.playbackRate = 1;

                    ensureApiLoaded();

                    if (_apiReady) {
                        createPlayer(abstraction, pacId, videoId, pac, msgConstants, embedOptions);
                    } else {
                        _pendingInits.push({ abstraction, pacId, videoId, pac, msgConstants, embedOptions });
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init, destroys the Vimeo.Player instance,
                 * and removes the registry entry.
                 *
                 * @param {Object} abstraction
                 * @param {string} pacId
                 */
                onComponentDestroyed(abstraction, pacId) {
                    const pendingIndex = _pendingInits.findIndex(p => p.pacId === pacId);

                    if (pendingIndex !== -1) {
                        _pendingInits.splice(pendingIndex, 1);
                    }

                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    // destroy() returns a Promise; we don't await it since the
                    // component is already being torn down.
                    entry.player.destroy().catch(function () {
                        // Ignore errors during destruction.
                    });

                    _registry.delete(pacId);
                }
            };
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
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            entry.player.play().catch(function (err) {
                entry.pac.sendMessage(pacId, entry.msgConstants.MSG_VIDEO_ERROR, 0, 0, {
                    message: err.message ?? 'Play failed'
                });
            });
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
            getPlayer(pacId)?.pause().catch(function () {});
        },

        /**
         * Seek to a time in seconds.
         * MSG_VIDEO_SEEK fires from the 'seeked' event with the actual landed position,
         * which may differ slightly from the requested time.
         * @param {string} pacId
         * @param {number} time - Target time in seconds
         */
        seek(pacId, time) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            if (typeof time !== 'number' || Number.isNaN(time)) {
                return;
            }

            // setCurrentTime rejects with RangeError if time is out of bounds;
            // the rejection is handled by the 'error' event listener on the player,
            // which dispatches MSG_VIDEO_ERROR. No need to duplicate error handling here.
            entry.player.setCurrentTime(Math.max(0, time)).catch(function () {});
        },

        /**
         * Set the volume level.
         * MSG_VIDEO_VOLUME_CHANGE fires from the SDK's volumechange event.
         * The Vimeo SDK uses a 0–1 scale; we accept 0–100 to match WakaVideo convention.
         * @param {string} pacId
         * @param {number} volume - Value between 0 (silent) and 100 (full)
         */
        setVolume(pacId, volume) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            const clamped = Math.max(0, Math.min(100, volume));
            entry.player.setVolume(clamped / 100).catch(function () {});
        },

        /**
         * Set the muted state.
         * MSG_VIDEO_VOLUME_CHANGE fires from the SDK's volumechange event.
         * @param {string} pacId
         * @param {boolean} muted
         */
        setMuted(pacId, muted) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            entry.player.setMuted(Boolean(muted)).catch(function () {});
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
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            entry.player.setPlaybackRate(rate).catch(function () {});
        }
    };

})();