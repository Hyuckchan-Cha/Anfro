/**
 * Apps Script(동기) 코드를 Node(비동기) 코드로 바꾼다.
 * - I/O(시트·Drive·HTTP·캐시·잠금·속성)를 직접 또는 간접으로 부르는 함수를 async로 만들고, 그 호출 앞에 await를 붙인다.
 * - 그런 호출을 담은 배열 콜백(forEach/map/filter/some/every/find)은 순서대로 기다리는 도우미(__aForEach 등)로 바꾼다.
 * - memo_/wrap_/withLock_처럼 넘겨받은 함수를 부르는 도우미는 그 호출도 기다린다.
 * 사용: const { transform } = require('./gas2async'); transform(src, { extraAsync: [...] })
 */
const acorn = require('acorn');
const walk = require('acorn-walk');

const GAS_GLOBALS = new Set(['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'DriveApp', 'UrlFetchApp']);
// 이 이름의 메서드 호출은 기다린다(동기 값이어도 await은 해가 없다).
const ASYNC_METHODS = new Set([
  'getActiveSpreadsheet', 'openById', 'getSheetByName', 'insertSheet', 'getSheets', 'deleteSheet',
  'getValues', 'getValue', 'setValues', 'setValue', 'clearContent', 'clear', 'appendRow', 'deleteRow',
  'getLastRow', 'getLastColumn', 'getMaxRows', 'getMaxColumns', 'insertRowsAfter', 'insertColumnsAfter',
  'getProperty', 'setProperty', 'deleteProperty', 'getProperties',
  'waitLock', 'tryLock', 'releaseLock',
  'getFileById', 'getFolderById', 'getFoldersByName', 'getFilesByName', 'getFiles', 'getFolders', 'createFile', 'createFolder',
  'getBlob', 'getBytes', 'getDataAsString', 'setSharing', 'fetch', 'sleep',
  'listTables', 'readTable' // DbView(Node 전용: 시스템 표 보기)
]);
// 캐시 get/put/remove는 이름이 흔해서, 받는 쪽이 캐시 객체일 때만 기다린다.
const CACHE_METHODS = new Set(['get', 'put', 'remove', 'getAll', 'putAll']);
const ARRAY_METHODS = { forEach: '__aForEach', map: '__aMap', filter: '__aFilter', some: '__aSome', every: '__aEvery', find: '__aFind' };
const HOF_PARAM_CALLS = new Set(['fn']); // memo_(key, fn), wrap_(fn), withLock_(fn)

function isFn(n) { return n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression'; }

function transform(src, opts) {
  opts = opts || {};
  const ast = acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: !!opts.topLevelAsync, allowReturnOutsideFunction: true });

  // 1) 함수 노드와 부모 함수 연결
  const fnNodes = [];
  const parentFn = new Map();
  (function visit(node, cur) {
    if (!node || typeof node.type !== 'string') return;
    if (isFn(node)) { fnNodes.push(node); parentFn.set(node, cur); cur = node; }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && visit(c, cur));
      else if (v && typeof v.type === 'string' && k !== 'type') visit(v, cur);
    }
  })(ast, null);
  const declByName = {};
  fnNodes.forEach(f => { if (f.type === 'FunctionDeclaration') declByName[f.id.name] = f; });
  const cacheVars = new Set(['cache', 'c']);

  // 2) 각 함수 안(중첩 함수 제외)의 호출 목록
  const ownCalls = new Map();
  fnNodes.forEach(f => ownCalls.set(f, []));
  ownCalls.set(null, []);
  walk.ancestor(ast, {
    CallExpression(node, ancestors) {
      let owner = null;
      for (let i = ancestors.length - 2; i >= 0; i--) if (isFn(ancestors[i])) { owner = ancestors[i]; break; }
      ownCalls.get(owner).push(node);
    }
  });

  const asyncDecl = new Set(opts.extraAsync || []);
  function callTriggers(call) {
    const c = call.callee;
    if (c.type === 'Identifier') return asyncDecl.has(c.name) || (HOF_PARAM_CALLS.has(c.name) && opts.hofParams !== false);
    if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
      const p = c.property.name;
      if (ASYNC_METHODS.has(p)) return true;
      if (CACHE_METHODS.has(p)) {
        const o = c.object;
        if (o.type === 'CallExpression' && o.callee.type === 'MemberExpression' && o.callee.property.name === 'getScriptCache') return true;
        if (o.type === 'Identifier' && cacheVars.has(o.name)) return true;
      }
      // 객체 메서드로 넘긴 비동기 함수(예: obj.handler())는 없다고 본다
    }
    return false;
  }
  function usesGasGlobal(f) {
    let hit = false;
    walk.full(f.body, n => { if (n.type === 'Identifier' && GAS_GLOBALS.has(n.name)) hit = true; });
    return hit;
  }

  // 3) 고정점: 비동기 호출을 담은 함수는 async (선언 함수는 이름으로 전파)
  const asyncFns = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of fnNodes) {
      if (asyncFns.has(f)) continue;
      const own = ownCalls.get(f);
      const needs = own.some(callTriggers) || (f.type === 'FunctionDeclaration' && asyncDecl.has(f.id.name)) ||
        (f.type === 'FunctionDeclaration' && (opts.hofNames || []).includes(f.id.name));
      // 배열 콜백이 async가 되면 그 배열 호출을 담은 함수도 async
      const arrayHit = own.some(call => isConvertedArrayCall(call));
      if (needs || arrayHit) {
        asyncFns.add(f); changed = true;
        if (f.type === 'FunctionDeclaration') asyncDecl.add(f.id.name);
      }
    }
  }
  function isConvertedArrayCall(call) {
    const c = call.callee;
    if (c.type !== 'MemberExpression' || c.computed || !ARRAY_METHODS[c.property.name]) return false;
    const cb = call.arguments[0];
    return cb && isFn(cb) && asyncFns.has(cb);
  }
  // 함수 표현식이 async인데 배열 메서드/알려진 도우미의 인자가 아니면 경고(놓친 경우 확인용)
  const warnings = [];

  // 4) 편집 목록
  const edits = []; // {pos, text, kind:'open'|'close'|'ins', size} 또는 {start,end,text,kind:'rep'}
  function wrapAwait(call) {
    const size = call.end - call.start;
    edits.push({ pos: call.start, text: '(await ', kind: 'open', size });
    edits.push({ pos: call.end, text: ')', kind: 'close', size });
  }
  for (const f of asyncFns) {
    if (f.async) continue;
    edits.push({ pos: f.start, text: 'async ', kind: 'ins', size: 0 });
  }
  const topAsync = !!opts.topLevelAsync;
  for (const [owner, calls] of ownCalls) {
    const ownerAsync = owner ? asyncFns.has(owner) : topAsync;
    for (const call of calls) {
      if (isConvertedArrayCall(call)) {
        if (!ownerAsync) warnings.push('async 콜백을 담은 배열 호출이 동기 함수 안에 있음 @' + call.start);
        const c = call.callee;
        const size = call.end - call.start;
        edits.push({ pos: call.start, text: '(await ' + ARRAY_METHODS[c.property.name] + '(', kind: 'open', size });
        // 괄호로 감싼 배열((a || b).map)은 object 노드 끝이 ')' 앞이라, 메서드 이름 앞의 '.'부터 바꾼다.
        let dot = c.property.start - 1;
        while (dot > c.object.end && src[dot] !== '.') dot--;
        edits.push({ start: dot, end: call.arguments[0].start, text: ', ', kind: 'rep' });
        edits.push({ pos: call.end, text: ')', kind: 'close', size });
        continue;
      }
      if (callTriggers(call)) {
        if (!ownerAsync) { warnings.push('동기 함수 안의 비동기 호출 @' + call.start + ' ' + src.slice(call.start, Math.min(call.end, call.start + 60))); continue; }
        wrapAwait(call);
      }
    }
  }
  // 5) 뒤에서부터 적용
  edits.sort((a, b) => {
    const pa = a.kind === 'rep' ? a.start : a.pos, pb = b.kind === 'rep' ? b.start : b.pos;
    if (pa !== pb) return pb - pa;
    const rank = e => e.kind === 'rep' ? 0 : 1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    // 같은 위치: 여는 것은 작은 것부터(큰 것이 왼쪽에 남게), 닫는 것은 큰 것부터
    if (a.kind === 'open' && b.kind === 'open') return a.size - b.size;
    if (a.kind === 'close' && b.kind === 'close') return b.size - a.size;
    if (a.kind === 'ins') return 1;
    if (b.kind === 'ins') return -1;
    return 0;
  });
  let out = src;
  for (const e of edits) {
    if (e.kind === 'rep') out = out.slice(0, e.start) + e.text + out.slice(e.end);
    else out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  }
  return { code: out, asyncNames: [...asyncDecl], warnings, asyncFnCount: asyncFns.size };
}

const HELPERS = `
async function __aForEach(a, f) { for (var i = 0; i < a.length; i++) await f(a[i], i, a); }
async function __aMap(a, f) { var r = []; for (var i = 0; i < a.length; i++) r.push(await f(a[i], i, a)); return r; }
async function __aFilter(a, f) { var r = []; for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) r.push(a[i]); return r; }
async function __aSome(a, f) { for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) return true; return false; }
async function __aEvery(a, f) { for (var i = 0; i < a.length; i++) if (!(await f(a[i], i, a))) return false; return true; }
async function __aFind(a, f) { for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) return a[i]; return undefined; }
`;

module.exports = { transform, HELPERS };
