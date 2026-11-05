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

function sheetHeaders_(sh) {
  var lc = sh.getLastColumn();
  if (lc < 1) return [];
  return sh.getRange(1, 1, 1, Math.min(lc, 40)).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** 머리글로 시트를 찾는다 (시트 이름은 자유) */
function findSheetByHeaders_(keys, preferName) {
  var ss = ss_();
  function ok(sh) {
    if (!sh) return false;
    var I = headerIndex_(sheetHeaders_(sh), keys);
    return keys.every(function (k) { return I[k] >= 0; });
  }
  if (preferName) { var p = ss.getSheetByName(preferName); if (ok(p)) return p; }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (ok(sheets[i])) return sheets[i];
  return null;
}

function gradeRank_(g) {
  var m = String(g || '').match(/(초|중)\s*([1-6])/);
  if (!m) return 99;
  return (m[1] === '초' ? 0 : 6) + parseInt(m[2], 10);
}

/** 개념목록: {id: {id,name,grade,sem,unit,std,desc}} */
function conceptMap_() {
  return memo_('concepts', function () {
    var map = {};
    var sh = findSheetByHeaders_(['cid', 'cname', 'grade'], SH.CONCEPT);
    if (!sh || sh.getLastRow() < 2) return map;
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
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
  });
}

function conceptInfo_(id) {
  id = String(id || '');
  var c = conceptMap_()[id];
  if (c) return c;
  // 개념목록에 없는 개념(문항정보에만 있는 태그)
  var idx = itemInfoIndex_();
  var codes = idx.byConcept[id];
  if (codes && codes.length) {
    var it = idx.codes[codes[0]];
    return { id: id, name: it.conceptName, grade: it.grade, sem: '', unit: '', std: it.std, desc: it.desc, order: 99999 };
  }
  return null;
}

/** 선수개념위계도: {pre: {후수id: [선수id...]}, post: {선수id: [후수id...]}} */
function prereqMap_() {
  return memo_('prereq', function () {
    var pre = {}, post = {};
    var sh = findSheetByHeaders_(['pre', 'post'], SH.GRAPH);
    if (!sh || sh.getLastRow() < 2) return { pre: pre, post: post };
    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var I = headerIndex_(v[0].map(function (h) { return String(h).trim(); }), ['pre', 'post']);
    for (var r = 1; r < v.length; r++) {
      var a = str_(v[r][I.pre]).trim(), b = str_(v[r][I.post]).trim();
      if (!a || !b) continue;
      (pre[b] = pre[b] || []).push(a);
      (post[a] = post[a] || []).push(b);
    }
    return { pre: pre, post: post };
  });
}

/** 학년별 문항정보 시트들 (이름에 '문항정보'가 들어가거나, 문항코드+개념ID+난이도 머리글이 있는 시트) */
function infoSheets_() {
  return memo_('infoSheets', function () {
    var out = [];
    ss_().getSheets().forEach(function (sh) {
      var name = sh.getName();
      if (name === SH.ITEM) return;
      var hdr = sheetHeaders_(sh);
      if (hdr.indexOf('문제') >= 0) return;
      var I = headerIndex_(hdr, ['code', 'cid', 'diff']);
      if (I.code >= 0 && I.cid >= 0 && (I.diff >= 0 || /문항정보/.test(name))) out.push(sh);
    });
    return out;
  });
}

/** 문항정보 색인: {codes: {문항코드: {...}}, byConcept: {개념id: [문항코드...]}} */
function itemInfoIndex_() {
  return memo_('itemInfo', function () {
    var codes = {}, byConcept = {};
    infoSheets_().forEach(function (sh) {
      if (sh.getLastRow() < 2) return;
      var v = sh.getRange(1, 1, sh.getLastRow(), Math.min(sh.getLastColumn(), 12)).getValues();
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
    });
    return { codes: codes, byConcept: byConcept };
  });
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

function keywordRelated_(conceptId, limit, maxGradeRank) {
  var cm = conceptMap_();
  var c = conceptInfo_(conceptId);
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
function prereqCandidates_(conceptId, opts) {
  opts = opts || {};
  var pm = prereqMap_().pre;
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
    keywordRelated_(conceptId, 12).forEach(function (x) {
      if (seen[x.id] || exclude[x.id]) return;
      seen[x.id] = true;
      out.push({ id: x.id, depth: 9, via: 'related' });
    });
  }
  return out.slice(0, opts.limit || 20).map(function (o) {
    var c = conceptInfo_(o.id) || { name: '', grade: '' };
    return { id: o.id, name: c.name, grade: c.grade, depth: o.depth, via: o.via };
  });
}

/**
 * 문항의 핵심 개념 묶음: 문항 개념 + 같은 학년·같은 중단원(단원 앞 두 단계)의 개념.
 * 예) '제곱근의 곱셈' 문항 → 근호를 포함한 식의 계산(곱셈·나눗셈·덧셈과 뺄셈·유리화 …)
 * 이 묶음의 계산을 틀린 것은 단순 계산 실수(처리기술)가 아니라 오개념(변형)으로 본다.
 */
function coreConcepts_(item) {
  var cm = conceptMap_();
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

function basicCalcCandidates_(gradeOfItem, excludeIds) {
  excludeIds = excludeIds || {};
  var cm = conceptMap_();
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
function conceptByNameUpToGrade_(name, maxGrade) {
  var key = String(name || '').replace(/[\s$]/g, '');
  if (key.length < 2) return null;
  var limit = gradeRank_(maxGrade || '중3');
  var cm = conceptMap_(), exact = null, partial = null;
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
