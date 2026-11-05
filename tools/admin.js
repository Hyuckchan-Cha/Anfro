/**
 * 관리 명령(예전 스프레드시트 메뉴를 대신함). Vercel 환경 변수(.env.local)로 Supabase에 연결한다.
 *   node tools/admin.js init          스키마·저장소 준비 → 기준 자료 CSV·문제 이미지 올리기 → ① 초기 설정
 *   node tools/admin.js setup         ① 초기 설정만 다시 실행(중복 정리 포함)
 *   node tools/admin.js demo          ② 가상 학습 로그 만들기
 *   node tools/admin.js clear-demo    가상 학습 로그 지우기
 *   node tools/admin.js solve-images  문제 정답 미리 만들기(남은 문항이 0이 될 때까지 반복 실행)
 *   node tools/admin.js rebuild       점수 다시 계산
 *   node tools/admin.js reimport [이름]  data/의 기준 자료 CSV를 다시 올리고 시트를 새로 채움
 *                                      (이름: 문항정보·개념목록·선후관계 중 하나, 생략하면 셋 다)
 * --local 을 붙이면 Supabase 대신 로컬 개발용 DB를 쓴다.
 */
const fs = require('fs'), path = require('path');
const loadEnv = require('./env');
const { run } = require('../lib/runtime');
const { createServices } = require('../lib/gas-shim');

const ROOT = path.join(__dirname, '..');
// 문제 이미지는 이미 Supabase에 올라가 있다. 다시 올릴 때만 쓰며, 기본값은 '물개와 가재/중3_문제이미지'.
const IMG_DIR = process.env.IMG_DIR || path.join(ROOT, '..', '..', '중3_문제이미지');
const CSV_DIR = path.join(ROOT, 'data');

async function deps(local) {
  if (local) return require('./local').localDeps();
  loadEnv();
  const { getDb } = require('../lib/db');
  const { supabaseStorage } = require('../lib/storage');
  return { db: getDb(), storage: supabaseStorage(), adminEmail: 'admin' };
}

async function uploadFolder(d, folderName, files, mimeOf) {
  const s = createServices(d);
  const existing = new Set((await d.db.q('select name from gas_files where folder = $1', [folderName])).map(r => r.name));
  const folder = await s.DriveApp.createFolder(folderName);
  let n = 0;
  for (const f of files) {
    // macOS·Drive가 한글 파일 이름을 자모 분리형(NFD)으로 줄 때가 있어, 서버가 찾는 이름(NFC)으로 맞춘다.
    const name = path.basename(f).normalize('NFC');
    if (existing.has(name)) continue;
    await folder.createFile(s.Utilities.newBlob(fs.readFileSync(f), mimeOf(name), name));
    if (++n % 50 === 0) console.log('  ' + folderName + ': ' + n + '개 올림…');
  }
  return n;
}

/** data/의 CSV로 저장소 파일을 바꾸고, 해당 기준 자료 시트를 지운 뒤 다시 가져온다. */
const REF_FILES = { '문항정보': ['오개념진단_문항정보.csv', '문항정보'], '개념목록': ['오개념진단_개념목록.csv', '개념목록'], '선후관계': ['오개념진단_선후관계.csv', '선수개념위계도'] };
async function reimport(d, which) {
  const keys = which ? [which] : Object.keys(REF_FILES);
  for (const k of keys) {
    const ref = REF_FILES[k];
    if (!ref) throw new Error('알 수 없는 자료: ' + k + ' (문항정보·개념목록·선후관계 중 하나)');
    const [file, sheet] = ref;
    const buf = fs.readFileSync(path.join(CSV_DIR, file));
    const rows = await d.db.q('select id from gas_files where name = $1', [file]);
    if (rows.length) {
      for (const r of rows) { await d.storage.put(r.id, buf, 'text/csv'); await d.db.q('update gas_files set size = $2 where id = $1', [r.id, buf.length]); }
    } else {
      await uploadFolder(d, '자료', [path.join(CSV_DIR, file)], () => 'text/csv');
    }
    await d.db.q('delete from gas_sheets where name = $1', [sheet]);
    console.log(file + ' 올림 → ' + sheet + ' 시트를 지우고 다시 가져와요.');
  }
  console.log((await run('importReferenceData_', [], d)).join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const local = args.includes('--local');
  const cmd = args.find(a => !a.startsWith('--')) || 'help';
  const d = await deps(local);
  if (cmd === 'init') {
    if (!local) await d.db.q(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'), []).catch(async () => {
      // 여러 문장은 하나씩 실행
      for (const stmt of fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8').split(/;\s*$/m).map(x => x.trim()).filter(Boolean)) await d.db.q(stmt, []);
    });
    await d.storage.ensureBucket();
    const csvs = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv')).map(f => path.join(CSV_DIR, f));
    console.log('기준 자료 CSV', await uploadFolder(d, '자료', csvs, () => 'text/csv'), '개 올림');
    if (fs.existsSync(IMG_DIR)) {
      const imgs = fs.readdirSync(IMG_DIR).filter(f => /^A\d{9}\.(png|jpe?g)$/i.test(f)).map(f => path.join(IMG_DIR, f));
      console.log('문제 이미지', await uploadFolder(d, '중3_문제이미지', imgs, n => /png$/i.test(n) ? 'image/png' : 'image/jpeg'), '개 올림 (전체 ' + imgs.length + ')');
    } else console.log('문제 이미지 폴더를 찾지 못했어요:', IMG_DIR);
    console.log(await run('setupAll_', [], d));
  } else if (cmd === 'setup') console.log(await run('setupAll_', [], d));
  else if (cmd === 'demo') console.log(await run('createDemoData_', [], d));
  else if (cmd === 'clear-demo') console.log(await run('clearDemoData_', [], d));
  else if (cmd === 'solve-images') console.log(await run('solveImagesBatch_', [], d));
  else if (cmd === 'rebuild') { await run('rebuildScores_', [], d); console.log('점수를 다시 계산했어요.'); }
  else if (cmd === 'reimport') await reimport(d, args.filter(a => !a.startsWith('--'))[1]);
  else { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); }
  process.exit(0);
}
main().catch(e => { console.error('오류:', e && e.message || e); process.exit(1); });
