const { test, expect } = require('@playwright/test');

// Regression test: a 2D canvas PAC container's initial paint
// (Runtime.prototype.initializeCanvas) is synchronous by design, so it must
// see correct containerWidth/Height immediately rather than the 0 defaults
// that are normally only corrected by the deferred, batched layout-metrics
// flush a couple of frames later. See examples/example28.html, whose
// msgProc draws a clock sized from containerWidth/Height.
test('canvas PAC container paints correctly before its first timer tick', async ({ page }) => {
    await page.goto('/examples/example28.html');

    // Sample well before the 1-second MSG_TIMER repaint in example28.html,
    // so this only passes if the initial synchronous paint itself drew
    // something — a later repaint from the timer can't mask a blank start.
    await page.waitForTimeout(200);

    const drawnPixels = await page.evaluate(() => {
        const canvas = document.getElementById('clock');
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let count = 0;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) {
                count++;
            }
        }

        return count;
    });

    expect(drawnPixels).toBeGreaterThan(0);
});
