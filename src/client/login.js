/* ===================== 로그인·회원가입 ===================== */
/* 웹을 열면 바로 로그인 창. 아이디가 없는 학생만 [회원가입]. */

function renderLogin(mode) {
  mode = mode || 'student';
  // 하얀 카드는 크기 고정: 위(로고) · 학생/교사 · 입력칸 · 아래(로그인/회원가입 버튼 자리 고정)
  var card = h('div', { class: 'card login-card mode-' + mode });
  card.appendChild(h('div', { class: 'login-brand' }, brandSchool('lg')));
  if (BOOT.ready === false) card.appendChild(h('div', { class: 'notice warn' }, '아직 초기 설정이 되지 않았어요. 선생님께 알려 주세요.'));
  if (mode === 'signup') {
    card.appendChild(h('div', { class: 'tabs login-tabs' }, h('button', { class: 'tab active', type: 'button' }, '회원가입')));
  } else {
    card.appendChild(h('div', { class: 'tabs login-tabs' },
      h('button', { class: 'tab' + (mode === 'student' ? ' active' : ''), type: 'button', onclick: function () { renderLogin('student'); } }, '학생'),
      h('button', { class: 'tab' + (mode === 'teacher' ? ' active' : ''), type: 'button', onclick: function () { renderLogin('teacher'); } }, '교사')));
  }
  var fields = h('div', { class: 'login-fields' });
  var actions = h('div', { class: 'login-actions' });
  var msg = h('div', { class: 'msg' });
  card.appendChild(fields);
  card.appendChild(actions);
  card.appendChild(msg);

  function signupRow(onClick) {
    actions.appendChild(h('div', { class: 'muted small login-ask' }, '아이디가 없나요?'));
    actions.appendChild(h('button', { class: 'btn block login-signup', type: 'button', onclick: onClick }, '회원가입'));
  }

  if (mode === 'teacher') {
    var tid = h('input', { class: 'input', type: 'text', autocomplete: 'username', autocapitalize: 'off' });
    var tpw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
    var tbtn = h('button', { class: 'btn primary block', type: 'button' }, '로그인');
    var goT = function () {
      msg.className = 'msg'; msg.textContent = '';
      tbtn.disabled = true;
      api('api_teacherLogin', { loginId: tid.value, password: tpw.value }).then(afterLogin).catch(function (e) { msg.textContent = e.message; }).then(function () { tbtn.disabled = false; });
    };
    tbtn.onclick = goT;
    tpw.addEventListener('keydown', function (e) { if (e.key === 'Enter') goT(); });
    fields.appendChild(h('div', { class: 'field' }, h('label', null, '아이디'), tid));
    fields.appendChild(h('div', { class: 'field' }, h('label', null, '비밀번호'), tpw));
    actions.appendChild(tbtn);
    // 교사 계정은 스스로 만들 수 없다: 버튼 자리는 같게 두고 안내만 한다.
    signupRow(function () {
      openModal({ title: '교사 회원가입', body: h('div', { style: { lineHeight: '1.7' } }, '교사 계정은 관리자가 만들어 드려요.', h('br'), '학교 담당자(관리자)에게 아이디 발급을 요청해 주세요. 받은 아이디로 로그인한 뒤 ⚙ 설정에서 비밀번호를 바꿀 수 있어요.') });
    });
    setApp(loginShell(card, mode));
    return;
  }

  var sel = h('select', { class: 'input' });
  (BOOT.classes || ['1', '2', '3', '4', '5']).forEach(function (c) { sel.appendChild(h('option', { value: c }, classLabel(c))); });
  var num = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '1', max: '60', value: '1' });
  var name = h('input', { class: 'input', type: 'text', autocomplete: 'name' });
  var pw = h('input', { class: 'input', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password' });
  var pw2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  fields.appendChild(h('div', { class: 'row2' },
    h('div', { class: 'field' }, h('label', null, '학급'), sel),
    h('div', { class: 'field' }, h('label', null, '번호'), num)));
  fields.appendChild(h('div', { class: 'field' }, h('label', null, mode === 'signup' ? '이름' : '이름 (교사에게만 보여요)'), name));
  fields.appendChild(h('div', { class: 'field' }, h('label', null, mode === 'signup' ? '비밀번호 (4자 이상)' : '비밀번호'), pw));
  if (mode === 'signup') fields.appendChild(h('div', { class: 'field' }, h('label', null, '비밀번호 확인'), pw2));

  var main = h('button', { class: 'btn primary block', type: 'button' }, mode === 'signup' ? '등록하고 시작' : '로그인');
  var go = function () {
    msg.className = 'msg'; msg.textContent = '';
    main.disabled = true;
    var payload = { cls: sel.value, num: num.value, name: name.value.trim(), password: pw.value, password2: pw2.value };
    api(mode === 'signup' ? 'api_studentRegister' : 'api_studentLogin', payload).then(afterLogin)
      .catch(function (e) { msg.textContent = e.message; }).then(function () { main.disabled = false; });
  };
  main.onclick = go;
  [pw, pw2].forEach(function (x) { x.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); });
  actions.appendChild(main);
  if (mode === 'signup') {
    actions.appendChild(h('div', { class: 'login-ask' }, h('button', { class: 'link-btn', type: 'button', onclick: function () { renderLogin('student'); } }, '← 로그인으로 돌아가기')));
  } else {
    signupRow(function () { renderLogin('signup'); });
  }
  setApp(loginShell(card, mode));
}

/** 로그인 화면: 왼쪽에 큰 제목과 클레이 장식, 오른쪽에 로그인 카드(휴대폰에서는 위아래로) */
function loginShell(card, mode) {
  var copy = h('div', { class: 'login-copy' },
    h('h1', { class: 'login-title' }, h('span', { class: 'login-title-text' }, '수학 오개념 진단 도우미'), brandLogo('login-title-logo')),
    h('div', { class: 'login-team' }, '박근형 · 양지운 · 차혁찬 · 최연서'));
  // 교사를 고르면 로그인 화면의 강조색을 교사 색으로 바꾼다
  return h('div', { class: 'login-page' + (mode === 'teacher' ? ' as-teacher' : '') }, h('div', { class: 'login-hero' }, copy, card));
}

function afterLogin(res) {
  setToken(res.token);
  S.profile = res.profile;
  if (res.profile.role === 'teacher') renderTeacher('folders'); else renderStudentHome();
}
