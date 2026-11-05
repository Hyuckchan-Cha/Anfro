/**
 * 브라우저 → 서버 단일 창구. POST { fn: 'api_studentLogin', args: [...] } → 서버 함수의 반환값(JSON).
 * 예전 google.script.run.api_xxx(...) 호출을 그대로 대신한다.
 */
const { run, isPublic } = require('../lib/runtime');
const { getDb } = require('../lib/db');
const { supabaseStorage } = require('../lib/storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST만 받아요.' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const fn = String((body && body.fn) || '');
  const args = Array.isArray(body && body.args) ? body.args : [];
  if (!isPublic(fn)) { res.status(400).json({ ok: false, error: '허용되지 않은 요청이에요.' }); return; }
  try {
    const out = await run(fn, args, { db: getDb(), storage: supabaseStorage(), appUrl: 'https://' + (req.headers.host || '') });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(out === undefined ? null : out);
  } catch (e) {
    console.error(fn, e && e.stack || e);
    res.status(500).json({ ok: false, error: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.', code: 'ERR' });
  }
};
