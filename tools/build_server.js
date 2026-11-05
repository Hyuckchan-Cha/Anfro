// src/server의 00~15 .gs 파일을 합쳐 비동기 코드로 바꿔 lib/server-async.js로 저장한다.
const fs = require('fs'), path = require('path');
const { transform, HELPERS } = require('./gas2async');
const gasDir = path.join(__dirname, '..', 'src', 'server');
const files = fs.readdirSync(gasDir).filter(f => /^\d\d_.*\.gs$/.test(f)).sort();
const src = files.map(f => fs.readFileSync(path.join(gasDir, f), 'utf8')).join('\n;\n');
const r = transform(src, { hofNames: ['memo_', 'wrap_', 'withLock_'] });
if (r.warnings.length) { console.error('변환 경고:\n' + r.warnings.join('\n')); process.exit(1); }
const out = '/* 자동 생성 파일: ../*.gs를 tools/build_server.js가 비동기 코드로 바꾼 것. 직접 고치지 마세요. */\n' + HELPERS + '\n' + r.code;
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'server-async.js'), out);
fs.writeFileSync(path.join(__dirname, '..', 'lib', 'async-names.json'), JSON.stringify(r.asyncNames));
console.log('server-async.js', files.length, 'files →', r.asyncFnCount, 'async functions,', out.length, 'chars');
