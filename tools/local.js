// 로컬 개발용 DB(PGlite, 파일에 저장)와 파일 저장소. LOCAL_DATA 폴더(기본: 시스템 임시 폴더)에 둔다.
const fs = require('fs'), path = require('path'), os = require('os');
const { fromPglite } = require('../lib/db');
const { fileStorage } = require('../lib/storage');
async function localDeps() {
  const { PGlite } = require('@electric-sql/pglite');
  const root = process.env.LOCAL_DATA || path.join(os.tmpdir(), 'misconception-local');
  fs.mkdirSync(root, { recursive: true });
  const pg = new PGlite(path.join(root, 'pg'));
  await pg.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  return { db: fromPglite(pg), storage: fileStorage(path.join(root, 'files')), root };
}
module.exports = { localDeps };
