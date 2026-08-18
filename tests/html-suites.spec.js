// Runs the self-contained browser test suites under examples/test-*.html
// headlessly and turns their pass/fail output into Playwright assertions.
//
// Those pages are plain HTML + a small hand-rolled runner (see
// examples/test-wakaform.html for the canonical shape): each one loads
// wakapac.js (and, where relevant, a plugin) directly via <script src>,
// runs its assertions on load, and sets #summary's class to "all-pass" or
// "has-fail" when done. This spec doesn't know anything about what each
// suite tests — it just discovers every examples/test-*.html that opts
// into that convention and checks the outcome, so a new suite added under
// examples/ is picked up automatically without touching this file.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const examplesDir = path.join(__dirname, '..', 'examples');

const suiteFiles = fs.readdirSync(examplesDir)
    .filter((name) => /^test-.*\.html$/.test(name))
    .filter((name) => {
        const contents = fs.readFileSync(path.join(examplesDir, name), 'utf8');
        // Only pages that report machine-readable pass/fail are automated
        // suites; the rest (e.g. test-showcase.html) are manual demo pages.
        return contents.includes('all-pass') && contents.includes('has-fail');
    })
    .sort();

test.describe('examples/test-*.html suites', () => {
    for (const fileName of suiteFiles) {
        test(fileName, async ({ page }) => {
            const consoleErrors = [];
            page.on('pageerror', (err) => consoleErrors.push(String(err)));

            await page.goto(`/examples/${fileName}`);

            const summary = page.locator('#summary');
            await expect(summary).toHaveClass(/all-pass|has-fail/, { timeout: 20000 });

            const hasFail = await summary.evaluate((el) => el.classList.contains('has-fail'));

            if (hasFail) {
                const summaryText = await summary.textContent();
                const failureNames = await page.locator('.fail').allTextContents();
                throw new Error(
                    `${fileName}: ${summaryText}\n` +
                    (failureNames.length ? 'Failing tests:\n  - ' + failureNames.join('\n  - ') : '') +
                    (consoleErrors.length ? '\nPage errors:\n  - ' + consoleErrors.join('\n  - ') : '')
                );
            }

            expect(consoleErrors, 'no uncaught page errors').toEqual([]);
        });
    }
});

test('at least one automated suite was discovered', () => {
    expect(suiteFiles.length).toBeGreaterThan(0);
});
