/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗  ██████╗██╗  ██╗███████╗██████╗ ██╗████████╗      ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗██║╚══██╔══╝      ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║     █████╔╝ █████╗  ██║  ██║██║   ██║         ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║     ██╔═██╗ ██╔══╝  ██║  ██║██║   ██║         ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║╚██████╗██║  ██╗███████╗██████╔╝██║   ██║         ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝   ╚═╝         ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaCKEditor (CKEditor 5)                                          ║
 * ║                                                                                      ║
 * ║  Wraps CKEditor 5 instances inside PAC containers.                                   ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <textarea> element carrying a      ║
 * ║  data-ckeditor attribute. CKEditor 5 replaces the textarea in the DOM — a hidden     ║
 * ║  proxy textarea is inserted in its place to preserve form submission semantics.      ║
 * ║                                                                                      ║
 * ║  The CKEditor 5 Classic Build script is injected automatically on first use and      ║
 * ║  shared across all instances. Components created before the script has loaded are    ║
 * ║  queued and initialized once ClassicEditor is available.                             ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaCKEditor, { licenseKey: 'your-key' });  // CDN (required)         ║
 * ║    wakaPAC.use(WakaCKEditor, { src: '/path/to/ckeditor5.umd.js',                     ║
 * ║                                css: '/path/to/ckeditor5.css',                        ║
 * ║                                licenseKey: 'your-key' });  // self-host              ║
 * ║    wakaPAC.use(WakaCKEditor, { src: '/build/ckeditor5.umd.js',                       ║
 * ║                                css: null });               // CSS already on page    ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <textarea data-pac-id="editor1" data-ckeditor name="body"></textarea>             ║
 * ║                                                                                      ║
 * ║  Per-instance CKEditor config can be passed as the third argument to wakaPAC()       ║
 * ║  under the 'ckeditor' key:                                                           ║
 * ║    wakaPAC('editor1', { msgProc }, { ckeditor: { toolbar: { items: ['bold'] } } })   ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_EDITOR_READY    — editor is fully initialized; extended.value = initial HTML  ║
 * ║    MSG_EDITOR_ERROR    — script failed to load or ClassicEditor.create() rejected;   ║
 * ║                          extended.message                                            ║
 * ║    MSG_CHANGE          — any data mutation (typing, toolbar, programmatic);          ║
 * ║                          extended.value                                              ║
 * ║    MSG_INPUT           — alias of MSG_CHANGE (CKEditor 5 fires change:data per       ║
 * ║                          mutation, making a separate keystroke event redundant)      ║
 * ║    MSG_INPUT_COMPLETE  — editing session ended (on blur or after paste);             ║
 * ║                          extended.value                                              ║
 * ║    MSG_PASTE           — fired before paste is inserted; detail keys match           ║
 * ║                          DataTransfer (text/plain, text/html, text/rtf,              ║
 * ║                          text/uri-list, uris, files, types). Return false to cancel. ║
 * ║    MSG_SETFOCUS        — editor gained focus                                         ║
 * ║    MSG_KILLFOCUS       — editor lost focus                                           ║
 * ║                                                                                      ║
 * ║  Reactive properties injected on the abstraction:                                    ║
 * ║    value  — current editor HTML; kept current on every change                        ║
 * ║                                                                                      ║
 * ║  API — all methods take pacId as first argument:                                     ║
 * ║    WakaCKEditor.getValue(pacId)          — returns current HTML string               ║
 * ║    WakaCKEditor.setValue(pacId, html)    — sets editor content                       ║
 * ║    WakaCKEditor.focus(pacId)             — focuses the editor                        ║
 * ║    WakaCKEditor.setReadOnly(pacId, bool) — toggles read-only mode                    ║
 * ║                                                                                      ║
 * ║  CKEditor 4 → 5 migration notes:                                                     ║
 * ║    • toolbar: 'Full' is gone. Pass toolbar: { items: [...] } or omit for default.    ║
 * ║    • CKEditor 5 does not sync the textarea automatically. This plugin handles that   ║
 * ║      via a hidden proxy element that is kept in sync on every change:data event.     ║
 * ║    • setReadOnly maps to enableReadOnlyMode / disableReadOnlyMode (CKEditor 5 API).  ║
 * ║    • Paste cancellation uses the view document's native 'paste' event.               ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // CKEditor 5 script bootstrap
    // =========================================================================
    // The modern CKEditor 5 CDN (v42+) ships a single UMD bundle at:
    //   https://cdn.ckeditor.com/ckeditor5/<VERSION>/ckeditor5.umd.js
    // This exposes a global named window.CKEDITOR (not window.ClassicEditor).
    // ClassicEditor is destructured from it: const { ClassicEditor } = CKEDITOR.
    //
    // The old per-editor CDN paths (e.g. classic/ckeditor.js) no longer exist
    // from v42 onwards. Self-hosted users can pass any UMD bundle via 'src'.
    //
    // The UMD bundle does NOT include CSS. A matching stylesheet is injected
    // alongside the script tag automatically. For self-hosted or custom 'src'
    // builds, also pass 'css' to point at the correct stylesheet.
    //
    // The CDN requires a licenseKey. A free-tier key (GPL plan, 1 000 editor
    // loads/month) can be obtained at https://portal.ckeditor.com/checkout?plan=free
    // =========================================================================

    /**
     * CDN base URL and version for the CKEditor 5 UMD bundle.
     * @type {string}
     */
    const CKEDITOR5_VERSION = '48.0.0';
    const CKEDITOR5_CDN_SCRIPT = `https://cdn.ckeditor.com/ckeditor5/${CKEDITOR5_VERSION}/ckeditor5.umd.js`;
    const CKEDITOR5_CDN_CSS = `https://cdn.ckeditor.com/ckeditor5/${CKEDITOR5_VERSION}/ckeditor5.css`;

    /**
     * Unique lock ID used for enableReadOnlyMode / disableReadOnlyMode calls.
     * CKEditor 5 requires a stable string identifier per caller.
     * @type {string}
     */
    const READ_ONLY_LOCK_ID = 'waka-ckeditor-readonly';

    /**
     * True once window.ClassicEditor is available and ready to use.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * Queue of pending component descriptors created before the CKEditor 5
     * script finished loading.
     * @type {Array<{ abstraction: Object, pacId: string, pac: Object, msgConstants: Object, editorConfig: Object }>}
     */
    const _pendingInits = [];

    /**
     * The resolved script src captured from createPacPlugin options.
     * @type {string}
     */
    let _scriptSrc = CKEDITOR5_CDN_SCRIPT;

    /**
     * The resolved CSS href. Injected as a <link> alongside the script.
     * Set to null to skip CSS injection (e.g. when the stylesheet is already
     * present on the page or bundled into the self-hosted build).
     * @type {string|null}
     */
    let _cssSrc = CKEDITOR5_CDN_CSS;

    /**
     * Injects the CKEditor 5 UMD script (and its companion CSS) and drains
     * the pending queue once the script loads. Safe to call multiple times.
     *
     * The modern CDN exposes window.CKEDITOR (not window.ClassicEditor).
     * ClassicEditor is destructured from it inside createEditor().
     *
     * If window.CKEDITOR is already on the page (externally loaded), injection
     * is skipped and the queue is drained immediately.
     */
    function ensureApiLoaded() {
        if (window.CKEDITOR) {
            _apiReady = true;
            drainPendingInits();
            return;
        }

        if (document.getElementById('waka-ckeditor5-script')) {
            // Already injected; the load handler will drain the queue.
            return;
        }

        // ── CSS ───────────────────────────────────────────────────────────────
        // The UMD bundle does not include styles. Inject the companion stylesheet
        // unless the caller set css: null or it is already on the page.
        if (_cssSrc && !document.getElementById('waka-ckeditor5-css')) {
            const link = document.createElement('link');
            link.id = 'waka-ckeditor5-css';
            link.rel = 'stylesheet';
            link.href = _cssSrc;
            (document.head ?? document.body).appendChild(link);
        }

        // ── Script ────────────────────────────────────────────────────────────
        const tag = document.createElement('script');
        tag.id = 'waka-ckeditor5-script';
        tag.src = _scriptSrc;

        tag.onload = function () {
            if (!window.CKEDITOR) {
                // Script loaded but the expected global is missing — likely a
                // module-only or custom build that doesn't expose window.CKEDITOR.
                const msg = 'CKEditor 5 script loaded but window.CKEDITOR is not defined. ' +
                    'Use the official UMD CDN bundle (ckeditor5.umd.js) or a ' +
                    'self-hosted UMD build.';

                for (const pending of _pendingInits) {
                    pending.pac.sendMessage(
                        pending.pacId,
                        pending.msgConstants.MSG_EDITOR_ERROR,
                        0, 0,
                        {message: msg}
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
                    {message: 'CKEditor 5 script failed to load'}
                );
            }

            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    /**
     * Initializes all queued components now that ClassicEditor is available.
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
     * Registry of active CKEditor 5 components keyed by pacId.
     * @type {Map<string, {
     *   pac:           Object,
     *   editor:        ClassicEditor,
     *   proxy:         HTMLTextAreaElement,
     *   abstraction:   Object,
     *   msgConstants:  Object
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // Paste detail helper
    // =========================================================================

    /**
     * Builds the MSG_PASTE detail object from a native ClipboardData instance.
     * @param {DataTransfer|null} clipboardData
     * @returns {{'text/plain': string, 'text/html': string, 'text/rtf': string, 'text/uri-list': string, uris: string[], files: object[], types: string[]}}
     */
    function buildPasteDetail(clipboardData) {
        if (!clipboardData) {
            return {'text/plain': '', 'text/html': '', 'text/rtf': '', 'text/uri-list': '', uris: [], files: [], types: []};
        }

        const types = Array.from(clipboardData.types ?? []);
        const uriRaw = clipboardData.getData('text/uri-list') ?? '';

        const uris = uriRaw
            .split(/\r?\n/)
            .filter(function (line) {
                return line.length > 0 && !line.startsWith('#');
            });

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
     * Instantiates a CKEditor 5 instance on the container textarea and
     * registers it.
     *
     * CKEditor 5 behaviour differences from CKEditor 4 that this function
     * accounts for:
     *
     *   1. ClassicEditor.create() is asynchronous (returns a Promise).
     *
     *   2. CKEditor 5 removes the source <textarea> from the DOM entirely and
     *      inserts its own editor UI. It does NOT keep the textarea in sync for
     *      form submission. We create a hidden proxy <textarea> (same name,
     *      same value) and keep it current via the change:data listener so that
     *      native form posts continue to work without extra handling.
     *
     *   3. There is no 'key' event on the editor. The change:data event fires
     *      synchronously after every model mutation (typing, paste, toolbar
     *      action), making a separate per-keystroke message unnecessary.
     *      MSG_INPUT and MSG_CHANGE are therefore both dispatched from
     *      change:data — MSG_INPUT for in-progress edits, MSG_CHANGE for the
     *      same mutation (consistent with WakaPAC convention).
     *
     *   4. Paste interception uses the view document's native 'paste' event so
     *      the full ClipboardEvent is available (text, html, rtf, files, uris).
     *      Returning false from msgProc calls evt.stop() + preventDefault(),
     *      cancelling the insertion before CKEditor processes it.
     *
     *   5. focus / blur events live on editor.editing.view.document, not on
     *      the editor root itself.
     *
     *   6. Read-only mode uses editor.enableReadOnlyMode(lockId) /
     *      editor.disableReadOnlyMode(lockId). A single stable lock ID is
     *      enough for this plugin's use case.
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

        // ── Proxy textarea ────────────────────────────────────────────────────
        // CKEditor 5 removes the original <textarea> from the DOM, breaking
        // native form submission. We insert a hidden proxy with the same name
        // so the form field survives. The proxy is inserted before the original
        // element so it ends up in the same form position (CKEditor 5 inserts
        // its own UI container right before where the textarea was).
        const proxy = document.createElement('textarea');
        proxy.name = container.name ?? '';
        proxy.value = container.value ?? '';
        proxy.style.display = 'none';
        container.parentNode.insertBefore(proxy, container);

        // Pre-seed the registry entry so onComponentDestroyed can clean up even
        // if the promise is still pending.
        const entry = {
            pac,
            editor: null,       // filled once the Promise resolves
            proxy,
            abstraction,
            msgConstants
        };

        _registry.set(pacId, entry);

        // ── ClassicEditor.create() ────────────────────────────────────────────
        // In the modern UMD CDN build, ClassicEditor lives on window.CKEDITOR,
        // not directly on window. Destructure it here so the rest of the
        // function reads the same as before.
        const {ClassicEditor} = window.CKEDITOR;

        ClassicEditor
            .create(container, editorConfig)
            .then(function (editor) {
                // Component may have been destroyed while the Promise was in flight.
                if (!_registry.has(pacId)) {
                    editor.destroy();
                    proxy.remove();
                    return;
                }

                entry.editor = editor;

                // ── instanceReady equivalent ──────────────────────────────────
                const initialValue = editor.getData();
                proxy.value = initialValue;

                pac.sendMessage(pacId, msgConstants.MSG_EDITOR_READY, 0, 0, {
                    value: initialValue
                });

                // ── change:data ───────────────────────────────────────────────
                // Fires after every model mutation: typing, toolbar actions, and
                // programmatic setData(). Covers what CKEditor 4 split across
                // 'change' and 'key'. We dispatch both MSG_INPUT (in-progress)
                // and MSG_CHANGE (committed) from this single event because
                // CKEditor 5 makes no such distinction — every mutation is
                // immediately reflected in getData().
                editor.model.document.on('change:data', function () {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const value = editor.getData();
                    proxy.value = value;

                    pac.sendMessage(pacId, pac.MSG_INPUT, 0, 0, {value});
                    pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, {value});
                });

                // ── Paste interception ────────────────────────────────────────
                // We intercept on the view document's native 'paste' event so the
                // full ClipboardEvent is still available, giving access to all MIME
                // types, file metadata, and the complete clipboard payload.
                // evt.stop() + preventDefault() cancels the paste before CKEditor
                // processes it.
                const viewDoc = editor.editing.view.document;

                viewDoc.on('paste', function (evt, data) {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const clipboardData = data.domEvent.clipboardData;
                    const detail = buildPasteDetail(clipboardData);
                    const domEvent = data.domEvent;

                    const result = pac.sendMessage(
                        pacId, pac.MSG_PASTE,
                        (domEvent.ctrlKey  ? pac.MK_CONTROL : 0) |
                        (domEvent.shiftKey ? pac.MK_SHIFT   : 0) |
                        (domEvent.altKey   ? pac.MK_ALT     : 0),
                        detail['text/plain'].length,
                        detail
                    );

                    if (result === false) {
                        evt.stop();
                        data.preventDefault();
                    }
                }, {priority: 'high'});

                // ── Paste complete: MSG_INPUT_COMPLETE ────────────────────────
                // contentInsertion fires after the paste pipeline has committed
                // the content to the model. getData() is current at this point.
                const clipboardPlugin = editor.plugins.get('ClipboardPipeline');

                if (clipboardPlugin) {
                    clipboardPlugin.on('contentInsertion', function () {
                        if (!_registry.has(pacId)) {
                            return;
                        }

                        const value = editor.getData();

                        pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {value});
                    });
                }

                // ── focus / blur ──────────────────────────────────────────────
                // In CKEditor 5, focus and blur live on the view document, not on
                // the editor instance directly.
                viewDoc.on('focus', function () {
                    pac.sendMessage(pacId, pac.MSG_SETFOCUS, 0, 0);
                });

                viewDoc.on('blur', function () {
                    const value = editor.getData();
                    proxy.value = value;

                    pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {value});
                    pac.sendMessage(pacId, pac.MSG_KILLFOCUS, 0, 0);
                });
            })
            .catch(function (error) {
                // Remove the entry so the destroy hook does not attempt to call
                // editor.destroy() on a null editor.
                _registry.delete(pacId);
                proxy.remove();

                pac.sendMessage(pacId, msgConstants.MSG_EDITOR_ERROR, 0, 0, {
                    message: error?.message ?? 'CKEditor 5 failed to initialize'
                });
            });
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaCKEditor = {

        /**
         * Called on plugin initialization through wakaPAC.use()
         * @param {Object} pac
         * @param {Object} options
         * @returns {{ onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void }}
         */
        createPacPlugin(pac, options = {}) {

            // Resolve the script URL and companion CSS.
            // 'src' overrides the CDN script. 'css' overrides the CDN stylesheet;
            // pass null to suppress CSS injection entirely (stylesheet already on page).
            if (options.src) {
                _scriptSrc = options.src;
                // When using a self-hosted build, default to no auto-CSS unless
                // an explicit css path is given, because the bundle may already
                // include styles or the user manages them separately.
                _cssSrc = options.css !== undefined ? options.css : null;
            }

            if (options.css !== undefined && !options.src) {
                // CDN script but custom CSS path (or null to suppress).
                _cssSrc = options.css;
            }

            // Build plugin-level CKEditor config defaults.
            // CKEditor 5 no longer supports the 'Full' / 'Basic' toolbar shorthand
            // from CKEditor 4. When no toolbar is specified in options or per-instance
            // config, CKEditor 5's own defaults apply (all registered toolbar items).
            const _defaultEditorConfig = {};

            if (options.toolbar) {
                _defaultEditorConfig.toolbar = options.toolbar;
            }

            if (options.language) {
                _defaultEditorConfig.language = options.language;
            }

            if (options.licenseKey) {
                _defaultEditorConfig.licenseKey = options.licenseKey;
            }

            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_EDITOR_READY = pac.MSG_PLUGIN + 0x200;
            const MSG_EDITOR_ERROR = pac.MSG_PLUGIN + 0x201;

            // Attach constants so components can reference WakaCKEditor.MSG_EDITOR_READY etc.
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
                 * data-ckeditor attribute.
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    if (!container || !(container instanceof HTMLTextAreaElement)) {
                        return;
                    }

                    if (!container.hasAttribute('data-ckeditor')) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    const editorConfig = {
                        ..._defaultEditorConfig,
                        ...(_config.ckeditor ?? {})
                    };

                    ensureApiLoaded();

                    if (_apiReady) {
                        createEditor(abstraction, pacId, pac, msgConstants, editorConfig);
                    } else {
                        _pendingInits.push({abstraction, pacId, pac, msgConstants, editorConfig});
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, destroys the CKEditor
                 * instance, removes the proxy textarea, and removes the registry entry.
                 *
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

                    // Remove the proxy textarea from the DOM.
                    entry.proxy?.remove();

                    // editor may be null if destroyed while ClassicEditor.create()
                    // is still in flight — the in-flight promise checks _registry
                    // and will call destroy() + proxy.remove() itself.
                    if (entry.editor) {
                        entry.editor.destroy().catch(function () {
                            // Ignore errors from destroy() — the component is gone.
                        });
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
            return _registry.get(pacId)?.editor?.getData();
        },

        /**
         * Sets the editor content.
         * Triggers change:data, which dispatches MSG_INPUT and MSG_CHANGE.
         * @param {string} pacId
         * @param {string} html
         */
        setValue(pacId, html) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            entry.editor.setData(html);
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
         * CKEditor 5 uses a lock-based API: enableReadOnlyMode(lockId) /
         * disableReadOnlyMode(lockId). A single stable lock ID is used here;
         * this is sufficient when WakaPAC is the only caller managing read-only
         * state. If your application also enables read-only through other means,
         * manage the lock IDs independently.
         *
         * @param {string}  pacId
         * @param {boolean} readOnly
         */
        setReadOnly(pacId, readOnly) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            if (readOnly) {
                entry.editor.enableReadOnlyMode(READ_ONLY_LOCK_ID);
            } else {
                entry.editor.disableReadOnlyMode(READ_ONLY_LOCK_ID);
            }
        }
    };

})();