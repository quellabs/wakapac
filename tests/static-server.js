// Minimal static file server for serving the repo root during Playwright
// runs. Needed because some pages use APIs (e.g. history.pushState in
// wakaroute.js) that browsers reject under the null-origin file:// scheme.
// No dependency on npm packages — just Node's built-in http/fs.

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = process.env.PORT || 4173;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);

    // Playwright's webServer readiness probe polls "/" expecting a 2xx/3xx
    // response; the repo has no root index.html, so answer it directly.
    if (requestPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('wakapac test static server');
        return;
    }

    const filePath = path.join(root, requestPath);

    // Prevent escaping the repo root
    if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(port, () => {
    console.log(`Static server listening on http://localhost:${port}`);
});
