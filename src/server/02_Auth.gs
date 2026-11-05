/* ===================== 로그인·회원가입·세션 ===================== */

function pepper_() {
  var p = PropertiesService.getScriptProperties();
  var v = p.getProperty('PEPPER');
  if (!v) {
    v = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    p.setProperty('PEPPER', v);
  }
  return v;
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }

function hashPw_(pw, salt) {
  var v = String(salt) + '|' + String(pw) + '|' + pepper_();
  for (var i = 0; i < 40; i++) {
    v = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8));
  }
  return 'h$' + v;
}

function checkPwRule_(pw) {
  pw = String(pw || '');
  if (pw.length < 4) throw userError_('비밀번호는 4자 이상으로 정해 주세요.');
  if (pw.length > 40) throw userError_('비밀번호가 너무 길어요.');
}

/* ---------- 세션 (CacheService, 6시간) ---------- */
function createSession_(info) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  info.at = now_();
  CacheService.getScriptCache().put('S:' + token, JSON.stringify(info), SESSION_TTL_SEC);
  return token;
}
function getSession_(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  var c = CacheService.getScriptCache();
  var raw = c.get('S:' + token);
  if (!raw) return null;
  c.put('S:' + token, raw, SESSION_TTL_SEC);
  return JSON.parse(raw);
}
function authError_() { return userError_('로그인이 만료되었어요. 다시 로그인해 주세요.', 'AUTH'); }
function requireStudent_(token) {
  var s = getSession_(token);
  if (!s || s.role !== 'student') throw authError_();
  return s;
}
function requireTeacher_(token) {
  var s = getSession_(token);
  if (!s || s.role !== 'teacher') throw authError_();
  return s;
}

/* ---------- 로그인 시도 제한 ---------- */
function checkRate_(key) {
  var n = parseInt(CacheService.getScriptCache().get('LF:' + key) || '0', 10);
  if (n >= 5) throw userError_('비밀번호를 여러 번 틀렸어요. 5분 뒤에 다시 시도해 주세요.');
}
function failRate_(key) {
  var c = CacheService.getScriptCache();
  var n = parseInt(c.get('LF:' + key) || '0', 10) + 1;
  c.put('LF:' + key, String(n), 300);
}
function clearRate_(key) { CacheService.getScriptCache().remove('LF:' + key); }

/* ---------- 학생·교사 찾기 ---------- */
/** 학번 = 학년 + 반(2자리) + 번호(2자리). 예: 3학년 1반 1번 → 30101 */
function studentIdFor_(cls, num) {
  return String(setting_('학년') || '3') + ('0' + parseInt(cls, 10)).slice(-2) + ('0' + parseInt(num, 10)).slice(-2);
}

function findStudent_(cls, num) {
  cls = String(cls).trim(); num = String(parseInt(num, 10));
  var list = rows_(SH.STUDENT);
  for (var i = 0; i < list.length; i++) {
    if (str_(list[i]['반']) === cls && String(parseInt(list[i]['번호'], 10)) === num) return list[i];
  }
  return null;
}
function teachers_() { return memo_('teachers', function () { return rows_(SH.TEACHER); }); }
function teacherForClass_(cls) {
  var ts = teachers_();
  for (var i = 0; i < ts.length; i++) {
    if (splitList_(ts[i]['담당반']).indexOf(String(cls)) >= 0) return ts[i];
  }
  return null;
}
function studentSessionInfo_(st) {
  var t = teacherForClass_(str_(st['반']));
  return {
    role: 'student', id: str_(st['학생ID']), cls: str_(st['반']), num: String(parseInt(st['번호'], 10)),
    name: str_(st['이름']), teacherId: t ? str_(t['교사ID']) : str_(st['담당교사ID']),
    teacherName: t ? str_(t['이름']) : '', classLabel: classLabel_(str_(st['반']))
  };
}

/* ---------- 공개 API ---------- */
function api_studentLogin(p) {
  return wrap_(function () {
    p = p || {};
    var cls = String(p.cls || '').trim(), num = String(parseInt(p.num, 10) || ''), name = String(p.name || '').trim(), pw = String(p.password || '');
    if (!cls || !num || !pw) throw userError_('학급, 번호, 비밀번호를 입력해 주세요.');
    var key = 'st:' + cls + ':' + num;
    checkRate_(key);
    var st = findStudent_(cls, num);
    if (!st || str_(st['가입여부']) !== 'Y') throw userError_("가입된 아이디가 없어요. 아이디가 없다면 아래 [회원가입]을 눌러 주세요.");
    if (name && str_(st['이름']) && name.replace(/\s/g, '') !== str_(st['이름']).replace(/\s/g, '')) {
      failRate_(key);
      throw userError_('이름이 명단과 달라요.');
    }
    if (hashPw_(pw, str_(st['솔트'])) !== str_(st['비밀번호해시'])) {
      failRate_(key);
      throw userError_('비밀번호가 맞지 않아요.');
    }
    clearRate_(key);
    updateObj_(SH.STUDENT, st._row, { '최근접속': now_() });
    var info = studentSessionInfo_(st);
    return { token: createSession_(info), profile: info };
  });
}

function api_studentRegister(p) {
  return wrap_(function () {
    p = p || {};
    var cls = String(p.cls || '').trim(), num = parseInt(p.num, 10), name = String(p.name || '').trim();
    var pw = String(p.password || ''), pw2 = String(p.password2 || '');
    if (!cls || !num || !name) throw userError_('학급, 번호, 이름을 모두 입력해 주세요.');
    if (classList_().indexOf(cls) < 0) throw userError_('학급을 다시 골라 주세요.');
    if (num < 1 || num > 60) throw userError_('번호를 확인해 주세요.');
    if (name.length > 20) throw userError_('이름이 너무 길어요.');
    checkPwRule_(pw);
    if (pw !== pw2) throw userError_('비밀번호 확인이 일치하지 않아요.');
    var info = withLock_(function () {
      forget_('teachers');
      var st = findStudent_(cls, num);
      var salt = newSalt_();
      if (st) {
        // 한 번 가입된 학번은 다시 만들 수 없음
        if (str_(st['가입여부']) === 'Y') throw userError_('이미 가입된 학번과 이름이에요. 선생님에게 문의하세요.', 'DUP');
        // 명단에만 있고 가입하지 않은 학번 → 입력한 이름으로 가입
        updateObj_(SH.STUDENT, st._row, {
          '이름': name, '비밀번호해시': hashPw_(pw, salt), '솔트': salt, '가입여부': 'Y', '가입일시': now_(), '최근접속': now_(), '가상여부': 'N'
        });
        st = findStudent_(cls, num);
        updateStageSumName_(str_(st['학생ID']), name);
        return studentSessionInfo_(st);
      }
      var t = teacherForClass_(cls);
      var id = studentIdFor_(cls, num);
      appendObj_(SH.STUDENT, {
        '학생ID': id, '반': cls, '번호': num, '이름': name, '담당교사ID': t ? str_(t['교사ID']) : '',
        '비밀번호해시': hashPw_(pw, salt), '솔트': salt, '가입여부': 'Y', '가입일시': now_(), '최근접속': now_(), '가상여부': 'N'
      });
      ensureStudentScoreRows_([{ id: id, cls: cls, num: num, name: name }]);
      return studentSessionInfo_(findStudent_(cls, num));
    });
    return { token: createSession_(info), profile: info };
  });
}

function api_teacherLogin(p) {
  return wrap_(function () {
    p = p || {};
    var loginId = String(p.loginId || '').trim(), pw = String(p.password || '');
    if (!loginId || !pw) throw userError_('아이디와 비밀번호를 입력해 주세요.');
    var key = 'tc:' + loginId;
    checkRate_(key);
    var t = null;
    teachers_().forEach(function (x) { if (str_(x['로그인ID']) === loginId) t = x; });
    if (!t || hashPw_(pw, str_(t['솔트'])) !== str_(t['비밀번호해시'])) {
      failRate_(key);
      throw userError_('아이디 또는 비밀번호가 맞지 않아요.');
    }
    clearRate_(key);
    var info = { role: 'teacher', id: str_(t['교사ID']), name: str_(t['이름']), classes: splitList_(t['담당반']) };
    return { token: createSession_(info), profile: info };
  });
}

function api_me(token) {
  return wrap_(function () {
    var s = getSession_(token);
    if (!s) throw authError_();
    return s;
  });
}

function api_logout(token) {
  return wrap_(function () {
    if (token) CacheService.getScriptCache().remove('S:' + token);
    return true;
  });
}

function api_changePassword(token, oldPw, newPw, newPw2) {
  return wrap_(function () {
    var s = getSession_(token);
    if (!s) throw authError_();
    checkPwRule_(newPw);
    if (newPw !== newPw2) throw userError_('새 비밀번호 확인이 일치하지 않아요.');
    var sheetName = s.role === 'teacher' ? SH.TEACHER : SH.STUDENT;
    var row = getObj_(sheetName, s.id);
    if (!row) throw authError_();
    if (hashPw_(oldPw, str_(row['솔트'])) !== str_(row['비밀번호해시'])) throw userError_('현재 비밀번호가 맞지 않아요.');
    var salt = newSalt_();
    var patch = { '비밀번호해시': hashPw_(newPw, salt), '솔트': salt };
    if (s.role === 'teacher') patch['수정일시'] = now_();
    updateObj_(sheetName, row._row, patch);
    return true;
  });
}
