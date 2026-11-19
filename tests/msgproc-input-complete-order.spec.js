// Regression coverage for issue #232: MSG_INPUT_COMPLETE exists to give
// msgProc the settled, post-mutation value of a value-bound input (see
// handleDomInputComplete's docblock). Previously msgProc ran before that
// sync, so a msgProc reading the bound reactive property for the element
// that triggered the event always saw the *previous* keystroke's value,
// not the one that was just typed.

const { test, expect } = require('@playwright/test');

for (const script of ['wakapac.js', 'wakapac.min.js']) {
    test.describe(`${script}: msgProc sees the settled value on MSG_INPUT_COMPLETE`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.setContent('<div id="app"><input id="queryInput" data-pac-bind="value: query"></div>');
            await page.addScriptTag({ url: `/${script}` });
            await page.evaluate(() => {
                window.capturedQuery = null;
                window.app = window.wakaPAC('#app', {
                    query: '',
                    msgProc(event) {
                        if (event.message === wakaPAC.MSG_INPUT_COMPLETE) {
                            window.capturedQuery = this.query;
                        }
                    }
                });
            });
        });

        test('reads the just-typed character, not the previous keystroke', async ({ page }) => {
            const input = page.locator('#queryInput');
            await input.click();
            await page.keyboard.type('abc');

            expect(await page.evaluate(() => window.capturedQuery)).toBe('abc');
            expect(await page.evaluate(() => window.app.query)).toBe('abc');
        });
    });
}
