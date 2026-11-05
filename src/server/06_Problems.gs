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
function publicItemFull_(it) {
  var v = publicItem_(it);
  if (v && it.imageId) v.image = imageDataUrl_(it.imageId);
  return v;
}

/** AI 호출에 붙일 문제 이미지 */
function itemImages_(it) {
  if (!it || !it.imageId) return [];
  try {
    var blob = DriveApp.getFileById(it.imageId).getBlob();
    return [{ mime: blob.getContentType() || 'image/png', base64: Utilities.base64Encode(blob.getBytes()) }];
  } catch (e) {
    return [];
  }
}

/* ---------- 문제 이미지(중3_문제이미지 폴더) ---------- */

function problemImageFolder_() {
  var v = str_(setting_('문제이미지폴더')).trim() || '중3_문제이미지';
  try { return DriveApp.getFolderById(v); } catch (e) { /* 이름으로 찾기 */ }
  var it = DriveApp.getFoldersByName(v);
  return it.hasNext() ? it.next() : null;
}

/**
 * 폴더의 '문항코드.png'를 문항리스트에 연결한다. 문항ID는 'IMG-문항코드'로 고정해
 * 여러 번 실행해도 중복이 생기지 않는다. 정답·풀이는 처음 쓸 때 AI가 이미지를 풀어 채운다.
 */
function linkProblemImages_() {
  var folder = problemImageFolder_();
  if (!folder) return { found: false, linked: 0, created: 0 };
  var have = {};
  rows_(SH.ITEM).forEach(function (r) { have[str_(r['문항ID'])] = r; });
  var add = [], linked = 0, files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var m = String(f.getName()).match(/^([A-Z]\d{9})\.(png|jpe?g|webp)$/i);
    if (!m) continue;
    var code = m[1].toUpperCase(), id = 'IMG-' + code;
    var spec = specForCode_(code);
    if (!spec) continue;
    linked++;
    var row = have[id];
    if (row) {
      if (str_(row['문제이미지ID']) !== f.getId()) updateObj_(SH.ITEM, row._row, { '문제이미지ID': f.getId() });
      continue;
    }
    add.push({
      '문항ID': id, '문항코드': code, '개념id': spec.conceptId, '개념명': spec.conceptName, '학년': spec.grade,
      '난이도': num_(spec.diff, 0), '문제': '', '정답': '', '풀이단계': '[]', '그림스펙': '', '문항유형': '풀이분석',
      '시각화유형': '없음', '생성방식': '문제이미지', '참고문항ID': '', '생성일시': now_(), '문제이미지ID': f.getId(), '보기': '[]', '정답확인': ''
    });
  }
  if (add.length) appendObjs_(SH.ITEM, add);
  forget_('allItems');
  return { found: true, linked: linked, created: add.length };
}

/**
 * 이미지 문항은 정답지가 없으므로 처음 쓸 때 AI가 이미지를 읽고 풀어 문제 글·보기·정답·풀이를 저장한다.
 * 저장한 정답은 '확인필요'로 표시하고, 교사가 문항 미리보기에서 확인·수정한다.
 */
function ensureImageSolved_(cfg, item) {
  if (!item || !item.imageId || (item.answer && item.text && item.steps && item.steps.length)) return item;
  var images = itemImages_(item);
  if (!images.length) return item;
  var out = llmJson_(cfg, {
    system: promptImageSolveSystem_(), user: promptImageSolveUser_(item), images: images,
    maxTokens: 4000, temperature: 0, effort: 'high'
  });
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
  updateObj_(SH.ITEM, item.id, patch);
  forget_('item:' + item.id);
  forget_('allItems');
  return getItem_(item.id);
}

/** 시트 메뉴: 아직 풀지 않은 이미지 문항의 정답을 미리 만든다(6분 제한 때문에 나눠서 실행). */
function solveImagesBatch_() {
  var t = rows_(SH.TEACHER).filter(function (r) { return PropertiesService.getScriptProperties().getProperty(apiKeyProp_(str_(r['교사ID']))); })[0];
  if (!t) throw userError_('API 키를 등록한 선생님이 없어요. 웹앱 교사 설정에서 API 키를 먼저 넣어 주세요.');
  var cfg = teacherAiConfig_(str_(t['교사ID']));
  var start = Date.now(), done = 0, failed = 0;
  var todo = allItems_().filter(function (it) { return it.imageId && !it.answer; });
  for (var i = 0; i < todo.length; i++) {
    if (Date.now() - start > 4.5 * 60 * 1000) break;
    try { ensureImageSolved_(cfg, todo[i]); done++; } catch (e) { failed++; }
  }
  var left = allItems_().filter(function (it) { return it.imageId && !it.answer; }).length;
  return '이번에 ' + done + '문항의 정답·풀이를 만들었어요' + (failed ? ' (실패 ' + failed + '개)' : '') + '.\n남은 문항: ' + left + '개' +
    (left ? '\n메뉴를 한 번 더 실행하면 이어서 만들어요.' : '\n모두 끝났어요. 교사 화면 [문제 출제 › 보기]에서 정답을 확인해 주세요.');
}

function getItem_(itemId) {
  if (!itemId) return null;
  var key = 'item:' + itemId;
  return memo_(key, function () { return itemView_(getObj_(SH.ITEM, itemId)); });
}

function allItems_() { return memo_('allItems', function () { return rows_(SH.ITEM).map(itemView_); }); }

function saveItem_(spec, gen, ref, source) {
  var obj = {
    '문항ID': newId_('Q'), '문항코드': spec.code, '개념id': spec.conceptId, '개념명': spec.conceptName, '학년': spec.grade,
    '난이도': num_(spec.diff, 0), '문제': gen.problem, '정답': gen.answer, '풀이단계': JSON.stringify(gen.steps || []),
    '그림스펙': gen.figure ? JSON.stringify(gen.figure) : '', '문항유형': gen.type, '시각화유형': gen.visual,
    '생성방식': source || 'AI생성', '참고문항ID': ref ? ref.id : '', '생성일시': now_()
  };
  appendObj_(SH.ITEM, obj);
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

function specForCode_(code) {
  var info = itemInfoIndex_().codes[code];
  if (!info) return null;
  var c = conceptMap_()[info.conceptId] || {};
  return {
    code: code, conceptId: info.conceptId, conceptName: info.conceptName || c.name || '', grade: info.grade || c.grade || '',
    unit: c.unit || '', std: info.std || c.std || '', desc: info.desc || c.desc || '', diff: info.diff
  };
}

function specForConcept_(conceptId, diff, code) {
  var c = conceptInfo_(conceptId);
  if (!c) throw new Error('개념 ' + conceptId + '의 정보를 찾을 수 없어요.');
  return { code: code || ('AI-' + conceptId), conceptId: String(conceptId), conceptName: c.name, grade: c.grade, unit: c.unit, std: c.std, desc: c.desc, diff: diff };
}

/** AI로 문항을 만들어 문항리스트에 저장 */
function generateItem_(cfg, spec, ref) {
  var existing = allItems_().filter(function (it) { return it.code === spec.code; }).slice(-3).map(function (it) { return it.text; });
  var out = llmJson_(cfg, {
    system: promptGenerateSystem_(), user: promptGenerateUser_(spec, ref, existing), maxTokens: 2500, temperature: 0.7
  });
  return saveItem_(spec, normalizeGenerated_(out), ref, 'AI생성');
}

function generateItemForCode_(cfg, code, ref) {
  var img = imageItemForCode_(code);
  if (img) return img;
  var spec = specForCode_(code);
  if (!spec) throw userError_('문항코드 ' + code + '을(를) 문항정보 시트에서 찾을 수 없어요.');
  return generateItem_(cfg, spec, ref);
}

function imageItemForCode_(code) {
  return allItems_().filter(function (it) { return it.code === String(code) && it.imageId; })[0] || null;
}

/** 풀이 단계가 없으면 만들어 저장 (유도질문에 필요) */
function ensureSteps_(cfg, item) {
  item = ensureImageSolved_(cfg, item);
  if (item.steps && item.steps.length && item.answer) return item;
  var out = llmJson_(cfg, {
    system: promptStepsSystem_(),
    user: '[학년] ' + item.grade + '\n[개념] ' + item.conceptName + '\n[문제] ' + item.text + (item.answer ? '\n[정답] ' + item.answer : '') + '\n정답과 풀이 단계를 JSON으로 출력하라.',
    maxTokens: 1500
  });
  var steps = Array.isArray(out.steps) ? out.steps.map(String).filter(String).slice(0, 8) : [];
  item.steps = steps;
  if (!item.answer) item.answer = String(out.answer || '');
  updateObj_(SH.ITEM, item.id, { '풀이단계': JSON.stringify(steps), '정답': item.answer });
  forget_('item:' + item.id);
  return item;
}

/** 학생이 이미 본 문항 (풀이기록 + 학습세션) */
function seenItemIds_(studentId) {
  var seen = {};
  rows_(SH.SUBMIT).forEach(function (s) { if (str_(s['학생ID']) === studentId) seen[str_(s['문항ID'])] = true; });
  var sessions = {};
  rows_(SH.SESSION).forEach(function (s) {
    if (str_(s['학생ID']) !== studentId) return;
    sessions[str_(s['세션ID'])] = true;
    sessionItemIds_(s).forEach(function (id) { seen[id] = true; });
  });
  // 예전 세션은 끝난 프레임에 문항ID를 남기지 않았다: 채팅로그의 문항ID로 보충한다.
  rows_(SH.CHAT).forEach(function (c) { if (sessions[str_(c['세션ID'])] && str_(c['문항ID'])) seen[str_(c['문항ID'])] = true; });
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
function tutorItemIdsFor_(studentId, assignmentId) {
  var ids = [], sesIds = {};
  rows_(SH.SESSION).forEach(function (s) {
    if (str_(s['학생ID']) !== String(studentId) || str_(s['과제ID']) !== String(assignmentId)) return;
    sesIds[str_(s['세션ID'])] = true;
    sessionItemIds_(s).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
  });
  rows_(SH.CHAT).forEach(function (c) {
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
function pickSimilarForConcept_(cfg, conceptId, targetDiff, exclude, ref) {
  conceptId = String(conceptId);
  targetDiff = num_(targetDiff, 0);
  exclude = exclude || {};
  var near = nearDiff_(allItems_().filter(function (it) { return it.conceptId === conceptId && !exclude[it.id]; }), targetDiff);
  var imgs = near.filter(function (it) { return it.imageId; });
  if (imgs.length) return imgs[0];
  if (near.length) return near[0];
  var idx = itemInfoIndex_();
  var codes = (idx.byConcept[conceptId] || []).slice();
  codes.sort(function (a, b) { return Math.abs(idx.codes[a].diff - targetDiff) - Math.abs(idx.codes[b].diff - targetDiff); });
  var useRef = ref && ref.conceptId === conceptId ? ref : null;
  if (codes.length) {
    var spec = specForCode_(codes[0]);
    if (Math.abs(num_(spec.diff, 0) - targetDiff) > DIFF_TOL) spec.diff = targetDiff;
    return generateItem_(cfg, spec, useRef);
  }
  return generateItem_(cfg, specForConcept_(conceptId, targetDiff), null);
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
function pickInRange_(cfg, conceptId, rg, exclude, ref, opt) {
  conceptId = String(conceptId);
  exclude = exclude || {};
  opt = opt || {};
  var avoid = opt.avoidCodes || {};
  var inRange = function (d) { return d >= rg.lo - 1e-9 && d <= rg.hi + 1e-9; };
  var byTarget = function (a, b) { return Math.abs(a.diff - rg.target) - Math.abs(b.diff - rg.target); };
  var pool = allItems_().filter(function (it) { return it.conceptId === conceptId && !exclude[it.id] && inRange(it.diff); }).sort(byTarget);
  var fresh = pool.filter(function (it) { return !avoid[it.code]; });
  var prefer = function (list) {
    return list.filter(function (it) { return it.imageId; })[0] ||
      (opt.code ? list.filter(function (it) { return it.code === opt.code; })[0] : null) || list[0] || null;
  };
  var hit = prefer(fresh);
  if (hit) return hit;
  var idx = itemInfoIndex_();
  var codes = (idx.byConcept[conceptId] || []).map(function (c) { return { code: c, diff: num_(idx.codes[c].diff, 0) }; }).sort(byTarget);
  var useRef = ref && ref.conceptId === conceptId ? ref : null;
  var codeIn = codes.filter(function (c) { return inRange(c.diff) && !avoid[c.code]; })[0] ||
    (pool.length ? null : codes.filter(function (c) { return inRange(c.diff); })[0]);
  if (!codeIn && pool.length) return prefer(pool); // 범위 안의 문항은 있지만 피하려던 코드뿐이면 그것이라도 쓴다
  if (codeIn) {
    var img = imageItemForCode_(codeIn.code);
    if (img && !exclude[img.id]) return img;
    return generateItem_(cfg, specForCode_(codeIn.code), useRef);
  }
  var clampT = Math.max(rg.lo, Math.min(rg.hi, rg.target));
  var other = codes.filter(function (c) { return !avoid[c.code]; })[0] || codes[0];
  if (other) {
    var spec = specForCode_(other.code);
    spec.diff = clampT;
    return generateItem_(cfg, spec, useRef);
  }
  return generateItem_(cfg, specForConcept_(conceptId, clampT), null);
}

/** 오개념 학습(1단계)용: 같은 개념에서 처음 문제보다 쉬운 문제 */
function pickEasierForConcept_(cfg, conceptId, baseDiff, exclude, ref) {
  return pickInRange_(cfg, conceptId, rangeFor_(baseDiff, EASIER_RANGE), exclude, ref, {});
}

/**
 * 3단계 확인 문제: 같은 개념에서 처음 문제와 비슷하거나 조금 어려운 새 문제.
 * 이미 본 문항(처음 문제·1단계에서 푼 문제 포함)은 빼고, 1단계에서 푼 문제와 같은 문항코드도 되도록 피한다.
 */
function pickNewForCode_(cfg, item, exclude, avoidItemIds) {
  exclude = Object.assign({}, exclude || {});
  exclude[item.id] = true;
  var avoidCodes = {};
  (avoidItemIds || []).forEach(function (id) {
    exclude[id] = true;
    var it = getItem_(id);
    if (it && it.code) avoidCodes[it.code] = true;
  });
  return pickInRange_(cfg, item.conceptId, rangeFor_(item.diff, CHECK_RANGE), exclude, item, { code: item.code, avoidCodes: avoidCodes });
}
