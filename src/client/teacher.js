/* ===================== 교사 화면 ===================== */
var TT = { tab: 'folders', home: null };

function renderTeacher(tab) {
  TT.tab = tab || TT.tab || 'folders';
  var page = h('div', { class: 'page' });
  setApp(h('div', null, topbar(h('span', { class: 'small muted', style: { minWidth: '42px' } }, brandSchool()), (S.profile.name || '') + ' 선생님', settingsButton(openTeacherSettings)), page));
  var helpLabel = h('span', null, '선생님의 풀이가 필요해요');
  function tabBtn(key, label) {
    return h('button', { class: 'tab' + (TT.tab === key ? ' active' : ''), type: 'button', onclick: function () { renderTeacher(key); } }, label);
  }
  var tabs = h('div', { class: 'tabs', style: { marginTop: '6px' } }, tabBtn('folders', '반별 폴더'), tabBtn('help', helpLabel), tabBtn('bank', '문제 출제'), tabBtn('data', 'DB 보기'));
  page.appendChild(tabs);
  // 휴대폰에서 탭 줄이 가로로 넘칠 때 선택한 탭이 보이게
  function showActiveTab() {
    var a = tabs.querySelector('.active');
    if (!a) return;
    var over = a.getBoundingClientRect().right - tabs.getBoundingClientRect().right;
    if (over > 0) tabs.scrollLeft += over + 14;
  }
  setTimeout(showActiveTab, 0);
  var noticeBox = h('div');
  page.appendChild(noticeBox);
  var body = h('div');
  page.appendChild(body);
  api('api_teacherHome', S.token).then(function (home) {
    TT.home = home;
    if (home.pending) { helpLabel.textContent = '선생님의 풀이가 필요해요 (' + home.pending + ')'; showActiveTab(); }
    if (!home.aiReady) noticeBox.appendChild(h('div', { class: 'notice warn' }, 'AI API 키가 아직 없어요. 오른쪽 위 ⚙ 설정에서 입력해야 학생 풀이를 분석할 수 있어요.'));
    if (TT.tab === 'help') renderHelpList(body);
    else if (TT.tab === 'bank') renderBank(body);
    else if (TT.tab === 'data') renderData(body);
    else renderFolders(body);
  }).catch(function (e) { body.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/* ---------- 반별 폴더 ---------- */
function renderFolders(body) {
  body.innerHTML = '';
  var grid = h('div', { class: 'folder-grid' });
  TT.home.classes.forEach(function (c) {
    // 대시보드 카드: 제목 + 큰 숫자 칸(학생 수 · 가입)
    grid.appendChild(h('div', { class: 'folder', onclick: function () { renderClass(body, c); } },
      h('div', { class: 'folder-head' }, h('div', { class: 'card-title' }, c.label), h('span', { class: 'go', 'aria-hidden': 'true' }, '↗')),
      h('div', { class: 'stat-row' },
        h('div', { class: 'mini-stat' }, h('b', { class: 'key' }, String(c.count)), h('span', null, '학생 수')),
        h('div', { class: 'mini-stat' }, h('b', null, String(c.registered)), h('span', null, '가입')),
        h('div', { class: 'mini-stat' }, h('b', null, String(Math.max(0, c.count - c.registered))), h('span', null, '미가입')))));
  });
  body.appendChild(grid);
}

function renderClass(body, c) {
  body.innerHTML = '';
  body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
    h('button', { class: 'btn sm', onclick: function () { renderFolders(body); } }, '← 폴더'), h('b', null, '📂 ' + c.label),
    h('button', { class: 'btn sm primary', style: { marginLeft: 'auto' }, onclick: function () { openClassReport(c); } }, '📊 학급 리포트 만들기')));
  var holder = h('div');
  holder.appendChild(inlineLoad());
  body.appendChild(holder);
  api('api_classStudents', S.token, c.cls).then(function (list) {
    holder.innerHTML = '';
    var tb = h('tbody');
    list.forEach(function (s) {
      var reset = h('button', {
        class: 'btn sm danger', disabled: !s.registered, onclick: function (e) {
          e.stopPropagation();
          confirmModal(s.num + '번 ' + s.name + ' 학생의 가입을 초기화할까요? 학생은 같은 학번으로 다시 회원가입해야 해요.', '초기화').then(function (ok) {
            if (!ok) return;
            api('api_resetStudent', S.token, s.id).then(function () { toast('초기화했어요.'); renderClass(body, c); }).catch(function (er) { toast(er.message, 'err'); });
          });
        }
      }, '비밀번호 초기화');
      var rp = s.report || {};
      // 선생님은 과제를 다 마치지 않은 학생의 리포트도 지금까지 푼 문제로 만들 수 있다(학생은 다 마쳐야 열림).
      var repBtn = h('button', {
        class: 'btn sm' + (rp.ready ? ' primary' : ''), title: rp.ready ? '' : '과제 진행 중(' + (rp.done || 0) + '/' + (rp.total || 0) + ') · 지금까지 푼 문제로 리포트를 만들어요',
        onclick: function (e) { e.stopPropagation(); openStudentReport(s); }
      }, rp.ready ? '리포트 받아보기' : '리포트 보기 · ' + (rp.done || 0) + '/' + (rp.total || 0));
      tb.appendChild(h('tr', null,
        h('td', null, String(s.num)), h('td', null, s.name, s.virtual ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, '가상') : null),
        h('td', null, s.registered ? h('span', { class: 'badge green' }, '가입') : h('span', { class: 'badge' }, '미가입')),
        h('td', null, String(s.submitted)), h('td', null, s.rate === null ? '-' : s.rate + '%'), h('td', { class: 'small muted' }, s.lastAccess ? String(s.lastAccess).slice(5, 16) : '-'), h('td', null, repBtn), h('td', null, reset)));
    });
    holder.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl roster' }, h('thead', null, h('tr', null, h('th', null, '번호'), h('th', null, '이름'), h('th', null, '가입'), h('th', null, '제출'), h('th', null, '정답률'), h('th', null, '최근 접속'), h('th', null, '리포트'), h('th', null, '계정'))), tb)));
    holder.appendChild(h('div', { class: 'muted small', style: { marginTop: '8px' } }, '선생님은 과제를 다 마치지 않은 학생의 리포트도 지금까지 푼 문제로 볼 수 있어요(숫자는 마친 과제/전체 과제). 학생은 과제를 모두 마치면 [리포트 받아보기]가 열리고, 학습 결손 진단은 선생님 리포트에만 보여요.'));
  }).catch(function (e) { holder.innerHTML = ''; holder.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/* ---------- 선생님의 풀이가 필요해요 ---------- */
function renderHelpList(body) {
  body.innerHTML = '';
  body.appendChild(inlineLoad());
  api('api_helpList', S.token).then(function (list) {
    body.innerHTML = '';
    if (!list.length) { body.appendChild(h('div', { class: 'notice' }, '요청이 없어요. AI가 판단을 보류한 풀이가 여기에 모여요.')); return; }
    var l = h('div', { class: 'list' });
    list.forEach(function (r) {
      l.appendChild(h('div', { class: 'item-card', onclick: function () { openHelpDetail(r.requestId, body); } },
        h('div', { class: 'item-no', style: { width: 'auto', padding: '0 10px' } }, r.cls + '-' + r.num),
        h('div', { class: 'item-body' }, h('div', { class: 'item-title' }, r.name + ' · ', h('span', { html: richHtml(r.conceptName) })), h('div', { class: 'item-prev' }, r.reason)),
        h('div', { style: { textAlign: 'right' } }, h('span', { class: 'badge ' + (r.status === '대기' ? 'orange' : 'green') }, r.status), h('div', { class: 'small muted', style: { marginTop: '4px' } }, String(r.at).slice(5, 16)))));
    });
    body.appendChild(l);
  }).catch(function (e) { body.innerHTML = ''; body.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

function linesBlock(lines) {
  return h('div', { class: 'pre-lines', html: (lines || []).map(function (l, i) { return '<div><span class="muted">' + (i + 1) + '.</span> ' + plainLineHtml(l.text) + (l.uncertain ? ' <span class="badge orange">인식 불확실</span>' : '') + '</div>'; }).join('') || '<span class="muted">(없음)</span>' });
}

/** AI가 읽은 학생의 의도·생각·이해 수준 (가설) */
function thinkingBlock(a) {
  var box = h('div');
  var u = a.understanding, it = a.intent;
  if (!u && !(it && it.strategy) && !(a.beliefs && a.beliefs.length) && !(a.candidates && a.candidates.length)) return box;
  box.appendChild(h('div', { class: 'section-title' }, '학생의 생각과 이해 수준 (가설)'));
  var kv = h('div', { class: 'kv analysis-kv' });
  // AI 글에 $…$ 수식이 섞여 오므로 모두 수식으로 그려 보여 준다.
  if (u) kv.appendChild(h('div', { class: 'k' }, '이해 수준')), kv.appendChild(h('div', null, h('span', { class: 'badge blue' }, u.level), u.evidence ? h('div', { class: 'muted small', html: '근거: ' + richHtml(u.evidence) }) : null));
  if (it && it.strategy) kv.appendChild(h('div', { class: 'k' }, '택한 전략')), kv.appendChild(h('div', { html: richHtml(it.strategy) + (it.fitsProblem === false ? ' (문제에 맞지 않음)' : '') }));
  (a.beliefs || []).forEach(function (b) { kv.appendChild(h('div', { class: 'k' }, '학생의 생각')); kv.appendChild(h('div', { html: richHtml(b) })); });
  if (u && u.strengths && u.strengths.length) kv.appendChild(h('div', { class: 'k' }, '잘한 점')), kv.appendChild(h('ul', { class: 'kv-list' }, u.strengths.map(function (x) { return h('li', { html: richHtml(x) }); })));
  if (u && u.gaps && u.gaps.length) kv.appendChild(h('div', { class: 'k' }, '부족한 점')), kv.appendChild(h('ul', { class: 'kv-list' }, u.gaps.map(function (x) { return h('li', { html: richHtml(x) }); })));
  if (u && u.checkQuestion) kv.appendChild(h('div', { class: 'k' }, '확인 질문')), kv.appendChild(h('div', { html: richHtml(u.checkQuestion) }));
  box.appendChild(kv);
  if (a.candidates && a.candidates.length) {
    box.appendChild(h('div', { class: 'muted small', style: { marginTop: '10px' } }, '오개념 후보 (확신도 순 · 유도질문에서 확인해요)'));
    box.appendChild(h('div', { class: 'cand-list' }, a.candidates.map(function (c) {
      var pct = Math.round((c.confidence || 0) * 100);
      return h('div', { class: 'cand' },
        h('div', { class: 'cand-head' }, h('b', { html: richHtml(c.conceptName || '(개념 미상)') }),
          c.kind ? h('span', { class: 'badge' }, c.kind) : null, c.level ? h('span', { class: 'badge blue' }, c.level) : null,
          h('span', { class: 'cand-conf' }, h('span', { class: 'cand-bar' }, h('span', { style: { width: pct + '%' } })), pct + '%')),
        c.belief ? h('div', { class: 'small', html: richHtml(c.belief) }) : null,
        c.evidence ? h('div', { class: 'err-sub', html: '<b>근거</b> ' + richHtml(c.evidence) }) : null);
    })));
  }
  if (it && it.lines && it.lines.length) {
    box.appendChild(h('div', { class: 'muted small', style: { marginTop: '8px' } }, '줄별 의도'));
    box.appendChild(h('div', { class: 'pre-lines' }, it.lines.map(function (l) {
      return h('div', null, h('span', { class: 'muted' }, (l.line || '-') + '. '), h('span', { html: richHtml(l.intent) }), l.ok ? '' : h('span', { class: 'badge red', style: { marginLeft: '6px' } }, '오류'));
    })));
  }
  return box;
}

function openHelpDetail(requestId, listBody) {
  showLoading('요청 내용을 불러오고 있어요…');
  api('api_helpDetail', S.token, requestId).then(function (d) {
    hideLoading();
    var left = h('div');
    if (d.item) {
      left.appendChild(problemCard({ conceptName: d.item.conceptName, text: d.item.text, figure: d.item.figure, image: d.item.image, hasImage: !!d.item.imageId }));
      left.appendChild(h('div', { class: 'kv', style: { marginTop: '10px' } }, h('div', { class: 'k' }, '정답'), h('div', { html: richHtml(d.item.answer) }), h('div', { class: 'k' }, '문항코드'), h('div', null, d.item.code)));
    }
    if (d.image) left.appendChild(h('img', { src: d.image, class: 'photo-prev', style: { marginTop: '12px' }, onclick: function () { zoomImage(d.image); } }));
    else left.appendChild(h('div', { class: 'muted small', style: { marginTop: '12px' } }, '(풀이 사진 없음)'));
    var right = h('div');
    right.appendChild(h('div', { class: 'notice warn' }, h('b', null, '요청 사유: '), d.request.reason));
    if (d.submission) {
      right.appendChild(h('div', { class: 'kv', style: { marginBottom: '8px' } },
        h('div', { class: 'k' }, '이해 못 함'), h('div', null, d.submission.notUnderstood === 'Y' ? '예 (도움 설명을 보고도 이해 못 해 넘어감)' : '-'),
        h('div', { class: 'k' }, '자기교정'), h('div', null, d.submission.selfCorrection || '-'),
        h('div', { class: 'k' }, '학생 최종 답'), h('div', null, d.submission.studentAnswer || '-')));
      right.appendChild(h('div', { class: 'section-title' }, 'AI가 읽은 원본'));
      right.appendChild(linesBlock(d.submission.aiLines));
      right.appendChild(h('div', { class: 'section-title' }, '학생이 확인·수정한 풀이'));
      right.appendChild(linesBlock(d.submission.lines));
    }
    if (d.analysis) right.appendChild(thinkingBlock(d.analysis));
    if (d.analysis && d.analysis.errors && d.analysis.errors.length) {
      right.appendChild(h('div', { class: 'section-title' }, 'AI 분석 (가설)'));
      d.analysis.errors.forEach(function (e) {
        right.appendChild(h('div', { class: 'err-item' + (e.primary ? ' primary' : '') },
          h('div', { class: 'err-head' }, h('b', null, '[' + e.stage + '] ' + (e.category || '')), e.line ? h('span', { class: 'muted small' }, ' ' + e.line + '번째 줄') : null),
          e.description ? h('div', { html: richHtml(e.description) }) : null,
          e.evidence ? h('div', { class: 'err-sub', html: '<b>근거</b> ' + richHtml(e.evidence) }) : null,
          e.uncertainty ? h('div', { class: 'err-sub', html: '<b>불확실성</b> ' + richHtml(e.uncertainty) }) : null,
          h('div', { class: 'err-sub', html: '확신도 ' + Math.round((e.confidence || 0) * 100) + '%' + (e.conceptName ? ' · 개념: ' + richHtml(e.conceptName) : '') })));
      });
    }
    var ans = h('textarea', { class: 'input', rows: 4, placeholder: '학생에게 보낼 풀이나 답변 ($x^2$처럼 수식 입력 가능)' }, d.request.answer || '');
    var stage = h('select', { class: 'input' }, h('option', { value: '' }, '판정 안 함'), h('option', { value: '정답' }, '정답'),
      ['읽기', '이해', '변형', '처리기술', '인코딩'].map(function (s) { return h('option', { value: s }, s + ' 오류'); }));
    var concept = h('select', { class: 'input' }, h('option', { value: '' }, '관련 개념 선택 안 함'), (d.candidates || []).map(function (c) { return h('option', { value: c.id }, '[' + c.grade + '] ' + String(c.name).replace(/\$/g, '')); }));
    if (d.request.stage) stage.value = d.request.stage;
    if (d.request.conceptId) concept.value = d.request.conceptId;
    right.appendChild(h('div', { class: 'section-title' }, '선생님 답변'));
    right.appendChild(h('div', { class: 'field' }, ans));
    right.appendChild(h('div', { class: 'row2' }, h('div', { class: 'field' }, h('label', null, 'Newman 단계 판정'), stage), h('div', { class: 'field' }, h('label', null, '오개념 개념'), concept)));
    var m = openModal({
      title: d.student.cls + '반 ' + d.student.num + '번 ' + d.student.name, wide: true,
      body: h('div', { class: 'two' }, left, right),
      actions: [{ label: '닫기' }, {
        label: d.request.status === '대기' ? '답변 보내기' : '답변 수정', primary: true, onClick: function (close) {
          api('api_helpAnswer', S.token, { requestId: requestId, answer: ans.value, stage: stage.value, conceptId: concept.value }).then(function () {
            close(); toast('학생에게 답변을 보냈어요.'); renderTeacher('help');
          }).catch(function (e) { toast(e.message, 'err'); });
        }
      }]
    });
    return m;
  }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
}

/* ---------- 문제 출제 ---------- */
function openItemPreview(itemId) {
  showLoading('문항을 불러오고 있어요…');
  api('api_itemDetail', S.token, itemId).then(function (it) {
    hideLoading();
    var ansCell = h('div');
    function drawAnswer() {
      ansCell.innerHTML = '';
      if (!it.imageId) { ansCell.innerHTML = richHtml(it.answer); return; }
      var inp = h('input', { class: 'input', type: 'text', value: it.answer || '', placeholder: '예: ⑤ √42 cm', style: { maxWidth: '260px' } });
      var badge = h('span', { class: 'badge ' + (it.answerCheck === '확인됨' ? 'green' : 'orange') }, it.answerCheck === '확인됨' ? '교사 확인됨' : (it.answer ? 'AI 풀이 · 확인 필요' : '정답 없음'));
      var btn = h('button', { class: 'btn sm primary', type: 'button' }, '정답 확인·저장');
      btn.onclick = function () {
        btn.disabled = true;
        api('api_saveItemAnswer', S.token, { itemId: it.id, answer: inp.value }).then(function (r) {
          it.answer = r.answer; it.answerCheck = r.answerCheck; toast('정답을 저장했어요.'); drawAnswer();
        }).catch(function (e) { toast(e.message, 'err'); btn.disabled = false; });
      };
      ansCell.appendChild(h('div', { class: 'answer-edit' }, inp, btn, badge));
      if (it.note) ansCell.appendChild(h('div', { class: 'muted small' }, it.note));
    }
    drawAnswer();
    openModal({
      title: '문항 미리보기 · ' + it.code, wide: true,
      body: h('div', null, problemCard(it),
        h('div', { class: 'kv', style: { marginTop: '12px' } },
          h('div', { class: 'k' }, '정답'), ansCell,
          h('div', { class: 'k' }, '문항유형'), h('div', null, it.type),
          h('div', { class: 'k' }, '난이도'), h('div', null, String(it.diff)),
          h('div', { class: 'k' }, '생성'), h('div', null, it.source + ' · ' + it.createdAt)),
        h('div', { class: 'section-title' }, '풀이 단계'),
        h('ol', null, (it.steps || []).map(function (s) { return h('li', { html: richHtml(s), style: { marginBottom: '4px' } }); })))
    });
  }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
}

function renderBank(body) {
  body.innerHTML = '';
  var assignBox = h('div');
  var bankBox = h('div');
  body.appendChild(h('div', { class: 'section-title' }, '출제 목록'));
  body.appendChild(assignBox);
  body.appendChild(h('div', { class: 'section-title' }, '문제은행'));
  body.appendChild(h('div', { class: 'muted small', style: { marginBottom: '8px' } }, '중3 문항은 문제 이미지로 바로 출제할 수 있어요. 체크하고(Shift를 누르면 여러 개를 한 번에) 학급을 골라 출제하세요. [보기]에서 AI가 푼 정답을 확인해 주세요. 이미지가 없는 문항코드만 [AI 생성]으로 만들어요.'));
  body.appendChild(bankBox);
  loadAssignments(assignBox);
  loadBank(bankBox, {});
}

var TRASH_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7"/><path d="M6.5 7l.9 12.2c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>';
function trashButton(title, onClick) {
  var b = h('button', { class: 'icon-btn trash-btn', type: 'button', title: title, 'aria-label': title, html: TRASH_SVG });
  b.addEventListener('click', onClick);
  return b;
}

/*
 * 출제 목록: [체크] [순서·끌기] [문항] [대상] [상태] [휴지통]
 * 상태는 과제 기간(학생에게 보임) / 과제 종료(학생 목록에서 빠짐). 전체 선택 옆 [상태 변경]으로 바꾼다.
 * 순서는 왼쪽 손잡이(⠿)를 끌어다 놓아 바꾼다(마우스·터치 모두).
 */
function loadAssignments(box) {
  box.innerHTML = '';
  box.appendChild(inlineLoad());
  api('api_assignments', S.token).then(function (list) {
    box.innerHTML = '';
    if (!list.length) { box.appendChild(h('div', { class: 'notice' }, '아직 출제한 문제가 없어요.')); return; }
    var reload = function () { loadAssignments(box); };
    var tb = h('tbody');
    list.forEach(function (a, i) {
      var sel = h('input', { type: 'checkbox', 'data-id': a.assignmentId, title: 'Shift를 누르고 누르면 여러 개를 한 번에 골라요', 'aria-label': (i + 1) + '번 선택' });
      var grip = h('span', { class: 'drag-grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, '⠿');
      var tr = h('tr', { 'data-id': a.assignmentId },
        h('td', { class: 'assign-check' }, sel),
        h('td', { class: 'assign-no' }, h('span', { class: 'assign-no-in' }, grip, h('b', null, String(i + 1)))),
        h('td', { style: { cursor: 'pointer' }, onclick: function () { if (a.item) openItemPreview(a.item.id); } }, a.item ? h('div', { class: 'assign-concept', html: richHtml(a.item.conceptName) }) : '(문항 없음)'),
        h('td', { class: 'assign-unit' }, a.item && a.item.unit ? a.item.unit : '-'),
        h('td', { class: 'assign-target' }, a.classes.split(',').map(function (c) { return c + '반'; }).join(', ')),
        h('td', { class: 'assign-status' }, statusToggle_(a)),
        h('td', { class: 'assign-del' }, trashButton('출제 목록에서 빼기', function (e) {
          e.stopPropagation();
          confirmModal('이 문제를 출제 목록에서 뺄까요? (학생 풀이 기록은 남아요)', '빼기').then(function (ok) {
            if (!ok) return;
            api('api_updateAssignment', S.token, { assignmentId: a.assignmentId, action: 'delete' }).then(reload).catch(function (er) { toast(er.message, 'err'); });
          });
        })));
      bindRowDrag_(tr, grip, tb, function (from, to) {
        api('api_updateAssignment', S.token, { assignmentId: a.assignmentId, action: 'move', to: to }).then(function () { toast('순서를 바꿨어요.'); reload(); })
          .catch(function (er) { toast(er.message, 'err'); reload(); });
      });
      tb.appendChild(tr);
    });
    var sels = Array.prototype.slice.call(tb.querySelectorAll('input[type=checkbox]'));
    shiftSelect(sels);
    var all = h('input', { type: 'checkbox', title: '전체 선택', 'aria-label': '전체 선택' });
    var countEl = h('span', { class: 'muted small' });
    function picked() { return sels.filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-id'); }); }
    var delBtn = trashButton('선택한 문제를 출제 목록에서 빼기', function () {
      var ids = picked();
      if (!ids.length) return;
      confirmModal(ids.length + '개 문제를 출제 목록에서 뺄까요? (학생 풀이 기록은 남아요)', '빼기').then(function (ok) {
        if (!ok) return;
        api('api_removeAssignments', S.token, { ids: ids }).then(function (n) { toast(n + '개를 출제 목록에서 뺐어요.'); reload(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
    function updSel() {
      var n = picked().length;
      countEl.textContent = n ? n + '개 선택' : '';
      delBtn.disabled = !n;
      all.checked = n === sels.length;
    }
    all.onchange = function () { sels.forEach(function (c) { c.checked = all.checked; }); updSel(); };
    tb.addEventListener('change', updSel);
    updSel();
    box.appendChild(h('div', { class: 'filters assign-tools', style: { alignItems: 'center' } },
      h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, all, '전체 선택'), delBtn, countEl,
      h('span', { class: 'muted small', style: { marginLeft: 'auto' } }, '상태를 눌러 과제 기간 ↔ 과제 종료 · ⠿를 끌어 순서 바꾸기 · Shift로 여러 개 선택')));
    box.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl assign' },
      h('thead', null, h('tr', null, h('th', { class: 'assign-check' }, ''), h('th', null, '순서'), h('th', null, '문항'), h('th', { class: 'assign-unit' }, '단원'), h('th', { class: 'assign-target' }, '대상'), h('th', { class: 'assign-status' }, '상태'), h('th', { class: 'assign-del' }, ''))), tb)));
  }).catch(function (e) { box.innerHTML = ''; box.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/** 상태 스위치: 누르면 과제 기간(켜짐) ↔ 과제 종료(꺼짐). 과제 종료면 학생 목록에서 빠진다. */
function statusToggle_(a) {
  var btn = h('button', { class: 'status-toggle', type: 'button', role: 'switch' });
  function draw() {
    btn.classList.toggle('on', a.visible);
    btn.setAttribute('aria-checked', String(a.visible));
    btn.title = a.visible ? '누르면 과제 종료(학생 목록에서 빠져요)' : '누르면 다시 과제 기간';
    btn.innerHTML = '';
    btn.appendChild(h('span', { class: 'knob', 'aria-hidden': 'true' }));
    btn.appendChild(h('span', { class: 'lbl' }, a.visible ? '과제 기간' : '과제 종료'));
  }
  btn.onclick = function (e) {
    e.stopPropagation();
    if (btn.disabled) return;
    btn.disabled = true;
    a.visible = !a.visible; draw(); // 먼저 바꿔 보여 주고, 실패하면 되돌린다
    api('api_updateAssignment', S.token, { assignmentId: a.assignmentId, action: 'toggle' })
      .catch(function (er) { a.visible = !a.visible; draw(); toast(er.message, 'err'); })
      .then(function () { btn.disabled = false; });
  };
  draw();
  return btn;
}

/** 표의 행을 손잡이로 끌어 다른 자리에 놓는다. 놓으면 onDrop(원래 자리, 새 자리) */
function bindRowDrag_(tr, grip, tbody, onDrop) {
  var drag = null;
  grip.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var rows = Array.prototype.slice.call(tbody.children);
    drag = { from: rows.indexOf(tr), rows: rows, startY: e.clientY, to: rows.indexOf(tr) };
    try { grip.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    tr.classList.add('dragging');
    document.body.classList.add('row-dragging');
  });
  grip.addEventListener('pointermove', function (e) {
    if (!drag) return;
    e.preventDefault();
    tr.style.transform = 'translateY(' + (e.clientY - drag.startY) + 'px)';
    // 포인터가 있는 행 찾기(끄는 행은 빼고)
    var to = drag.from;
    drag.rows.forEach(function (r, k) {
      var b = r.getBoundingClientRect();
      if (r !== tr && e.clientY > b.top && e.clientY < b.bottom) to = k;
    });
    drag.to = to;
    drag.rows.forEach(function (r, k) { r.classList.toggle('drop-before', r !== tr && k === to && to < drag.from); r.classList.toggle('drop-after', r !== tr && k === to && to > drag.from); });
  });
  function end() {
    if (!drag) return;
    var d = drag; drag = null;
    tr.style.transform = '';
    tr.classList.remove('dragging');
    document.body.classList.remove('row-dragging');
    d.rows.forEach(function (r) { r.classList.remove('drop-before', 'drop-after'); });
    if (d.to !== d.from) onDrop(d.from, d.to);
  }
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

function loadBank(box, f) {
  box.innerHTML = '';
  box.appendChild(inlineLoad('문항정보를 불러오고 있어요…'));
  api('api_problemBank', S.token, f).then(function (d) {
    box.innerHTML = '';
    var gSel = h('select', { class: 'input' }, d.grades.map(function (g) { return h('option', { value: g, selected: g === d.grade }, g); }));
    var uSel = h('select', { class: 'input' }, h('option', { value: '' }, '전체 단원'), d.units.map(function (u) { return h('option', { value: u, selected: u === f.unit }, u); }));
    var q = h('input', { class: 'input', type: 'search', placeholder: '개념명·문항코드 검색', value: f.q || '' });
    var go = function () { loadBank(box, { grade: gSel.value, unit: gSel.value === d.grade ? uSel.value : '', q: q.value }); };
    gSel.onchange = go; uSel.onchange = go;
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    box.appendChild(h('div', { class: 'filters' }, gSel, uSel, q, h('button', { class: 'btn', onclick: go }, '검색')));
    if (!d.grades.length) { box.appendChild(h('div', { class: 'notice warn' }, '문항정보 시트를 찾지 못했어요. 스프레드시트에 문항정보_중3 같은 시트를 넣어 주세요.')); return; }
    var checks = [];
    var tb = h('tbody');
    d.rows.forEach(function (r) {
      var latest = r.imageItemId ? { id: r.imageItemId } : (r.generated.length ? r.generated[r.generated.length - 1] : null);
      var cb = h('input', { type: 'checkbox', disabled: !latest });
      if (latest) checks.push({ cb: cb, id: latest.id });
      var genCell = h('td', { style: { whiteSpace: 'nowrap' } });
      function drawGen() {
        genCell.innerHTML = '';
        if (r.imageItemId) {
          genCell.appendChild(h('button', { class: 'btn sm', onclick: function () { openItemPreview(r.imageItemId); } }, '🖼 보기'));
          return;
        }
        if (r.generated.length) genCell.appendChild(h('button', { class: 'btn sm', onclick: function () { openItemPreview(r.generated[r.generated.length - 1].id); } }, '보기(' + r.generated.length + ')'));
        genCell.appendChild(document.createTextNode(' '));
        var gb = h('button', { class: 'btn sm primary' }, r.generated.length ? '새로 생성' : 'AI 생성');
        gb.onclick = function () {
          gb.disabled = true; gb.textContent = '생성 중…';
          api('api_generateForCode', S.token, r.code).then(function (it) {
            r.generated.push({ id: it.id, preview: it.text });
            cb.disabled = false;
            checks.push({ cb: cb, id: it.id });
            toast('문항을 만들어 문항리스트에 저장했어요.');
            drawGen();
          }).catch(function (e) { toast(e.message, 'err'); gb.disabled = false; gb.textContent = 'AI 생성'; });
        };
        genCell.appendChild(gb);
      }
      drawGen();
      tb.appendChild(h('tr', null, h('td', null, cb), h('td', { class: 'small' }, r.code), h('td', { html: richHtml(r.conceptName) }), h('td', { class: 'small muted' }, r.unit), h('td', null, String(r.diff)), genCell));
    });
    box.appendChild(h('div', { class: 'muted small', style: { marginBottom: '6px' } }, '총 ' + d.total + '개' + (d.total > d.rows.length ? ' (앞의 ' + d.rows.length + '개 표시 · 단원이나 검색으로 좁혀 보세요)' : '')));
    shiftSelect(Array.prototype.slice.call(tb.querySelectorAll('input[type=checkbox]')));
    box.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl bank' }, h('thead', null, h('tr', null, h('th', null, '선택'), h('th', null, '문항코드'), h('th', null, '개념'), h('th', null, '단원'), h('th', null, '난이도'), h('th', null, '문제'))), tb)));
    // 출제 버튼은 문항 은행 맨 위에 둔다(목록이 길어 아래까지 내려가지 않아도 되게).
    var clsBox = h('div', { class: 'filters assign-bar', style: { alignItems: 'center' } }, h('b', null, '대상 학급:'));
    var clsChecks = TT.home.classes.map(function (c) {
      var x = h('input', { type: 'checkbox', checked: true });
      clsBox.appendChild(h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, x, c.label));
      return { x: x, cls: c.cls };
    });
    var assignBtn = h('button', {
      class: 'btn primary', onclick: function () {
        var ids = checks.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.id; });
        if (!ids.length) { toast('출제할 문제를 아래 목록에서 체크해 주세요.', 'err'); return; }
        var classes = clsChecks.filter(function (c) { return c.x.checked; }).map(function (c) { return c.cls; });
        api('api_assign', S.token, { itemIds: ids, classes: classes }).then(function (n) { toast(n + '개 문제를 출제했어요.'); renderTeacher('bank'); }).catch(function (e) { toast(e.message, 'err'); });
      }
    });
    function updateCount() {
      var n = checks.filter(function (c) { return c.cb.checked; }).length;
      assignBtn.textContent = '선택한 문제 출제' + (n ? ' (' + n + ')' : '');
    }
    updateCount();
    box.addEventListener('change', updateCount);
    clsBox.appendChild(assignBtn);
    box.insertBefore(clsBox, box.firstChild);
  }).catch(function (e) { box.innerHTML = ''; box.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

/* ---------- 설정 팝업 ---------- */
function openTeacherSettings() {
  showLoading('설정을 불러오고 있어요…');
  api('api_teacherSettings', S.token).then(function (st) {
    hideLoading();
    var dl = h('datalist', { id: 'model-list' }, st.providers.openai.models.map(function (m) { return h('option', { value: m }); }));
    var model = h('input', { class: 'input', type: 'text', list: 'model-list', value: st.model });
    var base = h('input', { class: 'input', type: 'url', value: st.baseUrl, placeholder: st.defaultBaseUrl, autocapitalize: 'off', spellcheck: 'false' });
    var key = h('input', { class: 'input', type: 'password', placeholder: 'API 키 (' + st.keyStatus + ')', autocomplete: 'off' });
    var status = h('div', { class: 'muted small', style: { marginTop: '4px' } }, '현재: ' + st.keyStatus + ' · 키는 화면과 시트에 저장되지 않고 스크립트 내부 저장소에만 보관돼요.');
    var msg = h('div', { class: 'msg' });
    function save(extraKey) {
      msg.className = 'msg'; msg.textContent = '';
      return api('api_saveTeacherSettings', S.token, { provider: 'openai', baseUrl: base.value, model: model.value, apiKey: extraKey !== undefined ? extraKey : key.value }).then(function (r) {
        key.value = '';
        key.placeholder = 'API 키 (' + r.keyStatus + ')';
        status.textContent = '현재: ' + r.keyStatus;
        base.value = r.baseUrl;
        msg.className = 'msg ok'; msg.textContent = '저장했어요.';
      }).catch(function (e) { msg.textContent = e.message; });
    }
    var testBtn = h('button', {
      class: 'btn', onclick: function () {
        testBtn.disabled = true;
        msg.className = 'msg'; msg.textContent = '연결을 확인하고 있어요…';
        save().then(function () { return api('api_testAi', S.token); }).then(function (r) {
          if (r) { msg.className = 'msg ok'; msg.textContent = '연결 성공! (' + r.provider + ' · ' + r.model + ')'; }
        }).catch(function (e) { msg.className = 'msg'; msg.textContent = e.message; }).then(function () { testBtn.disabled = false; });
      }
    }, '저장하고 연결 테스트');
    // 스크롤 없이 한 화면에: 왼쪽 AI 설정, 오른쪽 계정(넓은 화면에서 두 칸)
    var body = h('div', { class: 'settings-grid' },
      h('div', { class: 'settings-col' },
        h('div', { class: 'card-title' }, 'AI 설정'),
        h('div', { class: 'field' }, h('label', null, 'API 주소 (OpenAI 호환, 비우면 기본값)'), base),
        h('div', { class: 'field' }, h('label', null, '모델 (이미지 읽기가 되는 모델)'), model, dl),
        h('div', { class: 'field' }, h('label', null, 'API 키'), key, status),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: function () { save(); } }, '저장'), testBtn,
          h('button', { class: 'btn danger', onclick: function () { confirmModal('저장된 API 키를 지울까요?', '지우기').then(function (ok) { if (ok) save('__DELETE__'); }); } }, '키 삭제')),
        msg),
      h('div', { class: 'settings-col' },
        h('div', { class: 'card-title' }, '계정'),
        h('div', { class: 'muted small', style: { marginBottom: '10px' } }, '로그인 아이디: ' + st.loginId),
        passwordForm()));
    openModal({ title: '설정', wide: true, body: body, actions: [{ label: '로그아웃', danger: true, onClick: function (c) { c(); logout(); } }, { label: '닫기', primary: true }] });
  }).catch(function (e) { hideLoading(); toast(e.message, 'err'); });
}

/* ---------- 데이터 보기: DB의 모든 표 ---------- */
var DV = { key: '', q: '', offset: 0 };

function renderData(body) {
  body.innerHTML = '';
  body.appendChild(inlineLoad('표 목록을 불러오고 있어요…'));
  api('api_dataTables', S.token).then(function (d) {
    body.innerHTML = '';
    var all = d.sheets.concat(d.tables);
    var byKey = {};
    all.forEach(function (t) { byKey[t.kind + ':' + t.name] = t; });
    if (!byKey[DV.key]) { DV.key = all.length ? all[0].kind + ':' + all[0].name : ''; DV.offset = 0; DV.q = ''; }
    var sel = h('select', { class: 'input', 'aria-label': '표 고르기' });
    [['app', '앱 시트'], ['ref', '기준 자료'], ['system', '시스템 표']].forEach(function (g) {
      var list = all.filter(function (t) { return t.group === g[0]; });
      if (!list.length) return;
      var og = h('optgroup', { label: g[1] });
      list.forEach(function (t) { og.appendChild(h('option', { value: t.kind + ':' + t.name }, t.name + ' (' + t.rows + ')')); });
      sel.appendChild(og);
    });
    sel.value = DV.key;
    var search = h('input', { class: 'input', type: 'search', placeholder: '이 표에서 찾기', value: DV.q });
    var desc = h('div', { class: 'muted small', style: { marginBottom: '8px' } });
    var holder = h('div');
    function load() {
      var t = byKey[DV.key];
      if (!t) return;
      desc.textContent = (t.kind === 'table' ? '[시스템 표] ' : '') + (t.desc || '') ;
      holder.innerHTML = '';
      holder.appendChild(inlineLoad());
      api('api_dataRows', S.token, { kind: t.kind, name: t.name, q: DV.q, offset: DV.offset, limit: 50 }).then(function (r) { drawDataTable(holder, t, r, load); })
        .catch(function (e) { holder.innerHTML = ''; holder.appendChild(h('div', { class: 'notice warn' }, e.message)); });
    }
    sel.addEventListener('change', function () { DV.key = sel.value; DV.offset = 0; DV.q = ''; search.value = ''; load(); });
    function doSearch() { DV.q = search.value.trim(); DV.offset = 0; load(); }
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    body.appendChild(h('div', { class: 'filters' }, sel, search, h('button', { class: 'btn', onclick: doSearch }, '찾기'),
      h('button', { class: 'btn', onclick: function () { renderData(body); } }, '새로고침')));
    body.appendChild(desc);
    body.appendChild(holder);
    body.appendChild(h('div', { class: 'muted small', style: { marginTop: '8px' } }, '읽기 전용이에요. 비밀번호 해시·솔트, API 키, 로그인 세션 토큰은 가려서 보여 줘요. 잘린 칸(…)을 누르면 전체 내용을 볼 수 있어요.'));
    load();
  }).catch(function (e) { body.innerHTML = ''; body.appendChild(h('div', { class: 'notice warn' }, e.message)); });
}

function showDataValue(title, text) {
  var pretty = text;
  if (/^\s*[\[{]/.test(text)) { try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { pretty = text; } }
  openModal({ title: title, wide: true, body: h('pre', { class: 'data-pre' }, pretty) });
}

function drawDataTable(holder, t, r, reload) {
  holder.innerHTML = '';
  if (!r.total) { holder.appendChild(h('div', { class: 'notice' }, DV.q ? '찾는 내용이 없어요.' : '비어 있는 표예요.')); return; }
  var thead = h('tr', null, h('th', null, '행'));
  r.columns.forEach(function (c) { thead.appendChild(h('th', null, c || '·')); });
  var tb = h('tbody');
  r.rows.forEach(function (row) {
    var tr = h('tr', null, h('td', { class: 'muted small' }, String(row.n)));
    row.cells.forEach(function (v, ci) {
      var clipped = v && typeof v === 'object';
      var text = clipped ? v.t : String(v === null || v === undefined ? '' : v);
      var long = clipped || text.length > 40;
      var td = h('td', { class: long ? 'cell-long' : '', title: long ? '눌러서 전체 보기' : '' }, clipped ? text + '…' : text);
      if (long) td.addEventListener('click', function () {
        var label = t.name + ' · ' + (r.columns[ci] || '') + ' (' + row.n + '행)';
        if (!clipped) { showDataValue(label, text); return; }
        api('api_dataCell', S.token, { name: t.name, row: row.n, col: ci }).then(function (full) { showDataValue(label, full); })
          .catch(function (e) { toast(e.message, 'err'); });
      });
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  holder.appendChild(h('div', { class: 'tbl-wrap data-wrap' }, h('table', { class: 'tbl data-tbl' }, h('thead', null, thead), tb)));
  var from = r.offset + 1, to = Math.min(r.offset + r.rows.length, r.total);
  holder.appendChild(h('div', { class: 'pager' },
    h('button', { class: 'btn sm', disabled: r.offset <= 0, onclick: function () { DV.offset = Math.max(0, r.offset - r.limit); reload(); } }, '← 이전'),
    h('span', { class: 'muted small' }, from + '–' + to + ' / ' + r.total + '행'),
    h('button', { class: 'btn sm', disabled: to >= r.total, onclick: function () { DV.offset = r.offset + r.limit; reload(); } }, '다음 →')));
}
