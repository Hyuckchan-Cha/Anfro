/** DB 연결: 배포 환경은 Supabase Postgres(풀러 주소), 로컬 시험은 PGlite(메모리 속 Postgres). */
let pool = null;

/** postgres.js 연결을 { q(text, params), tx(fn) } 형태로 감싼다. */
function fromPostgresJs(sql) {
  return {
    q: (text, params) => sql.unsafe(text, params || []).then(r => Array.from(r)),
    tx: (fn) => sql.begin(t => fn((text, params) => t.unsafe(text, params || []).then(r => Array.from(r))))
  };
}

function fromPglite(pg) {
  return {
    q: (text, params) => pg.query(text, params || []).then(r => r.rows),
    tx: (fn) => pg.transaction(t => fn((text, params) => t.query(text, params || []).then(r => r.rows)))
  };
}

/** Vercel·Supabase 연동이 넣어 주는 연결 주소를 쓴다(트랜잭션 풀러: prepare 끄기). */
function getDb() {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DB 연결 주소(POSTGRES_URL)가 없어요. Vercel 환경 변수를 확인해 주세요.');
  const postgres = require('postgres');
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15, ssl: url.includes('localhost') ? false : 'require' });
  pool = fromPostgresJs(sql);
  return pool;
}

module.exports = { getDb, fromPostgresJs, fromPglite };
