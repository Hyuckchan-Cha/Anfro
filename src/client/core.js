/* ===================== 공통: 상태·서버 호출·UI 도구 ===================== */
var BOOT = window.BOOT || {};
var S = { token: null, profile: null, lastField: null };
try { S.token = localStorage.getItem('mdx_token'); } catch (e) { S.token = null; }

function $(sel, root) { return (root || document).querySelector(sel); }

function appendKid(el, c) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { appendKid(el, x); }); return; }
  el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
}

function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  for (var i = 2; i < arguments.length; i++) appendKid(el, arguments[i]);
  return el;
}

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function setToken(t) {
  S.token = t;
  try { if (t) localStorage.setItem('mdx_token', t); else localStorage.removeItem('mdx_token'); } catch (e) { /* 무시 */ }
}

/**
 * 서버 함수 호출 통로. Apps Script에서는 google.script.run, 그 밖(Vercel 배포)에서는 /api/rpc로 보낸다.
 * 두 경우 모두 runner.withSuccessHandler(…).withFailureHandler(…)[fn](…args) 모양으로 쓴다.
 */
function serverRunner() {
  if (window.google && google.script && google.script.run) return google.script.run;
  var ok = null, fail = null;
  var r = new Proxy({}, {
    get: function (_, name) {
      if (name === 'withSuccessHandler') return function (f) { ok = f; return r; };
      if (name === 'withFailureHandler') return function (f) { fail = f; return r; };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: name, args: args }) })
          .then(function (res) { return res.json().catch(function () { throw new Error('서버 응답을 읽지 못했어요 (' + res.status + ')'); }); })
          .then(function (data) { if (ok) ok(data); })
          .catch(function (e) { if (fail) fail(e); });
      };
    }
  });
  return r;
}

/** 서버 함수를 Promise로. 동시 접속 오류는 잠시 뒤 다시 시도 */
function api(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function (resolve, reject) {
    var tries = 0;
    function run() {
      var runner = serverRunner()
        .withSuccessHandler(function (res) {
          if (!res) { resolve(null); return; }
          if (res.ok) { resolve(res.data); return; }
          if (res.code === 'AUTH') { setToken(null); S.profile = null; renderLogin('student'); }
          var e = new Error(res.error || '오류가 발생했어요.');
          e.code = res.code;
          reject(e);
        })
        .withFailureHandler(function (err) {
          var msg = String((err && err.message) || err || '');
          if (tries < 3 && /simultaneous|too many|NetworkError|network|동시/i.test(msg)) {
            tries++;
            setTimeout(run, 1200 * tries + Math.random() * 800);
            return;
          }
          reject(new Error(msg || '서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'));
        });
      runner[fn].apply(runner, args);
    }
    run();
  });
}

function toast(msg, type) {
  var box = $('#toast');
  var t = h('div', { class: 'toast' + (type === 'err' ? ' err' : '') }, msg);
  box.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, type === 'err' ? 5000 : 3000);
}

var _loadingEl = null;
/* AI가 일하는 동안: 물개 그림(3장 중 무작위) + '물개가 …하고 있어요' + 점 1→3개 반복 */
var MASCOTS = ['/img/mascot-1.webp', '/img/mascot-2.webp', '/img/mascot-3.webp'];
// 글자 인식(풀이 읽기) 중에는 따로 정한 그림 하나를 쓴다. 파일이 없으면 글자만 보인다.
var READING_IMG = '/img/reading.webp';
var MASCOT_NAME = 'Anfro';
function isAiMsg_(msg) { return /^AI가\s/.test(String(msg || '')); }
function aiMsg_(msg) {
  var m = String(msg).match(/^AI가\s*(.*?)\s*(?:…|\.\.\.)?\s*(?:\(([^)]*)\))?\s*$/) || [];
  var body = String(m[1] || '').replace(/[….]+$/, '');
  var a = { main: MASCOT_NAME + '가 ' + body, sub: m[2] || '', reading: false };
  if (/풀이를 분석하고 있어요/.test(body)) a.main = MASCOT_NAME + '가 채점하고 있어요';
  if (/풀이를 읽고 있어요/.test(body)) { a.main = '인식중'; a.reading = true; }
  return a;
}
function mascotBox(msg, small, extra) {
  var a = aiMsg_(msg);
  var img = h('img', { class: 'mascot-img', src: a.reading ? READING_IMG : MASCOTS[Math.floor(Math.random() * MASCOTS.length)], alt: '' });
  img.onerror = function () { img.style.display = 'none'; };
  return h('div', { class: 'mascot-load' + (small ? ' sm' : '') + (a.reading ? ' reading' : ''), role: 'status', 'aria-live': 'polite' }, img,
    h('div', { class: 'mascot-text' }, a.main, h('span', { class: 'dots', 'aria-hidden': 'true' }, h('span', null, '.'), h('span', null, '.'), h('span', null, '.'))),
    a.sub || extra ? h('div', { class: 'mascot-sub' }, a.sub, extra || null) : null);
}

function showLoading(msg) {
  hideLoading();
  _loadingEl = isAiMsg_(msg) ? h('div', { class: 'loading mascot' }, mascotBox(msg))
    : h('div', { class: 'loading' }, h('div', { class: 'spinner' }), h('div', null, msg || '잠시만 기다려 주세요…'));
  document.body.appendChild(_loadingEl);
}
function hideLoading() { if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; } }

function inlineLoad(msg) {
  if (isAiMsg_(msg)) return mascotBox(msg, true);
  return h('div', { class: 'inline-load' }, h('div', { class: 'spinner sm' }), msg || '불러오는 중…');
}

/** opt: {title, body, actions:[{label, primary, danger, onClick(close)}], wide, sticky} */
function openModal(opt) {
  var back = h('div', { class: 'modal-back' });
  var box = h('div', { class: 'modal' + (opt.wide ? ' wide' : '') });
  function close() { if (back.parentNode) back.parentNode.removeChild(back); if (opt.onClose) opt.onClose(); }
  if (opt.title) box.appendChild(h('h3', null, opt.title));
  appendKid(box, opt.body);
  var foot = h('div', { class: 'foot' });
  (opt.actions || [{ label: '닫기' }]).forEach(function (a) {
    foot.appendChild(h('button', {
      class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''),
      onclick: function () { if (a.onClick) a.onClick(close); else close(); }
    }, a.label));
  });
  box.appendChild(foot);
  back.appendChild(box);
  back.addEventListener('click', function (e) { if (e.target === back && !opt.sticky) close(); });
  document.body.appendChild(back);
  return { close: close, box: box };
}

function confirmModal(message, okLabel) {
  return new Promise(function (resolve) {
    openModal({
      title: '확인', body: h('div', { style: { lineHeight: '1.6' } }, message), sticky: true,
      actions: [
        { label: '취소', onClick: function (c) { c(); resolve(false); } },
        { label: okLabel || '확인', primary: true, onClick: function (c) { c(); resolve(true); } }
      ]
    });
  });
}

function notReady(title) {
  openModal({ title: title, body: h('div', { class: 'notice' }, '아직 기능을 탑재하지 않았습니다.') });
}

function setApp(node) {
  // 화면 색: 교사는 쿨톤, 학생·로그인은 웜톤
  document.body.classList.toggle('theme-teacher', !!(S.profile && S.profile.role === 'teacher'));
  var app = $('#app');
  app.innerHTML = '';
  app.appendChild(node);
  window.scrollTo(0, 0);
}

/** Anfro 로고: 모양만 가져와 화면의 강조색(--key)으로 칠한다(학생 = 진한 녹색, 교사 = 적갈색). */
function brandLogo(cls) { return h('span', { class: 'brand-logo' + (cls ? ' ' + cls : ''), role: 'img', 'aria-label': 'Anfro' }); }
/** 로고 + 학교명 한 묶음 */
function brandSchool(cls) {
  return h('span', { class: 'brand-school' + (cls ? ' ' + cls : '') }, brandLogo(), BOOT.school ? h('span', { class: 'brand-school-name' }, BOOT.school) : null);
}

function topbar(left, title, right) {
  // 왼쪽·오른쪽 내용 폭이 달라도 이름이 가운데 오게: 세 칸(1fr · auto · 1fr)
  return h('div', { class: 'topbar' }, h('div', { class: 'topbar-side left' }, left || null), h('div', { class: 'title' }, title), h('div', { class: 'topbar-side right' }, right || null));
}

function settingsButton(onClick) { return h('button', { class: 'icon-btn', title: '설정', 'aria-label': '설정', onclick: onClick }, '⚙'); }
function classLabel(cls) { return (BOOT.grade || '3') + '학년 ' + cls + '반'; }

function zoomImage(src) {
  openModal({ title: '풀이 사진', wide: true, body: h('img', { src: src, style: { width: '100%', borderRadius: '12px' } }) });
}

/** 비밀번호 변경 폼 (학생·교사 공통) */
function passwordForm() {
  var a = h('input', { class: 'input', type: 'password', placeholder: '현재 비밀번호', autocomplete: 'current-password' });
  var b = h('input', { class: 'input', type: 'password', placeholder: '새 비밀번호 (4자 이상)', autocomplete: 'new-password' });
  var c = h('input', { class: 'input', type: 'password', placeholder: '새 비밀번호 확인', autocomplete: 'new-password' });
  var msg = h('div', { class: 'msg' });
  var btn = h('button', {
    class: 'btn primary', onclick: function () {
      msg.className = 'msg'; msg.textContent = '';
      btn.disabled = true;
      api('api_changePassword', S.token, a.value, b.value, c.value).then(function () {
        msg.className = 'msg ok'; msg.textContent = '비밀번호를 바꿨어요.';
        a.value = b.value = c.value = '';
      }).catch(function (e) { msg.textContent = e.message; }).then(function () { btn.disabled = false; });
    }
  }, '비밀번호 변경');
  return h('div', null, h('div', { class: 'section-title', style: { marginTop: '4px' } }, '비밀번호 변경'),
    h('div', { class: 'field' }, a), h('div', { class: 'field' }, b), h('div', { class: 'field' }, c), btn, msg);
}

function logout() {
  var t = S.token;
  setToken(null);
  S.profile = null;
  if (t) api('api_logout', t).catch(function () { });
  renderLogin('student');
}

/* 수식 입력칸 추적 (기호 버튼이 마지막으로 눌렀던 칸에 들어가도록) */
document.addEventListener('focusin', function (e) {
  var t = e.target;
  if (t && t.getAttribute && t.getAttribute('data-math')) S.lastField = t;
});

function insertAtCaret(el, text, back) {
  var start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
  var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  var pos = start + text.length - (back || 0);
  el.focus();
  try { el.setSelectionRange(pos, pos); } catch (e) { /* 무시 */ }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

var SYMBOLS = [['x²', '²'], ['xⁿ', '^()', 1], ['√', '√()', 1], ['분수', '()/()', 4], ['+'], ['−', '-'], ['±'], ['×'], ['÷'], ['='], ['≠'], ['<'], ['>'], ['≤'], ['≥'],
  ['('], [')'], ['π'], ['°'], ['sin', 'sin '], ['cos', 'cos '], ['tan', 'tan '], ['∠'], ['AB̅ 선분', '\\overline{}', 1], ['△'], ['⊥'], ['∥'], ['≡'], ['∽'], ['→'], ['∴'], ['또는', ' 또는 ']];

/**
 * 체크박스 목록에서 Shift를 누르고 클릭하면 마지막으로 누른 칸부터 지금 칸까지 같은 상태로 바꾼다.
 * boxes는 화면 순서대로의 체크박스 배열(비활성 칸은 건너뜀).
 */
function shiftSelect(boxes) {
  var last = null;
  boxes.forEach(function (cb) {
    cb.addEventListener('click', function (e) {
      if (e.shiftKey && last && last !== cb) {
        var a = boxes.indexOf(last), b = boxes.indexOf(cb);
        for (var k = Math.min(a, b); k <= Math.max(a, b); k++) if (!boxes[k].disabled) boxes[k].checked = cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      last = cb;
    });
  });
}

/** 중3 수준 기호 버튼. fallback(): 포커스된 칸이 없을 때 넣을 칸 */
function symbolBar(fallback) {
  var bar = h('div', { class: 'symbar' });
  SYMBOLS.forEach(function (s) {
    var ins = s[1] || s[0], back = s[2] || 0;
    var b = h('button', { class: 'sym', type: 'button', title: ins.trim() }, s[0]);
    function doIns() {
      var t = (S.lastField && document.body.contains(S.lastField) && bar.parentNode && bar.parentNode.contains(S.lastField)) ? S.lastField : (fallback ? fallback() : null);
      if (t) insertAtCaret(t, ins, back);
    }
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('touchstart', function (e) { e.preventDefault(); doIns(); }, { passive: false });
    b.addEventListener('click', doIns);
    bar.appendChild(b);
  });
  return bar;
}

/** 휴대폰 사진을 1600px JPEG로 줄여 업로드 */
function compressImage(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, hgt = img.naturalHeight;
      var scale = Math.min(1, 1600 / Math.max(w, hgt));
      w = Math.round(w * scale); hgt = Math.round(hgt * scale);
      var c = document.createElement('canvas');
      c.width = w; c.height = hgt;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);
      ctx.drawImage(img, 0, 0, w, hgt);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 열 수 없어요. 다른 사진으로 시도해 주세요.')); };
    img.src = url;
  });
}

function boot() {
  // Vercel 배포에서는 첫 화면 정보(학교명·학급 목록)를 서버에서 받아 온다(Apps Script는 페이지에 미리 넣어 줌).
  if (!BOOT.appName && !(window.google && google.script)) {
    serverRunner().withSuccessHandler(function (cfg) { Object.assign(BOOT, cfg || {}); BOOT.appName = BOOT.appName || '수학 오개념 진단 도우미'; boot(); })
      .withFailureHandler(function () { BOOT.appName = '수학 오개념 진단 도우미'; boot(); }).bootConfig_();
    return;
  }
  if (!S.token) { renderLogin('student'); return; }
  showLoading('로그인 정보를 확인하고 있어요…');
  api('api_me', S.token).then(function (p) {
    hideLoading();
    S.profile = p;
    if (p.role === 'teacher') renderTeacher('folders'); else renderStudentHome();
  }).catch(function () { hideLoading(); setToken(null); renderLogin('student'); });
}
