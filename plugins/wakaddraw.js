/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗    ██╗        ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║    ██║        ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║  ██║██║  ██║██████╔╝███████║██║ █╗ ██║        ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║  ██║██║  ██║██╔══██╗██╔══██║██║███╗██║        ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝██████╔╝██║  ██║██║  ██║╚███╔███╔╝        ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝         ║
 * ║                                                                                      ║
 * ║  WakaDDraw — DirectDraw-inspired blitter plugin for wakaPAC                          ║
 * ║                                                                                      ║
 * ║  A pure blitter. A Surface is a canvas — either the visible onscreen canvas          ║
 * ║  or an offscreen one. bltFast copies pixels from one surface to another              ║
 * ║  immediately. No sprite tracking, no dirty rects, no deferred execution.             ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(wakaDDraw);                                                           ║
 * ║                                                                                      ║
 * ║  Surface management:                                                                 ║
 * ║    // Onscreen primary surface:                                                      ║
 * ║    const primary = wakaDDraw.getSurface(this.pacId);                                 ║
 * ║                                                                                      ║
 * ║    // Offscreen surface (blank):                                                     ║
 * ║    const surface = wakaDDraw.createSurface(128, 32);                                 ║
 * ║    const ctx = wakaDDraw.getContext(surface);  // draw into ctx                      ║
 * ║    wakaDDraw.applyColorKey(surface);                                                 ║
 * ║                                                                                      ║
 * ║    // Blt a wakaPAC bitmap onto a surface:                                           ║
 * ║    const bitmap = await wakaPAC.loadBitmap('/img/hero.png');                         ║
 * ║    wakaDDraw.bltBitmap(surface, bitmap);                                             ║
 * ║    wakaPAC.deleteBitmap(bitmap);                                                     ║
 * ║                                                                                      ║
 * ║    surface.width      // canvas width in pixels                                      ║
 * ║    surface.height     // canvas height in pixels                                     ║
 * ║    surface.offscreen  // true if offscreen                                           ║
 * ║                                                                                      ║
 * ║  Blitting:                                                                           ║
 * ║    // Blt entire source surface:                                                     ║
 * ║    wakaDDraw.bltFast(dst, dx, dy, src);                                              ║
 * ║                                                                                      ║
 * ║    // Blt a specific region (DOMRect conventions — x/left and y/top both work):      ║
 * ║    wakaDDraw.bltFast(dst, dx, dy, src, { x, y, width, height });                     ║
 * ║                                                                                      ║
 * ║    // Blt with explicit flags:                                                       ║
 * ║    wakaDDraw.bltFast(dst, dx, dy, src, rect, wakaDDraw.DDBLTFAST_NOCOLORKEY);        ║
 * ║                                                                                      ║
 * ║  Flags:                                                                              ║
 * ║    wakaDDraw.DDBLTFAST_NOCOLORKEY   // ignore color key, copy all pixels             ║
 * ║    wakaDDraw.DDBLTFAST_SRCCOLORKEY  // respect source color key (default if set)     ║
 * ║                                                                                      ║
 * ║  Scene system (higher-level, built on bltFast):                                      ║
 * ║    const scene  = wakaDDraw.sceneCreate({ background: '#1a2a3a' });                  ║
 * ║    const sprite = wakaDDraw.createSprite(surface, rect, z);                          ║
 * ║    wakaDDraw.sceneAddSprite(scene, sprite);                                          ║
 * ║    wakaDDraw.sceneRemoveSprite(scene, sprite);                                       ║
 * ║    wakaDDraw.sceneDestroy(scene);                                                    ║
 * ║                                                                                      ║
 * ║    sprite.moveTo(x, y);   // marks dirty automatically                               ║
 * ║    sprite.setRect(rect);  // change source rect                                      ║
 * ║    sprite.setZ(z);        // change z-order                                          ║
 * ║    sprite.show();         // marks dirty                                             ║
 * ║    sprite.hide();         // marks dirty                                             ║
 * ║                                                                                      ║
 * ║    // Call once per frame from user's timer:                                         ║
 * ║    wakaDDraw.sceneRender(scene, primary);                                            ║
 * ║                                                                                      ║
 * ║    const pixels = wakaDDraw.lock(surface);                                           ║
 * ║    // ... mutate pixels.data ...                                                     ║
 * ║    wakaDDraw.unlock(surface, pixels);                                                ║
 * ║    wakaDDraw.applyColorKey(surface);                                                 ║
 * ║                                                                                      ║
 * ║  Tilemap:                                                                            ║
 * ║    const map = wakaDDraw.createTilemap(tileSheet, mapData, mapWidth, mapHeight);     ║
 * ║    // mapData is a Uint16Array of tile indices, row-major                            ║
 * ║    // Render into an offscreen surface, use that surface as a sprite source:         ║
 * ║    map.drawTo(tileSurface, scrollX, scrollY);                                        ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    const VERSION = '1.0.1';

    // =========================================================================
    // FLAGS
    // =========================================================================

    const DDBLTFAST_NOCOLORKEY = 0x00;
    const DDBLTFAST_SRCCOLORKEY = 0x01;

    // =========================================================================
    // CANVAS HELPERS
    // =========================================================================

    /**
     * Maximum number of dirty rects before falling back to a full redraw.
     * Prevents O(n²) fragmentation in scenes with many moving sprites.
     * @type {number}
     */
    const MAX_DIRTY_RECTS = 64;

    /**
     * Creates a 2D canvas context of the given dimensions.
     * Falls back to a regular HTMLCanvasElement if OffscreenCanvas is unavailable.
     * @param {number} width
     * @param {number} height
     * @returns {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D}
     */
    function _create2DContext(width, height) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(width, height).getContext('2d');
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas.getContext('2d');
    }

    // =========================================================================
    // COLOR KEY
    // =========================================================================

    const DEFAULT_COLOR_KEY = '#ff00ff';

    /**
     * Parses a CSS color string (#rgb, #rrggbb, rgb(), rgba()) into {r, g, b}.
     * Returns null if the color cannot be parsed.
     * @param {string} color
     * @returns {{r:number, g:number, b:number}|null}
     */
    function _parseColor(color) {
        if (!color) {
            return null;
        }

        color = color.trim();

        // Expand #rgb to #rrggbb
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }

        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    }

    /**
     * Applies a color key to a canvas context in-place.
     * Pixels whose RGB matches the key are set to alpha=0.
     *
     * This is O(pixels) — call once after loading or bulk pixel operations,
     * never per frame. Repeated calls on an already-keyed surface are harmless
     * but wasteful.
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
    // SURFACE
    // =========================================================================

    /**
     * A Surface is a canvas — either the visible onscreen canvas or an offscreen one.
     *
     * @typedef {{
     *   _ctx:      CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,
     *   width:     number,
     *   height:    number,
     *   offscreen: boolean,
     *   colorKey:  string|null
     * }} Surface
     */

    /**
     * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
     * @param {string|null} colorKey
     * @param {boolean}     offscreen
     * @returns {Surface}
     */
    function _buildSurface(ctx, colorKey, offscreen) {
        return {
            _ctx: ctx,
            width: ctx.canvas.width,
            height: ctx.canvas.height,
            offscreen,
            colorKey
        };
    }

    // =========================================================================
    // RECT HELPERS (scene system)
    // =========================================================================

    /**
     * Returns true if two rectangles overlap. Touching edges do not count.
     *
     * @param {number} ax @param {number} ay @param {number} aw @param {number} ah
     * @param {number} bx @param {number} by @param {number} bw @param {number} bh
     * @returns {boolean}
     */
    function _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    /**
     * Clamps a rectangle to fit within a bounding box.
     * Returns null if the result has zero or negative area.
     *
     * @param {number} x @param {number} y @param {number} w @param {number} h
     * @param {number} bw Bounding width @param {number} bh Bounding height
     * @returns {{x:number, y:number, w:number, h:number}|null}
     */
    function _clampRect(x, y, w, h, bw, bh) {
        const cx = Math.max(x, 0);
        const cy = Math.max(y, 0);
        const cw = Math.min(x + w, bw) - cx;
        const ch = Math.min(y + h, bh) - cy;

        if (cw <= 0 || ch <= 0) {
            return null;
        }

        return { x: cx, y: cy, w: cw, h: ch };
    }

    /**
     * Subtracts rectangle B from rectangle A, returning the non-overlapping
     * fragments of A. Returns 0–4 rects.
     * @param {number} ax @param {number} ay @param {number} aw @param {number} ah
     * @param {number} bx @param {number} by @param {number} bw @param {number} bh
     * @returns {Array<{x:number, y:number, w:number, h:number}>}
     */
    function _subtractRect(ax, ay, aw, ah, bx, by, bw, bh) {
        const ix = Math.max(ax, bx);
        const iy = Math.max(ay, by);
        const ix2 = Math.min(ax + aw, bx + bw);
        const iy2 = Math.min(ay + ah, by + bh);

        // Not split needed
        if (ix >= ix2 || iy >= iy2) {
            return [{ x: ax, y: ay, w: aw, h: ah }];
        }

        // Split the rect
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
     * Adds a dirty rect to a scene's list, splitting it against existing rects
     * so the list remains non-overlapping. Collapses to a full-redraw sentinel
     * when the list exceeds MAX_DIRTY_RECTS.
     * @param {Object} scene
     * @param {number} x @param {number} y @param {number} w @param {number} h
     */
    function _sceneDirtyRect(scene, x, y, w, h) {
        // If already collapsed to full-redraw, nothing to do
        if (scene._dirty.length === 1 && scene._dirty[0].full) {
            return;
        }

        // If the dirty list is at capacity, collapse to a full redraw.
        // Prevents O(n²) fragmentation in scenes with many moving sprites.
        if (scene._dirty.length >= MAX_DIRTY_RECTS) {
            scene._dirty = [{ full: true }];
            return;
        }

        let candidates = [{ x, y, w, h }];

        for (const existing of scene._dirty) {
            if (candidates.length === 0) {
                break;
            }

            const next = [];

            for (const c of candidates) {
                for (const f of _subtractRect(c.x, c.y, c.w, c.h, existing.x, existing.y, existing.w, existing.h)) {
                    next.push(f);
                }
            }

            candidates = next;
        }

        for (const c of candidates) {
            scene._dirty.push(c);
        }
    }

    // =========================================================================
    // SPRITE (scene system)
    // =========================================================================

    /**
     * @typedef {{
     *   _scene:    Object|null,
     *   _surface:  Surface,
     *   _rect:     {x?:number, left?:number, y?:number, top?:number, width:number, height:number}|null,
     *   _z:        number,
     *   _zSeq:     number,
     *   x:         number,
     *   y:         number,
     *   visible:   boolean,
     *   moveTo:    function(number, number): void,
     *   setRect:   function(Object|null): void,
     *   setZ:      function(number): void,
     *   show:      function(): void,
     *   hide:      function(): void
     * }} Sprite
     */

    let _spriteSeq = 0;

    /**
     * Creates a Sprite object backed by a surface.
     * @param {Surface}     surface
     * @param {Object|null} rect     Source rect (DOMRect conventions), or null for full surface
     * @param {number}      z        Z-order
     * @returns {Sprite}
     */
    function _createSpriteObject(surface, rect, z) {
        return {
            _scene: null,
            _surface: surface,
            _rect: rect ? { ...rect } : null,
            _z: z,
            _zSeq: _spriteSeq++,
            x: 0,
            y: 0,
            visible: true,

            moveTo(nx, ny) {
                nx = Math.round(nx);
                ny = Math.round(ny);
                if (this.x === nx && this.y === ny) {
                    return;
                }
                _spriteDirty(this);          // dirty old position
                this.x = nx;
                this.y = ny;
                _spriteDirty(this);          // dirty new position
            },

            setRect(rect) {
                this._rect = rect ? { ...rect } : null;
                _spriteDirty(this);
            },

            setZ(z) {
                this._z = z;
                this._zSeq = _spriteSeq++;
                if (this._scene) {
                    _sceneSortSprites(this._scene);
                }
                _spriteDirty(this);
            },

            show() {
                if (this.visible) {
                    return;
                }
                this.visible = true;
                _spriteDirty(this);
            },

            hide() {
                if (!this.visible) {
                    return;
                }
                _spriteDirty(this);
                this.visible = false;
            }
        };
    }

    /**
     * Returns the bounding rect of a sprite in scene space.
     * @param {Sprite} sprite
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    function _spriteBounds(sprite) {
        const r = sprite._rect;
        const w = r ? r.width : sprite._surface.width;
        const h = r ? r.height : sprite._surface.height;
        return { x: sprite.x, y: sprite.y, w, h };
    }

    /**
     * Marks the sprite's current bounding rect dirty on its parent scene.
     * No-op if the sprite has no scene or is hidden.
     * @param {Sprite} sprite
     */
    function _spriteDirty(sprite) {
        if (!sprite._scene || !sprite.visible) {
            return;
        }

        const b = _spriteBounds(sprite);
        _sceneDirtyRect(sprite._scene, b.x, b.y, b.w, b.h);
    }

    /**
     * Sorts the scene's sprite list by z ascending, using insertion sequence
     * as a stable tiebreaker.
     * @param {Object} scene
     */
    function _sceneSortSprites(scene) {
        scene._sprites.sort((a, b) => a._z !== b._z ? a._z - b._z : a._zSeq - b._zSeq);
    }

    // =========================================================================
    // WAKADDRAW — continued
    // =========================================================================

    let _pac = null;

    function WakaDDraw() {
    }

    WakaDDraw.prototype = {
        constructor: WakaDDraw,

        /**
         * Called by wakaPAC.use(wakaDDraw). Captures the pac reference for
         * internal use. Returns an empty plugin descriptor — WakaDDraw does
         * not register template functions or units.
         * @param {Object} pac
         * @returns {{}}
         */
        createPacPlugin(pac) {
            _pac = pac;
            return {};
        },

        // Error handling convention:
        //   Low-level API (getSurface, createSurface, bltFast, bltBitmap, lock, unlock):
        //     throws on misuse — these are programming errors.
        //   High-level API (scene*, createSprite):
        //     returns/no-ops on bad input with a console.warn — these are more
        //     forgiving because scene state can be complex and partial failures
        //     should not crash the render loop.

        // ─── Surface management ───────────────────────────────────────────────

        /**
         * Returns a surface representing the canvas of a wakaPAC component.
         * This is the onscreen primary surface — the render destination.
         *
         * @param {string} pacId
         * @returns {Surface}
         */
        getSurface(pacId) {
            const canvas = _pac.getContainerByPacId(pacId);

            if (!(canvas instanceof HTMLCanvasElement)) {
                throw new Error(`WakaDDraw.getSurface: container for pacId "${pacId}" is not a canvas element`);
            }

            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error(`WakaDDraw.getSurface: could not get 2d context for pacId "${pacId}"`);
            }

            return _buildSurface(ctx, null, false);
        },

        /**
         * Creates a new offscreen surface backed by a canvas.
         * Draw into surface._ctx, then call applyColorKey() if needed.
         * @param {number}      width
         * @param {number}      height
         * @param {Object}      [opts]
         * @param {string|null} [opts.colorKey='#ff00ff']
         * @returns {Surface}
         */
        createSurface(width, height, opts = {}) {
            if (!width || !height) {
                throw new Error('WakaDDraw.createSurface: width and height are required');
            }

            const colorKey = Object.prototype.hasOwnProperty.call(opts, 'colorKey') ? opts.colorKey : DEFAULT_COLOR_KEY;
            const ctx = _create2DContext(width, height);

            return _buildSurface(ctx, colorKey, true);
        },

        /**
         * Loads a bitmap from a URL and blits it into a new offscreen surface.
         * Combines loadBitmap → createSurface → bltBitmap → deleteBitmap.
         * The surface dimensions match the bitmap exactly.
         * @param {string}      url
         * @param {Object}      [opts]
         * @param {string|null} [opts.colorKey='#ff00ff']
         * @returns {Promise<Surface>}
         */
        async loadSurface(url, opts = {}) {
            const bitmap = await _pac.loadBitmap(url);
            const surface = this.createSurface(bitmap.canvas.width, bitmap.canvas.height, opts);
            this.bltBitmap(surface, bitmap);
            _pac.deleteBitmap(bitmap);
            return surface;
        },

        // ─── Blitting ─────────────────────────────────────────────────────────

        /**
         * Blits a wakaPAC bitmap onto a surface.
         * Applies the surface's color key after blitting if set.
         * The caller is responsible for deleting the bitmap afterward.
         *
         * @param {Surface}                 surface
         * @param {CanvasRenderingContext2D} bitmap   Handle from wakaPAC.loadBitmap()
         */
        bltBitmap(surface, bitmap) {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.bltBitmap: surface is required');
            }

            if (!bitmap || !bitmap.canvas) {
                throw new Error('WakaDDraw.bltBitmap: bitmap is required');
            }

            surface._ctx.drawImage(bitmap.canvas, 0, 0);

            if (surface.colorKey !== null) {
                _applyColorKey(surface._ctx, surface.colorKey);
            }
        },

        /**
         * Blits a source surface into a destination surface immediately.
         *
         * If rect is omitted the entire source surface is blitted.
         * rect follows DOMRect conventions — x/left and y/top are both accepted.
         *
         * flags defaults to DDBLTFAST_SRCCOLORKEY if the source has a color key,
         * DDBLTFAST_NOCOLORKEY otherwise.
         *
         * @param {Surface} dst    Destination surface
         * @param {number}  dx     Destination x
         * @param {number}  dy     Destination y
         * @param {Surface} src    Source surface
         * @param {DOMRect|{x?:number, left?:number, y?:number, top?:number, width:number, height:number}} [rect]
         * @param {number}  [flags]
         */
        bltFast(dst, dx, dy, src, rect, flags) {
            if (!dst || !dst._ctx) {
                throw new Error('WakaDDraw.bltFast: dst is required');
            }

            if (!src || !src._ctx) {
                throw new Error('WakaDDraw.bltFast: src is required');
            }

            const sx = rect ? (rect.x ?? rect.left ?? 0) : 0;
            const sy = rect ? (rect.y ?? rect.top ?? 0) : 0;
            const sw = rect ? rect.width : src.width;
            const sh = rect ? rect.height : src.height;

            const useColorKey = flags !== undefined
                ? (flags & DDBLTFAST_SRCCOLORKEY) !== 0
                : src.colorKey !== null;

            const ctx = dst._ctx;

            ctx.save();

            if (useColorKey) {
                ctx.globalCompositeOperation = 'source-over';
            } else {
                ctx.globalCompositeOperation = 'copy';
            }

            ctx.drawImage(src._ctx.canvas, sx, sy, sw, sh, dx, dy, sw, sh);
            ctx.restore();
        },

        // ─── Pixel access ─────────────────────────────────────────────────────

        /**
         * Locks a surface for direct pixel access.
         * Returns an ImageData snapshot of the canvas.
         * @param {Surface} surface
         * @returns {ImageData|null}
         */
        lock(surface) {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.lock: surface is required');
            }

            const { width, height } = surface._ctx.canvas;
            return surface._ctx.getImageData(0, 0, width, height);
        },

        /**
         * Writes ImageData back to the surface canvas.
         * Call applyColorKey() afterward if the key color was drawn.
         * @param {Surface}   surface
         * @param {ImageData} imageData
         */
        unlock(surface, imageData) {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.unlock: surface is required');
            }

            if (!imageData) {
                throw new Error('WakaDDraw.unlock: imageData is required');
            }

            surface._ctx.putImageData(imageData, 0, 0);
        },

        /**
         * Applies the surface's color key to its pixel data in-place.
         * Pixels matching the color key are set to alpha=0.
         * No-op if colorKey is null.
         * @param {Surface} surface
         */
        applyColorKey(surface) {
            if (!surface || !surface._ctx || surface.colorKey === null) {
                return;
            }

            _applyColorKey(surface._ctx, surface.colorKey);
        },

        /**
         * Clears a surface to a solid color or to transparent black.
         *
         * Use this at the start of each frame when managing the render loop
         * manually with bltFast (i.e. without the scene system). The scene
         * system does not need this — it clears only dirty regions itself.
         *
         * @param {Surface} surface
         * @param {string}  [color='#000000'] CSS fill color. Pass 'transparent'
         *                                    to clear to transparent black.
         */
        clearSurface(surface, color = '#000000') {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.clearSurface: surface is required');
            }

            if (color === undefined || color === null) {
                throw new Error('WakaDDraw.clearSurface: color is required');
            }

            const ctx = surface._ctx;
            const { width, height } = ctx.canvas;

            if (color === 'transparent' || color === surface.colorKey) {
                ctx.clearRect(0, 0, width, height);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
            }
        },

        /**
         * Returns the 2D rendering context of an offscreen surface for direct
         * drawing. Use this to draw programmatically into a surface before
         * calling applyColorKey().
         *
         * Throws if called on an onscreen surface — drawing directly into the
         * primary canvas bypasses the compositor and produces unpredictable results.
         *
         * @param {Surface} surface
         * @returns {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D}
         */
        getContext(surface) {
            if (!surface) {
                throw new Error('WakaDDraw.getContext: surface is required');
            }

            if (!surface.offscreen) {
                throw new Error('WakaDDraw.getContext: cannot get context of onscreen surface');
            }

            return surface._ctx;
        },

        // ─── Scene management ─────────────────────────────────────────────────

        /**
         * Creates a scene. A scene manages a z-sorted sprite list and a
         * non-overlapping dirty rect list. The user calls sceneRender() each
         * frame to composite sprites into the primary surface.
         * @param {Object}  [opts]
         * @param {string}  [opts.background='#000']  Fallback fill color when no
         *                                             sprite covers a dirty region
         * @returns {Object} Scene
         */
        sceneCreate(opts = {}) {
            return {
                _sprites: [],
                _dirty: [],
                _background: opts.background ?? '#000'
            };
        },

        /**
         * Destroys a scene. Detaches all sprites and clears state.
         * @param {Object} scene
         */
        sceneDestroy(scene) {
            if (!scene) {
                return;
            }

            for (const s of scene._sprites) {
                s._scene = null;
            }

            scene._sprites = [];
            scene._dirty = [];
        },

        /**
         * Marks the entire primary surface dirty, forcing a full redraw on
         * the next sceneRender(). Call after creating the scene and adding
         * all initial sprites, and after any background change.
         * @param {Object}  scene
         * @param {Surface} primary
         */
        sceneInvalidate(scene, primary) {
            if (!scene || !primary) {
                return;
            }

            scene._dirty = [{ full: true }];
        },

        /**
         * Adds a sprite to a scene. Marks the sprite's initial bounds dirty.
         * No-op if the sprite is already in this scene.
         * @param {Object} scene
         * @param {Sprite} sprite
         */
        sceneAddSprite(scene, sprite) {
            if (!scene || !sprite) {
                return;
            }

            if (sprite._scene === scene) {
                return;
            }

            if (sprite._scene !== null) {
                console.warn('WakaDDraw.sceneAddSprite: sprite already belongs to a scene — remove it first');
                return;
            }

            sprite._scene = scene;
            scene._sprites.push(sprite);
            _sceneSortSprites(scene);
            _spriteDirty(sprite);
        },

        /**
         * Removes a sprite from a scene. Marks the vacated region dirty.
         *
         * @param {Object} scene
         * @param {Sprite} sprite
         */
        sceneRemoveSprite(scene, sprite) {
            if (!scene || !sprite || sprite._scene !== scene) {
                return;
            }

            _spriteDirty(sprite);

            const idx = scene._sprites.indexOf(sprite);

            if (idx !== -1) {
                scene._sprites.splice(idx, 1);
            }

            sprite._scene = null;
        },

        /**
         * Creates a sprite backed by an offscreen surface.
         * The sprite is not in any scene until sceneAddSprite() is called.
         *
         * rect follows DOMRect conventions (x/left, y/top, width, height).
         * If omitted, the entire source surface is used.
         *
         * z defaults to 0. Sprites with equal z are drawn in insertion order.
         *
         * @param {Surface}     surface
         * @param {Object|null} [rect]
         * @param {number}      [z=0]
         * @returns {Sprite}
         */
        createSprite(surface, rect, z = 0) {
            if (!surface || !surface._ctx) {
                throw new Error('WakaDDraw.createSprite: surface is required');
            }

            return _createSpriteObject(surface, rect, z);
        },

        // ─── Scene render ─────────────────────────────────────────────────────

        /**
         * Composites the scene into the primary surface.
         * For each dirty rect:
         *   1. Restore background — fill with background color, then blt any
         *      sprite that fully covers the region bottom to top.
         *   2. Blt all visible sprites that intersect the dirty rect, in z-order.
         * Clears the dirty list when done.
         *
         * Call once per frame from the user's timer or rAF.
         *
         * @param {Object}  scene
         * @param {Surface} primary  Onscreen destination surface
         */
        sceneRender(scene, primary) {
            if (!scene || !primary) {
                return;
            }

            if (scene._dirty.length === 0) {
                return;
            }

            const ctx = primary._ctx;
            const sprites = scene._sprites;   // z-sorted ascending
            const dirty = scene._dirty;

            for (const dr of dirty) {
                const { x, y, w, h } = dr.full
                    ? { x: 0, y: 0, w: primary.width, h: primary.height }
                    : (_clampRect(dr.x, dr.y, dr.w, dr.h, primary.width, primary.height) ?? {});

                if (w === undefined) {
                    continue;
                }

                // Step 1: restore background color into this region
                ctx.fillStyle = scene._background;
                ctx.fillRect(x, y, w, h);

                // Step 2: blt all visible sprites that intersect this rect,
                // bottom to top (z ascending = correct painter's order)
                for (const sprite of sprites) {
                    if (!sprite.visible) {
                        continue;
                    }

                    const b = _spriteBounds(sprite);

                    if (!_rectsOverlap(b.x, b.y, b.w, b.h, x, y, w, h)) {
                        continue;
                    }

                    const sr = sprite._rect;
                    const sx = sr ? (sr.x ?? sr.left ?? 0) : 0;
                    const sy = sr ? (sr.y ?? sr.top ?? 0) : 0;
                    const sw = sr ? sr.width : sprite._surface.width;
                    const sh = sr ? sr.height : sprite._surface.height;

                    const useColorKey = sprite._surface.colorKey !== null;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(x, y, w, h);
                    ctx.clip();
                    ctx.globalCompositeOperation = useColorKey ? 'source-over' : 'copy';
                    ctx.drawImage(sprite._surface._ctx.canvas, sx, sy, sw, sh, sprite.x, sprite.y, sw, sh);
                    ctx.restore();
                }
            }

            scene._dirty = [];
        },

        // ─── Tilemap ──────────────────────────────────────────────────────────

        /**
         * Creates a tilemap.
         *
         * A tilemap is a pure renderer — it has no position or scroll state of
         * its own. Call drawTo() to render the visible portion of the map into
         * a surface at a given scroll offset.
         *
         * tileSheet must be an offscreen surface. tileW and tileH define the
         * the tile dimensions. Tiles are addressed by index (0-based, left to
         * right, top to bottom on the sheet).
         *
         * mapData is a Uint16Array of tile indices, row-major. Index 0 is the
         * first tile on the sheet — there is no reserved empty tile.
         *
         * Tiles beyond the map bounds are not drawn (clamp to edges).
         *
         * @param {Surface}     tileSheet   Offscreen surface containing tile images
         * @param {number}      tileW       Tile width in pixels
         * @param {number}      tileH       Tile height in pixels
         * @param {Uint16Array} mapData     Tile index array, row-major
         * @param {number}      mapWidth    Map width in tiles
         * @param {number}      mapHeight   Map height in tiles
         * @returns {{
         *   drawTo: function(Surface, number, number): void
         * }}
         */
        createTilemap(tileSheet, tileW, tileH, mapData, mapWidth, mapHeight) {
            if (!tileSheet || !tileSheet._ctx) {
                throw new Error('WakaDDraw.createTilemap: tileSheet is required');
            }

            if (!tileW || !tileH) {
                throw new Error('WakaDDraw.createTilemap: tileW and tileH are required');
            }

            if (!(mapData instanceof Uint16Array)) {
                throw new Error('WakaDDraw.createTilemap: mapData must be a Uint16Array');
            }

            if (!mapWidth || !mapHeight) {
                throw new Error('WakaDDraw.createTilemap: mapWidth and mapHeight are required');
            }

            if (mapData.length !== mapWidth * mapHeight) {
                throw new Error(`WakaDDraw.createTilemap: mapData length (${mapData.length}) must equal mapWidth × mapHeight (${mapWidth * mapHeight})`);
            }

            // Precompute columns on tile sheet — not recalculated per tile
            const cols = Math.floor(tileSheet.width / tileW);

            return {
                /**
                 * Renders the visible portion of the tilemap into a surface.
                 *
                 * scrollX/scrollY are pixel offsets into the map. The destination
                 * surface defines the visible window size. Only tiles that fall
                 * within the destination surface bounds are drawn.
                 *
                 * Call when the scroll position changes — not every frame if the
                 * map is stationary.
                 *
                 * @param {Surface} dst     Destination surface (typically an offscreen surface used as a sprite source)
                 * @param {number}  scrollX Horizontal pixel scroll offset
                 * @param {number}  scrollY Vertical pixel scroll offset
                 */
                drawTo(dst, scrollX, scrollY) {
                    if (!dst || !dst._ctx) {
                        throw new Error('WakaDDraw.tilemap.drawTo: dst surface is required');
                    }

                    scrollX = Math.round(scrollX);
                    scrollY = Math.round(scrollY);

                    const ctx = dst._ctx;
                    const dstW = dst.width;
                    const dstH = dst.height;

                    // First visible tile — clamped to map bounds.
                    // floor handles negative scroll correctly (camera left of origin).
                    const startTileX = Math.max(0, Math.floor(scrollX / tileW));
                    const startTileY = Math.max(0, Math.floor(scrollY / tileH));

                    // Last visible tile — +1 ensures partial tiles at right/bottom
                    // edge are included and avoids gap pop-in during scrolling.
                    const endTileX = Math.min(mapWidth - 1, Math.floor((scrollX + dstW - 1) / tileW) + 1);
                    const endTileY = Math.min(mapHeight - 1, Math.floor((scrollY + dstH - 1) / tileH) + 1);

                    for (let ty = startTileY; ty <= endTileY; ty++) {
                        for (let tx = startTileX; tx <= endTileX; tx++) {
                            // Guard against negative indices (can occur at map edges
                            // when scroll is negative)
                            if (tx < 0 || ty < 0) {
                                continue;
                            }

                            const tileIndex = mapData[ty * mapWidth + tx];

                            // Skip invalid tile indices
                            if (tileIndex < 0) {
                                continue;
                            }

                            // Source rect on tile sheet — cols is precomputed once
                            // on createTilemap, not recalculated per tile
                            const srcCol = tileIndex % cols;
                            const srcRow = Math.floor(tileIndex / cols);
                            const sx = srcCol * tileW;
                            const sy = srcRow * tileH;

                            // Destination position in dst surface
                            const dx = tx * tileW - scrollX;
                            const dy = ty * tileH - scrollY;

                            ctx.drawImage(
                                tileSheet._ctx.canvas,
                                sx, sy, tileW, tileH,
                                dx, dy, tileW, tileH
                            );
                        }
                    }
                }
            };
        },
    };

    WakaDDraw.VERSION = VERSION;
    WakaDDraw.DDBLTFAST_NOCOLORKEY = DDBLTFAST_NOCOLORKEY;
    WakaDDraw.DDBLTFAST_SRCCOLORKEY = DDBLTFAST_SRCCOLORKEY;

    const wakaDDraw = new WakaDDraw();

    wakaDDraw.DDBLTFAST_NOCOLORKEY = DDBLTFAST_NOCOLORKEY;
    wakaDDraw.DDBLTFAST_SRCCOLORKEY = DDBLTFAST_SRCCOLORKEY;

    window.WakaDDraw = WakaDDraw;
    window.wakaDDraw = wakaDDraw;

})();