/**
 * Apps Script 서비스(SpreadsheetApp, PropertiesService, CacheService, LockService, DriveApp,
 * UrlFetchApp, Utilities, Session)를 Supabase Postgres·Storage 위에 다시 만든 것.
 * 서버 코드(lib/server-async.js)는 이 객체들을 전역으로 받아 Apps Script에서와 똑같이 동작한다.
 *
 * 시트 저장 방식: gas_rows(sheet, idx, vals) — idx는 1부터 시작하는 행 번호,
 * vals는 {"0": 값, "3": 값} 처럼 열 번호(0부터)를 키로 한 객체라 칸 단위로 고칠 수 있다.
 *
 * 요청 하나 = createServices() 한 번. 시트 내용은 요청 안에서 메모리에 두고,
 * AI 호출(UrlFetchApp)이나 잠금을 얻은 뒤에는 다시 읽어 다른 요청이 바꾼 내용을 반영한다.
 */
const crypto = require('crypto');

const TZ = 'Asia/Seoul';
// 자주 바뀌지 않는 기준 자료 시트는 인스턴스 안에서 5분 동안 재사용한다.
const REF_SHEET = /^(문항정보.*|개념목록|선수개념위계도|선후관계)$/;
const REF_TTL_MS = 5 * 60 * 1000;
const refCache = new Map(); // name -> { at, data }

function toArray(obj) {
  const keys = Object.keys(obj || {});
  if (!keys.length) return [];
  let max = -1;
  keys.forEach(k => { const n = Number(k); if (n > max) max = n; });
  const row = new Array(max + 1).fill('');
  keys.forEach(k => { const v = obj[k]; row[Number(k)] = v === null || v === undefined ? '' : v; });
  return row;
}
function toObj(arr, offset) {
  const o = {};
  arr.forEach((v, i) => { o[String(offset + i)] = v instanceof Date ? v.toISOString() : (v === undefined ? '' : v); });
  return o;
}
function isEmptyRow(r) { return !r || r.every(v => v === '' || v === null || v === undefined); }
function signedBytes(buf) { return Array.from(buf, b => (b > 127 ? b - 256 : b)); }
function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  return Buffer.from((data || []).map(b => (b < 0 ? b + 256 : b)));
}

/* ───────────── 시트 ───────────── */

class Range {
  constructor(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  async getValues() {
    const data = await this.sheet._data();
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = data[this.r - 1 + i] || [];
      const o = [];
      for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined || v === null ? '' : v); }
      out.push(o);
    }
    return out;
  }
  async getValue() { return (await this.getValues())[0][0]; }
  async setValues(vals) { return this.sheet._write(this.r, this.c, vals); }
  async setValue(v) { return this.sheet._write(this.r, this.c, [[v]]); }
  async clearContent() {
    const blank = Array.from({ length: this.nr }, () => new Array(this.nc).fill(''));
    return this.sheet._write(this.r, this.c, blank);
  }
  getRow() { return this.r; }
  // 서식은 의미가 없으므로 무시하고 이어 쓸 수 있게 자기 자신을 돌려준다.
  setFontWeight() { return this; }
  setBackground() { return this; }
  setNumberFormat() { return this; }
  setWrap() { return this; }
  /** findRow_에서만 씀: 이 범위 첫 열에서 값이 정확히 같은 첫 칸 */
  createTextFinder(text) {
    const self = this;
    return {
      matchEntireCell() { return this; },
      findNext() {
        const data = self.sheet._mem;
        if (!data) throw new Error('createTextFinder 전에 시트를 읽어야 해요.');
        for (let i = 0; i < self.nr; i++) {
          const row = data[self.r - 1 + i];
          if (!row) continue;
          for (let j = 0; j < self.nc; j++) {
            const v = row[self.c - 1 + j];
            if (v !== undefined && v !== null && String(v) === String(text)) return new Range(self.sheet, self.r + i, self.c + j, 1, 1);
          }
        }
        return null;
      }
    };
  }
}

class Sheet {
  constructor(book, name) { this.book = book; this.name = name; this._mem = null; }
  getName() { return this.name; }
  getSheetId() { return this.name; }
  async _data() {
    if (this._mem) return this._mem;
    if (REF_SHEET.test(this.name)) {
      const hit = refCache.get(this.name);
      if (hit && Date.now() - hit.at < REF_TTL_MS) { this._mem = hit.data.map(r => r.slice()); return this._mem; }
    }
    const rows = await this.book.db.q('select idx, vals from gas_rows where sheet = $1 order by idx', [this.name]);
    const data = [];
    rows.forEach(r => { data[r.idx - 1] = toArray(r.vals); });
    for (let i = 0; i < data.length; i++) if (!data[i]) data[i] = [];
    this._mem = data;
    if (REF_SHEET.test(this.name)) refCache.set(this.name, { at: Date.now(), data: data.map(r => r.slice()) });
    return data;
  }
  _touched() { if (REF_SHEET.test(this.name)) refCache.delete(this.name); }
  async getLastRow() {
    const d = await this._data();
    for (let i = d.length - 1; i >= 0; i--) if (!isEmptyRow(d[i])) return i + 1;
    return 0;
  }
  async getLastColumn() {
    const d = await this._data();
    let m = 0;
    d.forEach(r => { for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== null && r[j] !== undefined) { if (j + 1 > m) m = j + 1; break; } });
    return m;
  }
  async getMaxRows() { return (await this.getLastRow()) + 1000; }
  async getMaxColumns() { return Math.max(26, (await this.getLastColumn()) + 10); }
  async insertRowsAfter() {}
  async insertColumnsAfter() {}
  async setFrozenRows() {}
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }

  /**
   * 칸 쓰기. 지금 알고 있는 마지막 행보다 뒤에 쓰는 것은 '덧붙이기'로 보고,
   * 다른 요청과 겹치지 않게 DB에서 행 번호를 새로 받아 넣는다(appendObjs_ 대비).
   */
  async _write(r, c, vals) {
    const data = await this._data();
    this._touched();
    // 저장된 행(빈 행 포함)보다 뒤에 쓰면 덧붙이기. 빈 행 자리에 다시 쓰는 것은 그 자리에 쓴다(시트와 같게).
    if (r > data.length && c === 1) {
      const idxs = await this.book._appendRows(this.name, vals);
      idxs.forEach((idx, i) => { data[idx - 1] = vals[i].slice(); });
      for (let i = 0; i < data.length; i++) if (!data[i]) data[i] = [];
      return;
    }
    const payload = vals.map((row, i) => [r + i, toObj(row, c - 1)]);
    await this.book.db.q(
      `insert into gas_rows (sheet, idx, vals)
       select $1, (e->>0)::int, e->1 from jsonb_array_elements($2::text::jsonb) e
       on conflict (sheet, idx) do update set vals = gas_rows.vals || excluded.vals`,
      [this.name, JSON.stringify(payload)]);
    vals.forEach((row, i) => {
      const k = r - 1 + i;
      if (!data[k]) data[k] = [];
      row.forEach((v, j) => { data[k][c - 1 + j] = v; });
    });
    for (let i = 0; i < data.length; i++) if (!data[i]) data[i] = [];
  }
  async appendRow(arr) {
    const data = await this._data();
    this._touched();
    const [idx] = await this.book._appendRows(this.name, [arr]);
    data[idx - 1] = arr.slice();
    for (let i = 0; i < data.length; i++) if (!data[i]) data[i] = [];
    return this;
  }
  async deleteRow(r) {
    const data = await this._data();
    this._touched();
    await this.book.db.tx(async q => {
      await q('delete from gas_rows where sheet = $1 and idx = $2', [this.name, r]);
      // 기본키가 겹치지 않게 음수로 옮겼다가 되돌린다.
      await q('update gas_rows set idx = -(idx - 1) where sheet = $1 and idx > $2', [this.name, r]);
      await q('update gas_rows set idx = -idx where sheet = $1 and idx < 0', [this.name]);
    });
    data.splice(r - 1, 1);
  }
  async clear() {
    await this._data();
    this._touched();
    await this.book.db.q('delete from gas_rows where sheet = $1', [this.name]);
    this._mem = [];
    return this;
  }
}

class Spreadsheet {
  constructor(db) { this.db = db; this.sheets = null; }
  getId() { return 'supabase'; }
  getName() { return '수학 오개념 진단'; }
  async _list() {
    if (!this.sheets) {
      const rows = await this.db.q('select name from gas_sheets order by created_at, name', []);
      this.sheets = new Map(rows.map(r => [r.name, new Sheet(this, r.name)]));
    }
    return this.sheets;
  }
  async getSheetByName(name) { return (await this._list()).get(name) || null; }
  async getSheets() { return Array.from((await this._list()).values()); }
  async insertSheet(name) {
    await this.db.q('insert into gas_sheets (name) values ($1) on conflict do nothing', [name]);
    const list = await this._list();
    if (!list.has(name)) list.set(name, new Sheet(this, name));
    return list.get(name);
  }
  /** 다른 요청이 바꿨을 수 있으니 메모리에 둔 시트 내용을 버린다. */
  invalidate() { if (this.sheets) this.sheets.forEach(s => { s._mem = null; }); }
  /** 여러 행을 한 번에, 겹치지 않는 새 행 번호로 넣는다(동시에 넣으면 다시 시도). */
  async _appendRows(name, rows) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const out = await this.db.q(
          `with base as (select coalesce(max(idx), 0) as m from gas_rows where sheet = $1)
           insert into gas_rows (sheet, idx, vals)
           select $1, base.m + e.ord, e.v from base, jsonb_array_elements($2::text::jsonb) with ordinality as e(v, ord)
           returning idx`,
          [name, JSON.stringify(rows.map(r => toObj(r, 0)))]);
        return out.map(o => o.idx).sort((a, b) => a - b);
      } catch (e) {
        if (!/duplicate key|unique/i.test(String(e.message))) throw e;
        await new Promise(r => setTimeout(r, 20 + Math.random() * 80));
      }
    }
    throw new Error('사용자가 많아 저장이 늦어지고 있어요. 다시 시도해 주세요.');
  }
}

/* ───────────── Utilities ───────────── */

function formatDate(d, tz, fmt) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).forEach(p => { parts[p.type] = p.value; });
  const hh = parts.hour === '24' ? '00' : parts.hour;
  const map = { yyyy: parts.year, yy: parts.year.slice(2), MM: parts.month, dd: parts.day, HH: hh, mm: parts.minute, ss: parts.second };
  return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, k => map[k]);
}

function parseCsv(s) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

function makeBlob(data, mime, name) {
  const buf = toBuffer(data);
  return {
    getBytes: async () => signedBytes(buf), getContentType: () => mime || 'application/octet-stream',
    getName: () => name || '', getDataAsString: async () => buf.toString('utf8'), _buf: buf
  };
}

const Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
  Charset: { UTF_8: 'utf8' },
  getUuid: () => crypto.randomUUID(),
  formatDate,
  computeDigest: (alg, s) => signedBytes(crypto.createHash(alg).update(String(s), 'utf8').digest()),
  base64Encode: (b) => toBuffer(b).toString('base64'),
  base64EncodeWebSafe: (b) => toBuffer(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
  base64Decode: (s) => signedBytes(Buffer.from(String(s), 'base64')),
  newBlob: (data, mime, name) => makeBlob(data, mime, name),
  parseCsv,
  sleep: (ms) => new Promise(r => setTimeout(r, ms))
};

/* ───────────── 시스템 표 보기(교사 '데이터 보기' 탭, 읽기 전용) ───────────── */

// 비밀값은 내보내지 않는다: 속성 값(API 키·PEPPER 등)과 로그인 세션 토큰은 가린다.
const SECRET_PROP = /^(APIKEY_|PEPPER)|KEY|SECRET|TOKEN|PASS/i;
const VIEW_TABLES = {
  gas_sheets: { desc: '시트 목록', cols: ['name', 'created_at'], order: 'created_at, name' },
  gas_props: { desc: '스크립트 속성(API 키 등 비밀값은 가림)', cols: ['k', 'v'], order: 'k',
    mask: r => ({ k: r.k, v: SECRET_PROP.test(r.k) ? '(숨김 · ' + String(r.v || '').length + '자)' : r.v }) },
  gas_cache: { desc: '캐시(로그인 세션·로그인 시도 제한 등, 세션 토큰은 가림)', cols: ['k', 'v', 'exp'], order: 'exp desc',
    mask: r => ({ k: /^S:/.test(r.k) ? 'S:' + r.k.slice(2, 6) + '…(세션)' : r.k, v: r.v, exp: r.exp }) },
  gas_locks: { desc: '동시 실행 잠금', cols: ['name', 'owner', 'exp'], order: 'name' },
  gas_folders: { desc: '파일 폴더', cols: ['path'], order: 'path' },
  gas_files: { desc: '저장된 파일(풀이 사진·문제 이미지·자료 CSV)', cols: ['id', 'folder', 'name', 'mime', 'size', 'created_at'], order: 'folder, name' }
};
function viewCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  return typeof v === 'object' ? JSON.stringify(v) : v;
}
function makeDbView(db) {
  return {
    async listTables() {
      const out = [];
      for (const name of Object.keys(VIEW_TABLES)) {
        const r = await db.q('select count(*)::int n from ' + name, []);
        out.push({ name, rows: r[0].n, desc: VIEW_TABLES[name].desc });
      }
      return out;
    },
    async readTable(name, opt) {
      const t = VIEW_TABLES[name];
      if (!t) throw new Error('알 수 없는 표: ' + name);
      opt = opt || {};
      const offset = Math.max(0, parseInt(opt.offset, 10) || 0), limit = Math.min(200, Math.max(1, parseInt(opt.limit, 10) || 50));
      const q = String(opt.q || '').trim();
      // 검색은 가리기 전 값이 아니라 보이는 칸에서만 하도록 비밀 칸은 검색 대상에서 뺀다.
      const searchCols = name === 'gas_props' ? ['k'] : (name === 'gas_cache' ? ['v'] : t.cols);
      const where = q ? ' where (' + searchCols.map(c => c + '::text').join(" || ' ' || ") + ') ilike $1' : '';
      const params = q ? ['%' + q.replace(/[%_\\]/g, m => '\\' + m) + '%'] : [];
      const total = (await db.q('select count(*)::int n from ' + name + where, params))[0].n;
      const rows = await db.q('select ' + t.cols.join(', ') + ' from ' + name + where + ' order by ' + t.order + ' limit ' + limit + ' offset ' + offset, params);
      return {
        columns: t.cols, total, offset, limit,
        rows: rows.map((r, i) => { const m = t.mask ? t.mask(r) : r; return { n: offset + i + 1, cells: t.cols.map(c => viewCell(m[c])) }; })
      };
    }
  };
}

/* ───────────── Drive (Supabase Storage) ───────────── */

function iter(list) { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; }

function makeDrive(db, storage, deps) {
  function file(row) {
    return {
      getId: () => row.id, getName: () => row.name, getUrl: () => '', setSharing: async () => {},
      getBlob: async () => { const o = await storage.get(row.id); return makeBlob(o.bytes, row.mime || o.mime, row.name); }
    };
  }
  function folder(path) {
    const name = path.split('/').pop();
    return {
      getId: () => 'dir:' + path, getName: () => name, setSharing: async () => {},
      createFolder: async (n) => { await db.q('insert into gas_folders (path) values ($1) on conflict do nothing', [path + '/' + n]); return folder(path + '/' + n); },
      getFoldersByName: async (n) => {
        const r = await db.q('select path from gas_folders where path = $1', [path + '/' + n]);
        return iter(r.map(x => folder(x.path)));
      },
      createFile: async (blob) => {
        const mime = blob.getContentType(), nm = blob.getName() || crypto.randomUUID();
        const id = (deps.newFileId && deps.newFileId(nm)) || crypto.randomUUID();
        await storage.put(id, blob._buf || toBuffer(await blob.getBytes()), mime);
        await db.q('insert into gas_files (id, folder, name, mime, size) values ($1, $2, $3, $4, $5)', [id, path, nm, mime, (blob._buf || []).length]);
        return file({ id, name: nm, mime });
      },
      getFiles: async () => {
        const r = await db.q('select id, name, mime from gas_files where folder = $1 order by name', [path]);
        return iter(r.map(file));
      }
    };
  }
  return {
    Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' },
    createFolder: async (n) => { await db.q('insert into gas_folders (path) values ($1) on conflict do nothing', [n]); return folder(n); },
    getFolderById: async (id) => {
      const path = String(id).replace(/^dir:/, '');
      const r = await db.q('select path from gas_folders where path = $1', [path]);
      if (!r.length) throw new Error('폴더를 찾을 수 없어요: ' + id);
      return folder(path);
    },
    getFoldersByName: async (n) => {
      const r = await db.q("select path from gas_folders where path = $1 or path like '%/' || $1", [n]);
      return iter(r.map(x => folder(x.path)));
    },
    getFilesByName: async (n) => iter((await db.q('select id, name, mime from gas_files where name = $1', [n])).map(file)),
    getFileById: async (id) => {
      const r = await db.q('select id, name, mime from gas_files where id = $1', [String(id)]);
      if (!r.length) throw new Error('파일을 찾을 수 없어요: ' + id);
      return file(r[0]);
    }
  };
}

/* ───────────── 서비스 묶음 ───────────── */

/**
 * deps: { db: {q(text, params) → rows, tx(async q => …)}, storage: {put(key, buf, mime), get(key) → {bytes, mime}}, fetch }
 */
function createServices(deps) {
  const db = deps.db;
  const book = new Spreadsheet(db);
  const owner = crypto.randomUUID();

  const props = {
    _all: null,
    async _load() { if (!this._all) { this._all = {}; (await db.q('select k, v from gas_props', [])).forEach(r => { this._all[r.k] = r.v; }); } return this._all; },
    async getProperty(k) { const a = await this._load(); return Object.prototype.hasOwnProperty.call(a, k) ? a[k] : null; },
    async setProperty(k, v) { await db.q('insert into gas_props (k, v) values ($1, $2) on conflict (k) do update set v = excluded.v', [k, String(v)]); (await this._load())[k] = String(v); return this; },
    async deleteProperty(k) { await db.q('delete from gas_props where k = $1', [k]); delete (await this._load())[k]; return this; },
    async getProperties() { return Object.assign({}, await this._load()); }
  };
  const cache = {
    async get(k) { const r = await db.q('select v from gas_cache where k = $1 and exp > now()', [k]); return r.length ? r[0].v : null; },
    async put(k, v, ttl) {
      const sec = Math.min(Number(ttl) || 600, 21600);
      await db.q("insert into gas_cache (k, v, exp) values ($1, $2, now() + ($3 || ' seconds')::interval) on conflict (k) do update set v = excluded.v, exp = excluded.exp", [k, String(v), String(sec)]);
    },
    async remove(k) { await db.q('delete from gas_cache where k = $1', [k]); }
  };
  const lock = {
    held: false,
    async tryLock(ms) {
      const until = Date.now() + (Number(ms) || 0);
      do {
        const r = await db.q(
          `insert into gas_locks (name, owner, exp) values ('script', $1, now() + interval '30 seconds')
           on conflict (name) do update set owner = excluded.owner, exp = excluded.exp where gas_locks.exp < now()
           returning owner`, [owner]);
        if (r.length && r[0].owner === owner) { this.held = true; book.invalidate(); return true; }
        await new Promise(res => setTimeout(res, 80 + Math.random() * 120));
      } while (Date.now() < until);
      return false;
    },
    async waitLock(ms) { if (!(await this.tryLock(ms))) throw new Error('Lock timeout: 다른 작업이 끝나기를 기다리다 시간이 지났어요.'); },
    async releaseLock() { if (this.held) { await db.q("delete from gas_locks where name = 'script' and owner = $1", [owner]); this.held = false; } },
    hasLock() { return this.held; }
  };
  const fetchImpl = deps.fetch || fetch;
  const UrlFetchApp = {
    async fetch(url, opt) {
      opt = opt || {};
      const headers = Object.assign({}, opt.headers || {});
      if (opt.contentType) headers['Content-Type'] = opt.contentType;
      const res = await fetchImpl(url, { method: (opt.method || 'get').toUpperCase(), headers, body: opt.payload });
      const text = await res.text();
      book.invalidate(); // AI 응답을 기다리는 동안 다른 요청이 시트를 바꿨을 수 있다.
      return { getResponseCode: () => res.status, getContentText: () => text, getHeaders: () => Object.fromEntries(res.headers.entries()) };
    }
  };

  return {
    SpreadsheetApp: {
      getActiveSpreadsheet: async () => book, openById: async () => book,
      getUi: () => { throw new Error('UI 없음'); }
    },
    PropertiesService: { getScriptProperties: () => props },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => lock },
    DriveApp: makeDrive(db, deps.storage, deps),
    UrlFetchApp,
    Utilities,
    Session: {
      getActiveUser: () => ({ getEmail: () => deps.adminEmail || '' }),
      getEffectiveUser: () => ({ getEmail: () => deps.adminEmail || 'server' }),
      getScriptTimeZone: () => TZ
    },
    DbView: makeDbView(db),
    HtmlService: {}, ScriptApp: { getService: () => ({ getUrl: () => deps.appUrl || '' }) },
    _book: book, _lock: lock
  };
}

module.exports = { createServices, formatDate, parseCsv, refCache };
