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

    /** Owns the state and lifecycle of one jodit plugin. */
    class JoditPlugin {
        constructor(owner, pac, options = {}) {
            this._owner = owner;
            this._pac = pac;
            this._options = options;
        }

        initialize() {
            const state = this;

            // Resolve the script URL and companion CSS.
            if (state._options.src) {
                _scriptSrc = state._options.src;
                // When using a self-hosted build, suppress auto-CSS unless an
                // explicit css path was provided.
                _cssSrc = state._options.css !== undefined ? state._options.css : null;
            }

            if (state._options.css !== undefined && !state._options.src) {
                // CDN script but custom CSS path (or null to suppress).
                _cssSrc = state._options.css;
            }

            // Build plugin-level Jodit config defaults from supported options.
            state._defaultEditorConfig = {};

            if (state._options.toolbar !== undefined) {
                state._defaultEditorConfig.toolbar = state._options.toolbar;
            }

            if (state._options.language) {
                state._defaultEditorConfig.language = state._options.language;
            }

            if (state._options.height !== undefined) {
                state._defaultEditorConfig.height = state._options.height;
            }

            if (state._options.readonly !== undefined) {
                state._defaultEditorConfig.readonly = state._options.readonly;
            }

            // Use the public message IDs for delivery as well as comparisons.
            ({
                MSG_EDITOR_READY: state._MSG_EDITOR_READY,
                MSG_EDITOR_ERROR: state._MSG_EDITOR_ERROR
            } = state._owner);

            state._msgConstants = {
                MSG_EDITOR_READY: state._MSG_EDITOR_READY,
                MSG_EDITOR_ERROR: state._MSG_EDITOR_ERROR
            };

            return state.createDescriptor();
        }

        createDescriptor() {
            const session = this;

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
                    const container = session._pac.getContainerByPacId(pacId);

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
                        ...session._defaultEditorConfig,
                        ..._config.jodit ?? {}
                    };

                    pluginRuntime.ensureApiLoaded();

                    if (_apiReady) {
                        pluginRuntime.createEditor(abstraction, pacId, session._pac, session._msgConstants, editorConfig);
                    } else {
                        _pendingInits.push({abstraction, pacId, pac: session._pac, msgConstants: session._msgConstants, editorConfig});
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, destroys the Jodit
                 * instance, and removes the registry entry.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    const onComponentDestroyedHandlers = {
                        findIndexCallback(p) {
                            return p.pacId === pacId;
                        }
                    };

                    // Pull from the pending queue if destroyed before script loaded.
                    const pendingIndex = _pendingInits.findIndex(onComponentDestroyedHandlers.findIndexCallback);

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
        }
    }

    const pluginRuntime = {
        /**
         * Injects the Jodit script (and its companion CSS) and drains the pending
         * queue once the script loads. Safe to call multiple times.
         *
         * If window.Jodit is already on the page (externally loaded), injection
         * is skipped and the queue is drained immediately.
         */
        ensureApiLoaded() {
            const ensureApiLoadedHandlers = {
                onerror() {
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
                },

                onload() {
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
                    pluginRuntime.drainPendingInits();
                }
            };

            if (window.Jodit) {
                _apiReady = true;
                pluginRuntime.drainPendingInits();
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

            tag.onload = ensureApiLoadedHandlers.onload;

            tag.onerror = ensureApiLoadedHandlers.onerror;

            (document.head ?? document.body).appendChild(tag);
        },

        /**
         * Initializes all queued components now that window.Jodit is available.
         */
        drainPendingInits() {
            for (const pending of _pendingInits) {
                pluginRuntime.createEditor(
                    pending.abstraction,
                    pending.pacId,
                    pending.pac,
                    pending.msgConstants,
                    pending.editorConfig
                );
            }

            _pendingInits.length = 0;
        },

        /**
         * Builds the MSG_PASTE detail object from a native ClipboardData instance.
         * @param {DataTransfer|null} clipboardData
         * @returns {{'text/plain': string, 'text/html': string, 'text/rtf': string, 'text/uri-list': string, uris: string[], files: object[], types: string[]}}
         */
        buildPasteDetail(clipboardData) {
            const buildPasteDetailHandlers = {
                describeFile(f) {
                    return {name: f.name, size: f.size, type: f.type};
                },

                matchesItem(line) {
                    return line.length > 0 && !line.startsWith('#');
                }
            };

            if (!clipboardData) {
                return {
                    'text/plain'   : '',
                    'text/html'    : '',
                    'text/rtf'     : '',
                    'text/uri-list': '',
                    uris           : [],
                    files          : [],
                    types          : []
                };
            }

            const types = Array.from(clipboardData.types ?? []);
            const uriRaw = clipboardData.getData('text/uri-list') ?? '';

            const uris = uriRaw
                .split(/\r?\n/)
                .filter(buildPasteDetailHandlers.matchesItem);

            const files = Array.from(clipboardData.files ?? []).map(buildPasteDetailHandlers.describeFile);

            return {
                'text/plain'   : clipboardData.getData('text/plain') ?? '',
                'text/html'    : clipboardData.getData('text/html') ?? '',
                'text/rtf'     : clipboardData.getData('text/rtf') ?? '',
                'text/uri-list': uriRaw,
                uris,
                files,
                types
            };
        },

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
        createEditor(abstraction, pacId, pac, msgConstants, editorConfig) {
            const createEditorHandlers = {
                onBlur() {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const value = editor.value;

                    pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {value});
                    pac.sendMessage(pacId, pac.MSG_KILLFOCUS, 0, 0);
                },

                onFocus() {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    pac.sendMessage(pacId, pac.MSG_SETFOCUS, 0, 0);
                },

                onAfterPaste() {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, {
                        value: editor.value
                    });
                },

                onBeforePaste(event) {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const clipboardData = event.clipboardData ?? null;
                    const detail = pluginRuntime.buildPasteDetail(clipboardData);

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
                },

                onChange(newValue) {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    pac.sendMessage(pacId, pac.MSG_INPUT, 0, 0, {value: newValue});
                    pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, {value: newValue});
                },

                onReady() {
                    if (!_registry.has(pacId)) {
                        return;
                    }

                    const initialValue = editor.value;

                    pac.sendMessage(pacId, msgConstants.MSG_EDITOR_READY, 0, 0, {
                        value: initialValue
                    });
                }
            };

            const container = pac.getContainerByPacId(pacId);

            // Guard: component may have been destroyed while waiting for the script.
            if (!container || !container.isConnected) {
                return;
            }

            // For the <waka-jodit> custom element, Jodit needs an actual <textarea>
            // to attach to. resolveTextarea() creates one inside the custom element
            // the first time and re-uses it on subsequent calls.
            const textarea = pluginRuntime.resolveTextarea(container);

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
            editor.events.on('ready', createEditorHandlers.onReady);

            // ── change ────────────────────────────────────────────────────────────
            // Fires after every content mutation: typing, toolbar actions, and
            // programmatic value assignments. The new HTML is passed as the first
            // argument. Jodit keeps the textarea in sync automatically, so we only
            // need to dispatch WakaPAC messages here.
            editor.events.on('change', createEditorHandlers.onChange);

            // ── beforePaste ───────────────────────────────────────────────────────
            // Jodit fires 'beforePaste' with the native ClipboardEvent before it
            // processes the clipboard content. Returning false cancels the paste.
            editor.events.on('beforePaste', createEditorHandlers.onBeforePaste);

            // ── afterPaste ────────────────────────────────────────────────────────
            // Fires after Jodit has committed the pasted content to the model.
            // editor.value is current at this point.
            editor.events.on('afterPaste', createEditorHandlers.onAfterPaste);

            // ── focus / blur ──────────────────────────────────────────────────────
            editor.events.on('focus', createEditorHandlers.onFocus);

            editor.events.on('blur', createEditorHandlers.onBlur);
        },

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
        resolveTextarea(container) {
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

                // Copy initial content
                ta.value = container.innerHTML.trim();

                // Remove inner HTML
                container.innerHTML = '';

                // Add textarea as a child of the custom element
                container.appendChild(ta);
            }

            return ta;
        }
    };

    // Support standalone loading while using the host's plugin base when present.
    const MSG_PLUGIN = globalThis.wakaPAC?.MSG_PLUGIN ?? 0x2000;

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

    // =========================================================================
    // Editor construction
    // =========================================================================

    // =========================================================================
    // Custom element helper
    // =========================================================================

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaJodit = {
        // Message IDs are available before wakaPAC.use(), relative to MSG_PLUGIN.
        MSG_EDITOR_READY: MSG_PLUGIN + 0x500,
        MSG_EDITOR_ERROR: MSG_PLUGIN + 0x501,

        /**
         * Called on plugin initialization through wakaPAC.use()
         * @param {Object} pac
         * @param {Object} options
         * @returns {{ onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void }}
         */
        createPacPlugin(pac, options = {}) {
            return new JoditPlugin(this, pac, options).initialize();
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

    window.wakaJodit = window.WakaJodit;
})();
