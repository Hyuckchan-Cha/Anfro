/* ===================== 교사 API ===================== */

function ownsClass_(t, cls) { return (t.classes || []).indexOf(String(cls)) >= 0; }

function api_teacherHome(token) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var students = rows_(SH.STUDENT);
    var classes = (t.classes || []).map(function (cls) {
      var list = students.filter(function (s) { return str_(s['반']) === cls; });
      return {
        cls: cls, label: classLabel_(cls), count: list.length,
        registered: list.filter(function (s) { return str_(s['가입여부']) === 'Y'; }).length
      };
    });
    var pending = rows_(SH.HELP).filter(function (h) {
      return str_(h['상태']) === '대기' && (str_(h['교사ID']) === t.id || ownsClass_(t, str_(h['반'])));
    }).length;
    var aiReady = !!PropertiesService.getScriptProperties().getProperty(apiKeyProp_(t.id));
    return { profile: t, classes: classes, pending: pending, aiReady: aiReady, school: setting_('학교명') };
  });
}

function api_classStudents(token, cls) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    cls = String(cls);
    if (!ownsClass_(t, cls)) throw userError_('담당 학급이 아니에요.');
    var sums = {};
    rows_(SH.STAGESUM).forEach(function (r) { sums[str_(r['학생ID'])] = r; });
    var progRows = rows_(SH.PROGRESS);
    return rows_(SH.STUDENT).filter(function (s) { return str_(s['반']) === cls; })
      .sort(function (a, b) { return num_(a['번호'], 0) - num_(b['번호'], 0); })
      .map(function (s) {
        var id = str_(s['학생ID']), m = sums[id] || {};
        var sub = num_(m['제출수'], 0), ok = num_(m['정답수'], 0);
        return {
          id: id, num: num_(s['번호'], 0), name: str_(s['이름']), registered: str_(s['가입여부']) === 'Y',
          virtual: str_(s['가상여부']) === 'Y', lastAccess: str_(s['최근접속']), submitted: sub,
          rate: sub ? Math.round(ok * 100 / sub) : null, report: reportProgress_(studentSessionInfo_(s), progRows)
        };
      });
  });
}

function api_resetStudent(token, studentId) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var s = getObj_(SH.STUDENT, studentId);
    if (!s || !ownsClass_(t, str_(s['반']))) throw userError_('학생을 찾을 수 없어요.');
    updateObj_(SH.STUDENT, s._row, { '가입여부': 'N', '비밀번호해시': '', '솔트': '' });
    return true;
  });
}

function helpVisible_(t, h) { return str_(h['교사ID']) === t.id || ownsClass_(t, str_(h['반'])); }

function api_helpList(token) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var names = {};
    rows_(SH.STUDENT).forEach(function (s) { names[str_(s['학생ID'])] = s; });
    return rows_(SH.HELP).filter(function (h) { return helpVisible_(t, h); }).map(function (h) {
      var s = names[str_(h['학생ID'])] || {};
      var it = getItem_(str_(h['문항ID']));
      return {
        requestId: str_(h['요청ID']), status: str_(h['상태']), reason: str_(h['사유']), at: str_(h['요청일시']),
        cls: str_(h['반']), num: num_(s['번호'], 0), name: str_(s['이름']), conceptName: it ? it.conceptName : '',
        answeredAt: str_(h['답변일시'])
      };
    }).sort(function (a, b) {
      if (a.status !== b.status) return a.status === '대기' ? -1 : 1;
      return String(b.at).localeCompare(String(a.at));
    }).slice(0, 300);
  });
}

function api_helpDetail(token, requestId) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var h = getObj_(SH.HELP, requestId);
    if (!h || !helpVisible_(t, h)) throw userError_('요청을 찾을 수 없어요.');
    var s = getObj_(SH.STUDENT, str_(h['학생ID'])) || {};
    var sub = str_(h['제출ID']) ? getObj_(SH.SUBMIT, str_(h['제출ID'])) : null;
    var item = getItem_(str_(h['문항ID']));
    var analysis = sub ? (parseJson_(sub['AI분석'], {}) || {}).outcome || null : null;
    var cands = item ? [{ id: item.conceptId, name: item.conceptName, grade: item.grade }].concat(prereqCandidates_(item.conceptId, { depth: 2, min: 4, limit: 15 })) : [];
    return {
      request: { requestId: str_(h['요청ID']), status: str_(h['상태']), reason: str_(h['사유']), at: str_(h['요청일시']), answer: str_(h['교사답변']), stage: str_(h['교사판정단계']), conceptId: str_(h['교사판정개념id']) },
      student: { id: str_(s['학생ID']), cls: str_(s['반']), num: num_(s['번호'], 0), name: str_(s['이름']) },
      item: item ? Object.assign(JSON.parse(JSON.stringify(item)), item.imageId ? { image: imageDataUrl_(item.imageId) } : {}) : null,
      submission: sub ? {
        aiLines: (parseJson_(sub['AI전사'], { lines: [] }) || {}).lines || [], lines: parseJson_(sub['학생수정본'], []) || [],
        notUnderstood: str_(sub['이해못함']), selfCorrection: str_(sub['자기교정']), studentAnswer: str_(sub['학생최종답']),
        result: str_(sub['정오']), primary: str_(sub['주원인']), at: str_(sub['제출일시'])
      } : null,
      analysis: analysis,
      image: sub ? imageDataUrl_(str_(sub['이미지파일ID'])) : null,
      candidates: cands
    };
  });
}

function api_helpAnswer(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    p = p || {};
    var h = getObj_(SH.HELP, p.requestId);
    if (!h || !helpVisible_(t, h)) throw userError_('요청을 찾을 수 없어요.');
    var answer = String(p.answer || '').trim().slice(0, 3000);
    if (!answer) throw userError_('학생에게 보낼 답변을 입력해 주세요.');
    var stage = String(p.stage || '');
    if (stage && stage !== '정답' && STAGE_ORDER.indexOf(stage) < 0) stage = '';
    var conceptId = String(p.conceptId || '');
    var wasPending = str_(h['상태']) === '대기';
    updateObj_(SH.HELP, h._row, { '상태': '답변완료', '교사답변': answer, '교사판정단계': stage, '교사판정개념id': conceptId, '답변일시': now_(), '학생확인': 'N' });

    var sub = str_(h['제출ID']) ? getObj_(SH.SUBMIT, str_(h['제출ID'])) : null;
    var stRow = getObj_(SH.STUDENT, str_(h['학생ID']));
    if (sub && stRow && stage && wasPending) {
      var st = { id: str_(stRow['학생ID']), cls: str_(stRow['반']), num: str_(stRow['번호']), name: str_(stRow['이름']) };
      var wasHold = str_(sub['정오']) === '보류';
      var item = getItem_(str_(sub['문항ID']));
      updateObj_(SH.SUBMIT, sub._row, { '정오': stage === '정답' ? 'O' : 'X', '주원인': stage === '정답' ? '' : stage, '상태': '교사판정' });
      var patch = {};
      if (wasHold) patch['판단보류'] = -1;
      if (stage === '정답') {
        patch['정답수'] = 1;
        if (item && item.conceptId) recordConcepts_(st, [{ conceptId: item.conceptId, conceptName: item.conceptName, verdict: '이해함', source: '교사판정', reason: '선생님이 정답으로 판정: ' + answer.slice(0, 200), itemId: item.id }]);
      }
      else {
        patch['오답수'] = 1;
        patch['주원인_' + stage] = 1;
        if (stage === '처리기술') patch['처리기술점수'] = 1;
        if (stage === '인코딩') patch['인코딩점수'] = 1;
        var c = conceptId ? conceptInfo_(conceptId) : null;
        appendObj_(SH.ERROR, {
          '오류ID': newId_('E'), '제출ID': str_(sub['제출ID']), '학생ID': st.id, '반': st.cls, '문항ID': item ? item.id : '',
          '문항코드': item ? item.code : '', '줄번호': '', 'Newman단계': stage, '주원인여부': 'Y', '개념id': conceptId,
          '개념명': c ? c.name : '', '오류유형': '교사 판정', '설명': answer.slice(0, 300), '판단근거': '교사 확인', '불확실성': '',
          '확신도': 1, '출처': '교사', '기록일시': now_(), '가상여부': 'N'
        });
        if (conceptId && ['이해', '변형', '처리기술'].indexOf(stage) >= 0) bumpMiscon_(st, [conceptId], { source: '교사판정', reason: '[' + stage + '] ' + answer.slice(0, 200), itemId: item ? item.id : '' });
      }
      if (!wasHold) delete patch['판단보류'];
      bumpStageSum_(st, patch);
      var prog = rows_(SH.PROGRESS).filter(function (x) { return str_(x['학생ID']) === st.id && str_(x['과제ID']) === str_(sub['과제ID']); })[0];
      if (prog && str_(prog['단계']) === 'hold') setProgress_(prog, { '단계': 'done', '상태': '완료', '완료일시': now_() });
    }
    return true;
  });
}

/* ---------- 설정 ---------- */
function maskKey_(k) { return k ? '설정됨 (…' + String(k).slice(-4) + ')' : '미설정'; }

function api_teacherSettings(token) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var row = getObj_(SH.TEACHER, t.id);
    var key = PropertiesService.getScriptProperties().getProperty(apiKeyProp_(t.id));
    var model = str_(row['모델']);
    if (!/^(gpt|o\d|chatgpt)/i.test(model)) model = PROVIDERS.openai.defaultModel;
    return {
      provider: 'openai', model: model,
      keyStatus: maskKey_(key), providers: PROVIDERS, loginId: str_(row['로그인ID']),
      baseUrl: aiBaseUrl_(t.id), defaultBaseUrl: DEFAULT_AI_BASE_URL
    };
  });
}

function api_saveTeacherSettings(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    p = p || {};
    var provider = 'openai';
    // 보낸 항목만 바꾼다(모델을 안 보내면 저장된 모델 유지, 빈 값이면 기본 모델).
    var model = p.model === undefined ? str_(getObj_(SH.TEACHER, t.id)['모델']) : String(p.model || '').trim().slice(0, 80);
    if (!model) model = PROVIDERS.openai.defaultModel;
    var props = PropertiesService.getScriptProperties();
    if (p.baseUrl !== undefined) {
      var base = String(p.baseUrl || '').trim().replace(/\/+$/, '');
      if (!base) props.deleteProperty(baseUrlProp_(t.id));
      else if (!/^https:\/\/[^\s]+$/.test(base) || base.length > 300) throw userError_('API 주소는 https:// 로 시작해야 해요.');
      else props.setProperty(baseUrlProp_(t.id), base);
    }
    var key = String(p.apiKey || '').trim();
    if (key === '__DELETE__') props.deleteProperty(apiKeyProp_(t.id));
    else if (key) {
      if (key.length < 15 || key.length > 400 || /\s/.test(key)) throw userError_('API 키 형식을 확인해 주세요.');
      props.setProperty(apiKeyProp_(t.id), key);
    }
    var saved = props.getProperty(apiKeyProp_(t.id));
    updateObj_(SH.TEACHER, t.id, { 'AI제공자': provider, '모델': model, 'API키상태': maskKey_(saved), '수정일시': now_() });
    return { keyStatus: maskKey_(saved), provider: provider, model: model, baseUrl: aiBaseUrl_(t.id) };
  });
}

function api_testAi(token) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var cfg = teacherAiConfig_(t.id);
    var out = llmJson_(cfg, { system: '너는 연결 확인용 도우미다. JSON으로만 답한다.', user: '{"ok": true, "message": "연결 성공"} 을 그대로 JSON으로 출력하라.', maxTokens: 100, temperature: 0 });
    return { ok: !!out.ok, provider: cfg.provider, model: cfg.model };
  });
}

/* ---------- 문제 출제 ---------- */
function api_problemBank(token, f) {
  return wrap_(function () {
    requireTeacher_(token);
    f = f || {};
    var idx = itemInfoIndex_(), cm = conceptMap_();
    var gradeSet = {};
    Object.keys(idx.codes).forEach(function (c) { if (idx.codes[c].grade) gradeSet[idx.codes[c].grade] = 1; });
    var grades = Object.keys(gradeSet).sort(function (a, b) { return gradeRank_(a) - gradeRank_(b); });
    var grade = f.grade || (gradeSet['중3'] ? '중3' : grades[grades.length - 1] || '');
    var made = {};
    var imgFor = {};
    allItems_().forEach(function (it) {
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
  });
}

function api_generateForCode(token, code) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    // 문제 이미지가 있는 문항코드는 AI 생성 없이 이미지 문항을 그대로 쓴다(API 키도 필요 없음).
    var img = imageItemForCode_(String(code));
    if (img) return img;
    var cfg = teacherAiConfig_(t.id);
    return generateItemForCode_(cfg, String(code), null);
  });
}

function api_itemDetail(token, itemId) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var it = getItem_(itemId);
    if (!it) throw userError_('문항을 찾을 수 없어요.');
    var note = '';
    // 아직 정답을 만들지 않은 이미지 문항은 미리보기를 열 때 AI가 풀어 둔다(교사가 바로 확인할 수 있게).
    if (it.imageId && !it.answer) {
      try { it = ensureImageSolved_(teacherAiConfig_(t.id), it); } catch (e) { note = '정답을 아직 만들지 못했어요: ' + e.message; }
    }
    var out = JSON.parse(JSON.stringify(it));
    if (it.imageId) out.image = imageDataUrl_(it.imageId);
    out.note = note;
    return out;
  });
}

/** 교사가 이미지 문항의 정답을 확인·수정한다. */
function api_saveItemAnswer(token, p) {
  return wrap_(function () {
    requireTeacher_(token);
    p = p || {};
    var it = getItem_(String(p.itemId || ''));
    if (!it) throw userError_('문항을 찾을 수 없어요.');
    var answer = String(p.answer || '').trim().slice(0, 300);
    if (!answer) throw userError_('정답을 입력해 주세요.');
    updateObj_(SH.ITEM, it.id, { '정답': answer, '정답확인': '확인됨' });
    forget_('item:' + it.id);
    forget_('allItems');
    return { answer: answer, answerCheck: '확인됨' };
  });
}

function api_assignments(token) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var cm = conceptMap_();
    return rows_(SH.ASSIGN).filter(function (a) { return str_(a['교사ID']) === t.id; })
      .sort(function (a, b) { return num_(a['순서'], 999) - num_(b['순서'], 999); })
      .map(function (a) {
        var it = getItem_(str_(a['문항ID']));
        return {
          assignmentId: str_(a['과제ID']), order: num_(a['순서'], 0), classes: str_(a['대상반']), visible: str_(a['공개']) !== 'N',
          item: it ? { id: it.id, code: it.code, conceptName: it.conceptName, unit: String((cm[it.conceptId] || {}).unit || '').split('>')[0].trim(), preview: it.text ? previewText_(it.text, 80) : (it.imageId ? '(그림으로 된 문제)' : ''), source: it.source } : null
        };
      });
  });
}

function api_assign(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    p = p || {};
    var ids = (p.itemIds || []).map(String).filter(String);
    var classes = (p.classes || []).map(String).filter(function (c) { return ownsClass_(t, c); });
    if (!ids.length) throw userError_('출제할 문제를 골라 주세요.');
    if (!classes.length) throw userError_('대상 학급을 골라 주세요.');
    return withLock_(function () {
      var mine = rows_(SH.ASSIGN).filter(function (a) { return str_(a['교사ID']) === t.id; });
      var order = mine.reduce(function (m, a) { return Math.max(m, num_(a['순서'], 0)); }, 0);
      var rows = ids.filter(function (id) { return !!getItem_(id); }).map(function (id) {
        order++;
        return { '과제ID': newId_('A'), '교사ID': t.id, '대상반': classes.join(','), '문항ID': id, '순서': order, '공개': 'Y', '출제일시': now_() };
      });
      appendObjs_(SH.ASSIGN, rows);
      return rows.length;
    });
  });
}

/** 여러 과제의 상태를 한 번에: 과제 기간(학생에게 보임) / 과제 종료(학생 목록에서 빠짐) */
function api_setAssignmentsStatus(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    p = p || {};
    var ids = {};
    (p.ids || []).forEach(function (id) { ids[String(id)] = true; });
    var val = p.status === 'ended' ? 'N' : 'Y';
    return withLock_(function () {
      var n = 0;
      rows_(SH.ASSIGN).forEach(function (a) {
        if (str_(a['교사ID']) !== t.id || !ids[str_(a['과제ID'])]) return;
        if (str_(a['공개']) !== val) updateObj_(SH.ASSIGN, a._row, { '공개': val });
        n++;
      });
      return n;
    });
  });
}

/** 출제 목록에서 여러 문제를 한 번에 뺀다(아래 행부터 지워 행 번호가 밀리지 않게). */
function api_removeAssignments(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    var ids = {};
    ((p && p.ids) || []).forEach(function (id) { ids[String(id)] = true; });
    return withLock_(function () {
      var rows = rows_(SH.ASSIGN).filter(function (a) { return str_(a['교사ID']) === t.id && ids[str_(a['과제ID'])]; })
        .sort(function (a, b) { return b._row - a._row; });
      var sh = sheet_(SH.ASSIGN);
      rows.forEach(function (a) { sh.deleteRow(a._row); });
      return rows.length;
    });
  });
}

function api_updateAssignment(token, p) {
  return wrap_(function () {
    var t = requireTeacher_(token);
    p = p || {};
    return withLock_(function () {
      var mine = rows_(SH.ASSIGN).filter(function (a) { return str_(a['교사ID']) === t.id; })
        .sort(function (a, b) { return num_(a['순서'], 999) - num_(b['순서'], 999); });
      var i = -1;
      mine.forEach(function (a, k) { if (str_(a['과제ID']) === String(p.assignmentId)) i = k; });
      if (i < 0) throw userError_('출제 항목을 찾을 수 없어요.');
      var a = mine[i];
      if (p.action === 'toggle') updateObj_(SH.ASSIGN, a._row, { '공개': str_(a['공개']) === 'N' ? 'Y' : 'N' });
      else if (p.action === 'delete') sheet_(SH.ASSIGN).deleteRow(a._row);
      else if (p.action === 'move') {
        // 끌어다 놓기: 지정한 자리(0부터)로 옮기고 순서를 1부터 다시 매긴다.
        var to = Math.max(0, Math.min(mine.length - 1, parseInt(p.to, 10) || 0));
        var moved = mine.splice(i, 1)[0];
        mine.splice(to, 0, moved);
        mine.forEach(function (x, k) { if (num_(x['순서'], 0) !== k + 1) updateObj_(SH.ASSIGN, x._row, { '순서': k + 1 }); });
      }
      else if (p.action === 'up' || p.action === 'down') {
        var j = p.action === 'up' ? i - 1 : i + 1;
        if (j >= 0 && j < mine.length) {
          mine.forEach(function (x, k) { x._order = k + 1; });
          var tmp = mine[i]._order; mine[i]._order = mine[j]._order; mine[j]._order = tmp;
          updateObj_(SH.ASSIGN, mine[i]._row, { '순서': mine[i]._order });
          updateObj_(SH.ASSIGN, mine[j]._row, { '순서': mine[j]._order });
        }
      }
      return true;
    });
  });
}
