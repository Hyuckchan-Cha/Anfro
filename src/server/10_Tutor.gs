/* ===================== 1단계: 채팅식 유도질문 + 선수개념 역방향 추적 ===================== */
/*
 * 세션 상태(학습세션.상태데이터)
 *  frames  : 스택. 맨 위가 지금 풀고 있는 문제. origin = root(처음 오개념) | prereq(선수개념 추적)
 *  queue   : 아직 다루지 않은 다른 오개념 개념id
 *  visited : 이미 다룬 개념id
 *  trail   : 추적 경로 기록
 *  results : 끝난 프레임 결과(어려움 여부)
 */

function newFrame_(conceptId, item, origin, depth) {
  var c = conceptInfo_(conceptId) || {};
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

function chat_(sessionId, data, role, text, frame) {
  data.seq = (data.seq || 0) + 1;
  appendObj_(SH.CHAT, {
    '세션ID': sessionId, '순번': data.seq, '역할': role, '내용': text,
    '문항ID': frame ? frame.problemId : '', '개념id': frame ? frame.conceptId : '', '일시': now_()
  });
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
function tutorCandidates_(outcome) {
  var list = (outcome.candidates || []).map(function (c) {
    return { conceptId: String(c.conceptId || ''), conceptName: c.conceptName, kind: c.kind || '', confidence: c.confidence, belief: c.belief || '', status: '미정', notes: [] };
  });
  (outcome.misconceptions || []).forEach(function (id) {
    if (list.some(function (c) { return c.conceptId === String(id); })) return;
    var c = conceptInfo_(id);
    if (c) list.push({ conceptId: String(id), conceptName: c.name, kind: '', confidence: null, belief: (outcome.beliefs || [])[0] || '', status: '미정', notes: [] });
  });
  return list.slice(0, 5);
}

/**
 * 유도질문에서 한 개념의 이해 여부를 오개념도표에 남긴다. 한 세션에서 한 개념은 한 번만.
 * 오개념이면 오류기록에도 남기되, 분석 때 이미 오개념으로 올린 개념은 다시 올리지 않는다(오개념 지도 횟수가 부풀지 않게).
 */
function tutorVerdict_(st, sessionId, data, f, understood, level, reason, category) {
  var cid = String(f.conceptId || '');
  data.verdicts = data.verdicts || {};
  if (!cid || data.verdicts[cid]) return;
  data.verdicts[cid] = understood ? '이해함' : '오개념';
  if (understood) {
    recordConcepts_(studentRef_(st), [{ conceptId: cid, conceptName: f.conceptName, verdict: '이해함', source: '유도질문', level: level || '', reason: reason || '', itemId: f.problemId }]);
    return;
  }
  if ((data.recordedConcepts || []).indexOf(cid) >= 0) return;
  data.recordedConcepts = (data.recordedConcepts || []).concat([cid]);
  recordTutorFinding_(st, sessionId, { problemId: f.problemId, conceptId: cid, conceptName: f.conceptName, level: level || '' }, reason, category);
}

/** AI가 적은 후보 판단을 반영한다: 확인됨 → 오개념, 아님 → 이해함으로 오개념도표에 남긴다. */
function applyCandidateChecks_(st, sessionId, data, frame, checks) {
  (Array.isArray(checks) ? checks : []).forEach(function (ck) {
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
    if (verdict === '확인됨') tutorVerdict_(st, sessionId, data, f, false, '', '유도질문에서 확인: ' + (c.belief || c.conceptName) + note, '오개념 확인(유도질문)');
    else tutorVerdict_(st, sessionId, data, f, true, '', '유도질문에서 오개념 후보가 아님을 확인' + note);
  });
}

function saveSession_(ses, data, status) {
  updateObj_(SH.SESSION, ses._row, {
    '상태': status || str_(ses['상태']), '상태데이터': JSON.stringify(data), '추적경로': trailText_(data),
    '진단결과': resultText_(data), '대화수': data.msgCount || 0, '수정일시': now_()
  });
}

function tutorView_(st, ses) {
  var data = parseJson_(ses['상태데이터'], {}) || {};
  var frames = data.frames || [];
  var frame = frames[frames.length - 1];
  var item = frame ? getItem_(frame.problemId) : null;
  var sid = str_(ses['세션ID']);
  var msgs = rows_(SH.CHAT).filter(function (r) { return str_(r['세션ID']) === sid; })
    .sort(function (a, b) { return num_(a['순번'], 0) - num_(b['순번'], 0); }).slice(-80)
    .map(function (r) { return { role: str_(r['역할']), text: str_(r['내용']) }; });
  return {
    sessionId: sid, status: str_(ses['상태']), finished: str_(ses['상태']) !== '진행중',
    path: frames.map(function (f) { return { conceptId: f.conceptId, name: f.conceptName, grade: f.grade, origin: f.origin }; }),
    problem: publicItemFull_(item), step: frame && item ? { index: frame.stepIndex, total: (item.steps || []).length } : null,
    messages: msgs, thinkSeconds: settingNum_('생각시간초', 20)
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

function api_tutorStart(token, assignmentId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var f = assignmentForStudent_(st, assignmentId);
    var p = getOrCreateProgress_(st, f.a);
    if (str_(p['단계']) !== 'tutor') throw userError_('지금은 유도질문 학습 단계가 아니에요.');
    if (str_(p['세션ID'])) {
      var ex = getObj_(SH.SESSION, str_(p['세션ID']));
      if (ex) return tutorView_(st, ex);
    }
    var cache = CacheService.getScriptCache();
    var flagKey = 'TS:' + str_(p['진행ID']);
    if (cache.get(flagKey)) throw userError_('학습을 준비하고 있어요. 잠시만 기다려 주세요.');
    cache.put(flagKey, '1', 120);
    try {
      var sub = getObj_(SH.SUBMIT, str_(p['최근제출ID']));
      var item = getItem_(str_(p['현재문항ID']));
      var outcome = (parseJson_(sub && sub['AI분석'], {}) || {}).outcome || {};
      var mis = (outcome.misconceptions || []).map(String).filter(String);
      if (!mis.length) mis = [item.conceptId];
      var cfg = teacherAiConfig_(st.teacherId);
      var exclude = seenItemIds_(st.id);
      exclude[item.id] = true;
      var first = mis[0];
      // 오개념 학습 문제는 처음 문제보다 쉬운 것으로 고른다(같은 개념).
      var prob = ensureSteps_(cfg, pickEasierForConcept_(cfg, first, item.diff, exclude, item));
      var frame = newFrame_(first, prob, 'root', 0);
      var data = {
        frames: [frame], queue: mis.slice(1), visited: [first],
        trail: [{ conceptId: frame.conceptId, conceptName: frame.conceptName, grade: frame.grade, depth: 0, problemId: frame.problemId }],
        results: [], msgCount: 0, seq: 0, origSummary: origSummary_(sub), diff: item.diff, origItemId: item.id,
        candidates: tutorCandidates_(outcome),
        // 분석할 때 이미 오개념도표에 올린 개념(같은 개념을 두 번 올리지 않게)
        recordedConcepts: (outcome.errors || []).filter(function (e) { return ['이해', '변형', '처리기술'].indexOf(e.stage) >= 0 && e.conceptId; }).map(function (e) { return String(e.conceptId); })
      };
      var sessionId = newId_('SES');
      appendObj_(SH.SESSION, {
        '세션ID': sessionId, '학생ID': st.id, '과제ID': str_(f.a['과제ID']), '원제출ID': sub ? str_(sub['제출ID']) : '',
        '원문항ID': item.id, '상태': '진행중', '상태데이터': '{}', '추적경로': '', '진단결과': '', '대화수': 0,
        '시작일시': now_(), '수정일시': now_()
      });
      var ses = getObj_(SH.SESSION, sessionId);
      chat_(sessionId, data, 'tutor', openingMessage_(frame), frame);
      saveSession_(ses, data, '진행중');
      setProgress_(p, { '세션ID': sessionId });
      return tutorView_(st, getObj_(SH.SESSION, sessionId));
    } finally {
      cache.remove(flagKey);
    }
  });
}

function api_tutorView(token, sessionId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var ses = getObj_(SH.SESSION, sessionId);
    if (!ses || str_(ses['학생ID']) !== st.id) throw userError_('학습 세션을 찾을 수 없어요.');
    return tutorView_(st, ses);
  });
}

/** 학생 메시지 처리. kind: answer | dontknow | hint */
function api_tutorSend(token, sessionId, text, kind) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var ses = getObj_(SH.SESSION, sessionId);
    if (!ses || str_(ses['학생ID']) !== st.id) throw userError_('학습 세션을 찾을 수 없어요.');
    if (str_(ses['상태']) !== '진행중') throw userError_('이미 끝난 학습이에요.');
    var cache = CacheService.getScriptCache();
    var lockKey = 'TL:' + sessionId;
    if (cache.get(lockKey)) throw userError_('앞의 답을 처리하고 있어요. 잠시만 기다려 주세요.');
    cache.put(lockKey, '1', 90);
    try {
      return tutorTurn_(st, ses, String(text || ''), kind || 'answer');
    } finally {
      cache.remove(lockKey);
    }
  });
}

function tutorTurn_(st, ses, text, kind) {
  var sessionId = str_(ses['세션ID']);
  var data = parseJson_(ses['상태데이터'], {}) || {};
  var frame = data.frames[data.frames.length - 1];
  var item = getItem_(frame.problemId);
  var cfg = teacherAiConfig_(st.teacherId);
  var maxDepth = settingNum_('최대추적깊이', 4);
  var maxMsgs = settingNum_('튜터최대대화', 40);

  var studentText = kind === 'hint' ? '(힌트를 요청함)' : (kind === 'dontknow' ? '모르겠어요' : text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500));
  if (!studentText) throw userError_('답을 입력해 주세요.');
  data.msgCount = (data.msgCount || 0) + 1;

  var visitedSet = {};
  (data.visited || []).forEach(function (v) { visitedSet[v] = true; });
  var depth = data.frames.length - 1;
  var candidates = depth + 1 < maxDepth ? prereqCandidates_(frame.conceptId, { depth: 1, min: 3, limit: 12, exclude: visitedSet }) : [];
  candidates.forEach(function (c) { var info = conceptInfo_(c.id); c.desc = info ? info.desc : ''; });
  if (!data.candidates) data.candidates = [];
  var ctx = {
    frame: frame, item: item, concept: conceptInfo_(frame.conceptId), path: data.frames.map(function (f) { return f.conceptName; }),
    depth: depth, maxDepth: maxDepth - 1, candidates: candidates, studentText: studentText,
    origSummary: frame.origin === 'root' ? data.origSummary : '', thinking: (frame.thinking || []).slice(-4),
    misCandidates: data.candidates
  };
  var probImgs = itemImages_(item), solImgs = submissionImages_(getObj_(SH.SUBMIT, str_(ses['원제출ID'])));
  var images = probImgs.concat(solImgs);
  var note = [probImgs.length ? '지금 함께 푸는 문제의 이미지' : '', solImgs.length ? '학생이 처음 틀린 문제의 풀이 사진(지금 문제와 다를 수 있음, 학생의 생각을 이해하는 데 참고)' : ''].filter(String).join(', ');
  var out = llmJson_(cfg, { system: promptTutorSystem_(), user: promptTutorUser_(ctx) + (note ? '\n[첨부 이미지] ' + note + ' 순서로 첨부함' : ''), images: images, maxTokens: 1200, temperature: 0.4 });

  var messages = [];
  messages.push(chat_(sessionId, data, 'student', studentText, frame));
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
  applyCandidateChecks_(st, sessionId, data, frame, out.candidate_checks);
  if (out.check_problem) frame.notes.push('확인 문제: ' + String(out.check_problem).slice(0, 140));
  if (frame.notes.length > 4) frame.notes = frame.notes.slice(-4);
  messages.push(chat_(sessionId, data, 'tutor', reply, frame));

  var finished = false, nextStage = '';

  if (action === 'go_prereq') {
    var pid = String(out.prereq_concept_id === null || out.prereq_concept_id === undefined ? '' : out.prereq_concept_id).trim();
    var okIds = {};
    candidates.forEach(function (c) { okIds[String(c.id)] = c; });
    if (!okIds[pid]) pid = conceptIdByName_(out.prereq_concept_name || out.prereq_reason, candidates);
    if (pid && okIds[pid] && !visitedSet[pid] && data.frames.length < maxDepth) {
      var exclude = seenItemIds_(st.id);
      data.frames.forEach(function (fr) { exclude[fr.problemId] = true; });
      var prob = ensureSteps_(cfg, pickEasierForConcept_(cfg, pid, num_(data.diff, item.diff), exclude, null));
      var nf = newFrame_(pid, prob, 'prereq', data.frames.length);
      if (out.prereq_reason) nf.notes.push('추적 이유: ' + String(out.prereq_reason).slice(0, 140));
      data.frames.push(nf);
      data.visited.push(pid);
      data.trail.push({ conceptId: nf.conceptId, conceptName: nf.conceptName, grade: nf.grade, depth: nf.depth, problemId: nf.problemId });
      messages.push(chat_(sessionId, data, 'system', "선수개념 확인: '" + nf.conceptName + "' (" + nf.grade + ')', nf));
      messages.push(chat_(sessionId, data, 'tutor', openingMessage_(nf), nf));
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
    tutorVerdict_(st, sessionId, data, done, understood, lv, why, done.origin === 'prereq' ? '선수개념 결손(유도질문 확인)' : '유도질문 단계 판정');
    data.results.push({ conceptId: done.conceptId, conceptName: done.conceptName, grade: done.grade, origin: done.origin, struggled: done.struggled, understood: understood, level: lv, explained: done.explained, notes: done.notes, problemId: done.problemId });
    if (data.frames.length) {
      var parent = data.frames[data.frames.length - 1];
      var back = "좋아요! '" + done.conceptName + "' 문제를 스스로 해결했어요. 이제 아까 풀던 문제로 돌아가 볼게요. 방금 확인한 내용을 떠올리면서, 멈췄던 부분을 다시 생각해 볼까요?";
      messages.push(chat_(sessionId, data, 'tutor', back, parent));
    } else {
      // 다른 오개념이 남았으면 이어서
      var nextId = '';
      while (data.queue && data.queue.length && !nextId) {
        var q = String(data.queue.shift());
        if (data.visited.indexOf(q) < 0) nextId = q;
      }
      if (nextId) {
        var excl = seenItemIds_(st.id);
        data.frames.concat([done]).forEach(function (fr) { excl[fr.problemId] = true; });
        var prob2 = ensureSteps_(cfg, pickEasierForConcept_(cfg, nextId, num_(data.diff, 0), excl, null));
        var rf = newFrame_(nextId, prob2, 'root', 0);
        data.frames.push(rf);
        data.visited.push(nextId);
        data.trail.push({ conceptId: rf.conceptId, conceptName: rf.conceptName, grade: rf.grade, depth: 0, problemId: rf.problemId });
        messages.push(chat_(sessionId, data, 'system', "다음으로 확인할 개념: '" + rf.conceptName + "'", rf));
        messages.push(chat_(sessionId, data, 'tutor', openingMessage_(rf), rf));
      } else {
        finished = true;
      }
    }
  }

  if (!finished && data.msgCount >= maxMsgs) {
    finished = true;
    createHelp_(st, { '제출ID': str_(ses['원제출ID']) }, getItem_(str_(ses['원문항ID'])), '유도질문 대화가 길어져 마무리함 (경로: ' + trailText_(data) + ')');
    messages.push(chat_(sessionId, data, 'system', '대화가 길어져 여기까지 할게요. 선생님께도 알려 드렸어요.', null));
  }

  if (finished) {
    messages.push(chat_(sessionId, data, 'system', '1단계 학습을 마쳤어요! 이제 처음 문제로 돌아가 다시 풀어 볼까요? (2단계)', null));
    saveSession_(ses, data, '완료');
    var a = { '과제ID': str_(ses['과제ID']) };
    var p = progressFor_(st, a['과제ID']);
    if (p) setProgress_(p, { '단계': 'regress', '현재문항ID': str_(p['원문항ID']), '시도횟수': 0, '최근제출ID': '' });
    nextStage = 'regress';
  } else {
    saveSession_(ses, data, '진행중');
  }

  var view = tutorView_(st, getObj_(SH.SESSION, sessionId));
  return { messages: messages, finished: finished, nextStage: nextStage, view: view };
}
