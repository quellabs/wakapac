(function () {
    "use strict";

    /* ──────────────────────────────────────────────────────────────
       Projection
    ────────────────────────────────────────────────────────────── */

    const COS30 = Math.cos(Math.PI / 6);
    const SIN30 = Math.sin(Math.PI / 6);

    function project(x, y, z, s, ox, oy) {
        return {
            x: ox + (x - y) * COS30 * s,
            y: oy + (x + y) * SIN30 * s - z * s
        };
    }

    /* ──────────────────────────────────────────────────────────────
       Color helpers
    ────────────────────────────────────────────────────────────── */

    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7'
    ];

    const _cc = document.createElement('canvas');
    _cc.width = _cc.height = 1;
    const _cx = _cc.getContext('2d');

    function parseColor(c) {
        _cx.clearRect(0, 0, 1, 1);
        _cx.fillStyle = c;
        _cx.fillRect(0, 0, 1, 1);
        const [r, g, b] = _cx.getImageData(0, 0, 1, 1).data;
        return {r, g, b};
    }

    function tint(rgb, f) {
        return `rgb(${Math.min(255, rgb.r * f | 0)},${Math.min(255, rgb.g * f | 0)},${Math.min(255, rgb.b * f | 0)})`;
    }

    function faceColors(base) {
        const rgb = parseColor(base);
        return {
            top: tint(rgb, 1.25),
            left: tint(rgb, 1.0),
            right: tint(rgb, 0.7)
        };
    }

    /* ──────────────────────────────────────────────────────────────
       Shared cuboid renderer
    ────────────────────────────────────────────────────────────── */

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

    /* ──────────────────────────────────────────────────────────────
       Box geometry
    ────────────────────────────────────────────────────────────── */

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

        quad([proj(0, 0, 0), proj(W, 0, 0), proj(W, L, 0), proj(0, L, 0)]);
        quad([proj(0, 0, 0), proj(W, 0, 0), proj(W, 0, D), proj(0, 0, D)]);
        quad([proj(0, 0, 0), proj(0, L, 0), proj(0, L, D), proj(0, 0, D)]);
    }

    function drawBoxRim(dl, W, L, D, proj, stroke, lw) {

        function edge(a, b) {
            dl.beginPath()
                .moveTo(a.x, a.y)
                .lineTo(b.x, b.y)
                .stroke();
        }

        dl.setStrokeStyle(stroke)
            .setLineWidth(lw)
            .setLineCap('round');

        edge(proj(0, 0, 0), proj(0, 0, D));
        edge(proj(W, 0, 0), proj(W, 0, D));
        edge(proj(0, L, 0), proj(0, L, D));
        edge(proj(0, 0, 0), proj(W, 0, 0));
        edge(proj(0, 0, 0), proj(0, L, 0));
        edge(proj(0, 0, D), proj(W, 0, D));
        edge(proj(0, 0, D), proj(0, L, D));
        edge(proj(W, 0, D), proj(W, L, D));
        edge(proj(0, L, D), proj(W, L, D));
    }

    function drawLegend(dl, entries, x, y, font, textColor, swatchSize, rowH) {

        dl.setFont(font)
            .setTextAlign('left')
            .setTextBaseline('middle');

        entries.forEach(({color, label}, i) => {

            const ey = y + i * rowH;

            dl.setFillStyle(color)
                .fillRect(x, ey, swatchSize, swatchSize);

            dl.setStrokeStyle('rgba(0,0,0,0.25)')
                .setLineWidth(1)
                .strokeRect(x, ey, swatchSize, swatchSize);

            dl.setFillStyle(textColor)
                .fillText(label, x + swatchSize + 6, ey + swatchSize / 2);

        });
    }

    /* ──────────────────────────────────────────────────────────────
       Plugin
    ────────────────────────────────────────────────────────────── */

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
                legendColor: options.legendColor ?? '#333',
                showLegend: options.showLegend ?? true,
                legendRowH: options.legendRowH ?? 18,
                swatchSize: options.swatchSize ?? 12
            };

            const boxPack = {

                packedBox(ctx, packingResult, opts = {}) {

                    const o = Object.assign({}, defaults, opts);

                    const {box, items} = packingResult.boxes[o.boxIndex ?? 0];

                    const W = box.inner_width;
                    const L = box.inner_length;
                    const D = box.inner_depth;

                    const dl = new wakaPAC.MetaFile();

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

                    const proj = (x, y, z) => project(x, y, z, s, ox, oy);

                    const desc = [...new Set(items.map(i => i.description))].sort();

                    const colorMap = new Map(
                        desc.map((d, i) => [d, o.colors[i % o.colors.length]])
                    );

                    drawBoxWalls(dl, W, L, D, proj, o.boxWallColor, o.boxEdgeColor, o.boxEdgeWidth);

                    renderIsometricBoxes(
                        items.map(i => ({
                            ...i,
                            color: faceColors(colorMap.get(i.description))
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

                    //drawBoxRim(dl, W, L, D, proj, o.boxEdgeColor, o.boxEdgeWidth);

                    [...items].reverse().forEach(item => {

                        const {x,y,z,width:w,length:l,depth:d} = item;

                        const p000 = proj(x,y,z);
                        const p100 = proj(x+w,y,z);
                        const p010 = proj(x,y+l,z);
                        const p110 = proj(x+w,y+l,z);

                        const p001 = proj(x,y,z+d);
                        const p101 = proj(x+w,y,z+d);
                        const p011 = proj(x,y+l,z+d);
                        const p111 = proj(x+w,y+l,z+d);

                        const data = {
                            description:item.description,
                            weight:item.weight,
                            x:item.x,
                            y:item.y,
                            z:item.z,
                            width:item.width,
                            length:item.length,
                            depth:item.depth
                        };

                        /* +X face */
                        dl.hitArea('polygon',{
                            points:[
                                p101.x,p101.y,
                                p111.x,p111.y,
                                p110.x,p110.y,
                                p100.x,p100.y
                            ],
                            data
                        });

                        /* +Y face */
                        dl.hitArea('polygon',{
                            points:[
                                p011.x,p011.y,
                                p111.x,p111.y,
                                p110.x,p110.y,
                                p010.x,p010.y
                            ],
                            data
                        });

                        /* top */
                        dl.hitArea('polygon',{
                            points:[
                                p001.x,p001.y,
                                p101.x,p101.y,
                                p111.x,p111.y,
                                p011.x,p011.y
                            ],
                            data
                        });

                    });

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

                    abstraction[key] = boxPack;

                }
            };

        }

    };

})();