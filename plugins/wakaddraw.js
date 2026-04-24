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
 * ║  Inspired by DirectDraw's surface model. A Surface is a canvas — either the          ║
 * ║  visible onscreen canvas or an offscreen one. Sprites blit from offscreen            ║
 * ║  surfaces into the onscreen surface. The dirty rect compositor repaints only         ║
 * ║  damaged regions, back to front, directly on the destination surface.                ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(wakaDDraw);                                                           ║
 * ║                                                                                      ║
 * ║  Surface management:                                                                 ║
 * ║    // Get a surface for an existing canvas (onscreen primary surface):              ║
 * ║    const primary = wakaDDraw.getSurface(this.pacId, { background: '#1a2a3a' });      ║
 * ║                                                                                      ║
 * ║    // Create a new offscreen surface:                                               ║
 * ║    const surface = wakaDDraw.createSurface(128, 32, 32, 32);                        ║
 * ║                                                                                      ║
 * ║    // Load pixel data into a surface from a bitmap:                                 ║
 * ║    const bitmap = await wakaPAC.loadBitmap('/img/hero.png');                        ║
 * ║    wakaDDraw.bltBitmap(surface, bitmap);                                            ║
 * ║    wakaPAC.deleteBitmap(bitmap);                                                    ║
 * ║                                                                                      ║
 * ║    // Or draw directly into surface._ctx and apply color key:                       ║
 * ║    wakaDDraw.applyColorKey(surface);                                                 ║
 * ║                                                                                      ║
 * ║    surface.frames     // total frame count derived from surface dimensions           ║
 * ║    surface.offscreen  // true if offscreen                                           ║
 * ║                                                                                      ║
 * ║  Sprite management:                                                                  ║
 * ║    const hero = wakaDDraw.createSprite(heroSurface, { x: 100, y: 80, z: 1 });       ║
 * ║    wakaDDraw.addSprite(primary, hero);    // add to destination surface              ║
 * ║    wakaDDraw.removeSprite(primary, hero);                                            ║
 * ║                                                                                      ║
 * ║  Per-frame loop (user-driven — WakaDDraw never schedules):                          ║
 * ║    hero.setFrame(n);    // set frame index; marks dirty if changed                   ║
 * ║    hero.moveTo(x, y);  // move sprite; marks old + new rect dirty                   ║
 * ║    hero.show();        // make visible; marks dirty                                  ║
 * ║    hero.hide();        // hide; marks dirty                                          ║
 * ║    hero.setZ(n);       // change z-order; re-sorts sprite list                       ║
 * ║                                                                                      ║
 * ║  Dirty rect management:                                                              ║
 * ║    wakaDDraw.addDirtyRect(surface, x, y, w, h);                                     ║
 * ║    wakaDDraw.dirtyAll(surface);                                                      ║
 * ║                                                                                      ║
 * ║  Paint — composites dirty rects directly onto the surface canvas:                   ║
 * ║    case wakaPAC.MSG_PAINT: {                                                         ║
 * ║        wakaDDraw.paint(primary);                                                     ║
 * ║        break;                                                                        ║
 * ║    }                                                                                 ║
 * ║                                                                                      ║
 * ║  Pixel access:                                                                       ║
 * ║    const pixels = wakaDDraw.lock(surface);                                           ║
 * ║    // ... mutate pixels.data ...                                                     ║
 * ║    wakaDDraw.unlock(surface, pixels);                                                ║
 * ║    wakaDDraw.applyColorKey(surface);   // re-apply color key after drawing           ║
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

    const DEFAULT_COLOR_KEY = '#ff00ff';

    /**
     * Parses a CSS color string into { r, g, b }.
     * Supports #rgb, #rrggbb, and rgb()/rgba() notation.
     * Returns null if unparseable.
     *
     * @param {string} color
     * @returns {{ r: number, g: number, b: number } | null}
     */
    function _parseColor(color) {
        if (!color) {
            return null;
        }
        color = color.trim();

        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return {
                r: parseInt(color[1] + color[1], 16),
                g: parseInt(color[2] + color[2], 16),
                b: parseInt(color[3] + color[3], 16)
            };
        }

        const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) {
            return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
        }

        return null;
    }

    /**
     * Applies a color key to a canvas context in-place.
     * Pixels whose RGB matches the key are set to alpha=0.
     *
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {string} colorKey
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

    function _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

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
     * A Surface is a canvas — either the visible onscreen canvas or an offscreen one.
     *
     * All surfaces:
     *   _ctx, _frameW, _frameH, _cols, width, height, frames, offscreen, colorKey, frameRect
     *
     * Onscreen surfaces only (_background, _sprites, _dirty):
     *   These hold the orchestration state for the compositor. Offscreen surfaces
     *   are pixel data only — they cannot be used as paint() targets.
     *
     * @typedef {{
     *   _ctx:        CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,
     *   _frameW:     number,
     *   _frameH:     number,
     *   _cols:       number,
     *   _background: string|null,
     *   _sprites:    Sprite[]|undefined,
     *   _dirty:      Array<{x:number, y:number, w:number, h:number}>|undefined,
     *   width:       number,
     *   height:      number,
     *   frames:      number,
     *   offscreen:   boolean,
     *   colorKey:    string|null,
     *   frameRect:   function(number): {sx:number, sy:number, sw:number, sh:number}
     * }} Surface
     */

    /**
     * Builds a Surface from an existing canvas rendering context.
     *
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {number}      frameW
     * @param {number}      frameH
     * @param {string|null} colorKey
     * @param {string|null} background
     * @param {boolean}     offscreen
     * @returns {Surface}
     */
    function _buildSurface(ctx, frameW, frameH, colorKey, background, offscreen) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const cols = Math.floor(w / frameW);
        const frames = cols * Math.floor(h / frameH);

        const surface = {
            _ctx: ctx,
            _frameW: frameW,
            _frameH: frameH,
            _cols: cols,
            width: w,
            height: h,
            frames,
            offscreen,
            colorKey,

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

        // Orchestration state only on onscreen surfaces
        if (!offscreen) {
            surface._background = background ?? '#000';
            surface._sprites = [];
            surface._dirty = [];
        }

        return surface;
    }

    // =========================================================================
    // SPRITE
    // =========================================================================

    /**
     * A Sprite blits from an offscreen source surface into a destination surface.
     * Tracks position, frame index, visibility, and z-order.
     * The caller drives animation timing and frame advancement.
     *
     * @typedef {{
     *   _surface:  Surface,
     *   _parent:   Surface|null,
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
     * @param {Surface} surface  Source surface
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
            _parent: null,
            frame: 0,
            x, y, z,
            visible: true,
            rect: { x, y, w, h },
            prevRect: { x, y, w, h },

            setFrame(n) {
                const clamped = Math.max(0, Math.min(surface.frames - 1, Math.round(n)));
                if (this.frame === clamped) {
                    return;
                }
                this.frame = clamped;
                _markSpriteDirty(this);
            },

            moveTo(nx, ny) {
                nx = Math.round(nx);
                ny = Math.round(ny);
                if (this.x === nx && this.y === ny) {
                    return;
                }
                _markSpriteDirty(this);
                this.prevRect = { ...this.rect };
                this.x = nx;
                this.y = ny;
                this.rect = { x: nx, y: ny, w, h };
                _markSpriteDirty(this);
            },

            show() {
                if (this.visible) {
                    return;
                }
                this.visible = true;
                _markSpriteDirty(this);
            },

            hide() {
                if (!this.visible) {
                    return;
                }
                _markSpriteDirty(this);
                this.visible = false;
            },

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
     * Subtracts rectangle B from rectangle A, returning the non-overlapping
     * fragments of A. Returns 0–4 rects.
     */
    function _subtractRect(ax, ay, aw, ah, bx, by, bw, bh) {
        const ix = Math.max(ax, bx);
        const iy = Math.max(ay, by);
        const ix2 = Math.min(ax + aw, bx + bw);
        const iy2 = Math.min(ay + ah, by + bh);

        if (ix >= ix2 || iy >= iy2) {
            return [{ x: ax, y: ay, w: aw, h: ah }];
        }

        const frags = [];

        if (ix > ax) {
            frags.push({ x: ax, y: ay, w: ix - ax, h: ah });
        }
        if (ix2 < ax + aw) {
            frags.push({ x: ix2, y: ay, w: (ax + aw) - ix2, h: ah });
        }
        if (iy > ay) {
            frags.push({ x: ix, y: ay, w: ix2 - ix, h: iy - ay });
        }
        if (iy2 < ay + ah) {
            frags.push({ x: ix, y: iy2, w: ix2 - ix, h: (ay + ah) - iy2 });
        }

        return frags;
    }

    /**
     * Adds a dirty rect to a surface's list, splitting against existing rects
     * so the list is always non-overlapping. Every pixel appears exactly once.
     */
    function _addDirtyRect(surface, x, y, w, h) {
        const clamped = _clampRect(x, y, w, h, surface.width, surface.height);
        if (!clamped) {
            return;
        }

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

    function _drawBackground(ctx, surface, x, y, w, h) {
        const bg = surface._background;

        if (typeof bg === 'string') {
            ctx.fillStyle = bg;
            ctx.fillRect(x, y, w, h);
            return;
        }

        // Bitmap background surface
        if (bg && bg._ctx) {
            ctx.drawImage(bg._ctx.canvas, x, y, w, h, x, y, w, h);
            return;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, w, h);
    }

    function _drawSprite(ctx, sprite, rx, ry, rw, rh) {
        const { sx, sy, sw, sh } = sprite._surface.frameRect(sprite.frame);
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        ctx.drawImage(sprite._surface._ctx.canvas, sx, sy, sw, sh, sprite.x, sprite.y, sw, sh);
        ctx.restore();
    }

    // =========================================================================
    // WAKADDRAW
    // =========================================================================

    function WakaDDraw() {
    }

    WakaDDraw.prototype = {
        constructor: WakaDDraw,

        createPacPlugin(pac) {
            return { name: 'WakaDDraw' };
        },

        // ─── Surface management ───────────────────────────────────────────────

        /**
         * Returns a surface that represents the canvas of a wakaPAC component.
         * Analogous to DirectDraw's GetGDISurface — retrieves a surface handle
         * for a canvas that already exists rather than creating a new one.
         *
         * This is the entry point for the onscreen primary surface.
         *
         * @param {string}         pacId   The data-pac-id of the component
         * @param {Object}         [opts]
         * @param {string|Surface} [opts.background='#000']
         * @returns {Surface|null}
         */
        getSurface(pacId, opts = {}) {
            const canvas = wakaPAC.getContainerByPacId(pacId);

            if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                throw new Error(`WakaDDraw.getSurface: container for pacId "${pacId}" is not a canvas element`);
            }

            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.warn(`WakaDDraw.getSurface: could not get 2d context for pacId "${pacId}"`);
                return null;
            }

            return _buildSurface(ctx, canvas.width, canvas.height, null, opts.background ?? '#000', false);
        },

        /**
         * Creates a new offscreen surface backed by an OffscreenCanvas.
         * Draw into surface._ctx, then call applyColorKey() if needed.
         *
         * @param {number}      width
         * @param {number}      height
         * @param {number}      frameW
         * @param {number}      frameH
         * @param {Object}      [opts]
         * @param {string|null} [opts.colorKey='#ff00ff']
         * @returns {Surface|null}
         */
        createSurface(width, height, frameW, frameH, opts = {}) {
            if (!width || !height || !frameW || !frameH) {
                console.warn('WakaDDraw.createSurface: width, height, frameW and frameH are required');
                return null;
            }

            const colorKey = Object.prototype.hasOwnProperty.call(opts, 'colorKey') ? opts.colorKey : DEFAULT_COLOR_KEY;
            const ctx = new OffscreenCanvas(width, height).getContext('2d');

            return _buildSurface(ctx, frameW, frameH, colorKey, null, true);
        },

        /**
         * Blits a wakaPAC bitmap into a surface's pixel data.
         * If the surface has a color key, it is applied after blitting.
         *
         * The bitmap is blitted at (0, 0) and must fit within the surface
         * dimensions. The caller is responsible for the bitmap's lifetime —
         * call wakaPAC.deleteBitmap() when done.
         *
         * @param {Surface} surface
         * @param {CanvasRenderingContext2D} bitmap  Handle from wakaPAC.loadBitmap()
         */
        bltBitmap(surface, bitmap) {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.bltBitmap: surface is required');
            }

            if (!bitmap || !bitmap.canvas) {
                throw new Error('WakaDDraw.bltBitmap: bitmap is required');
            }

            surface._ctx.drawImage(bitmap.canvas, 0, 0);

            if (surface.colorKey) {
                _applyColorKey(surface._ctx, surface.colorKey);
            }
        },

        // ─── Sprite management ────────────────────────────────────────────────

        /**
         * Creates a Sprite that blits from the given offscreen source surface.
         *
         * @param {Surface} surface  Source surface (must be offscreen)
         * @param {Object}  [opts]
         * @param {number}  [opts.x=0]
         * @param {number}  [opts.y=0]
         * @param {number}  [opts.z=0]
         * @returns {Sprite|null}
         */
        createSprite(surface, opts = {}) {
            if (!surface) {
                console.warn('WakaDDraw.createSprite: surface is required');
                return null;
            }

            if (!surface.offscreen) {
                console.warn('WakaDDraw.createSprite: source surface must be offscreen');
                return null;
            }

            return _createSprite(surface, opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
        },

        /**
         * Adds a sprite to a destination surface's compositor.
         * The sprite list is z-sorted on insertion.
         * Marks the sprite's initial position dirty.
         *
         * @param {Surface} surface  Destination surface (onscreen or offscreen)
         * @param {Sprite}  sprite
         */
        addSprite(surface, sprite) {
            if (!surface || !sprite) {
                return;
            }

            if (surface.offscreen) {
                console.warn('WakaDDraw.addSprite: surface must be onscreen');
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

            let i = surface._sprites.length;
            while (i > 0 && surface._sprites[i - 1].z > sprite.z) {
                i--;
            }
            surface._sprites.splice(i, 0, sprite);

            _markSpriteDirty(sprite);
        },

        /**
         * Removes a sprite from its destination surface.
         * Marks the vacated region dirty.
         *
         * @param {Surface} surface
         * @param {Sprite}  sprite
         */
        removeSprite(surface, sprite) {
            if (!surface || !sprite || sprite._parent !== surface) {
                return;
            }
            if (surface.offscreen) {
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
         * Adds an arbitrary dirty rect to the surface's list.
         *
         * @param {Surface} surface
         * @param {number} x
         * @param {number} y
         * @param {number} w
         * @param {number} h
         */
        addDirtyRect(surface, x, y, w, h) {
            if (!surface || surface.offscreen) {
                return;
            }
            _addDirtyRect(surface, x, y, w, h);
        },

        /**
         * Marks the entire surface dirty.
         *
         * @param {Surface} surface
         */
        dirtyAll(surface) {
            if (!surface || surface.offscreen) {
                return;
            }
            surface._dirty = [{ x: 0, y: 0, w: surface.width, h: surface.height }];
        },

        // ─── Paint ────────────────────────────────────────────────────────────

        /**
         * Composites all dirty rects directly onto the surface's own canvas.
         * For each dirty rect: fill background, then draw intersecting sprites
         * back to front. Clears the dirty list when done.
         *
         * @param {Surface} surface  Onscreen surface only
         */
        paint(surface) {
            if (!surface || surface.offscreen || surface._dirty.length === 0) {
                return;
            }

            const ctx = surface._ctx;
            const dirty = surface._dirty;
            const sprites = surface._sprites;

            for (let i = 0; i < dirty.length; i++) {
                const { x, y, w, h } = dirty[i];

                _drawBackground(ctx, surface, x, y, w, h);

                for (let j = 0; j < sprites.length; j++) {
                    const s = sprites[j];
                    if (!s.visible) {
                        continue;
                    }
                    if (_rectsOverlap(s.rect.x, s.rect.y, s.rect.w, s.rect.h, x, y, w, h)) {
                        _drawSprite(ctx, s, x, y, w, h);
                    }
                }
            }

            surface._dirty = [];
        },

        // ─── Pixel access ─────────────────────────────────────────────────────

        /**
         * Locks a surface for direct pixel access.
         * Returns an ImageData snapshot of the canvas.
         *
         * @param {Surface} surface
         * @returns {ImageData|null}
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
         * Call applyColorKey() afterward if the key color was drawn.
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
         * No-op if colorKey is null.
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

    WakaDDraw.VERSION = VERSION;

    const wakaDDraw = new WakaDDraw();

    window.WakaDDraw = WakaDDraw;
    window.wakaDDraw = wakaDDraw;

})();