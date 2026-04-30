/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██╗     ██╗ ██████╗ ██╗  ██╗████████╗             ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██║     ██║██╔════╝ ██║  ██║╚══██╔══╝             ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║     ██║██║  ███╗███████║   ██║                ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║     ██║██║   ██║██╔══██║   ██║                ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║███████╗██║╚██████╔╝██║  ██║   ██║                ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝                ║
 * ║                                                                                      ║
 * ║   ██████╗  █████╗ ██╗     ██╗     ███████╗██████╗ ██╗   ██╗                          ║
 * ║  ██╔════╝ ██╔══██╗██║     ██║     ██╔════╝██╔══██╗╚██╗ ██╔╝                          ║
 * ║  ██║  ███╗███████║██║     ██║     █████╗  ██████╔╝ ╚████╔╝                           ║
 * ║  ██║   ██║██╔══██║██║     ██║     ██╔══╝  ██╔══██╗  ╚██╔╝                            ║
 * ║  ╚██████╔╝██║  ██║███████╗███████╗███████╗██║  ██║   ██║                             ║
 * ║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝   ╚═╝                             ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaLightGallery                                                   ║
 * ║                                                                                      ║
 * ║  Wraps lightGallery v2 instances inside PAC containers.                              ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <waka-lightgallery> element.       ║
 * ║  The lightGallery CSS and JS are injected automatically on first use and shared      ║
 * ║  across all instances. Components created before the script has loaded are queued    ║
 * ║  and initialized once the API is available.                                          ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaLightGallery);                         // CDN defaults            ║
 * ║    wakaPAC.use(WakaLightGallery, {                        // custom options          ║
 * ║      src:    '/path/to/lightgallery.umd.min.js',                                     ║
 * ║      cssSrc: '/path/to/lightgallery.min.css',                                        ║
 * ║      plugins: [lgZoom, lgThumbnail]   // pre-loaded plugin objects                   ║
 * ║    });                                                                               ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <waka-lightgallery data-pac-id="gallery1">                                        ║
 * ║      <a href="img/photo1.jpg"><img src="img/thumb1.jpg" /></a>                       ║
 * ║      <a href="img/photo2.jpg"><img src="img/thumb2.jpg" /></a>                       ║
 * ║    </waka-lightgallery>                                                              ║
 * ║                                                                                      ║
 * ║  Per-instance lightGallery config can be passed as the third argument to wakaPAC()   ║
 * ║  under the 'lightgallery' key:                                                       ║
 * ║    wakaPAC('gallery1', { msgProc }, { lightgallery: { speed: 500, zoom: true } })    ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_GALLERY_READY   — lightGallery is fully initialized                           ║
 * ║    MSG_GALLERY_ERROR   — script or CSS failed to load; extended.message              ║
 * ║    MSG_BEFORE_OPEN     — gallery is about to open                                    ║
 * ║    MSG_AFTER_OPEN      — gallery has opened                                          ║
 * ║    MSG_BEFORE_CLOSE    — gallery is about to close                                   ║
 * ║    MSG_AFTER_CLOSE     — gallery has closed                                          ║
 * ║    MSG_BEFORE_SLIDE    — slide transition is about to happen;                        ║
 * ║                          extended.index, extended.prevIndex                          ║
 * ║    MSG_AFTER_SLIDE     — slide transition is complete;                               ║
 * ║                          extended.index, extended.prevIndex                          ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    currentIndex  — current slide index (0-based), kept current on every slide        ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaLightGallery.openGallery(pacId, index)  — open at given index (default 0)     ║
 * ║    WakaLightGallery.closeGallery(pacId)        — close the gallery                   ║
 * ║    WakaLightGallery.slide(pacId, index)        — jump to slide index                 ║
 * ║    WakaLightGallery.refresh(pacId)             — refresh after DOM change            ║
 * ║    WakaLightGallery.destroy(pacId)             — destroy instance                    ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    // =========================================================================
    // lightGallery v2 CDN assets
    // =========================================================================
    // lightGallery v2 ships as a UMD bundle plus a CSS file. Both are required.
    // The library exposes a single global function: window.lightGallery(el, opts).
    // =========================================================================

    const LG_CDN = {
        js: 'https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.8.3/lightgallery.umd.min.js',
        css: 'https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.8.3/css/lightgallery.min.css'
    };

    /**
     * True once window.lightGallery is available.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * True once the CSS <link> has been injected (one-shot guard).
     * @type {boolean}
     */
    let _cssInjected = false;

    /**
     * Track whether a JS load is already in flight so we never double-inject.
     * @type {boolean}
     */
    let _scriptInjecting = false;

    /**
     * Resolved JS URL — may be overridden by options.src.
     * @type {string}
     */
    let _scriptSrc = LG_CDN.js;

    /**
     * Resolved CSS URL — may be overridden by options.cssSrc.
     * @type {string}
     */
    let _cssSrc = LG_CDN.css;

    // =========================================================================
    // Registry
    // =========================================================================

    /**
     * Registry of active lightGallery component instances keyed by pacId.
     *
     * @type {Map<string, {
     *   pac:         Object,
     *   instance:    Object,
     *   abstraction: Object
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // Script + CSS bootstrap
    // =========================================================================

    /**
     * Injects the lightGallery CSS <link> once.
     * Idempotent — safe to call multiple times.
     */
    function ensureCssLoaded() {
        if (_cssInjected) {
            return;
        }

        // Don't inject if a matching <link> already exists on the page.
        if (document.querySelector('link[data-waka-lightgallery-css]')) {
            _cssInjected = true;
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = _cssSrc;
        link.setAttribute('data-waka-lightgallery-css', '');
        (document.head ?? document.body).appendChild(link);
        _cssInjected = true;
    }

    /**
     * Injects the lightGallery JS <script> once and drains the pending queue
     * once it loads. Safe to call multiple times — only injects once.
     * If window.lightGallery already exists, drains immediately.
     * @param {Function} drainFn - The drainPendingInits closure from createPacPlugin.
     * @param {Array}    queue   - The _pendingInits array from createPacPlugin.
     */
    function ensureApiLoaded(drainFn, queue) {
        // Already available on the page (externally loaded or previously injected).
        if (window.lightGallery) {
            _apiReady = true;
            drainFn();
            return;
        }

        // Script tag already injected; the load handler will drain the queue.
        if (_scriptInjecting || document.getElementById('waka-lightgallery-script')) {
            return;
        }

        _scriptInjecting = true;

        const tag = document.createElement('script');
        tag.id = 'waka-lightgallery-script';
        tag.src = _scriptSrc;

        tag.onload = function() {
            _apiReady = true;
            drainFn();
        };

        tag.onerror = function() {
            for (const pending of queue) {
                pending.pac.sendMessage(
                    pending.pacId,
                    pending.MSG_GALLERY_ERROR,
                    0, 0,
                    { message: 'lightGallery script failed to load from: ' + _scriptSrc }
                );
            }

            queue.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaLightGallery = {

        /**
         * Called on plugin initialization through wakaPAC.use().
         * @param {Object} pac
         * @param {Object} [options={}]
         * @returns {{ onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void }}
         */
        createPacPlugin(pac, options = {}) {

            // Allow the host page to supply its own builds or self-hosted copies.
            if (options.src) {
                _scriptSrc = options.src;
            }

            if (options.cssSrc) {
                _cssSrc = options.cssSrc;
            }

            // Plugin-level lightGallery defaults, overridable per-instance
            // via the 'lightgallery' key in the component config object.
            //
            // 'plugins' is an array of pre-loaded lgPlugin objects (e.g. lgZoom,
            // lgThumbnail). The host page must load those plugin scripts separately
            // before or alongside this plugin since we can't know which are wanted.
            const _defaultGalleryConfig = {
                speed: 400,
                plugins: options.plugins ?? []
            };

            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_GALLERY_READY = pac.MSG_PLUGIN + 0x300;
            const MSG_GALLERY_ERROR = pac.MSG_PLUGIN + 0x301;
            const MSG_BEFORE_OPEN = pac.MSG_PLUGIN + 0x302;
            const MSG_AFTER_OPEN = pac.MSG_PLUGIN + 0x303;
            const MSG_BEFORE_CLOSE = pac.MSG_PLUGIN + 0x304;
            const MSG_AFTER_CLOSE = pac.MSG_PLUGIN + 0x305;
            const MSG_BEFORE_SLIDE = pac.MSG_PLUGIN + 0x306;
            const MSG_AFTER_SLIDE = pac.MSG_PLUGIN + 0x307;

            // Expose constants so components can reference them as
            // WakaLightGallery.MSG_GALLERY_READY etc.
            Object.assign(this, {
                MSG_GALLERY_READY,
                MSG_GALLERY_ERROR,
                MSG_BEFORE_OPEN,
                MSG_AFTER_OPEN,
                MSG_BEFORE_CLOSE,
                MSG_AFTER_CLOSE,
                MSG_BEFORE_SLIDE,
                MSG_AFTER_SLIDE
            });

            // =====================================================================
            // Pending init queue
            // =====================================================================
            // Components created before the lightGallery script has finished loading
            // are queued here and drained once the script is ready.
            // =====================================================================

            /**
             * @type {Array<{ abstraction: Object, pacId: string, pac: Object, galleryConfig: Object, MSG_GALLERY_ERROR: number }>}
             */
            const _pendingInits = [];

            // =====================================================================
            // Gallery construction
            // =====================================================================

            /**
             * Instantiates a lightGallery v2 instance on the container element and
             * registers it. Called immediately when the API is available, or deferred
             * via _pendingInits while the script is still loading.
             *
             * @param {Object} abstraction
             * @param {string} pacId
             * @param {Object} galleryConfig - Merged plugin-level and per-instance config
             */
            function createGallery(abstraction, pacId, galleryConfig) {
                const container = pac.getContainerByPacId(pacId);

                if (!container) {
                    return;
                }

                // -----------------------------------------------------------------
                // Attach DOM event listeners BEFORE calling lightGallery() so that
                // lgInit (fired synchronously during init) is not missed.
                // -----------------------------------------------------------------

                container.addEventListener('lgInit', function(event) {
                    _registry.set(pacId, {
                        pac,
                        instance:    event.detail.instance,
                        abstraction
                    });

                    // Inject reactive property on the abstraction.
                    abstraction.currentIndex = 0;

                    pac.sendMessage(pacId, MSG_GALLERY_READY, 0, 0);
                });

                container.addEventListener('lgBeforeOpen', function() {
                    if (!_registry.has(pacId)) { return; }
                    pac.sendMessage(pacId, MSG_BEFORE_OPEN, 0, 0);
                });

                container.addEventListener('lgAfterOpen', function() {
                    if (!_registry.has(pacId)) { return; }
                    pac.sendMessage(pacId, MSG_AFTER_OPEN, 0, 0);
                });

                container.addEventListener('lgBeforeClose', function() {
                    if (!_registry.has(pacId)) { return; }
                    pac.sendMessage(pacId, MSG_BEFORE_CLOSE, 0, 0);
                });

                container.addEventListener('lgAfterClose', function() {
                    if (!_registry.has(pacId)) { return; }
                    pac.sendMessage(pacId, MSG_AFTER_CLOSE, 0, 0);
                });

                container.addEventListener('lgBeforeSlide', function(event) {
                    if (!_registry.has(pacId)) { return; }
                    const { index, prevIndex } = event.detail;
                    pac.sendMessage(pacId, MSG_BEFORE_SLIDE, index, prevIndex, { index, prevIndex });
                });

                container.addEventListener('lgAfterSlide', function(event) {
                    if (!_registry.has(pacId)) { return; }

                    const { index, prevIndex } = event.detail;

                    // Keep reactive property current.
                    _registry.get(pacId).abstraction.currentIndex = index;

                    pac.sendMessage(pacId, MSG_AFTER_SLIDE, index, prevIndex, { index, prevIndex });
                });

                // -----------------------------------------------------------------
                // Initialize lightGallery.
                // -----------------------------------------------------------------
                window.lightGallery(container, galleryConfig);
            }

            /**
             * Initializes all queued components now that window.lightGallery is available.
             */
            function drainPendingInits() {
                for (const pending of _pendingInits) {
                    createGallery(pending.abstraction, pending.pacId, pending.galleryConfig);
                }
                _pendingInits.length = 0;
            }

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Activates only when the container is a <waka-lightgallery> element.
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    if (!container) {
                        return;
                    }

                    // Only activate on <waka-lightgallery> custom elements.
                    if (container.tagName.toLowerCase() !== 'waka-lightgallery') {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    const galleryConfig = {
                        ..._defaultGalleryConfig,
                        ...(_config.lightgallery ?? {})
                    };

                    // Always inject CSS (one-shot).
                    ensureCssLoaded();

                    // Load the JS and initialize when ready.
                    ensureApiLoaded(drainPendingInits, _pendingInits);

                    if (_apiReady) {
                        createGallery(abstraction, pacId, galleryConfig);
                    } else {
                        _pendingInits.push({ abstraction, pacId, pac, galleryConfig, MSG_GALLERY_ERROR });
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, destroys the lightGallery
                 * instance, and removes the registry entry.
                 *
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    // Pull from the pending queue if destroyed before the script loaded.
                    const pendingIndex = _pendingInits.findIndex(function(p) {
                        return p.pacId === pacId;
                    });

                    if (pendingIndex !== -1) {
                        _pendingInits.splice(pendingIndex, 1);
                    }

                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    // destroy() closes the gallery if open and tears down all
                    // DOM modifications made by lightGallery. It returns a
                    // Promise that resolves once the close animation completes,
                    // but we don't need to await it here since WakaPAC's
                    // teardown is synchronous and the animation is cosmetic.
                    entry.instance.destroy();

                    // Remove from registry
                    _registry.delete(pacId);
                }
            };
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Opens the lightGallery at the given slide index.
         * @param {string} pacId
         * @param {number} [index=0]
         */
        openGallery(pacId, index = 0) {
            _registry.get(pacId)?.instance?.openGallery(index);
        },

        /**
         * Closes the lightGallery if it is currently open.
         * @param {string} pacId
         */
        closeGallery(pacId) {
            _registry.get(pacId)?.instance?.closeGallery();
        },

        /**
         * Jumps to the given slide index without opening/closing the overlay.
         * Only meaningful while the gallery is open.
         * @param {string} pacId
         * @param {number} index
         */
        slide(pacId, index) {
            _registry.get(pacId)?.instance?.slide(index);
        },

        /**
         * Refreshes lightGallery after the container's child elements have
         * changed (e.g. after a reactive foreach update adds/removes items).
         * @param {string} pacId
         */
        refresh(pacId) {
            _registry.get(pacId)?.instance?.refresh();
        },

        /**
         * Destroys the lightGallery instance for the given pacId.
         * Mirrors onComponentDestroyed but callable from application code.
         * @param {string} pacId
         */
        destroy(pacId) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            entry.instance.destroy();
            _registry.delete(pacId);
        }
    };

    // Lowercase alias for consistency with WakaCKEditor / wakaCKEditor convention.
    window.wakaLightGallery = window.WakaLightGallery;

})();