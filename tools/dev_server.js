// 로컬 개발 서버: public/ 정적 파일 + /api/rpc (로컬 PGlite·파일 저장소). 사용: node tools/dev_server.js [포트]
const http = require('http'), fs = require('fs'), path = require('path');
const { run, isPublic } = require('../lib/runtime');
const { localDeps } = require('./local');
(async () => {
  const d = await localDeps();
  const port = Number(process.argv[2]) || 8787;
  http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/rpc') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', async () => {
        let out, status = 200;
        try {
          const b = JSON.parse(body || '{}');
          if (!isPublic(b.fn)) { status = 400; out = { ok: false, error: '허용되지 않은 요청' }; }
          else out = await run(b.fn, b.args || [], d);
        } catch (e) { status = 500; out = { ok: false, error: String(e && e.message || e) }; console.error(e); }
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out === undefined ? null : out));
      });
      return;
    }
    const f = path.join(__dirname, '..', 'public', req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { var types = { html: 'text/html; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', css: 'text/css', js: 'application/javascript' }; res.writeHead(200, { 'Content-Type': types[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }
    else { res.writeHead(404); res.end('not found'); }
  }).listen(port, '127.0.0.1', () => console.log('개발 서버 http://127.0.0.1:' + port));
})();
