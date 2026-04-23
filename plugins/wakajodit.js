/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗      ██╗ ██████╗ ██████╗ ██╗████████╗             ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗     ██║██╔═══██╗██╔══██╗██║╚══██╔══╝             ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║     ██║██║   ██║██║  ██║██║   ██║                ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██   ██║██║   ██║██║  ██║██║   ██║                ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║╚█████╔╝╚██████╔╝██████╔╝██║   ██║                ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚════╝  ╚═════╝ ╚═════╝ ╚═╝   ╚═╝                ║
 * ║                                                                                      ║
 * ║  WakaPAC Plugin — WakaJodit (Jodit Editor)                                           ║
 * ║                                                                                      ║
 * ║  Wraps Jodit editor instances inside PAC containers.                                 ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <textarea> element carrying a      ║
 * ║  data-jodit attribute. Unlike CKEditor 5, Jodit retains the original textarea in     ║
 * ║  the DOM and keeps it synchronized automatically — no proxy element is needed.       ║
 * ║                                                                                      ║
 * ║  The Jodit script is injected automatically on first use and shared across all       ║
 * ║  instances. Components created before the script has loaded are queued and           ║
 * ║  initialized once window.Jodit is available.                                         ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaJodit);                             // CDN defaults               ║
 * ║    wakaPAC.use(WakaJodit, { src: '/path/to/jodit.min.js',                            ║
 * ║                             css: '/path/to/jodit.min.css' }); // self-host           ║
 * ║    wakaPAC.use(WakaJodit, { css: null });              // CSS already on page        ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <textarea data-pac-id="editor1" data-jodit name="body"></textarea>                ║
 * ║    <waka-jodit data-pac-id="editor1" name="body"></waka-jodit>  (custom element)     ║
 * ║                                                                                      ║
 * ║  Per-instance Jodit config can be passed as the third argument to wakaPAC()          ║
 * ║  under the 'jodit' key:                                                              ║
 * ║    wakaPAC('editor1', { msgProc }, { jodit: { toolbar: true, height: 400 } })        ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_EDITOR_READY    — editor is fully initialized; extended.value = initial HTML  ║
 * ║    MSG_EDITOR_ERROR    — script failed to load or Jodit constructor threw;           ║
 * ║                          extended.message                                            ║
 * ║    MSG_CHANGE          — any data mutation (typing, toolbar, programmatic);          ║
 * ║                          extended.value                                              ║
 * ║    MSG_INPUT           — alias of MSG_CHANGE (fired on the same 'change' event)      ║
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
 * ║    WakaJodit.getValue(pacId)          — returns current HTML string                  ║
 * ║    WakaJodit.setValue(pacId, html)    — sets editor content                          ║
 * ║    WakaJodit.focus(pacId)             — focuses the editor                           ║
 * ║    WakaJodit.setReadOnly(pacId, bool) — toggles read-only mode                       ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // Jodit script bootstrap
    // =========================================================================
    // Jodit ships a single UMD-compatible bundle. The CDN version is hosted at:
    //   https://cdn.jsdelivr.net/npm/jodit@latest/build/jodit.min.js
    // with a companion stylesheet at:
    //   https://cdn.jsdelivr.net/npm/jodit@latest/build/jodit.min.css
    //
    // Jodit retains the original <textarea> in the DOM and keeps it in sync
    // automatically on every change. No proxy element is needed.
    // =========================================================================

    /**
     * CDN URLs for the Jodit bundle and companion stylesheet.
     * @type {string}
     */
    const JODIT_CDN_SCRIPT = 'https://cdn.jsdelivr.net/npm/jodit@latest/build/jodit.min.js';
    const JODIT_CDN_CSS = 'https://cdn.jsdelivr.net/npm/jodit@latest/build/jodit.min.css';

    /**
     * True once window.Jodit is available and ready to use.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * Queue of pending component descriptors created before the Jodit
     * script finished loading.
     * @type {Array<{ abstraction: Object, pacId: string, pac: Object, msgConstants: Object, editorConfig: Object }>}
     */
    const _pendingInits = [];

    /**
     * The resolved script src captured from createPacPlugin options.
     * @type {string}
     */
    let _scriptSrc = JODIT_CDN_SCRIPT;

    /**
     * The resolved CSS href. Injected as a <link> alongside the script.
     * Set to null to skip CSS injection (e.g. when the stylesheet is already
     * present on the page).
     * @type {string|null}
     */
    let _cssSrc = JODIT_CDN_CSS;

    /**
     * Injects the Jodit script (and its companion CSS) and drains the pending
     * queue once the script loads. Safe to call multiple times.
     *
     * If window.Jodit is already on the page (externally loaded), injection
     * is skipped and the queue is drained immediately.
     */
    function ensureApiLoaded() {
        if (window.Jodit) {
            _apiReady = true;
            drainPendingInits();
            return;
        }

        if (document.getElementById('waka-jodit-script')) {
            // Already injected; the load handler will drain the queue.
            return;
        }

        // ── CSS ───────────────────────────────────────────────────────────────
        if (_cssSrc && !document.getElementById('waka-jodit-css')) {
            const link = document.createElement('link');
            link.id = 'waka-jodit-css';
            link.rel = 'stylesheet';
            link.href = _cssSrc;
            (document.head ?? document.body).appendChild(link);
        }

        // ── Script ────────────────────────────────────────────────────────────
        const tag = document.createElement('script');
        tag.id = 'waka-jodit-script';
        tag.src = _scriptSrc;

        tag.onload = function () {
            if (!window.Jodit) {
                const msg = 'Jodit script loaded but window.Jodit is not defined. ' +
                    'Ensure the script is a UMD/IIFE build that exposes window.Jodit.';

                for (const pending of _pendingInits) {
                    pending.pac.sendMessage(
                        pending.pacId,
                        pending.msgConstants.MSG_EDITOR_ERROR,
                        0, 0,
                        {
                            message: msg
                        }
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
                    {
                        message: 'Jodit script failed to load'
                    }
                );
            }

            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    /**
     * Initializes all queued components now that window.Jodit is available.
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
     * Registry of active Jodit components keyed by pacId.
     * @type {Map<string, {
     *   pac:          Object,
     *   editor:       Jodit,
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
     * @returns {{'text/plain': string, 'text/html': string, 'text/rtf': string, 'text/uri-list': string, uris: string[], files: object[], types: string[]}}
     */
    function buildPasteDetail(clipboardData) {
        if (!clipboardData) {
            return {
                'text/plain': '',
                'text/html': '',
                'text/rtf': '',
                'text/uri-list': '',
                uris: [],
                files: [],
                types: []
            };
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
            'text/plain': clipboardData.getData('text/plain') ?? '',
            'text/html': clipboardData.getData('text/html') ?? '',
            'text/rtf': clipboardData.getData('text/rtf') ?? '',
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
     * Instantiates a Jodit instance on the container textarea and registers it.
     *
     * Jodit behaviour differences from CKEditor 5 that this function accounts for:
     *
     *   1. new Jodit(element, config) is synchronous — no Promise, no pending
     *      queue needed at the instance level (the queue is only for the script
     *      load itself).
     *
     *   2. Jodit keeps the original <textarea> in the DOM and syncs it on every
     *      change automatically. No proxy element is required.
     *
     *   3. Events are registered via jodit.events.on(eventName, handler).
     *      The 'change' event fires after every content mutation, carrying the
     *      new HTML as its first argument.
     *
     *   4. Paste interception uses the 'beforePaste' event. The handler receives
     *      a ClipboardEvent. Returning false cancels the paste.
     *      After the paste is committed, 'afterPaste' fires — used for
     *      MSG_INPUT_COMPLETE.
     *
     *   5. Read-only mode is toggled with jodit.setReadOnly(bool) — no lock ID.
     *
     *   6. jodit.value is the getter/setter for HTML content (equivalent to
     *      CKEditor 5's getData() / setData()).
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

        // For the <waka-jodit> custom element, Jodit needs an actual <textarea>
        // to attach to. resolveTextarea() creates one inside the custom element
        // the first time and re-uses it on subsequent calls.
        const textarea = resolveTextarea(container);

        let editor;

        try {
            editor = new window.Jodit(textarea, editorConfig);
        } catch (error) {
            pac.sendMessage(pacId, msgConstants.MSG_EDITOR_ERROR, 0, 0, {
                message: error?.message ?? 'Jodit failed to initialize'
            });

            return;
        }

        _registry.set(pacId, {pac, editor, abstraction, msgConstants});

        // ── ready ─────────────────────────────────────────────────────────────
        // Jodit fires 'ready' once the editor UI has fully initialized.
        // This is the correct moment to emit MSG_EDITOR_READY because the
        // editor may still be bootstrapping its toolbar at construction time.
        editor.events.on('ready', function () {
            if (!_registry.has(pacId)) {
                return;
            }

            const initialValue = editor.value;

            pac.sendMessage(pacId, msgConstants.MSG_EDITOR_READY, 0, 0, {
                value: initialValue
            });
        });

        // ── change ────────────────────────────────────────────────────────────
        // Fires after every content mutation: typing, toolbar actions, and
        // programmatic value assignments. The new HTML is passed as the first
        // argument. Jodit keeps the textarea in sync automatically, so we only
        // need to dispatch WakaPAC messages here.
        editor.events.on('change', function (newValue) {
            if (!_registry.has(pacId)) {
                return;
            }

            pac.sendMessage(pacId, pac.MSG_INPUT, 0, 0, {value: newValue});
            pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, {value: newValue});
        });

        // ── beforePaste ───────────────────────────────────────────────────────
        // Jodit fires 'beforePaste' with the native ClipboardEvent before it
        // processes the clipboard content. Returning false cancels the paste.
        editor.events.on('beforePaste', function (event) {
            if (!_registry.has(pacId)) {
                return;
            }

            const clipboardData = event.clipboardData ?? null;
            const detail = buildPasteDetail(clipboardData);

            const result = pac.sendMessage(
                pacId, pac.MSG_PASTE,
                (event.ctrlKey ? pac.MK_CONTROL : 0) |
                (event.shiftKey ? pac.MK_SHIFT : 0) |
                (event.altKey ? pac.MK_ALT : 0),
                detail['text/plain'].length,
                detail
            );

            if (result === false) {
                return false;
            }
        });

        // ── afterPaste ────────────────────────────────────────────────────────
        // Fires after Jodit has committed the pasted content to the model.
        // editor.value is current at this point.
        editor.events.on('afterPaste', function () {
            if (!_registry.has(pacId)) {
                return;
            }

            pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {
                value: editor.value
            });
        });

        // ── focus / blur ──────────────────────────────────────────────────────
        editor.events.on('focus', function () {
            if (!_registry.has(pacId)) {
                return;
            }

            pac.sendMessage(pacId, pac.MSG_SETFOCUS, 0, 0);
        });

        editor.events.on('blur', function () {
            if (!_registry.has(pacId)) {
                return;
            }

            const value = editor.value;

            pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {value});
            pac.sendMessage(pacId, pac.MSG_KILLFOCUS, 0, 0);
        });
    }

    // =========================================================================
    // Custom element helper
    // =========================================================================

    /**
     * Resolves the <textarea> that Jodit should be initialized on.
     *
     * For the classic usage pattern the container IS the textarea, so it is
     * returned directly. For the <waka-jodit> custom-element pattern the
     * container is a generic element; a hidden <textarea> is created inside it
     * (or the existing one is re-used on subsequent calls) so that Jodit has a
     * proper target and form-submission semantics are preserved.
     *
     * @param {Element} container - The element returned by pac.getContainerByPacId()
     * @returns {HTMLTextAreaElement}
     */
    function resolveTextarea(container) {
        if (container instanceof HTMLTextAreaElement) {
            return container;
        }

        // Re-use an existing injected textarea if the component is re-created.
        let ta = container.querySelector('textarea[data-waka-jodit-proxy]');

        if (!ta) {
            ta = document.createElement('textarea');
            ta.setAttribute('data-waka-jodit-proxy', '');

            // Carry over the name attribute so the field participates in form
            // submission under the same key as the custom element declares.
            if (container.hasAttribute('name')) {
                ta.name = container.getAttribute('name');
            }

            // Copy initial content from the custom element's text nodes, if any.
            ta.value = container.textContent.trim();

            container.appendChild(ta);
        }

        return ta;
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaJodit = {

        /**
         * Called on plugin initialization through wakaPAC.use()
         * @param {Object} pac
         * @param {Object} options
         * @returns {{ onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void }}
         */
        createPacPlugin(pac, options = {}) {

            // Resolve the script URL and companion CSS.
            if (options.src) {
                _scriptSrc = options.src;
                // When using a self-hosted build, suppress auto-CSS unless an
                // explicit css path was provided.
                _cssSrc = options.css !== undefined ? options.css : null;
            }

            if (options.css !== undefined && !options.src) {
                // CDN script but custom CSS path (or null to suppress).
                _cssSrc = options.css;
            }

            // Build plugin-level Jodit config defaults from supported options.
            const _defaultEditorConfig = {};

            if (options.toolbar !== undefined) {
                _defaultEditorConfig.toolbar = options.toolbar;
            }

            if (options.language) {
                _defaultEditorConfig.language = options.language;
            }

            if (options.height !== undefined) {
                _defaultEditorConfig.height = options.height;
            }

            if (options.readonly !== undefined) {
                _defaultEditorConfig.readonly = options.readonly;
            }

            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_EDITOR_READY = pac.MSG_PLUGIN + 0x200;
            const MSG_EDITOR_ERROR = pac.MSG_PLUGIN + 0x201;

            // Attach constants so components can reference WakaJodit.MSG_EDITOR_READY etc.
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
                 * data-jodit attribute.
                 * @param {Object} abstraction - The component's reactive abstraction object
                 * @param {string} pacId       - The data-pac-id of the container
                 * @param {Object} _config     - Component config
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const container = pac.getContainerByPacId(pacId);

                    if (!container) {
                        return;
                    }

                    // Accept either:
                    //   <textarea data-jodit …>      — classic attribute-based usage
                    //   <waka-jodit …>               — custom element usage
                    const isCustomElement = container.tagName.toLowerCase() === 'waka-jodit';
                    const isTextarea      = container instanceof HTMLTextAreaElement;

                    if (!isTextarea && !isCustomElement) {
                        return;
                    }

                    if (isTextarea && !container.hasAttribute('data-jodit')) {
                        return;
                    }

                    // Merge plugin-level defaults with per-instance overrides.
                    const editorConfig = {
                        ..._defaultEditorConfig,
                        ...(_config.jodit ?? {})
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
                 * Removes any pending init from the queue, destroys the Jodit
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

                    // Jodit's destruct() removes the editor UI and restores the
                    // original textarea to its pre-init state.
                    try {
                        entry.editor.destruct();
                    } catch (_) {
                        // Ignore errors from destruct() — the component is gone.
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
            return _registry.get(pacId)?.editor?.value;
        },

        /**
         * Sets the editor content.
         * Triggers the 'change' event, which dispatches MSG_INPUT and MSG_CHANGE.
         * @param {string} pacId
         * @param {string} html
         */
        setValue(pacId, html) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            entry.editor.value = html;
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
         * Jodit exposes a simple boolean setReadOnly(bool) — no lock ID is
         * required, unlike CKEditor 5.
         *
         * @param {string}  pacId
         * @param {boolean} readOnly
         */
        setReadOnly(pacId, readOnly) {
            const entry = _registry.get(pacId);

            if (!entry?.editor) {
                return;
            }

            entry.editor.setReadOnly(readOnly);
        }
    };

})();