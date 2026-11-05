/* ===================== 학생 화면 ===================== */
var W = {};   // 지금 풀고 있는 문제(작업 공간) 상태
var T = {};   // 유도질문 채팅 상태

function openStudentSettings() {
  openModal({
    title: '설정',
    body: h('div', null,
      h('div', { class: 'kv', style: { marginBottom: '12px' } },
        h('div', { class: 'k' }, '학번'), h('div', null, S.profile.id),
        h('div', { class: 'k' }, '이름'), h('div', null, S.profile.name),
        h('div', { class: 'k' }, '학급'), h('div', null, S.profile.classLabel || classLabel(S.profile.cls))),
      passwordForm()),
    actions: [{ label: '로그아웃', danger: true, onClick: function (c) { c(); logout(); } }, { label: '닫기', primary: true }]
  });
}

/** 과제를 모두 마치면 열리는 [리포트 받아보기] */
function reportButton() {
  var r = S.report || {};
  // 과제를 다 마치기 전에는 회색, 다 마치면 빨간색으로 눈에 띄게
  return h('button', { class: 'btn sm report-btn' + (r.ready ? ' ready' : ''), id: 'reportBtn', disabled: !r.ready, onclick: renderStudentReport,
    title: r.ready ? '' : '과제를 모두 마치면 받아볼 수 있어요' }, '리포트 받아보기');
}

function studentTopbar(left) {
  return topbar(left || reportButton(),
    (S.profile.classLabel || '') + ' ' + (S.profile.name || ''), settingsButton(openStudentSettings));
}

/* 문제 상태: 푸는 중 / 풀이 완료(완료·선생님 확인 중·못 풂) / 아직 안 푼 문제 */
function itemGroup_(it) {
  if (it.status === '완료' || it.status === '보류' || it.status === '못 풂') return 'done';
  if (it.status === '진행중') return 'doing';
  return 'todo';
}

function statusBadge(it) {
  var g = itemGroup_(it), b = [];
  if (g === 'doing') b.push(h('span', { class: 'badge doing' }, '푸는 중'));
  else if (g === 'done') b.push(h('span', { class: 'badge done' }, '풀이 완료'));
  if (it.teacherAnswered) b.push(h('span', { class: 'badge note' }, '선생님 답변'));
  return b.length ? h('div', { class: 'item-badges' }, b) : null;
}

/* 홈 화면 인사: 들어올 때마다 차례로 바꿔 보여 준다(이 기기에 순서를 기억) */
var GREETINGS = ['오늘도 한 문제씩 풀어 봐요', '틀려도 괜찮아요, 어디서 헷갈렸는지 함께 찾아봐요', '천천히 끝까지 생각하면 꼭 풀 수 있어요'];
var greetIdx = -1;
function nextGreeting_() {
  var i = greetIdx;
  try { i = parseInt(localStorage.getItem('mdx_greet') || '-1', 10); } catch (e) { /* 무시 */ }
  i = ((isNaN(i) ? -1 : i) + 1) % GREETINGS.length;
  greetIdx = i;
  try { localStorage.setItem('mdx_greet', String(i)); } catch (e) { /* 무시 */ }
  return GREETINGS[i];
}

function itemCard_(it) {
  var g = itemGroup_(it);
  return h('div', { class: 'item-card ' + g, onclick: function () { openWorkspace(it.assignmentId); } },
    h('div', { class: 'item-no' }, String(it.no)),
    h('div', { class: 'item-body' }, h('div', { class: 'item-title', html: richHtml(it.conceptName) })),
    statusBadge(it));
}

function renderStudentHome() {
  var page = h('div', { class: 'page' });
  setApp(h('div', null, studentTopbar(), page));
  page.appendChild(inlineLoad('문제 목록을 불러오고 있어요…'));
  api('api_studentHome', S.token).then(function (d) {
    page.innerHTML = '';
    S.report = d.report;
    var rb = $('#reportBtn');
    if (rb) rb.parentNode.replaceChild(reportButton(), rb);
    // 머리: 인사 + 과제 진행 카드
    var rp = d.report || {};
    var hero = h('div', { class: 'home-hero' },
      h('div', { class: 'home-hero-copy' },
        h('div', { class: 'eyebrow' }, (d.profile.classLabel || '') + (d.profile.num ? ' · ' + d.profile.num + '번' : '')),
        h('h1', { class: 'display-md' }, (d.profile.name ? d.profile.name + ' 학생,' : '안녕하세요,'), h('br'), nextGreeting_())));
    if (rp.total) {
      hero.appendChild(h('div', { class: 'progress-card' + (rp.ready ? ' done' : '') },
        h('div', { class: 'eyebrow' }, '과제 진행'),
        h('div', { class: 'progress-num' }, String(rp.done), h('small', null, '/ ' + rp.total)),
        h('div', { class: 'progress-bar' }, h('div', { style: { width: Math.round(rp.done * 100 / rp.total) + '%' } })),
        h('div', { class: 'progress-msg' }, rp.ready ? '과제를 모두 마쳤어요! 위의 [리포트 받아보기]로 나의 학습 리포트를 확인해 보세요.' : '과제를 모두 마치면 [리포트 받아보기]가 열려요.')));
    }
    page.appendChild(hero);
    if (!d.items.length) { page.appendChild(h('div', { class: 'section-title' }, '남은 문제')); page.appendChild(h('div', { class: 'notice' }, '아직 출제된 문제가 없어요.')); return; }

    // 순서: 푸는 중 → 안 푼 문제 → 풀이 완료(접어 둠). 각각 번호 순.
    var byNo = function (a, b) { return a.no - b.no; };
    var doing = d.items.filter(function (it) { return itemGroup_(it) === 'doing'; }).sort(byNo);
    var todo = d.items.filter(function (it) { return itemGroup_(it) === 'todo'; }).sort(byNo);
    var done = d.items.filter(function (it) { return itemGroup_(it) === 'done'; }).sort(byNo);
    var left = doing.concat(todo);
    page.appendChild(h('div', { class: 'section-title' }, '남은 문제 ', h('span', { class: 'count' }, String(left.length))));
    if (left.length) page.appendChild(h('div', { class: 'list' }, left.map(itemCard_)));
    else page.appendChild(h('div', { class: 'notice' }, '남은 문제가 없어요. 수고했어요!'));

    if (done.length) {
      var open = false;
      try { open = localStorage.getItem('mdx_doneOpen') === '1'; } catch (e) { /* 무시 */ }
      var doneList = h('div', { class: 'list done-list' }, done.map(itemCard_));
      var arrow = h('span', { class: 'fold-arrow' }, '▾');
      var toggle = h('button', { class: 'fold-head', type: 'button', 'aria-expanded': String(open) },
        h('span', null, '풀이 완료 ', h('span', { class: 'count' }, String(done.length))), h('span', { class: 'fold-label' }, open ? '접기' : '펼치기'), arrow);
      var apply = function () {
        doneList.style.display = open ? '' : 'none';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.classList.toggle('open', open);
        toggle.querySelector('.fold-label').textContent = open ? '접기' : '펼치기';
      };
      toggle.onclick = function () { open = !open; try { localStorage.setItem('mdx_doneOpen', open ? '1' : '0'); } catch (e) { /* 무시 */ } apply(); };
      apply();
      page.appendChild(h('div', { class: 'fold' }, toggle, doneList));
    }
  }).catch(function (e) { page.innerHTML = ''; page.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/** 문제 이미지가 있으면 이미지를, 없으면 글로 된 문제를 보여 준다. */
function problemBody(p) {
  if (p.image) {
    // 휴대폰에서는 이미지가 작아 보이므로 누르면 원래 크기로 크게 본다(화면 확대가 막혀 있어서).
    var zoom = function () {
      openModal({ title: '문제 크게 보기', wide: true, body: h('div', { class: 'problem-zoom' }, h('img', { src: p.image, alt: '문제 이미지' })) });
    };
    return h('div', { class: 'problem-img-wrap', onclick: zoom, title: '눌러서 크게 보기' },
      h('img', { class: 'problem-img', src: p.image, alt: '문제 이미지' }),
      h('div', { class: 'zoom-hint' }, '🔍 눌러서 크게 보기'));
  }
  if (p.hasImage) return h('div', { class: 'muted' }, '문제 이미지를 불러오지 못했어요. 새로고침해 주세요.');
  return h('div', { class: 'problem-text', html: richHtml(p.text) });
}

function openWorkspace(assignmentId) {
  showLoading('문제를 불러오고 있어요…');
  api('api_openProblem', S.token, assignmentId).then(function (v) { hideLoading(); renderWorkspace(v); })
    .catch(function (e) { hideLoading(); toast(e.message, 'err'); });
}

function problemCard(p, tag) {
  var card = h('div', { class: 'problem-card' },
    h('div', { class: 'problem-head' }, tag ? h('span', { class: 'badge orange' }, tag) : null, h('span', { class: 'badge blue', html: richHtml(p.conceptName) })),
    problemBody(p));
  if (p.figure) { var f = renderFigure(p.figure); if (f) card.appendChild(h('div', { class: 'figure-box' }, f)); }
  return card;
}

function renderWorkspace(view, opt) {
  opt = opt || {};
  W = { view: view, assignmentId: view.assignmentId, sub: view.latest, photo: null, busy: false };
  var saved = loadDrawing_();
  if (saved) { W.drawStrokes = saved.strokes; W.drawn = saved.sent; }
  var page = h('div', { class: 'page' });
  setApp(h('div', null, studentTopbar(h('button', { class: 'btn sm', onclick: renderStudentHome }, '← 목록')), page));
  page.appendChild(h('div', { class: 'section-title' }, '문제 ' + view.no + ' / ' + view.total));
  var stage = view.progress.stage;
  if (stage !== 'solve') page.appendChild(h('div', { class: 'notice' }, h('b', null, view.stageInfo.label), ' · ', view.stageInfo.desc));
  (view.teacherAnswers || []).forEach(function (a) {
    page.appendChild(h('div', { class: 'help-card', style: { marginBottom: '12px' } }, h('div', { class: 'panel-title' }, '👩‍🏫 선생님 답변 ', h('span', { class: 'muted small' }, a.at)), h('div', { html: richHtml(a.text) })));
    api('api_markAnswerRead', S.token, a.requestId).catch(function () { });
  });
  if (view.original) {
    var det = h('details', { style: { marginBottom: '10px' } }, h('summary', { class: 'muted small' }, '처음 문제 보기'), problemCard(view.original));
    page.appendChild(det);
  }
  page.appendChild(problemCard(view.problem, stage === 'apply' ? '3단계 새 문제' : (stage === 'regress' ? '2단계 다시 풀기' : '')));

  if (stage === 'tutor') {
    var tb = h('div');
    page.appendChild(tb);
    startOrLoadTutor(tb, view);
    return;
  }
  var resultBox = h('div', { id: 'resultBox' });
  if (stage === 'skip') {
    page.appendChild(resultBox);
    resultBox.appendChild(h('div', { class: 'result wrong' }, h('div', { class: 'big' }, '🙋 ' + view.stageInfo.desc),
      h('div', { class: 'muted' }, '선생님이 답변해 주시면 이 화면에서 볼 수 있어요.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn ok', onclick: goNext }, '다음 문제 →'))));
    return;
  }
  if (stage === 'done' || stage === 'hold') {
    page.appendChild(resultBox);
    if (view.latest && view.latest.feedback) showFeedback(view.latest.feedback, true);
    else {
      resultBox.appendChild(h('div', { class: 'result ' + (stage === 'done' ? 'correct' : 'hold') }, h('div', { class: 'big' }, stage === 'done' ? '🎉 이 문제를 마쳤어요!' : '👩‍🏫 ' + view.stageInfo.desc), h('div', { class: 'actions' }, h('button', { class: 'btn ok', onclick: goNext }, '다음 문제 →'))));
    }
    return;
  }
  page.appendChild(understandBox());
  W.helpBox = h('div', { id: 'helpBox' });
  page.appendChild(W.helpBox);
  var keptHelp = PROBLEM_HELP[helpKey_()];
  if (keptHelp) drawProblemHelp(keptHelp.help, keptHelp.answered);
  page.appendChild(h('div', { class: 'work' }, photoPanel(), editorPanel()));
  page.appendChild(resultBox);
  if (view.latest) {
    var aiMap = view.latest.aiLines || [];
    var lines = view.latest.lines.map(function (l, i) {
      var a = aiMap[i];
      return { text: l.text, uncertain: !view.latest.analyzed && a && a.uncertain && a.text === l.text, reason: a ? a.reason : '' };
    });
    renderEditor(lines, view.latest.unreadable);
    if (view.latest.hasImage) {
      api('api_myImage', S.token, view.latest.submissionId).then(function (url) { if (url && W.view === view) { W.photo = url; drawPhotoArea(); } }).catch(function () { });
    }
    if (view.latest.analyzed && view.latest.feedback && !opt.retry) showFeedback(view.latest.feedback, true);
  }
}

/** 선택 사항: 문제를 이해하지 못했을 때만 누른다. 다시 누르면 취소된다. */
function understandBox() {
  var btn = h('button', { class: 'yn help-btn', id: 'helpBtn', type: 'button', onclick: openProblemHelp }, '도움 받기');
  return h('div', { class: 'understand' },
    h('div', { class: 'q' }, '문제를 제대로 이해하지 못했어요', h('div', { class: 'muted small', style: { fontWeight: 400 } }, '누르면 AI가 문제를 자세히 설명해 줘요')), btn);
}

/* [도움 받기] 설명: 문제마다 기억해 두어, 이해했다고 답한 뒤에도 화면에 그대로 남긴다. */
var PROBLEM_HELP = {};
function helpKey_() { return W.assignmentId + ':' + (W.view && W.view.problem ? W.view.problem.id : ''); }

function openProblemHelp() {
  if (!W.helpBox || W.helpLoading) return;
  var kept = PROBLEM_HELP[helpKey_()];
  if (kept) { drawProblemHelp(kept.help, false); return; }
  W.helpLoading = true;
  // AI 설명은 10~30초 걸린다: 버튼·카드 모두 '만드는 중'임이 바로 보이게 하고, 걸린 시간을 1초마다 보여 준다.
  var btn = $('#helpBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = ''; btn.appendChild(h('span', { class: 'spinner sm' })); btn.appendChild(document.createTextNode(' 설명 만드는 중…')); }
  var secs = h('span', null, '0초');
  W.helpBox.innerHTML = '';
  W.helpBox.appendChild(h('div', { class: 'result help-result help-loading' },
    mascotBox('AI가 문제를 자세히 설명하고 있어요', true, h('span', null, '보통 10~30초 걸려요 · ', secs, ' 지남')),
    h('div', { class: 'help-progress' }, h('div'))));
  var started = Date.now();
  var timer = setInterval(function () { secs.textContent = Math.round((Date.now() - started) / 1000) + '초'; }, 1000);
  W.helpBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  function restoreBtn() { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = '도움 받기'; } }
  // 누른 순간의 문제·화면을 기억한다. 설명이 오는 동안(10~60초) 학생이 다른 문제로 옮겨 가면
  // 예전에는 응답이 그때의 W(새 문제)에 붙어 '누르지도 않은 문제'에 설명이 뜨고 저장까지 됐다.
  var ws = W, key = helpKey_(), box = W.helpBox;
  function stillHere() { return W === ws && box.isConnected; }
  api('api_problemHelp', S.token, ws.assignmentId).then(function (hp) {
    PROBLEM_HELP[key] = { help: hp, answered: false };
    if (stillHere()) drawProblemHelp(hp, false);
  }).catch(function (e) {
    if (!stillHere()) return;
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'notice warn' }, e.message, ' ', h('button', { class: 'btn sm', onclick: openProblemHelp }, '다시 시도')));
  }).then(function () { clearInterval(timer); restoreBtn(); ws.helpLoading = false; });
}

/** 설명 카드(채팅 없음) + 아래에 "이해했나요?" 네/아니요 */
function drawProblemHelp(hp, answered) {
  var box = W.helpBox;
  box.innerHTML = '';
  var card = h('div', { class: 'result help-result' }, h('div', { class: 'big' }, (hp.mode === '시각화' ? '🖼 ' : '💡 ') + (hp.title || '문제를 자세히 살펴봐요')));
  if (hp.explanation) card.appendChild(h('div', { class: 'help-text', html: richHtml(hp.explanation) }));
  if (hp.figure) { var f = renderFigure(hp.figure); if (f) card.appendChild(h('div', { class: 'figure-box' }, f)); }
  if (hp.example) {
    card.appendChild(h('div', { class: 'help-sub' }, '예시'));
    card.appendChild(h('div', { class: 'pre-lines', html: richHtml(hp.example.problem) }));
    if (hp.example.explanation) card.appendChild(h('div', { class: 'help-text', style: { marginTop: '8px' }, html: richHtml(hp.example.explanation) }));
  }
  if (hp.check) card.appendChild(h('div', { class: 'help-check' }, h('b', null, '스스로 확인: '), h('span', { html: richHtml(hp.check) })));
  var ask = h('div', { class: 'help-ask' });
  if (answered) {
    ask.appendChild(h('div', { class: 'muted' }, '👍 설명을 보면서 문제를 풀어 보세요.'));
  } else {
    ask.appendChild(h('div', { class: 'help-ask-q' }, '이해했나요?'));
    ask.appendChild(h('div', { class: 'actions', style: { marginTop: 0 } },
      h('button', { class: 'btn hover-key', type: 'button', onclick: function () {
        PROBLEM_HELP[helpKey_()].answered = true;
        drawProblemHelp(hp, true);
        var pc = document.querySelector('.problem-card');
        if (pc) pc.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('좋아요! 문제로 돌아가 풀어 보세요.');
      } }, '네, 이해했어요'),
      h('button', { class: 'btn', type: 'button', onclick: skipProblem }, '아니요, 아직 모르겠어요')));
  }
  card.appendChild(ask);
  box.appendChild(card);
}

/** 설명을 보고도 이해하지 못함 → 이 문제는 넘어가고, 선생님께 알린다. */
function skipProblem() {
  confirmModal('이 문제는 넘어갈게요. 못 푼 문제로 표시되고, 선생님께 이 문제를 이해하지 못했다고 알려 드려요.', '넘어가기').then(function (ok) {
    if (!ok) return;
    showLoading('선생님께 알리고 있어요…');
    api('api_skipProblem', S.token, W.assignmentId).then(function (fb) {
      hideLoading();
      delete PROBLEM_HELP[helpKey_()];
      renderWorkspace(fb.view);
      toast('선생님께 알려 드렸어요. 다음 문제로 넘어가요.');
    }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
  });
}

function canUpload_() { return ['solve', 'retry', 'regress', 'apply'].indexOf(W.view.progress.stage) >= 0; }

function photoPanel() {
  var panel = h('div', { class: 'panel' });
  var cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
  var lib = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  [cam, lib].forEach(function (inp) {
    inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; inp.value = ''; if (f) handlePhoto(f); });
  });
  W.photoArea = h('div');
  W.pickCam = function () { cam.click(); };
  W.pickLib = function () { lib.click(); };
  panel.appendChild(h('div', { class: 'panel-title' }, '📷 풀이 올리기'));
  panel.appendChild(W.photoArea);
  panel.appendChild(cam);
  panel.appendChild(lib);
  drawPhotoArea();
  return panel;
}

function drawPhotoArea() {
  var a = W.photoArea;
  if (!a) return;
  a.innerHTML = '';
  if (W.photo) a.appendChild(h('img', { class: 'photo-prev', src: W.photo, alt: '풀이 사진', onclick: function () { zoomImage(W.photo); } }));
  else a.appendChild(h('div', { class: 'drop' }, h('div', { class: 'big' }, '📝'), h('div', null, '종이에 푼 풀이를 찍어 올리거나, [직접 쓰기]로 화면에 써 주세요')));
  var dis = !canUpload_() || W.busy || W.locked;
  a.appendChild(h('div', { class: 'photo-btns' },
    h('button', { class: 'btn hover-key', disabled: dis, onclick: W.pickCam }, W.photo && !W.drawn ? '다시 찍기' : '사진 찍기'),
    h('button', { class: 'btn', disabled: dis, onclick: W.pickLib }, '앨범에서 선택'),
    h('button', { class: 'btn', disabled: dis, onclick: openDrawPad }, W.drawStrokes && W.drawStrokes.length ? '✍️ 수정하기' : '✍️ 직접 쓰기')));
}

/* 직접 쓴 획은 문제마다 브라우저에 저장해 둔다: 다시 풀기·새로고침 뒤에도 [수정하기]로 불러와 이어 쓸 수 있다. */
var DRAW_STORE = 'mdx_draw', DRAW_MEM = {};
function drawKey_() { return (S.profile ? S.profile.id : '') + ':' + W.assignmentId + ':' + (W.view && W.view.problem ? W.view.problem.id : ''); }
function readDrawings_() { try { return JSON.parse(localStorage.getItem(DRAW_STORE) || '{}') || {}; } catch (e) { return {}; } }
function loadDrawing_() {
  var d = readDrawings_()[drawKey_()] || DRAW_MEM[drawKey_()];
  return d && Array.isArray(d.strokes) && d.strokes.length ? d : null;
}
function saveDrawing_(strokes, sent) {
  var k = drawKey_();
  var d = strokes && strokes.length ? {
    strokes: strokes.map(function (s) { return { tool: s.tool, w: s.w, pts: s.pts.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }) }; }),
    sent: !!sent, at: Date.now()
  } : null;
  if (d) DRAW_MEM[k] = d; else delete DRAW_MEM[k];
  try {
    var all = readDrawings_();
    if (d) all[k] = d; else delete all[k];
    // 최근 8문제만 남긴다(브라우저 저장 공간 보호).
    Object.keys(all).sort(function (a, b) { return (all[b].at || 0) - (all[a].at || 0); }).slice(8).forEach(function (x) { delete all[x]; });
    localStorage.setItem(DRAW_STORE, JSON.stringify(all));
  } catch (e) { /* 저장 공간을 못 쓰면 이 화면을 여는 동안만 기억한다 */ }
}

/* ---------- 직접 쓰기 (간단한 그림판) ---------- */
/* 펜·지우개·굵기·되돌리기·모두 지우기. [완료]를 누르면 쓴 부분만 잘라 사진과 똑같이 글자 인식을 한다. */
var PEN_WIDTHS = { '가늘게': 2.5, '보통': 4, '굵게': 7 };

function openDrawPad() {
  var strokes = (W.drawStrokes || []).slice();
  var tool = 'pen', lastEraser = 'eraser', widthName = '보통', cur = null, cutting = false, cutLast = null;
  // 되돌리기: 바뀌기 직전의 획 목록을 쌓아 둔다(획 쓰기·지우기·획 지우기·모두 지우기 모두 되돌릴 수 있게).
  var history = [];
  function remember() { history.push(strokes.slice()); if (history.length > 60) history.shift(); }
  // 아무것도 바뀌지 않은 동작(빈 곳을 획 지우개로 누름 등)은 되돌리기 기록에서 뺀다. 그래야 Ctrl+Z 한 번에 직전 획이 지워진다.
  function forgetIfSame() {
    var last = history[history.length - 1];
    if (last && last.length === strokes.length && last.every(function (x, i) { return x === strokes[i]; })) history.pop();
  }
  function undo() { if (cur || cutting) return; if (history.length) { strokes = history.pop(); redraw(); } }
  // Ctrl+Z(맥은 ⌘+Z): 직전 획 지우기. 한글 입력 상태에서도 되도록 글자 대신 키 위치(KeyZ)로 본다.
  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    if (e.code !== 'KeyZ' && String(e.key).toLowerCase() !== 'z') return;
    if (document.querySelector('.modal-back, .modal-overlay, .modal')) return; // 확인 창이 떠 있을 때는 무시
    e.preventDefault();
    undo();
  }
  window.addEventListener('keydown', onKey);
  var ov = h('div', { class: 'draw-overlay' });
  var cv = h('canvas', { class: 'draw-canvas' });
  var wrap = h('div', { class: 'draw-wrap' }, cv);
  // 쓰는 동안에도 문제를 볼 수 있게 왼쪽 위에 작게 띄운다(누르면 크게, 접으면 작은 단추).
  var prob = W.view && W.view.problem;
  if (prob) {
    var probBox = h('div', { class: 'draw-prob' });
    var drawProb = function (open) {
      probBox.innerHTML = '';
      probBox.classList.toggle('closed', !open);
      if (!open) {
        probBox.style.width = ''; probBox.style.height = ''; probBox.style.maxHeight = ''; probBox.classList.remove('sized');
        probBox.appendChild(h('button', { class: 'draw-prob-chip', type: 'button', onclick: function () { drawProb(true); } }, '📄 문제 보기'));
        return;
      }
      probBox.appendChild(h('div', { class: 'draw-prob-head' }, h('b', null, '문제'), h('button', { class: 'draw-prob-fold', type: 'button', onclick: function () { drawProb(false); } }, '접기')));
      probBox.appendChild(h('div', { class: 'draw-prob-body' }, problemBody(prob)));
      var grip = h('div', { class: 'draw-prob-resize', title: '끌어서 크기 조절 · 두 번 누르면 원래 크기', 'aria-label': '문제 창 크기 조절' });
      probBox.appendChild(grip);
      bindProbResize_(probBox, grip, wrap);
      applyProbSize_(probBox, wrap);
    };
    drawProb(true);
    wrap.appendChild(probBox);
  }
  var ctx = cv.getContext('2d');
  var dpr = Math.max(1, window.devicePixelRatio || 1);

  function strokeStyle(s) { applyStroke_(ctx, s); }
  function drawStroke(s) {
    strokeStyle(s);
    ctx.beginPath();
    s.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
    ctx.stroke();
  }
  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    strokes.forEach(drawStroke);
  }
  function fit() {
    if (probBox && !probBox.classList.contains('closed')) applyProbSize_(probBox, wrap);
    var r = wrap.getBoundingClientRect();
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    redraw();
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  // S펜 옆 버튼: 누르고 있는 동안만 지우개(마지막으로 고른 지우개), 떼면 원래 도구로 돌아온다(삼성 노트와 같게).
  // 브라우저마다 옆 버튼을 buttons 2(보조 버튼)·button 2로, 지우개 끝을 buttons 32·button 5로 준다.
  // 일부 브라우저는 S펜을 mouse로 알려 주므로 손가락(touch)만 빼고 모두 본다.
  function sideButtonHeld(e) {
    if (e.pointerType === 'touch') return false;
    return (e.buttons & 2) !== 0 || (e.buttons & 32) !== 0 || e.button === 2 || e.button === 5;
  }
  var held = false;
  function setHeld(on) {
    if (on === held) return;
    held = on;
    showTool(on ? lastEraser : tool);
  }
  function activeTool() { return held ? lastEraser : tool; }
  function startStroke(e) {
    var t = activeTool();
    if (t === 'stroke') { cutting = true; cutLast = pos(e); cutStrokesAt(cutLast); return; }
    cur = { tool: t, w: PEN_WIDTHS[widthName], pts: [pos(e)] };
    strokes.push(cur);
    drawStroke(cur);
  }
  // 옆 버튼을 누르면 브라우저가 오른쪽 클릭 메뉴를 띄우려 하므로 막는다.
  ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) {
    setHeld(sideButtonHeld(e));
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    remember();
    startStroke(e);
  });
  // 획 지우개: 닿은 펜 획을 통째로 지운다. 빠르게 쓸어도 건너뛰지 않게 이동 경로를 4px 간격으로 검사한다.
  function cutAlong(p) {
    var a = cutLast || p, n = Math.max(1, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / 4));
    for (var i = 1; i <= n; i++) cutStrokesAt([a[0] + (p[0] - a[0]) * i / n, a[1] + (p[1] - a[1]) * i / n]);
    cutLast = p;
  }
  function cutStrokesAt(p) {
    var before = strokes.length;
    strokes = strokes.filter(function (s) { return s.tool !== 'pen' || !strokeHit_(s, p, 10 + s.w); });
    if (strokes.length !== before) redraw();
  }
  cv.addEventListener('pointermove', function (e) {
    var was = held;
    setHeld(sideButtonHeld(e));
    // 쓰는 도중에 옆 버튼을 누르거나 떼면 그 자리에서 펜 ↔ 지우개로 이어 간다.
    if (held !== was && (cur || cutting) && e.buttons) { cur = null; cutting = false; startStroke(e); return; }
    if (cutting) { e.preventDefault(); cutAlong(pos(e)); return; }
    if (!cur) return;
    e.preventDefault();
    var p = pos(e), last = cur.pts[cur.pts.length - 1];
    cur.pts.push(p);
    strokeStyle(cur);
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function (e) { if (cur || cutting) forgetIfSame(); cur = null; cutting = false; setHeld(sideButtonHeld(e)); }); });
  cv.addEventListener('pointerleave', function () { if (cur || cutting) forgetIfSame(); cur = null; cutting = false; setHeld(false); });

  function showTool(name) {
    Array.prototype.forEach.call(bar.querySelectorAll('[data-tool]'), function (x) { x.classList.toggle('on', x.getAttribute('data-tool') === name); });
  }
  function setTool(name) {
    tool = name;
    if (name !== 'pen') lastEraser = name;
    showTool(activeTool());
  }
  function toolBtn(name, label) {
    var b = h('button', { class: 'draw-btn' + (tool === name ? ' on' : ''), type: 'button' }, label);
    b.onclick = function () { setTool(name); };
    b.setAttribute('data-tool', name);
    return b;
  }
  var widthSel = h('select', { class: 'draw-sel', title: '굵기' }, Object.keys(PEN_WIDTHS).map(function (k) { return h('option', { value: k, selected: k === widthName }, k); }));
  widthSel.onchange = function () { widthName = widthSel.value; };
  function close() {
    window.removeEventListener('resize', fit);
    window.removeEventListener('keydown', onKey);
    if (ov.parentNode) ov.parentNode.removeChild(ov);
  }
  var bar = h('div', { class: 'draw-bar' },
    toolBtn('pen', '✏️ 펜'), toolBtn('eraser', '🧽 지우개'), toolBtn('stroke', '✂️ 획 지우개'), widthSel,
    h('button', { class: 'draw-btn', type: 'button', title: '직전 획 지우기 (Ctrl+Z)', onclick: undo }, '↶ 되돌리기'),
    h('button', { class: 'draw-btn', type: 'button', onclick: function () {
      if (!strokes.length) return;
      confirmModal('쓴 내용을 모두 지울까요?', '모두 지우기').then(function (ok) { if (ok) { remember(); strokes = []; redraw(); } });
    } }, '🗑 모두 지우기'));
  var foot = h('div', { class: 'draw-foot' },
    h('div', { class: 'muted small' }, '한 줄에 식 하나씩, 줄을 맞춰 써 주세요 · S펜 옆 버튼을 누른 채 쓰면 지우개'),
    h('button', { class: 'btn', type: 'button', onclick: function () { W.drawStrokes = strokes; saveDrawing_(strokes, W.drawn); close(); drawPhotoArea(); } }, '닫기'),
    h('button', { class: 'btn hover-key', type: 'button', onclick: function () {
      var url = exportDrawing_(strokes);
      if (!url) { toast('먼저 풀이를 써 주세요.', 'err'); return; }
      W.drawStrokes = strokes;
      W.drawn = true;
      saveDrawing_(strokes, true);
      close();
      sendSolutionImage(url);
    } }, '완료'));
  ov.appendChild(h('div', { class: 'draw-head' }, h('b', null, '✍️ 직접 쓰기'), bar));
  ov.appendChild(wrap);
  ov.appendChild(foot);
  document.body.appendChild(ov);
  window.addEventListener('resize', fit);
  setTimeout(fit, 0);
}

/* 직접 쓰기 화면의 문제 창 크기: 오른쪽 아래 손잡이를 끌어 바꾼다(펜·손가락·마우스 모두). 이 기기에 기억해 둔다. */
var PROB_SIZE_KEY = 'mdx_drawProbSize';
function loadProbSize_() { try { return JSON.parse(localStorage.getItem(PROB_SIZE_KEY) || 'null'); } catch (e) { return null; } }
function saveProbSize_(v) { try { if (v) localStorage.setItem(PROB_SIZE_KEY, JSON.stringify(v)); else localStorage.removeItem(PROB_SIZE_KEY); } catch (e) { /* 무시 */ } }
function clampProbSize_(w, hh, wrap) {
  var r = wrap.getBoundingClientRect();
  var maxW = Math.max(160, (r.width || window.innerWidth) - 16), maxH = Math.max(100, (r.height || window.innerHeight) - 16);
  return { w: Math.round(Math.max(160, Math.min(maxW, w))), h: Math.round(Math.max(100, Math.min(maxH, hh))) };
}
function applyProbSize_(box, wrap) {
  var v = loadProbSize_();
  if (!v) { box.style.width = ''; box.style.height = ''; box.style.maxHeight = ''; box.classList.remove('sized'); return; }
  var c = clampProbSize_(v.w, v.h, wrap);
  box.style.width = c.w + 'px'; box.style.height = c.h + 'px'; box.style.maxHeight = 'none';
  box.classList.add('sized');
}
function bindProbResize_(box, grip, wrap) {
  var start = null;
  grip.addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    var r = box.getBoundingClientRect();
    start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    try { grip.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    box.classList.add('resizing');
  });
  grip.addEventListener('pointermove', function (e) {
    if (!start) return;
    e.preventDefault();
    var c = clampProbSize_(start.w + e.clientX - start.x, start.h + e.clientY - start.y, wrap);
    box.style.width = c.w + 'px'; box.style.height = c.h + 'px'; box.style.maxHeight = 'none';
    box.classList.add('sized');
  });
  function end() {
    if (!start) return;
    start = null;
    box.classList.remove('resizing');
    var r = box.getBoundingClientRect();
    saveProbSize_({ w: Math.round(r.width), h: Math.round(r.height) });
  }
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', function (e) { e.preventDefault(); saveProbSize_(null); applyProbSize_(box, wrap); });
}

/** 점 p가 획 s의 어느 선분과 r 이내로 가까운지 */
function strokeHit_(s, p, r) {
  var pts = s.pts, r2 = r * r;
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[i + 1] || a;
    var dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    if (x * x + y * y <= r2) return true;
  }
  return false;
}

/** 지우개는 칠하지 않고 실제로 지운다(화면의 줄 안내선이 가려지지 않게). */
function applyStroke_(g, s) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  g.strokeStyle = '#111';
  g.lineWidth = s.tool === 'eraser' ? s.w * 5 : s.w;
}

/** 쓴 부분만 잘라(여백 포함) 흰 바탕 JPEG로 만든다. 줄 안내선은 넣지 않는다. */
function exportDrawing_(strokes) {
  var pens = strokes.filter(function (s) { return s.tool === 'pen'; });
  if (!pens.length) return null;
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pens.forEach(function (s) { s.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); });
  var pad = 24;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  var w = x1 - x0, hgt = y1 - y0;
  var scale = Math.min(2, 1600 / Math.max(w, hgt));
  // 투명한 층에 쓰고 지운 뒤, 흰 바탕 위에 얹는다(JPEG는 투명을 검게 바꾸므로).
  var layer = document.createElement('canvas');
  layer.width = Math.round(w * scale); layer.height = Math.round(hgt * scale);
  var g = layer.getContext('2d');
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  strokes.forEach(function (s) {
    applyStroke_(g, s);
    g.beginPath();
    s.pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
    g.stroke();
  });
  var c = document.createElement('canvas');
  c.width = layer.width; c.height = layer.height;
  var out = c.getContext('2d');
  out.fillStyle = '#fff'; out.fillRect(0, 0, c.width, c.height);
  out.drawImage(layer, 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
}

function handlePhoto(file) {
  W.drawn = false;
  W.drawStrokes = null;
  saveDrawing_(null);
  sendSolutionImage(compressImage(file));
}

/** 사진이든 직접 쓴 그림이든 같은 흐름: 저장 → 글자 인식 → 편집기 */
function sendSolutionImage(dataUrlOrPromise) {
  W.busy = true;
  drawPhotoArea();
  setEditorLoading('AI가 풀이를 읽고 있어요… (10~40초)');
  Promise.resolve(dataUrlOrPromise).then(function (dataUrl) {
    W.photo = dataUrl;
    drawPhotoArea();
    return api('api_transcribe', S.token, { assignmentId: W.assignmentId, imageBase64: dataUrl, mime: 'image/jpeg' });
  }).then(function (res) {
    W.sub = { submissionId: res.submissionId, aiLines: res.lines, analyzed: false };
    $('#resultBox').innerHTML = '';
    renderEditor(res.lines.map(function (l) { return { text: l.text, uncertain: l.uncertain, reason: l.reason }; }), res.unreadable);
  }).catch(function (e) {
    toast(e.message, 'err');
    renderEditor(W.lastLines || null);
  }).then(function () { W.busy = false; drawPhotoArea(); });
}

function editorPanel() {
  W.editorPanel = h('div', { class: 'panel' });
  renderEditor(null);
  return W.editorPanel;
}

function setEditorLoading(msg) {
  var p = W.editorPanel;
  p.innerHTML = '';
  p.appendChild(h('div', { class: 'panel-title' }, '✏️ AI가 읽은 풀이'));
  p.appendChild(inlineLoad(msg));
}

function renderEditor(lines, unreadable) {
  var p = W.editorPanel;
  p.innerHTML = '';
  p.appendChild(h('div', { class: 'panel-title' }, '✏️ AI가 읽은 풀이', h('span', { class: 'muted small' }, '사진과 다르게 읽은 부분은 고쳐 주세요')));
  if (!lines) {
    W.solText = null;
    p.appendChild(h('div', { class: 'drop' }, h('div', { class: 'big' }, '🔎'), h('div', null, '사진을 올리면 AI가 읽은 풀이가 여기에 나타나요.')));
    return;
  }
  W.lastLines = lines;
  if (unreadable) p.appendChild(h('div', { class: 'notice warn' }, '사진에서 풀이를 잘 읽지 못했어요. 다시 찍거나 직접 입력해 주세요.'));

  // 풀이 전체를 한 칸에서 고친다(한 줄에 식 하나). 아래에는 수식으로 보기 좋게 보여 준다.
  var ta = h('textarea', { class: 'sol-text', rows: 6, 'data-math': '1', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '풀이를 한 줄에 식 하나씩 적어 주세요' });
  ta.value = lines.map(function (l) { return normalizeTimes(l.text); }).join('\n');
  W.solText = ta;
  // AI가 잘못 읽었을 수 있는 줄: 학생이 [맞아요]를 누르거나 그 줄을 고치면 표시가 사라진다.
  W.unsure = lines.filter(function (l) { return l.uncertain; }).map(function (l) { return { text: normalizeTimes(l.text).trim(), reason: l.reason || '', ok: false }; });

  var preview = h('div', { class: 'sol-preview' });
  function draw() {
    preview.innerHTML = '';
    var n = 0;
    ta.value.split('\n').forEach(function (t) {
      if (!t.trim()) return;
      n++;
      var u = pendingUnsure_(t);
      var row = h('div', { class: 'sol-line' + (u ? ' uncertain' : '') },
        h('span', { class: 'line-no' }, String(n)), h('div', { class: 'sol-math', html: plainLineHtml(t) }));
      if (u) {
        row.appendChild(h('div', { class: 'line-ask' }, '⚠ 이 풀이가 맞나요?',
          u.reason ? h('span', { class: 'muted', style: { fontWeight: 400 } }, '(' + u.reason + ')') : null,
          h('button', { class: 'btn sm', type: 'button', onclick: function () { u.ok = true; draw(); } }, '맞아요')));
      }
      preview.appendChild(row);
    });
    if (!n) preview.appendChild(h('div', { class: 'muted small' }, '위에 풀이를 적으면 여기에 수식으로 보여요.'));
  }
  // 숫자 사이의 x는 곱하기(×)로 바꿔 보여 준다. 커서 위치는 유지한다.
  function fixTimes() {
    var v = ta.value, fixed = normalizeTimes(v);
    if (fixed === v) return;
    var pos = ta.selectionStart - (v.length - fixed.length);
    ta.value = fixed;
    try { ta.setSelectionRange(pos, pos); } catch (e) { /* 무시 */ }
  }
  ta.addEventListener('input', function () { fixTimes(); draw(); });

  p.appendChild(symbolBar(function () { return ta; }));
  p.appendChild(ta);
  p.appendChild(h('div', { class: 'sol-preview-title' }, '미리보기'));
  p.appendChild(preview);
  draw();
  W.submitBtn = h('button', { class: 'btn primary block submit-btn', type: 'button', onclick: submitSolution }, W.sub && W.sub.analyzed ? '고쳐서 다시 제출하기' : '제출하고 분석받기');
  p.appendChild(W.submitBtn);
  if (W.locked) lockEditor(true);
}

/** 아직 확인하지 않은 '잘못 읽었을 수 있는 줄'이면 그 정보를 돌려준다. */
function pendingUnsure_(lineText) {
  var t = String(lineText || '').trim();
  return (W.unsure || []).filter(function (u) { return !u.ok && u.text === t; })[0] || null;
}

function collectLines() {
  if (!W.solText) return [];
  return W.solText.value.split('\n').map(function (t) { return { text: t.trim() }; }).filter(function (l) { return l.text; });
}

function lockEditor(on) {
  W.locked = on;
  if (!W.editorPanel) return;
  Array.prototype.forEach.call(W.editorPanel.querySelectorAll('input,button,textarea'), function (x) { x.disabled = on; });
  drawPhotoArea();
}

function submitSolution() {
  if (!W.sub) { toast('먼저 풀이 사진을 올려 주세요.', 'err'); return; }
  var lines = collectLines();
  if (!lines.length) { toast('풀이를 한 줄 이상 적어 주세요.', 'err'); return; }
  var pending = lines.some(function (l) { return pendingUnsure_(l.text); });
  var ready = pending ? confirmModal('노란색으로 표시된 줄을 아직 확인하지 않았어요. 사진과 같은지 확인했나요?', '그대로 제출') : Promise.resolve(true);
  ready.then(function (ok) {
    if (!ok) return;
    showLoading('AI가 풀이를 분석하고 있어요… (20~60초)');
    api('api_submitSolution', S.token, { submissionId: W.sub.submissionId, lines: lines }).then(function (fb) {
      hideLoading();
      W.view = fb.view;
      W.sub.submissionId = fb.submissionId;
      W.sub.analyzed = true;
      showFeedback(fb, false);
    }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
  });
}

var STAGE_ICON = { '읽기': '📖', '이해': '🧭', '변형': '💡', '처리기술': '🧮', '인코딩': '🔍' };

function showFeedback(fb, restored) {
  var box = $('#resultBox');
  if (!box) return;
  box.innerHTML = '';
  var cls = fb.result === 'correct' ? 'correct' : (fb.result === 'hold' ? 'hold' : 'wrong');
  var icon = fb.result === 'correct' ? '🎉' : (fb.result === 'hold' ? '👩‍🏫' : (STAGE_ICON[fb.stage] || '💡'));
  var acts = h('div', { class: 'actions' });
  box.appendChild(h('div', { class: 'result ' + cls }, h('div', { class: 'big' }, icon + ' ' + fb.message), fb.note ? h('div', { class: 'muted' }, fb.note) : null, acts));
  var view = fb.view || W.view;
  if (fb.result !== 'wrong' || fb.startTutor) lockEditor(true);
  if (fb.result === 'wrong' && !fb.startTutor) {
    acts.appendChild(h('button', { class: 'btn primary', onclick: function () { retrySolve(view); } }, '다시 풀기'));
  }
  // 이해 단계 오류: 설명을 바로 보여 주지 않는다. 학생이 [도움 받기]를 눌렀을 때만 AI 설명을 만든다.
  if (fb.showHelp && fb.submissionId) {
    var hb = h('div');
    var hbtn = h('button', { class: 'btn', type: 'button', onclick: function () { hbtn.disabled = true; loadHelp(hb, fb.submissionId); } }, '도움 받기');
    acts.appendChild(hbtn);
    box.appendChild(hb);
  }
  if (fb.startTutor) {
    var tb = h('div');
    box.appendChild(tb);
    startOrLoadTutor(tb, view);
  }
  if (fb.nextStage === 'apply') acts.appendChild(h('button', { class: 'btn primary', onclick: function () { renderWorkspace(view); } }, '3단계 시작하기 →'));
  if (fb.canNext || (view && view.canNext)) acts.appendChild(h('button', { class: 'btn ok', onclick: goNext }, '다음 문제 →'));
  if (!restored) setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}

function retrySolve(view) {
  W.locked = false;
  renderWorkspace(view, { retry: true });
  toast('사진을 다시 찍거나, 줄을 고친 뒤 다시 제출해 보세요.');
}

function goNext() {
  showLoading('다음 문제를 찾고 있어요…');
  api('api_nextAssignment', S.token, W.assignmentId).then(function (r) {
    hideLoading();
    if (r && r.assignmentId) openWorkspace(r.assignmentId);
    else { toast('모든 문제를 마쳤어요! 수고했어요.'); renderStudentHome(); }
  }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
}

function loadHelp(box, submissionId) {
  box.innerHTML = '';
  box.appendChild(h('div', { class: 'help-card' }, inlineLoad('문제 상황을 정리하고 있어요…')));
  api('api_comprehensionHelp', S.token, submissionId).then(function (hp) {
    box.innerHTML = '';
    var card = h('div', { class: 'help-card' }, h('div', { class: 'panel-title' }, (hp.mode === '시각화' ? '🖼 ' : '🧩 ') + hp.title));
    if (hp.explanation) card.appendChild(h('div', { html: richHtml(hp.explanation) }));
    if (hp.figure) { var f = renderFigure(hp.figure); if (f) card.appendChild(h('div', { class: 'figure-box' }, f)); }
    if (hp.example) {
      card.appendChild(h('div', { class: 'section-title' }, '예시'));
      card.appendChild(h('div', { class: 'pre-lines', html: richHtml(hp.example.problem) }));
      if (hp.example.explanation) card.appendChild(h('div', { style: { marginTop: '8px' }, html: richHtml(hp.example.explanation) }));
    }
    if (hp.check) card.appendChild(h('div', { class: 'notice', style: { marginTop: '12px', marginBottom: 0 } }, h('b', null, '스스로 확인: '), h('span', { html: richHtml(hp.check) })));
    card.appendChild(h('div', { class: 'muted small', style: { marginTop: '10px' } }, '이해가 되었으면 위의 [다시 풀기]를 눌러 다시 풀어 보세요.'));
    box.appendChild(card);
  }).catch(function (e) {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'notice warn' }, e.message, ' ', h('button', { class: 'btn sm', onclick: function () { loadHelp(box, submissionId); } }, '다시 시도')));
  });
}

/* ---------- 1단계: 유도질문 채팅 ---------- */
function startOrLoadTutor(box, view) {
  box.innerHTML = '';
  box.appendChild(h('div', { class: 'tutor' }, inlineLoad('비슷한 문제를 준비하고 있어요… (최대 1분)')));
  var p = view.sessionId ? api('api_tutorView', S.token, view.sessionId) : api('api_tutorStart', S.token, view.assignmentId);
  p.then(function (tv) { renderTutor(box, tv); }).catch(function (e) {
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'notice warn' }, e.message, ' ', h('button', { class: 'btn sm', onclick: function () { startOrLoadTutor(box, view); } }, '다시 시도')));
  });
}

function bubble(m) {
  var cls = m.role === 'student' ? 'student' : (m.role === 'system' ? 'system' : 'tutor');
  return h('div', { class: 'bubble ' + cls, html: m.role === 'student' ? esc(m.text) : richHtml(m.text) });
}

function renderTutor(box, tv) {
  if (T.timer) clearInterval(T.timer);
  T = { tv: tv, box: box, timer: null, busy: false };
  box.innerHTML = '';
  var wrap = h('div', { class: 'tutor' });
  var crumbs = h('div', { class: 'crumbs' });
  (tv.path || []).forEach(function (p, i) {
    crumbs.appendChild(h('span', { class: 'crumb' + (i === tv.path.length - 1 ? ' cur' : ''), html: richHtml(p.name) + ' · ' + esc(p.grade) }));
  });
  wrap.appendChild(h('div', { class: 'tutor-head' }, h('b', null, '1단계 · 함께 생각하기'), h('div', { class: 'muted small' }, '정답을 바로 알려 주지 않아요. 천천히 생각하고 답해 보세요.'), crumbs));
  if (tv.problem) {
    var pb = h('div', { class: 'tutor-problem' }, h('div', { class: 'muted small' }, '함께 풀 문제' + (tv.step && tv.step.total ? ' · ' + (tv.step.index + 1) + '/' + tv.step.total + '단계' : '')), problemBody(tv.problem));
    if (tv.problem.figure) { var f = renderFigure(tv.problem.figure); if (f) pb.appendChild(h('div', { class: 'figure-box' }, f)); }
    wrap.appendChild(pb);
  }
  var chat = h('div', { class: 'chat' });
  (tv.messages || []).forEach(function (m) { chat.appendChild(bubble(m)); });
  wrap.appendChild(chat);
  T.chat = chat;
  if (tv.finished) {
    wrap.appendChild(h('div', { class: 'chat-input' }, h('div', { class: 'result correct', style: { marginTop: 0 } }, h('div', { class: 'big' }, '✅ 1단계 학습을 마쳤어요!'), h('div', null, '이제 처음 문제로 돌아가 다시 풀어 볼까요?'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: function () { openWorkspace(W.assignmentId); } }, '2단계: 처음 문제 다시 풀기 →')))));
    box.appendChild(wrap);
    setTimeout(function () { chat.scrollTop = chat.scrollHeight; }, 30);
    return;
  }
  var ta = h('textarea', { rows: 2, placeholder: '생각한 것을 적어 보세요', 'data-math': '1' });
  var send = h('button', { class: 'btn primary', type: 'button' }, '보내기');
  var dk = h('button', { class: 'btn sm', type: 'button' }, '모르겠어요');
  var hint = h('button', { class: 'btn sm', type: 'button' }, '힌트 주세요');
  var think = h('div', { class: 'think' });
  T.ta = ta; T.send = send; T.dk = dk; T.hint = hint; T.think = think;
  send.onclick = function () { tutorSend('answer'); };
  dk.onclick = function () { tutorSend('dontknow'); };
  hint.onclick = function () { tutorSend('hint'); };
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); tutorSend('answer'); } });
  var inputBox = h('div', { class: 'chat-input' }, symbolBar(function () { return ta; }), h('div', { class: 'chat-row' }, ta, send), h('div', { class: 'actions', style: { marginTop: '8px' } }, dk, hint), think);
  wrap.appendChild(inputBox);
  box.appendChild(wrap);
  setTimeout(function () { chat.scrollTop = chat.scrollHeight; }, 30);
  startThink();
}

/** 유도질문 뒤 생각할 시간: 그동안 [모르겠어요]/[힌트] 버튼은 잠김 (답 입력은 언제나 가능) */
function startThink() {
  if (T.timer) clearInterval(T.timer);
  var left = Math.max(0, Number(T.tv.thinkSeconds) || 0);
  T.dk.disabled = T.hint.disabled = left > 0;
  function tick() {
    if (left > 0) { T.think.textContent = '🤔 생각할 시간 ' + left + '초 · 천천히 생각해 보고 답을 적어 보세요.'; left--; }
    else { clearInterval(T.timer); T.dk.disabled = T.hint.disabled = false; T.think.textContent = '막히면 [힌트 주세요]를 눌러도 돼요.'; }
  }
  tick();
  T.timer = setInterval(tick, 1000);
}

function tutorSend(kind) {
  if (T.busy) return;
  var text = T.ta.value.trim();
  if (kind === 'answer' && !text) { toast('답을 적어 주세요.', 'err'); return; }
  T.busy = true;
  T.send.disabled = T.dk.disabled = T.hint.disabled = true;
  var shown = kind === 'hint' ? '(힌트를 요청함)' : (kind === 'dontknow' ? '모르겠어요' : text);
  T.chat.appendChild(bubble({ role: 'student', text: shown }));
  var typing = h('div', { class: 'bubble tutor' }, h('span', { class: 'spinner sm', style: { display: 'inline-block', verticalAlign: 'middle' } }), ' 생각 중…');
  T.chat.appendChild(typing);
  T.chat.scrollTop = T.chat.scrollHeight;
  T.ta.value = '';
  api('api_tutorSend', S.token, T.tv.sessionId, text, kind).then(function (r) {
    var prevProblem = T.tv.problem ? T.tv.problem.id : '';
    var newProblem = r.view.problem ? r.view.problem.id : '';
    if (r.finished || prevProblem !== newProblem) { renderTutor(T.box, r.view); return; }
    typing.parentNode.removeChild(typing);
    r.messages.slice(1).forEach(function (m) { T.chat.appendChild(bubble(m)); });
    T.tv = r.view;
    T.chat.scrollTop = T.chat.scrollHeight;
    T.busy = false;
    T.send.disabled = false;
    startThink();
  }).catch(function (e) {
    if (typing.parentNode) typing.parentNode.removeChild(typing);
    toast(e.message, 'err');
    if (kind === 'answer') T.ta.value = text;
    T.busy = false;
    T.send.disabled = false;
    T.dk.disabled = T.hint.disabled = false;
  });
}
