const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pluginDirectory = path.join(__dirname, '..', 'plugins');
const pluginFiles = fs.readdirSync(pluginDirectory)
    .filter(name => name.endsWith('.js') && !name.endsWith('.min.js'));

for (const suffix of ['.js', '.min.js']) {
    test(`${suffix}: unrelated core and plugin messages have distinct IDs`, async ({ page }) => {
        await page.goto('/');
        await page.addScriptTag({ url: `/wakapac${suffix}` });

        const messages = await page.evaluate(() => Object.entries(window.wakaPAC)
            .filter(([name, id]) => name.startsWith('MSG_') && typeof id === 'number')
            .filter(([name]) => name !== 'MSG_PLUGIN' && name !== 'MSG_USER')
            .map(([name, id]) => ({ family: 'core', name, id })));

        for (const file of pluginFiles) {
            const source = fs.readFileSync(path.join(pluginDirectory, file), 'utf8');
            const exports = [...source.matchAll(/window\.(waka\w*)\s*=/gi)].map(match => match[1]);
            let family = file;
            if (/^waka(video|vimeo|youtube)\.js$/.test(file)) {
                family = 'video';
            } else if (/^waka(ckeditor[45]|tinymce|jodit)\.js$/.test(file)) {
                family = 'editor';
            }

            await page.addScriptTag({ url: `/plugins/${file.replace(/\.js$/, suffix)}` });
            const exportedMessages = await page.evaluate(({ exports, family }) => {
                const messages = [];
                for (const name of exports) {
                    const plugin = window[name];
                    for (const property of Object.getOwnPropertyNames(plugin)) {
                        if (property.startsWith('MSG_') && typeof plugin[property] === 'number') {
                            messages.push({ family, name: property, id: plugin[property] });
                        }
                    }
                }
                return messages;
            }, { exports, family });
            messages.push(...exportedMessages);
        }

        const ids = new Map();
        const events = new Map();
        for (const { family, name, id } of messages) {
            const event = `${family}:${name}`;
            if (ids.has(id)) {
                expect(event, `collision at 0x${id.toString(16)} with ${ids.get(id)}`).toBe(ids.get(id));
            }
            if (events.has(event)) {
                expect(id, `equivalent event ${event} must keep its shared ID`).toBe(events.get(event));
            }
            ids.set(id, event);
            events.set(event, id);
        }

        expect(events.has('wakaroute.js:MSG_ROUTE_BEFORE')).toBe(true);
        expect(events.has('wakacolorpicker.js:MSG_COLOR_CHANGED')).toBe(true);
        expect(events.has('wakasync.js:MSG_HTTP_SUCCESS')).toBe(true);
        expect(events.has('wakamask.js:MSG_MASK_COMPLETE')).toBe(true);
        expect(events.has('editor:MSG_EDITOR_READY')).toBe(true);
        expect(events.has('video:MSG_VIDEO_PLAY')).toBe(true);
    });
}
