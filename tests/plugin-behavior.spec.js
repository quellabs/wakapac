const { test, expect } = require('@playwright/test');

class BrowserChecks {
    static colors() {
        const input = document.createElement('input');
        input.setAttribute('data-wcp', '');
        input.value = '#ff0000';
        document.body.appendChild(input);
        const component = {};
        const host = {
            messages: [],
            getContainerByPacId() { return input; },
            sendMessage(...args) { this.messages.push(args); }
        };
        const plugin = window.wakaColorPicker.createPacPlugin(host);
        plugin.onComponentCreated(component, 'color', {});
        const text = document.querySelector('.wcp-text-input');
        text.value = '#00ff00';
        text.dispatchEvent(new Event('input'));
        const changed = component.value;
        plugin.onComponentDestroyed('color');
        return {
            changed,
            inputValue      : input.value,
            inputType       : input.type,
            remainingWidgets: document.querySelectorAll('.wcp-widget').length,
            message         : host.messages[host.messages.length - 1],
            expectedMessage : window.WakaColorPicker.MSG_COLOR_CHANGED
        };
    }

    static sprites() {
        const drawing = window.wakaDDraw;
        const primary = drawing.createSurface(10, 10, { colorKey: null });
        const red = drawing.createSurface(8, 8, { colorKey: null });
        red._ctx.fillStyle = 'red';
        red._ctx.fillRect(0, 0, 8, 8);
        const blue = drawing.createSurface(4, 4, { colorKey: null });
        blue._ctx.fillStyle = 'blue';
        blue._ctx.fillRect(0, 0, 4, 4);
        const scene = drawing.sceneCreate({ background: '#00ff00' });
        drawing.sceneAddSprite(scene, drawing.createSprite(red, null, 0));
        const sprite = drawing.createSprite(blue, null, 1);
        sprite.moveTo(2, 2);
        drawing.sceneAddSprite(scene, sprite);
        drawing.sceneInvalidate(scene, primary);
        drawing.sceneRender(scene, primary);
        const first = [];
        for (const [x, y] of [[1, 1], [3, 3], [9, 9]]) {
            first.push([...primary._ctx.getImageData(x, y, 1, 1).data]);
        }
        sprite.moveTo(5, 5);
        drawing.sceneRender(scene, primary);
        return {
            first,
            restored: [...primary._ctx.getImageData(3, 3, 1, 1).data],
            moved   : [...primary._ctx.getImageData(6, 6, 1, 1).data],
            pending : scene._dirty.length
        };
    }

    static async http() {
        const client = new window.WakaSync();
        const order = [];
        const interceptors = {
            request(config) { order.push('request'); return config; },
            response(data) { order.push('response'); return { value: data.value + 1 }; },
            success() { order.push('success'); }
        };
        const removeRequest = client.addRequestInterceptor(interceptors.request);
        const removeResponse = client.addResponseInterceptor(interceptors.response);
        const transformed = await client.get('/plugin-data', { onSuccess: interceptors.success });
        order.push('resolved');
        removeRequest();
        removeResponse();
        const original = await client.get('/plugin-data');
        let cancellation;
        try {
            await client.get('/plugin-timeout', { timeout: 10 });
        } catch (error) {
            cancellation = { type: error.cancellationType, recognized: client.isCancellationError(error) };
        }
        return { order, transformed, original, cancellation };
    }

    static charts() {
        const component = {};
        const plugin = window.wakaChart.createPacPlugin(window.wakaPAC);
        plugin.onComponentCreated(component, 'chart', { wakaChart: { property: 'charts', showLabels: false } });
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 200;
        const context = canvas.getContext('2d');
        const points = [{ label: 'A', value: 2 }, { label: 'B', value: 4 }, { label: 'C', value: 3 }];
        const output = {};

        for (const method of ['pieChart', 'barChart', 'lineChart', 'sparkline']) {
            const displayList = component.charts[method](context, points, { smooth: true });
            output[method] = {
                empty     : component.charts[method](context, []),
                hits      : [],
                operations: displayList.length
            };
            for (const command of displayList) {
                if (command.op === 'hitArea') {
                    output[method].hits.push(command);
                }
            }
            // Exercise actual MetaFile replay, including the fluent curve APIs.
            window.wakaPAC.playMetaFile(context, displayList);
        }
        return output;
    }

    static video() {
        const video = document.createElement('video');
        document.body.appendChild(video);
        Object.defineProperties(video, {
            duration   : { value: 12 },
            videoWidth : { value: 640 },
            videoHeight: { value: 360 }
        });
        const component = {};
        const host = {
            messages: [],
            getContainerByPacId() { return video; },
            sendMessage(...args) { this.messages.push(args); }
        };
        const plugin = window.wakaVideo.createPacPlugin(host);
        plugin.onComponentCreated(component, 'video', {});
        for (const name of ['loadedmetadata', 'play', 'pause', 'waiting', 'canplay', 'ended']) {
            video.dispatchEvent(new Event(name));
        }
        const messages = host.messages;
        const delivered = messages.length;
        plugin.onComponentDestroyed('video');
        video.dispatchEvent(new Event('play'));

        return {
            component,
            ids     : messages.map(BrowserChecks.messageId),
            expected: [
                window.WakaVideo.MSG_VIDEO_LOADED,
                window.WakaVideo.MSG_VIDEO_PLAY,
                window.WakaVideo.MSG_VIDEO_PAUSE,
                window.WakaVideo.MSG_VIDEO_WAITING,
                window.WakaVideo.MSG_VIDEO_CANPLAY,
                window.WakaVideo.MSG_VIDEO_ENDED
            ],
            cleanedUp: delivered === messages.length
        };
    }

    static messageId(message) {
        return message[1];
    }

    static motion() {
        const component = {};
        window.PACRegistry = { components: [{ abstraction: component }] };
        const plugin = window.wakaMotion.createPacPlugin(window.wakaPAC);
        plugin.onComponentCreated(component);
        window.wakaMotion.enable(true);
        const event = new Event('devicemotion');
        Object.defineProperties(event, {
            accelerationIncludingGravity: { value: { x: 4.905, y: 0, z: 9.81 } },
            rotationRate                : { value: { alpha: 1.234, beta: null, gamma: 0 } }
        });
        window.dispatchEvent(event);
        return component;
    }

    static editor() {
        const textarea = document.createElement('textarea');
        textarea.setAttribute('data-ckeditor', '');
        document.body.appendChild(textarea);
        class Editor {
            constructor() {
                this.handlers = new Map();
                this.data = '<p>initial</p>';
                this.destroyed = false;
            }
            on(name, callback) { this.handlers.set(name, callback); }
            getData() { return this.data; }
            setData(value) { this.data = value; }
            destroy() { this.destroyed = true; }
        }
        const editor = new Editor();
        window.CKEDITOR = {
            replace() { return editor; }
        };
        const host = {
            MSG_CHANGE: window.wakaPAC.MSG_CHANGE,
            messages  : [],
            getContainerByPacId() { return textarea; },
            sendMessage(...args) { this.messages.push(args); }
        };
        const plugin = window.wakaCKEditor.createPacPlugin(host);
        plugin.onComponentCreated({}, 'editor', {});
        editor.handlers.get('instanceReady')();
        editor.setData('<p>changed</p>');
        editor.handlers.get('change')();
        plugin.onComponentDestroyed('editor');
        return {
            messages : host.messages,
            ready    : window.WakaCKEditor.MSG_EDITOR_READY,
            changed  : window.wakaPAC.MSG_CHANGE,
            destroyed: editor.destroyed
        };
    }
}

class PluginChecks {
    constructor(suffix) {
        this.suffix = suffix;
    }

    async load(page, plugin) {
        await page.goto('/');
        await page.addScriptTag({ url: `/wakapac${this.suffix}` });
        await page.addScriptTag({ url: `/plugins/${plugin}${this.suffix}` });
        await page.addScriptTag({ content: `window.BrowserChecks = ${BrowserChecks.toString()};` });
    }

    async charts({ page }) {
        await this.load(page, 'wakachart');
        const results = await page.evaluate(BrowserChecks.charts);
        for (const [name, result] of Object.entries(results)) {
            expect(result.empty).toEqual([]);
            expect(result.operations, name).toBeGreaterThan(0);
            expect(result.hits, name).toHaveLength(name === 'sparkline' ? 0 : 3);
        }
    }

    async sprites({ page }) {
        await this.load(page, 'wakaddraw');
        const result = await page.evaluate(BrowserChecks.sprites);
        expect(result).toEqual({
            first   : [[255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255]],
            restored: [255, 0, 0, 255],
            moved   : [0, 0, 255, 255],
            pending : 0
        });
    }

    async colors({ page }) {
        await this.load(page, 'wakacolorpicker');
        const result = await page.evaluate(BrowserChecks.colors);
        expect(result).toEqual({
            changed         : '#00ff00',
            inputValue      : '#00ff00',
            inputType       : 'text',
            remainingWidgets: 0,
            message         : ['color', result.expectedMessage, 0x00ff00, 0, { hex: '#00ff00' }],
            expectedMessage : result.expectedMessage
        });
    }

    async http({ page }) {
        await page.route('**/plugin-data', PluginRoutes.data);
        await page.route('**/plugin-timeout', PluginRoutes.pending);
        await this.load(page, 'wakasync');
        const result = await page.evaluate(BrowserChecks.http);
        expect(result).toEqual({
            order       : ['request', 'response', 'success', 'resolved'],
            transformed : { value: 3 },
            original    : { value: 2 },
            cancellation: { type: 'timeout', recognized: true }
        });
    }

    async video({ page }) {
        await this.load(page, 'wakavideo');
        const result = await page.evaluate(BrowserChecks.video);
        expect(result.ids).toEqual(result.expected);
        expect(result.component).toMatchObject({ duration: 12, videoWidth: 640, videoHeight: 360 });
        expect(result.cleanedUp).toBe(true);
    }

    async motion({ page }) {
        await this.load(page, 'wakamotion');
        const result = await page.evaluate(BrowserChecks.motion);
        expect(result).toMatchObject({
            motionHasAcceleration: true,
            motionHasRotationRate: true,
            motionAccelerationX  : 4.91,
            motionRotationAlpha  : 1.23,
            motionRotationBeta   : null,
            motionTiltX          : 30,
            motionTiltY          : 0
        });
    }

    async editor({ page }) {
        await this.load(page, 'wakackeditor4');
        const result = await page.evaluate(BrowserChecks.editor);
        expect(result.messages).toEqual([
            ['editor', result.ready, 0, 0, { value: '<p>initial</p>' }],
            ['editor', result.changed, 0, 0, { value: '<p>changed</p>' }]
        ]);
        expect(result.destroyed).toBe(true);
    }
}

class PluginRoutes {
    static data(route) { return route.fulfill({ json: { value: 2 } }); }
    static pending() {}
}

// Playwright inspects the fixture parameter names, so use named, unbound adapters.
class PluginCases {
    static checks(info) {
        return new PluginChecks(info.title.startsWith('.min.js') ? '.min.js' : '.js');
    }

    static charts({ page }, info) { return PluginCases.checks(info).charts({ page }); }
    static sprites({ page }, info) { return PluginCases.checks(info).sprites({ page }); }
    static colors({ page }, info) { return PluginCases.checks(info).colors({ page }); }
    static http({ page }, info) { return PluginCases.checks(info).http({ page }); }
    static video({ page }, info) { return PluginCases.checks(info).video({ page }); }
    static motion({ page }, info) { return PluginCases.checks(info).motion({ page }); }
    static editor({ page }, info) { return PluginCases.checks(info).editor({ page }); }
}

for (const suffix of ['.js', '.min.js']) {
    test(`${suffix}: charts preserve component defaults, hit areas, and rendering`, PluginCases.charts);
    test(`${suffix}: sprites preserve clipping, stacking, and dirty regions`, PluginCases.sprites);
    test(`${suffix}: color picker synchronizes values and restores the input on destroy`, PluginCases.colors);
    test(`${suffix}: HTTP interceptors, callback order, and timeouts preserve their contract`, PluginCases.http);
    test(`${suffix}: video events deliver messages and detach on destroy`, PluginCases.video);
    test(`${suffix}: motion events preserve rounding and tilt calculations`, PluginCases.motion);
    test(`${suffix}: editor events and destruction preserve their public contract`, PluginCases.editor);
}
