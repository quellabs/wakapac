// Regression coverage for isLeafItemMutation (see rebuildForeachesForBatch in
// wakapac.js): a bare `foreach: items` binding must skip the destructive
// rebuild for a change that cannot affect array membership or order.
//
// ed065fb fixed that check for whole-item replacement (`items[0] = x`) but,
// in doing so, dropped the dot-nesting branch the previous version had. A
// non-index property set directly on the bound array itself (e.g.
// `items.selectedCount = 3`, allowed since shouldMakeReactive only excludes
// '_'/'$'-prefixed props) was then misclassified as needing a rebuild, even
// though it cannot be an item mutation at all.
//
// A rebuild tears down and recreates every item's DOM node (see
// captureForeachFocus/restoreForeachFocus), so node identity across the
// mutation is used here to detect whether one happened.

const { test, expect } = require('@playwright/test');

for (const script of ['wakapac.js', 'wakapac.min.js']) {
    test.describe(`${script}: leaf-mutation detection on a foreach-bound array`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.setContent(
                '<div id="app"><ul data-pac-bind="foreach: items" data-pac-item="item">' +
                '<li>{{item.value}}</li></ul></div>'
            );
            await page.addScriptTag({ url: `/${script}` });
            await page.evaluate(() => {
                window.app = window.wakaPAC('#app', {
                    items: [{ value: 'a' }, { value: 'b' }]
                });
            });
            await page.waitForFunction(() => document.querySelectorAll('li').length === 2);
            await page.evaluate(() => {
                window.firstLi = document.querySelector('li');
            });
        });

        test('does not rebuild when a non-index property is set directly on the bound array', async ({ page }) => {
            await page.evaluate(() => {
                window.app.items.selectedCount = 3;
                window.wakaPAC.flushReactiveChanges(document.getElementById('app').getAttribute('data-pac-id'));
            });

            expect(await page.evaluate(() => document.querySelector('li') === window.firstLi)).toBe(true);
            expect(await page.evaluate(() => window.app.items.selectedCount)).toBe(3);
        });

        test('still rebuilds when a whole item is replaced', async ({ page }) => {
            await page.evaluate(() => {
                window.app.items[0] = { value: 'new' };
                window.wakaPAC.flushReactiveChanges(document.getElementById('app').getAttribute('data-pac-id'));
            });

            expect(await page.evaluate(() => document.querySelector('li') === window.firstLi)).toBe(false);
            expect(await page.locator('li').first().textContent()).toBe('new');
        });
    });
}
