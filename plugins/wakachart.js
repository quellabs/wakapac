/*
 * ╔═════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                     ║
 * ║  ██╗    ██╗ █████╗ ██╗  ██╗ █████╗  ██████╗██╗  ██╗ █████╗ ██████╗ ████████╗        ║
 * ║  ██║    ██║██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║██╔══██╗██╔══██╗╚══██╔══╝        ║
 * ║  ██║ █╗ ██║███████║█████╔╝ ███████║██║     ███████║███████║██████╔╝   ██║           ║
 * ║  ██║███╗██║██╔══██║██╔═██╗ ██╔══██║██║     ██╔══██║██╔══██║██╔══██╗   ██║           ║
 * ║  ╚███╔███╔╝██║  ██║██║  ██╗██║  ██║╚██████╗██║  ██║██║  ██║██║  ██║   ██║           ║
 * ║   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝           ║
 * ║                                                                                     ║
 * ║  WakaPAC Plugin — WakaChart                                                         ║
 * ║                                                                                     ║
 * ║  Produces display lists (metafiles) for rendering charts onto WakaPAC canvas        ║
 * ║  components. Display lists are executed via wakaPAC.playMetaFile() and              ║
 * ║  hit-tested via wakaPAC.metaFileHitTest().                                          ║
 * ║                                                                                     ║
 * ║  Usage:                                                                             ║
 * ║    wakaPAC.use(WakaChart);                                                          ║
 * ║    wakaPAC.use(WakaChart, { colors: ['#4a9', '#e74'], font: '12px sans-serif' });   ║
 * ║                                                                                     ║
 * ║  In msgProc MSG_PAINT:                                                              ║
 * ║    const dl = this._chart.pieChart(ctx, this.data, opts);                           ║
 * ║    wakaPAC.playMetaFile(ctx, dl);                                                   ║
 * ║                                                                                     ║
 * ║  In msgProc MSG_LCLICK:                                                             ║
 * ║    const pos  = wakaPAC.MAKEPOINTS(event.lParam);                                   ║
 * ║    const hit  = wakaPAC.metaFileHitTest(this._lastDL, pos.x, pos.y);                ║
 * ║                                                                                     ║
 * ╚═════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    /**
     * Normalizes input data to an array of { label, value } objects.
     * Accepts either plain numbers or { label, value } objects.
     * Filters out non-finite and negative values.
     * @param {Array<number|{label:string, value:number}>} data
     * @returns {Array<{label:string, value:number}>}
     */
    function toPoints(data) {
        if (!Array.isArray(data)) {
            return [];
        }

        const result = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];

            if (typeof item === 'number') {
                if (isFinite(item) && item >= 0) {
                    result.push({ label: '', value: item });
                }
            } else if (item && typeof item === 'object') {
                const val = Number(item.value);

                if (isFinite(val) && val >= 0) {
                    result.push({ label: String(item.label ?? ''), value: val });
                }
            }
        }

        return result;
    }

    /**
     * Merges global defaults with per-call options.
     * Per-call options take precedence. Arrays (e.g. colors) are not merged — per-call wins entirely.
     * @param {Object} defaults
     * @param {Object} opts
     * @returns {Object}
     */
    function mergeOpts(defaults, opts) {
        return Object.assign({}, defaults, opts);
    }

    /**
     * Default color palette — distinct, accessible colors.
     * @type {string[]}
     */
    const DEFAULT_COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
        '#9c755f', '#bab0ac'
    ];

    window.WakaChart = {

        createPacPlugin(pac, options = {}) {
            /**
             * Global defaults — merged with per-call options at draw time.
             * Per-call options always take precedence.
             */
            const defaults = {
                colors:          options.colors      ?? DEFAULT_COLORS,
                font:            options.font        ?? '12px sans-serif',
                labelColor:      options.labelColor  ?? '#ffffff',
                legendColor:     options.legendColor ?? '#333333',
                legendFont:      options.legendFont  ?? '12px sans-serif',
                padding:         options.padding     ?? 16,
                gap:             options.gap         ?? 2,     // px gap between slices
                showLabels:      options.showLabels  ?? true,  // percentage labels inside slices
                showLegend:      options.showLegend  ?? true,
                legendPosition:  options.legendPosition ?? 'bottom', // 'bottom' | 'right'
                minSliceAngle:   options.minSliceAngle  ?? 0.15       // radians — slices smaller than this skip labels
            };

            const charts = {
                /**
                 * Produces a display list for a pie chart.
                 *
                 * The display list is designed to fill the full canvas dimensions
                 * of the context it will be played on. Pass offsetX/offsetY to
                 * wakaPAC.playMetaFile() to position it within a larger canvas.
                 *
                 * Each slice emits a hitArea entry with:
                 *   { index, label, value, percent }
                 *
                 * @param {CanvasRenderingContext2D} ctx - Context used only to measure text; no drawing occurs
                 * @param {Array<number|{label:string,value:number}>} data
                 * @param {Object} [opts] - Per-call overrides for any global default
                 * @returns {Array<Object>} Display list
                 */
                pieChart: (ctx, data, opts = {}) => {
                    const o      = mergeOpts(defaults, opts);
                    const points = toPoints(data);
                    const dl     = [];

                    if (points.length === 0) {
                        return dl;
                    }

                    const total = points.reduce((s, p) => s + p.value, 0);

                    if (total === 0) {
                        return dl;
                    }

                    const colors   = o.colors;
                    const pad      = o.padding;
                    const w        = ctx.canvas.width;
                    const h        = ctx.canvas.height;

                    // ── Legend dimensions ─────────────────────────────────────────
                    const swatchSize  = 12;
                    const swatchGap   = 6;
                    const legendItemH = swatchSize + 4;
                    const legendFont  = o.legendFont;

                    let legendW = 0;
                    let legendH = 0;

                    if (o.showLegend) {
                        // Measure legend to reserve space
                        ctx.save();
                        ctx.font = legendFont;

                        if (o.legendPosition === 'right') {
                            for (let i = 0; i < points.length; i++) {
                                const tw = ctx.measureText(points[i].label || `Series ${i + 1}`).width;
                                legendW = Math.max(legendW, swatchSize + swatchGap + tw);
                            }

                            legendW   += pad;
                            legendH    = 0;
                        } else {
                            // bottom
                            for (let i = 0; i < points.length; i++) {
                                const tw = ctx.measureText(points[i].label || `Series ${i + 1}`).width;
                                legendW  = Math.max(legendW, swatchSize + swatchGap + tw);
                            }

                            legendH = (points.length * legendItemH) + pad;
                        }

                        ctx.restore();
                    }

                    // ── Chart area ────────────────────────────────────────────────
                    const chartW = o.legendPosition === 'right' ? w - pad * 2 - legendW : w - pad * 2;
                    const chartH = o.legendPosition === 'bottom' ? h - pad * 2 - legendH : h - pad * 2;
                    const cx     = pad + chartW / 2;
                    const cy     = pad + chartH / 2;
                    const r      = Math.max(0, Math.min(chartW, chartH) / 2);

                    // ── Slices ────────────────────────────────────────────────────
                    let startAngle = -Math.PI / 2; // start at 12 o'clock

                    for (let i = 0; i < points.length; i++) {
                        const point      = points[i];
                        const fraction   = point.value / total;
                        const sliceAngle = fraction * Math.PI * 2;
                        const endAngle   = startAngle + sliceAngle;
                        const color      = colors[i % colors.length];
                        const midAngle   = startAngle + sliceAngle / 2;

                        dl.push({ op: 'setFillStyle', value: color });
                        dl.push({ op: 'beginPath' });
                        dl.push({ op: 'moveTo',       x: cx, y: cy });
                        dl.push({ op: 'arc',          cx, cy, r, startAngle, endAngle, ccw: false });
                        dl.push({ op: 'closePath' });
                        dl.push({ op: 'fill' });

                        // Draw a stroke in the background color to create a visual gap
                        // between slices. This avoids the centre-point divergence that
                        // angular insets produce.
                        if (o.gap > 0) {
                            dl.push({ op: 'setStrokeStyle', value: o.background ?? '#ffffff' });
                            dl.push({ op: 'setLineWidth',   value: o.gap });
                            dl.push({ op: 'stroke' });
                        }

                        // Hit area uses the full unmodified angles so the entire
                        // slice — including the gap region — is hittable
                        dl.push({
                            op:     'hitArea',
                            shape:  'sector',
                            cx,
                            cy,
                            r,
                            innerR: 0,
                            startAngle,
                            endAngle,
                            data: {
                                index:   i,
                                label:   point.label,
                                value:   point.value,
                                percent: Math.round(fraction * 1000) / 10
                            }
                        });

                        // Percentage label inside slice
                        if (o.showLabels && sliceAngle >= o.minSliceAngle) {
                            const labelR  = r * 0.65;
                            const labelX  = cx + Math.cos(midAngle) * labelR;
                            const labelY  = cy + Math.sin(midAngle) * labelR;
                            const pct     = Math.round(fraction * 1000) / 10;
                            const pctText = pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;

                            dl.push({ op: 'setFillStyle',    value: o.labelColor });
                            dl.push({ op: 'setFont',         value: o.font });
                            dl.push({ op: 'setTextAlign',    value: 'center' });
                            dl.push({ op: 'setTextBaseline', value: 'middle' });
                            dl.push({ op: 'fillText',        text: pctText, x: labelX, y: labelY });
                        }

                        startAngle = endAngle;
                    }

                    // ── Legend ────────────────────────────────────────────────────
                    if (o.showLegend) {
                        let lx, ly;

                        if (o.legendPosition === 'right') {
                            lx = pad + chartW + pad;
                            ly = pad + (chartH - points.length * legendItemH) / 2;
                        } else {
                            lx = (w - legendW) / 2;
                            ly = pad + chartH + pad;
                        }

                        dl.push({ op: 'setFont',        value: legendFont });
                        dl.push({ op: 'setTextAlign',   value: 'left' });
                        dl.push({ op: 'setTextBaseline', value: 'middle' });

                        for (let i = 0; i < points.length; i++) {
                            const color  = colors[i % colors.length];
                            const label  = points[i].label || `Series ${i + 1}`;
                            const itemY  = ly + i * legendItemH + swatchSize / 2;

                            dl.push({ op: 'setFillStyle', value: color });
                            dl.push({ op: 'fillRect',     x: lx, y: itemY - swatchSize / 2, w: swatchSize, h: swatchSize });
                            dl.push({ op: 'setFillStyle', value: o.legendColor });
                            dl.push({ op: 'fillText',     text: label, x: lx + swatchSize + swatchGap, y: itemY });
                        }
                    }

                    return dl;
                },

                /**
                 * Produces a display list for a vertical bar chart.
                 *
                 * Each bar emits a hitArea entry with:
                 *   { index, label, value }
                 *
                 * @param {CanvasRenderingContext2D} ctx - Context used only to measure text; no drawing occurs
                 * @param {Array<number|{label:string,value:number}>} data
                 * @param {Object} [opts] - Per-call overrides for any global default
                 * @returns {Array<Object>} Display list
                 */
                barChart: (ctx, data, opts = {}) => {
                    const o      = mergeOpts(defaults, opts);
                    const points = toPoints(data);
                    const dl     = [];

                    if (points.length === 0) {
                        return dl;
                    }

                    const colors = o.colors;
                    const pad    = o.padding;
                    const w      = ctx.canvas.width;
                    const h      = ctx.canvas.height;
                    const maxVal = Math.max(...points.map(p => p.value));
                    const total  = points.reduce((s, p) => s + p.value, 0);

                    if (maxVal === 0) {
                        return dl;
                    }

                    // ── Axis and label metrics ─────────────────────────────────────
                    ctx.save();
                    ctx.font = o.font;

                    // Measure the widest Y-axis label to reserve left margin
                    const tickCount = o.tickCount ?? 5;
                    const tickStep  = maxVal / tickCount;
                    let   yLabelW   = 0;

                    for (let t = 0; t <= tickCount; t++) {
                        const label = String(Math.round(tickStep * t));
                        yLabelW = Math.max(yLabelW, ctx.measureText(label).width);
                    }

                    ctx.restore();

                    // ── Chart area ────────────────────────────────────────────────
                    const xLabelH = 20;  // height reserved for X-axis labels
                    const valueLH = 16;  // height reserved for value labels above bars
                    const axisGap = 6;   // gap between axis labels and chart area

                    const chartX = pad + yLabelW + axisGap;
                    const chartY = pad + valueLH;
                    const chartW = w - chartX - pad;
                    const chartH = h - chartY - xLabelH - axisGap - pad;

                    if (chartW <= 0 || chartH <= 0) {
                        return dl;
                    }

                    const barGap  = o.barGap ?? 0.25; // fraction of slot used as gap
                    const slotW   = chartW / points.length;
                    const barW    = slotW * (1 - barGap);
                    const barOffX = slotW * barGap / 2;

                    // ── Grid lines and Y-axis labels ──────────────────────────────
                    const axisColor = o.axisColor ?? '#cccccc';
                    const gridColor = o.gridColor ?? '#eeeeee';

                    dl.push({ op: 'setFont',         value: o.font });
                    dl.push({ op: 'setTextAlign',    value: 'right' });
                    dl.push({ op: 'setTextBaseline', value: 'middle' });

                    for (let t = 0; t <= tickCount; t++) {
                        const tickVal = tickStep * t;
                        const tickY   = chartY + chartH - (tickVal / maxVal) * chartH;
                        const label   = String(Math.round(tickVal));

                        // Y-axis label
                        dl.push({ op: 'setFillStyle', value: o.legendColor ?? '#333333' });
                        dl.push({ op: 'fillText',     text: label, x: chartX - axisGap, y: tickY });

                        // Horizontal grid line (skip baseline — drawn separately)
                        if (t > 0) {
                            dl.push({ op: 'setStrokeStyle', value: gridColor });
                            dl.push({ op: 'setLineWidth',   value: 1 });
                            dl.push({ op: 'beginPath' });
                            dl.push({ op: 'moveTo', x: chartX,          y: tickY });
                            dl.push({ op: 'lineTo', x: chartX + chartW, y: tickY });
                            dl.push({ op: 'stroke' });
                        }
                    }

                    // ── Baseline ──────────────────────────────────────────────────
                    const baseY = chartY + chartH;

                    dl.push({ op: 'setStrokeStyle', value: axisColor });
                    dl.push({ op: 'setLineWidth',   value: 1 });
                    dl.push({ op: 'beginPath' });
                    dl.push({ op: 'moveTo', x: chartX,          y: baseY });
                    dl.push({ op: 'lineTo', x: chartX + chartW, y: baseY });
                    dl.push({ op: 'stroke' });

                    // ── Bars ──────────────────────────────────────────────────────
                    for (let i = 0; i < points.length; i++) {
                        const point = points[i];
                        const color = colors[i % colors.length];
                        const barH  = (point.value / maxVal) * chartH;
                        const bx    = chartX + i * slotW + barOffX;
                        const by    = baseY - barH;

                        // Bar fill
                        dl.push({ op: 'setFillStyle', value: color });
                        dl.push({ op: 'fillRect',     x: bx, y: by, w: barW, h: barH });

                        // Hit area
                        dl.push({
                            op:    'hitArea',
                            shape: 'rect',
                            x:     bx,
                            y:     by,
                            w:     barW,
                            h:     barH,
                            data: {
                                index:   i,
                                label:   point.label,
                                value:   point.value,
                                percent: Math.round((point.value / total) * 1000) / 10
                            }
                        });

                        // Value label above bar
                        dl.push({ op: 'setFillStyle',    value: o.legendColor ?? '#333333' });
                        dl.push({ op: 'setFont',         value: o.font });
                        dl.push({ op: 'setTextAlign',    value: 'center' });
                        dl.push({ op: 'setTextBaseline', value: 'bottom' });
                        dl.push({ op: 'fillText',        text: String(point.value), x: bx + barW / 2, y: by - 2 });

                        // X-axis label
                        if (point.label) {
                            dl.push({ op: 'setFillStyle',    value: o.legendColor ?? '#333333' });
                            dl.push({ op: 'setFont',         value: o.font });
                            dl.push({ op: 'setTextAlign',    value: 'center' });
                            dl.push({ op: 'setTextBaseline', value: 'top' });
                            dl.push({ op: 'fillText',        text: point.label, x: bx + barW / 2, y: baseY + axisGap });
                        }
                    }

                    return dl;
                },

                /**
                 * Produces a display list for a line chart.
                 *
                 * Each data point emits a hitArea entry with:
                 *   { index, label, value, percent }
                 *
                 * Line style is controlled by opts.smooth:
                 *   false (default) — straight lines between points
                 *   true            — smooth cubic bezier curve
                 *
                 * @param {CanvasRenderingContext2D} ctx - Context used only to measure text; no drawing occurs
                 * @param {Array<number|{label:string,value:number}>} data
                 * @param {Object} [opts] - Per-call overrides for any global default
                 * @returns {Array<Object>} Display list
                 */
                lineChart: (ctx, data, opts = {}) => {
                    const o      = mergeOpts(defaults, opts);
                    const points = toPoints(data);
                    const dl     = [];

                    if (points.length === 0) {
                        return dl;
                    }

                    const pad    = o.padding;
                    const w      = ctx.canvas.width;
                    const h      = ctx.canvas.height;
                    const maxVal = Math.max(...points.map(p => p.value));
                    const total  = points.reduce((s, p) => s + p.value, 0);

                    if (maxVal === 0) {
                        return dl;
                    }

                    // ── Axis and label metrics ─────────────────────────────────────
                    ctx.save();
                    ctx.font = o.font;

                    const tickCount = o.tickCount ?? 5;
                    const tickStep  = maxVal / tickCount;
                    let   yLabelW   = 0;

                    for (let t = 0; t <= tickCount; t++) {
                        const label = String(Math.round(tickStep * t));
                        yLabelW = Math.max(yLabelW, ctx.measureText(label).width);
                    }

                    ctx.restore();

                    // ── Chart area ────────────────────────────────────────────────
                    const xLabelH = 20;
                    const axisGap = 6;

                    const chartX = pad + yLabelW + axisGap;
                    const chartY = pad;
                    const chartW = w - chartX - pad;
                    const chartH = h - chartY - xLabelH - axisGap - pad;

                    if (chartW <= 0 || chartH <= 0) {
                        return dl;
                    }

                    const axisColor  = o.axisColor  ?? '#cccccc';
                    const gridColor  = o.gridColor  ?? '#eeeeee';
                    const lineColor  = o.lineColor  ?? o.colors[0];
                    const lineWidth  = o.lineWidth  ?? 2;
                    const pointR     = o.pointRadius ?? 4;
                    const smooth     = o.smooth     ?? false;

                    // ── Grid lines and Y-axis labels ──────────────────────────────
                    dl.push({ op: 'setFont',         value: o.font });
                    dl.push({ op: 'setTextAlign',    value: 'right' });
                    dl.push({ op: 'setTextBaseline', value: 'middle' });

                    for (let t = 0; t <= tickCount; t++) {
                        const tickVal = tickStep * t;
                        const tickY   = chartY + chartH - (tickVal / maxVal) * chartH;
                        const label   = String(Math.round(tickVal));

                        dl.push({ op: 'setFillStyle', value: o.legendColor ?? '#333333' });
                        dl.push({ op: 'fillText',     text: label, x: chartX - axisGap, y: tickY });

                        if (t > 0) {
                            dl.push({ op: 'setStrokeStyle', value: gridColor });
                            dl.push({ op: 'setLineWidth',   value: 1 });
                            dl.push({ op: 'beginPath' });
                            dl.push({ op: 'moveTo', x: chartX,          y: tickY });
                            dl.push({ op: 'lineTo', x: chartX + chartW, y: tickY });
                            dl.push({ op: 'stroke' });
                        }
                    }

                    // ── Baseline ──────────────────────────────────────────────────
                    const baseY = chartY + chartH;

                    dl.push({ op: 'setStrokeStyle', value: axisColor });
                    dl.push({ op: 'setLineWidth',   value: 1 });
                    dl.push({ op: 'beginPath' });
                    dl.push({ op: 'moveTo', x: chartX,          y: baseY });
                    dl.push({ op: 'lineTo', x: chartX + chartW, y: baseY });
                    dl.push({ op: 'stroke' });

                    // ── Precompute point coordinates ──────────────────────────────
                    const slotW = chartW / (points.length - 1 || 1);
                    const coords = points.map((p, i) => ({
                        x: chartX + i * slotW,
                        y: baseY - (p.value / maxVal) * chartH
                    }));

                    // ── Line ──────────────────────────────────────────────────────
                    dl.push({ op: 'setStrokeStyle', value: lineColor });
                    dl.push({ op: 'setLineWidth',   value: lineWidth });
                    dl.push({ op: 'setLineCap',     value: 'round' });
                    dl.push({ op: 'setLineJoin',    value: 'round' });
                    dl.push({ op: 'beginPath' });
                    dl.push({ op: 'moveTo', x: coords[0].x, y: coords[0].y });

                    if (smooth && coords.length > 1) {
                        // Cubic bezier smooth curve — control points at 1/3 of the
                        // horizontal distance between adjacent points
                        for (let i = 1; i < coords.length; i++) {
                            const prev = coords[i - 1];
                            const curr = coords[i];
                            const cpX  = (curr.x - prev.x) / 3;

                            dl.push({
                                op:   'bezierCurveTo',
                                cp1x: prev.x + cpX,
                                cp1y: prev.y,
                                cp2x: curr.x - cpX,
                                cp2y: curr.y,
                                x:    curr.x,
                                y:    curr.y
                            });
                        }
                    } else {
                        for (let i = 1; i < coords.length; i++) {
                            dl.push({ op: 'lineTo', x: coords[i].x, y: coords[i].y });
                        }
                    }

                    dl.push({ op: 'stroke' });

                    // ── Data point markers and hit areas ──────────────────────────
                    for (let i = 0; i < points.length; i++) {
                        const point = points[i];
                        const cx    = coords[i].x;
                        const cy    = coords[i].y;

                        // Dot
                        dl.push({ op: 'setFillStyle', value: lineColor });
                        dl.push({ op: 'beginPath' });
                        dl.push({ op: 'arc', cx, cy, r: pointR, startAngle: 0, endAngle: Math.PI * 2 });
                        dl.push({ op: 'fill' });

                        // White centre for a ring effect
                        dl.push({ op: 'setFillStyle', value: o.background ?? '#ffffff' });
                        dl.push({ op: 'beginPath' });
                        dl.push({ op: 'arc', cx, cy, r: pointR / 2, startAngle: 0, endAngle: Math.PI * 2 });
                        dl.push({ op: 'fill' });

                        // Hit area — slightly larger than the visible dot for easier clicking
                        dl.push({
                            op:    'hitArea',
                            shape: 'sector',
                            cx,
                            cy,
                            r:     pointR * 2,
                            innerR: 0,
                            startAngle: 0,
                            endAngle:   Math.PI * 2,
                            data: {
                                index:   i,
                                label:   point.label,
                                value:   point.value,
                                percent: Math.round((point.value / total) * 1000) / 10
                            }
                        });

                        // X-axis label
                        if (point.label) {
                            dl.push({ op: 'setFillStyle',    value: o.legendColor ?? '#333333' });
                            dl.push({ op: 'setFont',         value: o.font });
                            dl.push({ op: 'setTextAlign',    value: 'center' });
                            dl.push({ op: 'setTextBaseline', value: 'top' });
                            dl.push({ op: 'fillText',        text: point.label, x: cx, y: baseY + axisGap });
                        }
                    }

                    return dl;
                },

                /**
                 * Produces a display list for a sparkline — a minimal inline line chart
                 * with no axes, labels, or legend. Designed to convey the shape of data
                 * at a glance. No hit areas are emitted.
                 *
                 * @param {CanvasRenderingContext2D} ctx - Context used only for canvas dimensions
                 * @param {Array<number|{label:string,value:number}>} data
                 * @param {Object} [opts] - Per-call overrides for any global default
                 * @returns {Array<Object>} Display list
                 */
                sparkline: (ctx, data, opts = {}) => {
                    const o      = mergeOpts(defaults, opts);
                    const points = toPoints(data);
                    const dl     = [];

                    if (points.length < 2) {
                        return dl;
                    }

                    const maxVal = Math.max(...points.map(p => p.value));
                    const minVal = Math.min(...points.map(p => p.value));
                    const range  = maxVal - minVal || 1; // avoid division by zero for flat data

                    const pad    = o.padding;
                    const w      = ctx.canvas.width;
                    const h      = ctx.canvas.height;
                    const chartX = pad;
                    const chartY = pad;
                    const chartW = w - pad * 2;
                    const chartH = h - pad * 2;

                    if (chartW <= 0 || chartH <= 0) {
                        return dl;
                    }

                    const lineColor = o.lineColor  ?? o.colors[0];
                    const lineWidth = o.lineWidth  ?? 2;
                    const smooth    = o.smooth     ?? false;
                    const slotW     = chartW / (points.length - 1);

                    // Precompute coordinates — Y is inverted so higher values sit higher
                    const coords = points.map((p, i) => ({
                        x: chartX + i * slotW,
                        y: chartY + chartH - ((p.value - minVal) / range) * chartH
                    }));

                    // ── Line ──────────────────────────────────────────────────────
                    dl.push({ op: 'setStrokeStyle', value: lineColor });
                    dl.push({ op: 'setLineWidth',   value: lineWidth });
                    dl.push({ op: 'setLineCap',     value: 'round' });
                    dl.push({ op: 'setLineJoin',    value: 'round' });
                    dl.push({ op: 'beginPath' });
                    dl.push({ op: 'moveTo', x: coords[0].x, y: coords[0].y });

                    if (smooth) {
                        for (let i = 1; i < coords.length; i++) {
                            const prev = coords[i - 1];
                            const curr = coords[i];
                            const cpX  = (curr.x - prev.x) / 3;

                            dl.push({
                                op:   'bezierCurveTo',
                                cp1x: prev.x + cpX,
                                cp1y: prev.y,
                                cp2x: curr.x - cpX,
                                cp2y: curr.y,
                                x:    curr.x,
                                y:    curr.y
                            });
                        }
                    } else {
                        for (let i = 1; i < coords.length; i++) {
                            dl.push({ op: 'lineTo', x: coords[i].x, y: coords[i].y });
                        }
                    }

                    dl.push({ op: 'stroke' });

                    // ── End point marker — highlights the last value ───────────────
                    if (o.showEndPoint ?? true) {
                        const last  = coords[coords.length - 1];
                        const dotR  = o.pointRadius ?? 3;

                        dl.push({ op: 'setFillStyle', value: lineColor });
                        dl.push({ op: 'beginPath' });
                        dl.push({ op: 'arc', cx: last.x, cy: last.y, r: dotR, startAngle: 0, endAngle: Math.PI * 2 });
                        dl.push({ op: 'fill' });
                    }

                    return dl;
                }
            };

            return {
                onComponentCreated(abstraction, pacId, config) {
                    const key = config.wakaChart?.property ?? '_chart';
                    const wakaChart = config.wakaChart ?? {};

                    // Extract per-component chart options from config.wakaChart,
                    // excluding the reserved 'property' key which is consumed here.
                    const componentOpts = Object.assign({}, wakaChart);
                    delete componentOpts.property;

                    // If no component-level options were provided, inject charts directly
                    if (Object.keys(componentOpts).length === 0) {
                        abstraction[key] = charts;
                        return;
                    }

                    // Otherwise wrap each function so component options are merged as
                    // defaults — per-call options still take precedence.
                    const wrapped = Object.create(null);

                    for (const name of Object.keys(charts)) {
                        wrapped[name] = function (ctx, data, opts) {
                            return charts[name](ctx, data, Object.assign({}, componentOpts, opts));
                        };
                    }

                    abstraction[key] = wrapped;
                }
            };
        }
    };

})();