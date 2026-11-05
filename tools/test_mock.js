// 비동기로 바꾼 서버 코드를 기존 모의 Google 서비스(mock_gas.js)와 시나리오(scenario.js)로 검사한다.
// 사용: node tools/test_mock.js [fixtures.json 경로]
const fs = require('fs'), path = require('path'), vm = require('vm');
const { transform, HELPERS } = require('./gas2async');
const gasDir = path.join(__dirname, '..', 'test');
const asyncNames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lib', 'async-names.json'), 'utf8'));
const scenario = fs.readFileSync(path.join(gasDir, 'scenario.js'), 'utf8');
const t = transform(scenario, { extraAsync: asyncNames, topLevelAsync: true, hofParams: false });
if (t.warnings.length) { console.error(t.warnings.join('\n')); process.exit(1); }
const fixtures = process.argv[2] || path.join(gasDir, 'fixtures.json');
const ctx = { console, print: (...a) => console.log(...a), std: { loadFile: () => fs.readFileSync(fixtures, 'utf8') } };
vm.createContext(ctx);
const server = fs.readFileSync(path.join(__dirname, '..', 'lib', 'server-async.js'), 'utf8');
const all = fs.readFileSync(path.join(gasDir, 'mock_gas.js'), 'utf8') + '\n;\n' + server +
  '\n;\n(async function () {\n' + t.code + '\n})().catch(function (e) { print("시나리오 오류: " + (e && e.stack || e)); });';
vm.runInContext(all, ctx, { filename: 'mock-async.js' });
