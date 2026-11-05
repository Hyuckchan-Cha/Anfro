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

function api_dataTables(token) {
  return wrap_(function () {
    requireTeacher_(token);
    var sheets = ss_().getSheets().map(function (sh) {
      var name = sh.getName();
      return { kind: 'sheet', name: name, rows: Math.max(0, sh.getLastRow() - 1), group: COLS[name] ? 'app' : 'ref', desc: DATA_DESC[name] || (/문항정보/.test(name) ? '문항코드별 개념·난이도·변별도' : '') };
    });
    var order = Object.keys(SH).map(function (k) { return SH[k]; });
    sheets.sort(function (a, b) {
      var ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
    });
    var tables = typeof DbView !== 'undefined' ? DbView.listTables() : [];
    return { sheets: sheets, tables: tables.map(function (t) { return { kind: 'table', name: t.name, rows: t.rows, group: 'system', desc: t.desc }; }) };
  });
}

/** p: {kind: 'sheet'|'table', name, q, offset, limit} */
function api_dataRows(token, p) {
  return wrap_(function () {
    requireTeacher_(token);
    p = p || {};
    var name = String(p.name || '');
    var offset = Math.max(0, parseInt(p.offset, 10) || 0), limit = Math.min(200, Math.max(1, parseInt(p.limit, 10) || 50));
    var q = String(p.q || '').trim().toLowerCase();
    if (p.kind === 'table') {
      if (typeof DbView === 'undefined') throw userError_('이 환경에서는 시스템 표를 볼 수 없어요.');
      var r = DbView.readTable(name, { offset: offset, limit: limit, q: q });
      r.rows.forEach(function (row) { row.cells = row.cells.map(dataCell_); });
      return r;
    }
    var sh = ss_().getSheetByName(name);
    if (!sh) throw userError_('표를 찾을 수 없어요.');
    var lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr < 1 || lc < 1) return { columns: [], rows: [], total: 0, offset: 0, limit: limit };
    var vals = sh.getRange(1, 1, lr, lc).getValues();
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
  });
}

/** 잘린 칸의 전체 값(시트만; 시스템 표는 값이 짧다) */
function api_dataCell(token, p) {
  return wrap_(function () {
    requireTeacher_(token);
    p = p || {};
    var name = String(p.name || '');
    var sh = ss_().getSheetByName(name);
    var row = parseInt(p.row, 10), col = parseInt(p.col, 10);
    if (!sh || !(row >= 2) || !(col >= 0) || col >= sh.getLastColumn()) throw userError_('칸을 찾을 수 없어요.');
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    if (dataHidden_(name, hdr)[col]) return '(숨김)';
    return str_(plain_(sh.getRange(row, col + 1).getValue()));
  });
}
