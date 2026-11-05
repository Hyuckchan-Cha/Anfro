// 동시 요청 30개가 같은 시트에 행을 덧붙여도 서로 덮어쓰지 않는지, 잠금이 한 번에 하나만 잡히는지 본다.
const fs = require('fs'), path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { createServices } = require('../lib/gas-shim');
const { fromPglite } = require('../lib/db');
const { memoryStorage } = require('../lib/storage');
(async () => {
  const pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const db = fromPglite(pg), storage = memoryStorage();
  const s0 = createServices({ db, storage });
  const sh0 = await (await s0.SpreadsheetApp.getActiveSpreadsheet()).insertSheet('풀이기록');
  await sh0.getRange(1, 1, 1, 2).setValues([['제출ID', '학생ID']]);
  // 각 요청이 먼저 시트를 읽어 둔 뒤(=오래된 사본), 동시에 appendRow / 끝에 setValues(appendObjs_ 방식)
  const reqs = await Promise.all(Array.from({ length: 30 }, async () => {
    const s = createServices({ db, storage });
    const sh = await (await s.SpreadsheetApp.getActiveSpreadsheet()).getSheetByName('풀이기록');
    await sh.getLastRow();
    return sh;
  }));
  await Promise.all(reqs.map(async (sh, i) => {
    if (i % 2) await sh.appendRow(['S' + i, 'st' + i]);
    else { const lr = await sh.getLastRow(); await sh.getRange(lr + 1, 1, 2, 2).setValues([['S' + i + 'a', 'st' + i], ['S' + i + 'b', 'st' + i]]); }
  }));
  const rows = await db.q("select vals->>'0' as id from gas_rows where sheet = '풀이기록' and idx > 1", []);
  const ids = new Set(rows.map(r => r.id));
  console.log('기대 45행 / 실제', rows.length, '행 / 서로 다른 ID', ids.size, rows.length === 45 && ids.size === 45 ? '✓ 덮어쓰기 없음' : '✗ 문제');
  // 잠금: 동시에 10개가 waitLock → 한 번에 하나만 안에 있어야 함
  let inside = 0, maxInside = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    const s = createServices({ db, storage });
    const lock = s.LockService.getScriptLock();
    await lock.waitLock(20000);
    inside++; maxInside = Math.max(maxInside, inside);
    await new Promise(r => setTimeout(r, 20));
    inside--;
    await lock.releaseLock();
  }));
  console.log('잠금 안에 동시에 있던 최대 요청 수', maxInside, maxInside === 1 ? '✓' : '✗');
})().catch(e => { console.error(e); process.exit(1); });
