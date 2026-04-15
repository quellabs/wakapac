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
 * ║  WakaPAC Plugin — WakaCKEditor                                                       ║
 * ║                                                                                      ║
 * ║  Wraps CKEditor 4 instances inside PAC containers.                                   ║
 * ║                                                                                      ║
 * ║  The plugin activates when the PAC container is a <textarea> element carrying a      ║
 * ║  data-ckeditor attribute. The CKEditor 4 script is injected automatically            ║
 * ║  on first use and shared across all instances. Components created before the         ║
 * ║  script has loaded are queued and initialized once CKEDITOR is available.            ║
 * ║                                                                                      ║
 * ║  CKEditor 4 hooks into the surrounding <form>'s submit event automatically when      ║
 * ║  initialized via CKEDITOR.replace() on a <textarea>. The textarea keeps its name     ║
 * ║  attribute and receives the editor's HTML content before the form is submitted,      ║
 * ║  so native form posts work without any extra handling in this plugin.                ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(WakaCKEditor);                              // free build (default)   ║
 * ║    wakaPAC.use(WakaCKEditor, { suppressVersionCheck: true });  // silence warning    ║
 * ║    wakaPAC.use(WakaCKEditor, { license: 'lts',                                       ║
 * ║                                licenseKey: 'your-key' }); // LTS commercial build    ║
 * ║    wakaPAC.use(WakaCKEditor, { src: '/path/to/ckeditor/ckeditor.js' }); // self-host ║
 * ║                                                                                      ║
 * ║  HTML:                                                                               ║
 * ║    <textarea data-pac-id="editor1" data-ckeditor name="body"></textarea>             ║
 * ║                                                                                      ║
 * ║  Per-instance CKEditor config can be passed as the third argument to wakaPAC()       ║
 * ║  under the 'ckeditor' key:                                                           ║
 * ║    wakaPAC('editor1', { msgProc }, { ckeditor: { toolbar: 'Basic' } })               ║
 * ║                                                                                      ║
 * ║  Messages dispatched:                                                                ║
 * ║    MSG_EDITOR_READY    — editor is fully initialized; extended.value = initial HTML  ║
 * ║    MSG_EDITOR_ERROR    — script failed to load; extended.message                     ║
 * ║    MSG_CHANGE          — toolbar action or committed edit; extended.value            ║
 * ║    MSG_INPUT           — per-keystroke update; extended.value                        ║
 * ║    MSG_INPUT_COMPLETE  — editing session ended (on blur); extended.value             ║
 * ║    MSG_PASTE           — fired before paste is inserted; extended.html = paste       ║
 * ║                          content (text/plain, rtf, uris, files unavailable in CK4).  ║
 * ║                          Return false from msgProc to cancel the paste.              ║
 * ║    MSG_SETFOCUS        — editor gained focus (standard WakaPAC message)              ║
 * ║    MSG_KILLFOCUS       — editor lost focus   (standard WakaPAC message)              ║
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
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // =========================================================================
    // CKEditor 4 script bootstrap
    // =========================================================================
    // CKEditor 4 is a single shared global (window.CKEDITOR). We inject its
    // script tag once and resolve all pending component initializations from a
    // polling check on load. If CKEDITOR is already present on the page when
    // the first component is created, we skip injection entirely.
    // =========================================================================

    /**
     * CDN URLs for each supported CKEditor 4 variant.
     * 'free' is the last version available under the open-source license.
     * 'lts'  is the commercial Long-Term Support track (4.23.0+) and requires
     *         a valid licenseKey passed via plugin options.
     * @type {Object<string, string>}
     */
    const CKEDITOR_CDN = {
        free: 'https://cdn.ckeditor.com/4.22.1/standard/ckeditor.js',
        lts:  'https://cdn.ckeditor.com/4.25.1-lts/standard/ckeditor.js'
    };

    /**
     * True once window.CKEDITOR is available and ready to use.
     * @type {boolean}
     */
    let _apiReady = false;

    /**
     * Queue of pending component descriptors created before the CKEditor
     * script finished loading.
     * @type {Array<{ abstraction: Object, pacId: string, pac: Object, msgConstants: Object, editorConfig: Object }>}
     */
    const _pendingInits = [];

    /**
     * The src option captured from wakaPAC.use(WakaCKEditor, { src }) so that
     * ensureApiLoaded can reference it without being called with arguments.
     * Set once during createPacPlugin.
     * @type {string}
     */
    let _scriptSrc = CKEDITOR_CDN.free;

    /**
     * Whether to suppress CKEditor's version security warning by setting
     * CKEDITOR.config.versionCheck = false after the script loads.
     * Only meaningful for the free build — the LTS build does not show this
     * warning. Disabled by default; opt in via { suppressVersionCheck: true }.
     * @type {boolean}
     */
    let _suppressVersionCheck = false;

    /**
     * Injects the CKEditor 4 script tag and drains the pending queue once it
     * loads. Safe to call multiple times — only injects the tag once.
     * If window.CKEDITOR already exists, drains the queue immediately.
     */
    function ensureApiLoaded() {
        // CKEditor is already on the page (loaded externally or previously injected).
        if (window.CKEDITOR) {
            _apiReady = true;
            drainPendingInits();
            return;
        }

        // Script tag already injected; the load handler will drain the queue.
        if (document.getElementById('waka-ckeditor-script')) {
            return;
        }

        const tag = document.createElement('script');
        tag.id = 'waka-ckeditor-script';
        tag.src = _scriptSrc;

        // CKEditor 4 is synchronous — CKEDITOR is available immediately after
        // the script executes, so no further readiness polling is needed.
        tag.onload = function () {
            // Suppress the "this version is not secure" console warning when
            // explicitly opted in. Only applied for the free build — the LTS
            // build does not emit this warning.
            if (_suppressVersionCheck) {
                CKEDITOR.config.versionCheck = false;
            }

            _apiReady = true;
            drainPendingInits();
        };

        // Error handling when CKEditor couldn't be loaded
        tag.onerror = function () {
            for (const pending of _pendingInits) {
                pending.pac.sendMessage(
                    pending.pacId,
                    pending.msgConstants.MSG_EDITOR_ERROR,
                    0, 0,
                    {
                        message: 'CKEditor 4 script failed to load'
                    }
                );
            }

            _pendingInits.length = 0;
        };

        (document.head ?? document.body).appendChild(tag);
    }

    /**
     * Initializes all queued components now that CKEDITOR is available.
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
     * Registry of active CKEditor components keyed by pacId.
     * @type {Map<string, {
     *   pac:          Object,
     *   editor:       CKEDITOR.editor,
     *   abstraction:  Object,
     *   msgConstants: Object
     * }>}
     */
    const _registry = new Map();

    // =========================================================================
    // Editor construction
    // =========================================================================

    /**
     * Instantiates a CKEditor 4 instance on the container textarea and
     * registers it. Called immediately if CKEDITOR is already available, or
     * deferred via _pendingInits if the script is still loading.
     * @param {Object} abstraction
     * @param {string} pacId
     * @param {Object} pac
     * @param {Object} msgConstants
     * @param {Object} editorConfig - Merged plugin-level and per-instance config
     */
    function createEditor(abstraction, pacId, pac, msgConstants, editorConfig) {
        // Fetch the container
        const container = pac.getContainerByPacId(pacId);

        // Guard: component may have been destroyed while waiting for the script.
        if (!container || !container.isConnected) {
            return;
        }

        // Add container to registry
        const entry = {
            pac,
            editor: null,
            abstraction,
            msgConstants
        };

        _registry.set(pacId, entry);

        // CKEDITOR.replace() hides the textarea and inserts the editor UI
        // adjacent to it. The textarea keeps its name and is synced by
        // CKEditor's built-in form submission hook.
        const editor = CKEDITOR.replace(container, editorConfig);
        entry.editor = editor;

        // Message when CKEditor is ready to go
        editor.on('instanceReady', function () {
            const value = editor.getData();
            pac.sendMessage(pacId, msgConstants.MSG_EDITOR_READY, 0, 0, { value });
        });

        // Fires for toolbar actions, programmatic changes, and committed edits.
        editor.on('change', function () {
            const value = editor.getData();
            pac.sendMessage(pacId, pac.MSG_CHANGE, 0, 0, { value });
        });

        // CKEditor 4's 'key' event fires before the editable DOM is updated.
        // pac.postMessage defers delivery asynchronously so getData() reads the
        // committed post-keystroke content.
        // MSG_INPUT signals an in-progress edit, consistent with how WakaPAC uses
        // it on native inputs. MSG_CHANGE will follow once CKEditor commits.
        editor.on('key', function () {
            pac.postMessage(pacId, pac.MSG_INPUT, 0, 0, { value: editor.getData() });
        });

        // beforePaste fires before CKEditor inserts the pasted content, allowing
        // msgProc to cancel the paste by returning false.
        //
        // CKEditor 4's beforePaste event does not expose the native ClipboardEvent,
        // so the full clipboard payload (text/plain, rtf, files, uris) is not
        // accessible. We populate what CKEditor does provide: evt.data.dataValue
        // is the processed HTML paste content. All other detail fields are empty.
        // The domEvent is present only when the paste was triggered by the user
        // (not programmatic), so modifier keys are extracted defensively.
        editor.on('beforePaste', function (evt) {
            if (!_registry.has(pacId)) {
                return;
            }

            const domEvent = evt.data.domEvent?.$ ?? null;
            const html    = evt.data.dataValue ?? '';

            // Strip tags to derive a plain-text equivalent from the HTML payload.
            // CKEditor 4 does not expose the native ClipboardEvent, so this is
            // the closest approximation available.
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const plain = tmp.textContent ?? tmp.innerText ?? '';

            const detail = {
                'text/plain':    plain,
                'text/html':     html,
                'text/rtf':      '',
                'text/uri-list': '',
                uris:            [],
                files:           [],
                types:           html ? ['text/html'] : []
            };

            const result = pac.sendMessage(
                pacId,
                pac.MSG_PASTE,
                domEvent
                    ? ((domEvent.ctrlKey  ? pac.MK_CONTROL : 0) |
                       (domEvent.shiftKey ? pac.MK_SHIFT   : 0) |
                       (domEvent.altKey   ? pac.MK_ALT     : 0))
                    : 0,
                plain.length,
                detail
            );

            if (result === false) {
                evt.cancel();
            }
        });

        // afterPaste fires once the paste pipeline has completed and the content
        // is in the editor. Mirrors the MSG_INPUT_COMPLETE that fires on blur so
        // that paste is treated as a completed input operation, consistent with
        // WakaPAC's documented behaviour for native elements.
        editor.on('afterPaste', function () {
            if (!_registry.has(pacId)) {
                return;
            }

            const value = editor.getData();
            pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, { value });
        });

        // Message sent when editor gets focus
        editor.on('focus', function () {
            pac.sendMessage(pacId, pac.MSG_SETFOCUS, 0, 0);
        });

        // Message sent when editor loses focus
        editor.on('blur', function () {
            // Sync value on blur — this is the point at which CKEditor 4 also
            // updates the source textarea, so the two are always consistent.
            const value = editor.getData();

            // MSG_INPUT_COMPLETE signals that editing is done for this interaction,
            // then MSG_KILLFOCUS signals the loss of focus itself.
            pac.sendMessage(pacId, pac.MSG_INPUT_COMPLETE, 0, 0, { value });
            pac.sendMessage(pacId, pac.MSG_KILLFOCUS, 0, 0);
        });
    }

    // =========================================================================
    // Plugin definition
    // =========================================================================

    window.WakaCKEditor = {

        /**
         * Called on plugin initialization through wakaPAC.use()
         * @param pac
         * @param options
         * @returns {{onComponentCreated(Object, string, Object): void, onComponentDestroyed(string): void}}
         */
        createPacPlugin(pac, options = {}) {

            // Resolve the script URL.
            // 'src' takes precedence; otherwise 'lts' selects the commercial LTS
            // build (requires licenseKey), and the default is the free 4.22.1 build.
            if (options.src) {
                _scriptSrc = options.src;
            } else if (options.license === 'lts') {
                _scriptSrc = CKEDITOR_CDN.lts;
            }

            // suppressVersionCheck is only meaningful for the free build.
            // The LTS build does not emit this warning, so the option is ignored
            // when license === 'lts' or a custom src is provided.
            if (options.suppressVersionCheck === true && !options.src && options.license !== 'lts') {
                _suppressVersionCheck = true;
            }

            // Plugin-level CKEditor config defaults, overridable per-instance
            // via the 'ckeditor' key in the component config object.
            // licenseKey is required when using the LTS build.
            const _defaultEditorConfig = {
                toolbar: options.toolbar ?? 'Full',
                language: options.language ?? undefined,
                licenseKey: options.licenseKey ?? undefined
            };

            // Strip keys with undefined values so CKEditor doesn't see them.
            Object.keys(_defaultEditorConfig).forEach(function (key) {
                if (_defaultEditorConfig[key] === undefined) {
                    delete _defaultEditorConfig[key];
                }
            });

            // Derive message constants from the host's MSG_PLUGIN base.
            const MSG_EDITOR_READY  = pac.MSG_PLUGIN + 0x200;
            const MSG_EDITOR_ERROR  = pac.MSG_PLUGIN + 0x201;

            // Attach constants so components can reference WakaCKEditor.MSG_EDITOR_READY etc.
            this.MSG_EDITOR_READY  = MSG_EDITOR_READY;
            this.MSG_EDITOR_ERROR  = MSG_EDITOR_ERROR;

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

                    // Only activate for <textarea> elements carrying data-ckeditor.
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
                        _pendingInits.push({ abstraction, pacId, pac, msgConstants, editorConfig });
                    }
                },

                /**
                 * Called by WakaPAC when a component is destroyed.
                 * Removes any pending init from the queue, destroys the CKEditor
                 * instance, and removes the registry entry.
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

                    // CKEditor.destroy() restores the original textarea to the DOM
                    // with its current content, which is the correct state to leave
                    // behind when a field is removed from the page.
                    entry.editor.destroy();

                    // Remove cKeditor from the registry
                    _registry.delete(pacId);
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
         * Sets the editor content. Triggers a change event, which dispatches MSG_CHANGE.
         * @param {string} pacId
         * @param {string} html
         */
        setValue(pacId, html) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            // setData accepts an optional callback but change events fire normally,
            // so MSG_CHANGE us handled by the listener.
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
         * @param {string} pacId
         * @param {boolean} readOnly
         */
        setReadOnly(pacId, readOnly) {
            const entry = _registry.get(pacId);

            if (!entry) {
                return;
            }

            entry.editor.setReadOnly(Boolean(readOnly));
        }
    };

})();