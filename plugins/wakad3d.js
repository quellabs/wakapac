/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗ ██████╗ ██████╗ ██████╗ ██████╗           ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗╚════██╗██╔══██╗╚════██╗██╔══██╗          ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║  ██║ █████╔╝██║  ██║ █████╔╝██║  ██║          ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║  ██║ ╚═══██╗██║  ██║ ╚═══██╗██║  ██║          ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝██████╔╝██████╔╝██████╔╝██████╔╝          ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚═════╝           ║
 * ║                                                                                      ║
 * ║  WakaD3D — WebGL/WebGL2 canvas-lifecycle plugin for wakaPAC                          ║
 * ║                                                                                      ║
 * ║  This plugin wires up context-loss/restore handling, drives the per-canvas render    ║
 * ║  loop, dispatches the one-time "ready" message once a canvas has its first layout,   ║
 * ║  and registers a blit handler so wakaPAC.bitBlt()/stretchBlt() know how to copy      ║
 * ║  pixels into a WebGL destination. getDC(), createCompatibleDC() are already generic  ║
 * ║  in core and need no help from this plugin. requestRender() lives here instead of    ║
 * ║  core, since triggering an on-demand redraw is this plugin's job, same as the render ║
 * ║  loop.                                                                               ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(wakaD3D);                                                             ║
 * ║                                                                                      ║
 * ║  Mark a canvas as WebGL in markup, same as before:                                   ║
 * ║    <canvas data-pac-id="scene" data-pac-context="webgl2"></canvas>                   ║
 * ║                                                                                      ║
 * ║  Opt into a continuous requestAnimationFrame render loop via config:                 ║
 * ║    wakaPAC('#scene', { ... }, { renderLoop: true });                                 ║
 * ║  Or drive rendering on demand instead (no config needed):                            ║
 * ║    wakaD3D.requestRender(this.pacId);                                                ║
 * ║                                                                                      ║
 * ║  Messages fired into the component's msgProc(), same numeric values as before:       ║
 * ║    wakaD3D.MSG_WEBGL_READY             — canvas laid out, gl context is valid;       ║
 * ║                                          event.detail.glContext is provided so       ║
 * ║                                          the handler can set up shaders/buffers      ║
 * ║                                          without a separate getDC() call             ║
 * ║    wakaD3D.MSG_WEBGL_CONTEXT_LOST       — discard all GL resource handles now        ║
 * ║    wakaD3D.MSG_WEBGL_CONTEXT_RESTORED   — a fresh context exists; recreate           ║
 * ║                                          everything. event.detail.glContext is       ║
 * ║                                          provided                                    ║
 * ║  (These are also attached to wakaPAC itself — e.g. wakaPAC.MSG_WEBGL_READY — for     ║
 * ║  code that was written against the old, core-provided constants.)                    ║
 * ║                                                                                      ║
 * ║  Texture blitting — once this plugin is registered, the existing core APIs just      ║
 * ║  work with a WebGL destination:                                                      ║
 * ║    gl.bindTexture(gl.TEXTURE_2D, myTexture);                                         ║
 * ║    wakaPAC.bitBlt(glDestDC, someSrcDC, 0, 0);                                        ║
 * ║    // uploads someSrcDC's canvas via texImage2D onto the currently bound texture     ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    const VERSION = '1.0.0';

    // =========================================================================
    // MESSAGE CONSTANTS
    // =========================================================================
    // Same numeric values as when these lived in wakapac.js core, so any code
    // (or serialized state) that hardcoded the numbers keeps working.

    const MSG_WEBGL_READY = 0x0401;
    const MSG_WEBGL_CONTEXT_LOST = 0x0402;
    const MSG_WEBGL_CONTEXT_RESTORED = 0x0403;

    // Single source of truth for the constants that get attached to both the
    // pac instance and the WakaD3D constructor/singleton below, so there's
    // only one place that lists them.
    const MESSAGE_CONSTANTS = {
        MSG_WEBGL_READY,
        MSG_WEBGL_CONTEXT_LOST,
        MSG_WEBGL_CONTEXT_RESTORED
    };

    // DOM event name wakaPAC dispatches PAC messages as on a container. Not
    // part of wakaPAC's public API — this plugin listens for it directly to
    // detect a canvas's first MSG_SIZE (see _armReadySignal below). If core
    // ever renames this event, this is the one place to update.
    const PAC_EVENT = 'pac:event';

    // =========================================================================
    // WEBGL CONTEXT TEST / BLIT
    // =========================================================================

    /**
     * Returns true if ctx is a WebGL or WebGL2 context. Used both to decide
     * whether a canvas is ours to manage and as the test() predicate registered
     * with wakaPAC.registerBlitHandler().
     * @param {RenderingContext} ctx
     * @returns {boolean}
     */
    function _isWebGLContext(ctx) {
        return ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext;
    }

    /**
     * Copies a source canvas onto a WebGL destination as a texture bound to
     * the currently active texture unit. The caller is responsible for binding
     * the target texture before calling bitBlt()/stretchBlt() with a WebGL
     * destination — this function assumes that has already been done.
     * rect (the requested sub-region/scale, present since core's blit handler
     * contract now always passes one) is intentionally unused: texImage2D
     * uploads the whole srcCanvas as a texture, so partial or scaled blits
     * aren't meaningful here the way they are for a 2D destination.
     * @param {WebGLRenderingContext|WebGL2RenderingContext} destGL
     * @param {HTMLCanvasElement} srcCanvas
     * @param {{sx:number, sy:number, sw:number, sh:number, dx:number, dy:number, dw:number, dh:number}} rect
     */
    function _blitToWebGL(destGL, srcCanvas, rect) {
        destGL.texImage2D(
            destGL.TEXTURE_2D,
            0,                  // mip level
            destGL.RGBA,        // internal format
            destGL.RGBA,        // format
            destGL.UNSIGNED_BYTE,
            srcCanvas
        );
    }

    // =========================================================================
    // PER-CANVAS STATE
    // =========================================================================

    /**
     * One entry per WebGL canvas component this plugin is managing.
     *
     * tick is the render-loop callback for this canvas, created once (see
     * _createTick) rather than recreated on every _startLoop()/resume cycle.
     * The entry doesn't need to carry a pac reference — helpers use the
     * wakaPAC global directly (see _createTick's doc comment for why that's
     * safe).
     *
     * loopHandle semantics (mirrors the old core RenderLoopEngine):
     *   undefined — no render loop running (never started, or stopped for good)
     *   null      — paused (context lost); resume() can tell this apart from "never started"
     *   number    — active requestAnimationFrame handle
     *
     * @type {Map<string, {
     *   container: HTMLCanvasElement,
     *   boundLost: function(WebGLContextEvent): void,
     *   boundRestored: function(WebGLContextEvent): void,
     *   onFirstSize: function(CustomEvent): void,
     *   ready: boolean,
     *   loopHandle: number|null|undefined,
     *   tick: function(): void,
     *   renderRequested: boolean
     * }>}
     */
    const _canvases = new Map();

    // =========================================================================
    // RENDER LOOP
    // =========================================================================
    // Drives MSG_RENDER dispatch via requestAnimationFrame, one rAF handle per
    // canvas since each renders independently. MSG_RENDER is withheld until the
    // canvas has flagged `ready` (see _armReadySignal below), since shaders/GL
    // resources are not set up before that point.

    /**
     * Builds the render-loop callback for a canvas. Created once per canvas
     * (see onComponentCreated) and reused across every _startLoop() call —
     * including pause/resume cycles — instead of being recreated each time.
     * Uses the wakaPAC global directly: wakaPAC is a singleton function
     * declared once in wakapac.js (no constructor exists to create a second
     * one), and createPacPlugin(wakaPAC, options) always passes that exact
     * object — so pac and wakaPAC are always the same reference.
     * @param {string} pacId
     * @returns {function(): void}
     */
    function _createTick(pacId) {
        return () => {
            const e = _canvases.get(pacId);

            // Stopped for good (component destroyed) — do not reschedule.
            if (!e || e.loopHandle === undefined) {
                return;
            }

            if (e.ready) {
                wakaPAC.sendMessage(pacId, wakaPAC.MSG_RENDER, 0, 0);
            }

            e.loopHandle = requestAnimationFrame(e.tick);
        };
    }

    /**
     * @param {string} pacId
     * @returns {void}
     */
    function _startLoop(pacId) {
        const entry = _canvases.get(pacId);

        if (!entry) {
            return;
        }

        entry.loopHandle = requestAnimationFrame(entry.tick);
    }

    /**
     * Stops a canvas's render loop entirely. Safe to call even if no loop is running.
     * @param {string} pacId
     * @returns {void}
     */
    function _stopLoop(pacId) {
        const entry = _canvases.get(pacId);

        if (entry && typeof entry.loopHandle === 'number') {
            cancelAnimationFrame(entry.loopHandle);
        }

        if (entry) {
            entry.loopHandle = undefined;
        }
    }

    /**
     * Pauses a canvas's render loop without forgetting it, so it can later be
     * resumed via _resumeLoop(). Used while a WebGL context is lost —
     * dispatching MSG_RENDER to a lost context produces GL errors.
     * @param {string} pacId
     * @returns {void}
     */
    function _pauseLoop(pacId) {
        const entry = _canvases.get(pacId);

        if (entry && typeof entry.loopHandle === 'number') {
            cancelAnimationFrame(entry.loopHandle);
            entry.loopHandle = null;
        }
    }

    /**
     * Resumes a canvas's render loop if it was paused via _pauseLoop(). No-op
     * if the loop was never started or was fully stopped (component destroyed).
     * @param {string} pacId
     * @returns {void}
     */
    function _resumeLoop(pacId) {
        const entry = _canvases.get(pacId);

        if (entry && entry.loopHandle === null) {
            _startLoop(pacId);
        }
    }

    /**
     * Schedules a single MSG_RENDER for a canvas on the next animation frame.
     * The on-demand counterpart to renderLoop: true — use this for a canvas
     * that only needs to redraw in response to data changes or interaction,
     * not continuously.
     *
     * Safe to call multiple times before the next frame — only one MSG_RENDER
     * will fire, via the entry's own renderRequested flag rather than relying
     * on requestAnimationFrame to deduplicate (it doesn't; separate calls
     * schedule separate callbacks).
     *
     * Withheld until the canvas has fired MSG_WEBGL_READY, same as the
     * continuous render loop — there is no context to render into before that.
     *
     * No-op (with a console warning) if pacId is not a canvas this plugin manages.
     * @param {string} pacId
     * @returns {void}
     */
    function _requestRender(pacId) {
        const entry = _canvases.get(pacId);

        if (!entry) {
            console.warn(`wakaD3D.requestRender: "${pacId}" is not a WakaD3D-managed canvas.`);
            return;
        }

        if (entry.renderRequested) {
            return;
        }

        entry.renderRequested = true;

        requestAnimationFrame(() => {
            const e = _canvases.get(pacId);

            // Guard: component may have been destroyed before the frame fired
            if (!e) {
                return;
            }

            e.renderRequested = false;

            if (e.ready) {
                wakaPAC.sendMessage(pacId, wakaPAC.MSG_RENDER, 0, 0);
            }
        });
    }

    // =========================================================================
    // READY SIGNAL
    // =========================================================================

    /**
     * Listens for this canvas's first MSG_SIZE (dispatched once layout has
     * happened) and fires MSG_WEBGL_READY exactly once. At that point getDC()
     * returns a valid context — safe to compile shaders, upload geometry, etc.
     * @param {string} pacId
     * @param {HTMLCanvasElement} container
     * @returns {void}
     */
    function _armReadySignal(pacId, container) {
        const entry = _canvases.get(pacId);

        // Defensive: onComponentCreated always inserts the entry before
        // calling this, but don't assume that ordering holds forever.
        if (!entry) {
            return;
        }

        const onFirstSize = (event) => {
            if (event.message !== wakaPAC.MSG_SIZE) {
                return;
            }

            container.removeEventListener(PAC_EVENT, onFirstSize);
            entry.ready = true;

            wakaPAC.sendMessage(pacId, MSG_WEBGL_READY, 0, 0, {
                // Provide the GL context directly on the event so components
                // can set up shaders in the handler without a separate getDC() call.
                glContext: wakaPAC.getDC(pacId)
            });
        };

        container.addEventListener(PAC_EVENT, onFirstSize);
        entry.onFirstSize = onFirstSize;
    }

    // =========================================================================
    // CONTEXT LOSS / RESTORE
    // =========================================================================

    /**
     * @param {string} pacId
     * @param {WebGLContextEvent} e
     * @returns {void}
     */
    function _handleContextLost(pacId, e) {
        const entry = _canvases.get(pacId);

        if (!entry) {
            return;
        }

        // Calling preventDefault() is required — without it the browser will
        // not attempt to restore the context after it is lost.
        e.preventDefault();

        // Pause the render loop while the context is unavailable. Dispatching
        // paint messages to a lost context produces GL errors.
        _pauseLoop(pacId);

        // Notify the component so it can discard all WebGL resource handles.
        // Buffers, textures, framebuffers, programs, etc. become invalid after
        // a context loss and must be recreated after restoration.
        wakaPAC.sendMessage(pacId, MSG_WEBGL_CONTEXT_LOST, 0, 0);
    }

    /**
     * @param {string} pacId
     * @param {WebGLContextEvent} e
     * @returns {void}
     */
    function _handleContextRestored(pacId, e) {
        const entry = _canvases.get(pacId);

        if (!entry) {
            return;
        }

        // The browser has created a brand-new WebGL context. All GPU resources
        // must be recreated before rendering can continue.
        wakaPAC.sendMessage(pacId, MSG_WEBGL_CONTEXT_RESTORED, 0, 0, {
            glContext: wakaPAC.getDC(pacId)
        });

        // Resume rendering if the component was previously running a render loop.
        _resumeLoop(pacId);
    }

    // =========================================================================
    // PLUGIN SETUP HELPERS
    // =========================================================================
    // Split out of createPacPlugin() below so that registration, constant
    // attachment, and lifecycle-hook wiring can each be read (and changed)
    // independently as the plugin grows.

    /**
     * Registers this plugin's WebGL blit handler with the pac instance so
     * bitBlt()/stretchBlt() can target a WebGL destination.
     * @param {Object} pac
     * @returns {void}
     */
    function _registerBlitHandler(pac) {
        pac.registerBlitHandler({
            test: _isWebGLContext,
            blit: _blitToWebGL
        });
    }

    /**
     * Attaches the MSG_WEBGL_* constants onto the pac instance for callers
     * written against the old, core-provided constants.
     * @param {Object} pac
     * @returns {void}
     */
    function _registerConstants(pac) {
        Object.assign(pac, MESSAGE_CONSTANTS);
    }

    /**
     * Builds the onComponentCreated/onComponentDestroyed hooks.
     * @returns {{
     *   onComponentCreated: function(Object, string, Object): void,
     *   onComponentDestroyed: function(string): void
     * }}
     */
    function _createLifecycleHooks() {
        return {
            /**
             * Fires for every new wakaPAC component, canvas or not. Only
             * canvases with data-pac-context="webgl"/"webgl2" are ours —
             * everything else is ignored.
             * @param {Object} abstraction
             * @param {string} pacId
             * @param {Object} config
             */
            onComponentCreated(abstraction, pacId, config) {
                const container = wakaPAC.getContainerByPacId(pacId);

                if (!(container instanceof HTMLCanvasElement)) {
                    return;
                }

                const contextType = container.dataset.pacContext;

                if (contextType !== 'webgl' && contextType !== 'webgl2') {
                    return;
                }

                const boundLost = (e) => _handleContextLost(pacId, e);
                const boundRestored = (e) => _handleContextRestored(pacId, e);

                container.addEventListener('webglcontextlost', boundLost);
                container.addEventListener('webglcontextrestored', boundRestored);

                const entry = {
                    container,
                    boundLost,
                    boundRestored,
                    onFirstSize: null,
                    ready: false,
                    loopHandle: undefined,
                    tick: null,
                    renderRequested: false
                };

                entry.tick = _createTick(pacId);
                _canvases.set(pacId, entry);

                _armReadySignal(pacId, container);

                if (config.renderLoop === true) {
                    _startLoop(pacId);
                }
            },

            /**
             * Fires for every destroyed wakaPAC component, canvas or not.
             * No-op for components this plugin was never managing.
             * @param {string} pacId
             */
            onComponentDestroyed(pacId) {
                const entry = _canvases.get(pacId);

                if (!entry) {
                    return;
                }

                _stopLoop(pacId);

                entry.container.removeEventListener('webglcontextlost', entry.boundLost);
                entry.container.removeEventListener('webglcontextrestored', entry.boundRestored);

                if (entry.onFirstSize) {
                    entry.container.removeEventListener(PAC_EVENT, entry.onFirstSize);
                }

                _canvases.delete(pacId);
            }
        };
    }

    // =========================================================================
    // WAKAD3D
    // =========================================================================

    function WakaD3D() {
    }

    WakaD3D.prototype = {
        constructor: WakaD3D,

        /**
         * Called by wakaPAC.use(wakaD3D). Registers the blit handler that lets
         * bitBlt()/stretchBlt() target a WebGL destination, and attaches the
         * MSG_WEBGL_* constants back onto wakaPAC for callers written against
         * the old core-provided constants.
         * @param {Object} pac
         * @returns {{
         *   name: string,
         *   onComponentCreated: function(Object, string, Object): void,
         *   onComponentDestroyed: function(string): void
         * }}
         */
        createPacPlugin(pac) {
            _registerBlitHandler(pac);
            _registerConstants(pac);

            return {
                name: 'WakaD3D',
                ..._createLifecycleHooks()
            };
        },

        /**
         * Schedules a single MSG_RENDER for a WakaD3D-managed canvas on the
         * next animation frame. See _requestRender() for full behavior.
         * @param {string} pacId
         * @returns {void}
         */
        requestRender(pacId) {
            _requestRender(pacId);
        }
    };

    WakaD3D.VERSION = VERSION;
    Object.assign(WakaD3D, MESSAGE_CONSTANTS);

    const wakaD3D = new WakaD3D();

    Object.assign(wakaD3D, MESSAGE_CONSTANTS);

    window.WakaD3D = WakaD3D;
    window.wakaD3D = wakaD3D;

})();