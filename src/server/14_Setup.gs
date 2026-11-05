/* ===================== 초기 설정 ===================== */

var VIRTUAL_SURNAMES = ['강', '김', '이', '박', '최', '정', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
var VIRTUAL_GIVEN = ['민준', '서연', '도윤', '지우', '하준', '서윤', '시우', '하은', '주원', '지호', '수아', '예준', '지민', '유준', '채원', '은우', '지아', '현우', '다은', '건우',
  '윤서', '우진', '소율', '선우', '예린', '연우', '하린', '정우', '수빈', '태윤'];

function virtualName_(i) {
  return VIRTUAL_SURNAMES[(i * 7) % VIRTUAL_SURNAMES.length] + VIRTUAL_GIVEN[i % VIRTUAL_GIVEN.length];
}

function ensureSheet_(name, headers, styled) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1 || sh.getLastColumn() < 1) {
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    var r = sh.getRange(1, 1, 1, headers.length);
    r.setValues([headers]);
    if (styled) { r.setFontWeight('bold').setBackground('#EDF2FF'); sh.setFrozenRows(1); }
  } else {
    var lc = sh.getLastColumn();
    var cur = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
    var missing = headers.filter(function (h) { return cur.indexOf(h) < 0; });
    if (missing.length) {
      if (lc + missing.length > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), lc + missing.length - sh.getMaxColumns());
      sh.getRange(1, lc + 1, 1, missing.length).setValues([missing]);
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
function setupAll_() {
  var props = PropertiesService.getScriptProperties();
  var running = Number(props.getProperty('SETUP_RUNNING') || 0);
  if (running && Date.now() - running < 6 * 60 * 1000) throw userError_('초기 설정이 이미 실행 중이에요. 1~2분 뒤 결과 창을 확인해 주세요.');
  props.setProperty('SETUP_RUNNING', String(Date.now()));
  try { return setupAllOnce_(); } finally { props.deleteProperty('SETUP_RUNNING'); }
}

function setupAllOnce_() {
  var ss = ss_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());
  pepper_();
  Object.keys(COLS).forEach(function (name) { ensureSheet_(name, COLS[name], name !== SH.MISCON); });
  var removed = removeDuplicateRows_();

  // 설정
  var cfg = sheet_(SH.CONFIG);
  var have = {};
  // 예전 표기(레+포+트)를 '리포트'로 바꾼다(설정 이름·설명). 일괄 치환에 휘말리지 않게 글자는 이스케이프로 적음.
  var OLD_RE = new RegExp('\uB808\uD3EC\uD2B8', 'g');
  var cfgRows = cfg.getLastRow() >= 2 ? cfg.getRange(2, 1, cfg.getLastRow() - 1, 3).getValues() : [];
  for (var ci = 0; ci < cfgRows.length; ci++) {
    var cr = cfgRows[ci], key = String(cr[0]).trim(), note = String(cr[2]);
    if (key.replace(OLD_RE, '리포트') !== key || note.replace(OLD_RE, '리포트') !== note) {
      key = key.replace(OLD_RE, '리포트');
      cfg.getRange(ci + 2, 1, 1, 3).setValues([[key, cr[1], note.replace(OLD_RE, '리포트')]]);
    }
    have[key] = 1;
  }
  DEFAULT_SETTINGS.forEach(function (r) { if (!have[r[0]]) cfg.appendRow([r[0], cell_(r[1]), r[2]]); });
  forget_('settings');

  // 교사 (초기 비밀번호 1234)
  var teachers = rows_(SH.TEACHER);
  if (!teachers.length) {
    [['T01', '홍길동', 'hong', '1,2,3'], ['T02', '김길동', 'kim', '4,5']].forEach(function (t) {
      var salt = newSalt_();
      appendObj_(SH.TEACHER, {
        '교사ID': t[0], '이름': t[1], '로그인ID': t[2], '담당반': t[3], '비밀번호해시': hashPw_('1234', salt), '솔트': salt,
        'AI제공자': 'openai', '모델': PROVIDERS.openai.defaultModel, 'API키상태': '미설정', '가상여부': 'Y', '생성일시': now_(), '수정일시': now_()
      });
    });
  } else {
    teachers.forEach(function (t) {
      if (!str_(t['비밀번호해시'])) { var salt = newSalt_(); updateObj_(SH.TEACHER, t._row, { '비밀번호해시': hashPw_('1234', salt), '솔트': salt }); }
    });
  }
  forget_('teachers');

  // 학생 명단 (1~5반 × 30명, 가상 이름, 아직 가입 전)
  var students = rows_(SH.STUDENT);
  if (!students.length) {
    var list = [], i = 0;
    classList_().forEach(function (cls) {
      var t = teacherForClass_(cls);
      for (var n = 1; n <= 30; n++) {
        list.push({ '학생ID': studentIdFor_(cls, n), '반': cls, '번호': n, '이름': virtualName_(i++), '담당교사ID': t ? str_(t['교사ID']) : '', '가입여부': 'N', '가상여부': 'Y' });
      }
    });
    appendObjs_(SH.STUDENT, list);
    students = rows_(SH.STUDENT);
  }
  ensureStudentScoreRows_(students.map(function (s) { return { id: str_(s['학생ID']), cls: str_(s['반']), num: str_(s['번호']), name: str_(s['이름']) }; }));

  imageFolder_();

  // 기준 자료(없으면 Drive CSV에서 가져옴) → 문제 이미지 연결(문항정보가 있어야 개념을 붙일 수 있음)
  var refMsgs = importReferenceData_();
  var link = linkProblemImages_();
  if (link.found) {
    // 예전 손글씨 샘플 출제는 같은 문항코드의 이미지 문항으로 바꾼다.
    var imgIds = {};
    allItems_().forEach(function (it) { if (it.imageId) imgIds[it.id] = true; });
    rows_(SH.ASSIGN).forEach(function (a) {
      var m = str_(a['문항ID']).match(/^Q-SAMPLE-(\d+)$/);
      var s = m ? SAMPLE_ITEMS[parseInt(m[1], 10) - 1] : null;
      if (s && imgIds['IMG-' + s.code]) updateObj_(SH.ASSIGN, a._row, { '문항ID': 'IMG-' + s.code });
    });
    if (!rows_(SH.ASSIGN).length) {
      var irows = [];
      rows_(SH.TEACHER).forEach(function (t) {
        SAMPLE_ITEMS.filter(function (s) { return imgIds['IMG-' + s.code]; }).forEach(function (s, k) {
          irows.push({ '과제ID': newId_('A') + k, '교사ID': str_(t['교사ID']), '대상반': splitList_(t['담당반']).join(','), '문항ID': 'IMG-' + s.code, '순서': k + 1, '공개': 'Y', '출제일시': now_() });
        });
      });
      appendObjs_(SH.ASSIGN, irows);
    }
  }

  // 문제 이미지 폴더가 없을 때만: 손으로 만든 샘플 문항과 출제(시연용)
  if (!rows_(SH.ITEM).length) {
    appendObjs_(SH.ITEM, SAMPLE_ITEMS.map(function (s, k) {
      return {
        '문항ID': 'Q-SAMPLE-' + ('0' + (k + 1)).slice(-2), '문항코드': s.code, '개념id': s.cid, '개념명': s.name, '학년': '중3', '난이도': s.diff,
        '문제': s.text, '정답': s.answer, '풀이단계': JSON.stringify(s.steps), '그림스펙': s.figure ? JSON.stringify(s.figure) : '',
        '문항유형': s.type, '시각화유형': s.visual, '생성방식': '샘플', '참고문항ID': '', '생성일시': now_()
      };
    }));
    forget_('allItems');
    if (!rows_(SH.ASSIGN).length) {
      var arows = [];
      rows_(SH.TEACHER).forEach(function (t) {
        SAMPLE_ITEMS.forEach(function (s, k) {
          arows.push({ '과제ID': newId_('A') + k, '교사ID': str_(t['교사ID']), '대상반': splitList_(t['담당반']).join(','), '문항ID': 'Q-SAMPLE-' + ('0' + (k + 1)).slice(-2), '순서': k + 1, '공개': 'Y', '출제일시': now_() });
        });
      });
      appendObjs_(SH.ASSIGN, arows);
    }
  }

  // 자료 시트 점검 (없으면 Drive의 CSV에서 자동으로 가져온다)
  var msgs = ['시트, 교사 2명(초기 비밀번호 1234), 학생 명단 ' + students.length + '명을 준비했어요.'];
  if (removed) msgs.push('중복으로 들어간 행 ' + removed + '개를 정리했어요.');
  refMsgs.forEach(function (m) { msgs.push(m); });
  msgs.push(link.found
    ? '문제 이미지: ' + link.linked + '개 연결(새로 추가 ' + link.created + '개). 정답은 처음 쓸 때 AI가 풀어 저장해요. [문제 정답 미리 만들기] 메뉴로 미리 만들 수도 있어요.'
    : '문제 이미지 폴더(' + (setting_('문제이미지폴더') || '중3_문제이미지') + ')를 찾지 못해 손으로 만든 샘플 문항을 썼어요.');
  var nConcept = Object.keys(conceptMap_()).length;
  var pm = prereqMap_().pre, nEdge = 0;
  Object.keys(pm).forEach(function (k) { nEdge += pm[k].length; });
  var infos = infoSheets_().map(function (s) { return s.getName(); });
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
function hasReferenceSheet_(keys) {
  return ss_().getSheets().some(function (sh) {
    if (COLS[sh.getName()]) return false;
    var I = headerIndex_(sheetHeaders_(sh), keys);
    return keys.every(function (k) { return I[k] >= 0; });
  });
}

/** 자료 시트가 없을 때만 Drive에서 같은 이름의 CSV를 찾아 시트로 만든다. */
function importReferenceData_() {
  var msgs = [];
  REFERENCE_CSV.forEach(function (ref) {
    if (hasReferenceSheet_(ref.keys)) return;
    var it = DriveApp.getFilesByName(ref.file);
    if (!it.hasNext()) { msgs.push(ref.sheet + ': Drive에서 ' + ref.file + ' 파일을 찾지 못했어요.'); return; }
    var rows = Utilities.parseCsv(it.next().getBlob().getDataAsString('UTF-8'));
    if (rows.length && rows[0][0]) rows[0][0] = String(rows[0][0]).replace(/^﻿/, '');
    var width = rows[0].length;
    rows = rows.filter(function (r) { return r.length === width; }).map(function (r) {
      return r.map(function (v) {
        if (/^-?\d+(\.\d+)?$/.test(v)) return v;
        return /^[=+\-@]/.test(v) ? "'" + v : v;
      });
    });
    var ss = ss_();
    var sh = ss.getSheetByName(ref.sheet) || ss.insertSheet(ref.sheet);
    sh.clear();
    if (sh.getMaxRows() < rows.length) sh.insertRowsAfter(sh.getMaxRows(), rows.length - sh.getMaxRows());
    if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
    for (var i = 0; i < rows.length; i += 3000) {
      var part = rows.slice(i, i + 3000);
      sh.getRange(i + 1, 1, part.length, width).setValues(part);
    }
    sh.setFrozenRows(1);
    msgs.push(ref.sheet + ': ' + ref.file + '에서 ' + (rows.length - 1) + '행을 가져왔어요.');
  });
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
function removeDuplicateRows_() {
  var total = 0;
  DEDUPE_KEYS.forEach(function (d) {
    var sh = sheet_(d[0], true);
    if (!sh || sh.getLastRow() < 3) return;
    var lc = sh.getLastColumn();
    var values = sh.getRange(1, 1, sh.getLastRow(), lc).getValues();
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
    sh.getRange(2, 1, values.length - 1, lc).clearContent();
    if (keep.length) sh.getRange(2, 1, keep.length, lc).setValues(keep);
    total += dropped;
  });
  ['allItems', 'settings'].forEach(forget_);
  return total;
}
