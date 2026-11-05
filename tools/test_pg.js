/**
 * 실제 Postgres 엔진(PGlite, 메모리)에서 shim(lib/gas-shim.js)으로 같은 시나리오를 돌린다.
 * AI 호출만 mock_gas.js의 가짜 응답을 쓰고, 시트·속성·캐시·잠금·Drive는 모두 DB/Storage shim을 쓴다.
 * 사용: node tools/test_pg.js [fixtures.json]
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PGlite } = require('@electric-sql/pglite');
const { transform } = require('./gas2async');
const { createServices } = require('../lib/gas-shim');
const { fromPglite } = require('../lib/db');
const { memoryStorage } = require('../lib/storage');

(async () => {
  const gasDir = path.join(__dirname, '..', 'test');
  const pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const db = fromPglite(pg);
  const services = createServices({ db, storage: memoryStorage(), newFileId: (name) => /^A\d{9}\.png$/.test(name) ? 'PIMG-' + name.slice(0, 10) : null });

  const fixtures = process.argv[2] || path.join(gasDir, 'fixtures.json');
  const ctx = { console, print: (...a) => console.log(...a), std: { loadFile: () => fs.readFileSync(fixtures, 'utf8') } };
  vm.createContext(ctx);
  // 가짜 AI 응답(__route, UrlFetchApp)과 시험용 도우미만 mock_gas.js에서 가져오고, 나머지는 shim으로 덮는다.
  vm.runInContext(fs.readFileSync(path.join(gasDir, 'mock_gas.js'), 'utf8'), ctx);
  ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'DriveApp', 'Utilities', 'Session', 'DbView'].forEach(k => { ctx[k] = services[k]; });
  ctx.__ss = services._book;
  ctx.__addProblemFolder = async function (name, codes) {
    const folder = await services.DriveApp.createFolder(name);
    for (const c of codes) await folder.createFile(services.Utilities.newBlob(Buffer.from([137, 80, 78, 71]), 'image/png', c + '.png'));
    await folder.createFile(services.Utilities.newBlob('memo', 'text/plain', '설명.txt'));
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'server-async.js'), 'utf8'), ctx, { filename: 'server-async.js' });
  const asyncNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lib', 'async-names.json'), 'utf8'));
  const t = transform(fs.readFileSync(path.join(gasDir, 'scenario.js'), 'utf8'), { extraAsync: asyncNames.concat(['__addProblemFolder']), topLevelAsync: true, hofParams: false });
  if (t.warnings.length) { console.error(t.warnings.join('\n')); process.exit(1); }
  const started = Date.now();
  await vm.runInContext('(async function () {\n' + t.code + '\n})()', ctx, { filename: 'scenario-async.js' });
  const rows = await db.q('select sheet, count(*)::int n from gas_rows group by sheet order by sheet', []);
  console.log('DB 행 수:', rows.map(r => r.sheet + ' ' + r.n).join(', '));
  console.log('걸린 시간', ((Date.now() - started) / 1000).toFixed(1) + '초');
})().catch(e => { console.error('시험 오류:', e && e.stack || e); process.exit(1); });
