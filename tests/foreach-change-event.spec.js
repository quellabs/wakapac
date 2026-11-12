// Regression coverage for the bug fixed by skipping the destructive foreach
// rebuild on a leaf-item mutation (see rebuildForeachesForBatch in
// wakapac.js): a `change:` binding on a text input inside a `foreach:` row
// never fired, because every keystroke rebuilt the row and replaced the
// input, defeating the browser's native "changed since focus" tracking.
//
// This can't be verified from examples/test-wakapac-core.html, because that
// suite simulates typing via `input.value = x; dispatchEvent(new Event(...))`,
// and Chromium never sets its native change-tracking flag for that — true
// even on a plain input with no foreach involved. Only real, CDP-level
// keystrokes (via page.keyboard here) exercise the actual browser behavior
// this fix depends on.

const { test, expect } = require('@playwright/test');

for (const script of ['wakapac.js', 'wakapac.min.js']) {
    test.describe(`${script}: change: binding on a foreach item`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.setContent(
                '<div id="app"><ul data-pac-bind="foreach: items" data-pac-item="item">' +
                '<li><input class="val-input" data-pac-bind="value: item.value, change: onValueChange"></li></ul></div>'
            );
            await page.addScriptTag({ url: `/${script}` });
            await page.evaluate(() => {
                window.changeCount = 0;
                window.lastValue = null;
                window.app = window.wakaPAC('#app', {
                    items: [{ value: '' }],
                    onValueChange(event) {
                        window.changeCount++;
                        window.lastValue = event.target.value;
                    }
                });
            });
        });

        test('fires once, on blur, with the final value — not per keystroke', async ({ page }) => {
            const input = page.locator('.val-input');
            await input.click();
            await page.keyboard.type('50');

            expect(await page.evaluate(() => window.changeCount)).toBe(0);

            await page.keyboard.press('Tab');

            expect(await page.evaluate(() => window.changeCount)).toBe(1);
            expect(await page.evaluate(() => window.lastValue)).toBe('50');
            expect(await page.evaluate(() => window.app.items[0].value)).toBe('50');
        });

        test('does not fire from a focus/blur with no edit in between', async ({ page }) => {
            const input = page.locator('.val-input');
            await input.click();
            await page.keyboard.press('Tab');

            expect(await page.evaluate(() => window.changeCount)).toBe(0);
        });

        test('fires again on a second edit/blur session, not just the first', async ({ page }) => {
            const input = page.locator('.val-input');

            await input.click();
            await page.keyboard.type('first');
            await page.keyboard.press('Tab');
            await input.click();
            await page.keyboard.type('second');
            await page.keyboard.press('Tab');

            expect(await page.evaluate(() => window.changeCount)).toBe(2);
        });
    });
}
