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
 * ║  Provides reactive form state with field-level validation and dirty tracking.    ║
 * ║  Error visibility is left to the template — bind against field.valid directly.   ║
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
 * ║    form.username.valid    — true when all rules pass for this field              ║
 * ║    form.username.dirty    — true when value differs from initial                 ║
 * ║                                                                                  ║
 * ║  Form state (reactive):                                                          ║
 * ║    form.valid   — true when all fields pass validation                           ║
 * ║    form.dirty   — true when any field is dirty                                   ║
 * ║                                                                                  ║
 * ║  Methods:                                                                        ║
 * ║    form.validate()   — recomputes all fields, returns form.valid (boolean)       ║
 * ║    form.reset()      — restores initial values, clears dirty flags               ║
 * ║    form.values()     — plain object of { fieldName: currentValue }               ║
 * ║                                                                                  ║
 * ║  Template pattern:                                                               ║
 * ║    <span data-pac-bind="visible: !form.username.valid">                          ║
 * ║        Username is required                                                      ║
 * ║    </span>                                                                       ║
 * ║                                                                                  ║
 * ║  Typical submit pattern:                                                         ║
 * ║    submit() {                                                                    ║
 * ║        if (!form.validate()) return;                                             ║
 * ║        this._http.post('/api/login', form.values());                             ║
 * ║    }                                                                             ║
 * ║                                                                                  ║
 * ║  Built-in rules:                                                                 ║
 * ║    new NotBlank()                                                                ║
 * ║    new Email()                                                                   ║
 * ║    new Min(n)                                                                    ║
 * ║    new Max(n)                                                                    ║
 * ║    new MinLength(n)                                                              ║
 * ║    new MaxLength(n)                                                              ║
 * ║    new Pattern(regex)                                                            ║
 * ║                                                                                  ║
 * ║  Custom rules:                                                                   ║
 * ║    Any object with a validate(value) method that returns true (valid) or         ║
 * ║    false (invalid).                                                              ║
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
            value:        true,
            enumerable:   false,
            writable:     false,
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
     */
    function NotBlank() {}

    NotBlank.prototype.validate = function (value) {
        // Coerce to string so numeric 0 is not treated as blank.
        return (!(value === null || value === undefined || String(value).trim() === ''));
    };

    /**
     * Fails if the value is not a valid email address.
     * Empty values pass — combine with NotBlank() if the field is required.
     */
    function Email() {}

    Email.prototype.validate = function (value) {
        // Let NotBlank() own the empty-value case; Email only checks format.
        if (value === null || value === undefined || String(value).trim() === '') {
            return true;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    };

    /**
     * Fails if the numeric value is less than n.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     */
    function Min(n) {
        this.n = n;
    }

    Min.prototype.validate = function (value) {
        // Empty string / null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined || value === '') {
            return true;
        }

        const num = Number(value);

        // Non-numeric input fails the same as an out-of-range value.
        if (Number.isNaN(num)) {
            return false;
        }

        return num >= this.n;
    };

    /**
     * Fails if the numeric value is greater than n.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     */
    function Max(n) {
        this.n = n;
    }

    Max.prototype.validate = function (value) {
        // Empty string / null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined || value === '') {
            return true;
        }

        const num = Number(value);

        // Non-numeric input fails the same as an out-of-range value.
        if (Number.isNaN(num)) {
            return false;
        }

        return num <= this.n;
    };

    /**
     * Fails if the string length is less than n characters.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {number} n
     */
    function MinLength(n) {
        this.n = n;
    }

    MinLength.prototype.validate = function (value) {
        // Treat null/undefined as zero-length rather than throwing on String() coercion.
        if (value === null || value === undefined) {
            return true;
        }

        return String(value).length >= this.n;
    };

    /**
     * Fails if the string length is greater than n characters.
     * @param {number} n
     */
    function MaxLength(n) {
        this.n = n;
    }

    MaxLength.prototype.validate = function (value) {
        // Empty null / undefined — let NotBlank() handle the required case.
        if (value === null || value === undefined) {
            return true;
        }

        return String(value).length <= this.n;
    };

    /**
     * Fails if the value does not match the given regular expression.
     * Empty values pass — combine with NotBlank() if the field is required.
     * @param {RegExp} regex
     */
    function Pattern(regex) {
        this.regex = regex;
    }

    Pattern.prototype.validate = function (value) {
        if (value === null || value === undefined || value === '') {
            return true;
        }

        // Reset lastIndex before each test — required for regexes with the g or y flag,
        // where .test() is stateful and advances lastIndex on successive calls.
        this.regex.lastIndex = 0;

        // Run the test
        return this.regex.test(String(value));
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
     * createForm(schema) — creates a new reactive form proxy.
     *   schema is { fieldName: { value, rules } }
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

                // No subscribers for this form — nothing to do.
                const subscribers = registry.get(formId);

                if (!subscribers || subscribers.size === 0) {
                    return;
                }

                // Notify all subscribers
                subscribers.forEach(function ({key, container}) {
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

            // Listen to pac:form-changed event
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
         * valid, and dirty properties. The form proxy also exposes form-level
         * valid and dirty computed properties.
         *
         * On any mutation, fires pac:form-changed on document with the formId
         * and the form-relative path of the change.
         *
         * @param {Object} schema  - { fieldName: { value, rules } }
         *                           Field values must be primitives
         *                           (string, number, boolean, null, or undefined).
         *                           Object values are not supported — dirty
         *                           tracking uses strict equality (===).
         * @returns {Proxy} Form proxy
         */
        createForm(schema) {
            if (!isPlainObject(schema)) {
                throw new Error('wakaForm.createForm(): schema must be a plain object');
            }

            const formId = 'form-' + (this._nextFormId++);

            // ── Extract field names and rules, build raw state ────────────────────

            /**
             * Rules are stored outside the reactive state — they are never
             * proxied, serialized, or visible to templates.
             * @type {Object.<string, Array>}
             */
            const fieldRules = {};

            /**
             * Validity cache — stores the boolean result of running all rules for
             * each field. Updated by runRules() as a side effect and read by
             * recomputeFormState() to determine form.valid efficiently.
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
             *     fieldName: { value, valid, dirty },
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
                    value: initialValue,
                    valid: true,
                    dirty: false
                };
            }

            // Form-level computed properties — accurate initial values set by
            // recomputeFormState() below.
            state.valid = true;
            state.dirty = false;

            // ── Reactivity ────────────────────────────────────────────────────────

            /**
             * Reentrancy guard — prevents notification loops when derived state
             * (valid, dirty) is written back during a field mutation.
             * @type {boolean}
             */
            let notifying = false;

            /**
             * Fires pac:form-changed on document with the form-relative path.
             *
             * Architectural note: notify() fires before derived state (valid, dirty)
             * has been updated. Listeners that re-read state through the proxy — as
             * wakaPAC's renderer does — will always see a consistent snapshot because
             * the renderer re-evaluates all bindings on every pac:change event.
             * Listeners that consume event.detail directly and expect derived state
             * to already be updated will see stale valid/dirty values.
             *
             * @param {string[]} path
             * @param {*} oldValue
             * @param {*} newValue
             */
            function notify(path, oldValue, newValue) {
                // Guard against re-entrant notifications triggered by derived state
                // writes (valid, dirty) that happen inside the event handler.
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

                    deleteProperty(_target, _prop) {
                        // Deletion is never valid on a form proxy — fields are schema-defined,
                        // valid and dirty are derived. There is nothing here worth deleting.
                        throw new Error('wakaForm: deletion is not permitted on form proxies');
                    }
                });

                proxyCache.set(obj, proxy);
                return proxy;
            }

            // Tag state so onComponentCreated can identify it when scanning
            // originalAbstraction. Non-enumerable so templates never see it.
            Object.defineProperty(state, '_wakaFormId', {
                value:        formId,
                enumerable:   false,
                writable:     false,
                configurable: false
            });

            const proxy = createProxy(state, []);

            // ── Validation helpers ────────────────────────────────────────────────

            /**
             * Runs all rules for a single field. Updates the fieldValid cache and
             * writes field.valid through the proxy so bindings are notified.
             * @param {string} fieldName
             */
            function runRules(fieldName) {
                const rules = fieldRules[fieldName];
                const value = state[fieldName].value;
                let   valid = true;

                for (const rule of rules) {
                    // Skip malformed entries rather than throwing — warn so the
                    // developer can spot the mistake in the console.
                    if (!rule || typeof rule.validate !== 'function') {
                        console.warn('wakaForm: invalid rule in field "' + fieldName + '" — expected an object with a validate() method:', rule);
                        continue;
                    }

                    // First failing rule wins — no need to run the rest.
                    // Rules return true (valid) or false (invalid).
                    if (!rule.validate(value)) {
                        valid = false;
                        break;
                    }
                }

                // Update both the cache (read by recomputeFormState) and reactive state.
                fieldValid[fieldName]  = valid;
                proxy[fieldName].valid = valid;
            }

            /**
             * Recomputes form-level valid and dirty from current field state.
             * Writes back through the proxy so subscribers are notified.
             *
             * @param {string} [changedField] - When supplied, runRules is only called
             *   for the changed field; all other fields read from the fieldValid cache,
             *   which is always current because runRules() updates it as a side effect.
             *   Omit to force a full recompute — used on initialisation and in validate().
             */
            function recomputeFormState(changedField) {
                let allValid = true;
                let anyDirty = false;

                for (const fieldName of Object.keys(fieldRules)) {
                    // Full recompute (no changedField): run rules for every field.
                    // Partial recompute (changedField supplied): only re-run for the
                    // changed field; all others read from the fieldValid cache.
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
                // Writes to valid and dirty are derived state and must not re-trigger
                // this handler (the notifying guard in notify() prevents the loop, but
                // filtering here is cleaner and avoids unnecessary work).
                const path = detail.path;

                if (path.length !== 2 || path[1] !== 'value') {
                    return;
                }

                const fieldName = path[0];

                if (!(fieldName in fieldRules)) {
                    return;
                }

                // Update field-level dirty: true if current value differs from initial.
                proxy[fieldName].dirty = state[fieldName].value !== initialValues[fieldName];

                // Recompute form-level valid and dirty — only re-runs rules for the
                // changed field; all others read from the fieldValid cache.
                recomputeFormState(fieldName);
            });

            // ── Public methods ────────────────────────────────────────────────────

            /**
             * Runs all validation rules, updates all field.valid flags, updates
             * form.valid, and returns form.valid as a boolean. Convenient for
             * use directly in a submit guard:
             *
             *   submit() {
             *       if (!form.validate()) return;
             *       this._http.post('/api/login', form.values());
             *   }
             *
             * @returns {boolean}
             */
            Object.defineProperty(proxy, 'validate', {
                enumerable:   false,
                configurable: true,
                value: function () {
                    // Full recompute — runs rules for every field and refreshes all state.
                    recomputeFormState();

                    // Force-notify all fields so WakaPAC re-evaluates visible: bindings
                    // even when valid hasn't changed since createForm() init.
                    for (const fieldName of Object.keys(fieldRules)) {
                        notify([fieldName, 'valid'], state[fieldName].valid, state[fieldName].valid);
                    }

                    return state.valid;
                }
            });

            /**
             * Restores all fields to their initial values and clears dirty flags.
             * Useful after a successful submit to return the form to a clean state.
             */
            Object.defineProperty(proxy, 'reset', {
                enumerable:   false,
                configurable: true,
                value: function () {
                    for (const fieldName of Object.keys(fieldRules)) {
                        proxy[fieldName].value = initialValues[fieldName];
                        proxy[fieldName].dirty = false;
                        // Refresh the fieldValid cache for the restored value.
                        runRules(fieldName);
                    }

                    // Recompute form-level state from the refreshed cache.
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
                enumerable:   false,
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

            // Compute initial form-level state. form.valid accurately reflects
            // whether initial values satisfy all rules from the moment of creation.
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