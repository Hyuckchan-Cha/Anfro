/* ===================== 사진 전사·오류 분석 (Newman) ===================== */

/** 문항 개념을 후수개념으로 가진 직속 선수개념(개념 위계도) */
function directPrereqs_(conceptId, limit) {
  return (prereqMap_().pre[String(conceptId)] || []).slice(0, limit || 8).map(function (id) {
    var c = conceptInfo_(id) || {};
    return { id: String(id), name: c.name || '', grade: c.grade || '', desc: c.desc || '' };
  }).filter(function (c) { return c.name; });
}

/** 풀이 사진 전사: 문제 이미지(있으면)를 먼저, 학생 풀이(사진·직접 쓴 그림)를 마지막에 보내고 개념·선수개념을 함께 준다. */
function transcribe_(cfg, item, b64, mime) {
  var probImgs = itemImages_(item);
  var out = llmJson_(cfg, {
    system: promptOcrSystem_(), user: promptOcrUser_(item, { prereqs: directPrereqs_(item.conceptId, 8), hasProblemImage: probImgs.length > 0 }),
    // 여러 단으로 나눠 쓴 풀이의 배치를 살피도록 추론을 조금 더 쓴다.
    images: probImgs.concat([{ mime: mime, base64: b64 }]), maxTokens: 2500, temperature: 0, effort: 'medium'
  });
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

function buildAnalysisContext_(item, aiLines, lines) {
  var concept = conceptInfo_(item.conceptId) || {};
  var cands = [{ id: item.conceptId, name: item.conceptName, grade: item.grade }];
  prereqCandidates_(item.conceptId, { depth: 3, min: 6, limit: 24 }).forEach(function (c) { cands.push(c); });
  var core = coreConcepts_(item);
  var coreIds = {};
  core.forEach(function (c) { coreIds[c.id] = true; });
  core.forEach(function (c) { if (!cands.some(function (x) { return String(x.id) === c.id; })) cands.push(c); });
  return {
    item: item, concept: concept, aiLines: aiLines, lines: lines, edits: diffLines_(aiLines, lines),
    candidates: cands, core: core, coreIds: coreIds,
    basic: basicCalcCandidates_(item.grade, coreIds), categories: topCategories_()
  };
}

function analyze_(cfg, ctx) {
  return llmJson_(cfg, {
    system: promptAnalysisSystem_(), user: promptAnalysisUser_(ctx), images: ctx.images || [], maxTokens: 6000, temperature: 0.1, effort: 'high'
  });
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
function factErrorConcept_(text) {
  var m = String(text || '').replace(/\\(sin|cos|tan)/g, '$1').match(TRIG_FACT_RE);
  if (!m) return null;
  var zero = m[2] === '0' || m[2] === '90';
  var cm = conceptMap_(), hit = null;
  Object.keys(cm).some(function (id) {
    var n = String(cm[id].name || '');
    if (!/삼각비의 값/.test(n)) return false;
    if (zero ? /0/.test(n) && /90/.test(n) && !/30/.test(n) : /30/.test(n) && /45/.test(n) && /60/.test(n)) { hit = cm[id]; return true; }
    return false;
  });
  return hit ? { id: String(hit.id), name: hit.name } : { id: '', name: zero ? '0°, 90°의 삼각비의 값' : '30°, 45°, 60°의 삼각비의 값' };
}

function decideOutcome_(raw, ctx) {
  var thr = settingNum_('확신도기준', 0.6);
  var item = ctx.item;
  var pool = ctx.candidates.concat(ctx.basic);
  var valid = {};
  pool.forEach(function (c) { valid[String(c.id)] = c; });

  function fixConcept(id, name) {
    id = (id === null || id === undefined) ? '' : String(id).trim();
    if (id && valid[id]) return { id: id, name: valid[id].name, grade: valid[id].grade };
    var byName = conceptIdByName_(name, pool);
    if (byName) return { id: byName, name: valid[byName].name, grade: valid[byName].grade };
    if (id && conceptInfo_(id)) { var c = conceptInfo_(id); return { id: id, name: c.name, grade: c.grade }; }
    // 후보에 없는 개념 이름(예: 중2 '피타고라스 정리')은 이 문항 학년 이하의 전체 개념에서 찾는다.
    var g = conceptByNameUpToGrade_(name, item.grade);
    return g ? { id: g.id, name: g.name, grade: g.grade } : null;
  }

  // 최종 답이 맞아도 줄 단위 검증에서 틀린 줄이 있으면 정답으로 보지 않는다(정답 우연 일치 방지).
  var processBad = raw.process_ok === false || String(raw.process_ok) === 'false' ||
    (Array.isArray(raw.line_checks) && raw.line_checks.some(function (c) { return c && (c.ok === false || String(c.ok) === 'false'); }));
  var answerOk = raw.is_correct === true || String(raw.is_correct) === 'true';
  var correct = answerOk && (item.type === '암산허용' || !processBad);
  var errors = (Array.isArray(raw.errors) ? raw.errors : []).map(function (e) {
    var stage = normalizeStage_(e.stage);
    if (!stage) return null;
    var c = fixConcept(e.concept_id, e.concept_name);
    var conf = Math.max(0, Math.min(1, num_(e.confidence, 0.5)));
    return {
      line: parseInt(e.line, 10) || '', stage: stage, conceptId: c ? c.id : '', conceptName: c ? c.name : String(e.concept_name || ''),
      category: String(e.category || '').slice(0, 60), description: String(e.description || '').slice(0, 500),
      evidence: String(e.evidence || '').slice(0, 500), uncertainty: String(e.uncertainty || '').slice(0, 300),
      confidence: conf, core: e.core !== false, source: 'AI'
    };
  }).filter(Boolean);
  // 외워서 알아야 하는 값(특수각의 삼각비 값 등)을 틀리게 쓴 것은 계산 실수가 아니라 개념 오류(변형)다.
  errors.forEach(function (e) {
    if (e.stage !== '처리기술') return;
    var fc = factErrorConcept_([e.category, e.description, e.evidence, e.conceptName].join(' '));
    if (!fc) return;
    e.stage = '변형';
    e.core = true;
    if (!e.conceptId || !coreOrTrig_(e.conceptName)) { e.conceptId = fc.id; e.conceptName = fc.name; }
    e.uncertainty = (e.uncertainty ? e.uncertainty + ' / ' : '') + '특수각의 삼각비 값을 잘못 쓴 것은 계산 실수가 아니라 개념 오류라 변형으로 분류';
  });
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
  (Array.isArray(raw.misconceptions) ? raw.misconceptions : []).forEach(function (m) {
    if (!m) return;
    var c = fixConcept(m.concept_id, m.concept_name);
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
  });
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
