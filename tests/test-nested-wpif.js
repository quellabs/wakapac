const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const wakapacSource = fs.readFileSync(path.join(__dirname, 'wakapac.js'), 'utf8');

const html = `<!DOCTYPE html>
<html>
<body>
  <div id="app">
    <!-- wp-if: loading -->
    <div id="loading-div">Loading…</div>
    <!-- /wp-if -->

    <!-- wp-if: !loading && !notFound -->
    <h1 id="title">{{ logName }}</h1>
    <p>subtitle</p>

    <!-- wp-if: status === 'pending' || status === 'processing' -->
    <div id="processing-div">Processing…</div>
    <!-- /wp-if -->

    <!-- wp-if: status === 'failed' -->
    <div id="failed-div">Processing failed</div>
    <!-- /wp-if -->

    <!-- wp-if: status === 'processed' -->
    <div id="processed-div">Table goes here</div>
    <!-- /wp-if -->
    <!-- /wp-if -->
  </div>
</body>
</html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously' });
const { window } = dom;

// Load wakapac.js into the jsdom window context
const scriptEl = window.document.createElement('script');
scriptEl.textContent = wakapacSource;
window.document.head.appendChild(scriptEl);

window.matchMedia = window.matchMedia || function (query) {
    return {
        matches: false,
        media: query,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
    };
};

window.IntersectionObserver = window.IntersectionObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

window.ResizeObserver = window.ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

window.requestAnimationFrame = window.requestAnimationFrame || function (cb) {
    return setTimeout(() => cb(Date.now()), 16);
};
window.cancelAnimationFrame = window.cancelAnimationFrame || function (id) {
    clearTimeout(id);
};

function byId(id) {
    return window.document.getElementById(id);
}

function report(label, ok) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + label);
    if (!ok) process.exitCode = 1;
}

const app = window.wakaPAC('#app', {
    loading: true,
    notFound: false,
    status: '',
    logName: 'my-log.txt'
});

// A real async gap here matters — it's what separates wakaPAC's initial
// evaluation (which sees loading:true, status:'') from these changes,
// exactly like the real page's actual fetch() call. Setting these
// synchronously right after construction (as an earlier version of this
// test did) collapses everything into one evaluation pass and hides the
// bug entirely — this is deliberately NOT synchronous.
setTimeout(() => {
    app.status = 'processed';
    app.loading = false;
}, 20);

// Give any microtask-based reactivity a moment to flush.
setTimeout(() => {
    report('loading div is gone', byId('loading-div') === null);
    report('processing div is gone (was the bug: stayed visible)', byId('processing-div') === null);
    report('failed div is gone (was the bug: stayed visible)', byId('failed-div') === null);
    report('processed div IS present', byId('processed-div') !== null);
    report('title (outer, non-nested content) IS present', byId('title') !== null);

    console.log('\nFinal #app innerHTML:\n' + window.document.getElementById('app').innerHTML);
}, 100);
