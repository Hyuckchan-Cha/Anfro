/* 자동 생성 파일: ../*.gs를 tools/build_server.js가 비동기 코드로 바꾼 것. 직접 고치지 마세요. */

async function __aForEach(a, f) { for (var i = 0; i < a.length; i++) await f(a[i], i, a); }
async function __aMap(a, f) { var r = []; for (var i = 0; i < a.length; i++) r.push(await f(a[i], i, a)); return r; }
async function __aFilter(a, f) { var r = []; for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) r.push(a[i]); return r; }
async function __aSome(a, f) { for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) return true; return false; }
async function __aEvery(a, f) { for (var i = 0; i < a.length; i++) if (!(await f(a[i], i, a))) return false; return true; }
async function __aFind(a, f) { for (var i = 0; i < a.length; i++) if (await f(a[i], i, a)) return a[i]; return undefined; }

/**
 * 수학 오개념 진단 도우미 (Google Apps Script + Google Sheets)
 * ------------------------------------------------------------
 * 중학교 3학년 학생이 풀이 사진을 올리면 AI가 풀이를 텍스트로 옮기고(학생 확인·수정),
 * Newman 5단계 모델로 오류를 분류한 뒤 단계별 처방(피드백, 시각화, 유도질문 학습)을 제공한다.
 *
 * 이 파일은 여러 소스 파일을 합친 배포용 파일입니다. 수정은 소스(src/server)에서 하는 것을 권장합니다.
 */

var APP_NAME = '수학 오개념 진단 도우미';
var APP_VERSION = '1.0.0';
var TZ = 'Asia/Seoul';
var SESSION_TTL_SEC = 21600; // 6시간 (CacheService 최대)
var STAGE_ORDER = ['읽기', '이해', '변형', '처리기술', '인코딩'];
var ZWSP = '\u200B'; // 시트가 문자열을 숫자·날짜·수식으로 바꾸지 않도록 붙이는 표시

var SH = {
  CONFIG: '설정',
  TEACHER: '교사',
  STUDENT: '학생',
  ITEM: '문항리스트',
  ASSIGN: '과제',
  PROGRESS: '진행상황',
  SUBMIT: '풀이기록',
  ERROR: '오류기록',
  MISCON: '오개념도표',
  STAGESUM: '단계별집계',
  SESSION: '학습세션',
  CHAT: '채팅로그',
  HELP: '교사확인요청',
  GRAPH: '선수개념위계도',
  CONCEPT: '개념목록',
  REPORT: '학습리포트'
};

var COLS = {};
COLS[SH.CONFIG] = ['항목', '값', '설명'];
COLS[SH.TEACHER] = ['교사ID', '이름', '로그인ID', '담당반', '비밀번호해시', '솔트', 'AI제공자', '모델', 'API키상태', '가상여부', '생성일시', '수정일시'];
COLS[SH.STUDENT] = ['학생ID', '반', '번호', '이름', '담당교사ID', '비밀번호해시', '솔트', '가입여부', '가입일시', '최근접속', '가상여부'];
COLS[SH.ITEM] = ['문항ID', '문항코드', '개념id', '개념명', '학년', '난이도', '문제', '정답', '풀이단계', '그림스펙', '문항유형', '시각화유형', '생성방식', '참고문항ID', '생성일시', '문제이미지ID', '보기', '정답확인'];
COLS[SH.ASSIGN] = ['과제ID', '교사ID', '대상반', '문항ID', '순서', '공개', '출제일시'];
COLS[SH.PROGRESS] = ['진행ID', '학생ID', '과제ID', '원문항ID', '상태', '단계', '현재문항ID', '세션ID', '최근제출ID', '시도횟수', '반복횟수', '교사알림', '완료일시', '수정일시'];
COLS[SH.SUBMIT] = ['제출ID', '학생ID', '반', '과제ID', '문항ID', '문항코드', '개념id', '시도구분', '시도차수', '세션ID', '이해못함',
  '이미지파일ID', '이미지링크', 'AI전사', '학생수정본', '자기교정', '학생최종답', '정오', '주원인', '오개념개념id', '확신도',
  '판단근거', '불확실성', 'AI분석', '이해도움', '상태', '학생피드백', '제출일시', '분석일시', '가상여부'];
COLS[SH.ERROR] = ['오류ID', '제출ID', '학생ID', '반', '문항ID', '문항코드', '줄번호', 'Newman단계', '주원인여부', '개념id', '개념명',
  '오류유형', '설명', '판단근거', '불확실성', '확신도', '출처', '기록일시', '가상여부'];
COLS[SH.STAGESUM] = ['학생ID', '반', '번호', '이름', '제출수', '정답수', '오답수', '판단보류', '주원인_읽기', '주원인_이해', '주원인_변형',
  '주원인_처리기술', '주원인_인코딩', '처리기술점수', '인코딩점수', '최근갱신'];
COLS[SH.SESSION] = ['세션ID', '학생ID', '과제ID', '원제출ID', '원문항ID', '상태', '상태데이터', '추적경로', '진단결과', '대화수', '시작일시', '수정일시'];
COLS[SH.CHAT] = ['세션ID', '순번', '역할', '내용', '문항ID', '개념id', '일시'];
COLS[SH.HELP] = ['요청ID', '제출ID', '학생ID', '반', '문항ID', '교사ID', '사유', '상태', '교사답변', '교사판정단계', '교사판정개념id', '학생확인', '요청일시', '답변일시'];

// 학습리포트: 학생이 과제를 모두 마친 뒤 만든 리포트(학생·교사가 함께 봄). 기준(풀이 기록 요약)이 바뀌면 다시 만든다.
// 학습결손은 교사에게만 보여 준다.
// 평가기준: AI 평가를 쓸 때 푼 문제 목록. 새로 푼 문제가 생길 때만 평가를 다시 쓴다.
COLS[SH.REPORT] = ['학생ID', '기준', '평가', '생성일시', '리포트', '학습결손', '평가기준'];

// 오개념도표: 학생의 개념별 이해 기록. 판단 하나마다 새 행.
//  판단: 오개념 | 이해함 (예전 행처럼 비어 있으면 오개념)   출처: 풀이분석 | 교사판정 | 유도질문
//  '오개념 개념 코드'는 예전 이름 그대로 두지만 이해함 행에도 그 개념 코드를 쓴다.
COLS[SH.MISCON] = ['학생이름', '학생id', '오개념 개념 코드', '판단', '개념명', '이해수준', '출처', '근거', '문항ID', '기록일시'];

var DEFAULT_SETTINGS = [
  ['학교명', '물개중학교', '로그인 화면과 상단에 표시'],
  ['학년', '3', '학급 선택 목록에 표시되는 학년'],
  ['반목록', '1,2,3,4,5', '쉼표로 구분'],
  ['확신도기준', '0.6', '오류 판단 확신도(0~1)가 이보다 낮으면 판단을 보류하고 교사에게 요청'],
  ['생각시간초', '20', '유도질문 뒤 [힌트]/[모르겠어요] 버튼이 열리기까지 기다리는 시간(초)'],
  ['최대재시도', '3', '같은 문제를 이 횟수만큼 틀리면 다음 문제로 넘어갈 수 있음(교사에게 알림)'],
  ['최대추적깊이', '4', '선수개념 역방향 추적의 최대 단계 수'],
  ['최대학습반복', '2', '3단계 학습(유도질문→회귀→적용)을 반복하는 최대 횟수'],
  ['튜터최대대화', '40', '한 학습 세션에서 학생이 보낼 수 있는 최대 메시지 수'],
  ['처리기술리포트기준', '3', '처리기술 점수가 이 값 이상이면 리포트에 반영(리포트 기능 준비 중)'],
  ['인코딩리포트기준', '3', '인코딩 점수가 이 값 이상이면 리포트에 반영(리포트 기능 준비 중)'],
  ['학습결손기준', '40,30,20', '최소 성취수준 보장지도: 리포트 총점(100점 환산)이 첫째 값 미만이면 학습 결손 주의, 둘째 값 미만이면 심함, 셋째 값 미만이면 매우 심함(교사 리포트에만 표시)'],
  ['학습결손최소문항', '3', '채점된 문제가 이 수보다 적으면 학습 결손을 판단하지 않음'],
  ['이미지폴더ID', '', '초기 설정 때 자동으로 채워짐(비공개 폴더)'],
  ['문제이미지폴더', '중3_문제이미지', '문제 이미지(문항코드.png)가 든 Drive 폴더 이름 또는 폴더 ID']
];

// OpenAI 호환 API 주소. 교사 설정에서 바꿀 수 있다(기본: 학교용 TimelyAI 브리지).
var DEFAULT_AI_BASE_URL = 'https://hello.timelyai.io/api/v2/chat/bridge/openai';
var OPENAI_BASE_URL = 'https://api.openai.com/v1';

// AI는 OpenAI API만 사용한다. 모델은 이미지 입력과 Chat Completions를 지원해야 한다.
var PROVIDERS = {
  openai: { label: 'OpenAI', defaultModel: 'gpt-5.4-mini', models: ['gpt-5.4-mini', 'gpt-6-luna', 'gpt-6-sol', 'gpt-5.5'] }
};

// 처리기술(단순 계산) 오류를 연결할 기초 계산 개념을 찾는 키워드
var BASIC_CALC_KEYWORDS = ['분수의 덧셈', '분수의 뺄셈', '진분수의', '대분수의', '분수의 곱셈', '분수의 나눗셈', '통분', '약분',
  '유리수의', '혼합 계산', '거듭제곱', '동류항', '분배법칙', '이항', '부호가 다른', '일차방정식의 풀이', '복잡한 일차방정식',
  '제곱근의 곱셈', '제곱근의 나눗셈', '제곱근의 덧셈'];

var STAGE_MESSAGES = {
  '읽기': '틀렸습니다! 문제를 다시 한번 읽어보세요!',
  '이해': '문제에서 주어진 것과 구하는 것을 다시 살펴보세요. 설명이 필요하면 [도움 받기]를 눌러 보세요.',
  '변형': '풀이 방법에서 헷갈린 개념이 있어 보여요. 비슷한 문제로 함께 생각해 볼게요.',
  '처리기술': '계산실수가 있어요! 검산해보세요!',
  '인코딩': '문제에서 요구한 답을 정확한 형태로 작성했는지 확인하세요'
};
var HOLD_MESSAGE = '선생님께서 답변해주실거에요.';

;
/* ===================== 시트·데이터 공통 도구 ===================== */

var _memo = {};
async function memo_(key, fn) {
  if (!Object.prototype.hasOwnProperty.call(_memo, key)) _memo[key] = (await fn());
  return _memo[key];
}
function forget_(key) { delete _memo[key]; }

async function ss_() {
  return (await memo_('ss', async function () {
    var id = (await PropertiesService.getScriptProperties().getProperty('SS_ID'));
    if (id) {
      try { return (await SpreadsheetApp.openById(id)); } catch (e) { /* 아래로 */ }
    }
    var ss = (await SpreadsheetApp.getActiveSpreadsheet());
    if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. 스프레드시트의 [확장 프로그램 > Apps Script]에서 초기 설정을 먼저 실행해 주세요.');
    return ss;
  }));
}

async function sheet_(name, optional) {
  var sh = (await (await ss_()).getSheetByName(name));
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

async function withLock_(fn) {
  var lock = LockService.getScriptLock();
  (await lock.waitLock(25000));
  try { return (await fn()); } finally { (await lock.releaseLock()); }
}

async function headers_(name) {
  return (await memo_('hdr:' + name, async function () {
    var sh = (await sheet_(name));
    var lc = (await sh.getLastColumn());
    if (lc < 1) return [];
    return (await sh.getRange(1, 1, 1, lc).getValues())[0].map(function (h) { return String(h).trim(); });
  }));
}

/** 시트 전체를 객체 배열로 (1행 = 머리글) */
async function rows_(name) {
  var sh = (await sheet_(name));
  var lr = (await sh.getLastRow()), lc = (await sh.getLastColumn());
  if (lr < 2 || lc < 1) return [];
  var values = (await sh.getRange(1, 1, lr, lc).getValues());
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

async function appendObj_(name, obj) {
  var hdr = (await headers_(name));
  var row = hdr.map(function (h) { return cell_(obj[h]); });
  (await (await sheet_(name)).appendRow(row));
  return obj;
}

async function appendObjs_(name, objs) {
  if (!objs.length) return;
  var hdr = (await headers_(name));
  var sh = (await sheet_(name));
  var rows = objs.map(function (o) { return hdr.map(function (h) { return cell_(o[h]); }); });
  var start = (await sh.getLastRow()) + 1;
  var need = start + rows.length - 1;
  if (need > (await sh.getMaxRows())) (await sh.insertRowsAfter((await sh.getMaxRows()), need - (await sh.getMaxRows())));
  (await sh.getRange(start, 1, rows.length, hdr.length).setValues(rows));
}

/** A열에서 key가 있는 행 번호 (없으면 -1) */
async function findRow_(name, key, startRow) {
  var sh = (await sheet_(name));
  var s = startRow || 2;
  var lr = (await sh.getLastRow());
  if (lr < s) return -1;
  var f = sh.getRange(s, 1, lr - s + 1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
  return f ? f.getRow() : -1;
}

async function getObj_(name, key) {
  var r = (await findRow_(name, key));
  if (r < 0) return null;
  var hdr = (await headers_(name));
  var vals = (await (await sheet_(name)).getRange(r, 1, 1, hdr.length).getValues())[0];
  var o = { _row: r };
  for (var c = 0; c < hdr.length; c++) if (hdr[c]) o[hdr[c]] = plain_(vals[c]);
  return o;
}

/** key(A열 값) 또는 행 번호로 찾은 행의 일부 칸만 바꾼다 */
async function updateObj_(name, keyOrRow, patch) {
  var r = (typeof keyOrRow === 'number') ? keyOrRow : (await findRow_(name, keyOrRow));
  if (r < 0) throw new Error(name + ' 시트에서 ' + keyOrRow + '을(를) 찾지 못했어요.');
  var hdr = (await headers_(name));
  var sh = (await sheet_(name));
  (await __aForEach(Object.keys(patch), async function (k) {
    var c = hdr.indexOf(k);
    if (c >= 0) (await sh.getRange(r, c + 1).setValue(cell_(patch[k])));
  }));
  return r;
}

/* ---------- 설정 ---------- */
async function settings_() {
  return (await memo_('settings', async function () {
    var m = {};
    DEFAULT_SETTINGS.forEach(function (r) { m[r[0]] = r[1]; });
    var sh = (await sheet_(SH.CONFIG, true));
    if (sh && (await sh.getLastRow()) >= 2) {
      (await sh.getRange(2, 1, (await sh.getLastRow()) - 1, 2).getValues()).forEach(function (r) {
        var k = String(r[0]).trim();
        if (k) m[k] = str_(r[1]).trim();
      });
    }
    // 예전 기본 학교명(시연용)은 새 이름으로 보여 준다(설정 시트를 직접 고치지 않아도 되게).
    if (/^\(가상\)\s*미래중학교$/.test(m['학교명'] || '')) m['학교명'] = '물개중학교';
    return m;
  }));
}
async function setting_(key) { var s = (await settings_()); return s[key] === undefined ? '' : s[key]; }
async function settingNum_(key, def) { return num_((await setting_(key)), def); }
async function setSetting_(key, value) {
  var sh = (await sheet_(SH.CONFIG));
  var r = (await findRow_(SH.CONFIG, key));
  if (r < 0) (await sh.appendRow([key, cell_(value), '']));
  else (await sh.getRange(r, 2).setValue(cell_(value)));
  forget_('settings');
}

async function classList_() {
  return String((await setting_('반목록')) || '1,2,3,4,5').split(',').map(function (x) { return x.trim(); }).filter(String);
}
async function classLabel_(cls) { return ((await setting_('학년')) || '3') + '학년 ' + cls + '반'; }
function splitList_(s) { return String(s || '').split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(String); }

/* ---------- 응답 포장 ---------- */
function userError_(msg, code) {
  var e = new Error(msg);
  e.user = true;
  e.code = code || 'USER';
  return e;
}
async function wrap_(fn) {
  try {
    var data = (await fn());
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

;
/* ===================== 로그인·회원가입·세션 ===================== */

async function pepper_() {
  var p = PropertiesService.getScriptProperties();
  var v = (await p.getProperty('PEPPER'));
  if (!v) {
    v = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    (await p.setProperty('PEPPER', v));
  }
  return v;
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }

async function hashPw_(pw, salt) {
  var v = String(salt) + '|' + String(pw) + '|' + (await pepper_());
  for (var i = 0; i < 40; i++) {
    v = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8));
  }
  return 'h$' + v;
}

function checkPwRule_(pw) {
  pw = String(pw || '');
  if (pw.length < 4) throw userError_('비밀번호는 4자 이상으로 정해 주세요.');
  if (pw.length > 40) throw userError_('비밀번호가 너무 길어요.');
}

/* ---------- 세션 (CacheService, 6시간) ---------- */
async function createSession_(info) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  info.at = now_();
  (await CacheService.getScriptCache().put('S:' + token, JSON.stringify(info), SESSION_TTL_SEC));
  return token;
}
async function getSession_(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  var c = CacheService.getScriptCache();
  var raw = (await c.get('S:' + token));
  if (!raw) return null;
  (await c.put('S:' + token, raw, SESSION_TTL_SEC));
  return JSON.parse(raw);
}
function authError_() { return userError_('로그인이 만료되었어요. 다시 로그인해 주세요.', 'AUTH'); }
async function requireStudent_(token) {
  var s = (await getSession_(token));
  if (!s || s.role !== 'student') throw authError_();
  return s;
}
async function requireTeacher_(token) {
  var s = (await getSession_(token));
  if (!s || s.role !== 'teacher') throw authError_();
  return s;
}

/* ---------- 로그인 시도 제한 ---------- */
async function checkRate_(key) {
  var n = parseInt((await CacheService.getScriptCache().get('LF:' + key)) || '0', 10);
  if (n >= 5) throw userError_('비밀번호를 여러 번 틀렸어요. 5분 뒤에 다시 시도해 주세요.');
}
async function failRate_(key) {
  var c = CacheService.getScriptCache();
  var n = parseInt((await c.get('LF:' + key)) || '0', 10) + 1;
  (await c.put('LF:' + key, String(n), 300));
}
async function clearRate_(key) { (await CacheService.getScriptCache().remove('LF:' + key)); }

/* ---------- 학생·교사 찾기 ---------- */
/** 학번 = 학년 + 반(2자리) + 번호(2자리). 예: 3학년 1반 1번 → 30101 */
async function studentIdFor_(cls, num) {
  return String((await setting_('학년')) || '3') + ('0' + parseInt(cls, 10)).slice(-2) + ('0' + parseInt(num, 10)).slice(-2);
}

async function findStudent_(cls, num) {
  cls = String(cls).trim(); num = String(parseInt(num, 10));
  var list = (await rows_(SH.STUDENT));
  for (var i = 0; i < list.length; i++) {
    if (str_(list[i]['반']) === cls && String(parseInt(list[i]['번호'], 10)) === num) return list[i];
  }
  return null;
}
async function teachers_() { return (await memo_('teachers', async function () { return (await rows_(SH.TEACHER)); })); }
async function teacherForClass_(cls) {
  var ts = (await teachers_());
  for (var i = 0; i < ts.length; i++) {
    if (splitList_(ts[i]['담당반']).indexOf(String(cls)) >= 0) return ts[i];
  }
  return null;
}
async function studentSessionInfo_(st) {
  var t = (await teacherForClass_(str_(st['반'])));
  return {
    role: 'student', id: str_(st['학생ID']), cls: str_(st['반']), num: String(parseInt(st['번호'], 10)),
    name: str_(st['이름']), teacherId: t ? str_(t['교사ID']) : str_(st['담당교사ID']),
    teacherName: t ? str_(t['이름']) : '', classLabel: (await classLabel_(str_(st['반'])))
  };
}

/* ---------- 공개 API ---------- */
async function api_studentLogin(p) {
  return (await wrap_(async function () {
    p = p || {};
    var cls = String(p.cls || '').trim(), num = String(parseInt(p.num, 10) || ''), name = String(p.name || '').trim(), pw = String(p.password || '');
    if (!cls || !num || !pw) throw userError_('학급, 번호, 비밀번호를 입력해 주세요.');
    var key = 'st:' + cls + ':' + num;
    (await checkRate_(key));
    var st = (await findStudent_(cls, num));
    if (!st || str_(st['가입여부']) !== 'Y') throw userError_("가입된 아이디가 없어요. 아이디가 없다면 아래 [회원가입]을 눌러 주세요.");
    if (name && str_(st['이름']) && name.replace(/\s/g, '') !== str_(st['이름']).replace(/\s/g, '')) {
      (await failRate_(key));
      throw userError_('이름이 명단과 달라요.');
    }
    if ((await hashPw_(pw, str_(st['솔트']))) !== str_(st['비밀번호해시'])) {
      (await failRate_(key));
      throw userError_('비밀번호가 맞지 않아요.');
    }
    (await clearRate_(key));
    (await updateObj_(SH.STUDENT, st._row, { '최근접속': now_() }));
    var info = (await studentSessionInfo_(st));
    return { token: (await createSession_(info)), profile: info };
  }));
}

async function api_studentRegister(p) {
  return (await wrap_(async function () {
    p = p || {};
    var cls = String(p.cls || '').trim(), num = parseInt(p.num, 10), name = String(p.name || '').trim();
    var pw = String(p.password || ''), pw2 = String(p.password2 || '');
    if (!cls || !num || !name) throw userError_('학급, 번호, 이름을 모두 입력해 주세요.');
    if ((await classList_()).indexOf(cls) < 0) throw userError_('학급을 다시 골라 주세요.');
    if (num < 1 || num > 60) throw userError_('번호를 확인해 주세요.');
    if (name.length > 20) throw userError_('이름이 너무 길어요.');
    checkPwRule_(pw);
    if (pw !== pw2) throw userError_('비밀번호 확인이 일치하지 않아요.');
    var info = (await withLock_(async function () {
      forget_('teachers');
      var st = (await findStudent_(cls, num));
      var salt = newSalt_();
      if (st) {
        // 한 번 가입된 학번은 다시 만들 수 없음
        if (str_(st['가입여부']) === 'Y') throw userError_('이미 가입된 학번과 이름이에요. 선생님에게 문의하세요.', 'DUP');
        // 명단에만 있고 가입하지 않은 학번 → 입력한 이름으로 가입
        (await updateObj_(SH.STUDENT, st._row, {
          '이름': name, '비밀번호해시': (await hashPw_(pw, salt)), '솔트': salt, '가입여부': 'Y', '가입일시': now_(), '최근접속': now_(), '가상여부': 'N'
        }));
        st = (await findStudent_(cls, num));
        (await updateStageSumName_(str_(st['학생ID']), name));
        return (await studentSessionInfo_(st));
      }
      var t = (await teacherForClass_(cls));
      var id = (await studentIdFor_(cls, num));
      (await appendObj_(SH.STUDENT, {
        '학생ID': id, '반': cls, '번호': num, '이름': name, '담당교사ID': t ? str_(t['교사ID']) : '',
        '비밀번호해시': (await hashPw_(pw, salt)), '솔트': salt, '가입여부': 'Y', '가입일시': now_(), '최근접속': now_(), '가상여부': 'N'
      }));
      (await ensureStudentScoreRows_([{ id: id, cls: cls, num: num, name: name }]));
      return (await studentSessionInfo_((await findStudent_(cls, num))));
    }));
    return { token: (await createSession_(info)), profile: info };
  }));
}

async function api_teacherLogin(p) {
  return (await wrap_(async function () {
    p = p || {};
    var loginId = String(p.loginId || '').trim(), pw = String(p.password || '');
    if (!loginId || !pw) throw userError_('아이디와 비밀번호를 입력해 주세요.');
    var key = 'tc:' + loginId;
    (await checkRate_(key));
    var t = null;
    (await teachers_()).forEach(function (x) { if (str_(x['로그인ID']) === loginId) t = x; });
    if (!t || (await hashPw_(pw, str_(t['솔트']))) !== str_(t['비밀번호해시'])) {
      (await failRate_(key));
      throw userError_('아이디 또는 비밀번호가 맞지 않아요.');
    }
    (await clearRate_(key));
    var info = { role: 'teacher', id: str_(t['교사ID']), name: str_(t['이름']), classes: splitList_(t['담당반']) };
    return { token: (await createSession_(info)), profile: info };
  }));
}

async function api_me(token) {
  return (await wrap_(async function () {
    var s = (await getSession_(token));
    if (!s) throw authError_();
    return s;
  }));
}

async function api_logout(token) {
  return (await wrap_(async function () {
    if (token) (await CacheService.getScriptCache().remove('S:' + token));
    return true;
  }));
}

async function api_changePassword(token, oldPw, newPw, newPw2) {
  return (await wrap_(async function () {
    var s = (await getSession_(token));
    if (!s) throw authError_();
    checkPwRule_(newPw);
    if (newPw !== newPw2) throw userError_('새 비밀번호 확인이 일치하지 않아요.');
    var sheetName = s.role === 'teacher' ? SH.TEACHER : SH.STUDENT;
    var row = (await getObj_(sheetName, s.id));
    if (!row) throw authError_();
    if ((await hashPw_(oldPw, str_(row['솔트']))) !== str_(row['비밀번호해시'])) throw userError_('현재 비밀번호가 맞지 않아요.');
    var salt = newSalt_();
    var patch = { '비밀번호해시': (await hashPw_(newPw, salt)), '솔트': salt };
    if (s.role === 'teacher') patch['수정일시'] = now_();
    (await updateObj_(sheetName, row._row, patch));
    return true;
  }));
}

;
/* ===================== 개념목록·선수개념위계도·문항정보 ===================== */

var HEADER_ALIASES = {
  code: ['문항코드', '문항ID'],
  cid: ['개념id', '개념ID', '지식태그(개념ID)', '지식태그'],
  cname: ['개념명'],
  std: ['성취기준'],
  desc: ['개념설명'],
  diff: ['난이도', 'IRT 난이도', 'IRT난이도'],
  disc: ['변별도', 'IRT 변별도', 'IRT변별도'],
  grade: ['학년'],
  sem: ['학기'],
  unit: ['단원'],
  pre: ['선수_개념ID', '선수개념ID'],
  post: ['후수_개념ID', '후수개념ID']
};

function headerIndex_(hdr, keys) {
  var I = {};
  keys.forEach(function (k) {
    I[k] = -1;
    var al = HEADER_ALIASES[k] || [k];
    for (var i = 0; i < al.length && I[k] < 0; i++) I[k] = hdr.indexOf(al[i]);
  });
  return I;
}

async function sheetHeaders_(sh) {
  var lc = (await sh.getLastColumn());
  if (lc < 1) return [];
  return (await sh.getRange(1, 1, 1, Math.min(lc, 40)).getValues())[0].map(function (h) { return String(h).trim(); });
}

/** 머리글로 시트를 찾는다 (시트 이름은 자유) */
async function findSheetByHeaders_(keys, preferName) {
  var ss = (await ss_());
  async function ok(sh) {
    if (!sh) return false;
    var I = headerIndex_((await sheetHeaders_(sh)), keys);
    return keys.every(function (k) { return I[k] >= 0; });
  }
  if (preferName) { var p = (await ss.getSheetByName(preferName)); if ((await ok(p))) return p; }
  var sheets = (await ss.getSheets());
  for (var i = 0; i < sheets.length; i++) if ((await ok(sheets[i]))) return sheets[i];
  return null;
}

function gradeRank_(g) {
  var m = String(g || '').match(/(초|중)\s*([1-6])/);
  if (!m) return 99;
  return (m[1] === '초' ? 0 : 6) + parseInt(m[2], 10);
}

/** 개념목록: {id: {id,name,grade,sem,unit,std,desc}} */
async function conceptMap_() {
  return (await memo_('concepts', async function () {
    var map = {};
    var sh = (await findSheetByHeaders_(['cid', 'cname', 'grade'], SH.CONCEPT));
    if (!sh || (await sh.getLastRow()) < 2) return map;
    var v = (await sh.getRange(1, 1, (await sh.getLastRow()), (await sh.getLastColumn())).getValues());
    var I = headerIndex_(v[0].map(function (h) { return String(h).trim(); }), ['cid', 'cname', 'grade', 'sem', 'unit', 'std', 'desc']);
    for (var r = 1; r < v.length; r++) {
      var id = str_(v[r][I.cid]).trim();
      if (!id) continue;
      map[id] = {
        id: id, name: str_(v[r][I.cname]), grade: str_(v[r][I.grade]),
        sem: I.sem >= 0 ? str_(v[r][I.sem]) : '', unit: I.unit >= 0 ? str_(v[r][I.unit]) : '',
        std: I.std >= 0 ? str_(v[r][I.std]) : '', desc: I.desc >= 0 ? str_(v[r][I.desc]) : '', order: r
      };
    }
    return map;
  }));
}

async function conceptInfo_(id) {
  id = String(id || '');
  var c = (await conceptMap_())[id];
  if (c) return c;
  // 개념목록에 없는 개념(문항정보에만 있는 태그)
  var idx = (await itemInfoIndex_());
  var codes = idx.byConcept[id];
  if (codes && codes.length) {
    var it = idx.codes[codes[0]];
    return { id: id, name: it.conceptName, grade: it.grade, sem: '', unit: '', std: it.std, desc: it.desc, order: 99999 };
  }
  return null;
}

/** 선수개념위계도: {pre: {후수id: [선수id...]}, post: {선수id: [후수id...]}} */
async function prereqMap_() {
  return (await memo_('prereq', async function () {
    var pre = {}, post = {};
    var sh = (await findSheetByHeaders_(['pre', 'post'], SH.GRAPH));
    if (!sh || (await sh.getLastRow()) < 2) return { pre: pre, post: post };
    var v = (await sh.getRange(1, 1, (await sh.getLastRow()), (await sh.getLastColumn())).getValues());
    var I = headerIndex_(v[0].map(function (h) { return String(h).trim(); }), ['pre', 'post']);
    for (var r = 1; r < v.length; r++) {
      var a = str_(v[r][I.pre]).trim(), b = str_(v[r][I.post]).trim();
      if (!a || !b) continue;
      (pre[b] = pre[b] || []).push(a);
      (post[a] = post[a] || []).push(b);
    }
    return { pre: pre, post: post };
  }));
}

/** 학년별 문항정보 시트들 (이름에 '문항정보'가 들어가거나, 문항코드+개념ID+난이도 머리글이 있는 시트) */
async function infoSheets_() {
  return (await memo_('infoSheets', async function () {
    var out = [];
    (await __aForEach((await (await ss_()).getSheets()), async function (sh) {
      var name = sh.getName();
      if (name === SH.ITEM) return;
      var hdr = (await sheetHeaders_(sh));
      if (hdr.indexOf('문제') >= 0) return;
      var I = headerIndex_(hdr, ['code', 'cid', 'diff']);
      if (I.code >= 0 && I.cid >= 0 && (I.diff >= 0 || /문항정보/.test(name))) out.push(sh);
    }));
    return out;
  }));
}

/** 문항정보 색인: {codes: {문항코드: {...}}, byConcept: {개념id: [문항코드...]}} */
async function itemInfoIndex_() {
  return (await memo_('itemInfo', async function () {
    var codes = {}, byConcept = {};
    (await __aForEach((await infoSheets_()), async function (sh) {
      if ((await sh.getLastRow()) < 2) return;
      var v = (await sh.getRange(1, 1, (await sh.getLastRow()), Math.min((await sh.getLastColumn()), 12)).getValues());
      var I = headerIndex_(v[0].map(function (h) { return String(h).trim(); }), ['code', 'cid', 'cname', 'std', 'desc', 'diff', 'disc', 'grade']);
      var gm = sh.getName().match(/(초|중)\s*([1-6])/);
      var sheetGrade = gm ? gm[1] + gm[2] : '';
      for (var r = 1; r < v.length; r++) {
        var code = str_(v[r][I.code]).trim();
        if (!code) continue;
        var cid = str_(v[r][I.cid]).trim();
        var grade = I.grade >= 0 ? str_(v[r][I.grade]) : sheetGrade;
        // 변별도는 일부 문항정보 시트에만 있다: 다른 시트가 같은 문항코드를 덮어써도 변별도는 남긴다.
        var prevDisc = codes[code] ? codes[code].disc : 0;
        codes[code] = {
          code: code, conceptId: cid, conceptName: I.cname >= 0 ? str_(v[r][I.cname]) : '',
          std: I.std >= 0 ? str_(v[r][I.std]) : '', desc: I.desc >= 0 ? str_(v[r][I.desc]) : '',
          diff: I.diff >= 0 ? num_(v[r][I.diff], 0) : 0, disc: (I.disc >= 0 ? num_(v[r][I.disc], 0) : 0) || prevDisc, grade: grade, sheet: sh.getName()
        };
        (byConcept[cid] = byConcept[cid] || []).push(code);
      }
    }));
    return { codes: codes, byConcept: byConcept };
  }));
}

/* ---------- 후보 개념 ---------- */
var KW_STOP = { '이용한': 1, '이용': 1, '풀이': 1, '방법': 1, '성질': 1, '계산': 1, '값': 1, '뜻': 1, '크기': 1, '관계': 1, '경우': 1,
  '구하기': 1, '구하는': 1, '나타내기': 1, '알아보기': 1, '사이': 1, '대한': 1, '있는': 1, '없는': 1, '꼴': 1, '식': 1, '문제': 1,
  '활용': 1, '주어진': 1, '주어질': 1, '때': 1, '따른': 1, '여러': 1, '가지': 1, '조건': 1, '서로': 1, '다른': 1, '이차': 1, '표현': 1 };

function conceptKeywords_(name) {
  var clean = String(name || '').replace(/\$[^$]*\$/g, ' ').replace(/[(){}\[\];:,.~'"’‘]/g, ' ');
  var seen = {}, out = [];
  clean.split(/\s+/).forEach(function (w) {
    w = w.replace(/(으로|에서|하기|하는|을|를|이|가|의|에|와|과|로|은|는)$/, '');
    if (w.length >= 2 && !KW_STOP[w] && !seen[w]) { seen[w] = 1; out.push(w); }
  });
  return out;
}

async function keywordRelated_(conceptId, limit, maxGradeRank) {
  var cm = (await conceptMap_());
  var c = (await conceptInfo_(conceptId));
  if (!c) return [];
  var kws = conceptKeywords_(c.name);
  if (!kws.length) return [];
  var gMax = maxGradeRank || gradeRank_(c.grade);
  var scored = [];
  Object.keys(cm).forEach(function (id) {
    if (id === String(conceptId)) return;
    var x = cm[id];
    if (gradeRank_(x.grade) > gMax) return;
    var s = 0;
    kws.forEach(function (k) { if (x.name.indexOf(k) >= 0) s++; });
    if (s > 0) scored.push({ x: x, s: s });
  });
  scored.sort(function (a, b) { return b.s - a.s || gradeRank_(b.x.grade) - gradeRank_(a.x.grade) || a.x.order - b.x.order; });
  return scored.slice(0, limit || 10).map(function (o) { return o.x; });
}

/**
 * 선수개념 후보 (위계도 우선, 부족하면 이름이 비슷한 하위·같은 학년 개념으로 보충)
 * opts: {depth, min, limit, exclude: {id:true}}
 */
async function prereqCandidates_(conceptId, opts) {
  opts = opts || {};
  var pm = (await prereqMap_()).pre;
  var exclude = opts.exclude || {};
  var out = [], seen = {};
  seen[String(conceptId)] = true;
  var frontier = [String(conceptId)];
  for (var d = 1; d <= (opts.depth || 1); d++) {
    var next = [];
    frontier.forEach(function (id) {
      (pm[id] || []).forEach(function (p) {
        if (seen[p]) return;
        seen[p] = true;
        next.push(p);
        if (!exclude[p]) out.push({ id: p, depth: d, via: 'graph' });
      });
    });
    frontier = next;
  }
  if (out.length < (opts.min || 3)) {
    (await keywordRelated_(conceptId, 12)).forEach(function (x) {
      if (seen[x.id] || exclude[x.id]) return;
      seen[x.id] = true;
      out.push({ id: x.id, depth: 9, via: 'related' });
    });
  }
  return (await __aMap(out.slice(0, opts.limit || 20), async function (o) {
    var c = (await conceptInfo_(o.id)) || { name: '', grade: '' };
    return { id: o.id, name: c.name, grade: c.grade, depth: o.depth, via: o.via };
  }));
}

/**
 * 문항의 핵심 개념 묶음: 문항 개념 + 같은 학년·같은 중단원(단원 앞 두 단계)의 개념.
 * 예) '제곱근의 곱셈' 문항 → 근호를 포함한 식의 계산(곱셈·나눗셈·덧셈과 뺄셈·유리화 …)
 * 이 묶음의 계산을 틀린 것은 단순 계산 실수(처리기술)가 아니라 오개념(변형)으로 본다.
 */
async function coreConcepts_(item) {
  var cm = (await conceptMap_());
  var base = cm[String(item.conceptId)];
  var out = [{ id: String(item.conceptId), name: item.conceptName, grade: item.grade }];
  if (!base || !base.unit) return out;
  var unit2 = function (u) { return String(u || '').split('>').slice(0, 2).map(function (x) { return x.trim(); }).join(' > '); };
  var key = unit2(base.unit);
  if (key.indexOf('>') < 0) return out;
  Object.keys(cm).forEach(function (id) {
    var c = cm[id];
    if (id === String(item.conceptId) || c.grade !== base.grade || unit2(c.unit) !== key) return;
    out.push({ id: id, name: c.name, grade: c.grade });
  });
  return out;
}

async function basicCalcCandidates_(gradeOfItem, excludeIds) {
  excludeIds = excludeIds || {};
  var cm = (await conceptMap_());
  var gMax = gradeRank_(gradeOfItem || '중3');
  var out = [];
  Object.keys(cm).forEach(function (id) {
    var c = cm[id], g = gradeRank_(c.grade);
    if (g > gMax || g < 5 || excludeIds[id]) return;
    for (var i = 0; i < BASIC_CALC_KEYWORDS.length; i++) {
      if (c.name.indexOf(BASIC_CALC_KEYWORDS[i]) >= 0) { out.push(c); break; }
    }
  });
  out.sort(function (a, b) { return gradeRank_(b.grade) - gradeRank_(a.grade) || a.order - b.order; });
  return out.slice(0, 30).map(function (c) { return { id: c.id, name: c.name, grade: c.grade }; });
}

/** 개념 이름으로 전체 개념 목록에서 찾는다(학년 상한까지). 정확히 같은 이름 → 이름을 포함하는 가장 짧은 개념 순. */
async function conceptByNameUpToGrade_(name, maxGrade) {
  var key = String(name || '').replace(/[\s$]/g, '');
  if (key.length < 2) return null;
  var limit = gradeRank_(maxGrade || '중3');
  var cm = (await conceptMap_()), exact = null, partial = null;
  Object.keys(cm).forEach(function (id) {
    var c = cm[id];
    if (gradeRank_(c.grade) > limit) return;
    var n = String(c.name).replace(/[\s$]/g, '');
    if (n === key) { if (!exact || gradeRank_(c.grade) > gradeRank_(exact.grade)) exact = c; return; }
    if (key.length >= 3 && n.indexOf(key) >= 0 && (!partial || n.length < String(partial.name).length)) partial = c;
  });
  return exact || partial;
}

function conceptLine_(c) { return c.id + ' | ' + (c.grade || '-') + ' | ' + c.name; }

/** 이름으로 개념 id 찾기 (AI가 id 대신 이름을 줬을 때) */
function conceptIdByName_(name, pool) {
  name = String(name || '').replace(/\s/g, '');
  if (!name) return '';
  for (var i = 0; i < pool.length; i++) if (String(pool[i].name).replace(/\s/g, '') === name) return String(pool[i].id);
  for (var j = 0; j < pool.length; j++) {
    var n = String(pool[j].name).replace(/\s/g, '');
    if (n && (n.indexOf(name) >= 0 || name.indexOf(n) >= 0)) return String(pool[j].id);
  }
  return '';
}

;
/* ===================== LLM API (OpenAI) ===================== */
/* API 키는 스크립트 속성(APIKEY_교사ID)에만 저장하고, 시트·화면에는 절대 내보내지 않는다. */

function apiKeyProp_(teacherId) { return 'APIKEY_' + teacherId; }
function baseUrlProp_(teacherId) { return 'AIBASE_' + teacherId; }

async function aiBaseUrl_(teacherId) {
  var u = (await PropertiesService.getScriptProperties().getProperty(baseUrlProp_(teacherId)));
  return String(u || DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
}

async function teacherAiConfig_(teacherId) {
  var t = (await getObj_(SH.TEACHER, teacherId));
  if (!t) throw userError_('담당 선생님 정보를 찾을 수 없어요. 선생님께 알려 주세요.');
  var key = (await PropertiesService.getScriptProperties().getProperty(apiKeyProp_(teacherId)));
  if (!key) throw userError_('선생님이 아직 AI(API 키) 설정을 하지 않았어요. 선생님께 알려 주세요.', 'NOKEY');
  var model = str_(t['모델']).trim();
  // 예전에 다른 회사 모델을 저장해 두었다면 기본 OpenAI 모델로 바꾼다.
  if (!/^(gpt|o\d|chatgpt)/i.test(model)) model = PROVIDERS.openai.defaultModel;
  return { provider: 'openai', model: model, apiKey: key, teacherId: teacherId, baseUrl: (await aiBaseUrl_(teacherId)) };
}

/**
 * opt: {system, user, images:[{mime, base64}], maxTokens, temperature, effort}
 * JSON 객체를 돌려준다.
 */
async function llmJson_(cfg, opt) {
  var text = (await llmText_(cfg, opt, true));
  return parseJsonLoose_(text);
}

async function llmText_(cfg, opt, wantJson) {
  var lastErr = null;
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      return (await callOpenAI_(cfg, opt, wantJson));
    } catch (e) {
      lastErr = e;
      if (!e.retryable) throw e;
      (await Utilities.sleep(1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** GPT-4 계열만 temperature를 받는다. GPT-5·6, o 시리즈는 추론 모델이라 reasoning_effort를 쓴다. */
function isReasoningModel_(model) {
  return !/^(gpt-4|gpt-3|chatgpt-4)/i.test(model);
}

async function callOpenAI_(cfg, opt, wantJson) {
  var hasImg = opt.images && opt.images.length;
  var content = opt.user;
  if (hasImg) {
    content = [{ type: 'text', text: opt.user }];
    opt.images.forEach(function (img) {
      content.push({ type: 'image_url', image_url: { url: 'data:' + img.mime + ';base64,' + img.base64, detail: 'high' } });
    });
  }
  var body = {
    model: cfg.model,
    messages: [{ role: 'system', content: opt.system }, { role: 'user', content: content }]
  };
  if (isReasoningModel_(cfg.model)) {
    // 추론 토큰도 이 한도에 포함되므로 넉넉히 준다.
    body.max_completion_tokens = Math.max(opt.maxTokens || 2000, 8000);
    body.reasoning_effort = opt.effort || 'low';
  } else {
    body.max_completion_tokens = opt.maxTokens || 2000;
    body.temperature = (opt.temperature === undefined) ? 0.2 : opt.temperature;
  }
  if (wantJson) body.response_format = { type: 'json_object' };
  var res;
  try {
    res = (await postChat_(cfg, body));
  } catch (e) {
    // 중계 서버가 일부 옵션을 모르면 그 옵션을 빼고 한 번 더 보낸다(JSON은 프롬프트로도 요청하므로 괜찮다).
    if (e.httpStatus !== 400 || !/reasoning|response_format|unsupported|unrecognized|unknown/i.test(e.message)) throw e;
    delete body.reasoning_effort;
    delete body.response_format;
    res = (await postChat_(cfg, body));
  }
  var ch = res.choices && res.choices[0];
  var text = ch && ch.message && ch.message.content;
  if (!text) throw aiEmpty_(ch && ch.finish_reason);
  return text;
}

/**
 * OpenAI 호환 주소는 보통 {base}/chat/completions 이지만, 주소 자체가 엔드포인트인 중계 서버도 있다.
 * 앞의 것이 404면 뒤의 것을 쓰고, 성공한 주소를 6시간 기억한다.
 */
async function postChat_(cfg, body) {
  var base = cfg.baseUrl || OPENAI_BASE_URL;
  var headers = { Authorization: 'Bearer ' + cfg.apiKey };
  var cache = CacheService.getScriptCache();
  var cacheKey = 'aiurl_' + base.slice(0, 200);
  var known = (await cache.get(cacheKey));
  var urls = /\/chat\/completions$/.test(base) ? [base] : [base + '/chat/completions', base];
  if (known) urls = [known];
  for (var i = 0; i < urls.length; i++) {
    try {
      var res = (await fetchJson_(urls[i], headers, body));
      if (!known) (await cache.put(cacheKey, urls[i], 21600));
      return res;
    } catch (e) {
      if (e.httpStatus === 404 && i < urls.length - 1) continue;
      throw e;
    }
  }
}

function aiEmpty_(reason) {
  var e = new Error('AI 응답이 비어 있어요' + (reason ? ' (' + reason + ')' : '') + '. 다시 시도해 주세요.');
  e.retryable = true;
  return e;
}

async function fetchJson_(url, headers, body) {
  var resp = (await UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true
  }));
  var code = resp.getResponseCode();
  var txt = resp.getContentText();
  var json = null;
  try { json = JSON.parse(txt); } catch (e) { /* 무시 */ }
  if (code >= 200 && code < 300 && json) return json;
  var apiMsg = (json && json.error) ? (json.error.message || JSON.stringify(json.error)) : String(txt).slice(0, 300);
  var err;
  if (code === 401 || code === 403) err = userError_('AI API 키가 올바르지 않거나 권한이 없어요. 선생님 설정을 확인해 주세요. (' + code + ')', 'AIKEY');
  else if (code === 429) { err = userError_('AI 사용량 한도에 걸렸어요. 잠시 후 다시 시도해 주세요. (' + apiMsg.slice(0, 120) + ')', 'AILIMIT'); err.retryable = /rate/i.test(apiMsg); }
  else if (code === 404) err = userError_('AI 모델 이름을 확인해 주세요. (' + apiMsg.slice(0, 160) + ')', 'AIMODEL');
  else if (code >= 500) { err = new Error('AI 서버가 잠시 불안정해요(' + code + '). 다시 시도해 주세요.'); err.retryable = true; err.code = 'AI5XX'; }
  else err = userError_('AI 요청 오류(' + code + '): ' + apiMsg.slice(0, 200), 'AIERR');
  err.httpStatus = code;
  throw err;
}

/* ---------- JSON 해석 (LaTeX 역슬래시 보정 포함) ---------- */
function fixJsonEscapes_(raw) {
  var PH = '\u0001';
  var s = raw.replace(/\\\\/g, PH);
  // \frac, \times, \neq, \right 같은 LaTeX 명령이 JSON 이스케이프(\f \t \n \r \b \u)로 잘못 읽히지 않도록
  s = s.replace(/\\(?=(?:frac|dfrac|tfrac|times|theta|text|tan|tau|triangle|to\b|tilde|top|beta|bar|begin|boxed|because|big|binom|bmod|bot|backsim|bullet|forall|neq|ne\b|not|nabla|newline|nu\b|right|rangle|rho|rm\b|vec|underline|uparrow|upsilon))/g, PH);
  s = s.replace(/\\(?!["\\\/bfnrtu])/g, PH);
  s = s.replace(/\\u(?![0-9a-fA-F]{4})/g, PH + 'u');
  return s.split(PH).join('\\\\');
}

function parseJsonLoose_(text) {
  if (text && typeof text === 'object') return text;
  var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  var s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  var tries = [fixJsonEscapes_(t), t, fixJsonEscapes_(t).replace(/,\s*([}\]])/g, '$1')];
  for (var i = 0; i < tries.length; i++) {
    try { return JSON.parse(tries[i]); } catch (err) { /* 다음 */ }
  }
  var ex = new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  ex.retryable = true;
  throw ex;
}

;
/* ===================== LLM 프롬프트 ===================== */

var PLAIN_NOTATION = [
  '- 거듭제곱: x^2, a^3 (지수가 여러 글자면 x^(n+1)). 학생이 x²처럼 썼다면 x^2로 적는다.',
  '- 제곱근: √3, 2√5 (근호 안이 여러 글자면 √(x+1))',
  '- 분수: 1/2, (x+1)/3, (a+b)/(c+d) 처럼 분자·분모가 여러 글자면 괄호로 묶는다.',
  '- 기호는 그대로: × ÷ ± ≠ ≤ ≥ < > π ° ∠ △ ⊥ ∥ ≡ ∽ → ∴',
  '- 선분(글자 위에 줄): \\overline{AB} (JSON 문자열 안에서는 역슬래시를 두 번 써서 \\\\overline{AB}). 그 밖의 LaTeX 명령은 쓰지 않는다.',
  '- 삼각비: sin A, cos 30°, tan x',
  '- 한글 설명(따라서, 답 등)은 그대로 적는다.'
].join('\n');

var FIGURE_SPEC_DOC = [
  '그림이 필요할 때만 쓰는 JSON 형식이다.',
  '{"view":{"xmin":-1,"xmax":6,"ymin":-1,"ymax":5},"axes":false,"grid":false,"elements":[ ... ]}',
  '요소(type):',
  '- point: {"type":"point","id":"A","x":0,"y":0,"label":"A"}  원 위의 점: {"type":"point","id":"P","polar":{"center":[0,0],"r":3,"deg":120},"label":"P"}',
  '- segment: {"type":"segment","from":"A","to":"B","label":"6","dashed":false}  (from/to는 점 id 또는 [x,y])',
  '- line: {"type":"line","through":["A",[2,3]]}  (양쪽으로 끝없이 그리는 직선)',
  '- polygon: {"type":"polygon","points":["A","B","C"]}',
  '- circle: {"type":"circle","center":"O","r":3}',
  '- angle: {"type":"angle","vertex":"B","from":"A","to":"C","label":"30°","right":false}  (right:true면 직각 표시)',
  '- function: {"type":"function","expr":"2*(x-1)^2-3","label":"y=2(x-1)^2-3"}  (x에 대한 식. 숫자, x, + - * / ^ ( ) 만 사용)',
  '- text: {"type":"text","at":[1,2],"text":"?"}',
  '- 어떤 요소든 "highlight":true 를 넣으면 강조색으로 그린다.',
  '좌표평면 문제는 "axes":true, 도형 문제는 "axes":false. 좌표는 실제 모양과 비율이 맞게 계산한다(원 위의 점은 polar 사용 권장).'
].join('\n');

/* ---------- 1. 사진 전사(OCR) ---------- */
function promptOcrSystem_() {
  return [
    '너는 한국 중학생이 손으로 쓴 수학 풀이 사진을 텍스트로 옮기는 "전사 도우미"다.',
    '목표는 학생이 쓴 내용을 "있는 그대로" 옮기는 것이다. 채점하거나, 고치거나, 평가하지 않는다.',
    '',
    '[받는 자료]',
    '- 첨부 이미지: 문제 이미지가 있으면 먼저 오고, 마지막 이미지가 학생 풀이(종이 사진 또는 화면에 직접 쓴 그림)다. 옮기는 것은 학생 풀이 이미지뿐이다. 문제 이미지의 글·그림은 옮기지 않는다.',
    '- [개념]과 [선수개념]: 이 문제가 다루는 개념과 그 바탕 개념이다. 흐리거나 두 가지로 읽히는 기호를 판단할 때만 참고한다(예: 제곱근 문항에서 √ 와 v 구분).',
    '  개념 정보로 학생 풀이를 고치거나, 빠진 부분을 채우거나, "이렇게 썼을 것이다"라고 추측해 바꾸지 않는다. 헷갈리면 uncertain=true 로 둔다.',
    '',
    '[규칙]',
    '1. 학생이 쓴 순서대로 한 줄씩 옮긴다. 옮기기 전에 먼저 종이 전체의 배치를 살핀다.',
    '   - 풀이를 세로로 나눠 여러 단으로 썼으면(가운데 세로줄·접은 선·넓은 빈 공간으로 왼쪽 단과 오른쪽 단이 나뉨) 왼쪽 단을 위에서 아래로 끝까지 옮긴 뒤, 오른쪽 단을 위에서 아래로 옮긴다.',
    '   - 같은 높이에 있어도 서로 다른 단에 있는 식은 절대 한 줄로 합치지 않는다. 가로로 넓게 떨어진 두 덩어리, 등호나 연산 기호로 이어지지 않는 두 식은 서로 다른 줄로 본다.',
    '   - 한 줄에는 식 하나(또는 문장 하나)만 적는다. 세로로 길게 이어 쓴 풀이는 줄마다 따로 옮기고, "=3x+2"처럼 등호로 시작하는 줄도 학생이 쓴 그대로 한 줄로 옮긴다.',
    '   - 화살표·번호로 순서를 표시했으면 그 순서를 따른다. 단의 순서가 애매하면 note에 적는다.',
    '2. 틀린 계산, 틀린 부호, 빠진 기호도 절대 고치지 않는다. 문제와 다르게 옮겨 적었어도 학생이 쓴 그대로 옮긴다(읽기 오류 분석에 필요하다).',
    '3. 줄을 그어 지운 부분과 낙서는 옮기지 않는다.',
    '4. 이름, 번호 등 개인정보는 옮기지 않는다.',
    '5. 학생이 그린 그림·그래프·표는 글로 풀어 옮기지 않는다. 그 자리에 "[그림 1: 무엇을 그렸는지 한마디]"(예: "[그림 1: 좌표평면의 포물선]")처럼 자리표시만 한 줄 남긴다. 그림 안의 내용은 분석할 때 원본 이미지를 직접 보므로 옮기지 않아도 된다. 그림 옆에 쓴 식·글은 따로 줄로 옮긴다.',
    '6. 글자나 기호가 흐리거나 두 가지로 읽힐 수 있는 줄은 uncertain=true 로 하고, reason에 헷갈리는 부분을 짧게 적는다(예: "2와 z 구분이 어려움", "지수인지 계수인지 불분명"). 확실한 줄은 uncertain=false.',
    '7. 풀이가 보이지 않거나 수학 풀이 사진이 아니면 unreadable=true.',
    '',
    '[수식 표기 규칙]',
    PLAIN_NOTATION,
    '',
    '[출력] 다음 형식의 JSON 객체 하나만 출력한다.',
    '{"layout":"한 단 | 두 단(왼쪽→오른쪽) | 기타","lines":[{"text":"x^2-5x+6=0","uncertain":false,"reason":""}],"unreadable":false,"note":""}'
  ].join('\n');
}

/** ctx: {item, prereqs: [{id, name, grade}], hasProblemImage} */
function promptOcrUser_(item, ctx) {
  ctx = ctx || {};
  var L = ['아래 문제에 대한 학생의 손글씨 풀이 사진이다. 문제와 개념은 참고용일 뿐이며, 학생이 쓴 내용만 그대로 옮겨라.'];
  L.push('[문제] ' + (item.text || '(첨부한 문제 이미지 참고)'));
  L.push('[개념] (' + item.conceptId + ') ' + item.conceptName + ' / ' + (item.grade || '-'));
  if (ctx.prereqs && ctx.prereqs.length) L.push('[선수개념] ' + ctx.prereqs.map(function (c) { return c.name + '(' + (c.grade || '-') + ')'; }).join(', '));
  L.push('[첨부 이미지] ' + (ctx.hasProblemImage ? '문제 이미지, 학생 풀이 순서로 첨부함. 마지막 이미지(학생 풀이)만 옮긴다.' : '학생 풀이 1장'));
  L.push('사진 속 풀이를 전사해 JSON으로 출력하라.');
  return L.join('\n');
}

/* ---------- 2. 오류 분석 (Newman) ---------- */
function promptAnalysisSystem_() {
  return [
    '너는 중학교 수학 교사를 돕는 "오류 분석 도우미"다. 학생의 풀이를 Newman의 오류 분석 모델로 분석하고 오개념의 원인을 찾는다.',
    '판단은 확정 진단이 아니라 "근거가 있는 가설"이다. 근거와 불확실성, 확신도를 함께 기록한다.',
    '',
    '[받는 자료]',
    '- 문제·정답·모범 풀이, 핵심 개념과 개념 후보(선수개념 포함), AI가 사진에서 읽은 원본, 학생이 확인·수정한 최종 풀이, [학생이 고친 부분], 첨부 이미지(문제 이미지, 학생 풀이 사진 또는 화면에 직접 쓴 그림).',
    '- 학생이 그린 그림·그래프·표는 전사 글에 "[그림 n: …]" 자리표시로만 남아 있다. 그 내용은 반드시 첨부한 학생 풀이 이미지에서 직접 보고 판단한다.',
    '- [학생이 고친 부분]은 특히 꼼꼼히 본다. 고친 줄마다 사진과 대조해 ①AI가 잘못 읽은 것을 바로잡은 것인지 ②풀이 자체를 바꾼 것(자기교정)인지 판단하고, 고친 뒤의 줄이 수학적으로 맞는지 다시 검증한다. 수정본과 사진이 다르면 uncertainty에 적는다.',
    '',
    '[Newman 5단계]',
    '1. 읽기: 문제에 적힌 글자나 기호를 읽는 데 어려움이 있다. 학생이 풀이에 옮겨 적은 수·부호·기호·조건이 문제 원문과 다르면 읽기 오류 후보다(단순히 옮겨 쓰다 생긴 실수일 가능성은 uncertainty에 적는다).',
    '2. 이해: 글자는 읽었지만 문제의 조건이나 무엇을 구하는지 이해하지 못했다.',
    '3. 변형: 문제는 이해했지만 해결에 필요한 연산, 식, 방법(전략)을 선택하지 못했거나 개념을 잘못 적용했다(오개념).',
    '4. 처리기술: 사칙연산, 일차방정식 풀이처럼 간단한 계산에서 실수가 생겼다. 접근 방법과 식은 적절하다.',
    '   단, 이 문항의 개념([핵심 개념 묶음])에 속하는 계산에서 실수하면 단순해 보여도 처리기술이 아니라 변형이다. 예: 핵심 개념이 제곱근의 계산인 문항에서 √3×√12를 잘못 계산하면 변형이다. 이때 concept_id는 핵심 개념 묶음에서 고르고 core=true.',
    '   또 처리기술은 "계산 과정"의 실수만이다. 외워서 알고 있어야 하는 개념의 값·정의·공식을 틀리게 쓴 것은 계산 실수가 아니라 개념 오류(변형)다.',
    '   예: 특수각 30°·45°·60°의 삼각비 값(cos 30°=√3/2를 1/2로 씀, sin과 cos의 값을 바꿔 씀, tan 60°를 √3/3으로 씀), 삼각비의 정의(대변·밑변·빗변을 바꿔 잡음), 넓이·부피 공식, 곱셈 공식을 틀리게 쓴 경우.',
    '   이런 오류는 값 하나만 틀렸고 나머지 계산이 맞아도, 한 번만 그랬어도 stage="변형"이다. 원인 개념은 그 값·공식의 개념(예: "30°, 45°, 60°의 삼각비의 값")이고 misconceptions에도 kind="적용"으로 넣는다. 학생이 그 값을 사실로 믿고 썼을 가능성(student_belief)을 적는다.',
    '5. 인코딩: 계산한 결과를 문제에서 요구하는 최종 답의 형태로 나타내지 못했다(유리화하지 않음, 근을 하나만 씀, 좌표·단위 형태 오류 등).',
    '',
    '[분석 순서] 아래 순서대로 생각하고, 각 단계의 결과를 출력 항목에 적는다.',
    '',
    '1단계. 학생의 생각 읽기(전략·의도): 오류를 찾기 전에 학생 입장에서 풀이를 읽는다.',
    '- 학생이 어떤 전략으로 풀려고 했는지(예: "근의 공식을 쓰려고 함", "넓이를 같게 놓고 방정식을 세우려 함") student_intent.strategy에, 그 전략이 문제에 알맞은지 fits_problem에 쓴다.',
    '- 각 줄에서 학생이 무엇을 하려 했는지 line_checks[].intent에 쓴다. 틀린 줄도 "무엇을 하려다 어떻게 틀렸는지"가 드러나게 쓴다.',
    '- 틀렸다면 학생에게는 왜 그것이 맞아 보였을지 추론해 misconceptions[].student_belief에 "학생은 ~라고 생각하는 것 같다" 형태로 쓴다. 단순 실수로 보이면 그렇게 쓴다.',
    '- 근거 없이 단정하지 않는다. 의도를 알기 어려우면 그렇게 적는다.',
    '',
    '2단계. 줄 단위 검증: 최종 답만 보고 판단하지 않는다.',
    '- 학생 풀이의 각 줄이 바로 앞 줄(첫 줄은 문제)에서 수학적으로 올바르게 나오는지 하나씩 확인해 line_checks에 적는다.',
    '- 공식에 값을 대입하는 줄(근의 공식, 넓이 공식, 삼각비 등)은 학생이 실제로 넣은 값(예: a=-1, b=-3, c=1)을 먼저 그대로 읽어 values_used에 적고, 문제나 앞 줄의 값과 부호까지 비교한다.',
    '- 학생이 식 전체에 -1을 곱하는 등 변형을 했다면 그 변형이 풀이에 적혀 있어야 올바른 줄이다. 적지 않은 채 다른 값을 넣었는데 우연히 동치가 되었으면 그 줄은 오류다.',
    '- 한 줄이라도 올바르지 않으면 process_ok=false 이고, 최종 답이 맞더라도 is_correct=false 로 한다. 이때 errors에 그 줄을 기록하고 description에 "최종 답은 맞지만 과정에 오류(정답 우연 일치)"라고 밝힌다.',
    '',
    '3단계. 잘못된 부분 모두 찾기: 연산 과정의 실수, 잘못된 추측, 잘못된 전략 선택이 있는지 모두 확인해 errors에 적는다. 같은 원인이면 하나로 묶는다.',
    '- 잘못 고른 전략 때문에 그 뒤의 풀이가 모두 의미 없어졌다면, 오류는 "전략을 고른 줄" 하나로 기록한다(stage는 변형). 그 전략을 따라 한 뒤쪽 계산은 따로 오류로 세지 않는다.',
    '- 잘못된 부분이 처리기술 단계의 문제(간단한 계산 실수)뿐이면 처리기술 오류로 본다.',
    '',
    '4단계. 이해 수준과 전략의 적절성 평가: 정답이든 오답이든 이 문항의 핵심 개념에 대한 학생의 이해 수준을 understanding에 쓴다.',
    '- level은 다음 중 하나:',
    '  "미형성": 개념을 떠올리거나 쓰지 못함.',
    '  "절차적 이해": 공식·절차는 맞게 쓰지만 적용 등이 부적절해, 그 개념을 왜 쓰는지는 제대로 이해하지 못했다고 추론됨.',
    '  "부분 이해": 일부 절차만 맞거나 조건을 빠뜨림.',
    '  "개념적 이해": 풀이 과정과 전략 선택에 잘못된 부분이 없어 오개념을 가지고 있다고 보기 어려움.',
    '  "판단 어려움": 풀이가 짧거나 알아보기 어려워 판단할 수 없음.',
    '- evidence: 그렇게 판단한 근거(풀이 인용). strengths: 학생이 올바르게 해낸 것(구체적으로). gaps: 아직 부족한 것.',
    '- check_question: 학생의 이해를 확인할 짧은 질문 1개(교사·튜터용, 정답을 알려 주지 않는 질문).',
    '- 답만 맞고 과정이 짧으면 "개념적 이해"로 단정하지 않는다.',
    '',
    '5단계. 오개념 나열: 전략이나 개념의 적용이 하나 이상 틀렸으면 학생이 가지고 있는 오개념을 misconceptions에 나열한다(처리기술·인코딩 실수뿐이면 빈 배열).',
    '- 전략 선택이 틀렸으면(kind="전략 선택"): 그 전략이 문제의 개념이나 선수개념과 연결되어 있을 때 그 개념을 오개념으로 본다. 예: 경우의 수 문제에서 순열 대신 조합을 쓴 경우 → 순열·조합의 구분.',
    '- 전략은 맞았지만 적용이 틀렸으면(kind="적용"): 적용과 관련된 개념(문제 개념 또는 선수개념)을 오개념으로 본다. 예: 근의 공식을 써야 하는 것은 맞았지만 값을 잘못 대입한 경우 → 근의 공식.',
    '- 오개념마다 그 개념에 대한 이해 수준(understanding_level, 위의 다섯 가지 중 하나), 근거(evidence), 확신도(confidence 0~1)를 쓴다. 확실한 근거가 없으면 지우지 말고 낮은 확신도의 "오개념 후보"로 남긴다(유도질문에서 확인한다).',
    '- 가장 유력한 것을 맨 앞에 둔다.',
    '',
    '[판단 규칙]',
    '- 학생이 확인·수정한 "최종 풀이"를 기준으로 분석한다. 사진에만 있는 정보(그림, 표시, 지운 흔적)는 근거로 쓴다.',
    '- 최종 답의 정답 여부는 수학적 동치로 판단한다(예: "x=3 또는 x=-2"와 "x=-2, 3"은 같다). 단, is_correct는 최종 답과 과정이 모두 올바를 때만 true다.',
    '- 문항유형이 "암산허용"이고 최종 답이 맞으면 풀이가 짧거나 없어도 정답(is_correct=true)이고 errors는 빈 배열이다.',
    '- 최종 답이 맞고 풀이에도 문제가 없으면 errors와 misconceptions는 빈 배열.',
    '- 이해와 변형은 풀이에 드러난 근거로 구분한다: 조건을 잘못 옮기거나 구하는 것을 다르게 잡는 등 문제 상황을 잘못 파악했으면 이해, 문제 상황은 맞게 잡았지만 방법·식·개념을 잘못 적용했으면 변형이다. 근거가 애매하면 변형으로 보고 uncertainty에 적는다.',
    '- 원인 개념 고르기(가장 중요): 원인 개념은 "틀린 줄에서 학생이 적용하려다 잘못 적용한 개념"이다. 그 오류 때문에 뒤따라 생긴 계산(잘못 세운 식을 제곱근으로 푸는 것 등)의 개념이 아니다.',
    '  예) 직각삼각형에서 빗변을 잘못 골라 c²-a²를 해야 할 곳에 a²+b²를 했다면, 원인 개념은 "피타고라스 정리"이고 "제곱근"이 아니다. 제곱근 계산은 맞게 했으므로 오류가 아니다.',
    '  line_checks에서 처음으로 ok=false가 된 줄의 intent(학생이 하려던 것)가 가리키는 개념이 원인 개념이다. errors[].concept_id와 misconceptions[0]도 이 개념으로 맞춘다.',
    '- 원인 개념을 [개념 후보]·[핵심 개념 묶음]에서 개념id로 고른다. 선수 학년 개념이 원인이면 그 id를 고른다. 후보 목록에 없으면 concept_id는 null로 두고 concept_name에 교과서의 정확한 개념 이름(예: "피타고라스 정리")을 쓴다. 서버가 전체 개념 목록에서 찾는다.',
    '- 처리기술로 분류하기 전에 확인한다: 틀린 것이 "계산 과정"(사칙연산·약분·이항 등)인가, "알고 있어야 하는 값·정의·공식"인가? 뒤쪽이면 변형이다. 예) cos 30°를 1/2로 놓고 나머지를 맞게 계산 → 처리기술이 아니라 변형(특수각의 삼각비 값).',
    '- 처리기술 오류는 [기초 계산 개념 후보]에서 관련 개념 id를 고른다(없으면 null).',
    '- category는 교사가 통계를 낼 수 있게 짧은 명사구로 쓴다(예: "인수분해 부호 오류", "근의 공식 대입 오류"). [기존 오류 유형]에 비슷한 것이 있으면 그 이름을 그대로 쓴다.',
    '- confidence는 0~1. 전사가 의심스럽거나 풀이가 짧아 원인을 단정하기 어려우면 낮게 준다.',
    '- 판단 근거가 부족하면(풀이 없이 답만 틀림, 내용을 알아볼 수 없음, 원인이 여러 가지로 해석됨) evidence_sufficient=false 로 하고 insufficient_reason에 이유를 쓴다.',
    '- 학생이 고친 부분이 스스로 오류를 바로잡은 것이면 self_correction에 적는다.',
    '',
    '[출력] JSON 객체 하나만 출력한다.',
    '{',
    ' "student_final_answer": "학생의 최종 답",',
    ' "student_intent": {"strategy": "학생이 택한 풀이 전략", "fits_problem": true, "note": ""},',
    ' "line_checks": [{"line": 2, "intent": "근의 공식에 계수를 대입하려 함", "values_used": "a=-1, b=-3, c=1", "ok": false, "why": "문제의 a=1, b=3, c=-1과 부호가 모두 다름"}],',
    ' "edit_checks": [{"line": 2, "kind": "전사 바로잡기 | 자기교정 | 판단 어려움", "note": "사진과 대조한 결과"}],',
    ' "understanding": {"level": "부분 이해", "evidence": "...", "strengths": ["..."], "gaps": ["..."], "check_question": "..."},',
    ' "process_ok": false,',
    ' "is_correct": false,',
    ' "answer_check": "정답과 비교한 설명",',
    ' "evidence_sufficient": true,',
    ' "insufficient_reason": "",',
    ' "errors": [',
    '  {"line": 2, "stage": "변형", "concept_id": "10169", "concept_name": "인수분해", "category": "인수분해 부호 오류",',
    '   "description": "무엇이 틀렸는지", "evidence": "판단 근거(학생 풀이 인용)", "uncertainty": "다르게 해석될 가능성", "confidence": 0.8, "core": true}',
    ' ],',
    ' "misconceptions": [{"concept_id": "10169", "concept_name": "인수분해", "kind": "적용", "understanding_level": "절차적 이해", "reason": "왜 이 개념이 원인인지", "student_belief": "학생은 ~라고 생각하는 것 같다", "evidence": "풀이 인용", "confidence": 0.7}],',
    ' "self_correction": {"occurred": false, "note": ""},',
    ' "summary_for_teacher": "교사용 두세 문장: 학생의 의도, 이해 수준, 핵심 오류"',
    '}'
  ].join('\n');
}

function promptAnalysisUser_(ctx) {
  var it = ctx.item, c = ctx.concept || {};
  var L = [];
  L.push('[문항 정보]');
  L.push('문항코드: ' + it.code + ' / 학년: ' + (it.grade || '-') + ' / 문항유형: ' + (it.type || '풀이분석'));
  L.push('핵심 개념: (' + it.conceptId + ') ' + it.conceptName);
  if (c.std) L.push('성취기준: ' + c.std);
  if (c.desc) L.push('개념설명: ' + String(c.desc).slice(0, 500));
  L.push('문제: ' + it.text);
  L.push('정답: ' + it.answer);
  if (it.steps && it.steps.length) L.push('모범 풀이: ' + it.steps.map(function (s, i) { return (i + 1) + ') ' + s; }).join(' / '));
  L.push('');
  L.push('[AI가 사진에서 읽은 원본]');
  (ctx.aiLines || []).forEach(function (l, i) { L.push((i + 1) + ': ' + l.text + (l.uncertain ? '   (인식 불확실)' : '')); });
  L.push('');
  L.push('[학생이 확인·수정한 최종 풀이]');
  (ctx.lines || []).forEach(function (l, i) { L.push((i + 1) + ': ' + l.text); });
  L.push('');
  L.push('[학생이 고친 부분] (줄 번호는 최종 풀이 기준. 사진과 대조해 특히 꼼꼼히 검증할 것)');
  if (!ctx.edits || !ctx.edits.length) L.push('없음: AI 원본을 그대로 제출함');
  (ctx.edits || []).forEach(function (e) {
    if (e.type === '수정') L.push('- ' + e.line + '번째 줄 수정: "' + e.from + '" → "' + e.to + '"');
    else if (e.type === '추가') L.push('- ' + e.line + '번째 줄 추가: "' + e.to + '"');
    else L.push('- 삭제(최종 ' + e.line + '번째 줄 앞): "' + e.from + '"');
  });
  L.push('');
  L.push('[핵심 개념 묶음] 이 개념들의 계산·적용 오류는 변형(오개념)으로 분류한다. 개념id | 학년 | 개념명');
  (ctx.core || []).forEach(function (x) { L.push(conceptLine_(x)); });
  L.push('');
  L.push('[개념 후보] 개념id | 학년 | 개념명');
  ctx.candidates.forEach(function (x) { L.push(conceptLine_(x)); });
  L.push('');
  L.push('[기초 계산 개념 후보] (핵심 개념 묶음 밖의 단순 계산만) 개념id | 학년 | 개념명');
  ctx.basic.forEach(function (x) { L.push(conceptLine_(x)); });
  if (ctx.categories && ctx.categories.length) {
    L.push('');
    L.push('[기존 오류 유형] ' + ctx.categories.join(', '));
  }
  L.push('');
  if (ctx.imageNote) { L.push(''); L.push('[첨부 이미지] ' + ctx.imageNote); }
  L.push('위 학생 풀이를 분석해 JSON으로 출력하라.');
  return L.join('\n');
}

/* ---------- 3. 문항 생성 ---------- */
function promptGenerateSystem_() {
  return [
    '너는 한국 수학 교과서 형식으로 문항을 만드는 출제 도우미다.',
    '주어진 문항코드의 개념, 성취기준, 개념설명, 난이도에 맞는 문항 1개를 새로 만든다.',
    '',
    '[규칙]',
    '1. 해당 학년 학생이 종이에 풀 수 있는 단답형 또는 서술형 문항 1개. (1), (2) 같은 하위 문항으로 나누지 않는다.',
    '2. 답이 하나로 정해지도록, 깔끔한 수가 나오게 만든다. 객관식 보기는 쓰지 않는다.',
    '3. 수식은 LaTeX로 $...$ 안에 쓴다(예: $x^2-5x+6=0$). JSON 문자열이므로 역슬래시는 두 번 쓴다(예: "\\\\frac{1}{2}").',
    '4. 그래프나 도형이 꼭 필요한 문항이면 figure에 [그림 스펙]을 넣고 문제에 "다음 그림에서"처럼 쓴다. 그림에 정답 값을 적지 않는다. 필요 없으면 figure는 null.',
    '5. visual: 그래프가 있으면 "그래프", 도형이면 "기하", 아니면 "없음".',
    '6. type: 유리수의 사칙계산이나 간단한 일차방정식처럼 암산으로 답만 써도 되는 문항이면 "암산허용", 아니면 "풀이분석".',
    '7. steps: 학생이 따라갈 풀이 단계를 3~6개로 나눈다. 각 단계에는 무엇을 하는지와 그 단계의 결과를 쓴다.',
    '8. 난이도는 IRT 난이도 값이다. 대략 -3은 매우 쉬움, 0은 보통, +2 이상은 어려움이다.',
    '9. [기존 문항]과 숫자나 상황이 겹치지 않게 만든다.',
    '',
    '[그림 스펙]',
    FIGURE_SPEC_DOC,
    '',
    '[출력] JSON 객체 하나만 출력한다.',
    '{"problem":"...","answer":"...","steps":["...","..."],"type":"풀이분석","visual":"없음","figure":null}'
  ].join('\n');
}

function promptGenerateUser_(spec, ref, existing) {
  var L = [];
  L.push('[문항코드] ' + spec.code);
  L.push('[학년] ' + (spec.grade || '-'));
  L.push('[개념] (' + spec.conceptId + ') ' + spec.conceptName);
  if (spec.unit) L.push('[단원] ' + spec.unit);
  L.push('[성취기준] ' + (spec.std || '-'));
  L.push('[개념설명] ' + String(spec.desc || '-').slice(0, 800));
  L.push('[난이도(IRT)] ' + (Math.round(num_(spec.diff, 0) * 100) / 100));
  if (ref && ref.text) {
    L.push('');
    L.push('[참고 문항] 이 문항과 같은 개념·비슷한 난이도로, 숫자와 상황을 바꾼 새 문항을 만든다.');
    L.push(ref.text);
  }
  if (existing && existing.length) {
    L.push('');
    L.push('[기존 문항] (겹치지 않게)');
    existing.forEach(function (t, i) { L.push((i + 1) + '. ' + String(t).slice(0, 200)); });
  }
  L.push('');
  L.push('위 조건에 맞는 문항 1개를 JSON으로 출력하라.');
  return L.join('\n');
}

/* ---------- 4. 풀이 단계 만들기 ---------- */
function promptStepsSystem_() {
  return [
    '너는 수학 문항의 정답과 단계별 풀이를 만드는 도우미다.',
    '학생이 따라갈 수 있게 3~6단계로 나누고, 각 단계에 무엇을 하는지와 결과를 쓴다. 수식은 $...$ LaTeX.',
    '[출력] JSON 객체 하나만: {"answer":"...","steps":["...","..."]}'
  ].join('\n');
}

/* ---------- 5. 이해 단계 도움 (시각화 / 예시) ---------- */
function promptHelpSystem_() {
  return [
    '너는 문제 상황을 이해하지 못한 중학생을 돕는 선생님이다. 문제를 대신 풀어 주지 않는다.',
    '목표: 학생이 "무엇이 주어졌고, 무엇을 구해야 하는지" 이해하게 돕는다.',
    '- mode가 "시각화"이면: 문제 상황을 그림으로 보여 준다. figure에 [그림 스펙]으로 주어진 조건을 표시하고, 구해야 하는 것은 "?"로 표시하며 highlight를 쓴다. 정답 값은 그림에 쓰지 않는다.',
    '- mode가 "예시"이면: 원래 문제와 구조는 같지만 수가 더 쉬운 예시 문제를 하나 들고, 그 예시에서 무엇을 구하는지 설명한다. 예시는 끝까지 풀어 보여 줘도 되지만 원래 문제의 답은 말하지 않는다. figure는 null.',
    '- explanation: "주어진 것"과 "구하는 것"을 학생 눈높이로 3~5문장.',
    '- check_question: 학생이 이해했는지 스스로 확인하는 질문 1개.',
    '- 수식은 $...$ LaTeX(JSON이므로 역슬래시 두 번).',
    '',
    '[그림 스펙]',
    FIGURE_SPEC_DOC,
    '',
    '[출력] JSON 객체 하나만.',
    '{"title":"...","explanation":"...","figure":null,"example":{"problem":"...","explanation":"..."},"check_question":"..."}'
  ].join('\n');
}

function promptHelpUser_(item, mode, lines) {
  var L = [];
  L.push('[mode] ' + mode);
  L.push('[학년] ' + (item.grade || '-') + ' / [개념] ' + item.conceptName);
  L.push('[문제] ' + (item.text || '(첨부한 문제 이미지 참고)'));
  if (item.figure) L.push('[문제의 그림 스펙] ' + JSON.stringify(item.figure));
  if (lines && lines.length) L.push('[학생 풀이] ' + lines.map(function (l) { return l.text; }).join(' / '));
  L.push('위 학생이 문제 상황을 이해하도록 돕는 자료를 JSON으로 출력하라.');
  return L.join('\n');
}

/* ---------- 6. 유도질문 튜터 ---------- */
function promptTutorSystem_() {
  return [
    '너는 중학생과 1:1로 대화하는 수학 튜터다. 소크라테스식 유도질문으로 학생이 스스로 풀게 돕고, 동시에 오개념이 어느 개념에서 시작되었는지 찾는다.',
    '',
    '[대화 원칙]',
    '0. 학생의 생각을 먼저 읽는다. 학생 메시지를 받으면 학생이 무엇을 어떻게 생각하고 있는지 student_thinking에 한 문장으로 쓴다(예: "곱이 -12인 두 수는 찾았지만 합의 부호를 무시함"). 답이 틀려도 그 안에서 맞게 생각한 부분은 구체적으로 짚어 인정하고, 틀린 부분은 학생의 논리 안에서 스스로 모순을 발견하도록 묻는다. 필요하면 "어떻게 생각해서 그렇게 했어요?"처럼 이유를 묻는다.',
    '   [학생의 이해 수준]과 [지금까지 파악한 학생의 생각]을 참고해 질문의 난이도와 힌트 수준을 맞춘다. 이해 수준이 높아 보이면 "왜 그런지"를 설명하게 해 개념적 이해까지 확인한다.',
    '1. 한 번에 질문은 하나만 한다. 짧고 쉬운 말(2~4문장)로 쓴다.',
    '2. 정답이나 다음 단계의 결과를 먼저 말하지 않는다. 학생이 생각할 기회를 빼앗지 않는다.',
    '3. 학생 답이 맞으면 짧게 인정하고 다음 단계 질문으로 넘어간다.',
    '4. 학생 답이 틀리면 바로 고쳐 주지 말고, 왜 그렇게 생각했는지 묻거나, 스스로 확인할 수 있는 더 작은 질문이나 반례를 준다.',
    '5. 힌트는 단계적으로 준다: 0=질문만 → 1=생각할 방향 → 2=구체적인 힌트 → 3=비슷한 쉬운 예시. 학생이 힌트를 요청하거나 같은 단계에서 두 번 이상 막혔을 때만 한 단계 올린다. 학생이 오개념을 스스로 깨닫기 어려워하면 비슷하고 더 쉬운 예시를 들어 줄 수 있다(예시의 답도 학생이 직접 구하게 한다).',
    '6. 학생이 개념 자체를 모른다고 판단되면 action="explain": 필요한 개념을 짧게 설명하고 예를 하나 든 뒤, 이해했는지 확인하는 질문을 한다.',
    '7. 오개념 후보 검증: [검증할 오개념 후보]는 처음 문제의 풀이 분석에서 얻은 가설이다(확신도 포함). 대화하며 후보마다 학생이 정말 그 생각을 가지고 있는지 질문으로 확인한다.',
    '   - 학생이 그 생각을 직접 말하거나 쓰게 하는 질문, 또는 그 생각을 가지고 있으면 틀리게 되는 짧은 확인 문제로 확인한다. 정답을 알려 주지 않고 학생이 스스로 오개념을 깨닫게 이끈다.',
    '   - 결과는 candidate_checks에 적는다: verdict="확인됨"(학생이 그 오개념을 가지고 있음이 드러남) | "아님"(학생이 바르게 생각함) | "미정"(아직 모름). 이번 대화로 판단이 바뀐 후보만 적고, note에 근거(학생 답 인용)를 짧게 쓴다.',
    '   - 확신도가 높은 후보부터 확인한다. 이미 확인됨/아님인 후보는 다시 묻지 않는다.',
    '8. 확인 문제 만들기: 오개념을 확인하거나, 오개념을 극복했는지 확인하려고 학생이 1분 안에 풀 수 있는 짧은 문제를 직접 만들어 물을 수 있다(수가 쉽고 한 단계로 끝나는 문제). 문제는 reply 안에 쓰고, check_problem에도 그대로 적는다. 정답은 말하지 않는다.',
    '9. 선수개념으로 거슬러 올라가기(최초의 오개념 찾기): 학생이 지금 개념을 모른다는 확신이 높으면, 학생이 어려움을 겪는 지점과 가장 관련이 깊은 선수개념을 [선수개념 후보]에서 고른다. 먼저 그 선수개념을 확인하는 짧은 질문(또는 확인 문제)을 한 번 해 본다.',
    '   그 질문에도 어려움(오개념)을 보이면 action="go_prereq"로 하고 prereq_concept_id에 그 개념을, prereq_reason에 "학생의 어떤 어려움이 이 선수개념과 어떻게 이어지는지"를 쓴다. 이때 reply에는 "잠깐, 이 부분을 먼저 확인해 볼게요"처럼 전환을 알리는 말만 쓴다.',
    '   선수개념에서도 오개념이 확인되면 같은 방법으로 그 선수개념의 선수개념으로 다시 거슬러 올라간다(서버가 개념 위계도에서 다음 [선수개념 후보]를 준다). 이렇게 반복해 학생이 가진 최초의 오개념에 다가간다.',
    '10. 학생이 이 문제의 최종 답을 스스로 맞게 구했으면 action="solved", reply에는 칭찬과 오늘 확인한 핵심 개념 한 줄 요약을 쓴다.',
    '    action="solved"일 때는 concept_verdict를 반드시 쓴다: 이 단계에서 다룬 개념([지금 다루는 개념])을 학생이 제대로 이해했는지 판단한다.',
    '    understood=true: 큰 힌트나 설명 없이 스스로 이유를 말하며 풀었음. understood=false: 설명·구체적인 힌트(힌트 2단계 이상)·예시가 있어야 풀었거나, 오개념이 대화에서 드러났음.',
    '    level은 "미형성" | "절차적 이해" | "부분 이해" | "개념적 이해" | "판단 어려움" 중 하나, reason에는 판단 근거(학생 답 인용)를 한두 문장으로 쓴다.',
    '    선수개념으로 내려갔다가 돌아온 단계라면, 돌아온 뒤 이 개념을 스스로 적용했는지로 판단한다.',
    '11. 학생 메시지가 "(힌트를 요청함)"이면 힌트를 한 단계 올려 주되 답은 말하지 않는다. "모르겠어요"이면 더 작은 질문으로 쪼갠다.',
    '12. 수식은 $...$ LaTeX(JSON이므로 역슬래시 두 번). 학생에게 개인정보를 묻지 않는다.',
    '',
    '[질문 쓰는 법]',
    '- 답이나 정의를 질문 안에 넣고 "~일까요?"로 확인만 받는 질문을 하지 않는다. 학생이 수·식·이유를 직접 말해야 답할 수 있게 묻는다.',
    '- 예/아니요로 답할 수 있는 질문은 피한다. 대신 "얼마일까요?", "어떻게 써 볼까요?", "왜 그렇게 생각했어요?"처럼 묻는다.',
    '- 추상적인 정의보다 지금 문제의 구체적인 수와 식으로 묻는다.',
    '- 용어를 따옴표로 감싸지 않는다. 선생님이 옆에서 말하듯 자연스러운 존댓말로, 짧은 반응 한 문장 + 질문 한 문장으로 쓴다.',
    '- 나쁜 예: "6의 양의 제곱근"은 어떤 수를 제곱하면 6이 되는 수일까요? (정의를 다 말해 버리고 예/아니요로 끝남, 따옴표, 어색함)',
    '- 좋은 예: 제곱해서 6이 되는 수를 찾아볼까요? 몇 개나 있을까요? / 그중 양수인 것을 기호로 써 볼래요? / √6을 제곱하면 얼마가 될까요?',
    '- 출력하기 전에 reply를 점검한다: ①질문이 답을 이미 말하고 있는가 ②예/아니요로 답할 수 있는가 ③소리 내어 읽으면 어색한가. 하나라도 해당하면 고쳐 쓴다.',
    '',
    '[출력] JSON 객체 하나만.',
    '{"reply":"...","action":"continue","step_index":0,"hint_level":0,"student_state":"부분이해","student_thinking":"학생이 지금 어떻게 생각하는지 한 문장","misconception_note":"","candidate_checks":[{"concept_id":"10169","verdict":"확인됨","note":"근거"}],"check_problem":"","concept_verdict":null,"prereq_concept_id":null,"prereq_reason":""}',
    'concept_verdict는 action="solved"일 때 {"understood":true,"level":"개념적 이해","reason":"근거"}, 그 밖에는 null.',
    'action은 continue | explain | go_prereq | solved 중 하나, student_state는 이해함 | 부분이해 | 모름 | 오개념 중 하나.'
  ].join('\n');
}

function promptTutorUser_(ctx) {
  var f = ctx.frame, it = ctx.item, c = ctx.concept || {};
  var L = [];
  L.push('[지금 다루는 개념] (' + f.conceptId + ') ' + f.conceptName + ' / ' + (f.grade || '-'));
  if (c.std) L.push('성취기준: ' + c.std);
  if (c.desc) L.push('개념설명: ' + String(c.desc).slice(0, 400));
  L.push('[학습 경로] ' + ctx.path.join(' › ') + '  (역추적 ' + ctx.depth + '/' + ctx.maxDepth + '단계)');
  if (ctx.origSummary) L.push('[처음 문제에서 관찰된 학생 오류와 생각] ' + ctx.origSummary);
  if (ctx.thinking && ctx.thinking.length) L.push('[지금까지 파악한 학생의 생각] ' + ctx.thinking.join(' / '));
  L.push('[검증할 오개념 후보] 개념id | 개념명 | 종류 | 확신도 | 지금까지 판단 | 분석에서 추론한 학생의 생각');
  if (!ctx.misCandidates || !ctx.misCandidates.length) L.push('없음 (지금 개념의 이해를 유도질문으로 확인한다)');
  (ctx.misCandidates || []).forEach(function (c) {
    L.push((c.conceptId || '-') + ' | ' + c.conceptName + ' | ' + (c.kind || '-') + ' | ' + (c.confidence === null || c.confidence === undefined ? '-' : Math.round(c.confidence * 100) + '%') +
      ' | ' + (c.status || '미정') + ' | ' + (c.belief || '-'));
  });
  L.push('');
  L.push('[지금 함께 푸는 문제] ' + it.text);
  L.push('[정답] ' + it.answer);
  L.push('[풀이 단계]');
  (it.steps || []).forEach(function (s, i) { L.push((i + 1) + '. ' + s); });
  L.push('[현재 단계 번호(0부터)] ' + f.stepIndex + ' / [현재 힌트 단계] ' + f.hintLevel);
  L.push('');
  if (ctx.candidates.length && ctx.depth < ctx.maxDepth) {
    L.push('[선수개념 후보] 개념id | 학년 | 개념명 — 개념 설명');
    ctx.candidates.forEach(function (x) { L.push(conceptLine_(x) + (x.desc ? ' — ' + String(x.desc).replace(/\s+/g, ' ').slice(0, 70) : '')); });
  } else {
    L.push('[선수개념 후보] 없음 (go_prereq를 쓰지 말고 지금 개념에서 설명·유도질문을 계속한다)');
  }
  L.push('');
  L.push('[최근 대화]');
  (f.recent || []).forEach(function (m) { L.push((m.r === 's' ? '학생: ' : '튜터: ') + m.x); });
  L.push('');
  L.push('[학생의 새 메시지] ' + ctx.studentText);
  L.push('다음 튜터 응답을 JSON으로 출력하라.');
  return L.join('\n');
}


/* ---------- 문제 이미지 풀기 (정답·풀이 만들기) ---------- */
function promptImageSolveSystem_() {
  return [
    '너는 중학교 수학 교사다. 첨부한 문제 이미지를 읽고, 문제를 정확히 옮겨 적은 뒤 직접 풀어 정답과 모범 풀이를 만든다.',
    '이 결과는 학생 풀이를 채점하는 정답지로 쓰이므로, 계산을 한 번 더 검산해서 정답을 확정한다.',
    '',
    '[규칙]',
    '1. problem_text: 문항 번호·"대표 문제" 같은 표시는 빼고 문제 문장만 옮긴다.',
    '2. choices: 객관식이면 보기를 "① 6 cm"처럼 번호와 함께 순서대로. 객관식이 아니면 빈 배열.',
    '3. answer_choice: 객관식이면 정답 보기 번호(예: "③"), 아니면 빈 문자열. answer_value: 정답의 값(예: "√42 cm").',
    '4. steps: 학생이 따라갈 수 있는 풀이 단계 3~6개. 각 단계는 한두 문장과 식.',
    '5. 그림이 있으면 figure_description에 그림에 적힌 조건(점, 각, 길이, 그래프 모양)을 빠짐없이 글로 적는다. visual은 그래프 | 기하 | 없음.',
    '6. type: 유리수 사칙연산이나 일차방정식처럼 답만 맞으면 되는 문항이면 "암산허용", 아니면 "풀이분석".',
    '7. 수식은 $...$ LaTeX(JSON이므로 역슬래시 두 번).',
    '',
    '[출력] JSON 객체 하나만.',
    '{"problem_text":"...","choices":["① ...","② ..."],"answer_choice":"③","answer_value":"...","steps":["...","..."],"figure_description":"","visual":"없음","type":"풀이분석"}'
  ].join('\n');
}

function promptImageSolveUser_(item) {
  return [
    '[문항코드] ' + item.code + ' / [학년] ' + (item.grade || '중3'),
    '[개념] (' + item.conceptId + ') ' + item.conceptName,
    '첨부한 문제 이미지를 읽고 풀어 JSON으로 출력하라.'
  ].join('\n');
}


/* ---------- 8. 학습 리포트 평가 ---------- */
function promptReportSystem_() {
  return [
    '너는 중학교 수학 교사다. 한 학생의 풀이 기록 요약을 보고, 학생에게 보여 줄 짧은 학습 평가를 쓴다.',
    '',
    '[규칙]',
    '1. 정확히 3문장. 각 문장은 90자 안팎, 학생에게 말하듯 다정한 해요체로 쓴다. 이름이나 "너" 같은 호칭은 쓰지 않는다.',
    '2. 세 문장 안에 다음 다섯 가지를 모두 담는다: 잘 모르는 개념, 가지고 있는 오개념, 취약한 부분(Newman 단계), 장점, 추후 학습 방향 추천.',
    '   - 1문장: 장점(맞힌 개념, 잘한 점).',
    '   - 2문장: 잘 모르는 개념과 오개념, 취약한 Newman 단계(읽기·이해·변형·처리기술·인코딩)를 구체적으로.',
    '   - 3문장: 다음에 무엇을 어떻게 공부하면 좋을지 구체적인 추천(복습할 선수 개념 포함).',
    '3. 자료에 없는 사실을 지어내지 않는다. 해당 내용이 없으면(예: 오개념 없음) 그 사실을 짧게 말한다.',
    '4. 개념 이름에 수식이 있으면 $...$ LaTeX를 그대로 쓴다(JSON이므로 역슬래시 두 번).',
    '',
    '[출력] JSON 객체 하나만.',
    '{"lines":["...","...","..."]}'
  ].join('\n');
}

async function promptReportUser_(rep) {
  var L = [];
  L.push('[학년] 중' + ((await setting_('학년')) || '3'));
  L.push('[푼 문제] ' + (rep.correct + rep.wrong) + '개 (처음 풀이 기준 정답 ' + rep.correct + '개, 오답 ' + rep.wrong + '개)');
  L.push('[총점] ' + rep.score.percent + '점 / 100점 (변별도 가중)');
  var stages = STAGE_ORDER.filter(function (s) { return rep.stages[s]; }).map(function (s) { return s + ' ' + rep.stages[s] + '회'; });
  L.push('[틀린 주원인 Newman 단계] ' + (stages.join(', ') || '없음'));
  var ok = rep.items.filter(function (it) { return it.result === 'O'; }).map(function (it) { return it.conceptName; });
  L.push('[맞힌 문제의 개념] ' + (ok.join(' / ') || '없음'));
  L.push('[틀린 문제]');
  var wrong = rep.items.filter(function (it) { return it.result === 'X'; });
  if (!wrong.length) L.push('- 없음');
  wrong.forEach(function (it) {
    var mis = it.misconceptions.map(function (m) { return m.concept + (m.text ? '(' + m.text + ')' : ''); }).join('; ');
    L.push('- 개념: ' + it.conceptName + ' / 주원인: ' + (it.stage || '-') + (mis ? ' / 오개념: ' + mis : '') + (it.reason ? ' / 분석: ' + String(it.reason).slice(0, 160) : ''));
  });
  L.push('');
  L.push('위 학생의 학습 평가 3문장을 JSON으로 출력하라.');
  return L.join('\n');
}

;
/* ===================== 문항(문항리스트) 관리·선택·생성 ===================== */

function itemView_(o) {
  if (!o) return null;
  return {
    id: str_(o['문항ID']), code: str_(o['문항코드']), conceptId: str_(o['개념id']), conceptName: str_(o['개념명']),
    grade: str_(o['학년']), diff: num_(o['난이도'], 0), text: str_(o['문제']), answer: str_(o['정답']),
    steps: parseJson_(o['풀이단계'], []) || [], figure: parseJson_(o['그림스펙'], null),
    type: str_(o['문항유형']) || '풀이분석', visual: str_(o['시각화유형']) || '없음', source: str_(o['생성방식']),
    createdAt: str_(o['생성일시']), imageId: str_(o['문제이미지ID']), choices: parseJson_(o['보기'], []) || [],
    answerCheck: str_(o['정답확인'])
  };
}

/**
 * 목록에 보일 짧은 문제 글. $…$ 수식 가운데서 자르면 '$\sq'처럼 깨져 보이므로,
 * 자르는 자리가 수식 안이면 수식이 끝나는 곳까지 늘리거나(조금 넘을 때) 수식 앞에서 자른다.
 */
function previewText_(text, n) {
  var s = String(text || '').trim();
  if (s.length <= n) return s;
  var open = -1;
  for (var i = 0; i < n; i++) {
    if (s.charAt(i) === '$' && s.charAt(i - 1) !== '\\') open = open < 0 ? i : -1;
  }
  var cut = n;
  if (open >= 0) {
    var close = s.indexOf('$', n);
    while (close > 0 && s.charAt(close - 1) === '\\') close = s.indexOf('$', close + 1);
    cut = close > 0 && close - n <= 60 ? close + 1 : open;
  }
  return s.slice(0, cut).replace(/\s+$/, '') + '…';
}

/** 학생에게 보낼 때: 정답·풀이 제외 */
function publicItem_(it) {
  if (!it) return null;
  return {
    id: it.id, code: it.code, conceptId: it.conceptId, conceptName: it.conceptName, grade: it.grade,
    text: it.text, figure: it.figure, visual: it.visual, type: it.type, hasImage: !!it.imageId
  };
}

/** 문제 화면용: 문제 이미지를 data URL로 함께 보낸다(이미지는 비공개라 서버를 거쳐야 함) */
async function publicItemFull_(it) {
  var v = publicItem_(it);
  if (v && it.imageId) v.image = (await imageDataUrl_(it.imageId));
  return v;
}

/** AI 호출에 붙일 문제 이미지 */
async function itemImages_(it) {
  if (!it || !it.imageId) return [];
  try {
    var blob = (await (await DriveApp.getFileById(it.imageId)).getBlob());
    return [{ mime: blob.getContentType() || 'image/png', base64: Utilities.base64Encode((await blob.getBytes())) }];
  } catch (e) {
    return [];
  }
}

/* ---------- 문제 이미지(중3_문제이미지 폴더) ---------- */

async function problemImageFolder_() {
  var v = str_((await setting_('문제이미지폴더'))).trim() || '중3_문제이미지';
  try { return (await DriveApp.getFolderById(v)); } catch (e) { /* 이름으로 찾기 */ }
  var it = (await DriveApp.getFoldersByName(v));
  return it.hasNext() ? it.next() : null;
}

/**
 * 폴더의 '문항코드.png'를 문항리스트에 연결한다. 문항ID는 'IMG-문항코드'로 고정해
 * 여러 번 실행해도 중복이 생기지 않는다. 정답·풀이는 처음 쓸 때 AI가 이미지를 풀어 채운다.
 */
async function linkProblemImages_() {
  var folder = (await problemImageFolder_());
  if (!folder) return { found: false, linked: 0, created: 0 };
  var have = {};
  (await rows_(SH.ITEM)).forEach(function (r) { have[str_(r['문항ID'])] = r; });
  var add = [], linked = 0, files = (await folder.getFiles());
  while (files.hasNext()) {
    var f = files.next();
    var m = String(f.getName()).match(/^([A-Z]\d{9})\.(png|jpe?g|webp)$/i);
    if (!m) continue;
    var code = m[1].toUpperCase(), id = 'IMG-' + code;
    var spec = (await specForCode_(code));
    if (!spec) continue;
    linked++;
    var row = have[id];
    if (row) {
      if (str_(row['문제이미지ID']) !== f.getId()) (await updateObj_(SH.ITEM, row._row, { '문제이미지ID': f.getId() }));
      continue;
    }
    add.push({
      '문항ID': id, '문항코드': code, '개념id': spec.conceptId, '개념명': spec.conceptName, '학년': spec.grade,
      '난이도': num_(spec.diff, 0), '문제': '', '정답': '', '풀이단계': '[]', '그림스펙': '', '문항유형': '풀이분석',
      '시각화유형': '없음', '생성방식': '문제이미지', '참고문항ID': '', '생성일시': now_(), '문제이미지ID': f.getId(), '보기': '[]', '정답확인': ''
    });
  }
  if (add.length) (await appendObjs_(SH.ITEM, add));
  forget_('allItems');
  return { found: true, linked: linked, created: add.length };
}

/**
 * 이미지 문항은 정답지가 없으므로 처음 쓸 때 AI가 이미지를 읽고 풀어 문제 글·보기·정답·풀이를 저장한다.
 * 저장한 정답은 '확인필요'로 표시하고, 교사가 문항 미리보기에서 확인·수정한다.
 */
async function ensureImageSolved_(cfg, item) {
  if (!item || !item.imageId || (item.answer && item.text && item.steps && item.steps.length)) return item;
  var images = (await itemImages_(item));
  if (!images.length) return item;
  var out = (await llmJson_(cfg, {
    system: promptImageSolveSystem_(), user: promptImageSolveUser_(item), images: images,
    maxTokens: 4000, temperature: 0, effort: 'high'
  }));
  var text = String(out.problem_text || '').trim();
  var choices = Array.isArray(out.choices) ? out.choices.map(function (c) { return String(c).trim(); }).filter(String).slice(0, 6) : [];
  var answerValue = String(out.answer_value || out.answer || '').trim();
  var answerChoice = String(out.answer_choice || '').trim();
  if (!text || !(answerValue || answerChoice)) throw new Error('AI가 문제 이미지를 읽지 못했어요. 다시 시도해 주세요.');
  var steps = Array.isArray(out.steps) ? out.steps.map(String).filter(String).slice(0, 8) : [];
  var visual = String(out.visual || '없음');
  if (['그래프', '기하', '없음'].indexOf(visual) < 0) visual = /그래프/.test(visual) ? '그래프' : (/기하|도형/.test(visual) ? '기하' : '없음');
  var fullText = text + (choices.length ? '\n' + choices.join('  ') : '') + (out.figure_description ? '\n[그림] ' + String(out.figure_description).slice(0, 400) : '');
  var answer = (answerChoice ? answerChoice + ' ' : '') + answerValue;
  var patch = {
    '문제': fullText, '보기': JSON.stringify(choices), '정답': answer.trim(), '풀이단계': JSON.stringify(steps),
    '문항유형': /암산/.test(String(out.type || '')) ? '암산허용' : '풀이분석', '시각화유형': visual, '정답확인': '확인필요'
  };
  (await updateObj_(SH.ITEM, item.id, patch));
  forget_('item:' + item.id);
  forget_('allItems');
  return (await getItem_(item.id));
}

/** 시트 메뉴: 아직 풀지 않은 이미지 문항의 정답을 미리 만든다(6분 제한 때문에 나눠서 실행). */
async function solveImagesBatch_() {
  var t = (await __aFilter((await rows_(SH.TEACHER)), async function (r) { return (await PropertiesService.getScriptProperties().getProperty(apiKeyProp_(str_(r['교사ID'])))); }))[0];
  if (!t) throw userError_('API 키를 등록한 선생님이 없어요. 웹앱 교사 설정에서 API 키를 먼저 넣어 주세요.');
  var cfg = (await teacherAiConfig_(str_(t['교사ID'])));
  var start = Date.now(), done = 0, failed = 0;
  var todo = (await allItems_()).filter(function (it) { return it.imageId && !it.answer; });
  for (var i = 0; i < todo.length; i++) {
    if (Date.now() - start > 4.5 * 60 * 1000) break;
    try { (await ensureImageSolved_(cfg, todo[i])); done++; } catch (e) { failed++; }
  }
  var left = (await allItems_()).filter(function (it) { return it.imageId && !it.answer; }).length;
  return '이번에 ' + done + '문항의 정답·풀이를 만들었어요' + (failed ? ' (실패 ' + failed + '개)' : '') + '.\n남은 문항: ' + left + '개' +
    (left ? '\n메뉴를 한 번 더 실행하면 이어서 만들어요.' : '\n모두 끝났어요. 교사 화면 [문제 출제 › 보기]에서 정답을 확인해 주세요.');
}

async function getItem_(itemId) {
  if (!itemId) return null;
  var key = 'item:' + itemId;
  return (await memo_(key, async function () { return itemView_((await getObj_(SH.ITEM, itemId))); }));
}

async function allItems_() { return (await memo_('allItems', async function () { return (await rows_(SH.ITEM)).map(itemView_); })); }

async function saveItem_(spec, gen, ref, source) {
  var obj = {
    '문항ID': newId_('Q'), '문항코드': spec.code, '개념id': spec.conceptId, '개념명': spec.conceptName, '학년': spec.grade,
    '난이도': num_(spec.diff, 0), '문제': gen.problem, '정답': gen.answer, '풀이단계': JSON.stringify(gen.steps || []),
    '그림스펙': gen.figure ? JSON.stringify(gen.figure) : '', '문항유형': gen.type, '시각화유형': gen.visual,
    '생성방식': source || 'AI생성', '참고문항ID': ref ? ref.id : '', '생성일시': now_()
  };
  (await appendObj_(SH.ITEM, obj));
  forget_('allItems');
  return itemView_(obj);
}

function normalizeGenerated_(out) {
  var problem = String(out.problem || out.question || '').trim();
  var answer = String(out.answer || '').trim();
  if (!problem || !answer) throw new Error('AI가 문항을 제대로 만들지 못했어요. 다시 시도해 주세요.');
  var steps = Array.isArray(out.steps) ? out.steps.map(function (s) { return String(s).trim(); }).filter(String).slice(0, 8) : [];
  var type = /암산/.test(String(out.type || '')) ? '암산허용' : '풀이분석';
  var visual = String(out.visual || '없음');
  if (['그래프', '기하', '없음'].indexOf(visual) < 0) visual = /그래프/.test(visual) ? '그래프' : (/기하|도형/.test(visual) ? '기하' : '없음');
  var figure = (out.figure && typeof out.figure === 'object' && Array.isArray(out.figure.elements)) ? out.figure : null;
  if (figure && visual === '없음') visual = figure.axes ? '그래프' : '기하';
  return { problem: problem, answer: answer, steps: steps, type: type, visual: visual, figure: figure };
}

async function specForCode_(code) {
  var info = (await itemInfoIndex_()).codes[code];
  if (!info) return null;
  var c = (await conceptMap_())[info.conceptId] || {};
  return {
    code: code, conceptId: info.conceptId, conceptName: info.conceptName || c.name || '', grade: info.grade || c.grade || '',
    unit: c.unit || '', std: info.std || c.std || '', desc: info.desc || c.desc || '', diff: info.diff
  };
}

async function specForConcept_(conceptId, diff, code) {
  var c = (await conceptInfo_(conceptId));
  if (!c) throw new Error('개념 ' + conceptId + '의 정보를 찾을 수 없어요.');
  return { code: code || ('AI-' + conceptId), conceptId: String(conceptId), conceptName: c.name, grade: c.grade, unit: c.unit, std: c.std, desc: c.desc, diff: diff };
}

/** AI로 문항을 만들어 문항리스트에 저장 */
async function generateItem_(cfg, spec, ref) {
  var existing = (await allItems_()).filter(function (it) { return it.code === spec.code; }).slice(-3).map(function (it) { return it.text; });
  var out = (await llmJson_(cfg, {
    system: promptGenerateSystem_(), user: promptGenerateUser_(spec, ref, existing), maxTokens: 2500, temperature: 0.7
  }));
  return (await saveItem_(spec, normalizeGenerated_(out), ref, 'AI생성'));
}

async function generateItemForCode_(cfg, code, ref) {
  var img = (await imageItemForCode_(code));
  if (img) return img;
  var spec = (await specForCode_(code));
  if (!spec) throw userError_('문항코드 ' + code + '을(를) 문항정보 시트에서 찾을 수 없어요.');
  return (await generateItem_(cfg, spec, ref));
}

async function imageItemForCode_(code) {
  return (await allItems_()).filter(function (it) { return it.code === String(code) && it.imageId; })[0] || null;
}

/** 풀이 단계가 없으면 만들어 저장 (유도질문에 필요) */
async function ensureSteps_(cfg, item) {
  item = (await ensureImageSolved_(cfg, item));
  if (item.steps && item.steps.length && item.answer) return item;
  var out = (await llmJson_(cfg, {
    system: promptStepsSystem_(),
    user: '[학년] ' + item.grade + '\n[개념] ' + item.conceptName + '\n[문제] ' + item.text + (item.answer ? '\n[정답] ' + item.answer : '') + '\n정답과 풀이 단계를 JSON으로 출력하라.',
    maxTokens: 1500
  }));
  var steps = Array.isArray(out.steps) ? out.steps.map(String).filter(String).slice(0, 8) : [];
  item.steps = steps;
  if (!item.answer) item.answer = String(out.answer || '');
  (await updateObj_(SH.ITEM, item.id, { '풀이단계': JSON.stringify(steps), '정답': item.answer }));
  forget_('item:' + item.id);
  return item;
}

/** 학생이 이미 본 문항 (풀이기록 + 학습세션) */
async function seenItemIds_(studentId) {
  var seen = {};
  (await rows_(SH.SUBMIT)).forEach(function (s) { if (str_(s['학생ID']) === studentId) seen[str_(s['문항ID'])] = true; });
  var sessions = {};
  (await rows_(SH.SESSION)).forEach(function (s) {
    if (str_(s['학생ID']) !== studentId) return;
    sessions[str_(s['세션ID'])] = true;
    sessionItemIds_(s).forEach(function (id) { seen[id] = true; });
  });
  // 예전 세션은 끝난 프레임에 문항ID를 남기지 않았다: 채팅로그의 문항ID로 보충한다.
  (await rows_(SH.CHAT)).forEach(function (c) { if (sessions[str_(c['세션ID'])] && str_(c['문항ID'])) seen[str_(c['문항ID'])] = true; });
  return seen;
}

/** 유도질문 세션에서 푼 문항들(진행 중 프레임 + 끝난 프레임 + 추적 경로) */
function sessionItemIds_(ses) {
  var d = parseJson_(ses && ses['상태데이터'], {}) || {};
  var out = [];
  (d.frames || []).concat(d.results || [], d.trail || []).forEach(function (f) { if (f && f.problemId && out.indexOf(f.problemId) < 0) out.push(String(f.problemId)); });
  return out;
}

/** 이 과제의 유도질문(1단계)에서 푼 문항 id 목록. 채팅로그로 예전 세션도 보충한다. */
async function tutorItemIdsFor_(studentId, assignmentId) {
  var ids = [], sesIds = {};
  (await rows_(SH.SESSION)).forEach(function (s) {
    if (str_(s['학생ID']) !== String(studentId) || str_(s['과제ID']) !== String(assignmentId)) return;
    sesIds[str_(s['세션ID'])] = true;
    sessionItemIds_(s).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
  });
  (await rows_(SH.CHAT)).forEach(function (c) {
    var id = str_(c['문항ID']);
    if (id && sesIds[str_(c['세션ID'])] && ids.indexOf(id) < 0) ids.push(id);
  });
  return ids;
}

/** 비슷한 난이도로 보는 IRT 난이도 차이 */
var DIFF_TOL = 0.7;

function byDiff_(list, target) {
  return list.slice().sort(function (a, b) { return Math.abs(a.diff - target) - Math.abs(b.diff - target); });
}
function nearDiff_(list, target) {
  return byDiff_(list, target).filter(function (it) { return Math.abs(it.diff - target) <= DIFF_TOL; });
}

/**
 * 같은 개념의 비슷한 난이도 문항(난이도 차이 ±0.7):
 * 그 안의 문제 이미지 문항 → 그 안의 이미 만든 문항 → 문항정보에서 난이도가 가장 가까운 문항코드로 새로 생성
 * (그 코드도 멀면 목표 난이도를 주고 생성) → 문항코드가 없으면 개념 정보로 생성
 */
async function pickSimilarForConcept_(cfg, conceptId, targetDiff, exclude, ref) {
  conceptId = String(conceptId);
  targetDiff = num_(targetDiff, 0);
  exclude = exclude || {};
  var near = nearDiff_((await allItems_()).filter(function (it) { return it.conceptId === conceptId && !exclude[it.id]; }), targetDiff);
  var imgs = near.filter(function (it) { return it.imageId; });
  if (imgs.length) return imgs[0];
  if (near.length) return near[0];
  var idx = (await itemInfoIndex_());
  var codes = (idx.byConcept[conceptId] || []).slice();
  codes.sort(function (a, b) { return Math.abs(idx.codes[a].diff - targetDiff) - Math.abs(idx.codes[b].diff - targetDiff); });
  var useRef = ref && ref.conceptId === conceptId ? ref : null;
  if (codes.length) {
    var spec = (await specForCode_(codes[0]));
    if (Math.abs(num_(spec.diff, 0) - targetDiff) > DIFF_TOL) spec.diff = targetDiff;
    return (await generateItem_(cfg, spec, useRef));
  }
  return (await generateItem_(cfg, (await specForConcept_(conceptId, targetDiff)), null));
}

/*
 * 난이도 범위(IRT 난이도, 처음 문제 기준):
 *  - 오개념 학습(1단계 유도질문·선수개념 추적)은 처음 문제보다 쉬운 문제: [처음-2.5, 처음-0.3], 처음-1.0에 가까울수록 좋음
 *  - 3단계 확인 문제는 처음과 비슷하거나 조금 어려운 문제: [처음-0.3, 처음+1.0], 처음+0.3에 가까울수록 좋음
 */
var EASIER_RANGE = { lo: -2.5, hi: -0.3, target: -1.0 };
var CHECK_RANGE = { lo: -0.3, hi: 1.0, target: 0.3 };

function rangeFor_(baseDiff, r) {
  var b = num_(baseDiff, 0);
  return { lo: b + r.lo, hi: b + r.hi, target: b + r.target };
}

/**
 * 개념(conceptId)의 문항을 난이도 범위 안에서 고른다. 이미 본 문항(exclude)은 빼고, avoidCodes의 문항코드는 다른 것이 없을 때만 쓴다.
 * 순서: 범위 안의 문제 이미지 문항 → 범위 안의 이미 만든 문항 → 문항정보에서 범위 안의 문항코드로 새로 생성
 *       → 범위 안 코드가 없으면 목표에 가장 가까운 코드에 목표 난이도를 주어 생성 → 문항코드가 없으면 개념 정보로 생성
 */
async function pickInRange_(cfg, conceptId, rg, exclude, ref, opt) {
  conceptId = String(conceptId);
  exclude = exclude || {};
  opt = opt || {};
  var avoid = opt.avoidCodes || {};
  var inRange = function (d) { return d >= rg.lo - 1e-9 && d <= rg.hi + 1e-9; };
  var byTarget = function (a, b) { return Math.abs(a.diff - rg.target) - Math.abs(b.diff - rg.target); };
  var pool = (await allItems_()).filter(function (it) { return it.conceptId === conceptId && !exclude[it.id] && inRange(it.diff); }).sort(byTarget);
  var fresh = pool.filter(function (it) { return !avoid[it.code]; });
  var prefer = function (list) {
    return list.filter(function (it) { return it.imageId; })[0] ||
      (opt.code ? list.filter(function (it) { return it.code === opt.code; })[0] : null) || list[0] || null;
  };
  var hit = prefer(fresh);
  if (hit) return hit;
  var idx = (await itemInfoIndex_());
  var codes = (idx.byConcept[conceptId] || []).map(function (c) { return { code: c, diff: num_(idx.codes[c].diff, 0) }; }).sort(byTarget);
  var useRef = ref && ref.conceptId === conceptId ? ref : null;
  var codeIn = codes.filter(function (c) { return inRange(c.diff) && !avoid[c.code]; })[0] ||
    (pool.length ? null : codes.filter(function (c) { return inRange(c.diff); })[0]);
  if (!codeIn && pool.length) return prefer(pool); // 범위 안의 문항은 있지만 피하려던 코드뿐이면 그것이라도 쓴다
  if (codeIn) {
    var img = (await imageItemForCode_(codeIn.code));
    if (img && !exclude[img.id]) return img;
    return (await generateItem_(cfg, (await specForCode_(codeIn.code)), useRef));
  }
  var clampT = Math.max(rg.lo, Math.min(rg.hi, rg.target));
  var other = codes.filter(function (c) { return !avoid[c.code]; })[0] || codes[0];
  if (other) {
    var spec = (await specForCode_(other.code));
    spec.diff = clampT;
    return (await generateItem_(cfg, spec, useRef));
  }
  return (await generateItem_(cfg, (await specForConcept_(conceptId, clampT)), null));
}

/** 오개념 학습(1단계)용: 같은 개념에서 처음 문제보다 쉬운 문제 */
async function pickEasierForConcept_(cfg, conceptId, baseDiff, exclude, ref) {
  return (await pickInRange_(cfg, conceptId, rangeFor_(baseDiff, EASIER_RANGE), exclude, ref, {}));
}

/**
 * 3단계 확인 문제: 같은 개념에서 처음 문제와 비슷하거나 조금 어려운 새 문제.
 * 이미 본 문항(처음 문제·1단계에서 푼 문제 포함)은 빼고, 1단계에서 푼 문제와 같은 문항코드도 되도록 피한다.
 */
async function pickNewForCode_(cfg, item, exclude, avoidItemIds) {
  exclude = Object.assign({}, exclude || {});
  exclude[item.id] = true;
  var avoidCodes = {};
  (await __aForEach((avoidItemIds || []), async function (id) {
    exclude[id] = true;
    var it = (await getItem_(id));
    if (it && it.code) avoidCodes[it.code] = true;
  }));
  return (await pickInRange_(cfg, item.conceptId, rangeFor_(item.diff, CHECK_RANGE), exclude, item, { code: item.code, avoidCodes: avoidCodes }));
}

;
/* ===================== 점수 기록 (오개념도표·단계별집계·오류기록) ===================== */

/** 단계별집계에 학생 행이 없으면 추가. students: [{id, cls, num, name}] */
async function ensureStudentScoreRows_(students) {
  var sh = (await sheet_(SH.STAGESUM, true));
  if (!sh) return;
  var have = {};
  if ((await sh.getLastRow()) >= 2) (await sh.getRange(2, 1, (await sh.getLastRow()) - 1, 1).getValues()).forEach(function (r) { have[str_(r[0])] = 1; });
  var hdr = (await headers_(SH.STAGESUM));
  var add = students.filter(function (s) { return !have[String(s.id)]; }).map(function (s) {
    return hdr.map(function (h) {
      if (h === '학생ID') return cell_(String(s.id));
      if (h === '반') return cell_(String(s.cls));
      if (h === '번호') return cell_(String(s.num));
      if (h === '이름') return s.name;
      if (h === '최근갱신') return '';
      return 0;
    });
  });
  if (add.length) (await sh.getRange((await sh.getLastRow()) + 1, 1, add.length, hdr.length).setValues(add));
}

async function updateStageSumName_(studentId, name) {
  var r = (await findRow_(SH.STAGESUM, studentId));
  if (r > 0) (await updateObj_(SH.STAGESUM, r, { '이름': name }));
}

/* ---------- 오개념도표(개념별 이해 기록) ---------- */

/** 예전 시트(3열)에는 처음 쓸 때 판단·출처 등 빠진 머리글을 붙인다. */
async function miscSheetReady_() {
  if ((await headers_(SH.MISCON)).indexOf('판단') >= 0) return;
  (await withLock_(async function () { (await ensureSheet_(SH.MISCON, COLS[SH.MISCON], false)); }));
}

/** 예전 행처럼 판단이 비어 있으면 오개념으로 본다. */
function miscVerdict_(row) { return str_(row['판단']).trim() || '오개념'; }

/**
 * 개념 판단을 한 행씩 남긴다. 같은 호출 안에서 같은 개념·판단은 한 번만.
 * entries: [{conceptId, verdict: '오개념'|'이해함', level, source: '풀이분석'|'교사판정'|'유도질문', reason, itemId, conceptName}]
 */
async function recordConcepts_(student, entries) {
  var seen = {};
  var list = (entries || []).filter(function (e) {
    var k = String(e && e.conceptId || '') + '|' + (e && e.verdict);
    if (!e || !e.conceptId || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
  if (!list.length) return;
  (await miscSheetReady_());
  var rows = (await __aMap(list, async function (e) {
    var c = (await conceptInfo_(e.conceptId)) || {};
    var o = {};
    o['학생이름'] = student.name;
    o['학생id'] = String(student.id);
    o['오개념 개념 코드'] = String(e.conceptId);
    o['판단'] = e.verdict === '이해함' ? '이해함' : '오개념';
    o['개념명'] = e.conceptName || c.name || '';
    o['이해수준'] = e.level || '';
    o['출처'] = e.source || '';
    o['근거'] = String(e.reason || '').slice(0, 300);
    o['문항ID'] = e.itemId || '';
    o['기록일시'] = now_();
    return o;
  }));
  (await appendObjs_(SH.MISCON, rows));
}

/** 오개념만 남길 때(예전 호출 모양 유지) */
async function bumpMiscon_(student, conceptIds, meta) {
  meta = meta || {};
  (await recordConcepts_(student, (conceptIds || []).map(function (c) {
    return { conceptId: String(c), verdict: '오개념', source: meta.source || '', reason: meta.reason || '', itemId: meta.itemId || '', level: meta.level || '' };
  })));
}

/** 단계별집계: patch = {'제출수':1, '주원인_변형':1, ...} */
async function bumpStageSum_(student, patch) {
  (await withLock_(async function () {
    var row = (await findRow_(SH.STAGESUM, student.id));
    if (row < 0) { (await ensureStudentScoreRows_([student])); row = (await findRow_(SH.STAGESUM, student.id)); }
    if (row < 0) return;
    var hdr = (await headers_(SH.STAGESUM));
    var sh = (await sheet_(SH.STAGESUM));
    var vals = (await sh.getRange(row, 1, 1, hdr.length).getValues())[0];
    Object.keys(patch).forEach(function (k) {
      var c = hdr.indexOf(k);
      if (c >= 0) vals[c] = num_(vals[c], 0) + patch[k];
    });
    var cu = hdr.indexOf('최근갱신');
    if (cu >= 0) vals[cu] = cell_(now_());
    (await sh.getRange(row, 1, 1, hdr.length).setValues([vals]));
  }));
}

function studentRef_(st) { return { id: st.id, cls: st.cls, num: st.num, name: st.name }; }

/** 자주 쓰인 오류 유형 (분류를 일관되게 하려고 AI에게 보여 줌) */
async function topCategories_() {
  var cache = CacheService.getScriptCache();
  var hit = (await cache.get('topCats'));
  if (hit) return JSON.parse(hit);
  var cnt = {};
  var sh = (await sheet_(SH.ERROR, true));
  if (sh && (await sh.getLastRow()) >= 2) {
    var hdr = (await headers_(SH.ERROR));
    var ci = hdr.indexOf('오류유형');
    var from = Math.max(2, (await sh.getLastRow()) - 1500);
    (await sh.getRange(from, 1, (await sh.getLastRow()) - from + 1, hdr.length).getValues()).forEach(function (r) {
      var k = str_(r[ci]).trim();
      if (k) cnt[k] = (cnt[k] || 0) + 1;
    });
  }
  var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 25);
  (await cache.put('topCats', JSON.stringify(top), 600));
  return top;
}

/** 교사확인요청 ("선생님의 풀이가 필요해요") */
async function createHelp_(st, sub, item, reason) {
  var h = {
    '요청ID': newId_('H'), '제출ID': sub ? sub['제출ID'] : '', '학생ID': st.id, '반': st.cls, '문항ID': item ? item.id : '',
    '교사ID': st.teacherId, '사유': reason, '상태': '대기', '교사답변': '', '교사판정단계': '', '교사판정개념id': '',
    '학생확인': 'N', '요청일시': now_(), '답변일시': ''
  };
  (await appendObj_(SH.HELP, h));
  return h;
}

/**
 * 분석 결과 기록
 *  - 오류기록: 오류마다 한 행
 *  - 오개념도표: 오답이면 이해·변형·처리기술 오류에 연결된 서로 다른 개념마다 '오개념' 한 행,
 *                정답이면 문항 개념에 '이해함' 한 행(분석이 본 이해 수준과 함께)
 *  - 단계별집계: 제출·정답·오답·보류 수, 주원인, 처리기술·인코딩 점수
 */
async function recordOutcome_(st, sub, item, outcome) {
  var rows = [];
  var concepts = [];
  var conceptRows = [];
  var levelOf = function (cid) {
    var c = (outcome.candidates || []).filter(function (x) { return String(x.conceptId) === String(cid); })[0];
    return c && c.level ? c.level : '';
  };
  (outcome.errors || []).forEach(function (e, i) {
    rows.push({
      '오류ID': newId_('E') + i, '제출ID': sub['제출ID'], '학생ID': st.id, '반': st.cls, '문항ID': item.id, '문항코드': item.code,
      '줄번호': e.line || '', 'Newman단계': e.stage, '주원인여부': e.primary ? 'Y' : 'N', '개념id': e.conceptId || '',
      '개념명': e.conceptName || '', '오류유형': e.category || '', '설명': e.description || '', '판단근거': e.evidence || '',
      '불확실성': e.uncertainty || '', '확신도': e.confidence, '출처': e.source || 'AI', '기록일시': now_(), '가상여부': 'N'
    });
    if (e.conceptId && ['이해', '변형', '처리기술'].indexOf(e.stage) >= 0 && concepts.indexOf(e.conceptId) < 0) {
      concepts.push(e.conceptId);
      conceptRows.push({
        conceptId: e.conceptId, conceptName: e.conceptName, verdict: '오개념', source: '풀이분석',
        level: levelOf(e.conceptId), reason: '[' + e.stage + '] ' + (e.category ? e.category + ': ' : '') + (e.description || ''), itemId: item.id
      });
    }
  });
  if (rows.length) (await appendObjs_(SH.ERROR, rows));
  var ref = studentRef_(st);
  if (outcome.result === 'wrong') (await recordConcepts_(ref, conceptRows));
  if (outcome.result === 'correct' && item.conceptId) {
    var u = outcome.understanding || {};
    (await recordConcepts_(ref, [{
      conceptId: item.conceptId, conceptName: item.conceptName, verdict: '이해함', source: '풀이분석', level: u.level || '',
      reason: (str_(sub['시도구분']) || '풀이') + ' 정답' + (u.evidence ? ' — ' + u.evidence : ''), itemId: item.id
    }]));
  }

  var patch = { '제출수': 1 };
  if (outcome.result === 'correct') patch['정답수'] = 1;
  else if (outcome.result === 'hold') patch['판단보류'] = 1;
  else {
    patch['오답수'] = 1;
    if (outcome.primary) patch['주원인_' + outcome.primary] = 1;
  }
  if (outcome.result !== 'hold') {
    if ((outcome.errors || []).some(function (e) { return e.stage === '처리기술'; })) patch['처리기술점수'] = 1;
    if ((outcome.errors || []).some(function (e) { return e.stage === '인코딩'; })) patch['인코딩점수'] = 1;
  }
  (await bumpStageSum_(ref, patch));
}

/** 유도질문 중 선수개념 결손이 확인되었을 때 */
async function recordTutorFinding_(st, sessionId, frame, note, category) {
  (await appendObj_(SH.ERROR, {
    '오류ID': newId_('E'), '제출ID': sessionId, '학생ID': st.id, '반': st.cls, '문항ID': frame.problemId, '문항코드': '',
    '줄번호': '', 'Newman단계': '변형', '주원인여부': 'N', '개념id': frame.conceptId, '개념명': frame.conceptName,
    '오류유형': category || '선수개념 결손(유도질문 확인)', '설명': note || '유도질문 과정에서 이 선수개념의 어려움이 확인됨',
    '판단근거': '유도질문 대화 기록', '불확실성': '', '확신도': 0.7, '출처': '유도질문', '기록일시': now_(), '가상여부': 'N'
  }));
  (await recordConcepts_(studentRef_(st), [{
    conceptId: frame.conceptId, conceptName: frame.conceptName, verdict: '오개념', source: '유도질문',
    level: frame.level || '', reason: note || '', itemId: frame.problemId
  }]));
}

/**
 * 가상 데이터를 지운 뒤 등: 남은 기록으로 오개념도표·단계별집계를 다시 계산
 * 오개념도표: 오류기록 → 오개념 행, 풀이기록의 정답 → 이해함 행. 유도질문의 이해함 행은 다른 기록에 없으므로 그대로 둔다.
 */
async function rebuildScores_() {
  var students = (await rows_(SH.STUDENT));
  var names = {}, sum = {}, subResult = {};
  var keys = ['제출수', '정답수', '오답수', '판단보류', '주원인_읽기', '주원인_이해', '주원인_변형', '주원인_처리기술', '주원인_인코딩', '처리기술점수', '인코딩점수'];
  students.forEach(function (s) {
    var id = str_(s['학생ID']);
    names[id] = str_(s['이름']);
    sum[id] = {};
    keys.forEach(function (k) { sum[id][k] = 0; });
  });
  var misRows = [], misSeen = {};
  (await rows_(SH.SUBMIT)).forEach(function (r) {
    var o = sum[str_(r['학생ID'])];
    var res = str_(r['정오']);
    if (!o || !res) return;
    if (res === 'O' && str_(r['개념id'])) {
      var sidO = str_(r['학생ID']), cidO = str_(r['개념id']), kO = sidO + '|' + str_(r['제출ID']) + '|' + cidO;
      if (!misSeen[kO]) {
        misSeen[kO] = 1;
        var outO = (parseJson_(r['AI분석'], {}) || {}).outcome || {};
        var uO = outO.understanding || {};
        misRows.push({ sid: sidO, cid: cidO, verdict: '이해함', name: '', level: uO.level || '', source: str_(r['상태']) === '교사판정' ? '교사판정' : '풀이분석',
          reason: (str_(r['시도구분']) || '풀이') + ' 정답' + (uO.evidence ? ' — ' + uO.evidence : ''), item: str_(r['문항ID']), at: str_(r['분석일시']) || str_(r['제출일시']) });
      }
    }
    subResult[str_(r['제출ID'])] = res;
    o['제출수']++;
    if (res === 'O') o['정답수']++;
    else if (res === '보류') o['판단보류']++;
    else { o['오답수']++; var p = str_(r['주원인']); if (o['주원인_' + p] !== undefined) o['주원인_' + p]++; }
  });
  var perSub = {};
  (await rows_(SH.ERROR)).forEach(function (e) {
    var sid = str_(e['학생ID']), sub = str_(e['제출ID']), st = str_(e['Newman단계']), cid = str_(e['개념id']);
    if (!sum[sid]) return;
    var res = subResult[sub], fromTutor = str_(e['출처']) === '유도질문';
    var k = sid + '|' + sub;
    perSub[k] = perSub[k] || { proc: 0, enc: 0, sid: sid };
    if (res === 'O' || res === 'X') {
      if (st === '처리기술') perSub[k].proc = 1;
      if (st === '인코딩') perSub[k].enc = 1;
    }
    if (cid && (res === 'X' || fromTutor) && ['이해', '변형', '처리기술'].indexOf(st) >= 0 && !misSeen[k + '|' + cid]) {
      misSeen[k + '|' + cid] = 1;
      var src = str_(e['출처']);
      misRows.push({ sid: sid, cid: cid, verdict: '오개념', name: str_(e['개념명']), level: '', source: fromTutor ? '유도질문' : (src === '교사' ? '교사판정' : '풀이분석'),
        reason: '[' + st + '] ' + (str_(e['오류유형']) ? str_(e['오류유형']) + ': ' : '') + str_(e['설명']), item: str_(e['문항ID']), at: str_(e['기록일시']) });
    }
  });
  Object.keys(perSub).forEach(function (k) { var x = perSub[k]; sum[x.sid]['처리기술점수'] += x.proc; sum[x.sid]['인코딩점수'] += x.enc; });

  var hdr = (await headers_(SH.STAGESUM));
  var sh = (await sheet_(SH.STAGESUM));
  if ((await sh.getLastRow()) >= 2) {
    var grid = (await sh.getRange(2, 1, (await sh.getLastRow()) - 1, hdr.length).getValues());
    grid.forEach(function (r) {
      var o = sum[str_(r[0])];
      if (!o) return;
      hdr.forEach(function (h, c) { if (o[h] !== undefined) r[c] = o[h]; });
    });
    (await sh.getRange(2, 1, grid.length, hdr.length).setValues(grid));
  }
  (await miscSheetReady_());
  // 유도질문에서 이해함으로 판단한 행은 다시 만들 수 없으니 남긴다(지워진 학생 것은 뺀다).
  (await rows_(SH.MISCON)).forEach(function (r) {
    var sid = str_(r['학생id']);
    if (!sum[sid] || str_(r['출처']) !== '유도질문' || miscVerdict_(r) !== '이해함') return;
    misRows.push({ sid: sid, cid: str_(r['오개념 개념 코드']), verdict: '이해함', name: str_(r['개념명']), level: str_(r['이해수준']), source: '유도질문',
      reason: str_(r['근거']), item: str_(r['문항ID']), at: str_(r['기록일시']) });
  });
  misRows.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  var mhdr = (await headers_(SH.MISCON));
  var ms = (await sheet_(SH.MISCON));
  if ((await ms.getLastRow()) >= 2) (await ms.getRange(2, 1, (await ms.getLastRow()) - 1, mhdr.length).clearContent());
  if (misRows.length) {
    var grid2 = (await __aMap(misRows, async function (m) {
      var c = m.name ? null : (await conceptInfo_(m.cid));
      var o = {
        '학생이름': names[m.sid] || '', '학생id': m.sid, '오개념 개념 코드': m.cid, '판단': m.verdict, '개념명': m.name || (c ? c.name : ''),
        '이해수준': m.level, '출처': m.source, '근거': String(m.reason || '').slice(0, 300), '문항ID': m.item, '기록일시': m.at
      };
      return mhdr.map(function (h) { return cell_(o[h] === undefined ? '' : o[h]); });
    }));
    if (misRows.length + 1 > (await ms.getMaxRows())) (await ms.insertRowsAfter((await ms.getMaxRows()), misRows.length + 1 - (await ms.getMaxRows())));
    (await ms.getRange(2, 1, grid2.length, mhdr.length).setValues(grid2));
  }
}

;
/* ===================== 사진 전사·오류 분석 (Newman) ===================== */

/** 문항 개념을 후수개념으로 가진 직속 선수개념(개념 위계도) */
async function directPrereqs_(conceptId, limit) {
  return (await __aMap(((await prereqMap_()).pre[String(conceptId)] || []).slice(0, limit || 8), async function (id) {
    var c = (await conceptInfo_(id)) || {};
    return { id: String(id), name: c.name || '', grade: c.grade || '', desc: c.desc || '' };
  })).filter(function (c) { return c.name; });
}

/** 풀이 사진 전사: 문제 이미지(있으면)를 먼저, 학생 풀이(사진·직접 쓴 그림)를 마지막에 보내고 개념·선수개념을 함께 준다. */
async function transcribe_(cfg, item, b64, mime) {
  var probImgs = (await itemImages_(item));
  var out = (await llmJson_(cfg, {
    system: promptOcrSystem_(), user: promptOcrUser_(item, { prereqs: (await directPrereqs_(item.conceptId, 8)), hasProblemImage: probImgs.length > 0 }),
    // 여러 단으로 나눠 쓴 풀이의 배치를 살피도록 추론을 조금 더 쓴다.
    images: probImgs.concat([{ mime: mime, base64: b64 }]), maxTokens: 2500, temperature: 0, effort: 'medium'
  }));
  var lines = (Array.isArray(out.lines) ? out.lines : []).map(function (l) {
    if (typeof l === 'string') return { text: l.trim(), uncertain: false, reason: '' };
    return { text: String(l.text || '').trim(), uncertain: !!l.uncertain, reason: String(l.reason || '').trim() };
  }).filter(function (l) { return l.text; }).slice(0, 60);
  return { lines: lines, unreadable: !!out.unreadable || !lines.length, note: String(out.note || '') };
}

function sanitizeLines_(lines) {
  return (Array.isArray(lines) ? lines : []).map(function (l) {
    return { text: String((l && typeof l === 'object') ? l.text : l || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300) };
  }).filter(function (l) { return l.text; }).slice(0, 60);
}

function normalizeStage_(s) {
  s = String(s || '').replace(/\s/g, '').toLowerCase();
  if (/읽기|reading|read/.test(s)) return '읽기';
  if (/이해|comprehension/.test(s)) return '이해';
  if (/변형|transformation|transform/.test(s)) return '변형';
  if (/처리|process|skill/.test(s)) return '처리기술';
  if (/인코딩|encoding|encode|표현/.test(s)) return '인코딩';
  return '';
}

function selfCorrection_(aiLines, lines) {
  var norm = function (t) { return String(t || '').replace(/\s/g, ''); };
  var a = (aiLines || []).map(function (l) { return norm(l.text); }).join('\n');
  var b = (lines || []).map(function (l) { return norm(l.text); }).join('\n');
  return a !== b;
}

/**
 * AI 원본 전사와 학생 수정본을 줄 단위로 비교한다(공백 무시, 최장 공통 부분열).
 * 결과: [{type: '수정'|'추가'|'삭제', line(최종 풀이 기준 번호), from, to}]
 */
function diffLines_(aiLines, lines) {
  var a = (aiLines || []).map(function (l) { return String(l.text || ''); });
  var b = (lines || []).map(function (l) { return String(l.text || ''); });
  var norm = function (t) { return t.replace(/\s/g, ''); };
  var n = a.length, m = b.length, dp = [];
  for (var i = 0; i <= n; i++) { dp.push([]); for (var j = 0; j <= m; j++) dp[i].push(0); }
  for (var x = n - 1; x >= 0; x--) for (var y = m - 1; y >= 0; y--) {
    dp[x][y] = norm(a[x]) === norm(b[y]) ? dp[x + 1][y + 1] + 1 : Math.max(dp[x + 1][y], dp[x][y + 1]);
  }
  var out = [], dels = [], adds = [];
  function flush() {
    var k = 0;
    for (; k < Math.min(dels.length, adds.length); k++) out.push({ type: '수정', line: adds[k].line, from: dels[k], to: adds[k].text });
    for (var d = k; d < dels.length; d++) out.push({ type: '삭제', line: adds.length ? adds[adds.length - 1].line + 1 : pos + 1, from: dels[d] });
    for (var q = k; q < adds.length; q++) out.push({ type: '추가', line: adds[q].line, to: adds[q].text });
    dels = []; adds = [];
  }
  var p = 0, r = 0, pos = 0;
  while (p < n || r < m) {
    if (p < n && r < m && norm(a[p]) === norm(b[r])) { flush(); p++; r++; pos = r; continue; }
    if (r < m && (p >= n || dp[p][r + 1] >= dp[p + 1][r])) { adds.push({ line: r + 1, text: b[r] }); r++; }
    else { dels.push(a[p]); p++; }
  }
  flush();
  return out.slice(0, 30);
}

async function buildAnalysisContext_(item, aiLines, lines) {
  var concept = (await conceptInfo_(item.conceptId)) || {};
  var cands = [{ id: item.conceptId, name: item.conceptName, grade: item.grade }];
  (await prereqCandidates_(item.conceptId, { depth: 3, min: 6, limit: 24 })).forEach(function (c) { cands.push(c); });
  var core = (await coreConcepts_(item));
  var coreIds = {};
  core.forEach(function (c) { coreIds[c.id] = true; });
  core.forEach(function (c) { if (!cands.some(function (x) { return String(x.id) === c.id; })) cands.push(c); });
  return {
    item: item, concept: concept, aiLines: aiLines, lines: lines, edits: diffLines_(aiLines, lines),
    candidates: cands, core: core, coreIds: coreIds,
    basic: (await basicCalcCandidates_(item.grade, coreIds)), categories: (await topCategories_())
  };
}

async function analyze_(cfg, ctx) {
  return (await llmJson_(cfg, {
    system: promptAnalysisSystem_(), user: promptAnalysisUser_(ctx), images: ctx.images || [], maxTokens: 6000, temperature: 0.1, effort: 'high'
  }));
}

/**
 * AI 분석 결과에 규칙을 적용해 최종 결과를 정한다.
 * - 암산허용 문항은 답이 맞으면 정답
 * - 오개념 후보는 확신도 순으로 모두 남기고, 확신도 기준 이상만 유도질문을 시작할 개념으로 쓴다
 * - 위계: 읽기 > 이해 > 변형 > 처리기술 > 인코딩 (확신도 기준 이상인 오류만)
 * - 근거 부족·확신도 낮음 → 판단 보류(교사 요청)
 */
var UNDERSTANDING_LEVELS = ['미형성', '부분 이해', '절차적 이해', '개념적 이해', '판단 어려움'];

/** AI 응답에서 학생의 의도·이해 수준·생각(오개념 가설)을 정리해 꺼낸다. */
function thinkingOf_(raw) {
  var si = raw.student_intent || {}, u = raw.understanding || {};
  var list = function (a) { return (Array.isArray(a) ? a : []).map(function (x) { return String(x).slice(0, 160); }).filter(String).slice(0, 4); };
  var level = String(u.level || '').trim();
  if (UNDERSTANDING_LEVELS.indexOf(level) < 0) level = level ? '판단 어려움' : '';
  return {
    intent: {
      strategy: String(si.strategy || '').slice(0, 200), fitsProblem: si.fits_problem !== false && String(si.fits_problem) !== 'false',
      note: String(si.note || '').slice(0, 200),
      lines: (Array.isArray(raw.line_checks) ? raw.line_checks : []).filter(function (c) { return c && c.intent; })
        .slice(0, 12).map(function (c) { return { line: parseInt(c.line, 10) || '', intent: String(c.intent).slice(0, 160), ok: !(c.ok === false || String(c.ok) === 'false') }; })
    },
    understanding: level ? {
      level: level, evidence: String(u.evidence || '').slice(0, 300), strengths: list(u.strengths), gaps: list(u.gaps),
      checkQuestion: String(u.check_question || '').slice(0, 200)
    } : null,
    beliefs: (Array.isArray(raw.misconceptions) ? raw.misconceptions : []).map(function (m) { return String(m && m.student_belief || '').slice(0, 200); }).filter(String).slice(0, 3)
  };
}

/* 특수각 삼각비 값 오류 찾기: 'cos 30°', 'cos30도', '\cos 30^{\circ}' 처럼 삼각비 + 특수각이 함께 나오면 개념 오류로 본다. */
var TRIG_FACT_RE = /(sin|cos|tan|사인|코사인|탄젠트)\s*\(?\s*(30|45|60|0|90)\s*(°|도|\\circ|\^\s*\{?\s*\\circ|\\degree)/i;
function coreOrTrig_(name) { return /삼각비/.test(String(name || '')); }
async function factErrorConcept_(text) {
  var m = String(text || '').replace(/\\(sin|cos|tan)/g, '$1').match(TRIG_FACT_RE);
  if (!m) return null;
  var zero = m[2] === '0' || m[2] === '90';
  var cm = (await conceptMap_()), hit = null;
  Object.keys(cm).some(function (id) {
    var n = String(cm[id].name || '');
    if (!/삼각비의 값/.test(n)) return false;
    if (zero ? /0/.test(n) && /90/.test(n) && !/30/.test(n) : /30/.test(n) && /45/.test(n) && /60/.test(n)) { hit = cm[id]; return true; }
    return false;
  });
  return hit ? { id: String(hit.id), name: hit.name } : { id: '', name: zero ? '0°, 90°의 삼각비의 값' : '30°, 45°, 60°의 삼각비의 값' };
}

async function decideOutcome_(raw, ctx) {
  var thr = (await settingNum_('확신도기준', 0.6));
  var item = ctx.item;
  var pool = ctx.candidates.concat(ctx.basic);
  var valid = {};
  pool.forEach(function (c) { valid[String(c.id)] = c; });

  async function fixConcept(id, name) {
    id = (id === null || id === undefined) ? '' : String(id).trim();
    if (id && valid[id]) return { id: id, name: valid[id].name, grade: valid[id].grade };
    var byName = conceptIdByName_(name, pool);
    if (byName) return { id: byName, name: valid[byName].name, grade: valid[byName].grade };
    if (id && (await conceptInfo_(id))) { var c = (await conceptInfo_(id)); return { id: id, name: c.name, grade: c.grade }; }
    // 후보에 없는 개념 이름(예: 중2 '피타고라스 정리')은 이 문항 학년 이하의 전체 개념에서 찾는다.
    var g = (await conceptByNameUpToGrade_(name, item.grade));
    return g ? { id: g.id, name: g.name, grade: g.grade } : null;
  }

  // 최종 답이 맞아도 줄 단위 검증에서 틀린 줄이 있으면 정답으로 보지 않는다(정답 우연 일치 방지).
  var processBad = raw.process_ok === false || String(raw.process_ok) === 'false' ||
    (Array.isArray(raw.line_checks) && raw.line_checks.some(function (c) { return c && (c.ok === false || String(c.ok) === 'false'); }));
  var answerOk = raw.is_correct === true || String(raw.is_correct) === 'true';
  var correct = answerOk && (item.type === '암산허용' || !processBad);
  var errors = (await __aMap((Array.isArray(raw.errors) ? raw.errors : []), async function (e) {
    var stage = normalizeStage_(e.stage);
    if (!stage) return null;
    var c = (await fixConcept(e.concept_id, e.concept_name));
    var conf = Math.max(0, Math.min(1, num_(e.confidence, 0.5)));
    return {
      line: parseInt(e.line, 10) || '', stage: stage, conceptId: c ? c.id : '', conceptName: c ? c.name : String(e.concept_name || ''),
      category: String(e.category || '').slice(0, 60), description: String(e.description || '').slice(0, 500),
      evidence: String(e.evidence || '').slice(0, 500), uncertainty: String(e.uncertainty || '').slice(0, 300),
      confidence: conf, core: e.core !== false, source: 'AI'
    };
  })).filter(Boolean);
  // 외워서 알아야 하는 값(특수각의 삼각비 값 등)을 틀리게 쓴 것은 계산 실수가 아니라 개념 오류(변형)다.
  (await __aForEach(errors, async function (e) {
    if (e.stage !== '처리기술') return;
    var fc = (await factErrorConcept_([e.category, e.description, e.evidence, e.conceptName].join(' ')));
    if (!fc) return;
    e.stage = '변형';
    e.core = true;
    if (!e.conceptId || !coreOrTrig_(e.conceptName)) { e.conceptId = fc.id; e.conceptName = fc.name; }
    e.uncertainty = (e.uncertainty ? e.uncertainty + ' / ' : '') + '특수각의 삼각비 값을 잘못 쓴 것은 계산 실수가 아니라 개념 오류라 변형으로 분류';
  }));
  // 핵심 개념 묶음의 계산을 틀렸으면 처리기술(계산 실수)이 아니라 변형(오개념)이다.
  var coreIds = ctx.coreIds || {};
  errors.forEach(function (e) {
    if (e.stage === '처리기술' && e.conceptId && coreIds[e.conceptId]) {
      e.stage = '변형';
      e.core = true;
      e.uncertainty = (e.uncertainty ? e.uncertainty + ' / ' : '') + '이 문항의 핵심 개념(' + e.conceptName + ') 계산 오류라 오개념(변형)으로 분류';
    }
  });

  var base = {
    errors: errors, primary: '', misconceptions: [], confidence: 0,
    studentAnswer: String(raw.student_final_answer || '').slice(0, 200),
    summary: String(raw.summary_for_teacher || raw.answer_check || '').slice(0, 600),
    selfCorrectionNote: raw.self_correction && raw.self_correction.note ? String(raw.self_correction.note).slice(0, 300) : '',
    selfCorrected: !!(raw.self_correction && raw.self_correction.occurred),
    // 학생의 의도와 이해 수준(교사 화면·유도질문에서 씀)
    intent: thinkingOf_(raw).intent, understanding: thinkingOf_(raw).understanding, beliefs: thinkingOf_(raw).beliefs
  };

  // 오개념 후보: 확신도 순. 기준 이상은 유도질문을 시작할 개념(misconceptions)이 되고, 기준 미만도 후보로 남겨 유도질문에서 확인한다.
  var cands = [], seenCand = {};
  (await __aForEach((Array.isArray(raw.misconceptions) ? raw.misconceptions : []), async function (m) {
    if (!m) return;
    var c = (await fixConcept(m.concept_id, m.concept_name));
    var key = c ? c.id : String(m.concept_name || '').trim();
    if (!key || seenCand[key]) return;
    seenCand[key] = true;
    var lv = String(m.understanding_level || '').trim(), kind = String(m.kind || '');
    cands.push({
      conceptId: c ? c.id : '', conceptName: c ? c.name : String(m.concept_name || '').slice(0, 80), grade: c ? c.grade : '',
      kind: /전략/.test(kind) ? '전략 선택' : (/적용/.test(kind) ? '적용' : ''),
      level: UNDERSTANDING_LEVELS.indexOf(lv) >= 0 ? lv : '', belief: String(m.student_belief || '').slice(0, 200),
      evidence: String(m.evidence || m.reason || '').slice(0, 300), confidence: Math.max(0, Math.min(1, num_(m.confidence, 0.5)))
    });
  }));
  cands.sort(function (a, b) { return b.confidence - a.confidence; });
  base.candidates = cands.slice(0, 5);

  if (correct) {
    base.candidates = [];
    if (item.type === '암산허용') base.errors = [];
    else base.errors = errors.filter(function (e) { return e.confidence >= thr; });
    base.result = 'correct';
    return base;
  }

  if (raw.evidence_sufficient === false || String(raw.evidence_sufficient) === 'false') {
    base.result = 'hold';
    base.holdReason = '판단 근거 부족: ' + String(raw.insufficient_reason || '풀이에서 원인을 판단하기 어려움').slice(0, 200);
    return base;
  }
  var confident = errors.filter(function (e) { return e.confidence >= thr; });
  if (!confident.length && processBad) {
    var bad = (raw.line_checks || []).filter(function (c) { return c && (c.ok === false || String(c.ok) === 'false'); })[0] || {};
    base.result = 'hold';
    // 최종 답이 맞다고 본 경우에만 '정답 우연 일치'로 쓴다. 오답이면 과정 오류의 원인을 확신하지 못한 것이다.
    base.holdReason = (answerOk ? '최종 답은 맞지만 과정이 맞지 않음' : '오답이며 틀린 줄이 있지만 오류 원인을 확신하기 어려움') +
      (bad.line ? ' (' + bad.line + '번째 줄: ' + String(bad.why || '').slice(0, 120) + ')' : '');
    return base;
  }
  if (!confident.length) {
    base.result = 'hold';
    base.holdReason = errors.length ? '오류 판단 확신도가 낮음(기준 ' + thr + ')' : '오답이지만 오류 위치를 찾지 못함';
    return base;
  }
  var primary = '';
  for (var i = 0; i < STAGE_ORDER.length && !primary; i++) {
    if (confident.some(function (e) { return e.stage === STAGE_ORDER[i]; })) primary = STAGE_ORDER[i];
  }
  var marked = false;
  errors.forEach(function (e) { e.primary = !marked && e.stage === primary && e.confidence >= thr; if (e.primary) marked = true; });

  var mis = [];
  if (primary === '변형' || primary === '이해') {
    // 유도질문은 mis[0] 개념의 문제로 시작한다: 오답을 만든 주 오류의 개념을 맨 앞에 둔다.
    errors.forEach(function (e) { if (e.primary && e.conceptId && mis.indexOf(e.conceptId) < 0) mis.push(e.conceptId); });
    base.candidates.forEach(function (c) {
      if (c.conceptId && c.confidence >= thr && mis.indexOf(c.conceptId) < 0) mis.push(c.conceptId);
    });
    confident.forEach(function (e) {
      if (e.stage === primary && e.conceptId && mis.indexOf(e.conceptId) < 0) mis.push(e.conceptId);
    });
    if (!mis.length) mis.push(item.conceptId);
  }
  base.errors = errors;
  base.result = 'wrong';
  base.primary = primary;
  base.misconceptions = mis.slice(0, 3);
  base.confidence = Math.max.apply(null, confident.filter(function (e) { return e.stage === primary; }).map(function (e) { return e.confidence; }));
  return base;
}

;
/* ===================== 학생 API ===================== */
/*
 * 진행 단계(진행상황.단계)
 *  solve   : 처음 풀이
 *  retry   : 오답 후 다시 풀기 (읽기·이해·처리기술·인코딩)
 *  tutor   : 1단계 - 채팅식 유도질문으로 오개념 진단·학습 (변형)
 *  regress : 2단계 - 원래 문제로 돌아가 다시 풀기
 *  apply   : 3단계 - 같은 문항코드의 새 문제에 적용
 *  hold    : 판단 보류 - 교사 답변 대기
 *  skip    : [도움 받기] 설명을 보고도 문제를 이해하지 못해 넘어감(못 풂) - 교사에게 알림
 *  done    : 완료
 */

var UPLOAD_STAGES = ['solve', 'retry', 'regress', 'apply'];

function stageInfo_(stage) {
  var m = {
    solve: { label: '풀이', desc: '문제를 풀고 풀이 사진을 올려 주세요.' },
    retry: { label: '다시 풀기', desc: '풀이를 다시 확인하고 고쳐서 제출해 보세요.' },
    tutor: { label: '1단계 · 함께 생각하기', desc: '비슷한 문제로 유도질문에 답하며 헷갈린 개념을 찾아요.' },
    regress: { label: '2단계 · 처음 문제 다시 풀기', desc: '배운 내용을 떠올리며 처음 문제를 다시 풀어 보세요.' },
    apply: { label: '3단계 · 새로운 문제에 적용', desc: '같은 개념의 새로운 문제를 풀어 보세요.' },
    hold: { label: '선생님 확인 중', desc: HOLD_MESSAGE },
    skip: { label: '못 풀었어요', desc: '문제를 이해하지 못해 넘어갔어요. 선생님께 알려 드렸어요.' },
    done: { label: '완료', desc: '이 문제를 모두 마쳤어요.' }
  };
  return m[stage] || m.solve;
}

function attemptKind_(stage) {
  return { solve: '원문항', retry: '재도전', regress: '회귀(2단계)', apply: '적용(3단계)' }[stage] || '원문항';
}

/** 학생에게 보이는 과제 목록 (담임으로 지정된 교사가 출제, 대상반 포함, 공개) */
async function studentAssignments_(st) {
  return (await rows_(SH.ASSIGN)).filter(function (a) {
    if (str_(a['교사ID']) !== st.teacherId) return false;
    if (str_(a['공개']) === 'N') return false;
    var target = str_(a['대상반']);
    return target === '전체' || splitList_(target).indexOf(st.cls) >= 0;
  }).sort(function (x, y) { return num_(x['순서'], 999) - num_(y['순서'], 999) || String(x['출제일시']).localeCompare(String(y['출제일시'])); });
}

async function progressFor_(st, assignmentId) {
  var list = (await rows_(SH.PROGRESS));
  for (var i = 0; i < list.length; i++) {
    if (str_(list[i]['학생ID']) === st.id && str_(list[i]['과제ID']) === assignmentId) return list[i];
  }
  return null;
}

async function getOrCreateProgress_(st, a) {
  var p = (await progressFor_(st, str_(a['과제ID'])));
  if (p) return p;
  return (await withLock_(async function () {
    var again = (await progressFor_(st, str_(a['과제ID'])));
    if (again) return again;
    var obj = {
      '진행ID': newId_('P'), '학생ID': st.id, '과제ID': str_(a['과제ID']), '원문항ID': str_(a['문항ID']), '상태': '미시작',
      '단계': 'solve', '현재문항ID': str_(a['문항ID']), '세션ID': '', '최근제출ID': '', '시도횟수': 0, '반복횟수': 0,
      '교사알림': 'N', '완료일시': '', '수정일시': now_()
    };
    (await appendObj_(SH.PROGRESS, obj));
    return (await progressFor_(st, str_(a['과제ID'])));
  }));
}

async function setProgress_(p, patch) {
  patch['수정일시'] = now_();
  (await updateObj_(SH.PROGRESS, p._row, patch));
  Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
}

async function assignmentForStudent_(st, assignmentId) {
  var list = (await studentAssignments_(st));
  for (var i = 0; i < list.length; i++) if (str_(list[i]['과제ID']) === String(assignmentId)) return { a: list[i], index: i, total: list.length };
  throw userError_('이 문제를 찾을 수 없어요. 목록에서 다시 골라 주세요.');
}

async function canNext_(p) {
  var stage = str_(p['단계']);
  if (stage === 'done' || stage === 'hold' || stage === 'skip') return true;
  if (UPLOAD_STAGES.indexOf(stage) >= 0 && stage !== 'solve' && num_(p['시도횟수'], 0) >= (await settingNum_('최대재시도', 3))) return true;
  return false;
}

function submissionView_(s) {
  if (!s) return null;
  var tr = parseJson_(s['AI전사'], { lines: [] });
  var lines = parseJson_(s['학생수정본'], null);
  return {
    submissionId: str_(s['제출ID']), itemId: str_(s['문항ID']), aiLines: tr.lines || [], unreadable: !!tr.unreadable,
    lines: lines || (tr.lines || []).map(function (l) { return { text: l.text }; }),
    notUnderstood: str_(s['이해못함']) === 'Y' ? true : (str_(s['이해못함']) === 'N' ? false : null),
    analyzed: str_(s['상태']) !== '전사완료', feedback: parseJson_(s['학생피드백'], null),
    help: parseJson_(s['이해도움'], null), hasImage: !!str_(s['이미지파일ID'])
  };
}

async function teacherAnswersFor_(st, assignmentId) {
  var subs = {};
  (await rows_(SH.SUBMIT)).forEach(function (s) { if (str_(s['학생ID']) === st.id && str_(s['과제ID']) === assignmentId) subs[str_(s['제출ID'])] = 1; });
  return (await rows_(SH.HELP)).filter(function (h) {
    return str_(h['학생ID']) === st.id && subs[str_(h['제출ID'])] && str_(h['상태']) === '답변완료';
  }).map(function (h) { return { requestId: str_(h['요청ID']), text: str_(h['교사답변']), at: str_(h['답변일시']) }; });
}

async function workspaceView_(st, a, p, index, total) {
  var stage = str_(p['단계']) || 'solve';
  var item = (await getItem_(str_(p['현재문항ID']) || str_(a['문항ID'])));
  if (!item) throw userError_('문항 정보를 찾을 수 없어요. 선생님께 알려 주세요.');
  var orig = (stage === 'apply') ? (await getItem_(str_(p['원문항ID']))) : null;
  var latest = str_(p['최근제출ID']) ? (await getObj_(SH.SUBMIT, str_(p['최근제출ID']))) : null;
  return {
    assignmentId: str_(a['과제ID']), no: index + 1, total: total,
    problem: (await publicItemFull_(item)), original: (await publicItemFull_(orig)),
    progress: { status: str_(p['상태']), stage: stage, attempts: num_(p['시도횟수'], 0), loops: num_(p['반복횟수'], 0) },
    stageInfo: stageInfo_(stage),
    latest: latest && str_(latest['문항ID']) === item.id ? submissionView_(latest) : null,
    sessionId: stage === 'tutor' ? str_(p['세션ID']) : '',
    canNext: (await canNext_(p)),
    teacherAnswers: (await teacherAnswersFor_(st, str_(a['과제ID']))),
    thinkSeconds: (await settingNum_('생각시간초', 20))
  };
}

/* ---------- 공개 API ---------- */
async function api_studentHome(token) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var assigns = (await studentAssignments_(st));
    var prog = {};
    (await rows_(SH.PROGRESS)).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = p; });
    var answered = {};
    var subToAssign = {};
    (await rows_(SH.SUBMIT)).forEach(function (s) { if (str_(s['학생ID']) === st.id) subToAssign[str_(s['제출ID'])] = str_(s['과제ID']); });
    (await rows_(SH.HELP)).forEach(function (h) {
      if (str_(h['학생ID']) === st.id && str_(h['상태']) === '답변완료' && subToAssign[str_(h['제출ID'])]) answered[subToAssign[str_(h['제출ID'])]] = true;
    });
    var items = (await __aMap(assigns, async function (a, i) {
      var it = (await getItem_(str_(a['문항ID'])));
      var p = prog[str_(a['과제ID'])];
      return {
        assignmentId: str_(a['과제ID']), no: i + 1, conceptName: it ? it.conceptName : '(문항 없음)',
        preview: it ? (it.text ? previewText_(it.text, 80) : (it.imageId ? '(그림으로 된 문제)' : '')) : '', status: p ? str_(p['상태']) : '미시작',
        stage: p ? str_(p['단계']) : '', stageLabel: p ? stageInfo_(str_(p['단계'])).label : '', teacherAnswered: !!answered[str_(a['과제ID'])]
      };
    }));
    return { profile: st, items: items, report: (await reportProgress_(st)) };
  }));
}

async function api_openProblem(token, assignmentId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var f = (await assignmentForStudent_(st, assignmentId));
    var p = (await getOrCreateProgress_(st, f.a));
    return (await workspaceView_(st, f.a, p, f.index, f.total));
  }));
}

async function api_myImage(token, submissionId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var s = (await getObj_(SH.SUBMIT, submissionId));
    if (!s || str_(s['학생ID']) !== st.id) throw userError_('사진을 찾을 수 없어요.');
    return (await imageDataUrl_(str_(s['이미지파일ID'])));
  }));
}

/** 사진 업로드 → 비공개 드라이브 저장 → AI 전사(평가 없이 읽은 그대로) */
async function api_transcribe(token, payload) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    payload = payload || {};
    var f = (await assignmentForStudent_(st, payload.assignmentId));
    var p = (await getOrCreateProgress_(st, f.a));
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 사진을 올릴 수 없는 단계예요.');
    var item = (await getItem_(str_(p['현재문항ID'])));
    var b64 = String(payload.imageBase64 || '').replace(/^data:[^,]+,/, '');
    if (b64.length < 1000) throw userError_('사진을 다시 골라 주세요.');
    if (b64.length > 9000000) throw userError_('사진 용량이 너무 커요. 다시 찍어 주세요.');
    var mime = /^image\/(jpeg|png|webp)$/.test(String(payload.mime)) ? String(payload.mime) : 'image/jpeg';
    var cfg = (await teacherAiConfig_(st.teacherId));
    var tr = (await transcribe_(cfg, item, b64, mime));
    var file = (await saveImage_(st, item, b64, mime));
    var sub = {
      '제출ID': newId_('SUB'), '학생ID': st.id, '반': st.cls, '과제ID': str_(f.a['과제ID']), '문항ID': item.id, '문항코드': item.code,
      '개념id': item.conceptId, '시도구분': attemptKind_(stage), '시도차수': num_(p['시도횟수'], 0) + 1, '세션ID': str_(p['세션ID']),
      '이미지파일ID': file.id, '이미지링크': file.url, 'AI전사': JSON.stringify(tr), '상태': '전사완료', '제출일시': now_(), '가상여부': 'N'
    };
    (await appendObj_(SH.SUBMIT, sub));
    (await setProgress_(p, { '최근제출ID': sub['제출ID'], '상태': '진행중' }));
    return { submissionId: sub['제출ID'], lines: tr.lines, unreadable: tr.unreadable, note: tr.note };
  }));
}

/** 학생이 확인·수정한 풀이 제출 → Newman 분석 → 단계별 처방 */
async function api_submitSolution(token, payload) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    payload = payload || {};
    var lines = sanitizeLines_(payload.lines);
    if (!lines.length) throw userError_('풀이 내용이 비어 있어요.');
    var sub = (await getObj_(SH.SUBMIT, payload.submissionId));
    if (!sub || str_(sub['학생ID']) !== st.id) throw userError_('제출 정보를 찾을 수 없어요. 사진을 다시 올려 주세요.');
    var f = (await assignmentForStudent_(st, str_(sub['과제ID'])));
    var p = (await getOrCreateProgress_(st, f.a));
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 제출할 수 없는 단계예요.');
    if (str_(sub['문항ID']) !== str_(p['현재문항ID'])) throw userError_('지금 풀고 있는 문제의 사진을 다시 올려 주세요.');

    // 이미 분석한 제출을 고쳐서 다시 내면 새 시도로 기록 (사진은 그대로)
    if (str_(sub['상태']) !== '전사완료') {
      var copy = {};
      (await headers_(SH.SUBMIT)).forEach(function (h) { copy[h] = ''; });
      ['학생ID', '반', '과제ID', '문항ID', '문항코드', '개념id', '세션ID', '이미지파일ID', '이미지링크', 'AI전사'].forEach(function (k) { copy[k] = sub[k]; });
      copy['제출ID'] = newId_('SUB');
      copy['시도구분'] = attemptKind_(stage);
      copy['시도차수'] = num_(p['시도횟수'], 0) + 1;
      copy['상태'] = '전사완료';
      copy['제출일시'] = now_();
      copy['가상여부'] = 'N';
      (await appendObj_(SH.SUBMIT, copy));
      sub = (await getObj_(SH.SUBMIT, copy['제출ID']));
      (await setProgress_(p, { '최근제출ID': copy['제출ID'] }));
    }

    var item = (await getItem_(str_(sub['문항ID'])));
    var cfg = (await teacherAiConfig_(st.teacherId));
    if (!item.answer || (item.imageId && !item.text)) item = (await ensureSteps_(cfg, item));
    var aiLines = (parseJson_(sub['AI전사'], { lines: [] }).lines) || [];
    var ctx = (await buildAnalysisContext_(item, aiLines, lines));
    var probImgs = (await itemImages_(item)), solImgs = (await submissionImages_(sub));
    ctx.images = probImgs.concat(solImgs);
    ctx.imageNote = [probImgs.length ? '문제 이미지(그림·보기 포함)' : '', solImgs.length ? '학생 풀이 사진' : ''].filter(String).join(', ') + ' 순서로 첨부함';
    var raw = (await analyze_(cfg, ctx));
    var outcome = (await decideOutcome_(raw, ctx));
    return (await applyOutcome_(st, f, p, sub, item, outcome, raw, ctx, cfg));
  }));
}

async function applyOutcome_(st, f, p, sub, item, outcome, raw, ctx, cfg) {
  var stage = str_(p['단계']);
  var attempts = num_(p['시도횟수'], 0) + 1;
  var loops = num_(p['반복횟수'], 0);
  var maxRetry = (await settingNum_('최대재시도', 3)), maxLoops = (await settingNum_('최대학습반복', 2));
  var edited = selfCorrection_(ctx.aiLines, ctx.lines);
  var fb = { result: outcome.result, stage: outcome.primary || '', message: '', canNext: false, showHelp: false, startTutor: false, nextStage: '' };
  var prog = { '시도횟수': attempts };

  if (outcome.result === 'correct') {
    if (stage === 'regress') {
      var nx = (await pickNewForCode_(cfg, item, (await seenItemIds_(st.id)), (await tutorItemIdsFor_(st.id, str_(f.a['과제ID'])))));
      prog = { '단계': 'apply', '현재문항ID': nx.id, '시도횟수': 0, '최근제출ID': '' };
      fb.message = '정답이에요! 2단계를 통과했어요. 이제 같은 개념의 새로운 문제에 도전해 볼까요?';
      fb.nextStage = 'apply';
    } else if (stage === 'apply') {
      prog = { '단계': 'done', '상태': '완료', '완료일시': now_(), '시도횟수': attempts };
      fb.message = '정답이에요! 3단계까지 모두 마쳤어요. 정말 잘했어요!';
      fb.canNext = true;
    } else {
      prog = { '단계': 'done', '상태': '완료', '완료일시': now_(), '시도횟수': attempts };
      fb.message = '정답이에요! 잘했어요.';
      fb.canNext = true;
    }
    if (outcome.errors.length) fb.note = '답은 맞았지만 풀이 과정에서 다시 볼 부분이 있어 기록해 두었어요.';
  } else if (outcome.result === 'hold') {
    (await createHelp_(st, sub, item, outcome.holdReason || '판단 보류'));
    prog['단계'] = 'hold';
    prog['상태'] = '보류';
    fb.message = HOLD_MESSAGE;
    fb.canNext = true;
  } else {
    fb.message = STAGE_MESSAGES[outcome.primary] || '다시 한번 확인해보세요';
    if (outcome.primary === '변형') {
      if (loops < maxLoops) {
        fb.startTutor = true;
        prog['단계'] = 'tutor';
        prog['세션ID'] = '';
        prog['반복횟수'] = loops + 1;
      } else {
        (await createHelp_(st, sub, item, '유도질문 학습을 ' + loops + '번 했지만 변형 단계 오류가 반복됨'));
        prog['단계'] = 'hold';
        prog['상태'] = '보류';
        fb.message = '여러 번 함께 학습했지만 아직 어려움이 남아 있어요. 선생님께 알려 드렸어요. ' + HOLD_MESSAGE;
        fb.canNext = true;
      }
    } else {
      if (outcome.primary === '이해') fb.showHelp = true;
      if (stage === 'solve') prog['단계'] = 'retry';
      if (attempts >= maxRetry) {
        fb.canNext = true;
        fb.note = '이 문제는 다음에 다시 도전해도 괜찮아요. 선생님께도 알려 드렸어요.';
        if (str_(p['교사알림']) !== 'Y') {
          (await createHelp_(st, sub, item, '같은 문제를 ' + attempts + '번 틀림 (주원인: ' + outcome.primary + ')'));
          prog['교사알림'] = 'Y';
        }
      }
    }
  }

  var resultCode = outcome.result === 'correct' ? 'O' : (outcome.result === 'hold' ? '보류' : 'X');
  var mainErr = outcome.errors.filter(function (e) { return e.primary; })[0];
  (await updateObj_(SH.SUBMIT, sub._row, {
    '학생수정본': JSON.stringify(ctx.lines),
    '자기교정': outcome.selfCorrected ? '오류를 스스로 고침' : (edited ? '전사 수정함' : 'N'),
    '학생최종답': outcome.studentAnswer, '정오': resultCode, '주원인': outcome.primary || '',
    '오개념개념id': (outcome.misconceptions || []).join(','), '확신도': outcome.confidence || '',
    '판단근거': mainErr ? (mainErr.evidence || mainErr.description) : (outcome.holdReason || outcome.summary || ''),
    '불확실성': mainErr ? mainErr.uncertainty : (outcome.holdReason || ''),
    'AI분석': JSON.stringify({ outcome: { result: outcome.result, primary: outcome.primary, misconceptions: outcome.misconceptions, candidates: outcome.candidates || [], errors: outcome.errors, summary: outcome.summary, selfCorrection: outcome.selfCorrectionNote, holdReason: outcome.holdReason || '', intent: outcome.intent, understanding: outcome.understanding, beliefs: outcome.beliefs }, raw: raw }).slice(0, 45000),
    '상태': outcome.result === 'hold' ? '판단보류' : '분석완료', '학생피드백': JSON.stringify(fb), '분석일시': now_()
  }));
  (await recordOutcome_(st, sub, item, outcome));
  (await setProgress_(p, prog));
  fb.submissionId = str_(sub['제출ID']);
  fb.view = (await workspaceView_(st, f.a, p, f.index, f.total));
  return fb;
}

/** 이해 단계 도움: 그래프·기하 문제는 시각화, 아니면 예시 */
async function api_comprehensionHelp(token, submissionId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var sub = (await getObj_(SH.SUBMIT, submissionId));
    if (!sub || str_(sub['학생ID']) !== st.id) throw userError_('제출 정보를 찾을 수 없어요.');
    var cached = parseJson_(sub['이해도움'], null);
    if (cached) return cached;
    var item = (await getItem_(str_(sub['문항ID'])));
    var mode = (item.visual === '그래프' || item.visual === '기하' || item.figure) ? '시각화' : '예시';
    var cfg = (await teacherAiConfig_(st.teacherId));
    var lines = parseJson_(sub['학생수정본'], []) || [];
    var probImgs = (await itemImages_(item)), solImgs = (await submissionImages_(sub));
    var images = probImgs.concat(solImgs);
    var note = [probImgs.length ? '문제 이미지(그림·보기 포함)' : '', solImgs.length ? '학생이 처음 제출한 풀이 사진(어디서 막혔는지 참고만)' : ''].filter(String).join(', ');
    var out = (await llmJson_(cfg, { system: promptHelpSystem_(), user: promptHelpUser_(item, mode, lines) + (note ? '\n[첨부 이미지] ' + note + ' 순서로 첨부함' : ''), images: images, maxTokens: 2200, temperature: 0.4 }));
    var fig = (out.figure && Array.isArray(out.figure.elements)) ? out.figure : (mode === '시각화' ? item.figure : null);
    var help = {
      mode: mode, title: String(out.title || (mode === '시각화' ? '문제 상황을 그림으로 보기' : '예시로 이해하기')),
      explanation: String(out.explanation || ''), figure: fig,
      example: out.example && out.example.problem ? { problem: String(out.example.problem), explanation: String(out.example.explanation || '') } : null,
      check: String(out.check_question || '')
    };
    (await updateObj_(SH.SUBMIT, sub._row, { '이해도움': JSON.stringify(help) }));
    return help;
  }));
}

async function api_nextAssignment(token, currentAssignmentId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var list = (await studentAssignments_(st));
    var prog = {};
    (await rows_(SH.PROGRESS)).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = str_(p['상태']); });
    var idx = -1;
    list.forEach(function (a, i) { if (str_(a['과제ID']) === String(currentAssignmentId)) idx = i; });
    for (var k = 1; k <= list.length; k++) {
      var a = list[(idx + k) % list.length];
      if (!a) break;
      if (str_(a['과제ID']) === String(currentAssignmentId)) continue;
      if (prog[str_(a['과제ID'])] !== '완료' && prog[str_(a['과제ID'])] !== '못 풂') return { assignmentId: str_(a['과제ID']) };
    }
    return { assignmentId: null };
  }));
}

/** [도움 받기]: 풀기 전에 문제를 자세히 설명한다(채팅 없이 설명 카드 하나). 같은 문제는 6시간 동안 저장해 둔 설명을 쓴다. */
async function api_problemHelp(token, assignmentId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var f = (await assignmentForStudent_(st, assignmentId));
    var p = (await getOrCreateProgress_(st, f.a));
    if (UPLOAD_STAGES.indexOf(str_(p['단계'])) < 0) throw userError_('지금은 도움을 받을 수 없는 단계예요.');
    var item = (await getItem_(str_(p['현재문항ID'])));
    var cache = CacheService.getScriptCache();
    var key = 'PH:' + item.id;
    var hit = (await cache.get(key));
    if (hit) return JSON.parse(hit);
    var mode = (item.visual === '그래프' || item.visual === '기하' || item.figure) ? '시각화' : '예시';
    var images = (await itemImages_(item));
    var cfg = (await teacherAiConfig_(st.teacherId));
    var out = (await llmJson_(cfg, {
      system: promptHelpSystem_(), user: promptHelpUser_(item, mode, []) + (images.length ? '\n[첨부 이미지] 문제 이미지(그림·보기 포함)' : ''),
      images: images, maxTokens: 2200, temperature: 0.4
    }));
    var fig = (out.figure && Array.isArray(out.figure.elements)) ? out.figure : (mode === '시각화' ? item.figure : null);
    var help = {
      mode: mode, title: String(out.title || '문제를 자세히 살펴봐요'), explanation: String(out.explanation || ''), figure: fig,
      example: out.example && out.example.problem ? { problem: String(out.example.problem), explanation: String(out.example.explanation || '') } : null,
      check: String(out.check_question || '')
    };
    if (!help.explanation && !help.example) throw userError_('AI가 설명을 만들지 못했어요. 잠시 후 다시 눌러 주세요.');
    (await cache.put(key, JSON.stringify(help), 21600));
    return help;
  }));
}

/** 설명을 보고도 이해하지 못함 → 이 문제는 넘어간다(못 풂으로 기록, 이해 단계 오류, 선생님께 알림). */
async function api_skipProblem(token, assignmentId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var f = (await assignmentForStudent_(st, assignmentId));
    var p = (await getOrCreateProgress_(st, f.a));
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 넘어갈 수 없는 단계예요.');
    var item = (await getItem_(str_(p['현재문항ID'])));
    var reason = '[도움 받기] 설명을 보고도 문제를 이해하지 못해 풀지 않고 넘어감';
    var fb = { result: 'wrong', stage: '이해', message: stageInfo_('skip').desc, canNext: true, skipped: true };
    var sub = {
      '제출ID': newId_('SUB'), '학생ID': st.id, '반': st.cls, '과제ID': str_(f.a['과제ID']), '문항ID': item.id, '문항코드': item.code,
      '개념id': item.conceptId, '시도구분': attemptKind_(stage), '시도차수': num_(p['시도횟수'], 0) + 1, '세션ID': str_(p['세션ID']),
      '이해못함': 'Y', '학생최종답': '', '정오': 'X', '주원인': '이해', '판단근거': reason, '상태': '못 풂',
      '학생피드백': JSON.stringify(fb), '제출일시': now_(), '분석일시': now_(), '가상여부': 'N'
    };
    (await appendObj_(SH.SUBMIT, sub));
    (await recordOutcome_(st, sub, item, {
      result: 'wrong', primary: '이해',
      errors: [{ line: '', stage: '이해', primary: true, conceptId: '', conceptName: '', category: '문제 이해 못함(학생 응답)', description: reason, evidence: '학생 응답', uncertainty: '', confidence: 1, source: '학생응답' }]
    }));
    (await createHelp_(st, sub, item, '학생이 이 문제를 못 풀어요: 문제를 이해하지 못했어요(도움 설명을 보고도 이해 못함).'));
    (await setProgress_(p, { '단계': 'skip', '상태': '못 풂', '최근제출ID': sub['제출ID'], '교사알림': 'Y', '완료일시': now_() }));
    fb.submissionId = sub['제출ID'];
    fb.view = (await workspaceView_(st, f.a, p, f.index, f.total));
    return fb;
  }));
}

async function api_markAnswerRead(token, requestId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var h = (await getObj_(SH.HELP, requestId));
    if (!h || str_(h['학생ID']) !== st.id) return false;
    (await updateObj_(SH.HELP, h._row, { '학생확인': 'Y' }));
    return true;
  }));
}

;
/* ===================== 1단계: 채팅식 유도질문 + 선수개념 역방향 추적 ===================== */
/*
 * 세션 상태(학습세션.상태데이터)
 *  frames  : 스택. 맨 위가 지금 풀고 있는 문제. origin = root(처음 오개념) | prereq(선수개념 추적)
 *  queue   : 아직 다루지 않은 다른 오개념 개념id
 *  visited : 이미 다룬 개념id
 *  trail   : 추적 경로 기록
 *  results : 끝난 프레임 결과(어려움 여부)
 */

async function newFrame_(conceptId, item, origin, depth) {
  var c = (await conceptInfo_(conceptId)) || {};
  return {
    conceptId: String(conceptId), conceptName: c.name || item.conceptName, grade: c.grade || item.grade,
    problemId: item.id, stepIndex: 0, hintLevel: 0, struggled: false, explained: false, turns: 0,
    origin: origin, depth: depth || 0, recent: [], notes: []
  };
}

function openingMessage_(frame) {
  if (frame.origin === 'root') {
    return "'" + frame.conceptName + "' 개념을 비슷한 문제로 함께 점검해 볼게요. 정답을 바로 알려 주지는 않을 거예요. 천천히 생각하고 답해 주세요.\n\n첫 번째 질문: 이 문제를 풀려면 가장 먼저 무엇을 해야 할까요?";
  }
  return "바탕이 되는 개념인 '" + frame.conceptName + "'(" + frame.grade + ")을 먼저 확인해 볼게요. 위의 문제를 읽어 보세요.\n\n이 문제에서 구해야 하는 것은 무엇이고, 어떻게 시작하면 좋을까요?";
}

async function chat_(sessionId, data, role, text, frame) {
  data.seq = (data.seq || 0) + 1;
  (await appendObj_(SH.CHAT, {
    '세션ID': sessionId, '순번': data.seq, '역할': role, '내용': text,
    '문항ID': frame ? frame.problemId : '', '개념id': frame ? frame.conceptId : '', '일시': now_()
  }));
  if (frame && (role === 'tutor' || role === 'student')) {
    frame.recent.push({ r: role === 'student' ? 's' : 't', x: String(text).slice(0, 500) });
    if (frame.recent.length > 12) frame.recent = frame.recent.slice(-12);
  }
  return { role: role, text: text };
}

function trailText_(data) {
  return (data.trail || []).map(function (t) { return t.conceptName + '(' + t.grade + ')'; }).join(' › ');
}
function resultText_(data) {
  var parts = (data.results || []).map(function (r) {
    var ok = r.understood === undefined ? !r.struggled : r.understood;
    return r.conceptName + '(' + r.grade + '): ' + (ok ? '이해함' : '어려움 확인') + (r.level ? '·' + r.level : '') + (r.notes && r.notes.length ? ' - ' + r.notes.join('; ') : '');
  });
  var checked = (data.candidates || []).filter(function (c) { return c.status && c.status !== '미정'; });
  if (checked.length) parts.push('오개념 후보 검증: ' + checked.map(function (c) { return c.conceptName + '(' + c.status + ')'; }).join(', '));
  return parts.join(' / ');
}

/** 분석에서 얻은 오개념 후보(확신도 순)를 유도질문에서 확인할 목록으로 만든다. 예전 분석 결과는 오개념 개념 id만 있다. */
async function tutorCandidates_(outcome) {
  var list = (outcome.candidates || []).map(function (c) {
    return { conceptId: String(c.conceptId || ''), conceptName: c.conceptName, kind: c.kind || '', confidence: c.confidence, belief: c.belief || '', status: '미정', notes: [] };
  });
  (await __aForEach((outcome.misconceptions || []), async function (id) {
    if (list.some(function (c) { return c.conceptId === String(id); })) return;
    var c = (await conceptInfo_(id));
    if (c) list.push({ conceptId: String(id), conceptName: c.name, kind: '', confidence: null, belief: (outcome.beliefs || [])[0] || '', status: '미정', notes: [] });
  }));
  return list.slice(0, 5);
}

/**
 * 유도질문에서 한 개념의 이해 여부를 오개념도표에 남긴다. 한 세션에서 한 개념은 한 번만.
 * 오개념이면 오류기록에도 남기되, 분석 때 이미 오개념으로 올린 개념은 다시 올리지 않는다(오개념 지도 횟수가 부풀지 않게).
 */
async function tutorVerdict_(st, sessionId, data, f, understood, level, reason, category) {
  var cid = String(f.conceptId || '');
  data.verdicts = data.verdicts || {};
  if (!cid || data.verdicts[cid]) return;
  data.verdicts[cid] = understood ? '이해함' : '오개념';
  if (understood) {
    (await recordConcepts_(studentRef_(st), [{ conceptId: cid, conceptName: f.conceptName, verdict: '이해함', source: '유도질문', level: level || '', reason: reason || '', itemId: f.problemId }]));
    return;
  }
  if ((data.recordedConcepts || []).indexOf(cid) >= 0) return;
  data.recordedConcepts = (data.recordedConcepts || []).concat([cid]);
  (await recordTutorFinding_(st, sessionId, { problemId: f.problemId, conceptId: cid, conceptName: f.conceptName, level: level || '' }, reason, category));
}

/** AI가 적은 후보 판단을 반영한다: 확인됨 → 오개념, 아님 → 이해함으로 오개념도표에 남긴다. */
async function applyCandidateChecks_(st, sessionId, data, frame, checks) {
  (await __aForEach((Array.isArray(checks) ? checks : []), async function (ck) {
    if (!ck) return;
    var verdict = String(ck.verdict || '');
    verdict = /확인/.test(verdict) ? '확인됨' : (/아님|없음|아니/.test(verdict) ? '아님' : '미정');
    var id = String(ck.concept_id === null || ck.concept_id === undefined ? '' : ck.concept_id).trim();
    var c = (data.candidates || []).filter(function (x) { return (id && x.conceptId === id) || (ck.concept_name && x.conceptName === ck.concept_name); })[0];
    if (!c || verdict === '미정') return;
    var before = c.status;
    c.status = verdict;
    if (ck.note) c.notes = (c.notes || []).concat([String(ck.note).slice(0, 160)]).slice(-3);
    if (before === verdict || !c.conceptId) return;
    var f = { problemId: frame.problemId, conceptId: c.conceptId, conceptName: c.conceptName };
    var note = ck.note ? ' (' + String(ck.note).slice(0, 120) + ')' : '';
    if (verdict === '확인됨') (await tutorVerdict_(st, sessionId, data, f, false, '', '유도질문에서 확인: ' + (c.belief || c.conceptName) + note, '오개념 확인(유도질문)'));
    else (await tutorVerdict_(st, sessionId, data, f, true, '', '유도질문에서 오개념 후보가 아님을 확인' + note));
  }));
}

async function saveSession_(ses, data, status) {
  (await updateObj_(SH.SESSION, ses._row, {
    '상태': status || str_(ses['상태']), '상태데이터': JSON.stringify(data), '추적경로': trailText_(data),
    '진단결과': resultText_(data), '대화수': data.msgCount || 0, '수정일시': now_()
  }));
}

async function tutorView_(st, ses) {
  var data = parseJson_(ses['상태데이터'], {}) || {};
  var frames = data.frames || [];
  var frame = frames[frames.length - 1];
  var item = frame ? (await getItem_(frame.problemId)) : null;
  var sid = str_(ses['세션ID']);
  var msgs = (await rows_(SH.CHAT)).filter(function (r) { return str_(r['세션ID']) === sid; })
    .sort(function (a, b) { return num_(a['순번'], 0) - num_(b['순번'], 0); }).slice(-80)
    .map(function (r) { return { role: str_(r['역할']), text: str_(r['내용']) }; });
  return {
    sessionId: sid, status: str_(ses['상태']), finished: str_(ses['상태']) !== '진행중',
    path: frames.map(function (f) { return { conceptId: f.conceptId, name: f.conceptName, grade: f.grade, origin: f.origin }; }),
    problem: (await publicItemFull_(item)), step: frame && item ? { index: frame.stepIndex, total: (item.steps || []).length } : null,
    messages: msgs, thinkSeconds: (await settingNum_('생각시간초', 20))
  };
}

function origSummary_(sub) {
  var a = parseJson_(sub && sub['AI분석'], {}) || {};
  var o = a.outcome || {};
  var parts = [];
  (o.errors || []).filter(function (e) { return e.stage === '변형' || e.stage === '이해'; }).slice(0, 2).forEach(function (e) {
    parts.push('[' + e.stage + '] ' + (e.category ? e.category + ': ' : '') + (e.description || '') + (e.evidence ? ' (근거: ' + e.evidence + ')' : ''));
  });
  if (o.intent && o.intent.strategy) parts.push('[학생의 전략] ' + o.intent.strategy + (o.intent.fitsProblem === false ? ' (문제에 맞지 않는 전략)' : ''));
  (o.beliefs || []).slice(0, 2).forEach(function (b) { parts.push('[학생의 생각] ' + b); });
  if (o.understanding && o.understanding.level) {
    var u = o.understanding;
    parts.push('[학생의 이해 수준] ' + u.level + (u.strengths && u.strengths.length ? ' / 잘한 점: ' + u.strengths.join(', ') : '') + (u.gaps && u.gaps.length ? ' / 부족한 점: ' + u.gaps.join(', ') : ''));
  }
  var lines = parseJson_(sub && sub['학생수정본'], []) || [];
  if (lines.length) parts.push('학생 풀이: ' + lines.map(function (l) { return l.text; }).join(' / ').slice(0, 300));
  return parts.join(' ').slice(0, 1200);
}

async function api_tutorStart(token, assignmentId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var f = (await assignmentForStudent_(st, assignmentId));
    var p = (await getOrCreateProgress_(st, f.a));
    if (str_(p['단계']) !== 'tutor') throw userError_('지금은 유도질문 학습 단계가 아니에요.');
    if (str_(p['세션ID'])) {
      var ex = (await getObj_(SH.SESSION, str_(p['세션ID'])));
      if (ex) return (await tutorView_(st, ex));
    }
    var cache = CacheService.getScriptCache();
    var flagKey = 'TS:' + str_(p['진행ID']);
    if ((await cache.get(flagKey))) throw userError_('학습을 준비하고 있어요. 잠시만 기다려 주세요.');
    (await cache.put(flagKey, '1', 120));
    try {
      var sub = (await getObj_(SH.SUBMIT, str_(p['최근제출ID'])));
      var item = (await getItem_(str_(p['현재문항ID'])));
      var outcome = (parseJson_(sub && sub['AI분석'], {}) || {}).outcome || {};
      var mis = (outcome.misconceptions || []).map(String).filter(String);
      if (!mis.length) mis = [item.conceptId];
      var cfg = (await teacherAiConfig_(st.teacherId));
      var exclude = (await seenItemIds_(st.id));
      exclude[item.id] = true;
      var first = mis[0];
      // 오개념 학습 문제는 처음 문제보다 쉬운 것으로 고른다(같은 개념).
      var prob = (await ensureSteps_(cfg, (await pickEasierForConcept_(cfg, first, item.diff, exclude, item))));
      var frame = (await newFrame_(first, prob, 'root', 0));
      var data = {
        frames: [frame], queue: mis.slice(1), visited: [first],
        trail: [{ conceptId: frame.conceptId, conceptName: frame.conceptName, grade: frame.grade, depth: 0, problemId: frame.problemId }],
        results: [], msgCount: 0, seq: 0, origSummary: origSummary_(sub), diff: item.diff, origItemId: item.id,
        candidates: (await tutorCandidates_(outcome)),
        // 분석할 때 이미 오개념도표에 올린 개념(같은 개념을 두 번 올리지 않게)
        recordedConcepts: (outcome.errors || []).filter(function (e) { return ['이해', '변형', '처리기술'].indexOf(e.stage) >= 0 && e.conceptId; }).map(function (e) { return String(e.conceptId); })
      };
      var sessionId = newId_('SES');
      (await appendObj_(SH.SESSION, {
        '세션ID': sessionId, '학생ID': st.id, '과제ID': str_(f.a['과제ID']), '원제출ID': sub ? str_(sub['제출ID']) : '',
        '원문항ID': item.id, '상태': '진행중', '상태데이터': '{}', '추적경로': '', '진단결과': '', '대화수': 0,
        '시작일시': now_(), '수정일시': now_()
      }));
      var ses = (await getObj_(SH.SESSION, sessionId));
      (await chat_(sessionId, data, 'tutor', openingMessage_(frame), frame));
      (await saveSession_(ses, data, '진행중'));
      (await setProgress_(p, { '세션ID': sessionId }));
      return (await tutorView_(st, (await getObj_(SH.SESSION, sessionId))));
    } finally {
      (await cache.remove(flagKey));
    }
  }));
}

async function api_tutorView(token, sessionId) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var ses = (await getObj_(SH.SESSION, sessionId));
    if (!ses || str_(ses['학생ID']) !== st.id) throw userError_('학습 세션을 찾을 수 없어요.');
    return (await tutorView_(st, ses));
  }));
}

/** 학생 메시지 처리. kind: answer | dontknow | hint */
async function api_tutorSend(token, sessionId, text, kind) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var ses = (await getObj_(SH.SESSION, sessionId));
    if (!ses || str_(ses['학생ID']) !== st.id) throw userError_('학습 세션을 찾을 수 없어요.');
    if (str_(ses['상태']) !== '진행중') throw userError_('이미 끝난 학습이에요.');
    var cache = CacheService.getScriptCache();
    var lockKey = 'TL:' + sessionId;
    if ((await cache.get(lockKey))) throw userError_('앞의 답을 처리하고 있어요. 잠시만 기다려 주세요.');
    (await cache.put(lockKey, '1', 90));
    try {
      return (await tutorTurn_(st, ses, String(text || ''), kind || 'answer'));
    } finally {
      (await cache.remove(lockKey));
    }
  }));
}

async function tutorTurn_(st, ses, text, kind) {
  var sessionId = str_(ses['세션ID']);
  var data = parseJson_(ses['상태데이터'], {}) || {};
  var frame = data.frames[data.frames.length - 1];
  var item = (await getItem_(frame.problemId));
  var cfg = (await teacherAiConfig_(st.teacherId));
  var maxDepth = (await settingNum_('최대추적깊이', 4));
  var maxMsgs = (await settingNum_('튜터최대대화', 40));

  var studentText = kind === 'hint' ? '(힌트를 요청함)' : (kind === 'dontknow' ? '모르겠어요' : text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500));
  if (!studentText) throw userError_('답을 입력해 주세요.');
  data.msgCount = (data.msgCount || 0) + 1;

  var visitedSet = {};
  (data.visited || []).forEach(function (v) { visitedSet[v] = true; });
  var depth = data.frames.length - 1;
  var candidates = depth + 1 < maxDepth ? (await prereqCandidates_(frame.conceptId, { depth: 1, min: 3, limit: 12, exclude: visitedSet })) : [];
  (await __aForEach(candidates, async function (c) { var info = (await conceptInfo_(c.id)); c.desc = info ? info.desc : ''; }));
  if (!data.candidates) data.candidates = [];
  var ctx = {
    frame: frame, item: item, concept: (await conceptInfo_(frame.conceptId)), path: data.frames.map(function (f) { return f.conceptName; }),
    depth: depth, maxDepth: maxDepth - 1, candidates: candidates, studentText: studentText,
    origSummary: frame.origin === 'root' ? data.origSummary : '', thinking: (frame.thinking || []).slice(-4),
    misCandidates: data.candidates
  };
  var probImgs = (await itemImages_(item)), solImgs = (await submissionImages_((await getObj_(SH.SUBMIT, str_(ses['원제출ID'])))));
  var images = probImgs.concat(solImgs);
  var note = [probImgs.length ? '지금 함께 푸는 문제의 이미지' : '', solImgs.length ? '학생이 처음 틀린 문제의 풀이 사진(지금 문제와 다를 수 있음, 학생의 생각을 이해하는 데 참고)' : ''].filter(String).join(', ');
  var out = (await llmJson_(cfg, { system: promptTutorSystem_(), user: promptTutorUser_(ctx) + (note ? '\n[첨부 이미지] ' + note + ' 순서로 첨부함' : ''), images: images, maxTokens: 1200, temperature: 0.4 }));

  var messages = [];
  messages.push((await chat_(sessionId, data, 'student', studentText, frame)));
  var action = String(out.action || 'continue').toLowerCase();
  if (['continue', 'explain', 'go_prereq', 'solved'].indexOf(action) < 0) action = 'continue';
  var reply = String(out.reply || '').trim() || '조금 더 자세히 설명해 줄래요?';
  frame.turns++;
  var si = parseInt(out.step_index, 10);
  if (!isNaN(si)) frame.stepIndex = Math.max(0, Math.min(si, Math.max(0, (item.steps || []).length - 1)));
  var hl = parseInt(out.hint_level, 10);
  if (!isNaN(hl)) frame.hintLevel = Math.max(frame.hintLevel, Math.min(3, hl));
  var state = String(out.student_state || '');
  if (/모름|오개념/.test(state) || action === 'explain' || frame.hintLevel >= 2 || kind === 'dontknow') frame.struggled = true;
  if (action === 'explain') frame.explained = true;
  if (out.student_thinking) {
    frame.thinking = (frame.thinking || []).concat([String(out.student_thinking).slice(0, 160)]).slice(-6);
  }
  if (out.misconception_note) {
    frame.notes.push(String(out.misconception_note).slice(0, 160));
    if (frame.notes.length > 4) frame.notes = frame.notes.slice(-4);
  }
  (await applyCandidateChecks_(st, sessionId, data, frame, out.candidate_checks));
  if (out.check_problem) frame.notes.push('확인 문제: ' + String(out.check_problem).slice(0, 140));
  if (frame.notes.length > 4) frame.notes = frame.notes.slice(-4);
  messages.push((await chat_(sessionId, data, 'tutor', reply, frame)));

  var finished = false, nextStage = '';

  if (action === 'go_prereq') {
    var pid = String(out.prereq_concept_id === null || out.prereq_concept_id === undefined ? '' : out.prereq_concept_id).trim();
    var okIds = {};
    candidates.forEach(function (c) { okIds[String(c.id)] = c; });
    if (!okIds[pid]) pid = conceptIdByName_(out.prereq_concept_name || out.prereq_reason, candidates);
    if (pid && okIds[pid] && !visitedSet[pid] && data.frames.length < maxDepth) {
      var exclude = (await seenItemIds_(st.id));
      data.frames.forEach(function (fr) { exclude[fr.problemId] = true; });
      var prob = (await ensureSteps_(cfg, (await pickEasierForConcept_(cfg, pid, num_(data.diff, item.diff), exclude, null))));
      var nf = (await newFrame_(pid, prob, 'prereq', data.frames.length));
      if (out.prereq_reason) nf.notes.push('추적 이유: ' + String(out.prereq_reason).slice(0, 140));
      data.frames.push(nf);
      data.visited.push(pid);
      data.trail.push({ conceptId: nf.conceptId, conceptName: nf.conceptName, grade: nf.grade, depth: nf.depth, problemId: nf.problemId });
      messages.push((await chat_(sessionId, data, 'system', "선수개념 확인: '" + nf.conceptName + "' (" + nf.grade + ')', nf)));
      messages.push((await chat_(sessionId, data, 'tutor', openingMessage_(nf), nf)));
    }
  } else if (action === 'solved') {
    var done = data.frames.pop();
    // 이 단계(처음 오개념·선수개념…)의 개념을 이해했는지: AI 판정, 없으면 힌트·설명·모름 여부(struggled)로 정한다.
    var cv = out.concept_verdict || {};
    var uv = cv.understood;
    var understood = (uv === true || String(uv) === 'true') ? true : ((uv === false || String(uv) === 'false') ? false : !done.struggled);
    var lv = String(cv.level || '').trim();
    if (UNDERSTANDING_LEVELS.indexOf(lv) < 0) lv = '';
    var why = cv.reason ? String(cv.reason).slice(0, 200) : (understood ? '유도질문 문제를 스스로 해결함' : '힌트·설명이 필요했음' + (done.notes.length ? ' - ' + done.notes.join(' / ') : ''));
    if (done.origin === 'prereq') why += ' (선수개념 추적 ' + done.depth + '단계)';
    (await tutorVerdict_(st, sessionId, data, done, understood, lv, why, done.origin === 'prereq' ? '선수개념 결손(유도질문 확인)' : '유도질문 단계 판정'));
    data.results.push({ conceptId: done.conceptId, conceptName: done.conceptName, grade: done.grade, origin: done.origin, struggled: done.struggled, understood: understood, level: lv, explained: done.explained, notes: done.notes, problemId: done.problemId });
    if (data.frames.length) {
      var parent = data.frames[data.frames.length - 1];
      var back = "좋아요! '" + done.conceptName + "' 문제를 스스로 해결했어요. 이제 아까 풀던 문제로 돌아가 볼게요. 방금 확인한 내용을 떠올리면서, 멈췄던 부분을 다시 생각해 볼까요?";
      messages.push((await chat_(sessionId, data, 'tutor', back, parent)));
    } else {
      // 다른 오개념이 남았으면 이어서
      var nextId = '';
      while (data.queue && data.queue.length && !nextId) {
        var q = String(data.queue.shift());
        if (data.visited.indexOf(q) < 0) nextId = q;
      }
      if (nextId) {
        var excl = (await seenItemIds_(st.id));
        data.frames.concat([done]).forEach(function (fr) { excl[fr.problemId] = true; });
        var prob2 = (await ensureSteps_(cfg, (await pickEasierForConcept_(cfg, nextId, num_(data.diff, 0), excl, null))));
        var rf = (await newFrame_(nextId, prob2, 'root', 0));
        data.frames.push(rf);
        data.visited.push(nextId);
        data.trail.push({ conceptId: rf.conceptId, conceptName: rf.conceptName, grade: rf.grade, depth: 0, problemId: rf.problemId });
        messages.push((await chat_(sessionId, data, 'system', "다음으로 확인할 개념: '" + rf.conceptName + "'", rf)));
        messages.push((await chat_(sessionId, data, 'tutor', openingMessage_(rf), rf)));
      } else {
        finished = true;
      }
    }
  }

  if (!finished && data.msgCount >= maxMsgs) {
    finished = true;
    (await createHelp_(st, { '제출ID': str_(ses['원제출ID']) }, (await getItem_(str_(ses['원문항ID']))), '유도질문 대화가 길어져 마무리함 (경로: ' + trailText_(data) + ')'));
    messages.push((await chat_(sessionId, data, 'system', '대화가 길어져 여기까지 할게요. 선생님께도 알려 드렸어요.', null)));
  }

  if (finished) {
    messages.push((await chat_(sessionId, data, 'system', '1단계 학습을 마쳤어요! 이제 처음 문제로 돌아가 다시 풀어 볼까요? (2단계)', null)));
    (await saveSession_(ses, data, '완료'));
    var a = { '과제ID': str_(ses['과제ID']) };
    var p = (await progressFor_(st, a['과제ID']));
    if (p) (await setProgress_(p, { '단계': 'regress', '현재문항ID': str_(p['원문항ID']), '시도횟수': 0, '최근제출ID': '' }));
    nextStage = 'regress';
  } else {
    (await saveSession_(ses, data, '진행중'));
  }

  var view = (await tutorView_(st, (await getObj_(SH.SESSION, sessionId))));
  return { messages: messages, finished: finished, nextStage: nextStage, view: view };
}

;
/* ===================== 풀이 사진 (Google Drive, 비공개) ===================== */

async function imageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = (await props.getProperty('IMG_FOLDER')) || (await setting_('이미지폴더ID'));
  if (id) {
    try { return (await DriveApp.getFolderById(id)); } catch (e) { /* 새로 만듦 */ }
  }
  var f = (await DriveApp.createFolder('수학오개념진단_풀이이미지(비공개)'));
  try { (await f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE)); } catch (e) { /* 도메인 정책상 불가하면 기본(비공개) 유지 */ }
  (await props.setProperty('IMG_FOLDER', f.getId()));
  try { (await setSetting_('이미지폴더ID', f.getId())); } catch (e) { /* 무시 */ }
  return f;
}

async function classFolder_(cls) {
  var root = (await imageFolder_());
  var name = (await classLabel_(cls));
  var it = (await root.getFoldersByName(name));
  return it.hasNext() ? it.next() : (await root.createFolder(name));
}

/** 파일 이름에는 이름 대신 학번만 쓴다 */
async function saveImage_(st, item, b64, mime) {
  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var name = st.id + '_' + item.id + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.' + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
  var file = (await (await classFolder_(st.cls)).createFile(blob));
  return { id: file.getId(), url: file.getUrl() };
}

/** 제출에 연결된 풀이 사진을 AI 호출용으로 읽는다. 없으면 빈 배열. */
async function submissionImages_(sub) {
  var fileId = sub ? str_(sub['이미지파일ID']) : '';
  if (!fileId) return [];
  try {
    var blob = (await (await DriveApp.getFileById(fileId)).getBlob());
    return [{ mime: blob.getContentType() || 'image/jpeg', base64: Utilities.base64Encode((await blob.getBytes())) }];
  } catch (e) {
    return [];
  }
}

/** 비공개 파일을 권한 확인 뒤 서버에서 읽어 화면에 보낸다 */
async function imageDataUrl_(fileId) {
  if (!fileId) return null;
  try {
    var blob = (await (await DriveApp.getFileById(fileId)).getBlob());
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode((await blob.getBytes()));
  } catch (e) {
    return null;
  }
}

;
/* ===================== 교사 API ===================== */

function ownsClass_(t, cls) { return (t.classes || []).indexOf(String(cls)) >= 0; }

async function api_teacherHome(token) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var students = (await rows_(SH.STUDENT));
    var classes = (await __aMap((t.classes || []), async function (cls) {
      var list = students.filter(function (s) { return str_(s['반']) === cls; });
      return {
        cls: cls, label: (await classLabel_(cls)), count: list.length,
        registered: list.filter(function (s) { return str_(s['가입여부']) === 'Y'; }).length
      };
    }));
    var pending = (await rows_(SH.HELP)).filter(function (h) {
      return str_(h['상태']) === '대기' && (str_(h['교사ID']) === t.id || ownsClass_(t, str_(h['반'])));
    }).length;
    var aiReady = !!(await PropertiesService.getScriptProperties().getProperty(apiKeyProp_(t.id)));
    return { profile: t, classes: classes, pending: pending, aiReady: aiReady, school: (await setting_('학교명')) };
  }));
}

async function api_classStudents(token, cls) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    cls = String(cls);
    if (!ownsClass_(t, cls)) throw userError_('담당 학급이 아니에요.');
    var sums = {};
    (await rows_(SH.STAGESUM)).forEach(function (r) { sums[str_(r['학생ID'])] = r; });
    var progRows = (await rows_(SH.PROGRESS));
    return (await __aMap((await rows_(SH.STUDENT)).filter(function (s) { return str_(s['반']) === cls; })
      .sort(function (a, b) { return num_(a['번호'], 0) - num_(b['번호'], 0); })
      , async function (s) {
        var id = str_(s['학생ID']), m = sums[id] || {};
        var sub = num_(m['제출수'], 0), ok = num_(m['정답수'], 0);
        return {
          id: id, num: num_(s['번호'], 0), name: str_(s['이름']), registered: str_(s['가입여부']) === 'Y',
          virtual: str_(s['가상여부']) === 'Y', lastAccess: str_(s['최근접속']), submitted: sub,
          rate: sub ? Math.round(ok * 100 / sub) : null, report: (await reportProgress_((await studentSessionInfo_(s)), progRows))
        };
      }));
  }));
}

async function api_resetStudent(token, studentId) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var s = (await getObj_(SH.STUDENT, studentId));
    if (!s || !ownsClass_(t, str_(s['반']))) throw userError_('학생을 찾을 수 없어요.');
    (await updateObj_(SH.STUDENT, s._row, { '가입여부': 'N', '비밀번호해시': '', '솔트': '' }));
    return true;
  }));
}

function helpVisible_(t, h) { return str_(h['교사ID']) === t.id || ownsClass_(t, str_(h['반'])); }

async function api_helpList(token) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var names = {};
    (await rows_(SH.STUDENT)).forEach(function (s) { names[str_(s['학생ID'])] = s; });
    return (await __aMap((await rows_(SH.HELP)).filter(function (h) { return helpVisible_(t, h); }), async function (h) {
      var s = names[str_(h['학생ID'])] || {};
      var it = (await getItem_(str_(h['문항ID'])));
      return {
        requestId: str_(h['요청ID']), status: str_(h['상태']), reason: str_(h['사유']), at: str_(h['요청일시']),
        cls: str_(h['반']), num: num_(s['번호'], 0), name: str_(s['이름']), conceptName: it ? it.conceptName : '',
        answeredAt: str_(h['답변일시'])
      };
    })).sort(function (a, b) {
      if (a.status !== b.status) return a.status === '대기' ? -1 : 1;
      return String(b.at).localeCompare(String(a.at));
    }).slice(0, 300);
  }));
}

async function api_helpDetail(token, requestId) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var h = (await getObj_(SH.HELP, requestId));
    if (!h || !helpVisible_(t, h)) throw userError_('요청을 찾을 수 없어요.');
    var s = (await getObj_(SH.STUDENT, str_(h['학생ID']))) || {};
    var sub = str_(h['제출ID']) ? (await getObj_(SH.SUBMIT, str_(h['제출ID']))) : null;
    var item = (await getItem_(str_(h['문항ID'])));
    var analysis = sub ? (parseJson_(sub['AI분석'], {}) || {}).outcome || null : null;
    var cands = item ? [{ id: item.conceptId, name: item.conceptName, grade: item.grade }].concat((await prereqCandidates_(item.conceptId, { depth: 2, min: 4, limit: 15 }))) : [];
    return {
      request: { requestId: str_(h['요청ID']), status: str_(h['상태']), reason: str_(h['사유']), at: str_(h['요청일시']), answer: str_(h['교사답변']), stage: str_(h['교사판정단계']), conceptId: str_(h['교사판정개념id']) },
      student: { id: str_(s['학생ID']), cls: str_(s['반']), num: num_(s['번호'], 0), name: str_(s['이름']) },
      item: item ? Object.assign(JSON.parse(JSON.stringify(item)), item.imageId ? { image: (await imageDataUrl_(item.imageId)) } : {}) : null,
      submission: sub ? {
        aiLines: (parseJson_(sub['AI전사'], { lines: [] }) || {}).lines || [], lines: parseJson_(sub['학생수정본'], []) || [],
        notUnderstood: str_(sub['이해못함']), selfCorrection: str_(sub['자기교정']), studentAnswer: str_(sub['학생최종답']),
        result: str_(sub['정오']), primary: str_(sub['주원인']), at: str_(sub['제출일시'])
      } : null,
      analysis: analysis,
      image: sub ? (await imageDataUrl_(str_(sub['이미지파일ID']))) : null,
      candidates: cands
    };
  }));
}

async function api_helpAnswer(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    p = p || {};
    var h = (await getObj_(SH.HELP, p.requestId));
    if (!h || !helpVisible_(t, h)) throw userError_('요청을 찾을 수 없어요.');
    var answer = String(p.answer || '').trim().slice(0, 3000);
    if (!answer) throw userError_('학생에게 보낼 답변을 입력해 주세요.');
    var stage = String(p.stage || '');
    if (stage && stage !== '정답' && STAGE_ORDER.indexOf(stage) < 0) stage = '';
    var conceptId = String(p.conceptId || '');
    var wasPending = str_(h['상태']) === '대기';
    (await updateObj_(SH.HELP, h._row, { '상태': '답변완료', '교사답변': answer, '교사판정단계': stage, '교사판정개념id': conceptId, '답변일시': now_(), '학생확인': 'N' }));

    var sub = str_(h['제출ID']) ? (await getObj_(SH.SUBMIT, str_(h['제출ID']))) : null;
    var stRow = (await getObj_(SH.STUDENT, str_(h['학생ID'])));
    if (sub && stRow && stage && wasPending) {
      var st = { id: str_(stRow['학생ID']), cls: str_(stRow['반']), num: str_(stRow['번호']), name: str_(stRow['이름']) };
      var wasHold = str_(sub['정오']) === '보류';
      var item = (await getItem_(str_(sub['문항ID'])));
      (await updateObj_(SH.SUBMIT, sub._row, { '정오': stage === '정답' ? 'O' : 'X', '주원인': stage === '정답' ? '' : stage, '상태': '교사판정' }));
      var patch = {};
      if (wasHold) patch['판단보류'] = -1;
      if (stage === '정답') {
        patch['정답수'] = 1;
        if (item && item.conceptId) (await recordConcepts_(st, [{ conceptId: item.conceptId, conceptName: item.conceptName, verdict: '이해함', source: '교사판정', reason: '선생님이 정답으로 판정: ' + answer.slice(0, 200), itemId: item.id }]));
      }
      else {
        patch['오답수'] = 1;
        patch['주원인_' + stage] = 1;
        if (stage === '처리기술') patch['처리기술점수'] = 1;
        if (stage === '인코딩') patch['인코딩점수'] = 1;
        var c = conceptId ? (await conceptInfo_(conceptId)) : null;
        (await appendObj_(SH.ERROR, {
          '오류ID': newId_('E'), '제출ID': str_(sub['제출ID']), '학생ID': st.id, '반': st.cls, '문항ID': item ? item.id : '',
          '문항코드': item ? item.code : '', '줄번호': '', 'Newman단계': stage, '주원인여부': 'Y', '개념id': conceptId,
          '개념명': c ? c.name : '', '오류유형': '교사 판정', '설명': answer.slice(0, 300), '판단근거': '교사 확인', '불확실성': '',
          '확신도': 1, '출처': '교사', '기록일시': now_(), '가상여부': 'N'
        }));
        if (conceptId && ['이해', '변형', '처리기술'].indexOf(stage) >= 0) (await bumpMiscon_(st, [conceptId], { source: '교사판정', reason: '[' + stage + '] ' + answer.slice(0, 200), itemId: item ? item.id : '' }));
      }
      if (!wasHold) delete patch['판단보류'];
      (await bumpStageSum_(st, patch));
      var prog = (await rows_(SH.PROGRESS)).filter(function (x) { return str_(x['학생ID']) === st.id && str_(x['과제ID']) === str_(sub['과제ID']); })[0];
      if (prog && str_(prog['단계']) === 'hold') (await setProgress_(prog, { '단계': 'done', '상태': '완료', '완료일시': now_() }));
    }
    return true;
  }));
}

/* ---------- 설정 ---------- */
function maskKey_(k) { return k ? '설정됨 (…' + String(k).slice(-4) + ')' : '미설정'; }

async function api_teacherSettings(token) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var row = (await getObj_(SH.TEACHER, t.id));
    var key = (await PropertiesService.getScriptProperties().getProperty(apiKeyProp_(t.id)));
    var model = str_(row['모델']);
    if (!/^(gpt|o\d|chatgpt)/i.test(model)) model = PROVIDERS.openai.defaultModel;
    return {
      provider: 'openai', model: model,
      keyStatus: maskKey_(key), providers: PROVIDERS, loginId: str_(row['로그인ID']),
      baseUrl: (await aiBaseUrl_(t.id)), defaultBaseUrl: DEFAULT_AI_BASE_URL
    };
  }));
}

async function api_saveTeacherSettings(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    p = p || {};
    var provider = 'openai';
    // 보낸 항목만 바꾼다(모델을 안 보내면 저장된 모델 유지, 빈 값이면 기본 모델).
    var model = p.model === undefined ? str_((await getObj_(SH.TEACHER, t.id))['모델']) : String(p.model || '').trim().slice(0, 80);
    if (!model) model = PROVIDERS.openai.defaultModel;
    var props = PropertiesService.getScriptProperties();
    if (p.baseUrl !== undefined) {
      var base = String(p.baseUrl || '').trim().replace(/\/+$/, '');
      if (!base) (await props.deleteProperty(baseUrlProp_(t.id)));
      else if (!/^https:\/\/[^\s]+$/.test(base) || base.length > 300) throw userError_('API 주소는 https:// 로 시작해야 해요.');
      else (await props.setProperty(baseUrlProp_(t.id), base));
    }
    var key = String(p.apiKey || '').trim();
    if (key === '__DELETE__') (await props.deleteProperty(apiKeyProp_(t.id)));
    else if (key) {
      if (key.length < 15 || key.length > 400 || /\s/.test(key)) throw userError_('API 키 형식을 확인해 주세요.');
      (await props.setProperty(apiKeyProp_(t.id), key));
    }
    var saved = (await props.getProperty(apiKeyProp_(t.id)));
    (await updateObj_(SH.TEACHER, t.id, { 'AI제공자': provider, '모델': model, 'API키상태': maskKey_(saved), '수정일시': now_() }));
    return { keyStatus: maskKey_(saved), provider: provider, model: model, baseUrl: (await aiBaseUrl_(t.id)) };
  }));
}

async function api_testAi(token) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var cfg = (await teacherAiConfig_(t.id));
    var out = (await llmJson_(cfg, { system: '너는 연결 확인용 도우미다. JSON으로만 답한다.', user: '{"ok": true, "message": "연결 성공"} 을 그대로 JSON으로 출력하라.', maxTokens: 100, temperature: 0 }));
    return { ok: !!out.ok, provider: cfg.provider, model: cfg.model };
  }));
}

/* ---------- 문제 출제 ---------- */
async function api_problemBank(token, f) {
  return (await wrap_(async function () {
    (await requireTeacher_(token));
    f = f || {};
    var idx = (await itemInfoIndex_()), cm = (await conceptMap_());
    var gradeSet = {};
    Object.keys(idx.codes).forEach(function (c) { if (idx.codes[c].grade) gradeSet[idx.codes[c].grade] = 1; });
    var grades = Object.keys(gradeSet).sort(function (a, b) { return gradeRank_(a) - gradeRank_(b); });
    var grade = f.grade || (gradeSet['중3'] ? '중3' : grades[grades.length - 1] || '');
    var made = {};
    var imgFor = {};
    (await allItems_()).forEach(function (it) {
      if (it.imageId) { imgFor[it.code] = it.id; return; }
      (made[it.code] = made[it.code] || []).push({ id: it.id, preview: previewText_(it.text, 60) });
    });
    var unitSet = {};
    var q = String(f.q || '').trim();
    var rows = Object.keys(idx.codes).map(function (code) { return idx.codes[code]; }).filter(function (x) { return x.grade === grade; }).map(function (x) {
      var c = cm[x.conceptId] || {};
      var unit = String(c.unit || '').split('>')[0].trim() || '(단원 정보 없음)';
      unitSet[unit] = 1;
      return { code: x.code, conceptId: x.conceptId, conceptName: x.conceptName || c.name || '', unit: unit, diff: Math.round(x.diff * 100) / 100, generated: made[x.code] || [], imageItemId: imgFor[x.code] || '' };
    }).filter(function (r) {
      if (f.unit && r.unit !== f.unit) return false;
      if (q && (r.code + ' ' + r.conceptName).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.code < b.code ? -1 : 1; });
    return { grades: grades, grade: grade, units: Object.keys(unitSet), total: rows.length, rows: rows.slice(0, 300) };
  }));
}

async function api_generateForCode(token, code) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    // 문제 이미지가 있는 문항코드는 AI 생성 없이 이미지 문항을 그대로 쓴다(API 키도 필요 없음).
    var img = (await imageItemForCode_(String(code)));
    if (img) return img;
    var cfg = (await teacherAiConfig_(t.id));
    return (await generateItemForCode_(cfg, String(code), null));
  }));
}

async function api_itemDetail(token, itemId) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var it = (await getItem_(itemId));
    if (!it) throw userError_('문항을 찾을 수 없어요.');
    var note = '';
    // 아직 정답을 만들지 않은 이미지 문항은 미리보기를 열 때 AI가 풀어 둔다(교사가 바로 확인할 수 있게).
    if (it.imageId && !it.answer) {
      try { it = (await ensureImageSolved_((await teacherAiConfig_(t.id)), it)); } catch (e) { note = '정답을 아직 만들지 못했어요: ' + e.message; }
    }
    var out = JSON.parse(JSON.stringify(it));
    if (it.imageId) out.image = (await imageDataUrl_(it.imageId));
    out.note = note;
    return out;
  }));
}

/** 교사가 이미지 문항의 정답을 확인·수정한다. */
async function api_saveItemAnswer(token, p) {
  return (await wrap_(async function () {
    (await requireTeacher_(token));
    p = p || {};
    var it = (await getItem_(String(p.itemId || '')));
    if (!it) throw userError_('문항을 찾을 수 없어요.');
    var answer = String(p.answer || '').trim().slice(0, 300);
    if (!answer) throw userError_('정답을 입력해 주세요.');
    (await updateObj_(SH.ITEM, it.id, { '정답': answer, '정답확인': '확인됨' }));
    forget_('item:' + it.id);
    forget_('allItems');
    return { answer: answer, answerCheck: '확인됨' };
  }));
}

async function api_assignments(token) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var cm = (await conceptMap_());
    return (await __aMap((await rows_(SH.ASSIGN)).filter(function (a) { return str_(a['교사ID']) === t.id; })
      .sort(function (a, b) { return num_(a['순서'], 999) - num_(b['순서'], 999); })
      , async function (a) {
        var it = (await getItem_(str_(a['문항ID'])));
        return {
          assignmentId: str_(a['과제ID']), order: num_(a['순서'], 0), classes: str_(a['대상반']), visible: str_(a['공개']) !== 'N',
          item: it ? { id: it.id, code: it.code, conceptName: it.conceptName, unit: String((cm[it.conceptId] || {}).unit || '').split('>')[0].trim(), preview: it.text ? previewText_(it.text, 80) : (it.imageId ? '(그림으로 된 문제)' : ''), source: it.source } : null
        };
      }));
  }));
}

async function api_assign(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    p = p || {};
    var ids = (p.itemIds || []).map(String).filter(String);
    var classes = (p.classes || []).map(String).filter(function (c) { return ownsClass_(t, c); });
    if (!ids.length) throw userError_('출제할 문제를 골라 주세요.');
    if (!classes.length) throw userError_('대상 학급을 골라 주세요.');
    return (await withLock_(async function () {
      var mine = (await rows_(SH.ASSIGN)).filter(function (a) { return str_(a['교사ID']) === t.id; });
      var order = mine.reduce(function (m, a) { return Math.max(m, num_(a['순서'], 0)); }, 0);
      var rows = (await __aFilter(ids, async function (id) { return !!(await getItem_(id)); })).map(function (id) {
        order++;
        return { '과제ID': newId_('A'), '교사ID': t.id, '대상반': classes.join(','), '문항ID': id, '순서': order, '공개': 'Y', '출제일시': now_() };
      });
      (await appendObjs_(SH.ASSIGN, rows));
      return rows.length;
    }));
  }));
}

/** 여러 과제의 상태를 한 번에: 과제 기간(학생에게 보임) / 과제 종료(학생 목록에서 빠짐) */
async function api_setAssignmentsStatus(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    p = p || {};
    var ids = {};
    (p.ids || []).forEach(function (id) { ids[String(id)] = true; });
    var val = p.status === 'ended' ? 'N' : 'Y';
    return (await withLock_(async function () {
      var n = 0;
      (await __aForEach((await rows_(SH.ASSIGN)), async function (a) {
        if (str_(a['교사ID']) !== t.id || !ids[str_(a['과제ID'])]) return;
        if (str_(a['공개']) !== val) (await updateObj_(SH.ASSIGN, a._row, { '공개': val }));
        n++;
      }));
      return n;
    }));
  }));
}

/** 출제 목록에서 여러 문제를 한 번에 뺀다(아래 행부터 지워 행 번호가 밀리지 않게). */
async function api_removeAssignments(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    var ids = {};
    ((p && p.ids) || []).forEach(function (id) { ids[String(id)] = true; });
    return (await withLock_(async function () {
      var rows = (await rows_(SH.ASSIGN)).filter(function (a) { return str_(a['교사ID']) === t.id && ids[str_(a['과제ID'])]; })
        .sort(function (a, b) { return b._row - a._row; });
      var sh = (await sheet_(SH.ASSIGN));
      (await __aForEach(rows, async function (a) { (await sh.deleteRow(a._row)); }));
      return rows.length;
    }));
  }));
}

async function api_updateAssignment(token, p) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    p = p || {};
    return (await withLock_(async function () {
      var mine = (await rows_(SH.ASSIGN)).filter(function (a) { return str_(a['교사ID']) === t.id; })
        .sort(function (a, b) { return num_(a['순서'], 999) - num_(b['순서'], 999); });
      var i = -1;
      mine.forEach(function (a, k) { if (str_(a['과제ID']) === String(p.assignmentId)) i = k; });
      if (i < 0) throw userError_('출제 항목을 찾을 수 없어요.');
      var a = mine[i];
      if (p.action === 'toggle') (await updateObj_(SH.ASSIGN, a._row, { '공개': str_(a['공개']) === 'N' ? 'Y' : 'N' }));
      else if (p.action === 'delete') (await (await sheet_(SH.ASSIGN)).deleteRow(a._row));
      else if (p.action === 'move') {
        // 끌어다 놓기: 지정한 자리(0부터)로 옮기고 순서를 1부터 다시 매긴다.
        var to = Math.max(0, Math.min(mine.length - 1, parseInt(p.to, 10) || 0));
        var moved = mine.splice(i, 1)[0];
        mine.splice(to, 0, moved);
        (await __aForEach(mine, async function (x, k) { if (num_(x['순서'], 0) !== k + 1) (await updateObj_(SH.ASSIGN, x._row, { '순서': k + 1 })); }));
      }
      else if (p.action === 'up' || p.action === 'down') {
        var j = p.action === 'up' ? i - 1 : i + 1;
        if (j >= 0 && j < mine.length) {
          mine.forEach(function (x, k) { x._order = k + 1; });
          var tmp = mine[i]._order; mine[i]._order = mine[j]._order; mine[j]._order = tmp;
          (await updateObj_(SH.ASSIGN, mine[i]._row, { '순서': mine[i]._order }));
          (await updateObj_(SH.ASSIGN, mine[j]._row, { '순서': mine[j]._order }));
        }
      }
      return true;
    }));
  }));
}

;
/* ===================== 웹앱 시작점·스프레드시트 메뉴 ===================== */

async function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.boot = JSON.stringify((await bootConfig_())).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

async function bootConfig_() {
  try {
    return { appName: APP_NAME, school: (await setting_('학교명')), grade: (await setting_('학년')) || '3', classes: (await classList_()), version: APP_VERSION, ready: !!(await sheet_(SH.STUDENT, true)) };
  } catch (e) {
    return { appName: APP_NAME, school: '', grade: '3', classes: ['1', '2', '3', '4', '5'], version: APP_VERSION, ready: false };
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('오개념진단')
    .addItem('① 초기 설정 (시트·교사·학생 명단·문제 이미지 연결)', 'menuSetup')
    .addItem('② 가상 학습 로그 만들기 (시연용)', 'menuDemo')
    .addItem('문제 정답 미리 만들기 (이미지 문항)', 'menuSolveImages')
    .addSeparator()
    .addItem('가상 학습 로그 지우기', 'menuClearDemo')
    .addItem('점수 다시 계산 (오개념도표·단계별집계)', 'menuRebuild')
    .addItem('웹앱 주소 보기', 'menuShowUrl')
    .addToUi();
}

async function menuSetup() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('초기 설정 완료', (await setupAll_()), ui.ButtonSet.OK); } catch (e) { ui.alert('초기 설정 오류', String(e.message || e), ui.ButtonSet.OK); }
}
async function menuSolveImages() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('문제 정답 미리 만들기', (await solveImagesBatch_()), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
async function menuDemo() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('가상 학습 로그', (await createDemoData_()), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
async function menuClearDemo() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('가상 학습 로그 지우기', '가상여부=Y 인 풀이·오류 기록과 가상 교사확인요청을 지우고 점수를 다시 계산할까요?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try { ui.alert('완료', (await clearDemoData_()), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
async function menuRebuild() {
  var ui = SpreadsheetApp.getUi();
  try { (await rebuildScores_()); ui.alert('완료', '오개념도표와 단계별집계를 기록으로부터 다시 계산했어요.', ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuShowUrl() {
  var ui = SpreadsheetApp.getUi();
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  ui.alert('웹앱 주소', url ? url + '\n\n이 주소를 학생에게 공유하세요.' : '아직 배포하지 않았어요. Apps Script 편집기에서 [배포 > 새 배포 > 웹 앱]으로 배포해 주세요.', ui.ButtonSet.OK);
}

;
/* ===================== 초기 설정 ===================== */

var VIRTUAL_SURNAMES = ['강', '김', '이', '박', '최', '정', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
var VIRTUAL_GIVEN = ['민준', '서연', '도윤', '지우', '하준', '서윤', '시우', '하은', '주원', '지호', '수아', '예준', '지민', '유준', '채원', '은우', '지아', '현우', '다은', '건우',
  '윤서', '우진', '소율', '선우', '예린', '연우', '하린', '정우', '수빈', '태윤'];

function virtualName_(i) {
  return VIRTUAL_SURNAMES[(i * 7) % VIRTUAL_SURNAMES.length] + VIRTUAL_GIVEN[i % VIRTUAL_GIVEN.length];
}

async function ensureSheet_(name, headers, styled) {
  var ss = (await ss_());
  var sh = (await ss.getSheetByName(name));
  if (!sh) sh = (await ss.insertSheet(name));
  if ((await sh.getLastRow()) < 1 || (await sh.getLastColumn()) < 1) {
    if ((await sh.getMaxColumns()) < headers.length) (await sh.insertColumnsAfter((await sh.getMaxColumns()), headers.length - (await sh.getMaxColumns())));
    var r = sh.getRange(1, 1, 1, headers.length);
    (await r.setValues([headers]));
    if (styled) { r.setFontWeight('bold').setBackground('#EDF2FF'); sh.setFrozenRows(1); }
  } else {
    var lc = (await sh.getLastColumn());
    var cur = (await sh.getRange(1, 1, 1, lc).getValues())[0].map(function (h) { return String(h).trim(); });
    var missing = headers.filter(function (h) { return cur.indexOf(h) < 0; });
    if (missing.length) {
      if (lc + missing.length > (await sh.getMaxColumns())) (await sh.insertColumnsAfter((await sh.getMaxColumns()), lc + missing.length - (await sh.getMaxColumns())));
      (await sh.getRange(1, lc + 1, 1, missing.length).setValues([missing]));
    }
  }
  forget_('hdr:' + name);
  return sh;
}

var SAMPLE_ITEMS = [
  { code: 'A090011001', cid: '5261', name: '제곱근의 곱셈', diff: 0.0364, text: '다음을 계산하시오.\n$\\sqrt{3}\\times\\sqrt{12}$', answer: '$6$',
    steps: ['근호끼리 곱한다: $\\sqrt{3}\\times\\sqrt{12}=\\sqrt{36}$', '$36=6^2$이므로 $\\sqrt{36}=6$'], type: '풀이분석', visual: '없음', figure: null },
  { code: 'A090018003', cid: '972', name: '곱셈 공식', diff: 0.2639, text: '$(x+3)(x-5)$를 전개하시오.', answer: '$x^2-2x-15$',
    steps: ['곱셈 공식 $(x+a)(x+b)=x^2+(a+b)x+ab$에서 $a=3$, $b=-5$', '$a+b=-2$, $ab=-15$', '$x^2-2x-15$'], type: '풀이분석', visual: '없음', figure: null },
  { code: 'A090022001', cid: '10169', name: '인수분해', diff: -0.2991, text: '다항식 $x^2-7x+12$를 인수분해하시오.', answer: '$(x-3)(x-4)$',
    steps: ['곱이 $12$, 합이 $-7$인 두 수를 찾는다', '두 수는 $-3$과 $-4$', '$x^2-7x+12=(x-3)(x-4)$'], type: '풀이분석', visual: '없음', figure: null },
  { code: 'A090027002', cid: '9832', name: '인수분해를 이용한 이차방정식의 풀이', diff: 0.12, text: '이차방정식 $x^2-x-12=0$을 푸시오.', answer: '$x=-3$ 또는 $x=4$',
    steps: ['좌변을 인수분해한다: $(x+3)(x-4)=0$', '$AB=0$이면 $A=0$ 또는 $B=0$', '$x+3=0$ 또는 $x-4=0$', '$x=-3$ 또는 $x=4$'], type: '풀이분석', visual: '없음', figure: null },
  { code: 'A090030005', cid: '1011', name: '이차방정식의 근의 공식; $ax^2+bx+c=0$', diff: -0.1941, text: '이차방정식 $x^2+3x-1=0$의 해를 근의 공식을 이용하여 구하시오.', answer: '$x=\\dfrac{-3\\pm\\sqrt{13}}{2}$',
    steps: ['$a=1$, $b=3$, $c=-1$', '근의 공식 $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$에 대입한다', '$b^2-4ac=9+4=13$', '$x=\\dfrac{-3\\pm\\sqrt{13}}{2}$'], type: '풀이분석', visual: '없음', figure: null },
  { code: 'A090039006', cid: '1252', name: '이차함수 $y=a(x-p)^2+q$의 그래프의 성질', diff: 0.3114, text: '이차함수 $y=2(x-1)^2-3$의 그래프의 꼭짓점의 좌표와 축의 방정식을 구하시오.', answer: '꼭짓점 $(1,-3)$, 축의 방정식 $x=1$',
    steps: ['$y=a(x-p)^2+q$의 꼭짓점은 $(p,q)$, 축은 $x=p$', '$p=1$, $q=-3$', '꼭짓점 $(1,-3)$, 축의 방정식 $x=1$'], type: '풀이분석', visual: '그래프', figure: null },
  { code: 'A090062001', cid: '9928', name: '원주각과 중심각의 크기', diff: -0.6402, text: '다음 그림과 같이 원 $O$에서 $\\angle AOB=110^\\circ$일 때, $\\angle APB$의 크기를 구하시오.', answer: '$55^\\circ$',
    steps: ['한 호에 대한 원주각의 크기는 중심각의 크기의 $\\frac{1}{2}$', '$\\angle APB=\\frac{1}{2}\\angle AOB$', '$\\angle APB=\\frac{1}{2}\\times110^\\circ=55^\\circ$'], type: '풀이분석', visual: '기하',
    figure: { view: { xmin: -4, xmax: 4, ymin: -4, ymax: 4 }, axes: false, elements: [
      { type: 'circle', center: [0, 0], r: 3 }, { type: 'point', id: 'O', x: 0, y: 0, label: 'O' },
      { type: 'point', id: 'A', polar: { center: [0, 0], r: 3, deg: 215 }, label: 'A' }, { type: 'point', id: 'B', polar: { center: [0, 0], r: 3, deg: 325 }, label: 'B' },
      { type: 'point', id: 'P', polar: { center: [0, 0], r: 3, deg: 100 }, label: 'P' },
      { type: 'segment', from: 'O', to: 'A' }, { type: 'segment', from: 'O', to: 'B' }, { type: 'segment', from: 'P', to: 'A' }, { type: 'segment', from: 'P', to: 'B' },
      { type: 'angle', vertex: 'O', from: 'A', to: 'B', label: '110°' }] } },
  { code: 'A090052001', cid: '2601', name: '삼각형의 넓이; 끼인각이 예각인 경우', diff: -0.4718, text: '$\\triangle ABC$에서 $\\overline{AB}=6$, $\\overline{AC}=8$, $\\angle A=30^\\circ$일 때, $\\triangle ABC$의 넓이를 구하시오.', answer: '$12$',
    steps: ['두 변과 끼인각을 알 때 넓이 $=\\frac{1}{2}ab\\sin C$', '$\\frac{1}{2}\\times6\\times8\\times\\sin30^\\circ$', '$\\sin30^\\circ=\\frac{1}{2}$이므로 $12$'], type: '풀이분석', visual: '기하',
    figure: { view: { xmin: -1, xmax: 9, ymin: -1, ymax: 4.5 }, axes: false, elements: [
      { type: 'point', id: 'A', x: 0, y: 0, label: 'A' }, { type: 'point', id: 'B', x: 5.196, y: 3, label: 'B' }, { type: 'point', id: 'C', x: 8, y: 0, label: 'C' },
      { type: 'polygon', points: ['A', 'B', 'C'] }, { type: 'segment', from: 'A', to: 'B', label: '6' }, { type: 'segment', from: 'A', to: 'C', label: '8' },
      { type: 'angle', vertex: 'A', from: 'C', to: 'B', label: '30°' }] } },
  { code: 'A090069002', cid: '9924', name: '평균', diff: -0.3196, text: '다음 자료의 평균을 구하시오.\n$4,\\ 7,\\ 9,\\ 10,\\ 5$', answer: '$7$',
    steps: ['자료의 합을 구한다: $4+7+9+10+5=35$', '자료의 개수는 $5$', '평균 $=35\\div5=7$'], type: '풀이분석', visual: '없음', figure: null }
];

/**
 * 초기 설정은 1~2분 걸린다. 그 사이 메뉴를 또 누르면 두 실행이 모두 '시트가 비어 있다'고 보고
 * 명단·문항·출제를 두 벌씩 넣으므로, 실행 중 표시를 두고 두 번째 실행은 막는다.
 */
async function setupAll_() {
  var props = PropertiesService.getScriptProperties();
  var running = Number((await props.getProperty('SETUP_RUNNING')) || 0);
  if (running && Date.now() - running < 6 * 60 * 1000) throw userError_('초기 설정이 이미 실행 중이에요. 1~2분 뒤 결과 창을 확인해 주세요.');
  (await props.setProperty('SETUP_RUNNING', String(Date.now())));
  try { return (await setupAllOnce_()); } finally { (await props.deleteProperty('SETUP_RUNNING')); }
}

async function setupAllOnce_() {
  var ss = (await ss_());
  var props = PropertiesService.getScriptProperties();
  (await props.setProperty('SS_ID', ss.getId()));
  (await pepper_());
  (await __aForEach(Object.keys(COLS), async function (name) { (await ensureSheet_(name, COLS[name], name !== SH.MISCON)); }));
  var removed = (await removeDuplicateRows_());

  // 설정
  var cfg = (await sheet_(SH.CONFIG));
  var have = {};
  // 예전 표기(레+포+트)를 '리포트'로 바꾼다(설정 이름·설명). 일괄 치환에 휘말리지 않게 글자는 이스케이프로 적음.
  var OLD_RE = new RegExp('\uB808\uD3EC\uD2B8', 'g');
  var cfgRows = (await cfg.getLastRow()) >= 2 ? (await cfg.getRange(2, 1, (await cfg.getLastRow()) - 1, 3).getValues()) : [];
  for (var ci = 0; ci < cfgRows.length; ci++) {
    var cr = cfgRows[ci], key = String(cr[0]).trim(), note = String(cr[2]);
    if (key.replace(OLD_RE, '리포트') !== key || note.replace(OLD_RE, '리포트') !== note) {
      key = key.replace(OLD_RE, '리포트');
      (await cfg.getRange(ci + 2, 1, 1, 3).setValues([[key, cr[1], note.replace(OLD_RE, '리포트')]]));
    }
    have[key] = 1;
  }
  (await __aForEach(DEFAULT_SETTINGS, async function (r) { if (!have[r[0]]) (await cfg.appendRow([r[0], cell_(r[1]), r[2]])); }));
  forget_('settings');

  // 교사 (초기 비밀번호 1234)
  var teachers = (await rows_(SH.TEACHER));
  if (!teachers.length) {
    (await __aForEach([['T01', '홍길동', 'hong', '1,2,3'], ['T02', '김길동', 'kim', '4,5']], async function (t) {
      var salt = newSalt_();
      (await appendObj_(SH.TEACHER, {
        '교사ID': t[0], '이름': t[1], '로그인ID': t[2], '담당반': t[3], '비밀번호해시': (await hashPw_('1234', salt)), '솔트': salt,
        'AI제공자': 'openai', '모델': PROVIDERS.openai.defaultModel, 'API키상태': '미설정', '가상여부': 'Y', '생성일시': now_(), '수정일시': now_()
      }));
    }));
  } else {
    (await __aForEach(teachers, async function (t) {
      if (!str_(t['비밀번호해시'])) { var salt = newSalt_(); (await updateObj_(SH.TEACHER, t._row, { '비밀번호해시': (await hashPw_('1234', salt)), '솔트': salt })); }
    }));
  }
  forget_('teachers');

  // 학생 명단 (1~5반 × 30명, 가상 이름, 아직 가입 전)
  var students = (await rows_(SH.STUDENT));
  if (!students.length) {
    var list = [], i = 0;
    (await __aForEach((await classList_()), async function (cls) {
      var t = (await teacherForClass_(cls));
      for (var n = 1; n <= 30; n++) {
        list.push({ '학생ID': (await studentIdFor_(cls, n)), '반': cls, '번호': n, '이름': virtualName_(i++), '담당교사ID': t ? str_(t['교사ID']) : '', '가입여부': 'N', '가상여부': 'Y' });
      }
    }));
    (await appendObjs_(SH.STUDENT, list));
    students = (await rows_(SH.STUDENT));
  }
  (await ensureStudentScoreRows_(students.map(function (s) { return { id: str_(s['학생ID']), cls: str_(s['반']), num: str_(s['번호']), name: str_(s['이름']) }; })));

  (await imageFolder_());

  // 기준 자료(없으면 Drive CSV에서 가져옴) → 문제 이미지 연결(문항정보가 있어야 개념을 붙일 수 있음)
  var refMsgs = (await importReferenceData_());
  var link = (await linkProblemImages_());
  if (link.found) {
    // 예전 손글씨 샘플 출제는 같은 문항코드의 이미지 문항으로 바꾼다.
    var imgIds = {};
    (await allItems_()).forEach(function (it) { if (it.imageId) imgIds[it.id] = true; });
    (await __aForEach((await rows_(SH.ASSIGN)), async function (a) {
      var m = str_(a['문항ID']).match(/^Q-SAMPLE-(\d+)$/);
      var s = m ? SAMPLE_ITEMS[parseInt(m[1], 10) - 1] : null;
      if (s && imgIds['IMG-' + s.code]) (await updateObj_(SH.ASSIGN, a._row, { '문항ID': 'IMG-' + s.code }));
    }));
    if (!(await rows_(SH.ASSIGN)).length) {
      var irows = [];
      (await rows_(SH.TEACHER)).forEach(function (t) {
        SAMPLE_ITEMS.filter(function (s) { return imgIds['IMG-' + s.code]; }).forEach(function (s, k) {
          irows.push({ '과제ID': newId_('A') + k, '교사ID': str_(t['교사ID']), '대상반': splitList_(t['담당반']).join(','), '문항ID': 'IMG-' + s.code, '순서': k + 1, '공개': 'Y', '출제일시': now_() });
        });
      });
      (await appendObjs_(SH.ASSIGN, irows));
    }
  }

  // 문제 이미지 폴더가 없을 때만: 손으로 만든 샘플 문항과 출제(시연용)
  if (!(await rows_(SH.ITEM)).length) {
    (await appendObjs_(SH.ITEM, SAMPLE_ITEMS.map(function (s, k) {
      return {
        '문항ID': 'Q-SAMPLE-' + ('0' + (k + 1)).slice(-2), '문항코드': s.code, '개념id': s.cid, '개념명': s.name, '학년': '중3', '난이도': s.diff,
        '문제': s.text, '정답': s.answer, '풀이단계': JSON.stringify(s.steps), '그림스펙': s.figure ? JSON.stringify(s.figure) : '',
        '문항유형': s.type, '시각화유형': s.visual, '생성방식': '샘플', '참고문항ID': '', '생성일시': now_()
      };
    })));
    forget_('allItems');
    if (!(await rows_(SH.ASSIGN)).length) {
      var arows = [];
      (await rows_(SH.TEACHER)).forEach(function (t) {
        SAMPLE_ITEMS.forEach(function (s, k) {
          arows.push({ '과제ID': newId_('A') + k, '교사ID': str_(t['교사ID']), '대상반': splitList_(t['담당반']).join(','), '문항ID': 'Q-SAMPLE-' + ('0' + (k + 1)).slice(-2), '순서': k + 1, '공개': 'Y', '출제일시': now_() });
        });
      });
      (await appendObjs_(SH.ASSIGN, arows));
    }
  }

  // 자료 시트 점검 (없으면 Drive의 CSV에서 자동으로 가져온다)
  var msgs = ['시트, 교사 2명(초기 비밀번호 1234), 학생 명단 ' + students.length + '명을 준비했어요.'];
  if (removed) msgs.push('중복으로 들어간 행 ' + removed + '개를 정리했어요.');
  refMsgs.forEach(function (m) { msgs.push(m); });
  msgs.push(link.found
    ? '문제 이미지: ' + link.linked + '개 연결(새로 추가 ' + link.created + '개). 정답은 처음 쓸 때 AI가 풀어 저장해요. [문제 정답 미리 만들기] 메뉴로 미리 만들 수도 있어요.'
    : '문제 이미지 폴더(' + ((await setting_('문제이미지폴더')) || '중3_문제이미지') + ')를 찾지 못해 손으로 만든 샘플 문항을 썼어요.');
  var nConcept = Object.keys((await conceptMap_())).length;
  var pm = (await prereqMap_()).pre, nEdge = 0;
  Object.keys(pm).forEach(function (k) { nEdge += pm[k].length; });
  var infos = (await infoSheets_()).map(function (s) { return s.getName(); });
  msgs.push('개념목록: ' + (nConcept ? nConcept + '개' : '없음 ← 개념목록 시트를 넣어 주세요'));
  msgs.push('선수개념위계도: ' + (nEdge ? nEdge + '개 관계' : '없음 ← 선수개념위계도 시트를 넣어 주세요'));
  msgs.push('문항정보 시트: ' + (infos.length ? infos.join(', ') : '없음 ← 문항정보_중3 등 시트를 넣어 주세요'));
  msgs.push('다음 단계: 교사로 로그인 → 설정(⚙)에서 API 키 입력 → [배포 > 새 배포 > 웹 앱].');
  return msgs.join('\n');
}


/* ---------- 기준 자료(개념목록·선수개념위계도·문항정보) 자동 가져오기 ---------- */
var REFERENCE_CSV = [
  { file: '오개념진단_개념목록.csv', sheet: SH.CONCEPT, keys: ['cid', 'cname', 'grade'] },
  { file: '오개념진단_선후관계.csv', sheet: SH.GRAPH, keys: ['pre', 'post'] },
  { file: '오개념진단_문항정보.csv', sheet: '문항정보', keys: ['code', 'cid', 'diff'] }
];

/** 앱이 만든 시트(문항리스트 등)를 빼고, 머리글이 맞는 자료 시트가 있는지 본다. */
async function hasReferenceSheet_(keys) {
  return (await __aSome((await (await ss_()).getSheets()), async function (sh) {
    if (COLS[sh.getName()]) return false;
    var I = headerIndex_((await sheetHeaders_(sh)), keys);
    return keys.every(function (k) { return I[k] >= 0; });
  }));
}

/** 자료 시트가 없을 때만 Drive에서 같은 이름의 CSV를 찾아 시트로 만든다. */
async function importReferenceData_() {
  var msgs = [];
  (await __aForEach(REFERENCE_CSV, async function (ref) {
    if ((await hasReferenceSheet_(ref.keys))) return;
    var it = (await DriveApp.getFilesByName(ref.file));
    if (!it.hasNext()) { msgs.push(ref.sheet + ': Drive에서 ' + ref.file + ' 파일을 찾지 못했어요.'); return; }
    var rows = Utilities.parseCsv((await (await it.next().getBlob()).getDataAsString('UTF-8')));
    if (rows.length && rows[0][0]) rows[0][0] = String(rows[0][0]).replace(/^﻿/, '');
    var width = rows[0].length;
    rows = rows.filter(function (r) { return r.length === width; }).map(function (r) {
      return r.map(function (v) {
        if (/^-?\d+(\.\d+)?$/.test(v)) return v;
        return /^[=+\-@]/.test(v) ? "'" + v : v;
      });
    });
    var ss = (await ss_());
    var sh = (await ss.getSheetByName(ref.sheet)) || (await ss.insertSheet(ref.sheet));
    (await sh.clear());
    if ((await sh.getMaxRows()) < rows.length) (await sh.insertRowsAfter((await sh.getMaxRows()), rows.length - (await sh.getMaxRows())));
    if ((await sh.getMaxColumns()) < width) (await sh.insertColumnsAfter((await sh.getMaxColumns()), width - (await sh.getMaxColumns())));
    for (var i = 0; i < rows.length; i += 3000) {
      var part = rows.slice(i, i + 3000);
      (await sh.getRange(i + 1, 1, part.length, width).setValues(part));
    }
    sh.setFrozenRows(1);
    msgs.push(ref.sheet + ': ' + ref.file + '에서 ' + (rows.length - 1) + '행을 가져왔어요.');
  }));
  ['concepts', 'prereq', 'infoSheets', 'itemInfo'].forEach(forget_);
  return msgs;
}


/* ---------- 중복 행 정리 (초기 설정을 겹쳐 실행했을 때) ---------- */
var DEDUPE_KEYS = [
  [SH.TEACHER, ['교사ID']],
  [SH.STUDENT, ['학생ID']],
  [SH.ITEM, ['문항ID']],
  [SH.ASSIGN, ['교사ID', '대상반', '문항ID']],
  [SH.STAGESUM, ['학생ID']],
  [SH.CONFIG, ['항목']]
];

/** 같은 키를 가진 행은 처음 것만 남긴다. 지운 행 수를 돌려준다. */
async function removeDuplicateRows_() {
  var total = 0;
  (await __aForEach(DEDUPE_KEYS, async function (d) {
    var sh = (await sheet_(d[0], true));
    if (!sh || (await sh.getLastRow()) < 3) return;
    var lc = (await sh.getLastColumn());
    var values = (await sh.getRange(1, 1, (await sh.getLastRow()), lc).getValues());
    var hdr = values[0].map(function (h) { return String(h).trim(); });
    var idx = d[1].map(function (k) { return hdr.indexOf(k); });
    if (idx.some(function (i) { return i < 0; })) return;
    var seen = {}, keep = [];
    for (var r = 1; r < values.length; r++) {
      var key = idx.map(function (i) { return String(values[r][i]).trim(); }).join('|');
      if (!key.replace(/\|/g, '')) { keep.push(values[r]); continue; }
      if (seen[key]) continue;
      seen[key] = 1;
      keep.push(values[r]);
    }
    var dropped = values.length - 1 - keep.length;
    if (!dropped) return;
    (await sh.getRange(2, 1, values.length - 1, lc).clearContent());
    if (keep.length) (await sh.getRange(2, 1, keep.length, lc).setValues(keep));
    total += dropped;
  }));
  ['allItems', 'settings'].forEach(forget_);
  return total;
}

;
/* ===================== 시연용 가상 학습 로그 ===================== */

function rng_(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var DEMO_CATEGORIES = {
  '읽기': ['부호를 잘못 옮겨 씀', '수를 잘못 옮겨 씀', '조건을 빠뜨리고 읽음'],
  '이해': ['구하는 것을 오해함', '조건의 의미를 모름', '그림·그래프 해석 어려움'],
  '변형': ['인수분해 방법 선택 오류', '곱셈 공식 적용 오류', '근의 공식 대입 오류', '원주각·중심각 관계 혼동', '꼭짓점 좌표 부호 혼동', '삼각형 넓이 공식 오적용', '제곱근 성질 오해', '평균 식 세우기 오류'],
  '처리기술': ['부호 계산 실수', '분수 계산 실수', '곱셈 계산 실수', '이항 실수', '근호 계산 실수'],
  '인코딩': ['답의 형태 미완성', '근을 하나만 씀', '단위·기호 누락', '좌표 형태로 쓰지 않음']
};

function pickW_(r, pairs) {
  var x = r(), acc = 0;
  for (var i = 0; i < pairs.length; i++) { acc += pairs[i][1]; if (x < acc) return pairs[i][0]; }
  return pairs[pairs.length - 1][0];
}

async function createDemoData_() {
  var r = rng_(20261030);
  // 지금 출제된 문항(문제 이미지 문항 포함)으로 가상 기록을 만든다. 출제가 없으면 샘플 문항.
  var assignedIds = {};
  (await rows_(SH.ASSIGN)).forEach(function (a) { assignedIds[str_(a['문항ID'])] = true; });
  var items = (await allItems_()).filter(function (it) { return assignedIds[it.id]; });
  if (!items.length) items = (await allItems_()).filter(function (it) { return it.source === '샘플'; });
  if (!items.length) throw new Error('출제된 문항이 없어요. 먼저 [① 초기 설정]을 실행해 주세요.');
  var students = (await rows_(SH.STUDENT)).filter(function (s) { return str_(s['가상여부']) === 'Y'; });
  if (!students.length) throw new Error('가상 학생이 없어요.');

  // 시연용 계정: 각 반 1~3번 (비밀번호 1234)
  (await __aForEach(students, async function (s) {
    if (num_(s['번호'], 0) <= 3 && str_(s['가입여부']) !== 'Y') {
      var salt = newSalt_();
      (await updateObj_(SH.STUDENT, s._row, { '비밀번호해시': (await hashPw_('1234', salt)), '솔트': salt, '가입여부': 'Y', '가입일시': now_() }));
    }
  }));

  var basic = (await basicCalcCandidates_('중3'));
  var conceptPool = {};
  (await __aForEach(items, async function (it) {
    conceptPool[it.id] = [{ id: it.conceptId, name: it.conceptName }].concat((await prereqCandidates_(it.conceptId, { depth: 2, min: 3, limit: 6 })));
  }));
  var teacherOf = {};
  (await rows_(SH.TEACHER)).forEach(function (t) { splitList_(t['담당반']).forEach(function (c) { teacherOf[c] = str_(t['교사ID']); }); });

  var subs = [], errs = [], helps = [];
  var nowMs = new Date().getTime();
  (await __aForEach(students, async function (s, si) {
    var sid = str_(s['학생ID']), cls = str_(s['반']);
    var n = 4 + Math.floor(r() * 7);
    for (var k = 0; k < n; k++) {
      var it = items[Math.floor(r() * items.length)];
      var when = Utilities.formatDate(new Date(nowMs - Math.floor(r() * 21 * 86400000)), TZ, 'yyyy-MM-dd HH:mm:ss');
      var subId = 'SUB-DEMO-' + si + '-' + k;
      var res = pickW_(r, [['O', 0.55], ['X', 0.40], ['보류', 0.05]]);
      var primary = '';
      if (res === 'X') {
        primary = pickW_(r, [['읽기', 0.08], ['이해', 0.15], ['변형', 0.40], ['처리기술', 0.27], ['인코딩', 0.10]]);
        var stages = [primary];
        if (r() < 0.3) stages.push(r() < 0.6 ? '처리기술' : '인코딩');
        (await __aForEach(stages, async function (stg, ei) {
          var c = { id: '', name: '' };
          if (stg === '변형' || stg === '이해') { var pool = conceptPool[it.id]; c = pool[Math.floor(r() * pool.length)]; }
          if (stg === '처리기술') {
            // 가상 기록도 실제 규칙과 같게: 그 문항의 핵심 개념 묶음은 계산 실수 개념으로 쓰지 않는다
            var core = {}; (await coreConcepts_(it)).forEach(function (x) { core[x.id] = true; });
            var outside = basic.filter(function (b) { return !core[String(b.id)]; });
            if (outside.length) c = outside[Math.floor(r() * outside.length)];
          }
          var cats = DEMO_CATEGORIES[stg];
          errs.push({
            '오류ID': 'E-DEMO-' + si + '-' + k + '-' + ei, '제출ID': subId, '학생ID': sid, '반': cls, '문항ID': it.id, '문항코드': it.code,
            '줄번호': 1 + Math.floor(r() * 4), 'Newman단계': stg, '주원인여부': ei === 0 && stg === primary ? 'Y' : 'N', '개념id': c.id, '개념명': c.name,
            '오류유형': cats[Math.floor(r() * cats.length)], '설명': '(가상 데이터)', '판단근거': '(가상 데이터)', '불확실성': '',
            '확신도': Math.round((0.6 + r() * 0.35) * 100) / 100, '출처': 'AI', '기록일시': when, '가상여부': 'Y'
          });
        }));
      }
      subs.push({
        '제출ID': subId, '학생ID': sid, '반': cls, '과제ID': '', '문항ID': it.id, '문항코드': it.code, '개념id': it.conceptId,
        '시도구분': '원문항', '시도차수': 1, '이해못함': primary === '이해' ? 'Y' : 'N', 'AI전사': '{"lines":[]}', '학생수정본': '[]',
        '자기교정': 'N', '학생최종답': '(가상)', '정오': res, '주원인': primary, '확신도': res === 'X' ? 0.8 : '',
        '판단근거': '(가상 데이터)', '상태': res === '보류' ? '판단보류' : '분석완료', '제출일시': when, '분석일시': when, '가상여부': 'Y'
      });
      if (res === '보류') {
        helps.push({
          '요청ID': 'H-DEMO-' + si + '-' + k, '제출ID': subId, '학생ID': sid, '반': cls, '문항ID': it.id, '교사ID': teacherOf[cls] || '',
          '사유': '[가상] 판단 근거 부족: 풀이 없이 답만 적음', '상태': helps.length % 3 === 0 ? '대기' : '답변완료',
          '교사답변': helps.length % 3 === 0 ? '' : '(가상) 풀이 과정을 한 줄씩 써 보면 어디서 틀렸는지 찾기 쉬워요.', '학생확인': 'N', '요청일시': when, '답변일시': ''
        });
      }
    }
  }));
  (await appendObjs_(SH.SUBMIT, subs));
  (await appendObjs_(SH.ERROR, errs));
  (await appendObjs_(SH.HELP, helps));
  (await rebuildScores_());
  return '가상 학생 ' + students.length + '명의 풀이 ' + subs.length + '건, 오류 ' + errs.length + '건, 교사확인요청 ' + helps.length + '건을 만들었어요.\n각 반 1~3번 학생은 비밀번호 1234로 로그인할 수 있어요.';
}

async function keepRows_(name, keep) {
  var sh = (await sheet_(name));
  if ((await sh.getLastRow()) < 2) return 0;
  var lc = (await sh.getLastColumn());
  var hdr = (await headers_(name));
  var data = (await sh.getRange(2, 1, (await sh.getLastRow()) - 1, lc).getValues());
  var kept = data.filter(function (row) {
    var o = {};
    hdr.forEach(function (h, c) { o[h] = plain_(row[c]); });
    return keep(o);
  });
  (await sh.getRange(2, 1, data.length, lc).clearContent());
  if (kept.length) (await sh.getRange(2, 1, kept.length, lc).setValues(kept));
  return data.length - kept.length;
}

async function clearDemoData_() {
  var a = (await keepRows_(SH.SUBMIT, function (o) { return str_(o['가상여부']) !== 'Y'; }));
  var b = (await keepRows_(SH.ERROR, function (o) { return str_(o['가상여부']) !== 'Y'; }));
  var c = (await keepRows_(SH.HELP, function (o) { return String(o['사유']).indexOf('[가상]') !== 0; }));
  var d = 0;
  (await __aForEach((await rows_(SH.STUDENT)), async function (s) {
    if (str_(s['가상여부']) === 'Y' && str_(s['가입여부']) === 'Y') { (await updateObj_(SH.STUDENT, s._row, { '가입여부': 'N', '비밀번호해시': '', '솔트': '' })); d++; }
  }));
  (await rebuildScores_());
  return '가상 풀이 ' + a + '건, 오류 ' + b + '건, 교사확인요청 ' + c + '건을 지우고, 시연용 계정 ' + d + '개의 가입을 풀었어요.\n점수도 다시 계산했어요. 이제 실제 학생이 같은 학번으로 가입하면 입력한 이름으로 저장돼요.';
}

;
/* ===================== 학습 리포트(학생·교사) ===================== */
/*
 * 학생이 출제된 과제를 모두 마치면(완료·선생님 확인 중·재시도 한도 도달) 학생과 교사 모두 [리포트 받아보기]를 쓸 수 있다.
 * 먼저 누른 쪽이 만든 리포트를 학습리포트 시트에 저장해 두고 둘이 함께 본다. 학습 결손 정도는 교사에게만 보낸다.
 * 과제(또는 문항)마다 처음 풀이(시도구분=원문항)의 정오만 본다. 처음에 틀리고 나중에 맞혀도 틀린 문제다.
 * 총점 = Σ(변별도 × 정오) / Σ(변별도) × 100 — 판단 보류(교사 확인 전) 문항은 빼고 계산한다.
 * 문항정보에 변별도가 없는 문항(AI가 만든 문항 등)은 리포트 전체(그래프·목록·평가·총점)에서 뺀다.
 */

var STAGE_EXPLAIN = {
  '읽기': '문제를 읽는 과정에서 조건이나 묻는 것을 놓쳤어요.',
  '이해': '문제 상황(주어진 것과 구하는 것)을 이해하는 데 어려움이 있었어요.',
  '변형': '알맞은 개념이나 풀이 방법을 고르는 과정에서 헷갈렸어요.',
  '처리기술': '풀이 방법은 맞았지만 계산 과정에서 실수가 있었어요.',
  '인코딩': '답을 구했지만 마지막에 답을 나타내는 과정에서 실수가 있었어요.'
};

/** 문항코드의 변별도(문항정보). 없으면 0 → 리포트에서 뺀다. */
async function reportDisc_(code) {
  var info = (await itemInfoIndex_()).codes[String(code || '')];
  var a = info ? num_(info.disc, 0) : 0;
  return a > 0 ? a : 0;
}

function reportNote_(v) {
  var s = str_(v).trim();
  return /가상 데이터/.test(s) ? '' : s;
}

async function reportStudent_(stRow) {
  return {
    id: str_(stRow['학생ID']), name: str_(stRow['이름']), num: String(parseInt(stRow['번호'], 10)),
    cls: str_(stRow['반']), classLabel: (await classLabel_(str_(stRow['반'])))
  };
}

/** 여러 학생의 리포트를 한 번에 만들 때 시트를 한 번만 읽도록 미리 모아 둔다. */
async function reportPreload_() {
  var itemMap = {};
  (await allItems_()).forEach(function (it) { itemMap[it.id] = it; });
  return { subs: (await rows_(SH.SUBMIT)), errs: (await rows_(SH.ERROR)), itemMap: itemMap };
}

/** 한 학생의 리포트 자료(원 그래프·문항 목록·총점) */
async function reportData_(stRow, pre) {
  pre = pre || (await reportPreload_());
  var student = (await reportStudent_(stRow));
  var sid = student.id;
  var subs = pre.subs.filter(function (s) {
    return str_(s['학생ID']) === sid && str_(s['시도구분']) === '원문항' && ['O', 'X', '보류'].indexOf(str_(s['정오'])) >= 0;
  });
  subs.sort(function (a, b) { return str_(a['제출일시']).localeCompare(str_(b['제출일시'])) || a._row - b._row; });
  var first = {}, keys = [];
  subs.forEach(function (s) {
    var key = str_(s['과제ID']) || ('Q:' + str_(s['문항ID']));
    if (!first[key]) { first[key] = s; keys.push(key); }
  });
  var errsBySub = {};
  pre.errs.forEach(function (e) {
    if (str_(e['학생ID']) !== sid) return;
    var k = str_(e['제출ID']);
    (errsBySub[k] = errsBySub[k] || []).push(e);
  });
  var itemMap = pre.itemMap;

  var excluded = 0;
  var items = (await __aMap(keys, async function (key) {
    var s = first[key];
    var item = itemMap[str_(s['문항ID'])] || null;
    var code = str_(s['문항코드']) || (item ? item.code : '');
    var disc = (await reportDisc_(code));
    if (!disc) { excluded++; return null; }
    var out = {
      key: key, submissionId: str_(s['제출ID']), itemId: str_(s['문항ID']), code: code,
      conceptName: item ? item.conceptName : '(문항 없음)',
      preview: item ? (item.text ? previewText_(item.text, 120) : (item.imageId ? '(그림으로 된 문제)' : '')) : '',
      hasImage: !!(item && item.imageId), result: str_(s['정오']), at: str_(s['제출일시']).slice(0, 16),
      disc: Math.round(disc * 1000) / 1000, stage: '', stageExplain: '', misconceptions: [], reason: ''
    };
    if (out.result !== 'X') return out;

    var ana = parseJson_(s['AI분석'], {}) || {};
    var oc = ana.outcome || {};
    var stage = str_(s['주원인']) || str_(oc.primary);
    var errs = errsBySub[out.submissionId] || [];
    if (!stage) {
      var pe = errs.filter(function (e) { return str_(e['주원인여부']) === 'Y'; })[0];
      if (pe) stage = str_(pe['Newman단계']);
    }
    out.stage = stage;
    out.stageExplain = STAGE_EXPLAIN[stage] || '';
    out.reason = reportNote_(s['판단근거']);

    // 오개념: AI가 추론한 학생의 생각 → 기록된 오개념 개념 → 이해·변형 단계 오류 기록(가상 데이터·교사 판정 포함)
    var seen = {};
    async function addMis(cid, name, text) {
      cid = str_(cid).trim();
      var c = cid ? (await conceptInfo_(cid)) : null;
      name = str_(name).trim() || (c ? c.name : '');
      if (!name) return;
      text = str_(text).trim().replace(/^학생은\s*/, '');
      var k = cid || name;
      if (seen[k]) { if (text && !seen[k].text) seen[k].text = text; return; }
      seen[k] = { concept: name, text: text };
      out.misconceptions.push(seen[k]);
    }
    if (stage === '변형' || stage === '이해') {
      var rawMis = (ana.raw && Array.isArray(ana.raw.misconceptions)) ? ana.raw.misconceptions : [];
      (await __aForEach(rawMis, async function (m) { if (m) (await addMis(m.concept_id, m.concept_name, m.student_belief)); }));
      (await __aForEach(splitList_(s['오개념개념id']), async function (id) { (await addMis(id, '', '')); }));
    }
    (await __aForEach(errs, async function (e) {
      var st = str_(e['Newman단계']);
      if (st !== '변형' && st !== '이해') return;
      (await addMis(e['개념id'], e['개념명'], reportNote_(e['설명']) || str_(e['오류유형'])));
    }));
    out.misconceptions = out.misconceptions.slice(0, 3);
    return out;
  })).filter(Boolean);

  var earned = 0, max = 0, stages = {};
  items.forEach(function (it) {
    if (it.result === '보류') return;
    max += it.disc;
    if (it.result === 'O') earned += it.disc;
    else if (it.stage) stages[it.stage] = (stages[it.stage] || 0) + 1;
  });
  return {
    student: student, items: items,
    correct: items.filter(function (it) { return it.result === 'O'; }).length,
    wrong: items.filter(function (it) { return it.result === 'X'; }).length,
    pending: items.filter(function (it) { return it.result === '보류'; }).length,
    excluded: excluded,
    stages: stages,
    score: { earned: Math.round(earned * 100) / 100, max: Math.round(max * 100) / 100, percent: max ? Math.round(earned * 1000 / max) / 10 : 0 }
  };
}

/** 풀이 기록이 바뀌었는지 알아보는 값: 같으면 저장해 둔 리포트를 다시 쓴다. */
function reportSignature_(rep) {
  var basis = rep.items.map(function (it) {
    return it.key + ':' + it.result + ':' + it.stage + ':' + it.disc + ':' + it.misconceptions.map(function (m) { return m.concept; }).join('/');
  }).join('|');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, basis));
}

/** 푼 문제 목록 값: AI 평가는 이 값이 바뀔 때(새로 푼 문제가 생길 때)만 다시 쓴다. */
function reportEvalSignature_(rep) {
  var keys = rep.items.map(function (it) { return it.key; }).sort().join('|');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, keys));
}

/* ---------- 오개념 지도(노드 그래프) ---------- */
/*
 * 오개념도표에서 판단이 '오개념'인 행(예전 행은 판단이 비어 있음)을 학생별로 모아 개념마다 몇 번 확인됐는지 센다.
 * 노드끼리는 선수개념위계도를 따라 잇는다: 한 오개념에서 선수개념 쪽으로 MISGRAPH_DEPTH 단계까지 올라가며
 * 다른 오개념을 만나면 그 경로를 간선으로 넣는다. 경로 중간의 개념(오개념으로 확인되지는 않음)은 '연결 개념'으로 넣는다.
 * 리포트 저장본과 따로, 볼 때마다 새로 계산한다(유도질문에서 확인된 오개념도 바로 반영되게).
 */
var MISGRAPH_MAX_NODES = 16;
var MISGRAPH_MAX_BRIDGES = 12;
var MISGRAPH_DEPTH = 3;

async function misconceptionGraph_(studentId) {
  var sid = String(studentId);
  var count = {}, order = [];
  (await rows_(SH.MISCON)).forEach(function (r, i) {
    if (str_(r['학생id']) !== sid || miscVerdict_(r) !== '오개념') return; // 이해함 행은 세지 않는다
    var cid = str_(r['오개념 개념 코드']).trim();
    if (!cid) return;
    if (!count[cid]) { count[cid] = 0; order.push(cid); }
    count[cid]++;
  });
  var detail = {};
  (await rows_(SH.ERROR)).forEach(function (e) {
    if (str_(e['학생ID']) !== sid) return;
    var cid = str_(e['개념id']).trim();
    if (!count[cid]) return;
    var d = detail[cid] = detail[cid] || { stages: {}, tutor: 0, last: '' };
    var st = str_(e['Newman단계']);
    if (st) d.stages[st] = (d.stages[st] || 0) + 1;
    if (str_(e['출처']) === '유도질문') d.tutor++;
    var at = str_(e['기록일시']);
    if (at > d.last) d.last = at;
  });
  var total = order.length;
  // 많이 확인된 순(같으면 최근 순)으로 상위 개념만 그린다.
  var ids = order.slice().sort(function (a, b) {
    return count[b] - count[a] || String((detail[b] || {}).last || '').localeCompare(String((detail[a] || {}).last || ''));
  }).slice(0, MISGRAPH_MAX_NODES);
  var isMis = {};
  ids.forEach(function (id) { isMis[id] = true; });

  // 선수개념 쪽으로 올라가며 다른 오개념까지의 최단 경로 찾기
  var pm = (await prereqMap_()).pre;
  var edgeSet = {}, edges = [], bridges = {}, bridgeOrder = [];
  function addEdge(a, b, direct) {
    var k = a + '>' + b;
    if (edgeSet[k] || a === b) return;
    edgeSet[k] = true;
    edges.push({ from: a, to: b, direct: !!direct });
  }
  var paths = [];
  ids.forEach(function (m) {
    var parent = {}, seen = {}, frontier = [m];
    seen[m] = true;
    for (var d = 1; d <= MISGRAPH_DEPTH && frontier.length; d++) {
      var next = [];
      frontier.forEach(function (x) {
        (pm[x] || []).forEach(function (p) {
          p = String(p);
          if (seen[p]) return;
          seen[p] = true;
          parent[p] = x;
          if (isMis[p]) {
            var path = [p], cur = p;
            while (cur !== m) { cur = parent[cur]; path.push(cur); }
            paths.push(path); // 선수(오개념) → … → 후속(오개념 m)
            return; // 더 위는 p에서 찾는다
          }
          next.push(p);
        });
      });
      frontier = next;
    }
  });
  paths.sort(function (a, b) { return a.length - b.length; });
  paths.forEach(function (path) {
    var mids = path.slice(1, -1);
    var newMids = mids.filter(function (x) { return !bridges[x]; });
    if (newMids.length && bridgeOrder.length + newMids.length > MISGRAPH_MAX_BRIDGES) return;
    newMids.forEach(function (x) { bridges[x] = true; bridgeOrder.push(x); });
    for (var i = 0; i + 1 < path.length; i++) addEdge(path[i], path[i + 1], path.length === 2);
  });

  async function nodeOf(id, bridge) {
    var c = (await conceptInfo_(id)) || { name: '개념 ' + id, grade: '' };
    var n = { id: id, name: str_(c.name) || ('개념 ' + id), grade: str_(c.grade), gradeRank: gradeRank_(c.grade), bridge: !!bridge };
    if (!bridge) {
      var d = detail[id] || { stages: {}, tutor: 0, last: '' };
      n.count = count[id];
      n.stages = d.stages;
      n.tutor = d.tutor;
      n.last = String(d.last || '').slice(0, 16);
    }
    return n;
  }
  var nodes = (await __aMap(ids, async function (id) { return (await nodeOf(id, false)); })).concat((await __aMap(bridgeOrder, async function (id) { return (await nodeOf(id, true)); })));
  var maxCount = ids.reduce(function (m, id) { return Math.max(m, count[id]); }, 0);
  return { nodes: nodes, edges: edges, total: total, shown: ids.length, maxCount: maxCount, depth: MISGRAPH_DEPTH };
}

/* ---------- 리포트 받아보기 조건 ---------- */

/** 출제된 과제를 모두 마쳤는지: 완료, 선생님 확인 중, 재시도 한도에 닿아 다음으로 넘어갈 수 있는 과제를 마친 것으로 본다. */
async function reportProgress_(st, progRows) {
  var assigns = (await studentAssignments_(st));
  var prog = {};
  (progRows || (await rows_(SH.PROGRESS))).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = p; });
  var done = (await __aFilter(assigns, async function (a) { var p = prog[str_(a['과제ID'])]; return !!p && (await canNext_(p)); })).length;
  return { total: assigns.length, done: done, ready: assigns.length > 0 && done === assigns.length };
}

/* ---------- 학습 결손(최소 성취수준 보장지도, 교사 전용) ---------- */

var DEFICIT_LABELS = ['학습 결손 주의', '학습 결손 심함', '학습 결손 매우 심함'];

/** 리포트 총점이 기준 미만이면 학습 결손 의심. rank: 0 해당 없음, 1 주의, 2 심함, 3 매우 심함, -1 판단 보류 */
async function deficitLevel_(rep) {
  var judged = rep.correct + rep.wrong;
  var minItems = (await settingNum_('학습결손최소문항', 3));
  if (judged < minItems) {
    return { rank: -1, label: '판단 보류', reason: '채점된 문제가 ' + judged + '개라 판단하지 않았어요(최소 ' + minItems + '개).' };
  }
  var cuts = splitList_((await setting_('학습결손기준')) || '40,30,20').map(Number).filter(function (n) { return !isNaN(n); });
  if (cuts.length < 3) cuts = [40, 30, 20];
  cuts.sort(function (a, b) { return b - a; });
  var s = rep.score.percent, rank = 0;
  for (var i = 0; i < 3; i++) if (s < cuts[i]) rank = i + 1;
  return {
    rank: rank, label: rank ? DEFICIT_LABELS[rank - 1] : '해당 없음', cuts: cuts.slice(0, 3), score: s,
    reason: rank ? '총점 ' + s + '점 — 최소 성취수준(' + cuts[0] + '점) 미만' + (rank > 1 ? ', ' + cuts[rank - 1] + '점 미만' : '') : '총점 ' + s + '점 — 최소 성취수준(' + cuts[0] + '점) 이상'
  };
}

/* ---------- 리포트 저장·불러오기 ---------- */

async function reportSheetReady_() {
  if ((await sheet_(SH.REPORT, true)) && (await headers_(SH.REPORT)).indexOf('평가기준') >= 0) return;
  (await withLock_(async function () { (await ensureSheet_(SH.REPORT, COLS[SH.REPORT], true)); }));
}

/** 시트 한 칸에 들어가도록 줄인다(문항이 많으면 분석 글부터 뺀다). */
function compactReport_(rep) {
  var copy = JSON.parse(JSON.stringify(rep));
  copy.items.forEach(function (it) { it.reason = String(it.reason || '').slice(0, 300); });
  if (JSON.stringify(copy).length > 45000) copy.items.forEach(function (it) { it.reason = ''; });
  if (JSON.stringify(copy).length > 45000) copy.items.forEach(function (it) { it.preview = ''; it.misconceptions.forEach(function (m) { m.text = String(m.text || '').slice(0, 60); }); });
  return copy;
}

/**
 * 리포트를 만들거나 저장해 둔 것을 쓴다.
 * 학생은 과제를 모두 마쳐야 하고, 선생님(forTeacher)은 과제를 다 마치지 않은 학생도 지금까지 푼 문제로 만들 수 있다.
 */
async function ensureReport_(stRow, forTeacher) {
  var st = (await studentSessionInfo_(stRow));
  var pg = (await reportProgress_(st));
  if (!pg.ready && !forTeacher) {
    throw userError_(pg.total ? '과제를 모두 마치면 리포트를 받아볼 수 있어요. (' + pg.done + '/' + pg.total + ' 완료)' : '아직 출제된 과제가 없어요.', 'NOTREADY');
  }
  var rep = (await reportData_(stRow));
  var sig = reportSignature_(rep);
  (await reportSheetReady_());
  var row = (await getObj_(SH.REPORT, st.id));
  if (row && str_(row['기준']) === sig && parseJson_(row['리포트'], null)) return { rep: parseJson_(row['리포트'], null), row: row, teacherId: st.teacherId, progress: pg };
  // 채점 결과만 바뀌었으면(예: 선생님 판정) 써 둔 평가를 그대로 두고, 새로 푼 문제가 있으면 비워서 다시 쓰게 한다.
  var keepEval = row && str_(row['평가기준']) === reportEvalSignature_(rep);
  var patch = {
    '기준': sig, '평가': keepEval ? str_(row['평가']) : '', '평가기준': keepEval ? str_(row['평가기준']) : '', '생성일시': now_(),
    '리포트': JSON.stringify(compactReport_(rep)), '학습결손': JSON.stringify((await deficitLevel_(rep)))
  };
  if (row) (await updateObj_(SH.REPORT, row._row, patch));
  else (await appendObj_(SH.REPORT, Object.assign({ '학생ID': st.id }, patch)));
  row = (await getObj_(SH.REPORT, st.id));
  return { rep: parseJson_(row['리포트'], null), row: row, teacherId: st.teacherId, progress: pg };
}

/** 화면에 보낼 리포트. 학습 결손은 교사에게만 넣는다. */
async function reportOut_(got, forTeacher) {
  var out = got.rep;
  out.summary = { lines: parseJson_(got.row['평가'], []) || [], at: str_(got.row['생성일시']) };
  out.createdAt = str_(got.row['생성일시']);
  out.progress = got.progress ? { done: got.progress.done, total: got.progress.total, ready: got.progress.ready } : null;
  out.misGraph = (await misconceptionGraph_(out.student.id));
  if (forTeacher) out.deficit = parseJson_(got.row['학습결손'], null);
  return out;
}

/** AI가 쓴 평가 3줄. 한 번 쓰면 저장해 두고, 새로 푼 문제가 생기기 전까지 그대로 쓴다. */
async function reportSummary_(stRow, teacherId, forTeacher) {
  var got = (await ensureReport_(stRow, forTeacher));
  var rep = got.rep;
  if (!rep.correct && !rep.wrong) return { lines: [], empty: true };
  var saved = parseJson_(got.row['평가'], []) || [];
  if (saved.length) return { lines: saved, at: str_(got.row['생성일시']) };
  var cfg = (await teacherAiConfig_(teacherId || got.teacherId));
  var out = (await llmJson_(cfg, { system: promptReportSystem_(), user: (await promptReportUser_(rep)), maxTokens: 1500, temperature: 0.4 }));
  var lines = (Array.isArray(out.lines) ? out.lines : []).map(function (l) { return String(l).trim(); }).filter(String).slice(0, 3);
  if (!lines.length) throw userError_('AI가 평가를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  (await updateObj_(SH.REPORT, rep.student.id, { '평가': JSON.stringify(lines), '평가기준': reportEvalSignature_(rep) }));
  return { lines: lines, at: str_(got.row['생성일시']) };
}

async function reportStudentForTeacher_(t, studentId) {
  var s = (await getObj_(SH.STUDENT, studentId));
  if (!s || !ownsClass_(t, str_(s['반']))) throw userError_('학생을 찾을 수 없어요.');
  return s;
}

/* ---------- 학급 리포트(교사) ---------- */

async function classReport_(cls) {
  var students = (await rows_(SH.STUDENT)).filter(function (s) { return str_(s['반']) === cls; })
    .sort(function (a, b) { return num_(a['번호'], 0) - num_(b['번호'], 0); });
  var progRows = (await rows_(SH.PROGRESS));
  var pre = (await reportPreload_());
  var counts = { 1: 0, 2: 0, 3: 0 };
  var sumCorrect = 0, sumJudged = 0, progSum = 0, progN = 0, scoreSum = 0, scoreN = 0, readyN = 0;
  var list = (await __aMap(students, async function (s) {
    var st = (await studentSessionInfo_(s));
    var pg = (await reportProgress_(st, progRows));
    var rep = (await reportData_(s, pre));
    var judged = rep.correct + rep.wrong;
    var d = (await deficitLevel_(rep));
    if (d.rank > 0) counts[d.rank]++;
    sumCorrect += rep.correct; sumJudged += judged;
    if (pg.total) { progSum += pg.done / pg.total; progN++; }
    if (judged) { scoreSum += rep.score.percent; scoreN++; }
    if (pg.ready) readyN++;
    return {
      id: st.id, num: num_(s['번호'], 0), name: str_(s['이름']), virtual: str_(s['가상여부']) === 'Y',
      progress: pg, judged: judged, correct: rep.correct, rate: judged ? Math.round(rep.correct * 1000 / judged) / 10 : null,
      score: judged ? rep.score.percent : null, deficit: d
    };
  }));
  return {
    cls: cls, label: (await classLabel_(cls)), generatedAt: now_(), students: list,
    summary: {
      count: list.length, ready: readyN,
      progress: progN ? Math.round(progSum * 1000 / progN) / 10 : null,
      rate: sumJudged ? Math.round(sumCorrect * 1000 / sumJudged) / 10 : null,
      score: scoreN ? Math.round(scoreSum * 10 / scoreN) / 10 : null,
      deficit: { severe: counts[3], serious: counts[2], caution: counts[1], total: counts[1] + counts[2] + counts[3] },
      cuts: (await deficitLevel_({ correct: 99, wrong: 0, score: { percent: 100 } })).cuts
    }
  };
}

/* ---------- 공개 API ---------- */
async function api_myReport(token) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var row = (await getObj_(SH.STUDENT, st.id));
    if (!row) throw authError_();
    return (await reportOut_((await ensureReport_(row)), false));
  }));
}

async function api_myReportSummary(token) {
  return (await wrap_(async function () {
    var st = (await requireStudent_(token));
    var row = (await getObj_(SH.STUDENT, st.id));
    if (!row) throw authError_();
    return (await reportSummary_(row, st.teacherId));
  }));
}

async function api_studentReport(token, studentId) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    return (await reportOut_((await ensureReport_((await reportStudentForTeacher_(t, studentId)), true)), true));
  }));
}

async function api_studentReportSummary(token, studentId) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    return (await reportSummary_((await reportStudentForTeacher_(t, studentId)), t.id, true));
  }));
}

async function api_classReport(token, cls) {
  return (await wrap_(async function () {
    var t = (await requireTeacher_(token));
    cls = String(cls || '');
    if (!ownsClass_(t, cls)) throw userError_('담당 학급이 아니에요.');
    return (await classReport_(cls));
  }));
}

/** 리포트에서 문제 보기: 그 학생이 푼 문항만 */
async function api_reportProblem(token, itemId, studentId) {
  return (await wrap_(async function () {
    var ses = (await getSession_(token));
    if (!ses) throw authError_();
    var sid = ses.id;
    if (ses.role === 'teacher') sid = str_((await reportStudentForTeacher_(ses, studentId))['학생ID']);
    else if (ses.role !== 'student') throw authError_();
    itemId = String(itemId || '');
    var solved = (await rows_(SH.SUBMIT)).some(function (s) { return str_(s['학생ID']) === sid && str_(s['문항ID']) === itemId; });
    var item = solved ? (await getItem_(itemId)) : null;
    if (!item) throw userError_('문제를 찾을 수 없어요.');
    return (await publicItemFull_(item));
  }));
}

;
/* ===================== 데이터 보기(교사): DB에 있는 모든 표 ===================== */
/*
 * 시트(앱 시트·기준 자료)는 머리글을 붙여 쪽 단위로 보여 주고, 시스템 표(속성·캐시·잠금·파일)는 DbView(Node 전용)로 읽는다.
 * 비밀번호 해시·솔트, API 키 같은 비밀값은 내보내지 않는다.
 */

var DATA_HIDE_COLS = {};
DATA_HIDE_COLS[SH.TEACHER] = ['비밀번호해시', '솔트'];
DATA_HIDE_COLS[SH.STUDENT] = ['비밀번호해시', '솔트'];
var DATA_CELL_MAX = 160;

var DATA_DESC = {};
DATA_DESC[SH.CONFIG] = '앱 설정(학교명, 확신도 기준, 학습 결손 기준 등)';
DATA_DESC[SH.TEACHER] = '교사 계정과 담당 반, AI 모델';
DATA_DESC[SH.STUDENT] = '학생 명단과 가입 상태';
DATA_DESC[SH.ITEM] = '문항(샘플·문제 이미지·AI 생성)';
DATA_DESC[SH.ASSIGN] = '출제한 과제';
DATA_DESC[SH.PROGRESS] = '학생별 과제 진행 단계';
DATA_DESC[SH.SUBMIT] = '풀이 제출과 AI 분석 결과';
DATA_DESC[SH.ERROR] = '풀이에서 찾은 오류(Newman 단계)';
DATA_DESC[SH.MISCON] = '학생별 개념 이해 기록(판단: 오개념·이해함, 출처: 풀이분석·교사판정·유도질문)';
DATA_DESC[SH.STAGESUM] = '학생별 Newman 단계 집계';
DATA_DESC[SH.SESSION] = '유도질문 학습 세션';
DATA_DESC[SH.CHAT] = '유도질문 대화';
DATA_DESC[SH.HELP] = '선생님 확인 요청과 답변';
DATA_DESC[SH.REPORT] = '학생 학습 리포트(학습결손은 교사 전용)';
DATA_DESC[SH.GRAPH] = '선수·후수 개념 관계';
DATA_DESC[SH.CONCEPT] = '개념 목록';

function dataHidden_(name, hdr) {
  var hide = {};
  (DATA_HIDE_COLS[name] || []).forEach(function (h) { var i = hdr.indexOf(h); if (i >= 0) hide[i] = true; });
  return hide;
}

function dataCell_(v) {
  var s = str_(plain_(v));
  return s.length > DATA_CELL_MAX ? { t: s.slice(0, DATA_CELL_MAX), more: s.length } : s;
}

async function api_dataTables(token) {
  return (await wrap_(async function () {
    (await requireTeacher_(token));
    var sheets = (await __aMap((await (await ss_()).getSheets()), async function (sh) {
      var name = sh.getName();
      return { kind: 'sheet', name: name, rows: Math.max(0, (await sh.getLastRow()) - 1), group: COLS[name] ? 'app' : 'ref', desc: DATA_DESC[name] || (/문항정보/.test(name) ? '문항코드별 개념·난이도·변별도' : '') };
    }));
    var order = Object.keys(SH).map(function (k) { return SH[k]; });
    sheets.sort(function (a, b) {
      var ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
    });
    var tables = typeof DbView !== 'undefined' ? (await DbView.listTables()) : [];
    return { sheets: sheets, tables: tables.map(function (t) { return { kind: 'table', name: t.name, rows: t.rows, group: 'system', desc: t.desc }; }) };
  }));
}

/** p: {kind: 'sheet'|'table', name, q, offset, limit} */
async function api_dataRows(token, p) {
  return (await wrap_(async function () {
    (await requireTeacher_(token));
    p = p || {};
    var name = String(p.name || '');
    var offset = Math.max(0, parseInt(p.offset, 10) || 0), limit = Math.min(200, Math.max(1, parseInt(p.limit, 10) || 50));
    var q = String(p.q || '').trim().toLowerCase();
    if (p.kind === 'table') {
      if (typeof DbView === 'undefined') throw userError_('이 환경에서는 시스템 표를 볼 수 없어요.');
      var r = (await DbView.readTable(name, { offset: offset, limit: limit, q: q }));
      r.rows.forEach(function (row) { row.cells = row.cells.map(dataCell_); });
      return r;
    }
    var sh = (await (await ss_()).getSheetByName(name));
    if (!sh) throw userError_('표를 찾을 수 없어요.');
    var lr = (await sh.getLastRow()), lc = (await sh.getLastColumn());
    if (lr < 1 || lc < 1) return { columns: [], rows: [], total: 0, offset: 0, limit: limit };
    var vals = (await sh.getRange(1, 1, lr, lc).getValues());
    var hdr = vals[0].map(function (h) { return String(h).trim(); });
    var hide = dataHidden_(name, hdr);
    var rows = [];
    for (var i = 1; i < vals.length; i++) {
      var row = vals[i];
      if (row.every(function (v) { return v === '' || v === null; })) continue;
      if (q && !row.some(function (v, c) { return !hide[c] && str_(plain_(v)).toLowerCase().indexOf(q) >= 0; })) continue;
      rows.push({ n: i + 1, cells: row });
    }
    return {
      columns: hdr, total: rows.length, offset: offset, limit: limit,
      rows: rows.slice(offset, offset + limit).map(function (r) {
        return { n: r.n, cells: r.cells.map(function (v, c) { return hide[c] ? '(숨김)' : dataCell_(v); }) };
      })
    };
  }));
}

/** 잘린 칸의 전체 값(시트만; 시스템 표는 값이 짧다) */
async function api_dataCell(token, p) {
  return (await wrap_(async function () {
    (await requireTeacher_(token));
    p = p || {};
    var name = String(p.name || '');
    var sh = (await (await ss_()).getSheetByName(name));
    var row = parseInt(p.row, 10), col = parseInt(p.col, 10);
    if (!sh || !(row >= 2) || !(col >= 0) || col >= (await sh.getLastColumn())) throw userError_('칸을 찾을 수 없어요.');
    var hdr = (await sh.getRange(1, 1, 1, (await sh.getLastColumn())).getValues())[0].map(function (h) { return String(h).trim(); });
    if (dataHidden_(name, hdr)[col]) return '(숨김)';
    return str_(plain_((await sh.getRange(row, col + 1).getValue())));
  }));
}
