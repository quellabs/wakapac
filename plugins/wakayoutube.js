/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██╗   ██╗████████╗██╗   ██╗██████╗ ███████╗       ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝██║   ██║██╔══██╗██╔════╝       ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║ ╚████╔╝    ██║   ██║   ██║██████╔╝█████╗         ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║  ╚██╔╝     ██║   ██║   ██║██╔══██╗██╔══╝         ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║   ██║      ██║   ╚██████╔╝██████╔╝███████╗       ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝ ╚═════╝ ╚══════╝       ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaYouTube                                                        ║
 * ║                                                                                      ║
 * ║  Wraps YouTube IFrame Player instances inside PAC containers, bridging the           ║
 * ║  YouTube IFrame API into the WakaPAC message and abstraction model.                  ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <div> element with a               ║
 * ║  data-youtube-id attribute holding the YouTube video ID. The YouTube IFrame          ║
 * ║  API script is injected automatically on first use and shared across all             ║
 * ║  instances on the page. Components created before the API is ready are queued        ║
 * ║  and initialized once onYouTubeIframeAPIReady fires.                                 ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaYouTube);                                                         ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <div data-pac-id="player1" data-youtube-id="dQw4w9WgXcQ"></div>                   ║
 * ║                                                                                      ║
 * ║  The following features from WakaVideo are omitted — the YouTube IFrame API          ║
 * ║  cannot provide them due to cross-origin restrictions:                               ║
 * ║    - bitBlt / stretchBlt  (canvas taint blocks drawImage on cross-origin iframes)    ║
 * ║    - addCue / MSG_VIDEO_CUE_ENTER / MSG_VIDEO_CUE_LEAVE  (no TextTrack access)       ║
 * ║    - setPlaybackRate / MSG_VIDEO_RATE_CHANGE  (not exposed by the IFrame API)        ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_VIDEO_PLAY         — playback started                                         ║
 * ║    MSG_VIDEO_PAUSE        — playback paused                                          ║
 * ║    MSG_VIDEO_ENDED        — playback reached the end                                 ║
 * ║    MSG_VIDEO_SEEK         — seek dispatched; wParam = ms (truncated),                ║
 * ║                             extended.currentTime (fractional seconds)                ║
 * ║    MSG_VIDEO_LOADED       — video metadata available; extended.duration.             ║
 * ║                             Fired once per video load, on the first transition       ║
 * ║                             into playing or cued state.                              ║
 * ║    MSG_VIDEO_VOLUME_CHANGE — volume or muted changed; wParam = volume (0–100),       ║
 * ║                              lParam = muted (1/0); extended.volume/muted             ║
 * ║    MSG_VIDEO_WAITING      — player is buffering (IFrame API state 3)                 ║
 * ║    MSG_VIDEO_CANPLAY      — buffering resolved; fires before MSG_VIDEO_PLAY          ║
 * ║                             when the player transitions from buffering to playing    ║
 * ║    MSG_VIDEO_TIMEUPDATE   — fired each animation frame during playback;              ║
 * ║                             wParam = ms (truncated),                                 ║
 * ║                             extended.currentTime (fractional seconds)                ║
 * ║    MSG_VIDEO_ERROR        — playback error; wParam = YouTube error code              ║
 * ║                             (2 invalid param, 5 HTML5 error, 100 not found,          ║
 * ║                              101/150 embedding not allowed)                          ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaYouTube.play(pacId)              — start playback                             ║
 * ║    WakaYouTube.pause(pacId)             — pause playback                             ║
 * ║    WakaYouTube.seek(pacId, time)        — seek to time in seconds                    ║
 * ║    WakaYouTube.setVolume(pacId, volume) — set volume (0–100)                         ║
 * ║    WakaYouTube.setMuted(pacId, muted)   — set muted state                            ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    duration     — set when MSG_VIDEO_LOADED fires                                    ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // YouTube IFrame API bootstrap
    //
    // The IFrame API is a single shared global. We inject its script tag once
    // and resolve all pending component initializations from the ready callback.
    // If something else on the page has already set onYouTubeIframeAPIReady we
    // chain onto it rather than clobbering it.
    // =========================================================================

    /**
     * True once onYouTubeIframeAPIReady has fired and YT.Player is available.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * Queue of pending component descriptors for components that were created
     * before the IFrame API finished loading.
     * @type {Array<{ abstraction: Object, pacId: string, videoId: string, pac: Object, msgConstants: Object, playerVars: Object }>}
     */
    const _pendingInits = [];

    /**
     * Injects the YouTube IFrame API script tag and wires up the global ready
     * callback. Safe to call multiple times — only injects the tag once.
     * Chains onto any pre-existing onYouTubeIframeAPIReady the page may have set.
     */
    function ensureApiLoaded() {
        // Already injected; the ready callback will fire in due course.
        if (document.getElementById('waka-youtube-api-script')) {
            return;
        }

        // Create a player
        const existing = window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady = function () {
            // Honour any pre-existing ready callback first so that scripts which
            // registered before us complete their initialization before we start
            // constructing players. Initialization ordering is preserved.
            if (typeof existing === 'function') {
                existing();
            }

            _apiReady = true;

            // Drain the queue of components that were created before the API loaded.
            for (const pending of _pendingInits) {
                createPlayer(
                    pending.abstraction,
                    pending.pacId,
                    pending.videoId,
                    pending.pac,
                    pending.msgConstants,
                    pending.playerVars
                );
            }

            _pendingInits.length = 0;
        };

        const tag = document.createElement('script');
        tag.id = 'waka-youtube-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';

        tag.onerror = function () {
            // Script failed to load (network error, CSP block, etc.).
            // Notify each queued component via MSG_VIDEO_ERROR so msgProc can
            // react rather than silently waiting forever.
            for (const pending of _pendingInits) {
                pending.pac.sendMessage(
                    pending.pacId,
                    pending.msgConstants.MSG_VIDEO_ERROR,
                    0, 0,
                    {message: 'YouTube IFrame API failed to load'}
                );
            }

            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    // =========================================================================
    // Registry
    // =========================================================================

    /**
     * Registry of active YouTube components keyed by pacId.
     * @type {Map<string, {
     *   pac:          Object,
     *   player:       YT.Player,
     *   abstraction:  Object,
     *   msgConstants: Object,
     *   rafHandle:    number|null,
     *   prevState:    number,
     *   loadedFired:  boolean
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // currentTime tracking
    //
    // getCurrentTime() returns a locally cached value inside the IFrame API —
    // it is not a postMessage round-trip. Polling it once per animation frame
    // is cheap and gives smooth currentTime updates for progress bars.
    // The rAF loop self-terminates when the player is no longer playing.
    // =========================================================================

    /**
     * Advances currentTime on the abstraction once per animation frame while
     * the player is playing. Self-terminates when rafHandle is cleared.
     * @param pacId
     * @param {Object} entry
     */
    function rafTick(pacId, entry) {
        // Stop the loop if it was cancelled
        if (entry.rafHandle === null) {
            return;
        }

        const t = entry.player.getCurrentTime();

        // Notify msgProc of the current playback position
        entry.pac.sendMessage(pacId, entry.msgConstants.MSG_VIDEO_TIMEUPDATE, Math.trunc(t * 1000), 0, {
            currentTime: t
        });

        // Schedule the next tick
        entry.rafHandle = requestAnimationFrame(() => rafTick(pacId, entry));
    }

    /**
     * Starts the rAF loop. No-op if already running.
     * @param pacId
     * @param {Object} entry
     */
    function startPolling(pacId, entry) {
        if (entry.rafHandle !== null) {
            return;
        }

        entry.rafHandle = requestAnimationFrame(() => rafTick(pacId, entry));
    }

    /**
     * Stops the rAF loop. No-op if not running.
     * @param {Object} entry
     */
    function stopPolling(entry) {
        if (entry.rafHandle !== null) {
            cancelAnimationFrame(entry.rafHandle);
            entry.rafHandle = null;
        }
    }

    // =========================================================================
    // Player state → messages
    // =========================================================================

    /**
     * YouTube IFrame API player state constants.
     * @enum {number}
     */
    const YT_UNSTARTED = -1;
    const YT_ENDED = 0;
    const YT_PLAYING = 1;
    const YT_PAUSED = 2;
    const YT_BUFFERING = 3;
    const YT_VIDEO_CUED = 5;

    /**
     * Human-readable messages for YouTube IFrame API error codes.
     * Passed as extended.message in MSG_VIDEO_ERROR; wParam carries the raw code.
     * @type {Object<number, string>}
     */
    const YT_ERROR_MESSAGES = {
        2: 'Invalid video ID or parameter',
        5: 'HTML5 playback error',
        100: 'Video not found or has been removed',
        101: 'Embedding not allowed for this video',
        150: 'Embedding not allowed for this video'
    };

    // Note on volume change detection:
    // The IFrame API does not fire any event when the user changes volume or mute
    // state through YouTube's own UI. Because controls are set to 0, the native UI
    // is hidden and this limitation has no practical effect. If controls are ever
    // re-enabled, the abstraction's volume and muted properties will not reflect
    // changes made through the player UI — only changes made through setVolume()
    // and setMuted() will be tracked.

    /**
     * Fires MSG_VIDEO_LOADED for the entry if it has not already fired for the
     * current video load. Reads duration, volume, and muted from the player at
     * the point of calling so values are always current.
     * @param {string} pacId
     * @param {Object} entry
     */
    function maybeFireLoaded(pacId, entry) {
        if (entry.loadedFired) {
            return;
        }

        entry.loadedFired = true;

        const {pac, player, abstraction, msgConstants} = entry;

        // Update the abstraction
        abstraction.duration = player.getDuration();

        // Notify msgProc
        pac.sendMessage(pacId, msgConstants.MSG_VIDEO_LOADED, 0, 0, {
            duration: abstraction.duration
        });
    }

    /**
     * Handles a player state change event from the IFrame API.
     * Maps YT states to WakaPAC messages, manages the polling interval, and
     * fires MSG_VIDEO_LOADED on the first cued/playing transition per video load.
     * @param {string} pacId
     * @param {Object} entry
     * @param {number} newState
     */
    function onStateChange(pacId, entry, newState) {
        const {pac, player, abstraction, msgConstants} = entry;

        switch (newState) {

            case YT_PLAYING:
                maybeFireLoaded(pacId, entry);

                // When recovering from buffering, emit CANPLAY before PLAY so
                // msgProc can distinguish a buffering recovery from a fresh play.
                if (entry.prevState === YT_BUFFERING) {
                    pac.sendMessage(pacId, msgConstants.MSG_VIDEO_CANPLAY, 0, 0);
                }

                // Start the rAF loop to drive MSG_VIDEO_TIMEUPDATE
                startPolling(pacId, entry);

                // Notify msgProc
                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_PLAY, 0, 0);
                break;

            case YT_PAUSED:
                // Stop the rAF loop
                stopPolling(entry);

                // Notify msgProc
                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_PAUSE, 0, 0);
                break;

            case YT_ENDED:
                // Stop the rAF loop
                stopPolling(entry);

                // Notify msgProc
                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_ENDED, 0, 0);
                break;

            case YT_BUFFERING:
                // Stop the rAF loop while buffering
                stopPolling(entry);

                // Notify msgProc
                pac.sendMessage(pacId, msgConstants.MSG_VIDEO_WAITING, 0, 0);
                break;

            case YT_VIDEO_CUED:
                // Video is loaded and ready to play but not yet started.
                // Fire MSG_VIDEO_LOADED here so the host can read duration before
                // the user ever presses play.
                maybeFireLoaded(pacId, entry);
                break;

            case YT_UNSTARTED:
                // Player was reset (e.g. loadVideoById called on an existing player).
                // Allow MSG_VIDEO_LOADED to fire again for the incoming video.
                entry.loadedFired = false;
                break;
        }

        entry.prevState = newState;
    }

    // =========================================================================
    // Player construction
    // =========================================================================

    /**
     * Instantiates a YT.Player for the given container and registers it.
     * Called immediately if the IFrame API is already ready, or deferred via
     * _pendingInits if called before onYouTubeIframeAPIReady has fired.
     * @param {Object} abstraction
     * @param {string} pacId
     * @param {string} videoId
     * @param {Object} pac
     * @param {Object} msgConstants
     * @param {Object} playerVars - Merged plugin-level and per-instance playerVars
     */
    function createPlayer(abstraction, pacId, videoId, pac, msgConstants, playerVars) {
        const container = pac.getContainerByPacId(pacId);

        // Guard: the component may have been destroyed while waiting for the API,
        // or the container may have been detached from the DOM in the meantime.
        if (!container || !container.isConnected) {
            return;
        }

        // Register the component; player is assigned below once YT.Player is constructed
        const entry = {
            pac,
            player: null,
            abstraction,
            msgConstants,
            rafHandle: null,
            prevState: YT_UNSTARTED,
            loadedFired: false
        };

        _registry.set(pacId, entry);

        // Instantiate the YouTube player in the container
        entry.player = new YT.Player(container, {
            // host must be at the top level of the config object, not inside
            // playerVars — YouTube ignores it there.
            host: 'https://www.youtube-nocookie.com',
            videoId,
            playerVars,
            events: {
                onStateChange(event) {
                    onStateChange(pacId, entry, event.data);
                },
                onError(event) {
                    // Notify msgProc
                    pac.sendMessage(pacId, msgConstants.MSG_VIDEO_ERROR, event.data, 0, {
                        message: YT_ERROR_MESSAGES[event.data] ?? 'Unknown YouTube error'
                    });
                }
            }
        });
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaYouTube = {

        createPacPlugin(pac, _options = {}) {

            // Plugin-level playerVars defaults, set via wakaPAC.use(WakaYouTube, { ... }).
            // Per-instance config passed as the third argument to wakaPAC() under the
            // 'youtube' key overrides these on a property-by-property basis.
            // enablejsapi is always forced to 1 — the plugin cannot function without it.
            const _defaultPlayerVars = {
                controls: _options.controls ?? 0,
                rel: _options.rel ?? 0
            };

            // Derive message constants from the host's MSG_PLUGIN base.
            // Offsets are identical to WakaVideo so msgProc handlers are
            // interchangeable between the two plugins.
            const MSG_VIDEO_PLAY = pac.MSG_PLUGIN + 0x100;
            const MSG_VIDEO_PAUSE = pac.MSG_PLUGIN + 0x101;
            const MSG_VIDEO_ENDED = pac.MSG_PLUGIN + 0x102;
            const MSG_VIDEO_SEEK = pac.MSG_PLUGIN + 0x103;
            const MSG_VIDEO_LOADED = pac.MSG_PLUGIN + 0x104;
            const MSG_VIDEO_ERROR = pac.MSG_PLUGIN + 0x107;
            const MSG_VIDEO_VOLUME_CHANGE = pac.MSG_PLUGIN + 0x108;
            const MSG_VIDEO_WAITING = pac.MSG_PLUGIN + 0x10A;
            const MSG_VIDEO_CANPLAY = pac.MSG_PLUGIN + 0x10B;
            const MSG_VIDEO_TIMEUPDATE = pac.MSG_PLUGIN + 0x10C;

            // Attach constants so components can reference WakaYouTube.MSG_VIDEO_PLAY etc.
            this.MSG_VIDEO_PLAY = MSG_VIDEO_PLAY;
            this.MSG_VIDEO_PAUSE = MSG_VIDEO_PAUSE;
            this.MSG_VIDEO_ENDED = MSG_VIDEO_ENDED;
            this.MSG_VIDEO_SEEK = MSG_VIDEO_SEEK;
            this.MSG_VIDEO_LOADED = MSG_VIDEO_LOADED;
            this.MSG_VIDEO_ERROR = MSG_VIDEO_ERROR;
            this.MSG_VIDEO_VOLUME_CHANGE = MSG_VIDEO_VOLUME_CHANGE;
            this.MSG_VIDEO_WAITING = MSG_VIDEO_WAITING;
            this.MSG_VIDEO_CANPLAY = MSG_VIDEO_CANPLAY;
            this.MSG_VIDEO_TIMEUPDATE = MSG_VIDEO_TIMEUPDATE;

            const msgConstants = {
                MSG_VIDEO_PLAY,
                MSG_VIDEO_PAUSE,
                MSG_VIDEO_ENDED,
                MSG_VIDEO_SEEK,
                MSG_VIDEO_LOADED,
                MSG_VIDEO_ERROR,
                MSG_VIDEO_VOLUME_CHANGE,
                MSG_VIDEO_WAITING,
                MSG_VIDEO_CANPLAY,
                MSG_VIDEO_TIMEUPDATE
            };

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Activates only when the container is a <div> with a data-youtube-id
                 * attribute. Injects the IFrame API script on first use and either
                 * creates the player immediately (API already ready) or queues it.
                 *
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config (unused)
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    // Only activate for <div> containers carrying a YouTube video ID.
                    if (!container || !(container instanceof HTMLDivElement)) {
                        return;
                    }

                    // Fetch the video ID
                    const videoId = container.dataset.youtubeId;

                    if (!videoId) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    // Per-instance config is passed as the third argument to wakaPAC()
                    // under the 'youtube' key: wakaPAC('id', { msgProc }, { youtube: { controls: 1 } })
                    // enablejsapi is always forced to 1 regardless of either config.
                    const playerVars = {
                        ..._defaultPlayerVars,
                        ...(_config.youtube ?? {}),
                        enablejsapi: 1
                    };

                    // Seed the abstraction with a neutral initial value before the
                    // player is ready, so bindings have something to render.
                    abstraction.duration = NaN;

                    // Inject the API script if not already done, then create the player
                    ensureApiLoaded();

                    if (_apiReady) {
                        createPlayer(abstraction, pacId, videoId, pac, msgConstants, playerVars);
                    } else {
                        _pendingInits.push({abstraction, pacId, videoId, pac, msgConstants, playerVars});
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, stops the currentTime
                 * polling interval, destroys the YT.Player instance, and removes
                 * the registry entry.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    // If destroyed while still waiting for the API, pull it from
                    // the queue so createPlayer is never called for it.
                    const pendingIndex = _pendingInits.findIndex(p => p.pacId === pacId);

                    if (pendingIndex !== -1) {
                        _pendingInits.splice(pendingIndex, 1);
                    }

                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    // Stop the rAF loop
                    stopPolling(entry);

                    // Destroy the YouTube player instance
                    entry.player.destroy();

                    // Unregister the component
                    _registry.delete(pacId);
                }
            };
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Start playback.
         * @param {string} pacId
         */
        play(pacId) {
            // Call the YouTube API
            _registry.get(pacId)?.player?.playVideo();
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
            // Call the YouTube API
            _registry.get(pacId)?.player?.pauseVideo();
        },

        /**
         * Seek to a time in seconds.
         * MSG_VIDEO_SEEK is dispatched immediately after the seek call since the
         * IFrame API provides no seeked completion event. allowSeekAhead is true
         * so the player can seek into regions that have not yet buffered.
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

            // Clamp to the valid range. Seeking past the end or before zero causes
            // unpredictable behaviour in the IFrame API.
            const duration = entry.player.getDuration();
            const clamped = Math.max(0, duration > 0 ? Math.min(time, duration) : time);

            // Call the YouTube API
            entry.player.seekTo(clamped, true);

            // Notify msgProc immediately; the IFrame API has no seeked completion event
            entry.pac.sendMessage(pacId, entry.msgConstants.MSG_VIDEO_SEEK, Math.trunc(clamped * 1000), 0, {
                currentTime: clamped
            });
        },

        /**
         * Set the volume level.
         * MSG_VIDEO_VOLUME_CHANGE fires after the change.
         * The IFrame API uses a 0–100 scale natively, matching WakaVideo's
         * updated convention — no conversion is required.
         * @param {string} pacId
         * @param {number} volume - Value between 0 (silent) and 100 (full)
         */
        setVolume(pacId, volume) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            const clamped = Math.max(0, Math.min(100, volume));
            const muted = entry.player.isMuted() ? 1 : 0;

            // Call the YouTube API
            entry.player.setVolume(clamped);

            // Notify msgProc; the IFrame API fires no volumechange event
            entry.pac.sendMessage(
                pacId,
                entry.msgConstants.MSG_VIDEO_VOLUME_CHANGE,
                clamped,
                muted,
                {
                    volume: clamped,
                    muted: Boolean(muted)
                }
            );
        },

        /**
         * Set the muted state.
         * MSG_VIDEO_VOLUME_CHANGE fires after the change.
         * @param {string} pacId
         * @param {boolean} muted
         */
        setMuted(pacId, muted) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            muted = Boolean(muted);

            // Call the YouTube API
            if (muted) {
                entry.player.mute();
            } else {
                entry.player.unMute();
            }

            const volume = entry.player.getVolume();

            // Notify msgProc; the IFrame API fires no volumechange event
            entry.pac.sendMessage(pacId, entry.msgConstants.MSG_VIDEO_VOLUME_CHANGE, volume, muted ? 1 : 0, {
                volume,
                muted
            });
        }
    };

})();