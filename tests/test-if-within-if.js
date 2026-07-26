const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const wakapacFile = process.argv[2] || 'wakapac.js';
const wakapacSource = fs.readFileSync(path.join(__dirname, wakapacFile), 'utf8');

const html = `<!DOCTYPE html>
<html>
<body>
  <div id="app">
    <div data-pac-bind="if: outerFlag" id="outer-if">
      <div data-pac-bind="if: innerFlag" id="inner-if">
        <span id="inner-text">{{ message }}</span>
      </div>
    </div>
  </div>
</body>
</html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously' });
const { window } = dom;

window.matchMedia = function (q) { return { matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }; };
window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
window.requestAnimationFrame = function (cb) { return setTimeout(() => cb(Date.now()), 16); };
window.cancelAnimationFrame = function (id) { clearTimeout(id); };

const scriptEl = window.document.createElement('script');
scriptEl.textContent = wakapacSource;
window.document.head.appendChild(scriptEl);

function report(label, ok) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + label);
    if (!ok) process.exitCode = 1;
}

// outerFlag starts false, hiding inner-if entirely. innerFlag becomes true
// WHILE outerFlag is still false — i.e. while inner-if is still detached —
// then outerFlag becomes true afterward. No wp-if anywhere in this test.
const app = window.wakaPAC('#app', {
    outerFlag: false,
    innerFlag: false,
    message: ''
});

setTimeout(() => {
    app.innerFlag = true;
    app.message = 'hello from inside';
}, 20);

setTimeout(() => {
    app.outerFlag = true;
}, 40);

setTimeout(() => {
    const innerIf = window.document.getElementById('inner-if');
    const textEl = window.document.getElementById('inner-text');

    report('inner-if element is present', innerIf !== null);
    report('inner-text span is present (inner if: content shown)', textEl !== null);

    if (textEl) {
        const text = textEl.textContent;
        report('message text is bound (not raw {{ }})', text === 'hello from inside');
        console.log('  text: "' + text + '"');
    }

    console.log('\nFull #app innerHTML:\n' + window.document.getElementById('app').innerHTML);
}, 100);
