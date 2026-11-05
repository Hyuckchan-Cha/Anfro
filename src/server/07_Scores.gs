/* ===================== 점수 기록 (오개념도표·단계별집계·오류기록) ===================== */

/** 단계별집계에 학생 행이 없으면 추가. students: [{id, cls, num, name}] */
function ensureStudentScoreRows_(students) {
  var sh = sheet_(SH.STAGESUM, true);
  if (!sh) return;
  var have = {};
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { have[str_(r[0])] = 1; });
  var hdr = headers_(SH.STAGESUM);
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
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, hdr.length).setValues(add);
}

function updateStageSumName_(studentId, name) {
  var r = findRow_(SH.STAGESUM, studentId);
  if (r > 0) updateObj_(SH.STAGESUM, r, { '이름': name });
}

/* ---------- 오개념도표(개념별 이해 기록) ---------- */

/** 예전 시트(3열)에는 처음 쓸 때 판단·출처 등 빠진 머리글을 붙인다. */
function miscSheetReady_() {
  if (headers_(SH.MISCON).indexOf('판단') >= 0) return;
  withLock_(function () { ensureSheet_(SH.MISCON, COLS[SH.MISCON], false); });
}

/** 예전 행처럼 판단이 비어 있으면 오개념으로 본다. */
function miscVerdict_(row) { return str_(row['판단']).trim() || '오개념'; }

/**
 * 개념 판단을 한 행씩 남긴다. 같은 호출 안에서 같은 개념·판단은 한 번만.
 * entries: [{conceptId, verdict: '오개념'|'이해함', level, source: '풀이분석'|'교사판정'|'유도질문', reason, itemId, conceptName}]
 */
function recordConcepts_(student, entries) {
  var seen = {};
  var list = (entries || []).filter(function (e) {
    var k = String(e && e.conceptId || '') + '|' + (e && e.verdict);
    if (!e || !e.conceptId || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
  if (!list.length) return;
  miscSheetReady_();
  var rows = list.map(function (e) {
    var c = conceptInfo_(e.conceptId) || {};
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
  });
  appendObjs_(SH.MISCON, rows);
}

/** 오개념만 남길 때(예전 호출 모양 유지) */
function bumpMiscon_(student, conceptIds, meta) {
  meta = meta || {};
  recordConcepts_(student, (conceptIds || []).map(function (c) {
    return { conceptId: String(c), verdict: '오개념', source: meta.source || '', reason: meta.reason || '', itemId: meta.itemId || '', level: meta.level || '' };
  }));
}

/** 단계별집계: patch = {'제출수':1, '주원인_변형':1, ...} */
function bumpStageSum_(student, patch) {
  withLock_(function () {
    var row = findRow_(SH.STAGESUM, student.id);
    if (row < 0) { ensureStudentScoreRows_([student]); row = findRow_(SH.STAGESUM, student.id); }
    if (row < 0) return;
    var hdr = headers_(SH.STAGESUM);
    var sh = sheet_(SH.STAGESUM);
    var vals = sh.getRange(row, 1, 1, hdr.length).getValues()[0];
    Object.keys(patch).forEach(function (k) {
      var c = hdr.indexOf(k);
      if (c >= 0) vals[c] = num_(vals[c], 0) + patch[k];
    });
    var cu = hdr.indexOf('최근갱신');
    if (cu >= 0) vals[cu] = cell_(now_());
    sh.getRange(row, 1, 1, hdr.length).setValues([vals]);
  });
}

function studentRef_(st) { return { id: st.id, cls: st.cls, num: st.num, name: st.name }; }

/** 자주 쓰인 오류 유형 (분류를 일관되게 하려고 AI에게 보여 줌) */
function topCategories_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('topCats');
  if (hit) return JSON.parse(hit);
  var cnt = {};
  var sh = sheet_(SH.ERROR, true);
  if (sh && sh.getLastRow() >= 2) {
    var hdr = headers_(SH.ERROR);
    var ci = hdr.indexOf('오류유형');
    var from = Math.max(2, sh.getLastRow() - 1500);
    sh.getRange(from, 1, sh.getLastRow() - from + 1, hdr.length).getValues().forEach(function (r) {
      var k = str_(r[ci]).trim();
      if (k) cnt[k] = (cnt[k] || 0) + 1;
    });
  }
  var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 25);
  cache.put('topCats', JSON.stringify(top), 600);
  return top;
}

/** 교사확인요청 ("선생님의 풀이가 필요해요") */
function createHelp_(st, sub, item, reason) {
  var h = {
    '요청ID': newId_('H'), '제출ID': sub ? sub['제출ID'] : '', '학생ID': st.id, '반': st.cls, '문항ID': item ? item.id : '',
    '교사ID': st.teacherId, '사유': reason, '상태': '대기', '교사답변': '', '교사판정단계': '', '교사판정개념id': '',
    '학생확인': 'N', '요청일시': now_(), '답변일시': ''
  };
  appendObj_(SH.HELP, h);
  return h;
}

/**
 * 분석 결과 기록
 *  - 오류기록: 오류마다 한 행
 *  - 오개념도표: 오답이면 이해·변형·처리기술 오류에 연결된 서로 다른 개념마다 '오개념' 한 행,
 *                정답이면 문항 개념에 '이해함' 한 행(분석이 본 이해 수준과 함께)
 *  - 단계별집계: 제출·정답·오답·보류 수, 주원인, 처리기술·인코딩 점수
 */
function recordOutcome_(st, sub, item, outcome) {
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
  if (rows.length) appendObjs_(SH.ERROR, rows);
  var ref = studentRef_(st);
  if (outcome.result === 'wrong') recordConcepts_(ref, conceptRows);
  if (outcome.result === 'correct' && item.conceptId) {
    var u = outcome.understanding || {};
    recordConcepts_(ref, [{
      conceptId: item.conceptId, conceptName: item.conceptName, verdict: '이해함', source: '풀이분석', level: u.level || '',
      reason: (str_(sub['시도구분']) || '풀이') + ' 정답' + (u.evidence ? ' — ' + u.evidence : ''), itemId: item.id
    }]);
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
  bumpStageSum_(ref, patch);
}

/** 유도질문 중 선수개념 결손이 확인되었을 때 */
function recordTutorFinding_(st, sessionId, frame, note, category) {
  appendObj_(SH.ERROR, {
    '오류ID': newId_('E'), '제출ID': sessionId, '학생ID': st.id, '반': st.cls, '문항ID': frame.problemId, '문항코드': '',
    '줄번호': '', 'Newman단계': '변형', '주원인여부': 'N', '개념id': frame.conceptId, '개념명': frame.conceptName,
    '오류유형': category || '선수개념 결손(유도질문 확인)', '설명': note || '유도질문 과정에서 이 선수개념의 어려움이 확인됨',
    '판단근거': '유도질문 대화 기록', '불확실성': '', '확신도': 0.7, '출처': '유도질문', '기록일시': now_(), '가상여부': 'N'
  });
  recordConcepts_(studentRef_(st), [{
    conceptId: frame.conceptId, conceptName: frame.conceptName, verdict: '오개념', source: '유도질문',
    level: frame.level || '', reason: note || '', itemId: frame.problemId
  }]);
}

/**
 * 가상 데이터를 지운 뒤 등: 남은 기록으로 오개념도표·단계별집계를 다시 계산
 * 오개념도표: 오류기록 → 오개념 행, 풀이기록의 정답 → 이해함 행. 유도질문의 이해함 행은 다른 기록에 없으므로 그대로 둔다.
 */
function rebuildScores_() {
  var students = rows_(SH.STUDENT);
  var names = {}, sum = {}, subResult = {};
  var keys = ['제출수', '정답수', '오답수', '판단보류', '주원인_읽기', '주원인_이해', '주원인_변형', '주원인_처리기술', '주원인_인코딩', '처리기술점수', '인코딩점수'];
  students.forEach(function (s) {
    var id = str_(s['학생ID']);
    names[id] = str_(s['이름']);
    sum[id] = {};
    keys.forEach(function (k) { sum[id][k] = 0; });
  });
  var misRows = [], misSeen = {};
  rows_(SH.SUBMIT).forEach(function (r) {
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
  rows_(SH.ERROR).forEach(function (e) {
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

  var hdr = headers_(SH.STAGESUM);
  var sh = sheet_(SH.STAGESUM);
  if (sh.getLastRow() >= 2) {
    var grid = sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).getValues();
    grid.forEach(function (r) {
      var o = sum[str_(r[0])];
      if (!o) return;
      hdr.forEach(function (h, c) { if (o[h] !== undefined) r[c] = o[h]; });
    });
    sh.getRange(2, 1, grid.length, hdr.length).setValues(grid);
  }
  miscSheetReady_();
  // 유도질문에서 이해함으로 판단한 행은 다시 만들 수 없으니 남긴다(지워진 학생 것은 뺀다).
  rows_(SH.MISCON).forEach(function (r) {
    var sid = str_(r['학생id']);
    if (!sum[sid] || str_(r['출처']) !== '유도질문' || miscVerdict_(r) !== '이해함') return;
    misRows.push({ sid: sid, cid: str_(r['오개념 개념 코드']), verdict: '이해함', name: str_(r['개념명']), level: str_(r['이해수준']), source: '유도질문',
      reason: str_(r['근거']), item: str_(r['문항ID']), at: str_(r['기록일시']) });
  });
  misRows.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  var mhdr = headers_(SH.MISCON);
  var ms = sheet_(SH.MISCON);
  if (ms.getLastRow() >= 2) ms.getRange(2, 1, ms.getLastRow() - 1, mhdr.length).clearContent();
  if (misRows.length) {
    var grid2 = misRows.map(function (m) {
      var c = m.name ? null : conceptInfo_(m.cid);
      var o = {
        '학생이름': names[m.sid] || '', '학생id': m.sid, '오개념 개념 코드': m.cid, '판단': m.verdict, '개념명': m.name || (c ? c.name : ''),
        '이해수준': m.level, '출처': m.source, '근거': String(m.reason || '').slice(0, 300), '문항ID': m.item, '기록일시': m.at
      };
      return mhdr.map(function (h) { return cell_(o[h] === undefined ? '' : o[h]); });
    });
    if (misRows.length + 1 > ms.getMaxRows()) ms.insertRowsAfter(ms.getMaxRows(), misRows.length + 1 - ms.getMaxRows());
    ms.getRange(2, 1, grid2.length, mhdr.length).setValues(grid2);
  }
}
