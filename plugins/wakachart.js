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

    /** Owns the state and lifecycle of one pie chart layout. */
    class PieChartLayout {
        constructor(owner, ctx, data, opts = {}) {
            this._owner = owner;
            this._ctx = ctx;
            this._data = data;
            this._opts = opts;

            this.sumPointValues = this.sumPointValues.bind(this);
        }

        initialize() {
            const state = this;

            state._chartPluginContext = state._owner;

            state._o = pluginRuntime.mergeOpts(state._chartPluginContext._defaults, state._opts);
            state._points = pluginRuntime.toPoints(state._data);

            if (state._points.length === 0) {
                return [];
            }

            state._total = state._points.reduce(state.sumPointValues.bind(state._owner), 0);

            if (state._total === 0) {
                return [];
            }

            state.measureCanvas();

            state.measureLegend();

            state.measureChart();

            state.initializeDisplayList();

            state.renderSlices();

            state.renderLegend();

            return state._dl.build();
        }

        renderLegend() {
            const state = this;

            // ── Legend ────────────────────────────────────────────────────
            if (state._o.showLegend) {
                let lx, ly;

                if (state._o.legendPosition === 'right') {
                    lx = state._pad + state._chartW + state._pad;
                    ly = state._pad + (state._chartH - state._points.length * state._legendItemH) / 2;
                } else {
                    lx = (state._w - state._legendW) / 2;
                    ly = state._pad + state._chartH + state._pad;
                }

                state._dl.setFont(state._legendFont).setTextAlign('left').setTextBaseline('middle');

                for (let i = 0; i < state._points.length; i++) {
                    const color = state._colors[i % state._colors.length];
                    const label = state._points[i].label || `Series ${i + 1}`;
                    const itemY = ly + i * state._legendItemH + state._swatchSize / 2;

                    state._dl.setFillStyle(color).fillRect(lx, itemY - state._swatchSize / 2, state._swatchSize, state._swatchSize)
                        .setFillStyle(state._o.legendColor).fillText(label, lx + state._swatchSize + state._swatchGap, itemY);
                }
            }
        }

        renderSlices() {
            const state = this;
            // start at 12 o'clock

            for (let i = 0; i < state._points.length; i++) {
                state.renderSlice(i);
            }
        }

        initializeDisplayList() {
            const state = this;

            state._dl = new state._chartPluginContext._pac.MetaFile();

            // ── Slices ────────────────────────────────────────────────────
            state._startAngle = -Math.PI / 2;
        }

        measureChart() {
            const state = this;

            // ── Chart area ────────────────────────────────────────────────
            state._chartW = state._o.legendPosition === 'right' ? state._w - state._pad * 2 - state._legendW : state._w - state._pad * 2;
            state._chartH = state._o.legendPosition === 'bottom' ? state._h - state._pad * 2 - state._legendH : state._h - state._pad * 2;
            state._cx = state._pad + state._chartW / 2;
            state._cy = state._pad + state._chartH / 2;
            state._r = Math.max(0, Math.min(state._chartW, state._chartH) / 2);
        }

        measureLegend() {
            const state = this;

            // ── Legend dimensions ─────────────────────────────────────────
            state._swatchSize = 12;
            state._swatchGap = 6;
            state._legendItemH = state._swatchSize + 4;
            state._legendFont = state._o.legendFont;

            state._legendW = 0;
            state._legendH = 0;

            if (state._o.showLegend) {
                // Measure legend to reserve space
                state._ctx.save();
                state._ctx.font = state._legendFont;

                if (state._o.legendPosition === 'right') {
                    for (let i = 0; i < state._points.length; i++) {
                        const tw = state._ctx.measureText(state._points[i].label || `Series ${i + 1}`).width;
                        state._legendW = Math.max(state._legendW, state._swatchSize + state._swatchGap + tw);
                    }

                    state._legendW += state._pad;
                    state._legendH = 0;
                } else {
                    // bottom
                    for (let i = 0; i < state._points.length; i++) {
                        const tw = state._ctx.measureText(state._points[i].label || `Series ${i + 1}`).width;
                        state._legendW = Math.max(state._legendW, state._swatchSize + state._swatchGap + tw);
                    }

                    state._legendH = (state._points.length * state._legendItemH) + state._pad;
                }

                state._ctx.restore();
            }
        }

        measureCanvas() {
            const state = this;

            state._colors = state._o.colors;
            state._pad = state._o.padding;
            state._w = state._ctx.canvas.width;
            state._h = state._ctx.canvas.height;
        }

        sumPointValues(s, p) {
            return s + p.value;
        }

        renderSlice(i) {
            const state = this;

            const point = state._points[i];
            const fraction = point.value / state._total;
            const sliceAngle = fraction * Math.PI * 2;
            const endAngle = state._startAngle + sliceAngle;
            const color = state._colors[i % state._colors.length];
            const midAngle = state._startAngle + sliceAngle / 2;

            state._dl.setFillStyle(color).beginPath().moveTo(state._cx, state._cy).arc(state._cx, state._cy, state._r, state._startAngle, endAngle).closePath().fill();

            // Draw a stroke in the background color to create a visual gap
            // between slices. This avoids the centre-point divergence that
            // angular insets produce.
            if (state._o.gap > 0) {
                state._dl.setStrokeStyle(state._o.background ?? '#ffffff').setLineWidth(state._o.gap).stroke();
            }

            // Hit area uses the full unmodified angles so the entire
            // slice — including the gap region — is hittable
            state._dl.hitArea('sector', {
                cx        : state._cx,
                cy        : state._cy,
                r         : state._r,
                innerR    : 0,
                startAngle: state._startAngle,
                endAngle,
                data      : {
                    index  : i,
                    label  : point.label,
                    value  : point.value,
                    percent: Math.round(fraction * 1000) / 10
                }
            });

            // Value label inside slice
            if (state._o.showLabels && sliceAngle >= state._o.minSliceAngle) {
                const labelR = state._r * 0.65;
                const labelX = state._cx + Math.cos(midAngle) * labelR;
                const labelY = state._cy + Math.sin(midAngle) * labelR;

                state._dl.setFillStyle(state._o.labelColor).setFont(state._o.font).setTextAlign('center').setTextBaseline('middle').fillText(String(point.value), labelX, labelY);
            }

            state._startAngle = endAngle;
        }
    }

    /** Owns the state and lifecycle of one bar chart layout. */
    class BarChartLayout {
        constructor(owner, ctx, data, opts = {}) {
            this._owner = owner;
            this._ctx = ctx;
            this._data = data;
            this._opts = opts;

            this.sumPointValues = this.sumPointValues.bind(this);
            this.pointValue = this.pointValue.bind(this);
        }

        initialize() {
            const state = this;

            state._chartPluginContext = state._owner;

            state._o = pluginRuntime.mergeOpts(state._chartPluginContext._defaults, state._opts);
            state._points = pluginRuntime.toPoints(state._data);

            if (state._points.length === 0) {
                return [];
            }

            state._colors = state._o.colors;
            state._pad = state._o.padding;
            state._w = state._ctx.canvas.width;
            state._h = state._ctx.canvas.height;
            state._maxVal = Math.max(...state._points.map(state.pointValue.bind(state._owner)));
            state._total = state._points.reduce(state.sumPointValues.bind(state._owner), 0);

            if (state._maxVal === 0) {
                return [];
            }

            state.measureAxisLabels();

            state.measureChart();

            if (state._chartW <= 0 || state._chartH <= 0) {
                return [];
            }

            state.initializeDisplayList();

            state.renderAxes();

            state.renderBars();

            return state._dl.build();
        }

        renderBars() {
            const state = this;

            // ── Bars ──────────────────────────────────────────────────────
            for (let i = 0; i < state._points.length; i++) {
                state.renderBar(i);
            }
        }

        renderAxes() {
            const state = this;

            state._dl.setFont(state._o.font).setTextAlign('right').setTextBaseline('middle');

            for (let t = 0; t <= state._tickCount; t++) {
                const tickVal = state._tickStep * t;
                const tickY = state._chartY + state._chartH - (tickVal / state._maxVal) * state._chartH;
                const label = String(Math.round(tickVal));

                // Y-axis label
                state._dl.setFillStyle(state._o.legendColor ?? '#333333').fillText(label, state._chartX - state._axisGap, tickY);

                // Horizontal grid line (skip baseline — drawn separately)
                if (t > 0) {
                    state._dl.setStrokeStyle(state._gridColor).setLineWidth(1).beginPath().moveTo(state._chartX, tickY).lineTo(state._chartX + state._chartW, tickY).stroke();
                }
            }

            // ── Baseline ──────────────────────────────────────────────────
            state._dl.setStrokeStyle(state._axisColor).setLineWidth(1).beginPath().moveTo(state._chartX, state._baseY).lineTo(state._chartX + state._chartW, state._baseY).stroke();
        }

        initializeDisplayList() {
            const state = this;

            state._barGap = state._o.barGap ?? 0.25; // fraction of slot used as gap
            state._slotW = state._chartW / state._points.length;
            state._barW = state._slotW * (1 - state._barGap);
            state._barOffX = state._slotW * state._barGap / 2;

            // ── Grid lines and Y-axis labels ──────────────────────────────
            state._axisColor = state._o.axisColor ?? '#cccccc';
            state._gridColor = state._o.gridColor ?? '#eeeeee';
            state._baseY = state._chartY + state._chartH;

            state._dl = new wakaPAC.MetaFile();
        }

        measureChart() {
            const state = this;

            // ── Chart area ────────────────────────────────────────────────
            state._xLabelH = 20;  // height reserved for X-axis labels
            state._valueLH = 16;  // height reserved for value labels above bars
            state._axisGap = 6;   // gap between axis labels and chart area

            state._chartX = state._pad + state._yLabelW + state._axisGap;
            state._chartY = state._pad + state._valueLH;
            state._chartW = state._w - state._chartX - state._pad;
            state._chartH = state._h - state._chartY - state._xLabelH - state._axisGap - state._pad;
        }

        measureAxisLabels() {
            const state = this;

            // ── Axis and label metrics ─────────────────────────────────────
            state._ctx.save();
            state._ctx.font = state._o.font;

            // Measure the widest Y-axis label to reserve left margin
            state._tickCount = state._o.tickCount ?? 5;
            state._tickStep = state._maxVal / state._tickCount;
            state._yLabelW = 0;

            for (let t = 0; t <= state._tickCount; t++) {
                const label = String(Math.round(state._tickStep * t));
                state._yLabelW = Math.max(state._yLabelW, state._ctx.measureText(label).width);
            }

            state._ctx.restore();
        }

        sumPointValues(s, p) {
            return s + p.value;
        }

        pointValue(p) {
            return p.value;
        }

        renderBar(i) {
            const state = this;

            const point = state._points[i];
            const color = state._colors[i % state._colors.length];
            const barH = (point.value / state._maxVal) * state._chartH;
            const bx = state._chartX + i * state._slotW + state._barOffX;
            const by = state._baseY - barH;

            // Bar fill
            state._dl.setFillStyle(color).fillRect(bx, by, state._barW, barH);

            // Hit area
            state._dl.hitArea('rect', {
                x   : bx,
                y   : by,
                w   : state._barW,
                h   : barH,
                data: {
                    index  : i,
                    label  : point.label,
                    value  : point.value,
                    percent: Math.round((point.value / state._total) * 1000) / 10
                }
            });

            // Value label above bar
            state._dl.setFillStyle(state._o.legendColor ?? '#333333').setFont(state._o.font).setTextAlign('center').setTextBaseline('bottom').fillText(String(point.value), bx + state._barW / 2, by - 2);

            // X-axis label
            if (point.label) {
                state._dl.setFillStyle(state._o.legendColor ?? '#333333').setFont(state._o.font).setTextAlign('center').setTextBaseline('top').fillText(point.label, bx + state._barW / 2, state._baseY + state._axisGap);
            }
        }
    }

    /** Owns the state and lifecycle of one line chart layout. */
    class LineChartLayout {
        constructor(owner, ctx, data, opts = {}) {
            this._owner = owner;
            this._ctx = ctx;
            this._data = data;
            this._opts = opts;

            this.pointCoordinates = this.pointCoordinates.bind(this);
            this.sumPointValues = this.sumPointValues.bind(this);
            this.pointValue = this.pointValue.bind(this);
        }

        initialize() {
            const state = this;

            state._chartPluginContext = state._owner;

            state._o = pluginRuntime.mergeOpts(state._chartPluginContext._defaults, state._opts);
            state._points = pluginRuntime.toPoints(state._data);

            if (state._points.length === 0) {
                return [];
            }

            state._pad = state._o.padding;
            state._w = state._ctx.canvas.width;
            state._h = state._ctx.canvas.height;
            state._maxVal = Math.max(...state._points.map(state.pointValue.bind(state._owner)));
            state._total = state._points.reduce(state.sumPointValues.bind(state._owner), 0);

            if (state._maxVal === 0) {
                return [];
            }

            state.measureAxisLabels();

            state.measureChart();

            if (state._chartW <= 0 || state._chartH <= 0) {
                return [];
            }

            state.initializeDisplayList();

            state.renderAxes();

            state.renderLine();

            state.renderPoints();

            return state._dl.build();
        }

        renderPoints() {
            const state = this;

            // ── Data point markers and hit areas ──────────────────────────
            for (let i = 0; i < state._points.length; i++) {
                state.renderPoint(i);
            }
        }

        renderLine() {
            const state = this;

            // ── Precompute point coordinates ──────────────────────────────
            state._slotW = state._chartW / (state._points.length - 1 || 1);
            state._coords = state._points.map(state.pointCoordinates.bind(state._owner));

            // ── Line ──────────────────────────────────────────────────────
            state._dl.setStrokeStyle(state._lineColor).setLineWidth(state._lineWidth).setLineCap('round').setLineJoin('round').beginPath().moveTo(state._coords[0].x, state._coords[0].y);

            if (state._smooth && state._coords.length > 1) {
                // Cubic bezier smooth curve — control points at 1/3 of the
                // horizontal distance between adjacent points
                for (let i = 1; i < state._coords.length; i++) {
                    const prev = state._coords[i - 1];
                    const curr = state._coords[i];
                    const cpX = (curr.x - prev.x) / 3;
                    state._dl.bezierCurveTo(prev.x + cpX, prev.y, curr.x - cpX, curr.y, curr.x, curr.y);
                }
            } else {
                for (let i = 1; i < state._coords.length; i++) {
                    state._dl.lineTo(state._coords[i].x, state._coords[i].y);
                }
            }

            state._dl.stroke();
        }

        renderAxes() {
            const state = this;

            // ── Grid lines and Y-axis labels ──────────────────────────────
            state._dl.setFont(state._o.font).setTextAlign('right').setTextBaseline('middle');

            for (let t = 0; t <= state._tickCount; t++) {
                const tickVal = state._tickStep * t;
                const tickY = state._chartY + state._chartH - (tickVal / state._maxVal) * state._chartH;
                const label = String(Math.round(tickVal));

                state._dl.setFillStyle(state._o.legendColor ?? '#333333').fillText(label, state._chartX - state._axisGap, tickY);

                if (t > 0) {
                    state._dl.setStrokeStyle(state._gridColor).setLineWidth(1).beginPath().moveTo(state._chartX, tickY).lineTo(state._chartX + state._chartW, tickY).stroke();
                }
            }

            // ── Baseline ──────────────────────────────────────────────────
            state._dl.setStrokeStyle(state._axisColor).setLineWidth(1).beginPath().moveTo(state._chartX, state._baseY).lineTo(state._chartX + state._chartW, state._baseY).stroke();
        }

        initializeDisplayList() {
            const state = this;

            state._axisColor = state._o.axisColor ?? '#cccccc';
            state._gridColor = state._o.gridColor ?? '#eeeeee';
            state._lineColor = state._o.lineColor ?? state._o.colors[0];
            state._lineWidth = state._o.lineWidth ?? 2;
            state._pointR = state._o.pointRadius ?? 4;
            state._smooth = state._o.smooth ?? false;
            state._baseY = state._chartY + state._chartH;

            state._dl = new wakaPAC.MetaFile();
        }

        measureChart() {
            const state = this;

            // ── Chart area ────────────────────────────────────────────────
            state._xLabelH = 20;
            state._axisGap = 6;

            state._chartX = state._pad + state._yLabelW + state._axisGap;
            state._chartY = state._pad;
            state._chartW = state._w - state._chartX - state._pad;
            state._chartH = state._h - state._chartY - state._xLabelH - state._axisGap - state._pad;
        }

        measureAxisLabels() {
            const state = this;

            // ── Axis and label metrics ─────────────────────────────────────
            state._ctx.save();
            state._ctx.font = state._o.font;

            state._tickCount = state._o.tickCount ?? 5;
            state._tickStep = state._maxVal / state._tickCount;
            state._yLabelW = 0;

            for (let t = 0; t <= state._tickCount; t++) {
                const label = String(Math.round(state._tickStep * t));
                state._yLabelW = Math.max(state._yLabelW, state._ctx.measureText(label).width);
            }

            state._ctx.restore();
        }

        pointCoordinates(p, i) {
            const state = this;
            return {
                x: state._chartX + i * state._slotW,
                y: state._baseY - (p.value / state._maxVal) * state._chartH
            };
        }

        sumPointValues(s, p) {
            return s + p.value;
        }

        pointValue(p) {
            return p.value;
        }

        renderPoint(i) {
            const state = this;

            const point = state._points[i];
            const cx = state._coords[i].x;
            const cy = state._coords[i].y;

            // Dot
            state._dl.setFillStyle(state._lineColor).beginPath().arc(cx, cy, state._pointR, 0, Math.PI * 2).fill();

            // White centre for a ring effect
            state._dl.setFillStyle(state._o.background ?? '#ffffff').beginPath().arc(cx, cy, state._pointR / 2, 0, Math.PI * 2).fill();

            // Hit area — slightly larger than the visible dot for easier clicking
            state._dl.hitArea('sector', {
                cx,
                cy,
                r         : state._pointR * 2,
                innerR    : 0,
                startAngle: 0,
                endAngle  : Math.PI * 2,
                data      : {
                    index  : i,
                    label  : point.label,
                    value  : point.value,
                    percent: Math.round((point.value / state._total) * 1000) / 10
                }
            });

            // X-axis label
            if (point.label) {
                state._dl.setFillStyle(state._o.legendColor ?? '#333333').setFont(state._o.font).setTextAlign('center').setTextBaseline('top').fillText(point.label, cx, state._baseY + state._axisGap);
            }
        }
    }

    /** Owns the state and lifecycle of one sparkline layout. */
    class SparklineLayout {
        constructor(owner, ctx, data, opts = {}) {
            this._owner = owner;
            this._ctx = ctx;
            this._data = data;
            this._opts = opts;

            this.pointCoordinates = this.pointCoordinates.bind(this);
            this.pointValue = this.pointValue.bind(this);
        }

        initialize() {
            const state = this;

            state._chartPluginContext = state._owner;

            state._o = pluginRuntime.mergeOpts(state._chartPluginContext._defaults, state._opts);
            state._points = pluginRuntime.toPoints(state._data);

            if (state._points.length < 2) {
                return [];
            }

            state._maxVal = Math.max(...state._points.map(state.pointValue.bind(state._owner)));
            state._minVal = Math.min(...state._points.map(state.pointValue.bind(state._owner)));
            state._range = state._maxVal - state._minVal || 1;

            state.measureChart();

            if (state._chartW <= 0 || state._chartH <= 0) {
                return [];
            }

            state.initializeCoordinates();

            state.renderLine();

            state.renderEndPoint();

            return state._dl.build();
        }

        renderEndPoint() {
            const state = this;

            // ── End point marker — highlights the last value ───────────────
            if (state._o.showEndPoint ?? true) {
                const last = state._coords[state._coords.length - 1];
                const dotR = state._o.pointRadius ?? 3;
                state._dl.setFillStyle(state._lineColor).beginPath().arc(last.x, last.y, dotR, 0, Math.PI * 2).fill();
            }
        }

        renderLine() {
            const state = this;

            state._dl = new wakaPAC.MetaFile();

            // ── Line ──────────────────────────────────────────────────────
            state._dl.setStrokeStyle(state._lineColor).setLineWidth(state._lineWidth).setLineCap('round').setLineJoin('round').beginPath().moveTo(state._coords[0].x, state._coords[0].y);

            if (state._smooth) {
                for (let i = 1; i < state._coords.length; i++) {
                    const prev = state._coords[i - 1];
                    const curr = state._coords[i];
                    const cpX = (curr.x - prev.x) / 3;
                    state._dl.bezierCurveTo(prev.x + cpX, prev.y, curr.x - cpX, curr.y, curr.x, curr.y);
                }
            } else {
                for (let i = 1; i < state._coords.length; i++) {
                    state._dl.lineTo(state._coords[i].x, state._coords[i].y);
                }
            }

            state._dl.stroke();
        }

        initializeCoordinates() {
            const state = this;

            state._lineColor = state._o.lineColor ?? state._o.colors[0];
            state._lineWidth = state._o.lineWidth ?? 2;
            state._smooth = state._o.smooth ?? false;
            state._slotW = state._chartW / (state._points.length - 1);

            // Precompute coordinates — Y is inverted so higher values sit higher
            state._coords = state._points.map(state.pointCoordinates.bind(state._owner));
        }

        measureChart() {
            const state = this;
            // avoid division by zero for flat data

            state._pad = state._o.padding;
            state._w = state._ctx.canvas.width;
            state._h = state._ctx.canvas.height;
            state._chartX = state._pad;
            state._chartY = state._pad;
            state._chartW = state._w - state._pad * 2;
            state._chartH = state._h - state._pad * 2;
        }

        pointCoordinates(p, i) {
            const state = this;
            return {
                x: state._chartX + i * state._slotW,
                y: state._chartY + state._chartH - ((p.value - state._minVal) / state._range) * state._chartH
            };
        }

        pointValue(p) {
            return p.value;
        }
    }

    /** Owns the state and lifecycle of one chart plugin. */
    class ChartPlugin {
        constructor(owner, pac, options = {}) {
            this._owner = owner;
            this._pac = pac;
            this._options = options;

            this.sparkline = this.sparkline.bind(this);
            this.lineChart = this.lineChart.bind(this);
            this.barChart = this.barChart.bind(this);
            this.pieChart = this.pieChart.bind(this);
        }

        initialize() {
            const state = this;

            /**
             * Global defaults — merged with per-call options at draw time.
             * Per-call options always take precedence.
             */
            state._defaults = {
                colors        : state._options.colors ?? DEFAULT_COLORS,
                font          : state._options.font ?? '12px sans-serif',
                labelColor    : state._options.labelColor ?? '#ffffff',
                legendColor   : state._options.legendColor ?? '#333333',
                legendFont    : state._options.legendFont ?? '12px sans-serif',
                padding       : state._options.padding ?? 16,
                gap           : state._options.gap ?? 2,     // px gap between slices
                showLabels    : state._options.showLabels ?? true,  // percentage labels inside slices
                showLegend    : state._options.showLegend ?? true,
                legendPosition: state._options.legendPosition ?? 'bottom', // 'bottom' | 'right'
                minSliceAngle : state._options.minSliceAngle ?? 0.15       // radians — slices smaller than this skip labels
            };

            state._charts = state.createCharts();

            return state.createDescriptor();
        }

        sparkline(ctx, data, opts = {}) {
            return new SparklineLayout(this, ctx, data, opts).initialize();
        }

        lineChart(ctx, data, opts = {}) {
            return new LineChartLayout(this, ctx, data, opts).initialize();
        }

        barChart(ctx, data, opts = {}) {
            return new BarChartLayout(this, ctx, data, opts).initialize();
        }

        pieChart(ctx, data, opts = {}) {
            return new PieChartLayout(this, ctx, data, opts).initialize();
        }

        createCharts() {
            const state = this;

            return {
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
                pieChart: state.pieChart.bind(state._owner),

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
                barChart: state.barChart.bind(state._owner),

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
                lineChart: state.lineChart.bind(state._owner),

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
                sparkline: state.sparkline.bind(state._owner)
            };
        }

        createDescriptor() {
            const state = this;

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
                        abstraction[key] = state._charts;
                        return;
                    }

                    // Otherwise wrap each function so component options are merged as
                    // defaults — per-call options still take precedence.
                    const wrapped = Object.create(null);

                    for (const name of Object.keys(state._charts)) {
                        const componentLifecycleHandlers = {
                            renderChart(ctx, data, opts) {
                                return state._charts[name](ctx, data, Object.assign({}, componentOpts, opts));
                            }
                        };

                        wrapped[name] = componentLifecycleHandlers.renderChart;
                    }

                    abstraction[key] = wrapped;
                }
            };
        }
    }

    const pluginRuntime = {
        /**
         * Normalizes input data to an array of { label, value } objects.
         * Accepts either plain numbers or { label, value } objects.
         * Filters out non-finite and negative values.
         * @param {Array<number|{label:string, value:number}>} data
         * @returns {Array<{label:string, value:number}>}
         */
        toPoints(data) {
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
        },

        /**
         * Merges global defaults with per-call options.
         * Per-call options take precedence. Arrays (e.g. colors) are not merged — per-call wins entirely.
         * @param {Object} defaults
         * @param {Object} opts
         * @returns {Object}
         */
        mergeOpts(defaults, opts) {
            return Object.assign({}, defaults, opts);
        }
    };

    /**
     * Default color palette — distinct, accessible colors.
     * @type {string[]}
     */
    const DEFAULT_COLORS = [
        '#4e79a7',
        '#f28e2b',
        '#e15759',
        '#76b7b2',
        '#59a14f',
        '#edc948',
        '#b07aa1',
        '#ff9da7',
        '#9c755f',
        '#bab0ac'
    ];

    window.WakaChart = {

        createPacPlugin(pac, options = {}) {
            return new ChartPlugin(this, pac, options).initialize();
        }
    };

    window.wakaChart = window.WakaChart;
})();