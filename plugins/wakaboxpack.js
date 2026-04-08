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

    // ─── Projection ───────────────────────────────────────────────────────────
    //
    // Standard 2:1 isometric. Viewer is at low-X, low-Y.
    //   screen_x = (wx - wy) * cos30 * s
    //   screen_y = (wx + wy) * sin30 * s - wz * s

    const COS30 = Math.cos(Math.PI / 6);
    const SIN30 = Math.sin(Math.PI / 6);

    function project(wx, wy, wz, s, ox, oy) {
        return {
            x: ox + (wx - wy) * COS30 * s,
            y: oy + (wx + wy) * SIN30 * s - wz * s,
        };
    }

    // ─── Color utilities ──────────────────────────────────────────────────────

    // Single off-screen pixel canvas reused for all CSS color parsing.
    const _cc = document.createElement('canvas');
    _cc.width = _cc.height = 1;
    const _cx = _cc.getContext('2d');

    function parseColor(color) {
        _cx.clearRect(0, 0, 1, 1);
        _cx.fillStyle = color;
        _cx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _cx.getImageData(0, 0, 1, 1).data;
        return { r, g, b };
    }

    function tint(rgb, f) {
        return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
    }

    // Returns { top, left, right } shaded variants of a base CSS color.
    function faceColors(base) {
        const rgb = parseColor(base);
        return { top: tint(rgb, 1.25), left: tint(rgb, 1.0), right: tint(rgb, 0.7) };
    }

    // ─── Default palette ──────────────────────────────────────────────────────

    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
        '#9c755f', '#bab0ac',
    ];

    // ─── Core drawing ─────────────────────────────────────────────────────────

    function quad(dl, pts, fill, stroke, lw) {
        dl.setFillStyle(fill).setStrokeStyle(stroke).setLineWidth(lw).setLineJoin('round')
            .beginPath()
            .moveTo(pts[0].x, pts[0].y).lineTo(pts[1].x, pts[1].y)
            .lineTo(pts[2].x, pts[2].y).lineTo(pts[3].x, pts[3].y)
            .closePath().fill().stroke();
    }

    /**
     * Draw one cuboid: top face, then left (front-Y) face, then right (front-X) face.
     * Caller guarantees items are sorted back-to-front before calling.
     */
    function drawCuboid(dl, item, s, ox, oy, colors, stroke, lw) {
        const { x, y, z, width: w, length: l, depth: d } = item;
        const p = (px, py, pz) => project(px, py, pz, s, ox, oy);

        const p000 = p(x,   y,   z  );
        const p100 = p(x+w, y,   z  );
        const p010 = p(x,   y+l, z  );
        const p110 = p(x+w, y+l, z  );
        const p001 = p(x,   y,   z+d);
        const p101 = p(x+w, y,   z+d);
        const p011 = p(x,   y+l, z+d);
        const p111 = p(x+w, y+l, z+d);

        quad(dl, [p101, p111, p110, p100], colors.right, stroke, lw); // right (x=x+w, high-X)
        quad(dl, [p011, p111, p110, p010], colors.left,  stroke, lw); // back  (y=y+l, high-Y)
        quad(dl, [p001, p101, p111, p011], colors.top,   stroke, lw); // top   (z=z+d)
    }

    /**
     * Draw floor + front wall (y=0) + left wall (x=0). Viewer is at high-X high-Y so these are the visible interior faces.
     * Must be called before items.
     */
    function drawBoxWalls(dl, W, L, D, s, ox, oy, fill, stroke, lw) {
        const p = (x, y, z) => project(x, y, z, s, ox, oy);

        quad(dl, [p(0,0,0), p(W,0,0), p(W,L,0), p(0,L,0)], fill, stroke, lw); // floor
        quad(dl, [p(0,0,0), p(W,0,0), p(W,0,D), p(0,0,D)], fill, stroke, lw); // front wall (y=0, low-Y)
        quad(dl, [p(0,0,0), p(0,L,0), p(0,L,D), p(0,0,D)], fill, stroke, lw); // left wall  (x=0, low-X)
    }

    /**
     * Draw the three front rim edges of the box (the visible open edges).
     * Must be called after items.
     */
    function drawBoxRim(dl, W, L, D, s, ox, oy, stroke, lw) {
        const p = (x, y, z) => project(x, y, z, s, ox, oy);

        dl.setStrokeStyle(stroke).setLineWidth(lw).setLineCap('round');

        // Front and top rim edges
        const e = (a, b) => dl.beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).stroke();
        e(p(0,0,0), p(0,0,D)); // front-left vertical
        e(p(W,0,0), p(W,0,D)); // front-right vertical
        e(p(0,L,0), p(0,L,D)); // back-left vertical
        e(p(0,0,0), p(W,0,0)); // front-bottom horizontal
        e(p(0,0,0), p(0,L,0)); // left-bottom horizontal
        e(p(0,0,D), p(W,0,D)); // front-top horizontal
        e(p(0,0,D), p(0,L,D)); // left-top horizontal
        e(p(W,0,D), p(W,L,D)); // right-top horizontal (meets back wall)
        e(p(0,L,D), p(W,L,D)); // back-top horizontal  (meets back wall)
    }

    // ─── Sort ─────────────────────────────────────────────────────────────────

    // Viewer is at high-X, high-Y. Items with low x+y are furthest from the
    // viewer and must draw first. Z ascending as tiebreaker ensures floor
    // items draw before items stacked on top of them at the same XY position.
    function sortItems(items) {
        return [...items].sort((a, b) =>
            (a.x + a.y) - (b.x + b.y) || a.z - b.z
        );
    }

    // ─── Legend ───────────────────────────────────────────────────────────────

    function drawLegend(dl, entries, x, y, font, textColor, swatchSize, rowH) {
        dl.setFont(font).setTextAlign('left').setTextBaseline('middle');
        entries.forEach(({ color, label }, i) => {
            const ey = y + i * rowH;
            dl.setFillStyle(color).fillRect(x, ey, swatchSize, swatchSize);
            dl.setStrokeStyle('rgba(0,0,0,0.25)').setLineWidth(1).strokeRect(x, ey, swatchSize, swatchSize);
            dl.setFillStyle(textColor).fillText(label, x + swatchSize + 6, ey + swatchSize / 2);
        });
    }

    // ─── Plugin ───────────────────────────────────────────────────────────────

    window.WakaBoxPack = {

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
                legendColor:  options.legendColor  ?? '#333333',
                showLegend:   options.showLegend   ?? true,
                legendRowH:   options.legendRowH   ?? 18,
                swatchSize:   options.swatchSize   ?? 12,
            };

            const boxPack = {

                /**
                 * Produce a display list for one packed box from a PackingResult.
                 *
                 * Input shape (JSON from ShipmentRouter::pack()):
                 *   { boxes: [ { box: { inner_width, inner_length, inner_depth },
                 *                items: [ { x, y, z, width, length, depth,
                 *                           description, weight } ] } ] }
                 *
                 * opts.boxIndex selects which box to render (default 0).
                 *
                 * Hit payload from metaFileHitTest:
                 *   { description, weight, x, y, z, width, length, depth }
                 */
                packedBox(ctx, packingResult, opts = {}) {
                    const o = Object.assign({}, defaults, opts);

                    if (!packingResult?.boxes?.length) return [];

                    const boxIndex = o.boxIndex ?? 0;
                    if (boxIndex < 0 || boxIndex >= packingResult.boxes.length) return [];

                    const { box, items: rawItems } = packingResult.boxes[boxIndex];
                    const items  = Array.isArray(rawItems) ? rawItems : [];
                    const innerW = box.inner_width;
                    const innerL = box.inner_length;
                    const innerD = box.inner_depth;
                    if (!innerW || !innerL || !innerD) return [];

                    // Assign one stable color per unique description.
                    const descriptions = [...new Set(items.map(i => i.description))].sort();
                    const colorMap     = new Map(
                        descriptions.map((d, i) => [d, o.colors[i % o.colors.length]])
                    );

                    // Canvas layout.
                    const pad     = o.padding;
                    const legendH = o.showLegend && descriptions.length
                        ? descriptions.length * o.legendRowH + pad : 0;
                    const availW  = ctx.canvas.width  - pad * 2;
                    const availH  = ctx.canvas.height - pad * 2 - legendH;

                    const s = Math.min(
                        availW / ((innerW + innerL) * COS30),
                        availH / ((innerW + innerL) * SIN30 + innerD)
                    );
                    if (s <= 0) return [];

                    // Center: compute bounding box of projected box corners.
                    const corners = [[0,0,0],[innerW,0,0],[0,innerL,0],[innerW,innerL,0],
                        [0,0,innerD],[innerW,0,innerD],[0,innerL,innerD],[innerW,innerL,innerD]];
                    const px = corners.map(([x,y,z]) => (x - y) * COS30 * s);
                    const py = corners.map(([x,y,z]) => (x + y) * SIN30 * s - z * s);
                    const ox = pad + (availW - (Math.max(...px) - Math.min(...px))) / 2 - Math.min(...px);
                    const oy = pad + (availH - (Math.max(...py) - Math.min(...py))) / 2 - Math.min(...py);

                    const dl = new wakaPAC.MetaFile();

                    // 1. Walls: floor + front (y=0) + left (x=0) — viewer is at high-X, high-Y.
                    drawBoxWalls(dl, innerW, innerL, innerD, s, ox, oy,
                        o.boxWallColor, o.boxEdgeColor, o.boxEdgeWidth);

                    // 2. Items sorted back-to-front by far corner.
                    for (const item of sortItems(items)) {
                        drawCuboid(dl, item, s, ox, oy,
                            faceColors(colorMap.get(item.description) ?? o.colors[0]),
                            o.outlineColor, o.outlineWidth);
                    }

                    // 3. Front rim edges on top of everything.
                    drawBoxRim(dl, innerW, innerL, innerD, s, ox, oy,
                        o.boxEdgeColor, o.boxEdgeWidth);

                    // 4. Hit areas — top-face bounding rect per item.
                    for (const item of items) {
                        const { x, y, z, width: w, length: l, depth: d } = item;
                        const topPts = [
                            project(x,   y,   z+d, s, ox, oy),
                            project(x+w, y,   z+d, s, ox, oy),
                            project(x+w, y+l, z+d, s, ox, oy),
                            project(x,   y+l, z+d, s, ox, oy),
                        ];
                        const xs = topPts.map(p => p.x), ys = topPts.map(p => p.y);
                        const minX = Math.min(...xs), minY = Math.min(...ys);
                        dl.hitArea('rect', {
                            x: minX, y: minY,
                            w: Math.max(...xs) - minX,
                            h: Math.max(...ys) - minY,
                            data: { description: item.description, weight: item.weight,
                                x: item.x, y: item.y, z: item.z,
                                width: w, length: l, depth: d },
                        });
                    }

                    // 5. Legend.
                    if (o.showLegend && descriptions.length) {
                        drawLegend(dl,
                            descriptions.map(d => ({ color: colorMap.get(d), label: d })),
                            pad,
                            ctx.canvas.height - pad - descriptions.length * o.legendRowH,
                            o.font, o.legendColor, o.swatchSize, o.legendRowH);
                    }

                    return dl.build();
                },
            };

            return {
                onComponentCreated(abstraction, pacId, config) {
                    const key  = config.wakaBoxPack?.property ?? '_pack';
                    const opts = Object.assign({}, config.wakaBoxPack ?? {});
                    delete opts.property;

                    if (!Object.keys(opts).length) {
                        abstraction[key] = boxPack;
                        return;
                    }

                    const wrapped = Object.create(null);
                    for (const name of Object.keys(boxPack)) {
                        wrapped[name] = (ctx, data, o2) =>
                            boxPack[name](ctx, data, Object.assign({}, opts, o2));
                    }
                    abstraction[key] = wrapped;
                }
            };
        }
    };

})();