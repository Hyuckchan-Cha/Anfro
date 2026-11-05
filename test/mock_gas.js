// Google Apps Script 서비스 모의 객체 (QuickJS에서 서버 코드 흐름을 시험하기 위함)
var __sheets = {}, __order = [];
function MockRange(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
MockRange.prototype._chk = function () {
  if (this.r < 1 || this.c < 1 || this.r + this.nr - 1 > this.sh.maxRows || this.c + this.nc - 1 > this.sh.maxCols)
    throw new Error('범위 밖: ' + this.sh.name + ' r' + this.r + ' c' + this.c + ' ' + this.nr + 'x' + this.nc + ' (max ' + this.sh.maxRows + 'x' + this.sh.maxCols + ')');
};
MockRange.prototype.getValues = function () {
  this._chk();
  var out = [];
  for (var i = 0; i < this.nr; i++) {
    var row = this.sh.data[this.r - 1 + i] || [], o = [];
    for (var j = 0; j < this.nc; j++) { var v = row[this.c - 1 + j]; o.push(v === undefined ? '' : v); }
    out.push(o);
  }
  return out;
};
MockRange.prototype.getValue = function () { return this.getValues()[0][0]; };
MockRange.prototype.setValues = function (vals) {
  this._chk();
  if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues 크기 불일치 ' + this.sh.name + ' ' + vals.length + 'x' + vals[0].length + ' vs ' + this.nr + 'x' + this.nc);
  for (var i = 0; i < this.nr; i++) {
    var ri = this.r - 1 + i;
    while (this.sh.data.length <= ri) this.sh.data.push([]);
    for (var j = 0; j < this.nc; j++) {
      var v = vals[i][j];
      if (v !== '' && v !== null && typeof v === 'object' && !(v instanceof Date)) throw new Error('객체를 셀에 쓰려 함: ' + JSON.stringify(v));
      this.sh.data[ri][this.c - 1 + j] = v;
    }
  }
  return this;
};
MockRange.prototype.setValue = function (v) { return this.setValues([[v]]); };
MockRange.prototype.clearContent = function () { var e = []; for (var i = 0; i < this.nr; i++) { var r = []; for (var j = 0; j < this.nc; j++) r.push(''); e.push(r); } return this.setValues(e); };
MockRange.prototype.setFontWeight = function () { return this; };
MockRange.prototype.setBackground = function () { return this; };
MockRange.prototype.setNumberFormat = function () { return this; };
MockRange.prototype.getRow = function () { return this.r; };
MockRange.prototype.createTextFinder = function (text) {
  var self = this, whole = false;
  return {
    matchEntireCell: function (b) { whole = b; return this; },
    findNext: function () {
      var v = self.getValues();
      for (var i = 0; i < v.length; i++) for (var j = 0; j < v[i].length; j++) {
        var s = String(v[i][j]);
        if (whole ? s === String(text) : s.indexOf(String(text)) >= 0) return new MockRange(self.sh, self.r + i, self.c + j, 1, 1);
      }
      return null;
    }
  };
};
function MockSheet(name) { this.name = name; this.data = []; this.maxRows = 1000; this.maxCols = 26; }
MockSheet.prototype.getName = function () { return this.name; };
MockSheet.prototype.getLastRow = function () {
  for (var i = this.data.length - 1; i >= 0; i--) { var r = this.data[i]; if (r && r.some(function (v) { return v !== '' && v !== undefined && v !== null; })) return i + 1; }
  return 0;
};
MockSheet.prototype.getLastColumn = function () {
  var m = 0;
  this.data.forEach(function (r) { for (var j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== undefined && r[j] !== null) { m = Math.max(m, j + 1); break; } });
  return m;
};
MockSheet.prototype.getMaxRows = function () { return this.maxRows; };
MockSheet.prototype.getMaxColumns = function () { return this.maxCols; };
MockSheet.prototype.insertColumnsAfter = function (a, n) { this.maxCols += n; };
MockSheet.prototype.insertRowsAfter = function (a, n) { this.maxRows += n; };
MockSheet.prototype.getRange = function (r, c, nr, nc) { return new MockRange(this, r, c, nr, nc); };
MockSheet.prototype.appendRow = function (arr) {
  var r = this.getLastRow() + 1;
  if (r > this.maxRows) this.maxRows = r;
  if (arr.length > this.maxCols) this.maxCols = arr.length;
  this.getRange(r, 1, 1, arr.length).setValues([arr]);
};
MockSheet.prototype.deleteRow = function (r) { this.data.splice(r - 1, 1); };
MockSheet.prototype.setFrozenRows = function () { };
MockSheet.prototype.clear = function () { this.data = []; return this; };
var __ss = {
  getId: function () { return 'SSID'; },
  getSheetByName: function (n) { return __sheets[n] || null; },
  insertSheet: function (n) { var s = new MockSheet(n); __sheets[n] = s; __order.push(n); return s; },
  getSheets: function () { return __order.map(function (n) { return __sheets[n]; }); }
};
var SpreadsheetApp = { getActiveSpreadsheet: function () { return __ss; }, openById: function () { return __ss; }, getUi: function () { throw new Error('UI 없음'); } };
var __props = {};
var PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return __props[k] === undefined ? null : __props[k]; }, setProperty: function (k, v) { __props[k] = String(v); }, deleteProperty: function (k) { delete __props[k]; } }; } };
var __cache = {};
var CacheService = { getScriptCache: function () { return { get: function (k) { return __cache[k] === undefined ? null : __cache[k]; }, put: function (k, v) { __cache[k] = String(v); }, remove: function (k) { delete __cache[k]; } }; } };
var LockService = { getScriptLock: function () { return { waitLock: function () { }, releaseLock: function () { } }; } };
var __uuid = 0;
function __pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
var Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  getUuid: function () { __uuid++; return 'uuid-' + __pad(__uuid, 8) + '-' + Math.random().toString(16).slice(2, 10); },
  formatDate: function (d, tz, fmt) {
    var t = new Date(d.getTime() + 9 * 3600000);
    var m = { yyyy: t.getUTCFullYear(), yy: __pad(t.getUTCFullYear() % 100, 2), MM: __pad(t.getUTCMonth() + 1, 2), dd: __pad(t.getUTCDate(), 2), HH: __pad(t.getUTCHours(), 2), mm: __pad(t.getUTCMinutes(), 2), ss: __pad(t.getUTCSeconds(), 2) };
    return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, function (k) { return m[k]; });
  },
  computeDigest: function (alg, s) { var h1 = 2166136261, out = []; for (var r = 0; r < 32; r++) { for (var i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i) + r; h1 = Math.imul(h1, 16777619) >>> 0; } out.push((h1 & 255) - 128); } return out; },
  base64Encode: function (b) { if (typeof b === 'string') return 'B64' + b.length; return b.map(function (x) { return (x + 256) % 256; }).join('.').slice(0, 44); },
  base64Decode: function (s) { return [1, 2, 3]; },
  newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; },
  sleep: function () { }
};
var __files = {};
function __folder(id, name) {
  var subs = {};
  return {
    getId: function () { return id; }, setSharing: function () { },
    getFoldersByName: function (n) { var f = subs[n]; var done = !f; return { hasNext: function () { return !done; }, next: function () { done = true; return f; } }; },
    createFolder: function (n) { var f = __folder(id + '/' + n, n); subs[n] = f; return f; },
    createFile: function (blob) { var fid = 'F' + Object.keys(__files).length; __files[fid] = blob; return { getId: function () { return fid; }, getUrl: function () { return 'https://drive/' + fid; } }; }
  };
}
var __root = null;
var DriveApp = {
  Access: { PRIVATE: 'P' }, Permission: { NONE: 'N' },
  createFolder: function (n) { __root = __folder('ROOT', n); return __root; },
  getFolderById: function (id) { if (__root && id === 'ROOT') return __root; throw new Error('no folder'); },
  getFileById: function (id) { var b = __files[id]; if (!b) throw new Error('no file'); return { getBlob: function () { return { getContentType: function () { return b.mime; }, getBytes: function () { return [1, 2, 3]; } }; } }; },
  getFoldersByName: function (n) { var f = __namedFolders[n]; var done = !f; return { hasNext: function () { return !done; }, next: function () { done = true; return f; } }; }
};
// 문제 이미지 폴더 모의: __addProblemFolder('중3_문제이미지', ['A090001001', ...])
var __namedFolders = {};
function __addProblemFolder(name, codes) {
  var files = codes.map(function (c) { var id = 'PIMG-' + c; __files[id] = { mime: 'image/png', name: c + '.png' }; return { getName: function () { return c + '.png'; }, getId: function () { return id; } }; });
  files.push({ getName: function () { return '설명.txt'; }, getId: function () { return 'X'; } });
  __namedFolders[name] = { getFiles: function () { var i = 0; return { hasNext: function () { return i < files.length; }, next: function () { return files[i++]; } }; } };
}
var __llmLog = [], __tutorQueue = [], __analysisQueue = [], __lastReq = null, __notFound = {}, __rejectParams = false, __urlLog = [];
function __route(sys, user) {
  if (sys.indexOf('전사 도우미') >= 0) return { lines: [{ text: 'x^2-x-12=0', uncertain: false, reason: '' }, { text: '(x-3)(x+4)=0', uncertain: true, reason: '부호가 흐림' }, { text: 'x=3 또는 x=-4', uncertain: false }], unreadable: false };
  if (sys.indexOf('오류 분석 도우미') >= 0) return __analysisQueue.shift() || { is_correct: true, student_final_answer: 'ok', evidence_sufficient: true, errors: [] };
  if (sys.indexOf('출제 도우미') >= 0) return { problem: '다음을 계산하시오. $(x+2)(x+3)$ [생성' + __llmLog.length + ']', answer: '$x^2+5x+6$', steps: ['분배법칙', '동류항 정리'], type: '풀이분석', visual: '없음', figure: null };
  if (sys.indexOf('단계별 풀이를 만드는') >= 0) return { answer: '1', steps: ['a', 'b'] };
  if (sys.indexOf('문제 상황을 이해하지 못한') >= 0) return { title: '도움', explanation: '주어진 것은 $x$', figure: null, example: { problem: '예시 $1+1$', explanation: '설명' }, check_question: '무엇을 구하나요?' };
  if (sys.indexOf('1:1로 대화하는 수학 튜터') >= 0) {
    var nx = __tutorQueue.shift() || { reply: '좋아요, 다음은?', action: 'continue', step_index: 1, hint_level: 0, student_state: '부분이해' };
    if (nx === 'PREREQ') {
      var m = user.match(/\[선수개념 후보\][^\n]*\n(\d+) \|/);
      return { reply: '잠깐, 이 부분을 먼저 확인해 볼게요 \\frac', action: 'go_prereq', step_index: 0, hint_level: 1, student_state: '오개념', prereq_concept_id: m ? m[1] : null, prereq_reason: '테스트' };
    }
    return nx;
  }
  if (sys.indexOf('연결 확인용') >= 0) return { ok: true };
  if (sys.indexOf('짧은 학습 평가') >= 0) return { lines: ['$\\sqrt{3}$ 계산을 잘했어요.', '인수분해에서 부호를 헷갈렸어요.', '곱셈 공식을 다시 복습해 보세요.', '네 번째 줄은 버려요.'] };
  if (sys.indexOf('첨부한 문제 이미지를 읽고') >= 0) return { problem_text: '가로 7 cm, 세로 6 cm인 직사각형과 넓이가 같은 정사각형의 한 변의 길이는? [' + (user.match(/A\d{9}/) || [''])[0] + ']', choices: ['① √34 cm', '② 6 cm', '③ √38 cm', '④ √40 cm', '⑤ √42 cm'], answer_choice: '⑤', answer_value: '√42 cm', steps: ['직사각형 넓이 7×6=42', '정사각형 한 변 x, x²=42', 'x=√42'], figure_description: '', visual: '없음', type: '풀이분석' };
  throw new Error('알 수 없는 프롬프트: ' + sys.slice(0, 40));
}
var UrlFetchApp = {
  fetch: function (url, opt) {
    var body = JSON.parse(opt.payload);
    __lastReq = { url: url, body: body, headers: opt.headers };
    __urlLog.push(url);
    if (__notFound[url]) return { getResponseCode: function () { return 404; }, getContentText: function () { return '{"error":{"message":"Not found"}}'; } };
    if (__rejectParams && (body.reasoning_effort || body.response_format)) return { getResponseCode: function () { return 400; }, getContentText: function () { return '{"error":{"message":"Unrecognized request argument supplied: reasoning_effort"}}'; } };
    var sys = body.messages[0].content;
    var u = body.messages[1].content;
    var user = typeof u === 'string' ? u : u[0].text;
    var obj = __route(sys, user);
    __llmLog.push({ sys: sys.slice(0, 20), user: user });
    var txt = JSON.stringify(obj);
    if (__llmLog.length === 3) txt = txt.replace('\\\\frac', '\\frac');
    return { getResponseCode: function () { return 200; }, getContentText: function () { return JSON.stringify({ choices: [{ message: { content: txt }, finish_reason: 'stop' }] }); } };
  }
};
var console = { log: function () { }, error: function (m) { print('  [console.error] ' + String(m).slice(0, 300)); } };
var HtmlService = {}; var ScriptApp = {};
