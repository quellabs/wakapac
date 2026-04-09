/*
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                               ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗  ██╗██████╗  █████╗  ██████╗██╗  ██╗  ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝  ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██████╔╝██║   ██║ ╚███╔╝ ██████╔╝███████║██║     █████╔╝   ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██╔══██╗██║   ██║ ██╔██╗ ██╔═══╝ ██╔══██║██║     ██╔═██╗   ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║██████╔╝╚██████╔╝██╔╝ ██╗██║     ██║  ██║╚██████╗██║  ██╗  ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝   ║
 * ║                                                                                               ║
 * ║  WakaPAC Plugin — WakaBoxPack                                                                 ║
 * ║                                                                                               ║
 * ║  Produces display lists (metafiles) visualising the output of                                 ║
 * ║  ShipmentRouter::pack() as an isometric 3D diagram.                                           ║
 * ║                                                                                               ║
 * ║  Input: the JSON-serialised PackingResult from the PHP packing layer,                         ║
 * ║  with full x/y/z placement coordinates per item.                                              ║
 * ║                                                                                               ║
 * ║  Usage:                                                                                       ║
 * ║    wakaPAC.use(WakaBoxPack);                                                                  ║
 * ║    wakaPAC.use(WakaBoxPack, { colors: ['#e74', '#4a9'], outlineWidth: 2 });                   ║
 * ║                                                                                               ║
 * ║  In msgProc MSG_PAINT:                                                                        ║
 * ║    const dl = this._pack.packedBox(ctx, packingResult, { boxIndex: 0 });                      ║
 * ║    wakaPAC.playMetaFile(ctx, dl);                                                             ║
 * ║                                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // ─── Isometric projection ─────────────────────────────────────────────────
    //
    // Standard 2:1 isometric. Viewer at high-X, high-Y corner, looking toward origin.
    // X runs lower-right, Y runs lower-left, Z runs straight up.
    //
    //   screen_x = ox + (wx - wy) * COS30 * s
    //   screen_y = oy + (wx + wy) * SIN30 * s - wz * s

    const COS30 = Math.cos(Math.PI / 6); // cos 30° ≈ 0.866
    const SIN30 = Math.sin(Math.PI / 6); // sin 30° = 0.5

    /**
     * Project a world coordinate to a canvas point.
     *
     * @param {number} x   World X (width axis)
     * @param {number} y   World Y (length axis, into the scene)
     * @param {number} z   World Z (height axis, upward)
     * @param {number} s   Scale factor — world units (mm) to pixels
     * @param {number} ox  Canvas X of the world origin (0,0,0)
     * @param {number} oy  Canvas Y of the world origin (0,0,0)
     * @returns {{ x: number, y: number }}
     */
    function project(x, y, z, s, ox, oy) {
        return {
            x: ox + (x - y) * COS30 * s,
            y: oy + (x + y) * SIN30 * s - z * s,
        };
    }

    // ─── Color utilities ──────────────────────────────────────────────────────

    // Single off-screen 1×1 canvas reused for all CSS color parsing.
    const _cc = document.createElement('canvas');
    _cc.width = _cc.height = 1;
    const _cx = _cc.getContext('2d');

    /**
     * Parse any CSS color string into { r, g, b } (0–255).
     * Handles hex, rgb(), hsl(), named colors — anything the browser accepts.
     *
     * @param {string} color
     * @returns {{ r: number, g: number, b: number }}
     */
    function parseColor(color) {
        _cx.clearRect(0, 0, 1, 1);
        _cx.fillStyle = color;
        _cx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _cx.getImageData(0, 0, 1, 1).data;
        return { r, g, b };
    }

    /**
     * Scale each RGB channel by a factor and return a CSS rgb() string.
     * Channels are clamped to 0–255.
     *
     * @param {{ r: number, g: number, b: number }} rgb
     * @param {number} f  Brightness factor — >1 lightens, <1 darkens
     * @returns {string}
     */
    function tint(rgb, f) {
        return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
    }

    /**
     * Derive the three shaded face colors for a cuboid from its base palette color.
     * Simulates a light source above the scene: top = brightest, right = shadow.
     *
     * @param {string} base  CSS color string
     * @returns {{ top: string, left: string, right: string }}
     */
    function faceColors(base) {
        const rgb = parseColor(base);
        return {
            top:   tint(rgb, 1.25), // directly lit
            left:  tint(rgb, 1.0),  // oblique
            right: tint(rgb, 0.7),  // in shadow
        };
    }

    // ─── Default color palette ────────────────────────────────────────────────
    // Distinct saturated hues that remain readable at 0.7× and 1.25× tint.
    // Assigned per unique item description in alphabetical order for stability
    // across multiple boxes in the same result.

    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    ];

    // ─── Cuboid rendering ─────────────────────────────────────────────────────

    /**
     * Sort packed items into painter order and draw each as a shaded isometric
     * cuboid by invoking emitQuad once per visible face.
     *
     * FACE SELECTION — viewer at high-X, high-Y sees exactly three faces:
     *   high-X face  (x = x+width,  the right wall)
     *   high-Y face  (y = y+length, the back wall)
     *   top face     (z = z+depth,  the lid)
     * Using far-corner faces avoids coplanar z-fighting: correctly-packed
     * non-overlapping items can never share a high-X or high-Y plane.
     *
     * PAINTER SORT — sort key is the far corner (z+depth, y+length, x+width),
     * all ascending. Lower tops draw first so floor items are always painted
     * before items stacked on them; within the same top level, items further
     * from the viewer (low y+length) draw first.
     *
     * Items must carry a `color` property ({ top, left, right }) in addition
     * to the standard packer fields. Attach it before calling — see packedBox().
     *
     * @param {Array}    items     { x, y, z, width, length, depth, color, … }[]
     * @param {Function} proj      proj(x,y,z) → {x,y} — bound to scale and offset
     * @param {Function} emitQuad  emitQuad(pts, fill) — draws one quad face;
     *                             pts is an array of four {x,y} canvas points
     */
    function renderCuboids(items, proj, emitQuad) {

        const sorted = [...items].sort((a, b) =>
            (a.z + a.depth)  - (b.z + b.depth)  ||   // lower top draws first
            (a.y + a.length) - (b.y + b.length) ||    // further back draws first
            (a.x + a.width)  - (b.x + b.width)        // tiebreak
        );

        for (const item of sorted) {
            const { x, y, z, width: w, length: l, depth: d, color } = item;

            // Project all 8 corners. Naming: p[xHigh][yHigh][zHigh], 0=low, 1=high.
            const p000 = proj(x,     y,     z    );
            const p100 = proj(x + w, y,     z    );
            const p010 = proj(x,     y + l, z    );
            const p110 = proj(x + w, y + l, z    );
            const p001 = proj(x,     y,     z + d);
            const p101 = proj(x + w, y,     z + d);
            const p011 = proj(x,     y + l, z + d);
            const p111 = proj(x + w, y + l, z + d);

            // Top face last so it wins on shared edges with the side faces.
            emitQuad([p101, p111, p110, p100], color.right); // high-X face
            emitQuad([p011, p111, p110, p010], color.left);  // high-Y face
            emitQuad([p001, p101, p111, p011], color.top);   // top face
        }
    }

    // ─── Box shell ────────────────────────────────────────────────────────────
    //
    // Rendered in two passes: walls before items, rim after. The back walls
    // (high-X, high-Y planes) are omitted — items draw those faces themselves.

    /**
     * Draw the three interior faces visible from the high-X, high-Y viewer:
     * floor (z=0), front wall (y=0), and left wall (x=0).
     * Must be called before renderCuboids() so items paint over the walls.
     *
     * @param {Object}   dl     wakaPAC.MetaFile instance
     * @param {number}   W      Box inner width  (mm)
     * @param {number}   L      Box inner length (mm)
     * @param {number}   D      Box inner depth  (mm)
     * @param {Function} proj   proj(x,y,z) → {x,y}
     * @param {string}   fill   CSS fill — use semi-transparent so items show through
     * @param {string}   stroke CSS stroke color
     * @param {number}   lw     Stroke width in pixels
     */
    function drawBoxWalls(dl, W, L, D, proj, fill, stroke, lw) {

        function quad(pts) {
            dl.setFillStyle(fill)
                .setStrokeStyle(stroke)
                .setLineWidth(lw)
                .beginPath()
                .moveTo(pts[0].x, pts[0].y)
                .lineTo(pts[1].x, pts[1].y)
                .lineTo(pts[2].x, pts[2].y)
                .lineTo(pts[3].x, pts[3].y)
                .closePath()
                .fill()
                .stroke();
        }

        quad([proj(0,0,0), proj(W,0,0), proj(W,L,0), proj(0,L,0)]); // floor
        quad([proj(0,0,0), proj(W,0,0), proj(W,0,D), proj(0,0,D)]); // front wall (y=0)
        quad([proj(0,0,0), proj(0,L,0), proj(0,L,D), proj(0,0,D)]); // left wall  (x=0)
    }

    // ─── Legend ───────────────────────────────────────────────────────────────

    /**
     * Emit a color legend into the MetaFile. Each row: filled swatch + label.
     *
     * @param {Object} dl          wakaPAC.MetaFile instance
     * @param {Array}  entries     { color: string, label: string }[]
     * @param {number} x           Left edge of the legend (canvas pixels)
     * @param {number} y           Top edge of the legend (canvas pixels)
     * @param {string} font        CSS font string
     * @param {string} textColor   CSS color for label text
     * @param {number} swatchSize  Swatch width and height in pixels
     * @param {number} rowH        Row height in pixels
     */
    function drawLegend(dl, entries, x, y, font, textColor, swatchSize, rowH) {

        dl.setFont(font).setTextAlign('left').setTextBaseline('middle');

        for (let i = 0; i < entries.length; i++) {
            const ey = y + i * rowH;
            dl.setFillStyle(entries[i].color).fillRect(x, ey, swatchSize, swatchSize);
            dl.setStrokeStyle('rgba(0,0,0,0.25)').setLineWidth(1).strokeRect(x, ey, swatchSize, swatchSize);
            dl.setFillStyle(textColor).fillText(entries[i].label, x + swatchSize + 6, ey + swatchSize / 2);
        }
    }

    // ─── Plugin ───────────────────────────────────────────────────────────────

    window.WakaBoxPack = {

        /**
         * Called by wakaPAC.use(WakaBoxPack, options).
         * Returns a plugin descriptor with lifecycle hooks.
         *
         * @param {Object} pac      wakaPAC instance (reserved, unused)
         * @param {Object} options  Global option defaults applied to all components
         * @returns {{ onComponentCreated: Function }}
         */
        createPacPlugin(pac, options = {}) {

            const defaults = {
                colors:       options.colors       ?? DEFAULT_COLORS,
                outlineColor: options.outlineColor ?? '#1a1a2e',
                outlineWidth: options.outlineWidth ?? 1.5,
                boxWallColor: options.boxWallColor ?? 'rgba(200,205,220,0.5)',
                boxEdgeColor: options.boxEdgeColor ?? '#4a4a6a',
                boxEdgeWidth: options.boxEdgeWidth ?? 2,
                padding:      options.padding      ?? 20,
                font:         options.font         ?? '11px sans-serif',
                legendColor:  options.legendColor  ?? '#333',
                showLegend:   options.showLegend   ?? true,
                legendRowH:   options.legendRowH   ?? 18,
                swatchSize:   options.swatchSize   ?? 12,
            };

            const boxPack = {

                /**
                 * Produce a display list rendering one packed box as an isometric diagram.
                 * Play it back with wakaPAC.playMetaFile() inside MSG_PAINT.
                 *
                 * Expected packingResult shape (json_encode of ShipmentRouter::pack()):
                 *   boxes[].box   — { inner_width, inner_length, inner_depth }
                 *   boxes[].items — { x, y, z, width, length, depth, description, weight }[]
                 * All dimensions in millimetres. The renderer scales to fit the canvas.
                 *
                 * @param {CanvasRenderingContext2D} ctx            Read for canvas dimensions only; not drawn on
                 * @param {Object}                  packingResult  JSON-deserialised PackingResult
                 * @param {Object}                  [opts]         Per-call overrides; boxIndex {number} selects the box (default 0)
                 * @returns {Array} Display list for wakaPAC.playMetaFile()
                 */
                packedBox(ctx, packingResult, opts = {}) {

                    const o = Object.assign({}, defaults, opts);

                    if (!packingResult?.boxes?.length) return [];

                    const boxIndex = o.boxIndex ?? 0;
                    if (boxIndex < 0 || boxIndex >= packingResult.boxes.length) return [];

                    const { box, items } = packingResult.boxes[boxIndex];
                    const W = box.inner_width;
                    const L = box.inner_length;
                    const D = box.inner_depth;
                    if (!W || !L || !D || !Array.isArray(items)) return [];

                    // ── Scale and center ──────────────────────────────────────
                    // Solve for the largest s that fits the iso projection of the box:
                    //   projected width  = (W + L) * COS30 * s
                    //   projected height = (W + L) * SIN30 * s + D * s
                    // Then center by computing the screen bounding box of all 8 corners.

                    const pad     = o.padding;
                    const legendH = o.showLegend && items.length
                        ? [...new Set(items.map(i => i.description))].length * o.legendRowH + pad
                        : 0;
                    const availW  = ctx.canvas.width  - pad * 2;
                    const availH  = ctx.canvas.height - pad * 2 - legendH;

                    const s = Math.min(
                        availW / ((W + L) * COS30),
                        availH / ((W + L) * SIN30 + D)
                    );
                    if (s <= 0) return [];

                    const corners = [[0,0,0],[W,0,0],[0,L,0],[W,L,0],[0,0,D],[W,0,D],[0,L,D],[W,L,D]];
                    const sp      = corners.map(([x,y,z]) => ({ x:(x-y)*COS30*s, y:(x+y)*SIN30*s-z*s }));
                    const minPX   = Math.min(...sp.map(p => p.x));
                    const minPY   = Math.min(...sp.map(p => p.y));
                    const ox      = pad + (availW - (Math.max(...sp.map(p => p.x)) - minPX)) / 2 - minPX;
                    const oy      = pad + (availH - (Math.max(...sp.map(p => p.y)) - minPY)) / 2 - minPY;
                    const proj    = (x, y, z) => project(x, y, z, s, ox, oy);

                    // ── Color map ─────────────────────────────────────────────
                    // Alphabetical sort ensures the same description always maps to the
                    // same color across all boxes in the result.

                    const descriptions = [...new Set(items.map(i => i.description))].sort();
                    const colorMap     = new Map(
                        descriptions.map((d, i) => [d, o.colors[i % o.colors.length]])
                    );

                    // ── Build display list ────────────────────────────────────

                    const dl = new wakaPAC.MetaFile();

                    // 1. Box walls — floor, front, left; drawn first so items paint over them
                    drawBoxWalls(dl, W, L, D, proj, o.boxWallColor, o.boxEdgeColor, o.boxEdgeWidth);

                    // 2. Items — attach face colors then delegate to renderCuboids
                    renderCuboids(
                        items.map(item => ({
                            ...item,
                            color: faceColors(colorMap.get(item.description) ?? o.colors[0]),
                        })),
                        proj,
                        (pts, fill) => {
                            dl.setFillStyle(fill)
                                .setStrokeStyle(o.outlineColor)
                                .setLineWidth(o.outlineWidth)
                                .setLineJoin('round')
                                .beginPath()
                                .moveTo(pts[0].x, pts[0].y)
                                .lineTo(pts[1].x, pts[1].y)
                                .lineTo(pts[2].x, pts[2].y)
                                .lineTo(pts[3].x, pts[3].y)
                                .closePath()
                                .fill()
                                .stroke();
                        }
                    );

                    // 3. Legend
                    if (o.showLegend && descriptions.length) {
                        drawLegend(
                            dl,
                            descriptions.map(d => ({ color: colorMap.get(d), label: d })),
                            pad,
                            ctx.canvas.height - pad - descriptions.length * o.legendRowH,
                            o.font, o.legendColor, o.swatchSize, o.legendRowH
                        );
                    }

                    return dl.build();
                },
            };

            return {

                /**
                 * Injects the boxPack API onto the component abstraction.
                 * Property name is taken from config.wakaBoxPack.property (default '_pack').
                 * If component-level options are present they become a defaults layer
                 * between the global defaults and per-call opts.
                 *
                 * @param {Object} abstraction  The reactive component abstraction
                 * @param {string} pacId        Component identifier
                 * @param {Object} config       Component configuration object
                 */
                onComponentCreated(abstraction, pacId, config) {
                    const key           = config.wakaBoxPack?.property ?? '_pack';
                    const componentOpts = Object.assign({}, config.wakaBoxPack ?? {});
                    delete componentOpts.property;

                    if (!Object.keys(componentOpts).length) {
                        abstraction[key] = boxPack;
                        return;
                    }

                    const wrapped = Object.create(null);
                    for (const name of Object.keys(boxPack)) {
                        wrapped[name] = (ctx, data, o2) =>
                            boxPack[name](ctx, data, Object.assign({}, componentOpts, o2));
                    }
                    abstraction[key] = wrapped;
                },
            };
        },
    };

})();