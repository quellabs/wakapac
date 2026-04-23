/*
 * ╔═════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                         ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗  ██████╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗  ███████╗ ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██╔══██╗████╗  ██║██║   ██║██╔══██╗ ██╔════╝ ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║     ███████║██╔██╗ ██║██║   ██║███████║ ███████╗ ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║     ██╔══██║██║╚██╗██║╚██╗ ██╔╝██╔══██║ ╚════██║ ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║╚██████╗██║  ██║██║ ╚████║ ╚████╔╝ ██║  ██║ ███████║ ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝ ╚══════╝ ║
 * ║                                                                                         ║
 * ║  WakaCanvas - Canvas Drawing Plugin for wakaPAC                                         ║
 * ║                                                                                         ║
 * ║  A high-level drawing API modelled after Win32 GDI. selectXYZ() functions write         ║
 * ║  through to the DC immediately — exactly like SelectObject(). Draw functions            ║
 * ║  just draw; there is no save/restore, no per-call state, no deferred application.       ║
 * ║  Supports direct rendering to a 2D context and compilation to a wakaPAC MetaFile.       ║
 * ║                                                                                         ║
 * ║  Usage:                                                                                 ║
 * ║    wakaPAC.use(WakaCanvas);                                                             ║
 * ║                                                                                         ║
 * ║  Font management:                                                                       ║
 * ║    // Local font file                                                                   ║
 * ║    await WakaCanvas.loadFont('heading', '/fonts/Inter-Bold.woff2', { weight: 700 })     ║
 * ║                                                                                         ║
 * ║    // Google Fonts stylesheet URL — latin subset, filtered by weight                    ║
 * ║    await WakaCanvas.loadFont('heading',                                                 ║
 * ║        'https://fonts.googleapis.com/css2?family=Inter:wght@700', { weight: 700 })      ║
 * ║                                                                                         ║
 * ║    WakaCanvas.isFontReady('heading')        // true once loaded                         ║
 * ║    WakaCanvas.fontString('heading', 16)     // '700 16px Inter'                         ║
 * ║                                                                                         ║
 * ║  Font loaded event:                                                                     ║
 * ║    // Broadcast to all components when any font finishes loading.                       ║
 * ║    // Handle MSG_FONT_LOADED to repaint or adjust layout.                               ║
 * ║    case WakaCanvas.MSG_FONT_LOADED: {                                                   ║
 * ║        // wParam: alias name  e.g. 'heading'                                            ║
 * ║        // lParam: { alias, family }                                                     ║
 * ║        wakaPAC.invalidateRect(pacId, null);                                             ║
 * ║        break;                                                                           ║
 * ║    }                                                                                    ║
 * ║                                                                                         ║
 * ║  GDI object selection — write through to DC immediately:                                ║
 * ║    WakaCanvas.selectFont(dc, 'heading', 16)                                             ║
 * ║    WakaCanvas.selectBrush(dc, '#3a86ff')      // null = NULL_BRUSH (no fill)            ║
 * ║    WakaCanvas.selectPen(dc, '#1a56cf', 2)     // null = NULL_PEN  (no stroke)           ║
 * ║    WakaCanvas.selectAlpha(dc, 0.8)                                                      ║
 * ║    WakaCanvas.selectShadow(dc, 'rgba(0,0,0,.3)', 8, 0, 2)  // null to clear             ║
 * ║    WakaCanvas.selectLineDash(dc, [4, 4])      // null or [] for solid                   ║
 * ║    WakaCanvas.selectTextAlign(dc, 'center')                                             ║
 * ║    WakaCanvas.selectTextBaseline(dc, 'middle')                                          ║
 * ║                                                                                         ║
 * ║  Paint cycle:                                                                           ║
 * ║    case wakaPAC.MSG_PAINT: {                                                            ║
 * ║        const dc = wakaPAC.getDC(pacId);                                                 ║
 * ║        WakaCanvas.beginPaint(dc);                                                       ║
 * ║                                                                                         ║
 * ║        WakaCanvas.selectBrush(dc, '#3a86ff');                                           ║
 * ║        WakaCanvas.selectPen(dc, '#1a56cf', 2);                                          ║
 * ║        WakaCanvas.drawRect(dc, 10, 10, 200, 50);                                        ║
 * ║        WakaCanvas.addHitRect(dc, 10, 10, 200, 50, 'button');                            ║
 * ║                                                                                         ║
 * ║        WakaCanvas.selectFont(dc, 'heading', 16);                                        ║
 * ║        WakaCanvas.selectBrush(dc, '#fff');                                              ║
 * ║        WakaCanvas.selectPen(dc, null);                                                  ║
 * ║        WakaCanvas.drawText(dc, 'Click me', 110, 35);                                    ║
 * ║                                                                                         ║
 * ║        WakaCanvas.endPaint(dc);                                                         ║
 * ║        wakaPAC.releaseDC(dc);                                                           ║
 * ║        break;                                                                           ║
 * ║    }                                                                                    ║
 * ║                                                                                         ║
 * ║  Hit testing (fully decoupled from drawing):                                            ║
 * ║    WakaCanvas.addHitRect(dc, x, y, w, h, data)                                          ║
 * ║    WakaCanvas.addHitCircle(dc, cx, cy, r, data)                                         ║
 * ║    WakaCanvas.addHitPolygon(dc, points, data)                                           ║
 * ║    WakaCanvas.hitTest(dc, x, y)  → data | null                                          ║
 * ║                                                                                         ║
 * ║  Drawing functions (geometry only — DC is already configured):                          ║
 * ║    WakaCanvas.drawRect(dc, x, y, w, h)                                                  ║
 * ║    WakaCanvas.drawRoundRect(dc, x, y, w, h, radius)                                     ║
 * ║    WakaCanvas.drawCircle(dc, cx, cy, r)                                                 ║
 * ║    WakaCanvas.drawEllipse(dc, cx, cy, rx, ry [, rotation])                              ║
 * ║    WakaCanvas.drawLine(dc, x1, y1, x2, y2)                                              ║
 * ║    WakaCanvas.drawPolyline(dc, points)                                                  ║
 * ║    WakaCanvas.drawPolygon(dc, points)                                                   ║
 * ║    WakaCanvas.drawArc(dc, cx, cy, r, startAngle, endAngle [, ccw])                      ║
 * ║    WakaCanvas.drawText(dc, text, x, y [, maxWidth])                                     ║
 * ║    WakaCanvas.drawImage(dc, bitmap, dx, dy [, dw, dh])                                  ║
 * ║    WakaCanvas.measureText(dc, text)  → { width, ascent, descent, height } | null        ║
 * ║                                                                                         ║
 * ║  MetaFile compilation:                                                                  ║
 * ║    const mf = new wakaPAC.MetaFile();                                                   ║
 * ║    WakaCanvas.beginPaint(mf);                                                           ║
 * ║    WakaCanvas.selectBrush(mf, '#3a86ff');                                               ║
 * ║    WakaCanvas.selectPen(mf, '#1a56cf', 2);                                              ║
 * ║    WakaCanvas.drawRect(mf, 10, 10, 200, 50);                                            ║
 * ║    WakaCanvas.endPaint(mf);                                                             ║
 * ║    const dl = mf.build();                                                               ║
 * ║                                                                                         ║
 * ╚═════════════════════════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /** @type {string} */
    const VERSION = '1.0.0';

    /**
     * Message broadcast to all components when a font finishes loading.
     * wParam: alias name (string)
     * lParam: { alias: string, family: string }
     * @type {number}
     */
    const MSG_FONT_LOADED = 0xC001;

    /**
     * Message broadcast to all components when a font fails to load.
     * wParam: alias name (string)
     * lParam: { alias: string, url: string }
     * @type {number}
     */
    const MSG_FONT_FAILED = 0xC002;


    // =========================================================================
    // FONT REGISTRY
    // =========================================================================

    /**
     * Registered font descriptors keyed by alias name.
     *
     * @type {Map<string, {
     *   family:  string,
     *   weight:  string|number,
     *   style:   string,
     *   ready:   boolean,
     *   face:    FontFace|null
     * }>}
     */
    const _fonts = new Map();

    /** Cached wakaPAC reference, set in createPacPlugin(). @type {Object|null} */
    let _pac = null;

    /**
     * Broadcasts MSG_FONT_LOADED to all components when a font finishes loading.
     * @param {string} alias   - The registered alias name
     * @param {string} family  - The resolved CSS family name
     */
    function _broadcastFontLoaded(alias, family) {
        if (!_pac) {
            return;
        }

        _pac.broadcastMessage(MSG_FONT_LOADED, alias, { alias, family });
    }

    /**
     * Broadcasts MSG_FONT_FAILED to all components when a font fails to load.
     * @param {string} alias  - The registered alias name
     * @param {string} url    - The URL that failed
     */
    function _broadcastFontFailed(alias, url) {
        if (!_pac) {
            return;
        }

        _pac.broadcastMessage(MSG_FONT_FAILED, alias, { alias, url });
    }

    // =========================================================================
    // GOOGLE FONTS RESOLUTION
    // =========================================================================

    /**
     * Google Fonts resolution.
     * Detects Google Fonts stylesheet URLs, fetches them, parses the CSS,
     * and resolves the binary woff2 URL for the requested weight and latin subset.
     */
    const GoogleFonts = {

        /**
         * Returns true if the URL is a Google Fonts stylesheet URL.
         * @param {string} url
         * @returns {boolean}
         */
        isUrl(url) {
            return url.startsWith('https://fonts.googleapis.com/');
        },

        /**
         * Extracts the value of a CSS property from a @font-face block.
         * @param {string} block
         * @param {string} prop  e.g. 'font-weight', 'src', 'font-family'
         * @returns {string|null}
         */
        extractProp(block, prop) {
            const re = new RegExp(prop + '\\s*:\\s*([^;]+);', 'i');
            const m = re.exec(block);
            return m ? m[1].trim() : null;
        },

        /**
         * Extracts the first url(...) value from a src property string.
         * Handles both quoted and unquoted URLs, and format() hints.
         * @param {string} src
         * @returns {string|null}
         */
        extractUrl(src) {
            const m = /url\(['"]?([^'")\s]+)['"]?\)/.exec(src);
            return m ? m[1] : null;
        },

        /**
         * Parses a Google Fonts CSS stylesheet and extracts the font binary URL
         * and family name for the latin subset, filtered by weight.
         *
         * Strategy:
         *  1. Split the stylesheet into @font-face blocks.
         *  2. Find all blocks matching the requested weight.
         *  3. Among those, prefer the block commented '/* latin *\/' by Google.
         *     Fall back to the first matching block if no latin block is found.
         *  4. Return { family, url } extracted from the winning block.
         *
         * @param {string} css
         * @param {string|number} weight
         * @returns {{ family: string, url: string } | null}
         */
        parseCSS(css, weight) {
            const targetWeight = String(weight ?? 'normal');
            const blocks = css.split('@font-face').slice(1);

            if (blocks.length === 0) {
                return null;
            }

            // Filter blocks by weight
            const weightMatches = blocks.filter((block) => {
                const w = this.extractProp(block, 'font-weight');

                // No weight declared — treat as normal
                if (!w) {
                    return targetWeight === 'normal' || targetWeight === '400';
                }

                // Google may declare a range e.g. "400 700" for variable fonts
                if (w.includes(' ')) {
                    const [lo, hi] = w.split(/\s+/).map(Number);
                    const t = parseInt(targetWeight, 10);
                    return !isNaN(t) && t >= lo && t <= hi;
                }

                return w === targetWeight;
            });

            // Fall back to all blocks if weight filter yields nothing
            const candidates = weightMatches.length > 0 ? weightMatches : blocks;

            // Prefer latin subset — Google Fonts marks it with a '/* latin */' comment
            const latinBlock = candidates.find((block) => /\/\*\s*latin\s*\*\//.test(block));
            const winner = latinBlock ?? candidates[0];

            // Extract data from the Google result
            const rawFamily = this.extractProp(winner, 'font-family');
            const family = rawFamily ? rawFamily.replace(/['"]/g, '').trim() : null;
            const src = this.extractProp(winner, 'src');
            const url = src ? this.extractUrl(src) : null;

            // If failed to extract family or url, return null
            if (!family || !url) {
                return null;
            }

            return { family, url };
        },

        /**
         * Fetches a Google Fonts stylesheet and resolves the binary woff2 URL
         * for the requested weight and latin subset.
         *
         * A modern Chrome User-Agent is sent to ensure the API returns woff2
         * URLs rather than older woff or ttf formats.
         *
         * @param {string} stylesheetUrl
         * @param {string|number} weight
         * @returns {Promise<{ family: string, url: string } | null>}
         */
        async resolve(stylesheetUrl, weight) {
            try {
                const response = await fetch(stylesheetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (!response.ok) {
                    console.warn(`WakaCanvas.GoogleFonts: fetch failed (${response.status}) for ${stylesheetUrl}`);
                    return null;
                }

                const css = await response.text();
                const result = this.parseCSS(css, weight);

                if (!result) {
                    console.warn(`WakaCanvas.GoogleFonts: could not parse CSS from ${stylesheetUrl}`);
                }

                return result;
            } catch (err) {
                console.warn('WakaCanvas.GoogleFonts: error fetching stylesheet', err);
                return null;
            }
        }
    };

    // =========================================================================
    // BRUSH RESOLUTION
    // =========================================================================

    /**
     * @typedef {{ _type: 'linear', x1: number, y1: number, x2: number, y2: number, _stops: Array<{offset:number,color:string}>, _fallback: string, addColorStop: function }} LinearGradientBrush
     * @typedef {{ _type: 'radial', x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, _stops: Array<{offset:number,color:string}>, _fallback: string, addColorStop: function }} RadialGradientBrush
     * @typedef {{ _type: 'pattern', source: HTMLImageElement|HTMLCanvasElement|CanvasRenderingContext2D, repetition: string, _fallback: string }} PatternBrush
     */

    /**
     * Resolves a brush descriptor to a canvas-compatible fillStyle value.
     * Called by selectBrush() for live DC targets only — MetaFile targets
     * use the fallback color directly.
     *
     * @param {CanvasRenderingContext2D} dc
     * @param {string|Object} brush
     * @returns {string|CanvasGradient|CanvasPattern}
     */
    function _resolveBrush(dc, brush) {
        if (typeof brush === 'string') {
            return brush;
        }

        if (brush._type === 'linear') {
            const g = dc.createLinearGradient(brush.x1, brush.y1, brush.x2, brush.y2);
            brush._stops.forEach(s => g.addColorStop(s.offset, s.color));
            return g;
        }

        if (brush._type === 'radial') {
            const g = dc.createRadialGradient(brush.x1, brush.y1, brush.r1, brush.x2, brush.y2, brush.r2);
            brush._stops.forEach(s => g.addColorStop(s.offset, s.color));
            return g;
        }

        if (brush._type === 'pattern') {
            // Accept HTMLImageElement, HTMLCanvasElement, or wakaPAC bitmap handle
            const src = brush.source instanceof CanvasRenderingContext2D ? brush.source.canvas : brush.source;
            return dc.createPattern(src, brush.repetition) ?? brush._fallback;
        }

        return brush._fallback ?? '#000';
    }

    // =========================================================================
    // NULL BRUSH / NULL PEN TRACKING
    //
    // The canvas 2D API has no concept of NULL_BRUSH or NULL_PEN — setting
    // fillStyle or strokeStyle to null is not meaningful. We track which DCs
    // have a null brush or null pen selected so drawing functions can skip
    // fill/stroke operations accordingly.
    // =========================================================================

    /**
     * DCs with NULL_BRUSH selected. Fill operations are skipped.
     * @type {WeakSet<CanvasRenderingContext2D|Object>}
     */
    const _nullBrush = new WeakSet();

    /**
     * DCs with NULL_PEN selected. Stroke operations are skipped.
     * @type {WeakSet<CanvasRenderingContext2D|Object>}
     */
    const _nullPen = new WeakSet();

    // =========================================================================
    // HIT REGISTRY
    // =========================================================================

    /**
     * Per-DC hit area list. Cleared by beginPaint() each frame.
     * MetaFile targets do not participate in hit testing.
     * @type {WeakMap<CanvasRenderingContext2D, Array<Object>>}
     */
    const _hitRegistry = new WeakMap();

    // =========================================================================
    // GEOMETRY HELPERS
    // =========================================================================

    /**
     * Returns true if the point is inside the rectangle
     * @returns {boolean}
     * @private
     */
    function _ptInRect(px, py, x, y, w, h) {
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }

    /**
     * Returns true if the point is inside the circle
     * @returns {boolean}
     * @private
     */
    function _ptInCircle(px, py, cx, cy, r) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy <= r * r;
    }

    /**
     * Point-in-polygon using ray casting (even-odd rule).
     * Works for convex and concave polygons.
     * @returns {boolean}
     * @private
     */
    function _ptInPolygon(px, py, points) {
        let inside = false;
        const n = points.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;

            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    // =========================================================================
    // DC / METAFILE DETECTION
    // =========================================================================

    /**
     * Returns true if dc is a wakaPAC MetaFile instance.
     * @param {*} dc
     * @returns {boolean}
     */
    function _isMetaFile(dc) {
        return dc !== null &&
            typeof dc === 'object' &&
            Array.isArray(dc._ops) &&
            typeof dc.build === 'function';
    }

    // =========================================================================
    // WAKA CANVAS
    // =========================================================================

    /**
     * WakaCanvas — GDI-style canvas drawing plugin for wakaPAC.
     * @constructor
     */
    function WakaCanvas() {
    }

    WakaCanvas.prototype = {
        constructor: WakaCanvas,

        // ─── Plugin registration ──────────────────────────────────────────────

        /**
         * Called by wakaPAC.use(wakaCanvas).
         * @param {Object} pac
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin(pac) {
            _pac = pac;
            return { name: 'WakaCanvas' };
        },

        // ─── Font management ──────────────────────────────────────────────────

        /**
         * Loads and registers a custom font under a named alias.
         *
         * Accepts both local font file URLs and Google Fonts stylesheet URLs.
         * For Google Fonts URLs (fonts.googleapis.com), the stylesheet is fetched,
         * parsed for the latin subset at the requested weight, and the binary font
         * URL is loaded via FontFace. Falls back to the first available subset if
         * no latin subset is present.
         *
         * When loading completes, broadcasts MSG_FONT_LOADED to all components
         * with wParam = alias and lParam = { alias, family }.
         *
         * @param {string} name          - Alias used in selectFont() (e.g. 'heading')
         * @param {string} url           - Local font file URL or Google Fonts stylesheet URL
         * @param {Object} [descriptors]
         * @param {string|number} [descriptors.weight='normal']
         * @param {string} [descriptors.style='normal']
         * @param {string} [descriptors.display='swap']
         * @param {string} [descriptors.family]  Override derived CSS family name (local only)
         * @returns {Promise<boolean>}
         */
        async loadFont(name, url, descriptors = {}) {
            if (!name || !url) {
                console.warn('WakaCanvas.loadFont: name and url are required');
                return false;
            }

            // Already registered (loading or loaded) — do not start another load
            const existing = _fonts.get(name);
            if (existing) {
                return existing.ready;
            }

            const weight = descriptors.weight ?? 'normal';
            const style = descriptors.style ?? 'normal';

            let family;
            let binaryUrl;

            if (GoogleFonts.isUrl(url)) {
                // Google Fonts path — fetch stylesheet and resolve binary URL
                const resolved = await GoogleFonts.resolve(url, weight);

                if (!resolved) {
                    console.warn(`WakaCanvas.loadFont: could not resolve Google Font for alias "${name}"`);
                    return false;
                }

                family = resolved.family;
                binaryUrl = resolved.url;
            } else {
                // Local font path — derive family from filename or use override
                // '/fonts/Inter-Bold.woff2' → 'Inter-Bold'
                family = descriptors.family ?? url.split('/').pop().replace(/\.[^.]+$/, '');
                binaryUrl = url;
            }

            const entry = { family, weight, style, ready: false, face: null };
            _fonts.set(name, entry);

            try {
                const face = new FontFace(family, `url(${binaryUrl})`, {
                    weight: String(weight),
                    style,
                    display: descriptors.display ?? 'swap'
                });

                await face.load();
                document.fonts.add(face);

                entry.face = face;
                entry.ready = true;

                _broadcastFontLoaded(name, family);
                return true;
            } catch (err) {
                console.warn(`WakaCanvas.loadFont: failed to load "${name}" from "${binaryUrl}"`, err);
                _fonts.delete(name);
                _broadcastFontFailed(name, binaryUrl);
                return false;
            }
        },

        /**
         * Returns true if the named font has finished loading.
         * @param {string} name
         * @returns {boolean}
         */
        isFontReady(name) {
            const entry = _fonts.get(name);
            return !!entry && entry.ready;
        },

        /**
         * Returns the resolved CSS font shorthand for a registered alias.
         * Useful for ctx.measureText() calls outside a drawing context.
         *
         * @param {string} name
         * @param {number} size
         * @param {Object} [overrides]  Optional: weight, style
         * @returns {string}
         */
        fontString(name, size, overrides = {}) {
            const entry = _fonts.get(name);
            const weight = overrides.weight ?? entry?.weight ?? 'normal';
            const style = overrides.style ?? entry?.style ?? 'normal';
            const family = entry?.family ?? name;
            return `${style} ${weight} ${size}px ${family}`;
        },

        // ─── Paint cycle ──────────────────────────────────────────────────────

        /**
         * Begins a paint cycle. Applies Win32 DC defaults to the live DC and
         * clears the hit registry for this frame.
         *
         * Default state mirrors GetDC() defaults:
         *   brush     NULL_BRUSH  (no fill)
         *   pen       BLACK_PEN   (1px solid black)
         *   font      SYSTEM_FONT (12px sans-serif)
         *   alpha     1
         *   shadow    none
         *   lineDash  solid
         *
         * For MetaFile targets the defaults are recorded as ops so the display
         * list is self-contained and playable without prior DC setup.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         */
        beginPaint(dc) {
            if (_isMetaFile(dc)) {
                _nullBrush.add(dc);
                _nullPen.delete(dc);
                dc.setStrokeStyle('#000');
                dc.setLineWidth(1);
                dc.setLineCap('butt');
                dc.setLineJoin('miter');
                dc.setFont('12px sans-serif');
                dc.setTextAlign('left');
                dc.setTextBaseline('middle');
                dc.setGlobalAlpha(1);
                dc.setLineDash([]);
                return;
            }

            _nullBrush.add(dc);
            _nullPen.delete(dc);
            dc.strokeStyle = '#000';
            dc.lineWidth = 1;
            dc.lineCap = 'butt';
            dc.lineJoin = 'miter';
            dc.font = '12px sans-serif';
            dc.textAlign = 'left';
            dc.textBaseline = 'middle';
            dc.globalAlpha = 1;
            dc.shadowColor = 'transparent';
            dc.shadowBlur = 0;
            dc.setLineDash([]);
            _hitRegistry.set(dc, []);
        },

        /**
         * Ends the paint cycle. Reserved for future use.
         * @param {CanvasRenderingContext2D|Object} dc
         */
        endPaint(dc) {
            // Reserved for future use
        },

        // ─── GDI object selection (write-through) ─────────────────────────────

        /**
         * Selects a font into the DC. Writes through immediately.
         * Equivalent to Win32 SelectObject(hdc, hFont).
         *
         * If the alias is registered but not yet loaded, falls back to sans-serif
         * for this paint cycle. MSG_FONT_LOADED will be broadcast when the font
         * lands, giving components the opportunity to repaint.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string} name    - Registered alias or raw CSS family name
         * @param {number} size    - Font size in pixels
         * @param {Object} [opts]
         * @param {string|number} [opts.weight='normal']
         * @param {string} [opts.style='normal']
         */
        selectFont(dc, name, size, opts = {}) {
            const entry = _fonts.get(name);
            const weight = opts.weight ?? entry?.weight ?? 'normal';
            const style = opts.style ?? entry?.style ?? 'normal';
            const family = (entry && entry.ready) ? entry.family : (entry ? 'sans-serif' : name);
            const str = `${style} ${weight} ${size}px ${family}`;

            if (_isMetaFile(dc)) {
                dc.setFont(str);
                return;
            }

            dc.font = str;
        },

        /**
         * Selects a brush into the DC. Writes through immediately.
         * Equivalent to Win32 SelectObject(hdc, CreateSolidBrush/CreateGradientBrush).
         *
         * Accepts:
         *   null                  — NULL_BRUSH (no fill)
         *   string                — solid CSS color
         *   LinearGradientBrush   — from WakaCanvas.linearGradient()
         *   RadialGradientBrush   — from WakaCanvas.radialGradient()
         *   PatternBrush          — from WakaCanvas.patternBrush()
         *
         * The brush also serves as the text color for drawText().
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string|LinearGradientBrush|RadialGradientBrush|PatternBrush|null} brush
         */
        selectBrush(dc, brush) {
            if (brush === null) {
                _nullBrush.add(dc);
                return;
            }

            _nullBrush.delete(dc);

            // Resolve brush descriptor to a canvas fillStyle value
            const fillStyle = _isMetaFile(dc) ? null : _resolveBrush(dc, brush);

            if (_isMetaFile(dc)) {
                // Gradients and patterns cannot be serialised to a MetaFile —
                // emit the fallback solid color so the display list remains valid.
                const fallback = (typeof brush === 'string') ? brush : (brush._fallback ?? '#000');
                dc.setFillStyle(fallback);
                return;
            }

            dc.fillStyle = fillStyle;
        },

        /**
         * Creates a linear gradient brush descriptor.
         * Pass the result to selectBrush(). The gradient is resolved against
         * the DC at selection time, not at creation time.
         *
         * @param {number} x1
         * @param {number} y1
         * @param {number} x2
         * @param {number} y2
         * @param {string} [fallback='#000']  Solid color used when target is a MetaFile
         * @returns {LinearGradientBrush}
         */
        linearGradient(x1, y1, x2, y2, fallback = '#000') {
            return {
                _type: 'linear', x1, y1, x2, y2, _stops: [], _fallback: fallback,
                addColorStop(offset, color) {
                    this._stops.push({ offset, color });
                    return this;
                }
            };
        },

        /**
         * Creates a radial gradient brush descriptor.
         * Pass the result to selectBrush(). The gradient is resolved against
         * the DC at selection time, not at creation time.
         *
         * @param {number} x1        Center of start circle
         * @param {number} y1
         * @param {number} r1        Radius of start circle
         * @param {number} x2        Center of end circle
         * @param {number} y2
         * @param {number} r2        Radius of end circle
         * @param {string} [fallback='#000']
         * @returns {RadialGradientBrush}
         */
        radialGradient(x1, y1, r1, x2, y2, r2, fallback = '#000') {
            return {
                _type: 'radial', x1, y1, r1, x2, y2, r2, _stops: [], _fallback: fallback,
                addColorStop(offset, color) {
                    this._stops.push({ offset, color });
                    return this;
                }
            };
        },

        /**
         * Creates a pattern brush descriptor.
         * Pass the result to selectBrush(). The pattern is resolved against
         * the DC at selection time.
         *
         * @param {HTMLImageElement|HTMLCanvasElement|CanvasRenderingContext2D} source
         *   Accepts a raw HTMLImageElement, HTMLCanvasElement, or a wakaPAC
         *   bitmap handle (CanvasRenderingContext2D from loadBitmap()).
         * @param {string} [repetition='repeat']  'repeat'|'repeat-x'|'repeat-y'|'no-repeat'
         * @param {string} [fallback='#000']
         * @returns {PatternBrush}
         */
        patternBrush(source, repetition = 'repeat', fallback = '#000') {
            return { _type: 'pattern', source, repetition, _fallback: fallback };
        },

        /**
         * Selects a pen (stroke color and width) into the DC. Writes through immediately.
         * Equivalent to Win32 SelectObject(hdc, CreatePen(PS_SOLID, width, color)).
         *
         * Pass null for NULL_PEN — drawing calls will not stroke.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string|null} color
         * @param {number} [width=1]
         * @param {Object} [opts]
         * @param {string} [opts.lineCap='butt']    'butt'|'round'|'square'
         * @param {string} [opts.lineJoin='miter']  'miter'|'round'|'bevel'
         */
        selectPen(dc, color, width = 1, opts = {}) {
            if (color === null) {
                _nullPen.add(dc);
                return;
            }

            _nullPen.delete(dc);

            if (_isMetaFile(dc)) {
                dc.setStrokeStyle(color);
                dc.setLineWidth(width);
                dc.setLineCap(opts.lineCap ?? 'butt');
                dc.setLineJoin(opts.lineJoin ?? 'miter');
                return;
            }

            dc.strokeStyle = color;
            dc.lineWidth = width;
            dc.lineCap = opts.lineCap ?? 'butt';
            dc.lineJoin = opts.lineJoin ?? 'miter';
        },

        /**
         * Selects global alpha into the DC. Writes through immediately.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} alpha  0–1
         */
        selectAlpha(dc, alpha) {
            if (_isMetaFile(dc)) {
                dc.setGlobalAlpha(alpha);
                return;
            }

            dc.globalAlpha = alpha;
        },

        /**
         * Selects a shadow into the DC. Writes through immediately.
         * Pass null to clear.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string|null} color
         * @param {number} [blur=0]
         * @param {number} [offsetX=0]
         * @param {number} [offsetY=0]
         */
        selectShadow(dc, color, blur = 0, offsetX = 0, offsetY = 0) {
            if (_isMetaFile(dc)) {
                dc.setShadow(
                    color ?? 'transparent',
                    color ? blur : 0,
                    color ? offsetX : 0,
                    color ? offsetY : 0
                );
                return;
            }

            dc.shadowColor = color ?? 'transparent';
            dc.shadowBlur = color ? blur : 0;
            dc.shadowOffsetX = color ? offsetX : 0;
            dc.shadowOffsetY = color ? offsetY : 0;
        },

        /**
         * Selects a line dash pattern into the DC. Writes through immediately.
         * Pass null or [] for a solid line.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number[]|null} pattern
         */
        selectLineDash(dc, pattern) {
            const dash = (pattern && pattern.length > 0) ? pattern : [];
            dc.setLineDash(dash);
        },

        /**
         * Selects text alignment into the DC. Writes through immediately.
         * Equivalent to Win32 SetTextAlign().
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string} align  'left'|'center'|'right'|'start'|'end'
         */
        selectTextAlign(dc, align) {
            if (_isMetaFile(dc)) {
                dc.setTextAlign(align);
                return;
            }

            dc.textAlign = align;
        },

        /**
         * Selects text baseline into the DC. Writes through immediately.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string} baseline  'top'|'middle'|'bottom'|'alphabetic'|'hanging'|'ideographic'
         */
        selectTextBaseline(dc, baseline) {
            if (_isMetaFile(dc)) {
                dc.setTextBaseline(baseline);
                return;
            }

            dc.textBaseline = baseline;
        },

        /**
         * Sets an absolute transform on the DC. Writes through immediately.
         * Equivalent to Win32 SetWorldTransform().
         *
         * The transform replaces the current DC transform entirely (absolute,
         * not cumulative). Use resetTransform() to return to the identity matrix.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {Object} t  - Transform matrix components
         * @param {number} [t.a=1]   Horizontal scaling
         * @param {number} [t.b=0]   Horizontal skewing
         * @param {number} [t.c=0]   Vertical skewing
         * @param {number} [t.d=1]   Vertical scaling
         * @param {number} [t.e=0]   Horizontal translation
         * @param {number} [t.f=0]   Vertical translation
         */
        selectTransform(dc, t) {
            const a = t.a ?? 1, b = t.b ?? 0, c = t.c ?? 0;
            const d = t.d ?? 1, e = t.e ?? 0, f = t.f ?? 0;

            if (_isMetaFile(dc)) {
                dc.setTransform(a, b, c, d, e, f);
                return;
            }

            dc.setTransform(a, b, c, d, e, f);
        },

        /**
         * Resets the DC transform to the identity matrix.
         * Equivalent to calling selectTransform(dc, {}).
         * @param {CanvasRenderingContext2D|Object} dc
         */
        resetTransform(dc) {
            if (_isMetaFile(dc)) {
                dc.setTransform(1, 0, 0, 1, 0, 0);
                return;
            }

            dc.resetTransform();
        },

        // ─── Hit testing ──────────────────────────────────────────────────────

        /**
         * Registers an axis-aligned rectangular hit area.
         * Fully decoupled from drawing. No-op for MetaFile targets.
         * @param {CanvasRenderingContext2D} dc
         * @param {number} x
         * @param {number} y
         * @param {number} w
         * @param {number} h
         * @param {*} data
         */
        addHitRect(dc, x, y, w, h, data) {
            if (!_hitRegistry.has(dc)) {
                return;
            }

            _hitRegistry.get(dc).push({ shape: 'rect', x, y, w, h, data });
        },

        /**
         * Registers a circular hit area.
         * No-op for MetaFile targets.
         * @param {CanvasRenderingContext2D} dc
         * @param {number} cx
         * @param {number} cy
         * @param {number} r
         * @param {*} data
         */
        addHitCircle(dc, cx, cy, r, data) {
            if (!_hitRegistry.has(dc)) {
                return;
            }

            _hitRegistry.get(dc).push({ shape: 'circle', cx, cy, r, data });
        },

        /**
         * Registers a polygonal hit area (ray casting, even-odd rule).
         * No-op for MetaFile targets.
         * @param {CanvasRenderingContext2D} dc
         * @param {Array<{x:number,y:number}>} points
         * @param {*} data
         */
        addHitPolygon(dc, points, data) {
            if (!_hitRegistry.has(dc)) {
                return;
            }

            _hitRegistry.get(dc).push({ shape: 'polygon', points, data });
        },

        /**
         * Tests a point against all registered hit areas for this DC.
         * Last registered area wins (painter's algorithm z-order).
         * Returns null if no hit or called on a MetaFile target.
         * @param {CanvasRenderingContext2D} dc
         * @param {number} x
         * @param {number} y
         * @returns {*|null}
         */
        hitTest(dc, x, y) {
            const areas = _hitRegistry.get(dc);

            if (!areas || areas.length === 0) {
                return null;
            }

            for (let i = areas.length - 1; i >= 0; i--) {
                const area = areas[i];

                switch (area.shape) {
                    case 'rect':
                        if (_ptInRect(x, y, area.x, area.y, area.w, area.h)) {
                            return area.data;
                        }

                        break;

                    case 'circle':
                        if (_ptInCircle(x, y, area.cx, area.cy, area.r)) {
                            return area.data;
                        }

                        break;

                    case 'polygon':
                        if (_ptInPolygon(x, y, area.points)) {
                            return area.data;
                        }

                        break;
                }
            }

            return null;
        },

        // ─── Drawing functions (geometry only) ────────────────────────────────

        /**
         * Draws a filled and/or stroked rectangle.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} x
         * @param {number} y
         * @param {number} w
         * @param {number} h
         */
        drawRect(dc, x, y, w, h) {
            if (!_nullBrush.has(dc)) {
                dc.fillRect(x, y, w, h);
            }

            if (!_nullPen.has(dc)) {
                dc.strokeRect(x, y, w, h);
            }
        },

        /**
         * Draws a rectangle with rounded corners.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} x
         * @param {number} y
         * @param {number} w
         * @param {number} h
         * @param {number|number[]} radius  Corner radius or [tl, tr, br, bl]
         */
        drawRoundRect(dc, x, y, w, h, radius) {
            dc.beginPath();
            dc.roundRect(x, y, w, h, radius);

            if (!_nullBrush.has(dc)) {
                dc.fill();
            }

            if (!_nullPen.has(dc)) {
                dc.stroke();
            }
        },

        /**
         * Draws a circle.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} cx
         * @param {number} cy
         * @param {number} r
         */
        drawCircle(dc, cx, cy, r) {
            dc.beginPath();
            dc.arc(cx, cy, r, 0, Math.PI * 2);

            if (!_nullBrush.has(dc)) {
                dc.fill();
            }

            if (!_nullPen.has(dc)) {
                dc.stroke();
            }
        },

        /**
         * Draws an ellipse.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} cx
         * @param {number} cy
         * @param {number} rx
         * @param {number} ry
         * @param {number} [rotation=0]  Radians
         */
        drawEllipse(dc, cx, cy, rx, ry, rotation = 0) {
            dc.beginPath();
            dc.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);

            if (!_nullBrush.has(dc)) {
                dc.fill();
            }

            if (!_nullPen.has(dc)) {
                dc.stroke();
            }
        },

        /**
         * Draws a straight line. No-op if NULL_PEN is selected.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} x1
         * @param {number} y1
         * @param {number} x2
         * @param {number} y2
         */
        drawLine(dc, x1, y1, x2, y2) {
            if (_nullPen.has(dc)) {
                return;
            }

            dc.beginPath();
            dc.moveTo(x1, y1);
            dc.lineTo(x2, y2);
            dc.stroke();
        },

        /**
         * Draws an open polyline. No-op if NULL_PEN or fewer than 2 points.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {Array<{x:number,y:number}>} points
         */
        drawPolyline(dc, points) {
            if (_nullPen.has(dc) || !points || points.length < 2) {
                return;
            }

            dc.beginPath();
            dc.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                dc.lineTo(points[i].x, points[i].y);
            }

            dc.stroke();
        },

        /**
         * Draws a closed polygon. No-op if fewer than 3 points.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {Array<{x:number,y:number}>} points
         */
        drawPolygon(dc, points) {
            if (!points || points.length < 3) {
                return;
            }

            dc.beginPath();
            dc.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                dc.lineTo(points[i].x, points[i].y);
            }

            dc.closePath();

            if (!_nullBrush.has(dc)) {
                dc.fill();
            }

            if (!_nullPen.has(dc)) {
                dc.stroke();
            }
        },

        /**
         * Draws an arc. No-op if NULL_PEN is selected.
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {number} cx
         * @param {number} cy
         * @param {number} r
         * @param {number} startAngle  Radians, 0 = right
         * @param {number} endAngle    Radians
         * @param {boolean} [ccw=false]
         */
        drawArc(dc, cx, cy, r, startAngle, endAngle, ccw = false) {
            if (_nullPen.has(dc)) {
                return;
            }

            dc.beginPath();
            dc.arc(cx, cy, r, startAngle, endAngle, ccw);
            dc.stroke();
        },

        /**
         * Draws text using the selected font and brush (fill color).
         * The brush is the text color — equivalent to Win32 SetTextColor().
         * No-op if NULL_BRUSH is selected.
         *
         * If the selected font alias is registered but not yet loaded, text is
         * rendered immediately using the sans-serif fallback font. This matches
         * GDI behaviour — output is never suppressed due to font load state.
         * Components should listen for MSG_FONT_LOADED and repaint to pick up
         * the correct typeface once it arrives.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {string} text
         * @param {number} x
         * @param {number} y
         * @param {number} [maxWidth]
         */
        drawText(dc, text, x, y, maxWidth) {
            if (_nullBrush.has(dc)) {
                return;
            }

            dc.fillText(text, x, y, maxWidth);

            if (!_nullPen.has(dc)) {
                dc.strokeText(text, x, y, maxWidth);
            }
        },

        /**
         * Draws a bitmap (from wakaPAC.loadBitmap()) at the given position.
         * Respects selected alpha.
         *
         * @param {CanvasRenderingContext2D|Object} dc
         * @param {CanvasRenderingContext2D} bitmap
         * @param {number} dx
         * @param {number} dy
         * @param {number} [dw]
         * @param {number} [dh]
         */
        drawImage(dc, bitmap, dx, dy, dw, dh) {
            if (!bitmap) {
                return;
            }

            const srcCanvas = bitmap.canvas;

            dc.drawImage(srcCanvas, dx, dy, dw ?? srcCanvas.width, dh ?? srcCanvas.height);
        },

        /**
         * Measures a text string using the DC's current font.
         * Returns a WakaCanvas TextMetrics subset. Returns null for MetaFile targets.
         * @param {CanvasRenderingContext2D} dc
         * @param {string} text
         * @returns {{ width: number, ascent: number, descent: number, height: number } | null}
         */
        measureText(dc, text) {
            if (_isMetaFile(dc)) {
                return null;
            }

            const m = dc.measureText(text);

            return {
                width: m.width,
                ascent: m.actualBoundingBoxAscent,
                descent: m.actualBoundingBoxDescent,
                height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
            };
        }
    };

    /** @type {string} */
    WakaCanvas.VERSION = VERSION;

    /**
     * Message broadcast to all components when a font finishes loading.
     * wParam: alias name (string)
     * lParam: { alias: string, family: string }
     * @type {number}
     */
    WakaCanvas.MSG_FONT_LOADED = MSG_FONT_LOADED;
    WakaCanvas.MSG_FONT_FAILED = MSG_FONT_FAILED;

    /** @type {WakaCanvas} */
    const wakaCanvas = new WakaCanvas();

    window.WakaCanvas = WakaCanvas;
    window.wakaCanvas = wakaCanvas;

})();