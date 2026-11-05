/**
 * 요청마다 새 실행 공간(vm 컨텍스트)에서 서버 코드를 돌린다.
 * Apps Script처럼 요청 사이에 전역 변수(_memo 등)가 섞이지 않게 하기 위함이다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createServices } = require('./gas-shim');

const code = fs.readFileSync(path.join(__dirname, 'server-async.js'), 'utf8');
const script = new vm.Script(code, { filename: 'server-async.js' });

/** 브라우저에서 부를 수 있는 함수: api_로 시작하는 것과 첫 화면 정보 */
function isPublic(name) { return /^api_[A-Za-z0-9]+$/.test(name) || name === 'bootConfig_'; }

async function run(fnName, args, deps) {
  const services = createServices(deps);
  const ctx = vm.createContext(Object.assign({ console }, services));
  script.runInContext(ctx);
  const f = ctx[fnName];
  if (typeof f !== 'function') throw new Error('알 수 없는 요청: ' + fnName);
  return await f.apply(null, args || []);
}

module.exports = { run, isPublic };
