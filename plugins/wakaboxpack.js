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
    // Standard 2:1 isometric: X and Y axes project at 30° from horizontal,
    // Z projects straight up.
    //
    //   screen_x = (worldX - worldY) * ISO_COS * s
    //   screen_y = (worldX + worldY) * ISO_SIN * s - worldZ * s
    //
    const ISO_COS = Math.cos(Math.PI / 6); // cos 30° ≈ 0.866
    const ISO_SIN = Math.sin(Math.PI / 6); // sin 30° = 0.5

    /**
     * Project a 3D world coordinate to a 2D canvas point.
     * Origin (0,0,0) maps to (0,0) — the caller applies canvas offsets separately.
     *
     * @param {number} wx  World X (width axis)
     * @param {number} wy  World Y (length axis)
     * @param {number} wz  World Z (height axis, upward)
     * @param {number} s   Uniform scale factor (world units → pixels)
     * @returns {{ x: number, y: number }}
     */
    function project(wx, wy, wz, s) {
        return {
            x: (wx - wy) * ISO_COS * s,
            y: (wx + wy) * ISO_SIN * s - wz * s,
        };
    }

    // ─── Color utilities ──────────────────────────────────────────────────────

    // Off-screen 1×1 canvas reused for all color parsing — created once, never resized.
    const _colorCanvas = document.createElement('canvas');
    _colorCanvas.width = _colorCanvas.height = 1;
    const _colorCtx = _colorCanvas.getContext('2d');

    /**
     * Parse any CSS color string into { r, g, b } (0–255).
     * Reuses a single off-screen canvas to avoid repeated allocations.
     *
     * @param {string} color
     * @returns {{ r: number, g: number, b: number }}
     */
    function parseColor(color) {
        _colorCtx.clearRect(0, 0, 1, 1);
        _colorCtx.fillStyle = color;
        _colorCtx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _colorCtx.getImageData(0, 0, 1, 1).data;
        return {r, g, b};
    }

    /**
     * Lighten or darken an { r, g, b } color by a factor.
     * factor > 1 lightens, factor < 1 darkens.
     *
     * @param {{ r: number, g: number, b: number }} rgb
     * @param {number} factor
     * @returns {string} CSS rgb() string
     */
    function shiftBrightness(rgb, factor) {
        const r = Math.min(255, Math.round(rgb.r * factor));
        const g = Math.min(255, Math.round(rgb.g * factor));
        const b = Math.min(255, Math.round(rgb.b * factor));
        return `rgb(${r},${g},${b})`;
    }

    /**
     * Return the three face colors for a cuboid given its base color.
     * Top face is brightest (lit from above), left is mid, right is darkest.
     *
     * @param {string} base  CSS color string
     * @returns {{ top: string, left: string, right: string }}
     */
    function faceColors(base) {
        const rgb = parseColor(base);
        return {
            top: shiftBrightness(rgb, 1.25),
            left: shiftBrightness(rgb, 1.0),
            right: shiftBrightness(rgb, 0.7),
        };
    }

    // ─── Default color palette ────────────────────────────────────────────────
    // Distinct, saturated colors that read well across three-face shading.
    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
        '#9c755f', '#bab0ac'
    ];

    // ─── Drawing helpers ──────────────────────────────────────────────────────

    /**
     * Emit a filled + stroked quad path into a MetaFile.
     *
     * @param {Object} dl          wakaPAC.MetaFile instance
     * @param {Array}  pts         Four { x, y } screen points in winding order
     * @param {string} fillColor   CSS fill color
     * @param {string} strokeColor CSS stroke color
     * @param {number} lineWidth   Stroke width in pixels
     */
    function emitFace(dl, pts, fillColor, strokeColor, lineWidth) {
        dl.setFillStyle(fillColor)
            .setStrokeStyle(strokeColor)
            .setLineWidth(lineWidth)
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

    /**
     * Collect the three visible faces of a cuboid into the face list.
     * Faces are stored in world space so they can be depth-sorted before
     * projection. Each face carries its fill color and a depth key computed
     * from the sum of its four world-space vertices.
     *
     * Viewer is at low-X, low-Y, so the three visible faces are:
     *   front  (y = pos.y plane, faces toward viewer)
     *   right  (x = pos.x+dim.w plane, faces right)
     *   top    (z = pos.z+dim.d plane, faces up)
     *
     * @param {Array}  faces  Accumulator array
     * @param {Object} pos    World origin: { x, y, z }
     * @param {Object} dim    World dimensions: { w, l, d }
     * @param {{ top: string, left: string, right: string }} colors
     */
    function collectFaces(faces, pos, dim, colors) {
        const {x, y, z} = pos;
        const {w, l, d} = dim;
        const x2 = x + w, y2 = y + l, z2 = z + d;

        // Eight corners in world space
        const p000 = {x, y, z};
        const p100 = {x: x2, y, z};
        const p010 = {x, y: y2, z};
        const p110 = {x: x2, y: y2, z};
        const p001 = {x, y, z: z2};
        const p101 = {x: x2, y, z: z2};
        const p011 = {x, y: y2, z: z2};
        const p111 = {x: x2, y: y2, z: z2};

        // depth key = sum of vertex world coords (higher = further from viewer = draw first)
        const key = (...pts) => {
            let m = -Infinity;

            for (const p of pts) {
                const d = p.x + p.y;

                if (d > m) {
                    m = d;
                }
            }

            return m;
        };

        //  Back face (y = y2)
        const back = [p011, p111, p110, p010];
        faces.push({pts: back, fill: colors.left, depth: key(...back)});

        // Right face (x = x2, faces toward viewer at low-X)
        const right = [p101, p111, p110, p100];
        faces.push({pts: right, fill: colors.right, depth: key(...right)});

        // Top face (z = z2)
        const top = [p001, p101, p111, p011];
        faces.push({pts: top, fill: colors.top, depth: key(...top)});
    }

    /**
     * Emit a hit area for the top face of a cuboid.
     * Uses the bounding rect of the four top-face screen points — close enough
     * for typical item sizes and avoids polygon hit-testing overhead.
     *
     * @param {Object} dl   wakaPAC.MetaFile instance
     * @param {Object} pos  World origin: { x, y, z }
     * @param {Object} dim  World dimensions: { w, l, d }
     * @param {number} s    Scale
     * @param {number} ox   Canvas origin X
     * @param {number} oy   Canvas origin Y
     * @param {Object} data Hit payload returned by metaFileHitTest
     */
    function emitItemHitArea(dl, pos, dim, s, ox, oy, data) {
        const {x, y, z} = pos;
        const {w, l, d} = dim;

        const pts = [
            project(x, y, z + d, s),
            project(x + w, y, z + d, s),
            project(x + w, y + l, z + d, s),
            project(x, y + l, z + d, s),
        ];

        const xs = pts.map(p => p.x + ox);
        const ys = pts.map(p => p.y + oy);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);

        dl.hitArea('rect', {
            x: minX,
            y: minY,
            w: Math.max(...xs) - minX,
            h: Math.max(...ys) - minY,
            data,
        });
    }

    // ─── Box rendering — back walls, clip, front edges ─────────────────────────

    /**
     * Draw the three back/interior faces of the box (floor, back-left wall,
     * back-right wall). Called before items so walls sit behind everything.
     */
    function emitBoxBack(dl, innerW, innerL, innerD, s, ox, oy, wallColor, edgeColor, edgeWidth) {
        const off = pt => ({x: pt.x + ox, y: pt.y + oy});
        const p000 = off(project(0, 0, 0, s));
        const p100 = off(project(innerW, 0, 0, s));
        const p010 = off(project(0, innerL, 0, s));
        const p110 = off(project(innerW, innerL, 0, s));
        const p011 = off(project(0, innerL, innerD, s));
        const p111 = off(project(innerW, innerL, innerD, s));
        const p101 = off(project(innerW, 0, innerD, s));

        // Floor (z=0)
        emitFace(dl, [p000, p100, p110, p010], wallColor, edgeColor, edgeWidth);
        // Back wall (high Y — furthest from viewer)
        emitFace(dl, [p010, p110, p111, p011], wallColor, edgeColor, edgeWidth);
        // Back-right wall (high X — furthest right)
        emitFace(dl, [p100, p110, p111, p101], wallColor, edgeColor, edgeWidth);
    }

    /**
     * Draw the three front/visible rim edges of the open box top.
     * Called after items so edges sit on top of everything.
     * Only strokes — no fill — so items remain visible through the opening.
     */
    function emitBoxFront(dl, innerW, innerL, innerD, s, ox, oy, edgeColor, edgeWidth) {
        const off = pt => ({x: pt.x + ox, y: pt.y + oy});
        const p000 = off(project(0, 0, 0, s));
        const p100 = off(project(innerW, 0, 0, s));
        const p010 = off(project(0, innerL, 0, s));
        const p001 = off(project(0, 0, innerD, s));
        const p101 = off(project(innerW, 0, innerD, s));
        const p011 = off(project(0, innerL, innerD, s));

        dl.setStrokeStyle(edgeColor).setLineWidth(edgeWidth).setLineCap('round');

        // Front-left vertical edge
        dl.beginPath().moveTo(p000.x, p000.y).lineTo(p001.x, p001.y).stroke();
        // Front-right vertical edge
        dl.beginPath().moveTo(p100.x, p100.y).lineTo(p101.x, p101.y).stroke();
        // Front-bottom horizontal edge
        dl.beginPath().moveTo(p000.x, p000.y).lineTo(p100.x, p100.y).stroke();
        // Left-bottom horizontal edge
        dl.beginPath().moveTo(p000.x, p000.y).lineTo(p010.x, p010.y).stroke();
        // Left vertical edge (back-left)
        dl.beginPath().moveTo(p010.x, p010.y).lineTo(p011.x, p011.y).stroke();
        // Top rim front-left
        dl.beginPath().moveTo(p001.x, p001.y).lineTo(p101.x, p101.y).stroke();
        // Top rim front-right to back
        dl.beginPath().moveTo(p101.x, p101.y).lineTo(p101.x, p101.y).stroke();
    }

    // ─── Box clip region ─────────────────────────────────────────────────────

    /**
     * Emit a clip region covering the three visible interior faces of the box.
     * All subsequent drawing is confined to this region until restore() is called.
     *
     * The clip polygon traces the entire visible interior — floor, left wall,
     * right wall — as one closed path. This means items can never bleed outside
     * the box regardless of draw order, eliminating the need for painter's sorting.
     *
     * Call dl.save() before this and dl.restore() after all items are drawn.
     *
     * @param {Object} dl     wakaPAC.MetaFile instance
     * @param {number} innerW Box inner width  (world units)
     * @param {number} innerL Box inner length (world units)
     * @param {number} innerD Box inner depth  (world units)
     * @param {number} s      Scale factor
     * @param {number} ox     Canvas origin X
     * @param {number} oy     Canvas origin Y
     */
    function emitBoxClip(dl, innerW, innerL, innerD, s, ox, oy) {
        const off = pt => ({x: pt.x + ox, y: pt.y + oy});

        const p000 = off(project(0, 0, 0, s));
        const p100 = off(project(innerW, 0, 0, s));
        const p010 = off(project(0, innerL, 0, s));
        const p110 = off(project(innerW, innerL, 0, s));
        const p001 = off(project(0, 0, innerD, s));
        const p101 = off(project(innerW, 0, innerD, s));
        const p011 = off(project(0, innerL, innerD, s));
        const p111 = off(project(innerW, innerL, innerD, s));

        // Trace the full visible interior as one closed polygon:
        // top rim (open top) → left wall down → floor → right wall up
        dl.beginPath()
            .moveTo(p001.x, p001.y)
            .lineTo(p101.x, p101.y)
            .lineTo(p111.x, p111.y)
            .lineTo(p011.x, p011.y)
            .lineTo(p010.x, p010.y)
            .lineTo(p110.x, p110.y)
            .lineTo(p100.x, p100.y)
            .lineTo(p000.x, p000.y)
            .closePath()
            .clip();
    }

    // ─── Legend ───────────────────────────────────────────────────────────────

    /**
     * Emit a color legend into the MetaFile.
     * Each row shows a filled color swatch followed by the item description.
     *
     * @param {Object} dl          wakaPAC.MetaFile instance
     * @param {Array}  entries     Array of { color, label } objects
     * @param {number} x           Left edge of the legend area
     * @param {number} y           Top edge of the legend area
     * @param {string} font        CSS font string
     * @param {string} textColor   CSS color for label text
     * @param {number} swatchSize  Swatch width and height in pixels
     * @param {number} rowHeight   Vertical distance between rows in pixels
     */
    function emitLegend(dl, entries, x, y, font, textColor, swatchSize, rowHeight) {
        dl.setFont(font).setTextAlign('left').setTextBaseline('middle');

        for (let i = 0; i < entries.length; i++) {
            const ey = y + i * rowHeight;

            dl.setFillStyle(entries[i].color)
                .fillRect(x, ey, swatchSize, swatchSize);

            dl.setStrokeStyle('rgba(0,0,0,0.25)')
                .setLineWidth(1)
                .strokeRect(x, ey, swatchSize, swatchSize);

            dl.setFillStyle(textColor)
                .fillText(entries[i].label, x + swatchSize + 6, ey + swatchSize / 2);
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
                boxWallColor: options.boxWallColor ?? 'rgba(180,180,200,0.18)',
                boxEdgeColor: options.boxEdgeColor ?? '#4a4a6a',
                boxEdgeWidth: options.boxEdgeWidth ?? 2,
                padding: options.padding ?? 20,
                font: options.font ?? '11px sans-serif',
                legendColor: options.legendColor ?? '#333333',
                showLegend: options.showLegend ?? true,
                legendRowH: options.legendRowH ?? 18,
                swatchSize: options.swatchSize ?? 12,
            };

            const boxPack = {

                /**
                 * Produces a display list rendering one packed box from a PackingResult
                 * as a cartoony isometric diagram.
                 *
                 * Each item is drawn as a shaded cuboid at its exact x/y/z placement
                 * coordinates and post-rotation dimensions from the PHP packing layer.
                 * Items are sorted back-to-front (painter's algorithm) so overlapping
                 * cuboids composite correctly.
                 *
                 * Each item's top face emits a hitArea. On hit, metaFileHitTest returns:
                 *   { description, weight, x, y, z, width, length, depth }
                 *
                 * @param {CanvasRenderingContext2D} ctx
                 *   Used only for canvas dimensions — no drawing occurs here.
                 * @param {Object} packingResult
                 *   JSON-deserialised PackingResult from ShipmentRouter::pack().
                 *   Shape: { boxes: [ { box: { inner_width, inner_length, inner_depth },
                 *                        items: [ { x, y, z, width, length, depth,
                 *                                   description, weight } ] } ] }
                 * @param {Object} [opts]
                 *   Per-call overrides for any global default, plus:
                 *     boxIndex {number} — which box in the result to render (default 0)
                 * @returns {Array} Display list for wakaPAC.playMetaFile()
                 */
                packedBox: (ctx, packingResult, opts = {}) => {
                    const o = Object.assign({}, defaults, opts);

                    // ── Validate input ────────────────────────────────────────
                    if (!packingResult || !Array.isArray(packingResult.boxes) || packingResult.boxes.length === 0) {
                        return [];
                    }

                    const boxIndex = o.boxIndex ?? 0;

                    if (boxIndex < 0 || boxIndex >= packingResult.boxes.length) {
                        return [];
                    }

                    const packedBox = packingResult.boxes[boxIndex];
                    const box = packedBox.box;
                    const items = Array.isArray(packedBox.items) ? packedBox.items : [];
                    const innerW = box.inner_width;
                    const innerL = box.inner_length;
                    const innerD = box.inner_depth;

                    if (!innerW || !innerL || !innerD) {
                        return [];
                    }

                    // ── Color map ─────────────────────────────────────────────
                    // One color per unique description, assigned in sorted order so
                    // the same item type always gets the same color across boxes.
                    const descriptions = [...new Set(items.map(i => i.description))].sort();
                    const colorMap = new Map(
                        descriptions.map((desc, idx) => [desc, o.colors[idx % o.colors.length]])
                    );

                    // ── Layout ────────────────────────────────────────────────
                    const canvasW = ctx.canvas.width;
                    const canvasH = ctx.canvas.height;
                    const pad = o.padding;

                    const legendH = o.showLegend && descriptions.length > 0
                        ? descriptions.length * o.legendRowH + pad
                        : 0;

                    const availW = canvasW - pad * 2;
                    const availH = canvasH - pad * 2 - legendH;

                    // Solve for the largest uniform scale s that fits the iso projection
                    // of the outer box within the available area:
                    //   projected width  = (innerW + innerL) * ISO_COS * s
                    //   projected height = (innerW + innerL) * ISO_SIN * s + innerD * s
                    const s = Math.min(
                        availW / ((innerW + innerL) * ISO_COS),
                        availH / ((innerW + innerL) * ISO_SIN + innerD)
                    );

                    if (s <= 0) {
                        return [];
                    }

                    // Center the diagram by projecting all 8 outer box corners,
                    // computing their screen bounding box, then offsetting so the
                    // diagram sits centered in the available area.
                    const corners3D = [
                        [0, 0, 0], [innerW, 0, 0],
                        [0, innerL, 0], [innerW, innerL, 0],
                        [0, 0, innerD], [innerW, 0, innerD],
                        [0, innerL, innerD], [innerW, innerL, innerD],
                    ];

                    const proj = corners3D.map(([x, y, z]) => project(x, y, z, s));
                    const minPX = Math.min(...proj.map(p => p.x));
                    const minPY = Math.min(...proj.map(p => p.y));
                    const diagW = Math.max(...proj.map(p => p.x)) - minPX;
                    const diagH = Math.max(...proj.map(p => p.y)) - minPY;

                    const ox = pad + (availW - diagW) / 2 - minPX;
                    const oy = pad + (availH - diagH) / 2 - minPY;

                    // ── Build display list ────────────────────────────────────
                    const dl = new wakaPAC.MetaFile();

                    // ── Back walls drawn first, behind everything ─────────────
                    emitBoxBack(dl, innerW, innerL, innerD, s, ox, oy,
                        o.boxWallColor, o.boxEdgeColor, o.boxEdgeWidth);

                    // ── Items clipped to box interior, sorted back-to-front ────
                    dl.save();
                    emitBoxClip(dl, innerW, innerL, innerD, s, ox, oy);

                    // Collect all faces from all items in world space, then sort
                    // by depth before projecting. Face-level sorting is required —
                    // item-level sorting breaks when large items span multiple depth
                    // zones and their faces interleave with faces from other items.
                    const allFaces = [];

                    for (const item of items) {
                        const pos = {x: item.x, y: item.y, z: item.z};
                        const dim = {w: item.width, l: item.length, d: item.depth};
                        collectFaces(allFaces, pos, dim,
                            faceColors(colorMap.get(item.description) ?? o.colors[0]));
                    }

                    // Sort descending: higher depth key = further from viewer = draw first
                    allFaces.sort((a, b) => b.depth - a.depth);

                    // Project and emit each face
                    for (const f of allFaces) {
                        const pts = f.pts.map(p => {
                            const sc = project(p.x, p.y, p.z, s);
                            return {x: sc.x + ox, y: sc.y + oy};
                        });
                        emitFace(dl, pts, f.fill, o.outlineColor, o.outlineWidth);
                    }

                    // Hit areas — one per item, on the top face bounding rect.
                    // Emitted after faces so they sit on top of all drawing ops.
                    for (const item of items) {
                        const pos = {x: item.x, y: item.y, z: item.z};
                        const dim = {w: item.width, l: item.length, d: item.depth};
                        emitItemHitArea(dl, pos, dim, s, ox, oy, {
                            description: item.description,
                            weight: item.weight,
                            x: item.x,
                            y: item.y,
                            z: item.z,
                            width: item.width,
                            length: item.length,
                            depth: item.depth,
                        });
                    }

                    dl.restore();

                    // ── Front edges drawn last, on top of everything ──────────
                    emitBoxFront(dl, innerW, innerL, innerD, s, ox, oy,
                        o.boxEdgeColor, o.boxEdgeWidth);

                    // Legend
                    if (o.showLegend && descriptions.length > 0) {
                        emitLegend(
                            dl,
                            descriptions.map(desc => ({color: colorMap.get(desc), label: desc})),
                            pad,
                            canvasH - pad - descriptions.length * o.legendRowH,
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

                    // No component-level options — inject the drawing functions directly.
                    // Otherwise wrap them so component options act as defaults while
                    // per-call options still take precedence.
                    if (Object.keys(componentOpts).length === 0) {
                        abstraction[key] = boxPack;
                        return;
                    }

                    const wrapped = Object.create(null);

                    for (const name of Object.keys(boxPack)) {
                        wrapped[name] = function (ctx, data, opts) {
                            return boxPack[name](ctx, data, Object.assign({}, componentOpts, opts));
                        };
                    }

                    abstraction[key] = wrapped;
                }
            };
        }
    };

})();