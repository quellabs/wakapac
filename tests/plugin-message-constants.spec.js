const { test, expect } = require('@playwright/test');

const plugins = [
    [
        'wakackeditor4',
        'WakaCKEditor',
        'wakaCKEditor',
        {
            MSG_EDITOR_READY: 0x2200,
            MSG_EDITOR_ERROR: 0x2201
        }
    ],
    [
        'wakackeditor5',
        'WakaCKEditor',
        'wakaCKEditor',
        {
            MSG_EDITOR_READY: 0x2200,
            MSG_EDITOR_ERROR: 0x2201
        }
    ],
    [
        'wakatinymce',
        'WakaTinyMCE',
        'wakaTinyMCE',
        {
            MSG_EDITOR_READY: 0x2200,
            MSG_EDITOR_ERROR: 0x2201
        }
    ],
    [
        'wakajodit',
        'WakaJodit',
        'wakaJodit',
        {
            MSG_EDITOR_READY: 0x2200,
            MSG_EDITOR_ERROR: 0x2201
        }
    ],
    [
        'wakavideo',
        'WakaVideo',
        'wakaVideo',
        {
            MSG_VIDEO_PLAY         : 0x2100,
            MSG_VIDEO_PAUSE        : 0x2101,
            MSG_VIDEO_ENDED        : 0x2102,
            MSG_VIDEO_SEEK         : 0x2103,
            MSG_VIDEO_LOADED       : 0x2104,
            MSG_VIDEO_CUE_ENTER    : 0x2105,
            MSG_VIDEO_CUE_LEAVE    : 0x2106,
            MSG_VIDEO_ERROR        : 0x2107,
            MSG_VIDEO_VOLUME_CHANGE: 0x2108,
            MSG_VIDEO_RATE_CHANGE  : 0x2109,
            MSG_VIDEO_WAITING      : 0x210A,
            MSG_VIDEO_CANPLAY      : 0x210B,
            MSG_VIDEO_TIMEUPDATE   : 0x210C
        }
    ],
    [
        'wakavimeo',
        'WakaVimeo',
        'wakaVimeo',
        {
            MSG_VIDEO_PLAY         : 0x2100,
            MSG_VIDEO_PAUSE        : 0x2101,
            MSG_VIDEO_ENDED        : 0x2102,
            MSG_VIDEO_SEEK         : 0x2103,
            MSG_VIDEO_LOADED       : 0x2104,
            MSG_VIDEO_ERROR        : 0x2107,
            MSG_VIDEO_VOLUME_CHANGE: 0x2108,
            MSG_VIDEO_RATE_CHANGE  : 0x2109,
            MSG_VIDEO_WAITING      : 0x210A,
            MSG_VIDEO_CANPLAY      : 0x210B,
            MSG_VIDEO_TIMEUPDATE   : 0x210C
        }
    ],
    [
        'wakayoutube',
        'WakaYouTube',
        'wakaYouTube',
        {
            MSG_VIDEO_PLAY         : 0x2100,
            MSG_VIDEO_PAUSE        : 0x2101,
            MSG_VIDEO_ENDED        : 0x2102,
            MSG_VIDEO_SEEK         : 0x2103,
            MSG_VIDEO_LOADED       : 0x2104,
            MSG_VIDEO_ERROR        : 0x2107,
            MSG_VIDEO_VOLUME_CHANGE: 0x2108,
            MSG_VIDEO_WAITING      : 0x210A,
            MSG_VIDEO_CANPLAY      : 0x210B,
            MSG_VIDEO_TIMEUPDATE   : 0x210C
        }
    ],
    [
        'wakamask',
        'WakaMask',
        'wakaMask',
        {
            MSG_MASK_COMPLETE: 0x2200,
            MSG_MASK_REJECT  : 0x2201
        }
    ],
    [
        'wakalightgallery',
        'wakaLightGallery',
        'WakaLightGallery',
        {
            MSG_GALLERY_READY: 0x2300,
            MSG_GALLERY_ERROR: 0x2301,
            MSG_BEFORE_OPEN  : 0x2302,
            MSG_AFTER_OPEN   : 0x2303,
            MSG_BEFORE_CLOSE : 0x2304,
            MSG_AFTER_CLOSE  : 0x2305,
            MSG_BEFORE_SLIDE : 0x2306,
            MSG_AFTER_SLIDE  : 0x2307
        }
    ]
];

for (const [file, primary, alias, constants] of plugins) {
    for (const suffix of ['.js', '.min.js']) {
        test(`${file}${suffix}: message constants exist before installation`, async ({ page }) => {
            await page.goto('/');
            await page.addScriptTag({ url: `/plugins/${file}${suffix}` });

            const before = await page.evaluate(({ primary, alias }) => ({
                constants: Object.fromEntries(Object.entries(window[primary]).filter(([name]) => name.startsWith('MSG_'))),
                sameAlias: window[primary] === window[alias]
            }), { primary, alias });

            expect(before.constants).toEqual(constants);
            expect(before.sameAlias).toBe(true);

            await page.addScriptTag({ url: '/wakapac.js' });
            const after = await page.evaluate(({ primary }) => {
                // Installation must consume constants without redefining them.
                Object.freeze(window[primary]);
                window.wakaPAC.use(window[primary]);
                return Object.fromEntries(Object.entries(window[primary]).filter(([name]) => name.startsWith('MSG_')));
            }, { primary });

            expect(after).toEqual(constants);
        });
    }
}
