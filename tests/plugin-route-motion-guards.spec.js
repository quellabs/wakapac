// Regression coverage for two plugin guards:
// - wakaroute: MSG_ROUTE_BEFORE used to carry the current page's query string
//   (read from location.search before pushState) instead of the target's.
// - wakamotion: the re-entrancy guard in detectMotionAxisInversion indexed
//   PACRegistry.components (a Map) with [0], so it never saw an in-progress run.

const { test, expect } = require('@playwright/test');

for (const suffix of ['.js', '.min.js']) {
    test.describe(`wakaroute${suffix}: MSG_ROUTE_BEFORE describes the target URL`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/?tab=a');
            await page.setContent('<div id="app" data-pac-route="/{page:*}"></div>');
            await page.addScriptTag({ url: `/wakapac${suffix}` });
            await page.addScriptTag({ url: `/plugins/wakaroute${suffix}` });
            await page.evaluate(() => {
                window.beforeRouteDetail = null;
                window.wakaPAC.use(window.wakaRoute);
                window.wakaPAC('#app', {
                    msgProc(event) {
                        if (event.message === window.wakaPAC.MSG_ROUTE_BEFORE) {
                            window.beforeRouteDetail = event.detail;
                        }
                    }
                });
            });
        });

        test('reports the target path and query, not the current ones', async ({ page }) => {
            await page.evaluate(() => window.wakaRoute.navigate('/search?tab=b'));

            const detail = await page.evaluate(() => window.beforeRouteDetail);

            expect(detail.path).toBe('/search');
            expect(detail.query).toEqual({ tab: 'b' });
        });
    });

    test.describe(`wakamotion${suffix}: axis detection ignores re-entrant calls`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.setContent('<div id="app"></div>');
            await page.addScriptTag({ url: `/wakapac${suffix}` });
            await page.addScriptTag({ url: `/plugins/wakamotion${suffix}` });
            await page.evaluate(() => {
                window.devicemotionListenerCount = 0;

                const originalAddEventListener = window.addEventListener;

                window.addEventListener = function (type, ...rest) {
                    if (type === 'devicemotion') {
                        window.devicemotionListenerCount++;
                    }

                    return originalAddEventListener.call(this, type, ...rest);
                };

                window.wakaPAC.use(window.wakaMotion);
                window.app = window.wakaPAC('#app', {});
            });
        });

        test('a second call while tilt-x is pending starts no new detection', async ({ page }) => {
            await page.evaluate(() => window.wakaMotion.detectMotionAxisInversion());

            const afterFirstCall = await page.evaluate(() => ({
                step:      window.app.motionAxisDetectionStep,
                listeners: window.devicemotionListenerCount
            }));

            await page.evaluate(() => window.wakaMotion.detectMotionAxisInversion());

            const afterSecondCall = await page.evaluate(() => window.devicemotionListenerCount);

            expect(afterFirstCall.step).toBe('tilt-x');
            expect(afterSecondCall).toBe(afterFirstCall.listeners);
        });
    });
}
