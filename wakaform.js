/*
 * ╔══════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                  ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ███████╗ ██████╗ ██████╗ ███╗   ███╗          ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██╔═══██╗██╔══██╗████╗ ████║          ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║█████╗  ██║   ██║██████╔╝██╔████╔██║          ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║          ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║          ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝          ║
 * ║                                                                                  ║
 * ║  WakaForm - Reactive Form Plugin for wakaPAC                                     ║
 * ║                                                                                  ║
 * ║  Provides reactive form state with field-level validation, dirty tracking,       ║
 * ║  and configurable error visibility. Self-contained — no dependency on            ║
 * ║  wakaStore.                                                                      ║
 * ║                                                                                  ║
 * ║  Usage:                                                                          ║
 * ║    wakaPAC.use(wakaForm);                                                        ║
 * ║                                                                                  ║
 * ║    const form = wakaForm.createForm({                                            ║
 * ║        username: { value: '', rules: [new NotBlank(), new Email()] },            ║
 * ║        password: { value: '', rules: [new NotBlank(), new MinLength(8)] }        ║
 * ║    });                                                                           ║
 * ║                                                                                  ║
 * ║    wakaPAC('#login', { form });                                                  ║
 * ║                                                                                  ║
 * ║  Field state (reactive):                                                         ║
 * ║    form.username.value    — current value                                        ║
 * ║    form.username.error    — null, or error message string                        ║
 * ║    form.username.touched  — true after touch() is called on this field           ║
 * ║    form.username.dirty    — true when value differs from initial                 ║
 * ║                                                                                  ║
 * ║  Form state (reactive):                                                          ║
 * ║    form.valid   — true when all fields pass validation                           ║
 * ║    form.dirty   — true when any field is dirty                                   ║
 * ║                                                                                  ║
 * ║  Methods:                                                                        ║
 * ║    form.validate()        — run all rules, expose errors, update form.valid      ║
 * ║    form.reset()           — restore initial values, clear errors and touched     ║
 * ║    form.values()          — plain object of { fieldName: currentValue }          ║
 * ║    form.touch(fieldName)  — mark field as touched (validateOn: 'touch' only)     ║
 * ║                                                                                  ║
 * ║  Options:                                                                        ║
 * ║    validateOn: 'submit'   — errors shown only after form.validate() is called    ║
 * ║    validateOn: 'touch'    — errors shown per-field after form.touch(field)       ║
 * ║                                                                                  ║
 * ║  Built-in rules:                                                                 ║
 * ║    new NotBlank()                                                                ║
 * ║    new Email()                                                                   ║
 * ║    new Min(n)                                                                    ║
 * ║    new Max(n)                                                                    ║
 * ║    new MinLength(n)                                                              ║
 * ║    new MaxLength(n)                                                              ║
 * ║    new Pattern(regex, message)                                                   ║
 * ║                                                                                  ║
 * ║  Custom rules:                                                                   ║
 * ║    Any object with a validate(value) method that returns null or an error        ║
 * ║    message string.                                                               ║
 * ║                                                                                  ║
 * ║  Typical submit pattern:                                                         ║
 * ║    submit() {                                                                    ║
 * ║        form.validate();                                                          ║
 * ║        if (!form.valid) return;                                                  ║
 * ║        this._http.post('/api/login', form.values());                             ║
 * ║    }                                                                             ║
 * ║                                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    /** @type {string} */
    const VERSION = '1.0.0';

    /**
     * Event fired on document when any form field mutates.
     * Carries the formId and field-relative path of the change.
     * @type {string}
     */
    const FORM_CHANGED_EVENT = 'pac:form-changed';

    /**
     * Non-enumerable flag set on every form proxy so wakaPAC's proxyGetHandler
     * returns it as-is rather than wrapping it in a second reactive proxy.
     * @type {string}
     */
    const EXTERNAL_PROXY_FLAG = '_externalProxy';

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Returns true if the property should trigger reactivity.
     * Properties starting with _ or $ are non-reactive.
     * @param {string|symbol} prop
     * @returns {boolean}
     */
    function isReactive(prop) {
        return typeof prop === 'string' && prop[0] !== '_' && prop[0] !== '$';
    }

    /**
     * Returns true if val is a plain object.
     * @param {*} val
     * @returns {boolean}
     */
    function isPlainObject(val) {
        return !!val && typeof val === 'object' && Object.getPrototypeOf(val) === Object.prototype;
    }

    /**
     * Marks obj with _externalProxy = true so wakaPAC will not re-wrap it.
     * Uses a WeakSet to guard against cyclic graphs.
     * @param {Object} obj
     * @param {WeakSet} [seen=new WeakSet()]
     */
    function markExternalProxy(obj, seen = new WeakSet()) {
        if (!obj || typeof obj !== 'object' || obj[EXTERNAL_PROXY_FLAG] || seen.has(obj)) {
            return;
        }

        // Track this object before recursing to break cycles.
        seen.add(obj);

        // Non-enumerable so the flag is invisible to templates and Object.keys().
        Object.defineProperty(obj, EXTERNAL_PROXY_FLAG, {
            value: true,
            enumerable: false,
            writable: false,
            configurable: false
        });

        // Recurse into nested objects so deep sub-trees are also flagged.
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                markExternalProxy(obj[key], seen);
            }
        }
    }

    // ─── Built-in validation rules ────────────────────────────────────────────────

    /**
     * Fails if the value is empty (null, undefined, empty string, or whitespace only).
     * @param {string} [message='This field is required']
     */
    function NotBlank(message) {
        this.message = message || 'This field is required';
    }

    NotBlank.prototype.validate = function (value) {
        // Coerce to string so numeric 0 is not treated as blank.
        return (value === null || value === undefined || String(value).trim() === '')
            ? this.message
            : null;
    };

    /**
     * Fails if the value is not a valid email address.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {string} [message='Must be a valid email address']
     */
    function Email(message) {
        this.message = message || 'Must be a valid email address';
    }

    Email.prototype.validate = function (value) {
        // Let NotBlank() own the empty-value case; Email only checks format.
        if (value === null || value === undefined || String(value).trim() === '') {
            return null;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
            ? null
            : this.message;
    };

    /**
     * Fails if the numeric value is less than n.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     * @param {string} [message]
     */
    function Min(n, message) {
        this.n       = n;
        this.message = message || 'Must be at least ' + n;
    }

    Min.prototype.validate = function (value) {
        // Empty string / null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const num = Number(value);

        // Non-numeric input fails with the same message as an out-of-range value.
        if (Number.isNaN(num)) {
            return this.message;
        }

        return num >= this.n ? null : this.message;
    };

    /**
     * Fails if the numeric value is greater than n.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     * @param {string} [message]
     */
    function Max(n, message) {
        this.n       = n;
        this.message = message || 'Must be at most ' + n;
    }

    Max.prototype.validate = function (value) {
        // Empty string / null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const num = Number(value);

        // Non-numeric input fails with the same message as an out-of-range value.
        if (Number.isNaN(num)) {
            return this.message;
        }

        return num <= this.n ? null : this.message;
    };

    /**
     * Fails if the string length is less than n characters.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     * @param {string} [message]
     */
    function MinLength(n, message) {
        this.n       = n;
        this.message = message || 'Must be at least ' + n + ' characters';
    }

    MinLength.prototype.validate = function (value) {
        // Treat null/undefined as zero-length rather than throwing on String() coercion.
        if (value === null || value === undefined) {
            return null;
        }

        return String(value).length >= this.n ? null : this.message;
    };

    /**
     * Fails if the string length is greater than n characters.
     * @param {number} n
     * @param {string} [message]
     */
    function MaxLength(n, message) {
        this.n       = n;
        this.message = message || 'Must be at most ' + n + ' characters';
    }

    MaxLength.prototype.validate = function (value) {
        // Empty null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined) {
            return null;
        }

        return String(value).length <= this.n ? null : this.message;
    };

    /**
     * Fails if the value does not match the given regular expression.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {RegExp} regex
     * @param {string} [message='Invalid format']
     */
    function Pattern(regex, message) {
        this.regex = regex;
        this.message = message || 'Invalid format';
    }

    Pattern.prototype.validate = function (value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        // Reset lastIndex before each test — required for regexes with the g or y flag,
        // where .test() is stateful and advances lastIndex on successive calls.
        this.regex.lastIndex = 0;

        return this.regex.test(String(value)) ? null : this.message;
    };

    // ─── WakaForm ─────────────────────────────────────────────────────────────────

    /**
     * WakaForm — Reactive Form Plugin
     * @constructor
     */
    function WakaForm() {
        /** @type {number} */
        this._nextFormId = 1;

        /**
         * Maps formId -> Map<pacId, { key: string, container: Element }>
         * @type {Map<string, Map<string, { key: string, container: Element }>>}
         */
        this._registry = new Map();
    }

    /**
     * WakaForm prototype methods.
     *
     * createPacPlugin() — called by wakaPAC.use(wakaForm). Returns the plugin
     * descriptor that registers and deregisters component subscriptions.
     *
     * createForm(schema, opts) — creates a new reactive form proxy.
     *   schema is { fieldName: { value, rules } }
     *   opts.validateOn  'submit' (default) | 'touch'
     */
    WakaForm.prototype = {
        constructor: WakaForm,

        /**
         * Creates a wakaPAC plugin descriptor.
         *
         * Architecture mirrors WakaStore: form proxies fire pac:form-changed on
         * document on every mutation. The plugin listener translates the formId
         * to subscriber containers and dispatches pac:change on each one.
         *
         * Required change in wakaPAC's proxyGetHandler (same as wakaStore):
         *
         *   if (val && val._externalProxy) { return val; }
         *
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin() {
            const registry = this._registry;

            /**
             * Scans the raw abstraction for form references.
             * A form reference is any property tagged with a non-enumerable _wakaFormId.
             * @param {Object} rawAbstraction
             * @returns {Array<{key: string, formId: string}>}
             */
            function findFormReferences(rawAbstraction) {
                const entries = [];

                for (const key of Object.keys(rawAbstraction)) {
                    const val = rawAbstraction[key];

                    // _wakaFormId is set non-enumerable on the form proxy root;
                    // reading it here works because originalAbstraction is the raw
                    // object before wakaPAC wrapped it, so the tag is still readable.
                    if (val && typeof val === 'object' && val._wakaFormId) {
                        entries.push({ key, formId: val._wakaFormId });
                    }
                }

                return entries;
            }

            /**
             * Handles pac:form-changed events fired by form proxies.
             * Dispatches pac:change on each subscriber container so wakaPAC
             * re-renders the relevant bindings.
             * @param {CustomEvent} event
             */
            function onFormChanged(event) {
                const { formId, path, oldValue, newValue } = event.detail;
                const subscribers = registry.get(formId);

                // No subscribers for this form — nothing to do.
                if (!subscribers || subscribers.size === 0) {
                    return;
                }

                subscribers.forEach(function ({ key, container }) {
                    // Prepend the abstraction key so wakaPAC resolves the path
                    // from the component root, e.g. ['form', 'username', 'value'].
                    container.dispatchEvent(new CustomEvent('pac:change', {
                        detail: {
                            path: [key].concat(path),
                            oldValue: oldValue,
                            newValue: newValue
                        }
                    }));
                });
            }

            document.addEventListener(FORM_CHANGED_EVENT, onFormChanged);

            return {
                /**
                 * Registers the component's form subscriptions.
                 * @param {Object} abstraction
                 * @param {string} pacId
                 */
                onComponentCreated(abstraction, pacId) {
                    const context = window.PACRegistry.get(pacId);

                    if (!context || !context.originalAbstraction) {
                        return;
                    }

                    const formEntries = findFormReferences(context.originalAbstraction);

                    // Skip if no form references or if the container isn't in the DOM yet.
                    if (formEntries.length === 0 || !context.container) {
                        return;
                    }

                    for (const { key, formId } of formEntries) {
                        // Lazily create the subscriber map for this form on first use.
                        if (!registry.has(formId)) {
                            registry.set(formId, new Map());
                        }

                        // key is the property name under which the form is mounted
                        // (e.g. 'form' in wakaPAC('#login', { form })). onFormChanged
                        // prepends it to the mutation path so wakaPAC can resolve bindings.
                        registry.get(formId).set(pacId, { key, container: context.container });
                    }
                },

                /**
                 * Removes the component from all form subscriptions.
                 * @param {string} pacId
                 */
                onComponentDestroyed(pacId) {
                    registry.forEach(function (subscribers, formId) {
                        subscribers.delete(pacId);

                        // Remove the form's subscriber map entirely once it has no listeners
                        // to avoid accumulating empty maps for long-lived applications.
                        if (subscribers.size === 0) {
                            registry.delete(formId);
                        }
                    });
                }
            };
        },

        /**
         * Creates a new reactive form from a schema.
         *
         * Each field in the schema produces a reactive sub-object with value,
         * error, touched, and dirty properties. The form proxy also exposes
         * form-level valid and dirty computed properties.
         *
         * On any mutation, fires pac:form-changed on document with the formId
         * and the form-relative path of the change.
         *
         * @param {Object} schema                    - { fieldName: { value, rules } }
         *                                             Field values must be primitives
         *                                             (string, number, boolean, null, or undefined).
         *                                             Object values are not supported — dirty
         *                                             tracking uses strict equality (===).
         * @param {Object}  [opts]                   - Optional configuration
         * @param {string}  [opts.validateOn='submit'] - When to expose field errors.
         *                                             'submit': after form.validate() is called.
         *                                             'touch':  after form.touch(fieldName) is called.
         * @returns {Proxy} Form proxy
         */
        createForm(schema, opts) {
            if (!isPlainObject(schema)) {
                throw new Error('wakaForm.createForm(): schema must be a plain object');
            }

            opts = opts || {};

            const validateOn = opts.validateOn === 'touch' ? 'touch' : 'submit';
            const formId     = 'form-' + (this._nextFormId++);

            // ── Extract field names and rules, build raw state ────────────────────

            /**
             * Rules are stored outside the reactive state — they are never
             * proxied, serialized, or visible to templates.
             * @type {Object.<string, Array>}
             */
            const fieldRules = {};

            /**
             * Validity cache — stores the raw runRules() result for each field,
             * independent of error visibility. Used by recomputeFormState() to
             * determine form.valid without re-running all rules on every keystroke.
             * Keyed by field name, value is true (valid) or false (invalid).
             * @type {Object.<string, boolean>}
             */
            const fieldValid = {};

            /**
             * Initial values stored for dirty tracking and reset().
             * @type {Object.<string, *>}
             */
            const initialValues = {};

            /**
             * Raw state object that the proxy wraps.
             * Shape:
             *   {
             *     fieldName: { value, error, touched, dirty },
             *     ...
             *     valid: boolean,
             *     dirty: boolean
             *   }
             */
            const state = {};

            for (const fieldName of Object.keys(schema)) {
                const fieldDef = schema[fieldName];

                if (!isPlainObject(fieldDef)) {
                    throw new Error('wakaForm.createForm(): field "' + fieldName + '" must be a plain object with value and rules');
                }

                // Default to empty string if value is omitted from the field definition.
                const rules        = Array.isArray(fieldDef.rules) ? fieldDef.rules : [];
                const initialValue = fieldDef.value !== undefined ? fieldDef.value : '';

                // Object values break dirty tracking — === always returns false for distinct
                // object references. Fail early with a clear message rather than silently
                // producing wrong dirty state at runtime.
                if (initialValue !== null && typeof initialValue === 'object') {
                    throw new Error('wakaForm.createForm(): field "' + fieldName + '" value must be a primitive (string, number, boolean, null, or undefined). Object values are not supported — dirty tracking uses strict equality.');
                }

                fieldRules[fieldName]    = rules;
                initialValues[fieldName] = initialValue;

                state[fieldName] = {
                    value:   initialValue,
                    error:   null,
                    touched: false,
                    dirty:   false
                };
            }

            // Form-level computed properties
            state.valid = true;
            state.dirty = false;

            // ── Reactivity ────────────────────────────────────────────────────────

            /**
             * Reentrancy guard — prevents notification loops when derived state
             * (valid, dirty, error) is written back during a field mutation.
             * @type {boolean}
             */
            let notifying = false;

            /**
             * Whether validate() has been called at least once.
             * Controls error visibility in 'submit' mode — errors are hidden
             * until the first validate() call, then live on every keystroke.
             * @type {boolean}
             */
            let validateCalled = false;

            /**
             * Fires pac:form-changed on document with the form-relative path.
             * @param {string[]} path
             * @param {*} oldValue
             * @param {*} newValue
             */
            function notify(path, oldValue, newValue) {
                // Guard against re-entrant notifications triggered by derived state
                // writes (error, dirty, valid) that happen inside the event handler.
                if (notifying) {
                    return;
                }

                notifying = true;

                try {
                    document.dispatchEvent(new CustomEvent(FORM_CHANGED_EVENT, {
                        detail: { formId, path, oldValue, newValue }
                    }));
                } finally {
                    // Always reset the flag, even if a listener throws.
                    notifying = false;
                }
            }

            /**
             * WeakMap cache — the same raw object always returns the same proxy.
             * Stable references prevent spurious change detection on repeated reads.
             * @type {WeakMap<Object, Proxy>}
             */
            const proxyCache = new WeakMap();

            /**
             * Wraps obj in a reactive proxy, returning the cached instance if one
             * already exists.
             * @param {Object} obj
             * @param {string[]} currentPath
             * @returns {Proxy}
             */
            function createProxy(obj, currentPath) {
                if (proxyCache.has(obj)) {
                    return proxyCache.get(obj);
                }

                markExternalProxy(obj);

                const proxy = new Proxy(obj, {
                    get(target, prop) {
                        // Expose _wakaFormId on the root proxy so findFormReferences
                        // can identify form references in originalAbstraction.
                        if (prop === '_wakaFormId') {
                            return formId;
                        }

                        const val = target[prop];

                        // Lazily wrap nested plain objects for deep reactivity.
                        if (isReactive(prop) && isPlainObject(val)) {
                            return createProxy(val, currentPath.concat([prop]));
                        }

                        return val;
                    },

                    set(target, prop, newValue) {
                        const oldValue = target[prop];

                        // Skip if the value hasn't actually changed.
                        if (oldValue === newValue) {
                            return true;
                        }

                        // Ensure incoming objects are flagged before they enter the proxy tree.
                        if (newValue && typeof newValue === 'object') {
                            markExternalProxy(newValue);
                        }

                        const success = Reflect.set(target, prop, newValue);

                        // Only notify if the write succeeded — non-configurable / non-writable
                        // properties will return false from Reflect.set.
                        if (success && isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, newValue);
                        }

                        return success;
                    },

                    deleteProperty(target, prop) {
                        if (!(prop in target)) {
                            return true;
                        }

                        const oldValue = target[prop];
                        const deleted  = Reflect.deleteProperty(target, prop);

                        // Only notify if the delete actually succeeded.
                        if (deleted && isReactive(prop)) {
                            notify(currentPath.concat([prop]), oldValue, undefined);
                        }

                        return deleted;
                    }
                });

                proxyCache.set(obj, proxy);
                return proxy;
            }

            // Tag state so onComponentCreated can identify it when scanning
            // originalAbstraction. Non-enumerable so templates never see it.
            Object.defineProperty(state, '_wakaFormId', {
                value: formId,
                enumerable: false,
                writable: false,
                configurable: false
            });

            const proxy = createProxy(state, []);

            // ── Validation helpers ────────────────────────────────────────────────

            /**
             * Runs all rules for a single field and returns the first error
             * message, or null if all rules pass.
             * @param {string} fieldName
             * @returns {string|null}
             */
            function runRules(fieldName) {
                const rules = fieldRules[fieldName];
                const value = state[fieldName].value;

                for (const rule of rules) {
                    // Skip malformed entries rather than throwing — warn so the
                    // developer can spot the mistake in the console.
                    if (!rule || typeof rule.validate !== 'function') {
                        console.warn('wakaForm: invalid rule in field "' + fieldName + '" — expected an object with a validate() method:', rule);
                        continue;
                    }

                    const error = rule.validate(value);

                    // First failing rule wins — update the cache and return immediately.
                    if (error !== null && error !== undefined) {
                        fieldValid[fieldName] = false;
                        return String(error);
                    }
                }

                // All rules passed.
                fieldValid[fieldName] = true;
                return null;
            }

            /**
             * Recomputes form-level valid and dirty from current field state.
             * Writes back through the proxy so subscribers are notified.
             * valid reflects actual rule results regardless of error visibility —
             * form.valid is always accurate, even before errors are shown.
             *
             * @param {string} [changedField] - When supplied, runRules is only called
             *   for the changed field; all other fields read from the fieldValid cache.
             *   Omit to force a full recompute — needed after validate() and reset()
             *   where all fields change at once.
             */
            function recomputeFormState(changedField) {
                let allValid = true;
                let anyDirty = false;

                for (const fieldName of Object.keys(fieldRules)) {
                    // Full recompute (no changedField): run rules for every field.
                    // Partial recompute (changedField supplied): only re-run rules
                    // for the changed field; all others read from the fieldValid cache,
                    // which is always current because runRules() updates it as a side effect.
                    if (changedField === undefined || fieldName === changedField) {
                        runRules(fieldName);
                    }

                    if (!fieldValid[fieldName]) {
                        allValid = false;
                    }

                    if (state[fieldName].dirty) {
                        anyDirty = true;
                    }
                }

                proxy.valid = allValid;
                proxy.dirty = anyDirty;
            }

            /**
             * Updates a single field's error visibility.
             *
             * submit mode: error shown only after validate() has been called.
             * touch mode:  error shown after the field has been touched.
             *
             * In both modes, once errors are visible for a field they update
             * live on every subsequent value change.
             *
             * @param {string} fieldName
             */
            function updateFieldError(fieldName) {
                const field      = state[fieldName];
                const shouldShow = validateOn === 'submit' ? validateCalled : field.touched;
                proxy[fieldName].error = shouldShow ? runRules(fieldName) : null;
            }

            // ── Wire value changes to validation and dirty tracking ───────────────

            // Listen for field value changes on document to run validation and
            // update derived state whenever a value mutates. Filter by formId
            // so mutations from other forms are ignored.
            document.addEventListener(FORM_CHANGED_EVENT, function (event) {
                const detail = event.detail;

                if (detail.formId !== formId) {
                    return;
                }

                // path is e.g. ['username', 'value'] — we only react to value changes.
                // Writes to error, touched, dirty, valid are derived state and must
                // not re-trigger this handler (notifying guard in notify() prevents
                // the loop, but filtering here is cleaner and avoids unnecessary work).
                const path = detail.path;

                if (path.length !== 2 || path[1] !== 'value') {
                    return;
                }

                const fieldName = path[0];

                if (!(fieldName in fieldRules)) {
                    return;
                }

                // Update dirty: true if current value differs from initial
                proxy[fieldName].dirty = state[fieldName].value !== initialValues[fieldName];

                // Update error visibility for this field
                updateFieldError(fieldName);

                // Recompute form-level valid and dirty — only re-runs rules for
                // the changed field; all others are inferred from existing error state.
                recomputeFormState(fieldName);
            });

            // ── Public methods ────────────────────────────────────────────────────

            /**
             * Runs all validation rules, exposes errors on all fields, and
             * updates form.valid.
             *
             * In 'submit' mode this is the trigger that makes errors visible —
             * call it at the start of your submit handler, then check form.valid:
             *
             *   submit() {
             *       form.validate();
             *       if (!form.valid) return;
             *       this._http.post('/api/login', form.values());
             *   }
             *
             * In 'touch' mode, validate() still works and can be used to force
             * all errors visible at once (e.g. on a final review step).
             */
            Object.defineProperty(proxy, 'validate', {
                enumerable: false,
                configurable: true,
                value: function () {
                    // Flip the flag so updateFieldError() starts exposing errors.
                    validateCalled = true;

                    for (const fieldName of Object.keys(fieldRules)) {
                        updateFieldError(fieldName);
                    }

                    // Full recompute — all fields may now have different error visibility.
                    recomputeFormState();
                }
            });

            /**
             * Restores all fields to their initial values and clears errors,
             * touched flags, and dirty flags. Resets validateCalled so errors
             * are hidden again until the next validate() call.
             * Useful after a successful submit to return the form to a clean state.
             */
            Object.defineProperty(proxy, 'reset', {
                enumerable: false,
                configurable: true,
                value: function () {
                    // Hide errors again until the next validate() call.
                    validateCalled = false;

                    for (const fieldName of Object.keys(fieldRules)) {
                        proxy[fieldName].value   = initialValues[fieldName];
                        proxy[fieldName].error   = null;
                        proxy[fieldName].touched = false;
                        proxy[fieldName].dirty   = false;

                        // Refresh the fieldValid cache now that the value has changed —
                        // the next recomputeFormState() must see accurate results.
                        runRules(fieldName);
                    }

                    // Write final form-level state directly rather than calling
                    // recomputeFormState() — all field state was just set above, and
                    // dirty is always false after a reset.
                    proxy.valid = Object.keys(fieldRules).every(function (fn) { return fieldValid[fn]; });
                    proxy.dirty = false;
                }
            });

            /**
             * Returns a plain object of { fieldName: currentValue } for all fields.
             * Use this to pass form data to an HTTP call without exposing the proxy.
             * @returns {Object}
             */
            Object.defineProperty(proxy, 'values', {
                enumerable: false,
                configurable: true,
                value: function () {
                    const result = {};

                    // Read directly from state rather than the proxy to avoid
                    // triggering get traps on a plain data extraction.
                    for (const fieldName of Object.keys(fieldRules)) {
                        result[fieldName] = state[fieldName].value;
                    }

                    return result;
                }
            });

            /**
             * Marks a field as touched and immediately runs its validation rules,
             * exposing any error in 'touch' mode.
             *
             * In 'submit' mode, touch() still records the touched flag (available
             * for styling) but does not expose the error until validate() is called.
             *
             * Typically called from a blur handler:
             *   <input data-pac-bind="blur: form.touch('username')">
             *
             * @param {string} fieldName
             */
            Object.defineProperty(proxy, 'touch', {
                enumerable: false,
                configurable: true,
                value: function (fieldName) {
                    if (!(fieldName in fieldRules)) {
                        console.warn('wakaForm.touch(): unknown field "' + fieldName + '"');
                        return;
                    }

                    proxy[fieldName].touched = true;

                    // Immediately expose the error for this field in 'touch' mode.
                    // In 'submit' mode this is a no-op for error visibility but still
                    // records the touched flag, which is available for styling.
                    updateFieldError(fieldName);
                    recomputeFormState(fieldName);
                }
            });

            // Compute initial form-level state. All fields start valid if they
            // have no rules or if initial values satisfy all rules. This means
            // form.valid accurately reflects reality from the start, even though
            // errors are not yet visible.
            recomputeFormState();

            return proxy;
        }
    };

    /** @type {string} */
    WakaForm.VERSION = VERSION;

    /** @type {WakaForm} */
    const wakaForm = new WakaForm();

    // Expose built-in rules on the plugin instance so they can be imported
    // alongside wakaForm without polluting the global namespace:
    //   const { NotBlank, Email, MinLength } = wakaForm;
    wakaForm.NotBlank  = NotBlank;
    wakaForm.Email     = Email;
    wakaForm.Min       = Min;
    wakaForm.Max       = Max;
    wakaForm.MinLength = MinLength;
    wakaForm.MaxLength = MaxLength;
    wakaForm.Pattern   = Pattern;

    window.WakaForm = WakaForm;
    window.wakaForm = wakaForm;

    // Also expose rules as globals for convenience when using script tags directly
    window.NotBlank  = NotBlank;
    window.Email     = Email;
    window.Min       = Min;
    window.Max       = Max;
    window.MinLength = MinLength;
    window.MaxLength = MaxLength;
    window.Pattern   = Pattern;

})();