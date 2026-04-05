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
 * ║    MSG_VIDEO_SEEK       — seek completed; extended.currentTime                       ║
 * ║    MSG_VIDEO_LOADED        — metadata available; extended.duration/videoWidth/       ║
 * ║                              videoHeight/volume/muted/playbackRate                   ║
 * ║    MSG_VIDEO_VOLUME_CHANGE — volume or muted changed; extended.volume/muted          ║
 * ║    MSG_VIDEO_RATE_CHANGE   — playbackRate changed; extended.playbackRate             ║
 * ║    MSG_VIDEO_WAITING       — playback stalled waiting for data (waiting event)       ║
 * ║    MSG_VIDEO_CANPLAY       — enough data to resume playback (canplay event)          ║
 * ║    MSG_VIDEO_CUE_ENTER  — a cue was entered; extended: { startTime, endTime, text }  ║
 * ║    MSG_VIDEO_CUE_LEAVE  — a cue was exited;  extended: { startTime, endTime, text }  ║
 * ║    MSG_VIDEO_ERROR      — playback error; wParam = error code                        ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaVideo.play(pacId)                              — start playback               ║
 * ║    WakaVideo.pause(pacId)                             — pause playback               ║
 * ║    WakaVideo.seek(pacId, time)                        — seek to time in seconds      ║
 * ║    WakaVideo.setVolume(pacId, volume)                 — set volume (0.0–1.0)         ║
 * ║    WakaVideo.setMuted(pacId, muted)                   — set muted state              ║
 * ║    WakaVideo.setPlaybackRate(pacId, rate)             — set playback rate            ║
 * ║    WakaVideo.bitBlt(dc, pacId)                        — copy full frame into DC      ║
 * ║    WakaVideo.stretchBlt(dc, pacId, dx,dy,dw,dh)      — copy full frame into rect     ║
 * ║    WakaVideo.addCue(pacId, startTime, endTime, text)  — add a programmatic cue       ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    currentTime   — updated via rAF during playback (timeupdate fallback in hidden    ║
 * ║                    tabs); also on seek                                               ║
 * ║    duration     — set when MSG_VIDEO_LOADED fires                                    ║
 * ║    videoWidth   — set when MSG_VIDEO_LOADED fires                                    ║
 * ║    videoHeight  — set when MSG_VIDEO_LOADED fires                                    ║
 * ║    volume        — mirrors video.volume; updated on MSG_VIDEO_VOLUME_CHANGE          ║
 * ║    muted         — mirrors video.muted;  updated on MSG_VIDEO_VOLUME_CHANGE          ║
 * ║    playbackRate  — mirrors video.playbackRate; updated on MSG_VIDEO_RATE_CHANGE      ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // Message type constants — placed in the user message range (MSG_USER+)
    // to avoid collisions with core WakaPAC messages.
    // =========================================================================

    const MSG_VIDEO_PLAY = 0x1100;
    const MSG_VIDEO_PAUSE = 0x1101;
    const MSG_VIDEO_ENDED = 0x1102;
    const MSG_VIDEO_SEEK = 0x1103;
    const MSG_VIDEO_LOADED = 0x1104;
    const MSG_VIDEO_CUE_ENTER = 0x1105;
    const MSG_VIDEO_CUE_LEAVE = 0x1106;
    const MSG_VIDEO_ERROR = 0x1107;
    const MSG_VIDEO_VOLUME_CHANGE = 0x1108;
    const MSG_VIDEO_RATE_CHANGE = 0x1109;
    const MSG_VIDEO_WAITING = 0x110A;
    const MSG_VIDEO_CANPLAY = 0x110B;

    /**
     * Registry of active video components keyed by pacId.
     * Each entry holds the HTMLVideoElement, its cue track, the previous active
     * cue set for enter/leave diffing, and the rAF handle.
     * @type {Map<string, { video: HTMLVideoElement, cueTrack: TextTrack|null, activeCues: Set<string>, rafHandle: number|null }>}
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
     * @param {string} pacId
     * @returns {HTMLVideoElement|null}
     */
    function getVideo(pacId) {
        return _registry.get(pacId)?.video ?? null;
    }

    /**
     * Returns a stable string key for a VTTCue, used to diff active cue sets.
     * @param {VTTCue} cue
     * @returns {string}
     */
    function cueKey(cue) {
        return `${cue.startTime}:${cue.endTime}:${cue.text}`;
    }

    /**
     * Advances currentTime on the abstraction once per animation frame while
     * the video is playing. Self-terminates when the video is paused or ended.
     * @param {HTMLVideoElement} video
     * @param {Object} abstraction
     * @param {Object} entry
     */
    function rafTick(video, abstraction, entry) {
        if (video.paused || video.ended) {
            entry.rafHandle = null;
            return;
        }

        const t = video.currentTime;

        if (abstraction.currentTime !== t) {
            abstraction.currentTime = t;
        }

        entry.rafHandle = requestAnimationFrame(() => rafTick(video, abstraction, entry));
    }

    /**
     * Starts the rAF loop for the given entry. No-op if already running.
     * @param {HTMLVideoElement} video
     * @param {Object} abstraction
     * @param {Object} entry
     */
    function startRaf(video, abstraction, entry) {
        if (entry.rafHandle !== null) {
            return;
        }

        entry.rafHandle = requestAnimationFrame(() => rafTick(video, abstraction, entry));
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
     * Diffs the current active cue set against the previous one and dispatches
     * MSG_VIDEO_CUE_ENTER / MSG_VIDEO_CUE_LEAVE for each cue that entered or left.
     * @param {string} pacId
     * @param {Object} entry
     */
    function onCueChange(pacId, entry) {
        const currentKeys = new Set(
            Array.from(entry.cueTrack.activeCues ?? []).map(cueKey)
        );

        // Cues in current but not in previous → entered
        for (const cue of entry.cueTrack.activeCues ?? []) {
            if (!entry.activeCues.has(cueKey(cue))) {
                window.wakaPAC.sendMessage(pacId, MSG_VIDEO_CUE_ENTER, 0, 0, {
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    text: cue.text
                });
            }
        }

        // Cues in previous but not in current → left
        for (const key of entry.activeCues) {
            if (!currentKeys.has(key)) {
                // Reconstruct the cue data from the key since the cue
                // is no longer in activeCues at this point
                const [st, et, ...textParts] = key.split(':');

                window.wakaPAC.sendMessage(pacId, MSG_VIDEO_CUE_LEAVE, 0, 0, {
                    startTime: Number(st),
                    endTime: Number(et),
                    text: textParts.join(':')
                });
            }
        }

        entry.activeCues = currentKeys;
    }

    window.WakaVideo = {

        createPacPlugin(pac, _options = {}) {

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Checks whether the container is a <video> element; if so,
                 * registers it and wires up the event → message bridge.
                 *
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} config      - Component config
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const container = pac.getContainerByPacId(pacId);

                    // Only activate for <video> containers
                    if (!container || !(container instanceof HTMLVideoElement)) {
                        return;
                    }

                    const video = container;
                    const entry = {video, cueTrack: null, activeCues: new Set(), rafHandle: null};

                    _registry.set(pacId, entry);

                    abstraction.currentTime = null;
                    abstraction.duration = NaN;
                    abstraction.videoWidth = null;
                    abstraction.videoHeight = null;
                    abstraction.volume = video.volume;
                    abstraction.muted = video.muted;
                    abstraction.playbackRate = video.playbackRate;

                    function onPlay() {
                        startRaf(video, abstraction, entry);
                        pac.sendMessage(pacId, MSG_VIDEO_PLAY, 0, 0);
                    }

                    function onPause() {
                        stopRaf(entry);
                        abstraction.currentTime = video.currentTime;
                        pac.sendMessage(pacId, MSG_VIDEO_PAUSE, 0, 0);
                    }

                    function onEnded() {
                        stopRaf(entry);
                        abstraction.currentTime = video.currentTime;
                        pac.sendMessage(pacId, MSG_VIDEO_ENDED, 0, 0);
                    }

                    function onSeeked() {
                        abstraction.currentTime = video.currentTime;
                        pac.sendMessage(pacId, MSG_VIDEO_SEEK, 0, 0, {
                            currentTime: video.currentTime
                        });
                    }

                    function onLoadedMetadata() {
                        abstraction.duration = video.duration;
                        abstraction.videoWidth = video.videoWidth;
                        abstraction.videoHeight = video.videoHeight;
                        abstraction.volume = video.volume;
                        abstraction.muted = video.muted;
                        abstraction.playbackRate = video.playbackRate;

                        pac.sendMessage(pacId, MSG_VIDEO_LOADED, 0, 0, {
                            duration: video.duration,
                            videoWidth: video.videoWidth,
                            videoHeight: video.videoHeight,
                            volume: video.volume,
                            muted: video.muted,
                            playbackRate: video.playbackRate
                        });
                    }

                    function onVolumeChange() {
                        abstraction.volume = video.volume;
                        abstraction.muted = video.muted;
                        pac.sendMessage(pacId, MSG_VIDEO_VOLUME_CHANGE, 0, 0, {
                            volume: video.volume,
                            muted: video.muted
                        });
                    }

                    function onRateChange() {
                        abstraction.playbackRate = video.playbackRate;
                        pac.sendMessage(pacId, MSG_VIDEO_RATE_CHANGE, 0, 0, {
                            playbackRate: video.playbackRate
                        });
                    }

                    function onWaiting() {
                        pac.sendMessage(pacId, MSG_VIDEO_WAITING, 0, 0);
                    }

                    function onCanPlay() {
                        pac.sendMessage(pacId, MSG_VIDEO_CANPLAY, 0, 0);
                    }

                    /**
                     * Fallback for background tabs where rAF is suspended.
                     * timeupdate fires at ~4 Hz regardless of tab visibility.
                     * Only writes currentTime when rAF is not already doing so,
                     * to avoid redundant updates in the common visible-tab case.
                     */
                    function onTimeUpdate() {
                        if (entry.rafHandle === null) {
                            abstraction.currentTime = video.currentTime;
                        }
                    }

                    function onError() {
                        const code = video.error?.code ?? 0;
                        pac.sendMessage(pacId, MSG_VIDEO_ERROR, code, 0, {
                            message: video.error?.message ?? ''
                        });
                    }

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
                 *
                 * @param {Object} abstraction
                 * @param {string} pacId
                 */
                onComponentDestroyed(abstraction, pacId) {
                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    stopRaf(entry);

                    const listeners = _listeners.get(entry.video);

                    if (listeners) {
                        for (const [event, fn] of Object.entries(listeners)) {
                            entry.video.removeEventListener(event, fn);
                        }

                        _listeners.delete(entry.video);
                    }

                    _registry.delete(pacId);
                }
            };
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Start playback.
         * Returns the Promise from video.play() so the caller can catch autoplay rejections.
         * @param {string} pacId
         * @returns {Promise|undefined}
         */
        play(pacId) {
            return getVideo(pacId)?.play();
        },

        /**
         * Pause playback.
         * @param {string} pacId
         */
        pause(pacId) {
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
                video.currentTime = time;
            }
        },

        /**
         * Set the volume level.
         * MSG_VIDEO_VOLUME_CHANGE fires after the change.
         * @param {string} pacId
         * @param {number} volume - Value between 0.0 (silent) and 1.0 (full)
         */
        setVolume(pacId, volume) {
            const video = getVideo(pacId);

            if (video) {
                video.volume = Math.max(0, Math.min(1, volume));
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
         * @param {string} text      - Cue payload (free-form string or JSON)
         */
        addCue(pacId, startTime, endTime, text) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            if (!entry.cueTrack) {
                entry.cueTrack = entry.video.addTextTrack('metadata', 'waka-cues', 'zxx');
                entry.cueTrack.mode = 'hidden';
                entry.cueTrack.addEventListener('cuechange', () => onCueChange(pacId, entry));
            }

            entry.cueTrack.addCue(new VTTCue(startTime, endTime, text));
        },

        MSG_VIDEO_PLAY,
        MSG_VIDEO_PAUSE,
        MSG_VIDEO_ENDED,
        MSG_VIDEO_SEEK,
        MSG_VIDEO_LOADED,
        MSG_VIDEO_VOLUME_CHANGE,
        MSG_VIDEO_RATE_CHANGE,
        MSG_VIDEO_WAITING,
        MSG_VIDEO_CANPLAY,
        MSG_VIDEO_CUE_ENTER,
        MSG_VIDEO_CUE_LEAVE,
        MSG_VIDEO_ERROR
    };

})();