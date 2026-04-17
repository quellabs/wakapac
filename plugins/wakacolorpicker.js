/*
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║  WakaPAC Plugin — WakaColorPicker                                            ║
 * ║                                                                              ║
 * ║  Replaces a data-wcp input with an inline color picker widget:              ║
 * ║                                                                              ║
 * ║    [ swatch 1 ][ swatch 2 ]...[ swatch 10 ]  [ #rrggbb ][■]                ║
 * ║                                                                              ║
 * ║  The 10 swatches are a Tailwind-style gradient for the current color.       ║
 * ║  The text field accepts a hex value directly. The colored square next to    ║
 * ║  it opens the native browser color picker. Any change regenerates the row.  ║
 * ║  Clicking a swatch selects it; only the text/picker input regenerates.      ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    wakaPAC.use(WakaColorPicker);                                             ║
 * ║    wakaPAC.use(WakaColorPicker, { injectCSS: false });                       ║
 * ║                                                                              ║
 * ║    <input data-wcp name="color" value="#3b82f6">                             ║
 * ║    wakaPAC('#myInput', {});                                                  ║
 * ║                                                                              ║
 * ║  Optional per-component config:                                              ║
 * ║    wakaPAC('#myInput', {                                                     ║
 * ║      wakaColorPicker: {                                                      ║
 * ║        property: '_colorPicker',  // abstraction property (default)         ║
 * ║        onChange: (hex) => {}      // callback when a color is picked        ║
 * ║      }                                                                       ║
 * ║    });                                                                       ║
 * ║                                                                              ║
 * ║  Fires MSG_COLOR_CHANGED via sendMessage: wParam = '#rrggbb', lParam = 0.  ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // ─── CSS ──────────────────────────────────────────────────────────────────

    const CSS = `
.wcp-widget {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.wcp-swatches {
    display: flex;
    gap: 3px;
}

.wcp-cell {
    width: 32px;
    height: 32px;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid rgba(0,0,0,.08);
    box-sizing: border-box;
    transition: transform .1s, box-shadow .1s;
    flex-shrink: 0;
}

.wcp-cell:hover {
    transform: scale(1.15);
    box-shadow: 0 1px 5px rgba(0,0,0,.25);
    z-index: 1;
    position: relative;
}

.wcp-cell.wcp-selected {
    outline: 2px solid #333;
    outline-offset: 1px;
}

.wcp-text-input {
    font-family: monospace;
    font-size: 13px;
    padding: 3px 6px;
    border: 1px solid #ccc;
    border-radius: 3px 0 0 3px;
    box-sizing: border-box;
    width: 80px;
    height: 32px;
    margin-left: 12px;
}

.wcp-text-input.wcp-invalid {
    border-color: #e74c3c;
    background: #fff0f0;
}

.wcp-color-trigger {
    width: 32px;
    height: 32px;
    border: 1px solid #ccc;
    border-left: none;
    border-radius: 0 3px 3px 0;
    cursor: pointer;
    box-sizing: border-box;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
}

/* Native color input sits on top of the trigger, invisible but clickable */
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
        ['fafaf9', 'f5f5f4', 'e7e5e4', 'd6d3d1', 'a8a29e', '78716c', '57534e', '44403c', '292524', '1c1917'],
    ];

    const _presetIndex = new Map();
    for (const palette of PRESET_PALETTES) {
        for (const hex of palette) {
            _presetIndex.set(hex, palette);
        }
    }

    // ─── Color utilities ──────────────────────────────────────────────────────

    function normalizeHex(hex) {
        if (typeof hex !== 'string') {
            return null;
        }
        hex = hex.replace(/^#/, '').toLowerCase();
        if (/^[0-9a-f]{3}$/.test(hex)) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return /^[0-9a-f]{6}$/.test(hex) ? hex : null;
    }

    function hexToRgb(hex) {
        hex = normalizeHex(hex);
        if (!hex) {
            return null;
        }
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
        };
    }

    function rgbToHex(r, g, b) {
        return (
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0')
        );
    }

    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const cMin = Math.min(r, g, b), cMax = Math.max(r, g, b);
        const delta = cMax - cMin;
        let h = 0;

        if (delta !== 0) {
            if (cMax === r) {
                h = ((g - b) / delta) % 6;
            } else if (cMax === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
        }

        h = Math.round(h * 60);
        if (h < 0) {
            h += 360;
        }

        const l = (cMax + cMin) / 2;
        const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        return {H: h, S: s * 100, L: l * 100};
    }

    function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const c = s * (1 - Math.abs(2 * l - 1));
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        const sectors = [
            [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]
        ];
        const i = Math.floor(h / 60) % 6;
        const [r1, g1, b1] = sectors[i < 0 ? 0 : i] || [0, 0, 0];
        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255),
        };
    }

    // ─── Tailwind palette generator ───────────────────────────────────────────

    const STOPS = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    function createDistributionValues(lightness) {
        const maxStep = Math.round((100 - lightness) / 5 * 100) / 100;
        const minStep = Math.round(lightness / 5 * 100) / 100;
        return [
            Math.round(lightness + maxStep * 5),
            Math.round(lightness + maxStep * 4.5),
            Math.round(lightness + maxStep * 4),
            Math.round(lightness + maxStep * 3),
            Math.round(lightness + maxStep * 2),
            Math.round(lightness + maxStep),
            Math.round(lightness),
            Math.round(lightness - minStep),
            Math.round(lightness - minStep * 2),
            Math.round(lightness - minStep * 3),
            Math.round(lightness - minStep * 4),
            Math.round(lightness - minStep * 5),
        ];
    }

    function generateGradient(hex) {
        const key = normalizeHex(hex);
        if (!key) {
            return [];
        }

        const preset = _presetIndex.get(key);
        if (preset) {
            return [...preset];
        }

        const rgb = hexToRgb(key);
        if (!rgb) {
            return [];
        }

        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const dist = createDistributionValues(hsl.L);

        const swatches = STOPS.map((stop, i) => {
            if (stop === 500) {
                return rgbToHex(rgb.r, rgb.g, rgb.b);
            }
            const newRgb = hslToRgb(hsl.H, Math.min(hsl.S, 100), dist[i]);
            return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        });

        return swatches.slice(1, -1); // stops 50–900
    }

    // ─── DOM helper ───────────────────────────────────────────────────────────

    function el(tag, cls) {
        const e = document.createElement(tag);
        if (cls) {
            e.className = cls;
        }
        return e;
    }

    // ─── Widget factory ───────────────────────────────────────────────────────

    function bindPicker(input, options = {}) {
        const {onChange} = options;

        // Hide original input — it keeps name/value for form submission
        input.type = 'hidden';

        // ── Build widget ──────────────────────────────────────────────────────
        const widget = el('span', 'wcp-widget');
        const swatches = el('span', 'wcp-swatches');

        // Text input for hex value
        const textInput = el('input', 'wcp-text-input');
        textInput.type = 'text';
        textInput.spellcheck = false;
        textInput.maxLength = 7;

        // Colored square that triggers native color picker
        const trigger = el('span', 'wcp-color-trigger');
        const nativePicker = el('input');
        nativePicker.type = 'color';
        trigger.appendChild(nativePicker);

        widget.appendChild(swatches);
        widget.appendChild(textInput);
        widget.appendChild(trigger);
        input.parentNode.insertBefore(widget, input.nextSibling);

        // ── State ─────────────────────────────────────────────────────────────
        let currentHex = null;

        // ── Helpers ───────────────────────────────────────────────────────────

        function buildSwatches(hex) {
            const stops = generateGradient(hex);
            swatches.innerHTML = '';
            for (const h of stops) {
                const cell = el('div', 'wcp-cell');
                cell.style.backgroundColor = '#' + h;
                cell.dataset.hex = h;
                cell.title = '#' + h;
                swatches.appendChild(cell);
            }
        }

        function markSelected(hex) {
            swatches.querySelectorAll('.wcp-cell').forEach(c => {
                c.classList.toggle('wcp-selected', c.dataset.hex === hex);
            });
        }

        function applyColor(hex) {
            if (hex === currentHex) {
                return;
            }
            currentHex = hex;

            // Sync all representations
            input.value = '#' + hex;
            textInput.value = '#' + hex;
            nativePicker.value = '#' + hex;
            trigger.style.backgroundColor = '#' + hex;
            textInput.classList.remove('wcp-invalid');

            input.dispatchEvent(new Event('input', {bubbles: true}));

            buildSwatches(hex);
            markSelected(hex);

            if (onChange) {
                onChange('#' + hex);
            }
        }

        // ── Init ──────────────────────────────────────────────────────────────
        applyColor(normalizeHex(input.value) || 'ffffff');

        // ── Events ────────────────────────────────────────────────────────────

        // Native color picker changed
        function onNativeInput() {
            const normalized = normalizeHex(nativePicker.value);
            if (normalized) {
                applyColor(normalized);
            }
        }

        // Typing in text field — update swatches live on valid hex, commit on Enter
        function onTextInput() {
            const normalized = normalizeHex(textInput.value);
            if (normalized) {
                textInput.classList.remove('wcp-invalid');
                trigger.style.backgroundColor = '#' + normalized;
                nativePicker.value = '#' + normalized;
                buildSwatches(normalized);
                markSelected(normalized);
            } else {
                textInput.classList.add('wcp-invalid');
            }
        }

        function onTextKeydown(e) {
            if (e.key === 'Enter') {
                const normalized = normalizeHex(textInput.value);
                if (normalized) {
                    applyColor(normalized);
                } else {
                    textInput.classList.add('wcp-invalid');
                }
            }
        }

        // Clicking a swatch — selects it without rebuilding the gradient row
        function onSwatchClick(e) {
            const cell = e.target.closest('.wcp-cell');
            if (!cell) {
                return;
            }
            currentHex = cell.dataset.hex;
            input.value = '#' + currentHex;
            textInput.value = '#' + currentHex;
            nativePicker.value = '#' + currentHex;
            trigger.style.backgroundColor = '#' + currentHex;
            textInput.classList.remove('wcp-invalid');
            input.dispatchEvent(new Event('input', {bubbles: true}));
            markSelected(currentHex);
            if (onChange) {
                onChange('#' + currentHex);
            }
        }

        nativePicker.addEventListener('input', onNativeInput);
        textInput.addEventListener('input', onTextInput);
        textInput.addEventListener('keydown', onTextKeydown);
        swatches.addEventListener('click', onSwatchClick);

        return {
            destroy() {
                nativePicker.removeEventListener('input', onNativeInput);
                textInput.removeEventListener('input', onTextInput);
                textInput.removeEventListener('keydown', onTextKeydown);
                swatches.removeEventListener('click', onSwatchClick);
                input.type = 'text';
                if (widget.parentNode) {
                    widget.parentNode.removeChild(widget);
                }
            },
            setColor(hex) {
                const normalized = normalizeHex(hex);
                if (normalized) {
                    applyColor(normalized);
                }
            },
            getColor() {
                return '#' + (currentHex || 'ffffff');
            }
        };
    }

    // ─── CSS injection ────────────────────────────────────────────────────────

    function injectCSS() {
        if (document.getElementById('waka-color-picker-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'waka-color-picker-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ─── Plugin ───────────────────────────────────────────────────────────────

    const MSG_COLOR_CHANGED = 'WCP_COLOR_CHANGED';

    window.WakaColorPicker = {

        MSG_COLOR_CHANGED,

        createPacPlugin(pac, options = {}) {
            if (options.injectCSS !== false) {
                injectCSS();
            }

            return {
                onComponentCreated(abstraction, pacId, config) {
                    const input = document.querySelector(`[data-pac-id="${pacId}"]`);

                    if (!input) {
                        console.warn(`[WakaColorPicker] element with data-pac-id="${pacId}" not found`);
                        return;
                    }

                    if (!input.hasAttribute('data-wcp')) {
                        return;
                    }

                    const property = config.wakaColorPicker?.property ?? '_colorPicker';

                    abstraction[property] = bindPicker(input, {
                        onChange(hex) {
                            if (typeof config.wakaColorPicker?.onChange === 'function') {
                                config.wakaColorPicker.onChange(hex);
                            }
                            if (pac && typeof pac.sendMessage === 'function') {
                                pac.sendMessage(pacId, MSG_COLOR_CHANGED, hex, 0);
                            }
                        }
                    });
                },

                onComponentDestroyed(abstraction, pacId, config) {
                    const property = config.wakaColorPicker?.property ?? '_colorPicker';
                    abstraction[property]?.destroy();
                }
            };
        }
    };

})();