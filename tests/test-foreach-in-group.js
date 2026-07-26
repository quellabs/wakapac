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
    <p>subtitle</p>

    <!-- wp-if: status === 'pending' || status === 'processing' -->
    <div id="processing-div">Processing…</div>
    <!-- /wp-if -->

    <!-- wp-if: status === 'failed' -->
    <div id="failed-div">Processing failed</div>
    <!-- /wp-if -->

    <!-- wp-if: status === 'processed' -->
    <div id="summary">{{ classCount }} classes</div>
    <table id="the-table">
      <tbody data-pac-bind="foreach: rows" data-pac-item="cls">
        <tr>
          <td class="fp">{{ cls.fingerprint }}</td>
          <td class="cnt">{{ cls.query_count }}</td>
        </tr>
      </tbody>
    </table>
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
    rows: []
});

// Real async gap, matching the actual fetch() timing: status/rows land
// first, loading flips false afterward — same order as loadLog().
setTimeout(() => {
    app.status = 'processed';
    app.classCount = 2;
    app.rows = [
        { fingerprint: 'select a from t where id = ?', query_count: 12 },
        { fingerprint: 'select b from u where id = ?', query_count: 7 }
    ];
    app.loading = false;
}, 20);

setTimeout(() => {
    const table = window.document.getElementById('the-table');
    const rowEls = table ? table.querySelectorAll('tbody tr') : [];

    report('table is present', table !== null);
    report('exactly 2 rows rendered', rowEls.length === 2);

    let allBound = true;
    let sample = '';

    rowEls.forEach(tr => {
        const fp = tr.querySelector('.fp').textContent;
        const cnt = tr.querySelector('.cnt').textContent;
        sample += `[fp="${fp}" cnt="${cnt}"] `;

        if (fp.indexOf('{{') !== -1 || cnt.indexOf('{{') !== -1) {
            allBound = false;
        }
    });

    report('row text interpolations are bound (not raw {{ }})', allBound);
    console.log('  row contents: ' + sample);

    console.log('\nFull #app innerHTML:\n' + window.document.getElementById('app').innerHTML);
}, 150);
