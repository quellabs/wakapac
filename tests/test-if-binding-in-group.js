const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const wakapacFile = process.argv[2] || 'wakapac.js';
const wakapacSource = fs.readFileSync(path.join(__dirname, wakapacFile), 'utf8');

const html = `<!DOCTYPE html>
<html>
<body>
  <div id="app">
    <!-- wp-if: loading -->
    <div id="loading-div">Loading…</div>
    <!-- /wp-if -->

    <!-- wp-if: !loading && !notFound -->
    <h1 id="title">{{ logName }}</h1>

    <!-- wp-if: status === 'processed' -->
    <div id="summary">{{ classCount }} classes</div>
    <div data-pac-bind="if: hasWarning" id="warning-wrapper">
      <span id="warning-text">{{ warningMessage }}</span>
    </div>
    <!-- /wp-if -->
    <!-- /wp-if -->
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

const app = window.wakaPAC('#app', {
    loading: true,
    notFound: false,
    status: '',
    logName: 'my-log.txt',
    classCount: 0,
    hasWarning: false,
    warningMessage: ''
});

// Real async gap, matching the actual fetch() timing. hasWarning/warningMessage
// become true/set while `loading` is still true — i.e. while the whole
// "!loading && !notFound" ancestor is still hidden — exactly the timing
// that exposed the original bug.
setTimeout(() => {
    app.status = 'processed';
    app.classCount = 3;
    app.hasWarning = true;
    app.warningMessage = 'Some queries could not be fully parsed';
    app.loading = false;
}, 20);

setTimeout(() => {
    const wrapper = window.document.getElementById('warning-wrapper');
    const textEl = window.document.getElementById('warning-text');

    report('if:-bound wrapper is present', wrapper !== null);
    report('warning-text span is present (if: content actually shown)', textEl !== null);

    if (textEl) {
        const text = textEl.textContent;
        report('warning text is bound (not raw {{ }})', text.indexOf('{{') === -1 && text === 'Some queries could not be fully parsed');
        console.log('  warning text: "' + text + '"');
    }

    console.log('\nFull #app innerHTML:\n' + window.document.getElementById('app').innerHTML);
}, 150);
