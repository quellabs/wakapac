/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║   ██████╗██╗  ██╗ █████╗ ██████╗ ████████╗██╗   ██╗████████╗██╗██╗     ███████╗      ║
 * ║  ██╔════╝██║  ██║██╔══██╗██╔══██╗╚══██╔══╝██║   ██║╚══██╔══╝██║██║     ██╔════╝      ║
 * ║  ██║     ███████║███████║██████╔╝   ██║   ██║   ██║   ██║   ██║██║     ███████╗      ║
 * ║  ██║     ██╔══██║██╔══██║██╔══██╗   ██║   ██║   ██║   ██║   ██║██║     ╚════██║      ║
 * ║  ╚██████╗██║  ██║██║  ██║██║  ██║   ██║   ╚██████╔╝   ██║   ██║███████╗███████║      ║
 * ║   ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝      ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — ChartUtils                                                           ║
 * ║                                                                                      ║
 * ║  Produces display lists (metafiles) for rendering charts onto WakaPAC canvas         ║
 * ║  components. Display lists are executed via wakaPAC.playMetaFile() and               ║
 * ║  hit-tested via wakaPAC.metaFileHitTest().                                           ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(ChartUtils);                                                          ║
 * ║    wakaPAC.use(ChartUtils, { colors: ['#4a9', '#e74'], font: '12px sans-serif' });   ║
 * ║                                                                                      ║
 * ║  In msgProc MSG_PAINT:                                                               ║
 * ║    const dl = this._chart.pieChart(data, opts);                                      ║
 * ║    wakaPAC.playMetaFile(ctx, dl);                                                    ║
 * ║                                                                                      ║
 * ║  In msgProc MSG_LCLICK:                                                              ║
 * ║    const pos  = wakaPAC.MAKEPOINTS(event.lParam);                                    ║
 * ║    const hit  = wakaPAC.metaFileHitTest(this._lastDL, pos.x, pos.y);                 ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    /**
     * Normalises input data to an array of { label, value } objects.
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
                    result.push({label: '', value: item});
                }
            } else if (item && typeof item === 'object') {
                const val = Number(item.value);

                if (isFinite(val) && val >= 0) {
                    result.push({label: String(item.label ?? ''), value: val});
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

    window.ChartUtils = {

        createPacPlugin(pac, options = {}) {
            /**
             * Global defaults — merged with per-call options at draw time.
             * Per-call options always take precedence.
             */
            const defaults = {
                colors: options.colors ?? DEFAULT_COLORS,
                font: options.font ?? '12px sans-serif',
                labelColor: options.labelColor ?? '#ffffff',
                legendColor: options.legendColor ?? '#333333',
                legendFont: options.legendFont ?? '12px sans-serif',
                padding: options.padding ?? 16,
                gap: options.gap ?? 2,     // px gap between slices
                showLabels: options.showLabels ?? true,  // percentage labels inside slices
                showLegend: options.showLegend ?? true,
                legendPosition: options.legendPosition ?? 'bottom', // 'bottom' | 'right'
                minSliceAngle: options.minSliceAngle ?? 0.15       // radians — slices smaller than this skip labels
            };

            return {
                /** Unit namespace — accessible in binds as ChartUtils.fn() */
                name: 'ChartUtils',

                functions: {
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
                        const o = mergeOpts(defaults, opts);
                        const points = toPoints(data);
                        const dl = [];

                        if (points.length === 0) {
                            return dl;
                        }

                        const total = points.reduce((s, p) => s + p.value, 0);

                        if (total === 0) {
                            return dl;
                        }

                        const colors = o.colors;
                        const pad = o.padding;
                        const w = ctx.canvas.width;
                        const h = ctx.canvas.height;

                        // ── Legend dimensions ─────────────────────────────────────────
                        const swatchSize = 12;
                        const swatchGap = 6;
                        const legendItemH = swatchSize + 4;
                        const legendFont = o.legendFont;

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

                                legendW += pad;
                                legendH = 0;
                            } else {
                                // bottom
                                for (let i = 0; i < points.length; i++) {
                                    const tw = ctx.measureText(points[i].label || `Series ${i + 1}`).width;
                                    legendW = Math.max(legendW, swatchSize + swatchGap + tw);
                                }

                                legendH = (points.length * legendItemH) + pad;
                            }

                            ctx.restore();
                        }

                        // ── Chart area ────────────────────────────────────────────────
                        const chartW = o.legendPosition === 'right' ? w - pad * 2 - legendW : w - pad * 2;
                        const chartH = o.legendPosition === 'bottom' ? h - pad * 2 - legendH : h - pad * 2;
                        const cx = pad + chartW / 2;
                        const cy = pad + chartH / 2;
                        const r = Math.max(0, Math.min(chartW, chartH) / 2);

                        // ── Slices ────────────────────────────────────────────────────
                        let startAngle = -Math.PI / 2; // start at 12 o'clock

                        for (let i = 0; i < points.length; i++) {
                            const point = points[i];
                            const fraction = point.value / total;
                            const sliceAngle = fraction * Math.PI * 2;
                            const endAngle = startAngle + sliceAngle;
                            const color = colors[i % colors.length];
                            const midAngle = startAngle + sliceAngle / 2;

                            dl.push({op: 'setFillStyle', value: color});
                            dl.push({op: 'beginPath'});
                            dl.push({op: 'moveTo', x: cx, y: cy});
                            dl.push({op: 'arc', cx, cy, r, startAngle, endAngle, ccw: false});
                            dl.push({op: 'closePath'});
                            dl.push({op: 'fill'});

                            // Draw a stroke in the background color to create a visual gap
                            // between slices. This avoids the centre-point divergence that
                            // angular insets produce.
                            if (o.gap > 0) {
                                dl.push({op: 'setStrokeStyle', value: o.background ?? '#ffffff'});
                                dl.push({op: 'setLineWidth', value: o.gap});
                                dl.push({op: 'stroke'});
                            }

                            // Hit area uses the full unmodified angles so the entire
                            // slice — including the gap region — is hittable
                            dl.push({
                                op: 'hitArea',
                                shape: 'sector',
                                cx,
                                cy,
                                r,
                                innerR: 0,
                                startAngle,
                                endAngle,
                                data: {
                                    index: i,
                                    label: point.label,
                                    value: point.value,
                                    percent: Math.round(fraction * 1000) / 10
                                }
                            });

                            // Percentage label inside slice
                            if (o.showLabels && sliceAngle >= o.minSliceAngle) {
                                const labelR = r * 0.65;
                                const labelX = cx + Math.cos(midAngle) * labelR;
                                const labelY = cy + Math.sin(midAngle) * labelR;
                                const pct = Math.round(fraction * 1000) / 10;
                                const pctText = pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;

                                dl.push({op: 'setFillStyle', value: o.labelColor});
                                dl.push({op: 'setFont', value: o.font});
                                dl.push({op: 'setTextAlign', value: 'center'});
                                dl.push({op: 'setTextBaseline', value: 'middle'});
                                dl.push({op: 'fillText', text: pctText, x: labelX, y: labelY});
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

                            dl.push({op: 'setFont', value: legendFont});
                            dl.push({op: 'setTextAlign', value: 'left'});
                            dl.push({op: 'setTextBaseline', value: 'middle'});

                            for (let i = 0; i < points.length; i++) {
                                const color = colors[i % colors.length];
                                const label = points[i].label || `Series ${i + 1}`;
                                const itemY = ly + i * legendItemH + swatchSize / 2;

                                dl.push({op: 'setFillStyle', value: color});
                                dl.push({
                                    op: 'fillRect',
                                    x: lx,
                                    y: itemY - swatchSize / 2,
                                    w: swatchSize,
                                    h: swatchSize
                                });

                                dl.push({op: 'setFillStyle', value: o.legendColor});
                                dl.push({op: 'fillText', text: label, x: lx + swatchSize + swatchGap, y: itemY});
                            }
                        }

                        return dl;
                    }
                },

                onComponentCreated(abstraction, pacId, config) {
                    const key = config.chartUtils?.property;
                    const chartUtils = config.chartUtils ?? {};

                    if (!key || !(key in abstraction)) {
                        return;
                    }

                    // Extract per-component chart options from config.chartUtils,
                    // excluding the reserved 'property' key which is consumed here.
                    const componentOpts = Object.assign({}, chartUtils);
                    delete componentOpts.property;

                    // If no component-level options were provided, inject functions directly
                    if (Object.keys(componentOpts).length === 0) {
                        abstraction[key] = this.functions;
                        return;
                    }

                    // Otherwise wrap each function so component options are merged as
                    // defaults — per-call options still take precedence.
                    const fns     = this.functions;
                    const wrapped = Object.create(null);

                    for (const name of Object.keys(fns)) {
                        wrapped[name] = function(ctx, data, opts) {
                            return fns[name](ctx, data, Object.assign({}, componentOpts, opts));
                        };
                    }

                    abstraction[key] = wrapped;
                }
            };
        }
    };

})();