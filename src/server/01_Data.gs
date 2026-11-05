/* ===================== 시트·데이터 공통 도구 ===================== */

var _memo = {};
function memo_(key, fn) {
  if (!Object.prototype.hasOwnProperty.call(_memo, key)) _memo[key] = fn();
  return _memo[key];
}
function forget_(key) { delete _memo[key]; }

function ss_() {
  return memo_('ss', function () {
    var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
    if (id) {
      try { return SpreadsheetApp.openById(id); } catch (e) { /* 아래로 */ }
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. 스프레드시트의 [확장 프로그램 > Apps Script]에서 초기 설정을 먼저 실행해 주세요.');
    return ss;
  });
}

function sheet_(name, optional) {
  var sh = ss_().getSheetByName(name);
  if (!sh && !optional) throw new Error("'" + name + "' 시트가 없어요. 스프레드시트 메뉴 [오개념진단 > ① 초기 설정]을 실행해 주세요.");
  return sh;
}

function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function newId_(prefix) {
  return prefix + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function str_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  var s = String(v);
  if (s.charAt(0) === ZWSP) s = s.slice(1);
  return s === 'nan' ? '' : s;
}
function num_(v, def) {
  var n = parseFloat(v);
  return isNaN(n) ? (def === undefined ? 0 : def) : n;
}

/** 시트에서 읽은 값을 클라이언트로 보낼 수 있는 값으로 */
function plain_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  if (typeof v === 'string' && v.charAt(0) === ZWSP) return v.slice(1);
  return v;
}

/** 시트에 쓸 값: 수식·숫자·날짜로 바뀔 수 있는 문자열은 보이지 않는 표시를 붙여 글자로 저장 */
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Y' : 'N';
  if (typeof v === 'number' || v instanceof Date) return v;
  if (typeof v === 'object') v = JSON.stringify(v);
  var s = String(v);
  if (s.length > 49000) s = s.slice(0, 49000);
  if (s && (/^[=+\-@']/.test(s) || /^[\d\s.,\/:()%\-]+$/.test(s) || /^(true|false)$/i.test(s))) {
    // 순수 숫자는 그대로 둠 (예: "12", "0.5")
    if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s)) return Number(s);
    return ZWSP + s;
  }
  return s;
}

function parseJson_(s, def) {
  if (s === null || s === undefined || s === '') return def;
  if (typeof s === 'object') return s;
  try { return JSON.parse(str_(s)); } catch (e) { return def; }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function headers_(name) {
  return memo_('hdr:' + name, function () {
    var sh = sheet_(name);
    var lc = sh.getLastColumn();
    if (lc < 1) return [];
    return sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  });
}

/** 시트 전체를 객체 배열로 (1행 = 머리글) */
function rows_(name) {
  var sh = sheet_(name);
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return [];
  var values = sh.getRange(1, 1, lr, lc).getValues();
  var hdr = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row[0] === '' || row[0] === null) continue;
    var o = { _row: r + 1 };
    for (var c = 0; c < hdr.length; c++) if (hdr[c]) o[hdr[c]] = plain_(row[c]);
    out.push(o);
  }
  return out;
}

function appendObj_(name, obj) {
  var hdr = headers_(name);
  var row = hdr.map(function (h) { return cell_(obj[h]); });
  sheet_(name).appendRow(row);
  return obj;
}

function appendObjs_(name, objs) {
  if (!objs.length) return;
  var hdr = headers_(name);
  var sh = sheet_(name);
  var rows = objs.map(function (o) { return hdr.map(function (h) { return cell_(o[h]); }); });
  var start = sh.getLastRow() + 1;
  var need = start + rows.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  sh.getRange(start, 1, rows.length, hdr.length).setValues(rows);
}

/** A열에서 key가 있는 행 번호 (없으면 -1) */
function findRow_(name, key, startRow) {
  var sh = sheet_(name);
  var s = startRow || 2;
  var lr = sh.getLastRow();
  if (lr < s) return -1;
  var f = sh.getRange(s, 1, lr - s + 1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
  return f ? f.getRow() : -1;
}

function getObj_(name, key) {
  var r = findRow_(name, key);
  if (r < 0) return null;
  var hdr = headers_(name);
  var vals = sheet_(name).getRange(r, 1, 1, hdr.length).getValues()[0];
  var o = { _row: r };
  for (var c = 0; c < hdr.length; c++) if (hdr[c]) o[hdr[c]] = plain_(vals[c]);
  return o;
}

/** key(A열 값) 또는 행 번호로 찾은 행의 일부 칸만 바꾼다 */
function updateObj_(name, keyOrRow, patch) {
  var r = (typeof keyOrRow === 'number') ? keyOrRow : findRow_(name, keyOrRow);
  if (r < 0) throw new Error(name + ' 시트에서 ' + keyOrRow + '을(를) 찾지 못했어요.');
  var hdr = headers_(name);
  var sh = sheet_(name);
  Object.keys(patch).forEach(function (k) {
    var c = hdr.indexOf(k);
    if (c >= 0) sh.getRange(r, c + 1).setValue(cell_(patch[k]));
  });
  return r;
}

/* ---------- 설정 ---------- */
function settings_() {
  return memo_('settings', function () {
    var m = {};
    DEFAULT_SETTINGS.forEach(function (r) { m[r[0]] = r[1]; });
    var sh = sheet_(SH.CONFIG, true);
    if (sh && sh.getLastRow() >= 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
        var k = String(r[0]).trim();
        if (k) m[k] = str_(r[1]).trim();
      });
    }
    // 예전 기본 학교명(시연용)은 새 이름으로 보여 준다(설정 시트를 직접 고치지 않아도 되게).
    if (/^\(가상\)\s*미래중학교$/.test(m['학교명'] || '')) m['학교명'] = '물개중학교';
    return m;
  });
}
function setting_(key) { var s = settings_(); return s[key] === undefined ? '' : s[key]; }
function settingNum_(key, def) { return num_(setting_(key), def); }
function setSetting_(key, value) {
  var sh = sheet_(SH.CONFIG);
  var r = findRow_(SH.CONFIG, key);
  if (r < 0) sh.appendRow([key, cell_(value), '']);
  else sh.getRange(r, 2).setValue(cell_(value));
  forget_('settings');
}

function classList_() {
  return String(setting_('반목록') || '1,2,3,4,5').split(',').map(function (x) { return x.trim(); }).filter(String);
}
function classLabel_(cls) { return (setting_('학년') || '3') + '학년 ' + cls + '반'; }
function splitList_(s) { return String(s || '').split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(String); }

/* ---------- 응답 포장 ---------- */
function userError_(msg, code) {
  var e = new Error(msg);
  e.user = true;
  e.code = code || 'USER';
  return e;
}
function wrap_(fn) {
  try {
    var data = fn();
    return { ok: true, data: data === undefined ? null : JSON.parse(JSON.stringify(data)) };
  } catch (e) {
    var msg = (e && e.message) ? e.message : String(e);
    var code = (e && e.code) ? e.code : 'ERR';
    if (code === 'ERR') console.error(e && e.stack ? e.stack : msg);
    if (code === 'ERR' && /Service invoked too many times|Exceeded maximum execution time|Lock timeout|시간 초과/.test(msg)) {
      msg = '사용자가 많아 잠시 처리가 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';
    }
    return { ok: false, error: msg, code: code };
  }
}
