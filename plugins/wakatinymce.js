/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ████████╗██╗███╗   ██╗██╗   ██╗███╗   ███╗ ██████╗███████╗                          ║
 * ║  ╚══██╔══╝██║████╗  ██║╚██╗ ██╔╝████╗ ████║██╔════╝██╔════╝                          ║
 * ║     ██║   ██║██╔██╗ ██║ ╚████╔╝ ██╔████╔██║██║     █████╗                            ║
 * ║     ██║   ██║██║╚██╗██║  ╚██╔╝  ██║╚██╔╝██║██║     ██╔══╝                            ║
 * ║     ██║   ██║██║ ╚████║   ██║   ██║ ╚═╝ ██║╚██████╗███████╗                          ║
 * ║     ╚═╝   ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝╚══════╝                          ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaTinyMCE (TinyMCE 7)                                            ║
 * ║                                                                                      ║
 * ║  Wraps TinyMCE instances inside PAC containers.                                      ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <textarea> element carrying a      ║
 * ║  data-tinymce attribute. TinyMCE hides the textarea in place and manages its         ║
 * ║  value natively for form submission.                                                 ║
 * ║                                                                                      ║
 * ║  The TinyMCE script is injected automatically on first use and shared across all     ║
 * ║  instances. Components created before the script has loaded are queued and           ║
 * ║  initialized once tinymce is available.                                              ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaTinyMCE, { licenseKey: 'your-key' });  // CDN (required)          ║
 * ║    wakaPAC.use(WakaTinyMCE, { src: '/path/to/tinymce.min.js',                        ║
 * ║                               licenseKey: 'no-license-key' });  // self-host         ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <textarea data-pac-id="editor1" data-tinymce name="body"></textarea>              ║
 * ║                                                                                      ║
 * ║  Per-instance TinyMCE config can be passed as the third argument to wakaPAC()        ║
 * ║  under the 'tinymce' key:                                                            ║
 * ║    wakaPAC('editor1', { msgProc }, { tinymce: { toolbar: 'bold italic' } })          ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_EDITOR_READY    — editor is fully initialized; extended.value = initial HTML  ║
 * ║    MSG_EDITOR_ERROR    — script failed to load or tinymce.init() rejected;           ║
 * ║                          extended.message                                            ║
 * ║    MSG_CHANGE          — any data mutation (typing, toolbar, programmatic);          ║
 * ║                          extended.value                                              ║
 * ║    MSG_INPUT           — alias of MSG_CHANGE (dispatched from the same event)        ║
 * ║    MSG_INPUT_COMPLETE  — editing session ended (on blur or after paste);             ║
 * ║                          extended.value                                              ║
 * ║    MSG_PASTE           — fired before paste is inserted; extended.text/html/rtf/     ║
 * ║                          uris/files/availableTypes. Return false to cancel.          ║
 * ║    MSG_SETFOCUS        — editor gained focus                                         ║
 * ║    MSG_KILLFOCUS       — editor lost focus                                           ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    value  — current editor HTML; kept current on every change                        ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaTinyMCE.getValue(pacId)          — returns current HTML string                ║
 * ║    WakaTinyMCE.setValue(pacId, html)    — sets editor content                        ║
 * ║    WakaTinyMCE.focus(pacId)             — focuses the editor                         ║
 * ║    WakaTinyMCE.setReadOnly(pacId, bool) — toggles read-only mode                     ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // TinyMCE script bootstrap
    // =========================================================================
    // TinyMCE 7 CDN script URL. Requires an API key from https://www.tiny.cloud/
    // A free plan (unlimited editor loads) is available. Use licenseKey: 'no-license-key'
    // for self-hosted builds where the CDN is not needed.
    //
    // The CDN script exposes window.tinymce. Self-hosted users pass 'src' pointing
    // at their local tinymce.min.js.
    //
    // Unlike CKEditor 5, TinyMCE hides (not removes) the source textarea and
    // manages it natively. No manual sync is needed.
    // =========================================================================

    /**
     * TinyMCE CDN script URL. The API key is appended as a query parameter.
     * @type {string}
     */
    const TINYMCE_CDN_BASE = 'https://cdn.tiny.cloud/1';
    const TINYMCE_VERSION  = '7';

    /**
     * True once window.tinymce is available and ready to use.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * Queue of pending component descriptors created before the TinyMCE
     * script finished loading.
     * @type {Array<{ abstraction: Object, pacId: string, pac: Object, msgConstants: Object, editorConfig: Object }>}
     */
    const _pendingInits = [];

    /**
     * The resolved script src captured from createPacPlugin options.
     * @type {string}
     */
    let _scriptSrc = null;  // resolved in createPacPlugin once licenseKey is known

    /**
     * Injects the TinyMCE script and drains the pending queue once it loads.
     * Safe to call multiple times.
     *
     * If window.tinymce is already on the page (externally loaded), injection
     * is skipped and the queue is drained immediately.
     */
    function ensureApiLoaded() {
        if (window.tinymce) {
            _apiReady = true;
            drainPendingInits();
            return;
        }

        if (document.getElementById('waka-tinymce-script')) {
            // Already injected; the load handler will drain the queue.
            return;
        }

        const tag = document.createElement('script');
        tag.id  = 'waka-tinymce-script';
        tag.src = _scriptSrc;

        tag.onload = function () {
            if (!window.tinymce) {
                const msg = 'TinyMCE script loaded but window.tinymce is not defined. ' +
                    'Use the official CDN URL or a self-hosted tinymce.min.js build.';

                for (const pending of _pendingInits) {
                    pending.pac.sendMessage(
                        pending.pacId,
                        pending.msgConstants.MSG_EDITOR_ERROR,
                        0, 0,
                        { message: msg }
                    );
                }

                _pendingInits.length = 0;
                return;
            }

            _apiReady = true;
            drainPendingInits();
        };

        tag.onerror = function () {
            for (const pending of _pendingInits) {
                pending.pac.sendMessage(
                    pending.pacId,
                    pending.msgConstants.MSG_EDITOR_ERROR,
                    0, 0,
                    { message: 'TinyMCE script failed to load' }
                );
            }

            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    /**
     * Initializes all queued components now that tinymce is available.
     */
    function drainPendingInits() {
        for (const pending of _pendingInits) {
            createEditor(
                pending.abstraction,
                pending.pacId,
                pending.pac,
                pending.msgConstants,
                pending.editorConfig
            );
        }

        _pendingInits.length = 0;
    }

    // =========================================================================
    // Registry
    // =========================================================================

    /**
     * Registry of active TinyMCE components keyed by pacId.
     * @type {Map<string, {
     *   pac:          Object,
     *   editor:       tinymce.Editor,
     *   abstraction:  Object,
     *   msgConstants: Object
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // Paste detail helper
    // =========================================================================

    /**
     * Builds the MSG_PASTE detail object from a native ClipboardData instance.
     * @param {DataTransfer|null} clipboardData
     * @returns {{ 'text/plain': string, 'text/html': string, 'text/rtf': string, 'text/uri-list': string, uris: string[], files: object[], types: string[] }}
     */
    function buildPasteDetail(clipboardData) {
        if (!clipboardData) {
            return {'text/plain': '', 'text/html': '', 'text/rtf': '', 'text/uri-list': '', uris: [], files: [], types: []};
        }

        const types = Array.from(clipboardData.types ?? []);
        const uriRaw = clipboardData.getData('text/uri-list') ?? '';

        const uris = uriRaw
            .split(/\r?\n/)
            .filter(function (line) { return line.length > 0 && !line.startsWith('#'); });

        const files = Array.from(clipboardData.files ?? []).map(function (f) {
            return {name: f.name, size: f.size, type: f.type};
        });

        return {
            'text/plain':    clipboardData.getData('text/plain') ?? '',
            'text/html':     clipboardData.getData('text/html')  ?? '',
            'text/rtf':      clipboardData.getData('text/rtf')   ?? '',
            'text/uri-list': uriRaw,
            uris,
            files,
            types
        };
    }

    // =========================================================================
    // Editor construction
    // =========================================================================

    /**
     * Instantiates a TinyMCE instance on the container textarea and registers it.
     *
     * TinyMCE behavior notes:
     *
     *   1. tinymce.init() is asynchronous and resolves with an array of editors.
     *      We always pass a single target so we take editors[0].
     *
     *   2. TinyMCE hides (not removes) the source textarea and inserts its own
     *      editor UI after it. The textarea is still in the DOM but display:none.
     *      TinyMCE manages the textarea value natively; no manual sync is needed.
     *
     *   3. The 'input' callback fires on every keystroke and content mutation.
     *      The 'change' callback fires on blur (when content has changed since
     *      focus). We dispatch MSG_INPUT/MSG_CHANGE from 'input' to mirror the
     *      CKEditor 5 wrapper's per-mutation behavior.
     *
     *   4. Paste interception uses the native 'paste' event on the editor so the
     *      full ClipboardEvent is available (text, html, rtf, files, uris).
     *      event.preventDefault() cancels the insertion.
     *
     *   5. focus / blur events are available directly on the TinyMCE editor via
     *      the 'focus' and 'blur' init callbacks.
     *
     *   6. Read-only mode uses editor.mode.set('readonly') / editor.mode.set('design').
     *
     * @param {Object} abstraction
     * @param {string} pacId
     * @param {Object} pac
     * @param {Object} msgConstants
     * @param {Object} editorConfig - Merged plugin-level and per-instance config
     */
    function createEditor(abstraction, pacId, pac, msgConstants, editorConfig) {
        const container = pac.getContainerByPacId(pacId);

        // Guard: component may have been destroyed while waiting for the script.
        if (!container || !container.isConnected) {
            return;
        }

        // Pre-seed the registry entry so onComponentDestroyed can clean up even
        // if the init promise is still pending.
        const entry = {
            pac,
            editor: null,       // filled once the Promise resolves
            abstraction,
            msgConstants
        };

        _registry.set(pacId, entry);

        // ── tinymce.init() ────────────────────────────────────────────────────
        // We merge the caller's config with the event callbacks we need.
        // 'target' is used instead of 'selector' so we bind to the exact element.
        // The callbacks below are additive — if the caller also passes e.g. an
        // 'init' callback in their editorConfig, it will be overwritten. For most
        // use cases this is acceptable; deep-merge is out of scope here.
        window.tinymce.init({
            ...editorConfig,
            target: container,

            setup(editor) {
                // Allow the caller's own setup hook to run first.
                if (typeof editorConfig.setup === 'function') {
                    editorConfig.setup(editor);
                }

                // ── input: MSG_INPUT + MSG_CHANGE ─────────────────────────────
                // Fires on every content mutation (typing, toolbar, setContent).
                editor.on('input', function () {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const value = editor.getContent();
                    pac.sendMessage(pacId, pac.MSG_INPUT,  0, 0, { value });
                    pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, { value });
                });

                // TinyMCE's 'change' fires on blur when content has mutated.
                // We use it as an additional MSG_CHANGE trigger to catch toolbar
                // actions that don't fire 'input' (e.g. insert image via dialog).
                editor.on('change', function () {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const value = editor.getContent();
                    pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, { value });
                });

                // ── Paste interception: MSG_PASTE ─────────────────────────────
                // We intercept the native 'paste' event so the full ClipboardEvent
                // is available (text, html, rtf, files, uris).
                // event.preventDefault() cancels the paste before TinyMCE processes it.
                // MSG_INPUT_COMPLETE after paste is covered by the existing blur and
                // change listeners, so no PastePostProcess equivalent is needed.
                editor.on('paste', function (event) {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const clipboardData = event.clipboardData ?? event.originalEvent?.clipboardData;
                    const detail = buildPasteDetail(clipboardData);
                    const domEvent = event.originalEvent ?? event;

                    const result = pac.sendMessage(
                        pacId, pac.MSG_PASTE,
                        (domEvent.ctrlKey  ? pac.MK_CONTROL : 0) |
                        (domEvent.shiftKey ? pac.MK_SHIFT   : 0) |
                        (domEvent.altKey   ? pac.MK_ALT     : 0),
                        detail['text/plain'].length,
                        detail
                    );

                    if (result === false) {
                        event.preventDefault();
                    }
                });

                // ── focus ─────────────────────────────────────────────────────
                editor.on('focus', function () {
                    pac.sendMessage(pacId, pac.MSG_SETFOCUS, 0, 0);
                });

                // ── blur: MSG_INPUT_COMPLETE + MSG_KILLFOCUS ──────────────────
                editor.on('blur', function () {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const value = editor.getContent();
                    pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, { value });
                    pac.sendMessage(pacId, pac.MSG_KILLFOCUS, 0, 0);
                });

                // ── init: MSG_EDITOR_READY ────────────────────────────────────
                // The 'init' event inside setup() is the reliable TinyMCE 7 way
                // to know the editor is fully constructed and the UI is in the DOM.
                // init_instance_callback (top-level config) is not reliably called
                // in TinyMCE 7 and is avoided here.
                editor.on('init', function () {
                    // Component may have been destroyed while init was in flight.
                    if (!_registry.has(pacId)) {
                        editor.remove();
                        return;
                    }

                    entry.editor = editor;

                    const initialValue = editor.getContent();

                    if (abstraction) {
                        abstraction.value = initialValue;
                    }

                    pac.sendMessage(pacId, msgConstants.MSG_EDITOR_READY, 0, 0, {
                        value: initialValue
                    });
                });
            }
        }).catch(function (error) {
            // tinymce.init() rejects if TinyMCE itself throws during setup.
            _registry.delete(pacId);

            pac.sendMessage(pacId, msgConstants.MSG_EDITOR_ERROR, 0, 0, {
                message: error?.message ?? 'TinyMCE failed to initialize'
            });
        });
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaTinyMCE = {

        /**
         * Called on plugin initialization through wakaPAC.use()
         * @param {Object} pac
         * @param {Object} options
         * @returns {{ onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void }}
         */
        createPacPlugin(pac, options = {}) {

            // Resolve the script URL.
            // CDN mode requires licenseKey. Self-hosted mode requires src.
            // If window.tinymce is already present neither is strictly needed.
            if (options.src) {
                _scriptSrc = options.src;
            } else {
                const key = options.licenseKey ?? 'no-license-key';
                _scriptSrc = `${TINYMCE_CDN_BASE}/${key}/tinymce/${TINYMCE_VERSION}/tinymce.min.js`;
            }

            // Build plugin-level TinyMCE config defaults.
            const _defaultEditorConfig = {};

            if (options.toolbar !== undefined) {
                _defaultEditorConfig.toolbar = options.toolbar;
            }

            if (options.plugins !== undefined) {
                _defaultEditorConfig.plugins = options.plugins;
            }

            if (options.language !== undefined) {
                // TinyMCE uses 'language' for the UI locale.
                _defaultEditorConfig.language = options.language;
            }

            if (options.height !== undefined) {
                _defaultEditorConfig.height = options.height;
            }

            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_EDITOR_READY = pac.MSG_PLUGIN + 0x200;
            const MSG_EDITOR_ERROR = pac.MSG_PLUGIN + 0x201;

            // Attach constants so components can reference WakaTinyMCE.MSG_EDITOR_READY etc.
            this.MSG_EDITOR_READY = MSG_EDITOR_READY;
            this.MSG_EDITOR_ERROR = MSG_EDITOR_ERROR;

            const msgConstants = {
                MSG_EDITOR_READY,
                MSG_EDITOR_ERROR
            };

            return {

                /**
                 * Called by WakaPAC after a component is created.
                 * Activates only when the container is a <textarea> with a
                 * data-tinymce attribute.
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    if (!container || !(container instanceof HTMLTextAreaElement)) {
                        return;
                    }

                    if (!container.hasAttribute('data-tinymce')) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    const editorConfig = {
                        ..._defaultEditorConfig,
                        ...(_config.tinymce ?? {})
                    };

                    ensureApiLoaded();

                    if (_apiReady) {
                        createEditor(abstraction, pacId, pac, msgConstants, editorConfig);
                    } else {
                        _pendingInits.push({ abstraction, pacId, pac, msgConstants, editorConfig });
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, removes the TinyMCE
                 * instance, and removes the registry entry.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    // Pull from the pending queue if destroyed before script loaded.
                    const pendingIndex = _pendingInits.findIndex(function (p) {
                        return p.pacId === pacId;
                    });

                    if (pendingIndex !== -1) {
                        _pendingInits.splice(pendingIndex, 1);
                    }

                    const entry = _registry.get(pacId);

                    if (!entry) {
                        return;
                    }

                    _registry.delete(pacId);

                    // editor may be null if destroyed while tinymce.init()
                    // is still in flight — the in-flight init_instance_callback
                    // checks _registry and will call editor.remove() itself.
                    if (entry.editor) {
                        entry.editor.remove();
                    }
                }
            };
        },

        // =====================================================================
        // Public API — all methods take pacId as first argument
        // =====================================================================

        /**
         * Returns the current HTML content of the editor.
         * @param {string} pacId
         * @returns {string|undefined}
         */
        getValue(pacId) {
            return _registry.get(pacId)?.editor?.getContent();
        },

        /**
         * Sets the editor content.
         * TinyMCE's setContent() triggers the 'change' event, which dispatches
         * MSG_CHANGE. MSG_INPUT is not fired for programmatic updates (TinyMCE
         * does not fire 'input' on setContent) — this matches user expectations.
         * @param {string} pacId
         * @param {string} html
         */
        setValue(pacId, html) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            entry.editor.setContent(html);
        },

        /**
         * Focuses the editor.
         * @param {string} pacId
         */
        focus(pacId) {
            _registry.get(pacId)?.editor?.focus();
        },

        /**
         * Toggles read-only mode on the editor.
         *
         * TinyMCE 6+ uses editor.mode.set('readonly') / editor.mode.set('design').
         * In earlier versions the API was editor.setMode('readonly'), which is
         * still supported as an alias in TinyMCE 7.
         *
         * @param {string}  pacId
         * @param {boolean} readOnly
         */
        setReadOnly(pacId, readOnly) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            entry.editor.mode.set(readOnly ? 'readonly' : 'design');
        }
    };

})();