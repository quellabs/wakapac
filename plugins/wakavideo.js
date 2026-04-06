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

    /**
     * Returns the registered video element for a pacId, or null if not found.
     * Used by public API methods that only need the video element.
     * Methods that need the full entry (play, addCue) call _registry.get() directly.
     * @param {string} pacId
     * @returns {HTMLVideoElement|null}
     */
    function getVideo(pacId) {
        return _registry.get(pacId)?.video ?? null;
    }

    /**
     * Returns a stable string key for a VTTCue, used to diff active cue maps.
     * @param {VTTCue} cue
     * @returns {string}
     */
    function cueKey(cue) {
        return `${cue.startTime}:${cue.endTime}:${cue.text}`;
    }

    /**
     * Advances currentTime on the abstraction once per animation frame while
     * the video is playing. Self-terminates when the video is paused or ended.
     * @param {string} pacId
     * @param {HTMLVideoElement} video
     * @param {Object} entry
     */
    function rafTick(pacId, video, entry) {
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
        entry.rafHandle = requestAnimationFrame(() => rafTick(pacId, video, entry));
    }

    /**
     * Starts the rAF loop for the given entry. No-op if already running.
     * @param {string} pacId
     * @param {HTMLVideoElement} video
     * @param {Object} entry
     */
    function startRaf(pacId, video, entry) {
        if (entry.rafHandle !== null) {
            return;
        }

        entry.rafHandle = requestAnimationFrame(() => rafTick(pacId, video, entry));
    }

    /**
     * Stops the rAF loop for the given entry. No-op if not running.
     * @param {Object} entry
     */
    function stopRaf(entry) {
        if (entry.rafHandle !== null) {
            cancelAnimationFrame(entry.rafHandle);
            entry.rafHandle = null;
        }
    }

    /**
     * Handles a cuechange event on the metadata track.
     * Diffs the current active cue map against the previous one and dispatches
     * MSG_VIDEO_CUE_ENTER / MSG_VIDEO_CUE_LEAVE for each cue that entered or left.
     * activeCues is a Map<key, VTTCue> so cue data is always available without
     * re-parsing the key.
     * @param {string} pacId
     * @param {Object} entry
     */
    function onCueChange(pacId, entry) {
        const current = new Map();

        for (const cue of entry.cueTrack.activeCues ?? []) {
            current.set(cueKey(cue), cue);
        }

        // Cues in current but not in previous → entered
        for (const [key, cue] of current) {
            if (!entry.activeCues.has(key)) {
                entry.pac.sendMessage(pacId, entry.msgCueEnter, 0, 0, {
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    text: cue.text
                });
            }
        }

        // Cues in previous but not in current → left
        for (const [key, cue] of entry.activeCues) {
            if (!current.has(key)) {
                entry.pac.sendMessage(pacId, entry.msgCueLeave, 0, 0, {
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    text: cue.text
                });
            }
        }

        entry.activeCues = current;
    }

    window.WakaVideo = {

        createPacPlugin(pac, _options = {}) {

            // Derive message constants from the host's MSG_PLUGIN base.
            // WakaVideo never hardcodes these values.
            const MSG_VIDEO_PLAY = pac.MSG_PLUGIN + 0x100;
            const MSG_VIDEO_PAUSE = pac.MSG_PLUGIN + 0x101;
            const MSG_VIDEO_ENDED = pac.MSG_PLUGIN + 0x102;
            const MSG_VIDEO_SEEK = pac.MSG_PLUGIN + 0x103;
            const MSG_VIDEO_LOADED = pac.MSG_PLUGIN + 0x104;
            const MSG_VIDEO_CUE_ENTER = pac.MSG_PLUGIN + 0x105;
            const MSG_VIDEO_CUE_LEAVE = pac.MSG_PLUGIN + 0x106;
            const MSG_VIDEO_ERROR = pac.MSG_PLUGIN + 0x107;
            const MSG_VIDEO_VOLUME_CHANGE = pac.MSG_PLUGIN + 0x108;
            const MSG_VIDEO_RATE_CHANGE = pac.MSG_PLUGIN + 0x109;
            const MSG_VIDEO_WAITING = pac.MSG_PLUGIN + 0x10A;
            const MSG_VIDEO_CANPLAY = pac.MSG_PLUGIN + 0x10B;
            const MSG_VIDEO_TIMEUPDATE = pac.MSG_PLUGIN + 0x10C;

            // Attach message constants so components can reference
            // them as WakaVideo.MSG_VIDEO_PLAY etc.
            this.MSG_VIDEO_PLAY = MSG_VIDEO_PLAY;
            this.MSG_VIDEO_PAUSE = MSG_VIDEO_PAUSE;
            this.MSG_VIDEO_ENDED = MSG_VIDEO_ENDED;
            this.MSG_VIDEO_SEEK = MSG_VIDEO_SEEK;
            this.MSG_VIDEO_LOADED = MSG_VIDEO_LOADED;
            this.MSG_VIDEO_CUE_ENTER = MSG_VIDEO_CUE_ENTER;
            this.MSG_VIDEO_CUE_LEAVE = MSG_VIDEO_CUE_LEAVE;
            this.MSG_VIDEO_ERROR = MSG_VIDEO_ERROR;
            this.MSG_VIDEO_VOLUME_CHANGE = MSG_VIDEO_VOLUME_CHANGE;
            this.MSG_VIDEO_RATE_CHANGE = MSG_VIDEO_RATE_CHANGE;
            this.MSG_VIDEO_WAITING = MSG_VIDEO_WAITING;
            this.MSG_VIDEO_CANPLAY = MSG_VIDEO_CANPLAY;
            this.MSG_VIDEO_TIMEUPDATE = MSG_VIDEO_TIMEUPDATE;

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
                    const container = pac.getContainerByPacId(pacId);

                    // Only activate for <video> containers
                    if (!container || !(container instanceof HTMLVideoElement)) {
                        return;
                    }

                    const video = container;
                    const entry = {
                        video,
                        pac,
                        msgVideoError: MSG_VIDEO_ERROR,
                        msgCueEnter: MSG_VIDEO_CUE_ENTER,
                        msgCueLeave: MSG_VIDEO_CUE_LEAVE,
                        msgTimeUpdate: MSG_VIDEO_TIMEUPDATE,
                        cueTrack: null,
                        cueChangeHandler: null,
                        activeCues: new Map(),
                        rafHandle: null
                    };

                    // Register the component
                    _registry.set(pacId, entry);

                    // Seed the abstraction with neutral initial values
                    abstraction.duration = NaN;
                    abstraction.videoWidth = null;
                    abstraction.videoHeight = null;

                    function onPlay() {
                        // Start the rAF loop to drive MSG_VIDEO_TIMEUPDATE
                        startRaf(pacId, video, entry);

                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_PLAY, 0, 0);
                    }

                    function onPause() {
                        // Stop the rAF loop
                        stopRaf(entry);

                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_PAUSE, 0, 0);
                    }

                    function onEnded() {
                        // Stop the rAF loop
                        stopRaf(entry);

                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_ENDED, 0, 0);
                    }

                    function onSeeked() {
                        const t = video.currentTime;

                        // Notify msgProc of the landed position
                        pac.sendMessage(pacId, MSG_VIDEO_SEEK, Math.trunc(t * 1000), 0, {
                            currentTime: t
                        });
                    }

                    function onLoadedMetadata() {
                        // Update the abstraction
                        abstraction.duration = video.duration;
                        abstraction.videoWidth = video.videoWidth;
                        abstraction.videoHeight = video.videoHeight;

                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_LOADED, 0, 0, {
                            duration: video.duration,
                            videoWidth: video.videoWidth,
                            videoHeight: video.videoHeight
                        });
                    }

                    function onVolumeChange() {
                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_VOLUME_CHANGE, video.volume * 100, video.muted ? 1 : 0, {
                            volume: video.volume * 100,
                            muted: video.muted
                        });
                    }

                    function onRateChange() {
                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_RATE_CHANGE, 0, 0, {
                            playbackRate: video.playbackRate
                        });
                    }

                    function onWaiting() {
                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_WAITING, 0, 0);
                    }

                    function onCanPlay() {
                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_CANPLAY, 0, 0);
                    }

                    /**
                     * Fallback for background tabs where rAF is suspended.
                     * timeupdate fires at ~4 Hz regardless of tab visibility.
                     * Only sends MSG_VIDEO_TIMEUPDATE when rAF is not already doing so,
                     * to avoid redundant messages in the common visible-tab case.
                     */
                    function onTimeUpdate() {
                        if (entry.rafHandle === null) {
                            const t = video.currentTime;

                            // Notify msgProc of the current playback position
                            pac.sendMessage(pacId, MSG_VIDEO_TIMEUPDATE, Math.trunc(t * 1000), 0, {
                                currentTime: t
                            });
                        }
                    }

                    function onError() {
                        const code = video.error?.code ?? 0;

                        // Notify msgProc
                        pac.sendMessage(pacId, MSG_VIDEO_ERROR, code, 0, {
                            message: video.error ? `MediaError code ${video.error.code}` : ''
                        });
                    }

                    // Wire up the video element events
                    video.addEventListener('play', onPlay);
                    video.addEventListener('pause', onPause);
                    video.addEventListener('ended', onEnded);
                    video.addEventListener('seeked', onSeeked);
                    video.addEventListener('loadedmetadata', onLoadedMetadata);
                    video.addEventListener('volumechange', onVolumeChange);
                    video.addEventListener('ratechange', onRateChange);
                    video.addEventListener('waiting', onWaiting);
                    video.addEventListener('canplay', onCanPlay);
                    video.addEventListener('timeupdate', onTimeUpdate);
                    video.addEventListener('error', onError);

                    // Metadata may have already loaded before the listener was attached,
                    // which is common with local files. Fire the message immediately if so.
                    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                        onLoadedMetadata();
                    }

                    // Store listener references for clean removal in onComponentDestroyed
                    _listeners.set(video, {
                        play: onPlay,
                        pause: onPause,
                        ended: onEnded,
                        seeked: onSeeked,
                        loadedmetadata: onLoadedMetadata,
                        volumechange: onVolumeChange,
                        ratechange: onRateChange,
                        waiting: onWaiting,
                        canplay: onCanPlay,
                        timeupdate: onTimeUpdate,
                        error: onError
                    });
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
                    stopRaf(entry);

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
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // Call the video API; catch autoplay policy rejections and forward to msgProc
            entry.video.play().catch(err => {
                entry.pac.sendMessage(pacId, entry.msgVideoError, 0, 0, {
                    message: err.message ?? ''
                });
            });
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
            // Call the video API
            getVideo(pacId)?.pause();
        },

        /**
         * Seek to a time in seconds.
         * MSG_VIDEO_SEEK fires when the seek completes.
         * @param {string} pacId
         * @param {number} time - Target time in seconds
         */
        seek(pacId, time) {
            const video = getVideo(pacId);

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
            const video = getVideo(pacId);

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
            const video = getVideo(pacId);

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
            const video = getVideo(pacId);

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
            const video = getVideo(pacId);

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
            const video = getVideo(pacId);

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
                entry.cueTrack = entry.video.addTextTrack('metadata', 'waka-cues', 'zxx');
                entry.cueTrack.mode = 'hidden';
                entry.cueChangeHandler = () => onCueChange(pacId, entry);
                entry.cueTrack.addEventListener('cuechange', entry.cueChangeHandler);
            }

            // Add the cue to the track
            entry.cueTrack.addCue(new VTTCue(startTime, endTime, text));
        }
    };

})();