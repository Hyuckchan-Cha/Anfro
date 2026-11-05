// .env.local(vercel env pull로 받은 파일)을 읽어 process.env에 넣는다. 값은 화면에 출력하지 않는다.
const fs = require('fs'), path = require('path');
module.exports = function loadEnv(file) {
  // 비밀값이 든 파일은 공유 드라이브 폴더 밖에 둔다: ENV_FILE로 경로를 알려 준다(없으면 .env.local).
  const p = file || process.env.ENV_FILE || path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return false;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v.replace(/\\n/g, '\n');
  });
  return true;
};
