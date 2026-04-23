/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗    ██╗       ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║    ██║       ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║  ██║██║  ██║██████╔╝███████║██║ █╗ ██║       ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║  ██║██║  ██║██╔══██╗██╔══██║██║███╗██║       ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝██████╔╝██║  ██║██║  ██║╚███╔███╔╝       ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝        ║
 * ║                                                                                      ║
 * ║  WakaDDraw - Sprite and Dirty Rectangle Plugin for wakaPAC                           ║
 * ║                                                                                      ║
 * ║  Inspired by DirectDraw's surface/sprite model. A Surface owns pixel data,           ║
 * ║  frame geometry, a sprite list, and a dirty rect list. Sprites are blitted           ║
 * ║  back to front into the DC on paint(), repainting only damaged regions.              ║
 * ║                                                                                      ║
 * ║  The browser compositor already double-buffers; no explicit back buffer is needed.   ║
 * ║  Color keying is applied at load time — magenta (#ff00ff) pixels become alpha=0.     ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(wakaDDraw);                                                           ║
 * ║                                                                                      ║
 * ║  Surface management:                                                                 ║
 * ║    // From an image file:                                                            ║
 * ║    const surface = await wakaDDraw.loadSurface('/img/hero.png', {                   ║
 * ║        frameW: 32, frameH: 32,                                                      ║
 * ║        colorKey: '#ff00ff',   // optional, defaults to '#ff00ff'                    ║
 * ║        background: '#1a2a3a'  // optional scene background color                    ║
 * ║    });                                                                               ║
 * ║                                                                                      ║
 * ║    // Blank, drawn into programmatically:                                            ║
 * ║    const surface = wakaDDraw.createSurface(128, 32, 32, 32, {                       ║
 * ║        colorKey: '#ff00ff',   // optional                                            ║
 * ║        background: '#1a2a3a'  // optional                                            ║
 * ║    });                                                                               ║
 * ║    // draw into surface._ctx, then:                                                  ║
 * ║    wakaDDraw.applyColorKey(surface);                                                 ║
 * ║                                                                                      ║
 * ║    surface.frames  // total frame count derived from surface dimensions              ║
 * ║                                                                                      ║
 * ║  Sprite management:                                                                  ║
 * ║    const hero = wakaDDraw.createSprite(surface, { x: 100, y: 80, z: 1 });           ║
 * ║    wakaDDraw.addSprite(surface, hero);                                               ║
 * ║    wakaDDraw.removeSprite(surface, hero);                                            ║
 * ║                                                                                      ║
 * ║  Per-frame loop (user-driven — WakaDDraw never schedules):                          ║
 * ║    hero.setFrame(n);    // set frame index; marks dirty if changed                   ║
 * ║    hero.moveTo(x, y);  // move sprite; marks old + new rect dirty                   ║
 * ║    hero.show();        // make visible; marks dirty                                  ║
 * ║    hero.hide();        // hide; marks dirty                                          ║
 * ║    hero.setZ(n);       // change z-order; re-sorts sprite list                       ║
 * ║                                                                                      ║
 * ║  Dirty rect management:                                                              ║
 * ║    wakaDDraw.addDirtyRect(surface, x, y, w, h);  // add arbitrary dirty rect        ║
 * ║    wakaDDraw.dirtyAll(surface);                   // mark entire surface dirty       ║
 * ║                                                                                      ║
 * ║  Paint cycle:                                                                        ║
 * ║    case wakaPAC.MSG_PAINT: {                                                         ║
 * ║        const dc = wakaPAC.getDC(pacId);                                              ║
 * ║        wakaDDraw.paint(surface, dc);                                                 ║
 * ║        wakaPAC.releaseDC(dc);                                                        ║
 * ║        break;                                                                        ║
 * ║    }                                                                                 ║
 * ║                                                                                      ║
 * ║  Pixel access:                                                                       ║
 * ║    const pixels = wakaDDraw.lock(surface);    // returns ImageData                   ║
 * ║    // ... mutate pixels.data ...                                                     ║
 * ║    wakaDDraw.unlock(surface, pixels);         // writes back                         ║
 * ║    wakaDDraw.applyColorKey(surface);          // re-apply color key after drawing    ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /** @type {string} */
    const VERSION = '1.0.0';

    // =========================================================================
    // COLOR KEY
    // =========================================================================

    /**
     * Default color key: magenta.
     * Pixels matching this color (ignoring alpha) are made fully transparent
     * at surface load time.
     * @type {string}
     */
    const DEFAULT_COLOR_KEY = '#ff00ff';

    /**
     * Parses a CSS color string into { r, g, b }.
     * Supports #rgb, #rrggbb, and rgb()/rgba() notation.
     * Returns null if the color cannot be parsed.
     *
     * @param {string} color
     * @returns {{ r: number, g: number, b: number } | null}
     */
    function _parseColor(color) {
        if (!color) {
            return null;
        }

        color = color.trim();

        // #rrggbb
        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        // #rgb — expand to #rrggbb
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return {
                r: parseInt(color[1] + color[1], 16),
                g: parseInt(color[2] + color[2], 16),
                b: parseInt(color[3] + color[3], 16)
            };
        }

        // rgb(...) / rgba(...)
        const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);

        if (m) {
            return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
        }

        return null;
    }

    /**
     * Applies a color key to an offscreen canvas context in-place.
     * Pixels whose RGB matches the key color exactly are set to alpha=0.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} colorKey  CSS color string
     */
    function _applyColorKey(ctx, colorKey) {
        const key = _parseColor(colorKey);

        if (!key) {
            console.warn(`WakaDDraw: could not parse colorKey "${colorKey}"`);
            return;
        }

        const { width, height } = ctx.canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === key.r && data[i + 1] === key.g && data[i + 2] === key.b) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    // =========================================================================
    // RECT HELPERS
    // =========================================================================

    /**
     * Returns true if two rectangles overlap (touching edges do not count).
     *
     * @param {number} ax
     * @param {number} ay
     * @param {number} aw
     * @param {number} ah
     * @param {number} bx
     * @param {number} by
     * @param {number} bw
     * @param {number} bh
     * @returns {boolean}
     */
    function _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw &&
            ax + aw > bx &&
            ay < by + bh &&
            ay + ah > by;
    }

    /**
     * Clamps a rectangle to fit within a bounding box.
     * Returns null if the clamped rect has zero or negative area.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} bw  Bounding width
     * @param {number} bh  Bounding height
     * @returns {{ x: number, y: number, w: number, h: number } | null}
     */
    function _clampRect(x, y, w, h, bw, bh) {
        const x2 = Math.min(x + w, bw);
        const y2 = Math.min(y + h, bh);
        const cx = Math.max(x, 0);
        const cy = Math.max(y, 0);
        const cw = x2 - cx;
        const ch = y2 - cy;

        if (cw <= 0 || ch <= 0) {
            return null;
        }

        return { x: cx, y: cy, w: cw, h: ch };
    }

    // =========================================================================
    // SURFACE
    // =========================================================================

    /**
     * A Surface owns:
     *   - an offscreen canvas holding pixel data (with color key applied)
     *   - frame geometry (frameW, frameH, total frame count)
     *   - a background definition for the compositor
     *   - a z-sorted sprite list
     *   - a non-overlapping dirty rect list
     *
     * Sprites are added to a surface via addSprite(). paint() composites
     * all dirty rects into the DC and clears the list.
     *
     * @typedef {{
     *   _ctx:        CanvasRenderingContext2D,
     *   _frameW:     number,
     *   _frameH:     number,
     *   _cols:       number,
     *   _background: string|CanvasRenderingContext2D,
     *   _sprites:    Sprite[],
     *   _dirty:      Array<{x:number, y:number, w:number, h:number}>,
     *   width:       number,
     *   height:      number,
     *   frames:      number,
     *   colorKey:    string|null,
     *   frameRect:   function(number): {sx:number, sy:number, sw:number, sh:number}
     * }} Surface
     */

    /**
     * Builds a Surface object from an OffscreenCanvas context.
     * Used by both loadSurface() and createSurface().
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number}      frameW
     * @param {number}      frameH
     * @param {string|null} colorKey
     * @param {string|CanvasRenderingContext2D} background
     * @returns {Surface}
     */
    function _buildSurface(ctx, frameW, frameH, colorKey, background) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const cols = Math.floor(w / frameW);
        const frames = cols * Math.floor(h / frameH);

        return {
            _ctx: ctx,
            _frameW: frameW,
            _frameH: frameH,
            _cols: cols,
            _background: background ?? '#000',
            _sprites: [],
            _dirty: [],
            width: w,
            height: h,
            frames,
            colorKey,

            /**
             * Returns the source rect for a given frame index.
             * Frames are ordered left to right, top to bottom.
             *
             * @param {number} frameIndex
             * @returns {{ sx: number, sy: number, sw: number, sh: number }}
             */
            frameRect(frameIndex) {
                const col = frameIndex % this._cols;
                const row = Math.floor(frameIndex / this._cols);
                return {
                    sx: col * this._frameW,
                    sy: row * this._frameH,
                    sw: this._frameW,
                    sh: this._frameH
                };
            }
        };
    }

    // =========================================================================
    // SPRITE
    // =========================================================================

    /**
     * A Sprite backed by a Surface. Tracks position, frame index, visibility,
     * and z-order. The caller drives animation timing and frame advancement.
     *
     * @typedef {{
     *   _surface:  Surface,
     *   _surface:  Surface|null,
     *   frame:     number,
     *   x:         number,
     *   y:         number,
     *   z:         number,
     *   visible:   boolean,
     *   rect:      { x: number, y: number, w: number, h: number },
     *   prevRect:  { x: number, y: number, w: number, h: number },
     *   setFrame:  function(number): void,
     *   moveTo:    function(number, number): void,
     *   show:      function(): void,
     *   hide:      function(): void,
     *   setZ:      function(number): void
     * }} Sprite
     */

    /**
     * Creates a Sprite.
     * Not called directly — use WakaDDraw.createSprite().
     *
     * @param {Surface} surface  The surface this sprite blits from
     * @param {number}  x
     * @param {number}  y
     * @param {number}  z
     * @returns {Sprite}
     */
    function _createSprite(surface, x, y, z) {
        const w = surface._frameW;
        const h = surface._frameH;
        x = Math.round(x);
        y = Math.round(y);

        const sprite = {
            _surface: surface,
            _parent: null,      // the surface this sprite is added to via addSprite()
            frame: 0,

            x, y, z,
            visible: true,

            rect: { x, y, w, h },
            prevRect: { x, y, w, h },

            /**
             * Sets the displayed frame index. Marks dirty if the frame changed.
             * Clamps to valid range [0, surface.frames - 1].
             *
             * @param {number} n
             */
            setFrame(n) {
                const clamped = Math.max(0, Math.min(surface.frames - 1, Math.round(n)));

                if (this.frame === clamped) {
                    return;
                }

                this.frame = clamped;
                _markSpriteDirty(this);
            },

            /**
             * Moves the sprite to a new position. Marks both the old and new
             * bounding rects dirty on the parent surface.
             *
             * @param {number} nx
             * @param {number} ny
             */
            moveTo(nx, ny) {
                nx = Math.round(nx);
                ny = Math.round(ny);

                if (this.x === nx && this.y === ny) {
                    return;
                }

                // Dirty old position
                _markSpriteDirty(this);

                this.prevRect = { ...this.rect };
                this.x = nx;
                this.y = ny;
                this.rect = { x: nx, y: ny, w, h };

                // Dirty new position
                _markSpriteDirty(this);
            },

            /**
             * Makes the sprite visible. Marks dirty if it was hidden.
             * No-op if already visible.
             */
            show() {
                if (this.visible) {
                    return;
                }

                this.visible = true;
                _markSpriteDirty(this);
            },

            /**
             * Hides the sprite. Marks dirty so the region is repainted
             * without it on the next paint(). No-op if already hidden.
             */
            hide() {
                if (!this.visible) {
                    return;
                }

                // Dirty before hiding — _markSpriteDirty checks visible
                _markSpriteDirty(this);
                this.visible = false;
            },

            /**
             * Changes the sprite's z-order and re-sorts the parent surface's
             * sprite list. Higher z is drawn on top. No-op if z is unchanged.
             *
             * @param {number} newZ
             */
            setZ(newZ) {
                if (this.z === newZ) {
                    return;
                }

                this.z = newZ;

                if (!this._parent) {
                    return;
                }

                this._parent._sprites.sort((a, b) => a.z - b.z);
                _markSpriteDirty(this);
            }
        };

        return sprite;
    }

    /**
     * Marks the sprite's current bounding rect dirty on its parent surface.
     * No-op if the sprite has no parent or is hidden.
     *
     * @param {Sprite} sprite
     */
    function _markSpriteDirty(sprite) {
        if (!sprite._parent || !sprite.visible) {
            return;
        }

        const r = sprite.rect;
        _addDirtyRect(sprite._parent, r.x, r.y, r.w, r.h);
    }

    // =========================================================================
    // DIRTY RECT SPLITTING
    // =========================================================================

    /**
     * Subtracts rectangle B from rectangle A, returning the fragments of A
     * that do not overlap B. Returns between 0 and 4 rects.
     *
     * @param {number} ax
     * @param {number} ay
     * @param {number} aw
     * @param {number} ah
     * @param {number} bx
     * @param {number} by
     * @param {number} bw
     * @param {number} bh
     * @returns {Array<{x:number, y:number, w:number, h:number}>}
     */
    function _subtractRect(ax, ay, aw, ah, bx, by, bw, bh) {
        const ix = Math.max(ax, bx);
        const iy = Math.max(ay, by);
        const ix2 = Math.min(ax + aw, bx + bw);
        const iy2 = Math.min(ay + ah, by + bh);

        // No overlap — A is returned intact
        if (ix >= ix2 || iy >= iy2) {
            return [{ x: ax, y: ay, w: aw, h: ah }];
        }

        const frags = [];

        // Left strip
        if (ix > ax) {
            frags.push({ x: ax, y: ay, w: ix - ax, h: ah });
        }

        // Right strip
        if (ix2 < ax + aw) {
            frags.push({ x: ix2, y: ay, w: (ax + aw) - ix2, h: ah });
        }

        // Top strip (between left and right)
        if (iy > ay) {
            frags.push({ x: ix, y: ay, w: ix2 - ix, h: iy - ay });
        }

        // Bottom strip (between left and right)
        if (iy2 < ay + ah) {
            frags.push({ x: ix, y: iy2, w: ix2 - ix, h: (ay + ah) - iy2 });
        }

        return frags;
    }

    /**
     * Adds a dirty rect to a surface's list, splitting it against all existing
     * rects so the list never contains overlapping regions.
     *
     * This guarantees that every pixel appears exactly once in the dirty list,
     * so paint() never repaints a region more than once per frame. Double-
     * painting is incorrect: filling the background twice in a region that
     * another sprite already occupies would erase that sprite's pixels.
     *
     * Rects are clamped to surface bounds. Rects entirely outside are discarded.
     *
     * @param {Surface} surface
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    function _addDirtyRect(surface, x, y, w, h) {
        const clamped = _clampRect(x, y, w, h, surface.width, surface.height);

        if (!clamped) {
            return;
        }

        // Subtract each existing rect from the candidate. Only non-overlapping
        // fragments survive into the list.
        let candidates = [clamped];

        for (const existing of surface._dirty) {
            if (candidates.length === 0) {
                break;
            }

            const next = [];

            for (const c of candidates) {
                const frags = _subtractRect(c.x, c.y, c.w, c.h,
                    existing.x, existing.y, existing.w, existing.h);
                for (const f of frags) {
                    next.push(f);
                }
            }

            candidates = next;
        }

        for (const c of candidates) {
            surface._dirty.push(c);
        }
    }

    // =========================================================================
    // COMPOSITOR
    // =========================================================================

    /**
     * Draws the background for a dirty rect region into the DC.
     *
     * @param {CanvasRenderingContext2D} dc
     * @param {Surface} surface
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    function _drawBackground(dc, surface, x, y, w, h) {
        const bg = surface._background;

        if (typeof bg === 'string') {
            dc.fillStyle = bg;
            dc.fillRect(x, y, w, h);
            return;
        }

        // Bitmap background: blit only the dirty region from the source
        if (bg && bg.canvas) {
            dc.drawImage(bg.canvas, x, y, w, h, x, y, w, h);
            return;
        }

        // Fallback
        dc.fillStyle = '#000';
        dc.fillRect(x, y, w, h);
    }

    /**
     * Draws a single sprite into the DC, clipped to the dirty rect region.
     *
     * @param {CanvasRenderingContext2D} dc
     * @param {Sprite} sprite
     * @param {number} rx  Dirty rect x (clip region)
     * @param {number} ry
     * @param {number} rw
     * @param {number} rh
     */
    function _drawSprite(dc, sprite, rx, ry, rw, rh) {
        const { sx, sy, sw, sh } = sprite._surface.frameRect(sprite.frame);

        dc.save();
        dc.beginPath();
        dc.rect(rx, ry, rw, rh);
        dc.clip();
        dc.drawImage(sprite._surface._ctx.canvas, sx, sy, sw, sh, sprite.x, sprite.y, sw, sh);
        dc.restore();
    }

    // =========================================================================
    // WAKADDRAW
    // =========================================================================

    /**
     * WakaDDraw — DirectDraw-inspired sprite and dirty rectangle plugin for wakaPAC.
     * @constructor
     */
    function WakaDDraw() {
    }

    WakaDDraw.prototype = {
        constructor: WakaDDraw,

        // ─── Plugin registration ──────────────────────────────────────────────

        /**
         * Called by wakaPAC.use(wakaDDraw).
         * @param {Object} pac
         * @returns {Object} Plugin descriptor
         */
        createPacPlugin(pac) {
            return { name: 'WakaDDraw' };
        },

        // ─── Surface management ───────────────────────────────────────────────

        /**
         * Loads a surface from an image source accepted by wakaPAC.loadBitmap().
         * Color key is applied once at load time.
         *
         * @param {string|HTMLImageElement|ImageBitmap|ImageData|Blob|HTMLCanvasElement|OffscreenCanvas} source
         * @param {Object} opts
         * @param {number}      opts.frameW
         * @param {number}      opts.frameH
         * @param {string|null} [opts.colorKey='#ff00ff']
         * @param {string|CanvasRenderingContext2D} [opts.background='#000']
         * @returns {Promise<Surface|null>}
         */
        async loadSurface(source, opts = {}) {
            if (!opts.frameW || !opts.frameH) {
                console.warn('WakaDDraw.loadSurface: frameW and frameH are required');
                return null;
            }

            const bitmap = await wakaPAC.loadBitmap(source);

            if (!bitmap) {
                console.warn('WakaDDraw.loadSurface: could not load bitmap from source');
                return null;
            }

            const colorKey = opts.hasOwnProperty('colorKey') ? opts.colorKey : DEFAULT_COLOR_KEY;
            const w = bitmap.canvas.width;
            const h = bitmap.canvas.height;
            const ctx = new OffscreenCanvas(w, h).getContext('2d');

            ctx.drawImage(bitmap.canvas, 0, 0);
            wakaPAC.deleteBitmap(bitmap);

            if (colorKey) {
                _applyColorKey(ctx, colorKey);
            }

            return _buildSurface(ctx, opts.frameW, opts.frameH, colorKey, opts.background);
        },

        /**
         * Creates a blank surface with no pixel data (fully transparent).
         * Draw into surface._ctx, then call applyColorKey() if needed.
         *
         * @param {number} width        Total canvas width in pixels
         * @param {number} height       Total canvas height in pixels
         * @param {number} frameW       Frame width in pixels
         * @param {number} frameH       Frame height in pixels
         * @param {Object} [opts]
         * @param {string|null} [opts.colorKey='#ff00ff']
         * @param {string|CanvasRenderingContext2D} [opts.background='#000']
         * @returns {Surface|null}
         */
        createSurface(width, height, frameW, frameH, opts = {}) {
            if (!width || !height || !frameW || !frameH) {
                console.warn('WakaDDraw.createSurface: width, height, frameW and frameH are required');
                return null;
            }

            const colorKey = opts.hasOwnProperty('colorKey') ? opts.colorKey : DEFAULT_COLOR_KEY;
            const ctx = new OffscreenCanvas(width, height).getContext('2d');

            return _buildSurface(ctx, frameW, frameH, colorKey, opts.background);
        },

        // ─── Sprite management ────────────────────────────────────────────────

        /**
         * Creates a Sprite that blits from the given surface.
         * The sprite is not composited until added to a surface via addSprite().
         *
         * @param {Surface} surface  Source surface for pixel data
         * @param {Object}  [opts]
         * @param {number}  [opts.x=0]
         * @param {number}  [opts.y=0]
         * @param {number}  [opts.z=0]   Higher z = drawn on top
         * @returns {Sprite|null}
         */
        createSprite(surface, opts = {}) {
            if (!surface) {
                console.warn('WakaDDraw.createSprite: surface is required');
                return null;
            }

            return _createSprite(surface, opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
        },

        /**
         * Adds a sprite to a surface's compositor. The sprite list is kept
         * z-sorted so paint() never needs to sort per frame.
         * Marks the sprite's initial position dirty.
         * No-op if the sprite is already attached to this surface.
         *
         * @param {Surface} surface
         * @param {Sprite}  sprite
         */
        addSprite(surface, sprite) {
            if (!surface || !sprite) {
                return;
            }

            if (sprite._parent === surface) {
                return;
            }

            if (sprite._parent !== null) {
                console.warn('WakaDDraw.addSprite: sprite is already attached to a surface — remove it first');
                return;
            }

            sprite._parent = surface;

            // Insert in z-order ascending
            let i = surface._sprites.length;

            while (i > 0 && surface._sprites[i - 1].z > sprite.z) {
                i--;
            }

            surface._sprites.splice(i, 0, sprite);
            _markSpriteDirty(sprite);
        },

        /**
         * Removes a sprite from its surface. Marks the vacated region dirty.
         * No-op if the sprite is not attached to this surface.
         *
         * @param {Surface} surface
         * @param {Sprite}  sprite
         */
        removeSprite(surface, sprite) {
            if (!surface || !sprite || sprite._parent !== surface) {
                return;
            }

            _markSpriteDirty(sprite);

            const idx = surface._sprites.indexOf(sprite);

            if (idx !== -1) {
                surface._sprites.splice(idx, 1);
            }

            sprite._parent = null;
        },

        // ─── Dirty rect management ────────────────────────────────────────────

        /**
         * Adds an arbitrary dirty rect to the surface.
         * Useful for regions damaged by non-sprite drawing into the same DC.
         *
         * @param {Surface} surface
         * @param {number} x
         * @param {number} y
         * @param {number} w
         * @param {number} h
         */
        addDirtyRect(surface, x, y, w, h) {
            if (!surface) {
                return;
            }

            _addDirtyRect(surface, x, y, w, h);
        },

        /**
         * Marks the entire surface dirty. Use on first frame or after a
         * background change.
         *
         * @param {Surface} surface
         */
        dirtyAll(surface) {
            if (!surface) {
                return;
            }

            surface._dirty = [{ x: 0, y: 0, w: surface.width, h: surface.height }];
        },

        // ─── Paint ────────────────────────────────────────────────────────────

        /**
         * Composites all dirty rects into the DC and clears the dirty list.
         *
         * For each dirty rect:
         *   1. Draw background covering the region.
         *   2. Draw all sprites intersecting the region, back to front (z ascending).
         *
         * Nothing is drawn if the dirty list is empty.
         *
         * @param {Surface} surface
         * @param {CanvasRenderingContext2D} dc
         */
        paint(surface, dc) {
            if (!surface || !dc || surface._dirty.length === 0) {
                return;
            }

            const dirty = surface._dirty;
            const sprites = surface._sprites;

            for (let i = 0; i < dirty.length; i++) {
                const { x, y, w, h } = dirty[i];

                _drawBackground(dc, surface, x, y, w, h);

                for (let j = 0; j < sprites.length; j++) {
                    const s = sprites[j];

                    if (!s.visible) {
                        continue;
                    }

                    if (_rectsOverlap(s.rect.x, s.rect.y, s.rect.w, s.rect.h, x, y, w, h)) {
                        _drawSprite(dc, s, x, y, w, h);
                    }
                }
            }

            surface._dirty = [];
        },

        // ─── Pixel access ─────────────────────────────────────────────────────

        /**
         * Locks a surface for direct pixel access.
         * Returns an ImageData snapshot of the surface canvas.
         * The surface should not be drawn during the locked period.
         *
         * @param {Surface} surface
         * @returns {ImageData | null}
         */
        lock(surface) {
            if (!surface || !surface._ctx) {
                return null;
            }

            const { width, height } = surface._ctx.canvas;
            return surface._ctx.getImageData(0, 0, width, height);
        },

        /**
         * Writes ImageData back to the surface canvas.
         * Pixel data is written as-is. Call applyColorKey() afterward if needed.
         *
         * @param {Surface}   surface
         * @param {ImageData} imageData
         */
        unlock(surface, imageData) {
            if (!surface || !surface._ctx || !imageData) {
                return;
            }

            surface._ctx.putImageData(imageData, 0, 0);
        },

        /**
         * Applies the surface's color key to its pixel data in-place.
         * Pixels matching the color key are set to alpha=0.
         * No-op if the surface has no color key (colorKey === null).
         *
         * @param {Surface} surface
         */
        applyColorKey(surface) {
            if (!surface || !surface._ctx || !surface.colorKey) {
                return;
            }

            _applyColorKey(surface._ctx, surface.colorKey);
        },
    };

    /** @type {string} */
    WakaDDraw.VERSION = VERSION;

    /** @type {WakaDDraw} */
    const wakaDDraw = new WakaDDraw();

    window.WakaDDraw = WakaDDraw;
    window.wakaDDraw = wakaDDraw;

})();