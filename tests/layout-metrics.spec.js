const { test, expect } = require('@playwright/test');

for (const script of ['wakapac.js', 'wakapac.min.js']) {
    test(`${script} defers startup layout reads until after rendering`, async ({ page }) => {
        await page.goto('/');
        await page.setContent('<div id="app"><span>{{message}}</span></div>');
        await page.addScriptTag({ url: `/${script}` });

        const synchronousReads = await page.evaluate(() => {
            const properties = ['scrollWidth', 'scrollHeight', 'clientWidth', 'clientHeight'];
            const originals = properties.map(name => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)]);
            let reads = 0;

            for (const [name, descriptor] of originals) {
                Object.defineProperty(Element.prototype, name, {
                    ...descriptor,
                    get() {
                        reads++;
                        return descriptor.get.call(this);
                    }
                });
            }

            try {
                window.layoutTestApp = window.wakaPAC('#app', { message: 'Rendered' });
                return reads;
            } finally {
                for (const [name, descriptor] of originals) {
                    Object.defineProperty(Element.prototype, name, descriptor);
                }
            }
        });

        expect(synchronousReads).toBe(0);
        await expect(page.locator('#app')).toHaveText('Rendered');

        // containerWidth is also written by the pre-existing ResizeObserver,
        // independently of the deferred layout-metrics flush this test is
        // targeting, so polling on it can resolve before that flush runs.
        // containerContentWidth is only ever set by the flush, so poll on
        // that instead to actually wait for it to complete.
        await expect.poll(() => page.evaluate(() => window.layoutTestApp.containerContentWidth)).toBeGreaterThan(0);
        const metrics = await page.evaluate(() => ({
            containerWidth: window.layoutTestApp.containerWidth,
            documentWidth: window.layoutTestApp.browserContentWidth
        }));
        expect(metrics.containerWidth).toBeGreaterThan(0);
        expect(metrics.documentWidth).toBeGreaterThan(0);
    });
}
