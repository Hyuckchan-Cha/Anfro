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
function studentAssignments_(st) {
  return rows_(SH.ASSIGN).filter(function (a) {
    if (str_(a['교사ID']) !== st.teacherId) return false;
    if (str_(a['공개']) === 'N') return false;
    var target = str_(a['대상반']);
    return target === '전체' || splitList_(target).indexOf(st.cls) >= 0;
  }).sort(function (x, y) { return num_(x['순서'], 999) - num_(y['순서'], 999) || String(x['출제일시']).localeCompare(String(y['출제일시'])); });
}

function progressFor_(st, assignmentId) {
  var list = rows_(SH.PROGRESS);
  for (var i = 0; i < list.length; i++) {
    if (str_(list[i]['학생ID']) === st.id && str_(list[i]['과제ID']) === assignmentId) return list[i];
  }
  return null;
}

function getOrCreateProgress_(st, a) {
  var p = progressFor_(st, str_(a['과제ID']));
  if (p) return p;
  return withLock_(function () {
    var again = progressFor_(st, str_(a['과제ID']));
    if (again) return again;
    var obj = {
      '진행ID': newId_('P'), '학생ID': st.id, '과제ID': str_(a['과제ID']), '원문항ID': str_(a['문항ID']), '상태': '미시작',
      '단계': 'solve', '현재문항ID': str_(a['문항ID']), '세션ID': '', '최근제출ID': '', '시도횟수': 0, '반복횟수': 0,
      '교사알림': 'N', '완료일시': '', '수정일시': now_()
    };
    appendObj_(SH.PROGRESS, obj);
    return progressFor_(st, str_(a['과제ID']));
  });
}

function setProgress_(p, patch) {
  patch['수정일시'] = now_();
  updateObj_(SH.PROGRESS, p._row, patch);
  Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
}

function assignmentForStudent_(st, assignmentId) {
  var list = studentAssignments_(st);
  for (var i = 0; i < list.length; i++) if (str_(list[i]['과제ID']) === String(assignmentId)) return { a: list[i], index: i, total: list.length };
  throw userError_('이 문제를 찾을 수 없어요. 목록에서 다시 골라 주세요.');
}

function canNext_(p) {
  var stage = str_(p['단계']);
  if (stage === 'done' || stage === 'hold' || stage === 'skip') return true;
  if (UPLOAD_STAGES.indexOf(stage) >= 0 && stage !== 'solve' && num_(p['시도횟수'], 0) >= settingNum_('최대재시도', 3)) return true;
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

function teacherAnswersFor_(st, assignmentId) {
  var subs = {};
  rows_(SH.SUBMIT).forEach(function (s) { if (str_(s['학생ID']) === st.id && str_(s['과제ID']) === assignmentId) subs[str_(s['제출ID'])] = 1; });
  return rows_(SH.HELP).filter(function (h) {
    return str_(h['학생ID']) === st.id && subs[str_(h['제출ID'])] && str_(h['상태']) === '답변완료';
  }).map(function (h) { return { requestId: str_(h['요청ID']), text: str_(h['교사답변']), at: str_(h['답변일시']) }; });
}

function workspaceView_(st, a, p, index, total) {
  var stage = str_(p['단계']) || 'solve';
  var item = getItem_(str_(p['현재문항ID']) || str_(a['문항ID']));
  if (!item) throw userError_('문항 정보를 찾을 수 없어요. 선생님께 알려 주세요.');
  var orig = (stage === 'apply') ? getItem_(str_(p['원문항ID'])) : null;
  var latest = str_(p['최근제출ID']) ? getObj_(SH.SUBMIT, str_(p['최근제출ID'])) : null;
  return {
    assignmentId: str_(a['과제ID']), no: index + 1, total: total,
    problem: publicItemFull_(item), original: publicItemFull_(orig),
    progress: { status: str_(p['상태']), stage: stage, attempts: num_(p['시도횟수'], 0), loops: num_(p['반복횟수'], 0) },
    stageInfo: stageInfo_(stage),
    latest: latest && str_(latest['문항ID']) === item.id ? submissionView_(latest) : null,
    sessionId: stage === 'tutor' ? str_(p['세션ID']) : '',
    canNext: canNext_(p),
    teacherAnswers: teacherAnswersFor_(st, str_(a['과제ID'])),
    thinkSeconds: settingNum_('생각시간초', 20)
  };
}

/* ---------- 공개 API ---------- */
function api_studentHome(token) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var assigns = studentAssignments_(st);
    var prog = {};
    rows_(SH.PROGRESS).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = p; });
    var answered = {};
    var subToAssign = {};
    rows_(SH.SUBMIT).forEach(function (s) { if (str_(s['학생ID']) === st.id) subToAssign[str_(s['제출ID'])] = str_(s['과제ID']); });
    rows_(SH.HELP).forEach(function (h) {
      if (str_(h['학생ID']) === st.id && str_(h['상태']) === '답변완료' && subToAssign[str_(h['제출ID'])]) answered[subToAssign[str_(h['제출ID'])]] = true;
    });
    var items = assigns.map(function (a, i) {
      var it = getItem_(str_(a['문항ID']));
      var p = prog[str_(a['과제ID'])];
      return {
        assignmentId: str_(a['과제ID']), no: i + 1, conceptName: it ? it.conceptName : '(문항 없음)',
        preview: it ? (it.text ? previewText_(it.text, 80) : (it.imageId ? '(그림으로 된 문제)' : '')) : '', status: p ? str_(p['상태']) : '미시작',
        stage: p ? str_(p['단계']) : '', stageLabel: p ? stageInfo_(str_(p['단계'])).label : '', teacherAnswered: !!answered[str_(a['과제ID'])]
      };
    });
    return { profile: st, items: items, report: reportProgress_(st) };
  });
}

function api_openProblem(token, assignmentId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var f = assignmentForStudent_(st, assignmentId);
    var p = getOrCreateProgress_(st, f.a);
    return workspaceView_(st, f.a, p, f.index, f.total);
  });
}

function api_myImage(token, submissionId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var s = getObj_(SH.SUBMIT, submissionId);
    if (!s || str_(s['학생ID']) !== st.id) throw userError_('사진을 찾을 수 없어요.');
    return imageDataUrl_(str_(s['이미지파일ID']));
  });
}

/** 사진 업로드 → 비공개 드라이브 저장 → AI 전사(평가 없이 읽은 그대로) */
function api_transcribe(token, payload) {
  return wrap_(function () {
    var st = requireStudent_(token);
    payload = payload || {};
    var f = assignmentForStudent_(st, payload.assignmentId);
    var p = getOrCreateProgress_(st, f.a);
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 사진을 올릴 수 없는 단계예요.');
    var item = getItem_(str_(p['현재문항ID']));
    var b64 = String(payload.imageBase64 || '').replace(/^data:[^,]+,/, '');
    if (b64.length < 1000) throw userError_('사진을 다시 골라 주세요.');
    if (b64.length > 9000000) throw userError_('사진 용량이 너무 커요. 다시 찍어 주세요.');
    var mime = /^image\/(jpeg|png|webp)$/.test(String(payload.mime)) ? String(payload.mime) : 'image/jpeg';
    var cfg = teacherAiConfig_(st.teacherId);
    var tr = transcribe_(cfg, item, b64, mime);
    var file = saveImage_(st, item, b64, mime);
    var sub = {
      '제출ID': newId_('SUB'), '학생ID': st.id, '반': st.cls, '과제ID': str_(f.a['과제ID']), '문항ID': item.id, '문항코드': item.code,
      '개념id': item.conceptId, '시도구분': attemptKind_(stage), '시도차수': num_(p['시도횟수'], 0) + 1, '세션ID': str_(p['세션ID']),
      '이미지파일ID': file.id, '이미지링크': file.url, 'AI전사': JSON.stringify(tr), '상태': '전사완료', '제출일시': now_(), '가상여부': 'N'
    };
    appendObj_(SH.SUBMIT, sub);
    setProgress_(p, { '최근제출ID': sub['제출ID'], '상태': '진행중' });
    return { submissionId: sub['제출ID'], lines: tr.lines, unreadable: tr.unreadable, note: tr.note };
  });
}

/** 학생이 확인·수정한 풀이 제출 → Newman 분석 → 단계별 처방 */
function api_submitSolution(token, payload) {
  return wrap_(function () {
    var st = requireStudent_(token);
    payload = payload || {};
    var lines = sanitizeLines_(payload.lines);
    if (!lines.length) throw userError_('풀이 내용이 비어 있어요.');
    var sub = getObj_(SH.SUBMIT, payload.submissionId);
    if (!sub || str_(sub['학생ID']) !== st.id) throw userError_('제출 정보를 찾을 수 없어요. 사진을 다시 올려 주세요.');
    var f = assignmentForStudent_(st, str_(sub['과제ID']));
    var p = getOrCreateProgress_(st, f.a);
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 제출할 수 없는 단계예요.');
    if (str_(sub['문항ID']) !== str_(p['현재문항ID'])) throw userError_('지금 풀고 있는 문제의 사진을 다시 올려 주세요.');

    // 이미 분석한 제출을 고쳐서 다시 내면 새 시도로 기록 (사진은 그대로)
    if (str_(sub['상태']) !== '전사완료') {
      var copy = {};
      headers_(SH.SUBMIT).forEach(function (h) { copy[h] = ''; });
      ['학생ID', '반', '과제ID', '문항ID', '문항코드', '개념id', '세션ID', '이미지파일ID', '이미지링크', 'AI전사'].forEach(function (k) { copy[k] = sub[k]; });
      copy['제출ID'] = newId_('SUB');
      copy['시도구분'] = attemptKind_(stage);
      copy['시도차수'] = num_(p['시도횟수'], 0) + 1;
      copy['상태'] = '전사완료';
      copy['제출일시'] = now_();
      copy['가상여부'] = 'N';
      appendObj_(SH.SUBMIT, copy);
      sub = getObj_(SH.SUBMIT, copy['제출ID']);
      setProgress_(p, { '최근제출ID': copy['제출ID'] });
    }

    var item = getItem_(str_(sub['문항ID']));
    var cfg = teacherAiConfig_(st.teacherId);
    if (!item.answer || (item.imageId && !item.text)) item = ensureSteps_(cfg, item);
    var aiLines = (parseJson_(sub['AI전사'], { lines: [] }).lines) || [];
    var ctx = buildAnalysisContext_(item, aiLines, lines);
    var probImgs = itemImages_(item), solImgs = submissionImages_(sub);
    ctx.images = probImgs.concat(solImgs);
    ctx.imageNote = [probImgs.length ? '문제 이미지(그림·보기 포함)' : '', solImgs.length ? '학생 풀이 사진' : ''].filter(String).join(', ') + ' 순서로 첨부함';
    var raw = analyze_(cfg, ctx);
    var outcome = decideOutcome_(raw, ctx);
    return applyOutcome_(st, f, p, sub, item, outcome, raw, ctx, cfg);
  });
}

function applyOutcome_(st, f, p, sub, item, outcome, raw, ctx, cfg) {
  var stage = str_(p['단계']);
  var attempts = num_(p['시도횟수'], 0) + 1;
  var loops = num_(p['반복횟수'], 0);
  var maxRetry = settingNum_('최대재시도', 3), maxLoops = settingNum_('최대학습반복', 2);
  var edited = selfCorrection_(ctx.aiLines, ctx.lines);
  var fb = { result: outcome.result, stage: outcome.primary || '', message: '', canNext: false, showHelp: false, startTutor: false, nextStage: '' };
  var prog = { '시도횟수': attempts };

  if (outcome.result === 'correct') {
    if (stage === 'regress') {
      var nx = pickNewForCode_(cfg, item, seenItemIds_(st.id), tutorItemIdsFor_(st.id, str_(f.a['과제ID'])));
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
    createHelp_(st, sub, item, outcome.holdReason || '판단 보류');
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
        createHelp_(st, sub, item, '유도질문 학습을 ' + loops + '번 했지만 변형 단계 오류가 반복됨');
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
          createHelp_(st, sub, item, '같은 문제를 ' + attempts + '번 틀림 (주원인: ' + outcome.primary + ')');
          prog['교사알림'] = 'Y';
        }
      }
    }
  }

  var resultCode = outcome.result === 'correct' ? 'O' : (outcome.result === 'hold' ? '보류' : 'X');
  var mainErr = outcome.errors.filter(function (e) { return e.primary; })[0];
  updateObj_(SH.SUBMIT, sub._row, {
    '학생수정본': JSON.stringify(ctx.lines),
    '자기교정': outcome.selfCorrected ? '오류를 스스로 고침' : (edited ? '전사 수정함' : 'N'),
    '학생최종답': outcome.studentAnswer, '정오': resultCode, '주원인': outcome.primary || '',
    '오개념개념id': (outcome.misconceptions || []).join(','), '확신도': outcome.confidence || '',
    '판단근거': mainErr ? (mainErr.evidence || mainErr.description) : (outcome.holdReason || outcome.summary || ''),
    '불확실성': mainErr ? mainErr.uncertainty : (outcome.holdReason || ''),
    'AI분석': JSON.stringify({ outcome: { result: outcome.result, primary: outcome.primary, misconceptions: outcome.misconceptions, candidates: outcome.candidates || [], errors: outcome.errors, summary: outcome.summary, selfCorrection: outcome.selfCorrectionNote, holdReason: outcome.holdReason || '', intent: outcome.intent, understanding: outcome.understanding, beliefs: outcome.beliefs }, raw: raw }).slice(0, 45000),
    '상태': outcome.result === 'hold' ? '판단보류' : '분석완료', '학생피드백': JSON.stringify(fb), '분석일시': now_()
  });
  recordOutcome_(st, sub, item, outcome);
  setProgress_(p, prog);
  fb.submissionId = str_(sub['제출ID']);
  fb.view = workspaceView_(st, f.a, p, f.index, f.total);
  return fb;
}

/** 이해 단계 도움: 그래프·기하 문제는 시각화, 아니면 예시 */
function api_comprehensionHelp(token, submissionId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var sub = getObj_(SH.SUBMIT, submissionId);
    if (!sub || str_(sub['학생ID']) !== st.id) throw userError_('제출 정보를 찾을 수 없어요.');
    var cached = parseJson_(sub['이해도움'], null);
    if (cached) return cached;
    var item = getItem_(str_(sub['문항ID']));
    var mode = (item.visual === '그래프' || item.visual === '기하' || item.figure) ? '시각화' : '예시';
    var cfg = teacherAiConfig_(st.teacherId);
    var lines = parseJson_(sub['학생수정본'], []) || [];
    var probImgs = itemImages_(item), solImgs = submissionImages_(sub);
    var images = probImgs.concat(solImgs);
    var note = [probImgs.length ? '문제 이미지(그림·보기 포함)' : '', solImgs.length ? '학생이 처음 제출한 풀이 사진(어디서 막혔는지 참고만)' : ''].filter(String).join(', ');
    var out = llmJson_(cfg, { system: promptHelpSystem_(), user: promptHelpUser_(item, mode, lines) + (note ? '\n[첨부 이미지] ' + note + ' 순서로 첨부함' : ''), images: images, maxTokens: 2200, temperature: 0.4 });
    var fig = (out.figure && Array.isArray(out.figure.elements)) ? out.figure : (mode === '시각화' ? item.figure : null);
    var help = {
      mode: mode, title: String(out.title || (mode === '시각화' ? '문제 상황을 그림으로 보기' : '예시로 이해하기')),
      explanation: String(out.explanation || ''), figure: fig,
      example: out.example && out.example.problem ? { problem: String(out.example.problem), explanation: String(out.example.explanation || '') } : null,
      check: String(out.check_question || '')
    };
    updateObj_(SH.SUBMIT, sub._row, { '이해도움': JSON.stringify(help) });
    return help;
  });
}

function api_nextAssignment(token, currentAssignmentId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var list = studentAssignments_(st);
    var prog = {};
    rows_(SH.PROGRESS).forEach(function (p) { if (str_(p['학생ID']) === st.id) prog[str_(p['과제ID'])] = str_(p['상태']); });
    var idx = -1;
    list.forEach(function (a, i) { if (str_(a['과제ID']) === String(currentAssignmentId)) idx = i; });
    for (var k = 1; k <= list.length; k++) {
      var a = list[(idx + k) % list.length];
      if (!a) break;
      if (str_(a['과제ID']) === String(currentAssignmentId)) continue;
      if (prog[str_(a['과제ID'])] !== '완료' && prog[str_(a['과제ID'])] !== '못 풂') return { assignmentId: str_(a['과제ID']) };
    }
    return { assignmentId: null };
  });
}

/** [도움 받기]: 풀기 전에 문제를 자세히 설명한다(채팅 없이 설명 카드 하나). 같은 문제는 6시간 동안 저장해 둔 설명을 쓴다. */
function api_problemHelp(token, assignmentId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var f = assignmentForStudent_(st, assignmentId);
    var p = getOrCreateProgress_(st, f.a);
    if (UPLOAD_STAGES.indexOf(str_(p['단계'])) < 0) throw userError_('지금은 도움을 받을 수 없는 단계예요.');
    var item = getItem_(str_(p['현재문항ID']));
    var cache = CacheService.getScriptCache();
    var key = 'PH:' + item.id;
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
    var mode = (item.visual === '그래프' || item.visual === '기하' || item.figure) ? '시각화' : '예시';
    var images = itemImages_(item);
    var cfg = teacherAiConfig_(st.teacherId);
    var out = llmJson_(cfg, {
      system: promptHelpSystem_(), user: promptHelpUser_(item, mode, []) + (images.length ? '\n[첨부 이미지] 문제 이미지(그림·보기 포함)' : ''),
      images: images, maxTokens: 2200, temperature: 0.4
    });
    var fig = (out.figure && Array.isArray(out.figure.elements)) ? out.figure : (mode === '시각화' ? item.figure : null);
    var help = {
      mode: mode, title: String(out.title || '문제를 자세히 살펴봐요'), explanation: String(out.explanation || ''), figure: fig,
      example: out.example && out.example.problem ? { problem: String(out.example.problem), explanation: String(out.example.explanation || '') } : null,
      check: String(out.check_question || '')
    };
    if (!help.explanation && !help.example) throw userError_('AI가 설명을 만들지 못했어요. 잠시 후 다시 눌러 주세요.');
    cache.put(key, JSON.stringify(help), 21600);
    return help;
  });
}

/** 설명을 보고도 이해하지 못함 → 이 문제는 넘어간다(못 풂으로 기록, 이해 단계 오류, 선생님께 알림). */
function api_skipProblem(token, assignmentId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var f = assignmentForStudent_(st, assignmentId);
    var p = getOrCreateProgress_(st, f.a);
    var stage = str_(p['단계']);
    if (UPLOAD_STAGES.indexOf(stage) < 0) throw userError_('지금은 넘어갈 수 없는 단계예요.');
    var item = getItem_(str_(p['현재문항ID']));
    var reason = '[도움 받기] 설명을 보고도 문제를 이해하지 못해 풀지 않고 넘어감';
    var fb = { result: 'wrong', stage: '이해', message: stageInfo_('skip').desc, canNext: true, skipped: true };
    var sub = {
      '제출ID': newId_('SUB'), '학생ID': st.id, '반': st.cls, '과제ID': str_(f.a['과제ID']), '문항ID': item.id, '문항코드': item.code,
      '개념id': item.conceptId, '시도구분': attemptKind_(stage), '시도차수': num_(p['시도횟수'], 0) + 1, '세션ID': str_(p['세션ID']),
      '이해못함': 'Y', '학생최종답': '', '정오': 'X', '주원인': '이해', '판단근거': reason, '상태': '못 풂',
      '학생피드백': JSON.stringify(fb), '제출일시': now_(), '분석일시': now_(), '가상여부': 'N'
    };
    appendObj_(SH.SUBMIT, sub);
    recordOutcome_(st, sub, item, {
      result: 'wrong', primary: '이해',
      errors: [{ line: '', stage: '이해', primary: true, conceptId: '', conceptName: '', category: '문제 이해 못함(학생 응답)', description: reason, evidence: '학생 응답', uncertainty: '', confidence: 1, source: '학생응답' }]
    });
    createHelp_(st, sub, item, '학생이 이 문제를 못 풀어요: 문제를 이해하지 못했어요(도움 설명을 보고도 이해 못함).');
    setProgress_(p, { '단계': 'skip', '상태': '못 풂', '최근제출ID': sub['제출ID'], '교사알림': 'Y', '완료일시': now_() });
    fb.submissionId = sub['제출ID'];
    fb.view = workspaceView_(st, f.a, p, f.index, f.total);
    return fb;
  });
}

function api_markAnswerRead(token, requestId) {
  return wrap_(function () {
    var st = requireStudent_(token);
    var h = getObj_(SH.HELP, requestId);
    if (!h || str_(h['학생ID']) !== st.id) return false;
    updateObj_(SH.HELP, h._row, { '학생확인': 'Y' });
    return true;
  });
}
