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
        return {r, g, b};
    }

    function tint(rgb, f) {
        return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
    }

    // Returns { top, left, right } shaded variants of a base CSS color.
    function faceColors(base) {
        const rgb = parseColor(base);
        return {top: tint(rgb, 1.25), left: tint(rgb, 1.0), right: tint(rgb, 0.7)};
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
     * Draw floor + front wall (y=0) + left wall (x=0). Viewer is at high-X high-Y so these are the visible interior faces.
     * Must be called before items.
     */
    function drawBoxWalls(dl, W, L, D, s, ox, oy, fill, stroke, lw) {
        const p = (x, y, z) => project(x, y, z, s, ox, oy);

        quad(dl, [p(0, 0, 0), p(W, 0, 0), p(W, L, 0), p(0, L, 0)], fill, stroke, lw); // floor
        quad(dl, [p(0, 0, 0), p(W, 0, 0), p(W, 0, D), p(0, 0, D)], fill, stroke, lw); // front wall (y=0, low-Y)
        quad(dl, [p(0, 0, 0), p(0, L, 0), p(0, L, D), p(0, 0, D)], fill, stroke, lw); // left wall  (x=0, low-X)
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
        e(p(0, 0, 0), p(0, 0, D)); // front-left vertical
        e(p(W, 0, 0), p(W, 0, D)); // front-right vertical
        e(p(0, L, 0), p(0, L, D)); // back-left vertical
        e(p(0, 0, 0), p(W, 0, 0)); // front-bottom horizontal
        e(p(0, 0, 0), p(0, L, 0)); // left-bottom horizontal
        e(p(0, 0, D), p(W, 0, D)); // front-top horizontal
        e(p(0, 0, D), p(0, L, D)); // left-top horizontal
        e(p(W, 0, D), p(W, L, D)); // right-top horizontal (meets back wall)
        e(p(0, L, D), p(W, L, D)); // back-top horizontal  (meets back wall)
    }

    // ─── Legend ───────────────────────────────────────────────────────────────

    function drawLegend(dl, entries, x, y, font, textColor, swatchSize, rowH) {
        dl.setFont(font).setTextAlign('left').setTextBaseline('middle');
        entries.forEach(({color, label}, i) => {
            const ey = y + i * rowH;
            dl.setFillStyle(color).fillRect(x, ey, swatchSize, swatchSize);
            dl.setStrokeStyle('rgba(0,0,0,0.25)').setLineWidth(1).strokeRect(x, ey, swatchSize, swatchSize);
            dl.setFillStyle(textColor).fillText(label, x + swatchSize + 6, ey + swatchSize / 2);
        });
    }

    function renderIsometricBoxes(items, project, emitQuad) {

        const sorted = [...items].sort((a, b) =>
            (a.z + a.depth) - (b.z + b.depth) ||
            (a.y + a.length) - (b.y + b.length) ||
            (a.x + a.width) - (b.x + b.width)
        );

        sorted.forEach(item => {

            const {x, y, z, width: w, length: l, depth: d, color} = item;

            const p000 = project(x, y, z);
            const p100 = project(x + w, y, z);
            const p010 = project(x, y + l, z);
            const p110 = project(x + w, y + l, z);

            const p001 = project(x, y, z + d);
            const p101 = project(x + w, y, z + d);
            const p011 = project(x, y + l, z + d);
            const p111 = project(x + w, y + l, z + d);

            emitQuad([p101, p111, p110, p100], color.right);
            emitQuad([p011, p111, p110, p010], color.left);
            emitQuad([p001, p101, p111, p011], color.top);

        });

    }

    // ─── Plugin ───────────────────────────────────────────────────────────────

    window.WakaBoxPack = {

        createPacPlugin(pac, options = {}) {

            const defaults = {
                colors: options.colors ?? DEFAULT_COLORS,
                outlineColor: options.outlineColor ?? '#1a1a2e',
                outlineWidth: options.outlineWidth ?? 1.5,
                boxWallColor: options.boxWallColor ?? 'rgba(200,205,220,0.5)',
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

                    const {box, items} = packingResult.boxes[o.boxIndex ?? 0];

                    const W = box.inner_width;
                    const L = box.inner_length;
                    const D = box.inner_depth;

                    const dl = new wakaPAC.MetaFile();

                    /* layout */

                    const pad = o.padding;

                    const availW = ctx.canvas.width - pad * 2;
                    const availH = ctx.canvas.height - pad * 2;

                    const s = Math.min(
                        availW / ((W + L) * COS30),
                        availH / ((W + L) * SIN30 + D)
                    );

                    const corners = [[0, 0, 0], [W, 0, 0], [0, L, 0], [W, L, 0], [0, 0, D], [W, 0, D], [0, L, D], [W, L, D]];

                    const px = corners.map(([x, y, z]) => (x - y) * COS30 * s);
                    const py = corners.map(([x, y, z]) => (x + y) * SIN30 * s - z * s);

                    const ox = pad + (availW - (Math.max(...px) - Math.min(...px))) / 2 - Math.min(...px);
                    const oy = pad + (availH - (Math.max(...py) - Math.min(...py))) / 2 - Math.min(...py);

                    /* color mapping */

                    const desc = [...new Set(items.map(i => i.description))].sort();

                    const colorMap = new Map(
                        desc.map((d, i) => [d, o.colors[i % o.colors.length]])
                    );

                    o.colorMap = colorMap;

                    /* box walls */

                    drawBoxWalls(dl, W, L, D, s, ox, oy,
                        o.boxWallColor,
                        o.boxEdgeColor,
                        o.boxEdgeWidth
                    );

                    /* items */
                    renderIsometricBoxes(
                        items.map(i => ({
                            ...i,
                            color: faceColors(o.colorMap.get(i.description))
                        })),

                        (x, y, z) => project(x, y, z, s, ox, oy),

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

                    /* front rim */

                    drawBoxRim(dl, W, L, D, s, ox, oy,
                        o.boxEdgeColor,
                        o.boxEdgeWidth
                    );

                    /* hit areas */

                    items.forEach(item => {
                        const {x, y, z, width: w, length: l, depth: d} = item;

                        const pts = [
                            project(x, y, z + d, s, ox, oy),
                            project(x + w, y, z + d, s, ox, oy),
                            project(x + w, y + l, z + d, s, ox, oy),
                            project(x, y + l, z + d, s, ox, oy)
                        ];

                        const xs = pts.map(p => p.x);
                        const ys = pts.map(p => p.y);

                        const minX = Math.min(...xs);
                        const minY = Math.min(...ys);

                        dl.hitArea('rect', {
                            x: minX,
                            y: minY,
                            w: Math.max(...xs) - minX,
                            h: Math.max(...ys) - minY,
                            data: item
                        });
                    });

                    /* legend */

                    if (o.showLegend && desc.length) {
                        drawLegend(
                            dl,
                            desc.map(d => ({color: colorMap.get(d), label: d})),
                            pad,
                            ctx.canvas.height - pad - desc.length * o.legendRowH,
                            o.font,
                            o.legendColor,
                            o.swatchSize,
                            o.legendRowH
                        );
                    }

                    return dl.build();
                }
            };

            return {
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.wakaBoxPack?.property ?? '_pack';
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