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
 * ║  In msgProc MSG_LCLICK:                                                                       ║
 * ║    const pos = wakaPAC.MAKEPOINTS(event.lParam);                                              ║
 * ║    const hit = wakaPAC.metaFileHitTest(this._lastDL, pos.x, pos.y);                           ║
 * ║    // hit → { description, weight, x, y, z, width, length, depth }                            ║
 * ║                                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    // ─── Isometric projection ─────────────────────────────────────────────────
    //
    // Standard 2:1 isometric projection. The viewer stands at the high-X,
    // high-Y corner of the scene, looking toward the origin.
    //
    //   screen_x = ox + (wx - wy) * COS30 * s
    //   screen_y = oy + (wx + wy) * SIN30 * s - wz * s

    const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
    const SIN30 = Math.sin(Math.PI / 6); // = 0.5

    /**
     * Project a world coordinate to a canvas point.
     *
     * @param {number} x  World X
     * @param {number} y  World Y
     * @param {number} z  World Z (height)
     * @param {number} s  Scale factor (world units → pixels)
     * @param {number} ox Canvas X offset of the scene origin
     * @param {number} oy Canvas Y offset of the scene origin
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
     *
     * @param {string} color
     * @returns {{ r: number, g: number, b: number }}
     */
    function parseColor(color) {
        _cx.clearRect(0, 0, 1, 1);
        _cx.fillStyle = color;
        _cx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _cx.getImageData(0, 0, 1, 1).data;
        return {r, g, b};
    }

    /**
     * Multiply each channel of an { r, g, b } color by a factor and return a
     * CSS rgb() string. Values are clamped to 0–255.
     *
     * @param {{ r: number, g: number, b: number }} rgb
     * @param {number} f  Brightness factor (>1 lightens, <1 darkens)
     * @returns {string}
     */
    function tint(rgb, f) {
        return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
    }

    /**
     * Derive the three shaded face colors for a cuboid from its base color.
     * Top face is brightest (lit from above), right face is mid, left face darkest.
     *
     * @param {string} base  CSS color string
     * @returns {{ top: string, left: string, right: string }}
     */
    function faceColors(base) {
        const rgb = parseColor(base);
        return {
            top: tint(rgb, 1.25),
            left: tint(rgb, 1.0),
            right: tint(rgb, 0.7),
        };
    }

    // ─── Default color palette ────────────────────────────────────────────────

    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    ];

    // ─── Cuboid rendering ─────────────────────────────────────────────────────
    //
    // Painter's algorithm for axis-aligned packed boxes:
    //
    // The viewer is at high-X, high-Y, so the three visible faces of each
    // cuboid are the high-X face (right), high-Y face (back), and top face.
    // Using the far-corner faces avoids coplanar z-fighting between adjacent
    // items — correctly-packed non-overlapping boxes can never share a high-X
    // or high-Y plane.
    //
    // Draw order:
    //   Primary:   z + depth ascending  — items whose tops are lower draw first,
    //              guaranteeing floor items are painted before items stacked
    //              on top of them.
    //   Secondary: y + length ascending — within the same top-surface level,
    //              items further from the viewer (low y+length) draw first.
    //   Tertiary:  x + width ascending  — final tiebreak on the X axis.

    /**
     * Sort packed items into correct painter order and draw each as a
     * three-faced isometric cuboid into the MetaFile.
     *
     * Each item must have: x, y, z, width, length, depth, color.
     * color must be a { top, left, right } object (see faceColors()).
     *
     * @param {Array}    items    Array of item objects with geometry + color
     * @param {Function} proj     project(x,y,z) → {x,y} — already bound to s,ox,oy
     * @param {Function} emitQuad emitQuad(pts, fillColor) — draws one face
     */
    function renderCuboids(items, proj, emitQuad) {

        const sorted = [...items].sort((a, b) =>
            (a.z + a.depth) - (b.z + b.depth) ||
            (a.y + a.length) - (b.y + b.length) ||
            (a.x + a.width) - (b.x + b.width)
        );

        for (const {x, y, z, width: w, length: l, depth: d, color} of sorted) {

            // Project the 8 corners of the cuboid.
            // Naming convention: p[xHigh][yHigh][zHigh]
            const p000 = proj(x, y, z);
            const p100 = proj(x + w, y, z);
            const p010 = proj(x, y + l, z);
            const p110 = proj(x + w, y + l, z);
            const p001 = proj(x, y, z + d);
            const p101 = proj(x + w, y, z + d);
            const p011 = proj(x, y + l, z + d);
            const p111 = proj(x + w, y + l, z + d);

            // Right face: high-X plane (x = x+w), visible from high-X viewer
            emitQuad([p101, p111, p110, p100], color.right);

            // Back face:  high-Y plane (y = y+l), visible from high-Y viewer
            emitQuad([p011, p111, p110, p010], color.left);

            // Top face:   high-Z plane (z = z+d), drawn last so it wins on shared edges
            emitQuad([p001, p101, p111, p011], color.top);
        }
    }

    // ─── Box shell ────────────────────────────────────────────────────────────

    /**
     * Draw the three interior faces of the open box that are visible to the
     * viewer at high-X, high-Y: the floor, the front wall (y=0), and the
     * left wall (x=0). These are drawn before items so they sit behind everything.
     *
     * @param {Object}   dl     wakaPAC.MetaFile instance
     * @param {number}   W      Box inner width
     * @param {number}   L      Box inner length
     * @param {number}   D      Box inner depth
     * @param {Function} proj   project(x,y,z) → {x,y}
     * @param {string}   fill   CSS fill color (typically semi-transparent)
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

        quad([proj(0, 0, 0), proj(W, 0, 0), proj(W, L, 0), proj(0, L, 0)]); // floor
        quad([proj(0, 0, 0), proj(W, 0, 0), proj(W, 0, D), proj(0, 0, D)]); // front wall  (y=0)
        quad([proj(0, 0, 0), proj(0, L, 0), proj(0, L, D), proj(0, 0, D)]); // left wall   (x=0)
    }

    /**
     * Draw the nine visible rim edges of the open box. Called after items so
     * the box outline sits on top of everything.
     *
     * @param {Object}   dl     wakaPAC.MetaFile instance
     * @param {number}   W      Box inner width
     * @param {number}   L      Box inner length
     * @param {number}   D      Box inner depth
     * @param {Function} proj   project(x,y,z) → {x,y}
     * @param {string}   stroke CSS stroke color
     * @param {number}   lw     Stroke width in pixels
     */
    function drawBoxRim(dl, W, L, D, proj, stroke, lw) {

        dl.setStrokeStyle(stroke).setLineWidth(lw).setLineCap('round');

        function edge(a, b) {
            dl.beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).stroke();
        }

        // Vertical edges
        edge(proj(0, 0, 0), proj(0, 0, D));
        edge(proj(W, 0, 0), proj(W, 0, D));
        edge(proj(0, L, 0), proj(0, L, D));

        // Bottom rim
        edge(proj(0, 0, 0), proj(W, 0, 0));
        edge(proj(0, 0, 0), proj(0, L, 0));

        // Top rim
        edge(proj(0, 0, D), proj(W, 0, D));
        edge(proj(0, 0, D), proj(0, L, D));
        edge(proj(W, 0, D), proj(W, L, D));
        edge(proj(0, L, D), proj(W, L, D));
    }

    // ─── Legend ───────────────────────────────────────────────────────────────

    /**
     * Emit a color legend into the MetaFile.
     * Each row shows a filled swatch followed by the item description label.
     *
     * @param {Object} dl         wakaPAC.MetaFile instance
     * @param {Array}  entries    Array of { color, label }
     * @param {number} x          Left edge of the legend
     * @param {number} y          Top edge of the legend
     * @param {string} font       CSS font string
     * @param {string} textColor  CSS color for label text
     * @param {number} swatchSize Swatch width and height in pixels
     * @param {number} rowH       Row height in pixels
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

        createPacPlugin(pac, options = {}) {

            /**
             * Global defaults — all overridable per call via opts.
             */
            const defaults = {
                colors: options.colors ?? DEFAULT_COLORS,
                outlineColor: options.outlineColor ?? '#1a1a2e',
                outlineWidth: options.outlineWidth ?? 1.5,
                boxWallColor: options.boxWallColor ?? 'rgba(200,205,220,0.5)',
                boxEdgeColor: options.boxEdgeColor ?? '#4a4a6a',
                boxEdgeWidth: options.boxEdgeWidth ?? 2,
                padding: options.padding ?? 20,
                font: options.font ?? '11px sans-serif',
                legendColor: options.legendColor ?? '#333',
                showLegend: options.showLegend ?? true,
                legendRowH: options.legendRowH ?? 18,
                swatchSize: options.swatchSize ?? 12,
            };

            const boxPack = {

                /**
                 * Produce a display list rendering one packed box from a PackingResult
                 * as an isometric 3D diagram.
                 *
                 * Input shape (JSON from ShipmentRouter::pack()):
                 *   { boxes: [ { box: { inner_width, inner_length, inner_depth },
                 *                items: [ { x, y, z, width, length, depth,
                 *                           description, weight } ] } ] }
                 *
                 * Per-call opts:
                 *   boxIndex {number} — which box to render (default 0)
                 *
                 * Hit payload from metaFileHitTest:
                 *   { description, weight, x, y, z, width, length, depth }
                 *
                 * @param {CanvasRenderingContext2D} ctx  Used for canvas dimensions only
                 * @param {Object} packingResult          JSON-deserialised PackingResult
                 * @param {Object} [opts]                 Per-call option overrides
                 * @returns {Array} Display list for wakaPAC.playMetaFile()
                 */
                packedBox(ctx, packingResult, opts = {}) {

                    const o = Object.assign({}, defaults, opts);

                    if (!packingResult?.boxes?.length) {
                        return [];
                    }

                    const boxIndex = o.boxIndex ?? 0;
                    if (boxIndex < 0 || boxIndex >= packingResult.boxes.length) {
                        return [];
                    }

                    const {box, items} = packingResult.boxes[boxIndex];
                    const W = box.inner_width;
                    const L = box.inner_length;
                    const D = box.inner_depth;
                    if (!W || !L || !D || !Array.isArray(items)) {
                        return [];
                    }

                    // ── Layout ────────────────────────────────────────────────

                    const pad = o.padding;
                    const legendH = o.showLegend && items.length
                        ? [...new Set(items.map(i => i.description))].length * o.legendRowH + pad
                        : 0;
                    const availW = ctx.canvas.width - pad * 2;
                    const availH = ctx.canvas.height - pad * 2 - legendH;

                    // Largest scale that fits the iso projection of the box
                    const s = Math.min(
                        availW / ((W + L) * COS30),
                        availH / ((W + L) * SIN30 + D)
                    );
                    if (s <= 0) {
                        return [];
                    }

                    // Center by computing the bounding box of all 8 projected box corners
                    const corners = [
                        [0, 0, 0], [W, 0, 0], [0, L, 0], [W, L, 0],
                        [0, 0, D], [W, 0, D], [0, L, D], [W, L, D],
                    ];
                    const screenPts = corners.map(([x, y, z]) => ({
                        x: (x - y) * COS30 * s,
                        y: (x + y) * SIN30 * s - z * s,
                    }));
                    const minPX = Math.min(...screenPts.map(p => p.x));
                    const minPY = Math.min(...screenPts.map(p => p.y));
                    const diagW = Math.max(...screenPts.map(p => p.x)) - minPX;
                    const diagH = Math.max(...screenPts.map(p => p.y)) - minPY;

                    const ox = pad + (availW - diagW) / 2 - minPX;
                    const oy = pad + (availH - diagH) / 2 - minPY;

                    const proj = (x, y, z) => project(x, y, z, s, ox, oy);

                    // ── Color map ─────────────────────────────────────────────
                    // One color per unique description, sorted for stable assignment
                    // across boxes so the same item type always gets the same color.

                    const descriptions = [...new Set(items.map(i => i.description))].sort();
                    const colorMap = new Map(
                        descriptions.map((d, i) => [d, o.colors[i % o.colors.length]])
                    );

                    // ── Build display list ────────────────────────────────────

                    const dl = new wakaPAC.MetaFile();

                    // 1. Box interior walls — drawn first, behind all items
                    drawBoxWalls(dl, W, L, D, proj, o.boxWallColor, o.boxEdgeColor, o.boxEdgeWidth);

                    // 2. Items — sorted and drawn as shaded cuboids
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

                    // 3. Box rim edges — drawn last so they sit on top of items
                    drawBoxRim(dl, W, L, D, proj, o.boxEdgeColor, o.boxEdgeWidth);

                    // 4. Hit areas — one rect per item covering the top face,
                    //    registered after all drawing so they don't affect paint order.
                    for (const item of items) {
                        const {x, y, z, width: w, length: l, depth: d} = item;
                        const topPts = [
                            proj(x, y, z + d),
                            proj(x + w, y, z + d),
                            proj(x + w, y + l, z + d),
                            proj(x, y + l, z + d),
                        ];
                        const xs = topPts.map(p => p.x), ys = topPts.map(p => p.y);
                        const minX = Math.min(...xs), minY = Math.min(...ys);
                        dl.hitArea('rect', {
                            x: minX, y: minY,
                            w: Math.max(...xs) - minX,
                            h: Math.max(...ys) - minY,
                            data: {
                                description: item.description,
                                weight: item.weight,
                                x: item.x, y: item.y, z: item.z,
                                width: w, length: l, depth: d,
                            },
                        });
                    }

                    // 5. Legend
                    if (o.showLegend && descriptions.length) {
                        drawLegend(
                            dl,
                            descriptions.map(d => ({color: colorMap.get(d), label: d})),
                            pad,
                            ctx.canvas.height - pad - descriptions.length * o.legendRowH,
                            o.font, o.legendColor, o.swatchSize, o.legendRowH
                        );
                    }

                    return dl.build();
                },
            };

            return {
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.wakaBoxPack?.property ?? '_pack';
                    const componentOpts = Object.assign({}, config.wakaBoxPack ?? {});
                    delete componentOpts.property;

                    // No component-level options — inject boxPack directly.
                    // Otherwise wrap so component opts act as defaults but
                    // per-call opts still take precedence.
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