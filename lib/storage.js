/** 파일 저장: 배포 환경은 Supabase Storage(비공개 버킷), 로컬 시험은 메모리. */
const BUCKET = process.env.SUPABASE_BUCKET || 'gas-files';

function supabaseStorage() {
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Supabase Storage 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 없어요.');
  const headers = { Authorization: 'Bearer ' + key, apikey: key };
  return {
    async put(id, buf, mime) {
      const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodeURIComponent(id)}`, {
        method: 'POST', headers: Object.assign({ 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' }, headers), body: buf
      });
      if (!r.ok) throw new Error('파일 저장 실패(' + r.status + '): ' + (await r.text()).slice(0, 200));
    },
    async get(id) {
      const r = await fetch(`${base}/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(id)}`, { headers });
      if (!r.ok) throw new Error('파일 읽기 실패(' + r.status + ')');
      return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || '' };
    },
    async ensureBucket() {
      const r = await fetch(`${base}/storage/v1/bucket`, {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
      });
      if (!r.ok && r.status !== 409 && !/already exists/i.test(await r.text())) throw new Error('버킷 만들기 실패(' + r.status + ')');
    }
  };
}

function memoryStorage() {
  const m = new Map();
  return {
    async put(id, buf, mime) { m.set(id, { bytes: Buffer.from(buf), mime }); },
    async get(id) { const o = m.get(id); if (!o) throw new Error('no file ' + id); return o; },
    async ensureBucket() {}
  };
}

/** 로컬 개발용: 폴더에 파일로 저장 */
function fileStorage(dir) {
  const fs = require('fs'), path = require('path');
  fs.mkdirSync(dir, { recursive: true });
  return {
    async put(id, buf, mime) { fs.writeFileSync(path.join(dir, id), Buffer.from(buf)); fs.writeFileSync(path.join(dir, id + '.mime'), mime || ''); },
    async get(id) { return { bytes: fs.readFileSync(path.join(dir, id)), mime: fs.readFileSync(path.join(dir, id + '.mime'), 'utf8') }; },
    async ensureBucket() {}
  };
}

module.exports = { supabaseStorage, memoryStorage, fileStorage, BUCKET };
