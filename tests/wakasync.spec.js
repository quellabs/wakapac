const { test, expect } = require('@playwright/test');

for (const bundle of ['wakasync.js', 'wakasync.min.js']) {
    test(`${bundle}: HTTP constants exist before installation and match delivered messages`, async ({ page }) => {
        await page.goto('/');
        await page.addScriptTag({ url: `/plugins/${bundle}` });

        const constants = await page.evaluate(() => {
            const client = new window.WakaSync();
            return ['MSG_HTTP_SUCCESS', 'MSG_HTTP_ERROR', 'MSG_HTTP_ABORT'].map((name) => [
                window.WakaSync[name],
                window.wakaSync[name],
                client[name]
            ]);
        });
        expect(constants).toEqual([
            [8704, 8704, 8704],
            [8705, 8705, 8705],
            [8706, 8706, 8706]
        ]);

        await page.addScriptTag({ url: '/wakapac.js' });
        const results = await page.evaluate(async () => {
            const client = window.wakaSync;
            const host = {
                MSG_PLUGIN: window.wakaPAC.MSG_PLUGIN,
                messages:   [],
                postMessage(...args) {
                    this.messages.push(args);
                }
            };
            const component = {};
            const plugin = client.createPacPlugin(host);
            plugin.onComponentCreated(component, 'app', {});

            client.request = async function () {
                return { value: 'loaded' };
            };
            const successId = component._http.get('/success');
            await new Promise(resolve => setTimeout(resolve, 0));

            client.request = async function () {
                throw Object.assign(new Error('failed'), { response: { status: 503 } });
            };
            const errorId = component._http.post('/error', {});
            await new Promise(resolve => setTimeout(resolve, 0));

            client.request = async function () {
                throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
            };
            const abortId = component._http.get('/abort');
            await new Promise(resolve => setTimeout(resolve, 0));

            return {
                ids:      [successId, errorId, abortId],
                messages: host.messages.map(args => args.slice(0, 4)),
                data:     host.messages[0][4].data,
                statics:  [window.WakaSync.MSG_HTTP_SUCCESS, window.WakaSync.MSG_HTTP_ERROR, window.WakaSync.MSG_HTTP_ABORT],
                instance: [client.MSG_HTTP_SUCCESS, client.MSG_HTTP_ERROR, client.MSG_HTTP_ABORT]
            };
        });

        expect(results.ids).toEqual([1, 2, 3]);
        expect(results.messages).toEqual([
            ['app', results.statics[0], 1, 0],
            ['app', results.statics[1], 2, 503],
            ['app', results.statics[2], 3, 0]
        ]);
        expect(results.instance).toEqual(results.statics);
        expect(results.data).toEqual({ value: 'loaded' });
    });
}
