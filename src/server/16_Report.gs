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
function reportDisc_(code) {
  var info = itemInfoIndex_().codes[String(code || '')];
  var a = info ? num_(info.disc, 0) : 0;
  return a > 0 ? a : 0;
}

function reportNote_(v) {
  var s = str_(v).trim();
  return /가상 데이터/.test(s) ? '' : s;
}

function reportStudent_(stRow) {
  return {
    id: str_(stRow['학생ID']), name: str_(stRow['이름']), num: String(parseInt(stRow['번호'], 10)),
    cls: str_(stRow['반']), classLabel: classLabel_(str_(stRow['반']))
  };
}

/** 여러 학생의 리포트를 한 번에 만들 때 시트를 한 번만 읽도록 미리 모아 둔다. */
function reportPreload_() {
  var itemMap = {};
  allItems_().forEach(function (it) { itemMap[it.id] = it; });
  return { subs: rows_(SH.SUBMIT), errs: rows_(SH.ERROR), itemMap: itemMap };
}

/** 한 학생의 리포트 자료(원 그래프·문항 목록·총점) */
function reportData_(stRow, pre) {
  pre = pre || reportPreload_();
  var student = reportStudent_(stRow);
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
  var items = keys.map(function (key) {
    var s = first[key];
    var item = itemMap[str_(s['문항ID'])] || null;
    var code = str_(s['문항코드']) || (item ? item.code : '');
    var disc = reportDisc_(code);
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
    function addMis(cid, name, text) {
      cid = str_(cid).trim();
      var c = cid ? conceptInfo_(cid) : null;
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
      rawMis.forEach(function (m) { if (m) addMis(m.concept_id, m.concept_name, m.student_belief); });
      splitList_(s['오개념개념id']).forEach(function (id) { addMis(id, '', ''); });
    }
    errs.forEach(function (e) {
      var st = str_(e['Newman단계']);
      if (st !== '변형' && st !== '이해') return;
      addMis(e['개념id'], e['개념명'], reportNote_(e['설명']) || str_(e['오류유형']));
    });
    out.misconceptions = out.misconceptions.slice(0, 3);
    return out;
  }).filter(Boolean);

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

function misconceptionGraph_(studentId) {
  var sid = String(studentId);
  var count = {}, order = [];
  rows_(SH.MISCON).forEach(function (r, i) {
    if (str_(r['학생id']) !== sid || miscVerdict_(r) !== '오개념') return; // 이해함 행은 세지 않는다
    var cid = str_(r['오개념 개념 코드']).trim();
    if (!cid) return;
    if (!count[cid]) { count[cid] = 0; order.push(cid); }
    count[cid]++;
  });
  var detail = {};
  rows_(SH.ERROR).forEach(function (e) {
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
  var pm = prereqMap_().pre;
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

  function nodeOf(id, bridge) {
    var c = conceptInfo_(id) || { name: '개념 ' + id, grade: '' };
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
  var nodes = ids.map(function (id) { return nodeOf(id, false); }).concat(bridgeOrder.map(function (id) { return nodeOf(id, true); }));
  var maxCount = ids.reduce(function (m, id) { return Math.max(m, count[id]); }, 0);
  return { nodes: nodes, edges: edges, total: total, shown: ids.length, maxCount: maxCount, depth: MISGRAPH_DEPTH };
}

/* ---------- 리포트 받아보기 조건 ---------- */

/** 출제된 과제를 모두 마쳤는지: 완료, 선생님 확인 중, 재시도 한도에 닿아 다음으로 넘어갈 수 있는 과제를 마친 것으로 본다. */
function reportProgress_(st, progRows) {
  var assigns = studentAssignments_(st);
  var prog = {};
  (progRows || rows_(SH.PROGRESS)).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = p; });
  var done = assigns.filter(function (a) { var p = prog[str_(a['과제ID'])]; return !!p && canNext_(p); }).length;
  return { total: assigns.length, done: done, ready: assigns.length > 0 && done === assigns.length };
}

/* ---------- 학습 결손(최소 성취수준 보장지도, 교사 전용) ---------- */

var DEFICIT_LABELS = ['학습 결손 주의', '학습 결손 심함', '학습 결손 매우 심함'];

/** 리포트 총점이 기준 미만이면 학습 결손 의심. rank: 0 해당 없음, 1 주의, 2 심함, 3 매우 심함, -1 판단 보류 */
function deficitLevel_(rep) {
  var judged = rep.correct + rep.wrong;
  var minItems = settingNum_('학습결손최소문항', 3);
  if (judged < minItems) {
    return { rank: -1, label: '판단 보류', reason: '채점된 문제가 ' + judged + '개라 판단하지 않았어요(최소 ' + minItems + '개).' };
  }
  var cuts = splitList_(setting_('학습결손기준') || '40,30,20').map(Number).filter(function (n) { return !isNaN(n); });
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

function reportSheetReady_() {
  if (sheet_(SH.REPORT, true) && headers_(SH.REPORT).indexOf('평가기준') >= 0) return;
  withLock_(function () { ensureSheet_(SH.REPORT, COLS[SH.REPORT], true); });
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
function ensureReport_(stRow, forTeacher) {
  var st = studentSessionInfo_(stRow);
  var pg = reportProgress_(st);
  if (!pg.ready && !forTeacher) {
    throw userError_(pg.total ? '과제를 모두 마치면 리포트를 받아볼 수 있어요. (' + pg.done + '/' + pg.total + ' 완료)' : '아직 출제된 과제가 없어요.', 'NOTREADY');
  }
  var rep = reportData_(stRow);
  var sig = reportSignature_(rep);
  reportSheetReady_();
  var row = getObj_(SH.REPORT, st.id);
  if (row && str_(row['기준']) === sig && parseJson_(row['리포트'], null)) return { rep: parseJson_(row['리포트'], null), row: row, teacherId: st.teacherId, progress: pg };
  // 채점 결과만 바뀌었으면(예: 선생님 판정) 써 둔 평가를 그대로 두고, 새로 푼 문제가 있으면 비워서 다시 쓰게 한다.
  var keepEval = row && str_(row['평가기준']) === reportEvalSignature_(rep);
  var patch = {
    '기준': sig, '평가': keepEval ? str_(row['평가']) : '', '평가기준': keepEval ? str_(row['평가기준']) : '', '생성일시': now_(),
    '리포트': JSON.stringify(compactReport_(rep)), '학습결손': JSON.stringify(deficitLevel_(rep))
  };
  if (row) updateObj_(SH.REPORT, row._row, patch);
  else appendObj_(SH.REPORT, Object.assign({ '학생ID': st.id }, patch));
  row = getObj_(SH.REPORT, st.id);
  return { rep: parseJson_(row['리포트'], null), row: row, teacherId: st.teacherId, progress: pg };
}

/** 화면에 보낼 리포트. 학습 결손은 교사에게만 넣는다. */
function reportOut_(got, forTeacher) {
  var out = got.rep;
  out.summary = { lines: parseJson_(got.row['평가'], []) || [], at: str_(got.row['생성일시']) };
  out.createdAt = str_(got.row['생성일시']);
  out.progress = got.progress ? { done: got.progress.done, total: got.progress.total, ready: got.progress.ready } : null;
  out.misGraph = misconceptionGraph_(out.student.id);
  if (forTeacher) out.deficit = parseJson_(got.row['학습결손'], null);
  return out;
}

/** AI가 쓴 평가 3줄. 한 번 쓰면 저장해 두고, 새로 푼 문제가 생기기 전까지 그대로 쓴다. */
function reportSummary_(stRow, teacherId, forTeacher) {
  var got = ensureReport_(stRow, forTeacher);
  var rep = got.rep;
  if (!rep.correct && !rep.wrong) return { lines: [], empty: true };
  var saved = parseJson_(got.row['평가'], []) || [];
  if (saved.length) return { lines: saved, at: str_(got.row['생성일시']) };
  var cfg = teacherAiConfig_(teacherId || got.teacherId);
  var out = llmJson_(cfg, { system: promptReportSystem_(), user: promptReportUser_(rep), maxTokens: 1500, temperature: 0.4 });
  var lines = (Array.isArray(out.lines) ? out.lines : []).map(function (l) { return String(l).trim(); }).filter(String).slice(0, 3);
  if (!lines.length) throw userError_('AI가 평가를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  updateObj_(SH.REPORT, rep.student.id, { '평가': JSON.stringify(lines), '평가기준': reportEvalSignature_(rep) });
  return { lines: lines, at: str_(got.row['생성일시']) };
}

function reportStudentForTeacher_(t, studentId) {
  var s = getObj_(SH.STUDENT, studentId);
  if (!s || !ownsClass_(t, str_(s['반']))) throw userError_('학생을 찾을 수 없어요.');
  return s;
}

/* ---------- 학급 리포트(교사) ---------- */

function classReport_(cls) {
  var students = rows_(SH.STUDENT).filter(function (s) { return str_(s['반']) === cls; })
    .sort(function (a, b) { return num_(a['번호'], 0) - num_(b['번호'], 0); });
  var progRows = rows_(SH.PROGRESS);
  var pre = reportPreload_();
  var counts = { 1: 0, 2: 0, 3: 0 };
  var sumCorrect = 0, sumJudged = 0, progSum = 0, progN = 0, scoreSum = 0, scoreN = 0, readyN = 0;
  var list = students.map(function (s) {
    var st = studentSessionInfo_(s);
    var pg = reportProgress_(st, progRows);
    var rep = reportData_(s, pre);
    var judged = rep.correct + rep.wrong;
    var d = deficitLevel_(rep);
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
  });
  return {
    cls: cls, label: classLabel_(cls), generatedAt: now_(), students: list,
    summary: {
      count: list.length, ready: readyN,
      progress: progN ? Math.round(progSum * 1000 / progN) / 10 : null,
      rate: sumJudged ? Math.round(sumCorrect * 1000 / sumJudged) / 10 : null,
      score: scoreN ? Math.round(scoreSum * 10 / scoreN) / 10 : null,
      deficit: { severe: counts[3], serious: counts[2], caution: counts[1], total: counts[1] + counts[2] + counts[3] },
      cuts: deficitLevel_({ correct: 99, wrong: 0, score: { percent: 100 } }).cuts
    }
  };
}

/* ---------- 공개 API ---------- */
function api_myReport(token) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var row = getObj_(SH.STUDENT, st.id);
    if (!row) throw authError_();
    return reportOut_(ensureReport_(row), false);
  });
}

function api_myReportSummary(token) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var row = getObj_(SH.STUDENT, st.id);
    if (!row) throw authError_();
    return reportSummary_(row, st.teacherId);
  });
}

function api_studentReport(token, studentId) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    return reportOut_(ensureReport_(reportStudentForTeacher_(t, studentId), true), true);
  });
}

function api_studentReportSummary(token, studentId) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    return reportSummary_(reportStudentForTeacher_(t, studentId), t.id, true);
  });
}

function api_classReport(token, cls) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    cls = String(cls || '');
    if (!ownsClass_(t, cls)) throw userError_('담당 학급이 아니에요.');
    return classReport_(cls);
  });
}

/** 리포트에서 문제 보기: 그 학생이 푼 문항만 */
function api_reportProblem(token, itemId, studentId) {
  return wrap_(function () {
    var ses = getSession_(token);
    if (!ses) throw authError_();
    var sid = ses.id;
    if (ses.role === 'teacher') sid = str_(reportStudentForTeacher_(ses, studentId)['학생ID']);
    else if (ses.role !== 'student') throw authError_();
    itemId = String(itemId || '');
    var solved = rows_(SH.SUBMIT).some(function (s) { return str_(s['학생ID']) === sid && str_(s['문항ID']) === itemId; });
    var item = solved ? getItem_(itemId) : null;
    if (!item) throw userError_('문제를 찾을 수 없어요.');
    return publicItemFull_(item);
  });
}
