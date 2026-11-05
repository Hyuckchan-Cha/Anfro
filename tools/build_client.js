// 화면 파일(src/client/core.js 등)을 합쳐 public/index.html을 만든다(Apps Script용 Index.html과 같은 내용, 첫 화면 정보만 서버에서 받음).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src', 'client');
const order = ['core.js', 'math.js', 'figure.js', 'report.js', 'login.js', 'student.js', 'teacher.js'];
const js = order.map(f => fs.readFileSync(path.join(dir, f), 'utf8').trimEnd()).join('\n\n');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'index.template.html'), 'utf8');
html = html.replace('/*@@CSS@@*/', () => css).replace('/*@@JS@@*/', () => js).replace('/*@@BOOT@@*/', () => 'null').replace('<!--@@MOCK@@-->', '');
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">\n<title>수학 오개념 진단 도우미</title>');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'index.html'), html);
console.log('public/index.html', html.length, 'chars');
