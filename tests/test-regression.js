const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const wakapacSource = fs.readFileSync(path.join(__dirname, 'wakapac.js'), 'utf8');

function makeApp(html, abstraction) {
    const dom = new JSDOM(`<!DOCTYPE html><body><div id="app">${html}</div></body>`, { runScripts: 'dangerously' });
    const { window } = dom;

    window.matchMedia = function (q) { return { matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }; };
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.requestAnimationFrame = function (cb) { return setTimeout(() => cb(Date.now()), 16); };
    window.cancelAnimationFrame = function (id) { clearTimeout(id); };

    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = wakapacSource;
    window.document.head.appendChild(scriptEl);

    const app = window.wakaPAC('#app', abstraction);
    return { window, app };
}

let failures = 0;

function report(label, ok) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + label);
    if (!ok) failures++;
}

function run(label, fn) {
    console.log('\n=== ' + label + ' ===');
    fn();
}

// -----------------------------------------------------------------------
// 1. Plain, non-nested wp-if (the existing, already-working case)
// -----------------------------------------------------------------------
run('plain non-nested wp-if', () => {
    const { window, app } = makeApp(`
        <!-- wp-if: show -->
        <div id="a">A</div>
        <!-- /wp-if -->
    `, { show: true });

    setTimeout(() => {
        report('shown when true', window.document.getElementById('a') !== null);
        app.show = false;

        setTimeout(() => {
            report('hidden when false', window.document.getElementById('a') === null);
        }, 30);
    }, 30);
});

// -----------------------------------------------------------------------
// 2. wp-else-if / wp-else chain
// -----------------------------------------------------------------------
setTimeout(() => run('wp-else-if / wp-else chain', () => {
    const { window, app } = makeApp(`
        <!-- wp-if: value === 1 -->
        <div id="one">one</div>
        <!-- wp-else-if: value === 2 -->
        <div id="two">two</div>
        <!-- wp-else -->
        <div id="other">other</div>
        <!-- /wp-if -->
    `, { value: 1 });

    setTimeout(() => {
        report('branch 1 shown', window.document.getElementById('one') !== null);
        report('branch 2 hidden', window.document.getElementById('two') === null);
        report('else hidden', window.document.getElementById('other') === null);

        app.value = 2;

        setTimeout(() => {
            report('branch 1 hidden after switch', window.document.getElementById('one') === null);
            report('branch 2 shown after switch', window.document.getElementById('two') !== null);

            app.value = 99;

            setTimeout(() => {
                report('else shown for unmatched value', window.document.getElementById('other') !== null);
            }, 30);
        }, 30);
    }, 30);
}), 100);

// -----------------------------------------------------------------------
// 3. Two levels of nesting (outer > middle > inner)
// -----------------------------------------------------------------------
setTimeout(() => run('two levels of nested wp-if', () => {
    const { window, app } = makeApp(`
        <!-- wp-if: outer -->
        <div id="outer-content">outer</div>

        <!-- wp-if: middle -->
        <div id="middle-content">middle</div>

        <!-- wp-if: inner -->
        <div id="inner-content">inner</div>
        <!-- /wp-if -->

        <!-- /wp-if -->
        <!-- /wp-if -->
    `, { outer: true, middle: true, inner: true });

    setTimeout(() => {
        report('all three levels visible when all true', window.document.getElementById('outer-content') !== null && window.document.getElementById('middle-content') !== null && window.document.getElementById('inner-content') !== null);

        app.inner = false;

        setTimeout(() => {
            report('inner hidden independently', window.document.getElementById('inner-content') === null);
            report('middle still visible', window.document.getElementById('middle-content') !== null);
            report('outer still visible', window.document.getElementById('outer-content') !== null);

            app.middle = false;

            setTimeout(() => {
                report('middle hidden (and inner with it)', window.document.getElementById('middle-content') === null);
                report('outer still visible after middle hides', window.document.getElementById('outer-content') !== null);

                app.inner = true; // flip back while hidden — should not leak through

                setTimeout(() => {
                    report('inner still hidden while middle is hidden, even though inner=true', window.document.getElementById('inner-content') === null);

                    app.middle = true;

                    setTimeout(() => {
                        report('re-showing middle also reveals inner (it was true all along)', window.document.getElementById('inner-content') !== null);
                    }, 30);
                }, 30);
            }, 30);
        }, 30);
    }, 30);
}), 300);

setTimeout(() => {
    console.log('\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'));
    process.exitCode = failures === 0 ? 0 : 1;
}, 700);
