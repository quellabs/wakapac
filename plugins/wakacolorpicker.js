/*
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║   ██████╗ ██████╗ ██╗      ██████╗ ██████╗ ██████╗ ██╗ ██████╗██╗  ██╗       ║
 * ║  ██╔════╝██╔═══██╗██║     ██╔═══██╗██╔══██╗██╔══██╗██║██╔════╝██║ ██╔╝       ║
 * ║  ██║     ██║   ██║██║     ██║   ██║██████╔╝██████╔╝██║██║     █████╔╝        ║
 * ║  ██║     ██║   ██║██║     ██║   ██║██╔══██╗██╔═══╝ ██║██║     ██╔═██╗        ║
 * ║  ╚██████╗╚██████╔╝███████╗╚██████╔╝██║  ██║██║     ██║╚██████╗██║  ██╗       ║
 * ║   ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝       ║
 * ║                                                                              ║
 * ║  WakaPAC Plugin — WakaColorPicker                                            ║
 * ║                                                                              ║
 * ║  Replaces a data-wcp input with an inline color picker widget:               ║
 * ║                                                                              ║
 * ║    [ swatch 1 ][ swatch 2 ]...[ swatch 10 ]  [ #rrggbb ][■]                  ║
 * ║                                                                              ║
 * ║  The 10 swatches are a Tailwind-style gradient for the current color.        ║
 * ║  The text field accepts a hex value directly. The colored square next to     ║
 * ║  it opens the native browser color picker. Any change regenerates the row.   ║
 * ║  Clicking a swatch selects it; only the text/picker input regenerates.       ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    wakaPAC.use(WakaColorPicker);                                             ║
 * ║    wakaPAC.use(WakaColorPicker, { injectCSS: false });                       ║
 * ║                                                                              ║
 * ║    <!-- custom element form -->                                              ║
 * ║    <waka-colorpicker name="color" value="#3b82f6"></waka-colorpicker>        ║
 * ║    wakaPAC('#myPicker', {});                                                 ║
 * ║                                                                              ║
 * ║    <!-- legacy input form -->                                                ║
 * ║    <input data-wcp name="color" value="#3b82f6">                             ║
 * ║    wakaPAC('#myInput', {});                                                  ║
 * ║                                                                              ║
 * ║  Optional per-component config:                                              ║
 * ║    wakaPAC('#myInput', {                                                     ║
 * ║    });                                                                       ║
 * ║                                                                              ║
 * ║  Reactive property:                                                          ║
 * ║    abstraction.value  — current color as '#rrggbb'. Setting it externally    ║
 * ║                         updates the widget and regenerates the swatches.     ║
 * ║                                                                              ║
 * ║  Fires MSG_COLOR_CHANGED via sendMessage: wParam = COLORREF (0x00RRGGBB),    ║
 * ║  lParam = 0, extended = { hex: '#rrggbb' }.                                  ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
(function() {
    "use strict";

    /** Owns the state and lifecycle of one color picker widget. */
    class ColorPickerWidget {
        constructor(owner, input, options = {}) {
            this._owner = owner;
            this._input = input;
            this._options = options;

            this.syncInputs = this.syncInputs.bind(this);
            this.buildSwatches = this.buildSwatches.bind(this);
            this.selectCell = this.selectCell.bind(this);
            this.applyColor = this.applyColor.bind(this);
            this.selectColor = this.selectColor.bind(this);
            this.onNativeInput = this.onNativeInput.bind(this);
            this.onTextInput = this.onTextInput.bind(this);
            this.onTextKeydown = this.onTextKeydown.bind(this);
            this.onSwatchClick = this.onSwatchClick.bind(this);
        }

        initialize() {
            const state = this;

            ({ onChange: state._onChange } = state._options);

            // Hide the original input — it keeps its name and value for form submission
            state._originalType = state._input.type;
            state._input.type = 'hidden';

            state.createWidget();

            // ── State ─────────────────────────────────────────────────────────────

            /** @type {string|null} Currently selected color as a 6-char hex string without '#'. */
            state._currentHex = null;

            /** @type {HTMLElement|null} The currently highlighted swatch cell. */
            state._selectedCell = null;

            // ── Helpers ───────────────────────────────────────────────────────────

            // ── Init ──────────────────────────────────────────────────────────────

            // Seed from the input's existing value, defaulting to white
            state.applyColor(window.WakaColorPicker.normalizeHex(state._input.value) || 'ffffff');

            state.attachListeners();

            // ── Public API ────────────────────────────────────────────────────────

            return state.createDescriptor();
        }

        syncInputs(hex) {
            const state = this;

            state._input.value = '#' + hex;

            state._textInput.value = '#' + hex;
            state._nativePicker.value = '#' + hex;

            state._trigger.style.backgroundColor = '#' + hex;
            state._textInput.classList.remove('wcp-invalid');

            state._input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        buildSwatches(hex) {
            const state = this;

            state._swatchesEl.innerHTML = '';
            state._selectedCell = null;

            for (const h of pluginRuntime.generateGradient(hex)) {
                const cell = pluginRuntime.el('div', 'wcp-cell');
                cell.style.backgroundColor = '#' + h;
                cell.dataset.hex = h;
                cell.title = '#' + h;
                state._swatchesEl.appendChild(cell);

                // Re-apply selection highlight if this stop matches the current color
                if (h === state._currentHex) {
                    cell.classList.add('wcp-selected');
                    state._selectedCell = cell;
                }
            }
        }

        selectCell(cell) {
            const state = this;

            state._selectedCell?.classList.remove('wcp-selected');
            state._selectedCell = cell;
            cell?.classList.add('wcp-selected');
        }

        applyColor(hex) {
            const state = this;

            if (hex === state._currentHex) {
                return;
            }

            state._currentHex = hex;

            state.syncInputs(hex);
            state.buildSwatches(hex);

            state._onChange?.('#' + hex);
        }

        selectColor(hex, cell) {
            const state = this;

            if (hex === state._currentHex) {
                return;
            }

            state._currentHex = hex;

            state.syncInputs(hex);
            state.selectCell(cell);

            state._onChange?.('#' + hex);
        }

        onNativeInput() {
            const state = this;

            const hex = window.WakaColorPicker.normalizeHex(state._nativePicker.value);

            if (hex) {
                state.applyColor(hex);
            }
        }

        onTextInput() {
            const session = this;

            const hex = window.WakaColorPicker.normalizeHex(session._textInput.value);

            if (hex) {
                session._textInput.classList.remove('wcp-invalid');
                session.applyColor(hex);
            } else {
                // Invalid mid-typing — show error state but don't discard the text
                session._textInput.classList.add('wcp-invalid');
            }
        }

        onTextKeydown(e) {
            const state = this;

            if (e.key === 'Escape') {
                state._textInput.blur();
            }
        }

        onSwatchClick(e) {
            const state = this;

            const cell = e.target.closest('.wcp-cell');

            if (cell) {
                state.selectColor(cell.dataset.hex, cell);
            }
        }

        createDescriptor() {
            const state = this;

            return {
                /**
                 * Removes all event listeners, restores the original input type,
                 * and removes the widget from the DOM.
                 */
                destroy() {
                    state._nativePicker.removeEventListener('input', state.onNativeInput);
                    state._textInput.removeEventListener('input', state.onTextInput);
                    state._textInput.removeEventListener('keydown', state.onTextKeydown);
                    state._swatchesEl.removeEventListener('click', state.onSwatchClick);
                    state._input.type = state._originalType;
                    state._widget.parentNode?.removeChild(state._widget);
                },

                /**
                 * Programmatically sets the active color.
                 * Rebuilds the swatch row and syncs all inputs.
                 *
                 * @param {string} hex - Any valid hex color string (with or without '#').
                 */
                setColor(hex) {
                    const n = window.WakaColorPicker.normalizeHex(hex);

                    if (n) {
                        state.applyColor(n);
                    }
                },

                /**
                 * Returns the current active color as a '#rrggbb' string.
                 *
                 * @returns {string}
                 */
                getColor() {
                    return '#' + (state._currentHex || 'ffffff');
                }
            };
        }

        attachListeners() {
            const state = this;

            // ── Events ────────────────────────────────────────────────────────────

            state._nativePicker.addEventListener('input', state.onNativeInput);
            state._textInput.addEventListener('input', state.onTextInput);
            state._textInput.addEventListener('keydown', state.onTextKeydown);
            state._swatchesEl.addEventListener('click', state.onSwatchClick);
        }

        createWidget() {
            const state = this;

            // ── Build DOM ─────────────────────────────────────────────────────────

            state._widget = pluginRuntime.el('span', 'wcp-widget');
            state._swatchesEl = pluginRuntime.el('span', 'wcp-swatches');
            state._textInput = Object.assign(pluginRuntime.el('input', 'wcp-text-input'), {
                type      : 'text',
                spellcheck: false,
                maxLength : 7
            });
            state._trigger = pluginRuntime.el('span', 'wcp-color-trigger');
            state._nativePicker = Object.assign(pluginRuntime.el('input'), { type: 'color' });

            // Native picker sits invisibly inside the trigger — clicking the trigger opens it
            state._trigger.appendChild(state._nativePicker);
            state._widget.append(state._swatchesEl, state._textInput, state._trigger);

            // Insert widget right after the hidden input in the DOM
            state._input.parentNode.insertBefore(state._widget, state._input.nextSibling);
        }
    }

    /** Owns the state and lifecycle of one color picker plugin. */
    class ColorPickerPlugin {
        constructor(owner, pac, options = {}) {
            this._owner = owner;
            this._pac = pac;
            this._options = options;
        }

        initialize() {
            const state = this;

            if (state._options.injectCSS !== false) {
                pluginRuntime.injectCSS();
            }

            return state.createDescriptor();
        }

        createDescriptor() {
            const state = this;

            return {
                /**
                 * Called by WakaPAC after a component is created.
                 *
                 * Activates the color picker if the component element is either:
                 *   - A <waka-colorpicker> element (custom element form), or
                 *   - An <input> element carrying the data-wcp attribute (legacy form).
                 * Sets up:
                 *   - abstraction.value    — reactive hex color property
                 *
                 * External changes to abstraction.value are picked up via the
                 * pac:change event on the container element.
                 *
                 * @param {object} abstraction - The reactive component abstraction.
                 * @param {string} pacId       - The component's unique PAC identifier.
                 * @param {object} config      - The component configuration object.
                 */
                onComponentCreated(abstraction, pacId, _config) {
                    const componentLifecycleHandlers = {
                        unlistenChange() { return container.removeEventListener('pac:change', componentLifecycle.onPacChange); }
                    };

                    const componentLifecycle = {
                        /**
                         * Listens for external changes to abstraction.value.
                         * WakaPAC fires 'pac:change' on the container element whenever a
                         * reactive property is set. We filter for path[0] === 'value' and
                         * forward valid hex values into the widget.
                         *
                         * @param {CustomEvent} e - pac:change event with detail.path and detail.newValue.
                         */
                        onPacChange(e) {
                            if (e.detail?.path?.[0] === 'value') {
                                const hex = window.WakaColorPicker.normalizeHex(e.detail.newValue);

                                if (hex) {
                                    _pickers.get(pacId)?.setColor(hex);
                                }
                            }
                        }
                    };

                    const container = state._pac.getContainerByPacId(pacId);

                    if (!container) {
                        console.warn(`[WakaColorPicker] container for pacId "${pacId}" not found`);
                        return;
                    }

                    let input;

                    if (container.tagName === 'WAKA-COLORPICKER') {
                        // Custom element path — create a hidden input inside the container
                        // to carry name/value for form submission, seeded from the value attribute
                        input = Object.assign(pluginRuntime.el('input'), {
                            type : 'hidden',
                            name : container.getAttribute('name') || '',
                            value: container.getAttribute('value') || ''
                        });
                        container.appendChild(input);
                    } else if (container.tagName === 'INPUT' && container.hasAttribute('data-wcp')) {
                        // Legacy path — use the input element directly
                        input = container;
                    } else {
                        return;
                    }

                    // Store the picker handle in the module-level map, keyed by pacId
                    _pickers.set(pacId, pluginRuntime.bindPicker(input, {
                        onChange(hex) {
                            // Push the new color into the reactive abstraction so DOM bindings
                            // and any data-pac-bind expressions on 'value' update automatically
                            abstraction.value = hex;

                            // Notify the component via the WakaPAC message system
                            if (typeof state._pac?.sendMessage === 'function') {
                                state._pac.sendMessage(pacId, MSG_COLOR_CHANGED, window.WakaColorPicker.hexToColorRef(hex.slice(1)), 0, { hex });
                            }
                        }
                    }));

                    // Seed abstraction.value with the initial color from the widget
                    abstraction.value = _pickers.get(pacId).getColor();

                    // Listen to change events
                    container.addEventListener('pac:change', componentLifecycle.onPacChange);

                    // Store the unlisten function in the module-level map, keyed by pacId
                    _unlisteners.set(pacId, componentLifecycleHandlers.unlistenChange.bind(this));
                },

                /**
                 * Called by WakaPAC just before a component is destroyed.
                 * Removes the pac:change listener and tears down the widget.
                 *
                 * @param {string} pacId - The component's unique PAC identifier.
                 */
                onComponentDestroyed(pacId) {
                    _unlisteners.get(pacId)?.();
                    _unlisteners.delete(pacId);
                    _pickers.get(pacId)?.destroy();
                    _pickers.delete(pacId);
                }
            };
        }
    }

    const pluginRuntime = {
        /**
         * Computes the 12-entry lightness distribution array for the Tailwind palette
         * algorithm, given the lightness of the base color.
         *
         * The distribution spreads lighter stops toward 100% and darker stops toward
         * 0%, with equal step sizes on each side. Matches the PHP implementation of
         * ImageProcessing::createDistributionValues() with lMin=0, lMax=100.
         *
         * @param {number} L - Lightness of the base color (0–100).
         * @returns {number[]} Array of 12 rounded lightness values.
         */
        createDistributionValues(L) {
            // Step size toward white (lighter half)
            const hi = Math.round((100 - L) / 5 * 100) / 100;

            // Step size toward black (darker half)
            const lo = Math.round(L / 5 * 100) / 100;

            // Create list of distribution values
            return [
                Math.round(L + hi * 5),
                Math.round(L + hi * 4.5),
                Math.round(L + hi * 4),
                Math.round(L + hi * 3),
                Math.round(L + hi * 2),
                Math.round(L + hi),
                Math.round(L),                                  // stop 500 = base color
                Math.round(L - lo),
                Math.round(L - lo * 2),
                Math.round(L - lo * 3),
                Math.round(L - lo * 4),
                Math.round(L - lo * 5)
            ];
        },

        /**
         * Generates a 10-stop Tailwind-style color gradient for the given normalized hex.
         *
         * First checks the preset index for a hand-crafted Tailwind palette match.
         * Falls back to computing a synthetic gradient via HSL lightness distribution
         * if no preset matches.
         *
         * @param {string} hex - Normalized 6-char hex string without '#'.
         * @returns {string[]} Array of 10 hex strings (stops 50–900) without '#'.
         */
        generateGradient(hex) {
            const generateGradientHandlers = {
                createGradientStop(stop, i) {
                    // preserve exact base color at midpoint
                    if (stop === 500) {
                        return hex;
                    }

                    const { r, g, b } = window.WakaColorPicker.hslToRgb(hsl.H, Math.min(hsl.S, 100), dist[i + 1]);
                    return window.WakaColorPicker.rgbToHex(r, g, b);
                }
            };

            // Return a copy of the preset so callers can't mutate the cached array
            const preset = _presetIndex.get(hex);

            if (preset) {
                return [...preset];
            }

            // Compute synthetic gradient via HSL lightness distribution
            const rgb = window.WakaColorPicker.hexToRgb(hex);
            const hsl = window.WakaColorPicker.rgbToHsl(rgb.r, rgb.g, rgb.b);
            const dist = pluginRuntime.createDistributionValues(hsl.L);

            // Map stops 50–900 (STOPS without first and last synthetic entries).
            // i+1 aligns each stop to the correct dist[] index after the slice.
            return STOPS.slice(1, -1).map(generateGradientHandlers.createGradientStop.bind(this));
        },

        /**
         * Creates a DOM element with an optional CSS class name.
         *
         * @param {string} tag  - HTML tag name (e.g. 'div', 'span', 'input').
         * @param {string} [cls] - Optional class name to assign.
         * @returns {HTMLElement}
         */
        el(tag, cls) {
            const e = document.createElement(tag);

            if (cls) {
                e.className = cls;
            }

            return e;
        },

        /**
         * Binds the color picker widget to a given <input> element.
         *
         * The original input is hidden (type="hidden") so its name/value continue to
         * participate in form submission. The widget is inserted immediately after it
         * in the DOM and consists of:
         *   - A row of 10 color swatches (the gradient for the current color)
         *   - A hex text field for direct keyboard entry
         *   - A colored trigger square that opens the native browser color picker
         *
         * @param {HTMLInputElement} input   - The target input element.
         * @param {object}           options
         * @param {function}         [options.onChange] - Called with '#rrggbb' whenever the color changes.
         * @returns {{ destroy: function, setColor: function, getColor: function }}
         */
        bindPicker(input, options = {}) {
            return new ColorPickerWidget(this, input, options).initialize();
        },

        /**
         * Injects the plugin stylesheet into <head> if it hasn't been added yet.
         * Guarded by a unique element ID so multiple wakaPAC instances on the same
         * page don't duplicate the rules.
         */
        injectCSS() {
            if (document.getElementById('waka-color-picker-styles')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'waka-color-picker-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
        }
    };

    // Support standalone loading while using the host's plugin base when present.
    const MSG_PLUGIN = globalThis.wakaPAC?.MSG_PLUGIN ?? 0x2000;

    /** @type {Map<string, function>} Maps pacId to its pac:change unlisten function. */
    const _unlisteners = new Map();

    /** @type {Map<string, object>} Maps pacId to its bindPicker handle. */
    const _pickers = new Map();

    // ─── CSS ──────────────────────────────────────────────────────────────────
    // Injected once into <head> unless the injectCSS option is false.

    const CSS = `
.wcp-widget {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.wcp-swatches {
    display: flex;
}
/* Individual color stop cell */
.wcp-cell {
    width: 32px;
    height: 32px;
    border-radius: 0;
    cursor: pointer;
    border: none;
    border-right: 1px solid rgba(0,0,0,.15); /* divider between stops */
    box-sizing: border-box;
    transition: transform .1s, box-shadow .1s;
    flex-shrink: 0;
}
/* No trailing divider on the last stop */
.wcp-cell:last-child {
    border-right: none;
}
.wcp-cell:hover {
    transform: scale(1.15);
    box-shadow: 0 1px 5px rgba(0,0,0,.25);
    z-index: 1;
    position: relative;
}
/* Inset outline so the selection ring stays inside the cell boundary */
.wcp-cell.wcp-selected {
    outline: 2px solid #333;
    outline-offset: -2px;
}
/* Hex text field — joins flush with the trigger on the right */
.wcp-text-input {
    font-family: monospace;
    font-size: 13px;
    padding: 3px 6px;
    border: 1px solid #ccc;
    border-radius: 3px 0 0 3px;
    box-sizing: border-box;
    width: 80px;
    height: 32px;
    margin-left: 12px; /* visual gap between swatches and text field */
}
.wcp-text-input.wcp-invalid {
    border-color: #e74c3c;
    background: #fff0f0;
}
/* Colored square that acts as the native color picker trigger */
.wcp-color-trigger {
    width: 32px;
    height: 32px;
    border: 1px solid #ccc;
    border-left: 1px solid #ccc;
    border-radius: 0 3px 3px 0;
    cursor: pointer;
    box-sizing: border-box;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
}
/* Native <input type="color"> overlays the trigger invisibly — click area only */
.wcp-color-trigger input[type="color"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
}
`;

    // ─── Preset Tailwind Palettes ─────────────────────────────────────────────
    // The full set of hand-crafted Tailwind color palettes, ported 1:1 from
    // ImageProcessing::generateGradient(). Each row is a 10-stop gradient
    // (stops 50–900) stored as lowercase hex strings without '#'.
    // When the user's color matches any stop in a preset, that preset is used
    // directly instead of computing a synthetic gradient.

    const PRESET_PALETTES = [
        ['ffffff', 'e3e3e3', 'c7c7c7', 'aaaaaa', '8e8e8e', '717171', '555555', '383838', '1c1c1c', '000000'],
        ['fef2f2', 'fee2e2', 'fecaca', 'fca5a5', 'f87171', 'ef4444', 'dc2626', 'b91c1c', '991b1b', '7f1d1d'],
        ['fff7ed', 'ffedd5', 'fed7aa', 'fdba74', 'fb923c', 'f97316', 'ea580c', 'c2410c', '9a3412', '7c2d12'],
        ['fffbeb', 'fef3c7', 'fde68a', 'fcd34d', 'fbbf24', 'f59e0b', 'd97706', 'b45309', '92400e', '78350f'],
        ['fefce8', 'fef9c3', 'fef08a', 'fde047', 'facc15', 'eab308', 'ca8a04', 'a16207', '854d0e', '713f12'],
        ['f7fee7', 'ecfccb', 'd9f99d', 'bef264', 'a3e635', '84cc16', '65a30d', '4d7c0f', '3f6212', '365314'],
        ['f0fdf4', 'dcfce7', 'bbf7d0', '86efac', '4ade80', '22c55e', '16a34a', '15803d', '166534', '14532d'],
        ['ecfdf5', 'd1fae5', 'a7f3d0', '6ee7b7', '34d399', '10b981', '059669', '047857', '065f46', '064e3b'],
        ['f0fdfa', 'ccfbf1', '99f6e4', '5eead4', '2dd4bf', '14b8a6', '0d9488', '0f766e', '115e59', '134e4a'],
        ['ecfeff', 'cffafe', 'a5f3fc', '67e8f9', '22d3ee', '06b6d4', '0891b2', '0e7490', '155e75', '164e63'],
        ['f0f9ff', 'e0f2fe', 'bae6fd', '7dd3fc', '38bdf8', '0ea5e9', '0284c7', '0369a1', '075985', '0c4a6e'],
        ['eff6ff', 'dbeafe', 'bfdbfe', '93c5fd', '60a5fa', '3b82f6', '2563eb', '1d4ed8', '1e40af', '1e3a8a'],
        ['eef2ff', 'e0e7ff', 'c7d2fe', 'a5b4fc', '818cf8', '6366f1', '4f46e5', '4338ca', '3730a3', '312e81'],
        ['f5f3ff', 'ede9fe', 'ddd6fe', 'c4b5fd', 'a78bfa', '8b5cf6', '7c3aed', '6d28d9', '5b21b6', '4c1d95'],
        ['faf5ff', 'f3e8ff', 'e9d5ff', 'd8b4fe', 'c084fc', 'a855f7', '9333ea', '7e22ce', '6b21a8', '581c87'],
        ['fdf4ff', 'fae8ff', 'f5d0fe', 'f0abfc', 'e879f9', 'd946ef', 'c026d3', 'a21caf', '86198f', '701a75'],
        ['fdf2f8', 'fce7f3', 'fbcfe8', 'f9a8d4', 'f472b6', 'ec4899', 'db2777', 'be185d', '9d174d', '831843'],
        ['fff1f2', 'ffe4e6', 'fecdd3', 'fda4af', 'fb7185', 'f43f5e', 'e11d48', 'be123c', '9f1239', '881337'],
        ['f8fafc', 'f1f5f9', 'e2e8f0', 'cbd5e1', '94a3b8', '64748b', '475569', '334155', '1e293b', '0f172a'],
        ['f9fafb', 'f3f4f6', 'e5e7eb', 'd1d5db', '9ca3af', '6b7280', '4b5563', '374151', '1f2937', '111827'],
        ['fafafa', 'f4f4f5', 'e4e4e7', 'd4d4d8', 'a1a1aa', '71717a', '52525b', '3f3f46', '27272a', '18181b'],
        ['fafafa', 'f5f5f5', 'e5e5e5', 'd4d4d4', 'a3a3a3', '737373', '525252', '404040', '262626', '171717'],
        ['fafaf9', 'f5f5f4', 'e7e5e4', 'd6d3d1', 'a8a29e', '78716c', '57534e', '44403c', '292524', '1c1917']
    ];

    /**
     * Flat lookup map: normalized hex string → its preset palette array.
     * Built once at module load time for O(1) preset matching.
     * @type {Map<string, string[]>}
     */
    const _presetIndex = new Map();

    for (const palette of PRESET_PALETTES) {
        for (const hex of palette) {
            _presetIndex.set(hex, palette);
        }
    }

    // ─── Color utilities ──────────────────────────────────────────────────────

    // ─── Tailwind palette generator ───────────────────────────────────────────
    // Ported 1:1 from ImageProcessing::generateGradient / createSwatches.
    // Default palette tweak = 0, so hue and saturation scales are all zero.
    // Only the lightness distribution varies across the 12 internal stops.

    /**
     * All 12 Tailwind palette stops including the synthetic 0 and 1000 endpoints.
     * The slice(1, -1) in generateGradient trims these to the public 50–900 range.
     * @type {number[]}
     */
    const STOPS = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    // ─── DOM helper ───────────────────────────────────────────────────────────

    // ─── Widget factory ───────────────────────────────────────────────────────

    // ─── CSS injection ────────────────────────────────────────────────────────

    // ─── Plugin ───────────────────────────────────────────────────────────────

    /**
     * WakaPAC message constant fired when the user picks a color.
     * Uses the reserved WakaColorPicker message range (0x2600).
     * Sent via pac.sendMessage(pacId, MSG_COLOR_CHANGED, colorRef, 0, { hex }).
     * wParam is a 24-bit COLORREF integer (0x00RRGGBB).
     * @type {number}
     */
    const MSG_COLOR_CHANGED = MSG_PLUGIN + 0x600;

    window.WakaColorPicker = {

        /**
         * WakaPAC plugin entry point. Called once by wakaPAC.use().
         *
         * @param {object} pac               - The wakaPAC instance.
         * @param {object} [options]
         * @param {boolean} [options.injectCSS=true] - Set to false to skip stylesheet injection.
         * @returns {{ onComponentCreated: function, onComponentDestroyed: function }}
         */
        createPacPlugin(pac, options = {}) {
            return new ColorPickerPlugin(this, pac, options).initialize();
        }
    };

    // ─── Exports ──────────────────────────────────────────────────────────────

    /** Message constant fired when the user picks a color (0x2600). */
    window.WakaColorPicker.MSG_COLOR_CHANGED = MSG_COLOR_CHANGED;

    /**
     * Programmatically sets the color of a registered color picker component.
     * Sets abstraction.value, which triggers pac:change, which updates the widget.
     * @param {string} pacId - The pacId of the target component.
     * @param {string} hex   - Any valid hex color string (with or without '#').
     */
    window.WakaColorPicker.setColor = function setColor(pacId, hex) {
        const n = window.WakaColorPicker.normalizeHex(hex);
        const context = window.PACRegistry?.get(pacId);

        if (n && context) {
            context.abstraction.value = '#' + n;
        }
    };

    /**
     * Normalizes a hex color string to a 6-character lowercase string without '#'.
     * Accepts 3-character shorthand (#fff → ffffff) and optional leading '#'.
     * Returns null for any input that is not a valid hex color.
     * @param {*} hex - Input value to normalize.
     * @returns {string|null} 6-char lowercase hex, or null if invalid.
     */
    window.WakaColorPicker.normalizeHex = function normalizeHex(hex) {
        if (typeof hex !== 'string') {
            return null;
        }

        hex = hex.replace(/^#/, '').toLowerCase();

        // Expand 3-char shorthand: abc → aabbcc
        if (/^[0-9a-f]{3}$/.test(hex)) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        return /^[0-9a-f]{6}$/.test(hex) ? hex : null;
    };

    /**
     * Converts a normalized 6-character hex string (without '#') to an RGB object.
     * Assumes input is already validated — does not re-normalize.
     * @param {string} hex - 6-char lowercase hex string without '#'.
     * @returns {{ r: number, g: number, b: number }}
     */
    window.WakaColorPicker.hexToRgb = function hexToRgb(hex) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    };

    /**
     * Converts integer RGB channel values (0–255) to a 6-character lowercase hex string.
     * @param {number} r - Red channel (0–255).
     * @param {number} g - Green channel (0–255).
     * @param {number} b - Blue channel (0–255).
     * @returns {string} 6-char lowercase hex string without '#'.
     */
    window.WakaColorPicker.rgbToHex = function rgbToHex(r, g, b) {
        return `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    /**
     * Converts RGB (0–255) to HSL.
     * H is in degrees (0–360), S and L are percentages (0–100).
     *
     * @param {number} r - Red channel (0–255).
     * @param {number} g - Green channel (0–255).
     * @param {number} b - Blue channel (0–255).
     * @returns {{ H: number, S: number, L: number }}
     */
    window.WakaColorPicker.rgbToHsl = function rgbToHsl(r, g, b) {
        // Normalise channels to 0–1
        r /= 255;
        g /= 255;
        b /= 255;

        // Darkest and brightest channel, and their difference (chroma — 0 means achromatic)
        const cMin = Math.min(r, g, b);
        const cMax = Math.max(r, g, b);
        const delta = cMax - cMin;

        // Hue — angle on the color wheel expressed in 60° sectors, then converted to degrees
        let h = 0;

        if (delta !== 0) {
            // Which channel is dominant determines which third of the wheel we are in
            if (cMax === r) {
                h = ((g - b) / delta) % 6; // red dominant: between yellow (60°) and magenta (300°)
            } else if (cMax === g) {
                h = (b - r) / delta + 2;   // green dominant: between cyan (180°) and yellow (60°)
            } else {
                h = (r - g) / delta + 4;   // blue dominant: between magenta (300°) and cyan (180°)
            }
        }

        // Convert from sectors to degrees and wrap any negative result into 0–360
        h = Math.round(h * 60);

        if (h < 0) {
            h += 360;
        }

        // Lightness — midpoint between the brightest and darkest channel
        const l = (cMax + cMin) / 2;

        // Saturation — chroma relative to lightness; 0 when achromatic (delta === 0)
        const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

        // Return H in degrees, S and L as percentages
        return { H: h, S: s * 100, L: l * 100 };
    };

    /**
     * Converts HSL to RGB (0–255).
     * H is in degrees (0–360), S and L are percentages (0–100).
     * @param {number} h - Hue (0–360).
     * @param {number} s - Saturation (0–100).
     * @param {number} l - Lightness (0–100).
     * @returns {{ r: number, g: number, b: number }}
     */
    window.WakaColorPicker.hslToRgb = function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;

        // chroma
        const c = s * (1 - Math.abs(2 * l - 1));
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));

        // lightness offset
        const m = l - c / 2;

        // Sector lookup: maps hue sector (0–5) to pre-offset RGB fractions
        const i = Math.floor(h / 60) % 6;
        const map = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
        const [r1, g1, b1] = map[i];

        // Return RGB value
        return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
    };

    /**
     * Packs a normalized hex color string into a 24-bit integer in RGB order,
     * equivalent to a Win32 COLORREF (0x00RRGGBB).
     * @param {string} hex - 6-char lowercase hex string without '#'.
     * @returns {number} 24-bit integer: (R << 16) | (G << 8) | B.
     */
    window.WakaColorPicker.hexToColorRef = function hexToColorRef(hex) {
        const { r, g, b } = window.WakaColorPicker.hexToRgb(hex);
        return (r << 16) | (g << 8) | b;
    };

    /**
     * Unpacks a 24-bit COLORREF integer (0x00RRGGBB) into a '#rrggbb' hex string.
     * @param {number} colorRef - 24-bit integer: (R << 16) | (G << 8) | B.
     * @returns {string} '#rrggbb' hex color string.
     */
    window.WakaColorPicker.colorRefToHex = function colorRefToHex(colorRef) {
        return '#' + window.WakaColorPicker.rgbToHex((colorRef >> 16) & 0xFF, (colorRef >> 8) & 0xFF, colorRef & 0xFF);
    };

    window.wakaColorPicker = window.WakaColorPicker;
})();