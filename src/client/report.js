/* ===================== 학습 리포트(나의 학습역량) — 학생 화면·교사 팝업 공통 ===================== */
var SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  var el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function (k) {
    if (k === 'style') Object.assign(el.style, attrs[k]);
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
    else el.setAttribute(k, attrs[k]);
  });
  for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
  return el;
}

/** 도넛 모양 원 그래프. groups: [{key, label, n, color}] — 조각을 누르면 onPick(group) */
function reportPie(groups, total, centerText, onPick) {
  var cx = 100, cy = 100, r = 92, start = -Math.PI / 2;
  var svg = svgEl('svg', { viewBox: '0 0 200 200', class: 'pie', role: 'img', 'aria-label': groups.map(function (g) { return g.label + ' ' + g.n + '개'; }).join(', ') });
  groups.forEach(function (g) {
    if (!g.n) return;
    var attrs = { class: 'pie-slice', style: { fill: g.color }, onclick: function () { onPick(g); } };
    var shape;
    if (g.n === total) shape = svgEl('circle', Object.assign({ cx: cx, cy: cy, r: r }, attrs));
    else {
      var end = start + 2 * Math.PI * g.n / total;
      var x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start), x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      shape = svgEl('path', Object.assign({ d: 'M' + cx + ' ' + cy + ' L' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + (end - start > Math.PI ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z' }, attrs));
      start = end;
    }
    var title = svgEl('title');
    title.textContent = g.label + ' ' + g.n + '개 (눌러서 보기)';
    shape.appendChild(title);
    svg.appendChild(shape);
  });
  svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 52, style: { fill: '#fff', pointerEvents: 'none' } }));
  var t1 = svgEl('text', { x: cx, y: cy - 4, class: 'pie-center' }); t1.textContent = centerText[0];
  var t2 = svgEl('text', { x: cx, y: cy + 20, class: 'pie-center-sub' }); t2.textContent = centerText[1];
  svg.appendChild(t1);
  svg.appendChild(t2);
  return svg;
}

function fmtNum(n, digits) {
  var p = Math.pow(10, digits || 0);
  return String(Math.round(Number(n || 0) * p) / p);
}

/** opt: {load() → Promise(리포트), summary() → Promise({lines}), studentId(교사)} */
function reportView(opt) {
  var root = h('div', { class: 'report' });
  root.appendChild(inlineLoad('학습 기록을 모으고 있어요…'));
  opt.load().then(function (rep) { root.innerHTML = ''; drawReport(root, rep, opt); })
    .catch(function (e) { root.innerHTML = ''; root.appendChild(h('div', { class: 'notice warn' }, e.message)); });
  return root;
}

var DEFICIT_CLASS = { '-1': '', 0: 'green', 1: 'yellow', 2: 'orange', 3: 'red' };

/** 교사 리포트에만: 최소 성취수준 보장지도 기준 학습 결손 정도 */
function deficitCard(d) {
  return h('div', { class: 'report-card deficit-card' },
    h('div', { class: 'report-title' }, '학습 결손 진단 ', h('span', { class: 'badge' }, '교사 전용')),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
      h('span', { class: 'deficit-badge ' + (DEFICIT_CLASS[d.rank] || '') }, d.label), h('span', { class: 'muted' }, d.reason || '')),
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, '최소 성취수준 보장지도 기준이에요. 학생 리포트에는 보이지 않아요.' +
      (d.cuts ? ' (주의 ' + d.cuts[0] + '점 미만 · 심함 ' + d.cuts[1] + '점 미만 · 매우 심함 ' + d.cuts[2] + '점 미만 — 설정 시트의 학습결손기준 항목에서 바꿀 수 있어요)' : '')));
}

function drawReport(root, rep, opt) {
  var done = rep.correct + rep.wrong;
  if (rep.createdAt) root.appendChild(h('div', { class: 'muted small' }, '리포트 만든 때: ' + String(rep.createdAt).slice(0, 16) + ' · 학생과 선생님이 같은 리포트를 봐요.'));
  if (opt.studentId && rep.progress && !rep.progress.ready) {
    root.appendChild(h('div', { class: 'notice warn', style: { marginBottom: 0 } }, h('b', null, '과제 진행 중이에요 (' + rep.progress.done + '/' + rep.progress.total + ' 완료). '),
      '지금까지 푼 문제로 만든 리포트라 결과가 달라질 수 있어요. 학생은 과제를 모두 마친 뒤에 리포트를 볼 수 있어요.'));
  }
  if (rep.deficit) root.appendChild(deficitCard(rep.deficit));

  // 1) 원 그래프: 처음 풀이 기준 맞은 문제·틀린 문제
  var pieCard = h('div', { class: 'report-card' }, h('div', { class: 'report-title' }, '맞은 문제와 틀린 문제'));
  if (!done) {
    pieCard.appendChild(h('div', { class: 'notice' }, '아직 채점된 문제가 없어요. 문제를 풀면 여기에 결과가 보여요.'));
  } else {
    var groups = [
      { key: 'O', label: '맞은 문제', n: rep.correct, color: 'var(--chart-correct)' },
      { key: 'X', label: '틀린 문제', n: rep.wrong, color: 'var(--chart-wrong)' }
    ];
    var pick = function (g) { if (g.key === 'X') openWrongBreakdown(rep, opt); else openReportList(rep, g, opt); };
    var legend = h('div', { class: 'pie-legend' });
    groups.forEach(function (g) {
      legend.appendChild(h('button', { class: 'legend-btn', type: 'button', disabled: !g.n, onclick: function () { pick(g); } },
        h('span', { class: 'dot', style: { background: g.color } }), h('span', { class: 'lg-label' }, g.label),
        h('b', null, g.n + '개'), h('span', { class: 'muted small' }, Math.round(g.n * 100 / done) + '%'), h('span', { class: 'lg-arrow' }, '›')));
    });
    pieCard.appendChild(h('div', { class: 'pie-wrap' }, reportPie(groups, done, [Math.round(rep.correct * 100 / done) + '%', '정답률'], pick), legend));
    pieCard.appendChild(h('div', { class: 'muted small', style: { marginTop: '10px' } }, '그래프 조각이나 버튼을 누르면 어떤 문제를 맞히고 틀렸는지 볼 수 있어요. 처음 풀이를 기준으로 해요.'));
  }
  if (rep.excluded) pieCard.appendChild(h('div', { class: 'muted small', style: { marginTop: '6px' } }, '변별도 정보가 없는 문제 ' + rep.excluded + '개는 리포트에서 뺐어요.'));
  if (rep.pending) pieCard.appendChild(h('div', { class: 'notice', style: { marginTop: '10px', marginBottom: 0 } }, '선생님이 확인 중인 문제 ' + rep.pending + '개는 결과가 나오면 반영돼요.'));
  root.appendChild(pieCard);

  // 2) AI 학습 평가 3줄
  var sumBody = h('div');
  var sumCard = h('div', { class: 'report-card' }, h('div', { class: 'report-title' }, '학습 평가'), sumBody);
  root.appendChild(sumCard);
  function loadSummary(saved) {
    sumBody.innerHTML = '';
    if (!done) { sumBody.appendChild(h('div', { class: 'muted' }, '문제를 풀면 AI가 학습 평가를 써 줘요.')); return; }
    sumBody.appendChild(inlineLoad('AI가 평가를 쓰고 있어요… (10~30초)'));
    (saved ? Promise.resolve(saved) : opt.summary()).then(function (res) {
      sumBody.innerHTML = '';
      var lines = (res && res.lines) || [];
      if (!lines.length) { sumBody.appendChild(h('div', { class: 'muted' }, '문제를 풀면 AI가 학습 평가를 써 줘요.')); return; }
      sumBody.appendChild(h('ul', { class: 'summary-lines' }, lines.map(function (l) { return h('li', { html: richHtml(l) }); })));
      var foot = h('div', { class: 'muted small summary-foot' }, 'AI가 풀이 기록을 보고 쓴 평가예요. 새로 푼 문제가 생기면 다시 써요.' + (res.at ? ' (' + String(res.at).slice(0, 16) + ')' : ''));
      sumBody.appendChild(foot);
    }).catch(function (e) {
      sumBody.innerHTML = '';
      var msg = (e.code === 'NOKEY' && opt.studentId) ? 'AI API 키가 아직 없어요. 오른쪽 위 ⚙ 설정에서 입력하면 학습 평가를 쓸 수 있어요.' : e.message;
      sumBody.appendChild(h('div', { class: 'notice warn', style: { marginBottom: '8px' } }, msg));
      sumBody.appendChild(h('button', { class: 'btn sm', onclick: function () { loadSummary(null); } }, '다시 시도'));
    });
  }
  loadSummary(rep.summary && rep.summary.lines && rep.summary.lines.length ? rep.summary : null);

  // 3) 총점: Σ(변별도×정오) / Σ(변별도) 를 100점 만점으로
  var sc = rep.score || {};
  root.appendChild(h('div', { class: 'report-card' },
    h('div', { class: 'report-title' }, '총점'),
    done ? h('div', { class: 'score-line' }, h('span', { class: 'score-big' }, fmtNum(sc.percent, 1)), h('span', { class: 'score-max' }, ' / 100점')) : h('div', { class: 'muted' }, '-'),
    done ? h('div', { class: 'score-bar' }, h('div', { style: { width: Math.max(0, Math.min(100, sc.percent)) + '%' } })) : null,
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, '문제마다 변별도(실력을 잘 구별하는 정도)를 반영한 점수예요. 변별도가 높은 문제를 맞힐수록 점수가 더 올라가요.' +
      (done ? ' (얻은 점수 ' + fmtNum(sc.earned, 2) + ' / 만점 ' + fmtNum(sc.max, 2) + ')' : ''))));

  // 4) 오개념 지도: 위계로 이어진 오개념, 여러 번 확인될수록 진하게
  root.appendChild(misGraphCard(rep.misGraph));
}

/* 틀린 문제의 오류 유형(주원인 Newman 단계) 색 */
// 색 순서는 검증 도구로 확인한 순서(이웃한 조각끼리 색각 이상에서도 구별되게). 범례에 이름·개수를 함께 쓴다.
var STAGE_COLORS = { '읽기': '#00897b', '이해': '#e8407a', '변형': '#b8860b', '처리기술': '#7a62d6', '인코딩': '#e86a3a', '기타': '#9a9a9a' };
var STAGE_SEQ = ['읽기', '이해', '변형', '처리기술', '인코딩', '기타'];

/** 틀린 문제 → 오류 유형 비율 원 그래프. 조각을 누르면 그 유형의 문제 목록을 아래에 보여 준다. */
function openWrongBreakdown(rep, opt) {
  var wrong = rep.items.filter(function (it) { return it.result === 'X'; });
  var stageOf = function (it) { return STAGE_COLORS[it.stage] && it.stage !== '기타' ? it.stage : '기타'; };
  var groups = STAGE_SEQ.map(function (s) {
    return { key: s, label: s, n: wrong.filter(function (it) { return stageOf(it) === s; }).length, color: STAGE_COLORS[s] };
  }).filter(function (g) { return g.n; });
  var listBox = h('div', { class: 'list', style: { marginTop: '14px' } });
  var legend = h('div', { class: 'pie-legend' });
  function show(g) {
    Array.prototype.forEach.call(legend.children, function (b) { b.classList.toggle('on', b.getAttribute('data-key') === g.key); });
    listBox.innerHTML = '';
    listBox.appendChild(h('div', { class: 'report-title', style: { margin: '4px 0 0' } }, g.label + ' 오류로 틀린 문제 (' + g.n + '개)'));
    var its = wrong.filter(function (it) { return stageOf(it) === g.key; });
    if (its[0] && its[0].stageExplain) listBox.appendChild(h('div', { class: 'muted small' }, its[0].stageExplain));
    its.forEach(function (it) { listBox.appendChild(reportItemCard(it, opt)); });
    setTimeout(function () { listBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
  groups.forEach(function (g) {
    var b = h('button', { class: 'legend-btn', type: 'button', onclick: function () { show(g); } },
      h('span', { class: 'dot', style: { background: g.color } }), h('span', { class: 'lg-label' }, g.label),
      h('b', null, g.n + '개'), h('span', { class: 'muted small' }, Math.round(g.n * 100 / wrong.length) + '%'), h('span', { class: 'lg-arrow' }, '›'));
    b.setAttribute('data-key', g.key);
    legend.appendChild(b);
  });
  var body = h('div', null,
    h('div', { class: 'muted small', style: { marginBottom: '10px' } }, '틀린 문제마다 가장 큰 원인이 된 오류 유형(Newman 단계)의 비율이에요. 조각이나 버튼을 누르면 그 유형으로 틀린 문제를 볼 수 있어요.'),
    h('div', { class: 'pie-wrap' }, reportPie(groups, wrong.length, [wrong.length + '개', '틀린 문제'], show), legend),
    listBox);
  openModal({ title: '틀린 문제의 오류 유형', wide: true, body: body });
}

/** 맞은 문제 / 틀린 문제 목록 팝업 */
function openReportList(rep, g, opt) {
  var list = rep.items.filter(function (it) { return it.result === g.key; });
  var body = h('div', { class: 'list' });
  list.forEach(function (it) { body.appendChild(reportItemCard(it, opt)); });
  openModal({ title: g.label + ' (' + list.length + '개)', wide: true, body: body });
}

function reportItemCard(it, opt) {
  var ok = it.result === 'O';
  var card = h('div', { class: 'rep-item ' + (ok ? 'ok' : 'bad') },
    h('div', { class: 'rep-head' },
      h('span', { class: 'badge ' + (ok ? 'green' : 'orange') }, ok ? '맞음' : '틀림'),
      h('span', { class: 'rep-concept', html: richHtml(it.conceptName) }),
      h('span', { class: 'muted small', style: { marginLeft: 'auto' } }, it.at || '')),
    it.preview ? h('div', { class: 'rep-prev', html: richHtml(it.preview) }) : null);

  if (!ok) {
    if (it.stage) {
      card.appendChild(h('div', { class: 'rep-cause' }, h('span', { class: 'badge red' }, '주원인 · ' + it.stage), ' ', it.stageExplain || ''));
    }
    if (it.misconceptions && it.misconceptions.length) {
      card.appendChild(h('div', { class: 'mis-box' }, h('div', { class: 'mis-title' }, '이런 오개념이 보여요'),
        h('ul', null, it.misconceptions.map(function (m) {
          return h('li', null, h('b', { html: '‘' + richHtml(m.concept) + '’' }), m.text ? h('span', { html: ' — ' + richHtml(m.text) }) : ' 개념을 잘못 이해하고 있어요.');
        }))));
    }
    if (it.reason) card.appendChild(h('details', { class: 'rep-reason' }, h('summary', null, 'AI 분석 자세히 보기'), h('div', { html: richHtml(it.reason) })));
  }

  var probBox = h('div');
  var btn = h('button', { class: 'btn sm', type: 'button' }, '문제 보기');
  btn.addEventListener('click', function () {
    if (probBox.childNodes.length) { probBox.innerHTML = ''; btn.textContent = '문제 보기'; return; }
    probBox.appendChild(inlineLoad('문제를 불러오고 있어요…'));
    btn.textContent = '문제 접기';
    api('api_reportProblem', S.token, it.itemId, opt.studentId || '').then(function (p) {
      probBox.innerHTML = '';
      probBox.appendChild(h('div', { class: 'rep-problem' }, problemBody(p)));
      if (p.figure) { var f = renderFigure(p.figure); if (f) probBox.appendChild(h('div', { class: 'figure-box' }, f)); }
    }).catch(function (e) { probBox.innerHTML = ''; probBox.appendChild(h('div', { class: 'notice warn' }, e.message)); });
  });
  card.appendChild(h('div', { style: { marginTop: '8px' } }, btn));
  card.appendChild(probBox);
  return card;
}

/* ---------- 학생: 리포트 받아보기 ---------- */
function renderStudentReport() {
  var page = h('div', { class: 'page report-page' });
  setApp(h('div', null, studentTopbar(h('button', { class: 'btn sm', onclick: renderStudentHome }, '← 문제 목록')), page));
  page.appendChild(h('div', { class: 'section-title' }, '나의 학습 리포트'));
  page.appendChild(reportView({
    load: function () { return api('api_myReport', S.token); },
    summary: function () { return api('api_myReportSummary', S.token); }
  }));
}

/* ---------- 교사: 학생 리포트 팝업 ---------- */
function openStudentReport(s) {
  openModal({
    title: s.num + '번 ' + s.name + ' 학생의 학습 리포트', wide: true,
    body: reportView({
      studentId: s.id,
      load: function () { return api('api_studentReport', S.token, s.id); },
      summary: function () { return api('api_studentReportSummary', S.token, s.id); }
    })
  });
}

/* ---------- 교사: 학급 리포트 ---------- */
function openClassReport(c) {
  var body = h('div', { class: 'report' }, inlineLoad('학급 리포트를 만들고 있어요…'));
  openModal({ title: c.label + ' 학급 리포트', wide: true, body: body });
  api('api_classReport', S.token, c.cls).then(function (r) {
    body.innerHTML = '';
    var sm = r.summary, d = sm.deficit;
    function stat(label, value, sub) { return h('div', { class: 'stat' }, h('div', { class: 'muted small' }, label), h('div', { class: 'stat-v' }, value), sub ? h('div', { class: 'muted small' }, sub) : null); }
    body.appendChild(h('div', { class: 'muted small' }, '만든 때: ' + String(r.generatedAt).slice(0, 16) + ' · 정답률·총점은 처음 풀이 기준, 변별도가 있는 문항만 셌어요.'));
    body.appendChild(h('div', { class: 'stat-grid' },
      stat('학생 수', sm.count + '명', '과제 모두 마침 ' + sm.ready + '명'),
      stat('평균 과제 진행률', sm.progress === null ? '-' : sm.progress + '%'),
      stat('학급 정답률', sm.rate === null ? '-' : sm.rate + '%'),
      stat('평균 총점', sm.score === null ? '-' : sm.score + '점')));
    body.appendChild(h('div', { class: 'report-card' },
      h('div', { class: 'report-title' }, '학습 결손 의심 학생 ', h('b', null, d.total + '명')),
      h('div', { class: 'deficit-row' },
        h('span', { class: 'deficit-badge red' }, '매우 심함 ' + d.severe + '명'),
        h('span', { class: 'deficit-badge orange' }, '심함 ' + d.serious + '명'),
        h('span', { class: 'deficit-badge yellow' }, '주의 ' + d.caution + '명')),
      h('div', { class: 'muted small', style: { marginTop: '8px' } }, '최소 성취수준 보장지도 기준: 총점 ' + sm.cuts[0] + '점 미만 주의 · ' + sm.cuts[1] + '점 미만 심함 · ' + sm.cuts[2] + '점 미만 매우 심함. 채점된 문제가 적은 학생은 판단 보류예요.')));
    var tb = h('tbody');
    r.students.forEach(function (s) {
      var pg = s.progress;
      tb.appendChild(h('tr', { class: 'click', title: pg.ready ? '눌러서 리포트 보기' : '과제 진행 중 · 눌러서 지금까지의 리포트 보기', onclick: function () { openStudentReport(s); } },
        h('td', null, String(s.num)), h('td', null, s.name, s.virtual ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, '가상') : null),
        h('td', null, pg.total ? pg.done + '/' + pg.total + ' (' + Math.round(pg.done * 100 / pg.total) + '%)' : '-'),
        h('td', null, s.rate === null ? '-' : s.rate + '% (' + s.correct + '/' + s.judged + ')'),
        h('td', null, s.score === null ? '-' : String(s.score)),
        h('td', null, h('span', { class: 'deficit-badge sm ' + (DEFICIT_CLASS[s.deficit.rank] || '') }, s.deficit.label))));
    });
    body.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, '번호'), h('th', null, '이름'), h('th', null, '과제 진행'), h('th', null, '정답률'), h('th', null, '총점'), h('th', null, '학습 결손'))), tb)));
  }).catch(function (e) { body.innerHTML = ''; body.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/* ---------- 오개념 지도: 선수개념 위계로 이은 노드 그래프 ---------- */
/* 색(한 가지 색의 진하기)은 확인된 횟수: 1회 · 2회 · 3회 · 4회 이상. 아래쪽이 기초(선수) 개념, 화살표는 선수 → 후속. */
// 오개념 지도 색: 화면의 강조색 한 가지의 진하기(학생 = 진한 녹색, 교사 = 웜 오텀 적갈색). 검증 도구로 확인한 단계.
var MIS_RAMPS = {
  student: [
    { min: 1, label: '1회', fill: '#8cbf9f', ink: '#1a1a1a' },
    { min: 2, label: '2회', fill: '#4f8f69', ink: '#1a1a1a' },
    { min: 3, label: '3회', fill: '#2c6446', ink: '#ffffff' },
    { min: 4, label: '4회 이상', fill: '#173d2e', ink: '#ffffff' }],
  teacher: [
    { min: 1, label: '1회', fill: '#e0a281', ink: '#1a1a1a' },
    { min: 2, label: '2회', fill: '#cc7a4f', ink: '#1a1a1a' },
    { min: 3, label: '3회', fill: '#a94d26', ink: '#ffffff' },
    { min: 4, label: '4회 이상', fill: '#713016', ink: '#ffffff' }]
};
var MIS_RAMP = MIS_RAMPS.student;
function misShade(n) { var s = MIS_RAMP[0]; MIS_RAMP.forEach(function (r) { if (n >= r.min) s = r; }); return s; }

/** 이름을 한 줄 글자 수에 맞춰 최대 두 줄로 나눈다(넘치면 …). */
/** 툴팁용: 수식 기호를 걷어 낸 읽기 쉬운 글자 */
function misPlain(t) {
  return String(t || '').replace(/\$([^$]*)\$/g, function (m, x) { return x.replace(/\\(left|right|,|;|!)/g, '').replace(/\\[a-zA-Z]+/g, function (c) { return ({ '\\times': '×', '\\div': '÷', '\\pi': 'π', '\\sqrt': '√', '\\le': '≤', '\\ge': '≥', '\\ne': '≠', '\\pm': '±', '\\cdot': '·', '\\theta': 'θ' })[c] || ''; }).replace(/[{}]/g, ''); });
}

function misWrap(name, per) {
  var t = String(name || '').replace(/\s+/g, ' ').trim();
  if (t.length <= per) return [t];
  var cut = t.lastIndexOf(' ', per);
  if (cut < per * 0.5) cut = per;
  var a = t.slice(0, cut).trim(), b = t.slice(cut).trim();
  if (b.length > per) b = b.slice(0, per - 1) + '…';
  return [a, b];
}

function misGraphCard(g) {
  MIS_RAMP = document.body.classList.contains('theme-teacher') ? MIS_RAMPS.teacher : MIS_RAMPS.student;
  var card = h('div', { class: 'report-card mis-graph-card' }, h('div', { class: 'report-title' }, '오개념 지도'));
  if (!g || !g.nodes || !g.nodes.filter(function (n) { return !n.bridge; }).length) {
    card.appendChild(h('div', { class: 'muted' }, '아직 확인된 오개념이 없어요. 틀린 문제에서 오개념이 확인되면 여기에 지도로 보여 줘요.'));
    return card;
  }
  var byId = {};
  g.nodes.forEach(function (n) { byId[n.id] = n; });
  var up = {}, down = {}; // up[x] = x의 선수들, down[x] = x의 후속들
  g.edges.forEach(function (e) { (up[e.to] = up[e.to] || []).push(e.from); (down[e.from] = down[e.from] || []).push(e.to); });
  var linked = {};
  g.edges.forEach(function (e) { linked[e.from] = linked[e.to] = true; });
  var mis = g.nodes.filter(function (n) { return !n.bridge; });
  var chained = mis.filter(function (n) { return linked[n.id]; });
  var alone = mis.filter(function (n) { return !linked[n.id]; }).sort(function (a, b) { return b.count - a.count; });

  // 묶음(연결 요소) 세기: 오개념이 2개 이상 이어진 묶음
  var comp = {};
  function find(x) { while (comp[x] !== x) x = comp[x] = comp[comp[x]]; return x; }
  Object.keys(linked).forEach(function (x) { comp[x] = x; });
  g.edges.forEach(function (e) { comp[find(e.from)] = find(e.to); });
  var compMis = {};
  chained.forEach(function (n) { var r = find(n.id); compMis[r] = (compMis[r] || 0) + 1; });
  var chainCount = Object.keys(compMis).filter(function (k) { return compMis[k] >= 2; }).length;

  var top = mis.slice().sort(function (a, b) { return b.count - a.count; })[0];
  card.appendChild(h('div', { class: 'mis-summary' },
    h('span', null, '확인된 오개념 ', h('b', null, g.total + '개')),
    h('span', null, '위계로 이어진 묶음 ', h('b', null, chainCount + '개')),
    top.count >= 2 ? h('span', null, '가장 많이 확인 ', h('b', { html: richHtml(top.name) }), ' (' + top.count + '회)') : null));
  card.appendChild(h('div', { class: 'muted small', style: { marginBottom: '10px' } },
    '아래쪽이 먼저 배우는 기초(선수) 개념, 위쪽이 그 위에 쌓이는 개념이에요. 화살표는 "먼저 알아야 하는 개념 → 다음 개념"이고, 색이 진할수록 여러 번 확인된 오개념이에요. 개념을 누르면 이어진 오개념이 함께 표시돼요.' +
    (g.total > g.shown ? ' (많이 확인된 ' + g.shown + '개만 그렸어요)' : '')));

  // 범례
  var legend = h('div', { class: 'mis-legend' });
  MIS_RAMP.forEach(function (r) { legend.appendChild(h('span', { class: 'mis-lg' }, h('span', { class: 'mis-sw', style: { background: r.fill } }), r.label)); });
  if (g.nodes.some(function (n) { return n.bridge; })) legend.appendChild(h('span', { class: 'mis-lg' }, h('span', { class: 'mis-sw bridge' }), '사이를 잇는 선수개념(오개념 아님)'));
  if (g.edges.length) {
    legend.appendChild(h('span', { class: 'mis-lg' }, h('span', { class: 'mis-ln' }), '바로 선수 관계'));
    if (g.edges.some(function (e) { return !e.direct; })) legend.appendChild(h('span', { class: 'mis-lg' }, h('span', { class: 'mis-ln dash' }), '중간 개념을 거쳐 이어짐'));
  }
  card.appendChild(legend);

  var detail = h('div', { class: 'mis-detail', 'aria-live': 'polite' });
  var selected = null, svgNodes = {}, svgEdges = [], chipEls = {};

  function related(id) {
    var set = {}; set[id] = true;
    [[up, true], [down, false]].forEach(function (pair) {
      var stack = [id];
      while (stack.length) { var x = stack.pop(); (pair[0][x] || []).forEach(function (y) { if (!set[y]) { set[y] = true; stack.push(y); } }); }
    });
    return set;
  }
  function chainMis(id, map) {
    var out = [], seen = {}, stack = [id];
    while (stack.length) {
      var x = stack.pop();
      (map[x] || []).forEach(function (y) { if (seen[y]) return; seen[y] = true; stack.push(y); if (!byId[y].bridge) out.push(byId[y]); });
    }
    return out;
  }
  function select(id) {
    selected = selected === id ? null : id;
    var rel = selected ? related(selected) : null;
    Object.keys(svgNodes).forEach(function (k) {
      svgNodes[k].classList.toggle('dim', !!rel && !rel[k]);
      svgNodes[k].classList.toggle('sel', k === selected);
    });
    svgEdges.forEach(function (e) { e.el.classList.toggle('dim', !!rel && !(rel[e.from] && rel[e.to])); });
    Object.keys(chipEls).forEach(function (k) { chipEls[k].classList.toggle('dim', !!selected && k !== selected); chipEls[k].classList.toggle('sel', k === selected); });
    drawDetail();
  }
  function drawDetail() {
    detail.innerHTML = '';
    if (!selected) { detail.appendChild(h('div', { class: 'muted small' }, '개념을 누르면 자세한 내용이 여기에 보여요.')); return; }
    var n = byId[selected];
    var box = h('div', { class: 'mis-detail-box' });
    box.appendChild(h('div', { class: 'mis-detail-head' },
      n.bridge ? null : h('span', { class: 'mis-sw', style: { background: misShade(n.count).fill } }),
      h('b', { html: richHtml(n.name) }), n.grade ? h('span', { class: 'badge' }, n.grade) : null,
      n.bridge ? h('span', { class: 'muted small' }, '사이를 잇는 선수개념') : h('span', { class: 'muted small' }, n.count + '번 확인됨')));
    if (n.bridge) {
      box.appendChild(h('div', { class: 'small', style: { marginTop: '6px' } }, '이 개념은 오개념으로 확인되지는 않았지만, 아래·위의 오개념을 이어 주는 선수개념이에요. 두 오개념이 함께 나타난 까닭을 살필 때 같이 확인해 보면 좋아요.'));
    } else {
      var st = Object.keys(n.stages || {}).map(function (k) { return k + ' ' + n.stages[k] + '번'; });
      var meta = [];
      if (st.length) meta.push('오류 단계: ' + st.join(' · '));
      if (n.tutor) meta.push('유도질문에서 확인 ' + n.tutor + '번');
      if (n.last) meta.push('최근 확인 ' + n.last);
      if (meta.length) box.appendChild(h('div', { class: 'muted small', style: { marginTop: '4px' } }, meta.join(' / ')));
    }
    var pres = chainMis(selected, up), posts = chainMis(selected, down);
    function names(list) { return list.map(function (x) { return '‘' + x.name + '’(' + x.count + '회)'; }).join(', '); }
    if (pres.length) box.appendChild(h('div', { class: 'small mis-rel' }, h('b', null, '이어진 선수 쪽 오개념: '), h('span', { html: richHtml(names(pres)) })));
    if (posts.length) box.appendChild(h('div', { class: 'small mis-rel' }, h('b', null, '이어진 후속 쪽 오개념: '), h('span', { html: richHtml(names(posts)) })));
    if (!n.bridge && pres.length) box.appendChild(h('div', { class: 'small mis-tip' }, '💡 선수 쪽 오개념이 먼저 바로잡히면 이 개념의 오개념도 함께 풀릴 수 있어요. 아래쪽 개념부터 복습해 보세요.'));
    if (!n.bridge && !pres.length && !posts.length) box.appendChild(h('div', { class: 'small mis-rel muted' }, '위계로 이어진 다른 오개념은 없어요.'));
    detail.appendChild(box);
  }

  if (chained.length) card.appendChild(misGraphSvg(g, byId, up, down, select, svgNodes, svgEdges));
  if (alone.length) {
    card.appendChild(h('div', { class: 'mis-sub' }, chained.length ? '따로 확인된 오개념 (위계로 이어진 다른 오개념 없음)' : '확인된 오개념 (위계로 이어진 것은 없어요)'));
    var chips = h('div', { class: 'mis-chips' });
    alone.forEach(function (n) {
      var sh = misShade(n.count);
      var c = h('button', { class: 'mis-chip', type: 'button', style: { background: sh.fill, color: sh.ink }, title: misPlain(n.name) + ' · ' + (n.grade || '') + ' · ' + n.count + '번 확인', onclick: function () { select(n.id); } },
        h('span', { html: richHtml(n.name) }), h('span', { class: 'mis-chip-n' }, n.count + '회'));
      chipEls[n.id] = c;
      chips.appendChild(c);
    });
    card.appendChild(chips);
  }
  card.appendChild(detail);
  drawDetail();

  // 표로 보기(색을 구별하기 어려운 경우·인쇄용)
  var tb = h('tbody');
  mis.slice().sort(function (a, b) { return b.count - a.count; }).forEach(function (n) {
    tb.appendChild(h('tr', null, h('td', { html: richHtml(n.name) }), h('td', null, n.grade || '-'), h('td', null, n.count + '회'),
      h('td', { html: richHtml(chainMis(n.id, up).map(function (x) { return x.name; }).join(', ') || '-') }),
      h('td', { html: richHtml(chainMis(n.id, down).map(function (x) { return x.name; }).join(', ') || '-') })));
  });
  card.appendChild(h('details', { class: 'mis-table' }, h('summary', null, '표로 보기'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, '오개념'), h('th', null, '학년'), h('th', null, '확인 횟수'), h('th', null, '이어진 선수 오개념'), h('th', null, '이어진 후속 오개념'))), tb))));
  return card;
}

/** 이어진 오개념만 층으로 나눠 그린다: 아래층이 선수(기초), 화살표는 위로. */
function misGraphSvg(g, byId, up, down, onPick, svgNodes, svgEdges) {
  var ids = Object.keys(byId).filter(function (id) { return (up[id] && up[id].length) || (down[id] && down[id].length); });
  // 층: 가장 긴 선수 사슬의 길이(선수 없는 개념이 0층)
  var layer = {};
  ids.forEach(function (id) { layer[id] = 0; });
  for (var it = 0; it < ids.length + 1; it++) {
    var moved = false;
    g.edges.forEach(function (e) { if (layer[e.to] < layer[e.from] + 1 && layer[e.from] + 1 <= ids.length) { layer[e.to] = layer[e.from] + 1; moved = true; } });
    if (!moved) break;
  }
  var maxL = 0;
  ids.forEach(function (id) { maxL = Math.max(maxL, layer[id]); });
  var rows = [];
  for (var l = 0; l <= maxL; l++) rows.push([]);
  ids.sort(function (a, b) { return (byId[a].gradeRank - byId[b].gradeRank) || (byId[b].count || 0) - (byId[a].count || 0); })
    .forEach(function (id) { rows[layer[id]].push(id); });
  // 겹침 줄이기: 이웃 층 위치의 평균으로 위·아래 번갈아 정렬
  var pos = {};
  function index() { rows.forEach(function (r) { r.forEach(function (id, i) { pos[id] = (i + 0.5) / r.length; }); }); }
  index();
  for (var sweep = 0; sweep < 4; sweep++) {
    var order = sweep % 2 ? rows.slice().reverse() : rows;
    order.forEach(function (r) {
      r.sort(function (a, b) {
        function bc(x) { var nb = (sweep % 2 ? down[x] : up[x]) || []; nb = nb.filter(function (y) { return pos[y] !== undefined; }); return nb.length ? nb.reduce(function (s, y) { return s + pos[y]; }, 0) / nb.length : pos[x]; }
        return bc(a) - bc(b);
      });
      r.forEach(function (id, i) { pos[id] = (i + 0.5) / r.length; });
    });
  }
  var NW = 132, NH = 56, BW = 116, BH = 40, GX = 22, RH = 100, PADX = 16, PADT = 26, PADB = 26;
  var widest = Math.max.apply(null, rows.map(function (r) { return r.length; }));
  var W = Math.max(320, widest * (NW + GX) - GX + PADX * 2);
  var H = PADT + maxL * RH + NH + PADB;
  var minW = Math.round(W * 0.85);
  var xy = {};
  rows.forEach(function (r, L) {
    var rowW = r.reduce(function (s, id) { return s + (byId[id].bridge ? BW : NW); }, 0) + GX * (r.length - 1);
    var x = (W - rowW) / 2;
    var cy = PADT + (maxL - L) * RH + NH / 2;
    r.forEach(function (id) {
      var w = byId[id].bridge ? BW : NW, hh = byId[id].bridge ? BH : NH;
      xy[id] = { x: x, y: cy - hh / 2, w: w, h: hh, cx: x + w / 2 };
      x += w + GX;
    });
  });

  var svg = svgEl('svg', { class: 'mis-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', style: { width: '100%', maxWidth: W + 'px', minWidth: minW + 'px' },
    'aria-label': '오개념 지도: 이어진 오개념 ' + ids.filter(function (id) { return !byId[id].bridge; }).length + '개' });
  var defs = svgEl('defs');
  [['misArrow', '#0a0a0a'], ['misArrowSoft', '#9a9a9a']].forEach(function (a) {
    defs.appendChild(svgEl('marker', { id: a[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svgEl('path', { d: 'M0 1 L9 5 L0 9 Z', fill: a[1] })));
  });
  svg.appendChild(defs);
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent', onclick: function () { onPick(null); } }));
  if (maxL > 0) {
    var tTop = svgEl('text', { x: 6, y: 12, class: 'mis-axis' }); tTop.textContent = '▲ 심화';
    var tBot = svgEl('text', { x: 6, y: H - 8, class: 'mis-axis' }); tBot.textContent = '기초(선수)';
    svg.appendChild(tTop); svg.appendChild(tBot);
  }
  var eg = svgEl('g');
  g.edges.forEach(function (e) {
    var a = xy[e.from], b = xy[e.to];
    if (!a || !b) return;
    var x1 = a.cx, y1 = a.y, x2 = b.cx, y2 = b.y + b.h + 2, dy = Math.max(24, (y1 - y2) * 0.45);
    var p = svgEl('path', { d: 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 - dy) + ' ' + x2 + ' ' + (y2 + dy) + ' ' + x2 + ' ' + y2,
      class: 'mis-edge' + (e.direct ? ' direct' : ''), 'marker-end': 'url(#' + (e.direct ? 'misArrow' : 'misArrowSoft') + ')' });
    svgEdges.push({ el: p, from: e.from, to: e.to });
    eg.appendChild(p);
  });
  svg.appendChild(eg);
  ids.forEach(function (id) {
    var n = byId[id], b = xy[id];
    var gg = svgEl('g', { class: 'mis-node' + (n.bridge ? ' bridge' : ''), tabindex: 0, role: 'button',
      onclick: function (ev) { ev.stopPropagation(); onPick(id); },
      onkeydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(id); } } });
    var tt = svgEl('title');
    tt.textContent = misPlain(n.name) + (n.grade ? ' (' + n.grade + ')' : '') + (n.bridge ? ' · 사이를 잇는 선수개념' : ' · ' + n.count + '번 확인된 오개념');
    gg.appendChild(tt);
    var sh = n.bridge ? null : misShade(n.count);
    gg.appendChild(svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, class: 'mis-box', style: sh ? { fill: sh.fill } : {} }));
    // 이름에 수식이 있으면 SVG 글자로는 깨지므로 HTML(KaTeX)로 그린다
    if (/\$|\\\(/.test(n.name)) {
      var fo = svgEl('foreignObject', { x: b.x + 4, y: b.y + 7, width: b.w - 8, height: b.h - 10, class: 'mis-fo' });
      var lab = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      lab.className = 'mis-html' + (n.bridge ? ' bridge' : '');
      lab.style.color = sh ? sh.ink : '#3a3a3a';
      var inner = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      inner.innerHTML = richHtml(n.name);
      lab.appendChild(inner);
      fo.appendChild(lab);
      gg.appendChild(fo);
    } else {
      var lines = misWrap(n.name, n.bridge ? 9 : 10);
      lines.forEach(function (t, i) {
        var tx = svgEl('text', { x: b.cx, y: b.y + b.h / 2 + (i - (lines.length - 1) / 2) * 15 + 4.5, class: 'mis-label', style: { fill: sh ? sh.ink : '#3a3a3a' } });
        tx.textContent = t;
        gg.appendChild(tx);
      });
    }
    if (n.grade) {
      // 학년은 왼쪽 위 작은 표(아래쪽은 화살표가 들어오는 자리라 비워 둔다)
      var gw = 10 + n.grade.length * 11;
      gg.appendChild(svgEl('rect', { x: b.x - 4, y: b.y - 9, width: gw, height: 18, rx: 9, class: 'mis-grade-bg' }));
      var gt = svgEl('text', { x: b.x - 4 + gw / 2, y: b.y + 4, class: 'mis-grade' }); gt.textContent = n.grade; gg.appendChild(gt);
    }
    if (!n.bridge) {
      var label = n.count + '회', bw = 12 + label.length * 7;
      gg.appendChild(svgEl('rect', { x: b.x + b.w - bw + 6, y: b.y - 9, width: bw, height: 18, rx: 9, class: 'mis-badge', style: { stroke: sh.fill } }));
      var ct = svgEl('text', { x: b.x + b.w - bw / 2 + 6, y: b.y + 4, class: 'mis-badge-t' }); ct.textContent = label;
      gg.appendChild(ct);
    }
    svgNodes[id] = gg;
    svg.appendChild(gg);
  });
  var wrap = h('div', { class: 'mis-graph-wrap' }, svg);
  var hint = h('div', { class: 'muted small mis-scroll-hint' }, '↔ 옆으로 밀어서 전체를 볼 수 있어요.');
  // 화면이 좁아 그래프가 넘치면 안내를 보여 준다.
  setTimeout(function () { hint.style.display = wrap.scrollWidth > wrap.clientWidth + 4 ? '' : 'none'; }, 60);
  return h('div', null, wrap, hint);
}
